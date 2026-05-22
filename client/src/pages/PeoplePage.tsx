import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import type { AssetRegistry, RuntimePortraitAsset } from "../assets/assetRegistry";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import type { DelegatedTaskRecordView, NpcActiveRequestItemView, NpcActiveRequestResponseOptionView, NpcDetailView, NpcRosterItem, PlayerSummary, TradeRecordView, WorldPeopleNpc, WorldPeopleRelationship } from "../api";
import { Portrait } from "../components/Portrait";
import { markOverlayTrigger } from "../components/overlayFocus";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";

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

type PersonRow = {
  readonly id: string;
  readonly kind: "player" | "npc";
  readonly name: string;
  readonly identity: string;
  readonly summary: string;
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

function safePeopleText(value: unknown, fallback: string, maxLength = 120) {
  const text = typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : fallback;
  const normalized = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /sk-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (unsafePeopleTextFragments.some((fragment) => normalized.includes(fragment.toLowerCase()))) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
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
    server_blocked: "服务器挡下"
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
    rows.push({
      id: "player",
      kind: "player",
      name: safePeopleText(player.name, "无名", 40),
      identity: getPlayerIdentity(player),
      summary: "案主立绘只使用已审核 portraitRef；若未选立绘，则按身份取公开占位。",
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
    rows.push({
      id: npc.id,
      kind: "npc",
      name: safePeopleText(npc.name, "无名人物", 40),
      identity: safePeopleText(npc.rankLabel || npc.genderLabel, "公开人物", 40),
      summary: safePeopleText(npc.publicSummary, "暂无公开小传。", 120),
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
  const openSurface = useUiStateStore((state) => state.openSurface);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const session = useGameSessionStore((state) => state.currentSession);
  const loadNpcs = useGameSessionStore((state) => state.loadNpcs);
  const loadNpcDetail = useGameSessionStore((state) => state.loadNpcDetail);
  const interactWithNpc = useGameSessionStore((state) => state.interactWithNpc);
  const submitTrade = useGameSessionStore((state) => state.submitTrade);
  const submitNpcCommand = useGameSessionStore((state) => state.submitNpcCommand);
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
  const runnable = isRunnableSessionId(sessionId);

  useEffect(() => {
    if (!runnable) return;
    void loadNpcs(sessionId, { pageSize: 50 }).catch(() => undefined);
  }, [loadNpcs, runnable, sessionId]);

  const rosterView = npcRosterPayload?.sessionId === sessionId
    ? npcRosterPayload.npcRosterView
    : session?.sessionId === sessionId
      ? session.npcRosterView
      : null;
  const rosterNpcs = useMemo(
    () => (rosterView?.items ?? []).map((npc) => toWorkbenchNpc(registry, npc)),
    [registry, rosterView]
  );
  const npcGroups = useMemo(() => groupNpcs(rosterNpcs), [rosterNpcs]);
  const selectedNpc = rosterNpcs.find((npc) => npc.npcId === selectedNpcId) ?? rosterNpcs[0] ?? null;

  useEffect(() => {
    if (!selectedNpcId && rosterNpcs[0]) setSelectedNpcId(rosterNpcs[0].npcId);
  }, [rosterNpcs, selectedNpcId]);

  useEffect(() => {
    if (!runnable || !selectedNpc?.npcId) return;
    void loadNpcDetail(sessionId, selectedNpc.npcId).catch(() => undefined);
  }, [loadNpcDetail, runnable, selectedNpc?.npcId, sessionId]);

  const peopleRows = useMemo(
    () => buildPersonRows(registry, session, sessionId),
    [registry, session, sessionId]
  );
  const totalPages = Math.max(1, Math.ceil(peopleRows.length / portraitPageSize));
  const safePortraitPage = Math.min(portraitPage, totalPages - 1);
  const visiblePeople = peopleRows.slice(safePortraitPage * portraitPageSize, safePortraitPage * portraitPageSize + portraitPageSize);
  const npcCount = peopleRows.filter((row) => row.kind === "npc").length;
  const remasteredCount = visiblePeople.filter((row) => row.remastered).length;
  const npcDetail = npcDetailPayload?.sessionId === sessionId && npcDetailPayload.npcDetailView.npcId === selectedNpc?.npcId
    ? npcDetailPayload.npcDetailView
    : null;
  const interactionRecords = npcDetailPayload?.sessionId === sessionId
    ? npcDetailPayload.npcInteractionView?.items ?? npcRosterPayload?.npcInteractionView?.items ?? session?.npcInteractionView?.items ?? []
    : session?.npcInteractionView?.items ?? [];
  const tradeRecords = npcDetailPayload?.sessionId === sessionId
    ? npcDetailPayload.tradeLedgerView?.items ?? session?.tradeLedgerView?.items ?? []
    : session?.tradeLedgerView?.items ?? [];
  const delegatedTasks = npcDetailPayload?.sessionId === sessionId
    ? npcDetailPayload.delegatedTaskView?.items ?? npcRosterPayload?.delegatedTaskView?.items ?? session?.delegatedTaskView?.items ?? []
    : session?.delegatedTaskView?.items ?? [];

  async function handleDialogueSubmit() {
    if (!selectedNpc || !dialogueDraft.trim() || !runnable) return;
    await interactWithNpc(sessionId, {
      npcId: selectedNpc.npcId,
      actionType: "talk",
      utterance: dialogueDraft.trim()
    }).then(() => setDialogueDraft("")).catch(() => undefined);
  }

  async function handleTradeSubmit() {
    if (!selectedNpc || !tradeOffer.trim() || !runnable) return;
    await submitTrade(sessionId, {
      npcId: selectedNpc.npcId,
      tradeId: `trade:${selectedNpc.npcId}:${Date.now()}`,
      silverDelta: Number.parseInt(tradeSilverDelta, 10) || 0,
      offerSummary: tradeOffer.trim()
    }).then(() => setTradeOffer("")).catch(() => undefined);
  }

  async function handleCommandSubmit() {
    if (!selectedNpc || !commandText.trim() || !runnable) return;
    await submitNpcCommand(sessionId, {
      assigneeActorId: selectedNpc.npcId,
      taskType: "land_survey",
      authoritySource: "yamen_authority",
      targetRef: commandTargetRef.trim() || "geo:county:current",
      commandText: commandText.trim(),
      budget: Number.parseInt(commandBudget, 10) || 0
    }).then(() => setCommandText("")).catch(() => undefined);
  }

  async function handleSocialSubmit(actionType: string) {
    if (!selectedNpc || !runnable) return;
    await interactWithNpc(sessionId, {
      npcId: selectedNpc.npcId,
      actionType,
      utterance: socialDraft.trim() || `${actionLabel(actionType)}${selectedNpc.displayName}，请服务器按礼法与身份裁决。`
    }).then(() => setSocialDraft("")).catch(() => undefined);
  }

  return (
    <article className="surfacePanel routePanel peopleWorkbenchPanel" aria-labelledby="people-title">
      <div className="routePanelHeader">
        <div>
          <p className="eyebrow">NPC 工作台</p>
          <h1 id="people-title">人物</h1>
          <p>名册、详情、对话、交易和委派均来自服务器安全视图；本页不读取私档、底价、模型上下文或内部账本。</p>
        </div>
        <span>{npcRosterStatus === "loading" ? "候谱" : `${rosterNpcs.length || npcCount} 人`}</span>
      </div>
      <NpcActiveRequestInbox
        requests={(session?.npcActiveRequestView?.items ?? []) as readonly NpcActiveRequestItemView[]}
        onDraft={(request, option) => setActionDraft({
          source: "role-surface",
          targetPage: "game",
          text: safePeopleText(
            option?.draftText,
            `回应${safePeopleText(request.typeLabel, "请托", 20)}：先查证${safePeopleText(request.npc?.displayName, "来人", 32)}所言，凡资源、关系、婚姻、弹劾或背叛结果均候服务器裁决。`,
            180
          )
        })}
      />
      <section className="npcWorkbench" aria-label="NPC 名册工作台">
        <aside className="npcGroupList" aria-label="NPC 分组">
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
                    setSelectedNpcId(npc.npcId);
                    setActiveTab("profile");
                  }}
                >
                  {registry ? (
                    <Portrait registry={registry} portraitRef={npc.portraitRef} label={`${npc.displayName}立绘`} className="npcListPortrait" />
                  ) : <span className="npcListPortraitFallback" aria-hidden="true">人</span>}
                  <span>
                    <strong>{npc.displayName}</strong>
                    <small>{npc.title}</small>
                  </span>
                </button>
              ))}
            </section>
          )) : <p className="statusLine">等待服务器 NPC 名册安全视图。</p>}
        </aside>
        <section className="npcDetailWorkbench" aria-label="NPC 详情">
          {selectedNpc ? (
            <>
              <div className="npcDetailHeader">
                {registry ? (
                  <Portrait registry={registry} portraitRef={selectedNpc.portraitRef} label={`${selectedNpc.displayName}立绘`} className="peoplePortrait" />
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
                  loading={npcDetailStatus === "loading"}
                  onDraft={() => setActionDraft({
                    source: "role-surface",
                    targetPage: "game",
                    text: `拜访${selectedNpc.displayName}，询问${selectedNpc.title}近况。`
                  })}
                />
              ) : null}
              {activeTab === "dialogue" ? (
                <NpcDialogueTab
                  dialogueDraft={dialogueDraft}
                  latestDialogue={lastNpcInteraction?.npcDialogueView}
                  records={interactionRecords}
                  busy={npcMutationStatus === "loading"}
                  onDraftChange={setDialogueDraft}
                  onSubmit={handleDialogueSubmit}
                />
              ) : null}
              {activeTab === "trade" ? (
                <NpcTradeTab
                  offer={tradeOffer}
                  silverDelta={tradeSilverDelta}
                  records={tradeRecords}
                  latestTrade={lastTrade?.tradeRecord}
                  busy={npcMutationStatus === "loading"}
                  onOfferChange={setTradeOffer}
                  onSilverDeltaChange={setTradeSilverDelta}
                  onSubmit={handleTradeSubmit}
                />
              ) : null}
              {activeTab === "command" ? (
                <NpcCommandTab
                  commandText={commandText}
                  targetRef={commandTargetRef}
                  budget={commandBudget}
                  tasks={delegatedTasks}
                  latestPlan={lastNpcCommand?.delegatedTaskPlanView}
                  busy={npcMutationStatus === "loading"}
                  onCommandTextChange={setCommandText}
                  onTargetRefChange={setCommandTargetRef}
                  onBudgetChange={setCommandBudget}
                  onSubmit={handleCommandSubmit}
                />
              ) : null}
              {activeTab === "social" ? (
                <NpcSocialTab
                  selectedNpc={selectedNpc}
                  detail={npcDetail}
                  draft={socialDraft}
                  latestResolution={lastNpcInteraction?.npcActionResolutionView}
                  busy={npcMutationStatus === "loading"}
                  onDraftChange={setSocialDraft}
                  onSubmit={handleSocialSubmit}
                />
              ) : null}
              {activeTab === "records" ? (
                <NpcRecordsTab interactions={interactionRecords} trades={tradeRecords} tasks={delegatedTasks} />
              ) : null}
            </>
          ) : <p className="statusLine">请选择一名可见 NPC。</p>}
        </section>
      </section>
      <section className="portraitLedger" aria-label="本局人物谱牒">
        <div className="portraitLedgerHeader">
          <div>
            <h3>人物谱牒</h3>
            <p>
              {peopleRows.length
                ? `当前入谱 ${peopleRows.length} 人，NPC ${npcCount} 人；本页 ${remasteredCount} 张使用高清重制。`
                : "正在等待服务器公开人物视图。"}
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
              <article className="peopleCard" key={`${person.kind}-${person.id}`} data-person-kind={person.kind}>
                {registry ? (
                  <Portrait
                    registry={registry}
                    portraitRef={person.portraitRef}
                    label={`${person.name}立绘`}
                    className="peoplePortrait"
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
          <p className="statusLine">暂无可显示人物；本页不会从全量素材池补齐人物。</p>
        )}
        {peopleRows.length > portraitPageSize ? (
          <div className="buttonRow" aria-label="人物分页">
            <button className="paperButton" type="button" disabled={safePortraitPage <= 0} onClick={() => setPortraitPage((page) => Math.max(0, page - 1))}>
              上一组
            </button>
            <button className="paperButton" type="button" disabled={safePortraitPage >= totalPages - 1} onClick={() => setPortraitPage((page) => Math.min(totalPages - 1, page + 1))}>
              下一组
            </button>
          </div>
        ) : null}
      </section>
      <button className="paperButton" type="button" onClick={(event) => { markOverlayTrigger(event.currentTarget); openSurface("npc-profile"); }}>
        打开人物档案
      </button>
      {error ? <p className="statusLine" role="alert">{error}</p> : null}
    </article>
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
          <p>{safePeopleText(latestTrade.publicSummary || latestTrade.npcResponse, "交易已回传服务器裁决。", 180)}</p>
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
          目标 ref
          <input value={targetRef} onChange={(event) => onTargetRefChange(event.target.value)} placeholder="geo:county:current" />
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
              <span>{available ? "可呈请服务器裁决" : blockers.join("；") || "暂不可用"}</span>
              <button className="paperButton" type="button" disabled={!available || busy} onClick={() => onSubmit(actionType)}>
                {safePeopleText(action.requestLabel, "呈请", 24)}
              </button>
            </article>
          );
        }) : <p className="statusLine">等待服务器礼法扩展位。</p>}
      </div>
      {resolution ? (
        <article className="npcResultCard">
          <strong>{safePeopleText(resolution.actionLabel, "服务器裁决", 32)}</strong>
          <p>{safePeopleText(resolution.outcomeSummary, "交游结果已由服务器返回。", 220)}</p>
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
    <section className="npcActiveRequestInbox" aria-label="NPC 主动请求">
      {visible.map((request) => {
        const canRespond = request.status === "active" || request.status === "deferred";
        const options = canRespond ? (request.responseOptions ?? []).slice(0, 3) : [];
        const followUp = request.outcome?.followUpView;
        return (
          <article className="inventoryMiniCard" key={request.requestId || request.title}>
            <strong>{safePeopleText(request.title, "来函", 48)}</strong>
            <span>{safePeopleText(request.ask, "请先查证来意。", 130)}</span>
            {followUp ? (
              <small>{safePeopleText(followUp.title || followUp.nextStep, "后续由服务器复核。", 90)}</small>
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
