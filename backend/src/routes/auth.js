const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middleware/auth");
const { logActivity } = require("../lib/activity");

const router = express.Router();

function issueToken(user) {
  return jwt.sign({ sub: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });
}
function toPublicUser(user) {
  return { id: user.id, name: user.name, role: user.role, permissions: user.permissions || [] };
}

// Public: list of accounts for the login dropdown (no password data).
router.get("/accounts", async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, passwordHash: true },
  });
  res.json(
    users.map((u) => ({ id: u.id, name: u.name, role: u.role, hasPassword: !!u.passwordHash }))
  );
});

router.post("/login", async (req, res) => {
  const schema = z.object({ name: z.string().min(1), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nom et mot de passe requis." });
  const { name, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { name } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({
      error: user
        ? "Ce compte n'a pas encore de mot de passe — demandez au Head of Value Stream de vous en créer un."
        : "Compte introuvable.",
    });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Mot de passe incorrect." });

  await logActivity({ user, action: "s'est connecté(e)" });
  res.json({ token: issueToken(user), user: toPublicUser(user) });
});

router.get("/me", authenticate, (req, res) => {
  res.json(toPublicUser(req.user));
});

router.post("/change-password", authenticate, async (req, res) => {
  const schema = z.object({ currentPassword: z.string().optional(), newPassword: z.string().min(4) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit faire au moins 4 caractères." });
  }
  const { currentPassword, newPassword } = parsed.data;

  if (req.user.passwordHash) {
    const ok = currentPassword && (await bcrypt.compare(currentPassword, req.user.passwordHash));
    if (!ok) return res.status(400).json({ error: "Mot de passe actuel incorrect." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
  await logActivity({ user: req.user, action: "a changé son mot de passe" });
  res.json({ ok: true });
});

module.exports = router;
