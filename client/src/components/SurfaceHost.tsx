import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { surfaceRegistry } from "../surfaces/surfaceRegistry";
import { useGameSessionStore } from "../state/gameSessionState";
import type { DrawerSurface, LocalSurface, ModalSurface } from "../state/uiState";
import { useUiStateStore } from "../state/uiState";
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
  "display-preferences": { label: "显示偏好", render: () => <DisplayPreferencesDrawer /> },
  settings: { label: "设置抽屉", render: () => <SafeSessionDrawer /> },
  saves: { label: "存档抽屉", render: () => <SaveDrawer /> }
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

function DisplayPreferencesDrawer() {
  const preferences = useUiStateStore((state) => state.displayPreferences);
  const setDisplayPreference = useUiStateStore((state) => state.setDisplayPreference);

  return (
    <section className="drawerContent">
      <p className="eyebrow">印匣</p>
      <h2>显示偏好</h2>
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
    </section>
  );
}

function SafeSessionDrawer() {
  const payload = useUiStateStore((state) => state.currentPlayerPayload);

  return (
    <section className="drawerContent">
      <p className="eyebrow">安全摘要</p>
      <h2>当前案卷</h2>
      <p>{payload?.player?.name ? `${payload.player.name}，${payload.player.officeTitle || payload.player.examRank || payload.player.role || "未题身份"}。` : "暂无已载入案卷。"}</p>
    </section>
  );
}

function SaveDrawer() {
  const saves = useGameSessionStore((state) => state.saves);

  return (
    <section className="drawerContent">
      <p className="eyebrow">旧案</p>
      <h2>存档</h2>
      {saves.length ? saves.slice(0, 5).map((save) => <p key={save.sessionId}>{save.playerName || "无名"}：{save.officeTitle || save.examRank || save.role || "未题"}</p>) : <p>暂无可读旧卷。</p>}
    </section>
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
