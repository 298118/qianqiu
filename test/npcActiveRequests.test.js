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
  assert.equal(bribeResult.request.outcome.resolverTrace.schemaVersion, "s88.7-npc-active-request-resolver-trace.v1");
  assert.equal(bribeResult.request.outcome.resolverTrace.resolver, "npc_active_request_resolver");
  assert.equal(bribeResult.request.outcome.resolverTrace.boundaries.serverOwnsResources, true);
  assert.equal(bribeResult.request.outcome.resolverTrace.boundaries.serverOwnsMarriageAndDiscipline, true);
  assert.ok(bribeResult.request.auditRefs.includes(bribeResult.request.outcome.resolverTrace.publicResolutionRef));
  assert.equal(bribeResult.request.outcome.resourceImpactView.applied, false);
  assert.equal(bribeResult.request.outcome.followUpView.schemaVersion, "s88.7-npc-active-request-follow-up.v1");
  assert.equal(bribeResult.request.outcome.followUpView.followUpKind, "integrity_risk_review");
  assert.equal(bribeResult.request.outcome.followUpView.boundaries.resourcesNotApplied, true);
  assert.equal(worldState.player.gold, beforeGold);

  const marriage = createNpcActiveRequest(worldState, "marriage_proposal");
  const marriageResult = resolveNpcActiveRequest(worldState, marriage.request.requestId, "accept");
  assert.equal(marriageResult.ok, true);
  assert.equal(marriageResult.request.status, "under_review");
  assert.equal(marriageResult.request.outcome.resolverTrace.disposition, "ritual_family_review");
  assert.equal(marriageResult.request.outcome.followUpView.followUpKind, "ritual_family_review");
  assert.match(marriageResult.request.outcome.publicSummary, /未写入 spouseIds|尚未成婚/);
  assert.doesNotMatch(JSON.stringify(worldState), /acceptedMarriage|spouseIdsWritten":true/);
  assertNoSensitiveLeak(buildNpcActiveRequestView(worldState, { includeResolved: true }));
});

test("S88.7 NPC active request follow-up view gives type-specific safe next actions", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "来函后续" });
  worldState.turnCount = 6;
  const expectations = [
    ["debt_collection", "investigate", "human_debt_review", /钱债|人情债/],
    ["petition", "investigate", "petition_obligation_review", /请托|公私边界/],
    ["bribe", "report", "integrity_risk_review", /廉政|禁收财物/],
    ["impeachment", "investigate", "impeachment_evidence_review", /弹劾|证据/],
    ["introduction", "accept", "network_introduction_review", /引荐|人脉/],
    ["betrayal", "investigate", "betrayal_risk_review", /背叛|查证/]
  ];

  for (const [requestType, responseAction, followUpKind, expectedText] of expectations) {
    const created = createNpcActiveRequest(worldState, requestType);
    assert.equal(created.ok, true, requestType);
    const beforeView = buildNpcActiveRequestView(worldState, { includeResolved: true });
    const beforeItem = beforeView.items.find((item) => item.requestId === created.request.requestId);
    assert.ok(beforeItem, requestType);
    assert.ok(beforeItem.responseOptions.some((option) => option.responseAction === responseAction));
    assert.match(JSON.stringify(beforeItem.responseOptions), /服务器裁决/);

    const resolved = resolveNpcActiveRequest(worldState, created.request.requestId, responseAction);
    assert.equal(resolved.ok, true, requestType);
    const afterView = buildNpcActiveRequestView(worldState, { includeResolved: true });
    const afterItem = afterView.items.find((item) => item.requestId === created.request.requestId);
    assert.ok(afterItem, requestType);
    assert.deepEqual(afterItem.responseOptions, []);
    assert.deepEqual(afterItem.allowedResponseActions, []);
    const afterTask = afterView.followUpTasks.find((task) => task.requestId === created.request.requestId);
    assert.ok(afterTask, requestType);
    assert.equal(afterTask.boundaries.serverOwnsFollowUp, true);
    assert.equal(afterTask.boundaries.proposalOnly, true);
    assert.equal(afterTask.boundaries.browserDraftOnly, true);
    assert.match(afterTask.draftText, /续办|核|登记|查/);
    const followUp = resolved.request.outcome.followUpView;
    assert.equal(followUp.followUpKind, followUpKind);
    assert.equal(followUp.boundaries.serverOwnsFollowUp, true);
    assert.equal(followUp.boundaries.browserDraftOnly, true);
    assert.match(JSON.stringify(followUp), expectedText);
    assert.doesNotMatch(
      JSON.stringify({ followUp, afterTask }),
      /hiddenDossier|privateSignalTags|trueAssets|secretRelationships|rawProvider|statePatch|world_sessions|sk-[A-Za-z0-9_-]{6,}/
    );
  }

  const deferred = createNpcActiveRequest(worldState, "help");
  assert.equal(deferred.ok, true);
  const deferredResult = resolveNpcActiveRequest(worldState, deferred.request.requestId, "defer");
  assert.equal(deferredResult.request.status, "deferred");
  const deferredItem = buildNpcActiveRequestView(worldState, { includeResolved: true })
    .items.find((item) => item.requestId === deferred.request.requestId);
  assert.equal(deferredItem.status, "deferred");
  assert.ok(deferredItem.responseOptions.length > 0);
  assert.ok(deferredItem.allowedResponseActions.includes("accept"));
  assert.equal(
    buildNpcActiveRequestView(worldState, { includeResolved: true })
      .followUpTasks.some((task) => task.requestId === deferred.request.requestId),
    false
  );

  const refused = createNpcActiveRequest(worldState, "petition");
  assert.equal(refused.ok, true);
  const refusedResult = resolveNpcActiveRequest(worldState, refused.request.requestId, "refuse");
  assert.equal(refusedResult.request.status, "refused");
  assert.equal(
    buildNpcActiveRequestView(worldState, { includeResolved: true })
      .followUpTasks.some((task) => task.requestId === refused.request.requestId),
    false
  );

  assertNoSensitiveLeak(buildNpcActiveRequestView(worldState, { includeResolved: true }));
});

test("S88.7 active request views and feedback sanitize polluted legacy identity fields", () => {
  const worldState = createInitialState({ playerName: "来函污染", role: "magistrate" });
  worldState.turnCount = 8;
  const created = createNpcActiveRequest(worldState, "bribe");
  assert.equal(created.ok, true);

  created.request.npcName = "hiddenDossier providerPayload /mnt/e/secret sk-testsecret";
  created.request.npcTitle = "privateSignalTags 亲族压力";
  created.request.typeLabel = "raw provider safe_search_index";
  created.request.title = "providerPayload safe_search_fts sk-testsecret";
  created.request.ask = "provider_payload private_signal_tags hidden_dossier";
  created.request.serverAdjudication.status = "raw providerPayload";
  worldState.npcActiveRequestLedger.events.push("[NPC 主动] 亲族压力 providerPayload safe_search_index sk-testsecret");

  const view = buildNpcActiveRequestView(worldState);
  const resolved = resolveNpcActiveRequest(worldState, created.request.requestId, "report");
  const publicAfterResolve = buildNpcActiveRequestView(worldState, { includeResolved: true });
  const serialized = JSON.stringify({
    view,
    publicAfterResolve,
    events: resolved.events,
    resolutionTrace: resolved.resolutionTrace,
    attributeChanges: resolved.attributeChanges
  });

  assert.equal(resolved.ok, true);
  assert.equal(view.items[0].npc.displayName, "韩员外");
  assert.doesNotMatch(
    serialized,
    /providerPayload|provider_payload|private_signal_tags|hidden_dossier|safe_search_index|safe_search_fts|sk-testsecret|\/mnt\/e|privateSignalTags|亲族压力|"hiddenDossier"|raw provider/
  );
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
  assert.equal(resolved.outcome.resolutionTraces.length, 1);
  assert.equal(resolved.outcome.resolutionTraces[0].resolver, "npc_active_request_resolver");
  const investigated = buildNpcActiveRequestView(worldState).items.find((item) => item.type === "impeachment");
  assert.equal(investigated.status, "under_review");
  assert.equal(investigated.outcome.resolverTrace.disposition, "impeachment_evidence_review");

  const late = createNpcActiveRequest(worldState, "debt_collection");
  late.request.dueTurn = worldState.turnCount;
  const expired = runNpcActiveRequestStep(worldState, "暂不回应");
  assert.equal(expired.outcome.expired >= 1, true);
  assertNoSensitiveLeak(buildNpcActiveRequestView(worldState, { includeResolved: true }));
});
