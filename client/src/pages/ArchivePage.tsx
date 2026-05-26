import { Link, useParams } from "react-router";
import type { JsonObject, JsonValue } from "../api";
import { CrossPageTraceRail, type CrossPageTraceItem, type CrossPageTraceState } from "../components/CrossPageTraceRail";
import { DomainConsequenceSection } from "../components/DomainConsequenceSection";
import { NpcFollowUpEvidenceSection } from "../components/NpcFollowUpEvidenceSection";
import { markOverlayTrigger } from "../components/overlayFocus";
import { isRouteLocalSessionId, isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";
import { rewritePlayerFacingWorldText } from "../text/worldText";

type ArchiveItem = {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly dateLabel: string;
  readonly statusLabel: string;
  readonly riskLabel?: string;
  readonly relatedLabels: readonly string[];
};

type ArchiveReaderRow = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

const archiveVisibleItemLimit = 12;

const unsafeArchiveFragments = [
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
  "stateDelta",
  "playerDelta",
  "evidenceRefs",
  "outcomeId",
  "auditRecord",
  "cityPolicyLedger",
  "militaryDiplomacyLedger",
  "judicialCaseLedger",
  "npcEconomyLedger",
  "event_archive_index",
  "prompt_retrieval_index",
  "safe_search_index",
  "world_sessions",
  "world_state_json",
  "data/sessions",
  "data\\sessions",
  "file://",
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "MIMO_API_KEY",
  "ANTHROPIC_API_KEY",
  "完整提示词",
  "提示词",
  "本地路径",
  "密钥",
  "隐藏",
  "私档",
  "密档"
] as const;
const localArchivePathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|mnt|users|private|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;

function isRecord(value: JsonValue | unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: JsonValue | unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function asArray(value: JsonValue | unknown): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function cleanArchivePageText(value: unknown, fallback = "未载", maxLength = 140) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (localArchivePathPattern.test(text) || /sk-[a-z0-9_-]{6,}|tp-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (unsafeArchiveFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}…` : rewritten;
}

function cleanOptionalArchiveText(value: unknown, maxLength = 96) {
  const cleaned = cleanArchivePageText(value, "", maxLength);
  return cleaned || undefined;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function prioritizeArchiveItems(items: ArchiveItem[]) {
  const visible = items.slice(0, archiveVisibleItemLimit);
  if (visible.some((item) => item.sourceType === "world_entity_impact")) return visible;
  const entityImpact = items.find((item) => item.sourceType === "world_entity_impact");
  if (!entityImpact) return visible;
  if (visible.length < archiveVisibleItemLimit) return [...visible, entityImpact];
  return [...visible.slice(0, archiveVisibleItemLimit - 1), entityImpact];
}

function buildArchiveItems(view: JsonObject): ArchiveItem[] {
  const items = asArray(view.items)
    .map(asRecord)
    .map((item, index) => {
      const sourceType = cleanArchivePageText(item.sourceType, "event_history", 48);
      const title = cleanArchivePageText(item.title, "史册条目", 64);
      const summary = cleanArchivePageText(item.summary, "", 180);
      return {
        id: cleanArchivePageText(item.id, `archive-item-${index}`, 96),
        sourceType,
        sourceLabel: cleanArchivePageText(item.sourceLabel, sourceType, 32),
        title,
        summary,
        dateLabel: cleanArchivePageText(item.dateLabel, "日期未载", 40),
        statusLabel: cleanArchivePageText(item.statusLabel || item.status, "已记", 28),
        riskLabel: cleanOptionalArchiveText(item.riskLabel, 32),
        relatedLabels: asArray(item.relatedLabels)
          .map((label) => cleanOptionalArchiveText(label, 24))
          .filter(Boolean)
          .slice(0, 4) as string[]
      };
    })
    .filter((item) => item.summary);
  return prioritizeArchiveItems(items);
}

function buildArchiveDigestCards(input: {
  readonly totalItems: number;
  readonly visibleItems: number;
  readonly pageSize: number;
  readonly domainCount: number;
  readonly entityImpactCount: number;
}) {
  const pageSize = input.pageSize || input.visibleItems;
  return [
    {
      label: "入册条目",
      value: String(input.totalItems),
      detail: pageSize ? `本页列 ${input.visibleItems}/${pageSize} 条` : "本页等待归档"
    },
    {
      label: "后果线索",
      value: String(input.domainCount),
      detail: input.domainCount ? "已接入公开后果追踪" : "暂无公开后果"
    },
    {
      label: "实体余波",
      value: String(input.entityImpactCount),
      detail: input.entityImpactCount ? "保留人物与机构回响" : "暂无实体余波"
    }
  ];
}

function countFollowUpEvidence(evidence: JsonValue | unknown) {
  const view = asRecord(evidence);
  const counts = asRecord(view.counts);
  const total = counts.total;
  if (typeof total === "number" && Number.isFinite(total)) return Math.max(0, Math.round(total));
  if (typeof total === "string" && /^\d+$/.test(total)) return Number.parseInt(total, 10);
  return ["people", "economy", "events"].reduce((sum, key) => sum + asArray(view[key]).length, 0);
}

function buildArchiveReaderRows(input: {
  readonly visibleItems: number;
  readonly totalItems: number;
  readonly domainCount: number;
  readonly entityImpactCount: number;
  readonly followUpCount: number;
  readonly canDraft: boolean;
  readonly routeSessionSupported: boolean;
}): ArchiveReaderRow[] {
  const archiveCount = input.visibleItems || input.totalItems;
  return [
    {
      label: "主列",
      value: input.routeSessionSupported
        ? archiveCount
          ? `近次 ${archiveCount} 条已入册`
          : "暂待入册"
        : "案卷暂不可读",
      detail: "只读公开条目；据此拟稿仍回主卷候复。"
    },
    {
      label: "旁注",
      value: input.domainCount || input.followUpCount
        ? `${input.domainCount} 条后果，${input.followUpCount} 条来函`
        : "旁注暂待留痕",
      detail: "旁注只看公开后果与来函线索。"
    },
    {
      label: "追索",
      value: input.entityImpactCount ? `${input.entityImpactCount} 条实体余波已留痕` : "实体余波未载",
      detail: "案卷未载者不补造。"
    },
    {
      label: "拟稿",
      value: input.canDraft ? "可留作草稿" : "先择可读案卷",
      detail: "不结算资源、关系、任免或未公开事实。"
    }
  ];
}

export function ArchivePage() {
  const { sessionId = "s74-preview" } = useParams();
  const currentSession = useGameSessionStore((state) => state.currentSession);
  const status = useGameSessionStore((state) => state.status);
  const openSurfaceForSession = useUiStateStore((state) => state.openSurfaceForSession);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const routeSessionSupported = isRouteLocalSessionId(sessionId);
  const sessionMatches = routeSessionSupported && currentSession?.sessionId === sessionId;
  const archiveView = asRecord(sessionMatches ? currentSession?.eventArchiveView : null);
  const domainConsequenceView = sessionMatches ? currentSession?.domainConsequenceView ?? null : null;
  const npcFollowUpEvidence = sessionMatches ? currentSession?.npcActiveRequestView?.followUpEvidence ?? null : null;
  const archiveItems = buildArchiveItems(archiveView);
  const pagination = asRecord(archiveView.pagination);
  const counts = asRecord(archiveView.counts);
  const domainCount = numberValue(counts.domain_consequence);
  const entityImpactCount = numberValue(counts.world_entity_impact);
  const followUpCount = countFollowUpEvidence(npcFollowUpEvidence);
  const totalItems = numberValue(pagination.totalItems ?? counts.total);
  const pageSize = numberValue(pagination.pageSize, archiveItems.length);
  const digestCards = buildArchiveDigestCards({
    totalItems,
    visibleItems: archiveItems.length,
    pageSize,
    domainCount,
    entityImpactCount
  });
  const leadItems = archiveItems.slice(0, 3);
  const isRunnable = isRunnableSessionId(sessionId);
  const canDraft = sessionMatches || isRunnable;
  const archiveReaderRows = buildArchiveReaderRows({
    visibleItems: archiveItems.length,
    totalItems,
    domainCount,
    entityImpactCount,
    followUpCount,
    canDraft,
    routeSessionSupported
  });
  const mapHref = routeSessionSupported ? `/game/${sessionId}/map` : "/";
  const peopleHref = routeSessionSupported ? `/game/${sessionId}/people` : "/";
  const courtHref = routeSessionSupported ? `/game/${sessionId}/court` : "/";
  const gameHref = routeSessionSupported ? `/game/${sessionId}` : "/";
  const crossTraceState: CrossPageTraceState = routeSessionSupported
    ? archiveItems.length || domainCount || entityImpactCount || followUpCount
      ? "ready"
      : "empty"
    : "unsupported";
  const crossTraceItems: readonly CrossPageTraceItem[] = [
    {
      target: "archive",
      label: "史册留痕",
      value: archiveItems.length ? `近次 ${archiveItems.length} 条` : "待入册",
      detail: "史册只收已入卷条目；未公开材料不会补入旁注。",
      href: `/game/${sessionId}/archive`,
      actionLabel: "留本页"
    },
    {
      target: "people",
      label: "人物线索",
      value: followUpCount ? `${followUpCount} 条来函` : "查来人",
      detail: "要查来人、拜会、人情债或礼法余波，可回人物页看公开名册。",
      href: peopleHref,
      actionLabel: "查人物"
    },
    {
      target: "court",
      label: "朝议专题",
      value: domainCount ? `${domainCount} 条后果` : "可成题",
      detail: "要把后果、来函和案牍整理成议题，可入朝议页择专题。",
      href: courtHref,
      actionLabel: "入朝议"
    },
    {
      target: "game",
      label: "回主卷",
      value: canDraft ? "可留草稿" : "先择案卷",
      detail: "史册按钮只写候复草稿，不直接推进回合或结算后果。",
      href: gameHref,
      actionLabel: "回主卷候复"
    }
  ];

  function draftFromArchive(item: ArchiveItem) {
    setActionDraft({
      source: "archive-view",
      targetPage: "game",
      text: `据史册公开条目「${item.title}」，先核对${item.sourceLabel}、日期和相关线索，整理成下一旬行动草稿。`
    });
  }

  return (
    <article className="surfacePanel routePanel archiveRoutePanel" aria-labelledby="archive-title" data-polish-archive="s89-10-chronicle-density">
      <header className="archiveRouteHeader">
        <div>
          <p className="eyebrow">史册</p>
          <h1 id="archive-title">史册</h1>
          <p>风闻、案牍、朝报、后果与旧事归入公开卷宗；这里只读已载档案，行动仍回主卷呈上。</p>
        </div>
        <dl className="archiveStats" aria-label="史册统计">
          <div>
            <dt>条目</dt>
            <dd>{totalItems}</dd>
          </div>
          <div>
            <dt>本页</dt>
            <dd>{archiveItems.length}/{pageSize || archiveItems.length}</dd>
          </div>
          <div>
            <dt>后果</dt>
            <dd>{domainCount}</dd>
          </div>
          <div>
            <dt>实体</dt>
            <dd>{entityImpactCount}</dd>
          </div>
        </dl>
      </header>

      <div className="archiveActionRow">
        <button
          className="paperButton"
          type="button"
          disabled={!routeSessionSupported}
          onClick={(event) => {
            if (!routeSessionSupported) return;
            markOverlayTrigger(event.currentTarget);
            openSurfaceForSession("memorial-review", sessionId);
          }}
        >
          阅奏折
        </button>
        <Link className="paperLink" to={mapHref}>入舆图</Link>
        <Link className="paperLink" to={gameHref}>回主卷</Link>
      </div>

      <section className="archiveDigestBand" aria-label="史册案卷索引">
        <div className="archiveDigestIntro">
          <p className="eyebrow">案卷索引</p>
          <h2>近次线索</h2>
          <p>
            {archiveItems.length
              ? "先看近次公开条目、后果线索与实体余波；拟稿仍只回主卷候复。"
              : routeSessionSupported
              ? "当前史册尚待入卷，推进一旬或有回批后会留下公开线索。"
              : "案卷索引暂不可取材；请先回首页选择可读案卷。"}
          </p>
        </div>
        <dl className="archiveDigestStats">
          {digestCards.map((card) => (
            <div key={card.label}>
              <dt>{card.label}</dt>
              <dd>{card.value}</dd>
              <dd className="archiveDigestDetail">{card.detail}</dd>
            </div>
          ))}
        </dl>
        {leadItems.length ? (
          <ol className="archiveLeadList" aria-label="史册近次线索">
            {leadItems.map((item) => (
              <li className="paperMotionCard paperMotionInteractive" key={`lead-${item.id}`}>
                <span>{item.sourceLabel}</span>
                <strong>{item.title}</strong>
                <em>{item.statusLabel}</em>
              </li>
            ))}
          </ol>
        ) : (
          <p className="archiveLeadEmpty">暂无近次线索；本页不会补入未公开材料。</p>
        )}
      </section>

      <section
        className="scholarPanelCard"
        aria-label="史册证据读法"
        data-polish-archive-reader="s89-29-evidence-reader"
      >
        <p className="eyebrow">史册追索笺</p>
        <h2>史册证据读法</h2>
        <dl className="surfaceSafetyList">
          {archiveReaderRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
              <dd>{row.detail}</dd>
            </div>
          ))}
        </dl>
        <p className="statusLine" data-polish-archive-boundary="s89-29-evidence-boundary">
          主列看已入册公开条目，旁注看公开后果与来函线索；按钮只写案头草稿，仍回主卷候复。
        </p>
      </section>
      <CrossPageTraceRail
        page="archive"
        state={crossTraceState}
        items={crossTraceItems}
        summary="史册只收已入卷条目；要查来人去人物页，要成议题入朝议页。"
      />

      <section
        className="archiveTraceGrid"
        aria-label="史册公开追踪"
        data-archive-layout="ledger-rail"
        data-polish-archive-trace="s89-10-chronicle-density"
      >
        <div className="archiveColumn">
          <h3>近次归档</h3>
          {archiveItems.length ? (
            <ol className="archiveItemList">
              {archiveItems.map((item) => (
                <li className="paperMotionCard paperMotionInteractive" key={item.id} data-source-type={item.sourceType}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.sourceLabel} · {item.dateLabel} · {item.statusLabel}</span>
                  </div>
                  <p>{item.summary}</p>
                  {item.riskLabel || item.relatedLabels.length ? (
                    <p className="archiveMetaLine">
                      {[item.riskLabel, ...item.relatedLabels].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  <button className="paperButton" type="button" onClick={() => draftFromArchive(item)}>
                    据此拟稿
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="archiveEmpty">
              {!routeSessionSupported
                ? "此案卷编号暂不可用于浏览器史册；请从首页开卷或载入旧案。"
                : isRunnable && status === "loading"
                ? "正在读取本局史册。"
                : "暂无可显示的公开归档；推进一旬或有回批后会进入史册。"}
            </p>
          )}
        </div>

        <aside className="archiveEvidenceStack" aria-label="史册旁注证据">
          <DomainConsequenceSection
            domainConsequenceView={domainConsequenceView}
            title="史册后果追踪"
            summaryFallback="史册页只显示已经入卷的公开后果；内账、私记和未公开证据不会进入玩家视野。"
            emptyText="暂无公开领域后果归档。"
            maxItems={4}
            runnable={canDraft}
            onDraft={(text) => setActionDraft({ source: "archive-view", targetPage: "game", text })}
          />
          <NpcFollowUpEvidenceSection
            evidence={npcFollowUpEvidence}
            title="来函证据追踪"
            summaryFallback="史册页只读展示主动来函后续线索；引荐拜会、人情债月账、请托案牍和风宪关注仍要回主卷呈上候复。"
            boundaryText="史册页只显示已公开来函线索；按钮只写草稿，不结算资源、人情债、婚姻、弹劾、定罪、背叛或未公开事实。"
            idPrefix="archive-follow-up-evidence"
            maxItems={4}
            runnable={canDraft}
            onDraft={(text) => setActionDraft({ source: "archive-view", targetPage: "game", text })}
          />
        </aside>
      </section>

      <p className="archiveBoundary">史册条目只来自已公开卷宗；内廷材料、密档、私记和底账不会进入玩家视野。</p>
    </article>
  );
}
