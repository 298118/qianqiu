const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  createCourtDebateScene,
  runInstitutionSceneRound
} = require("../src/game/institutionScenes");

test("S70.5 institution scene context redacts source tokens and local paths", async () => {
  const worldState = createInitialState({ role: "minister", playerName: "清议测试" });
  const scene = createCourtDebateScene(
    worldState,
    "provider prompt /mnt/e/secret.txt",
    { note: "file:///home/user/.env proposal" }
  );

  assert.equal(scene.context.topic, "待议事项");
  assert.equal(scene.context.note, "");
  assert.equal(JSON.stringify(scene.context).includes("/mnt/e"), false);
  assert.equal(JSON.stringify(scene.context).includes("file:///home"), false);

  const standaloneScene = createCourtDebateScene(
    worldState,
    "source hidden raw path key server.apply_appointment",
    { note: "source hidden raw path key server.resolve_case" }
  );
  assert.equal(standaloneScene.context.topic, "待议事项");
  assert.equal(standaloneScene.context.note, "");

  const round = await runInstitutionSceneRound(scene, {
    async generateInstitutionProposal() {
      return {
        sceneId: "wrong-scene",
        participantId: "wrong-participant",
        actorId: "npc:C99",
        proposalType: "edict_now",
        proposalId: "server.apply_appointment",
        publicPosition: "source hidden raw path key provider server.apply_appointment",
        evidenceRefs: ["/home/user/.env", "prompt", "source", "hidden", "raw", "server.apply_appointment", "公开证据"],
        visibleEffects: ["proposal", "path", "key", "server.resolve_case", "公开影响"],
        riskTags: ["server.apply_diplomacy", "公开风险"],
        requestedToolName: "server.apply_appointment",
        toolCalls: [{ name: "server.apply_appointment" }]
      };
    }
  }, { allowAi: true });
  const first = round.proposals[0];

  assert.equal(first.sceneId, scene.sceneId);
  assert.equal(first.participantId, scene.participants[0].participantId);
  assert.equal(first.actorId, scene.participants[0].actor.actorId);
  assert.equal(first.proposalType, "defer_to_resolver");
  assert.equal(first.publicPosition, "制度场景意见候选。");
  assert.deepEqual(first.evidenceRefs, ["公开证据"]);
  assert.deepEqual(first.visibleEffects, ["公开影响"]);
  assert.deepEqual(first.riskTags, ["公开风险"]);
  assert.equal(first.requestedToolName, "");
  assert.deepEqual(first.toolCalls, []);
  assert.equal(first.authorityBoundary.includes("proposal"), false);
  assert.equal(JSON.stringify(first).includes("/home/user"), false);
  assert.equal(JSON.stringify(first).includes("server.apply"), false);
  assert.equal(JSON.stringify(first).includes("server.resolve"), false);
  assert.equal(JSON.stringify(first).includes("provider"), false);
  assert.equal(JSON.stringify(first).includes("prompt"), false);
  assert.equal(JSON.stringify(first).includes("source"), false);
  assert.equal(JSON.stringify(first).includes("hidden"), false);
  assert.equal(JSON.stringify(first).includes("raw"), false);
});
