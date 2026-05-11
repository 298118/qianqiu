const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { applyStatePatch, appendEvents, MAX_EVENT_HISTORY } = require("../src/game/stateRules");

test("applyStatePatch applies only whitelisted fields and clamps numeric ranges", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  const originalSessionId = worldState.sessionId;
  const originalRole = worldState.player.role;
  const originalCharacters = JSON.parse(JSON.stringify(worldState.characters));
  const originalOfficialPostings = JSON.parse(JSON.stringify(worldState.officialPostings));
  const originalWorldPeople = JSON.parse(JSON.stringify(worldState.worldPeople));
  const originalStudyProfile = JSON.parse(JSON.stringify(worldState.studyProfile));

  applyStatePatch(worldState, {
    sessionId: "not-allowed",
    turnCount: 999,
    year: 2000,
    month: 12,
    tenDayPeriod: 3,
    activeExam: { level: "child_exam" },
    studyProfile: { schemaVersion: 1, dimensions: { classicsFoundation: 100 } },
    examCalendar: { rivals: [{ id: "provider-rival" }] },
    activeNpcRequest: { id: "provider-request" },
    longTermEvents: { queue: [{ key: "provider-event" }] },
    officialCareer: { careerHistory: [{ type: "promotion", label: "forged" }] },
    officialPostings: { postings: [{ id: "provider-forged-posting", officeId: "ministry_revenue_principal" }] },
    roleWorldCoupling: { recentImpacts: [{ kind: "provider-forged" }] },
    worldGeography: { countries: [{ id: "provider-forged-country", name: "伪地理" }] },
    worldEntities: { entities: [{ id: "provider-forged", name: "伪实体" }] },
    worldPeople: { npcs: [{ id: "provider-forged-npc", name: "伪人物" }] },
    worldThreads: { threads: [{ id: "provider-forged", title: "伪议题" }] },
    characters: [{ id: "C99", name: "Invented", role: "patron" }],
    eventHistory: ["provider tries to replace history"],
    publicOrder: -10,
    treasury: 999999999,
    player: {
      health: 150,
      gold: -5,
      academia: 250,
      examRank: "秀才",
      examHistory: [{ level: "child_exam" }],
      role: "emperor",
      officeTitle: "not-allowed"
    },
    factions: {
      eunuchs: 88,
      inventedFaction: 99
    }
  });

  assert.equal(worldState.sessionId, originalSessionId);
  assert.equal(worldState.year, 1644);
  assert.equal(worldState.month, 1);
  assert.equal(worldState.tenDayPeriod, 1);
  assert.equal(worldState.activeExam, null);
  assert.deepEqual(worldState.studyProfile, originalStudyProfile);
  assert.deepEqual(worldState.examCalendar.rivals, []);
  assert.equal(worldState.activeNpcRequest, null);
  assert.deepEqual(worldState.longTermEvents.queue, []);
  assert.deepEqual(worldState.officialCareer.careerHistory, []);
  assert.deepEqual(worldState.officialPostings, originalOfficialPostings);
  assert.deepEqual(worldState.roleWorldCoupling.recentImpacts, []);
  assert.equal(worldState.worldGeography.countries.some((country) => country.id === "provider-forged-country"), false);
  assert.equal(worldState.worldEntities.entities.some((entity) => entity.id === "provider-forged"), false);
  assert.deepEqual(worldState.worldPeople, originalWorldPeople);
  assert.deepEqual(worldState.worldThreads.threads, []);
  assert.deepEqual(worldState.characters, originalCharacters);
  assert.deepEqual(worldState.eventHistory, []);
  assert.equal(worldState.publicOrder, 0);
  assert.equal(worldState.treasury, 10000000);
  assert.equal(worldState.player.health, 100);
  assert.equal(worldState.player.gold, 0);
  assert.equal(worldState.player.academia, 100);
  assert.equal(worldState.player.examRank, null);
  assert.deepEqual(worldState.player.examHistory, []);
  assert.equal(worldState.player.role, originalRole);
  assert.equal(worldState.player.officeTitle, null);
  assert.equal(worldState.factions.eunuchs, 88);
  assert.equal(worldState.factions.inventedFaction, undefined);
  assert.equal(worldState.turnCount, 1);
});

test("ordinary state patches preserve server-owned exam and narrative fields", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.activeExam = { level: "child_exam", reason: "server-created" };
  worldState.studyProfile.dimensions.classicsFoundation = 11;
  worldState.examCalendar.rivals = [{ id: "server-rival" }];
  worldState.officialPostings = { schemaVersion: 1, postings: [{ id: "server-posting" }] };
  worldState.roleWorldCoupling.recentImpacts = [{ kind: "server-impact" }];
  worldState.worldGeography.countries = [{ id: "server-country", name: "Server country" }];
  worldState.worldEntities.entities = [{ id: "server-entity", category: "court", kind: "court_office", name: "Server entity" }];
  worldState.worldPeople.npcs = [{ id: "server-npc", name: "Server NPC" }];
  worldState.worldThreads.threads = [{ id: "WT-server", title: "Server thread" }];
  worldState.characters = [{ id: "C01", name: "Original mentor", role: "teacher" }];
  worldState.eventHistory = ["existing history"];
  worldState.player.examRank = "server-rank";
  worldState.player.examHistory = [{ level: "child_exam", score: 80 }];

  applyStatePatch(worldState, {
    activeExam: null,
    studyProfile: { schemaVersion: 1, dimensions: { classicsFoundation: 100 } },
    examCalendar: { rivals: [{ id: "model-rival" }] },
    officialPostings: { schemaVersion: 1, postings: [{ id: "model-posting" }] },
    roleWorldCoupling: { recentImpacts: [{ kind: "model-impact" }] },
    worldGeography: { countries: [{ id: "model-country", name: "Model country" }] },
    worldEntities: { entities: [{ id: "model-entity", category: "court", kind: "court_office", name: "Model entity" }] },
    worldPeople: { npcs: [{ id: "model-npc", name: "Model NPC" }] },
    worldThreads: { threads: [{ id: "WT-model", title: "Model thread" }] },
    characters: [{ id: "C99", name: "Invented patron", role: "patron" }],
    eventHistory: ["provider replacement"],
    publicOrder: 65,
    player: {
      academia: 22,
      examRank: "model-rank",
      examHistory: [{ level: "palace_exam", score: 100 }]
    }
  });

  assert.deepEqual(worldState.activeExam, { level: "child_exam", reason: "server-created" });
  assert.equal(worldState.studyProfile.dimensions.classicsFoundation, 11);
  assert.deepEqual(worldState.examCalendar.rivals, [{ id: "server-rival" }]);
  assert.deepEqual(worldState.officialPostings, { schemaVersion: 1, postings: [{ id: "server-posting" }] });
  assert.deepEqual(worldState.roleWorldCoupling.recentImpacts, [{ kind: "server-impact" }]);
  assert.deepEqual(worldState.worldGeography.countries, [{ id: "server-country", name: "Server country" }]);
  assert.deepEqual(worldState.worldEntities.entities, [{ id: "server-entity", category: "court", kind: "court_office", name: "Server entity" }]);
  assert.deepEqual(worldState.worldPeople.npcs, [{ id: "server-npc", name: "Server NPC" }]);
  assert.deepEqual(worldState.worldThreads.threads, [{ id: "WT-server", title: "Server thread" }]);
  assert.deepEqual(worldState.characters, [{ id: "C01", name: "Original mentor", role: "teacher" }]);
  assert.deepEqual(worldState.eventHistory, ["existing history"]);
  assert.equal(worldState.player.examRank, "server-rank");
  assert.deepEqual(worldState.player.examHistory, [{ level: "child_exam", score: 80 }]);
  assert.equal(worldState.publicOrder, 65);
  assert.equal(worldState.player.academia, 22);
  assert.equal(worldState.turnCount, 1);
});

test("ordinary official patches cannot use position as a hidden office appointment", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  worldState.player.officeTitle = "户部主事";
  worldState.player.position = "户部主事";

  for (const forgedPosition of [
    "内阁大学士",
    "内 阁 大 学 士",
    "內閣大學士",
    "署理首辅",
    "护理吏部尚书",
    "兼管军机处",
    "Grand Secretary",
    "minister of revenue",
    "prefect"
  ]) {
    applyStatePatch(worldState, {
      player: {
        position: forgedPosition,
        performanceMerit: 44
      }
    });

    assert.equal(worldState.player.position, "户部主事");
    assert.equal(worldState.player.performanceMerit, 44);
  }

  applyStatePatch(worldState, {
    player: {
      position: "署中谨慎观政"
    }
  });

  assert.equal(worldState.player.position, "署中谨慎观政");
});

test("ordinary magistrate patches cannot use position as a hidden office appointment", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "magistrate" });
  assert.equal(worldState.player.position, "知县");

  applyStatePatch(worldState, {
    player: {
      position: "户部主事"
    }
  });

  assert.equal(worldState.player.position, "知县");

  applyStatePatch(worldState, {
    player: {
      position: "堂上问案"
    }
  });

  assert.equal(worldState.player.position, "堂上问案");
});

test("applyStatePatch can apply server follow-up patches without incrementing turn count", () => {
  const worldState = createInitialState({ playerName: "Tester" });

  applyStatePatch(worldState, {
    year: -50,
    month: 99,
    tenDayPeriod: 99,
    activeExam: { level: "child_exam", status: "writing" },
    studyProfile: { schemaVersion: 1, dimensions: { classicsFoundation: 99 } },
    examCalendar: { schemaVersion: 1, rivals: [{ id: "server-rival" }] },
    officialPostings: { schemaVersion: 1, postings: [{ id: "server-posting" }] },
    roleWorldCoupling: { schemaVersion: 1, recentImpacts: [{ kind: "server-impact" }], cooldowns: {} },
    worldGeography: { schemaVersion: 1, countries: [{ id: "server-country", name: "Server country" }], cities: [] },
    worldEntities: { schemaVersion: 1, entities: [{ id: "server-entity", category: "court", kind: "court_office", name: "Server entity" }], recentNotes: [] },
    worldPeople: { schemaVersion: 1, npcs: [{ id: "server-npc", name: "Server NPC" }], relationships: [] },
    worldThreads: { schemaVersion: 1, threads: [{ id: "WT-server", title: "Server thread" }], recentResolved: [] },
    officialCareer: { schemaVersion: 1, careerHistory: [{ type: "retention", label: "留任" }] },
    eventHistory: Array.from({ length: MAX_EVENT_HISTORY + 1 }, (_, index) => `server-event-${index}`),
    publicOrder: 80
  }, { incrementTurnCount: false, allowServerOwnedPatchKeys: true });

  assert.equal(worldState.year, 1);
  assert.equal(worldState.month, 12);
  assert.equal(worldState.tenDayPeriod, 3);
  assert.equal(worldState.activeExam.level, "child_exam");
  assert.equal(worldState.studyProfile.dimensions.classicsFoundation, 99);
  assert.equal(worldState.examCalendar.rivals[0].id, "server-rival");
  assert.equal(worldState.officialPostings.postings[0].id, "server-posting");
  assert.equal(worldState.roleWorldCoupling.recentImpacts[0].kind, "server-impact");
  assert.equal(worldState.worldGeography.countries[0].id, "server-country");
  assert.equal(worldState.worldEntities.entities[0].id, "server-entity");
  assert.equal(worldState.worldPeople.npcs[0].id, "server-npc");
  assert.equal(worldState.worldThreads.threads[0].id, "WT-server");
  assert.equal(worldState.officialCareer.careerHistory[0].label, "留任");
  assert.equal(worldState.eventHistory.length, MAX_EVENT_HISTORY);
  assert.equal(worldState.eventHistory[0], "server-event-1");
  assert.equal(worldState.publicOrder, 80);
  assert.equal(worldState.turnCount, 0);
});

test("appendEvents ignores empty values and trims history to the most recent entries", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  const events = Array.from({ length: MAX_EVENT_HISTORY + 5 }, (_, index) => `event-${index}`);

  appendEvents(worldState, ["", "   ", 42, null]);
  assert.equal(worldState.eventHistory.length, 0);

  appendEvents(worldState, events);

  assert.equal(worldState.eventHistory.length, MAX_EVENT_HISTORY);
  assert.equal(worldState.eventHistory[0], "event-5");
  assert.equal(worldState.eventHistory[MAX_EVENT_HISTORY - 1], "event-24");
});
