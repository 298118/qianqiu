const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { getExam, getExamRequirements } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");
const { attachExamSceneTime } = require("../src/game/examSceneTime");
const {
  listAiProposals,
  listAuditEvents,
  readSession,
  writeSession
} = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");
const aiPath = require.resolve("../src/ai");
const gameRoutePath = require.resolve("../src/routes/game");
const examRoutePath = require.resolve("../src/routes/exam");

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

function createTestServerWithProvider(provider, options = {}) {
  const { mountGame = true, mountExam = false } = options;
  const originalAiModule = require.cache[aiPath];
  const originalGameRouteModule = require.cache[gameRoutePath];
  const originalExamRouteModule = require.cache[examRoutePath];

  delete require.cache[gameRoutePath];
  delete require.cache[examRoutePath];
  require.cache[aiPath] = {
    id: aiPath,
    filename: aiPath,
    loaded: true,
    exports: {
      getProvider: () => provider
    }
  };

  const app = express();
  app.use(express.json());
  if (mountGame) app.use("/api/game", require("../src/routes/game"));
  if (mountExam) app.use("/api/exam", require("../src/routes/exam"));

  const testServer = createFetchSafeServer(app);

  async function close() {
    await testServer.close();
    delete require.cache[gameRoutePath];
    delete require.cache[examRoutePath];
    if (originalGameRouteModule) require.cache[gameRoutePath] = originalGameRouteModule;
    if (originalExamRouteModule) require.cache[examRoutePath] = originalExamRouteModule;
    if (originalAiModule) require.cache[aiPath] = originalAiModule;
    else delete require.cache[aiPath];
  }

  return {
    baseUrl: testServer.baseUrl,
    close
  };
}

function scoreDimension(score = 82, comment = "文理尚通。") {
  return { score, comment };
}

function gradePayload(overall = 82, overrides = {}) {
  return {
    score: {
      content_quality: scoreDimension(overall),
      argument_strength: scoreDimension(overall),
      literary_style: scoreDimension(overall),
      classical_format: scoreDimension(overall),
      historical_appropriateness: scoreDimension(overall),
      overall_score: overall,
      rank: overall >= 60 ? "取中" : "落第",
      detailed_feedback: "模型评语仅作评分建议，榜单与晋级仍由服务器裁决。"
    },
    authenticityObservation: "未见明显异常。",
    ...overrides
  };
}

function createWritingExam(worldState, level = "child_exam") {
  const exam = getExam(level);
  const activeExam = {
    examId: `${level}-audit-route`,
    level: exam.level,
    examName: exam.name,
    examQuestion: "试论读书明理与县学风教之关系。",
    questionType: exam.questionType,
    difficulty: exam.difficulty,
    requirements: getExamRequirements(exam),
    wordCount: exam.wordCount,
    passScore: exam.passScore,
    promotionRank: exam.promotionRank,
    readiness: { label: "测试可交卷" },
    status: "writing",
    generatedAt: new Date().toISOString()
  };
  attachExamSceneTime(activeExam, worldState, "drafting");
  return activeExam;
}

async function postJson(url, body, headers = { "Content-Type": "application/json" }) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

function parseSse(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");

      return {
        event: eventLine ? eventLine.slice(6).trim() : "message",
        data: data ? JSON.parse(data) : null
      };
    });
}

test("S49.4 turn audit records provider overreach without applying server-owned state", async (t) => {
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-proj-route-audit-secret-123456";
  t.after(() => {
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  });
  const provider = {
    name: "red-team-provider",
    async runTurn() {
      return {
        narrative: "公开叙事只写玩家可见内容。",
        statePatch: {
          player: {
            academia: 17,
            examRank: "进士",
            officeTitle: "大学士",
            hiddenToken: "SEALED_PLAYER_ROUTE_TOKEN"
          },
          turnCount: 999,
          year: 2000,
          activeExam: { level: "palace_exam" },
          worldState: {
            hiddenToken: "SEALED_ROUTE_AUDIT_TOKEN",
            localPath: `E:\\LSMNQ\\data\\sessions\\x.json`,
            apiKey: "sk-proj-route-audit-secret-123456"
          }
        },
        attributeChanges: [],
        relationshipChanges: [],
        events: ["塾师见其勤读，许借经义旧注。"],
        examTrigger: {
          shouldStart: true,
          level: "palace_exam",
          reason: "模型试图越级开殿试。"
        }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "审计书生", role: "scholar" });
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "读书求进"
  });
  const saved = await readSession(worldState.sessionId);
  const proposals = await listAiProposals(worldState.sessionId);
  const auditEvents = await listAuditEvents(worldState.sessionId);
  const serializedAudit = JSON.stringify({ proposals, auditEvents });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.academia, 17);
  assert.equal(saved.player.academia, 17);
  assert.equal(saved.player.examRank, null);
  assert.equal(saved.player.officeTitle, null);
  assert.equal(saved.year, 1644);
  assert.equal(saved.activeExam, null);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].provider, "red-team-provider");
  assert.equal(proposals[0].proposalKind, "turn");
  assert.equal(proposals[0].status, "partially_accepted");
  assert.equal(proposals[0].proposal.statePatch.player.examRank, "进士");
  assert.ok(proposals[0].rejectedReasons.some((reason) => reason.includes("player.examRank")));
  assert.ok(proposals[0].rejectedReasons.some((reason) => reason.includes("statePatch.turnCount")));
  assert.ok(proposals[0].rejectedReasons.some((reason) => reason.includes("考试触发请求被拒绝")));
  assert.equal(proposals[0].accepted.stateDelta.turnCount, undefined);
  assert.ok(auditEvents.some((event) => event.eventType === "provider_turn_applied"));
  assert.ok(auditEvents.some((event) => event.eventType === "turn_completed" && event.visibility === "public"));
  assert.equal(serializedAudit.includes("SEALED_ROUTE_AUDIT_TOKEN"), false);
  assert.equal(serializedAudit.includes("SEALED_PLAYER_ROUTE_TOKEN"), false);
  assert.equal(serializedAudit.includes("sk-proj-route-audit-secret-123456"), false);
  assert.equal(serializedAudit.includes("route-audit-secret"), false);
  assert.equal(serializedAudit.includes("E:\\LSMNQ"), false);
});

test("S49.4 streaming failure after visible text does not write audit records", async (t) => {
  const provider = {
    supportsStreaming: true,
    async streamTurn(worldState, input, handlers) {
      handlers.onTextDelta('{"narrative":"半句已出","statePatch":{"player":{"academia":99}}');
      throw new Error("stream interrupted");
    },
    async runTurn() {
      throw new Error("fallback should not run after visible streaming failure");
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "流式审计", role: "scholar" });
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify({ sessionId: worldState.sessionId, input: "读书" })
  });
  const events = parseSse(await response.text());
  const saved = await readSession(worldState.sessionId);

  assert.equal(response.status, 200);
  assert.ok(events.find((event) => event.event === "error"));
  assert.equal(events.find((event) => event.event === "final_state"), undefined);
  assert.equal(saved.turnCount, 0);
  assert.equal(saved.player.academia, 10);
  assert.deepEqual(await listAiProposals(worldState.sessionId), []);
  assert.deepEqual(await listAuditEvents(worldState.sessionId), []);
});

test("S49.4 exam submit audit records model grade and server final ruling", async (t) => {
  const provider = {
    name: "exam-audit-provider",
    async gradeExamEssay() {
      return gradePayload(94, {
        promotionResult: { passed: false, rank: "模型自判" },
        ranking: [{ name: "模型榜首" }],
        virtualCandidates: [{ name: "模型考生" }]
      });
    }
  };
  const server = createTestServerWithProvider(provider, { mountGame: false, mountExam: true });
  t.after(server.close);

  const worldState = createInitialState({ playerName: "审计考生", role: "scholar" });
  worldState.activeExam = createWritingExam(worldState, "child_exam");
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const essay = Array.from({ length: 8 }, () =>
    "县学之兴在敦本务实，士子读书当明礼义，亦当知仓储、水利、听讼与养民之要。"
  ).join("");
  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/submit`, {
    sessionId: worldState.sessionId,
    examId: worldState.activeExam.examId,
    essay
  });
  const proposals = await listAiProposals(worldState.sessionId);
  const auditEvents = await listAuditEvents(worldState.sessionId);
  const gradeProposal = proposals.find((proposal) => proposal.proposalKind === "exam_grade");

  assert.equal(response.status, 200);
  assert.equal(payload.promotionResult.passed, true);
  assert.ok(gradeProposal);
  assert.equal(gradeProposal.provider, "exam-audit-provider");
  assert.equal(gradeProposal.status, "partially_accepted");
  assert.equal(gradeProposal.proposal.modelOverallScore, 94);
  assert.equal(gradeProposal.accepted.passed, true);
  assert.ok(gradeProposal.rejectedReasons.some((reason) => reason.includes("模型不得决定榜单")));
  assert.ok(auditEvents.some((event) => event.eventType === "exam_submitted"));
});
