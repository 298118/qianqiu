import type { JsonObject, JsonValue, NpcActiveRequestFollowUpEvidenceGroupView, NpcActiveRequestFollowUpEvidenceView } from "../api";
import { rewritePlayerFacingWorldText } from "../text/worldText";

type NpcFollowUpEvidenceSectionProps = {
  readonly evidence?: NpcActiveRequestFollowUpEvidenceGroupView | null;
  readonly title?: string;
  readonly summaryFallback?: string;
  readonly boundaryText?: string;
  readonly idPrefix?: string;
  readonly maxItems?: number;
  readonly runnable?: boolean;
  readonly onDraft?: (text: string) => void;
};

type SafeFollowUpEvidenceItem = {
  readonly id: string;
  readonly title: string;
  readonly groupLabel: string;
  readonly kindLabel: string;
  readonly statusLabel: string;
  readonly summary: string;
  readonly nextStep?: string;
  readonly npcName: string;
  readonly riskTags: readonly string[];
};

const followUpEvidenceGroups = [
  { key: "people", label: "人物与引荐" },
  { key: "economy", label: "月账与人情" },
  { key: "events", label: "案牍与风宪" }
] as const;

const npcEvidenceLabelMap: Record<string, string> = {
  accepted_pending_server_resolution: "已收呈待复核",
  betrayal_risk: "背叛风险",
  converted_to_risk: "转作风险留察",
  deferred: "暂缓候复",
  human_debt: "人情债月账",
  human_debt_monthly: "人情债月账",
  integrity_watchlist: "廉政留察",
  introduction: "引荐拜会",
  petition_case: "请托案牍",
  referral_meeting: "引荐拜会",
  relationship_risk_watchlist: "关系风险留察",
  reported: "已呈报",
  strategy_evidence: "献策证据",
  under_review: "待复核",
  watchlist: "留察名单"
};

const unsafeNpcEvidenceFragments = [
  "provider",
  "proposal",
  "raw",
  "prompt",
  "path",
  "key",
  "draftContext",
  "schema",
  "manifest",
  "hidden",
  "private",
  "sealed",
  "server adjudication",
  "ai read scope",
  "proposal boundary",
  "safe view",
  "resolver",
  "sqlite",
  "sql",
  "localstorage",
  "sessionstorage",
  "data/sessions",
  "data\\sessions",
  "stateDelta",
  "state_delta",
  "playerDelta",
  "player_delta",
  "evidenceRefs",
  "evidence_refs",
  "outcomeId",
  "outcome_id",
  "auditRecord",
  "audit_record",
  "statePatch",
  "worldState",
  "npcActiveRequestLedger",
  "npc_active_request_ledger",
  "privateSignalTags",
  "private_signal_tags",
  "hiddenDossier",
  "hidden_dossier",
  "safe_search_index",
  "world_sessions",
  "world_state_json",
  "api_key",
  "apikey",
  "sk-",
  "tp-",
  "完整提示词",
  "提示词",
  "本地路径",
  "密钥",
  "隐藏",
  "私档",
  "密档",
  "原始返回",
  "模型原文",
  "开发诊断"
] as const;
const localNpcEvidencePathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|mnt|users|private|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;

function isRecord(value: JsonValue | unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEvidenceScalar(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function isUnsafeNpcEvidenceText(value: unknown) {
  const text = normalizeEvidenceScalar(value);
  if (!text) return false;
  const lowered = text.toLowerCase();
  return localNpcEvidencePathPattern.test(text) ||
    /[a-z]:[\\/]/i.test(text) ||
    /(?:file|https?):\/\//i.test(text) ||
    unsafeNpcEvidenceFragments.some((fragment) => lowered.includes(fragment.toLowerCase()));
}

function cleanNpcEvidenceText(value: unknown, fallback = "未载", maxLength = 132) {
  const text = normalizeEvidenceScalar(value);
  if (!text) return fallback;
  if (isUnsafeNpcEvidenceText(text)) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}…` : rewritten;
}

function cleanNpcEvidenceLabel(value: unknown, fallback = "未载", maxLength = 40) {
  const text = normalizeEvidenceScalar(value);
  if (!text) return fallback;
  if (isUnsafeNpcEvidenceText(text)) return fallback;
  const key = text
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
  return cleanNpcEvidenceText(npcEvidenceLabelMap[key] || text, fallback, maxLength);
}

function cleanOptionalText(value: unknown, maxLength = 96) {
  const cleaned = cleanNpcEvidenceText(value, "", maxLength);
  return cleaned || undefined;
}

function groupedEvidence(evidence: NpcActiveRequestFollowUpEvidenceGroupView | null | undefined, maxItems: number): SafeFollowUpEvidenceItem[] {
  return followUpEvidenceGroups.flatMap((group) => (
    ((evidence?.[group.key] ?? []) as readonly NpcActiveRequestFollowUpEvidenceView[])
      .map((item, index) => {
        const npc = isRecord(item.npc) ? item.npc : {};
        const title = cleanNpcEvidenceText(item.title, "来函线索", 58);
        const kindLabel = cleanNpcEvidenceLabel(item.evidenceKindLabel || item.taskRouteLabel, "后续证据", 30);
        const statusLabel = cleanNpcEvidenceLabel(item.statusLabel || item.status, "待复核", 30);
        const summary = cleanNpcEvidenceText(item.publicSummary || item.summary || item.nextStep, "此线索只供公开后续复核。", 156);
        const nextStep = cleanOptionalText(item.nextStep, 168);
        const npcName = cleanNpcEvidenceText(npc.displayName, "来人", 36);
        const coreFields = [
          item.title,
          item.evidenceKindLabel,
          item.taskRouteLabel,
          item.statusLabel,
          item.status,
          item.publicSummary,
          item.summary,
          item.nextStep,
          npc.displayName
        ];
        const hasUnsafeCore = coreFields.some(isUnsafeNpcEvidenceText);
        const hasMeaningfulCore =
          title !== "来函线索" ||
          kindLabel !== "后续证据" ||
          summary !== "此线索只供公开后续复核。";
        if (hasUnsafeCore || !hasMeaningfulCore) return null;
        return {
          id: cleanNpcEvidenceText(item.evidenceId || item.requestId || `${group.key}-${index}`, `${group.key}-${index}`, 96),
          title,
          groupLabel: group.label,
          kindLabel,
          statusLabel,
          summary,
          nextStep,
          npcName,
          riskTags: (item.riskTags ?? [])
            .map((tag) => cleanNpcEvidenceLabel(tag, "", 24))
            .filter(Boolean)
            .slice(0, 3) as string[]
        };
      })
      .filter(Boolean) as SafeFollowUpEvidenceItem[]
  )).slice(0, maxItems);
}

function totalEvidenceCount(evidence: NpcActiveRequestFollowUpEvidenceGroupView | null | undefined, visibleCount: number) {
  const counts = isRecord(evidence?.counts) ? evidence.counts : null;
  const value = counts?.total;
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return Number.parseInt(value, 10);
  return visibleCount;
}

function draftTextFromEvidence(item: SafeFollowUpEvidenceItem) {
  return `复核${item.kindLabel}：${item.nextStep || item.summary}；只据公开材料拟成后续呈词，资源、人情债、婚姻、弹劾、定罪、背叛和未公开事实仍候案卷回批。`;
}

export function NpcFollowUpEvidenceSection({
  evidence,
  title = "来函线索与风宪留察",
  summaryFallback = "主动来函后续线索只来自已公开卷宗，可用于拟稿、查证和公开复核；资源、关系、婚姻、弹劾、定罪、背叛和未公开事实仍候案卷回批。",
  boundaryText = "这里只读公开线索；后续结果仍回主卷候复。",
  idPrefix = "npc-follow-up-evidence",
  maxItems = 8,
  runnable = true,
  onDraft
}: NpcFollowUpEvidenceSectionProps) {
  const items = groupedEvidence(evidence, maxItems);
  if (!items.length) return null;
  const total = totalEvidenceCount(evidence, items.length);
  const canDraft = runnable !== false && Boolean(onDraft);
  const titleId = `${idPrefix}-title`;

  return (
    <article className="scholarPanelCard npcFollowUpEvidenceSection" aria-labelledby={titleId} data-polish-evidence="s89-15-follow-up-reader">
      <div className="npcFollowUpEvidenceHeader">
        <div>
          <p className="eyebrow">来函线索</p>
          <h3 id={titleId}>{title}</h3>
        </div>
        <span>{total} 条</span>
      </div>
      <p>{cleanNpcEvidenceText(summaryFallback, "主动来函后续证据只读展示。", 172)}</p>
      <div className="npcFollowUpEvidenceGrid">
        {items.map((item) => (
          <article className="inventoryMiniCard paperMotionCard paperMotionInteractive" key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.summary}</span>
            <small>{item.groupLabel} · {item.kindLabel} · {item.statusLabel}</small>
            {item.riskTags.length ? <small>标记：{item.riskTags.join("、")}</small> : null}
            {item.nextStep ? <small>后续：{item.nextStep}</small> : null}
            <div className="buttonRow">
              {onDraft ? (
                <button className="paperButton" type="button" disabled={!canDraft} onClick={() => onDraft(draftTextFromEvidence(item))}>
                  拟复核
                </button>
              ) : null}
              <small>{item.npcName}</small>
            </div>
          </article>
        ))}
      </div>
      <p className="npcFollowUpEvidenceBoundary">{cleanNpcEvidenceText(boundaryText, "这里只读公开线索；后续结果仍回主卷候复。", 172)}</p>
      <p className="statusLine" data-polish-evidence-boundary="s89-15-follow-up-boundary">
        只读公开线索；拟复核只写案头草稿，不结算人情债、关系终局或未公开事实。
      </p>
    </article>
  );
}
