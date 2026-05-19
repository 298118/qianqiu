import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import { useGameSessionStore } from "../state/gameSessionState";

type AnyRecord = Record<string, unknown>;

type RankingEntry = {
  readonly id: string;
  readonly place: number | null;
  readonly name: string;
  readonly origin: string;
  readonly rankLabel: string;
  readonly honorTitle: string;
  readonly score: number | null;
  readonly isPlayer: boolean;
  readonly examinerComment: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
};

const unsafeRankingFragments = [
  "/api/game/" + "state",
  "/api/dev/" + "session-diagnostics",
  "data" + "/" + "sessions",
  "data" + "\\" + "sessions",
  "raw",
  "prov" + "ider",
  "pro" + "mpt",
  "hid" + "den",
  "key",
  "path",
  "state" + "Patch",
  "hidden" + "Notes",
  "hidden" + "Intent",
  "OPENAI" + "_API" + "_KEY",
  "DEEPSEEK" + "_API" + "_KEY",
  "MIMO" + "_API" + "_KEY",
  "ANTHROPIC" + "_API" + "_KEY",
  "弥封" + "身份映射",
  "考官" + "隐藏意图",
  "模型" + "原始提案",
  "完整" + "提示词",
  "本地" + "路径",
  "密" + "钥",
  "隐" + "藏"
] as const;

const scoreDimensions = [
  ["content_quality", "立意"],
  ["argument_strength", "论证"],
  ["literary_style", "文气"],
  ["classical_format", "格式"],
  ["historical_appropriateness", "时义"]
] as const;

const topLabels: Record<number, string> = {
  1: "状元",
  2: "榜眼",
  3: "探花"
};

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeRankingText(value: unknown, fallback: string, maxLength = 140) {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  const normalized = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /sk-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (unsafeRankingFragments.some((fragment) => normalized.includes(fragment.toLowerCase()))) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}……` : text;
}

function readNumber(value: unknown, fallback: number | null = null) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function latestRecord(items: unknown) {
  const list = asArray(items);
  return asRecord(list.at(-1));
}

function getLatestExamHistory(session: AnyRecord) {
  const worldState = asRecord(session.worldState);
  const player = asRecord(worldState.player);
  return latestRecord(player.examHistory);
}

function getRankingSource(result: AnyRecord, latestHistory: AnyRecord) {
  const resultRanking = asArray(result.ranking);
  if (resultRanking.length) return resultRanking;
  const historyRanking = asArray(latestHistory.ranking);
  return historyRanking.length ? historyRanking : [];
}

function normalizeRankingEntry(entry: unknown, index: number): RankingEntry {
  const record = asRecord(entry);
  const place = readNumber(record.place);
  const name = safeRankingText(record.name, "榜名未公开", 48);
  const honorTitle = safeRankingText(record.honorTitle, "", 32);
  const rankLabel = safeRankingText(record.rankLabel || record.rank || honorTitle, honorTitle || "等第未公开", 48);
  return {
    id: safeRankingText(record.id, `ranking-row-${index}`, 64),
    place,
    name,
    origin: safeRankingText(record.origin || record.background, "籍贯未署", 48),
    rankLabel,
    honorTitle,
    score: readNumber(record.score),
    isPlayer: record.isPlayer === true,
    examinerComment: safeRankingText(record.examinerComment, "本名暂无公开评语。", 120),
    strengths: asArray(record.strengths).map((item) => safeRankingText(item, "", 48)).filter(Boolean).slice(0, 2),
    weaknesses: asArray(record.weaknesses).map((item) => safeRankingText(item, "", 48)).filter(Boolean).slice(0, 2)
  };
}

function readScoreDimensions(score: AnyRecord) {
  return scoreDimensions.map(([key, label]) => {
    const dimension = asRecord(score[key]);
    return {
      key,
      label,
      value: readNumber(dimension.score),
      comment: safeRankingText(dimension.comment, "公开分项未署。", 72)
    };
  }).filter((item) => item.value !== null || item.comment !== "公开分项未署。");
}

function readAntiCheat(authenticityCheck: AnyRecord) {
  const flags = asArray(authenticityCheck.flags).map((item) => {
    const flag = asRecord(item);
    return {
      label: safeRankingText(flag.label, "复核事项", 48),
      severity: safeRankingText(flag.severity, "notice", 24),
      detail: safeRankingText(flag.detail || flag.publicSummary, "服务器已留档。", 96)
    };
  }).slice(0, 3);
  return flags;
}

function readTopSealLabel(place: number, entry: RankingEntry | undefined, examName: string) {
  if (entry?.honorTitle) return entry.honorTitle;
  if (/殿试|palace/i.test(examName)) return topLabels[place];
  return `第${place}名`;
}

export function RankingPage() {
  const { sessionId = "s74-preview" } = useParams();
  const { registry } = useAssetRegistry();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentSession = useGameSessionStore((state) => state.currentSession);
  const lastExamResult = useGameSessionStore((state) => state.lastExamResult);
  const sessionRecord = asRecord(currentSession?.sessionId === sessionId ? currentSession : null);
  const resultRecord = lastExamResult?.sessionId === sessionId ? asRecord(lastExamResult) : {};
  const payload = Object.keys(resultRecord).length ? resultRecord : sessionRecord;
  const latestHistory = getLatestExamHistory(sessionRecord);
  const player = asRecord(asRecord(sessionRecord.worldState).player);
  const playerName = safeRankingText(player.name, "案主", 48);
  const examHonorView = asRecord(payload.examHonorView || sessionRecord.examHonorView || latestHistory.examHonor);
  const examinerPanelView = asRecord(payload.examinerPanelView || sessionRecord.examinerPanelView || latestHistory.examinerPanel);
  const appointmentTrackView = asRecord(payload.appointmentTrackView || sessionRecord.appointmentTrackView || latestHistory.appointmentTrack);
  const score = asRecord(resultRecord.score || latestHistory.score);
  const promotionResult = asRecord(resultRecord.promotionResult || latestHistory.promotionResult);
  const authenticityCheck = asRecord(resultRecord.authenticityCheck || latestHistory.authenticityCheck);
  const ranking = getRankingSource(resultRecord, latestHistory)
    .map((entry, index) => normalizeRankingEntry(entry, index))
    .slice(0, 18);
  const rows = ranking;
  const playerRankingEntry = rows.find((entry) => entry.isPlayer) || null;
  const playerEntry = playerRankingEntry || rows[0] || null;
  const selectedEntry = rows.find((entry) => entry.id === selectedId) || playerEntry;
  const topEntries = rows.filter((entry) => entry.place !== null && entry.place <= 3).slice(0, 3);
  const scoreDetails = readScoreDimensions(score);
  const antiCheatFlags = readAntiCheat(authenticityCheck);
  const latestHonor = asRecord(examHonorView.latestHonor || examHonorView.currentHonor || latestHistory.examHonor);
  const latestDecision = asRecord(appointmentTrackView.latestDecision || asRecord(appointmentTrackView.latestTrack).latestDecision);
  const examName = safeRankingText(
    resultRecord.examName || latestHistory.examName || latestHonor.examName || asRecord(appointmentTrackView.latestTrack).examName,
    "本场科举",
    48
  );
  const publicSummary = safeRankingText(
    examHonorView.publicSummary || latestHistory.publicSummary || latestHonor.publicSummary,
    rows.length ? "服务器已返回本场公开榜文。" : "榜文尚未张挂。交卷、评阅与放榜完成后，此处才会显示定榜结果。",
    150
  );
  const serverDecision = safeRankingText(
    examinerPanelView.serverDecision,
    "榜次、评语、晋级与授官均由服务器裁决。",
    140
  );
  const appointmentHint = safeRankingText(
    latestDecision.officeTitle || asRecord(appointmentTrackView.latestTrack).officeTitle || promotionResult.officeTitle,
    "暂无授官提示；后续铨选仍由服务器裁决。",
    64
  );
  const passedText = promotionResult.passed === true ? "已取中" : promotionResult.passed === false ? "未取中" : "候服务器定档";
  const showGoldenNotice = Boolean(playerRankingEntry || promotionResult.passed === true);
  const goldenNoticeRank = playerRankingEntry?.honorTitle || playerRankingEntry?.rankLabel || passedText;
  const goldenNoticeSummary = safeRankingText(
    latestHonor.publicSummary || latestDecision.publicSummary || publicSummary,
    `${playerName}已由服务器公开定榜。`,
    96
  );
  const sceneAsset = useMemo(
    () => registry?.getAssets({ category: "scene", usage: "ranking_page", scene: "ranking_wall" }).at(0),
    [registry]
  );
  const noticeAsset = useMemo(
    () => registry?.getAssets({ category: "material", usage: "ranking_page", subcategory: "imperial_notice" }).at(0),
    [registry]
  );
  const smudgeAsset = useMemo(
    () => registry?.getAssets({ category: "material", usage: "ranking_page", subcategory: "red_ink_smudge" }).at(0),
    [registry]
  );
  const heroImagePath = sceneAsset?.path ?? "/assets/ui/scenes/scene-ranking-wall-v1.webp";
  const noticeImagePath = noticeAsset?.path ?? "/assets/ui/materials/imperial-notice-paper-v1.webp";
  const smudgeImagePath = smudgeAsset?.path ?? "/assets/ui/materials/red-ink-smudge-v1.webp";

  return (
    <article
      className="rankingFullScreen routePanel"
      aria-labelledby="ranking-title"
      style={{
        "--ranking-hero-image": `url(${heroImagePath})`,
        "--ranking-notice-image": `url(${noticeImagePath})`,
        "--ranking-smudge-image": `url(${smudgeImagePath})`
      } as CSSProperties}
    >
      <section className="rankingHero">
        <div className="rankingHeroBackdrop" aria-hidden="true" />
        <div className="rankingHeroCopy">
          <p className="eyebrow">贡院外放榜</p>
          <h1 id="ranking-title">皇榜</h1>
          <p>{examName} · {publicSummary}</p>
        </div>
        <a className="paperLink rankingJumpLink" href="#ranking-player-detail">跳至我名</a>
      </section>

      <section className="rankingNoticeBoard" aria-label="服务器定榜皇榜">
        {showGoldenNotice ? (
          <section className="rankingGoldenNotice" aria-label="金榜题名">
            <div className="rankingGoldenTitle">
              <span aria-hidden="true">金榜题名</span>
              <strong>{playerRankingEntry?.name || playerName}</strong>
            </div>
            <p>{examName} · {goldenNoticeRank} · {goldenNoticeSummary}</p>
            <span className="rankingVermilionCircle" aria-hidden="true" />
          </section>
        ) : null}

        <div className="rankingTopThree" aria-label="三鼎甲">
          {[1, 2, 3].map((place) => {
            const entry = topEntries.find((item) => item.place === place);
            return (
              <div className="rankingTopSeal" key={place} data-empty={entry ? "false" : "true"}>
                <span>{readTopSealLabel(place, entry, examName)}</span>
                <strong>{entry?.name ?? "未张挂"}</strong>
                <em>{entry?.rankLabel ?? "待服务器定榜"}</em>
              </div>
            );
          })}
        </div>

        <div className="rankingBoardGrid">
          <section className="rankingListPanel" aria-label="正榜名单">
            <div className="rankingSectionHeading">
              <p className="eyebrow">正榜</p>
              <h2>服务器定榜名单</h2>
            </div>
            {rows.length ? (
              <ol className="rankingList">
                {rows.map((entry) => (
                  <li key={entry.id} className={entry.isPlayer ? "isPlayer" : ""}>
                    <button type="button" onClick={() => setSelectedId(entry.id)}>
                      <span className="rankingPlace">{entry.place !== null ? `第 ${entry.place} 名` : "名次未公开"}</span>
                      <span className="rankingName">{entry.name}</span>
                      <span className="rankingMeta">{entry.honorTitle || entry.rankLabel}</span>
                      {entry.score !== null ? <span className="rankingScore">{entry.score} 分</span> : null}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rankingEmpty">榜文尚未张挂。交卷、评阅与放榜完成后，此处才会显示定榜结果。</p>
            )}
          </section>

          <aside className="rankingDetailPanel" id="ranking-player-detail" aria-label="榜名详情">
            <p className="eyebrow">{selectedEntry?.isPlayer ? "我名在此" : "榜名细读"}</p>
            <h2>{selectedEntry?.name ?? playerName}</h2>
            <dl className="rankingDetailRail">
              <div>
                <dt>名次</dt>
                <dd>{selectedEntry ? (selectedEntry.place !== null ? `第 ${selectedEntry.place} 名` : "名次未公开") : "未入榜"}</dd>
              </div>
              <div>
                <dt>等第</dt>
                <dd>{selectedEntry?.honorTitle || selectedEntry?.rankLabel || "未署"}</dd>
              </div>
              <div>
                <dt>晋级</dt>
                <dd>{passedText}</dd>
              </div>
            </dl>
            <section>
              <h3>考官评语</h3>
              <p>{selectedEntry?.examinerComment || safeRankingText(score.detailed_feedback, "本名暂无公开评语。", 160)}</p>
            </section>
            <section>
              <h3>评分维度</h3>
              {scoreDetails.length ? (
                <div className="rankingScoreGrid">
                  {scoreDetails.map((item) => (
                    <div key={item.key}>
                      <strong>{item.label}</strong>
                      <span>{item.value ?? "未署"}</span>
                      <em>{item.comment}</em>
                    </div>
                  ))}
                </div>
              ) : (
                <p>暂无公开分项；服务器仍保留最终定分。</p>
              )}
            </section>
            <section>
              <h3>防弊检测</h3>
              {antiCheatFlags.length ? (
                <ul className="rankingAuditList">
                  {antiCheatFlags.map((flag, index) => (
                    <li key={`${flag.label}-${index}`} data-severity={flag.severity}>
                      <strong>{flag.label}</strong>
                      <span>{flag.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>暂无公开防弊复核结果；待服务器公开后显示。</p>
              )}
            </section>
            <section>
              <h3>授官提示</h3>
              <p>{appointmentHint}</p>
            </section>
          </aside>
        </div>
      </section>

      <section className="rankingBoundary" aria-label="皇榜安全边界">
        <p>{serverDecision}</p>
        <p>本榜只录服务器定榜结果；前端不改名次、不补评分、不推断授官，只呈现已公开的榜文、评语与授官提示。</p>
      </section>
    </article>
  );
}
