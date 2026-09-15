// Mirrors backend/src/lib/profiles.js — the four demand/allocation
// profiles. TPE splits into its two sous-équipes (Android/Engage); Mobile
// and Digital each have exactly one sous-équipe matching the squad name.
export const PROFILE_FIELDS = [
  { profile: "Mobile", countKey: "mobileCount", pctKey: "mobilePct" },
  { profile: "TPE Android", countKey: "tpeAndroidCount", pctKey: "tpeAndroidPct" },
  { profile: "TPE Engage", countKey: "tpeEngageCount", pctKey: "tpeEngagePct" },
  { profile: "Digital", countKey: "digitalCount", pctKey: "digitalPct" },
];
export const PROFILES = PROFILE_FIELDS.map((p) => p.profile);
