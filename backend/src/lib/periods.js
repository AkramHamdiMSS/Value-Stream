const N_WEEKS = 52;
const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// Monday of the week containing `date` — so S1 is always the current week,
// not next week whenever "today" happens to fall after a Monday.
function currentWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

// ISO 8601 week identifier, e.g. "2026-W37" — stable regardless of when it is computed.
function isoWeekId(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function generatePeriods(n = N_WEEKS, from = new Date()) {
  const out = [];
  let d = currentWeekMonday(from);
  for (let i = 0; i < n; i++) {
    out.push(isoWeekId(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

// Same weeks as generatePeriods(), but with {id, label} — label is a display string
// like "S1 · 7 sept." formatted from the week's Monday date.
function generatePeriodObjects(n = N_WEEKS, from = new Date()) {
  const out = [];
  let d = currentWeekMonday(from);
  for (let i = 0; i < n; i++) {
    out.push({ id: isoWeekId(d), label: `S${i + 1} · ${d.getDate()} ${MONTHS_FR[d.getMonth()]}` });
    d.setDate(d.getDate() + 7);
  }
  return out;
}

// Period ids are "YYYY-Wnn" (zero-padded week, generated in order), which
// happens to sort correctly as plain strings — so range membership is just
// string comparison, no need to materialize the list of weeks in between.
function inRange(id, start, end) {
  return start <= id && id <= end;
}

// Same walk as generatePeriods()/generatePeriodObjects(), but yielding each
// period's Monday date instead of just its id/label — the one place other
// code should get a period's actual date span from, instead of
// reimplementing ISO week math independently (which is easy to get subtly
// wrong: week 1 isn't just "day 1-7 of the year").
function generatePeriodDates(n = N_WEEKS, from = new Date()) {
  const out = [];
  let d = currentWeekMonday(from);
  for (let i = 0; i < n; i++) {
    out.push({ id: isoWeekId(d), monday: new Date(d) });
    d.setDate(d.getDate() + 7);
  }
  return out;
}

// Whether a [rangeStart, rangeEnd] date span (e.g. a leave request) overlaps
// at all with the Monday..Sunday week starting at `monday` — a full overlap
// test, not just "does either endpoint fall inside this week", so a leave
// spanning several weeks correctly covers every week in between too.
function dateRangeOverlapsWeek(rangeStart, rangeEnd, monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return rangeStart <= sunday && rangeEnd >= monday;
}

// Reverse of isoWeekId(), computed directly rather than by walking from
// "today" — needed for an arbitrary period id (a demand/allocation line's
// periodStart/periodEnd can be any week, not just one of the 52 currently
// on screen). ISO 8601: week 1 is always the week containing 4 January.
function periodIdToDates(periodId) {
  const [yearStr, weekStr] = periodId.split("-W");
  const year = Number(yearStr), week = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { monday, sunday };
}

function effective(count, pct) {
  const c = Number(count) || 0;
  const p = pct === null || pct === undefined || pct === "" ? 1 : Number(pct);
  return c * p;
}

module.exports = { N_WEEKS, currentWeekMonday, isoWeekId, generatePeriods, generatePeriodObjects, generatePeriodDates, periodIdToDates, effective, inRange, dateRangeOverlapsWeek };
