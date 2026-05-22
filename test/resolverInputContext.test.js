const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { isBuiltin } = require("node:module");

const {
  buildResolverInputContext,
  createResolverEvidenceRefs,
  filterResolverInputForActor,
  summarizeResolverInputForAudit
} = require("../src/game/resolverInputContext");
const { buildEconomyTraceView } = require("../src/game/economyTraceView");
const {
  RESOLVER_INPUT_DOMAIN_CONFIG,
  RESOLVER_INPUT_GLOBAL_CAPS,
  RESOLVER_INPUT_SCHEMA_VERSION
} = require("../src/game/resolverInputConfig");
const {
  createCanaryPollutedWorldState,
  createWorldContentFixture
} = require("../src/game/worldContentFixtures");
const { createInitialState } = require("../src/game/initialState");
const {
  buildNpcActiveRequestView,
  createNpcActiveRequest,
  resolveNpcActiveRequest,
  runNpcActiveRequestStep
} = require("../src/game/npcActiveRequests");
const { buildWorldThreadView, ensureWorldThreadState } = require("../src/game/worldThreads");
const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");

const dataDir = path.join(__dirname, "..", "data");
const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");
const FIXED_GENERATED_AT = "2026-05-13T00:00:00.000Z";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function removeSqliteArtifacts(dbPath) {
  await Promise.all(
    [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
}

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true });
  const entries = await fs.readdir(sessionsDir).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith(`${sessionId}.`) && entry.endsWith(".tmp"))
      .map((entry) => fs.rm(path.join(sessionsDir, entry), { force: true }))
  );
}

function evidenceCount(context) {
  return createResolverEvidenceRefs(context).length;
}

test("S71.1 resolver input context builds capped evidence from server views", () => {
  const fixture = createWorldContentFixture({ size: "small", seed: "resolver-input-basic" });
  const context = buildResolverInputContext(fixture.worldState, { generatedAt: FIXED_GENERATED_AT });
  const refs = createResolverEvidenceRefs(context);

  assert.equal(context.schemaVersion, RESOLVER_INPUT_SCHEMA_VERSION);
  assert.equal(context.sessionId, "redacted");
  assert.equal(context.safety.localOnly, true);
  assert.equal(context.safety.aiCannotWriteDatabase, true);
  assert.equal(context.safety.hiddenNotBackfilledToStateRoute, true);
  assert.ok(context.geography.length > 0);
  assert.ok(context.people.length > 0);
  assert.ok(context.offices.length > 0);
  assert.ok(context.events.length > 0);
  assert.ok(context.map.length > 0);
  assert.ok(refs.length > 0);
  assert.ok(context.sourceViews.some((source) => source.sourceView === "worldGeographyView"));
  assert.ok(context.sourceViews.some((source) => source.sourceView === "officialPostingsView"));

  for (const ref of refs) {
    assert.ok(ref.refId.startsWith(`evidence:${ref.domain}:`));
    assert.ok(ref.sourceView.endsWith("View") || ref.sourceView === "playerStateSafeProjection");
    assert.ok(ref.sourceId);
    assert.ok(["public", "player_visible", "role_visible"].includes(ref.visibility));
    assert.equal(ref.confidence >= 0 && ref.confidence <= 1, true);
    assert.equal(Array.isArray(ref.relatedRefs), true);
    assert.equal(Array.isArray(ref.scopeRefs), true);
  }
});

test("S71.1 resolver input context filters domains by actor visibility profile", () => {
  const fixture = createWorldContentFixture({ size: "small", seed: "resolver-input-actor" });
  const context = buildResolverInputContext(fixture.worldState, { generatedAt: FIXED_GENERATED_AT });
  const filtered = filterResolverInputForActor(context, {
    actorId: "npc:local-reader",
    actorType: "gentry",
    authorityTier: "T2",
    visibilityProfile: {
      readDomains: ["people", "events"]
    },
    jurisdictionRefs: [],
    allowedToolGroups: ["world_read"],
    forbiddenToolGroups: ["military", "diplomacy"]
  });

  assert.ok(filtered.people.length > 0);
  assert.ok(filtered.events.length > 0);
  assert.equal(filtered.economy.length, 0);
  assert.equal(filtered.military.length, 0);
  assert.equal(filtered.offices.length, 0);
  assert.equal(filtered.identity.actorId, "npc:local-reader");
  assert.deepEqual(
    filtered.sourceViews.map((source) => source.domain).sort().filter((value, index, source) => source.indexOf(value) === index),
    ["events", "memory", "people"].filter((domain) => filtered[domain]?.length).sort()
  );

  const failClosed = filterResolverInputForActor(context, {
    actorId: "npc:unknown-reader",
    actorType: "gentry",
    authorityTier: "T2",
    visibilityProfile: {
      readDomains: ["typo_domain"]
    }
  });
  for (const domain of Object.keys(RESOLVER_INPUT_DOMAIN_CONFIG)) {
    assert.equal(failClosed[domain].length, 0, `${domain} should fail closed for unknown readDomains`);
  }
  assert.deepEqual(failClosed.sourceViews, []);
});

test("S71.1 resolver input context strips hidden canaries and raw source tokens", () => {
  const fixture = createWorldContentFixture({ size: "small", seed: "resolver-input-redaction" });
  const polluted = createCanaryPollutedWorldState(fixture);
  const context = buildResolverInputContext(polluted, { generatedAt: FIXED_GENERATED_AT });
  const audit = summarizeResolverInputForAudit(context);
  const serialized = JSON.stringify({ context, audit });

  assert.doesNotMatch(serialized, /S60_PRIVATE_|SEALED_|sk-s60-private-canary-token/);
  assert.doesNotMatch(serialized, /prompt_retrieval_index|event_log|ai_change_proposals|world_state_json/);
  assert.doesNotMatch(serialized, /data\/sessions|file:\/\//);
  assert.equal(audit.safety.localOnly, true);
  assert.equal(audit.safety.aiCannotWriteDatabase, true);
  assert.equal(audit.totalEvidenceRefs, evidenceCount(context));
});

test("S71.1 resolver input context rejects explicitly polluted extra evidence", () => {
  const fixture = createWorldContentFixture({ size: "small", seed: "resolver-input-polluted-extra" });
  assert.throws(
    () => buildResolverInputContext(fixture.worldState, {
      generatedAt: FIXED_GENERATED_AT,
      extraEvidence: [{
        refId: "evidence:events:bad",
        sourceView: "eventArchiveView",
        sourceId: "bad",
        domain: "events",
        visibility: "public",
        confidence: 0.5,
        label: "污染证据",
        summary: "prompt_retrieval_index event_log file:///home/user/.env",
        relatedRefs: [],
        scopeRefs: [],
        generatedAtTurn: 0
      }]
    }),
    /forbidden source text/
  );
});

test("S71.1 resolver input context rejects source spoofing and drops hidden visibility", () => {
  const fixture = createWorldContentFixture({ size: "small", seed: "resolver-input-source-spoof" });
  assert.throws(
    () => buildResolverInputContext(fixture.worldState, {
      generatedAt: FIXED_GENERATED_AT,
      extraEvidence: [{
        refId: "evidence:events:raw-spoof",
        sourceView: "rawTableView",
        sourceId: "raw-spoof",
        domain: "events",
        visibility: "public",
        confidence: 0.5,
        label: "伪造来源",
        summary: "看似公开的伪造来源。",
        relatedRefs: [],
        scopeRefs: [],
        generatedAtTurn: 0
      }]
    }),
    /forbidden sourceView/
  );
  assert.throws(
    () => buildResolverInputContext(fixture.worldState, {
      generatedAt: FIXED_GENERATED_AT,
      extraEvidence: [{
        refId: "evidence:military:event-spoof",
        sourceView: "eventArchiveView",
        sourceId: "event-spoof",
        domain: "military",
        visibility: "public",
        confidence: 0.5,
        label: "领域伪造",
        summary: "事件档案不能伪装成军务输入。",
        relatedRefs: [],
        scopeRefs: [],
        generatedAtTurn: 0
      }]
    }),
    /forbidden sourceView-domain pair/
  );

  const context = buildResolverInputContext(fixture.worldState, {
    generatedAt: FIXED_GENERATED_AT,
    extraEvidence: ["Private", "actor-private", "server_hidden", "gm_only"].map((visibility, index) => ({
      refId: `evidence:intel:hidden-extra-${index}`,
      sourceView: "intelligenceRumorView",
      sourceId: `hidden-extra-${index}`,
      domain: "intel",
      visibility,
      confidence: 0.5,
      label: "私密传闻",
      summary: "这条传闻本身没有敏感词，但 visibility 不可公开。",
      relatedRefs: [],
      scopeRefs: [],
      generatedAtTurn: 0
    }))
  });
  assert.equal(context.intel.some((item) => item.sourceId.startsWith("hidden-extra")), false);
});

test("S88.7 resolver input consumes NPC follow-up domain evidence from safe view only", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "来函证据" });
  worldState.turnCount = 12;
  const debt = createNpcActiveRequest(worldState, "debt_collection");
  const bribe = createNpcActiveRequest(worldState, "bribe");
  const introduction = createNpcActiveRequest(worldState, "introduction");
  assert.equal(debt.ok, true);
  assert.equal(bribe.ok, true);
  assert.equal(introduction.ok, true);
  resolveNpcActiveRequest(worldState, debt.request.requestId, "investigate");
  resolveNpcActiveRequest(worldState, bribe.request.requestId, "report");
  resolveNpcActiveRequest(worldState, introduction.request.requestId, "accept");
  worldState.turnCount = 13;
  runNpcActiveRequestStep(worldState, "续办人情债：查验契据、见证人与旧账来源，只作月账解释。");

  const view = buildNpcActiveRequestView(worldState, { includeResolved: true });
  const context = buildResolverInputContext(worldState, {
    generatedAt: FIXED_GENERATED_AT,
    domainCaps: { people: 24, economy: 24, events: 24 },
    views: { npcActiveRequestView: view }
  });
  const serializedPublicEvidence = JSON.stringify({
    people: context.people,
    economy: context.economy,
    events: context.events,
    sourceViews: context.sourceViews
  });

  assert.ok(context.people.some((item) =>
    item.sourceView === "npcActiveRequestView" && /引荐|拜会|同年|师友/.test(`${item.label}${item.summary}`)
  ));
  assert.ok(context.economy.some((item) =>
    item.sourceView === "npcActiveRequestView" && /人情债|月账|契据/.test(`${item.label}${item.summary}`)
  ));
  assert.ok(context.events.some((item) =>
    item.sourceView === "npcActiveRequestView" && /廉政|watchlist|拒收/.test(`${item.label}${item.summary}`)
  ));
  assert.doesNotMatch(
    serializedPublicEvidence,
    /npcActiveRequestLedger|hiddenDossier|privateSignalTags|providerPayload|provider_payload|safe_search_index|state_patch|world_sessions|sk-[A-Za-z0-9_-]{6,}|\/mnt\/e/
  );
});

test("S88.8 resolver input consumes economy trace evidence from safe view only", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "经济证据" });
  worldState.turnCount = 22;
  const economyTraceView = buildEconomyTraceView(worldState, {
    views: {
      resourceLedgerView: {
        accounts: [{
          resourceId: "silver_liang",
          label: "银两",
          amount: 76,
          unit: "两"
        }]
      },
      assetLedgerView: { assets: [] },
      inventoryView: { items: [] },
      tradeLedgerView: {
        items: [{
          tradeId: "trade:resolver:economy",
          npcName: "韩员外",
          status: "countered",
          publicSummary: "韩员外交易议价：纸张与粮价消息尚待服务器确认。",
          requestedSilverDelta: -4,
          riskTags: ["议价"]
        }]
      },
      delegatedTaskView: {
        items: [{
          taskId: "delegated-task:resolver:economy",
          title: "东乡清丈",
          status: "active",
          assignee: { displayName: "陆知事" },
          budget: 24,
          riskFactors: ["田册"]
        }]
      },
      marketPriceView: {
        priceRows: [{
          priceId: "grain",
          label: "粟米",
          trend: "up",
          trendLabel: "上行",
          availability: "偏紧",
          marketPressure: 70,
          drivers: ["春荒", "转运迟滞"],
          currentSilverLiang: 1.6
        }]
      },
      npcEconomyView: {
        recentEvents: ["人情债月账：韩员外为修桥垫付，公开人情债略增。"]
      }
    }
  });

  const context = buildResolverInputContext(worldState, {
    generatedAt: FIXED_GENERATED_AT,
    domainCaps: { economy: 24 },
    views: { economyTraceView }
  });
  const serialized = JSON.stringify({
    economy: context.economy,
    sourceViews: context.sourceViews
  });

  assert.ok(context.sourceViews.some((source) => source.sourceView === "economyTraceView"));
  assert.ok(context.economy.some((item) =>
    item.sourceView === "economyTraceView" && /交易议价|韩员外/.test(`${item.label}${item.summary}`)
  ));
  assert.ok(context.economy.some((item) =>
    item.sourceView === "economyTraceView" && /东乡清丈|委派预算/.test(`${item.label}${item.summary}`)
  ));
  assert.ok(context.economy.some((item) =>
    item.sourceView === "economyTraceView" && /人情债|月账/.test(`${item.label}${item.summary}`)
  ));
  assert.ok(context.economy.some((item) =>
    item.sourceView === "economyTraceView" && item.topicSurfaceIds?.includes("war-council") && /粟米|市价/.test(`${item.label}${item.summary}`)
  ));
  assert.doesNotMatch(
    serialized,
    /assetLedger|resourceLedger|inventoryLedger|tradeLedger|delegatedTaskLedger|marketPriceLedger|npcEconomyLedger|evidenceRefs|resourceDelta|relationshipSignals|sqlite|SQLite|SQL|world_sessions|safe_search_index|providerPayload|hiddenDossier|privateSignalTags|sk-[A-Za-z0-9_-]{6,}|\/mnt\/e/
  );
});

test("S88.6 resolver input preserves canonical echo refs for domain consequence evidence", () => {
  const worldState = createInitialState({ role: "official", playerName: "后果上下文" });
  worldState.turnCount = 19;
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "resolver-domain-echo",
      policyType: "market_regulation",
      policyLabel: "米价回响",
      status: "accepted",
      publicSummary: "米铺照牌价出售，仍需观察民情。",
      publicSourceId: "resolver-domain-public-source",
      stateDelta: { publicOrder: -3 },
      appliedAtTurn: 19
    }]
  };
  ensureWorldThreadState(worldState);

  const context = buildResolverInputContext(worldState, {
    generatedAt: FIXED_GENERATED_AT,
    domainCaps: { events: 24 }
  });
  const direct = context.events.find((item) => item.sourceView === "domainConsequenceView");
  const archive = context.events.find((item) => item.sourceView === "eventArchiveView" && item.canonicalEchoRefs?.length);
  const refs = createResolverEvidenceRefs(context);
  const threadContext = buildResolverInputContext(worldState, {
    generatedAt: FIXED_GENERATED_AT,
    views: { worldThreadView: buildWorldThreadView(worldState) },
    domainCaps: { events: 8 }
  });
  const thread = threadContext.events.find((item) => item.sourceView === "worldThreadView" && item.canonicalEchoRefs?.length);

  assert.match(direct?.canonicalEchoRefs?.[0] || "", /^domainConsequenceEcho:/);
  assert.deepEqual(archive?.canonicalEchoRefs, direct.canonicalEchoRefs);
  assert.deepEqual(thread?.canonicalEchoRefs, direct.canonicalEchoRefs);
  assert.ok(refs.some((ref) =>
    ref.refId === direct.refId && ref.canonicalEchoRefs?.[0] === direct.canonicalEchoRefs[0]
  ));
  assert.doesNotMatch(JSON.stringify(context), /resolver-domain-public-source|stateDelta|cityPolicyLedger|rawSql|SEALED_/);
});

test("S71.1 resolver input context strips extra evidence to the evidence contract", () => {
  const fixture = createWorldContentFixture({ size: "small", seed: "resolver-input-extra-contract" });
  const context = buildResolverInputContext(fixture.worldState, {
    generatedAt: FIXED_GENERATED_AT,
    extraEvidence: [{
      refId: "evidence:intel:extra-contract",
      sourceView: "intelligenceRumorView",
      sourceId: "extra-contract",
      domain: "intel",
      visibility: "public",
      confidence: 0.5,
      label: "额外公开证据",
      summary: "额外公开事件材料，由服务器白名单化后才可进入上下文。",
      relatedRefs: ["city:qinghe"],
      scopeRefs: ["city:qinghe"],
      generatedAtTurn: 0,
      rawTableRow: { table: "looks-safe" },
      hiddenLedgerPointer: "looks-safe"
    }]
  });
  const evidence = context.intel.find((item) => item.sourceId === "extra-contract");
  assert.ok(evidence);
  assert.equal(Object.hasOwn(evidence, "rawTableRow"), false);
  assert.equal(Object.hasOwn(evidence, "hiddenLedgerPointer"), false);
  assert.deepEqual(Object.keys(evidence).sort(), [
    "confidence",
    "domain",
    "freshness",
    "generatedAtTurn",
    "label",
    "refId",
    "relatedRefs",
    "scopeRefs",
    "sourceId",
    "sourceView",
    "summary",
    "visibility"
  ]);
});

test("S71.1 resolver input context includes session summary public summaries", () => {
  const fixture = createWorldContentFixture({ size: "small", seed: "resolver-input-session-summary" });
  fixture.worldState.sessionSummary = {
    schemaVersion: "s70.sessionSummary.v1",
    lastPeriodKey: "1644-01",
    monthlySummaries: [{
      id: "SS-visible-0001",
      periodKey: "1644-01",
      periodLabel: "1644年一月",
      publicSummary: "本月清理旧案，并拜会同年师友。",
      generatedAtTurn: fixture.worldState.turnCount || 0,
      highlights: ["清理旧案"],
      sourceRefs: []
    }]
  };
  const context = buildResolverInputContext(fixture.worldState, { generatedAt: FIXED_GENERATED_AT });
  assert.ok(context.memory.some((item) =>
    item.sourceView === "sessionSummaryView" && item.summary.includes("清理旧案")
  ));
});

test("S71.1 resolver input context respects domain and global caps", () => {
  const fixture = createWorldContentFixture({ size: "medium", seed: "resolver-input-cap" });
  const context = buildResolverInputContext(fixture.worldState, { generatedAt: FIXED_GENERATED_AT });
  const refs = createResolverEvidenceRefs(context);

  assert.equal(refs.length <= RESOLVER_INPUT_GLOBAL_CAPS.maxItems, true);
  for (const [domain, config] of Object.entries(RESOLVER_INPUT_DOMAIN_CONFIG)) {
    assert.equal(context[domain].length <= config.maxItems, true, `${domain} exceeded resolver input cap`);
  }
  assert.ok(context.caps.truncation.length > 0, "medium fixture should record capped overflow");
});

test("S71.1 resolver input context keeps JSON and SQLite loaded sessions equivalent", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const fixture = createWorldContentFixture({
    size: "small",
    seed: `resolver-input-parity-${randomUUID()}`
  });
  const jsonAdapter = createJsonSessionAdapter();
  const dbPath = path.join(dataDir, `test-resolver-input-${randomUUID()}.sqlite`);
  const sqliteAdapter = createSqliteSessionAdapter({ databasePath: dbPath });
  t.after(async () => {
    sqliteAdapter.close();
    await removeSqliteArtifacts(dbPath);
    await removeSessionArtifacts(fixture.worldState.sessionId);
  });

  await jsonAdapter.writeSession(clone(fixture.worldState));
  await sqliteAdapter.writeSession(clone(fixture.worldState));
  const jsonLoaded = await jsonAdapter.readSession(fixture.worldState.sessionId);
  const sqliteLoaded = await sqliteAdapter.readSession(fixture.worldState.sessionId);

  const jsonContext = buildResolverInputContext(jsonLoaded, { generatedAt: FIXED_GENERATED_AT });
  const sqliteContext = buildResolverInputContext(sqliteLoaded, { generatedAt: FIXED_GENERATED_AT });

  assert.deepEqual(sqliteContext, jsonContext);
});
