const { getModelSchema, validatePayload } = require("../schemas");
const {
  buildExamQuestionTask,
  buildGradeTask,
  buildOpeningTask,
  buildQuickActionTask,
  buildTurnTask
} = require("../prompts");
const { parseJsonFromText } = require("../../utils/json");
const {
  PROVIDER_PLAYER_PATCH_KEYS,
  PROVIDER_TOP_LEVEL_PATCH_KEYS
} = require("../../game/stateRules");

function readTimeoutMs() {
  const timeout = Number(process.env.AI_PROVIDER_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 30000;
}

async function runTask(task, requestJson) {
  const schema = getModelSchema(task.schemaName);
  const raw = await requestJson({
    ...task,
    schema
  });
  const payload = normalizeModelPayload(task.schemaName, parseJsonFromText(raw));
  return validatePayload(task.schemaName, payload);
}

async function runStreamingTask(task, requestJsonStream, streamHandlers = {}) {
  const schema = getModelSchema(task.schemaName);
  let raw = "";

  const returnedRaw = await requestJsonStream({
    ...task,
    schema,
    onTextDelta(delta) {
      const text = String(delta || "");
      if (!text) return;
      raw += text;
      if (typeof streamHandlers.onTextDelta === "function") {
        streamHandlers.onTextDelta(text);
      }
    }
  });

  const parseSource = returnedRaw !== undefined && returnedRaw !== null && (
    typeof returnedRaw !== "string" || returnedRaw.trim()
  ) ? returnedRaw : raw;
  const payload = normalizeModelPayload(task.schemaName, parseJsonFromText(parseSource));
  return validatePayload(task.schemaName, payload);
}

function isValidAttributeChange(change) {
  return Boolean(
    change &&
    typeof change === "object" &&
    typeof change.path === "string" &&
    "before" in change &&
    "after" in change &&
    typeof change.reason === "string"
  );
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRelationshipChange(change) {
  if (!change || typeof change !== "object" || Array.isArray(change)) {
    return null;
  }

  if (change.targetType !== "character" && change.targetType !== "faction") {
    return null;
  }

  if (
    typeof change.targetId !== "string" ||
    !change.targetId.trim() ||
    typeof change.relationshipDelta !== "number" ||
    !Number.isFinite(change.relationshipDelta) ||
    typeof change.resentmentDelta !== "number" ||
    !Number.isFinite(change.resentmentDelta) ||
    typeof change.reason !== "string"
  ) {
    return null;
  }

  const normalized = {
    targetType: change.targetType,
    targetId: change.targetId.trim(),
    relationshipDelta: clampNumber(change.relationshipDelta, -12, 12),
    resentmentDelta: clampNumber(change.resentmentDelta, -10, 10),
    reason: change.reason
  };

  for (const key of ["stance", "recentIntent", "note"]) {
    if (typeof change[key] === "string") {
      normalized[key] = change[key];
    }
  }

  return normalized;
}

function cleanText(value, maxLength = 120) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeTeacherFeedbackProposal(proposal) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return undefined;
  }

  const focus = cleanText(proposal.focus, 48);
  const advice = cleanText(proposal.advice, 160);
  const reason = cleanText(proposal.reason, 120);
  if (!focus || !advice || !reason) return undefined;

  const normalized = { focus, advice, reason };
  if (typeof proposal.id === "string" && proposal.id.trim()) {
    normalized.id = proposal.id.trim().slice(0, 80);
  }
  if (typeof proposal.focusKey === "string" && proposal.focusKey.trim()) {
    normalized.focusKey = proposal.focusKey.trim().slice(0, 48);
  }
  if (typeof proposal.teacherName === "string" && proposal.teacherName.trim()) {
    normalized.teacherName = proposal.teacherName.trim().slice(0, 48);
  }
  return normalized;
}

const MEMORY_PROPOSAL_TYPES = new Set([
  "fact",
  "impression",
  "favor",
  "grievance",
  "obligation",
  "exam_network",
  "reward_punishment",
  "official",
  "monthly_summary"
]);

const MEMORY_VISIBILITIES = new Set(["public", "player_visible", "relationship_visible"]);
const REJECTED_MEMORY_VISIBILITIES = new Set(["private", "actor_private", "hidden", "server_hidden", "gm_only"]);

function memoryProposalRejection(reason) {
  return { reason, count: 1 };
}

function normalizeMemoryVisibility(value) {
  return cleanText(value, 40).toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeMemorySourceRef(ref) {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return null;
  const normalized = {};
  for (const key of ["id", "sourceView", "label"]) {
    const text = cleanText(ref[key], 80);
    if (text) normalized[key] = text;
  }
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeMemoryProposal(proposal) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return { proposal: null, rejection: memoryProposalRejection("malformed_memory_proposal") };
  }
  const actorId = cleanText(proposal.actorId, 96);
  const type = cleanText(proposal.type || proposal.memoryType, 40);
  const visibility = normalizeMemoryVisibility(proposal.visibility) || "player_visible";
  const summary = cleanText(proposal.summary || proposal.publicSummary || proposal.text, 160);
  if (!actorId) return { proposal: null, rejection: memoryProposalRejection("missing_actor") };
  if (!MEMORY_PROPOSAL_TYPES.has(type)) {
    return { proposal: null, rejection: memoryProposalRejection("invalid_memory_type") };
  }
  if (!summary) return { proposal: null, rejection: memoryProposalRejection("unsafe_or_empty_summary") };
  if (REJECTED_MEMORY_VISIBILITIES.has(visibility)) {
    return { proposal: null, rejection: memoryProposalRejection("private_or_hidden_memory_requires_redacted_api") };
  }
  if (!MEMORY_VISIBILITIES.has(visibility)) {
    return { proposal: null, rejection: memoryProposalRejection("invalid_memory_visibility") };
  }

  const normalized = {
    actorId,
    type,
    visibility,
    summary
  };
  for (const key of ["id", "proposalId", "subjectType", "subjectId", "sourceLabel"]) {
    const text = cleanText(proposal[key], key === "sourceLabel" ? 80 : 96);
    if (text) normalized[key] = text;
  }
  const salience = Number(proposal.salience);
  if (Number.isFinite(salience)) normalized.salience = clampNumber(Math.round(salience), 0, 100);
  const confidence = Number(proposal.confidence);
  if (Number.isFinite(confidence)) normalized.confidence = Math.max(0, Math.min(1, confidence));
  if (Array.isArray(proposal.sourceRefs)) {
    normalized.sourceRefs = proposal.sourceRefs.map(normalizeMemorySourceRef).filter(Boolean).slice(0, 5);
  }
  if (Array.isArray(proposal.tags)) {
    normalized.tags = proposal.tags
      .map((tag) => cleanText(tag, 40))
      .filter(Boolean)
      .slice(0, 6);
  }
  return { proposal: normalized, rejection: null };
}

function summarizeMemoryProposalRejections(rejections = []) {
  const counts = new Map();
  for (const rejection of Array.isArray(rejections) ? rejections : []) {
    if (!rejection?.reason) continue;
    counts.set(rejection.reason, (counts.get(rejection.reason) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count: clampNumber(count, 1, 6) }))
    .slice(0, 6);
}

function normalizeLooseText(value, maxLength = 120) {
  if (typeof value === "string") return cleanText(value, maxLength);
  if (typeof value === "number" || typeof value === "boolean") {
    return cleanText(String(value), maxLength);
  }
  if (Array.isArray(value)) {
    return cleanText(
      value
        .filter((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
        .map(String)
        .join("；"),
      maxLength
    );
  }
  return "";
}

function normalizeExaminerReview(review) {
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    return null;
  }

  const normalized = {};
  for (const [key, limit] of [
    ["actor", 40],
    ["label", 48],
    ["recommendation", 48],
    ["comment", 240],
    ["concern", 120]
  ]) {
    if (key in review) {
      const text = normalizeLooseText(review[key], limit);
      if (text) normalized[key] = text;
    }
  }

  if ("suggestedScoreDelta" in review || "scoreDelta" in review) {
    const rawDelta = Number(review.suggestedScoreDelta ?? review.scoreDelta);
    if (Number.isFinite(rawDelta)) {
      normalized.suggestedScoreDelta = clampNumber(Math.round(rawDelta), -2, 2);
    }
  }

  return Object.keys(normalized).length ? normalized : null;
}

function normalizeGradePayload(payload) {
  if (!payload || typeof payload !== "object") return payload;

  if (Array.isArray(payload.examiner_reviews)) {
    payload.examiner_reviews = payload.examiner_reviews
      .map(normalizeExaminerReview)
      .filter(Boolean)
      .slice(0, 6);
  } else {
    delete payload.examiner_reviews;
  }

  return payload;
}

function normalizeModelPayload(schemaName, payload) {
  if (schemaName === "grade") {
    return normalizeGradePayload(payload);
  }

  if (schemaName !== "turn" || !payload || typeof payload !== "object") {
    return payload;
  }

  if (payload.statePatch && typeof payload.statePatch === "object" && !Array.isArray(payload.statePatch)) {
    payload.statePatch = normalizeProviderStatePatch(payload.statePatch);
  }

  // Remote models sometimes return looser human-readable change notes. These are display-only;
  // drop malformed rows instead of failing the whole turn after the authoritative statePatch validates.
  if (Array.isArray(payload.attributeChanges)) {
    payload.attributeChanges = payload.attributeChanges.filter(isValidAttributeChange);
  }

  // Relationship rows are also suggestions. Keep only schema-compatible rows here;
  // visibility, target existence, final clamping, and persistence remain route-owned.
  if (Array.isArray(payload.relationshipChanges)) {
    payload.relationshipChanges = payload.relationshipChanges
      .map(normalizeRelationshipChange)
      .filter(Boolean)
      .slice(0, 5);
  }

  const teacherFeedbackProposal = normalizeTeacherFeedbackProposal(payload.teacherFeedbackProposal);
  if (teacherFeedbackProposal) {
    payload.teacherFeedbackProposal = teacherFeedbackProposal;
  } else {
    delete payload.teacherFeedbackProposal;
  }

  if (Array.isArray(payload.memoryProposals)) {
    const memoryProposalResults = payload.memoryProposals.map(normalizeMemoryProposal);
    payload.memoryProposals = memoryProposalResults
      .map((result) => result.proposal)
      .filter(Boolean)
      .slice(0, 6);
    const memoryProposalRejections = summarizeMemoryProposalRejections(
      memoryProposalResults.map((result) => result.rejection).filter(Boolean)
    );
    if (memoryProposalRejections.length) payload.memoryProposalRejections = memoryProposalRejections;
    else delete payload.memoryProposalRejections;
  } else {
    delete payload.memoryProposals;
    delete payload.memoryProposalRejections;
  }

  return payload;
}

function normalizeProviderStatePatch(statePatch) {
  const nextPatch = {};

  for (const key of PROVIDER_TOP_LEVEL_PATCH_KEYS) {
    if (key === "factions") continue;
    if (key in statePatch) {
      nextPatch[key] = statePatch[key];
    }
  }

  if (statePatch.factions && typeof statePatch.factions === "object" && !Array.isArray(statePatch.factions)) {
    nextPatch.factions = Object.fromEntries(
      Object.entries(statePatch.factions).filter(([, value]) => typeof value === "number")
    );
  }

  if (statePatch.player && typeof statePatch.player === "object" && !Array.isArray(statePatch.player)) {
    const playerPatch = {};
    for (const key of PROVIDER_PLAYER_PATCH_KEYS) {
      if (key in statePatch.player) {
        playerPatch[key] = statePatch.player[key];
      }
    }
    nextPatch.player = playerPatch;
  }

  return nextPatch;
}

function createRemoteProvider(requestJson, requestJsonStream) {
  return {
    supportsStreaming: Boolean(requestJsonStream),

    startGame(worldState) {
      return runTask(buildOpeningTask(worldState), requestJson);
    },

    runTurn(worldState, input) {
      return runTask(buildTurnTask(worldState, input), requestJson);
    },

    async streamTurn(worldState, input, streamHandlers = {}) {
      if (!requestJsonStream) {
        return runTask(buildTurnTask(worldState, input), requestJson);
      }

      return runStreamingTask(buildTurnTask(worldState, input), requestJsonStream, streamHandlers);
    },

    generateExamQuestion(worldState, exam) {
      return runTask(buildExamQuestionTask(worldState, exam), requestJson);
    },

    suggestQuickActions(quickActionContext) {
      return runTask(buildQuickActionTask(quickActionContext), requestJson);
    },

    gradeExamEssay(worldState, exam, essay, authenticityCheck) {
      return runTask(buildGradeTask(worldState, exam, essay, authenticityCheck), requestJson);
    }
  };
}

function requireEnv(name, providerName) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${providerName} provider requires ${name}; falling back to mock.`);
  }
  return value;
}

module.exports = {
  createRemoteProvider,
  normalizeModelPayload,
  normalizeProviderStatePatch,
  readTimeoutMs,
  requireEnv
};
