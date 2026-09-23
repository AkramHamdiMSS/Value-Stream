// Weekly capacity model. Everything that answers "how much of this person is
// really available in week W" lives here so the dashboard, the allocation
// checks and the demand queue can't disagree.
//
// A week is 5 working days (minus public holidays), each split into a
// morning and an afternoon half-day — the granularity ASCII uses for leave
// (startdatetype/enddatetype = Morning/Afternoon). A person's net capacity
// for a week is:
//
//   capacityPct × tenureFraction × (1 − unavailableFraction)
//
//   capacityPct        contractual (1 = full time, 0.5 = half time)
//   tenureFraction     share of the week's working days inside [startDate, endDate]
//   unavailableFraction share of the week's working half-days covered by a
//                      blocking leave (union of overlapping leaves, capped at 1)
const { periodIdToDates, isoWeekId } = require("./periods");
const { workingDaysOfWeek } = require("./holidays");

// Only leave that will actually happen removes capacity. A refused request
// changes nothing; a pending request is surfaced as a warning but doesn't
// block or reduce capacity until HR validates it (ASCII import then flips
// its type to "congé validé").
const BLOCKING_TYPES = new Set(["congé", "congé validé", "maladie", "formation", "autre"]);
const WARNING_TYPES = new Set(["congé demandé"]);

function isBlockingLeave(u) {
  return BLOCKING_TYPES.has(u.type);
}
function isWarningLeave(u) {
  return WARNING_TYPES.has(u.type);
}

// A value stored at exactly 00:00:00 UTC came from a date-only input
// ("2026-09-11" from the Pool form, or a PoolMember start/end date) and
// means the whole local day, not a midnight instant. ASCII entries carry a
// real time of day (07:00 / 12:00 / 18:00 local) and are kept as-is.
function isDateOnly(d) {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}
function localDayStart(d) {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
}

// [start, end) interval covered by a leave, in local time.
function leaveInterval(u) {
  const s = new Date(u.startDate);
  const e = new Date(u.endDate);
  const start = isDateOnly(s) ? localDayStart(s) : s;
  let end;
  if (isDateOnly(e)) {
    end = localDayStart(e);
    end.setDate(end.getDate() + 1); // inclusive whole day
  } else {
    end = e;
  }
  return { start, end };
}

// Half-day slots of a week's working days: [00:00,12:00) and [12:00,24:00).
function halfDaySlots(monday) {
  const slots = [];
  for (const day of workingDaysOfWeek(monday)) {
    const noon = new Date(day);
    noon.setHours(12, 0, 0, 0);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    slots.push({ start: day, end: noon });
    slots.push({ start: noon, end: next });
  }
  return slots;
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

// Share (0..1) of the week's working half-days covered by at least one of
// the given leaves. Union, not sum: two overlapping leaves on the same
// afternoon don't count twice.
function unavailableFraction(leaves, monday) {
  const slots = halfDaySlots(monday);
  if (slots.length === 0) return 0;
  const intervals = leaves.map(leaveInterval);
  let covered = 0;
  for (const slot of slots) {
    if (intervals.some((iv) => overlaps(iv, slot))) covered++;
  }
  return covered / slots.length;
}

// Share (0..1) of the week's working days that fall inside the person's
// [startDate, endDate] tenure. Null bounds are open.
function tenureFraction(member, monday) {
  const days = workingDaysOfWeek(monday);
  if (days.length === 0) return 0;
  const start = member.startDate ? localDayStart(new Date(member.startDate)) : null;
  let end = null;
  if (member.endDate) {
    end = localDayStart(new Date(member.endDate));
    end.setDate(end.getDate() + 1);
  }
  const inside = days.filter((d) => (!start || d >= start) && (!end || d < end)).length;
  return inside / days.length;
}

function contractPct(member) {
  const v = member.capacityPct === undefined || member.capacityPct === null ? 1 : Number(member.capacityPct);
  return Number.isFinite(v) ? v : 1;
}

// Net capacity (in FTE) of one person for the week starting `monday`, given
// their leaves (any type — filtering to blocking ones happens here).
function netCapacity(member, leaves, monday) {
  const blocking = leaves.filter(isBlockingLeave);
  const cap = contractPct(member) * tenureFraction(member, monday) * (1 - unavailableFraction(blocking, monday));
  return Math.max(0, Math.round(cap * 1000) / 1000);
}

// Local-time Monday of a period id — periodIdToDates() works in UTC, and all
// slot math above is local, so convert once here.
function periodMonday(periodId) {
  const { monday } = periodIdToDates(periodId);
  return new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
}

// Every period id from `start` to `end` inclusive — the weeks a demand or
// allocation line actually spans. Cheap enough to call per line (a line
// rarely covers more than a year).
function periodRange(start, end) {
  if (!start || !end || start > end) return [];
  const out = [];
  const d = periodMonday(start);
  let id = isoWeekId(d);
  let guard = 0;
  while (id <= end && guard++ < 520) {
    out.push(id);
    d.setDate(d.getDate() + 7);
    id = isoWeekId(d);
  }
  return out;
}

module.exports = {
  BLOCKING_TYPES, WARNING_TYPES, isBlockingLeave, isWarningLeave,
  leaveInterval, halfDaySlots, unavailableFraction, tenureFraction, contractPct, netCapacity,
  periodMonday, periodRange,
};
