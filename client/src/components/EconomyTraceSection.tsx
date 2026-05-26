import type { EconomyTraceItemView, EconomyTraceView } from "../api";
import { rewritePlayerFacingWorldText } from "../text/worldText";

type EconomyTraceSectionProps = {
  readonly traceView?: EconomyTraceView | null;
  readonly title?: string;
  readonly summaryFallback?: string;
  readonly idPrefix?: string;
  readonly maxItems?: number;
  readonly traceTypes?: readonly string[];
  readonly groups?: readonly string[];
  readonly runnable?: boolean;
  readonly onDraft?: (text: string) => void;
};

type SafeEconomyTraceItem = {
  readonly id: string;
  readonly title: string;
  readonly groupLabel: string;
  readonly statusLabel: string;
  readonly summary: string;
  readonly amountText?: string;
  readonly affectedLabels: readonly string[];
  readonly nextStep?: string;
};

type SafeItemsOptions = {
  readonly traceTypes?: readonly string[];
  readonly groups?: readonly string[];
};

const unsafeEconomyTraceFragments = [
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
  "assetLedger",
  "resourceLedger",
  "inventoryLedger",
  "tradeLedger",
  "delegatedTaskLedger",
  "marketPriceLedger",
  "npcEconomyLedger",
  "privateSignalTags",
  "hiddenDossier",
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
  "模型原文"
] as const;
const localEconomyTracePathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|mnt|users|private|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;

const economyTraceLabelMap: Record<string, string> = {
  asset_maintenance: "资产维护",
  delegated_task_budget: "委派预算",
  delegated_task_result: "委派回禀",
  human_debt_monthly: "人情债月账",
  inventory_condition: "囊箧保养",
  inventory_transfer: "物件移置",
  market_price_signal: "市价线索",
  monthly_economy_event: "月账事件",
  npc_relationship_monthly: "人物月账",
  resource_delta: "钱粮变化",
  resource_snapshot: "钱粮账面",
  trade_blocked: "交易未准",
  trade_expiry: "交易过期",
  trade_negotiation: "交易议价",
  under_review: "待复核",
  pending: "待复核",
  active: "可阅",
  resolved: "已归档",
  blocked: "暂未准行"
};

function normalizeTraceScalar(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function isUnsafeEconomyTraceText(value: unknown) {
  const text = normalizeTraceScalar(value);
  if (!text) return false;
  const lowered = text.toLowerCase();
  return localEconomyTracePathPattern.test(text) ||
    /[a-z]:[\\/]/i.test(text) ||
    /(?:file|https?):\/\//i.test(text) ||
    unsafeEconomyTraceFragments.some((fragment) => lowered.includes(fragment.toLowerCase()));
}

function cleanTraceText(value: unknown, fallback = "", maxLength = 132) {
  const text = normalizeTraceScalar(value);
  if (!text) return fallback;
  if (isUnsafeEconomyTraceText(text)) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}...` : rewritten;
}

function cleanTraceLabel(value: unknown, fallback = "", maxLength = 32) {
  const text = normalizeTraceScalar(value);
  if (!text) return fallback;
  if (isUnsafeEconomyTraceText(text)) return fallback;
  const key = text
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
  return cleanTraceText(economyTraceLabelMap[key] || text, fallback, maxLength);
}

function cleanList(values: unknown, maxItems = 3) {
  return (Array.isArray(values) ? values : [])
    .map((value) => cleanTraceText(value, "", 28))
    .filter(Boolean)
    .slice(0, maxItems) as string[];
}

function amountText(item: EconomyTraceItemView) {
  const amount = item.amountView;
  if (!amount) return "";
  const label = cleanTraceText(amount.label, "数值", 24);
  const unit = cleanTraceText(amount.unit, "", 10);
  const after = typeof amount.after === "number" ? `${amount.after}${unit}` : "";
  const before = typeof amount.before === "number" ? `${amount.before}${unit}` : "";
  const delta = typeof amount.delta === "number" ? `${amount.delta > 0 ? "+" : ""}${amount.delta}${unit}` : "";
  if (before && after && delta) return `${label} ${before} 至 ${after}（${delta}）`;
  if (after) return `${label} ${after}`;
  if (delta) return `${label} ${delta}`;
  return "";
}

function safeItems(
  traceView: EconomyTraceView | null | undefined,
  maxItems: number,
  options: SafeItemsOptions = {}
): SafeEconomyTraceItem[] {
  const traceTypeFilter = new Set(options.traceTypes ?? []);
  const groupFilter = new Set(options.groups ?? []);
  return ((traceView?.traceItems ?? []) as readonly EconomyTraceItemView[])
    .map((item, index) => {
      const traceType = cleanTraceText(item.traceType, "", 64);
      const group = cleanTraceText(item.group, "", 32);
      if (traceTypeFilter.size && !traceTypeFilter.has(traceType)) return null;
      if (groupFilter.size && !groupFilter.has(group)) return null;
      const title = cleanTraceText(item.title, "", 54);
      const summary = cleanTraceText(item.publicSummary, "", 150);
      const groupLabel = cleanTraceLabel(item.groupLabel || item.traceType, "经济解释", 24);
      const statusLabel = cleanTraceLabel(item.statusLabel || item.status, "可阅", 24);
      const nextStep = cleanTraceText(item.nextStep, "", 150);
      const labels = cleanList(item.affectedLabels);
      const amount = amountText(item);
      const coreFields = [
        item.title,
        item.publicSummary,
        item.groupLabel,
        item.group,
        item.traceType,
        item.statusLabel,
        item.status,
        item.nextStep,
        ...(Array.isArray(item.affectedLabels) ? item.affectedLabels : []),
        item.amountView?.label,
        item.amountView?.unit
      ];
      if (coreFields.some(isUnsafeEconomyTraceText) || (!title && !summary)) return null;
      return {
        id: cleanTraceText(item.traceId, `economy-trace-${index}`, 96),
        title: title || "经济解释",
        groupLabel,
        statusLabel,
        summary: summary || "此项只作公开解释，后续仍候案卷回批。",
        amountText: amount || undefined,
        affectedLabels: labels,
        nextStep: nextStep || undefined
      };
    })
    .filter(Boolean)
    .slice(0, maxItems) as SafeEconomyTraceItem[];
}

function draftFromItem(item: SafeEconomyTraceItem) {
  return `复核${item.title}：${item.nextStep || item.summary}；资源、物品、交易、委派、人情债和关系变化仍候案卷回批。`;
}

export function EconomyTraceSection({
  traceView,
  title = "经济解释",
  summaryFallback = "资源、资产、囊箧、交易、委派和月账解释只来自已公开卷宗；本页不成交、不扣款、不转物。",
  idPrefix = "economy-trace",
  maxItems = 6,
  traceTypes,
  groups,
  runnable = true,
  onDraft
}: EconomyTraceSectionProps) {
  const items = safeItems(traceView, maxItems, { traceTypes, groups });
  if (!items.length) return null;
  const canDraft = runnable !== false && Boolean(onDraft);
  const titleId = `${idPrefix}-title`;

  return (
    <section className="economyTraceSection" aria-labelledby={titleId} data-polish-evidence="s89-15-economy-reader">
      <div className="economyTraceHeader">
        <div>
          <p className="eyebrow">账本解释</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <span>{items.length} 条</span>
      </div>
      <p>{cleanTraceText(traceView?.summary, summaryFallback, 160)}</p>
      <div className="economyTraceGrid">
        {items.map((item) => (
          <article className="inventoryMiniCard economyTraceCard paperMotionCard paperMotionInteractive" key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.summary}</span>
            <small>{item.groupLabel} · {item.statusLabel}</small>
            {item.amountText ? <small>{item.amountText}</small> : null}
            {item.affectedLabels.length ? <small>关联：{item.affectedLabels.join("、")}</small> : null}
            {item.nextStep ? <small>后续：{item.nextStep}</small> : null}
            {onDraft ? (
              <button className="paperButton" type="button" disabled={!canDraft} onClick={() => onDraft(draftFromItem(item))}>
                拟复核
              </button>
            ) : null}
          </article>
        ))}
      </div>
      <p className="statusLine" data-polish-evidence-boundary="s89-15-economy-boundary">
        这里只读公开解释；拟复核只写案头草稿，资源、物品、交易、委派、人情债和关系变化仍候案卷回批。
      </p>
    </section>
  );
}
