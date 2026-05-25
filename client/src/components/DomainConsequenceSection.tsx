import type { JsonObject, JsonValue } from "../api";
import { rewritePlayerFacingWorldText } from "../text/worldText";

type DomainConsequenceSectionProps = {
  readonly domainConsequenceView?: JsonObject | null;
  readonly sourceTypes?: readonly string[];
  readonly title?: string;
  readonly summaryFallback?: string;
  readonly emptyText?: string;
  readonly maxItems?: number;
  readonly runnable?: boolean;
  readonly onDraft: (text: string) => void;
};

type SafeConsequenceItem = {
  readonly id: string;
  readonly title: string;
  readonly meta?: string;
  readonly body?: string;
  readonly nextStep?: string;
};

type SafeDraftAction = {
  readonly id: string;
  readonly label: string;
  readonly text: string;
};

const unsafeDomainConsequenceFragments = [
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
  "sealed",
  "server adjudication",
  "ai read scope",
  "proposal boundary",
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
  "cityPolicyLedger",
  "militaryDiplomacyLedger",
  "judicialCaseLedger",
  "npcEconomyLedger",
  "event_archive_index",
  "prompt_retrieval_index",
  "safe_search_index",
  "safe_search_fts",
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
  "原始返回",
  "模型原文",
  "开发诊断"
] as const;

function isRecord(value: JsonValue | unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: JsonValue | unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function asArray(value: JsonValue | unknown): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function cleanDomainConsequenceText(value: unknown, fallback = "未载", maxLength = 124) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /(?:file|https?):\/\//i.test(text)) return fallback;
  if (unsafeDomainConsequenceFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}…` : rewritten;
}

function cleanOptionalText(value: unknown, maxLength = 124) {
  const cleaned = cleanDomainConsequenceText(value, "", maxLength);
  return cleaned || undefined;
}

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function sourceTypeAllowed(sourceType: string, allowedSourceTypes: readonly string[] | undefined) {
  return !allowedSourceTypes?.length || allowedSourceTypes.includes(sourceType);
}

function actionMatchesAllowedItem(action: SafeDraftAction, items: readonly SafeConsequenceItem[]) {
  if (!items.length) return false;
  const actionText = `${action.id} ${action.text}`.toLowerCase();
  return items.some((item) => {
    const hints = [item.id, item.title, item.nextStep].map((value) => value?.toLowerCase()).filter(Boolean);
    return hints.some((hint) => actionText.includes(hint || ""));
  });
}

function metricLabelText(value: JsonValue | unknown) {
  return asArray(value)
    .map((entry) => cleanOptionalText(entry, 18))
    .filter(Boolean)
    .slice(0, 4)
    .join("、");
}

function consequenceItems(view: JsonObject, allowedSourceTypes: readonly string[] | undefined, maxItems: number): SafeConsequenceItem[] {
  return asArray(view.recentConsequences)
    .map(asRecord)
    .filter((row) => sourceTypeAllowed(cleanDomainConsequenceText(row.sourceType, "", 48), allowedSourceTypes))
    .slice(-maxItems)
    .reverse()
    .map((row, index) => {
      const title = cleanDomainConsequenceText(row.title || row.kindLabel || row.sourceLabel, "领域后果", 58);
      const sourceLabel = cleanOptionalText(row.sourceLabel, 24);
      const kindLabel = cleanOptionalText(row.kindLabel || row.kind, 24);
      const statusLabel = cleanOptionalText(row.statusLabel || row.status, 28);
      const turn = row.generatedAtTurn === undefined ? undefined : `第${cleanNumber(row.generatedAtTurn, 0)}回`;
      const severity = row.severity === undefined ? undefined : `风险 ${cleanNumber(row.severity, 0)}`;
      const metrics = metricLabelText(row.affectedMetricLabels);
      return {
        id: cleanDomainConsequenceText(row.id || row.sourceId || `domain-consequence-${index}`, `domain-consequence-${index}`, 88),
        title,
        meta: cleanOptionalText([sourceLabel, kindLabel, statusLabel, turn, severity].filter(Boolean).join(" · "), 96),
        body: cleanOptionalText(row.publicSummary || row.summary, 156) || (metrics ? `影响：${metrics}` : undefined),
        nextStep: cleanOptionalText(row.nextStep, 168)
      };
    })
    .filter((item) => item.title !== "领域后果" || item.body || item.nextStep);
}

function draftActions(view: JsonObject, items: readonly SafeConsequenceItem[], allowedSourceTypes: readonly string[] | undefined): SafeDraftAction[] {
  const allowedRows = asArray(view.recentConsequences).map(asRecord)
    .filter((row) => sourceTypeAllowed(cleanDomainConsequenceText(row.sourceType, "", 48), allowedSourceTypes));
  if (allowedSourceTypes?.length && !allowedRows.length) return [];
  const allowedIds = new Set(allowedRows.map((row) => cleanDomainConsequenceText(row.id, "", 88)).filter(Boolean));
  const explicitActions = asArray(view.nextActions)
    .map(asRecord)
    .map((action, index) => ({
      id: cleanDomainConsequenceText(action.id, `domain-consequence-action-${index}`, 88),
      label: cleanDomainConsequenceText(action.label, "续记后果", 24),
      text: cleanDomainConsequenceText(action.text, "", 176)
    }))
    .filter((action) => action.text)
    .filter((action) => {
      if (!items.length) return false;
      if (allowedIds.size && [...allowedIds].some((id) => items.some((item) => item.id === id) && action.id.includes(id))) return true;
      return actionMatchesAllowedItem(action, items);
    });

  if (explicitActions.length) return explicitActions.slice(0, 3);

  return items
    .filter((item) => item.nextStep)
    .slice(0, 2)
    .map((item, index) => ({
      id: `domain-consequence-next-${index}`,
      label: "续记后果",
      text: item.nextStep || ""
    }));
}

function capSummaryText(view: JsonObject) {
  const caps = asRecord(view.caps);
  const visible = cleanNumber(caps.visibleConsequences, 0);
  const candidates = cleanNumber(caps.publicCandidates, visible);
  if (!visible && !candidates) return undefined;
  if (caps.capped === true && candidates > visible) {
    return `当前显示近次 ${visible} 条，较早 ${candidates - visible} 条已按公开上限收束。`;
  }
  return `当前公开追踪 ${visible} 条。`;
}

export function DomainConsequenceSection({
  domainConsequenceView,
  sourceTypes,
  title = "领域后果追踪",
  summaryFallback = "领域后果只读已经入卷的公开余波；财政、军务、刑名、人物经济和关系变化仍逐旬或月结回响。",
  emptyText = "暂无公开领域后果；不得从内部账本、隐藏证据或模型提案补造事实。",
  maxItems = 4,
  runnable = true,
  onDraft
}: DomainConsequenceSectionProps) {
  const view = asRecord(domainConsequenceView);
  const items = consequenceItems(view, sourceTypes, maxItems);
  const actions = draftActions(view, items, sourceTypes);
  const capLine = capSummaryText(view);
  const canDraft = runnable !== false;

  return (
    <article className="scholarPanelCard domainConsequenceSection" aria-labelledby={`${title.replace(/\s+/g, "-")}-title`}>
      <h3 id={`${title.replace(/\s+/g, "-")}-title`}>{title}</h3>
      <p>{cleanDomainConsequenceText(view.summary, summaryFallback, 164)}</p>
      {capLine ? <p className="domainConsequenceCapLine">{capLine}</p> : null}
      {items.length ? (
        <ul className="scholarPanelList domainConsequenceList">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              {item.meta ? <span>{item.meta}</span> : null}
              {item.body ? <p>{item.body}</p> : null}
              {item.nextStep ? <p>后续：{item.nextStep}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="scholarPanelEmpty">{emptyText}</p>
      )}
      <div className="scholarPanelActions domainConsequenceActions">
        {actions.map((action) => (
          <button key={action.id} type="button" disabled={!canDraft} onClick={() => onDraft(action.text)}>
            {action.label}
          </button>
        ))}
      </div>
      <p className="domainConsequenceBoundary">只写草稿，不直接结案、调兵、拨款、成交交易、改人物资产或写入后果。</p>
    </article>
  );
}
