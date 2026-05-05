const express = require("express");
const { getProvider } = require("../ai");
const {
  canEnterExam,
  createExamId,
  getExam,
  getExamRequirements,
  getNextExamLevel,
  summarizeReadiness
} = require("../game/exams");
const { appendEvents } = require("../game/stateRules");
const { readSession, writeSession } = require("../storage/sessionStore");

const router = express.Router();

function toExamPayload(worldState) {
  const activeExam = worldState.activeExam;
  return {
    sessionId: worldState.sessionId,
    examId: activeExam.examId,
    level: activeExam.level,
    examName: activeExam.examName,
    examQuestion: activeExam.examQuestion,
    questionType: activeExam.questionType,
    difficulty: activeExam.difficulty,
    requirements: activeExam.requirements,
    wordCount: activeExam.wordCount,
    passScore: activeExam.passScore,
    promotionRank: activeExam.promotionRank,
    readiness: activeExam.readiness,
    worldState
  };
}

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

router.post("/question", async (req, res, next) => {
  try {
    const { sessionId, level } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      throw fail(400, "Missing sessionId");
    }

    const worldState = await readSession(sessionId);
    const requestedLevel = level || worldState.activeExam?.level || getNextExamLevel(worldState.player.examRank);
    const exam = getExam(requestedLevel);

    if (!exam) {
      throw fail(400, "Unknown exam level");
    }

    const gate = canEnterExam(worldState.player, exam.level);
    if (!gate.ok) {
      throw fail(400, gate.reason);
    }

    if (
      worldState.activeExam &&
      worldState.activeExam.level === exam.level &&
      worldState.activeExam.examQuestion
    ) {
      res.json(toExamPayload(worldState));
      return;
    }

    if (
      worldState.activeExam &&
      worldState.activeExam.examQuestion &&
      worldState.activeExam.level !== exam.level
    ) {
      throw fail(409, "已有未完成考试，请先完成当前考试。");
    }

    const provider = getProvider();
    const question = await provider.generateExamQuestion(worldState, exam);
    const previousExam = worldState.activeExam || {};

    worldState.activeExam = {
      examId: createExamId(exam.level),
      level: exam.level,
      examName: question.examName || exam.name,
      examQuestion: question.examQuestion,
      questionType: question.questionType || exam.questionType,
      difficulty: question.difficulty || exam.difficulty,
      requirements: question.requirements || getExamRequirements(exam),
      wordCount: question.wordCount || exam.wordCount,
      passScore: question.passScore ?? exam.passScore,
      promotionRank: question.promotionRank || exam.promotionRank,
      readiness: summarizeReadiness(worldState.player, exam),
      reason: previousExam.reason || "玩家入场取题",
      status: "writing",
      generatedAt: new Date().toISOString()
    };

    appendEvents(worldState, [
      `${worldState.player.name}进入${exam.name}，领取${exam.questionType}题。`
    ]);

    await writeSession(worldState);

    res.status(201).json(toExamPayload(worldState));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
