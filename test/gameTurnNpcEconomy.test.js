const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { createInitialState } = require("../src/game/initialState");
const { createLandSurveyDelegatedTask } = require("../src/game/delegatedTasks");
const { initializeExamProcedure } = require("../src/game/examProcedure");
const { attachExamSceneTime } = require("../src/game/examSceneTime");
const { resolveTradeRequest } = require("../src/game/tradeLedger");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      error: err.message || "Internal server error",
      details: err.details || null
    });
  });
  return createFetchSafeServer(app);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

test("S85 /api/game/turn runs monthly NPC economy and returns only safe views", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "magistrate", playerName: "S85 路由知县" });
  worldState.year = 1644;
  worldState.month = 2;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 10;
  worldState.player.localTreasury = 80;

  const task = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩，核对鱼鳞册。",
    budget: 24
  });
  assert.equal(task.ok, true);
  task.task.dueTime = { year: 1644, month: 3, tenDayPeriod: 1, turn: 11 };

  const trade = resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:s85:route-old-paper",
    silverDelta: 0,
    offerSummary: "议买纸张与地方消息。"
  }, {
    npcResponse: "可再议。",
    proposal: {
      status: "countered",
      publicSummary: "暂记议价，待后续确认。",
      riskTags: []
    }
  });
  assert.equal(trade.ok, true);
  trade.record.turn = 1;

  await writeSession(worldState);
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "巡看东乡，令陆知事呈清丈进度。"
  });
  const serialized = JSON.stringify(payload);

  assert.equal(response.status, 200);
  assert.equal(payload.worldTick.completedMonth, true);
  assert.equal(payload.npcEconomy.cadence, "monthly");
  assert.equal(payload.npcEconomy.outcome.delegatedTasksResolved, 1);
  assert.equal(payload.npcEconomy.outcome.tradeCommitmentsUpdated, 1);
  assert.ok(payload.marketPriceView.priceRows.some((row) => row.priceId === "grain_shi"));
  assert.ok(payload.npcEconomyView.recentEvents.length >= 1);
  assert.ok(["completed", "failed"].includes(payload.delegatedTaskView.items[0].status));
  assert.equal(payload.tradeLedgerView.items[0].status, "rejected");
  assert.equal(payload.worldState.marketPriceLedger, undefined);
  assert.equal(payload.worldState.npcEconomyLedger, undefined);
  assert.doesNotMatch(
    serialized,
    /"marketPriceLedger":|"npcEconomyLedger":|"assetLedger":|"inventoryLedger":|"tradeLedger":|"delegatedTaskLedger":|"hiddenDossier":|"privateSignalTags":|"rawLedger":|sk-[A-Za-z0-9_-]{6,}/
  );
  assert.doesNotMatch(serialized, /"path":"(?:assetLedger|resourceLedger|inventoryLedger)\./);

  const record = await readSession(worldState.sessionId);
  assert.ok(record.marketPriceLedger.priceRows.length > 0);
  assert.equal(record.npcEconomyLedger.lastTickTurn, payload.worldState.turnCount);

  const playerStateResponse = await fetch(`${server.baseUrl}/api/game/player-state/${worldState.sessionId}`);
  const playerStatePayload = await playerStateResponse.json();
  const playerStateSerialized = JSON.stringify(playerStatePayload);
  assert.equal(playerStateResponse.status, 200);
  assert.ok(playerStatePayload.marketPriceView.priceRows.length > 0);
  assert.ok(playerStatePayload.npcEconomyView.recentEvents.length >= 1);
  assert.doesNotMatch(
    playerStateSerialized,
    /"marketPriceLedger":|"npcEconomyLedger":|"hiddenDossier":|"privateSignalTags":|"rawLedger":|sk-[A-Za-z0-9_-]{6,}/
  );
});

test("S85 /api/game/turn keeps exam entry scene local and does not run NPC economy", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "magistrate", playerName: "候场知县" });
  worldState.year = 1644;
  worldState.month = 2;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 10;
  worldState.player.localTreasury = 80;
  worldState.activeExam = {
    level: "child_exam",
    examName: "县试",
    reason: "测试入场态",
    examCalendar: { isOpen: true }
  };
  attachExamSceneTime(worldState.activeExam, worldState, "entry");
  initializeExamProcedure(worldState.activeExam);

  const task = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩，核对鱼鳞册。",
    budget: 24
  });
  assert.equal(task.ok, true);
  task.task.dueTime = { year: 1644, month: 3, tenDayPeriod: 1, turn: 11 };

  await writeSession(worldState);
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "入场点名，静候发题。"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldTick.cadence, "scene");
  assert.equal(payload.worldTick.completedMonth, false);
  assert.equal(payload.npcEconomy, undefined);
  assert.equal(payload.worldState.month, 2);
  assert.equal(payload.worldState.tenDayPeriod, 3);
  assert.equal(payload.delegatedTaskView.items[0].status, "active");

  const record = await readSession(worldState.sessionId);
  assert.equal(record.delegatedTaskLedger.tasks[0].status, "active");
  assert.equal(record.month, 2);
  assert.equal(record.tenDayPeriod, 3);
});
