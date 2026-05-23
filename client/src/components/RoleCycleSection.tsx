import { Link } from "react-router";
import type { JsonObject, JsonValue, RoleCycleView } from "../api";
import type { LocalSurface } from "../state/uiState";
import { markOverlayTrigger } from "./overlayFocus";

type RoleCycleSectionProps = {
  readonly roleCycleView?: RoleCycleView | JsonObject | null;
  readonly onDraft: (text: string) => void;
  readonly resolveRouteHref?: (routeId: string) => string | null;
  readonly onOpenSurface?: (surface: LocalSurface) => void;
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
  readonly loopLabel: string;
  readonly statusLabel: string;
  readonly itemCount: number;
  readonly active: boolean;
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

const roleCycleRouteIds = new Set(["game", "map", "people", "inventory", "archive", "exam", "ranking", "court", "settings"]);
const roleCycleSurfaceIds = new Set<LocalSurface>([
  "memorial-review",
  "edict-draft",
  "court-debate",
  "trial",
  "war-council",
  "npc-profile",
  "map-filter"
]);

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
  if (/[a-z]:[\\/]/i.test(text) || /(?:file|https?):\/\//i.test(text)) return fallback;
  if (unsafeRoleCycleFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function cleanOptionalText(value: unknown, maxLength = 112) {
  const cleaned = cleanRoleCycleText(value, "", maxLength);
  return cleaned || undefined;
}

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
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
        loopLabel,
        statusLabel: active
          ? cleanRoleCycleText(item.statusLabel, "本身份", 24)
          : cleanRoleCycleText(item.statusLabel, "待任后展开", 24),
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
  const summary = cleanRoleCycleText(currentRole.summary || view.summary, "本旬身份循环由服务器安全视图整理。", 148);
  const items = cycleItems(currentRole, "items", 5);
  const risks = cycleItems(currentRole, "riskSignals", 4);
  const metrics = cycleMetrics(currentRole);
  const entryPoints = cycleEntryPoints(currentRole);
  const actions = cycleActions(currentRole);
  const roleMatrix = cycleRoleMatrix(view);

  return (
    <article className="scholarPanelCard roleCycleSection" aria-labelledby={titleId}>
      <div className="scholarPanelCardHeader">
        <div>
          <h3 id={titleId}>本旬身份循环</h3>
          <p>{roleLabel} · {loopLabel}</p>
        </div>
        <span>{statusLabel}</span>
      </div>
      <p>{summary}</p>
      {roleMatrix.length ? (
        <section className="roleCycleMatrix" aria-labelledby={`${idPrefix}-matrix-title`}>
          <h4 id={`${idPrefix}-matrix-title`}>六身份矩阵</h4>
          <ul aria-label="六身份矩阵">
            {roleMatrix.map((entry) => (
              <li key={entry.id} data-active={entry.active ? "true" : "false"}>
                <strong>{entry.roleLabel}</strong>
                <span>{entry.loopLabel}</span>
                <em>{entry.active ? `本身份 · ${entry.itemCount} 项可见事务` : entry.statusLabel}</em>
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
