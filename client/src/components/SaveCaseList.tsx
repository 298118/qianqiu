import { Link } from "react-router";
import type { ReactNode } from "react";
import type { SaveMetadata } from "../api";
import { isRunnableSessionId } from "../routes/sessionId";
import { getPlayerIdentityLabel } from "../text/playerLabels";

const tenDayLabels: Record<number, string> = {
  1: "上旬",
  2: "中旬",
  3: "下旬"
};

const unsafeSaveTextPattern = /\/api\/game\/state|\/api\/dev\/session-diagnostics|data[\\/]+sessions|raw\s*(audit|state|prompt)?|provider\s*payload|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[a-z0-9_-]+|\bTODO\b|\bFIXME\b|\bsmoke\b|\bartifacts?\b|\bS7[0-9](?:\.\d+)?\b|\bdebug\b|\bstub\b|\bplaceholder\b|fallback token|完整提示词|本地路径|密钥|验收|测试截图|开发注释|实现说明/i;

type SaveCaseListProps = {
  readonly saves: readonly SaveMetadata[];
  readonly maxItems: number;
  readonly className?: string;
  readonly actionLabel?: string;
  readonly onLoad?: (sessionId: string) => void;
};

function textOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeTextOrFallback(value: unknown, fallback: string) {
  const text = textOrFallback(value, fallback);
  return unsafeSaveTextPattern.test(text) ? fallback : text;
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function getSaveShortCode(save: SaveMetadata) {
  const sessionId = textOrFallback(save.sessionId, "");
  return /^[a-f0-9-]{8,}$/i.test(sessionId) ? sessionId.slice(0, 8) : "unknown";
}

export function getSaveIdentityLabel(save: SaveMetadata) {
  return safeTextOrFallback(getPlayerIdentityLabel(save), "身份未题");
}

export function getSaveDateLabel(save: SaveMetadata) {
  const year = numberOrNull(save.year);
  const month = numberOrNull(save.month);
  const tenDayPeriod = numberOrNull(save.tenDayPeriod);
  const dynasty = safeTextOrFallback(save.dynasty, "");

  if (year === null && month === null && tenDayPeriod === null && !dynasty) return "年月未详";

  const yearLabel = year === null ? "年份未详" : `${year}年`;
  const monthLabel = month === null ? "月未详" : `${month}月`;
  const periodLabel = tenDayPeriod === null ? "旬未详" : tenDayLabels[tenDayPeriod] || `第${tenDayPeriod}旬`;
  return `${dynasty}${yearLabel}${monthLabel}${periodLabel}`;
}

export function getSaveTurnLabel(save: SaveMetadata) {
  const turnCount = numberOrNull(save.turnCount);
  return turnCount === null ? "回合未记" : `第 ${turnCount} 回合`;
}

export function getSaveUpdatedLabel(save: SaveMetadata) {
  const value = textOrFallback(save.updatedAt, "");
  if (!value) return "更新时间未记";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "更新时间未记";
  return parsed.toISOString().slice(0, 16).replace("T", " ");
}

function renderAction(save: SaveMetadata, actionLabel: string, onLoad?: (sessionId: string) => void): ReactNode {
  const sessionId = textOrFallback(save.sessionId, "");
  if (!isRunnableSessionId(sessionId)) {
    return (
      <button className="paperButton saveCaseAction" type="button" disabled>
        暂不可读
      </button>
    );
  }

  if (onLoad) {
    return (
      <button className="paperButton saveCaseAction" type="button" onClick={() => onLoad(sessionId)}>
        {actionLabel}
      </button>
    );
  }

  return (
    <Link className="paperButton saveCaseAction" to={`/game/${sessionId}`}>
      {actionLabel}
    </Link>
  );
}

export function SaveCaseList({ saves, maxItems, className = "", actionLabel = "读档", onLoad }: SaveCaseListProps) {
  return (
    <div className={`saveCaseList${className ? ` ${className}` : ""}`}>
      {saves.slice(0, maxItems).map((save) => (
        <article className="saveCaseItem paperMotionCard paperMotionInteractive" key={save.sessionId}>
          <div className="saveCaseTopline">
            <span className="saveCaseCode">案 {getSaveShortCode(save)}</span>
            <span>{getSaveUpdatedLabel(save)}</span>
          </div>
          <div className="saveCaseTitleRow">
            <h3>{safeTextOrFallback(save.playerName, "无名")}</h3>
            <strong>{getSaveIdentityLabel(save)}</strong>
          </div>
          <p className="saveCaseSummary">{safeTextOrFallback(save.summary, "此卷暂无公开摘要。")}</p>
          <dl className="saveCaseMeta">
            <div>
              <dt>年月</dt>
              <dd>{getSaveDateLabel(save)}</dd>
            </div>
            <div>
              <dt>回合</dt>
              <dd>{getSaveTurnLabel(save)}</dd>
            </div>
          </dl>
          {renderAction(save, actionLabel, onLoad)}
        </article>
      ))}
    </div>
  );
}
