const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { effective } = require("../lib/periods");

const router = express.Router();
router.use(authenticate);

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

router.get("/", async (req, res) => {
  const canViewAll = hasPermission(req.user, "viewDemandQueue") || hasPermission(req.user, "manageAllocations");
  const canPropose = hasPermission(req.user, "proposeAllocations");
  if (!canViewAll && !canPropose) return res.status(403).json({ error: "Accès refusé." });

  // A Team/Tech Lead without the full queue only sees demand for their own
  // squad, wherever it comes from in the org — not just projects they own.
  let squadFilter = null;
  if (!canViewAll && canPropose) {
    const self = await prisma.poolMember.findFirst({ where: { name: req.user.name } });
    squadFilter = self?.squad ?? null;
  }

  const projects = await prisma.project.findMany({
    where: { demandSubmitted: true },
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });

  const rows = [];
  for (const proj of projects) {
    for (const line of proj.demandLines) {
      if (!line.period || !line.profile) continue;
      if (squadFilter && line.profile !== squadFilter) continue;
      const demanded = effective(line.count, line.pct);
      let allocated = 0;
      for (const a of proj.allocationLines) {
        if (a.status !== "approved") continue;
        if (a.period !== line.period) continue;
        if (a.poolMember?.squad === line.profile) allocated += Number(a.pct) || 0;
      }
      rows.push({
        key: `${proj.id}:${line.id}`,
        projectId: proj.id,
        projectName: proj.name,
        svo: proj.svo.name,
        period: line.period,
        profile: line.profile,
        demanded: round1(demanded),
        allocated: round1(allocated),
        ecart: round1(allocated - demanded),
      });
    }
  }
  rows.sort((a, b) => a.ecart - b.ecart);
  res.json(rows);
});

module.exports = router;
