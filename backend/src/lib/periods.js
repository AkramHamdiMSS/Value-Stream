const N_WEEKS = 52;
const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function nextMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (8 - day) % 7;
  d.setDate(d.getDate() + diff);
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
  let d = nextMonday(from);
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
  let d = nextMonday(from);
  for (let i = 0; i < n; i++) {
    out.push({ id: isoWeekId(d), label: `S${i + 1} · ${d.getDate()} ${MONTHS_FR[d.getMonth()]}` });
    d.setDate(d.getDate() + 7);
  }
  return out;
}

function effective(count, pct) {
  const c = Number(count) || 0;
  const p = pct === null || pct === undefined || pct === "" ? 1 : Number(pct);
  return c * p;
}

module.exports = { N_WEEKS, nextMonday, isoWeekId, generatePeriods, generatePeriodObjects, effective };
