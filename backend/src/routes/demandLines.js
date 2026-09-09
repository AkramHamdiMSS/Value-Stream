const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middleware/auth");
const { logActivity } = require("../lib/activity");

const router = express.Router();
router.use(authenticate);

async function loadEditableLineOr404(req, res) {
  const line = await prisma.demandLine.findUnique({ where: { id: req.params.id }, include: { project: true } });
  if (!line) {
    res.status(404).json({ error: "Ligne introuvable." });
    return null;
  }
  const isOwner = req.user.role === "svo" && line.project.svoUserId === req.user.id;
  if (!isOwner) {
    res.status(403).json({ error: "Seul le SVO du projet peut éditer le besoin." });
    return null;
  }
  if (line.project.demandSubmitted) {
    res.status(409).json({ error: "La demande est soumise — rouvrez-la pour modifier." });
    return null;
  }
  return line;
}

const patchSchema = z.object({
  period: z.string().trim().min(1).optional(),
  profile: z.enum(["Mobile", "TPE", "Digital"]).optional(),
  count: z.number().nonnegative().optional(),
  pct: z.number().min(0).max(2).nullable().optional(),
});

router.patch("/:id", async (req, res) => {
  const line = await loadEditableLineOr404(req, res);
  if (!line) return;
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ligne invalide." });
  const updated = await prisma.demandLine.update({ where: { id: line.id }, data: parsed.data });
  await logActivity({ user: req.user, action: `a modifié le besoin ${line.profile} (${line.period})`, project: line.project });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const line = await loadEditableLineOr404(req, res);
  if (!line) return;
  await prisma.demandLine.delete({ where: { id: line.id } });
  await logActivity({ user: req.user, action: `a supprimé le besoin ${line.profile} (${line.period})`, project: line.project });
  res.json({ ok: true });
});

module.exports = router;
