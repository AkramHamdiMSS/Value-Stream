// Pulls worklogs from Tempo and aggregates them into LoggedTime, weekly per
// (resource, project) — the "réel" half of the plan/réel comparison.
//
// Usage: node scripts/sync-tempo-worklogs.js
// Requires TEMPO_API_TOKEN in backend/.env (see .env.example).
//
// Matching is explicit, not fuzzy: a worklog only lands somewhere if its
// Tempo author accountId is set on a PoolMember.jiraAccountId, and its
// issue's project key is set on a Project.jiraProjectKey — no name
// matching, which is exactly what broke the ASCII import ("Hamdi AKRAM" vs
// "Akram Hamdi"). Unmatched worklogs are reported, not guessed at.

require("dotenv").config();
const prisma = require("../src/lib/prisma");
const { fetchWorklogs } = require("../src/lib/tempo");
const { isoWeekId } = require("../src/lib/periods");

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

// Jira issue keys are always "<PROJECTKEY>-<number>" — the part before the
// last dash is the project key, no separate lookup needed.
function projectKeyFromIssueKey(issueKey) {
  const idx = issueKey.lastIndexOf("-");
  return idx === -1 ? issueKey : issueKey.slice(0, idx);
}

async function syncTempoWorklogs() {
  const from = new Date();
  from.setDate(from.getDate() - 8 * 7);
  const to = new Date();
  to.setDate(to.getDate() + 4 * 7);

  console.log(`Récupération des worklogs Tempo du ${dateStr(from)} au ${dateStr(to)}...`);
  const worklogs = await fetchWorklogs(dateStr(from), dateStr(to));
  console.log(`${worklogs.length} worklogs récupérés.`);

  const [members, projects] = await Promise.all([
    prisma.poolMember.findMany({ where: { jiraAccountId: { not: null } } }),
    prisma.project.findMany({ where: { jiraProjectKey: { not: null } } }),
  ]);
  const memberByAccountId = new Map(members.map((m) => [m.jiraAccountId, m]));
  const projectByKey = new Map(projects.map((p) => [p.jiraProjectKey, p]));

  // Aggregate seconds per (poolMemberId, projectId|null, period) before
  // touching the database — a person can log several worklogs the same week.
  const buckets = new Map();
  const unmatchedAccounts = new Set();
  const unmatchedProjects = new Set();

  for (const w of worklogs) {
    const member = memberByAccountId.get(w.author?.accountId);
    if (!member) {
      if (w.author?.accountId) unmatchedAccounts.add(w.author.accountId);
      continue;
    }
    const issueKey = w.issue?.key;
    const project = issueKey ? projectByKey.get(projectKeyFromIssueKey(issueKey)) : null;
    if (issueKey && !project) unmatchedProjects.add(projectKeyFromIssueKey(issueKey));

    const period = isoWeekId(new Date(w.startDate));
    const key = `${member.id}|${project?.id ?? ""}|${period}`;
    buckets.set(key, (buckets.get(key) || 0) + (Number(w.timeSpentSeconds) || 0));
  }

  let upserted = 0;
  for (const [key, seconds] of buckets) {
    const [poolMemberId, projectId, period] = key.split("|");
    const hours = Math.round((seconds / 3600) * 100) / 100;
    if (projectId) {
      // Prisma's compound-unique `where` rejects null for a field in the
      // key even though the column itself is nullable — only safe to use
      // the one-shot upsert when there IS a matched project.
      await prisma.loggedTime.upsert({
        where: { poolMemberId_projectId_period_source: { poolMemberId, projectId, period, source: "tempo" } },
        create: { poolMemberId, projectId, period, hours, source: "tempo" },
        update: { hours },
      });
    } else {
      const existing = await prisma.loggedTime.findFirst({ where: { poolMemberId, projectId: null, period, source: "tempo" } });
      if (existing) await prisma.loggedTime.update({ where: { id: existing.id }, data: { hours } });
      else await prisma.loggedTime.create({ data: { poolMemberId, projectId: null, period, hours, source: "tempo" } });
    }
    upserted++;
  }

  console.log(`\n${upserted} lignes agrégées enregistrées dans logged_time.`);
  if (unmatchedAccounts.size > 0) {
    console.log(`\n⚠ ${unmatchedAccounts.size} compte(s) Jira non rattaché(s) à une ressource (PoolMember.jiraAccountId) :`);
    unmatchedAccounts.forEach((id) => console.log(`  - ${id}`));
  }
  if (unmatchedProjects.size > 0) {
    console.log(`\n⚠ ${unmatchedProjects.size} clé(s) projet Jira non rattachée(s) à un projet (Project.jiraProjectKey) :`);
    unmatchedProjects.forEach((k) => console.log(`  - ${k}`));
  }

  return { total: worklogs.length, matched: upserted, unmatchedAccounts: unmatchedAccounts.size, unmatchedProjects: unmatchedProjects.size };
}

if (require.main === module) {
  syncTempoWorklogs()
    .then(() => console.log("\n✅ Synchro terminée."))
    .catch((e) => { console.error("❌ Erreur:", e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
}

module.exports = syncTempoWorklogs;
