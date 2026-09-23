// Copies the Jira Account ID mapping (PoolMember.jiraAccountId) from one
// database to another (typically local dev -> deployed machine), matched by
// name with the same tolerant matcher as the ASCII import (order, accents,
// spelling, glued surnames).
//
// Two steps:
//   1. On the source machine (local):   node scripts/sync-jira-account-ids.js export > scripts/jira-ids.json  (committed)
//   2. On the target machine (remote):  git pull && npm run jira:import   (or ... import scripts/jira-ids.json [--dry-run] [--force])
//
// Each step uses the DATABASE_URL of the machine it runs on (backend/.env).
// Import never overwrites an existing, different ID unless --force is given.
require("dotenv").config();
const fs = require("fs");
const prisma = require("../src/lib/prisma");
const { findBestMatch } = require("../src/lib/nameMatcher");

async function exportIds() {
  const members = await prisma.poolMember.findMany({
    where: { jiraAccountId: { not: null } },
    select: { name: true, email: true, jiraAccountId: true },
    orderBy: { name: "asc" },
  });
  process.stdout.write(JSON.stringify(members, null, 2) + "\n");
  console.error(`${members.length} ressources exportées.`);
}

async function importIds(file, { dryRun, force }) {
  const source = JSON.parse(fs.readFileSync(file, "utf8"));
  const targets = await prisma.poolMember.findMany({ select: { id: true, name: true, email: true, jiraAccountId: true } });
  const taken = new Set();
  let updated = 0, unchanged = 0, kept = 0;
  const unmatched = [];

  for (const src of source) {
    const { member, score } = findBestMatch(src.name, targets.filter((t) => !taken.has(t.id)));
    if (!member) { unmatched.push(src.name); continue; }
    taken.add(member.id);
    const label = member.name === src.name ? src.name : `${src.name} -> ${member.name} (${score}%)`;
    if (member.jiraAccountId === src.jiraAccountId) { unchanged++; continue; }
    if (member.jiraAccountId && !force) {
      kept++;
      console.log(`GARDÉ   ${label} : ID distant différent déjà renseigné (utiliser --force pour écraser)`);
      continue;
    }
    console.log(`${dryRun ? "SIMULÉ " : "MAJ    "} ${label} : ${member.jiraAccountId || "(vide)"} -> ${src.jiraAccountId}`);
    if (!dryRun) await prisma.poolMember.update({ where: { id: member.id }, data: { jiraAccountId: src.jiraAccountId } });
    updated++;
  }

  console.log(`\n${updated} mise(s) à jour${dryRun ? " (simulation, rien écrit)" : ""}, ${unchanged} déjà à jour, ${kept} conservée(s).`);
  if (unmatched.length) console.log("Non trouvées dans le Pool distant (nom trop différent ou absent) :", unmatched);
}

async function main() {
  const [cmd, file, ...flags] = process.argv.slice(2);
  if (cmd === "export") return exportIds();
  if (cmd === "import" && file) return importIds(file, { dryRun: flags.includes("--dry-run"), force: flags.includes("--force") });
  console.error("Usage:\n  node scripts/sync-jira-account-ids.js export > jira-ids.json\n  node scripts/sync-jira-account-ids.js import jira-ids.json [--dry-run] [--force]");
  process.exit(2);
}

main()
  .catch((e) => { console.error("Erreur:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
