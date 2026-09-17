const prisma = require("./prisma");
const { periodIdToDates } = require("./periods");

// Any Unavailability for this pool member overlapping [periodStart, periodEnd]
// (period ids like "2026-W38") — used to warn the Team Lead/admin at the
// moment they propose or confirm an allocation, not just after the fact on
// the dashboard.
async function findUnavailabilityConflicts(poolMemberId, periodStart, periodEnd) {
  const { monday: rangeStart } = periodIdToDates(periodStart);
  const { sunday: rangeEnd } = periodIdToDates(periodEnd);
  const rows = await prisma.unavailability.findMany({ where: { poolMemberId } });
  return rows.filter((u) => u.startDate <= rangeEnd && rangeStart <= u.endDate);
}

const fmtDay = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

// Message for the 409 rejection when a conflict blocks an allocation —
// names the resource and lists every overlapping leave with its real dates.
function conflictErrorMessage(memberName, conflicts) {
  const list = conflicts.map((c) => `${c.type} (${fmtDay(c.startDate)} → ${fmtDay(c.endDate)})`).join(", ");
  return `${memberName} est indisponible sur cette période : ${list}.`;
}

module.exports = { findUnavailabilityConflicts, conflictErrorMessage };
