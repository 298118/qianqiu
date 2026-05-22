import { BrainCircuit, Home, Save, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import type { TopicDraftResponse, TopicSurfaceEvidenceRef, TopicSurfaceId, TopicSurfaceView, TurnDraftContext } from "../api";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import type { AssetRegistry } from "../assets/assetRegistry";
import { isRunnableSessionId } from "../routes/sessionId";
import { surfaceRegistry } from "../surfaces/surfaceRegistry";
import { useGameSessionStore } from "../state/gameSessionState";
import type { DrawerSurface, InkboxTab, LocalSurface, ModalSurface } from "../state/uiState";
import { useUiStateStore } from "../state/uiState";
import { Portrait } from "./Portrait";
import { SaveCaseList } from "./SaveCaseList";
import { AiSettingsPanel } from "./AiSettingsPanel";
import { consumeOverlayTrigger } from "./overlayFocus";

type OverlayKind = "drawer" | "modal" | "surface" | "portrait";

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

type DrawerRegistryEntry = {
  readonly label: string;
  readonly render: () => ReactNode;
};

type ModalRegistryEntry = {
  readonly label: string;
  readonly title: string;
};

const drawerRegistry: Record<DrawerSurface, DrawerRegistryEntry> = {
  "display-preferences": { label: "印匣", render: () => <InkboxDrawer /> },
  settings: { label: "印匣", render: () => <InkboxDrawer /> },
  saves: { label: "印匣", render: () => <InkboxDrawer /> }
};

const modalRegistry: Record<ModalSurface, ModalRegistryEntry> = {
  "safe-summary": { label: "安全摘要", title: "安全摘要" },
  "exam-result": { label: "科举结果", title: "科举结果" },
  "confirm-navigation": { label: "离卷确认", title: "离卷确认" }
};

export function SurfaceHost() {
  const activeDrawer = useUiStateStore((state) => state.activeDrawer);
  const activeModal = useUiStateStore((state) => state.activeModal);
  const activeSurface = useUiStateStore((state) => state.activeSurface);
  const activePortraitViewer = useUiStateStore((state) => state.activePortraitViewer);
  const closeDrawer = useUiStateStore((state) => state.closeDrawer);
  const closeModal = useUiStateStore((state) => state.closeModal);
  const closeSurface = useUiStateStore((state) => state.closeSurface);
  const closePortraitViewer = useUiStateStore((state) => state.closePortraitViewer);
  const focusReturnTargetsRef = useRef<Partial<Record<OverlayKind, HTMLElement | null>>>({});
  const lastOverlayRef = useRef<OverlayKind | null>(null);
  const overlayKind: OverlayKind | null = activePortraitViewer ? "portrait" : activeSurface ? "surface" : activeModal ? "modal" : activeDrawer ? "drawer" : null;

  useEffect(() => {
    const previousOverlayKind = lastOverlayRef.current;
    if (previousOverlayKind && previousOverlayKind !== overlayKind) {
      const target = focusReturnTargetsRef.current[previousOverlayKind];
      delete focusReturnTargetsRef.current[previousOverlayKind];
      if (!overlayKind || previousOverlayKind === "portrait") {
        if (target?.isConnected) target.focus();
      }
    }

    const returningFromPortrait = previousOverlayKind === "portrait" && Boolean(overlayKind);
    if (overlayKind && overlayKind !== previousOverlayKind && !returningFromPortrait) {
      focusReturnTargetsRef.current[overlayKind] = consumeOverlayTrigger() ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    if (!overlayKind) focusReturnTargetsRef.current = {};
    lastOverlayRef.current = overlayKind;
  }, [overlayKind]);

  useEffect(() => {
    if (!overlayKind) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (activePortraitViewer) {
        closePortraitViewer();
        return;
      }
      if (activeSurface) {
        closeSurface();
        return;
      }
      if (activeModal) {
        closeModal();
        return;
      }
      if (activeDrawer) closeDrawer();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeDrawer, activeModal, activePortraitViewer, activeSurface, closeDrawer, closeModal, closePortraitViewer, closeSurface, overlayKind]);

  useEffect(() => {
    document.body.toggleAttribute("data-overlay-open", Boolean(overlayKind));
    return () => document.body.removeAttribute("data-overlay-open");
  }, [overlayKind]);

  return (
    <>
      {activeDrawer ? <DrawerHost activeDrawer={activeDrawer} /> : null}
      {activeModal ? <ModalHost activeModal={activeModal} /> : null}
      {activeSurface ? <LocalSurfaceHost activeSurface={activeSurface} /> : null}
      {activePortraitViewer ? <PortraitViewerHost /> : null}
    </>
  );
}

function focusFirstControl(container: HTMLElement | null) {
  if (!container) return;
  const target = container.querySelector<HTMLElement>(focusableSelector) ?? container;
  target.focus();
}

function DrawerHost({ activeDrawer }: { readonly activeDrawer: DrawerSurface }) {
  const closeDrawer = useUiStateStore((state) => state.closeDrawer);
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    focusFirstControl(drawerRef.current);
  }, [activeDrawer]);

  return (
    <aside ref={drawerRef} className="drawerHost" aria-label={drawerRegistry[activeDrawer].label} tabIndex={-1}>
      <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭抽屉" onClick={closeDrawer}>
        <X size={18} aria-hidden="true" />
      </button>
      {drawerRegistry[activeDrawer].render()}
    </aside>
  );
}

const inkboxTabs: readonly {
  readonly id: InkboxTab;
  readonly label: string;
  readonly icon: ReactNode;
}[] = [
  { id: "ai-settings", label: "AI 设置", icon: <BrainCircuit size={16} aria-hidden="true" /> },
  { id: "saves", label: "旧案", icon: <Save size={16} aria-hidden="true" /> },
  { id: "display", label: "显示", icon: <SlidersHorizontal size={16} aria-hidden="true" /> },
  { id: "safe-summary", label: "安全", icon: <ShieldCheck size={16} aria-hidden="true" /> }
];

function InkboxDrawer() {
  const activeTab = useUiStateStore((state) => state.activeInkboxTab);
  const selectInkboxTab = useUiStateStore((state) => state.selectInkboxTab);
  const returnHome = useUiStateStore((state) => state.returnHome);
  const navigate = useNavigate();

  function handleReturnHome() {
    returnHome();
    navigate("/");
  }

  return (
    <section className="drawerContent inkboxDrawer">
      <div className="inkboxHeader">
        <div>
          <p className="eyebrow">印匣</p>
          <h2>案头工具</h2>
        </div>
        <button className="paperButton inkboxHomeButton" type="button" onClick={handleReturnHome}>
          <Home size={16} aria-hidden="true" />
          <span>返回首页</span>
        </button>
      </div>
      <div className="inkboxTabs" role="tablist" aria-label="印匣分栏">
        {inkboxTabs.map((tab) => (
          <button
            key={tab.id}
            className="inkboxTab"
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`inkbox-panel-${tab.id}`}
            id={`inkbox-tab-${tab.id}`}
            onClick={() => selectInkboxTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="inkboxPanel" role="tabpanel" id={`inkbox-panel-${activeTab}`} aria-labelledby={`inkbox-tab-${activeTab}`}>
        {activeTab === "ai-settings" ? <AiSettingsPanel /> : null}
        {activeTab === "saves" ? <SavePanel /> : null}
        {activeTab === "display" ? <DisplayPreferencesPanel /> : null}
        {activeTab === "safe-summary" ? <SafeSummaryPanel /> : null}
      </div>
    </section>
  );
}

function DisplayPreferencesPanel() {
  const preferences = useUiStateStore((state) => state.displayPreferences);
  const setDisplayPreference = useUiStateStore((state) => state.setDisplayPreference);

  return (
    <div className="inkboxTabBody">
      <h3>显示偏好</h3>
      <label>
        动效
        <select value={preferences.motion} onChange={(event) => setDisplayPreference("motion", event.target.value === "reduced" ? "reduced" : "full")}>
          <option value="full">水墨动效</option>
          <option value="reduced">低动效</option>
        </select>
      </label>
      <label>
        字号
        <select value={preferences.textSize} onChange={(event) => setDisplayPreference("textSize", event.target.value === "large" ? "large" : "standard")}>
          <option value="standard">标准</option>
          <option value="large">大字</option>
        </select>
      </label>
      <label>
        对比度
        <select value={preferences.contrast} onChange={(event) => setDisplayPreference("contrast", event.target.value === "high" ? "high" : "standard")}>
          <option value="standard">宣纸</option>
          <option value="high">浓墨</option>
        </select>
      </label>
      <label>
        正文字体
        <select
          value={preferences.bodyFont}
          onChange={(event) => {
            const value = event.target.value;
            setDisplayPreference(
              "bodyFont",
              value === "song-xiaowei" || value === "kai-longcang" || value === "brush-mashan" ? value : "serif-classic"
            );
          }}
        >
          <option value="serif-classic">典籍明晰</option>
          <option value="song-xiaowei">案卷宋刻</option>
          <option value="kai-longcang">山房行楷</option>
          <option value="brush-mashan">榜书墨笔</option>
        </select>
      </label>
      <label className="checkRow">
        <input type="checkbox" checked={preferences.autoScroll} onChange={(event) => setDisplayPreference("autoScroll", event.target.checked)} />
        自动滚动新回合
      </label>
      <label className="checkRow">
        <input type="checkbox" checked={preferences.mapMotion} onChange={(event) => setDisplayPreference("mapMotion", event.target.checked)} />
        舆图动效
      </label>
    </div>
  );
}

function SavePanel() {
  const saves = useGameSessionStore((state) => state.saves);
  const savesStatus = useGameSessionStore((state) => state.savesStatus);
  const refreshSaves = useGameSessionStore((state) => state.refreshSaves);
  const loadSession = useGameSessionStore((state) => state.loadSession);
  const closeDrawer = useUiStateStore((state) => state.closeDrawer);
  const navigate = useNavigate();

  useEffect(() => {
    if (savesStatus === "idle") void refreshSaves();
  }, [refreshSaves, savesStatus]);

  async function handleLoad(sessionId: string) {
    try {
      await loadSession(sessionId);
      closeDrawer();
      navigate(`/game/${sessionId}`);
    } catch {
    }
  }

  return (
    <div className="inkboxTabBody">
      <div className="inkboxPanelHeader">
        <h3>旧案</h3>
        <button className="paperButton" type="button" onClick={() => void refreshSaves()} disabled={savesStatus === "loading"}>
          刷新
        </button>
      </div>
      {saves.length ? (
        <SaveCaseList saves={saves} maxItems={6} actionLabel="载入" onLoad={(sessionId) => void handleLoad(sessionId)} />
      ) : <p>{savesStatus === "loading" ? "正在检点旧案。" : "暂无可读旧卷。"}</p>}
    </div>
  );
}

function SafeSummaryPanel() {
  const payload = useUiStateStore((state) => state.currentPlayerPayload);

  return (
    <div className="inkboxTabBody">
      <h3>安全摘要</h3>
      <p>{payload?.player?.name ? `${payload.player.name}，${payload.player.officeTitle || payload.player.examRank || payload.player.role || "未题身份"}。` : "暂无已载入案卷。"}</p>
      {payload ? (
        <dl className="safeSummaryList">
          <div>
            <dt>案卷</dt>
            <dd>{payload.sessionId.slice(0, 8)}</dd>
          </div>
          <div>
            <dt>来源</dt>
            <dd>{payload.source}</dd>
          </div>
          <div>
            <dt>安全视图</dt>
            <dd>{Object.values(payload.routeViews).filter(Boolean).length} 项可用</dd>
          </div>
        </dl>
      ) : null}
      <p>印匣只读取安全玩家投影和前端 UI 状态，不展示内部推演细节、连接凭据或私密材料。</p>
    </div>
  );
}

function ModalHost({ activeModal }: { readonly activeModal: ModalSurface }) {
  const closeModal = useUiStateStore((state) => state.closeModal);
  const payload = useUiStateStore((state) => state.currentPlayerPayload);
  const entry = modalRegistry[activeModal];
  const modalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    focusFirstControl(modalRef.current);
  }, [activeModal]);

  return (
    <div className="modalScrim" role="presentation">
      <section ref={modalRef} className="modalPanel" role="dialog" aria-modal="true" aria-labelledby={`${activeModal}-title`} tabIndex={-1}>
        <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭弹窗" onClick={closeModal}>
          <X size={18} aria-hidden="true" />
        </button>
        <p className="eyebrow">只读投影</p>
        <h2 id={`${activeModal}-title`}>{entry.title}</h2>
        <p>{payload ? `当前案卷 ${payload.sessionId} 已载入安全玩家投影。` : "尚未载入安全玩家投影。"}</p>
        <p>此处只显示前端 UI 摘要，不展示内部推演细节、连接凭据或私密材料。</p>
      </section>
    </div>
  );
}

function PortraitViewerHost() {
  const viewer = useUiStateStore((state) => state.activePortraitViewer);
  const closePortraitViewer = useUiStateStore((state) => state.closePortraitViewer);
  const { registry, status } = useAssetRegistry();
  const viewerRef = useRef<HTMLElement | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const portrait = viewer && registry ? registry.getPortrait(viewer.portraitRef) : null;
  const fallback = registry?.getFallback(portrait?.fallbackRef);
  const label = viewer?.label || portrait?.roleLabel || portrait?.role || "人物立绘";
  const imageSource = portrait?.path ?? null;

  useEffect(() => {
    focusFirstControl(viewerRef.current);
    setImageFailed(false);
  }, [viewer?.portraitRef]);

  if (!viewer) return null;

  function handleScrimMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) closePortraitViewer();
  }

  return (
    <div className="modalScrim portraitViewerScrim" role="presentation" onMouseDown={handleScrimMouseDown}>
      <section
        ref={viewerRef}
        className="modalPanel portraitViewerPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portrait-viewer-title"
        tabIndex={-1}
        data-portrait-viewer="true"
      >
        <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭高清立绘" onClick={closePortraitViewer}>
          <X size={18} aria-hidden="true" />
        </button>
        <div className="portraitViewerHeader">
          <p className="eyebrow">高清立绘</p>
          <h2 id="portrait-viewer-title">{label}</h2>
          <p>只读查看已审核运行时主图，不写入案卷、网址、浏览器存储或 AI 上下文。</p>
        </div>
        {portrait && imageSource && !imageFailed ? (
          <figure
            className="portraitViewerFigure"
            aria-label={`${label}高清主图`}
            data-portrait-ref={portrait.portraitRef}
            data-portrait-remastered={portrait.hasHighResOverride ? "true" : "false"}
          >
            <img src={imageSource} alt={`${label}高清主图`} decoding="async" onError={() => setImageFailed(true)} />
          </figure>
        ) : (
          <figure
            className="portraitViewerFigure portraitViewerFallback"
            aria-label={`${label}高清主图暂不可用`}
            data-asset-fallback={fallback?.id ?? "fallback-role-silhouette-v1"}
          >
            <span aria-hidden="true">人</span>
            <figcaption>{status === "loading" ? "正在读取立绘索引。" : "高清主图暂不可用。"}</figcaption>
          </figure>
        )}
        <dl className="portraitViewerMeta" aria-label="立绘运行时信息">
          <div>
            <dt>图源</dt>
            <dd>已审核运行时索引</dd>
          </div>
          <div>
            <dt>口径</dt>
            <dd>{portrait?.hasHighResOverride ? "高清重制" : "原图主图"}</dd>
          </div>
          <div>
            <dt>用途</dt>
            <dd>只读欣赏</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

const topicSurfaceIds: readonly TopicSurfaceId[] = [
  "memorial-review",
  "edict-draft",
  "court-debate",
  "trial",
  "war-council",
  "npc-profile"
];

function isTopicSurface(surface: LocalSurface): surface is TopicSurfaceId {
  return topicSurfaceIds.includes(surface as TopicSurfaceId);
}

function uniqueDraftRefs(values: readonly string[] = [], limit = 5) {
  const refs: string[] = [];
  values.forEach((value) => {
    const ref = String(value || "").trim();
    if (!ref || refs.includes(ref)) return;
    refs.push(ref);
  });
  return refs.slice(0, limit);
}

function buildTopicTurnDraftContext(options: {
  readonly activeSurface: LocalSurface;
  readonly topicView: TopicSurfaceView | null;
  readonly topicDraft: TopicDraftResponse | null;
  readonly selectedEvidenceRefs: readonly string[];
  readonly draftKind: string;
}): TurnDraftContext | undefined {
  if (!isTopicSurface(options.activeSurface)) return undefined;
  const draftPayload = options.topicDraft?.surfaceId === options.activeSurface
    ? options.topicDraft.topicDraft
    : null;
  const evidenceRefs = uniqueDraftRefs(
    draftPayload?.evidenceRefs?.length ? draftPayload.evidenceRefs : options.selectedEvidenceRefs
  );
  if (!evidenceRefs.length) return undefined;
  const canonicalEchoRefs = uniqueDraftRefs([
    ...(draftPayload?.canonicalEchoRefs || []),
    ...(options.topicView?.evidenceRefs || [])
      .filter((ref) => evidenceRefs.includes(ref.refId))
      .flatMap((ref) => ref.canonicalEchoRefs || [])
  ]);
  const normalizedDraftKind = draftPayload?.draftKind || options.draftKind || options.topicView?.draftSlots[0]?.draftKind;
  const generatedAtTurn = options.topicDraft?.generatedAtTurn ?? options.topicView?.generatedAtTurn;
  return {
    surfaceId: options.activeSurface,
    evidenceRefs,
    canonicalEchoRefs,
    status: "client_hint",
    ...(normalizedDraftKind ? { draftKind: normalizedDraftKind } : {}),
    ...(generatedAtTurn !== undefined ? { generatedAtTurn } : {})
  };
}

function LocalSurfaceHost({ activeSurface }: { readonly activeSurface: LocalSurface }) {
  const closeSurface = useUiStateStore((state) => state.closeSurface);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const currentSessionId = useUiStateStore((state) => state.currentSessionId);
  const currentSession = useGameSessionStore((state) => state.currentSession);
  const loadTopicSurface = useGameSessionStore((state) => state.loadTopicSurface);
  const requestTopicDraft = useGameSessionStore((state) => state.requestTopicDraft);
  const topicSurface = useGameSessionStore((state) => state.topicSurface);
  const topicSurfaceStatus = useGameSessionStore((state) => state.topicSurfaceStatus);
  const topicDraft = useGameSessionStore((state) => state.topicDraft);
  const topicDraftStatus = useGameSessionStore((state) => state.topicDraftStatus);
  const error = useGameSessionStore((state) => state.error);
  const { registry } = useAssetRegistry();
  const entry = surfaceRegistry[activeSurface];
  const surfaceRef = useRef<HTMLElement | null>(null);
  const canLoadTopicSurface = Boolean(currentSessionId && isRunnableSessionId(currentSessionId) && isTopicSurface(activeSurface));
  const topicView = isTopicSurface(activeSurface) && topicSurface?.topicSurfaceView.surfaceId === activeSurface
    ? topicSurface.topicSurfaceView
    : null;
  const [selectedEvidenceRefs, setSelectedEvidenceRefs] = useState<readonly string[]>([]);
  const [draftKind, setDraftKind] = useState("");
  const [playerNote, setPlayerNote] = useState("");
  const [draftText, setDraftText] = useState(entry.draftText || "");
  const npcProfilePortraits = activeSurface === "npc-profile"
    ? buildNpcProfilePortraits(registry, currentSession, currentSessionId)
    : [];

  useEffect(() => {
    focusFirstControl(surfaceRef.current);
  }, [activeSurface]);

  useEffect(() => {
    setDraftText(entry.draftText || "");
    setPlayerNote("");
    setSelectedEvidenceRefs([]);
    setDraftKind("");
  }, [activeSurface, entry.draftText]);

  useEffect(() => {
    if (!canLoadTopicSurface || !currentSessionId || !isTopicSurface(activeSurface)) return;
    void loadTopicSurface(currentSessionId, activeSurface).catch(() => undefined);
  }, [activeSurface, canLoadTopicSurface, currentSessionId, loadTopicSurface]);

  useEffect(() => {
    if (!topicView) return;
    const firstItemRefs = topicView.items[0]?.evidenceRefs || [];
    const fallbackRefs = topicView.evidenceRefs.slice(0, 2).map((ref) => ref.refId);
    setSelectedEvidenceRefs(firstItemRefs.length ? firstItemRefs : fallbackRefs);
    setDraftKind(topicView.draftSlots[0]?.draftKind || "topic_draft");
  }, [topicView?.surfaceId, topicView?.generatedAtTurn]);

  useEffect(() => {
    if (!topicDraft || topicDraft.surfaceId !== activeSurface) return;
    setDraftText(topicDraft.topicDraft.draftText);
  }, [activeSurface, topicDraft]);

  function toggleEvidenceRef(refId: string) {
    setSelectedEvidenceRefs((current) => {
      if (current.includes(refId)) return current.filter((candidate) => candidate !== refId);
      return [...current.slice(-4), refId];
    });
  }

  async function handleTopicDraft() {
    if (!currentSessionId || !isTopicSurface(activeSurface)) return;
    try {
      const payload = await requestTopicDraft(currentSessionId, {
        surfaceId: activeSurface,
        draftKind: draftKind || topicView?.draftSlots[0]?.draftKind,
        selectedEvidenceRefs,
        playerNote
      });
      setDraftText(payload.topicDraft.draftText);
    } catch {
    }
  }

  function handleWriteDraft() {
    const text = draftText.trim() || entry.draftText || "";
    if (!text) return;
    const draftContext = buildTopicTurnDraftContext({
      activeSurface,
      topicView,
      topicDraft,
      selectedEvidenceRefs,
      draftKind
    });
    setActionDraft({
      source: activeSurface === "map-filter" ? "map-runtime" : "role-surface",
      targetPage: activeSurface === "map-filter" ? "map" : "game",
      ...(draftContext ? { draftContext } : {}),
      text
    });
  }

  return (
    <div className="modalScrim surfaceScrim" role="presentation">
      <section ref={surfaceRef} className="modalPanel localSurfacePanel" role="dialog" aria-modal="true" aria-labelledby={`${entry.id}-title`} tabIndex={-1}>
        <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭专题" onClick={closeSurface}>
          <X size={18} aria-hidden="true" />
        </button>
        <p className="eyebrow">{entry.eyebrow}</p>
        <h2 id={`${entry.id}-title`}>{entry.title}</h2>
        <p>{entry.description}</p>
        <dl className="surfaceSafetyList" aria-label={`${entry.title}安全边界`}>
          <div>
            <dt>数据来源</dt>
            <dd>{topicView ? topicSourceSummary(topicView) : entry.dataSource}</dd>
          </div>
          <div>
            <dt>{topicView ? "材料状态" : "占位状态"}</dt>
            <dd>{topicView ? topicMaterialSummary(topicView) : entry.emptyState}</dd>
          </div>
          <div>
            <dt>裁决边界</dt>
            <dd>{topicView?.authorityBoundary || entry.safetyNote}</dd>
          </div>
        </dl>
        {activeSurface === "npc-profile" && registry && npcProfilePortraits.length ? (
          <NpcProfilePortraitStrip registry={registry} portraits={npcProfilePortraits} />
        ) : null}
        {isTopicSurface(activeSurface) ? (
          <TopicSurfaceWorkbench
            activeSurface={activeSurface}
            canLoad={canLoadTopicSurface}
            entryDraft={entry.draftText || ""}
            error={error}
            draftKind={draftKind}
            draftText={draftText}
            playerNote={playerNote}
            selectedEvidenceRefs={selectedEvidenceRefs}
            status={topicSurfaceStatus}
            draftStatus={topicDraftStatus}
            topicView={topicView}
            onDraftKindChange={setDraftKind}
            onDraftTextChange={setDraftText}
            onPlayerNoteChange={setPlayerNote}
            onToggleEvidenceRef={toggleEvidenceRef}
            onRequestDraft={() => void handleTopicDraft()}
            onWriteDraft={handleWriteDraft}
          />
        ) : (
          entry.draftText ? (
            <button className="paperButton" type="button" onClick={handleWriteDraft}>
              写入奏折草稿
            </button>
          ) : null
        )}
      </section>
    </div>
  );
}

type NpcProfilePortraitRow = {
  readonly id: string;
  readonly name: string;
  readonly identity: string;
  readonly portraitRef: string;
};

const unsafeSurfaceTextFragments = [
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
  "OPENAI" + "_API" + "_KEY",
  "DEEPSEEK" + "_API" + "_KEY",
  "MIMO" + "_API" + "_KEY",
  "ANTHROPIC" + "_API" + "_KEY"
] as const;
const safeSurfacePortraitRefPattern = /^portrait-[a-z0-9][a-z0-9_-]{0,140}$/i;
const unsafeSurfacePortraitRefTokenPattern = /(?:^|[-_])(raw|provider|prompt|hidden|private|key|path|secret|token|api|file|data|http)(?:$|[-_])/i;

function safeSurfaceText(value: unknown, fallback: string, maxLength = 48) {
  const text = typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : fallback;
  const normalized = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /sk-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (unsafeSurfaceTextFragments.some((fragment) => normalized.includes(fragment.toLowerCase()))) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function safeSurfacePortraitRef(registry: AssetRegistry, value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || !safeSurfacePortraitRefPattern.test(text)) return "";
  if (unsafeSurfacePortraitRefTokenPattern.test(text)) return "";
  return registry.getPortrait(text) ? text : "";
}

function buildNpcProfilePortraits(
  registry: AssetRegistry | null,
  session: ReturnType<typeof useGameSessionStore.getState>["currentSession"],
  currentSessionId: string | null
): readonly NpcProfilePortraitRow[] {
  if (!registry || !session || !currentSessionId || session.sessionId !== currentSessionId) return [];
  const rows: NpcProfilePortraitRow[] = [];
  const player = session.worldState?.player;
  const playerPortraitRef = safeSurfacePortraitRef(registry, player?.portraitRef);
  if (player && playerPortraitRef) {
    rows.push({
      id: "player",
      name: safeSurfaceText(player.name, "案主", 32),
      identity: safeSurfaceText(player.officeTitle || player.examRank || player.role, "案主", 36),
      portraitRef: playerPortraitRef
    });
  }

  for (const npc of session.worldPeopleView?.npcs ?? []) {
    if (rows.length >= 4) break;
    if (!npc?.id || !npc.name || npc.visibility === "hidden") continue;
    if ((npc.visibility === "relationship_visible" || npc.visibility === "role_visible") && npc.knownToPlayer === false) continue;
    const portraitRef = safeSurfacePortraitRef(registry, npc.portraitRef);
    if (!portraitRef) continue;
    rows.push({
      id: npc.id,
      name: safeSurfaceText(npc.name, "公开人物", 32),
      identity: safeSurfaceText(npc.rankLabel || npc.genderLabel, "公开人物", 36),
      portraitRef
    });
  }
  return rows;
}

function NpcProfilePortraitStrip({
  portraits,
  registry
}: {
  readonly portraits: readonly NpcProfilePortraitRow[];
  readonly registry: AssetRegistry;
}) {
  return (
    <section className="npcProfilePortraitStrip" aria-label="人物档案公开立绘">
      <div className="topicSurfaceColumnHeader">
        <h3>公开立绘</h3>
        <span>{portraits.length} 张</span>
      </div>
      <div className="npcProfilePortraitGrid">
        {portraits.map((portrait) => (
          <article className="npcProfilePortraitCard" key={portrait.id}>
            <Portrait
              registry={registry}
              portraitRef={portrait.portraitRef}
              label={`${portrait.name}立绘`}
              className="npcProfilePortrait"
            />
            <div>
              <strong>{portrait.name}</strong>
              <span>{portrait.identity}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function topicSourceSummary(topicView: TopicSurfaceView) {
  const sources = (topicView.sourceViews || [])
    .map((source) => `${topicSourceLabel(source.sourceView)} ${String(source.count || 0)} 条`)
    .slice(0, 4);
  return sources.length ? sources.join("；") : "当前专题由服务器安全投影生成。";
}

function topicMaterialSummary(topicView: TopicSurfaceView) {
  if (!topicView.items.length) return topicView.emptyState;
  return `${topicView.items.length} 条材料，${topicView.evidenceRefs.length} 枚可引用证据。`;
}

function topicDomainLabel(domain: unknown) {
  const text = String(domain || "").trim();
  if (text === "people") return "人物";
  if (text === "economy") return "月账";
  if (text === "events") return "案牍";
  return text || "公开材料";
}

function topicSourceLabel(sourceView: unknown) {
  const text = String(sourceView || "").trim();
  if (text === "npcActiveRequestView") return "来函后续";
  if (text === "economyTraceView") return "经济解释";
  return text || "公开投影";
}

function topicEvidenceMeta(ref: TopicSurfaceEvidenceRef) {
  const source = topicSourceLabel(ref.sourceView);
  const domain = topicDomainLabel(ref.domain);
  if (source === "经济解释") return `经济解释 · ${domain}`;
  return source === "来函后续" ? `来函证据 · ${domain}` : domain || source;
}

function TopicSurfaceWorkbench({
  activeSurface,
  canLoad,
  draftKind,
  draftStatus,
  draftText,
  entryDraft,
  error,
  playerNote,
  selectedEvidenceRefs,
  status,
  topicView,
  onDraftKindChange,
  onDraftTextChange,
  onPlayerNoteChange,
  onRequestDraft,
  onToggleEvidenceRef,
  onWriteDraft
}: {
  readonly activeSurface: TopicSurfaceId;
  readonly canLoad: boolean;
  readonly draftKind: string;
  readonly draftStatus: "idle" | "loading" | "ready" | "error";
  readonly draftText: string;
  readonly entryDraft: string;
  readonly error: string | null;
  readonly playerNote: string;
  readonly selectedEvidenceRefs: readonly string[];
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly topicView: TopicSurfaceView | null;
  readonly onDraftKindChange: (value: string) => void;
  readonly onDraftTextChange: (value: string) => void;
  readonly onPlayerNoteChange: (value: string) => void;
  readonly onRequestDraft: () => void;
  readonly onToggleEvidenceRef: (refId: string) => void;
  readonly onWriteDraft: () => void;
}) {
  const evidenceByRef = new Map((topicView?.evidenceRefs || []).map((ref) => [ref.refId, ref]));
  const selectedLabels = selectedEvidenceRefs.map((refId) => evidenceByRef.get(refId)?.label || refId);
  const hasMaterials = Boolean(topicView && (topicView.items.length || topicView.evidenceRefs.length));
  const draftSource = topicView ? "AI 拟稿" : "本地草稿";
  const finalDraftText = draftText;

  if (!canLoad) {
    return (
      <div className="topicSurfaceFallback">
        <p>预览案卷只显示专题模板；真实案卷会载入公开材料、证据引用和 AI 草稿。</p>
        {entryDraft ? (
          <button className="paperButton" type="button" onClick={onWriteDraft}>
            写入奏折草稿
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="topicSurfaceLayout" data-surface-id={activeSurface}>
      <section className="topicSurfaceColumn" aria-label="材料栏">
        <div className="topicSurfaceColumnHeader">
          <h3>材料</h3>
          <span>{status === "loading" ? "检索中" : hasMaterials ? "可阅" : "暂无"}</span>
        </div>
        {topicView?.items.length ? (
          <div className="topicSurfaceItems">
            {topicView.items.map((item) => (
              <article className="topicSurfaceItem" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.statusLabel || "可阅"}</span>
                </div>
                <p>{item.summary}</p>
                <small>{topicSourceLabel(item.sourceView)}</small>
              </article>
            ))}
          </div>
        ) : (
          <p>{status === "loading" ? "正在整理公开材料。" : topicView?.emptyState || "尚未载入专题材料。"}</p>
        )}
      </section>

      <section className="topicSurfaceColumn" aria-label="筹议栏">
        <div className="topicSurfaceColumnHeader">
          <h3>筹议</h3>
          <span>{selectedEvidenceRefs.length} 引</span>
        </div>
        {topicView?.draftSlots.length ? (
          <div className="topicDraftSlots" role="group" aria-label="草稿类型">
            {topicView.draftSlots.map((slot) => (
              <button
                key={slot.id}
                className="topicDraftSlot"
                type="button"
                aria-pressed={(draftKind || topicView.draftSlots[0]?.draftKind) === slot.draftKind}
                onClick={() => onDraftKindChange(slot.draftKind)}
              >
                {slot.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="topicEvidenceList" aria-label="证据勾选">
          {(topicView?.evidenceRefs || []).slice(0, 8).map((ref) => (
            <label className="topicEvidenceRow" key={ref.refId}>
              <input
                type="checkbox"
                checked={selectedEvidenceRefs.includes(ref.refId)}
                onChange={() => onToggleEvidenceRef(ref.refId)}
              />
              <span>
                <strong>{ref.label}</strong>
                <small>{topicEvidenceMeta(ref)}</small>
              </span>
            </label>
          ))}
        </div>
        <label className="topicNoteField">
          按语
          <input value={playerNote} maxLength={120} onChange={(event) => onPlayerNoteChange(event.target.value)} />
        </label>
        {topicView?.scenePreview ? (
          <p className="topicSurfaceMeta">
            参议：{topicView.scenePreview.participantLabels?.length ? topicView.scenePreview.participantLabels.join("、") : "候公开角色入席"}
          </p>
        ) : null}
        <p className="topicSurfaceMeta">{selectedLabels.length ? `已引：${selectedLabels.join("、")}` : "未勾选证据时，将由服务器选取公开材料。"}</p>
      </section>

      <section className="topicSurfaceColumn topicDraftColumn" aria-label="草稿栏">
        <div className="topicSurfaceColumnHeader">
          <h3>草稿</h3>
          <span>{draftStatus === "loading" ? "拟稿中" : draftSource}</span>
        </div>
        <button
          className="paperButton topicAiButton"
          type="button"
          disabled={!topicView || draftStatus === "loading"}
          onClick={onRequestDraft}
        >
          <Sparkles size={16} aria-hidden="true" />
          <span>{draftStatus === "loading" ? "拟稿中" : "AI 拟稿"}</span>
        </button>
        <textarea
          className="topicDraftTextarea"
          value={finalDraftText}
          onChange={(event) => onDraftTextChange(event.target.value)}
          rows={8}
          aria-label="专题草稿正文"
        />
        {draftStatus === "error" ? <p className="statusLine">{error || "专题拟稿已降级为本地草稿。"}</p> : null}
        <button className="paperButton" type="button" disabled={!finalDraftText.trim()} onClick={onWriteDraft}>
          写入底部奏折
        </button>
      </section>
    </div>
  );
}
