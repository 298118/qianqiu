import { NavLink, Outlet, ScrollRestoration } from "react-router";
import { routeCatalog } from "./routes/routeCatalog";

const primaryNav = routeCatalog.filter((route) => route.surface === "primary");

export function App() {
  return (
    <div className="appShell" data-client-entry="react" data-router-mode="data">
      <header className="topBar" aria-label="千秋主导航">
        <a className="brandMark" href="/" aria-label="返回千秋首页">
          <span className="brandSeal" aria-hidden="true" />
          <span>
            <strong>千秋</strong>
            <small>案上新卷</small>
          </span>
        </a>
        <nav className="topNav" aria-label="页面">
          {primaryNav.map((route) => (
            <NavLink key={route.id} to={route.href}>
              {route.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="pageFrame">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}
