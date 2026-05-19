import { Archive } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";
import { routeCatalog } from "../routes/routeCatalog";
import { isRunnableSessionId } from "../routes/sessionId";
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
      data-motion={displayPreferences.motion}
      data-text-size={displayPreferences.textSize}
      data-contrast={displayPreferences.contrast}
      data-body-font={displayPreferences.bodyFont}
    >
      <UiRouteStateBridge pageFrameRef={pageFrameRef} />
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
            <NavLink key={route.id} to={resolvePrimaryHref(route.href, currentSessionId)}>
              {route.label}
            </NavLink>
          ))}
        </nav>
        <div className="topTools" aria-label="案头工具">
          <button className="inkboxButton" type="button" title="印匣" aria-label="打开印匣" onClick={(event) => { markOverlayTrigger(event.currentTarget); openInkbox(); }}>
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
  if (!currentSessionId || !isRunnableSessionId(currentSessionId)) return href;
  return href.replace("s74-preview", currentSessionId);
}

function UiRouteStateBridge({ pageFrameRef }: { readonly pageFrameRef: RefObject<HTMLElement | null> }) {
  const location = useLocation();
  const setCurrentPage = useUiStateStore((state) => state.setCurrentPage);

  useEffect(() => {
    const sessionMatch = location.pathname.match(/^\/game\/([^/]+)/);
    setCurrentPage(resolvePageSurface(location.pathname), sessionMatch?.[1] ?? null);
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
  if (pathname.endsWith("/archive")) return "archive";
  if (pathname.endsWith("/exam")) return "exam";
  if (pathname.endsWith("/ranking")) return "ranking";
  if (pathname.endsWith("/court")) return "court";
  if (pathname.endsWith("/settings")) return "settings";
  return "game";
}
