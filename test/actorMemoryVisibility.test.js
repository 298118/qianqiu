const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const {
  buildActorMemoryView,
  ensureActorMemoryLedgerState,
  proposeActorMemoryUpdate,
  summarizeActorMemoryForPrompt
} = require("../src/game/actorMemoryLedger");

function assertHiddenSafe(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /SEALED_|hiddenNotes|hiddenIntent|raw provider|provider proposal|prompt_retrieval_index|event_log|sk-test|data\/sessions|file:\/\//i);
}

test("S70.12 private or hidden memory proposals are rejected until redacted API exists", () => {
  const worldState = createInitialState({ playerName: "私档测试" });
  for (const visibility of ["actor_private", "private", "hidden", "server_hidden"]) {
    const proposed = proposeActorMemoryUpdate("npc:C01", {
      type: "impression",
      visibility,
      summary: "顾文衡暗藏一条玩家不可见私评。"
    }, { worldState });

    assert.equal(proposed.accepted, false, visibility);
    assert.ok(proposed.rejectedReasons.includes("private_or_hidden_memory_requires_redacted_api"));
  }
});

test("S70.12 unsafe memory text does not enter view, prompt, or event archive", () => {
  const worldState = createInitialState({ playerName: "清洗测试" });
  const proposed = proposeActorMemoryUpdate("npc:C01", {
    type: "fact",
    visibility: "player_visible",
    summary: "SEALED_MEMORY raw provider prompt_retrieval_index event_log data/sessions/x file:///home/user/.env sk-test-secret-123456",
    sourceRefs: [{ sourceView: "eventArchiveView", id: "unsafe", label: "prompt proposal" }]
  }, { worldState });
  assert.equal(proposed.accepted, false);

  worldState.actorMemoryLedger = {
    schemaVersion: 1,
    memoriesByActor: {
      "npc:C01": [{
        id: "unsafe-hidden-row",
        actorId: "npc:C01",
        type: "fact",
        visibility: "hidden",
        summary: "SEALED_HIDDEN_MEMORY hiddenNotes",
        salience: 90,
        confidence: 1,
        sourceType: "ai_memory_proposal",
        createdAt: { year: 1644, month: 1, tenDayPeriod: 1, turn: 0 }
      }, {
        id: "safe-row",
        actorId: "npc:C01",
        type: "impression",
        visibility: "player_visible",
        summary: "顾文衡公开记得玩家守礼问安。",
        salience: 50,
        confidence: 0.7,
        sourceType: "server_turn",
        createdAt: { year: 1644, month: 1, tenDayPeriod: 1, turn: 0 }
      }]
    },
    recentUpdates: []
  };
  ensureActorMemoryLedgerState(worldState);

  const view = buildActorMemoryView(worldState);
  const prompt = summarizeActorMemoryForPrompt(worldState);
  const archive = buildEventArchiveView(worldState);

  assert.match(JSON.stringify(view), /公开记得玩家/);
  assertHiddenSafe(view);
  assertHiddenSafe(prompt);
  assertHiddenSafe(archive);
  assert.doesNotMatch(JSON.stringify({ view, prompt, archive }), /SEALED_HIDDEN_MEMORY|hiddenNotes/);
});

test("S70.12 visible memory rows for invisible actors stay out of view, prompt, and archive", () => {
  const worldState = createInitialState({ playerName: "隐名过滤" });
  worldState.actorMemoryLedger = {
    schemaVersion: 1,
    memoriesByActor: {
      "npc:hidden-visible-memory": [{
        id: "hidden-actor-visible-memory",
        actorId: "npc:hidden-visible-memory",
        type: "fact",
        visibility: "player_visible",
        summary: "隐名人物公开记得一件不应出现在玩家视野的旧事。",
        salience: 95,
        confidence: 0.9,
        sourceType: "server_turn",
        createdAt: { year: 1644, month: 1, tenDayPeriod: 1, turn: 0 },
        lastTouchedTurn: 0
      }],
      "npc:C01": [{
        id: "visible-actor-visible-memory",
        actorId: "npc:C01",
        type: "fact",
        visibility: "player_visible",
        summary: "顾文衡公开记得玩家守礼问安。",
        salience: 70,
        confidence: 0.8,
        sourceType: "server_turn",
        createdAt: { year: 1644, month: 1, tenDayPeriod: 1, turn: 0 },
        lastTouchedTurn: 0
      }]
    },
    recentUpdates: [{
      actorId: "npc:hidden-visible-memory",
      memoryId: "hidden-actor-visible-memory",
      type: "fact",
      summary: "隐名人物公开记得一件不应出现在玩家视野的旧事。",
      status: "applied",
      salience: 95,
      turn: 0
    }]
  };

  const view = buildActorMemoryView(worldState);
  const prompt = summarizeActorMemoryForPrompt(worldState);
  const archive = buildEventArchiveView(worldState);
  const serialized = JSON.stringify({ view, prompt, archive });

  assert.match(serialized, /顾文衡公开记得玩家/);
  assert.doesNotMatch(serialized, /hidden-visible-memory|隐名人物公开记得/);
  assert.equal(archive.counts.actor_memory, 1);
});

test("S70.12 actor retargeting is rejected", () => {
  const worldState = createInitialState({ playerName: "转写测试" });
  const proposed = proposeActorMemoryUpdate("npc:C99", {
    actorId: "npc:C01",
    type: "favor",
    visibility: "player_visible",
    summary: "试图把 A 的记忆写给 B。"
  }, { worldState, expectedActorId: "npc:C99" });

  assert.equal(proposed.accepted, false);
  assert.ok(proposed.rejectedReasons.includes("actor_retarget_rejected"));
});
