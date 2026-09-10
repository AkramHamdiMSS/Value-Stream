const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { effective } = require("../lib/periods");

const router = express.Router();
router.use(authenticate, requirePermission("viewDemandQueue"));

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

router.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { demandSubmitted: true },
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });

  const rows = [];
  for (const proj of projects) {
    for (const line of proj.demandLines) {
      if (!line.period || !line.profile) continue;
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
