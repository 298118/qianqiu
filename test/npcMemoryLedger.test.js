const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { buildPlayerStateEnvelope } = require("../src/game/redactedState");
const { createScene, buildSceneActorContext } = require("../src/game/sceneRuntime");
const { searchSafeWorldIndex } = require("../src/game/safeWorldSearch");
const {
  applyTurnActorMemoryUpdates,
  buildActorMemoryView,
  deriveNpcBackgroundMemoryProposals,
  memoryProposalsFromNpcMindResult,
  summarizeActorMemoryForPrompt
} = require("../src/game/actorMemoryLedger");

function serialized(value) {
  return JSON.stringify(value);
}

test("S71.10 background NPC heuristic writes visible long-term goals and social debts", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "记忆账本测试" });
  const teacher = worldState.characters.find((character) => character.id === "C01");
  const teacherNpc = worldState.worldPeople.npcs.find((npc) => npc.id === "C01");
  const teacherRelationship = worldState.relationshipLedger.characters.C01;
  teacher.currentGoal = "督促玩家勤学，并观察其是否守礼。";
  teacherNpc.currentGoal = teacher.currentGoal;
  teacherRelationship.recentIntent = teacher.currentGoal;
  teacherRelationship.relationship = 32;
  teacherRelationship.trust = 70;
  teacherRelationship.obligation = 12;

  const proposals = deriveNpcBackgroundMemoryProposals(worldState, { maxProposals: 4 });
  const result = applyTurnActorMemoryUpdates(worldState, {
    npcMemory: { includeBackground: true, maxProposals: 4 }
  });
  const repeated = applyTurnActorMemoryUpdates(worldState, {
    npcMemory: { includeBackground: true, maxProposals: 4 }
  });
  teacher.currentGoal = "整顿书院风气，并重新观察玩家应对。";
  teacherNpc.currentGoal = teacher.currentGoal;
  teacherRelationship.recentIntent = teacher.currentGoal;
  const changed = applyTurnActorMemoryUpdates(worldState, {
    npcMemory: { includeBackground: true, maxProposals: 4 }
  });
  const view = buildActorMemoryView(worldState, "npc:C01");
  const prompt = summarizeActorMemoryForPrompt(worldState, "npc:C01");

  assert.ok(proposals.some((proposal) => proposal.type === "current_goal"));
  assert.ok(proposals.some((proposal) => proposal.type === "obligation" || proposal.type === "favor"));
  assert.ok(result.appliedCount >= 1);
  assert.equal(repeated.appliedCount, 0);
  assert.equal(repeated.reinforcedCount, 0);
  assert.ok(changed.appliedCount >= 1);
  assert.match(serialized(view), /current_goal|obligation|favor/);
  assert.match(serialized(view), /督促玩家勤学|整顿书院风气|人情往来/);
  assert.match(serialized(prompt), /actorMemory/);
  assert.doesNotMatch(serialized({ view, prompt }), /actorMemoryLedger|hiddenNotes|rawSql|provider proposal|\/home|sk-test/i);
});

test("S71.10 NPC mind memory candidates enter ledger through server proposal boundaries", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "心念入账" });
  const npcMindResult = {
    proposal: {
      proposalId: "npc-mind:C01:resentment",
      actorId: "npc:C01",
      npcId: "C01",
      intentType: "obstruct",
      confidence: 0.77
    },
    memoryCandidates: [{
      actorId: "npc:C02",
      summary: "顾文衡记得玩家曾当众驳斥他的讲章。"
    }, {
      summary: "顾文衡另记玩家在书院中出手相助同窗。"
    }, {
      summary: "hiddenIntent /home/user/.env sk-test-secret"
    }]
  };

  const proposed = memoryProposalsFromNpcMindResult(npcMindResult);
  const result = applyTurnActorMemoryUpdates(worldState, { npcMindResults: [npcMindResult] });
  const view = buildActorMemoryView(worldState, "npc:C01");

  assert.equal(proposed.length, 3);
  assert.equal(proposed[0].actorId, "npc:C01");
  assert.equal(result.appliedCount, 2);
  assert.equal(result.rejectedCount, 1);
  assert.ok(result.rejectedReasons.includes("unsafe_or_empty_summary"));
  assert.match(serialized(view), /grievance|驳斥他的讲章/);
  assert.match(serialized(view), /书院中出手相助同窗/);
  assert.doesNotMatch(serialized({ result, view }), /hiddenIntent|\/home\/user|sk-test-secret/);
});

test("S71.10 NPC family risk memories remain redacted from raw state, search, prompt, and scene context", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "家门风险" });
  const teacher = worldState.worldPeople.npcs.find((npc) => npc.id === "C01");
  teacher.legalRisk = 48;
  teacher.currentGoal = "hiddenNotes rawSql /mnt/e/secret sk-test-secret";

  const result = applyTurnActorMemoryUpdates(worldState, {
    npcMemory: { includeBackground: true, maxProposals: 4 }
  });
  const view = buildActorMemoryView(worldState, "npc:C01");
  const prompt = summarizeActorMemoryForPrompt(worldState, "npc:C01");
  const search = searchSafeWorldIndex(worldState, { query: "顾文衡", pageSize: 10 });
  const envelope = buildPlayerStateEnvelope(worldState);
  const scene = createScene(worldState, { sceneType: "judicial_hearing" });
  const sceneContext = buildSceneActorContext(scene, scene.participants[0].actorProfile);

  assert.ok(result.appliedCount >= 1);
  assert.match(serialized(view), /family_risk|家门与身家风险/);
  assert.equal(envelope.worldState.actorMemoryLedger, undefined);
  assert.doesNotMatch(
    serialized({ view, prompt, search, envelope, sceneContext }),
    /hiddenNotes|rawSql|\/mnt\/e\/secret|sk-test-secret|actorMemoryLedger|world_sessions|prompt_retrieval_index/i
  );
});
