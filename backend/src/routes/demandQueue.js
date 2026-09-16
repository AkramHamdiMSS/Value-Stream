const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { buildDemandQueueRows } = require("../lib/demandQueueRows");
const { notifyTeamLeadsForSousEquipe, projectLink } = require("../lib/notify");
const { logActivity } = require("../lib/activity");

const router = express.Router();
router.use(authenticate);

function rangeLabel(row) {
  return row.periodStart === row.periodEnd ? row.periodStart : `${row.periodStart} → ${row.periodEnd}`;
}

router.get("/", async (req, res) => {
  const canViewAll = hasPermission(req.user, "viewDemandQueue") || hasPermission(req.user, "manageAllocations");
  const canPropose = hasPermission(req.user, "proposeAllocations");
  if (!canViewAll && !canPropose) return res.status(403).json({ error: "Accès refusé." });

  // A Team/Tech Lead without the full queue only sees demand for their own
  // sous-équipe (e.g. TPE Android, not all of TPE), wherever it comes from
  // in the org — not just projects they own.
  let sousEquipeFilter = null;
  if (!canViewAll && canPropose) {
    const self = await prisma.poolMember.findFirst({ where: { name: req.user.name } });
    sousEquipeFilter = self?.sousEquipe ?? null;
  }

  const projects = await prisma.project.findMany({
    where: { demandSubmitted: true },
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });

  const rows = buildDemandQueueRows(projects, sousEquipeFilter);
  rows.sort((a, b) => a.ecart - b.ecart);
  res.json(rows);
});

// Manual nudge to a profile's Team/Tech Lead(s) for a demand line they
// haven't acted on at all yet — only meaningful while status is
// "untreated" (nothing proposed, nothing approved); a proposed or
// validated line already has someone's attention.
router.post("/:key/remind", requirePermission("manageAllocations"), async (req, res) => {
  const [projectId, lineId, profile] = String(req.params.key).split(":");
  if (!projectId || !lineId || !profile) return res.status(400).json({ error: "Ligne de besoin introuvable." });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });
  if (!project) return res.status(404).json({ error: "Projet introuvable." });

  const row = buildDemandQueueRows([project]).find((r) => r.key === req.params.key);
  if (!row) return res.status(404).json({ error: "Ligne de besoin introuvable." });
  if (row.status !== "untreated") return res.status(400).json({ error: "Cette ligne a déjà été traitée." });

  const link = projectLink(project.id);
  const sentTo = await notifyTeamLeadsForSousEquipe(
    profile,
    `Rappel — besoin non affecté sur ${project.name}`,
    `Le besoin ${profile} pour "${project.name}" (${rangeLabel(row)}, ${row.demanded} pers.) n'est toujours pas affecté. Merci de proposer une ressource.`,
    link
  );

  await logActivity({
    user: req.user,
    action: `a envoyé un rappel ${profile} (${rangeLabel(row)}) — ${sentTo} destinataire(s)`,
    project,
  });

  res.json({ sentTo });
});

module.exports = router;
