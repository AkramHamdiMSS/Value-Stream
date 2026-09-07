const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { effective } = require("../lib/periods");

const router = express.Router();
router.use(authenticate);

function canRead(req, project) {
  return req.user.role === "hsv" || project.svoUserId === req.user.id;
}

function computeTotals(project) {
  let dMobile = 0, dTpe = 0, dDigital = 0;
  for (const l of project.demandLines) {
    const eff = effective(l.count, l.pct);
    if (l.profile === "Mobile") dMobile += eff;
    else if (l.profile === "TPE") dTpe += eff;
    else if (l.profile === "Digital") dDigital += eff;
  }
  let aMobile = 0, aTpe = 0, aDigital = 0;
  for (const l of project.allocationLines) {
    const pct = Number(l.pct) || 0;
    const squad = l.poolMember?.squad;
    if (squad === "Mobile") aMobile += pct;
    else if (squad === "TPE") aTpe += pct;
    else if (squad === "Digital") aDigital += pct;
  }
  return {
    demand: { Mobile: dMobile, TPE: dTpe, Digital: dDigital, total: dMobile + dTpe + dDigital },
    alloc: { Mobile: aMobile, TPE: aTpe, Digital: aDigital, total: aMobile + aTpe + aDigital },
  };
}

function serializeProject(project) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    demandSubmitted: project.demandSubmitted,
    svoUserId: project.svoUserId,
    svo: project.svo ? { id: project.svo.id, name: project.svo.name } : null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

router.get("/", async (req, res) => {
  const where = req.user.role === "hsv" ? {} : { svoUserId: req.user.id };
  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      svo: true,
      demandLines: true,
      allocationLines: { include: { poolMember: true } },
    },
  });
  res.json(projects.map((p) => ({ ...serializeProject(p), totals: computeTotals(p) })));
});

router.post("/", requireRole("hsv"), async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(1).default("Nouveau projet"),
    svoUserId: z.string().uuid(),
    status: z.string().trim().min(1).default("Cadrage"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });

  const svo = await prisma.user.findUnique({ where: { id: parsed.data.svoUserId } });
  if (!svo || svo.role !== "svo") return res.status(400).json({ error: "SVO invalide." });

  const project = await prisma.project.create({
    data: parsed.data,
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });
  res.status(201).json({ ...serializeProject(project), totals: computeTotals(project) });
});

async function loadProjectOr404(req, res) {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });
  if (!project) {
    res.status(404).json({ error: "Projet introuvable." });
    return null;
  }
  if (!canRead(req, project)) {
    res.status(403).json({ error: "Accès refusé." });
    return null;
  }
  return project;
}

router.get("/:id", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  res.json({
    ...serializeProject(project),
    totals: computeTotals(project),
    demandLines: project.demandLines,
    allocationLines: project.allocationLines.map((l) => ({
      id: l.id,
      period: l.period,
      poolMemberId: l.poolMemberId,
      pct: l.pct,
    })),
  });
});

router.patch("/:id", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const isHSV = req.user.role === "hsv";
  const isOwner = project.svoUserId === req.user.id;
  if (!isHSV && !isOwner) return res.status(403).json({ error: "Accès refusé." });

  const schema = z.object({
    name: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    demandSubmitted: z.boolean().optional(),
    svoUserId: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });

  const data = { ...parsed.data };
  if (!isHSV) {
    // SVO cannot reassign the project's owner.
    delete data.svoUserId;
  } else if (data.svoUserId) {
    const svo = await prisma.user.findUnique({ where: { id: data.svoUserId } });
    if (!svo || svo.role !== "svo") return res.status(400).json({ error: "SVO invalide." });
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data,
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });
  res.json({ ...serializeProject(updated), totals: computeTotals(updated) });
});

router.delete("/:id", requireRole("hsv"), async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Projet introuvable." });
  await prisma.project.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ---- demand lines (nested) ----

router.get("/:id/demand-lines", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  res.json(project.demandLines);
});

const demandLineSchema = z.object({
  period: z.string().trim().min(1),
  profile: z.enum(["Mobile", "TPE", "Digital"]),
  count: z.number().nonnegative(),
  pct: z.number().min(0).max(2).nullable().optional(),
});

router.post("/:id/demand-lines", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  const isOwner = req.user.role === "svo" && project.svoUserId === req.user.id;
  if (!isOwner) return res.status(403).json({ error: "Seul le SVO du projet peut éditer le besoin." });
  if (project.demandSubmitted) return res.status(409).json({ error: "La demande est soumise — rouvrez-la pour modifier." });

  const parsed = demandLineSchema.partial({ count: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ligne invalide." });

  const line = await prisma.demandLine.create({
    data: {
      projectId: project.id,
      period: parsed.data.period ?? "",
      profile: parsed.data.profile ?? "Mobile",
      count: parsed.data.count ?? 0,
      pct: parsed.data.pct ?? null,
    },
  });
  res.status(201).json(line);
});

// ---- allocation lines (nested) ----

router.get("/:id/allocation-lines", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  res.json(project.allocationLines);
});

const allocationLineSchema = z.object({
  period: z.string().trim().min(1),
  poolMemberId: z.string().uuid(),
  pct: z.number().min(0).max(2),
});

router.post("/:id/allocation-lines", requireRole("hsv"), async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const parsed = allocationLineSchema.partial({ poolMemberId: true, pct: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ligne invalide." });
  if (!parsed.data.poolMemberId) return res.status(400).json({ error: "Ressource requise." });

  const line = await prisma.allocationLine.create({
    data: {
      projectId: project.id,
      period: parsed.data.period ?? "",
      poolMemberId: parsed.data.poolMemberId,
      pct: parsed.data.pct ?? 1,
      createdById: req.user.id,
    },
    include: { poolMember: true },
  });
  res.status(201).json(line);
});

// ---- synthesis: demandé vs alloué, by period, for one project ----

router.get("/:id/synthesis", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const periods = new Set();
  project.demandLines.forEach((l) => l.period && periods.add(l.period));
  project.allocationLines.forEach((l) => l.period && periods.add(l.period));

  const rows = [...periods].sort().map((period) => {
    const row = { period, Mobile: { dem: 0, alloc: 0 }, TPE: { dem: 0, alloc: 0 }, Digital: { dem: 0, alloc: 0 } };
    project.demandLines.filter((l) => l.period === period).forEach((l) => {
      row[l.profile].dem += effective(l.count, l.pct);
    });
    project.allocationLines.filter((l) => l.period === period).forEach((l) => {
      const squad = l.poolMember?.squad;
      if (squad) row[squad].alloc += Number(l.pct) || 0;
    });
    return row;
  });

  res.json(rows);
});

module.exports = router;
