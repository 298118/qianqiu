const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { getExam, getExamRequirements } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const aiPath = require.resolve("../src/ai");
const gameRoutePath = require.resolve("../src/routes/game");
const examRoutePath = require.resolve("../src/routes/exam");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
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

async function postTurnSse(baseUrl, sessionId, input = "读书") {
  const response = await fetch(`${baseUrl}/api/game/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify({ sessionId, input })
  });

  assert.equal(response.status, 200);
  return parseSse(await response.text());
}

function scoreDimension(score = 80, comment = "文气尚可。") {
  return { score, comment };
}

function gradePayload(overall = 80, overrides = {}) {
  return {
    score: {
      content_quality: scoreDimension(overall),
      argument_strength: scoreDimension(overall),
      literary_style: scoreDimension(overall),
      classical_format: scoreDimension(overall),
      historical_appropriateness: scoreDimension(overall),
      overall_score: overall,
      rank: overall >= 60 ? "取中" : "落第",
      detailed_feedback: "模型评语只作输入，服务器仍会复核。"
    },
    authenticity_check: {
      copy_detection: { is_copy: false, similar_passage: "" },
      anachronism_detection: { has_anachronism: false, details: [] },
      style_consistency: { consistent: true, note: "" },
      ghostwriting_probability: 0
    },
    virtual_candidates: [],
    ranking: [],
    ...overrides
  };
}

function createWritingExam(level = "child_exam") {
  const exam = getExam(level);
  return {
    examId: `${level}-red-team`,
    level: exam.level,
    examName: exam.name,
    examQuestion: "试论修身读书与县学教化之要。",
    questionType: exam.questionType,
    difficulty: exam.difficulty,
    requirements: getExamRequirements(exam),
    wordCount: exam.wordCount,
    passScore: exam.passScore,
    promotionRank: exam.promotionRank,
    status: "writing",
    reason: "red-team prepared exam"
  };
}

test("S44 ordinary turn drops mixed provider overreach while applying safe suggestions", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          year: 9999,
          month: 12,
          tenDayPeriod: 3,
          turnCount: 99,
          activeExam: { level: "palace_exam", status: "writing" },
          examCalendar: { rivals: [{ id: "provider-rival" }] },
          appointmentTrack: { records: [{ id: "provider-appointment", serverDecision: { officeTitle: "内阁大学士" } }] },
          activeNpcRequest: { id: "provider-request", hiddenIntent: "provider-hidden-overreach" },
          longTermEvents: { queue: [{ id: "provider-event", hiddenNotes: ["provider-hidden-overreach"] }] },
          officialCareer: {
            careerHistory: [{ type: "promotion", label: "provider-forged-career" }],
            assignments: [{ id: "provider-assignment", title: "伪差遣", hiddenNotes: ["provider-hidden-overreach"] }]
          },
          officialPostings: {
            postings: [{ id: "provider-forged-posting", officeId: "ministry_revenue_principal", hiddenNotes: ["provider-hidden-overreach"] }]
          },
          roleWorldCoupling: { recentImpacts: [{ kind: "provider-forged-impact" }] },
          worldGeography: {
            countries: [{ id: "provider-forged-country", name: "伪地理", hiddenNotes: ["provider-hidden-overreach"] }]
          },
          worldEntities: {
            entities: [{ id: "provider-forged-entity", name: "伪实体", hiddenNotes: ["provider-hidden-overreach"] }]
          },
          worldPeople: {
            npcs: [{ id: "provider-forged-npc", name: "伪人物", hiddenNotes: ["provider-hidden-overreach"] }]
          },
          worldThreads: {
            threads: [{ id: "WT-provider-forged", title: "伪议题", hiddenNotes: ["provider-hidden-overreach"] }]
          },
          characters: [{ id: "C666", name: "暗线贵人", role: "provider patron" }],
          eventHistory: ["provider replacement"],
          publicOrder: 66,
          factions: {
            eunuchs: 77,
            providerFaction: 99
          },
          player: {
            academia: 30,
            role: "emperor",
            examRank: "进士",
            officeTitle: "Grand Secretary",
            position: "內閣大學士",
            examHistory: [{ level: "palace_exam" }]
          }
        },
        attributeChanges: [],
        relationshipChanges: [
          {
            targetType: "character",
            targetId: "C01",
            relationshipDelta: 99,
            resentmentDelta: -99,
            reason: "Visible suggestion should be clamped."
          },
          {
            targetType: "character",
            targetId: "C99",
            relationshipDelta: 12,
            resentmentDelta: -10,
            reason: "Hidden suggestion must be ignored."
          }
        ],
        events: ["provider safe event"],
        examTrigger: {
          shouldStart: true,
          level: "provincial_exam",
          reason: "provider tried to skip the ladder"
        }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事",
    examRank: null
  });
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.characters.push({
    id: "C99",
    name: "密札中人",
    role: "隐藏线人",
    loyalty: 50,
    ambition: 50,
    skill: 50,
    alive: true
  });
  worldState.relationshipLedger.characters.C99 = {
    id: "C99",
    name: "密札中人",
    role: "隐藏线人",
    stance: "sealed",
    relationship: 0,
    resentment: 0,
    networkSource: "sealed",
    recentIntent: "initial-hidden-note",
    visible: false,
    lastUpdatedTurn: 0
  };
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "静候公文"
  });
  const serializedState = JSON.stringify(payload.worldState);
  const serializedViews = JSON.stringify({
    relationshipView: payload.relationshipView,
    activeNpcRequestView: payload.activeNpcRequestView,
    officialCareerView: payload.officialCareerView,
    officialPostingsView: payload.officialPostingsView,
    worldGeographyView: payload.worldGeographyView,
    worldEntityView: payload.worldEntityView,
    worldPeopleView: payload.worldPeopleView,
    worldThreadView: payload.worldThreadView
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.worldState.year, 1644);
  assert.equal(payload.worldState.month, 1);
  assert.equal(payload.worldState.tenDayPeriod, 2);
  assert.equal(payload.worldState.activeExam, null);
  assert.equal(payload.examTrigger.shouldStart, false);
  assert.match(payload.examTrigger.reason, /不必再循科举旧路|当前应参加童试/);
  assert.equal(payload.worldState.player.role, "official");
  assert.equal(payload.worldState.player.officeTitle, "户部主事");
  assert.equal(payload.worldState.player.position, "户部主事");
  assert.equal(payload.worldState.player.examRank, null);
  assert.equal(payload.worldState.player.academia, 30);
  assert.equal(payload.worldState.factions.providerFaction, undefined);
  assert.equal(payload.worldState.characters.some((character) => character.id === "C666"), false);
  assert.equal(payload.worldState.eventHistory.includes("provider replacement"), false);
  assert.ok(payload.worldState.eventHistory.includes("provider safe event"));
  assert.equal(serializedState.includes("provider-forged"), false);
  assert.equal(serializedState.includes("provider-appointment"), false);
  assert.equal(serializedState.includes("provider-request"), false);
  assert.equal(serializedState.includes("provider-forged-country"), false);
  assert.equal(serializedState.includes("provider-forged-entity"), false);
  assert.equal(serializedState.includes("provider-forged-npc"), false);
  assert.equal(serializedState.includes("provider-forged-posting"), false);
  assert.equal(serializedState.includes("WT-provider-forged"), false);
  assert.equal(serializedState.includes("provider-hidden-overreach"), false);
  assert.equal(serializedViews.includes("provider-hidden-overreach"), false);
  assert.equal(serializedViews.includes("initial-hidden-note"), false);
  assert.ok(payload.relationshipChanges.some((change) =>
    change.targetId === "C01" &&
    change.relationship.delta === 12 &&
    change.resentment.after === 0
  ));
  assert.equal(payload.relationshipChanges.some((change) => change.targetId === "C99"), false);
});

test("S44 exam submit ignores provider-owned candidates and applies local severe cheating", async (t) => {
  const provider = {
    async gradeExamEssay(worldState, exam, essay, authenticityCheck) {
      assert.equal(authenticityCheck.copy_detection.is_copy, true);
      return gradePayload(100, {
        authenticity_check: {
          copy_detection: { is_copy: false, similar_passage: "" },
          anachronism_detection: { has_anachronism: false, details: [] },
          style_consistency: { consistent: true, note: "" },
          ghostwriting_probability: 0
        },
        examiner_reviews: [{
          actor: "chief_examiner",
          recommendation: "直取案首",
          suggestedScoreDelta: 2,
          comment: "模型考官试图用好评抵消重犯。"
        }],
        virtual_candidates: [{ id: "provider-crowned", name: "模型钦点", score: 100 }],
        ranking: [{ id: "provider-crowned", name: "模型钦点", place: 1 }]
      });
    }
  };
  const server = createTestServerWithProvider(provider, { mountGame: false, mountExam: true });
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.activeExam = createWritingExam("child_exam");
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const copiedEssay = "学而时习之不亦说乎学而时习之不亦说乎";
  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/submit`, {
    sessionId: worldState.sessionId,
    examId: worldState.activeExam.examId,
    essay: copiedEssay
  });
  const serializedResult = JSON.stringify({
    virtualCandidates: payload.virtualCandidates,
    ranking: payload.ranking,
    history: payload.worldState.player.examHistory
  });

  assert.equal(response.status, 200);
  assert.equal(payload.authenticityCheck.copy_detection.is_copy, true);
  assert.equal(payload.score.overall_score, 0);
  assert.equal(payload.examinerPanelView.roomReviews.some((review) => review.source === "provider_proposal" && review.accepted), false);
  assert.match(payload.examinerPanelView.serverDecision, /canonical 榜单/);
  assert.equal(payload.promotionResult.passed, false);
  assert.equal(payload.promotionResult.severeCheat, true);
  assert.equal(payload.worldState.player.examRank, null);
  assert.equal(payload.worldState.activeExam, null);
  assert.equal(serializedResult.includes("provider-crowned"), false);
});

test("S44 exam submit ignores provider false-positive cheating echoes", async (t) => {
  const provider = {
    async gradeExamEssay() {
      return gradePayload(82, {
        examiner_reviews: [{
          actor: "room_officer",
          label: "SEALED_INTERNAL_REVIEW",
          recommendation: "可取",
          suggestedScoreDelta: 2,
          comment: "hiddenIntent OPENAI_API_KEY sk-examiner-secret raw provider proposal E:\\secret\\review.txt",
          concern: "sealed_mapping"
        }],
        authenticity_check: {
          copy_detection: { is_copy: true, similar_passage: "provider-only accusation" },
          anachronism_detection: { has_anachronism: true, details: ["provider-only"] },
          style_consistency: { consistent: false, note: "provider-only" },
          ghostwriting_probability: 0.95
        }
      });
    }
  };
  const server = createTestServerWithProvider(provider, { mountGame: false, mountExam: true });
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.activeExam = createWritingExam("child_exam");
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const cleanEssay = Array.from({ length: 8 }, () =>
    "县治之要在养民力，读书之功在明义理，士子答策当言仓储、教化与听讼。"
  ).join("");
  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/submit`, {
    sessionId: worldState.sessionId,
    examId: worldState.activeExam.examId,
    essay: cleanEssay
  });

  assert.equal(response.status, 200);
  assert.equal(payload.authenticityCheck.copy_detection.is_copy, false);
  assert.equal(payload.authenticityCheck.anachronism_detection.has_anachronism, false);
  assert.equal(payload.authenticityCheck.ghostwriting_probability, 0);
  assert.equal(payload.score.overall_score, 79);
  assert.equal(payload.examinerPanelView.roomReviews.some((review) => review.source === "provider_proposal" && review.accepted === false), true);
  assert.equal(payload.examProcedureView.examinerPanelView.serverDecision, payload.examinerPanelView.serverDecision);
  assert.doesNotMatch(JSON.stringify({
    examinerPanelView: payload.examinerPanelView,
    examProcedureView: payload.examProcedureView,
    history: payload.worldState.player.examHistory
  }), /SEALED_INTERNAL_REVIEW|hiddenIntent|OPENAI_API_KEY|sk-examiner-secret|raw provider|E:\\secret|sealed_mapping/);
  assert.equal(payload.promotionResult.passed, true);
  assert.equal(payload.worldState.player.examRank, "秀才");
});

test("S44 streaming failure after hidden narrative does not persist provider state", async (t) => {
  const hiddenToken = "SEALED_STREAM_TOKEN";
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-proj-stream-secret-123456";
  t.after(() => {
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  });
  const provider = {
    supportsStreaming: true,
    async streamTurn(worldState, input, handlers) {
      handlers.onTextDelta(`{"narrative":"${hiddenToken}","statePatch":{"player":{"academia":99}}`);
      throw new Error("stream failed with sk-proj-stream-secret-123456 and sk-proj-");
    },
    async runTurn() {
      throw new Error("fallback should not run after visible stream failure");
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Streamer", role: "scholar" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const events = await postTurnSse(server.baseUrl, worldState.sessionId);
  const streamedText = events
    .filter((event) => event.event === "narrative_chunk")
    .map((event) => event.data.text)
    .join("");
  const saved = await readSession(worldState.sessionId);
  const errorEvent = events.find((event) => event.event === "error");

  assert.equal(streamedText, hiddenToken);
  assert.ok(errorEvent);
  assert.equal(errorEvent.data.error.includes("sk-proj-stream-secret-123456"), false);
  assert.equal(errorEvent.data.error.includes("sk-proj-"), false);
  assert.equal(events.find((event) => event.event === "final_state"), undefined);
  assert.equal(saved.turnCount, 0);
  assert.equal(saved.player.academia, 10);
  assert.equal(JSON.stringify(saved).includes(hiddenToken), false);
});
