import { Fragment, useEffect, useState } from "react";
import { Loader2, BellRing, Check, List, Columns3 } from "lucide-react";
import { api } from "../api";
import { showToast } from "../lib/toast";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

// Two faces of the same rows: a 4-column workflow board (the view an admin
// actually works in) and the detailed table kept for analysis/export-style
// reading. Statuses must stay in sync with backend buildDemandQueueRows().
const COLUMNS = [
  { value: "untreated", label: "Non traitées", hint: "Personne ne s'en occupe", color: "text-warning", bg: "bg-warning/10 border-warning/30" },
  { value: "proposed", label: "Proposées", hint: "en attente de validation HSV", color: "text-primary", bg: "bg-primary/10 border-primary/30" },
  { value: "partial", label: "Partielles", hint: "certaines semaines couvertes", color: "text-[color:var(--warning-token)]", bg: "bg-warning/10 border-warning/30" },
  { value: "validated", label: "Couvertes", hint: "toutes les semaines staffées", color: "text-success", bg: "bg-success/10 border-success/30" },
];
const STATUS_FILTERS = [{ value: "all", label: "Toutes" }, ...COLUMNS.map((c) => ({ value: c.value, label: c.label }))];
const STATUS_BADGE = {
  untreated: { variant: "warning", text: "Non traitée" },
  proposed: { variant: "default", text: "Team Lead ✓ (1/2)" },
  partial: { variant: "warning", text: "Partielle" },
  validated: { variant: "success", text: "Admin ✓✓ (2/2)" },
};
const PROFILE_COLORS = {
  Mobile: "text-[color:var(--primary)]",
  "TPE Android": "text-[color:var(--success-token)]",
  "TPE Engage": "text-[color:var(--warning-token)]",
  Digital: "text-[color:var(--accent-2)]",
};

function covColor(p) { return p >= 100 ? "var(--success-token)" : p > 0 ? "var(--warning-token)" : "var(--muted-foreground)"; }
function covColorClass(p) { return p >= 100 ? "text-success" : p > 0 ? "text-warning" : "text-muted-foreground"; }

function GaugeBar({ ratio }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, background: covColor(ratio * 100) }} />
    </div>
  );
}

function DemandCard({ row, canManageAllocations, onOpenProject, sent, sending, onRemind }) {
  return (
    <Card className="mb-2 shadow-none">
      <CardContent className="p-3">
        <div className="flex justify-between items-baseline gap-2">
          <button onClick={() => onOpenProject(row.projectId)} className="text-primary cursor-pointer text-[13px] font-semibold text-left hover:underline">
            {row.projectName}
          </button>
          <span className={cn("text-[11px] font-bold whitespace-nowrap", PROFILE_COLORS[row.profile] || "text-muted-foreground")}>{row.profile}</span>
        </div>
        <div className="text-[11.5px] text-muted-foreground mt-1">
          {row.svo} · {row.periodStart === row.periodEnd ? row.periodStart : `${row.periodStart} → ${row.periodEnd}`} · besoin {row.demanded} ETP/sem.
        </div>
        <div className="flex items-center gap-2 mt-2">
          <GaugeBar ratio={row.demanded > 0 ? row.covered / row.demanded : 0} />
          <span className={cn("text-[11px] font-bold whitespace-nowrap", covColorClass(row.couverture))}>
            {row.couverture}% · {row.coveredWeeks}/{row.weeks} sem.
          </span>
        </div>
        {canManageAllocations && row.status === "untreated" && (
          <div className="mt-2">
            {sent ? (
              <span className="flex items-center gap-1 text-success text-xs font-semibold"><Check size={13} /> Rappel envoyé</span>
            ) : (
              <Button variant="outline" size="sm" onClick={() => onRemind(row)} disabled={sending}>
                {sending ? <Loader2 className="animate-spin" size={12} /> : <BellRing size={12} />} Relancer le Team Lead
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DemandQueue({ canManageAllocations, onOpenProject, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [view, setView] = useState("board");
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
    return <div className="flex items-center gap-2 text-muted-foreground p-10"><Loader2 className="animate-spin" size={18} /> Chargement…</div>;
  }

  const visibleRows = rows.filter((r) => !hideCovered || r.ecart < -0.001);
  const filteredRows = visibleRows.filter((r) => statusFilter === "all" || r.status === statusFilter);
  const rangeLabel = (row) => (row.periodStart === row.periodEnd ? row.periodStart : `${row.periodStart} → ${row.periodEnd}`);

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
      <div className="flex justify-between items-center mb-1 gap-2 flex-wrap">
        <h1 className="text-xl font-bold tracking-tight">{canManageAllocations ? "Demandes à affecter" : "Demandes de mon équipe"}</h1>
        <div className="flex gap-1">
          {[{ v: "board", label: "Tableau", icon: Columns3 }, { v: "table", label: "Liste", icon: List }].map(({ v, label, icon: I }) => (
            <Button key={v} variant={view === v ? "secondary" : "outline"} size="sm" onClick={() => setView(v)}>
              <I size={13} /> {label}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground text-[13px] mb-4">
        {canManageAllocations
          ? "Toutes les demandes soumises par les SVO. Le tableau suit le flux de traitement : non traitée → proposée → partielle → couverte."
          : "Demandes soumises pour votre profil, tous projets confondus. Vos propositions seront à valider par le Head of Value Stream."}
      </p>

      <div className="flex gap-1.5 mb-2.5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <Button key={f.value} variant={statusFilter === f.value ? "secondary" : "outline"} size="sm" onClick={() => setStatusFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground mb-3 cursor-pointer">
        <input type="checkbox" checked={hideCovered} onChange={(e) => setHideCovered(e.target.checked)} />
        Masquer les besoins déjà entièrement couverts
      </label>

      {error && <div className="text-destructive text-[12.5px] mb-3">{error}</div>}

      {view === "board" ? (
        <div className="grid gap-3 items-start grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {(statusFilter === "all" ? COLUMNS : COLUMNS.filter((c) => c.value === statusFilter)).map((col) => {
            const colRows = visibleRows.filter((r) => r.status === col.value).sort((a, b) => a.ecart - b.ecart);
            return (
              <div key={col.value} className="rounded-xl border bg-muted/40 p-2.5">
                <div className="flex justify-between items-baseline px-1 pb-2">
                  <div>
                    <div className={cn("text-xs font-bold", col.color)}>{col.label}</div>
                    <div className="text-[10.5px] text-muted-foreground">{col.hint}</div>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground bg-card border rounded-full px-2">{colRows.length}</span>
                </div>
                {colRows.map((row) => (
                  <DemandCard key={row.key} row={row} canManageAllocations={canManageAllocations}
                    onOpenProject={onOpenProject} sent={sentKeys.has(row.key)} sending={sendingKey === row.key} onRemind={sendReminder} />
                ))}
                {colRows.length === 0 && <div className="text-muted-foreground text-[11.5px] px-1 py-2.5">—</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-hidden rounded-xl">
              <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="bg-muted/50 text-left">
                    {["Projet", "SVO", "Période", "Profil", "Demandé", "Alloué", "Écart", "Couverture", "Statut", ...(canManageAllocations ? [""] : [])].map((h, i) => (
                      <th key={i} className="px-3 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.key}>
                      {g.rows.map((row, i) => {
                        const sent = sentKeys.has(row.key);
                        const sending = sendingKey === row.key;
                        return (
                          <tr key={row.key} className={cn(i === 0 && "border-t", "hover:bg-muted/30")}>
                            {i === 0 && (
                              <>
                                <td rowSpan={g.rows.length} className="px-3 py-2 align-top">
                                  <button onClick={() => onOpenProject(g.projectId)} className="text-primary cursor-pointer text-[13px] hover:underline">{g.projectName}</button>
                                </td>
                                <td rowSpan={g.rows.length} className="px-3 py-2 align-top">{g.svo}</td>
                                <td rowSpan={g.rows.length} className="px-3 py-2 align-top">{g.periodLabel}</td>
                              </>
                            )}
                            <td className="px-3 py-2">{row.profile}</td>
                            <td className="px-3 py-2">{row.demanded}</td>
                            <td className="px-3 py-2">{row.allocated}</td>
                            <td className={cn("px-3 py-2 font-semibold", row.ecart < -0.001 ? "text-destructive" : "text-success")}>{row.ecart}</td>
                            <td className="px-3 py-2" title={`${row.coveredWeeks}/${row.weeks} semaine(s) entièrement couverte(s)`}>
                              <span className={cn("font-semibold", covColorClass(row.couverture))}>{row.couverture}%</span>
                              <span className="text-muted-foreground text-[11.5px]"> · {row.coveredWeeks}/{row.weeks} sem.</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={cn("text-[11px] font-bold rounded-full border px-2 py-0.5 whitespace-nowrap", STATUS_BADGE[row.status] ? COLUMNS.find((c) => c.value === row.status)?.bg : "bg-muted border-border")}>
                                <span className={COLUMNS.find((c) => c.value === row.status)?.color || "text-muted-foreground"}>{STATUS_BADGE[row.status]?.text || row.status}</span>
                              </span>
                            </td>
                            {canManageAllocations && (
                              <td className="px-3 py-2">
                                {row.status === "untreated" && (
                                  sent ? (
                                    <span className="flex items-center gap-1 text-success text-xs font-semibold"><Check size={13} /> Envoyé</span>
                                  ) : (
                                    <Button variant="outline" size="sm" onClick={() => sendReminder(row)} disabled={sending}>
                                      {sending ? <Loader2 className="animate-spin" size={13} /> : <BellRing size={13} />} Rappel
                                    </Button>
                                  )
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={canManageAllocations ? 10 : 9} className="px-3 py-6 text-center text-muted-foreground">
                      {hideCovered ? "Aucun besoin en attente — tout est couvert." : "Aucune demande soumise pour l'instant."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
