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
      if (!line.periodStart || !line.periodEnd) continue;
      // One demand row now covers all three squads — emit up to one queue
      // row per squad it actually has headcount for.
      for (const [profile, countField, pctField] of [["Mobile", "mobileCount", "mobilePct"], ["TPE", "tpeCount", "tpePct"], ["Digital", "digitalCount", "digitalPct"]]) {
        if (squadFilter && profile !== squadFilter) continue;
        const demanded = effective(line[countField], line[pctField]);
        if (demanded <= 0) continue;
        let allocated = 0;
        let hasPending = false;
        for (const a of proj.allocationLines) {
          // Overlap, not exact match — either range can now span multiple weeks.
          if (a.periodStart > line.periodEnd || a.periodEnd < line.periodStart) continue;
          if (a.poolMember?.squad !== profile) continue;
          if (a.status === "approved") allocated += Number(a.pct) || 0;
          else if (a.status === "pending") hasPending = true;
        }
        // Workflow stage, not a coverage ratio: has the HSV validated
        // anything yet (2nd validation), has a Team/Tech Lead at least
        // proposed something (1st validation), or is it untouched.
        const status = allocated > 0.001 ? "validated" : hasPending ? "proposed" : "untreated";
        rows.push({
          key: `${proj.id}:${line.id}:${profile}`,
          projectId: proj.id,
          projectName: proj.name,
          svo: proj.svo.name,
          periodStart: line.periodStart,
          periodEnd: line.periodEnd,
          profile,
          demanded: round1(demanded),
          allocated: round1(allocated),
          ecart: round1(allocated - demanded),
          status,
        });
      }
    }
  }
  rows.sort((a, b) => a.ecart - b.ecart);
  res.json(rows);
});

module.exports = router;
