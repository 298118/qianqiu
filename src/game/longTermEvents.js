const { NUMERIC_RANGES, clamp } = require("./stateRules");
const { normalizeRelationshipLedger } = require("./relationships");
const { monthsToTurns } = require("./time");

const LONG_TERM_EVENT_SCHEMA_VERSION = 1;
const MAX_QUEUE_LENGTH = 5;
const MAX_RECENT_RESOLVED = 8;
const MAX_VISIBLE_EVENTS_PER_TURN = 2;
const MAX_TEXT_LENGTH = 140;
const DEFAULT_COOLDOWN_MONTHS = 6;
const MAX_COOLDOWN_MONTHS = 48;
const COOLDOWN_UNIT_TEN_DAY = "ten_day";

const EVENT_TYPES = new Set([
  "seasonal",
  "disaster",
  "border",
  "court",
  "local_case",
  "consequence"
]);

const TARGET_TYPES = new Set(["world", "player", "local", "faction", "character"]);

const ATTRIBUTE_LABELS = {
  treasury: "府库",
  grainReserve: "粮储",
  population: "人口",
  publicOrder: "民心",
  corruption: "贪腐",
  armyMorale: "军心",
  borderThreat: "边患",
  "player.reputation": "声望",
  "player.localOrder": "地方民心",
  "player.gentryRelations": "乡绅",
  "player.pendingLawsuits": "词讼",
  "player.banditPressure": "盗匪",
  "factions.eunuchs": "宦官",
  "factions.scholarOfficials": "士大夫",
  "factions.militaryLords": "武臣"
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function currentTurn(worldState) {
  return clampNumber(worldState?.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function readRange(path, fallbackMin = Number.NEGATIVE_INFINITY, fallbackMax = Number.POSITIVE_INFINITY) {
  return NUMERIC_RANGES[path] || [fallbackMin, fallbackMax];
}

function readNumeric(source, key, fallback) {
  const value = Number(source?.[key]);
  const [min, max] = readRange(key);
  return clampNumber(value, min, max, fallback);
}

function readPlayerNumeric(worldState, key, fallback) {
  const value = Number(worldState?.player?.[key]);
  const [min, max] = readRange(key);
  return clampNumber(value, min, max, fallback);
}

function shiftTopLevel(worldState, key, delta) {
  const [min, max] = readRange(key);
  return clamp(readNumeric(worldState, key, 0) + delta, min, max);
}

function shiftPlayer(worldState, key, delta) {
  const [min, max] = readRange(key);
  return clamp(readPlayerNumeric(worldState, key, 0) + delta, min, max);
}

function shiftFaction(worldState, key, delta) {
  if (typeof worldState?.factions?.[key] !== "number") return undefined;
  return clamp(Math.round(worldState.factions[key] + delta), 0, 100);
}

function mergeStatePatch(base, patch) {
  if (!isPlainObject(patch)) return base;

  for (const [key, value] of Object.entries(patch)) {
    if (key === "player" && isPlainObject(value)) {
      base.player = { ...(base.player || {}), ...value };
    } else if (key === "factions" && isPlainObject(value)) {
      base.factions = { ...(base.factions || {}), ...value };
    } else {
      base[key] = value;
    }
  }

  return base;
}

function applyPatchToClone(worldState, patch) {
  mergeStatePatch(worldState, patch);
  return worldState;
}

function readPath(worldState, path) {
  if (path.startsWith("player.")) {
    return worldState?.player?.[path.slice("player.".length)];
  }
  if (path.startsWith("factions.")) {
    return worldState?.factions?.[path.slice("factions.".length)];
  }
  return worldState?.[path];
}

function flattenPatch(patch) {
  const paths = [];
  for (const [key, value] of Object.entries(patch || {})) {
    if ((key === "player" || key === "factions") && isPlainObject(value)) {
      for (const nestedKey of Object.keys(value)) {
        paths.push(`${key}.${nestedKey}`);
      }
    } else {
      paths.push(key);
    }
  }
  return paths;
}

function buildAttributeChanges(beforeState, finalPatch) {
  const changes = [];

  for (const path of flattenPatch(finalPatch)) {
    const before = readPath(beforeState, path);
    const after = readPath(finalPatch, path) ?? (
      path.startsWith("player.")
        ? finalPatch.player?.[path.slice("player.".length)]
        : path.startsWith("factions.")
          ? finalPatch.factions?.[path.slice("factions.".length)]
          : finalPatch[path]
    );

    if (typeof before !== "number" || typeof after !== "number" || before === after) continue;
    changes.push({
      path,
      label: ATTRIBUTE_LABELS[path] || ATTRIBUTE_LABELS[path.split(".").pop()] || path,
      before,
      after,
      reason: "长期事件"
    });
  }

  return changes;
}

function normalizeCooldownTurns(rawTurns, unit, fallbackMonths = DEFAULT_COOLDOWN_MONTHS) {
  if (unit === COOLDOWN_UNIT_TEN_DAY) {
    return clampNumber(rawTurns, 1, monthsToTurns(MAX_COOLDOWN_MONTHS), monthsToTurns(fallbackMonths));
  }
  return monthsToTurns(clampNumber(rawTurns, 1, MAX_COOLDOWN_MONTHS, fallbackMonths));
}

function normalizeCooldowns(cooldowns, turn, unit) {
  const normalized = {};
  if (!isPlainObject(cooldowns)) return normalized;

  for (const [key, value] of Object.entries(cooldowns)) {
    const cleanKey = cleanText(key, "", 64);
    if (!cleanKey) continue;
    if (unit === COOLDOWN_UNIT_TEN_DAY) {
      normalized[cleanKey] = clampNumber(value, 0, turn + monthsToTurns(40), turn);
      continue;
    }
    const parsed = Number(value);
    const legacyRemainingMonths = Number.isFinite(parsed)
      ? Math.max(0, Math.round(parsed) - turn)
      : 0;
    normalized[cleanKey] = clampNumber(
      turn + monthsToTurns(legacyRemainingMonths),
      0,
      turn + monthsToTurns(40),
      turn
    );
  }

  return normalized;
}

function normalizeEvent(raw, worldState) {
  if (!isPlainObject(raw)) return null;

  const turn = currentTurn(worldState);
  const type = EVENT_TYPES.has(raw.type) ? raw.type : null;
  if (!type) return null;

  const key = cleanText(raw.key, "", 64);
  const title = cleanText(raw.title, "");
  if (!key || !title) return null;

  const targetType = TARGET_TYPES.has(raw.targetType) ? raw.targetType : "world";
  const targetId = cleanText(raw.targetId, "", 64);
  const durationMonths = clampNumber(raw.durationMonths, 1, 12, 1);
  const remainingMonths = clampNumber(raw.remainingMonths, 1, durationMonths, durationMonths);

  return {
    schemaVersion: LONG_TERM_EVENT_SCHEMA_VERSION,
    id: cleanText(raw.id, `LTE-${String(turn).padStart(4, "0")}-${key}`, 96),
    key,
    type,
    status: "active",
    targetType,
    targetId,
    title,
    summary: cleanText(raw.summary, title),
    severity: clampNumber(raw.severity, 1, 3, 1),
    createdTurn: clampNumber(raw.createdTurn, 0, Number.MAX_SAFE_INTEGER, turn),
    startedYear: clampNumber(raw.startedYear, 1, 9999, readNumeric(worldState, "year", 1644)),
    startedMonth: clampNumber(raw.startedMonth, 1, 12, readNumeric(worldState, "month", 1)),
    durationMonths,
    remainingMonths,
    cooldownKey: cleanText(raw.cooldownKey, key, 64),
    cooldownTurns: normalizeCooldownTurns(raw.cooldownTurns, raw.cooldownUnit),
    cooldownUnit: COOLDOWN_UNIT_TEN_DAY,
    visibility: raw.visibility === "relationship_visible" || raw.visibility === "hidden"
      ? raw.visibility
      : "public"
  };
}

function normalizeResolved(entry) {
  if (!isPlainObject(entry)) return null;
  const title = cleanText(entry.title, "");
  if (!title) return null;

  return {
    id: cleanText(entry.id, title, 96),
    key: cleanText(entry.key, "", 64),
    type: EVENT_TYPES.has(entry.type) ? entry.type : "consequence",
    title,
    resolvedTurn: clampNumber(entry.resolvedTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    outcome: cleanText(entry.outcome, "resolved")
  };
}

function normalizeLongTermEventState(worldState = {}) {
  const source = isPlainObject(worldState.longTermEvents) ? worldState.longTermEvents : {};
  const turn = currentTurn(worldState);
  const queue = Array.isArray(source.queue)
    ? source.queue
      .map((event) => normalizeEvent(event, worldState))
      .filter(Boolean)
      .slice(0, MAX_QUEUE_LENGTH)
    : [];
  const recentResolved = Array.isArray(source.recentResolved)
    ? source.recentResolved.map(normalizeResolved).filter(Boolean).slice(-MAX_RECENT_RESOLVED)
    : [];

  return {
    schemaVersion: LONG_TERM_EVENT_SCHEMA_VERSION,
    queue,
    cooldowns: normalizeCooldowns(source.cooldowns, turn, source.cooldownUnit),
    cooldownUnit: COOLDOWN_UNIT_TEN_DAY,
    recentResolved
  };
}

function ensureLongTermEventState(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.longTermEvents = normalizeLongTermEventState(worldState);
  return worldState;
}

function buildLongTermEventView(worldState = {}) {
  const state = normalizeLongTermEventState(worldState);
  return {
    schemaVersion: LONG_TERM_EVENT_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    activeEvents: state.queue
      .filter((event) => event.visibility !== "hidden")
      .map((event) => ({
        id: event.id,
        type: event.type,
        title: event.title,
        summary: event.summary,
        severity: event.severity,
        startedYear: event.startedYear,
        startedMonth: event.startedMonth,
        remainingMonths: event.remainingMonths,
        durationMonths: event.durationMonths
      })),
    recentResolved: state.recentResolved.slice(-5).map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      resolvedTurn: event.resolvedTurn,
      outcome: event.outcome
    }))
  };
}

function summarizeLongTermEventsForPrompt(worldState = {}) {
  const view = buildLongTermEventView(worldState);
  return {
    activeEvents: view.activeEvents.map((event) => ({
      type: event.type,
      title: event.title,
      summary: event.summary,
      remainingMonths: event.remainingMonths,
      severity: event.severity
    })),
    recentResolved: view.recentResolved
  };
}

function hasActiveKey(scheduler, key) {
  return scheduler.queue.some((event) => event.key === key);
}

function isOnCooldown(scheduler, key, turn) {
  const availableTurn = scheduler.cooldowns[key];
  return Number.isFinite(availableTurn) && availableTurn > turn;
}

function createEvent(worldState, definition, options = {}) {
  const turn = currentTurn(worldState);
  return normalizeEvent({
    schemaVersion: LONG_TERM_EVENT_SCHEMA_VERSION,
    id: `LTE-${String(turn).padStart(4, "0")}-${definition.key}`,
    key: definition.key,
    type: definition.type,
    targetType: definition.targetType || "world",
    targetId: definition.targetId || "",
    title: typeof definition.title === "function" ? definition.title(worldState, options) : definition.title,
    summary: typeof definition.summary === "function" ? definition.summary(worldState, options) : definition.summary,
    severity: typeof definition.severity === "function" ? definition.severity(worldState, options) : definition.severity,
    createdTurn: turn,
    startedYear: readNumeric(worldState, "year", 1644),
    startedMonth: readNumeric(worldState, "month", 1),
    durationMonths: typeof definition.durationMonths === "function"
      ? definition.durationMonths(worldState, options)
      : definition.durationMonths,
    remainingMonths: typeof definition.durationMonths === "function"
      ? definition.durationMonths(worldState, options)
      : definition.durationMonths,
    cooldownKey: definition.cooldownKey || definition.key,
    cooldownTurns: monthsToTurns(definition.cooldownMonths ?? definition.cooldownTurns ?? DEFAULT_COOLDOWN_MONTHS),
    cooldownUnit: COOLDOWN_UNIT_TEN_DAY,
    visibility: definition.visibility || "public"
  }, worldState);
}

function visibleFactionExists(worldState, factionId) {
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  return ledger.factions[factionId]?.visible !== false;
}

function visibleCharacterExists(worldState, characterId) {
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  return ledger.characters[characterId]?.visible !== false;
}

function recentHistoryText(worldState) {
  return (worldState.eventHistory || []).slice(-6).join("\n");
}

const EVENT_DEFINITIONS = [
  {
    key: "disaster_grain_shortage",
    type: "disaster",
    title: "旱饥传闻",
    summary: "仓廪偏紧，州县需连续数月筹赈安民。",
    durationMonths: 2,
    cooldownMonths: 8,
    severity(worldState) {
      const grainReserve = readNumeric(worldState, "grainReserve", 800);
      const population = Math.max(1, readNumeric(worldState, "population", 5000));
      const publicOrder = readNumeric(worldState, "publicOrder", 70);
      if (grainReserve < population * 0.04 || publicOrder <= 25) return 3;
      if (grainReserve < population * 0.07 || publicOrder <= 35) return 2;
      return 1;
    },
    canSchedule(worldState) {
      const grainReserve = readNumeric(worldState, "grainReserve", 800);
      const population = Math.max(1, readNumeric(worldState, "population", 5000));
      return grainReserve < population * 0.08 || readNumeric(worldState, "publicOrder", 70) <= 35;
    }
  },
  {
    key: "border_alarm",
    type: "border",
    title: "边报连至",
    summary: "边镇军报催饷，兵部与军镇将在数月内持续施压。",
    durationMonths: 2,
    cooldownMonths: 7,
    severity(worldState) {
      const threat = readNumeric(worldState, "borderThreat", 40);
      if (threat >= 90) return 3;
      if (threat >= 78) return 2;
      return 1;
    },
    canSchedule(worldState) {
      return readNumeric(worldState, "borderThreat", 40) >= 72;
    }
  },
  {
    key: "court_faction_strife",
    type: "court",
    title: "廷争渐炽",
    summary: "朝中清流、内廷与武臣互相掣肘，政务成本上升。",
    durationMonths: 2,
    cooldownMonths: 8,
    severity(worldState) {
      return readNumeric(worldState, "corruption", 60) >= 88 ? 3 : 2;
    },
    canSchedule(worldState) {
      const factions = worldState.factions || {};
      const spread = Math.max(...Object.values(factions).filter((value) => typeof value === "number")) -
        Math.min(...Object.values(factions).filter((value) => typeof value === "number"));
      return readNumeric(worldState, "corruption", 60) >= 76 || spread >= 42;
    }
  },
  {
    key: "local_case_chain",
    type: "local_case",
    targetType: "local",
    title(worldState) {
      return `${worldState.player?.countyName || "本县"}积案牵连`;
    },
    summary: "县中旧案牵出乡绅、盗匪与赋役旧账，需跨月料理。",
    durationMonths: 2,
    cooldownMonths: 6,
    severity(worldState) {
      return readPlayerNumeric(worldState, "banditPressure", 0) >= 70 ? 3 : 2;
    },
    canSchedule(worldState) {
      return worldState.player?.role === "magistrate" &&
        (readPlayerNumeric(worldState, "pendingLawsuits", 0) >= 25 ||
          readPlayerNumeric(worldState, "banditPressure", 0) >= 55);
    }
  },
  {
    key: "social_repercussion",
    type: "consequence",
    title: "人情余波",
    summary: "近期请托进退在乡里官署间回荡，声望略受牵连。",
    durationMonths: 1,
    cooldownMonths: 5,
    canSchedule(worldState) {
      return /请托逾期|婉拒/.test(recentHistoryText(worldState));
    }
  },
  {
    key: "seasonal_harvest_audit",
    type: "seasonal",
    title: "秋粮核验",
    summary: "秋粮入簿，地方与户部核报仓储盈亏。",
    durationMonths: 1,
    cooldownMonths: 10,
    canSchedule(worldState) {
      return readNumeric(worldState, "month", 1) === 8;
    }
  }
];

function buildEventPatch(worldState, event) {
  const severity = event.severity || 1;

  if (event.key === "seasonal_harvest_audit") {
    const grainGain = Math.max(40, Math.round(readNumeric(worldState, "population", 5000) * 0.003));
    const factionValue = shiftFaction(worldState, "scholarOfficials", 1);
    const statePatch = {
      grainReserve: shiftTopLevel(worldState, "grainReserve", grainGain),
      publicOrder: shiftTopLevel(worldState, "publicOrder", 1)
    };
    if (factionValue !== undefined) {
      statePatch.factions = { scholarOfficials: factionValue };
    }
    return {
      statePatch,
      events: [`${event.title}：各县报收，仓储稍实，民间秋后稍安。`]
    };
  }

  if (event.key === "disaster_grain_shortage") {
    const population = readNumeric(worldState, "population", 5000);
    const grainLoss = Math.max(60, Math.round(population * 0.01 * severity));
    const populationLoss = Math.max(5, Math.round(population * 0.0008 * severity));
    return {
      statePatch: {
        grainReserve: shiftTopLevel(worldState, "grainReserve", -grainLoss),
        publicOrder: shiftTopLevel(worldState, "publicOrder", -3 * severity),
        population: shiftTopLevel(worldState, "population", -populationLoss)
      },
      events: [`${event.title}：饥色未解，粜籴与赈济牵动数县，民心再受考验。`]
    };
  }

  if (event.key === "border_alarm") {
    const factionValue = shiftFaction(worldState, "militaryLords", 2);
    const statePatch = {
      treasury: shiftTopLevel(worldState, "treasury", -120 * severity),
      armyMorale: shiftTopLevel(worldState, "armyMorale", -2),
      borderThreat: shiftTopLevel(worldState, "borderThreat", 1)
    };
    if (factionValue !== undefined) {
      statePatch.factions = { militaryLords: factionValue };
    }
    const relationshipChanges = visibleFactionExists(worldState, "militaryLords")
      ? [{
        targetType: "faction",
        targetId: "militaryLords",
        relationshipDelta: 2,
        resentmentDelta: 1,
        stance: "边镇索饷",
        recentIntent: "盯紧军饷与边防处置。",
        reason: "Long-term border alarm increased military pressure."
      }]
      : [];
    return {
      statePatch,
      relationshipChanges,
      events: [`${event.title}：边镇催饷练卒，军费支出骤增，边患声势未平。`]
    };
  }

  if (event.key === "court_faction_strife") {
    const eunuchs = shiftFaction(worldState, "eunuchs", 2);
    const scholars = shiftFaction(worldState, "scholarOfficials", -1);
    return {
      statePatch: {
        treasury: shiftTopLevel(worldState, "treasury", -80 * severity),
        publicOrder: shiftTopLevel(worldState, "publicOrder", -1),
        corruption: shiftTopLevel(worldState, "corruption", 2),
        factions: {
          ...(eunuchs === undefined ? {} : { eunuchs }),
          ...(scholars === undefined ? {} : { scholarOfficials: scholars })
        }
      },
      events: [`${event.title}：章疏交攻，内外推诿，钱粮与公信皆有耗损。`]
    };
  }

  if (event.key === "local_case_chain") {
    const relationshipChanges = visibleCharacterExists(worldState, "C01")
      ? [{
        targetType: "character",
        targetId: "C01",
        relationshipDelta: -1,
        resentmentDelta: 2,
        stance: "积案催办",
        recentIntent: "等候玩家处置旧案牵连。",
        reason: "Long-term local case chain increased pressure on the local contact."
      }]
      : [];
    return {
      statePatch: {
        publicOrder: shiftTopLevel(worldState, "publicOrder", -1),
        player: {
          localOrder: shiftPlayer(worldState, "localOrder", -3),
          gentryRelations: shiftPlayer(worldState, "gentryRelations", -2),
          pendingLawsuits: shiftPlayer(worldState, "pendingLawsuits", 4)
        }
      },
      relationshipChanges,
      events: [`${event.title}：旧案牵连乡绅与差役，本县案牍愈重。`]
    };
  }

  if (event.key === "social_repercussion") {
    return {
      statePatch: {
        player: {
          reputation: shiftPlayer(worldState, "reputation", -1)
        }
      },
      events: [`${event.title}：前番请托进退传入人耳，清议里略有低语。`]
    };
  }

  return { statePatch: {}, relationshipChanges: [], events: [] };
}

function buildFollowUpEvent(worldState, event) {
  if (event.key !== "disaster_grain_shortage") return null;
  if (readNumeric(worldState, "publicOrder", 70) >= 45) return null;
  return createEvent(worldState, {
    key: "disaster_relief_audit",
    type: "consequence",
    title: "赈务复核",
    summary: "灾后赈务需复核钱粮去向，若吏治不清，民心仍难恢复。",
    durationMonths: 1,
    cooldownMonths: 6,
    canSchedule: () => true
  });
}

function applyFollowUpPatch(worldState, event) {
  if (event.key !== "disaster_relief_audit") return null;
  const cleanGovernance = readNumeric(worldState, "corruption", 60) <= 55;
  return {
    statePatch: {
      publicOrder: shiftTopLevel(worldState, "publicOrder", cleanGovernance ? 2 : -1),
      corruption: shiftTopLevel(worldState, "corruption", cleanGovernance ? -1 : 1)
    },
    events: [
      cleanGovernance
        ? `${event.title}：赈册较清，灾后民心稍得安顿。`
        : `${event.title}：赈册多有浮冒，民间怨声未歇。`
    ]
  };
}

function evaluateCandidates(worldState, scheduler) {
  const turn = currentTurn(worldState);
  for (const definition of EVENT_DEFINITIONS) {
    if (hasActiveKey(scheduler, definition.key)) continue;
    if (isOnCooldown(scheduler, definition.cooldownKey || definition.key, turn)) continue;
    if (!definition.canSchedule(worldState)) continue;
    return createEvent(worldState, definition);
  }
  return null;
}

function resolveEvent(scheduler, event, worldState, result) {
  event.status = "resolved";
  event.resolvedTurn = currentTurn(worldState);
  scheduler.cooldowns[event.cooldownKey] = currentTurn(worldState) + event.cooldownTurns;
  scheduler.cooldownUnit = COOLDOWN_UNIT_TEN_DAY;
  scheduler.recentResolved.push({
    id: event.id,
    key: event.key,
    type: event.type,
    title: event.title,
    resolvedTurn: currentTurn(worldState),
    outcome: "resolved"
  });
  scheduler.recentResolved = scheduler.recentResolved.slice(-MAX_RECENT_RESOLVED);
  result.resolved.push({
    id: event.id,
    key: event.key,
    title: event.title,
    type: event.type
  });

  const followUp = buildFollowUpEvent(worldState, event);
  if (followUp && !hasActiveKey(scheduler, followUp.key)) {
    result.scheduled.push({
      id: followUp.id,
      key: followUp.key,
      title: followUp.title,
      type: followUp.type
    });
    result.events.push(`${followUp.title}：${followUp.summary}`);
  }
  return followUp;
}

function runLongTermEventStep(worldState = {}) {
  const result = {
    statePatch: {},
    attributeChanges: [],
    relationshipChanges: [],
    events: [],
    scheduled: [],
    resolved: [],
    summary: ""
  };

  if (!isPlainObject(worldState)) return result;

  ensureLongTermEventState(worldState);
  const scheduler = worldState.longTermEvents;
  const beforeState = JSON.parse(JSON.stringify(worldState));
  const workingState = JSON.parse(JSON.stringify(worldState));

  const remainingQueue = [];
  for (const event of scheduler.queue) {
    const effect = event.key === "disaster_relief_audit"
      ? applyFollowUpPatch(workingState, event)
      : buildEventPatch(workingState, event);

    if (effect) {
      mergeStatePatch(result.statePatch, effect.statePatch);
      applyPatchToClone(workingState, effect.statePatch);
      if (Array.isArray(effect.relationshipChanges)) {
        result.relationshipChanges.push(...effect.relationshipChanges);
      }
      if (Array.isArray(effect.events)) {
        result.events.push(...effect.events);
      }
    }

    event.remainingMonths -= 1;
    if (event.remainingMonths <= 0) {
      const followUp = resolveEvent(scheduler, event, workingState, result);
      if (followUp) {
        remainingQueue.push(followUp);
      }
    } else {
      remainingQueue.push(event);
    }
  }

  scheduler.queue = remainingQueue;

  if (scheduler.queue.length < MAX_QUEUE_LENGTH) {
    const event = evaluateCandidates(workingState, scheduler);
    if (event) {
      scheduler.queue.push(event);
      result.scheduled.push({
        id: event.id,
        key: event.key,
        title: event.title,
        type: event.type
      });
      result.events.push(`${event.title}：${event.summary}`);
    }
  }

  scheduler.queue = scheduler.queue.slice(0, MAX_QUEUE_LENGTH);
  scheduler.recentResolved = scheduler.recentResolved.slice(-MAX_RECENT_RESOLVED);
  worldState.longTermEvents = normalizeLongTermEventState(worldState);

  result.events = result.events
    .filter((event) => typeof event === "string" && event.trim())
    .slice(0, MAX_VISIBLE_EVENTS_PER_TURN);
  result.attributeChanges = buildAttributeChanges(beforeState, result.statePatch);
  result.summary = result.events.length ? result.events.join(" ") : "";
  return result;
}

module.exports = {
  LONG_TERM_EVENT_SCHEMA_VERSION,
  buildLongTermEventView,
  ensureLongTermEventState,
  normalizeLongTermEventState,
  runLongTermEventStep,
  summarizeLongTermEventsForPrompt
};
