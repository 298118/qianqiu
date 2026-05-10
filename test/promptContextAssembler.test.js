const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  RETRIEVAL_CONTEXT_SCHEMA_VERSION,
  assemblePromptContext,
  buildRankedRetrievalContext
} = require("../src/ai/promptContextAssembler");

test("prompt context assembler centralizes visible summaries and ranked retrieval context", () => {
  const worldState = createInitialState({ role: "official", playerName: "Assembler Tester" });
  const context = assemblePromptContext(worldState, {
    task: "official_career",
    playerAction: "核查户部与京杭漕运账册"
  });

  assert.equal(context.retrievalContext.schemaVersion, RETRIEVAL_CONTEXT_SCHEMA_VERSION);
  assert.equal(context.retrievalContext.retrievalMode, "server_visible_ranked_projection");
  assert.match(JSON.stringify(context.relationshipLedger), /赵给事|士大夫/);
  assert.match(JSON.stringify(context.worldGeography), /北京|山海关|country-ming/);
  assert.match(JSON.stringify(context.officialPostings), /户部|吏部|任免/);
  assert.match(JSON.stringify(context.retrievalContext), /京杭漕运|户部|worldGeographyView/);
  assert.match(JSON.stringify(context.militaryDiplomacy), /server_visible_military_diplomacy_projection/);
});

test("prompt context assembler filters hidden rows, hidden refs, raw ledgers, and raw audit-like fields", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "Hidden Context Tester" });
  worldState.audit = { ai_change_proposals: "SEALED_AUDIT_PAYLOAD" };
  worldState.characters.push({
    id: "C-hidden-assembler-related",
    name: "SEALED_ASSEMBLER_RELATED_CHARACTER",
    role: "密使"
  });
  worldState.relationshipLedger.characters["C-hidden-assembler-related"] = {
    id: "C-hidden-assembler-related",
    name: "SEALED_ASSEMBLER_RELATED_CHARACTER",
    role: "密使",
    stance: "hidden",
    relationship: 0,
    resentment: 0,
    networkSource: "hidden",
    recentIntent: "hidden",
    visible: false
  };
  worldState.worldGeography.cities.push({
    id: "city-hidden-assembler",
    countryId: "country-ming",
    regionId: "region-north-zhili",
    name: "SEALED_ASSEMBLER_CITY",
    jurisdictionLevel: "secret",
    visibility: "hidden",
    publicSummary: "SEALED_ASSEMBLER_CITY_SUMMARY",
    hiddenNotes: ["SEALED_ASSEMBLER_CITY_NOTE"]
  });
  worldState.worldPeople.npcs.push({
    id: "npc-hidden-assembler",
    name: "SEALED_ASSEMBLER_NPC",
    visibility: "hidden",
    publicSummary: "SEALED_ASSEMBLER_NPC_SUMMARY",
    hiddenIntent: "SEALED_ASSEMBLER_INTENT",
    hiddenNotes: ["SEALED_ASSEMBLER_NPC_NOTE"]
  });
  worldState.officialPostings.postings.push({
    id: "posting-hidden-assembler",
    officeId: "ministry_revenue_principal",
    bureauId: "ministry_revenue",
    holderType: "npc",
    holderId: "npc-hidden-assembler",
    visibility: "hidden",
    publicSummary: "SEALED_ASSEMBLER_POSTING"
  });
  worldState.worldThreads.threads.push({
    id: "WT-hidden-assembler",
    status: "active",
    kind: "faction_conflict",
    sourceType: "faction_pressure",
    sourceId: "hidden",
    title: "SEALED_ASSEMBLER_THREAD",
    summary: "SEALED_ASSEMBLER_THREAD_SUMMARY",
    visibility: "hidden"
  });
  worldState.longTermEvents.queue.push({
    id: "LTE-hidden-assembler",
    key: "hidden_assembler",
    type: "court",
    status: "active",
    targetType: "world",
    title: "SEALED_ASSEMBLER_LONG_TERM",
    summary: "SEALED_ASSEMBLER_LONG_TERM_SUMMARY",
    severity: 3,
    durationMonths: 2,
    remainingMonths: 2,
    visibility: "hidden"
  });
  worldState.worldEntities.entities.push({
    id: "entity-hidden-assembler",
    category: "court",
    kind: "ministry",
    name: "SEALED_ASSEMBLER_ENTITY",
    visibility: "hidden",
    publicSummary: "SEALED_ASSEMBLER_ENTITY_SUMMARY",
    hiddenNotes: ["SEALED_ASSEMBLER_ENTITY_NOTE"]
  });
  worldState.worldEntities.entities.push({
    id: "entity-public-hidden-related-assembler",
    category: "local",
    kind: "local_gentry",
    name: "可见乡绅公议",
    status: "critical",
    visibility: "public",
    metrics: { influence: 80, pressure: 100, capacity: 20, trust: 35, deficit: 70 },
    publicSummary: "公开地方压力，不应暴露背后密使姓名。",
    related: { characters: ["C-hidden-assembler-related"], metrics: ["publicOrder"] },
    interventionHints: ["查访公开乡约"]
  });
  worldState.worldThreads.threads.push({
    id: "WT-public-hidden-related-assembler",
    status: "active",
    kind: "local_crisis",
    sourceType: "world_entity_pressure",
    sourceId: "entity-public-hidden-related-assembler",
    sourceLabel: "地方公议",
    title: "可见地方公议吃紧",
    summary: "地方公开压力升高。",
    severity: 3,
    visibility: "public",
    related: { characters: ["C-hidden-assembler-related"], metrics: ["publicOrder"] }
  });

  const serialized = JSON.stringify(assemblePromptContext(worldState, {
    task: "world_turn",
    playerAction: "在县学听闻边报"
  }));

  assert.doesNotMatch(serialized, /SEALED_ASSEMBLER/);
  assert.doesNotMatch(serialized, /SEALED_AUDIT_PAYLOAD/);
  assert.doesNotMatch(serialized, /city-hanseong/);
  assert.doesNotMatch(serialized, /jurisdiction-ministry-personnel-capital/);
  assert.match(serialized, /顾文衡|worldGeographyView/);
});

test("ranked retrieval context prioritizes action-matched geography and current official posting", () => {
  const worldState = createInitialState({ role: "official", playerName: "Posting Context Tester" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.bureauId = "ministry_revenue";

  const context = buildRankedRetrievalContext(worldState, {
    task: "official_career",
    playerAction: "核查户部主事任所、北京账册与京杭漕运北段"
  });
  const canalContext = buildRankedRetrievalContext(worldState, {
    task: "official_career",
    playerAction: "核查漕运账册"
  });
  const routes = context.geography.routes.map((route) => route.id);
  const offices = context.offices.offices.map((office) => office.id);
  const postings = context.offices.postings.map((posting) => posting.id);

  assert.equal(context.query.playerAction, "核查户部主事任所、北京账册与京杭漕运北段");
  assert.equal(routes[0], "route-grand-canal-north");
  assert.equal(canalContext.geography.routes[0].id, "route-grand-canal-north");
  assert.ok(canalContext.query.terms.includes("漕运"));
  assert.ok(offices.includes("ministry_revenue_principal"));
  assert.ok(postings.includes("posting-player-current"));
  assert.match(JSON.stringify(context.offices), /户部主事|北京/);
});

test("ranked retrieval context caps recent event summaries and ignores audit-shaped world state fields", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "Event Context Tester" });
  worldState.eventHistory = Array.from({ length: 10 }, (_, index) => `可见近事${index}`);
  worldState.eventHistory.push("prompt provider proposal event_log sk-proj-context-secret-123456");
  worldState.aiProposals = [{ summary: "SEALED_AI_PROPOSAL_PAYLOAD" }];

  const context = buildRankedRetrievalContext(worldState, {
    task: "local_magistrate",
    playerAction: "审理积案并安抚乡绅"
  });
  const serialized = JSON.stringify(context);

  assert.equal(context.events.recentEvents.length, 6);
  assert.ok(context.events.localDockets.length > 0);
  assert.ok(context.events.localDockets.every((docket) => docket.sourceView === "localAffairsDocketView.docket"));
  assert.match(JSON.stringify(context.events.localDockets), /刑名|水利|案牍|任所/);
  assert.deepEqual(
    context.events.recentEvents.map((event) => event.summary),
    ["可见近事9", "可见近事8", "可见近事7", "可见近事6", "可见近事5", "可见近事4"]
  );
  assert.ok(context.events.recentEvents.every((event) => event.sourceView === "eventArchiveView"));
  assert.doesNotMatch(serialized, /SEALED_AI_PROPOSAL_PAYLOAD/);
  assert.doesNotMatch(serialized, /sk-proj-context-secret/);
  assert.doesNotMatch(serialized, /event_log/);
});

test("ranked retrieval context includes capped military diplomacy reports for military roles", () => {
  const worldState = createInitialState({ role: "general", playerName: "Military Context Tester" });
  Object.assign(worldState, {
    borderThreat: 88,
    armyMorale: 36,
    grainReserve: 260,
    population: 7200
  });
  worldState.worldGeography.frontierZones.push({
    id: "frontier-hidden-context-s64",
    name: "SEALED_S64_CONTEXT_FRONTIER",
    countryId: "country-ming",
    neighborCountryId: "country-manchu-frontier",
    cityIds: ["city-beijing"],
    routeIds: ["route-shanhai-liaodong-pass"],
    pressure: 99,
    visibility: "hidden",
    publicSummary: "SEALED_S64_CONTEXT_SUMMARY prompt event_log sk-test-s64-context"
  });

  const context = buildRankedRetrievalContext(worldState, {
    task: "general_frontier",
    playerAction: "查问山海关、辽东粮道与邻国使节"
  });
  const serialized = JSON.stringify(context);

  assert.equal(context.events.militaryReports.length > 0, true);
  assert.ok(context.events.militaryReports.length <= 4);
  assert.ok(context.events.militaryReports.every((report) =>
    report.sourceView === "militaryDiplomacyView.report" &&
    report.authorityBoundary.includes("服务器")
  ));
  assert.match(serialized, /militaryDiplomacyView|山海关|粮道|服务器裁决/);
  assert.doesNotMatch(serialized, /SEALED_S64_CONTEXT/);
  assert.doesNotMatch(serialized, /sk-test-s64-context|event_log/);
});

test("ranked retrieval context includes capped economic fiscal reports for administrative roles", () => {
  const worldState = createInitialState({ role: "official", playerName: "Economic Context Tester" });
  Object.assign(worldState, {
    treasury: 260,
    grainReserve: 180,
    population: 7200,
    taxRate: 68,
    corruption: 88
  });
  worldState.worldGeography.routes.push({
    id: "route-hidden-context-s64-2",
    type: "canal",
    name: "SEALED_S64_2_CONTEXT_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-nanjing",
    risk: 99,
    visibility: "hidden",
    publicSummary: "SEALED_S64_2_CONTEXT_ROUTE prompt event_log sk-test-s64-2-context"
  });

  const context = buildRankedRetrievalContext(worldState, {
    task: "official_career",
    playerAction: "核查户部钱粮、北京粮价、盐漕与库银"
  });
  const serialized = JSON.stringify(context);

  assert.equal(context.events.economicReports.length > 0, true);
  assert.ok(context.events.economicReports.length <= 4);
  assert.ok(context.events.economicReports.every((report) =>
    report.sourceView === "economicFiscalView.report" &&
    report.authorityBoundary.includes("服务器")
  ));
  assert.match(serialized, /economicFiscalView|户部|粮价|盐漕|库银|服务器裁决/);
  assert.doesNotMatch(serialized, /SEALED_S64_2_CONTEXT/);
  assert.doesNotMatch(serialized, /sk-test-s64-2-context|event_log/);
});

test("ranked retrieval context includes capped S65 historical event chains from server projections", () => {
  const worldState = createInitialState({ role: "official", playerName: "Event Chain Context Tester" });
  Object.assign(worldState, {
    treasury: 240,
    grainReserve: 170,
    population: 7200,
    taxRate: 68,
    corruption: 88,
    publicOrder: 26
  });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  Object.assign(worldState.officialCareer, {
    currentPosting: "户部主事",
    bureauId: "ministry_revenue"
  });
  worldState.officialPostings.assessmentRecords.push({
    id: "assessment-s65-context-visible",
    postingId: "posting-player-current",
    officeId: "ministry_revenue_principal",
    bureauId: "ministry_revenue",
    holderType: "player",
    status: "pending",
    meritScore: 42,
    riskScore: 82,
    recommendation: "watch",
    publicFinding: "任所奏报牵连户部钱粮与弹劾风险。",
    publicSummary: "户部钱粮考成吃紧，需复核漕册。",
    visibility: "office_visible",
    knownToPlayer: true,
    date: { year: 1644, month: 1, tenDayPeriod: 1, turn: 9 },
    lastUpdatedTurn: 9
  });
  worldState.worldGeography.routes.push({
    id: "route-hidden-context-s65",
    type: "canal",
    name: "SEALED_S65_CONTEXT_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-nanjing",
    risk: 99,
    visibility: "hidden",
    publicSummary: "SEALED_S65_CONTEXT_ROUTE prompt provider event_log sk-test-s65-context"
  });

  const context = buildRankedRetrievalContext(worldState, {
    task: "official_career",
    playerAction: "核查户部钱粮、事件链和漕册因果"
  });
  const serialized = JSON.stringify(context);

  assert.equal(context.events.eventChains.length > 0, true);
  assert.ok(context.events.eventChains.length <= 4);
  assert.ok(context.events.eventChains.every((chain) =>
    chain.sourceView === "historicalEventArchiveView.chain" &&
    chain.authorityBoundary.includes("事件模板")
  ));
  assert.match(serialized, /historicalEventArchiveView|事件链|公共卷宗|服务器/);
  assert.doesNotMatch(serialized, /sealedProjection|server_only|密档/);
  assert.doesNotMatch(serialized, /SEALED_S65_CONTEXT/);
  assert.doesNotMatch(serialized, /sk-test-s65-context|event_log|provider|prompt/);
});

test("ranked retrieval context keeps local affairs dockets out of scholar view", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "Scholar Docket Tester" });
  const context = buildRankedRetrievalContext(worldState, {
    task: "world_turn",
    playerAction: "在县学听闻刑名与水利旧事"
  });

  assert.deepEqual(context.events.localDockets, []);
  assert.deepEqual(context.events.militaryReports, []);
  assert.deepEqual(context.events.economicReports, []);
  assert.deepEqual(context.events.eventChains, []);
  assert.match(JSON.stringify(context), /localAffairsDocketView/);
  assert.doesNotMatch(JSON.stringify(context), /钱粮奏销|刑名词讼|水利修防/);
});
