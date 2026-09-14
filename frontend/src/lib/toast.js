// Tiny pub-sub so any module can raise a user-visible alert without prop
// drilling a callback through every screen — api.js uses this to surface
// every failed request platform-wide, and any screen can call it directly
// for its own validation messages.
let listeners = [];
let idCounter = 0;

export function subscribeToast(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export function showToast(message, type = "error") {
  const toast = { id: ++idCounter, message, type };
  listeners.forEach((fn) => fn(toast));
}
