const { randomUUID } = require("crypto");

const ROLE_LABELS = {
  scholar: "书生",
  emperor: "皇帝",
  minister: "大臣",
  general: "将领",
  magistrate: "地方官"
};

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createInitialState(input = {}) {
  const role = input.role || "scholar";
  const playerName = (input.playerName || "未定").trim() || "未定";
  const dynasty = (input.dynasty || "明").trim() || "明";
  const year = toNumber(input.year, 1644);

  return {
    sessionId: randomUUID(),
    year,
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
    characters: [
      {
        id: "C01",
        name: "顾文衡",
        role: "乡中塾师",
        loyalty: 65,
        ambition: 20,
        skill: 72,
        alive: true
      }
    ],
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
      connections: []
    }
  };
}

module.exports = {
  createInitialState
};
