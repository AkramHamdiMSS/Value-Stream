const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");
const { hasPermission } = require("../lib/permissions");
const { effective, inRange } = require("../lib/periods");
const { logActivity } = require("../lib/activity");
const { notifyHSV, notifyPoolMember, notifyTeamLeadsForSousEquipe, notifyTeamLeadsForSquad, projectLink } = require("../lib/notify");

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
  let dMobile = 0, dTpe = 0, dDigital = 0;
  for (const l of project.demandLines) {
    const eff = effective(l.count, l.pct);
    if (l.profile === "Mobile") dMobile += eff;
    else if (l.profile === "TPE") dTpe += eff;
    else if (l.profile === "Digital") dDigital += eff;
  }
  let aMobile = 0, aTpe = 0, aDigital = 0;
  // Pending (unapproved) proposals don't count as real capacity yet.
  for (const l of project.allocationLines) {
    if (l.status !== "approved") continue;
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

    // Team/Tech Leads of each demanded squad get a heads-up too, so they can
    // start anticipating who they might propose — demand is only ever
    // expressed per squad (Mobile/TPE/Digital), not per sous-équipe.
    const bySquad = {};
    for (const dl of updated.demandLines) {
      const eff = effective(dl.count, dl.pct);
      if (eff <= 0) continue;
      (bySquad[dl.profile] ??= []).push(`${rangeLabel(dl)} (${eff})`);
    }
    await Promise.all(
      Object.entries(bySquad).map(([squad, lines]) =>
        notifyTeamLeadsForSquad(
          squad,
          `Demande à prévoir — ${updated.name}`,
          `${req.user.name} (SVO) a soumis une demande ${squad} pour "${updated.name}" : ${lines.join(", ")}. À vous de proposer une affectation le moment venu.`,
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
  const periodStart = parsed.data.periodStart ?? "";
  const periodEnd = parsed.data.periodEnd ?? periodStart;
  if (periodStart > periodEnd) return res.status(400).json({ error: "La semaine de fin doit être après la semaine de début." });

  const line = await prisma.demandLine.create({
    data: {
      projectId: project.id,
      periodStart,
      periodEnd,
      profile: parsed.data.profile ?? "Mobile",
      count: parsed.data.count ?? 0,
      pct: parsed.data.pct ?? null,
    },
  });
  await logActivity({ user: req.user, action: `a ajouté un besoin ${line.profile} (${rangeLabel(line)})`, project });
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
    const row = { period, Mobile: { dem: 0, alloc: 0 }, TPE: { dem: 0, alloc: 0 }, Digital: { dem: 0, alloc: 0 } };
    project.demandLines.filter((l) => inRange(period, l.periodStart, l.periodEnd)).forEach((l) => {
      row[l.profile].dem += effective(l.count, l.pct);
    });
    project.allocationLines.filter((l) => inRange(period, l.periodStart, l.periodEnd)).forEach((l) => {
      const squad = l.poolMember?.squad;
      if (squad) row[squad].alloc += Number(l.pct) || 0;
    });
    return row;
  });

  res.json(rows);
});

module.exports = router;
