const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const { createInitialState } = require("../src/game/initialState");
const {
  createNpcActiveRequest,
  resolveNpcActiveRequest
} = require("../src/game/npcActiveRequests");
const { createLandSurveyDelegatedTask } = require("../src/game/delegatedTasks");
const { resolveTradeRequest } = require("../src/game/tradeLedger");
const {
  buildTopicSurfaceView,
  buildTopicSurfaceViewIndex
} = require("../src/game/topicSurfaceView");
const { buildOfficialCareerView } = require("../src/game/officialCareer");
const { ensureWorldThreadState } = require("../src/game/worldThreads");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");
const topicSurfaceIds = [
  "memorial-review",
  "edict-draft",
  "court-debate",
  "trial",
  "war-council",
  "npc-profile"
];

function sessionPath(sessionId) {
  return path.join(sessionsDir, `${sessionId}.json`);
}

async function removeSessionArtifacts(sessionId) {
  if (!sessionId) return;
  await Promise.all([
    fs.rm(sessionPath(sessionId), { force: true }),
    fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true }),
    fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true }),
    fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true })
  ]);
}

function assertNoSensitiveText(payload) {
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(
    serialized,
    /SEALED_|hidden[ _-]?(?:notes?|intent)?|raw[ _-]?(?:provider|payload|prompt|audit|table|ledger|state|row)|provider\s+payload|prompt|完整提示词|localPath|file:\/\/|data[\\/](?:sessions|audit)|[A-Za-z]:[\\/]|\/(?:mnt|home|Users|tmp|var|opt|workspace)\/|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}/i
  );
}

function createGameServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", require("../src/routes/game"));
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  return createFetchSafeServer(app);
}

test("S78 topicSurfaceView covers six safe office topic surfaces", () => {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "专题测试"
  });
  const views = buildTopicSurfaceViewIndex(worldState);

  assert.deepEqual(views.map((view) => view.surfaceId).sort(), topicSurfaceIds.slice().sort());
  for (const view of views) {
    assert.equal(view.schemaVersion, "s78.topicSurfaceView.v1");
    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.draftOnly, true);
    assert.equal(view.safety.noResolverExecution, true);
    assert.equal(view.safety.noStateWrites, true);
    assert.ok(Array.isArray(view.items));
    assert.ok(Array.isArray(view.evidenceRefs));
    assert.ok(Array.isArray(view.draftSlots));
    assert.ok(view.draftSlots.length >= 1, view.surfaceId);
    assertNoSensitiveText(view);
  }
});

test("S78 topicSurfaceView rejects unknown surface ids", () => {
  const worldState = createInitialState({ role: "official" });
  assert.throws(() => buildTopicSurfaceView(worldState, { surfaceId: "raw-state" }), /未知专题/);
});

test("S78 war council surface includes safe map context evidence", () => {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "general",
    playerName: "军议舆图"
  });
  const view = buildTopicSurfaceView(worldState, { surfaceId: "war-council" });

  assert.ok(view.sourceViews.some((source) => source.sourceView === "mapContextView"));
  assert.ok(view.evidenceRefs.some((ref) => ref.sourceView === "mapContextView"));
  assertNoSensitiveText(view);
});

test("S88.4 memorial and court surfaces include official first-month court entry evidence", () => {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "首月奏议"
  });
  Object.assign(worldState.player, {
    officeTitle: "翰林院编修",
    position: "翰林院编修",
    performanceMerit: 52,
    impeachmentRisk: 18
  });
  worldState.officialCareer.currentPosting = "翰林院编修";
  worldState.officialCareer.assignments = [{
    id: "ASG-0000-first-month-top_hanlin_editor",
    title: "馆阁讲章校订",
    kind: "memorial_drafting",
    bureauId: "hanlin_academy",
    dueTurn: 3,
    deadlineUnit: "ten_day",
    progress: 48,
    risk: 18,
    visibleSummary: "首月须校订馆阁讲章并试拟制诰。",
    hiddenNotes: ["堂官私下试探"]
  }];
  worldState.officialCareer.assessmentDossier.notes = [
    "讲章回署可入考成。",
    "provider payload prompt raw_table"
  ];
  const entryId = buildOfficialCareerView(worldState).courtEntry.id;
  worldState.officialCareer.courtEntryResolutions = [{
    id: "OCER-topic-court-entry",
    entryId,
    assignmentId: "ASG-0000-first-month-top_hanlin_editor",
    surfaceId: "memorial-review",
    submissionKind: "official_first_month_memorial",
    status: "accepted_for_review",
    statusLabel: "准入复核",
    title: "准入复核：馆阁讲章校订",
    publicSummary: "准入复核：馆阁讲章校订已入奏折队列服务器裁决，不直接任免、奖惩、处分或成弹劾。",
    generatedAtTurn: 2,
    sourceRefs: [`officialCareer.courtEntry:${entryId}`],
    nextStep: "由部院复核公开凭据后再入长期考成。"
  }];
  worldState.officialCareer.courtEntryFollowUps = [{
    id: "OCEF-topic-follow-up",
    entryId,
    resolutionId: "OCER-topic-court-entry",
    assignmentId: "ASG-0000-first-month-top_hanlin_editor",
    stage: "bureau_review",
    stageLabel: "部院覆奏",
    status: "referred_to_bureau",
    statusLabel: "部院待覆",
    title: "部院覆奏：馆阁讲章校订",
    publicSummary: "部院待覆：馆阁讲章校订承接近次准入复核进入部院覆奏，皇帝、部院、台谏只形成公开中间意见，不直接任免、奖惩、处分或成弹劾。",
    generatedAtTurn: 3,
    sourceRefs: [`officialCareer.courtEntry:${entryId}`],
    nextStep: "相关部院待覆，下一步补齐公开凭据、限期和经手人。"
  }];

  const memorial = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  const debate = buildTopicSurfaceView(worldState, { surfaceId: "court-debate" });

  for (const view of [memorial, debate]) {
    assert.ok(view.sourceViews.some((source) => source.sourceView === "officialCareerView"));
    assert.ok(view.evidenceRefs.some((ref) =>
      ref.sourceView === "officialCareerView" && /首月回署|馆阁讲章校订/.test(`${ref.label}${ref.summary}`)
    ));
    assert.ok(view.evidenceRefs.some((ref) =>
      ref.sourceView === "officialCareerView" && /部院待覆|部院覆奏/.test(ref.summary)
    ));
    assert.ok(view.items.some((item) => /首月回署|馆阁讲章校订/.test(`${item.title}${item.summary}`)));
    assertNoSensitiveText(view);
  }
});

test("S88.6 topic surfaces dedupe domain consequence archive and thread echoes", () => {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "后果去重"
  });
  worldState.turnCount = 18;
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "topic-surface-domain-echo",
      policyType: "market_regulation",
      policyLabel: "米价回响",
      status: "accepted",
      publicSummary: "米铺照牌价出售，仍需观察民情。",
      publicSourceId: "topic-surface-domain-public-source",
      stateDelta: { publicOrder: -3 },
      appliedAtTurn: 18
    }]
  };
  ensureWorldThreadState(worldState);

  const view = buildTopicSurfaceView(worldState, { surfaceId: "edict-draft" });
  const directRef = view.evidenceRefs.find((ref) => ref.sourceView === "domainConsequenceView");
  const echoRef = directRef?.canonicalEchoRefs?.[0] || "";
  const echoMatches = view.evidenceRefs.filter((ref) => ref.canonicalEchoRefs?.includes(echoRef));

  assert.match(echoRef, /^domainConsequenceEcho:/);
  assert.equal(echoMatches.length, 1);
  assert.equal(echoMatches[0].sourceView, "domainConsequenceView");
  assertNoSensitiveText(view);
});

test("S88.7 topic surfaces expose NPC follow-up evidence as read-only material", () => {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "来函专题"
  });
  worldState.turnCount = 16;
  const petition = createNpcActiveRequest(worldState, "petition");
  const introduction = createNpcActiveRequest(worldState, "introduction");
  assert.equal(petition.ok, true);
  assert.equal(introduction.ok, true);
  resolveNpcActiveRequest(worldState, petition.request.requestId, "investigate");
  resolveNpcActiveRequest(worldState, introduction.request.requestId, "accept");

  const memorial = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  const profile = buildTopicSurfaceView(worldState, { surfaceId: "npc-profile" });
  const trial = buildTopicSurfaceView(worldState, { surfaceId: "trial" });

  assert.ok(memorial.sourceViews.some((source) => source.sourceView === "npcActiveRequestView"));
  assert.ok(memorial.evidenceRefs.some((ref) =>
    ref.sourceView === "npcActiveRequestView" && /请托|案牍|公私边界/.test(`${ref.label}${ref.summary}`)
  ));
  assert.ok(profile.sourceViews.some((source) => source.sourceView === "npcActiveRequestView"));
  assert.ok(profile.evidenceRefs.some((ref) =>
    ref.sourceView === "npcActiveRequestView" && /引荐|拜会|师友|同年/.test(`${ref.label}${ref.summary}`)
  ));
  assert.equal(profile.evidenceRefs.some((ref) =>
    ref.sourceView === "npcActiveRequestView" && /请托|案牍|公私边界/.test(`${ref.label}${ref.summary}`)
  ), false);
  assert.ok(trial.evidenceRefs.some((ref) =>
    ref.sourceView === "npcActiveRequestView" && /请托|案牍|公私边界/.test(`${ref.label}${ref.summary}`)
  ));
  assert.equal(trial.evidenceRefs.some((ref) =>
    ref.sourceView === "npcActiveRequestView" && /引荐|拜会|师友|同年/.test(`${ref.label}${ref.summary}`)
  ), false);
  assertNoSensitiveText({ memorial, profile, trial });
});

test("S88.8 topic surfaces route economy trace evidence by safe topic allowlist", () => {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "magistrate",
    playerName: "经济专题"
  });
  worldState.turnCount = 20;
  worldState.player.localTreasury = 120;
  worldState.npcEconomyLedger.recentEvents = [
    "人情债月账：韩员外为修桥垫付，公开人情债略增。"
  ];
  resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:topic:economy",
    silverDelta: 0,
    offerSummary: "询问纸张与粟米行价。"
  }, {
    npcResponse: "可再议。",
    proposal: {
      status: "countered",
      publicSummary: "韩员外交易议价：纸张与粮价消息尚待服务器确认。",
      riskTags: ["议价"]
    }
  });
  const delegated = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩，核对鱼鳞册与实耕。",
    budget: 24
  });
  assert.equal(delegated.ok, true);

  const memorial = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  const profile = buildTopicSurfaceView(worldState, { surfaceId: "npc-profile" });
  const trial = buildTopicSurfaceView(worldState, { surfaceId: "trial" });
  const warCouncil = buildTopicSurfaceView(worldState, { surfaceId: "war-council" });

  assert.ok(memorial.sourceViews.some((source) => source.sourceView === "economyTraceView"));
  assert.ok(memorial.evidenceRefs.some((ref) =>
    ref.sourceView === "economyTraceView" && /交易议价|韩员外/.test(`${ref.label}${ref.summary}`)
  ));
  assert.ok(memorial.evidenceRefs.some((ref) =>
    ref.sourceView === "economyTraceView" && /丈量田亩|委派|预算/.test(`${ref.label}${ref.summary}`)
  ));
  assert.ok(profile.evidenceRefs.some((ref) =>
    ref.sourceView === "economyTraceView" && /人情债|韩员外/.test(`${ref.label}${ref.summary}`)
  ));
  assert.equal(profile.evidenceRefs.some((ref) =>
    ref.sourceView === "economyTraceView" && /资产维护|保养|库存/.test(`${ref.label}${ref.summary}`)
  ), false);
  assert.equal(trial.evidenceRefs.some((ref) => ref.sourceView === "economyTraceView"), false);
  assert.ok(warCouncil.evidenceRefs.some((ref) =>
    ref.sourceView === "economyTraceView" && /丈量田亩|预算|市价/.test(`${ref.label}${ref.summary}`)
  ));
  assertNoSensitiveText({ memorial, profile, trial, warCouncil });
});

test("GET /api/game/topic-surface/:sessionId/:surfaceId returns read-only safe projection", async (t) => {
  const server = createGameServer();
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "magistrate",
    playerName: "堂审测试"
  });
  await writeSession(worldState);
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const beforeRaw = await fs.readFile(sessionPath(worldState.sessionId), "utf8");
  const response = await fetch(`${server.baseUrl}/api/game/topic-surface/${worldState.sessionId}/trial`);
  const payload = await response.json();
  const afterRaw = await fs.readFile(sessionPath(worldState.sessionId), "utf8");

  assert.equal(response.status, 200);
  assert.equal(payload.sessionId, worldState.sessionId);
  assert.equal(payload.topicSurfaceView.surfaceId, "trial");
  assert.ok(payload.topicSurfaceView.items.length >= 1);
  assert.ok(payload.topicSurfaceView.evidenceRefs.length >= 1);
  assertNoSensitiveText(payload);
  assert.equal(afterRaw, beforeRaw);
});
