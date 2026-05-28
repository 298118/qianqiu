import { Link, NavLink, Outlet, useLocation, useParams } from "react-router";
import { BookOpen, FileText, Home, Landmark, Map, Package, ScrollText, Users } from "lucide-react";
import { useEffect, useMemo, type CSSProperties } from "react";
import "../styles/responsive/mobile-game-map.css";
import "../styles/routes/game.css";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import { EmperorPanel } from "../components/EmperorPanel";
import { GeneralPanel } from "../components/GeneralPanel";
import { MagistratePanel } from "../components/MagistratePanel";
import { MemorialComposer } from "../components/MemorialComposer";
import { OfficialMinisterPanel } from "../components/OfficialMinisterPanel";
import { ScholarPanel } from "../components/ScholarPanel";
import { routeCatalog } from "../routes/routeCatalog";
import { isRouteLocalSessionId, isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore, type ActionDraft, type LocalSurface } from "../state/uiState";
import { getPlayerIdentityLabel } from "../text/playerLabels";

const unsafeGameShellFragments = [
  "/api/game/" + "state",
  "/api/dev/" + "session-diagnostics",
  "data" + "/" + "sessions",
  "data" + "\\" + "sessions",
  "file" + "://",
  "raw",
  "prov" + "ider",
  "pro" + "mpt",
  "hid" + "den",
  "key",
  "path",
  "hidden" + "Notes",
  "state" + "Delta",
  "player" + "Delta",
  "evidence" + "Refs",
  "outcome" + "Id",
  "audit" + "Record",
  "state" + "Patch",
  "world" + "State",
  "city" + "Policy" + "Ledger",
  "military" + "Diplomacy" + "Ledger",
  "judicial" + "Case" + "Ledger",
  "npc" + "Economy" + "Ledger",
  "safe" + "_search" + "_index",
  "safe" + "_search" + "_fts",
  "world" + "_sessions",
  "world" + "_state" + "_json",
  "OPENAI" + "_API" + "_KEY",
  "DEEPSEEK" + "_API" + "_KEY",
  "MIMO" + "_API" + "_KEY",
  "ANTHROPIC" + "_API" + "_KEY",
  "完整" + "提示词",
  "提示" + "词",
  "本地" + "路径",
  "密" + "钥",
  "隐" + "藏",
  "私" + "档",
  "模型" + "原始"
] as const;

const sceneByRole: Record<string, { readonly title: string; readonly assetPath: string; readonly sceneKey: string; readonly note: string }> = {
  scholar: {
    title: "书斋夜读",
    assetPath: "/assets/ui/scenes/scene-study-chamber-v1.webp",
    sceneKey: "study_chamber",
    note: "经义、师友与科期仍是案头最紧要的几笔。"
  },
  magistrate: {
    title: "县衙听讼",
    assetPath: "/assets/ui/scenes/scene-county-yamen-v1.webp",
    sceneKey: "county_yamen",
    note: "刑名、钱粮、水利与乡绅关系皆可先拟成奏稿。"
  },
  official: {
    title: "部院公文",
    assetPath: "/assets/ui/scenes/scene-bureau-documents-v1.webp",
    sceneKey: "bureau_documents",
    note: "官职履历、同年座师与考成都待入卷。"
  },
  minister: {
    title: "部院公文",
    assetPath: "/assets/ui/scenes/scene-bureau-documents-v1.webp",
    sceneKey: "bureau_documents",
    note: "朝局牵一发而动全身，奏疏仍须候主卷回批。"
  },
  general: {
    title: "军帐筹谋",
    assetPath: "/assets/ui/scenes/scene-military-tent-v1.webp",
    sceneKey: "military_tent",
    note: "粮饷、斥候、士气与边患只在此处形成行动草稿。"
  },
  emperor: {
    title: "御案临朝",
    assetPath: "/assets/ui/scenes/scene-imperial-desk-v1.webp",
    sceneKey: "imperial_desk",
    note: "圣旨、朝议与任免仍先留作草稿，不直接生效。"
  }
};

const fallbackScene = {
  title: "城市街巷",
  assetPath: "/assets/ui/scenes/scene-city-lanes-v1.webp",
  sceneKey: "city_lanes",
  note: "市井、官署与远方风声都可在主卷里先落成一段行动。"
};

const gameTabs = [
  { id: "map", label: "舆图", icon: Map },
  { id: "people", label: "人物", icon: Users },
  { id: "inventory", label: "囊箧", icon: Package },
  { id: "archive", label: "史册", icon: ScrollText },
  { id: "exam", label: "科举", icon: BookOpen },
  { id: "ranking", label: "皇榜", icon: FileText },
  { id: "court", label: "朝议", icon: Landmark }
] as const;

const independentSessionRouteIds = new Set(["people", "inventory", "archive", "exam", "ranking", "court", "settings"]);
const roleCycleRouteIds = new Set(["game", ...gameTabs.map((tab) => tab.id)]);
const mainCourtDeskPolishId = "s89-34-main-court-desk";
const mainTurnReaderPolishId = "s91-3-main-turn-reader";
const gameDeskGroups = [
  { label: "行旅", items: ["舆图", "史册", "局势", "后果"] },
  { label: "人物", items: ["人物", "来函", "身份"] },
  { label: "账解", items: ["囊箧", "市价", "月账", "账解"] },
  { label: "科举复核", items: ["科期", "复核"] }
] as const;

function safeGameShellText(value: unknown, fallback: string) {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const normalized = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /sk-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  return unsafeGameShellFragments.some((fragment) => normalized.includes(fragment.toLowerCase())) ? fallback : text;
}

function getIdentityLine(player: { readonly role?: string; readonly examRank?: string; readonly officeTitle?: string } | undefined | null) {
  return safeGameShellText(getPlayerIdentityLabel(player), "身份未题");
}

function getKnownRole(role: unknown) {
  return typeof role === "string" && role in sceneByRole ? role : "";
}

function numberFromCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getActionDraftSourceLabel(source: unknown) {
  const labels: Record<string, string> = {
    manual: "手写稿",
    "map-runtime": "舆图摘录",
    "role-surface": "案头摘录",
    "archive-view": "史册摘录",
    exam: "科举草稿"
  };
  return typeof source === "string" && labels[source] ? labels[source] : "本地草稿";
}

function getActionDraftLength(draft: ActionDraft | null) {
  const text = typeof draft?.text === "string" ? draft.text.trim() : "";
  return text.length;
}

function getQuickActionReaderText(status: "idle" | "loading" | "ready" | "error", count: number) {
  if (status === "loading") return "快捷建议正在候成；可先手写行动。";
  if (status === "error") return "快捷建议暂不可取；仍可手写行动。";
  if (status === "ready" && count > 0) return `已有 ${count} 条快捷建议可写入草稿。`;
  if (status === "ready") return "暂无可用快捷建议；可手写行动。";
  return "快捷建议候启；可先手写行动。";
}

function getMainTurnReaderRows(input: {
  readonly playerName: string;
  readonly identityLine: string;
  readonly sceneTitle: string;
  readonly safeViewCount: number;
  readonly safeViewTotal: number;
  readonly draft: ActionDraft | null;
  readonly draftLength: number;
  readonly quickActionStatus: "idle" | "loading" | "ready" | "error";
  readonly quickSuggestionCount: number;
  readonly routeIsLoading: boolean;
  readonly hasRouteError: boolean;
  readonly hasLastTurn: boolean;
}) {
  const draftSource = input.draft ? getActionDraftSourceLabel(input.draft.source) : "未起稿";
  return [
    {
      label: "身份",
      value: `${input.playerName} · ${input.identityLine}`,
      detail: `${input.sceneTitle}；已载 ${input.safeViewCount} / ${input.safeViewTotal} 类公开卷宗。`
    },
    {
      label: "草稿",
      value: input.draft ? `${draftSource}已入奏折` : "尚未落稿",
      detail: input.draft
        ? `草稿约 ${input.draftLength} 字，只在本地候呈。`
        : "可从底部奏折、身份行动或快捷建议起稿。"
    },
    {
      label: "快捷",
      value: getQuickActionReaderText(input.quickActionStatus, input.quickSuggestionCount),
      detail: "写入后仍只是案头草稿，不会自动呈递。"
    },
    {
      label: "回批",
      value: input.hasRouteError
        ? "主卷读取暂阻。"
        : input.routeIsLoading
        ? "主卷候载。"
        : input.hasLastTurn
        ? "上一回批已入本纪。"
        : "呈上后候主卷回批。",
      detail: input.hasRouteError
        ? "显示固定错误，不补造后果。"
        : "不在案头结算资源、官职、考试、关系或未公开事实。"
    }
  ];
}

function getSafeViewReading(items: readonly { readonly label: string; readonly ready: boolean }[]) {
  const readyLabels = items.filter((item) => item.ready).map((item) => item.label);
  if (!readyLabels.length) return "暂无公开卷宗入案；候主卷回批后再展开线索。";
  const visibleLabels = readyLabels.slice(0, 4).join("、");
  const suffix = readyLabels.length > 4 ? "等" : "";
  return `${visibleLabels}${suffix}已入卷，可作线索；未载卷宗不补造。`;
}

export function GamePage() {
  const { sessionId = "s74-preview" } = useParams();
  const location = useLocation();
  const { registry } = useAssetRegistry();
  const loadSession = useGameSessionStore((state) => state.loadSession);
  const submitTurn = useGameSessionStore((state) => state.submitTurn);
  const refreshQuickActions = useGameSessionStore((state) => state.refreshQuickActions);
  const session = useGameSessionStore((state) => state.currentSession);
  const storeCurrentSessionId = useGameSessionStore((state) => state.currentSessionId);
  const lastTurn = useGameSessionStore((state) => state.lastTurn);
  const status = useGameSessionStore((state) => state.status);
  const quickActionStatus = useGameSessionStore((state) => state.quickActionStatus);
  const quickActions = useGameSessionStore((state) => state.quickActions);
  const error = useGameSessionStore((state) => state.error);
  const actionDraft = useUiStateStore((state) => state.actionDraft);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const clearActionDraft = useUiStateStore((state) => state.clearActionDraft);
  const currentPlayerPayload = useUiStateStore((state) => state.currentPlayerPayload);
  const selectTab = useUiStateStore((state) => state.selectTab);
  const openSurfaceForSession = useUiStateStore((state) => state.openSurfaceForSession);
  const routeSessionSupported = isRouteLocalSessionId(sessionId);
  const sessionHref = (path: string) => path.replace("s74-preview", routeSessionSupported ? sessionId : "s74-preview");
  const resolveRoleCycleRouteHref = (routeId: string) => {
    if (!roleCycleRouteIds.has(routeId)) return null;
    const route = routeCatalog.find((entry) => entry.id === routeId);
    return route ? sessionHref(route.href) : null;
  };
  const openRoleCycleSurface = (surface: LocalSurface) => openSurfaceForSession(surface, sessionId);
  const activeSession = routeSessionSupported && session?.sessionId === sessionId ? session : null;
  const activeLastTurn = routeSessionSupported && lastTurn?.sessionId === sessionId ? lastTurn : null;
  const activePlayerPayload = routeSessionSupported && currentPlayerPayload?.sessionId === sessionId ? currentPlayerPayload : null;
  const activeActionDraft = routeSessionSupported && actionDraft?.sessionId === sessionId ? actionDraft : null;
  const activeQuickActionSuggestions = quickActions?.sessionId === sessionId ? quickActions.quickActionSuggestions : null;
  const player = activeSession?.worldState?.player;
  const runnable = isRunnableSessionId(sessionId);
  const routeIsLoading = status === "loading" || (runnable && !activeSession);
  const routeError = error && storeCurrentSessionId === sessionId ? error : null;
  const knownRole = getKnownRole(player?.role);
  const scene = knownRole ? sceneByRole[knownRole] : fallbackScene;
  const sceneAsset = useMemo(
    () => registry?.getAssets({ category: "scene", usage: "game_main", scene: scene.sceneKey }).at(0),
    [registry, scene.sceneKey]
  );
  const roleBackgroundAsset = useMemo(
    () => registry?.getAssets({ category: "role_background", usage: "game_main", role: knownRole || "scholar" }).at(0),
    [knownRole, registry]
  );
  const sceneImagePath = sceneAsset?.path ?? scene.assetPath;
  const sessionDisplayLabel = routeSessionSupported ? sessionId : "暂不可读";
  const playerName = safeGameShellText(player?.name, "无名");
  const identityLine = getIdentityLine(player);
  const narrativeText = safeGameShellText(activeLastTurn?.narrative || activePlayerPayload?.narrativePreview, "风声入座，旧卷重开。堂案、舆图与人物谱牒各归其卷。");
  const openingClaimsView = activeSession?.openingBackgroundClaimsView;
  const openingClaimCounts = openingClaimsView?.counts;
  const openingClaimDecisions = openingClaimsView?.status === "processed" ? openingClaimsView.decisions ?? [] : [];
  const routeViews = activePlayerPayload?.routeViews;
  const safeViewItems = [
    { label: "舆图", ready: Boolean(routeViews?.hasMapRuntimeView) },
    { label: "囊箧", ready: Boolean(routeViews?.hasInventoryView) },
    { label: "人物", ready: Boolean(routeViews?.hasNpcRosterView) },
    { label: "史册", ready: Boolean(routeViews?.hasEventArchiveView) },
    { label: "局势", ready: Boolean(routeViews?.hasInformationPanelView) },
    { label: "市价", ready: Boolean(routeViews?.hasMarketPriceView) },
    { label: "月账", ready: Boolean(routeViews?.hasNpcEconomyView) },
    { label: "账解", ready: Boolean(routeViews?.hasEconomyTraceView) },
    { label: "来函", ready: Boolean(routeViews?.hasNpcActiveRequestView) },
    { label: "身份", ready: Boolean(routeViews?.hasRoleCycleView) },
    { label: "后果", ready: Boolean(routeViews?.hasDomainConsequenceView) },
    { label: "科期", ready: Boolean(routeViews?.hasExamCalendarView) },
    { label: "复核", ready: Boolean(routeViews?.hasAuditSummaryView) }
  ];
  const activeSafeViewCount = safeViewItems.filter((item) => item.ready).length;
  const actionDraftStateLabel = activeActionDraft ? "已有本地草稿" : "暂无草稿";
  const actionDraftSourceLabel = activeActionDraft ? getActionDraftSourceLabel(activeActionDraft.source) : "未起稿";
  const actionDraftLength = getActionDraftLength(activeActionDraft);
  const safeViewReading = getSafeViewReading(safeViewItems);
  const readySafeViewLabels = new Set(safeViewItems.filter((item) => item.ready).map((item) => item.label));
  const deskState = routeIsLoading ? "loading" : activeActionDraft ? "draft" : activeSafeViewCount > 0 ? "ready" : "quiet";
  const deskStateItems = [
    { label: "场景", value: scene.title },
    { label: "卷宗", value: `已载 ${activeSafeViewCount} / ${safeViewItems.length} 类` },
    { label: "草稿", value: activeActionDraft ? "本地草稿候呈" : "尚未落稿" },
    { label: "去处", value: routeSessionSupported ? "各页可查，主卷候复" : "只可预览，先回首页" }
  ];
  const deskGroups = gameDeskGroups.map((group) => {
    const readyCount = group.items.filter((label) => readySafeViewLabels.has(label)).length;
    return {
      ...group,
      readyCount,
      totalCount: group.items.length,
      ready: readyCount > 0
    };
  });
  const turnReaderRows = getMainTurnReaderRows({
    playerName,
    identityLine,
    sceneTitle: scene.title,
    safeViewCount: activeSafeViewCount,
    safeViewTotal: safeViewItems.length,
    draft: activeActionDraft,
    draftLength: actionDraftLength,
    quickActionStatus,
    quickSuggestionCount: activeQuickActionSuggestions?.length ?? 0,
    routeIsLoading,
    hasRouteError: Boolean(routeError),
    hasLastTurn: Boolean(activeLastTurn)
  });
  const isIndependentMapRoute = location.pathname.endsWith("/map");
  const independentRouteId = getIndependentSessionRouteId(location.pathname);
  const isGameRootRoute = location.pathname.replace(/\/+$/, "") === `/game/${sessionId}`;

  useEffect(() => {
    if (!isRunnableSessionId(sessionId)) return;
    void loadSession(sessionId).catch(() => undefined);
  }, [loadSession, sessionId]);

  useEffect(() => {
    if (!runnable || !activePlayerPayload?.sessionId) return;
    void refreshQuickActions(sessionId, {
      page: "game",
      draftPreview: "",
      count: 3
    }).catch(() => undefined);
  }, [activePlayerPayload?.sessionId, activeLastTurn, refreshQuickActions, runnable, sessionId]);

  async function handleTurn(text: string) {
    if (!text.trim() || !runnable) return;
    try {
      await submitTurn(sessionId, text.trim(), activeActionDraft?.draftContext);
    } catch {
    }
  }

  if (isIndependentMapRoute) {
    return <Outlet />;
  }

  if (independentRouteId) {
    return (
      <section className="sessionRouteShell" aria-label="案卷专题页">
        <SessionRouteNav
          selectTab={selectTab}
          sessionHref={sessionHref}
        />
        <Outlet />
      </section>
    );
  }

  if (!routeSessionSupported && isGameRootRoute) {
    return (
      <section className="plainPage routeRecoveryPage statePage" aria-labelledby="game-route-recovery-title" data-polish-route-state="s89-19-game-route-recovery">
        <div className="statePageSeal" aria-hidden="true">
          <ScrollText size={30} />
        </div>
        <div className="statePageCopy">
          <p className="eyebrow">案卷未载</p>
          <h1 id="game-route-recovery-title">主卷不可读</h1>
          <p>此案卷编号不在本地可读范围内。请从首页新开一卷，或续读已保存案卷。</p>
          <p>未读取主卷接口，未打开专题层，也未写入行动草稿。</p>
        </div>
        <div className="buttonRow statePageActions" aria-label="案卷去处">
          <Link className="paperLink" to="/">
            <Home size={16} aria-hidden="true" />
            <span>归首页</span>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="gameSurface hasMemorialComposer" aria-labelledby="game-title" data-polish-game-center={mainCourtDeskPolishId}>
      <div className="gameCommandBar" aria-label="主卷案头" data-polish-game-command={mainCourtDeskPolishId}>
        <div>
          <p className="eyebrow">案卷编号 {sessionDisplayLabel}</p>
          <h1 id="game-title">主卷</h1>
        </div>
        <dl className="gameStatusRail" aria-label="当前案卷摘要">
          <div>
            <dt>案主</dt>
            <dd>{playerName}</dd>
          </div>
          <div>
            <dt>身份</dt>
            <dd>{identityLine}</dd>
          </div>
          <div>
            <dt>已载卷宗</dt>
            <dd>{activeSafeViewCount} / {safeViewItems.length}</dd>
          </div>
        </dl>
      </div>
      <div className="gameSceneBand" style={{ "--scene-image": `url(${sceneImagePath})` } as CSSProperties} data-polish-game-scene={mainCourtDeskPolishId}>
        <div className="gameSceneImage" aria-hidden="true" />
        <div className="gameSceneCopy">
          <p className="eyebrow">当前场景</p>
          <h2>{scene.title}</h2>
          <p>{scene.note}</p>
        </div>
      </div>
      <section
        className="gameDeskCenter"
        aria-labelledby="game-desk-center-title"
        data-polish-game-center-band={mainCourtDeskPolishId}
        data-desk-state={deskState}
      >
        <div className="sectionTitleRow">
          <div>
            <p className="eyebrow">案头中枢</p>
            <h2 id="game-desk-center-title">本卷案桌</h2>
          </div>
          <span>{activeActionDraft ? "朱签待呈" : routeIsLoading ? "候讯" : "可拟行动"}</span>
        </div>
        <ol className="gameDeskCompass" aria-label="主卷案头状态">
          {deskStateItems.map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </li>
          ))}
        </ol>
        <div className="gameDeskMaterialGrid" aria-label="公开卷宗分组读法">
          {deskGroups.map((group) => (
            <article key={group.label} className="gameDeskMaterialCard" data-ready={group.ready ? "true" : "false"}>
              <span>{group.label}</span>
              <strong>{group.readyCount} / {group.totalCount}</strong>
              <p>{group.ready ? "已有公开材料入卷，可据此拟稿。" : "尚无公开材料，未载不补造。"}</p>
            </article>
          ))}
        </div>
        <section className="gameTurnReader" aria-label="本旬行止校阅" data-polish-game-turn-reader={mainTurnReaderPolishId}>
          <div className="gameTurnReaderHeader">
            <p className="eyebrow">行止校阅</p>
            <strong>呈上前先看身份、草稿、快捷建议与回批边界。</strong>
          </div>
          <dl>
            {turnReaderRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  <strong>{row.value}</strong>
                  <span>{row.detail}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <p className="statusLine gameDeskBoundary">未载不补造；行动仍回主卷候复。</p>
      </section>
      <nav className="sessionNav gameFeatureTabs" aria-label="案卷功能页签">
        <SessionRouteNavItems
          selectTab={selectTab}
          sessionHref={sessionHref}
        />
      </nav>
      <div className="gameMainDeck">
        <article className="narrativeScroll paperMotionSurface" aria-labelledby="narrative-title">
          <div className="scrollHeading">
            <div>
              <p className="eyebrow">本纪</p>
              <h2 id="narrative-title">{playerName} · {identityLine}</h2>
            </div>
            <span>{routeIsLoading ? "候讯" : runnable ? "可行事" : "预览"}</span>
          </div>
          <p>{narrativeText}</p>
        </article>
        <aside className="gameSideLedger paperMotionSurface" aria-label="案头索引" data-polish-game="s89-22-main-ledger-reader" data-draft-state={activeActionDraft ? "written" : "empty"}>
          <h2>案头索引</h2>
          <div className="safeViewGrid">
            {safeViewItems.map((item) => (
              <span key={item.label} data-ready={item.ready ? "true" : "false"}>
                {item.label}
              </span>
            ))}
          </div>
          <dl className="surfaceSafetyList" aria-label="本旬行止笺">
            <div className="surfaceSafetyRow paperMotionSurface">
              <dt>本旬行止笺</dt>
              <dd>本卷取材：已载 {activeSafeViewCount} / {safeViewItems.length} 类公开卷宗。</dd>
            </div>
            <div className="surfaceSafetyRow paperMotionSurface">
              <dt>草稿状态</dt>
              <dd>{actionDraftStateLabel}；来处：{actionDraftSourceLabel}。</dd>
            </div>
            <div className="surfaceSafetyRow paperMotionSurface">
              <dt>卷宗读法</dt>
              <dd>{safeViewReading}</dd>
            </div>
          </dl>
          <p className="statusLine" data-polish-game-boundary="s89-22-main-ledger-boundary">
            提交后才由主卷回批；本页不直接结算资源、关系、经济、官职、考试、地图行动或未公开事实。
          </p>
          <p>主卷只读玩家已见的公开卷宗；行动、移动、任免、审案与考试后果仍须呈上后候复。</p>
        </aside>
      </div>
      {openingClaimsView?.status === "processed" ? (
        <section className="openingClaimPanel paperMotionSurface" aria-labelledby="opening-claim-title">
          <div>
            <p className="eyebrow">开局裁决</p>
            <h2 id="opening-claim-title">身世与家计已入案</h2>
            <p>{safeGameShellText(openingClaimsView.publicSummary, "开局背景已入案复核。")}</p>
          </div>
          <dl className="openingClaimCounts" aria-label="开局背景裁决统计">
            <div>
              <dt>采纳</dt>
              <dd>{numberFromCount(openingClaimCounts?.accepted)}</dd>
            </div>
            <div>
              <dt>折算</dt>
              <dd>{numberFromCount(openingClaimCounts?.scaled)}</dd>
            </div>
            <div>
              <dt>风险</dt>
              <dd>{numberFromCount(openingClaimCounts?.risk)}</dd>
            </div>
          </dl>
          {openingClaimDecisions.length ? (
            <div className="openingClaimList" aria-label="开局背景裁决条目">
              {openingClaimDecisions.slice(0, 3).map((decision) => (
                <article key={decision.claimId || decision.publicSummary} className="openingClaimItem">
                  <strong>{safeGameShellText(decision.publicSummary, "背景宣称已裁决。")}</strong>
                  <span>{safeGameShellText(decision.serverReason, "资源、名位与凭证以主卷定夺为准。")}</span>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      {player?.role === "scholar" ? (
        <ScholarPanel
          player={player}
          roleCycleView={activeSession?.roleCycleView ?? null}
          studyProfileView={activeSession?.studyProfileView ?? null}
          examCalendarView={activeSession?.examCalendarView ?? null}
          roleBackgroundPath={roleBackgroundAsset?.path}
          examHref={sessionHref(routeCatalog.find((entry) => entry.id === "exam")?.href ?? "/game/s74-preview/exam")}
          rankingHref={sessionHref(routeCatalog.find((entry) => entry.id === "ranking")?.href ?? "/game/s74-preview/ranking")}
          resolveRoleCycleRouteHref={resolveRoleCycleRouteHref}
          onOpenRoleCycleSurface={openRoleCycleSurface}
          runnable={runnable}
          onDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
        />
      ) : null}
      {player?.role === "magistrate" ? (
        <MagistratePanel
          player={player}
          roleCycleView={activeSession?.roleCycleView ?? null}
          localAffairsDocketView={activeSession?.localAffairsDocketView ?? null}
          officialPostingsView={activeSession?.officialPostingsView ?? null}
          economicFiscalView={activeSession?.economicFiscalView ?? null}
          marketPriceView={activeSession?.marketPriceView ?? null}
          npcEconomyView={activeSession?.npcEconomyView ?? null}
          economyTraceView={activeSession?.economyTraceView ?? null}
          domainConsequenceView={activeSession?.domainConsequenceView ?? null}
          roleBackgroundPath={roleBackgroundAsset?.path}
          resolveRoleCycleRouteHref={resolveRoleCycleRouteHref}
          onOpenRoleCycleSurface={openRoleCycleSurface}
          runnable={runnable}
          onDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
        />
      ) : null}
      {player?.role === "official" || player?.role === "minister" ? (
        <OfficialMinisterPanel
          player={player}
          roleCycleView={activeSession?.roleCycleView ?? null}
          officialCareerView={activeSession?.officialCareerView ?? null}
          appointmentTrackView={activeSession?.appointmentTrackView ?? null}
          officialPostingsView={activeSession?.officialPostingsView ?? null}
          actorMemoryView={activeSession?.actorMemoryView ?? null}
          aiControlAuditView={activeSession?.aiControlAuditView ?? null}
          playerMonthlyBriefingView={activeSession?.playerMonthlyBriefingView ?? null}
          courtConsequenceView={activeSession?.courtConsequenceView ?? null}
          courtResponseView={activeSession?.courtResponseView ?? null}
          economyTraceView={activeSession?.economyTraceView ?? null}
          domainConsequenceView={activeSession?.domainConsequenceView ?? null}
          localRoleSurfaceDraftWritten={activeActionDraft?.source === "role-surface" && activeActionDraft.targetPage === "game"}
          roleBackgroundPath={roleBackgroundAsset?.path}
          courtHref={sessionHref(routeCatalog.find((entry) => entry.id === "court")?.href ?? "/game/s74-preview/court")}
          resolveRoleCycleRouteHref={resolveRoleCycleRouteHref}
          onOpenRoleCycleSurface={openRoleCycleSurface}
          runnable={runnable}
          onDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
        />
      ) : null}
      {player?.role === "general" ? (
        <GeneralPanel
          player={player}
          roleCycleView={activeSession?.roleCycleView ?? null}
          militaryDiplomacyView={activeSession?.militaryDiplomacyView ?? null}
          officialPostingsView={activeSession?.officialPostingsView ?? null}
          mapRuntimeView={activeSession?.mapRuntimeView ?? null}
          eventArchiveView={activeSession?.eventArchiveView ?? null}
          actorMemoryView={activeSession?.actorMemoryView ?? null}
          domainConsequenceView={activeSession?.domainConsequenceView ?? null}
          roleBackgroundPath={roleBackgroundAsset?.path}
          mapHref={sessionHref(routeCatalog.find((entry) => entry.id === "map")?.href ?? "/game/s74-preview/map")}
          archiveHref={sessionHref(routeCatalog.find((entry) => entry.id === "archive")?.href ?? "/game/s74-preview/archive")}
          resolveRoleCycleRouteHref={resolveRoleCycleRouteHref}
          onOpenRoleCycleSurface={openRoleCycleSurface}
          runnable={runnable}
          onDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
        />
      ) : null}
      {player?.role === "emperor" ? (
        <EmperorPanel
          player={player}
          roleCycleView={activeSession?.roleCycleView ?? null}
          officialPostingsView={activeSession?.officialPostingsView ?? null}
          eventArchiveView={activeSession?.eventArchiveView ?? null}
          actorMemoryView={activeSession?.actorMemoryView ?? null}
          aiControlAuditView={activeSession?.aiControlAuditView ?? null}
          worldEntityView={activeSession?.worldEntityView ?? null}
          worldThreadView={activeSession?.worldThreadView ?? null}
          courtConsequenceView={activeSession?.courtConsequenceView ?? null}
          courtResponseView={activeSession?.courtResponseView ?? null}
          domainConsequenceView={activeSession?.domainConsequenceView ?? null}
          mapRuntimeView={activeSession?.mapRuntimeView ?? null}
          roleBackgroundPath={roleBackgroundAsset?.path}
          courtHref={sessionHref(routeCatalog.find((entry) => entry.id === "court")?.href ?? "/game/s74-preview/court")}
          archiveHref={sessionHref(routeCatalog.find((entry) => entry.id === "archive")?.href ?? "/game/s74-preview/archive")}
          resolveRoleCycleRouteHref={resolveRoleCycleRouteHref}
          onOpenRoleCycleSurface={openRoleCycleSurface}
          runnable={runnable}
          onDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
        />
      ) : null}
      {routeError ? <p className="statusLine" role="alert">{routeError}</p> : null}
      <Outlet />
      <MemorialComposer
        actionDraft={activeActionDraft}
        player={activePlayerPayload?.player ?? player}
        routeViews={activePlayerPayload?.routeViews}
        aiSuggestions={activeQuickActionSuggestions}
        quickActionStatus={quickActionStatus}
        runnable={runnable}
        loading={routeIsLoading}
        onDraftChange={(text) => setActionDraft({
          source: "manual",
          targetPage: "game",
          text
        })}
        onSuggestionDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
        onClearDraft={clearActionDraft}
        onRefreshQuickActions={() => {
          void refreshQuickActions(sessionId, {
            page: "game",
            draftPreview: activeActionDraft?.text.slice(0, 80) || "",
            count: 3
          }).catch(() => undefined);
        }}
        onSubmit={handleTurn}
      />
    </section>
  );
}

function getIndependentSessionRouteId(pathname: string) {
  const routeId = pathname.replace(/\/+$/, "").split("/").at(-1) ?? "";
  return independentSessionRouteIds.has(routeId) ? routeId : "";
}

function SessionRouteNav({
  selectTab,
  sessionHref
}: {
  readonly selectTab: (scope: "game", tab: string) => void;
  readonly sessionHref: (path: string) => string;
}) {
  return (
    <nav className="sessionNav gameFeatureTabs" aria-label="案卷功能页签">
      <SessionRouteNavItems selectTab={selectTab} sessionHref={sessionHref} />
    </nav>
  );
}

function SessionRouteNavItems({
  selectTab,
  sessionHref
}: {
  readonly selectTab: (scope: "game", tab: string) => void;
  readonly sessionHref: (path: string) => string;
}) {
  return (
    <>
      {gameTabs.map((tab) => {
        const route = routeCatalog.find((entry) => entry.id === tab.id);
        const Icon = tab.icon;
        if (!route) return null;
        return (
          <NavLink
            key={tab.id}
            to={sessionHref(route.href)}
            onClick={() => selectTab("game", tab.id)}
            className={({ isActive }) => (isActive ? "isSelected" : undefined)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </>
  );
}
