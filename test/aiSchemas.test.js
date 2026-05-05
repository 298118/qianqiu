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
    events: ["event"],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: ""
    }
  };

  assert.equal(validatePayload("turn", payload), payload);
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
  const payload = {
    narrative: "A turn happened.",
    statePatch: {
      player: {
        role: "emperor"
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

test("turn schema rejects model attempts to patch server-owned calendar fields", () => {
  const payload = {
    narrative: "A turn happened.",
    statePatch: {
      year: 1645,
      month: 2
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

test("grade schema rejects scores outside server bounds", () => {
  const grade = gradePayload(101);

  assert.throws(() => validatePayload("grade", grade), /schema validation/);
});
