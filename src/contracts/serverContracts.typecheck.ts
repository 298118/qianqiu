import type {
  AiConnectionTestResponse,
  AiRemoteTaskEnvelope,
  ExamQuestionResponse,
  GameStartResponse,
  GameStateResponse,
  GameTurnResponse,
  RawLedgerExcludedWorldState,
  SafeRouteViews,
  PlayerStateResponse,
  SessionStorageAdapter,
  SqlitePromptRetrievalRepairStatus,
  SqlitePromptRetrievalRow,
  SqliteSafeDiagnostics,
  SqliteSafeSearchIndexRow,
  SqliteSafeSearchRepairStatus,
  SqliteWorldSessionRow
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

const remoteTask: AiRemoteTaskEnvelope = {
  schemaName: "turn",
  schema: { type: "object" },
  instructions: "内部 system prompt 只能交给 provider requester。",
  input: "内部 user prompt 只能交给 provider requester。",
  maxOutputTokens: 800
};

remoteTask.instructions;

const aiConnection: AiConnectionTestResponse = {
  ok: true,
  provider: "mock",
  configuredProvider: "mock",
  models: { default: "mock" },
  openingEventCount: 1,
  narrativePreview: "连接正常。"
};

aiConnection.provider;

const forgedAiConnectionRawPayload: AiConnectionTestResponse = {
  ok: false,
  provider: "openai",
  // @ts-expect-error Public AI connection response must not expose raw provider payloads.
  rawProviderPayload: { response: "raw" }
};

const forgedAiConnectionPrompt: AiConnectionTestResponse = {
  ok: false,
  provider: "deepseek",
  // @ts-expect-error Public AI connection response must not expose prompt text.
  prompt: "full prompt"
};

const forgedAiConnectionStatePatch: AiConnectionTestResponse = {
  ok: false,
  provider: "mimo",
  // @ts-expect-error Public AI connection response must not expose provider state patches.
  statePatch: { player: { gold: 999 } }
};

void forgedAiConnectionRawPayload;
void forgedAiConnectionPrompt;
void forgedAiConnectionStatePatch;

const sqliteSessionRow: SqliteWorldSessionRow = {
  session_id: "00000000-0000-0000-0000-000000000000",
  storage_schema_version: 1,
  revision: 1,
  created_at: "2026-05-20T00:00:00.000Z",
  updated_at: "2026-05-20T00:00:00.000Z",
  player_name: "士子",
  role: "scholar",
  role_label: "书生",
  dynasty: "明",
  year: 1644,
  month: 1,
  ten_day_period: 1,
  turn_count: 0,
  exam_rank: null,
  palace_rank: null,
  office_title: null,
  summary: "案卷摘要",
  metadata_json: "{}",
  world_state_json: "{}"
};

sqliteSessionRow.world_state_json;

const forgedSqliteSessionRow: SqliteWorldSessionRow = {
  ...sqliteSessionRow,
  // @ts-expect-error SQLite world session row schema version is numeric, not raw text.
  storage_schema_version: "s88"
};

const promptRetrievalRow: SqlitePromptRetrievalRow = {
  session_id: sqliteSessionRow.session_id,
  row_id: "people.npcs:npc-visible",
  domain_schema_version: 1,
  revision: 1,
  row_revision: 1,
  source: "server_visible_prompt_projection",
  source_view: "worldPeopleView",
  domain: "people",
  collection: "npcs",
  visibility: "public",
  sort_priority: 1,
  payload_json: "{}",
  search_text: "顾衡",
  metadata_json: "{}",
  created_at: sqliteSessionRow.created_at,
  updated_at: sqliteSessionRow.updated_at
};

const forgedPromptRetrievalRow: SqlitePromptRetrievalRow = {
  ...promptRetrievalRow,
  // @ts-expect-error S88.2 prompt retrieval rows use numeric domain schema versions.
  domain_schema_version: "1"
};

const safeSearchRow: SqliteSafeSearchIndexRow = {
  session_id: sqliteSessionRow.session_id,
  row_id: "people:npc-visible",
  safe_search_schema_version: 1,
  revision: 1,
  row_revision: 1,
  source: "server_visible_safe_search_projection",
  source_view: "worldPeopleView",
  domain: "people",
  source_id: "npc-visible",
  title: "顾衡",
  summary: "公开人物摘要",
  confidence: 80,
  visibility: "public",
  related_refs_json: "[]",
  route_view_ref_json: "{}",
  search_text: "顾衡 公开人物摘要",
  metadata_json: "{}",
  created_at: sqliteSessionRow.created_at,
  updated_at: sqliteSessionRow.updated_at
};

const forgedSafeSearchRow: SqliteSafeSearchIndexRow = {
  ...safeSearchRow,
  // @ts-expect-error Safe search derived rows must not carry raw world_state_json.
  world_state_json: "{}"
};

const forgedSafeSearchSource: SqliteSafeSearchIndexRow = {
  ...safeSearchRow,
  // @ts-expect-error Safe search source literal must match the server visible projection.
  source: "server_safe_world_search_projection"
};

const promptRepairStatus: SqlitePromptRetrievalRepairStatus = {
  contentMismatches: false,
  count: 1,
  expectedCount: 1,
  missingOrMismatched: false,
  mismatchedRowIds: false,
  needsRepair: false,
  staleRows: false,
  tableNeedsRepair: false
};

const safeSearchRepairStatus: SqliteSafeSearchRepairStatus = {
  ...promptRepairStatus,
  ftsAvailable: true,
  ftsMismatches: false
};

const sqliteSafeDiagnostics: SqliteSafeDiagnostics = {
  command: "export-safe",
  generatedAt: "2026-05-20T00:00:00.000Z",
  status: {
    databasePathRedacted: true,
    journalMode: "wal",
    size: {},
    counts: {},
    migrations: {}
  },
  indexHealth: {
    ok: true,
    checkedTables: 1,
    checkedIndexes: 1,
    missingTables: [],
    missingIndexes: [],
    presentTableCount: 1,
    presentIndexCount: 1
  },
  derivedTableDrift: {
    checked: 1,
    missingWorldSessionsTable: false,
    needsRepair: false,
    sessions: [{
      sessionId: sqliteSessionRow.session_id,
      revision: 1,
      domains: {
        promptRetrieval: promptRepairStatus,
        safeSearch: safeSearchRepairStatus
      },
      needsRepair: false
    }],
    skipped: []
  }
};

void forgedSqliteSessionRow;
void forgedPromptRetrievalRow;
void forgedSafeSearchRow;
void forgedSafeSearchSource;
void promptRepairStatus;
void safeSearchRepairStatus;
void sqliteSafeDiagnostics;
