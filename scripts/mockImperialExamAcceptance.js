#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const sessionsDir = path.join(rootDir, "data", "sessions");
const EXAM_LEVELS = Object.freeze(["child_exam", "provincial_exam", "metropolitan_exam", "palace_exam"]);
const OPEN_MONTH_BY_LEVEL = Object.freeze({
  child_exam: 1,
  provincial_exam: 8,
  metropolitan_exam: 2,
  palace_exam: 4
});
const FETCH_BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53,
  69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117,
  119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514,
  515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989,
  990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 5060, 5061, 6000,
  6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080
]);
const UNSAFE_VISIBLE_TEXT_PATTERN =
  /(hiddenNotes|hidden_notes|hiddenIntent|hidden_intent|sealedMapping|sealed_mapping|SEALED_|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|api[_ -]?key|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|sk-[A-Za-z0-9_-]{4,}|tp-[A-Za-z0-9_-]{4,}|data[\\/](?:sessions|audit)|raw[_ -]?(?:provider|proposal|audit|table|ledger)|provider proposal|prompt_retrieval_index|event_archive_index|world_sessions|appointmentTrack|retrievalContext|worldState|statePatch|event_log|ai_change_proposals|[A-Za-z]:\\[^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function buildPassingEssay(level = "child_exam") {
  const repeatCount = {
    child_exam: 5,
    provincial_exam: 10,
    metropolitan_exam: 14,
    palace_exam: 13
  }[level] || 8;
  const paragraph = "臣闻治道之要，在修身以立本，明经以正俗，清吏以宽民力。若县学士子知礼义而能察钱粮、狱讼、水旱，则文章不为空言，官箴亦有根柢。";
  return Array.from({ length: repeatCount }, () => paragraph).join("");
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", require("../src/routes/game"));
  app.use("/api/exam", require("../src/routes/exam"));
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  return app;
}

async function startServer() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const server = await new Promise((resolve, reject) => {
      const candidate = createApp().listen(0, "127.0.0.1", () => resolve(candidate));
      candidate.once("error", reject);
    });
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : null;
    if (port && !FETCH_BLOCKED_PORTS.has(port)) {
      return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => closeServer(server)
      };
    }
    await closeServer(server);
  }
  throw new Error("Could not allocate a fetch-safe S69.5 mock acceptance port.");
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

function assertOk(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}.`);
  }
}

function assertNoUnsafeVisibleText(label, value) {
  const stringValues = [];
  const collect = (item) => {
    if (typeof item === "string") {
      stringValues.push(item);
      return;
    }
    if (Array.isArray(item)) {
      for (const child of item) collect(child);
      return;
    }
    if (item && typeof item === "object") {
      for (const child of Object.values(item)) collect(child);
    }
  };

  collect(value);
  if (stringValues.some((text) => UNSAFE_VISIBLE_TEXT_PATTERN.test(text))) {
    throw new Error(`${label} leaked hidden/raw/provider/token text.`);
  }
}

async function readSession(sessionId) {
  const { readSession } = require("../src/storage/sessionStore");
  return readSession(sessionId);
}

async function writeSession(worldState) {
  const { writeSession } = require("../src/storage/sessionStore");
  return writeSession(worldState);
}

async function cleanupSession(sessionId) {
  if (!sessionId) return;
  const { deleteSession } = require("../src/storage/sessionStore");
  await deleteSession(sessionId).catch(() => {});
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true }).catch(() => {});
}

async function prepareSessionForExam(sessionId, level) {
  const worldState = await readSession(sessionId);
  worldState.month = OPEN_MONTH_BY_LEVEL[level] || 1;
  worldState.tenDayPeriod = 3;
  Object.assign(worldState.player, {
    gold: Math.max(worldState.player.gold || 0, 1000),
    health: 100,
    academia: 100,
    literaryTalent: 100,
    adaptability: 100,
    mentality: 100,
    reputation: 100
  });
  await writeSession(worldState);
  return worldState;
}

function assertS69Views(payload, level) {
  if (!payload.studyProfileView?.schemaVersion) {
    throw new Error(`${level} missing studyProfileView.`);
  }
  if (!payload.examProcedureView?.schemaVersion) {
    throw new Error(`${level} missing examProcedureView.`);
  }
  if (!payload.entryPreparation?.preparationPressure?.score && payload.entryPreparation?.preparationPressure?.score !== 0) {
    throw new Error(`${level} missing entry preparation pressure.`);
  }
  if (!payload.examProcedureView?.preparationPressure?.label) {
    throw new Error(`${level} missing examProcedureView preparation pressure.`);
  }
  if (!payload.examinerPanelView?.schemaVersion) {
    throw new Error(`${level} missing examinerPanelView.`);
  }
  if (!payload.examHonorView?.schemaVersion) {
    throw new Error(`${level} missing examHonorView.`);
  }
  if (!payload.examAftermathView?.schemaVersion) {
    throw new Error(`${level} missing examAftermathView.`);
  }
  if (payload.promotionResult?.passed && !payload.examAftermathView?.nextActions?.length) {
    throw new Error(`${level} missing examAftermathView next actions.`);
  }
  if (!payload.relationshipView?.contacts || !payload.worldPeopleView?.npcs) {
    throw new Error(`${level} missing relationship/worldPeople S69 network views.`);
  }
  if (level === "palace_exam" && !payload.appointmentTrackView?.latestDecision?.officeTitle) {
    throw new Error("palace_exam missing appointmentTrackView latest decision.");
  }
  if (level === "palace_exam" && !payload.officialCareerView?.assignmentSummary?.activeCount) {
    throw new Error("palace_exam missing first-month official assignment.");
  }
}

function summarizeExamResult(payload, level) {
  const latestHistory = payload.worldState.player.examHistory.at(-1);
  return {
    level,
    rank: payload.promotionResult.rank,
    score: payload.score.overall_score,
    honorTitle: payload.examHonorView.latestHonor?.title || null,
    aftermathAction: payload.examAftermathView?.nextActions?.[0] || null,
    networkContacts: (latestHistory.examNetwork?.sameYearContacts || []).length +
      (latestHistory.examNetwork?.examinerContacts || []).length,
    appointment: payload.appointmentTrackView?.latestDecision?.officeTitle || null,
    firstAssignment: payload.officialCareerView?.assignments?.[0]?.title || null
  };
}

async function runExamLevel(baseUrl, sessionId, level) {
  await prepareSessionForExam(sessionId, level);
  const question = await postJson(`${baseUrl}/api/exam/question`, { sessionId, level });
  assertOk(question.response, `${level} question`);
  assertNoUnsafeVisibleText(`${level} question`, {
    examQuestion: question.payload.examQuestion,
    examProcedureView: question.payload.examProcedureView,
    studyProfileView: question.payload.studyProfileView,
    entryPreparation: question.payload.entryPreparation
  });
  if (!question.payload.entryPreparation?.preparationPressure?.label) {
    throw new Error(`${level} question missing preparation pressure.`);
  }
  if (!question.payload.studyProfileView?.examPreparation?.label) {
    throw new Error(`${level} question missing study profile exam preparation.`);
  }
  if (!question.payload.examProcedureView?.phaseFeedback?.publicSummary) {
    throw new Error(`${level} question missing exam phase feedback.`);
  }

  const progress = await postJson(`${baseUrl}/api/exam/progress`, {
    sessionId,
    examId: question.payload.examId,
    action: "审题拟纲，先稳题眼。"
  });
  assertOk(progress.response, `${level} progress`);
  if (!progress.payload.examProcedureView?.phaseFeedback?.publicSummary) {
    throw new Error(`${level} progress missing exam phase feedback.`);
  }
  if (!progress.payload.examProcedureView?.phaseFeedback?.visibleNextActions?.length) {
    throw new Error(`${level} progress missing phase feedback actions.`);
  }
  assertNoUnsafeVisibleText(`${level} progress S88.3 phase feedback`, {
    examProcedureView: progress.payload.examProcedureView,
    worldTick: progress.payload.worldTick
  });

  const submit = await postJson(`${baseUrl}/api/exam/submit`, {
    sessionId,
    examId: question.payload.examId,
    essay: buildPassingEssay(level)
  });
  assertOk(submit.response, `${level} submit`);

  if (!submit.payload.promotionResult?.passed) {
    throw new Error(`${level} did not pass in Mock S69.5 acceptance.`);
  }
  assertS69Views(submit.payload, level);
  assertNoUnsafeVisibleText(`${level} submit S69 views`, {
    score: submit.payload.score,
    examProcedureView: submit.payload.examProcedureView,
    examinerPanelView: submit.payload.examinerPanelView,
    examHonorView: submit.payload.examHonorView,
    examAftermathView: submit.payload.examAftermathView,
    appointmentTrackView: submit.payload.appointmentTrackView,
    officialCareerView: submit.payload.officialCareerView,
    relationshipView: submit.payload.relationshipView,
    worldPeopleView: submit.payload.worldPeopleView,
    eventArchiveView: submit.payload.eventArchiveView,
    latestHistory: submit.payload.worldState.player.examHistory.at(-1)
  });

  return summarizeExamResult(submit.payload, level);
}

async function runMockImperialExamAcceptance() {
  const previousAiProvider = process.env.AI_PROVIDER;
  const previousStorageAdapter = process.env.STORAGE_ADAPTER;
  process.env.AI_PROVIDER = "mock";
  process.env.STORAGE_ADAPTER = "json";

  let server = null;
  let sessionId = null;
  try {
    server = await startServer();
    const started = await postJson(`${server.baseUrl}/api/game/start`, {
      dynasty: "明",
      year: 1644,
      role: "scholar",
      playerName: "S69.5 Mock",
      background: "县学寒士，专供 S69.5 验收。",
      customSetting: "Mock 科举深化验收，不使用真实 provider key。"
    });
    assertOk(started.response, "game start");
    sessionId = started.payload.sessionId;

    const results = [];
    for (const level of EXAM_LEVELS) {
      results.push(await runExamLevel(server.baseUrl, sessionId, level));
    }

    const finalState = await readSession(sessionId);
    if (finalState.player.role !== "official") {
      throw new Error(`final player role should be official, got ${finalState.player.role}.`);
    }
    if (!finalState.player.officeTitle) {
      throw new Error("final official path did not write officeTitle.");
    }
    if ((finalState.player.examHistory || []).length < EXAM_LEVELS.length) {
      throw new Error("final exam history is missing completed levels.");
    }
    if (!finalState.player.examHistory.every((entry) =>
      entry.examProcedure && entry.examinerPanel && entry.examHonor && entry.examNetwork && entry.examAftermath
    )) {
      throw new Error("one or more exam history entries are missing S69 snapshots.");
    }
    if (!finalState.player.examHistory.at(-1).appointmentTrack) {
      throw new Error("palace exam history is missing appointmentTrack snapshot.");
    }
    if (!finalState.officialCareer?.assignments?.length) {
      throw new Error("final official career is missing first-month assignment.");
    }
    if (!/首月|初稿|馆课|清册|民情|观政/.test(finalState.officialCareer.assignments[0].title)) {
      throw new Error("final first-month assignment title is not a scholar-to-official onboarding task.");
    }

    return {
      skipped: false,
      baseUrl: server.baseUrl,
      sessionId,
      finalRole: finalState.player.role,
      finalOfficeTitle: finalState.player.officeTitle,
      completedLevels: finalState.player.examHistory.map((entry) => entry.level),
      results
    };
  } finally {
    await cleanupSession(sessionId);
    if (server) await server.close();
    if (previousAiProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousAiProvider;
    if (previousStorageAdapter === undefined) delete process.env.STORAGE_ADAPTER;
    else process.env.STORAGE_ADAPTER = previousStorageAdapter;
  }
}

if (require.main === module) {
  runMockImperialExamAcceptance()
    .then((result) => {
      console.log(`S69.5 Mock imperial exam acceptance passed: ${result.completedLevels.join(" -> ")}`);
      console.log(`Final role: ${result.finalRole}; office: ${result.finalOfficeTitle}`);
      for (const item of result.results) {
        console.log(
          `[${item.level}] score=${item.score}, rank=${item.rank}, honor=${item.honorTitle || "none"}, networkContacts=${item.networkContacts}, aftermath="${item.aftermathAction || "none"}", appointment=${item.appointment || "none"}, firstAssignment=${item.firstAssignment || "none"}`
        );
      }
    })
    .catch((error) => {
      console.error(`S69.5 Mock imperial exam acceptance failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  buildPassingEssay,
  runMockImperialExamAcceptance,
  assertNoUnsafeVisibleText
};
