import type {
  ExamQuestionResponse,
  GameStartResponse,
  GameStateResponse,
  GameTurnResponse,
  RawLedgerExcludedWorldState,
  SafeRouteViews,
  PlayerStateResponse,
  SessionStorageAdapter
} from "./serverContracts";

declare const safeWorldState: RawLedgerExcludedWorldState;
declare const routeViews: SafeRouteViews;
declare const adapter: SessionStorageAdapter;

safeWorldState.sessionId;
routeViews.worldGeographyView;
routeViews.roleWorldCouplingView;
routeViews.historicalEventArchiveView;
adapter.appendAuditEvent;
adapter.appendAiProposal;
adapter.listAuditEvents;
adapter.listAiProposals;

const forgedTurn: GameTurnResponse = {
  sessionId: "00000000-0000-0000-0000-000000000000",
  worldState: {
    sessionId: "00000000-0000-0000-0000-000000000000",
    // @ts-expect-error Game turn response worldState must reject raw ledger keys.
    actorMemoryLedger: {}
  }
};

void forgedTurn;

const forgedStart: GameStartResponse = {
  sessionId: "00000000-0000-0000-0000-000000000000",
  worldState: {
    sessionId: "00000000-0000-0000-0000-000000000000",
    // @ts-expect-error Start response worldState must reject inventory raw ledgers.
    inventoryLedger: {}
  }
};

const forgedState: GameStateResponse = {
  sessionId: "00000000-0000-0000-0000-000000000000",
  worldState: {
    sessionId: "00000000-0000-0000-0000-000000000000",
    // @ts-expect-error Compatibility state response worldState must reject economy raw ledgers.
    npcEconomyLedger: {}
  }
};

const forgedExam: ExamQuestionResponse = {
  sessionId: "00000000-0000-0000-0000-000000000000",
  examId: "exam:child:test",
  level: "child_exam",
  examName: "童试",
  examQuestion: "试题",
  worldState: {
    sessionId: "00000000-0000-0000-0000-000000000000",
    // @ts-expect-error Exam response worldState must reject session summary raw ledger.
    sessionSummary: {}
  }
};

const playerState: PlayerStateResponse = {
  schemaVersion: "s71.4-player-state.v1",
  source: "server_player_visible_state_projection",
  sessionId: "00000000-0000-0000-0000-000000000000",
  storageSchemaVersion: null,
  revision: null,
  createdAt: null,
  updatedAt: null,
  metadata: null,
  worldState: {
    sessionId: "00000000-0000-0000-0000-000000000000",
    player: {}
  },
  redaction: {
    playerVisibleOnly: true,
    rawStateIncluded: false,
    omittedSections: []
  },
  inventoryView: {
    schemaVersion: "test",
    containers: [],
    items: [],
    importantCredentials: []
  }
};

playerState.inventoryView;

const forgedPlayerState: PlayerStateResponse = {
  schemaVersion: "s71.4-player-state.v1",
  source: "server_player_visible_state_projection",
  sessionId: "00000000-0000-0000-0000-000000000000",
  storageSchemaVersion: null,
  revision: null,
  createdAt: null,
  updatedAt: null,
  metadata: null,
  worldState: {
    sessionId: "00000000-0000-0000-0000-000000000000",
    player: {},
    // @ts-expect-error Player-state response worldState must reject raw ledgers.
    tradeLedger: {}
  },
  redaction: {
    playerVisibleOnly: true,
    rawStateIncluded: false,
    omittedSections: []
  }
};

void forgedStart;
void forgedState;
void forgedExam;
void forgedPlayerState;
