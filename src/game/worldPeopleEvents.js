const { randomUUID } = require("node:crypto");

const { createAuditEvent } = require("./audit");
const { normalizeRelationshipLedger } = require("./relationships");
const { normalizeWorldPeopleState } = require("./worldPeople");
const { normalizeWorldPeopleSchemaBundle } = require("./worldPeopleSchemas");

const MAX_PEOPLE_EVENTS_PER_TURN = 8;
const MAX_LABEL_LENGTH = 80;
const MAX_SUMMARY_LENGTH = 180;

const SENSITIVE_EVENT_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|relationshipLedger|worldPeople|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|event_log|ai_change_proposals|sqlite|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

const COLLECTION_LABELS = {
  npcs: "人物",
  households: "家族",
  assets: "资产",
  estates: "田产",
  relationships: "关系"
};

const ROW_TYPE_TO_COLLECTION = {
  npc: "npcs",
  household: "households",
  asset: "assets",
  estate: "estates",
  relationship: "relationships"
};

const PEOPLE_TABLE_TO_COLLECTION = {
  people_npcs: "npcs",
  people_households: "households",
  people_assets: "assets",
  people_estates: "estates",
  people_relationships: "relationships"
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampText(value, fallback = "", maxLength = MAX_SUMMARY_LENGTH) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || SENSITIVE_EVENT_TEXT_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function cleanId(value) {
  const text = clampText(value, "", 96);
  return /^[a-z0-9][a-z0-9_-]*$/i.test(text) ? text : "";
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function collectionFor(value) {
  if (COLLECTION_LABELS[value]) return value;
  if (ROW_TYPE_TO_COLLECTION[value]) return ROW_TYPE_TO_COLLECTION[value];
  if (PEOPLE_TABLE_TO_COLLECTION[value]) return PEOPLE_TABLE_TO_COLLECTION[value];
  return "";
}

function normalizePeopleBundle(input, worldState = {}) {
  if (isPlainObject(input)) {
    return normalizeWorldPeopleSchemaBundle(input, worldState);
  }
  return normalizeWorldPeopleState(worldState);
}

function snapshotWorldPeopleForEvents(worldState = {}) {
  return normalizeWorldPeopleState(worldState);
}

function mapRows(rows) {
  const mapped = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.id) mapped.set(row.id, row);
  }
  return mapped;
}

function buildLabelIndexes(people, worldState = {}) {
  const labels = {
    player: new Map(),
    npc: new Map(),
    household: new Map(),
    asset: new Map(),
    estate: new Map(),
    faction: new Map()
  };

  labels.player.set(cleanId(worldState.player?.id) || "P1", clampText(worldState.player?.name, "玩家", MAX_LABEL_LENGTH));
  labels.player.set("P1", clampText(worldState.player?.name, "玩家", MAX_LABEL_LENGTH));

  for (const npc of people.npcs || []) labels.npc.set(npc.id, clampText(npc.name, "可见人物", MAX_LABEL_LENGTH));
  for (const household of people.households || []) {
    labels.household.set(household.id, clampText(`${household.familyName}氏`, "可见家族", MAX_LABEL_LENGTH));
  }
  for (const asset of people.assets || []) labels.asset.set(asset.id, clampText(asset.name, "可见资产", MAX_LABEL_LENGTH));
  for (const estate of people.estates || []) labels.estate.set(estate.id, clampText(estate.name, "可见田产", MAX_LABEL_LENGTH));

  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  for (const faction of Object.values(ledger.factions || {})) {
    if (faction.visible === false) continue;
    labels.faction.set(faction.id, clampText(faction.name, "可见派系", MAX_LABEL_LENGTH));
  }

  return labels;
}

function labelForEndpoint(labels, type, id) {
  const normalizedType = type === "character" ? "npc" : type;
  return labels[normalizedType]?.get(id) || clampText(id, "可见对象", MAX_LABEL_LENGTH);
}

function metricDiff(before = {}, after = {}, fields = []) {
  const changes = {};
  for (const field of fields) {
    const beforeValue = toNumber(before[field]);
    const afterValue = toNumber(after[field]);
    if (beforeValue === null && afterValue === null) continue;
    if (beforeValue === afterValue) continue;
    changes[field] = {
      before: beforeValue,
      after: afterValue,
      delta: beforeValue === null || afterValue === null ? null : afterValue - beforeValue
    };
  }
  return changes;
}

function textDiff(before = {}, after = {}, fields = []) {
  const changes = {};
  for (const field of fields) {
    const beforeText = clampText(before[field], "", MAX_LABEL_LENGTH);
    const afterText = clampText(after[field], "", MAX_LABEL_LENGTH);
    if (beforeText === afterText) continue;
    changes[field] = { before: beforeText, after: afterText };
  }
  return changes;
}

function listDiff(before = [], after = []) {
  const beforeList = Array.isArray(before) ? before.map(cleanId).filter(Boolean) : [];
  const afterList = Array.isArray(after) ? after.map(cleanId).filter(Boolean) : [];
  if (JSON.stringify(beforeList) === JSON.stringify(afterList)) return null;
  return { before: beforeList, after: afterList };
}

function relationDirection(change) {
  const delta = change?.delta || 0;
  if (delta > 0) return "转暖";
  if (delta < 0) return "转冷";
  return "有新记录";
}

function resentmentDirection(change) {
  const delta = change?.delta || 0;
  if (delta > 0) return "怨望加深";
  if (delta < 0) return "怨望稍解";
  return "怨望未大变";
}

function relationshipEventType(row, activeRequestTargets) {
  const endpointKeys = [
    `${row.sourceType}:${row.sourceId}`,
    `${row.targetType}:${row.targetId}`
  ];
  for (const key of endpointKeys) {
    const outcome = activeRequestTargets.get(key);
    if (outcome === "expired") return "active_request_expired";
    if (outcome === "resolved") return "active_request_resolved";
  }
  return "relationship_changed";
}

function relationshipSummary(row, changes, labels, eventType) {
  const source = labelForEndpoint(labels, row.sourceType, row.sourceId);
  const target = labelForEndpoint(labels, row.targetType, row.targetId);
  const primary = row.sourceType === "player" ? target : source;
  const relation = relationDirection(changes.metrics.relationship);
  const resentment = resentmentDirection(changes.metrics.resentment);

  if (eventType === "active_request_expired") {
    return clampText(`人物请托结果：${primary}的请托逾期未决，关系${relation}，${resentment}。`);
  }
  if (eventType === "active_request_resolved") {
    return clampText(`人物请托结果：${primary}的请托已有回音，关系${relation}，${resentment}。`);
  }
  return clampText(`人物关系更新：${source}与${target}的往来${relation}，${resentment}。`);
}

function makeEvent(worldState, fields) {
  const eventId = `people-${randomUUID()}`;
  const summary = clampText(fields.summary, "人物事件已由服务器记录。");
  const auditEvent = createAuditEvent(worldState, {
    eventId,
    sourceSystem: "world_people",
    eventType: fields.eventType,
    visibility: "public",
    summary,
    related: {
      peopleEventKind: fields.kind,
      rowKind: fields.rowKind,
      rowId: fields.rowId,
      labels: fields.labels || [],
      rowLinks: fields.linkedRows || []
    },
    appliedChanges: fields.appliedChanges || {}
  });

  return {
    eventId,
    eventHistoryEntry: `[人物事件] ${summary}`,
    auditEvent,
    rowEventLinks: fields.rowEventLinks || []
  };
}

function makeRowLink(collection, rowId, eventId) {
  const normalizedCollection = collectionFor(collection);
  const normalizedRowId = cleanId(rowId);
  if (!normalizedCollection || !normalizedRowId || !eventId) return null;
  return {
    collection: normalizedCollection,
    rowId: normalizedRowId,
    eventId
  };
}

function addLinkedEvent(events, worldState, fields) {
  if (events.length >= MAX_PEOPLE_EVENTS_PER_TURN) return;
  const linkedRows = [
    makeRowLink(fields.rowKind, fields.rowId, "pending"),
    ...(fields.rowEventLinks || []).map((link) => makeRowLink(link.collection || link.rowKind, link.rowId, "pending"))
  ].filter(Boolean);
  const event = makeEvent(worldState, {
    ...fields,
    linkedRows: linkedRows.map(({ collection, rowId }) => ({ collection, rowId }))
  });
  event.rowEventLinks = linkedRows.map(({ collection, rowId }) => ({
    collection,
    rowId,
    eventId: event.eventId
  }));
  events.push(event);
}

function collectActiveRequestTargets(activeNpcRequest = {}) {
  const targets = new Map();
  const outcome = activeNpcRequest.expired
    ? "expired"
    : activeNpcRequest.resolved
      ? "resolved"
      : "";
  if (!outcome) return targets;

  for (const change of Array.isArray(activeNpcRequest.relationshipChanges) ? activeNpcRequest.relationshipChanges : []) {
    const targetType = change.targetType === "character" ? "npc" : change.targetType;
    const targetId = cleanId(change.targetId);
    if (targetType && targetId) targets.set(`${targetType}:${targetId}`, outcome);
  }
  return targets;
}

function collectRelationshipEvents(events, worldState, previous, current, options, labels) {
  const beforeMap = mapRows(previous.relationships);
  const activeTargets = collectActiveRequestTargets(options.activeNpcRequest);

  for (const row of current.relationships || []) {
    const before = beforeMap.get(row.id);
    if (!before) continue;
    const metrics = metricDiff(before, row, [
      "relationship",
      "trust",
      "resentment",
      "obligation",
      "patronage",
      "fear",
      "rivalry"
    ]);
    const textChanges = textDiff(before, row, ["stance"]);
    if (!Object.keys(metrics).length && !Object.keys(textChanges).length) continue;

    const eventType = relationshipEventType(row, activeTargets);
    const summary = relationshipSummary(row, { metrics, textChanges }, labels, eventType);
    const rowEventLinks = [];
    if (row.sourceType === "npc") rowEventLinks.push({ collection: "npcs", rowId: row.sourceId });
    if (row.targetType === "npc") rowEventLinks.push({ collection: "npcs", rowId: row.targetId });

    addLinkedEvent(events, worldState, {
      kind: eventType,
      rowKind: "relationships",
      rowId: row.id,
      eventType,
      summary,
      labels: [
        labelForEndpoint(labels, row.sourceType, row.sourceId),
        labelForEndpoint(labels, row.targetType, row.targetId)
      ].filter(Boolean),
      appliedChanges: {
        metrics,
        textFields: textChanges
      },
      rowEventLinks
    });
  }
}

function collectNpcEvents(events, worldState, previous, current, labels) {
  const beforeMap = mapRows(previous.npcs);
  for (const row of current.npcs || []) {
    const before = beforeMap.get(row.id);
    if (!before) continue;

    const metrics = metricDiff(before, row, [
      "wealthCash",
      "landMu",
      "debts",
      "annualIncomeEstimate",
      "health",
      "legalRisk",
      "impeachmentRisk"
    ]);
    const textFields = textDiff(before, row, [
      "currentCityId",
      "householdId",
      "currentOfficeId",
      "currentPostingId",
      "rankLabel",
      "bureauId",
      "factionId"
    ]);
    const family = {
      fatherId: textDiff(before.family || {}, row.family || {}, ["fatherId"]).fatherId,
      motherId: textDiff(before.family || {}, row.family || {}, ["motherId"]).motherId,
      spouseIds: listDiff(before.family?.spouseIds, row.family?.spouseIds),
      childrenIds: listDiff(before.family?.childrenIds, row.family?.childrenIds),
      marriageAllianceTags: listDiff(before.family?.marriageAllianceTags, row.family?.marriageAllianceTags)
    };
    const familyChanges = Object.fromEntries(Object.entries(family).filter(([, value]) => Boolean(value)));
    const assetIds = listDiff(before.assetIds, row.assetIds);
    const estateIds = listDiff(before.estateIds, row.estateIds);
    const aliveChanged = before.alive !== row.alive ? { before: Boolean(before.alive), after: Boolean(row.alive) } : null;

    if (
      !Object.keys(metrics).length &&
      !Object.keys(textFields).length &&
      !Object.keys(familyChanges).length &&
      !assetIds &&
      !estateIds &&
      !aliveChanged
    ) {
      continue;
    }

    const categories = [];
    if (aliveChanged) categories.push(row.alive ? "生死状态" : "身故");
    if (textFields.currentCityId) categories.push("迁居");
    if (textFields.currentOfficeId || textFields.currentPostingId || textFields.rankLabel) categories.push("官职履历");
    if (Object.keys(metrics).some((field) => ["wealthCash", "landMu", "debts", "annualIncomeEstimate"].includes(field))) {
      categories.push("财产估计");
    }
    if (assetIds || estateIds) categories.push("家产引用");
    if (Object.keys(familyChanges).length) categories.push("家族谱系");
    if (!categories.length) categories.push("人物履历");

    const name = labelForEndpoint(labels, "npc", row.id);
    addLinkedEvent(events, worldState, {
      kind: "npc_lifecycle_changed",
      rowKind: "npcs",
      rowId: row.id,
      eventType: "npc_lifecycle_changed",
      summary: clampText(`人物履历更新：${name}的${categories.slice(0, 3).join("、")}有新记录。`),
      labels: [name],
      appliedChanges: {
        metrics,
        textFields,
        family: familyChanges,
        assetIds,
        estateIds,
        alive: aliveChanged
      }
    });
  }
}

function collectHouseholdEvents(events, worldState, previous, current, labels) {
  const beforeMap = mapRows(previous.households);
  for (const row of current.households || []) {
    const before = beforeMap.get(row.id);
    if (!before) continue;
    const metrics = metricDiff(before, row, [
      "wealthScore",
      "landMu",
      "prestige",
      "marriageNetworkScore",
      "debtPressure",
      "familyRisk"
    ]);
    const textFields = textDiff(before, row, ["seatCityId", "gentryRank", "politicalAlignment"]);
    const memberNpcIds = listDiff(before.memberNpcIds, row.memberNpcIds);
    const assetIds = listDiff(before.assetIds, row.assetIds);
    const estateIds = listDiff(before.estateIds, row.estateIds);
    if (!Object.keys(metrics).length && !Object.keys(textFields).length && !memberNpcIds && !assetIds && !estateIds) {
      continue;
    }

    const name = labelForEndpoint(labels, "household", row.id);
    addLinkedEvent(events, worldState, {
      kind: "household_changed",
      rowKind: "households",
      rowId: row.id,
      eventType: "household_changed",
      summary: clampText(`家族记录更新：${name}的家声、财力或成员有新记录。`),
      labels: [name],
      appliedChanges: { metrics, textFields, memberNpcIds, assetIds, estateIds }
    });
  }
}

function collectAssetEvents(events, worldState, previous, current, labels) {
  const beforeMap = mapRows(previous.assets);
  for (const row of current.assets || []) {
    const before = beforeMap.get(row.id);
    if (!before) continue;
    const metrics = metricDiff(before, row, ["valueEstimate", "annualIncomeEstimate", "debtValue"]);
    const textFields = textDiff(before, row, ["ownerType", "ownerId", "cityId", "statusLabel"]);
    if (!Object.keys(metrics).length && !Object.keys(textFields).length) continue;

    const name = labelForEndpoint(labels, "asset", row.id);
    addLinkedEvent(events, worldState, {
      kind: "asset_changed",
      rowKind: "assets",
      rowId: row.id,
      eventType: "people_asset_changed",
      summary: clampText(`资产记录更新：${name}的归属、状态或估值有新记录。`),
      labels: [name],
      appliedChanges: { metrics, textFields }
    });
  }
}

function collectEstateEvents(events, worldState, previous, current, labels) {
  const beforeMap = mapRows(previous.estates);
  for (const row of current.estates || []) {
    const before = beforeMap.get(row.id);
    if (!before) continue;
    const metrics = metricDiff(before, row, [
      "landMu",
      "tenantHouseholds",
      "rentGrainEstimate",
      "taxBurden",
      "waterworks",
      "disputeRisk"
    ]);
    const textFields = textDiff(before, row, ["ownerType", "ownerId", "cityId", "regionId", "status", "statusLabel"]);
    if (!Object.keys(metrics).length && !Object.keys(textFields).length) continue;

    const name = labelForEndpoint(labels, "estate", row.id);
    addLinkedEvent(events, worldState, {
      kind: "estate_changed",
      rowKind: "estates",
      rowId: row.id,
      eventType: "people_estate_changed",
      summary: clampText(`田产记录更新：${name}的归属、状态或纠纷风险有新记录。`),
      labels: [name],
      appliedChanges: { metrics, textFields }
    });
  }
}

function buildWorldPeopleEventBatch(worldState = {}, options = {}) {
  const previous = normalizePeopleBundle(options.previousPeople, worldState);
  const current = normalizePeopleBundle(options.currentPeople || normalizeWorldPeopleState(worldState), worldState);
  const labels = buildLabelIndexes(current, worldState);
  const events = [];

  collectRelationshipEvents(events, worldState, previous, current, options, labels);
  collectNpcEvents(events, worldState, previous, current, labels);
  collectHouseholdEvents(events, worldState, previous, current, labels);
  collectAssetEvents(events, worldState, previous, current, labels);
  collectEstateEvents(events, worldState, previous, current, labels);

  return {
    events: events.map((event) => event.eventHistoryEntry),
    auditEvents: events.map((event) => event.auditEvent),
    rowEventLinks: events.flatMap((event) => event.rowEventLinks)
  };
}

function appendPeopleEventLinks(context, links = []) {
  if (!context || !Array.isArray(links)) return;
  for (const link of links) {
    if (!link) continue;
    if (typeof context.appendPeopleEventLink === "function") {
      context.appendPeopleEventLink(link);
    } else {
      context.peopleEventLinks ||= [];
      context.peopleEventLinks.push(link);
    }
  }
}

module.exports = {
  buildWorldPeopleEventBatch,
  snapshotWorldPeopleForEvents,
  appendPeopleEventLinks
};
