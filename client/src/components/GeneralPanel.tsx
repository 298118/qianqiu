import type { CSSProperties } from "react";
import { Link } from "react-router";
import type { JsonObject, JsonValue, PlayerSummary } from "../api";
import type { LocalSurface } from "../state/uiState";
import { rewritePlayerFacingWorldText } from "../text/worldText";
import { DomainConsequenceSection } from "./DomainConsequenceSection";
import { RoleCycleSection } from "./RoleCycleSection";

type GeneralPanelProps = {
  readonly player?: PlayerSummary | null;
  readonly roleCycleView?: JsonObject | null;
  readonly militaryDiplomacyView?: JsonObject | null;
  readonly officialPostingsView?: JsonObject | null;
  readonly mapRuntimeView?: unknown;
  readonly eventArchiveView?: JsonObject | null;
  readonly actorMemoryView?: JsonObject | null;
  readonly domainConsequenceView?: JsonObject | null;
  readonly roleBackgroundPath?: string;
  readonly mapHref?: string;
  readonly archiveHref?: string;
  readonly onDraft: (text: string) => void;
  readonly resolveRoleCycleRouteHref?: (routeId: string) => string | null;
  readonly onOpenRoleCycleSurface?: (surface: LocalSurface) => void;
  readonly runnable?: boolean;
};

type SafeListItem = {
  readonly id: string;
  readonly title: string;
  readonly meta?: string;
  readonly body?: string;
  readonly score?: number;
};

const unsafeGeneralFragments = [
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

const frontierKindLabels: Record<string, string> = {
  border: "边患",
  raid: "寇警",
  diplomacy: "边议",
  garrison: "戍防",
  supply: "粮道",
  scout: "斥候",
  morale: "军心",
  report: "战报"
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

function cleanGeneralText(value: unknown, fallback = "未载", maxLength = 108) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /(?:file|https?):\/\//i.test(text)) return fallback;
  if (unsafeGeneralFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}…` : rewritten;
}

function cleanOptionalText(value: unknown, maxLength = 108) {
  const cleaned = cleanGeneralText(value, "", maxLength);
  return cleaned || undefined;
}

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function cleanCount(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function safeAssetPath(value: string | undefined) {
  if (!value || !value.startsWith("/assets/ui/")) return undefined;
  if (unsafeGeneralFragments.some((fragment) => value.toLowerCase().includes(fragment.toLowerCase()))) return undefined;
  return value;
}

function getPlayerName(player: PlayerSummary | null | undefined) {
  return cleanGeneralText(player?.name, "案主", 32);
}

function currentPostingFromView(officialPostings: JsonObject) {
  return asArray(officialPostings.postings)
    .map(asRecord)
    .find((posting) => posting.holderType === "player" || posting.id === "posting-player-current") || {};
}

function listFromRows(rows: readonly JsonValue[], key: string, limit: number, fallbackTitle: string): SafeListItem[] {
  return rows
    .slice(0, limit)
    .map((entry, index) => {
      if (typeof entry === "string" || typeof entry === "number") {
        return {
          id: `${key}-${index}`,
          title: cleanGeneralText(entry, fallbackTitle, 52)
        };
      }

      const item = asRecord(entry);
      const kind = cleanGeneralText(item.kind || item.domain || item.type, "", 28);
      const labelPrefix = frontierKindLabels[kind] ? `${frontierKindLabels[kind]} · ` : "";
      const title = cleanGeneralText(
        item.title || item.label || item.name || item.frontierName || item.routeLabel || item.actorLabel || item.eventTitle,
        fallbackTitle,
        52
      );
      const meta = cleanOptionalText(
        [
          cleanOptionalText(item.statusLabel || item.status || item.severityLabel || item.visibility, 24),
          item.riskScore === undefined && item.pressureScore === undefined && item.severity === undefined
            ? undefined
            : `警势 ${cleanNumber(item.riskScore ?? item.pressureScore ?? item.severity, 0)}`,
          item.progress === undefined ? undefined : `进度 ${cleanNumber(item.progress, 0)}`
        ].filter(Boolean).join(" · "),
        64
      );
      const body = cleanOptionalText(
        item.publicSummary ||
          item.visibleSummary ||
          item.summary ||
          item.publicReport ||
          item.publicFinding ||
          item.description,
        142
      );
      return {
        id: cleanGeneralText(item.id || item.ref || item.sourceRef || item.eventId || `${key}-${index}`, `${key}-${index}`, 72),
        title: `${labelPrefix}${title}`,
        meta,
        body,
        score: item.riskScore === undefined && item.pressureScore === undefined && item.severity === undefined
          ? undefined
          : cleanNumber(item.riskScore ?? item.pressureScore ?? item.severity, 0)
      };
    })
    .filter((item) => item.title !== fallbackTitle || item.meta || item.body);
}

function rowsFromKeys(source: JsonObject, keys: readonly string[]) {
  return keys.flatMap((key) => asArray(source[key]));
}

function getCommandSummary(player: PlayerSummary | null | undefined, posting: JsonObject, militaryDiplomacy: JsonObject) {
  const command = asRecord(militaryDiplomacy.command || militaryDiplomacy.commandSummary || militaryDiplomacy.garrisonSummary);
  return {
    office: cleanGeneralText(player?.officeTitle || command.officeTitle || posting.officeTitle, "领兵将领", 42),
    theater: cleanGeneralText(command.theater || command.frontierName || posting.cityName || posting.regionName, "边镇军帐", 36),
    date: cleanGeneralText(militaryDiplomacy.dateLabel || command.dateLabel || posting.startedAt, "时令未载", 36),
    summary: cleanGeneralText(
      command.publicSummary || militaryDiplomacy.publicSummary || posting.publicSummary,
      "军务、外交、舆图和战报均为已公开卷宗；战役、粮饷、调兵与任免仍候案卷回批。",
      152
    )
  };
}

function getSupplySummary(militaryDiplomacy: JsonObject) {
  const supply = asRecord(militaryDiplomacy.supplySummary || militaryDiplomacy.logistics || militaryDiplomacy.grainPay);
  const reports = listFromRows(rowsFromKeys(militaryDiplomacy, ["supplyLines", "garrisons", "supplyReports", "logisticsReports", "grainPayReports"]), "supply", 3, "粮饷");
  return {
    grain: cleanNumber(supply.grainScore ?? supply.grainStock ?? supply.supplyScore, 50),
    pay: cleanNumber(supply.payScore ?? supply.salaryScore ?? supply.fundsScore, 50),
    route: cleanNumber(supply.routeSecurity ?? supply.transportSecurity ?? supply.logisticsSecurity, 50),
    morale: cleanNumber(supply.moraleScore ?? militaryDiplomacy.moraleScore, 50),
    summary: cleanGeneralText(supply.publicSummary, "粮饷与军心只读公开摘要，拨饷、征发和赏罚不得由前端直接结算。", 132),
    reports
  };
}

function getScoutItems(militaryDiplomacy: JsonObject, actorMemory: JsonObject) {
  const scoutRows = rowsFromKeys(militaryDiplomacy, ["scoutReports", "intelligenceReports", "frontierIntelligence", "frontierIncidents", "rumors"]);
  const memoryRows = rowsFromKeys(actorMemory, ["actors", "recentUpdates"]);
  const items = listFromRows(scoutRows, "scout", 4, "斥候");
  return items.length ? items : listFromRows(memoryRows, "scout-memory", 4, "军中人事");
}

function getFrontierItems(militaryDiplomacy: JsonObject, mapRuntime: JsonObject) {
  const domainRows = rowsFromKeys(militaryDiplomacy, [
    "theaters",
    "garrisons",
    "supplyLines",
    "diplomaticContacts",
    "frontierIncidents",
    "borderPressures",
    "diplomaticIssues",
    "campaignDockets"
  ]);
  const mapEffects = asArray(mapRuntime.eventEffects).map((entry) => {
    const item = asRecord(entry);
    return {
      ...item,
      title: item.label,
      publicSummary: item.summary,
      riskScore: item.severity,
      kind: item.kind || "border"
    };
  });
  const mapRefs = asArray(mapRuntime.refs).map((entry) => {
    const item = asRecord(entry);
    return {
      ...item,
      title: item.label,
      publicSummary: item.summary,
      kind: "garrison"
    };
  });
  const mapRoutes = asArray(mapRuntime.routes).map((entry) => {
    const item = asRecord(entry);
    return {
      ...item,
      title: item.label,
      publicSummary: item.summary,
      kind: "supply"
    };
  });
  return listFromRows([...domainRows, ...mapEffects, ...mapRefs, ...mapRoutes], "frontier", 5, "边患");
}

function getWarReports(militaryDiplomacy: JsonObject, eventArchive: JsonObject) {
  const militaryRows = rowsFromKeys(militaryDiplomacy, ["frontierIncidents", "diplomaticContacts", "warReports", "battleReports", "recentReports", "diplomaticReports"]);
  const archiveRows = rowsFromKeys(eventArchive, ["events", "items", "entries"]).filter((entry) => {
    const item = asRecord(entry);
    const text = cleanGeneralText(
      [item.domain, item.kind, item.type, item.title, item.label].filter(Boolean).join(" "),
      "",
      80
    ).toLowerCase();
    return /military|battle|frontier|war|军|战|边|寇|营|外交/.test(text);
  });
  const reports = listFromRows(militaryRows, "war-report", 4, "战报");
  return reports.length ? reports : listFromRows(archiveRows, "archive-war-report", 4, "战报");
}

function draftButtonText(label: string, text: string, enabled: boolean, onDraft: (text: string) => void) {
  return (
    <button type="button" disabled={!enabled} onClick={() => onDraft(text)}>
      {label}
    </button>
  );
}

export function GeneralPanel({
  player,
  roleCycleView,
  militaryDiplomacyView,
  officialPostingsView,
  mapRuntimeView,
  eventArchiveView,
  actorMemoryView,
  domainConsequenceView,
  roleBackgroundPath,
  mapHref,
  archiveHref,
  onDraft,
  resolveRoleCycleRouteHref,
  onOpenRoleCycleSurface,
  runnable = true
}: GeneralPanelProps) {
  const militaryDiplomacy = asRecord(militaryDiplomacyView);
  const officialPostings = asRecord(officialPostingsView);
  const mapRuntime = asRecord(mapRuntimeView);
  const eventArchive = asRecord(eventArchiveView);
  const actorMemory = asRecord(actorMemoryView);
  const posting = currentPostingFromView(officialPostings);
  const command = getCommandSummary(player, posting, militaryDiplomacy);
  const supply = getSupplySummary(militaryDiplomacy);
  const scouts = getScoutItems(militaryDiplomacy, actorMemory);
  const frontier = getFrontierItems(militaryDiplomacy, mapRuntime);
  const reports = getWarReports(militaryDiplomacy, eventArchive);
  const playerName = getPlayerName(player);
  const counts = asRecord(militaryDiplomacy.counts);
  const activeFrontierCount = cleanCount(counts.frontierIncidents ?? counts.theaters ?? frontier.length, frontier.length);
  const scoutCount = cleanCount(scouts.length, scouts.length);
  const backgroundPath = safeAssetPath(roleBackgroundPath);
  const backgroundStyle = backgroundPath ? ({ "--scholar-panel-bg": `url(${backgroundPath})` } as CSSProperties) : undefined;
  const canDraft = runnable !== false;

  return (
    <section
      className="scholarPanel generalPanel"
      aria-labelledby="general-panel-title"
      data-role-background={backgroundPath ?? "/assets/ui/roles/role-general-frontier-tent-v1.webp"}
      style={backgroundStyle}
    >
      <header className="scholarPanelHeader">
        <div>
          <p className="scholarPanelEyebrow">军帐 · {command.date}</p>
          <h2 id="general-panel-title">将领军务</h2>
          <p>{playerName}署理{command.office}，坐镇{command.theater}，只读军务外交、舆图、史册和人事记忆的公开卷宗。</p>
          <p>{command.summary}</p>
        </div>
        <dl className="scholarPanelStatus" aria-label="将领摘要">
          <div>
            <dt>军帐</dt>
            <dd>{command.theater}</dd>
          </div>
          <div>
            <dt>边警</dt>
            <dd>{activeFrontierCount} 件 · 斥候 {scoutCount}</dd>
          </div>
          <div>
            <dt>边界</dt>
            <dd>只写草稿，战事候回批</dd>
          </div>
        </dl>
      </header>

      <div className="scholarPanelGrid generalPanelGrid">
        <RoleCycleSection
          roleCycleView={roleCycleView}
          idPrefix="general-role-cycle"
          runnable={runnable}
          resolveRouteHref={resolveRoleCycleRouteHref}
          onOpenSurface={onOpenRoleCycleSurface}
          onDraft={onDraft}
        />
        <article className="scholarPanelCard generalPanelCommand" aria-labelledby="general-command-title">
          <h3 id="general-command-title">军帐总览</h3>
          <ul className="scholarPanelMetrics" aria-label="军务四项">
            <li>
              <span>粮秣</span>
              <strong>{supply.grain}</strong>
              <em>只读</em>
            </li>
            <li>
              <span>军饷</span>
              <strong>{supply.pay}</strong>
              <em>候核</em>
            </li>
            <li>
              <span>粮道</span>
              <strong>{supply.route}</strong>
              <em>通塞</em>
            </li>
            <li>
              <span>军心</span>
              <strong>{supply.morale}</strong>
              <em>营中</em>
            </li>
          </ul>
          <p>{supply.summary}</p>
          {draftButtonText("召集军议", `召集军议，先核${command.theater}粮饷、军心、斥候与边患，拟成军令草稿候裁。`, canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard generalPanelSupply" aria-labelledby="general-supply-title">
          <h3 id="general-supply-title">粮饷与军心</h3>
          <GeneralPanelList items={supply.reports} emptyText="暂无粮饷急报，可先点验仓储、军饷簿和粮道关津。" />
          <div className="scholarPanelActions">
            {draftButtonText("点验粮饷", "点验营中粮秣、军饷与转运关津，列明缺口、风险和请拨事项。", canDraft, onDraft)}
            {draftButtonText("安抚军心", "巡营安抚军心，察看疲卒、伤病与赏罚争议，只形成行动草稿。", canDraft, onDraft)}
          </div>
        </article>

        <article className="scholarPanelCard generalPanelScouts" aria-labelledby="general-scout-title">
          <h3 id="general-scout-title">斥候与情报</h3>
          <p>斥候线索只作公开可见情报；敌情真伪、伏兵、密约和隐藏意图不得由前端写定。</p>
          <GeneralPanelList items={scouts} emptyText="暂无斥候急报，可先遣轻骑查探驿路、关口与敌营动静。" />
          {draftButtonText("遣出斥候", "遣斥候分赴关隘、驿路与敌营外缘，回报公开线索，不自行判定隐藏军情。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard generalPanelFrontier" aria-labelledby="general-frontier-title">
          <h3 id="general-frontier-title">边患与舆图</h3>
          <GeneralPanelList items={frontier} emptyText="暂无边患材料；若需观势，可入舆图页查看公开舆图。" />
          <div className="scholarPanelActions">
            {draftButtonText("巡边布防", "按舆图公开材料巡边布防，先拟哨探、粮道与守备次序，不直接调兵结算。", canDraft, onDraft)}
            {mapHref ? <Link to={mapHref}>入舆图页</Link> : null}
          </div>
        </article>

        <article className="scholarPanelCard generalPanelReports" aria-labelledby="general-reports-title">
          <h3 id="general-reports-title">战报与边议</h3>
          <p>战报、边议和外交风声只显示已公开摘录；胜负、和战、封赏和处分仍待回批。</p>
          <GeneralPanelList items={reports} emptyText="暂无新战报，可先核对旧牍、塘报与使节来文。" />
          <div className="scholarPanelActions">
            {draftButtonText("草拟战报", `臣${playerName}谨就${command.theater}边患、粮饷、斥候与军心草拟战报，请案卷回批后果。`, canDraft, onDraft)}
            {archiveHref ? <Link to={archiveHref}>查史册</Link> : null}
          </div>
        </article>

        <DomainConsequenceSection
          domainConsequenceView={domainConsequenceView}
          sourceTypes={["military_diplomacy"]}
          title="军务后果追踪"
          summaryFallback="军务后果只读已经入卷的公开余波；侦察、调粮、战险、和战与赏罚仍须回合候批。"
          emptyText="暂无公开军务后果；不得从隐藏军情、内部账簿或模型提案补造战果。"
          runnable={runnable}
          onDraft={onDraft}
        />

        <article className="scholarPanelCard generalPanelBoundary" aria-labelledby="general-boundary-title">
          <h3 id="general-boundary-title">军令边界</h3>
          <ul className="scholarPanelBoundary">
            <li>本面板只读已公开军务卷宗，不展示内部推演细节、连接凭据或私密军情。</li>
            <li>按钮只把军议、战报、斥候、巡边和粮饷安排写入底部行动草稿。</li>
            <li>战役胜负、调兵遣将、外交和战、统帅任免、粮饷拨付与赏罚都须候案卷回批。</li>
          </ul>
          <dl className="scholarPanelCompactDl">
            <div>
              <dt>任所</dt>
              <dd>{command.office}</dd>
            </div>
            <div>
              <dt>军帐</dt>
              <dd>{command.theater}</dd>
            </div>
            <div>
              <dt>军令</dt>
              <dd>草稿-only</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}

function GeneralPanelList({ items, emptyText }: { readonly items: readonly SafeListItem[]; readonly emptyText: string }) {
  if (!items.length) {
    return <p className="scholarPanelEmpty paperMotionEmpty">{emptyText}</p>;
  }

  return (
    <ul className="scholarPanelList">
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item.title}</strong>
          {item.meta ? <span>{item.meta}</span> : null}
          {item.body ? <p>{item.body}</p> : null}
        </li>
      ))}
    </ul>
  );
}
