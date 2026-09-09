const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, requireRole, requirePermission } = require("../middleware/auth");
const { PERMISSION_KEYS } = require("../lib/permissions");
const { logActivity } = require("../lib/activity");

const router = express.Router();
router.use(authenticate);

// List SVO accounts, with their assigned project count (used by the "Rôles" screen
// and by SVO dropdowns elsewhere). Any authenticated user may read this.
router.get("/", async (req, res) => {
  const roleFilter = req.query.role;
  const users = await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter } : undefined,
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      hasPassword: !!u.passwordHash,
      projectCount: u._count.projects,
      permissions: u.permissions || [],
    }))
  );
});

// Granting/revoking permissions is reserved for the actual hsv role — a delegated
// svo with "manageRoles" can still manage accounts below, just not the permission
// matrix itself (that would let them hand out capabilities, including to themselves).
router.patch("/:id/permissions", requireRole("hsv"), async (req, res) => {
  const schema = z.object({ permissions: z.array(z.enum(PERMISSION_KEYS)) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Permissions invalides." });

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "Compte introuvable." });
  if (target.role !== "svo") return res.status(400).json({ error: "Seuls les comptes SVO ont des permissions personnalisables." });

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { permissions: [...new Set(parsed.data.permissions)] },
  });
  await logActivity({ user: req.user, action: `a modifié les permissions de ${user.name}` });
  res.json({ id: user.id, permissions: user.permissions });
});

// Promoting/demoting between svo and hsv is as sensitive as the permission
// matrix — reserved for the actual hsv role, same reasoning as above.
router.patch("/:id/role", requireRole("hsv"), async (req, res) => {
  const schema = z.object({ role: z.enum(["svo", "hsv"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Rôle invalide." });

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "Compte introuvable." });
  if (target.role === parsed.data.role) return res.json({ id: target.id, role: target.role });

  if (target.role === "hsv" && parsed.data.role === "svo") {
    const hsvCount = await prisma.user.count({ where: { role: "hsv" } });
    if (hsvCount <= 1) return res.status(409).json({ error: "Impossible de rétrograder le dernier compte Head of Value Stream." });
  }

  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role: parsed.data.role } });
  await logActivity({
    user: req.user,
    action: parsed.data.role === "hsv" ? `a promu ${user.name} Head of Value Stream` : `a rétrogradé ${user.name} en SVO`,
  });
  res.json({ id: user.id, name: user.name, role: user.role });
});

router.use(requirePermission("manageRoles"));

// Create an SVO account by duplicating a pool member's name (CDC 2 — "dupliquer son
// name depuis pool_members vers users"), or a standalone SVO not tied to the pool.
router.post("/", async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(1).optional(),
    poolMemberId: z.string().uuid().optional(),
    role: z.enum(["svo", "hsv"]).default("svo"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
  const { poolMemberId, role } = parsed.data;
  let { name } = parsed.data;

  if (poolMemberId) {
    const member = await prisma.poolMember.findUnique({ where: { id: poolMemberId } });
    if (!member) return res.status(404).json({ error: "Personne du pool introuvable." });
    name = member.name;
  }
  if (!name) return res.status(400).json({ error: "Nom requis." });

  const existing = await prisma.user.findUnique({ where: { name } });
  if (existing) return res.status(409).json({ error: "Ce nom est déjà utilisé par un compte." });

  const user = await prisma.user.create({ data: { name, role } });
  await logActivity({ user: req.user, action: `a créé le compte ${user.name} (${user.role})` });
  res.status(201).json({ id: user.id, name: user.name, role: user.role, hasPassword: false, projectCount: 0 });
});

router.patch("/:id", async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nom invalide." });

  const existing = await prisma.user.findUnique({ where: { name: parsed.data.name } });
  if (existing && existing.id !== req.params.id) {
    return res.status(409).json({ error: "Ce nom est déjà utilisé par un compte." });
  }

  const before = await prisma.user.findUnique({ where: { id: req.params.id } });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { name: parsed.data.name } });
  if (before) await logActivity({ user: req.user, action: `a renommé le compte "${before.name}" en "${user.name}"` });
  res.json({ id: user.id, name: user.name, role: user.role });
});

router.delete("/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { projects: true } } },
  });
  if (!user) return res.status(404).json({ error: "Compte introuvable." });
  if (user._count.projects > 0) {
    return res.status(409).json({ error: "Réaffectez d'abord ses projets à un autre SVO." });
  }
  if (user.role === "hsv") {
    // A delegated SVO with just "manageRoles" could otherwise delete the real
    // admin account — deleting an hsv account is reserved for the actual hsv role.
    if (req.user.role !== "hsv") return res.status(403).json({ error: "Accès refusé." });
    const hsvCount = await prisma.user.count({ where: { role: "hsv" } });
    if (hsvCount <= 1) return res.status(409).json({ error: "Impossible de supprimer le dernier compte Head of Value Stream." });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  await logActivity({ user: req.user, action: `a supprimé le compte ${user.name}` });
  res.json({ ok: true });
});

router.post("/:id/set-password", async (req, res) => {
  const schema = z.object({ password: z.string().min(4) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Le mot de passe doit faire au moins 4 caractères." });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
  // Never log the password itself, just that it changed.
  await logActivity({ user: req.user, action: `a défini un nouveau mot de passe pour ${user.name}` });
  res.json({ id: user.id, name: user.name, hasPassword: true });
});

module.exports = router;
