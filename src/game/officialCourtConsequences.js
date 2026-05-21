const { normalizeOfficialCareerState, buildOfficialCareerView } = require("./officialCareer");
const { buildOfficialCourtResponseView } = require("./officialCourtResponse");
const { monthsToTurns } = require("./time");
const {
  OFFICIAL_COURT_CONSEQUENCE_AI_READ_SCOPE,
  OFFICIAL_COURT_CONSEQUENCE_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_CONSEQUENCE_KIND_LABELS,
  OFFICIAL_COURT_CONSEQUENCE_KINDS,
  OFFICIAL_COURT_CONSEQUENCE_LIMITS,
  OFFICIAL_COURT_CONSEQUENCE_SCHEMA_VERSION,
  OFFICIAL_COURT_CONSEQUENCE_SERVER_ADJUDICATION,
  OFFICIAL_COURT_CONSEQUENCE_STATUS_LABELS,
  OFFICIAL_COURT_CONSEQUENCE_STATUSES,
  OFFICIAL_COURT_CONSEQUENCE_TOOL_PERMISSIONS
} = require("./officialCourtConsequencesConfig");

const CONSEQUENCE_KIND_SET = new Set(OFFICIAL_COURT_CONSEQUENCE_KINDS);
const CONSEQUENCE_STATUS_SET = new Set(OFFICIAL_COURT_CONSEQUENCE_STATUSES);

const OFFICIAL_COURT_CONSEQUENCE_SENSITIVE_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|state|row)|\b(?:provider|prompt|statePatch|worldState|provider\s+payload|provider\s+proposal|rawSql|SQL|sqlite|server\.)\b|完整\s*prompt|完整提示词|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const TERMINAL_DECISION_PATTERN =
  /(已(?:任免|处分|赏罚|采纳|拨款|拨饷)|已经(?:任免|处分|赏罚|采纳|生效)|采纳奏折|准奏|照准|题准|奉旨(?:准行|已行)|弹劾成案|已成弹劾|圣旨已生效|官缺已定|革职|罢黜|黜免|升迁|降调|赏银|罚俸|拨(?:给|付|发)?(?:钱粮|银两|粮饷|饷银|款项)|定罪|定赏|定罚|问罪|处分(?:成案|已定)|奖惩(?:成案|已定))/;

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

function cleanText(value, fallback = "", maxLength = OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxTextLength) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  if (OFFICIAL_COURT_CONSEQUENCE_SENSITIVE_PATTERN.test(text)) return fallback;
  if (TERMINAL_DECISION_PATTERN.test(text)) return fallback;
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
      ? cleanText(value.id || value.sourceId || value.label || value.title || value.publicSummary, "", maxLength)
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

function normalizeConsequenceKind(value, fallback = "court_attention") {
  const kind = cleanId(value, fallback);
  return CONSEQUENCE_KIND_SET.has(kind) ? kind : fallback;
}

function normalizeConsequenceStatus(value, fallback = "signal_recorded") {
  const status = cleanId(value, fallback);
  return CONSEQUENCE_STATUS_SET.has(status) ? status : fallback;
}

function normalizeOfficialCourtConsequenceSignal(raw = {}, worldState = {}) {
  if (!isPlainObject(raw)) return null;
  const turn = clampNumber(raw.generatedAtTurn ?? raw.turn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState));
  const signalKind = normalizeConsequenceKind(raw.signalKind, "court_attention");
  const status = normalizeConsequenceStatus(raw.status, "signal_recorded");
  const sourceType = cleanText(raw.sourceType, "official_court_response", 64);
  const sourceId = cleanId(raw.sourceId, "official-court-source");
  const title = cleanText(
    raw.title,
    `${OFFICIAL_COURT_CONSEQUENCE_KIND_LABELS[signalKind] || "官场后果"}：${sourceId}`,
    OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxShortTextLength
  );
  const publicSummary = cleanText(raw.publicSummary || raw.summary, "", OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxTextLength);
  if (!title || !publicSummary) return null;
  const date = currentDateParts(worldState);
  return {
    schemaVersion: OFFICIAL_COURT_CONSEQUENCE_SCHEMA_VERSION,
    id: cleanId(raw.id, `OCC-${String(turn).padStart(4, "0")}-${signalKind}`),
    signalKind,
    signalKindLabel: cleanText(
      raw.signalKindLabel,
      OFFICIAL_COURT_CONSEQUENCE_KIND_LABELS[signalKind] || "官场后果",
      40
    ),
    status,
    statusLabel: cleanText(
      raw.statusLabel,
      OFFICIAL_COURT_CONSEQUENCE_STATUS_LABELS[status] || "信号已记",
      40
    ),
    sourceType,
    sourceId,
    sourceTitle: cleanText(raw.sourceTitle, title, OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxShortTextLength),
    title,
    publicSummary,
    generatedAtTurn: turn,
    year: clampNumber(raw.year, 1, 9999, date.year),
    month: clampNumber(raw.month, 1, 12, date.month),
    tenDayPeriod: clampNumber(raw.tenDayPeriod, 1, 3, date.tenDayPeriod),
    meritDelta: clampNumber(raw.meritDelta, -3, 3, 0),
    riskDelta: clampNumber(raw.riskDelta, -3, 3, 0),
    courtAttentionDelta: clampNumber(raw.courtAttentionDelta, 0, 5, 1),
    impeachmentWatch: raw.impeachmentWatch === "risk_watch" ? "risk_watch" : "none",
    assessmentEffectLabel: cleanText(raw.assessmentEffectLabel, "只作考成观察，不作终局裁决。", 96),
    nextStep: cleanText(
      raw.nextStep,
      "后续按普通回合补证、月报摘录、考成期合并服务器结算。",
      OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxShortTextLength
    ),
    sourceRefs: cleanList(raw.sourceRefs, OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSourceRefs, 96),
    consequenceRefs: cleanList(raw.consequenceRefs, OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSourceRefs, 96),
    aiReadScope: cleanList(
      raw.aiReadScope || OFFICIAL_COURT_CONSEQUENCE_AI_READ_SCOPE,
      OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSourceRefs,
      96
    ),
    toolPermissions: cleanText(
      raw.toolPermissions,
      OFFICIAL_COURT_CONSEQUENCE_TOOL_PERMISSIONS,
      OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxTextLength
    ),
    serverAdjudication: cleanText(
      raw.serverAdjudication,
      OFFICIAL_COURT_CONSEQUENCE_SERVER_ADJUDICATION,
      OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxTextLength
    ),
    authorityBoundary: OFFICIAL_COURT_CONSEQUENCE_AUTHORITY_BOUNDARY,
    visibility: "player_visible",
    confidence: 0.84
  };
}

function normalizeOfficialCourtConsequenceSignals(signals = [], worldState = {}) {
  return asArray(signals)
    .map((signal) => normalizeOfficialCourtConsequenceSignal(signal, worldState))
    .filter(Boolean)
    .slice(-OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSignals);
}

function createInitialOfficialCourtConsequenceState() {
  return {
    schemaVersion: OFFICIAL_COURT_CONSEQUENCE_SCHEMA_VERSION,
    signals: []
  };
}

function normalizeOfficialCourtConsequenceState(worldState = {}) {
  const source = isPlainObject(worldState.officialCourtConsequences) ? worldState.officialCourtConsequences : {};
  return {
    schemaVersion: OFFICIAL_COURT_CONSEQUENCE_SCHEMA_VERSION,
    signals: normalizeOfficialCourtConsequenceSignals(source.signals, worldState)
  };
}

function ensureOfficialCourtConsequenceState(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.officialCourtConsequences = normalizeOfficialCourtConsequenceState(worldState);
  return worldState;
}

function sourceRecordFromCareerRow(row = {}, sourceType = "official_court_follow_up") {
  const sourceId = cleanId(row.id || row.sourceId, "official-court-source");
  const title = cleanText(row.title || row.statusLabel, "官场奏议", OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxShortTextLength);
  const publicSummary = cleanText(row.publicSummary || row.summary, "", OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxTextLength);
  if (!sourceId || !publicSummary) return null;
  return {
    sourceType,
    sourceId,
    title,
    publicSummary,
    statusLabel: cleanText(row.statusLabel || row.stageLabel, "公开记录", 40),
    generatedAtTurn: clampNumber(row.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    year: clampNumber(row.year, 1, 9999, 1644),
    month: clampNumber(row.month, 1, 12, 1),
    tenDayPeriod: clampNumber(row.tenDayPeriod, 1, 3, 1),
    sourceRefs: cleanList(row.sourceRefs, OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSourceRefs, 96),
    consequenceRefs: cleanList(row.consequenceRefs, OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSourceRefs, 96),
    rawKind: cleanText(row.status || row.stage || row.responseKind, "", 64)
  };
}

function sourceRecordFromResponse(response = {}) {
  const sourceId = cleanId(response.id || response.sourceId, "official-court-response");
  const title = cleanText(response.title || response.responseKindLabel, "奏议回应", OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxShortTextLength);
  const publicSummary = cleanText(response.publicSummary || response.summary, "", OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxTextLength);
  if (!sourceId || !publicSummary) return null;
  return {
    sourceType: "official_court_response",
    sourceId,
    title,
    publicSummary,
    statusLabel: cleanText(response.statusLabel || response.responseKindLabel, "奏议回应", 40),
    generatedAtTurn: clampNumber(response.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    year: clampNumber(response.year, 1, 9999, 1644),
    month: clampNumber(response.month, 1, 12, 1),
    tenDayPeriod: clampNumber(response.tenDayPeriod, 1, 3, 1),
    sourceRefs: cleanList(response.sourceRefs, OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSourceRefs, 96),
    consequenceRefs: cleanList(response.consequenceRefs, OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSourceRefs, 96),
    rawKind: cleanText(response.responseKind || response.status, "", 64)
  };
}

function buildOfficialCourtConsequenceSources(worldState = {}) {
  const officialCareer = normalizeOfficialCareerState(worldState);
  const officialCareerView = buildOfficialCareerView(worldState);
  const courtResponseView = buildOfficialCourtResponseView(worldState);
  const courtEntryResolutions = [
    ...asArray(officialCareer.courtEntryResolutions),
    ...asArray(officialCareerView.courtEntryResolutions)
  ];
  const courtEntryFollowUps = [
    ...asArray(officialCareer.courtEntryFollowUps),
    ...asArray(officialCareerView.courtEntryFollowUps)
  ];
  const sources = [
    ...courtEntryResolutions
      .map((row) => sourceRecordFromCareerRow(row, "official_court_entry")),
    ...courtEntryFollowUps
      .map((row) => sourceRecordFromCareerRow(row, "official_court_follow_up")),
    ...asArray(courtResponseView.recentResponses)
      .map(sourceRecordFromResponse)
  ].filter(Boolean);
  const byKey = new Map();
  for (const source of sources) {
    byKey.set(`${source.sourceType}:${source.sourceId}`, source);
  }
  return [...byKey.values()]
    .sort((first, second) => second.generatedAtTurn - first.generatedAtTurn || first.sourceId.localeCompare(second.sourceId))
    .slice(0, OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSources);
}

function signalMatchesSource(signal = {}, source = {}) {
  return signal.sourceType === source.sourceType && signal.sourceId === source.sourceId;
}

function latestSignalForSource(source = {}, signals = []) {
  return signals
    .filter((signal) => signalMatchesSource(signal, source))
    .sort((first, second) => first.generatedAtTurn - second.generatedAtTurn)
    .at(-1) || null;
}

function classifySignalForSource(source = {}) {
  const text = `${source.title || ""} ${source.publicSummary || ""} ${source.statusLabel || ""} ${source.rawKind || ""}`;
  if (/补据|凭据|待查|驳回|returned|evidence/i.test(text)) {
    return {
      signalKind: "evidence_gap",
      status: "evidence_pending",
      meritDelta: 0,
      riskDelta: 1,
      courtAttentionDelta: 2,
      impeachmentWatch: "none",
      nextStep: "先补公开凭据、上官签注和经手文移，再择期重入部院或朝议复核。"
    };
  }
  if (/台谏|风宪|风险|弹劾|留中|补查|watch|inquiry/i.test(text)) {
    return {
      signalKind: "impeachment_watch",
      status: "watchlist",
      meritDelta: 0,
      riskDelta: 2,
      courtAttentionDelta: 3,
      impeachmentWatch: "risk_watch",
      nextStep: "列入风宪观察，只提示风险与补证方向，不把观察等同成案。"
    };
  }
  if (/考成|考课|观察|功绩|assessment|recorded/i.test(text)) {
    return {
      signalKind: "assessment_pressure",
      status: "assessment_noted",
      meritDelta: 1,
      riskDelta: /风险|risk/i.test(text) ? 1 : 0,
      courtAttentionDelta: 1,
      impeachmentWatch: "none",
      nextStep: "合入本任考成观察，待考成期由服务器汇总功过。"
    };
  }
  if (/御前|朱批|朝议|留览|imperial|court/i.test(text)) {
    return {
      signalKind: "court_attention",
      status: "monthly_trace",
      meritDelta: 1,
      riskDelta: 0,
      courtAttentionDelta: 3,
      impeachmentWatch: "none",
      nextStep: "作为朝廷关注线索进入月报和世界议程，后续仍按普通回合推进。"
    };
  }
  return {
    signalKind: "merit_trace",
    status: "signal_recorded",
    meritDelta: 1,
    riskDelta: 0,
    courtAttentionDelta: 1,
    impeachmentWatch: "none",
    nextStep: "记录为功绩留痕，待后续奏议、月报或考成期合并判断。"
  };
}

function isCourtConsequenceLikeInput(input = "") {
  const text = cleanText(input, "", 360);
  if (!text) return false;
  return /长期后果|官场后果|考成合并|合入考成|本任考成|考成信号|弹劾风险|风宪|台谏观察|月报摘录|议程追踪|世界后果|后续世界|功过留痕/.test(text);
}

function findTargetSource(sources = [], input = "") {
  const text = cleanText(input, "", 360);
  if (!text) return sources[0] || null;
  return sources.find((source) =>
    [source.title, source.sourceId, source.statusLabel].filter(Boolean).some((value) =>
      text.includes(cleanText(value, "", 96))
    )
  ) || sources[0] || null;
}

function buildSignalSummary(source = {}, decision = {}) {
  const kindLabel = OFFICIAL_COURT_CONSEQUENCE_KIND_LABELS[decision.signalKind] || "官场后果";
  const statusLabel = OFFICIAL_COURT_CONSEQUENCE_STATUS_LABELS[decision.status] || "信号已记";
  const effect = `考成观察为功绩${decision.meritDelta >= 0 ? "+" : ""}${decision.meritDelta}、风险${decision.riskDelta >= 0 ? "+" : ""}${decision.riskDelta}`;
  return cleanText(
    `${statusLabel}：${source.title}转为${kindLabel}，承接${source.statusLabel || "公开奏议"}；${effect}，只入长期观察、月报和世界议程，后续官缺、赏罚、财赋、奏议终局和风宪成案仍由服务器规则裁决。`
  );
}

function resolveOfficialCourtConsequenceSignal(worldState = {}, input = "", options = {}) {
  const state = normalizeOfficialCourtConsequenceState(worldState);
  const sources = buildOfficialCourtConsequenceSources(worldState);
  if (!sources.length) return null;
  const triggered = options.force === true || options.isMonthEnd === true || isCourtConsequenceLikeInput(input);
  if (!triggered) return null;
  const source = findTargetSource(sources, input);
  if (!source) return null;
  const existing = latestSignalForSource(source, state.signals);
  if (existing && existing.generatedAtTurn >= source.generatedAtTurn) return null;
  const decision = classifySignalForSource(source);
  const turn = currentTurn(worldState);
  const existingCount = state.signals.length + 1;
  const date = currentDateParts(worldState);
  return normalizeOfficialCourtConsequenceSignal({
    id: `OCC-${String(turn).padStart(4, "0")}-${decision.signalKind}-${existingCount}`,
    signalKind: decision.signalKind,
    signalKindLabel: OFFICIAL_COURT_CONSEQUENCE_KIND_LABELS[decision.signalKind],
    status: decision.status,
    statusLabel: OFFICIAL_COURT_CONSEQUENCE_STATUS_LABELS[decision.status],
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceTitle: source.title,
    title: `${OFFICIAL_COURT_CONSEQUENCE_KIND_LABELS[decision.signalKind]}：${source.title}`,
    publicSummary: buildSignalSummary(source, decision),
    generatedAtTurn: turn,
    ...date,
    meritDelta: decision.meritDelta,
    riskDelta: decision.riskDelta,
    courtAttentionDelta: decision.courtAttentionDelta,
    impeachmentWatch: decision.impeachmentWatch,
    assessmentEffectLabel: `功绩${decision.meritDelta >= 0 ? "+" : ""}${decision.meritDelta}，风险${decision.riskDelta >= 0 ? "+" : ""}${decision.riskDelta}；不作终局。`,
    nextStep: decision.nextStep,
    sourceRefs: cleanList([
      `${source.sourceType}:${source.sourceId}`,
      ...asArray(source.sourceRefs)
    ], OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSourceRefs, 96),
    consequenceRefs: cleanList([
      "eventArchive:official_court_consequence",
      "worldThread:official_court_consequence",
      "playerMonthlyBriefing:official_duties",
      ...asArray(source.consequenceRefs)
    ], OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSourceRefs, 96)
  }, worldState);
}

function buildPendingSourceItem(source = {}, signals = []) {
  const latestSignal = latestSignalForSource(source, signals);
  return {
    id: cleanId(`court-consequence-source-${source.sourceType}-${source.sourceId}`, "court-consequence-source"),
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    title: source.title,
    publicSummary: source.publicSummary,
    statusLabel: latestSignal?.statusLabel || source.statusLabel,
    generatedAtTurn: source.generatedAtTurn,
    sourceRefs: source.sourceRefs,
    consequenceRefs: source.consequenceRefs,
    latestSignal: latestSignal ? {
      id: latestSignal.id,
      signalKindLabel: latestSignal.signalKindLabel,
      statusLabel: latestSignal.statusLabel,
      publicSummary: latestSignal.publicSummary,
      assessmentEffectLabel: latestSignal.assessmentEffectLabel,
      generatedAtTurn: latestSignal.generatedAtTurn
    } : null,
    visibility: "player_visible",
    confidence: 0.84
  };
}

function buildNextActions(pendingSources = []) {
  const top = pendingSources[0];
  const title = cleanText(top?.title, "近次奏议", 72);
  if (!top) return [];
  return [
    {
      id: "merge-assessment",
      label: "合入考成观察",
      text: cleanText(`将${title}合入本任考成观察，只列公开功过和待核凭据，后果仍候服务器裁决。`)
    },
    {
      id: "watch-impeachment-risk",
      label: "风宪风险复核",
      text: cleanText(`复核${title}的风宪风险，只列风险来源、避嫌事项和补证清单，不作风宪定案。`)
    },
    {
      id: "monthly-trace",
      label: "月报摘录",
      text: cleanText(`把${title}摘入官职月报和世界议程，后续按普通回合继续补证、覆奏或考成观察。`)
    }
  ].slice(0, OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxActions);
}

function buildOfficialCourtConsequenceView(worldState = {}) {
  const state = normalizeOfficialCourtConsequenceState(worldState);
  const sources = buildOfficialCourtConsequenceSources(worldState);
  const pendingSources = sources.map((source) => buildPendingSourceItem(source, state.signals));
  const active = pendingSources.length > 0 || state.signals.length > 0;
  return {
    schemaVersion: OFFICIAL_COURT_CONSEQUENCE_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    active,
    summary: active
      ? cleanText(`当前有${pendingSources.length}条奏议链路可转为长期官场后果信号，近次信号${state.signals.length}条；所有信号只入考成观察、月报和世界议程。`)
      : "当前没有可见奏议链路可形成长期官场后果信号；不得补造官缺调整、处分终局、财赋动用、风宪定案或奏议终局。",
    counts: {
      pendingSources: pendingSources.length,
      recentSignals: state.signals.length
    },
    pendingSources,
    recentSignals: state.signals.slice(-OFFICIAL_COURT_CONSEQUENCE_LIMITS.maxSignals),
    nextActions: buildNextActions(pendingSources),
    aiReadScope: OFFICIAL_COURT_CONSEQUENCE_AI_READ_SCOPE,
    toolPermissions: OFFICIAL_COURT_CONSEQUENCE_TOOL_PERMISSIONS,
    proposalBoundaries: [
      "只能生成考成观察、风宪风险、补据清单、月报摘录和世界议程草稿。",
      "不得写官缺调整、奖惩处分终局、财赋动用、奏议终局、风宪定案或隐藏状态。"
    ],
    serverAdjudication: OFFICIAL_COURT_CONSEQUENCE_SERVER_ADJUDICATION,
    authorityBoundary: OFFICIAL_COURT_CONSEQUENCE_AUTHORITY_BOUNDARY,
    safety: {
      readOnlyView: true,
      draftOnlyFrontend: true,
      serverAdjudicatedSignals: true,
      noDirectAppointment: true,
      noDirectPunishment: true,
      noDirectImpeachmentResolution: true,
      noRawStateExposure: true
    }
  };
}

function applySignalToOfficialCareer(worldState = {}, signal = null) {
  if (!signal || worldState.player?.role !== "official") return null;
  const career = normalizeOfficialCareerState(worldState);
  const note = cleanText(`${signal.signalKindLabel}：${signal.assessmentEffectLabel} ${signal.nextStep}`);
  const nextDossier = {
    ...career.assessmentDossier,
    meritScore: clampNumber(career.assessmentDossier.meritScore + signal.meritDelta, 0, 100, career.assessmentDossier.meritScore),
    riskScore: clampNumber(career.assessmentDossier.riskScore + signal.riskDelta, 0, 100, career.assessmentDossier.riskScore),
    lastUpdatedTurn: currentTurn(worldState),
    notes: [note, ...(career.assessmentDossier.notes || [])]
      .filter(Boolean)
      .slice(0, 5)
  };
  let nextImpeachmentProcedure = career.impeachmentProcedure;
  if (signal.impeachmentWatch === "risk_watch" && career.impeachmentProcedure.stage === "none") {
    nextImpeachmentProcedure = {
      ...career.impeachmentProcedure,
      stage: "risk_watch",
      sourceType: "official_court_consequence",
      sourceId: signal.id,
      openedTurn: currentTurn(worldState),
      dueTurn: currentTurn(worldState) + monthsToTurns(4),
      deadlineUnit: "ten_day",
      risk: Math.max(career.impeachmentProcedure.risk || 0, clampNumber((worldState.player?.impeachmentRisk || 0) + signal.riskDelta * 6, 0, 100, 0)),
      visibleNotice: cleanText(`${signal.signalKindLabel}已列风宪观察：${signal.nextStep}`),
      hiddenNotes: [],
      lastUpdatedTurn: currentTurn(worldState)
    };
  }
  return normalizeOfficialCareerState({
    ...worldState,
    officialCareer: {
      ...career,
      assessmentDossier: nextDossier,
      impeachmentProcedure: nextImpeachmentProcedure
    }
  });
}

function buildAttributeChanges(beforeState = {}, signal = null, nextState = {}) {
  if (!signal) return [];
  const beforeCount = asArray(beforeState.officialCourtConsequences?.signals).length;
  const afterCount = asArray(nextState.officialCourtConsequences?.signals).length;
  const changes = [{
    path: "officialCourtConsequences.signals",
    label: "官场后果",
    before: beforeCount,
    after: afterCount,
    reason: "服务器记录长期官场后果信号，不写任免、赏罚、处分或弹劾终局。"
  }];
  const beforeDossier = beforeState.officialCareer?.assessmentDossier || {};
  const afterDossier = nextState.officialCareer?.assessmentDossier || {};
  for (const key of ["meritScore", "riskScore"]) {
    if (typeof beforeDossier[key] === "number" && typeof afterDossier[key] === "number" && beforeDossier[key] !== afterDossier[key]) {
      changes.push({
        path: `officialCareer.assessmentDossier.${key}`,
        label: key === "meritScore" ? "考成功绩" : "考成风险",
        before: beforeDossier[key],
        after: afterDossier[key],
        reason: "官场后果信号仅作考成观察。"
      });
    }
  }
  return changes;
}

function runOfficialCourtConsequenceStep(worldState = {}, input = "", options = {}) {
  const beforeState = JSON.parse(JSON.stringify(worldState || {}));
  const state = normalizeOfficialCourtConsequenceState(worldState);
  const signal = resolveOfficialCourtConsequenceSignal({
    ...worldState,
    officialCourtConsequences: state
  }, input, options);
  const result = {
    schemaVersion: OFFICIAL_COURT_CONSEQUENCE_SCHEMA_VERSION,
    statePatch: {},
    attributeChanges: [],
    relationshipChanges: [],
    events: [],
    summary: "",
    outcome: signal
  };
  if (!signal) return result;

  const nextConsequenceState = {
    ...state,
    signals: normalizeOfficialCourtConsequenceSignals([
      ...state.signals,
      signal
    ], worldState)
  };
  result.statePatch.officialCourtConsequences = nextConsequenceState;
  const nextOfficialCareer = applySignalToOfficialCareer(worldState, signal);
  if (nextOfficialCareer) {
    result.statePatch.officialCareer = nextOfficialCareer;
  }
  result.attributeChanges = buildAttributeChanges(beforeState, signal, {
    officialCourtConsequences: nextConsequenceState,
    officialCareer: nextOfficialCareer || beforeState.officialCareer
  });
  result.events.push(`[官场后果信号] ${signal.title}：${signal.publicSummary}`);
  result.summary = result.events.join(" ");
  return result;
}

module.exports = {
  OFFICIAL_COURT_CONSEQUENCE_SCHEMA_VERSION,
  buildOfficialCourtConsequenceView,
  createInitialOfficialCourtConsequenceState,
  ensureOfficialCourtConsequenceState,
  isCourtConsequenceLikeInput,
  normalizeOfficialCourtConsequenceSignal,
  normalizeOfficialCourtConsequenceSignals,
  normalizeOfficialCourtConsequenceState,
  resolveOfficialCourtConsequenceSignal,
  runOfficialCourtConsequenceStep
};
