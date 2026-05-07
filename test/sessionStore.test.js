const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createInitialState } = require("../src/game/initialState");
const sessionStore = require("../src/storage/sessionStore");
const { readSession, writeSession } = sessionStore;

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true });
  const entries = await fs.readdir(sessionsDir).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith(`${sessionId}.`) && entry.endsWith(".tmp"))
      .map((entry) => fs.rm(path.join(sessionsDir, entry), { force: true }))
  );
}

async function readSessionFile(sessionId) {
  const raw = await fs.readFile(path.join(sessionsDir, `${sessionId}.json`), "utf8");
  return JSON.parse(raw);
}

async function writeRawSessionFile(sessionId, value) {
  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionsDir, `${sessionId}.json`),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

function buildWorldState(overrides = {}) {
  const worldState = createInitialState({
    playerName: overrides.playerName || "Tester",
    year: overrides.year || 1601,
    role: overrides.role || "scholar"
  });

  Object.assign(worldState, overrides.worldState);
  Object.assign(worldState.player, overrides.player);
  if (overrides.sessionId) {
    worldState.sessionId = overrides.sessionId;
  }
  if (overrides.month) {
    worldState.month = overrides.month;
  }
  if (overrides.tenDayPeriod !== undefined) {
    worldState.tenDayPeriod = overrides.tenDayPeriod;
  }
  if (overrides.turnCount !== undefined) {
    worldState.turnCount = overrides.turnCount;
  }
  return worldState;
}

function assertEnvelope(record, worldState) {
  assert.equal(record.storageSchemaVersion, 1);
  assert.equal(record.sessionId, worldState.sessionId);
  assert.equal(typeof record.createdAt, "string");
  assert.equal(typeof record.updatedAt, "string");
  assert.equal(typeof record.revision, "number");
  assert.ok(record.revision >= 1);
  assert.deepEqual(record.worldState, worldState);
  assert.equal(record.metadata.playerName, worldState.player.name);
  assert.equal(record.metadata.role, worldState.player.role);
  assert.equal(record.metadata.dynasty, worldState.dynasty);
  assert.equal(record.metadata.year, worldState.year);
  assert.equal(record.metadata.month, worldState.month);
  assert.equal(record.metadata.tenDayPeriod, worldState.tenDayPeriod);
  assert.equal(record.metadata.turnCount, worldState.turnCount);
}

function assertUnsupportedFutureVersion(error) {
  return (
    (error.statusCode === 400 || error.statusCode === 422) &&
    /unsupported|future|storageSchemaVersion/i.test(error.message)
  );
}

function assertSessionIdMismatch(error) {
  return (
    (error.statusCode === 400 || error.statusCode === 409) &&
    /session id|sessionId|mismatch/i.test(error.message)
  );
}

test("writeSession writes an envelope and readSession returns route-compatible worldState", async (t) => {
  const worldState = buildWorldState({ playerName: "Tester", year: 1601 });
  t.after(() => removeSessionFile(worldState.sessionId));

  worldState.player.gold = 42;
  worldState.eventHistory.push("created during test");

  await writeSession(worldState);
  const loaded = await readSession(worldState.sessionId);
  const record = await readSessionFile(worldState.sessionId);

  assert.deepEqual(loaded, worldState);
  assertEnvelope(record, worldState);
});

test("readSession migrates legacy raw worldState saves to the envelope format", async (t) => {
  const worldState = buildWorldState({
    playerName: "Legacy Tester",
    year: 1602,
    month: 8,
    turnCount: 4,
    player: {
      examRank: "秀才",
      officeTitle: null
    }
  });
  delete worldState.tenDayPeriod;
  t.after(() => removeSessionFile(worldState.sessionId));

  await writeRawSessionFile(worldState.sessionId, worldState);

  const loaded = await readSession(worldState.sessionId);
  const migrated = await readSessionFile(worldState.sessionId);

  assert.equal(loaded.tenDayPeriod, 1);
  assert.equal(migrated.worldState.tenDayPeriod, 1);
  assertEnvelope(migrated, loaded);
});

test("readSession reads envelope saves without exposing storage metadata to routes", async (t) => {
  const worldState = buildWorldState({
    playerName: "Envelope Tester",
    year: 1603,
    month: 10,
    tenDayPeriod: 3,
    turnCount: 9,
    player: {
      examRank: "举人",
      officeTitle: "翰林院庶吉士"
    }
  });
  const record = {
    storageSchemaVersion: 1,
    sessionId: worldState.sessionId,
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:01:00.000Z",
    revision: 7,
    metadata: {
      playerName: "stale metadata should be rebuilt by write paths only",
      hiddenRelationshipId: "C-hidden"
    },
    worldState
  };
  t.after(() => removeSessionFile(worldState.sessionId));

  await writeRawSessionFile(worldState.sessionId, record);

  const loaded = await readSession(worldState.sessionId);

  assert.deepEqual(loaded, worldState);
  assert.equal(loaded.storageSchemaVersion, undefined);
  assert.equal(loaded.metadata, undefined);
  assert.equal(loaded.revision, undefined);
});

test("readSession defaults envelope saves missing tenDayPeriod to first period", async (t) => {
  const worldState = buildWorldState({
    playerName: "Envelope Time Tester",
    year: 1604,
    month: 8,
    turnCount: 5
  });
  delete worldState.tenDayPeriod;
  const record = {
    storageSchemaVersion: 1,
    sessionId: worldState.sessionId,
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:01:00.000Z",
    revision: 3,
    metadata: {},
    worldState
  };
  t.after(() => removeSessionFile(worldState.sessionId));

  await writeRawSessionFile(worldState.sessionId, record);

  const loaded = await readSession(worldState.sessionId);
  const listed = await sessionStore.listSessions();
  const save = listed.saves.find((entry) => entry.sessionId === worldState.sessionId);

  assert.equal(loaded.tenDayPeriod, 1);
  assert.equal(save.tenDayPeriod, 1);
});


test("readSession rejects raw saves whose worldState session id does not match the filename", async (t) => {
  const fileSessionId = randomUUID();
  const worldState = buildWorldState({ sessionId: randomUUID() });
  t.after(() => removeSessionFile(fileSessionId));

  await writeRawSessionFile(fileSessionId, worldState);

  await assert.rejects(() => readSession(fileSessionId), assertSessionIdMismatch);
});

test("readSession rejects envelope saves whose ids do not match the filename and worldState", async (t) => {
  const fileSessionId = randomUUID();
  const worldState = buildWorldState({ sessionId: fileSessionId });
  const record = {
    storageSchemaVersion: 1,
    sessionId: randomUUID(),
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
    revision: 1,
    metadata: {},
    worldState
  };
  t.after(() => removeSessionFile(fileSessionId));

  await writeRawSessionFile(fileSessionId, record);

  await assert.rejects(() => readSession(fileSessionId), assertSessionIdMismatch);
});

test("readSession rejects unsupported future storage schema versions", async (t) => {
  const worldState = buildWorldState({ playerName: "Future Tester" });
  const record = {
    storageSchemaVersion: 999,
    sessionId: worldState.sessionId,
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
    revision: 1,
    metadata: {},
    worldState
  };
  t.after(() => removeSessionFile(worldState.sessionId));

  await writeRawSessionFile(worldState.sessionId, record);

  await assert.rejects(() => readSession(worldState.sessionId), assertUnsupportedFutureVersion);
});

test("readSession reports malformed JSON without deleting the save", async (t) => {
  const sessionId = randomUUID();
  const filePath = path.join(sessionsDir, `${sessionId}.json`);
  t.after(() => removeSessionFile(sessionId));

  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(filePath, "{ not json", "utf8");

  await assert.rejects(
    () => readSession(sessionId),
    (error) => error.statusCode === 500 && /corrupt/i.test(error.message)
  );
  await assert.doesNotReject(() => fs.access(filePath));
});

test("writeSession leaves no temp files behind after a successful atomic write", async (t) => {
  const worldState = buildWorldState({ playerName: "Atomic Tester" });
  t.after(() => removeSessionFile(worldState.sessionId));

  await writeSession(worldState);

  const entries = await fs.readdir(sessionsDir);
  assert.ok(entries.includes(`${worldState.sessionId}.json`));
  assert.equal(entries.includes(`${worldState.sessionId}.lock`), false);
  assert.deepEqual(
    entries.filter((entry) => entry.startsWith(`${worldState.sessionId}.`) && entry.endsWith(".tmp")),
    []
  );
  assertEnvelope(await readSessionFile(worldState.sessionId), worldState);
});

test("writeSession cleans up stale cross-process lock files", async (t) => {
  const worldState = buildWorldState({ playerName: "Lock Tester" });
  const lockPath = path.join(sessionsDir, `${worldState.sessionId}.lock`);
  t.after(() => removeSessionFile(worldState.sessionId));
  t.after(() => fs.rm(lockPath, { force: true }));

  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(lockPath, "stale lock", "utf8");
  const staleTime = new Date(Date.now() - 120000);
  await fs.utimes(lockPath, staleTime, staleTime);

  await writeSession(worldState);

  await assert.rejects(() => fs.access(lockPath));
  assertEnvelope(await readSessionFile(worldState.sessionId), worldState);
});

test("cleanupSessionTempFiles removes stale temp files without touching saves", { skip: typeof sessionStore.cleanupSessionTempFiles !== "function" }, async (t) => {
  const worldState = buildWorldState({ playerName: "Cleanup Tester" });
  const tmpFile = `${worldState.sessionId}.json.test.tmp`;
  const tmpPath = path.join(sessionsDir, tmpFile);
  t.after(() => removeSessionFile(worldState.sessionId));

  await writeSession(worldState);
  await fs.writeFile(tmpPath, "temporary", "utf8");

  const result = await sessionStore.cleanupSessionTempFiles({ olderThanMs: 0 });
  const removed = Array.isArray(result) ? result : result.removed;

  assert.ok(removed.includes(tmpFile));
  assert.deepEqual(await readSession(worldState.sessionId), worldState);
  await assert.rejects(() => fs.access(tmpPath));
});

test("cleanupSessionTempFiles skips temp files for actively locked sessions", { skip: typeof sessionStore.cleanupSessionTempFiles !== "function" }, async (t) => {
  const worldState = buildWorldState({ playerName: "Active Cleanup Tester" });
  const tmpFile = `${worldState.sessionId}.json.fake.tmp`;
  const tmpPath = path.join(sessionsDir, tmpFile);
  const lockPath = path.join(sessionsDir, `${worldState.sessionId}.lock`);
  t.after(() => removeSessionFile(worldState.sessionId));

  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(tmpPath, "temporary", "utf8");
  await fs.writeFile(lockPath, "active lock", "utf8");

  const result = await sessionStore.cleanupSessionTempFiles({ olderThanMs: 0 });
  const removed = Array.isArray(result) ? result : result.removed;

  assert.equal(removed.includes(tmpFile), false);
  await assert.doesNotReject(() => fs.access(tmpPath));

  await fs.rm(lockPath, { force: true });
  const afterUnlock = await sessionStore.cleanupSessionTempFiles({ olderThanMs: 0 });
  const removedAfterUnlock = Array.isArray(afterUnlock) ? afterUnlock : afterUnlock.removed;

  assert.ok(removedAfterUnlock.includes(tmpFile));
  await assert.rejects(() => fs.access(tmpPath));
});

test("readSession rejects unsafe session ids before touching the filesystem", async () => {
  await assert.rejects(
    () => readSession("../bad-session"),
    (error) => error.statusCode === 400 && error.message === "Invalid session id"
  );
});

test("readSession reports missing safe session ids as 404", async () => {
  const missingSessionId = randomUUID();
  await removeSessionFile(missingSessionId);

  await assert.rejects(
    () => readSession(missingSessionId),
    (error) => error.statusCode === 404 && error.message === "Session not found"
  );
});

test("listSessions returns redacted metadata sorted by updated time", { skip: typeof sessionStore.listSessions !== "function" }, async (t) => {
  const older = buildWorldState({
    playerName: "Older Save",
    year: 1601,
    month: 2,
    tenDayPeriod: 2,
    turnCount: 3,
    player: {
      examRank: "秀才",
      officeTitle: null
    }
  });
  const newer = buildWorldState({
    playerName: "Newer Save",
    year: 1605,
    month: 9,
    tenDayPeriod: 3,
    turnCount: 11,
    player: {
      role: "official",
      roleLabel: "入仕官员",
      examRank: "进士",
      officeTitle: "县令"
    }
  });
  newer.relationshipLedger = {
    schemaVersion: 1,
    contacts: {
      "C-hidden": {
        id: "C-hidden",
        name: "Hidden Contact",
        visibility: "hidden"
      }
    }
  };
  t.after(() => removeSessionFile(older.sessionId));
  t.after(() => removeSessionFile(newer.sessionId));

  await writeRawSessionFile(older.sessionId, {
    storageSchemaVersion: 1,
    sessionId: older.sessionId,
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:01:00.000Z",
    revision: 1,
    metadata: {
      playerName: older.player.name,
      role: older.player.role,
      roleLabel: older.player.roleLabel,
      dynasty: older.dynasty,
      year: older.year,
      month: older.month,
      tenDayPeriod: older.tenDayPeriod,
      turnCount: older.turnCount,
      examRank: older.player.examRank,
      officeTitle: older.player.officeTitle,
      summary: older.player.position
    },
    worldState: older
  });
  await writeRawSessionFile(newer.sessionId, {
    storageSchemaVersion: 1,
    sessionId: newer.sessionId,
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:02:00.000Z",
    revision: 2,
    metadata: {
      playerName: newer.player.name,
      role: newer.player.role,
      roleLabel: newer.player.roleLabel,
      dynasty: newer.dynasty,
      year: newer.year,
      month: newer.month,
      tenDayPeriod: newer.tenDayPeriod,
      turnCount: newer.turnCount,
      examRank: newer.player.examRank,
      officeTitle: newer.player.officeTitle,
      summary: newer.player.position,
      hiddenRelationshipId: "C-hidden"
    },
    worldState: newer
  });

  const result = await sessionStore.listSessions();
  const saves = Array.isArray(result) ? result : result.saves;
  const listed = saves.filter((save) => [older.sessionId, newer.sessionId].includes(save.sessionId));

  assert.deepEqual(
    listed.map((save) => save.sessionId),
    [newer.sessionId, older.sessionId]
  );
  assert.equal(listed[0].playerName, "Newer Save");
  assert.equal(listed[0].role, "official");
  assert.equal(listed[0].tenDayPeriod, 3);
  assert.equal(listed[1].tenDayPeriod, 2);
  assert.equal(listed[0].examRank, "进士");
  assert.equal(listed[0].officeTitle, "县令");
  assert.equal(listed[0].worldState, undefined);
  assert.equal(listed[0].relationshipLedger, undefined);
  assert.equal(listed[0].hiddenRelationshipId, undefined);
  assert.ok(!JSON.stringify(listed).includes("C-hidden"));
  assert.ok(!JSON.stringify(listed).includes("Hidden Contact"));
});

test("listSessions reports skipped saves without leaking filesystem details", { skip: typeof sessionStore.listSessions !== "function" }, async (t) => {
  const sessionId = randomUUID();
  const fileName = `${sessionId}.json`;
  const filePath = path.join(sessionsDir, fileName);
  t.after(() => removeSessionFile(sessionId));

  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(filePath, "{ not json", "utf8");

  const result = await sessionStore.listSessions();
  const skipped = result.skipped.find((entry) => entry.fileName === fileName);

  assert.ok(skipped);
  assert.equal(skipped.reason, "Session file is corrupt");
  assert.ok(!skipped.reason.includes(sessionsDir));
  assert.ok(!skipped.reason.includes(sessionId));
});

test("mutateSession serializes overlapping mutations and advances revisions", { skip: typeof sessionStore.mutateSession !== "function" }, async (t) => {
  const worldState = buildWorldState({
    playerName: "Mutation Tester",
    player: { gold: 10 }
  });
  t.after(() => removeSessionFile(worldState.sessionId));

  await writeSession(worldState);

  await Promise.all(
    [1, 2, 3].map((amount) =>
      sessionStore.mutateSession(worldState.sessionId, async (draft) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        draft.player.gold += amount;
        draft.eventHistory.push(`mutation +${amount}`);
        return draft;
      })
    )
  );

  const loaded = await readSession(worldState.sessionId);
  const record = await readSessionFile(worldState.sessionId);

  assert.equal(loaded.player.gold, 16);
  assert.deepEqual(loaded.eventHistory.slice(-3), ["mutation +1", "mutation +2", "mutation +3"]);
  assert.ok(record.revision >= 4);
});

test("writeSession checks latest disk revision when expectedRevision is supplied", async (t) => {
  const worldState = buildWorldState({
    playerName: "Revision Tester",
    player: { gold: 10 }
  });
  t.after(() => removeSessionFile(worldState.sessionId));

  await writeSession(worldState);
  const { record: staleRecord } = await sessionStore.readSessionRecord(worldState.sessionId);
  const staleWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  staleWorldState.player.gold = 77;

  const latestWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  latestWorldState.player.gold = 88;
  await writeRawSessionFile(worldState.sessionId, {
    ...staleRecord,
    revision: staleRecord.revision + 1,
    updatedAt: "2026-05-06T00:10:00.000Z",
    metadata: sessionStore.buildSessionMetadata(latestWorldState),
    worldState: latestWorldState
  });

  await assert.rejects(
    () => writeSession(staleWorldState, {
      previousRecord: staleRecord,
      expectedRevision: staleRecord.revision
    }),
    (error) => error.statusCode === 409 && /revision conflict/i.test(error.message)
  );

  const loaded = await readSession(worldState.sessionId);
  const record = await readSessionFile(worldState.sessionId);
  assert.equal(loaded.player.gold, 88);
  assert.equal(record.revision, staleRecord.revision + 1);
});
