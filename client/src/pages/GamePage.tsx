import type { FormEvent } from "react";
import { NavLink, Outlet, useParams } from "react-router";
import { useEffect, useState } from "react";
import { routeCatalog } from "../routes/routeCatalog";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";

const sessionRoutes = routeCatalog.filter((route) => route.surface === "session");

export function GamePage() {
  const { sessionId = "s74-preview" } = useParams();
  const [actionText, setActionText] = useState("赴书院温习经义，打听近日考期。");
  const loadSession = useGameSessionStore((state) => state.loadSession);
  const submitTurn = useGameSessionStore((state) => state.submitTurn);
  const session = useGameSessionStore((state) => state.currentSession);
  const lastTurn = useGameSessionStore((state) => state.lastTurn);
  const status = useGameSessionStore((state) => state.status);
  const error = useGameSessionStore((state) => state.error);
  const sessionHref = (path: string) => path.replace("s74-preview", sessionId);
  const player = session?.worldState?.player;

  useEffect(() => {
    if (!isRunnableSessionId(sessionId)) return;
    void loadSession(sessionId).catch(() => undefined);
  }, [loadSession, sessionId]);

  async function handleTurn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionText.trim()) return;
    try {
      await submitTurn(sessionId, actionText.trim());
    } catch {
    }
  }

  return (
    <section className="gameSurface" aria-labelledby="game-title">
      <div className="surfaceHeader">
        <p className="eyebrow">案卷编号 {sessionId}</p>
        <h1 id="game-title">主卷</h1>
      </div>
      <div className="gameGrid">
        <article className="surfacePanel">
          <h2>本纪</h2>
          <p>
            {player?.name
              ? `${player.name}，${player.officeTitle || player.examRank || player.role || "未题身份"}。`
              : "风声入座，旧卷重开。堂案、舆图与人物谱牒各归其卷。"}
          </p>
          {lastTurn?.narrative ? <p>{lastTurn.narrative}</p> : null}
        </article>
        <form className="surfacePanel actionPanel" onSubmit={handleTurn}>
          <h2>奏折</h2>
          <label>
            本回合行动
            <textarea value={actionText} onChange={(event) => setActionText(event.target.value)} rows={5} />
          </label>
          <button className="paperButton" type="submit" disabled={status === "loading" || !isRunnableSessionId(sessionId)}>
            {status === "loading" ? "递送中" : "递送奏折"}
          </button>
          {!isRunnableSessionId(sessionId) ? <p>预览案卷不提交行动；从首页新开一卷后即可落笔。</p> : null}
        </form>
      </div>
      {error ? <p className="statusLine" role="alert">{error}</p> : null}
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
