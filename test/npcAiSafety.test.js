const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { sanitizeDelegatedTaskPlan } = require("../src/game/delegatedTasks");
const { recordNpcInteraction } = require("../src/game/npcInteractions");
const { resolveNpcRelationshipAction } = require("../src/game/npcRelationshipActions");

test("S84 NPC dialogue rejects unsafe AI text before it reaches public views", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "对话安全测试" });
  const result = recordNpcInteraction(worldState, {
    npcId: "npc:magistrate:registrar-lu",
    actionType: "talk",
    utterance: "东乡田册如何？"
  }, {
    npcId: "npc:magistrate:registrar-lu",
    dialogueText: "hiddenDossier raw prompt sk-testsecret",
    mood: "谨慎",
    followUpSuggestions: ["给票帖"]
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("unsafe_or_empty_ai_dialogue_text"));
  assert.equal(result.record.dialogueText, "");
  assert.doesNotMatch(serialized, /hiddenDossier raw|raw prompt|sk-testsecret/);
});

test("S84 delegated task plans reject unsafe AI summaries and tags", () => {
  const result = sanitizeDelegatedTaskPlan({
    taskType: "land_survey",
    planSummary: "读取 raw prompt 与 /mnt/e/secret sk-testsecret 后执行。",
    riskTags: ["账册不齐"],
    successFactors: ["文书齐备"]
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("unsafe_or_empty_delegated_task_plan"));
  assert.equal(result.planSummary, "");
  assert.doesNotMatch(serialized, /raw prompt|\/mnt\/e|sk-testsecret/);
});

test("S85.4 relationship action replaces unsafe AI text with server resolution", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "交游安全测试" });
  const resolution = resolveNpcRelationshipAction(worldState, {
    npcId: "npc:scholar:matchmaker-lin",
    actionType: "marriage",
    spouseIds: ["player"]
  }, {
    npcId: "npc:scholar:matchmaker-lin",
    dialogueText: "hiddenDossier raw prompt /mnt/e/secret sk-testsecret",
    mood: "泄漏"
  });
  const result = recordNpcInteraction(worldState, {
    npcId: "npc:scholar:matchmaker-lin",
    actionType: "marriage",
    utterance: "请按礼法议婚。",
    spouseIds: ["player"]
  }, {
    npcId: "npc:scholar:matchmaker-lin",
    dialogueText: "hiddenDossier raw prompt /mnt/e/secret sk-testsecret",
    mood: "泄漏"
  }, {
    resolutionView: resolution.resolutionView
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.ok(result.errors.includes("unsafe_ai_dialogue_replaced_by_server_resolution"));
  assert.match(result.record.dialogueText, /议婚|登记|服务器/);
  assert.equal(result.record.worldPeopleImpactView.spouseIdsWritten, false);
  assert.doesNotMatch(serialized, /hiddenDossier raw|raw prompt|\/mnt\/e|sk-testsecret/);
});
