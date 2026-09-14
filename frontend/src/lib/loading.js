// Same pub-sub pattern as toast.js, tracking how many API requests are in
// flight so a single global indicator (see LoadingBar) can reflect activity
// from any screen without each one managing its own loading state.
let count = 0;
let listeners = [];

export function subscribeLoading(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export function incLoading() {
  count += 1;
  listeners.forEach((fn) => fn(count));
}

export function decLoading() {
  count = Math.max(0, count - 1);
  listeners.forEach((fn) => fn(count));
}
