import { useParams } from "react-router";
import { InkMapRuntimeBridge } from "../components/InkMapRuntimeBridge";
import { markOverlayTrigger } from "../components/overlayFocus";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";

export function MapPage() {
  const { sessionId = "s74-preview" } = useParams();
  const currentSession = useGameSessionStore((state) => state.currentSession);
  const status = useGameSessionStore((state) => state.status);
  const openSurface = useUiStateStore((state) => state.openSurface);
  const displayPreferences = useUiStateStore((state) => state.displayPreferences);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const mapRuntimeView = currentSession?.sessionId === sessionId ? currentSession.mapRuntimeView : null;
  const isRunnable = isRunnableSessionId(sessionId);
  const refCount = mapRuntimeView?.refs?.length ?? 0;
  const routeCount = mapRuntimeView?.routes?.length ?? 0;
  const eventCount = mapRuntimeView?.eventEffects?.length ?? 0;

  return (
    <article className="surfacePanel routePanel" aria-labelledby="map-title">
      <h2 id="map-title">舆图</h2>
      <p>山河分卷，驿路如线。边声、贡院与府县皆可由此入眼。</p>
      <InkMapRuntimeBridge
        mapRuntimeView={mapRuntimeView}
        mapMotionEnabled={displayPreferences.mapMotion && displayPreferences.motion === "full"}
        onActionDraft={(text) => setActionDraft({ source: "map-runtime", targetPage: "game", text })}
      />
      <p className="mapRuntimeNote">
        {mapRuntimeView
          ? `已接入 ${refCount} 处地点、${routeCount} 条路线、${eventCount} 项近事；舆图只读服务器安全投影。`
          : isRunnable && status === "loading"
            ? "正在读取 player-state 中的安全舆图投影。"
            : "预览案卷不请求后端舆图；从首页新开一卷后即可查看实时地图。"}
      </p>
      <button className="paperButton" type="button" onClick={(event) => { markOverlayTrigger(event.currentTarget); openSurface("map-filter"); }}>
        筛舆图
      </button>
    </article>
  );
}
