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
