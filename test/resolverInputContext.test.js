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
const {
  RESOLVER_INPUT_DOMAIN_CONFIG,
  RESOLVER_INPUT_GLOBAL_CAPS,
  RESOLVER_INPUT_SCHEMA_VERSION
} = require("../src/game/resolverInputConfig");
const {
  createCanaryPollutedWorldState,
  createWorldContentFixture
} = require("../src/game/worldContentFixtures");
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
