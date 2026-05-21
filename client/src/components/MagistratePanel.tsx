import type { CSSProperties } from "react";
import type { JsonObject, JsonValue, MarketPriceView, NpcEconomyView, PlayerSummary } from "../api";
import type { LocalSurface } from "../state/uiState";
import { RoleCycleSection } from "./RoleCycleSection";

type MagistratePanelProps = {
  readonly player?: PlayerSummary | null;
  readonly roleCycleView?: JsonObject | null;
  readonly localAffairsDocketView?: JsonObject | null;
  readonly officialPostingsView?: JsonObject | null;
  readonly economicFiscalView?: JsonObject | null;
  readonly marketPriceView?: MarketPriceView | null;
  readonly npcEconomyView?: NpcEconomyView | null;
  readonly roleBackgroundPath?: string;
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

const unsafeMagistrateFragments = [
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

const docketDomainOrder = ["judicial", "revenue", "waterworks", "banditry", "gentry", "relief", "corvee", "epidemic", "term_closure"] as const;

const docketFallbackLabels: Record<string, string> = {
  judicial: "刑名",
  revenue: "钱粮",
  waterworks: "水利",
  banditry: "盗匪",
  gentry: "士绅",
  relief: "灾赈",
  corvee: "徭役",
  epidemic: "疫病",
  term_closure: "任所"
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

function cleanMagistrateText(value: unknown, fallback = "未载", maxLength = 104) {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /(?:file|https?):\/\//i.test(text)) return fallback;
  if (unsafeMagistrateFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function cleanOptionalText(value: unknown, maxLength = 104) {
  const cleaned = cleanMagistrateText(value, "", maxLength);
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
  if (unsafeMagistrateFragments.some((fragment) => value.toLowerCase().includes(fragment.toLowerCase()))) return undefined;
  return value;
}

function getPlayerName(player: PlayerSummary | null | undefined) {
  return cleanMagistrateText(player?.name, "案主", 32);
}

function getPlayerOffice(player: PlayerSummary | null | undefined, posting: JsonObject) {
  return cleanMagistrateText(player?.officeTitle || posting.officeTitle || "知县", "知县", 36);
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
      const item = asRecord(entry);
      const title = cleanMagistrateText(item.title || item.kindLabel || item.domainLabel || item.officeTitle, fallbackTitle, 46);
      const meta = cleanOptionalText(
        [
          cleanOptionalText(item.domainLabel || item.statusLabel || item.status, 20),
          item.pressureScore === undefined ? undefined : `压力 ${cleanNumber(item.pressureScore, 0)}`
        ].filter(Boolean).join(" · "),
        52
      );
      const body = cleanOptionalText(item.publicSummary || item.publicDocket || item.publicFinding || item.authorityBoundary, 132);
      return {
        id: cleanMagistrateText(item.id || `${key}-${index}`, `${key}-${index}`, 72),
        title,
        meta,
        body,
        score: item.pressureScore === undefined ? undefined : cleanNumber(item.pressureScore, 0)
      };
    })
    .filter((item) => item.title !== fallbackTitle || item.body || item.meta);
}

function topDockets(localAffairs: JsonObject) {
  return listFromRows(asArray(localAffairs.dockets), "docket", 4, "案牍");
}

function domainMetrics(localAffairs: JsonObject) {
  const dockets = asArray(localAffairs.dockets).map(asRecord);
  return docketDomainOrder.map((domain) => {
    const docket = dockets.find((entry) => entry.domain === domain);
    return {
      key: domain,
      label: cleanMagistrateText(docket?.domainLabel, docketFallbackLabels[domain], 20),
      value: cleanNumber(docket?.pressureScore, domain === "term_closure" ? 35 : 50),
      status: cleanMagistrateText(docket?.statusLabel, "候核", 18)
    };
  });
}

function docketsByDomain(localAffairs: JsonObject, domains: readonly string[], limit = 2) {
  const rows = asArray(localAffairs.dockets).filter((entry) => {
    const item = asRecord(entry);
    return domains.includes(cleanMagistrateText(item.domain, "", 32));
  });
  return listFromRows(rows, domains.join("-"), limit, "案牍");
}

function firstReport(economicFiscal: JsonObject, key: string) {
  return asRecord(asArray(economicFiscal[key]).at(0));
}

function getFiscalReports(economicFiscal: JsonObject) {
  const localTreasury = firstReport(economicFiscal, "localTreasuryReports");
  const grainMarket = firstReport(economicFiscal, "grainMarketReports");
  const incidents = listFromRows(asArray(economicFiscal.marketIncidents), "market-incident", 2, "财赋预警");
  return {
    localTreasury: {
      title: cleanMagistrateText(localTreasury.title, "本县库银赈济", 44),
      status: cleanMagistrateText(localTreasury.statusLabel, "候核", 18),
      capacity: cleanNumber(localTreasury.localTreasuryCapacity, 45),
      reliefPressure: cleanNumber(localTreasury.reliefPressure, 40),
      summary: cleanMagistrateText(localTreasury.publicSummary, "钱粮、库银与赈济只读服务器财赋投影。", 132)
    },
    grainMarket: {
      title: cleanMagistrateText(grainMarket.title, "粮储市价", 44),
      status: cleanMagistrateText(grainMarket.statusLabel, "候核", 18),
      grainStock: cleanNumber(grainMarket.grainStock, 55),
      marketPressure: cleanNumber(grainMarket.marketPressure ?? grainMarket.pressureScore, 40),
      summary: cleanMagistrateText(grainMarket.publicSummary, "粮价仓储待巡查，开仓平粜仍由服务器裁决。", 132)
    },
    incidents
  };
}

function getMarketPriceRows(marketPrice: JsonObject) {
  return asArray(marketPrice.priceRows)
    .map(asRecord)
    .slice(0, 4)
    .map((row, index) => {
      const price = Number(row.currentSilverLiang);
      const pressure = row.marketPressure === undefined ? undefined : cleanNumber(row.marketPressure, 0);
      const drivers = asArray(row.drivers)
        .map((entry) => cleanOptionalText(entry, 18))
        .filter(Boolean)
        .slice(0, 3)
        .join(" · ");
      return {
        id: cleanMagistrateText(row.priceId, `market-${index}`, 72),
        title: cleanMagistrateText(row.label, "市价", 36),
        meta: cleanOptionalText([
          Number.isFinite(price) ? `${price.toFixed(price >= 10 ? 0 : 1)}两` : undefined,
          cleanOptionalText(row.availability, 16),
          cleanOptionalText(row.trendLabel, 16)
        ].filter(Boolean).join(" · "), 64),
        body: drivers || cleanOptionalText(row.authorityBoundary, 96),
        score: pressure
      };
    });
}

function getEconomyEvents(npcEconomy: JsonObject) {
  return asArray(npcEconomy.recentEvents)
    .map((entry, index) => ({
      id: `economy-event-${index}`,
      title: cleanMagistrateText(entry, "NPC 月账", 72)
    }))
    .slice(0, 3);
}

function getPostingSummary(posting: JsonObject, player: PlayerSummary | null | undefined) {
  return {
    office: getPlayerOffice(player, posting),
    city: cleanMagistrateText(posting.cityName || posting.cityId || "本县", "本县", 32),
    performance: cleanNumber(posting.performanceScore, 50),
    risk: cleanNumber(posting.impeachmentRisk, 0),
    reputation: cleanNumber(posting.publicReputation, 50),
    summary: cleanMagistrateText(posting.publicSummary, "任所、考成、弹劾和升降仍由服务器官场规则裁决。", 132)
  };
}

function draftButtonText(label: string, text: string, enabled: boolean, onDraft: (text: string) => void) {
  return (
    <button type="button" disabled={!enabled} onClick={() => onDraft(text)}>
      {label}
    </button>
  );
}

export function MagistratePanel({
  player,
  roleCycleView,
  localAffairsDocketView,
  officialPostingsView,
  economicFiscalView,
  marketPriceView,
  npcEconomyView,
  roleBackgroundPath,
  onDraft,
  resolveRoleCycleRouteHref,
  onOpenRoleCycleSurface,
  runnable = true
}: MagistratePanelProps) {
  const localAffairs = asRecord(localAffairsDocketView);
  const officialPostings = asRecord(officialPostingsView);
  const economicFiscal = asRecord(economicFiscalView);
  const marketPrice = asRecord(marketPriceView);
  const npcEconomy = asRecord(npcEconomyView);
  const posting = currentPostingFromView(officialPostings);
  const postingSummary = getPostingSummary(posting, player);
  const fiscalReports = getFiscalReports(economicFiscal);
  const marketRows = getMarketPriceRows(marketPrice);
  const economyEvents = getEconomyEvents(npcEconomy);
  const priceIndex = cleanCount(marketPrice.averagePriceIndex, 100);
  const monthlyPeriod = cleanMagistrateText(npcEconomy.lastMonthlyPeriodKey, "未月结", 24);
  const metrics = domainMetrics(localAffairs);
  const urgentDockets = topDockets(localAffairs);
  const judicialDockets = docketsByDomain(localAffairs, ["judicial"], 2);
  const waterBanditDockets = docketsByDomain(localAffairs, ["waterworks", "banditry", "relief"], 3);
  const gentryDockets = docketsByDomain(localAffairs, ["gentry", "corvee"], 2);
  const totalDockets = cleanCount(asRecord(localAffairs.counts).total, urgentDockets.length);
  const dateLabel = cleanMagistrateText(localAffairs.dateLabel || economicFiscal.dateLabel, "时令未载", 36);
  const playerName = getPlayerName(player);
  const backgroundPath = safeAssetPath(roleBackgroundPath);
  const backgroundStyle = backgroundPath ? ({ "--scholar-panel-bg": `url(${backgroundPath})` } as CSSProperties) : undefined;
  const canDraft = runnable !== false;

  return (
    <section
      className="scholarPanel magistratePanel"
      aria-labelledby="magistrate-panel-title"
      data-role-background={backgroundPath ?? "/assets/ui/roles/role-magistrate-yamen-desk-v1.webp"}
      style={backgroundStyle}
    >
      <header className="scholarPanelHeader">
        <div>
          <p className="scholarPanelEyebrow">县衙 · {dateLabel}</p>
          <h2 id="magistrate-panel-title">地方官署</h2>
          <p>{playerName}署理{postingSummary.office}，案牍、钱粮、水利、盗警和士绅关系只读服务器安全投影。</p>
          <p>{postingSummary.summary}</p>
        </div>
        <dl className="scholarPanelStatus" aria-label="地方官摘要">
          <div>
            <dt>任所</dt>
            <dd>{postingSummary.city}</dd>
          </div>
          <div>
            <dt>案牍</dt>
            <dd>{totalDockets} 件</dd>
          </div>
          <div>
            <dt>边界</dt>
            <dd>只写草稿，结果由服务器裁决</dd>
          </div>
        </dl>
      </header>

      <div className="scholarPanelGrid magistratePanelGrid">
        <RoleCycleSection
          roleCycleView={roleCycleView}
          idPrefix="magistrate-role-cycle"
          runnable={runnable}
          resolveRouteHref={resolveRoleCycleRouteHref}
          onOpenSurface={onOpenRoleCycleSurface}
          onDraft={onDraft}
        />
        <article className="scholarPanelCard magistratePanelDocket" aria-labelledby="magistrate-ledger-title">
          <h3 id="magistrate-ledger-title">案牍总览</h3>
          <ul className="scholarPanelMetrics" aria-label="地方事务压力">
            {metrics.map((item) => (
              <li key={item.key}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <em>{item.status}</em>
              </li>
            ))}
          </ul>
          <section className="scholarPanelSubsection" aria-labelledby="magistrate-urgent-title">
            <h4 id="magistrate-urgent-title">急牍</h4>
            <MagistratePanelList items={urgentDockets} emptyText="暂无急牍，先巡查县中仓储、衙署和街市。" />
          </section>
          {draftButtonText("查阅案牍", "查阅县衙案牍，先列刑名、钱粮、水利、盗匪与士绅关系的轻重缓急。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard magistratePanelTrial" aria-labelledby="magistrate-trial-title">
          <h3 id="magistrate-trial-title">公堂词讼</h3>
          <p>堂审只能形成行动意图；证据采信、成案、刑名处分和长期影响继续由服务器 resolver 裁决。</p>
          <MagistratePanelList items={judicialDockets} emptyText="暂无刑名急件，可先核对旧案口供与案卷。" />
          {draftButtonText("升堂核案", "升堂核问积案，核对公开证词、案卷日期与里甲呈报，不自行结案。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard magistratePanelFiscal" aria-labelledby="magistrate-fiscal-title">
          <h3 id="magistrate-fiscal-title">钱粮仓储</h3>
          <dl className="scholarPanelCompactDl">
            <div>
              <dt>{fiscalReports.localTreasury.title}</dt>
              <dd>{fiscalReports.localTreasury.status} · 承载 {fiscalReports.localTreasury.capacity}</dd>
            </div>
            <div>
              <dt>{fiscalReports.grainMarket.title}</dt>
              <dd>{fiscalReports.grainMarket.status} · 粮价 {fiscalReports.grainMarket.marketPressure}</dd>
            </div>
            <div>
              <dt>赈济</dt>
              <dd>压力 {fiscalReports.localTreasury.reliefPressure}</dd>
            </div>
            <div>
              <dt>市价</dt>
              <dd>指数 {priceIndex}</dd>
            </div>
            <div>
              <dt>月账</dt>
              <dd>{monthlyPeriod}</dd>
            </div>
          </dl>
          <p>{fiscalReports.localTreasury.summary}</p>
          <p>{fiscalReports.grainMarket.summary}</p>
          <MagistratePanelList items={fiscalReports.incidents} emptyText="暂无财赋预警。" />
          <section className="scholarPanelSubsection" aria-labelledby="magistrate-market-title">
            <h4 id="magistrate-market-title">基础市价</h4>
            <MagistratePanelList items={marketRows} emptyText="市价待服务器刷新。" />
          </section>
          <section className="scholarPanelSubsection" aria-labelledby="magistrate-economy-title">
            <h4 id="magistrate-economy-title">NPC 月账</h4>
            <MagistratePanelList items={economyEvents} emptyText="暂无月结事件。" />
          </section>
          {draftButtonText("清厘钱粮", "会同典吏清厘钱粮、仓储与赈济簿册，具明疑点候服务器裁决。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard magistratePanelPatrol" aria-labelledby="magistrate-patrol-title">
          <h3 id="magistrate-patrol-title">水利盗警</h3>
          <MagistratePanelList items={waterBanditDockets} emptyText="暂无水利或盗警急件，可先巡堤察市。" />
          <div className="scholarPanelActions">
            {draftButtonText("勘修水利", "召集里正与工匠勘查河堤闸坝，先拟工料、徭役和赈济风险。", canDraft, onDraft)}
            {draftButtonText("巡缉盗警", "带吏役巡查街市、保甲与驿路盗警，记录疑点而不直接结算缉捕。", canDraft, onDraft)}
          </div>
        </article>

        <article className="scholarPanelCard magistratePanelGentry" aria-labelledby="magistrate-gentry-title">
          <h3 id="magistrate-gentry-title">士绅乡约</h3>
          <p>士绅、里甲、胥吏与民情只作公开关系线索；捐输、施压、弹劾和声望变化仍由服务器写定。</p>
          <MagistratePanelList items={gentryDockets} emptyText="暂无士绅急件，可先召集乡约听取公议。" />
          {draftButtonText("调停乡约", "召集士绅、里甲与胥吏公议，调停词讼和徭役争执，先写成行动草稿。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard magistratePanelBoundary" aria-labelledby="magistrate-boundary-title">
          <h3 id="magistrate-boundary-title">裁决边界</h3>
          <ul className="scholarPanelBoundary">
            <li>本面板只读地方案牍、官职任所和财赋市场安全 projection。</li>
            <li>按钮只把玩家意图写入奏折草稿，不提交回合、不调用 resolver。</li>
            <li>审案、征税、开仓、水利、缉捕、任免、考成和持久化都由服务器裁决。</li>
            <li>基础市价和 NPC 月账由后端旬更/月结；前端只显示，不成交、不改账。</li>
          </ul>
          <dl className="scholarPanelCompactDl">
            <div>
              <dt>考成</dt>
              <dd>{postingSummary.performance}</dd>
            </div>
            <div>
              <dt>风评</dt>
              <dd>{postingSummary.risk}</dd>
            </div>
            <div>
              <dt>名望</dt>
              <dd>{postingSummary.reputation}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}

function MagistratePanelList({ items, emptyText }: { readonly items: readonly SafeListItem[]; readonly emptyText: string }) {
  if (!items.length) {
    return <p className="scholarPanelEmpty">{emptyText}</p>;
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
