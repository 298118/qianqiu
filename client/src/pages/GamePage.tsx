import { NavLink, Outlet, useParams } from "react-router";
import { useEffect } from "react";
import { MemorialComposer } from "../components/MemorialComposer";
import { routeCatalog } from "../routes/routeCatalog";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";

const sessionRoutes = routeCatalog.filter((route) => route.surface === "session");

export function GamePage() {
  const { sessionId = "s74-preview" } = useParams();
  const loadSession = useGameSessionStore((state) => state.loadSession);
  const submitTurn = useGameSessionStore((state) => state.submitTurn);
  const session = useGameSessionStore((state) => state.currentSession);
  const lastTurn = useGameSessionStore((state) => state.lastTurn);
  const status = useGameSessionStore((state) => state.status);
  const error = useGameSessionStore((state) => state.error);
  const actionDraft = useUiStateStore((state) => state.actionDraft);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const clearActionDraft = useUiStateStore((state) => state.clearActionDraft);
  const currentPlayerPayload = useUiStateStore((state) => state.currentPlayerPayload);
  const sessionHref = (path: string) => path.replace("s74-preview", sessionId);
  const player = session?.worldState?.player;
  const runnable = isRunnableSessionId(sessionId);

  useEffect(() => {
    if (!isRunnableSessionId(sessionId)) return;
    void loadSession(sessionId).catch(() => undefined);
  }, [loadSession, sessionId]);

  async function handleTurn(text: string) {
    if (!text.trim() || !runnable) return;
    try {
      await submitTurn(sessionId, text.trim());
    } catch {
    }
  }

  return (
    <section className="gameSurface hasMemorialComposer" aria-labelledby="game-title">
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
      <MemorialComposer
        actionDraft={actionDraft}
        player={currentPlayerPayload?.player ?? player}
        routeViews={currentPlayerPayload?.routeViews}
        runnable={runnable}
        loading={status === "loading"}
        onDraftChange={(text) => setActionDraft({ source: "manual", targetPage: "game", text })}
        onSuggestionDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
        onClearDraft={clearActionDraft}
        onSubmit={handleTurn}
      />
    </section>
  );
}
