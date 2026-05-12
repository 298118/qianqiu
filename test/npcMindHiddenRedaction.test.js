const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  applyNpcMindProposal,
  buildNpcMindActorProfile,
  buildNpcMindPromptContext,
  generateNpcMindProposal,
  sanitizeNpcMindProposal
} = require("../src/game/npcMind");

test("S70.4 NPC mind context redacts unsafe event and relationship text", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "红队士子" });
  worldState.eventHistory.push("hiddenNotes raw provider proposal /mnt/e/secret sk-testSECRET");
  worldState.relationshipLedger.characters.C01.recentIntent = "provider prompt proposal /mnt/e/secret.txt file:///home/user/.env";
  const actorProfile = buildNpcMindActorProfile(worldState, "C01");
  const context = buildNpcMindPromptContext(worldState, actorProfile);
  const serialized = JSON.stringify(context);

  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("provider"), false);
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("proposal"), false);
  assert.equal(serialized.includes("/mnt/e/secret"), false);
  assert.equal(serialized.includes("file:///home"), false);
  assert.equal(serialized.includes("sk-testSECRET"), false);
  assert.equal(context.actor.currentGoals.some((goal) => goal.includes("/mnt")), false);
});

test("S70.4 NPC mind proposal sanitizer drops unsafe text and tool calls", () => {
  const proposal = sanitizeNpcMindProposal({
    proposalId: "npc-mind:test",
    actorId: "npc:C01",
    npcId: "C01",
    intentType: "assist",
    confidence: 2,
    publicSummary: "hiddenNotes provider proposal rawPrompt",
    relationshipDelta: 99,
    resentmentDelta: -99,
    events: ["[NPC心念] 正常事件", "data/sessions/secret.json"],
    memoryCandidates: ["可见记忆", "sk-testSECRET"],
    toolCalls: [{ name: "server.resolve_case" }]
  });
  const serialized = JSON.stringify(proposal);

  assert.equal(proposal.confidence, 1);
  assert.equal(proposal.relationshipDelta, 3);
  assert.equal(proposal.resentmentDelta, -3);
  assert.equal(proposal.intentType, "assist");
  assert.equal(proposal.publicSummary, "NPC 心念候选。");
  assert.deepEqual(proposal.events, ["[NPC心念] 正常事件"]);
  assert.deepEqual(proposal.memoryCandidates, ["可见记忆"]);
  assert.deepEqual(proposal.toolCalls, []);
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("data/sessions"), false);
  assert.equal(serialized.includes("sk-testSECRET"), false);
});

test("S70.4 provider NPC proposal is anchored to current actor and intent enum", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "锚定测试" });
  const actorProfile = buildNpcMindActorProfile(worldState, "C01");
  const context = buildNpcMindPromptContext(worldState, actorProfile);
  const proposal = await generateNpcMindProposal(worldState, actorProfile, {
    async generateNpcMindProposal() {
      return {
        proposalId: "npc-mind:retarget",
        actorId: "npc:C02",
        npcId: "C02",
        intentType: "grant_office",
        publicSummary: "试图改写别人的关系。",
        relationshipDelta: 2,
        resentmentDelta: -2
      };
    }
  }, { allowAi: true, context });

  assert.equal(proposal.actorId, "npc:C01");
  assert.equal(proposal.npcId, "C01");
  assert.equal(proposal.intentType, "memory");
});

test("S70.4 NPC mind sanitizer rejects standalone source tokens and file paths", () => {
  const proposal = sanitizeNpcMindProposal({
    proposalId: "npc-mind:source-token",
    actorId: "npc:C01",
    npcId: "C01",
    intentType: "warn",
    publicSummary: "provider",
    events: ["/mnt/e/secret.txt", "file:///home/user/.env", "prompt", "公开事件"],
    memoryCandidates: ["proposal", "/home/user/.env", "公开记忆"]
  });
  const serialized = JSON.stringify(proposal);

  assert.equal(proposal.publicSummary, "NPC 心念候选。");
  assert.deepEqual(proposal.events, ["公开事件"]);
  assert.deepEqual(proposal.memoryCandidates, ["公开记忆"]);
  assert.equal(serialized.includes("/mnt/e"), false);
  assert.equal(serialized.includes("file:///home"), false);
  assert.equal(serialized.includes("provider"), false);
  assert.equal(serialized.includes("prompt"), false);
});

test("S70.4 applying sanitized NPC proposal does not expose unsafe memory", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "应用红队" });
  const result = applyNpcMindProposal(worldState, {
    proposalId: "npc-mind:redacted",
    actorId: "npc:C01",
    npcId: "C01",
    intentType: "memory",
    confidence: 0.5,
    publicSummary: "正常公开摘要",
    relationshipDelta: 1,
    resentmentDelta: 0,
    events: ["provider proposal raw audit"],
    memoryCandidates: ["hiddenIntent /home/user/.env", "只记正常往来"]
  }, {});
  const serialized = JSON.stringify(result);

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].includes("正常公开摘要"), true);
  assert.equal(result.memoryCandidates.length, 1);
  assert.equal(result.memoryCandidates[0].summary, "只记正常往来");
  assert.equal(serialized.includes("provider proposal"), false);
  assert.equal(serialized.includes("hiddenIntent"), false);
  assert.equal(serialized.includes("/home/user"), false);
});
