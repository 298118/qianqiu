const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { isBuiltin } = require("node:module");

const { assemblePromptContext } = require("../src/ai/promptContextAssembler");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const { buildInformationPanelPageViews } = require("../src/game/informationPanelPage");
const { createInitialState } = require("../src/game/initialState");
const {
  buildAiInvocationSummaryView,
  recordAiInvocation,
  redactAiSettingsForClient,
  resolveAiSettingsForSession
} = require("../src/game/aiSettings");
const {
  applyTurnActorMemoryUpdates,
  buildActorMemoryView
} = require("../src/game/actorMemoryLedger");
const { buildMapContextView } = require("../src/game/mapContext");
const { buildOfficialPostingsView } = require("../src/game/officialPostings");
const {
  buildPlayerMonthlyBriefingView,
  runPlayerMonthlyBriefingStep
} = require("../src/game/playerMonthlyBriefing");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  buildSessionSummaryView,
  updateMonthlySessionSummary
} = require("../src/game/sessionSummary");
const { applyStatePatch } = require("../src/game/stateRules");
const {
  buildTimeSkipPlan,
  buildTimeSkipSummary
} = require("../src/game/timeSkip");
const { runWorldTick } = require("../src/game/worldTick");
const { buildWorldGeographyView } = require("../src/game/worldGeography");
const {
  WORLD_CONTENT_BROWSER_PAGE,
  WORLD_CONTENT_FIXTURE_TARGETS,
  WORLD_CONTENT_PROMPT_BUDGET,
  buildWorldContentFixturePage,
  buildWorldContentPerformanceBaseline,
  buildPromptBudgetReport,
  createFixtureSessionRecord,
  createWorldContentFixture,
  flattenCanaries
} = require("../src/game/worldContentFixtures");
const { buildWorldPeopleView } = require("../src/game/worldPeople");
const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");
const { buildPromptRetrievalRows } = require("../src/storage/sqlitePromptRetrievalTables");
const { runAuditEventArchiveTool } = require("./auditEventArchiveTool");
const { runImportJsonSessionsToSqlite } = require("./importJsonSessionsToSqlite");
const { runSqliteGeographyTool } = require("./sqliteGeographyTool");

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const sessionsDir = path.join(dataDir, "sessions");
const auditDir = path.join(dataDir, "audit");

const BLOCKED_TOKENS = Object.freeze([
  "SEALED_S59_",
  "hiddenNotes",
  "hiddenIntent",
  "provider proposal",
  "statePatch",
  "world_state_json",
  "event_log",
  "ai_change_proposals",
  "prompt_retrieval_index",
  "event_archive_index",
  "S60_PRIVATE_",
  "SQLITE_DATABASE_PATH",
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "MIMO_API_KEY",
  "ANTHROPIC_API_KEY",
  "sk-proj-s59",
  "sk-s60-private-canary-token",
  "data_sessions_secret",
  "E:\\LSMNQ"
]);

const S67_SCALE_ACCEPTANCE_THRESHOLDS = Object.freeze({
  // Full-suite concurrency on Windows can push large fixture generation beyond
  // the original standalone S67 target while quantity, cap and leak gates still
  // catch behavioral regressions.
  fixtureGenerationMs: 10000,
  eventArchivePaginationMs: 1500,
  promptAssemblyMs: 2500,
  promptRetrievalRowsMs: 2500,
  fixturePageMs: 1000,
  // Full `npm test` runs this large fixture beside many SQLite-heavy tests;
  // keep the information-panel projection guarded while allowing concurrent
  // Windows test noise above the standalone smoke baseline.
  informationPanelMs: 3000,
  // S71 adds safe-search and migration/maintenance drift probes to the same
  // SQLite read-repair surface; full-suite Windows node:sqlite runs have
  // reached about 9.6s while still passing all row-count, parity and leak
  // gates, so keep a guard without treating normal derived-index repair as a
  // regression.
  sqliteReadRepairMs: 12000,
  heapDeltaBytes: 256 * 1024 * 1024
});

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    browserPath: null,
    headed: false,
    help: false,
    screenshotsDir: null,
    skipBrowser: false,
    sqliteDatabasePath: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--browser") {
      options.browserPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--headed") {
      options.headed = true;
    } else if (arg === "--screenshots") {
      options.screenshotsDir = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--skip-browser" || arg === "--storage-only") {
      options.skipBrowser = true;
    } else if (arg === "--sqlite-db" || arg === "--sqlite-database" || arg === "--db") {
      options.sqliteDatabasePath = readArgValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown dual-mode acceptance argument: ${arg}`);
    }
  }

  return options;
}

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printHelp(io = console) {
  io.log(`
Usage: node scripts/dualModeAcceptance.js [options]

Runs the JSON/SQLite dual-mode acceptance:
  1. Full Mock browser journey in JSON mode.
  2. Full Mock browser journey in SQLite mode.
  3. Focused JSON/SQLite information-panel parity smoke.
  4. Storage maintenance acceptance for JSON -> SQLite import, geography repair/export,
     audit public projection, derived table counts, and hidden-token checks.
  5. S70 AI-first route-view parity for AI settings, monthly briefing, time skip,
     actor memory, session summary, and map context.
  6. S67.1 scale regression for large fixture counts, prompt strategy, information panel
     paging, event archive pagination, SQLite prompt-index read repair, memory, and timing.

Options:
  --storage-only       Skip browser journeys and run only storage/tooling/S70 parity/scale acceptance.
  --sqlite-db <path>   SQLite database path. Defaults to a temporary data/s67-*.sqlite file.
  --browser <path>     Browser executable path for browser smoke.
  --screenshots <dir>  Save browser acceptance screenshots.
  --headed             Show browser windows while running.
  --help               Show this message.
`.trim());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveSqlitePlan(sqliteDatabasePath) {
  const ownsDatabase = !sqliteDatabasePath;
  const selected = sqliteDatabasePath || path.join(dataDir, `s67-dual-mode-${randomUUID()}.sqlite`);
  return {
    ownsDatabase,
    sqliteDatabasePath: selected === ":memory:" ? selected : path.resolve(selected)
  };
}

async function removeSqliteArtifacts(dbPath) {
  if (!dbPath || dbPath === ":memory:") return;
  await Promise.all(
    [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
}

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

function withSqliteDatabase(dbPath, task) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    return task(db);
  } finally {
    db.close();
  }
}

function tableCount(db, tableName, sessionId) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  if (!table) return 0;
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ?`).get(sessionId).count;
}

function readDerivedTableCounts(dbPath, sessionId) {
  return withSqliteDatabase(dbPath, (db) => ({
    worldSessions: tableCount(db, "world_sessions", sessionId),
    geography: {
      countries: tableCount(db, "geo_countries", sessionId),
      regions: tableCount(db, "geo_regions", sessionId),
      cities: tableCount(db, "geo_cities", sessionId),
      routes: tableCount(db, "geo_routes", sessionId),
      frontierZones: tableCount(db, "geo_frontier_zones", sessionId),
      officeJurisdictions: tableCount(db, "geo_office_jurisdictions", sessionId)
    },
    people: {
      npcs: tableCount(db, "people_npcs", sessionId),
      households: tableCount(db, "people_households", sessionId),
      assets: tableCount(db, "people_assets", sessionId),
      estates: tableCount(db, "people_estates", sessionId),
      relationships: tableCount(db, "people_relationships", sessionId)
    },
    offices: {
      bureaus: tableCount(db, "office_bureaus", sessionId),
      officeCatalog: tableCount(db, "office_catalog", sessionId),
      cityJurisdictions: tableCount(db, "office_city_jurisdictions", sessionId),
      postings: tableCount(db, "office_postings", sessionId),
      assessments: tableCount(db, "office_assessments", sessionId),
      transfers: tableCount(db, "office_transfers", sessionId)
    },
    eventArchiveIndex: tableCount(db, "event_archive_index", sessionId),
    promptRetrievalIndex: tableCount(db, "prompt_retrieval_index", sessionId),
    auditEvents: tableCount(db, "event_log", sessionId),
    aiProposals: tableCount(db, "ai_change_proposals", sessionId)
  }));
}

function countSum(values = {}) {
  return Object.values(values).reduce((total, value) => total + Number(value || 0), 0);
}

function assertDerivedCounts(counts = {}) {
  const failures = [];
  if (counts.worldSessions !== 1) failures.push("world_sessions did not contain the imported session.");
  if (countSum(counts.geography) <= 0) failures.push("geo_* derived rows were not synced.");
  if (countSum(counts.people) <= 0) failures.push("people_* derived rows were not synced.");
  if (countSum(counts.offices) <= 0) failures.push("office_* derived rows were not synced.");
  if (counts.eventArchiveIndex <= 0) failures.push("event_archive_index rows were not synced.");
  if (counts.promptRetrievalIndex <= 0) failures.push("prompt_retrieval_index rows were not synced.");
  if (counts.auditEvents <= 0) failures.push("SQLite event_log rows were not written.");
  if (counts.aiProposals <= 0) failures.push("SQLite ai_change_proposals rows were not written.");
  if (failures.length) throw new Error(failures.join(" "));
}

function assertNoBlockedTokens(label, value, blockedTokens = BLOCKED_TOKENS) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const leaked = blockedTokens.filter((token) => token && serialized.includes(token));
  if (leaked.length) {
    throw new Error(`${label} leaked hidden tokens: ${leaked.join(", ")}`);
  }
}

function nowMs() {
  return globalThis.performance && typeof globalThis.performance.now === "function"
    ? globalThis.performance.now()
    : Date.now();
}

function measureSync(task) {
  const startedAt = nowMs();
  const value = task();
  return {
    value,
    durationMs: Number((nowMs() - startedAt).toFixed(3))
  };
}

async function measureAsync(task) {
  const startedAt = nowMs();
  const value = await task();
  return {
    value,
    durationMs: Number((nowMs() - startedAt).toFixed(3))
  };
}

function assertFiniteMetric(label, value, maxValue) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} was not a finite non-negative metric.`);
  }
  if (Number.isFinite(maxValue) && value > maxValue) {
    throw new Error(`${label} exceeded S67.1 threshold: ${value} > ${maxValue}`);
  }
}

function assertS67PerformanceThresholds(metrics = {}, thresholds = S67_SCALE_ACCEPTANCE_THRESHOLDS) {
  for (const [key, threshold] of Object.entries(thresholds)) {
    if (metrics[key] === undefined) continue;
    assertFiniteMetric(`S67.1 ${key}`, metrics[key], threshold);
  }
}

function assertLargeFixtureMetrics(metrics = {}) {
  const target = WORLD_CONTENT_FIXTURE_TARGETS.large;
  const checks = [
    ["countries", target.countries],
    ["cities", target.cities],
    ["npcs", target.npcs],
    ["households", target.households],
    ["relationships", target.relationships],
    ["officialCatalogRows", target.officialCatalogRows],
    ["postings", target.postings],
    ["eventIntelItems", target.eventIntelItems],
    ["promptRetrievalRows", target.promptRetrievalRows],
    ["hiddenCanaries", target.hiddenCanaries]
  ];
  const failures = checks
    .filter(([key, expected]) => Number(metrics[key] || 0) < expected)
    .map(([key, expected]) => `${key}=${metrics[key] || 0} < ${expected}`);
  if (failures.length) throw new Error(`S67.1 large fixture gates failed: ${failures.join("; ")}`);
}

function summarizePromptStrategy(report = {}) {
  const strategy = report.promptContext?.retrievalContext?.strategy || {};
  return {
    profile: strategy.profile,
    maxRows: strategy.maxRows,
    maxChars: strategy.maxChars,
    selectedRows: strategy.selectedRows,
    serializedChars: strategy.serializedChars,
    globalTrimmedRows: strategy.globalTrimmedRows,
    charBudgetTrimmedRows: strategy.charBudgetTrimmedRows,
    domainSelectedRows: strategy.domainSelectedRows,
    candidateRows: strategy.candidateRows,
    droppedRows: strategy.droppedRows,
    totalCandidateRows: strategy.pagination?.totalCandidateRows,
    totalDroppedRows: strategy.pagination?.droppedRows
  };
}

function assertPromptStrategy(label, report = {}, expectedProfile, maxRows, maxChars) {
  const strategy = report.promptContext?.retrievalContext?.strategy;
  if (!strategy) throw new Error(`${label} did not include retrievalContext.strategy.`);
  if (strategy.profile !== expectedProfile) {
    throw new Error(`${label} used profile ${strategy.profile}, expected ${expectedProfile}.`);
  }
  if (strategy.selectedRows > maxRows || report.summaryRows > maxRows) {
    throw new Error(`${label} selected too many prompt retrieval rows.`);
  }
  if (strategy.serializedChars > maxChars || report.serializedChars > maxChars) {
    throw new Error(`${label} exceeded prompt retrieval character budget.`);
  }
  if (Number(strategy.pagination?.totalCandidateRows || 0) < Number(strategy.selectedRows || 0)) {
    throw new Error(`${label} candidate row accounting is inconsistent.`);
  }
  if (!strategy.domainSelectedRows || typeof strategy.domainSelectedRows !== "object") {
    throw new Error(`${label} did not report domain selected row counts.`);
  }
}

function assertInformationPanelScale(panel = {}) {
  const active = panel.activePage || {};
  if (panel.schemaVersion !== 1 || panel.pages?.length !== 5) {
    throw new Error("S67.1 information panel did not return the expected page collection.");
  }
  if (active.source !== "route_view_projection") {
    throw new Error("S67.1 information panel did not use route view projection.");
  }
  if (active.pagination?.pageSize > 24 || active.items?.length > active.pagination?.pageSize) {
    throw new Error("S67.1 information panel pagination exceeded the route page cap.");
  }
  assertNoBlockedTokens("S67.1 information panel", panel);
}

function assertFixturePageSafety(label, page = {}) {
  if (!Array.isArray(page.items)) throw new Error(`${label} did not return paged items.`);
  if (page.pagination?.pageSize > WORLD_CONTENT_BROWSER_PAGE.maxPageSize) {
    throw new Error(`${label} exceeded the fixture page-size cap.`);
  }
  assertNoBlockedTokens(label, page);
}

function buildS59WorldState() {
  const worldState = createInitialState({
    dynasty: "明",
    role: "official",
    playerName: "S59双模验收",
    year: 1644
  });
  Object.assign(worldState, {
    month: 8,
    tenDayPeriod: 2,
    turnCount: 18,
    borderThreat: 62,
    corruption: 58,
    grainReserve: 760,
    publicOrder: 73
  });
  Object.assign(worldState.player, {
    examRank: "进士",
    officeTitle: "户部主事",
    palaceRank: "二甲第七名",
    position: "户部主事",
    role: "official",
    roleLabel: "入仕官员"
  });
  Object.assign(worldState.officialCareer, {
    bureauId: "ministry_revenue",
    currentPosting: "户部主事",
    tenureMonths: 4
  });
  worldState.player.examHistory = [
    ["child_exam", "童试", "秀才"],
    ["provincial_exam", "乡试", "举人"],
    ["metropolitan_exam", "会试", "贡士"],
    ["palace_exam", "殿试", "进士"]
  ].map(([level, examName, rank], index) => ({
    examId: `s59-${level}`,
    level,
    examName,
    score: { overall_score: 82 + index, authenticity_penalty: 0 },
    promotionResult: { passed: true, rank },
    sceneTime: {
      startedAt: { year: 1644, month: index + 1, tenDayPeriod: 1, turnCount: index },
      updatedAt: { year: 1644, month: index + 1, tenDayPeriod: 1, turnCount: index + 1 }
    }
  }));
  worldState.eventHistory = [
    "S59公开主线：书生连捷四场，殿试后入户部观政。",
    "S59公开任所：户部查核漕粮账册，牵连京杭漕运。",
    "prompt provider proposal statePatch event_log ai_change_proposals sk-proj-s59-secret"
  ];
  worldState.worldGeography.routes.push({
    id: "route-hidden-s59",
    type: "road",
    name: "SEALED_S59_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-shanhaiguan",
    visibility: "hidden",
    publicSummary: "SEALED_S59_ROUTE_SUMMARY",
    hiddenNotes: ["SEALED_S59_ROUTE_NOTE"]
  });
  worldState.worldPeople.npcs.push({
    id: "npc-hidden-s59",
    name: "SEALED_S59_NPC",
    visibility: "hidden",
    knownToPlayer: false,
    hiddenIntent: "SEALED_S59_INTENT",
    hiddenNotes: ["SEALED_S59_NPC_NOTE"]
  });
  worldState.officialPostings.postings.push({
    id: "posting-hidden-s59",
    officeId: "ministry_revenue_principal",
    officeTitle: "SEALED_S59_OFFICE",
    bureauId: "ministry_revenue",
    holderType: "npc",
    holderId: "npc-hidden-s59",
    status: "active",
    visibility: "hidden",
    knownToPlayer: false,
    publicSummary: "SEALED_S59_OFFICE_SUMMARY",
    hiddenNotes: ["SEALED_S59_OFFICE_NOTE"]
  });
  return worldState;
}

function buildS70AiFirstParityWorldState() {
  const worldState = createInitialState({
    dynasty: "明",
    role: "official",
    playerName: "S70双模验收",
    year: 1644,
    nativePlace: "苏州府",
    background: "新科进士入部观政。",
    customSetting: "S70 JSON/SQLite parity checks AI-first route views only."
  });
  Object.assign(worldState, {
    month: 5,
    tenDayPeriod: 3,
    turnCount: 8,
    borderThreat: 58,
    corruption: 54,
    grainReserve: 820,
    publicOrder: 68
  });
  Object.assign(worldState.player, {
    officeTitle: "吏部主事",
    position: "吏部主事",
    superiorFavor: 47,
    peerNetwork: 43,
    performanceMerit: 39,
    promotionProspect: 31,
    impeachmentRisk: 22,
    cleanReputation: 72
  });
  Object.assign(worldState.officialCareer, {
    currentPosting: "吏部主事",
    bureauId: "ministry_personnel"
  });
  worldState.officialCareer.assignments.push({
    id: "s70-parity-assignment",
    title: "核验候补官缺",
    status: "active",
    progress: 45,
    turnsRemaining: 1,
    deadlineLabel: "下月上旬"
  });
  worldState.eventHistory.push(
    "S70公开近事：吏部核验候补官缺，署中同僚请玩家复核籍贯回避。",
    "S70公开地图：京师与通州粮道、公文往返均为公开差遣线索。",
    "prompt provider proposal statePatch event_log ai_change_proposals sk-proj-s70-secret"
  );
  recordAiInvocation(worldState, {
    id: "s70-parity-narrator",
    taskType: "narrator",
    provider: "mock",
    model: "mock",
    status: "completed",
    durationMs: 2,
    maxOutputTokens: 1600,
    toolCallCount: 0,
    rejectedToolCallCount: 0
  });

  const previousState = clone(worldState);
  const worldTick = runWorldTick(worldState);
  applyStatePatch(worldState, worldTick.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const playerMonthlyBriefing = runPlayerMonthlyBriefingStep(worldState, {
    previousState,
    worldTick
  });
  const actorMemory = applyTurnActorMemoryUpdates(worldState, {
    playerMonthlyBriefing,
    providerMemoryProposals: [{
      actorId: "npc:C01",
      type: "impression",
      visibility: "player_visible",
      subjectType: "player",
      subjectId: "P1",
      summary: "赵给事记得玩家复核官缺案牍时谨慎守法。",
      salience: 64,
      confidence: 0.74,
      sourceRefs: [{ id: "s70-parity-turn", sourceView: "provider_turn", label: "署务札记" }]
    }, {
      actorId: "npc:C01",
      type: "fact",
      visibility: "private",
      summary: "这条私密记忆应被服务器拒绝。"
    }]
  });
  updateMonthlySessionSummary(worldState, {
    worldTick,
    playerMonthlyBriefing,
    actorMemory
  }, { taskType: "memory_summarizer" });

  return {
    worldState,
    worldTick,
    playerMonthlyBriefing,
    actorMemory
  };
}

async function seedAudit(adapter, worldState) {
  await adapter.appendAuditEvent(worldState.sessionId, {
    eventType: "turn_completed",
    visibility: "public",
    summary: "S59公开审计：双模式验收记录已入档。",
    related: {
      eventHistoryCount: worldState.eventHistory.length,
      hiddenNotes: "SEALED_S59_AUDIT_NOTE",
      localPath: "E:\\LSMNQ\\data\\audit\\sealed.jsonl"
    },
    appliedChanges: {
      turnCount: worldState.turnCount,
      statePatch: { hidden: "SEALED_S59_STATE_PATCH" }
    },
    createdAt: "2026-05-08T13:00:00.000Z"
  }, {
    revision: 2,
    turnCount: worldState.turnCount,
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod
  });
  await adapter.appendAuditEvent(worldState.sessionId, {
    eventType: "provider_turn_applied",
    visibility: "developer",
    summary: "SEALED_S59_DEVELOPER_AUDIT"
  });
  await adapter.appendAiProposal(worldState.sessionId, {
    proposalKind: "turn",
    status: "recorded",
    proposal: {
      promptText: "SEALED_S59_PROMPT",
      providerProposal: "SEALED_S59_PROVIDER_PROPOSAL",
      statePatch: { key: "sk-proj-s59-secret" }
    },
    accepted: { stateDelta: { publicOrder: 73 } }
  });
}

function buildVisiblePayload(worldState) {
  const prompt = assemblePromptContext(worldState, {
    task: "official_career",
    playerAction: "核验 S59 双模式存储、任所地理与近事档案"
  });
  return {
    worldGeographyView: buildWorldGeographyView(worldState),
    worldPeopleView: buildWorldPeopleView(worldState),
    officialPostingsView: buildOfficialPostingsView(worldState),
    eventArchiveView: buildEventArchiveView(worldState, { pageSize: 5 }),
    prompt: {
      worldGeography: prompt.worldGeography,
      worldPeople: prompt.worldPeople,
      officialPostings: prompt.officialPostings,
      retrievalContext: prompt.retrievalContext
    }
  };
}

function buildS70AiFirstVisiblePayload(worldState) {
  const env = { AI_PROVIDER: "mock" };
  const { settings, routePolicy } = resolveAiSettingsForSession(worldState, env);
  const aiSettingsView = redactAiSettingsForClient({ ...settings, routePolicy }, env);
  const timeSkipPlan = buildTimeSkipPlan("照旧处理一月", {}, { worldState });
  const timeSkip = buildTimeSkipSummary({
    executed: false,
    blocked: true,
    plan: timeSkipPlan,
    validation: { reasons: ["S70 双模验收只比较跳时安全摘要，不执行额外回合。"] },
    requestedTicks: timeSkipPlan.ticks || 0,
    completedTicks: 0,
    tickResults: []
  }, { provider: "mock", model: "mock" });
  return {
    aiSettingsView,
    aiInvocationSummaryView: buildAiInvocationSummaryView(worldState, routePolicy, env),
    playerMonthlyBriefingView: buildPlayerMonthlyBriefingView(worldState),
    timeSkip,
    actorMemoryView: buildActorMemoryView(worldState),
    sessionSummaryView: buildSessionSummaryView(worldState),
    mapContextView: buildMapContextView(worldState, buildPlayerAiActorProfile(worldState))
  };
}

function normalizePayloadForParity(payload = {}) {
  return {
    worldGeographyView: payload.worldGeographyView,
    worldPeopleView: payload.worldPeopleView,
    officialPostingsView: payload.officialPostingsView,
    eventArchiveView: payload.eventArchiveView,
    prompt: payload.prompt
  };
}

function assertVisibleParity(jsonWorldState, sqliteWorldState) {
  const jsonPayload = buildVisiblePayload(jsonWorldState);
  const sqlitePayload = buildVisiblePayload(sqliteWorldState);
  assertNoBlockedTokens("JSON visible payload", jsonPayload);
  assertNoBlockedTokens("SQLite visible payload", sqlitePayload);
  if (JSON.stringify(normalizePayloadForParity(jsonPayload)) !== JSON.stringify(normalizePayloadForParity(sqlitePayload))) {
    throw new Error("JSON/SQLite visible route and prompt payloads differ after import.");
  }
}

function assertS70AiFirstVisibleParity(jsonWorldState, sqliteWorldState) {
  const jsonPayload = buildS70AiFirstVisiblePayload(jsonWorldState);
  const sqlitePayload = buildS70AiFirstVisiblePayload(sqliteWorldState);
  assertNoBlockedTokens("S70 JSON AI-first visible payload", jsonPayload);
  assertNoBlockedTokens("S70 SQLite AI-first visible payload", sqlitePayload);
  if (JSON.stringify(jsonPayload) !== JSON.stringify(sqlitePayload)) {
    throw new Error("S70 JSON/SQLite AI-first visible payloads differ after adapter round trip.");
  }
  return { jsonPayload, sqlitePayload };
}

function tamperGeographyRows(dbPath, sessionId) {
  withSqliteDatabase(dbPath, (db) => {
    db.prepare("DELETE FROM geo_routes WHERE session_id = ?").run(sessionId);
  });
}

function deleteSqliteAuditRows(dbPath, sessionId) {
  if (!dbPath || dbPath === ":memory:" || !sessionId) return;
  withSqliteDatabase(dbPath, (db) => {
    for (const tableName of ["event_log", "ai_change_proposals"]) {
      const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
      if (!table) continue;
      db.prepare(`DELETE FROM ${tableName} WHERE session_id = ?`).run(sessionId);
    }
  });
}

async function runStorageMaintenanceAcceptance(options = {}) {
  if (!(typeof isBuiltin === "function" && isBuiltin("node:sqlite"))) {
    throw new Error("S59 dual-mode storage acceptance requires a Node.js runtime with node:sqlite support");
  }

  const { ownsDatabase, sqliteDatabasePath } = resolveSqlitePlan(options.sqliteDatabasePath);
  const jsonAdapter = createJsonSessionAdapter();
  const worldState = buildS59WorldState();
  const geographyOutPath = path.join(dataDir, `s59-geography-export-${randomUUID()}.json`);
  let sqliteAdapter = null;

  try {
    await jsonAdapter.writeSession(clone(worldState));
    await seedAudit(jsonAdapter, worldState);

    const dryRun = await runImportJsonSessionsToSqlite({
      databasePath: sqliteDatabasePath,
      dryRun: true,
      sessionId: worldState.sessionId
    });
    if (dryRun.imported !== 1 || dryRun.syncedDerivedTables !== false) {
      throw new Error("JSON -> SQLite dry-run did not report the selected session without syncing derived tables.");
    }

    const imported = await runSqliteGeographyTool({
      command: "import",
      databasePath: sqliteDatabasePath,
      overwrite: true,
      sessionId: worldState.sessionId
    });
    if (imported.imported !== 1 || imported.syncedDerivedTables !== true) {
      throw new Error("JSON -> SQLite import did not sync the selected session and derived tables.");
    }

    sqliteAdapter = createSqliteSessionAdapter({ databasePath: sqliteDatabasePath });
    await seedAudit(sqliteAdapter, worldState);
    const { record: jsonRecord } = await jsonAdapter.readSessionRecord(worldState.sessionId);
    const { record: sqliteRecord } = await sqliteAdapter.readSessionRecord(worldState.sessionId);
    assertVisibleParity(jsonRecord.worldState, sqliteRecord.worldState);

    let counts = readDerivedTableCounts(sqliteDatabasePath, worldState.sessionId);
    assertDerivedCounts(counts);

    tamperGeographyRows(sqliteDatabasePath, worldState.sessionId);
    const dryRepair = await runSqliteGeographyTool({
      command: "repair",
      databasePath: sqliteDatabasePath,
      dryRun: true,
      sessionId: worldState.sessionId
    });
    if (dryRepair.repaired !== 0 || dryRepair.sessions[0]?.repairStatus?.needsRepair !== true) {
      throw new Error("geography repair dry-run did not detect the deleted route rows.");
    }

    const repair = await runSqliteGeographyTool({
      command: "repair",
      databasePath: sqliteDatabasePath,
      sessionId: worldState.sessionId
    });
    if (repair.repaired !== 1) {
      throw new Error("geography repair did not restore deleted route rows.");
    }

    const status = await runSqliteGeographyTool({
      command: "status",
      databasePath: sqliteDatabasePath,
      sessionId: worldState.sessionId
    });
    if (status.sessions[0]?.repairStatus?.needsRepair !== false) {
      throw new Error("geography status still reports drift after repair.");
    }

    const geographyExport = await runSqliteGeographyTool({
      command: "export",
      databasePath: sqliteDatabasePath,
      outPath: geographyOutPath,
      sessionId: worldState.sessionId
    });
    const geographyExportFile = await fs.readFile(geographyOutPath, "utf8");
    assertNoBlockedTokens("geography export", geographyExport);
    assertNoBlockedTokens("geography export file", geographyExportFile);

    const auditJson = await runAuditEventArchiveTool({
      command: "export",
      storageAdapter: "json",
      sessionId: worldState.sessionId,
      limit: 20
    });
    const auditSqlite = await runAuditEventArchiveTool({
      command: "export",
      storageAdapter: "sqlite",
      databasePath: sqliteDatabasePath,
      sessionId: worldState.sessionId,
      limit: 20
    });
    assertNoBlockedTokens("JSON audit projection", auditJson);
    assertNoBlockedTokens("SQLite audit projection", auditSqlite);
    if (auditJson.exported !== 1 || auditSqlite.exported !== 1) {
      throw new Error("audit projection export did not read both JSON and SQLite sessions.");
    }

    counts = readDerivedTableCounts(sqliteDatabasePath, worldState.sessionId);
    assertDerivedCounts(counts);

    return {
      sessionId: worldState.sessionId,
      imported: imported.imported,
      dryRunImported: dryRun.imported,
      geographyRepair: {
        dryRunNeedsRepair: dryRepair.sessions[0].repairStatus.needsRepair,
        repaired: repair.repaired,
        cleanAfterRepair: status.sessions[0].repairStatus.needsRepair === false,
        exported: geographyExport.exported,
        wroteFile: Boolean(geographyExport.wroteFile)
      },
      auditProjection: {
        jsonProjectedItems: auditJson.sessions[0].projection.counts.projectedItems,
        sqliteProjectedItems: auditSqlite.sessions[0].projection.counts.projectedItems
      },
      derivedCounts: counts,
      sqliteDatabase: ownsDatabase ? "temporary" : "provided"
    };
  } finally {
    if (sqliteAdapter) {
      try {
        await sqliteAdapter.deleteSession(worldState.sessionId);
      } catch (error) {
        if (error.statusCode !== 404) throw error;
      } finally {
        sqliteAdapter.close();
      }
    }
    if (!ownsDatabase) deleteSqliteAuditRows(sqliteDatabasePath, worldState.sessionId);
    await removeSessionArtifacts(worldState.sessionId);
    await fs.rm(geographyOutPath, { force: true });
    if (ownsDatabase) await removeSqliteArtifacts(sqliteDatabasePath);
  }
}

async function runS70AiFirstParityAcceptance(options = {}) {
  if (!(typeof isBuiltin === "function" && isBuiltin("node:sqlite"))) {
    throw new Error("S70 AI-first parity acceptance requires a Node.js runtime with node:sqlite support");
  }

  const { ownsDatabase, sqliteDatabasePath } = resolveSqlitePlan(options.sqliteDatabasePath);
  const jsonAdapter = createJsonSessionAdapter();
  const fixture = buildS70AiFirstParityWorldState();
  const worldState = fixture.worldState;
  const sqliteAdapter = createSqliteSessionAdapter({ databasePath: sqliteDatabasePath });

  try {
    await jsonAdapter.writeSession(clone(worldState));
    await sqliteAdapter.writeSession(clone(worldState));
    const { record: jsonRecord } = await jsonAdapter.readSessionRecord(worldState.sessionId);
    const { record: sqliteRecord } = await sqliteAdapter.readSessionRecord(worldState.sessionId);
    const { jsonPayload } = assertS70AiFirstVisibleParity(jsonRecord.worldState, sqliteRecord.worldState);

    return {
      sessionId: worldState.sessionId,
      sqliteDatabase: ownsDatabase ? "temporary" : "provided",
      views: {
        aiRoutes: jsonPayload.aiSettingsView.taskRoutes.length,
        recentInvocations: jsonPayload.aiInvocationSummaryView.recentInvocations.length,
        monthlyBriefingActive: jsonPayload.playerMonthlyBriefingView.active,
        monthlyBriefingReportId: jsonPayload.playerMonthlyBriefingView.latest?.reportId || null,
        timeSkipDetected: jsonPayload.timeSkip.requestedTicks === 3,
        actorMemoryActors: jsonPayload.actorMemoryView.actors.length,
        sessionSummaryCount: jsonPayload.sessionSummaryView.recentMonthlySummaries.length,
        mapRefs: jsonPayload.mapContextView.mapEntityRefs.length
      },
      memory: {
        appliedCount: fixture.actorMemory.appliedCount,
        rejectedCount: fixture.actorMemory.rejectedCount
      },
      hiddenTokenGuard: {
        blockedTokenCount: BLOCKED_TOKENS.length
      }
    };
  } finally {
    try {
      await jsonAdapter.deleteSession(worldState.sessionId);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
    try {
      await sqliteAdapter.deleteSession(worldState.sessionId);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    } finally {
      sqliteAdapter.close();
    }
    if (ownsDatabase) await removeSqliteArtifacts(sqliteDatabasePath);
  }
}

function tamperPromptRetrievalRows(dbPath, sessionId) {
  withSqliteDatabase(dbPath, (db) => {
    db.prepare("DELETE FROM prompt_retrieval_index WHERE session_id = ?").run(sessionId);
  });
}

async function runS67SqliteReadRepairAcceptance(worldState, options = {}) {
  if (!(typeof isBuiltin === "function" && isBuiltin("node:sqlite"))) {
    return { skipped: true, reason: "node:sqlite unavailable" };
  }

  const { ownsDatabase, sqliteDatabasePath } = resolveSqlitePlan(options.sqliteDatabasePath);
  const sqliteAdapter = createSqliteSessionAdapter({ databasePath: sqliteDatabasePath });
  try {
    await sqliteAdapter.writeSession(clone(worldState));
    const expectedPromptRows = buildPromptRetrievalRows(createFixtureSessionRecord(clone(worldState))).length;
    tamperPromptRetrievalRows(sqliteDatabasePath, worldState.sessionId);
    const beforeRepair = readDerivedTableCounts(sqliteDatabasePath, worldState.sessionId);
    const repairedRead = await measureAsync(() => sqliteAdapter.readSessionRecord(worldState.sessionId));
    const afterRepair = readDerivedTableCounts(sqliteDatabasePath, worldState.sessionId);
    const sqliteWorldState = repairedRead.value.record.worldState;
    const jsonContext = assemblePromptContext(worldState, {
      task: "official_career",
      playerAction: "核查户部、北京、漕运、样本人物与任所",
      promptBudgetProfile: "ordinary",
      promptRetrievalSource: false
    }).retrievalContext;
    const sqliteContext = assemblePromptContext(sqliteWorldState, {
      task: "official_career",
      playerAction: "核查户部、北京、漕运、样本人物与任所",
      promptBudgetProfile: "ordinary"
    }).retrievalContext;
    assertNoBlockedTokens("S67.1 SQLite repaired prompt context", sqliteContext);
    if (afterRepair.promptRetrievalIndex !== expectedPromptRows) {
      throw new Error("S67.1 SQLite prompt_retrieval_index read repair did not restore expected row count.");
    }
    if (JSON.stringify(sqliteContext.geography) !== JSON.stringify(jsonContext.geography)) {
      throw new Error("S67.1 SQLite read repair changed geography prompt retrieval parity.");
    }
    if (JSON.stringify(sqliteContext.people) !== JSON.stringify(jsonContext.people)) {
      throw new Error("S67.1 SQLite read repair changed people prompt retrieval parity.");
    }
    if (JSON.stringify(sqliteContext.offices) !== JSON.stringify(jsonContext.offices)) {
      throw new Error("S67.1 SQLite read repair changed office prompt retrieval parity.");
    }

    assertFiniteMetric(
      "S67.1 sqliteReadRepairMs",
      repairedRead.durationMs,
      S67_SCALE_ACCEPTANCE_THRESHOLDS.sqliteReadRepairMs
    );

    return {
      skipped: false,
      expectedPromptRows,
      beforeRepairPromptRows: beforeRepair.promptRetrievalIndex,
      afterRepairPromptRows: afterRepair.promptRetrievalIndex,
      sqliteReadRepairMs: repairedRead.durationMs,
      worldSessions: afterRepair.worldSessions,
      eventArchiveIndex: afterRepair.eventArchiveIndex
    };
  } finally {
    try {
      await sqliteAdapter.deleteSession(worldState.sessionId);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    } finally {
      sqliteAdapter.close();
    }
    if (ownsDatabase) await removeSqliteArtifacts(sqliteDatabasePath);
  }
}

async function runScaleRegressionAcceptance(options = {}) {
  const heapBefore = process.memoryUsage().heapUsed;
  const fixtureTiming = measureSync(() => createWorldContentFixture({ size: "large" }));
  const fixture = fixtureTiming.value;
  const metrics = fixture.fixtureSummary.metrics;
  assertLargeFixtureMetrics(metrics);

  const baseline = buildWorldContentPerformanceBaseline(fixture);
  const ordinaryPrompt = buildPromptBudgetReport(fixture.worldState, {
    task: "official_career",
    playerAction: "核查户部、北京、漕运、边报、样本人物与任所",
    promptBudgetProfile: "ordinary"
  });
  const highPrompt = buildPromptBudgetReport(fixture.worldState, {
    task: "official_career",
    playerAction: "核查户部、北京、漕运、边报、样本人物与任所",
    promptBudgetProfile: "high"
  });
  assertPromptStrategy(
    "S67.1 ordinary prompt strategy",
    ordinaryPrompt,
    "ordinary",
    WORLD_CONTENT_PROMPT_BUDGET.ordinaryRows,
    WORLD_CONTENT_PROMPT_BUDGET.ordinaryChars
  );
  assertPromptStrategy(
    "S67.1 high prompt strategy",
    highPrompt,
    "high",
    WORLD_CONTENT_PROMPT_BUDGET.highRelevanceRows,
    WORLD_CONTENT_PROMPT_BUDGET.highRelevanceChars
  );

  const promptPayload = {
    ordinary: ordinaryPrompt.promptContext.retrievalContext,
    high: highPrompt.promptContext.retrievalContext
  };
  assertNoBlockedTokens("S67.1 prompt strategy payload", promptPayload);

  const fixturePromptPage = buildWorldContentFixturePage(fixture, "promptRetrievalRows", {
    page: 3,
    pageSize: 50,
    query: "安全检索"
  });
  const fixtureCityPage = buildWorldContentFixturePage(fixture, "geography.cities", {
    page: 2,
    pageSize: 24,
    query: "样本城"
  });
  const hiddenQueryPage = buildWorldContentFixturePage(fixture, "promptRetrievalRows", {
    query: flattenCanaries(fixture.hiddenCanaries)[0]
  });
  assertFixturePageSafety("S67.1 large prompt fixture page", fixturePromptPage);
  assertFixturePageSafety("S67.1 large city fixture page", fixtureCityPage);
  if (hiddenQueryPage.pagination.totalItems !== 0) {
    throw new Error("S67.1 large fixture hidden query matched visible rows.");
  }

  const informationTiming = measureSync(() =>
    buildInformationPanelPageViews(fixture.worldState, {
      tabId: "world-people",
      filter: "npc",
      sort: "risk",
      query: "人物",
      page: 2,
      pageSize: 12
    })
  );
  assertInformationPanelScale(informationTiming.value);

  const eventArchive = buildEventArchiveView(fixture.worldState, { page: 1, pageSize: 50 });
  assertNoBlockedTokens("S67.1 event archive page", eventArchive);
  if (eventArchive.pagination.pageSize > 50) {
    throw new Error("S67.1 event archive pagination exceeded expected cap.");
  }

  const sqliteRepair = await runS67SqliteReadRepairAcceptance(fixture.worldState, {
    sqliteDatabasePath: options.sqliteDatabasePath
  });
  const heapDeltaBytes = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
  const performance = {
    fixtureGenerationMs: fixtureTiming.durationMs,
    eventArchivePaginationMs: baseline.eventArchivePaginationMs,
    promptAssemblyMs: baseline.promptAssemblyMs,
    promptRetrievalRowsMs: baseline.promptRetrievalRowsMs,
    fixturePageMs: baseline.fixturePageMs,
    informationPanelMs: informationTiming.durationMs,
    sqliteReadRepairMs: sqliteRepair.skipped ? 0 : sqliteRepair.sqliteReadRepairMs,
    heapDeltaBytes
  };
  assertS67PerformanceThresholds(performance);

  return {
    fixture: {
      size: fixture.size,
      metrics: {
        countries: metrics.countries,
        cities: metrics.cities,
        npcs: metrics.npcs,
        households: metrics.households,
        relationships: metrics.relationships,
        officialCatalogRows: metrics.officialCatalogRows,
        postings: metrics.postings,
        eventIntelItems: metrics.eventIntelItems,
        promptRetrievalRows: metrics.promptRetrievalRows,
        hiddenCanaries: metrics.hiddenCanaries,
        routeViewRows: metrics.routeViewRows,
        storageRows: metrics.storageRows
      }
    },
    promptStrategy: {
      ordinary: summarizePromptStrategy(ordinaryPrompt),
      high: summarizePromptStrategy(highPrompt)
    },
    informationPanel: {
      activeTabId: informationTiming.value.activeTabId,
      pageCount: informationTiming.value.pages.length,
      activePageItems: informationTiming.value.activePage.items.length,
      activeTotalItems: informationTiming.value.activePage.pagination.totalItems,
      pageSize: informationTiming.value.activePage.pagination.pageSize,
      source: informationTiming.value.activePage.source
    },
    fixturePages: {
      promptRows: fixturePromptPage.pagination,
      cities: fixtureCityPage.pagination,
      hiddenQueryMatches: hiddenQueryPage.pagination.totalItems
    },
    eventArchive: {
      pageSize: eventArchive.pagination.pageSize,
      totalItems: eventArchive.pagination.totalItems,
      pageItems: eventArchive.items.length
    },
    sqliteRepair,
    performance,
    thresholds: S67_SCALE_ACCEPTANCE_THRESHOLDS,
    hiddenTokenGuard: {
      blockedTokenCount: BLOCKED_TOKENS.length,
      fixtureCanaryCount: flattenCanaries(fixture.hiddenCanaries).length
    }
  };
}

async function runBrowserDualModeAcceptance(options = {}) {
  const {
    runBrowserSmoke,
    runInformationPanelParitySmoke
  } = require("./browserSmoke");
  const common = {
    browserPath: options.browserPath,
    headed: options.headed,
    screenshotsDir: options.screenshotsDir
  };
  const sqlitePlan = resolveSqlitePlan(options.sqliteDatabasePath);
  try {
    const json = await runBrowserSmoke({
      ...common,
      storageAdapter: "json"
    });
    const sqlite = await runBrowserSmoke({
      ...common,
      storageAdapter: "sqlite",
      sqliteDatabasePath: sqlitePlan.sqliteDatabasePath
    });
    const informationParity = await runInformationPanelParitySmoke({
      ...common,
      sqliteDatabasePath: sqlitePlan.sqliteDatabasePath
    });
    return {
      json: {
        identityTurns: json.identityTurns,
        viewports: json.uiAcceptance.viewports
      },
      sqlite: {
        identityTurns: sqlite.identityTurns,
        viewports: sqlite.uiAcceptance.viewports
      },
      informationParity: {
        viewports: informationParity.uiAcceptance.viewports
      }
    };
  } finally {
    if (sqlitePlan.ownsDatabase) await removeSqliteArtifacts(sqlitePlan.sqliteDatabasePath);
  }
}

async function runDualModeAcceptance(options = {}) {
  const storage = await runStorageMaintenanceAcceptance(options);
  const s70AiFirstParity = await runS70AiFirstParityAcceptance(options);
  const scale = await runScaleRegressionAcceptance(options);
  const browser = options.skipBrowser ? { skipped: true } : await runBrowserDualModeAcceptance(options);
  return {
    ok: true,
    storage,
    s70AiFirstParity,
    scale,
    browser
  };
}

async function main(argv = process.argv.slice(2), io = console) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp(io);
    return null;
  }
  const result = await runDualModeAcceptance(options);
  io.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Dual-mode acceptance failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  S67_SCALE_ACCEPTANCE_THRESHOLDS,
  assertNoBlockedTokens,
  buildS59WorldState,
  buildS70AiFirstParityWorldState,
  buildS70AiFirstVisiblePayload,
  deleteSqliteAuditRows,
  parseArgs,
  resolveSqlitePlan,
  runBrowserDualModeAcceptance,
  runDualModeAcceptance,
  runS70AiFirstParityAcceptance,
  runScaleRegressionAcceptance,
  runS67SqliteReadRepairAcceptance,
  runStorageMaintenanceAcceptance
};
