import { Fragment, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Loader2, ChevronDown, ChevronRight, FolderKanban, CheckCircle2, Clock, Users, Scale, ClipboardList, AlertTriangle, Percent, Gauge , Inbox, Unlock, CalendarOff, Timer, Battery, Activity } from "lucide-react";
import { SURFACE, SURFACE2, BORDER, MUTED, TEXT, ACCENT, ACCENT2, GREEN, AMBER, RED, CARD_SHADOW, FONT_BODY, btnGhost } from "../styles";
import { Kpi, Th, Td, Badge, GaugeBar } from "../components/ui";

const PROFILE_COLORS = { Mobile: ACCENT2, "TPE Android": GREEN, "TPE Engage": AMBER, Digital: ACCENT };

export default function Dashboard({ data, periods: periodDefs, onOpenProject, minimalDashboard }) {
  if (!data) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, padding: 40 }}>
        <Loader2 className="animate-spin" size={18} /> Chargement du dashboard…
      </div>
    );
  }

  const periodLabel = Object.fromEntries((periodDefs || []).map((p) => [p.id, p.label]));
  const labelFor = (p) => periodLabel[p] || p;

  return data.scope === "own"
    ? <OwnDashboard data={data} labelFor={labelFor} onOpenProject={onOpenProject} minimalDashboard={minimalDashboard} />
    : <AllDashboard data={data} labelFor={labelFor} onOpenProject={onOpenProject} />;
}

// ---------------------------------------------------------------- SVO view
// Scoped to the projects they own: is what I asked for actually covered,
// and which of my projects still need attention — not the org-wide pool
// picture, which they can't act on anyway. The resource-load grid below
// is still shown though, same shared context every user gets.

function OwnDashboard({ data, labelFor, onOpenProject, minimalDashboard }) {
  const { totals, bySquad, demandByMonth, projectsCount, draftCount, submittedCount, myProjects } = data;
  const chartWeeks = demandByMonth.slice(0, 16);
  const ecart = totals.ecartTotal;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Dashboard</h1>
      <p style={{ color: MUTED, fontSize: 13, margin: "0 0 20px" }}>
        {minimalDashboard
          ? "Charge des ressources, tous projets confondus — aucune saisie ici."
          : `Calculé en direct à partir de vos projets, semaine par semaine sur les ${data.planningWeeks} prochaines semaines — 1 ETP·semaine = une personne à 100% pendant une semaine.`}
      </p>

      {!minimalDashboard && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <Kpi label="Mes projets" value={projectsCount} icon={<FolderKanban size={18} />} />
            <Kpi label="Besoin exprimé (ETP·sem.)" value={totals.besoinTotal} accent={ACCENT} icon={<Clock size={18} />} />
            <Kpi label="Couvert dans les bonnes semaines" value={totals.coveredTotal} accent={GREEN} icon={<Users size={18} />} />
            <Kpi label="Couverture" value={totals.couvertureTotal == null ? "—" : `${totals.couvertureTotal}%`} accent={totals.couvertureTotal == null ? undefined : totals.couvertureTotal >= 100 ? GREEN : RED} icon={<Percent size={18} />} />
            <Kpi label="Écart (ETP·sem.)" value={`${ecart > 0 ? "+" : ""}${ecart}`} accent={ecart < -0.001 ? RED : GREEN} icon={<Scale size={18} />} />
            <Kpi label="Demandes en brouillon" value={draftCount} accent={draftCount > 0 ? undefined : GREEN} icon={<ClipboardList size={18} />} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Mon besoin par semaine (16 premières semaines)</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartWeeks}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                  <XAxis dataKey="period" stroke={MUTED} fontSize={10} interval={1} />
                  <YAxis stroke={MUTED} fontSize={11} />
                  <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {Object.entries(PROFILE_COLORS).map(([p, color]) => (
                    <Line key={p} type="monotone" dataKey={p} stroke={color} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Besoin vs alloué par profil</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bySquad}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                  <XAxis dataKey="name" stroke={MUTED} fontSize={11} />
                  <YAxis stroke={MUTED} fontSize={11} />
                  <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="besoin" fill={ACCENT} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="alloue" fill={GREEN} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Mes projets ({projectsCount})</div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
              {submittedCount} soumis(e) · {draftCount} en brouillon. Cliquez sur un projet pour l'ouvrir.
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: SURFACE2 }}>
                  <Th>Projet</Th><Th>Statut</Th><Th>Besoin</Th><Th>Alloué</Th><Th>Couvert</Th><Th>Écart</Th><Th>Demande</Th>
                </tr>
              </thead>
              <tbody>
                {myProjects.map((p) => (
                  <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}`, cursor: "pointer" }} onClick={() => onOpenProject?.(p.id)}>
                    <Td><span style={{ fontWeight: 600 }}>{p.name}</span></Td>
                    <Td><span style={{ color: MUTED }}>{p.status}</span></Td>
                    <Td>{p.demand}</Td>
                    <Td>{p.alloc}</Td>
                    <Td>{p.covered}{p.couverture != null && <span style={{ color: MUTED, fontSize: 11.5 }}> · {p.couverture}%</span>}</Td>
                    <Td><span style={{ color: p.ecart < -0.001 ? RED : GREEN, fontWeight: 600 }}>{p.ecart}</span></Td>
                    <Td>
                      {p.demandSubmitted ? <Badge color={GREEN} text="Soumise" /> : <Badge color={MUTED} text="Brouillon" />}
                    </Td>
                  </tr>
                ))}
                {myProjects.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: MUTED }}>Aucun projet ne vous est encore assigné.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ResourceLoadGrid data={data} labelFor={labelFor} onOpenProject={onOpenProject} />
    </div>
  );
}

function pctColor(p) { return p == null ? MUTED : p >= 100 ? GREEN : p >= 70 ? AMBER : RED; }

// Problem strip on top of the HSV dashboard: strictly the things that need
// action, each card scrolls to the part of the page that shows it.
function AlertBand({ items }) {
  if (items.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: `color-mix(in srgb, ${GREEN} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${GREEN} 35%, transparent)`, borderRadius: 12, padding: "10px 14px", marginBottom: 16, color: GREEN, fontSize: 13, fontWeight: 600 }}>
        <CheckCircle2 size={16} /> Plan sain : aucune sur-allocation, conflit de congé ou besoin non couvert.
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`, gap: 12, marginBottom: 16 }}>
      {items.map((it, i) => {
        const Icon = it.icon;
        const go = it.scroll ? () => { it.then?.(); document.getElementById(it.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" }); } : undefined;
        return (
          <button key={i} onClick={go} disabled={!go} style={{
            display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: go ? "pointer" : "default",
            background: `color-mix(in srgb, ${it.color} 7%, transparent)`, border: `1px solid color-mix(in srgb, ${it.color} 35%, transparent)`,
            borderRadius: 12, padding: "12px 14px", color: it.color, fontFamily: FONT_BODY,
          }}>
            <Icon size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{it.n}</span>
            <span style={{ fontSize: 12, color: TEXT }}>{it.text}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- HSV / global view

function AllDashboard({ data, labelFor, onOpenProject }) {
  const [gridMode, setGridMode] = useState("plan");
  const { totals, bySquad, demandByMonth, allocByPeriod, capacityByPeriod, alertCount, projectsCount, topProjects, realizationByProfile, planningWeeks, currentPeriod } = data;
  const startIdx = Math.max(0, demandByMonth.findIndex((r) => r.period === currentPeriod));
  const chartWeeks = demandByMonth.slice(startIdx, startIdx + planningWeeks);
  // Demand vs net capacity vs approved allocation, totals per week — the
  // honest supply/demand picture over the planning horizon.
  const balanceWeeks = chartWeeks.map((row, i) => ({
    period: row.period,
    Besoin: row.total,
    "Capacité nette": capacityByPeriod?.[startIdx + i]?.total ?? 0,
    Alloué: allocByPeriod?.[startIdx + i]?.total ?? 0,
  }));
  const couverture = totals.couvertureTotal;
  const withTempo = (realizationByProfile || []).filter((r) => r.ratio != null);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Dashboard</h1>
      <p style={{ color: MUTED, fontSize: 13, margin: "0 0 20px" }}>
        Calculé en direct à partir des projets soumis, du Pool et des affectations validées, semaine par semaine sur les {planningWeeks} prochaines semaines.
        {" "}1 ETP·semaine = une personne à 100% pendant une semaine. La capacité est nette des congés validés, du temps partiel, des arrivées/départs et des jours fériés.
      </p>

      <AlertBand items={[
        alertCount > 0 && { n: alertCount, text: alertCount === 1 ? "sur-allocation (pers. × sem.)" : "sur-allocations (pers. × sem.)", color: RED, icon: AlertTriangle, scroll: "resource-grid", then: () => setGridMode("plan") },
        totals.conflictCount > 0 && { n: totals.conflictCount, text: "conflit(s) congé / affectation", color: RED, icon: CalendarOff, scroll: "resource-grid", then: () => setGridMode("plan") },
        totals.ecartTotal < -0.05 && { n: `${-totals.ecartTotal} ETP·sem.`, text: "de besoin non couvert à temps", color: AMBER, icon: Scale, scroll: "top-projects" },
        totals.backlogCount > 0 && { n: totals.backlogCount, text: "demande(s) à traiter dans la file", color: AMBER, icon: Inbox },
        totals.timesheetGapCount > 0 && { n: totals.timesheetGapCount, text: "écart(s) plan / réel dans Tempo", color: MUTED, icon: Timer, scroll: "resource-grid", then: () => setGridMode("ecart") },
        totals.releasePendingCount > 0 && { n: totals.releasePendingCount, text: "libération(s) en attente", color: AMBER, icon: Unlock },
      ].filter(Boolean)} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Kpi label="Projets" value={projectsCount} icon={<FolderKanban size={18} />} hint={`${totals.submittedCount} soumis · ${totals.draftCount} brouillons`} />
        <Kpi label="Besoin soumis (ETP·sem.)" value={totals.besoinTotal} accent={ACCENT} icon={<Clock size={18} />}
          hint={totals.besoinDraftTotal > 0 ? `+ ${totals.besoinDraftTotal} en brouillon, non comptés` : undefined} />
        <Kpi label="Capacité nette (ETP·sem.)" value={totals.capTotal} icon={<Battery size={18} />} hint={`${totals.headcount} personnes · ${totals.capNow} ETP cette semaine`} />
        <Kpi label="Charge du pool" value={totals.chargeCapacitePct == null ? "—" : `${totals.chargeCapacitePct}%`} accent={totals.chargeCapacitePct > 100 ? RED : totals.chargeCapacitePct > 85 ? AMBER : GREEN} icon={<Gauge size={18} />} hint="besoin soumis / capacité nette" />
        <Kpi label="Couverture à temps" value={couverture == null ? "—" : `${couverture}%`} accent={pctColor(couverture)} icon={<Percent size={18} />}
          hint={totals.allocTotal > totals.coveredTotal + 0.05 ? `${totals.coveredTotal} couverts sur ${totals.allocTotal} alloués` : undefined} />
        <Kpi label="Pool cette semaine" value={`${totals.poolUtilizationPct}%`} accent={totals.poolUtilizationPct > 100 ? RED : undefined} icon={<Users size={18} />} hint={`${totals.availableCount} présents sans charge · ${totals.freeNow} ETP libres`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Besoin vs capacité nette par semaine (ETP, {planningWeeks} prochaines semaines)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={balanceWeeks}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="period" stroke={MUTED} fontSize={10} interval={1} />
              <YAxis stroke={MUTED} fontSize={11} />
              <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Capacité nette" stroke={GREEN} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Besoin" stroke={ACCENT} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Alloué" stroke={AMBER} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, fontWeight: 600, margin: "14px 0 8px" }}>Besoin par profil et par semaine</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartWeeks}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="period" stroke={MUTED} fontSize={10} interval={1} />
              <YAxis stroke={MUTED} fontSize={11} />
              <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {Object.entries(PROFILE_COLORS).map(([p, color]) => (
                <Line key={p} type="monotone" dataKey={p} stroke={color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Profils sur les {planningWeeks} prochaines semaines</div>
          <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>
            Jauge = besoin rempli à temps (couvert). "Charge" = besoin / capacité nette disponible.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {bySquad.map((s2) => (
              <div key={s2.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: PROFILE_COLORS[s2.name] }}>{s2.name}</span>
                  <span style={{ fontSize: 11.5, color: MUTED }}>
                    {s2.effectif} pers. · {s2.capaciteSemaine} ETP/sem.
                    {s2.couverture != null && <> · <span style={{ color: pctColor(s2.couverture), fontWeight: 600 }}>couvert {s2.couverture}%</span></>}
                    {s2.charge != null && <> · <span style={{ color: s2.charge > 100 ? RED : s2.charge > 85 ? AMBER : GREEN, fontWeight: 600 }}>charge {s2.charge}%</span></>}
                  </span>
                </div>
                <GaugeBar ratio={(s2.couverture ?? 0) / 100} color={pctColor(s2.couverture)} />
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Besoin {s2.besoin} · couvert {s2.couvert} · alloué {s2.alloue} · capacité {s2.capacite} ETP·sem.</div>
              </div>
            ))}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 14 }}>
            <thead>
              <tr style={{ background: SURFACE2 }}>
                <Th>Profil</Th>
                <Th title="Heures réellement loggées / heures planifiées, semaines passées, ressources mappées Tempo.">Réel / planifié (Tempo)</Th>
              </tr>
            </thead>
            <tbody>
              {bySquad.map((s2) => {
                const r = (realizationByProfile || []).find((x) => x.name === s2.name);
                return (
                  <tr key={s2.name} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <Td><span style={{ color: PROFILE_COLORS[s2.name], fontWeight: 600 }}>{s2.name}</span></Td>
                    <Td title={r?.ratio != null ? `${r.loggedHours}h loggées pour ${r.plannedHours}h planifiées` : "Pas de données Tempo"}>
                      {r?.ratio == null ? <span style={{ color: MUTED }}>—</span>
                        : <span style={{ color: r.ratio > 1.2 ? RED : r.ratio < 0.8 ? AMBER : GREEN, fontWeight: 600 }}>×{r.ratio}</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {withTempo.length > 0 && (
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8, display: "flex", gap: 6, alignItems: "flex-start" }}>
              <Activity size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Réel / planifié &gt; 1 : ce profil consomme plus que prévu — les prochaines demandes sont probablement sous-estimées. &lt; 1 : sur-estimées ou temps non saisi.</span>
            </div>
          )}
        </div>
      </div>

      {topProjects?.length > 0 && (
        <div id="top-projects" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, boxShadow: CARD_SHADOW, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Projets en manque</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
            Besoin non rempli dans les bonnes semaines, sur les {planningWeeks} prochaines semaines (ETP·sem.) — du plus au moins exposé.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topProjects.map((pr) => {
              const ratio = pr.demand > 0 ? pr.covered / pr.demand : 0;
              return (
                <button key={pr.id} onClick={() => onOpenProject?.(pr.id)} style={{
                  display: "grid", gridTemplateColumns: "minmax(180px, 2fr) auto minmax(160px, 3fr) auto", alignItems: "center", gap: 12, textAlign: "left",
                  background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 12px", cursor: "pointer", fontFamily: FONT_BODY, color: TEXT,
                }}>
                  <span>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{pr.name}</div>
                    <div style={{ fontSize: 11.5, color: MUTED }}>{pr.svo} · {pr.status} · {pr.weeks} sem. de besoin</div>
                  </span>
                  <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>besoin {pr.demand}</span>
                  <GaugeBar ratio={ratio} color={pctColor(pr.couverture)} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: pctColor(pr.couverture), minWidth: 84, textAlign: "right" }}>{pr.couverture}% ({pr.ecart})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <span id="resource-grid" style={{ display: "contents" }}>
        <ResourceLoadGrid data={data} labelFor={labelFor} onOpenProject={onOpenProject} viewMode={gridMode} setViewMode={setGridMode} />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- shared: resource load grid
// "Charge par ressource et par semaine" — shown to every authenticated user
// (HSV and SVO alike), since knowing who's already loaded is useful context
// regardless of what you personally manage. Click a resource to expand the
// projects behind their load, per week.

const fmtDay = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
// A leave spanning several weeks shows up once per week in unavailableMembers —
// dedupe back down to the underlying records so the tooltip lists each leave
// once, with its actual days, not one entry per week it touches.
function leaveDetails(entries) {
  const seen = new Map();
  for (const u of entries || []) {
    const key = `${u.type}|${u.startDate}|${u.endDate}`;
    if (!seen.has(key)) seen.set(key, `${u.type} (${fmtDay(u.startDate)} → ${fmtDay(u.endDate)})`);
  }
  return [...seen.values()];
}

// Matches lib/tempo.js's STANDARD_WEEK_HOURS on the backend — kept as a
// plain local constant here rather than threaded through the API response,
// same scale of duplication as other small display constants in this file.
const STANDARD_WEEK_HOURS = 40;
const VIEW_MODES = [
  { value: "plan", label: "Planifié" },
  { value: "reel", label: "Réel (Tempo)" },
  { value: "ecart", label: "Écart" },
];

const CELL_ZOOMS = [
  { key: "s", label: "S", width: 34, showLabel: false },
  { key: "m", label: "M", width: 48, showLabel: true },
  { key: "l", label: "L", width: 74, showLabel: true },
];
const RANGE_WINDOWS = [
  { key: 13, label: "13 sem." },
  { key: 26, label: "26 sem." },
  { key: 0, label: "Tout" },
];
const HATCH = "repeating-linear-gradient(45deg, transparent 0 3px, currentColor 3px 4px)";

function round1(n) { return Math.round(n * 10) / 10; }

// One week cell as a capacity bar: track = the person's net capacity that
// week, fill = planned load, red = the part overflowing the capacity, amber
// hatch = leave actually eating part of the week. The number stays readable
// on top when the zoom level has room for it.
function CapacityCell({ width, showLabel, load, cap, leaveFrac, hasPendingLeave, backupOnly, tooltip }) {
  const loadPct100 = cap > 0.001 ? (load / cap) * 100 : load > 0.001 ? 100 : 0;
  const fillPct100 = Math.min(100, loadPct100);
  const over = load > cap + 0.001;
  const color = over ? RED : leaveFrac > 0 ? AMBER : load > 0.001 ? GREEN : MUTED;
  const label = load > 0.001 ? `${Math.round(load * 100)}%` : "";
  return (
    <div style={{ position: "relative", width, height: 22, margin: "0 auto", borderRadius: 5, overflow: "hidden", background: `color-mix(in srgb, ${MUTED} ${cap > 0.001 ? 14 : 6}%, transparent)` }} title={tooltip}>
      {leaveFrac > 0 && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, leaveFrac * 100)}%`, color: AMBER, backgroundImage: HATCH, opacity: 0.5 }} />
      )}
      {load > 0.001 && !over && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fillPct100}%`, background: color, opacity: 0.3 }} />
      )}
      {over && (
        <>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fillPct100}%`, background: RED, opacity: 0.35 }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: RED }} />
        </>
      )}
      {showLabel && (label !== "" || over) && (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: over ? 700 : 500, color: leaveFrac > 0 || over ? color : TEXT }}>
          {label}{over ? " ▲" : ""}{hasPendingLeave ? " ?" : ""}
        </span>
      )}
      {!showLabel && (over || hasPendingLeave) && (
        <span style={{ position: "absolute", top: 1, right: 2, width: 5, height: 5, borderRadius: 999, background: over ? RED : AMBER }} />
      )}
      {backupOnly && (
        <div style={{ position: "absolute", inset: 0, border: `1px dashed ${ACCENT2}`, borderRadius: 5 }} />
      )}
    </div>
  );
}

function ResourceLoadGrid({ data, labelFor, onOpenProject, viewMode: controlledMode, setViewMode: controlledSetMode }) {
  const [expanded, setExpanded] = useState(null);
  const [localMode, setLocalMode] = useState("plan");
  const viewMode = controlledMode ?? localMode;
  const setViewMode = controlledSetMode ?? setLocalMode;
  const { pool, overAllocGrid, capacityGrid, unavailableGrid, overAllocProjects, unavailableMembers, backupFor, loggedHoursGrid, workingDaysByPeriod, periods, currentPeriod } = data;

  // Window + zoom + profile filter: default to a quarter around this week
  // instead of the 64-week wall of numbers.
  const curIdx = Math.max(0, periods.indexOf(currentPeriod));
  const [windowSize, setWindowSize] = useState(13);
  const [offset, setOffset] = useState(0);
  const [zoomKey, setZoomKey] = useState("m");
  const [profileFilter, setProfileFilter] = useState("Tous");
  const zoom = CELL_ZOOMS.find((z) => z.key === zoomKey) || CELL_ZOOMS[1];

  const startIdx = windowSize === 0 ? 0 : Math.min(Math.max(0, curIdx - 4 + offset), Math.max(0, periods.length - windowSize));
  const shown = windowSize === 0 ? periods : periods.slice(startIdx, startIdx + windowSize);
  const shownPool = profileFilter === "Tous" ? pool : pool.filter((m) => m.sousEquipe === profileFilter);

  // Footer per week — answers "is there room this week?" at a glance.
  const ratioFor = (p) => {
    let l = 0, c = 0, logged = 0, expected = 0;
    for (const m of shownPool) {
      const load = overAllocGrid[m.id]?.[p] || 0;
      l += load;
      c += capacityGrid?.[m.id]?.[p] ?? 1;
      logged += loggedHoursGrid?.[m.id]?.[p] || 0;
      expected += load * 8 * (workingDaysByPeriod?.[p] ?? 5);
    }
    return viewMode === "reel" ? { v: logged, suffix: "h", over: false }
      : viewMode === "ecart" ? { v: logged - expected, suffix: "h", over: false }
      : { v: c > 0.001 ? (100 * l) / c : 0, suffix: "%", over: c > 0.001 && l > c + 0.001 };
  };

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Charge par ressource et par semaine</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {["Tous", ...Object.keys(PROFILE_COLORS)].map((name) => (
            <button key={name} onClick={() => setProfileFilter(name)} style={{
              border: `1px solid ${profileFilter === name ? PROFILE_COLORS[name] || ACCENT : BORDER}`, borderRadius: 999, padding: "3px 10px",
              background: profileFilter === name ? `color-mix(in srgb, ${PROFILE_COLORS[name] || ACCENT} 14%, transparent)` : "transparent",
              color: profileFilter === name ? (PROFILE_COLORS[name] || ACCENT) : MUTED, fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
              {name}
            </button>
          ))}
          <span style={{ width: 1, height: 18, background: BORDER }} />
          {RANGE_WINDOWS.map((w) => (
            <button key={w.key} onClick={() => { setWindowSize(w.key); setOffset(0); }} style={{ ...btnGhost, fontSize: 11, padding: "4px 9px", ...(windowSize === w.key ? { background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, color: ACCENT, borderColor: ACCENT } : {}) }}>
              {w.label}
            </button>
          ))}
          {windowSize !== 0 && (
            <>
              <button aria-label="Périodes précédentes" onClick={() => setOffset((o) => Math.max(-(curIdx - 4), o - windowSize))} style={{ ...btnGhost, padding: "4px 8px" }}><ChevronRight size={13} style={{ transform: "rotate(180deg)" }} /></button>
              <button aria-label="Périodes suivantes" onClick={() => setOffset((o) => Math.min(Math.max(0, periods.length - windowSize - (curIdx - 4)), o + windowSize))} style={{ ...btnGhost, padding: "4px 8px" }}><ChevronRight size={13} /></button>
            </>
          )}
          <span style={{ width: 1, height: 18, background: BORDER }} />
          {CELL_ZOOMS.map((z) => (
            <button key={z.key} onClick={() => setZoomKey(z.key)} style={{ ...btnGhost, fontSize: 10.5, padding: "3px 7px", textTransform: "uppercase", ...(zoomKey === z.key ? { background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, color: ACCENT, borderColor: ACCENT } : {}) }}>
              {z.label}
            </button>
          ))}
          <span style={{ width: 1, height: 18, background: BORDER }} />
          {VIEW_MODES.map((m) => (
            <button key={m.value} onClick={() => setViewMode(m.value)} style={{
              ...btnGhost, fontSize: 11, padding: "4px 9px",
              ...(viewMode === m.value ? { background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, color: ACCENT, borderColor: ACCENT } : {}),
            }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {/* legend — what the visuals mean, no hovering random cells required */}
      <div style={{ fontSize: 11.5, color: MUTED, display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 22, height: 10, borderRadius: 3, background: `color-mix(in srgb, ${GREEN} 30%, transparent)` }} /> charge planifiée</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ position: "relative", width: 22, height: 10, borderRadius: 3, background: `color-mix(in srgb, ${MUTED} 14%, transparent)` }}><span style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2.5, background: RED }} /></span> surcharge</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 22, height: 10, borderRadius: 3, color: AMBER, backgroundImage: HATCH, opacity: 0.7 }} /> congé (partie hachurée)</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 22, height: 10, borderRadius: 3, border: `1px dashed ${ACCENT2}` }} /> backup (ne compte pas)</span>
        <span>Fond gris = capacité nette restante.</span>
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
        {viewMode === "reel" && "Mode Réel : heures Tempo loggées tous projets (synchronisées depuis Pool)."}
        {viewMode === "ecart" && "Mode Écart : réel moins attendu (planifié × 8h × jours ouvrés, fériés déduits), semaines passées seulement."}
        {viewMode === "plan" && "Cliquez sur une ressource pour voir ses projets semaine par semaine."}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, background: SURFACE, textAlign: "left", padding: "4px 8px", color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BORDER}`, zIndex: 2 }}>Ressource</th>
              {shown.map((p) => (
                <th key={p} data-current={p === currentPeriod || undefined} style={{ padding: "4px 4px", color: p === currentPeriod ? ACCENT : MUTED, fontWeight: 600, borderBottom: p === currentPeriod ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`, minWidth: zoom.width, whiteSpace: "nowrap", fontSize: 10.5 }}>{labelFor(p)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownPool.map((res) => {
              const isOpen = expanded === res.id;
              const detail = shown
                .map((p) => ({ period: p, entries: overAllocProjects?.[`${res.id}:${p}`] || [] }))
                .filter((row) => row.entries.length > 0);
              const backupDetail = shown
                .map((p) => ({ period: p, entries: backupFor?.[res.id]?.[p] || [] }))
                .filter((row) => row.entries.length > 0);
              return (
                <Fragment key={res.id}>
                  <tr>
                    <td onClick={() => setExpanded(isOpen ? null : res.id)}
                      style={{
                        position: "sticky", left: 0, background: SURFACE, padding: "3px 8px", whiteSpace: "nowrap",
                        borderBottom: `1px solid ${BORDER}`, cursor: "pointer", zIndex: 1,
                        color: isOpen ? ACCENT : TEXT, fontWeight: isOpen ? 600 : 400,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span>{res.name}</span>
                        {(res.capacityPct ?? 1) < 1 && <span style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "0 4px" }}>{Math.round(res.capacityPct * 100)}%</span>}
                      </div>
                      <div style={{ fontSize: 10, color: MUTED }}>{res.sousEquipe}</div>
                    </td>
                    {shown.map((p) => {
                      const v = overAllocGrid[res.id]?.[p] || 0;
                      const cap = capacityGrid?.[res.id]?.[p] ?? 1;
                      const lostToLeave = unavailableGrid?.[res.id]?.[p] || 0;
                      const unavailable = unavailableMembers?.[res.id]?.[p];
                      const backups = backupFor?.[res.id]?.[p];
                      const backupOnly = v <= 0.001 && !unavailable && backups?.length > 0;

                      const logged = loggedHoursGrid?.[res.id]?.[p] || 0;
                      const expected = v * (STANDARD_WEEK_HOURS / 5) * (workingDaysByPeriod?.[p] ?? 5);

                      const leaves = unavailable ? leaveDetails(unavailable).join(", ") : "";
                      const pendingOnly = !!unavailable && lostToLeave <= 0.001;
                      if (viewMode === "reel") {
                        const active = logged > 0.001;
                        return (
                          <td key={p} style={{ textAlign: "center", padding: "3px 4px", borderBottom: `1px solid ${BORDER}` }}>
                            <span title={active ? `${round1(logged)}h loggées` : undefined} style={{ display: "inline-block", minWidth: zoom.width - 10, padding: "3px 6px", borderRadius: 999, border: `1px solid ${active ? `color-mix(in srgb, ${GREEN} 45%, transparent)` : BORDER}`, background: active ? `color-mix(in srgb, ${GREEN} 12%, transparent)` : "transparent", color: active ? GREEN : MUTED, fontWeight: 500 }}>
                              {active ? `${round1(logged)}h` : "—"}
                            </span>
                          </td>
                        );
                      }
                      if (viewMode === "ecart") {
                        const active = !!res.jiraAccountId && p <= currentPeriod && expected > 0.001;
                        const ecart = logged - expected;
                        const significant = active && Math.abs(ecart) / expected > 0.2;
                        return (
                          <td key={p} style={{ textAlign: "center", padding: "3px 4px", borderBottom: `1px solid ${BORDER}` }}>
                            <span title={active ? `Planifié ${Math.round(expected)}h (${workingDaysByPeriod?.[p] ?? 5} j ouvrés) · Réel ${Math.round(logged)}h` : undefined} style={{ display: "inline-block", minWidth: zoom.width - 10, padding: "3px 6px", borderRadius: 999, border: `1px solid ${active ? `color-mix(in srgb, ${significant ? RED : GREEN} 45%, transparent)` : BORDER}`, background: active ? `color-mix(in srgb, ${significant ? RED : GREEN} 12%, transparent)` : "transparent", color: !active ? MUTED : significant ? RED : GREEN, fontWeight: significant ? 700 : 500 }}>
                              {active ? `${ecart > 0 ? "+" : ""}${Math.round(ecart)}h` : "—"}
                            </span>
                          </td>
                        );
                      }
                      const capLabel = `capacité nette ${Math.round(cap * 100)}%${lostToLeave > 0 ? ` (${Math.round(lostToLeave * 100)}% en congé)` : ""}`;
                      const tooltip = [leaves, backupOnly ? `Backup pour : ${backups.map((b) => `${b.projectName} (${b.primaryName})`).join(", ")}` : null, `${Math.round(v * 100)}% affecté pour ${capLabel}${pendingOnly ? " — demande RH en attente" : ""}`].filter(Boolean).join("\n");
                      return (
                        <td key={p} style={{ textAlign: "center", padding: "3px 4px", borderBottom: `1px solid ${BORDER}` }}>
                          <CapacityCell width={zoom.width - 8} showLabel={zoom.showLabel}
                            load={v} cap={cap} leaveFrac={lostToLeave}
                            hasPendingLeave={pendingOnly} backupOnly={backupOnly} tooltip={tooltip} />
                        </td>
                      );
                    })}
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={shown.length + 1} style={{ background: SURFACE2, padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>
                        {detail.length === 0 && backupDetail.length === 0 ? (
                          <span style={{ color: MUTED, fontSize: 12 }}>Aucune affectation pour {res.name}.</span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {detail.map((row) => row.entries.map((e) => (
                              <button key={row.period + e.projectId} onClick={() => onOpenProject?.(e.projectId)} style={{
                                background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20,
                                color: TEXT, fontSize: 11.5, padding: "4px 10px", cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 6,
                              }}>
                                <span style={{ color: MUTED }}>{labelFor(row.period)}</span>
                                <span style={{ fontWeight: 600 }}>{e.projectName}</span>
                                <span style={{ color: ACCENT }}>{Math.round(e.pct * 100)}%</span>
                                {e.backupName && <span style={{ color: MUTED }}>· backup: {e.backupName}</span>}
                              </button>
                            )))}
                            {backupDetail.map((row) => row.entries.map((e) => (
                              <button key={`backup-${row.period}-${e.projectId}`} onClick={() => onOpenProject?.(e.projectId)} style={{
                                background: SURFACE, border: `1px dashed color-mix(in srgb, ${ACCENT2} 55%, transparent)`, borderRadius: 20,
                                color: TEXT, fontSize: 11.5, padding: "4px 10px", cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 6,
                              }}>
                                <span style={{ color: MUTED }}>{labelFor(row.period)}</span>
                                <span style={{ color: ACCENT2, fontWeight: 600 }}>Backup</span>
                                <span style={{ fontWeight: 600 }}>{e.projectName}</span>
                                <span style={{ color: MUTED }}>pour {e.primaryName}</span>
                              </button>
                            )))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ position: "sticky", left: 0, background: SURFACE2, fontWeight: 700, color: MUTED, fontSize: 11.5, padding: "6px 8px", borderTop: `1px solid ${BORDER}` }}>
                Charge du pool{profileFilter !== "Tous" ? ` (${profileFilter})` : ""}
              </td>
              {shown.map((p) => {
                const t = ratioFor(p);
                const label = t.suffix === "%" ? `${Math.round(t.v)}%` : t.v !== 0 ? `${viewMode === "ecart" && t.v > 0 ? "+" : ""}${Math.round(round1(t.v))}h` : "—";
                return (
                  <td key={p} data-current={p === currentPeriod || undefined} style={{ textAlign: "center", borderTop: `1px solid ${BORDER}`, background: SURFACE2, padding: "4px 2px" }}>
                    <span title={viewMode === "plan" ? `charge planifiée ${Math.round(t.v)}% de la capacité nette du pool` : undefined}
                      style={{ fontSize: 10.5, fontWeight: 700, color: t.over ? RED : t.v > 0 ? GREEN : MUTED }}>
                      {label}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
