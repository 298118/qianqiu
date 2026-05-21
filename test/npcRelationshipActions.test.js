const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildNpcRelationshipActionEligibilityView,
  resolveNpcRelationshipAction
} = require("../src/game/npcRelationshipActions");

function assertNoSensitiveLeak(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /hiddenDossier|privateSignalTags|trueAssets|secretRelationships|raw prompt|rawProvider|world_sessions|sk-[A-Za-z0-9_-]{6,}/
  );
}

test("S85.4 relationship action eligibility is server-derived and hidden-safe", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "礼法测试" });
  const view = buildNpcRelationshipActionEligibilityView(worldState, "npc:scholar:matchmaker-lin");

  assert.equal(view.schemaVersion, "s85.4-npc-relationship-actions.v1");
  assert.ok(view.actions.some((action) => action.actionType === "courtship" && action.available));
  assert.ok(view.actions.some((action) => action.actionType === "marriage" && action.available));
  assert.equal(view.safeguards.browserCannotSetSpouseIds, true);
  assert.equal(view.safeguards.browserCannotSetWinnerOrInjury, true);
  assertNoSensitiveLeak(view);
});

test("S85.4 debate, duel and marriage ignore client-forged outcome fields", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "交游测试" });

  const debate = resolveNpcRelationshipAction(worldState, {
    npcId: "npc:scholar:mentor-gu",
    actionType: "debate",
    relationshipDelta: 99,
    resourceDelta: { silver: 1000 }
  }, {
    dialogueText: "顾文衡拈须论经，只许以文章见高下。",
    mood: "郑重"
  });
  assert.equal(debate.ok, true);
  assert.equal(debate.resolutionView.relationshipImpactView.appliedBy, "server");
  assert.equal(debate.resolutionView.resolverTrace.schemaVersion, "s88.7-npc-relationship-resolver-trace.v1");
  assert.equal(debate.resolutionView.resolverTrace.resolver, "npc_relationship_action_resolver");
  assert.equal(debate.resolutionView.resolverTrace.boundaries.resourceAndRelationshipDeltasIgnoredFromClient, true);
  assert.ok(debate.resolutionView.ignoredClientResultFields.includes("relationshipDelta"));
  assert.ok(debate.resolutionView.ignoredClientResultFields.includes("resourceDelta"));

  const duel = resolveNpcRelationshipAction(worldState, {
    npcId: "npc:scholar:peer-shen",
    actionType: "duel",
    winner: "player",
    injury: "npc_injured"
  }, {
    dialogueText: "沈砚秋愿以射艺和步法切磋，胜负仍候裁断。",
    mood: "昂然"
  });
  assert.equal(duel.ok, true);
  assert.equal(duel.resolutionView.worldPeopleImpactView.applied, false);
  assert.ok(duel.resolutionView.ignoredClientResultFields.includes("winner"));
  assert.ok(duel.resolutionView.ignoredClientResultFields.includes("injury"));

  const marriage = resolveNpcRelationshipAction(worldState, {
    npcId: "npc:scholar:matchmaker-lin",
    actionType: "marriage",
    spouseIds: ["player"],
    acceptedMarriage: true
  }, {
    dialogueText: "林知微只称须问长辈与礼法，不敢一言定终身。",
    mood: "端谨"
  });
  assert.equal(marriage.ok, true);
  assert.equal(marriage.resolutionView.worldPeopleImpactView.spouseIdsWritten, false);
  assert.equal(marriage.resolutionView.resolverTrace.disposition, "marriage_ritual_review");
  assert.ok(marriage.resolutionView.ignoredClientResultFields.includes("spouseIds"));
  assert.ok(marriage.resolutionView.ignoredClientResultFields.includes("acceptedMarriage"));
  assertNoSensitiveLeak({ debate, duel, marriage });
});

test("S88.7 relationship action ignored client field names are sanitized", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "字段污染" });
  const result = resolveNpcRelationshipAction(worldState, {
    npcId: "npc:scholar:peer-shen",
    actionType: "duel",
    winner: "player",
    "spouseIds_raw provider /mnt/e/secret sk-testsecret": ["player"],
    "spouseIds_provider_payload": ["player"],
    "resourceDelta_providerPayload_safe_search_index": 999,
    "relationshipDelta_private_signal_tags": 99
  }, {
    dialogueText: "当众切磋，输赢仍由服务器记为公开结果。"
  });
  const serialized = JSON.stringify(result.resolutionView);

  assert.equal(result.ok, true);
  assert.ok(result.resolutionView.ignoredClientResultFields.includes("winner"));
  assert.doesNotMatch(serialized, /raw provider|providerPayload|provider_payload|private_signal_tags|safe_search_index|sk-testsecret|\/mnt\/e/);
});

test("S85.4 blocked courtship and marriage stay server-blocked without relationship writes", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "县署礼法" });
  const result = resolveNpcRelationshipAction(worldState, {
    npcId: "npc:magistrate:gentry-han",
    actionType: "marriage",
    spouseIds: ["player"]
  }, {
    dialogueText: "韩员外只愿代族中问礼。",
    mood: "谨慎"
  });

  assert.equal(result.ok, false);
  assert.equal(result.resolutionView.serverStatus, "server_blocked");
  assert.equal(result.resolutionView.resolverTrace.status, "server_blocked");
  assert.equal(result.resolutionView.resolverTrace.disposition, "blocked_by_server_eligibility");
  assert.ok(result.errors.includes("marriage_status_unavailable"));
  assert.equal(result.resolutionView.worldPeopleImpactView.spouseIdsWritten, false);
  assertNoSensitiveLeak(result);
});
