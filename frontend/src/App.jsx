import { useEffect, useState } from "react";
import {
  LayoutDashboard, FolderKanban, Users, ClipboardList, ShieldCheck, LogOut, KeyRound, Loader2, Sun, Moon, History,
} from "lucide-react";
import { api, getToken, setToken } from "./api";
import { NAVY, TEXT, MUTED, FONT_BODY, SIDEBAR_BG, SIDEBAR_BORDER, SIDEBAR_TEXT, SIDEBAR_MUTED, btnGhostSidebar, themeToggleBtnSidebar } from "./styles";
import { getInitialTheme, applyTheme } from "./lib/theme";
import { NavItem, BrandHeader } from "./components/ui";
import LoginScreen from "./screens/LoginScreen";
import ChangePasswordModal from "./screens/ChangePasswordModal";
import Dashboard from "./screens/Dashboard";
import ProjectsList from "./screens/ProjectsList";
import ProjectDetail from "./screens/ProjectDetail";
import DemandQueue from "./screens/DemandQueue";
import PoolView from "./screens/PoolView";
import RolesView from "./screens/RolesView";
import ActivityLog from "./screens/ActivityLog";

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [hasPassword, setHasPassword] = useState(false);

  const [periods, setPeriods] = useState([]);
  const [pool, setPool] = useState([]);
  const [projects, setProjects] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [svoUsers, setSvoUsers] = useState([]);

  const [tab, setTab] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  const isHSV = user?.role === "hsv";
  const has = (key) => isHSV || !!user?.permissions?.includes(key);
  const can = {
    viewDashboard: has("viewDashboard"),
    viewAllProjects: has("viewAllProjects") || has("manageProjects") || has("manageAllocations"),
    manageProjects: has("manageProjects"),
    manageAllocations: has("manageAllocations"),
    viewDemandQueue: has("viewDemandQueue"),
    managePool: has("managePool"),
    manageRoles: has("manageRoles"),
    viewActivity: has("viewActivity"),
  };

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
  const refreshAll = () => Promise.all([refreshPool(), refreshProjects(), refreshDashboard(), refreshSvoUsers()]);

  useEffect(() => {
    if (!user) return;
    api.get("/periods").then(setPeriods);
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (tab === "dashboard" && !can.viewDashboard) { setTab("projects"); setSelectedId(null); }
    if (tab === "demandes" && !can.viewDemandQueue) { setTab("projects"); setSelectedId(null); }
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
      <div style={{ background: NAVY, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontFamily: FONT_BODY }}>
        <Loader2 className="animate-spin" size={20} style={{ marginRight: 8 }} /> Chargement…
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />;
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

  return (
    <div style={{ background: NAVY, color: TEXT, fontFamily: FONT_BODY, minHeight: "100vh", display: "flex" }}>
      <div style={{ width: 220, background: SIDEBAR_BG, borderRight: `1px solid ${SIDEBAR_BORDER}`, padding: "20px 12px", flexShrink: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <BrandHeader />
        </div>

        <div style={{ padding: "0 8px 16px" }}>
          <div style={{ fontSize: 10.5, color: SIDEBAR_MUTED, fontWeight: 600, marginBottom: 5, textTransform: "uppercase" }}>Connecté en tant que</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8, color: SIDEBAR_TEXT }}>{user.name}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowAccount(true)} style={{ ...btnGhostSidebar, fontSize: 11.5, padding: "5px 8px", flex: 1 }}>
              <KeyRound size={13} /> Mot de passe
            </button>
            <button onClick={toggleTheme} style={themeToggleBtnSidebar} aria-label="Changer de thème">
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={handleLogout} style={{ ...btnGhostSidebar, fontSize: 11.5, padding: "5px 8px" }} aria-label="Se déconnecter">
              <LogOut size={13} />
            </button>
          </div>
        </div>

        {can.viewDashboard && (
          <NavItem icon={<LayoutDashboard size={16} />} label="Dashboard" active={tab === "dashboard"} onClick={() => { setTab("dashboard"); setSelectedId(null); }} />
        )}
        <NavItem icon={<FolderKanban size={16} />} label={can.viewAllProjects ? "Tous les projets" : "Mes projets"} active={tab === "projects"} onClick={() => setTab("projects")} />
        {can.viewDemandQueue && (
          <NavItem icon={<ClipboardList size={16} />} label="Demandes à affecter" active={tab === "demandes"} onClick={() => { setTab("demandes"); setSelectedId(null); }} />
        )}
        {can.managePool && (
          <NavItem icon={<Users size={16} />} label="Pool" active={tab === "pool"} onClick={() => { setTab("pool"); setSelectedId(null); }} />
        )}
        {can.manageRoles && (
          <NavItem icon={<ShieldCheck size={16} />} label="Rôles" active={tab === "roles"} onClick={() => { setTab("roles"); setSelectedId(null); }} />
        )}
        {can.viewActivity && (
          <NavItem icon={<History size={16} />} label="Activité" active={tab === "activity"} onClick={() => { setTab("activity"); setSelectedId(null); }} />
        )}
      </div>

      <div style={{ flex: 1, padding: 24, overflowX: "auto" }}>
        {tab === "dashboard" && (
          <Dashboard data={dashboard} periods={periods} onOpenProject={(id) => { setTab("projects"); setSelectedId(id); }} />
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
            canViewAll={can.viewAllProjects} canManageProjects={can.manageProjects} canManageAllocations={can.manageAllocations}
            user={user}
            svoUsers={svoUsers} pool={pool} periods={periods} overAllocProjects={dashboard?.overAllocProjects || {}}
            onBack={() => setSelectedId(null)}
            onProjectsChanged={() => { refreshProjects(); refreshDashboard(); }}
          />
        )}

        {tab === "demandes" && can.viewDemandQueue && (
          <DemandQueue pool={pool} overAllocGrid={dashboard?.overAllocGrid || {}} overAllocProjects={dashboard?.overAllocProjects || {}} canManageAllocations={can.manageAllocations}
            onOpenProject={(id) => { setTab("projects"); setSelectedId(id); }}
            onAllocated={() => { refreshProjects(); refreshDashboard(); }}
          />
        )}

        {tab === "pool" && can.managePool && (
          <PoolView pool={pool} overAllocGrid={dashboard?.overAllocGrid || {}} periods={periods.map((p) => p.id)}
            onChanged={() => { refreshPool(); refreshDashboard(); }} />
        )}

        {tab === "roles" && can.manageRoles && (
          <RolesView svoUsers={svoUsers} pool={pool} isHSV={isHSV}
            onChanged={() => { refreshSvoUsers(); refreshProjects(); }} />
        )}

        {tab === "activity" && can.viewActivity && (
          <ActivityLog svoUsers={svoUsers} onOpenProject={(id) => { setTab("projects"); setSelectedId(id); }} />
        )}
      </div>

      {showAccount && (
        <ChangePasswordModal user={user} hasPassword={hasPassword}
          onClose={() => { setShowAccount(false); setHasPassword(true); }} />
      )}
    </div>
  );
}
