const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildDeterministicNpcRoster,
  buildNpcDetailView,
  buildNpcPrivateSignalView,
  buildNpcRosterView,
  ensureNpcRoster
} = require("../src/game/npcRoster");

function assertNoHiddenLeak(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /hiddenDossier|trueAssets|secretRelationships|unrevealedTasks|隐田|赌债|姻亲|privateSignalTags/);
}

test("S81.3 scholar NPC roster is deterministic and stage scoped", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "名册书生" });
  worldState.sessionId = "test-scholar-roster";
  const first = buildDeterministicNpcRoster(worldState);
  const second = buildDeterministicNpcRoster(worldState);

  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, "s81.3-npc-roster.v1");
  assert.equal(first.generatedFor.role, "scholar");
  assert.ok(first.npcs.some((npc) => npc.npcId === "npc:scholar:mentor-gu"));
  assert.ok(first.npcs.every((npc) => npc.stageTags.includes("scholar")));
  assert.ok(first.npcs.every((npc) => npc.portraitRef.startsWith("portrait-")));
});

test("S81.3 magistrate NPC roster includes yamen staff and signature gentry portrait rule", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清丈知县" });
  worldState.sessionId = "test-magistrate-roster";
  const roster = ensureNpcRoster(worldState);
  const registrar = roster.npcs.find((npc) => npc.npcId === "npc:magistrate:registrar-lu");
  const gentry = roster.npcs.find((npc) => npc.npcId === "npc:magistrate:gentry-han");

  assert.ok(registrar);
  assert.ok(registrar.availableInteractions.includes("delegate"));
  assert.match(registrar.portraitRef, /^portrait-s73-10-generic_npc-/);
  assert.ok(gentry);
  assert.equal(gentry.tier, "signature");
  assert.match(gentry.portraitRef, /^portrait-s73-10-signature_npc-/);
});

test("S81.3 NPC roster and detail views filter hidden dossiers and private signals", () => {
  const worldState = createInitialState({ role: "magistrate" });
  const listView = buildNpcRosterView(worldState, { interaction: "delegate" });
  const detailView = buildNpcDetailView(worldState, "npc:magistrate:registrar-lu");
  const privateSignalView = buildNpcPrivateSignalView(worldState, "npc:magistrate:registrar-lu");

  assert.equal(listView.safeguards.privateProfileRedacted, true);
  assert.equal(detailView.safeguards.softSignalsRedacted, true);
  assert.ok(listView.items.every((item) => item.availableInteractions.includes("delegate")));
  assertNoHiddenLeak(listView);
  assertNoHiddenLeak(detailView);
  assert.deepEqual(privateSignalView.privateSignalTags, ["避祸", "亲族压力", "可能欺瞒"]);
  assert.equal(privateSignalView.constraints.containsHiddenFacts, false);
  assert.doesNotMatch(JSON.stringify(privateSignalView), /隐田|姻亲|田十七亩/);
});

test("S81.3 NPC interaction enum exposes command-ready actions without unsafe portrait refs", () => {
  const worldState = createInitialState({ role: "magistrate" });
  const detailView = buildNpcDetailView(worldState, "npc:magistrate:bailiff-zhou");

  assert.ok(detailView.availableInteractions.includes("talk"));
  assert.ok(detailView.availableInteractions.includes("inquire"));
  assert.ok(detailView.availableInteractions.includes("gift"));
  assert.ok(detailView.availableInteractions.includes("delegate"));
  assert.doesNotMatch(detailView.portraitRef, /raw|provider|prompt|hidden|private|key|path|secret|token|api|file|data|http/i);
});
