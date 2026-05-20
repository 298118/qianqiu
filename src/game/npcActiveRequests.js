const { randomUUID } = require("node:crypto");

const {
  NPC_ACTIVE_REQUEST_CONFIG,
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
  /(hiddenNotes|hiddenIntent|hiddenDossier|privateSignalTags|trueAssets|secretRelationships|unrevealedTasks|raw[_ -]?(?:provider|audit|table|ledger|prompt|payload|state)|\b(?:provider|prompt|proposal)\b|retrievalContext|statePatch|worldState|world_sessions|prompt_retrieval_index|event_archive_index|safe_search_index|ai_change_proposals|event_log|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sqlite|data[\\/](?:sessions|audit)|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

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
  const ask = cleanPublicText(aiProposal.requestedAction, "", 140) || typeConfig.ask;
  const intentSummary = cleanPublicText(
    aiProposal.intentSummary,
    `${npc.displayName}近期主动递来${typeConfig.label}，具体后果仍待服务器裁决。`,
    180
  );
  const request = {
    requestId: `npc-active-request:${number}`,
    schemaVersion: NPC_ACTIVE_REQUEST_SCHEMA_VERSION,
    type: requestType,
    typeLabel: typeConfig.label,
    status: "active",
    npcId: npc.npcId,
    npcName: cleanText(npc.displayName, "无名人物", 80),
    npcTitle: cleanText(npc.publicProfile?.title, "可见人物", 80),
    title: `${cleanText(npc.displayName, "此人", 80)}${typeConfig.titleSuffix}`,
    ask,
    stakes: typeConfig.stakes,
    proposalBoundary: cleanText(
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
  const event = `[NPC 主动] ${request.npcName}${typeConfig.titleSuffix}：${ask}`;
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

function resolveNpcActiveRequest(worldState = {}, requestId = "", responseActionInput = "refuse") {
  const ledger = ensureNpcActiveRequestLedgerState(worldState);
  const id = cleanId(requestId, "");
  const request = (ledger.activeRequests || []).find((entry) => entry.requestId === id);
  if (!request) return { ok: false, errors: ["request_not_found"], request: null, events: [] };

  const responseAction = normalizeResponseAction(responseActionInput, "refuse");
  const outcome = outcomeForResponse(request, responseAction);
  const impact = relationshipImpactFor(request, responseAction);
  const relationshipUpdate = applyNpcRosterRelationshipImpact(worldState, request, impact);
  request.status = normalizeStatus(outcome.status, "under_review");
  request.responseAction = responseAction;
  request.lastUpdatedTurn = currentTurn(worldState);
  request.outcome = {
    responseAction,
    publicSummary: outcome.summary,
    serverDecision: "server_adjudicated",
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
  const event = `[NPC 主动] ${request.npcName}的${request.typeLabel}已由服务器裁决：${outcome.summary}`;
  ledger.events = [...(ledger.events || []), event].slice(-NPC_ACTIVE_REQUEST_CONFIG.maxRecentEvents);
  return {
    ok: true,
    errors: [],
    request,
    events: [event],
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
  for (const request of ledger.activeRequests || []) {
    if (request.status !== "active" && request.status !== "deferred") continue;
    if (turn < clampNumber(request.dueTurn, 0, Number.MAX_SAFE_INTEGER, turn + 1)) continue;
    request.status = "expired";
    request.lastUpdatedTurn = turn;
    request.outcome = {
      responseAction: "expire",
      publicSummary: "限期已过，服务器只记录情分与风险变化，不执行隐藏后果。",
      serverDecision: "server_adjudicated",
      resourceImpactView: { applied: false },
      relationshipImpactView: { npcId: request.npcId, appliedBy: "server", closenessDelta: -1, hostilityDelta: 1 }
    };
    applyNpcRosterRelationshipImpact(worldState, request, { closenessDelta: -1, trustDelta: 0, hostilityDelta: 1, favorsOwedDelta: 0 });
    const event = `[NPC 主动] ${request.npcName}的${request.typeLabel}逾期未答。`;
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
  return { events, attributeChanges };
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
      activeCount: 0
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
      result.outcome.resolved += 1;
    }
  }

  const expired = expireNpcActiveRequests(worldState);
  result.events.push(...expired.events);
  result.attributeChanges.push(...expired.attributeChanges);
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
        after: created.request.typeLabel,
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
  const npc = getNpcForServer(worldState, request.npcId);
  const typeConfig = NPC_ACTIVE_REQUEST_TYPE_CONFIG[request.type] || NPC_ACTIVE_REQUEST_TYPE_CONFIG.help;
  const outcome = request.outcome ? {
    responseAction: cleanPublicText(request.outcome.responseAction, "", 48),
    publicSummary: cleanPublicText(
      request.outcome.publicSummary,
      "服务器已登记此请求的公开处理结果，后续仍按规则裁决。",
      180
    ),
    serverDecision: cleanPublicText(request.outcome.serverDecision, "server_adjudicated", 80),
    resourceImpactView: sanitizePublicViewValue(request.outcome.resourceImpactView),
    relationshipImpactView: sanitizePublicViewValue(request.outcome.relationshipImpactView)
  } : null;
  return {
    requestId: request.requestId,
    type: request.type,
    typeLabel: request.typeLabel,
    status: request.status,
    npc: {
      npcId: request.npcId,
      displayName: request.npcName,
      title: request.npcTitle,
      portraitRef: npc?.portraitRef || ""
    },
    title: request.title,
    ask: cleanPublicText(request.ask, typeConfig.ask, 140),
    stakes: cleanPublicText(request.stakes, typeConfig.stakes, 180),
    intentSummary: cleanPublicText(
      request.intentSummary,
      `${request.npcName || "此人"}近期主动递来${typeConfig.label}，具体后果仍待服务器裁决。`,
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
    allowedResponseActions: NPC_ACTIVE_REQUEST_RESPONSE_ACTIONS,
    createdTurn: clampNumber(request.createdTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    dueTurn: clampNumber(request.dueTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    turnsRemaining: Math.max(0, clampNumber(request.dueTurn, 0, Number.MAX_SAFE_INTEGER, 0) - currentTurn(worldState)),
    serverAdjudication: {
      status: request.serverAdjudication?.status || "pending",
      proposalOnly: true,
      serverOwnsResources: true,
      serverOwnsRelationships: true,
      serverOwnsMarriageAndDiscipline: true
    },
    outcome
  };
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
  return {
    schemaVersion: NPC_ACTIVE_REQUEST_SCHEMA_VERSION,
    ownerActorId: ledger.ownerActorId,
    totalItems: items.length,
    items,
    recentEvents: uniqueCleanList(ledger.events, NPC_ACTIVE_REQUEST_CONFIG.maxRecentEvents, 140)
      .map((event) => cleanPublicText(event, "", 140))
      .filter(Boolean),
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
