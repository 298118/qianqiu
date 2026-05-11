const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createInitialState } = require("../src/game/initialState");
const { runActiveNpcRequestStep } = require("../src/game/activeRequests");
const { listAuditEvents, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

async function removeSessionArtifacts(sessionId) {
  await removeSessionFile(sessionId);
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

function addMonthEndLifecycleFixture(worldState) {
  worldState.turnCount = 5;
  worldState.month = 8;
  worldState.tenDayPeriod = 3;
  worldState.publicOrder = 30;
  worldState.corruption = 82;
  worldState.taxRate = 62;
  worldState.grainReserve = 200;
  worldState.population = 10000;
  worldState.worldPeople = {
    schemaVersion: 1,
    generatedAtTurn: 5,
    npcs: [{
      id: "npc-route-gu",
      name: "顾路",
      age: 82,
      alive: true,
      homeCityId: "city-beijing",
      currentCityId: "city-beijing",
      householdId: "hh-route-gu",
      rankLabel: "在任官员",
      reputation: 72,
      patronagePower: 60,
      peerNetwork: 30,
      wealthCash: 12,
      landMu: 40,
      debts: 130,
      annualIncomeEstimate: 24,
      estateIds: ["estate-route-gu"],
      assetIds: ["asset-route-gu"],
      family: {
        fatherId: "",
        motherId: "",
        spouseIds: [],
        childrenIds: [],
        marriageAllianceTags: []
      },
      health: 5,
      legalRisk: 20,
      impeachmentRisk: 64,
      resentmentRisk: 48,
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "顾路为可见人物。",
      hiddenIntent: "SEALED_ROUTE_INTENT",
      hiddenNotes: ["SEALED_ROUTE_NOTE"],
      lastUpdatedTurn: 5
    }],
    households: [{
      id: "hh-route-gu",
      familyName: "顾氏",
      seatCityId: "city-beijing",
      wealthScore: 42,
      landMu: 90,
      prestige: 38,
      gentryRank: "乡绅",
      marriageNetworkScore: 34,
      debtPressure: 50,
      politicalAlignment: "观望",
      familyRisk: 22,
      memberNpcIds: ["npc-route-gu"],
      estateIds: ["estate-route-gu"],
      assetIds: ["asset-route-gu"],
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "顾氏有可见家产。",
      lastUpdatedTurn: 5
    }],
    assets: [{
      id: "asset-route-gu",
      kind: "debt",
      name: "顾氏路欠契",
      ownerType: "household",
      ownerId: "hh-route-gu",
      cityId: "city-beijing",
      valueEstimate: 100,
      annualIncomeEstimate: 10,
      debtValue: 80,
      statusLabel: "旧欠",
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "顾氏欠契为公开估计。",
      lastUpdatedTurn: 5
    }],
    estates: [{
      id: "estate-route-gu",
      name: "顾氏路南田",
      ownerType: "household",
      ownerId: "hh-route-gu",
      cityId: "city-beijing",
      regionId: "region-north",
      landMu: 90,
      tenantHouseholds: 6,
      rentGrainEstimate: 30,
      taxBurden: 68,
      waterworks: 20,
      disputeRisk: 54,
      status: "held",
      statusLabel: "自有",
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "顾氏南田为公开估计。",
      lastUpdatedTurn: 5
    }],
    relationships: [],
    recentNotes: []
  };
}

function createTestServerWithProvider(provider) {
  const aiPath = require.resolve("../src/ai");
  const gameRoutePath = require.resolve("../src/routes/game");
  const originalAiModule = require.cache[aiPath];
  const originalGameRouteModule = require.cache[gameRoutePath];

  delete require.cache[gameRoutePath];
  require.cache[aiPath] = {
    id: aiPath,
    filename: aiPath,
    loaded: true,
    exports: {
      getProvider: () => provider
    }
  };

  const gameRoutes = require("../src/routes/game");
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);

  const testServer = createFetchSafeServer(app);

  async function close() {
    await testServer.close();

    delete require.cache[gameRoutePath];
    if (originalGameRouteModule) {
      require.cache[gameRoutePath] = originalGameRouteModule;
    }

    if (originalAiModule) {
      require.cache[aiPath] = originalAiModule;
    } else {
      delete require.cache[aiPath];
    }
  }

  return {
    baseUrl: testServer.baseUrl,
    close
  };
}

test("POST /api/game/turn applies provider relationship suggestions through server merge", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          player: {
            reputation: 14
          }
        },
        attributeChanges: [],
        relationshipChanges: [
          {
            targetType: "character",
            targetId: "C01",
            relationshipDelta: 20,
            resentmentDelta: 12,
            stance: "warmer mentor",
            recentIntent: "Offer a cautious recommendation.",
            reason: "Respectful study impressed the mentor."
          },
          {
            targetType: "faction",
            targetId: "eunuchs",
            relationshipDelta: 8,
            resentmentDelta: -3,
            reason: "Hidden faction suggestions are ignored for a scholar."
          },
          {
            targetType: "character",
            targetId: "invented",
            relationshipDelta: 8,
            resentmentDelta: 1,
            reason: "Invented ids are ignored."
          }
        ],
        events: ["provider event"],
        examTrigger: { shouldStart: false, level: null, reason: "" }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "study with respect"
    })
  });
  const payload = await response.json();
  const auditEvents = await listAuditEvents(worldState.sessionId);
  const peopleEvent = auditEvents.find((event) =>
    event.sourceSystem === "world_people" &&
    event.eventType === "relationship_changed"
  );

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.worldState.player.reputation, 14);
  assert.equal(payload.relationshipChanges.length, 1);
  assert.equal(payload.relationshipChanges[0].targetId, "C01");
  assert.deepEqual(payload.relationshipChanges[0].relationship, { before: 12, after: 24, delta: 12 });
  assert.deepEqual(payload.relationshipChanges[0].resentment, { before: 0, after: 10, delta: 10 });
  assert.ok(payload.relationshipView.contacts.some((entry) => entry.id === "C01" && entry.lastUpdatedTurn === 1));
  assert.ok(payload.relationshipView.factions.some((entry) => entry.id === "scholarOfficials"));
  assert.ok(!payload.relationshipView.factions.some((entry) => entry.id === "eunuchs"));
  assert.equal(payload.worldPeopleView.schemaVersion, 1);
  assert.ok(payload.worldPeopleView.relationships.some((entry) =>
    entry.id === "rel-player-npc-C01" &&
    entry.relationship === 24 &&
    entry.resentment === 10
  ));
  assert.equal(JSON.stringify(payload.worldPeopleView).includes("Eunuch faction"), false);
  assert.equal(JSON.stringify(payload.relationshipView).includes("Eunuch faction"), false);
  assert.equal(payload.worldState.relationshipLedger.characters.C01.stance, "warmer mentor");
  assert.equal(payload.worldState.relationshipLedger.characters.C01.lastUpdatedTurn, 1);
  assert.equal(payload.worldState.relationshipLedger.factions.eunuchs.relationship, -4);
  assert.ok(payload.worldState.relationshipLedger.recentNotes.some((note) => note.includes("mentor")));
  assert.ok(peopleEvent);
  assert.equal(peopleEvent.visibility, "public");
  assert.match(peopleEvent.summary, /顾文衡/);
  assert.equal(JSON.stringify(peopleEvent).includes("Hidden faction suggestions"), false);
  assert.equal(JSON.stringify(payload.worldPeopleView).includes(peopleEvent.eventId), false);
});

test("POST /api/game/turn ignores provider attempts to patch server-owned ordinary-turn fields", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          activeExam: null,
          characters: [{ id: "C99", name: "Invented patron", role: "patron" }],
          eventHistory: ["provider replacement"],
          worldPeople: { npcs: [{ id: "provider-forged-npc", name: "伪人物" }] },
          player: {
            academia: 22,
            examRank: "model-rank",
            examHistory: [{ level: "palace_exam", score: 100 }]
          }
        },
        attributeChanges: [],
        relationshipChanges: [],
        events: ["provider event"],
        examTrigger: { shouldStart: false, level: null, reason: "" }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.activeExam = { level: "child_exam", reason: "server-created" };
  worldState.characters = [{ id: "C01", name: "Original mentor", role: "teacher" }];
  worldState.eventHistory = ["existing history"];
  worldState.player.examRank = "server-rank";
  worldState.player.examHistory = [{ level: "child_exam", score: 80 }];
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "study with an unsafe provider patch"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.deepEqual(payload.worldState.activeExam, { level: "child_exam", reason: "server-created" });
  assert.deepEqual(payload.worldState.characters, [{ id: "C01", name: "Original mentor", role: "teacher" }]);
  assert.equal(JSON.stringify(payload.worldState.worldPeople).includes("provider-forged-npc"), false);
  assert.equal(payload.worldState.eventHistory[0], "existing history");
  assert.ok(payload.worldState.eventHistory.includes("provider event"));
  assert.ok(!payload.worldState.eventHistory.includes("provider replacement"));
  assert.equal(payload.worldState.player.examRank, "server-rank");
  assert.deepEqual(payload.worldState.player.examHistory, [{ level: "child_exam", score: 80 }]);
  assert.equal(payload.worldState.player.academia, 22);
});

test("POST /api/game/turn does not let provider patch teacher identity through study interaction", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          player: {
            teacher: "hidden prompt sk-teacher-secret",
            reputation: 22
          }
        },
        attributeChanges: [],
        relationshipChanges: [],
        teacherFeedbackProposal: {
          focus: "制艺章法",
          advice: "先练破题承题。",
          reason: "只作文本点评。",
          teacherName: "provider proposal sk-teacher-secret"
        },
        events: ["provider event"],
        examTrigger: { shouldStart: false, level: null, reason: "" }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "拜访老师，请先生批改旧文并询问保结"
    })
  });
  const payload = await response.json();
  const serializedStudy = JSON.stringify(payload.studyProfileView);
  const serializedCharacters = JSON.stringify(payload.worldState.characters);

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.teacher, "顾文衡");
  assert.equal(payload.worldState.player.reputation, 22);
  assert.equal(payload.studyProfileView.academyNetwork.teacher.name, "顾文衡");
  assert.ok(payload.studyProfileView.teacherFeedback.some((entry) => entry.teacherName === "顾文衡"));
  assert.ok(payload.relationshipView.contacts.some((entry) => entry.id === "C01"));
  assert.equal(serializedStudy.includes("sk-teacher-secret"), false);
  assert.equal(serializedCharacters.includes("sk-teacher-secret"), false);
  assert.doesNotMatch(serializedStudy, /hidden|provider proposal|prompt|sk-teacher-secret/i);
});

test("POST /api/game/turn schedules and returns a server-owned active NPC request", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {},
        attributeChanges: [],
        relationshipChanges: [],
        events: ["provider event"],
        examTrigger: { shouldStart: false, level: null, reason: "" }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "study quietly"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.activeNpcRequestView.targetId, "C01");
  assert.equal(payload.activeNpcRequestView.status, "active");
  assert.ok(payload.worldPeopleView.relationships.some((relationship) =>
    relationship.id === "rel-player-npc-C01" &&
    relationship.recentNotes.some((note) => note.includes("当前请托"))
  ));
  assert.equal(payload.worldState.activeNpcRequest.targetId, "C01");
  assert.equal(JSON.stringify(payload.activeNpcRequestView).includes("Eunuch faction"), false);
  assert.equal(payload.activeNpcRequestEvents.length, 1);
  assert.equal(payload.worldState.eventHistory.at(-1), payload.worldTick.events.at(-1));
});

test("POST /api/game/turn resolves active NPC requests through server-owned relationship changes", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          activeNpcRequest: {
            id: "provider-forged",
            targetId: "eunuchs"
          }
        },
        attributeChanges: [],
        relationshipChanges: [],
        events: [],
        examTrigger: { shouldStart: false, level: null, reason: "" }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.turnCount = 1;
  runActiveNpcRequestStep(worldState, "研读经书");
  const requestId = worldState.activeNpcRequest.id;
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "答应拜访塾师并帮忙"
    })
  });
  const payload = await response.json();
  const auditEvents = await listAuditEvents(worldState.sessionId);

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 2);
  assert.equal(payload.worldState.activeNpcRequest, null);
  assert.equal(payload.activeNpcRequestView, null);
  assert.ok(payload.relationshipChanges.some((change) => change.targetId === "C01" && change.relationship.delta === 4));
  assert.ok(!JSON.stringify(payload.worldState).includes("provider-forged"));
  assert.ok(!JSON.stringify(payload.worldState).includes("eunuchs") || payload.worldState.relationshipLedger.factions.eunuchs.visible === false);
  assert.match(requestId, /^REQ-/);
  assert.ok(auditEvents.some((event) =>
    event.sourceSystem === "world_people" &&
    event.eventType === "active_request_resolved" &&
    /请托/.test(event.summary)
  ));
});

test("POST /api/game/turn runs S62.2 people lifecycle at month end", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {},
        attributeChanges: [],
        relationshipChanges: [],
        events: [],
        examTrigger: { shouldStart: false, level: null, reason: "" }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  addMonthEndLifecycleFixture(worldState);
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "核看族中旧账"
    })
  });
  const payload = await response.json();
  const auditEvents = await listAuditEvents(worldState.sessionId);
  const npc = payload.worldState.worldPeople.npcs.find((row) => row.id === "npc-route-gu");
  const asset = payload.worldState.worldPeople.assets.find((row) => row.id === "asset-route-gu");
  const estate = payload.worldState.worldPeople.estates.find((row) => row.id === "estate-route-gu");

  assert.equal(response.status, 200);
  assert.equal(payload.worldTick.completedMonth, true);
  assert.equal(npc.alive, false);
  assert.equal(asset.debtValue > 80, true);
  assert.equal(estate.status, "disputed");
  assert.ok(payload.worldState.eventHistory.some((event) => /人物演化/.test(event)));
  assert.ok(auditEvents.some((event) =>
    event.sourceSystem === "world_people" &&
    event.eventType === "npc_lifecycle_changed"
  ));
  assert.ok(auditEvents.some((event) =>
    event.sourceSystem === "world_people" &&
    event.eventType === "people_asset_changed"
  ));
  assert.equal(JSON.stringify(payload.worldPeopleView).includes("people-"), false);
  assert.equal(JSON.stringify(payload.worldPeopleView).includes("hiddenIntent"), false);
  assert.equal(JSON.stringify(payload.worldState.worldPeople).includes("SEALED_ROUTE"), false);
});
