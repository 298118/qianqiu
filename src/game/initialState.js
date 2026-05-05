const { randomUUID } = require("crypto");
const { createInitialRelationshipLedger } = require("./relationships");

const ROLE_LABELS = {
  scholar: "书生",
  emperor: "皇帝",
  minister: "大臣",
  general: "将领",
  magistrate: "地方官",
  official: "入仕官员"
};

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
    position: "营中将领",
    faction: "武臣",
    influence: 42,
    integrity: 56
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
    integrity: 72
  }
};

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRoleStats(role) {
  return {
    ...BASE_ROLE_STATS,
    ...(ROLE_STAT_DEFAULTS[role] || {})
  };
}

function getInitialCharacters(role) {
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
  const role = input.role || "scholar";
  const playerName = (input.playerName || "未定").trim() || "未定";
  const dynasty = (input.dynasty || "明").trim() || "明";
  const year = toNumber(input.year, 1644);

  const worldState = {
    sessionId: randomUUID(),
    year,
    month: 1,
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
    setup: {
      background: input.background || "",
      customSetting: input.customSetting || ""
    },
    player: {
      id: "P1",
      role,
      roleLabel: ROLE_LABELS[role] || role,
      name: playerName,
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

  worldState.relationshipLedger = createInitialRelationshipLedger(worldState);
  return worldState;
}

module.exports = {
  createInitialState
};
