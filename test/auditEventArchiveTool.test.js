const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { isBuiltin } = require("node:module");

const { createInitialState } = require("../src/game/initialState");
const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");
const {
  parseArgs,
  runAuditEventArchiveTool
} = require("../scripts/auditEventArchiveTool");

const dataDir = path.join(__dirname, "..", "data");
const sessionsDir = path.join(dataDir, "sessions");
const auditDir = path.join(dataDir, "audit");
const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

async function removeSqliteArtifacts(dbPath) {
  await Promise.all(
    [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
}

function buildAuditWorldState(label = "审计投影") {
  const worldState = createInitialState({
    role: "scholar",
    playerName: label
  });
  worldState.player.name = `${label} E:\\LSMNQ\\data\\audit\\metadata.jsonl sk-proj-metadata-secret-123456`;
  worldState.player.officeTitle = "SEALED_METADATA_OFFICE E:\\LSMNQ\\office.txt";
  worldState.dynasty = "明 E:\\LSMNQ\\data\\audit\\dynasty.jsonl sk-proj-dynasty-secret-123456";
  Object.assign(worldState, {
    turnCount: 6,
    month: 2,
    tenDayPeriod: 2
  });
  return worldState;
}

async function seedAudit(adapter, worldState) {
  await adapter.writeSession(clone(worldState));
  await adapter.appendAuditEvent(worldState.sessionId, {
    eventType: "turn_completed",
    visibility: "public",
    summary: "乡中公开审计入档。",
    related: {
      eventHistoryCount: 2,
      hiddenNotes: "SEALED_TOOL_HIDDEN_NOTE",
      localPath: "E:\\LSMNQ\\data\\audit\\secret.jsonl"
    },
    appliedChanges: {
      turnCount: worldState.turnCount,
      statePatch: { worldState: "SEALED_TOOL_STATE_PATCH" }
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
    summary: "SEALED_DEVELOPER_AUDIT"
  });
  await adapter.appendAuditEvent(worldState.sessionId, {
    eventType: "turn_completed",
    visibility: "public",
    summary: "prompt provider proposal event_log ai_change_proposals data/audit sk-proj-tool-secret-123456"
  });
  await adapter.appendAiProposal(worldState.sessionId, {
    proposalKind: "turn",
    status: "recorded",
    proposal: {
      promptText: "SEALED_TOOL_PROMPT",
      statePatch: {
        worldState: "SEALED_TOOL_WORLD_STATE",
        apiKey: "sk-proj-tool-secret-123456"
      },
      providerProposal: "SEALED_TOOL_PROVIDER_PROPOSAL"
    },
    accepted: {
      stateDelta: {
        publicOrder: 77
      }
    }
  });
}

test("audit event archive tool parses safe commands", () => {
  const sessionId = randomUUID();
  assert.deepEqual(parseArgs(["status", "--adapter", "sqlite", "--db", "data/demo.sqlite", "--session", sessionId, "--limit", "5", "--json"]), {
    command: "status",
    databasePath: "data/demo.sqlite",
    json: true,
    limit: 5,
    outPath: null,
    sessionId,
    storageAdapter: "sqlite"
  });
  assert.equal(parseArgs(["export", "--storage-adapter", "json"]).storageAdapter, "json");
  assert.equal(parseArgs(["--help"]).command, "help");
  assert.throws(() => parseArgs(["status", "--adapter", "remote"]), /Unsupported audit projection adapter/);
  assert.throws(() => parseArgs(["status", "--session", "unsafe"]), /Invalid session id/);
  assert.throws(() => parseArgs(["status", "--limit", "-1"]), /--limit/);
});

test("audit event archive tool exports redacted JSON sidecar projection", async (t) => {
  const adapter = createJsonSessionAdapter();
  const worldState = buildAuditWorldState("JSON审计投影");
  const outPath = path.join(dataDir, `test-audit-event-tool-${randomUUID()}.json`);
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await fs.rm(outPath, { force: true });
  });

  await seedAudit(adapter, worldState);
  const status = await runAuditEventArchiveTool({
    command: "status",
    storageAdapter: "json",
    sessionId: worldState.sessionId,
    limit: 20
  });
  const exported = await runAuditEventArchiveTool({
    command: "export",
    storageAdapter: "json",
    sessionId: worldState.sessionId,
    limit: 20,
    outPath
  });
  const serialized = JSON.stringify(exported);
  const fileSerialized = await fs.readFile(outPath, "utf8");

  assert.equal(status.checked, 1);
  assert.equal(status.sessions[0].counts.auditEvents, 3);
  assert.equal(status.sessions[0].counts.aiProposals, 1);
  assert.equal(status.sessions[0].counts.projectedItems, 1);
  assert.equal(exported.wroteFile, true);
  assert.match(serialized, /乡中公开审计入档/);
  assert.match(serialized, /近事:2/);

  for (const blocked of [
    "SEALED_TOOL_HIDDEN_NOTE",
    "SEALED_TOOL_STATE_PATCH",
    "SEALED_TOOL_PROMPT",
    "SEALED_TOOL_WORLD_STATE",
    "SEALED_TOOL_PROVIDER_PROPOSAL",
    "SEALED_DEVELOPER_AUDIT",
    "SEALED_METADATA_OFFICE",
    "sk-proj-metadata-secret",
    "sk-proj-dynasty-secret",
    "sk-proj-tool-secret",
    "event_log",
    "ai_change_proposals",
    "data/audit",
    "E:\\LSMNQ"
  ]) {
    assert.equal(serialized.includes(blocked), false, `${blocked} should stay out of JSON export`);
    assert.equal(fileSerialized.includes(blocked), false, `${blocked} should stay out of JSON export file`);
  }
});

test("audit event archive tool does not create a missing SQLite database", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const dbPath = path.join(dataDir, `test-audit-event-tool-missing-${randomUUID()}.sqlite`);
  t.after(() => removeSqliteArtifacts(dbPath));

  const result = await runAuditEventArchiveTool({
    command: "status",
    storageAdapter: "sqlite",
    databasePath: dbPath
  });

  assert.equal(result.databaseExists, false);
  assert.deepEqual(result.sessions, []);
  await assert.rejects(() => fs.stat(dbPath), /ENOENT/);
});

test("audit event archive tool exports redacted SQLite audit projection", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const dbPath = path.join(dataDir, `test-audit-event-tool-${randomUUID()}.sqlite`);
  const adapter = createSqliteSessionAdapter({ databasePath: dbPath });
  const worldState = buildAuditWorldState("SQLite审计投影");
  t.after(async () => {
    adapter.close();
    await removeSqliteArtifacts(dbPath);
  });

  await seedAudit(adapter, worldState);
  adapter.close();

  const exported = await runAuditEventArchiveTool({
    command: "export",
    storageAdapter: "sqlite",
    databasePath: dbPath,
    sessionId: worldState.sessionId,
    limit: 20
  });
  const serialized = JSON.stringify(exported);

  assert.equal(exported.databaseExists, true);
  assert.equal(exported.exported, 1);
  assert.equal(exported.sessions[0].projection.counts.auditEvents, 3);
  assert.equal(exported.sessions[0].projection.counts.aiProposals, 1);
  assert.equal(exported.sessions[0].projection.counts.projectedItems, 1);
  assert.match(serialized, /乡中公开审计入档/);

  for (const blocked of [
    dbPath,
    "SEALED_TOOL_HIDDEN_NOTE",
    "SEALED_TOOL_PROMPT",
    "SEALED_TOOL_PROVIDER_PROPOSAL",
    "SEALED_METADATA_OFFICE",
    "sk-proj-metadata-secret",
    "sk-proj-dynasty-secret",
    "sk-proj-tool-secret",
    "event_log",
    "ai_change_proposals",
    "data/audit",
    "E:\\LSMNQ"
  ]) {
    assert.equal(serialized.includes(blocked), false, `${blocked} should stay out of SQLite export`);
  }
});
