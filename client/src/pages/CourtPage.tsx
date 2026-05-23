import { useParams } from "react-router";
import { markOverlayTrigger } from "../components/overlayFocus";
import { isRouteLocalSessionId } from "../routes/sessionId";
import { surfaceRegistry } from "../surfaces/surfaceRegistry";
import type { LocalSurface } from "../state/uiState";
import { useUiStateStore } from "../state/uiState";

const courtSurfaceGroups: readonly {
  readonly title: string;
  readonly note: string;
  readonly surfaces: readonly LocalSurface[];
}[] = [
  {
    title: "御案与台阁",
    note: "奏折、圣旨与朝议只形成草稿或议题，不直接生效。",
    surfaces: ["memorial-review", "edict-draft", "court-debate"]
  },
  {
    title: "官署与军帐",
    note: "堂审和军议会列公开证据、风险与可提交草稿。",
    surfaces: ["trial", "war-council"]
  },
  {
    title: "谱牒与公开人物",
    note: "人物档案只展示玩家已可见的公开摘要。",
    surfaces: ["npc-profile"]
  }
];

export function CourtPage() {
  const { sessionId = "s74-preview" } = useParams();
  const openSurfaceForSession = useUiStateStore((state) => state.openSurfaceForSession);
  const routeSessionSupported = isRouteLocalSessionId(sessionId);

  return (
    <article className="surfacePanel routePanel courtSurfacePage" aria-labelledby="court-title">
      <div className="surfaceHeader">
        <p className="eyebrow">官署专题</p>
        <h1 id="court-title">朝议与官署</h1>
        <p>百官班列，章奏如潮。奏折、圣旨、朝议、堂审、军议与人物档案现在会从安全专题投影里整理材料、筹议证据并生成可编辑草稿。</p>
      </div>
      <div className="courtSurfaceGrid" aria-label="专题 surface 扩展位">
        {courtSurfaceGroups.map((group) => (
          <section key={group.title} className="courtSurfaceGroup" aria-label={group.title}>
            <div>
              <h3>{group.title}</h3>
              <p>{group.note}</p>
            </div>
            <div className="courtSurfaceActions">
              {group.surfaces.map((surface) => {
                const entry = surfaceRegistry[surface];
                return (
                  <button
                    key={surface}
                    className="paperButton"
                    type="button"
                    disabled={!routeSessionSupported}
                    onClick={(event) => {
                      if (!routeSessionSupported) return;
                      markOverlayTrigger(event.currentTarget);
                      openSurfaceForSession(surface, sessionId);
                    }}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="statusLine">
        {routeSessionSupported
          ? "这些专题层只读安全 projection；AI 只拟草稿，不提交回合、不调用 resolver、不写 canonical state。"
          : "此案卷编号暂不可用于浏览器专题层；请从首页开卷或载入旧案。"}
      </p>
    </article>
  );
}
