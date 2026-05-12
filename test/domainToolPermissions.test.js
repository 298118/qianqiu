const test = require("node:test");
const assert = require("node:assert/strict");

const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const { createInitialState } = require("../src/game/initialState");
const {
  buildNpcAiActorProfile,
  buildPlayerAiActorProfile,
  buildSystemEngineActorProfile
} = require("../src/game/aiActorProfiles");

function toolNamesFor(actorProfile, options = {}) {
  return createGameAiToolRegistry()
    .listToolsForActor(actorProfile, options)
    .map((tool) => tool.name);
}

test("S70.7 scholar actors cannot see strong domain tools", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "寒窗士子" });
  const tools = toolNamesFor(buildPlayerAiActorProfile(worldState));

  for (const forbidden of [
    "judicial.propose_case_resolution",
    "city.propose_policy",
    "military.propose_order",
    "diplomacy.propose_move",
    "exam.request_ranking_adjudication",
    "office.request_appointment_adjudication",
    "career.propose_reward_or_promotion",
    "career.request_discipline_adjudication"
  ]) {
    assert.equal(tools.includes(forbidden), false, `书生不应看到 ${forbidden}`);
  }
});

test("S70.7 magistrate domain tools remain jurisdiction-scoped", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清河县令" });
  const profile = buildPlayerAiActorProfile(worldState);
  const localRef = profile.jurisdictionRefs[0];
  const localTools = toolNamesFor(profile, { jurisdictionRef: localRef });
  const foreignTools = toolNamesFor(profile, { jurisdictionRef: "city-outside-border" });

  assert.equal(localTools.includes("judicial.propose_case_resolution"), true);
  assert.equal(localTools.includes("city.propose_policy"), true);
  assert.equal(localTools.includes("military.propose_order"), false);
  assert.equal(localTools.includes("career.propose_reward_or_promotion"), false);
  assert.equal(foreignTools.includes("judicial.propose_case_resolution"), false);
  assert.equal(foreignTools.includes("city.propose_policy"), false);
});

test("S70.7 generals get military and diplomacy tools but not career or judicial tools", () => {
  const worldState = createInitialState({ role: "general", playerName: "边镇将领" });
  const tools = toolNamesFor(buildPlayerAiActorProfile(worldState));

  assert.equal(tools.includes("military.propose_order"), true);
  assert.equal(tools.includes("diplomacy.propose_move"), true);
  assert.equal(tools.includes("judicial.propose_case_resolution"), false);
  assert.equal(tools.includes("career.propose_reward_or_promotion"), false);
  assert.equal(tools.includes("career.request_discipline_adjudication"), false);
});

test("S70.7 examiners can request ranking review but cannot appoint or discipline", () => {
  const worldState = createInitialState({ role: "minister", playerName: "礼部堂官" });
  const examiner = buildNpcAiActorProfile(worldState, { id: "examiner-visible" }, {
    allowUnknown: true,
    actorType: "examiner"
  });
  const tools = toolNamesFor(examiner);

  assert.equal(tools.includes("exam.request_ranking_adjudication"), true);
  assert.equal(tools.includes("office.request_appointment_adjudication"), false);
  assert.equal(tools.includes("career.propose_reward_or_promotion"), false);
  assert.equal(tools.includes("career.request_discipline_adjudication"), false);
});

test("S70.7 system engine remains excluded from strong domain tools", () => {
  const worldState = createInitialState({ role: "minister", playerName: "部院官" });
  const tools = toolNamesFor(buildSystemEngineActorProfile(worldState, "pressure_events"));

  assert.equal(tools.includes("event.propose_incident"), true);
  assert.equal(tools.includes("judicial.propose_case_resolution"), false);
  assert.equal(tools.includes("city.propose_policy"), false);
  assert.equal(tools.includes("military.propose_order"), false);
  assert.equal(tools.includes("diplomacy.propose_move"), false);
  assert.equal(tools.includes("career.propose_reward_or_promotion"), false);
});
