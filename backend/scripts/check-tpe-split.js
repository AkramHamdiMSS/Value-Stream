// Read-only sanity check for the TPE Android / TPE Engage split
// (see migration 20260915090912_split_tpe_android_engage).
//
// Run from backend/ on the target machine:
//   node scripts/check-tpe-split.js
//
// Checks:
//   1. Every TPE pool member has a sous-équipe of exactly "TPE Android" or
//      "TPE Engage" — anything else means that person's allocations won't
//      be matched to any demand profile at all (silently invisible).
//   2. Every approved allocation line's resource has a sous-équipe among
//      the four known profiles (Mobile / TPE Android / TPE Engage /
//      Digital) — same failure mode as above, for any squad.
//   3. Demand lines left at 0 on all four profiles (should only be
//      unsubmitted drafts — flagged, not necessarily a problem).
//   4. Per-project, per-profile demandé vs alloué, so you can eyeball
//      whether the TPE Android/Engage split (especially on migrated demand
//      lines, where the old TPE total was copied into TPE Android with
//      Engage left at 0) still matches reality.

require("dotenv").config();
const prisma = require("../src/lib/prisma");
const { PROFILES, PROFILE_FIELDS } = require("../src/lib/profiles");
const { effective } = require("../src/lib/periods");

function line() {
  console.log("-".repeat(70));
}

async function main() {
  let issues = 0;

  console.log("1) TPE pool members — sous-équipe must be TPE Android or TPE Engage");
  line();
  const tpeMembers = await prisma.poolMember.findMany({ where: { squad: "TPE" }, orderBy: { name: "asc" } });
  for (const m of tpeMembers) {
    const ok = m.sousEquipe === "TPE Android" || m.sousEquipe === "TPE Engage";
    console.log(`${ok ? "  ok " : "  !! "}${m.name.padEnd(28)} sous_equipe="${m.sousEquipe}"`);
    if (!ok) issues++;
  }
  if (tpeMembers.length === 0) console.log("  (aucune ressource TPE dans le pool)");

  console.log("\n2) Allocations dont la ressource a une sous-équipe hors des 4 profils connus");
  line();
  const allocs = await prisma.allocationLine.findMany({ include: { poolMember: true, project: true } });
  let orphanCount = 0;
  for (const a of allocs) {
    if (!PROFILES.includes(a.poolMember?.sousEquipe)) {
      console.log(`  !! ${a.project.name} — ${a.poolMember?.name} (sous_equipe="${a.poolMember?.sousEquipe}", ligne ${a.periodStart}->${a.periodEnd})`);
      orphanCount++;
      issues++;
    }
  }
  if (orphanCount === 0) console.log("  ok — aucune.");

  console.log("\n3) Lignes de besoin à 0 sur les 4 profils (drafts non soumis attendus, sinon anomalie)");
  line();
  const demandLines = await prisma.demandLine.findMany({ include: { project: true } });
  let emptyCount = 0;
  for (const d of demandLines) {
    const allZero = PROFILE_FIELDS.every(({ countField }) => Number(d[countField]) <= 0);
    if (allZero) {
      const flag = d.project.demandSubmitted ? "!!" : "  ";
      console.log(`  ${flag} ${d.project.name} (${d.periodStart}->${d.periodEnd}) — soumise=${d.project.demandSubmitted}`);
      emptyCount++;
      if (d.project.demandSubmitted) issues++;
    }
  }
  if (emptyCount === 0) console.log("  ok — aucune.");

  console.log("\n4) Demandé vs alloué par profil, par projet (issu de la migration ou existant)");
  line();
  const projects = await prisma.project.findMany({
    include: { demandLines: true, allocationLines: { include: { poolMember: true } } },
  });
  for (const p of projects) {
    if (p.demandLines.length === 0) continue;
    const demand = Object.fromEntries(PROFILES.map((x) => [x, 0]));
    for (const d of p.demandLines) {
      for (const { profile, countField, pctField } of PROFILE_FIELDS) {
        demand[profile] += effective(d[countField], d[pctField]);
      }
    }
    const alloc = Object.fromEntries(PROFILES.map((x) => [x, 0]));
    for (const a of p.allocationLines) {
      if (a.status !== "approved") continue;
      const key = a.poolMember?.sousEquipe;
      if (key in alloc) alloc[key] += Number(a.pct) || 0;
    }
    const nonZero = PROFILES.filter((x) => demand[x] > 0 || alloc[x] > 0);
    if (nonZero.length === 0) continue;
    console.log(`  ${p.name}${p.demandSubmitted ? "" : " (brouillon)"}`);
    for (const prof of nonZero) {
      const gap = alloc[prof] - demand[prof];
      console.log(`    ${prof.padEnd(12)} demandé=${demand[prof].toFixed(2)}  alloué=${alloc[prof].toFixed(2)}  écart=${gap.toFixed(2)}`);
    }
  }

  line();
  console.log(issues === 0 ? "Aucun problème détecté." : `${issues} problème(s) détecté(s) — voir "!!" ci-dessus.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
