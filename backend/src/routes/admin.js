const express = require("express");
const { authenticate, requirePermission } = require("../middleware/auth");
const { logActivity } = require("../lib/activity");
const syncTempoWorklogs = require("../../scripts/sync-tempo-worklogs");

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
      action: `a synchronisé les temps Tempo (${summary.matched} ligne(s), ${summary.unmatchedAccounts} compte(s) et ${summary.unmatchedProjects} projet(s) non rattachés)`,
    });
    res.json(summary);
  } catch (e) {
    console.error("Erreur sync Tempo:", e.message);
    res.status(502).json({ error: `Échec de la synchro Tempo : ${e.message}` });
  }
});

module.exports = router;
