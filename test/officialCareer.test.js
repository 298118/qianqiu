const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { applyRelationshipChanges } = require("../src/game/relationships");
const { applyStatePatch } = require("../src/game/stateRules");
const { monthsToTurns } = require("../src/game/time");
const {
  buildOfficialCareerView,
  ensureOfficialCareerState,
  normalizeOfficialCareerState,
  runOfficialCareerStep
} = require("../src/game/officialCareer");

function applyOfficialCareerResult(worldState, result) {
  applyStatePatch(worldState, result.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  applyRelationshipChanges(worldState, result.relationshipChanges);
}

test("initial state carries an empty server-owned official career ledger", () => {
  const worldState = createInitialState({ playerName: "Tester" });

  assert.deepEqual(worldState.officialCareer, {
    schemaVersion: 2,
    tenureMonths: 0,
    reviewCycleMonths: 12,
    lastReviewTurn: null,
    lastReviewYear: null,
    currentPosting: "未授",
    bureauId: null,
    careerHistory: [],
    pendingOutcome: null,
    cooldowns: {},
    cooldownUnit: "ten_day",
    assignments: [],
    assessmentDossier: {
      cycleId: "1644-career",
      meritScore: 0,
      riskScore: 0,
      lastUpdatedTurn: null,
      notes: [],
      pendingRecommendation: null
    },
    impeachmentProcedure: {
      stage: "none",
      sourceType: null,
      sourceId: null,
      openedTurn: null,
      dueTurn: null,
      deadlineUnit: "ten_day",
      risk: 0,
      visibleNotice: "",
      hiddenNotes: [],
      lastUpdatedTurn: null
    }
  });
  assert.equal(buildOfficialCareerView(worldState).active, false);
});

test("official career state normalizes invalid legacy data", () => {
  const worldState = createInitialState({ role: "official", playerName: "Tester" });
  worldState.turnCount = 2;
  worldState.officialCareer = {
    schemaVersion: 99,
    tenureMonths: 9999,
    reviewCycleMonths: 2,
    lastReviewTurn: "bad",
    currentPosting: "",
    careerHistory: [
      { type: "invented", label: "bad" },
      {
        id: "OC-old",
        type: "promotion",
        label: "升迁",
        year: 1644,
        month: 13,
        turn: 3,
        officeTitleBefore: "六部观政进士",
        officeTitleAfter: "翰林院编修",
        reason: "old record"
      }
    ],
    cooldowns: { promotion: 6 },
    assignments: [{
      id: "ASG-legacy-relief",
      title: "赈银核销",
      kind: "relief",
      dueTurn: 6
    }],
    impeachmentProcedure: {
      stage: "risk_watch",
      dueTurn: 5,
      risk: 45
    }
  };

  ensureOfficialCareerState(worldState);

  assert.equal(worldState.officialCareer.schemaVersion, 2);
  assert.equal(worldState.officialCareer.tenureMonths, 600);
  assert.equal(worldState.officialCareer.reviewCycleMonths, 6);
  assert.equal(worldState.officialCareer.currentPosting, "候选观政");
  assert.equal(worldState.officialCareer.bureauId, "ministry_personnel");
  assert.equal(worldState.officialCareer.careerHistory.length, 1);
  assert.equal(worldState.officialCareer.careerHistory[0].month, 12);
  assert.equal(worldState.officialCareer.cooldowns.promotion, worldState.turnCount + monthsToTurns(4));
  assert.equal(worldState.officialCareer.cooldownUnit, "ten_day");
  assert.equal(worldState.officialCareer.assignments[0].dueTurn, worldState.turnCount + monthsToTurns(4));
  assert.equal(worldState.officialCareer.assignments[0].deadlineUnit, "ten_day");
  assert.equal(worldState.officialCareer.assessmentDossier.meritScore, 30);
  assert.equal(worldState.officialCareer.impeachmentProcedure.stage, "risk_watch");
  assert.equal(worldState.officialCareer.impeachmentProcedure.dueTurn, worldState.turnCount + monthsToTurns(3));
  assert.equal(worldState.officialCareer.impeachmentProcedure.deadlineUnit, "ten_day");
  assert.deepEqual(normalizeOfficialCareerState(worldState), worldState.officialCareer);
});

test("official career normalization mirrors server officeTitle over stale legacy posting", () => {
  const worldState = createInitialState({ role: "official", playerName: "Tester" });
  worldState.player.officeTitle = "户部主事";
  worldState.player.position = "户部主事";
  worldState.officialCareer = {
    schemaVersion: 1,
    currentPosting: "翰林院庶吉士",
    careerHistory: []
  };

  ensureOfficialCareerState(worldState);

  assert.equal(worldState.officialCareer.schemaVersion, 2);
  assert.equal(worldState.officialCareer.currentPosting, "户部主事");
  assert.equal(worldState.officialCareer.bureauId, "ministry_revenue");
});

test("official career step appoints direct official starts without provider authority", () => {
  const worldState = createInitialState({ role: "official", playerName: "Tester" });
  worldState.turnCount = 1;
  worldState.month = 2;

  const result = runOfficialCareerStep(worldState);
  applyOfficialCareerResult(worldState, result);

  assert.equal(result.outcome.type, "appointment");
  assert.equal(worldState.player.officeTitle, "六部观政进士");
  assert.equal(worldState.player.position, "六部观政进士");
  assert.equal(worldState.officialCareer.careerHistory.at(-1).type, "appointment");
  assert.ok(result.events[0].includes("[官场结算]"));
  assert.ok(result.relationshipChanges.some((change) => change.targetId === "C01"));
  assert.equal(buildOfficialCareerView(worldState).lastOutcome.type, "appointment");
});

test("official career step promotes strong annual reviews and resets prospect", () => {
  const worldState = createInitialState({ role: "official", playerName: "Tester" });
  Object.assign(worldState.player, {
    officeTitle: "六部观政进士",
    position: "六部观政进士",
    superiorFavor: 82,
    peerNetwork: 72,
    performanceMerit: 78,
    promotionProspect: 88,
    impeachmentRisk: 20,
    cleanReputation: 82,
    influence: 35
  });
  worldState.turnCount = 12;
  worldState.month = 1;
  worldState.officialCareer.tenureMonths = 11;

  const result = runOfficialCareerStep(worldState);
  applyOfficialCareerResult(worldState, result);

  assert.equal(result.outcome.type, "promotion");
  assert.notEqual(worldState.player.officeTitle, "六部观政进士");
  assert.ok(worldState.player.influence > 35);
  assert.ok(worldState.player.promotionProspect < 88);
  assert.equal(worldState.officialCareer.lastReviewYear, worldState.year);
});

test("official career step can form impeachment cases and punish severe risk", () => {
  const impeachmentState = createInitialState({ role: "official", playerName: "Tester" });
  Object.assign(impeachmentState.player, {
    officeTitle: "监察御史",
    position: "监察御史",
    impeachmentRisk: 90,
    cleanReputation: 52,
    integrity: 55,
    performanceMerit: 42,
    promotionProspect: 20
  });
  impeachmentState.turnCount = 8;
  const impeachment = runOfficialCareerStep(impeachmentState);
  applyOfficialCareerResult(impeachmentState, impeachment);

  assert.equal(impeachment.outcome.type, "impeachment");
  assert.equal(impeachmentState.player.officeTitle, "候勘官员");
  assert.ok(impeachmentState.player.impeachmentRisk < 90);

  const punishmentState = createInitialState({ role: "official", playerName: "Tester" });
  Object.assign(punishmentState.player, {
    officeTitle: "监察御史",
    position: "监察御史",
    impeachmentRisk: 99,
    cleanReputation: 28,
    integrity: 35,
    reputation: 40
  });
  punishmentState.corruption = 92;
  punishmentState.turnCount = 9;
  const punishment = runOfficialCareerStep(punishmentState);
  applyOfficialCareerResult(punishmentState, punishment);

  assert.equal(punishment.outcome.type, "punishment");
  assert.equal(punishmentState.player.role, "scholar");
  assert.equal(punishmentState.player.officeTitle, null);
  assert.equal(punishmentState.officialCareer.careerHistory.at(-1).type, "punishment");
});

test("official career step tracks assignments, assessment dossier, and safe player-facing view", () => {
  const worldState = createInitialState({ role: "official", playerName: "Tester" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事",
    performanceMerit: 44,
    impeachmentRisk: 22
  });
  worldState.officialCareer.currentPosting = "户部主事";

  const result = runOfficialCareerStep(worldState, "督办赈灾与赈银核销");
  applyOfficialCareerResult(worldState, result);

  assert.equal(worldState.officialCareer.schemaVersion, 2);
  assert.equal(worldState.officialCareer.bureauId, "ministry_revenue");
  assert.equal(worldState.officialCareer.assignments.length, 1);
  assert.equal(worldState.officialCareer.assignments[0].kind, "relief");
  assert.equal(worldState.officialCareer.assignments[0].dueTurn, monthsToTurns(4));
  assert.equal(worldState.officialCareer.assignments[0].hiddenNotes.length, 0);
  assert.ok(worldState.officialCareer.assessmentDossier.meritScore > 44);
  assert.ok(result.events.some((event) => event.includes("[官场差遣]")));

  worldState.officialCareer.assignments[0].hiddenNotes = ["有人暗中遮掩亏空"];
  const view = buildOfficialCareerView(worldState);
  assert.equal(view.bureau.name, "户部");
  assert.equal(view.assignmentSummary.activeCount, 1);
  assert.equal(view.assignments[0].title, "赈银核销");
  assert.equal(view.assignments[0].turnsRemaining, monthsToTurns(4));
  assert.match(view.assignments[0].deadlineLabel, /尚余12旬（约4月）/);
  assert.equal(JSON.stringify(view).includes("遮掩亏空"), false);
  assert.equal(view.assessment.meritScore, worldState.officialCareer.assessmentDossier.meritScore);
});

test("official career step opens impeachment procedure without exposing hidden notes", () => {
  const worldState = createInitialState({ role: "official", playerName: "Tester" });
  Object.assign(worldState.player, {
    officeTitle: "监察御史",
    position: "监察御史",
    impeachmentRisk: 72,
    cleanReputation: 66
  });

  const result = runOfficialCareerStep(worldState, "具疏弹劾贪墨官员并查账");
  applyOfficialCareerResult(worldState, result);

  assert.equal(worldState.officialCareer.impeachmentProcedure.stage, "risk_watch");
  assert.ok(worldState.officialCareer.impeachmentProcedure.risk >= 72);
  assert.equal(worldState.officialCareer.impeachmentProcedure.dueTurn, monthsToTurns(4));
  assert.ok(worldState.officialCareer.impeachmentProcedure.hiddenNotes.length > 0);
  worldState.officialCareer.impeachmentProcedure.hiddenNotes.push("密札指向上官");
  const view = buildOfficialCareerView(worldState);
  assert.equal(view.procedureSummary.impeachmentStage, "risk_watch");
  assert.match(view.procedureSummary.visibleNotice, /弹劾|风闻|台谏/);
  assert.match(view.procedureSummary.deadlineLabel, /尚余12旬（约4月）/);
  assert.equal(JSON.stringify(view).includes("密札指向上官"), false);
});
