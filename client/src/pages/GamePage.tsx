import { NavLink, Outlet, useParams } from "react-router";
import { routeCatalog } from "../routes/routeCatalog";

const sessionRoutes = routeCatalog.filter((route) => route.surface === "session");

export function GamePage() {
  const { sessionId = "s74-preview" } = useParams();
  const sessionHref = (path: string) => path.replace("s74-preview", sessionId);

  return (
    <section className="gameSurface" aria-labelledby="game-title">
      <div className="surfaceHeader">
        <p className="eyebrow">案卷编号 {sessionId}</p>
        <h1 id="game-title">主卷</h1>
      </div>
      <div className="gameGrid">
        <article className="surfacePanel">
          <h2>本纪</h2>
          <p>风声入座，旧卷重开。堂案、舆图与人物谱牒各归其卷。</p>
        </article>
        <article className="surfacePanel">
          <h2>奏折</h2>
          <p>案头留有空牍，待玩家落笔，便可入朝野、赴贡院、问山河。</p>
        </article>
      </div>
      <nav className="sessionNav" aria-label="案卷分册">
        {sessionRoutes.map((route) => (
          <NavLink key={route.id} to={sessionHref(route.href)}>
            {route.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </section>
  );
}
