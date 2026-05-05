const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
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
