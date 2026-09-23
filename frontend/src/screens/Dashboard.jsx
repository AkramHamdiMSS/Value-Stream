import { Fragment, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Loader2, ChevronDown, ChevronRight, FolderKanban, CheckCircle2, Clock, Users, Scale, ClipboardList,
  AlertTriangle, Percent, Gauge, Inbox, Unlock, CalendarOff, Timer, Battery, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge2 } from "../components/ui/badge";
import { cn } from "../lib/utils";

// Profile colors in shadcn token space (var(--…) → follow the active theme).
const PROFILE_COLORS = {
  Mobile: "text-[color:var(--primary)]",
  "TPE Android": "text-[color:var(--success-token)]",
  "TPE Engage": "text-[color:var(--warning-token)]",
  Digital: "text-[color:var(--accent-2)]",
};
const PROFILE_CHART = {
  Mobile: "var(--primary)",
  "TPE Android": "var(--success-token)",
  "TPE Engage": "var(--warning-token)",
  Digital: "var(--accent-2)",
};

function pctColor(p) {
  return p == null ? "text-muted-foreground" : p >= 100 ? "text-success" : p >= 70 ? "text-warning" : "text-destructive";
}
function pctColorRaw(p) {
  return p == null ? "var(--muted-foreground)" : p >= 100 ? "var(--success-token)" : p >= 70 ? "var(--warning-token)" : "var(--destructive)";
}

export default function Dashboard({ data, periods: periodDefs, onOpenProject, minimalDashboard }) {
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-10">
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

// ---------------------------------------------------------------- shared bits

function PageTitle({ title, children }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <div className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{children}</div>
    </div>
  );
}

function StatCard({ label, value, tone = "default", icon: Icon, hint }) {
  const tones = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    muted: "text-muted-foreground",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {Icon && <Icon size={15} className="text-muted-foreground" />}
        </div>
        <div className={cn("text-2xl font-bold tracking-tight", tones[tone])}>{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function GaugeBar({ ratio, className }) {
  const pct100 = Math.max(0, Math.min(1, ratio)) * 100;
  const color = pctColorRaw(ratio * 100 || 0);
  return (
    <div className={cn("w-full h-1.5 rounded-full bg-muted overflow-hidden", className)}>
      <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${pct100}%`, background: color }} />
    </div>
  );
}

// Problem strip on top of the HSV dashboard: strictly the things needing
// action, each card scrolls to the part of the page that shows it.
function AlertBand({ items }) {
  if (items.length === 0) {
    return (
      <Card className="mb-4 border-success/40 bg-success/5">
        <CardContent className="p-3 flex items-center gap-2 text-success text-[13px] font-semibold">
          <CheckCircle2 size={16} /> Plan sain : aucune sur-allocation, conflit de congé ou besoin non couvert.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, minmax(0, 1fr))` }}>
      {items.map((it, i) => {
        const Icon = it.icon;
        const go = it.scroll ? () => { it.then?.(); document.getElementById(it.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" }); } : undefined;
        const tone = it.tone === "danger" ? "text-destructive border-destructive/40 bg-destructive/5"
          : it.tone === "warning" ? "text-warning border-warning/40 bg-warning/5"
          : "text-muted-foreground border-border bg-muted/40";
        return (
          <button key={i} onClick={go} disabled={!go}
            className={cn("flex items-center gap-2.5 rounded-xl border p-3 text-left", tone, go && "cursor-pointer hover:brightness-110")}>
            <Icon size={18} className="shrink-0" />
            <span className="text-[13px] font-bold">{it.n}</span>
            <span className="text-xs text-foreground">{it.text}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- SVO view

function OwnDashboard({ data, labelFor, onOpenProject, minimalDashboard }) {
  const { totals, bySquad, demandByMonth, projectsCount, draftCount, submittedCount, myProjects } = data;
  const chartWeeks = demandByMonth.slice(0, 16);

  return (
    <div>
      <PageTitle title="Dashboard">
        {minimalDashboard
          ? "Charge des ressources, tous projets confondus — aucune saisie ici."
          : `Calculé en direct à partir de vos projets, semaine par semaine sur les ${data.planningWeeks} prochaines semaines — 1 ETP·semaine = une personne à 100 % pendant une semaine.`}
      </PageTitle>

      {!minimalDashboard && (
        <>
          <div className="grid gap-3 mb-5 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
            <StatCard label="Mes projets" value={projectsCount} icon={FolderKanban} />
            <StatCard label="Besoin exprimé (ETP·sem.)" value={totals.besoinTotal} tone="primary" icon={Clock} />
            <StatCard label="Couvert à temps" value={totals.coveredTotal} tone="success" icon={Users} />
            <StatCard label="Couverture" value={totals.couvertureTotal == null ? "—" : `${totals.couvertureTotal}%`}
              tone={totals.couvertureTotal == null ? "default" : totals.couvertureTotal >= 100 ? "success" : "danger"} icon={Percent} />
            <StatCard label="Écart (ETP·sem.)" value={`${totals.ecartTotal > 0 ? "+" : ""}${totals.ecartTotal}`}
              tone={totals.ecartTotal < -0.001 ? "danger" : "success"} icon={Scale} />
            <StatCard label="Brouillons" value={draftCount} icon={ClipboardList} />
          </div>

          <div className="grid gap-4 mb-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader className="pb-2"><CardTitle>Mon besoin par semaine (16 premières semaines)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartWeeks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-token)" />
                    <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={10} interval={1} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: `1px solid var(--border-token)`, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {Object.entries(PROFILE_CHART).map(([p, color]) => (
                      <Line key={p} type="monotone" dataKey={p} stroke={color} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle>Besoin vs alloué par profil</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bySquad}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-token)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: `1px solid var(--border-token)`, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="besoin" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="alloue" fill="var(--success-token)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-5">
            <CardHeader className="pb-2">
              <CardTitle>Mes projets ({projectsCount})</CardTitle>
              <CardDescription>{submittedCount} soumis(e) · {draftCount} en brouillon. Cliquez pour ouvrir.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      {["Projet", "Statut", "Besoin", "Alloué", "Couvert", "Écart", "Demande"].map((h) => (
                        <th key={h} className="px-3 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myProjects.map((p) => (
                      <tr key={p.id} className="border-t cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => onOpenProject?.(p.id)}>
                        <td className="px-3 py-2 font-semibold">{p.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.status}</td>
                        <td className="px-3 py-2">{p.demand}</td>
                        <td className="px-3 py-2">{p.alloc}</td>
                        <td className="px-3 py-2">{p.covered}{p.couverture != null && <span className="text-muted-foreground text-[11.5px]"> · {p.couverture}%</span>}</td>
                        <td className={cn("px-3 py-2 font-semibold", p.ecart < -0.001 ? "text-destructive" : "text-success")}>{p.ecart}</td>
                        <td className="px-3 py-2">
                          {p.demandSubmitted ? <Badge2 variant="success">Soumise</Badge2> : <Badge2 variant="secondary">Brouillon</Badge2>}
                        </td>
                      </tr>
                    ))}
                    {myProjects.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Aucun projet ne vous est encore assigné.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <ResourceLoadGrid data={data} labelFor={labelFor} onOpenProject={onOpenProject} />
    </div>
  );
}

// ---------------------------------------------------------------- HSV / global view

function AllDashboard({ data, labelFor, onOpenProject }) {
  const [gridMode, setGridMode] = useState("plan");
  const { totals, bySquad, demandByMonth, allocByPeriod, capacityByPeriod, alertCount, projectsCount, topProjects, realizationByProfile, planningWeeks, currentPeriod } = data;
  const startIdx = Math.max(0, demandByMonth.findIndex((r) => r.period === currentPeriod));
  const chartWeeks = demandByMonth.slice(startIdx, startIdx + planningWeeks);
  // Demand vs net capacity vs approved allocation per week — the honest
  // supply/demand picture over the planning horizon.
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
      <PageTitle title="Dashboard">
        Calculé en direct à partir des projets soumis, du Pool et des affectations validées, semaine par semaine sur les {planningWeeks} prochaines semaines.
        {" "}1 ETP·semaine = une personne à 100 % pendant une semaine. La capacité est nette des congés validés, du temps partiel, des arrivées/départs et des jours fériés.
      </PageTitle>

      <AlertBand items={[
        alertCount > 0 && { n: alertCount, text: alertCount === 1 ? "sur-allocation (pers. × sem.)" : "sur-allocations (pers. × sem.)", tone: "danger", icon: AlertTriangle, scroll: "resource-grid", then: () => setGridMode("plan") },
        totals.conflictCount > 0 && { n: totals.conflictCount, text: "conflit(s) congé / affectation", tone: "danger", icon: CalendarOff, scroll: "resource-grid", then: () => setGridMode("plan") },
        totals.ecartTotal < -0.05 && { n: `${-totals.ecartTotal} ETP·sem.`, text: "de besoin non couvert à temps", tone: "warning", icon: Scale, scroll: "top-projects" },
        totals.backlogCount > 0 && { n: totals.backlogCount, text: "demande(s) à traiter dans la file", tone: "warning", icon: Inbox },
        totals.timesheetGapCount > 0 && { n: totals.timesheetGapCount, text: "écart(s) plan / réel dans Tempo", tone: "muted", icon: Timer, scroll: "resource-grid", then: () => setGridMode("ecart") },
        totals.releasePendingCount > 0 && { n: totals.releasePendingCount, text: "libération(s) en attente", tone: "warning", icon: Unlock },
      ].filter(Boolean)} />

      <div className="grid gap-3 mb-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Projets" value={projectsCount} icon={FolderKanban} hint={`${totals.submittedCount} soumis · ${totals.draftCount} brouillons`} />
        <StatCard label="Besoin soumis (ETP·sem.)" value={totals.besoinTotal} tone="primary" icon={Clock}
          hint={totals.besoinDraftTotal > 0 ? `+ ${totals.besoinDraftTotal} en brouillon, non comptés` : undefined} />
        <StatCard label="Capacité nette (ETP·sem.)" value={totals.capTotal} icon={Battery} hint={`${totals.headcount} personnes · ${totals.capNow} ETP cette semaine`} />
        <StatCard label="Charge du pool" value={totals.chargeCapacitePct == null ? "—" : `${totals.chargeCapacitePct}%`}
          tone={totals.chargeCapacitePct > 100 ? "danger" : totals.chargeCapacitePct > 85 ? "warning" : "success"} icon={Gauge} hint="besoin soumis / capacité nette" />
        <StatCard label="Couverture à temps" value={couverture == null ? "—" : `${couverture}%`}
          tone={couverture == null ? "default" : couverture >= 100 ? "success" : "danger"} icon={Percent}
          hint={totals.allocTotal > totals.coveredTotal + 0.05 ? `${totals.coveredTotal} couverts sur ${totals.allocTotal} alloués` : undefined} />
        <StatCard label="Pool cette semaine" value={`${totals.poolUtilizationPct}%`} tone={totals.poolUtilizationPct > 100 ? "danger" : "default"} icon={Users}
          hint={`${totals.availableCount} présents sans charge · ${totals.freeNow} ETP libres`} />
      </div>

      <div className="grid gap-4 mb-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle>Besoin vs capacité nette par semaine (ETP, {planningWeeks} prochaines semaines)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={balanceWeeks}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-token)" />
                <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={10} interval={1} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--card)", border: `1px solid var(--border-token)`, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Capacité nette" stroke="var(--success-token)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Besoin" stroke="var(--primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Alloué" stroke="var(--warning-token)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-xs font-semibold mt-4 mb-2">Besoin par profil et par semaine</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartWeeks}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-token)" />
                <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={10} interval={1} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--card)", border: `1px solid var(--border-token)`, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {Object.entries(PROFILE_CHART).map(([p, color]) => (
                  <Line key={p} type="monotone" dataKey={p} stroke={color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Profils sur les {planningWeeks} prochaines semaines</CardTitle>
            <CardDescription>Jauge = besoin rempli à temps (couvert). « Charge » = besoin / capacité nette disponible.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3.5">
              {bySquad.map((s2) => (
                <div key={s2.name}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className={cn("text-xs font-bold", PROFILE_COLORS[s2.name])}>{s2.name}</span>
                    <span className="text-[11.5px] text-muted-foreground">
                      {s2.effectif} pers. · {s2.capaciteSemaine} ETP/sem.
                      {s2.couverture != null && <> · <span className={cn("font-semibold", pctColor(s2.couverture))}>couvert {s2.couverture}%</span></>}
                      {s2.charge != null && <> · <span className={cn("font-semibold", s2.charge > 100 ? "text-destructive" : s2.charge > 85 ? "text-warning" : "text-success")}>charge {s2.charge}%</span></>}
                    </span>
                  </div>
                  <GaugeBar ratio={(s2.couverture ?? 0) / 100} />
                  <div className="text-[11px] text-muted-foreground mt-1">Besoin {s2.besoin} · couvert {s2.couvert} · alloué {s2.alloue} · capacité {s2.capacite} ETP·sem.</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Profil</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground" title="Heures réellement loggées / heures planifiées, semaines passées, ressources mappées Tempo.">Réel / planifié (Tempo)</th>
                  </tr>
                </thead>
                <tbody>
                  {bySquad.map((s2) => {
                    const r = (realizationByProfile || []).find((x) => x.name === s2.name);
                    return (
                      <tr key={s2.name} className="border-t">
                        <td className="px-3 py-1.5"><span className={cn("font-semibold", PROFILE_COLORS[s2.name])}>{s2.name}</span></td>
                        <td className="px-3 py-1.5" title={r?.ratio != null ? `${r.loggedHours}h loggées pour ${r.plannedHours}h planifiées` : "Pas de données Tempo"}>
                          {r?.ratio == null ? <span className="text-muted-foreground">—</span>
                            : <span className={cn("font-semibold", r.ratio > 1.2 ? "text-destructive" : r.ratio < 0.8 ? "text-warning" : "text-success")}>×{r.ratio}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {withTempo.length > 0 && (
              <div className="text-muted-foreground text-[11.5px] mt-2 flex gap-1.5 items-start">
                <Activity size={13} className="shrink-0 mt-px" />
                <span>Réel / planifié &gt; 1 : ce profil consomme plus que prévu — les prochaines demandes sont probablement sous-estimées. &lt; 1 : sur-estimées ou temps non saisi.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {topProjects?.length > 0 && (
        <Card id="top-projects" className="mb-5">
          <CardHeader className="pb-2">
            <CardTitle>Projets en manque</CardTitle>
            <CardDescription>Besoin non rempli dans les bonnes semaines, sur les {planningWeeks} prochaines semaines (ETP·sem.) — du plus au moins exposé.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {topProjects.map((pr) => {
              const ratio = pr.demand > 0 ? pr.covered / pr.demand : 0;
              return (
                <button key={pr.id} onClick={() => onOpenProject?.(pr.id)}
                  className="grid grid-cols-[minmax(180px,2fr)_auto_minmax(160px,3fr)_auto] items-center gap-3 text-left rounded-lg border p-2.5 px-3 hover:bg-muted/40 transition-colors cursor-pointer">
                  <span>
                    <div className="font-semibold text-[13px]">{pr.name}</div>
                    <div className="text-[11.5px] text-muted-foreground">{pr.svo} · {pr.status} · {pr.weeks} sem. de besoin</div>
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">besoin {pr.demand}</span>
                  <GaugeBar ratio={ratio} />
                  <span className={cn("text-xs font-bold min-w-[84px] text-right", pctColor(pr.couverture))}>{pr.couverture}% ({pr.ecart})</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      <span id="resource-grid" className="contents">
        <ResourceLoadGrid data={data} labelFor={labelFor} onOpenProject={onOpenProject} viewMode={gridMode} setViewMode={setGridMode} />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- resource load grid

const fmtDay = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
// A leave spanning several weeks shows up once per week in unavailableMembers;
// dedupe to one row per actual leave record for the tooltip.
function leaveDetails(entries) {
  const seen = new Map();
  for (const u of entries || []) {
    const key = `${u.type}|${u.startDate}|${u.endDate}`;
    if (!seen.has(key)) seen.set(key, `${u.type} (${fmtDay(u.startDate)} → ${fmtDay(u.endDate)})`);
  }
  return [...seen.values()];
}

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
const HATCH = "repeating-linear-gradient(45deg, transparent 0 3px, var(--warning-token) 3px 4px)";

function round1(n) { return Math.round(n * 10) / 10; }

// One week cell as a capacity bar: track = net capacity that week, fill =
// planned load, red = the part overflowing the capacity, amber hatch = leave
// actually eating part of the week. Number on top when the zoom allows it.
function CapacityCell({ width, showLabel, load, cap, leaveFrac, hasPendingLeave, backupOnly, tooltip }) {
  const loadPct100 = cap > 0.001 ? (load / cap) * 100 : load > 0.001 ? 100 : 0;
  const fillPct100 = Math.min(100, loadPct100);
  const over = load > cap + 0.001;
  const fill = over ? "var(--destructive)" : leaveFrac > 0 ? "var(--warning-token)" : load > 0.001 ? "var(--success-token)" : undefined;
  const label = load > 0.001 ? `${Math.round(load * 100)}%` : "";
  return (
    <div
      className="relative mx-auto rounded-[5px] overflow-hidden"
      style={{ width, height: 22, background: cap > 0.001 ? "color-mix(in srgb, var(--muted-foreground) 14%, transparent)" : "color-mix(in srgb, var(--muted-foreground) 6%, transparent)" }}
      title={tooltip}
    >
      {leaveFrac > 0 && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, leaveFrac * 100)}%`, backgroundImage: HATCH, opacity: 0.45 }} />
      )}
      {load > 0.001 && !over && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fillPct100}%`, background: fill, opacity: 0.3 }} />
      )}
      {over && (
        <>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fillPct100}%`, background: fill, opacity: 0.35 }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: "var(--destructive)" }} />
        </>
      )}
      {showLabel && (label !== "" || over) && (
        <span className={cn("absolute inset-0 flex items-center justify-center text-[10.5px]", over ? "font-bold text-destructive" : leaveFrac > 0 ? "text-warning font-medium" : "text-foreground")}>
          {label}{over ? " ▲" : ""}{hasPendingLeave ? " ?" : ""}
        </span>
      )}
      {!showLabel && (over || hasPendingLeave) && (
        <span className={cn("absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full", over ? "bg-destructive" : "bg-warning")} />
      )}
      {backupOnly && (
        <div style={{ position: "absolute", inset: 0, border: "1px dashed var(--accent-2)", borderRadius: 5 }} />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={cn(
      "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
      active ? "bg-primary/10 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
    )}>
      {children}
    </button>
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
    <Card>
      <CardHeader className="pb-2 gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Charge par ressource et par semaine</CardTitle>
          <div className="flex gap-1.5 items-center flex-wrap">
            {["Tous", ...Object.keys(PROFILE_COLORS)].map((name) => (
              <Chip key={name} active={profileFilter === name} onClick={() => setProfileFilter(name)}>{name}</Chip>
            ))}
            <span className="w-px h-4 bg-border" />
            {RANGE_WINDOWS.map((w) => (
              <Chip key={w.key} active={windowSize === w.key} onClick={() => { setWindowSize(w.key); setOffset(0); }}>{w.label}</Chip>
            ))}
            {windowSize !== 0 && (
              <>
                <Chip active={false} onClick={() => setOffset((o) => Math.max(-(curIdx - 4), o - windowSize))}><ChevronRight size={12} style={{ transform: "rotate(180deg)" }} /></Chip>
                <Chip active={false} onClick={() => setOffset((o) => Math.min(Math.max(0, periods.length - windowSize - (curIdx - 4)), o + windowSize))}><ChevronRight size={12} /></Chip>
              </>
            )}
            <span className="w-px h-4 bg-border" />
            {CELL_ZOOMS.map((z) => (
              <Chip key={z.key} active={zoomKey === z.key} onClick={() => setZoomKey(z.key)}>{z.label}</Chip>
            ))}
            <span className="w-px h-4 bg-border" />
            {VIEW_MODES.map((m) => (
              <Chip key={m.value} active={viewMode === m.value} onClick={() => setViewMode(m.value)}>{m.label}</Chip>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* legend — what the visuals mean, no hovering random cells required */}
        <div className="text-[11.5px] text-muted-foreground flex gap-3.5 flex-wrap mb-2.5 items-center">
          <span className="inline-flex items-center gap-1.5"><span className="w-5 h-2.5 rounded-sm" style={{ background: "color-mix(in srgb, var(--success-token) 30%, transparent)" }} /> charge planifiée</span>
          <span className="inline-flex items-center gap-1.5"><span className="relative w-5 h-2.5 rounded-sm bg-muted"><span className="absolute inset-x-0 top-0 h-[2.5px] bg-destructive" /></span> surcharge</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-5 h-2.5 rounded-sm" style={{ backgroundImage: HATCH, opacity: 0.7 }} /> congé (partie hachurée)</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-5 h-2.5 rounded-sm border border-dashed" style={{ borderColor: "var(--accent-2)" }} /> backup (ne compte pas)</span>
          <span>Fond gris = capacité nette restante.</span>
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          {viewMode === "reel" && "Mode Réel : heures Tempo loggées tous projets (synchronisées depuis Pool)."}
          {viewMode === "ecart" && "Mode Écart : réel moins attendu (planifié × 8h × jours ouvrés, fériés déduits), semaines passées seulement."}
          {viewMode === "plan" && "Cliquez sur une ressource pour voir ses projets semaine par semaine."}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="sticky left-0 bg-card text-left px-2 py-1 text-muted-foreground font-semibold border-b z-20">Ressource</th>
                {shown.map((p) => (
                  <th key={p} data-current={p === currentPeriod || undefined}
                    className={cn("px-1 py-1 font-semibold whitespace-nowrap text-[10.5px] border-b", p === currentPeriod && "text-primary border-b-2 border-b-primary")}
                    style={{ minWidth: zoom.width }}>
                    {labelFor(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownPool.map((res) => {
                const isOpen = expanded === res.id;
                const detail = shown.map((p) => ({ period: p, entries: overAllocProjects?.[`${res.id}:${p}`] || [] })).filter((row) => row.entries.length > 0);
                const backupDetail = shown.map((p) => ({ period: p, entries: backupFor?.[res.id]?.[p] || [] })).filter((row) => row.entries.length > 0);
                return (
                  <Fragment key={res.id}>
                    <tr className="border-b">
                      <td onClick={() => setExpanded(isOpen ? null : res.id)}
                        className={cn("sticky left-0 bg-card px-2 py-[3px] whitespace-nowrap cursor-pointer z-10", isOpen && "text-primary font-semibold")}>
                        <div className="flex items-center gap-1.5">
                          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span>{res.name}</span>
                          {(res.capacityPct ?? 1) < 1 && <span className="text-[9.5px] font-bold text-muted-foreground border rounded px-1">{Math.round(res.capacityPct * 100)}%</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{res.sousEquipe}</div>
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
                            <td key={p} className="text-center px-1 py-[3px]">
                              <span title={active ? `${round1(logged)}h loggées` : undefined}
                                className={cn("inline-block rounded-full border px-1.5 py-[3px] text-[10.5px]", active ? "border-success/40 bg-success/10 text-success font-medium" : "border-border text-muted-foreground")}
                                style={{ minWidth: zoom.width - 10 }}>
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
                            <td key={p} className="text-center px-1 py-[3px]">
                              <span title={active ? `Planifié ${Math.round(expected)}h (${workingDaysByPeriod?.[p] ?? 5} j ouvrés) · Réel ${Math.round(logged)}h` : undefined}
                                className={cn("inline-block rounded-full border px-1.5 py-[3px] text-[10.5px]",
                                  active ? (significant ? "border-destructive/40 bg-destructive/10 text-destructive font-bold" : "border-success/40 bg-success/10 text-success") : "border-border text-muted-foreground")}
                                style={{ minWidth: zoom.width - 10 }}>
                                {active ? `${ecart > 0 ? "+" : ""}${Math.round(ecart)}h` : "—"}
                              </span>
                            </td>
                          );
                        }
                        const capLabel = `capacité nette ${Math.round(cap * 100)}%${lostToLeave > 0 ? ` (${Math.round(lostToLeave * 100)}% en congé)` : ""}`;
                        const tooltip = [leaves, backupOnly ? `Backup pour : ${backups.map((b) => `${b.projectName} (${b.primaryName})`).join(", ")}` : null, `${Math.round(v * 100)}% affecté pour ${capLabel}${pendingOnly ? " — demande RH en attente" : ""}`].filter(Boolean).join("\n");
                        return (
                          <td key={p} className="text-center px-1 py-[3px]">
                            <CapacityCell width={zoom.width - 8} showLabel={zoom.showLabel}
                              load={v} cap={cap} leaveFrac={lostToLeave}
                              hasPendingLeave={pendingOnly} backupOnly={backupOnly} tooltip={tooltip} />
                          </td>
                        );
                      })}
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={shown.length + 1} className="bg-muted/40 px-3 py-2.5 border-b">
                          {detail.length === 0 && backupDetail.length === 0 ? (
                            <span className="text-muted-foreground text-xs">Aucune affectation pour {res.name}.</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {detail.map((row) => row.entries.map((e) => (
                                <button key={row.period + e.projectId} onClick={() => onOpenProject?.(e.projectId)}
                                  className="bg-card border rounded-full text-[11.5px] px-2.5 py-1 cursor-pointer flex items-center gap-1.5 hover:bg-muted/60 transition-colors">
                                  <span className="text-muted-foreground">{labelFor(row.period)}</span>
                                  <span className="font-semibold">{e.projectName}</span>
                                  <span className="text-primary">{Math.round(e.pct * 100)}%</span>
                                  {e.backupName && <span className="text-muted-foreground">· backup: {e.backupName}</span>}
                                </button>
                              )))}
                              {backupDetail.map((row) => row.entries.map((e) => (
                                <button key={`backup-${row.period}-${e.projectId}`} onClick={() => onOpenProject?.(e.projectId)}
                                  className="bg-card border border-dashed rounded-full text-[11.5px] px-2.5 py-1 cursor-pointer flex items-center gap-1.5 hover:bg-muted/60 transition-colors">
                                  <span className="text-muted-foreground">{labelFor(row.period)}</span>
                                  <span style={{ color: "var(--accent-2)" }} className="font-semibold">Backup</span>
                                  <span className="font-semibold">{e.projectName}</span>
                                  <span className="text-muted-foreground">pour {e.primaryName}</span>
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
                <td className="sticky left-0 bg-muted font-bold text-muted-foreground text-[11.5px] px-2 py-1.5 border-t">
                  Charge du pool{profileFilter !== "Tous" ? ` (${profileFilter})` : ""}
                </td>
                {shown.map((p) => {
                  const t = ratioFor(p);
                  const label = t.suffix === "%" ? `${Math.round(t.v)}%` : t.v !== 0 ? `${viewMode === "ecart" && t.v > 0 ? "+" : ""}${Math.round(round1(t.v))}h` : "—";
                  return (
                    <td key={p} className="text-center border-t bg-muted px-0.5 py-1">
                      <span title={viewMode === "plan" ? `charge planifiée ${Math.round(t.v)}% de la capacité nette du pool` : undefined}
                        className={cn("text-[10.5px] font-bold", t.over ? "text-destructive" : t.v > 0 ? "text-success" : "text-muted-foreground")}>
                        {label}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
