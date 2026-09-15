// The four demand/allocation "profiles" used to match supply and demand.
// Mobile and Digital squads each have exactly one sous-équipe (matching
// the squad name), but TPE has two — Android and Engage — so demand
// tracks them separately and everything matches against
// poolMember.sousEquipe (never .squad, which would conflate the two).
const PROFILE_FIELDS = [
  { profile: "Mobile", countField: "mobileCount", pctField: "mobilePct" },
  { profile: "TPE Android", countField: "tpeAndroidCount", pctField: "tpeAndroidPct" },
  { profile: "TPE Engage", countField: "tpeEngageCount", pctField: "tpeEngagePct" },
  { profile: "Digital", countField: "digitalCount", pctField: "digitalPct" },
];
const PROFILES = PROFILE_FIELDS.map((p) => p.profile);

module.exports = { PROFILES, PROFILE_FIELDS };
