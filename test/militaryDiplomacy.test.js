const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildMilitaryDiplomacyRetrievalRows,
  buildMilitaryDiplomacyView,
  summarizeMilitaryDiplomacyForPrompt
} = require("../src/game/militaryDiplomacy");

test("S64.1 general view derives frontier theaters, garrisons, supply lines, envoys, and incidents without mutating state", () => {
  const worldState = createInitialState({ role: "general", playerName: "边镇将领" });
  Object.assign(worldState, {
    borderThreat: 86,
    armyMorale: 38,
    grainReserve: 220,
    population: 7200
  });
  const before = JSON.stringify(worldState);

  const first = buildMilitaryDiplomacyView(worldState);
  const second = buildMilitaryDiplomacyView(worldState);
  const serialized = JSON.stringify(first);

  assert.equal(first.schemaVersion, 1);
  assert.deepEqual(first, second);
  assert.equal(first.theaters.length > 0, true);
  assert.equal(first.garrisons.length > 0, true);
  assert.equal(first.supplyLines.length > 0, true);
  assert.equal(first.diplomaticContacts.length > 0, true);
  assert.equal(first.frontierIncidents.length > 0, true);
  assert.ok(first.theaters.every((theater) =>
    theater.frontierZoneId &&
    theater.neighborCountryId &&
    Number.isInteger(theater.threatScore) &&
    Number.isInteger(theater.readinessScore) &&
    Number.isInteger(theater.supplyRisk) &&
    theater.authorityBoundary.includes("服务器")
  ));
  assert.ok(first.garrisons.some((garrison) => /驻军/.test(garrison.title)));
  assert.ok(first.supplyLines.some((line) => /粮道/.test(line.title)));
  assert.ok(first.diplomaticContacts.some((contact) => /使节/.test(contact.title)));
  assert.ok(first.frontierIncidents.some((incident) => /边患|战备|粮道|使节/.test(incident.kindLabel)));
  assert.match(serialized, /军务|边|粮道|服务器裁决/);
  assert.doesNotMatch(serialized, /statePatch|provider|proposal|prompt|data\/sessions|event_log|sk-/);
  assert.equal(JSON.stringify(worldState), before);
});

test("S64.1 scholar view does not expose military diplomacy reports", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "边报书生" });
  const view = buildMilitaryDiplomacyView(worldState);
  const promptSummary = summarizeMilitaryDiplomacyForPrompt(worldState);

  assert.equal(view.counts.total, 0);
  assert.deepEqual(view.theaters, []);
  assert.deepEqual(view.frontierIncidents, []);
  assert.deepEqual(promptSummary.reports, []);
  assert.match(view.hiddenNotice, /书生/);
});

test("S64.1 filters hidden military geography and envoy-like private rows", () => {
  const worldState = createInitialState({ role: "general", playerName: "边报防线" });
  worldState.worldGeography.frontierZones.push({
    id: "frontier-hidden-s64",
    name: "SEALED_S64_FRONTIER",
    countryId: "country-ming",
    neighborCountryId: "country-manchu-frontier",
    cityIds: ["city-beijing"],
    routeIds: ["route-shanhai-liaodong-pass"],
    pressure: 99,
    visibility: "hidden",
    publicSummary: "SEALED_S64_FRONTIER_SUMMARY prompt provider event_log sk-test-s64"
  });
  worldState.worldPeople.npcs.push({
    id: "npc-hidden-s64-envoy",
    name: "SEALED_S64_ENVOY",
    rankLabel: "邻国使者",
    visibility: "hidden",
    publicSummary: "SEALED_S64_ENVOY_SUMMARY",
    hiddenIntent: "SEALED_S64_ENVOY_INTENT"
  });

  const payload = JSON.stringify({
    view: buildMilitaryDiplomacyView(worldState),
    reports: buildMilitaryDiplomacyRetrievalRows(worldState)
  });

  assert.doesNotMatch(payload, /SEALED_S64_/);
  assert.doesNotMatch(payload, /sk-test-s64|provider|event_log/);
  assert.match(payload, /military-|军务|边/);
});
