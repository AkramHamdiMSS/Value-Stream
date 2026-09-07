const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { hasPermission } = require("../lib/permissions");

async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentification requise." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: "Utilisateur introuvable." });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Session invalide ou expirée." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé." });
    }
    next();
  };
}

function requirePermission(key) {
  return (req, res, next) => {
    if (!req.user || !hasPermission(req.user, key)) {
      return res.status(403).json({ error: "Accès refusé." });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, requirePermission };
