import { BrainCircuit, Home, Save, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { isRunnableSessionId } from "../routes/sessionId";
import { surfaceRegistry } from "../surfaces/surfaceRegistry";
import { useGameSessionStore } from "../state/gameSessionState";
import type { DrawerSurface, InkboxTab, LocalSurface, ModalSurface } from "../state/uiState";
import { useUiStateStore } from "../state/uiState";
import { SaveCaseList } from "./SaveCaseList";
import { consumeOverlayTrigger } from "./overlayFocus";

type OverlayKind = "drawer" | "modal" | "surface";

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
  const closeDrawer = useUiStateStore((state) => state.closeDrawer);
  const closeModal = useUiStateStore((state) => state.closeModal);
  const closeSurface = useUiStateStore((state) => state.closeSurface);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const lastOverlayRef = useRef<OverlayKind | null>(null);
  const overlayKind: OverlayKind | null = activeSurface ? "surface" : activeModal ? "modal" : activeDrawer ? "drawer" : null;

  useEffect(() => {
    if (!overlayKind) return;
    previousFocusRef.current = consumeOverlayTrigger() ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    lastOverlayRef.current = overlayKind;
  }, [overlayKind]);

  useEffect(() => {
    if (overlayKind) return;
    if (!lastOverlayRef.current) return;
    lastOverlayRef.current = null;
    const target = previousFocusRef.current;
    previousFocusRef.current = null;
    if (target?.isConnected) target.focus();
  }, [overlayKind]);

  useEffect(() => {
    if (!overlayKind) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
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
  }, [activeDrawer, activeModal, activeSurface, closeDrawer, closeModal, closeSurface, overlayKind]);

  useEffect(() => {
    document.body.toggleAttribute("data-overlay-open", Boolean(overlayKind));
    return () => document.body.removeAttribute("data-overlay-open");
  }, [overlayKind]);

  return (
    <>
      {activeDrawer ? <DrawerHost activeDrawer={activeDrawer} /> : null}
      {activeModal ? <ModalHost activeModal={activeModal} /> : null}
      {activeSurface ? <LocalSurfaceHost activeSurface={activeSurface} /> : null}
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

function AiSettingsPanel() {
  const currentSessionId = useUiStateStore((state) => state.currentSessionId);
  const [preset, setPreset] = useState("balanced");
  const [provider, setProvider] = useState("mock");
  const loadAiSettings = useGameSessionStore((state) => state.loadAiSettings);
  const updateAiPreset = useGameSessionStore((state) => state.updateAiPreset);
  const testAiConnection = useGameSessionStore((state) => state.testAiConnection);
  const aiSettings = useGameSessionStore((state) => state.aiSettings);
  const aiConnection = useGameSessionStore((state) => state.aiConnection);
  const settingsStatus = useGameSessionStore((state) => state.settingsStatus);
  const error = useGameSessionStore((state) => state.error);
  const canUseSessionSettings = Boolean(currentSessionId && isRunnableSessionId(currentSessionId));

  useEffect(() => {
    if (!canUseSessionSettings || !currentSessionId) return;
    void loadAiSettings(currentSessionId).then((payload) => {
      if (payload.aiSettingsView.preset) setPreset(String(payload.aiSettingsView.preset));
    }).catch(() => undefined);
  }, [canUseSessionSettings, currentSessionId, loadAiSettings]);

  async function handlePreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentSessionId || !canUseSessionSettings) return;
    try {
      await updateAiPreset(currentSessionId, preset);
    } catch {
    }
  }

  async function handleConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await testAiConnection(provider);
    } catch {
    }
  }

  return (
    <div className="inkboxTabBody">
      <h3>AI 设置</h3>
      <p>只调整当前案卷的推演策略和连接检查；密钥、连接地址、模型原文和提示词不会显示在前端。</p>
      <form className="inlineForm" onSubmit={handlePreset}>
        <label>
          AI 策略
          <select value={preset} onChange={(event) => setPreset(event.target.value)}>
            <option value="fast">从简</option>
            <option value="balanced">均衡</option>
            <option value="deep">深推演</option>
          </select>
        </label>
        <button className="paperButton" type="submit" disabled={settingsStatus === "loading" || !canUseSessionSettings}>
          保存
        </button>
      </form>
      <form className="inlineForm" onSubmit={handleConnection}>
        <label>
          Provider
          <select value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="mock">Mock</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="anthropic">Anthropic</option>
            <option value="mimo-deepseek">MiMo + DeepSeek</option>
          </select>
        </label>
        <button className="paperButton" type="submit" disabled={settingsStatus === "loading"}>
          试连
        </button>
      </form>
      {aiSettings?.aiSettingsView.preset ? <p className="statusLine">当前策略：{aiSettings.aiSettingsView.preset}</p> : null}
      {aiConnection ? <p className="statusLine">连接结果：{aiConnection.ok ? "可用" : "不可用"}</p> : null}
      {!canUseSessionSettings ? <p>预览案卷不保存 AI 设置；请先从首页新开一卷。</p> : null}
      {error ? <p className="statusLine" role="alert">{error}</p> : null}
    </div>
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
      <p>印匣只读取安全玩家投影和前端 UI 状态，不读取内部审计原文、模型原文、完整提示词、本地路径、密钥或模型原始返回。</p>
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
        <p>此处只显示前端 UI 摘要，不读取内部审计原文、模型原文、完整提示词、本地路径或密钥。</p>
      </section>
    </div>
  );
}

function LocalSurfaceHost({ activeSurface }: { readonly activeSurface: LocalSurface }) {
  const closeSurface = useUiStateStore((state) => state.closeSurface);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const entry = surfaceRegistry[activeSurface];
  const surfaceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    focusFirstControl(surfaceRef.current);
  }, [activeSurface]);

  return (
    <div className="modalScrim surfaceScrim" role="presentation">
      <section ref={surfaceRef} className="modalPanel localSurfacePanel" role="dialog" aria-modal="true" aria-labelledby={`${entry.id}-title`} tabIndex={-1}>
        <button className="iconButton drawerClose" type="button" title="关闭" aria-label="关闭专题" onClick={closeSurface}>
          <X size={18} aria-hidden="true" />
        </button>
        <p className="eyebrow">{entry.eyebrow}</p>
        <h2 id={`${entry.id}-title`}>{entry.title}</h2>
        <p>{entry.description}</p>
        <p>{entry.safetyNote}</p>
        {entry.draftText ? (
          <button
            className="paperButton"
            type="button"
            onClick={() => setActionDraft({ source: activeSurface === "map-filter" ? "map-runtime" : "role-surface", targetPage: activeSurface === "map-filter" ? "map" : "game", text: entry.draftText ?? "" })}
          >
            写入奏折草稿
          </button>
        ) : null}
      </section>
    </div>
  );
}
