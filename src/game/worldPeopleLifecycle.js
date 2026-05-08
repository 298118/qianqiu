const { buildWorldGeographyView } = require("./worldGeography");
const { normalizeWorldPeopleState } = require("./worldPeople");
const { normalizeWorldPeopleSchemaBundle } = require("./worldPeopleSchemas");
const { WORLD_PEOPLE_LIFECYCLE_CONFIG } = require("./worldPeopleLifecycleConfig");

const MAX_TEXT_LENGTH = 140;
const SENSITIVE_LIFECYCLE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|relationshipLedger|worldPeople|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|people_|event_log|ai_change_proposals|sqlite|data[\\/](?:sessions|audit)|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || SENSITIVE_LIFECYCLE_TEXT_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampMetric(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
}

function clampSignedMetric(value, fallback = 0) {
  return clampNumber(value, -100, 100, fallback);
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function readNumber(source, key, fallback) {
  return clampNumber(source?.[key], Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, fallback);
}

function hashText(value) {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function deterministicScore(row, context, salt) {
  return hashText(`${row?.id || ""}:${context.turn}:${salt}`);
}

function pickRows(rows, limit, context, salt, priority = () => 0) {
  return [...rows]
    .sort((first, second) => {
      const priorityDelta = priority(second) - priority(first);
      if (priorityDelta !== 0) return priorityDelta;
      return deterministicScore(first, context, salt) - deterministicScore(second, context, salt);
    })
    .slice(0, limit);
}

function uniqueIds(values) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string" || !value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function includesMonth(months, month) {
  return months.includes(clampNumber(month, 1, 12, 1));
}

function visibleCityIds(worldState) {
  try {
    return buildWorldGeographyView(worldState).cities.map((city) => city.id).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function createContext(worldState, options = {}) {
  const population = Math.max(1, readNumber(worldState, "population", 5000));
  const grainReserve = readNumber(worldState, "grainReserve", 800);
  const month = clampNumber(worldState.month, 1, 12, 1);
  const tenDayPeriod = clampNumber(worldState.tenDayPeriod, 1, 3, 1);
  return {
    turn: currentTurn(worldState),
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month,
    tenDayPeriod,
    publicOrder: clampMetric(worldState.publicOrder, 70),
    corruption: clampMetric(worldState.corruption, 60),
    taxRate: clampMetric(worldState.taxRate, 30),
    grainRatio: grainReserve / population,
    isAnnual: options.isAnnual === true || (month === WORLD_PEOPLE_LIFECYCLE_CONFIG.annualAgeMonth && tenDayPeriod === 1),
    isHarvestMonth: includesMonth(WORLD_PEOPLE_LIFECYCLE_CONFIG.harvestMonths, month),
    cityIds: visibleCityIds(worldState),
    forceMarriage: options.forceMarriage === true,
    forceMigration: options.forceMigration === true
  };
}

function emptyResult() {
  return {
    applied: false,
    summary: "",
    events: [],
    attributeChanges: [],
    relationshipChanges: [],
    peopleChanges: []
  };
}

function markChanged(result, collection, row, fields, summary) {
  const changedFields = uniqueIds(fields);
  if (!changedFields.length) return;
  result.peopleChanges.push({
    collection,
    rowId: row.id,
    fields: changedFields,
    summary: cleanText(summary, `${row.id}有新记录。`)
  });
}

function setField(row, field, value, changedFields) {
  if (row[field] === value) return;
  row[field] = value;
  changedFields.push(field);
}

function setNestedField(row, parentKey, field, value, changedFields) {
  row[parentKey] ||= {};
  if (row[parentKey][field] === value) return;
  row[parentKey][field] = value;
  changedFields.push(`${parentKey}.${field}`);
}

function addRelationshipNote(row, note) {
  const text = cleanText(note, "");
  if (!text) return false;
  const notes = Array.isArray(row.recentNotes) ? row.recentNotes : [];
  const next = [...notes.filter((entry) => entry !== text), text]
    .slice(-WORLD_PEOPLE_LIFECYCLE_CONFIG.maxRecentRelationshipNotes);
  if (JSON.stringify(next) === JSON.stringify(notes)) return false;
  row.recentNotes = next;
  return true;
}

function stripLifecycleRankSuffix(rankLabel) {
  return cleanText(rankLabel, "").replace(/（(?:考成向上|候勘|留任观望|差遣转紧)）$/, "");
}

function calculateNpcHealthDelta(npc, context) {
  let delta = 0;
  if (npc.age >= WORLD_PEOPLE_LIFECYCLE_CONFIG.fragileAge) delta -= 4;
  else if (npc.age >= WORLD_PEOPLE_LIFECYCLE_CONFIG.elderAge) delta -= 2;
  else if (npc.age >= WORLD_PEOPLE_LIFECYCLE_CONFIG.seniorAge) delta -= 1;

  if (context.publicOrder < WORLD_PEOPLE_LIFECYCLE_CONFIG.lowPublicOrderThreshold) delta -= 1;
  if (context.grainRatio < WORLD_PEOPLE_LIFECYCLE_CONFIG.grainStressRatio) delta -= 2;
  if (npc.debts > npc.wealthCash + WORLD_PEOPLE_LIFECYCLE_CONFIG.debtPressureCashGap) delta -= 1;
  if (
    npc.health < WORLD_PEOPLE_LIFECYCLE_CONFIG.stableHealthTarget &&
    context.publicOrder >= WORLD_PEOPLE_LIFECYCLE_CONFIG.stablePublicOrderThreshold &&
    context.grainRatio >= WORLD_PEOPLE_LIFECYCLE_CONFIG.stableGrainRatio
  ) {
    delta += 1;
  }
  return delta;
}

function calculateNpcCashDelta(npc, context) {
  const income = Math.max(0, Math.round((npc.annualIncomeEstimate || 0) / WORLD_PEOPLE_LIFECYCLE_CONFIG.monthlyIncomeDivisor));
  const landIncome = context.isHarvestMonth ? Math.round((npc.landMu || 0) / 80) : 0;
  const taxLoss = context.taxRate >= WORLD_PEOPLE_LIFECYCLE_CONFIG.highTaxThreshold ? 2 : 0;
  const corruptionLoss = context.corruption >= WORLD_PEOPLE_LIFECYCLE_CONFIG.highCorruptionThreshold ? 2 : 0;
  const orderLoss = context.publicOrder < WORLD_PEOPLE_LIFECYCLE_CONFIG.lowPublicOrderThreshold ? 2 : 0;
  const debtLoss = npc.debts > 0 ? 1 : 0;
  return clampNumber(
    income + landIncome - taxLoss - corruptionLoss - orderLoss - debtLoss,
    -WORLD_PEOPLE_LIFECYCLE_CONFIG.maxNpcCashDelta,
    WORLD_PEOPLE_LIFECYCLE_CONFIG.maxNpcCashDelta,
    0
  );
}

function shouldMarkNpcDead(npc, nextHealth) {
  return npc.alive !== false &&
    npc.age >= WORLD_PEOPLE_LIFECYCLE_CONFIG.fragileAge &&
    nextHealth <= WORLD_PEOPLE_LIFECYCLE_CONFIG.deathHealthThreshold;
}

function chooseMigrationCity(npc, context) {
  if (context.cityIds.length < 2) return "";
  const current = npc.currentCityId || npc.homeCityId || "";
  const candidates = context.cityIds.filter((cityId) => cityId !== current);
  if (!candidates.length) return "";
  return candidates[deterministicScore(npc, context, "migration") % candidates.length] || "";
}

function updateNpcLifecycle(people, context, result) {
  const aliveNpcs = people.npcs.filter((npc) => npc.alive !== false);
  const selected = pickRows(
    aliveNpcs,
    WORLD_PEOPLE_LIFECYCLE_CONFIG.maxNpcChangesPerStep,
    context,
    "npc_lifecycle",
    (npc) => {
      if (npc.health <= WORLD_PEOPLE_LIFECYCLE_CONFIG.deathHealthThreshold) return 3;
      if (npc.health <= WORLD_PEOPLE_LIFECYCLE_CONFIG.lowHealthThreshold) return 2;
      return npc.age >= WORLD_PEOPLE_LIFECYCLE_CONFIG.elderAge ? 1 : 0;
    }
  );

  for (const npc of selected) {
    const changedFields = [];
    const ageNext = context.isAnnual ? clampNumber(npc.age + 1, 0, 120, npc.age) : npc.age;
    setField(npc, "age", ageNext, changedFields);

    const healthNext = clampMetric(npc.health + calculateNpcHealthDelta(npc, context), npc.health);
    if (shouldMarkNpcDead(npc, healthNext)) {
      setField(npc, "alive", false, changedFields);
      setField(npc, "health", 0, changedFields);
      setField(npc, "currentGoal", "身后家产、人情与族内丧礼由家族料理。", changedFields);
      setField(npc, "publicSummary", `${npc.name}已故，丧葬、家产与人情只保留公开记载。`, changedFields);
    } else {
      setField(npc, "health", healthNext, changedFields);
    }

    const cashDelta = calculateNpcCashDelta(npc, context);
    setField(npc, "wealthCash", clampNumber(npc.wealthCash + cashDelta, 0, 10000000, npc.wealthCash), changedFields);
    if (cashDelta < 0 && npc.wealthCash < WORLD_PEOPLE_LIFECYCLE_CONFIG.debtPressureCashGap) {
      setField(
        npc,
        "debts",
        clampNumber(npc.debts + Math.min(WORLD_PEOPLE_LIFECYCLE_CONFIG.maxNpcDebtDelta, Math.abs(cashDelta) + 1), 0, 10000000, npc.debts),
        changedFields
      );
    } else if (cashDelta > 2 && npc.debts > 0) {
      setField(npc, "debts", Math.max(0, npc.debts - Math.ceil(cashDelta / 2)), changedFields);
    }

    if (context.isAnnual && npc.alive !== false) {
      const reputationDelta = npc.debts > npc.wealthCash + WORLD_PEOPLE_LIFECYCLE_CONFIG.debtPressureCashGap
        ? -1
        : (npc.health >= 60 && context.publicOrder >= WORLD_PEOPLE_LIFECYCLE_CONFIG.stablePublicOrderThreshold ? 1 : 0);
      if (reputationDelta !== 0) {
        setField(npc, "reputation", clampMetric(npc.reputation + reputationDelta, npc.reputation), changedFields);
      }
    }

    if (context.forceMigration || context.publicOrder <= WORLD_PEOPLE_LIFECYCLE_CONFIG.crisisPublicOrderThreshold) {
      const nextCityId = chooseMigrationCity(npc, context);
      if (nextCityId) setField(npc, "currentCityId", nextCityId, changedFields);
    }

    if (/官员|军官|胥吏|御史|知县|知府|侍郎|尚书/.test(npc.rankLabel || "")) {
      const baseRank = stripLifecycleRankSuffix(npc.rankLabel);
      let status = "";
      if (npc.impeachmentRisk >= 60 || npc.legalRisk >= 60) status = "候勘";
      else if (npc.reputation >= 70 && npc.health >= 55) status = "考成向上";
      else if (context.corruption >= WORLD_PEOPLE_LIFECYCLE_CONFIG.highCorruptionThreshold) status = "差遣转紧";
      if (status) setField(npc, "rankLabel", `${baseRank}（${status}）`, changedFields);
    }

    if (changedFields.length) {
      npc.lastUpdatedTurn = context.turn;
      markChanged(result, "npcs", npc, changedFields, `人物演化：${npc.name}的健康、财计、迁居或履历有新记录。`);
    }
  }
}

function rowMap(rows) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [row.id, row]));
}

function updateEstateLifecycle(people, context, result) {
  const selected = pickRows(
    people.estates,
    WORLD_PEOPLE_LIFECYCLE_CONFIG.maxEstateChangesPerStep,
    context,
    "estate_lifecycle",
    (estate) => estate.disputeRisk + Math.max(0, estate.taxBurden - 50)
  );

  for (const estate of selected) {
    const changedFields = [];
    const harvestDelta = context.isHarvestMonth ? Math.round((estate.landMu || 0) / 45) : -Math.round((estate.taxBurden || 0) / 40);
    const waterDelta = estate.waterworks < WORLD_PEOPLE_LIFECYCLE_CONFIG.lowWaterworksThreshold ? -3 : 1;
    const rentDelta = clampNumber(
      harvestDelta + waterDelta,
      -WORLD_PEOPLE_LIFECYCLE_CONFIG.maxEstateRentDelta,
      WORLD_PEOPLE_LIFECYCLE_CONFIG.maxEstateRentDelta,
      0
    );
    setField(
      estate,
      "rentGrainEstimate",
      clampNumber(estate.rentGrainEstimate + rentDelta, 0, 10000000, estate.rentGrainEstimate),
      changedFields
    );

    const riskDelta =
      (context.publicOrder < WORLD_PEOPLE_LIFECYCLE_CONFIG.lowPublicOrderThreshold ? 4 : 0) +
      (estate.taxBurden >= WORLD_PEOPLE_LIFECYCLE_CONFIG.highTaxBurdenThreshold ? 3 : 0) +
      (estate.waterworks < WORLD_PEOPLE_LIFECYCLE_CONFIG.lowWaterworksThreshold ? 2 : -1);
    const disputeRisk = clampMetric(estate.disputeRisk + riskDelta, estate.disputeRisk);
    setField(estate, "disputeRisk", disputeRisk, changedFields);
    if (disputeRisk >= WORLD_PEOPLE_LIFECYCLE_CONFIG.estateSeriousDisputeRiskThreshold) {
      setField(estate, "status", "disputed", changedFields);
      setField(estate, "statusLabel", "佃争待断", changedFields);
    } else if (disputeRisk >= WORLD_PEOPLE_LIFECYCLE_CONFIG.estateDisputeRiskThreshold) {
      setField(estate, "status", "disputed", changedFields);
      setField(estate, "statusLabel", "界址有争", changedFields);
    } else if (estate.status === "disputed" && disputeRisk < WORLD_PEOPLE_LIFECYCLE_CONFIG.lowPublicOrderThreshold) {
      setField(estate, "status", "held", changedFields);
      setField(estate, "statusLabel", "暂归安稳", changedFields);
    }

    if (changedFields.length) {
      estate.lastUpdatedTurn = context.turn;
      estate.publicSummary = `${estate.name}本月租谷、税负和纠纷风险仅为公开估计。`;
      markChanged(result, "estates", estate, changedFields, `田产流动：${estate.name}的租谷或纠纷风险有新记录。`);
    }
  }
}

function updateAssetLifecycle(people, context, result) {
  const selected = pickRows(
    people.assets,
    WORLD_PEOPLE_LIFECYCLE_CONFIG.maxAssetChangesPerStep,
    context,
    "asset_lifecycle",
    (asset) => asset.debtValue + (asset.kind === "debt" ? 20 : 0)
  );

  for (const asset of selected) {
    const changedFields = [];
    const income = Math.max(0, Math.round((asset.annualIncomeEstimate || 0) / WORLD_PEOPLE_LIFECYCLE_CONFIG.monthlyIncomeDivisor));
    const stressLoss =
      (context.publicOrder < WORLD_PEOPLE_LIFECYCLE_CONFIG.lowPublicOrderThreshold ? 4 : 0) +
      (context.corruption >= WORLD_PEOPLE_LIFECYCLE_CONFIG.highCorruptionThreshold ? 3 : 0);
    const valueDelta = clampNumber(income - stressLoss - Math.round((asset.debtValue || 0) / 60), -50, 50, 0);
    setField(asset, "valueEstimate", clampNumber(asset.valueEstimate + valueDelta, 0, 10000000, asset.valueEstimate), changedFields);

    if (asset.kind === "debt" || context.publicOrder < WORLD_PEOPLE_LIFECYCLE_CONFIG.crisisPublicOrderThreshold) {
      setField(asset, "debtValue", clampNumber(asset.debtValue + Math.max(1, stressLoss), 0, 10000000, asset.debtValue), changedFields);
    } else if (valueDelta > 0 && asset.debtValue > 0) {
      setField(asset, "debtValue", Math.max(0, asset.debtValue - 1), changedFields);
    }

    const nextStatus = asset.debtValue > 0
      ? "账面有欠"
      : valueDelta < 0
        ? "营生承压"
        : "营生平稳";
    setField(asset, "statusLabel", nextStatus, changedFields);

    if (changedFields.length) {
      asset.lastUpdatedTurn = context.turn;
      asset.publicSummary = `${asset.name}只记录公开估值、收益和欠账估计。`;
      markChanged(result, "assets", asset, changedFields, `资产流动：${asset.name}的估值、收益或欠账有新记录。`);
    }
  }
}

function updateHouseholdLifecycle(people, context, result) {
  const npcs = rowMap(people.npcs);
  const assets = rowMap(people.assets);
  const estates = rowMap(people.estates);
  const selected = pickRows(
    people.households,
    WORLD_PEOPLE_LIFECYCLE_CONFIG.maxHouseholdChangesPerStep,
    context,
    "household_lifecycle",
    (household) => household.debtPressure + household.familyRisk
  );

  for (const household of selected) {
    const changedFields = [];
    const linkedAssets = (household.assetIds || []).map((id) => assets.get(id)).filter(Boolean);
    const linkedEstates = (household.estateIds || []).map((id) => estates.get(id)).filter(Boolean);
    const members = (household.memberNpcIds || []).map((id) => npcs.get(id)).filter(Boolean);
    const debtRisk = linkedAssets.reduce((sum, asset) => sum + Math.min(20, Math.round((asset.debtValue || 0) / 20)), 0);
    const estateRisk = linkedEstates.reduce((sum, estate) => sum + Math.round((estate.disputeRisk || 0) / 20), 0);
    const funeralRisk = members.some((npc) => npc.alive === false && npc.lastUpdatedTurn === context.turn) ? 8 : 0;
    const lowHealthRisk = members.filter((npc) => npc.health <= WORLD_PEOPLE_LIFECYCLE_CONFIG.lowHealthThreshold).length;
    const wealthDelta = Math.round((linkedAssets.length + linkedEstates.length) / 2) -
      Math.round((household.debtPressure + debtRisk) / 40);

    setField(household, "wealthScore", clampMetric(household.wealthScore + wealthDelta, household.wealthScore), changedFields);
    setField(
      household,
      "debtPressure",
      clampMetric(household.debtPressure + Math.round(debtRisk / 4) + (context.publicOrder < 45 ? 1 : -1), household.debtPressure),
      changedFields
    );
    setField(
      household,
      "familyRisk",
      clampMetric(household.familyRisk + estateRisk + funeralRisk + lowHealthRisk - (context.publicOrder >= 70 ? 1 : 0), household.familyRisk),
      changedFields
    );

    if (household.familyRisk >= WORLD_PEOPLE_LIFECYCLE_CONFIG.householdHighFamilyRisk) {
      setField(household, "politicalAlignment", "族内事务牵动地方公议", changedFields);
    }

    if (changedFields.length) {
      household.lastUpdatedTurn = context.turn;
      household.publicSummary = `${household.familyName}本月族望、债压和家产风险为公开估计。`;
      markChanged(result, "households", household, changedFields, `家族演化：${household.familyName}的家声、债压或族内风险有新记录。`);
    }
  }
}

function rowTouched(row, changedIds) {
  return changedIds.has(`${row.sourceType}:${row.sourceId}`) ||
    changedIds.has(`${row.targetType}:${row.targetId}`);
}

function npcForEndpoint(npcs, type, id) {
  return type === "npc" ? npcs.get(id) : null;
}

function updateRelationshipLifecycle(people, context, result) {
  const changedIds = new Set(result.peopleChanges.flatMap((change) => [
    `${change.collection.replace(/s$/, "")}:${change.rowId}`,
    `${change.collection}:${change.rowId}`
  ]));
  const npcRows = rowMap(people.npcs);
  const selected = pickRows(
    people.relationships,
    WORLD_PEOPLE_LIFECYCLE_CONFIG.maxRelationshipChangesPerStep,
    context,
    "relationship_lifecycle",
    (relationship) => (rowTouched(relationship, changedIds) ? 50 : 0) + Math.abs(relationship.obligation || 0) + (relationship.resentment || 0)
  );

  for (const relationship of selected) {
    const changedFields = [];
    const sourceNpc = npcForEndpoint(npcRows, relationship.sourceType, relationship.sourceId);
    const targetNpc = npcForEndpoint(npcRows, relationship.targetType, relationship.targetId);
    const endpointNpcs = [sourceNpc, targetNpc].filter(Boolean);
    const hasRecentFuneral = endpointNpcs.some((npc) => npc.alive === false && npc.lastUpdatedTurn === context.turn);
    const patronagePower = Math.max(...endpointNpcs.map((npc) => npc.patronagePower || 0), 0);
    const resentmentRisk = Math.max(...endpointNpcs.map((npc) => npc.resentmentRisk || 0), 0);

    if (relationship.obligation !== 0) {
      const nextObligation = relationship.obligation > 0
        ? relationship.obligation - WORLD_PEOPLE_LIFECYCLE_CONFIG.relationshipObligationDecay
        : relationship.obligation + WORLD_PEOPLE_LIFECYCLE_CONFIG.relationshipObligationDecay;
      setField(relationship, "obligation", clampSignedMetric(nextObligation, relationship.obligation), changedFields);
    }

    if (
      patronagePower >= WORLD_PEOPLE_LIFECYCLE_CONFIG.patronagePowerThreshold &&
      relationship.relationship >= WORLD_PEOPLE_LIFECYCLE_CONFIG.strongRelationshipThreshold
    ) {
      setField(relationship, "patronage", clampSignedMetric(relationship.patronage + 1, relationship.patronage), changedFields);
      setField(relationship, "trust", clampMetric(relationship.trust + 1, relationship.trust), changedFields);
    }

    if (resentmentRisk >= WORLD_PEOPLE_LIFECYCLE_CONFIG.resentmentRiskThreshold || hasRecentFuneral) {
      setField(relationship, "resentment", clampMetric(relationship.resentment + (hasRecentFuneral ? 2 : 1), relationship.resentment), changedFields);
      setField(relationship, "trust", clampMetric(relationship.trust - 1, relationship.trust), changedFields);
    }

    if (changedFields.length) {
      if (addRelationshipNote(relationship, "S62.2月度人情账：恩义、怨望与庇护关系由服务器公开估计。")) {
        changedFields.push("recentNotes");
      }
      relationship.lastUpdatedTurn = context.turn;
      relationship.publicSummary = "本条关系的恩义、怨望与庇护只记录公开估计。";
      markChanged(result, "relationships", relationship, changedFields, "人情演化：一条关系的恩义、怨望或庇护有新记录。");
    }
  }
}

function hasSpouse(npc) {
  return Array.isArray(npc.family?.spouseIds) && npc.family.spouseIds.length > 0;
}

function marriageCandidate(npc) {
  return npc.alive !== false &&
    !hasSpouse(npc) &&
    npc.age >= WORLD_PEOPLE_LIFECYCLE_CONFIG.minMarriageAge &&
    npc.age <= WORLD_PEOPLE_LIFECYCLE_CONFIG.maxMarriageAge &&
    npc.householdId;
}

function relationshipExists(relationships, firstId, secondId) {
  return relationships.some((relationship) =>
    relationship.sourceType === "npc" &&
    relationship.targetType === "npc" &&
    (
      (relationship.sourceId === firstId && relationship.targetId === secondId) ||
      (relationship.sourceId === secondId && relationship.targetId === firstId)
    )
  );
}

function updateMarriageLifecycle(people, context, result) {
  if (!context.forceMarriage && !context.isAnnual) return;
  const candidates = pickRows(
    people.npcs.filter(marriageCandidate),
    WORLD_PEOPLE_LIFECYCLE_CONFIG.maxMarriagePairsPerStep * 4,
    context,
    "marriage_lifecycle",
    (npc) => npc.peerNetwork + npc.reputation
  );
  const households = rowMap(people.households);
  let pairs = 0;

  for (const first of candidates) {
    if (pairs >= WORLD_PEOPLE_LIFECYCLE_CONFIG.maxMarriagePairsPerStep || hasSpouse(first)) break;
    const second = candidates.find((candidate) =>
      candidate.id !== first.id &&
      !hasSpouse(candidate) &&
      candidate.householdId &&
      candidate.householdId !== first.householdId
    );
    if (!second) continue;

    const tag = `${first.name}-${second.name}婚姻公开记`;
    const firstFields = [];
    const secondFields = [];
    setNestedField(first, "family", "spouseIds", uniqueIds([...(first.family?.spouseIds || []), second.id]), firstFields);
    setNestedField(second, "family", "spouseIds", uniqueIds([...(second.family?.spouseIds || []), first.id]), secondFields);
    setNestedField(first, "family", "marriageAllianceTags", uniqueIds([...(first.family?.marriageAllianceTags || []), tag]), firstFields);
    setNestedField(second, "family", "marriageAllianceTags", uniqueIds([...(second.family?.marriageAllianceTags || []), tag]), secondFields);

    first.lastUpdatedTurn = context.turn;
    second.lastUpdatedTurn = context.turn;
    markChanged(result, "npcs", first, firstFields, `婚姻演化：${first.name}有公开婚姻谱系新记录。`);
    markChanged(result, "npcs", second, secondFields, `婚姻演化：${second.name}有公开婚姻谱系新记录。`);

    for (const householdId of [first.householdId, second.householdId]) {
      const household = households.get(householdId);
      if (!household) continue;
      const fields = [];
      setField(household, "marriageNetworkScore", clampMetric(household.marriageNetworkScore + 4, household.marriageNetworkScore), fields);
      household.lastUpdatedTurn = context.turn;
      markChanged(result, "households", household, fields, `姻亲演化：${household.familyName}有公开婚姻网络新记录。`);
    }

    if (!relationshipExists(people.relationships, first.id, second.id)) {
      people.relationships.push({
        id: `rel-marriage-${first.id}-${second.id}`,
        sourceType: "npc",
        sourceId: first.id,
        targetType: "npc",
        targetId: second.id,
        relationship: 56,
        trust: 58,
        resentment: 0,
        obligation: 18,
        patronage: 0,
        fear: 0,
        rivalry: 0,
        stance: "婚姻",
        recentIntent: "维系两家公开姻亲。",
        recentNotes: ["S62.2婚姻谱系公开摘要"],
        visibility: "public",
        knownToPlayer: true,
        intelConfidence: 70,
        publicSummary: `${first.name}与${second.name}有公开婚姻关系；密约不进入本投影。`,
        lastUpdatedTurn: context.turn
      });
    }

    pairs += 1;
  }
}

function buildPublicEvents(result, context) {
  return result.peopleChanges
    .slice(0, WORLD_PEOPLE_LIFECYCLE_CONFIG.maxPublicEventsPerStep)
    .map((change) => `[人物演化] ${context.year}年${context.month}月：${change.summary}`);
}

function finalizeResult(result, context) {
  result.applied = result.peopleChanges.length > 0;
  result.events = buildPublicEvents(result, context);
  result.summary = result.events.length
    ? cleanText(result.events.join(" "), "人物生命周期已有公开记录。", 260)
    : "";
  return result;
}

function shouldRunLifecycle(options = {}) {
  return options.force === true ||
    options.isMonthEnd === true ||
    options.worldTick?.completedMonth === true;
}

function runWorldPeopleLifecycleStep(worldState = {}, options = {}) {
  const result = emptyResult();
  if (!isPlainObject(worldState) || !shouldRunLifecycle(options)) return result;

  const context = createContext(worldState, options);
  const people = clone(normalizeWorldPeopleState(worldState));

  updateNpcLifecycle(people, context, result);
  updateEstateLifecycle(people, context, result);
  updateAssetLifecycle(people, context, result);
  updateHouseholdLifecycle(people, context, result);
  updateMarriageLifecycle(people, context, result);
  updateRelationshipLifecycle(people, context, result);

  if (result.peopleChanges.length) {
    worldState.worldPeople = normalizeWorldPeopleSchemaBundle({
      ...people,
      generatedAtTurn: context.turn
    }, worldState);
    worldState.worldPeople = normalizeWorldPeopleState(worldState);
  }

  return finalizeResult(result, context);
}

module.exports = {
  runWorldPeopleLifecycleStep
};
