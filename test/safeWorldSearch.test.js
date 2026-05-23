const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { createInitialState } = require("../src/game/initialState");
const { createLandSurveyDelegatedTask } = require("../src/game/delegatedTasks");
const {
  createNpcActiveRequest,
  resolveNpcActiveRequest,
  runNpcActiveRequestStep
} = require("../src/game/npcActiveRequests");
const { applyWorldEntityInfluences } = require("../src/game/worldEntities");
const { resolveTradeRequest } = require("../src/game/tradeLedger");
const {
  SAFE_WORLD_SEARCH_MAX_PAGE_SIZE,
  SAFE_WORLD_SEARCH_MAX_QUERY_LENGTH,
  buildSafeSearchRows,
  normalizeSearchQuery,
  searchSafeWorldIndex
} = require("../src/game/safeWorldSearch");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({ error: error.message || "Internal server error" });
  });
  return createFetchSafeServer(app);
}

function createSearchWorldState() {
  const worldState = createInitialState({
    role: "official",
    playerName: "检索御史"
  });
  Object.assign(worldState, {
    treasury: 240,
    grainReserve: 170,
    taxRate: 68,
    corruption: 88,
    borderThreat: 88,
    armyMorale: 34,
    publicOrder: 26,
    turnCount: 7
  });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.eventHistory = [
    "户部催核京杭漕运北段账册，命本任先查北京仓储。",
    "山海关边报称辽东粮道风声趋紧。"
  ];
  worldState.worldPeople.npcs.push({
    id: "npc-safe-search-gu",
    name: "顾衡",
    visibility: "public",
    knownToPlayer: true,
    rankLabel: "候补主簿",
    publicSummary: "顾衡在北京递送户部钱粮消息。",
    reputation: 50,
    influence: 40,
    lastUpdatedTurn: worldState.turnCount
  });
  worldState.worldPeople.npcs.push({
    id: "npc-safe-search-hidden",
    name: "SEALED_SAFE_SEARCH_NPC",
    visibility: "hidden",
    knownToPlayer: false,
    hiddenIntent: "SEALED_SAFE_SEARCH_INTENT",
    hiddenNotes: ["SEALED_SAFE_SEARCH_NOTE"]
  });
  worldState.worldGeography.cities.push({
    id: "city-safe-search-hidden",
    countryId: "country-ming",
    name: "SEALED_SAFE_SEARCH_CITY",
    visibility: "hidden",
    knownToPlayer: false,
    publicSummary: "SEALED_SAFE_SEARCH_CITY prompt_retrieval_index"
  });
  worldState.worldGeography.cities[0].publicSummary =
    "京师为朝廷中枢，官缺与仓场公开可见。prompt_retrieval_index data/sessions/secret sk-safe-search-secret";
  return worldState;
}

function addEconomyTraceFixtures(worldState) {
  worldState.player.localTreasury = 120;
  worldState.npcEconomyLedger.recentEvents = [
    "人情债月账：韩员外为修桥垫付，公开人情债略增。"
  ];
  resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:safe-search:economy",
    silverDelta: 0,
    offerSummary: "询问纸张与粟米行价。"
  }, {
    npcResponse: "可再议。",
    proposal: {
      status: "countered",
      publicSummary: "韩员外交易议价：纸张与粮价消息尚待服务器确认。",
      riskTags: ["议价"]
    }
  });
  createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩，核对鱼鳞册与实耕。",
    budget: 24
  });
  return worldState;
}

test("S71.3 safe world search returns capped player-facing snippets across domains", () => {
  const worldState = createSearchWorldState();
  const checks = [
    ["北京", "geography"],
    ["顾衡", "people"],
    ["户部", "offices"],
    ["边报", "events"],
    ["粮道", "reports"],
    ["官署", "rumors"]
  ];

  for (const [query, domain] of checks) {
    const view = searchSafeWorldIndex(worldState, { query, domain, pageSize: 3 });
    assert.equal(view.schemaVersion, 1);
    assert.equal(view.query, query);
    assert.equal(view.domains[0], domain);
    assert.equal(view.results.length > 0, true, `${domain} should return results for ${query}`);
    assert.ok(view.results.every((item) => item.domain === domain));
    assert.ok(view.results.every((item) => item.sourceView && item.sourceId && item.title && item.snippet));
    assert.ok(view.results.every((item) => item.snippet.length <= 183));
    assert.ok(view.results.every((item) => item.routeViewRef?.sourceView && item.routeViewRef?.sourceId));
  }
});

test("S71.3 safe world search rejects raw/hidden queries and redacts polluted visible text", () => {
  const worldState = createSearchWorldState();
  const rejected = searchSafeWorldIndex(worldState, {
    query: "prompt_retrieval_index event_log world_sessions sk-safe-search-secret",
    pageSize: 50
  });
  assert.equal(rejected.queryRejected, true);
  assert.equal(rejected.results.length, 0);

  const visible = searchSafeWorldIndex(worldState, { query: "北京", pageSize: 50 });
  const serialized = JSON.stringify(visible);
  assert.doesNotMatch(
    serialized,
    /SEALED_SAFE_SEARCH|prompt_retrieval_index|event_log|world_sessions|data\/sessions|sk-safe-search-secret|hiddenNotes|hiddenIntent|provider|proposal|raw/
  );

  const rows = buildSafeSearchRows(worldState);
  assert.equal(rows.some((row) => row.sourceId === "npc-safe-search-hidden"), false);
  assert.equal(rows.some((row) => row.searchText.includes("SEALED_SAFE_SEARCH")), false);
});

test("S71.3 safe world search normalizes query and pagination caps", () => {
  const worldState = createSearchWorldState();
  const longQuery = "北京".repeat(80);
  const normalized = normalizeSearchQuery(longQuery);
  assert.equal(normalized.truncated, true);
  assert.equal(normalized.query.length, SAFE_WORLD_SEARCH_MAX_QUERY_LENGTH);

  const view = searchSafeWorldIndex(worldState, {
    query: "北京",
    page: -4,
    pageSize: 200
  });
  assert.equal(view.pagination.page, 1);
  assert.equal(view.pagination.pageSize, SAFE_WORLD_SEARCH_MAX_PAGE_SIZE);
  assert.equal(view.results.length <= SAFE_WORLD_SEARCH_MAX_PAGE_SIZE, true);
});

test("S88.6 safe world search preserves domain consequence rows under global row cap", () => {
  const worldState = createSearchWorldState();
  worldState.turnCount = 32;
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "safe-search-domain-consequence-cap",
      policyType: "market_regulation",
      policyLabel: "稳价后果",
      status: "accepted",
      publicSummary: "清河县稳价后果进入安全检索高量回归。",
      stateDelta: { publicOrder: 2 },
      appliedAtTurn: 32
    }]
  };
  const noisyCities = Array.from({ length: 1300 }, (_, index) => ({
    id: `city-safe-search-noisy-${index}`,
    countryId: "country-ming",
    name: `检索噪声城${index}`,
    visibility: "public",
    publicSummary: `普通地理噪声 ${index}`,
    intelConfidence: 50
  }));

  const rows = buildSafeSearchRows(worldState, {
    views: {
      worldGeographyView: {
        countries: [],
        cities: noisyCities,
        routes: [],
        frontierZones: []
      },
      worldPeopleView: {
        npcs: [],
        households: [],
        relationships: []
      },
      officialPostingsView: {
        bureaus: [],
        offices: [],
        cityJurisdictions: [],
        postings: [],
        assessmentRecords: [],
        transferRecords: []
      }
    }
  });
  const view = searchSafeWorldIndex(worldState, {
    query: "稳价后果",
    domain: "events",
    pageSize: 5,
    views: {
      worldGeographyView: {
        countries: [],
        cities: noisyCities,
        routes: [],
        frontierZones: []
      },
      worldPeopleView: {
        npcs: [],
        households: [],
        relationships: []
      },
      officialPostingsView: {
        bureaus: [],
        offices: [],
        cityJurisdictions: [],
        postings: [],
        assessmentRecords: [],
        transferRecords: []
      }
    }
  });

  assert.equal(rows.length, 1200);
  assert.ok(rows.some((row) => row.sourceView === "domainConsequenceView.recentConsequences"));
  assert.ok(view.results.some((result) =>
    result.sourceView === "domainConsequenceView.recentConsequences" && /稳价后果/.test(`${result.title}${result.snippet}`)
  ));
  assert.doesNotMatch(JSON.stringify(view), /outcomeId|stateDelta|cityPolicyLedger|safe-search-domain-consequence-cap/);
});

test("S88.7 safe world search indexes NPC follow-up domain evidence without raw ledger leaks", () => {
  const worldState = createSearchWorldState();
  worldState.turnCount = 14;
  const bribe = createNpcActiveRequest(worldState, "bribe");
  const introduction = createNpcActiveRequest(worldState, "introduction");
  assert.equal(bribe.ok, true);
  assert.equal(introduction.ok, true);
  resolveNpcActiveRequest(worldState, bribe.request.requestId, "report");
  resolveNpcActiveRequest(worldState, introduction.request.requestId, "accept");
  worldState.turnCount = 15;
  runNpcActiveRequestStep(worldState, "续办廉政线索：拒收留痕并呈报，不收财物。");

  const rows = buildSafeSearchRows(worldState);
  const bribeSearch = searchSafeWorldIndex(worldState, { query: "廉政 watchlist", domain: "events", pageSize: 5 });
  const peopleSearch = searchSafeWorldIndex(worldState, { query: "引荐 拜会", domain: "people", pageSize: 5 });
  const serialized = JSON.stringify({ rows, bribeSearch, peopleSearch });

  assert.ok(rows.some((row) => row.sourceView === "npcActiveRequestView.followUpEvidence"));
  assert.ok(bribeSearch.results.some((result) =>
    result.sourceView === "npcActiveRequestView.followUpEvidence" && /廉政|watchlist/.test(`${result.title}${result.snippet}`)
  ));
  assert.ok(peopleSearch.results.some((result) =>
    result.sourceView === "npcActiveRequestView.followUpEvidence" && /引荐|拜会/.test(`${result.title}${result.snippet}`)
  ));
  assert.doesNotMatch(
    serialized,
    /npcActiveRequestLedger|hiddenDossier|privateSignalTags|providerPayload|provider_payload|safe_search_index|safe_search_fts|state_patch|world_sessions|sk-[A-Za-z0-9_-]{6,}|\/mnt\/e/
  );
});

test("S88.8 safe world search indexes economy trace rows without raw ledger leaks", () => {
  const worldState = addEconomyTraceFixtures(createInitialState({
    role: "magistrate",
    playerName: "经济检索"
  }));
  worldState.turnCount = 24;

  const rows = buildSafeSearchRows(worldState);
  const tradeSearch = searchSafeWorldIndex(worldState, { query: "韩员外 交易议价", domain: "reports", pageSize: 5 });
  const delegatedSearch = searchSafeWorldIndex(worldState, { query: "东乡清丈 委派预算", domain: "reports", pageSize: 5 });
  const debtSearch = searchSafeWorldIndex(worldState, { query: "人情债 月账", domain: "reports", pageSize: 5 });
  const marketSearch = searchSafeWorldIndex(worldState, { query: "药材", domain: "reports", pageSize: 5 });
  const serialized = JSON.stringify({ rows, tradeSearch, delegatedSearch, debtSearch, marketSearch });

  assert.ok(rows.some((row) => row.sourceView === "economyTraceView.traceItems"));
  assert.ok(tradeSearch.results.some((result) =>
    result.sourceView === "economyTraceView.traceItems" && /交易议价|韩员外/.test(`${result.title}${result.snippet}`)
  ));
  assert.ok(delegatedSearch.results.some((result) =>
    result.sourceView === "economyTraceView.traceItems" && /东乡清丈|委派预算/.test(`${result.title}${result.snippet}`)
  ));
  assert.ok(debtSearch.results.some((result) =>
    result.sourceView === "economyTraceView.traceItems" && /人情债|月账/.test(`${result.title}${result.snippet}`)
  ));
  assert.ok(marketSearch.results.some((result) =>
    result.sourceView === "economyTraceView.traceItems" && /药材|市价/.test(`${result.title}${result.snippet}`)
  ));
  assert.doesNotMatch(
    serialized,
    /assetLedger|resourceLedger|inventoryLedger|tradeLedger|delegatedTaskLedger|marketPriceLedger|npcEconomyLedger|evidenceRefs|resourceDelta|relationshipSignals|sqlite|SQLite|SQL|world_sessions|safe_search_index|providerPayload|hiddenDossier|privateSignalTags|sk-[A-Za-z0-9_-]{6,}|\/mnt\/e/
  );
});

test("S88.8 safe world search preserves economy trace rows under global row cap", () => {
  const worldState = addEconomyTraceFixtures(createInitialState({
    role: "magistrate",
    playerName: "经济检索上限"
  }));
  worldState.turnCount = 28;
  const noisyCities = Array.from({ length: 1300 }, (_, index) => ({
    id: `city-safe-search-economy-noisy-${index}`,
    countryId: "country-ming",
    name: `经济噪声城${index}`,
    visibility: "public",
    publicSummary: `普通经济噪声 ${index}`,
    intelConfidence: 50
  }));
  const views = {
    worldGeographyView: {
      countries: [],
      cities: noisyCities,
      routes: [],
      frontierZones: []
    },
    worldPeopleView: {
      npcs: [],
      households: [],
      relationships: []
    },
    officialPostingsView: {
      bureaus: [],
      offices: [],
      cityJurisdictions: [],
      postings: [],
      assessmentRecords: [],
      transferRecords: []
    }
  };

  const rows = buildSafeSearchRows(worldState, { views });
  const view = searchSafeWorldIndex(worldState, {
    query: "人情债 月账",
    domain: "reports",
    pageSize: 5,
    views
  });

  assert.equal(rows.length, 1200);
  assert.ok(rows.some((row) => row.sourceView === "economyTraceView.traceItems"));
  assert.ok(view.results.some((result) =>
    result.sourceView === "economyTraceView.traceItems" && /人情债|月账/.test(`${result.title}${result.snippet}`)
  ));
  assert.doesNotMatch(JSON.stringify(view), /tradeLedger|delegatedTaskLedger|npcEconomyLedger|safe_search_index|world_sessions/);
});

test("S88.7 safe world search indexes world entity impact evidence without raw leaks", () => {
  const worldState = createSearchWorldState();
  worldState.turnCount = 27;
  applyWorldEntityInfluences(worldState, [
    {
      entityId: "academy-same-year-circle",
      sourceType: "npc_relationship_action",
      sourceId: "npc-relationship-resolution:npc-scholar-peer-shen:debate:27",
      metricsDelta: { trust: 2, pressure: -1 },
      publicNote: "论道余波进入同年文社"
    },
    {
      entityId: "court-censorate",
      sourceType: "active_npc_request",
      sourceId: "data/sessions/rawLedger-providerPayload-safe_search_index",
      metricsDelta: { pressure: 2 },
      publicNote: "来函后续已登记为风宪证据观察"
    }
  ]);

  const rows = buildSafeSearchRows(worldState);
  const debateSearch = searchSafeWorldIndex(worldState, { query: "论道 同年文社", domain: "events", pageSize: 5 });
  const censorSearch = searchSafeWorldIndex(worldState, { query: "风宪 证据观察", domain: "events", pageSize: 5 });
  const serialized = JSON.stringify({ rows, debateSearch, censorSearch });

  assert.ok(rows.some((row) => row.sourceView === "worldEntityView.recentImpacts"));
  assert.ok(debateSearch.results.some((result) =>
    result.sourceView === "worldEntityView.recentImpacts" && /论道余波|同年文社/.test(`${result.title}${result.snippet}`)
  ));
  assert.ok(censorSearch.results.some((result) =>
    result.sourceView === "worldEntityView.recentImpacts" && /风宪|证据观察/.test(`${result.title}${result.snippet}`)
  ));
  assert.doesNotMatch(
    serialized,
    /data\/sessions|rawLedger|providerPayload|safe_search_index|safe_search_fts|hiddenDossier|privateSignalTags|provider_payload|state_patch|world_sessions|sk-[A-Za-z0-9_-]{6,}|\/mnt\/e/
  );
});

test("S88.7 safe world search preserves world entity impact rows under global row cap", () => {
  const worldState = createSearchWorldState();
  worldState.turnCount = 28;
  applyWorldEntityInfluences(worldState, [
    {
      entityId: "academy-same-year-circle",
      sourceType: "npc_relationship_action",
      sourceId: "npc-relationship-resolution:npc-scholar-peer-shen:debate:28",
      metricsDelta: { trust: 2, pressure: -1 },
      publicNote: "论道余波进入同年文社"
    }
  ]);
  const noisyCities = Array.from({ length: 1300 }, (_, index) => ({
    id: `city-safe-search-entity-noisy-${index}`,
    countryId: "country-ming",
    name: `实体噪声城${index}`,
    visibility: "public",
    publicSummary: `普通实体噪声 ${index}`,
    intelConfidence: 50
  }));
  const views = {
    worldGeographyView: {
      countries: [],
      cities: noisyCities,
      routes: [],
      frontierZones: []
    },
    worldPeopleView: {
      npcs: [],
      households: [],
      relationships: []
    },
    officialPostingsView: {
      bureaus: [],
      offices: [],
      cityJurisdictions: [],
      postings: [],
      assessmentRecords: [],
      transferRecords: []
    }
  };

  const rows = buildSafeSearchRows(worldState, { views });
  const view = searchSafeWorldIndex(worldState, {
    query: "论道 同年文社",
    domain: "events",
    pageSize: 5,
    views
  });

  assert.equal(rows.length, 1200);
  assert.ok(rows.some((row) => row.sourceView === "worldEntityView.recentImpacts"));
  assert.ok(view.results.some((result) =>
    result.sourceView === "worldEntityView.recentImpacts" && /论道余波|同年文社/.test(`${result.title}${result.snippet}`)
  ));
  assert.doesNotMatch(JSON.stringify(view), /safe_search_index|world_sessions|rawLedger|providerPayload/);
});

test("GET /api/game/search/:sessionId returns safe snippets from JSON storage", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createSearchWorldState();
  await writeSession(clone(worldState));
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  const response = await fetch(
    `${server.baseUrl}/api/game/search/${worldState.sessionId}?q=${encodeURIComponent("顾衡")}&domain=people&page=1&pageSize=4`
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.sessionId, worldState.sessionId);
  assert.equal(payload.safeWorldSearchView.query, "顾衡");
  assert.equal(payload.safeWorldSearchView.pagination.pageSize, 4);
  assert.equal(payload.safeWorldSearchView.results.length, 1);
  assert.equal(payload.safeWorldSearchView.results[0].sourceId, "npc-safe-search-gu");
  assert.doesNotMatch(JSON.stringify(payload), /SEALED_SAFE_SEARCH|prompt_retrieval_index|event_log|world_sessions|sk-safe-search-secret/);
});

test("GET /api/game/search/:sessionId keeps missing sessions on normal storage errors", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const response = await fetch(
    `${server.baseUrl}/api/game/search/00000000-0000-4000-8000-000000000000?q=${encodeURIComponent("北京")}`
  );
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.match(payload.error, /Session not found/);
});
