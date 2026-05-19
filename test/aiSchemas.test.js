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
    memoryProposals: [{
      actorId: "npc:C01",
      type: "favor",
      visibility: "player_visible",
      summary: "顾文衡记得玩家曾代修书卷。",
      salience: 72,
      confidence: 0.8,
      sourceType: "ai_memory_proposal",
      sourceRefs: [{ sourceView: "relationshipView", id: "C01", label: "顾文衡" }],
      tags: ["人情"]
    }],
    events: ["event"],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: ""
    }
  };

  assert.equal(validatePayload("turn", payload), payload);
});

test("S78 topicDraft schema accepts draft-only structured payloads", () => {
  const payload = {
    source: "provider-ai",
    surfaceId: "court-debate",
    draftKind: "balanced_debate",
    draftTitle: "折中议",
    draftText: "请召诸臣廷议，只就公开材料陈明利害，后果仍候主卷裁决。",
    evidenceRefs: ["eventArchiveView:event-1"],
    riskNote: "若证据不足，宜先交部议。",
    nextStep: "写入草稿后由玩家修改并呈上。"
  };

  assert.equal(validatePayload("topicDraft", payload), payload);
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

test("turn schema rejects private or overbroad memory proposals", () => {
  const base = {
    narrative: "A memory proposal happened.",
    statePatch: {},
    attributeChanges: [],
    events: [],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: ""
    }
  };

  for (const memoryProposals of [
    [{
      actorId: "npc:C01",
      type: "favor",
      visibility: "actor_private",
      summary: "private memory"
    }],
    [{
      actorId: "npc:C01",
      type: "secret_fact",
      visibility: "player_visible",
      summary: "bad type"
    }],
    [{
      actorId: "npc:C01",
      type: "favor",
      visibility: "player_visible",
      summary: "tries to write",
      statePatch: { actorMemoryLedger: {} }
    }]
  ]) {
    assert.throws(() => validatePayload("turn", { ...base, memoryProposals }), /schema validation/);
  }
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
    { actorMemoryLedger: { memoriesByActor: { "npc:C01": [{ summary: "模型记忆" }] } } },
    { sessionSummary: { monthlySummaries: [{ publicSummary: "模型摘要" }] } },
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

test("S75.9 quick action schema accepts draft-only suggestions", () => {
  const payload = {
    quickActionSuggestions: [
      {
        title: "温书",
        label: "温书",
        text: "温习经义，择一篇旧文重加点窜。",
        roleTags: ["scholar", "study"],
        toolIntent: "study",
        evidenceRefs: [],
        source: "mock-ai"
      },
      {
        title: "上疏",
        label: "上疏",
        text: "上疏陈明任内见闻，请朝廷裁量。",
        roleTags: ["official"],
        toolIntent: "memorial",
        evidenceRefs: ["event:public-1"],
        source: "provider-ai"
      }
    ]
  };

  assert.equal(validatePayload("quickAction", payload), payload);
});

test("S75.9 quick action schema rejects state writes and hidden/internal fields", () => {
  const baseSuggestion = {
    title: "温书",
    label: "温书",
    text: "温习经义，择一篇旧文重加点窜。",
    roleTags: ["scholar"],
    toolIntent: "study",
    evidenceRefs: [],
    source: "provider-ai"
  };

  for (const payload of [
    {
      quickActionSuggestions: [{
        ...baseSuggestion,
        statePatch: { player: { examRank: "秀才" } }
      }]
    },
    {
      quickActionSuggestions: [{
        ...baseSuggestion,
        hiddenIntent: "密档"
      }]
    },
    {
      quickActionSuggestions: [{
        ...baseSuggestion,
        source: "local-rule"
      }]
    },
    {
      quickActionSuggestions: [{
        ...baseSuggestion,
        toolIntent: "server.resolve_case"
      }]
    }
  ]) {
    assert.throws(() => validatePayload("quickAction", payload), /schema validation/);
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
