import type { FormEvent } from "react";
import { useState } from "react";
import { useParams } from "react-router";
import type { ExamLevel } from "../api";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";

const examLevels: { value: ExamLevel; label: string }[] = [
  { value: "child_exam", label: "童试" },
  { value: "provincial_exam", label: "乡试" },
  { value: "metropolitan_exam", label: "会试" },
  { value: "palace_exam", label: "殿试" }
];

export function ExamPage() {
  const { sessionId = "s74-preview" } = useParams();
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
    <article className="surfacePanel routePanel" aria-labelledby="exam-title">
      <h2 id="exam-title">科举</h2>
      <p>县试、乡试、会试与殿试层层相接，灯下文章自有去处。</p>
      <form className="inlineForm" onSubmit={handleQuestion}>
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
        <button className="paperButton" type="submit" disabled={status === "loading" || !canCallSessionApi}>
          取题
        </button>
      </form>
      {activeExamForSession ? (
        <section className="examDesk" aria-label="当前试卷">
          <h3>{activeExamForSession.examName || "当前考试"}</h3>
          <p>{activeExamForSession.examQuestion || "试题已入卷。"}</p>
          <form className="inlineForm" onSubmit={handleProgress}>
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
              <textarea value={essay} onChange={(event) => setEssay(event.target.value)} rows={6} />
            </label>
            <button className="paperButton" type="submit" disabled={status === "loading" || !canCallSessionApi}>
              交卷
            </button>
          </form>
        </section>
      ) : null}
      {lastExamResult?.score ? <p>最近交卷已有评定，可入皇榜细看。</p> : null}
      {!canCallSessionApi ? <p>预览案卷不取题；请先从首页新开一卷。</p> : null}
      {error ? <p className="statusLine" role="alert">{error}</p> : null}
    </article>
  );
}
