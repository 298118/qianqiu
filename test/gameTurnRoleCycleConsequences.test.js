const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { createInitialState } = require("../src/game/initialState");
const { createLandSurveyDelegatedTask } = require("../src/game/delegatedTasks");
const { resolveTradeRequest } = require("../src/game/tradeLedger");
const { buildTopicSurfaceView } = require("../src/game/topicSurfaceView");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  return createFetchSafeServer(app);
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

async function postTurnSse(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify(body)
  });
  return { response, events: parseSse(await response.text()) };
}

function seedEconomyTopicSignals(worldState = {}) {
  worldState.year = 1644;
  worldState.month = 4;
  worldState.tenDayPeriod = 1;
  worldState.turnCount = Math.max(Number(worldState.turnCount) || 0, 19);
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
    tradeId: "trade:turn:draft-economy",
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
}

function buildEconomyDraftContext(worldState = {}) {
  const topicView = buildTopicSurfaceView(worldState, { surfaceId: "memorial-review" });
  const economyRef = topicView.evidenceRefs.find((ref) => ref.sourceView === "economyTraceView");
  assert.ok(economyRef, "expected a safe economyTraceView topic evidence ref");
  assert.deepEqual(economyRef.canonicalEchoRefs || [], []);
  return {
    surfaceId: "memorial-review",
    draftKind: topicView.draftSlots[0]?.draftKind || "vermilion_comment",
    evidenceRefs: [economyRef.refId, "economyTraceView:forged-secret"],
    canonicalEchoRefs: ["domainConsequenceEcho:forged"],
    generatedAtTurn: topicView.generatedAtTurn,
    status: "client_hint"
  };
}

function snapshotEconomyLedgers(worldState = {}) {
  return {
    cityPolicyCount: worldState.cityPolicyLedger?.records?.length || 0,
    militaryDiplomacyCount: worldState.militaryDiplomacyLedger?.records?.length || 0,
    tradeRecords: JSON.parse(JSON.stringify(worldState.tradeLedger?.records || [])),
    delegatedTasks: JSON.parse(JSON.stringify(worldState.delegatedTaskLedger?.tasks || [])),
    resourceLedger: JSON.parse(JSON.stringify(worldState.resourceLedger || null)),
    npcEconomyRecentEvents: [...(worldState.npcEconomyLedger?.recentEvents || [])],
    playerGold: worldState.player?.gold,
    localTreasury: worldState.player?.localTreasury
  };
}

function assertEconomyDraftDidNotSettle(savedBefore = {}, savedAfter = {}) {
  const before = snapshotEconomyLedgers(savedBefore);
  const after = snapshotEconomyLedgers(savedAfter);
  assert.equal(after.cityPolicyCount, before.cityPolicyCount);
  assert.equal(after.militaryDiplomacyCount, before.militaryDiplomacyCount);
  assert.deepEqual(after.tradeRecords, before.tradeRecords);
  assert.deepEqual(after.delegatedTasks, before.delegatedTasks);
  assert.deepEqual(after.resourceLedger, before.resourceLedger);
  assert.deepEqual(after.npcEconomyRecentEvents, before.npcEconomyRecentEvents);
  assert.equal(after.playerGold, before.playerGold);
  assert.equal(after.localTreasury, before.localTreasury);
}

function assertEconomyDraftResponseSafe(payload = {}) {
  const serialized = JSON.stringify(payload);
  const relationshipChangesText = JSON.stringify(payload.relationshipChanges || []);
  const outcome = payload.roleCycleDomainAdjudication?.outcome;
  assert.equal(outcome?.status, "duplicate_recent");
  assert.equal(outcome?.resolver, "city_policy");
  assert.equal(outcome?.canonicalEchoRefs, undefined);
  assert.equal(outcome?.topicDraftContext, undefined);
  assert.doesNotMatch(relationshipChangesText, /economyTraceView|tradeLedger|delegatedTaskLedger|resourceDelta|relationshipSignals|账解|交易|委派|人情债/);
  assert.equal(payload.worldState?.cityPolicyLedger, undefined);
  assert.equal(payload.worldState?.militaryDiplomacyLedger, undefined);
  assert.equal(payload.worldState?.resourceLedger, undefined);
  assert.doesNotMatch(
    serialized,
    /domainConsequenceEcho:forged|economyTraceView:forged-secret|"tradeLedger":|"delegatedTaskLedger":|"marketPriceLedger":|"npcEconomyLedger":|"resourceDelta":|"relationshipSignals":|"stateDelta":|"playerDelta":|"auditRecord":|provider payload|hiddenNotes|data\/sessions|rawSql|SEALED_/
  );
}

test("S88.5.3 turn resolves magistrate market role-cycle drafts without leaking raw resolver ledgers", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "magistrate", playerName: "市价知县" });
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。"
  });
  const serialized = JSON.stringify(payload);

  assert.equal(response.status, 200);
  assert.equal(payload.roleCycleDomainAdjudication.outcome.status, "accepted");
  assert.equal(payload.roleCycleDomainAdjudication.outcome.resolver, "city_policy");
  assert.equal(payload.roleCycleDomainAdjudication.outcome.intent, "market_regulation");
  assert.equal(payload.worldState.cityPolicyLedger, undefined);
  assert.equal(payload.worldState.militaryDiplomacyLedger, undefined);
  assert.ok(payload.attributeChanges.some((change) => change.reason === "角色循环服务器裁决"));
  assert.ok(payload.roleCycleDomainAdjudication.events.some((event) => /市价整肃|服务器裁决/.test(event)));
  assert.ok(payload.worldState.eventHistory.some((event) => /市价整肃|服务器裁决/.test(event)));
  assert.doesNotMatch(
    serialized,
    /"cityPolicyLedger":|"militaryDiplomacyLedger":|"rawSql":|SEALED_/
  );
  assert.doesNotMatch(JSON.stringify(payload.roleCycleDomainAdjudication), /"stateDelta":|"playerDelta":|"auditRecord":/);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.cityPolicyLedger.records.length, 1);
  assert.equal(saved.cityPolicyLedger.records[0].policyType, "market_regulation");
});

test("S88.6 turn-level role-cycle duplicate guard does not reapply city policy consequences", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "magistrate", playerName: "重复市价知县" });
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const input = "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。";
  const first = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input
  });
  const savedAfterFirst = await readSession(worldState.sessionId);
  const afterFirst = {
    ledgerCount: savedAfterFirst.cityPolicyLedger.records.length
  };

  const second = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input
  });
  const serialized = JSON.stringify(second.payload);
  const savedAfterSecond = await readSession(worldState.sessionId);

  assert.equal(first.response.status, 200);
  assert.equal(first.payload.roleCycleDomainAdjudication.outcome.status, "accepted");
  assert.equal(second.response.status, 200);
  assert.equal(second.payload.roleCycleDomainAdjudication.outcome.status, "duplicate_recent");
  assert.equal(second.payload.roleCycleDomainAdjudication.outcome.resolver, "city_policy");
  assert.equal(savedAfterSecond.cityPolicyLedger.records.length, afterFirst.ledgerCount);
  assert.equal(
    second.payload.attributeChanges.some((change) => change.reason === "角色循环服务器裁决"),
    false
  );
  assert.doesNotMatch(
    serialized,
    /"cityPolicyLedger":|"militaryDiplomacyLedger":|"stateDelta":|"playerDelta":|"auditRecord":|rawSql|SEALED_|role-cycle:/
  );
});

test("S88.6 turn verifies topic draft canonical echo refs before role-cycle adjudication", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "magistrate", playerName: "草稿回响知县" });
  worldState.turnCount = 12;
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "turn-draft-domain-echo",
      policyType: "market_regulation",
      policyLabel: "米价回响",
      status: "accepted",
      publicSummary: "米铺照牌价出售，仍需观察民情。",
      publicSourceId: "turn-route-domain-public-source",
      stateDelta: { publicOrder: -3 },
      evidenceRefs: ["market:legacy"],
      appliedAtTurn: 11
    }]
  };
  const topicView = buildTopicSurfaceView(worldState, { surfaceId: "trial" });
  const domainRef = topicView.evidenceRefs.find((ref) => ref.sourceView === "domainConsequenceView");
  const echoRef = domainRef?.canonicalEchoRefs?.[0] || "";
  const draftContext = {
    surfaceId: "trial",
    draftKind: "investigate_case",
    evidenceRefs: [domainRef?.refId],
    canonicalEchoRefs: ["domainConsequenceEcho:forged", echoRef],
    generatedAtTurn: topicView.generatedAtTurn,
    status: "client_hint"
  };
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  assert.match(echoRef, /^domainConsequenceEcho:/);
  const first = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。",
    draftContext
  });
  const savedAfterFirst = await readSession(worldState.sessionId);
  const firstLedgerRecord = savedAfterFirst.cityPolicyLedger.records.at(-1);

  assert.equal(first.response.status, 200);
  assert.equal(first.payload.roleCycleDomainAdjudication.outcome.status, "accepted");
  assert.deepEqual(first.payload.roleCycleDomainAdjudication.outcome.canonicalEchoRefs, [echoRef]);
  assert.equal(first.payload.roleCycleDomainAdjudication.outcome.topicDraftContext.status, "verified");
  assert.deepEqual(firstLedgerRecord.canonicalEchoRefs, [echoRef]);
  assert.equal(firstLedgerRecord.topicDraftContext.surfaceId, "trial");
  assert.doesNotMatch(JSON.stringify(first.payload), /domainConsequenceEcho:forged|turn-route-domain-public-source|cityPolicyLedger|stateDelta|playerDelta|auditRecord|outcomeId|role-cycle:|SEALED_/);

  const second = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。",
    draftContext
  });
  const savedAfterSecond = await readSession(worldState.sessionId);

  assert.equal(second.response.status, 200);
  assert.equal(second.payload.roleCycleDomainAdjudication.outcome.status, "duplicate_recent");
  assert.deepEqual(second.payload.roleCycleDomainAdjudication.outcome.canonicalEchoRefs, [echoRef]);
  assert.equal(savedAfterSecond.cityPolicyLedger.records.length, savedAfterFirst.cityPolicyLedger.records.length);
  assert.doesNotMatch(JSON.stringify(second.payload), /domainConsequenceEcho:forged|cityPolicyLedger|stateDelta|playerDelta|auditRecord|outcomeId|role-cycle:|SEALED_/);
});

test("S88.8 ordinary turn revalidates economy draftContext without settling economy ledgers", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "magistrate", playerName: "账解复核知县" });
  seedEconomyTopicSignals(worldState);
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const input = "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。";
  const first = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input
  });
  const savedAfterFirst = await readSession(worldState.sessionId);
  const draftContext = buildEconomyDraftContext(savedAfterFirst);

  const second = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input,
    draftContext
  });
  const savedAfterSecond = await readSession(worldState.sessionId);

  assert.equal(first.response.status, 200);
  assert.equal(first.payload.roleCycleDomainAdjudication.outcome.status, "accepted");
  assert.equal(second.response.status, 200);
  assertEconomyDraftResponseSafe(second.payload);
  assertEconomyDraftDidNotSettle(savedAfterFirst, savedAfterSecond);
});

test("S88.8 SSE turn revalidates economy draftContext without settling economy ledgers", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "magistrate", playerName: "账解流式知县" });
  seedEconomyTopicSignals(worldState);
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const input = "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。";
  const first = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input
  });
  const savedAfterFirst = await readSession(worldState.sessionId);
  const draftContext = buildEconomyDraftContext(savedAfterFirst);

  const second = await postTurnSse(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input,
    draftContext
  });
  const finalState = second.events.find((event) => event.event === "final_state");
  const savedAfterSecond = await readSession(worldState.sessionId);

  assert.equal(first.response.status, 200);
  assert.equal(first.payload.roleCycleDomainAdjudication.outcome.status, "accepted");
  assert.equal(second.response.status, 200);
  assert.match(second.response.headers.get("content-type") || "", /text\/event-stream/);
  assert.ok(finalState);
  assertEconomyDraftResponseSafe(finalState.data);
  assertEconomyDraftDidNotSettle(savedAfterFirst, savedAfterSecond);
});

test("S88.5.3 turn resolves general war-council drafts and keeps military ledger private", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "general", playerName: "筹粮将领" });
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "据战事档案开军议，先调粮道补给。"
  });
  const serialized = JSON.stringify(payload);

  assert.equal(response.status, 200);
  assert.equal(payload.roleCycleDomainAdjudication.outcome.status, "accepted");
  assert.equal(payload.roleCycleDomainAdjudication.outcome.resolver, "military_diplomacy");
  assert.equal(payload.roleCycleDomainAdjudication.outcome.intent, "resupply");
  assert.equal(payload.worldState.militaryDiplomacyLedger, undefined);
  assert.ok(payload.roleCycleDomainAdjudication.outcome.evidenceRefs.some((ref) => ref.startsWith("market:")));
  assert.ok(payload.roleCycleDomainAdjudication.outcome.evidenceRefs.some((ref) => ref.startsWith("military:")));
  assert.ok(payload.roleCycleDomainAdjudication.events.some((event) => /调粮|军务|服务器裁决/.test(event)));
  assert.ok(payload.worldState.eventHistory.some((event) => /调粮|军务|服务器裁决/.test(event)));
  assert.doesNotMatch(
    serialized,
    /"cityPolicyLedger":|"militaryDiplomacyLedger":|"rawSql":|SEALED_/
  );
  assert.doesNotMatch(JSON.stringify(payload.roleCycleDomainAdjudication), /"stateDelta":|"playerDelta":|"auditRecord":/);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.militaryDiplomacyLedger.records.length, 1);
  assert.equal(saved.militaryDiplomacyLedger.records[0].actionKind, "resupply");
});

test("S88.6 turn-level role-cycle duplicate guard does not reapply military consequences", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "general", playerName: "重复筹粮将领" });
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const input = "据战事档案开军议，先调粮道补给。";
  const first = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input
  });
  const savedAfterFirst = await readSession(worldState.sessionId);
  const afterFirst = {
    ledgerCount: savedAfterFirst.militaryDiplomacyLedger.records.length
  };

  const second = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input
  });
  const serialized = JSON.stringify(second.payload);
  const savedAfterSecond = await readSession(worldState.sessionId);

  assert.equal(first.response.status, 200);
  assert.equal(first.payload.roleCycleDomainAdjudication.outcome.status, "accepted");
  assert.equal(second.response.status, 200);
  assert.equal(second.payload.roleCycleDomainAdjudication.outcome.status, "duplicate_recent");
  assert.equal(second.payload.roleCycleDomainAdjudication.outcome.resolver, "military_diplomacy");
  assert.equal(second.payload.roleCycleDomainAdjudication.outcome.intent, "resupply");
  assert.equal(savedAfterSecond.militaryDiplomacyLedger.records.length, afterFirst.ledgerCount);
  assert.equal(
    second.payload.attributeChanges.some((change) => change.reason === "角色循环服务器裁决"),
    false
  );
  assert.doesNotMatch(
    serialized,
    /"cityPolicyLedger":|"militaryDiplomacyLedger":|"stateDelta":|"playerDelta":|"auditRecord":|rawSql|SEALED_|role-cycle:/
  );
});

test("S88.6 turn blocks high-risk or inactive-role role-cycle resolver bypasses", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const generalState = createInitialState({ role: "general", playerName: "越界将领" });
  t.after(() => removeSessionArtifacts(generalState.sessionId));
  await writeSession(generalState);

  const highRisk = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: generalState.sessionId,
    input: "据战事档案开军议，先调粮后发兵攻取边堡。"
  });

  assert.equal(highRisk.response.status, 200);
  assert.equal(highRisk.payload.roleCycleDomainAdjudication.outcome, null);
  assert.equal(highRisk.payload.worldState.militaryDiplomacyLedger, undefined);

  const savedGeneral = await readSession(generalState.sessionId);
  assert.equal(savedGeneral.militaryDiplomacyLedger, undefined);

  const scholarState = createInitialState({ role: "scholar", playerName: "越界书生" });
  t.after(() => removeSessionArtifacts(scholarState.sessionId));
  await writeSession(scholarState);

  const inactiveRole = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: scholarState.sessionId,
    input: "据舆图与战事档案开军议，先调粮道补给。"
  });

  assert.equal(inactiveRole.response.status, 200);
  assert.equal(inactiveRole.payload.roleCycleDomainAdjudication.outcome, null);
  assert.equal(inactiveRole.payload.worldState.militaryDiplomacyLedger, undefined);
  assert.equal(inactiveRole.payload.worldState.cityPolicyLedger, undefined);
  assert.doesNotMatch(
    JSON.stringify(inactiveRole.payload),
    /"militaryDiplomacyLedger":|"cityPolicyLedger":|"stateDelta":|"playerDelta":|"auditRecord":|SEALED_/
  );

  const savedScholar = await readSession(scholarState.sessionId);
  assert.equal(savedScholar.militaryDiplomacyLedger, undefined);
  assert.equal(savedScholar.cityPolicyLedger, undefined);

  const countyOfficialState = createInitialState({ role: "official", playerName: "知县官员" });
  countyOfficialState.player.officeTitle = "知县";
  countyOfficialState.player.position = "知县";
  t.after(() => removeSessionArtifacts(countyOfficialState.sessionId));
  await writeSession(countyOfficialState);

  const officialMarket = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: countyOfficialState.sessionId,
    input: "本旬先处置广州粮储市价，平粜稳价。"
  });

  assert.equal(officialMarket.response.status, 200);
  assert.equal(officialMarket.payload.roleCycleDomainAdjudication.outcome, null);
  assert.equal(officialMarket.payload.worldState.cityPolicyLedger, undefined);

  const savedCountyOfficial = await readSession(countyOfficialState.sessionId);
  assert.equal(savedCountyOfficial.cityPolicyLedger, undefined);

  const militaryOfficialState = createInitialState({ role: "official", playerName: "武职官员" });
  militaryOfficialState.player.officeTitle = "游击将军";
  militaryOfficialState.player.position = "游击将军";
  t.after(() => removeSessionArtifacts(militaryOfficialState.sessionId));
  await writeSession(militaryOfficialState);

  const officialMilitary = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: militaryOfficialState.sessionId,
    input: "据战事档案开军议，先调粮道补给。"
  });

  assert.equal(officialMilitary.response.status, 200);
  assert.equal(officialMilitary.payload.roleCycleDomainAdjudication.outcome, null);
  assert.equal(officialMilitary.payload.worldState.militaryDiplomacyLedger, undefined);

  const savedMilitaryOfficial = await readSession(militaryOfficialState.sessionId);
  assert.equal(savedMilitaryOfficial.militaryDiplomacyLedger, undefined);
});

test("S88.5.3 turn keeps npc economy role-cycle review read-only", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "magistrate", playerName: "月账知县" });
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "查看人物月账与赊欠回报。"
  });
  const serialized = JSON.stringify(payload);

  assert.equal(response.status, 200);
  assert.equal(payload.roleCycleDomainAdjudication.outcome.status, "read_only");
  assert.equal(payload.roleCycleDomainAdjudication.outcome.resolver, "npc_economy");
  assert.equal(payload.worldState.cityPolicyLedger, undefined);
  assert.equal(payload.worldState.militaryDiplomacyLedger, undefined);
  assert.doesNotMatch(serialized, /"cityPolicyLedger":|"militaryDiplomacyLedger":|"rawSql":|SEALED_/);
  assert.doesNotMatch(JSON.stringify(payload.roleCycleDomainAdjudication), /"stateDelta":|"playerDelta":|"auditRecord":/);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.cityPolicyLedger, undefined);
  assert.equal(saved.militaryDiplomacyLedger, undefined);
});
