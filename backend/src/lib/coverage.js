// Demand vs allocation, computed week by week and expressed in FTE-weeks
// (ETP-semaines): 1 person for 4 weeks = 4, 2 people for 1 week = 2.
//
// The naive alternative — summing each line's headcount regardless of how
// long it lasts, and comparing totals — makes a 1-week need look as big as a
// 12-week one, and lets an allocation in week 45 "cover" a need in week 40.
// Here demand and allocation are first laid out per week and per profile,
// and coverage is min(demand, allocation) in each week, so only staffing in
// the right week counts.
const { effective } = require("./periods");
const { PROFILES, PROFILE_FIELDS } = require("./profiles");
const { periodRange } = require("./capacity");

function zero() {
  return Object.fromEntries(PROFILES.map((p) => [p, 0]));
}
function sum(obj) {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}
function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

// Per-week demand of a project: Map<periodId, {profile: FTE}>.
function weeklyDemand(project) {
  const byWeek = new Map();
  for (const l of project.demandLines || []) {
    for (const p of periodRange(l.periodStart, l.periodEnd)) {
      if (!byWeek.has(p)) byWeek.set(p, zero());
      const row = byWeek.get(p);
      for (const { profile, countField, pctField } of PROFILE_FIELDS) {
        row[profile] += effective(l[countField], l[pctField]);
      }
    }
  }
  return byWeek;
}

// Per-week approved allocation of a project, keyed by the resource's
// sous-équipe (the profile it satisfies): Map<periodId, {profile: FTE}>.
function weeklyAllocation(project, { includePending = false } = {}) {
  const byWeek = new Map();
  for (const a of project.allocationLines || []) {
    if (a.status !== "approved" && !(includePending && a.status === "pending")) continue;
    const key = a.poolMember?.sousEquipe;
    if (!(key in zero())) continue;
    for (const p of periodRange(a.periodStart, a.periodEnd)) {
      if (!byWeek.has(p)) byWeek.set(p, zero());
      byWeek.get(p)[key] += Number(a.pct) || 0;
    }
  }
  return byWeek;
}

// Totals in FTE-weeks for one project, plus the per-week detail.
//   demand   what was asked, per profile
//   alloc    what is approved, per profile (may exceed demand)
//   covered  min(demand, alloc) per week — the part of the demand that is
//            actually satisfied in the right week
// `weeks` (optional Set of period ids) restricts the totals to a planning
// horizon — the org dashboard only looks at the current week onward.
function projectCoverage(project, { weeks: horizon = null } = {}) {
  const d = weeklyDemand(project);
  const a = weeklyAllocation(project);
  const demand = zero(), alloc = zero(), covered = zero();
  const weeks = [...new Set([...d.keys(), ...a.keys()])].filter((w) => !horizon || horizon.has(w));
  for (const w of weeks) {
    const dw = d.get(w) || zero();
    const aw = a.get(w) || zero();
    for (const p of PROFILES) {
      demand[p] += dw[p];
      alloc[p] += aw[p];
      covered[p] += Math.min(dw[p], aw[p]);
    }
  }
  const weeksCount = [...d.keys()].filter((w) => !horizon || horizon.has(w)).length;
  return {
    demand: { ...demand, total: sum(demand) },
    alloc: { ...alloc, total: sum(alloc) },
    covered: { ...covered, total: sum(covered) },
    weeksCount,
    byWeek: { demand: d, alloc: a },
  };
}

// Coverage %, or null when nothing was asked.
function coveragePct(covered, demand) {
  return demand > 0.001 ? round1((100 * covered) / demand) : null;
}

module.exports = { weeklyDemand, weeklyAllocation, projectCoverage, coveragePct, zero, sum, round1 };
