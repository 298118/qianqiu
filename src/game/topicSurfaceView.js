const { buildPlayerAiActorProfile } = require("./aiActorProfiles");
const {
  buildResolverInputContext,
  filterResolverInputForActor
} = require("./resolverInputContext");
const { collectDomainConsequenceEchoRefs } = require("./domainConsequenceEchoRefs");
const { RESOLVER_INPUT_DOMAINS } = require("./resolverInputConfig");
const { createScene } = require("./sceneRuntime");

const TOPIC_SURFACE_SCHEMA_VERSION = "s78.topicSurfaceView.v1";
const TOPIC_SURFACE_ITEM_LIMIT = 8;
const TOPIC_SURFACE_EVIDENCE_LIMIT = 12;

const TOPIC_SURFACE_SENSITIVE_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记|军情)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|state|row)|(?:outcome[_ -]?id|state[_ -]?delta|player[_ -]?delta|resource[_ -]?(?:use|cost)|relationship[_ -]?signals?|audit[_ -]?record)|\b(?:cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|provider|prompt|statePatch|worldState|provider\s+payload|provider\s+proposal|rawSql|SQL|sqlite|server\.)\b|完整\s*prompt|完整提示词|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const TOPIC_SURFACE_CONFIG = Object.freeze({
  "memorial-review": Object.freeze({
    surfaceType: "memorial_queue",
    label: "奏折队列",
    title: "待阅奏折队列",
    summary: "汇总公开奏报、月报、案牍和军政近事，供玩家批红、转部、留中或发交廷议。",
    domains: Object.freeze(["events", "economy", "military", "offices", "player", "memory"]),
    sourceViews: Object.freeze([
      "courtConsequenceView",
      "domainConsequenceView",
      "courtResponseView",
      "officialCareerView",
      "npcActiveRequestView",
      "worldEntityView",
      "economyTraceView",
      "eventArchiveView",
      "playerMonthlyBriefingView",
      "localAffairsDocketView",
      "militaryDiplomacyView",
      "officialPostingsView"
    ]),
    filters: Object.freeze([
      { id: "urgent", label: "急件" },
      { id: "finance", label: "钱粮" },
      { id: "justice", label: "刑名" },
      { id: "military", label: "军务" }
    ]),
    draftSlots: Object.freeze([
      { id: "first-month", label: "首月回署", draftKind: "official_first_month_memorial", template: "据首月官署回执拟奏，先列公开进度、上官同僚反馈、考成风险和需部院复核之处。" },
      { id: "vermilion", label: "批红", draftKind: "vermilion_comment", template: "朱批所选奏折，令相关官署据公开材料复奏。" },
      { id: "transfer", label: "转部", draftKind: "ministry_referral", template: "将所选奏折转交部院复核，限期回奏可行章程。" },
      { id: "hold", label: "留中", draftKind: "hold_for_review", template: "暂留所选奏折，待补齐公开证据后再议。" },
      { id: "debate", label: "廷议", draftKind: "court_debate", template: "召集廷议，就所选奏折陈明利害。" }
    ]),
    authorityBoundary: "奏折专题只整理公开材料和玩家草稿；批红是否成事、转部后果、廷议采纳和状态变化仍由普通回合服务器裁决。",
    emptyState: "当前没有可见奏报或公开案牍时，只显示草稿模板，不补造署名、罪名、银数、军情或已生效结果。"
  }),
  "edict-draft": Object.freeze({
    surfaceType: "edict_draft",
    label: "拟圣旨",
    title: "圣旨草拟器",
    summary: "基于公开议题草拟谕旨、札付或敕令文本，但不直接任免、赏罚、处分或改写世界状态。",
    domains: Object.freeze(["offices", "events", "military", "economy", "map", "player"]),
    sourceViews: Object.freeze([
      "courtConsequenceView",
      "domainConsequenceView",
      "courtResponseView",
      "officialCareerView",
      "officialPostingsView",
      "eventArchiveView",
      "worldThreadView",
      "worldEntityView",
      "mapContextView",
      "militaryDiplomacyView",
      "economicFiscalView",
      "economyTraceView"
    ]),
    draftSlots: Object.freeze([
      { id: "relief-edict", label: "赈济谕旨", draftKind: "relief_edict", template: "草拟赈济谕旨，要求先核公开灾情、仓储与地方官责。" },
      { id: "office-edict", label: "整饬官箴", draftKind: "office_discipline_edict", template: "草拟整饬官箴的明发谕旨，只据公开考成与奏报。" },
      { id: "frontier-edict", label: "边务敕令", draftKind: "frontier_edict", template: "草拟边务敕令，先令兵部与粮台复核公开军报。" }
    ]),
    authorityBoundary: "圣旨 surface 只产可提交草稿；诏令生效、任免、赏罚、处分、拨饷和长期事件仍由服务器裁决。",
    emptyState: "没有公开议题时不生成已生效诏令、官缺、赏罚或处分事实。"
  }),
  "court-debate": Object.freeze({
    surfaceType: "court_debate",
    sceneType: "court_debate",
    label: "朝议",
    title: "朝议筹议",
    summary: "组织御前、台谏和部院围绕公开议题形成意见，玩家选择采纳为奏议草稿。",
    domains: Object.freeze(["offices", "events", "economy", "military", "people", "player", "memory"]),
    sourceViews: Object.freeze([
      "courtConsequenceView",
      "domainConsequenceView",
      "courtResponseView",
      "officialCareerView",
      "officialPostingsView",
      "npcActiveRequestView",
      "actorMemoryView",
      "worldEntityView",
      "economyTraceView",
      "aiControlAuditView",
      "eventArchiveView",
      "worldThreadView"
    ]),
    draftSlots: Object.freeze([
      { id: "first-month", label: "首月筹议", draftKind: "official_first_month_debate", template: "围绕首月回署材料筹议后续章程，只列可行、不可行和待查事项。" },
      { id: "balanced", label: "折中议", draftKind: "balanced_debate", template: "召集廷议，令诸臣分别陈明利害，再择稳妥章程。" },
      { id: "censor", label: "台谏复核", draftKind: "censor_review", template: "请台谏先核法度与民生反噬，再候御前裁夺。" },
      { id: "ministry", label: "部议", draftKind: "ministry_debate", template: "交相关部院会商，列出可行、不可行与待查三项。" }
    ]),
    authorityBoundary: "朝议只收集公开意见和草稿；任免、诏令、战和、财政结算、弹劾成案和时间推进仍归服务器。",
    emptyState: "没有安全朝局 projection 时不伪造参议官、派系立场、票拟结论或廷争结果。"
  }),
  trial: Object.freeze({
    surfaceType: "judicial_hearing",
    sceneType: "judicial_hearing",
    label: "堂审",
    title: "堂审问案",
    summary: "围绕公开案牍选择证据、问询方向和审理路径，形成升堂、复核、移交或缓审草稿。",
    domains: Object.freeze(["events", "people", "offices", "geography", "memory"]),
    sourceViews: Object.freeze([
      "localAffairsDocketView",
      "domainConsequenceView",
      "npcActiveRequestView",
      "eventArchiveView",
      "safeWorldSearchView",
      "worldPeopleView"
    ]),
    draftSlots: Object.freeze([
      { id: "investigate", label: "复核证据", draftKind: "investigate_case", template: "升堂复核所选案牍，先问原告、保甲与书吏。" },
      { id: "summon", label: "传唤", draftKind: "summon_witness", template: "传唤相关人等，只据公开证据交叉问明。" },
      { id: "transfer", label: "移交", draftKind: "transfer_case", template: "将疑难案件详报上司或移交有司复审。" }
    ]),
    authorityBoundary: "堂审草稿不能直接定罪、结案、用刑、缉捕、改治安或写入案牍；案件结果由服务器司法边界裁决。",
    emptyState: "没有公开案牍时不补造犯供、证词、判词、刑罚、钱粮数或案件真相。"
  }),
  "war-council": Object.freeze({
    surfaceType: "military_council",
    sceneType: "battle_council",
    label: "军议",
    title: "军帐筹议",
    summary: "围绕公开军报、舆图和粮道风险拟定侦察、防守、转运、请战或议和草稿。",
    domains: Object.freeze(["military", "intel", "economy", "map", "geography", "events", "offices"]),
    sourceViews: Object.freeze([
      "militaryDiplomacyView",
      "domainConsequenceView",
      "economyTraceView",
      "mapContextView",
      "eventArchiveView",
      "officialPostingsView",
      "economicFiscalView"
    ]),
    draftSlots: Object.freeze([
      { id: "scout", label: "遣哨", draftKind: "scout_order", template: "遣哨复查所选边报、粮道与地势，不以低可信情报直接开战。" },
      { id: "defend", label: "固守", draftKind: "defensive_order", template: "先固守要地，查点粮饷甲仗，候朝廷或主帅裁示。" },
      { id: "resupply", label: "转运", draftKind: "resupply_request", template: "请筹粮饷转运，列明公开粮道风险和所需复核事项。" }
    ]),
    authorityBoundary: "军议不直接调兵、开战、议和、拨饷、任免将领或写入战果；服务器继续拥有军务外交裁决权。",
    emptyState: "没有安全军务 projection 时不生成敌情真值、兵力实数、密探线索、战果或外交结论。"
  }),
  "npc-profile": Object.freeze({
    surfaceType: "people_profile",
    label: "人物档案",
    title: "人物公开档案",
    summary: "展示玩家已经可见的人物履历、关系摘要和近期公开记忆，并给出拜访、试探、结交或弹劾草稿。",
    domains: Object.freeze(["people", "memory", "offices", "events", "economy", "player"]),
    sourceViews: Object.freeze([
      "worldPeopleView",
      "actorMemoryView",
      "examNetwork",
      "relationshipView",
      "npcActiveRequestView",
      "worldEntityView",
      "economyTraceView",
      "officialPostingsView"
    ]),
    draftSlots: Object.freeze([
      { id: "visit", label: "拜访", draftKind: "visit_person", template: "择一公开人物拜访，先问近况与可公开的利害。" },
      { id: "sound", label: "试探", draftKind: "sound_position", template: "谨慎试探其对当前议题的公开态度，不逼问未公开私情。" },
      { id: "ally", label: "结交", draftKind: "build_relation", template: "以公事或旧谊结交此人，求稳妥人情进展。" },
      { id: "censure", label: "弹劾", draftKind: "censure_person", template: "若公开材料足以支持，再草拟弹劾或纠核奏稿。" }
    ]),
    authorityBoundary: "人物档案只读公开人物谱牒和可见记忆；关系变化、请托、弹劾成案和私下反噬仍由普通回合服务器裁决。",
    emptyState: "没有公开人物 projection 时不推断未公开关系、未公开任所或重要人物真值。"
  })
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "", maxLength = 180) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || TOPIC_SURFACE_SENSITIVE_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function cleanId(value, fallback = "") {
  const text = cleanText(String(value || ""), fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeSurfaceId(surfaceId) {
  const id = cleanId(surfaceId, "");
  return TOPIC_SURFACE_CONFIG[id] ? id : "";
}

function getTopicSurfaceConfig(surfaceId) {
  const id = normalizeSurfaceId(surfaceId);
  return id ? TOPIC_SURFACE_CONFIG[id] : null;
}

function dedupeEvidenceByCanonicalEcho(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const refs = collectDomainConsequenceEchoRefs(row.canonicalEchoRefs, row.sourceId, row.refId).sort();
    if (!refs.length) return true;
    const key = refs.join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function evidenceAllowedForSurface(item = {}, surfaceId = "") {
  const allowedSurfaceIds = asArray(item.topicSurfaceIds)
    .map((id) => cleanId(id, ""))
    .filter(Boolean);
  if (!allowedSurfaceIds.length) return true;
  return allowedSurfaceIds.includes(surfaceId);
}

function flattenEvidence(context = {}, config = {}, surfaceId = "") {
  const domains = new Set(config.domains || RESOLVER_INPUT_DOMAINS);
  const sourceViews = new Set(config.sourceViews || []);
  const sourceViewPriority = new Map(asArray(config.sourceViews).map((sourceView, index) => [sourceView, index]));
  const rows = [];
  let order = 0;
  for (const domain of RESOLVER_INPUT_DOMAINS) {
    if (!domains.has(domain)) continue;
    for (const item of asArray(context[domain])) {
      if (sourceViews.size && !sourceViews.has(item.sourceView)) continue;
      if (!evidenceAllowedForSurface(item, surfaceId)) continue;
      const canonicalEchoRefs = collectDomainConsequenceEchoRefs(
        item.canonicalEchoRefs,
        item.canonicalEchoRef,
        item.publicEchoRef,
        item.sourceId,
        item.refId
      );
      const row = {
        sourcePriority: sourceViewPriority.has(item.sourceView) ? sourceViewPriority.get(item.sourceView) : 999,
        originalOrder: order,
        refId: cleanId(item.refId, ""),
        sourceView: cleanText(item.sourceView, "", 96),
        sourceId: cleanId(item.sourceId, ""),
        domain: cleanText(item.domain, domain, 48),
        label: cleanText(item.label, "可见材料", 80),
        summary: cleanText(item.summary, "公开摘要待补。", 180),
        visibility: cleanText(item.visibility, "public", 48),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.6)),
        generatedAtTurn: clampNumber(item.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, context.generatedAtTurn || 0),
        freshness: cleanText(item.freshness, "recent", 24),
        scopeRefs: asArray(item.scopeRefs).map((ref) => cleanId(ref, "")).filter(Boolean).slice(0, 6)
      };
      const topicSurfaceIds = asArray(item.topicSurfaceIds)
        .map((id) => cleanId(id, ""))
        .filter(Boolean)
        .slice(0, 8);
      if (topicSurfaceIds.length) row.topicSurfaceIds = topicSurfaceIds;
      if (canonicalEchoRefs.length) row.canonicalEchoRefs = canonicalEchoRefs;
      rows.push(row);
      order += 1;
    }
  }
  const sortedRows = rows
    .filter((row) => row.refId && row.label && row.summary)
    .sort((a, b) => a.sourcePriority - b.sourcePriority || a.originalOrder - b.originalOrder);
  return dedupeEvidenceByCanonicalEcho(sortedRows)
    .slice(0, TOPIC_SURFACE_EVIDENCE_LIMIT)
    .map(({ sourcePriority, originalOrder, ...row }) => row);
}

function itemKindForEvidence(evidence = {}, surfaceId = "") {
  if (surfaceId === "npc-profile") return "person";
  if (surfaceId === "war-council") return evidence.domain === "map" ? "map" : "military";
  if (surfaceId === "trial") return "case";
  if (surfaceId === "edict-draft") return "edict_issue";
  if (surfaceId === "court-debate") return "debate_issue";
  if (evidence.domain === "military") return "military";
  if (evidence.domain === "economy") return "finance";
  if (evidence.domain === "events") return "memorial";
  return "material";
}

function urgencyForEvidence(evidence = {}) {
  const text = `${evidence.label} ${evidence.summary}`;
  if (/急|危|边|盗|灾|案|粮|饷|弹劾|纠/.test(text)) return "urgent";
  if (evidence.freshness === "current") return "current";
  return "routine";
}

function buildItems(surfaceId, evidenceRefs = []) {
  return evidenceRefs.slice(0, TOPIC_SURFACE_ITEM_LIMIT).map((evidence, index) => ({
    id: cleanId(`topic-item:${surfaceId}:${index + 1}`, `topic-item:${index + 1}`),
    kind: itemKindForEvidence(evidence, surfaceId),
    title: evidence.label,
    summary: evidence.summary,
    sourceView: evidence.sourceView,
    statusLabel: urgencyForEvidence(evidence) === "urgent" ? "急需筹议" : evidence.freshness === "current" ? "本旬材料" : "可阅",
    evidenceRefs: [evidence.refId],
    urgency: urgencyForEvidence(evidence)
  }));
}

function buildScenePreview(worldState = {}, config = {}, evidenceRefs = []) {
  if (!config.sceneType) return null;
  const title = evidenceRefs[0]?.label || config.title;
  const scene = createScene(worldState, {
    sceneType: config.sceneType,
    title,
    focusRefs: evidenceRefs.slice(0, 4).map((evidence) => evidence.refId)
  });
  return {
    sceneType: cleanText(scene.sceneType, config.sceneType, 48),
    title: cleanText(scene.title, config.title, 120),
    participantLabels: asArray(scene.participants)
      .map((participant) => cleanText(participant.roleLabel, "", 80))
      .filter(Boolean)
      .slice(0, 6),
    proposalBudget: {
      maxRounds: clampNumber(scene.proposalBudget?.maxRounds, 1, 9, 3),
      maxActors: clampNumber(scene.proposalBudget?.maxActors, 1, 12, 6)
    },
    authorityBoundary: cleanText(scene.authorityBoundary, config.authorityBoundary, 180)
  };
}

function buildSourceViews(context = {}) {
  return asArray(context.sourceViews)
    .map((source) => ({
      sourceView: cleanText(source.sourceView, "", 96),
      domain: cleanText(source.domain, "", 48),
      count: clampNumber(source.count, 0, 999, 0)
    }))
    .filter((source) => source.sourceView && source.domain && source.count > 0)
    .slice(0, 16);
}

function assertTopicSurfaceSafe(value) {
  if (TOPIC_SURFACE_SENSITIVE_PATTERN.test(JSON.stringify(value))) {
    throw new Error("topicSurfaceView contains forbidden source text");
  }
  return true;
}

function buildTopicSurfaceView(worldState = {}, options = {}) {
  const surfaceId = normalizeSurfaceId(options.surfaceId || options.surfaceType || "memorial-review");
  if (!surfaceId) {
    const error = new Error("未知专题 surface。");
    error.statusCode = 400;
    throw error;
  }
  const config = TOPIC_SURFACE_CONFIG[surfaceId];
  const actorProfile = options.actorProfile || buildPlayerAiActorProfile(worldState);
  const resolverInputContext = filterResolverInputForActor(buildResolverInputContext(worldState, {
    actorProfile,
    includeSessionId: false,
    sceneType: "topic_surface",
    intentType: config.surfaceType,
    requestSummary: config.summary,
    domainCaps: {
      geography: 4,
      people: 6,
      offices: 6,
      economy: 5,
      military: 5,
      events: 8,
      intel: 4,
      player: 3,
      map: 4,
      memory: 4
    }
  }), actorProfile);
  const evidenceRefs = flattenEvidence(resolverInputContext, config, surfaceId);
  const items = buildItems(surfaceId, evidenceRefs);
  const view = {
    schemaVersion: TOPIC_SURFACE_SCHEMA_VERSION,
    sessionId: cleanId(worldState.sessionId, ""),
    generatedAtTurn: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    surfaceId,
    surfaceType: config.surfaceType,
    label: config.label,
    title: config.title,
    summary: config.summary,
    sourceViews: buildSourceViews(resolverInputContext),
    filters: asArray(config.filters),
    items,
    evidenceRefs,
    draftSlots: asArray(config.draftSlots),
    scenePreview: buildScenePreview(worldState, config, evidenceRefs),
    lastPublicResults: evidenceRefs
      .filter((evidence) => evidence.sourceView === "eventArchiveView" || evidence.domain === "memory")
      .slice(0, 3)
      .map((evidence) => ({
        id: evidence.refId,
        title: evidence.label,
        summary: evidence.summary
      })),
    authorityBoundary: config.authorityBoundary,
    emptyState: config.emptyState,
    safety: {
      readOnly: true,
      actorVisibleContextOnly: true,
      draftOnly: true,
      noResolverExecution: true,
      noStateWrites: true,
      noGlobalTimeAdvance: true
    }
  };
  assertTopicSurfaceSafe(view);
  return view;
}

function buildTopicSurfaceViewIndex(worldState = {}, options = {}) {
  return Object.keys(TOPIC_SURFACE_CONFIG).map((surfaceId) =>
    buildTopicSurfaceView(worldState, { ...options, surfaceId })
  );
}

module.exports = {
  TOPIC_SURFACE_CONFIG,
  TOPIC_SURFACE_SCHEMA_VERSION,
  assertTopicSurfaceSafe,
  buildTopicSurfaceView,
  buildTopicSurfaceViewIndex,
  getTopicSurfaceConfig,
  normalizeSurfaceId
};
