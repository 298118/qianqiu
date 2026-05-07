const { randomUUID } = require("crypto");

function previewText(value, maxLength = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEqualJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function providerAuditName(provider) {
  return String(provider?.auditName || provider?.name || process.env.AI_PROVIDER || "mock")
    .trim()
    .toLowerCase() || "mock";
}

function baseAuditFields(worldState, sceneCadence = "ordinary_turn") {
  return {
    turnCount: worldState?.turnCount ?? null,
    year: worldState?.year ?? null,
    month: worldState?.month ?? null,
    tenDayPeriod: worldState?.tenDayPeriod ?? null,
    sceneCadence
  };
}

function createAuditEvent(worldState, overrides = {}) {
  return {
    eventId: overrides.eventId || randomUUID(),
    ...baseAuditFields(worldState, overrides.sceneCadence),
    sourceSystem: overrides.sourceSystem || "server",
    eventType: overrides.eventType || "state_change",
    visibility: overrides.visibility || "developer",
    summary: overrides.summary || overrides.eventType || "state_change",
    related: overrides.related || {},
    appliedChanges: overrides.appliedChanges || {}
  };
}

function enqueueAuditRecords(context, records = {}) {
  if (!context) return;
  for (const event of records.auditEvents || []) {
    if (typeof context.appendAuditEvent === "function") context.appendAuditEvent(event);
    else if (Array.isArray(context.auditEvents)) context.auditEvents.push(event);
  }
  for (const proposal of records.aiProposals || []) {
    if (typeof context.appendAiProposal === "function") context.appendAiProposal(proposal);
    else if (Array.isArray(context.aiProposals)) context.aiProposals.push(proposal);
  }
}

function listProposedPatchPaths(statePatch = {}) {
  if (!isPlainObject(statePatch)) return [];
  const paths = [];
  for (const key of Object.keys(statePatch)) {
    if (key === "player" && isPlainObject(statePatch.player)) {
      for (const playerKey of Object.keys(statePatch.player)) paths.push(`player.${playerKey}`);
    } else if (key === "factions" && isPlainObject(statePatch.factions)) {
      for (const factionKey of Object.keys(statePatch.factions)) paths.push(`factions.${factionKey}`);
    } else {
      paths.push(key);
    }
  }
  return paths;
}

function diffProviderAcceptedState(before = {}, after = {}, statePatch = {}) {
  if (!isPlainObject(statePatch)) return {};
  const delta = {};
  const acceptedPaths = new Set();
  const serverSideEffectPaths = new Set(["turnCount"]);

  for (const key of Object.keys(statePatch)) {
    if (key === "player" || key === "factions") continue;
    if (serverSideEffectPaths.has(key)) continue;
    if (!isEqualJson(before?.[key], after?.[key])) {
      delta[key] = { before: cloneJson(before?.[key]), after: cloneJson(after?.[key]) };
      acceptedPaths.add(key);
    }
  }

  if (isPlainObject(statePatch.player)) {
    for (const key of Object.keys(statePatch.player)) {
      if (!isEqualJson(before?.player?.[key], after?.player?.[key])) {
        delta.player = delta.player || {};
        delta.player[key] = {
          before: cloneJson(before?.player?.[key]),
          after: cloneJson(after?.player?.[key])
        };
        acceptedPaths.add(`player.${key}`);
      }
    }
  }

  if (isPlainObject(statePatch.factions)) {
    for (const key of Object.keys(statePatch.factions)) {
      if (!isEqualJson(before?.factions?.[key], after?.factions?.[key])) {
        delta.factions = delta.factions || {};
        delta.factions[key] = {
          before: cloneJson(before?.factions?.[key]),
          after: cloneJson(after?.factions?.[key])
        };
        acceptedPaths.add(`factions.${key}`);
      }
    }
  }

  return { delta, acceptedPaths };
}

function hasAcceptedStateDelta(delta) {
  if (!isPlainObject(delta)) return false;
  return Object.keys(delta).some((key) => {
    if (key !== "player" && key !== "factions") return true;
    return isPlainObject(delta[key]) && Object.keys(delta[key]).length > 0;
  });
}

function buildRejectedReasons(result = {}, acceptedPaths = new Set(), relationshipChanges = [], examTrigger = {}) {
  const reasons = [];
  for (const path of listProposedPatchPaths(result.statePatch).slice(0, 20)) {
    if (!acceptedPaths.has(path)) {
      reasons.push(`statePatch.${path} 未通过服务器边界或未产生有效变化。`);
    }
  }

  const proposedRelationshipCount = Array.isArray(result.relationshipChanges)
    ? result.relationshipChanges.length
    : 0;
  if (proposedRelationshipCount > relationshipChanges.length) {
    reasons.push(`关系建议 ${proposedRelationshipCount} 条，服务器实际应用 ${relationshipChanges.length} 条。`);
  }

  if (result.examTrigger?.shouldStart === true && !examTrigger.shouldStart) {
    reasons.push(`考试触发请求被拒绝：${examTrigger.reason || "服务器门槛未通过"}。`);
  }

  return reasons;
}

function proposalStatus({ accepted, rejectedReasons, hasProposal }) {
  if (!hasProposal) return "recorded";
  if (accepted && rejectedReasons.length) return "partially_accepted";
  if (accepted) return "accepted";
  if (rejectedReasons.length) return "rejected";
  return "recorded";
}

function buildTurnProposalRecord({
  worldState,
  provider,
  result,
  input,
  providerStateBefore,
  providerStateAfter,
  relationshipChanges,
  examTrigger,
  appliedEventIds
}) {
  const { delta, acceptedPaths } = diffProviderAcceptedState(
    providerStateBefore,
    providerStateAfter,
    result.statePatch
  );
  const rejectedReasons = buildRejectedReasons(result, acceptedPaths, relationshipChanges, examTrigger);
  const eventCount = Array.isArray(result.events) ? result.events.length : 0;
  const accepted = {
    stateDelta: delta,
    relationshipChangeCount: Array.isArray(relationshipChanges) ? relationshipChanges.length : 0,
    eventCount,
    examTrigger
  };
  const acceptedSomething = hasAcceptedStateDelta(delta) ||
    accepted.relationshipChangeCount > 0 ||
    eventCount > 0 ||
    Boolean(examTrigger?.shouldStart);
  const hasProposal = Boolean(
    result.narrative ||
    result.statePatch ||
    eventCount ||
    (Array.isArray(result.relationshipChanges) && result.relationshipChanges.length) ||
    result.examTrigger?.shouldStart
  );

  return {
    ...baseAuditFields(worldState, "ordinary_turn"),
    provider: providerAuditName(provider),
    promptPack: "world_turn",
    proposalKind: "turn",
    status: proposalStatus({ accepted: acceptedSomething, rejectedReasons, hasProposal }),
    proposal: {
      playerInputPreview: previewText(input, 120),
      narrativePreview: previewText(result.narrative),
      statePatch: cloneJson(result.statePatch || {}),
      attributeChangeCount: Array.isArray(result.attributeChanges) ? result.attributeChanges.length : 0,
      eventCount,
      eventsPreview: (result.events || []).slice(0, 3),
      relationshipChangeCount: Array.isArray(result.relationshipChanges)
        ? result.relationshipChanges.length
        : 0,
      examTrigger: cloneJson(result.examTrigger || { shouldStart: false })
    },
    accepted,
    rejectedReasons,
    appliedEventIds
  };
}

function buildFeedbackEvent(worldState, sourceSystem, eventType, feedback = {}, sceneCadence = "ordinary_turn") {
  const events = Array.isArray(feedback.events) ? feedback.events : [];
  const summary = previewText(feedback.summary || events[0] || "");
  if (!summary && !events.length && !feedback.outcome) return null;
  return createAuditEvent(worldState, {
    sceneCadence,
    sourceSystem,
    eventType,
    visibility: "developer",
    summary: summary || eventType,
    related: {
      eventCount: events.length,
      eventsPreview: events.slice(0, 3)
    },
    appliedChanges: {
      attributeChangeCount: Array.isArray(feedback.attributeChanges) ? feedback.attributeChanges.length : 0,
      outcome: feedback.outcome || null
    }
  });
}

function createTurnAuditRecords({
  worldState,
  provider,
  result,
  input,
  providerStateBefore,
  providerStateAfter,
  relationshipChanges,
  examTrigger,
  activeNpcRequest,
  roleWorldCoupling,
  worldTick,
  longTermEvents,
  officialCareer,
  worldEntityImpacts
}) {
  const providerEvent = createAuditEvent(worldState, {
    sourceSystem: "ai_provider",
    eventType: "provider_turn_applied",
    visibility: "developer",
    summary: "AI 回合提案已由服务器边界处理。",
    related: {
      playerInputPreview: previewText(input, 120),
      provider: providerAuditName(provider)
    },
    appliedChanges: {
      providerEventCount: Array.isArray(result.events) ? result.events.length : 0,
      relationshipChangeCount: Array.isArray(relationshipChanges) ? relationshipChanges.length : 0,
      examTrigger
    }
  });
  const visibleTurnEvent = createAuditEvent(worldState, {
    sourceSystem: "game_turn",
    eventType: "turn_completed",
    visibility: "public",
    summary: previewText((result.events || [])[0] || result.narrative || "玩家行动已结算。"),
    related: {
      eventHistoryCount: Array.isArray(worldState.eventHistory) ? worldState.eventHistory.length : 0
    },
    appliedChanges: {
      turnCount: worldState.turnCount,
      worldEntityImpactCount: Array.isArray(worldEntityImpacts) ? worldEntityImpacts.length : 0
    }
  });
  const feedbackEvents = [
    buildFeedbackEvent(worldState, "active_npc_request", "active_request_step", activeNpcRequest),
    buildFeedbackEvent(worldState, "role_world_coupling", "role_world_coupling_step", roleWorldCoupling),
    buildFeedbackEvent(worldState, "world_tick", "world_tick_step", worldTick),
    buildFeedbackEvent(worldState, "long_term_events", "long_term_event_step", longTermEvents),
    buildFeedbackEvent(worldState, "official_career", "official_career_step", officialCareer)
  ].filter(Boolean);
  const auditEvents = [providerEvent, visibleTurnEvent, ...feedbackEvents];

  return {
    auditEvents,
    aiProposals: [
      buildTurnProposalRecord({
        worldState,
        provider,
        result,
        input,
        providerStateBefore,
        providerStateAfter,
        relationshipChanges,
        examTrigger,
        appliedEventIds: auditEvents.map((event) => event.eventId)
      })
    ]
  };
}

function createOpeningAuditRecords(worldState, opening, provider) {
  const event = createAuditEvent(worldState, {
    sourceSystem: "game_start",
    eventType: "session_started",
    visibility: "public",
    summary: previewText((opening.events || [])[0] || opening.narrative || "新局开篇已生成。"),
    related: {
      openingEventCount: Array.isArray(opening.events) ? opening.events.length : 0
    }
  });
  return {
    auditEvents: [event],
    aiProposals: [{
      ...baseAuditFields(worldState, "opening"),
      provider: providerAuditName(provider),
      promptPack: "opening",
      proposalKind: "opening",
      status: "accepted",
      proposal: {
        narrativePreview: previewText(opening.narrative),
        eventCount: Array.isArray(opening.events) ? opening.events.length : 0,
        eventsPreview: (opening.events || []).slice(0, 3)
      },
      accepted: {
        eventCount: Array.isArray(opening.events) ? opening.events.length : 0
      },
      rejectedReasons: [],
      appliedEventIds: [event.eventId]
    }]
  };
}

function createExamQuestionAuditRecords(worldState, question, exam, provider, preparationResult = null) {
  const event = createAuditEvent(worldState, {
    sceneCadence: "exam_question",
    sourceSystem: "exam_question",
    eventType: "exam_question_generated",
    visibility: "public",
    summary: `${worldState.player?.name || "玩家"}领取${exam.name}题。`,
    related: {
      examLevel: exam.level,
      examName: exam.name,
      preparationEventCount: Array.isArray(preparationResult?.events) ? preparationResult.events.length : 0
    },
    appliedChanges: {
      activeExamStatus: worldState.activeExam?.status || "writing"
    }
  });
  return {
    auditEvents: [event],
    aiProposals: [{
      ...baseAuditFields(worldState, "exam_question"),
      provider: providerAuditName(provider),
      promptPack: "exam_question",
      proposalKind: "exam_question",
      status: "accepted",
      proposal: {
        examLevel: exam.level,
        examName: question.examName || exam.name,
        questionPreview: previewText(question.examQuestion),
        questionType: question.questionType || exam.questionType,
        difficulty: question.difficulty || exam.difficulty
      },
      accepted: {
        examId: worldState.activeExam?.examId,
        questionType: worldState.activeExam?.questionType,
        passScore: worldState.activeExam?.passScore,
        promotionRank: worldState.activeExam?.promotionRank
      },
      rejectedReasons: [],
      appliedEventIds: [event.eventId]
    }]
  };
}

function createExamProgressAuditRecords(worldState, scene) {
  return {
    auditEvents: [createAuditEvent(worldState, {
      sceneCadence: "exam_scene",
      sourceSystem: "exam_scene",
      eventType: "exam_scene_progressed",
      visibility: "public",
      summary: previewText(scene.narrative || scene.event || "考试场景已推进。"),
      related: {
        phase: scene.sceneTime?.phase || null,
        phaseLabel: scene.sceneTime?.phaseLabel || null
      },
      appliedChanges: {
        sceneTurnCount: scene.sceneTime?.turnCount ?? null,
        sceneElapsedHours: scene.sceneTime?.elapsedHours ?? null
      }
    })],
    aiProposals: []
  };
}

function createExamGradeAuditRecords({
  worldState,
  activeExam,
  grade,
  score,
  authenticityCheck,
  promotionResult,
  cohortResult,
  ranking,
  provider
}) {
  const event = createAuditEvent(worldState, {
    sceneCadence: "exam_submit",
    sourceSystem: "exam_submit",
    eventType: "exam_submitted",
    visibility: "public",
    summary: `${worldState.player?.name || "玩家"}交${activeExam.examName}卷，服务器完成评分、榜单与晋级裁决。`,
    related: {
      examLevel: activeExam.level,
      examName: activeExam.examName,
      rankingSize: Array.isArray(ranking) ? ranking.length : 0
    },
    appliedChanges: {
      finalScore: score?.overall_score ?? null,
      passed: Boolean(promotionResult?.passed),
      promotionRank: promotionResult?.rank || null,
      cohortRecorded: Boolean(cohortResult)
    }
  });
  const modelScore = grade?.score?.overall_score ?? null;
  const rejectedReasons = [];
  if (modelScore !== null && modelScore !== score?.overall_score) {
    rejectedReasons.push("本地反作弊与考试规则覆盖了模型原始总分。");
  }
  if (grade?.promotionResult || grade?.ranking || grade?.virtualCandidates) {
    rejectedReasons.push("模型不得决定榜单、虚拟考生或最终晋级；服务器已重新裁决。");
  }

  return {
    auditEvents: [event],
    aiProposals: [{
      ...baseAuditFields(worldState, "exam_submit"),
      provider: providerAuditName(provider),
      promptPack: "exam_grading",
      proposalKind: "exam_grade",
      status: rejectedReasons.length ? "partially_accepted" : "accepted",
      proposal: {
        modelOverallScore: modelScore,
        modelRank: grade?.score?.rank || null,
        feedbackPreview: previewText(grade?.score?.detailed_feedback),
        authenticityObservation: grade?.authenticityObservation || null
      },
      accepted: {
        finalScore: score?.overall_score ?? null,
        authenticityCheck,
        passed: Boolean(promotionResult?.passed),
        promotionRank: promotionResult?.rank || null
      },
      rejectedReasons,
      appliedEventIds: [event.eventId]
    }]
  };
}

module.exports = {
  createExamGradeAuditRecords,
  createExamProgressAuditRecords,
  createExamQuestionAuditRecords,
  createOpeningAuditRecords,
  createTurnAuditRecords,
  enqueueAuditRecords,
  providerAuditName
};
