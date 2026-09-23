const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { generatePeriods, generatePeriodDates, currentPeriodId, inRange } = require("../lib/periods");
const { PROFILES } = require("../lib/profiles");
const { buildDemandQueueRows } = require("../lib/demandQueueRows");
const { STANDARD_WEEK_HOURS } = require("../lib/tempo");
const { netCapacity, isBlockingLeave, isWarningLeave, unavailableFraction } = require("../lib/capacity");
const { workingDaysOfWeek } = require("../lib/holidays");
const { projectCoverage, weeklyDemand, weeklyAllocation, coveragePct, zero: zeroByProfile, sum, round1 } = require("../lib/coverage");

const router = express.Router();
router.use(authenticate);

const HOURS_PER_DAY = STANDARD_WEEK_HOURS / 5;

function canViewAllProjects(user) {
  return hasPermission(user, "viewAllProjects") || hasPermission(user, "manageProjects") || hasPermission(user, "manageAllocations");
}

// Resource-load grid (who's on what, per week) — shared context every
// authenticated user sees regardless of scope. A Team/Tech Lead
// (viewDashboard and nothing else) only gets their own sous-équipe.
//
// Everything here is per resource × week:
//   overAllocGrid    planned load (sum of approved allocation %)
//   capacityGrid     net capacity — contract × tenure × (1 − validated leave),
//                    see lib/capacity.js. The over-allocation threshold is
//                    this number, not a flat 100%: a half-time person is
//                    over-allocated at 60%.
//   unavailableGrid  share of the week lost to validated leave (0..1)
//   loggedHoursGrid  real hours from Tempo
async function buildResourceLoad(periods, sousEquipeFilter) {
  const [allMembers, allocationLines, unavailabilities, loggedTime] = await Promise.all([
    prisma.poolMember.findMany(),
    prisma.allocationLine.findMany({
      where: { status: "approved" },
      select: {
        poolMemberId: true, periodStart: true, periodEnd: true, pct: true,
        project: { select: { id: true, name: true } },
        poolMember: { select: { name: true } },
        backupPoolMemberId: true,
        backupPoolMember: { select: { name: true } },
      },
    }),
    prisma.unavailability.findMany({
      select: { id: true, poolMemberId: true, startDate: true, endDate: true, type: true, comment: true, source: true },
    }),
    prisma.loggedTime.findMany({
      where: { period: { in: periods } },
      select: { poolMemberId: true, period: true, hours: true },
    }),
  ]);
  const pool = sousEquipeFilter ? allMembers.filter((m) => m.sousEquipe === sousEquipeFilter) : allMembers;
  const periodDates = generatePeriodDates().filter((pd) => periods.includes(pd.id));

  // Working days per week (5 minus public holidays) — what a "100%" week
  // really amounts to in hours for the Tempo comparison.
  const workingDaysByPeriod = Object.fromEntries(periodDates.map(({ id, monday }) => [id, workingDaysOfWeek(monday).length]));

  const leavesByMember = {};
  for (const u of unavailabilities) {
    if (u.type === "congé refusé") continue; // never happened — changes nothing
    (leavesByMember[u.poolMemberId] ||= []).push(u);
  }

  const overAllocGrid = {}, capacityGrid = {}, unavailableGrid = {}, loggedHoursGrid = {};
  const overAllocProjects = {};
  const unavailableMembers = {};
  for (const res of pool) {
    overAllocGrid[res.id] = Object.fromEntries(periods.map((p) => [p, 0]));
    capacityGrid[res.id] = {};
    unavailableGrid[res.id] = {};
    loggedHoursGrid[res.id] = Object.fromEntries(periods.map((p) => [p, 0]));
    const leaves = leavesByMember[res.id] || [];
    for (const { id: p, monday } of periodDates) {
      capacityGrid[res.id][p] = netCapacity(res, leaves, monday);
      unavailableGrid[res.id][p] = round1(unavailableFraction(leaves.filter(isBlockingLeave), monday) * 100) / 100;
      // Full records (validated + pending), so the UI can show the actual
      // days involved instead of just "en congé cette semaine".
      const touching = leaves.filter((u) => (isBlockingLeave(u) || isWarningLeave(u)) && unavailableFraction([u], monday) > 0);
      if (touching.length > 0) {
        (unavailableMembers[res.id] ||= {})[p] = touching.map((u) => ({ id: u.id, type: u.type, startDate: u.startDate, endDate: u.endDate, comment: u.comment, source: u.source }));
      }
    }
  }

  for (const l of allocationLines) {
    if (!overAllocGrid[l.poolMemberId]) continue;
    for (const p of periods) {
      if (!inRange(p, l.periodStart, l.periodEnd)) continue;
      overAllocGrid[l.poolMemberId][p] += Number(l.pct) || 0;
      (overAllocProjects[`${l.poolMemberId}:${p}`] ||= []).push({
        projectId: l.project.id, projectName: l.project.name, pct: round1(Number(l.pct) || 0), backupName: l.backupPoolMember?.name || null,
      });
    }
  }

  // The reverse view: for someone LISTED as a backup, which weeks/projects
  // are they on call for — a backup isn't a real allocation, it shouldn't
  // count as load, just flag the backup's own row.
  const backupFor = {};
  for (const l of allocationLines) {
    if (!l.backupPoolMemberId || !overAllocGrid[l.backupPoolMemberId]) continue;
    for (const p of periods) {
      if (!inRange(p, l.periodStart, l.periodEnd)) continue;
      ((backupFor[l.backupPoolMemberId] ||= {})[p] ||= []).push({ projectId: l.project.id, projectName: l.project.name, primaryName: l.poolMember?.name || null });
    }
  }

  for (const t of loggedTime) {
    if (!loggedHoursGrid[t.poolMemberId]) continue;
    loggedHoursGrid[t.poolMemberId][t.period] = round1((loggedHoursGrid[t.poolMemberId][t.period] || 0) + Number(t.hours));
  }

  // KPIs over the grid. "Expected hours" for a past week = planned load ×
  // hours per day × that week's working days, so a public holiday doesn't
  // read as a 20% timesheet gap.
  let alertCount = 0, conflictCount = 0, timesheetGapCount = 0;
  const currentPeriod = currentPeriodId();
  const realization = Object.fromEntries(PROFILES.map((p) => [p, { planned: 0, logged: 0 }]));
  for (const res of pool) {
    for (const p of periods) {
      const load = overAllocGrid[res.id][p] || 0;
      const cap = capacityGrid[res.id][p] ?? 1;
      if (load > cap + 0.001) alertCount++;
      if (load > 0.001 && unavailableGrid[res.id][p] > 0 && load > cap + 0.001) conflictCount++;
      if (p > currentPeriod) continue; // no expectation yet for a future week
      if (!res.jiraAccountId) continue; // no Tempo mapping — "no data" isn't "a gap"
      const expected = load * HOURS_PER_DAY * (workingDaysByPeriod[p] ?? 5);
      if (expected <= 0.001) continue;
      const logged = loggedHoursGrid[res.id][p] || 0;
      if (Math.abs(logged - expected) / expected > 0.2) timesheetGapCount++;
      if (res.sousEquipe in realization) {
        realization[res.sousEquipe].planned += expected;
        realization[res.sousEquipe].logged += logged;
      }
    }
  }

  return {
    pool: pool.map((p) => ({ id: p.id, name: p.name, squad: p.squad, sousEquipe: p.sousEquipe, jiraAccountId: p.jiraAccountId, capacityPct: Number(p.capacityPct ?? 1) })),
    overAllocGrid,
    capacityGrid,
    unavailableGrid,
    overAllocProjects,
    unavailableMembers,
    backupFor,
    loggedHoursGrid,
    workingDaysByPeriod,
    alertCount,
    conflictCount,
    timesheetGapCount,
    // Real vs planned, per profile, past weeks with Tempo data only. A ratio
    // consistently above 1 means that profile's demands are under-estimated.
    realizationByProfile: PROFILES.map((name) => {
      const r = realization[name];
      return { name, plannedHours: Math.round(r.planned), loggedHours: Math.round(r.logged), ratio: r.planned > 0.001 ? round1((r.logged / r.planned) * 100) / 100 : null };
    }),
  };
}

router.get("/", requirePermission("viewDashboard"), async (req, res) => {
  const periods = generatePeriods();
  const currentPeriod = currentPeriodId();
  // Planning horizon: current week + the next N−1 (default 16, ?horizon=26
  // or 52 to look further). Past weeks stay in the grid for history, but a
  // demand that was (or wasn't) covered last month is no longer something
  // the HSV can act on, and capacity summed over a whole year would dwarf
  // the demand of the coming weeks — so KPIs look at a bounded window.
  const horizonWeeks = Math.min(52, Math.max(4, parseInt(req.query.horizon, 10) || 16));
  const planningPeriods = periods.filter((p) => p >= currentPeriod).slice(0, horizonWeeks);
  const horizon = new Set(planningPeriods);

  const isMinimal = req.user.role !== "hsv" && !canViewAllProjects(req.user);
  let sousEquipeFilter = null;
  if (isMinimal) {
    const self = await prisma.poolMember.findFirst({ where: { name: req.user.name } });
    if (self) sousEquipeFilter = self.sousEquipe;
  }
  const resourceLoad = await buildResourceLoad(periods, sousEquipeFilter);

  if (!canViewAllProjects(req.user)) {
    const own = await buildOwnDashboard(req.user, periods, horizon);
    return res.json({ ...own, ...resourceLoad, periods, currentPeriod, planningWeeks: planningPeriods.length });
  }

  const projects = await prisma.project.findMany({
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });

  // Net capacity per profile per week, summed over the pool — the honest
  // "supply" side to put against weekly demand.
  const capacityByPeriod = periods.map((p) => {
    const row = { period: p, ...zeroByProfile() };
    for (const m of resourceLoad.pool) {
      if (m.sousEquipe in row) row[m.sousEquipe] = round1(row[m.sousEquipe] + (resourceLoad.capacityGrid[m.id]?.[p] || 0));
    }
    row.total = round1(sum(Object.fromEntries(PROFILES.map((k) => [k, row[k]]))));
    return row;
  });

  // Weekly demand / allocation over submitted projects only — a draft is a
  // SVO still making up their mind, not a need the org has to staff yet.
  const demandMap = Object.fromEntries(periods.map((p) => [p, { period: p, ...zeroByProfile(), total: 0 }]));
  const allocMap = Object.fromEntries(periods.map((p) => [p, { period: p, ...zeroByProfile(), total: 0 }]));
  const besoin = zeroByProfile(), alloc = zeroByProfile(), covered = zeroByProfile();
  let besoinDraftTotal = 0;
  let draftCount = 0, submittedCount = 0, releasePendingCount = 0;
  const projectStats = [];

  for (const proj of projects) {
    for (const a of proj.allocationLines) if (a.releaseRequested) releasePendingCount++;
    const cov = projectCoverage(proj, { weeks: horizon });
    if (!proj.demandSubmitted) {
      draftCount++;
      besoinDraftTotal += cov.demand.total;
      continue;
    }
    submittedCount++;
    for (const p of PROFILES) {
      besoin[p] += cov.demand[p];
      alloc[p] += cov.alloc[p];
      covered[p] += cov.covered[p];
    }
    for (const [w, row] of cov.byWeek.demand) if (demandMap[w]) for (const p of PROFILES) demandMap[w][p] = round1(demandMap[w][p] + row[p]);
    for (const [w, row] of cov.byWeek.alloc) if (allocMap[w]) for (const p of PROFILES) allocMap[w][p] = round1(allocMap[w][p] + row[p]);

    // Only projects with an actual upcoming demand count toward "top
    // projets en manque"; the gap is what's missing in the right weeks.
    if (cov.demand.total > 0.001) {
      projectStats.push({
        id: proj.id, name: proj.name, svo: proj.svo.name, status: proj.status,
        demand: round1(cov.demand.total), alloc: round1(cov.alloc.total), covered: round1(cov.covered.total),
        ecart: round1(cov.covered.total - cov.demand.total), couverture: coveragePct(cov.covered.total, cov.demand.total),
        weeks: cov.weeksCount,
      });
    }
  }
  for (const row of Object.values(demandMap)) row.total = round1(sum(Object.fromEntries(PROFILES.map((k) => [k, row[k]]))));
  for (const row of Object.values(allocMap)) row.total = round1(sum(Object.fromEntries(PROFILES.map((k) => [k, row[k]]))));

  // Capacity in the same unit and over the same horizon as demand
  // (FTE-weeks), so the three bars per profile are comparable.
  const cap = zeroByProfile(), capNow = zeroByProfile(), headcount = zeroByProfile();
  for (const m of resourceLoad.pool) {
    if (!(m.sousEquipe in cap)) continue;
    headcount[m.sousEquipe] += 1;
    capNow[m.sousEquipe] += resourceLoad.capacityGrid[m.id]?.[currentPeriod] || 0;
    for (const p of planningPeriods) cap[m.sousEquipe] += resourceLoad.capacityGrid[m.id]?.[p] || 0;
  }

  const besoinTotal = sum(besoin), allocTotal = sum(alloc), coveredTotal = sum(covered), capTotal = sum(cap);

  // Backlog: per-profile demand lines from submitted projects not yet fully
  // staffed (same rows as the "Demandes à affecter" queue).
  const queueRows = buildDemandQueueRows(projects.filter((p) => p.demandSubmitted));
  const backlogCount = queueRows.filter((r) => r.status !== "validated").length;

  // Pool right now: planned load against net capacity this week, people
  // with nothing planned who are actually present, and free FTE left.
  let loadNow = 0, capNowTotal = 0, availableCount = 0, freeNow = 0;
  for (const m of resourceLoad.pool) {
    const load = resourceLoad.overAllocGrid[m.id]?.[currentPeriod] || 0;
    const c = resourceLoad.capacityGrid[m.id]?.[currentPeriod] || 0;
    loadNow += load;
    capNowTotal += c;
    if (c > 0.001 && load < 0.001) availableCount++;
    freeNow += Math.max(0, c - load);
  }
  const poolUtilizationPct = capNowTotal > 0.001 ? round1((100 * loadNow) / capNowTotal) : 0;

  projectStats.sort((a, b) => a.ecart - b.ecart);
  const topProjects = projectStats.slice(0, 5);

  res.json({
    scope: "all",
    periods,
    currentPeriod,
    planningWeeks: planningPeriods.length,
    unit: "ETP-semaines",
    totals: {
      besoinTotal: round1(besoinTotal),
      besoinDraftTotal: round1(besoinDraftTotal),
      allocTotal: round1(allocTotal),
      coveredTotal: round1(coveredTotal),
      capTotal: round1(capTotal),
      ecartTotal: round1(coveredTotal - besoinTotal),
      couvertureTotal: coveragePct(coveredTotal, besoinTotal),
      chargeCapacitePct: capTotal > 0.001 ? round1((100 * besoinTotal) / capTotal) : null,
      headcount: sum(headcount),
      capNow: round1(sum(capNow)),
      freeNow: round1(freeNow),
      poolUtilizationPct,
      availableCount,
      backlogCount,
      releasePendingCount,
      draftCount,
      submittedCount,
      conflictCount: resourceLoad.conflictCount,
      timesheetGapCount: resourceLoad.timesheetGapCount,
    },
    bySquad: PROFILES.map((name) => ({
      name,
      besoin: round1(besoin[name]),
      alloue: round1(alloc[name]),
      couvert: round1(covered[name]),
      capacite: round1(cap[name]),
      capaciteSemaine: round1(capNow[name]),
      effectif: headcount[name],
      couverture: coveragePct(covered[name], besoin[name]),
      charge: cap[name] > 0.001 ? round1((100 * besoin[name]) / cap[name]) : null,
    })),
    demandByMonth: periods.map((p) => demandMap[p]),
    allocByPeriod: periods.map((p) => allocMap[p]),
    capacityByPeriod,
    topProjects,
    ...resourceLoad,
    projectsCount: projects.length,
  });
});

// SVO view: scoped to the projects they own — how well is MY expressed need
// covered, in the right weeks, not the whole org's pool/capacity picture.
async function buildOwnDashboard(user, periods, horizon) {
  const projects = await prisma.project.findMany({
    where: { svoUserId: user.id },
    include: { demandLines: true, allocationLines: { include: { poolMember: true } } },
  });

  const demandMap = Object.fromEntries(periods.map((p) => [p, { period: p, ...zeroByProfile() }]));
  const besoin = zeroByProfile(), alloc = zeroByProfile(), covered = zeroByProfile();
  let draftCount = 0, submittedCount = 0;

  const myProjects = projects.map((proj) => {
    if (!proj.demandSubmitted) draftCount++; else submittedCount++;
    const cov = projectCoverage(proj, { weeks: horizon });
    for (const p of PROFILES) {
      besoin[p] += cov.demand[p];
      alloc[p] += cov.alloc[p];
      covered[p] += cov.covered[p];
    }
    for (const [w, row] of cov.byWeek.demand) if (demandMap[w]) for (const p of PROFILES) demandMap[w][p] = round1(demandMap[w][p] + row[p]);
    return {
      id: proj.id, name: proj.name, status: proj.status, demandSubmitted: proj.demandSubmitted,
      demand: round1(cov.demand.total), alloc: round1(cov.alloc.total), covered: round1(cov.covered.total),
      ecart: round1(cov.covered.total - cov.demand.total), couverture: coveragePct(cov.covered.total, cov.demand.total),
      weeks: cov.weeksCount,
    };
  });

  const besoinTotal = sum(besoin), allocTotal = sum(alloc), coveredTotal = sum(covered);
  return {
    scope: "own",
    unit: "ETP-semaines",
    totals: {
      besoinTotal: round1(besoinTotal),
      allocTotal: round1(allocTotal),
      coveredTotal: round1(coveredTotal),
      ecartTotal: round1(coveredTotal - besoinTotal),
      couvertureTotal: coveragePct(coveredTotal, besoinTotal),
    },
    bySquad: PROFILES.map((name) => ({ name, besoin: round1(besoin[name]), alloue: round1(alloc[name]), couvert: round1(covered[name]), couverture: coveragePct(covered[name], besoin[name]) })),
    demandByMonth: periods.map((p) => demandMap[p]),
    projectsCount: projects.length,
    draftCount,
    submittedCount,
    myProjects,
  };
}

module.exports = router;
