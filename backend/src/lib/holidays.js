// Public holidays reduce the working days of a week — both for capacity
// (nobody works that day) and for the Tempo "expected hours" comparison
// (planned 100% on a 4-day week is 32h, not 40h — otherwise every holiday
// week shows a fake -20% timesheet gap).
//
// Fixed-date Tunisian public holidays. Religious holidays (Aïd el-Fitr, Aïd
// el-Idha, Ras el-Am el-Hijri, Mouled) move every year and are only known a
// few weeks ahead, so they are NOT hard-coded: add them through the
// HOLIDAYS_EXTRA env var as a comma-separated list of YYYY-MM-DD dates.
const FIXED_MM_DD = [
  "01-01", // Jour de l'an
  "01-14", // Fête de la Révolution et de la Jeunesse
  "03-20", // Fête de l'Indépendance
  "04-09", // Journée des Martyrs
  "05-01", // Fête du Travail
  "07-25", // Fête de la République
  "08-13", // Fête de la Femme
  "10-15", // Fête de l'Évacuation
  "12-17", // Fête de la Révolution
];

function pad(n) {
  return String(n).padStart(2, "0");
}

// Local-calendar "YYYY-MM-DD" of a Date — all week/day math in this codebase
// is done in the server's local time zone (see periods.js).
function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

let cachedExtra = null;
function extraHolidays() {
  if (cachedExtra) return cachedExtra;
  cachedExtra = new Set(
    (process.env.HOLIDAYS_EXTRA || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
  );
  return cachedExtra;
}

function isHoliday(date) {
  const key = dayKey(date);
  return FIXED_MM_DD.includes(key.slice(5)) || extraHolidays().has(key);
}

// Monday..Friday of the week starting at `monday`, minus public holidays.
function workingDaysOfWeek(monday) {
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    d.setHours(0, 0, 0, 0);
    if (!isHoliday(d)) days.push(d);
  }
  return days;
}

module.exports = { isHoliday, workingDaysOfWeek, dayKey, FIXED_MM_DD };
