const {
  COURT_DEBATE_PARTICIPANTS,
  EXAM_REVIEW_PARTICIPANTS,
  INSTITUTION_SCENE_LIMITS,
  INSTITUTION_SCENE_PROPOSAL_TYPES,
  INSTITUTION_SCENE_SCHEMA_VERSION,
  INSTITUTION_SCENE_TYPES
} = require("./institutionSceneConfig");
const {
  buildOfficeAiActorProfile,
  summarizeAiActorProfileForPrompt
} = require("./aiActorProfiles");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { summarizeEconomicFiscalForPrompt } = require("./economicFiscal");
const { summarizeMilitaryDiplomacyForPrompt } = require("./militaryDiplomacy");
const { summarizeExamProcedureForPrompt } = require("./examProcedure");
const { summarizeExaminerPanelForPrompt } = require("./examReview");
const { summarizeExamHonorsForPrompt } = require("./examHonors");
const { summarizeExamNetworkForPrompt } = require("./examNetworks");
const { summarizeAppointmentTrackForPrompt } = require("./appointmentTracks");

const SENSITIVE_INSTITUTION_SCENE_TEXT_PATTERN = /(hiddenNotes|hiddenIntent|raw[_ -]?(?:provider|audit|table|ledger|prompt)|\b(?:provider|prompt|proposal|source|path|key|hidden|raw)\b|server\.[A-Za-z0-9_.:-]+|retrievalContext|statePatch|worldState|prompt_retrieval_index|event_archive_index|world_sessions|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|SQL|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:\\[^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "", maxLength = INSTITUTION_SCENE_LIMITS.maxTextLength) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || SENSITIVE_INSTITUTION_SCENE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanTextList(values, limit = 6, maxLength = 120) {
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, "", maxLength);
    if (!text || result.includes(text)) continue;
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function cleanAuthorityBoundary(value, fallback) {
  return cleanText(value, fallback, 180);
}

function normalizeProposalType(value, fallback = "defer_to_resolver") {
  const text = cleanText(value, "", 48);
  if (INSTITUTION_SCENE_PROPOSAL_TYPES.includes(text)) return text;
  return INSTITUTION_SCENE_PROPOSAL_TYPES.includes(fallback) ? fallback : "defer_to_resolver";
}

function currentSceneDate(worldState = {}) {
  return {
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month: clampNumber(worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1),
    turnCount: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function sceneLocalTime(worldState = {}, roundIndex = 0, maxRounds = INSTITUTION_SCENE_LIMITS.maxRounds) {
  return {
    cadence: "scene",
    roundIndex: clampNumber(roundIndex, 0, 99, 0),
    maxRounds: clampNumber(maxRounds, 1, 9, INSTITUTION_SCENE_LIMITS.maxRounds),
    globalDate: currentSceneDate(worldState),
    globalTimeAdvanced: false,
    authorityBoundary: "制度场景只推进局部轮次，不推进全局年月旬或回合。"
  };
}

function safeActorSummary(actorProfile = {}) {
  const summary = summarizeAiActorProfileForPrompt(actorProfile);
  if (!summary) return null;
  return {
    actorId: cleanText(summary.actorId, "", 96),
    actorType: cleanText(summary.actorType, "", 48),
    authorityTier: cleanText(summary.authorityTier, "", 8),
    role: cleanText(summary.role, "", 80),
    allowedToolGroups: cleanTextList(summary.allowedToolGroups, 12, 64),
    visibilityDomains: cleanTextList(summary.visibilityDomains, 12, 64),
    currentGoals: cleanTextList(summary.currentGoals, 5, 120),
    boundaryStatement: cleanText(summary.boundaryStatement, "", 180)
  };
}

function buildParticipant(worldState, preset, index) {
  const actorProfile = buildOfficeAiActorProfile(worldState, preset.officeRef, {
    actorType: preset.actorType,
    allowUnknown: true
  });
  const actor = safeActorSummary(actorProfile);
  const participantRole = cleanId(preset.participantRole, `participant-${index + 1}`);
  return {
    participantId: `${participantRole}:${index + 1}`,
    participantRole,
    roleLabel: cleanText(preset.roleLabel, "制度参与者", 80),
    actor,
    defaultProposalType: normalizeProposalType(preset.defaultProposalType),
    authorityBoundary: cleanText(
      actor?.boundaryStatement,
      "制度参与者只能提交待裁决意见；服务器决定是否采纳和落地。",
      180
    )
  };
}

function selectDomainOfficePreset(topic = "") {
  const text = cleanText(topic, "", 160);
  if (/边|军|饷|战|兵/.test(text)) {
    return {
      participantRole: "domain_office",
      actorType: "general",
      officeRef: "ministry_war_principal",
      roleLabel: "兵部边务",
      defaultProposalType: "frontier_warning"
    };
  }
  if (/刑|案|狱|盗|审/.test(text)) {
    return {
      participantRole: "domain_office",
      actorType: "minister",
      officeRef: "ministry_justice_principal",
      roleLabel: "刑部案牍",
      defaultProposalType: "policy_review"
    };
  }
  if (/河|工|堤|修|漕/.test(text)) {
    return {
      participantRole: "domain_office",
      actorType: "minister",
      officeRef: "ministry_works_principal",
      roleLabel: "工部营缮",
      defaultProposalType: "policy_review"
    };
  }
  return COURT_DEBATE_PARTICIPANTS.find((preset) => preset.participantRole === "domain_office");
}

function courtParticipantPresets(topic) {
  return COURT_DEBATE_PARTICIPANTS.map((preset) =>
    preset.participantRole === "domain_office" ? selectDomainOfficePreset(topic) : preset
  );
}

function compactOfficialContext(worldState = {}) {
  const view = buildOfficialPostingsView(worldState);
  return {
    bureaus: (view.bureaus || []).slice(0, INSTITUTION_SCENE_LIMITS.maxContextItems).map((bureau) => ({
      id: cleanId(bureau.id, ""),
      name: cleanText(bureau.name, "", 80),
      summary: cleanText(bureau.summary, "", 160)
    })),
    postings: (view.postings || []).slice(0, INSTITUTION_SCENE_LIMITS.maxContextItems).map((posting) => ({
      id: cleanId(posting.id, ""),
      officeTitle: cleanText(posting.officeTitle, "", 80),
      bureauId: cleanId(posting.bureauId, ""),
      publicSummary: cleanText(posting.publicSummary, "", 160)
    })),
    assessments: (view.assessmentRecords || []).slice(0, 3).map((record) => ({
      id: cleanId(record.id, ""),
      publicSummary: cleanText(record.publicSummary, "", 160)
    }))
  };
}

function compactDockets(worldState = {}) {
  const view = buildLocalAffairsDocketView(worldState);
  return (view.dockets || []).slice(0, INSTITUTION_SCENE_LIMITS.maxContextItems).map((docket) => ({
    id: cleanId(docket.id, ""),
    domain: cleanText(docket.domain, "", 48),
    title: cleanText(docket.title, "", 96),
    severity: clampNumber(docket.severity, 0, 9, 0),
    publicSummary: cleanText(docket.publicSummary, "", 160),
    authorityBoundary: cleanText(docket.authorityBoundary, "", 180)
  }));
}

function compactReports(summary = {}, limit = INSTITUTION_SCENE_LIMITS.maxContextItems) {
  return (summary?.reports || []).slice(0, limit).map((report) => ({
    id: cleanId(report.id, ""),
    type: cleanText(report.type, "", 48),
    title: cleanText(report.title, "", 96),
    publicSummary: cleanText(report.publicSummary, "", 160),
    authorityBoundary: cleanText(report.authorityBoundary, "", 180)
  }));
}

function compactLabeledItems(items = [], limit = 3) {
  return asArray(items).slice(0, limit).map((item) => {
    const source = isPlainObject(item) ? item : {};
    return {
      type: cleanText(source.type, "", 48),
      label: cleanText(source.label, "", 64),
      severity: cleanText(source.severity, "", 32),
      publicSummary: cleanText(source.publicSummary, "", 160)
    };
  }).filter((item) => item.label || item.publicSummary);
}

function compactRollLifecycle(rollLifecycle = {}) {
  if (!isPlainObject(rollLifecycle)) return null;
  return {
    draftRoll: rollLifecycle.draftRoll === true,
    inkRoll: rollLifecycle.inkRoll === true,
    sealed: rollLifecycle.sealed === true,
    transcribed: rollLifecycle.transcribed === true,
    collated: rollLifecycle.collated === true,
    audited: rollLifecycle.audited === true,
    publicSummary: cleanText(rollLifecycle.publicSummary, "卷件流程只显示公开摘要。", 160)
  };
}

function compactExaminerPanelSummary(summary = {}) {
  if (!isPlainObject(summary)) return null;
  return {
    schemaVersion: clampNumber(summary.schemaVersion, 1, 999, 1),
    level: cleanText(summary.level, "", 48),
    roomReviews: asArray(summary.roomReviews).slice(0, 4).map((review) => {
      const source = isPlainObject(review) ? review : {};
      return {
        actor: cleanText(source.actor, "examiner", 40),
        label: cleanText(source.label, "阅卷建议", 64),
        recommendation: cleanText(source.recommendation, "建议复核", 64),
        concern: cleanText(source.concern, "", 96),
        accepted: source.accepted === true
      };
    }),
    scoreInputs: asArray(summary.scoreInputs).slice(0, 4).map((input) => {
      const source = isPlainObject(input) ? input : {};
      return {
        label: cleanText(source.label, "定分输入", 64),
        score: source.score === null || source.score === undefined
          ? null
          : clampNumber(source.score, 0, 100, 0),
        scoreDelta: source.scoreDelta === undefined ? 0 : clampNumber(source.scoreDelta, -20, 20, 0),
        publicSummary: cleanText(source.publicSummary, "服务器整理的公开定分摘要。", 160)
      };
    }),
    incidents: compactLabeledItems(summary.incidents, 3),
    auditFlags: compactLabeledItems(summary.auditFlags, 3),
    disputeSummary: cleanText(summary.disputeSummary, "", 160),
    serverDecision: cleanText(summary.serverDecision, "", 160),
    authorityBoundary: cleanAuthorityBoundary(
      summary.authorityBoundary,
      "阅卷摘要只供制度场景评议；定榜、晋级、处分和官职仍由服务器裁决。"
    )
  };
}

function compactExamProcedureSummary(summary = {}) {
  if (!isPlainObject(summary)) return null;
  return {
    schemaVersion: clampNumber(summary.schemaVersion, 1, 999, 1),
    level: cleanText(summary.level, "", 48),
    phase: cleanText(summary.phase, "", 48),
    phaseLabel: cleanText(summary.phaseLabel, "", 64),
    subStageLabel: cleanText(summary.subStageLabel, "", 64),
    sessionIndex: clampNumber(summary.sessionIndex, 1, 9, 1),
    sessionCount: clampNumber(summary.sessionCount, 1, 9, 1),
    paperType: cleanText(summary.paperType, "", 64),
    sponsorshipStatus: cleanText(summary.sponsorshipStatus, "", 48),
    entrySearchStatus: cleanText(summary.entrySearchStatus, "", 48),
    rollLifecycle: compactRollLifecycle(summary.rollLifecycle),
    incidents: compactLabeledItems(summary.incidents, 3),
    auditFlags: compactLabeledItems(summary.auditFlags, 3),
    examinerPanel: compactExaminerPanelSummary(summary.examinerPanel),
    authorityBoundary: cleanAuthorityBoundary(
      summary.authorityBoundary,
      "科场流程只供制度场景评议；准考、定榜、晋级、处分和官职仍由服务器裁决。"
    )
  };
}

function compactExamHonorsSummary(summary = {}) {
  if (!isPlainObject(summary)) return null;
  return {
    schemaVersion: clampNumber(summary.schemaVersion, 1, 999, 1),
    honors: asArray(summary.honors).slice(0, 4).map((honor) => {
      const source = isPlainObject(honor) ? honor : {};
      return {
        level: cleanText(source.level, "", 48),
        title: cleanText(source.title, "", 64),
        place: source.place === null || source.place === undefined
          ? null
          : clampNumber(source.place, 1, 10000, 1),
        rankLabel: cleanText(source.rankLabel, "", 64),
        palaceRank: cleanText(source.palaceRank, "", 48),
        year: source.year === null || source.year === undefined
          ? null
          : clampNumber(source.year, 1, 9999, 1644)
      };
    }),
    currentAchievement: isPlainObject(summary.currentAchievement)
      ? {
        title: cleanText(summary.currentAchievement.title, "", 64),
        type: cleanText(summary.currentAchievement.type, "", 48),
        year: clampNumber(summary.currentAchievement.year, 1, 9999, 1644),
        relatedTitles: cleanTextList(summary.currentAchievement.relatedTitles, 4, 64)
      }
      : null,
    publicSummary: cleanText(summary.publicSummary, "科名荣誉尚无公开记录。", 160),
    authorityBoundary: cleanAuthorityBoundary(
      summary.authorityBoundary,
      "科名荣誉只读公开摘要；名次、甲第、授官和持久化仍由服务器裁决。"
    )
  };
}

function compactExamNetworkSummary(summary = {}) {
  if (!isPlainObject(summary)) return null;
  return {
    schemaVersion: clampNumber(summary.schemaVersion, 1, 999, 1),
    level: cleanText(summary.level, "", 48),
    examName: cleanText(summary.examName, "", 80),
    sameYearContacts: asArray(summary.sameYearContacts).slice(0, 3).map((contact) => {
      const source = isPlainObject(contact) ? contact : {};
      return {
        id: cleanId(source.id, ""),
        name: cleanText(source.name, "", 64),
        role: cleanText(source.role, "", 64),
        stance: cleanText(source.stance, "", 48),
        relationship: cleanText(source.relationship, "", 48),
        publicSummary: cleanText(source.publicSummary, "", 160)
      };
    }),
    examinerContacts: asArray(summary.examinerContacts).slice(0, 3).map((contact) => {
      const source = isPlainObject(contact) ? contact : {};
      return {
        id: cleanId(source.id, ""),
        name: cleanText(source.name, "", 64),
        role: cleanText(source.role, "", 64),
        relationKind: cleanText(source.relationKind, "", 48),
        stance: cleanText(source.stance, "", 48),
        publicSummary: cleanText(source.publicSummary, "", 160)
      };
    }),
    publicSummary: cleanText(summary.publicSummary, "科场关系尚无公开摘要。", 160),
    authorityBoundary: cleanAuthorityBoundary(
      summary.authorityBoundary,
      "同年和座师关系只读公开摘要；关系账本和隐藏映射仍由服务器裁决。"
    )
  };
}

function compactAppointmentTrackSummary(summary = {}) {
  if (!isPlainObject(summary)) return null;
  return {
    schemaVersion: clampNumber(summary.schemaVersion, 1, 999, 1),
    records: asArray(summary.records).slice(0, 3).map((record) => {
      const source = isPlainObject(record) ? record : {};
      return {
        level: cleanText(source.level, "", 48),
        examName: cleanText(source.examName, "", 80),
        palaceRank: cleanText(source.palaceRank, "", 48),
        palacePlace: source.palacePlace === null || source.palacePlace === undefined
          ? null
          : clampNumber(source.palacePlace, 1, 10000, 1),
        classPlace: source.classPlace === null || source.classPlace === undefined
          ? null
          : clampNumber(source.classPlace, 1, 10000, 1),
        honorTitle: cleanText(source.honorTitle, "", 64),
        decision: isPlainObject(source.decision)
          ? {
            trackLabel: cleanText(source.decision.trackLabel, "", 64),
            officeTitle: cleanText(source.decision.officeTitle, "", 64),
            bureauId: cleanId(source.decision.bureauId, "")
          }
          : null,
        avoidanceChecks: asArray(source.avoidanceChecks).slice(0, 3).map((check) => {
          const checkSource = isPlainObject(check) ? check : {};
          return {
            officeTitle: cleanText(checkSource.officeTitle, "", 64),
            status: cleanText(checkSource.status, "", 48),
            publicSummary: cleanText(checkSource.publicSummary, "", 160)
          };
        })
      };
    }),
    latestDecision: isPlainObject(summary.latestDecision)
      ? {
        trackLabel: cleanText(summary.latestDecision.trackLabel, "", 64),
        officeTitle: cleanText(summary.latestDecision.officeTitle, "", 64),
        bureauId: cleanId(summary.latestDecision.bureauId, "")
      }
      : null,
    publicSummary: cleanText(summary.publicSummary, "授官轨迹尚无记录。", 160),
    authorityBoundary: cleanAuthorityBoundary(
      summary.authorityBoundary,
      "授官轨迹只读公开摘要；官缺、回避、任命和持久化仍由服务器裁决。"
    )
  };
}

function buildCourtContext(worldState = {}, topic = "", options = {}) {
  return {
    topic: cleanText(topic, "待议事项", 120),
    docketRefs: compactDockets(worldState),
    officialRefs: compactOfficialContext(worldState),
    fiscalReports: compactReports(summarizeEconomicFiscalForPrompt(worldState), 3),
    militaryReports: compactReports(summarizeMilitaryDiplomacyForPrompt(worldState), 3),
    playerRole: cleanText(worldState.player?.role, "", 40),
    safety: {
      contextKind: "制度场景公开上下文",
      authority: "朝议只能形成意见、弹章、奏议或待裁决信号；任免、刑赏、战和、财政结算和持久化仍归服务器 resolver。"
    },
    note: cleanText(options.note, "", 160)
  };
}

function buildExamContext(worldState = {}, examContext = {}) {
  const activeExam = worldState.activeExam || {};
  return {
    level: cleanText(examContext.level || activeExam.level, "", 48),
    examName: cleanText(examContext.examName || activeExam.examName, "科场评议", 80),
    phase: cleanText(examContext.phase || activeExam.scenePhase || activeExam.sceneTime?.phase, "", 48),
    questionType: cleanText(examContext.questionType || activeExam.questionType, "", 80),
    scoreSummary: cleanText(examContext.scoreSummary, "", 160),
    essayExcerpt: cleanText(examContext.essayExcerpt, "", 160),
    procedure: compactExamProcedureSummary(summarizeExamProcedureForPrompt(worldState)),
    examinerPanel: compactExaminerPanelSummary(summarizeExaminerPanelForPrompt(examContext.examinerPanel || worldState.examinerPanelView)),
    honors: compactExamHonorsSummary(summarizeExamHonorsForPrompt(worldState)),
    network: compactExamNetworkSummary(summarizeExamNetworkForPrompt(worldState)),
    appointmentTrack: compactAppointmentTrackSummary(summarizeAppointmentTrackForPrompt(worldState)),
    safety: {
      contextKind: "科场公开上下文",
      authority: "科场评议只能提出阅卷意见、复核疑点或流程建议；canonical ranking、晋级、作弊处分、关系和授官仍归服务器。"
    }
  };
}

function createSceneId(sceneType, worldState, seed = "") {
  const date = currentSceneDate(worldState);
  const text = cleanId(seed, "scene");
  return `${sceneType}:${date.turnCount}:${text}`;
}

function createInstitutionScene(sceneType, worldState = {}, title = "", participants = [], context = {}, options = {}) {
  const maxRounds = clampNumber(options.maxRounds, 1, 9, INSTITUTION_SCENE_LIMITS.maxRounds);
  return {
    schemaVersion: INSTITUTION_SCENE_SCHEMA_VERSION,
    sceneId: createSceneId(sceneType, worldState, title),
    sceneType,
    title: cleanText(title, sceneType === INSTITUTION_SCENE_TYPES.examReview ? "科场评议" : "朝议待议事项", 120),
    status: "open",
    sceneLocalTime: sceneLocalTime(worldState, 0, maxRounds),
    participants: participants.slice(0, INSTITUTION_SCENE_LIMITS.maxParticipants),
    context,
    proposalBudget: {
      maxRounds,
      maxProposalsPerRound: INSTITUTION_SCENE_LIMITS.maxProposalsPerRound,
      maxEvidenceRefs: INSTITUTION_SCENE_LIMITS.maxEvidenceRefs
    },
    authorityBoundary: sceneType === INSTITUTION_SCENE_TYPES.examReview
      ? "科场多 actor 只提出评议意见；服务器拥有晋级、定榜、处分和持久化。"
      : "朝议多 actor 只提出奏议、弹章和御前信号；服务器拥有执行链、反噬、状态和持久化。"
  };
}

function createCourtDebateScene(worldState = {}, topic = "", options = {}) {
  const safeTopic = cleanText(topic, "待议事项", 120);
  const participants = courtParticipantPresets(safeTopic)
    .map((preset, index) => buildParticipant(worldState, preset, index));
  return createInstitutionScene(
    INSTITUTION_SCENE_TYPES.courtDebate,
    worldState,
    safeTopic,
    participants,
    buildCourtContext(worldState, safeTopic, options),
    options
  );
}

function createExamReviewScene(worldState = {}, examContext = {}, options = {}) {
  const context = buildExamContext(worldState, examContext);
  const participants = EXAM_REVIEW_PARTICIPANTS
    .map((preset, index) => buildParticipant(worldState, preset, index));
  return createInstitutionScene(
    INSTITUTION_SCENE_TYPES.examReview,
    worldState,
    context.examName || "科场评议",
    participants,
    context,
    options
  );
}

function proposalSummaryForParticipant(scene = {}, participant = {}) {
  const topic = cleanText(scene.context?.topic || scene.title, "此事", 80);
  if (scene.sceneType === INSTITUTION_SCENE_TYPES.examReview) {
    if (participant.participantRole === "audit_critic") {
      return `${participant.roleLabel}请先列明卷面疑点，处分仍候服务器复核。`;
    }
    return `${participant.roleLabel}只就${scene.context?.examName || "本场"}提出评议，不定榜。`;
  }
  if (participant.participantRole === "emperor") {
    return `御前命群臣就${topic}具议，暂不直接下诏落地。`;
  }
  if (participant.participantRole === "censor") {
    return `${participant.roleLabel}请核${topic}是否有失法度或侵扰民生。`;
  }
  return `${participant.roleLabel}就${topic}提出待裁决意见。`;
}

function buildHeuristicInstitutionProposal(scene = {}, participant = {}) {
  return sanitizeInstitutionProposal({
    sceneId: scene.sceneId,
    participantId: participant.participantId,
    actorId: participant.actor?.actorId,
    proposalType: participant.defaultProposalType,
    publicPosition: proposalSummaryForParticipant(scene, participant),
    evidenceRefs: [
      scene.sceneType,
      ...(scene.context?.docketRefs || []).map((docket) => docket.id),
      scene.context?.procedure?.phase ? `exam_phase:${scene.context.procedure.phase}` : ""
    ],
    visibleEffects: [
      scene.sceneType === INSTITUTION_SCENE_TYPES.examReview
        ? "形成科场评议候选，交服务器定序与处分。"
        : "形成朝议意见候选，交服务器执行链裁决。"
    ],
    confidence: 0.62
  }, {
    sceneId: scene.sceneId,
    participantId: participant.participantId,
    actorId: participant.actor?.actorId
  });
}

function sanitizeInstitutionProposal(proposal = {}, constraints = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const sceneId = cleanId(constraints.sceneId || source.sceneId, "institution-scene");
  const participantId = cleanText(constraints.participantId || source.participantId, "", 96);
  const actorId = cleanText(constraints.actorId || source.actorId, "", 96);
  const proposalType = normalizeProposalType(source.proposalType);
  return {
    schemaVersion: INSTITUTION_SCENE_SCHEMA_VERSION,
    proposalId: cleanId(source.proposalId, `${sceneId}:${participantId || "participant"}:${proposalType}`),
    sceneId,
    participantId,
    actorId,
    proposalType,
    publicPosition: cleanText(source.publicPosition, "制度场景意见候选。", 180),
    evidenceRefs: cleanTextList(source.evidenceRefs, INSTITUTION_SCENE_LIMITS.maxEvidenceRefs, 96),
    visibleEffects: cleanTextList(source.visibleEffects, INSTITUTION_SCENE_LIMITS.maxVisibleEffects, 140),
    riskTags: cleanTextList(source.riskTags, 6, 64),
    confidence: Math.max(0, Math.min(1, Number(source.confidence) || 0.5)),
    requestedToolName: "",
    privateResultRefs: [],
    toolCalls: [],
    accepted: false,
    authorityBoundary: "本意见只是制度场景提案；服务器裁决采纳、反噬、状态变化和持久化。"
  };
}

async function proposalForParticipant(scene, participant, aiRuntime, options = {}) {
  const constraints = {
    sceneId: scene.sceneId,
    participantId: participant.participantId,
    actorId: participant.actor?.actorId
  };
  if (options.allowAi === true && aiRuntime && typeof aiRuntime.generateInstitutionProposal === "function") {
    const proposal = await aiRuntime.generateInstitutionProposal(scene, participant, options);
    return sanitizeInstitutionProposal(proposal, constraints);
  }
  return buildHeuristicInstitutionProposal(scene, participant);
}

async function runInstitutionSceneRound(scene = {}, aiRuntime = null, options = {}) {
  const roundIndex = clampNumber(options.roundIndex, 1, 99, (scene.sceneLocalTime?.roundIndex || 0) + 1);
  const participants = (scene.participants || []).slice(0, INSTITUTION_SCENE_LIMITS.maxParticipants);
  const proposals = [];

  for (const participant of participants) {
    proposals.push(await proposalForParticipant(scene, participant, aiRuntime, options));
    if (proposals.length >= INSTITUTION_SCENE_LIMITS.maxProposalsPerRound) break;
  }

  return {
    schemaVersion: INSTITUTION_SCENE_SCHEMA_VERSION,
    sceneId: cleanId(scene.sceneId, "institution-scene"),
    sceneType: cleanText(scene.sceneType, "", 48),
    roundIndex,
    sceneLocalTime: {
      ...(scene.sceneLocalTime || {}),
      roundIndex,
      globalTimeAdvanced: false
    },
    transcript: proposals
      .map((proposal) => cleanText(proposal.publicPosition, "", 140))
      .filter(Boolean)
      .slice(0, INSTITUTION_SCENE_LIMITS.maxTranscriptLines),
    proposals,
    authorityBoundary: "本轮只收集多 actor 意见；不推进全局时间、不写库、不直接执行工具。"
  };
}

function collectInstitutionProposals(sceneRound = {}) {
  const sceneId = cleanId(sceneRound.sceneId, "institution-scene");
  return (Array.isArray(sceneRound.proposals) ? sceneRound.proposals : [])
    .map((proposal) => sanitizeInstitutionProposal(proposal, {
      sceneId,
      participantId: proposal?.participantId,
      actorId: proposal?.actorId
    }))
    .slice(0, INSTITUTION_SCENE_LIMITS.maxProposalsPerRound);
}

function participantById(scene = {}) {
  return new Map((Array.isArray(scene.participants) ? scene.participants : [])
    .map((participant) => [participant.participantId, participant]));
}

function sanitizeProposalForScene(scene = {}, proposal = {}) {
  const participants = participantById(scene);
  const participantId = cleanText(proposal?.participantId, "", 96);
  const participant = participants.get(participantId);
  if (!participant) return null;
  return sanitizeInstitutionProposal(proposal, {
    sceneId: scene.sceneId,
    participantId: participant.participantId,
    actorId: participant.actor?.actorId
  });
}

function resolveInstitutionSceneOutcome(worldState = {}, scene = {}, proposals = []) {
  const safeProposals = (Array.isArray(proposals) ? proposals : [])
    .map((proposal) => sanitizeProposalForScene(scene, proposal))
    .filter(Boolean)
    .slice(0, INSTITUTION_SCENE_LIMITS.maxProposalsPerRound);
  const sceneType = cleanText(scene.sceneType, INSTITUTION_SCENE_TYPES.courtDebate, 48);
  const acceptedForReview = safeProposals.filter((proposal) => proposal.publicPosition).length;
  const summary = sceneType === INSTITUTION_SCENE_TYPES.examReview
    ? `科场评议收束为${acceptedForReview}条待裁决意见；定榜、晋级和处分仍归服务器。`
    : `朝议收束为${acceptedForReview}条待裁决意见；诏令、任免、战和、财政和反噬仍归服务器。`;

  return {
    schemaVersion: INSTITUTION_SCENE_SCHEMA_VERSION,
    sceneId: cleanId(scene.sceneId, "institution-scene"),
    sceneType,
    status: "pending_server_resolution",
    publicSummary: cleanText(summary, "制度场景已收束为待裁决意见。"),
    proposalSummaries: safeProposals.map((proposal) => ({
      participantId: proposal.participantId,
      actorId: proposal.actorId,
      proposalType: proposal.proposalType,
      publicPosition: proposal.publicPosition,
      confidence: proposal.confidence
    })),
    visibleEvents: [],
    appliedWorldChanges: [],
    sceneLocalTime: {
      ...(scene.sceneLocalTime || sceneLocalTime(worldState)),
      globalTimeAdvanced: false
    },
    authorityBoundary: "制度场景 outcome 只是服务器 resolver 输入；本函数不写 worldState、SQLite、审计表或全局时间。"
  };
}

module.exports = {
  collectInstitutionProposals,
  createCourtDebateScene,
  createExamReviewScene,
  resolveInstitutionSceneOutcome,
  runInstitutionSceneRound,
  sanitizeInstitutionProposal
};
