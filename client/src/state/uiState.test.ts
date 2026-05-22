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
import type { ExamSubmitResponse, NpcCommandResponse, NpcInteractionResponse, PlayerStateResponse, StartGameResponse, TradeResponse, TurnResponse } from "../api";

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
    installFetchResponses(startPayload, playerStatePayload, turnPayload, examSubmitPayload);

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

    await useGameSessionStore.getState().submitExam(examSubmitPayload.sessionId, examSubmitPayload.examId, "臣闻治世之要。");
    expect(useUiStateStore.getState().currentPlayerPayload).toMatchObject({
      sessionId: examSubmitPayload.sessionId,
      source: "exam-submit",
      player: { examRank: "秀才" }
    });
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
      eventArchiveView: { items: [] }
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
      }
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
    expect(state.currentSession?.npcInteractionView).toEqual(interactionPayload.npcInteractionView);
    expect(state.npcRoster?.npcInteractionView).toEqual(interactionPayload.npcInteractionView);
    expect(JSON.stringify(state.currentSession)).not.toMatch(/hiddenDossier|providerPayload|rawLedger|OPENAI_API_KEY/);
  });

  it("does not merge stale NPC interaction payloads into another session", async () => {
    const activeSessionId = "55555555-5555-4555-8555-555555555555";
    const activeSession: PlayerStateResponse = {
      ...playerStatePayload,
      sessionId: activeSessionId,
      actorMemoryView: { actors: [{ actorId: "npc:active", memories: [] }] },
      eventArchiveView: { items: [{ sourceType: "active_session" }] },
      npcInteractionView: { items: [{ recordId: "active-record" }] }
    };
    const stalePayload: NpcInteractionResponse = {
      sessionId: playerStatePayload.sessionId,
      accepted: true,
      npcInteractionView: { items: [{ recordId: "stale-record" }] },
      actorMemory: { appliedCount: 1 },
      actorMemoryView: { actors: [{ actorId: "npc:stale", memories: [] }] },
      eventArchiveView: { items: [{ sourceType: "stale_session" }] },
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
    expect(state.currentSession?.npcInteractionView).toEqual(activeSession.npcInteractionView);
    expect(state.npcRoster?.npcInteractionView?.items?.[0]?.recordId).toBe("active-roster-record");
    expect(state.npcDetail?.npcDetailView.npcId).toBe("npc:active");
    expect(state.npcDetail?.npcInteractionView?.items?.[0]?.recordId).toBe("active-detail-record");
  });
});
