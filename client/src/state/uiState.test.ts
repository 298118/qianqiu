import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultDisplayPreferences,
  displayPreferenceSchemaVersion,
  displayPreferenceStorageKey,
  loadDisplayPreferences,
  saveDisplayPreferences
} from "./displayPreferenceStorage";
import { extractSafePlayerPayload, useUiStateStore } from "./uiState";
import { useGameSessionStore } from "./gameSessionState";
import type {
  AiConnectionTestResponse,
  AiSettingsResponse,
  ExamQuestionResponse,
  ExamSubmitResponse,
  InventoryResponse,
  NpcCommandResponse,
  NpcInteractionResponse,
  NpcListResponse,
  PlayerStateResponse,
  StartGameResponse,
  TopicDraftResponse,
  TradeResponse,
  TurnResponse
} from "../api";

const startPayload: StartGameResponse = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  narrative: "沈知微开卷入世。",
  worldState: {
    player: {
      name: "沈知微",
      role: "scholar",
      examRank: "童生"
    },
    hiddenNotes: "不应进入 UI store"
  },
  mapRuntimeView: { schemaVersion: "map-runtime-v1" }
};

const playerStatePayload: PlayerStateResponse = {
  source: "server_player_visible_state_projection",
  sessionId: "22222222-2222-4222-8222-222222222222",
  worldState: {
    player: {
      name: "许清臣",
      role: "official",
      officeTitle: "翰林编修"
    },
    actorMemoryLedger: { hiddenIntent: "不应进入 UI store" }
  },
  informationPanelPageView: { page: 1 },
  aiControlAuditView: { summary: "bounded" }
};

const turnPayload: TurnResponse = {
  sessionId: "33333333-3333-4333-8333-333333333333",
  narrative: "已拜见座师，得经义提点。",
  worldState: {
    player: {
      name: "沈知微",
      role: "scholar"
    }
  },
  examTrigger: null,
  examScene: null
};

const examSubmitPayload: ExamSubmitResponse = {
  sessionId: "44444444-4444-4444-8444-444444444444",
  examId: "exam-1",
  examName: "童试",
  score: { total: 82 },
  worldState: {
    player: {
      name: "沈知微",
      role: "scholar",
      examRank: "秀才"
    }
  }
};

function aiSettingsPayload(preset: string, tokens: number): AiSettingsResponse {
  return {
    sessionId: "global",
    scope: "global",
    updatedAt: `2026-05-22T12:${String(tokens).slice(-2)}:00.000Z`,
    aiSettingsView: {
      preset,
      presets: [
        { id: "balanced", label: "均衡" },
        { id: "fast", label: "迅捷" }
      ],
      providerOptions: [
        { provider: "mock", available: true, requiresKey: false },
        { provider: "openai", available: false, requiresKey: true }
      ],
      taskRoutes: [
        {
          taskType: "narrator",
          label: "叙事",
          purpose: "普通叙事。",
          provider: "mock",
          providerAvailable: true,
          requiresKey: false,
          effectiveStatus: "active",
          model: "mock",
          maxOutputTokens: tokens,
          toolBudget: 1,
          temperature: 0.35,
          reviewerOnly: false,
          mayUseTools: true,
          mayRequestAdjudication: false
        }
      ]
    },
    aiInvocationSummaryView: { safe: true }
  };
}

function installFetchResponses(...payloads: unknown[]) {
  const fetchMock = vi.fn();
  for (const payload of payloads) {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function deferredJsonResponse<T>() {
  let resolvePayload!: (payload: T) => void;
  const response = new Promise<Response>((resolve) => {
    resolvePayload = (payload: T) => {
      resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    };
  });
  return { response, resolvePayload };
}

beforeEach(() => {
  window.localStorage.clear();
  useUiStateStore.getState().resetUiState();
});

afterEach(() => {
  window.localStorage.clear();
  useUiStateStore.getState().resetUiState();
  useGameSessionStore.setState({
    activeExam: null,
    aiConnection: null,
    aiSettings: null,
    currentSession: null,
    currentSessionId: null,
    error: null,
    lastExamResult: null,
    lastNpcInteraction: null,
    lastTrade: null,
    lastNpcCommand: null,
    lastTurn: null,
    npcDetail: null,
    npcDetailStatus: "idle",
    inventory: null,
    inventoryStatus: "idle",
    npcMutationStatus: "idle",
    npcRoster: null,
    npcRosterStatus: "idle",
    saves: [],
    savesStatus: "idle",
    settingsStatus: "idle",
    aiConnectionStatus: "idle",
    quickActionStatus: "idle",
    quickActions: null,
    status: "idle"
  });
  vi.unstubAllGlobals();
});

describe("S74.3 UI state store", () => {
  it("starts with route, drawer, modal, action draft, and display preference defaults", () => {
    const state = useUiStateStore.getState();

    expect(state.currentPage).toBe("home");
    expect(state.currentSessionId).toBeNull();
    expect(state.currentPlayerPayload).toBeNull();
    expect(state.activeDrawer).toBeNull();
    expect(state.activeModal).toBeNull();
    expect(state.activeSurface).toBeNull();
    expect(state.activePortraitViewer).toBeNull();
    expect(state.activeInkboxTab).toBe("ai-settings");
    expect(state.actionDraft).toBeNull();
    expect(state.displayPreferences).toEqual({
      motion: "full",
      textSize: "standard",
      contrast: "standard",
      bodyFont: "serif-classic",
      autoScroll: true,
      mapMotion: true
    });
  });

  it("syncs start and load payloads as a safe player summary without raw world state", () => {
    useUiStateStore.getState().syncSessionPayload(startPayload);
    expect(useUiStateStore.getState().currentPlayerPayload).toMatchObject({
      sessionId: startPayload.sessionId,
      source: "start",
      player: { name: "沈知微", role: "scholar", examRank: "童生" },
      routeViews: { hasMapRuntimeView: true }
    });

    useUiStateStore.getState().syncSessionPayload(playerStatePayload);
    const stateText = JSON.stringify(useUiStateStore.getState());

    expect(useUiStateStore.getState().currentPlayerPayload).toMatchObject({
      sessionId: playerStatePayload.sessionId,
      source: "player-state",
      player: { name: "许清臣", role: "official", officeTitle: "翰林编修" },
      routeViews: { hasAuditSummaryView: true, hasInformationPanelView: true }
    });
    expect(stateText).not.toContain("hiddenNotes");
    expect(stateText).not.toContain("actorMemoryLedger");
    expect(stateText).not.toContain("hiddenIntent");
  });

  it("tracks routed page state and clears transient UI when returning home", () => {
    const store = useUiStateStore.getState();

    store.setCurrentPage("map", startPayload.sessionId);
    store.openDrawer("settings");
    store.openModal("safe-summary");
    store.setActionDraft({ source: "map-runtime", targetPage: "map", text: "沿驿路赴南京查问案牍。" });
    store.selectTab("archive", "events");

    expect(useUiStateStore.getState()).toMatchObject({
      currentPage: "map",
      currentSessionId: startPayload.sessionId,
      activeModal: "safe-summary",
      activePortraitViewer: null,
      actionDraft: { source: "map-runtime" },
      selectedTabs: { archive: "events" }
    });

    useUiStateStore.getState().returnHome();

    expect(useUiStateStore.getState()).toMatchObject({
      currentPage: "home",
      currentSessionId: startPayload.sessionId,
      activeDrawer: null,
      activeModal: null,
      activeSurface: null,
      activePortraitViewer: null,
      actionDraft: null
    });
  });

  it("keeps the current session pointer when route state returns to home", () => {
    const store = useUiStateStore.getState();

    store.setCurrentPage("game", startPayload.sessionId);
    store.setCurrentPage("home", null);

    expect(useUiStateStore.getState()).toMatchObject({
      currentPage: "home",
      currentSessionId: startPayload.sessionId
    });
  });

  it("opens and closes drawers, modals, local surfaces, and safe action drafts", () => {
    const store = useUiStateStore.getState();

    store.openDrawer("display-preferences");
    expect(useUiStateStore.getState().activeDrawer).toBe("settings");
    expect(useUiStateStore.getState().activeInkboxTab).toBe("display");
    store.closeDrawer();
    expect(useUiStateStore.getState().activeDrawer).toBeNull();

    store.openInkbox("saves");
    expect(useUiStateStore.getState().activeDrawer).toBe("settings");
    expect(useUiStateStore.getState().activeInkboxTab).toBe("saves");
    store.selectInkboxTab("safe-summary");
    expect(useUiStateStore.getState().activeInkboxTab).toBe("safe-summary");

    store.openModal("safe-summary");
    expect(useUiStateStore.getState().activeModal).toBe("safe-summary");
    store.closeModal();
    expect(useUiStateStore.getState().activeModal).toBeNull();

    store.openSurface("npc-profile");
    expect(useUiStateStore.getState().activeSurface).toBe("npc-profile");
    store.closeSurface();
    expect(useUiStateStore.getState().activeSurface).toBeNull();

    store.openPortraitViewer({ portraitRef: "portrait-test-female-v1", label: "女官" });
    expect(useUiStateStore.getState().activePortraitViewer).toEqual({
      portraitRef: "portrait-test-female-v1",
      label: "女官"
    });
    store.closePortraitViewer();
    expect(useUiStateStore.getState().activePortraitViewer).toBeNull();

    store.setActionDraft({ text: "拜访座师，请教经义。", targetPage: "game" });
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "manual",
      text: "拜访座师，请教经义。",
      targetPage: "game"
    });
    store.clearActionDraft();
    expect(useUiStateStore.getState().actionDraft).toBeNull();
  });

  it("opens local surfaces against the current route session and drops stale safe payloads", () => {
    const store = useUiStateStore.getState();

    store.syncSessionPayload(startPayload, "player-state");
    store.openDrawer("saves");
    store.openModal("safe-summary");
    store.openPortraitViewer({ portraitRef: "portrait-test-female-v1", label: "女官" });

    store.openSurfaceForSession("court-debate", playerStatePayload.sessionId);

    expect(useUiStateStore.getState()).toMatchObject({
      currentSessionId: playerStatePayload.sessionId,
      currentPlayerPayload: null,
      activeDrawer: null,
      activeModal: null,
      activeSurface: "court-debate",
      activePortraitViewer: null
    });

    store.syncSessionPayload(playerStatePayload, "player-state");
    store.openSurfaceForSession("memorial-review", playerStatePayload.sessionId);

    expect(useUiStateStore.getState()).toMatchObject({
      currentSessionId: playerStatePayload.sessionId,
      currentPlayerPayload: { sessionId: playerStatePayload.sessionId },
      activeSurface: "memorial-review"
    });
  });

  it("clears topic draft context when a user rewrites the memorial manually", () => {
    const store = useUiStateStore.getState();

    store.setActionDraft({
      source: "role-surface",
      targetPage: "game",
      text: "据堂审材料拟稿。",
      draftContext: {
        surfaceId: "trial",
        draftKind: "investigate_case",
        evidenceRefs: ["evidence:events:domainConsequenceEcho:abc123"],
        canonicalEchoRefs: ["domainConsequenceEcho:abc123"],
        generatedAtTurn: 2,
        status: "client_hint"
      }
    });
    expect(useUiStateStore.getState().actionDraft?.draftContext?.canonicalEchoRefs).toEqual([
      "domainConsequenceEcho:abc123"
    ]);

    store.setActionDraft({
      source: "manual",
      targetPage: "game",
      text: "改为另写一札，不再引用原堂审草稿。"
    });

    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "manual",
      text: "改为另写一札，不再引用原堂审草稿。",
      targetPage: "game"
    });
    expect(useUiStateStore.getState().actionDraft?.draftContext).toBeUndefined();
  });

  it("updates display preferences without adding session payload fields", () => {
    const store = useUiStateStore.getState();

    store.setDisplayPreference("motion", "reduced");
    store.setDisplayPreference("textSize", "large");
    store.setDisplayPreference("contrast", "high");
    store.setDisplayPreference("bodyFont", "kai-longcang");
    store.setDisplayPreference("autoScroll", false);
    store.setDisplayPreference("mapMotion", false);

    expect(useUiStateStore.getState().displayPreferences).toEqual({
      motion: "reduced",
      textSize: "large",
      contrast: "high",
      bodyFont: "kai-longcang",
      autoScroll: false,
      mapMotion: false
    });
    expect(JSON.stringify(useUiStateStore.getState().displayPreferences)).not.toMatch(/sessionId|worldState|provider|prompt|key/i);

    const stored = JSON.parse(window.localStorage.getItem(displayPreferenceStorageKey) ?? "{}");
    expect(stored).toEqual({
      schemaVersion: displayPreferenceSchemaVersion,
      preferences: {
        motion: "reduced",
        textSize: "large",
        contrast: "high",
        bodyFont: "kai-longcang",
        autoScroll: false,
        mapMotion: false
      }
    });
    expect(JSON.stringify(stored)).not.toMatch(/sessionId|worldState|provider|prompt|key|data\/sessions|C:\\/i);
  });

  it("loads only versioned display preference fields and drops polluted values", () => {
    window.localStorage.setItem(
      displayPreferenceStorageKey,
      JSON.stringify({
        schemaVersion: displayPreferenceSchemaVersion,
        preferences: {
          motion: "reduced",
          textSize: "oversized",
          contrast: "high",
          bodyFont: "brush-mashan",
          autoScroll: "yes",
          mapMotion: false,
          sessionId: "11111111-1111-4111-8111-111111111111",
          worldState: { raw: true },
          prompt: "完整提示词",
          providerPayload: { key: "OPENAI_API_KEY" },
          localPath: "E:\\LSMNQ\\data\\sessions\\raw.json"
        }
      })
    );

    expect(loadDisplayPreferences()).toEqual({
      motion: "reduced",
      textSize: "standard",
      contrast: "high",
      bodyFont: "brush-mashan",
      autoScroll: true,
      mapMotion: false
    });
  });

  it("falls back when display preference schema is missing, stale, or invalid", () => {
    window.localStorage.setItem(displayPreferenceStorageKey, JSON.stringify({ preferences: { motion: "reduced" } }));
    expect(loadDisplayPreferences()).toEqual(defaultDisplayPreferences);

    window.localStorage.setItem(
      displayPreferenceStorageKey,
      JSON.stringify({ schemaVersion: "display-preferences-v0", preferences: { motion: "reduced" } })
    );
    expect(loadDisplayPreferences()).toEqual(defaultDisplayPreferences);

    window.localStorage.setItem(displayPreferenceStorageKey, "{not-json");
    expect(loadDisplayPreferences()).toEqual(defaultDisplayPreferences);
  });

  it("saves a whitelist-only display preference payload", () => {
    saveDisplayPreferences({
      motion: "reduced",
      textSize: "large",
      contrast: "high",
      bodyFont: "song-xiaowei",
      autoScroll: false,
      mapMotion: false,
      sessionId: "11111111-1111-4111-8111-111111111111",
      rawState: { hidden: true },
      prompt: "完整提示词",
      providerPayload: { token: "key" },
      localPath: "E:\\LSMNQ\\data\\sessions\\raw.json"
    } as never);

    const stored = JSON.parse(window.localStorage.getItem(displayPreferenceStorageKey) ?? "{}");
    expect(Object.keys(stored.preferences).sort()).toEqual(["autoScroll", "bodyFont", "contrast", "mapMotion", "motion", "textSize"]);
    expect(stored.preferences).toEqual({
      motion: "reduced",
      textSize: "large",
      contrast: "high",
      bodyFont: "song-xiaowei",
      autoScroll: false,
      mapMotion: false
    });
    expect(JSON.stringify(stored)).not.toMatch(/sessionId|rawState|worldState|provider|prompt|key|data\/sessions|E:\\/i);
  });

  it("ignores invalid runtime display preference writes", () => {
    const store = useUiStateStore.getState();

    store.setDisplayPreference("motion", "reduced");
    store.setDisplayPreference("motion", "raw" as never);
    store.setDisplayPreference("bodyFont", "unsafe-font" as never);
    store.setDisplayPreference("autoScroll", "yes" as never);

    expect(useUiStateStore.getState().displayPreferences).toMatchObject({
      motion: "reduced",
      bodyFont: "serif-classic",
      autoScroll: true
    });
    const stored = JSON.parse(window.localStorage.getItem(displayPreferenceStorageKey) ?? "{}");
    expect(stored.preferences).toMatchObject({
      motion: "reduced",
      bodyFont: "serif-classic",
      autoScroll: true
    });
  });

  it("extracts only the player-facing payload summary", () => {
    const safePayload = extractSafePlayerPayload(startPayload);

    expect(safePayload).toEqual({
      sessionId: startPayload.sessionId,
      source: "start",
      player: {
        name: "沈知微",
        role: "scholar",
        portraitRef: undefined,
        examRank: "童生",
        officeTitle: undefined
      },
      narrativePreview: "沈知微开卷入世。",
      routeViews: {
        hasAiSettingsView: false,
        hasAuditSummaryView: false,
        hasDelegatedTaskView: false,
        hasEventArchiveView: false,
        hasExamCalendarView: false,
        hasInformationPanelView: false,
        hasInventoryView: false,
        hasMapRuntimeView: true,
        hasMarketPriceView: false,
        hasEconomyTraceView: false,
        hasNpcActiveRequestView: false,
        hasNpcEconomyView: false,
        hasNpcRosterView: false,
        hasDomainConsequenceView: false,
        hasRoleCycleView: false,
        hasTradeLedgerView: false
      }
    });
  });

  it("marks server fallback quick actions as degraded suggestions", async () => {
    installFetchResponses({
      schemaVersion: "s75.9-quick-actions.v1",
      sessionId: startPayload.sessionId,
      source: "local-rule",
      status: "fallback",
      fallbackReason: "quick_action_provider_failed",
      quickActionSuggestions: [
        {
          id: "fallback-study",
          source: "local-rule",
          sourceLabel: "local-rule",
          title: "研读",
          label: "研读",
          text: "闭门研读经义，整理近日所得，准备下一场考试。",
          roleTags: ["scholar"],
          toolIntent: "study",
          evidenceRefs: []
        }
      ]
    });

    await useGameSessionStore.getState().refreshQuickActions(startPayload.sessionId, { page: "game", count: 1 });

    expect(useGameSessionStore.getState().quickActionStatus).toBe("error");
    expect(useGameSessionStore.getState().quickActions).toMatchObject({
      status: "fallback",
      fallbackReason: "quick_action_provider_failed",
      quickActionSuggestions: [{ source: "local-rule" }]
    });
  });

  it("syncs UI safe payloads from game session async actions", async () => {
    const matchingExamSubmitPayload: ExamSubmitResponse = {
      ...examSubmitPayload,
      sessionId: turnPayload.sessionId
    };
    installFetchResponses(startPayload, playerStatePayload, turnPayload, matchingExamSubmitPayload);

    useUiStateStore.getState().setActionDraft({ source: "manual", targetPage: "game", text: "先写一封拜帖。" });
    await useGameSessionStore.getState().startNewGame({
      dynasty: "明",
      playerName: "沈知微",
      role: "scholar",
      year: 1600
    });
    expect(useUiStateStore.getState().currentPlayerPayload).toMatchObject({
      sessionId: startPayload.sessionId,
      source: "start",
      player: { name: "沈知微" }
    });
    expect(useUiStateStore.getState().actionDraft).toBeNull();

    await useGameSessionStore.getState().loadSession(playerStatePayload.sessionId);
    expect(useUiStateStore.getState().currentPlayerPayload).toMatchObject({
      sessionId: playerStatePayload.sessionId,
      source: "player-state",
      player: { officeTitle: "翰林编修" }
    });

    useUiStateStore.getState().setActionDraft({ source: "manual", targetPage: "game", text: "拜访座师，请教经义。" });
    await useGameSessionStore.getState().submitTurn(turnPayload.sessionId, "拜访座师，请教经义。");
    expect(useUiStateStore.getState().currentPlayerPayload).toMatchObject({
      sessionId: turnPayload.sessionId,
      source: "turn",
      narrativePreview: "已拜见座师，得经义提点。"
    });
    expect(useUiStateStore.getState().actionDraft).toBeNull();

    await useGameSessionStore.getState().submitExam(matchingExamSubmitPayload.sessionId, matchingExamSubmitPayload.examId, "臣闻治世之要。");
    expect(useUiStateStore.getState().currentPlayerPayload).toMatchObject({
      sessionId: matchingExamSubmitPayload.sessionId,
      source: "exam-submit",
      player: { examRank: "秀才" }
    });
  });

  it("does not apply stale exam question responses after the route changes", async () => {
    const staleSessionId = "12121212-1212-4121-8121-121212121212";
    const activeSessionId = "34343434-3434-4343-8343-343434343434";
    const staleSession: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: staleSessionId,
      worldState: { player: { name: "旧案士子", role: "scholar" } }
    };
    const activeSession: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: activeSessionId,
      worldState: { player: { name: "当前士子", role: "scholar" } }
    };
    const activeExam: ExamQuestionResponse = {
      sessionId: activeSessionId,
      examId: "exam-active",
      examName: "当前童试",
      examQuestion: "当前案卷策问。"
    };
    const staleExam: ExamQuestionResponse = {
      sessionId: staleSessionId,
      examId: "exam-stale",
      examName: "旧案童试",
      examQuestion: "旧案策问不应回写。"
    };
    const deferred = deferredJsonResponse<ExamQuestionResponse>();
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/exam/question") return deferred.response;
      throw new Error(`unexpected url: ${url}`);
    }));
    useGameSessionStore.setState({
      currentSessionId: staleSessionId,
      currentSession: staleSession,
      activeExam: null,
      error: null,
      status: "ready"
    });

    const request = useGameSessionStore.getState().requestExamQuestion(staleSessionId, "child_exam");
    expect(useGameSessionStore.getState().status).toBe("loading");
    useGameSessionStore.setState({
      currentSessionId: activeSessionId,
      currentSession: activeSession,
      activeExam,
      error: null,
      status: "ready"
    });
    deferred.resolvePayload(staleExam);

    await expect(request).resolves.toEqual(staleExam);
    const state = useGameSessionStore.getState();
    expect(state.currentSessionId).toBe(activeSessionId);
    expect(state.currentSession).toEqual(activeSession);
    expect(state.activeExam).toEqual(activeExam);
    expect(state.error).toBeNull();
    expect(state.status).toBe("ready");
    expect(JSON.stringify(state)).not.toMatch(/旧案策问不应回写|旧案童试|旧案士子/);
  });

  it("ignores stale exam failures after the route moves to another session", async () => {
    const staleSessionId = "45454545-4545-4545-8545-454545454545";
    const activeSessionId = "56565656-5656-4565-8565-565656565656";
    const staleSession: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: staleSessionId,
      worldState: { player: { name: "旧案考生", role: "scholar" } }
    };
    const activeSession: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: activeSessionId,
      worldState: { player: { name: "当前考生", role: "scholar" } }
    };
    const staleExam: ExamQuestionResponse = {
      sessionId: staleSessionId,
      examId: "exam-stale",
      examName: "旧案童试",
      examQuestion: "旧案题目。"
    };
    let rejectFetch!: (error: Error) => void;
    const response = new Promise<Response>((_resolve, reject) => {
      rejectFetch = reject;
    });
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/exam/progress") return response;
      throw new Error(`unexpected url: ${url}`);
    }));
    useGameSessionStore.setState({
      currentSessionId: staleSessionId,
      currentSession: staleSession,
      activeExam: staleExam,
      error: null,
      status: "ready"
    });

    const request = useGameSessionStore.getState().progressExam(staleSessionId, "exam-stale", "旧案推进。");
    expect(useGameSessionStore.getState().status).toBe("loading");
    useGameSessionStore.setState({
      currentSessionId: activeSessionId,
      currentSession: activeSession,
      activeExam: null,
      error: null,
      status: "ready"
    });
    rejectFetch(new Error("旧案科举请求失败不应显示"));

    await expect(request).rejects.toThrow(/旧案科举请求失败不应显示/);
    const state = useGameSessionStore.getState();
    expect(state.currentSessionId).toBe(activeSessionId);
    expect(state.currentSession).toEqual(activeSession);
    expect(state.activeExam).toBeNull();
    expect(state.error).toBeNull();
    expect(state.status).toBe("ready");
    expect(JSON.stringify(state)).not.toMatch(/旧案科举请求失败不应显示|旧案考生|旧案题目/);
  });

  it("does not sync stale exam submit responses into the game or UI session payload", async () => {
    const staleSessionId = "67676767-6767-4676-8676-676767676767";
    const activeSessionId = "78787878-7878-4787-8787-787878787878";
    const activeSession: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: activeSessionId,
      worldState: { player: { name: "当前案主", role: "scholar", examRank: "童生" } }
    };
    const staleResult: ExamSubmitResponse = {
      ...examSubmitPayload,
      sessionId: staleSessionId,
      examId: "exam-stale",
      examName: "旧案童试",
      worldState: {
        player: {
          name: "旧案案主",
          role: "scholar",
          examRank: "旧案秀才"
        }
      }
    };
    const deferred = deferredJsonResponse<ExamSubmitResponse>();
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/exam/submit") return deferred.response;
      throw new Error(`unexpected url: ${url}`);
    }));
    useGameSessionStore.setState({
      currentSessionId: staleSessionId,
      currentSession: {
        ...playerStatePayload,
        sessionId: staleSessionId,
        worldState: { player: { name: "旧案案主", role: "scholar" } }
      },
      activeExam: {
        sessionId: staleSessionId,
        examId: "exam-stale",
        examName: "旧案童试",
        examQuestion: "旧案策问。"
      },
      lastExamResult: null,
      error: null,
      status: "ready"
    });
    useUiStateStore.getState().syncSessionPayload(activeSession, "player-state");

    const request = useGameSessionStore.getState().submitExam(staleSessionId, "exam-stale", "旧案文章。");
    expect(useGameSessionStore.getState().status).toBe("loading");
    useGameSessionStore.setState({
      currentSessionId: activeSessionId,
      currentSession: activeSession,
      activeExam: null,
      lastExamResult: null,
      error: null,
      status: "ready"
    });
    deferred.resolvePayload(staleResult);

    await expect(request).resolves.toEqual(staleResult);
    const state = useGameSessionStore.getState();
    expect(state.currentSessionId).toBe(activeSessionId);
    expect(state.currentSession).toEqual(activeSession);
    expect(state.activeExam).toBeNull();
    expect(state.lastExamResult).toBeNull();
    expect(state.error).toBeNull();
    expect(state.status).toBe("ready");
    expect(useUiStateStore.getState().currentPlayerPayload).toMatchObject({
      sessionId: activeSessionId,
      player: { name: "当前案主", examRank: "童生" }
    });
    expect(JSON.stringify({
      game: state,
      ui: useUiStateStore.getState().currentPlayerPayload
    })).not.toMatch(/旧案秀才|旧案童试|旧案案主|exam-stale/);
  });

  it("does not let an older player-state load overwrite the latest session", async () => {
    const olderSessionId = "55555555-5555-4555-8555-555555555555";
    const latestSessionId = "66666666-6666-4666-8666-666666666666";
    const olderPayload: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: olderSessionId,
      worldState: {
        player: { name: "旧案主", role: "official", officeTitle: "旧案官职" }
      }
    };
    const latestPayload: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: latestSessionId,
      worldState: {
        player: { name: "当前案主", role: "magistrate", officeTitle: "当前知县" }
      },
      inventoryView: {
        containers: [{ containerId: "latest-box", label: "当前书箧" }],
        items: [],
        importantCredentials: []
      }
    };
    const older = deferredJsonResponse<PlayerStateResponse>();
    const latest = deferredJsonResponse<PlayerStateResponse>();
    const fetchMock = vi.fn((url: string) => {
      if (url === `/api/game/player-state/${olderSessionId}`) return older.response;
      if (url === `/api/game/player-state/${latestSessionId}`) return latest.response;
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const olderLoad = useGameSessionStore.getState().loadSession(olderSessionId);
    const latestLoad = useGameSessionStore.getState().loadSession(latestSessionId);

    latest.resolvePayload(latestPayload);
    await latestLoad;
    expect(useGameSessionStore.getState().currentSessionId).toBe(latestSessionId);
    expect(useGameSessionStore.getState().currentSession?.worldState.player?.name).toBe("当前案主");
    expect(useUiStateStore.getState().currentPlayerPayload).toMatchObject({
      sessionId: latestSessionId,
      player: { name: "当前案主" }
    });

    older.resolvePayload(olderPayload);
    await expect(olderLoad).rejects.toThrow(/旧请求/);

    const stateText = JSON.stringify({
      game: useGameSessionStore.getState().currentSession,
      ui: useUiStateStore.getState().currentPlayerPayload
    });
    expect(useGameSessionStore.getState().currentSessionId).toBe(latestSessionId);
    expect(useGameSessionStore.getState().currentSession?.worldState.player?.name).toBe("当前案主");
    expect(useUiStateStore.getState().currentPlayerPayload?.sessionId).toBe(latestSessionId);
    expect(stateText).not.toMatch(/旧案主|旧案官职/);
  });

  it("rejects an older topic draft response before local draft callers can apply it", async () => {
    const sessionId = "99999999-9999-4999-8999-999999999999";
    const olderDraft: TopicDraftResponse = {
      schemaVersion: "topic-draft-v1",
      sessionId,
      surfaceId: "memorial-review",
      source: "mock-ai",
      status: "ready",
      topicDraft: {
        surfaceId: "memorial-review",
        draftKind: "memorial",
        draftTitle: "旧专题草稿",
        draftText: "旧专题草稿不应回写。",
        evidenceRefs: [],
        source: "mock-ai"
      }
    };
    const latestDraft: TopicDraftResponse = {
      ...olderDraft,
      surfaceId: "court-debate",
      topicDraft: {
        ...olderDraft.topicDraft,
        surfaceId: "court-debate",
        draftTitle: "当前专题草稿",
        draftText: "当前专题草稿。"
      }
    };
    const older = deferredJsonResponse<TopicDraftResponse>();
    const latest = deferredJsonResponse<TopicDraftResponse>();
    const fetchMock = vi.fn((url: string) => {
      if (url === `/api/ai/topic-draft/${sessionId}`) {
        return fetchMock.mock.calls.length === 1 ? older.response : latest.response;
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const olderRequest = useGameSessionStore.getState().requestTopicDraft(sessionId, { surfaceId: "memorial-review" });
    const latestRequest = useGameSessionStore.getState().requestTopicDraft(sessionId, { surfaceId: "court-debate" });

    latest.resolvePayload(latestDraft);
    await latestRequest;
    expect(useGameSessionStore.getState().topicDraft?.topicDraft.draftText).toBe("当前专题草稿。");

    older.resolvePayload(olderDraft);
    await expect(olderRequest).rejects.toThrow(/旧请求/);
    expect(useGameSessionStore.getState().topicDraft?.surfaceId).toBe("court-debate");
    expect(JSON.stringify(useGameSessionStore.getState().topicDraft)).not.toMatch(/旧专题草稿/);
  });

  it("does not let stale global AI settings loads overwrite the latest settings payload", async () => {
    const older = deferredJsonResponse<AiSettingsResponse>();
    const latest = deferredJsonResponse<AiSettingsResponse>();
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === "/api/ai/settings/global" && options?.method !== "POST") {
        return fetchMock.mock.calls.length === 1 ? older.response : latest.response;
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const olderLoad = useGameSessionStore.getState().loadGlobalAiSettings();
    const latestLoad = useGameSessionStore.getState().loadGlobalAiSettings();

    latest.resolvePayload(aiSettingsPayload("fast", 1200));
    await latestLoad;
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.preset).toBe("fast");
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.taskRoutes?.[0]).toMatchObject({
      maxOutputTokens: 1200
    });

    older.resolvePayload(aiSettingsPayload("balanced", 900));
    await expect(olderLoad).rejects.toThrow(/旧请求/);
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.preset).toBe("fast");
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.taskRoutes?.[0]).not.toMatchObject({
      maxOutputTokens: 900
    });
    expect(useGameSessionStore.getState().settingsStatus).toBe("ready");
  });

  it("keeps saved global AI settings when an older reload returns later", async () => {
    const olderReload = deferredJsonResponse<AiSettingsResponse>();
    const saved = deferredJsonResponse<AiSettingsResponse>();
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === "/api/ai/settings/global" && options?.method === "POST") return saved.response;
      if (url === "/api/ai/settings/global") return olderReload.response;
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const reloadRequest = useGameSessionStore.getState().loadGlobalAiSettings();
    const saveRequest = useGameSessionStore.getState().updateGlobalAiSettings({
      preset: "fast",
      taskRoutes: {
        narrator: {
          provider: "mock",
          model: "mock",
          maxOutputTokens: 1500,
          toolBudget: 1,
          temperature: 0.35
        }
      }
    });

    saved.resolvePayload(aiSettingsPayload("fast", 1500));
    await saveRequest;
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.taskRoutes?.[0]).toMatchObject({
      maxOutputTokens: 1500
    });

    olderReload.resolvePayload(aiSettingsPayload("balanced", 700));
    await expect(reloadRequest).rejects.toThrow(/旧请求/);
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.preset).toBe("fast");
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.taskRoutes?.[0]).not.toMatchObject({
      maxOutputTokens: 700
    });
  });

  it("keeps a pending global AI settings save authoritative over a later reload", async () => {
    const saved = deferredJsonResponse<AiSettingsResponse>();
    const laterReload = deferredJsonResponse<AiSettingsResponse>();
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === "/api/ai/settings/global" && options?.method === "POST") return saved.response;
      if (url === "/api/ai/settings/global") return laterReload.response;
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const saveRequest = useGameSessionStore.getState().updateGlobalAiSettings({
      preset: "fast",
      taskRoutes: {
        narrator: {
          provider: "mock",
          model: "mock",
          maxOutputTokens: 1600,
          toolBudget: 1,
          temperature: 0.35
        }
      }
    });
    const reloadRequest = useGameSessionStore.getState().loadGlobalAiSettings();

    saved.resolvePayload(aiSettingsPayload("fast", 1600));
    await saveRequest;
    expect(useGameSessionStore.getState().settingsStatus).toBe("ready");
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.preset).toBe("fast");
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.taskRoutes?.[0]).toMatchObject({
      maxOutputTokens: 1600
    });

    laterReload.resolvePayload(aiSettingsPayload("balanced", 600));
    await expect(reloadRequest).rejects.toThrow(/旧请求/);
    expect(useGameSessionStore.getState().settingsStatus).toBe("ready");
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.preset).toBe("fast");
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.taskRoutes?.[0]).not.toMatchObject({
      maxOutputTokens: 600
    });
  });

  it("does not let stale AI connection tests overwrite the latest provider result", async () => {
    const older = deferredJsonResponse<AiConnectionTestResponse>();
    const latest = deferredJsonResponse<AiConnectionTestResponse>();
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/connection-test") {
        return fetchMock.mock.calls.length === 1 ? older.response : latest.response;
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const olderTest = useGameSessionStore.getState().testAiConnection("mock");
    const latestTest = useGameSessionStore.getState().testAiConnection("openai");

    latest.resolvePayload({ ok: false, provider: "openai", status: "missing_key" });
    await latestTest;
    expect(useGameSessionStore.getState().aiConnection).toMatchObject({
      provider: "openai",
      status: "missing_key"
    });

    older.resolvePayload({ ok: true, provider: "mock", status: "ready" });
    await expect(olderTest).rejects.toThrow(/旧请求/);
    expect(useGameSessionStore.getState().aiConnection).toMatchObject({
      provider: "openai",
      status: "missing_key"
    });
    expect(useGameSessionStore.getState().aiConnectionStatus).toBe("ready");
    expect(useGameSessionStore.getState().settingsStatus).toBe("idle");
  });

  it("keeps AI connection-test loading separate from settings loads", async () => {
    const settings = deferredJsonResponse<AiSettingsResponse>();
    const connection = deferredJsonResponse<AiConnectionTestResponse>();
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/settings/global") return settings.response;
      if (url === "/api/ai/connection-test") return connection.response;
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const settingsRequest = useGameSessionStore.getState().loadGlobalAiSettings();
    expect(useGameSessionStore.getState().settingsStatus).toBe("loading");
    const connectionRequest = useGameSessionStore.getState().testAiConnection("mock");
    expect(useGameSessionStore.getState().settingsStatus).toBe("loading");
    expect(useGameSessionStore.getState().aiConnectionStatus).toBe("loading");

    connection.resolvePayload({ ok: true, provider: "mock", status: "ready" });
    await connectionRequest;
    expect(useGameSessionStore.getState().aiConnectionStatus).toBe("ready");
    expect(useGameSessionStore.getState().settingsStatus).toBe("loading");
    expect(useGameSessionStore.getState().aiSettings).toBeNull();

    settings.resolvePayload(aiSettingsPayload("balanced", 900));
    await settingsRequest;
    expect(useGameSessionStore.getState().settingsStatus).toBe("ready");
    expect(useGameSessionStore.getState().aiConnectionStatus).toBe("ready");
    expect(useGameSessionStore.getState().aiSettings?.aiSettingsView.preset).toBe("balanced");
  });

  it("rejects mismatched player-state payloads without syncing stale UI payloads", async () => {
    const routeSessionId = "77777777-7777-4777-8777-777777777777";
    const stalePayload: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: "88888888-8888-4888-8888-888888888888",
      worldState: {
        player: { name: "错案主", role: "official", officeTitle: "错案官职" }
      }
    };
    installFetchResponses(stalePayload);

    await expect(useGameSessionStore.getState().loadSession(routeSessionId)).rejects.toThrow(/案卷编号/);

    expect(useGameSessionStore.getState()).toMatchObject({
      currentSessionId: routeSessionId,
      currentSession: null,
      status: "error"
    });
    expect(useUiStateStore.getState().currentPlayerPayload).toBeNull();
    expect(JSON.stringify(useUiStateStore.getState())).not.toMatch(/错案主|错案官职/);
  });

  it("does not merge stale inventory transfer payloads into another session", async () => {
    const activeSessionId = "55555555-5555-4555-8555-555555555555";
    const staleSessionId = "66666666-6666-4666-8666-666666666666";
    const activeInventory = {
      sessionId: activeSessionId,
      inventoryView: {
        containers: [{ containerId: "active-container", label: "当前书箧" }],
        items: [{ itemId: "active-item", name: "当前清册", containerId: "active-container" }],
        importantCredentials: []
      },
      economyTraceView: {
        traceItems: [{ traceId: "active-trace", title: "当前账本解释" }]
      }
    };
    installFetchResponses({
      sessionId: staleSessionId,
      accepted: true,
      inventoryView: {
        containers: [{ containerId: "stale-container", label: "旧案书箧" }],
        items: [{ itemId: "stale-item", name: "旧案清册", containerId: "stale-container" }],
        importantCredentials: []
      },
      economyTraceView: {
        traceItems: [{ traceId: "stale-trace", title: "旧案经济解释" }]
      }
    });
    useGameSessionStore.setState({
      currentSessionId: activeSessionId,
      inventory: activeInventory,
      inventoryStatus: "ready"
    });

    await useGameSessionStore.getState().transferInventoryItem(staleSessionId, {
      itemId: "stale-item",
      toContainerId: "stale-container"
    });

    const state = useGameSessionStore.getState();
    expect(state.inventory).toEqual(activeInventory);
    expect(JSON.stringify(state.inventory)).not.toMatch(/旧案清册|旧案经济解释|stale-trace/);
  });

  it("ignores stale inventory transfer failures after the route moves to another session", async () => {
    const activeSessionId = "55555555-5555-4555-8555-555555555555";
    const staleSessionId = "66666666-6666-4666-8666-666666666666";
    const staleInventory: InventoryResponse = {
      sessionId: staleSessionId,
      inventoryView: {
        containers: [{ containerId: "stale-container", label: "旧案书箧" }],
        items: [{ itemId: "stale-item", name: "旧案清册", containerId: "stale-container" }],
        importantCredentials: []
      }
    };
    const activeInventory: InventoryResponse = {
      sessionId: activeSessionId,
      inventoryView: {
        containers: [{ containerId: "active-container", label: "当前书箧" }],
        items: [{ itemId: "active-item", name: "当前清册", containerId: "active-container" }],
        importantCredentials: []
      },
      economyTraceView: {
        traceItems: [{ traceId: "active-trace", title: "当前账本解释" }]
      }
    };
    let rejectFetch!: (error: Error) => void;
    const response = new Promise<Response>((_resolve, reject) => {
      rejectFetch = reject;
    });
    vi.stubGlobal("fetch", vi.fn(() => response));
    useGameSessionStore.setState({
      currentSessionId: staleSessionId,
      inventory: staleInventory,
      inventoryStatus: "ready",
      error: null
    });

    const request = useGameSessionStore.getState().transferInventoryItem(staleSessionId, {
      itemId: "stale-item",
      toContainerId: "stale-container"
    });
    expect(useGameSessionStore.getState().inventoryStatus).toBe("loading");
    useGameSessionStore.setState({
      currentSessionId: activeSessionId,
      inventory: activeInventory,
      inventoryStatus: "ready",
      error: null
    });
    rejectFetch(new Error("旧案移置失败不应显示"));

    await expect(request).rejects.toThrow(/旧案移置失败不应显示/);
    const state = useGameSessionStore.getState();
    expect(state.error).toBeNull();
    expect(state.inventoryStatus).toBe("ready");
    expect(state.inventory).toEqual(activeInventory);
    expect(JSON.stringify(state)).not.toMatch(/旧案移置失败不应显示|旧案清册/);
  });

  it("does not merge stale trade or delegation economy traces into another session", async () => {
    const activeSessionId = "77777777-7777-4777-8777-777777777777";
    const staleSessionId = "88888888-8888-4888-8888-888888888888";
    const activeTrace = {
      traceItems: [{ traceId: "active-trade-trace", title: "当前交易解释" }]
    };
    const staleTrace = {
      traceItems: [{ traceId: "stale-trade-trace", title: "旧案交易解释" }]
    };
    const staleTradePayload: TradeResponse = {
      sessionId: staleSessionId,
      accepted: true,
      tradeRecord: { tradeId: "trade:stale", publicSummary: "旧案交易" },
      tradeLedgerView: { items: [{ tradeId: "trade:stale", publicSummary: "旧案交易" }] },
      resourceLedgerView: { accounts: [{ accountId: "resource:stale", label: "旧案银两", amount: 0 }] },
      inventoryView: {
        containers: [{ containerId: "stale-container", label: "旧案书箧" }],
        items: [{ itemId: "stale-item", name: "旧案清册", containerId: "stale-container" }],
        importantCredentials: []
      },
      economyTraceView: staleTrace
    };
    const staleCommandPayload: NpcCommandResponse = {
      sessionId: staleSessionId,
      accepted: true,
      delegatedTask: { taskId: "delegated-task:stale" },
      delegatedTaskView: { items: [{ taskId: "delegated-task:stale", title: "旧案委派" }] },
      economyTraceView: staleTrace
    };
    installFetchResponses(staleTradePayload, staleCommandPayload);
    useGameSessionStore.setState({
      currentSessionId: activeSessionId,
      currentSession: {
        source: "server_player_visible_state_projection",
        sessionId: activeSessionId,
        worldState: { player: { name: "当前案主", role: "magistrate" } },
        tradeLedgerView: { items: [{ tradeId: "trade:active", publicSummary: "当前交易" }] },
        delegatedTaskView: { items: [{ taskId: "delegated-task:active", title: "当前委派" }] },
        economyTraceView: activeTrace
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"],
      inventory: {
        sessionId: activeSessionId,
        inventoryView: {
          containers: [{ containerId: "active-container", label: "当前书箧" }],
          items: [{ itemId: "active-item", name: "当前清册", containerId: "active-container" }],
          importantCredentials: []
        },
        economyTraceView: activeTrace
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["inventory"],
      npcRoster: {
        sessionId: activeSessionId,
        npcRosterView: { items: [] },
        delegatedTaskView: { items: [{ taskId: "delegated-task:active", title: "当前委派" }] }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["npcRoster"],
      npcDetail: {
        sessionId: activeSessionId,
        npcDetailView: { npcId: "npc:active" },
        tradeLedgerView: { items: [{ tradeId: "trade:active", publicSummary: "当前交易" }] },
        delegatedTaskView: { items: [{ taskId: "delegated-task:active", title: "当前委派" }] }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["npcDetail"],
      npcMutationStatus: "idle"
    });

    await useGameSessionStore.getState().submitTrade(staleSessionId, {
      npcId: "npc:stale",
      tradeId: "trade:stale",
      offerSummary: "旧案交易"
    });
    await useGameSessionStore.getState().submitNpcCommand(staleSessionId, {
      assigneeActorId: "npc:stale",
      taskType: "land_survey",
      authoritySource: "yamen_authority",
      commandText: "旧案委派",
      budget: 12
    });

    const state = useGameSessionStore.getState();
    const serialized = JSON.stringify({
      currentSession: state.currentSession,
      inventory: state.inventory,
      npcRoster: state.npcRoster,
      npcDetail: state.npcDetail,
      lastTrade: state.lastTrade,
      lastNpcCommand: state.lastNpcCommand
    });
    expect(state.currentSession?.economyTraceView).toEqual(activeTrace);
    expect(state.inventory?.economyTraceView).toEqual(activeTrace);
    expect(state.lastTrade).toBeNull();
    expect(state.lastNpcCommand).toBeNull();
    expect(serialized).not.toMatch(/旧案交易解释|旧案委派|旧案清册|stale-trade-trace|trade:stale|delegated-task:stale/);
    expect(state.npcMutationStatus).toBe("ready");
  });

  it("does not patch currentSession when route pointer and session payload diverge", async () => {
    const oldSessionId = "99999999-9999-4999-8999-999999999999";
    const responseSessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const oldCurrentSession = {
      source: "server_player_visible_state_projection",
      sessionId: oldSessionId,
      worldState: { player: { name: "旧案主", role: "official" } },
      tradeLedgerView: { items: [{ tradeId: "trade:old", publicSummary: "旧案交易" }] },
      delegatedTaskView: { items: [{ taskId: "delegated-task:old", title: "旧案委派" }] },
      economyTraceView: {
        traceItems: [{ traceId: "old-trace", title: "旧案经济解释" }]
      }
    } as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"];
    const routeTrace = {
      traceItems: [{ traceId: "route-trace", title: "新路由交易解释" }]
    };
    const tradePayload: TradeResponse = {
      sessionId: responseSessionId,
      accepted: true,
      tradeRecord: { tradeId: "trade:route", publicSummary: "新路由交易" },
      tradeLedgerView: { items: [{ tradeId: "trade:route", publicSummary: "新路由交易" }] },
      resourceLedgerView: { accounts: [{ accountId: "resource:route", label: "新路由银两", amount: 10 }] },
      inventoryView: {
        containers: [{ containerId: "route-container", label: "新路由书箧" }],
        items: [{ itemId: "route-item", name: "新路由清册", containerId: "route-container" }],
        importantCredentials: []
      },
      economyTraceView: routeTrace
    };
    const commandPayload: NpcCommandResponse = {
      sessionId: responseSessionId,
      accepted: true,
      delegatedTask: { taskId: "delegated-task:route" },
      delegatedTaskView: { items: [{ taskId: "delegated-task:route", title: "新路由委派" }] },
      economyTraceView: routeTrace
    };
    installFetchResponses(tradePayload, commandPayload);
    useGameSessionStore.setState({
      currentSessionId: responseSessionId,
      currentSession: oldCurrentSession,
      npcMutationStatus: "idle"
    });

    await useGameSessionStore.getState().submitTrade(responseSessionId, {
      npcId: "npc:route",
      tradeId: "trade:route",
      offerSummary: "新路由交易"
    });
    await useGameSessionStore.getState().submitNpcCommand(responseSessionId, {
      assigneeActorId: "npc:route",
      taskType: "land_survey",
      authoritySource: "yamen_authority",
      commandText: "新路由委派",
      budget: 12
    });

    const state = useGameSessionStore.getState();
    expect(state.currentSession).toEqual(oldCurrentSession);
    expect(JSON.stringify(state.currentSession)).not.toMatch(/新路由交易解释|新路由委派|route-trace|trade:route|delegated-task:route/);
    expect(state.lastTrade?.sessionId).toBe(responseSessionId);
    expect(state.lastNpcCommand?.sessionId).toBe(responseSessionId);
  });

  it("merges NPC interaction memory and archive views into the current session", async () => {
    const currentSession: PlayerStateResponse = {
      ...playerStatePayload,
      npcInteractionView: { items: [] },
      actorMemoryView: { actors: [] },
      eventArchiveView: { items: [] },
      worldEntityView: { highlights: [] },
      worldThreadView: { activeThreads: [] }
    };
    const interactionPayload: NpcInteractionResponse = {
      sessionId: playerStatePayload.sessionId,
      accepted: true,
      npcDialogueView: {
        npcId: "npc:magistrate:bailiff-zhou",
        dialogueText: "周快手抱拳应诺。",
        mood: "谨慎",
        followUpSuggestions: []
      },
      npcInteractionView: {
        items: [{
          recordId: "npc-interaction:1",
          npcId: "npc:magistrate:bailiff-zhou",
          npcName: "周快手",
          actionType: "duel",
          outcomeSummary: "切磋只登记为待复核武艺较量。"
        }]
      },
      actorMemory: {
        appliedCount: 1,
        reinforcedCount: 0,
        rejectedCount: 0,
        rejectedReasons: []
      },
      actorMemoryView: {
        actors: [{
          actorId: "npc:magistrate:bailiff-zhou",
          memories: [{ sourceType: "npc_relationship_action_trace", summary: "周快手记得切磋已由服务器裁决。" }]
        }]
      },
      eventArchiveView: {
        items: [{ sourceType: "actor_memory", summary: "周快手记得切磋已由服务器裁决。" }]
      },
      worldEntityView: {
        highlights: [{ id: "military-wall-beacons", publicSummary: "切磋裁决进入武备声气。" }]
      },
      worldThreadView: {
        activeThreads: [{ sourceType: "npc_relationship_action", sourceLabel: "交游记录" }]
      },
      worldEntityImpacts: [{
        sourceType: "npc_relationship_action",
        entityId: "military-wall-beacons",
        publicNote: "切磋裁决进入武备声气"
      }]
    };
    installFetchResponses(interactionPayload);
    useGameSessionStore.setState({
      currentSession,
      currentSessionId: playerStatePayload.sessionId,
      npcRoster: {
        sessionId: playerStatePayload.sessionId,
        npcRosterView: { items: [] },
        npcInteractionView: { items: [] }
      }
    });

    await useGameSessionStore.getState().interactWithNpc(playerStatePayload.sessionId, {
      npcId: "npc:magistrate:bailiff-zhou",
      actionType: "duel",
      utterance: "只作公事切磋。"
    });

    const state = useGameSessionStore.getState();
    expect(state.lastNpcInteraction?.actorMemory).toMatchObject({ appliedCount: 1 });
    expect(state.currentSession?.actorMemoryView).toEqual(interactionPayload.actorMemoryView);
    expect(state.currentSession?.eventArchiveView).toEqual(interactionPayload.eventArchiveView);
    expect(state.currentSession?.worldEntityView).toEqual(interactionPayload.worldEntityView);
    expect(state.currentSession?.worldThreadView).toEqual(interactionPayload.worldThreadView);
    expect(state.currentSession?.npcInteractionView).toEqual(interactionPayload.npcInteractionView);
    expect(state.npcRoster?.npcInteractionView).toEqual(interactionPayload.npcInteractionView);
    expect(JSON.stringify(state.currentSession)).not.toMatch(/hiddenDossier|providerPayload|rawLedger|OPENAI_API_KEY/);
  });

  it("merges server-blocked NPC relationship payloads while keeping mutation status in error", async () => {
    const currentSession: PlayerStateResponse = {
      ...playerStatePayload,
      npcInteractionView: { items: [] },
      eventArchiveView: { items: [] },
      worldThreadView: { activeThreads: [] }
    };
    const blockedPayload: NpcInteractionResponse = {
      sessionId: playerStatePayload.sessionId,
      accepted: false,
      errors: ["marriage_status_unavailable"],
      npcActionResolutionView: {
        serverStatus: "server_blocked",
        resolverTrace: { status: "server_blocked" }
      },
      npcInteractionView: {
        items: [{
          recordId: "npc-interaction:blocked-marriage",
          npcId: "npc:magistrate:gentry-han",
          npcName: "韩员外",
          actionType: "marriage",
          outcomeSummary: "服务器挡下此项议婚。"
        }]
      },
      eventArchiveView: {
        items: [{ sourceType: "npc_relationship_action", summary: "服务器挡下此项议婚。" }]
      },
      worldThreadView: {
        activeThreads: [{ sourceType: "npc_relationship_action", sourceLabel: "交游记录", status: "watch" }]
      }
    };
    installFetchResponses(blockedPayload);
    useGameSessionStore.setState({
      currentSession,
      currentSessionId: playerStatePayload.sessionId,
      npcRoster: {
        sessionId: playerStatePayload.sessionId,
        npcRosterView: { items: [] },
        npcInteractionView: { items: [] }
      }
    });

    const result = await useGameSessionStore.getState().interactWithNpc(playerStatePayload.sessionId, {
      npcId: "npc:magistrate:gentry-han",
      actionType: "marriage",
      utterance: "以婚姻相结。"
    });

    const state = useGameSessionStore.getState();
    expect(result.accepted).toBe(false);
    expect(state.npcMutationStatus).toBe("error");
    expect(state.error).toBeNull();
    expect(state.lastNpcInteraction).toEqual(blockedPayload);
    expect(state.currentSession?.worldThreadView).toEqual(blockedPayload.worldThreadView);
    expect(state.currentSession?.eventArchiveView).toEqual(blockedPayload.eventArchiveView);
    expect(state.currentSession?.npcInteractionView).toEqual(blockedPayload.npcInteractionView);
    expect(JSON.stringify(state.currentSession)).not.toMatch(/hiddenDossier|providerPayload|rawLedger|OPENAI_API_KEY/);
  });

  it("does not merge stale NPC interaction payloads into another session", async () => {
    const activeSessionId = "55555555-5555-4555-8555-555555555555";
    const activeSession: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: activeSessionId,
      actorMemoryView: { actors: [{ actorId: "npc:active", memories: [] }] },
      eventArchiveView: { items: [{ sourceType: "active_session" }] },
      worldEntityView: { highlights: [{ id: "active-entity" }] },
      worldThreadView: { activeThreads: [{ sourceType: "active_session" }] },
      npcInteractionView: { items: [{ recordId: "active-record" }] }
    };
    const stalePayload: NpcInteractionResponse = {
      sessionId: playerStatePayload.sessionId,
      accepted: true,
      npcInteractionView: { items: [{ recordId: "stale-record" }] },
      actorMemory: { appliedCount: 1 },
      actorMemoryView: { actors: [{ actorId: "npc:stale", memories: [] }] },
      eventArchiveView: { items: [{ sourceType: "stale_session" }] },
      worldEntityView: { highlights: [{ id: "stale-entity" }] },
      worldThreadView: { activeThreads: [{ sourceType: "stale_session" }] },
      worldEntityImpacts: [{ sourceType: "npc_relationship_action", entityId: "stale-entity" }],
      npcDetailView: {
        npcId: "npc:stale",
        displayName: "旧案 NPC"
      }
    };
    installFetchResponses(stalePayload);
    useGameSessionStore.setState({
      currentSession: activeSession,
      currentSessionId: activeSessionId,
      lastNpcInteraction: null,
      npcMutationStatus: "ready",
      npcRoster: {
        sessionId: activeSessionId,
        npcRosterView: { items: [] },
        npcInteractionView: { items: [{ recordId: "active-roster-record" }] }
      },
      npcDetail: {
        sessionId: activeSessionId,
        npcDetailView: { npcId: "npc:active", displayName: "当前 NPC" },
        npcInteractionView: { items: [{ recordId: "active-detail-record" }] }
      }
    });

    await useGameSessionStore.getState().interactWithNpc(playerStatePayload.sessionId, {
      npcId: "npc:stale",
      actionType: "duel",
      utterance: "旧案返回。"
    });

    const state = useGameSessionStore.getState();
    expect(state.lastNpcInteraction).toBeNull();
    expect(state.npcMutationStatus).toBe("ready");
    expect(state.currentSession?.actorMemoryView).toEqual(activeSession.actorMemoryView);
    expect(state.currentSession?.eventArchiveView).toEqual(activeSession.eventArchiveView);
    expect(state.currentSession?.worldEntityView).toEqual(activeSession.worldEntityView);
    expect(state.currentSession?.worldThreadView).toEqual(activeSession.worldThreadView);
    expect(state.currentSession?.npcInteractionView).toEqual(activeSession.npcInteractionView);
    expect(state.npcRoster?.npcInteractionView?.items?.[0]?.recordId).toBe("active-roster-record");
    expect(state.npcDetail?.npcDetailView.npcId).toBe("npc:active");
    expect(state.npcDetail?.npcInteractionView?.items?.[0]?.recordId).toBe("active-detail-record");
  });

  it("resets NPC mutation loading when loading another roster and ignores stale mutation failures", async () => {
    const activeSessionId = "55555555-5555-4555-8555-555555555555";
    const staleSessionId = "66666666-6666-4666-8666-666666666666";
    const activeSession: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: activeSessionId,
      worldState: { player: { name: "当前案主", role: "magistrate" } },
      npcInteractionView: { items: [{ recordId: "active-record" }] }
    };
    const staleSession: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: staleSessionId,
      worldState: { player: { name: "旧案主", role: "magistrate" } },
      npcInteractionView: { items: [{ recordId: "stale-record" }] }
    };
    const activeRoster: NpcListResponse = {
      sessionId: activeSessionId,
      npcRosterView: {
        items: [{ npcId: "npc:active", displayName: "当前 NPC" }]
      },
      npcInteractionView: { items: [{ recordId: "active-roster-record" }] }
    };
    installFetchResponses(activeRoster);
    useGameSessionStore.setState({
      currentSessionId: staleSessionId,
      currentSession: staleSession,
      npcMutationStatus: "loading",
      error: "旧案人物请求仍在进行"
    });

    await useGameSessionStore.getState().loadNpcs(activeSessionId);

    expect(useGameSessionStore.getState()).toMatchObject({
      currentSessionId: activeSessionId,
      npcRoster: activeRoster,
      npcRosterStatus: "ready",
      npcMutationStatus: "idle",
      error: null
    });

    async function expectStaleNpcMutationFailureIsIgnored(
      runMutation: () => Promise<NpcInteractionResponse | TradeResponse | NpcCommandResponse>
    ) {
      let rejectFetch!: (error: Error) => void;
      const response = new Promise<Response>((_resolve, reject) => {
        rejectFetch = reject;
      });
      vi.stubGlobal("fetch", vi.fn(() => response));
      useGameSessionStore.setState({
        currentSessionId: staleSessionId,
        currentSession: staleSession,
        lastNpcInteraction: null,
        lastTrade: null,
        lastNpcCommand: null,
        npcMutationStatus: "ready",
        error: null
      });

      const request = runMutation();
      expect(useGameSessionStore.getState().npcMutationStatus).toBe("loading");
      useGameSessionStore.setState({
        currentSessionId: activeSessionId,
        currentSession: activeSession,
        lastNpcInteraction: null,
        lastTrade: null,
        lastNpcCommand: null,
        npcMutationStatus: "ready",
        error: null
      });
      rejectFetch(new Error("旧案人物请求失败不应显示"));

      await expect(request).rejects.toThrow(/旧案人物请求失败不应显示/);
      const state = useGameSessionStore.getState();
      expect(state.error).toBeNull();
      expect(state.npcMutationStatus).toBe("ready");
      expect(state.currentSession).toEqual(activeSession);
      expect(state.lastNpcInteraction).toBeNull();
      expect(state.lastTrade).toBeNull();
      expect(state.lastNpcCommand).toBeNull();
      expect(JSON.stringify(state)).not.toMatch(/旧案人物请求失败不应显示|旧案主|stale-record/);
    }

    await expectStaleNpcMutationFailureIsIgnored(() => useGameSessionStore.getState().interactWithNpc(staleSessionId, {
      npcId: "npc:stale",
      actionType: "talk",
      utterance: "旧案对话。"
    }));
    await expectStaleNpcMutationFailureIsIgnored(() => useGameSessionStore.getState().submitTrade(staleSessionId, {
      npcId: "npc:stale",
      tradeId: "trade:stale",
      offerSummary: "旧案交易"
    }));
    await expectStaleNpcMutationFailureIsIgnored(() => useGameSessionStore.getState().submitNpcCommand(staleSessionId, {
      assigneeActorId: "npc:stale",
      taskType: "land_survey",
      authoritySource: "yamen_authority",
      commandText: "旧案委派",
      budget: 12
    }));
  });
});
