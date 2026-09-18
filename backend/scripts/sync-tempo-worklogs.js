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
const { fetchWorklogs, fetchWorklogsForProject } = require("../src/lib/tempo");
const { isoWeekId } = require("../src/lib/periods");

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function syncTempoWorklogs() {
  const from = new Date();
  from.setDate(from.getDate() - 8 * 7);
  const to = new Date();
  to.setDate(to.getDate() + 4 * 7);
  const fromStr = dateStr(from);
  const toStr = dateStr(to);

  console.log(`Récupération des worklogs Tempo du ${fromStr} au ${toStr}...`);
  const worklogs = await fetchWorklogs(fromStr, toStr);
  console.log(`${worklogs.length} worklogs récupérés.`);

  const [members, projects] = await Promise.all([
    prisma.poolMember.findMany({ where: { jiraAccountId: { not: null } } }),
    prisma.project.findMany({ where: { jiraProjectKey: { not: null } } }),
  ]);
  const memberByAccountId = new Map(members.map((m) => [m.jiraAccountId, m]));

  // Tempo API v4 dropped `issue.key` from worklog responses (only the
  // numeric `issue.id` remains), so a project can no longer be resolved
  // from the global fetch above. Instead, ask Tempo per mapped project
  // (GET /worklogs/project/{key}) — every worklog it returns is known to
  // belong to that project — and use that to tag the global worklogs by
  // their `tempoWorklogId`, so each worklog still only gets counted once.
  const worklogProjectId = new Map();
  for (const project of projects) {
    const projectWorklogs = await fetchWorklogsForProject(project.jiraProjectKey, fromStr, toStr);
    for (const w of projectWorklogs) worklogProjectId.set(w.tempoWorklogId, project.id);
  }

  // Aggregate seconds per (poolMemberId, projectId|null, period) before
  // touching the database — a person can log several worklogs the same week.
  const buckets = new Map();
  const unmatchedAccounts = new Set();

  for (const w of worklogs) {
    const member = memberByAccountId.get(w.author?.accountId);
    if (!member) {
      if (w.author?.accountId) unmatchedAccounts.add(w.author.accountId);
      continue;
    }
    const projectId = worklogProjectId.get(w.tempoWorklogId) ?? null;

    const period = isoWeekId(new Date(w.startDate));
    const key = `${member.id}|${projectId ?? ""}|${period}`;
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

  const withProject = worklogProjectId.size;
  console.log(`\n${upserted} lignes agrégées enregistrées dans logged_time.`);
  console.log(`${withProject} worklog(s) rattaché(s) à un projet mappé (sur ${projects.length} projet(s) avec une clé Jira).`);
  if (unmatchedAccounts.size > 0) {
    console.log(`\n⚠ ${unmatchedAccounts.size} compte(s) Jira non rattaché(s) à une ressource (PoolMember.jiraAccountId) :`);
    unmatchedAccounts.forEach((id) => console.log(`  - ${id}`));
  }

  return { total: worklogs.length, matched: upserted, unmatchedAccounts: unmatchedAccounts.size, worklogsWithProject: withProject };
}

if (require.main === module) {
  syncTempoWorklogs()
    .then(() => console.log("\n✅ Synchro terminée."))
    .catch((e) => { console.error("❌ Erreur:", e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
}

module.exports = syncTempoWorklogs;
