// Shared client-side checks — catch obviously bad input before it reaches
// the network, with a message clear enough to act on. Not a replacement for
// server-side validation (still the source of truth, surfaced via toast on
// any API error — see api.js), just faster/friendlier feedback for the
// common mistakes.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_RE.test(value.trim());
}
