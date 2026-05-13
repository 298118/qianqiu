const {
  ACTOR_MEMORY_LIMITS,
  ACTOR_MEMORY_REJECTED_VISIBILITIES,
  ACTOR_MEMORY_SCHEMA_VERSION,
  ACTOR_MEMORY_SOURCE_TYPES,
  ACTOR_MEMORY_TYPES,
  ACTOR_MEMORY_VISIBILITIES
} = require("./actorMemoryConfig");
const { formatYearMonthPeriod } = require("./time");
const { buildWorldPeopleView } = require("./worldPeople");

const SECRET_ENV_NAME_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;
const SENSITIVE_MEMORY_TEXT_PATTERN =
  /(hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|actorMemoryLedger|sessionSummary|sealedMapping|sealed_mapping|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal)|\b(?:provider|prompt|proposal|statePatch|worldState|rawSql)\b|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|raw[_ -]?(?:table|ledger|audit)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampFloat(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function redactSecrets(value) {
  let text = String(value ?? "");
  for (const [envName, secret] of Object.entries(process.env)) {
    if (!SECRET_ENV_NAME_PATTERN.test(envName) || !secret || String(secret).length < 8) continue;
    const raw = String(secret);
    for (const variant of [raw, raw.slice(0, 8), raw.slice(0, 12), raw.slice(-8), raw.slice(-12)]) {
      if (variant && variant.length >= 8) text = text.split(variant).join("[redacted]");
    }
  }

  text = text.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
  text = text.replace(/\btp-[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
  text = text.replace(/\bfile:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+/gi, "[redacted-path]");
  text = text.replace(/[A-Za-z]:[\\/][^\s"'<>]+/g, "[redacted-path]");
  text = text.replace(/(^|\s)(?:\.{0,2}[\\/])?data[\\/][^\s"'<>]+/g, "$1[redacted-path]");
  text = text.replace(/\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+/g, "[redacted-path]");
  return text;
}

function cleanText(value, fallback = "", maxLength = ACTOR_MEMORY_LIMITS.maxSummaryLength) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw || SENSITIVE_MEMORY_TEXT_PATTERN.test(raw)) return fallback;
  const redacted = redactSecrets(raw).replace(/\s+/g, " ").trim();
  if (!redacted || SENSITIVE_MEMORY_TEXT_PATTERN.test(redacted)) return fallback;
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanList(values, limit, maxLength = 80) {
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

function normalizeActorId(actorId, fallback = "") {
  const text = cleanId(actorId, fallback);
  if (!text) return "";
  if (/^(npc|player|faction|office|system):[A-Za-z0-9_.:-]+$/.test(text)) return text;
  if (text === "P1" || text.toLowerCase() === "player") return "player:P1";
  return text.startsWith("C") || text.startsWith("exam-") ? `npc:${text}` : text;
}

function actorIdFromTarget(targetType, targetId) {
  const id = cleanId(targetId, "");
  if (!id) return "";
  if (targetType === "character" || targetType === "npc") return `npc:${id}`;
  if (targetType === "faction") return `faction:${id}`;
  if (targetType === "player") return `player:${id}`;
  return normalizeActorId(id, "");
}

function normalizeType(value, fallback = "impression") {
  const type = cleanId(value, fallback);
  return ACTOR_MEMORY_TYPES[type] ? type : fallback;
}

function normalizeVisibilityToken(value, fallback = "player_visible") {
  const hasValue = value !== undefined && value !== null && String(value).trim() !== "";
  const raw = hasValue
    ? String(value).trim().toLowerCase().replace(/[\s-]+/g, "_")
    : fallback;
  return {
    text: cleanId(raw, ""),
    hasValue
  };
}

function normalizeVisibility(value) {
  const { text, hasValue } = normalizeVisibilityToken(value);
  if (ACTOR_MEMORY_REJECTED_VISIBILITIES.includes(text)) return null;
  if (ACTOR_MEMORY_VISIBILITIES.includes(text)) return text;
  return hasValue ? null : "player_visible";
}

function normalizeSourceType(value, fallback = "server_turn") {
  const text = cleanId(value, fallback);
  return ACTOR_MEMORY_SOURCE_TYPES.includes(text) ? text : fallback;
}

function normalizeProposalSourceType(source = {}, options = {}) {
  const fallback = options.sourceType || "ai_memory_proposal";
  if (options.sourceType) return normalizeSourceType(options.sourceType, fallback);
  return normalizeSourceType(source.sourceType, fallback);
}

function memoryDate(worldState = {}, date = {}) {
  const source = isPlainObject(date) ? date : {};
  const candidate = {
    dynasty: source.dynasty || worldState.dynasty || "",
    year: clampNumber(source.year ?? worldState.year, 1, 9999, 1644),
    month: clampNumber(source.month ?? worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(source.tenDayPeriod ?? worldState.tenDayPeriod, 1, 3, 1),
    turn: clampNumber(source.turn ?? source.turnCount ?? worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
  };
  return {
    ...candidate,
    dateLabel: cleanText(source.dateLabel || source.label, formatYearMonthPeriod(candidate), 80)
  };
}

function normalizeSourceRefs(sourceRefs = []) {
  const result = [];
  const seen = new Set();
  for (const ref of Array.isArray(sourceRefs) ? sourceRefs : []) {
    if (!isPlainObject(ref)) continue;
    const id = cleanId(ref.id || ref.sourceId || ref.refId, "");
    const sourceView = cleanText(ref.sourceView || ref.sourceType || ref.source, "server_projection", 80);
    const label = cleanText(ref.label || ref.title || id, id || sourceView, ACTOR_MEMORY_LIMITS.maxSourceLabelLength);
    const key = `${sourceView}:${id || label}`;
    if (!label || seen.has(key)) continue;
    seen.add(key);
    result.push({ id, sourceView, label });
    if (result.length >= ACTOR_MEMORY_LIMITS.maxSourceRefs) break;
  }
  return result;
}

function createInitialActorMemoryLedger() {
  return {
    schemaVersion: ACTOR_MEMORY_SCHEMA_VERSION,
    generatedAtTurn: 0,
    memoriesByActor: {},
    recentUpdates: []
  };
}

function normalizeMemoryRecord(record = {}, actorId = "", worldState = {}) {
  if (!isPlainObject(record)) return null;
  const normalizedActorId = normalizeActorId(record.actorId || actorId, actorId);
  const summary = cleanText(record.summary || record.publicSummary, "", ACTOR_MEMORY_LIMITS.maxSummaryLength);
  const visibility = normalizeVisibility(record.visibility);
  if (!normalizedActorId || !summary || !visibility) return null;
  const type = normalizeType(record.type, "impression");
  const typeConfig = ACTOR_MEMORY_TYPES[type] || ACTOR_MEMORY_TYPES.impression;
  const sourceType = normalizeSourceType(record.sourceType, "server_turn");
  const createdAt = memoryDate(worldState, record.createdAt);
  const salience = clampNumber(
    record.salience,
    ACTOR_MEMORY_LIMITS.minSalience,
    ACTOR_MEMORY_LIMITS.maxSalience,
    typeConfig.defaultSalience
  );
  const confidence = clampFloat(
    record.confidence,
    ACTOR_MEMORY_LIMITS.minConfidence,
    ACTOR_MEMORY_LIMITS.maxConfidence,
    0.6
  );
  const subjectType = cleanId(record.subjectType, "player");
  const subjectId = cleanId(record.subjectId, "P1");
  const fingerprint = cleanId(record.fingerprint, buildMemoryFingerprint({
    actorId: normalizedActorId,
    type,
    subjectType,
    subjectId,
    summary
  }), 140);

  return {
    id: cleanId(record.id, `AM-${fingerprint}-${createdAt.turn}`),
    actorId: normalizedActorId,
    type,
    typeLabel: typeConfig.label,
    visibility,
    subjectType,
    subjectId,
    summary,
    salience,
    confidence,
    sourceType,
    sourceLabel: cleanText(record.sourceLabel, sourceType, ACTOR_MEMORY_LIMITS.maxSourceLabelLength),
    sourceRefs: normalizeSourceRefs(record.sourceRefs),
    tags: cleanList(record.tags, ACTOR_MEMORY_LIMITS.maxTags, 40),
    createdAt,
    lastTouchedTurn: clampNumber(record.lastTouchedTurn, 0, Number.MAX_SAFE_INTEGER, createdAt.turn),
    lastReinforcedTurn: clampNumber(record.lastReinforcedTurn, 0, Number.MAX_SAFE_INTEGER, createdAt.turn),
    decayRate: clampNumber(record.decayRate, 0, 20, typeConfig.decayPerMonth),
    reinforcementCount: clampNumber(record.reinforcementCount, 0, 999, 1),
    fingerprint
  };
}

function normalizeLedgerState(rawState, worldState = {}) {
  const source = isPlainObject(rawState) ? rawState : {};
  const normalized = createInitialActorMemoryLedger();
  normalized.generatedAtTurn = currentTurn(worldState);
  const sourceByActor = isPlainObject(source.memoriesByActor) ? source.memoriesByActor : {};
  const actorEntries = Object.entries(sourceByActor)
    .map(([actorId, memories]) => [
      normalizeActorId(actorId, ""),
      Array.isArray(memories) ? memories : []
    ])
    .filter(([actorId]) => actorId)
    .slice(0, ACTOR_MEMORY_LIMITS.maxActors);

  for (const [actorId, memories] of actorEntries) {
    const rows = memories
      .map((record) => normalizeMemoryRecord(record, actorId, worldState))
      .filter(Boolean)
      .sort(compareMemories)
      .slice(0, ACTOR_MEMORY_LIMITS.maxMemoriesPerActor);
    if (rows.length) normalized.memoriesByActor[actorId] = rows;
  }

  normalized.recentUpdates = (Array.isArray(source.recentUpdates) ? source.recentUpdates : [])
    .map((entry) => normalizeRecentUpdate(entry, worldState))
    .filter(Boolean)
    .slice(-ACTOR_MEMORY_LIMITS.maxRecentUpdates);
  return normalized;
}

function ensureActorMemoryLedgerState(worldState = {}) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.actorMemoryLedger = normalizeLedgerState(worldState.actorMemoryLedger, worldState);
  return worldState;
}

function buildMemoryFingerprint(memory) {
  const summaryKey = cleanText(memory.summary, "", 80)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/gu, "");
  return cleanId(`${memory.actorId}:${memory.type}:${memory.subjectType}:${memory.subjectId}:${summaryKey}`, "memory");
}

function normalizeRecentUpdate(entry = {}, worldState = {}) {
  if (!isPlainObject(entry)) return null;
  const actorId = normalizeActorId(entry.actorId, "");
  const memoryId = cleanId(entry.memoryId || entry.id, "");
  const summary = cleanText(entry.summary, "", 120);
  if (!actorId || !memoryId || !summary) return null;
  return {
    actorId,
    memoryId,
    type: normalizeType(entry.type, "impression"),
    summary,
    status: cleanId(entry.status, "applied"),
    salience: clampNumber(entry.salience, ACTOR_MEMORY_LIMITS.minSalience, ACTOR_MEMORY_LIMITS.maxSalience, 50),
    turn: clampNumber(entry.turn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
  };
}

function compareMemories(first, second) {
  if (second.salience !== first.salience) return second.salience - first.salience;
  if (second.lastTouchedTurn !== first.lastTouchedTurn) return second.lastTouchedTurn - first.lastTouchedTurn;
  return first.id.localeCompare(second.id);
}

function proposeActorMemoryUpdate(actorId, proposal = {}, options = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const expectedActorId = normalizeActorId(options.expectedActorId || actorId, "");
  const normalizedActorId = normalizeActorId(actorId || source.actorId, expectedActorId);
  const sourceActorId = source.actorId ? normalizeActorId(source.actorId, "") : "";
  const rejectedReasons = [];
  if (!normalizedActorId) rejectedReasons.push("missing_actor");
  if (expectedActorId && normalizedActorId !== expectedActorId) rejectedReasons.push("actor_retarget_rejected");
  if (sourceActorId && normalizedActorId && sourceActorId !== normalizedActorId) {
    rejectedReasons.push("actor_retarget_rejected");
  }
  if (options.requireKnownActor && normalizedActorId && !isVisibleActorId(options.worldState || {}, normalizedActorId)) {
    rejectedReasons.push("unknown_or_invisible_actor");
  }

  const visibility = normalizeVisibility(source.visibility);
  if (!visibility) rejectedReasons.push("private_or_hidden_memory_requires_redacted_api");

  const summary = cleanText(source.summary || source.publicSummary || source.text, "", ACTOR_MEMORY_LIMITS.maxSummaryLength);
  if (!summary) rejectedReasons.push("unsafe_or_empty_summary");

  const type = normalizeType(source.type || source.memoryType, "impression");
  const typeConfig = ACTOR_MEMORY_TYPES[type] || ACTOR_MEMORY_TYPES.impression;
  const sourceType = normalizeProposalSourceType(source, options);
  const subjectType = cleanId(source.subjectType, "player");
  const subjectId = cleanId(source.subjectId, "P1");
  const salience = clampNumber(
    source.salience,
    ACTOR_MEMORY_LIMITS.minSalience,
    ACTOR_MEMORY_LIMITS.maxSalience,
    typeConfig.defaultSalience
  );
  const confidence = clampFloat(
    source.confidence,
    ACTOR_MEMORY_LIMITS.minConfidence,
    ACTOR_MEMORY_LIMITS.maxConfidence,
    options.defaultConfidence ?? 0.58
  );
  const date = memoryDate(options.worldState || {}, source.createdAt || source.date);
  const memoryUpdate = rejectedReasons.length ? null : {
    id: cleanId(source.id, `AM-${normalizedActorId}-${type}-${date.turn}-${salience}`),
    actorId: normalizedActorId,
    type,
    typeLabel: typeConfig.label,
    visibility,
    subjectType,
    subjectId,
    summary,
    salience,
    confidence,
    sourceType,
    sourceLabel: cleanText(source.sourceLabel, sourceType, ACTOR_MEMORY_LIMITS.maxSourceLabelLength),
    sourceRefs: normalizeSourceRefs(source.sourceRefs),
    tags: cleanList(source.tags, ACTOR_MEMORY_LIMITS.maxTags, 40),
    createdAt: date,
    lastTouchedTurn: date.turn,
    lastReinforcedTurn: date.turn,
    decayRate: clampNumber(source.decayRate, 0, 20, typeConfig.decayPerMonth),
    reinforcementCount: 1
  };
  if (memoryUpdate) {
    memoryUpdate.fingerprint = buildMemoryFingerprint(memoryUpdate);
  }

  return {
    accepted: Boolean(memoryUpdate),
    actorId: normalizedActorId,
    proposalId: cleanId(source.proposalId || source.id, `memory-proposal-${date.turn}`),
    memoryUpdate,
    rejectedReasons
  };
}

function mergeSourceRefs(first = [], second = []) {
  return normalizeSourceRefs([...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]);
}

function appendRecentUpdate(ledger, memory, status) {
  ledger.recentUpdates.push({
    actorId: memory.actorId,
    memoryId: memory.id,
    type: memory.type,
    summary: memory.summary,
    status,
    salience: memory.salience,
    turn: memory.lastTouchedTurn
  });
  ledger.recentUpdates = ledger.recentUpdates.slice(-ACTOR_MEMORY_LIMITS.maxRecentUpdates);
}

function applyActorMemoryUpdate(worldState = {}, memoryUpdate, auditContext = {}) {
  ensureActorMemoryLedgerState(worldState);
  const update = normalizeMemoryRecord(
    memoryUpdate?.memoryUpdate || memoryUpdate,
    memoryUpdate?.actorId,
    worldState
  );
  if (!update) {
    return { applied: false, deduped: false, memory: null, rejectedReasons: ["invalid_memory_update"] };
  }

  const ledger = worldState.actorMemoryLedger;
  const actorRows = Array.isArray(ledger.memoriesByActor[update.actorId])
    ? ledger.memoriesByActor[update.actorId]
    : [];
  const existing = actorRows.find((memory) => memory.fingerprint === update.fingerprint);
  if (existing) {
    existing.summary = update.summary.length > existing.summary.length ? update.summary : existing.summary;
    existing.salience = Math.min(
      ACTOR_MEMORY_LIMITS.maxSalience,
      Math.max(existing.salience, update.salience) + 3
    );
    existing.confidence = Math.max(existing.confidence, update.confidence);
    existing.lastTouchedTurn = Math.max(existing.lastTouchedTurn, update.lastTouchedTurn);
    existing.lastReinforcedTurn = existing.lastTouchedTurn;
    existing.reinforcementCount += 1;
    existing.sourceRefs = mergeSourceRefs(existing.sourceRefs, update.sourceRefs);
    existing.tags = cleanList([...(existing.tags || []), ...(update.tags || [])], ACTOR_MEMORY_LIMITS.maxTags, 40);
    appendRecentUpdate(ledger, existing, "reinforced");
    if (Array.isArray(auditContext.actorMemoryRecords)) {
      auditContext.actorMemoryRecords.push({
        actorId: existing.actorId,
        memoryId: existing.id,
        status: "reinforced",
        type: existing.type,
        summary: existing.summary
      });
    }
    return { applied: true, deduped: true, memory: existing, rejectedReasons: [] };
  }

  actorRows.push(update);
  ledger.memoriesByActor[update.actorId] = actorRows
    .sort(compareMemories)
    .slice(0, ACTOR_MEMORY_LIMITS.maxMemoriesPerActor);
  appendRecentUpdate(ledger, update, "applied");
  worldState.actorMemoryLedger = normalizeLedgerState(ledger, worldState);
  if (Array.isArray(auditContext.actorMemoryRecords)) {
    auditContext.actorMemoryRecords.push({
      actorId: update.actorId,
      memoryId: update.id,
      status: "applied",
      type: update.type,
      summary: update.summary
    });
  }
  return { applied: true, deduped: false, memory: update, rejectedReasons: [] };
}

function decayActorMemoryLedger(worldState = {}, options = {}) {
  ensureActorMemoryLedgerState(worldState);
  const months = clampNumber(options.months, 0, 12, 1);
  if (!months) return { decayed: 0, removed: 0 };
  let decayed = 0;
  let removed = 0;
  const nextByActor = {};

  for (const [actorId, rows] of Object.entries(worldState.actorMemoryLedger.memoriesByActor || {})) {
    const kept = [];
    for (const memory of rows) {
      const before = memory.salience;
      memory.salience = clampNumber(
        before - memory.decayRate * months,
        0,
        ACTOR_MEMORY_LIMITS.maxSalience,
        before
      );
      if (memory.salience !== before) decayed += 1;
      if (memory.salience < ACTOR_MEMORY_LIMITS.minSalience) {
        removed += 1;
        continue;
      }
      kept.push(memory);
    }
    if (kept.length) nextByActor[actorId] = kept.sort(compareMemories).slice(0, ACTOR_MEMORY_LIMITS.maxMemoriesPerActor);
  }

  worldState.actorMemoryLedger.memoriesByActor = nextByActor;
  const activeMemoryIds = new Set(Object.values(nextByActor).flatMap((rows) => rows.map((memory) => memory.id)));
  worldState.actorMemoryLedger.recentUpdates = (worldState.actorMemoryLedger.recentUpdates || [])
    .filter((entry) => activeMemoryIds.has(entry.memoryId))
    .slice(-ACTOR_MEMORY_LIMITS.maxRecentUpdates);
  worldState.actorMemoryLedger.generatedAtTurn = currentTurn(worldState);
  return { decayed, removed };
}

function actorLabelMap(worldState = {}) {
  const labels = new Map();
  labels.set("player:P1", cleanText(worldState.player?.name, "玩家", 48));
  for (const factionId of Object.keys(worldState.factions || {})) {
    const id = normalizeActorId(`faction:${factionId}`, "");
    if (id) labels.set(id, cleanText(factionId, id, 48));
  }
  const people = buildWorldPeopleView(worldState);
  for (const npc of people.npcs || []) {
    const id = normalizeActorId(`npc:${npc.id}`, "");
    if (id) labels.set(id, cleanText(npc.name, id, 48));
  }
  for (const relation of people.relationships || []) {
    if (relation.targetType === "faction") {
      const id = normalizeActorId(`faction:${relation.targetId}`, "");
      if (id) labels.set(id, cleanText(relation.targetId, id, 48));
    }
  }
  return labels;
}

function visibleActorIdSet(worldState = {}) {
  return new Set(actorLabelMap(worldState).keys());
}

function isVisibleActorId(worldState = {}, actorId = "") {
  const normalizedActorId = normalizeActorId(actorId, "");
  return Boolean(normalizedActorId && visibleActorIdSet(worldState).has(normalizedActorId));
}

function memoryForView(memory) {
  return {
    id: memory.id,
    type: memory.type,
    typeLabel: memory.typeLabel,
    visibility: memory.visibility,
    summary: memory.summary,
    salience: memory.salience,
    confidence: Number(memory.confidence.toFixed(2)),
    sourceType: memory.sourceType,
    sourceLabel: memory.sourceLabel,
    sourceRefs: memory.sourceRefs,
    tags: memory.tags,
    createdAt: memory.createdAt,
    lastTouchedTurn: memory.lastTouchedTurn,
    reinforcementCount: memory.reinforcementCount
  };
}

function visibleMemories(rows = {}) {
  return (Array.isArray(rows) ? rows : [])
    .filter((memory) => ACTOR_MEMORY_VISIBILITIES.includes(memory.visibility))
    .filter((memory) => memory.salience >= ACTOR_MEMORY_LIMITS.minPromptSalience)
    .sort(compareMemories);
}

function buildActorMemoryView(worldState = {}, actorId = null, options = {}) {
  ensureActorMemoryLedgerState(worldState);
  const labels = actorLabelMap(worldState);
  const requestedActorId = actorId ? normalizeActorId(actorId, "") : "";
  const actorEntries = Object.entries(worldState.actorMemoryLedger.memoriesByActor || {})
    .filter(([id]) => !requestedActorId || id === requestedActorId)
    .filter(([id]) => labels.has(id))
    .map(([id, rows]) => {
      const memories = visibleMemories(rows)
        .slice(0, ACTOR_MEMORY_LIMITS.maxViewMemoriesPerActor)
        .map(memoryForView);
      if (!memories.length) return null;
      return {
        actorId: id,
        actorLabel: labels.get(id) || id,
        memoryCount: visibleMemories(rows).length,
        memories
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      const a = first.memories[0]?.salience || 0;
      const b = second.memories[0]?.salience || 0;
      if (b !== a) return b - a;
      return first.actorId.localeCompare(second.actorId);
    })
    .slice(0, options.maxActors || ACTOR_MEMORY_LIMITS.maxViewActors);

  return {
    schemaVersion: ACTOR_MEMORY_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    actorId: requestedActorId || null,
    actors: actorEntries,
    recentUpdates: (worldState.actorMemoryLedger.recentUpdates || [])
      .filter((entry) => {
        if (!labels.has(entry.actorId)) return false;
        const rows = worldState.actorMemoryLedger.memoriesByActor?.[entry.actorId];
        return Array.isArray(rows) && rows.some((memory) =>
          memory.id === entry.memoryId &&
          ACTOR_MEMORY_VISIBILITIES.includes(memory.visibility) &&
          memory.salience >= ACTOR_MEMORY_LIMITS.minPromptSalience
        );
      })
      .slice(-ACTOR_MEMORY_LIMITS.maxRecentUpdates)
      .map((entry) => ({
        actorId: entry.actorId,
        actorLabel: labels.get(entry.actorId) || entry.actorId,
        memoryId: entry.memoryId,
        type: entry.type,
        summary: entry.summary,
        status: entry.status,
        salience: entry.salience,
        turn: entry.turn
      })),
    hiddenNotice: "当前记忆视图只展示服务器清洗后的公开/玩家可见记忆；私密印象、隐藏事实、原始提示词、模型原始提案、SQLite raw table、本地路径和密钥不会进入本账本。"
  };
}

function summarizeActorMemoryForPrompt(worldState = {}, actorId = null, options = {}) {
  const view = buildActorMemoryView(worldState, actorId, {
    maxActors: options.maxActors || ACTOR_MEMORY_LIMITS.maxPromptActors
  });
  const actors = view.actors.slice(0, options.maxActors || ACTOR_MEMORY_LIMITS.maxPromptActors)
    .map((actor) => ({
      actorId: actor.actorId,
      actorLabel: actor.actorLabel,
      memories: actor.memories
        .slice(0, options.maxMemoriesPerActor || ACTOR_MEMORY_LIMITS.maxPromptMemoriesPerActor)
        .map((memory) => ({
          type: memory.type,
          summary: memory.summary,
          salience: memory.salience,
          confidence: memory.confidence,
          sourceType: memory.sourceType,
          tags: memory.tags
        }))
    }));
  return {
    schemaVersion: view.schemaVersion,
    generatedAtTurn: view.generatedAtTurn,
    actors,
    authorityBoundary: "actorMemory 只读服务器清洗后的可见记忆摘要；模型只能提交 memoryProposals，不能写持久账本、创造隐藏事实或读取私密记忆。"
  };
}

function memoryProposalFromRelationshipChange(change = {}) {
  const actorId = actorIdFromTarget(change.targetType, change.targetId);
  if (!actorId) return null;
  const relationshipDelta = clampNumber(change.relationship?.delta ?? change.relationshipDelta, -100, 100, 0);
  const resentmentDelta = clampNumber(change.resentment?.delta ?? change.resentmentDelta, -100, 100, 0);
  const type = resentmentDelta > 0 || relationshipDelta < 0
    ? "grievance"
    : relationshipDelta > 0 || resentmentDelta < 0
      ? "favor"
      : "impression";
  const name = cleanText(change.name, "此人", 48);
  const reason = cleanText(change.note || change.reason || change.recentIntent || "本旬互动已入关系账。", "本旬互动已入关系账。", 120);
  return {
    actorId,
    type,
    visibility: "player_visible",
    subjectType: "player",
    subjectId: "P1",
    summary: `${name}记得与玩家的本旬往来：${reason}`,
    salience: type === "grievance" ? 72 : type === "favor" ? 66 : 48,
    confidence: 0.72,
    sourceType: "relationship_change",
    sourceLabel: "关系变化",
    sourceRefs: [{
      sourceView: "relationshipView",
      id: change.targetId,
      label: name
    }],
    tags: [type === "grievance" ? "怨望" : type === "favor" ? "人情" : "印象"]
  };
}

function memoryProposalsFromActiveRequest(activeNpcRequest = {}) {
  if (!activeNpcRequest || !isPlainObject(activeNpcRequest)) return [];
  const targetId = activeNpcRequest.targetId || activeNpcRequest.request?.targetId;
  const targetType = activeNpcRequest.targetType || activeNpcRequest.request?.targetType;
  const actorId = actorIdFromTarget(targetType, targetId);
  if (!actorId) return [];
  const sourceName = cleanText(activeNpcRequest.sourceName, "来人", 48);
  const eventText = cleanText((activeNpcRequest.events || [])[0], "", 120);
  const status = activeNpcRequest.resolved
    ? "resolved"
    : activeNpcRequest.expired
      ? "expired"
      : activeNpcRequest.scheduled
        ? "scheduled"
        : "";
  if (!status) return [];
  const type = status === "scheduled" ? "obligation" : status === "resolved" ? "favor" : "grievance";
  const summary = status === "scheduled"
    ? `${sourceName}记下曾向玩家递出请托。`
    : status === "resolved"
      ? `${sourceName}记得玩家回应过这桩请托。`
      : `${sourceName}记得请托逾期未得回应。`;
  return [{
    actorId,
    type,
    visibility: "player_visible",
    subjectType: "player",
    subjectId: "P1",
    summary: eventText || summary,
    salience: type === "grievance" ? 74 : 68,
    confidence: 0.78,
    sourceType: "active_request",
    sourceLabel: "人脉请托",
    sourceRefs: [{
      sourceView: "activeNpcRequestView",
      id: cleanId(activeNpcRequest.id, targetId),
      label: sourceName
    }],
    tags: ["请托"]
  }];
}

function memoryProposalsFromMonthlyBriefing(playerMonthlyBriefing = {}) {
  if (!playerMonthlyBriefing?.generated) return [];
  const summary = cleanText(playerMonthlyBriefing.summary, "", 140);
  if (!summary) return [];
  return [{
    actorId: "player:P1",
    type: "monthly_summary",
    visibility: "player_visible",
    subjectType: "player",
    subjectId: "P1",
    summary: `本月经历摘要：${summary}`,
    salience: 58,
    confidence: 0.86,
    sourceType: "monthly_briefing",
    sourceLabel: "官职月报",
    sourceRefs: [{
      sourceView: "playerMonthlyBriefingView",
      id: cleanId(playerMonthlyBriefing.reportId, ""),
      label: "官职月报"
    }],
    tags: ["月报"]
  }];
}

function collectTurnActorMemoryProposalResults(worldState = {}, context = {}) {
  const providerResults = (Array.isArray(context.providerMemoryProposals) ? context.providerMemoryProposals : [])
    .map((proposal) => proposeActorMemoryUpdate(proposal.actorId, proposal, {
      worldState,
      requireKnownActor: true,
      sourceType: "ai_memory_proposal"
    }));
  const proposals = [
    ...(Array.isArray(context.relationshipChanges) ? context.relationshipChanges : [])
      .map(memoryProposalFromRelationshipChange)
      .filter(Boolean),
    ...memoryProposalsFromActiveRequest(context.activeNpcRequest),
    ...memoryProposalsFromMonthlyBriefing(context.playerMonthlyBriefing)
  ];
  const serverResults = proposals
    .map((proposal) => proposeActorMemoryUpdate(proposal.actorId, proposal, { worldState }));
  return [...providerResults, ...serverResults];
}

function summarizeRejectedMemoryProposalResults(results = []) {
  const reasonCounts = new Map();
  let rejectedCount = 0;
  for (const result of Array.isArray(results) ? results : []) {
    if (result?.accepted) continue;
    rejectedCount += 1;
    const reasons = Array.isArray(result?.rejectedReasons) && result.rejectedReasons.length
      ? result.rejectedReasons
      : ["memory_proposal_rejected"];
    for (const reason of reasons) {
      const safeReason = cleanId(reason, "memory_proposal_rejected");
      if (!safeReason || SENSITIVE_MEMORY_TEXT_PATTERN.test(safeReason)) continue;
      reasonCounts.set(safeReason, (reasonCounts.get(safeReason) || 0) + 1);
    }
  }
  return {
    rejectedCount,
    rejectedReasons: [...reasonCounts.entries()]
      .map(([reason, count]) => count > 1 ? `${reason}x${count}` : reason)
      .slice(0, 8)
  };
}

function summarizeExternalMemoryProposalRejections(rejections = []) {
  const reasonCounts = new Map();
  let rejectedCount = 0;
  for (const rejection of Array.isArray(rejections) ? rejections : []) {
    if (!isPlainObject(rejection)) continue;
    const count = clampNumber(rejection.count, 1, 6, 1);
    const reason = cleanId(rejection.reason, "memory_proposal_rejected");
    if (!reason || SENSITIVE_MEMORY_TEXT_PATTERN.test(reason)) continue;
    rejectedCount += count;
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + count);
  }
  return {
    rejectedCount,
    rejectedReasons: [...reasonCounts.entries()]
      .map(([reason, count]) => count > 1 ? `${reason}x${count}` : reason)
      .slice(0, 8)
  };
}

function mergeRejectedMemorySummaries(...summaries) {
  const reasonCounts = new Map();
  let rejectedCount = 0;
  for (const summary of summaries) {
    rejectedCount += clampNumber(summary?.rejectedCount, 0, 999, 0);
    for (const reasonText of Array.isArray(summary?.rejectedReasons) ? summary.rejectedReasons : []) {
      const match = /^(.+?)x(\d+)$/.exec(reasonText);
      const reason = cleanId(match ? match[1] : reasonText, "memory_proposal_rejected");
      const count = match ? clampNumber(match[2], 1, 999, 1) : 1;
      if (!reason || SENSITIVE_MEMORY_TEXT_PATTERN.test(reason)) continue;
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + count);
    }
  }
  return {
    rejectedCount,
    rejectedReasons: [...reasonCounts.entries()]
      .map(([reason, count]) => count > 1 ? `${reason}x${count}` : reason)
      .slice(0, 8)
  };
}

function deriveActorMemoryUpdatesForTurn(worldState = {}, context = {}) {
  return collectTurnActorMemoryProposalResults(worldState, context)
    .filter((result) => result.accepted)
    .map((result) => result.memoryUpdate)
    .slice(0, ACTOR_MEMORY_LIMITS.maxRecentUpdates);
}

function applyTurnActorMemoryUpdates(worldState = {}, context = {}, auditContext = {}) {
  const proposalResults = collectTurnActorMemoryProposalResults(worldState, context);
  const rejected = mergeRejectedMemorySummaries(
    summarizeRejectedMemoryProposalResults(proposalResults),
    summarizeExternalMemoryProposalRejections(context.providerMemoryProposalRejections)
  );
  const updates = proposalResults
    .filter((result) => result.accepted)
    .map((result) => result.memoryUpdate)
    .slice(0, ACTOR_MEMORY_LIMITS.maxRecentUpdates);
  const results = updates.map((update) => applyActorMemoryUpdate(worldState, update, auditContext));
  return {
    appliedCount: results.filter((result) => result.applied).length,
    reinforcedCount: results.filter((result) => result.deduped).length,
    rejectedCount: rejected.rejectedCount,
    rejectedReasons: rejected.rejectedReasons,
    updates: results.map((result) => result.memory).filter(Boolean)
  };
}

function applyExamNetworkMemoryUpdates(worldState = {}, examNetwork = {}, options = {}) {
  if (!isPlainObject(examNetwork)) {
    return { appliedCount: 0, reinforcedCount: 0, updates: [] };
  }
  const proposals = [];
  const examName = cleanText(examNetwork.examName, "科场", 48);
  for (const contact of [
    ...(Array.isArray(examNetwork.sameYearContacts) ? examNetwork.sameYearContacts : []),
    ...(Array.isArray(examNetwork.examinerContacts) ? examNetwork.examinerContacts : [])
  ]) {
    const actorId = actorIdFromTarget("character", contact.id);
    const name = cleanText(contact.name, "科场联系人", 48);
    if (!actorId || !name) continue;
    proposals.push({
      actorId,
      type: "exam_network",
      visibility: "player_visible",
      subjectType: "player",
      subjectId: "P1",
      summary: `${name}记得玩家在${examName}中结成${cleanText(contact.stance || contact.role, "科场关系", 60)}。`,
      salience: contact.relationKind === "same_year" ? 64 : 70,
      confidence: 0.88,
      sourceType: "exam_network",
      sourceLabel: examName,
      sourceRefs: [{
        sourceView: "examNetwork",
        id: contact.id,
        label: name
      }],
      tags: [contact.relationKind === "same_year" ? "同年" : "座师考官"]
    });
  }
  const updates = proposals
    .map((proposal) => proposeActorMemoryUpdate(proposal.actorId, proposal, { worldState, sourceType: "exam_network" }))
    .filter((result) => result.accepted)
    .map((result) => result.memoryUpdate);
  const auditContext = options.auditContext || {};
  const results = updates.map((update) => applyActorMemoryUpdate(worldState, update, auditContext));
  return {
    appliedCount: results.filter((result) => result.applied).length,
    reinforcedCount: results.filter((result) => result.deduped).length,
    updates: results.map((result) => result.memory).filter(Boolean)
  };
}

module.exports = {
  applyActorMemoryUpdate,
  applyExamNetworkMemoryUpdates,
  applyTurnActorMemoryUpdates,
  buildActorMemoryView,
  createInitialActorMemoryLedger,
  decayActorMemoryLedger,
  deriveActorMemoryUpdatesForTurn,
  ensureActorMemoryLedgerState,
  isVisibleActorId,
  proposeActorMemoryUpdate,
  summarizeActorMemoryForPrompt
};
