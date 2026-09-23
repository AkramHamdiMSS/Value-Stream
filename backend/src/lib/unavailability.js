const prisma = require("./prisma");
const { periodIdToDates } = require("./periods");
const {
  isBlockingLeave, isWarningLeave, netCapacity, contractPct, periodMonday, periodRange, unavailableFraction,
} = require("./capacity");

// Any Unavailability for this pool member overlapping [periodStart, periodEnd]
// (period ids like "2026-W38"), whatever its type.
async function findUnavailabilityConflicts(poolMemberId, periodStart, periodEnd) {
  const { monday: rangeStart } = periodIdToDates(periodStart);
  const { sunday: rangeEnd } = periodIdToDates(periodEnd);
  const rows = await prisma.unavailability.findMany({ where: { poolMemberId } });
  return rows.filter((u) => u.startDate <= rangeEnd && rangeStart <= u.endDate);
}

const fmtDay = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
const fmtLeave = (c) => `${c.type} (${fmtDay(c.startDate)} → ${fmtDay(c.endDate)})`;
const pct = (n) => `${Math.round(n * 100)}%`;

// Message for the 409 rejection when a conflict blocks an allocation —
// names the resource and lists every overlapping leave with its real dates.
function conflictErrorMessage(memberName, conflicts) {
  return `${memberName} est indisponible sur cette période : ${conflicts.map(fmtLeave).join(", ")}.`;
}

// Can `member` really take `requestedPct` on every week of the range?
//
// Blocking rule, per week: the person's net capacity (contract × tenure ×
// leave actually happening) must be at least what is asked. So a Friday
// afternoon off (0.9 available) doesn't block a 20% allocation, but a
// 3-day leave (0.4 available) blocks a 50% one. A refused leave never
// blocks; a still-pending request only produces a warning.
//
// Over-allocation rule, per week: existing load on other lines + requested
// must not exceed net capacity — reported as a warning (the HSV may want to
// go through with it knowingly), never as a block.
//
// Returns { blocking: string[], warnings: string[] }.
async function checkAllocationFeasibility({ member, periodStart, periodEnd, requestedPct, excludeLineId = null }) {
  const [leaves, otherLines] = await Promise.all([
    findUnavailabilityConflicts(member.id, periodStart, periodEnd),
    prisma.allocationLine.findMany({
      where: {
        poolMemberId: member.id,
        status: { in: ["approved", "pending"] },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        ...(excludeLineId ? { id: { not: excludeLineId } } : {}),
      },
      select: { periodStart: true, periodEnd: true, pct: true, project: { select: { name: true } } },
    }),
  ]);

  const blocking = [];
  const warnings = [];
  const blockingLeaves = leaves.filter(isBlockingLeave);
  const pendingLeaves = leaves.filter(isWarningLeave);

  if (contractPct(member) <= 0) blocking.push(`${member.name} n'a aucune capacité (temps de travail à 0%).`);

  let overWeeks = [];
  let leaveWeeks = [];
  for (const week of periodRange(periodStart, periodEnd)) {
    const monday = periodMonday(week);
    const cap = netCapacity(member, leaves, monday);
    if (cap + 0.001 < requestedPct) {
      const reason = blockingLeaves.length && unavailableFraction(blockingLeaves, monday) > 0
        ? blockingLeaves.map(fmtLeave).join(", ")
        : member.endDate || member.startDate ? "hors période de présence" : `temps de travail ${pct(contractPct(member))}`;
      leaveWeeks.push(`${week} (disponible ${pct(cap)}, demandé ${pct(requestedPct)} — ${reason})`);
      continue;
    }
    let load = 0;
    for (const l of otherLines) {
      if (l.periodStart <= week && week <= l.periodEnd) load += Number(l.pct) || 0;
    }
    if (load + requestedPct > cap + 0.001) {
      overWeeks.push(`${week} : ${pct(load + requestedPct)} pour ${pct(cap)} disponible`);
    }
  }

  if (leaveWeeks.length > 0) {
    blocking.push(`${member.name} n'est pas suffisamment disponible : ${dedupe(leaveWeeks).join(" ; ")}.`);
  }
  if (overWeeks.length > 0) {
    warnings.push(`Sur-allocation de ${member.name} — ${summarizeWeeks(overWeeks)}.`);
  }
  if (pendingLeaves.length > 0) {
    warnings.push(`${member.name} a une demande de congé en attente de validation RH : ${pendingLeaves.map(fmtLeave).join(", ")}.`);
  }
  return { blocking, warnings };
}

function dedupe(arr) {
  return [...new Set(arr)];
}
function summarizeWeeks(list) {
  if (list.length <= 3) return list.join(" ; ");
  return `${list.slice(0, 3).join(" ; ")} … (+${list.length - 3} semaine(s))`;
}

module.exports = { findUnavailabilityConflicts, conflictErrorMessage, checkAllocationFeasibility };
