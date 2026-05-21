const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { createTurnAuditRecords } = require("../src/game/audit");
const { applyRelationshipChanges } = require("../src/game/relationships");
const { runNpcActiveRequestStep } = require("../src/game/npcActiveRequests");
const { recordNpcInteraction } = require("../src/game/npcInteractions");
const { resolveNpcRelationshipAction } = require("../src/game/npcRelationshipActions");
const {
  applyActorMemoryUpdate,
  applyExamNetworkMemoryUpdates,
  applyTurnActorMemoryUpdates,
  buildActorMemoryView,
  decayActorMemoryLedger,
  proposeActorMemoryUpdate,
  summarizeActorMemoryForPrompt
} = require("../src/game/actorMemoryLedger");

test("S70.12 actor memory proposals are server-normalized, deduped, and reinforced", () => {
  const worldState = createInitialState({ playerName: "记忆测试" });
  const proposed = proposeActorMemoryUpdate("npc:C01", {
    type: "favor",
    visibility: "player_visible",
    summary: "顾文衡记得玩家替他整理县学旧卷。",
    salience: 80,
    confidence: 0.81,
    sourceType: "ai_memory_proposal",
    sourceLabel: "本旬互动",
    tags: ["人情"]
  }, { worldState });

  assert.equal(proposed.accepted, true);
  const first = applyActorMemoryUpdate(worldState, proposed.memoryUpdate);
  const second = applyActorMemoryUpdate(worldState, proposed.memoryUpdate);

  assert.equal(first.applied, true);
  assert.equal(second.applied, true);
  assert.equal(second.deduped, true);

  const view = buildActorMemoryView(worldState, "npc:C01");
  assert.equal(view.actors.length, 1);
  assert.equal(view.actors[0].memories.length, 1);
  assert.equal(view.actors[0].memories[0].type, "favor");
  assert.equal(view.actors[0].memories[0].reinforcementCount, 2);
  assert.match(JSON.stringify(summarizeActorMemoryForPrompt(worldState)), /顾文衡记得玩家/);
});

test("S70.12 memory proposals reject private visibility aliases and unknown provider actors", () => {
  const worldState = createInitialState({ playerName: "越权记忆" });
  for (const visibility of ["actor-private", "actor private", "server-hidden", "gm only"]) {
    const proposed = proposeActorMemoryUpdate("npc:C01", {
      type: "impression",
      visibility,
      summary: "顾文衡有一条不应公开的私密印象。"
    }, { worldState });
    assert.equal(proposed.accepted, false, visibility);
    assert.ok(proposed.rejectedReasons.includes("private_or_hidden_memory_requires_redacted_api"));
  }

  const result = applyTurnActorMemoryUpdates(worldState, {
    providerMemoryProposals: [{
      actorId: "npc:invented-hidden-ish",
      type: "fact",
      visibility: "player_visible",
      summary: "伪造人物记得一件并不存在的旧事。"
    }]
  });

  assert.equal(result.appliedCount, 0);
  assert.doesNotMatch(JSON.stringify(buildActorMemoryView(worldState)), /invented-hidden-ish|并不存在的旧事/);
});

test("S70.12 provider memory proposals cannot spoof server source attribution", () => {
  const worldState = createInitialState({ playerName: "归因测试" });
  const result = applyTurnActorMemoryUpdates(worldState, {
    providerMemoryProposals: [{
      actorId: "npc:C01",
      type: "fact",
      visibility: "player_visible",
      summary: "顾文衡记得玩家在讲席上补出一条出处。",
      sourceType: "monthly_briefing",
      sourceLabel: "伪装月报"
    }]
  });

  assert.equal(result.appliedCount, 1);
  assert.equal(result.rejectedCount, 0);
  const memory = buildActorMemoryView(worldState, "npc:C01").actors[0].memories[0];
  assert.equal(memory.sourceType, "ai_memory_proposal");
  assert.equal(memory.sourceLabel, "伪装月报");
});

test("S70.12 rejected memory proposals surface only hidden-safe audit telemetry", () => {
  const worldState = createInitialState({ playerName: "拒绝审计" });
  const memoryProposals = [{
    actorId: "npc:C01",
    type: "fact",
    visibility: "player_visible",
    summary: "顾文衡 hidden notes 中有一条不应入账的内容。"
  }, {
    actorId: "npc:invented-audit-target",
    type: "fact",
    visibility: "player_visible",
    summary: "伪造人物记得一条服务器不可确认的旧事。"
  }];
  const result = applyTurnActorMemoryUpdates(worldState, { providerMemoryProposals: memoryProposals });

  assert.equal(result.appliedCount, 0);
  assert.equal(result.rejectedCount, 2);
  assert.ok(result.rejectedReasons.includes("unsafe_or_empty_summary"));
  assert.ok(result.rejectedReasons.includes("unknown_or_invisible_actor"));
  assert.doesNotMatch(JSON.stringify(result), /hidden notes|服务器不可确认的旧事/);

  const audit = createTurnAuditRecords({
    worldState,
    provider: { auditName: "mock" },
    result: {
      narrative: "",
      statePatch: {},
      events: [],
      relationshipChanges: [],
      memoryProposals
    },
    input: "检查记忆拒绝",
    providerStateBefore: worldState,
    providerStateAfter: worldState,
    relationshipChanges: [],
    examTrigger: { shouldStart: false },
    activeNpcRequest: null,
    teacherFeedbackProposal: null,
    studyInteraction: null,
    roleWorldCoupling: null,
    worldTick: null,
    longTermEvents: null,
    officialCareer: null,
    playerMonthlyBriefing: null,
    actorMemory: {
      summary: "本旬拒绝2条越权或不可见记忆提案。",
      events: [],
      attributeChanges: [],
      outcome: {
        appliedCount: 0,
        reinforcedCount: 0,
        rejectedCount: result.rejectedCount,
        rejectedReasons: result.rejectedReasons
      }
    },
    sessionSummary: null,
    worldEntityImpacts: []
  });
  const actorMemoryEvent = audit.auditEvents.find((event) => event.eventType === "actor_memory_step");
  const proposal = audit.aiProposals[0];

  assert.equal(actorMemoryEvent.appliedChanges.outcome.rejectedCount, 2);
  assert.ok(proposal.rejectedReasons.some((reason) => reason.includes("记忆提案 2 条被服务器拒绝")));
  assert.doesNotMatch(JSON.stringify(audit), /hidden notes|服务器不可确认的旧事|invented-audit-target/);
});

test("S70.12 remote provider memory rejections are counted without raw proposal text", () => {
  const worldState = createInitialState({ playerName: "远程拒绝" });
  const result = applyTurnActorMemoryUpdates(worldState, {
    providerMemoryProposalRejections: [{
      reason: "private_or_hidden_memory_requires_redacted_api",
      count: 2
    }, {
      reason: "invalid_memory_type",
      count: 1
    }]
  });

  assert.equal(result.appliedCount, 0);
  assert.equal(result.rejectedCount, 3);
  assert.deepEqual(result.rejectedReasons, [
    "private_or_hidden_memory_requires_redacted_apix2",
    "invalid_memory_type"
  ]);
  assert.doesNotMatch(JSON.stringify(result), /暗藏|hidden notes|server-hidden/);
});

test("S70.12 actor memory text rejects hidden note and Chinese private archive variants", () => {
  const worldState = createInitialState({ playerName: "密档过滤" });
  for (const summary of [
    "顾文衡 hidden notes 里记下一条玩家不可见私评。",
    "顾文衡 hidden intent 显示一条玩家不可见谋算。",
    "顾文衡密档里藏有一条玩家不可见记录。",
    "顾文衡私档里藏有隐藏意图。"
  ]) {
    const proposed = proposeActorMemoryUpdate("npc:C01", {
      type: "impression",
      visibility: "player_visible",
      summary
    }, { worldState });
    assert.equal(proposed.accepted, false, summary);
    assert.ok(proposed.rejectedReasons.includes("unsafe_or_empty_summary"));
  }
});

test("S70.12 relationship changes create favor and grievance memories", () => {
  const worldState = createInitialState({ playerName: "恩怨测试" });
  const favorChanges = applyRelationshipChanges(worldState, [{
    targetType: "character",
    targetId: "C01",
    relationshipDelta: 5,
    resentmentDelta: -1,
    reason: "玩家代塾师修补书箱。"
  }]);
  const favorResult = applyTurnActorMemoryUpdates(worldState, { relationshipChanges: favorChanges });
  assert.equal(favorResult.appliedCount, 1);

  const grievanceChanges = applyRelationshipChanges(worldState, [{
    targetType: "character",
    targetId: "C01",
    relationshipDelta: -4,
    resentmentDelta: 6,
    reason: "玩家当众顶撞塾师。"
  }]);
  const grievanceResult = applyTurnActorMemoryUpdates(worldState, { relationshipChanges: grievanceChanges });
  assert.equal(grievanceResult.appliedCount, 1);

  const serialized = JSON.stringify(buildActorMemoryView(worldState, "npc:C01"));
  assert.match(serialized, /favor|grievance/);
  assert.match(serialized, /修补书箱|顶撞塾师/);
});

test("S88.7 NPC active request resolver traces create visible memories through server projection", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "来函记忆" });
  worldState.turnCount = 1;

  const scheduled = runNpcActiveRequestStep(worldState, "照常清查田册", { forceType: "bribe" });
  const resolved = runNpcActiveRequestStep(worldState, "先呈报廉政线索", { responseAction: "report" });
  const result = applyTurnActorMemoryUpdates(worldState, { npcActiveRequests: resolved });
  const view = buildActorMemoryView(worldState);
  const serialized = JSON.stringify({ result, view });

  assert.equal(scheduled.outcome.scheduled, 1);
  assert.equal(resolved.outcome.resolved, 1);
  assert.equal(result.appliedCount, 1);
  assert.match(serialized, /npc_active_request_trace/);
  assert.match(serialized, /服务器裁决|NPC来函|廉政|线索/);
  assert.doesNotMatch(
    serialized,
    /hiddenDossier|privateSignalTags|providerPayload|rawProvider|world_sessions|safe_search|sk-[A-Za-z0-9_-]{6,}/
  );
});

test("S88.7 NPC active request trace memory rejects forged invisible NPC refs", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "伪造来函记忆" });
  const result = applyTurnActorMemoryUpdates(worldState, {
    npcActiveRequests: {
      outcome: {
        resolutionTraces: [{
          resolver: "npc_active_request_resolver",
          publicResolutionRef: "npc-active-resolution:forged:1",
          typeLabel: "来函",
          status: "under_review",
          responseAction: "accept",
          publicSourceRefs: ["npcRosterView:npc:invented-hidden-target"]
        }]
      }
    }
  });

  assert.equal(result.appliedCount, 0);
  assert.ok(result.rejectedReasons.includes("unknown_or_invisible_actor"));
  assert.doesNotMatch(JSON.stringify(buildActorMemoryView(worldState)), /invented-hidden-target|npc_active_request_trace/);
});

test("S88.7 NPC relationship action traces create immediate visible memories from safe records", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "交游记忆" });
  worldState.turnCount = 3;
  const request = {
    npcId: "npc:magistrate:bailiff-zhou",
    actionType: "duel",
    utterance: "只作公事切磋，不许伤人。",
    winner: "player",
    resourceDelta: { silver: 9999 }
  };
  const relationshipAction = resolveNpcRelationshipAction(worldState, request, {
    dialogueText: "周快手抱拳应诺。"
  });
  const recorded = recordNpcInteraction(worldState, request, {
    dialogueText: "周快手抱拳应诺。",
    mood: "谨慎"
  }, {
    resolutionView: relationshipAction.resolutionView
  });
  const result = applyTurnActorMemoryUpdates(worldState, {
    npcInteractionRecords: [recorded.record]
  });
  const view = buildActorMemoryView(worldState);
  const serialized = JSON.stringify({ result, view });

  assert.equal(relationshipAction.ok, true);
  assert.equal(recorded.record.resolverTrace.resolver, "npc_relationship_action_resolver");
  assert.equal(result.appliedCount, 1);
  assert.match(serialized, /npc_relationship_action_trace/);
  assert.match(serialized, /周快手|切磋|服务器裁决/);
  assert.match(serialized, /npcInteractionView|npcRelationshipActionResolverTrace/);
  assert.doesNotMatch(
    serialized,
    /hiddenDossier|privateSignalTags|providerPayload|rawProvider|world_sessions|resourceDelta|winner|sk-[A-Za-z0-9_-]{6,}/
  );
});

test("S88.7 NPC relationship action trace memory rejects forged invisible records", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "伪造交游记忆" });
  const forgedRecord = {
    recordId: "npc-interaction:forged",
    npcId: "npc:invented-hidden-target",
    npcName: "伪造人物",
    actionType: "debate",
    outcomeSummary: "伪造人物试图借交游入账。",
    serverAdjudication: {
      status: "server_adjudicated",
      actionLabel: "论道"
    },
    resolverTrace: {
      resolver: "npc_relationship_action_resolver",
      publicResolutionRef: "npc-relationship-resolution:forged:debate:1",
      actionType: "debate",
      actionLabel: "论道",
      status: "server_adjudicated",
      publicSourceRefs: ["npcRosterView:npc:invented-hidden-target"]
    }
  };
  worldState.npcInteractionLedger = { records: [forgedRecord] };
  const result = applyTurnActorMemoryUpdates(worldState, {
    npcInteractionRecords: [forgedRecord]
  });

  assert.equal(result.appliedCount, 0);
  assert.ok(result.rejectedReasons.includes("unknown_or_invisible_actor"));
  assert.doesNotMatch(JSON.stringify(buildActorMemoryView(worldState)), /invented-hidden-target|npc_relationship_action_trace/);
});

test("S88.7 NPC relationship action trace memory requires a matching interaction ledger record", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "伪造可见交游" });
  const result = applyTurnActorMemoryUpdates(worldState, {
    npcInteractionRecords: [{
      recordId: "npc-interaction:not-in-ledger",
      npcId: "C01",
      npcName: "顾文衡",
      actionType: "debate",
      outcomeSummary: "伪造的论道记录试图直接写入记忆。",
      serverAdjudication: {
        status: "server_adjudicated",
        actionLabel: "论道"
      },
      resolverTrace: {
        resolver: "npc_relationship_action_resolver",
        publicResolutionRef: "npc-relationship-resolution:C01:debate:9",
        actionType: "debate",
        actionLabel: "论道",
        status: "server_adjudicated",
        publicSourceRefs: ["npcRosterView:C01"]
      }
    }]
  });

  assert.equal(result.appliedCount, 0);
  assert.doesNotMatch(JSON.stringify(buildActorMemoryView(worldState)), /npc_relationship_action_trace|伪造的论道记录/);
});

test("S88.7 NPC relationship action trace memory uses canonical ledger records after ref match", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "交游防伪" });
  const request = {
    npcId: "npc:magistrate:bailiff-zhou",
    actionType: "duel",
    utterance: "仍作公事切磋。"
  };
  const relationshipAction = resolveNpcRelationshipAction(worldState, request, {
    dialogueText: "周快手点头。"
  });
  const recorded = recordNpcInteraction(worldState, request, {
    dialogueText: "周快手点头。",
    mood: "谨慎"
  }, {
    resolutionView: relationshipAction.resolutionView
  });
  const tamperedRecord = {
    ...recorded.record,
    outcomeSummary: "同 ID 伪造摘要进入记忆。",
    serverAdjudication: {
      ...recorded.record.serverAdjudication,
      actionLabel: "伪造交游"
    }
  };
  const result = applyTurnActorMemoryUpdates(worldState, {
    npcInteractionRecords: [tamperedRecord]
  });
  const serialized = JSON.stringify(buildActorMemoryView(worldState));

  assert.equal(result.appliedCount, 1);
  assert.match(serialized, /切磋只登记为待复核武艺较量/);
  assert.doesNotMatch(serialized, /同 ID 伪造摘要进入记忆|伪造交游/);
});

test("S70.12 exam network creates durable same-year and seat-teacher memories", () => {
  const worldState = createInitialState({ playerName: "科场记忆" });
  worldState.characters.push(
    { id: "exam-peer-provincial-001", name: "同年甲", role: "同年", skill: 55, loyalty: 50, ambition: 45 },
    { id: "exam-seat-provincial", name: "冯主考", role: "座师", skill: 70, loyalty: 55, ambition: 40 }
  );
  const result = applyExamNetworkMemoryUpdates(worldState, {
    examName: "乡试",
    sameYearContacts: [{
      id: "exam-peer-provincial-001",
      name: "同年甲",
      relationKind: "same_year",
      stance: "同年声援"
    }],
    examinerContacts: [{
      id: "exam-seat-provincial",
      name: "冯主考",
      relationKind: "seat_teacher",
      role: "乡试主考座师",
      stance: "座师门生"
    }]
  });

  assert.equal(result.appliedCount, 2);
  const view = buildActorMemoryView(worldState);
  const serialized = JSON.stringify(view);
  assert.match(serialized, /同年甲|冯主考/);
  assert.match(serialized, /同年|座师/);
  assert.match(JSON.stringify(summarizeActorMemoryForPrompt(worldState)), /exam_network/);
});

test("S70.12 actor memory decays low-salience rows and keeps important rows", () => {
  const worldState = createInitialState({ playerName: "衰减测试" });
  applyActorMemoryUpdate(worldState, proposeActorMemoryUpdate("npc:C01", {
    type: "impression",
    visibility: "player_visible",
    summary: "顾文衡只略记一次寻常问候。",
    salience: 7,
    decayRate: 3
  }, { worldState }).memoryUpdate);
  applyActorMemoryUpdate(worldState, proposeActorMemoryUpdate("npc:C01", {
    type: "grievance",
    visibility: "player_visible",
    summary: "顾文衡记得玩家曾失约不至。",
    salience: 72,
    decayRate: 1
  }, { worldState }).memoryUpdate);

  const decay = decayActorMemoryLedger(worldState, { months: 1 });
  assert.equal(decay.decayed >= 1, true);
  assert.equal(decay.removed, 1);
  const serialized = JSON.stringify(buildActorMemoryView(worldState, "npc:C01"));
  assert.doesNotMatch(serialized, /寻常问候/);
  assert.match(serialized, /失约不至/);
});
