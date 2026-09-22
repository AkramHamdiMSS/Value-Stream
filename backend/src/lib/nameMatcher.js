// Fuzzy person-name matching used by the ASCII leave import: ASCII gives
// "Hamdi AKRAM" / "Oussema ECHIKH" while the pool holds "Akram Hamdi" /
// "Oussama Cheikh" — different word order AND spelling. Names are compared
// token by token, in any order, with a tolerance on spelling.

function normalize(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // punctuation -> space
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(str) {
  return normalize(str).split(" ").filter((t) => t.length > 1);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Similarity between two tokens in [0, 1]. Handles exact, prefix (initials or
// truncated names) and typo-level differences (Oussema/Oussama, Echikh/Cheikh).
function tokenSimilarity(a, b) {
  if (a === b) return 1;
  if (a.startsWith(b) || b.startsWith(a)) return 0.9;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const sim = 1 - dist / maxLen;
  // Also try with a leading silent "e" dropped (Echikh -> Chikh)
  const stripped = [a.replace(/^e/, ""), b.replace(/^e/, "")];
  const sim2 = 1 - levenshtein(stripped[0], stripped[1]) / Math.max(stripped[0].length, stripped[1].length);
  return Math.max(sim, sim2);
}

// Score how well the ASCII name matches a candidate name, ignoring order.
// Every token of the shorter side must find a partner in the other side.
// Returns 0..100.
function scoreNames(asciiName, candidateName) {
  const a = tokenize(asciiName);
  const c = tokenize(candidateName);
  if (!a.length || !c.length) return 0;

  // Also compare against the fully-joined candidate to catch glued surnames
  // ("BelhajSlimene" vs "Belhaj Slimene").
  const joinedA = a.join("");
  const joinedC = c.join("");
  if (joinedA === joinedC) return 100;

  const [short, long] = a.length <= c.length ? [a, c] : [c, a];
  const used = new Set();
  let total = 0;
  for (const tok of short) {
    let best = 0;
    let bestIdx = -1;
    long.forEach((other, idx) => {
      if (used.has(idx)) return;
      const s = tokenSimilarity(tok, other);
      if (s > best) {
        best = s;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) used.add(bestIdx);
    total += best;
  }
  const avg = total / short.length;
  // Penalise unmatched extra tokens a little so "Ali Ouled Bouzid" still beats
  // a random 2-token name for "Ali Bouzid", but a full match wins outright.
  const coverage = short.length / long.length;
  return Math.round(avg * 100 * (0.85 + 0.15 * coverage));
}

/**
 * Find the best pool member for an ASCII name.
 * @param {string} asciiName
 * @param {Array<{name: string, email?: string|null}>} members
 * @param {number} threshold minimum score (0..100) to accept a match
 * @returns {{member: object|null, score: number, runnerUp: {name: string, score: number}|null}}
 */
function findBestMatch(asciiName, members, threshold = 75) {
  let best = { member: null, score: 0 };
  let runnerUp = null;
  for (const member of members) {
    let score = scoreNames(asciiName, member.name);
    if (member.email) {
      const local = member.email.split("@")[0].replace(/[._-]+/g, " ");
      score = Math.max(score, scoreNames(asciiName, local));
    }
    if (score > best.score) {
      runnerUp = best.member ? { name: best.member.name, score: best.score } : runnerUp;
      best = { member, score };
    } else if (score > (runnerUp?.score ?? 0)) {
      runnerUp = { name: member.name, score };
    }
  }
  if (best.score < threshold) return { member: null, score: best.score, runnerUp: best.member ? { name: best.member.name, score: best.score } : null };
  return { member: best.member, score: best.score, runnerUp };
}

module.exports = { normalize, tokenize, levenshtein, tokenSimilarity, scoreNames, findBestMatch };
