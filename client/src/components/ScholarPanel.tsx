import type { CSSProperties } from "react";
import { Link } from "react-router";
import type { JsonObject, JsonValue, PlayerSummary } from "../api";
import type { LocalSurface } from "../state/uiState";
import { rewritePlayerFacingWorldText } from "../text/worldText";
import { RoleCycleSection } from "./RoleCycleSection";

type ScholarPanelProps = {
  readonly player?: PlayerSummary | null;
  readonly roleCycleView?: JsonObject | null;
  readonly studyProfileView?: JsonObject | null;
  readonly examCalendarView?: JsonObject | null;
  readonly roleBackgroundPath?: string;
  readonly onDraft: (text: string) => void;
  readonly resolveRoleCycleRouteHref?: (routeId: string) => string | null;
  readonly onOpenRoleCycleSurface?: (surface: LocalSurface) => void;
  readonly examHref?: string;
  readonly rankingHref?: string;
  readonly runnable?: boolean;
};

type SafeListItem = {
  readonly id: string;
  readonly title: string;
  readonly meta?: string;
  readonly body?: string;
};

type StudyPlanDetail = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
};

const unsafeScholarFragments = [
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

const dimensionOrder = [
  "classicsFoundation",
  "eightLeggedForm",
  "policyInsight",
  "historicalAllusion",
  "legalJudgment",
  "calligraphyCopying",
  "examEndurance"
] as const;

const fallbackDimensionLabels: Record<string, string> = {
  classicsFoundation: "经义根柢",
  eightLeggedForm: "制艺章法",
  policyInsight: "策论时务",
  historicalAllusion: "史事典故",
  legalJudgment: "律例判断",
  calligraphyCopying: "誊写卷面",
  examEndurance: "科场耐力"
};

const examLevelLabels: Record<string, string> = {
  child_exam: "童试",
  provincial_exam: "乡试",
  metropolitan_exam: "会试",
  palace_exam: "殿试"
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

function cleanScholarText(value: unknown, fallback = "未载", maxLength = 96) {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /(?:file|https?):\/\//i.test(text)) return fallback;
  if (unsafeScholarFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}…` : rewritten;
}

function cleanOptionalText(value: unknown, maxLength = 96) {
  const cleaned = cleanScholarText(value, "", maxLength);
  return cleaned || undefined;
}

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function safeAssetPath(value: string | undefined) {
  if (!value || !value.startsWith("/assets/ui/")) return undefined;
  if (unsafeScholarFragments.some((fragment) => value.toLowerCase().includes(fragment.toLowerCase()))) return undefined;
  return value;
}

function getObjectField(source: JsonObject, key: string) {
  return asRecord(source[key]);
}

function listFromView(source: JsonObject, key: string, limit: number, fallbackTitle: string): SafeListItem[] {
  return asArray(source[key])
    .slice(-limit)
    .map((entry, index) => {
      if (typeof entry === "string" || typeof entry === "number") {
        return {
          id: `${key}-${index}`,
          title: cleanScholarText(entry, fallbackTitle)
        };
      }

      const item = asRecord(entry);
      const title = cleanScholarText(item.title || item.label || item.focus || item.examName, fallbackTitle, 42);
      const meta = cleanOptionalText(item.teacherName || item.reason || item.source || item.dateLabel || item.level, 44);
      const body = cleanOptionalText(item.advice || item.summary || item.detail || item.publicSummary, 112);
      const visibleItem = {
        id: cleanScholarText(item.id || `${key}-${index}`, `${key}-${index}`, 64),
        title,
        meta,
        body
      };
      return visibleItem.title === fallbackTitle && !visibleItem.meta && !visibleItem.body ? null : visibleItem;
    })
    .filter((item): item is SafeListItem => item !== null && item.title !== "未载");
}

function getPlayerName(player: PlayerSummary | null | undefined) {
  return cleanScholarText(player?.name, "案主", 32);
}

function getPlayerRank(player: PlayerSummary | null | undefined) {
  return cleanScholarText(player?.examRank || player?.officeTitle || "未入科名", "未入科名", 36);
}

function getDimensionItems(studyProfile: JsonObject) {
  const dimensions = getObjectField(studyProfile, "dimensions");
  const labels = getObjectField(studyProfile, "dimensionLabels");
  const dimensionAliases: Record<string, string> = {
    eightLeggedEssay: "eightLeggedForm",
    policyDiscourse: "policyInsight",
    historicalAllusions: "historicalAllusion",
    calligraphy: "calligraphyCopying"
  };
  const normalizedDimensions = { ...dimensions };
  const normalizedLabels = { ...labels };

  for (const [legacyKey, canonicalKey] of Object.entries(dimensionAliases)) {
    if (normalizedDimensions[canonicalKey] === undefined && dimensions[legacyKey] !== undefined) {
      normalizedDimensions[canonicalKey] = dimensions[legacyKey];
    }
    if (normalizedLabels[canonicalKey] === undefined && labels[legacyKey] !== undefined) {
      normalizedLabels[canonicalKey] = labels[legacyKey];
    }
  }

  return dimensionOrder.map((key) => ({
    key,
    label: cleanScholarText(normalizedLabels[key], fallbackDimensionLabels[key], 24),
    value: cleanNumber(normalizedDimensions[key], 50)
  }));
}

function getAcademyNetwork(studyProfile: JsonObject) {
  const academyNetwork = getObjectField(studyProfile, "academyNetwork");
  const teacher = getObjectField(academyNetwork, "teacher");
  const academy = getObjectField(academyNetwork, "academy");
  const sponsorship = getObjectField(academyNetwork, "sponsorship");
  const classmates = asArray(academyNetwork.classmates)
    .slice(-3)
    .map((entry, index) => {
      const classmate = asRecord(entry);
      return {
        id: cleanScholarText(classmate.characterId || classmate.id || `classmate-${index}`, `classmate-${index}`, 48),
        name: cleanScholarText(classmate.name, "同窗", 28),
        status: cleanScholarText(classmate.relationshipStatus || classmate.style, "可互评文章", 36),
        summary: cleanScholarText(classmate.publicSummary, "可请其看一遍近作，先成行动草稿。", 96)
      };
    });

  return {
    teacher: {
      name: cleanScholarText(teacher.name, "乡中塾师", 28),
      style: cleanScholarText(teacher.style, "谨守经义，先端章法", 48),
      status: cleanScholarText(teacher.relationshipStatus, "初识", 24),
      summary: cleanScholarText(teacher.publicSummary, "老师可点评文章；师承事实与保结仍候案卷回批。", 112)
    },
    academy: {
      name: cleanScholarText(academy.name, "县学讲席", 32),
      level: cleanScholarText(academy.level, "县学", 24),
      summary: cleanScholarText(academy.publicSummary, "书院资源只作公开读书线索。", 96)
    },
    sponsorship: {
      status: cleanScholarText(sponsorship.status, "not_ready", 24),
      score: cleanNumber(sponsorship.score, 0),
      summary: cleanScholarText(sponsorship.publicSummary, "保结未定，须由报名与科期规则复核。", 112),
      nextStep: cleanScholarText(sponsorship.nextStep, "先请老师点评近文。", 96)
    },
    classmates
  };
}

function getNextPlan(studyProfile: JsonObject) {
  const plan = getObjectField(studyProfile, "nextPlan");
  const intensity = getObjectField(plan, "intensity");
  const planningWindow = getObjectField(plan, "planningWindow");
  const readPlanDetails = (key: string, limit: number): readonly StudyPlanDetail[] => asArray(plan[key])
    .slice(0, limit)
    .map((entry, index) => {
      const item = asRecord(entry);
      const label = cleanScholarText(item.label, "", 32);
      const detail = cleanScholarText(item.detail || item.summary, "", 96);
      if (!label && !detail) return null;
      return {
        id: cleanScholarText(item.id || `${key}-${index}`, `${key}-${index}`, 48),
        label: label || "读书节点",
        detail: detail || "按读书计划执行。"
      };
    })
    .filter((item): item is StudyPlanDetail => item !== null);
  return {
    title: cleanScholarText(plan.title, "下旬读书日课", 44),
    focus: cleanScholarText(plan.focus, "经义根柢", 28),
    items: asArray(plan.items).slice(0, 4).map((item) => cleanScholarText(item, "温书", 64)),
    books: asArray(plan.bookList).slice(0, 4).map((item) => cleanScholarText(item, "书目未载", 32)),
    serverDecision: cleanScholarText(plan.serverDecision, "读书计划已按可见画像入卷。", 96),
    intensity: {
      label: cleanScholarText(intensity.label, "稳进", 20),
      currentScore: cleanNumber(intensity.currentScore, 0),
      targetScore: cleanNumber(intensity.targetScore, 0),
      summary: cleanScholarText(intensity.summary, "按读书计划稳步推进。", 96)
    },
    window: {
      startLabel: cleanScholarText(planningWindow.startLabel, "本旬", 36),
      reviewLabel: cleanScholarText(planningWindow.reviewLabel, "三旬后复盘", 36)
    },
    rhythm: readPlanDetails("dailyRhythm", 3),
    checkpoints: readPlanDetails("checkpoints", 3),
    risks: asArray(plan.riskNotes).slice(0, 3).map((item) => cleanScholarText(item, "", 88)).filter(Boolean),
    actions: asArray(plan.nextActions).slice(0, 3).map((item) => cleanScholarText(item, "", 88)).filter(Boolean),
    authorityBoundary: cleanScholarText(plan.authorityBoundary, "读书计划以案卷回批为准，本页只写草稿。", 120)
  };
}

function getExamPreparation(studyProfile: JsonObject) {
  const preparation = getObjectField(studyProfile, "examPreparation");
  if (!Object.keys(preparation).length) return null;
  return {
    examName: cleanScholarText(preparation.examName, "当前考试", 36),
    label: cleanScholarText(preparation.label, "从容", 24),
    score: cleanNumber(preparation.score, 0),
    summary: cleanScholarText(preparation.summary, "备考压力已入卷整理。", 128),
    studyFocus: cleanScholarText(preparation.studyFocus, "经义根柢", 40),
    causes: asArray(preparation.causes).slice(0, 4).map((item) => cleanScholarText(item, "", 88)).filter(Boolean),
    actions: asArray(preparation.suggestedActions).slice(0, 4).map((item) => cleanScholarText(item, "", 88)).filter(Boolean)
  };
}

function getNextExam(examCalendar: JsonObject) {
  const nextExam = getObjectField(examCalendar, "nextExam");
  if (!Object.keys(nextExam).length) {
    return null;
  }

  const level = cleanScholarText(nextExam.level, "", 32);
  return {
    name: cleanScholarText(nextExam.examName, level ? examLevelLabels[level] || "下一科" : "下一科", 36),
    level: level ? examLevelLabels[level] || level : "科名未载",
    status: cleanScholarText(nextExam.status, "候期", 24),
    date: cleanScholarText(nextExam.nextWindowLabel || nextExam.currentDateLabel || examCalendar.currentDateLabel, "日期未载", 48),
    window: cleanScholarText(nextExam.windowLabel, "常科待定", 48),
    monthsUntil: cleanScholarText(nextExam.monthsUntil, "未计", 12),
    travelMonths: cleanScholarText(nextExam.travelMonths, "0", 12),
    recommendation: cleanScholarText(nextExam.teacherRecommendation, "入场资格仍按声望、师友和科期候批。", 112),
    funding: cleanScholarText(nextExam.funding, "盘费行程只作公开提示，不能直接入场。", 112),
    quota: cleanScholarText(nextExam.localQuota, "名额与取舍以放榜为准。", 112)
  };
}

function draftButtonText(label: string, text: string, enabled: boolean, onDraft: (text: string) => void) {
  return (
    <button type="button" disabled={!enabled} onClick={() => onDraft(text)}>
      {label}
    </button>
  );
}

export function ScholarPanel({
  player,
  roleCycleView,
  studyProfileView,
  examCalendarView,
  roleBackgroundPath,
  onDraft,
  resolveRoleCycleRouteHref,
  onOpenRoleCycleSurface,
  examHref,
  rankingHref,
  runnable = true
}: ScholarPanelProps) {
  const studyProfile = asRecord(studyProfileView);
  const examCalendar = asRecord(examCalendarView);
  const backgroundPath = safeAssetPath(roleBackgroundPath);
  const backgroundStyle = backgroundPath ? ({ "--scholar-panel-bg": `url(${backgroundPath})` } as CSSProperties) : undefined;
  const playerName = getPlayerName(player);
  const playerRank = getPlayerRank(player);
  const summary = cleanScholarText(studyProfile.summary, "读书簿待展开，先从日课、师友与科期三处落笔。", 128);
  const dateLabel = cleanScholarText(studyProfile.dateLabel || examCalendar.currentDateLabel, "时令未载", 36);
  const dimensions = getDimensionItems(studyProfile);
  const academyNetwork = getAcademyNetwork(studyProfile);
  const nextPlan = getNextPlan(studyProfile);
  const nextExam = getNextExam(examCalendar);
  const examPreparation = getExamPreparation(studyProfile);
  const teacherFeedback = listFromView(studyProfile, "teacherFeedback", 3, "老师点评");
  const teacherAdvice = listFromView(studyProfile, "teacherAdvice", 3, "老师建议");
  const recentExercises = listFromView(studyProfile, "recentExercises", 3, "近课");
  const smallExercises = listFromView(studyProfile, "smallExercises", 3, "文章练习");
  const recommendedBooks = listFromView(studyProfile, "recommendedBooks", 4, "荐书");
  const missedWindows = listFromView(examCalendar, "missedWindows", 2, "误期记录");
  const recentSessions = listFromView(examCalendar, "recentSessions", 2, "近科记录");
  const canDraft = runnable !== false;

  return (
    <section className="scholarPanel" aria-labelledby="scholar-panel-title" style={backgroundStyle}>
      <header className="scholarPanelHeader">
        <div>
          <p className="scholarPanelEyebrow">书斋 · {dateLabel}</p>
          <h2 id="scholar-panel-title">寒窗书斋</h2>
          <p>{playerName}的读书簿、师友与科期只读已公开卷宗。</p>
          <p>{summary}</p>
        </div>
        <dl className="scholarPanelStatus" aria-label="书生摘要">
          <div>
            <dt>科名</dt>
            <dd>{playerRank}</dd>
          </div>
          <div>
            <dt>保结</dt>
            <dd>{academyNetwork.sponsorship.score} / 100</dd>
          </div>
          <div>
            <dt>边界</dt>
            <dd>只写草稿，结果候回批</dd>
          </div>
        </dl>
      </header>

      <div className="scholarPanelGrid">
        <RoleCycleSection
          roleCycleView={roleCycleView}
          idPrefix="scholar-role-cycle"
          runnable={runnable}
          resolveRouteHref={resolveRoleCycleRouteHref}
          onOpenSurface={onOpenRoleCycleSurface}
          onDraft={onDraft}
        />
        <article className="scholarPanelCard paperMotionPanel rolePanel scholarPanelStudyLedger" aria-labelledby="scholar-ledger-title">
          <h3 id="scholar-ledger-title">读书簿</h3>
          <ul className="scholarPanelMetrics" aria-label="学业七项">
            {dimensions.map((item) => (
              <li key={item.key}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
          <section className="scholarPanelSubsection" aria-labelledby="scholar-plan-title">
            <h4 id="scholar-plan-title">{nextPlan.title}</h4>
            <p>{nextPlan.focus}。{nextPlan.serverDecision}</p>
            <ul>
              {nextPlan.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {nextPlan.books.length ? (
              <p>荐读：{nextPlan.books.join("、")}</p>
            ) : null}
            <dl className="scholarPlanSummary" aria-label="读书计划进度">
              <div>
                <dt>节奏</dt>
                <dd>{nextPlan.intensity.label}</dd>
              </div>
              <div>
                <dt>当前</dt>
                <dd>{nextPlan.intensity.currentScore}</dd>
              </div>
              <div>
                <dt>目标</dt>
                <dd>{nextPlan.intensity.targetScore}</dd>
              </div>
            </dl>
            <p>{nextPlan.window.startLabel}起，{nextPlan.window.reviewLabel}。{nextPlan.intensity.summary}</p>
            {nextPlan.rhythm.length ? (
              <ul className="scholarPlanTimeline" aria-label="晨午暮日课">
                {nextPlan.rhythm.map((item) => (
                  <li key={item.id}>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {nextPlan.checkpoints.length ? (
              <ul className="scholarPlanTimeline scholarPlanCheckpoints" aria-label="读书复盘节点">
                {nextPlan.checkpoints.map((item) => (
                  <li key={item.id}>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {nextPlan.risks.length ? (
              <p>风险：{nextPlan.risks[0]}</p>
            ) : null}
            <p>{nextPlan.authorityBoundary}</p>
            {nextPlan.actions.length ? draftButtonText("执行首课", nextPlan.actions[0], canDraft, onDraft) : null}
            {draftButtonText("安排日课", `按读书簿安排${nextPlan.focus}日课：${nextPlan.items.join("；") || "温书作文"}。`, canDraft, onDraft)}
          </section>
        </article>

        <article className="scholarPanelCard paperMotionPanel rolePanel scholarPanelTeacher" aria-labelledby="scholar-teacher-title">
          <h3 id="scholar-teacher-title">老师点评</h3>
          <dl className="scholarPanelCompactDl">
            <div>
              <dt>先生</dt>
              <dd>{academyNetwork.teacher.name}</dd>
            </div>
            <div>
              <dt>师风</dt>
              <dd>{academyNetwork.teacher.style}</dd>
            </div>
            <div>
              <dt>关系</dt>
              <dd>{academyNetwork.teacher.status}</dd>
            </div>
          </dl>
          <p>{academyNetwork.teacher.summary}</p>
          <ScholarPanelList items={teacherFeedback.length ? teacherFeedback : teacherAdvice} emptyText="暂无新点评，可先请老师圈点近作。" />
          {draftButtonText("请老师改文", "携旧作拜见老师，请其点评破题、承题与立意得失。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard paperMotionPanel rolePanel scholarPanelNetwork" aria-labelledby="scholar-network-title">
          <h3 id="scholar-network-title">师友</h3>
          <p>{academyNetwork.academy.name}（{academyNetwork.academy.level}）：{academyNetwork.academy.summary}</p>
          <section className="scholarPanelSubsection" aria-labelledby="scholar-sponsor-title">
            <h4 id="scholar-sponsor-title">保结前置</h4>
            <p>{academyNetwork.sponsorship.summary}</p>
            <p>下一步：{academyNetwork.sponsorship.nextStep}</p>
          </section>
          <ul className="scholarPanelPeopleList">
            {academyNetwork.classmates.length ? academyNetwork.classmates.map((classmate) => (
              <li key={classmate.id}>
                <strong>{classmate.name}</strong>
                <span>{classmate.status}</span>
                <p>{classmate.summary}</p>
              </li>
            )) : (
              <li>
                <strong>同窗未载</strong>
                <span>可先参加讲会</span>
                <p>讲会、互评和求保结都只生成行动草稿，关系事实候案卷写定。</p>
              </li>
            )}
          </ul>
          {draftButtonText("同窗互评", "赴县学讲会，请师友互评近文，并问本期保结是否稳妥。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard paperMotionPanel rolePanel scholarPanelExamCalendar" aria-labelledby="scholar-calendar-title">
          <h3 id="scholar-calendar-title">科期</h3>
          {nextExam ? (
            <section className="scholarPanelSubsection" aria-label="下一场考试">
              <p><strong>{nextExam.name}</strong> · {nextExam.level} · {nextExam.status}</p>
              <dl className="scholarPanelCompactDl">
                <div>
                  <dt>窗口</dt>
                  <dd>{nextExam.window}</dd>
                </div>
                <div>
                  <dt>下期</dt>
                  <dd>{nextExam.date}</dd>
                </div>
                <div>
                  <dt>行程</dt>
                  <dd>{nextExam.travelMonths} 月</dd>
                </div>
              </dl>
              <p>{nextExam.recommendation}</p>
              <p>{nextExam.funding}</p>
              <p>{nextExam.quota}</p>
            </section>
          ) : (
            <p>眼下暂无下一科公开快照；若已入仕，皇榜与履历仍由案卷定档。</p>
          )}
          {examPreparation ? (
            <section className="scholarPanelSubsection" aria-labelledby="scholar-preparation-title">
              <h4 id="scholar-preparation-title">备考压力</h4>
              <p>{examPreparation.examName} · {examPreparation.label} {examPreparation.score}/100：{examPreparation.summary}</p>
              {examPreparation.causes.length ? (
                <ul>
                  {examPreparation.causes.map((cause) => (
                    <li key={cause}>{cause}</li>
                  ))}
                </ul>
              ) : null}
              {examPreparation.actions.length ? (
                <p>先办：{examPreparation.actions[0]}</p>
              ) : null}
              {draftButtonText(
                "稳住临考",
                `按备考摘要处理${examPreparation.examName}入场压力：先守${examPreparation.studyFocus}，并${examPreparation.actions[0] || "整理盘费、保结与心神"}。`,
                canDraft,
                onDraft
              )}
            </section>
          ) : null}
          <ScholarPanelList items={missedWindows.length ? missedWindows : recentSessions} emptyText="暂无误期或近科记录。" />
          <div className="scholarPanelActions">
            {draftButtonText("整备赴考", "整理盘费、行李、保结与温书计划，候案卷复核赶考时机。", canDraft, onDraft)}
            {examHref ? <Link to={examHref}>入科举页</Link> : null}
            {rankingHref ? <Link to={rankingHref}>看皇榜</Link> : null}
          </div>
        </article>

        <article className="scholarPanelCard paperMotionPanel rolePanel scholarPanelPractice" aria-labelledby="scholar-practice-title">
          <h3 id="scholar-practice-title">文章练习</h3>
          <ScholarPanelList items={smallExercises} emptyText="暂无小题，可先按弱项拟一篇破题。" />
          <section className="scholarPanelSubsection" aria-labelledby="scholar-recent-title">
            <h4 id="scholar-recent-title">近课</h4>
            <ScholarPanelList items={recentExercises} emptyText="近课尚少，先写一篇短文入簿。" />
          </section>
          <section className="scholarPanelSubsection" aria-labelledby="scholar-books-title">
            <h4 id="scholar-books-title">荐书</h4>
            <ScholarPanelList items={recommendedBooks} emptyText="荐书待老师补入。" />
          </section>
          {draftButtonText("练一篇文", `按${nextPlan.focus}作一篇时文，先交老师圈点，不自行取题或交卷。`, canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard paperMotionPanel rolePanel scholarPanelBoundary" aria-labelledby="scholar-boundary-title">
          <h3 id="scholar-boundary-title">裁决边界</h3>
          <ul>
            <li>本面板只读学业画像、科期和案主公开摘要。</li>
            <li>按钮只把玩家意图写成草稿，不取题、不交卷、不推进时间。</li>
            <li>赶考、入场、评卷、放榜、晋级和授官都按案卷规则回批。</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function ScholarPanelList({ items, emptyText }: { readonly items: readonly SafeListItem[]; readonly emptyText: string }) {
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
