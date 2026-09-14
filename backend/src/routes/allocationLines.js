const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { logActivity } = require("../lib/activity");
const { notifyHSV, notifyUser, notifyPoolMember, notifyTeamLeadsForSousEquipe } = require("../lib/notify");

const router = express.Router();
router.use(authenticate);

const patchSchema = z.object({
  period: z.string().trim().min(1).optional(),
  poolMemberId: z.string().uuid().optional(),
  pct: z.number().min(0).max(2).optional(),
});

// Editing a line: HSV/manageAllocations can touch anything (and confirms it,
// so a pending proposal doesn't stay stuck once someone with real authority
// has touched it). A proposeAllocations-only holder can only edit their own
// still-pending proposal — status stays pending, and any resource change is
// still restricted to their own sous-équipe.
router.patch("/:id", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ligne invalide." });
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true, createdBy: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });

  const canManage = hasPermission(req.user, "manageAllocations");
  const isOwnPendingProposal = line.status === "pending" && line.createdById === req.user.id && hasPermission(req.user, "proposeAllocations");
  if (!canManage && !isOwnPendingProposal) return res.status(403).json({ error: "Accès refusé." });

  if (!canManage && parsed.data.poolMemberId) {
    const [self, target] = await Promise.all([
      prisma.poolMember.findFirst({ where: { name: req.user.name } }),
      prisma.poolMember.findUnique({ where: { id: parsed.data.poolMemberId } }),
    ]);
    if (!self || !target || target.sousEquipe !== self.sousEquipe) {
      return res.status(403).json({ error: "Vous ne pouvez proposer que des ressources de votre propre équipe." });
    }
  }

  const updated = await prisma.allocationLine.update({
    where: { id: req.params.id },
    data: { ...parsed.data, ...(canManage ? { status: "approved" } : {}) },
    include: { poolMember: true },
  });
  await logActivity({
    user: req.user,
    action: canManage
      ? `a modifié l'affectation de ${line.poolMember.name} (${line.period})`
      : `a modifié sa proposition pour ${line.poolMember.name} (${line.period})`,
    project: line.project,
  });

  if (canManage && line.status === "pending") {
    await notifyApproval({ line, project: line.project, approver: req.user });
  }

  res.json(updated);
});

// Shared by /approve and a direct HSV edit of a pending line (which also
// confirms it) — the proposer learns their proposal went through, and the
// resource learns they're now really on the project.
async function notifyApproval({ line, project, approver }) {
  await notifyUser(
    line.createdBy,
    `Proposition validée — ${project.name}`,
    `${approver.name} a validé votre proposition d'affectation de ${line.poolMember.name} sur "${project.name}" (${line.period}).`
  );
  await notifyPoolMember(
    line.poolMember,
    `Affectation confirmée — ${project.name}`,
    `Votre affectation au projet "${project.name}" pour la période ${line.period} est confirmée.`
  );
  await notifyHSV(
    `[Journal] Affectation validée — ${project.name}`,
    `${approver.name} a validé l'affectation de ${line.poolMember.name} sur "${project.name}" (${line.period}).`
  );
}

// Validates a Team/Tech Lead's proposal.
router.post("/:id/approve", requirePermission("manageAllocations"), async (req, res) => {
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true, createdBy: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });
  const updated = await prisma.allocationLine.update({ where: { id: req.params.id }, data: { status: "approved" }, include: { poolMember: true } });
  await logActivity({ user: req.user, action: `a validé l'affectation de ${line.poolMember.name} (${line.period})`, project: line.project });
  await notifyApproval({ line, project: line.project, approver: req.user });
  res.json(updated);
});

// Removing a line: manageAllocations can remove anything (this doubles as
// "reject a proposal"); a proposeAllocations-only holder can only retract
// their own still-pending proposal.
router.delete("/:id", async (req, res) => {
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true, createdBy: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });

  const canManage = hasPermission(req.user, "manageAllocations");
  const isOwnPendingProposal = line.status === "pending" && line.createdById === req.user.id && hasPermission(req.user, "proposeAllocations");
  if (!canManage && !isOwnPendingProposal) return res.status(403).json({ error: "Accès refusé." });

  await prisma.allocationLine.delete({ where: { id: req.params.id } });
  await logActivity({
    user: req.user,
    action: canManage && line.status === "pending"
      ? `a rejeté la proposition de ${line.poolMember.name} (${line.period})`
      : `a retiré l'affectation de ${line.poolMember.name} (${line.period})`,
    project: line.project,
  });

  if (canManage && line.status === "pending") {
    await notifyUser(
      line.createdBy,
      `Proposition refusée — ${line.project.name}`,
      `${req.user.name} a refusé votre proposition d'affectation de ${line.poolMember.name} sur "${line.project.name}" (${line.period}).`
    );
    await notifyHSV(
      `[Journal] Proposition refusée — ${line.project.name}`,
      `${req.user.name} a refusé la proposition de ${line.createdBy.name} pour ${line.poolMember.name} sur "${line.project.name}" (${line.period}).`
    );
  } else if (canManage && line.status === "approved") {
    await notifyPoolMember(
      line.poolMember,
      `Retrait d'affectation — ${line.project.name}`,
      `${req.user.name} vous a retiré du projet "${line.project.name}" (${line.period}).`
    );
    await notifyHSV(
      `[Journal] Affectation retirée — ${line.project.name}`,
      `${req.user.name} a retiré ${line.poolMember.name} du projet "${line.project.name}" (${line.period}).`
    );
  }

  res.json({ ok: true });
});

// SVO releases a resource on their own project: flags the (still real, still
// counted) line for review instead of removing it outright, so the HSV sees
// and confirms it rather than capacity silently disappearing.
router.post("/:id/request-release", async (req, res) => {
  const schema = z.object({ note: z.string().trim().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Merci de décrire la raison / réallocation prévue." });

  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });
  if (line.project.svoUserId !== req.user.id) return res.status(403).json({ error: "Seul le SVO du projet peut demander la libération." });
  if (line.status !== "approved") return res.status(409).json({ error: "Seules les affectations confirmées peuvent être libérées." });
  if (line.releaseRequested) return res.status(409).json({ error: "Une libération est déjà demandée pour cette ligne." });

  const updated = await prisma.allocationLine.update({
    where: { id: req.params.id },
    data: { releaseRequested: true, releaseNote: parsed.data.note },
    include: { poolMember: true },
  });
  await logActivity({
    user: req.user,
    action: `a demandé la libération de ${line.poolMember.name} (${line.period}) — ${parsed.data.note}`,
    project: line.project,
  });
  await notifyHSV(
    `Demande de libération — ${line.project.name}`,
    `${req.user.name} demande la libération de ${line.poolMember.name} sur "${line.project.name}" (${line.period}) — ${parsed.data.note}`
  );
  res.json(updated);
});

// Withdrawing a request: the requesting SVO retracts it, or the HSV declines it.
router.post("/:id/cancel-release", async (req, res) => {
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });
  const isOwner = line.project.svoUserId === req.user.id;
  const canManage = hasPermission(req.user, "manageAllocations");
  if (!isOwner && !canManage) return res.status(403).json({ error: "Accès refusé." });
  if (!line.releaseRequested) return res.status(409).json({ error: "Aucune libération en attente pour cette ligne." });

  const updated = await prisma.allocationLine.update({
    where: { id: req.params.id },
    data: { releaseRequested: false, releaseNote: null },
    include: { poolMember: true },
  });
  await logActivity({
    user: req.user,
    action: isOwner && !canManage
      ? `a annulé sa demande de libération de ${line.poolMember.name} (${line.period})`
      : `a refusé la libération de ${line.poolMember.name} (${line.period})`,
    project: line.project,
  });
  if (canManage) {
    const svo = await prisma.user.findUnique({ where: { id: line.project.svoUserId } });
    await notifyUser(
      svo,
      `Libération refusée — ${line.project.name}`,
      `${req.user.name} a refusé votre demande de libération de ${line.poolMember.name} sur "${line.project.name}" (${line.period}).`
    );
    await notifyHSV(
      `[Journal] Libération refusée — ${line.project.name}`,
      `${req.user.name} a refusé la libération de ${line.poolMember.name} sur "${line.project.name}" (${line.period}).`
    );
  }
  res.json(updated);
});

// HSV confirms: the resource is actually freed — the line is removed.
router.post("/:id/confirm-release", requirePermission("manageAllocations"), async (req, res) => {
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });
  if (!line.releaseRequested) return res.status(409).json({ error: "Aucune libération en attente pour cette ligne." });

  await prisma.allocationLine.delete({ where: { id: req.params.id } });
  await logActivity({
    user: req.user,
    action: `a validé la libération de ${line.poolMember.name} (${line.period}) — ${line.releaseNote}`,
    project: line.project,
  });

  const svo = await prisma.user.findUnique({ where: { id: line.project.svoUserId } });
  await notifyUser(
    svo,
    `Libération confirmée — ${line.project.name}`,
    `${req.user.name} a confirmé la libération de ${line.poolMember.name} sur "${line.project.name}" (${line.period}) — la ressource est de nouveau disponible.`
  );
  await notifyPoolMember(
    line.poolMember,
    `Libération confirmée — ${line.project.name}`,
    `Votre affectation au projet "${line.project.name}" (${line.period}) a pris fin — vous êtes de nouveau disponible.`
  );
  await notifyTeamLeadsForSousEquipe(
    line.poolMember.sousEquipe,
    `Libération d'équipe — ${line.project.name}`,
    `${line.poolMember.name} est libéré(e) du projet "${line.project.name}" (${line.period}) et redevient disponible.`
  );
  await notifyHSV(
    `[Journal] Libération confirmée — ${line.project.name}`,
    `${req.user.name} a confirmé la libération de ${line.poolMember.name} sur "${line.project.name}" (${line.period}).`
  );

  res.json({ ok: true });
});

module.exports = router;
