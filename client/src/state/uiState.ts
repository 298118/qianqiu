import { create } from "zustand";
import type {
  ExamSubmitResponse,
  PlayerStateResponse,
  PlayerSummary,
  StartGameResponse,
  TurnResponse
} from "../api";
import {
  isDisplayPreferenceValue,
  loadDisplayPreferences,
  saveDisplayPreferences,
  type DisplayPreferences
} from "./displayPreferenceStorage";

export type ClientEntryState = {
  readonly clientEntry: "react";
  readonly routerMode: "data";
};

export const clientEntryState: ClientEntryState = {
  clientEntry: "react",
  routerMode: "data"
};

export type PageSurface = "home" | "game" | "map" | "people" | "archive" | "exam" | "ranking" | "court" | "settings";
export type DrawerSurface = "settings" | "saves" | "display-preferences";
export type InkboxTab = "ai-settings" | "saves" | "display" | "safe-summary";
export type ModalSurface = "safe-summary" | "exam-result" | "confirm-navigation";
export type LocalSurface = "npc-profile" | "edict-draft" | "memorial-review" | "map-filter";
export type ActionDraftSource = "manual" | "map-runtime" | "role-surface" | "exam";

export type SafePlayerPayload = {
  readonly sessionId: string;
  readonly source: "start" | "player-state" | "turn" | "exam-submit";
  readonly player: PlayerSummary | null;
  readonly narrativePreview?: string;
  readonly routeViews: {
    readonly hasAiSettingsView: boolean;
    readonly hasAuditSummaryView: boolean;
    readonly hasEventArchiveView: boolean;
    readonly hasExamCalendarView: boolean;
    readonly hasInformationPanelView: boolean;
    readonly hasMapRuntimeView: boolean;
  };
};

export type ActionDraft = {
  readonly id: string;
  readonly source: ActionDraftSource;
  readonly text: string;
  readonly targetPage?: PageSurface;
};

type SetActionDraftInput = {
  readonly id?: string;
  readonly source?: ActionDraftSource;
  readonly text: string;
  readonly targetPage?: PageSurface;
};

type UiState = {
  readonly currentPage: PageSurface;
  readonly currentSessionId: string | null;
  readonly currentPlayerPayload: SafePlayerPayload | null;
  readonly activeDrawer: DrawerSurface | null;
  readonly activeModal: ModalSurface | null;
  readonly activeSurface: LocalSurface | null;
  readonly activeInkboxTab: InkboxTab;
  readonly selectedTabs: Partial<Record<PageSurface, string>>;
  readonly actionDraft: ActionDraft | null;
  readonly displayPreferences: DisplayPreferences;
  readonly setCurrentPage: (page: PageSurface, sessionId?: string | null) => void;
  readonly syncSessionPayload: (
    payload: StartGameResponse | PlayerStateResponse | TurnResponse | ExamSubmitResponse,
    sourceOverride?: SafePlayerPayload["source"]
  ) => void;
  readonly returnHome: () => void;
  readonly openInkbox: (tab?: InkboxTab) => void;
  readonly selectInkboxTab: (tab: InkboxTab) => void;
  readonly openDrawer: (drawer: DrawerSurface) => void;
  readonly closeDrawer: () => void;
  readonly openModal: (modal: ModalSurface) => void;
  readonly closeModal: () => void;
  readonly openSurface: (surface: LocalSurface) => void;
  readonly closeSurface: () => void;
  readonly selectTab: (page: PageSurface, tabId: string) => void;
  readonly setActionDraft: (draft: SetActionDraftInput) => void;
  readonly clearActionDraft: () => void;
  readonly setDisplayPreference: <K extends keyof DisplayPreferences>(key: K, value: DisplayPreferences[K]) => void;
  readonly resetUiState: () => void;
};

function buildInitialUiState() {
  return {
    currentPage: "home" as PageSurface,
    currentSessionId: null,
    currentPlayerPayload: null,
    activeDrawer: null,
    activeModal: null,
    activeSurface: null,
    activeInkboxTab: "ai-settings" as InkboxTab,
    selectedTabs: {},
    actionDraft: null,
    displayPreferences: loadDisplayPreferences()
  };
}

function toActionDraftId(text: string, source: ActionDraftSource) {
  const normalized = text.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").replace(/^-|-$/g, "");
  return `draft-${source}-${normalized || "empty"}`;
}

function getPayloadSource(payload: StartGameResponse | PlayerStateResponse | TurnResponse | ExamSubmitResponse): SafePlayerPayload["source"] {
  if ("source" in payload && payload.source === "server_player_visible_state_projection") return "player-state";
  if ("examId" in payload && "score" in payload) return "exam-submit";
  if ("examTrigger" in payload || "examScene" in payload) return "turn";
  return "start";
}

export function extractSafePlayerPayload(
  payload: StartGameResponse | PlayerStateResponse | TurnResponse | ExamSubmitResponse,
  sourceOverride?: SafePlayerPayload["source"]
): SafePlayerPayload {
  const narrativePreview = "narrative" in payload && typeof payload.narrative === "string" ? payload.narrative : undefined;

  return {
    sessionId: payload.sessionId,
    source: sourceOverride ?? getPayloadSource(payload),
    player: payload.worldState?.player
      ? {
          name: payload.worldState.player.name,
          role: payload.worldState.player.role,
          portraitRef: payload.worldState.player.portraitRef,
          examRank: payload.worldState.player.examRank,
          officeTitle: payload.worldState.player.officeTitle
        }
      : null,
    narrativePreview,
    routeViews: {
      hasAiSettingsView: Boolean(payload.aiSettingsView),
      hasAuditSummaryView: Boolean(payload.aiControlAuditView),
      hasEventArchiveView: Boolean(payload.eventArchiveView),
      hasExamCalendarView: Boolean(payload.examCalendarView),
      hasInformationPanelView: Boolean(payload.informationPanelPageView),
      hasMapRuntimeView: Boolean(payload.mapRuntimeView)
    }
  };
}

export const useUiStateStore = create<UiState>((set) => ({
  ...buildInitialUiState(),

  setCurrentPage(page, sessionId = undefined) {
    set((state) => ({
      currentPage: page,
      currentSessionId: sessionId === undefined || (page === "home" && sessionId === null) ? state.currentSessionId : sessionId
    }));
  },

  syncSessionPayload(payload, sourceOverride) {
    const safePayload = extractSafePlayerPayload(payload, sourceOverride);
    set({
      currentSessionId: safePayload.sessionId,
      currentPlayerPayload: safePayload
    });
  },

  returnHome() {
    set({
      currentPage: "home",
      activeDrawer: null,
      activeModal: null,
      activeSurface: null,
      actionDraft: null
    });
  },

  openInkbox(tab = "ai-settings") {
    set({ activeDrawer: "settings", activeModal: null, activeSurface: null, activeInkboxTab: tab });
  },

  selectInkboxTab(tab) {
    set({ activeInkboxTab: tab });
  },

  openDrawer(drawer) {
    const activeInkboxTab: InkboxTab = drawer === "saves" ? "saves" : drawer === "display-preferences" ? "display" : "ai-settings";
    set({ activeDrawer: "settings", activeModal: null, activeSurface: null, activeInkboxTab });
  },

  closeDrawer() {
    set({ activeDrawer: null });
  },

  openModal(modal) {
    set({ activeModal: modal, activeDrawer: null });
  },

  closeModal() {
    set({ activeModal: null });
  },

  openSurface(surface) {
    set({ activeSurface: surface });
  },

  closeSurface() {
    set({ activeSurface: null });
  },

  selectTab(page, tabId) {
    set((state) => ({
      selectedTabs: {
        ...state.selectedTabs,
        [page]: tabId
      }
    }));
  },

  setActionDraft(draft) {
    const text = draft.text.trim();
    if (!text) {
      set({ actionDraft: null });
      return;
    }
    const source = draft.source ?? "manual";
    set({
      actionDraft: {
        id: draft.id ?? toActionDraftId(text, source),
        source,
        text,
        targetPage: draft.targetPage
      }
    });
  },

  clearActionDraft() {
    set({ actionDraft: null });
  },

  setDisplayPreference(key, value) {
    if (!isDisplayPreferenceValue(key, value)) return;
    set((state) => ({
      displayPreferences: saveDisplayPreferences({
        ...state.displayPreferences,
        [key]: value
      })
    }));
  },

  resetUiState() {
    set(buildInitialUiState());
  }
}));
