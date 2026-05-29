// @ts-check

const DEFAULT_MAX_EVIDENCE_REFS = 24;

const DOMAIN_PRIORITY = Object.freeze({
  events: 42,
  people: 34,
  offices: 30,
  memory: 28,
  geography: 24,
  intel: 22,
  entities: 18
});

function cleanText(value, fallback = "", maxLength = 160) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeForSearch(value) {
  return cleanText(value, "", 1000).toLowerCase();
}

function unique(values, limit = 24) {
  const result = [];
  const seen = new Set();
  for (const value of values || []) {
    const text = cleanText(value, "", 80);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function extractQueryTerms(value) {
  const rawTerms = Array.isArray(value)
    ? value
    : normalizeForSearch(value)
      .split(/[^\w\u4e00-\u9fff.:-]+/u)
      .filter(Boolean);
  return unique(rawTerms.filter((term) => cleanText(term, "", 80).length >= 2), 24);
}

function queryScore(ref, queryTerms) {
  if (!queryTerms.length) return 0;
  const haystack = normalizeForSearch([
    ref.refId,
    ref.sourceView,
    ref.label,
    ref.summary,
    ref.domain,
    ref.collection
  ].filter(Boolean).join(" "));
  let score = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) score += 18;
  }
  return score;
}

function sourceScore(ref) {
  const domain = cleanText(ref.domain, "", 40);
  return DOMAIN_PRIORITY[domain] || 0;
}

function compareRankedEvidenceRefs(first, second) {
  if (second.score !== first.score) return second.score - first.score;
  return String(first.ref.refId || "").localeCompare(String(second.ref.refId || ""));
}

function scoreEvidenceRef(ref, options = {}) {
  const queryTerms = extractQueryTerms(options.queryTerms || options.queryText || "");
  const priority = clampNumber(ref.priority, -10000, 10000, 0);
  const recency = clampNumber(ref.generatedAtTurn, 0, 1000000, 0) > 0 ? 4 : 0;
  return priority + sourceScore(ref) + queryScore(ref, queryTerms) + recency;
}

function rankEvidenceRefs(refs, options = {}) {
  const maxRefs = clampNumber(
    options.maxRefs || options.limit || DEFAULT_MAX_EVIDENCE_REFS,
    0,
    96,
    DEFAULT_MAX_EVIDENCE_REFS
  );
  const ranked = (Array.isArray(refs) ? refs : [])
    .map((ref) => ({ ref, score: scoreEvidenceRef(ref, options) }))
    .sort(compareRankedEvidenceRefs)
    .slice(0, maxRefs)
    .map(({ ref }, index) => ({
      ...ref,
      rank: index + 1
    }));
  return ranked;
}

module.exports = {
  DEFAULT_MAX_EVIDENCE_REFS,
  rankEvidenceRefs,
  scoreEvidenceRef
};
