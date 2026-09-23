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

module.exports = router;
