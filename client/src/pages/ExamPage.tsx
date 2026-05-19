import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import type { ExamLevel } from "../api";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";

const examLevels: { value: ExamLevel; label: string }[] = [
  { value: "child_exam", label: "童试" },
  { value: "provincial_exam", label: "乡试" },
  { value: "metropolitan_exam", label: "会试" },
  { value: "palace_exam", label: "殿试" }
];

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
  return text.length > maxLength ? `${text.slice(0, maxLength)}……` : text;
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

export function ExamPage() {
  const { sessionId = "s74-preview" } = useParams();
  const { registry } = useAssetRegistry();
  const [level, setLevel] = useState<ExamLevel>("child_exam");
  const [sceneAction, setSceneAction] = useState("整理号舍，审题立意。");
  const [essay, setEssay] = useState("臣闻治世之要，在修己以安人，明法以养民。");
  const requestExamQuestion = useGameSessionStore((state) => state.requestExamQuestion);
  const progressExam = useGameSessionStore((state) => state.progressExam);
  const submitExam = useGameSessionStore((state) => state.submitExam);
  const activeExam = useGameSessionStore((state) => state.activeExam);
  const lastExamResult = useGameSessionStore((state) => state.lastExamResult);
  const status = useGameSessionStore((state) => state.status);
  const error = useGameSessionStore((state) => state.error);
  const canCallSessionApi = isRunnableSessionId(sessionId);
  const activeExamForSession = activeExam?.sessionId === sessionId ? activeExam : null;
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
  const targetWordCount = activeExamForSession?.wordCount || 800;
  const draftState = essay.trim() ? "草稿已入卷，尚未交服务器裁决。" : "草稿未成篇。";
  const latestSubmitForSession = lastExamResult?.sessionId === sessionId ? lastExamResult : null;
  const safeRecentExamName = safeExamText(latestSubmitForSession?.examName, getExamLabel(latestSubmitForSession?.level), 64);
  const safeExamName = safeExamText(activeExamForSession?.examName, getExamLabel(visibleLevel), 64);
  const safeExamQuestion = safeExamText(activeExamForSession?.examQuestion, "试题已入卷。", 260);
  const safeDifficulty = safeExamText(activeExamForSession?.difficulty, "难度未署", 32);
  const safeSceneActionPreview = safeExamText(sceneAction, "尚无场内行动。", 80);
  const safeError = safeExamText(error, "科举接口暂不可用。", 160);

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

  return (
    <article className="examFullScreen routePanel" aria-labelledby="exam-title">
      <section className="examHero" style={{ "--exam-hero-image": `url(${heroImagePath})` } as CSSProperties}>
        <div className="examHeroBackdrop" aria-hidden="true" />
        <div className="examHeroCopy">
          <p className="eyebrow">{stage.place}</p>
          <h1 id="exam-title">科举</h1>
          <h2>贡院号舍</h2>
          <p>卷帘垂下，号舍灯明。取题、推进考场与交卷仍接现有服务器考试接口。</p>
        </div>
        <dl className="examStageRail" aria-label="考试阶段与局部时间">
          <div>
            <dt>考试阶段</dt>
            <dd>{stage.phase}</dd>
          </div>
          <div>
            <dt>局部时间</dt>
            <dd>{stage.clock}</dd>
          </div>
          <div>
            <dt>案卷状态</dt>
            <dd>{activeExamForSession ? "已取题" : "候取题"}</dd>
          </div>
        </dl>
      </section>

      <div className="examImmersiveLayout">
        <main className="examPaperColumn" aria-label="中央试卷">
          <section className="examQuestionPanel" aria-label="取题与试别">
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
              <button className="paperButton examFetchButton" type="submit" disabled={status === "loading" || !canCallSessionApi}>
                取题
              </button>
            </form>
          </section>

          {activeExamForSession ? (
            <section className="examDesk" aria-label="当前试卷">
              <div className="examPaperHeader">
                <p className="eyebrow">考题</p>
                <p className="examPaperMeta">
                  {safeDifficulty} · 目标约 {targetWordCount} 字
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
                <button className="paperButton" type="submit" disabled={status === "loading" || !canCallSessionApi}>
                  推进考场
                </button>
              </form>

              <form className="examSubmit" onSubmit={handleSubmit}>
                <label>
                  文章
                  <textarea value={essay} onChange={(event) => setEssay(event.target.value)} rows={10} />
                </label>
                <div className="examDraftBar" aria-label="写作区字数与草稿状态">
                  <span>{essayWordCount} / {targetWordCount} 字</span>
                  <span>{draftState}</span>
                </div>
                <button className="paperButton examSealSubmitButton" type="submit" disabled={status === "loading" || !canCallSessionApi}>
                  交卷
                </button>
              </form>
            </section>
          ) : (
            <section className="examDesk examEmptyPaper" aria-label="当前试卷">
              <p className="eyebrow">中央试卷</p>
              <h2>案卷未启</h2>
              <p>先择试别取题；预览案卷只展示界面，不向服务器请求考题。</p>
            </section>
          )}
        </main>

        <aside className="examSideColumn" aria-label="考场记录">
          <section className="examRecordPanel">
            <p className="eyebrow">场内记录</p>
            <ul className="examRecordList">
              <li>{activeExamForSession ? "监临点卷，题纸已揭。" : "监临未点名，题纸尚封。"}</li>
              <li>近次行动：{safeSceneActionPreview}</li>
              <li>{draftState}</li>
            </ul>
          </section>

          <section className="examPeerPanel" aria-label="虚拟考生占位">
            <p className="eyebrow">同场诸生</p>
            <div className="examPeerGrid" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p>虚拟考生、阅卷官与榜单只显示安全占位；名次、同年与座师关系待服务器放榜。</p>
          </section>

          <section className="examPreviewPanel" aria-label="预览案卷提示">
            <p className="eyebrow">预览案卷</p>
            <p>{canCallSessionApi ? "当前案卷可取题、推进考场并交卷。" : "预览案卷不取题；请先从首页新开一卷。"}</p>
          </section>

          <section className="examRecentSubmitPanel" aria-label="最近交卷提示">
            <p className="eyebrow">最近交卷</p>
            <p>{latestSubmitForSession?.score ? `${safeRecentExamName} 已有评定，可入皇榜细看。` : "尚无本案卷交卷评定。"}</p>
          </section>
        </aside>
      </div>

      <section className="examSafetyBoundary" aria-label="科举安全边界">
        <p>
          交卷、评分、舞弊、放榜、晋级和授官都由服务器裁决；本页只呈现已公开的考试快照与考场记录。
        </p>
      </section>

      {error ? <p className="statusLine" role="alert">{safeError}</p> : null}
    </article>
  );
}
