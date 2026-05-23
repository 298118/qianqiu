import { NavLink, Outlet, useLocation, useParams } from "react-router";
import { BookOpen, FileText, Landmark, Map, Package, ScrollText, Settings, Users } from "lucide-react";
import { useEffect, useMemo, type CSSProperties } from "react";
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
import { useUiStateStore, type LocalSurface } from "../state/uiState";

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

const roleLabels: Record<string, string> = {
  scholar: "书生",
  official: "入仕官员",
  emperor: "皇帝",
  minister: "大臣",
  general: "将领",
  magistrate: "县令"
};

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
    note: "朝局牵一发而动全身，奏疏仍须由服务器裁决。"
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
    note: "圣旨、朝议与任免仍是提案入口，不直接生效。"
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
  { id: "court", label: "朝议", icon: Landmark },
  { id: "settings", label: "印匣", icon: Settings }
] as const;

const independentSessionRouteIds = new Set(["exam", "ranking", "court", "settings"]);
const roleCycleRouteIds = new Set(["game", ...gameTabs.map((tab) => tab.id)]);

function safeGameShellText(value: unknown, fallback: string) {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const normalized = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /sk-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  return unsafeGameShellFragments.some((fragment) => normalized.includes(fragment.toLowerCase())) ? fallback : text;
}

function getIdentityLine(player: { readonly role?: string; readonly examRank?: string; readonly officeTitle?: string } | undefined | null) {
  if (!player) return "身份未题";
  return safeGameShellText(
    player.officeTitle || player.examRank || (player.role ? roleLabels[player.role] || player.role : ""),
    "身份未题"
  );
}

function getKnownRole(role: unknown) {
  return typeof role === "string" && role in sceneByRole ? role : "";
}

function numberFromCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const openSurface = useUiStateStore((state) => state.openSurface);
  const routeSessionSupported = isRouteLocalSessionId(sessionId);
  const sessionHref = (path: string) => path.replace("s74-preview", routeSessionSupported ? sessionId : "s74-preview");
  const resolveRoleCycleRouteHref = (routeId: string) => {
    if (!roleCycleRouteIds.has(routeId)) return null;
    const route = routeCatalog.find((entry) => entry.id === routeId);
    return route ? sessionHref(route.href) : null;
  };
  const openRoleCycleSurface = (surface: LocalSurface) => openSurface(surface);
  const activeSession = routeSessionSupported && session?.sessionId === sessionId ? session : null;
  const activeLastTurn = routeSessionSupported && lastTurn?.sessionId === sessionId ? lastTurn : null;
  const activePlayerPayload = routeSessionSupported && currentPlayerPayload?.sessionId === sessionId ? currentPlayerPayload : null;
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
    { label: "审计", ready: Boolean(routeViews?.hasAuditSummaryView) }
  ];
  const activeSafeViewCount = safeViewItems.filter((item) => item.ready).length;
  const isIndependentMapRoute = location.pathname.endsWith("/map");
  const independentRouteId = gameTabs.find((tab) => location.pathname.endsWith(`/${tab.id}`) && independentSessionRouteIds.has(tab.id))?.id ?? "";

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
      await submitTurn(sessionId, text.trim(), actionDraft?.draftContext);
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

  return (
    <section className="gameSurface hasMemorialComposer" aria-labelledby="game-title">
      <div className="gameCommandBar" aria-label="主卷案头">
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
            <dt>安全视图</dt>
            <dd>{activeSafeViewCount} / {safeViewItems.length}</dd>
          </div>
        </dl>
      </div>
      <div className="gameSceneBand" style={{ "--scene-image": `url(${sceneImagePath})` } as CSSProperties}>
        <div className="gameSceneImage" aria-hidden="true" />
        <div className="gameSceneCopy">
          <p className="eyebrow">当前场景</p>
          <h2>{scene.title}</h2>
          <p>{scene.note}</p>
        </div>
      </div>
      <nav className="sessionNav gameFeatureTabs" aria-label="案卷功能页签">
        <SessionRouteNavItems
          selectTab={selectTab}
          sessionHref={sessionHref}
        />
      </nav>
      <div className="gameMainDeck">
        <article className="narrativeScroll" aria-labelledby="narrative-title">
          <div className="scrollHeading">
            <div>
              <p className="eyebrow">本纪</p>
              <h2 id="narrative-title">{playerName} · {identityLine}</h2>
            </div>
            <span>{routeIsLoading ? "候讯" : runnable ? "可行事" : "预览"}</span>
          </div>
          <p>{narrativeText}</p>
        </article>
        <aside className="gameSideLedger" aria-label="安全投影">
          <h2>案头索引</h2>
          <div className="safeViewGrid">
            {safeViewItems.map((item) => (
              <span key={item.label} data-ready={item.ready ? "true" : "false"}>
                {item.label}
              </span>
            ))}
          </div>
          <p>主卷只读服务器清洗后的公开视图；行动、移动、任免、审案与考试后果仍由普通回合接口裁决。</p>
        </aside>
      </div>
      {openingClaimsView?.status === "processed" ? (
        <section className="openingClaimPanel" aria-labelledby="opening-claim-title">
          <div>
            <p className="eyebrow">开局裁决</p>
            <h2 id="opening-claim-title">身世与家计已入案</h2>
            <p>{safeGameShellText(openingClaimsView.publicSummary, "开局背景已由服务器裁决。")}</p>
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
                  <span>{safeGameShellText(decision.serverReason, "资源、名位与凭证以后端裁决为准。")}</span>
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
        actionDraft={actionDraft}
        player={activePlayerPayload?.player ?? player}
        routeViews={activePlayerPayload?.routeViews}
        aiSuggestions={quickActions?.sessionId === sessionId ? quickActions.quickActionSuggestions : null}
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
            draftPreview: actionDraft?.text.slice(0, 80) || "",
            count: 3
          }).catch(() => undefined);
        }}
        onSubmit={handleTurn}
      />
    </section>
  );
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
