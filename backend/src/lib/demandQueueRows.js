const { effective } = require("./periods");
const { PROFILE_FIELDS } = require("./profiles");

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

// One row per (demand line × profile with headcount > 0), matched against
// overlapping allocation lines by sous-équipe — the shape both the
// "Demandes à affecter" queue and the admin dashboard's backlog KPI need,
// kept in one place so their notion of "untreated/proposed/validated"
// can't drift apart.
function buildDemandQueueRows(projects, profileFilter) {
  const rows = [];
  for (const proj of projects) {
    for (const line of proj.demandLines) {
      if (!line.periodStart || !line.periodEnd) continue;
      for (const { profile, countField, pctField } of PROFILE_FIELDS) {
        if (profileFilter && profile !== profileFilter) continue;
        const demanded = effective(line[countField], line[pctField]);
        if (demanded <= 0) continue;
        let allocated = 0;
        let hasPending = false;
        for (const a of proj.allocationLines) {
          // Overlap, not exact match — either range can span multiple weeks.
          if (a.periodStart > line.periodEnd || a.periodEnd < line.periodStart) continue;
          if (a.poolMember?.sousEquipe !== profile) continue;
          if (a.status === "approved") allocated += Number(a.pct) || 0;
          else if (a.status === "pending") hasPending = true;
        }
        const status = allocated > 0.001 ? "validated" : hasPending ? "proposed" : "untreated";
        rows.push({
          key: `${proj.id}:${line.id}:${profile}`,
          projectId: proj.id,
          projectName: proj.name,
          svo: proj.svo?.name,
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
  return rows;
}

module.exports = { buildDemandQueueRows };
