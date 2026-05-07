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
    raw: JSON.stringify(baseTurn({
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
    })),
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

const PROMPT_PACK_OUTPUT_FIXTURES = [
  {
    name: "world_turn scholar study",
    promptPack: "world_turn",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      narrative: "\u53bf\u5b66\u8bf8\u751f\u95fb\u4f60\u6e05\u6668\u8bfb\u300a\u5b5f\u5b50\u300b\uff0c\u658b\u957f\u4ee5\u7cae\u4ef7\u95ee\u4f60\u4ec1\u653f\u4e4b\u4e49\u3002",
      statePatch: {
        player: {
          academia: 18,
          mentality: 14
        }
      },
      events: ["\u53bf\u5b66\u8bfb\u7ecf\uff0c\u58eb\u53cb\u8bb0\u5176\u8bba\u7cae\u4e4b\u8bed\u3002"]
    })),
    toneFields: ["narrative", "events.0"]
  },
  {
    name: "official_career assessment",
    promptPack: "official_career",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      narrative: "\u540f\u90e8\u6587\u79fb\u5230\u7f72\uff0c\u4e0a\u5b98\u547d\u4f60\u590d\u6838\u94b1\u7cae\u518c\u3002\u540c\u5e74\u6765\u4fe1\u76f8\u529d\uff0c\u52ff\u4ee5\u79c1\u60c5\u4e71\u516c\u724d\u3002",
      statePatch: {
        player: {
          performanceMerit: 47,
          cleanReputation: 63,
          impeachmentRisk: 18
        }
      },
      events: ["\u7f72\u4e2d\u590d\u6838\u94b1\u7cae\uff0c\u540f\u76ee\u4e0d\u6562\u8f7b\u6539\u6587\u518c\u3002"]
    })),
    toneFields: ["narrative", "events.0"]
  },
  {
    name: "emperor_court relief edict",
    promptPack: "emperor_court",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      narrative: "\u5fa1\u524d\u8bf8\u81e3\u594f\u95fb\u707e\u53bf\u7cae\u4ef7\u9aa4\u8d77\uff0c\u4f60\u4ee4\u6237\u90e8\u6838\u53d1\u4ed3\u7cae\uff0c\u8a00\u5b98\u4ecd\u8bf7\u67e5\u8d48\u94f6\u53bb\u5904\u3002",
      statePatch: {
        treasury: 920,
        grainReserve: 760,
        publicOrder: 73,
        player: {
          mandate: 42,
          courtControl: 31
        }
      },
      events: ["\u671d\u4e2d\u8bae\u8d48\uff0c\u6237\u90e8\u5f00\u4ed3\u800c\u8a00\u5b98\u8bf7\u6838\u3002"]
    })),
    toneFields: ["narrative", "events.0"]
  },
  {
    name: "minister_faction memorial",
    promptPack: "minister_faction",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      narrative: "\u90fd\u5bdf\u9662\u524d\u594f\u724d\u521d\u6210\uff0c\u4f60\u4ee5\u94b1\u7cae\u4e8f\u7a7a\u4e3a\u8a00\uff0c\u540f\u90e8\u540c\u50da\u4e00\u9762\u79f0\u5584\uff0c\u4e00\u9762\u6015\u7275\u51fa\u65e7\u6848\u3002",
      statePatch: {
        player: {
          influence: 44,
          integrity: 71
        }
      },
      events: ["\u594f\u724d\u5165\u9601\uff0c\u90fd\u5bdf\u9662\u4e0e\u540f\u90e8\u7686\u6709\u8bae\u8bba\u3002"]
    })),
    toneFields: ["narrative", "events.0"]
  },
  {
    name: "local_magistrate lawsuit",
    promptPack: "local_magistrate",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      narrative: "\u53bf\u8859\u5347\u5802\uff0c\u4e24\u9020\u56e0\u7530\u754c\u4e89\u8bbc\u3002\u4f60\u547d\u4e66\u540f\u53d6\u9c7c\u9cde\u518c\u6838\u5bf9\uff0c\u53c8\u8bf7\u91cc\u7532\u8006\u8001\u4f5c\u8bc1\u3002",
      statePatch: {
        player: {
          localOrder: 58,
          pendingLawsuits: 9,
          gentryRelations: 47
        }
      },
      events: ["\u53bf\u8859\u5e73\u8bbc\uff0c\u6c11\u95f4\u77e5\u5951\u518c\u4e0d\u53ef\u8f7b\u6539\u3002"]
    })),
    toneFields: ["narrative", "events.0"]
  },
  {
    name: "general_frontier scouting",
    promptPack: "general_frontier",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      narrative: "\u8fb9\u5899\u591c\u706b\u672a\u606f\uff0c\u4f60\u9063\u54e8\u9a91\u6cbf\u65e7\u5821\u63a2\u62a5\uff0c\u53c8\u547d\u7cae\u8f66\u540e\u884c\uff0c\u4ee5\u514d\u519b\u4e2d\u8f7b\u8fdb\u3002",
      statePatch: {
        borderThreat: 36,
        armyMorale: 61,
        player: {
          scouting: 54,
          campaignRisk: 29
        }
      },
      events: ["\u8fb9\u5899\u9063\u54e8\uff0c\u519b\u4e2d\u7cae\u8f66\u7f13\u884c\u4ee5\u7a33\u4f17\u5fc3\u3002"]
    })),
    toneFields: ["narrative", "events.0"]
  },
  {
    name: "exam_question provincial policy",
    promptPack: "exam_question",
    schemaName: "examQuestion",
    raw: JSON.stringify({
      level: "provincial_exam",
      examName: "\u4e61\u8bd5",
      examQuestion: "\u707e\u53bf\u7cae\u8d35\uff0c\u8bd5\u8bba\u5e38\u5e73\u4ed3\u3001\u529d\u519c\u4e0e\u5e73\u8bbc\u4e09\u4e8b\u4f55\u8005\u5b9c\u5148\u3002",
      questionType: "\u7b56\u8bba",
      difficulty: "\u4e2d\u7b49",
      requirements: ["\u4ee5\u6c11\u98df\u4e3a\u672c", "\u4e0d\u5f97\u7528\u8fd1\u4ee3\u65b0\u8bed"],
      wordCount: { min: 500, max: 800 },
      passScore: 70,
      promotionRank: "\u4e3e\u4eba"
    }),
    toneFields: ["examQuestion", "requirements.0"]
  },
  {
    name: "exam_grading fair examiner",
    promptPack: "exam_grading",
    schemaName: "grade",
    raw: JSON.stringify(gradePayload(84, {
      score: {
        ...gradePayload(84).score,
        detailed_feedback: "\u6b64\u5377\u80fd\u4ee5\u7cae\u653f\u3001\u53bf\u6cbb\u4e0e\u6559\u5316\u76f8\u8fde\uff0c\u8bba\u65ad\u5c1a\u6709\u6839\u636e\uff0c\u60df\u627f\u8f6c\u5c1a\u5b9c\u66f4\u7d27\u3002"
      },
      virtual_candidates: [],
      ranking: []
    })),
    toneFields: ["score.detailed_feedback", "score.content_quality.comment"]
  },
  {
    name: "opening county school",
    promptPack: "opening",
    schemaName: "opening",
    raw: JSON.stringify({
      narrative: "\u5d07\u796f\u5341\u4e03\u5e74\uff0c\u53bf\u5b66\u524d\u96e8\u58f0\u5165\u781a\uff0c\u4e61\u91cc\u7cae\u4ef7\u4e0e\u7ae5\u8bd5\u4e4b\u671f\u4e00\u5e76\u538b\u5230\u4f60\u6848\u5934\u3002",
      events: ["\u53bf\u5b66\u542f\u7a0b\uff0c\u58eb\u5b50\u95ee\u7ecf\u800c\u95fb\u7cae\u4ef7\u3002"]
    }),
    toneFields: ["narrative", "events.0"]
  }
];

const STRICT_JSON_FIXTURES = {
  valid: [
    {
      name: "opening strict object",
      schemaName: "opening",
      raw: JSON.stringify({
        narrative: "\u53bf\u5b66\u5f00\u8bb2\uff0c\u8bf8\u751f\u95ee\u7ecf\u800c\u95fb\u7cae\u4ef7\u3002",
        events: ["\u53bf\u5b66\u8bb0\u4e00\u65e5\u8bfb\u7ecf\u3002"]
      })
    }
  ],
  invalid: [
    {
      name: "markdown wrapped JSON",
      raw: "```json\n{\"narrative\":\"\u53bf\u5b66\u8bfb\u7ecf\",\"events\":[\"\u53bf\u5b66\u8bb0\u4e8b\"]}\n```"
    },
    {
      name: "prose before JSON",
      raw: "Here is the JSON: {\"narrative\":\"\u53bf\u5b66\u8bfb\u7ecf\",\"events\":[\"\u53bf\u5b66\u8bb0\u4e8b\"]}"
    },
    {
      name: "model output prefix",
      raw: "model output:\n{\"narrative\":\"\u53bf\u5b66\u8bfb\u7ecf\",\"events\":[\"\u53bf\u5b66\u8bb0\u4e8b\"]}"
    },
    {
      name: "trailing commentary",
      raw: "{\"narrative\":\"\u53bf\u5b66\u8bfb\u7ecf\",\"events\":[\"\u53bf\u5b66\u8bb0\u4e8b\"]}\nThis is ready."
    },
    {
      name: "array root",
      raw: "[{\"narrative\":\"\u53bf\u5b66\u8bfb\u7ecf\"}]"
    }
  ]
};

const PROMPT_PACK_TONE_RED_TEAM_FIXTURES = [
  {
    name: "turn modern startup tone",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      narrative: "The county officer launches an AI startup, watches the stock market, and optimizes the yamen like a company.",
      events: ["AI startup company stock market plan."]
    })),
    toneFields: ["narrative", "events.0"]
  },
  {
    name: "exam question modern policy frame",
    schemaName: "examQuestion",
    raw: JSON.stringify({
      level: "palace_exam",
      examName: "\u6bbf\u8bd5",
      examQuestion: "Design an AI company policy for stock market growth and constitutional elections.",
      questionType: "\u65f6\u653f\u7b56\u8bba",
      difficulty: "\u9ad8",
      requirements: ["Use startup metrics and internet strategy."],
      wordCount: { min: 800, max: 1500 },
      passScore: 75,
      promotionRank: "\u8fdb\u58eb"
    }),
    toneFields: ["examQuestion", "requirements.0"]
  },
  {
    name: "turn management jargon tone",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      narrative: "\u53bf\u4ee4\u628a\u8d48\u707e\u505a\u6210 KPI \u9879\u76ee\uff0c\u7528 dashboard \u4f18\u5316\u7528\u6237\u4f53\u9a8c\u548c workflow\u3002",
      events: ["KPI dashboard workflow \u8d48\u707e\u5e73\u53f0\u3002"]
    })),
    toneFields: ["narrative", "events.0"]
  }
];

const PROMPT_PACK_HIDDEN_LEAK_FIXTURES = [
  {
    name: "turn leaks hidden contact and target id",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      narrative: "\u53bf\u5b66\u5916\u4f20\u6765 Secret Eunuch \u7684 sealed dossier\uff0c\u5176\u5b9e\u6b32\u5bc6\u8c0b\u5f39\u52be\u3002",
      relationshipChanges: [
        {
          targetType: "character",
          targetId: "C99-hidden",
          relationshipDelta: 1,
          resentmentDelta: 0,
          reason: "Leaked hidden target."
        }
      ],
      events: ["Secret Eunuch C99-hidden sealed dossier leaked."]
    })),
    hiddenTerms: ["Secret Eunuch", "C99-hidden", "sealed dossier", "\u5bc6\u8c0b\u5f39\u52be"]
  }
];

const PROMPT_PACK_AUTHORITY_RED_TEAM_FIXTURES = [
  {
    name: "exam question may not include state patch",
    schemaName: "examQuestion",
    raw: JSON.stringify({
      level: "child_exam",
      examName: "\u7ae5\u8bd5",
      examQuestion: "\u8bba\u53bf\u5b66\u8bfb\u7ecf\u4e4b\u8981",
      questionType: "\u7ecf\u4e49\u7b80\u7b54",
      difficulty: "\u5165\u95e8",
      requirements: ["\u4ee5\u7ecf\u4e49\u7b54\u95ee"],
      wordCount: { min: 200, max: 400 },
      passScore: 60,
      promotionRank: "\u79c0\u624d",
      statePatch: {
        player: { examRank: "\u79c0\u624d" }
      }
    }),
    expected: "schemaReject"
  },
  {
    name: "exam grading may not invent canonical ranking",
    schemaName: "grade",
    raw: JSON.stringify(gradePayload(88, {
      virtual_candidates: [{ name: "\u5f20\u7532", score: 91 }],
      ranking: [{ name: "\u5f20\u7532", score: 91 }]
    })),
    expected: "nonEmptyServerRanking"
  },
  {
    name: "ordinary turn may not patch official career ledger",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        officialCareer: {
          pendingOutcome: { type: "promotion" }
        }
      }
    })),
    expected: "schemaReject"
  },
  {
    name: "ordinary turn may not patch active request ledger",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        activeNpcRequest: {
          targetId: "C01",
          status: "accepted"
        }
      }
    })),
    expected: "schemaReject"
  },
  {
    name: "ordinary turn may not patch long-term event queue",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        longTermEvents: {
          queue: [{ type: "provider-created" }]
        }
      }
    })),
    expected: "schemaReject"
  },
  {
    name: "ordinary turn may not patch world thread ledger",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        worldThreads: {
          threads: [{ id: "WT-provider-forged", title: "\u4f2a\u8bae\u9898" }]
        }
      }
    })),
    expected: "schemaReject"
  },
  {
    name: "ordinary turn may not patch world entity ledger",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        worldEntities: {
          entities: [{ id: "provider-forged-entity", name: "\u4f2a\u5b9e\u4f53" }]
        }
      }
    })),
    expected: "schemaReject"
  },
  {
    name: "ordinary turn may not patch exam calendar",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        examCalendar: {
          missedWindows: []
        }
      }
    })),
    expected: "schemaReject"
  },
  {
    name: "ordinary turn may not grant palace rank",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        player: {
          palaceRank: "\u4e00\u7532\u7b2c\u4e00\u540d"
        }
      }
    })),
    expected: "schemaReject"
  }
];

const S44_MIXED_AUTHORITY_RED_TEAM_FIXTURES = [
  {
    name: "ordinary turn mixed overreach bundle",
    schemaName: "turn",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        publicOrder: 66,
        activeExam: { level: "palace_exam", status: "writing" },
        examCalendar: { rivals: [{ id: "provider-rival" }] },
        activeNpcRequest: { id: "provider-request" },
        longTermEvents: { queue: [{ id: "provider-event" }] },
        officialCareer: { careerHistory: [{ type: "promotion", label: "伪升迁" }] },
        roleWorldCoupling: { recentImpacts: [{ kind: "provider-forged" }] },
        worldEntities: { entities: [{ id: "provider-forged-entity", name: "伪实体" }] },
        worldThreads: { threads: [{ id: "WT-provider-forged", title: "伪议题" }] },
        characters: [{ id: "C99", name: "暗线贵人", role: "secret patron" }],
        eventHistory: ["provider replacement"],
        turnCount: 99,
        year: 1700,
        month: 12,
        tenDayPeriod: 3,
        player: {
          academia: 20,
          role: "official",
          examRank: "进士",
          officeTitle: "内阁大学士",
          examHistory: [{ level: "palace_exam" }]
        }
      },
      relationshipChanges: [
        {
          targetType: "character",
          targetId: "C99-hidden",
          relationshipDelta: 20,
          resentmentDelta: -20,
          reason: "Hidden target overreach."
        }
      ],
      examTrigger: {
        shouldStart: true,
        level: "palace_exam",
        reason: "Skip the ladder."
      }
    })),
    expected: "schemaReject"
  },
  {
    name: "opening may not include hidden state",
    schemaName: "opening",
    raw: JSON.stringify({
      narrative: "县学开讲，诸生问经。",
      events: ["县学记事。"],
      statePatch: {
        player: { role: "emperor" },
        providerConfig: { apiKey: "sk-hidden" }
      }
    }),
    expected: "schemaReject"
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
        month: 4,
        tenDayPeriod: 2,
        turnCount: 99
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
  },
  {
    name: "ordinary turn may not patch role-world coupling",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        roleWorldCoupling: {
          recentImpacts: [{ kind: "provider-forged" }]
        }
      }
    }))
  },
  {
    name: "ordinary turn may not patch world threads",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        worldThreads: {
          threads: [{ id: "WT-provider-forged", title: "\u4f2a\u8bae\u9898" }]
        }
      }
    }))
  },
  {
    name: "ordinary turn may not patch world entities",
    raw: JSON.stringify(baseTurn({
      statePatch: {
        worldEntities: {
          entities: [{ id: "provider-forged-entity", name: "\u4f2a\u5b9e\u4f53" }]
        }
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
    "\u5baa\u6cd5",
    "KPI",
    "OKR",
    "dashboard",
    "workflow",
    "\u7528\u6237\u4f53\u9a8c",
    "\u6570\u636e\u5206\u6790",
    "\u5e73\u53f0",
    "\u73b0\u4ee3\u5316\u6cbb\u7406"
  ]
};

module.exports = {
  ESSAY_EVAL_FIXTURES,
  HISTORICAL_TONE,
  INVALID_GRADE_FIXTURES,
  PATCH_SAFETY_FIXTURE,
  PROMPT_PACK_AUTHORITY_RED_TEAM_FIXTURES,
  PROMPT_PACK_HIDDEN_LEAK_FIXTURES,
  PROMPT_PACK_OUTPUT_FIXTURES,
  PROMPT_PACK_TONE_RED_TEAM_FIXTURES,
  S44_MIXED_AUTHORITY_RED_TEAM_FIXTURES,
  SERVER_OWNED_TURN_FIXTURES,
  STRICT_JSON_FIXTURES,
  UNSAFE_TURN_FIXTURES,
  VALID_OUTPUT_FIXTURES
};
