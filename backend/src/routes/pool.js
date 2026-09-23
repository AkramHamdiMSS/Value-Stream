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
  // Contractual time (1 = full time, 0.5 = half time) and tenure bounds —
  // see lib/capacity.js for how they drive weekly capacity.
  capacityPct: z.number().min(0).max(1),
  startDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]),
  endDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]),
});

// "" / null from the form mean "clear the bound"; a date string becomes a
// Date at 00:00 UTC, which lib/capacity.js reads back as a whole local day.
function normalizeMemberData(data) {
  const out = { ...data };
  if (out.email === "") out.email = null;
  if (out.jiraAccountId === "") out.jiraAccountId = null;
  for (const k of ["startDate", "endDate"]) {
    if (k in out) out[k] = out[k] ? new Date(out[k]) : null;
  }
  if (out.startDate && out.endDate && out.startDate > out.endDate) {
    return { error: "La date de départ doit être après la date d'arrivée." };
  }
  return { data: out };
}

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
  const merged = normalizeMemberData({ startDate: before.startDate, endDate: before.endDate, ...parsed.data });
  if (merged.error) return res.status(400).json({ error: merged.error });
  const data = Object.fromEntries(Object.entries(merged.data).filter(([k]) => k in parsed.data));
  const member = await prisma.poolMember.update({ where: { id: req.params.id }, data });

  let action = null;
  if ("name" in parsed.data) action = `a renommé ${before.name} en "${parsed.data.name}"`;
  else if ("squad" in parsed.data) action = `a changé le squad de ${before.name} en "${parsed.data.squad}"`;
  else if ("sousEquipe" in parsed.data) action = `a changé la sous-équipe de ${before.name} en "${parsed.data.sousEquipe}"`;
  else if ("roleTitle" in parsed.data) action = `a changé le rôle de ${before.name} en "${parsed.data.roleTitle}"`;
  else if ("email" in parsed.data) action = `a mis à jour l'email de ${before.name}`;
  else if ("capacityPct" in parsed.data) action = `a passé ${before.name} à ${Math.round(parsed.data.capacityPct * 100)}% de temps de travail`;
  else if ("startDate" in parsed.data) action = `a défini la date d'arrivée de ${before.name}`;
  else if ("endDate" in parsed.data) action = `a défini la date de départ de ${before.name}`;
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
  type: z.enum(["congé", "maladie", "formation", "autre", "congé validé", "congé refusé", "congé demandé"]),
  comment: z.string().optional(),
  color: z.string().optional()
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
