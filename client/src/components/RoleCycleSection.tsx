import { Link } from "react-router";
import type { JsonObject, JsonValue, RoleCycleView } from "../api";
import type { LocalSurface } from "../state/uiState";
import { rewritePlayerFacingWorldText } from "../text/worldText";
import { markOverlayTrigger } from "./overlayFocus";

type RoleCycleSectionProps = {
  readonly roleCycleView?: RoleCycleView | JsonObject | null;
  readonly onDraft: (text: string) => void;
  readonly resolveRouteHref?: (routeId: string) => string | null;
  readonly onOpenSurface?: (surface: LocalSurface) => void;
  readonly localRoleSurfaceDraftWritten?: boolean;
  readonly runnable?: boolean;
  readonly idPrefix?: string;
};

type CycleEvidenceRef = {
  readonly id: string;
  readonly label: string;
  readonly sourceView: string;
  readonly sourceId: string;
};

type CycleItem = {
  readonly id: string;
  readonly title: string;
  readonly meta?: string;
  readonly body?: string;
  readonly score?: number;
  readonly evidenceRefs: readonly CycleEvidenceRef[];
};

type CycleAction = {
  readonly id: string;
  readonly label: string;
  readonly text: string;
};

type CycleEntryPoint = {
  readonly id: string;
  readonly label: string;
  readonly summary?: string;
  readonly kind: "route" | "surface" | "reference";
  readonly targetRouteId?: string;
  readonly targetSurfaceId?: LocalSurface;
};

type CycleRoleMatrixEntry = {
  readonly id: string;
  readonly roleLabel: string;
  readonly authorityTier: string;
  readonly loopLabel: string;
  readonly statusLabel: string;
  readonly summary: string;
  readonly sourceLabels: readonly string[];
  readonly pressureScore?: number;
  readonly itemCount: number;
  readonly active: boolean;
};

type CycleFocusStat = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
};

type CycleBoundarySummary = {
  readonly sourceLabels: readonly string[];
  readonly safetyLabels: readonly string[];
  readonly notes: readonly string[];
};

type RoleCycleReaderRow = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

type RoleCycleReader = {
  readonly state: "empty" | "ready" | "written";
  readonly rows: readonly RoleCycleReaderRow[];
};

const unsafeRoleCycleFragments = [
  "provider",
  "proposal",
  "raw",
  "prompt",
  "path",
  "key",
  "hidden",
  "sealed",
  "sqlite",
  "localstorage",
  "sessionstorage",
  "data/sessions",
  "data\\sessions",
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

const roleCycleRouteIds = new Set(["game", "map", "people", "inventory", "archive", "exam", "ranking", "court"]);
const roleCycleSurfaceIds = new Set<LocalSurface>([
  "memorial-review",
  "edict-draft",
  "court-debate",
  "trial",
  "war-council",
  "npc-profile",
  "map-filter"
]);
const localRoleCyclePathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|mnt|users|private|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;
const roleCycleSourceViewLabels: Record<string, string> = {
  courtConsequenceView: "官场后果",
  courtResponseView: "奏议回应",
  domainConsequenceView: "领域后果",
  economicFiscalView: "钱粮财政",
  eventArchiveView: "事件档案",
  examCalendarView: "科举日程",
  examProcedureView: "科场流程",
  localAffairsDocketView: "地方案牍",
  mapRuntimeView: "舆图局势",
  marketPriceView: "市价粮价",
  militaryDiplomacyView: "军务外交",
  npcEconomyView: "人物月账",
  officialCareerView: "官职履历",
  officialPostingsView: "官署任所",
  playerMonthlyBriefingView: "官职月报",
  studyProfileView: "读书簿",
  worldThreadView: "天下议题"
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

function cleanRoleCycleText(value: unknown, fallback = "未载", maxLength = 112) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (localRoleCyclePathPattern.test(text) || /(?:file|https?):\/\//i.test(text)) return fallback;
  if (unsafeRoleCycleFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}…` : rewritten;
}

function cleanOptionalText(value: unknown, maxLength = 112) {
  const cleaned = cleanRoleCycleText(value, "", maxLength);
  return cleaned || undefined;
}

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function cleanTurnNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(99999, Math.round(number))) : undefined;
}

function cleanRouteId(value: unknown) {
  const routeId = cleanRoleCycleText(value, "", 32);
  return roleCycleRouteIds.has(routeId) ? routeId : undefined;
}

function cleanSurfaceId(value: unknown): LocalSurface | undefined {
  const surfaceId = cleanRoleCycleText(value, "", 32);
  return roleCycleSurfaceIds.has(surfaceId as LocalSurface) ? surfaceId as LocalSurface : undefined;
}

function cycleEvidenceRefs(value: JsonValue | unknown): CycleEvidenceRef[] {
  return asArray(value)
    .slice(0, 3)
    .map((entry, index) => {
      const ref = asRecord(entry);
      const sourceView = cleanRoleCycleText(ref.sourceView, "", 48);
      const sourceId = cleanRoleCycleText(ref.sourceId || ref.id, "", 72);
      if (!sourceView || !sourceId) return null;
      return {
        id: cleanRoleCycleText(ref.id || `${sourceView}:${sourceId}:${index}`, `${sourceView}:${sourceId}:${index}`, 96),
        label: cleanRoleCycleText(ref.label || sourceView, sourceView, 40),
        sourceView,
        sourceId
      };
    })
    .filter((item): item is CycleEvidenceRef => item !== null);
}

function dedupeCycleEvidenceRefs(refs: readonly CycleEvidenceRef[]) {
  const seen = new Set<string>();
  const items: CycleEvidenceRef[] = [];
  for (const ref of refs) {
    const key = `${ref.sourceView}:${ref.sourceId}:${ref.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(ref);
    if (items.length >= 3) break;
  }
  return items;
}

function cycleEntryPoints(source: JsonObject): CycleEntryPoint[] {
  return asArray(source.entryPoints)
    .slice(0, 4)
    .map((entry, index): CycleEntryPoint | null => {
      const item = asRecord(entry);
      const label = cleanRoleCycleText(item.label || item.title, "", 40);
      if (!label) return null;
      const targetRouteId = cleanRouteId(item.targetRouteId);
      const targetSurfaceId = cleanSurfaceId(item.targetSurfaceId);
      const kind: CycleEntryPoint["kind"] = targetRouteId ? "route" : targetSurfaceId ? "surface" : "reference";
      return {
        id: cleanRoleCycleText(item.id || `role-cycle-entry-${index}`, `role-cycle-entry-${index}`, 72),
        label,
        summary: cleanOptionalText(item.publicSummary || item.summary, 96),
        kind,
        targetRouteId,
        targetSurfaceId
      };
    })
    .filter((item): item is CycleEntryPoint => item !== null);
}

function cycleItems(source: JsonObject, key: string, limit: number): CycleItem[] {
  return asArray(source[key])
    .slice(0, limit)
    .map((entry, index): CycleItem | null => {
      const item = asRecord(entry);
      const title = cleanRoleCycleText(item.title || item.label || item.domainLabel || item.statusLabel, "", 54);
      const score = item.riskScore === undefined && item.value === undefined
        ? undefined
        : cleanNumber(item.riskScore ?? item.value, 0);
      const meta = cleanOptionalText(
        [
          cleanOptionalText(item.meta || item.statusLabel || item.bandLabel || item.sourceView, 32),
          score === undefined ? undefined : `警势 ${score}`
        ].filter(Boolean).join(" · "),
        64
      );
      const body = cleanOptionalText(item.publicSummary || item.summary || item.body, 132);
      if (!title && !body) return null;
      return {
        id: cleanRoleCycleText(item.id || `${key}-${index}`, `${key}-${index}`, 72),
        title: title || body || "本旬事务",
        meta,
        body,
        score,
        evidenceRefs: cycleEvidenceRefs(item.evidenceRefs)
      };
    })
    .filter((item): item is CycleItem => item !== null);
}

function cycleActions(source: JsonObject): CycleAction[] {
  return asArray(source.nextActions)
    .slice(0, 4)
    .map((entry, index) => {
      const item = asRecord(entry);
      const label = cleanRoleCycleText(item.label || item.title, "", 32);
      const text = cleanRoleCycleText(item.text || item.actionText, "", 160);
      if (!label || !text) return null;
      return {
        id: cleanRoleCycleText(item.id || `role-cycle-action-${index}`, `role-cycle-action-${index}`, 72),
        label,
        text
      };
    })
    .filter((item): item is CycleAction => item !== null);
}

function cycleMetrics(source: JsonObject) {
  return asArray(source.metrics)
    .slice(0, 4)
    .map((entry, index) => {
      const item = asRecord(entry);
      const label = cleanRoleCycleText(item.label, "", 32);
      if (!label) return null;
      return {
        id: cleanRoleCycleText(item.id || `role-cycle-metric-${index}`, `role-cycle-metric-${index}`, 72),
        label,
        value: cleanNumber(item.value, 0),
        status: cleanRoleCycleText(item.statusLabel, "候核", 24)
      };
    })
    .filter((item): item is { id: string; label: string; value: number; status: string } => item !== null);
}

function cycleFocusStats({
  items,
  risks,
  entryPoints,
  actions
}: {
  readonly items: readonly CycleItem[];
  readonly risks: readonly CycleItem[];
  readonly entryPoints: readonly CycleEntryPoint[];
  readonly actions: readonly CycleAction[];
}): CycleFocusStat[] {
  return [
    { id: "items", label: "事务", value: items.length },
    { id: "risks", label: "风险", value: risks.length },
    { id: "entry-points", label: "入口", value: entryPoints.length },
    { id: "actions", label: "草稿", value: actions.length }
  ];
}

function buildRoleCycleReader({
  roleLabel,
  loopLabel,
  statusLabel,
  items,
  risks,
  entryPoints,
  actions,
  sourceLabels,
  safetyLabels,
  localRoleSurfaceDraftWritten
}: {
  readonly roleLabel: string;
  readonly loopLabel: string;
  readonly statusLabel: string;
  readonly items: readonly CycleItem[];
  readonly risks: readonly CycleItem[];
  readonly entryPoints: readonly CycleEntryPoint[];
  readonly actions: readonly CycleAction[];
  readonly sourceLabels: readonly string[];
  readonly safetyLabels: readonly string[];
  readonly localRoleSurfaceDraftWritten: boolean;
}): RoleCycleReader {
  const hasVisibleCycleMaterial = Boolean(
    items.length || risks.length || entryPoints.length || actions.length || sourceLabels.length || safetyLabels.length
  );
  const state = localRoleSurfaceDraftWritten ? "written" : hasVisibleCycleMaterial ? "ready" : "empty";
  return {
    state,
    rows: [
      {
        id: "identity",
        label: "身份",
        value: roleLabel,
        detail: `${loopLabel} · ${statusLabel}`
      },
      {
        id: "docket",
        label: "事务",
        value: items.length ? `${items.length} 项事务` : "事务候载",
        detail: risks.length ? `${risks.length} 条风险须留意` : "暂无可见风险；不补造待办。"
      },
      {
        id: "sources",
        label: "取材",
        value: sourceLabels.length ? `${sourceLabels.length} 类取材` : "取材候载",
        detail: sourceLabels.length ? sourceLabels.slice(0, 3).join("、") : "只读当前身份循环公开材料。"
      },
      {
        id: "reply",
        label: "候复",
        value: localRoleSurfaceDraftWritten ? "主卷待呈" : actions.length ? `${actions.length} 项可拟` : "候主卷",
        detail: localRoleSurfaceDraftWritten
          ? "身份循环草稿已入底部奏折，仍候主卷回音。"
          : "可拟草稿只写本地奏折；不回显正文，不写成已裁决事实。"
      }
    ]
  };
}

function cycleBoundarySummary(view: JsonObject, currentRole: JsonObject): CycleBoundarySummary {
  const aiReadScope = asRecord(view.aiReadScope);
  const readScopeLabels = cycleSourceLabels(aiReadScope.allowedSourceViews);
  const sourceLabels = readScopeLabels.length ? readScopeLabels : cycleSourceLabels(currentRole.sourceViews);
  const safety = asRecord(view.safety);
  const safetyLabels = [
    safety.readOnlyView === true ? "只读公开卷" : undefined,
    safety.draftOnlyFrontend === true ? "案头草稿" : undefined,
    safety.serverAdjudicatedOutcomes === true ? "主卷定夺" : undefined
  ].filter((item): item is string => Boolean(item));
  const notes = [
    cleanOptionalText(view.toolPermissions, 96),
    ...asArray(view.proposalBoundaries).slice(0, 2).map((entry) => cleanOptionalText(entry, 88)),
    cleanOptionalText(view.serverAdjudication || view.authorityBoundary, 108)
  ].filter((item): item is string => Boolean(item));
  return {
    sourceLabels,
    safetyLabels,
    notes: [...new Set(notes)].slice(0, 4)
  };
}

function cycleSourceLabels(value: JsonValue | unknown) {
  const labels: string[] = [];
  for (const sourceView of asArray(value)) {
    const sourceKey = cleanRoleCycleText(sourceView, "", 48);
    const label = roleCycleSourceViewLabels[sourceKey];
    if (label && !labels.includes(label)) labels.push(label);
    if (labels.length >= 3) break;
  }
  return labels;
}

function cycleRoleMatrix(source: JsonObject): CycleRoleMatrixEntry[] {
  const activeRole = cleanRoleCycleText(source.activeRole, "", 32);
  return asArray(source.roleMatrix)
    .slice(0, 6)
    .map((entry, index): CycleRoleMatrixEntry | null => {
      const item = asRecord(entry);
      const role = cleanRoleCycleText(item.role, "", 32);
      const roleLabel = cleanRoleCycleText(item.roleLabel, "", 28);
      const loopLabel = cleanRoleCycleText(item.loopLabel, "", 48);
      if (!roleLabel || !loopLabel) return null;
      const active = item.enabled === true || (!!activeRole && role === activeRole);
      return {
        id: cleanRoleCycleText(item.role || `role-cycle-matrix-${index}`, `role-cycle-matrix-${index}`, 72),
        roleLabel,
        authorityTier: cleanRoleCycleText(item.authorityTier, "T?", 12),
        loopLabel,
        statusLabel: active
          ? cleanRoleCycleText(item.statusLabel, "本身份", 24)
          : cleanRoleCycleText(item.statusLabel, "待任后展开", 24),
        summary: cleanRoleCycleText(
          item.summary,
          active ? "当前身份事务已按公开卷宗展开。" : "详细案源只在对应身份可见时展开。",
          96
        ),
        sourceLabels: cycleSourceLabels(item.sourceViews),
        pressureScore: active && item.pressureScore !== undefined ? cleanNumber(item.pressureScore, 0) : undefined,
        itemCount: active ? cleanNumber(item.itemCount, 0) : 0,
        active
      };
    })
    .filter((item): item is CycleRoleMatrixEntry => item !== null);
}

function RoleCycleEntryPointButton({
  entry,
  resolveRouteHref,
  onOpenSurface
}: {
  readonly entry: CycleEntryPoint;
  readonly resolveRouteHref?: (routeId: string) => string | null;
  readonly onOpenSurface?: (surface: LocalSurface) => void;
}) {
  if (entry.kind === "route" && entry.targetRouteId && resolveRouteHref) {
    const href = resolveRouteHref(entry.targetRouteId);
    if (href) {
      return (
        <Link to={href} title={entry.summary}>
          {entry.label}
        </Link>
      );
    }
  }

  const targetSurfaceId = entry.targetSurfaceId;
  if (entry.kind === "surface" && targetSurfaceId && onOpenSurface) {
    return (
      <button
        type="button"
        title={entry.summary}
        onClick={(event) => {
          markOverlayTrigger(event.currentTarget);
          onOpenSurface(targetSurfaceId);
        }}
      >
        {entry.label}
      </button>
    );
  }

  return (
    <span aria-disabled="true" title={entry.summary}>
      {entry.label} · 入口待开放
    </span>
  );
}

export function RoleCycleSection({
  roleCycleView,
  onDraft,
  resolveRouteHref,
  onOpenSurface,
  localRoleSurfaceDraftWritten = false,
  runnable = true,
  idPrefix = "role-cycle"
}: RoleCycleSectionProps) {
  const view = asRecord(roleCycleView);
  const currentRole = asRecord(view.currentRole);
  if (!Object.keys(currentRole).length) return null;

  const titleId = `${idPrefix}-title`;
  const roleLabel = cleanRoleCycleText(currentRole.roleLabel || view.activeRoleLabel, "本身份", 28);
  const loopLabel = cleanRoleCycleText(currentRole.loopLabel, "本旬事务", 40);
  const statusLabel = cleanRoleCycleText(currentRole.statusLabel, "候办", 24);
  const dateLabel = cleanOptionalText(view.dateLabel, 32);
  const turnNumber = cleanTurnNumber(view.generatedAtTurn);
  const cycleMeta = [roleLabel, loopLabel, dateLabel, turnNumber === undefined ? undefined : `第${turnNumber}回合`].filter(Boolean).join(" · ");
  const summary = cleanRoleCycleText(currentRole.summary || view.summary, "本旬身份循环由公开卷宗整理。", 148);
  const items = cycleItems(currentRole, "items", 5);
  const risks = cycleItems(currentRole, "riskSignals", 4);
  const metrics = cycleMetrics(currentRole);
  const entryPoints = cycleEntryPoints(currentRole);
  const actions = cycleActions(currentRole);
  const roleMatrix = cycleRoleMatrix(view);
  const focusStats = cycleFocusStats({ items, risks, entryPoints, actions });
  const currentEvidenceRefs = dedupeCycleEvidenceRefs(cycleEvidenceRefs(currentRole.evidenceRefs));
  const boundary = cycleBoundarySummary(view, currentRole);
  const cycleReader = buildRoleCycleReader({
    roleLabel,
    loopLabel,
    statusLabel,
    items,
    risks,
    entryPoints,
    actions,
    sourceLabels: boundary.sourceLabels,
    safetyLabels: boundary.safetyLabels,
    localRoleSurfaceDraftWritten
  });

  return (
    <article className="scholarPanelCard paperMotionPanel rolePanel roleCycleSection" aria-labelledby={titleId}>
      <div className="scholarPanelCardHeader">
        <div>
          <h3 id={titleId}>本旬身份循环</h3>
          <p>{cycleMeta}</p>
        </div>
        <span>{statusLabel}</span>
      </div>
      <p>{summary}</p>
      <div className="roleCycleFocusStrip" aria-label="本身份速览">
        {focusStats.map((stat) => (
          <span key={stat.id}>
            {stat.label}
            <strong>{stat.value}</strong>
          </span>
        ))}
      </div>
      <section
        className="roleCycleReader"
        aria-labelledby={`${idPrefix}-reader-title`}
        data-polish-role-cycle-reader="s91-13-role-cycle-reader"
        data-role-cycle-reader-state={cycleReader.state}
      >
        <div className="roleCycleReaderHeader">
          <div>
            <h4 id={`${idPrefix}-reader-title`}>身份候复校阅</h4>
            <p>只读当前身份循环公开事务、风险、入口与取材。</p>
          </div>
          <span>{cycleReader.state === "written" ? "主卷待呈" : cycleReader.state === "ready" ? "可据此拟" : "候公开卷"}</span>
        </div>
        <dl>
          {cycleReader.rows.map((row) => (
            <div key={row.id}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
              <span>{row.detail}</span>
            </div>
          ))}
        </dl>
        <p className="roleCycleReaderBoundary">
          只认当前案卷本页的本地草稿状态，不回显正文，不把身份切换、任免、调兵、审案、交易、考试或时间推进写成已生效事实。
        </p>
      </section>
      {currentEvidenceRefs.length ? (
        <div className="roleCycleCurrentEvidence" aria-label="本身份公开取材">
          <span>本身份取材</span>
          <div>
            {currentEvidenceRefs.map((ref) => (
              <span key={ref.id}>证据：{ref.label}</span>
            ))}
          </div>
        </div>
      ) : null}
      {boundary.sourceLabels.length || boundary.safetyLabels.length || boundary.notes.length ? (
        <div className="roleCycleBoundary" aria-label="可读材料与裁决边界">
          {boundary.sourceLabels.length ? (
            <div className="roleCycleBoundarySources" aria-label="身份循环可读材料">
              <span>可读材料</span>
              <div>
                {boundary.sourceLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          ) : null}
          {boundary.safetyLabels.length ? (
            <div className="roleCycleBoundaryChips" aria-label="身份循环安全边界">
              {boundary.safetyLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          ) : null}
          {boundary.notes.length ? (
            <ul>
              {boundary.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {roleMatrix.length ? (
        <section className="roleCycleMatrix" aria-labelledby={`${idPrefix}-matrix-title`}>
          <h4 id={`${idPrefix}-matrix-title`}>六身份矩阵</h4>
          <ul aria-label="六身份矩阵">
            {roleMatrix.map((entry) => (
              <li key={entry.id} data-active={entry.active ? "true" : "false"} aria-current={entry.active ? "true" : undefined}>
                <div className="roleCycleMatrixHeading">
                  <strong>{entry.roleLabel}</strong>
                  <span>职责层级 {entry.authorityTier}</span>
                </div>
                <span>{entry.loopLabel}</span>
                <p>{entry.summary}</p>
                {entry.sourceLabels.length ? (
                  <div className="roleCycleMatrixSources" aria-label={`${entry.roleLabel}取材域`}>
                    {entry.sourceLabels.map((sourceLabel) => (
                      <span key={sourceLabel}>{sourceLabel}</span>
                    ))}
                  </div>
                ) : null}
                <div className="roleCycleMatrixStatus">
                  <em>{entry.active ? `本身份 · ${entry.itemCount} 项可见事务` : entry.statusLabel}</em>
                  {entry.pressureScore !== undefined ? <span className="roleCycleMatrixPressure">警势 {entry.pressureScore}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {metrics.length ? (
        <dl className="roleCycleMetrics" aria-label="身份循环指标">
          {metrics.map((metric) => (
            <div key={metric.id}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
              <span>{metric.status}</span>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="roleCycleColumns">
        <section aria-labelledby={`${idPrefix}-items-title`}>
          <h4 id={`${idPrefix}-items-title`}>本旬事务</h4>
          {items.length ? (
            <ul className="scholarPanelList">
              {items.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  {item.meta ? <span>{item.meta}</span> : null}
                  {item.body ? <p>{item.body}</p> : null}
                  {item.evidenceRefs.length ? (
                    <div className="roleCycleEvidenceRefs" aria-label="证据来源">
                      {item.evidenceRefs.map((ref) => (
                        <span key={ref.id} className="roleCycleEvidenceChip">
                          证据：{ref.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>暂无明确待办。</p>
          )}
        </section>
        <section aria-labelledby={`${idPrefix}-risks-title`}>
          <h4 id={`${idPrefix}-risks-title`}>风险</h4>
          {risks.length ? (
            <ul className="scholarPanelList">
              {risks.map((risk) => (
                <li key={risk.id}>
                  <strong>{risk.title}</strong>
                  {risk.meta ? <span>{risk.meta}</span> : null}
                  {risk.body ? <p>{risk.body}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>暂无可见风险。</p>
          )}
        </section>
      </div>
      {entryPoints.length ? (
        <div className="roleCycleEntryPoints" aria-label="可查入口">
          <span>可查入口</span>
          <div>
            {entryPoints.map((entry) => (
              <RoleCycleEntryPointButton
                key={entry.id}
                entry={entry}
                resolveRouteHref={resolveRouteHref}
                onOpenSurface={onOpenSurface}
              />
            ))}
          </div>
        </div>
      ) : null}
      {actions.length ? (
        <div className="roleCycleActions" aria-label="可拟草稿">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={runnable === false}
              onClick={() => onDraft(action.text)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
