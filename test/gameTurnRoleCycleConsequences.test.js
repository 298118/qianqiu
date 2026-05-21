const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { createInitialState } = require("../src/game/initialState");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
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
