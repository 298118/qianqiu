const { buildPlayerAiActorProfile } = require("./aiActorProfiles");
const { collectVisibleDomainEvidenceRefs } = require("./domainToolResolvers");
const { resolveAndApplyCityPolicy } = require("./cityPolicyResolver");
const { resolveAndApplyMilitaryDiplomacy } = require("./militaryDiplomacyResolver");

const ROLE_CYCLE_DOMAIN_ADJUDICATION_SCHEMA_VERSION = 1;
const MAX_FEEDBACK_EVENTS = 2;
const MAX_EVIDENCE_REFS = 4;
const MAX_TEXT_LENGTH = 180;

const SENSITIVE_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记|军情)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|row)|\b(?:statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite)\b|server\.[A-Za-z0-9_.:-]+|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const ATTRIBUTE_LABELS = Object.freeze({
  treasury: "府库",
  grainReserve: "粮储",
  publicOrder: "民心",
  taxRate: "税率",
  corruption: "贪腐",
  armyMorale: "军心",
  borderThreat: "边患",
  "player.performanceMerit": "考成",
  "player.cleanReputation": "清望",
  "player.impeachmentRisk": "参劾风险",
  "player.superiorFavor": "上官眷注",
  "player.scouting": "斥候",
  "player.campaignRisk": "战险",
  "player.supply": "本部粮饷",
  "player.command": "统率",
  "player.battleReputation": "战名"
});

const MAGISTRATE_MARKET_TERMS = [
  "市价",
  "粮价",
  "米价",
  "平粜",
  "稳价",
  "禁囤",
  "囤积",
  "牙行",
  "籴粜",
  "market price",
  "price stabilization"
];
const MAGISTRATE_NPC_ECONOMY_TERMS = [
  "人物月账",
  "月账",
  "赊欠",
  "人情债",
  "雇工",
  "委派回禀",
  "npc economy"
];
const MAGISTRATE_POLICY_ACTION_CUES = [
  "处置",
  "裁决",
  "整肃",
  "禁囤",
  "禁止",
  "严禁",
  "平粜",
  "稳价",
  "发令",
  "施行",
  "adjudicate",
  "resolve",
  "regulate",
  "stabilize"
];
const MAGISTRATE_POLICY_EXECUTION_CUES = [
  "处置",
  "裁决",
  "整肃",
  "禁囤",
  "禁止",
  "严禁",
  "发令",
  "施行",
  "adjudicate",
  "resolve",
  "regulate",
  "stabilize"
];
const READ_ONLY_CUES = ["查", "查看", "翻看", "检视", "核阅", "复核", "复盘", "review", "inspect"];
const GENERAL_DOMAIN_TERMS = [
  "舆图",
  "军议",
  "战事档案",
  "战事档",
  "军报",
  "边报",
  "遣哨",
  "斥候",
  "侦察",
  "巡边",
  "调粮",
  "粮道",
  "补给",
  "war council",
  "frontier map",
  "scout",
  "resupply"
];
const GENERAL_HIGH_STAKES_TERMS = [
  "会战",
  "大会战",
  "决战",
  "夜袭",
  "出击",
  "进兵",
  "进剿",
  "破敌",
  "攻击",
  "袭击",
  "攻城",
  "开战",
  "宣战",
  "campaign",
  "battle",
  "attack",
  "declare war"
];
const GENERAL_SCOUT_ACTION_TERMS = [
  "遣哨",
  "派哨",
  "发哨",
  "侦察",
  "巡边",
  "哨探",
  "探边",
  "派斥候",
  "遣斥候",
  "scout",
  "recon"
];
const GENERAL_RESUPPLY_ACTION_TERMS = [
  "调粮",
  "运粮",
  "筹粮",
  "补粮",
  "补给",
  "调饷",
  "调拨粮饷",
  "resupply"
];
const GENERAL_EXECUTION_CUES = [
  "遣哨",
  "派哨",
  "发哨",
  "派斥候",
  "遣斥候",
  "调粮",
  "运粮",
  "筹粮",
  "补粮",
  "调饷",
  "调拨",
  "押粮",
  "发粮",
  "施行",
  "发令",
  "resupply"
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || SENSITIVE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function cleanRef(value, fallback = "") {
  return cleanText(String(value || ""), fallback, 120)
    .replace(/[^A-Za-z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function cleanRefList(values = [], limit = MAX_EVIDENCE_REFS) {
  const output = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const ref = cleanRef(value, "");
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    output.push(ref);
    if (output.length >= limit) break;
  }
  return output;
}

function textIncludesAny(text, terms) {
  const lower = String(text || "").toLowerCase();
  return terms.some((term) => lower.includes(String(term).toLowerCase()));
}

function createEmptyFeedback() {
  return {
    schemaVersion: ROLE_CYCLE_DOMAIN_ADJUDICATION_SCHEMA_VERSION,
    summary: "",
    events: [],
    attributeChanges: [],
    outcome: null
  };
}

function classifyRoleCycleDomainIntent(worldState = {}, input = "", actorProfile = null) {
  const profile = actorProfile || buildPlayerAiActorProfile(worldState);
  const actorType = profile.actorType;
  const text = cleanText(input, "", 260);
  if (!text) return null;
  const hasReadOnlyCue = textIncludesAny(text, READ_ONLY_CUES);

  if (actorType === "magistrate") {
    if (
      textIncludesAny(text, MAGISTRATE_MARKET_TERMS) &&
      textIncludesAny(text, MAGISTRATE_POLICY_ACTION_CUES)
    ) {
      if (hasReadOnlyCue && !textIncludesAny(text, MAGISTRATE_POLICY_EXECUTION_CUES)) {
        return null;
      }
      return textIncludesAny(text, ["平粜", "稳价", "粮价", "米价"])
        ? "magistrate_grain_price_policy"
        : "magistrate_market_policy";
    }
    if (
      textIncludesAny(text, MAGISTRATE_NPC_ECONOMY_TERMS) &&
      textIncludesAny(text, READ_ONLY_CUES)
    ) {
      return "magistrate_npc_economy_review";
    }
  }

  if (actorType === "general") {
    if (!textIncludesAny(text, GENERAL_DOMAIN_TERMS)) return null;
    if (textIncludesAny(text, GENERAL_HIGH_STAKES_TERMS)) return null;
    if (hasReadOnlyCue && !textIncludesAny(text, GENERAL_EXECUTION_CUES)) return null;
    if (textIncludesAny(text, GENERAL_RESUPPLY_ACTION_TERMS)) {
      return "general_war_council_resupply";
    }
    if (textIncludesAny(text, GENERAL_SCOUT_ACTION_TERMS)) {
      return "general_war_council_scout";
    }
    return null;
  }

  return null;
}

function actorScopeSet(actorProfile = {}) {
  return new Set((Array.isArray(actorProfile.jurisdictionRefs) ? actorProfile.jurisdictionRefs : [])
    .map((ref) => cleanRef(ref, ""))
    .filter(Boolean));
}

function evidenceIntersectsScope(evidence = {}, scopes = new Set()) {
  if (!scopes.size) return true;
  return (Array.isArray(evidence.scopeRefs) ? evidence.scopeRefs : [])
    .some((scopeRef) => scopes.has(cleanRef(scopeRef, "")));
}

function collectEvidenceEntries(worldState = {}, actorProfile = {}) {
  return [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .filter((entry) => entry?.ref && entry?.domain)
    .map((entry) => ({
      ref: cleanRef(entry.ref, ""),
      domain: cleanRef(entry.domain, ""),
      title: cleanText(entry.title, "", 80),
      sourceView: cleanText(entry.sourceView, "", 80),
      confidence: Number.isFinite(Number(entry.confidence)) ? Number(entry.confidence) : 0,
      scopeRefs: cleanRefList(entry.scopeRefs || [], 12)
    }))
    .filter((entry) => entry.ref && entry.domain);
}

function pickEvidenceForDomain(entries = [], domain, scopes = new Set(), usedRefs = new Set()) {
  const candidates = entries.filter((entry) => entry.domain === domain && !usedRefs.has(entry.ref));
  const scoped = candidates.filter((entry) => evidenceIntersectsScope(entry, scopes));
  const pool = scoped.length ? scoped : candidates;
  return pool
    .slice()
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0] || null;
}

function selectEvidenceRefs(worldState, actorProfile, requiredDomains = [], fillDomains = [], limit = MAX_EVIDENCE_REFS) {
  const entries = collectEvidenceEntries(worldState, actorProfile);
  const scopes = actorScopeSet(actorProfile);
  const usedRefs = new Set();
  const refs = [];

  for (const domain of requiredDomains) {
    const picked = pickEvidenceForDomain(entries, domain, scopes, usedRefs);
    if (!picked) continue;
    usedRefs.add(picked.ref);
    refs.push(picked.ref);
    if (refs.length >= limit) return refs;
  }

  for (const domain of fillDomains) {
    const picked = pickEvidenceForDomain(entries, domain, scopes, usedRefs);
    if (!picked) continue;
    usedRefs.add(picked.ref);
    refs.push(picked.ref);
    if (refs.length >= limit) return refs;
  }

  return refs;
}

function readPathValue(worldState = {}, path) {
  if (!path.startsWith("player.")) return worldState[path];
  return worldState.player?.[path.slice("player.".length)];
}

function buildAttributeChanges(beforeState = {}, afterState = {}, outcome = {}, reason = "角色循环服务器裁决") {
  if (outcome.status !== "accepted") return [];
  const changes = [];
  for (const key of Object.keys(outcome.stateDelta || {})) {
    const previousValue = readPathValue(beforeState, key);
    const after = readPathValue(afterState, key);
    const before = previousValue === undefined && typeof after === "number" ? 0 : previousValue;
    if (before === after) continue;
    changes.push({
      path: key,
      label: ATTRIBUTE_LABELS[key] || key,
      before,
      after,
      reason
    });
  }
  for (const key of Object.keys(outcome.playerDelta || {})) {
    const path = `player.${key}`;
    const previousValue = readPathValue(beforeState, path);
    const after = readPathValue(afterState, path);
    const before = previousValue === undefined && typeof after === "number" ? 0 : previousValue;
    if (before === after) continue;
    changes.push({
      path,
      label: ATTRIBUTE_LABELS[path] || key,
      before,
      after,
      reason
    });
  }
  return changes;
}

function buildPublicOutcome(outcome = {}, resolver) {
  if (!isPlainObject(outcome)) return null;
  const base = {
    resolver,
    status: cleanText(outcome.status, "rejected", 32),
    outcomeId: cleanRef(outcome.outcomeId, ""),
    evidenceRefs: cleanRefList(outcome.evidenceRefs, MAX_EVIDENCE_REFS),
    evidenceRefCount: Array.isArray(outcome.evidenceRefs) ? outcome.evidenceRefs.length : 0,
    publicSummary: cleanText(outcome.publicSummary, "", 160),
    rejectionReasons: Array.isArray(outcome.rejectionReasons)
      ? outcome.rejectionReasons.map((reason) => cleanText(reason, "", 100)).filter(Boolean).slice(0, 4)
      : [],
    affectedPaths: [
      ...Object.keys(outcome.stateDelta || {}),
      ...Object.keys(outcome.playerDelta || {}).map((key) => `player.${key}`)
    ].map((path) => cleanRef(path, "")).filter(Boolean).slice(0, 10)
  };

  if (resolver === "city_policy") {
    return {
      ...base,
      intent: cleanText(outcome.policyType, "city_policy", 60),
      label: cleanText(outcome.policyLabel, "城市政策", 80)
    };
  }

  return {
    ...base,
    intent: cleanText(outcome.actionKind, "military_order", 60),
    domainResolverKind: cleanText(outcome.resolverKind, "military", 40),
    label: cleanText(outcome.actionLabel, "军务处置", 80)
  };
}

function buildResolverFeedback(beforeState, afterState, outcome, resolver) {
  const publicOutcome = buildPublicOutcome(outcome, resolver);
  const accepted = publicOutcome?.status === "accepted";
  const publicEvent = outcome.publicEvent;
  const eventSummary = accepted ? cleanText(publicEvent?.summary, "", 180) : "";
  const label = publicOutcome?.label || (resolver === "city_policy" ? "城市政策" : "军务处置");

  return {
    schemaVersion: ROLE_CYCLE_DOMAIN_ADJUDICATION_SCHEMA_VERSION,
    summary: accepted
      ? `角色循环入口已转入${label}服务器裁决。`
      : `角色循环入口未通过${label}服务器裁决。`,
    events: eventSummary ? [eventSummary].slice(0, MAX_FEEDBACK_EVENTS) : [],
    attributeChanges: buildAttributeChanges(beforeState, afterState, outcome),
    outcome: publicOutcome
  };
}

function buildReadOnlyNpcEconomyFeedback() {
  return {
    schemaVersion: ROLE_CYCLE_DOMAIN_ADJUDICATION_SCHEMA_VERSION,
    summary: "人物月账入口保持只读；人物经济仍由旬更和月末结算裁决。",
    events: [],
    attributeChanges: [],
    outcome: {
      resolver: "npc_economy",
      intent: "magistrate_npc_economy_review",
      status: "read_only",
      evidenceRefs: [],
      evidenceRefCount: 0,
      publicSummary: "本次只复核 npcEconomyView 的公开摘要，不即时改写资产、关系或交易账本。",
      rejectionReasons: [],
      affectedPaths: []
    }
  };
}

function runRoleCycleDomainAdjudicationStep(worldState = {}, input = "") {
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const intent = classifyRoleCycleDomainIntent(worldState, input, actorProfile);
  if (!intent) return createEmptyFeedback();
  if (intent === "magistrate_npc_economy_review") return buildReadOnlyNpcEconomyFeedback();

  const beforeState = cloneJson(worldState);
  if (intent === "magistrate_market_policy" || intent === "magistrate_grain_price_policy") {
    const evidenceRefs = selectEvidenceRefs(worldState, actorProfile, ["market"], [], 1);
    const policyType = intent === "magistrate_grain_price_policy"
      ? "grain_price_stabilization"
      : "market_regulation";
    const outcome = resolveAndApplyCityPolicy(worldState, {
      proposalId: `role-cycle:${worldState.turnCount || 0}:magistrate:${policyType}:${evidenceRefs[0] || "evidence"}`,
      policyType,
      evidenceRefs,
      jurisdictionRef: actorProfile.jurisdictionRefs?.[0] || "",
      publicSummary: "角色循环市价入口转入普通回合：只凭玩家可见市价和案牍证据请求服务器裁决。",
      intensity: 1,
      expectedBenefits: ["把市价入口转成公开、可复核的财政处置"],
      counterCosts: ["需受府库、粮储、辖区证据和民情风险约束"],
      riskDisclosure: "市价处置只进入城市政策 resolver；钱粮、民心和持久化由服务器裁决。"
    }, {
      actorProfile,
      auditContext: { turn: worldState.turnCount || 0, source: "role_cycle_domain_adjudication" }
    });
    return buildResolverFeedback(beforeState, worldState, outcome, "city_policy");
  }

  if (intent === "general_war_council_scout" || intent === "general_war_council_resupply") {
    const orderKind = intent === "general_war_council_resupply" ? "resupply" : "scout";
    const evidenceRefs = orderKind === "resupply"
      ? selectEvidenceRefs(worldState, actorProfile, ["market", "military"], [], 2)
      : selectEvidenceRefs(worldState, actorProfile, ["military"], ["geography", "intel"], 2);
    const outcome = resolveAndApplyMilitaryDiplomacy(worldState, {
      proposalId: `role-cycle:${worldState.turnCount || 0}:general:${orderKind}:${evidenceRefs[0] || "evidence"}`,
      toolName: "military.propose_order",
      orderKind,
      evidenceRefs,
      institutionalPath: "frontier_command",
      publicSummary: "角色循环舆图军议入口转入普通回合：只凭玩家可见军情、市价或地理证据请求服务器裁决。",
      riskLevel: orderKind === "resupply" ? 2 : 1,
      expectedBenefits: ["把舆图和战事档案入口转成公开、可复核的军务处置"],
      counterCosts: ["需受兵粮、情报可信度和前线权限约束"],
      riskDisclosure: "军议入口只进入军务 resolver；调粮、侦察、战险和持久化由服务器裁决。"
    }, {
      actorProfile,
      auditContext: { turn: worldState.turnCount || 0, source: "role_cycle_domain_adjudication" }
    });
    return buildResolverFeedback(beforeState, worldState, outcome, "military_diplomacy");
  }

  return createEmptyFeedback();
}

module.exports = {
  ROLE_CYCLE_DOMAIN_ADJUDICATION_SCHEMA_VERSION,
  classifyRoleCycleDomainIntent,
  runRoleCycleDomainAdjudicationStep,
  selectEvidenceRefs
};
