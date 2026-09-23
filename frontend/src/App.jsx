import { useEffect, useState } from "react";
import {
  LayoutDashboard, FolderKanban, Users, ClipboardList, ShieldCheck, LogOut, KeyRound, Loader2, Sun, Moon, History,
  PanelLeftClose, PanelLeftOpen, Search,
} from "lucide-react";
import { api, getToken, setToken } from "./api";
import { NAVY, TEXT, MUTED, FONT_BODY, SIDEBAR_BG, SIDEBAR_BORDER, SIDEBAR_TEXT, SIDEBAR_MUTED, btnGhostSidebar, themeToggleBtnSidebar } from "./styles";
import { getInitialTheme, applyTheme } from "./lib/theme";
import { NavItem, NavGroup, RailItem, BrandHeader } from "./components/ui";
import LoginScreen from "./screens/LoginScreen";
import ChangePasswordModal from "./screens/ChangePasswordModal";
import Dashboard from "./screens/Dashboard";
import ProjectsList from "./screens/ProjectsList";
import ProjectDetail from "./screens/ProjectDetail";
import DemandQueue from "./screens/DemandQueue";
import PoolView from "./screens/PoolView";
import RolesView from "./screens/RolesView";
import ActivityLog from "./screens/ActivityLog";
import ToastContainer from "./components/Toast";
import LoadingBar from "./components/LoadingBar";

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [hasPassword, setHasPassword] = useState(false);

  const [periods, setPeriods] = useState([]);
  const [pool, setPool] = useState([]);
  const [projects, setProjects] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [svoUsers, setSvoUsers] = useState([]);
  const [unavailabilitiesData, setUnavailabilitiesData] = useState({});

  const [tab, setTab] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const [rail, setRail] = useState(() => localStorage.getItem("pilotage_rail") || "full");
  useEffect(() => { localStorage.setItem("pilotage_rail", rail); }, [rail]);
  // A notification email's "Voir le projet" button links to ?project=<id> —
  // read once at load, consumed (and stripped from the URL) as soon as a
  // user is available, whether that's immediately or only after login.
  const [pendingProjectId, setPendingProjectId] = useState(() => new URLSearchParams(window.location.search).get("project"));

  const isHSV = user?.role === "hsv";
  const has = (key) => isHSV || !!user?.permissions?.includes(key);
  const can = {
    viewDashboard: has("viewDashboard"),
    viewAllProjects: has("viewAllProjects") || has("manageProjects") || has("manageAllocations"),
    manageProjects: has("manageProjects"),
    manageAllocations: has("manageAllocations"),
    proposeAllocations: has("proposeAllocations"),
    viewDemandQueue: has("viewDemandQueue"),
    managePool: has("managePool"),
    manageRoles: has("manageRoles"),
    viewActivity: has("viewActivity"),
  };
  // Team/Tech leads: viewDashboard granted but no org-wide oversight
  // permission — they only need their team's resource-load grid, not their
  // own project KPIs/charts (those still live under "Mes projets" as usual).
  // proposeAllocations (or any other non-oversight permission) doesn't pull
  // them out of this — only the broader ones do.
  const minimalDashboard = !isHSV && can.viewDashboard && !can.viewAllProjects && !can.manageProjects && !can.manageAllocations;

  useEffect(() => { applyTheme(theme); }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  useEffect(() => {
    if (!getToken()) { setAuthLoading(false); return; }
    api.get("/auth/me")
      .then(async (me) => {
        setUser(me);
        const acc = await api.get("/auth/accounts");
        setHasPassword(!!acc.find((a) => a.id === me.id)?.hasPassword);
      })
      .catch(() => setToken(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const refreshPool = () => api.get("/pool").then(setPool);
  const refreshProjects = () => api.get("/projects").then(setProjects);
  const refreshDashboard = () => (can.viewDashboard ? api.get("/dashboard").then(setDashboard) : Promise.resolve());
  const refreshSvoUsers = () => api.get("/users?role=svo").then(setSvoUsers);
  const refreshUnavailabilities = async () => {
    if (!can.managePool) return;
    const data = {};
    for (const member of pool) {
      try {
        data[member.id] = await api.get(`/pool/${member.id}/unavailabilities`);
      } catch {
        data[member.id] = [];
      }
    }
    setUnavailabilitiesData(data);
  };
  const refreshAll = () => Promise.all([refreshPool(), refreshProjects(), refreshDashboard(), refreshSvoUsers()]);

  useEffect(() => {
    if (!user) return;
    api.get("/periods").then(setPeriods);
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (pool.length > 0 && can.managePool) {
      refreshUnavailabilities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  useEffect(() => {
    if (!user || !pendingProjectId) return;
    setTab("projects");
    setSelectedId(pendingProjectId);
    setPendingProjectId(null);
    window.history.replaceState({}, "", window.location.pathname);
  }, [user, pendingProjectId]);

  useEffect(() => {
    if (tab === "dashboard" && !can.viewDashboard) { setTab("projects"); setSelectedId(null); }
    if (tab === "demandes" && !can.viewDemandQueue && !can.proposeAllocations) { setTab("projects"); setSelectedId(null); }
    if (tab === "pool" && !can.managePool) { setTab("projects"); setSelectedId(null); }
    if (tab === "roles" && !can.manageRoles) { setTab("projects"); setSelectedId(null); }
    if (tab === "activity" && !can.viewActivity) { setTab("projects"); setSelectedId(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user]);

  const handleLogin = async (name, password) => {
    const { token, user: loggedInUser } = await api.post("/auth/login", { name, password });
    setToken(token);
    setUser(loggedInUser);
    const acc = await api.get("/auth/accounts");
    setHasPassword(!!acc.find((a) => a.id === loggedInUser.id)?.hasPassword);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setPool([]); setProjects([]); setDashboard(null); setSvoUsers([]);
    setTab("dashboard"); setSelectedId(null);
  };

  if (authLoading) {
    return (
      <>
        <LoadingBar />
        <ToastContainer />
        <div style={{ background: NAVY, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontFamily: FONT_BODY }}>
          <Loader2 className="animate-spin" size={20} style={{ marginRight: 8 }} /> Chargement…
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <LoadingBar />
        <ToastContainer />
        <LoginScreen onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />
      </>
    );
  }

  // The API already returns exactly the projects this user is allowed to see
  // (own, or all when they hold viewAllProjects/manageProjects/manageAllocations) —
  // only the search filter applies client-side.
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || (p.svo?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const createProject = async () => {
    const svoUserId = can.manageProjects ? svoUsers[0]?.id : user.id;
    if (!svoUserId) return;
    const project = await api.post("/projects", { name: "Nouveau projet", svoUserId, status: "Cadrage" });
    await refreshProjects();
    setSelectedId(project.id);
  };
  const deleteProject = async (id) => {
    await api.delete(`/projects/${id}`);
    await Promise.all([refreshProjects(), refreshDashboard()]);
    if (selectedId === id) setSelectedId(null);
  };

  const NAV_ITEMS = [
    { group: "Pilotage", items: [
      { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", show: can.viewDashboard, go: () => { setTab("dashboard"); setSelectedId(null); } },
      { id: "demandes", icon: ClipboardList, label: can.viewDemandQueue ? "Demandes à affecter" : "Demandes de mon équipe", show: can.viewDemandQueue || can.proposeAllocations, go: () => { setTab("demandes"); setSelectedId(null); } },
    ]},
    { group: "Organisation", items: [
      { id: "projects", icon: FolderKanban, label: can.viewAllProjects ? "Tous les projets" : "Mes projets", show: true, go: () => setTab("projects") },
      { id: "pool", icon: Users, label: "Pool", show: can.managePool, go: () => setTab("pool") },
    ]},
    { group: "Admin", items: [
      { id: "roles", icon: ShieldCheck, label: "Rôles", show: can.manageRoles, go: () => setTab("roles") },
      { id: "activity", icon: History, label: "Activité", show: can.viewActivity, go: () => setTab("activity") },
    ]},
  ];
  const railNarrow = rail === "icons";

  return (
    <>
      <LoadingBar />
      <ToastContainer />
      <div style={{ background: NAVY, color: TEXT, fontFamily: FONT_BODY, minHeight: "100vh", display: "flex" }}>
      {/* Nav rail: full labels or icon-only — account/theme/logout live in the
          top bar now, so the rail stays purely about navigation. */}
      <div style={{ width: railNarrow ? 56 : 220, background: SIDEBAR_BG, borderRight: `1px solid ${SIDEBAR_BORDER}`, padding: railNarrow ? "14px 6px" : "16px 12px", flexShrink: 0, position: "sticky", top: 0, height: "100vh", transition: "width .15s ease" }}>
        <div style={{ marginBottom: 14, display: "flex", justifyContent: railNarrow ? "center" : "flex-start" }}>
          {railNarrow ? (
            <RailItem icon={<PanelLeftOpen size={17} />} label="Déplier le menu" active={false} onClick={() => setRail("full")} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <BrandHeader />
              <button onClick={() => setRail("icons")} aria-label="Réduire le menu" style={{ ...btnGhostSidebar, padding: 6 }}>
                <PanelLeftClose size={14} />
              </button>
            </div>
          )}
        </div>

        {NAV_ITEMS.map((g) => {
          const items = g.items.filter((i) => i.show);
          if (items.length === 0) return null;
          return (
            <div key={g.group}>
              {!railNarrow && <NavGroup>{g.group}</NavGroup>}
              {railNarrow && <div style={{ height: 8, width: 20, borderBottom: `1px solid ${SIDEBAR_BORDER}`, margin: "4px auto 10px" }} />}
              {items.map((i) => railNarrow ? (
                <RailItem key={i.id} icon={<i.icon size={19} />} label={i.label} active={tab === i.id} onClick={i.go} />
              ) : (
                <NavItem key={i.id} icon={<i.icon size={16} />} label={i.label} active={tab === i.id} onClick={i.go} />
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar: global search, current week, then the account block — the
            stuff every screen shares, taken out of the nav rail. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: `1px solid ${SIDEBAR_BORDER}`, background: SIDEBAR_BG, position: "sticky", top: 0, zIndex: 10 }}>
          {tab === "projects" && !selectedId && (
            <div style={{ position: "relative", width: 300 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: SIDEBAR_MUTED }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Projet ou SVO…"
                style={{ width: "100%", background: TEXT === "" ? "" : NAVY, border: `1px solid ${SIDEBAR_BORDER}`, borderRadius: 10, color: SIDEBAR_TEXT, fontSize: 12.5, padding: "7px 10px 7px 30px", outline: "none", fontFamily: FONT_BODY }} />
            </div>
          )}
          <div style={{ flex: 1 }} />
          {dashboard?.currentPeriod && periods.length > 0 && (
            <span style={{ fontSize: 12, color: SIDEBAR_MUTED, whiteSpace: "nowrap" }}>
              {periods.find((p) => p.id === dashboard.currentPeriod)?.label || dashboard.currentPeriod}
            </span>
          )}
          <span style={{ fontSize: 12.5, fontWeight: 600, color: SIDEBAR_TEXT }}>{user.name}</span>
          <button onClick={() => setShowAccount(true)} style={{ ...btnGhostSidebar, padding: "6px 10px" }} title="Changer de mot de passe">
            <KeyRound size={14} />
          </button>
          <button onClick={toggleTheme} style={themeToggleBtnSidebar} aria-label="Changer de thème">
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={handleLogout} style={{ ...btnGhostSidebar, padding: "6px 10px" }} title="Se déconnecter" aria-label="Se déconnecter">
            <LogOut size={14} />
          </button>
        </div>

      <div style={{ flex: 1, padding: 24, overflowX: "auto" }}>
        {tab === "dashboard" && (
          <Dashboard data={dashboard} periods={periods} minimalDashboard={minimalDashboard} onOpenProject={(id) => { setTab("projects"); setSelectedId(id); }} />
        )}

        {tab === "projects" && !selectedId && (
          <ProjectsList projects={filteredProjects} search={search} setSearch={setSearch}
            canViewAll={can.viewAllProjects} canManage={can.manageProjects} user={user}
            onSelect={setSelectedId}
            onCreate={createProject}
            onDelete={deleteProject}
          />
        )}

        {tab === "projects" && selectedId && (
          <ProjectDetail
            projectId={selectedId}
            canViewAll={can.viewAllProjects} canManageProjects={can.manageProjects} canManageAllocations={can.manageAllocations} canProposeAllocations={can.proposeAllocations}
            user={user}
            svoUsers={svoUsers} pool={pool} teamPool={dashboard?.pool || []} periods={periods} overAllocProjects={dashboard?.overAllocProjects || {}}
            unavailableMembers={dashboard?.unavailableMembers || {}}
            onBack={() => setSelectedId(null)}
            onProjectsChanged={() => { refreshProjects(); refreshDashboard(); }}
          />
        )}

        {tab === "demandes" && (can.viewDemandQueue || can.proposeAllocations) && (
          <DemandQueue canManageAllocations={can.manageAllocations}
            onOpenProject={(id) => { setTab("projects"); setSelectedId(id); }}
          />
        )}

        {tab === "pool" && can.managePool && (
          <PoolView pool={pool} overAllocGrid={dashboard?.overAllocGrid || {}} periods={periods.map((p) => p.id)}
            unavailabilitiesData={unavailabilitiesData}
            onChanged={() => { refreshPool(); refreshDashboard(); refreshUnavailabilities(); }} />
        )}

        {tab === "roles" && can.manageRoles && (
          <RolesView svoUsers={svoUsers} pool={pool} isHSV={isHSV}
            onChanged={() => { refreshSvoUsers(); refreshProjects(); }} />
        )}

        {tab === "activity" && can.viewActivity && (
          <ActivityLog svoUsers={svoUsers} onOpenProject={(id) => { setTab("projects"); setSelectedId(id); }} />
        )}
      </div>
      </div>

      {showAccount && (
        <ChangePasswordModal user={user} hasPassword={hasPassword}
          onClose={() => { setShowAccount(false); setHasPassword(true); }} />
      )}
      </div>
    </>
  );
}
