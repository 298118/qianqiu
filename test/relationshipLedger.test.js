const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  applyRelationshipChanges,
  buildRelationshipInspectionView,
  ensureRelationshipLedger,
  normalizeRelationshipLedger,
  summarizeRelationshipLedger
} = require("../src/game/relationships");
const { applyStatePatch } = require("../src/game/stateRules");

test("initial state includes a relationship ledger for current characters and factions", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  const characterEntry = worldState.relationshipLedger.characters.C01;
  const factionEntry = worldState.relationshipLedger.factions.scholarOfficials;

  assert.ok(characterEntry);
  assert.equal(characterEntry.id, "C01");
  assert.equal(characterEntry.stance, "mentor");
  assert.equal(characterEntry.relationship, 12);
  assert.equal(characterEntry.resentment, 0);
  assert.equal(characterEntry.networkSource, "county_school");
  assert.ok(characterEntry.recentIntent);

  assert.ok(factionEntry);
  assert.equal(factionEntry.id, "scholarOfficials");
  assert.equal(factionEntry.stance, "orthodox_bureaucracy");
  assert.equal(factionEntry.visible, true);
});

test("ensureRelationshipLedger backfills legacy sessions and normalizes unsafe entries", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.relationshipLedger = {
    characters: {
      C01: {
        name: "  Updated mentor  ",
        stance: "  suspicious mentor  ",
        relationship: 999,
        resentment: -40,
        networkSource: "",
        recentIntent: "x".repeat(200),
        lastUpdatedTurn: -5
      },
      inventedCharacter: {
        relationship: 100
      }
    },
    factions: {
      eunuchs: {
        relationship: -999,
        resentment: 999,
        visible: "yes"
      },
      inventedFaction: {
        relationship: 50,
        resentment: 50
      }
    },
    recentNotes: ["", "  useful note  ", 42, "another note"]
  };

  ensureRelationshipLedger(worldState);

  assert.equal(worldState.relationshipLedger.characters.C01.name, "Updated mentor");
  assert.equal(worldState.relationshipLedger.characters.C01.relationship, 100);
  assert.equal(worldState.relationshipLedger.characters.C01.resentment, 0);
  assert.equal(worldState.relationshipLedger.characters.C01.lastUpdatedTurn, 0);
  assert.equal(worldState.relationshipLedger.characters.inventedCharacter, undefined);
  assert.equal(worldState.relationshipLedger.factions.eunuchs.relationship, -100);
  assert.equal(worldState.relationshipLedger.factions.eunuchs.resentment, 100);
  assert.equal(worldState.relationshipLedger.factions.eunuchs.visible, false);
  assert.equal(worldState.relationshipLedger.factions.inventedFaction, undefined);
  assert.deepEqual(worldState.relationshipLedger.recentNotes, ["useful note", "another note"]);
});

test("provider state patches cannot alter the server-owned relationship ledger", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  const before = JSON.parse(JSON.stringify(worldState.relationshipLedger));

  applyStatePatch(worldState, {
    relationshipLedger: {
      characters: {
        C01: {
          relationship: -100,
          resentment: 100
        }
      }
    },
    player: {
      reputation: 20
    }
  });

  assert.deepEqual(worldState.relationshipLedger, before);
  assert.equal(worldState.player.reputation, 20);
  assert.equal(worldState.turnCount, 1);
});

test("summarizeRelationshipLedger returns compact ledger context", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "minister" });
  const summary = summarizeRelationshipLedger(worldState.relationshipLedger, worldState);

  assert.ok(summary.characters.some((entry) => entry.id === "C01"));
  assert.ok(summary.factions.some((entry) => entry.id === "eunuchs"));
  assert.ok(summary.factions.every((entry) => !("lastUpdatedTurn" in entry)));
});

test("normalizeRelationshipLedger creates entries for newly present characters", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.characters.push({
    id: "C99",
    name: "New court contact",
    role: "scribe",
    alive: true
  });

  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);

  assert.ok(ledger.characters.C99);
  assert.equal(ledger.characters.C99.name, "New court contact");
  assert.equal(ledger.characters.C99.relationship, 12);
});

test("applyRelationshipChanges clamps provider suggestions and drops unsafe targets", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.turnCount = 3;

  const applied = applyRelationshipChanges(worldState, [
    {
      targetType: "character",
      targetId: "C01",
      relationshipDelta: 50,
      resentmentDelta: 50,
      stance: "trusted mentor",
      recentIntent: "Recommend cautious study.",
      reason: "The player paid respectful teacher visits."
    },
    {
      targetType: "faction",
      targetId: "eunuchs",
      relationshipDelta: 8,
      resentmentDelta: -4,
      reason: "A hidden faction should not be changed from provider suggestions."
    },
    {
      targetType: "character",
      targetId: "invented",
      relationshipDelta: 8,
      resentmentDelta: 1,
      reason: "Invented ids are ignored."
    }
  ]);

  assert.equal(applied.length, 1);
  assert.equal(worldState.relationshipLedger.characters.C01.relationship, 24);
  assert.equal(worldState.relationshipLedger.characters.C01.resentment, 10);
  assert.equal(worldState.relationshipLedger.characters.C01.stance, "trusted mentor");
  assert.equal(worldState.relationshipLedger.characters.C01.lastUpdatedTurn, 3);
  assert.equal(worldState.relationshipLedger.factions.eunuchs.relationship, -4);
  assert.equal(worldState.relationshipLedger.recentNotes.length, 1);
  assert.match(worldState.relationshipLedger.recentNotes[0], /teacher visits/);
  assert.deepEqual(applied[0].relationship, { before: 12, after: 24, delta: 12 });
  assert.deepEqual(applied[0].resentment, { before: 0, after: 10, delta: 10 });
});

test("summarizeRelationshipLedger can hide non-visible relationship context for prompts", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  const summary = summarizeRelationshipLedger(
    worldState.relationshipLedger,
    worldState,
    { visibleOnly: true }
  );

  assert.ok(summary.factions.some((entry) => entry.id === "scholarOfficials"));
  assert.ok(!summary.factions.some((entry) => entry.id === "eunuchs"));
});

test("summarizeRelationshipLedger visibleOnly filters hidden recent notes", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.relationshipLedger.characters.C01.name = "Visible Mentor";
  worldState.relationshipLedger.factions.eunuchs.name = "Hidden Palace";
  worldState.relationshipLedger.recentNotes = [
    "Visible Mentor: offered a careful lesson",
    "Hidden Palace: sent a sealed request"
  ];

  const summary = summarizeRelationshipLedger(
    worldState.relationshipLedger,
    worldState,
    { visibleOnly: true }
  );

  assert.deepEqual(summary.recentNotes, ["Visible Mentor: offered a careful lesson"]);
  assert.equal(JSON.stringify(summary).includes("sealed request"), false);
  assert.equal(JSON.stringify(summary).includes("Hidden Palace"), false);
});

test("buildRelationshipInspectionView exposes only player-visible contacts and factions", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  const view = buildRelationshipInspectionView(worldState);

  assert.equal(view.schemaVersion, 1);
  assert.equal(view.generatedAtTurn, 0);
  assert.ok(view.contacts.some((entry) => entry.id === "C01" && entry.type === "character"));
  assert.ok(view.contacts.every((entry) => Object.hasOwn(entry, "role")));
  assert.ok(view.contacts.every((entry) => !Object.hasOwn(entry, "visible")));
  assert.ok(view.factions.some((entry) => entry.id === "scholarOfficials" && entry.type === "faction"));
  assert.ok(!view.factions.some((entry) => entry.id === "eunuchs"));
  assert.ok(!view.factions.some((entry) => entry.id === "militaryLords"));
  assert.ok(view.contacts.every((entry) => typeof entry.relationshipLabel === "string"));
  assert.ok(view.factions.every((entry) => typeof entry.resentmentLabel === "string"));
  assert.ok(view.hiddenNotice);
  assert.equal(JSON.stringify(view).includes("Eunuch faction"), false);
});

test("buildRelationshipInspectionView follows role visibility rules without hidden placeholders", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "minister" });
  const view = buildRelationshipInspectionView(worldState);

  assert.ok(view.factions.some((entry) => entry.id === "eunuchs"));
  assert.ok(view.factions.some((entry) => entry.id === "scholarOfficials"));
  assert.ok(view.factions.some((entry) => entry.id === "militaryLords"));
  assert.equal(view.hiddenNotice, "");
});

test("buildRelationshipInspectionView filters notes tied to hidden entries", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.relationshipLedger.characters.C01.name = "Visible Mentor";
  worldState.relationshipLedger.factions.eunuchs.name = "Hidden Palace";
  worldState.relationshipLedger.recentNotes = [
    "Visible Mentor: offered a careful lesson",
    "Hidden Palace: sent a sealed request"
  ];

  const view = buildRelationshipInspectionView(worldState);

  assert.deepEqual(view.recentNotes, ["Visible Mentor: offered a careful lesson"]);
  assert.equal(JSON.stringify(view).includes("sealed request"), false);
  assert.equal(JSON.stringify(view).includes("Hidden Palace"), false);
});
