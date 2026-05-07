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
const { applyAuthenticityPenalties, checkEssayAuthenticity } = require("../game/essayChecks");
const { buildRanking, generateVirtualCandidates } = require("../game/candidates");
const { createEntryPreparation } = require("../game/examTravel");
const {
  buildExamCalendarView,
  buildExamRivalView,
  canOpenExamInCalendar,
  ensureExamCalendarState,
  preparePersistentExamCohort,
  recordExamCohortResult,
  recordMissedExamWindow,
  selectPersistentCandidateSeeds
} = require("../game/examCalendar");
const { applyExamPromotion } = require("../game/promotions");
const { buildRelationshipInspectionView, ensureRelationshipLedger } = require("../game/relationships");
const { buildActiveNpcRequestView } = require("../game/activeRequests");
const { buildLongTermEventView, ensureLongTermEventState } = require("../game/longTermEvents");
const { buildOfficialCareerView, ensureOfficialCareerState } = require("../game/officialCareer");
const { buildRoleWorldCouplingView, ensureRoleWorldCouplingState } = require("../game/roleWorldCoupling");
const { buildWorldEntityView, ensureWorldEntityState } = require("../game/worldEntities");
const { buildWorldThreadView, ensureWorldThreadState } = require("../game/worldThreads");
const { appendEvents, applyStatePatch } = require("../game/stateRules");
const { mutateSession } = require("../storage/sessionStore");

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
    entryPreparation: activeExam.entryPreparation || null,
    examCalendar: activeExam.examCalendar || activeExam.entryPreparation?.examCalendar || null,
    examCalendarView: buildExamCalendarView(worldState),
    examRivalView: buildExamRivalView(worldState),
    relationshipView: buildRelationshipInspectionView(worldState),
    activeNpcRequestView: buildActiveNpcRequestView(worldState),
    roleWorldCouplingView: buildRoleWorldCouplingView(worldState),
    worldEntityView: buildWorldEntityView(worldState),
    worldThreadView: buildWorldThreadView(worldState),
    longTermEventView: buildLongTermEventView(worldState),
    officialCareerView: buildOfficialCareerView(worldState),
    worldState
  };
}

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function summarizeResultEvent(worldState, activeExam, score, ranking, promotionResult) {
  const playerPlace = ranking.find((entry) => entry.isPlayer)?.place || ranking.length;
  const outcome = promotionResult.passed
    ? `取中${promotionResult.rank}`
    : promotionResult.consequence?.label || "未能取中";
  return `${worldState.player.name}交${activeExam.examName}卷，得${score.overall_score}分，榜列第${playerPlace}，${outcome}。`;
}

router.post("/question", async (req, res, next) => {
  try {
    const { sessionId, level } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      throw fail(400, "Missing sessionId");
    }

    const result = await mutateSession(sessionId, async (worldState, context) => {
      ensureRelationshipLedger(worldState);
      ensureExamCalendarState(worldState);
      ensureLongTermEventState(worldState);
      ensureOfficialCareerState(worldState);
      ensureRoleWorldCouplingState(worldState);
      ensureWorldEntityState(worldState);
      ensureWorldThreadState(worldState);
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
        ensureWorldEntityState(worldState);
        ensureWorldThreadState(worldState);
        context.skipWrite = true;
        return { statusCode: 200, payload: toExamPayload(worldState) };
      }

      const previousExam = worldState.activeExam || {};
      const preservedCalendarSnapshot =
        previousExam.level === exam.level && previousExam.examCalendar?.isOpen
          ? previousExam.examCalendar
          : null;
      const calendarGate = preservedCalendarSnapshot
        ? { ok: true, reason: "", snapshot: preservedCalendarSnapshot }
        : canOpenExamInCalendar(worldState, exam);
      if (!calendarGate.ok) {
        const missed = recordMissedExamWindow(worldState, exam, calendarGate.snapshot, calendarGate.reason);
        if (missed) {
          appendEvents(worldState, [
            `${worldState.player.name}错过${exam.name}考期，改候${calendarGate.snapshot.nextWindowLabel}。`
          ]);
          context.errorAfterWrite = fail(409, calendarGate.reason);
          return null;
        }
        throw fail(409, calendarGate.reason);
      }

      if (
        worldState.activeExam &&
        worldState.activeExam.examQuestion &&
        worldState.activeExam.level !== exam.level
      ) {
        throw fail(409, "已有未完成考试，请先完成当前考试。");
      }

      const preparationResult = previousExam.entryPreparation
        ? null
        : createEntryPreparation(worldState, exam, calendarGate.snapshot);

      if (preparationResult) {
        applyStatePatch(worldState, preparationResult.statePatch, { incrementTurnCount: false });
      }

      const provider = getProvider();
      const question = await provider.generateExamQuestion(worldState, exam);

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
        entryPreparation: previousExam.entryPreparation || preparationResult.entryPreparation,
        examCalendar: previousExam.examCalendar || calendarGate.snapshot,
        reason: previousExam.reason || "玩家入场取题",
        status: "writing",
        generatedAt: new Date().toISOString()
      };

      appendEvents(worldState, [
        ...(preparationResult?.events || []),
        `${worldState.player.name}进入${exam.name}，领取${exam.questionType}题。`
      ]);
      ensureWorldEntityState(worldState);
      ensureWorldThreadState(worldState);

      return { statusCode: 201, payload: toExamPayload(worldState) };
    });

    res.status(result.statusCode).json(result.payload);
  } catch (error) {
    next(error);
  }
});

router.post("/submit", async (req, res, next) => {
  try {
    const { sessionId, examId, essay } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      throw fail(400, "Missing sessionId");
    }
    if (!examId || typeof examId !== "string") {
      throw fail(400, "Missing examId");
    }
    if (!essay || typeof essay !== "string" || !essay.trim()) {
      throw fail(400, "Missing or empty essay");
    }

    const payload = await mutateSession(sessionId, async (worldState) => {
      ensureRelationshipLedger(worldState);
      ensureExamCalendarState(worldState);
      ensureLongTermEventState(worldState);
      ensureOfficialCareerState(worldState);
      ensureRoleWorldCouplingState(worldState);
      ensureWorldEntityState(worldState);
      ensureWorldThreadState(worldState);
      const activeExam = worldState.activeExam;

      if (!activeExam || !activeExam.examQuestion) {
        throw fail(400, "当前没有可交卷的考试。");
      }
      if (activeExam.examId !== examId) {
        throw fail(409, "交卷编号与当前考试不符。");
      }
      if (activeExam.status && activeExam.status !== "writing") {
        throw fail(409, "当前考试已经交卷。");
      }

      const exam = getExam(activeExam.level);
      if (!exam) {
        throw fail(400, "Unknown exam level");
      }

      const provider = getProvider();
      const trimmedEssay = essay.trim();
      const authenticityCheck = checkEssayAuthenticity({
        essay: trimmedEssay,
        exam,
        player: worldState.player
      });
      const grade = await provider.gradeExamEssay(worldState, exam, trimmedEssay, authenticityCheck);
      const score = applyAuthenticityPenalties(grade.score, authenticityCheck, exam);
      const persistentCandidateSeeds = selectPersistentCandidateSeeds(worldState, exam);
      const virtualCandidates = preparePersistentExamCohort(
        worldState,
        exam,
        generateVirtualCandidates(worldState, exam, score.overall_score, {
          persistentCandidates: persistentCandidateSeeds
        })
      );
      const ranking = buildRanking(
        {
          id: "player",
          name: worldState.player.name,
          origin: worldState.dynasty,
          background: "本局玩家",
          score,
          isPlayer: true
        },
        virtualCandidates
      );
      const promotionResult = applyExamPromotion(worldState, exam, score, authenticityCheck);
      const cohortResult = recordExamCohortResult(worldState, exam, virtualCandidates, ranking);
      const submittedAt = new Date().toISOString();
      const historyEntry = {
        examId,
        level: activeExam.level,
        examName: activeExam.examName,
        examQuestion: activeExam.examQuestion,
        entryPreparation: activeExam.entryPreparation || null,
        examCalendar: activeExam.examCalendar || activeExam.entryPreparation?.examCalendar || null,
        essay: trimmedEssay,
        score,
        authenticityCheck,
        virtualCandidates,
        ranking,
        promotionResult,
        cohortResult,
        submittedAt
      };

      worldState.player.examHistory = [...(worldState.player.examHistory || []), historyEntry];
      worldState.activeExam = null;
      appendEvents(worldState, [summarizeResultEvent(worldState, activeExam, score, ranking, promotionResult)]);
      ensureRelationshipLedger(worldState);
      ensureWorldEntityState(worldState);
      ensureWorldThreadState(worldState);

      return {
        sessionId: worldState.sessionId,
        examId,
        level: exam.level,
        examName: activeExam.examName,
        examQuestion: activeExam.examQuestion,
        essay: trimmedEssay,
        entryPreparation: activeExam.entryPreparation || null,
        examCalendar: activeExam.examCalendar || activeExam.entryPreparation?.examCalendar || null,
        score,
        authenticityCheck,
        virtualCandidates,
        ranking,
        promotionResult,
        cohortResult,
        examCalendarView: buildExamCalendarView(worldState),
        examRivalView: buildExamRivalView(worldState),
        relationshipView: buildRelationshipInspectionView(worldState),
        activeNpcRequestView: buildActiveNpcRequestView(worldState),
        roleWorldCouplingView: buildRoleWorldCouplingView(worldState),
        worldEntityView: buildWorldEntityView(worldState),
        worldThreadView: buildWorldThreadView(worldState),
        longTermEventView: buildLongTermEventView(worldState),
        officialCareerView: buildOfficialCareerView(worldState),
        worldState
      };
    });

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
