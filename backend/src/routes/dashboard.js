const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { effective, generatePeriods, generatePeriodDates, inRange, dateRangeOverlapsWeek } = require("../lib/periods");
const { PROFILES, PROFILE_FIELDS } = require("../lib/profiles");
const { buildDemandQueueRows } = require("../lib/demandQueueRows");

const router = express.Router();
router.use(authenticate);

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}
function zeroByProfile() {
  return Object.fromEntries(PROFILES.map((p) => [p, 0]));
}

function canViewAllProjects(user) {
  return hasPermission(user, "viewAllProjects") || hasPermission(user, "manageProjects") || hasPermission(user, "manageAllocations");
}

// Resource-load grid (who's on what, per week) — shared context every
// authenticated user sees regardless of scope, same as the original
// prototype's dashboard: knowing who's already loaded is useful context
// even for an SVO who can only act on their own projects. A Team/Tech Lead
// (viewDashboard and nothing else) only gets their own sous-équipe, not the
// whole org — see sousEquipeFilter below.
async function buildResourceLoad(periods, sousEquipeFilter) {
  const [allMembers, allocationLines, unavailabilities] = await Promise.all([
    prisma.poolMember.findMany(),
    prisma.allocationLine.findMany({
      where: { status: "approved" },
      select: { poolMemberId: true, periodStart: true, periodEnd: true, pct: true, project: { select: { id: true, name: true } } },
    }),
    prisma.unavailability.findMany({
      select: { poolMemberId: true, startDate: true, endDate: true, type: true }
    }),
  ]);
  const pool = sousEquipeFilter ? allMembers.filter((m) => m.sousEquipe === sousEquipeFilter) : allMembers;

  const overAllocGrid = {};
  const overAllocProjects = {};
  const unavailableMembers = {}; // Track unavailability by member and period

  for (const res of pool) overAllocGrid[res.id] = Object.fromEntries(periods.map((p) => [p, 0]));

  // `periods` is just id strings — pair each one back up with its actual
  // Monday date (via the same walk generatePeriods() itself uses) so a
  // multi-week leave can be tested for overlap, not just whether its start
  // or end date happens to land inside a given week.
  const periodDates = generatePeriodDates(periods.length).filter((pd) => periods.includes(pd.id));
  for (const u of unavailabilities) {
    if (!overAllocGrid[u.poolMemberId]) continue;
    for (const { id: p, monday } of periodDates) {
      if (!dateRangeOverlapsWeek(u.startDate, u.endDate, monday)) continue;
      if (!unavailableMembers[u.poolMemberId]) unavailableMembers[u.poolMemberId] = {};
      if (!unavailableMembers[u.poolMemberId][p]) unavailableMembers[u.poolMemberId][p] = [];
      unavailableMembers[u.poolMemberId][p].push(u.type);
    }
  }
  
  for (const l of allocationLines) {
    if (!overAllocGrid[l.poolMemberId]) continue;
    for (const p of periods) {
      if (!inRange(p, l.periodStart, l.periodEnd)) continue;
      overAllocGrid[l.poolMemberId][p] += Number(l.pct) || 0;
      const key = `${l.poolMemberId}:${p}`;
      if (!overAllocProjects[key]) overAllocProjects[key] = [];
      overAllocProjects[key].push({ projectId: l.project.id, projectName: l.project.name, pct: round1(Number(l.pct) || 0) });
    }
  }

  // A resource staffed on a project during a week they're also marked
  // unavailable (congé/maladie/...) is a real scheduling conflict — the
  // allocation exists but the person won't actually be there.
  let alertCount = 0;
  let conflictCount = 0;
  for (const res of pool) {
    for (const p of periods) {
      const load = overAllocGrid[res.id]?.[p] || 0;
      if (load > 1.001) alertCount++;
      if (load > 0.001 && unavailableMembers[res.id]?.[p]) conflictCount++;
    }
  }

  return {
    pool: pool.map((p) => ({ id: p.id, name: p.name, squad: p.squad, sousEquipe: p.sousEquipe })),
    overAllocGrid,
    overAllocProjects,
    unavailableMembers,
    alertCount,
    conflictCount,
  };
}

router.get("/", requirePermission("viewDashboard"), async (req, res) => {
  const periods = generatePeriods();

  // Same "minimal dashboard" cohort the frontend restricts to the grid-only
  // view: viewDashboard granted but no org-wide oversight permission.
  // proposeAllocations (or any other non-oversight permission) doesn't pull
  // them out of this — only the broader ones do.
  const isMinimal = req.user.role !== "hsv" && !canViewAllProjects(req.user);
  let sousEquipeFilter = null;
  if (isMinimal) {
    const self = await prisma.poolMember.findFirst({ where: { name: req.user.name } });
    if (self) sousEquipeFilter = self.sousEquipe;
  }
  const resourceLoad = await buildResourceLoad(periods, sousEquipeFilter);

  if (!canViewAllProjects(req.user)) {
    const own = await buildOwnDashboard(req.user, periods);
    return res.json({ ...own, ...resourceLoad, periods });
  }

  const projects = await prisma.project.findMany({
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });

  const map = Object.fromEntries(periods.map((p) => [p, { period: p, ...zeroByProfile() }]));
  const besoin = zeroByProfile();
  const alloc = zeroByProfile();
  let draftCount = 0, submittedCount = 0;
  let releasePendingCount = 0;
  const projectStats = [];

  for (const proj of projects) {
    if (proj.demandSubmitted) submittedCount++; else draftCount++;

    const pDemand = zeroByProfile();
    for (const l of proj.demandLines) {
      for (const { profile, countField, pctField } of PROFILE_FIELDS) {
        const eff = effective(l[countField], l[pctField]);
        besoin[profile] += eff;
        pDemand[profile] += eff;
        for (const p of periods) {
          if (inRange(p, l.periodStart, l.periodEnd)) map[p][profile] = round1(map[p][profile] + eff);
        }
      }
    }

    const pAlloc = zeroByProfile();
    for (const a of proj.allocationLines) {
      if (a.releaseRequested) releasePendingCount++;
      if (a.status !== "approved") continue;
      const key = a.poolMember?.sousEquipe;
      const pct = Number(a.pct) || 0;
      if (key in alloc) alloc[key] += pct;
      if (key in pAlloc) pAlloc[key] += pct;
    }

    // Only submitted projects with an actual demand count toward "top
    // projets en manque" — a draft, or a submitted line with nothing
    // requested yet, has no gap worth surfacing.
    const demandTotal = Object.values(pDemand).reduce((a, b) => a + b, 0);
    if (proj.demandSubmitted && demandTotal > 0.001) {
      const allocTotal = Object.values(pAlloc).reduce((a, b) => a + b, 0);
      projectStats.push({
        id: proj.id, name: proj.name, svo: proj.svo.name, status: proj.status,
        demand: round1(demandTotal), alloc: round1(allocTotal), ecart: round1(allocTotal - demandTotal),
      });
    }
  }
  const demandByMonth = periods.map((p) => map[p]);

  const cap = zeroByProfile();
  for (const p of resourceLoad.pool) {
    if (p.sousEquipe in cap) cap[p.sousEquipe] += 1;
  }
  const besoinTotal = Object.values(besoin).reduce((a, b) => a + b, 0);
  const allocTotal = Object.values(alloc).reduce((a, b) => a + b, 0);
  const capTotal = Object.values(cap).reduce((a, b) => a + b, 0);
  const couvertureTotal = besoinTotal > 0.001 ? round1((100 * allocTotal) / besoinTotal) : null;

  // Backlog: per-profile demand lines from submitted projects that an admin
  // hasn't validated yet (same untreated/proposed statuses as the "Demandes
  // à affecter" queue, computed the same way so the two numbers never drift).
  const queueRows = buildDemandQueueRows(projects.filter((p) => p.demandSubmitted));
  const backlogCount = queueRows.filter((r) => r.status !== "validated").length;

  // Pool utilization right now (periods[0] is always the current week): sum
  // of every resource's current load against the pool's theoretical
  // 100%-each capacity, plus how many are sitting completely idle.
  const currentPeriod = periods[0];
  let loadSum = 0, availableCount = 0;
  for (const p of resourceLoad.pool) {
    const load = resourceLoad.overAllocGrid[p.id]?.[currentPeriod] || 0;
    loadSum += load;
    if (load < 0.001) availableCount++;
  }
  const poolUtilizationPct = resourceLoad.pool.length > 0 ? round1((100 * loadSum) / resourceLoad.pool.length) : 0;

  projectStats.sort((a, b) => a.ecart - b.ecart);
  const topProjects = projectStats.slice(0, 5);

  res.json({
    scope: "all",
    periods,
    totals: {
      besoinTotal: round1(besoinTotal),
      allocTotal: round1(allocTotal),
      capTotal,
      ecartTotal: round1(allocTotal - besoinTotal),
      couvertureTotal,
      poolUtilizationPct,
      availableCount,
      backlogCount,
      releasePendingCount,
      draftCount,
      submittedCount,
      conflictCount: resourceLoad.conflictCount,
    },
    bySquad: PROFILES.map((name) => {
      const b = besoin[name], a = alloc[name];
      return {
        name, besoin: round1(b), capacite: cap[name], alloue: round1(a),
        couverture: b > 0.001 ? round1((100 * a) / b) : null,
      };
    }),
    demandByMonth,
    topProjects,
    ...resourceLoad,
    projectsCount: projects.length,
  });
});

// SVO view: scoped to the projects they own — how well is MY expressed need
// covered, not the whole org's pool/capacity picture (which they can't act on).
// The shared resource-load grid (see buildResourceLoad) is merged in on top.
async function buildOwnDashboard(user, periods) {
  const projects = await prisma.project.findMany({
    where: { svoUserId: user.id },
    include: { demandLines: true, allocationLines: { include: { poolMember: true } } },
  });

  const map = Object.fromEntries(periods.map((p) => [p, { period: p, ...zeroByProfile() }]));
  const besoin = zeroByProfile();
  const alloc = zeroByProfile();
  let draftCount = 0, submittedCount = 0;

  const myProjects = projects.map((proj) => {
    if (!proj.demandSubmitted) draftCount++; else submittedCount++;

    const pDemand = zeroByProfile();
    for (const l of proj.demandLines) {
      for (const { profile, countField, pctField } of PROFILE_FIELDS) {
        const eff = effective(l[countField], l[pctField]);
        pDemand[profile] += eff;
        besoin[profile] += eff;
        for (const p of periods) {
          if (inRange(p, l.periodStart, l.periodEnd)) map[p][profile] = round1(map[p][profile] + eff);
        }
      }
    }

    const pAlloc = zeroByProfile();
    for (const l of proj.allocationLines) {
      if (l.status !== "approved") continue;
      const pct = Number(l.pct) || 0;
      const key = l.poolMember?.sousEquipe;
      if (!(key in pAlloc)) continue;
      pAlloc[key] += pct;
      alloc[key] += pct;
    }

    const demandTotal = Object.values(pDemand).reduce((a, b) => a + b, 0);
    const allocTotal = Object.values(pAlloc).reduce((a, b) => a + b, 0);
    return {
      id: proj.id,
      name: proj.name,
      status: proj.status,
      demandSubmitted: proj.demandSubmitted,
      demand: round1(demandTotal),
      alloc: round1(allocTotal),
      ecart: round1(allocTotal - demandTotal),
    };
  });

  const besoinTotal = Object.values(besoin).reduce((a, b) => a + b, 0);
  const allocTotal = Object.values(alloc).reduce((a, b) => a + b, 0);

  return {
    scope: "own",
    totals: {
      besoinTotal: round1(besoinTotal),
      allocTotal: round1(allocTotal),
      ecartTotal: round1(allocTotal - besoinTotal),
    },
    bySquad: PROFILES.map((name) => ({ name, besoin: round1(besoin[name]), alloue: round1(alloc[name]) })),
    demandByMonth: periods.map((p) => map[p]),
    projectsCount: projects.length,
    draftCount,
    submittedCount,
    myProjects,
  };
}

module.exports = router;
