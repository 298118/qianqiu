import { BrainCircuit, Home, Save, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import type { TopicDraftResponse, TopicSurfaceEvidenceRef, TopicSurfaceId, TopicSurfaceView, TurnDraftContext } from "../api";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import type { AssetRegistry, RuntimePortraitAsset } from "../assets/assetRegistry";
import { isRunnableSessionId } from "../routes/sessionId";
import { surfaceRegistry } from "../surfaces/surfaceRegistry";
import { useGameSessionStore } from "../state/gameSessionState";
import type { DrawerSurface, InkboxTab, LocalSurface, ModalSurface, PortraitViewerProfile } from "../state/uiState";
import { useUiStateStore } from "../state/uiState";
import { getGameRoleLabel, getPlayerIdentityLabel } from "../text/playerLabels";
import { rewritePlayerFacingWorldText } from "../text/worldText";
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
  "safe-summary": { label: "案卷摘要", title: "案卷摘要" },
  "exam-result": { label: "科举结果", title: "科举结果" },
  "confirm-navigation": { label: "离卷确认", title: "离卷确认" }
};

const portraitGalleryPolishId = "s89-35-people-portrait-gallery";

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
      if (event.key === "Tab") {
        if (trapFocusWithin(getActiveOverlayContainer(overlayKind), event)) return;
      }
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

function getFocusableElements(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(focusableSelector)]
    .filter((element) => element.tabIndex >= 0 && !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
}

function getActiveOverlayContainer(kind: OverlayKind | null) {
  if (!kind) return null;
  return document.querySelector<HTMLElement>(`[data-overlay-kind="${kind}"]`);
}

function trapFocusWithin(container: HTMLElement | null, event: KeyboardEvent) {
  if (!container) return false;
  const focusableElements = getFocusableElements(container);
  if (!focusableElements.length) {
    event.preventDefault();
    container.focus();
    return true;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (!activeElement || !container.contains(activeElement)) {
    event.preventDefault();
    (event.shiftKey ? lastElement : firstElement).focus();
    return true;
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return true;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
    return true;
  }

  return false;
}

function DrawerHost({ activeDrawer }: { readonly activeDrawer: DrawerSurface }) {
  const closeDrawer = useUiStateStore((state) => state.closeDrawer);
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    focusFirstControl(drawerRef.current);
  }, [activeDrawer]);

  return (
    <div
      className="drawerScrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDrawer();
      }}
    >
      <aside
        ref={drawerRef}
        className="drawerHost"
        aria-label={drawerRegistry[activeDrawer].label}
        tabIndex={-1}
        data-overlay-kind="drawer"
        data-polish-overlay="s89-5-drawer-mica"
        data-polish-depth="s89-25-liquid-glass"
      >
        <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭抽屉" onClick={closeDrawer}>
          <X size={18} aria-hidden="true" />
        </button>
        {drawerRegistry[activeDrawer].render()}
      </aside>
    </div>
  );
}

const inkboxTabs: readonly {
  readonly id: InkboxTab;
  readonly label: string;
  readonly icon: ReactNode;
}[] = [
  { id: "ai-settings", label: "推演", icon: <BrainCircuit size={16} aria-hidden="true" /> },
  { id: "saves", label: "旧案", icon: <Save size={16} aria-hidden="true" /> },
  { id: "display", label: "卷面", icon: <SlidersHorizontal size={16} aria-hidden="true" /> },
  { id: "safe-summary", label: "摘要", icon: <ShieldCheck size={16} aria-hidden="true" /> }
];

function InkboxDrawer() {
  const activeTab = useUiStateStore((state) => state.activeInkboxTab);
  const selectInkboxTab = useUiStateStore((state) => state.selectInkboxTab);
  const displayPreferences = useUiStateStore((state) => state.displayPreferences);
  const payload = useUiStateStore((state) => state.currentPlayerPayload);
  const returnHome = useUiStateStore((state) => state.returnHome);
  const navigate = useNavigate();
  const loadedRouteCount = payload ? Object.values(payload.routeViews).filter(Boolean).length : 0;
  const playerName = safePayloadPlayerName(payload);
  const playerTitle = safePayloadPlayerTitle(payload);

  function handleReturnHome() {
    returnHome();
    navigate("/");
  }

  return (
    <section className="drawerContent inkboxDrawer" data-polish-inkbox="s89-32-inkbox-glass-ledger">
      <div className="inkboxHeader">
        <div>
          <p className="eyebrow">印匣</p>
          <h2>案头工具</h2>
          <p>推演、卷面、旧案与公开摘要都收在这里。</p>
        </div>
        <button className="paperButton inkboxHomeButton" type="button" onClick={handleReturnHome}>
          <Home size={16} aria-hidden="true" />
          <span>返回首页</span>
        </button>
      </div>
      <section className="inkboxOverview" aria-label="印匣总览" data-polish-settings="s89-13-inkbox-overview" data-polish-inkbox-overview="s89-32-inkbox-glass-ledger">
        <article>
          <span>当前案卷</span>
          <strong>{payload ? playerName : "未载入"}</strong>
          <small>{payload ? `${playerTitle} · ${loadedRouteCount} 类材料` : "开卷后显示公开摘要"}</small>
        </article>
        <article>
          <span>显示章法</span>
          <strong>{displayModeTitle(displayPreferences)}</strong>
          <small>{displayModeDetail(displayPreferences)}</small>
        </article>
      </section>
      <div className="inkboxTabs" role="tablist" aria-label="印匣分栏" data-polish-inkbox-tabs="s89-32-inkbox-glass-ledger">
        {inkboxTabs.map((tab) => (
          <button
            key={tab.id}
            className="inkboxTab paperMotionSelected"
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
      <div className="inkboxPanel" role="tabpanel" id={`inkbox-panel-${activeTab}`} aria-labelledby={`inkbox-tab-${activeTab}`} data-polish-inkbox-panel="s89-32-inkbox-glass-ledger">
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
  const displayLedger = buildDisplayPreferenceLedger(preferences);

  return (
    <div className="inkboxTabBody" data-polish-settings="s89-13-display-panel">
      <h3>卷面偏好</h3>
      <p>只调本机读卷习惯；案卷内容仍回主卷候复。</p>
      <section className="displayPreferenceLedger" aria-label="当前显示章法">
        {displayLedger.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>
      <label>
        动效偏好
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
        自动贴近新回音
      </label>
      <label className="checkRow">
        <input type="checkbox" checked={preferences.mapMotion} onChange={(event) => setDisplayPreference("mapMotion", event.target.checked)} />
        舆图动效
      </label>
    </div>
  );
}

function displayModeTitle(preferences: ReturnType<typeof useUiStateStore.getState>["displayPreferences"]) {
  if (preferences.motion === "reduced") return "静读卷面";
  if (preferences.contrast === "high") return "浓墨清读";
  return "水墨卷面";
}

function displayModeDetail(preferences: ReturnType<typeof useUiStateStore.getState>["displayPreferences"]) {
  const motion = preferences.motion === "reduced" ? "低动效" : "水墨动效";
  const font = bodyFontLabel(preferences.bodyFont);
  return `${motion} · ${font}`;
}

function bodyFontLabel(value: ReturnType<typeof useUiStateStore.getState>["displayPreferences"]["bodyFont"]) {
  if (value === "song-xiaowei") return "案卷宋刻";
  if (value === "kai-longcang") return "山房行楷";
  if (value === "brush-mashan") return "榜书墨笔";
  return "典籍明晰";
}

function buildDisplayPreferenceLedger(preferences: ReturnType<typeof useUiStateStore.getState>["displayPreferences"]) {
  return [
    {
      label: "动效偏好",
      value: preferences.motion === "reduced" ? "静读" : "水墨",
      detail: preferences.motion === "reduced" ? "纸页与浮层保留状态，不走强动画。" : "卷轴、墨晕和按钮回弹保持轻动效。"
    },
    {
      label: "舆图",
      value: preferences.mapMotion ? "流云" : "静图",
      detail: preferences.mapMotion && preferences.motion === "full" ? "舆图标记和流云可动。" : "舆图保留清楚标记，不强行动画。"
    },
    {
      label: "字体字号",
      value: bodyFontLabel(preferences.bodyFont),
      detail: preferences.textSize === "large" ? "大字读卷，长文更易辨认。" : "标准字号，适合常规案牍密度。"
    },
    {
      label: "对比卷面",
      value: preferences.contrast === "high" ? "浓墨" : "宣纸",
      detail: preferences.autoScroll ? "新回合会随卷面自动移至近处。" : "新回合后保留当前阅读位置。"
    }
  ] as const;
}

function SavePanel() {
  const saves = useGameSessionStore((state) => state.saves);
  const savesStatus = useGameSessionStore((state) => state.savesStatus);
  const currentSessionId = useGameSessionStore((state) => state.currentSessionId);
  const refreshSaves = useGameSessionStore((state) => state.refreshSaves);
  const loadSession = useGameSessionStore((state) => state.loadSession);
  const closeDrawer = useUiStateStore((state) => state.closeDrawer);
  const navigate = useNavigate();
  const refreshedMissingSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (savesStatus === "idle") void refreshSaves();
  }, [refreshSaves, savesStatus]);

  useEffect(() => {
    if (!currentSessionId || !isRunnableSessionId(currentSessionId)) return;
    const currentSessionListed = saves.some((save) => save.sessionId === currentSessionId);
    if (currentSessionListed) {
      refreshedMissingSessionRef.current = null;
      return;
    }
    if (savesStatus !== "ready" || refreshedMissingSessionRef.current === currentSessionId) return;
    refreshedMissingSessionRef.current = currentSessionId;
    void refreshSaves();
  }, [currentSessionId, refreshSaves, saves, savesStatus]);

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
        <SaveCaseList saves={prioritizeCurrentSaveCase(saves, currentSessionId)} maxItems={6} actionLabel="载入" onLoad={(sessionId) => void handleLoad(sessionId)} />
      ) : <p>{savesStatus === "loading" ? "正在检点旧案。" : "暂无可读旧卷。"}</p>}
    </div>
  );
}

function prioritizeCurrentSaveCase<T extends { readonly sessionId: string }>(saves: readonly T[], currentSessionId: string | null) {
  if (!currentSessionId) return saves;
  const currentSave = saves.find((save) => save.sessionId === currentSessionId);
  if (!currentSave) return saves;
  return [currentSave, ...saves.filter((save) => save.sessionId !== currentSessionId)];
}

function SafeSummaryPanel() {
  const payload = useUiStateStore((state) => state.currentPlayerPayload);
  const loadedRouteCount = payload ? Object.values(payload.routeViews).filter(Boolean).length : 0;
  const playerName = safePayloadPlayerName(payload);
  const playerTitle = safePayloadPlayerTitle(payload);

  return (
    <div className="inkboxTabBody" data-polish-settings="s89-13-safe-summary">
      <h3>案卷摘要</h3>
      <p>{payload ? `${playerName}，${playerTitle}。` : "暂无已载入案卷。"}</p>
      {payload ? (
        <dl className="safeSummaryList">
          <div>
            <dt>案主</dt>
            <dd>{playerName}</dd>
          </div>
          <div>
            <dt>身份</dt>
            <dd>{playerTitle}</dd>
          </div>
          <div>
            <dt>案号</dt>
            <dd>{payload.sessionId.slice(0, 8)}</dd>
          </div>
          <div>
            <dt>来处</dt>
            <dd>{safePayloadSourceLabel(payload.source)}</dd>
          </div>
          <div>
            <dt>已载材料</dt>
            <dd>{loadedRouteCount} 类可读</dd>
          </div>
        </dl>
      ) : null}
      <p>印匣只显示玩家已见的案卷摘要，不展示内廷私记、连接凭据或未公开材料。</p>
    </div>
  );
}

function safePayloadPlayerName(payload: ReturnType<typeof useUiStateStore.getState>["currentPlayerPayload"]) {
  return payload?.player?.name || "未题名";
}

function safePayloadPlayerTitle(payload: ReturnType<typeof useUiStateStore.getState>["currentPlayerPayload"]) {
  return getPlayerIdentityLabel(payload?.player);
}

function safePayloadSourceLabel(source: string) {
  if (source === "start") return "新卷开局";
  if (source === "turn") return "本旬回音";
  if (source === "exam-submit") return "科场回音";
  return "主卷载入";
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
      <section
        ref={modalRef}
        className="modalPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${activeModal}-title`}
        tabIndex={-1}
        data-overlay-kind="modal"
        data-polish-overlay="s89-5-modal-paper"
        data-polish-depth="s89-25-liquid-glass"
      >
        <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭弹窗" onClick={closeModal}>
          <X size={18} aria-hidden="true" />
        </button>
        <p className="eyebrow">只读案卷</p>
        <h2 id={`${activeModal}-title`}>{entry.title}</h2>
        <p>{payload ? "当前案卷已载入玩家可见摘要。" : "尚未载入可读案卷。"}</p>
        <p>此处只显示案头摘要，不展示内廷私记、连接凭据或未公开材料。</p>
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
  const label = viewer?.label || portraitRolePhrase(portrait) || "人物立绘";
  const imageSource = portrait?.path ?? null;
  const viewerProfile = normalizePortraitViewerProfile(viewer?.profile);
  const viewerCopy = buildPortraitViewerCopy(portrait, viewerProfile, label);
  const viewerState = portrait && imageSource && !imageFailed ? "ready" : "fallback";

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
        data-overlay-kind="portrait"
        data-polish-overlay="s89-5-portrait-gallery"
        data-polish-depth="s89-25-liquid-glass"
        data-polish-portrait="s89-8-life-scroll"
        data-polish-portrait-viewer={portraitGalleryPolishId}
        data-viewer-state={viewerState}
      >
        <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭高清立绘" onClick={closePortraitViewer}>
          <X size={18} aria-hidden="true" />
        </button>
        <div className="portraitViewerInfo">
          <div className="portraitViewerHeader">
            <p className="eyebrow">高清立绘</p>
            <h2 id="portrait-viewer-title">{label}</h2>
            <p>{viewerCopy.caption}</p>
          </div>
          <div className="portraitViewerProfile" aria-label="人物公开说明" data-polish-profile="s89-6-portrait-life">
            <div className="portraitViewerProfileHeader">
              <span>观画印象</span>
              <strong>{viewerCopy.displayName}</strong>
              <small>{viewerCopy.identity}</small>
            </div>
            {viewerCopy.tags.length ? (
              <div className="portraitViewerTags" aria-label="人物公开标签">
                {viewerCopy.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            ) : null}
            <div className="portraitViewerTags portraitViewerCueGrid" aria-label="画卷题签" data-polish-cue="s89-9-portrait-cue-material">
              {viewerCopy.cues.map((cue) => (
                <span key={`${cue.label}-${cue.value}`}>
                  <b>{cue.label}</b>
                  {cue.value}
                </span>
              ))}
            </div>
            <dl className="portraitViewerDossierRail portraitViewerReadRail" aria-label="画卷三读">
              {viewerCopy.readerRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.text}</dd>
                </div>
              ))}
            </dl>
            <section>
              <h3>外貌介绍</h3>
              <p>{viewerCopy.appearance}</p>
            </section>
            <section>
              <h3>生平介绍</h3>
              <p>{viewerCopy.biography}</p>
            </section>
            <section>
              <h3>当前情况</h3>
              <p>{viewerCopy.current}</p>
            </section>
            <dl className="portraitViewerDossierRail" aria-label="画屏案读" data-polish-portrait-dossier={portraitGalleryPolishId}>
              <div>
                <dt>画屏案读</dt>
                <dd>{viewerCopy.displayName}</dd>
              </div>
              <div>
                <dt>身份</dt>
                <dd>{viewerCopy.identity || "公开人物"}</dd>
              </div>
              <div>
                <dt>题签</dt>
                <dd>{viewerCopy.tags.slice(0, 3).join("、") || "题签候载"}</dd>
              </div>
              <div>
                <dt>观画</dt>
                <dd>{portrait?.hasHighResOverride ? "高清重制" : portrait ? "常规画幅" : "纸底占位"}</dd>
              </div>
            </dl>
          </div>
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
        <dl className="portraitViewerMeta" aria-label="画卷说明">
          <div>
            <dt>画卷</dt>
            <dd>已审阅立绘</dd>
          </div>
          <div>
            <dt>清晰度</dt>
            <dd>{portrait?.hasHighResOverride ? "高清重制" : "常规主图"}</dd>
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

const unsafePortraitViewerFragments = [
  "raw",
  "prov" + "ider",
  "pro" + "mpt",
  "hid" + "den",
  "key",
  "path",
  "ledger",
  "manifest",
  "schema",
  "draft" + "Context",
  "server" + " adjudication",
  "OPENAI" + "_API" + "_KEY",
  "DEEPSEEK" + "_API" + "_KEY",
  "MIMO" + "_API" + "_KEY",
  "ANTHROPIC" + "_API" + "_KEY",
  "本地" + "路径",
  "密" + "钥",
  "完整" + "清单",
  "完整" + "提示词",
  "隐" + "藏",
  "私" + "档",
  "工程",
  "像素"
] as const;

function cleanPortraitViewerText(value: unknown, fallback: string, maxLength = 160) {
  const rawText = typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : "";
  if (!rawText) return fallback;
  const normalized = rawText.toLowerCase();
  if (unsafePortraitViewerFragments.some((fragment) => normalized.includes(fragment.toLowerCase()))) return fallback;
  return safeSurfaceText(rawText, fallback, maxLength);
}

function normalizePortraitViewerProfile(profile: PortraitViewerProfile | undefined) {
  if (!profile) return null;
  const normalized: PortraitViewerProfile = {
    name: cleanPortraitViewerText(profile.name, "", 36),
    identity: cleanPortraitViewerText(profile.identity, "", 56),
    summary: cleanPortraitViewerText(profile.summary, "", 220),
    current: cleanPortraitViewerText(profile.current, "", 180),
    tags: (profile.tags ?? []).map((tag) => cleanPortraitViewerText(tag, "", 28)).filter(Boolean).slice(0, 8)
  };
  return normalized.name || normalized.identity || normalized.summary || normalized.current || normalized.tags?.length
    ? normalized
    : null;
}

function buildPortraitViewerCopy(
  portrait: RuntimePortraitAsset | null,
  profile: PortraitViewerProfile | null,
  label: string
) {
  const displayName = cleanPortraitName(profile?.name || label.replace(/立绘$/u, ""), "此人");
  const identity = cleanPortraitViewerText(profile?.identity, portraitRolePhrase(portrait), 56);
  const tagPhrases = portraitTagPhrases(portrait, profile?.tags);
  const emotion = portraitEmotionPhrase(portrait);
  const age = portraitAgePhrase(portrait);
  const presentation = portraitPresentationPhrase(portrait);
  const posture = portraitPosturePhrase(portrait, tagPhrases, identity);
  const dress = portraitDressPhrase(portrait, tagPhrases);
  const setting = portraitSettingPhrase(portrait, tagPhrases, identity);
  const tags = buildPortraitViewerTags(identity, tagPhrases, profile?.tags);
  const cues = [
    { label: "画卷题签", value: setting },
    { label: "仪态", value: `${age}${presentation}` },
    { label: "衣饰", value: dress },
    { label: "神采", value: emotion }
  ];
  const caption = `${displayName} · ${identity || "公开人物"}。只读观画，旁读公开小传与近况。`;
  const appearance = [
    `画中所见：${displayName}呈${age}${presentation}仪态，${dress}，${posture}`,
    `${setting}；${emotion}，可作观画印象，不添写画外未载之事。`
  ].join("。");

  const summary = cleanPortraitViewerText(profile?.summary, "", 220);
  const biography = summary
    ? `身世线索据公开传略整理：${summary} 其师友、任所、家世或旧事若未入卷，只以后续公开案卷补录。`
    : `身世线索据画卷题签整理：${displayName}以${identity || "公开人物"}入卷，约可见${dress}与${posture}；生平细节尚未详载。`;

  const currentSummary = cleanPortraitViewerText(profile?.current, "", 180);
  const current = (currentSummary ? `眼下处境：${currentSummary}` : "") ||
    (profile?.identity
      ? `眼下处境：${displayName}当前以“${identity}”见于公开卷宗；公开近况未详，候复后再补。`
      : `眼下处境：${displayName}当前情况案卷未载；只可观其已审阅立绘，公开近况候复。`);
  const readerRows = [
    {
      label: "画中所见",
      text: cleanPortraitViewerText(`${dress}；${emotion}`, "衣冠神采可细看。", 88)
    },
    {
      label: "身世线索",
      text: summary ? cleanPortraitViewerText(summary, "身世线索候载。", 88) : cleanPortraitViewerText(`${identity || "公开人物"}，生平细节尚未详载。`, "身世线索候载。", 88)
    },
    {
      label: "眼下处境",
      text: currentSummary ? cleanPortraitViewerText(currentSummary, "近况候复。", 88) : "近况案卷未载，候复后再补。"
    }
  ] as const;

  return { appearance, biography, caption, cues, current, displayName, identity, readerRows, tags };
}

function cleanPortraitName(value: unknown, fallback: string) {
  return cleanPortraitViewerText(value, fallback, 36).replace(/高清主图|高清立绘|立绘/gu, "").trim() || fallback;
}

function portraitRolePhrase(portrait: RuntimePortraitAsset | null) {
  const role = portrait?.role || portrait?.roleStage || "";
  const labels: Record<string, string> = {
    scholar: "书生",
    official: "官员",
    magistrate: "地方官",
    general: "将领",
    minister: "朝臣",
    emperor: "帝王",
    npc_clerk: "书吏",
    merchant: "商旅人物",
    commoner: "市井人物",
    junior_official: "初入仕官员",
    student: "读书人",
    juren: "举人",
    jinshi: "进士",
    clerk: "书吏",
    recovered_highres_patch: "公开人物",
    recovered_female_highres: "公开人物"
  };
  return labels[role] || (portrait?.roleLabel && !/recovered|母版|master/i.test(portrait.roleLabel)
    ? cleanPortraitViewerText(portrait.roleLabel, "公开人物", 36)
    : "公开人物");
}

function portraitAgePhrase(portrait: RuntimePortraitAsset | null) {
  const labels: Record<string, string> = {
    adult_young: "青年",
    adult_middle: "壮年",
    adult_mature: "老成",
    adult: "成丁"
  };
  return labels[portrait?.ageBand ?? ""] || "成丁";
}

function portraitPresentationPhrase(portrait: RuntimePortraitAsset | null) {
  if (portrait?.genderPresentation === "feminine") return "女性装束";
  if (portrait?.genderPresentation === "masculine") return "男性装束";
  return "中性装束";
}

function portraitEmotionPhrase(portrait: RuntimePortraitAsset | null) {
  const labels: Record<string, string> = {
    neutral: "神情平和",
    baseline: "神情平和",
    focused: "神情凝定",
    cautious: "神情谨慎",
    reserved: "神情含蓄",
    stern_clear: "神情严整",
    calm_proud: "神情沉稳自持",
    poised: "神情端正"
  };
  return labels[portrait?.emotionVariant ?? ""] || labels[portrait?.emotionTags?.[0] ?? ""] || "神情端正";
}

function portraitDressPhrase(portrait: RuntimePortraitAsset | null, tagPhrases: readonly string[]) {
  if (tagPhrases.includes("装束端雅")) return "衣褶端雅，发饰与襟袖收束清楚";
  if (tagPhrases.includes("有军旅气")) return "衣甲或束带带军旅气，轮廓利落";
  if (tagPhrases.includes("有朝堂仪度")) return "冠服层次整肃，有朝堂仪度";
  if (tagPhrases.includes("有公门气") || tagPhrases.includes("有官署仪度")) return "衣冠近案牍公门，色调沉稳";
  if (tagPhrases.includes("有商旅气") || tagPhrases.includes("有市井气")) return "衣料朴实，带行旅市井之色";
  if (portrait?.hasHighResOverride) return "线条较清，衣纹与面部轮廓可细看";
  return "衣冠轮廓分明，墨色收束";
}

function portraitPosturePhrase(portrait: RuntimePortraitAsset | null, tagPhrases: readonly string[], identity: string) {
  if (/帝王|朝臣|官员|地方官|入仕/.test(identity)) return "身姿端正，像是待入公堂或朝班";
  if (/书生|读书|举人|进士/.test(identity) || tagPhrases.includes("带书卷气")) return "肩背收敛，带寒窗读卷后的清谨";
  if (tagPhrases.includes("有军旅气") || tagPhrases.includes("有边地风尘")) return "站姿较稳，带边地风尘与军中戒备";
  if (portrait?.genderPresentation === "feminine") return "姿态端庄，目光含蓄而不失精神";
  return "身姿平稳，面目可辨";
}

function portraitSettingPhrase(portrait: RuntimePortraitAsset | null, tagPhrases: readonly string[], identity: string) {
  if (tagPhrases.includes("近案牍文书") || tagPhrases.includes("近簿册案牍")) return "画面气息近书案文牍";
  if (tagPhrases.includes("有朝堂仪度") || /帝王|朝臣/.test(identity)) return "画面气息近朝堂仪仗";
  if (tagPhrases.includes("有军旅气") || tagPhrases.includes("有边地风尘")) return "画面气息近营垒边关";
  if (tagPhrases.includes("有商旅气") || tagPhrases.includes("有市井气")) return "画面气息近市井行旅";
  return portrait?.hasHighResOverride ? "画面线条较清，适合细看衣纹与神采" : "画面以水墨人物为主";
}

function portraitTagPhrases(portrait: RuntimePortraitAsset | null, profileTags: readonly string[] = []) {
  const tokenMap: Record<string, string> = {
    book: "带书卷气",
    formal_scholar: "衣冠整肃",
    document: "近案牍文书",
    ledger: "近簿册案牍",
    local_office: "有公门气",
    county_yamen: "有县署气",
    public_official: "有官署仪度",
    general: "有军旅气",
    military: "有军旅气",
    army: "有军旅气",
    frontier: "有边地风尘",
    merchant: "有商旅气",
    market: "有市井气",
    court: "有朝堂仪度",
    palace: "有朝堂仪度",
    blue_gray_robe: "衣色素雅",
    female_style: "装束端雅",
    female_explicit: "装束端雅",
    high_resolution_master: "线条较清晰",
    recovered_female_highres: "线条较清晰",
    new_success: "带新科气"
  };
  const tokens = [...(portrait?.identityTags ?? []), ...(portrait?.emotionTags ?? [])];
  const phrases = [...tokens, ...profileTags]
    .map((token) => tokenMap[String(token)] || "")
    .filter(Boolean);
  return [...new Set(phrases)].slice(0, 4);
}

function buildPortraitViewerTags(identity: string, tagPhrases: readonly string[], profileTags: readonly string[] = []) {
  const tags = [identity, ...profileTags, ...tagPhrases]
    .map((tag) => cleanPortraitViewerText(tag, "", 24))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 5);
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
  const topicView = isTopicSurface(activeSurface) && topicSurface?.sessionId === currentSessionId && topicSurface.topicSurfaceView.surfaceId === activeSurface
    ? topicSurface.topicSurfaceView
    : null;
  const activeTopicDraft = isTopicSurface(activeSurface) && topicDraft?.sessionId === currentSessionId && topicDraft.surfaceId === activeSurface
    ? topicDraft
    : null;
  const [selectedEvidenceRefs, setSelectedEvidenceRefs] = useState<readonly string[]>([]);
  const [draftKind, setDraftKind] = useState("");
  const [playerNote, setPlayerNote] = useState("");
  const [draftText, setDraftText] = useState(entry.draftText || "");
  const [localSurfaceSessionId, setLocalSurfaceSessionId] = useState<string | null>(currentSessionId ?? null);
  const localSurfaceStateIsCurrent = localSurfaceSessionId === (currentSessionId ?? null);
  const activeSelectedEvidenceRefs = localSurfaceStateIsCurrent ? selectedEvidenceRefs : [];
  const activeDraftKind = localSurfaceStateIsCurrent ? draftKind : "";
  const activePlayerNote = localSurfaceStateIsCurrent ? playerNote : "";
  const activeDraftText = localSurfaceStateIsCurrent ? draftText : entry.draftText || "";
  const npcProfilePortraits = activeSurface === "npc-profile"
    ? buildNpcProfilePortraits(registry, currentSession, currentSessionId)
    : [];
  const mapFilterSummary = activeSurface === "map-filter"
    ? buildMapFilterSummary(currentSession, currentSessionId)
    : null;
  const surfaceState = isTopicSurface(activeSurface)
    ? topicSurfaceState(topicView, topicSurfaceStatus, canLoadTopicSurface)
    : mapFilterSummary && !mapFilterSummary.totalCues
      ? "empty"
      : "ready";

  useEffect(() => {
    focusFirstControl(surfaceRef.current);
  }, [activeSurface]);

  useEffect(() => {
    setLocalSurfaceSessionId(currentSessionId ?? null);
    setDraftText(entry.draftText || "");
    setPlayerNote("");
    setSelectedEvidenceRefs([]);
    setDraftKind("");
  }, [activeSurface, currentSessionId, entry.draftText]);

  useEffect(() => {
    if (!canLoadTopicSurface || !currentSessionId || !isTopicSurface(activeSurface)) return;
    void loadTopicSurface(currentSessionId, activeSurface).catch(() => undefined);
  }, [activeSurface, canLoadTopicSurface, currentSessionId, loadTopicSurface]);

  useEffect(() => {
    if (!topicView) return;
    const firstItemRefs = topicView.items[0]?.evidenceRefs || [];
    const fallbackRefs = topicView.evidenceRefs.slice(0, 2).map((ref) => ref.refId);
    setLocalSurfaceSessionId(currentSessionId ?? null);
    setSelectedEvidenceRefs(firstItemRefs.length ? firstItemRefs : fallbackRefs);
    setDraftKind(topicView.draftSlots[0]?.draftKind || "topic_draft");
  }, [currentSessionId, topicView?.surfaceId, topicView?.generatedAtTurn]);

  useEffect(() => {
    if (!activeTopicDraft) return;
    setLocalSurfaceSessionId(currentSessionId ?? null);
    setDraftText(activeTopicDraft.topicDraft.draftText);
  }, [activeTopicDraft, currentSessionId]);

  function updateDraftKind(value: string) {
    setLocalSurfaceSessionId(currentSessionId ?? null);
    setDraftKind(value);
  }

  function updateDraftText(value: string) {
    setLocalSurfaceSessionId(currentSessionId ?? null);
    setDraftText(value);
  }

  function updatePlayerNote(value: string) {
    setLocalSurfaceSessionId(currentSessionId ?? null);
    setPlayerNote(value);
  }

  function toggleEvidenceRef(refId: string) {
    setLocalSurfaceSessionId(currentSessionId ?? null);
    setSelectedEvidenceRefs((current) => {
      if (current.includes(refId)) return current.filter((candidate) => candidate !== refId);
      return [...current.slice(-4), refId];
    });
  }

  async function handleTopicDraft() {
    if (!currentSessionId || !isTopicSurface(activeSurface)) return;
    const requestSessionId = currentSessionId;
    const requestSurface = activeSurface;
    try {
      const payload = await requestTopicDraft(requestSessionId, {
        surfaceId: requestSurface,
        draftKind: activeDraftKind || topicView?.draftSlots[0]?.draftKind,
        selectedEvidenceRefs: activeSelectedEvidenceRefs,
        playerNote: activePlayerNote
      });
      const latestUiState = useUiStateStore.getState();
      if (
        payload.sessionId !== requestSessionId ||
        payload.sessionId !== latestUiState.currentSessionId ||
        payload.surfaceId !== requestSurface ||
        latestUiState.activeSurface !== requestSurface
      ) {
        return;
      }
      setLocalSurfaceSessionId(payload.sessionId);
      setDraftText(payload.topicDraft.draftText);
    } catch {
    }
  }

  function handleWriteDraft() {
    if (activeSurface === "map-filter") return;
    const text = activeDraftText.trim() || entry.draftText || "";
    if (!text) return;
    const draftContext = buildTopicTurnDraftContext({
      activeSurface,
      topicView,
      topicDraft: activeTopicDraft,
      selectedEvidenceRefs: activeSelectedEvidenceRefs,
      draftKind: activeDraftKind
    });
    setActionDraft({
      source: "role-surface",
      targetPage: "game",
      ...(draftContext ? { draftContext } : {}),
      text
    });
  }

  return (
    <div className="modalScrim surfaceScrim" role="presentation">
      <section
        ref={surfaceRef}
        className="modalPanel localSurfacePanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${entry.id}-title`}
        tabIndex={-1}
        data-overlay-kind="surface"
        data-polish-overlay="s89-5-surface-paper"
        data-polish-depth="s89-25-liquid-glass"
        data-surface-state={surfaceState}
      >
        <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭专题" onClick={closeSurface}>
          <X size={18} aria-hidden="true" />
        </button>
        <p className="eyebrow">{entry.eyebrow}</p>
        <h2 id={`${entry.id}-title`}>{entry.title}</h2>
        <p>{entry.description}</p>
        <dl className="surfaceSafetyList" aria-label={`${entry.title}案卷口径`}>
          <div className="surfaceSafetyRow paperMotionSurface">
            <dt>卷宗取材</dt>
            <dd>{topicView ? topicSourceSummary(topicView) : isTopicSurface(activeSurface) ? topicSurfaceFallbackLine(topicSurfaceStatus, entry.dataSource) : entry.dataSource}</dd>
          </div>
          <div className="surfaceSafetyRow paperMotionSurface">
            <dt>{topicView ? "材料进度" : "案卷状态"}</dt>
            <dd>{topicView ? topicMaterialSummary(topicView) : isTopicSurface(activeSurface) ? topicSurfaceFallbackLine(topicSurfaceStatus, entry.emptyState) : entry.emptyState}</dd>
          </div>
          <div className="surfaceSafetyRow paperMotionSurface">
            <dt>回批口径</dt>
            <dd>{safeSurfaceText(topicView?.authorityBoundary || entry.safetyNote, entry.safetyNote, 140)}</dd>
          </div>
        </dl>
        {activeSurface === "npc-profile" && registry && npcProfilePortraits.length ? (
          <NpcProfilePortraitStrip registry={registry} portraits={npcProfilePortraits} />
        ) : null}
        {mapFilterSummary ? <MapFilterSurfaceGuide summary={mapFilterSummary} onClose={closeSurface} /> : null}
        {isTopicSurface(activeSurface) ? (
          <TopicSurfaceWorkbench
            activeSurface={activeSurface}
            canLoad={canLoadTopicSurface}
            entryDraft={entry.draftText || ""}
            error={error}
            draftKind={activeDraftKind}
            draftText={activeDraftText}
            playerNote={activePlayerNote}
            selectedEvidenceRefs={activeSelectedEvidenceRefs}
            status={topicSurfaceStatus}
            draftStatus={topicDraftStatus}
            topicView={topicView}
            onDraftKindChange={updateDraftKind}
            onDraftTextChange={updateDraftText}
            onPlayerNoteChange={updatePlayerNote}
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
  readonly summary: string;
  readonly current: string;
  readonly tags: readonly string[];
  readonly portraitRef: string;
};

type MapFilterLayerSummary = {
  readonly id: string;
  readonly label: string;
  readonly countLabel: string;
  readonly summary: string;
};

type MapFilterSummary = {
  readonly layerCount: number;
  readonly totalCues: number;
  readonly layers: readonly MapFilterLayerSummary[];
  readonly boundary: string;
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
  "ANTHROPIC" + "_API" + "_KEY",
  "本地" + "路径",
  "密" + "钥",
  "隐" + "藏",
  "私" + "档",
  "完整" + "清单",
  "完整" + "提示词",
  "draft" + "Context",
  "schema",
  "manifest",
  "server" + " adjudication",
  "AI" + " read scope",
  "proposal" + " boundary",
  "resolver",
  "safe" + " view"
] as const;
const safeSurfacePortraitRefPattern = /^portrait-[a-z0-9][a-z0-9_-]{0,140}$/i;
const unsafeSurfacePortraitRefTokenPattern = /(?:^|[-_])(raw|provider|prompt|hidden|private|key|path|secret|token|api|file|data|http)(?:$|[-_])/i;
const localSurfacePathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|Users|private|mnt|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;

function safeSurfaceText(value: unknown, fallback: string, maxLength = 48) {
  const text = typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : fallback;
  const normalized = text.toLowerCase();
  if (localSurfacePathPattern.test(text) || /(?:sk|tp)-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (unsafeSurfaceTextFragments.some((fragment) => normalized.includes(fragment.toLowerCase()))) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}...` : rewritten;
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
      identity: getPlayerIdentityLabel(player, "案主", 36),
      summary: "案主画像随当前案卷公开身份入谱，只作观画小传。",
      current: "案主当前身份见于公开案卷。",
      tags: [getGameRoleLabel(player.role) || "案主"].filter(Boolean),
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
      summary: safeSurfaceText(npc.publicSummary, "公开传略未详，案卷只载其姓名与身份。", 140),
      current: safeSurfaceText(npc.currentGoal, "当前情况案卷未载，候复核。", 72),
      tags: [
        safeSurfaceText(npc.genderLabel, "", 18),
        safeSurfaceText(npc.rankLabel, "", 28)
      ].filter(Boolean),
      portraitRef
    });
  }
  return rows;
}

function buildMapFilterSummary(
  session: ReturnType<typeof useGameSessionStore.getState>["currentSession"],
  currentSessionId: string | null
): MapFilterSummary {
  if (!session || !currentSessionId || session.sessionId !== currentSessionId) {
    return {
      layerCount: 0,
      totalCues: 0,
      layers: [],
      boundary: "当前案卷尚未载入舆图材料；开卷后再按地点、驿路和近事筛看。"
    };
  }
  const mapRuntimeView = session.mapRuntimeView;
  const refCount = mapRuntimeView?.refs?.length ?? 0;
  const routeCount = mapRuntimeView?.routes?.length ?? 0;
  const eventCount = mapRuntimeView?.eventEffects?.length ?? 0;
  const npcAnchorCount = mapRuntimeView?.npcActivityAnchors?.length ?? 0;
  const consequenceCount = session.domainConsequenceView?.recentConsequences?.length ?? 0;
  const layers: MapFilterLayerSummary[] = [
    {
      id: "places",
      label: "地点",
      countLabel: `${refCount} 处`,
      summary: "府县、官署、贡院与任所等公开点位，用来辨识卷上方位。"
    },
    {
      id: "routes",
      label: "驿路",
      countLabel: `${routeCount} 条`,
      summary: "驿路、赴任、赶考与巡查线索，只提示可查方向。"
    },
    {
      id: "events",
      label: "近事",
      countLabel: `${eventCount} 项`,
      summary: "公开近事与领域余波，用来观察何处已有风声。"
    },
    {
      id: "people",
      label: "人物动向",
      countLabel: `${npcAnchorCount} 条`,
      summary: "人物活动只作视觉锚点，不代表真实行踪已定。"
    },
    {
      id: "consequences",
      label: "后果追踪",
      countLabel: `${consequenceCount} 条`,
      summary: "地方、军务、刑名或月账余波仍须回主卷候复。"
    }
  ];
  return {
    layerCount: layers.length,
    totalCues: refCount + routeCount + eventCount + npcAnchorCount + consequenceCount,
    layers,
    boundary: "专题层只说明卷面筛法；勾选、隐藏与画面位置都不改变案卷事实。"
  };
}

function MapFilterSurfaceGuide({ summary, onClose }: { readonly summary: MapFilterSummary; readonly onClose: () => void }) {
  return (
    <section
      className="topicSurfaceLayout"
      data-surface-id="map-filter"
      data-polish-map-filter="s89-12-surface-guide"
      data-polish-map-surface="s89-12-filter-ledger"
      aria-label="舆图筛选说明"
    >
      <section className="topicSurfaceColumn paperMotionSurface" aria-label="舆图图层">
        <div className="topicSurfaceColumnHeader">
          <h3>卷上图层</h3>
          <span>{summary.totalCues} 线</span>
        </div>
        <div className="topicSurfaceItems">
          {summary.layers.map((layer) => (
            <article className="topicSurfaceItem paperMotionCard paperMotionInteractive" key={layer.id}>
              <div>
                <strong>{layer.label}</strong>
                <span>{layer.countLabel}</span>
              </div>
              <p>{layer.summary}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="topicSurfaceColumn paperMotionSurface" aria-label="筛看方法">
        <div className="topicSurfaceColumnHeader">
          <h3>筛看方法</h3>
          <span>{summary.layerCount} 层</span>
        </div>
        <p className="topicSurfaceMeta">在舆图页勾选地点、驿路和近事，可把卷面收成单层、双层或素绢空图。</p>
        <p className="topicSurfaceMeta">三层全隐时，地图与局势簿只保留恢复入口；展开三层后，点位、路线和近事即回到卷上。</p>
      </section>
      <section className="topicSurfaceColumn paperMotionSurface" aria-label="候复边界">
        <div className="topicSurfaceColumnHeader">
          <h3>候复边界</h3>
          <span>只读</span>
        </div>
        <p className="topicSurfaceMeta">{summary.boundary}</p>
        <p className="topicSurfaceMeta">若要据图行动，可回主卷另行呈上；真正后果仍候案卷回音。</p>
        <button className="paperButton" type="button" onClick={onClose}>
          回舆图勾选
        </button>
      </section>
    </section>
  );
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
              profile={{
                name: portrait.name,
                identity: portrait.identity,
                summary: portrait.summary,
                current: portrait.current,
                tags: portrait.tags
              }}
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
  return sources.length ? sources.join("；") : "当前专题由已公开案卷生成。";
}

function topicMaterialSummary(topicView: TopicSurfaceView) {
  if (!topicView.items.length) return safeSurfaceText(topicView.emptyState, "尚未载入专题材料。", 96);
  return `${topicView.items.length} 条材料，${topicView.evidenceRefs.length} 枚可引用证据。`;
}

function topicSurfaceState(
  topicView: TopicSurfaceView | null,
  status: "idle" | "loading" | "ready" | "error",
  canLoad: boolean
) {
  if (!canLoad) return "preview";
  if (status === "loading") return "loading";
  if (status === "error") return "error";
  if (!topicView || (!topicView.items.length && !topicView.evidenceRefs.length)) return "empty";
  return "ready";
}

function topicSurfaceFallbackLine(status: "idle" | "loading" | "ready" | "error", fallback: string) {
  if (status === "loading") return "正在翻检公开材料，稍候回音。";
  if (status === "error") return "专题材料暂未取回；可先用本地草稿，案卷事实不在此补造。";
  return safeSurfaceText(fallback, "案卷未载专题材料，候主卷回音。", 96);
}

function topicDomainLabel(domain: unknown) {
  const text = String(domain || "").trim();
  if (text === "people") return "人物";
  if (text === "economy") return "月账";
  if (text === "events") return "案牍";
  return safeSurfaceText(text, "公开材料", 32);
}

function topicSourceLabel(sourceView: unknown) {
  const text = String(sourceView || "").trim();
  if (text === "eventArchiveView") return "案牍索引";
  if (text === "npcActiveRequestView") return "来函后续";
  if (text === "npcInteractionView") return "交游记录";
  if (text === "economyTraceView") return "经济解释";
  if (text === "mapRuntimeView" || text === "mapContextView") return "舆图材料";
  if (text === "domainConsequenceView") return "后果追踪";
  if (text === "officialCareerView") return "官职履历";
  if (text === "roleCycleView") return "身份卷宗";
  return safeSurfaceText(text, "公开材料", 36);
}

function topicEvidenceMeta(ref: TopicSurfaceEvidenceRef) {
  const source = topicSourceLabel(ref.sourceView);
  const domain = topicDomainLabel(ref.domain);
  if (source === "经济解释") return `经济解释 · ${domain}`;
  if (source === "交游记录") return `交游记录 · ${domain}`;
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
  const selectedLabels = selectedEvidenceRefs.map((refId) => safeSurfaceText(evidenceByRef.get(refId)?.label || refId, "线索", 36));
  const hasMaterials = Boolean(topicView && (topicView.items.length || topicView.evidenceRefs.length));
  const draftSource = topicView ? "推演拟稿" : "本地草稿";
  const finalDraftText = draftText;
  const materialState = status === "loading" ? "loading" : status === "error" ? "error" : hasMaterials ? "ready" : "empty";
  const draftState = draftStatus === "loading" ? "loading" : draftStatus === "error" ? "error" : finalDraftText.trim() ? "ready" : "empty";

  if (!canLoad) {
    return (
      <div className="topicSurfaceFallback" data-state="preview">
        <p>预览案卷只显示专题模板；开卷后会载入公开材料、可引线索和候复草稿。</p>
        {entryDraft ? (
          <button className="paperButton" type="button" onClick={onWriteDraft}>
            写入奏折草稿
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="topicSurfaceLayout" data-surface-id={activeSurface} data-material-state={materialState} data-draft-state={draftState}>
      <section className="topicSurfaceColumn paperMotionSurface" aria-label="材料栏" data-state={materialState} aria-busy={status === "loading"}>
        <div className="topicSurfaceColumnHeader">
          <h3>材料</h3>
          <span>{status === "loading" ? "候复" : materialState === "error" ? "受阻" : hasMaterials ? "可阅" : "案卷未载"}</span>
        </div>
        {topicView?.items.length ? (
          <div className="topicSurfaceItems">
            {topicView.items.map((item) => (
              <article className="topicSurfaceItem paperMotionCard paperMotionInteractive" key={item.id}>
                <div>
                  <strong>{safeSurfaceText(item.title, "公开材料", 48)}</strong>
                  <span>{safeSurfaceText(item.statusLabel, "可阅", 24)}</span>
                </div>
                <p>{safeSurfaceText(item.summary, "此材料只作公开线索。", 120)}</p>
                <small>{topicSourceLabel(item.sourceView)}</small>
              </article>
            ))}
          </div>
        ) : (
          <p>{materialState === "loading" ? "正在整理公开材料，稍候回音。" : materialState === "error" ? safeSurfaceText(error, "专题材料暂未取回，可先用本地草稿候复。", 96) : safeSurfaceText(topicView?.emptyState, "案卷未载专题材料，候主卷回音。", 96)}</p>
        )}
      </section>

      <section className="topicSurfaceColumn paperMotionSurface" aria-label="筹议栏" data-state={selectedEvidenceRefs.length ? "selected" : materialState}>
        <div className="topicSurfaceColumnHeader">
          <h3>筹议</h3>
          <span>{selectedEvidenceRefs.length} 引</span>
        </div>
        {topicView?.draftSlots.length ? (
          <div className="topicDraftSlots" role="group" aria-label="草稿类型">
            {topicView.draftSlots.map((slot) => (
              <button
                key={slot.id}
                className="topicDraftSlot paperMotionSelected"
                type="button"
                aria-pressed={(draftKind || topicView.draftSlots[0]?.draftKind) === slot.draftKind}
                onClick={() => onDraftKindChange(slot.draftKind)}
              >
                {safeSurfaceText(slot.label, "草稿", 24)}
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
                <strong>{safeSurfaceText(ref.label, "公开线索", 48)}</strong>
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
            参议：{topicView.scenePreview.participantLabels?.length ? topicView.scenePreview.participantLabels.map((label) => safeSurfaceText(label, "公开角色", 28)).join("、") : "候公开角色入席"}
          </p>
        ) : null}
        <p className="topicSurfaceMeta">{selectedLabels.length ? `已引：${selectedLabels.join("、")}` : "未勾选线索时，将按公开材料自行取用。"}</p>
      </section>

      <section className="topicSurfaceColumn topicDraftColumn paperMotionSurface" aria-label="草稿栏" data-state={draftState} aria-busy={draftStatus === "loading"}>
        <div className="topicSurfaceColumnHeader">
          <h3>草稿</h3>
          <span>{draftStatus === "loading" ? "待回音" : draftState === "error" ? "候复草稿" : draftSource}</span>
        </div>
        <button
          className="paperButton topicAiButton"
          type="button"
          disabled={!topicView || draftStatus === "loading"}
          aria-busy={draftStatus === "loading"}
          data-state={draftStatus === "loading" ? "loading" : topicView ? "ready" : "empty"}
          onClick={onRequestDraft}
        >
          <Sparkles size={16} aria-hidden="true" />
          <span>{draftStatus === "loading" ? "待回音" : "推演拟稿"}</span>
        </button>
        <textarea
          className="topicDraftTextarea"
          value={finalDraftText}
          onChange={(event) => onDraftTextChange(event.target.value)}
          rows={8}
          aria-label="专题草稿正文"
        />
        {draftStatus === "error" ? <p className="statusLine">{safeSurfaceText(error, "专题拟稿暂未取回，已保留案头草稿候复。", 96)}</p> : null}
        <button className="paperButton" type="button" disabled={!finalDraftText.trim()} data-state={finalDraftText.trim() ? "ready" : "empty"} onClick={onWriteDraft}>
          写入底部奏折
        </button>
      </section>
    </div>
  );
}
