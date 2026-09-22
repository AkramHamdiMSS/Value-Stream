const express = require("express");
const { authenticate, requirePermission } = require("../middleware/auth");
const { logActivity } = require("../lib/activity");
const syncTempoWorklogs = require("../../scripts/sync-tempo-worklogs");
const extractAsciiCalendar = require("../../scripts/extract-ascii-calendar");

const router = express.Router();
router.use(authenticate);
router.use(requirePermission("managePool"));

// POST /admin/sync-tempo — pulls Tempo worklogs (real API token, see
// lib/tempo.js) and aggregates them into LoggedTime for the plan/réel
// comparison on the Dashboard.
router.post("/sync-tempo", async (req, res) => {
  try {
    const summary = await syncTempoWorklogs();
    await logActivity({
      user: req.user,
      action: `a synchronisé les temps Tempo (${summary.matched} ligne(s), ${summary.unmatchedAccounts} compte(s) Jira non rattachés)`,
    });
    res.json(summary);
  } catch (e) {
    console.error("Erreur sync Tempo:", e.message);
    res.status(502).json({ error: `Échec de la synchro Tempo : ${e.message}` });
  }
});

// POST /admin/extract-ascii — déclenche l'extraction des congés depuis ASCII
// Les identifiants sont lus depuis le fichier .env du backend
router.post("/extract-ascii", async (req, res) => {
  try {
    console.log('🚀 POST /admin/extract-ascii appelé');
    
    await logActivity({ 
      user: req.user, 
      action: "a déclenché l'extraction du calendrier ASCII" 
    });

    // Configurer les variables d'environnement depuis .env
    process.env.ASCII_USERNAME = process.env.ASCII_USERNAME || "";
    process.env.ASCII_PASSWORD = process.env.ASCII_PASSWORD || "";

    if (!process.env.ASCII_USERNAME || !process.env.ASCII_PASSWORD) {
      return res.status(400).json({ 
        error: "Identifiants ASCII non configurés. Veuillez ajouter ASCII_USERNAME et ASCII_PASSWORD dans le fichier .env du backend." 
      });
    }

    // Capturer les logs via un callback
    const logs = [];
    const logCallback = (...args) => {
      const message = args.join(' ');
      console.log(message); // Toujours logger dans la console serveur
      logs.push(message);   // Et capturer pour le frontend
    };

    try {
      console.log('📍 Début extraction ASCII avec capture de logs');
      await extractAsciiCalendar(logCallback);
      console.log('✅ Extraction terminée, logs capturés:', logs.length);
      
      res.json({ 
        success: true,
        message: "Extraction ASCII terminée avec succès. La base de données a été mise à jour.",
        logs: logs
      });
    } catch (extractionError) {
      console.error("Erreur lors de l'extraction ASCII:", extractionError);
      res.status(500).json({ 
        error: "Erreur lors de l'extraction ASCII: " + extractionError.message,
        logs: logs
      });
    }
  } catch (error) {
    console.error("Erreur lors du déclenchement de l'extraction:", error);
    res.status(500).json({ error: "Erreur lors du déclenchement de l'extraction" });
  }
});

// GET /admin/extract-ascii-stream — exécute l'extraction avec streaming des logs en temps réel
router.get("/extract-ascii-stream", async (req, res) => {
  try {
    console.log('📍 Endpoint extract-ascii-stream appelé - Méthode:', req.method);
    console.log('📍 URL:', req.url);
    console.log('📍 Headers:', req.headers);
    
    // Temporairement : pas d'authentification pour tester le streaming
    // TODO : réactiver l'authentification après test
    /*
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ error: "Token manquant" });
    }

    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = process.env;
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      console.log('✅ Token vérifié:', decoded.name);
    } catch (jwtError) {
      console.error('❌ Erreur vérification token:', jwtError.message);
      return res.status(401).json({ error: "Token invalide: " + jwtError.message });
    }

    const { hasPermission } = require("../lib/permissions");
    if (!hasPermission(req.user, "managePool")) {
      console.log('❌ Permission refusée pour:', req.user.name);
      return res.status(403).json({ error: "Permission refusée" });
    }

    console.log('✅ Permissions vérifiées pour:', req.user.name);
    */

    console.log('⚠️  Mode test : authentification désactivée temporairement');

    // Configurer les headers pour Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (message) => {
      res.write(`data: ${JSON.stringify({ type: 'log', message })}\n\n`);
    };

    const sendError = (error) => {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error })}\n\n`);
    };

    const sendComplete = (result) => {
      res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
      res.end();
    };

    // Intercepter console.log pour envoyer les logs au frontend
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      originalLog(...args);
      sendLog(args.join(' '));
    };
    
    console.error = (...args) => {
      originalError(...args);
      sendError(args.join(' '));
    };

    try {
      console.log('🚀 Démarrage extraction ASCII (streaming)');
      
      // Configurer les variables d'environnement depuis .env
      process.env.ASCII_USERNAME = process.env.ASCII_USERNAME || "";
      process.env.ASCII_PASSWORD = process.env.ASCII_PASSWORD || "";

      if (!process.env.ASCII_USERNAME || !process.env.ASCII_PASSWORD) {
        sendError("Identifiants ASCII non configurés. Veuillez ajouter ASCII_USERNAME et ASCII_PASSWORD dans le fichier .env du backend.");
        sendComplete({ success: false, error: "Identifiants manquants" });
        return;
      }

      // Exécuter l'extraction
      await extractAsciiCalendar();
      sendComplete({ success: true, message: "Extraction ASCII terminée avec succès" });
    } catch (error) {
      sendError(error.message);
      sendComplete({ success: false, error: error.message });
    } finally {
      // Restaurer console.log
      console.log = originalLog;
      console.error = originalError;
    }
  } catch (error) {
    console.error("Erreur lors du streaming de l'extraction:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur lors du streaming de l'extraction" });
    }
  }
});

module.exports = router;
