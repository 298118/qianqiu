const {
  NPC_INTERACTION_ACTIONS,
  NPC_PRIVATE_SIGNAL_TAGS,
  NPC_ROSTER_SCHEMA_VERSION,
  NPC_STAGE_FIXTURES,
  NPC_TIERS,
  PORTRAIT_POOLS
} = require("./npcRosterConfig");

const PORTRAIT_REF_PATTERN = /^portrait-[a-z0-9][a-z0-9_-]{0,140}$/i;
const UNSAFE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|raw[_ -]?(?:provider|audit|table|ledger|prompt)|\b(?:provider|prompt|proposal)\b|retrievalContext|statePatch|worldState|prompt_retrieval_index|event_archive_index|world_sessions|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;
const UNSAFE_PORTRAIT_REF_PATTERN = /(?:^|[-_])(raw|provider|prompt|hidden|private|key|path|secret|token|api|file|data|http)(?:$|[-_])/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = 140) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || UNSAFE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function uniqueCleanList(values, limit = 12, maxLength = 80) {
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

function deterministicIndex(seed, length) {
  if (!length) return 0;
  const text = String(seed || "default");
  let total = 0;
  for (const character of text) total += character.codePointAt(0) || 0;
  return total % length;
}

function normalizeRole(worldState = {}) {
  const role = cleanText(worldState.player?.role || worldState.role, "scholar", 40);
  return NPC_STAGE_FIXTURES[role] ? role : "scholar";
}

function normalizeTier(value) {
  const tier = cleanText(value, "ambient", 24);
  return NPC_TIERS.includes(tier) ? tier : "ambient";
}

function normalizePortraitRef(value, fallback = "") {
  const text = cleanText(value, fallback, 160);
  if (!text || !PORTRAIT_REF_PATTERN.test(text) || UNSAFE_PORTRAIT_REF_PATTERN.test(text)) return fallback;
  return text;
}

function assignPortraitRef(npc = {}, seed = "") {
  const explicit = normalizePortraitRef(npc.portraitRef, "");
  if (explicit) return explicit;
  if (normalizeTier(npc.tier) === "signature") {
    const pool = PORTRAIT_POOLS.signature;
    return pool[deterministicIndex(`${seed}:${npc.npcId}:signature`, pool.length)];
  }
  const pool = PORTRAIT_POOLS.generic;
  return pool[deterministicIndex(`${seed}:${npc.npcId}:generic`, pool.length)];
}

function normalizePublicProfile(profile = {}) {
  const source = isPlainObject(profile) ? profile : {};
  return {
    title: cleanText(source.title, "可见人物", 80),
    origin: cleanText(source.origin, "", 80),
    posting: cleanText(source.posting, "", 80),
    summary: cleanText(source.summary, "", 180),
    visibleAbilities: uniqueCleanList(source.visibleAbilities, 8, 40)
  };
}

function normalizeRelationship(relationship = {}) {
  const source = isPlainObject(relationship) ? relationship : {};
  return {
    closeness: clampNumber(source.closeness, -100, 100, 0),
    trust: clampNumber(source.trust, 0, 100, 0),
    awe: clampNumber(source.awe, 0, 100, 0),
    hostility: clampNumber(source.hostility, 0, 100, 0),
    favorsOwed: clampNumber(source.favorsOwed, -20, 20, 0),
    labels: uniqueCleanList(source.labels, 6, 40)
  };
}

function normalizeHiddenDossier(hiddenDossier = {}) {
  const source = isPlainObject(hiddenDossier) ? hiddenDossier : {};
  return {
    motives: uniqueCleanList(source.motives, 6, 80),
    trueAssets: uniqueCleanList(source.trueAssets, 6, 80),
    secretRelationships: uniqueCleanList(source.secretRelationships, 6, 80),
    unrevealedTasks: uniqueCleanList(source.unrevealedTasks, 6, 80)
  };
}

function normalizePrivateSignalTags(values = []) {
  const allowed = new Set(NPC_PRIVATE_SIGNAL_TAGS);
  return uniqueCleanList(values, 6, 32).filter((tag) => allowed.has(tag));
}

function normalizeSocialProfile(profile = {}) {
  const source = isPlainObject(profile) ? profile : {};
  return {
    adult: source.adult !== false,
    marriageStatus: cleanText(source.marriageStatus, "unknown", 40),
    ritualStatus: cleanText(source.ritualStatus, "unreviewed", 40),
    kinshipBlocked: source.kinshipBlocked === true,
    publicNote: cleanText(source.publicNote, "礼法、身份和亲族意见须由服务器审查。", 140)
  };
}

function normalizeInteractions(values = []) {
  const allowed = new Set(NPC_INTERACTION_ACTIONS);
  return uniqueCleanList(values, 12, 32).filter((action) => allowed.has(action));
}

function normalizeNpc(npc = {}, seed = "") {
  const npcId = cleanId(npc.npcId || npc.id, "");
  const tier = normalizeTier(npc.tier);
  return {
    npcId,
    sourceRef: cleanId(npc.sourceRef, `fixture:${npcId}`),
    displayName: cleanText(npc.displayName || npc.name, "无名人物", 80),
    tier,
    roleTags: uniqueCleanList(npc.roleTags, 12, 40),
    stageTags: uniqueCleanList(npc.stageTags, 12, 40),
    portraitRef: assignPortraitRef({ ...npc, npcId, tier }, seed),
    publicProfile: normalizePublicProfile(npc.publicProfile),
    relationship: normalizeRelationship(npc.relationship),
    inventoryRefs: uniqueCleanList(npc.inventoryRefs, 8, 96),
    assetRefs: uniqueCleanList(npc.assetRefs, 8, 96),
    resourceAccountRefs: uniqueCleanList(npc.resourceAccountRefs, 8, 96),
    availableInteractions: normalizeInteractions(npc.availableInteractions),
    socialProfile: normalizeSocialProfile(npc.socialProfile),
    hiddenDossier: normalizeHiddenDossier(npc.hiddenDossier),
    privateSignalTags: normalizePrivateSignalTags(npc.privateSignalTags)
  };
}

function buildDeterministicNpcRoster(worldState = {}, options = {}) {
  const role = normalizeRole(worldState);
  const seed = cleanText(options.seed || worldState.sessionId || `${role}:${worldState.year || 1644}:${worldState.month || 1}`, "default", 120);
  const fixtures = NPC_STAGE_FIXTURES[role] || NPC_STAGE_FIXTURES.scholar;
  const npcs = fixtures.map((npc) => normalizeNpc(npc, seed)).filter((npc) => npc.npcId);
  return {
    schemaVersion: NPC_ROSTER_SCHEMA_VERSION,
    generatedFor: {
      role,
      year: clampNumber(worldState.year, 1, 9999, 1644),
      month: clampNumber(worldState.month, 1, 12, 1),
      tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1)
    },
    npcs
  };
}

function ensureNpcRoster(worldState = {}, options = {}) {
  if (!isPlainObject(worldState.npcRoster) || worldState.npcRoster.schemaVersion !== NPC_ROSTER_SCHEMA_VERSION) {
    worldState.npcRoster = buildDeterministicNpcRoster(worldState, options);
  }
  return worldState.npcRoster;
}

function toNpcListItem(npc) {
  return {
    npcId: npc.npcId,
    displayName: npc.displayName,
    tier: npc.tier,
    roleTags: npc.roleTags,
    stageTags: npc.stageTags,
    portraitRef: npc.portraitRef,
    publicProfile: {
      title: npc.publicProfile.title,
      posting: npc.publicProfile.posting,
      summary: npc.publicProfile.summary
    },
    relationshipSummary: {
      closeness: npc.relationship.closeness,
      trust: npc.relationship.trust,
      hostility: npc.relationship.hostility,
      labels: npc.relationship.labels
    },
    availableInteractions: npc.availableInteractions
  };
}

function buildNpcRosterView(worldState = {}, options = {}) {
  const roster = ensureNpcRoster(worldState, options);
  const pageSize = clampNumber(options.pageSize, 1, 50, 20);
  const page = clampNumber(options.page, 1, Number.MAX_SAFE_INTEGER, 1);
  const roleTag = cleanText(options.roleTag, "", 40);
  const interaction = cleanText(options.interaction, "", 32);
  const filtered = roster.npcs.filter((npc) =>
    (!roleTag || npc.roleTags.includes(roleTag) || npc.stageTags.includes(roleTag)) &&
    (!interaction || npc.availableInteractions.includes(interaction))
  );
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map(toNpcListItem);
  return {
    schemaVersion: NPC_ROSTER_SCHEMA_VERSION,
    generatedFor: roster.generatedFor,
    page,
    pageSize,
    totalItems: filtered.length,
    items,
    safeguards: {
      privateProfileRedacted: true,
      softSignalsRedacted: true,
      portraitRefsReviewedOnly: true
    }
  };
}

function buildNpcDetailView(worldState = {}, npcId, options = {}) {
  const roster = ensureNpcRoster(worldState, options);
  const id = cleanId(npcId, "");
  const npc = roster.npcs.find((row) => row.npcId === id);
  if (!npc) return null;
  return {
    schemaVersion: NPC_ROSTER_SCHEMA_VERSION,
    npcId: npc.npcId,
    sourceRef: npc.sourceRef,
    displayName: npc.displayName,
    tier: npc.tier,
    roleTags: npc.roleTags,
    stageTags: npc.stageTags,
    portraitRef: npc.portraitRef,
    publicProfile: npc.publicProfile,
    relationship: npc.relationship,
    inventoryRefs: npc.inventoryRefs,
    assetRefs: npc.assetRefs,
    resourceAccountRefs: npc.resourceAccountRefs,
    availableInteractions: npc.availableInteractions,
    socialProfile: npc.socialProfile,
    safeguards: {
      privateProfileRedacted: true,
      softSignalsRedacted: true,
      serverOwnsConsequences: true
    }
  };
}

function buildNpcPrivateSignalView(worldState = {}, npcId, options = {}) {
  const roster = ensureNpcRoster(worldState, options);
  const id = cleanId(npcId, "");
  const npc = roster.npcs.find((row) => row.npcId === id);
  if (!npc) return null;
  return {
    schemaVersion: NPC_ROSTER_SCHEMA_VERSION,
    npcId: npc.npcId,
    privateSignalTags: npc.privateSignalTags,
    constraints: {
      derivedFromHiddenDossier: true,
      containsHiddenFacts: false,
      externalProviderMayTreatAsSoftSignalsOnly: true
    }
  };
}

function getNpcForServer(worldState = {}, npcId, options = {}) {
  const roster = ensureNpcRoster(worldState, options);
  const id = cleanId(npcId, "");
  return roster.npcs.find((row) => row.npcId === id) || null;
}

module.exports = {
  assignPortraitRef,
  buildDeterministicNpcRoster,
  buildNpcDetailView,
  buildNpcPrivateSignalView,
  buildNpcRosterView,
  ensureNpcRoster,
  getNpcForServer,
  normalizePortraitRef
};
