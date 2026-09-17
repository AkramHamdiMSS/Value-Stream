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

module.exports = { findUnavailabilityConflicts };
