import { afterEach, describe, expect, it, vi } from "vitest";
import { extractSafePlayerPayload, useUiStateStore } from "./uiState";
import { useGameSessionStore } from "./gameSessionState";
import type { ExamSubmitResponse, PlayerStateResponse, StartGameResponse, TurnResponse } from "../api";

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

afterEach(() => {
  useUiStateStore.getState().resetUiState();
  useGameSessionStore.setState({
    activeExam: null,
    aiConnection: null,
    aiSettings: null,
    currentSession: null,
    currentSessionId: null,
    error: null,
    lastExamResult: null,
    lastTurn: null,
    saves: [],
    savesStatus: "idle",
    settingsStatus: "idle",
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
    expect(state.activeInkboxTab).toBe("ai-settings");
    expect(state.actionDraft).toBeNull();
    expect(state.displayPreferences).toEqual({
      motion: "full",
      textSize: "standard",
      contrast: "standard",
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

    store.setActionDraft({ text: "拜访座师，请教经义。", targetPage: "game" });
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "manual",
      text: "拜访座师，请教经义。",
      targetPage: "game"
    });
    store.clearActionDraft();
    expect(useUiStateStore.getState().actionDraft).toBeNull();
  });

  it("updates display preferences without adding session payload fields", () => {
    const store = useUiStateStore.getState();

    store.setDisplayPreference("motion", "reduced");
    store.setDisplayPreference("textSize", "large");
    store.setDisplayPreference("contrast", "high");
    store.setDisplayPreference("autoScroll", false);
    store.setDisplayPreference("mapMotion", false);

    expect(useUiStateStore.getState().displayPreferences).toEqual({
      motion: "reduced",
      textSize: "large",
      contrast: "high",
      autoScroll: false,
      mapMotion: false
    });
    expect(JSON.stringify(useUiStateStore.getState().displayPreferences)).not.toMatch(/sessionId|worldState|provider|prompt|key/i);
  });

  it("extracts only the player-facing payload summary", () => {
    const safePayload = extractSafePlayerPayload(startPayload);

    expect(safePayload).toEqual({
      sessionId: startPayload.sessionId,
      source: "start",
      player: {
        name: "沈知微",
        role: "scholar",
        examRank: "童生",
        officeTitle: undefined
      },
      narrativePreview: "沈知微开卷入世。",
      routeViews: {
        hasAiSettingsView: false,
        hasAuditSummaryView: false,
        hasEventArchiveView: false,
        hasExamCalendarView: false,
        hasInformationPanelView: false,
        hasMapRuntimeView: true
      }
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
});
