const { randomUUID } = require("crypto");
const { createInitialExamCalendar } = require("./examCalendar");
const { createInitialRelationshipLedger } = require("./relationships");
const { createInitialRoleWorldCouplingState } = require("./roleWorldCoupling");
const { createInitialWorldGeographyState } = require("./worldGeography");
const { createInitialWorldEntityState } = require("./worldEntities");
const { createInitialWorldPeopleState } = require("./worldPeople");
const { createInitialWorldThreadState } = require("./worldThreads");
const { createInitialOfficialCourtResponseState } = require("./officialCourtResponse");
const { createInitialOfficialPostingsState } = require("./officialPostings");
const { createInitialStudyProfile } = require("./studyProfile");
const { createInitialExamHonorLedger } = require("./examHonors");
const { createInitialAppointmentTrackLedger } = require("./appointmentTracks");
const { createInitialActorMemoryLedger } = require("./actorMemoryLedger");
const { createInitialSessionSummaryState } = require("./sessionSummary");
const { createDeterministicInitialAssetLedger } = require("./assetLedger");
const { createDeterministicInitialInventoryLedger } = require("./inventoryLedger");
const { buildDeterministicNpcRoster } = require("./npcRoster");
const { createInitialDelegatedTaskLedger } = require("./delegatedTasks");
const { createInitialNpcInteractionLedger } = require("./npcInteractions");
const { createInitialTradeLedger } = require("./tradeLedger");
const { createInitialOpeningBackgroundClaimsState } = require("./openingBackgroundClaims");
const {
  createInitialMarketPriceLedger,
  createInitialNpcEconomyLedger
} = require("./npcEconomy");
const { createInitialNpcActiveRequestLedger } = require("./npcActiveRequests");
const { NUMERIC_RANGES, clamp } = require("./stateRules");

const ROLE_LABELS = {
  scholar: "书生",
  emperor: "皇帝",
  minister: "大臣",
  general: "将领",
  magistrate: "地方官",
  official: "入仕官员"
};
const ALLOWED_ROLES = Object.freeze(Object.keys(ROLE_LABELS));
const FAMILY_BACKGROUND_LABELS = Object.freeze({
  poor: "贫寒",
  modest: "普通",
  gentry: "世家",
  "贫寒": "贫寒",
  "普通": "普通",
  "世家": "世家"
});
const PORTRAIT_REF_PATTERN = /^portrait-[a-z0-9][a-z0-9_-]{0,140}$/i;
const UNSAFE_PORTRAIT_REF_PATTERN = /(?:^|[-_])(raw|provider|prompt|hidden|private|key|path|secret|token|api|file|data|http)(?:$|[-_])/i;

const BASE_ROLE_STATS = {
  personalPower: 0,
  courtControl: 0,
  mandate: 0,
  position: "未授",
  faction: "未定",
  influence: 0,
  integrity: 60
};

const ROLE_STAT_DEFAULTS = {
  scholar: {
    position: "寒窗士子",
    faction: "士林"
  },
  emperor: {
    personalPower: 62,
    courtControl: 55,
    mandate: 58,
    position: "九五之尊",
    faction: "皇权",
    influence: 90,
    integrity: 50
  },
  minister: {
    position: "六部侍郎",
    faction: "清流",
    influence: 44,
    integrity: 68
  },
  general: {
    position: "游击将军",
    faction: "边镇武臣",
    influence: 42,
    integrity: 56,
    command: 48,
    troops: 420,
    supply: 360,
    battleReputation: 18,
    scouting: 35,
    campaignRisk: 32
  },
  magistrate: {
    position: "知县",
    faction: "地方官",
    influence: 28,
    integrity: 64,
    countyName: "清河县",
    localTreasury: 320,
    localOrder: 62,
    gentryRelations: 45,
    banditPressure: 38,
    pendingLawsuits: 12,
    corveeBurden: 30,
    waterworks: 42
  },
  official: {
    position: "候选观政",
    faction: "新科进士",
    influence: 24,
    integrity: 72,
    superiorFavor: 42,
    peerNetwork: 35,
    performanceMerit: 30,
    promotionProspect: 24,
    impeachmentRisk: 18,
    cleanReputation: 70
  }
};

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInitialYear(value) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return 1644;
  }
  const [min, max] = NUMERIC_RANGES.year;
  return clamp(Math.round(toNumber(value, 1644)), min, max);
}

function getRoleStats(role) {
  return {
    ...BASE_ROLE_STATS,
    ...(ROLE_STAT_DEFAULTS[role] || {})
  };
}

function cleanInitialPublicText(value, maxLength = 80) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeInitialFamilyBackground(value, role = "scholar") {
  if (role !== "scholar") return "";
  if (value === undefined || value === null || value === "") return "";
  const normalized = FAMILY_BACKGROUND_LABELS[String(value).trim()];
  return normalized || "";
}

function normalizeInitialPortraitRef(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || !PORTRAIT_REF_PATTERN.test(text) || UNSAFE_PORTRAIT_REF_PATTERN.test(text)) return "";
  return text;
}

function createUnsupportedRoleError(role) {
  const err = new Error(`Unsupported role. Allowed roles: ${ALLOWED_ROLES.join(", ")}`);
  err.statusCode = 400;
  err.role = role;
  err.allowedRoles = [...ALLOWED_ROLES];
  return err;
}

function normalizeInitialRole(value) {
  if (value === undefined || value === null) return "scholar";
  if (typeof value !== "string") throw createUnsupportedRoleError(value);

  const role = value.trim();
  if (!role) return "scholar";
  if (!ALLOWED_ROLES.includes(role)) throw createUnsupportedRoleError(role);
  return role;
}

function getInitialCharacters(role) {
  if (role === "general") {
    return [
      {
        id: "C01",
        name: "沈参将",
        role: "中军参将",
        loyalty: 62,
        ambition: 48,
        skill: 74,
        alive: true
      }
    ];
  }

  if (role === "magistrate") {
    return [
      {
        id: "C01",
        name: "陆知事",
        role: "县丞",
        loyalty: 58,
        ambition: 35,
        skill: 68,
        alive: true
      }
    ];
  }

  if (role === "official") {
    return [
      {
        id: "C01",
        name: "赵给事",
        role: "署中上官",
        loyalty: 56,
        ambition: 44,
        skill: 78,
        alive: true
      }
    ];
  }

  return [
    {
      id: "C01",
      name: "顾文衡",
      role: "乡中塾师",
      loyalty: 65,
      ambition: 20,
      skill: 72,
      alive: true
    }
  ];
}

function createInitialState(input = {}) {
  const role = normalizeInitialRole(input.role);
  const playerName = (input.playerName || "未定").trim() || "未定";
  const dynasty = (input.dynasty || "明").trim() || "明";
  const year = clampInitialYear(input.year);
  const nativePlace = cleanInitialPublicText(input.nativePlace || input.hometown || input.origin);
  const familyBackground = normalizeInitialFamilyBackground(
    input.familyBackground || input.familyStatus || input.familyOrigin,
    role
  );
  const portraitRef = normalizeInitialPortraitRef(input.portraitRef);
  const publicBackground = cleanInitialPublicText(input.background, 120);
  const background = [
    familyBackground ? `书生家境：${familyBackground}` : "",
    publicBackground
  ].filter(Boolean).join("；");
  const customSetting = cleanInitialPublicText(input.customSetting, 180);

  const worldState = {
    sessionId: randomUUID(),
    year,
    month: 1,
    tenDayPeriod: 1,
    dynasty,
    turnCount: 0,
    treasury: 1000,
    grainReserve: 800,
    population: 5000,
    publicOrder: 70,
    taxRate: 30,
    corruption: 60,
    armySize: 200,
    armyMorale: 65,
    borderThreat: 40,
    factions: {
      eunuchs: 50,
      scholarOfficials: 40,
      militaryLords: 30
    },
    characters: getInitialCharacters(role),
    eventHistory: [],
    activeExam: null,
    studyProfile: null,
    appointmentTrack: null,
    aiSettings: null,
    playerMonthlyBriefing: null,
    actorMemoryLedger: null,
    sessionSummary: null,
    assetLedger: null,
    resourceLedger: null,
    inventoryLedger: null,
    npcRoster: null,
    delegatedTaskLedger: null,
    npcInteractionLedger: null,
    tradeLedger: null,
    openingBackgroundClaims: null,
    marketPriceLedger: null,
    npcEconomyLedger: null,
    npcActiveRequestLedger: null,
    examCalendar: createInitialExamCalendar(),
    activeNpcRequest: null,
    longTermEvents: {
      schemaVersion: 1,
      queue: [],
      cooldowns: {},
      cooldownUnit: "ten_day",
      recentResolved: []
    },
    roleWorldCoupling: createInitialRoleWorldCouplingState(),
    worldGeography: null,
    worldEntities: null,
    worldPeople: null,
    worldThreads: createInitialWorldThreadState(),
    officialCourtResponses: createInitialOfficialCourtResponseState(),
    officialPostings: null,
    officialCareer: {
      schemaVersion: 2,
      tenureMonths: 0,
      reviewCycleMonths: 12,
      lastReviewTurn: null,
      lastReviewYear: null,
      currentPosting: role === "official" ? ROLE_STAT_DEFAULTS.official.position : "未授",
      bureauId: role === "official" ? "ministry_personnel" : null,
      careerHistory: [],
      pendingOutcome: null,
      cooldowns: {},
      cooldownUnit: "ten_day",
      assignments: [],
      courtEntryResolutions: [],
      courtEntryFollowUps: [],
      assessmentDossier: {
        cycleId: `${year}-career`,
        meritScore: role === "official" ? ROLE_STAT_DEFAULTS.official.performanceMerit : 0,
        riskScore: role === "official" ? ROLE_STAT_DEFAULTS.official.impeachmentRisk : 0,
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
        risk: role === "official" ? ROLE_STAT_DEFAULTS.official.impeachmentRisk : 0,
        visibleNotice: "",
        hiddenNotes: [],
        lastUpdatedTurn: null
      }
    },
    setup: {
      background,
      customSetting,
      familyBackground,
      nativePlace
    },
    player: {
      id: "P1",
      role,
      roleLabel: ROLE_LABELS[role] || role,
      name: playerName,
      portraitRef: portraitRef || null,
      nativePlace,
      health: 100,
      gold: 10,
      examRank: null,
      palaceRank: null,
      officeTitle: null,
      academia: 10,
      literaryTalent: 10,
      adaptability: 10,
      mentality: 10,
      reputation: 10,
      examHistory: [],
      teacher: null,
      studiedBooks: [],
      connections: [],
      ...getRoleStats(role)
    }
  };

  worldState.worldGeography = createInitialWorldGeographyState(worldState);
  worldState.officialPostings = createInitialOfficialPostingsState(worldState);
  worldState.worldEntities = createInitialWorldEntityState(worldState);
  worldState.relationshipLedger = createInitialRelationshipLedger(worldState);
  worldState.worldPeople = createInitialWorldPeopleState(worldState);
  worldState.studyProfile = createInitialStudyProfile(worldState);
  worldState.examHonorLedger = createInitialExamHonorLedger(worldState);
  worldState.appointmentTrack = createInitialAppointmentTrackLedger(worldState);
  worldState.actorMemoryLedger = createInitialActorMemoryLedger(worldState);
  worldState.sessionSummary = createInitialSessionSummaryState(worldState);
  const assetLedger = createDeterministicInitialAssetLedger({
    role,
    ownerActorId: worldState.player.id,
    player: worldState.player
  });
  worldState.assetLedger = {
    schemaVersion: assetLedger.schemaVersion,
    ownerActorId: assetLedger.ownerActorId,
    assets: assetLedger.assets
  };
  worldState.resourceLedger = {
    schemaVersion: assetLedger.schemaVersion,
    ownerActorId: assetLedger.ownerActorId,
    accounts: assetLedger.resourceAccounts
  };
  worldState.inventoryLedger = createDeterministicInitialInventoryLedger({
    role,
    ownerActorId: worldState.player.id,
    player: worldState.player
  });
  worldState.npcRoster = buildDeterministicNpcRoster(worldState);
  worldState.delegatedTaskLedger = createInitialDelegatedTaskLedger(worldState);
  worldState.npcInteractionLedger = createInitialNpcInteractionLedger(worldState);
  worldState.tradeLedger = createInitialTradeLedger(worldState);
  worldState.openingBackgroundClaims = createInitialOpeningBackgroundClaimsState(input, worldState);
  worldState.marketPriceLedger = createInitialMarketPriceLedger(worldState);
  worldState.npcEconomyLedger = createInitialNpcEconomyLedger(worldState);
  worldState.npcActiveRequestLedger = createInitialNpcActiveRequestLedger(worldState);
  return worldState;
}

module.exports = {
  ALLOWED_ROLES,
  FAMILY_BACKGROUND_LABELS,
  normalizeInitialFamilyBackground,
  normalizeInitialPortraitRef,
  normalizeInitialRole,
  createInitialState
};
