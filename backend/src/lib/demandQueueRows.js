const { effective } = require("./periods");
const { PROFILE_FIELDS } = require("./profiles");
const { periodRange } = require("./capacity");

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

// One row per (demand line × profile with headcount > 0), matched against
// overlapping allocation lines by sous-équipe — the shape both the
// "Demandes à affecter" queue and the admin dashboard's backlog KPI need,
// kept in one place so their notion of "untreated/proposed/validated"
// can't drift apart.
//
// Coverage is checked week by week: an allocation only counts for the weeks
// it actually overlaps, so a 1-week allocation on a 4-week demand shows as
// 25% covered — not "validated" just because something overlaps somewhere.
//   demanded   FTE asked (per week, constant over the line)
//   allocated  average approved FTE over the demand's weeks
//   covered    average min(demanded, approved) over the weeks
//   status     validated (every week fully staffed) / partial / proposed / untreated
function buildDemandQueueRows(projects, profileFilter) {
  const rows = [];
  for (const proj of projects) {
    for (const line of proj.demandLines) {
      if (!line.periodStart || !line.periodEnd) continue;
      const weeks = periodRange(line.periodStart, line.periodEnd);
      if (weeks.length === 0) continue;
      for (const { profile, countField, pctField } of PROFILE_FIELDS) {
        if (profileFilter && profile !== profileFilter) continue;
        const demanded = effective(line[countField], line[pctField]);
        if (demanded <= 0) continue;

        let allocatedSum = 0, coveredSum = 0, fullWeeks = 0;
        let hasPending = false;
        for (const w of weeks) {
          let approved = 0;
          for (const a of proj.allocationLines) {
            if (a.poolMember?.sousEquipe !== profile) continue;
            if (w < a.periodStart || w > a.periodEnd) continue;
            if (a.status === "approved") approved += Number(a.pct) || 0;
            else if (a.status === "pending") hasPending = true;
          }
          allocatedSum += approved;
          const cov = Math.min(demanded, approved);
          coveredSum += cov;
          if (cov + 0.001 >= demanded) fullWeeks++;
        }
        const allocated = allocatedSum / weeks.length;
        const covered = coveredSum / weeks.length;
        const status = fullWeeks === weeks.length ? "validated"
          : covered > 0.001 ? "partial"
          : hasPending ? "proposed" : "untreated";
        rows.push({
          key: `${proj.id}:${line.id}:${profile}`,
          projectId: proj.id,
          projectName: proj.name,
          svo: proj.svo?.name,
          periodStart: line.periodStart,
          periodEnd: line.periodEnd,
          weeks: weeks.length,
          profile,
          demanded: round1(demanded),
          allocated: round1(allocated),
          covered: round1(covered),
          ecart: round1(covered - demanded),
          coveredWeeks: fullWeeks,
          couverture: round1((100 * covered) / demanded),
          hasPending,
          status,
        });
      }
    }
  }
  return rows;
}

module.exports = { buildDemandQueueRows };
