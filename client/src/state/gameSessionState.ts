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

let loadSessionRequestId = 0;
let quickActionRequestId = 0;
let topicSurfaceRequestId = 0;
let topicDraftRequestId = 0;
let inventoryRequestId = 0;
let inventoryTransferRequestId = 0;
let npcRosterRequestId = 0;
let npcDetailRequestId = 0;
let npcMutationRequestId = 0;
let examMutationRequestId = 0;
let aiSettingsReadRequestId = 0;
let aiSettingsWriteRequestId = 0;
let aiSettingsActiveWriteRequestId = 0;
let aiConnectionRequestId = 0;

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
  readonly aiConnectionStatus: LoadingState;
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

function staleSessionResponseError() {
  return new Error("服务器返回的案卷编号与当前路由不一致，已丢弃旧投影。");
}

function supersededRequestError() {
  return new Error("旧请求已被新的路由或选择取代，已丢弃旧投影。");
}

function staleNpcDetailResponseError() {
  return new Error("服务器返回的人物详情与当前选择不一致，已丢弃旧投影。");
}

function isCurrentRouteSession(
  state: Pick<GameSessionState, "currentSessionId" | "currentSession">,
  sessionId: string
) {
  return state.currentSessionId ? state.currentSessionId === sessionId : state.currentSession?.sessionId === sessionId;
}

function canApplyRouteSession(
  state: Pick<GameSessionState, "currentSessionId" | "currentSession">,
  sessionId: string
) {
  return !state.currentSessionId && !state.currentSession?.sessionId
    ? true
    : isCurrentRouteSession(state, sessionId);
}

type AiSettingsReadToken = {
  readonly requestId: number;
  readonly writeRequestId: number;
  readonly blockedByActiveWrite: boolean;
};

function beginAiSettingsRead(): AiSettingsReadToken {
  return {
    requestId: ++aiSettingsReadRequestId,
    writeRequestId: aiSettingsWriteRequestId,
    blockedByActiveWrite: aiSettingsActiveWriteRequestId !== 0
  };
}

function canApplyAiSettingsRead(token: AiSettingsReadToken) {
  return token.requestId === aiSettingsReadRequestId &&
    !token.blockedByActiveWrite &&
    aiSettingsWriteRequestId === token.writeRequestId &&
    aiSettingsActiveWriteRequestId === 0;
}

function beginAiSettingsWrite() {
  const requestId = ++aiSettingsWriteRequestId;
  aiSettingsActiveWriteRequestId = requestId;
  return requestId;
}

function finishAiSettingsWrite(requestId: number) {
  if (aiSettingsActiveWriteRequestId === requestId) aiSettingsActiveWriteRequestId = 0;
}

export const useGameSessionStore = create<GameSessionState>((set) => ({
  status: "idle",
  savesStatus: "idle",
  settingsStatus: "idle",
  aiConnectionStatus: "idle",
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
    const requestId = ++loadSessionRequestId;
    set((state) => ({
      currentSessionId: sessionId,
      status: "loading",
      error: null,
      ...(state.currentSessionId && state.currentSessionId !== sessionId
        ? { npcMutationStatus: "idle" as LoadingState }
        : {})
    }));
    try {
      const payload = await qianqiuApi.loadPlayerState(sessionId);
      if (requestId !== loadSessionRequestId) throw supersededRequestError();
      if (payload.sessionId !== sessionId) throw staleSessionResponseError();
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
              assetLedgerView: payload.assetLedgerView,
              economyTraceView: payload.economyTraceView
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
      if (requestId === loadSessionRequestId) {
        set({ currentSessionId: sessionId, error: toErrorMessage(error), status: "error" });
      }
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
              assetLedgerView: payload.assetLedgerView,
              economyTraceView: payload.economyTraceView
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
    const requestId = ++examMutationRequestId;
    set((state) => canApplyRouteSession(state, sessionId)
      ? { status: "loading", error: null }
      : {});
    try {
      const payload = await qianqiuApi.requestExamQuestion({ sessionId, level });
      if (payload.sessionId !== sessionId) throw staleSessionResponseError();
      set((state) => {
        if (requestId !== examMutationRequestId || !canApplyRouteSession(state, payload.sessionId)) {
          return { status: state.status };
        }
        return { activeExam: payload, currentSessionId: payload.sessionId, status: "ready" };
      });
      return payload;
    } catch (error) {
      if (requestId === examMutationRequestId) {
        set((state) => canApplyRouteSession(state, sessionId)
          ? { error: toErrorMessage(error), status: "error" }
          : {});
      }
      throw error;
    }
  },

  async progressExam(sessionId, examId, action) {
    const requestId = ++examMutationRequestId;
    set((state) => canApplyRouteSession(state, sessionId)
      ? { status: "loading", error: null }
      : {});
    try {
      const payload = await qianqiuApi.progressExam({ sessionId, examId, action });
      if (payload.sessionId !== sessionId) throw staleSessionResponseError();
      set((state) => {
        if (requestId !== examMutationRequestId || !canApplyRouteSession(state, payload.sessionId)) {
          return { status: state.status };
        }
        return { activeExam: payload, currentSessionId: payload.sessionId, status: "ready" };
      });
      return payload;
    } catch (error) {
      if (requestId === examMutationRequestId) {
        set((state) => canApplyRouteSession(state, sessionId)
          ? { error: toErrorMessage(error), status: "error" }
          : {});
      }
      throw error;
    }
  },

  async submitExam(sessionId, examId, essay) {
    const requestId = ++examMutationRequestId;
    set((state) => canApplyRouteSession(state, sessionId)
      ? { status: "loading", error: null }
      : {});
    try {
      const payload = await qianqiuApi.submitExam({ sessionId, examId, essay });
      if (payload.sessionId !== sessionId) throw staleSessionResponseError();
      let applied = false;
      set((state) => {
        if (requestId !== examMutationRequestId || !canApplyRouteSession(state, payload.sessionId)) {
          return { status: state.status };
        }
        applied = true;
        return {
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
        };
      });
      if (applied) useUiStateStore.getState().syncSessionPayload(payload, "exam-submit");
      return payload;
    } catch (error) {
      if (requestId === examMutationRequestId) {
        set((state) => canApplyRouteSession(state, sessionId)
          ? { error: toErrorMessage(error), status: "error" }
          : {});
      }
      throw error;
    }
  },

  async loadAiSettings(sessionId) {
    const readToken = beginAiSettingsRead();
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.getAiSettings(sessionId);
      if (!canApplyAiSettingsRead(readToken)) throw supersededRequestError();
      if (payload.scope !== "global" && payload.sessionId !== sessionId && payload.targetSessionId !== sessionId) {
        throw staleSessionResponseError();
      }
      set({ aiSettings: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      if (canApplyAiSettingsRead(readToken)) set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    }
  },

  async updateAiPreset(sessionId, preset) {
    const requestId = beginAiSettingsWrite();
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.updateAiSettings(sessionId, { settings: { preset } });
      if (requestId !== aiSettingsWriteRequestId) throw supersededRequestError();
      if (payload.scope !== "global" && payload.sessionId !== sessionId && payload.targetSessionId !== sessionId) {
        throw staleSessionResponseError();
      }
      set({ aiSettings: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      if (requestId === aiSettingsWriteRequestId) set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    } finally {
      finishAiSettingsWrite(requestId);
    }
  },

  async updateAiTaskRoute(sessionId, taskType, routePatch) {
    const requestId = beginAiSettingsWrite();
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.updateAiSettings(sessionId, {
        settings: {
          taskRoutes: {
            [taskType]: routePatch
          }
        }
      });
      if (requestId !== aiSettingsWriteRequestId) throw supersededRequestError();
      if (payload.scope !== "global" && payload.sessionId !== sessionId && payload.targetSessionId !== sessionId) {
        throw staleSessionResponseError();
      }
      set({ aiSettings: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      if (requestId === aiSettingsWriteRequestId) set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    } finally {
      finishAiSettingsWrite(requestId);
    }
  },

  async loadGlobalAiSettings() {
    const readToken = beginAiSettingsRead();
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.getGlobalAiSettings();
      if (!canApplyAiSettingsRead(readToken)) throw supersededRequestError();
      set({ aiSettings: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      if (canApplyAiSettingsRead(readToken)) set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    }
  },

  async updateGlobalAiSettings(settings) {
    const requestId = beginAiSettingsWrite();
    set({ settingsStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.updateGlobalAiSettings({ settings });
      if (requestId !== aiSettingsWriteRequestId) throw supersededRequestError();
      set({ aiSettings: payload, settingsStatus: "ready" });
      return payload;
    } catch (error) {
      if (requestId === aiSettingsWriteRequestId) set({ error: toErrorMessage(error), settingsStatus: "error" });
      throw error;
    } finally {
      finishAiSettingsWrite(requestId);
    }
  },

  async testAiConnection(provider) {
    const requestId = ++aiConnectionRequestId;
    set({ aiConnectionStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.testAiConnection(provider ? { provider } : {});
      if (requestId !== aiConnectionRequestId) throw supersededRequestError();
      set({ aiConnection: payload, aiConnectionStatus: "ready" });
      return payload;
    } catch (error) {
      if (requestId === aiConnectionRequestId) set({ error: toErrorMessage(error), aiConnectionStatus: "error" });
      throw error;
    }
  },

  async refreshQuickActions(sessionId, input = {}) {
    const requestId = ++quickActionRequestId;
    set({ quickActionStatus: "loading" });
    try {
      const payload = await qianqiuApi.requestQuickActions(sessionId, {
        page: input.page || "game",
        draftPreview: input.draftPreview?.slice(0, 80),
        count: input.count ?? 3
      });
      if (requestId !== quickActionRequestId) throw supersededRequestError();
      if (payload.sessionId !== sessionId) throw staleSessionResponseError();
      set({ quickActions: payload, quickActionStatus: payload.status === "fallback" ? "error" : "ready" });
      return payload;
    } catch (error) {
      if (requestId === quickActionRequestId) set({ quickActionStatus: "error" });
      throw error;
    }
  },

  async loadTopicSurface(sessionId, surfaceId) {
    const requestId = ++topicSurfaceRequestId;
    set({ topicSurface: null, topicSurfaceStatus: "loading", topicDraft: null, topicDraftStatus: "idle" });
    try {
      const payload = await qianqiuApi.loadTopicSurface(sessionId, surfaceId);
      if (requestId !== topicSurfaceRequestId) throw supersededRequestError();
      if (payload.sessionId !== sessionId || payload.topicSurfaceView.surfaceId !== surfaceId) {
        throw staleSessionResponseError();
      }
      set({ topicSurface: payload, topicSurfaceStatus: "ready" });
      return payload;
    } catch (error) {
      if (requestId === topicSurfaceRequestId) {
        set({ error: toErrorMessage(error), topicSurfaceStatus: "error" });
      }
      throw error;
    }
  },

  async requestTopicDraft(sessionId, input) {
    const requestId = ++topicDraftRequestId;
    set({ topicDraft: null, topicDraftStatus: "loading" });
    try {
      const payload = await qianqiuApi.requestTopicDraft(sessionId, input);
      if (requestId !== topicDraftRequestId) throw supersededRequestError();
      if (payload.sessionId !== sessionId || payload.surfaceId !== input.surfaceId) {
        throw staleSessionResponseError();
      }
      set({ topicDraft: payload, topicDraftStatus: payload.status === "fallback" ? "error" : "ready" });
      return payload;
    } catch (error) {
      if (requestId === topicDraftRequestId) {
        set({ error: toErrorMessage(error), topicDraftStatus: "error" });
      }
      throw error;
    }
  },

  async loadInventory(sessionId) {
    const requestId = ++inventoryRequestId;
    set({ currentSessionId: sessionId, inventoryStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.loadInventory(sessionId);
      if (requestId !== inventoryRequestId) throw supersededRequestError();
      if (payload.sessionId !== sessionId) throw staleSessionResponseError();
      set({ inventory: payload, currentSessionId: payload.sessionId, inventoryStatus: "ready" });
      return payload;
    } catch (error) {
      if (requestId === inventoryRequestId) {
        set({ error: toErrorMessage(error), inventoryStatus: "error" });
      }
      throw error;
    }
  },

  async transferInventoryItem(sessionId, input) {
    const requestId = ++inventoryTransferRequestId;
    set((state) => canApplyRouteSession(state, sessionId)
      ? { inventoryStatus: "loading", error: null }
      : {});
    try {
      const payload = await qianqiuApi.transferInventoryItem(sessionId, input);
      set((state) => {
        const responseSessionId = payload.sessionId ?? sessionId;
        if (requestId !== inventoryTransferRequestId || !canApplyRouteSession(state, responseSessionId)) {
          return {
            inventory: state.inventory,
            inventoryStatus: state.inventoryStatus
          };
        }
        const inventoryMatches = state.inventory?.sessionId === responseSessionId;
        const sessionMatches = state.currentSessionId === responseSessionId || state.currentSession?.sessionId === responseSessionId;
        if ((state.inventory && !inventoryMatches) || (!state.inventory && state.currentSessionId && !sessionMatches)) {
          return {
            inventory: state.inventory,
            inventoryStatus: state.inventoryStatus
          };
        }
        return {
          inventory: state.inventory
            ? {
                ...state.inventory,
                sessionId: responseSessionId,
                inventoryView: payload.inventoryView,
                economyTraceView: payload.economyTraceView ?? state.inventory.economyTraceView
              }
            : {
                sessionId: responseSessionId,
                inventoryView: payload.inventoryView,
                economyTraceView: payload.economyTraceView
              },
          inventoryStatus: "ready"
        };
      });
      return payload;
    } catch (error) {
      if (requestId === inventoryTransferRequestId) {
        set((state) => canApplyRouteSession(state, sessionId)
          ? { error: toErrorMessage(error), inventoryStatus: "error" }
          : {});
      }
      throw error;
    }
  },

  async loadNpcs(sessionId, input = {}) {
    const requestId = ++npcRosterRequestId;
    set((state) => ({
      currentSessionId: sessionId,
      npcRosterStatus: "loading",
      error: null,
      ...(state.currentSessionId && state.currentSessionId !== sessionId
        ? { npcMutationStatus: "idle" as LoadingState }
        : {})
    }));
    try {
      const payload = await qianqiuApi.loadNpcs(sessionId, {
        page: input.page,
        pageSize: input.pageSize,
        group: input.group,
        interaction: input.interaction
      });
      if (requestId !== npcRosterRequestId) throw supersededRequestError();
      if (payload.sessionId !== sessionId) throw staleSessionResponseError();
      set({ npcRoster: payload, currentSessionId: payload.sessionId, npcRosterStatus: "ready" });
      return payload;
    } catch (error) {
      if (requestId === npcRosterRequestId) {
        set({ error: toErrorMessage(error), npcRosterStatus: "error" });
      }
      throw error;
    }
  },

  async loadNpcDetail(sessionId, npcId) {
    const requestId = ++npcDetailRequestId;
    set({ currentSessionId: sessionId, npcDetailStatus: "loading", error: null });
    try {
      const payload = await qianqiuApi.loadNpcDetail(sessionId, npcId);
      if (requestId !== npcDetailRequestId) throw supersededRequestError();
      if (payload.sessionId !== sessionId) throw staleSessionResponseError();
      if (payload.npcDetailView.npcId !== npcId) throw staleNpcDetailResponseError();
      set({ npcDetail: payload, currentSessionId: payload.sessionId, npcDetailStatus: "ready" });
      return payload;
    } catch (error) {
      if (requestId === npcDetailRequestId) {
        set({ error: toErrorMessage(error), npcDetailStatus: "error" });
      }
      throw error;
    }
  },

  async interactWithNpc(sessionId, input) {
    const requestId = ++npcMutationRequestId;
    set((state) => canApplyRouteSession(state, sessionId)
      ? { npcMutationStatus: "loading", error: null }
      : {});
    try {
      const payload = await qianqiuApi.interactWithNpc(sessionId, input);
      set((state) => {
        if (requestId !== npcMutationRequestId) {
          return { npcMutationStatus: state.npcMutationStatus };
        }
        if (!canApplyRouteSession(state, payload.sessionId)) {
          return { npcMutationStatus: "ready" };
        }
        const sessionMatches = state.currentSession?.sessionId === payload.sessionId;
        const npcDetailMatches = Boolean(
          payload.npcDetailView &&
          state.npcDetail?.sessionId === payload.sessionId &&
          state.npcDetail.npcDetailView.npcId === payload.npcDetailView.npcId
        );
        const npcRosterMatches = state.npcRoster?.sessionId === payload.sessionId;
        const currentSession = sessionMatches
          ? {
              ...state.currentSession,
              npcInteractionView: payload.npcInteractionView,
              actorMemoryView: payload.actorMemoryView ?? state.currentSession.actorMemoryView,
              eventArchiveView: payload.eventArchiveView ?? state.currentSession.eventArchiveView,
              worldEntityView: payload.worldEntityView ?? state.currentSession.worldEntityView,
              worldThreadView: payload.worldThreadView ?? state.currentSession.worldThreadView
            }
          : state.currentSession;
        return {
          currentSession,
          lastNpcInteraction: payload,
          npcDetail: npcDetailMatches && payload.npcDetailView && state.npcDetail
            ? {
                ...state.npcDetail,
                npcDetailView: payload.npcDetailView,
                npcInteractionView: payload.npcInteractionView
              }
            : state.npcDetail,
          npcRoster: npcRosterMatches
            ? { ...state.npcRoster, npcInteractionView: payload.npcInteractionView }
            : state.npcRoster,
          npcMutationStatus: payload.accepted ? "ready" : "error"
        };
      });
      return payload;
    } catch (error) {
      if (requestId === npcMutationRequestId) {
        set((state) => canApplyRouteSession(state, sessionId)
          ? { error: toErrorMessage(error), npcMutationStatus: "error" }
          : {});
      }
      throw error;
    }
  },

  async submitTrade(sessionId, input) {
    const requestId = ++npcMutationRequestId;
    set((state) => canApplyRouteSession(state, sessionId)
      ? { npcMutationStatus: "loading", error: null }
      : {});
    try {
      const payload = await qianqiuApi.submitTrade(sessionId, input);
      set((state) => {
        const responseSessionId = payload.sessionId ?? sessionId;
        const sessionMatches = isCurrentRouteSession(state, responseSessionId);
        const currentSessionMatches = state.currentSession?.sessionId === responseSessionId;
        const hasSessionContext = Boolean(state.currentSessionId || state.currentSession?.sessionId);
        if (requestId !== npcMutationRequestId) {
          return {
            lastTrade: state.lastTrade,
            inventory: state.inventory,
            npcDetail: state.npcDetail,
            currentSession: state.currentSession,
            npcMutationStatus: state.npcMutationStatus
          };
        }
        if (hasSessionContext && !sessionMatches) {
          return {
            lastTrade: state.lastTrade,
            inventory: state.inventory,
            npcDetail: state.npcDetail,
            currentSession: state.currentSession,
            npcMutationStatus: "ready"
          };
        }
        const inventoryMatches = state.inventory?.sessionId === responseSessionId;
        const npcDetailMatches = state.npcDetail?.sessionId === responseSessionId;
        return {
          lastTrade: payload,
          currentSession: state.currentSession && currentSessionMatches
            ? {
                ...state.currentSession,
                tradeLedgerView: payload.tradeLedgerView,
                resourceLedgerView: payload.resourceLedgerView ?? state.currentSession.resourceLedgerView,
                inventoryView: payload.inventoryView ?? state.currentSession.inventoryView,
                economyTraceView: payload.economyTraceView ?? state.currentSession.economyTraceView
              }
            : state.currentSession,
          inventory: payload.inventoryView && (!state.inventory || inventoryMatches || sessionMatches)
            ? {
                sessionId: responseSessionId,
                inventoryView: payload.inventoryView,
                resourceLedgerView: payload.resourceLedgerView ?? state.inventory?.resourceLedgerView,
                assetLedgerView: state.inventory?.assetLedgerView,
                economyTraceView: payload.economyTraceView ?? state.inventory?.economyTraceView
              }
            : state.inventory,
          npcDetail: state.npcDetail && npcDetailMatches
            ? { ...state.npcDetail, tradeLedgerView: payload.tradeLedgerView }
            : state.npcDetail,
          npcMutationStatus: payload.accepted ? "ready" : "error"
        };
      });
      return payload;
    } catch (error) {
      if (requestId === npcMutationRequestId) {
        set((state) => canApplyRouteSession(state, sessionId)
          ? { error: toErrorMessage(error), npcMutationStatus: "error" }
          : {});
      }
      throw error;
    }
  },

  async submitNpcCommand(sessionId, input) {
    const requestId = ++npcMutationRequestId;
    set((state) => canApplyRouteSession(state, sessionId)
      ? { npcMutationStatus: "loading", error: null }
      : {});
    try {
      const payload = await qianqiuApi.submitNpcCommand(sessionId, input);
      set((state) => {
        const responseSessionId = payload.sessionId ?? sessionId;
        const sessionMatches = isCurrentRouteSession(state, responseSessionId);
        const currentSessionMatches = state.currentSession?.sessionId === responseSessionId;
        const hasSessionContext = Boolean(state.currentSessionId || state.currentSession?.sessionId);
        if (requestId !== npcMutationRequestId) {
          return {
            lastNpcCommand: state.lastNpcCommand,
            npcRoster: state.npcRoster,
            npcDetail: state.npcDetail,
            currentSession: state.currentSession,
            npcMutationStatus: state.npcMutationStatus
          };
        }
        if (hasSessionContext && !sessionMatches) {
          return {
            lastNpcCommand: state.lastNpcCommand,
            npcRoster: state.npcRoster,
            npcDetail: state.npcDetail,
            currentSession: state.currentSession,
            npcMutationStatus: "ready"
          };
        }
        const npcRosterMatches = state.npcRoster?.sessionId === responseSessionId;
        const npcDetailMatches = state.npcDetail?.sessionId === responseSessionId;
        return {
          lastNpcCommand: payload,
          currentSession: state.currentSession && currentSessionMatches
            ? {
                ...state.currentSession,
                delegatedTaskView: payload.delegatedTaskView,
                economyTraceView: payload.economyTraceView ?? state.currentSession.economyTraceView
              }
            : state.currentSession,
          npcRoster: state.npcRoster && npcRosterMatches
            ? { ...state.npcRoster, delegatedTaskView: payload.delegatedTaskView }
            : state.npcRoster,
          npcDetail: state.npcDetail && npcDetailMatches
            ? { ...state.npcDetail, delegatedTaskView: payload.delegatedTaskView }
            : state.npcDetail,
          npcMutationStatus: payload.accepted ? "ready" : "error"
        };
      });
      return payload;
    } catch (error) {
      if (requestId === npcMutationRequestId) {
        set((state) => canApplyRouteSession(state, sessionId)
          ? { error: toErrorMessage(error), npcMutationStatus: "error" }
          : {});
      }
      throw error;
    }
  }
}));
