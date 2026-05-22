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
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      error: err.message || "Internal server error",
      details: err.details || null
    });
  });
  return createFetchSafeServer(app);
}

test("S82 POST /api/game/start adjudicates custom background claims into safe ledgers", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/game/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dynasty: "明",
      year: 1644,
      role: "scholar",
      playerName: "背景兑现测试",
      customSetting: "家有房屋两座，白银一万两，另称持玉玺、已是进士、统兵十万，又欠乡里债。"
    })
  });
  const payload = await response.json();
  t.after(() => removeSessionArtifacts(payload.sessionId));
  const serialized = JSON.stringify(payload);

  assert.equal(response.status, 201);
  assert.equal(payload.worldState.assetLedger, undefined);
  assert.equal(payload.worldState.resourceLedger, undefined);
  assert.equal(payload.worldState.inventoryLedger, undefined);
  assert.equal(payload.worldState.npcRoster, undefined);
  assert.equal(payload.worldState.openingBackgroundClaims, undefined);
  assert.equal(payload.worldState.player.examRank, null);
  assert.equal(payload.worldState.player.officeTitle, null);
  assert.equal(payload.openingBackgroundClaimsView.status, "processed");
  assert.ok(payload.openingBackgroundClaimsView.counts.scaled >= 1);
  assert.ok(payload.openingBackgroundClaimsView.counts.risk >= 3);
  assert.ok(payload.assetLedgerView.assets.some((asset) => asset.assetType === "estate"));
  assert.ok(payload.inventoryView.importantCredentials.some((item) => item.name.includes("地契")));
  assert.ok(payload.resourceLedgerView.accounts.find((account) => account.resourceId === "silver_liang").amount <= 535);
  assert.match(payload.narrative, /背景兑现测试|书生|寒窗/);
  assert.doesNotMatch(
    serialized,
    /"assetLedger":|"resourceLedger":|"inventoryLedger":|"npcRoster":|"openingBackgroundClaims":|"hiddenDossier":|"rawProviderPayload":|sk-[A-Za-z0-9_-]{6,}/
  );
});

test("S83/S84 safety APIs expose NPC, inventory, trade and delegated task views without raw ledgers", async (t) => {
  const worldState = createInitialState({
    role: "magistrate",
    playerName: "清丈知县"
  });
  worldState.player.localTreasury = 80;
  await writeSession(worldState);
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  const server = createTestServer();
  t.after(server.close);

  const npcsResponse = await fetch(`${server.baseUrl}/api/game/npcs/${worldState.sessionId}?interaction=delegate`);
  const npcsPayload = await npcsResponse.json();
  assert.equal(npcsResponse.status, 200);
  assert.ok(npcsPayload.npcRosterView.items.some((npc) => npc.npcId === "npc:magistrate:registrar-lu"));

  const detailResponse = await fetch(`${server.baseUrl}/api/game/npc/${worldState.sessionId}/npc:magistrate:registrar-lu`);
  const detailPayload = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detailPayload.npcDetailView.displayName, "陆知事");

  const dialogueResponse = await fetch(`${server.baseUrl}/api/game/npc-interaction/${worldState.sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      npcId: "npc:magistrate:registrar-lu",
      actionType: "talk",
      utterance: "东乡田册是否可先清丈？"
    })
  });
  const dialoguePayload = await dialogueResponse.json();
  assert.equal(dialogueResponse.status, 200);
  assert.match(dialoguePayload.npcDialogueView.dialogueText, /陆知事|此事/);

  const commandResponse = await fetch(`${server.baseUrl}/api/game/npc-command/${worldState.sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assigneeActorId: "npc:magistrate:registrar-lu",
      taskType: "land_survey",
      authoritySource: "yamen_authority",
      targetRef: "geo:county:qinghe:east-village",
      commandText: "丈量东乡田亩，核对鱼鳞册。",
      budget: 24
    })
  });
  const commandPayload = await commandResponse.json();
  assert.equal(commandResponse.status, 200);
  assert.equal(commandPayload.delegatedTask.taskType, "land_survey");
  assert.equal(commandPayload.delegatedTask.serverPlan, undefined);
  assert.equal(commandPayload.delegatedTaskView.items.length, 1);
  assert.ok(commandPayload.economyTraceView.traceItems.some((item) => item.traceType === "delegated_task_budget"));
  assert.doesNotMatch(
    JSON.stringify(commandPayload.economyTraceView),
    /"assetLedger":|"resourceLedger":|"inventoryLedger":|"tradeLedger":|"delegatedTaskLedger":|"evidenceRefs":|"hiddenDossier":|"privateSignalTags":|"rawLedger":|sqlite|SQLite|SQL|sk-[A-Za-z0-9_-]{6,}/
  );

  const inventoryResponse = await fetch(`${server.baseUrl}/api/game/inventory/${worldState.sessionId}`);
  const inventoryPayload = await inventoryResponse.json();
  assert.equal(inventoryResponse.status, 200);
  assert.ok(inventoryPayload.economyTraceView.traceItems.length >= 1);
  assert.doesNotMatch(
    JSON.stringify(inventoryPayload.economyTraceView),
    /"assetLedger":|"resourceLedger":|"inventoryLedger":|"tradeLedger":|"delegatedTaskLedger":|"evidenceRefs":|"hiddenDossier":|"privateSignalTags":|"rawLedger":|sk-[A-Za-z0-9_-]{6,}/
  );
  const movable = inventoryPayload.inventoryView.items.find((item) => item.transferPolicy === "tradeable");
  assert.ok(movable);
  const destination = inventoryPayload.inventoryView.containers.find((container) => container.containerId !== movable.containerId);
  assert.ok(destination);

  const transferResponse = await fetch(`${server.baseUrl}/api/game/inventory-transfer/${worldState.sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      itemId: movable.itemId,
      toContainerId: destination.containerId
    })
  });
  const transferPayload = await transferResponse.json();
  assert.equal(transferResponse.status, 200);
  assert.equal(transferPayload.accepted, true);
  assert.ok(transferPayload.economyTraceView.traceItems.length >= 1);
  assert.doesNotMatch(JSON.stringify(transferPayload.economyTraceView), /"evidenceRefs":|"hiddenDossier":|"privateSignalTags":|"rawLedger":|sk-[A-Za-z0-9_-]{6,}/);

  const tradeResponse = await fetch(`${server.baseUrl}/api/game/trade/${worldState.sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      npcId: "npc:magistrate:gentry-han",
      tradeId: "trade:test:paper",
      silverDelta: 0,
      offerSummary: "议买纸张与粮价消息。"
    })
  });
  const tradePayload = await tradeResponse.json();
  assert.equal(tradeResponse.status, 200);
  assert.equal(tradePayload.tradeRecord.tradeId, "trade:test:paper");
  assert.ok(tradePayload.economyTraceView.traceItems.some((item) => item.traceType === "trade_negotiation"));
  assert.doesNotMatch(
    JSON.stringify(tradePayload.economyTraceView),
    /"assetLedger":|"resourceLedger":|"inventoryLedger":|"tradeLedger":|"delegatedTaskLedger":|"evidenceRefs":|"hiddenDossier":|"privateSignalTags":|"rawLedger":|sqlite|SQLite|SQL|sk-[A-Za-z0-9_-]{6,}/
  );

  const socialResponse = await fetch(`${server.baseUrl}/api/game/npc-interaction/${worldState.sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      npcId: "npc:magistrate:bailiff-zhou",
      actionType: "duel",
      utterance: "只作公事切磋，不许伤人。",
      winner: "player",
      injury: "npc_injured",
      resourceDelta: { silver: 1000 }
    })
  });
  const socialPayload = await socialResponse.json();
  assert.equal(socialResponse.status, 200);
  assert.equal(socialPayload.npcActionResolutionView.serverStatus, "server_adjudicated");
  assert.equal(socialPayload.npcActionResolutionView.resolverTrace.resolver, "npc_relationship_action_resolver");
  assert.equal(socialPayload.npcActionResolutionView.resourceImpactView.applied, false);
  assert.equal(socialPayload.npcActionResolutionView.worldPeopleImpactView.applied, false);
  assert.ok(socialPayload.npcActionResolutionView.ignoredClientResultFields.includes("winner"));
  assert.equal(socialPayload.npcInteractionView.items[0].resolverTrace.resolver, "npc_relationship_action_resolver");
  assert.ok(socialPayload.npcInteractionView.items[0].outcomeSummary);
  assert.equal(socialPayload.actorMemory.appliedCount, 1);
  assert.ok(
    socialPayload.actorMemoryView.actors.some((actor) =>
      actor.memories.some((memory) => memory.sourceType === "npc_relationship_action_trace")
    )
  );
  assert.ok(socialPayload.eventArchiveView.counts.npc_relationship_action >= 1);
  assert.ok(socialPayload.eventArchiveView.counts.actor_memory >= 1);
  assert.doesNotMatch(
    JSON.stringify(socialPayload),
    /"hiddenDossier":|"privateSignalTags":|"trueAssets":|"secretRelationships":|"rawProviderPayload":|"providerPayload":|"rawLedger":|"resourceDelta":|sk-[A-Za-z0-9_-]{6,}/
  );

  const playerStateResponse = await fetch(`${server.baseUrl}/api/game/player-state/${worldState.sessionId}`);
  const playerStatePayload = await playerStateResponse.json();
  const serialized = JSON.stringify(playerStatePayload);
  assert.equal(playerStateResponse.status, 200);
  assert.ok(playerStatePayload.inventoryView.items.length > 0);
  assert.ok(playerStatePayload.npcRosterView.items.length > 0);
  assert.ok(playerStatePayload.delegatedTaskView.items.length > 0);
  assert.ok(playerStatePayload.npcActiveRequestView);
  assert.ok(playerStatePayload.economyTraceView.traceItems.length >= 1);
  assert.doesNotMatch(JSON.stringify(playerStatePayload.economyTraceView), /"evidenceRefs":|"hiddenDossier":|"privateSignalTags":|"rawLedger":|sk-[A-Za-z0-9_-]{6,}/);
  assert.doesNotMatch(
    serialized,
    /"hiddenDossier":|"privateSignalTags":|"trueAssets":|"secretRelationships":|"npcActiveRequestLedger":|"rawProviderPayload":|"providerPayload":|"rawLedger":|sk-[A-Za-z0-9_-]{6,}/
  );
});

test("S85.3 turn route schedules and resolves NPC active requests through safe views", async (t) => {
  const worldState = createInitialState({
    role: "magistrate",
    playerName: "主动来函知县"
  });
  await writeSession(worldState);
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  const server = createTestServer();
  t.after(server.close);

  const firstResponse = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "照常清查县署田册。"
    })
  });
  const firstPayload = await firstResponse.json();
  assert.equal(firstResponse.status, 200);
  assert.ok(firstPayload.npcActiveRequestView.items.length >= 1);
  assert.ok(firstPayload.npcActiveRequestEvents.length >= 1);
  assert.equal(firstPayload.worldState.npcActiveRequestLedger, undefined);
  assert.doesNotMatch(
    JSON.stringify(firstPayload),
    /求财|避祸|亲族压力|可能欺瞒|求名|护短|畏上|重义/
  );

  const secondResponse = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "先查证来意，再决定是否采纳。"
    })
  });
  const secondPayload = await secondResponse.json();
  const serialized = JSON.stringify(secondPayload);
  assert.equal(secondResponse.status, 200);
  assert.ok(secondPayload.npcActiveRequests.outcome.resolved >= 1);
  assert.ok(secondPayload.npcActiveRequests.outcome.resolutionTraces.some((trace) => trace.resolver === "npc_active_request_resolver"));
  assert.ok(secondPayload.npcActiveRequestView.items.some((item) => item.outcome));
  assert.doesNotMatch(
    serialized,
    /"npcActiveRequestLedger":|"hiddenDossier":|"privateSignalTags":|"rawProviderPayload":|sk-[A-Za-z0-9_-]{6,}/
  );
  assert.doesNotMatch(serialized, /求财|避祸|亲族压力|可能欺瞒|求名|护短|畏上|重义/);
});

test("S88.7 turn route records NPC active request follow-up resolutions without raw ledger leaks", async (t) => {
  const worldState = createInitialState({
    role: "magistrate",
    playerName: "来函续办路由"
  });
  await writeSession(worldState);
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  const server = createTestServer();
  t.after(server.close);

  await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "照常清查县署田册。"
    })
  });
  const resolvedResponse = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "先查证来意，再决定是否采纳。"
    })
  });
  const resolvedPayload = await resolvedResponse.json();
  const task = resolvedPayload.npcActiveRequestView.followUpTasks[0];
  assert.equal(resolvedResponse.status, 200);
  assert.ok(task);

  const followUpResponse = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: task.draftText
    })
  });
  const followUpPayload = await followUpResponse.json();
  const serialized = JSON.stringify(followUpPayload);
  assert.equal(followUpResponse.status, 200);
  assert.equal(followUpPayload.npcActiveRequests.outcome.followUpResolved, 1);
  assert.equal(
    followUpPayload.npcActiveRequests.outcome.followUpResolutions[0].resolver,
    "npc_active_request_follow_up_resolver"
  );
  assert.equal(
    followUpPayload.npcActiveRequests.outcome.followUpResolutions[0].boundaries.noRealTaskCreated,
    true
  );
  assert.ok(followUpPayload.npcActiveRequestView.followUpTasks.some((entry) => entry.latestResolution));
  assert.ok(
    followUpPayload.actorMemoryView.actors.some((actor) =>
      actor.memories.some((memory) => memory.sourceType === "npc_active_request_follow_up")
    )
  );
  assert.ok(followUpPayload.eventArchiveView.counts.npc_active_request >= 1);
  assert.ok(
    followUpPayload.worldThreadView.activeThreads.some((thread) =>
      thread.sourceType === "active_npc_request" && /后续|服务器|廉政|watchlist/.test(thread.summary)
    )
  );
  assert.equal(followUpPayload.worldState.npcActiveRequestLedger, undefined);
  assert.doesNotMatch(
    serialized,
    /"npcActiveRequestLedger":|"hiddenDossier":|"privateSignalTags":|"rawProviderPayload":|"providerPayload":|"rawLedger":|"resourcesApplied":true|"marriageWritten":true|"hiddenTruthChanged":true|sk-[A-Za-z0-9_-]{6,}/
  );

  const saved = await readSession(worldState.sessionId);
  assert.ok(
    saved.npcActiveRequestLedger.activeRequests.some((entry) =>
      Array.isArray(entry.outcome?.followUpResolutions) &&
      entry.outcome.followUpResolutions.some((resolution) =>
        resolution.resolver === "npc_active_request_follow_up_resolver"
      )
    )
  );
});
