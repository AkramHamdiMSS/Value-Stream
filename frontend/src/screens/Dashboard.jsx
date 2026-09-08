import { Fragment, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { SURFACE, SURFACE2, BORDER, MUTED, TEXT, ACCENT, ACCENT2, GREEN, RED, CARD_SHADOW } from "../styles";
import { Kpi, Th, Td, Badge } from "../components/ui";

export default function Dashboard({ data, periods: periodDefs, onOpenProject }) {
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
    ? <OwnDashboard data={data} labelFor={labelFor} onOpenProject={onOpenProject} />
    : <AllDashboard data={data} labelFor={labelFor} onOpenProject={onOpenProject} />;
}

// ---------------------------------------------------------------- SVO view
// Scoped to the projects they own: is what I asked for actually covered,
// and which of my projects still need attention — not the org-wide pool
// picture, which they can't act on anyway. The resource-load grid below
// is still shown though, same shared context every user gets.

function OwnDashboard({ data, labelFor, onOpenProject }) {
  const { totals, bySquad, demandByMonth, projectsCount, draftCount, submittedCount, myProjects } = data;
  const chartWeeks = demandByMonth.slice(0, 16);
  const ecart = totals.ecartTotal;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Dashboard</h1>
      <p style={{ color: MUTED, fontSize: 13, margin: "0 0 20px" }}>
        Calculé en direct à partir de vos projets — aucune saisie ici.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Kpi label="Mes projets" value={projectsCount} />
        <Kpi label="Besoin exprimé (pers.)" value={totals.besoinTotal} accent={ACCENT} />
        <Kpi label="Alloué (pers.)" value={totals.allocTotal} accent={GREEN} />
        <Kpi label="Écart" value={`${ecart > 0 ? "+" : ""}${ecart}`} accent={ecart < -0.001 ? RED : GREEN} />
        <Kpi label="Demandes en brouillon" value={draftCount} accent={draftCount > 0 ? undefined : GREEN} />
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
              <Line type="monotone" dataKey="Mobile" stroke={ACCENT2} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="TPE" stroke={GREEN} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Digital" stroke={ACCENT} strokeWidth={2} dot={false} />
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
              <Th>Projet</Th><Th>Statut</Th><Th>Besoin</Th><Th>Alloué</Th><Th>Écart</Th><Th>Demande</Th>
            </tr>
          </thead>
          <tbody>
            {myProjects.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}`, cursor: "pointer" }} onClick={() => onOpenProject?.(p.id)}>
                <Td><span style={{ fontWeight: 600 }}>{p.name}</span></Td>
                <Td><span style={{ color: MUTED }}>{p.status}</span></Td>
                <Td>{p.demand}</Td>
                <Td>{p.alloc}</Td>
                <Td><span style={{ color: p.ecart < -0.001 ? RED : GREEN, fontWeight: 600 }}>{p.ecart}</span></Td>
                <Td>
                  {p.demandSubmitted ? <Badge color={GREEN} text="Soumise" /> : <Badge color={MUTED} text="Brouillon" />}
                </Td>
              </tr>
            ))}
            {myProjects.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: MUTED }}>Aucun projet ne vous est encore assigné.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ResourceLoadGrid data={data} labelFor={labelFor} onOpenProject={onOpenProject} />
    </div>
  );
}

// ---------------------------------------------------------------- HSV / global view

function AllDashboard({ data, labelFor, onOpenProject }) {
  const { totals, bySquad, demandByMonth, alertCount, projectsCount } = data;
  const chartWeeks = demandByMonth.slice(0, 16);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Dashboard</h1>
      <p style={{ color: MUTED, fontSize: 13, margin: "0 0 20px" }}>
        Calculé en direct à partir des projets, du Pool et des affectations — aucune saisie ici.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Kpi label="Projets" value={projectsCount} />
        <Kpi label="Besoin total (pers.)" value={totals.besoinTotal} accent={ACCENT} />
        <Kpi label="Capacité pool" value={totals.capTotal} accent={GREEN} />
        <Kpi label="Ressources en sur-allocation" value={alertCount} accent={alertCount > 0 ? RED : GREEN} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Besoin par semaine (16 premières semaines)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartWeeks}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="period" stroke={MUTED} fontSize={10} interval={1} />
              <YAxis stroke={MUTED} fontSize={11} />
              <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Mobile" stroke={ACCENT2} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="TPE" stroke={GREEN} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Digital" stroke={ACCENT} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Besoin vs capacité par squad</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bySquad}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="name" stroke={MUTED} fontSize={11} />
              <YAxis stroke={MUTED} fontSize={11} />
              <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="besoin" fill={ACCENT} radius={[4, 4, 0, 0]} />
              <Bar dataKey="capacite" fill={GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ResourceLoadGrid data={data} labelFor={labelFor} onOpenProject={onOpenProject} />
    </div>
  );
}

// ---------------------------------------------------------------- shared: resource load grid
// "Charge par ressource et par semaine" — shown to every authenticated user
// (HSV and SVO alike), since knowing who's already loaded is useful context
// regardless of what you personally manage. Click a resource to expand the
// projects behind their load, per week.

function ResourceLoadGrid({ data, labelFor, onOpenProject }) {
  const [expanded, setExpanded] = useState(null);
  const { pool, overAllocGrid, overAllocProjects, periods } = data;

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: CARD_SHADOW }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Charge par ressource et par semaine (52 semaines)</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
        Rouge = plus de 100% cette semaine-là, tous projets confondus. Cliquez sur une ressource pour voir le détail
        des projets sur lesquels elle travaille. Défilement horizontal pour voir toute l'année.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, background: SURFACE, textAlign: "left", padding: "4px 8px", color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>Ressource</th>
              {periods.map((p) => (
                <th key={p} style={{ padding: "4px 6px", color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BORDER}`, minWidth: 40, whiteSpace: "nowrap" }}>{labelFor(p)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pool.map((res) => {
              const isOpen = expanded === res.id;
              const detail = periods
                .map((p) => ({ period: p, entries: overAllocProjects?.[`${res.id}:${p}`] || [] }))
                .filter((row) => row.entries.length > 0);
              return (
                <Fragment key={res.id}>
                  <tr>
                    <td onClick={() => setExpanded(isOpen ? null : res.id)}
                      style={{
                        position: "sticky", left: 0, background: SURFACE, padding: "3px 8px", whiteSpace: "nowrap",
                        borderBottom: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                        color: isOpen ? ACCENT : TEXT, fontWeight: isOpen ? 600 : 400,
                      }}>
                      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {res.name}
                    </td>
                    {periods.map((p) => {
                      const v = overAllocGrid[res.id]?.[p] || 0;
                      const over = v > 1.001;
                      return (
                        <td key={p} style={{
                          textAlign: "center", padding: "3px 6px", borderBottom: `1px solid ${BORDER}`,
                          background: over ? `color-mix(in srgb, ${RED} 22%, transparent)` : v > 0 ? `color-mix(in srgb, ${GREEN} 15%, transparent)` : "transparent",
                          color: over ? RED : v > 0 ? GREEN : MUTED, fontWeight: over ? 700 : 400,
                        }}>
                          {v > 0 ? `${Math.round(v * 100)}%` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={periods.length + 1} style={{ background: SURFACE2, padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>
                        {detail.length === 0 ? (
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
