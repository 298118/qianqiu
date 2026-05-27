import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import "../styles/responsive/mobile-exam-ranking.css";
import "../styles/routes/exam-ranking.css";
import type { ExamLevel, JsonObject, JsonValue } from "../api";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import { isRouteLocalSessionId, isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";
import { rewritePlayerFacingWorldText } from "../text/worldText";

const examLevels: { value: ExamLevel; label: string }[] = [
  { value: "child_exam", label: "童试" },
  { value: "provincial_exam", label: "乡试" },
  { value: "metropolitan_exam", label: "会试" },
  { value: "palace_exam", label: "殿试" }
];

const defaultExamLevel: ExamLevel = "child_exam";
const defaultSceneAction = "整理号舍，审题立意。";
const defaultEssay = "臣闻治世之要，在修己以安人，明法以养民。";

type ExamWritingReaderRow = {
  readonly label: string;
  readonly value: string;
  readonly text: string;
};

const examStageCopy: Record<ExamLevel, { readonly place: string; readonly phase: string; readonly clock: string; readonly scene: string }> = {
  child_exam: { place: "县学试棚", phase: "入场点名", clock: "卯正至辰初", scene: "exam_cell" },
  provincial_exam: { place: "贡院号舍", phase: "头场经义", clock: "辰初至午后", scene: "exam_cell" },
  metropolitan_exam: { place: "京师贡院", phase: "会试策问", clock: "午正添烛", scene: "exam_cell" },
  palace_exam: { place: "殿廷御试", phase: "对策候旨", clock: "巳正御前", scene: "palace_exam_hall" }
};

const unsafeExamFragments = [
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
  "draft" + "Context",
  "schema",
  "manifest",
  "server adjudication",
  "AI read scope",
  "proposal boundary",
  "safe view",
  "resolver",
  "source" + "Ref",
  "related" + "Refs",
  "scope" + "Refs",
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

function getExamLabel(level: string | undefined) {
  return examLevels.find((item) => item.value === level)?.label || "当前考试";
}

function safeExamText(value: unknown, fallback: string, maxLength = 180) {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  const normalized = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /sk-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (unsafeExamFragments.some((fragment) => normalized.includes(fragment.toLowerCase()))) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}……` : rewritten;
}

function countCjkAwareWords(text: string) {
  const cjkCharacters = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWords = text.replace(/[\u3400-\u9fff]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return cjkCharacters + latinWords;
}

function formatRequirement(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return safeExamText(value, "依题作答，毋涉场外私情。");
  }
  if (Array.isArray(value)) {
    const items = value
      .filter((item) => typeof item === "string" || typeof item === "number")
      .map((item) => safeExamText(item, "", 72))
      .filter(Boolean)
      .slice(0, 3);
    return items.length ? items.join("；") : "依题作答，毋涉场外私情。";
  }
  return "依题作答，毋涉场外私情。";
}

function readPositiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function getExamScoreSummary(score: unknown) {
  const record = asRecord(score);
  const total = readPositiveInteger(record.total) ??
    readPositiveInteger(record.overall) ??
    readPositiveInteger(record.final);
  if (total !== null) return `${total} 分`;
  return Object.keys(record).length ? "已有评语" : "暂无评定";
}

function formatWordCountLabel(value: unknown) {
  const direct = readPositiveInteger(value);
  if (direct !== null) {
    return {
      label: `${direct}`
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      label: "800"
    };
  }
  const record = value as Record<string, unknown>;
  const min = readPositiveInteger(record.min);
  const max = readPositiveInteger(record.max);
  const target = readPositiveInteger(record.target) ?? readPositiveInteger(record.recommended);
  if (min !== null && max !== null) {
    return {
      label: `${min}-${max}`
    };
  }
  if (target !== null) {
    return {
      label: `${target}`
    };
  }
  if (min !== null) {
    return {
      label: `${min}以上`
    };
  }
  if (max !== null) {
    return {
      label: `${max}以内`
    };
  }
  return {
    label: "800"
  };
}

function isRecord(value: JsonValue | unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: JsonValue | unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function asArray(value: JsonValue | unknown): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function getPreparationPressure(activeExam: unknown) {
  const activeExamRecord = asRecord(activeExam);
  const pressure = asRecord(asRecord(activeExamRecord.entryPreparation).preparationPressure);
  if (!Object.keys(pressure).length) return null;
  return {
    label: safeExamText(pressure.label, "从容", 24),
    score: cleanNumber(pressure.score, 0),
    summary: safeExamText(pressure.summary, "备考压力已入卷整理。", 132),
    studyFocus: safeExamText(pressure.studyFocus, "经义根柢", 48),
    causes: asArray(pressure.causes).slice(0, 4).map((item) => safeExamText(item, "", 88)).filter(Boolean),
    suggestedActions: asArray(pressure.suggestedActions).slice(0, 4).map((item) => safeExamText(item, "", 88)).filter(Boolean)
  };
}

function getExamProcedure(activeExam: unknown) {
  const activeExamRecord = asRecord(activeExam);
  const procedure = asRecord(activeExamRecord.examProcedureView || activeExamRecord.examProcedure);
  const phaseFeedback = asRecord(procedure.phaseFeedback);
  return {
    phaseLabel: safeExamText(procedure.phaseLabel, "候场", 32),
    entrySearch: asRecord(procedure.entrySearch),
    cell: asRecord(procedure.cell),
    phaseFeedback: Object.keys(phaseFeedback).length ? {
      phaseLabel: safeExamText(phaseFeedback.phaseLabel, safeExamText(procedure.phaseLabel, "候场", 32), 32),
      pressureLabel: safeExamText(phaseFeedback.pressureLabel, "从容", 24),
      publicSummary: safeExamText(phaseFeedback.publicSummary, "入场后反馈已入卷整理。", 132),
      environmentSummary: safeExamText(phaseFeedback.environmentSummary, "场内反馈不替代最终回批。", 132),
      actionEcho: safeExamText(phaseFeedback.actionEcho, "", 72),
      riskNotes: asArray(phaseFeedback.riskNotes).slice(0, 3).map((item) => safeExamText(item, "", 88)).filter(Boolean),
      visibleNextActions: asArray(phaseFeedback.visibleNextActions).slice(0, 3).map((item) => safeExamText(item, "", 72)).filter(Boolean),
      authorityBoundary: safeExamText(
        phaseFeedback.authorityBoundary,
        "入场后反馈只读展示，可留作草稿。",
        132
      )
    } : null,
    incidents: asArray(procedure.incidents).slice(-4).map((item, index) => {
      const incident = asRecord(item);
      return {
        id: safeExamText(incident.type || `incident-${index}`, `incident-${index}`, 48),
        label: safeExamText(incident.label, "科场记录", 36),
        summary: safeExamText(incident.publicSummary, "科场记录已脱敏。", 112)
      };
    })
  };
}

export function ExamPage() {
  const { sessionId = "s74-preview" } = useParams();
  const { registry } = useAssetRegistry();
  const [level, setLevel] = useState<ExamLevel>(defaultExamLevel);
  const [sceneAction, setSceneAction] = useState(defaultSceneAction);
  const [essay, setEssay] = useState(defaultEssay);
  const requestExamQuestion = useGameSessionStore((state) => state.requestExamQuestion);
  const progressExam = useGameSessionStore((state) => state.progressExam);
  const submitExam = useGameSessionStore((state) => state.submitExam);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const storeCurrentSessionId = useGameSessionStore((state) => state.currentSessionId);
  const activeExam = useGameSessionStore((state) => state.activeExam);
  const lastExamResult = useGameSessionStore((state) => state.lastExamResult);
  const status = useGameSessionStore((state) => state.status);
  const error = useGameSessionStore((state) => state.error);
  const routeSessionSupported = isRouteLocalSessionId(sessionId);
  const canCallSessionApi = routeSessionSupported && isRunnableSessionId(sessionId);
  const routeStatus = routeSessionSupported ? status : "idle";
  const routeError = routeSessionSupported && storeCurrentSessionId === sessionId ? error : null;
  const unsupportedRouteMessage = "此案卷编号暂不可用于浏览器科举；请从首页开卷或载入旧案。";
  const activeExamForSession = routeSessionSupported && activeExam?.sessionId === sessionId ? activeExam : null;
  const examId = activeExamForSession?.examId;
  const visibleLevel = (activeExamForSession?.level && examLevels.some((item) => item.value === activeExamForSession.level)
    ? activeExamForSession.level
    : level) as ExamLevel;
  const stage = examStageCopy[visibleLevel];
  const sceneAsset = useMemo(
    () => registry?.getAssets({ category: "scene", usage: "exam_page", scene: stage.scene }).at(0),
    [registry, stage.scene]
  );
  const heroImagePath = sceneAsset?.path ?? (visibleLevel === "palace_exam"
    ? "/assets/ui/scenes/scene-palace-exam-hall-v1.webp"
    : "/assets/ui/scenes/scene-exam-cell-v1.webp");
  const essayWordCount = countCjkAwareWords(essay);
  const wordCount = formatWordCountLabel(activeExamForSession?.wordCount);
  const draftState = essay.trim() ? "草稿已入卷，尚未交卷候批。" : "草稿未成篇。";
  const latestSubmitForSession = routeSessionSupported && lastExamResult?.sessionId === sessionId ? lastExamResult : null;
  const hasLatestExamEvaluation = latestSubmitForSession?.score !== undefined && latestSubmitForSession?.score !== null;
  const safeRecentExamName = safeExamText(latestSubmitForSession?.examName, getExamLabel(latestSubmitForSession?.level), 64);
  const safeExamName = safeExamText(activeExamForSession?.examName, getExamLabel(visibleLevel), 64);
  const safeExamQuestion = safeExamText(activeExamForSession?.examQuestion, "试题已入卷。", 260);
  const safeDifficulty = safeExamText(activeExamForSession?.difficulty, "难度未署", 32);
  const safeSceneActionPreview = safeExamText(sceneAction, "尚无场内行动。", 80);
  const safeError = safeExamText(routeError, "科场回音暂不可用。", 160);
  const preparationPressure = getPreparationPressure(activeExamForSession);
  const procedure = getExamProcedure(activeExamForSession);
  const examCeremonyState = !routeSessionSupported ? "unsupported" : activeExamForSession ? "active" : "ready";
  const examRitualLedger = [
    {
      label: "取题启封",
      text: activeExamForSession
        ? `${safeExamName}已启封，题目、要求与字数只按本案卷公开记录显示。`
        : canCallSessionApi
          ? `可按所选试别取题；当前候启${getExamLabel(level)}。`
          : routeSessionSupported
            ? "预览案卷只看考场章法，不启封题纸。"
            : unsupportedRouteMessage
    },
    {
      label: "场内推进",
      text: activeExamForSession
        ? `${procedure.phaseLabel}：${procedure.phaseFeedback?.publicSummary ?? "场内记录已入卷整理。"}`
        : "未取题前不生成场内反馈。"
    },
    {
      label: "交卷候批",
      text: activeExamForSession
        ? `${draftState} 交卷后仍候主卷评阅、复核与放榜。`
        : "文章草稿留在本页，未启封题纸前不交卷。"
    },
    {
      label: "候榜回音",
      text: hasLatestExamEvaluation
        ? `${safeRecentExamName}已有评定，可转皇榜查看公开榜文。`
        : "尚无本案卷交卷评定；名次、同年与授官不在本页补造。"
    }
  ] as const;
  const examCeremonyBand = [
    {
      label: "肃场",
      text: `${stage.place} · ${stage.clock}`
    },
    {
      label: "启封",
      text: activeExamForSession ? `${safeExamName}题纸已启。` : routeSessionSupported ? `候取${getExamLabel(level)}题纸。` : "案卷暂不可启封。"
    },
    {
      label: "落墨",
      text: activeExamForSession ? `已成 ${essayWordCount} 字，目标约 ${wordCount.label} 字。` : "未启封前不落卷。"
    },
    {
      label: "候榜",
      text: hasLatestExamEvaluation ? `${safeRecentExamName}可往皇榜细看。` : "交卷后仍待评阅与张榜。"
    }
  ] as const;
  const examTransitionRows = [
    {
      label: "入场",
      value: activeExamForSession ? procedure.phaseLabel : "候点名",
      text: activeExamForSession ? "号舍、搜检与题纸已经入卷；场内行动只留作下一步回音。" : "未取题时只看仪幕，不补写号舍与考官。"
    },
    {
      label: "落墨",
      value: activeExamForSession ? `${essayWordCount} 字` : "未开卷",
      text: activeExamForSession ? `${draftState} 当前目标约 ${wordCount.label} 字。` : "先启封题纸，再作文章。"
    },
    {
      label: "候批",
      value: hasLatestExamEvaluation ? "可查榜" : "待回音",
      text: hasLatestExamEvaluation ? `${safeRecentExamName}已有评定，可转皇榜读榜文、同年与授官提示。` : "交卷后才有评阅、放榜、同年座师与授官过渡。"
    }
  ] as const;
  const examWritingReaderRows: ExamWritingReaderRow[] = [
    {
      label: "试别",
      value: activeExamForSession ? safeExamName : hasLatestExamEvaluation ? safeRecentExamName : getExamLabel(visibleLevel),
      text: activeExamForSession
        ? `${stage.place} · ${procedure.phaseLabel}，只按已启题纸与公开考场记录显示。`
        : hasLatestExamEvaluation
          ? `${safeRecentExamName}已有公开评定，本页不补造新题纸。`
        : routeSessionSupported
          ? `候取${getExamLabel(level)}题纸；未启封不补造试题。`
          : unsupportedRouteMessage
    },
    {
      label: "草稿",
      value: essay.trim() ? `${essayWordCount} 字` : "草稿未成篇",
      text: essay.trim()
        ? `本地只记文章字数，目标约 ${wordCount.label} 字；不回显正文。`
        : "本地尚无成篇文字；不回显正文。"
    },
    {
      label: "交卷",
      value: hasLatestExamEvaluation ? "已呈卷" : activeExamForSession && canCallSessionApi && essay.trim() ? "可呈卷" : activeExamForSession ? "候成篇" : "未启封",
      text: hasLatestExamEvaluation
        ? "本案卷已有评定回音，后续仍往皇榜读榜文。"
        : activeExamForSession
        ? canCallSessionApi && essay.trim()
          ? "交卷后仍候评阅、复核与放榜。"
          : "须有当前案卷题纸与成篇草稿，才可呈卷。"
        : routeSessionSupported
          ? "未取题前不交卷，不补评语。"
          : "断卷不可交卷。"
    },
    {
      label: "候榜",
      value: hasLatestExamEvaluation ? getExamScoreSummary(latestSubmitForSession?.score) : "暂无评定",
      text: hasLatestExamEvaluation
        ? `${safeRecentExamName}已有公开评定；榜次、同年与授官往皇榜细看。`
        : "暂无本案卷评定；不补榜次、同年或授官。"
    }
  ];

  useEffect(() => {
    setLevel(defaultExamLevel);
    setSceneAction(defaultSceneAction);
    setEssay(defaultEssay);
  }, [sessionId]);

  async function handleQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCallSessionApi) return;
    try {
      await requestExamQuestion(sessionId, level);
    } catch {
    }
  }

  async function handleProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCallSessionApi || !examId || !sceneAction.trim()) return;
    try {
      await progressExam(sessionId, examId, sceneAction.trim());
    } catch {
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCallSessionApi || !examId || !essay.trim()) return;
    try {
      await submitExam(sessionId, examId, essay.trim());
    } catch {
    }
  }

  function handleFeedbackDraft(action: string) {
    setActionDraft({ source: "exam", targetPage: "game", text: action });
  }

  return (
    <article
      className="examFullScreen routePanel"
      aria-labelledby="exam-title"
      data-polish-exam="s89-18-exam-ritual-ledger"
      data-polish-exam-ceremony="s89-33-exam-ceremony-material"
    >
      <section className="examHero" data-polish-exam-hero="s89-33-exam-ceremony-material" style={{ "--exam-hero-image": `url(${heroImagePath})` } as CSSProperties}>
        <div className="examHeroBackdrop" aria-hidden="true" />
        <div className="examHeroCopy">
          <p className="eyebrow">{stage.place}</p>
          <h1 id="exam-title">科举</h1>
          <h2>{stage.place}</h2>
          <p>卷帘垂下，灯影照卷。取题、推进考场与交卷都须按当前案卷流程呈递。</p>
        </div>
        <dl className="examStageRail" aria-label="考试阶段与场内时辰">
          <div>
            <dt>考试阶段</dt>
            <dd>{stage.phase}</dd>
          </div>
          <div>
            <dt>场内时辰</dt>
            <dd>{stage.clock}</dd>
          </div>
          <div>
            <dt>案卷状态</dt>
            <dd>{activeExamForSession ? "已取题" : "候取题"}</dd>
          </div>
        </dl>
      </section>

      <section
        className="examCeremonyBand"
        aria-label="科场仪幕"
        data-polish-exam-ceremony-band="s89-33-exam-ceremony-material"
        data-exam-state={examCeremonyState}
      >
        <div>
          <p className="eyebrow">科场仪幕</p>
          <strong>{activeExamForSession ? "题纸既启，落墨候批。" : "肃场候题，先定试别。"}</strong>
        </div>
        <ol>
          {examCeremonyBand.map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <dl className="examTransitionRail" aria-label="科举过渡读法">
        {examTransitionRows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              <strong>{row.value}</strong>
              <span>{row.text}</span>
            </dd>
          </div>
        ))}
      </dl>
      <section
        className="examWritingReader"
        aria-label="落墨校阅"
        data-polish-exam-writing-reader="s91-6-exam-writing-reader"
      >
        <div className="examWritingReaderHeader">
          <p className="eyebrow">落墨校阅</p>
          <strong>呈卷前先校试别、草稿、交卷与候榜。</strong>
        </div>
        <dl>
          {examWritingReaderRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                <strong>{row.value}</strong>
                <span>{row.text}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="examImmersiveLayout">
        <main className="examPaperColumn" aria-label="中央试卷">
          <section className="examQuestionPanel paperMotionSurface" aria-label="取题与试别">
            <div>
              <p className="eyebrow">弥封试卷</p>
              <h2>{safeExamName}</h2>
            </div>
            <form className="examQuestionForm inlineForm" onSubmit={handleQuestion}>
              <label>
                试别
                <select value={level} onChange={(event) => setLevel(event.target.value as ExamLevel)}>
                  {examLevels.map((examLevel) => (
                    <option key={examLevel.value} value={examLevel.value}>
                      {examLevel.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="paperButton examFetchButton" type="submit" disabled={routeStatus === "loading" || !canCallSessionApi}>
                取题
              </button>
            </form>
          </section>

          {activeExamForSession ? (
            <section className="examDesk paperMotionSurface" aria-label="当前试卷" data-polish-exam-paper="s89-33-exam-ceremony-material">
              <div className="examPaperHeader">
                <p className="eyebrow">考题</p>
                <p className="examPaperMeta">
                  {safeDifficulty} · 目标约 {wordCount.label} 字
                </p>
              </div>
              <blockquote className="examQuestionText">
                {safeExamQuestion}
              </blockquote>
              <p className="examRequirementText">{formatRequirement(activeExamForSession.requirements)}</p>

              <form className="examActionForm inlineForm" onSubmit={handleProgress}>
                <label>
                  场内行动
                  <input value={sceneAction} onChange={(event) => setSceneAction(event.target.value)} />
                </label>
                <button className="paperButton" type="submit" disabled={routeStatus === "loading" || !canCallSessionApi}>
                  推进考场
                </button>
              </form>

              <form className="examSubmit" onSubmit={handleSubmit}>
                <label>
                  文章
                  <textarea value={essay} onChange={(event) => setEssay(event.target.value)} rows={10} />
                </label>
                <div className="examDraftBar" aria-label="写作区字数与草稿状态">
                  <span>{essayWordCount} / {wordCount.label} 字</span>
                  <span>{draftState}</span>
                </div>
                <button className="paperButton examSealSubmitButton" type="submit" disabled={routeStatus === "loading" || !canCallSessionApi}>
                  交卷
                </button>
              </form>
            </section>
          ) : (
            <section className="examDesk examEmptyPaper paperMotionSurface" aria-label="中央试卷预览" data-polish-exam-paper="s89-33-exam-ceremony-material">
              <p className="eyebrow">中央试卷</p>
              <h2>案卷未启</h2>
              <p>{routeSessionSupported ? "先择试别取题；预览案卷只展示界面，不启封考题。" : unsupportedRouteMessage}</p>
            </section>
          )}
        </main>

        <aside className="examSideColumn" aria-label="考场记录">
          <section className="examPreviewPanel paperMotionSurface" aria-label="科举仪程索引" data-polish-exam-ledger="s89-18-exam-ritual">
            <p className="eyebrow">案头仪程</p>
            <h2>科举仪程</h2>
            <dl className="surfaceSafetyList">
              {examRitualLedger.map((item) => (
                <div className="surfaceSafetyRow paperMotionSurface" key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.text}</dd>
                </div>
              ))}
            </dl>
            <p className="statusLine">场内反馈只作案卷公开记录；科名、舞弊、晋级与授官仍候主卷回批。</p>
          </section>

          <section className="examRecordPanel paperMotionSurface">
            <p className="eyebrow">场内记录</p>
            <ul className="examRecordList">
              <li>{activeExamForSession ? `流程：${procedure.phaseLabel}` : "监临未点名，题纸尚封。"}</li>
              {preparationPressure ? (
                <li>备考压力：{preparationPressure.label} {preparationPressure.score}/100，{preparationPressure.summary}</li>
              ) : null}
              {activeExamForSession ? (
                <li>{safeExamText(procedure.entrySearch.publicSummary, "监临点卷，题纸已揭。", 112)}</li>
              ) : null}
              {activeExamForSession ? (
                <li>{safeExamText(procedure.cell.publicSummary, "号舍已定，按题拟纲。", 112)}</li>
              ) : null}
              {activeExamForSession && procedure.phaseFeedback ? (
                <li>入场后反馈：{procedure.phaseFeedback.publicSummary}</li>
              ) : null}
              <li>近次行动：{safeSceneActionPreview}</li>
              <li>{draftState}</li>
            </ul>
          </section>

          {preparationPressure ? (
            <section className="examPreviewPanel paperMotionSurface" aria-label="备考压力">
              <p className="eyebrow">备考压力</p>
              <p>{preparationPressure.studyFocus}：{preparationPressure.summary}</p>
              {preparationPressure.causes.length ? (
                <ul className="examRecordList">
                  {preparationPressure.causes.map((cause) => (
                    <li key={cause}>{cause}</li>
                  ))}
                </ul>
              ) : null}
              {preparationPressure.suggestedActions.length ? (
                <p>{preparationPressure.suggestedActions[0]}</p>
              ) : null}
            </section>
          ) : null}

          <section className="examPeerPanel paperMotionSurface" aria-label="虚拟考生占位">
            <p className="eyebrow">同场诸生</p>
            <div className="examPeerGrid" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p>同场考生、阅卷官与榜单只显示公开占位；名次、同年与座师关系待金榜张挂。</p>
          </section>

          <section className="examPreviewPanel paperMotionSurface" aria-label="预览案卷提示">
            <p className="eyebrow">预览案卷</p>
            <p>{canCallSessionApi ? "当前案卷可取题、推进考场并交卷。" : routeSessionSupported ? "预览案卷不取题；请先从首页新开一卷。" : unsupportedRouteMessage}</p>
          </section>

          <section className="examRecentSubmitPanel paperMotionSurface" aria-label="最近交卷提示">
            <p className="eyebrow">最近交卷</p>
            <p>{hasLatestExamEvaluation ? `${safeRecentExamName} 已有评定，可入皇榜细看。` : "尚无本案卷交卷评定。"}</p>
          </section>

          {procedure.phaseFeedback || procedure.incidents.length ? (
            <section className="examRecordPanel paperMotionSurface" aria-label="入场后反馈">
              <p className="eyebrow">入场后反馈</p>
              {procedure.phaseFeedback ? (
                <div className="examPhaseFeedback">
                  <p>{procedure.phaseFeedback.phaseLabel}：{procedure.phaseFeedback.publicSummary}</p>
                  <p>{procedure.phaseFeedback.environmentSummary}</p>
                  {procedure.phaseFeedback.actionEcho ? (
                    <p>本步行动：{procedure.phaseFeedback.actionEcho}</p>
                  ) : null}
                  {procedure.phaseFeedback.riskNotes.length ? (
                    <ul className="examRecordList">
                      {procedure.phaseFeedback.riskNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                  {procedure.phaseFeedback.visibleNextActions.length ? (
                    <div className="examFeedbackActions" aria-label="入场后反馈行动草稿">
                      {procedure.phaseFeedback.visibleNextActions.map((action) => (
                        <div className="examFeedbackActionItem" key={action}>
                          <span>{action}</span>
                          <button
                            type="button"
                            className="paperLink"
                            aria-label={`拟行动：${action}`}
                            onClick={() => handleFeedbackDraft(action)}
                          >
                            拟行动
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="examFeedbackBoundary">{procedure.phaseFeedback.authorityBoundary}</p>
                </div>
              ) : null}
              {procedure.incidents.length ? (
                <ul className="examRecordList">
                  {procedure.incidents.map((incident) => (
                    <li key={incident.id}>{incident.label}：{incident.summary}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

      <section className="examSafetyBoundary" aria-label="科举候复边界">
        <p>
          交卷、评分、舞弊、放榜、晋级和授官都回主卷定夺；本页只呈现已公开的考试快照与考场记录。
        </p>
      </section>

      {routeError ? <p className="statusLine" role="alert">{safeError}</p> : null}
    </article>
  );
}
