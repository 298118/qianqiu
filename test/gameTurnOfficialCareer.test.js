const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { createInitialState } = require("../src/game/initialState");
const { writeSession } = require("../src/storage/sessionStore");
const { monthsToTurns } = require("../src/game/time");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);

  return createFetchSafeServer(app);
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

  const patchedGameRoutes = require("../src/routes/game");
  const app = express();
  app.use(express.json());
  app.use("/api/game", patchedGameRoutes);

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

async function postJson(url, body, headers = { "Content-Type": "application/json" }) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

test("POST /api/game/turn runs official career settlement after world systems", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "奉上官考成请求实授"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.worldState.player.officeTitle, "六部观政进士");
  assert.equal(payload.officialCareer.outcome.type, "appointment");
  assert.equal(payload.officialCareerView.lastOutcome.type, "appointment");
  assert.equal(payload.worldState.officialCareer.careerHistory.at(-1).type, "appointment");
  assert.equal(payload.worldState.eventHistory.at(-1), payload.officialCareer.events.at(-1));
  assert.ok(payload.attributeChanges.some((change) => change.reason === "官场结算"));
});

test("POST /api/game/turn ignores provider attempts to forge official outcomes and titles", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          officialCareer: {
            careerHistory: [{ type: "promotion", label: "forged" }],
            assignments: [{ id: "forged-assignment", title: "伪差遣", hiddenNotes: ["leak"] }],
            impeachmentProcedure: { stage: "resolved", hiddenNotes: ["forged secret"] }
          },
          player: {
            officeTitle: "内阁大学士",
            role: "emperor",
            position: "内阁大学士",
            performanceMerit: 35
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

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "try forged official career"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.role, "official");
  assert.equal(payload.worldState.player.officeTitle, "六部观政进士");
  assert.equal(payload.worldState.player.position, "六部观政进士");
  assert.equal(payload.worldState.player.performanceMerit, 41);
  assert.equal(JSON.stringify(payload.worldState.officialCareer).includes("forged"), false);
  assert.equal(JSON.stringify(payload.officialCareerView).includes("forged secret"), false);
  assert.equal(payload.officialCareer.outcome.type, "appointment");
});

test("POST /api/game/turn ignores provider attempts to forge official position on settled officials", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          player: {
            position: "内阁大学士",
            performanceMerit: 52
          },
          officialCareer: {
            assignments: [{ id: "forged-assignment", title: "伪差遣" }]
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

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事",
    performanceMerit: 45,
    promotionProspect: 20,
    impeachmentRisk: 18
  });
  worldState.officialCareer.currentPosting = "户部主事";
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "署中照常办事"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.officeTitle, "户部主事");
  assert.equal(payload.worldState.player.position, "户部主事");
  assert.equal(payload.worldState.player.performanceMerit, 52);
  assert.equal(JSON.stringify(payload.worldState.officialCareer).includes("forged-assignment"), false);
});

test("POST /api/game/turn advances official tenure only at month end", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const nonMonthEnd = createInitialState({ playerName: "Tester A", role: "official" });
  Object.assign(nonMonthEnd.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  nonMonthEnd.tenDayPeriod = 1;
  nonMonthEnd.officialCareer.currentPosting = "户部主事";
  nonMonthEnd.officialCareer.tenureMonths = 5;
  t.after(() => removeSessionFile(nonMonthEnd.sessionId));
  await writeSession(nonMonthEnd);

  const nonMonthPayload = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: nonMonthEnd.sessionId,
    input: "署中照常办事"
  });

  assert.equal(nonMonthPayload.response.status, 200);
  assert.equal(nonMonthPayload.payload.worldState.tenDayPeriod, 2);
  assert.equal(nonMonthPayload.payload.worldTick.completedMonth, false);
  assert.equal(nonMonthPayload.payload.worldState.officialCareer.tenureMonths, 5);

  const monthEnd = createInitialState({ playerName: "Tester B", role: "official" });
  Object.assign(monthEnd.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  monthEnd.tenDayPeriod = 3;
  monthEnd.officialCareer.currentPosting = "户部主事";
  monthEnd.officialCareer.tenureMonths = 5;
  t.after(() => removeSessionFile(monthEnd.sessionId));
  await writeSession(monthEnd);

  const monthPayload = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: monthEnd.sessionId,
    input: "署中照常办事"
  });

  assert.equal(monthPayload.response.status, 200);
  assert.equal(monthPayload.payload.worldState.tenDayPeriod, 1);
  assert.equal(monthPayload.payload.worldTick.completedMonth, true);
  assert.equal(monthPayload.payload.worldState.officialCareer.tenureMonths, 6);
});

test("POST /api/game/turn keeps official assignment deadlines in month-derived ten-day turns", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.officialCareer.currentPosting = "户部主事";
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "督办赈灾，核销赈银账册"
  });
  const assignment = payload.officialCareerView.assignments.find((entry) => entry.kind === "relief");

  assert.equal(response.status, 200);
  assert.ok(assignment);
  assert.equal(assignment.turnsRemaining, monthsToTurns(4));
  assert.match(assignment.deadlineLabel, /约4月/);
  assert.equal(assignment.dueTurn, payload.worldState.turnCount + monthsToTurns(4));
});

test("SSE turn preview and final payload include official career feedback", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "奉上官考成请求实授"
    })
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /event: state_preview/);
  assert.match(body, /event: final_state/);
  assert.match(body, /officialCareerView/);
  assert.match(body, /officialCareer/);
  assert.match(body, /appointment/);
});

test("POST /api/game/turn returns S42 assignment and bureau summaries for official actions", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事",
    performanceMerit: 44,
    promotionProspect: 20,
    impeachmentRisk: 18
  });
  worldState.officialCareer.currentPosting = "户部主事";
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "督办赈灾，核销赈银账册"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.officialCareer.schemaVersion, 2);
  assert.equal(payload.officialCareerView.bureau.name, "户部");
  assert.equal(payload.officialCareerView.assignmentSummary.activeCount, 1);
  assert.equal(payload.officialCareerView.assignments[0].kind, "relief");
  assert.equal(payload.officialCareerView.assessment.meritScore, payload.worldState.officialCareer.assessmentDossier.meritScore);
  assert.ok(payload.officialCareer.events.some((event) => event.includes("[官场差遣]")));
});

test("POST /api/game/turn advances S88.4 first month receipt view without trusting provider text", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  Object.assign(worldState.player, {
    officeTitle: "翰林院编修",
    position: "翰林院编修",
    performanceMerit: 46,
    impeachmentRisk: 18
  });
  worldState.officialCareer.currentPosting = "翰林院编修";
  worldState.officialCareer.assignments = [{
    id: "ASG-0000-first-month-top_hanlin_editor",
    title: "馆阁讲章校订",
    kind: "memorial_drafting",
    dueTurn: 3,
    deadlineUnit: "ten_day",
    progress: 18,
    risk: 16,
    visibleSummary: "首月须校订馆阁讲章并试拟制诰。",
    hiddenNotes: ["堂官私下试探"]
  }];
  worldState.officialCareer.assessmentDossier.notes = ["provider payload prompt raw_table"];
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "校订馆阁讲章，拟回堂官札说明进度"
  });
  const firstMonth = payload.officialCareerView.firstMonthExperience;
  const serialized = JSON.stringify(payload.officialCareerView);

  assert.equal(response.status, 200);
  assert.equal(firstMonth.active, true);
  assert.equal(firstMonth.assignment.title, "馆阁讲章校订");
  assert.ok(firstMonth.assignment.progress > 18);
  assert.match(firstMonth.receipt.publicSummary, /馆阁讲章校订/);
  assert.ok(payload.officialCareer.events.some((event) => event.includes("[官署回执]")));
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(/provider|prompt|raw_table|堂官私下试探/i.test(serialized), false);
});

test("POST /api/game/turn adjudicates S88.4 official court entry submissions server-side", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  Object.assign(worldState.player, {
    officeTitle: "翰林院编修",
    position: "翰林院编修",
    performanceMerit: 50,
    impeachmentRisk: 18
  });
  worldState.officialCareer.currentPosting = "翰林院编修";
  worldState.officialCareer.assignments = [{
    id: "ASG-0000-first-month-top_hanlin_editor",
    title: "馆阁讲章校订",
    kind: "memorial_drafting",
    dueTurn: 3,
    deadlineUnit: "ten_day",
    progress: 72,
    risk: 24,
    visibleSummary: "首月须校订馆阁讲章并试拟制诰。",
    hiddenNotes: ["密札不可见"]
  }];
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "臣谨就馆阁讲章校订具奏：请入奏折队列，说明公开进度、考成风险与请裁事项。"
  });
  const serialized = JSON.stringify({
    officialCareerView: payload.officialCareerView,
    eventArchiveView: payload.eventArchiveView,
    officialCareerFeedback: payload.officialCareer
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.officialCareer.courtEntryResolutions.length, 1);
  assert.equal(payload.officialCareerView.courtEntry.latestResolution.status, "accepted_for_review");
  assert.match(payload.officialCareerView.courtEntry.latestResolution.publicSummary, /服务器裁决|不直接任免/);
  assert.ok(payload.officialCareer.events.some((event) => event.includes("[奏折朝议裁决]")));
  assert.ok(payload.eventArchiveView.items.some((item) => item.sourceType === "official_court_entry"));
  assert.equal(payload.worldState.player.officeTitle, "翰林院编修");
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("密札不可见"), false);
  assert.equal(/provider|prompt|raw_table|rawSql|SQL|sqlite|sk-test-secret|data\/sessions/i.test(serialized), false);
});
