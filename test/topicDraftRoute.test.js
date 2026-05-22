const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const { createInitialState } = require("../src/game/initialState");
const { createLandSurveyDelegatedTask } = require("../src/game/delegatedTasks");
const { resolveTradeRequest } = require("../src/game/tradeLedger");
const { buildTopicSurfaceView } = require("../src/game/topicSurfaceView");
const { normalizeTopicDraftTurnContext } = require("../src/game/topicDrafts");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");

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

async function createStoredSession(input = {}) {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "专题拟稿测试",
    ...input
  });
  await writeSession(worldState);
  return worldState;
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/ai", require("../src/routes/ai"));
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  return createFetchSafeServer(app);
}

function createTestServerWithProvider(provider) {
  const aiPath = require.resolve("../src/ai");
  const aiRoutePath = require.resolve("../src/routes/ai");
  const originalAiModule = require.cache[aiPath];
  const originalAiRouteModule = require.cache[aiRoutePath];

  delete require.cache[aiRoutePath];
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
  app.use("/api/ai", require("../src/routes/ai"));
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  const testServer = createFetchSafeServer(app);

  return {
    baseUrl: testServer.baseUrl,
    async close() {
      await testServer.close();
      delete require.cache[aiRoutePath];
      if (originalAiRouteModule) require.cache[aiRoutePath] = originalAiRouteModule;
      if (originalAiModule) require.cache[aiPath] = originalAiModule;
      else delete require.cache[aiPath];
    }
  };
}

async function postJson(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

function assertNoSensitiveText(payload) {
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(
    serialized,
    /SEALED_|hidden[ _-]?(?:notes?|intent)?|raw[ _-]?(?:provider|payload|prompt|audit|table|ledger|state|row)|provider\s+payload|prompt|完整提示词|localPath|file:\/\/|data[\\/](?:sessions|audit)|[A-Za-z]:[\\/]|\/(?:mnt|home|Users|tmp|var|opt|workspace)\/|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}/i
  );
}

function assertNoRawEconomyText(payload) {
  assert.doesNotMatch(
    JSON.stringify(payload),
    /assetLedger|resourceLedger|inventoryLedger|tradeLedger|delegatedTaskLedger|marketPriceLedger|npcEconomyLedger|resourceDelta|relationshipSignals|auditRecord|rawSql|SQLite|sqlite|SQL|safe_search_index|SEALED_|provider payload|sk-[A-Za-z0-9_-]{6,}/i
  );
}

function seedEconomyTopicSignals(worldState = {}) {
  worldState.turnCount = Math.max(Number(worldState.turnCount) || 0, 20);
  worldState.player.localTreasury = 120;
  worldState.npcEconomyLedger = {
    ...(worldState.npcEconomyLedger || {}),
    recentEvents: [
      "人情债月账：韩员外为修桥垫付，公开人情债略增。",
      "provider payload hiddenNotes data/sessions/secret.json"
    ]
  };
  resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:topic:draft-economy",
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
  createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩，核对鱼鳞册与实耕。",
    budget: 24
  });
}

function assertTopicDraftEnvelope(payload, options = {}) {
  const { sessionId, source, status = "ready", surfaceId = "court-debate" } = options;
  assert.equal(payload.schemaVersion, "s78.topicDraft.v1");
  if (sessionId) assert.equal(payload.sessionId, sessionId);
  assert.equal(payload.surfaceId, surfaceId);
  if (source) assert.equal(payload.source, source);
  assert.equal(payload.status, status);
  assert.equal(payload.topicDraft.surfaceId, surfaceId);
  if (source) assert.equal(payload.topicDraft.source, source);
  assert.equal(typeof payload.topicDraft.draftTitle, "string");
  assert.equal(typeof payload.topicDraft.draftText, "string");
  assert.ok(payload.topicDraft.draftTitle.length > 0);
  assert.ok(payload.topicDraft.draftText.length > 0);
  assert.ok(Array.isArray(payload.topicDraft.evidenceRefs));
  assert.ok(payload.topicDraft.evidenceRefs.length <= 5);
  assertNoSensitiveText(payload);
}

test("POST /api/ai/topic-draft/:sessionId returns safe mock topic draft", async (t) => {
  const server = createTestServer();
  const worldState = await createStoredSession({ role: "emperor", playerName: "朱批测试" });
  const view = buildTopicSurfaceView(worldState, { surfaceId: "edict-draft" });
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
    surfaceId: "edict-draft",
    draftKind: view.draftSlots[0].draftKind,
    selectedEvidenceRefs: view.evidenceRefs.slice(0, 2).map((ref) => ref.refId),
    playerNote: "措辞宜缓。"
  });

  assert.equal(response.status, 200);
  assertTopicDraftEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "mock-ai",
    surfaceId: "edict-draft"
  });
  assert.match(payload.topicDraft.draftText, /所据|公开材料|裁决/);
});

test("POST /api/ai/topic-draft/:sessionId is read-only for session files", async (t) => {
  const server = createTestServer();
  const worldState = await createStoredSession({ role: "general", playerName: "军议测试" });
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const beforeRaw = await fs.readFile(sessionPath(worldState.sessionId), "utf8");
  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
    surfaceId: "war-council"
  });
  const afterRaw = await fs.readFile(sessionPath(worldState.sessionId), "utf8");

  assert.equal(response.status, 200);
  assertTopicDraftEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "mock-ai",
    surfaceId: "war-council"
  });
  assert.equal(afterRaw, beforeRaw);
});

test("POST /api/ai/topic-draft/:sessionId sends only safe surface context to provider", async (t) => {
  let providerContext = null;
  const provider = {
    modelRoute: { provider: "openai" },
    async draftTopicSurface(context) {
      providerContext = context;
      assert.equal(context.surfaceId, "trial");
      assert.equal(context.player.role, "magistrate");
      assert.ok(context.evidenceRefs.length >= 1);
      assertNoSensitiveText(context);
      return {
        source: "provider-ai",
        surfaceId: "trial",
        draftKind: context.draftKind,
        draftTitle: "复核证据",
        draftText: "本官拟据公开案牍升堂复核，先问原告、保甲与书吏，再请上司按例裁示。",
        evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
        riskNote: "若证据互相抵牾，宜先缓审。",
        nextStep: "写入底部奏折后再呈上。"
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  const worldState = await createStoredSession({ role: "magistrate", playerName: "杜明府" });
  const view = buildTopicSurfaceView(worldState, { surfaceId: "trial" });
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
    surfaceId: "trial",
    selectedEvidenceRefs: [view.evidenceRefs[0].refId],
    worldState: { player: { role: "emperor" }, hiddenNotes: "SEALED_BROWSER" },
    providerPayload: "raw provider prompt sk-browser-secret-123456"
  });

  assert.equal(response.status, 200);
  assert.ok(providerContext);
  assertTopicDraftEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "provider-ai",
    surfaceId: "trial"
  });
  assert.doesNotMatch(JSON.stringify(payload), /SEALED_BROWSER|sk-browser-secret|emperor/i);
});

test("S88.4 topic draft can cite official first-month court entry evidence safely", async (t) => {
  let providerContext = null;
  const provider = {
    modelRoute: { provider: "openai" },
    async draftTopicSurface(context) {
      providerContext = context;
      assert.equal(context.surfaceId, "memorial-review");
      assert.equal(context.draftKind, "official_first_month_memorial");
      assert.ok(context.evidenceRefs.some((ref) =>
        ref.sourceView === "officialCareerView" && /馆阁讲章校订|首月回署/.test(`${ref.label}${ref.summary}`)
      ));
      assertNoSensitiveText(context);
      return {
        source: "provider-ai",
        surfaceId: context.surfaceId,
        draftKind: context.draftKind,
        draftTitle: "首月回署奏稿",
        draftText: "臣谨据公开回署材料陈明馆阁讲章校订进度、上官同僚所疑与考成风险，伏请交部院复核。",
        evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
        riskNote: "此稿只陈公开材料，不定奖惩。",
        nextStep: "写入草稿后仍候主卷服务器裁决。"
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  const worldState = await createStoredSession({ role: "official", playerName: "首月拟稿" });
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
  await writeSession(worldState);
  const view = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  const officialRef = view.evidenceRefs.find((ref) =>
    ref.sourceView === "officialCareerView" && /馆阁讲章校订|首月回署/.test(`${ref.label}${ref.summary}`)
  );
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  assert.ok(officialRef);
  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
    surfaceId: "memorial-review",
    draftKind: "official_first_month_memorial",
    selectedEvidenceRefs: [officialRef.refId],
    worldState: { officialCareer: { hiddenNotes: "SEALED_BROWSER" } },
    providerPayload: "raw provider prompt sk-browser-secret-123456"
  });

  assert.equal(response.status, 200);
  assert.ok(providerContext);
  assertTopicDraftEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "provider-ai",
    surfaceId: "memorial-review"
  });
  assert.equal(payload.topicDraft.draftKind, "official_first_month_memorial");
  assert.deepEqual(payload.topicDraft.evidenceRefs, [officialRef.refId]);
  assert.doesNotMatch(JSON.stringify(payload), /SEALED_BROWSER|堂官私下试探|sk-browser-secret|raw_table/i);
});

test("S88.6 topic draft can cite domain consequence evidence safely", async (t) => {
  let providerContext = null;
  const provider = {
    modelRoute: { provider: "openai" },
    async draftTopicSurface(context) {
      providerContext = context;
      assert.equal(context.surfaceId, "trial");
      assert.ok(context.evidenceRefs.some((ref) =>
        ref.sourceView === "domainConsequenceView" && /平抑米价/.test(`${ref.label}${ref.summary}`)
      ));
      assertNoSensitiveText(context);
      assert.doesNotMatch(
        JSON.stringify(context),
        /cityPolicyLedger|market:grain|stateDelta|playerDelta|auditRecord|rawSql|SEALED_SOURCE/
      );
      return {
        source: "provider-ai",
        surfaceId: context.surfaceId,
        draftKind: context.draftKind,
        draftTitle: "后果复核",
        draftText: "本官拟据公开后果追踪升堂复核米价余波，先问粮商牌价与乡民告状，再候服务器裁决。",
        evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
        riskNote: "此稿只据公开后果追踪，不定罚赏。",
        nextStep: "写入底部草稿后仍候主卷服务器裁决。"
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  const worldState = await createStoredSession({ role: "magistrate", playerName: "后果拟稿" });
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "topic-draft:market:grain:SEALED_SOURCE",
      policyType: "market_regulation",
      policyLabel: "平抑米价",
      status: "accepted",
      publicSummary: "县中平抑米价，粮商愿照牌价出售。",
      publicSourceId: "market:grain:topic-draft-public-source",
      stateDelta: { publicOrder: 3, treasury: -20 },
      playerDelta: { performanceMerit: 1 },
      evidenceRefs: ["market:grain:SEALED_SOURCE"],
      auditRecord: { rawSql: "select * from hidden_table" },
      appliedAtTurn: 8
    }]
  };
  await writeSession(worldState);
  const view = buildTopicSurfaceView(worldState, { surfaceId: "trial" });
  const domainRef = view.evidenceRefs.find((ref) =>
    ref.sourceView === "domainConsequenceView" && /平抑米价/.test(`${ref.label}${ref.summary}`)
  );
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  assert.ok(domainRef);
  assert.match(domainRef.canonicalEchoRefs?.[0] || "", /^domainConsequenceEcho:/);
  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
    surfaceId: "trial",
    selectedEvidenceRefs: [domainRef.refId],
    worldState: { cityPolicyLedger: { hiddenNotes: "SEALED_BROWSER" } },
    providerPayload: "raw provider prompt sk-browser-secret-123456"
  });

  assert.equal(response.status, 200);
  assert.ok(providerContext);
  const providerDomainRef = providerContext.evidenceRefs.find((ref) => ref.refId === domainRef.refId);
  assert.deepEqual(providerDomainRef.canonicalEchoRefs, domainRef.canonicalEchoRefs);
  assertTopicDraftEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "provider-ai",
    surfaceId: "trial"
  });
  assert.deepEqual(payload.topicDraft.evidenceRefs, [domainRef.refId]);
  assert.deepEqual(payload.topicDraft.canonicalEchoRefs, domainRef.canonicalEchoRefs);
  assert.doesNotMatch(
    JSON.stringify(payload),
    /SEALED_BROWSER|cityPolicyLedger|market:grain|stateDelta|playerDelta|auditRecord|rawSql|sk-browser-secret/
  );
});

test("S88.8 topic draft can cite economy trace evidence safely", async (t) => {
  let providerContext = null;
  let economyRef = null;
  const provider = {
    modelRoute: { provider: "openai" },
    async draftTopicSurface(context) {
      providerContext = context;
      assert.equal(context.surfaceId, "memorial-review");
      const providerEconomyRef = context.evidenceRefs.find((ref) => ref.refId === economyRef.refId);
      assert.ok(providerEconomyRef);
      assert.equal(providerEconomyRef.sourceView, "economyTraceView");
      assert.equal(providerEconomyRef.sourceLabel, "经济解释");
      assert.equal(providerEconomyRef.domainLabel, "月账");
      assert.match(providerEconomyRef.adjudicationBoundary, /服务器裁决/);
      assert.match(providerEconomyRef.adjudicationBoundary, /交易成交|资源扣减|委派结果|人情债/);
      assertNoSensitiveText(context);
      assertNoRawEconomyText(context);
      return {
        source: "provider-ai",
        surfaceId: context.surfaceId,
        draftKind: context.draftKind,
        draftTitle: "月账复核",
        draftText: "臣谨据公开经济解释陈明纸价与修桥垫付缘由，只请部院复核凭据，后果仍候服务器裁决。",
        evidenceRefs: [economyRef.refId, "economyTraceView:forged-secret"],
        riskNote: "经济解释只作账解，不定钱粮与人情债。",
        nextStep: "写入底部草稿后再呈上。"
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  const worldState = await createStoredSession({ role: "magistrate", playerName: "经济拟稿" });
  seedEconomyTopicSignals(worldState);
  await writeSession(worldState);
  const view = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  economyRef = view.evidenceRefs.find((ref) =>
    ref.sourceView === "economyTraceView" && /交易议价|韩员外/.test(`${ref.label}${ref.summary}`)
  );
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  assert.ok(economyRef);
  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
    surfaceId: "memorial-review",
    draftKind: view.draftSlots[0].draftKind,
    selectedEvidenceRefs: [economyRef.refId, "economyTraceView:browser-forged"],
    providerPayload: "raw provider prompt sk-browser-secret-123456",
    worldState: { tradeLedger: { hiddenNotes: "SEALED_BROWSER" } }
  });

  assert.equal(response.status, 200);
  assert.ok(providerContext);
  assertTopicDraftEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "provider-ai",
    surfaceId: "memorial-review"
  });
  assert.deepEqual(providerContext.selectedEvidenceRefs, [economyRef.refId]);
  assert.deepEqual(payload.topicDraft.evidenceRefs, [economyRef.refId]);
  assert.doesNotMatch(JSON.stringify(payload), /browser-forged|forged-secret|SEALED_BROWSER|tradeLedger|sk-browser-secret/);
  assertNoRawEconomyText(payload);
});

test("S88.8 local topic draft fallback explains economy evidence without settlement power", async (t) => {
  const provider = {
    modelRoute: { provider: "openai" },
    async draftTopicSurface() {
      throw new Error("raw provider payload sk-provider-secret-123456 data/sessions/private.json");
    }
  };
  const server = createTestServerWithProvider(provider);
  const worldState = await createStoredSession({ role: "magistrate", playerName: "经济降级" });
  seedEconomyTopicSignals(worldState);
  await writeSession(worldState);
  const view = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  const economyRef = view.evidenceRefs.find((ref) =>
    ref.sourceView === "economyTraceView" && /交易议价|韩员外/.test(`${ref.label}${ref.summary}`)
  );
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  assert.ok(economyRef);
  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
    surfaceId: "memorial-review",
    draftKind: view.draftSlots[0].draftKind,
    selectedEvidenceRefs: [economyRef.refId]
  });

  assert.equal(response.status, 200);
  assertTopicDraftEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "local-rule",
    status: "fallback",
    surfaceId: "memorial-review"
  });
  assert.deepEqual(payload.topicDraft.evidenceRefs, [economyRef.refId]);
  assert.match(payload.topicDraft.draftText, /经济解释/);
  assert.match(payload.topicDraft.draftText, /不视为交易成交|委派结算|服务器裁决/);
  assert.doesNotMatch(payload.topicDraft.draftText, /已成交|已拨款|已结算|执行完毕/);
  assertNoRawEconomyText(payload);
});

test("S88.8 turn draft context revalidates economy evidence hints against the current surface", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "经济提示校验" });
  seedEconomyTopicSignals(worldState);
  const memorial = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  const economyRef = memorial.evidenceRefs.find((ref) =>
    ref.sourceView === "economyTraceView" && /交易议价|韩员外/.test(`${ref.label}${ref.summary}`)
  );

  assert.ok(economyRef);
  const verified = normalizeTopicDraftTurnContext(worldState, {
    surfaceId: "memorial-review",
    draftKind: memorial.draftSlots[0].draftKind,
    evidenceRefs: [economyRef.refId, "economyTraceView:forged-secret"],
    canonicalEchoRefs: ["domainConsequenceEcho:forged"],
    generatedAtTurn: memorial.generatedAtTurn,
    status: "client_hint"
  });
  const blockedOnTrial = normalizeTopicDraftTurnContext(worldState, {
    surfaceId: "trial",
    draftKind: "investigate_case",
    evidenceRefs: [economyRef.refId]
  });

  assert.ok(verified);
  assert.deepEqual(verified.evidenceRefs, [economyRef.refId]);
  assert.deepEqual(verified.canonicalEchoRefs, []);
  assert.equal(verified.status, "verified");
  assert.equal(blockedOnTrial, null);
  assert.doesNotMatch(JSON.stringify(verified), /forged-secret|domainConsequenceEcho:forged|tradeLedger|resourceDelta|relationshipSignals|auditRecord/);
});

test("POST /api/ai/topic-draft/:sessionId falls back for provider failure and unsafe drafts", async (t) => {
  const cases = [
    {
      name: "provider throws",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface() {
          throw new Error("raw provider payload sk-provider-secret-123456 data/sessions/private.json");
        }
      })
    },
    {
      name: "bad JSON-shaped payload",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface() {
          return "not-json";
        }
      })
    },
    {
      name: "forged evidence",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface(context) {
          return {
            source: "provider-ai",
            surfaceId: context.surfaceId,
            draftKind: context.draftKind,
            draftTitle: "伪造证据",
            draftText: "据公开材料拟成草稿，仍候主卷裁决。",
            evidenceRefs: ["provider-forged-secret-ref"],
            riskNote: "无",
            nextStep: "写入草稿。"
          };
        }
      })
    },
    {
      name: "resolved outcome claim",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface(context) {
          return {
            source: "provider-ai",
            surfaceId: context.surfaceId,
            draftKind: context.draftKind,
            draftTitle: "已裁决",
            draftText: "已经结案并任命官员，军令已经生效。",
            evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
            riskNote: "无",
            nextStep: "无"
          };
        }
      })
    },
    {
      name: "official assessment outcome claim",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface(context) {
          return {
            source: "provider-ai",
            surfaceId: context.surfaceId,
            draftKind: context.draftKind,
            draftTitle: "考成已定",
            draftText: "考成已定，已记功，弹劾成案，处分已定。",
            evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
            riskNote: "无",
            nextStep: "无"
          };
        }
      })
    },
    {
      name: "polluted text",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface(context) {
          return {
            source: "provider-ai",
            surfaceId: context.surfaceId,
            draftKind: context.draftKind,
            draftTitle: "raw provider",
            draftText: "读取 hidden raw provider prompt data/sessions/private.json sk-provider-secret-123456",
            evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
            riskNote: "raw",
            nextStep: "prompt"
          };
        }
      })
    },
    {
      name: "bare provider prompt terms",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface(context) {
          return {
            source: "provider-ai",
            surfaceId: context.surfaceId,
            draftKind: context.draftKind,
            draftTitle: "疑似外部词",
            draftText: "此稿提及 provider prompt，但没有进入 raw 词组。",
            evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
            riskNote: "provider",
            nextStep: "prompt"
          };
        }
      })
    }
  ];

  for (const entry of cases) {
    await t.test(entry.name, async (t) => {
      const server = createTestServerWithProvider(entry.buildProvider());
      const worldState = await createStoredSession({ role: "official", playerName: `降级${entry.name}` });
      t.after(async () => {
        await removeSessionArtifacts(worldState.sessionId);
        await server.close();
      });

      const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
        surfaceId: "court-debate"
      });

      assert.equal(response.status, 200);
      assertTopicDraftEnvelope(payload, {
        sessionId: worldState.sessionId,
        source: "local-rule",
        status: "fallback",
        surfaceId: "court-debate"
      });
      assert.equal(payload.fallbackReason, "topic_draft_provider_failed");
      assert.doesNotMatch(JSON.stringify(payload), /sk-provider-secret|provider-forged-secret-ref|raw provider payload|provider prompt|data\/sessions/i);
    });
  }
});
