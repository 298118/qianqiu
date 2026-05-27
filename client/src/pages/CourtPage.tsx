import { useParams } from "react-router";
import "../styles/routes/game.css";
import { CrossPageTraceRail, type CrossPageTraceItem } from "../components/CrossPageTraceRail";
import { markOverlayTrigger } from "../components/overlayFocus";
import { isRouteLocalSessionId } from "../routes/sessionId";
import { surfaceRegistry } from "../surfaces/surfaceRegistry";
import { useGameSessionStore } from "../state/gameSessionState";
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

type CourtReaderRow = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function countNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function countFollowUpEvidence(evidence: unknown) {
  const view = recordValue(evidence);
  const counts = recordValue(view.counts);
  const total = countNumber(counts.total);
  if (total) return total;
  return arrayLength(view.items) + arrayLength(view.people) + arrayLength(view.events) + arrayLength(view.economy);
}

function buildCourtReaderRows(input: {
  readonly archiveCount: number;
  readonly domainCount: number;
  readonly followUpCount: number;
  readonly threadCount: number;
  readonly economyCount: number;
  readonly routeSessionSupported: boolean;
}): CourtReaderRow[] {
  const publicEvidenceCount = input.archiveCount + input.domainCount + input.threadCount + input.economyCount;
  return [
    {
      label: "材料",
      value: input.routeSessionSupported
        ? publicEvidenceCount
          ? `${publicEvidenceCount} 条可读`
          : "候公开材料"
        : "案卷暂不可读",
      detail: "章奏、后果、议题和月账解释只作读卷线索。"
    },
    {
      label: "人物",
      value: input.followUpCount ? `${input.followUpCount} 条来函` : "来函候载",
      detail: "涉及拜会、请托或交游余波时，先回人物页核公开名册。"
    },
    {
      label: "专题",
      value: input.routeSessionSupported ? "六署可开" : "六署停开",
      detail: "专题层负责整理材料、勾选线索和生成候复草稿。"
    },
    {
      label: "候复",
      value: "不定终局",
      detail: "资源、交易、关系、任免、罪名和战和结果仍回案卷回批。"
    }
  ];
}

export function CourtPage() {
  const { sessionId = "s74-preview" } = useParams();
  const currentSession = useGameSessionStore((state) => state.currentSession);
  const openSurfaceForSession = useUiStateStore((state) => state.openSurfaceForSession);
  const routeSessionSupported = isRouteLocalSessionId(sessionId);
  const sessionMatches = routeSessionSupported && currentSession?.sessionId === sessionId;
  const archiveView = recordValue(sessionMatches ? currentSession?.eventArchiveView : null);
  const archiveCounts = recordValue(archiveView.counts);
  const archivePagination = recordValue(archiveView.pagination);
  const archiveCount = countNumber(archivePagination.totalItems ?? archiveCounts.total) || arrayLength(archiveView.items);
  const domainCount = countNumber(archiveCounts.domain_consequence) ||
    arrayLength(recordValue(sessionMatches ? currentSession?.domainConsequenceView : null).recentConsequences);
  const followUpCount = countFollowUpEvidence(sessionMatches ? currentSession?.npcActiveRequestView?.followUpEvidence : null);
  const threadCount = arrayLength(recordValue(sessionMatches ? currentSession?.worldThreadView : null).activeThreads);
  const economyCount = arrayLength(recordValue(sessionMatches ? currentSession?.economyTraceView : null).traceItems);
  const agendaState = routeSessionSupported ? "ready" : "unsupported";
  const readerState = !routeSessionSupported
    ? "unsupported"
    : archiveCount || domainCount || followUpCount || threadCount || economyCount
    ? "ready"
    : "empty";
  const courtReaderRows = buildCourtReaderRows({
    archiveCount,
    domainCount,
    followUpCount,
    threadCount,
    economyCount,
    routeSessionSupported
  });
  const crossTraceItems: readonly CrossPageTraceItem[] = [
    {
      target: "people",
      label: "人物线索",
      value: followUpCount ? `${followUpCount} 条来函` : "查名册",
      detail: "从人物页看公开名册、来函后续和交游余波，再择要带回朝议成题。",
      href: `/game/${sessionId}/people`,
      actionLabel: "查人物"
    },
    {
      target: "archive",
      label: "史册留痕",
      value: archiveCount ? `${archiveCount} 条入册` : "待入册",
      detail: domainCount ? `${domainCount} 条公开后果可回看；案卷未载者不补造。` : "史册只收已入卷条目，未回响时不补造后果。",
      href: `/game/${sessionId}/archive`,
      actionLabel: "查史册"
    },
    {
      target: "game",
      label: "回主卷",
      value: threadCount || economyCount ? `${threadCount} 题 · ${economyCount} 账` : "候复",
      detail: "朝议页只指明读卷路径；真正草稿仍回主卷候复。",
      href: `/game/${sessionId}`,
      actionLabel: "回主卷候复"
    }
  ];

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
      <CrossPageTraceRail
        page="court"
        state={routeSessionSupported ? "ready" : "unsupported"}
        items={crossTraceItems}
        summary="从六署专题读议题，从人物页查来人，从史册页看已留痕后果。"
      />
      <section
        className="courtReaderBand paperMotionSurface"
        aria-label="朝议专题读法"
        data-polish-court-reader="s90-4-archive-court-reader"
        data-court-reader-state={readerState}
      >
        <div className="sectionTitleRow">
          <div>
            <p className="eyebrow">专题读法</p>
            <h2>材料入席</h2>
          </div>
          <span>{readerState === "ready" ? "可筹议" : readerState === "empty" ? "候材料" : "案卷未载"}</span>
        </div>
        <dl className="courtReaderGrid">
          {courtReaderRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
              <dd>{row.detail}</dd>
            </div>
          ))}
        </dl>
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
                      <div className="surfaceSafetyRow paperMotionSurface">
                        <dt>卷宗取材</dt>
                        <dd>{formatCourtRegistryLine(entry.dataSource)}</dd>
                      </div>
                      <div className="surfaceSafetyRow paperMotionSurface">
                        <dt>可拟草稿</dt>
                        <dd>{courtSurfaceDraftUses[surface] ?? "只把公开材料整理为案头草稿，回主卷后再呈递。"}</dd>
                      </div>
                      <div className="surfaceSafetyRow paperMotionSurface">
                        <dt>案卷未载</dt>
                        <dd>{formatCourtRegistryLine(entry.emptyState)}</dd>
                      </div>
                      <div className="surfaceSafetyRow paperMotionSurface">
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
