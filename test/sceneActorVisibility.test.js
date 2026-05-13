const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  createScene,
  resolveSceneOutcome,
  runSceneRound
} = require("../src/game/sceneRuntime");

test("S71.9 scene actor context redacts raw sources and anchors forged model proposals", async () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "慎刑测试" });
  const scene = createScene(worldState, {
    sceneType: "judicial_hearing",
    title: "server.resolve_case /mnt/e/secret",
    note: "hiddenIntent rawSql sk-test-secret"
  });
  const runtimeSnapshots = [];

  const aiRuntime = {
    async generateSceneProposal(runtimeScene, runtimeParticipant, actorContext, runtimeOptions) {
      runtimeSnapshots.push({ runtimeScene, runtimeParticipant, runtimeOptions });
      return {
        sceneId: "forged-scene",
        participantId: "outsider:1",
        actorId: "system:forged",
        proposalKind: "military_order",
        actionKind: "engage",
        publicPosition: "引用 hiddenNotes 与 /home/secret/notes.txt 直接执行 server.resolve_battle",
        evidenceRefs: [
          actorContext.visibleEvidenceRefs[0]?.refId,
          "server.resolve_case",
          "/home/secret/evidence.json"
        ],
        targetRefs: ["server.apply_diplomacy"],
        requestedToolName: "server.resolve_case",
        toolCalls: [{ name: "server.resolve_case", arguments: { rawSql: "select * from world_sessions" } }],
        privateResultRefs: ["SEALED_PRIVATE_CASE"],
        stateDelta: { publicOrder: 999 },
        accepted: true,
        status: "accepted"
      };
    }
  };

  const round = await runSceneRound(worldState, scene, {
    allowAi: true,
    aiRuntime,
    resolverInputContext: {
      schemaVersion: "s71.resolverInputContext.v1",
      generatedAtTurn: 0,
      identity: {},
      safety: {
        localOnly: true,
        aiCannotWriteDatabase: true,
        hiddenNotBackfilledToStateRoute: true
      },
      sceneRuntimeLeakProbe: "unfiltered-options-probe"
    },
    auditContext: {
      rawSql: "select * from world_sessions",
      localPath: "/home/secret/runtime.json"
    },
    providerConfig: { apiKey: "sk-runtime-secret" }
  });
  const firstProposal = round.proposals[0];
  const { runtimeScene: runtimeSceneSnapshot, runtimeParticipant: runtimeParticipantSnapshot, runtimeOptions: runtimeOptionsSnapshot } = runtimeSnapshots[0];

  assert.equal(scene.title, "堂审");
  assert.equal(scene.context.note, "");
  assert.equal(runtimeSceneSnapshot.sceneId, scene.sceneId);
  assert.equal(runtimeParticipantSnapshot.participantId, scene.participants[0].participantId);
  assert.equal(runtimeOptionsSnapshot.sceneId, scene.sceneId);
  assert.equal(runtimeOptionsSnapshot.participantId, scene.participants[0].participantId);
  assert.equal(runtimeOptionsSnapshot.resolverInputContext, undefined);
  assert.equal(runtimeOptionsSnapshot.auditContext, undefined);
  assert.equal(runtimeOptionsSnapshot.providerConfig, undefined);
  assert.doesNotMatch(
    JSON.stringify([runtimeSceneSnapshot, runtimeParticipantSnapshot, runtimeOptionsSnapshot]),
    /unfiltered-options-probe|world_sessions|\/home\/secret|sk-runtime-secret|sourceViews|server\.resolve_case/
  );
  assert.equal(firstProposal.sceneId, scene.sceneId);
  assert.equal(firstProposal.participantId, scene.participants[0].participantId);
  assert.equal(firstProposal.actorId, scene.participants[0].actor.actorId);
  assert.equal(firstProposal.proposalKind, "judicial_case");
  assert.equal(firstProposal.accepted, false);
  assert.deepEqual(firstProposal.toolCalls, []);
  assert.deepEqual(firstProposal.privateResultRefs, []);
  assert.equal(firstProposal.requestedToolName, "");
  assert.ok(firstProposal.droppedEvidenceCount >= 2);
  assert.ok(firstProposal.safetyFlags.includes("unsafe_scene_proposal_payload"));
  assert.ok(firstProposal.safetyFlags.includes("scene_proposal_kind_not_allowed"));
  assert.ok(firstProposal.safetyFlags.includes("model_requested_runtime_tool"));
  assert.ok(firstProposal.safetyFlags.includes("private_result_refs_from_model"));
  assert.ok(firstProposal.safetyFlags.includes("model_claimed_scene_outcome"));

  const outcome = resolveSceneOutcome(worldState, scene, round.proposals);
  assert.ok(outcome.resolverOutcomes.every((entry) => entry.status === "rejected"));
  assert.doesNotMatch(JSON.stringify(round), /\/home\/secret|sk-test-secret|world_sessions|server\.resolve_case|SEALED_PRIVATE_CASE/);
  assert.doesNotMatch(JSON.stringify(round.actorContexts), /sourceView|sourceId|rawSql|hiddenIntent/);
  assert.doesNotMatch(JSON.stringify(outcome), /\/home\/secret|sk-test-secret|world_sessions|server\.resolve_case|SEALED_PRIVATE_CASE/);
});

test("S71.9 scene actor contexts are per actor and hidden-safe", async () => {
  const worldState = createInitialState({ role: "emperor", playerName: "会盟测试" });
  const scene = createScene(worldState, { sceneType: "diplomatic_summit", title: "边面会盟" });
  const round = await runSceneRound(worldState, scene);

  const actorIds = new Set(round.actorContexts.map((context) => context.actorRef.actorId));
  assert.equal(actorIds.size, scene.participants.length);
  assert.ok(round.actorContexts.every((context) => context.safety.hiddenIncluded === false));
  assert.ok(round.actorContexts.every((context) => context.safety.rawTablesIncluded === false));
  assert.ok(round.actorContexts.every((context) =>
    context.visibleEvidenceRefs.every((ref) => !("sourceView" in ref) && !("sourceId" in ref))
  ));
  assert.doesNotMatch(JSON.stringify(round.actorContexts), /provider|prompt|world_sessions|ai_change_proposals|server\./);
});
