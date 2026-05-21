const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const { createInitialState } = require("../src/game/initialState");
const {
  buildOfficialCourtConsequenceView,
  isCourtConsequenceLikeInput,
  normalizeOfficialCourtConsequenceState,
  runOfficialCourtConsequenceStep
} = require("../src/game/officialCourtConsequences");
const {
  buildPlayerMonthlyBriefingContext,
  generateMonthlyBriefingProposal
} = require("../src/game/playerMonthlyBriefing");
const { applyStatePatch } = require("../src/game/stateRules");
const { buildTopicSurfaceView } = require("../src/game/topicSurfaceView");
const { buildWorldThreadView, ensureWorldThreadState } = require("../src/game/worldThreads");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  return createFetchSafeServer(app);
}

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

function seedCourtConsequenceRecords(worldState) {
  Object.assign(worldState.player, {
    officeTitle: "工部主事",
    position: "工部主事",
    performanceMerit: 42,
    impeachmentRisk: 26
  });
  worldState.turnCount = 8;
  worldState.officialCareer.currentPosting = "工部主事";
  worldState.officialCareer.assessmentDossier = {
    meritScore: 42,
    riskScore: 26,
    notes: [],
    lastUpdatedTurn: 7
  };
  worldState.officialCareer.impeachmentProcedure = {
    stage: "none",
    risk: 0,
    dueTurn: null,
    deadlineUnit: null,
    visibleNotice: "",
    hiddenNotes: [],
    lastUpdatedTurn: 7
  };
  worldState.officialCareer.courtEntryResolutions = [{
    id: "OCER-consequence-river",
    entryId: "official-court-entry-first-month-ASG-river",
    assignmentId: "ASG-river",
    surfaceId: "memorial-review",
    submissionKind: "official_first_month_memorial",
    status: "accepted_for_review",
    statusLabel: "准入复核",
    title: "准入复核：河工清册",
    publicSummary: "准入复核：河工清册已入奏折队列服务器裁决，仍须部院复核公开凭据，不直接调整官缺、落成赏罚或形成风宪定案。",
    meritDelta: 1,
    riskDelta: 0,
    generatedAtTurn: 5,
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod,
    sourceRefs: ["officialCareer.courtEntry:official-court-entry-first-month-ASG-river"],
    nextStep: "由部院复核公开凭据后再入长期考成。"
  }, {
    id: "OCER-consequence-unsafe",
    title: "rawSql provider payload",
    publicSummary: "rawSql SELECT * FROM world_sessions data/sessions sk-test-secret",
    generatedAtTurn: 5
  }];
  worldState.officialCareer.courtEntryFollowUps = [{
    id: "OCEF-consequence-risk",
    entryId: "official-court-entry-first-month-ASG-river",
    resolutionId: "OCER-consequence-river",
    assignmentId: "ASG-river",
    stage: "bureau_review",
    stageLabel: "部院覆奏",
    status: "returned_for_evidence",
    statusLabel: "待补公开凭据",
    title: "部院覆奏：河工清册",
    publicSummary: "部院待覆：河工清册承接近次准入复核进入部院覆奏，台谏要求补齐公开凭据，只形成长期观察和风宪风险提示。",
    meritDelta: 0,
    riskDelta: 1,
    generatedAtTurn: 6,
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod,
    sourceRefs: [
      "officialCareer.courtEntry:official-court-entry-first-month-ASG-river",
      "officialCareer.courtEntryResolution:OCER-consequence-river"
    ],
    consequenceRefs: ["worldThread:official_court_follow_up"],
    nextStep: "先补公开凭据、经手人和限期，再入本任考成观察。"
  }];
  worldState.officialCourtResponses.responses = [{
    id: "OCR-consequence-bureau",
    responseRole: "minister",
    responseKind: "bureau_reply",
    responseKindLabel: "部院覆奏",
    status: "requested_evidence",
    statusLabel: "请补公开凭据",
    sourceType: "official_court_follow_up",
    sourceId: "OCEF-consequence-risk",
    title: "部院覆奏：河工清册",
    publicSummary: "部院票拟回应河工清册，只列公开凭据、经手人、限期和风宪观察来源。",
    generatedAtTurn: 7,
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod,
    sourceRefs: ["official_court_follow_up:OCEF-consequence-risk"],
    consequenceRefs: ["eventArchive:official_court_response"]
  }];
}

function assertNoUnsafeCourtConsequenceText(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /hidden[ _-]?(?:notes?|intent)|provider\s+payload|rawSql|SQL|sqlite|world_sessions|data[\\/](?:sessions|audit)|prompt_retrieval_index|sk-test-secret|tp-test-secret|api[_ -]?key/i
  );
  assert.doesNotMatch(serialized, /准奏|照准|题准|奉旨准行|革职|拨给钱粮/);
}

test("S88.4 courtConsequenceView exposes safe long-term consequence sources", () => {
  const worldState = createInitialState({ role: "official", playerName: "后果视角" });
  seedCourtConsequenceRecords(worldState);

  const view = buildOfficialCourtConsequenceView(worldState);

  assert.equal(view.active, true);
  assert.ok(view.pendingSources.some((source) => source.sourceType === "official_court_follow_up"));
  assert.ok(view.pendingSources.some((source) => source.sourceType === "official_court_response"));
  assert.ok(view.nextActions.some((action) => /考成|风宪|月报/.test(`${action.label}${action.text}`)));
  assert.equal(JSON.stringify(view).includes("OCER-consequence-unsafe"), false);
  assertNoUnsafeCourtConsequenceText(view);
});

test("S88.4 court consequence signal reaches archive, threads, monthly briefing, and topic surfaces", () => {
  const worldState = createInitialState({ role: "official", playerName: "后果官" });
  seedCourtConsequenceRecords(worldState);
  const beforeMerit = worldState.officialCareer.assessmentDossier.meritScore;
  const beforeRisk = worldState.officialCareer.assessmentDossier.riskScore;

  const result = runOfficialCourtConsequenceStep(
    worldState,
    "将部院覆奏：河工清册合入考成观察，并复核风宪风险与月报摘录。",
    { force: true }
  );
  applyStatePatch(worldState, result.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  ensureWorldThreadState(worldState);

  const state = normalizeOfficialCourtConsequenceState(worldState);
  const view = buildOfficialCourtConsequenceView(worldState);
  const archive = buildEventArchiveView(worldState, { pageSize: 50 });
  const threads = buildWorldThreadView(worldState);
  const context = buildPlayerMonthlyBriefingContext(worldState, {
    period: {
      key: "1644-08",
      label: "明1644年8月",
      date: { year: 1644, month: 8, tenDayPeriod: 3, turn: worldState.turnCount }
    }
  });
  const briefing = generateMonthlyBriefingProposal(context);
  const memorial = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  const debate = buildTopicSurfaceView(worldState, { surfaceId: "court-debate" });

  assert.ok(result.outcome);
  assert.equal(state.signals.length, 1);
  assert.ok(view.recentSignals.some((signal) => /河工清册/.test(signal.publicSummary)));
  assert.ok(worldState.officialCareer.assessmentDossier.meritScore >= beforeMerit);
  assert.ok(worldState.officialCareer.assessmentDossier.riskScore >= beforeRisk);
  assert.ok(result.attributeChanges.some((change) => change.path === "officialCourtConsequences.signals"));
  assert.ok(archive.items.some((item) => item.sourceType === "official_court_consequence" && /河工清册/.test(item.summary)));
  assert.ok(threads.activeThreads.some((thread) => thread.sourceType === "official_court_consequence" && /河工清册/.test(thread.summary)));
  assert.ok(briefing.sections.some((section) =>
    section.id === "official_duties" && section.items.some((item) => /河工清册/.test(item))
  ));
  assert.ok(briefing.actionItems.some((item) => /考成|风宪|月报|公开凭据/.test(item)));
  for (const surface of [memorial, debate]) {
    assert.ok(surface.sourceViews.some((source) => source.sourceView === "courtConsequenceView"));
    assert.ok(surface.evidenceRefs.some((ref) =>
      ref.sourceView === "courtConsequenceView" && /河工清册|官场后果|风宪|考成/.test(`${ref.label}${ref.summary}`)
    ));
  }
  assertNoUnsafeCourtConsequenceText({ view, archive, threads, briefing, memorial, debate });
});

test("S88.4 official turn records bounded court consequence and keeps raw ledger out of route response", async (t) => {
  const server = createTestServer();
  const worldState = createInitialState({ role: "official", playerName: "后果回合" });
  seedCourtConsequenceRecords(worldState);
  t.after(async () => {
    await removeSessionFile(worldState.sessionId);
    await server.close();
  });
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "把部院覆奏：河工清册合入考成观察，复核风宪风险，并摘入月报。"
  });
  const rawSession = JSON.parse(await fs.readFile(path.join(sessionsDir, `${worldState.sessionId}.json`), "utf8"));
  const rawState = normalizeOfficialCourtConsequenceState(rawSession.worldState);

  assert.equal(response.status, 200);
  assert.ok(payload.courtConsequenceView.recentSignals.length >= 1);
  assert.ok(payload.officialCourtConsequence.events.some((event) => event.includes("[官场后果信号]")));
  assert.equal(Boolean(payload.worldState.officialCourtConsequences), false);
  assert.equal(rawState.signals.length >= 1, true);
  assert.equal(payload.courtConsequenceView.safety.serverAdjudicatedSignals, true);
  assertNoUnsafeCourtConsequenceText(payload.courtConsequenceView);
  assertNoUnsafeCourtConsequenceText(payload.worldState);
});

test("S88.4 court consequence classifier ignores unrelated ministry wording", () => {
  assert.equal(isCourtConsequenceLikeInput("整理部院日常公文，校阅旧案清册。"), false);
  assert.equal(isCourtConsequenceLikeInput("将近次奏议合入考成观察，并复核风宪风险。"), true);
});
