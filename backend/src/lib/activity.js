const prisma = require("./prisma");

// Denormalized on purpose (see schema comment) — fire-and-forget from the
// caller's point of view, but awaited here so a logging failure surfaces
// during development rather than silently vanishing.
async function logActivity({ user, action, project }) {
  await prisma.activityLog.create({
    data: {
      userId: user?.id ?? null,
      userName: user?.name ?? "Système",
      action,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
    },
  });
}

module.exports = { logActivity };
