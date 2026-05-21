const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { createInitialState } = require("../src/game/initialState");
const {
  buildOfficialCourtResponseView,
  isCourtResponseLikeInput,
  normalizeOfficialCourtResponseState
} = require("../src/game/officialCourtResponse");
const { buildTopicSurfaceView } = require("../src/game/topicSurfaceView");
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

function seedCourtRecords(worldState) {
  worldState.officialCareer.courtEntryResolutions = [{
    id: "OCER-cross-role",
    entryId: "official-court-entry-first-month-ASG-cross-role",
    assignmentId: "ASG-cross-role",
    surfaceId: "memorial-review",
    submissionKind: "official_first_month_memorial",
    status: "accepted_for_review",
    statusLabel: "准入复核",
    title: "准入复核：河工清册",
    publicSummary: "准入复核：河工清册已入奏折队列服务器裁决，仍须部院复核公开凭据，不直接任免、奖惩、处分或成弹劾。",
    generatedAtTurn: 4,
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod,
    sourceRefs: ["officialCareer.courtEntry:official-court-entry-first-month-ASG-cross-role"],
    nextStep: "由部院复核公开凭据后再入长期考成。"
  }, {
    id: "OCER-unsafe",
    entryId: "official-court-entry-first-month-ASG-unsafe",
    assignmentId: "ASG-unsafe",
    surfaceId: "memorial-review",
    submissionKind: "official_first_month_memorial",
    status: "accepted_for_review",
    title: "rawSql provider payload",
    publicSummary: "rawSql SELECT * FROM world_sessions data/sessions sk-test-secret",
    generatedAtTurn: 4
  }];
  worldState.officialCareer.courtEntryFollowUps = [{
    id: "OCEF-cross-role",
    entryId: "official-court-entry-first-month-ASG-cross-role",
    resolutionId: "OCER-cross-role",
    assignmentId: "ASG-cross-role",
    stage: "bureau_review",
    stageLabel: "部院覆奏",
    status: "referred_to_bureau",
    statusLabel: "部院待覆",
    title: "部院覆奏：河工清册",
    publicSummary: "部院待覆：河工清册承接近次准入复核进入部院覆奏，御前、部院、台谏只形成公开中间意见，不直接任免、奖惩、处分或成弹劾。",
    generatedAtTurn: 5,
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod,
    sourceRefs: [
      "officialCareer.courtEntry:official-court-entry-first-month-ASG-cross-role",
      "officialCareer.courtEntryResolution:OCER-cross-role"
    ],
    consequenceRefs: ["worldThread:official_court_follow_up"],
    nextStep: "相关部院待覆，下一步补齐公开凭据、限期和经手人。"
  }];
}

function assertNoUnsafeCourtResponseText(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /hidden[ _-]?(?:notes?|intent)|provider\s+payload|rawSql|SQL|sqlite|world_sessions|data[\\/](?:sessions|audit)|prompt_retrieval_index|sk-test-secret|tp-test-secret|api[_ -]?key/i
  );
  assert.doesNotMatch(serialized, /已任免|已处分|已赏罚|已采纳|圣旨已生效/);
}

test("S88.4 courtResponseView exposes cross-role safe response docket without official active view", () => {
  const worldState = createInitialState({
    role: "emperor",
    playerName: "回应视角"
  });
  seedCourtRecords(worldState);

  const view = buildOfficialCourtResponseView(worldState);

  assert.equal(view.active, true);
  assert.equal(view.responseRole, "emperor");
  assert.ok(view.responseItems.some((item) => item.sourceType === "official_court_follow_up"));
  assert.ok(view.nextActions.some((action) => /朱批|发交部院|召议/.test(action.label)));
  assert.equal(JSON.stringify(view).includes("OCEF-unsafe"), false);
  assertNoUnsafeCourtResponseText(view);
});

test("S88.4 court response classifier does not treat bare ministry wording as response intent", () => {
  assert.equal(isCourtResponseLikeInput("整顿部院日常公文，查核吏治积弊。"), false);
  assert.equal(isCourtResponseLikeInput("部院覆奏河工清册，请补公开凭据后再议。"), true);
});

test("S88.4 court response sanitizer drops terminal adjudication pollution", () => {
  const worldState = createInitialState({
    role: "minister",
    playerName: "终局污染"
  });
  seedCourtRecords(worldState);
  worldState.officialCourtResponses.responses = [{
    id: "OCR-terminal-pollution",
    responseRole: "minister",
    responseKind: "bureau_reply",
    status: "referred_to_bureau",
    sourceType: "official_court_follow_up",
    sourceId: "OCEF-cross-role",
    sourceFollowUpId: "OCEF-cross-role",
    title: "准奏照准：革职拨给钱粮",
    publicSummary: "准奏采纳奏折，奉旨准行，革职并拨给钱粮，照准题准。",
    generatedAtTurn: 7
  }];

  const state = normalizeOfficialCourtResponseState(worldState);
  const view = buildOfficialCourtResponseView(worldState);
  const memorial = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });

  assert.equal(state.responses.length, 0);
  assert.equal(view.recentResponses.length, 0);
  assert.doesNotMatch(JSON.stringify(view), /准奏|照准|题准|奉旨准行|革职|拨给钱粮/);
  assert.doesNotMatch(JSON.stringify(memorial), /准奏|照准|题准|奉旨准行|革职|拨给钱粮/);
  assertNoUnsafeCourtResponseText(view);
  assertNoUnsafeCourtResponseText(memorial);
});

test("S88.4 emperor court response turn records only a bounded response and does not trigger appointment coupling", async (t) => {
  const server = createTestServer();
  const worldState = createInitialState({
    role: "emperor",
    playerName: "回应回合"
  });
  seedCourtRecords(worldState);
  t.after(async () => {
    await removeSessionFile(worldState.sessionId);
    await server.close();
  });
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "朱批留览部院覆奏：河工清册只令部院据公开凭据覆奏，不直接任免赏罚，后果仍候服务器裁决。"
  });
  const rawSession = JSON.parse(await fs.readFile(path.join(sessionsDir, `${worldState.sessionId}.json`), "utf8"));
  const rawResponseState = normalizeOfficialCourtResponseState(rawSession.worldState);

  assert.equal(response.status, 200);
  assert.ok(payload.courtResponseView.recentResponses.length >= 1);
  assert.ok(payload.officialCourtResponse.events.some((event) => event.includes("[奏议回应记录]")));
  assert.equal(payload.roleWorldCouplingView.recentImpacts.some((impact) => impact.kind === "emperor_appointments"), false);
  assert.equal(Boolean(payload.worldState.officialCourtResponses), false);
  assert.equal(rawResponseState.responses.length, 1);
  assert.equal(rawResponseState.responses[0].responseKind, "vermilion_note");
  assertNoUnsafeCourtResponseText(payload.courtResponseView);
});

test("S88.4 topic surfaces can read courtResponseView evidence for memorial review and debate", () => {
  const worldState = createInitialState({
    role: "minister",
    playerName: "部院回应"
  });
  seedCourtRecords(worldState);
  worldState.officialCourtResponses.responses = [{
    id: "OCR-topic",
    responseRole: "minister",
    responseKind: "bureau_reply",
    status: "referred_to_bureau",
    sourceType: "official_court_follow_up",
    sourceId: "OCEF-cross-role",
    sourceFollowUpId: "OCEF-cross-role",
    title: "部院覆奏：河工清册",
    publicSummary: "部院票拟回应河工清册，只列公开凭据、经手人、限期和后续待核事项。",
    generatedAtTurn: 6,
    sourceRefs: ["official_court_follow_up:OCEF-cross-role"],
    consequenceRefs: ["eventArchive:official_court_response"]
  }];

  const memorial = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  const debate = buildTopicSurfaceView(worldState, { surfaceId: "court-debate" });

  for (const view of [memorial, debate]) {
    assert.ok(view.sourceViews.some((source) => source.sourceView === "courtResponseView"));
    assert.ok(view.evidenceRefs.some((ref) =>
      ref.sourceView === "courtResponseView" && /河工清册|奏议回应|部院/.test(`${ref.label}${ref.summary}`)
    ));
    assertNoUnsafeCourtResponseText(view);
  }
});
