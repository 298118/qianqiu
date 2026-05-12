const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  applyNpcMindProposal,
  buildHeuristicProposal,
  buildNpcMindActorProfile,
  buildNpcMindPromptContext,
  generateNpcMindProposal,
  rankNpcSalience
} = require("../src/game/npcMind");

test("S70.4 builds NPC mind context from visible projection and actor profile", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "问学士子" });
  const actorProfile = buildNpcMindActorProfile(worldState, "C01");
  const context = buildNpcMindPromptContext(worldState, actorProfile);
  const serialized = JSON.stringify(context);

  assert.equal(context.schemaVersion, 1);
  assert.equal(context.actor.actorType, "teacher");
  assert.equal(context.npc.id, "C01");
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("raw provider"), false);
  assert.equal(serialized.includes("prompt_retrieval_index"), false);
});

test("S70.4 heuristic NPC proposal is deterministic and server-applied", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "问学士子" });
  const actorProfile = buildNpcMindActorProfile(worldState, "C01");
  const context = buildNpcMindPromptContext(worldState, actorProfile);
  const proposal = await generateNpcMindProposal(worldState, actorProfile, null, { context });
  const auditContext = { npcMindRecords: [] };
  const result = applyNpcMindProposal(worldState, proposal, auditContext);

  assert.equal(proposal.npcId, "C01");
  assert.equal(proposal.toolCalls.length, 0);
  assert.ok(result.events.length >= 1);
  assert.ok(result.memoryCandidates.length >= 1);
  assert.equal(auditContext.npcMindRecords.length, 1);
  assert.equal(worldState.relationshipLedger.characters.C01.recentIntent.includes("顾文衡"), true);
});

test("S70.4 heuristic proposal reflects active request pressure", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "请托测试" });
  worldState.activeNpcRequest = {
    id: "REQ-test",
    status: "active",
    kind: "request",
    targetType: "character",
    targetId: "C01",
    sourceName: "顾文衡",
    title: "顾文衡有事相托",
    ask: "盼你近两回合回应。",
    createdTurn: 0,
    dueTurn: 2,
    lastUpdatedTurn: 0
  };
  const actorProfile = buildNpcMindActorProfile(worldState, "C01");
  const context = buildNpcMindPromptContext(worldState, actorProfile);
  const proposal = buildHeuristicProposal(worldState, actorProfile, context);

  assert.equal(proposal.intentType, "request");
  assert.match(proposal.publicSummary, /请托/);
  assert.equal(proposal.resentmentDelta >= 0, true);
});

test("S70.4 hidden NPC does not get actor profile or prompt context", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "隐藏测试" });
  worldState.characters.push({
    id: "C99",
    name: "密札中人",
    role: "隐藏线人",
    loyalty: 50,
    ambition: 50,
    skill: 50,
    alive: true
  });
  worldState.relationshipLedger.characters.C99 = {
    id: "C99",
    name: "密札中人",
    role: "隐藏线人",
    stance: "sealed",
    relationship: 0,
    resentment: 0,
    networkSource: "sealed",
    recentIntent: "SEALED_NPC_MIND hiddenNotes provider proposal data/sessions/secret.json",
    visible: false,
    lastUpdatedTurn: 0
  };

  const ranked = rankNpcSalience(worldState, { limit: 10 });
  const profile = buildNpcMindActorProfile(worldState, "C99");
  const context = buildNpcMindPromptContext(worldState, profile);
  const serialized = JSON.stringify(ranked);

  assert.equal(profile, null);
  assert.equal(context, null);
  assert.equal(serialized.includes("C99"), false);
  assert.equal(serialized.includes("SEALED_NPC_MIND"), false);
  assert.equal(serialized.includes("hiddenNotes"), false);
});
