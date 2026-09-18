// Minimal Tempo Cloud REST API v4 client — no external dependency, just
// fetch with a Bearer token (generated in Tempo: Settings → Data Access →
// API Integration). Legitimate integration, unlike the ASCII scraper: a
// dedicated API token, not a person's login credentials.
const TEMPO_BASE_URL = "https://api.tempo.io/4";

// Standard full-time hours per week, used to convert a planned allocation
// % into an expected hours figure comparable to what Tempo reports.
// Adjust if the team's contractual week differs.
const STANDARD_WEEK_HOURS = 40;

// A slow/unreachable third party must never hang the caller — same reasoning
// as the SMTP fire-and-forget fix, just bounded here instead of backgrounded
// since this IS the thing we're waiting on (the sync script's whole job).
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWorklogs(from, to) {
  const token = process.env.TEMPO_API_TOKEN;
  if (!token) throw new Error("TEMPO_API_TOKEN manquant dans .env");

  const worklogs = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const url = `${TEMPO_BASE_URL}/worklogs?from=${from}&to=${to}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Tempo API a répondu ${res.status} ${res.statusText} pour ${url}`);
    }
    const body = await res.json();
    worklogs.push(...(body.results || []));
    if (!body.metadata?.next) break;
    offset += limit;
  }
  return worklogs;
}

module.exports = { fetchWorklogs, STANDARD_WEEK_HOURS };
