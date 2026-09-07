export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
export function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}
export function effective(count, pct) {
  const c = Number(count) || 0;
  const p = pct === "" || pct === null || pct === undefined ? 1 : Number(pct);
  return c * p;
}
