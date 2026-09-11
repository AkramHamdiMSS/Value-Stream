const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { logActivity } = require("../lib/activity");

const router = express.Router();
router.use(authenticate, requirePermission("manageAllocations"));

const patchSchema = z.object({
  period: z.string().trim().min(1).optional(),
  poolMemberId: z.string().uuid().optional(),
  pct: z.number().min(0).max(2).optional(),
});

router.patch("/:id", async (req, res) => {
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

router.delete("/:id", async (req, res) => {
  const line = await prisma.allocationLine.findUnique({ where: { id: req.params.id }, include: { project: true, poolMember: true } });
  if (!line) return res.status(404).json({ error: "Ligne introuvable." });
  await prisma.allocationLine.delete({ where: { id: req.params.id } });
  await logActivity({ user: req.user, action: `a retiré l'affectation de ${line.poolMember.name} (${line.period})`, project: line.project });
  res.json({ ok: true });
});

module.exports = router;
