const { assemblePromptContext } = require("./promptContextAssembler");
const {
  buildPromptInstructions,
  getTurnPromptPackName
} = require("./promptPacks");
const { buildEventArchiveIndexItems } = require("../game/eventArchive");
const { summarizeExamProcedureForPrompt } = require("../game/examProcedure");
const { formatYearMonthPeriod } = require("../game/time");

const MAX_PROMPT_RECENT_EVENTS = 6;

function compactPlayer(player = {}) {
  return {
    role: player.role,
    roleLabel: player.roleLabel,
    name: player.name,
    health: player.health,
    gold: player.gold,
    examRank: player.examRank,
    palaceRank: player.palaceRank,
    officeTitle: player.officeTitle,
    academia: player.academia,
    literaryTalent: player.literaryTalent,
    adaptability: player.adaptability,
    mentality: player.mentality,
    reputation: player.reputation,
    studiedBooks: player.studiedBooks || [],
    connections: player.connections || [],
    personalPower: player.personalPower,
    courtControl: player.courtControl,
    mandate: player.mandate,
    position: player.position,
    faction: player.faction,
    influence: player.influence,
    integrity: player.integrity,
    superiorFavor: player.superiorFavor,
    peerNetwork: player.peerNetwork,
    performanceMerit: player.performanceMerit,
    promotionProspect: player.promotionProspect,
    impeachmentRisk: player.impeachmentRisk,
    cleanReputation: player.cleanReputation,
    command: player.command,
    troops: player.troops,
    supply: player.supply,
    battleReputation: player.battleReputation,
    scouting: player.scouting,
    campaignRisk: player.campaignRisk,
    countyName: player.countyName,
    localTreasury: player.localTreasury,
    localOrder: player.localOrder,
    gentryRelations: player.gentryRelations,
    banditPressure: player.banditPressure,
    pendingLawsuits: player.pendingLawsuits,
    corveeBurden: player.corveeBurden,
    waterworks: player.waterworks
  };
}

function compactExam(activeExam) {
  if (!activeExam) return null;
  return {
    level: activeExam.level,
    examName: activeExam.examName,
    questionType: activeExam.questionType,
    status: activeExam.status,
    reason: activeExam.reason,
    procedure: summarizeExamProcedureForPrompt({ activeExam }),
    readiness: activeExam.readiness || null
  };
}

function compactRecentEvents(worldState = {}) {
  return buildEventArchiveIndexItems(worldState)
    .filter((item) => item.sourceType === "event_history")
    .slice(0, MAX_PROMPT_RECENT_EVENTS)
    .map((item) => ({
      sourceView: "eventArchiveView",
      id: item.id,
      title: item.title,
      summary: item.summary,
      status: item.status,
      dateLabel: item.dateLabel,
      turn: item.turn
    }));
}

function compactQuickActionContext(context = {}) {
  return {
    page: context.page || "game",
    requestedCount: context.requestedCount || 3,
    draftPreview: context.draftPreview || "",
    player: context.player || {},
    date: context.date || {},
    routeViewFlags: context.routeViewFlags || {},
    toolCapabilities: Array.isArray(context.toolCapabilities) ? context.toolCapabilities : [],
    evidenceRefs: Array.isArray(context.evidenceRefs) ? context.evidenceRefs : [],
    safety: {
      draftOnly: true,
      noStateWrites: true,
      noToolExecution: true,
      citeSuppliedEvidenceOnly: true
    }
  };
}

function compactTopicDraftContext(context = {}) {
  return {
    surfaceId: context.surfaceId,
    surfaceType: context.surfaceType,
    surfaceTitle: context.surfaceTitle,
    draftKind: context.draftKind,
    draftLabel: context.draftLabel,
    draftTemplate: context.draftTemplate,
    playerNote: context.playerNote || "",
    player: context.player || {},
    selectedEvidenceRefs: Array.isArray(context.selectedEvidenceRefs) ? context.selectedEvidenceRefs : [],
    evidenceRefs: Array.isArray(context.evidenceRefs) ? context.evidenceRefs : [],
    allowedDraftKinds: Array.isArray(context.allowedDraftKinds) ? context.allowedDraftKinds : [],
    safety: {
      draftOnly: true,
      noStateWrites: true,
      noToolExecution: true,
      noResolverExecution: true,
      citeSuppliedEvidenceOnly: true
    }
  };
}

function compactBackgroundClaimContext(context = {}) {
  const form = context.startForm || {};
  return {
    player: {
      role: form.role,
      roleLabel: form.roleLabel,
      name: form.playerName,
      familyBackground: form.familyBackground,
      nativePlace: form.nativePlace
    },
    dynasty: form.dynasty,
    year: form.year,
    publicBackground: context.publicBackground || "",
    customSetting: context.customSetting || "",
    safety: {
      claimsOnly: true,
      serverAdjudicates: true,
      noStateWrites: true,
      noRankOrOfficeGrant: true,
      doNotEchoRawBackground: true
    }
  };
}

function compactNpcDialogueContext(context = {}) {
  return {
    npcId: context.npcId,
    interactionType: context.interactionType || context.actionType || "talk",
    playerUtterance: context.playerUtterance || "",
    player: context.player || {
      role: context.playerRole,
      name: context.playerName
    },
    npcDetailView: context.npcDetailView || {},
    relationshipSummary: context.relationshipSummary || {},
    privateSignalTags: Array.isArray(context.privateSignalTags) ? context.privateSignalTags.slice(0, 6) : [],
    safety: {
      dialogueOnly: true,
      serverAdjudicatesConsequences: true,
      noInventoryTransfer: true,
      noHiddenDossierDisclosure: true
    }
  };
}

function compactTradeNegotiationContext(context = {}) {
  return {
    tradeId: context.tradeId,
    action: context.action || "propose",
    playerOffer: context.playerOffer || {
      offerSummary: context.offerSummary || "",
      requestedSilverDelta: context.requestedSilverDelta || 0,
      requestedItemRefs: Array.isArray(context.requestedItemRefs) ? context.requestedItemRefs.slice(0, 8) : []
    },
    npcCounterparty: context.npcCounterparty || {
      npcId: context.npcId,
      npcName: context.npcName
    },
    visiblePriceBounds: context.visiblePriceBounds || {},
    relationshipSummary: context.relationshipSummary || {},
    serverBoundaries: Array.isArray(context.serverBoundaries) ? context.serverBoundaries.slice(0, 4) : [],
    safety: {
      proposalOnly: true,
      serverValidatesPriceInventoryLegality: true,
      noResourceDeduction: true,
      noOwnershipTransfer: true
    }
  };
}

function compactDelegatedTaskContext(context = {}) {
  return {
    taskType: context.taskType || "generic",
    commandText: context.commandText || "",
    issuer: context.issuer || { actorId: "player" },
    assignee: context.assignee || context.npcDetailView || { npcId: context.npcId },
    targetRef: context.targetRef || "",
    visibleResources: context.visibleResources || {
      budget: context.budget || 0
    },
    visibleRisks: Array.isArray(context.visibleRisks) ? context.visibleRisks.slice(0, 8) : [],
    serverBoundaries: Array.isArray(context.serverBoundaries) ? context.serverBoundaries.slice(0, 4) : [],
    safety: {
      proposalOnly: true,
      serverValidatesAuthorityResourcesTime: true,
      noTaskResultDecision: true
    }
  };
}

function compactDelegatedTaskReportContext(context = {}) {
  return {
    taskId: context.taskId,
    taskType: context.taskType,
    assignee: context.assignee || {},
    adjudicatedResult: context.adjudicatedResult || {},
    publicOutcomeSummary: context.publicOutcomeSummary || "",
    safety: {
      reportAfterServerResult: true,
      noResultOverride: true,
      noHiddenFactExpansion: true
    }
  };
}

function compactInventoryEffectContext(context = {}) {
  return {
    itemId: context.itemId,
    itemView: context.itemView || {},
    player: context.player || {},
    visibleUseContext: context.visibleUseContext || "",
    safety: {
      explanationOnly: true,
      noActivation: true,
      noTransfer: true,
      noStateWrites: true
    }
  };
}

function compactWorldState(worldState = {}, options = {}) {
  return {
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod,
    dateLabel: formatYearMonthPeriod(worldState),
    dynasty: worldState.dynasty,
    turnCount: worldState.turnCount,
    treasury: worldState.treasury,
    grainReserve: worldState.grainReserve,
    population: worldState.population,
    publicOrder: worldState.publicOrder,
    taxRate: worldState.taxRate,
    corruption: worldState.corruption,
    armySize: worldState.armySize,
    armyMorale: worldState.armyMorale,
    borderThreat: worldState.borderThreat,
    factions: worldState.factions,
    ...assemblePromptContext(worldState, options),
    activeExam: compactExam(worldState.activeExam),
    recentEvents: compactRecentEvents(worldState),
    setup: worldState.setup || {},
    player: compactPlayer(worldState.player)
  };
}

function buildBackgroundClaimParserTask(context = {}) {
  return {
    promptPack: "background_claim_parser",
    schemaName: "backgroundClaimParser",
    instructions: buildPromptInstructions("background_claim_parser"),
    input: [
      "Parse the player's opening background into bounded claims for server adjudication.",
      "Do not decide whether any claim is true or granted.",
      "Do not include statePatch, rank grants, office grants, raw prompt text, provider data, keys, paths, hidden notes, or database names.",
      "Opening background context:",
      JSON.stringify(compactBackgroundClaimContext(context), null, 2)
    ].join("\n"),
    maxOutputTokens: 1000
  };
}

function buildNpcDialogueTask(context = {}) {
  return {
    promptPack: "npc_dialogue",
    schemaName: "npcDialogue",
    instructions: buildPromptInstructions("npc_dialogue"),
    input: [
      "Generate one NPC dialogue reply. Consequences remain server-adjudicated.",
      "Use only the supplied safe NPC dossier, relationship summary, and privateSignalTags.",
      "NPC dialogue context:",
      JSON.stringify(compactNpcDialogueContext(context), null, 2)
    ].join("\n"),
    maxOutputTokens: 1100
  };
}

function buildNpcPrivatePlannerTask(context = {}) {
  return {
    promptPack: "npc_private_planner",
    schemaName: "npcPrivatePlanner",
    instructions: buildPromptInstructions("npc_private_planner"),
    input: [
      "Create a bounded NPC intent proposal. Do not reveal hidden dossier or claim the proposal has happened.",
      "NPC private planner context:",
      JSON.stringify(compactNpcDialogueContext(context), null, 2)
    ].join("\n"),
    maxOutputTokens: 900
  };
}

function buildTradeNegotiationTask(context = {}) {
  return {
    promptPack: "trade_negotiator",
    schemaName: "tradeNegotiation",
    instructions: buildPromptInstructions("trade_negotiator"),
    input: [
      "Draft a trade negotiation response. The server decides final price, legality, inventory, and ownership.",
      "Trade context:",
      JSON.stringify(compactTradeNegotiationContext(context), null, 2)
    ].join("\n"),
    maxOutputTokens: 1000
  };
}

function buildDelegatedTaskPlanTask(context = {}) {
  return {
    promptPack: "delegated_task_planner",
    schemaName: "delegatedTaskPlan",
    instructions: buildPromptInstructions("delegated_task_planner"),
    input: [
      "Draft a delegated task plan proposal. The server validates authority, resources, and time.",
      "Delegated task context:",
      JSON.stringify(compactDelegatedTaskContext(context), null, 2)
    ].join("\n"),
    maxOutputTokens: 1000
  };
}

function buildDelegatedTaskReportTask(context = {}) {
  return {
    promptPack: "delegated_task_reporter",
    schemaName: "delegatedTaskReport",
    instructions: buildPromptInstructions("delegated_task_reporter"),
    input: [
      "Write a report for an already adjudicated delegated task result.",
      "Delegated task report context:",
      JSON.stringify(compactDelegatedTaskReportContext(context), null, 2)
    ].join("\n"),
    maxOutputTokens: 1000
  };
}

function buildInventoryEffectExplanationTask(context = {}) {
  return {
    promptPack: "inventory_effect_explainer",
    schemaName: "inventoryEffectExplanation",
    instructions: buildPromptInstructions("inventory_effect_explainer"),
    input: [
      "Explain visible item effects and lawful use. Do not activate, transfer, or change state.",
      "Inventory item context:",
      JSON.stringify(compactInventoryEffectContext(context), null, 2)
    ].join("\n"),
    maxOutputTokens: 800
  };
}

function buildOpeningTask(worldState) {
  return {
    promptPack: "opening",
    schemaName: "opening",
    instructions: buildPromptInstructions("opening"),
    input: [
      "Create the opening narrative for this new game session.",
      "Return 1-3 concise event strings.",
      "Each event string must include at least one concrete historical anchor such as dynasty, county school, scholar, commoners, grain/tax, government office, border affairs, or imperial examination.",
      "World state:",
      JSON.stringify(compactWorldState(worldState, { task: "opening" }), null, 2)
    ].join("\n"),
    maxOutputTokens: 1200
  };
}

function buildTurnTask(worldState, input) {
  const promptPack = getTurnPromptPackName(worldState);

  return {
    promptPack,
    schemaName: "turn",
    instructions: buildPromptInstructions(promptPack),
    input: [
      "Resolve one free-text player action.",
      "statePatch must contain only final absolute values for fields that changed, not deltas.",
      "attributeChanges should summarize important visible numeric changes; it may be an empty array.",
      "If the action should affect social memory, use top-level relationshipChanges with existing visible target ids only.",
      "relationshipChanges are suggestions: use relationshipDelta -12..12 and resentmentDelta -10..10; the server will clamp, ignore hidden or invented targets, and merge final ledger state.",
      "relationshipChanges should summarize important NPC/faction relationship consequences; use [] when there is no meaningful social consequence.",
      "For teacher-style study feedback, include teacherFeedbackProposal with focus, advice, reason, and optional focusKey/teacherName. It is only a proposal: the server may sanitize, accept, or ignore it, and it cannot grant exam status, relationships, rank, office, hidden facts, or database writes.",
      "For durable social memory, include memoryProposals only for existing visible actors such as npc:C01, faction:scholarOfficials, or player:P1. Memory proposals are server-adjudicated suggestions; never put actorMemoryLedger or sessionSummary in statePatch, and never include private, hidden, raw prompt/provider/audit/table/path/key content.",
      "For map movement, use only visible mapContext refs if a tool call is available; never patch worldGeography or invent hidden routes, raw coordinates, enemy truth, travel costs, appointments, exam entry, diplomacy, march results, or trade outcomes.",
      "If the player clearly asks to take the next imperial exam, set examTrigger.shouldStart=true and use the next legal level.",
      "Use retrievalContext as the first index of role-visible countries, cities, NPCs, offices, postings, institutions, and event summaries. Do not infer hidden data beyond it.",
      `Player action: ${input}`,
      "World state:",
      JSON.stringify(compactWorldState(worldState, {
        task: promptPack,
        playerAction: input,
        promptBudgetProfile: "ordinary"
      }), null, 2)
    ].join("\n"),
    maxOutputTokens: 1600
  };
}

function buildQuickActionTask(quickActionContext = {}) {
  return {
    promptPack: "quick_action",
    schemaName: "quickAction",
    instructions: buildPromptInstructions("quick_action"),
    input: [
      "Generate draft-only quick action suggestions for the player.",
      "The browser will only copy one suggestion into the action textarea; it will not submit or resolve it.",
      "Use only the supplied redacted player summary, route flags, tool capabilities, and public evidence refs.",
      "Do not mention provider, prompt, hidden, raw, local path, key, server resolver, or internal state.",
      "If evidenceRefs is empty, return generic role-appropriate actions with empty evidenceRefs.",
      "Quick action context:",
      JSON.stringify(compactQuickActionContext(quickActionContext), null, 2)
    ].join("\n"),
    maxOutputTokens: 900
  };
}

function buildTopicDraftTask(topicDraftContext = {}) {
  return {
    promptPack: "topic_draft",
    schemaName: "topicDraft",
    instructions: buildPromptInstructions("topic_draft"),
    input: [
      "Generate one draft-only Chinese topic surface document for the player.",
      "The browser will only copy this draft into the memorial textarea; it will not submit or resolve it.",
      "Use only the supplied surface context and evidence refs. evidenceRefs in your JSON must be drawn from supplied evidenceRefs.",
      "Do not mention provider, prompt, hidden, raw, local path, key, server resolver, internal state, or database tables.",
      "Do not claim that an edict, judgment, appointment, military order, battle, trial, censure, relief policy, or diplomacy result has already happened.",
      "Return only the requested JSON fields. Keep draftText suitable for the player to edit before submitting a normal turn.",
      "Topic draft context:",
      JSON.stringify(compactTopicDraftContext(topicDraftContext), null, 2)
    ].join("\n"),
    maxOutputTokens: 1000
  };
}

function buildExamQuestionTask(worldState, exam) {
  return {
    promptPack: "exam_question",
    schemaName: "examQuestion",
    instructions: buildPromptInstructions("exam_question"),
    input: [
      "Generate one historically appropriate imperial exam question.",
      "The returned level, examName, questionType, difficulty, wordCount, passScore, and promotionRank must match the supplied exam unless a display label needs richer wording.",
      "Do not decide pass/fail here.",
      "Exam:",
      JSON.stringify(exam, null, 2),
      "World state:",
      JSON.stringify(compactWorldState(worldState, { task: "exam_question" }), null, 2)
    ].join("\n"),
    maxOutputTokens: 1200
  };
}

function buildGradeTask(worldState, exam, essay, authenticityCheck) {
  return {
    promptPack: "exam_grading",
    schemaName: "grade",
    instructions: buildPromptInstructions("exam_grading"),
    input: [
      "Grade this imperial exam essay. Return five dimension scores, an overall score, a rank label, and concrete feedback.",
      "Use the supplied local authenticity check as context, but the server will apply penalties after your grading.",
      "Return empty arrays for virtual_candidates and ranking; the server generates canonical candidates and ranking.",
      "Optional examiner_reviews may describe room officer, co-examiner, chief examiner, or audit critic proposals with suggestedScoreDelta -2..2; these are not final penalties, honors, or ranking.",
      "Exam:",
      JSON.stringify(exam, null, 2),
      "World state:",
      JSON.stringify(compactWorldState(worldState, { task: "exam_grading" }), null, 2),
      "Local authenticity check:",
      JSON.stringify(authenticityCheck, null, 2),
      "Essay:",
      essay
    ].join("\n"),
    maxOutputTokens: 1800
  };
}

module.exports = {
  buildExamQuestionTask,
  buildBackgroundClaimParserTask,
  buildDelegatedTaskPlanTask,
  buildDelegatedTaskReportTask,
  buildInventoryEffectExplanationTask,
  buildNpcDialogueTask,
  buildNpcPrivatePlannerTask,
  buildTradeNegotiationTask,
  buildGradeTask,
  buildOpeningTask,
  buildQuickActionTask,
  buildTopicDraftTask,
  buildTurnTask
};
