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

// Editing a line — HSV/manageAllocations only — also confirms it, so a
// pending proposal doesn't stay stuck pending once someone with real
// authority has already touched it.
router.patch("/:id", requirePermission("manageAllocations"), async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ligne invalide." });
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });
  const updated = await prisma.allocationLine.update({
    where: { id: req.params.id },
    data: { ...parsed.data, status: "approved" },
    include: { poolMember: true },
  });
  await logActivity({ user: req.user, action: `a modifié l'affectation de ${line.poolMember.name} (${line.period})`, project: line.project });
  res.json(updated);
});

// Validates a Team/Tech Lead's proposal.
router.post("/:id/approve", requirePermission("manageAllocations"), async (req, res) => {
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });
  const updated = await prisma.allocationLine.update({ where: { id: req.params.id }, data: { status: "approved" }, include: { poolMember: true } });
  await logActivity({ user: req.user, action: `a validé l'affectation de ${line.poolMember.name} (${line.period})`, project: line.project });
  res.json(updated);
});

// Removing a line: manageAllocations can remove anything (this doubles as
// "reject a proposal"); a proposeAllocations-only holder can only retract
// their own still-pending proposal.
router.delete("/:id", async (req, res) => {
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true } });
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
  res.json({ ok: true });
});

module.exports = router;
