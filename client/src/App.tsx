import { Settings, SlidersHorizontal, X } from "lucide-react";
import { useEffect } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";
import { routeCatalog } from "./routes/routeCatalog";
import { useGameSessionStore } from "./state/gameSessionState";
import type { DrawerSurface, PageSurface } from "./state/uiState";
import { useUiStateStore } from "./state/uiState";

const primaryNav = routeCatalog.filter((route) => route.surface === "primary");

export function App() {
  const displayPreferences = useUiStateStore((state) => state.displayPreferences);
  const openDrawer = useUiStateStore((state) => state.openDrawer);
  const openModal = useUiStateStore((state) => state.openModal);
  const returnHome = useUiStateStore((state) => state.returnHome);

  return (
    <div
      className="appShell"
      data-client-entry="react"
      data-router-mode="data"
      data-motion={displayPreferences.motion}
      data-text-size={displayPreferences.textSize}
      data-contrast={displayPreferences.contrast}
    >
      <UiRouteStateBridge />
      <header className="topBar" aria-label="千秋主导航">
        <Link className="brandMark" to="/" aria-label="返回千秋首页" onClick={returnHome}>
          <span className="brandSeal" aria-hidden="true" />
          <span>
            <strong>千秋</strong>
            <small>案上新卷</small>
          </span>
        </Link>
        <nav className="topNav" aria-label="页面">
          {primaryNav.map((route) => (
            <NavLink key={route.id} to={route.href}>
              {route.label}
            </NavLink>
          ))}
        </nav>
        <div className="topTools" aria-label="案头工具">
          <button className="iconButton" type="button" title="显示偏好" aria-label="打开显示偏好" onClick={() => openDrawer("display-preferences")}>
            <SlidersHorizontal size={18} aria-hidden="true" />
          </button>
          <button className="iconButton" type="button" title="安全摘要" aria-label="打开安全摘要" onClick={() => openModal("safe-summary")}>
            <Settings size={18} aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="pageFrame">
        <Outlet />
      </main>
      <UiDrawerHost />
      <UiModalHost />
      <ScrollRestoration />
    </div>
  );
}

function UiRouteStateBridge() {
  const location = useLocation();
  const setCurrentPage = useUiStateStore((state) => state.setCurrentPage);

  useEffect(() => {
    const sessionMatch = location.pathname.match(/^\/game\/([^/]+)/);
    setCurrentPage(resolvePageSurface(location.pathname), sessionMatch?.[1] ?? null);
  }, [location.pathname, setCurrentPage]);

  return null;
}

function resolvePageSurface(pathname: string): PageSurface {
  if (pathname === "/") return "home";
  if (pathname.endsWith("/map")) return "map";
  if (pathname.endsWith("/people")) return "people";
  if (pathname.endsWith("/archive")) return "archive";
  if (pathname.endsWith("/exam")) return "exam";
  if (pathname.endsWith("/ranking")) return "ranking";
  if (pathname.endsWith("/court")) return "court";
  if (pathname.endsWith("/settings")) return "settings";
  return "game";
}

function UiDrawerHost() {
  const activeDrawer = useUiStateStore((state) => state.activeDrawer);
  const closeDrawer = useUiStateStore((state) => state.closeDrawer);

  if (!activeDrawer) return null;

  return (
    <aside className="drawerHost" aria-label={getDrawerLabel(activeDrawer)}>
      <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭抽屉" onClick={closeDrawer}>
        <X size={18} aria-hidden="true" />
      </button>
      {activeDrawer === "display-preferences" ? <DisplayPreferencesDrawer /> : null}
      {activeDrawer === "settings" ? <SafeSessionDrawer /> : null}
      {activeDrawer === "saves" ? <SaveDrawer /> : null}
    </aside>
  );
}

function getDrawerLabel(drawer: DrawerSurface) {
  if (drawer === "display-preferences") return "显示偏好";
  if (drawer === "saves") return "存档抽屉";
  return "设置抽屉";
}

function DisplayPreferencesDrawer() {
  const preferences = useUiStateStore((state) => state.displayPreferences);
  const setDisplayPreference = useUiStateStore((state) => state.setDisplayPreference);

  return (
    <section className="drawerContent">
      <p className="eyebrow">印匣</p>
      <h2>显示偏好</h2>
      <label>
        动效
        <select value={preferences.motion} onChange={(event) => setDisplayPreference("motion", event.target.value === "reduced" ? "reduced" : "full")}>
          <option value="full">水墨动效</option>
          <option value="reduced">低动效</option>
        </select>
      </label>
      <label>
        字号
        <select value={preferences.textSize} onChange={(event) => setDisplayPreference("textSize", event.target.value === "large" ? "large" : "standard")}>
          <option value="standard">标准</option>
          <option value="large">大字</option>
        </select>
      </label>
      <label>
        对比度
        <select value={preferences.contrast} onChange={(event) => setDisplayPreference("contrast", event.target.value === "high" ? "high" : "standard")}>
          <option value="standard">宣纸</option>
          <option value="high">浓墨</option>
        </select>
      </label>
      <label className="checkRow">
        <input type="checkbox" checked={preferences.autoScroll} onChange={(event) => setDisplayPreference("autoScroll", event.target.checked)} />
        自动滚动新回合
      </label>
      <label className="checkRow">
        <input type="checkbox" checked={preferences.mapMotion} onChange={(event) => setDisplayPreference("mapMotion", event.target.checked)} />
        舆图动效
      </label>
    </section>
  );
}

function SafeSessionDrawer() {
  const payload = useUiStateStore((state) => state.currentPlayerPayload);

  return (
    <section className="drawerContent">
      <p className="eyebrow">安全摘要</p>
      <h2>当前案卷</h2>
      <p>{payload?.player?.name ? `${payload.player.name}，${payload.player.officeTitle || payload.player.examRank || payload.player.role || "未题身份"}。` : "暂无已载入案卷。"}</p>
    </section>
  );
}

function SaveDrawer() {
  const saves = useGameSessionStore((state) => state.saves);

  return (
    <section className="drawerContent">
      <p className="eyebrow">旧案</p>
      <h2>存档</h2>
      {saves.length ? saves.slice(0, 5).map((save) => <p key={save.sessionId}>{save.playerName || "无名"}：{save.officeTitle || save.examRank || save.role || "未题"}</p>) : <p>暂无可读旧卷。</p>}
    </section>
  );
}

function UiModalHost() {
  const activeModal = useUiStateStore((state) => state.activeModal);
  const closeModal = useUiStateStore((state) => state.closeModal);
  const payload = useUiStateStore((state) => state.currentPlayerPayload);

  if (!activeModal) return null;

  return (
    <div className="modalScrim" role="presentation">
      <section className="modalPanel" role="dialog" aria-modal="true" aria-labelledby="safe-summary-title">
        <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭弹窗" onClick={closeModal}>
          <X size={18} aria-hidden="true" />
        </button>
        <p className="eyebrow">只读投影</p>
        <h2 id="safe-summary-title">安全摘要</h2>
        <p>{payload ? `当前案卷 ${payload.sessionId} 已载入安全玩家投影。` : "尚未载入安全玩家投影。"}</p>
        <p>此处只显示前端 UI 摘要，不读取内部审计原文、模型原文、完整提示词、本地路径或密钥。</p>
      </section>
    </div>
  );
}
