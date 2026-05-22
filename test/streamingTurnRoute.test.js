const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createInitialState } = require("../src/game/initialState");
const { createLandSurveyDelegatedTask } = require("../src/game/delegatedTasks");
const { resolveTradeRequest } = require("../src/game/tradeLedger");
const { buildTopicSurfaceView } = require("../src/game/topicSurfaceView");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");
const gameRoutePath = require.resolve("../src/routes/game");
const aiPath = require.resolve("../src/ai");

function makeTurnPayload(narrative = "松风入砚，书声稍定。") {
  return {
    narrative,
    statePatch: {
      player: {
        academia: 13
      }
    },
    attributeChanges: [
      {
        path: "player.academia",
        before: 10,
        after: 13,
        reason: "读书有得"
      }
    ],
    relationshipChanges: [],
    events: ["书窗夜读，稍有所得。"],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: ""
    }
  };
}

function makeWritingExam() {
  return {
    examId: "child_exam-streaming-scene",
    level: "child_exam",
    examName: "童试",
    examQuestion: "试论修身读书与县学教化之要。",
    questionType: "经义简答",
    status: "writing"
  };
}

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

function parseSse(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");

      return {
        event: eventLine ? eventLine.slice(6).trim() : "message",
        data: data ? JSON.parse(data) : null
      };
    });
}

function withProvider(provider, callback) {
  const aiModule = require(aiPath);
  const originalGetProvider = aiModule.getProvider;
  aiModule.getProvider = () => provider;
  delete require.cache[gameRoutePath];

  try {
    return callback(require(gameRoutePath));
  } finally {
    aiModule.getProvider = originalGetProvider;
    delete require.cache[gameRoutePath];
  }
}

function createTestServer(provider) {
  return withProvider(provider, (gameRoutes) => {
    const app = express();
    app.use(express.json());
    app.use("/api/game", gameRoutes);

    return createFetchSafeServer(app);
  });
}

async function postTurnJson(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/game/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  assert.equal(response.status, 200);
  return response.json();
}

async function postTurnSse(baseUrl, sessionId, input = "读书", draftContext = undefined) {
  const body = { sessionId, input };
  if (draftContext) {
    body.draftContext = draftContext;
  }
  const response = await fetch(`${baseUrl}/api/game/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify(body)
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/event-stream/);
  return parseSse(await response.text());
}

function seedEconomyTopicSignals(worldState = {}) {
  worldState.year = 1644;
  worldState.month = 4;
  worldState.tenDayPeriod = 1;
  worldState.turnCount = Math.max(Number(worldState.turnCount) || 0, 19);
  worldState.player.localTreasury = 120;
  worldState.npcEconomyLedger = {
    ...(worldState.npcEconomyLedger || {}),
    recentEvents: [
      "人情债月账：韩员外为修桥垫付，公开人情债略增。",
      "provider payload hiddenNotes data/sessions/secret.json"
    ]
  };
  resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:stream:draft-economy",
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
  const delegated = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩，核对鱼鳞册与实耕。",
    budget: 24
  });
  assert.equal(delegated.ok, true);
}

function buildEconomyDraftContext(worldState = {}) {
  const topicView = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  const economyRef = topicView.evidenceRefs.find((ref) => ref.sourceView === "economyTraceView");
  assert.ok(economyRef, "expected a safe economyTraceView topic evidence ref");
  assert.deepEqual(economyRef.canonicalEchoRefs || [], []);
  return {
    surfaceId: "memorial-review",
    draftKind: topicView.draftSlots[0]?.draftKind || "vermilion_comment",
    evidenceRefs: [economyRef.refId, "economyTraceView:forged-secret"],
    canonicalEchoRefs: ["domainConsequenceEcho:forged"],
    generatedAtTurn: topicView.generatedAtTurn,
    status: "client_hint"
  };
}

function snapshotEconomyLedgers(worldState = {}) {
  return {
    cityPolicyCount: worldState.cityPolicyLedger?.records?.length || 0,
    militaryDiplomacyCount: worldState.militaryDiplomacyLedger?.records?.length || 0,
    tradeRecords: JSON.parse(JSON.stringify(worldState.tradeLedger?.records || [])),
    delegatedTasks: JSON.parse(JSON.stringify(worldState.delegatedTaskLedger?.tasks || [])),
    resourceLedger: JSON.parse(JSON.stringify(worldState.resourceLedger || null)),
    npcEconomyRecentEvents: [...(worldState.npcEconomyLedger?.recentEvents || [])],
    playerGold: worldState.player?.gold,
    localTreasury: worldState.player?.localTreasury
  };
}

function assertEconomyDraftDidNotSettle(savedBefore = {}, savedAfter = {}) {
  const before = snapshotEconomyLedgers(savedBefore);
  const after = snapshotEconomyLedgers(savedAfter);
  assert.equal(after.cityPolicyCount, before.cityPolicyCount);
  assert.equal(after.militaryDiplomacyCount, before.militaryDiplomacyCount);
  assert.deepEqual(after.tradeRecords, before.tradeRecords);
  assert.deepEqual(after.delegatedTasks, before.delegatedTasks);
  assert.deepEqual(after.resourceLedger, before.resourceLedger);
  assert.deepEqual(after.npcEconomyRecentEvents, before.npcEconomyRecentEvents);
  assert.equal(after.playerGold, before.playerGold);
  assert.equal(after.localTreasury, before.localTreasury);
}

function assertEconomyDraftResponseSafe(payload = {}) {
  const serialized = JSON.stringify(payload);
  const relationshipChangesText = JSON.stringify(payload.relationshipChanges || []);
  const outcome = payload.roleCycleDomainAdjudication?.outcome;
  assert.equal(outcome?.status, "duplicate_recent");
  assert.equal(outcome?.resolver, "city_policy");
  assert.equal(outcome?.canonicalEchoRefs, undefined);
  assert.equal(outcome?.topicDraftContext, undefined);
  assert.doesNotMatch(relationshipChangesText, /economyTraceView|tradeLedger|delegatedTaskLedger|resourceDelta|relationshipSignals|账解|交易|委派|人情债/);
  assert.equal(payload.worldState?.cityPolicyLedger, undefined);
  assert.equal(payload.worldState?.militaryDiplomacyLedger, undefined);
  assert.equal(payload.worldState?.resourceLedger, undefined);
  assert.doesNotMatch(
    serialized,
    /domainConsequenceEcho:forged|economyTraceView:forged-secret|"tradeLedger":|"delegatedTaskLedger":|"marketPriceLedger":|"npcEconomyLedger":|"resourceDelta":|"relationshipSignals":|"stateDelta":|"playerDelta":|"auditRecord":|provider payload|hiddenNotes|data\/sessions|rawSql|SEALED_/
  );
}

test("POST /api/game/turn streams extracted provider narrative before final_state", async (t) => {
  const payload = makeTurnPayload("松风入砚，问学渐明。");
  const provider = {
    supportsStreaming: true,
    async streamTurn(worldState, input, handlers) {
      const raw = JSON.stringify(payload);
      for (let index = 0; index < raw.length; index += 7) {
        handlers.onTextDelta(raw.slice(index, index + 7));
      }
      return payload;
    },
    async runTurn() {
      throw new Error("runTurn should not be used when streaming succeeds");
    }
  };
  const server = createTestServer(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Streamer" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const events = await postTurnSse(server.baseUrl, worldState.sessionId);
  const narrative = events
    .filter((event) => event.event === "narrative_chunk")
    .map((event) => event.data.text)
    .join("");
  const finalState = events.find((event) => event.event === "final_state");
  const preview = events.find((event) => event.event === "state_preview" && event.data?.aiControlAuditView);

  assert.equal(narrative, payload.narrative);
  assert.ok(finalState);
  assert.ok(preview);
  assert.equal(preview.data.aiControlAuditView.schemaVersion, "s71.11-ai-control-audit.v1");
  assert.equal(finalState.data.aiControlAuditView.schemaVersion, "s71.11-ai-control-audit.v1");
  assert.equal(finalState.data.worldState.turnCount, 1);
  assert.equal(finalState.data.worldState.player.academia, 13);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.turnCount, 1);
  assert.equal(saved.player.academia, 13);
});

test("POST /api/game/turn ignores nested streamed narrative fields", async (t) => {
  const payload = makeTurnPayload("顶层叙事方可入史。");
  const provider = {
    supportsStreaming: true,
    async streamTurn(worldState, input, handlers) {
      const streamed = JSON.stringify({
        statePatch: {
          narrative: "嵌套叙事不可外显。",
          player: {
            academia: 13
          }
        },
        attributeChanges: payload.attributeChanges,
        relationshipChanges: [],
        events: payload.events,
        examTrigger: payload.examTrigger,
        narrative: payload.narrative
      });
      for (let index = 0; index < streamed.length; index += 9) {
        handlers.onTextDelta(streamed.slice(index, index + 9));
      }
      return payload;
    },
    async runTurn() {
      throw new Error("runTurn should not be used when streaming succeeds");
    }
  };
  const server = createTestServer(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "NestedStream" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const events = await postTurnSse(server.baseUrl, worldState.sessionId);
  const narrative = events
    .filter((event) => event.event === "narrative_chunk")
    .map((event) => event.data.text)
    .join("");

  assert.equal(narrative, payload.narrative);
  assert.equal(narrative.includes("嵌套叙事不可外显"), false);
  assert.ok(events.find((event) => event.event === "final_state"));
});

test("POST /api/game/turn preserves SSE fallback when provider has no stream method", async (t) => {
  const payload = makeTurnPayload("案头灯火未歇，心志稍坚。");
  const provider = {
    supportsStreaming: false,
    async runTurn() {
      return payload;
    }
  };
  const server = createTestServer(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Fallback" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const events = await postTurnSse(server.baseUrl, worldState.sessionId);
  const narrative = events
    .filter((event) => event.event === "narrative_chunk")
    .map((event) => event.data.text)
    .join("");

  assert.equal(narrative, payload.narrative);
  assert.ok(events.find((event) => event.event === "final_state"));
});

test("S88.8 true provider stream revalidates economy draftContext without settling economy ledgers", async (t) => {
  const payload = makeTurnPayload("账解已随流式草稿复核。");
  let runTurnCalls = 0;
  let streamTurnCalls = 0;
  const provider = {
    supportsStreaming: true,
    async streamTurn(worldState, input, handlers) {
      streamTurnCalls += 1;
      const raw = JSON.stringify(payload);
      for (let index = 0; index < raw.length; index += 8) {
        handlers.onTextDelta(raw.slice(index, index + 8));
      }
      return payload;
    },
    async runTurn() {
      runTurnCalls += 1;
      return payload;
    }
  };
  const server = createTestServer(provider);
  t.after(server.close);

  const worldState = createInitialState({ role: "magistrate", playerName: "账解真流知县" });
  seedEconomyTopicSignals(worldState);
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const input = "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。";
  const first = await postTurnJson(server.baseUrl, {
    sessionId: worldState.sessionId,
    input
  });
  const savedAfterFirst = await readSession(worldState.sessionId);
  const draftContext = buildEconomyDraftContext(savedAfterFirst);
  const events = await postTurnSse(server.baseUrl, worldState.sessionId, input, draftContext);
  const narrative = events
    .filter((event) => event.event === "narrative_chunk")
    .map((event) => event.data.text)
    .join("");
  const finalState = events.find((event) => event.event === "final_state");
  const savedAfterSecond = await readSession(worldState.sessionId);

  assert.equal(first.roleCycleDomainAdjudication.outcome.status, "accepted");
  assert.equal(runTurnCalls, 1);
  assert.equal(streamTurnCalls, 1);
  assert.equal(narrative, payload.narrative);
  assert.ok(finalState);
  assertEconomyDraftResponseSafe(finalState.data);
  assertEconomyDraftDidNotSettle(savedAfterFirst, savedAfterSecond);
});

test("POST /api/game/turn streams local exam scene actions without global time tick", async (t) => {
  const provider = {
    supportsStreaming: true,
    async streamTurn() {
      throw new Error("provider should not run during active exam scene");
    },
    async runTurn() {
      throw new Error("provider fallback should not run during active exam scene");
    }
  };
  const server = createTestServer(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "ExamSceneStream" });
  worldState.year = 1644;
  worldState.month = 1;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 6;
  worldState.activeExam = makeWritingExam();
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const events = await postTurnSse(server.baseUrl, worldState.sessionId, "拟纲定章法");
  const finalState = events.find((event) => event.event === "final_state");
  const preview = events.find((event) => event.event === "state_preview" && event.data?.worldTick);
  const narrative = events
    .filter((event) => event.event === "narrative_chunk")
    .map((event) => event.data.text)
    .join("");

  assert.match(narrative, /童试/);
  assert.ok(preview);
  assert.equal(preview.data.worldTick.cadence, "scene");
  assert.equal(finalState.data.worldState.turnCount, 6);
  assert.equal(finalState.data.worldState.month, 1);
  assert.equal(finalState.data.worldState.tenDayPeriod, 3);
  assert.equal(finalState.data.worldState.activeExam.sceneTime.phase, "outline");

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.turnCount, 6);
  assert.equal(saved.tenDayPeriod, 3);
  assert.equal(saved.activeExam.sceneTime.phase, "outline");
});

test("POST /api/game/turn emits error and does not mutate state after visible stream failure", async (t) => {
  const provider = {
    supportsStreaming: true,
    async streamTurn(worldState, input, handlers) {
      handlers.onTextDelta('{"narrative":"半卷未终');
      throw new Error("stream schema failed");
    },
    async runTurn() {
      throw new Error("runTurn fallback should not happen after visible streaming");
    }
  };
  const server = createTestServer(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "ErrorCase" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const events = await postTurnSse(server.baseUrl, worldState.sessionId);
  const errorEvent = events.find((event) => event.event === "error");
  const finalState = events.find((event) => event.event === "final_state");

  assert.ok(errorEvent);
  assert.match(errorEvent.data.error, /stream schema failed/);
  assert.equal(finalState, undefined);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.turnCount, 0);
  assert.equal(saved.player.academia, 10);
});
