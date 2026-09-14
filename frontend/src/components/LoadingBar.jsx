import { useEffect, useState } from "react";
import { subscribeLoading } from "../lib/loading";
import { ACCENT } from "../styles";

// Thin indeterminate progress bar at the top of the viewport, active
// whenever any API request is in flight (see lib/loading.js + api.js) —
// one indicator for the whole app instead of every button managing its own.
export default function LoadingBar() {
  const [active, setActive] = useState(0);
  useEffect(() => subscribeLoading(setActive), []);

  if (active === 0) return null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 2000, overflow: "hidden" }} aria-hidden="true">
      <div style={{
        position: "absolute", top: 0, left: 0, height: "100%", width: "40%", background: ACCENT,
        animation: "pilotage-loading-bar 1.1s ease-in-out infinite",
      }} />
      <style>{"@keyframes pilotage-loading-bar { 0% { transform: translateX(-100%); } 50% { transform: translateX(150%); } 100% { transform: translateX(250%); } }"}</style>
    </div>
  );
}
