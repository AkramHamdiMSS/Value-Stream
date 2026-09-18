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

// GET unavailabilities is available for anyone (read-only)
router.get("/:id/unavailabilities", async (req, res) => {
  const unavailabilities = await prisma.unavailability.findMany({
    where: { poolMemberId: req.params.id },
    orderBy: { startDate: 'asc' }
  });
  res.json(unavailabilities);
});

// All other pool operations require managePool permission
router.use(requirePermission("managePool"));

const memberSchema = z.object({
  name: z.string().trim().min(1),
  email: z.union([z.string().trim().email(), z.literal("")]),
  squad: z.enum(["Mobile", "TPE", "Digital"]),
  sousEquipe: z.string().trim().min(1),
  roleTitle: z.string().trim().min(1),
  // Atlassian Cloud accountId — how a Tempo worklog's author is matched
  // back to this person (see scripts/sync-tempo-worklogs.js).
  jiraAccountId: z.union([z.string().trim(), z.literal("")]),
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
  const data = { ...parsed.data };
  if (data.email === "") data.email = null;
  if (data.jiraAccountId === "") data.jiraAccountId = null;
  const member = await prisma.poolMember.update({ where: { id: req.params.id }, data });

  let action = null;
  if ("name" in parsed.data) action = `a renommé ${before.name} en "${parsed.data.name}"`;
  else if ("squad" in parsed.data) action = `a changé le squad de ${before.name} en "${parsed.data.squad}"`;
  else if ("sousEquipe" in parsed.data) action = `a changé la sous-équipe de ${before.name} en "${parsed.data.sousEquipe}"`;
  else if ("roleTitle" in parsed.data) action = `a changé le rôle de ${before.name} en "${parsed.data.roleTitle}"`;
  else if ("email" in parsed.data) action = `a mis à jour l'email de ${before.name}`;
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

// Routes pour les indisponibilités (protégées)
const unavailabilitySchema = z.object({
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
  type: z.enum(["congé", "maladie", "formation", "autre"]),
  comment: z.string().optional()
});

router.post("/:id/unavailabilities", async (req, res) => {
  const parsed = unavailabilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
  
  const member = await prisma.poolMember.findUnique({ where: { id: req.params.id } });
  if (!member) return res.status(404).json({ error: "Personne introuvable." });

  const unavailability = await prisma.unavailability.create({
    data: {
      poolMemberId: req.params.id,
      ...parsed.data,
      source: "manual"
    }
  });

  await logActivity({ 
    user: req.user, 
    action: `a ajouté une indisponibilité pour ${member.name} (${parsed.data.type} du ${parsed.data.startDate.toLocaleDateString('fr-FR')} au ${parsed.data.endDate.toLocaleDateString('fr-FR')})` 
  });
  
  res.status(201).json(unavailability);
});

router.patch("/:id/unavailabilities/:unavailabilityId", async (req, res) => {
  const parsed = unavailabilitySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });

  const unavailability = await prisma.unavailability.findFirst({
    where: { id: req.params.unavailabilityId, poolMemberId: req.params.id }
  });
  
  if (!unavailability) return res.status(404).json({ error: "Indisponibilité introuvable." });

  const updated = await prisma.unavailability.update({
    where: { id: req.params.unavailabilityId },
    data: parsed.data
  });

  await logActivity({ 
    user: req.user, 
    action: `a modifié une indisponibilité (ID: ${req.params.unavailabilityId})` 
  });

  res.json(updated);
});

router.delete("/:id/unavailabilities/:unavailabilityId", async (req, res) => {
  const unavailability = await prisma.unavailability.findFirst({
    where: { id: req.params.unavailabilityId, poolMemberId: req.params.id }
  });
  
  if (!unavailability) return res.status(404).json({ error: "Indisponibilité introuvable." });

  await prisma.unavailability.delete({ where: { id: req.params.unavailabilityId } });

  await logActivity({ 
    user: req.user, 
    action: `a supprimé une indisponibilité (ID: ${req.params.unavailabilityId})` 
  });

  res.json({ ok: true });
});

module.exports = router;
