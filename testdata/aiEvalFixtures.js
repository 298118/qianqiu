function scoreDimension(score = 76, comment = "\u6587\u6c14\u5c1a\u53e4\uff0c\u7ecf\u4e49\u8bba\u65ad\u6709\u636e\u3002") {
  return { score, comment };
}

function baseTurn(overrides = {}) {
  return {
    narrative: "\u53bf\u5b66\u8bf8\u751f\u95fb\u4f60\u8bfb\u7ecf\uff0c\u5e08\u957f\u547d\u4f60\u8bb0\u7cae\u4ef7\u4ee5\u89c2\u6c11\u60c5\u3002",
    statePatch: {},
    attributeChanges: [],
    relationshipChanges: [],
    events: ["\u53bf\u5b66\u8bfb\u7ecf\uff0c\u6c11\u95f4\u7cae\u4ef7\u5165\u8bb0\u3002"],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: ""
    },
    ...overrides
  };
}

function gradePayload(overall = 78, overrides = {}) {
  return {
    score: {
      content_quality: scoreDimension(overall),
      argument_strength: scoreDimension(overall),
      literary_style: scoreDimension(overall),
      classical_format: scoreDimension(overall),
      historical_appropriateness: scoreDimension(overall),
      overall_score: overall,
      rank: "\u53d6\u4e2d",
      detailed_feedback: "\u6587\u6c14\u5c1a\u53e4\uff0c\u80fd\u4ee5\u6c11\u98df\u4e0e\u6559\u5316\u76f8\u53c2\uff0c\u4e0d\u79bb\u671d\u5ef7\u53bf\u6cbb\u4e4b\u52a1\u3002"
    },
    authenticity_check: {
      copy_detection: { is_copy: false, similar_passage: "" },
      anachronism_detection: { has_anachronism: false, details: [] },
      style_consistency: { consistent: true, note: "" },
      ghostwriting_probability: 0
    },
    virtual_candidates: [],
    ranking: [],
    ...overrides
  };
}

const VALID_OUTPUT_FIXTURES = [
  {
    name: "opening",
    schemaName: "opening",
    raw: JSON.stringify({
      narrative: "\u5d07\u796f\u5341\u4e03\u5e74\u4e8c\u6708\uff0c\u53bf\u5b66\u949f\u9f13\u521d\u7f62\uff0c\u8bf8\u751f\u6267\u7ecf\u5165\u658b\uff0c\u7cae\u4ef7\u4e0e\u6c11\u60c5\u7686\u5165\u5e08\u957f\u95ee\u5bf9\u3002",
      events: ["\u53bf\u5b66\u5f00\u8bb2\uff0c\u8bf8\u751f\u8bba\u7ecf\u3002"]
    }),
    toneFields: ["narrative", "events.0"]
  },
  {
    name: "turn",
    schemaName: "turn",
    raw: `model output:\n${JSON.stringify(baseTurn({
      statePatch: {
        publicOrder: 72,
        player: {
          academia: 15,
          literaryTalent: 12
        }
      },
      attributeChanges: [
        {
          path: "player.academia",
          before: 12,
          after: 15,
          reason: "\u8bfb\u7ecf\u6709\u5f97"
        }
      ],
      relationshipChanges: [
        {
          targetType: "faction",
          targetId: "scholarOfficials",
          relationshipDelta: 3,
          resentmentDelta: -1,
          reason: "\u8bfb\u7ecf\u5b88\u793c\uff0c\u58eb\u6797\u7a0d\u52a0\u63a8\u91cd\u3002"
        }
      ]
    }))}`,
    toneFields: ["narrative", "events.0"]
  },
  {
    name: "examQuestion",
    schemaName: "examQuestion",
    raw: JSON.stringify({
      level: "child_exam",
      examName: "\u7ae5\u8bd5",
      examQuestion: "\u8bba\u53bf\u4ee4\u529d\u519c\u5e73\u8bbc\u4e4b\u8981",
      questionType: "\u7ecf\u4e49\u7b80\u7b54",
      difficulty: "\u5165\u95e8",
      requirements: ["\u4ee5\u7ecf\u4e49\u5165\u7b56", "\u4e0d\u5f97\u7528\u8fd1\u4ee3\u65b0\u8bed"],
      wordCount: { min: 200, max: 400 },
      passScore: 60,
      promotionRank: "\u79c0\u624d"
    }),
    toneFields: ["examQuestion", "requirements.0"]
  },
  {
    name: "grade",
    schemaName: "grade",
    raw: JSON.stringify(gradePayload(82)),
    toneFields: ["score.detailed_feedback", "score.content_quality.comment"]
  }
];

const UNSAFE_TURN_FIXTURES = [
  {
    name: "ordinary turn may not promote player role",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        player: {
          role: "official",
          officeTitle: "Grand Secretary"
        }
      }
    }))
  },
  {
    name: "ordinary turn may not patch calendar",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        year: 1645,
        month: 4
      }
    }))
  },
  {
    name: "ordinary turn may not patch relationship ledger directly",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        relationshipLedger: {
          factions: {
            eunuchs: { relationship: 100 }
          }
        }
      }
    }))
  },
  {
    name: "relationship suggestions must stay bounded",
    raw: JSON.stringify(baseTurn({
      relationshipChanges: [
        {
          targetType: "faction",
          targetId: "eunuchs",
          relationshipDelta: 30,
          resentmentDelta: -20,
          reason: "Too large."
        }
      ]
    }))
  }
];

const PATCH_SAFETY_FIXTURE = {
  name: "clamped turn patch",
  schemaName: "turn",
  raw: JSON.stringify(baseTurn({
    statePatch: {
      publicOrder: -30,
      treasury: 999999999,
      player: {
        academia: 999,
        gold: -5
      },
      factions: {
        eunuchs: 140,
        militaryLords: -40,
        inventedFaction: 77
      }
    }
  }))
};

const SERVER_OWNED_TURN_FIXTURES = [
  {
    name: "ordinary turn may not patch exam rank",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        player: {
          examRank: "\u79c0\u624d"
        }
      }
    }))
  },
  {
    name: "ordinary turn may not patch exam history",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        player: {
          examHistory: [{ level: "child_exam" }]
        }
      }
    }))
  },
  {
    name: "ordinary turn may not patch active exam",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        activeExam: {
          level: "child_exam",
          status: "writing"
        }
      }
    }))
  },
  {
    name: "ordinary turn may not patch characters",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        characters: [
          {
            id: "C99",
            name: "Invented official",
            role: "secret patron"
          }
        ]
      }
    }))
  },
  {
    name: "ordinary turn may not patch event history",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        eventHistory: ["provider tries to replace history"]
      }
    }))
  }
];

const INVALID_GRADE_FIXTURES = [
  {
    name: "overall score overflow",
    raw: JSON.stringify(gradePayload(101))
  },
  {
    name: "dimension score underflow",
    raw: JSON.stringify(gradePayload(80, {
      score: {
        ...gradePayload(80).score,
        content_quality: scoreDimension(-1)
      }
    }))
  }
];

const ESSAY_EVAL_FIXTURES = {
  historical: [
    "\u53bf\u6cbb\u4e4b\u8981\uff0c\u5148\u5728\u529d\u519c\u3002\u519c\u4e0d\u5931\u65f6\uff0c\u5219\u7cae\u8db3\uff1b\u7cae\u8db3\u5219\u6c11\u5b89\u3002",
    "\u53c8\u5f53\u5e73\u5176\u8bbc\uff0c\u4f7f\u91cc\u7532\u4e0d\u4ee5\u52bf\u538b\u5f31\uff0c\u540f\u80e5\u4e0d\u4ee5\u6587\u4e3a\u5978\u3002",
    "\u6545\u6559\u5316\u4e0e\u94b1\u8c37\u76f8\u8868\u91cc\uff0c\u5b88\u4ee4\u5f53\u656c\u6c11\u529b\u800c\u4e0d\u8f7b\u5f79\u4e4b\u3002"
  ].join(""),
  anachronistic: "AI ChatGPT stock market startup pitch",
  modernTone: "The official launches an AI startup, checks the stock market, and optimizes the county like a company."
};

const HISTORICAL_TONE = {
  anchors: [
    "\u671d",
    "\u53bf",
    "\u58eb",
    "\u6c11",
    "\u7cae",
    "\u594f",
    "\u7ecf",
    "\u540f",
    "\u79d1"
  ],
  forbiddenModern: [
    "AI",
    "ChatGPT",
    "startup",
    "stock market",
    "company",
    "\u4e92\u8054\u7f51",
    "\u624b\u673a",
    "\u516c\u53f8",
    "\u94f6\u884c",
    "\u80a1\u7968",
    "\u9009\u4e3e",
    "\u5baa\u6cd5"
  ]
};

module.exports = {
  ESSAY_EVAL_FIXTURES,
  HISTORICAL_TONE,
  INVALID_GRADE_FIXTURES,
  PATCH_SAFETY_FIXTURE,
  SERVER_OWNED_TURN_FIXTURES,
  UNSAFE_TURN_FIXTURES,
  VALID_OUTPUT_FIXTURES
};
