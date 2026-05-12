const test = require("node:test");
const assert = require("node:assert/strict");

const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const { runProposalTool } = require("../src/ai/gameAiToolRunner");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  buildEventProposalAudit,
  collectVisiblePressureRefs,
  resolveEventProposal
} = require("../src/game/aiEventProposal");
const { createInitialState } = require("../src/game/initialState");

function firstPressureEntry(worldState, actorProfile) {
  const entry = [...collectVisiblePressureRefs(worldState, actorProfile).values()][0];
  assert.ok(entry, "缺少可见压力源");
  return entry;
}

function safeArgs(entry, overrides = {}) {
  return {
    incidentKind: entry.incidentKind,
    publicSummary: "可见压力正在累积，需由服务器判断是否成案。",
    sourcePressureRefs: [entry.ref],
    visibility: "actor_visible",
    confidence: 0.6,
    severity: entry.severity,
    cooldownKey: `red-team:${entry.ref}`,
    affectedRefs: [entry.ref],
    privateResultRefs: [],
    riskTags: ["event_candidate"],
    ...overrides
  };
}

test("S70.6 event proposal rejects hidden/raw/server/path text and keeps audit sanitized", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "红队县令" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const entry = firstPressureEntry(worldState, actorProfile);
  const result = resolveEventProposal(worldState, safeArgs(entry, {
    publicSummary: "hidden raw SQL server.resolve_case /mnt/e/secret.env file:///home/user/.env",
    cooldownKey: "server.resolve_case",
    riskTags: ["raw", "hidden"]
  }), { actorProfile });
  const audit = buildEventProposalAudit(result.normalizedProposal, result);
  const serializedAudit = JSON.stringify(audit);

  assert.equal(result.status, "rejected");
  assert.equal(result.normalizedProposal.safetyFlags.length > 0, true);
  assert.doesNotMatch(serializedAudit, /server\.resolve_case/);
  assert.doesNotMatch(serializedAudit, /\/mnt\/e\/secret|file:\/\/\/home\/user/);
  assert.doesNotMatch(serializedAudit, /hidden raw SQL/i);
  assert.deepEqual(audit.privateResultRefs, []);
  assert.deepEqual(audit.appliedEventIds, []);
});

test("S70.6 private result refs and invisible pressure refs are rejected without leaking model-supplied internals", async () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "红队县令" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const entry = firstPressureEntry(worldState, actorProfile);
  const direct = resolveEventProposal(worldState, safeArgs(entry, {
    privateResultRefs: ["server.secret_row", "/mnt/e/hidden-note"],
    sourcePressureRefs: [entry.ref, "world_entity:forged-pressure"]
  }), { actorProfile });
  const toolAuditRecords = [];
  const runnerResult = await runProposalTool({
    id: "call-private-ref",
    name: "event.propose_incident",
    arguments: safeArgs(entry, {
      privateResultRefs: ["server.secret_row", "/mnt/e/hidden-note"]
    })
  }, {
    worldState,
    actorProfile,
    toolRegistry: createGameAiToolRegistry(),
    toolAuditRecords
  });
  const serializedRunner = JSON.stringify({ runnerResult, toolAuditRecords });

  assert.equal(direct.status, "rejected");
  assert.deepEqual(direct.normalizedProposal.privateResultRefs, []);
  assert.equal(direct.normalizedProposal.safetyFlags.includes("private_result_refs_from_model"), true);
  assert.match(direct.rejectionReasons.join(" "), /不在当前 actor 可见 projection/);
  assert.equal(runnerResult.status, "rejected");
  assert.deepEqual(runnerResult.privateResultRefs, []);
  assert.doesNotMatch(serializedRunner, /server\.secret_row|\/mnt\/e\/hidden-note/);
});

test("S70.6 scholar actors cannot submit event tools even with valid-looking visible refs", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "越权书生" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const entry = firstPressureEntry(worldState, actorProfile);
  const result = await runProposalTool({
    id: "call-scholar-event",
    name: "event.propose_incident",
    arguments: safeArgs(entry)
  }, {
    worldState,
    actorProfile,
    toolRegistry: createGameAiToolRegistry()
  });

  assert.equal(result.status, "rejected");
  assert.match(result.rejectionReasons.join(" "), /无权|辖区/);
  assert.equal(result.appliedEventIds.length, 0);
});
