const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { buildDemandQueueRows } = require("../lib/demandQueueRows");

const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const canViewAll = hasPermission(req.user, "viewDemandQueue") || hasPermission(req.user, "manageAllocations");
  const canPropose = hasPermission(req.user, "proposeAllocations");
  if (!canViewAll && !canPropose) return res.status(403).json({ error: "Accès refusé." });

  // A Team/Tech Lead without the full queue only sees demand for their own
  // sous-équipe (e.g. TPE Android, not all of TPE), wherever it comes from
  // in the org — not just projects they own.
  let sousEquipeFilter = null;
  if (!canViewAll && canPropose) {
    const self = await prisma.poolMember.findFirst({ where: { name: req.user.name } });
    sousEquipeFilter = self?.sousEquipe ?? null;
  }

  const projects = await prisma.project.findMany({
    where: { demandSubmitted: true },
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });

  const rows = buildDemandQueueRows(projects, sousEquipeFilter);
  rows.sort((a, b) => a.ecart - b.ecart);
  res.json(rows);
});

module.exports = router;
