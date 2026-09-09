const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { logActivity } = require("../lib/activity");

const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const pool = await prisma.poolMember.findMany({ orderBy: { name: "asc" } });
  res.json(pool);
});

router.use(requirePermission("managePool"));

const memberSchema = z.object({
  name: z.string().trim().min(1),
  squad: z.enum(["Mobile", "TPE", "Digital"]),
  sousEquipe: z.string().trim().min(1),
  roleTitle: z.string().trim().min(1),
});

router.post("/", async (req, res) => {
  const parsed = memberSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
  const member = await prisma.poolMember.create({
    data: {
      name: parsed.data.name ?? "Nouvelle personne",
      squad: parsed.data.squad ?? "Mobile",
      sousEquipe: parsed.data.sousEquipe ?? "Mobile",
      roleTitle: parsed.data.roleTitle ?? "Développeur",
    },
  });
  await logActivity({ user: req.user, action: `a ajouté ${member.name} au pool (${member.squad})` });
  res.status(201).json(member);
});

router.patch("/:id", async (req, res) => {
  const parsed = memberSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
  const before = await prisma.poolMember.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Personne introuvable." });
  const member = await prisma.poolMember.update({ where: { id: req.params.id }, data: parsed.data });

  let action = null;
  if ("name" in parsed.data) action = `a renommé ${before.name} en "${parsed.data.name}"`;
  else if ("squad" in parsed.data) action = `a changé le squad de ${before.name} en "${parsed.data.squad}"`;
  else if ("sousEquipe" in parsed.data) action = `a changé la sous-équipe de ${before.name} en "${parsed.data.sousEquipe}"`;
  else if ("roleTitle" in parsed.data) action = `a changé le rôle de ${before.name} en "${parsed.data.roleTitle}"`;
  if (action) await logActivity({ user: req.user, action });

  res.json(member);
});

router.delete("/:id", async (req, res) => {
  const member = await prisma.poolMember.findUnique({ where: { id: req.params.id } });
  if (!member) return res.status(404).json({ error: "Personne introuvable." });
  const allocCount = await prisma.allocationLine.count({ where: { poolMemberId: req.params.id } });
  if (allocCount > 0) {
    return res.status(409).json({ error: "Retirez d'abord ses affectations avant de supprimer cette personne du pool." });
  }
  await prisma.poolMember.delete({ where: { id: req.params.id } });
  await logActivity({ user: req.user, action: `a retiré ${member.name} du pool` });
  res.json({ ok: true });
});

module.exports = router;
