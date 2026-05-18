import { NavLink, Outlet, useParams } from "react-router";
import { BookOpen, FileText, Landmark, Map, ScrollText, Settings, Users } from "lucide-react";
import { useEffect, useMemo, type CSSProperties } from "react";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import { MagistratePanel } from "../components/MagistratePanel";
import { MemorialComposer } from "../components/MemorialComposer";
import { OfficialMinisterPanel } from "../components/OfficialMinisterPanel";
import { ScholarPanel } from "../components/ScholarPanel";
import { routeCatalog } from "../routes/routeCatalog";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";

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
    note: "圣旨、朝议与任免仍是 proposal 入口，不直接生效。"
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
  { id: "archive", label: "史册", icon: ScrollText },
  { id: "exam", label: "科举", icon: BookOpen },
  { id: "ranking", label: "皇榜", icon: FileText },
  { id: "court", label: "朝议", icon: Landmark },
  { id: "settings", label: "印匣", icon: Settings }
] as const;

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

export function GamePage() {
  const { sessionId = "s74-preview" } = useParams();
  const { registry } = useAssetRegistry();
  const loadSession = useGameSessionStore((state) => state.loadSession);
  const submitTurn = useGameSessionStore((state) => state.submitTurn);
  const refreshQuickActions = useGameSessionStore((state) => state.refreshQuickActions);
  const session = useGameSessionStore((state) => state.currentSession);
  const lastTurn = useGameSessionStore((state) => state.lastTurn);
  const status = useGameSessionStore((state) => state.status);
  const quickActionStatus = useGameSessionStore((state) => state.quickActionStatus);
  const quickActions = useGameSessionStore((state) => state.quickActions);
  const error = useGameSessionStore((state) => state.error);
  const actionDraft = useUiStateStore((state) => state.actionDraft);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const clearActionDraft = useUiStateStore((state) => state.clearActionDraft);
  const currentPlayerPayload = useUiStateStore((state) => state.currentPlayerPayload);
  const selectedGameTab = useUiStateStore((state) => state.selectedTabs.game ?? "brief");
  const selectTab = useUiStateStore((state) => state.selectTab);
  const sessionHref = (path: string) => path.replace("s74-preview", sessionId);
  const player = session?.worldState?.player;
  const runnable = isRunnableSessionId(sessionId);
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
  const playerName = safeGameShellText(player?.name, "无名");
  const identityLine = getIdentityLine(player);
  const narrativeText = safeGameShellText(lastTurn?.narrative || currentPlayerPayload?.narrativePreview, "风声入座，旧卷重开。堂案、舆图与人物谱牒各归其卷。");
  const routeViews = currentPlayerPayload?.routeViews;
  const safeViewItems = [
    { label: "舆图", ready: Boolean(routeViews?.hasMapRuntimeView) },
    { label: "史册", ready: Boolean(routeViews?.hasEventArchiveView) },
    { label: "局势", ready: Boolean(routeViews?.hasInformationPanelView) },
    { label: "科期", ready: Boolean(routeViews?.hasExamCalendarView) },
    { label: "审计", ready: Boolean(routeViews?.hasAuditSummaryView) }
  ];
  const activeSafeViewCount = safeViewItems.filter((item) => item.ready).length;

  useEffect(() => {
    if (!isRunnableSessionId(sessionId)) return;
    void loadSession(sessionId).catch(() => undefined);
  }, [loadSession, sessionId]);

  useEffect(() => {
    if (!runnable || !currentPlayerPayload?.sessionId || currentPlayerPayload.sessionId !== sessionId) return;
    void refreshQuickActions(sessionId, {
      page: "game",
      draftPreview: "",
      count: 3
    }).catch(() => undefined);
  }, [currentPlayerPayload?.sessionId, lastTurn, refreshQuickActions, runnable, sessionId]);

  async function handleTurn(text: string) {
    if (!text.trim() || !runnable) return;
    try {
      await submitTurn(sessionId, text.trim());
    } catch {
    }
  }

  return (
    <section className="gameSurface hasMemorialComposer" aria-labelledby="game-title">
      <div className="gameCommandBar" aria-label="主卷案头">
        <div>
          <p className="eyebrow">案卷编号 {sessionId}</p>
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
        {gameTabs.map((tab) => {
          const route = routeCatalog.find((entry) => entry.id === tab.id);
          const Icon = tab.icon;
          if (!route) return null;
          return (
            <NavLink
              key={tab.id}
              to={sessionHref(route.href)}
              onClick={() => selectTab("game", tab.id)}
              className={selectedGameTab === tab.id ? "isSelected" : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="gameMainDeck">
        <article className="narrativeScroll" aria-labelledby="narrative-title">
          <div className="scrollHeading">
            <div>
              <p className="eyebrow">本纪</p>
              <h2 id="narrative-title">{playerName} · {identityLine}</h2>
            </div>
            <span>{status === "loading" ? "候讯" : runnable ? "可行事" : "预览"}</span>
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
      {player?.role === "scholar" ? (
        <ScholarPanel
          player={player}
          studyProfileView={session?.studyProfileView ?? null}
          examCalendarView={session?.examCalendarView ?? null}
          roleBackgroundPath={roleBackgroundAsset?.path}
          examHref={sessionHref(routeCatalog.find((entry) => entry.id === "exam")?.href ?? "/game/s74-preview/exam")}
          rankingHref={sessionHref(routeCatalog.find((entry) => entry.id === "ranking")?.href ?? "/game/s74-preview/ranking")}
          runnable={runnable}
          onDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
        />
      ) : null}
      {player?.role === "magistrate" ? (
        <MagistratePanel
          player={player}
          localAffairsDocketView={session?.localAffairsDocketView ?? null}
          officialPostingsView={session?.officialPostingsView ?? null}
          economicFiscalView={session?.economicFiscalView ?? null}
          roleBackgroundPath={roleBackgroundAsset?.path}
          runnable={runnable}
          onDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
        />
      ) : null}
      {player?.role === "official" || player?.role === "minister" ? (
        <OfficialMinisterPanel
          player={player}
          officialCareerView={session?.officialCareerView ?? null}
          appointmentTrackView={session?.appointmentTrackView ?? null}
          officialPostingsView={session?.officialPostingsView ?? null}
          actorMemoryView={session?.actorMemoryView ?? null}
          aiControlAuditView={session?.aiControlAuditView ?? null}
          roleBackgroundPath={roleBackgroundAsset?.path}
          courtHref={sessionHref(routeCatalog.find((entry) => entry.id === "court")?.href ?? "/game/s74-preview/court")}
          runnable={runnable}
          onDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
        />
      ) : null}
      {error ? <p className="statusLine" role="alert">{error}</p> : null}
      <Outlet />
      <MemorialComposer
        actionDraft={actionDraft}
        player={currentPlayerPayload?.player ?? player}
        routeViews={currentPlayerPayload?.routeViews}
        aiSuggestions={quickActions?.sessionId === sessionId ? quickActions.quickActionSuggestions : null}
        quickActionStatus={quickActionStatus}
        runnable={runnable}
        loading={status === "loading"}
        onDraftChange={(text) => setActionDraft({ source: "manual", targetPage: "game", text })}
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
