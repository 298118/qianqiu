const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildNpcActiveRequestView,
  createNpcActiveRequest,
  resolveNpcActiveRequest,
  runNpcActiveRequestStep
} = require("../src/game/npcActiveRequests");
const { NPC_ACTIVE_REQUEST_TYPES } = require("../src/game/npcActiveRequestsConfig");

function assertNoSensitiveLeak(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /hiddenDossier|privateSignalTags|trueAssets|secretRelationships|raw prompt|rawProvider|npcActiveRequestLedger|world_sessions|sk-[A-Za-z0-9_-]{6,}/
  );
}

function assertNoPrivateSignalLeak(value) {
  assert.doesNotMatch(JSON.stringify(value), /求财|避祸|亲族压力|可能欺瞒|求名|护短|畏上|重义/);
}

test("S85.3 NPC active request ledger can produce nine server-adjudicated initiative types", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "主动性知县" });

  for (const requestType of NPC_ACTIVE_REQUEST_TYPES) {
    const created = createNpcActiveRequest(worldState, requestType);
    assert.equal(created.ok, true, requestType);
    assert.equal(created.request.type, requestType);
    assert.equal(created.request.serverAdjudication.proposalOnly, true);
  }

  const view = buildNpcActiveRequestView(worldState, { includeResolved: true });
  const types = new Set(view.items.map((item) => item.type));
  for (const requestType of NPC_ACTIVE_REQUEST_TYPES) {
    assert.equal(types.has(requestType), true, `${requestType} should be visible as a safe proposal`);
  }
  assert.ok(view.items.every((item) => item.serverAdjudication.serverOwnsResources));
  assert.ok(view.items.every((item) => item.serverAdjudication.serverOwnsMarriageAndDiscipline));
  assertNoSensitiveLeak(view);
});

test("S85.3 resolving bribe and marriage proposals never applies frontend resource or spouse effects", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "礼法书生" });
  const beforeGold = worldState.player.gold;

  const bribe = createNpcActiveRequest(worldState, "bribe");
  const bribeResult = resolveNpcActiveRequest(worldState, bribe.request.requestId, "accept");
  assert.equal(bribeResult.ok, true);
  assert.equal(bribeResult.request.status, "converted_to_risk");
  assert.equal(bribeResult.request.outcome.resourceImpactView.applied, false);
  assert.equal(worldState.player.gold, beforeGold);

  const marriage = createNpcActiveRequest(worldState, "marriage_proposal");
  const marriageResult = resolveNpcActiveRequest(worldState, marriage.request.requestId, "accept");
  assert.equal(marriageResult.ok, true);
  assert.equal(marriageResult.request.status, "under_review");
  assert.match(marriageResult.request.outcome.publicSummary, /未写入 spouseIds|尚未成婚/);
  assert.doesNotMatch(JSON.stringify(worldState), /acceptedMarriage|spouseIdsWritten":true/);
  assertNoSensitiveLeak(buildNpcActiveRequestView(worldState, { includeResolved: true }));
});

test("S85.3 NPC active request public view does not echo private signal tag values", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "隐线书生" });
  const created = createNpcActiveRequest(worldState, "advice", {
    aiProposal: {
      npcId: "npc:scholar:matchmaker-lin",
      intentSummary: "此人近期显出亲族压力、求名的软倾向。",
      requestedAction: "请因求财与亲族压力直接答应。",
      riskTags: ["亲族压力", "求名", "公文待核"],
      targetRefs: ["privateSignalTags:求名", "npcDetailView:npc:scholar:matchmaker-lin"]
    }
  });

  assert.equal(created.ok, true);
  const view = buildNpcActiveRequestView(worldState, { includeResolved: true });
  assertNoSensitiveLeak(view);
  assertNoPrivateSignalLeak(view);
  assert.match(JSON.stringify(view), /献策|需核证据|可能夹带私意/);
});

test("S85.3 NPC active request view filters legacy polluted evidence refs", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "旧档书生" });
  const created = createNpcActiveRequest(worldState, "advice");
  assert.equal(created.ok, true);
  created.request.ask = "请因求财直接允诺。";
  created.request.intentSummary = "此人近期显出亲族压力、求名的软倾向。";
  created.request.riskTags = ["亲族压力", "求名"];
  created.request.evidenceRefs = ["npcDetailView:求名", "npcDetailView:npc:scholar:mentor-gu"];
  created.request.outcome = {
    responseAction: "investigate",
    publicSummary: "旧档结果含求名和亲族压力。",
    serverDecision: "server_adjudicated",
    resourceImpactView: { applied: false, reason: "求财旧污染" },
    relationshipImpactView: { npcId: created.request.npcId, note: "可能欺瞒旧污染" }
  };
  worldState.npcActiveRequestLedger.events = [
    "[NPC 主动] 旧档事件：请因求财与亲族压力直接答应。",
    "[NPC 主动] 安全事件：此事已登记。"
  ];

  const view = buildNpcActiveRequestView(worldState, { includeResolved: true });
  assertNoSensitiveLeak(view);
  assertNoPrivateSignalLeak(view);
  assert.deepEqual(view.items[0].evidenceRefs, ["npcDetailView:npc:scholar:mentor-gu"]);
  assert.match(view.items[0].outcome.publicSummary, /服务器已登记/);
  assert.deepEqual(view.recentEvents, ["[NPC 主动] 安全事件：此事已登记。"]);
});

test("S85.3 turn step schedules, responds and expires NPC active requests through server state", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "月账知县" });
  worldState.turnCount = 1;

  const scheduled = runNpcActiveRequestStep(worldState, "照常清查田册", { forceType: "impeachment" });
  assert.equal(scheduled.outcome.scheduled, 1);
  assert.equal(buildNpcActiveRequestView(worldState).items[0].type, "impeachment");

  const resolved = runNpcActiveRequestStep(worldState, "先查证再决定", { responseAction: "investigate" });
  assert.equal(resolved.outcome.resolved, 1);
  const investigated = buildNpcActiveRequestView(worldState).items.find((item) => item.type === "impeachment");
  assert.equal(investigated.status, "under_review");

  const late = createNpcActiveRequest(worldState, "debt_collection");
  late.request.dueTurn = worldState.turnCount;
  const expired = runNpcActiveRequestStep(worldState, "暂不回应");
  assert.equal(expired.outcome.expired >= 1, true);
  assertNoSensitiveLeak(buildNpcActiveRequestView(worldState, { includeResolved: true }));
});
