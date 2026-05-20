const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const examRoutes = require("../src/routes/exam");
const { buildClientWorldState } = require("../src/game/clientWorldState");
const { EXAMS } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const PASSING_ESSAY = "govern with rites, study the classics, preserve order, and care for the people. ".repeat(80);
const OPEN_MONTH_BY_LEVEL = {
  child_exam: 1,
  provincial_exam: 8,
  metropolitan_exam: 2,
  palace_exam: 4
};

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/exam", examRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  });

  return createFetchSafeServer(app);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

function makeReadyScholar(overrides = {}) {
  const worldState = createInitialState({ playerName: "Travel Tester" });
  Object.assign(worldState.player, {
    academia: 100,
    literaryTalent: 100,
    adaptability: 100,
    mentality: 100,
    reputation: 100,
    gold: 100000,
    ...overrides
  });
  return worldState;
}

async function completeExam(baseUrl, sessionId, level) {
  const current = await readSession(sessionId);
  current.month = OPEN_MONTH_BY_LEVEL[level];
  await writeSession(current);

  const question = await postJson(`${baseUrl}/api/exam/question`, { sessionId, level });
  assert.equal(question.response.status, 201);
  assert.ok(question.payload.entryPreparation);

  const submit = await postJson(`${baseUrl}/api/exam/submit`, {
    sessionId,
    examId: question.payload.examId,
    essay: PASSING_ESSAY
  });
  assert.equal(submit.response.status, 200);
  assert.equal(submit.payload.promotionResult.passed, true);
  assert.ok(submit.payload.entryPreparation.preparationPressure.score >= 0);
  assert.equal(
    submit.payload.examProcedureView.preparationPressure.label,
    submit.payload.entryPreparation.preparationPressure.label
  );
  assert.equal(submit.payload.studyProfileView.schemaVersion, 1);
  assert.ok(submit.payload.studyProfileView.recentExercises.some((entry) => entry.source === "exam_history"));
  assert.ok(submit.payload.worldState.player.examHistory.at(-1).entryPreparation);
  return submit.payload.worldState;
}

test("exam question entry applies funded travel cost without advancing time", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ gold: 50 });
  worldState.year = 1644;
  worldState.month = 7;
  worldState.turnCount = 7;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "child_exam"
  });

  assert.equal(response.status, 201);
  assert.equal(payload.worldState.turnCount, 7);
  assert.equal(payload.worldState.year, 1644);
  assert.equal(payload.worldState.month, 7);
  assert.equal(payload.sceneTime.phase, "question_review");
  assert.equal(payload.examProcedureView.phase, "question_release");
  assert.equal(payload.examProcedureView.rollLifecycle.sealed, false);
  assert.equal(payload.examProcedureView.sponsorship.status, "not_ready");
  assert.equal(payload.sceneTime.startedAt.year, 1644);
  assert.equal(payload.sceneTime.startedAt.month, 7);
  assert.equal(payload.sceneTime.startedAt.tenDayPeriod, 1);
  assert.equal(payload.entryPreparation.fullyFunded, true);
  assert.equal(payload.entryPreparation.requiredGold, 2);
  assert.equal(payload.entryPreparation.paidGold, 2);
  assert.equal(payload.entryPreparation.preparationPressure.label, "留意");
  assert.ok(payload.entryPreparation.preparationPressure.score >= 30);
  assert.equal(payload.examProcedureView.preparationPressure.label, payload.entryPreparation.preparationPressure.label);
  assert.equal(payload.studyProfileView.examPreparation.label, payload.entryPreparation.preparationPressure.label);
  assert.equal(payload.worldState.player.gold, 48);
  assert.deepEqual(payload.worldState.activeExam.entryPreparation, payload.entryPreparation);
  assert.equal(payload.studyProfileView.schemaVersion, 1);
  assert.equal(payload.worldGeographyView.schemaVersion, 1);
  assert.equal(payload.mapContextView.schemaVersion, 1);
  assert.ok(payload.mapContextView.mapEntityRefs.some((ref) => ref.entityType === "exam_travel"));
  assert.equal(JSON.stringify(payload.worldGeographyView).includes("SEALED_ROUTE_NOTE"), false);

  const saved = await readSession(worldState.sessionId);
  assert.deepEqual(saved.activeExam.entryPreparation, payload.entryPreparation);
  assert.equal(saved.activeExam.sceneTime.phase, "question_review");
});

test("exam question allows shortfall and converts it into preparation risk", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({
    examRank: EXAMS.child_exam.promotionRank,
    gold: 1,
    health: 80,
    mentality: 80,
    adaptability: 80
  });
  worldState.month = 9;
  worldState.turnCount = 3;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "provincial_exam"
  });

  assert.equal(response.status, 201);
  assert.equal(payload.entryPreparation.fullyFunded, false);
  assert.equal(payload.entryPreparation.requiredGold, 8);
  assert.equal(payload.entryPreparation.paidGold, 1);
  assert.equal(payload.entryPreparation.shortfall, 7);
  assert.equal(payload.entryPreparation.preparationPressure.label, "危急");
  assert.ok(payload.entryPreparation.preparationPressure.score >= 55);
  assert.ok(payload.entryPreparation.preparationPressure.causes.some((cause) => /盘费缺/.test(cause)));
  assert.match(payload.entryPreparation.entryFeedback.publicSummary, /盘费不足/);
  assert.equal(payload.examProcedureView.preparationPressure.label, "危急");
  assert.ok(payload.examProcedureView.incidents.some((incident) => incident.type === "preparation_pressure"));
  assert.match(payload.examProcedureView.entrySearch.publicSummary, /备考压力/);
  assert.equal(payload.worldState.player.gold, 0);
  assert.equal(payload.worldState.player.health, 77);
  assert.equal(payload.worldState.player.mentality, 76);
  assert.equal(payload.worldState.player.adaptability, 79);
  assert.equal(payload.worldState.turnCount, 3);
  assert.equal(payload.worldState.month, 9);
});

test("exam preparation pressure accounts for readiness gaps on the real question route", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({
    gold: 50,
    academia: 0,
    literaryTalent: 0,
    mentality: 0
  });
  worldState.month = 1;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "child_exam"
  });

  assert.equal(response.status, 201);
  assert.equal(payload.readiness.ready, false);
  assert.equal(payload.readiness.missing.length, 3);
  assert.ok(payload.entryPreparation.preparationPressure.score >= 60);
  assert.ok(payload.entryPreparation.preparationPressure.causes.some((cause) => /准考准备仍有3项缺口/.test(cause)));
  assert.equal(payload.examProcedureView.preparationPressure.label, payload.entryPreparation.preparationPressure.label);
});

test("exam entry preparation public payload sanitizes polluted legacy preparation snapshots", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ gold: 20 });
  worldState.examCalendar = {
    isOpen: true,
    providerResponse: { accepted: true },
    raw_provider_payload: { ok: true },
    note: "data/sessions/root-calendar.json",
    publicNote: "/mnt/e/key sk-test"
  };
  worldState.activeExam = {
    examId: "child_exam-polluted",
    level: "child_exam",
    examName: "童试",
    examQuestion: "论治学之道。",
    questionType: "经义简答",
    difficulty: "入门",
    requirements: ["依题作答"],
    wordCount: { min: 200, max: 400 },
    passScore: 60,
    promotionRank: "秀才",
    readiness: { ready: true, missing: [] },
    status: "writing",
    examCalendar: {
      isOpen: true,
      providerResponse: { accepted: true },
      raw_provider_payload: { ok: true },
      note: "root calendar /home/root rawProvider"
    },
    entryPreparation: {
      requiredGold: 2,
      paidGold: 2,
      shortfall: 0,
      fullyFunded: true,
      distance: "local",
      travelMonths: 0,
      event: "rawProvider sk-legacy-secret",
      effects: { mentality: 1, rawProvider: 100 },
      hiddenNotes: "SEALED_PREP_NOTE",
      sponsorship: {
        status: "ready",
        score: 80,
        guarantorName: "顾文衡",
        publicSummary: "hiddenNotes rawProvider prompt"
      },
      examCalendar: {
        isOpen: true,
        hiddenNotes: "SEALED_CALENDAR_NOTE",
        rawProviderPayload: "forged",
        raw_provider_payload: "forged",
        providerResponse: "forged",
        note: "data/sessions/legacy.json"
      },
      preparationPressure: {
        score: 70,
        band: "strained",
        label: "吃紧",
        summary: "rawProvider sk-legacy-secret",
        studyFocus: "制艺章法",
        causes: ["hiddenNotes", "盘费已足"],
        suggestedActions: ["/mnt/e/secret", "先审题立意。"],
        rawProviderPayload: "forged"
      },
      entryFeedback: {
        pressureScore: 70,
        pressureLabel: "吃紧",
        publicSummary: "prompt sk-legacy-secret",
        entrySearchSummary: "rawProvider should not render",
        cellSummary: "号舍已定。",
        visibleNextActions: ["data/sessions/legacy.json", "先审题。"]
      }
    }
  };
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "child_exam"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.entryPreparation.hiddenNotes, undefined);
  assert.equal(payload.entryPreparation.effects.rawProvider, undefined);
  assert.equal(payload.entryPreparation.examCalendar.hiddenNotes, undefined);
  assert.equal(payload.entryPreparation.examCalendar.rawProviderPayload, undefined);
  assert.equal(payload.entryPreparation.examCalendar.raw_provider_payload, undefined);
  assert.equal(payload.entryPreparation.examCalendar.providerResponse, undefined);
  assert.equal(payload.examCalendar.providerResponse, undefined);
  assert.equal(payload.examCalendar.raw_provider_payload, undefined);
  assert.equal(payload.examCalendar.note, "");
  assert.equal(payload.entryPreparation.preparationPressure.rawProviderPayload, undefined);
  assert.match(payload.entryPreparation.preparationPressure.summary, /服务器整理/);
  assert.match(payload.entryPreparation.entryFeedback.publicSummary, /服务器整理/);
  assert.doesNotMatch(JSON.stringify(payload.entryPreparation), /rawProvider|raw_provider|providerResponse|hiddenNotes|sk-legacy-secret|data\/sessions|\/mnt\/|\/home\//);
  assert.doesNotMatch(JSON.stringify(payload.examCalendar), /rawProvider|raw_provider|providerResponse|hiddenNotes|sk-legacy-secret|data\/sessions|\/mnt\/|\/home\//);
  assert.doesNotMatch(JSON.stringify(payload.examProcedureView), /rawProvider|raw_provider|providerResponse|hiddenNotes|sk-legacy-secret|data\/sessions|\/mnt\/|\/home\//);
  assert.equal(payload.worldState.examCalendar.providerResponse, undefined);
  assert.equal(payload.worldState.examCalendar.raw_provider_payload, undefined);
  assert.doesNotMatch(JSON.stringify(payload.worldState.activeExam), /rawProvider|raw_provider|providerResponse|hiddenNotes|sk-legacy-secret|data\/sessions|\/mnt\/|\/home\//);
  assert.doesNotMatch(JSON.stringify(payload.worldState.examCalendar), /rawProvider|raw_provider|providerResponse|hiddenNotes|sk-test|data\/sessions|\/mnt\/|\/home\//);
});

test("client world state sanitizes root exam calendar pollution", () => {
  const worldState = makeReadyScholar({ gold: 20 });
  worldState.examCalendar = {
    isOpen: true,
    note: "data/sessions/root-calendar.json",
    publicNote: "/mnt/e/key sk-root",
    rawProviderPayload: "forged",
    providerResponse: { accepted: true },
    nested: {
      prompt: "raw provider prompt",
      visible: "今科照常开场"
    }
  };

  const clientState = buildClientWorldState(worldState);

  assert.equal(clientState.examCalendar.rawProviderPayload, undefined);
  assert.equal(clientState.examCalendar.providerResponse, undefined);
  assert.equal(clientState.examCalendar.note, "");
  assert.equal(clientState.examCalendar.publicNote, "");
  assert.equal(clientState.examCalendar.nested.prompt, undefined);
  assert.equal(clientState.examCalendar.nested.visible, "今科照常开场");
  assert.doesNotMatch(JSON.stringify(clientState.examCalendar), /rawProvider|providerResponse|prompt|sk-root|data\/sessions|\/mnt\//);
});

test("exam entry preparation carries server-owned study sponsorship snapshot", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ examRank: EXAMS.child_exam.promotionRank, gold: 20 });
  worldState.month = 8;
  worldState.player.teacher = "顾文衡";
  worldState.studyProfile = {
    schemaVersion: 1,
    dimensions: {},
    academyNetwork: {
      sponsorship: {
        status: "ready",
        score: 82,
        guarantorName: "顾文衡",
        publicSummary: "顾文衡已可为本场举业作保。",
        nextStep: "待考期开场后报名。"
      }
    }
  };
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "provincial_exam"
  });

  assert.equal(response.status, 201);
  assert.equal(payload.examCalendar.teacherRecommendation.sponsorshipStatus, "ready");
  assert.equal(payload.entryPreparation.sponsorship.status, "ready");
  assert.equal(payload.entryPreparation.sponsorship.score, 82);
  assert.match(payload.entryPreparation.sponsorship.publicSummary, /作保/);
  assert.equal(payload.entryPreparation.sponsorship.ready, true);
  assert.equal(payload.worldState.player.examRank, EXAMS.child_exam.promotionRank);
});

test("exam entry sponsorship readiness is based on sponsorship status only", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ examRank: EXAMS.child_exam.promotionRank, gold: 20 });
  worldState.month = 8;
  worldState.player.teacher = "顾文衡";
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "provincial_exam"
  });

  assert.equal(response.status, 201);
  assert.equal(payload.examCalendar.teacherRecommendation.ready, true);
  assert.equal(payload.entryPreparation.sponsorship.status, "not_ready");
  assert.equal(payload.entryPreparation.sponsorship.ready, false);
  assert.equal(payload.worldState.player.examRank, EXAMS.child_exam.promotionRank);
});

test("exam question outside a missed window records the calendar miss without charging travel", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({
    examRank: EXAMS.child_exam.promotionRank,
    gold: 30
  });
  worldState.month = 10;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "provincial_exam"
  });

  assert.equal(response.status, 409);
  assert.match(payload.error, /乡试/);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.player.gold, 30);
  assert.equal(saved.activeExam, null);
  assert.equal(saved.examCalendar.missedWindows.length, 1);
  assert.equal(saved.examCalendar.missedWindows[0].level, "provincial_exam");
});

test("exam progress advances only the local exam scene phase", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ gold: 20 });
  worldState.year = 1644;
  worldState.month = 1;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 5;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const question = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "child_exam"
  });
  assert.equal(question.response.status, 201);

  const progress = await postJson(`${server.baseUrl}/api/exam/progress`, {
    sessionId: worldState.sessionId,
    examId: question.payload.examId,
    action: "拟纲定章法"
  });

  assert.equal(progress.response.status, 200);
  assert.equal(progress.payload.sceneTime.phase, "outline");
  assert.equal(progress.payload.examScene.phase, "outline");
  assert.equal(progress.payload.examProcedureView.phase, "drafting");
  assert.equal(progress.payload.examProcedureView.rollLifecycle.draftRoll, true);
  assert.equal(progress.payload.worldTick.cadence, "scene");
  assert.equal(progress.payload.worldTick.completedMonth, false);
  assert.equal(progress.payload.worldState.year, 1644);
  assert.equal(progress.payload.worldState.month, 1);
  assert.equal(progress.payload.worldState.tenDayPeriod, 3);
  assert.equal(progress.payload.worldState.turnCount, 5);
  assert.equal(progress.payload.worldState.activeExam.sceneTime.turnCount, 1);
  assert.equal(progress.payload.worldGeographyView.schemaVersion, 1);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.activeExam.sceneTime.phase, "outline");
  assert.equal(saved.tenDayPeriod, 3);
  assert.equal(saved.turnCount, 5);
});

test("exam submit preserves entry preparation in exam history", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ gold: 20 });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const question = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "child_exam"
  });
  assert.equal(question.response.status, 201);

  const submit = await postJson(`${server.baseUrl}/api/exam/submit`, {
    sessionId: worldState.sessionId,
    examId: question.payload.examId,
    essay: PASSING_ESSAY
  });

  assert.equal(submit.response.status, 200);
  assert.deepEqual(submit.payload.entryPreparation, question.payload.entryPreparation);
  assert.equal(submit.payload.examQuestion, question.payload.examQuestion);
  assert.equal(submit.payload.essay, PASSING_ESSAY.trim());
  assert.equal(submit.payload.sceneTime.phase, "submitted");
  assert.equal(submit.payload.examProcedureView.phase, "closed");
  assert.equal(submit.payload.examProcedureView.rollLifecycle.sealed, true);
  assert.equal(submit.payload.worldState.player.examHistory.at(-1).examProcedure.phase, "closed");
  assert.equal(submit.payload.worldGeographyView.schemaVersion, 1);
  assert.equal(JSON.stringify(submit.payload.worldGeographyView).includes("SEALED_ROUTE_NOTE"), false);
  assert.equal(submit.payload.examStartedAt.month, 1);
  assert.equal(submit.payload.examSubmittedAt.month, 1);
  assert.equal(submit.payload.worldState.activeExam, null);
  const historyEntry = submit.payload.worldState.player.examHistory.at(-1);
  assert.deepEqual(historyEntry.entryPreparation, question.payload.entryPreparation);
  assert.equal(historyEntry.entryPreparation.requiredGold, 2);
  assert.equal(historyEntry.sceneTime.phase, "submitted");
  assert.equal(historyEntry.examStartedAt.tenDayPeriod, 1);
  assert.equal(historyEntry.examSubmittedAt.tenDayPeriod, 1);
});

test("complete scholar to official path still works with entry preparation costs", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ gold: 100000 });
  worldState.year = 1644;
  worldState.month = 4;
  worldState.turnCount = 2;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  let latest = worldState;
  for (const level of ["child_exam", "provincial_exam", "metropolitan_exam", "palace_exam"]) {
    latest = await completeExam(server.baseUrl, worldState.sessionId, level);
  }

  assert.equal(latest.player.role, "official");
  assert.equal(latest.player.examRank, EXAMS.palace_exam.promotionRank);
  assert.equal(latest.player.examHistory.length, 4);
  assert.equal(latest.turnCount, 2);
  assert.equal(latest.year, 1644);
  assert.equal(latest.month, OPEN_MONTH_BY_LEVEL.palace_exam);
  assert.ok(latest.player.examHistory.every((entry) => entry.entryPreparation));
  assert.ok(latest.player.examHistory.every((entry) => entry.examProcedure?.rollLifecycle?.sealed));
  assert.ok(latest.player.examHistory.every((entry) => entry.sceneTime?.phase === "submitted"));
});
