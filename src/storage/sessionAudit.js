const { randomUUID } = require("crypto");
const { normalizeTenDayPeriod } = require("../game/time");
const {
  assertSafeSessionId,
  createStoreError,
  toIsoString
} = require("./sessionRecord");

const CURRENT_AUDIT_SCHEMA_VERSION = 1;
const MAX_AUDIT_STRING_LENGTH = 320;
const MAX_AUDIT_ARRAY_LENGTH = 16;
const MAX_AUDIT_OBJECT_KEYS = 48;
const REDACTED = "[redacted]";
const REDACTED_PATH = "[redacted-path]";

const SECRET_ENV_NAME_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;
const SENSITIVE_AUDIT_KEY_PATTERN =
  /(apiKey|api_key|token|secret|password|credential|prompt|promptText|instructions|worldState|relationshipLedger|hidden|hiddenNotes|stack|filePath|path|databasePath|sessionsDir|sqliteDatabasePath)/i;

const AUDIT_VISIBILITIES = new Set(["public", "private", "developer"]);
const AI_PROPOSAL_STATUSES = new Set(["accepted", "partially_accepted", "rejected", "recorded"]);

function cleanAuditText(value, maxLength = MAX_AUDIT_STRING_LENGTH) {
  let text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  text = redactAuditText(text);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function redactAuditText(text) {
  let message = String(text ?? "");
  for (const [envName, secret] of Object.entries(process.env)) {
    if (!SECRET_ENV_NAME_PATTERN.test(envName) || !secret || String(secret).length < 8) continue;
    const value = String(secret);
    const variants = new Set([value, value.slice(0, 8), value.slice(0, 12), value.slice(-8), value.slice(-12)]);
    for (const variant of variants) {
      if (variant && variant.length >= 8) {
        message = message.split(variant).join(REDACTED);
      }
    }
  }

  message = message.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, REDACTED);
  message = message.replace(/[A-Za-z]:\\[^\s"'<>]+/g, REDACTED_PATH);
  message = message.replace(/(^|\s)(?:\.{0,2}[\\/])?data[\\/][^\s"'<>]+/g, `$1${REDACTED_PATH}`);
  message = message.replace(/\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+/g, REDACTED_PATH);
  return message;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeAuditValue(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return cleanAuditText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (depth >= 5) return `[array:${value.length}]`;
    return value.slice(0, MAX_AUDIT_ARRAY_LENGTH).map((item) => sanitizeAuditValue(item, depth + 1));
  }
  if (!isPlainObject(value)) return cleanAuditText(value);
  if (depth >= 5) return "[object]";

  const sanitized = {};
  for (const [key, nestedValue] of Object.entries(value).slice(0, MAX_AUDIT_OBJECT_KEYS)) {
    const safeKey = cleanAuditText(key, 80);
    if (!safeKey) continue;
    if (SENSITIVE_AUDIT_KEY_PATTERN.test(safeKey)) {
      sanitized[safeKey] = REDACTED;
      continue;
    }
    sanitized[safeKey] = sanitizeAuditValue(nestedValue, depth + 1);
  }
  return sanitized;
}

function toNullableNonNegativeInteger(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeVisibility(value) {
  const visibility = cleanAuditText(value || "developer", 32);
  return AUDIT_VISIBILITIES.has(visibility) ? visibility : "developer";
}

function normalizeProposalStatus(value) {
  const status = cleanAuditText(value || "recorded", 32);
  return AI_PROPOSAL_STATUSES.has(status) ? status : "recorded";
}

function contextFromEvent(event = {}, defaults = {}) {
  return {
    revision: toNullableNonNegativeInteger(event.revision ?? defaults.revision),
    turnCount: toNullableNonNegativeInteger(event.turnCount ?? defaults.turnCount),
    year: toNullableNonNegativeInteger(event.year ?? defaults.year),
    month: toNullableNonNegativeInteger(event.month ?? defaults.month),
    tenDayPeriod: normalizeTenDayPeriod(event.tenDayPeriod ?? defaults.tenDayPeriod),
    sceneCadence: cleanAuditText(event.sceneCadence ?? defaults.sceneCadence ?? "", 80) || null
  };
}

function createAuditEventRecord(sessionId, event = {}, defaults = {}) {
  assertSafeSessionId(sessionId);
  const now = new Date().toISOString();
  const summary = cleanAuditText(event.summary || event.eventType || "state_change");
  if (!summary) throw createStoreError(400, "Audit event summary is required");
  const context = contextFromEvent(event, defaults);

  return {
    auditSchemaVersion: CURRENT_AUDIT_SCHEMA_VERSION,
    eventId: cleanAuditText(event.eventId || randomUUID(), 80),
    sessionId,
    revision: context.revision,
    turnCount: context.turnCount,
    year: context.year,
    month: context.month,
    tenDayPeriod: context.tenDayPeriod,
    sceneCadence: context.sceneCadence,
    sourceSystem: cleanAuditText(event.sourceSystem || "server", 80) || "server",
    eventType: cleanAuditText(event.eventType || "state_change", 80) || "state_change",
    visibility: normalizeVisibility(event.visibility),
    summary,
    related: sanitizeAuditValue(event.related || {}),
    appliedChanges: sanitizeAuditValue(event.appliedChanges || {}),
    createdAt: toIsoString(event.createdAt, now)
  };
}

function createAiProposalRecord(sessionId, proposal = {}, defaults = {}) {
  assertSafeSessionId(sessionId);
  const now = new Date().toISOString();
  const context = contextFromEvent(proposal, defaults);
  const rejectedReasons = Array.isArray(proposal.rejectedReasons)
    ? proposal.rejectedReasons.map((reason) => cleanAuditText(reason, 180)).filter(Boolean)
    : [];
  const appliedEventIds = Array.isArray(proposal.appliedEventIds)
    ? proposal.appliedEventIds.map((id) => cleanAuditText(id, 80)).filter(Boolean)
    : [];

  return {
    auditSchemaVersion: CURRENT_AUDIT_SCHEMA_VERSION,
    proposalId: cleanAuditText(proposal.proposalId || randomUUID(), 80),
    sessionId,
    revision: context.revision,
    turnCount: context.turnCount,
    year: context.year,
    month: context.month,
    tenDayPeriod: context.tenDayPeriod,
    sceneCadence: context.sceneCadence,
    provider: cleanAuditText(proposal.provider || defaults.provider || process.env.AI_PROVIDER || "mock", 80) || "mock",
    promptPack: cleanAuditText(proposal.promptPack || "", 80) || null,
    proposalKind: cleanAuditText(proposal.proposalKind || "turn", 80) || "turn",
    status: normalizeProposalStatus(proposal.status),
    proposal: sanitizeAuditValue(proposal.proposal || {}),
    accepted: sanitizeAuditValue(proposal.accepted || {}),
    rejectedReasons,
    appliedEventIds,
    createdAt: toIsoString(proposal.createdAt, now)
  };
}

function normalizeAuditBatch(sessionId, batch = {}, defaults = {}) {
  const auditEvents = Array.isArray(batch.auditEvents)
    ? batch.auditEvents.map((event) => createAuditEventRecord(sessionId, event, defaults))
    : [];
  const aiProposals = Array.isArray(batch.aiProposals)
    ? batch.aiProposals.map((proposal) => createAiProposalRecord(sessionId, proposal, defaults))
    : [];
  return { auditEvents, aiProposals };
}

function createAuditContext(record) {
  return {
    record,
    skipWrite: false,
    errorAfterWrite: null,
    auditEvents: [],
    aiProposals: [],
    appendAuditEvent(event) {
      this.auditEvents.push(event);
    },
    appendAiProposal(proposal) {
      this.aiProposals.push(proposal);
    }
  };
}

module.exports = {
  CURRENT_AUDIT_SCHEMA_VERSION,
  createAiProposalRecord,
  createAuditContext,
  createAuditEventRecord,
  cleanAuditText,
  normalizeAuditBatch,
  redactAuditText,
  sanitizeAuditValue
};
