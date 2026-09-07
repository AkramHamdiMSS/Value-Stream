const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const pool = await prisma.poolMember.findMany({ orderBy: { name: "asc" } });
  res.json(pool);
});

router.use(requireRole("hsv"));

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
  res.status(201).json(member);
});

router.patch("/:id", async (req, res) => {
  const parsed = memberSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
  const member = await prisma.poolMember.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(member);
});

router.delete("/:id", async (req, res) => {
  const allocCount = await prisma.allocationLine.count({ where: { poolMemberId: req.params.id } });
  if (allocCount > 0) {
    return res.status(409).json({ error: "Retirez d'abord ses affectations avant de supprimer cette personne du pool." });
  }
  await prisma.poolMember.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
