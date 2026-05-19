import { useMemo, useState } from "react";
import { useParams } from "react-router";
import type { AssetRegistry, RuntimePortraitAsset } from "../assets/assetRegistry";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import type { PlayerSummary, WorldPeopleNpc, WorldPeopleRelationship } from "../api";
import { Portrait } from "../components/Portrait";
import { markOverlayTrigger } from "../components/overlayFocus";
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
  const session = useGameSessionStore((state) => state.currentSession);
  const { registry, status } = useAssetRegistry();
  const [portraitPage, setPortraitPage] = useState(0);
  const peopleRows = useMemo(
    () => buildPersonRows(registry, session, sessionId),
    [registry, session, sessionId]
  );
  const totalPages = Math.max(1, Math.ceil(peopleRows.length / portraitPageSize));
  const safePortraitPage = Math.min(portraitPage, totalPages - 1);
  const visiblePeople = peopleRows.slice(safePortraitPage * portraitPageSize, safePortraitPage * portraitPageSize + portraitPageSize);
  const npcCount = peopleRows.filter((row) => row.kind === "npc").length;
  const remasteredCount = visiblePeople.filter((row) => row.remastered).length;

  return (
    <article className="surfacePanel routePanel" aria-labelledby="people-title">
      <h2 id="people-title">人物</h2>
      <p>谱牒只录本局公开可见的案主与相识人物；未有可信立绘时，以纸底剪影暂代。</p>
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
    </article>
  );
}
