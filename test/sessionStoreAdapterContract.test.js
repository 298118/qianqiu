const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createInitialState } = require("../src/game/initialState");
const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

function buildWorldState(overrides = {}) {
  const worldState = createInitialState({
    playerName: overrides.playerName || "Adapter Tester",
    year: overrides.year || 1601,
    role: overrides.role || "scholar"
  });

  Object.assign(worldState, overrides.worldState);
  Object.assign(worldState.player, overrides.player);
  if (overrides.sessionId) worldState.sessionId = overrides.sessionId;
  if (overrides.month) worldState.month = overrides.month;
  if (overrides.tenDayPeriod !== undefined) worldState.tenDayPeriod = overrides.tenDayPeriod;
  if (overrides.turnCount !== undefined) worldState.turnCount = overrides.turnCount;
  return worldState;
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

async function readJsonRecord(sessionId) {
  const raw = await fs.readFile(path.join(sessionsDir, `${sessionId}.json`), "utf8");
  return JSON.parse(raw);
}

async function writeJsonRecord(sessionId, value) {
  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionsDir, `${sessionId}.json`),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

function buildEnvelope(adapter, worldState, overrides = {}) {
  return {
    storageSchemaVersion: adapter.CURRENT_STORAGE_SCHEMA_VERSION,
    sessionId: worldState.sessionId,
    createdAt: overrides.createdAt || "2026-05-07T00:00:00.000Z",
    updatedAt: overrides.updatedAt || "2026-05-07T00:01:00.000Z",
    revision: overrides.revision || 1,
    metadata: {
      ...adapter.buildSessionMetadata(worldState),
      ...overrides.metadata
    },
    worldState
  };
}

test("JSON storage adapter exposes the session-store contract surface", () => {
  const adapter = createJsonSessionAdapter();
  const methods = [
    "readSession",
    "readSessionRecord",
    "writeSession",
    "mutateSession",
    "listSessions",
    "deleteSession",
    "cleanupSessionTempFiles",
    "buildSessionMetadata",
    "normalizeSessionRecord"
  ];

  assert.equal(adapter.name, "json");
  for (const method of methods) {
    assert.equal(typeof adapter[method], "function", `${method} should be implemented`);
  }
});

test("JSON storage adapter contract: write/read keeps routes on worldState only", async (t) => {
  const adapter = createJsonSessionAdapter();
  const worldState = buildWorldState({
    playerName: "契约读写",
    year: 1602,
    month: 5,
    tenDayPeriod: 2,
    turnCount: 6,
    player: { gold: 33 }
  });
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  await adapter.writeSession(worldState);
  const loaded = await adapter.readSession(worldState.sessionId);
  const { record } = await adapter.readSessionRecord(worldState.sessionId);

  assert.deepEqual(loaded, worldState);
  assert.equal(loaded.storageSchemaVersion, undefined);
  assert.equal(loaded.revision, undefined);
  assert.equal(loaded.metadata, undefined);
  assert.equal(record.storageSchemaVersion, adapter.CURRENT_STORAGE_SCHEMA_VERSION);
  assert.equal(record.sessionId, worldState.sessionId);
  assert.equal(record.metadata.playerName, "契约读写");
  assert.equal(record.metadata.tenDayPeriod, 2);
  assert.ok(record.revision >= 1);
});

test("JSON storage adapter contract: legacy raw saves migrate through the adapter", async (t) => {
  const adapter = createJsonSessionAdapter();
  const worldState = buildWorldState({
    playerName: "旧档迁移",
    year: 1603,
    month: 8,
    turnCount: 4
  });
  delete worldState.tenDayPeriod;
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  await writeJsonRecord(worldState.sessionId, worldState);

  const loaded = await adapter.readSession(worldState.sessionId);
  const migrated = await readJsonRecord(worldState.sessionId);

  assert.equal(loaded.tenDayPeriod, 1);
  assert.equal(migrated.storageSchemaVersion, adapter.CURRENT_STORAGE_SCHEMA_VERSION);
  assert.equal(migrated.worldState.tenDayPeriod, 1);
  assert.equal(migrated.metadata.tenDayPeriod, 1);
});

test("JSON storage adapter contract: listSessions redacts metadata and skips corrupt files", async (t) => {
  const adapter = createJsonSessionAdapter();
  const visible = buildWorldState({
    playerName: "可见存档",
    year: 1604,
    month: 9,
    tenDayPeriod: 3,
    turnCount: 12,
    player: {
      role: "official",
      roleLabel: "入仕官员",
      examRank: "进士",
      officeTitle: "县令"
    }
  });
  visible.relationshipLedger = {
    schemaVersion: 1,
    contacts: {
      "C-hidden-contract": {
        id: "C-hidden-contract",
        name: "密线人物",
        visibility: "hidden"
      }
    }
  };
  const corruptSessionId = randomUUID();
  const corruptFile = path.join(sessionsDir, `${corruptSessionId}.json`);
  t.after(() => removeSessionArtifacts(visible.sessionId));
  t.after(() => removeSessionArtifacts(corruptSessionId));

  await writeJsonRecord(
    visible.sessionId,
    buildEnvelope(adapter, visible, {
      updatedAt: "2026-05-07T00:03:00.000Z",
      metadata: { hiddenRelationshipId: "C-hidden-contract" }
    })
  );
  await fs.writeFile(corruptFile, "{ not json", "utf8");

  const result = await adapter.listSessions();
  const save = result.saves.find((entry) => entry.sessionId === visible.sessionId);
  const skipped = result.skipped.find((entry) => entry.fileName === `${corruptSessionId}.json`);

  assert.ok(save);
  assert.equal(save.playerName, "可见存档");
  assert.equal(save.role, "official");
  assert.equal(save.tenDayPeriod, 3);
  assert.equal(save.examRank, "进士");
  assert.equal(save.officeTitle, "县令");
  assert.equal(save.worldState, undefined);
  assert.equal(save.relationshipLedger, undefined);
  assert.equal(save.hiddenRelationshipId, undefined);
  assert.ok(!JSON.stringify(save).includes("C-hidden-contract"));
  assert.ok(!JSON.stringify(save).includes("密线人物"));
  assert.ok(skipped);
  assert.equal(skipped.reason, "Session file is corrupt");
  assert.ok(!skipped.reason.includes(sessionsDir));
  assert.ok(!skipped.reason.includes(corruptSessionId));
});

test("JSON storage adapter contract: expectedRevision rejects stale writes", async (t) => {
  const adapter = createJsonSessionAdapter();
  const worldState = buildWorldState({
    playerName: "版本冲突",
    player: { gold: 10 }
  });
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  await adapter.writeSession(worldState);
  const { record: staleRecord } = await adapter.readSessionRecord(worldState.sessionId);

  const staleWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  staleWorldState.player.gold = 77;
  const latestWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  latestWorldState.player.gold = 88;
  await writeJsonRecord(
    worldState.sessionId,
    buildEnvelope(adapter, latestWorldState, {
      createdAt: staleRecord.createdAt,
      updatedAt: "2026-05-07T00:10:00.000Z",
      revision: staleRecord.revision + 1
    })
  );

  await assert.rejects(
    () =>
      adapter.writeSession(staleWorldState, {
        previousRecord: staleRecord,
        expectedRevision: staleRecord.revision
      }),
    (error) => error.statusCode === 409 && /revision conflict/i.test(error.message)
  );

  const loaded = await adapter.readSession(worldState.sessionId);
  assert.equal(loaded.player.gold, 88);
});

test("JSON storage adapter contract: mutateSession serializes overlapping writes", async (t) => {
  const adapter = createJsonSessionAdapter();
  const worldState = buildWorldState({
    playerName: "并发写入",
    player: { gold: 10 }
  });
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  await adapter.writeSession(worldState);

  await Promise.all(
    [1, 2, 3].map((amount) =>
      adapter.mutateSession(worldState.sessionId, async (draft) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        draft.player.gold += amount;
        draft.eventHistory.push(`adapter mutation +${amount}`);
        return draft;
      })
    )
  );

  const loaded = await adapter.readSession(worldState.sessionId);
  const { record } = await adapter.readSessionRecord(worldState.sessionId);

  assert.equal(loaded.player.gold, 16);
  assert.deepEqual(
    loaded.eventHistory.slice(-3),
    ["adapter mutation +1", "adapter mutation +2", "adapter mutation +3"]
  );
  assert.ok(record.revision >= 4);
});

test("JSON storage adapter contract: mutateSession skipWrite preserves the stored revision", async (t) => {
  const adapter = createJsonSessionAdapter();
  const worldState = buildWorldState({
    playerName: "跳过写入",
    player: { gold: 10 }
  });
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  await adapter.writeSession(worldState);
  const { record: before } = await adapter.readSessionRecord(worldState.sessionId);

  const result = await adapter.mutateSession(worldState.sessionId, async (draft, context) => {
    draft.player.gold = 99;
    context.skipWrite = true;
    return { goldSeenByRoute: draft.player.gold };
  });
  const { record: after } = await adapter.readSessionRecord(worldState.sessionId);

  assert.deepEqual(result, { goldSeenByRoute: 99 });
  assert.equal(after.revision, before.revision);
  assert.equal(after.worldState.player.gold, 10);
});

test("JSON storage adapter contract: mutateSession can write before surfacing a route error", async (t) => {
  const adapter = createJsonSessionAdapter();
  const worldState = buildWorldState({
    playerName: "写后报错",
    player: { gold: 10 }
  });
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  await adapter.writeSession(worldState);

  await assert.rejects(
    () =>
      adapter.mutateSession(worldState.sessionId, async (draft, context) => {
        draft.eventHistory.push("已记录错过考期");
        context.errorAfterWrite = Object.assign(new Error("考期已过"), { statusCode: 409 });
        return null;
      }),
    (error) => error.statusCode === 409 && error.message === "考期已过"
  );

  const loaded = await adapter.readSession(worldState.sessionId);
  assert.ok(loaded.eventHistory.includes("已记录错过考期"));
});
