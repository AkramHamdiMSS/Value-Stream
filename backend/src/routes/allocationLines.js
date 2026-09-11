const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { logActivity } = require("../lib/activity");

const router = express.Router();
router.use(authenticate);

const patchSchema = z.object({
  period: z.string().trim().min(1).optional(),
  poolMemberId: z.string().uuid().optional(),
  pct: z.number().min(0).max(2).optional(),
});

router.patch("/:id", requirePermission("manageAllocations"), async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ligne invalide." });
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });
  const updated = await prisma.allocationLine.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { poolMember: true },
  });
  await logActivity({ user: req.user, action: `a modifié l'affectation de ${line.poolMember.name} (${line.period})`, project: line.project });
  res.json(updated);
});

router.delete("/:id", requirePermission("manageAllocations"), async (req, res) => {
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });
  await prisma.allocationLine.delete({ where: { id: req.params.id } });
  await logActivity({ user: req.user, action: `a retiré l'affectation de ${line.poolMember.name} (${line.period})`, project: line.project });
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
  res.json({ ok: true });
});

module.exports = router;
