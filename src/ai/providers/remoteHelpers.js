const { getModelSchema, validatePayload } = require("../schemas");
const {
  buildExamQuestionTask,
  buildGradeTask,
  buildOpeningTask,
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

function normalizeModelPayload(schemaName, payload) {
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
