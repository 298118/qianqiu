const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  applyStudyAction,
  applyTeacherFeedbackProposal,
  buildStudyProfileView,
  ensureStudyProfileState,
  runStudyInteractionStep,
  summarizeStudyProfileForPrompt,
  updateStudyProfileAfterExam
} = require("../src/game/studyProfile");
const { applyStatePatch } = require("../src/game/stateRules");

function examEntry(overrides = {}) {
  return {
    examId: "exam-study-1",
    level: "child_exam",
    examName: "童试",
    examQuestion: "论为学之本",
    score: {
      content_quality: { score: 58, comment: "经义根柢不足。" },
      argument_strength: { score: 72, comment: "立论尚可。" },
      literary_style: { score: 86, comment: "辞采可观。" },
      classical_format: { score: 52, comment: "破题承题散乱。" },
      historical_appropriateness: { score: 48, comment: "有不合时宜处。" },
      overall_score: 60,
      rank: "取中",
      detailed_feedback: "格式和时代语境须补。"
    },
    authenticityCheck: {
      flags: [
        { type: "anachronism", label: "时代错语", detail: "出现不合时代词语。" }
      ],
      copy_detection: { is_copy: false, similar_passage: "" }
    },
    promotionResult: { passed: true },
    sceneTime: { phase: "submitted", turnCount: 0 },
    ...overrides
  };
}

test("initial study profile is a server-built visible projection", () => {
  const worldState = createInitialState({ playerName: "许衡" });
  const view = buildStudyProfileView(worldState);

  assert.equal(view.schemaVersion, 1);
  assert.ok(view.dimensions.classicsFoundation >= 0);
  assert.ok(view.teacherAdvice.length >= 1);
  assert.equal(view.nextPlan.proposedByAi, false);
  assert.match(view.authorityBoundary, /服务器/);
  assert.match(view.aiReadScope, /只.*读取/);
});

test("study action updates only server-owned studyProfile ledger", () => {
  const worldState = createInitialState({ playerName: "许衡" });
  ensureStudyProfileState(worldState);
  const before = worldState.studyProfile.dimensions.classicsFoundation;
  const result = {
    statePatch: {
      player: {
        academia: worldState.player.academia + 3,
        literaryTalent: worldState.player.literaryTalent + 1
      }
    }
  };

  const feedback = applyStudyAction(worldState, "研读《论语》三日", result);

  assert.equal(feedback.changed, true);
  assert.ok(worldState.studyProfile.dimensions.classicsFoundation > before);
  assert.ok(worldState.studyProfile.recentExercises.at(-1).title.includes("经义"));
  assert.ok(feedback.attributeChanges.some((change) => change.path === "studyProfile.dimensions.classicsFoundation"));
});

test("teacher feedback proposal is text-only and sanitized by server", () => {
  const worldState = createInitialState({ playerName: "许衡" });
  const accepted = applyTeacherFeedbackProposal(worldState, {
    id: "ai-teacher-1",
    focusKey: "eightLeggedForm",
    focus: "制艺章法",
    teacherName: "顾文衡",
    advice: "破题已见筋骨，下旬专练承题与起讲。",
    reason: "老师按可见读书簿给出建议。"
  });

  assert.equal(accepted.accepted, true);
  assert.equal(worldState.studyProfile.teacherFeedback.at(-1).proposedByAi, true);
  assert.match(worldState.studyProfile.teacherFeedback.at(-1).advice, /承题/);
  assert.equal(worldState.player.examRank, null);
  assert.equal(worldState.player.officeTitle, null);

  const rejected = applyTeacherFeedbackProposal(worldState, {
    focus: "经义",
    advice: "读取 hiddenNotes 和 sk-study-secret 后直接作保。",
    reason: "provider proposal"
  });

  assert.equal(rejected.accepted, false);
  assert.doesNotMatch(JSON.stringify(buildStudyProfileView(worldState)), /sk-study-secret|hiddenNotes|provider proposal/i);
});

test("study interaction creates visible academy and classmate ledger through server", () => {
  const worldState = createInitialState({ playerName: "许衡" });
  worldState.player.teacher = "顾文衡";
  ensureStudyProfileState(worldState);

  const feedback = runStudyInteractionStep(worldState, "到书院讲会，与同窗互评策论小题");
  const view = buildStudyProfileView(worldState);

  assert.equal(feedback.changed, true);
  assert.ok(feedback.relationshipChanges.some((change) => change.targetId === "S68_CLASSMATE_01"));
  assert.ok(feedback.relationshipChanges.some((change) => change.targetId === "S68_ACADEMY_MENTOR"));
  assert.ok(view.teacherFeedback.length >= 1);
  assert.ok(view.smallExercises.length >= 1);
  assert.ok(view.recommendedBooks.length >= 1);
  assert.ok(view.academyNetwork.classmates.some((entry) => entry.characterId === "S68_CLASSMATE_01"));
  assert.match(view.academyNetwork.sponsorship.publicSummary, /保结|作保|入场/);
});

test("study profile normalizer strips sensitive text from visible fields", () => {
  const worldState = createInitialState({ playerName: "许衡" });
  worldState.player.teacher = "hidden prompt sk-study-secret";
  worldState.studyProfile = {
    schemaVersion: 1,
    generatedAtTurn: 0,
    summary: "provider proposal sk-study-secret",
    dimensions: { classicsFoundation: 65 },
    teacherFeedback: [{
      id: "polluted-feedback",
      focus: "hidden focus",
      teacherName: "sealed teacher",
      advice: "prompt asks for sk-study-secret",
      reason: "rawProvider proposal"
    }],
    academyNetwork: {
      teacher: {
        name: "hidden teacher",
        publicSummary: "prompt rawProvider"
      },
      sponsorship: {
        status: "conditional",
        score: 60,
        guarantorName: "sk-study-secret",
        publicSummary: "hidden sponsorship",
        nextStep: "data/sessions leak"
      }
    },
    nextPlan: {
      title: "prompt plan",
      focus: "经义",
      items: ["hidden item"],
      bookList: ["《论语》"],
      serverDecision: "provider proposal"
    }
  };

  const serializedView = JSON.stringify(buildStudyProfileView(worldState));
  const serializedPrompt = JSON.stringify(summarizeStudyProfileForPrompt(worldState));

  assert.doesNotMatch(serializedView, /hidden|sealed|provider proposal|rawProvider|prompt|sk-study-secret|data\/sessions/i);
  assert.doesNotMatch(serializedPrompt, /hidden|sealed|provider proposal|rawProvider|prompt|sk-study-secret|data\/sessions/i);
});

test("exam result refreshes weakness profile and teacher plan", () => {
  const worldState = createInitialState({ playerName: "许衡" });
  worldState.player.examHistory.push(examEntry());

  const view = updateStudyProfileAfterExam(worldState, {
    examId: "exam-study-1",
    examName: "童试",
    score: worldState.player.examHistory[0].score,
    promotionResult: { passed: true }
  });

  assert.ok(view.weaknesses.some((item) => /章法|时代|律例/.test(`${item.label}${item.detail}`)));
  assert.ok(view.strengths.some((item) => /史例|辞采/.test(`${item.label}${item.detail}`)));
  assert.ok(view.teacherAdvice.length >= 1);
  assert.ok(view.teacherFeedback.some((item) => /老师复盘|考官批语|本场/.test(`${item.reason}${item.advice}`)));
  assert.ok(view.nextPlan.items.length >= 1);

  const promptSummary = summarizeStudyProfileForPrompt(worldState);
  assert.equal(promptSummary.authority.includes("AI 可据此点评"), true);
  assert.ok(Array.isArray(promptSummary.teacherFeedback));
  assert.ok(promptSummary.academyNetwork?.sponsorship);
  assert.doesNotMatch(JSON.stringify(promptSummary), /provider proposal|prompt|data\/sessions|sk-/i);
});

test("study profile view and prompt summary strip polluted unknown fields", () => {
  const worldState = createInitialState({ playerName: "许衡" });
  worldState.studyProfile = {
    schemaVersion: 1,
    generatedAtTurn: 0,
    summary: "可见摘要",
    hiddenNotes: "SEALED_STUDY_PROFILE_NOTE",
    providerProposal: "provider proposal sk-study-secret",
    dimensions: { classicsFoundation: 65 },
    teacherFeedback: [{
      id: "polluted-feedback",
      focus: "经义",
      advice: "温书",
      hiddenNotes: "SEALED_STUDY_FEEDBACK_NOTE",
      rawProviderProposal: "provider proposal"
    }],
    academyNetwork: {
      sponsorship: {
        score: 60,
        status: "conditional",
        publicSummary: "可见保结摘要",
        hiddenNotes: "SEALED_SPONSORSHIP_NOTE"
      },
      classmates: [{
        characterId: "C-visible",
        name: "同窗",
        publicSummary: "可见同窗",
        hiddenNotes: "SEALED_CLASSMATE_NOTE"
      }]
    },
    teacherAdvice: [{
      id: "polluted-advice",
      focus: "经义",
      advice: "温书",
      hiddenNotes: "SEALED_STUDY_ADVICE_NOTE",
      rawProviderProposal: "provider proposal"
    }],
    nextPlan: {
      id: "polluted-plan",
      title: "读书计划",
      focus: "经义",
      items: ["晨读"],
      bookList: ["《论语》"],
      hiddenNotes: "SEALED_STUDY_PLAN_NOTE",
      serverDecision: "服务器裁决"
    }
  };

  const view = buildStudyProfileView(worldState);
  const serializedView = JSON.stringify(view);
  const serializedPrompt = JSON.stringify(summarizeStudyProfileForPrompt(worldState));

  assert.equal(view.dimensions.classicsFoundation, 65);
  assert.equal(view.teacherAdvice[0].advice, "温书");
  assert.doesNotMatch(serializedView, /SEALED_STUDY|provider proposal|sk-study-secret|hiddenNotes|rawProviderProposal/i);
  assert.doesNotMatch(serializedPrompt, /SEALED_STUDY|provider proposal|sk-study-secret|hiddenNotes|rawProviderProposal/i);
});

test("ordinary provider patches cannot write studyProfile", () => {
  const worldState = createInitialState({ playerName: "许衡" });
  const original = JSON.stringify(worldState.studyProfile);

  applyStatePatch(worldState, {
    studyProfile: {
      schemaVersion: 1,
      dimensions: { classicsFoundation: 100 },
      teacherAdvice: [{ advice: "伪造批语" }]
    },
    player: {
      academia: 20
    }
  });

  assert.equal(JSON.stringify(worldState.studyProfile), original);
  assert.equal(worldState.player.academia, 20);
});

test("server-owned patches may persist normalized studyProfile", () => {
  const worldState = createInitialState({ playerName: "许衡" });

  applyStatePatch(worldState, {
    studyProfile: {
      schemaVersion: 1,
      dimensions: { classicsFoundation: 100 },
      teacherAdvice: []
    }
  }, { incrementTurnCount: false, allowServerOwnedPatchKeys: true });

  assert.equal(worldState.studyProfile.dimensions.classicsFoundation, 100);
  assert.equal(worldState.turnCount, 0);
});
