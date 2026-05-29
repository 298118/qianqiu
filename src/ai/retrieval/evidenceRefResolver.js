// @ts-check

const crypto = require("node:crypto");

const { assertPublicAiProviderEnvelope, redactAiProviderText } = require("../providerSafety");
const { DEFAULT_MAX_EVIDENCE_REFS, rankEvidenceRefs } = require("./retrievalRanker");

const EVIDENCE_REF_SCHEMA_VERSION = "s92.7-evidence-ref.v1";

const ALLOWED_EVIDENCE_VISIBILITIES = Object.freeze([
  "public",
  "player_visible",
  "actor_visible"
]);

const RETRIEVAL_COLLECTION_PATHS = Object.freeze([
  ["geography", "countries"],
  ["geography", "cities"],
  ["geography", "routes"],
  ["geography", "frontierZones"],
  ["people", "npcs"],
  ["people", "relationships"],
  ["offices", "bureaus"],
  ["offices", "offices"],
  ["offices", "cityJurisdictions"],
  ["offices", "postings"],
  ["offices", "assessmentRecords"],
  ["offices", "transferRecords"],
  ["intel", "rumors"],
  ["events", "recentEvents"],
  ["events", "worldThreads"],
  ["events", "longTermEvents"],
  ["events", "resolvedEvents"],
  ["events", "localDockets"],
  ["events", "militaryReports"],
  ["events", "economicReports"],
  ["events", "eventChains"],
  ["entities", "highlights"],
  ["memory", "actorMemories"],
  ["memory", "sessionSummaries"]
]);

const SOURCE_VIEW_COLLECTIONS = Object.freeze({
  "worldGeography.country": ["geography", "countries"],
  "worldGeography.city": ["geography", "cities"],
  "worldGeography.route": ["geography", "routes"],
  "worldGeography.frontierZone": ["geography", "frontierZones"],
  "worldPeople.npc": ["people", "npcs"],
  "worldPeople.relationship": ["people", "relationships"],
  "officialPostings.bureau": ["offices", "bureaus"],
  "officialPostings.office": ["offices", "offices"],
  "officialPostings.cityJurisdiction": ["offices", "cityJurisdictions"],
  "officialPostings.posting": ["offices", "postings"],
  "officialPostings.assessmentRecord": ["offices", "assessmentRecords"],
  "officialPostings.transferRecord": ["offices", "transferRecords"],
  "worldThreads.activeThread": ["events", "worldThreads"],
  "longTermEvents.activeEvent": ["events", "longTermEvents"],
  "worldThreads.recentResolved": ["events", "resolvedEvents"],
  "longTermEvents.recentResolved": ["events", "resolvedEvents"],
  "localAffairsDocketView.docket": ["events", "localDockets"],
  "militaryDiplomacyView.report": ["events", "militaryReports"],
  "economicFiscalView.report": ["events", "economicReports"],
  "historicalEventArchiveView.chain": ["events", "eventChains"],
  eventArchiveView: ["events", "recentEvents"],
  "intelligenceRumorView.rumor": ["intel", "rumors"],
  "worldEntities.highlight": ["entities", "highlights"],
  "actorMemoryView.memory": ["memory", "actorMemories"],
  "sessionSummaryView.summary": ["memory", "sessionSummaries"]
});

const UNSAFE_EVIDENCE_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent|dossier)|hidden\s+(?:notes?|intent|dossier)|hiddenDossier|hidden_dossier|privateSignalTags|private_signal_tags|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|row|sql)|rawProviderPayload|providerPayload|provider_payload|rawPrompt|fullPrompt|完整提示词|完整\s*prompt|(?:provider|prompt)\s+(?:payload|proposal|response|request|body)|prompt\s+provider|provider\s+proposal|\b(?:statePatch|worldState|rawSql|SQL|sqlite)\b|server\.[A-Za-z0-9_.:-]+|base(?:URL|Url|_url)?\s*[:=]\s*[^\s"'<>]+|(?:headers?|authorization)\b[^;\n。；]{0,80}\bBearer\s+[A-Za-z0-9._-]{8,}|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|\b(?:sk|tp)-[A-Za-z0-9_-]{6,}\b|\[redacted-(?:key|path|url|sensitive-assignment|provider-body|provider-detail)\])/i;

function cleanText(value, fallback = "", maxLength = 160) {
  if (value === null || value === undefined) return fallback;
  const text = Array.isArray(value) ? value.join(" ") : String(value);
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 14);
}

function sourceSlug(value) {
  const text = cleanText(value, "retrieval", 96)
    .replace(/[^A-Za-z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text || "retrieval";
}

function normalizeVisibility(value) {
  const normalized = cleanText(value, "", 48).toLowerCase().replace(/[-\s]+/g, "_");
  return normalized || "public";
}

function isAllowedEvidenceVisibility(value) {
  return ALLOWED_EVIDENCE_VISIBILITIES.includes(normalizeVisibility(value));
}

function hasUnsafeEvidenceText(value) {
  let serialized = "";
  try {
    serialized = JSON.stringify(value || {});
  } catch (error) {
    serialized = String(value || "");
  }
  const redacted = redactAiProviderText(serialized, { maxLength: 12000 });
  return UNSAFE_EVIDENCE_TEXT_PATTERN.test(serialized) || UNSAFE_EVIDENCE_TEXT_PATTERN.test(redacted);
}

function safeEvidenceText(value, fallback = "", maxLength = 160) {
  const text = cleanText(value, fallback, maxLength);
  if (!text) return fallback;
  if (hasUnsafeEvidenceText(text)) return fallback;
  const redacted = redactAiProviderText(text, { maxLength });
  if (hasUnsafeEvidenceText(redacted)) return fallback;
  return cleanText(redacted, fallback, maxLength);
}

function firstSafeText(row, fields, fallback = "", maxLength = 120) {
  for (const field of fields) {
    const text = safeEvidenceText(row?.[field], "", maxLength);
    if (text) return text;
  }
  return fallback;
}

function collectSummaryParts(row = {}) {
  const parts = [
    row.publicSummary,
    row.summary,
    row.publicFinding,
    row.outcome,
    row.statusLabel,
    row.authorityBoundary,
    row.followUpHint
  ];
  if (Array.isArray(row.interventionHints)) parts.push(row.interventionHints.slice(0, 2).join("；"));
  if (Array.isArray(row.recentNotes)) parts.push(row.recentNotes.slice(0, 2).join("；"));
  if (Array.isArray(row.tags)) parts.push(row.tags.slice(0, 4).join("、"));
  if (Array.isArray(row.highlights)) parts.push(row.highlights.slice(0, 3).join("；"));
  if (Array.isArray(row.relatedLabels)) parts.push(row.relatedLabels.slice(0, 3).join("、"));
  if (Array.isArray(row.sourceTypes)) parts.push(row.sourceTypes.slice(0, 2).join("、"));

  const result = [];
  const seen = new Set();
  for (const part of parts) {
    const text = safeEvidenceText(part, "", 120);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.join("；").length >= 180) break;
  }
  return cleanText(result.join("；"), "", 220);
}

function inferSourceView(row = {}, options = {}) {
  return safeEvidenceText(options.sourceView || row.sourceView, "retrieval.row", 96);
}

function inferCollection(sourceView, options = {}) {
  if (options.domain && options.collection) {
    return [cleanText(options.domain, "retrieval", 40), cleanText(options.collection, "rows", 40)];
  }
  return SOURCE_VIEW_COLLECTIONS[sourceView] || ["retrieval", "rows"];
}

function buildEvidenceRef(row = {}, options = {}) {
  if (!row || typeof row !== "object") return null;
  const record = /** @type {Record<string, any>} */ (row);
  const visibility = normalizeVisibility(record.visibility || options.visibility);
  if (!ALLOWED_EVIDENCE_VISIBILITIES.includes(visibility)) return null;
  if (hasUnsafeEvidenceText(record)) return null;

  const sourceView = inferSourceView(record, options);
  if (!sourceView || hasUnsafeEvidenceText(sourceView)) return null;
  if (!SOURCE_VIEW_COLLECTIONS[sourceView]) return null;
  const [domain, collection] = inferCollection(sourceView, options);
  const stableId = firstSafeText(record, ["id", "sourceId", "refId", "title", "name"], sourceView, 96);
  const label = firstSafeText(
    record,
    ["label", "name", "title", "officeTitle", "familyName", "domainLabel", "kind", "type", "statusLabel"],
    sourceView,
    96
  );
  const summary = collectSummaryParts(record) || label;
  if (!summary || hasUnsafeEvidenceText(summary)) return null;

  const refId = `eref:${sourceSlug(sourceView)}:${hashText(`${sourceView}:${stableId}:${label}:${summary}`)}`;
  const ref = {
    schemaVersion: EVIDENCE_REF_SCHEMA_VERSION,
    refId,
    sourceView,
    domain,
    collection,
    stableId,
    visibility,
    label,
    summary,
    priority: clampNumber(record.priority, -10000, 10000, 0)
  };
  const generatedAtTurn = clampNumber(options.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, -1);
  if (generatedAtTurn >= 0) ref.generatedAtTurn = generatedAtTurn;

  assertEvidenceRefSafe(ref);
  return ref;
}

function collectRetrievalRows(context = {}) {
  const rows = [];
  for (const [domain, collection] of RETRIEVAL_COLLECTION_PATHS) {
    const collectionRows = context?.[domain]?.[collection];
    if (!Array.isArray(collectionRows)) continue;
    for (const row of collectionRows) {
      rows.push({
        row,
        domain,
        collection,
        sourceView: row?.sourceView
      });
    }
  }
  return rows;
}

function buildEvidenceRefsFromRetrievalContext(context = {}, options = {}) {
  const refs = [];
  const seen = new Set();
  for (const candidate of collectRetrievalRows(context)) {
    const ref = buildEvidenceRef(candidate.row, {
      domain: candidate.domain,
      collection: candidate.collection,
      sourceView: candidate.sourceView,
      generatedAtTurn: context.generatedAtTurn
    });
    if (!ref || seen.has(ref.refId)) continue;
    seen.add(ref.refId);
    refs.push(ref);
  }
  return rankEvidenceRefs(refs, {
    maxRefs: options.maxRefs || DEFAULT_MAX_EVIDENCE_REFS,
    queryTerms: context.query?.terms || options.queryTerms || [],
    queryText: options.queryText || context.query?.playerAction || ""
  });
}

function assertEvidenceRefSafe(ref) {
  assertPublicAiProviderEnvelope(ref);
  if (!ref || typeof ref !== "object") {
    throw new Error("Evidence ref must be an object.");
  }
  if (ref.schemaVersion !== EVIDENCE_REF_SCHEMA_VERSION) {
    throw new Error("Evidence ref schema version mismatch.");
  }
  if (!cleanText(ref.refId, "", 120).startsWith("eref:")) {
    throw new Error("Evidence ref id must use the eref namespace.");
  }
  if (!isAllowedEvidenceVisibility(ref.visibility)) {
    throw new Error(`Evidence ref has disallowed visibility: ${String(ref.visibility || "")}`);
  }
  if (hasUnsafeEvidenceText(ref)) {
    throw new Error("Evidence ref contains unsafe text.");
  }
}

function resolveEvidenceRef(refId, refs = []) {
  const id = cleanText(refId, "", 160);
  if (!id || hasUnsafeEvidenceText(id)) return null;
  const ref = (Array.isArray(refs) ? refs : []).find((entry) => entry?.refId === id) || null;
  if (!ref) return null;
  assertEvidenceRefSafe(ref);
  return ref;
}

module.exports = {
  ALLOWED_EVIDENCE_VISIBILITIES,
  EVIDENCE_REF_SCHEMA_VERSION,
  buildEvidenceRef,
  buildEvidenceRefsFromRetrievalContext,
  hasUnsafeEvidenceText,
  isAllowedEvidenceVisibility,
  resolveEvidenceRef
};
