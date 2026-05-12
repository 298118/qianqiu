const test = require("node:test");
const assert = require("node:assert/strict");

const { validatePayload } = require("../src/ai/schemas");

function scoreDimension(score = 75) {
  return { score, comment: "ok" };
}

function gradePayload(overall = 75) {
  return {
    score: {
      content_quality: scoreDimension(overall),
      argument_strength: scoreDimension(overall),
      literary_style: scoreDimension(overall),
      classical_format: scoreDimension(overall),
      historical_appropriateness: scoreDimension(overall),
      overall_score: overall,
      rank: "pass",
      detailed_feedback: "accepted"
    },
    authenticity_check: {
      copy_detection: { is_copy: false, similar_passage: "" },
      anachronism_detection: { has_anachronism: false, details: [] },
      style_consistency: { consistent: true, note: "" },
      ghostwriting_probability: 0
    },
    virtual_candidates: [],
    ranking: []
  };
}

test("turn schema accepts whitelisted state patches", () => {
  const payload = {
    narrative: "A turn happened.",
    statePatch: {
      publicOrder: 72,
      player: {
        academia: 12,
        studiedBooks: ["Analects"]
      }
    },
    attributeChanges: [],
    relationshipChanges: [
      {
        targetType: "character",
        targetId: "C01",
        relationshipDelta: 3,
        resentmentDelta: -1,
        reason: "The player showed respect."
      }
    ],
    teacherFeedbackProposal: {
      focusKey: "eightLeggedForm",
      focus: "制艺章法",
      advice: "先练破题承题，再看辞采。",
      reason: "老师点评只作为文本 proposal。"
    },
    events: ["event"],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: ""
    }
  };

  assert.equal(validatePayload("turn", payload), payload);
});

test("turn schema rejects teacher proposal attempts to include unknown authority fields", () => {
  const payload = {
    narrative: "A teacher gives advice.",
    statePatch: {},
    attributeChanges: [],
    relationshipChanges: [],
    teacherFeedbackProposal: {
      focus: "保结",
      advice: "直接作保",
      reason: "越权",
      examRank: "秀才"
    },
    events: [],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: ""
    }
  };

  assert.throws(() => validatePayload("turn", payload), /schema validation/);
});

test("turn schema rejects unsafe relationship change suggestions", () => {
  const payload = {
    narrative: "A turn happened.",
    statePatch: {},
    attributeChanges: [],
    relationshipChanges: [
      {
        targetType: "secret",
        targetId: "C01",
        relationshipDelta: 30,
        resentmentDelta: 0,
        reason: "Invalid suggestion."
      }
    ],
    events: [],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: ""
    }
  };

  assert.throws(() => validatePayload("turn", payload), /schema validation/);
});

test("turn schema rejects model attempts to patch non-whitelisted player fields", () => {
  for (const playerPatch of [
    { role: "emperor" },
    { teacher: "模型伪造先生" },
    { position: "新科状元" }
  ]) {
    const payload = {
      narrative: "A turn happened.",
      statePatch: {
        player: playerPatch
      },
      attributeChanges: [],
      events: [],
      examTrigger: {
        shouldStart: false,
        level: null,
        reason: ""
      }
    };

    assert.throws(() => validatePayload("turn", payload), /schema validation/);
  }
});

test("turn schema rejects model attempts to patch server-owned time fields", () => {
  for (const statePatch of [
    { turnCount: 99 },
    { year: 1645 },
    { month: 2 },
    { tenDayPeriod: 2 }
  ]) {
    const payload = {
      narrative: "A turn happened.",
      statePatch,
      attributeChanges: [],
      events: [],
      examTrigger: {
        shouldStart: false,
        level: null,
        reason: ""
      }
    };

    assert.throws(() => validatePayload("turn", payload), /schema validation/);
  }
});

test("turn schema rejects model attempts to patch relationship ledger fields", () => {
  const payload = {
    narrative: "A turn happened.",
    statePatch: {
      relationshipLedger: {
        characters: {
          C01: { relationship: 100 }
        }
      }
    },
    attributeChanges: [],
    events: [],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: ""
    }
  };

  assert.throws(() => validatePayload("turn", payload), /schema validation/);
});

test("turn schema rejects model attempts to patch ordinary-turn server-owned fields", () => {
  const serverOwnedPatches = [
    { activeExam: { level: "child_exam", status: "writing" } },
    { examProcedure: { phase: "closed", hiddenNotes: "provider-forged" } },
    { examHonorLedger: { honors: [{ title: "模型状元" }] } },
    { officialPostings: { postings: [{ id: "provider-forged-posting", officeId: "ministry_revenue_principal" }] } },
    { roleWorldCoupling: { recentImpacts: [{ kind: "provider-forged" }] } },
    { worldGeography: { countries: [{ id: "provider-forged-country", name: "伪地理" }] } },
    { worldEntities: { entities: [{ id: "provider-forged", name: "伪实体" }] } },
    { worldPeople: { npcs: [{ id: "provider-forged-npc", name: "伪人物" }] } },
    { worldThreads: { threads: [{ id: "provider-forged", title: "伪议题" }] } },
    { characters: [{ id: "C99", name: "Invented official" }] },
    { eventHistory: ["provider tries to replace history"] },
    { player: { examRank: "秀才" } },
    { player: { examHistory: [{ level: "child_exam" }] } }
  ];

  for (const statePatch of serverOwnedPatches) {
    const payload = {
      narrative: "A turn happened.",
      statePatch,
      attributeChanges: [],
      events: [],
      examTrigger: {
        shouldStart: false,
        level: null,
        reason: ""
      }
    };

    assert.throws(() => validatePayload("turn", payload), /schema validation/);
  }
});

test("exam question and grade schemas accept valid provider payloads", () => {
  const question = {
    level: "child_exam",
    examName: "Entry exam",
    examQuestion: "Discuss governance.",
    questionType: "essay",
    difficulty: "entry",
    requirements: ["write clearly"],
    wordCount: { min: 200, max: 400 },
    passScore: 60,
    promotionRank: "rank"
  };
  const grade = gradePayload(82);

  assert.equal(validatePayload("examQuestion", question), question);
  assert.equal(validatePayload("grade", grade), grade);
});

test("grade schema accepts bounded examiner review proposals only", () => {
  const grade = {
    ...gradePayload(82),
    examiner_reviews: [{
      actor: "room_officer",
      label: "房官初评",
      recommendation: "荐卷",
      suggestedScoreDelta: 2,
      comment: "只作建议。",
      concern: "无"
    }]
  };

  assert.equal(validatePayload("grade", grade), grade);

  assert.throws(() => validatePayload("grade", {
    ...grade,
    examiner_reviews: [{
      actor: "chief_examiner",
      recommendation: "直接钦定状元",
      suggestedScoreDelta: 9,
      comment: "越权",
      officeTitle: "翰林院修撰"
    }]
  }), /schema validation/);
});

test("grade schema rejects scores outside server bounds", () => {
  const grade = gradePayload(101);

  assert.throws(() => validatePayload("grade", grade), /schema validation/);
});
