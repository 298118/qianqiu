const { randomUUID } = require("node:crypto");

const {
  NPC_ACTIVE_REQUEST_CONFIG,
  NPC_ACTIVE_REQUEST_FOLLOW_UP_CONFIG,
  NPC_ACTIVE_REQUEST_FOLLOW_UP_SCHEMA_VERSION,
  NPC_ACTIVE_REQUEST_FOLLOW_UP_TASK_SCHEMA_VERSION,
  NPC_ACTIVE_REQUEST_RESPONSE_ACTION_CONFIG,
  NPC_ACTIVE_REQUEST_RESPONSE_ACTIONS,
  NPC_ACTIVE_REQUEST_SCHEMA_VERSION,
  NPC_ACTIVE_REQUEST_STATUS,
  NPC_ACTIVE_REQUEST_TYPE_CONFIG,
  NPC_ACTIVE_REQUEST_TYPES
} = require("./npcActiveRequestsConfig");
const {
  buildNpcDetailView,
  buildNpcPrivateSignalView,
  ensureNpcRoster,
  getNpcForServer
} = require("./npcRoster");
const { NPC_PRIVATE_SIGNAL_TAGS } = require("./npcRosterConfig");

const UNSAFE_TEXT_PATTERN =
  /(hidden[_ -]?(?:notes|intent|dossier)|private[_ -]?signal[_ -]?tags|true[_ -]?assets|secret[_ -]?relationships|unrevealed[_ -]?tasks|provider[_ -]?payload|raw[_ -]?(?:provider|audit|table|ledger|prompt|payload|state)|\b(?:provider|prompt|proposal)\b|retrieval[_ -]?context|state[_ -]?patch|world[_ -]?state|world_sessions|prompt_retrieval_index|event_archive_index|safe_search_index|safe_search_fts|ai_change_proposals|event_log|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sqlite|data[\\/](?:sessions|audit)|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;
const NPC_ACTIVE_REQUEST_RESOLVER_TRACE_VERSION = "s88.7-npc-active-request-resolver-trace.v1";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = NPC_ACTIVE_REQUEST_CONFIG.textMaxLength) {
  if (typeof value !== "string") return fallback;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || UNSAFE_TEXT_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function containsPrivateSignalText(value = "") {
  if (typeof value !== "string") return false;
  return NPC_PRIVATE_SIGNAL_TAGS.some((tag) => tag && value.includes(tag));
}

function cleanPublicText(value, fallback = "", maxLength = NPC_ACTIVE_REQUEST_CONFIG.textMaxLength) {
  const text = cleanText(value, fallback, maxLength);
  if (!text || containsPrivateSignalText(text)) return fallback;
  return text;
}

function sanitizePublicViewValue(value, maxLength = NPC_ACTIVE_REQUEST_CONFIG.textMaxLength) {
  if (typeof value === "string") return cleanPublicText(value, "", maxLength);
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizePublicViewValue(entry, maxLength))
      .filter((entry) => entry !== "" && entry !== null && entry !== undefined);
  }
  if (!isPlainObject(value)) return value;
  return Object.entries(value).reduce((publicValue, [key, entry]) => {
    if (containsPrivateSignalText(key) || UNSAFE_TEXT_PATTERN.test(key)) return publicValue;
    publicValue[key] = sanitizePublicViewValue(entry, maxLength);
    return publicValue;
  }, {});
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function currentDate(worldState = {}) {
  return {
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month: clampNumber(worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1),
    turn: currentTurn(worldState)
  };
}

function uniqueCleanList(values = [], limit = 8, maxLength = 80) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeRequestType(value, fallback = "help") {
  const type = cleanText(value, fallback, 48);
  return NPC_ACTIVE_REQUEST_TYPES.includes(type) ? type : fallback;
}

function normalizeResponseAction(value, fallback = "") {
  const action = cleanText(value, fallback, 48);
  return NPC_ACTIVE_REQUEST_RESPONSE_ACTIONS.includes(action) ? action : fallback;
}

function normalizeStatus(value, fallback = "active") {
  const status = cleanText(value, fallback, 56);
  return NPC_ACTIVE_REQUEST_STATUS.includes(status) ? status : fallback;
}

function createInitialNpcActiveRequestLedger(worldState = {}) {
  return {
    schemaVersion: NPC_ACTIVE_REQUEST_SCHEMA_VERSION,
    ownerActorId: cleanId(worldState.player?.id || "player", "player"),
    nextRequestNumber: 1,
    activeRequests: [],
    events: [],
    cooldowns: {}
  };
}

function ensureNpcActiveRequestLedgerState(worldState = {}) {
  if (
    !isPlainObject(worldState.npcActiveRequestLedger) ||
    worldState.npcActiveRequestLedger.schemaVersion !== NPC_ACTIVE_REQUEST_SCHEMA_VERSION
  ) {
    worldState.npcActiveRequestLedger = createInitialNpcActiveRequestLedger(worldState);
  }
  return worldState.npcActiveRequestLedger;
}

function sanitizeNpcPrivateIntentProposal(proposal = {}, constraints = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const expectedNpcId = cleanId(constraints.npcId, "");
  const npcId = cleanId(source.npcId, expectedNpcId);
  return {
    ok: Boolean(npcId && (!expectedNpcId || npcId === expectedNpcId)),
    npcId: expectedNpcId || npcId,
    requestType: normalizeRequestType(source.requestType, ""),
    intentSummary: cleanText(source.intentSummary, "", 180),
    proposalBoundary: cleanText(
      source.proposalBoundary,
      "本意图只作服务器裁决 proposal，不代表事实已经发生。",
      180
    ),
    requestedAction: cleanText(source.requestedAction, "", 140),
    targetRefs: uniqueCleanList(source.targetRefs, 4, 96),
    riskTags: uniqueCleanList(source.riskTags, NPC_ACTIVE_REQUEST_CONFIG.maxRiskTags, 40),
    suggestedInteractionHooks: uniqueCleanList(source.suggestedInteractionHooks, 4, 90),
    serverAdjudicationHint: cleanText(source.serverAdjudicationHint, "server_owned", 80),
    source: cleanText(source.source, "mock-ai", 32)
  };
}

function buildNpcPrivatePlannerContext(worldState = {}, npcIdOrNpc = {}) {
  ensureNpcRoster(worldState);
  const npcId = typeof npcIdOrNpc === "string" ? npcIdOrNpc : npcIdOrNpc?.npcId;
  const npc = getNpcForServer(worldState, npcId);
  if (!npc) return null;
  const npcDetailView = buildNpcDetailView(worldState, npc.npcId);
  const privateSignalView = buildNpcPrivateSignalView(worldState, npc.npcId);
  return {
    sessionId: cleanId(worldState.sessionId, ""),
    turnCount: currentTurn(worldState),
    date: currentDate(worldState),
    player: {
      role: cleanText(worldState.player?.role, "scholar", 40),
      name: cleanText(worldState.player?.name, "玩家", 40),
      officeTitle: cleanText(worldState.player?.officeTitle || worldState.player?.position, "", 60)
    },
    npcId: npc.npcId,
    npcDetailView,
    privateSignalTags: privateSignalView?.privateSignalTags || [],
    activeRequestLimits: {
      proposalOnly: true,
      allowedRequestTypes: NPC_ACTIVE_REQUEST_TYPES,
      serverOwnsResourcesRelationshipsMarriageAndDiscipline: true
    },
    serverBoundaries: [
      "AI 只能提出 NPC 主动意图 proposal，不能裁决资源、婚姻、弹劾、背叛、关系或任务结果。",
      "外部 provider 只能读取 privateSignalTags，不得读取 hiddenDossier、真实资产、秘密关系、本地路径、密钥或数据库行。"
    ]
  };
}

function npcScoreForType(npc = {}, typeConfig = {}) {
  const roleTags = new Set([...(npc.roleTags || []), ...(npc.stageTags || [])]);
  const signalTags = new Set(npc.privateSignalTags || []);
  let score = 0;
  for (const tag of typeConfig.preferredRoleTags || []) {
    if (roleTags.has(tag)) score += 3;
  }
  for (const tag of typeConfig.preferredSignalTags || []) {
    if (signalTags.has(tag)) score += 2;
  }
  score += clampNumber(npc.relationship?.closeness, -100, 100, 0) > 25 ? 1 : 0;
  score += clampNumber(npc.relationship?.hostility, 0, 100, 0) > 20 ? 1 : 0;
  return score;
}

function chooseNpcForRequestType(worldState = {}, requestType = "help") {
  const roster = ensureNpcRoster(worldState);
  const typeConfig = NPC_ACTIVE_REQUEST_TYPE_CONFIG[requestType] || NPC_ACTIVE_REQUEST_TYPE_CONFIG.help;
  const candidates = roster.npcs
    .filter((npc) => (npc.npcId && npc.tier !== "ambient") || requestType === "marriage_proposal")
    .map((npc) => ({ npc, score: npcScoreForType(npc, typeConfig) }))
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      return first.npc.npcId.localeCompare(second.npc.npcId);
    });
  return (candidates[0] || roster.npcs.map((npc) => ({ npc, score: 0 }))[0])?.npc || null;
}

function nextRequestType(ledger = {}, worldState = {}, options = {}) {
  const requested = normalizeRequestType(options.forceType || options.aiProposal?.requestType, "");
  if (requested) return requested;
  const sequence = NPC_ACTIVE_REQUEST_CONFIG.requestTypeSequence;
  const number = clampNumber(ledger.nextRequestNumber, 1, Number.MAX_SAFE_INTEGER, 1);
  return sequence[(number - 1 + currentTurn(worldState)) % sequence.length] || "help";
}

function requestCountByStatus(ledger = {}, statuses = ["active", "deferred", "under_review"]) {
  const statusSet = new Set(statuses);
  return (ledger.activeRequests || []).filter((request) => statusSet.has(request.status)).length;
}

function shouldScheduleRequest(worldState = {}, ledger = {}, options = {}) {
  if (options.force === true || options.forceType) return true;
  if (requestCountByStatus(ledger) >= NPC_ACTIVE_REQUEST_CONFIG.maxActiveRequests) return false;
  const turn = currentTurn(worldState);
  return turn % NPC_ACTIVE_REQUEST_CONFIG.scheduleEveryTurns === NPC_ACTIVE_REQUEST_CONFIG.scheduleTurnOffset;
}

function buildEvidenceRefs(npc = {}, requestType = "help", aiProposal = {}) {
  return uniqueCleanList([
    `npcRosterView:${npc.npcId}`,
    `npcDetailView:${npc.npcId}`,
    ...(aiProposal.targetRefs || [])
  ], NPC_ACTIVE_REQUEST_CONFIG.maxEvidenceRefs, 96)
    .filter((ref) => !containsPrivateSignalText(ref));
}

function responseActionConfig(responseAction = "") {
  return NPC_ACTIVE_REQUEST_RESPONSE_ACTION_CONFIG[responseAction] || null;
}

function followUpConfigFor(requestType = "help") {
  const type = normalizeRequestType(requestType, "help");
  return NPC_ACTIVE_REQUEST_FOLLOW_UP_CONFIG[type] || NPC_ACTIVE_REQUEST_FOLLOW_UP_CONFIG.help;
}

function fillResponseTemplate(template = "", request = {}) {
  const npcName = cleanPublicText(request.npcName, "来人", 40);
  const typeLabel = cleanPublicText(
    request.typeLabel,
    (NPC_ACTIVE_REQUEST_TYPE_CONFIG[normalizeRequestType(request.type, "help")] || NPC_ACTIVE_REQUEST_TYPE_CONFIG.help).label,
    40
  );
  return cleanPublicText(
    String(template || "")
      .replace(/\{npcName\}/g, npcName)
      .replace(/\{typeLabel\}/g, typeLabel),
    `回应${npcName}的${typeLabel}：先查证事实，后续由服务器裁决。`,
    180
  );
}

function fillFollowUpTaskTemplate(template = "", record = {}, followUp = {}) {
  const npcName = cleanPublicText(record.npc?.displayName, "来人", 40);
  const typeLabel = cleanPublicText(record.typeLabel || followUp.requestTypeLabel, "来函", 40);
  const nextStep = cleanPublicText(followUp.nextStep, "后续仍由服务器裁决。", 120);
  return cleanPublicText(
    String(template || "")
      .replace(/\{npcName\}/g, npcName)
      .replace(/\{typeLabel\}/g, typeLabel)
      .replace(/\{nextStep\}/g, nextStep),
    `续办${npcName}的${typeLabel}：${nextStep}`,
    180
  );
}

function buildResponseOptionsForRequest(request = {}) {
  const followUpConfig = followUpConfigFor(request.type);
  const preferred = Array.isArray(followUpConfig.preferredActions) ? followUpConfig.preferredActions : [];
  return preferred
    .filter((action) => NPC_ACTIVE_REQUEST_RESPONSE_ACTIONS.includes(action))
    .map((action) => {
      const config = responseActionConfig(action) || {};
      return {
        responseAction: action,
        label: cleanPublicText(config.label, action, 32),
        shortLabel: cleanPublicText(config.shortLabel, config.label || action, 20),
        draftText: fillResponseTemplate(config.draftTemplate, request),
        serverBoundary: "按钮只写行动草稿；来函后续、资源、关系、婚姻、弹劾、背叛和隐藏事实仍由普通回合服务器裁决。"
      };
    });
}

function isRequestResponseOpen(status = "") {
  const normalized = normalizeStatus(status, "");
  return normalized === "active" || normalized === "deferred";
}

function followUpTaskState(status = "", responseAction = "") {
  if (responseAction === "expire") return "closed_as_expired";
  if (status === "refused") return "closed_as_refused";
  if (status === "deferred") return "pending_player_response";
  if (["under_review", "reported", "converted_to_risk", "accepted_pending_server_resolution"].includes(status)) {
    return "pending_server_follow_up";
  }
  return "recorded";
}

function followUpTaskStatus(status = "", responseAction = "") {
  const normalizedStatus = normalizeStatus(status, "");
  const action = cleanId(responseAction, "");
  if (normalizedStatus === "reported" || action === "report") return "reported_for_review";
  if (normalizedStatus === "converted_to_risk") return "risk_watch";
  if (normalizedStatus === "under_review" || normalizedStatus === "accepted_pending_server_resolution") {
    return "pending_server_follow_up";
  }
  return "recorded";
}

function isFollowUpTaskOpen(status = "") {
  return [
    "under_review",
    "reported",
    "converted_to_risk",
    "accepted_pending_server_resolution"
  ].includes(normalizeStatus(status, ""));
}

function followUpNextStep(config = {}, responseAction = "", status = "") {
  const base = cleanPublicText(config.nextStep, "按公开证据进入普通回合或后续服务器规则复核。", 180);
  if (responseAction === "expire") return "来函已逾期，只保留公开关系与风险回响，不执行隐藏后果。";
  if (status === "refused") return "请求已拒绝，后续只按公开关系影响和普通回合行动重新推进。";
  if (responseAction === "report") return "线索已呈报或上交，后续只能由服务器按权限、证据和制度规则复核。";
  if (responseAction === "investigate") return "先查证身份、证据、契据、人物关系和管辖权限，再决定是否转入后续行动。";
  if (responseAction === "defer") return "已暂缓，不承诺资源或关系结果；若再回应，仍需普通回合服务器裁决。";
  return base;
}

function buildNpcActiveRequestFollowUpView(worldState = {}, request = {}, responseAction = "", outcome = {}, resolverTrace = {}) {
  const requestType = normalizeRequestType(request.type, "help");
  const config = followUpConfigFor(requestType);
  const status = normalizeStatus(outcome.status || request.status, "under_review");
  const actionConfig = responseActionConfig(responseAction) || {};
  const responseLabel = cleanPublicText(
    actionConfig.label,
    responseAction === "expire" ? "逾期" : responseAction || "回应",
    32
  );
  const resolutionRef = cleanId(resolverTrace.publicResolutionRef, "");
  return {
    schemaVersion: NPC_ACTIVE_REQUEST_FOLLOW_UP_SCHEMA_VERSION,
    requestId: cleanId(request.requestId, ""),
    requestType,
    requestTypeLabel: cleanPublicText(request.typeLabel, config.title, 40),
    responseAction: cleanPublicText(responseAction, "", 48),
    responseLabel,
    publicResolutionRef: resolutionRef,
    followUpKind: cleanPublicText(config.followUpKind, "active_request_follow_up", 80),
    title: cleanPublicText(config.title, "来函后续复核", 80),
    publicSummary: cleanPublicText(config.publicSummary, "来函后续只保留为公开待裁线索。", 180),
    disposition: cleanPublicText(resolverTrace.disposition, "server_follow_up", 80),
    taskState: followUpTaskState(status, responseAction),
    nextStep: followUpNextStep(config, responseAction, status),
    recommendedResponseOptions: buildResponseOptionsForRequest(request),
    evidenceRefs: uniqueCleanList([
      ...(Array.isArray(request.evidenceRefs) ? request.evidenceRefs : []),
      ...(Array.isArray(resolverTrace.publicSourceRefs) ? resolverTrace.publicSourceRefs : []),
      resolutionRef ? `npcActiveRequestResolverTrace:${resolutionRef}` : ""
    ], NPC_ACTIVE_REQUEST_CONFIG.maxEvidenceRefs, 120).filter((ref) => !containsPrivateSignalText(ref)),
    riskTags: uniqueCleanList([
      ...(Array.isArray(config.riskTags) ? config.riskTags : []),
      ...(Array.isArray(request.riskTags) ? request.riskTags : []),
      ...(Array.isArray(resolverTrace.riskTags) ? resolverTrace.riskTags : [])
    ], NPC_ACTIVE_REQUEST_CONFIG.maxRiskTags, 40).filter((tag) => !containsPrivateSignalText(tag)),
    boundaries: {
      serverOwnsFollowUp: true,
      proposalOnly: true,
      resourcesNotApplied: true,
      relationshipNotFinal: true,
      marriageAndDisciplineNotFinal: true,
      privateNpcDossierRedacted: true,
      browserDraftOnly: true
    },
    generatedAtTurn: currentTurn(worldState)
  };
}

function createNpcActiveRequest(worldState = {}, requestTypeInput = "help", options = {}) {
  const ledger = ensureNpcActiveRequestLedgerState(worldState);
  const requestType = normalizeRequestType(requestTypeInput, "help");
  const typeConfig = NPC_ACTIVE_REQUEST_TYPE_CONFIG[requestType] || NPC_ACTIVE_REQUEST_TYPE_CONFIG.help;
  const npc = options.npc || chooseNpcForRequestType(worldState, requestType);
  if (!npc) {
    return { ok: false, errors: ["npc_not_found"], request: null, npcActiveRequestView: buildNpcActiveRequestView(worldState) };
  }

  const aiProposal = sanitizeNpcPrivateIntentProposal(options.aiProposal || {}, { npcId: npc.npcId });
  const number = clampNumber(ledger.nextRequestNumber, 1, Number.MAX_SAFE_INTEGER, 1);
  const turn = currentTurn(worldState);
  const dueTurns = clampNumber(typeConfig.dueTurns, 1, 12, NPC_ACTIVE_REQUEST_CONFIG.defaultDueTurns);
  const npcName = cleanPublicText(npc.displayName, "无名人物", 80);
  const npcTitle = cleanPublicText(npc.publicProfile?.title, "可见人物", 80);
  const ask = cleanPublicText(aiProposal.requestedAction, "", 140) || typeConfig.ask;
  const intentSummary = cleanPublicText(
    aiProposal.intentSummary,
    `${npcName}近期主动递来${typeConfig.label}，具体后果仍待服务器裁决。`,
    180
  );
  const request = {
    requestId: `npc-active-request:${number}`,
    schemaVersion: NPC_ACTIVE_REQUEST_SCHEMA_VERSION,
    type: requestType,
    typeLabel: typeConfig.label,
    status: "active",
    npcId: npc.npcId,
    npcName,
    npcTitle,
    title: `${npcName}${typeConfig.titleSuffix}`,
    ask,
    stakes: typeConfig.stakes,
    proposalBoundary: cleanPublicText(
      aiProposal.proposalBoundary,
      "本请求只是 NPC 主动意图 proposal；资源、关系、弹劾、婚姻和任务结果均由服务器裁决。",
      180
    ),
    intentSummary,
    riskTags: uniqueCleanList(typeConfig.riskTags || [], 6, 40),
    evidenceRefs: buildEvidenceRefs(npc, requestType, aiProposal),
    allowedResponseActions: NPC_ACTIVE_REQUEST_RESPONSE_ACTIONS,
    serverAdjudication: {
      status: "pending",
      proposalOnly: true,
      serverOwnsResources: true,
      serverOwnsRelationships: true,
      serverOwnsMarriageAndDiscipline: true
    },
    createdTurn: turn,
    dueTurn: turn + dueTurns,
    lastUpdatedTurn: turn,
    date: currentDate(worldState),
    outcome: null,
    auditRefs: []
  };

  ledger.activeRequests.push(request);
  ledger.nextRequestNumber = number + 1;
  ledger.cooldowns[requestType] = turn;
  const event = `[NPC 主动] ${npcName}${typeConfig.titleSuffix}：${ask}`;
  ledger.events = [...(ledger.events || []), event].slice(-NPC_ACTIVE_REQUEST_CONFIG.maxRecentEvents);
  return {
    ok: true,
    errors: [],
    request,
    events: [event],
    npcActiveRequestView: buildNpcActiveRequestView(worldState)
  };
}

function classifyNpcActiveRequestResponse(input = "") {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return "";
  if (/(举报|上交|缴呈|呈报|交官|廉政|拒收)/.test(text)) return "report";
  if (/(查证|查明|核验|调查|暗查|细查|复核)/.test(text)) return "investigate";
  if (/(稍后|暂缓|缓议|搁置|改日|再议)/.test(text)) return "defer";
  if (/(拒绝|推辞|婉拒|不许|驳回|回绝)/.test(text)) return "refuse";
  if (/(答应|应允|准|帮忙|照办|采纳|接纳|愿意|同意)/.test(text)) return "accept";
  return "";
}

function relationshipImpactFor(request = {}, responseAction = "") {
  if (responseAction === "accept") {
    if (request.type === "bribe") return { closenessDelta: -1, trustDelta: 0, hostilityDelta: 1, favorsOwedDelta: 0 };
    return { closenessDelta: 2, trustDelta: 1, hostilityDelta: -1, favorsOwedDelta: -1 };
  }
  if (responseAction === "report") return { closenessDelta: -2, trustDelta: 0, hostilityDelta: 2, favorsOwedDelta: 0 };
  if (responseAction === "investigate") return { closenessDelta: 0, trustDelta: 1, hostilityDelta: 0, favorsOwedDelta: 0 };
  if (responseAction === "defer") return { closenessDelta: -1, trustDelta: 0, hostilityDelta: 1, favorsOwedDelta: 0 };
  return { closenessDelta: -2, trustDelta: -1, hostilityDelta: 2, favorsOwedDelta: 1 };
}

function clampRelationship(value, min, max) {
  return clampNumber(value, min, max, 0);
}

function applyNpcRosterRelationshipImpact(worldState = {}, request = {}, impact = {}) {
  const npc = getNpcForServer(worldState, request.npcId);
  if (!npc || !isPlainObject(npc.relationship)) return null;
  const before = { ...npc.relationship };
  npc.relationship.closeness = clampRelationship((npc.relationship.closeness || 0) + (impact.closenessDelta || 0), -100, 100);
  npc.relationship.trust = clampRelationship((npc.relationship.trust || 0) + (impact.trustDelta || 0), 0, 100);
  npc.relationship.hostility = clampRelationship((npc.relationship.hostility || 0) + (impact.hostilityDelta || 0), 0, 100);
  npc.relationship.favorsOwed = clampRelationship((npc.relationship.favorsOwed || 0) + (impact.favorsOwedDelta || 0), -20, 20);
  return {
    npcId: npc.npcId,
    npcName: npc.displayName,
    before,
    after: { ...npc.relationship },
    appliedBy: "server"
  };
}

function outcomeForResponse(request = {}, responseAction = "") {
  if (request.type === "bribe" && responseAction === "accept") {
    return {
      status: "converted_to_risk",
      summary: "服务器拒绝将行贿视作已收财物，只登记为廉政风险和待查线索。",
      resourceApplied: false
    };
  }
  if (request.type === "marriage_proposal" && responseAction === "accept") {
    return {
      status: "under_review",
      summary: "议婚意向已登记为礼法与亲族审查，尚未成婚，也未写入 spouseIds。",
      resourceApplied: false
    };
  }
  if (request.type === "betrayal" && responseAction === "accept") {
    return {
      status: "under_review",
      summary: "反复之迹已转入查证，服务器未直接定罪、没收资产或处置人物。",
      resourceApplied: false
    };
  }
  if (responseAction === "report") {
    return {
      status: "reported",
      summary: "此事已按服务器规则转为上交、呈报或廉政线索，不即时给钱、不定罪。",
      resourceApplied: false
    };
  }
  if (responseAction === "investigate") {
    return {
      status: "under_review",
      summary: "你要求先查证，服务器将其保留为待核线索。",
      resourceApplied: false
    };
  }
  if (responseAction === "defer") {
    return {
      status: "deferred",
      summary: "你暂缓表态，请求仍在限期内等待后续裁决。",
      resourceApplied: false
    };
  }
  if (responseAction === "refuse") {
    return {
      status: "refused",
      summary: "你已拒绝此项请求，关系影响由服务器按公开摘要小幅记录。",
      resourceApplied: false
    };
  }
  return {
    status: "accepted_pending_server_resolution",
    summary: "你表示愿意处理，但具体资源、任务、关系或制度后果仍待服务器后续裁决。",
    resourceApplied: false
  };
}

function dispositionForResponse(request = {}, responseAction = "", status = "") {
  if (request.type === "bribe") return responseAction === "report" ? "integrity_report" : "integrity_risk_review";
  if (request.type === "impeachment") return responseAction === "report" ? "impeachment_evidence_report" : "impeachment_evidence_review";
  if (request.type === "betrayal") return "betrayal_risk_review";
  if (request.type === "marriage_proposal") return "ritual_family_review";
  if (request.type === "debt_collection") return status === "refused" ? "debt_refused" : "debt_claim_review";
  if (request.type === "introduction") return "network_introduction_review";
  if (responseAction === "investigate") return "evidence_review";
  if (responseAction === "report") return "reported_for_server_review";
  if (responseAction === "defer") return "deferred_obligation";
  if (responseAction === "refuse" || responseAction === "expire") return "relationship_risk_recorded";
  return "accepted_pending_follow_up";
}

function buildNpcActiveRequestResolverTrace(worldState = {}, request = {}, responseAction = "", outcome = {}) {
  const status = normalizeStatus(outcome.status || request.status, "under_review");
  const requestId = cleanId(request.requestId, "");
  const npcId = cleanId(request.npcId, "");
  const publicSourceRefs = uniqueCleanList([
    requestId ? `npcActiveRequestView:${requestId}` : "",
    npcId ? `npcRosterView:${npcId}` : ""
  ], NPC_ACTIVE_REQUEST_CONFIG.maxEvidenceRefs, 120).filter((ref) => !containsPrivateSignalText(ref));
  return {
    schemaVersion: NPC_ACTIVE_REQUEST_RESOLVER_TRACE_VERSION,
    resolver: "npc_active_request_resolver",
    publicResolutionRef: cleanId(`npc-active-resolution:${requestId || "request"}:${currentTurn(worldState)}`, ""),
    requestType: normalizeRequestType(request.type, "help"),
    typeLabel: cleanPublicText(request.typeLabel, "来函", 40),
    responseAction: cleanPublicText(responseAction, "refuse", 48),
    status,
    disposition: dispositionForResponse(request, responseAction, status),
    publicSourceRefs,
    riskTags: uniqueCleanList(request.riskTags, NPC_ACTIVE_REQUEST_CONFIG.maxRiskTags, 40)
      .filter((tag) => !containsPrivateSignalText(tag)),
    boundaries: {
      serverOwnsResources: true,
      serverOwnsRelationships: true,
      serverOwnsMarriageAndDiscipline: true,
      browserCannotApplyClientOutcome: true,
      privateIntentSignalsRedacted: true,
      privateNpcDossierRedacted: true
    }
  };
}

function resolveNpcActiveRequest(worldState = {}, requestId = "", responseActionInput = "refuse") {
  const ledger = ensureNpcActiveRequestLedgerState(worldState);
  const id = cleanId(requestId, "");
  const request = (ledger.activeRequests || []).find((entry) => entry.requestId === id);
  if (!request) return { ok: false, errors: ["request_not_found"], request: null, events: [] };

  const responseAction = normalizeResponseAction(responseActionInput, "refuse");
  const outcome = outcomeForResponse(request, responseAction);
  const impact = relationshipImpactFor(request, responseAction);
  const relationshipUpdate = applyNpcRosterRelationshipImpact(worldState, request, impact);
  const resolverTrace = buildNpcActiveRequestResolverTrace(worldState, request, responseAction, outcome);
  const followUpView = buildNpcActiveRequestFollowUpView(worldState, request, responseAction, outcome, resolverTrace);
  request.status = normalizeStatus(outcome.status, "under_review");
  request.responseAction = responseAction;
  request.lastUpdatedTurn = currentTurn(worldState);
  request.outcome = {
    responseAction,
    publicSummary: outcome.summary,
    serverDecision: "server_adjudicated",
    resolverTrace,
    followUpView,
    resourceImpactView: {
      applied: false,
      reason: "NPC 主动请求不得由前端、AI 或即时按钮直接扣银、转物或写库。"
    },
    relationshipImpactView: relationshipUpdate
      ? {
        npcId: relationshipUpdate.npcId,
        npcName: relationshipUpdate.npcName,
        closenessDelta: impact.closenessDelta,
        trustDelta: impact.trustDelta,
        hostilityDelta: impact.hostilityDelta,
        favorsOwedDelta: impact.favorsOwedDelta,
        appliedBy: "server"
      }
      : {
        npcId: request.npcId,
        appliedBy: "server",
        note: "无可见 NPC 关系项可调整。"
      }
  };
  request.auditRefs = uniqueCleanList([...(request.auditRefs || []), resolverTrace.publicResolutionRef], 6, 120);
  const eventNpcName = cleanPublicText(request.npcName, "此人", 80);
  const eventTypeLabel = cleanPublicText(request.typeLabel, "来函", 40);
  const eventSummary = cleanPublicText(outcome.summary, "服务器已裁决此请求。", 180);
  const event = `[NPC 主动] ${eventNpcName}的${eventTypeLabel}已由服务器裁决：${eventSummary}`;
  ledger.events = [...(ledger.events || []), event].slice(-NPC_ACTIVE_REQUEST_CONFIG.maxRecentEvents);
  return {
    ok: true,
    errors: [],
    request,
    events: [event],
    resolutionTrace: resolverTrace,
    attributeChanges: [{
      path: "npcActiveRequestView",
      label: "NPC 主动请求",
      before: "active",
      after: request.status,
      reason: "玩家回应 NPC 主动请求后由服务器裁决状态与公开关系影响。"
    }],
    relationshipChanges: []
  };
}

function expireNpcActiveRequests(worldState = {}) {
  const ledger = ensureNpcActiveRequestLedgerState(worldState);
  const turn = currentTurn(worldState);
  const events = [];
  const attributeChanges = [];
  const resolutionTraces = [];
  for (const request of ledger.activeRequests || []) {
    if (request.status !== "active" && request.status !== "deferred") continue;
    if (turn < clampNumber(request.dueTurn, 0, Number.MAX_SAFE_INTEGER, turn + 1)) continue;
    request.status = "expired";
    request.lastUpdatedTurn = turn;
    const resolverTrace = buildNpcActiveRequestResolverTrace(worldState, request, "expire", {
      status: "expired"
    });
    const followUpView = buildNpcActiveRequestFollowUpView(worldState, request, "expire", {
      status: "expired"
    }, resolverTrace);
    resolutionTraces.push(resolverTrace);
    request.outcome = {
      responseAction: "expire",
      publicSummary: "限期已过，服务器只记录情分与风险变化，不执行隐藏后果。",
      serverDecision: "server_adjudicated",
      resolverTrace,
      followUpView,
      resourceImpactView: { applied: false },
      relationshipImpactView: { npcId: request.npcId, appliedBy: "server", closenessDelta: -1, hostilityDelta: 1 }
    };
    request.auditRefs = uniqueCleanList([...(request.auditRefs || []), resolverTrace.publicResolutionRef], 6, 120);
    applyNpcRosterRelationshipImpact(worldState, request, { closenessDelta: -1, trustDelta: 0, hostilityDelta: 1, favorsOwedDelta: 0 });
    const eventNpcName = cleanPublicText(request.npcName, "此人", 80);
    const eventTypeLabel = cleanPublicText(request.typeLabel, "来函", 40);
    const event = `[NPC 主动] ${eventNpcName}的${eventTypeLabel}逾期未答。`;
    events.push(event);
    attributeChanges.push({
      path: "npcActiveRequestView",
      label: "NPC 主动请求",
      before: "active",
      after: "expired",
      reason: "NPC 主动请求到期后由服务器标记逾期。"
    });
  }
  ledger.events = [...(ledger.events || []), ...events].slice(-NPC_ACTIVE_REQUEST_CONFIG.maxRecentEvents);
  return {
    events,
    attributeChanges,
    resolutionTraces
  };
}

function runNpcActiveRequestStep(worldState = {}, input = "", options = {}) {
  const ledger = ensureNpcActiveRequestLedgerState(worldState);
  ensureNpcRoster(worldState);
  const result = {
    schemaVersion: NPC_ACTIVE_REQUEST_SCHEMA_VERSION,
    summary: "",
    events: [],
    attributeChanges: [],
    relationshipChanges: [],
    outcome: {
      scheduled: 0,
      resolved: 0,
      expired: 0,
      activeCount: 0,
      resolutionTraces: []
    }
  };

  const responseAction = normalizeResponseAction(options.responseAction, "") || classifyNpcActiveRequestResponse(input);
  const activeRequest = (ledger.activeRequests || []).find((request) => request.status === "active" || request.status === "deferred");
  if (activeRequest && responseAction) {
    const resolved = resolveNpcActiveRequest(worldState, activeRequest.requestId, responseAction);
    if (resolved.ok) {
      result.events.push(...resolved.events);
      result.attributeChanges.push(...(resolved.attributeChanges || []));
      result.relationshipChanges.push(...(resolved.relationshipChanges || []));
      if (resolved.resolutionTrace) result.outcome.resolutionTraces.push(resolved.resolutionTrace);
      result.outcome.resolved += 1;
    }
  }

  const expired = expireNpcActiveRequests(worldState);
  result.events.push(...expired.events);
  result.attributeChanges.push(...expired.attributeChanges);
  result.outcome.resolutionTraces.push(...(expired.resolutionTraces || []));
  result.outcome.expired += expired.events.length;

  if (shouldScheduleRequest(worldState, ledger, options)) {
    const type = nextRequestType(ledger, worldState, options);
    const created = createNpcActiveRequest(worldState, type, options);
    if (created.ok) {
      result.events.push(...(created.events || []));
      result.attributeChanges.push({
        path: "npcActiveRequestView",
        label: "NPC 主动请求",
        before: null,
        after: cleanPublicText(created.request.typeLabel, "来函", 40),
        reason: "服务器根据 NPC 名册、公开关系和内部信号生成主动请求。"
      });
      result.outcome.scheduled += 1;
    }
  }

  result.outcome.activeCount = requestCountByStatus(ledger);
  result.summary = result.events.length
    ? `NPC 主动请求：本旬新增${result.outcome.scheduled}条，处理${result.outcome.resolved}条，逾期${result.outcome.expired}条。`
    : "";
  return result;
}

function toRequestView(request = {}, worldState = {}) {
  const npcId = cleanId(request.npcId, "");
  const npc = getNpcForServer(worldState, npcId);
  const requestType = normalizeRequestType(request.type, "help");
  const typeConfig = NPC_ACTIVE_REQUEST_TYPE_CONFIG[requestType] || NPC_ACTIVE_REQUEST_TYPE_CONFIG.help;
  const publicNpcName = cleanPublicText(request.npcName, cleanPublicText(npc?.displayName, "未知人物", 80), 80);
  const publicTypeLabel = cleanPublicText(request.typeLabel, typeConfig.label, 40);
  const publicTitle = cleanPublicText(request.title, `${publicNpcName}${typeConfig.titleSuffix}`, 120);
  const outcome = request.outcome ? {
    responseAction: cleanPublicText(request.outcome.responseAction, "", 48),
    publicSummary: cleanPublicText(
      request.outcome.publicSummary,
      "服务器已登记此请求的公开处理结果，后续仍按规则裁决。",
      180
    ),
    serverDecision: cleanPublicText(request.outcome.serverDecision, "server_adjudicated", 80),
    followUpView: sanitizePublicViewValue(request.outcome.followUpView),
    resourceImpactView: sanitizePublicViewValue(request.outcome.resourceImpactView),
    relationshipImpactView: sanitizePublicViewValue(request.outcome.relationshipImpactView),
    resolverTrace: sanitizePublicViewValue(request.outcome.resolverTrace)
  } : null;
  const publicStatus = normalizeStatus(request.status, "active");
  const responseOpen = isRequestResponseOpen(publicStatus);
  return {
    requestId: cleanId(request.requestId, ""),
    type: requestType,
    typeLabel: publicTypeLabel,
    status: publicStatus,
    npc: {
      npcId,
      displayName: publicNpcName,
      title: cleanPublicText(request.npcTitle, "可见人物", 80),
      portraitRef: cleanPublicText(npc?.portraitRef, "", 120)
    },
    title: publicTitle,
    ask: cleanPublicText(request.ask, typeConfig.ask, 140),
    stakes: cleanPublicText(request.stakes, typeConfig.stakes, 180),
    intentSummary: cleanPublicText(
      request.intentSummary,
      `${publicNpcName}近期主动递来${typeConfig.label}，具体后果仍待服务器裁决。`,
      180
    ),
    proposalBoundary: cleanPublicText(
      request.proposalBoundary,
      "本请求只是 NPC 主动意图；资源、关系、婚姻和制度后果均由服务器裁决。",
      180
    ),
    riskTags: uniqueCleanList(request.riskTags, NPC_ACTIVE_REQUEST_CONFIG.maxRiskTags, 40)
      .filter((tag) => !containsPrivateSignalText(tag)),
    evidenceRefs: uniqueCleanList(request.evidenceRefs, NPC_ACTIVE_REQUEST_CONFIG.maxEvidenceRefs, 96)
      .filter((ref) => !containsPrivateSignalText(ref)),
    allowedResponseActions: responseOpen ? NPC_ACTIVE_REQUEST_RESPONSE_ACTIONS : [],
    responseOptions: responseOpen ? buildResponseOptionsForRequest(request) : [],
    createdTurn: clampNumber(request.createdTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    dueTurn: clampNumber(request.dueTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    lastUpdatedTurn: clampNumber(request.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, clampNumber(request.createdTurn, 0, Number.MAX_SAFE_INTEGER, 0)),
    turnsRemaining: Math.max(0, clampNumber(request.dueTurn, 0, Number.MAX_SAFE_INTEGER, 0) - currentTurn(worldState)),
    serverAdjudication: {
      status: cleanPublicText(request.serverAdjudication?.status, "pending", 56),
      proposalOnly: true,
      serverOwnsResources: true,
      serverOwnsRelationships: true,
      serverOwnsMarriageAndDiscipline: true
    },
    outcome
  };
}

function buildNpcActiveRequestFollowUpTasks(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((record) => isPlainObject(record) && record.requestId && isFollowUpTaskOpen(record.status))
    .map((record) => {
      const followUp = isPlainObject(record.outcome?.followUpView) ? record.outcome.followUpView : {};
      const publicResolutionRef = cleanId(followUp.publicResolutionRef, "");
      const config = followUpConfigFor(record.type);
      const taskRoute = cleanPublicText(config.taskRoute, "active_request_follow_up", 80);
      const status = followUpTaskStatus(record.status, followUp.responseAction || record.outcome?.responseAction);
      if (!publicResolutionRef || !followUp.boundaries?.serverOwnsFollowUp) return null;
      return {
        schemaVersion: NPC_ACTIVE_REQUEST_FOLLOW_UP_TASK_SCHEMA_VERSION,
        taskId: cleanId(`npc-active-follow-up:${record.requestId}:${taskRoute}`, ""),
        sourceType: "npc_active_request_follow_up",
        requestId: cleanId(record.requestId, ""),
        requestType: normalizeRequestType(record.type, "help"),
        requestTypeLabel: cleanPublicText(record.typeLabel || followUp.requestTypeLabel, "来函", 40),
        publicResolutionRef,
        followUpKind: cleanPublicText(followUp.followUpKind, config.followUpKind, 80),
        taskRoute,
        taskRouteLabel: cleanPublicText(config.taskRouteLabel, config.title, 40),
        status,
        statusLabel: status === "reported_for_review"
          ? "已呈报待复核"
          : status === "risk_watch"
            ? "风险观察"
            : "待服务器续办",
        title: cleanPublicText(followUp.title || config.title, "来函后续", 80),
        publicSummary: cleanPublicText(followUp.publicSummary, config.publicSummary, 180),
        nextStep: cleanPublicText(followUp.nextStep, config.nextStep, 180),
        draftText: fillFollowUpTaskTemplate(config.taskDraftTemplate, record, followUp),
        npc: {
          npcId: cleanId(record.npc?.npcId, ""),
          displayName: cleanPublicText(record.npc?.displayName, "来人", 80),
          title: cleanPublicText(record.npc?.title, "可见人物", 80)
        },
        evidenceRefs: uniqueCleanList([
          ...(Array.isArray(followUp.evidenceRefs) ? followUp.evidenceRefs : []),
          `npcActiveRequestView:${record.requestId}`,
          `npcActiveRequestFollowUp:${publicResolutionRef}`
        ], NPC_ACTIVE_REQUEST_CONFIG.maxEvidenceRefs, 120).filter((ref) => !containsPrivateSignalText(ref)),
        riskTags: uniqueCleanList([
          ...(Array.isArray(followUp.riskTags) ? followUp.riskTags : []),
          ...(Array.isArray(record.riskTags) ? record.riskTags : [])
        ], NPC_ACTIVE_REQUEST_CONFIG.maxRiskTags, 40).filter((tag) => !containsPrivateSignalText(tag)),
        urgency: ["integrity_watchlist", "censorate_watchlist", "relationship_risk_watchlist"].includes(taskRoute)
          ? "high"
          : "normal",
        createdTurn: clampNumber(followUp.generatedAtTurn || record.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, 0),
        lastUpdatedTurn: clampNumber(record.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, 0),
        boundaries: {
          serverOwnsFollowUp: true,
          proposalOnly: true,
          browserDraftOnly: true,
          resourcesNotApplied: true,
          relationshipNotFinal: true,
          marriageAndDisciplineNotFinal: true,
          privateNpcDossierRedacted: true,
          noHiddenTruthAdjudication: true
        }
      };
    })
    .filter(Boolean)
    .slice(0, NPC_ACTIVE_REQUEST_CONFIG.maxFollowUpTasks);
}

function buildNpcActiveRequestView(worldState = {}, options = {}) {
  const ledger = ensureNpcActiveRequestLedgerState(worldState);
  const includeResolved = options.includeResolved === true;
  const statusSet = includeResolved
    ? null
    : new Set(["active", "deferred", "under_review", "reported", "converted_to_risk", "accepted_pending_server_resolution"]);
  const items = (ledger.activeRequests || [])
    .filter((request) => !statusSet || statusSet.has(request.status))
    .slice(-NPC_ACTIVE_REQUEST_CONFIG.maxViewItems)
    .reverse()
    .map((request) => toRequestView(request, worldState));
  const followUpTasks = buildNpcActiveRequestFollowUpTasks(items);
  return {
    schemaVersion: NPC_ACTIVE_REQUEST_SCHEMA_VERSION,
    ownerActorId: ledger.ownerActorId,
    totalItems: items.length,
    items,
    followUpTasks,
    recentEvents: uniqueCleanList(ledger.events, NPC_ACTIVE_REQUEST_CONFIG.maxRecentEvents, 140)
      .map((event) => cleanPublicText(event, "", 140))
      .filter((event) => event && !containsPrivateSignalText(event)),
    allowedRequestTypes: NPC_ACTIVE_REQUEST_TYPES,
    allowedResponseActions: NPC_ACTIVE_REQUEST_RESPONSE_ACTIONS,
    safeguards: {
      proposalOnly: true,
      privateNpcDossierRedacted: true,
      rawAiPayloadRedacted: true,
      browserCannotResolveResourcesMarriageOrDiscipline: true,
      serverOwnsAdjudication: true
    }
  };
}

module.exports = {
  buildNpcActiveRequestView,
  buildNpcPrivatePlannerContext,
  classifyNpcActiveRequestResponse,
  createInitialNpcActiveRequestLedger,
  createNpcActiveRequest,
  ensureNpcActiveRequestLedgerState,
  resolveNpcActiveRequest,
  runNpcActiveRequestStep,
  sanitizeNpcPrivateIntentProposal
};
