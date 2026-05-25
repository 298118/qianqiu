import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import type { AssetRegistry, RuntimePortraitAsset } from "../assets/assetRegistry";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import type { DelegatedTaskRecordView, NpcActiveRequestFollowUpTaskView, NpcActiveRequestItemView, NpcActiveRequestResponseOptionView, NpcDetailView, NpcRosterItem, PlayerSummary, TradeRecordView, WorldPeopleNpc, WorldPeopleRelationship } from "../api";
import { EconomyTraceSection } from "../components/EconomyTraceSection";
import { NpcFollowUpEvidenceSection } from "../components/NpcFollowUpEvidenceSection";
import { Portrait } from "../components/Portrait";
import { markOverlayTrigger } from "../components/overlayFocus";
import { isRouteLocalSessionId, isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore, type PortraitViewerProfile } from "../state/uiState";
import { rewritePlayerFacingWorldText } from "../text/worldText";

const portraitPageSize = 8;
const maxPeopleRows = 80;
const fallbackPortraitRef = "portrait-public-fallback-s76-10";
const safePortraitRefPattern = /^portrait-[a-z0-9][a-z0-9_-]{0,140}$/i;
const unsafePeopleTextFragments = [
  "/api/game/" + "state",
  "/api/dev/" + "session-diagnostics",
  "data" + "/" + "sessions",
  "data" + "\\" + "sessions",
  "file" + "://",
  "raw",
  "prov" + "ider",
  "pro" + "mpt",
  "hid" + "den",
  "key",
  "path",
  "hidden" + "Notes",
  "OPENAI" + "_API" + "_KEY",
  "DEEPSEEK" + "_API" + "_KEY",
  "MIMO" + "_API" + "_KEY",
  "ANTHROPIC" + "_API" + "_KEY",
  "完整" + "提示词",
  "提示" + "词",
  "本地" + "路径",
  "密" + "钥",
  "隐" + "藏",
  "私" + "档",
  "模型" + "原始"
] as const;
const unsafePortraitRefTokenPattern = /(?:^|[-_])(raw|provider|prompt|hidden|private|key|path|secret|token|api|file|data|http)(?:$|[-_])/i;

const roleLabels: Record<string, string> = {
  scholar: "书生",
  official: "入仕官员",
  emperor: "皇帝",
  minister: "大臣",
  general: "将领",
  magistrate: "县令"
};

const playerPortraitRoleByGameRole: Record<string, string> = {
  scholar: "scholar",
  official: "junior-official",
  magistrate: "local-official",
  minister: "grand-minister",
  general: "general",
  emperor: "emperor-regent"
};

const npcWorkbenchTabs = [
  { id: "profile", label: "档案" },
  { id: "dialogue", label: "对话" },
  { id: "trade", label: "交易" },
  { id: "command", label: "委派" },
  { id: "social", label: "礼法" },
  { id: "records", label: "记录" }
] as const;

type NpcWorkbenchTab = typeof npcWorkbenchTabs[number]["id"];

const peopleEconomyTraceTypes = [
  "trade_negotiation",
  "trade_expiry",
  "trade_blocked",
  "delegated_task_result",
  "delegated_task_budget",
  "human_debt_monthly",
  "market_price_signal",
  "npc_relationship_monthly",
  "monthly_economy_event"
] as const;

type PersonRow = {
  readonly id: string;
  readonly kind: "player" | "npc";
  readonly name: string;
  readonly identity: string;
  readonly summary: string;
  readonly current: string;
  readonly portraitRef: string;
  readonly meta: readonly string[];
  readonly relationshipNote?: string;
  readonly remastered: boolean;
};

type WorkbenchNpc = {
  readonly npcId: string;
  readonly displayName: string;
  readonly title: string;
  readonly summary: string;
  readonly roleTags: readonly string[];
  readonly stageTags: readonly string[];
  readonly portraitRef: string;
  readonly tier: string;
  readonly availableInteractions: readonly string[];
  readonly relationshipLabels: readonly string[];
};

type RelationshipEntitySignal = {
  readonly id: string;
  readonly name: string;
  readonly categoryLabel: string;
  readonly statusLabel: string;
  readonly riskLabel: string;
  readonly publicSummary: string;
  readonly recentImpactSummary: string;
  readonly recentImpactMeta: string;
  readonly impactCount: number;
};

type RelationshipImpactRow = {
  readonly entityId: string;
  readonly title: string;
  readonly publicSummary: string;
  readonly sourceLabel: string;
  readonly affectedMetricLabels: readonly string[];
  readonly generatedAtTurn: number;
};

type RelationshipAgendaThread = {
  readonly id: string;
  readonly title: string;
  readonly sourceLabel: string;
  readonly statusLabel: string;
  readonly riskLabel: string;
  readonly summary: string;
  readonly goal: string;
  readonly followUpHint: string;
  readonly interventionHints: readonly string[];
  readonly relatedLabels: readonly string[];
};

const localPeoplePathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|Users|private|mnt|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;

function peopleTextLooksUnsafe(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  const text = value.trim();
  const normalized = text.toLowerCase();
  return localPeoplePathPattern.test(text) ||
    /(?:sk|tp)-[a-z0-9_-]{6,}/i.test(text) ||
    unsafePeopleTextFragments.some((fragment) => normalized.includes(fragment.toLowerCase()));
}

function safePeopleText(value: unknown, fallback: string, maxLength = 120) {
  const text = typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : fallback;
  if (peopleTextLooksUnsafe(text)) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}...` : rewritten;
}

function safePortraitRef(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || !safePortraitRefPattern.test(text)) return "";
  return unsafePortraitRefTokenPattern.test(text) ? "" : text;
}

function stableIndex(seed: string, length: number) {
  if (length <= 1) return 0;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % length;
}

function pickPortrait(candidates: readonly RuntimePortraitAsset[], seed: string, preferRemasteredFeminine = false) {
  if (!candidates.length) return "";
  const preferred = preferRemasteredFeminine
    ? candidates.filter((portrait) => portrait.genderPresentation === "feminine" && portrait.hasHighResOverride)
    : [];
  const pool = preferred.length ? preferred : candidates;
  return pool[stableIndex(seed, pool.length)]?.portraitRef ?? "";
}

function getExistingPortraitRef(registry: AssetRegistry | null, portraitRef: unknown) {
  const cleanRef = safePortraitRef(portraitRef);
  return cleanRef && registry?.getPortrait(cleanRef) ? cleanRef : "";
}

function getPlayerIdentity(player: PlayerSummary | undefined | null) {
  if (!player) return "身份未题";
  return safePeopleText(
    player.officeTitle || player.examRank || (player.role ? roleLabels[player.role] || player.role : ""),
    "身份未题",
    40
  );
}

function getPlayerPortraitRole(player: PlayerSummary | undefined | null) {
  const role = typeof player?.role === "string" ? player.role : "";
  if (role && role !== "scholar") return playerPortraitRoleByGameRole[role] || "scholar";

  const rankText = safePeopleText(player?.examRank, "", 40);
  if (/进士|状元|榜眼|探花|殿试/.test(rankText)) return "jinshi";
  if (/贡士|会元|会试/.test(rankText)) return "gongshi";
  if (/举人|解元|乡试/.test(rankText)) return "juren";
  if (/秀才|生员|院试/.test(rankText)) return "xiucai";
  if (/童生|童试|县试|府试/.test(rankText)) return "child-exam-candidate";
  return "scholar";
}

function buildPortraitProfile(options: {
  readonly name: string;
  readonly identity: string;
  readonly summary?: string;
  readonly current?: string;
  readonly tags?: readonly string[];
}): PortraitViewerProfile {
  return {
    name: safePeopleText(options.name, "未题人物", 40),
    identity: safePeopleText(options.identity, "公开人物", 56),
    summary: safePeopleText(options.summary, "公开传略未详，案卷只载其姓名与身份。", 180),
    current: safePeopleText(options.current, "当前情况案卷未载，候复核。", 160),
    tags: (options.tags ?? []).map((tag) => safePeopleText(tag, "", 28)).filter(Boolean).slice(0, 8)
  };
}

function buildPlayerPortraitSummary(player: PlayerSummary | undefined | null, identity: string) {
  const roleLabel = roleLabels[player?.role ?? ""] || identity || "本局人物";
  return `案主本局画像据已审阅画卷与公开身份整理：以${roleLabel}入卷，读书、应考、入仕或任事经历随主卷回批逐步成篇。`;
}

function buildNpcPortraitCurrent(npcName: string, npcIdentity: string, currentGoal: unknown, relationshipNote: string) {
  const publicGoal = safePeopleText(currentGoal, "", 112);
  if (publicGoal) return `${npcName}眼下以${npcIdentity}见于人物谱牒；近事为“${publicGoal}”。其余行止仍候公开案卷回音。`;
  if (relationshipNote) return `${relationshipNote}；${npcName}其余近况候公开案卷回音。`;
  return `${npcName}当前以${npcIdentity}列于人物谱牒；公开近况未详，候回音。`;
}

function resolvePlayerPortraitRef(registry: AssetRegistry | null, player: PlayerSummary | undefined | null, sessionId: string) {
  const explicitRef = getExistingPortraitRef(registry, player?.portraitRef);
  if (explicitRef) return explicitRef;
  if (!registry) return "";

  const portraitRole = getPlayerPortraitRole(player);
  const candidates = registry.getPortraits({
    usage: "people_page",
    lazyLoadGroup: "portrait_pool_player_s73_10",
    role: portraitRole,
    identityTags: ["player"],
    preferHighResOverridesForFeminine: true
  });
  return pickPortrait(candidates, `${sessionId}:${player?.name ?? "player"}:${portraitRole}`);
}

function inferNpcGenderPresentation(npc: WorldPeopleNpc) {
  const text = `${npc.genderLabel ?? ""} ${npc.rankLabel ?? ""} ${npc.publicSummary ?? ""} ${npc.name ?? ""}`;
  if (/女|妇|娘|姬|妃|后|太后|夫人|孺人|宫女|才女|女官|宫眷|媛/.test(text)) return "feminine";
  if (/男|郎|生|师|官|吏|臣|将|公|侯|县丞|知事|参将/.test(text)) return "masculine";
  return "";
}

function inferNpcPortraitRole(npc: WorldPeopleNpc) {
  const text = `${npc.rankLabel ?? ""} ${npc.publicSummary ?? ""} ${npc.name ?? ""}`;
  if (/塾师|先生|师/.test(text)) return "teacher";
  if (/同年|士子|举子|贡士|考生/.test(text)) return "exam-peer";
  if (/主考|总裁|考官/.test(text)) return "chief-examiner";
  if (/房官|阅卷/.test(text)) return "room-examiner";
  if (/知县|县令/.test(text)) return "magistrate";
  if (/县丞|知事/.test(text)) return "county-deputy";
  if (/典吏|书吏|吏/.test(text)) return "clerk";
  if (/捕|差役|皂隶/.test(text)) return "constable";
  if (/御史|给事|言官|监察/.test(text)) return "censor";
  if (/参将|将军|总兵|武臣|边镇/.test(text)) return "border-commander";
  if (/商|东家|掌柜/.test(text)) return "merchant";
  if (/医|郎中/.test(text)) return "physician";
  if (/女官/.test(text)) return "female-official";
  if (/宫女|宫眷|太后|皇后|嫔妃/.test(text)) return "palace-lady";
  if (/僧|道|道人/.test(text)) return "monk-daoist";
  if (/士绅|乡绅|耆老/.test(text)) return "gentry";
  return "commoner";
}

function queryNpcPortraits(
  registry: AssetRegistry,
  npc: WorldPeopleNpc,
  query: { readonly role?: string; readonly genderPresentation?: string }
) {
  return registry.getPortraits({
    usage: "people_page",
    subcategory: "generic_npc_pool",
    lazyLoadGroup: "portrait_pool_generic_npc_s73_10",
    preferHighResOverridesForFeminine: true,
    ...query
  });
}

function resolveNpcPortraitRef(registry: AssetRegistry | null, npc: WorldPeopleNpc) {
  const explicitRef = getExistingPortraitRef(registry, npc.portraitRef);
  if (explicitRef) return explicitRef;
  if (!registry) return "";

  const genderPresentation = inferNpcGenderPresentation(npc);
  const role = inferNpcPortraitRole(npc);
  const seed = `${npc.id}:${npc.name ?? ""}:${role}`;
  const preferRemasteredFeminine = genderPresentation === "feminine";
  const roleGenderCandidates = queryNpcPortraits(registry, npc, {
    role,
    ...(genderPresentation ? { genderPresentation } : {})
  });
  if (roleGenderCandidates.length) return pickPortrait(roleGenderCandidates, seed, preferRemasteredFeminine);

  const roleCandidates = queryNpcPortraits(registry, npc, { role });
  if (roleCandidates.length) return pickPortrait(roleCandidates, seed, preferRemasteredFeminine);

  const genderCandidates = genderPresentation ? queryNpcPortraits(registry, npc, { genderPresentation }) : [];
  if (genderCandidates.length) return pickPortrait(genderCandidates, seed, preferRemasteredFeminine);

  return pickPortrait(queryNpcPortraits(registry, npc, { role: "commoner" }), seed, false);
}

function relationForNpc(relationships: readonly WorldPeopleRelationship[], npcId: string) {
  return relationships.find((relationship) => (
    (relationship.targetType === "npc" && relationship.targetId === npcId) ||
    (relationship.sourceType === "npc" && relationship.sourceId === npcId)
  ));
}

function relationshipTone(relationship: WorldPeopleRelationship | undefined) {
  if (!relationship) return "";
  const publicSummary = safePeopleText(relationship.publicSummary, "", 96);
  if (publicSummary) return publicSummary;
  const stance = safePeopleText(relationship.stance, "", 64);
  const intent = safePeopleText(relationship.recentIntent, "", 64);
  if (stance || intent) return [stance, intent].filter(Boolean).join("；");
  if (typeof relationship.relationship === "number") return `情分 ${relationship.relationship}`;
  return "";
}

function isNpcPublicForLedger(npc: WorldPeopleNpc) {
  if (!npc?.id || !npc.name) return false;
  if (npc.visibility === "hidden") return false;
  if ((npc.visibility === "relationship_visible" || npc.visibility === "role_visible") && npc.knownToPlayer === false) return false;
  return true;
}

function getRosterPortraitRef(registry: AssetRegistry | null, npc: NpcRosterItem) {
  const explicitRef = getExistingPortraitRef(registry, npc.portraitRef);
  return explicitRef || fallbackPortraitRef;
}

function toWorkbenchNpc(registry: AssetRegistry | null, npc: NpcRosterItem): WorkbenchNpc {
  return {
    npcId: npc.npcId,
    displayName: safePeopleText(npc.displayName, "无名人物", 40),
    title: safePeopleText(npc.publicProfile?.title || npc.publicProfile?.posting, "可见人物", 48),
    summary: safePeopleText(npc.publicProfile?.summary, "暂无公开小传。", 140),
    roleTags: (npc.roleTags ?? []).map((tag) => safePeopleText(tag, "", 32)).filter(Boolean),
    stageTags: (npc.stageTags ?? []).map((tag) => safePeopleText(tag, "", 32)).filter(Boolean),
    portraitRef: getRosterPortraitRef(registry, npc),
    tier: safePeopleText(npc.tier, "ambient", 24),
    availableInteractions: (npc.availableInteractions ?? []).map((item) => safePeopleText(item, "", 32)).filter(Boolean),
    relationshipLabels: (npc.relationshipSummary?.labels ?? []).map((item) => safePeopleText(item, "", 32)).filter(Boolean)
  };
}

function groupNpcLabel(npc: WorkbenchNpc) {
  const tags = [...npc.stageTags, ...npc.roleTags].join(" ");
  if (/family|家族|亲族/.test(tags)) return "家族";
  if (/academy|study|书院|师友/.test(tags)) return "书院";
  if (/exam|科场|同年/.test(tags)) return "科场";
  if (/yamen|office|官署|属员/.test(tags)) return "官署";
  if (/military|army|军|边/.test(tags)) return "军营";
  if (/court|朝|宫/.test(tags)) return "朝堂";
  if (/market|merchant|市|商/.test(tags)) return "市井";
  return "身边人";
}

function groupNpcs(npcs: readonly WorkbenchNpc[]) {
  const groups = new Map<string, WorkbenchNpc[]>();
  for (const npc of npcs) {
    const label = groupNpcLabel(npc);
    groups.set(label, [...(groups.get(label) ?? []), npc]);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function rowsFromViewKeys(source: unknown, keys: readonly string[]) {
  if (!source || typeof source !== "object") return [] as Record<string, unknown>[];
  const record = source as Record<string, unknown>;
  return keys.flatMap((key) => {
    const value = record[key];
    return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry))) : [];
  });
}

function entityLooksRelationshipRelevant(entity: Record<string, unknown>) {
  const text = [
    entity.id,
    entity.category,
    entity.categoryLabel,
    entity.kind,
    entity.kindLabel,
    entity.name,
    entity.publicSummary,
    entity.riskLabel
  ].map((value) => String(value ?? "")).join(" ");
  return /(academy|local|censorate|military-wall|士林|书院|同年|地方|乡绅|人情|风宪|都察|台谏|武备|堡寨|关系|交游|来函|议婚|切磋|论道)/.test(text);
}

function isRelationshipImpactSource(sourceType: string) {
  return sourceType === "npc_relationship_action" || sourceType === "active_npc_request" || sourceType === "relationship";
}

function relationshipImpactAllowsNpcProfile(impact: Record<string, unknown>) {
  const topicSurfaceIds = Array.isArray(impact.topicSurfaceIds)
    ? impact.topicSurfaceIds.map((item) => safePeopleText(item, "", 48)).filter(Boolean)
    : [];
  return !topicSurfaceIds.length || topicSurfaceIds.includes("npc-profile");
}

function collectRelationshipImpactRows(worldEntityView: unknown) {
  return rowsFromViewKeys(worldEntityView, ["recentImpacts"])
    .flatMap((impact): RelationshipImpactRow[] => {
      const sourceType = safePeopleText(impact.sourceType, "", 48);
      if (!isRelationshipImpactSource(sourceType)) return [];
      if (!relationshipImpactAllowsNpcProfile(impact)) return [];

      const entityId = safePeopleText(impact.entityId, "", 96);
      const publicSummary = safePeopleText(impact.publicSummary || impact.summary, "", 180);
      const title = safePeopleText(impact.title, "", 80);
      if (!entityId || (!publicSummary && !title)) return [];

      const affectedMetricLabels = Array.isArray(impact.affectedMetricLabels)
        ? impact.affectedMetricLabels.map((item) => safePeopleText(item, "", 24)).filter(Boolean).slice(0, 4)
        : [];
      const sourceLabel = safePeopleText(impact.sourceLabel, "公开压力", 32);
      const generatedAtTurn = Number.isFinite(Number(impact.generatedAtTurn))
        ? Number(impact.generatedAtTurn)
        : 0;

      return [{
        entityId,
        title,
        publicSummary,
        sourceLabel,
        affectedMetricLabels,
        generatedAtTurn
      }];
    });
}

function buildRelationshipEntitySignals(worldEntityView: unknown, worldEntityImpacts: unknown) {
  const directEntities = rowsFromViewKeys(worldEntityView, ["highlights", "entities", "items"]);
  const groupedEntities = rowsFromViewKeys(worldEntityView, ["groups"]).flatMap((group) => rowsFromViewKeys(group, ["entities"]));
  const recentImpacts = collectRelationshipImpactRows(worldEntityView);
  const impacts = Array.isArray(worldEntityImpacts)
    ? worldEntityImpacts.filter((impact): impact is Record<string, unknown> => Boolean(impact && typeof impact === "object" && !Array.isArray(impact)))
    : [];
  const impactCounts = impacts.reduce<Map<string, number>>((counts, impact) => {
    const sourceType = safePeopleText(impact.sourceType, "", 48);
    if (!isRelationshipImpactSource(sourceType)) return counts;
    if (!relationshipImpactAllowsNpcProfile(impact)) return counts;
    const entityId = safePeopleText(impact.entityId, "", 96);
    if (!entityId) return counts;
    counts.set(entityId, (counts.get(entityId) ?? 0) + 1);
    return counts;
  }, new Map());
  const latestImpactByEntity = new Map<string, typeof recentImpacts[number]>();
  for (const impact of recentImpacts.slice().sort((first, second) => second.generatedAtTurn - first.generatedAtTurn)) {
    impactCounts.set(impact.entityId, (impactCounts.get(impact.entityId) ?? 0) + 1);
    if (!latestImpactByEntity.has(impact.entityId)) latestImpactByEntity.set(impact.entityId, impact);
  }
  const seen = new Set<string>();
  return [...directEntities, ...groupedEntities]
    .filter((entity) => entityLooksRelationshipRelevant(entity) || impactCounts.has(safePeopleText(entity.id, "", 96)))
    .map((entity): RelationshipEntitySignal | null => {
      const id = safePeopleText(entity.id, "", 96);
      if (!id || seen.has(id)) return null;
      seen.add(id);
      const publicSummary = safePeopleText(entity.publicSummary, "", 140);
      if (!publicSummary) return null;
      const recentImpact = latestImpactByEntity.get(id);
      const metricMeta = recentImpact?.affectedMetricLabels.length
        ? ` · ${recentImpact.affectedMetricLabels.join("、")}`
        : "";
      return {
        id,
        name: safePeopleText(entity.name, "关系网节点", 48),
        categoryLabel: safePeopleText(entity.categoryLabel, "公开关系", 32),
        statusLabel: safePeopleText(entity.statusLabel, "可观察", 32),
        riskLabel: safePeopleText(entity.riskLabel, "可观察", 32),
        publicSummary,
        recentImpactSummary: recentImpact?.publicSummary || "",
        recentImpactMeta: recentImpact ? `${recentImpact.sourceLabel}${metricMeta}` : "",
        impactCount: impactCounts.get(id) ?? 0
      };
    })
    .filter((entry): entry is RelationshipEntitySignal => Boolean(entry))
    .sort((first, second) => {
      if (second.impactCount !== first.impactCount) return second.impactCount - first.impactCount;
      return first.name.localeCompare(second.name);
    })
    .slice(0, 4);
}

function collectThreadRelatedLabels(thread: Record<string, unknown>) {
  const relatedLabels = thread.relatedLabels && typeof thread.relatedLabels === "object" && !Array.isArray(thread.relatedLabels)
    ? thread.relatedLabels as Record<string, unknown>
    : {};
  return ["characters", "factions", "offices", "entities", "metrics"]
    .flatMap((key) => Array.isArray(relatedLabels[key]) ? relatedLabels[key] : [])
    .map((item) => safePeopleText(item, "", 28))
    .filter(Boolean)
    .slice(0, 5);
}

function collectRelationshipAgendaThreads(worldThreadView: unknown) {
  const seen = new Set<string>();
  return rowsFromViewKeys(worldThreadView, ["activeThreads"])
    .flatMap((thread): RelationshipAgendaThread[] => {
      const sourceType = safePeopleText(thread.sourceType, "", 48);
      if (sourceType !== "npc_relationship_action") return [];
      if ([
        thread.id,
        thread.sourceId,
        thread.sourceLabel,
        thread.title,
        thread.summary,
        thread.goal,
        thread.followUpHint
      ].some(peopleTextLooksUnsafe)) return [];

      const id = safePeopleText(thread.id || thread.sourceId, "", 96);
      const title = safePeopleText(thread.title, "交游议题", 72);
      const summary = safePeopleText(
        thread.summary,
        "交游记录只作公开关系议题，资源、婚姻、伤损、弹劾、定罪、背叛和人物行动仍候案卷回批。",
        188
      );
      if (!id || !title || !summary || seen.has(id)) return [];
      seen.add(id);
      const rawStatus = safePeopleText(thread.status, "active", 32);
      const status = rawStatus === "watch" ? "待观察" : rawStatus === "resolved" ? "已归档" : "可跟进";
      const interventionHints = Array.isArray(thread.interventionHints)
        ? thread.interventionHints.map((item) => safePeopleText(item, "", 36)).filter(Boolean).slice(0, 3)
        : [];
      return [{
        id,
        title,
        sourceLabel: safePeopleText(thread.sourceLabel, "交游记录", 28),
        statusLabel: status,
        riskLabel: safePeopleText(thread.riskLabel, Number(thread.severity) >= 2 ? "中风险" : "可观察", 28),
        summary,
        goal: safePeopleText(thread.goal, "只追踪公开交游余波，不裁决关系终局。", 112),
        followUpHint: safePeopleText(thread.followUpHint, "后续仍需主卷或人物互动候复。", 128),
        interventionHints,
        relatedLabels: collectThreadRelatedLabels(thread)
      }];
    })
    .slice(0, 4);
}

function statusLabel(status: unknown) {
  const text = safePeopleText(status, "待裁", 32);
  const labels: Record<string, string> = {
    accepted: "已准",
    proposed: "已议",
    countered: "还价",
    rejected: "未准",
    active: "执行中",
    overdue: "逾期",
    completed: "已成",
    failed: "未成",
    server_blocked: "暂未准行"
  };
  return labels[text] || text;
}

function actionLabel(actionType: unknown) {
  const text = safePeopleText(actionType, "", 32);
  const labels: Record<string, string> = {
    debate: "论道",
    duel: "切磋",
    courtship: "求爱",
    marriage: "议婚"
  };
  return labels[text] || text || "交游";
}

function buildPersonRows(
  registry: AssetRegistry | null,
  session: ReturnType<typeof useGameSessionStore.getState>["currentSession"],
  sessionId: string
): readonly PersonRow[] {
  if (!session || session.sessionId !== sessionId) return [];

  const rows: PersonRow[] = [];
  const player = session.worldState?.player;
  const playerPortraitRef = resolvePlayerPortraitRef(registry, player, sessionId) || fallbackPortraitRef;
  if (player) {
    const playerIdentity = getPlayerIdentity(player);
    rows.push({
      id: "player",
      kind: "player",
      name: safePeopleText(player.name, "无名", 40),
      identity: playerIdentity,
      summary: buildPlayerPortraitSummary(player, playerIdentity),
      current: `案主当前以${playerIdentity}见于公开案卷；下一步读书、应考、任事或交游仍随主卷回批推进。`,
      portraitRef: playerPortraitRef,
      meta: ["案主", roleLabels[player.role ?? ""] || "本局人物"],
      remastered: Boolean(registry?.getPortrait(playerPortraitRef)?.hasHighResOverride)
    });
  }

  const relationships = session.worldPeopleView?.relationships ?? [];
  for (const npc of session.worldPeopleView?.npcs ?? []) {
    if (rows.length >= maxPeopleRows) break;
    if (!isNpcPublicForLedger(npc)) continue;
    const portraitRef = resolveNpcPortraitRef(registry, npc) || fallbackPortraitRef;
    const relationshipNote = relationshipTone(relationForNpc(relationships, npc.id));
    const npcName = safePeopleText(npc.name, "无名人物", 40);
    const npcIdentity = safePeopleText(npc.rankLabel || npc.genderLabel, "公开人物", 40);
    rows.push({
      id: npc.id,
      kind: "npc",
      name: npcName,
      identity: npcIdentity,
      summary: safePeopleText(npc.publicSummary, "暂无公开小传。", 120),
      current: buildNpcPortraitCurrent(npcName, npcIdentity, npc.currentGoal, relationshipNote),
      portraitRef,
      meta: [
        safePeopleText(npc.genderLabel, "未详", 20),
        typeof npc.intelConfidence === "number" ? `确信 ${npc.intelConfidence}` : "",
        typeof npc.influence === "number" ? `声势 ${npc.influence}` : ""
      ].filter(Boolean),
      relationshipNote,
      remastered: Boolean(registry?.getPortrait(portraitRef)?.hasHighResOverride)
    });
  }

  return rows;
}

export function PeoplePage() {
  const { sessionId = "s74-preview" } = useParams();
  const openSurfaceForSession = useUiStateStore((state) => state.openSurfaceForSession);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const session = useGameSessionStore((state) => state.currentSession);
  const loadNpcs = useGameSessionStore((state) => state.loadNpcs);
  const loadNpcDetail = useGameSessionStore((state) => state.loadNpcDetail);
  const interactWithNpc = useGameSessionStore((state) => state.interactWithNpc);
  const submitTrade = useGameSessionStore((state) => state.submitTrade);
  const submitNpcCommand = useGameSessionStore((state) => state.submitNpcCommand);
  const storeCurrentSessionId = useGameSessionStore((state) => state.currentSessionId);
  const npcRosterPayload = useGameSessionStore((state) => state.npcRoster);
  const npcDetailPayload = useGameSessionStore((state) => state.npcDetail);
  const lastNpcInteraction = useGameSessionStore((state) => state.lastNpcInteraction);
  const lastTrade = useGameSessionStore((state) => state.lastTrade);
  const lastNpcCommand = useGameSessionStore((state) => state.lastNpcCommand);
  const npcRosterStatus = useGameSessionStore((state) => state.npcRosterStatus);
  const npcDetailStatus = useGameSessionStore((state) => state.npcDetailStatus);
  const npcMutationStatus = useGameSessionStore((state) => state.npcMutationStatus);
  const error = useGameSessionStore((state) => state.error);
  const { registry, status } = useAssetRegistry();
  const routeSessionSupported = isRouteLocalSessionId(sessionId);
  const activeSession = routeSessionSupported && session?.sessionId === sessionId ? session : null;
  const latestSessionIdRef = useRef(sessionId);
  const [localPeopleSessionId, setLocalPeopleSessionId] = useState(sessionId);
  const [portraitPage, setPortraitPage] = useState(0);
  const [selectedNpcId, setSelectedNpcId] = useState("");
  const [activeTab, setActiveTab] = useState<NpcWorkbenchTab>("profile");
  const [dialogueDraft, setDialogueDraft] = useState("");
  const [tradeOffer, setTradeOffer] = useState("");
  const [tradeSilverDelta, setTradeSilverDelta] = useState("0");
  const [commandText, setCommandText] = useState("");
  const [commandTargetRef, setCommandTargetRef] = useState("");
  const [commandBudget, setCommandBudget] = useState("24");
  const [socialDraft, setSocialDraft] = useState("");
  const runnable = routeSessionSupported && isRunnableSessionId(sessionId);
  const localStateIsCurrent = localPeopleSessionId === sessionId;
  const routeError = routeSessionSupported && error && storeCurrentSessionId === sessionId ? error : null;
  const routeNpcRosterStatus = routeSessionSupported && storeCurrentSessionId === sessionId ? npcRosterStatus : "idle";
  const routeNpcDetailStatus = routeSessionSupported && storeCurrentSessionId === sessionId ? npcDetailStatus : "idle";
  const routeNpcMutationStatus = routeSessionSupported && storeCurrentSessionId === sessionId ? npcMutationStatus : "idle";
  const activeDialogueDraft = localStateIsCurrent ? dialogueDraft : "";
  const activeTradeOffer = localStateIsCurrent ? tradeOffer : "";
  const activeTradeSilverDelta = localStateIsCurrent ? tradeSilverDelta : "0";
  const activeCommandText = localStateIsCurrent ? commandText : "";
  const activeCommandTargetRef = localStateIsCurrent ? commandTargetRef : "";
  const activeCommandBudget = localStateIsCurrent ? commandBudget : "24";
  const activeSocialDraft = localStateIsCurrent ? socialDraft : "";
  const activeLastNpcInteraction = routeSessionSupported && lastNpcInteraction?.sessionId === sessionId ? lastNpcInteraction : null;
  const activeLastTrade = routeSessionSupported && lastTrade?.sessionId === sessionId ? lastTrade : null;
  const activeLastNpcCommand = routeSessionSupported && lastNpcCommand?.sessionId === sessionId ? lastNpcCommand : null;
  const unsupportedRouteMessage = "此案卷编号暂不可用于浏览器人物谱牒；请从首页开卷或载入旧案。";
  const latestSelectedNpcIdRef = useRef("");

  useEffect(() => {
    latestSessionIdRef.current = sessionId;
    setLocalPeopleSessionId(sessionId);
    setPortraitPage(0);
    setSelectedNpcId("");
    setActiveTab("profile");
    setDialogueDraft("");
    setTradeOffer("");
    setTradeSilverDelta("0");
    setCommandText("");
    setCommandTargetRef("");
    setCommandBudget("24");
    setSocialDraft("");
  }, [sessionId]);

  useEffect(() => {
    if (!runnable) return;
    void loadNpcs(sessionId, { pageSize: 50 }).catch(() => undefined);
  }, [loadNpcs, runnable, sessionId]);

  const activeNpcRosterPayload = routeSessionSupported && npcRosterPayload?.sessionId === sessionId ? npcRosterPayload : null;
  const activeNpcDetailPayload = routeSessionSupported && npcDetailPayload?.sessionId === sessionId ? npcDetailPayload : null;
  const rosterView = activeNpcRosterPayload
    ? activeNpcRosterPayload.npcRosterView
    : activeSession
      ? activeSession.npcRosterView
      : null;
  const rosterNpcs = useMemo(
    () => (rosterView?.items ?? []).map((npc) => toWorkbenchNpc(registry, npc)),
    [registry, rosterView]
  );
  const npcGroups = useMemo(() => groupNpcs(rosterNpcs), [rosterNpcs]);
  const activeSelectedNpcId = localStateIsCurrent ? selectedNpcId : "";
  const selectedNpc = rosterNpcs.find((npc) => npc.npcId === activeSelectedNpcId) ?? rosterNpcs[0] ?? null;
  const selectedNpcIdForResults = selectedNpc?.npcId ?? "";

  useEffect(() => {
    latestSelectedNpcIdRef.current = selectedNpcIdForResults;
  }, [selectedNpcIdForResults]);

  useEffect(() => {
    if (rosterNpcs[0] && (!activeSelectedNpcId || !rosterNpcs.some((npc) => npc.npcId === activeSelectedNpcId))) {
      setLocalPeopleSessionId(sessionId);
      latestSelectedNpcIdRef.current = rosterNpcs[0].npcId;
      setSelectedNpcId(rosterNpcs[0].npcId);
    }
  }, [activeSelectedNpcId, rosterNpcs, sessionId]);

  useEffect(() => {
    if (!runnable || !selectedNpc?.npcId) return;
    void loadNpcDetail(sessionId, selectedNpc.npcId).catch(() => undefined);
  }, [loadNpcDetail, runnable, selectedNpc?.npcId, sessionId]);

  const peopleRows = useMemo(
    () => buildPersonRows(registry, activeSession, sessionId),
    [registry, activeSession, sessionId]
  );
  const totalPages = Math.max(1, Math.ceil(peopleRows.length / portraitPageSize));
  const safePortraitPage = Math.min(portraitPage, totalPages - 1);
  const visiblePeople = peopleRows.slice(safePortraitPage * portraitPageSize, safePortraitPage * portraitPageSize + portraitPageSize);
  const npcCount = peopleRows.filter((row) => row.kind === "npc").length;
  const remasteredCount = visiblePeople.filter((row) => row.remastered).length;
  const npcDetail = activeNpcDetailPayload && selectedNpc && activeNpcDetailPayload.npcDetailView.npcId === selectedNpc.npcId
    ? activeNpcDetailPayload.npcDetailView
    : null;
  const interactionRecords = activeNpcDetailPayload
    ? activeNpcDetailPayload.npcInteractionView?.items ?? activeNpcRosterPayload?.npcInteractionView?.items ?? activeSession?.npcInteractionView?.items ?? []
    : activeSession?.npcInteractionView?.items ?? [];
  const tradeRecords = activeNpcDetailPayload
    ? activeNpcDetailPayload.tradeLedgerView?.items ?? activeSession?.tradeLedgerView?.items ?? []
    : activeSession?.tradeLedgerView?.items ?? [];
  const delegatedTasks = activeNpcDetailPayload
    ? activeNpcDetailPayload.delegatedTaskView?.items ?? activeNpcRosterPayload?.delegatedTaskView?.items ?? activeSession?.delegatedTaskView?.items ?? []
    : activeSession?.delegatedTaskView?.items ?? [];
  const peopleEconomyTraceView = activeSession?.economyTraceView
    ?? activeLastTrade?.economyTraceView
    ?? activeLastNpcCommand?.economyTraceView
    ?? null;
  const relationshipEntitySignals = useMemo(
    () => buildRelationshipEntitySignals(activeSession?.worldEntityView, activeLastNpcInteraction?.worldEntityImpacts),
    [activeLastNpcInteraction?.worldEntityImpacts, activeSession?.worldEntityView]
  );
  const relationshipAgendaThreads = useMemo(
    () => collectRelationshipAgendaThreads(activeSession?.worldThreadView),
    [activeSession?.worldThreadView]
  );
  const activeNpcDialogueView = activeLastNpcInteraction?.npcDialogueView?.npcId === selectedNpcIdForResults
    ? activeLastNpcInteraction.npcDialogueView
    : undefined;
  const activeNpcActionResolutionView = activeLastNpcInteraction?.npcDialogueView?.npcId === selectedNpcIdForResults
    ? activeLastNpcInteraction.npcActionResolutionView
    : undefined;
  const activeNpcTradeRecord = activeLastTrade?.tradeRecord &&
    (activeLastTrade.tradeRecord.npcId === selectedNpcIdForResults || activeLastTrade.tradeRecord.actorBId === selectedNpcIdForResults)
    ? activeLastTrade.tradeRecord
    : undefined;
  const activeNpcCommandPlan = activeLastNpcCommand?.delegatedTaskView?.items?.some((task) => task.assignee?.npcId === selectedNpcIdForResults)
    ? activeLastNpcCommand.delegatedTaskPlanView
    : undefined;

  async function handleDialogueSubmit() {
    if (!selectedNpc || !activeDialogueDraft.trim() || !runnable) return;
    const requestSessionId = sessionId;
    const requestNpcId = selectedNpc.npcId;
    const requestUtterance = activeDialogueDraft.trim();
    await interactWithNpc(requestSessionId, {
      npcId: requestNpcId,
      actionType: "talk",
      utterance: requestUtterance
    }).then(() => {
      if (latestSessionIdRef.current === requestSessionId && latestSelectedNpcIdRef.current === requestNpcId) {
        setDialogueDraft((current) => current.trim() === requestUtterance ? "" : current);
      }
    }).catch(() => undefined);
  }

  async function handleTradeSubmit() {
    if (!selectedNpc || !activeTradeOffer.trim() || !runnable) return;
    const requestSessionId = sessionId;
    const requestNpcId = selectedNpc.npcId;
    const requestOffer = activeTradeOffer.trim();
    await submitTrade(requestSessionId, {
      npcId: requestNpcId,
      tradeId: `trade:${requestNpcId}:${Date.now()}`,
      silverDelta: Number.parseInt(activeTradeSilverDelta, 10) || 0,
      offerSummary: requestOffer
    }).then(() => {
      if (latestSessionIdRef.current === requestSessionId && latestSelectedNpcIdRef.current === requestNpcId) {
        setTradeOffer((current) => current.trim() === requestOffer ? "" : current);
      }
    }).catch(() => undefined);
  }

  async function handleCommandSubmit() {
    if (!selectedNpc || !activeCommandText.trim() || !runnable) return;
    const requestSessionId = sessionId;
    const requestNpcId = selectedNpc.npcId;
    const requestCommandText = activeCommandText.trim();
    await submitNpcCommand(requestSessionId, {
      assigneeActorId: requestNpcId,
      taskType: "land_survey",
      authoritySource: "yamen_authority",
      targetRef: activeCommandTargetRef.trim() || "geo:county:current",
      commandText: requestCommandText,
      budget: Number.parseInt(activeCommandBudget, 10) || 0
    }).then(() => {
      if (latestSessionIdRef.current === requestSessionId && latestSelectedNpcIdRef.current === requestNpcId) {
        setCommandText((current) => current.trim() === requestCommandText ? "" : current);
      }
    }).catch(() => undefined);
  }

  async function handleSocialSubmit(actionType: string) {
    if (!selectedNpc || !runnable) return;
    const requestSessionId = sessionId;
    const requestNpcId = selectedNpc.npcId;
    const requestSocialDraft = activeSocialDraft.trim();
    await interactWithNpc(requestSessionId, {
      npcId: requestNpcId,
      actionType,
      utterance: requestSocialDraft || `${actionLabel(actionType)}${selectedNpc.displayName}，请按礼法与身份候复。`
    }).then(() => {
      if (latestSessionIdRef.current === requestSessionId && latestSelectedNpcIdRef.current === requestNpcId) {
        setSocialDraft((current) => current.trim() === requestSocialDraft ? "" : current);
      }
    }).catch(() => undefined);
  }

  return (
    <article className="surfacePanel routePanel peopleWorkbenchPanel" aria-labelledby="people-title" data-polish-people="s89-9-portrait-material">
      <div className="routePanelHeader">
        <div>
          <p className="eyebrow">人物案牍</p>
          <h1 id="people-title">人物</h1>
          <p>名册、详情、对话、交易和委派均来自已公开卷宗；本页不窥私档、底价、未公开心迹或内账。</p>
        </div>
        <span>{routeNpcRosterStatus === "loading" ? "候谱" : `${rosterNpcs.length || npcCount} 人`}</span>
      </div>
      <NpcActiveRequestInbox
        requests={(activeSession?.npcActiveRequestView?.items ?? []) as readonly NpcActiveRequestItemView[]}
        onDraft={(request, option) => setActionDraft({
          source: "role-surface",
          targetPage: "game",
          text: safePeopleText(
            option?.draftText,
            `回应${safePeopleText(request.typeLabel, "请托", 20)}：先查证${safePeopleText(request.npc?.displayName, "来人", 32)}所言，凡资源、关系、婚姻、弹劾或背叛结果均候复。`,
            180
          )
        })}
      />
      <NpcActiveRequestFollowUpDocket
        tasks={(activeSession?.npcActiveRequestView?.followUpTasks ?? []) as readonly NpcActiveRequestFollowUpTaskView[]}
        onDraft={(task) => setActionDraft({
          source: "role-surface",
          targetPage: "game",
          text: safePeopleText(
            task.draftText,
            `续办${safePeopleText(task.title, "来函后续", 40)}：只作公开复核草稿，资源、婚姻、弹劾、背叛和未公开事实仍候案卷回批。`,
            180
          )
        })}
      />
      <NpcFollowUpEvidenceSection
        evidence={activeSession?.npcActiveRequestView?.followUpEvidence ?? null}
        boundaryText="这里展示的线索只来自已公开卷宗；按钮只写草稿，不结算资源、人情债、婚姻、弹劾、定罪、背叛或未公开事实。"
        idPrefix="people-follow-up-evidence"
        onDraft={(text) => setActionDraft({
          source: "role-surface",
          targetPage: "game",
          text
        })}
      />
      <NpcRelationshipEntitySignals signals={relationshipEntitySignals} />
      <NpcRelationshipAgenda
        threads={relationshipAgendaThreads}
        runnable={runnable}
        onDraft={(thread) => setActionDraft({
          source: "role-surface",
          targetPage: "game",
          text: safePeopleText(
            `续记${thread.title}：只据公开交游议题拟拜会或补证；资源、婚姻、伤损、关系终局、弹劾、定罪、背叛和人物行动仍候案卷回批。`,
            "续记交游议题：只作公开复核草稿，真实后果仍候案卷回批。",
            188
          )
        })}
      />
      <EconomyTraceSection
        traceView={peopleEconomyTraceView}
        title="交易委派账本为何变化"
        summaryFallback="交易、委派、人情债、市价和月账解释只来自已公开卷宗；人物页不成交、不扣款、不改差事结果。"
        idPrefix="people-economy-trace"
        traceTypes={peopleEconomyTraceTypes}
        maxItems={6}
        runnable={runnable}
        onDraft={(text) => setActionDraft({
          source: "role-surface",
          targetPage: "game",
          text
        })}
      />
      <section className="npcWorkbench" aria-label="人物名册" data-polish-people-workbench="s89-9-portrait-material">
        <aside className="npcGroupList" aria-label="人物分组">
          {npcGroups.length ? npcGroups.map((group) => (
            <section key={group.label}>
              <h2>{group.label}</h2>
              {group.items.map((npc) => (
                <button
                  key={npc.npcId}
                  className="npcListButton"
                  type="button"
                  aria-pressed={selectedNpc?.npcId === npc.npcId}
                  onClick={() => {
                    setLocalPeopleSessionId(sessionId);
                    latestSelectedNpcIdRef.current = npc.npcId;
                    setSelectedNpcId(npc.npcId);
                    setActiveTab("profile");
                  }}
                >
                  {registry ? (
                    <Portrait
                      registry={registry}
                      portraitRef={npc.portraitRef}
                      label={`${npc.displayName}立绘`}
                      className="npcListPortrait"
                      profile={buildPortraitProfile({
                        name: npc.displayName,
                        identity: npc.title,
                        summary: npc.summary,
                        current: `${npc.displayName}列于公开人物名册，身份为${npc.title}；详况候复核。`,
                        tags: [...npc.stageTags, ...npc.roleTags, ...npc.relationshipLabels]
                      })}
                    />
                  ) : <span className="npcListPortraitFallback" aria-hidden="true">人</span>}
                  <span>
                    <strong>{npc.displayName}</strong>
                    <small>{npc.title}</small>
                  </span>
                </button>
              ))}
            </section>
          )) : <p className="statusLine">{routeSessionSupported ? "等待人物名册。" : unsupportedRouteMessage}</p>}
        </aside>
        <section className="npcDetailWorkbench" aria-label="人物详情" data-polish-people-detail="s89-9-portrait-material">
          {selectedNpc ? (
            <>
              <div className="npcDetailHeader">
                {registry ? (
                  <Portrait
                    registry={registry}
                    portraitRef={selectedNpc.portraitRef}
                    label={`${selectedNpc.displayName}立绘`}
                    className="peoplePortrait"
                    profile={buildPortraitProfile({
                      name: selectedNpc.displayName,
                      identity: selectedNpc.title,
                      summary: npcDetail?.publicProfile?.summary || selectedNpc.summary,
                      current: npcDetail?.publicProfile?.posting
                        ? `当前见于${safePeopleText(npcDetail.publicProfile.posting, "公开任所", 48)}；人物页只补公开近况，其余行止候复核。`
                        : `${selectedNpc.displayName}当前以${selectedNpc.title}见于人物页；任所或行止未详，候复核。`,
                      tags: [...selectedNpc.stageTags, ...selectedNpc.roleTags, ...selectedNpc.relationshipLabels]
                    })}
                  />
                ) : null}
                <div>
                  <p className="eyebrow">{selectedNpc.tier}</p>
                  <h2>{selectedNpc.displayName}</h2>
                  <p>{selectedNpc.title}</p>
                  <div className="peopleMeta">
                    {[...selectedNpc.stageTags, ...selectedNpc.roleTags, ...selectedNpc.relationshipLabels].slice(0, 8).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                </div>
              </div>
              <nav className="inkboxTabs npcTabs" aria-label={`${selectedNpc.displayName}工作台页签`}>
                {npcWorkbenchTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className="inkboxTab"
                    type="button"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              {activeTab === "profile" ? (
                <NpcProfileTab
                  selectedNpc={selectedNpc}
                  detail={npcDetail}
                  loading={routeNpcDetailStatus === "loading"}
                  onDraft={() => setActionDraft({
                    source: "role-surface",
                    targetPage: "game",
                    text: `拜访${selectedNpc.displayName}，询问${selectedNpc.title}近况。`
                  })}
                />
              ) : null}
              {activeTab === "dialogue" ? (
                <NpcDialogueTab
                  dialogueDraft={activeDialogueDraft}
                  latestDialogue={activeNpcDialogueView}
                  records={interactionRecords}
                  busy={routeNpcMutationStatus === "loading"}
                  onDraftChange={(value) => {
                    setLocalPeopleSessionId(sessionId);
                    setDialogueDraft(value);
                  }}
                  onSubmit={handleDialogueSubmit}
                />
              ) : null}
              {activeTab === "trade" ? (
                <NpcTradeTab
                  offer={activeTradeOffer}
                  silverDelta={activeTradeSilverDelta}
                  records={tradeRecords}
                  latestTrade={activeNpcTradeRecord}
                  busy={routeNpcMutationStatus === "loading"}
                  onOfferChange={(value) => {
                    setLocalPeopleSessionId(sessionId);
                    setTradeOffer(value);
                  }}
                  onSilverDeltaChange={(value) => {
                    setLocalPeopleSessionId(sessionId);
                    setTradeSilverDelta(value);
                  }}
                  onSubmit={handleTradeSubmit}
                />
              ) : null}
              {activeTab === "command" ? (
                <NpcCommandTab
                  commandText={activeCommandText}
                  targetRef={activeCommandTargetRef}
                  budget={activeCommandBudget}
                  tasks={delegatedTasks}
                  latestPlan={activeNpcCommandPlan}
                  busy={routeNpcMutationStatus === "loading"}
                  onCommandTextChange={(value) => {
                    setLocalPeopleSessionId(sessionId);
                    setCommandText(value);
                  }}
                  onTargetRefChange={(value) => {
                    setLocalPeopleSessionId(sessionId);
                    setCommandTargetRef(value);
                  }}
                  onBudgetChange={(value) => {
                    setLocalPeopleSessionId(sessionId);
                    setCommandBudget(value);
                  }}
                  onSubmit={handleCommandSubmit}
                />
              ) : null}
              {activeTab === "social" ? (
                <NpcSocialTab
                  selectedNpc={selectedNpc}
                  detail={npcDetail}
                  draft={activeSocialDraft}
                  latestResolution={activeNpcActionResolutionView}
                  busy={routeNpcMutationStatus === "loading"}
                  onDraftChange={(value) => {
                    setLocalPeopleSessionId(sessionId);
                    setSocialDraft(value);
                  }}
                  onSubmit={handleSocialSubmit}
                />
              ) : null}
              {activeTab === "records" ? (
                <NpcRecordsTab interactions={interactionRecords} trades={tradeRecords} tasks={delegatedTasks} />
              ) : null}
            </>
          ) : <p className="statusLine">{routeSessionSupported ? "请选择一名可见人物。" : unsupportedRouteMessage}</p>}
        </section>
      </section>
      <section className="portraitLedger" aria-label="本局人物谱牒" data-polish-people-ledger="s89-9-portrait-material">
        <div className="portraitLedgerHeader">
          <div>
            <h3>人物谱牒</h3>
            <p>
              {peopleRows.length
                ? `当前入谱 ${peopleRows.length} 人，相识人物 ${npcCount} 人；本页 ${remasteredCount} 张使用高清重制。`
                : routeSessionSupported ? "正在等待公开人物名册。" : unsupportedRouteMessage}
            </p>
          </div>
          {peopleRows.length ? <span>{safePortraitPage + 1} / {totalPages}</span> : null}
        </div>
        {status === "error" ? <p className="statusLine" role="status">立绘索引暂不可用，人物仍以纸底占位显示。</p> : null}
        {visiblePeople.length ? (
          <div
            className="peopleLedgerList"
            data-visible-people={visiblePeople.length}
            data-total-people={peopleRows.length}
            data-visible-portraits={visiblePeople.length}
          >
            {visiblePeople.map((person) => (
              <article className="peopleCard" key={`${person.kind}-${person.id}`} data-person-kind={person.kind} data-polish-people-card="s89-9-portrait-material">
                {registry ? (
                  <Portrait
                    registry={registry}
                    portraitRef={person.portraitRef}
                    label={`${person.name}立绘`}
                    className="peoplePortrait"
                    profile={buildPortraitProfile({
                      name: person.name,
                      identity: person.identity,
                      summary: person.summary,
                      current: person.current,
                      tags: person.meta
                    })}
                  />
                ) : (
                  <figure className="portraitFrame portraitFrameFallback peoplePortrait" aria-label={`${person.name}，纸底占位`}>
                    <span aria-hidden="true">人</span>
                  </figure>
                )}
                <div className="peopleInfo">
                  <div>
                    <p className="eyebrow">{person.kind === "player" ? "案主" : "相识人物"}</p>
                    <h4>{person.name}</h4>
                    <p className="peopleIdentity">{person.identity}</p>
                  </div>
                  <div className="peopleMeta" aria-label={`${person.name}公开摘要`}>
                    {person.meta.map((item) => <span key={item}>{item}</span>)}
                    <span>{person.remastered ? "高清重制" : "原图或占位"}</span>
                  </div>
                  <p className="peopleSummary">{person.summary}</p>
                  {person.relationshipNote ? <p className="peopleRelationship">{person.relationshipNote}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="statusLine">{routeSessionSupported ? "暂无可显示人物；本页不会从全量素材池补齐人物。" : unsupportedRouteMessage}</p>
        )}
        {peopleRows.length > portraitPageSize ? (
          <div className="buttonRow" aria-label="人物分页">
            <button className="paperButton" type="button" disabled={safePortraitPage <= 0} onClick={() => {
              setLocalPeopleSessionId(sessionId);
              setPortraitPage((page) => Math.max(0, page - 1));
            }}>
              上一组
            </button>
            <button className="paperButton" type="button" disabled={safePortraitPage >= totalPages - 1} onClick={() => {
              setLocalPeopleSessionId(sessionId);
              setPortraitPage((page) => Math.min(totalPages - 1, page + 1));
            }}>
              下一组
            </button>
          </div>
        ) : null}
      </section>
      <button
        className="paperButton"
        type="button"
        disabled={!routeSessionSupported}
        onClick={(event) => {
          if (!routeSessionSupported) return;
          markOverlayTrigger(event.currentTarget);
          openSurfaceForSession("npc-profile", sessionId);
        }}
      >
        打开人物档案
      </button>
      {routeError ? <p className="statusLine" role="alert">{routeError}</p> : null}
    </article>
  );
}

function NpcRelationshipEntitySignals({
  signals
}: {
  readonly signals: readonly RelationshipEntitySignal[];
}) {
  return (
    <section className="npcRelationshipEntitySignals" aria-label="人物关系网影响">
      <div className="sectionTitleRow">
        <div>
          <h2>关系网影响</h2>
          <p>论道、切磋、来函、求爱和议婚只有在入卷后才会牵动公开关系压力；本页不读取内账或未公开关系。</p>
        </div>
        <span>{signals.length ? `${signals.length} 条` : "待回响"}</span>
      </div>
      {signals.length ? (
        <div className="npcRelationshipSignalGrid">
          {signals.map((signal) => (
            <article className="npcRelationshipSignalCard" key={signal.id}>
              <div>
                <p className="eyebrow">{signal.categoryLabel} · {signal.statusLabel}</p>
                <h3>{signal.name}</h3>
              </div>
              <p>{signal.publicSummary}</p>
              {signal.recentImpactSummary ? (
                <p className="npcRelationshipImpactSummary">{signal.recentImpactSummary}</p>
              ) : null}
              <div className="peopleMeta">
                <span>{signal.riskLabel}</span>
                {signal.recentImpactMeta ? <span>{signal.recentImpactMeta}</span> : null}
                {signal.impactCount ? <span>公开压力 {signal.impactCount} 项</span> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="statusLine">暂无可见关系网回响；后续交游仍需主卷或人物互动候复。</p>
      )}
    </section>
  );
}

function NpcRelationshipAgenda({
  threads,
  runnable,
  onDraft
}: {
  readonly threads: readonly RelationshipAgendaThread[];
  readonly runnable: boolean;
  readonly onDraft: (thread: RelationshipAgendaThread) => void;
}) {
  return (
    <section className="npcRelationshipAgenda" aria-label="人物交游议题">
      <div className="sectionTitleRow">
        <div>
          <h2>交游议题</h2>
          <p>这里仅展示已入卷的论道、切磋、求爱或议婚公开余波；真实关系、资源、婚姻、伤损和人物行动仍候案卷回批。</p>
        </div>
        <span>{threads.length ? `${threads.length} 条` : "待留痕"}</span>
      </div>
      {threads.length ? (
        <div className="npcRelationshipAgendaGrid">
          {threads.map((thread) => (
            <article className="npcRelationshipAgendaCard" key={thread.id}>
              <div>
                <p className="eyebrow">{thread.sourceLabel} · {thread.statusLabel}</p>
                <h3>{thread.title}</h3>
              </div>
              <p>{thread.summary}</p>
              <p className="npcRelationshipImpactSummary">{thread.followUpHint}</p>
              <div className="peopleMeta">
                <span>{thread.riskLabel}</span>
                {thread.relatedLabels.slice(0, 2).map((label) => <span key={label}>{label}</span>)}
                {thread.interventionHints[0] ? <span>{thread.interventionHints[0]}</span> : null}
              </div>
              <button type="button" disabled={!runnable} onClick={() => onDraft(thread)}>
                拟跟进
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="statusLine">暂无可见交游议题；交游记录须先入卷，才会留下可续办线索。</p>
      )}
    </section>
  );
}

function NpcProfileTab({
  selectedNpc,
  detail,
  loading,
  onDraft
}: {
  readonly selectedNpc: WorkbenchNpc;
  readonly detail: NpcDetailView | null;
  readonly loading: boolean;
  readonly onDraft: () => void;
}) {
  const profile = detail?.publicProfile;
  const relationship = detail?.relationship;
  return (
    <section className="npcTabPanel">
      <p>{safePeopleText(profile?.summary || selectedNpc.summary, "暂无公开小传。", 220)}</p>
      <dl className="npcFactGrid">
        <div><dt>籍贯</dt><dd>{safePeopleText(profile?.origin, "未题", 48)}</dd></div>
        <div><dt>任所</dt><dd>{safePeopleText(profile?.posting, "未题", 48)}</dd></div>
        <div><dt>亲疏</dt><dd>{relationship?.closeness ?? "未题"}</dd></div>
        <div><dt>信任</dt><dd>{relationship?.trust ?? "未题"}</dd></div>
      </dl>
      {profile?.visibleAbilities?.length ? (
        <div className="peopleMeta">{profile.visibleAbilities.map((item) => <span key={item}>{safePeopleText(item, "", 40)}</span>)}</div>
      ) : null}
      <div className="buttonRow">
        <button className="paperButton" type="button" onClick={onDraft}>写入主卷草稿</button>
        {loading ? <span className="statusLine">正在取详情</span> : null}
      </div>
    </section>
  );
}

function NpcDialogueTab({
  dialogueDraft,
  latestDialogue,
  records,
  busy,
  onDraftChange,
  onSubmit
}: {
  readonly dialogueDraft: string;
  readonly latestDialogue: { readonly dialogueText?: string; readonly mood?: string; readonly followUpSuggestions?: readonly string[] } | undefined;
  readonly records: readonly { readonly recordId?: string; readonly dialogueText?: string; readonly mood?: string; readonly actionType?: string; readonly serverStatus?: string }[];
  readonly busy: boolean;
  readonly onDraftChange: (value: string) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <section className="npcTabPanel">
      <label>
        对话
        <textarea value={dialogueDraft} rows={4} maxLength={220} onChange={(event) => onDraftChange(event.target.value)} placeholder="写下要问的话。" />
      </label>
      <button className="paperButton" type="button" disabled={!dialogueDraft.trim() || busy} onClick={onSubmit}>问话</button>
      {latestDialogue?.dialogueText ? (
        <article className="npcResultCard">
          <strong>{safePeopleText(latestDialogue.mood, "回应", 32)}</strong>
          <p>{safePeopleText(latestDialogue.dialogueText, "对方未作长答。", 260)}</p>
        </article>
      ) : null}
      <RecordList title="近事" items={records.slice(0, 4).map((record) => ({
        id: record.recordId || `${record.actionType}-${record.dialogueText}`,
        title: `${safePeopleText(record.actionType, "对话", 24)} · ${statusLabel(record.serverStatus)}`,
        body: safePeopleText(record.dialogueText, "无公开对话。", 140)
      }))} />
    </section>
  );
}

function NpcTradeTab({
  offer,
  silverDelta,
  records,
  latestTrade,
  busy,
  onOfferChange,
  onSilverDeltaChange,
  onSubmit
}: {
  readonly offer: string;
  readonly silverDelta: string;
  readonly records: readonly TradeRecordView[];
  readonly latestTrade?: TradeRecordView;
  readonly busy: boolean;
  readonly onOfferChange: (value: string) => void;
  readonly onSilverDeltaChange: (value: string) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <section className="npcTabPanel">
      <div className="npcTradeForm">
        <label>
          报价摘要
          <textarea value={offer} rows={3} maxLength={160} onChange={(event) => onOfferChange(event.target.value)} placeholder="如：议买纸张，愿补银二两。" />
        </label>
        <label>
          银两变动
          <input value={silverDelta} inputMode="numeric" onChange={(event) => onSilverDeltaChange(event.target.value)} />
        </label>
        <button className="paperButton" type="button" disabled={!offer.trim() || busy} onClick={onSubmit}>呈请交易</button>
      </div>
      {latestTrade ? (
        <article className="npcResultCard">
          <strong>{statusLabel(latestTrade.status)}</strong>
          <p>{safePeopleText(latestTrade.publicSummary || latestTrade.npcResponse, "交易已回批。", 180)}</p>
        </article>
      ) : null}
      <RecordList title="交易簿" items={records.slice(0, 5).map((record) => ({
        id: record.tradeId || record.offerSummary || "trade",
        title: `${statusLabel(record.status)} · ${record.requestedSilverDelta ?? 0} 两`,
        body: safePeopleText(record.publicSummary || record.offerSummary, "无公开摘要。", 140)
      }))} />
    </section>
  );
}

function NpcCommandTab({
  commandText,
  targetRef,
  budget,
  tasks,
  latestPlan,
  busy,
  onCommandTextChange,
  onTargetRefChange,
  onBudgetChange,
  onSubmit
}: {
  readonly commandText: string;
  readonly targetRef: string;
  readonly budget: string;
  readonly tasks: readonly DelegatedTaskRecordView[];
  readonly latestPlan?: { readonly planSummary?: string; readonly riskTags?: readonly string[]; readonly successFactors?: readonly string[] };
  readonly busy: boolean;
  readonly onCommandTextChange: (value: string) => void;
  readonly onTargetRefChange: (value: string) => void;
  readonly onBudgetChange: (value: string) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <section className="npcTabPanel">
      <div className="npcCommandForm">
        <label>
          命令
          <textarea value={commandText} rows={4} maxLength={220} onChange={(event) => onCommandTextChange(event.target.value)} placeholder="如：丈量东乡田亩，核对鱼鳞册。" />
        </label>
        <label>
          去处线索
          <input value={targetRef} onChange={(event) => onTargetRefChange(event.target.value)} placeholder="如：本县东乡、河堤、官仓" />
        </label>
        <label>
          经费
          <input value={budget} inputMode="numeric" onChange={(event) => onBudgetChange(event.target.value)} />
        </label>
        <button className="paperButton" type="button" disabled={!commandText.trim() || busy} onClick={onSubmit}>呈请委派</button>
      </div>
      {latestPlan?.planSummary ? (
        <article className="npcResultCard">
          <strong>计划</strong>
          <p>{safePeopleText(latestPlan.planSummary, "委派计划已回传。", 180)}</p>
        </article>
      ) : null}
      <RecordList title="委派簿" items={tasks.slice(0, 5).map((task) => ({
        id: task.taskId || task.title || "task",
        title: `${safePeopleText(task.title, "委派任务", 40)} · ${statusLabel(task.status)}`,
        body: [...(task.riskFactors ?? []), ...(task.successFactors ?? [])].map((item) => safePeopleText(item, "", 40)).filter(Boolean).join("；") || "无公开风险摘要。"
      }))} />
    </section>
  );
}

function NpcSocialTab({
  selectedNpc,
  detail,
  draft,
  latestResolution,
  busy,
  onDraftChange,
  onSubmit
}: {
  readonly selectedNpc: WorkbenchNpc;
  readonly detail: NpcDetailView | null;
  readonly draft: string;
  readonly latestResolution: unknown;
  readonly busy: boolean;
  readonly onDraftChange: (value: string) => void;
  readonly onSubmit: (actionType: string) => void;
}) {
  const actions = detail?.relationshipActionEligibilityView?.actions ?? [];
  const resolution = latestResolution && typeof latestResolution === "object" ? latestResolution as Record<string, unknown> : null;
  return (
    <section className="npcTabPanel">
      <label>
        交游呈词
        <textarea value={draft} rows={3} maxLength={180} onChange={(event) => onDraftChange(event.target.value)} placeholder={`写下对${selectedNpc.displayName}的交游意图。`} />
      </label>
      <div className="npcSocialGrid">
        {actions.length ? actions.map((action) => {
          const actionType = safePeopleText(action.actionType, "", 32);
          const available = action.available === true;
          const blockers = (action.blockers ?? []).map((item) => safePeopleText(item, "", 42)).filter(Boolean);
          return (
            <article className="inventoryMiniCard" key={actionType || action.label}>
              <strong>{safePeopleText(action.label, actionLabel(actionType), 32)}</strong>
              <span>{available ? "可呈请复核" : blockers.join("；") || "暂不可用"}</span>
              <button className="paperButton" type="button" disabled={!available || busy} onClick={() => onSubmit(actionType)}>
                {safePeopleText(action.requestLabel, "呈请", 24)}
              </button>
            </article>
          );
        }) : <p className="statusLine">等待礼法条目入卷。</p>}
      </div>
      {resolution ? (
        <article className="npcResultCard">
          <strong>{safePeopleText(resolution.actionLabel, "案卷回批", 32)}</strong>
          <p>{safePeopleText(resolution.outcomeSummary, "交游结果已回批。", 220)}</p>
        </article>
      ) : null}
    </section>
  );
}

function NpcActiveRequestInbox({
  requests,
  onDraft
}: {
  readonly requests: readonly NpcActiveRequestItemView[];
  readonly onDraft: (request: NpcActiveRequestItemView, option?: NpcActiveRequestResponseOptionView) => void;
}) {
  const visible = requests.slice(0, 3);
  if (!visible.length) return null;
  return (
    <section className="npcActiveRequestInbox" aria-label="人物主动请求">
      {visible.map((request) => {
        const canRespond = request.status === "active" || request.status === "deferred";
        const options = canRespond ? (request.responseOptions ?? []).slice(0, 3) : [];
        const followUp = request.outcome?.followUpView;
        return (
          <article className="inventoryMiniCard" key={request.requestId || request.title}>
            <strong>{safePeopleText(request.title, "来函", 48)}</strong>
            <span>{safePeopleText(request.ask, "请先查证来意。", 130)}</span>
            {followUp ? (
              <small>{safePeopleText(followUp.title || followUp.nextStep, "后续待复核。", 90)}</small>
            ) : null}
            <div className="buttonRow">
              {options.length ? options.map((option) => (
                <button
                  className="paperButton"
                  key={option.responseAction || option.label || "response"}
                  type="button"
                  onClick={() => onDraft(request, option)}
                >
                  {safePeopleText(option.shortLabel || option.label, "回应", 18)}
                </button>
              )) : canRespond ? (
                <button className="paperButton" type="button" onClick={() => onDraft(request)}>回应</button>
              ) : null}
              <small>{safePeopleText(request.status, "active", 32)} · {request.turnsRemaining ?? 0} 旬</small>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function NpcActiveRequestFollowUpDocket({
  tasks,
  onDraft
}: {
  readonly tasks: readonly NpcActiveRequestFollowUpTaskView[];
  readonly onDraft: (task: NpcActiveRequestFollowUpTaskView) => void;
}) {
  const visible = tasks.slice(0, 4);
  if (!visible.length) return null;
  return (
    <section className="npcActiveRequestInbox" aria-label="来函后续簿">
      {visible.map((task) => {
        const latestResolution = task.latestResolution && typeof task.latestResolution === "object"
          ? task.latestResolution as Record<string, unknown>
          : null;
        return (
          <article className="inventoryMiniCard" key={task.taskId || task.requestId || task.title}>
            <strong>{safePeopleText(task.title, "来函后续", 48)}</strong>
            <span>
              {safePeopleText(
                typeof latestResolution?.publicSummary === "string"
                  ? latestResolution.publicSummary
                  : task.publicSummary || task.nextStep,
                "此事只作公开后续复核。",
                140
              )}
            </span>
            <small>
              {safePeopleText(task.taskRouteLabel, "后续复核", 24)}
              {" · "}
              {safePeopleText(
                typeof latestResolution?.statusLabel === "string"
                  ? latestResolution.statusLabel
                  : task.statusLabel || task.status,
                "待续办",
                32
              )}
            </small>
            <div className="buttonRow">
              <button className="paperButton" type="button" onClick={() => onDraft(task)}>拟后续</button>
              <small>{safePeopleText(task.npc?.displayName, "来人", 32)}</small>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function NpcRecordsTab({
  interactions,
  trades,
  tasks
}: {
  readonly interactions: readonly { readonly recordId?: string; readonly dialogueText?: string; readonly actionType?: string; readonly serverStatus?: string }[];
  readonly trades: readonly TradeRecordView[];
  readonly tasks: readonly DelegatedTaskRecordView[];
}) {
  return (
    <section className="npcTabPanel npcRecordsGrid">
      <RecordList title="对话" items={interactions.slice(0, 4).map((record) => ({
        id: record.recordId || record.dialogueText || "dialogue",
        title: `${safePeopleText(record.actionType, "对话", 24)} · ${statusLabel(record.serverStatus)}`,
        body: safePeopleText(record.dialogueText, "无公开摘要。", 140)
      }))} />
      <RecordList title="交易" items={trades.slice(0, 4).map((record) => ({
        id: record.tradeId || record.offerSummary || "trade",
        title: statusLabel(record.status),
        body: safePeopleText(record.publicSummary || record.offerSummary, "无公开摘要。", 140)
      }))} />
      <RecordList title="委派" items={tasks.slice(0, 4).map((task) => ({
        id: task.taskId || task.title || "task",
        title: `${safePeopleText(task.title, "委派任务", 40)} · ${statusLabel(task.status)}`,
        body: task.assignee?.displayName ? `执行人：${safePeopleText(task.assignee.displayName, "未知", 32)}` : "执行人未题"
      }))} />
    </section>
  );
}

function RecordList({
  title,
  items
}: {
  readonly title: string;
  readonly items: readonly { readonly id: string; readonly title: string; readonly body: string }[];
}) {
  return (
    <section className="npcRecordList">
      <h3>{title}</h3>
      {items.length ? items.map((item) => (
        <article className="inventoryMiniCard" key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.body}</span>
        </article>
      )) : <p className="statusLine">暂无记录。</p>}
    </section>
  );
}
