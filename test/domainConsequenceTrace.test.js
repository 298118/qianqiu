const test = require("node:test");
const assert = require("node:assert/strict");

const { buildClientWorldState, isForbiddenClientWorldStateKey } = require("../src/game/clientWorldState");
const { buildDomainConsequenceView } = require("../src/game/domainConsequenceTrace");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const { createInitialState } = require("../src/game/initialState");
const { ensureNpcEconomyLedgerState } = require("../src/game/npcEconomy");
const { buildResolverInputContext } = require("../src/game/resolverInputContext");
const { buildSafeSearchRows, searchSafeWorldIndex } = require("../src/game/safeWorldSearch");
const { buildTopicSurfaceView } = require("../src/game/topicSurfaceView");
const {
  buildPlayerMonthlyBriefingContext,
  generateMonthlyBriefingProposal
} = require("../src/game/playerMonthlyBriefing");
const { defineGameTurnResponse } = require("../src/routes/routeResponses");
const {
  buildWorldThreadView,
  ensureWorldThreadState
} = require("../src/game/worldThreads");

const sessionId = "00000000-0000-4000-8000-000000000886";

function seedDomainConsequences() {
  const worldState = createInitialState({ role: "magistrate", playerName: "后果追踪知县" });
  worldState.sessionId = sessionId;
  worldState.year = 1644;
  worldState.month = 3;
  worldState.tenDayPeriod = 2;
  worldState.turnCount = 42;
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "role-cycle:42:magistrate:market_regulation:market:grain:SEALED_SOURCE",
      policyType: "market_regulation",
      policyLabel: "平抑米价",
      status: "accepted",
      publicSummary: "县中平抑米价，粮商愿照牌价出售。",
      publicSourceId: "market:grain:public-source",
      stateDelta: { publicOrder: 4, treasury: -20 },
      playerDelta: { performanceMerit: 1 },
      resourceUse: { silver: 100 },
      evidenceRefs: ["market:grain:SEALED_SOURCE"],
      auditRecord: { rawSql: "select * from hidden_table" },
      appliedAtTurn: 42
    }, {
      outcomeId: "city-policy-polluted",
      policyType: "relief",
      policyLabel: "SEALED_CITY hiddenNotes rawSql",
      status: "accepted",
      publicSummary: "SEALED_CITY hiddenNotes rawSql /mnt/e/LSMNQ/data/sessions/secret.json",
      stateDelta: { publicOrder: 999 },
      appliedAtTurn: 42
    }, {
      outcomeId: "city-policy-internal-token",
      policyType: "relief",
      policyLabel: "内部字段污染",
      status: "accepted",
      publicSummary: "evidenceRefs: market:grain stateDelta publicOrder auditRecord outcomeId",
      stateDelta: { publicOrder: 999 },
      appliedAtTurn: 42
    }]
  };
  worldState.militaryDiplomacyLedger = {
    records: [{
      outcomeId: "military:42:resupply:frontier:sealed",
      resolverKind: "military",
      actionKind: "resupply",
      actionLabel: "调拨粮饷",
      status: "accepted",
      publicResolution: { summary: "边镇据粮道材料调拨粮饷，军心稍稳。" },
      stateDelta: { grainReserve: -40, armyMorale: 3 },
      playerDelta: { supply: 4, campaignRisk: -1 },
      resourceCost: { grain: 40 },
      evidenceRefs: ["military:frontier:SEALED_SOURCE"],
      appliedAtTurn: 43
    }]
  };
  worldState.judicialCaseLedger = {
    records: [{
      outcomeId: "judicial:42:mediate:case-local-secret",
      caseId: "case-local-secret",
      caseAction: "mediate",
      actionLabel: "堂上调停",
      status: "accepted",
      publicDocket: { summary: "堂上调停邻里田界词讼，暂息争端。" },
      stateDelta: { publicOrder: 3 },
      playerDelta: { pendingLawsuits: -2 },
      relationshipSignals: [{ actorId: "npc:hidden", delta: -5 }],
      evidenceRefs: ["local_docket:SEALED_CASE"],
      auditRecord: { rawSql: "update world_sessions" },
      appliedAtTurn: 44
    }]
  };
  const npcEconomyLedger = ensureNpcEconomyLedgerState(worldState);
  npcEconomyLedger.lastTickTurn = 45;
  npcEconomyLedger.lastMonthlyPeriodKey = "1644-03";
  npcEconomyLedger.recentEvents = [
    "韩绅田庄按月入账，佃户欠粮暂记。",
    "SEALED_NPC privateSignalTags rawLedger /mnt/e/LSMNQ/data/sessions/secret.json"
  ];
  return worldState;
}

function assertNoInternalConsequenceLeak(value) {
  const payload = JSON.stringify(value);
  assert.doesNotMatch(
    payload,
    /cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|"affectedMetrics"|stateDelta|playerDelta|resourceUse|resourceCost|relationshipSignals|privateSignalTags|private_signal_tags|privateResultRefs|hiddenDossier|sealedMapping|retrievalContext|actorMemoryLedger|sessionSummary|relationshipLedger|providerPayload|rawEvidence|evidenceRefs|auditRecord|outcomeId|rawSql|SEALED_|market:grain|case-local-secret|role-cycle:|"path"|"publicOrder"|"grainReserve"|"armyMorale"|"pendingLawsuits"|"campaignRisk"|"performanceMerit"|"supply"/
  );
}

function assertNoInternalConsequenceValueLeak(value) {
  const payload = JSON.stringify(value);
  assert.doesNotMatch(
    payload,
    /cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|"affectedMetrics"|stateDelta|playerDelta|resourceUse|resourceCost|relationshipSignals|privateSignalTags|private_signal_tags|privateResultRefs|hiddenDossier|sealedMapping|retrievalContext|actorMemoryLedger|sessionSummary|relationshipLedger|providerPayload|rawEvidence|auditRecord|outcomeId|rawSql|SEALED_|market:grain|case-local-secret|role-cycle:|"path"|"publicOrder"|"grainReserve"|"armyMorale"|"pendingLawsuits"|"campaignRisk"|"performanceMerit"|"supply"/
  );
}

function makeHighVolumeConsequenceRecord(sourceType, index, turnBase) {
  const titlePrefix = {
    city_policy: "地方高量后果",
    military_diplomacy: "军务高量后果",
    judicial_case: "刑名高量后果"
  }[sourceType] || "领域高量后果";
  const title = `${titlePrefix}${index}`;
  return {
    outcomeId: `${sourceType}-cross-view-cap-${index}`,
    policyType: "market_regulation",
    policyLabel: title,
    resolverKind: sourceType === "military_diplomacy" ? "military" : undefined,
    actionKind: sourceType === "military_diplomacy" ? "resupply" : undefined,
    actionLabel: title,
    caseAction: sourceType === "judicial_case" ? "mediate" : undefined,
    status: "accepted",
    publicSummary: `${title}进入跨视图 cap 压力回归，供舆图、史册、专题和安全检索追踪。`,
    stateDelta: sourceType === "military_diplomacy"
      ? { armyMorale: index % 2, borderThreat: -1 }
      : { publicOrder: index % 3 },
    playerDelta: sourceType === "military_diplomacy"
      ? { supply: 1 }
      : { performanceMerit: 1 },
    appliedAtTurn: turnBase + index
  };
}

function seedHighVolumeDomainConsequences(role = "official") {
  const worldState = createInitialState({ role, playerName: "跨视图高量" });
  worldState.sessionId = sessionId;
  worldState.turnCount = 120;
  worldState.cityPolicyLedger = {
    records: Array.from({ length: 6 }, (_, index) =>
      makeHighVolumeConsequenceRecord("city_policy", index + 1, 70)
    )
  };
  worldState.militaryDiplomacyLedger = {
    records: Array.from({ length: 6 }, (_, index) =>
      makeHighVolumeConsequenceRecord("military_diplomacy", index + 1, 80)
    )
  };
  worldState.judicialCaseLedger = {
    records: Array.from({ length: 6 }, (_, index) =>
      makeHighVolumeConsequenceRecord("judicial_case", index + 1, 90)
    )
  };
  ensureNpcEconomyLedgerState(worldState).recentEvents = [];
  return worldState;
}

test("S88.6 domain consequence view projects public traces without resolver internals", () => {
  const worldState = seedDomainConsequences();
  worldState.player.role = "emperor";
  const view = buildDomainConsequenceView(worldState);

  assert.equal(view.active, true);
  assert.equal(view.counts.city_policy, 1);
  assert.equal(view.counts.military_diplomacy, 1);
  assert.equal(view.counts.judicial_case, 1);
  assert.equal(view.counts.npc_economy, 1);
  assert.ok(view.recentConsequences.some((item) => item.sourceType === "city_policy"));
  assert.ok(view.recentConsequences.some((item) => item.sourceType === "judicial_case"));
  assert.ok(view.recentConsequences.some((item) => item.sourceType === "npc_economy"));
  assert.ok(view.recentConsequences.every((item) => !item.sourceId.includes("SEALED_SOURCE")));
  assert.ok(view.recentConsequences.flatMap((item) => item.affectedMetricLabels).includes("民心"));
  assertNoInternalConsequenceLeak(view);
});

test("S88.6 domain consequence view filters consequences by current role before downstream consumers", () => {
  const expectedByRole = new Map([
    ["scholar", []],
    ["magistrate", ["city_policy", "judicial_case", "npc_economy"]],
    ["general", ["military_diplomacy"]],
    ["official", ["city_policy", "military_diplomacy", "judicial_case", "npc_economy"]],
    ["minister", ["city_policy", "military_diplomacy", "judicial_case", "npc_economy"]],
    ["emperor", ["city_policy", "military_diplomacy", "judicial_case", "npc_economy"]]
  ]);

  for (const [role, expectedTypes] of expectedByRole.entries()) {
    const worldState = seedDomainConsequences();
    worldState.player.role = role;
    const view = buildDomainConsequenceView(worldState);
    const visibleTypes = view.recentConsequences.map((item) => item.sourceType).sort();

    assert.deepEqual(visibleTypes, expectedTypes.slice().sort(), role);
    assert.equal(view.roleVisibility.viewerRole, role);
    assert.deepEqual(view.roleVisibility.visibleSourceTypes, expectedTypes);
    assert.equal(view.caps.publicCandidates, expectedTypes.length);
    assert.equal(view.caps.roleEligibleCandidates, expectedTypes.length);
    assert.equal(view.caps.visibleConsequences, expectedTypes.length);
    assert.equal(view.caps.roleLimited, expectedTypes.length < 4);
    assert.equal(view.nextActions.every((action) =>
      view.recentConsequences.some((item) => action.id.includes(item.id))
    ), true);
    assertNoInternalConsequenceLeak(view);
  }
});

test("S88.6 role-limited domain consequences do not leak through archive, resolver input, or safe search", () => {
  const scholarState = seedDomainConsequences();
  scholarState.player.role = "scholar";
  const scholarView = buildDomainConsequenceView(scholarState);
  const scholarArchive = buildEventArchiveView(scholarState, { pageSize: 50 });
  const scholarResolverContext = buildResolverInputContext(scholarState);
  const scholarSearchRows = buildSafeSearchRows(scholarState);

  assert.equal(scholarView.active, false);
  assert.equal(scholarView.recentConsequences.length, 0);
  assert.equal(scholarArchive.items.some((item) => item.sourceType === "domain_consequence"), false);
  assert.equal(scholarResolverContext.events.some((item) => item.sourceView === "domainConsequenceView"), false);
  assert.equal(scholarSearchRows.some((row) => row.sourceView === "domainConsequenceView.recentConsequences"), false);

  const generalState = seedDomainConsequences();
  generalState.player.role = "general";
  const generalView = buildDomainConsequenceView(generalState);
  const generalArchive = buildEventArchiveView(generalState, { pageSize: 50 });
  const generalResolverContext = buildResolverInputContext(generalState);
  const generalSearchRows = buildSafeSearchRows(generalState);

  assert.deepEqual(generalView.recentConsequences.map((item) => item.sourceType), ["military_diplomacy"]);
  assert.equal(generalArchive.items.some((item) => item.sourceType === "domain_consequence" && item.kind !== "military_diplomacy"), false);
  assert.equal(generalResolverContext.events.some((item) =>
    item.sourceView === "domainConsequenceView" && !/军务|边镇|粮道/.test(`${item.label}${item.summary}`)
  ), false);
  assert.equal(generalSearchRows.some((row) =>
    row.sourceView === "domainConsequenceView.recentConsequences" && !/军务|边镇|粮道/.test(`${row.title}${row.searchText}`)
  ), false);
  assertNoInternalConsequenceLeak({
    scholarView,
    scholarDomainArchiveItems: scholarArchive.items.filter((item) => item.sourceType === "domain_consequence"),
    scholarDomainResolverItems: scholarResolverContext.events.filter((item) => item.sourceView === "domainConsequenceView"),
    scholarDomainSearchRows: scholarSearchRows.filter((row) => row.sourceView === "domainConsequenceView.recentConsequences"),
    generalView,
    generalDomainArchiveItems: generalArchive.items.filter((item) => item.sourceType === "domain_consequence"),
    generalDomainResolverItems: generalResolverContext.events.filter((item) => item.sourceView === "domainConsequenceView"),
    generalDomainSearchRows: generalSearchRows.filter((row) => row.sourceView === "domainConsequenceView.recentConsequences")
  });
});

test("S88.6 domain consequence view dedupes public source replay rows and drops private signal pollution", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "去重知县" });
  worldState.sessionId = sessionId;
  worldState.turnCount = 12;
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "legacy-market-case-old",
      policyType: "market_regulation",
      policyLabel: "平抑米价",
      status: "accepted",
      publicSummary: "清河县平抑米价后，米铺照牌价出售。",
      publicSourceId: "market:grain:public-source",
      stateDelta: { publicOrder: 1 },
      appliedAtTurn: 9
    }, {
      outcomeId: "legacy-market-case-replayed",
      policyType: "market_regulation",
      policyLabel: "平抑米价",
      status: "accepted",
      publicSummary: "清河县平抑米价后，仓米照牌价出售。",
      publicSourceId: "market:grain:public-source",
      stateDelta: { publicOrder: 2, treasury: -5 },
      appliedAtTurn: 12
    }, {
      outcomeId: "legacy-private-signal",
      policyType: "gentry_warning",
      policyLabel: "士绅密报",
      status: "accepted",
      publicSummary: "privateSignalTags gentryBribe should never become public consequence",
      stateDelta: { publicOrder: 1 },
      appliedAtTurn: 12
    }]
  };

  const view = buildDomainConsequenceView(worldState);
  const cityConsequences = view.recentConsequences.filter((item) => item.sourceType === "city_policy");

  assert.equal(cityConsequences.length, 1);
  assert.equal(cityConsequences[0].generatedAtTurn, 12);
  assert.match(cityConsequences[0].publicSummary, /仓米照牌价/);
  assert.deepEqual(cityConsequences[0].affectedMetricLabels, ["民心", "府库"]);
  assert.equal(view.counts.city_policy, 1);
  assertNoInternalConsequenceLeak(view);
  assert.doesNotMatch(JSON.stringify(view), /gentryBribe|legacy-market-case-old|legacy-market-case-replayed/);
});

test("S88.6 domain consequence view rejects unapplied statuses, sensitive aliases, and configured secrets", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "污染知县" });
  const previousSecret = process.env.DOMAIN_CONSEQUENCE_TEST_SECRET;
  process.env.DOMAIN_CONSEQUENCE_TEST_SECRET = "domain-secret-value-12345";

  try {
    worldState.sessionId = sessionId;
    worldState.turnCount = 16;
    worldState.cityPolicyLedger = {
      records: [{
        outcomeId: "pending-safe-summary",
        policyType: "relief",
        policyLabel: "缓征仓粮",
        status: "pending",
        publicSummary: "县中拟缓征仓粮，尚待服务器裁决。",
        stateDelta: { publicOrder: 2 },
        appliedAtTurn: 16
      }, {
        outcomeId: "rejected-safe-summary",
        policyType: "market_regulation",
        policyLabel: "禁闭米铺",
        status: "rejected",
        publicSummary: "县中禁闭米铺被驳回，不应成为已公开后果。",
        stateDelta: { publicOrder: -2 },
        appliedAtTurn: 16
      }, {
        outcomeId: "accepted-alias-pollution",
        policyType: "gentry_warning",
        policyLabel: "旧存档污染",
        status: "accepted",
        publicSummary: "providerPayload rawEvidence privateResultRefs hiddenDossier sealedMapping retrievalContext actorMemoryLedger sessionSummary relationshipLedger",
        stateDelta: { publicOrder: 1 },
        appliedAtTurn: 16
      }, {
        outcomeId: "accepted-secret-pollution",
        policyType: "relief",
        policyLabel: "密钥污染",
        status: "accepted",
        publicSummary: "县中公示包含 domain-secret-value-12345 的旧存档污染。",
        stateDelta: { publicOrder: 1 },
        appliedAtTurn: 16
      }]
    };

    const view = buildDomainConsequenceView(worldState);

    assert.equal(view.active, false);
    assert.equal(view.counts.city_policy, 0);
    assert.equal(view.recentConsequences.length, 0);
    assertNoInternalConsequenceLeak(view);
    assert.doesNotMatch(
      JSON.stringify(view),
      /pending-safe-summary|rejected-safe-summary|accepted-alias-pollution|accepted-secret-pollution|domain-secret-value|旧存档污染/
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.DOMAIN_CONSEQUENCE_TEST_SECRET;
    } else {
      process.env.DOMAIN_CONSEQUENCE_TEST_SECRET = previousSecret;
    }
  }
});

test("S88.6 domain consequence high-volume cap keeps valid rows behind polluted tails", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "高量知县" });
  worldState.sessionId = sessionId;
  worldState.turnCount = 80;
  worldState.cityPolicyLedger = {
    records: [
      {
        outcomeId: "city-valid-behind-tail",
        policyType: "market_regulation",
        policyLabel: "稳价旧案",
        status: "accepted",
        publicSummary: "城中稳价旧案仍有公开后果可追踪。",
        stateDelta: { publicOrder: 2 },
        appliedAtTurn: 70
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        outcomeId: `city-tail-pending-${index}`,
        policyType: "relief",
        policyLabel: "尾部拟议",
        status: index % 2 ? "pending" : "rejected",
        publicSummary: "尾部拟议尚未成为公开后果。",
        stateDelta: { publicOrder: 1 },
        appliedAtTurn: 71 + index
      })),
      {
        outcomeId: "city-tail-polluted",
        policyType: "relief",
        policyLabel: "尾部污染",
        status: "accepted",
        publicSummary: "providerPayload rawEvidence privateResultRefs hiddenDossier",
        stateDelta: { publicOrder: 1 },
        appliedAtTurn: 80
      }
    ]
  };

  const view = buildDomainConsequenceView(worldState);

  assert.equal(view.active, true);
  assert.equal(view.counts.city_policy, 1);
  assert.ok(view.recentConsequences.some((item) => item.title === "稳价旧案"));
  assertNoInternalConsequenceLeak(view);
  assert.doesNotMatch(JSON.stringify(view), /city-tail-pending|city-tail-polluted|尾部拟议|尾部污染/);
});

test("S88.6 domain consequence source cap keeps newest applied rows from out-of-order legacy ledgers", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "乱序知县" });
  worldState.sessionId = sessionId;
  worldState.turnCount = 100;
  worldState.cityPolicyLedger = {
    records: [
      {
        outcomeId: "city-newest-out-of-order",
        policyType: "market_regulation",
        policyLabel: "乱序新案",
        status: "accepted",
        publicSummary: "乱序旧账中最新稳价后果仍应进入公开追踪。",
        stateDelta: { publicOrder: 4 },
        appliedAtTurn: 99
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        outcomeId: `city-older-out-of-order-${index}`,
        policyType: "relief",
        policyLabel: `旧案${index}`,
        status: "accepted",
        publicSummary: `旧账第${index}条公开后果。`,
        stateDelta: { publicOrder: 1 },
        appliedAtTurn: 10 + index
      }))
    ]
  };

  const view = buildDomainConsequenceView(worldState);
  const cityConsequences = view.recentConsequences.filter((item) => item.sourceType === "city_policy");

  assert.equal(cityConsequences.length, 4);
  assert.ok(cityConsequences.some((item) => item.title === "乱序新案"));
  assert.ok(cityConsequences.every((item) => item.generatedAtTurn >= 11));
  assertNoInternalConsequenceLeak(view);
});

test("S88.6 domain consequence view exposes safe cap metadata under high volume", () => {
  const worldState = createInitialState({ role: "emperor", playerName: "高量御览" });
  worldState.sessionId = sessionId;
  worldState.turnCount = 90;
  const makeRecord = (source, index) => ({
    outcomeId: `${source}-high-volume-${index}`,
    policyType: "market_regulation",
    policyLabel: `${source}后果${index}`,
    actionKind: "resupply",
    actionLabel: `${source}后果${index}`,
    caseAction: "mediate",
    status: "accepted",
    publicSummary: `${source}公开后果第${index}条，供史册与舆图追踪。`,
    stateDelta: { publicOrder: index % 3, armyMorale: index % 2 },
    playerDelta: { performanceMerit: 1 },
    appliedAtTurn: 70 + index
  });
  worldState.cityPolicyLedger = { records: Array.from({ length: 6 }, (_, index) => makeRecord("city", index + 1)) };
  worldState.militaryDiplomacyLedger = { records: Array.from({ length: 6 }, (_, index) => makeRecord("military", index + 1)) };
  worldState.judicialCaseLedger = { records: Array.from({ length: 6 }, (_, index) => makeRecord("judicial", index + 1)) };
  ensureNpcEconomyLedgerState(worldState).recentEvents = [];

  const view = buildDomainConsequenceView(worldState);
  const archiveView = buildEventArchiveView(worldState, { pageSize: 50 });

  assert.equal(view.recentConsequences.length, 8);
  assert.equal(view.caps.recentConsequences, 8);
  assert.equal(view.caps.sourceRowsPerLedger, 4);
  assert.equal(view.caps.publicCandidates, 12);
  assert.equal(view.caps.visibleConsequences, 8);
  assert.equal(view.caps.capped, true);
  assert.ok(view.trackingEntryPoints.some((entry) => entry.targetRouteId === "map"));
  assert.ok(view.trackingEntryPoints.some((entry) => entry.targetRouteId === "archive"));
  assert.equal(archiveView.counts.domain_consequence, 6);
  assert.equal(
    archiveView.items.filter((item) => item.sourceType === "domain_consequence").length,
    6
  );
  assertNoInternalConsequenceLeak(view);
  assertNoInternalConsequenceLeak(archiveView.items.filter((item) => item.sourceType === "domain_consequence"));
});

test("S88.6 high-volume domain consequences stay capped consistently across downstream views", () => {
  const worldState = seedHighVolumeDomainConsequences("official");
  const view = buildDomainConsequenceView(worldState);
  const visibleIds = new Set(view.recentConsequences.map((item) => item.id));
  const visibleTitles = new Set(view.recentConsequences.map((item) => item.title));
  const noisyCities = Array.from({ length: 1300 }, (_, index) => ({
    id: `city-domain-cap-noise-${index}`,
    countryId: "country-ming",
    name: `跨视图噪声城${index}`,
    visibility: "public",
    publicSummary: `跨视图噪声 ${index}`,
    intelConfidence: 50
  }));
  const noiseViews = {
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

  const archiveView = buildEventArchiveView(worldState, { pageSize: 50 });
  const resolverContext = buildResolverInputContext(worldState);
  const topicSurface = buildTopicSurfaceView(worldState, { surfaceId: "war-council" });
  const safeRows = buildSafeSearchRows(worldState, { views: noiseViews });
  const searchView = searchSafeWorldIndex(worldState, {
    query: "刑名高量后果6",
    domain: "events",
    pageSize: 5,
    views: noiseViews
  });
  const archiveDomainItems = archiveView.items.filter((item) => item.sourceType === "domain_consequence");
  const resolverDomainItems = resolverContext.events.filter((item) => item.sourceView === "domainConsequenceView");
  const topicDomainItems = topicSurface.evidenceRefs.filter((item) => item.sourceView === "domainConsequenceView");
  const safeDomainRows = safeRows.filter((row) => row.sourceView === "domainConsequenceView.recentConsequences");
  const downstream = {
    archiveDomainItems,
    resolverDomainItems,
    topicDomainItems,
    safeDomainRows,
    searchView
  };

  assert.equal(view.recentConsequences.length, 8);
  assert.equal(view.caps.publicCandidates, 12);
  assert.equal(view.caps.visibleConsequences, 8);
  assert.equal(view.caps.capped, true);
  assert.equal(view.recentConsequences.some((item) => item.sourceType === "city_policy"), false);
  assert.ok(archiveDomainItems.length <= 6);
  assert.equal(resolverDomainItems.length > 0, true);
  assert.equal(topicDomainItems.length > 0, true);
  assert.equal(safeDomainRows.length, 8);
  assert.ok(archiveDomainItems.every((item) => visibleTitles.has(item.title)));
  assert.ok(resolverDomainItems.every((item) => visibleTitles.has(item.label)));
  assert.ok(topicDomainItems.every((item) => visibleTitles.has(item.label)));
  assert.deepEqual(new Set(safeDomainRows.map((row) => row.sourceId)), visibleIds);
  assert.equal(safeRows.length, 1200);
  assert.ok(searchView.results.some((result) =>
    result.sourceView === "domainConsequenceView.recentConsequences" && /刑名高量后果6/.test(`${result.title}${result.snippet}`)
  ));
  assertNoInternalConsequenceLeak(view);
  assertNoInternalConsequenceLeak(downstream);
  assert.doesNotMatch(
    JSON.stringify(downstream),
    /地方高量后果|军务高量后果[12]|刑名高量后果[12]|cross-view-cap/
  );
});

test("S88.6 role-limited high-volume consequences keep downstream caps from exposing hidden domains", () => {
  const generalState = seedHighVolumeDomainConsequences("general");
  const view = buildDomainConsequenceView(generalState);
  const archiveView = buildEventArchiveView(generalState, { pageSize: 50 });
  const resolverContext = buildResolverInputContext(generalState);
  const topicSurface = buildTopicSurfaceView(generalState, { surfaceId: "war-council" });
  const safeRows = buildSafeSearchRows(generalState);
  const downstream = {
    archiveDomainItems: archiveView.items.filter((item) => item.sourceType === "domain_consequence"),
    resolverDomainItems: resolverContext.events.filter((item) => item.sourceView === "domainConsequenceView"),
    topicDomainItems: topicSurface.evidenceRefs.filter((item) => item.sourceView === "domainConsequenceView"),
    safeDomainRows: safeRows.filter((row) => row.sourceView === "domainConsequenceView.recentConsequences")
  };

  assert.equal(view.recentConsequences.length, 4);
  assert.equal(view.caps.publicCandidates, 4);
  assert.equal(view.caps.roleEligibleCandidates, 4);
  assert.equal(view.caps.visibleConsequences, 4);
  assert.equal(view.caps.roleLimited, true);
  assert.deepEqual([...new Set(view.recentConsequences.map((item) => item.sourceType))], ["military_diplomacy"]);
  assert.equal(downstream.archiveDomainItems.length > 0, true);
  assert.equal(downstream.resolverDomainItems.length > 0, true);
  assert.equal(downstream.topicDomainItems.length > 0, true);
  assert.equal(downstream.safeDomainRows.length, 4);
  assert.equal(downstream.archiveDomainItems.every((item) => /军务高量后果/.test(`${item.title}${item.summary}`)), true);
  assert.equal(downstream.resolverDomainItems.every((item) => /军务高量后果/.test(`${item.label}${item.summary}`)), true);
  assert.equal(downstream.topicDomainItems.every((item) => /军务高量后果/.test(`${item.label}${item.summary}`)), true);
  assert.equal(downstream.safeDomainRows.every((item) => /军务高量后果/.test(`${item.title}${item.searchText}`)), true);
  assertNoInternalConsequenceLeak({ view, downstream });
  assert.doesNotMatch(JSON.stringify({ view, downstream }), /地方高量后果|刑名高量后果/);
});

test("S88.6 public consequence refs feed archive, world thread, and monthly briefing", () => {
  const worldState = seedDomainConsequences();
  ensureWorldThreadState(worldState);

  const archiveView = buildEventArchiveView(worldState, { pageSize: 50 });
  const worldThreadView = buildWorldThreadView(worldState);
  const monthlyContext = buildPlayerMonthlyBriefingContext(worldState);
  const monthlyProposal = generateMonthlyBriefingProposal(monthlyContext);

  assert.ok(archiveView.items.some((item) => item.sourceType === "domain_consequence"));
  assert.ok(worldThreadView.activeThreads.some((thread) => thread.sourceType === "domain_consequence"));
  assert.ok(monthlyContext.sourceRefs.some((ref) => ref.source === "domain_consequence"));
  assert.ok(monthlyProposal.actionItems.some((item) => /追踪|月账|月报/.test(item)));
  assertNoInternalConsequenceLeak(
    archiveView.items.filter((item) => item.sourceType === "domain_consequence")
  );
  assertNoInternalConsequenceLeak(
    worldThreadView.activeThreads.filter((thread) => thread.sourceType === "domain_consequence")
  );
  assertNoInternalConsequenceLeak(monthlyContext.domainConsequenceView);
  assertNoInternalConsequenceLeak(monthlyProposal.sourceRefs.filter((ref) => ref.source === "domain_consequence"));
});

test("S88.6 public consequence refs feed topic evidence and safe search", () => {
  const worldState = seedDomainConsequences();
  const resolverContext = buildResolverInputContext(worldState, {
    generatedAt: "2026-05-21T00:00:00.000Z"
  });
  const trialSurface = buildTopicSurfaceView(worldState, { surfaceId: "trial" });
  const safeSearchRows = buildSafeSearchRows(worldState);
  const searchView = searchSafeWorldIndex(worldState, {
    query: "平抑米价",
    domain: "events",
    pageSize: 5
  });

  assert.ok(resolverContext.sourceViews.some((source) => source.sourceView === "domainConsequenceView"));
  assert.ok(resolverContext.events.some((item) =>
    item.sourceView === "domainConsequenceView" && /平抑米价|堂上调停/.test(`${item.label}${item.summary}`)
  ));
  assert.ok(trialSurface.sourceViews.some((source) => source.sourceView === "domainConsequenceView"));
  assert.ok(trialSurface.evidenceRefs.some((ref) =>
    ref.sourceView === "domainConsequenceView" && /平抑米价|堂上调停/.test(`${ref.label}${ref.summary}`)
  ));
  assert.ok(safeSearchRows.some((row) =>
    row.sourceView === "domainConsequenceView.recentConsequences" && /平抑米价/.test(`${row.title}${row.searchText}`)
  ));
  assert.ok(searchView.results.some((result) =>
    result.sourceView === "domainConsequenceView.recentConsequences" && /平抑米价/.test(`${result.title}${result.snippet}`)
  ));
  assertNoInternalConsequenceLeak(resolverContext.events.filter((item) => item.sourceView === "domainConsequenceView"));
  assertNoInternalConsequenceValueLeak(trialSurface);
  assertNoInternalConsequenceLeak(searchView);
});

test("S88.6 judicial case ledger is forbidden in public worldState helpers", () => {
  const worldState = seedDomainConsequences();
  const clientState = buildClientWorldState(worldState);

  assert.equal(isForbiddenClientWorldStateKey("judicialCaseLedger"), true);
  assert.equal(clientState.judicialCaseLedger, undefined);
  assert.throws(
    () => defineGameTurnResponse({
      sessionId,
      worldState: {
        sessionId,
        judicialCaseLedger: { records: [] }
      }
    }),
    /judicialCaseLedger/
  );
});
