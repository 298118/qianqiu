import { create } from "zustand";
import { qianqiuApi } from "../api";
import { useUiStateStore } from "./uiState";
import type {
  AiConnectionTestResponse,
  AiSettingsResponse,
  InventoryResponse,
  InventoryTransferRequest,
  InventoryTransferResponse,
  NpcCommandRequest,
  NpcCommandResponse,
  NpcDetailResponse,
  NpcInteractionRequest,
  NpcInteractionResponse,
  NpcListResponse,
  ExamLevel,
  ExamProgressResponse,
  ExamQuestionResponse,
  ExamSubmitResponse,
  GameRole,
  JsonObject,
  PlayerStateResponse,
  QuickActionResponse,
  SaveMetadata,
  StartGameResponse,
  TopicDraftRequest,
  TopicDraftResponse,
  TopicSurfaceId,
  TopicSurfaceResponse,
  TradeRequest,
  TradeResponse,
  TurnDraftContext,
  TurnResponse
} from "../api";

type LoadingState = "idle" | "loading" | "ready" | "error";

type StartGameInput = {
  readonly playerName: string;
  readonly portraitRef?: string;
  readonly role: GameRole;
  readonly dynasty: string;
  readonly year: number;
  readonly familyBackground?: "poor" | "modest" | "gentry" | "贫寒" | "普通" | "世家";
  readonly background?: string;
  readonly customSetting?: string;
  readonly nativePlace?: string;
};

type GameSessionState = {
  readonly status: LoadingState;
  readonly savesStatus: LoadingState;
  readonly settingsStatus: LoadingState;
  readonly quickActionStatus: LoadingState;
  readonly topicSurfaceStatus: LoadingState;
  readonly topicDraftStatus: LoadingState;
  readonly inventoryStatus: LoadingState;
  readonly npcRosterStatus: LoadingState;
  readonly npcDetailStatus: LoadingState;
  readonly npcMutationStatus: LoadingState;
  readonly currentSessionId: string | null;
  readonly currentSession: PlayerStateResponse | StartGameResponse | TurnResponse | ExamSubmitResponse | null;
  readonly lastTurn: TurnResponse | null;
  readonly activeExam: ExamQuestionResponse | ExamProgressResponse | null;
  readonly lastExamResult: ExamSubmitResponse | null;
  readonly saves: SaveMetadata[];
  readonly aiSettings: AiSettingsResponse | null;
  readonly aiConnection: AiConnectionTestResponse | null;
  readonly quickActions: QuickActionResponse | null;
  readonly topicSurface: TopicSurfaceResponse | null;
  readonly topicDraft: TopicDraftResponse | null;
  readonly inventory: InventoryResponse | null;
  readonly npcRoster: NpcListResponse | null;
  readonly npcDetail: NpcDetailResponse | null;
  readonly lastNpcInteraction: NpcInteractionResponse | null;
  readonly lastTrade: TradeResponse | null;
  readonly lastNpcCommand: NpcCommandResponse | null;
  readonly error: string | null;
  readonly refreshSaves: () => Promise<void>;
  readonly startNewGame: (input: StartGameInput) => Promise<StartGameResponse>;
  readonly loadSession: (sessionId: string) => Promise<PlayerStateResponse>;
  readonly submitTurn: (sessionId: string, input: string, draftContext?: TurnDraftContext) => Promise<TurnResponse>;
  readonly requestExamQuestion: (sessionId: string, level: ExamLevel) => Promise<ExamQuestionResponse>;
  readonly progressExam: (sessionId: string, examId: string, action: string) => Promise<ExamProgressResponse>;
  readonly submitExam: (sessionId: string, examId: string, essay: string) => Promise<ExamSubmitResponse>;
  readonly loadAiSettings: (sessionId: string) => Promise<AiSettingsResponse>;
  readonly updateAiPreset: (sessionId: string, preset: string) => Promise<AiSettingsResponse>;
  readonly updateAiTaskRoute: (sessionId: string, taskType: string, routePatch: Record<string, string | number>) => Promise<AiSettingsResponse>;
  readonly loadGlobalAiSettings: () => Promise<AiSettingsResponse>;
  readonly updateGlobalAiSettings: (settings: JsonObject) => Promise<AiSettingsResponse>;
  readonly testAiConnection: (provider?: string) => Promise<AiConnectionTestResponse>;
  readonly refreshQuickActions: (sessionId: string, input?: { readonly page?: string; readonly draftPreview?: string; readonly count?: number }) => Promise<QuickActionResponse>;
  readonly loadTopicSurface: (sessionId: string, surfaceId: TopicSurfaceId) => Promise<TopicSurfaceResponse>;
  readonly requestTopicDraft: (sessionId: string, input: TopicDraftRequest) => Promise<TopicDraftResponse>;
  readonly loadInventory: (sessionId: string) => Promise<InventoryResponse>;
  readonly transferInventoryItem: (sessionId: string, input: InventoryTransferRequest) => Promise<InventoryTransferResponse>;
  readonly loadNpcs: (sessionId: string, input?: { readonly page?: number; readonly pageSize?: number; readonly group?: string; readonly interaction?: string }) => Promise<NpcListResponse>;
  readonly loadNpcDetail: (sessionId: string, npcId: string) => Promise<NpcDetailResponse>;
  readonly interactWithNpc: (sessionId: string, input: NpcInteractionRequest) => Promise<NpcInteractionResponse>;
  readonly submitTrade: (sessionId: string, input: TradeRequest) => Promise<TradeResponse>;
  readonly submitNpcCommand: (sessionId: string, input: NpcCommandRequest) => Promise<NpcCommandResponse>;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求未能完成。";
}

export const useGameSessionStore = create<GameSessionState>((set) => ({
  status: "idle",
  savesStatus: "idle",
  settingsStatus: "idle",
  quickActionStatus: "idle",
  topicSurfaceStatus: "idle",
  topicDraftStatus: "idle",
  inventoryStatus: "idle",
  npcRosterStatus: "idle",
  npcDetailStatus: "idle",
  npcMutationStatus: "idle",
  currentSessionId: null,
  currentSession: null,
  lastTurn: null,
  activeExam: null,
  lastExamResult: null,
  saves: [],
  aiSettings: null,
  aiConnection: null,
  quickActions: null,
  topicSurface: null,
  topicDraft: null,
  inventory: null,
  npcRoster: null,
  npcDetail: null,
  lastNpcInteraction: null,
  lastTrade: null,
  lastNpcCommand: null,
  error: null,

  async refreshSaves() {
    set({ savesStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.listSaves();
      set({ saves: payload.saves, savesStatus: "ready" });
    } catch (error) {
      set({ error: toErrorMessage(error), savesStatus: "error" });
    }
  },

  async startNewGame(input) {
    set({ status: "loading", error: null });
    try {
      const payload = await qianqiuApi.startGame(input);
      set({
        currentSessionId: payload.sessionId,
        currentSession: payload,
        lastTurn: null,
        activeExam: null,
        lastExamResult: null,
        quickActions: null,
        quickActionStatus: "idle",
        topicSurface: null,
        topicDraft: null,
        topicSurfaceStatus: "idle",
        topicDraftStatus: "idle",
        inventory: null,
        npcRoster: null,
        npcDetail: null,
        lastNpcInteraction: null,
        lastTrade: null,
        lastNpcCommand: null,
        inventoryStatus: "idle",
        npcRosterStatus: "idle",
        npcDetailStatus: "idle",
        npcMutationStatus: "idle",
        status: "ready"
      });
      useUiStateStore.getState().syncSessionPayload(payload, "start");
      useUiStateStore.getState().clearActionDraft();
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), status: "error" });
      throw error;
    }
  },

  async loadSession(sessionId) {
    set({ status: "loading", error: null });
    try {
      const payload = await qianqiuApi.loadPlayerState(sessionId);
      set((state) => ({
        currentSessionId: payload.sessionId,
        currentSession: payload,
        activeExam: state.activeExam?.sessionId === payload.sessionId ? state.activeExam : null,
        lastExamResult: state.lastExamResult?.sessionId === payload.sessionId ? state.lastExamResult : null,
        quickActions: null,
        quickActionStatus: "idle",
        topicSurface: null,
        topicDraft: null,
        topicSurfaceStatus: "idle",
        topicDraftStatus: "idle",
        inventory: payload.inventoryView
          ? {
              sessionId: payload.sessionId,
              inventoryView: payload.inventoryView,
              resourceLedgerView: payload.resourceLedgerView,
              assetLedgerView: payload.assetLedgerView
            }
          : null,
        npcRoster: payload.npcRosterView
          ? {
              sessionId: payload.sessionId,
              npcRosterView: payload.npcRosterView,
              npcInteractionView: payload.npcInteractionView,
              delegatedTaskView: payload.delegatedTaskView
            }
          : null,
        npcDetail: null,
        lastNpcInteraction: null,
        lastTrade: null,
        lastNpcCommand: null,
        inventoryStatus: payload.inventoryView ? "ready" : "idle",
        npcRosterStatus: payload.npcRosterView ? "ready" : "idle",
        npcDetailStatus: "idle",
        npcMutationStatus: "idle",
        status: "ready"
      }));
      useUiStateStore.getState().syncSessionPayload(payload, "player-state");
      return payload;
    } catch (error) {
      set({ currentSessionId: sessionId, error: toErrorMessage(error), status: "error" });
      throw error;
    }
  },

  async submitTurn(sessionId, input, draftContext) {
    set({ status: "loading", error: null });
    try {
      const payload = await qianqiuApi.submitTurn(
        draftContext ? { sessionId, input, draftContext } : { sessionId, input }
      );
      set({
        currentSessionId: payload.sessionId,
        currentSession: payload,
        lastTurn: payload,
        activeExam: null,
        quickActions: null,
        quickActionStatus: "idle",
        topicSurface: null,
        topicDraft: null,
        topicSurfaceStatus: "idle",
        topicDraftStatus: "idle",
        inventory: payload.inventoryView
          ? {
              sessionId: payload.sessionId,
              inventoryView: payload.inventoryView,
              resourceLedgerView: payload.resourceLedgerView,
              assetLedgerView: payload.assetLedgerView
            }
          : null,
        npcRoster: payload.npcRosterView
          ? {
              sessionId: payload.sessionId,
              npcRosterView: payload.npcRosterView,
              npcInteractionView: payload.npcInteractionView,
              delegatedTaskView: payload.delegatedTaskView
            }
          : null,
        npcDetail: null,
        lastNpcInteraction: null,
        lastTrade: null,
        lastNpcCommand: null,
        inventoryStatus: payload.inventoryView ? "ready" : "idle",
        npcRosterStatus: payload.npcRosterView ? "ready" : "idle",
        npcDetailStatus: "idle",
        npcMutationStatus: "idle",
        status: "ready"
      });
      useUiStateStore.getState().syncSessionPayload(payload, "turn");
      useUiStateStore.getState().clearActionDraft();
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), status: "error" });
      throw error;
    }
  },

  async requestExamQuestion(sessionId, level) {
    set({ status: "loading", error: null });
    try {
      const payload = await qianqiuApi.requestExamQuestion({ sessionId, level });
      set({ activeExam: payload, currentSessionId: payload.sessionId, status: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), status: "error" });
      throw error;
    }
  },

  async progressExam(sessionId, examId, action) {
    set({ status: "loading", error: null });
    try {
      const payload = await qianqiuApi.progressExam({ sessionId, examId, action });
      set({ activeExam: payload, currentSessionId: payload.sessionId, status: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), status: "error" });
      throw error;
    }
  },

  async submitExam(sessionId, examId, essay) {
    set({ status: "loading", error: null });
    try {
      const payload = await qianqiuApi.submitExam({ sessionId, examId, essay });
      set({
        activeExam: null,
        lastExamResult: payload,
        currentSessionId: payload.sessionId,
        currentSession: payload,
        quickActions: null,
        quickActionStatus: "idle",
        topicSurface: null,
        topicDraft: null,
        topicSurfaceStatus: "idle",
        topicDraftStatus: "idle",
        status: "ready"
      });
      useUiStateStore.getState().syncSessionPayload(payload, "exam-submit");
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), status: "error" });
      throw error;
    }
  },

  async loadAiSettings(sessionId) {
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.getAiSettings(sessionId);
      set({ aiSettings: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    }
  },

  async updateAiPreset(sessionId, preset) {
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.updateAiSettings(sessionId, { settings: { preset } });
      set({ aiSettings: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    }
  },

  async updateAiTaskRoute(sessionId, taskType, routePatch) {
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.updateAiSettings(sessionId, {
        settings: {
          taskRoutes: {
            [taskType]: routePatch
          }
        }
      });
      set({ aiSettings: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    }
  },

  async loadGlobalAiSettings() {
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.getGlobalAiSettings();
      set({ aiSettings: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    }
  },

  async updateGlobalAiSettings(settings) {
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.updateGlobalAiSettings({ settings });
      set({ aiSettings: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    }
  },

  async testAiConnection(provider) {
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.testAiConnection(provider ? { provider } : {});
      set({ aiConnection: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    }
  },

  async refreshQuickActions(sessionId, input = {}) {
    set({ quickActionStatus: "loading" });
    try {
      const payload = await qianqiuApi.requestQuickActions(sessionId, {
        page: input.page || "game",
        draftPreview: input.draftPreview?.slice(0, 80),
        count: input.count ?? 3
      });
      set({ quickActions: payload, quickActionStatus: payload.status === "fallback" ? "error" : "ready" });
      return payload;
    } catch (error) {
      set({ quickActionStatus: "error" });
      throw error;
    }
  },

  async loadTopicSurface(sessionId, surfaceId) {
    set({ topicSurfaceStatus: "loading", topicDraft: null, topicDraftStatus: "idle" });
    try {
      const payload = await qianqiuApi.loadTopicSurface(sessionId, surfaceId);
      set({ topicSurface: payload, topicSurfaceStatus: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), topicSurfaceStatus: "error" });
      throw error;
    }
  },

  async requestTopicDraft(sessionId, input) {
    set({ topicDraftStatus: "loading" });
    try {
      const payload = await qianqiuApi.requestTopicDraft(sessionId, input);
      set({ topicDraft: payload, topicDraftStatus: payload.status === "fallback" ? "error" : "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), topicDraftStatus: "error" });
      throw error;
    }
  },

  async loadInventory(sessionId) {
    set({ inventoryStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.loadInventory(sessionId);
      set({ inventory: payload, currentSessionId: payload.sessionId, inventoryStatus: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), inventoryStatus: "error" });
      throw error;
    }
  },

  async transferInventoryItem(sessionId, input) {
    set({ inventoryStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.transferInventoryItem(sessionId, input);
      set((state) => ({
        inventory: state.inventory
          ? { ...state.inventory, inventoryView: payload.inventoryView }
          : { sessionId, inventoryView: payload.inventoryView },
        inventoryStatus: "ready"
      }));
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), inventoryStatus: "error" });
      throw error;
    }
  },

  async loadNpcs(sessionId, input = {}) {
    set({ npcRosterStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.loadNpcs(sessionId, {
        page: input.page,
        pageSize: input.pageSize,
        group: input.group,
        interaction: input.interaction
      });
      set({ npcRoster: payload, currentSessionId: payload.sessionId, npcRosterStatus: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), npcRosterStatus: "error" });
      throw error;
    }
  },

  async loadNpcDetail(sessionId, npcId) {
    set({ npcDetailStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.loadNpcDetail(sessionId, npcId);
      set({ npcDetail: payload, currentSessionId: payload.sessionId, npcDetailStatus: "ready" });
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), npcDetailStatus: "error" });
      throw error;
    }
  },

  async interactWithNpc(sessionId, input) {
    set({ npcMutationStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.interactWithNpc(sessionId, input);
      set((state) => ({
        lastNpcInteraction: payload,
        npcDetail: payload.npcDetailView && state.npcDetail
          ? {
              ...state.npcDetail,
              npcDetailView: payload.npcDetailView,
              npcInteractionView: payload.npcInteractionView
            }
          : state.npcDetail,
        npcRoster: state.npcRoster
          ? { ...state.npcRoster, npcInteractionView: payload.npcInteractionView }
          : state.npcRoster,
        npcMutationStatus: payload.accepted ? "ready" : "error"
      }));
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), npcMutationStatus: "error" });
      throw error;
    }
  },

  async submitTrade(sessionId, input) {
    set({ npcMutationStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.submitTrade(sessionId, input);
      set((state) => ({
        lastTrade: payload,
        inventory: payload.inventoryView
          ? {
              sessionId: payload.sessionId,
              inventoryView: payload.inventoryView,
              resourceLedgerView: payload.resourceLedgerView ?? state.inventory?.resourceLedgerView,
              assetLedgerView: state.inventory?.assetLedgerView
            }
          : state.inventory,
        npcDetail: state.npcDetail
          ? { ...state.npcDetail, tradeLedgerView: payload.tradeLedgerView }
          : state.npcDetail,
        npcMutationStatus: payload.accepted ? "ready" : "error"
      }));
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), npcMutationStatus: "error" });
      throw error;
    }
  },

  async submitNpcCommand(sessionId, input) {
    set({ npcMutationStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.submitNpcCommand(sessionId, input);
      set((state) => ({
        lastNpcCommand: payload,
        npcRoster: state.npcRoster
          ? { ...state.npcRoster, delegatedTaskView: payload.delegatedTaskView }
          : state.npcRoster,
        npcDetail: state.npcDetail
          ? { ...state.npcDetail, delegatedTaskView: payload.delegatedTaskView }
          : state.npcDetail,
        npcMutationStatus: payload.accepted ? "ready" : "error"
      }));
      return payload;
    } catch (error) {
      set({ error: toErrorMessage(error), npcMutationStatus: "error" });
      throw error;
    }
  }
}));
