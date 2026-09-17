const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { effective, inRange } = require("../lib/periods");
const { PROFILES, PROFILE_FIELDS } = require("../lib/profiles");
const { logActivity } = require("../lib/activity");
const { notifyHSV, notifyPoolMember, notifyTeamLeadsForSousEquipe, projectLink } = require("../lib/notify");

const router = express.Router();
router.use(authenticate);

function canViewAllProjects(user) {
  return hasPermission(user, "viewAllProjects") || hasPermission(user, "manageProjects") || hasPermission(user, "manageAllocations");
}

function canRead(req, project) {
  return canViewAllProjects(req.user) || project.svoUserId === req.user.id;
}

function rangeLabel(line) {
  return line.periodStart === line.periodEnd ? line.periodStart : `${line.periodStart} → ${line.periodEnd}`;
}

function computeTotals(project) {
  const demand = Object.fromEntries(PROFILES.map((p) => [p, 0]));
  for (const l of project.demandLines) {
    for (const { profile, countField, pctField } of PROFILE_FIELDS) {
      demand[profile] += effective(l[countField], l[pctField]);
    }
  }
  const alloc = Object.fromEntries(PROFILES.map((p) => [p, 0]));
  // Pending (unapproved) proposals don't count as real capacity yet.
  for (const l of project.allocationLines) {
    if (l.status !== "approved") continue;
    const key = l.poolMember?.sousEquipe;
    if (key in alloc) alloc[key] += Number(l.pct) || 0;
  }
  const dTotal = Object.values(demand).reduce((a, b) => a + b, 0);
  const aTotal = Object.values(alloc).reduce((a, b) => a + b, 0);
  return {
    demand: { ...demand, total: dTotal },
    alloc: { ...alloc, total: aTotal },
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
  const where = canViewAllProjects(req.user) ? {} : { svoUserId: req.user.id };
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

router.post("/", requirePermission("manageProjects"), async (req, res) => {
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
  await logActivity({ user: req.user, action: "a créé le projet", project });
  res.status(201).json({ ...serializeProject(project), totals: computeTotals(project) });
});

async function loadProjectOr404(req, res, { allowProposer = false } = {}) {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { svo: true, demandLines: true, allocationLines: { include: { poolMember: true } } },
  });
  if (!project) {
    res.status(404).json({ error: "Projet introuvable." });
    return null;
  }
  // A propose-only actor doesn't own most of the projects whose demand they
  // see in their squad-scoped queue — let them act on any project with
  // submitted demand, not just ones they happen to own.
  const allowed = canRead(req, project) || (allowProposer && hasPermission(req.user, "proposeAllocations") && project.demandSubmitted);
  if (!allowed) {
    res.status(403).json({ error: "Accès refusé." });
    return null;
  }
  return project;
}

router.get("/:id", async (req, res) => {
  // A propose-only Team Lead can click through from their squad-scoped
  // demand queue into projects they don't own — let them view it.
  const project = await loadProjectOr404(req, res, { allowProposer: true });
  if (!project) return;
  res.json({
    ...serializeProject(project),
    totals: computeTotals(project),
    demandLines: project.demandLines,
    allocationLines: project.allocationLines.map((l) => ({
      id: l.id,
      periodStart: l.periodStart,
      periodEnd: l.periodEnd,
      poolMemberId: l.poolMemberId,
      pct: l.pct,
      status: l.status,
      comment: l.comment,
      validationComment: l.validationComment,
      createdById: l.createdById,
      releaseRequested: l.releaseRequested,
      releaseNote: l.releaseNote,
      releaseNewPct: l.releaseNewPct,
    })),
  });
});

router.patch("/:id", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const canManageAny = hasPermission(req.user, "manageProjects");
  const isOwner = project.svoUserId === req.user.id;
  if (!canManageAny && !isOwner) return res.status(403).json({ error: "Accès refusé." });

  const schema = z.object({
    name: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    demandSubmitted: z.boolean().optional(),
    svoUserId: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });

  // A demand line defaults to 0 on every squad while the SVO is still
  // filling it in — only block at submission time, not on every keystroke,
  // and only for a genuinely empty line (every squad still at 0).
  if (parsed.data.demandSubmitted === true) {
    if (project.demandLines.length === 0) {
      return res.status(400).json({ error: "Ajoutez au moins une ligne de besoin avant de soumettre la demande." });
    }
    const emptyLine = project.demandLines.find((l) =>
      PROFILE_FIELDS.every(({ countField }) => Number(l[countField]) <= 0)
    );
    if (emptyLine) {
      return res.status(400).json({ error: `Chaque ligne de besoin doit avoir un effectif supérieur à 0 sur au moins un profil (${PROFILES.join(", ")}).` });
    }
  }

  const data = { ...parsed.data };
  if (!canManageAny) {
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

  let action = null;
  if ("demandSubmitted" in data) action = data.demandSubmitted ? "a soumis la demande" : "a rouvert la demande pour modification";
  else if ("svoUserId" in data) action = `a réaffecté le projet à ${updated.svo.name}`;
  else if ("name" in data) action = `a renommé le projet en "${data.name}"`;
  else if ("status" in data) action = `a changé le statut en "${data.status}"`;
  if (action) await logActivity({ user: req.user, action, project: updated });

  if (data.demandSubmitted === true) {
    const link = projectLink(updated.id);
    await notifyHSV(
      `Nouvelle demande de ressources — ${updated.name}`,
      `${req.user.name} (SVO) a soumis la demande de ressources pour le projet "${updated.name}". Elle est à staffer.`,
      link
    );

    // Team/Tech Leads of each demanded sous-équipe get a heads-up too, so
    // they can start anticipating who they might propose — one demand row
    // spans all four profiles at once, so each is checked independently,
    // and a TPE Android lead only hears about TPE Android demand.
    const byProfile = {};
    for (const dl of updated.demandLines) {
      for (const { profile, countField, pctField } of PROFILE_FIELDS) {
        const eff = effective(dl[countField], dl[pctField]);
        if (eff <= 0) continue;
        (byProfile[profile] ??= []).push(`${rangeLabel(dl)} (${eff})`);
      }
    }
    await Promise.all(
      Object.entries(byProfile).map(([profile, lines]) =>
        notifyTeamLeadsForSousEquipe(
          profile,
          `Demande à prévoir — ${updated.name}`,
          `${req.user.name} (SVO) a soumis une demande ${profile} pour "${updated.name}" : ${lines.join(", ")}. À vous de proposer une affectation le moment venu.`,
          link
        )
      )
    );
  }

  res.json({ ...serializeProject(updated), totals: computeTotals(updated) });
});

router.delete("/:id", requirePermission("manageProjects"), async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Projet introuvable." });
  await prisma.project.delete({ where: { id: req.params.id } });
  await logActivity({ user: req.user, action: "a supprimé le projet", project });
  res.json({ ok: true });
});

// ---- demand lines (nested) ----

router.get("/:id/demand-lines", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  res.json(project.demandLines);
});

const demandLineSchema = z.object({
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
  mobileCount: z.number().nonnegative(),
  tpeAndroidCount: z.number().nonnegative(),
  tpeEngageCount: z.number().nonnegative(),
  digitalCount: z.number().nonnegative(),
  mobilePct: z.number().min(0).max(2).nullable().optional(),
  tpeAndroidPct: z.number().min(0).max(2).nullable().optional(),
  tpeEngagePct: z.number().min(0).max(2).nullable().optional(),
  digitalPct: z.number().min(0).max(2).nullable().optional(),
  comment: z.string().trim().max(1000).nullable().optional(),
});

router.post("/:id/demand-lines", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  const isOwner = req.user.role === "svo" && project.svoUserId === req.user.id;
  if (!isOwner) return res.status(403).json({ error: "Seul le SVO du projet peut éditer le besoin." });
  if (project.demandSubmitted) return res.status(409).json({ error: "La demande est soumise — rouvrez-la pour modifier." });

  const parsed = demandLineSchema.partial({ mobileCount: true, tpeAndroidCount: true, tpeEngageCount: true, digitalCount: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ligne invalide." });
  const periodStart = parsed.data.periodStart ?? "";
  const periodEnd = parsed.data.periodEnd ?? periodStart;
  if (periodStart > periodEnd) return res.status(400).json({ error: "La semaine de fin doit être après la semaine de début." });

  const line = await prisma.demandLine.create({
    data: {
      projectId: project.id,
      periodStart,
      periodEnd,
      mobileCount: parsed.data.mobileCount ?? 0,
      tpeAndroidCount: parsed.data.tpeAndroidCount ?? 0,
      tpeEngageCount: parsed.data.tpeEngageCount ?? 0,
      digitalCount: parsed.data.digitalCount ?? 0,
      mobilePct: parsed.data.mobilePct ?? null,
      tpeAndroidPct: parsed.data.tpeAndroidPct ?? null,
      tpeEngagePct: parsed.data.tpeEngagePct ?? null,
      digitalPct: parsed.data.digitalPct ?? null,
      comment: parsed.data.comment ?? null,
    },
  });
  await logActivity({ user: req.user, action: `a ajouté un besoin (${rangeLabel(line)})`, project });
  res.status(201).json(line);
});

// ---- allocation lines (nested) ----

router.get("/:id/allocation-lines", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  res.json(project.allocationLines);
});

const allocationLineSchema = z.object({
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
  poolMemberId: z.string().uuid(),
  pct: z.number().min(0).max(2),
  comment: z.string().trim().max(1000).optional(),
});

router.post("/:id/allocation-lines", async (req, res) => {
  const canManage = hasPermission(req.user, "manageAllocations");
  const canPropose = hasPermission(req.user, "proposeAllocations");
  if (!canManage && !canPropose) return res.status(403).json({ error: "Accès refusé." });

  const project = await loadProjectOr404(req, res, { allowProposer: true });
  if (!project) return;

  const parsed = allocationLineSchema.partial({ poolMemberId: true, pct: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ligne invalide." });
  if (!parsed.data.poolMemberId) return res.status(400).json({ error: "Ressource requise." });
  const periodStart = parsed.data.periodStart ?? "";
  const periodEnd = parsed.data.periodEnd ?? periodStart;
  if (periodStart > periodEnd) return res.status(400).json({ error: "La semaine de fin doit être après la semaine de début." });

  // A propose-only actor can only put forward someone from their own
  // sous-équipe — enforced here, not just hidden client-side.
  if (!canManage) {
    const [self, target] = await Promise.all([
      prisma.poolMember.findFirst({ where: { name: req.user.name } }),
      prisma.poolMember.findUnique({ where: { id: parsed.data.poolMemberId } }),
    ]);
    if (!self || !target || target.sousEquipe !== self.sousEquipe) {
      return res.status(403).json({ error: "Vous ne pouvez proposer que des ressources de votre propre équipe." });
    }
  }

  const status = canManage ? "approved" : "pending";
  const line = await prisma.allocationLine.create({
    data: {
      projectId: project.id,
      periodStart,
      periodEnd,
      poolMemberId: parsed.data.poolMemberId,
      pct: parsed.data.pct ?? 1,
      comment: parsed.data.comment || null,
      createdById: req.user.id,
      status,
    },
    include: { poolMember: true },
  });
  const label = rangeLabel(line);
  await logActivity({
    user: req.user,
    action: status === "approved" ? `a affecté ${line.poolMember.name} (${label})` : `a proposé ${line.poolMember.name} (${label})`,
    project,
  });

  const allocLink = projectLink(project.id);
  if (status === "pending") {
    await notifyHSV(
      `Proposition d'affectation — ${project.name}`,
      `${req.user.name} propose d'affecter ${line.poolMember.name} sur "${project.name}" (${label}, ${Math.round(Number(line.pct) * 100)}%). À valider.`,
      allocLink
    );
  } else {
    await notifyPoolMember(
      line.poolMember,
      `Nouvelle affectation — ${project.name}`,
      `Vous avez été affecté(e) au projet "${project.name}" pour la période ${label} (${Math.round(Number(line.pct) * 100)}%).`,
      allocLink
    );
    await notifyTeamLeadsForSousEquipe(
      line.poolMember.sousEquipe,
      `Affectation d'équipe — ${project.name}`,
      `${line.poolMember.name} a été affecté(e) au projet "${project.name}" pour la période ${label} par ${req.user.name}.`,
      allocLink
    );
    await notifyHSV(
      `[Journal] Affectation directe — ${project.name}`,
      `${req.user.name} a affecté ${line.poolMember.name} sur "${project.name}" (${label}, ${Math.round(Number(line.pct) * 100)}%).`,
      allocLink
    );
  }

  res.status(201).json(line);
});

// ---- synthesis: demandé vs alloué, by period, for one project ----

router.get("/:id/synthesis", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const periods = new Set();
  project.demandLines.forEach((l) => { periods.add(l.periodStart); periods.add(l.periodEnd); });
  project.allocationLines.forEach((l) => { periods.add(l.periodStart); periods.add(l.periodEnd); });

  const rows = [...periods].sort().map((period) => {
    const row = { period, ...Object.fromEntries(PROFILES.map((p) => [p, { dem: 0, alloc: 0 }])) };
    project.demandLines.filter((l) => inRange(period, l.periodStart, l.periodEnd)).forEach((l) => {
      for (const { profile, countField, pctField } of PROFILE_FIELDS) {
        row[profile].dem += effective(l[countField], l[pctField]);
      }
    });
    project.allocationLines.filter((l) => inRange(period, l.periodStart, l.periodEnd)).forEach((l) => {
      const key = l.poolMember?.sousEquipe;
      if (key in row) row[key].alloc += Number(l.pct) || 0;
    });
    return row;
  });

  res.json(rows);
});

module.exports = router;
