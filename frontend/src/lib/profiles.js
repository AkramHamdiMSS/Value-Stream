// Mirrors backend/src/lib/profiles.js — the four demand/allocation
// profiles. TPE splits into its two sous-équipes (Android/Engage); Mobile
// and Digital each have exactly one sous-équipe matching the squad name.
export const PROFILE_FIELDS = [
  { profile: "Mobile", countKey: "mobileCount", pctKey: "mobilePct", jiraKeyField: "jiraProjectKeyMobile" },
  { profile: "TPE Android", countKey: "tpeAndroidCount", pctKey: "tpeAndroidPct", jiraKeyField: "jiraProjectKeyTpeAndroid" },
  { profile: "TPE Engage", countKey: "tpeEngageCount", pctKey: "tpeEngagePct", jiraKeyField: "jiraProjectKeyTpeEngage" },
  { profile: "Digital", countKey: "digitalCount", pctKey: "digitalPct", jiraKeyField: "jiraProjectKeyDigital" },
];
export const PROFILES = PROFILE_FIELDS.map((p) => p.profile);
