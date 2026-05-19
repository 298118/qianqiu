const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const { createInitialState } = require("../src/game/initialState");
const {
  buildTopicSurfaceView,
  buildTopicSurfaceViewIndex
} = require("../src/game/topicSurfaceView");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");
const topicSurfaceIds = [
  "memorial-review",
  "edict-draft",
  "court-debate",
  "trial",
  "war-council",
  "npc-profile"
];

function sessionPath(sessionId) {
  return path.join(sessionsDir, `${sessionId}.json`);
}

async function removeSessionArtifacts(sessionId) {
  if (!sessionId) return;
  await Promise.all([
    fs.rm(sessionPath(sessionId), { force: true }),
    fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true }),
    fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true }),
    fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true })
  ]);
}

function assertNoSensitiveText(payload) {
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(
    serialized,
    /SEALED_|hidden[ _-]?(?:notes?|intent)?|raw[ _-]?(?:provider|payload|prompt|audit|table|ledger|state|row)|provider\s+payload|prompt|完整提示词|localPath|file:\/\/|data[\\/](?:sessions|audit)|[A-Za-z]:[\\/]|\/(?:mnt|home|Users|tmp|var|opt|workspace)\/|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}/i
  );
}

function createGameServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", require("../src/routes/game"));
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  return createFetchSafeServer(app);
}

test("S78 topicSurfaceView covers six safe office topic surfaces", () => {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "专题测试"
  });
  const views = buildTopicSurfaceViewIndex(worldState);

  assert.deepEqual(views.map((view) => view.surfaceId).sort(), topicSurfaceIds.slice().sort());
  for (const view of views) {
    assert.equal(view.schemaVersion, "s78.topicSurfaceView.v1");
    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.draftOnly, true);
    assert.equal(view.safety.noResolverExecution, true);
    assert.equal(view.safety.noStateWrites, true);
    assert.ok(Array.isArray(view.items));
    assert.ok(Array.isArray(view.evidenceRefs));
    assert.ok(Array.isArray(view.draftSlots));
    assert.ok(view.draftSlots.length >= 1, view.surfaceId);
    assertNoSensitiveText(view);
  }
});

test("S78 topicSurfaceView rejects unknown surface ids", () => {
  const worldState = createInitialState({ role: "official" });
  assert.throws(() => buildTopicSurfaceView(worldState, { surfaceId: "raw-state" }), /未知专题/);
});

test("S78 war council surface includes safe map context evidence", () => {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "general",
    playerName: "军议舆图"
  });
  const view = buildTopicSurfaceView(worldState, { surfaceId: "war-council" });

  assert.ok(view.sourceViews.some((source) => source.sourceView === "mapContextView"));
  assert.ok(view.evidenceRefs.some((ref) => ref.sourceView === "mapContextView"));
  assertNoSensitiveText(view);
});

test("GET /api/game/topic-surface/:sessionId/:surfaceId returns read-only safe projection", async (t) => {
  const server = createGameServer();
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "magistrate",
    playerName: "堂审测试"
  });
  await writeSession(worldState);
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const beforeRaw = await fs.readFile(sessionPath(worldState.sessionId), "utf8");
  const response = await fetch(`${server.baseUrl}/api/game/topic-surface/${worldState.sessionId}/trial`);
  const payload = await response.json();
  const afterRaw = await fs.readFile(sessionPath(worldState.sessionId), "utf8");

  assert.equal(response.status, 200);
  assert.equal(payload.sessionId, worldState.sessionId);
  assert.equal(payload.topicSurfaceView.surfaceId, "trial");
  assert.ok(payload.topicSurfaceView.items.length >= 1);
  assert.ok(payload.topicSurfaceView.evidenceRefs.length >= 1);
  assertNoSensitiveText(payload);
  assert.equal(afterRaw, beforeRaw);
});
