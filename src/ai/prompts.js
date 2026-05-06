const { summarizeRelationshipLedger } = require("../game/relationships");

const TURN_ALLOWED_PATCH_KEYS = [
  "treasury",
  "grainReserve",
  "population",
  "publicOrder",
  "taxRate",
  "corruption",
  "armySize",
  "armyMorale",
  "borderThreat",
  "factions",
  "player"
];

const PLAYER_ALLOWED_PATCH_KEYS = [
  "health",
  "gold",
  "examRank",
  "academia",
  "literaryTalent",
  "adaptability",
  "mentality",
  "reputation",
  "teacher",
  "studiedBooks",
  "connections",
  "personalPower",
  "courtControl",
  "mandate",
  "position",
  "faction",
  "influence",
  "integrity",
  "superiorFavor",
  "peerNetwork",
  "performanceMerit",
  "promotionProspect",
  "impeachmentRisk",
  "cleanReputation",
  "command",
  "troops",
  "supply",
  "battleReputation",
  "scouting",
  "campaignRisk",
  "countyName",
  "localTreasury",
  "localOrder",
  "gentryRelations",
  "banditPressure",
  "pendingLawsuits",
  "corveeBurden",
  "waterworks"
];

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
    teacher: player.teacher,
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
    readiness: activeExam.readiness || null
  };
}

function compactWorldState(worldState = {}) {
  return {
    year: worldState.year,
    month: worldState.month,
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
    relationshipLedger: summarizeRelationshipLedger(worldState.relationshipLedger, worldState, { visibleOnly: true }),
    activeExam: compactExam(worldState.activeExam),
    recentEvents: (worldState.eventHistory || []).slice(-6),
    setup: worldState.setup || {},
    player: compactPlayer(worldState.player)
  };
}

function commonInstructions() {
  return [
    "You are the AI world engine for Qianqiu, a Chinese historical simulation text game.",
    "Return only one JSON object that matches the provided schema. Do not wrap it in Markdown.",
    "Write player-facing narrative in Simplified Chinese with a restrained classical historical tone.",
    "The server owns state boundaries, promotion rules, exam gates, cheating penalties, persistence, and final application of patches.",
    "Never grant palace rank, office title, or role promotion in ordinary turn statePatch. Use examTrigger for exam entry requests.",
    "Keep statePatch small and only use allowed keys. Prefer modest numeric changes in the range of 1-8 unless the action clearly spends resources.",
    "Never put relationshipLedger in statePatch.",
    `Allowed top-level patch keys: ${TURN_ALLOWED_PATCH_KEYS.join(", ")}.`,
    `Allowed player patch keys: ${PLAYER_ALLOWED_PATCH_KEYS.join(", ")}.`
  ].join("\n");
}

function buildOpeningTask(worldState) {
  return {
    schemaName: "opening",
    instructions: commonInstructions(),
    input: [
      "Create the opening narrative for this new game session.",
      "Return 1-3 concise event strings.",
      "World state:",
      JSON.stringify(compactWorldState(worldState), null, 2)
    ].join("\n"),
    maxOutputTokens: 1200
  };
}

function buildTurnTask(worldState, input) {
  return {
    schemaName: "turn",
    instructions: commonInstructions(),
    input: [
      "Resolve one free-text player action.",
      "statePatch must contain only final absolute values for fields that changed, not deltas.",
      "attributeChanges should summarize important visible numeric changes; it may be an empty array.",
      "If the action should affect social memory, use top-level relationshipChanges with existing visible target ids only.",
      "relationshipChanges are suggestions: use relationshipDelta -12..12 and resentmentDelta -10..10; the server will clamp, ignore hidden or invented targets, and merge final ledger state.",
      "relationshipChanges should summarize important NPC/faction relationship consequences; use [] when there is no meaningful social consequence.",
      "If the player clearly asks to take the next imperial exam, set examTrigger.shouldStart=true and use the next legal level.",
      `Player action: ${input}`,
      "World state:",
      JSON.stringify(compactWorldState(worldState), null, 2)
    ].join("\n"),
    maxOutputTokens: 1600
  };
}

function buildExamQuestionTask(worldState, exam) {
  return {
    schemaName: "examQuestion",
    instructions: commonInstructions(),
    input: [
      "Generate one historically appropriate imperial exam question.",
      "The returned level, examName, questionType, difficulty, wordCount, passScore, and promotionRank must match the supplied exam unless a display label needs richer wording.",
      "Do not decide pass/fail here.",
      "Exam:",
      JSON.stringify(exam, null, 2),
      "World state:",
      JSON.stringify(compactWorldState(worldState), null, 2)
    ].join("\n"),
    maxOutputTokens: 1200
  };
}

function buildGradeTask(worldState, exam, essay, authenticityCheck) {
  return {
    schemaName: "grade",
    instructions: commonInstructions(),
    input: [
      "Grade this imperial exam essay. Return five dimension scores, an overall score, a rank label, and concrete feedback.",
      "Use the supplied local authenticity check as context, but the server will apply penalties after your grading.",
      "Return empty arrays for virtual_candidates and ranking; the server generates canonical candidates and ranking.",
      "Exam:",
      JSON.stringify(exam, null, 2),
      "World state:",
      JSON.stringify(compactWorldState(worldState), null, 2),
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
  buildGradeTask,
  buildOpeningTask,
  buildTurnTask
};
