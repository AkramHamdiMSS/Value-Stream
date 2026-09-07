import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import { SURFACE, SURFACE2, BORDER, MUTED, ACCENT, ACCENT2, GREEN, RED } from "../styles";
import { Kpi } from "../components/ui";

export default function Dashboard({ data }) {
  if (!data) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, padding: 40 }}>
        <Loader2 className="animate-spin" size={18} /> Chargement du dashboard…
      </div>
    );
  }

  const { totals, bySquad, demandByMonth, pool, overAllocGrid, alertCount, projectsCount, periods } = data;
  const chartWeeks = demandByMonth.slice(0, 16);
  const periodLabel = Object.fromEntries(periods.map((p, i) => [p, p]));

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
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
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

        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
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

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Charge par ressource et par semaine (52 semaines)</div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
          Rouge = plus de 100% cette semaine-là, tous projets confondus. Calculé automatiquement, défilement horizontal pour voir toute l'année.
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, background: SURFACE, textAlign: "left", padding: "4px 8px", color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>Ressource</th>
                {periods.map((p) => (
                  <th key={p} style={{ padding: "4px 6px", color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BORDER}`, minWidth: 40, whiteSpace: "nowrap" }}>{periodLabel[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pool.map((res) => (
                <tr key={res.id}>
                  <td style={{ position: "sticky", left: 0, background: SURFACE, padding: "3px 8px", whiteSpace: "nowrap", borderBottom: `1px solid ${BORDER}` }}>{res.name}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
