import { Fragment, useEffect, useRef, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Loader2, ChevronDown, ChevronRight, FolderKanban, Clock, Users, Scale, ClipboardList, AlertTriangle, Percent, Gauge, UserCheck, Inbox, Unlock, FileText, CalendarOff, Timer, Battery, Activity } from "lucide-react";
import { SURFACE, SURFACE2, BORDER, MUTED, TEXT, ACCENT, ACCENT2, GREEN, AMBER, RED, CARD_SHADOW, btnGhost } from "../styles";
import { Kpi, Th, Td, Badge } from "../components/ui";

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

// ---------------------------------------------------------------- HSV / global view

function AllDashboard({ data, labelFor, onOpenProject }) {
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
  const ecart = totals.ecartTotal;
  const couverture = totals.couvertureTotal;
  const withTempo = (realizationByProfile || []).filter((r) => r.ratio != null);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Dashboard</h1>
      <p style={{ color: MUTED, fontSize: 13, margin: "0 0 20px" }}>
        Calculé en direct à partir des projets soumis, du Pool et des affectations validées, semaine par semaine sur les {planningWeeks} prochaines semaines.
        {" "}1 ETP·semaine = une personne à 100% pendant une semaine. La capacité est nette des congés validés, du temps partiel, des arrivées/départs et des jours fériés.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <Kpi label="Projets" value={projectsCount} icon={<FolderKanban size={18} />} />
        <Kpi label="Besoin soumis (ETP·sem.)" value={totals.besoinTotal} accent={ACCENT} icon={<Clock size={18} />}
          hint={totals.besoinDraftTotal > 0 ? `+ ${totals.besoinDraftTotal} en brouillon, non comptés` : undefined} />
        <Kpi label="Capacité nette (ETP·sem.)" value={totals.capTotal} icon={<Battery size={18} />} hint={`${totals.headcount} personnes · ${totals.capNow} ETP cette semaine`} />
        <Kpi label="Charge du pool" value={totals.chargeCapacitePct == null ? "—" : `${totals.chargeCapacitePct}%`} accent={totals.chargeCapacitePct > 100 ? RED : totals.chargeCapacitePct > 85 ? AMBER : GREEN} icon={<Gauge size={18} />} hint="besoin soumis / capacité nette" />
        <Kpi label="Couvert dans les bonnes semaines" value={totals.coveredTotal} accent={GREEN} icon={<Users size={18} />} hint={totals.allocTotal > totals.coveredTotal + 0.05 ? `${totals.allocTotal} alloués au total (hors besoin : ${Math.round((totals.allocTotal - totals.coveredTotal) * 10) / 10})` : undefined} />
        <Kpi label="Couverture" value={couverture == null ? "—" : `${couverture}%`} accent={couverture == null ? undefined : couverture >= 100 ? GREEN : RED} icon={<Percent size={18} />} />
        <Kpi label="Écart (ETP·sem.)" value={`${ecart > 0 ? "+" : ""}${ecart}`} accent={ecart < -0.001 ? RED : GREEN} icon={<Scale size={18} />} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Kpi label="Sur-allocations (pers. × sem.)" value={alertCount} accent={alertCount > 0 ? RED : GREEN} icon={<AlertTriangle size={18} />} hint="charge > capacité nette de la personne" />
        <Kpi label="Conflits congé / affectation" value={totals.conflictCount} accent={totals.conflictCount > 0 ? RED : GREEN} icon={<CalendarOff size={18} />} />
        <Kpi label="Écart plan / réel (Tempo)" value={totals.timesheetGapCount} accent={totals.timesheetGapCount > 0 ? RED : GREEN} icon={<Timer size={18} />} />
        <Kpi label="Disponibles cette semaine" value={totals.availableCount} accent={GREEN} icon={<UserCheck size={18} />} hint={`${totals.freeNow} ETP libres au total`} />
        <Kpi label="Utilisation du pool (semaine en cours)" value={`${totals.poolUtilizationPct}%`} accent={totals.poolUtilizationPct > 100 ? RED : undefined} icon={<Gauge size={18} />} hint="planifié / capacité nette" />
        <Kpi label="Demandes en attente de validation" value={totals.backlogCount} accent={totals.backlogCount > 0 ? AMBER : GREEN} icon={<Inbox size={18} />} />
        <Kpi label="Libérations en attente" value={totals.releasePendingCount} accent={totals.releasePendingCount > 0 ? AMBER : GREEN} icon={<Unlock size={18} />} />
        <Kpi label="Brouillons / Soumises" value={`${totals.draftCount} / ${totals.submittedCount}`} icon={<FileText size={18} />} />
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
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Besoin / Capacité nette / Alloué par profil (ETP·sem.)</div>
          <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>
            Couverture : {bySquad.map((s) => `${s.name} ${s.couverture == null ? "—" : `${s.couverture}%`}`).join(" · ")}
            <br />Charge : {bySquad.map((s) => `${s.name} ${s.charge == null ? "—" : `${s.charge}%`}`).join(" · ")}
          </div>
          <ResponsiveContainer width="100%" height={195}>
            <BarChart data={bySquad}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="name" stroke={MUTED} fontSize={11} />
              <YAxis stroke={MUTED} fontSize={11} />
              <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="besoin" name="Besoin" fill={ACCENT} radius={[4, 4, 0, 0]} />
              <Bar dataKey="capacite" name="Capacité nette" fill={GREEN} radius={[4, 4, 0, 0]} />
              <Bar dataKey="couvert" name="Couvert" fill={AMBER} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 10 }}>
            <thead>
              <tr style={{ background: SURFACE2 }}>
                <Th>Profil</Th><Th>Effectif</Th><Th>Cap. / sem.</Th><Th>Réel / planifié</Th>
              </tr>
            </thead>
            <tbody>
              {bySquad.map((s) => {
                const r = (realizationByProfile || []).find((x) => x.name === s.name);
                return (
                  <tr key={s.name} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <Td><span style={{ color: PROFILE_COLORS[s.name], fontWeight: 600 }}>{s.name}</span></Td>
                    <Td>{s.effectif}</Td>
                    <Td>{s.capaciteSemaine} ETP</Td>
                    <Td title={r?.ratio != null ? `${r.loggedHours}h loggées pour ${r.plannedHours}h planifiées (semaines passées, ressources mappées Tempo)` : "Pas de données Tempo"}>
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
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Top projets en manque</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
            Les projets soumis avec le plus grand manque (couvert − demandé, en ETP·semaines, sur les {planningWeeks} prochaines semaines). Cliquez sur un projet pour l'ouvrir.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: SURFACE2 }}>
                <Th>Projet</Th><Th>SVO</Th><Th>Statut</Th><Th>Semaines</Th><Th>Demandé</Th><Th>Couvert</Th><Th>Écart</Th>
              </tr>
            </thead>
            <tbody>
              {topProjects.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}`, cursor: "pointer" }} onClick={() => onOpenProject?.(p.id)}>
                  <Td><span style={{ fontWeight: 600 }}>{p.name}</span></Td>
                  <Td><span style={{ color: MUTED }}>{p.svo}</span></Td>
                  <Td><span style={{ color: MUTED }}>{p.status}</span></Td>
                  <Td>{p.weeks}</Td>
                  <Td>{p.demand}</Td>
                  <Td>{p.covered}<span style={{ color: MUTED, fontSize: 11.5 }}> · {p.couverture}%</span></Td>
                  <Td><span style={{ color: p.ecart < -0.001 ? RED : GREEN, fontWeight: 600 }}>{p.ecart}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ResourceLoadGrid data={data} labelFor={labelFor} onOpenProject={onOpenProject} />
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
function uniqueLeaves(entries) {
  const seen = new Map();
  for (const u of entries || []) {
    const key = u.id || `${u.type}|${u.startDate}|${u.endDate}`;
    if (!seen.has(key)) seen.set(key, u);
  }
  return [...seen.values()];
}
function leaveDetails(entries) {
  return uniqueLeaves(entries).map((u) => `${u.type} (${fmtDay(u.startDate)} → ${fmtDay(u.endDate)})`);
}

const fmtFull = (d) => new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" });
// Calendar days, inclusive — the raw span, not net of weekends/holidays
// (the capacity impact for that is shown separately).
const calendarDays = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
const LEAVE_COLORS = { refus: RED, demand: AMBER, valid: GREEN };
function leaveColor(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("refus")) return LEAVE_COLORS.refus;
  if (t.includes("demand")) return LEAVE_COLORS.demand;
  return LEAVE_COLORS.valid;
}

// Detail panel shown under a resource row when a leave cell is clicked:
// each underlying leave record once, with its exact days, source and comment,
// plus what it costs on the clicked week.
function LeaveDetailPanel({ name, periodLabel, leaves, lostToLeave, cap, load, onClose }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>
          <CalendarOff size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          {name} — semaine {periodLabel}
        </div>
        <button onClick={onClose} style={{ ...btnGhost, fontSize: 11, padding: "3px 8px" }}>Fermer</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {leaves.map((u) => (
          <div key={u.id || `${u.type}${u.startDate}`} style={{
            background: SURFACE, border: `1px solid color-mix(in srgb, ${leaveColor(u.type)} 45%, transparent)`,
            borderLeft: `4px solid ${leaveColor(u.type)}`, borderRadius: 8, padding: "8px 12px", minWidth: 260, fontSize: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: leaveColor(u.type), textTransform: "capitalize" }}>{u.type}</span>
              <Badge color={u.source === "ascii" ? ACCENT : MUTED} text={u.source === "ascii" ? "ASCII" : "Saisie manuelle"} />
            </div>
            <div>{fmtFull(u.startDate)} → {fmtFull(u.endDate)}</div>
            <div style={{ color: MUTED, marginTop: 2 }}>{calendarDays(u.startDate, u.endDate)} jour(s) calendaire(s)</div>
            {u.comment && <div style={{ marginTop: 6, fontStyle: "italic", color: MUTED }}>« {u.comment} »</div>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: MUTED }}>
        Impact cette semaine : <b style={{ color: TEXT }}>{Math.round(lostToLeave * 100)}%</b> d'absence
        {" · "}capacité nette <b style={{ color: TEXT }}>{Math.round(cap * 100)}%</b>
        {load > 0 && <>{" · "}affecté(e) à <b style={{ color: load > cap + 0.001 ? RED : TEXT }}>{Math.round(load * 100)}%</b></>}
        {lostToLeave <= 0.001 && " (congé demandé ou refusé : ne réduit pas la capacité)"}
      </div>
    </div>
  );
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

function ResourceLoadGrid({ data, labelFor, onOpenProject }) {
  const [expanded, setExpanded] = useState(null);
  const [leaveCell, setLeaveCell] = useState(null); // { resId, period }
  const [viewMode, setViewMode] = useState("plan");
  const { pool, overAllocGrid, capacityGrid, unavailableGrid, overAllocProjects, unavailableMembers, backupFor, loggedHoursGrid, workingDaysByPeriod, periods, currentPeriod } = data;
  const scrollRef = useRef(null);

  // The window now reaches 12 weeks into the past, so "today" is no longer
  // the first column — scroll it into view on load instead of burying it.
  // Centered, not aligned to the start: the sticky "Ressource" column sits
  // on top of the scroll container's left edge and would otherwise cover it.
  useEffect(() => {
    scrollRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [periods]);

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Charge par ressource et par semaine ({periods.length} semaines, historique inclus)</div>
        <div style={{ display: "flex", gap: 6 }}>
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
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
        {viewMode === "plan" && "Rouge = charge supérieure à la capacité nette de la personne cette semaine-là (temps de travail, congés validés, arrivée/départ), tous projets confondus. Ambre = congé partiel : le chiffre reste affiché."}
        {viewMode === "reel" && "Heures réellement loggées dans Tempo, tous projets confondus (nécessite une synchro depuis Pool)."}
        {viewMode === "ecart" && "Réel moins attendu (planifié × 8h × jours ouvrés de la semaine, fériés déduits), pour les semaines passées ou en cours seulement."}
        {" "}Cliquez sur une ressource pour voir le détail des projets sur lesquels elle travaille, sur une case « Congé » pour voir le détail du congé. Défilement horizontal pour voir toute l'année.
      </div>
      <div ref={scrollRef} style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, background: SURFACE, textAlign: "left", padding: "4px 8px", color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>Ressource</th>
              {periods.map((p) => (
                <th key={p} data-current={p === currentPeriod || undefined} style={{ padding: "4px 6px", color: p === currentPeriod ? ACCENT : MUTED, fontWeight: 600, borderBottom: p === currentPeriod ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`, minWidth: 40, whiteSpace: "nowrap" }}>{labelFor(p)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pool.map((res) => {
              const isOpen = expanded === res.id;
              const detail = periods
                .map((p) => ({ period: p, entries: overAllocProjects?.[`${res.id}:${p}`] || [] }))
                .filter((row) => row.entries.length > 0);
              const backupDetail = periods
                .map((p) => ({ period: p, entries: backupFor?.[res.id]?.[p] || [] }))
                .filter((row) => row.entries.length > 0);
              return (
                <Fragment key={res.id}>
                  <tr>
                    <td onClick={() => setExpanded(isOpen ? null : res.id)}
                      style={{
                        position: "sticky", left: 0, background: SURFACE, padding: "3px 8px", whiteSpace: "nowrap",
                        borderBottom: `1px solid ${BORDER}`, cursor: "pointer",
                        color: isOpen ? ACCENT : TEXT, fontWeight: isOpen ? 600 : 400,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {res.name}
                      </div>
                    </td>
                    {periods.map((p) => {
                      const v = overAllocGrid[res.id]?.[p] || 0;
                      const cap = capacityGrid?.[res.id]?.[p] ?? 1;
                      const lostToLeave = unavailableGrid?.[res.id]?.[p] || 0;
                      const unavailable = unavailableMembers?.[res.id]?.[p];
                      const backups = backupFor?.[res.id]?.[p];
                      // Staffed beyond what's really left after leave is a
                      // conflict (the allocation exists but the person won't
                      // be there for all of it) — red. A partial leave that
                      // still fits the load just tints the cell amber.
                      const over = v > cap + 0.001;
                      const conflict = !!unavailable && lostToLeave > 0 && over;
                      const fullyOff = lostToLeave >= 0.999;
                      // A backup role only gets its own flag when there's no
                      // real load/leave to show instead — it isn't an actual
                      // allocation, just "reachable if needed".
                      const backupOnly = !conflict && !unavailable && v <= 0.001 && backups?.length > 0;

                      // Congé/conflit/backup stay the same regardless of view
                      // mode (they're planning facts, not hours) — only the
                      // "nothing special" case below switches what it shows.
                      const logged = loggedHoursGrid?.[res.id]?.[p] || 0;
                      const expected = v * (STANDARD_WEEK_HOURS / 5) * (workingDaysByPeriod?.[p] ?? 5);
                      const ecart = logged - expected;
                      const ecartSignificant = expected > 0.001 && Math.abs(ecart) / expected > 0.2;
                      let normalLabel, normalColor, normalActive;
                      if (viewMode === "reel") {
                        normalActive = logged > 0.001;
                        normalLabel = normalActive ? `${Math.round(logged * 10) / 10}h` : "—";
                        normalColor = normalActive ? GREEN : MUTED;
                      } else if (viewMode === "ecart") {
                        // No Tempo mapping for this person — "no data" isn't
                        // an écart, don't flag a fake 100% gap.
                        normalActive = !!res.jiraAccountId && p <= currentPeriod && expected > 0.001;
                        normalLabel = normalActive ? `${ecart > 0 ? "+" : ""}${Math.round(ecart)}h` : "—";
                        normalColor = !normalActive ? MUTED : ecartSignificant ? RED : GREEN;
                      } else {
                        normalActive = v > 0;
                        normalLabel = normalActive ? `${Math.round(v * 100)}%` : "—";
                        normalColor = over ? RED : v > 0 ? GREEN : MUTED;
                      }

                      const pillColor = conflict ? RED : unavailable ? AMBER : backupOnly ? ACCENT2 : normalColor;
                      const pillActive = v > 0 || unavailable || backupOnly || normalActive;
                      const leaves = unavailable ? leaveDetails(unavailable).join(", ") : "";
                      const backupList = backups ? backups.map((b) => `${b.projectName} (${b.primaryName})`).join(", ") : "";
                      const capLabel = `capacité nette ${Math.round(cap * 100)}%`;
                      const tooltip = unavailable
                        ? (conflict ? `${leaves} — ${capLabel}, mais affecté(e) à ${Math.round(v * 100)}% cette semaine`
                          : `${leaves} — ${capLabel}${v > 0 ? `, affecté(e) à ${Math.round(v * 100)}%` : ""}`)
                        : backupOnly ? `Backup pour : ${backupList}`
                        : viewMode === "ecart" && normalActive ? `Planifié ${Math.round(expected)}h (${workingDaysByPeriod?.[p] ?? 5} j ouvrés) · Réel ${Math.round(logged)}h`
                        : over ? `${Math.round(v * 100)}% affecté pour ${capLabel}`
                        : cap < 0.999 ? capLabel : undefined;
                      const isLeaveOpen = leaveCell?.resId === res.id && leaveCell?.period === p;
                      return (
                        <td key={p} style={{ textAlign: "center", padding: "3px 4px", borderBottom: `1px solid ${BORDER}` }}>
                          <span title={unavailable ? `${tooltip} — cliquer pour le détail` : tooltip}
                            onClick={unavailable ? () => setLeaveCell(isLeaveOpen ? null : { resId: res.id, period: p }) : undefined}
                            style={{
                              display: "inline-block", minWidth: 40, padding: "3px 6px", borderRadius: 999,
                              border: `1px solid ${pillActive ? `color-mix(in srgb, ${pillColor} 45%, transparent)` : BORDER}`,
                              background: pillActive ? `color-mix(in srgb, ${pillColor} ${isLeaveOpen ? 28 : 12}%, transparent)` : "transparent",
                              color: pillColor, fontWeight: over || unavailable || ecartSignificant ? 700 : 500,
                              cursor: unavailable ? "pointer" : undefined,
                              outline: isLeaveOpen ? `2px solid ${pillColor}` : undefined,
                            }}>
                            {conflict ? `⚠ ${Math.round(v * 100)}%` : unavailable ? (fullyOff || v <= 0.001 ? "Congé" : `${Math.round(v * 100)}% ◐`) : backupOnly ? "Backup" : normalLabel}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  {leaveCell?.resId === res.id && unavailableMembers?.[res.id]?.[leaveCell.period] && (
                    <tr>
                      <td colSpan={periods.length + 1} style={{ background: SURFACE2, padding: 0, borderBottom: `1px solid ${BORDER}` }}>
                        {/* The row spans all 64 columns while the grid is scrolled to
                            "today" — pin the panel to the visible left edge instead. */}
                        <div style={{ position: "sticky", left: 0, display: "inline-block", maxWidth: scrollRef.current?.clientWidth || "100%", boxSizing: "border-box", padding: "10px 12px" }}>
                        <LeaveDetailPanel
                          name={res.name}
                          periodLabel={labelFor(leaveCell.period)}
                          leaves={uniqueLeaves(unavailableMembers[res.id][leaveCell.period])}
                          lostToLeave={unavailableGrid?.[res.id]?.[leaveCell.period] || 0}
                          cap={capacityGrid?.[res.id]?.[leaveCell.period] ?? 1}
                          load={overAllocGrid[res.id]?.[leaveCell.period] || 0}
                          onClose={() => setLeaveCell(null)}
                        />
                        </div>
                      </td>
                    </tr>
                  )}
                  {isOpen && (
                    <tr>
                      <td colSpan={periods.length + 1} style={{ background: SURFACE2, padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>
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
        </table>
      </div>
    </div>
  );
}
