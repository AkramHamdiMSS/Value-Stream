const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { effective, generatePeriods } = require("../lib/periods");

const router = express.Router();
router.use(authenticate);

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

function canViewAllProjects(user) {
  return hasPermission(user, "viewAllProjects") || hasPermission(user, "manageProjects") || hasPermission(user, "manageAllocations");
}

// Resource-load grid (who's on what, per week) — shared context every
// authenticated user sees regardless of scope, same as the original
// prototype's dashboard: knowing who's already loaded is useful context
// even for an SVO who can only act on their own projects.
async function buildResourceLoad(periods) {
  const [pool, allocationLines] = await Promise.all([
    prisma.poolMember.findMany(),
    prisma.allocationLine.findMany({
      select: { poolMemberId: true, period: true, pct: true, project: { select: { id: true, name: true } } },
    }),
  ]);

  const overAllocGrid = {};
  const overAllocProjects = {};
  for (const res of pool) overAllocGrid[res.id] = Object.fromEntries(periods.map((p) => [p, 0]));
  for (const l of allocationLines) {
    if (!overAllocGrid[l.poolMemberId] || !(l.period in overAllocGrid[l.poolMemberId])) continue;
    overAllocGrid[l.poolMemberId][l.period] += Number(l.pct) || 0;
    const key = `${l.poolMemberId}:${l.period}`;
    if (!overAllocProjects[key]) overAllocProjects[key] = [];
    overAllocProjects[key].push({ projectId: l.project.id, projectName: l.project.name, pct: round1(Number(l.pct) || 0) });
  }

  let alertCount = 0;
  for (const res of pool) {
    for (const p of periods) {
      if ((overAllocGrid[res.id]?.[p] || 0) > 1.001) alertCount++;
    }
  }

  return { pool: pool.map((p) => ({ id: p.id, name: p.name, squad: p.squad })), overAllocGrid, overAllocProjects, alertCount };
}

router.get("/", requirePermission("viewDashboard"), async (req, res) => {
  const periods = generatePeriods();
  const resourceLoad = await buildResourceLoad(periods);

  if (!canViewAllProjects(req.user)) {
    const own = await buildOwnDashboard(req.user, periods);
    return res.json({ ...own, ...resourceLoad, periods });
  }

  const [projects] = await Promise.all([
    prisma.project.findMany({ include: { demandLines: true } }),
  ]);

  const map = Object.fromEntries(periods.map((p) => [p, { period: p, Mobile: 0, TPE: 0, Digital: 0 }]));
  let besoinMobile = 0, besoinTpe = 0, besoinDigital = 0;
  for (const proj of projects) {
    for (const l of proj.demandLines) {
      const eff = effective(l.count, l.pct);
      if (l.profile === "Mobile") besoinMobile += eff;
      else if (l.profile === "TPE") besoinTpe += eff;
      else if (l.profile === "Digital") besoinDigital += eff;
      if (map[l.period]) map[l.period][l.profile] = round1(map[l.period][l.profile] + eff);
    }
  }
  const demandByMonth = periods.map((p) => map[p]);

  const capMobile = resourceLoad.pool.filter((p) => p.squad === "Mobile").length;
  const capTpe = resourceLoad.pool.filter((p) => p.squad === "TPE").length;
  const capDigital = resourceLoad.pool.filter((p) => p.squad === "Digital").length;

  res.json({
    scope: "all",
    periods,
    totals: {
      besoinMobile: round1(besoinMobile),
      besoinTpe: round1(besoinTpe),
      besoinDigital: round1(besoinDigital),
      besoinTotal: round1(besoinMobile + besoinTpe + besoinDigital),
      capMobile,
      capTpe,
      capDigital,
      capTotal: capMobile + capTpe + capDigital,
    },
    bySquad: [
      { name: "Mobile", besoin: round1(besoinMobile), capacite: capMobile },
      { name: "TPE", besoin: round1(besoinTpe), capacite: capTpe },
      { name: "Digital", besoin: round1(besoinDigital), capacite: capDigital },
    ],
    demandByMonth,
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

  const map = Object.fromEntries(periods.map((p) => [p, { period: p, Mobile: 0, TPE: 0, Digital: 0 }]));
  let besoinMobile = 0, besoinTpe = 0, besoinDigital = 0;
  let allocMobile = 0, allocTpe = 0, allocDigital = 0;
  let draftCount = 0, submittedCount = 0;

  const myProjects = projects.map((proj) => {
    if (!proj.demandSubmitted) draftCount++; else submittedCount++;

    let pDemand = { Mobile: 0, TPE: 0, Digital: 0 };
    for (const l of proj.demandLines) {
      const eff = effective(l.count, l.pct);
      pDemand[l.profile] += eff;
      if (l.profile === "Mobile") besoinMobile += eff;
      else if (l.profile === "TPE") besoinTpe += eff;
      else if (l.profile === "Digital") besoinDigital += eff;
      if (map[l.period]) map[l.period][l.profile] = round1(map[l.period][l.profile] + eff);
    }

    let pAlloc = { Mobile: 0, TPE: 0, Digital: 0 };
    for (const l of proj.allocationLines) {
      const pct = Number(l.pct) || 0;
      const squad = l.poolMember?.squad;
      if (!squad) continue;
      pAlloc[squad] += pct;
      if (squad === "Mobile") allocMobile += pct;
      else if (squad === "TPE") allocTpe += pct;
      else if (squad === "Digital") allocDigital += pct;
    }

    const demandTotal = pDemand.Mobile + pDemand.TPE + pDemand.Digital;
    const allocTotal = pAlloc.Mobile + pAlloc.TPE + pAlloc.Digital;
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

  const besoinTotal = besoinMobile + besoinTpe + besoinDigital;
  const allocTotal = allocMobile + allocTpe + allocDigital;

  return {
    scope: "own",
    totals: {
      besoinMobile: round1(besoinMobile),
      besoinTpe: round1(besoinTpe),
      besoinDigital: round1(besoinDigital),
      besoinTotal: round1(besoinTotal),
      allocMobile: round1(allocMobile),
      allocTpe: round1(allocTpe),
      allocDigital: round1(allocDigital),
      allocTotal: round1(allocTotal),
      ecartTotal: round1(allocTotal - besoinTotal),
    },
    bySquad: [
      { name: "Mobile", besoin: round1(besoinMobile), alloue: round1(allocMobile) },
      { name: "TPE", besoin: round1(besoinTpe), alloue: round1(allocTpe) },
      { name: "Digital", besoin: round1(besoinDigital), alloue: round1(allocDigital) },
    ],
    demandByMonth: periods.map((p) => map[p]),
    projectsCount: projects.length,
    draftCount,
    submittedCount,
    myProjects,
  };
}

module.exports = router;
