const {
  ACTOR_TYPE_TEMPLATES,
  AI_ACTOR_PROFILE_SCHEMA_VERSION,
  AUTHORITY_TIERS,
  BUDGET_PRESETS,
  TOOL_GROUPS,
  VISIBILITY_PRESETS,
  getActorTypeTemplate
} = require("./aiActorProfileConfig");
const { buildWorldPeopleView } = require("./worldPeople");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildOfficialCareerView } = require("./officialCareer");
const { getBureau, getOffice, inferOfficeByTitle } = require("./officialCatalog");
const { validateToolDefinition } = require("../ai/toolSchemas");

const MAX_TEXT_LENGTH = 160;
const ROLE_TO_ACTOR_TYPE = Object.freeze({
  scholar: "scholar",
  emperor: "emperor",
  minister: "minister",
  general: "general",
  magistrate: "magistrate"
});

const SENSITIVE_ACTOR_TEXT_PATTERN = /(hiddenNotes|hiddenIntent|raw[_ -]?(?:provider|audit|table|ledger|prompt)|provider proposal|retrievalContext|statePatch|worldState|prompt_retrieval_index|event_archive_index|world_sessions|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:\\[^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || SENSITIVE_ACTOR_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function unique(values, limit = 20) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = cleanText(value, "", 96);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeToolGroups(groups, fallback = []) {
  const normalized = unique(groups, 32)
    .filter((group) => Object.prototype.hasOwnProperty.call(TOOL_GROUPS, group))
    .filter((group, index, source) => source.indexOf(group) === index);
  return normalized.length ? normalized : unique(fallback, 32);
}

function tierDefaults(authorityTier) {
  return AUTHORITY_TIERS[authorityTier] || AUTHORITY_TIERS.T1;
}

function mergeToolGroups(template, tier) {
  const tierAllowed = tierDefaults(tier).defaultToolGroups || [];
  const templateAllowed = Array.isArray(template.allowedToolGroups) ? template.allowedToolGroups : [];
  const tierForbidden = new Set(tierDefaults(tier).forbiddenToolGroups || []);
  const templateForbidden = new Set(template.forbiddenToolGroups || []);
  const source = templateAllowed.length ? templateAllowed : tierAllowed;
  return normalizeToolGroups(source).filter((group) => !tierForbidden.has(group) && !templateForbidden.has(group));
}

function budgetForTier(authorityTier) {
  const presetKey = tierDefaults(authorityTier).budgetPreset || "low";
  return {
    preset: presetKey,
    ...cloneJson(BUDGET_PRESETS[presetKey] || BUDGET_PRESETS.low)
  };
}

function visibilityForTier(authorityTier) {
  const presetKey = tierDefaults(authorityTier).visibilityPreset || "relationship_local";
  return {
    preset: presetKey,
    ...cloneJson(VISIBILITY_PRESETS[presetKey] || VISIBILITY_PRESETS.relationship_local)
  };
}

function inferActorTypeForPlayer(worldState = {}) {
  const player = worldState.player || {};
  if (player.role && player.role !== "official") {
    return ROLE_TO_ACTOR_TYPE[player.role] || "scholar";
  }

  const officeTitle = cleanText(player.officeTitle || player.position || worldState.officialCareer?.currentPosting, "");
  const office = officeTitle ? inferOfficeByTitle(officeTitle) : null;
  if (office?.bureauId === "prefecture_county" || office?.track === "local") return "magistrate";
  if (office?.bureauId === "ministry_war" || /将|总兵|提督|巡检/.test(officeTitle)) return "general";
  if (office?.bureauId === "censorate" || /御史|给事|谏/.test(officeTitle)) return "censor";
  return "minister";
}

function inferNpcActorType(npc = {}) {
  const text = [
    cleanText(npc.rankLabel, ""),
    cleanText(npc.publicSummary, ""),
    cleanText(npc.currentGoal, "")
  ].join(" ");
  if (/塾师|山长|先生|老师|师/.test(text)) return "teacher";
  if (/考官|房官|同考官|主考|读卷/.test(text)) return "examiner";
  if (/县丞|书办|胥吏|吏/.test(text)) return "clerk";
  if (/知县|知府|地方官|巡检/.test(text)) return "magistrate";
  if (/将|参将|总兵|军/.test(text)) return "general";
  if (/御史|给事|谏/.test(text)) return "censor";
  if (/尚书|侍郎|部院|堂官|阁/.test(text)) return "minister";
  return "gentry";
}

function inferOfficeActorType(row = {}) {
  const bureauId = cleanId(row.bureauId, "");
  const officeTitle = cleanText(row.officeTitle || row.title || row.name, "");
  if (bureauId === "prefecture_county" || /知县|知府|地方/.test(officeTitle)) return "magistrate";
  if (bureauId === "ministry_war" || /将|军|兵部|总兵/.test(officeTitle)) return "general";
  if (bureauId === "censorate" || /御史|给事|谏/.test(officeTitle)) return "censor";
  if (/皇帝|御前|内廷|摄政/.test(officeTitle)) return "emperor";
  return "minister";
}

function buildBaseProfile(actorType, source = {}) {
  const template = getActorTypeTemplate(actorType);
  const authorityTier = cleanText(source.authorityTier, template.authorityTier || "T1", 4);
  const allowedToolGroups = normalizeToolGroups(source.allowedToolGroups, mergeToolGroups(template, authorityTier));
  const forbiddenToolGroups = normalizeToolGroups([
    ...(tierDefaults(authorityTier).forbiddenToolGroups || []),
    ...(template.forbiddenToolGroups || []),
    ...(source.forbiddenToolGroups || [])
  ], []);

  return {
    schemaVersion: AI_ACTOR_PROFILE_SCHEMA_VERSION,
    actorId: cleanId(source.actorId, `${actorType}:unknown`),
    actorType,
    label: cleanText(source.label, template.label || actorType, 80),
    displayName: cleanText(source.displayName, source.label || template.label || actorType, 80),
    authorityTier,
    authorityLabel: tierDefaults(authorityTier).label,
    role: cleanText(source.role, "", 80),
    officeId: cleanId(source.officeId, ""),
    bureauId: cleanId(source.bureauId, ""),
    jurisdictionRefs: unique(source.jurisdictionRefs, 12),
    allowedToolGroups,
    forbiddenToolGroups,
    visibilityProfile: visibilityForTier(authorityTier),
    budgetPolicy: budgetForTier(authorityTier),
    modelPolicy: cleanText(source.modelPolicy, template.modelPolicy || "mock", 64),
    ideologyTags: unique(source.ideologyTags || [], 8),
    publicMemoryRefs: unique(source.publicMemoryRefs || [], 8),
    knownRefs: unique(source.knownRefs || [], 14),
    currentGoals: unique(source.currentGoals || template.defaultGoals || [], 8),
    boundaryStatement: cleanText(
      source.boundaryStatement,
      `${template.label || actorType}只能请求身份可见工具；服务器负责裁决和落库。`,
      180
    )
  };
}

function playerPostingContext(worldState = {}) {
  const view = buildOfficialPostingsView(worldState);
  const posting = (view.postings || []).find((row) => row.id === "posting-player-current" || row.holderType === "player");
  const office = posting?.officeId ? getOffice(posting.officeId) : inferOfficeByTitle(worldState.player?.officeTitle || worldState.player?.position || "");
  const bureau = (posting?.bureauId || office?.bureauId) ? getBureau(posting?.bureauId || office?.bureauId) : null;
  return {
    view,
    posting,
    office,
    bureau,
    jurisdictionRefs: unique([
      posting?.jurisdictionId,
      posting?.cityId,
      posting?.regionId,
      posting?.countryId,
      worldState.player?.countyName ? `county:${worldState.player.countyName}` : ""
    ], 8)
  };
}

function buildPlayerAiActorProfile(worldState = {}) {
  const player = worldState.player || {};
  const actorType = inferActorTypeForPlayer(worldState);
  const template = getActorTypeTemplate(actorType);
  const postingContext = playerPostingContext(worldState);
  const career = buildOfficialCareerView(worldState);
  const nativePlace = cleanText(player.nativePlace || worldState.setup?.nativePlace, "", 80);
  const officeTitle = cleanText(player.officeTitle || player.position || career.currentPosting, "", 80);

  return buildBaseProfile(actorType, {
    actorId: `player:${cleanId(player.id, "P1")}`,
    label: template.label,
    displayName: cleanText(player.name, "玩家", 80),
    role: cleanText(player.roleLabel || player.role, "", 80),
    officeId: postingContext.posting?.officeId || postingContext.office?.id || "",
    bureauId: postingContext.posting?.bureauId || postingContext.bureau?.id || "",
    jurisdictionRefs: postingContext.jurisdictionRefs,
    currentGoals: [
      ...(template.defaultGoals || []),
      officeTitle ? `当前名位：${officeTitle}` : "",
      nativePlace ? `公开籍贯：${nativePlace}` : ""
    ],
    publicMemoryRefs: unique([
      player.examRank ? `examRank:${player.examRank}` : "",
      player.palaceRank ? `palaceRank:${player.palaceRank}` : "",
      officeTitle ? `office:${officeTitle}` : "",
      nativePlace ? `nativePlace:${nativePlace}` : ""
    ], 8),
    knownRefs: unique([
      postingContext.posting?.id ? `officialPostingsView:${postingContext.posting.id}` : "",
      postingContext.bureau?.id ? `officialCatalog.bureau:${postingContext.bureau.id}` : "",
      postingContext.office?.id ? `officialCatalog.office:${postingContext.office.id}` : ""
    ], 8),
    boundaryStatement: "玩家 actor 只能按当前身份请求可见工具；考试晋级、官职任免、数据库写入和隐藏事实仍由服务器裁决。"
  });
}

function findNpcRow(worldState = {}, npcRef = {}) {
  const view = buildWorldPeopleView(worldState);
  const refId = cleanId(typeof npcRef === "string" ? npcRef : npcRef.id || npcRef.npcId || npcRef.targetId, "");
  const refName = cleanText(typeof npcRef === "object" ? npcRef.name : "", "", 80);
  return (view.npcs || []).find((npc) => (
    (refId && npc.id === refId) ||
    (refName && npc.name === refName)
  )) || null;
}

function buildNpcAiActorProfile(worldState = {}, npcRef = {}, options = {}) {
  const npc = findNpcRow(worldState, npcRef);
  if (!npc && options.allowUnknown !== true) return null;
  const actorType = cleanText(options.actorType, npc ? inferNpcActorType(npc) : "gentry", 40);
  const template = getActorTypeTemplate(actorType);
  const npcId = cleanId(npc?.id || (typeof npcRef === "string" ? npcRef : npcRef.id), "unknown-npc");

  return buildBaseProfile(actorType, {
    actorId: `npc:${npcId}`,
    label: template.label,
    displayName: cleanText(npc?.name, "可见人物", 80),
    role: cleanText(npc?.rankLabel, template.label, 80),
    jurisdictionRefs: unique([npc?.cityId, npc?.regionId, npc?.countryId], 8),
    ideologyTags: unique([npc?.temperament?.ambition >= 70 ? "进取" : "", npc?.temperament?.caution >= 70 ? "谨慎" : ""], 4),
    publicMemoryRefs: unique([npc?.currentGoal ? `goal:${npc.currentGoal}` : ""], 4),
    knownRefs: unique([npc ? `worldPeopleView.npc:${npc.id}` : ""], 6),
    currentGoals: unique([npc?.currentGoal, ...(template.defaultGoals || [])], 8),
    boundaryStatement: "NPC actor 只能依据可见人物 projection 行动；不可见私档、未公开关系和原始审计不进入模型上下文。"
  });
}

function findOfficeRow(worldState = {}, officeRef = {}) {
  const view = buildOfficialPostingsView(worldState);
  const refId = cleanId(typeof officeRef === "string" ? officeRef : officeRef.id || officeRef.officeId || officeRef.postingId || officeRef.bureauId, "");
  const refTitle = cleanText(typeof officeRef === "object" ? officeRef.title || officeRef.officeTitle || officeRef.name : "", "", 80);
  const posting = (view.postings || []).find((row) => (
    (refId && [row.id, row.officeId, row.bureauId].includes(refId)) ||
    (refTitle && row.officeTitle === refTitle)
  ));
  if (posting) return { row: posting, kind: "posting", view };
  const office = refId ? getOffice(refId) : inferOfficeByTitle(refTitle);
  if (office) return { row: office, kind: "office", view };
  const bureau = refId ? getBureau(refId) : null;
  if (bureau) return { row: bureau, kind: "bureau", view };
  return { row: null, kind: "", view };
}

function buildOfficeAiActorProfile(worldState = {}, officeRef = {}, options = {}) {
  const { row, kind } = findOfficeRow(worldState, officeRef);
  if (!row && options.allowUnknown !== true) return null;
  const actorType = cleanText(options.actorType, row ? inferOfficeActorType(row) : "minister", 40);
  const template = getActorTypeTemplate(actorType);
  const officeId = cleanId(row?.officeId || row?.id, cleanId(typeof officeRef === "string" ? officeRef : officeRef.officeId, "unknown-office"));
  const bureauId = cleanId(row?.bureauId || row?.id, "");

  return buildBaseProfile(actorType, {
    actorId: `${kind || "office"}:${officeId}`,
    label: template.label,
    displayName: cleanText(row?.officeTitle || row?.title || row?.name, template.label, 80),
    role: cleanText(row?.officeTitle || row?.title || row?.name, template.label, 80),
    officeId,
    bureauId,
    jurisdictionRefs: unique([
      row?.jurisdictionId,
      row?.cityId,
      row?.regionId,
      row?.countryId
    ], 8),
    knownRefs: unique([
      kind === "posting" ? `officialPostingsView.posting:${row.id}` : "",
      kind === "office" ? `officialCatalog.office:${row.id}` : "",
      kind === "bureau" ? `officialCatalog.bureau:${row.id}` : ""
    ], 8),
    currentGoals: template.defaultGoals,
    boundaryStatement: "官署 actor 只能提出制度路径内的 proposal；任免、刑赏、战和和落库仍由服务器 resolver 裁决。"
  });
}

function buildSystemEngineActorProfile(worldState = {}, engineType = "world_tick") {
  const type = cleanId(engineType, "world_tick");
  return buildBaseProfile("system_engine", {
    actorId: `system:${type}`,
    displayName: "系统世界引擎",
    role: "服务器调度",
    jurisdictionRefs: unique([`dynasty:${cleanText(worldState.dynasty, "unknown", 40)}`], 4),
    knownRefs: unique([`turn:${worldState.turnCount || 0}`], 4),
    currentGoals: ["压力传播", "长期因果", "安全事件候选"],
    boundaryStatement: "系统引擎不代表角色，不能伪装玩家可见事实；只由服务器 tick 或 resolver 调度。"
  });
}

function toolListFromRegistry(toolRegistry) {
  if (Array.isArray(toolRegistry)) return toolRegistry;
  if (toolRegistry && typeof toolRegistry.listAllTools === "function") return toolRegistry.listAllTools();
  if (toolRegistry && typeof toolRegistry.listTools === "function") return toolRegistry.listTools();
  if (isPlainObject(toolRegistry)) return Object.values(toolRegistry);
  return [];
}

function hasToolGroupIntersection(actorGroups, toolGroups) {
  if (!Array.isArray(toolGroups) || toolGroups.length === 0) return true;
  return toolGroups.some((group) => actorGroups.includes(group));
}

function isToolAllowedForActor(actorProfile, toolDefinition, options = {}) {
  if (!actorProfile || !toolDefinition || typeof toolDefinition.name !== "string") return false;
  if (toolDefinition.name.startsWith("server.")) return false;
  validateToolDefinition(toolDefinition);

  const permission = toolDefinition.permission || {};
  const actorGroups = Array.isArray(actorProfile.allowedToolGroups) ? actorProfile.allowedToolGroups : [];
  const forbiddenGroups = new Set(actorProfile.forbiddenToolGroups || []);
  const toolGroups = Array.isArray(permission.toolGroups) ? permission.toolGroups : [];
  if (!hasToolGroupIntersection(actorGroups, toolGroups)) return false;
  if (toolGroups.some((group) => forbiddenGroups.has(group))) return false;

  const actorTypes = Array.isArray(permission.actorTypes) ? permission.actorTypes : [];
  if (actorTypes.length && !actorTypes.includes(actorProfile.actorType)) return false;

  const authorityTiers = Array.isArray(permission.authorityTiers) ? permission.authorityTiers : [];
  if (authorityTiers.length && !authorityTiers.includes(actorProfile.authorityTier)) return false;

  if (permission.requiresJurisdiction) {
    const refs = Array.isArray(actorProfile.jurisdictionRefs) ? actorProfile.jurisdictionRefs : [];
    const requestedRef = cleanText(options.jurisdictionRef, "", 96);
    if (!refs.length) return false;
    if (requestedRef && !refs.includes(requestedRef)) return false;
  }

  return true;
}

function filterActorTools(actorProfile, toolRegistry, options = {}) {
  return toolListFromRegistry(toolRegistry).filter((toolDefinition) => {
    try {
      return isToolAllowedForActor(actorProfile, toolDefinition, options);
    } catch (_error) {
      return false;
    }
  });
}

function buildAiActorProfileView(profile = {}) {
  if (!profile || typeof profile !== "object") return null;
  return {
    schemaVersion: profile.schemaVersion || AI_ACTOR_PROFILE_SCHEMA_VERSION,
    actorId: cleanId(profile.actorId, ""),
    actorType: cleanText(profile.actorType, "", 40),
    label: cleanText(profile.label, "", 80),
    displayName: cleanText(profile.displayName, "", 80),
    authorityTier: cleanText(profile.authorityTier, "", 4),
    authorityLabel: cleanText(profile.authorityLabel, "", 40),
    role: cleanText(profile.role, "", 80),
    officeId: cleanId(profile.officeId, ""),
    bureauId: cleanId(profile.bureauId, ""),
    jurisdictionRefs: unique(profile.jurisdictionRefs, 12),
    allowedToolGroups: normalizeToolGroups(profile.allowedToolGroups, []),
    visibilityPreset: cleanText(profile.visibilityProfile?.preset, "", 40),
    visibilityDomains: unique(profile.visibilityProfile?.readDomains, 12),
    visibilityBudget: {
      maxRows: profile.visibilityProfile?.maxRows || 0,
      maxChars: profile.visibilityProfile?.maxChars || 0
    },
    budgetPreset: cleanText(profile.budgetPolicy?.preset, "", 40),
    budgetPolicy: {
      maxCallsPerTenDay: profile.budgetPolicy?.maxCallsPerTenDay || 0,
      maxToolCallsPerScene: profile.budgetPolicy?.maxToolCallsPerScene || 0,
      allowStreaming: profile.budgetPolicy?.allowStreaming === true,
      fallbackMode: cleanText(profile.budgetPolicy?.fallbackMode, "", 40)
    },
    modelPolicy: cleanText(profile.modelPolicy, "", 64),
    currentGoals: unique(profile.currentGoals, 8),
    knownRefs: unique(profile.knownRefs, 14),
    boundaryStatement: cleanText(profile.boundaryStatement, "", 180)
  };
}

function summarizeAiActorProfileForPrompt(profile = {}) {
  const view = buildAiActorProfileView(profile);
  if (!view) return null;
  return {
    actorId: view.actorId,
    actorType: view.actorType,
    authorityTier: view.authorityTier,
    role: view.role,
    allowedToolGroups: view.allowedToolGroups,
    visibilityDomains: view.visibilityDomains,
    currentGoals: view.currentGoals.slice(0, 5),
    boundaryStatement: view.boundaryStatement
  };
}

module.exports = {
  buildAiActorProfileView,
  buildNpcAiActorProfile,
  buildOfficeAiActorProfile,
  buildPlayerAiActorProfile,
  buildSystemEngineActorProfile,
  filterActorTools,
  isToolAllowedForActor,
  summarizeAiActorProfileForPrompt
};
