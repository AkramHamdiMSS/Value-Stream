const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { effective } = require("../lib/periods");
const { PROFILE_FIELDS } = require("../lib/profiles");

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

  const rows = [];
  for (const proj of projects) {
    for (const line of proj.demandLines) {
      if (!line.periodStart || !line.periodEnd) continue;
      // One demand row now covers all four profiles — emit up to one queue
      // row per profile it actually has headcount for.
      for (const { profile, countField, pctField } of PROFILE_FIELDS) {
        if (sousEquipeFilter && profile !== sousEquipeFilter) continue;
        const demanded = effective(line[countField], line[pctField]);
        if (demanded <= 0) continue;
        let allocated = 0;
        let hasPending = false;
        for (const a of proj.allocationLines) {
          // Overlap, not exact match — either range can now span multiple weeks.
          if (a.periodStart > line.periodEnd || a.periodEnd < line.periodStart) continue;
          if (a.poolMember?.sousEquipe !== profile) continue;
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
