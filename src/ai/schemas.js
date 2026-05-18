const Ajv = require("ajv");
const { formatValidationErrors } = require("../utils/json");

const ajv = new Ajv({
  allErrors: true,
  strict: false
});

const stringArraySchema = {
  type: "array",
  items: { type: "string" },
  default: []
};

const scoreDimensionSchema = {
  type: "object",
  required: ["score", "comment"],
  additionalProperties: false,
  properties: {
    score: { type: "number", minimum: 0, maximum: 100 },
    comment: { type: "string" }
  }
};

const eventSchema = {
  type: "array",
  minItems: 0,
  maxItems: 5,
  items: { type: "string", minLength: 1 }
};

const examTriggerSchema = {
  type: "object",
  required: ["shouldStart", "level", "reason"],
  additionalProperties: false,
  properties: {
    shouldStart: { type: "boolean" },
    level: {
      anyOf: [
        { type: "string", enum: ["child_exam", "provincial_exam", "metropolitan_exam", "palace_exam"] },
        { type: "null" }
      ]
    },
    reason: { type: "string" }
  }
};

const relationshipChangeSchema = {
  type: "object",
  required: ["targetType", "targetId", "relationshipDelta", "resentmentDelta", "reason"],
  additionalProperties: false,
  properties: {
    targetType: { type: "string", enum: ["character", "faction"] },
    targetId: { type: "string", minLength: 1 },
    relationshipDelta: { type: "number", minimum: -12, maximum: 12 },
    resentmentDelta: { type: "number", minimum: -10, maximum: 10 },
    stance: { type: "string" },
    recentIntent: { type: "string" },
    note: { type: "string" },
    reason: { type: "string" }
  }
};

const relationshipChangesSchema = {
  type: "array",
  minItems: 0,
  maxItems: 5,
  items: relationshipChangeSchema,
  default: []
};

const teacherFeedbackProposalSchema = {
  type: "object",
  required: ["focus", "advice", "reason"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    focusKey: {
      type: "string",
      enum: [
        "classicsFoundation",
        "eightLeggedForm",
        "policyInsight",
        "historicalAllusion",
        "legalJudgment",
        "calligraphyCopying",
        "examEndurance"
      ]
    },
    focus: { type: "string" },
    advice: { type: "string" },
    reason: { type: "string" },
    teacherName: { type: "string" }
  }
};

const memorySourceRefSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    sourceView: { type: "string" },
    label: { type: "string" }
  }
};

const memoryProposalSchema = {
  type: "object",
  required: ["actorId", "type", "visibility", "summary"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    proposalId: { type: "string" },
    actorId: { type: "string", minLength: 1 },
    type: {
      type: "string",
      enum: [
        "fact",
        "impression",
        "favor",
        "grievance",
        "obligation",
        "exam_network",
        "reward_punishment",
        "official",
        "monthly_summary"
      ]
    },
    visibility: {
      type: "string",
      enum: ["public", "player_visible", "relationship_visible"]
    },
    subjectType: { type: "string" },
    subjectId: { type: "string" },
    summary: { type: "string", minLength: 1 },
    salience: { type: "number", minimum: 0, maximum: 100 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    sourceType: { type: "string" },
    sourceLabel: { type: "string" },
    sourceRefs: {
      type: "array",
      maxItems: 5,
      items: memorySourceRefSchema
    },
    tags: {
      type: "array",
      maxItems: 6,
      items: { type: "string" }
    }
  }
};

const memoryProposalsSchema = {
  type: "array",
  minItems: 0,
  maxItems: 6,
  items: memoryProposalSchema,
  default: []
};

const memoryProposalRejectionSchema = {
  type: "object",
  required: ["reason", "count"],
  additionalProperties: false,
  properties: {
    reason: {
      type: "string",
      enum: [
        "malformed_memory_proposal",
        "missing_actor",
        "invalid_memory_type",
        "invalid_memory_visibility",
        "private_or_hidden_memory_requires_redacted_api",
        "unsafe_or_empty_summary"
      ]
    },
    count: { type: "integer", minimum: 1, maximum: 6 }
  }
};

const memoryProposalRejectionsSchema = {
  type: "array",
  minItems: 0,
  maxItems: 6,
  items: memoryProposalRejectionSchema,
  default: []
};

const statePatchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    treasury: { type: "number" },
    grainReserve: { type: "number" },
    population: { type: "number" },
    publicOrder: { type: "number" },
    taxRate: { type: "number" },
    corruption: { type: "number" },
    armySize: { type: "number" },
    armyMorale: { type: "number" },
    borderThreat: { type: "number" },
    factions: {
      type: "object",
      additionalProperties: { type: "number" },
      properties: {
        eunuchs: { type: "number" },
        scholarOfficials: { type: "number" },
        militaryLords: { type: "number" }
      }
    },
    player: {
      type: "object",
      additionalProperties: false,
      properties: {
        health: { type: "number" },
        gold: { type: "number" },
        academia: { type: "number" },
        literaryTalent: { type: "number" },
        adaptability: { type: "number" },
        mentality: { type: "number" },
        reputation: { type: "number" },
        studiedBooks: stringArraySchema,
        connections: stringArraySchema,
        personalPower: { type: "number" },
        courtControl: { type: "number" },
        mandate: { type: "number" },
        faction: { type: "string" },
        influence: { type: "number" },
        integrity: { type: "number" },
        superiorFavor: { type: "number" },
        peerNetwork: { type: "number" },
        performanceMerit: { type: "number" },
        promotionProspect: { type: "number" },
        impeachmentRisk: { type: "number" },
        cleanReputation: { type: "number" },
        command: { type: "number" },
        troops: { type: "number" },
        supply: { type: "number" },
        battleReputation: { type: "number" },
        scouting: { type: "number" },
        campaignRisk: { type: "number" },
        countyName: { type: "string" },
        localTreasury: { type: "number" },
        localOrder: { type: "number" },
        gentryRelations: { type: "number" },
        banditPressure: { type: "number" },
        pendingLawsuits: { type: "number" },
        corveeBurden: { type: "number" },
        waterworks: { type: "number" }
      }
    }
  }
};

const attributeChangeSchema = {
  type: "object",
  required: ["path", "before", "after", "reason"],
  additionalProperties: true,
  properties: {
    path: { type: "string" },
    label: { type: "string" },
    before: {},
    after: {},
    reason: { type: "string" }
  }
};

const openingSchema = {
  type: "object",
  required: ["narrative", "events"],
  additionalProperties: false,
  properties: {
    narrative: { type: "string", minLength: 1 },
    events: eventSchema
  }
};

const turnSchema = {
  type: "object",
  required: ["narrative", "statePatch", "attributeChanges", "events", "examTrigger"],
  additionalProperties: false,
  properties: {
    narrative: { type: "string", minLength: 1 },
    statePatch: statePatchSchema,
    attributeChanges: {
      type: "array",
      items: attributeChangeSchema
    },
    relationshipChanges: relationshipChangesSchema,
    teacherFeedbackProposal: teacherFeedbackProposalSchema,
    memoryProposals: memoryProposalsSchema,
    memoryProposalRejections: memoryProposalRejectionsSchema,
    events: eventSchema,
    examTrigger: examTriggerSchema
  }
};

const quickActionSuggestionSchema = {
  type: "object",
  required: ["title", "label", "text", "roleTags", "toolIntent", "evidenceRefs", "source"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 16 },
    label: { type: "string", minLength: 1, maxLength: 16 },
    text: { type: "string", minLength: 1, maxLength: 120 },
    roleTags: {
      type: "array",
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 32 }
    },
    toolIntent: {
      type: "string",
      enum: ["study", "exam", "patrol", "case", "memorial", "march", "court", "travel", "office", "generic"]
    },
    evidenceRefs: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 120 }
    },
    source: { type: "string", enum: ["mock-ai", "provider-ai"] }
  }
};

const quickActionSchema = {
  type: "object",
  required: ["quickActionSuggestions"],
  additionalProperties: false,
  properties: {
    quickActionSuggestions: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: quickActionSuggestionSchema
    }
  }
};

const examQuestionSchema = {
  type: "object",
  required: [
    "level",
    "examName",
    "examQuestion",
    "questionType",
    "difficulty",
    "requirements",
    "wordCount",
    "passScore",
    "promotionRank"
  ],
  additionalProperties: false,
  properties: {
    level: { type: "string", enum: ["child_exam", "provincial_exam", "metropolitan_exam", "palace_exam"] },
    examName: { type: "string" },
    examQuestion: { type: "string", minLength: 1 },
    questionType: { type: "string" },
    difficulty: { type: "string" },
    requirements: stringArraySchema,
    wordCount: {
      type: "object",
      required: ["min", "max"],
      additionalProperties: false,
      properties: {
        min: { type: "number" },
        max: { type: "number" }
      }
    },
    passScore: { type: "number" },
    promotionRank: { type: "string" }
  }
};

const authenticitySchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    copy_detection: {
      type: "object",
      additionalProperties: true,
      properties: {
        is_copy: { type: "boolean" },
        similar_passage: { type: "string" }
      }
    },
    anachronism_detection: {
      type: "object",
      additionalProperties: true,
      properties: {
        has_anachronism: { type: "boolean" },
        details: stringArraySchema
      }
    },
    style_consistency: {
      type: "object",
      additionalProperties: true,
      properties: {
        consistent: { type: "boolean" },
        note: { type: "string" }
      }
    },
    ghostwriting_probability: { type: "number" }
  }
};

const gradeSchema = {
  type: "object",
  required: ["score", "authenticity_check", "virtual_candidates", "ranking"],
  additionalProperties: false,
  properties: {
    score: {
      type: "object",
      required: [
        "content_quality",
        "argument_strength",
        "literary_style",
        "classical_format",
        "historical_appropriateness",
        "overall_score",
        "rank",
        "detailed_feedback"
      ],
      additionalProperties: false,
      properties: {
        content_quality: scoreDimensionSchema,
        argument_strength: scoreDimensionSchema,
        literary_style: scoreDimensionSchema,
        classical_format: scoreDimensionSchema,
        historical_appropriateness: scoreDimensionSchema,
        overall_score: { type: "number", minimum: 0, maximum: 100 },
        rank: { type: "string" },
        detailed_feedback: { type: "string" }
      }
    },
    authenticity_check: authenticitySchema,
    virtual_candidates: { type: "array", items: { type: "object", additionalProperties: true } },
    ranking: { type: "array", items: { type: "object", additionalProperties: true } },
    examiner_reviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          actor: { type: "string" },
          label: { type: "string" },
          recommendation: { type: "string" },
          suggestedScoreDelta: { type: "number", minimum: -2, maximum: 2 },
          comment: { type: "string" },
          concern: { type: "string" }
        }
      }
    }
  }
};

const SCHEMAS = {
  opening: openingSchema,
  turn: turnSchema,
  quickAction: quickActionSchema,
  examQuestion: examQuestionSchema,
  grade: gradeSchema
};

const modelEventSchema = {
  type: "array",
  items: { type: "string" }
};

const modelScoreDimensionSchema = {
  type: "object",
  required: ["score", "comment"],
  additionalProperties: false,
  properties: {
    score: { type: "number" },
    comment: { type: "string" }
  }
};

const modelOpeningSchema = {
  type: "object",
  required: ["narrative", "events"],
  additionalProperties: false,
  properties: {
    narrative: { type: "string" },
    events: modelEventSchema
  }
};

const modelExamTriggerSchema = {
  type: "object",
  required: ["shouldStart", "level", "reason"],
  additionalProperties: false,
  properties: {
    shouldStart: { type: "boolean" },
    level: {
      anyOf: [
        { type: "string" },
        { type: "null" }
      ]
    },
    reason: { type: "string" }
  }
};

const modelRelationshipChangeSchema = {
  type: "object",
  required: ["targetType", "targetId", "relationshipDelta", "resentmentDelta", "reason"],
  additionalProperties: false,
  properties: {
    targetType: { type: "string" },
    targetId: { type: "string" },
    relationshipDelta: { type: "number" },
    resentmentDelta: { type: "number" },
    stance: { type: "string" },
    recentIntent: { type: "string" },
    note: { type: "string" },
    reason: { type: "string" }
  }
};

const modelTeacherFeedbackProposalSchema = {
  type: "object",
  required: ["focus", "advice", "reason"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    focusKey: { type: "string" },
    focus: { type: "string" },
    advice: { type: "string" },
    reason: { type: "string" },
    teacherName: { type: "string" }
  }
};

const modelMemorySourceRefSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    sourceView: { type: "string" },
    label: { type: "string" }
  }
};

const modelMemoryProposalSchema = {
  type: "object",
  required: ["actorId", "type", "summary"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    proposalId: { type: "string" },
    actorId: { type: "string" },
    type: { type: "string" },
    visibility: { type: "string" },
    subjectType: { type: "string" },
    subjectId: { type: "string" },
    summary: { type: "string" },
    salience: { type: "number" },
    confidence: { type: "number" },
    sourceType: { type: "string" },
    sourceLabel: { type: "string" },
    sourceRefs: {
      type: "array",
      items: modelMemorySourceRefSchema
    },
    tags: {
      type: "array",
      items: { type: "string" }
    }
  }
};

const modelExamQuestionSchema = {
  type: "object",
  required: [
    "level",
    "examName",
    "examQuestion",
    "questionType",
    "difficulty",
    "requirements",
    "wordCount",
    "passScore",
    "promotionRank"
  ],
  additionalProperties: false,
  properties: {
    level: { type: "string" },
    examName: { type: "string" },
    examQuestion: { type: "string" },
    questionType: { type: "string" },
    difficulty: { type: "string" },
    requirements: modelEventSchema,
    wordCount: {
      type: "object",
      required: ["min", "max"],
      additionalProperties: false,
      properties: {
        min: { type: "number" },
        max: { type: "number" }
      }
    },
    passScore: { type: "number" },
    promotionRank: { type: "string" }
  }
};

const modelGradeSchema = {
  type: "object",
  required: ["score", "authenticity_check", "virtual_candidates", "ranking"],
  additionalProperties: false,
  properties: {
    score: {
      type: "object",
      required: [
        "content_quality",
        "argument_strength",
        "literary_style",
        "classical_format",
        "historical_appropriateness",
        "overall_score",
        "rank",
        "detailed_feedback"
      ],
      additionalProperties: false,
      properties: {
        content_quality: modelScoreDimensionSchema,
        argument_strength: modelScoreDimensionSchema,
        literary_style: modelScoreDimensionSchema,
        classical_format: modelScoreDimensionSchema,
        historical_appropriateness: modelScoreDimensionSchema,
        overall_score: { type: "number" },
        rank: { type: "string" },
        detailed_feedback: { type: "string" }
      }
    },
    authenticity_check: { type: "object", additionalProperties: true },
    virtual_candidates: { type: "array", items: { type: "object", additionalProperties: true } },
    ranking: { type: "array", items: { type: "object", additionalProperties: true } },
    examiner_reviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          actor: { type: "string" },
          label: { type: "string" },
          recommendation: { type: "string" },
          suggestedScoreDelta: { type: "number" },
          comment: { type: "string" },
          concern: { type: "string" }
        }
      }
    }
  }
};

const MODEL_SCHEMAS = {
  opening: modelOpeningSchema,
  turn: {
    type: "object",
    required: ["narrative", "statePatch", "attributeChanges", "events", "examTrigger"],
    additionalProperties: false,
    properties: {
      narrative: { type: "string" },
      statePatch: { type: "object", additionalProperties: true },
      attributeChanges: { type: "array", items: { type: "object", additionalProperties: true } },
      relationshipChanges: {
        type: "array",
        items: modelRelationshipChangeSchema
      },
      teacherFeedbackProposal: modelTeacherFeedbackProposalSchema,
      memoryProposals: {
        type: "array",
        items: modelMemoryProposalSchema
      },
      events: modelEventSchema,
      examTrigger: modelExamTriggerSchema
    }
  },
  quickAction: quickActionSchema,
  examQuestion: modelExamQuestionSchema,
  grade: modelGradeSchema
};

const validators = Object.fromEntries(
  Object.entries(SCHEMAS).map(([name, schema]) => [name, ajv.compile(schema)])
);

function getSchema(name) {
  const schema = SCHEMAS[name];
  if (!schema) {
    throw new Error(`Unknown AI schema: ${name}`);
  }
  return schema;
}

function getModelSchema(name) {
  const schema = MODEL_SCHEMAS[name];
  if (!schema) {
    throw new Error(`Unknown AI model schema: ${name}`);
  }
  return schema;
}

function validatePayload(name, payload) {
  const validate = validators[name];
  if (!validate) {
    throw new Error(`Unknown AI schema validator: ${name}`);
  }
  if (!validate(payload)) {
    throw new Error(`AI ${name} JSON failed schema validation: ${formatValidationErrors(validate.errors)}`);
  }
  return payload;
}

module.exports = {
  SCHEMAS,
  getModelSchema,
  getSchema,
  validatePayload
};
