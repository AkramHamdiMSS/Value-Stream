const puppeteer = require('puppeteer');
const prisma = require('../src/lib/prisma');
const fs = require('fs');

/**
 * Extrait les congés depuis ASCII et les importe dans la base de données
 * Utilisation : node scripts/extract-ascii-calendar.js
 * Variables d'environnement requises :
 * - ASCII_USERNAME : identifiant ASCII
 * - ASCII_PASSWORD : mot de passe ASCII
 * @param {Function} logCallback - Callback optionnel pour capturer les logs (logMessage)
 */

async function extractAsciiCalendar(logCallback = logCallback) {
  const username = process.env.ASCII_USERNAME;
  const password = process.env.ASCII_PASSWORD;

  if (!username || !password) {
    throw new Error('Variables ASCII_USERNAME et ASCII_PASSWORD requises');
  }

  logCallback('🚀 Démarrage de l\'extraction ASCII...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const apiRequests = [];

  try {
    const page = await browser.newPage();
    
    // Intercepter les requêtes réseau avant navigation
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('calendar') || url.includes('leave') || url.includes('conge') || url.includes('ajax') || url.includes('api')) {
        logCallback('🔗 API Request:', url);
        try {
          const contentType = response.headers()['content-type'];
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            apiRequests.push({ url, data });
            logCallback('📦 API Response:', JSON.stringify(data).substring(0, 500));
          }
        } catch (e) {
          // Not JSON response or other error
        }
      }
    });
    
    // Navigation vers la page de connexion
    logCallback('📍 Navigation vers ASCII...');
    await page.goto('https://mssolutions.hrascii.com/index.php/calendar/workmates', {
      waitUntil: 'networkidle2'
    });

    // Connexion
    logCallback('🔐 Connexion en cours...');
    
    // Attendre que la page soit chargée et analyser les champs disponibles
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Essayer différents sélecteurs possibles pour le champ identifiant
    const usernameSelectors = [
      'input[name="identifiant"]',
      'input[name="username"]',
      'input[name="login"]',
      'input[name="user"]',
      'input[type="text"]',
      '#identifiant',
      '#username',
      '#login'
    ];
    
    let usernameInput = null;
    for (const selector of usernameSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        usernameInput = await page.$(selector);
        if (usernameInput) {
          logCallback(`✅ Champ identifiant trouvé avec sélecteur: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!usernameInput) {
      throw new Error('Champ identifiant non trouvé. Sélecteurs essayés: ' + usernameSelectors.join(', '));
    }
    
    // Essayer différents sélecteurs pour le champ mot de passe
    const passwordSelectors = [
      'input[name="password"]',
      'input[name="pass"]',
      'input[type="password"]',
      '#password',
      '#pass'
    ];
    
    let passwordInput = null;
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        passwordInput = await page.$(selector);
        if (passwordInput) {
          logCallback(`✅ Champ mot de passe trouvé avec sélecteur: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!passwordInput) {
      throw new Error('Champ mot de passe non trouvé. Sélecteurs essayés: ' + passwordSelectors.join(', '));
    }
    
    // Remplir les champs
    await usernameInput.type(username);
    await passwordInput.type(password);
    
    // Trouver et cliquer sur le bouton de soumission
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[type="button"]',
      '.btn-submit',
      '#submit'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = await page.$(selector);
        if (submitButton) {
          logCallback(`✅ Bouton soumission trouvé avec sélecteur: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (submitButton) {
      await submitButton.click();
    } else {
      // Tenter de soumettre le formulaire en appuyant sur Entrée
      await page.keyboard.press('Enter');
    }

    // Attendre la redirection après connexion
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    logCallback('✅ Connexion réussie');
    
    // Naviguer vers la page spécifique du calendrier workmates
    logCallback('📍 Navigation vers le calendrier workmates...');
    await page.goto('https://mssolutions.hrascii.com/index.php/calendar/workmates', {
      waitUntil: 'networkidle2'
    });
    
    // Attendre que le contenu du calendrier soit chargé (plus long délai pour contenu dynamique)
    logCallback('⏳ Attente du chargement du contenu du calendrier...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Essayer de scroller pour charger le contenu lazy
    logCallback('📜 Scroll pour charger le contenu...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Essayer de cliquer sur des éléments qui pourraient révéler les données
    logCallback('🖱️ Recherche d\'éléments interactifs...');
    const interactiveElements = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, .btn, [onclick]'));
      return buttons.map(btn => ({
        text: btn.textContent?.trim().substring(0, 30),
        class: btn.className,
        onclick: btn.getAttribute('onclick')
      })).slice(0, 10);
    });
    logCallback('Éléments interactifs trouvés:', interactiveElements);
    
    // Attendre un peu plus pour que les API calls se fassent
    logCallback('⏳ Attente des appels API...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    logCallback('📊 API requests capturées:', apiRequests.length);
    
    // Si on a des réponses API, essayer d'en extraire les données
    let calendarData = [];
    
    // Si on a des réponses API, essayer d'en extraire les données
    if (apiRequests.length > 0) {
      logCallback('🔍 Analyse des réponses API...');
      for (const request of apiRequests) {
        logCallback('Analyse de:', request.url);
        if (request.data && Array.isArray(request.data)) {
          // Si c'est un tableau, essayer d'en extraire des données de congés
          for (const item of request.data) {
            if (item.title || item.name || item.employee || item.start || item.end) {
              const name = item.title || item.name || item.employee || item.firstname;
              const dates = item.start && item.end ? `${item.start} - ${item.end}` : item.date;
              
              // Mapper la couleur ASCII au statut
              let type = 'congé';
              if (item.color) {
                const color = item.color.toLowerCase();
                if (color === '#ff0000' || color === 'red') {
                  type = 'congé refusé';
                } else if (color === '#468847' || color === 'green' || color.includes('00')) {
                  type = 'congé validé';
                } else if (color.includes('orange') || color.includes('ff') || color.includes('f00')) {
                  type = 'congé demandé';
                }
              }
              
              if (name && dates) {
                calendarData.push({ name, dates, type, color: item.color });
                logCallback(`API entry: ${name} - ${dates} (${type}) [color: ${item.color}]`);
              }
            }
          }
        }
      }
    }
    
    // Si pas de données via API, utiliser l'extraction DOM traditionnelle
    if (calendarData.length === 0) {
      logCallback('⚠️ Pas de données via API, extraction DOM...');
      
      // Capturer le HTML complet pour debug
      const pageContent = await page.content();
      logCallback('=== PAGE HTML (first 2000 chars) ===');
      logCallback(pageContent.substring(0, 2000));
      
      // Sauvegarder le HTML complet dans un fichier pour analyse
      fs.writeFileSync('/tmp/ascii-page.html', pageContent);
      logCallback('📄 HTML complet sauvegardé dans /tmp/ascii-page.html');

      calendarData = await page.evaluate(() => {
        const data = [];
        
        // Debug: log page structure
        logCallback('=== DEBUG PAGE STRUCTURE ===');
        logCallback('Document title:', document.title);
        logCallback('All divs with classes:', Array.from(document.querySelectorAll('div[class]')).map(d => d.className).slice(0, 20));
        
        // Chercher spécifiquement les éléments de congés dans le calendrier
        // ASCII utilise souvent des divs avec des classes spécifiques pour les congés
        const leaveElements = document.querySelectorAll('[class*="leave"], [class*="absence"], [class*="holiday"], [class*="conge"], .calendar-event, .event, [class*="request"]');
        logCallback('Leave elements found:', leaveElements.length);
        
        leaveElements.forEach((element, index) => {
          logCallback(`Leave element ${index}:`, element.className, element.textContent.substring(0, 100));
          
          // Chercher le nom de la personne dans l'élément ou ses parents
          const name = element.querySelector('[class*="name"], [class*="employee"], [class*="person"], strong, b')?.textContent?.trim() 
                     || element.getAttribute('data-name') 
                     || element.getAttribute('data-employee')
                     || element.textContent.match(/([A-Z][a-z]+ [A-Z][a-z]+)/)?.[0];
          
          // Chercher les dates
          const dates = element.querySelector('[class*="date"], [class*="period"], [class*="range"], time')?.textContent?.trim()
                      || element.getAttribute('data-date')
                      || element.getAttribute('data-period')
                      || element.textContent.match(/(\d{2}\/\d{2}\/\d{4})/)?.[0];
          
          // Chercher le type
          const type = element.querySelector('[class*="type"], [class*="reason"]')?.textContent?.trim()
                     || element.getAttribute('data-type')
                     || 'congé';
          
          if (name && dates) {
            data.push({ name, dates, type });
            logCallback(`Found leave entry: ${name} - ${dates} (${type})`);
          }
        });
        
        // Chercher dans les tableaux de données
        const tables = document.querySelectorAll('table');
        logCallback('Tables found:', tables.length);
        tables.forEach((table, tableIndex) => {
          const rows = table.querySelectorAll('tr');
          logCallback(`Table ${tableIndex} has ${rows.length} rows`);
          
          rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) { // Au moins 2 colonnes
              const name = cells[0]?.textContent?.trim();
              const dates = cells[1]?.textContent?.trim();
              const type = cells[2]?.textContent?.trim() || 'congé';
              
              // Filtrer les en-têtes et les données non valides
              if (name && dates && 
                  !name.toLowerCase().includes('lun') && 
                  !name.toLowerCase().includes('mar') && 
                  !name.toLowerCase().includes('mer') && 
                  !name.toLowerCase().includes('jeu') && 
                  !name.toLowerCase().includes('ven') && 
                  !name.toLowerCase().includes('sam') && 
                  !name.toLowerCase().includes('dim') &&
                  !name.match(/^\d+$/) && // Pas un nombre seul
                  name.length > 2) { // Au moins 3 caractères
                
                data.push({ name, dates, type });
                logCallback(`Found table entry: ${name} - ${dates} (${type})`);
              }
            }
          });
        });

        // Chercher des patterns de texte spécifiques aux congés
        const allText = document.body.innerText;
        logCallback('Text length:', allText.length);
        
        // Chercher des patterns comme "Nom Du Congé Date"
        const leavePatterns = allText.match(/([A-Z][a-z]+ [A-Z][a-z]+).*?(\d{2}\/\d{2}\/\d{4})/g);
        if (leavePatterns) {
          logCallback('Leave patterns found:', leavePatterns.length);
          leavePatterns.forEach(pattern => {
            const nameMatch = pattern.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
            const dateMatch = pattern.match(/(\d{2}\/\d{2}\/\d{4})/);
            if (nameMatch && dateMatch) {
              data.push({ name: nameMatch[1], dates: dateMatch[1], type: 'congé' });
              logCallback(`Found pattern entry: ${nameMatch[1]} - ${dateMatch[1]}`);
            }
          });
        }

        // Dédoublonner
        const unique = [];
        const seen = new Set();
        data.forEach(item => {
          const key = `${item.name}-${item.dates}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        });

        logCallback('Total unique entries:', unique.length);
        return unique;
      });
    } else {
      // Dédoublonner les données API
      const unique = [];
      const seen = new Set();
      calendarData.forEach(item => {
        const key = `${item.name}-${item.dates}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      });
      calendarData = unique;
    }

    logCallback(`📊 ${calendarData.length} entrées extraites`);

    // Parser et importer les données
    let imported = 0;
    let skipped = 0;

    for (const entry of calendarData) {
      // Nettoyer le nom (enlever les espaces multiples)
      const cleanName = entry.name.replace(/\s+/g, ' ').trim();
      
      // Fonction pour générer toutes les variations de noms/prénoms
      const generateNameVariations = (name) => {
        const words = name.split(' ').filter(w => w.length > 0);
        if (words.length === 0) return [name];
        
        const variations = new Set();
        
        // Ajouter le nom original
        variations.add(name);
        
        // Générer toutes les permutations
        if (words.length === 2) {
          // Prénom Nom -> Nom Prénom
          variations.add(words.reverse().join(' '));
          words.reverse(); // Remettre dans l'ordre
        } else if (words.length > 2) {
          // Pour plus de 2 mots, générer toutes les permutations
          const permute = (arr) => {
            if (arr.length <= 1) return [arr];
            const result = [];
            for (let i = 0; i < arr.length; i++) {
              const current = arr[i];
              const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
              const remainingPerms = permute(remaining);
              for (const perm of remainingPerms) {
                result.push([current, ...perm]);
              }
            }
            return result;
          };
          const permutations = permute(words);
          permutations.forEach(perm => variations.add(perm.join(' ')));
        }
        
        // Générer des correspondances partielles (contient au moins un mot)
        words.forEach(word => {
          variations.add(word);
          // Essayer avec chaque mot en premier
          words.forEach(otherWord => {
            if (word !== otherWord) {
              variations.add(`${word} ${otherWord}`);
            }
          });
        });
        
        return Array.from(variations);
      };
      
      const nameVariations = generateNameVariations(cleanName);
      
      // Trouver le pool member correspondant avec scoring
      let poolMember = null;
      let bestScore = 0;
      
      const allPoolMembers = await prisma.poolMember.findMany();
      
      for (const variation of nameVariations) {
        for (const member of allPoolMembers) {
          const memberName = member.name.toLowerCase();
          const variationLower = variation.toLowerCase();
          
          // Score de similarité
          let score = 0;
          
          // Correspondance exacte
          if (memberName === variationLower) {
            score = 100;
          }
          // Contient la variation
          else if (memberName.includes(variationLower)) {
            score = 80;
          }
          // La variation contient le nom du membre
          else if (variationLower.includes(memberName)) {
            score = 80;
          }
          // Correspondance partielle (au moins un mot en commun)
          else {
            const memberWords = memberName.split(' ');
            const variationWords = variationLower.split(' ');
            const commonWords = memberWords.filter(w => variationWords.includes(w));
            if (commonWords.length > 0) {
              score = commonWords.length * 30; // 30 points par mot en commun
            }
          }
          
          if (score > bestScore) {
            bestScore = score;
            poolMember = member;
          }
        }
        
        // Si on a une correspondance parfaite, on arrête
        if (bestScore >= 100) break;
      }
      
      // Seuil minimum de similarité
      if (bestScore < 30) {
        poolMember = null;
      }

      if (!poolMember) {
        logCallback(`⚠️  Personne non trouvée: ${cleanName} (score max: ${bestScore}, variations testées: ${nameVariations.length})`);
        skipped++;
        continue;
      }
      
      logCallback(`✅ Personne trouvée: ${poolMember.name} (score: ${bestScore}, match: "${cleanName}")`);

      // Parser les dates - essayer plusieurs formats
      let startDate, endDate;
      
      // Format 1: ISO 8601 (YYYY-MM-DDTHH:mm:ss) - depuis l'API ASCII
      let dateMatch = entry.dates.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s*[-–]\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
      if (dateMatch) {
        startDate = new Date(dateMatch[1]);
        endDate = new Date(dateMatch[2]);
      }
      // Format 2: DD/MM/YYYY - DD/MM/YYYY
      else if ((dateMatch = entry.dates.match(/(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/))) {
        startDate = new Date(dateMatch[1].split('/').reverse().join('-'));
        endDate = new Date(dateMatch[2].split('/').reverse().join('-'));
      }
      // Format 3: YYYY-MM-DD - YYYY-MM-DD
      else if ((dateMatch = entry.dates.match(/(\d{4}-\d{2}-\d{2})\s*[-–]\s*(\d{4}-\d{2}-\d{2})/))) {
        startDate = new Date(dateMatch[1]);
        endDate = new Date(dateMatch[2]);
      }
      
      if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        logCallback(`⚠️  Format de date non reconnu: ${entry.dates}`);
        skipped++;
        continue;
      }

      // Créer ou mettre à jour l'indisponibilité
      const existing = await prisma.unavailability.findFirst({
        where: {
          poolMemberId: poolMember.id,
          startDate,
          endDate,
          source: 'ascii'
        }
      });

      if (existing) {
        // Mettre à jour si nécessaire
        await prisma.unavailability.update({
          where: { id: existing.id },
          data: {
            type: entry.type || 'congé',
            updatedAt: new Date()
          }
        });
        logCallback(`🔄 Mis à jour: ${poolMember.name} (${entry.dates})`);
      } else {
        await prisma.unavailability.create({
          data: {
            poolMemberId: poolMember.id,
            startDate,
            endDate,
            type: entry.type || 'congé',
            source: 'ascii',
            color: entry.color || null
          }
        });
        logCallback(`✅ Importé: ${poolMember.name} (${entry.dates}) - Source: ASCII [${entry.type}]`);
      }
      imported++;
    }

    logCallback(`\n🎉 Import terminé: ${imported} importés, ${skipped} ignorés`);

  } finally {
    await browser.close();
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  extractAsciiCalendar()
    .then(() => {
      logCallback('✅ Extraction terminée avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur lors de l\'extraction:', error.message);
      process.exit(1);
    });
}

module.exports = extractAsciiCalendar;
