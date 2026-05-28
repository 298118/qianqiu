import type { JsonObject, JsonValue } from "../api";
import { rewritePlayerFacingWorldText } from "../text/worldText";

type DomainConsequenceSectionProps = {
  readonly domainConsequenceView?: JsonObject | null;
  readonly sourceTypes?: readonly string[];
  readonly title?: string;
  readonly summaryFallback?: string;
  readonly emptyText?: string;
  readonly maxItems?: number;
  readonly localDraftWritten?: boolean;
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

type DomainConsequenceReaderRow = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

type DomainConsequenceReader = {
  readonly state: "empty" | "ready" | "written";
  readonly rows: readonly DomainConsequenceReaderRow[];
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

const sourceTypeLabels: Record<string, string> = {
  city_policy: "地方",
  military_diplomacy: "军务",
  judicial_case: "刑名",
  npc_economy: "人物"
};

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

function visibleConsequenceRows(view: JsonObject, allowedSourceTypes: readonly string[] | undefined) {
  return asArray(view.recentConsequences)
    .map(asRecord)
    .filter((row) => sourceTypeAllowed(cleanDomainConsequenceText(row.sourceType, "", 48), allowedSourceTypes));
}

function uniqueVisibleLabels(labels: readonly (string | undefined)[], limit = 4) {
  return [...new Set(labels.filter((label): label is string => Boolean(label)))].slice(0, limit);
}

function consequenceSourceLabels(view: JsonObject, allowedSourceTypes: readonly string[] | undefined) {
  return uniqueVisibleLabels(
    visibleConsequenceRows(view, allowedSourceTypes).map((row) => (
      cleanOptionalText(row.sourceLabel || row.kindLabel || row.kind, 24)
    ))
  );
}

function consequenceDomainLabels(view: JsonObject, allowedSourceTypes: readonly string[] | undefined) {
  return uniqueVisibleLabels(
    visibleConsequenceRows(view, allowedSourceTypes).map((row) => {
      const sourceType = cleanDomainConsequenceText(row.sourceType, "", 48);
      return sourceTypeLabels[sourceType] || cleanOptionalText(row.sourceLabel || row.kindLabel, 20);
    })
  );
}

function consequenceMetricLabels(view: JsonObject, allowedSourceTypes: readonly string[] | undefined) {
  const labels: string[] = [];
  for (const row of visibleConsequenceRows(view, allowedSourceTypes)) {
    for (const label of asArray(row.affectedMetricLabels)) {
      const cleaned = cleanOptionalText(label, 18);
      if (cleaned && !labels.includes(cleaned)) labels.push(cleaned);
      if (labels.length >= 4) return labels;
    }
  }
  return labels;
}

function consequenceItems(view: JsonObject, allowedSourceTypes: readonly string[] | undefined, maxItems: number): SafeConsequenceItem[] {
  return visibleConsequenceRows(view, allowedSourceTypes)
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
  const allowedRows = visibleConsequenceRows(view, allowedSourceTypes);
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

function buildDomainConsequenceReader({
  items,
  actions,
  sourceLabels,
  domainLabels,
  metricLabels,
  capLine,
  localDraftWritten
}: {
  readonly items: readonly SafeConsequenceItem[];
  readonly actions: readonly SafeDraftAction[];
  readonly sourceLabels: readonly string[];
  readonly domainLabels: readonly string[];
  readonly metricLabels: readonly string[];
  readonly capLine?: string;
  readonly localDraftWritten: boolean;
}): DomainConsequenceReader {
  const hasVisibleMaterial = Boolean(items.length || actions.length || sourceLabels.length || domainLabels.length || metricLabels.length || capLine);
  const state = localDraftWritten ? "written" : hasVisibleMaterial ? "ready" : "empty";
  return {
    state,
    rows: [
      {
        id: "consequences",
        label: "后果",
        value: items.length ? `${items.length} 条公开余波` : "暂无近波",
        detail: capLine || "只读已经入卷的公开后果；案卷未载者不补造。"
      },
      {
        id: "evidence",
        label: "凭据",
        value: sourceLabels.length ? `${sourceLabels.length} 类来源` : "来源候载",
        detail: sourceLabels.length ? sourceLabels.join("、") : "只据公开来源标签，不读取内账或隐藏凭据。"
      },
      {
        id: "domains",
        label: "牵连",
        value: domainLabels.length ? domainLabels.join("、") : "牵连候载",
        detail: metricLabels.length ? `影响：${metricLabels.join("、")}` : "地方、军务、刑名、人物等公开域仍候主卷复核。"
      },
      {
        id: "reply",
        label: "候复",
        value: localDraftWritten ? "主卷待呈" : actions.length ? `${actions.length} 项可拟` : "候主卷",
        detail: localDraftWritten
          ? "本页草稿已入底部奏折，仍候主卷回音。"
          : "只作复盘与呈稿线索；不回显正文，不写成已裁决事实。"
      }
    ]
  };
}

function sectionSummaryText(
  view: JsonObject,
  allowedSourceTypes: readonly string[] | undefined,
  summaryFallback: string,
  domainLabels: readonly string[]
) {
  if (!allowedSourceTypes?.length) return cleanDomainConsequenceText(view.summary, summaryFallback, 164);
  const visibleRows = visibleConsequenceRows(view, allowedSourceTypes);
  if (!visibleRows.length) return cleanDomainConsequenceText(summaryFallback, summaryFallback, 164);
  const scope = domainLabels.length ? `${domainLabels.join("、")}公开后果` : "当前范围公开后果";
  return `本页只并列 ${visibleRows.length} 条${scope}；未匹配领域不在此处补写。`;
}

function capSummaryText(view: JsonObject, allowedSourceTypes: readonly string[] | undefined, maxItems: number) {
  if (allowedSourceTypes?.length) {
    const scopedCount = visibleConsequenceRows(view, allowedSourceTypes).length;
    if (!scopedCount) return undefined;
    const shown = Math.min(scopedCount, maxItems);
    if (scopedCount > shown) {
      return `当前显示本页近次 ${shown} 条，可见范围另有 ${scopedCount - shown} 条按本页上限收束。`;
    }
    return `当前本页公开追踪 ${scopedCount} 条。`;
  }
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
  localDraftWritten = false,
  runnable = true,
  onDraft
}: DomainConsequenceSectionProps) {
  const view = asRecord(domainConsequenceView);
  const items = consequenceItems(view, sourceTypes, maxItems);
  const actions = draftActions(view, items, sourceTypes);
  const sourceLabels = consequenceSourceLabels(view, sourceTypes);
  const domainLabels = consequenceDomainLabels(view, sourceTypes);
  const metricLabels = consequenceMetricLabels(view, sourceTypes);
  const summaryText = sectionSummaryText(view, sourceTypes, summaryFallback, domainLabels);
  const capLine = capSummaryText(view, sourceTypes, maxItems);
  const readerCapLine = items.length ? capLine : undefined;
  const consequenceReader = buildDomainConsequenceReader({
    items,
    actions,
    sourceLabels,
    domainLabels,
    metricLabels,
    capLine: readerCapLine,
    localDraftWritten
  });
  const canDraft = runnable !== false;

  return (
    <article className="scholarPanelCard paperMotionPanel domainConsequenceSection" aria-labelledby={`${title.replace(/\s+/g, "-")}-title`}>
      <h3 id={`${title.replace(/\s+/g, "-")}-title`}>{title}</h3>
      <p>{summaryText}</p>
      {capLine ? <p className="domainConsequenceCapLine">{capLine}</p> : null}
      <section
        className="domainConsequenceReader"
        aria-labelledby={`${title.replace(/\s+/g, "-")}-reader-title`}
        data-polish-domain-consequence-reader="s91-15-domain-consequence-reader"
        data-domain-consequence-reader-state={consequenceReader.state}
      >
        <div className="domainConsequenceReaderHeader">
          <div>
            <h4 id={`${title.replace(/\s+/g, "-")}-reader-title`}>后果追踪校阅</h4>
            <p>只读已入卷公开余波、来源标签、牵连指标与候复状态。</p>
          </div>
          <span>{consequenceReader.state === "written" ? "主卷待呈" : consequenceReader.state === "ready" ? "可据此拟" : "候公开卷"}</span>
        </div>
        <dl>
          {consequenceReader.rows.map((row) => (
            <div key={row.id}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
              <span>{row.detail}</span>
            </div>
          ))}
        </dl>
        <p className="domainConsequenceReaderBoundary">
          只认调用处传入的当前案卷本地草稿状态，不回显正文，不把后果追踪、凭据、牵连或续记写成资源、任免、赏罚、定罪、交易、调兵或时间推进事实。
        </p>
      </section>
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
        <p className="scholarPanelEmpty paperMotionEmpty">{emptyText}</p>
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
