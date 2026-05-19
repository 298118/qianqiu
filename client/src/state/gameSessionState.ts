import { create } from "zustand";
import { qianqiuApi } from "../api";
import { useUiStateStore } from "./uiState";
import type {
  AiConnectionTestResponse,
  AiSettingsResponse,
  ExamLevel,
  ExamProgressResponse,
  ExamQuestionResponse,
  ExamSubmitResponse,
  GameRole,
  PlayerStateResponse,
  QuickActionResponse,
  SaveMetadata,
  StartGameResponse,
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
  readonly currentSessionId: string | null;
  readonly currentSession: PlayerStateResponse | StartGameResponse | TurnResponse | ExamSubmitResponse | null;
  readonly lastTurn: TurnResponse | null;
  readonly activeExam: ExamQuestionResponse | ExamProgressResponse | null;
  readonly lastExamResult: ExamSubmitResponse | null;
  readonly saves: SaveMetadata[];
  readonly aiSettings: AiSettingsResponse | null;
  readonly aiConnection: AiConnectionTestResponse | null;
  readonly quickActions: QuickActionResponse | null;
  readonly error: string | null;
  readonly refreshSaves: () => Promise<void>;
  readonly startNewGame: (input: StartGameInput) => Promise<StartGameResponse>;
  readonly loadSession: (sessionId: string) => Promise<PlayerStateResponse>;
  readonly submitTurn: (sessionId: string, input: string) => Promise<TurnResponse>;
  readonly requestExamQuestion: (sessionId: string, level: ExamLevel) => Promise<ExamQuestionResponse>;
  readonly progressExam: (sessionId: string, examId: string, action: string) => Promise<ExamProgressResponse>;
  readonly submitExam: (sessionId: string, examId: string, essay: string) => Promise<ExamSubmitResponse>;
  readonly loadAiSettings: (sessionId: string) => Promise<AiSettingsResponse>;
  readonly updateAiPreset: (sessionId: string, preset: string) => Promise<AiSettingsResponse>;
  readonly updateAiTaskRoute: (sessionId: string, taskType: string, routePatch: Record<string, string | number>) => Promise<AiSettingsResponse>;
  readonly testAiConnection: (provider?: string) => Promise<AiConnectionTestResponse>;
  readonly refreshQuickActions: (sessionId: string, input?: { readonly page?: string; readonly draftPreview?: string; readonly count?: number }) => Promise<QuickActionResponse>;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求未能完成。";
}

export const useGameSessionStore = create<GameSessionState>((set) => ({
  status: "idle",
  savesStatus: "idle",
  settingsStatus: "idle",
  quickActionStatus: "idle",
  currentSessionId: null,
  currentSession: null,
  lastTurn: null,
  activeExam: null,
  lastExamResult: null,
  saves: [],
  aiSettings: null,
  aiConnection: null,
  quickActions: null,
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
      set({
        currentSessionId: payload.sessionId,
        currentSession: payload,
        activeExam: null,
        lastExamResult: null,
        quickActions: null,
        quickActionStatus: "idle",
        status: "ready"
      });
      useUiStateStore.getState().syncSessionPayload(payload, "player-state");
      return payload;
    } catch (error) {
      set({ currentSessionId: sessionId, error: toErrorMessage(error), status: "error" });
      throw error;
    }
  },

  async submitTurn(sessionId, input) {
    set({ status: "loading", error: null });
    try {
      const payload = await qianqiuApi.submitTurn({ sessionId, input });
      set({
        currentSessionId: payload.sessionId,
        currentSession: payload,
        lastTurn: payload,
        activeExam: null,
        quickActions: null,
        quickActionStatus: "idle",
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
  }
}));
