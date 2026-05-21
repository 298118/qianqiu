const {
  OFFICIAL_COURT_RESPONSE_AI_READ_SCOPE,
  OFFICIAL_COURT_RESPONSE_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_RESPONSE_KIND_LABELS,
  OFFICIAL_COURT_RESPONSE_KINDS,
  OFFICIAL_COURT_RESPONSE_LIMITS,
  OFFICIAL_COURT_RESPONSE_ROLE_LABELS,
  OFFICIAL_COURT_RESPONSE_ROLES,
  OFFICIAL_COURT_RESPONSE_SCHEMA_VERSION,
  OFFICIAL_COURT_RESPONSE_SERVER_ADJUDICATION,
  OFFICIAL_COURT_RESPONSE_STATUS_LABELS,
  OFFICIAL_COURT_RESPONSE_STATUSES,
  OFFICIAL_COURT_RESPONSE_TOOL_PERMISSIONS
} = require("./officialCourtResponseConfig");
const {
  normalizeOfficialCourtEntryFollowUps,
  normalizeOfficialCourtEntryResolutions
} = require("./officialCourtEntry");

const RESPONSE_ROLE_SET = new Set(OFFICIAL_COURT_RESPONSE_ROLES);
const RESPONSE_KIND_SET = new Set(OFFICIAL_COURT_RESPONSE_KINDS);
const RESPONSE_STATUS_SET = new Set(OFFICIAL_COURT_RESPONSE_STATUSES);
const PLAYER_RESPONSE_ROLES = new Set(["emperor", "minister", "official"]);

const OFFICIAL_COURT_RESPONSE_SENSITIVE_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|state|row)|\b(?:provider|prompt|statePatch|worldState|provider\s+payload|provider\s+proposal|rawSql|SQL|sqlite|server\.)\b|完整\s*prompt|完整提示词|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const FORBIDDEN_TERMINAL_DECISION_PATTERN =
  /(已(?:任免|处分|赏罚|采纳|拨款|拨饷)|已经(?:任免|处分|赏罚|采纳|生效)|采纳奏折|准奏|照准|题准|奉旨(?:准行|已行)|弹劾成案|已成弹劾|成弹劾|圣旨已生效|官缺已定|革职|罢黜|黜免|升迁|降调|赏银|罚俸|拨(?:给|付|发)?(?:钱粮|银两|粮饷|饷银|款项)|定罪|定赏|定罚|问罪|处分(?:成案|已定)|奖惩(?:成案|已定))/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = OFFICIAL_COURT_RESPONSE_LIMITS.maxTextLength) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  if (OFFICIAL_COURT_RESPONSE_SENSITIVE_PATTERN.test(text)) return fallback;
  if (FORBIDDEN_TERMINAL_DECISION_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanList(values, limit, maxLength = 96) {
  const result = [];
  const seen = new Set();
  for (const value of asArray(values)) {
    const text = isPlainObject(value)
      ? cleanText(value.publicSummary || value.summary || value.title || value.label || value.id, "", maxLength)
      : cleanText(value, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function currentDateParts(worldState = {}) {
  return {
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month: clampNumber(worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1)
  };
}

function normalizeResponseRole(value, fallback = "bureau") {
  const role = cleanId(value, fallback);
  return RESPONSE_ROLE_SET.has(role) ? role : fallback;
}

function normalizeResponseKind(value, fallback = "bureau_reply") {
  const kind = cleanId(value, fallback);
  return RESPONSE_KIND_SET.has(kind) ? kind : fallback;
}

function normalizeResponseStatus(value, fallback = "draft_recorded") {
  const status = cleanId(value, fallback);
  return RESPONSE_STATUS_SET.has(status) ? status : fallback;
}

function statusForKind(kind) {
  if (kind === "vermilion_note") return "noted_by_throne";
  if (kind === "bureau_reply") return "referred_to_bureau";
  if (kind === "court_comment") return "held_for_deliberation";
  if (kind === "evidence_request") return "requested_evidence";
  if (kind === "assessment_note") return "assessment_watch";
  return "draft_recorded";
}

function roleForPlayerRole(role) {
  if (role === "emperor") return "emperor";
  if (role === "minister") return "minister";
  if (role === "official") return "official";
  return "bureau";
}

function nextHandlerRoleForResponse(kind = "bureau_reply", role = "bureau") {
  if (kind === "vermilion_note") return "minister";
  if (kind === "bureau_reply") return "emperor";
  if (kind === "court_comment") return "minister";
  if (kind === "evidence_request") return "official";
  if (kind === "assessment_note") return "bureau";
  if (role === "emperor") return "minister";
  if (role === "minister") return "emperor";
  if (role === "official") return "minister";
  return "bureau";
}

function chainIdFromRaw(raw = {}, sourceType = "official_court_follow_up", sourceId = "official-court-source") {
  return cleanId(
    raw.chainId ||
    raw.sourceEntryId ||
    raw.sourceResolutionId ||
    raw.sourceFollowUpId ||
    (sourceType === "official_court_response" ? raw.previousResponseId || raw.sourceResponseId : "") ||
    `${sourceType}:${sourceId}`,
    `court-response-chain:${sourceId}`
  );
}

function defaultChainStageLabel(chainRound, roleLabel, kindLabel) {
  const roundLabel = chainRound <= 1 ? "首轮" : `第${chainRound}轮`;
  const stepLabel = String(kindLabel || "").startsWith(String(roleLabel || ""))
    ? kindLabel
    : `${roleLabel}${kindLabel}`;
  return `${roundLabel} · ${stepLabel}`;
}

function normalizeOfficialCourtResponse(raw = {}, worldState = {}) {
  if (!isPlainObject(raw)) return null;
  const turn = clampNumber(raw.generatedAtTurn ?? raw.turn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState));
  const responseRole = normalizeResponseRole(raw.responseRole, roleForPlayerRole(worldState.player?.role));
  const responseKind = normalizeResponseKind(raw.responseKind, "bureau_reply");
  const status = normalizeResponseStatus(raw.status, statusForKind(responseKind));
  const sourceType = cleanText(raw.sourceType, "official_court_follow_up", 48);
  const sourceId = cleanId(raw.sourceId || raw.sourceFollowUpId || raw.sourceResolutionId, "official-court-source");
  const sourceResponseId = cleanId(raw.sourceResponseId || (sourceType === "official_court_response" ? sourceId : ""), "");
  const previousResponseId = cleanId(raw.previousResponseId || sourceResponseId, "");
  const chainRound = clampNumber(
    raw.chainRound,
    1,
    OFFICIAL_COURT_RESPONSE_LIMITS.maxChainRound,
    previousResponseId ? 2 : 1
  );
  const responseRoleLabel = cleanText(
    raw.responseRoleLabel,
    OFFICIAL_COURT_RESPONSE_ROLE_LABELS[responseRole] || "有司",
    32
  );
  const responseKindLabel = cleanText(
    raw.responseKindLabel,
    OFFICIAL_COURT_RESPONSE_KIND_LABELS[responseKind] || "奏议回应",
    40
  );
  const statusLabel = cleanText(
    raw.statusLabel,
    OFFICIAL_COURT_RESPONSE_STATUS_LABELS[status] || "回应已记",
    40
  );
  const nextHandlerRole = normalizeResponseRole(
    raw.nextHandlerRole,
    nextHandlerRoleForResponse(responseKind, responseRole)
  );
  const nextHandlerLabel = cleanText(
    raw.nextHandlerLabel,
    OFFICIAL_COURT_RESPONSE_ROLE_LABELS[nextHandlerRole] || "有司",
    32
  );
  const chainPath = cleanList(
    raw.chainPath || [`${responseRoleLabel}${responseKindLabel}`],
    OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs,
    80
  );
  const title = cleanText(
    raw.title,
    `${OFFICIAL_COURT_RESPONSE_KIND_LABELS[responseKind] || "奏议回应"}：${sourceId}`,
    OFFICIAL_COURT_RESPONSE_LIMITS.maxShortTextLength
  );
  const publicSummary = cleanText(raw.publicSummary || raw.summary, "", OFFICIAL_COURT_RESPONSE_LIMITS.maxTextLength);
  if (!title || !publicSummary) return null;
  const date = currentDateParts(worldState);

  return {
    schemaVersion: OFFICIAL_COURT_RESPONSE_SCHEMA_VERSION,
    id: cleanId(raw.id, `OCR-${String(turn).padStart(4, "0")}-${responseKind}`),
    responseRole,
    responseRoleLabel,
    responseKind,
    responseKindLabel,
    status,
    statusLabel,
    sourceType,
    sourceId,
    sourceEntryId: cleanId(raw.sourceEntryId, ""),
    sourceResolutionId: cleanId(raw.sourceResolutionId, ""),
    sourceFollowUpId: cleanId(raw.sourceFollowUpId, ""),
    sourceResponseId,
    previousResponseId,
    chainId: chainIdFromRaw(raw, sourceType, sourceId),
    chainRound,
    chainStage: cleanId(raw.chainStage || responseKind, responseKind),
    chainStageLabel: cleanText(
      raw.chainStageLabel,
      defaultChainStageLabel(chainRound, responseRoleLabel, responseKindLabel),
      64
    ),
    nextHandlerRole,
    nextHandlerLabel,
    chainPath,
    title,
    publicSummary,
    generatedAtTurn: turn,
    year: clampNumber(raw.year, 1, 9999, date.year),
    month: clampNumber(raw.month, 1, 12, date.month),
    tenDayPeriod: clampNumber(raw.tenDayPeriod, 1, 3, date.tenDayPeriod),
    sourceRefs: cleanList(raw.sourceRefs, OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 96),
    evidenceRefs: cleanList(raw.evidenceRefs, OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 96),
    consequenceRefs: cleanList(raw.consequenceRefs, OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 96),
    nextStep: cleanText(
      raw.nextStep,
      "后续仍按普通回合补证、复核、覆奏和考成观察。",
      OFFICIAL_COURT_RESPONSE_LIMITS.maxShortTextLength
    ),
    aiReadScope: cleanList(
      raw.aiReadScope || OFFICIAL_COURT_RESPONSE_AI_READ_SCOPE,
      OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs,
      96
    ),
    toolPermissions: cleanText(
      raw.toolPermissions,
      OFFICIAL_COURT_RESPONSE_TOOL_PERMISSIONS,
      OFFICIAL_COURT_RESPONSE_LIMITS.maxTextLength
    ),
    serverAdjudication: cleanText(
      raw.serverAdjudication,
      OFFICIAL_COURT_RESPONSE_SERVER_ADJUDICATION,
      OFFICIAL_COURT_RESPONSE_LIMITS.maxTextLength
    ),
    authorityBoundary: OFFICIAL_COURT_RESPONSE_AUTHORITY_BOUNDARY,
    visibility: "player_visible",
    confidence: 0.82
  };
}

function normalizeOfficialCourtResponses(responses = [], worldState = {}) {
  return asArray(responses)
    .map((response) => normalizeOfficialCourtResponse(response, worldState))
    .filter(Boolean)
    .slice(-OFFICIAL_COURT_RESPONSE_LIMITS.maxResponses);
}

function createInitialOfficialCourtResponseState() {
  return {
    schemaVersion: OFFICIAL_COURT_RESPONSE_SCHEMA_VERSION,
    responses: []
  };
}

function normalizeOfficialCourtResponseState(worldState = {}) {
  const source = isPlainObject(worldState.officialCourtResponses) ? worldState.officialCourtResponses : {};
  return {
    schemaVersion: OFFICIAL_COURT_RESPONSE_SCHEMA_VERSION,
    responses: normalizeOfficialCourtResponses(source.responses, worldState)
  };
}

function ensureOfficialCourtResponseState(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.officialCourtResponses = normalizeOfficialCourtResponseState(worldState);
  return worldState;
}

function sourceDate(record = {}, worldState = {}) {
  const date = currentDateParts(worldState);
  return {
    year: clampNumber(record.year, 1, 9999, date.year),
    month: clampNumber(record.month, 1, 12, date.month),
    tenDayPeriod: clampNumber(record.tenDayPeriod, 1, 3, date.tenDayPeriod),
    generatedAtTurn: clampNumber(record.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
  };
}

function buildSourceRecordFromResolution(resolution = {}, worldState = {}) {
  const date = sourceDate(resolution, worldState);
  const sourceId = cleanId(resolution.id, "official-court-entry");
  return {
    id: cleanId(resolution.id, `court-entry-resolution-${date.generatedAtTurn}`),
    sourceType: "official_court_entry",
    sourceId,
    sourceEntryId: cleanId(resolution.entryId, ""),
    sourceResolutionId: cleanId(resolution.id, ""),
    sourceFollowUpId: "",
    sourceResponseId: "",
    previousResponseId: "",
    chainId: cleanId(`official_court_entry:${sourceId}`, `official-court-entry:${sourceId}`),
    chainRound: 0,
    chainStageLabel: cleanText(resolution.statusLabel, "初入奏议", 40),
    nextHandlerRole: "minister",
    nextHandlerLabel: OFFICIAL_COURT_RESPONSE_ROLE_LABELS.minister,
    chainPath: cleanList([resolution.statusLabel || "初入奏议"], OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 80),
    title: cleanText(resolution.title, "首月奏议裁决", OFFICIAL_COURT_RESPONSE_LIMITS.maxShortTextLength),
    publicSummary: cleanText(resolution.publicSummary, "首月奏议已有公开裁决，待后续回应。"),
    statusLabel: cleanText(resolution.statusLabel, "近次裁决", 40),
    stageLabel: resolution.surfaceId === "court-debate" ? "朝议筹议" : "奏折队列",
    targetSurfaceId: resolution.surfaceId === "court-debate" ? "court-debate" : "memorial-review",
    sourceRefs: cleanList(resolution.sourceRefs, OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 96),
    consequenceRefs: ["eventArchive:official_court_entry"],
    ...date
  };
}

function buildSourceRecordFromFollowUp(followUp = {}, worldState = {}) {
  const date = sourceDate(followUp, worldState);
  const sourceId = cleanId(followUp.id, "official-court-follow-up");
  const nextHandlerRole = followUp.stage === "imperial_note" ? "emperor" : "minister";
  return {
    id: cleanId(followUp.id, `court-follow-up-${date.generatedAtTurn}`),
    sourceType: "official_court_follow_up",
    sourceId,
    sourceEntryId: cleanId(followUp.entryId, ""),
    sourceResolutionId: cleanId(followUp.resolutionId, ""),
    sourceFollowUpId: cleanId(followUp.id, ""),
    sourceResponseId: "",
    previousResponseId: "",
    chainId: cleanId(`official_court_follow_up:${sourceId}`, `official-court-follow-up:${sourceId}`),
    chainRound: 0,
    chainStageLabel: cleanText(followUp.stageLabel || followUp.statusLabel, "奏议后续", 40),
    nextHandlerRole,
    nextHandlerLabel: OFFICIAL_COURT_RESPONSE_ROLE_LABELS[nextHandlerRole] || "部院",
    chainPath: cleanList([followUp.stageLabel || followUp.statusLabel || "奏议后续"], OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 80),
    title: cleanText(followUp.title, "奏议后续批复", OFFICIAL_COURT_RESPONSE_LIMITS.maxShortTextLength),
    publicSummary: cleanText(followUp.publicSummary, "奏议后续已有公开批复，待跨身份回应。"),
    statusLabel: cleanText(followUp.statusLabel, "批复", 40),
    stageLabel: cleanText(followUp.stageLabel, "奏议后续", 40),
    targetSurfaceId: followUp.stage === "imperial_note" ? "edict-draft" : "court-debate",
    sourceRefs: cleanList(followUp.sourceRefs, OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 96),
    consequenceRefs: cleanList(
      ["eventArchive:official_court_follow_up", "worldThread:official_court_follow_up", ...asArray(followUp.consequenceRefs)],
      OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs,
      96
    ),
    ...date
  };
}

function buildSourceRecordFromResponse(response = {}, worldState = {}) {
  const date = sourceDate(response, worldState);
  const sourceId = cleanId(response.id, "official-court-response");
  const chainRound = clampNumber(response.chainRound, 1, OFFICIAL_COURT_RESPONSE_LIMITS.maxChainRound, 1);
  if (!sourceId || chainRound >= OFFICIAL_COURT_RESPONSE_LIMITS.maxChainRound) return null;
  const nextHandlerRole = normalizeResponseRole(
    response.nextHandlerRole,
    nextHandlerRoleForResponse(response.responseKind, response.responseRole)
  );
  const nextHandlerLabel = OFFICIAL_COURT_RESPONSE_ROLE_LABELS[nextHandlerRole] || "有司";
  const responseKindLabel = cleanText(response.responseKindLabel, "奏议回应", 40);
  const statusLabel = cleanText(response.statusLabel, "回应已记", 40);
  const chainStageLabel = cleanText(
    response.chainStageLabel,
    defaultChainStageLabel(chainRound, cleanText(response.responseRoleLabel, "有司", 32), responseKindLabel),
    64
  );
  return {
    id: sourceId,
    sourceType: "official_court_response",
    sourceId,
    sourceEntryId: cleanId(response.sourceEntryId, ""),
    sourceResolutionId: cleanId(response.sourceResolutionId, ""),
    sourceFollowUpId: cleanId(response.sourceFollowUpId, ""),
    sourceResponseId: sourceId,
    previousResponseId: cleanId(response.previousResponseId, ""),
    chainId: cleanId(response.chainId, `official-court-response-chain:${sourceId}`),
    chainRound,
    chainStageLabel,
    nextHandlerRole,
    nextHandlerLabel,
    chainPath: cleanList(
      [...asArray(response.chainPath), `${nextHandlerLabel}待续办`],
      OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs,
      80
    ),
    title: cleanText(`续办：${response.title || responseKindLabel}`, "奏议回应续办", OFFICIAL_COURT_RESPONSE_LIMITS.maxShortTextLength),
    publicSummary: cleanText(
      `承${chainStageLabel}，${response.publicSummary || statusLabel}；下一步只形成${nextHandlerLabel}公开回应或补据清单。`,
      "奏议回应已有公开记录，待下一轮续办。"
    ),
    statusLabel,
    stageLabel: `第${chainRound + 1}轮续办`,
    targetSurfaceId: nextHandlerRole === "emperor"
      ? "edict-draft"
      : nextHandlerRole === "official"
        ? "memorial-review"
        : "court-debate",
    sourceRefs: cleanList([
      `courtResponseView.recentResponse:${sourceId}`,
      ...asArray(response.sourceRefs)
    ], OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 96),
    consequenceRefs: cleanList(
      ["eventArchive:official_court_response", "worldThread:official_court_response", ...asArray(response.consequenceRefs)],
      OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs,
      96
    ),
    ...date
  };
}

function buildOfficialCourtResponseSources(worldState = {}) {
  const career = isPlainObject(worldState.officialCareer) ? worldState.officialCareer : {};
  const responseState = normalizeOfficialCourtResponseState(worldState);
  const resolutions = normalizeOfficialCourtEntryResolutions(career.courtEntryResolutions, worldState)
    .map((resolution) => buildSourceRecordFromResolution(resolution, worldState));
  const followUps = normalizeOfficialCourtEntryFollowUps(career.courtEntryFollowUps, worldState)
    .map((followUp) => buildSourceRecordFromFollowUp(followUp, worldState));
  const chainSources = responseState.responses
    .map((response) => buildSourceRecordFromResponse(response, worldState))
    .filter(Boolean);
  const byId = new Map();
  for (const source of [...chainSources, ...resolutions, ...followUps]) {
    if (!source.id || !source.publicSummary) continue;
    byId.set(`${source.sourceType}:${source.sourceId}`, source);
  }
  return [...byId.values()]
    .sort((first, second) => second.generatedAtTurn - first.generatedAtTurn || first.id.localeCompare(second.id))
    .slice(0, OFFICIAL_COURT_RESPONSE_LIMITS.maxItems);
}

function responseMatchesSource(response = {}, source = {}) {
  if (source.sourceType === "official_court_response") {
    return response.sourceType === "official_court_response" && (
      response.sourceId === source.sourceId ||
      response.sourceResponseId === source.sourceId ||
      response.previousResponseId === source.sourceId
    );
  }
  return response.sourceId === source.sourceId ||
    (source.sourceResolutionId && response.sourceResolutionId === source.sourceResolutionId) ||
    (source.sourceFollowUpId && response.sourceFollowUpId === source.sourceFollowUpId) ||
    (source.sourceEntryId && response.sourceEntryId === source.sourceEntryId);
}

function latestResponseForSource(source = {}, responses = []) {
  return responses
    .filter((response) => responseMatchesSource(response, source))
    .sort((first, second) => first.generatedAtTurn - second.generatedAtTurn)
    .at(-1) || null;
}

function responseLabelForRole(role) {
  if (role === "emperor") return "朱批回应";
  if (role === "minister") return "票拟覆奏";
  if (role === "official") return "补据回奏";
  return "有司回应";
}

function draftTextForSource(source = {}, role = "bureau") {
  const title = cleanText(source.title, "奏议材料", 72);
  const isChainSource = source.sourceType === "official_court_response" || source.chainRound > 0;
  if (isChainSource && role === "emperor") {
    return cleanText(`御前再摘${title}：承前回应只问可行、不可行、待查三项，仍不写任免赏罚或钱粮成数。`);
  }
  if (isChainSource && role === "minister") {
    return cleanText(`部院再覆${title}：承御前或朝议意见，列公开凭据、经手人、限期和仍须裁决之处。`);
  }
  if (isChainSource && role === "official") {
    return cleanText(`补据承批${title}：呈明公开进度、上官签注和可核证据，后续仍候服务器裁决。`);
  }
  if (isChainSource) {
    return cleanText(`续办${title}：只列公开证据、疑点和下一轮可办事项。`);
  }
  if (role === "emperor") {
    return cleanText(`朱批${title}：令部院据公开凭据覆奏，可行、不可行与待查分列；此批只作草稿，后果仍候服务器裁决。`);
  }
  if (role === "minister") {
    return cleanText(`票拟覆奏${title}：列公开凭据、经手人、限期和仍须御前或服务器裁决之处，不自行定赏罚处分。`);
  }
  if (role === "official") {
    return cleanText(`补据回奏${title}：呈明公开进度、上官签注、风险来源和请核事项，后续仍按服务器裁决。`);
  }
  return cleanText(`就${title}拟具公开回应，列明证据、疑点和后续普通回合可办事项。`);
}

function buildResponseItem(source = {}, responses = [], role = "bureau") {
  const latestResponse = latestResponseForSource(source, responses);
  return {
    id: cleanId(`court-response-item-${source.sourceType}-${source.sourceId}`, "court-response-item"),
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceEntryId: source.sourceEntryId,
    sourceResolutionId: source.sourceResolutionId,
    sourceFollowUpId: source.sourceFollowUpId,
    sourceResponseId: source.sourceResponseId,
    previousResponseId: source.previousResponseId,
    chainId: source.chainId,
    chainRound: source.chainRound,
    chainStageLabel: source.chainStageLabel,
    nextHandlerRole: source.nextHandlerRole,
    nextHandlerLabel: source.nextHandlerLabel,
    chainPath: source.chainPath,
    title: source.title,
    publicSummary: source.publicSummary,
    stageLabel: source.chainStageLabel || source.stageLabel,
    statusLabel: latestResponse?.statusLabel || source.statusLabel,
    responseLabel: responseLabelForRole(role),
    targetSurfaceId: source.targetSurfaceId,
    generatedAtTurn: source.generatedAtTurn,
    year: source.year,
    month: source.month,
    tenDayPeriod: source.tenDayPeriod,
    sourceRefs: source.sourceRefs,
    consequenceRefs: source.consequenceRefs,
    draftText: draftTextForSource(source, role),
    latestResponse: latestResponse ? {
      id: latestResponse.id,
      responseRoleLabel: latestResponse.responseRoleLabel,
      responseKindLabel: latestResponse.responseKindLabel,
      statusLabel: latestResponse.statusLabel,
      chainRound: latestResponse.chainRound,
      chainStageLabel: latestResponse.chainStageLabel,
      nextHandlerLabel: latestResponse.nextHandlerLabel,
      publicSummary: latestResponse.publicSummary,
      generatedAtTurn: latestResponse.generatedAtTurn
    } : null,
    visibility: "player_visible",
    confidence: 0.82
  };
}

function buildNextActions(responseItems = [], role = "bureau") {
  const top = responseItems[0];
  if (!top) return [];
  const title = cleanText(top.title, "奏议材料", 72);
  const isChainSource = top.sourceType === "official_court_response" || top.chainRound > 0;
  if (isChainSource) {
    const roleActions = {
      emperor: [
        { id: "imperial-revisit", label: "御前再摘", text: `御前再摘${title}，承前回应只问可行、不可行、待查三项，不写已生效批旨。`, targetSurfaceId: "edict-draft" },
        { id: "return-bureau-chain", label: "再交部院", text: `再交部院复核${title}，限列公开凭据、经手人和仍须服务器裁决之处。`, targetSurfaceId: "memorial-review" },
        { id: "hold-chain-debate", label: "留待廷议", text: `留待廷议复核${title}，只形成公开意见和下一轮补据清单。`, targetSurfaceId: "court-debate" }
      ],
      minister: [
        { id: "ministry-chain-reply", label: "部院再覆", text: `部院再覆${title}，承前批示分列可行、不可行、待查，不自行定赏罚处分。`, targetSurfaceId: "memorial-review" },
        { id: "chain-evidence-request", label: "续请补据", text: `续请补齐${title}的公开凭据、上官签注和经手文移，再候普通回合裁决。`, targetSurfaceId: "memorial-review" },
        { id: "chain-censor-review", label: "会核风宪", text: `会同台谏核${title}的风险与避嫌事项，只作公开观察。`, targetSurfaceId: "court-debate" }
      ],
      official: [
        { id: "official-chain-evidence", label: "补据承批", text: `补据承批${title}，呈明公开进度、上官签注和可核证据。`, targetSurfaceId: "memorial-review" },
        { id: "official-chain-assessment", label: "续入考成", text: `把${title}续入考成观察，只列公开功绩、风险和待核证据。`, targetSurfaceId: "assessment-trace" },
        { id: "official-chain-superior", label: "请署签注", text: `请上官就${title}签注公开进度，再候服务器裁决。`, targetSurfaceId: "court-debate" }
      ]
    };
    return (roleActions[role] || roleActions.minister)
      .map((action) => ({
        ...action,
        text: cleanText(action.text, "", OFFICIAL_COURT_RESPONSE_LIMITS.maxTextLength)
      }))
      .filter((action) => action.text)
      .slice(0, OFFICIAL_COURT_RESPONSE_LIMITS.maxActions);
  }
  const roleActions = {
    emperor: [
      { id: "vermilion-note", label: "朱批留览", text: `朱批留览${title}，令部院据公开凭据覆奏，此稿只候服务器裁决。`, targetSurfaceId: "edict-draft" },
      { id: "refer-bureau", label: "发交部院", text: `发交部院复核${title}，列可行、不可行与待查三项，不直接任免赏罚。`, targetSurfaceId: "memorial-review" },
      { id: "court-comment", label: "召议摘报", text: `召集朝议摘报${title}，只形成公开意见和后续补据清单。`, targetSurfaceId: "court-debate" }
    ],
    minister: [
      { id: "bureau-reply", label: "票拟覆奏", text: `票拟覆奏${title}，列公开凭据、经手人、限期和仍须御前裁夺之处。`, targetSurfaceId: "memorial-review" },
      { id: "request-evidence", label: "请补公开凭据", text: `请补${title}的公开凭据、上官签注和经手文移，暂不定赏罚处分。`, targetSurfaceId: "memorial-review" },
      { id: "court-deliberation", label: "会同台谏", text: `会同台谏复核${title}，只列风险、避嫌和后续待查事项。`, targetSurfaceId: "court-debate" }
    ],
    official: [
      { id: "official-evidence", label: "补据回奏", text: `补据回奏${title}，说明公开进度、风险来源和请核事项。`, targetSurfaceId: "memorial-review" },
      { id: "assessment-note", label: "续记考成", text: `续记${title}入考成观察，只列公开功绩、风险和待核证据。`, targetSurfaceId: "assessment-trace" },
      { id: "superior-endorsement", label: "请上官签注", text: `请上官就${title}签注公开进度和可核凭据，再候服务器裁决。`, targetSurfaceId: "court-debate" }
    ]
  };
  return (roleActions[role] || roleActions.minister)
    .map((action) => ({
      ...action,
      text: cleanText(action.text, "", OFFICIAL_COURT_RESPONSE_LIMITS.maxTextLength)
    }))
    .filter((action) => action.text)
    .slice(0, OFFICIAL_COURT_RESPONSE_LIMITS.maxActions);
}

function buildOfficialCourtResponseView(worldState = {}) {
  const state = normalizeOfficialCourtResponseState(worldState);
  const role = cleanId(worldState.player?.role, "scholar");
  const responseRole = roleForPlayerRole(role);
  const sources = buildOfficialCourtResponseSources(worldState);
  const sourceItems = sources.map((source) => buildResponseItem(source, state.responses, responseRole));
  const chainItems = sourceItems.filter((item) => item.sourceType === "official_court_response" || item.chainRound > 0);
  const responseItems = sourceItems.filter((item) => item.sourceType !== "official_court_response" && !item.chainRound);
  const actionableChainItems = chainItems.filter((item) => item.nextHandlerRole === responseRole);
  const nextActions = buildNextActions([...actionableChainItems, ...responseItems], responseRole);
  const active = PLAYER_RESPONSE_ROLES.has(role) && (sourceItems.length > 0 || state.responses.length > 0);
  return {
    schemaVersion: OFFICIAL_COURT_RESPONSE_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    active,
    role,
    responseRole,
    responseRoleLabel: OFFICIAL_COURT_RESPONSE_ROLE_LABELS[responseRole] || "有司",
    summary: active
      ? cleanText(`当前有${responseItems.length}条奏议材料和${chainItems.length}条皇帝/部院续办链路可回应，近次回应${state.responses.length}条；所有回应只入服务器安全账本。`)
      : "当前没有可见奏议材料可回应；不得补造署名、罪名、钱粮数、任免结果或已生效批旨。",
    counts: {
      chainItems: chainItems.length,
      actionableChainItems: actionableChainItems.length,
      responseItems: responseItems.length,
      recentResponses: state.responses.length
    },
    chainItems,
    responseItems,
    recentResponses: state.responses.slice(-OFFICIAL_COURT_RESPONSE_LIMITS.maxResponses),
    nextActions,
    aiReadScope: OFFICIAL_COURT_RESPONSE_AI_READ_SCOPE,
    toolPermissions: OFFICIAL_COURT_RESPONSE_TOOL_PERMISSIONS,
    proposalBoundaries: [
      "只能生成公开回应草稿、补据清单、覆奏要点和朝议意见。",
      "续办链路只能承接上一轮公开回应，不得跳写官职任免、奖惩处分、拨钱粮、奏折采纳终局、成弹劾或隐藏状态。"
    ],
    serverAdjudication: OFFICIAL_COURT_RESPONSE_SERVER_ADJUDICATION,
    authorityBoundary: OFFICIAL_COURT_RESPONSE_AUTHORITY_BOUNDARY,
    safety: {
      readOnlyView: true,
      draftOnlyFrontend: true,
      serverAdjudicatedResponseLedger: true,
      noDirectAppointment: true,
      noDirectPunishment: true,
      noDirectImpeachmentResolution: true,
      noRawStateExposure: true
    }
  };
}

function isCourtResponseLikeInput(input = "") {
  const text = cleanText(input, "", 360);
  if (!text) return false;
  return /奏议回应|奏议后续|续办|承前|续批|再批|再摘|再覆|复覆|近次裁决|朱批|批红|留中|票拟|覆奏|御前摘报|批复|补据|发交部院|转部|朝议跟进|廷议跟进|考成观察/.test(text);
}

function chooseResponseKind(input = "") {
  const text = cleanText(input, "", 360);
  if (/朱批|批红|御前|御览|留中|摘报|续批|再批|再摘/.test(text)) return "vermilion_note";
  if (/票拟|覆奏|复覆|再覆|部院|转部|发交部院|部议/.test(text)) return "bureau_reply";
  if (/朝议|廷议|会同|会商|台谏/.test(text)) return "court_comment";
  if (/补据|承批|凭据|查证|签注|经手文移/.test(text)) return "evidence_request";
  if (/考成|考课|观察|功绩|风险/.test(text)) return "assessment_note";
  return "bureau_reply";
}

function findTargetResponseItem(responseItems = [], input = "") {
  const text = cleanText(input, "", 360);
  if (!text) return responseItems[0] || null;
  const continuationItems = responseItems.filter((item) =>
    item.sourceType === "official_court_response" || item.chainRound > 0
  );
  const orderedItems = continuationItems.length && /续办|承前|续批|再批|再摘|再覆|复覆|承批/.test(text)
    ? continuationItems
    : responseItems;
  return orderedItems.find((item) =>
    [
      item.title,
      typeof item.title === "string" ? item.title.replace(/^续办[:：]/, "") : "",
      item.sourceId,
      item.sourceResolutionId,
      item.sourceFollowUpId,
      item.sourceResponseId,
      item.previousResponseId,
      item.statusLabel,
      item.stageLabel,
      item.chainStageLabel
    ]
      .filter(Boolean)
      .some((value) => text.includes(cleanText(value, "", 96)))
  ) || orderedItems[0] || responseItems[0] || null;
}

function buildResponseSummary({ roleLabel, kindLabel, source, statusLabel }) {
  const title = cleanText(source.title, "奏议材料", 72);
  const stage = cleanText(source.stageLabel || source.statusLabel, "公开批复", 40);
  const chainRound = clampNumber(source.chainRound, 0, OFFICIAL_COURT_RESPONSE_LIMITS.maxChainRound, 0) + 1;
  const chainLabel = chainRound <= 1 ? "首轮" : `第${chainRound}轮`;
  return cleanText(
    `${chainLabel}${roleLabel}${kindLabel}${title}，承接${stage}，只记录公开回应、证据边界和后续待核事项；${statusLabel}不改变官职、奖惩、处分、钱粮或弹劾结果。`
  );
}

function resolveOfficialCourtResponseSubmission(worldState = {}, input = "") {
  const role = cleanId(worldState.player?.role, "scholar");
  if (!PLAYER_RESPONSE_ROLES.has(role) || !isCourtResponseLikeInput(input)) return null;
  const view = buildOfficialCourtResponseView(worldState);
  const responseRole = roleForPlayerRole(role);
  const actionableChainItems = asArray(view.chainItems).filter((item) => item.nextHandlerRole === responseRole);
  const responseItems = [...actionableChainItems, ...asArray(view.responseItems)];
  if (!view.active || !responseItems.length) return null;
  const source = findTargetResponseItem(responseItems, input);
  if (!source) return null;
  const responseKind = chooseResponseKind(input);
  const status = statusForKind(responseKind);
  const turn = currentTurn(worldState);
  const existingCount = normalizeOfficialCourtResponseState(worldState).responses.length + 1;
  const responseRoleLabel = OFFICIAL_COURT_RESPONSE_ROLE_LABELS[responseRole] || "有司";
  const responseKindLabel = OFFICIAL_COURT_RESPONSE_KIND_LABELS[responseKind] || "奏议回应";
  const statusLabel = OFFICIAL_COURT_RESPONSE_STATUS_LABELS[status] || "回应已记";
  const sourceChainRound = clampNumber(source.chainRound, 0, OFFICIAL_COURT_RESPONSE_LIMITS.maxChainRound, 0);
  const chainRound = clampNumber(sourceChainRound + 1, 1, OFFICIAL_COURT_RESPONSE_LIMITS.maxChainRound, 1);
  const previousResponseId = source.sourceType === "official_court_response"
    ? cleanId(source.sourceResponseId || source.sourceId, "")
    : "";
  const nextHandlerRole = nextHandlerRoleForResponse(responseKind, responseRole);
  const nextHandlerLabel = OFFICIAL_COURT_RESPONSE_ROLE_LABELS[nextHandlerRole] || "有司";
  const chainStepLabel = `${responseRoleLabel}${responseKindLabel}`;
  return normalizeOfficialCourtResponse({
    id: `OCR-${String(turn).padStart(4, "0")}-${responseRole}-${responseKind}-${existingCount}`,
    responseRole,
    responseRoleLabel,
    responseKind,
    responseKindLabel,
    status,
    statusLabel,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceEntryId: source.sourceEntryId,
    sourceResolutionId: source.sourceResolutionId,
    sourceFollowUpId: source.sourceFollowUpId,
    sourceResponseId: source.sourceResponseId,
    previousResponseId,
    chainId: source.chainId || `${source.sourceType}:${source.sourceId}`,
    chainRound,
    chainStage: responseKind,
    chainStageLabel: defaultChainStageLabel(chainRound, responseRoleLabel, responseKindLabel),
    nextHandlerRole,
    nextHandlerLabel,
    chainPath: cleanList([
      ...asArray(source.chainPath),
      chainStepLabel
    ], OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 80),
    title: `${responseKindLabel}：${source.title}`,
    publicSummary: buildResponseSummary({ roleLabel: responseRoleLabel, kindLabel: responseKindLabel, source, statusLabel }),
    generatedAtTurn: turn,
    ...currentDateParts(worldState),
    sourceRefs: cleanList([
      `courtResponseView.responseItem:${source.id}`,
      `${source.sourceType}:${source.sourceId}`,
      previousResponseId ? `courtResponseView.recentResponse:${previousResponseId}` : "",
      ...asArray(source.sourceRefs)
    ], OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 96),
    evidenceRefs: cleanList([
      `${source.sourceType}:${source.sourceId}`,
      source.sourceResolutionId ? `officialCareer.courtEntryResolution:${source.sourceResolutionId}` : "",
      source.sourceFollowUpId ? `officialCareer.courtEntryFollowUp:${source.sourceFollowUpId}` : "",
      previousResponseId ? `courtResponseView.recentResponse:${previousResponseId}` : ""
    ], OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 96),
    consequenceRefs: cleanList([
      "eventArchive:official_court_response",
      "worldThread:official_court_response",
      ...asArray(source.consequenceRefs)
    ], OFFICIAL_COURT_RESPONSE_LIMITS.maxSourceRefs, 96),
    nextStep: status === "requested_evidence"
      ? "下一步补公开凭据、上官签注和经手文移，再候普通回合裁决。"
      : status === "assessment_watch"
        ? "下一步继续考成观察，待考成期由服务器合并结算。"
        : "下一步等待相关部院、御前或朝议按公开材料复核。"
  }, worldState);
}

function buildOfficialCourtResponseAttributeChanges(beforeState = {}, response = null, nextState = {}) {
  if (!response) return [];
  const beforeCount = asArray(beforeState.officialCourtResponses?.responses).length;
  const afterCount = asArray(nextState.officialCourtResponses?.responses).length;
  return [{
    path: "officialCourtResponses.responses",
    label: "奏议回应",
    before: beforeCount,
    after: afterCount,
    reason: "服务器记录跨身份奏议回应与续办链路中间态，不写任免、赏罚、处分或弹劾终局。"
  }];
}

function runOfficialCourtResponseStep(worldState = {}, input = "") {
  const beforeState = JSON.parse(JSON.stringify(worldState || {}));
  const state = normalizeOfficialCourtResponseState(worldState);
  const response = resolveOfficialCourtResponseSubmission({
    ...worldState,
    officialCourtResponses: state
  }, input);
  const result = {
    schemaVersion: OFFICIAL_COURT_RESPONSE_SCHEMA_VERSION,
    statePatch: {},
    attributeChanges: [],
    relationshipChanges: [],
    events: [],
    summary: "",
    outcome: response
  };
  if (!response) return result;

  const nextState = {
    ...state,
    responses: normalizeOfficialCourtResponses([
      ...state.responses,
      response
    ], worldState)
  };
  result.statePatch.officialCourtResponses = nextState;
  result.attributeChanges = buildOfficialCourtResponseAttributeChanges(
    beforeState,
    response,
    { officialCourtResponses: nextState }
  );
  result.events.push(`[奏议回应记录] ${response.title}：${response.publicSummary}`);
  result.summary = result.events.join(" ");
  return result;
}

module.exports = {
  OFFICIAL_COURT_RESPONSE_SCHEMA_VERSION,
  buildOfficialCourtResponseView,
  createInitialOfficialCourtResponseState,
  ensureOfficialCourtResponseState,
  isCourtResponseLikeInput,
  normalizeOfficialCourtResponse,
  normalizeOfficialCourtResponseState,
  normalizeOfficialCourtResponses,
  resolveOfficialCourtResponseSubmission,
  runOfficialCourtResponseStep
};
