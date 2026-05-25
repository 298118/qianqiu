import { useParams } from "react-router";
import { markOverlayTrigger } from "../components/overlayFocus";
import { isRouteLocalSessionId } from "../routes/sessionId";
import { surfaceRegistry } from "../surfaces/surfaceRegistry";
import type { LocalSurface } from "../state/uiState";
import { useUiStateStore } from "../state/uiState";

const mainCourtDeskPolishId = "s89-34-main-court-desk";

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

const courtSurfaceDraftUses: Partial<Record<LocalSurface, string>> = {
  "memorial-review": "检阅公开章奏，择要写成可回主卷续呈的奏稿。",
  "edict-draft": "拟成谕旨初稿，仍须留在案头候主卷回批。",
  "court-debate": "整理廷议题目与诸端利害，先作筹议草稿。",
  trial: "据公开案牍拟审问次序，不补造口供、罪名或判词。",
  "war-council": "按舆图、粮饷与边患摘要拟军议请示，不写成战和结果。",
  "npc-profile": "查阅已见人物与来函线索，只拟拜会、问询或复核草稿。"
};

const courtAgendaItems = [
  { label: "章奏", value: "奏折队列", note: "先读公开章奏，择要成稿。" },
  { label: "谕旨", value: "拟圣旨", note: "只落初稿，候案卷回批。" },
  { label: "朝议", value: "廷议题目", note: "汇总利害，不定终局。" },
  { label: "堂审军议", value: "证据与边患", note: "列明风险，不造判词战果。" }
] as const;

export function CourtPage() {
  const { sessionId = "s74-preview" } = useParams();
  const openSurfaceForSession = useUiStateStore((state) => state.openSurfaceForSession);
  const routeSessionSupported = isRouteLocalSessionId(sessionId);
  const agendaState = routeSessionSupported ? "ready" : "unsupported";

  return (
    <article
      className="surfacePanel routePanel courtSurfacePage"
      aria-labelledby="court-title"
      data-polish-court="s89-17-court-directory"
      data-polish-court-agenda={mainCourtDeskPolishId}
    >
      <div className="surfaceHeader">
        <p className="eyebrow">官署专题</p>
        <h1 id="court-title">朝议与官署</h1>
        <p>百官班列，章奏如潮。此页只作官署案头索引：奏折、圣旨、朝议、堂审、军议与人物档案各按公开卷宗取材，整理可拟草稿，最后仍候案卷回批。</p>
      </div>
      <section
        className="courtAgendaBand"
        aria-labelledby="court-agenda-title"
        data-polish-court-agenda-band={mainCourtDeskPolishId}
        data-agenda-state={agendaState}
      >
        <div className="sectionTitleRow">
          <div>
            <p className="eyebrow">官署议程</p>
            <h2 id="court-agenda-title">御案传签</h2>
          </div>
          <span>{routeSessionSupported ? "六署可查" : "案卷未载"}</span>
        </div>
        <ol className="courtAgendaSteps" aria-label="官署议程读法">
          {courtAgendaItems.map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </li>
          ))}
        </ol>
      </section>
      <div className="courtSurfaceGrid" aria-label="官署专题入口">
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
                  <article
                    key={surface}
                    className="courtSurfaceEntry"
                    data-court-surface={surface}
                    data-court-state={routeSessionSupported ? "ready" : "unsupported"}
                    aria-label={`${entry.label}案头索引`}
                  >
                    <div className="peopleMeta" aria-label={`${entry.label}章法`}>
                      <span>{entry.eyebrow}</span>
                      <span>可拟草稿</span>
                      <span>候案卷回批</span>
                    </div>
                    <p>{entry.description}</p>
                    <dl className="surfaceSafetyList">
                      <div>
                        <dt>卷宗取材</dt>
                        <dd>{formatCourtRegistryLine(entry.dataSource)}</dd>
                      </div>
                      <div>
                        <dt>可拟草稿</dt>
                        <dd>{courtSurfaceDraftUses[surface] ?? "只把公开材料整理为案头草稿，回主卷后再呈递。"}</dd>
                      </div>
                      <div>
                        <dt>案卷未载</dt>
                        <dd>{formatCourtRegistryLine(entry.emptyState)}</dd>
                      </div>
                      <div>
                        <dt>候复边界</dt>
                        <dd>{formatCourtRegistryLine(entry.safetyNote)}</dd>
                      </div>
                    </dl>
                    <button
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
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="statusLine">
        {routeSessionSupported
          ? "这些专题只读已公开卷宗；推演只拟草稿，不递交回合、不定夺任免赏罚。"
          : "此案卷编号暂不可用于浏览器专题层；请从首页开卷或载入旧案。"}
      </p>
    </article>
  );
}

function formatCourtRegistryLine(value: string) {
  return value.replace(/^取材：/, "").trim();
}
