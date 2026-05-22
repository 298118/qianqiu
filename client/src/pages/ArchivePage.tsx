import { Link, useParams } from "react-router";
import type { JsonObject, JsonValue } from "../api";
import { DomainConsequenceSection } from "../components/DomainConsequenceSection";
import { NpcFollowUpEvidenceSection } from "../components/NpcFollowUpEvidenceSection";
import { markOverlayTrigger } from "../components/overlayFocus";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";

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

const unsafeArchiveFragments = [
  "provider",
  "proposal",
  "raw",
  "prompt",
  "path",
  "key",
  "hidden",
  "sealed",
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
  if (/[a-z]:[\\/]/i.test(text) || /sk-[a-z0-9_-]{6,}|tp-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (unsafeArchiveFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function cleanOptionalArchiveText(value: unknown, maxLength = 96) {
  const cleaned = cleanArchivePageText(value, "", maxLength);
  return cleaned || undefined;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function buildArchiveItems(view: JsonObject): ArchiveItem[] {
  return asArray(view.items)
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
    .filter((item) => item.summary)
    .slice(0, 12);
}

export function ArchivePage() {
  const { sessionId = "s74-preview" } = useParams();
  const currentSession = useGameSessionStore((state) => state.currentSession);
  const status = useGameSessionStore((state) => state.status);
  const openSurface = useUiStateStore((state) => state.openSurface);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const sessionMatches = currentSession?.sessionId === sessionId;
  const archiveView = asRecord(sessionMatches ? currentSession?.eventArchiveView : null);
  const domainConsequenceView = sessionMatches ? currentSession?.domainConsequenceView ?? null : null;
  const npcFollowUpEvidence = sessionMatches ? currentSession?.npcActiveRequestView?.followUpEvidence ?? null : null;
  const archiveItems = buildArchiveItems(archiveView);
  const pagination = asRecord(archiveView.pagination);
  const counts = asRecord(archiveView.counts);
  const domainCount = numberValue(counts.domain_consequence);
  const totalItems = numberValue(pagination.totalItems ?? counts.total);
  const pageSize = numberValue(pagination.pageSize, archiveItems.length);
  const isRunnable = isRunnableSessionId(sessionId);
  const canDraft = sessionMatches || isRunnable;

  function draftFromArchive(item: ArchiveItem) {
    setActionDraft({
      source: "archive-view",
      targetPage: "game",
      text: `据史册公开条目「${item.title}」，先核对${item.sourceLabel}、日期和相关线索，整理成下一旬行动草稿。`
    });
  }

  return (
    <article className="surfacePanel routePanel archiveRoutePanel" aria-labelledby="archive-title">
      <header className="archiveRouteHeader">
        <div>
          <p className="eyebrow">史册</p>
          <h2 id="archive-title">史册</h2>
          <p>风闻、案牍、朝报、后果与旧事归入公开卷宗；这里只读安全档案，行动仍回主卷提交。</p>
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
        </dl>
      </header>

      <div className="archiveActionRow">
        <button className="paperButton" type="button" onClick={(event) => { markOverlayTrigger(event.currentTarget); openSurface("memorial-review"); }}>
          阅奏折
        </button>
        <Link className="paperLink" to={`/game/${sessionId}/map`}>入舆图</Link>
        <Link className="paperLink" to={`/game/${sessionId}`}>回主卷</Link>
      </div>

      <section className="archiveTraceGrid" aria-label="史册公开追踪">
        <div className="archiveColumn">
          <h3>近次归档</h3>
          {archiveItems.length ? (
            <ol className="archiveItemList">
              {archiveItems.map((item) => (
                <li key={item.id} data-source-type={item.sourceType}>
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
              {isRunnable && status === "loading"
                ? "正在读取 player-state 中的安全史册投影。"
                : "暂无可显示的公开归档；推进一旬或完成服务器裁决后会进入史册。"}
            </p>
          )}
        </div>

        <DomainConsequenceSection
          domainConsequenceView={domainConsequenceView}
          title="史册后果追踪"
          summaryFallback="史册页只显示服务器已裁决的公开领域后果；内部账本、证据链和审计原文不会进入玩家视图。"
          emptyText="暂无公开领域后果归档。"
          maxItems={4}
          runnable={canDraft}
          onDraft={(text) => setActionDraft({ source: "archive-view", targetPage: "game", text })}
        />
        <NpcFollowUpEvidenceSection
          evidence={npcFollowUpEvidence}
          title="来函证据追踪"
          summaryFallback="史册页只读展示主动来函后续 evidence；引荐拜会、人情债月账、请托案牍和风宪 watchlist 仍要回主卷提交，由服务器裁决。"
          boundaryText="史册页只显示服务器安全投影中的来函线索；按钮只写草稿，不结算资源、人情债、婚姻、弹劾、定罪、背叛或未公开事实。"
          idPrefix="archive-follow-up-evidence"
          maxItems={4}
          runnable={canDraft}
          onDraft={(text) => setActionDraft({ source: "archive-view", targetPage: "game", text })}
        />
      </section>

      <p className="archiveBoundary">史册条目只来自服务器整理后的公开卷宗；内部材料、密档、私记和原始账簿不会进入玩家视图。</p>
    </article>
  );
}
