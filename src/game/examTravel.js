const TRAVEL_PLANS = {
  child_exam: {
    distance: "local",
    baseCost: 2,
    event: "县城入场、赁席与笔墨纸费",
    fullPayEffects: { adaptability: 1 },
    shortfallEffects: { health: -1, mentality: -2 }
  },
  provincial_exam: {
    distance: "provincial",
    baseCost: 8,
    event: "赴省城道路迟滞、客栈拥挤",
    fullPayEffects: { mentality: 1, reputation: 1 },
    shortfallEffects: { health: -3, mentality: -4, adaptability: -1 }
  },
  metropolitan_exam: {
    distance: "capital",
    baseCost: 18,
    event: "长途入京、风雨与舟车劳顿",
    fullPayEffects: { adaptability: 1, reputation: 1 },
    shortfallEffects: { health: -5, mentality: -5, adaptability: -2 }
  },
  palace_exam: {
    distance: "palace",
    baseCost: 10,
    event: "京中寓居、朝服与殿试礼仪准备",
    fullPayEffects: { mentality: 1, reputation: 2 },
    shortfallEffects: { health: -2, mentality: -4, reputation: -1 }
  }
};

const PLAYER_PATCH_KEYS = ["gold", "health", "mentality", "adaptability", "reputation"];

function getTravelPlan(level) {
  return TRAVEL_PLANS[level] || TRAVEL_PLANS.child_exam;
}

function addDelta(target, key, delta) {
  target[key] = (target[key] || 0) + delta;
}

function buildPlayerPatch(player, effects, paid) {
  const patch = {};
  for (const key of PLAYER_PATCH_KEYS) {
    if (typeof player[key] === "number") {
      patch[key] = player[key];
    }
  }

  patch.gold = Math.max(0, (player.gold || 0) - paid);

  for (const [key, delta] of Object.entries(effects)) {
    addDelta(patch, key, delta);
  }

  return patch;
}

function createEntryPreparation(worldState, exam) {
  const player = worldState.player || {};
  const plan = getTravelPlan(exam.level);
  const availableGold = Math.max(0, player.gold || 0);
  const requiredGold = plan.baseCost;
  const paidGold = Math.min(availableGold, requiredGold);
  const shortfall = requiredGold - paidGold;
  const fullyFunded = shortfall === 0;
  const effects = fullyFunded ? plan.fullPayEffects : plan.shortfallEffects;
  const statePatch = { player: buildPlayerPatch(player, effects, paidGold) };
  const preparation = {
    requiredGold,
    paidGold,
    shortfall,
    fullyFunded,
    distance: plan.distance,
    event: plan.event,
    effects,
    appliedAtTurn: worldState.turnCount || 0,
    appliedAtYear: worldState.year,
    appliedAtMonth: worldState.month
  };
  const fundingText = fullyFunded
    ? `盘费已足，支出${paidGold}/${requiredGold}两`
    : `盘费不足，仅支出${paidGold}/${requiredGold}两，缺口化为疲惫与临场心浮`;

  return {
    statePatch,
    entryPreparation: preparation,
    events: [
      `${player.name || "玩家"}赶赴${exam.name}：${plan.event}；${fundingText}。`
    ]
  };
}

module.exports = {
  createEntryPreparation,
  TRAVEL_PLANS
};
