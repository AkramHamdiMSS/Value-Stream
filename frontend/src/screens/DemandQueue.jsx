import { Fragment, useEffect, useState } from "react";
import { Loader2, BellRing, Check, List, Columns3 } from "lucide-react";
import { api } from "../api";
import { showToast } from "../lib/toast";
import { SURFACE, SURFACE2, BORDER, MUTED, ACCENT, GREEN, AMBER, RED, CARD_SHADOW, btnGhost } from "../styles";
import { Th, Td, GaugeBar } from "../components/ui";

// Two faces of the same rows: a 4-column workflow board (the view an admin
// actually works in) and the detailed table kept for analysis/export-style
// reading. Statuses must stay in sync with buildDemandQueueRows().
const COLUMNS = [
  { value: "untreated", label: "Non traitées", hint: "Personne ne s'en occupe", color: AMBER },
  { value: "proposed", label: "Proposées", hint: "en attente de validation HSV", color: ACCENT },
  { value: "partial", label: "Partielles", hint: "certaines semaines couvertes", color: "#c26a00" },
  { value: "validated", label: "Couvertes", hint: "toutes les semaines staffées", color: GREEN },
];
const STATUS_FILTERS = [{ value: "all", label: "Toutes" }, ...COLUMNS.map((c) => ({ value: c.value, label: c.label }))];
const STATUS_BADGE = {
  untreated: { color: AMBER, text: "Non traitée" },
  proposed: { color: ACCENT, text: "Team Lead ✓ (1/2)" },
  partial: { color: "#c26a00", text: "Partielle" },
  validated: { color: GREEN, text: "Admin ✓✓ (2/2)" },
};
const PROFILE_COLORS = { Mobile: ACCENT, "TPE Android": GREEN, "TPE Engage": AMBER, Digital: "var(--accent-2)" };

function covColor(p) { return p >= 100 ? GREEN : p > 0 ? "#c26a00" : MUTED; }

function DemandCard({ row, canManageAllocations, onOpenProject, sent, sending, onRemind }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <button onClick={() => onOpenProject(row.projectId)} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, textAlign: "left" }}>
          {row.projectName}
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, color: PROFILE_COLORS[row.profile] || MUTED, whiteSpace: "nowrap" }}>{row.profile}</span>
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
        {row.svo} · {row.periodStart === row.periodEnd ? row.periodStart : `${row.periodStart} → ${row.periodEnd}`} · besoin {row.demanded} ETP/sem.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <GaugeBar ratio={row.demanded > 0 ? row.covered / row.demanded : 0} color={covColor(row.couverture)} height={5} />
        <span style={{ fontSize: 11, color: covColor(row.couverture), fontWeight: 700, whiteSpace: "nowrap" }}>
          {row.couverture}% · {row.coveredWeeks}/{row.weeks} sem.
        </span>
      </div>
      {canManageAllocations && row.status === "untreated" && (
        <div style={{ marginTop: 8 }}>
          {sent ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: GREEN, fontSize: 12, fontWeight: 600 }}><Check size={13} /> Rappel envoyé</span>
          ) : (
            <button onClick={() => onRemind(row)} disabled={sending} style={{
              ...btnGhost, fontSize: 11, padding: "4px 9px", display: "flex", alignItems: "center", gap: 5,
              opacity: sending ? 0.6 : 1, cursor: sending ? "not-allowed" : "pointer",
            }}>
              {sending ? <Loader2 className="animate-spin" size={12} /> : <BellRing size={12} />} Relancer le Team Lead
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DemandQueue({ canManageAllocations, onOpenProject, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [view, setView] = useState("board"); // board | table
  const [hideCovered, setHideCovered] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [sendingKey, setSendingKey] = useState(null);
  const [sentKeys, setSentKeys] = useState(() => new Set());

  const load = () => {
    api.get("/demand-queue").then(setRows).catch((e) => setError(e.message));
  };
  useEffect(load, [refreshKey]);

  const sendReminder = async (row) => {
    setSendingKey(row.key);
    try {
      const { sentTo } = await api.post(`/demand-queue/${encodeURIComponent(row.key)}/remind`);
      setSentKeys((prev) => new Set(prev).add(row.key));
      showToast(
        sentTo > 0
          ? `Rappel envoyé à ${sentTo} Team Lead${sentTo > 1 ? "s" : ""} (${row.profile}).`
          : `Aucun Team Lead configuré pour ${row.profile} — rappel non envoyé.`,
        sentTo > 0 ? "success" : "error"
      );
    } catch {
      // api.js already toasts the error.
    } finally {
      setSendingKey(null);
    }
  };

  if (!rows) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, padding: 40 }}><Loader2 className="animate-spin" size={18} /> Chargement…</div>;
  }

  const visibleRows = rows.filter((r) => !hideCovered || r.ecart < -0.001);
  const filteredRows = visibleRows.filter((r) => statusFilter === "all" || r.status === statusFilter);
  const rangeLabel = (row) => (row.periodStart === row.periodEnd ? row.periodStart : `${row.periodStart} → ${row.periodEnd}`);

  // One "demande" is submitted per project+période, with one line per profile —
  // group them back into a single row for the table view.
  const groups = [];
  const groupIndexByKey = {};
  for (const row of filteredRows) {
    const gKey = `${row.projectId}:${row.periodStart}:${row.periodEnd}`;
    if (!(gKey in groupIndexByKey)) {
      groupIndexByKey[gKey] = groups.length;
      groups.push({ key: gKey, projectId: row.projectId, projectName: row.projectName, svo: row.svo, periodLabel: rangeLabel(row), rows: [] });
    }
    groups[groupIndexByKey[gKey]].rows.push(row);
  }
  groups.sort((a, b) => Math.min(...a.rows.map((r) => r.ecart)) - Math.min(...b.rows.map((r) => r.ecart)));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{canManageAllocations ? "Demandes à affecter" : "Demandes de mon équipe"}</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ v: "board", label: "Tableau", icon: Columns3 }, { v: "table", label: "Liste", icon: List }].map(({ v, label, icon: I }) => (
            <button key={v} onClick={() => setView(v)} style={{
              ...btnGhost, fontSize: 11.5, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5,
              ...(view === v ? { background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, color: ACCENT, borderColor: ACCENT } : {}),
            }}>
              <I size={13} /> {label}
            </button>
          ))}
        </div>
      </div>
      <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 16px" }}>
        {canManageAllocations
          ? "Toutes les demandes soumises par les SVO. Le tableau suit le flux de traitement : non traitée → proposée → partielle → couverte."
          : "Demandes soumises pour votre profil, tous projets confondus. Vos propositions seront à valider par le Head of Value Stream."}
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)} style={{
            ...btnGhost, fontSize: 11.5, padding: "5px 10px",
            ...(statusFilter === f.value ? { background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, color: ACCENT, borderColor: ACCENT } : {}),
          }}>
            {f.label}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: MUTED, marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={hideCovered} onChange={(e) => setHideCovered(e.target.checked)} />
        Masquer les besoins déjà entièrement couverts
      </label>

      {error && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

      {view === "board" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, alignItems: "start" }}>
          {(statusFilter === "all" ? COLUMNS : COLUMNS.filter((c) => c.value === statusFilter)).map((col) => {
            const colRows = visibleRows.filter((r) => r.status === col.value).sort((a, b) => a.ecart - b.ecart);
            return (
              <div key={col.value} style={{ background: SURFACE2, borderRadius: 12, padding: 10, border: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "2px 4px 8px" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</div>
                    <div style={{ fontSize: 10.5, color: MUTED }}>{col.hint}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "1px 8px" }}>
                    {colRows.length}
                  </span>
                </div>
                {colRows.map((row) => (
                  <DemandCard key={row.key} row={row} canManageAllocations={canManageAllocations}
                    onOpenProject={onOpenProject} sent={sentKeys.has(row.key)} sending={sendingKey === row.key} onRemind={sendReminder} />
                ))}
                {colRows.length === 0 && <div style={{ color: MUTED, fontSize: 11.5, padding: "10px 4px" }}>—</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: CARD_SHADOW }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: SURFACE2 }}>
                <Th>Projet</Th><Th>SVO</Th><Th>Période</Th><Th>Profil</Th><Th>Demandé</Th><Th>Alloué</Th><Th>Écart</Th><Th>Couverture</Th><Th>Statut</Th>
                {canManageAllocations && <Th></Th>}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  {g.rows.map((row, i) => {
                    const sent = sentKeys.has(row.key);
                    const sending = sendingKey === row.key;
                    return (
                      <tr key={row.key} style={{ borderTop: i === 0 ? `1px solid ${BORDER}` : "none" }}>
                        {i === 0 && (
                          <>
                            <Td rowSpan={g.rows.length} style={{ verticalAlign: "top" }}>
                              <button onClick={() => onOpenProject(g.projectId)} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 13, padding: 0 }}>{g.projectName}</button>
                            </Td>
                            <Td rowSpan={g.rows.length} style={{ verticalAlign: "top" }}>{g.svo}</Td>
                            <Td rowSpan={g.rows.length} style={{ verticalAlign: "top" }}>{g.periodLabel}</Td>
                          </>
                        )}
                        <Td>{row.profile}</Td>
                        <Td>{row.demanded}</Td>
                        <Td>{row.allocated}</Td>
                        <Td><span style={{ color: row.ecart < -0.001 ? RED : GREEN, fontWeight: 600 }}>{row.ecart}</span></Td>
                        <Td title={`${row.coveredWeeks}/${row.weeks} semaine(s) entièrement couverte(s)`}>
                          <span style={{ color: covColor(row.couverture), fontWeight: 600 }}>{row.couverture}%</span>
                          <span style={{ color: MUTED, fontSize: 11.5 }}> · {row.coveredWeeks}/{row.weeks} sem.</span>
                        </Td>
                        <Td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap", color: STATUS_BADGE[row.status]?.color || MUTED, background: `color-mix(in srgb, ${STATUS_BADGE[row.status]?.color || MUTED} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${STATUS_BADGE[row.status]?.color || MUTED} 40%, transparent)` }}>
                            {STATUS_BADGE[row.status]?.text || row.status}
                          </span>
                        </Td>
                        {canManageAllocations && (
                          <Td>
                            {row.status === "untreated" && (
                              sent ? (
                                <span style={{ display: "flex", alignItems: "center", gap: 4, color: GREEN, fontSize: 12, fontWeight: 600 }}>
                                  <Check size={13} /> Envoyé
                                </span>
                              ) : (
                                <button onClick={() => sendReminder(row)} disabled={sending} style={{
                                  ...btnGhost, fontSize: 11.5, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5,
                                  opacity: sending ? 0.6 : 1, cursor: sending ? "not-allowed" : "pointer",
                                }}>
                                  {sending ? <Loader2 className="animate-spin" size={13} /> : <BellRing size={13} />} Rappel
                                </button>
                              )
                            )}
                          </Td>
                        )}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={canManageAllocations ? 10 : 9} style={{ padding: 24, textAlign: "center", color: MUTED }}>
                  {hideCovered ? "Aucun besoin en attente — tout est couvert." : "Aucune demande soumise pour l'instant."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
