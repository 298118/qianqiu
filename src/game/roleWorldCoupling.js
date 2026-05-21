const { NUMERIC_RANGES, clamp } = require("./stateRules");
const { normalizeRelationshipLedger } = require("./relationships");
const { monthsToTurns, normalizeTenDayPeriod } = require("./time");
const { isCourtResponseLikeInput } = require("./officialCourtResponse");

const ROLE_WORLD_COUPLING_SCHEMA_VERSION = 1;
const ROLE_IMPACT_COOLDOWN_MONTHS = 2;
const COOLDOWN_UNIT_TEN_DAY = "ten_day";
const MAX_RECENT_IMPACTS = 8;
const MAX_VISIBLE_EVENTS_PER_TURN = 2;
const MAX_TEXT_LENGTH = 160;

const IMPACT_LABELS = {
  magistrate_waterworks: "水利入田",
  general_campaign: "兵事及边",
  emperor_appointments: "朝令下行",
  minister_impeachment: "阁议成势"
};

const ATTRIBUTE_LABELS = {
  treasury: "府库",
  grainReserve: "粮储",
  population: "人口",
  publicOrder: "民心",
  corruption: "贪腐",
  armyMorale: "军心",
  borderThreat: "边患",
  "player.localOrder": "地方民心",
  "player.waterworks": "水利",
  "player.corveeBurden": "徭役",
  "player.reputation": "声望",
  "player.battleReputation": "战名",
  "player.campaignRisk": "战险",
  "player.courtControl": "朝控",
  "player.mandate": "天命",
  "player.influence": "影响",
  "player.integrity": "操略",
  "factions.eunuchs": "宦官",
  "factions.scholarOfficials": "士大夫",
  "factions.militaryLords": "武臣"
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(Math.round(parsed), min, max);
}

function readRange(key, fallbackMin = Number.NEGATIVE_INFINITY, fallbackMax = Number.POSITIVE_INFINITY) {
  return NUMERIC_RANGES[key] || [fallbackMin, fallbackMax];
}

function currentTurn(worldState) {
  return clampNumber(worldState?.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function readTopLevelNumber(worldState, key, fallback) {
  const [min, max] = readRange(key);
  return clampNumber(worldState?.[key], min, max, fallback);
}

function readPlayerNumber(worldState, key, fallback) {
  const [min, max] = readRange(key);
  return clampNumber(worldState?.player?.[key], min, max, fallback);
}

function shiftTopLevel(worldState, key, delta, fallback = 0) {
  const [min, max] = readRange(key);
  return clamp(readTopLevelNumber(worldState, key, fallback) + delta, min, max);
}

function shiftPlayer(worldState, key, delta, fallback = 0) {
  const [min, max] = readRange(key);
  return clamp(readPlayerNumber(worldState, key, fallback) + delta, min, max);
}

function shiftFaction(worldState, key, delta) {
  if (typeof worldState?.factions?.[key] !== "number") return undefined;
  return clamp(Math.round(worldState.factions[key] + delta), 0, 100);
}

function normalizeCooldowns(cooldowns, turn, unit) {
  const normalized = {};
  if (!isPlainObject(cooldowns)) return normalized;

  for (const [key, value] of Object.entries(cooldowns)) {
    const cleanKey = cleanText(key, "", 64);
    if (!cleanKey) continue;
    if (unit === COOLDOWN_UNIT_TEN_DAY) {
      normalized[cleanKey] = clampNumber(value, 0, turn + 120, turn);
      continue;
    }
    const parsed = Number(value);
    const legacyRemainingMonths = Number.isFinite(parsed)
      ? Math.max(0, Math.round(parsed) - turn)
      : 0;
    normalized[cleanKey] = clampNumber(
      turn + monthsToTurns(legacyRemainingMonths),
      0,
      turn + 120,
      turn
    );
  }

  return normalized;
}

function normalizeImpact(raw, worldState = {}) {
  if (!isPlainObject(raw)) return null;
  const kind = cleanText(raw.kind, "", 64);
  const role = cleanText(raw.role, worldState?.player?.role || "", 32);
  const title = cleanText(raw.title, IMPACT_LABELS[kind] || kind);
  if (!kind || !title) return null;

  return {
    id: cleanText(raw.id, `RWC-${String(currentTurn(worldState)).padStart(4, "0")}-${kind}`, 96),
    kind,
    role,
    title,
    summary: cleanText(raw.summary, title),
    year: clampNumber(raw.year, 1, 9999, readTopLevelNumber(worldState, "year", 1644)),
    month: clampNumber(raw.month, 1, 12, readTopLevelNumber(worldState, "month", 1)),
    tenDayPeriod: normalizeTenDayPeriod(raw.tenDayPeriod, worldState?.tenDayPeriod || 1),
    turn: clampNumber(raw.turn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    affectedPaths: Array.isArray(raw.affectedPaths)
      ? raw.affectedPaths.map((path) => cleanText(path, "", 80)).filter(Boolean).slice(0, 12)
      : []
  };
}

function normalizeRoleWorldCouplingState(worldState = {}) {
  const source = isPlainObject(worldState.roleWorldCoupling) ? worldState.roleWorldCoupling : {};
  const turn = currentTurn(worldState);
  return {
    schemaVersion: ROLE_WORLD_COUPLING_SCHEMA_VERSION,
    recentImpacts: Array.isArray(source.recentImpacts)
      ? source.recentImpacts.map((impact) => normalizeImpact(impact, worldState)).filter(Boolean).slice(-MAX_RECENT_IMPACTS)
      : [],
    cooldowns: normalizeCooldowns(source.cooldowns, turn, source.cooldownUnit),
    cooldownUnit: COOLDOWN_UNIT_TEN_DAY
  };
}

function createInitialRoleWorldCouplingState() {
  return {
    schemaVersion: ROLE_WORLD_COUPLING_SCHEMA_VERSION,
    recentImpacts: [],
    cooldowns: {},
    cooldownUnit: COOLDOWN_UNIT_TEN_DAY
  };
}

function ensureRoleWorldCouplingState(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.roleWorldCoupling = normalizeRoleWorldCouplingState(worldState);
  return worldState;
}

function buildRoleWorldCouplingView(worldState = {}) {
  const state = normalizeRoleWorldCouplingState(worldState);
  return {
    schemaVersion: ROLE_WORLD_COUPLING_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    recentImpacts: state.recentImpacts.slice(-5).map((impact) => ({
      id: impact.id,
      kind: impact.kind,
      role: impact.role,
      title: impact.title,
      summary: impact.summary,
      year: impact.year,
      month: impact.month,
      tenDayPeriod: impact.tenDayPeriod,
      turn: impact.turn,
      affectedPaths: impact.affectedPaths
    }))
  };
}

function summarizeRoleWorldCouplingForPrompt(worldState = {}) {
  const view = buildRoleWorldCouplingView(worldState);
  return {
    recentImpacts: view.recentImpacts.map((impact) => ({
      kind: impact.kind,
      role: impact.role,
      title: impact.title,
      summary: impact.summary,
      affectedPaths: impact.affectedPaths
    }))
  };
}

function textIncludesAny(text, terms) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function classifyRoleWorldAction(worldState = {}, input = "") {
  const role = worldState.player?.role;
  const text = cleanText(input, "", 240);
  if ((role === "emperor" || role === "minister" || role === "official") && isCourtResponseLikeInput(text)) {
    return null;
  }

  if (role === "magistrate" && textIncludesAny(text, ["water", "irrigation", "水利", "河", "渠", "灌", "堤"])) {
    return "magistrate_waterworks";
  }

  if (role === "general" && textIncludesAny(text, ["campaign", "battle", "attack", "出战", "会战", "讨", "进剿", "破敌", "追击"])) {
    return "general_campaign";
  }

  if (role === "emperor" && textIncludesAny(text, ["appoint", "appointment", "personnel", "任免", "用人", "铨选", "吏治", "整饬"])) {
    return "emperor_appointments";
  }

  if (role === "minister" && textIncludesAny(text, ["impeach", "censor", "attack", "弹劾", "弹章", "攻讦", "纠劾", "参劾"])) {
    return "minister_impeachment";
  }

  return null;
}

function existingFactionPatch(worldState, deltas) {
  const factions = {};
  for (const [key, delta] of Object.entries(deltas)) {
    const next = shiftFaction(worldState, key, delta);
    if (next !== undefined) factions[key] = next;
  }
  return Object.keys(factions).length ? factions : undefined;
}

function visibleTargetExists(worldState, targetType, targetId) {
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  const bucket = targetType === "character" ? ledger.characters : ledger.factions;
  return bucket[targetId]?.visible !== false && Boolean(bucket[targetId]);
}

function relationshipChange(worldState, targetType, targetId, config) {
  if (!visibleTargetExists(worldState, targetType, targetId)) return null;
  return {
    targetType,
    targetId,
    relationshipDelta: config.relationshipDelta || 0,
    resentmentDelta: config.resentmentDelta || 0,
    stance: config.stance,
    recentIntent: config.recentIntent,
    note: config.note,
    reason: config.reason || "Server-owned role/world coupling."
  };
}

function buildMagistrateWaterworksEffect(worldState) {
  const population = Math.max(1, readTopLevelNumber(worldState, "population", 5000));
  const grainGain = Math.max(40, Math.round(population * 0.008));
  const factions = existingFactionPatch(worldState, { scholarOfficials: 1 });
  const statePatch = {
    grainReserve: shiftTopLevel(worldState, "grainReserve", grainGain, 800),
    population: shiftTopLevel(worldState, "population", 12, 5000),
    publicOrder: shiftTopLevel(worldState, "publicOrder", 1, 70),
    player: {
      waterworks: shiftPlayer(worldState, "waterworks", 2, 0),
      localOrder: shiftPlayer(worldState, "localOrder", 2, 0),
      corveeBurden: shiftPlayer(worldState, "corveeBurden", 1, 0),
      reputation: shiftPlayer(worldState, "reputation", 1, 10)
    }
  };
  if (factions) statePatch.factions = factions;

  return {
    kind: "magistrate_waterworks",
    title: IMPACT_LABELS.magistrate_waterworks,
    summary: "地方水利把县政成效转成粮储、民心与士绅观感。",
    statePatch,
    relationshipChanges: [
      relationshipChange(worldState, "character", "C01", {
        relationshipDelta: 1,
        resentmentDelta: -1,
        stance: "coordinating local works",
        recentIntent: "Help the magistrate turn waterworks into harvest credibility.",
        note: "Waterworks create visible county-level results."
      }),
      relationshipChange(worldState, "faction", "scholarOfficials", {
        relationshipDelta: 1,
        resentmentDelta: 0,
        stance: "approving practical governance",
        recentIntent: "Watch whether local works become durable grain relief.",
        note: "Practical local works improve civil-bureaucratic trust."
      })
    ].filter(Boolean),
    events: ["水利入田：县中工程牵动粮储与民心，地方声望随之入账。"]
  };
}

function buildGeneralCampaignEffect(worldState) {
  const prepared = readPlayerNumber(worldState, "scouting", 0) >= 42 &&
    readPlayerNumber(worldState, "supply", 0) >= 250 &&
    readTopLevelNumber(worldState, "armyMorale", 65) >= 55;
  const factions = existingFactionPatch(worldState, {
    militaryLords: prepared ? 2 : 1,
    scholarOfficials: prepared ? 0 : -1
  });
  const statePatch = {
    treasury: shiftTopLevel(worldState, "treasury", prepared ? -55 : -85, 1000),
    grainReserve: shiftTopLevel(worldState, "grainReserve", prepared ? -35 : -60, 800),
    armyMorale: shiftTopLevel(worldState, "armyMorale", prepared ? 2 : -2, 65),
    borderThreat: shiftTopLevel(worldState, "borderThreat", prepared ? -3 : -1, 40),
    player: {
      battleReputation: shiftPlayer(worldState, "battleReputation", prepared ? 2 : 1, 0),
      campaignRisk: shiftPlayer(worldState, "campaignRisk", prepared ? 1 : 5, 0)
    }
  };
  if (factions) statePatch.factions = factions;

  return {
    kind: "general_campaign",
    title: IMPACT_LABELS.general_campaign,
    summary: "战役不只增损将领声名，也牵动边患、军费、军心与武臣声势。",
    statePatch,
    relationshipChanges: [
      relationshipChange(worldState, "faction", "militaryLords", {
        relationshipDelta: prepared ? 3 : 2,
        resentmentDelta: prepared ? -1 : 1,
        stance: prepared ? "confident command bloc" : "costly campaign bloc",
        recentIntent: "Seek funds and honors after the campaign result.",
        note: "Campaign action strengthens military attention."
      }),
      relationshipChange(worldState, "faction", "scholarOfficials", {
        relationshipDelta: prepared ? 0 : -1,
        resentmentDelta: prepared ? 0 : 1,
        stance: "watching campaign cost",
        recentIntent: "Compare border gains against fiscal and human cost.",
        note: "Court officials weigh the campaign's price."
      })
    ].filter(Boolean),
    events: [
      prepared
        ? "兵事及边：侦候与粮饷俱备，边患稍退而军心转振。"
        : "兵事及边：仓促用兵虽动摇敌势，却使军费与战险一并上升。"
    ]
  };
}

function buildEmperorAppointmentsEffect(worldState) {
  const factions = existingFactionPatch(worldState, {
    scholarOfficials: 2,
    eunuchs: -2
  });
  const statePatch = {
    publicOrder: shiftTopLevel(worldState, "publicOrder", 1, 70),
    corruption: shiftTopLevel(worldState, "corruption", -2, 60),
    player: {
      courtControl: shiftPlayer(worldState, "courtControl", 2, 0),
      mandate: shiftPlayer(worldState, "mandate", 1, 0)
    }
  };
  if (factions) statePatch.factions = factions;

  return {
    kind: "emperor_appointments",
    title: IMPACT_LABELS.emperor_appointments,
    summary: "皇帝任免把朝廷人事转成派系进退、吏治压力与地方执行力。",
    statePatch,
    relationshipChanges: [
      relationshipChange(worldState, "faction", "scholarOfficials", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "empowered civil service",
        recentIntent: "Support clean appointments while asking for follow-through.",
        note: "Clean appointments strengthen scholar-official confidence."
      }),
      relationshipChange(worldState, "faction", "eunuchs", {
        relationshipDelta: -2,
        resentmentDelta: 3,
        stance: "threatened inner court",
        recentIntent: "Protect older appointment channels.",
        note: "Personnel cleanup threatens palace intermediaries."
      })
    ].filter(Boolean),
    events: ["朝令下行：任免整饬压低贪腐，士大夫得势而内廷旧路受抑。"]
  };
}

function buildMinisterImpeachmentEffect(worldState) {
  const cleanCase = readPlayerNumber(worldState, "integrity", 60) >= 55;
  const factions = existingFactionPatch(worldState, cleanCase
    ? { scholarOfficials: 2, eunuchs: -2 }
    : { scholarOfficials: -1, eunuchs: 1 });
  const statePatch = {
    publicOrder: shiftTopLevel(worldState, "publicOrder", -1, 70),
    corruption: shiftTopLevel(worldState, "corruption", cleanCase ? -4 : 1, 60),
    player: {
      influence: shiftPlayer(worldState, "influence", 2, 0),
      integrity: shiftPlayer(worldState, "integrity", cleanCase ? 1 : -2, 60),
      reputation: shiftPlayer(worldState, "reputation", cleanCase ? 1 : -1, 10)
    }
  };
  if (factions) statePatch.factions = factions;

  return {
    kind: "minister_impeachment",
    title: IMPACT_LABELS.minister_impeachment,
    summary: cleanCase
      ? "大臣弹劾把清议转为吏治压力，压低贪腐但也搅动朝局。"
      : "大臣攻讦把私怨写成公文，短期增权却加深朝中浊流。",
    statePatch,
    relationshipChanges: [
      relationshipChange(worldState, "faction", "scholarOfficials", {
        relationshipDelta: cleanCase ? 2 : -1,
        resentmentDelta: cleanCase ? -1 : 2,
        stance: cleanCase ? "clean remonstrance bloc" : "suspicious factional bloc",
        recentIntent: "Judge whether impeachment serves public order or private attack.",
        note: cleanCase ? "A clean impeachment reinforces official discipline." : "A factional attack stains clean-name support."
      }),
      relationshipChange(worldState, "faction", "eunuchs", {
        relationshipDelta: cleanCase ? -2 : 1,
        resentmentDelta: cleanCase ? 3 : 0,
        stance: cleanCase ? "defensive palace faction" : "useful factional noise",
        recentIntent: "Measure whether the minister's attack can be redirected.",
        note: "Impeachment pressure reshapes palace and civil-service balance."
      })
    ].filter(Boolean),
    events: [
      cleanCase
        ? "阁议成势：弹章成案，清议压下贪墨，却令朝堂波澜更急。"
        : "阁议成势：攻讦得势一时，朝局疑忌随之加深。"
    ]
  };
}

function buildEffect(worldState, kind) {
  if (kind === "magistrate_waterworks") return buildMagistrateWaterworksEffect(worldState);
  if (kind === "general_campaign") return buildGeneralCampaignEffect(worldState);
  if (kind === "emperor_appointments") return buildEmperorAppointmentsEffect(worldState);
  if (kind === "minister_impeachment") return buildMinisterImpeachmentEffect(worldState);
  return null;
}

function isOnCooldown(state, kind, turn) {
  const nextAvailableTurn = state.cooldowns[kind];
  return typeof nextAvailableTurn === "number" && nextAvailableTurn > turn;
}

function readPath(state, path) {
  if (path.startsWith("player.")) return state?.player?.[path.slice("player.".length)];
  if (path.startsWith("factions.")) return state?.factions?.[path.slice("factions.".length)];
  return state?.[path];
}

function flattenPatch(patch) {
  const paths = [];
  for (const [key, value] of Object.entries(patch || {})) {
    if ((key === "player" || key === "factions") && isPlainObject(value)) {
      for (const nestedKey of Object.keys(value)) {
        paths.push(`${key}.${nestedKey}`);
      }
    } else if (key !== "roleWorldCoupling") {
      paths.push(key);
    }
  }
  return paths;
}

function buildAttributeChanges(beforeState, statePatch) {
  const changes = [];
  for (const path of flattenPatch(statePatch)) {
    const after = readPath(statePatch, path);
    const before = readPath(beforeState, path);
    if (typeof before !== "number" || typeof after !== "number" || before === after) continue;
    changes.push({
      path,
      label: ATTRIBUTE_LABELS[path] || ATTRIBUTE_LABELS[path.split(".").pop()] || path,
      before,
      after,
      reason: "角色世界联动"
    });
  }
  return changes;
}

function createImpact(worldState, effect, affectedPaths) {
  return normalizeImpact({
    id: `RWC-${String(currentTurn(worldState)).padStart(4, "0")}-${effect.kind}`,
    kind: effect.kind,
    role: worldState.player?.role || "",
    title: effect.title,
    summary: effect.summary,
    year: readTopLevelNumber(worldState, "year", 1644),
    month: readTopLevelNumber(worldState, "month", 1),
    tenDayPeriod: normalizeTenDayPeriod(worldState?.tenDayPeriod),
    turn: currentTurn(worldState),
    affectedPaths
  }, worldState);
}

function runRoleWorldCouplingStep(worldState = {}, input = "") {
  const state = normalizeRoleWorldCouplingState(worldState);
  const result = {
    statePatch: {
      roleWorldCoupling: state
    },
    attributeChanges: [],
    relationshipChanges: [],
    events: [],
    outcome: null,
    summary: ""
  };

  if (!isPlainObject(worldState)) return result;

  const kind = classifyRoleWorldAction(worldState, input);
  if (kind && isOnCooldown(state, kind, currentTurn(worldState))) {
    return result;
  }

  const effect = kind ? buildEffect(worldState, kind) : null;
  if (!effect) return result;

  const beforeState = JSON.parse(JSON.stringify(worldState));
  const affectedPaths = flattenPatch(effect.statePatch);
  const impact = createImpact(worldState, effect, affectedPaths);
  const nextState = normalizeRoleWorldCouplingState({
    ...worldState,
    roleWorldCoupling: {
      ...state,
      recentImpacts: [...state.recentImpacts, impact].slice(-MAX_RECENT_IMPACTS),
      cooldowns: {
        ...state.cooldowns,
        [effect.kind]: currentTurn(worldState) + monthsToTurns(ROLE_IMPACT_COOLDOWN_MONTHS)
      },
      cooldownUnit: COOLDOWN_UNIT_TEN_DAY
    }
  });

  result.statePatch = {
    ...effect.statePatch,
    roleWorldCoupling: nextState
  };
  result.attributeChanges = buildAttributeChanges(beforeState, result.statePatch);
  result.relationshipChanges = effect.relationshipChanges || [];
  result.events = (effect.events || []).filter(Boolean).slice(0, MAX_VISIBLE_EVENTS_PER_TURN);
  result.outcome = impact;
  result.summary = effect.summary;
  return result;
}

module.exports = {
  ROLE_WORLD_COUPLING_SCHEMA_VERSION,
  buildRoleWorldCouplingView,
  classifyRoleWorldAction,
  createInitialRoleWorldCouplingState,
  ensureRoleWorldCouplingState,
  normalizeRoleWorldCouplingState,
  runRoleWorldCouplingStep,
  summarizeRoleWorldCouplingForPrompt
};
