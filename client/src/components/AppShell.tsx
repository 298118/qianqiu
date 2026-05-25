import { Archive } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";
import { routeCatalog } from "../routes/routeCatalog";
import { isRouteLocalSessionId } from "../routes/sessionId";
import type { PageSurface } from "../state/uiState";
import { useUiStateStore } from "../state/uiState";
import { markOverlayTrigger } from "./overlayFocus";
import { SurfaceHost } from "./SurfaceHost";

const primaryNav = routeCatalog.filter((route) => route.surface === "primary");

export function AppShell() {
  const displayPreferences = useUiStateStore((state) => state.displayPreferences);
  const currentSessionId = useUiStateStore((state) => state.currentSessionId);
  const openInkbox = useUiStateStore((state) => state.openInkbox);
  const returnHome = useUiStateStore((state) => state.returnHome);
  const pageFrameRef = useRef<HTMLElement | null>(null);

  return (
    <div
      className="appShell"
      data-client-entry="react"
      data-router-mode="data"
      data-shell-version="s75-9"
      data-polish-surface="s89-5-material-feedback"
      data-polish-atmosphere="s89-30-shared-material-motion"
      data-polish-entry="s89-32-shell-entry-glass"
      data-motion={displayPreferences.motion}
      data-text-size={displayPreferences.textSize}
      data-contrast={displayPreferences.contrast}
      data-body-font={displayPreferences.bodyFont}
    >
      <UiRouteStateBridge pageFrameRef={pageFrameRef} />
      <header className="topBar" aria-label="千秋主导航" data-polish-controls="s89-16-shell-controls" data-polish-shell="s89-32-shell-entry-glass">
        <Link className="brandMark" to="/" aria-label="返回千秋首页" onClick={returnHome}>
          <span className="brandSeal" aria-hidden="true" />
          <span>
            <strong>千秋</strong>
            <small>案上新卷</small>
          </span>
        </Link>
        <nav className="topNav" aria-label="页面" data-polish-shell-nav="s89-32-main-nav-density">
          {primaryNav.map((route) => (
            <NavLink key={route.id} to={resolvePrimaryHref(route.href, currentSessionId)} end={route.id === "game"}>
              {route.label}
            </NavLink>
          ))}
        </nav>
        <div className="topTools" aria-label="案头工具" data-polish-shell-tools="s89-32-inkbox-entry">
          <button className="inkboxButton" type="button" title="印匣" aria-label="打开印匣" data-polish-controls="s89-16-inkbox-button" onClick={(event) => { markOverlayTrigger(event.currentTarget); openInkbox(); }}>
            <Archive size={18} aria-hidden="true" />
            <span>印匣</span>
          </button>
        </div>
      </header>
      <main ref={pageFrameRef} className="pageFrame" tabIndex={-1}>
        <Outlet />
      </main>
      <SurfaceHost />
      <ScrollRestoration />
    </div>
  );
}

function resolvePrimaryHref(href: string, currentSessionId: string | null) {
  if (!currentSessionId || !isRouteLocalSessionId(currentSessionId)) return href;
  return href.replace("s74-preview", currentSessionId);
}

function UiRouteStateBridge({ pageFrameRef }: { readonly pageFrameRef: RefObject<HTMLElement | null> }) {
  const location = useLocation();
  const setCurrentPage = useUiStateStore((state) => state.setCurrentPage);

  useEffect(() => {
    const sessionMatch = location.pathname.match(/^\/game\/([^/]+)/);
    const routeSessionId = sessionMatch?.[1] ?? null;
    setCurrentPage(
      resolvePageSurface(location.pathname),
      routeSessionId && isRouteLocalSessionId(routeSessionId) ? routeSessionId : null
    );
  }, [location.pathname, setCurrentPage]);

  useEffect(() => {
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
    if (document.activeElement === document.body || document.activeElement?.closest(".topNav")) {
      pageFrameRef.current?.focus();
    }
  }, [location.pathname, pageFrameRef]);

  return null;
}

function resolvePageSurface(pathname: string): PageSurface {
  if (pathname === "/") return "home";
  if (pathname.endsWith("/map")) return "map";
  if (pathname.endsWith("/people")) return "people";
  if (pathname.endsWith("/inventory")) return "inventory";
  if (pathname.endsWith("/archive")) return "archive";
  if (pathname.endsWith("/exam")) return "exam";
  if (pathname.endsWith("/ranking")) return "ranking";
  if (pathname.endsWith("/court")) return "court";
  if (pathname.endsWith("/settings")) return "settings";
  return "game";
}
