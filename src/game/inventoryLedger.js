const {
  CONTAINER_DEFINITIONS,
  INVENTORY_LEDGER_CONFIG,
  INVENTORY_LEDGER_SCHEMA_VERSION,
  ITEM_TEMPLATES
} = require("./inventoryLedgerConfig");

const SECRET_LIKE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|hiddenDossier|raw[_ -]?(?:table|ledger|audit|state)|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|ai_change_proposals|event_log|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|[A-Za-z]:\\[^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = INVENTORY_LEDGER_CONFIG.textLimit) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || SECRET_LIKE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function uniqueCleanTexts(values = [], limit = 8) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, "", 80);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function itemTemplate(templateId) {
  return ITEM_TEMPLATES[templateId] || null;
}

function normalizeContainer(container = {}, fallbackOwnerActorId = "player") {
  const type = cleanId(container.type, "");
  const definition = CONTAINER_DEFINITIONS[type];
  if (!definition) return null;
  const ownerActorId = cleanId(container.ownerActorId, fallbackOwnerActorId);
  const containerId = cleanId(container.containerId, `container:${ownerActorId}:${type}`);
  return {
    containerId,
    type,
    label: cleanText(container.label, definition.label, 80),
    ownerActorId,
    custodianActorId: cleanId(container.custodianActorId, ownerActorId),
    locationRef: cleanText(container.locationRef, type === "personal" ? "actor:player" : "home:player", 80),
    capacityWeight: clampNumber(container.capacityWeight, 1, 100000, definition.defaultCapacityWeight),
    visibility: INVENTORY_LEDGER_CONFIG.visibilityLevels.includes(container.visibility)
      ? container.visibility
      : definition.defaultVisibility,
    locked: Boolean(container.locked),
    ownerPolicy: definition.ownerPolicy
  };
}

function createItemFromTemplate(templateId, overrides = {}) {
  const template = itemTemplate(templateId);
  if (!template) {
    return {
      accepted: false,
      reason: "unknown_item_template",
      item: null
    };
  }
  const ownerActorId = cleanId(overrides.ownerActorId, "player");
  const itemId = cleanId(overrides.itemId, `item:${ownerActorId}:${templateId}:1`);
  const quantity = clampNumber(overrides.quantity, 1, template.stackLimit, 1);
  const durability = clampNumber(overrides.durability, 0, 100, 100);
  return {
    accepted: true,
    item: {
      itemId,
      templateId,
      name: cleanText(overrides.name, template.name, 80),
      category: template.category,
      subtype: template.subtype,
      ownerActorId,
      custodianActorId: cleanId(overrides.custodianActorId, ownerActorId),
      containerId: cleanId(overrides.containerId, `container:${ownerActorId}:personal`),
      locationRef: cleanText(overrides.locationRef, "", 80),
      quantity,
      unit: template.unit,
      quality: clampNumber(overrides.quality, 0, 100, 50),
      rarity: cleanText(overrides.rarity, template.rarity, 32),
      durability,
      condition: cleanText(overrides.condition, durability > 40 ? "完好" : "破损", 40),
      legalStatus: template.legalStatus,
      transferPolicy: template.transferPolicy,
      effects: uniqueCleanTexts(overrides.effects || template.effects, 8),
      boundActorId: cleanId(overrides.boundActorId, template.transferPolicy === "bound_to_actor" ? ownerActorId : ""),
      boundOfficeRef: cleanText(overrides.boundOfficeRef, template.transferPolicy === "bound_to_office" ? "office:current" : "", 80),
      important: Boolean(overrides.important ?? template.important ?? template.credential),
      credential: Boolean(overrides.credential ?? template.credential),
      visibility: INVENTORY_LEDGER_CONFIG.visibilityLevels.includes(overrides.visibility)
        ? overrides.visibility
        : "player_visible",
      provenance: (Array.isArray(overrides.provenance) ? overrides.provenance : [])
        .map((entry, index) => ({
          ref: cleanText(entry?.ref, `item_provenance:${index + 1}`, 80),
          label: cleanText(entry?.label, "来源已记账", 80),
          turn: clampNumber(entry?.turn, 0, Number.MAX_SAFE_INTEGER, 0)
        }))
        .filter((entry) => entry.label)
        .slice(0, INVENTORY_LEDGER_CONFIG.maxProvenanceEntriesInView)
    }
  };
}

function normalizeItem(item = {}, fallbackOwnerActorId = "player") {
  const templateId = cleanId(item.templateId, "");
  const template = itemTemplate(templateId);
  if (!template) return null;
  const created = createItemFromTemplate(templateId, {
    ...item,
    ownerActorId: item.ownerActorId || fallbackOwnerActorId
  });
  return created.item;
}

function extractLedger(input = {}) {
  if (isPlainObject(input.inventoryLedger)) {
    return {
      ...input.inventoryLedger,
      ownerActorId: input.player?.actorId || input.inventoryLedger.ownerActorId || "player"
    };
  }
  return input;
}

function normalizeInventoryLedger(input = {}, options = {}) {
  const ledger = extractLedger(input);
  const ownerActorId = cleanId(options.ownerActorId || ledger.ownerActorId, "player");
  const containers = (Array.isArray(ledger.containers) ? ledger.containers : [])
    .map((container) => normalizeContainer(container, ownerActorId))
    .filter(Boolean);
  const knownContainers = new Set(containers.map((container) => container.containerId));
  const items = (Array.isArray(ledger.items) ? ledger.items : [])
    .map((item) => normalizeItem(item, ownerActorId))
    .filter((item) => item && knownContainers.has(item.containerId));
  return {
    schemaVersion: INVENTORY_LEDGER_SCHEMA_VERSION,
    ownerActorId,
    containers,
    items
  };
}

function createDefaultContainer(type, ownerActorId, overrides = {}) {
  return normalizeContainer({
    type,
    ownerActorId,
    containerId: `container:${ownerActorId}:${type}`,
    ...overrides
  }, ownerActorId);
}

function createDeterministicInitialInventoryLedger(options = {}) {
  const role = cleanId(options.role || options.player?.role, "scholar");
  const ownerActorId = cleanId(options.ownerActorId || options.playerActorId || options.player?.actorId, "player");
  const containers = [
    createDefaultContainer("personal", ownerActorId),
    createDefaultContainer("home_storage", ownerActorId)
  ];
  if (["official", "magistrate", "emperor"].includes(role)) {
    containers.push(createDefaultContainer("office_storage", ownerActorId, {
      locationRef: "office:current",
      visibility: "role_limited"
    }));
  }
  if (["general", "emperor"].includes(role)) {
    containers.push(createDefaultContainer("military_baggage", ownerActorId, {
      locationRef: "camp:current",
      visibility: "role_limited"
    }));
  }
  if (role === "emperor") {
    containers.push(createDefaultContainer("imperial_vault", ownerActorId, {
      locationRef: "palace:inner-vault",
      visibility: "role_limited"
    }));
  }

  const itemSpecs = [
    ["book_four_books", { itemId: `item:${ownerActorId}:book-four-books`, containerId: `container:${ownerActorId}:personal` }],
    ["silver_ingot", { itemId: `item:${ownerActorId}:silver-ingot`, quantity: 2, containerId: `container:${ownerActorId}:home_storage` }]
  ];
  if (["official", "magistrate"].includes(role)) {
    itemSpecs.push(["official_seal_county", {
      itemId: `item:${ownerActorId}:official-seal`,
      containerId: `container:${ownerActorId}:office_storage`,
      boundOfficeRef: "office:current",
      provenance: [{ ref: "office:appointment", label: "任命附带官印", turn: 0 }]
    }]);
  }
  if (role === "general") {
    itemSpecs.push(["military_tally_bronze", {
      itemId: `item:${ownerActorId}:military-tally`,
      containerId: `container:${ownerActorId}:personal`,
      boundActorId: ownerActorId,
      provenance: [{ ref: "military:command", label: "军令授予", turn: 0 }]
    }]);
  }
  const items = itemSpecs.map(([templateId, overrides]) =>
    createItemFromTemplate(templateId, { ownerActorId, ...overrides }).item
  );

  return normalizeInventoryLedger({
    schemaVersion: INVENTORY_LEDGER_SCHEMA_VERSION,
    ownerActorId,
    containers,
    items
  });
}

function ensureInventoryLedgerState(worldState = {}, options = {}) {
  const ownerActorId = cleanId(options.ownerActorId || worldState.player?.id || "player", "player");
  const source = isPlainObject(worldState.inventoryLedger)
    ? worldState
    : createDeterministicInitialInventoryLedger({
      role: worldState.player?.role || options.role,
      ownerActorId,
      player: worldState.player
    });
  worldState.inventoryLedger = normalizeInventoryLedger(source, { ownerActorId });
  return worldState.inventoryLedger;
}

function writeInventoryLedgerState(worldState = {}, ledger = {}, options = {}) {
  const ownerActorId = cleanId(options.ownerActorId || ledger.ownerActorId || worldState.player?.id || "player", "player");
  worldState.inventoryLedger = normalizeInventoryLedger(ledger, { ownerActorId });
  return worldState.inventoryLedger;
}

function itemWeight(item = {}) {
  const template = itemTemplate(item.templateId);
  return (template?.weight || 0) * clampNumber(item.quantity, 1, template?.stackLimit || 1, 1);
}

function containerLoad(ledger, containerId, excludeItemId = "") {
  return ledger.items
    .filter((item) => item.containerId === containerId && item.itemId !== excludeItemId)
    .reduce((sum, item) => sum + itemWeight(item), 0);
}

function itemVisibleToPlayer(item, containersById, options = {}) {
  if (!item || item.visibility === "hidden") return false;
  if (item.legalStatus === "contraband" && !options.includeContraband) return false;
  const container = containersById.get(item.containerId);
  if (!container || container.visibility === "hidden") return false;
  if (item.visibility === "role_limited" || container.visibility === "role_limited") {
    return Boolean(options.includeRoleLimited || item.ownerActorId === options.viewerActorId);
  }
  return ["player_visible", "public", "rumor"].includes(item.visibility);
}

function containerVisibleToPlayer(container, options = {}) {
  if (!container || container.visibility === "hidden") return false;
  if (container.visibility === "role_limited") {
    return Boolean(options.includeRoleLimited || container.ownerActorId === options.viewerActorId);
  }
  return ["player_visible", "public", "rumor"].includes(container.visibility);
}

function canTransferItem(input = {}, request = {}) {
  const ledger = normalizeInventoryLedger(input, { ownerActorId: request.actorId || request.ownerActorId || "player" });
  const actorId = cleanId(request.actorId, ledger.ownerActorId);
  const itemId = cleanId(request.itemId, "");
  const toContainerId = cleanId(request.toContainerId, "");
  const item = ledger.items.find((row) => row.itemId === itemId);
  const toContainer = ledger.containers.find((row) => row.containerId === toContainerId);
  if (!item) return { accepted: false, reason: "unknown_item" };
  if (!toContainer) return { accepted: false, reason: "unknown_destination_container" };
  if (item.ownerActorId !== actorId && item.custodianActorId !== actorId) {
    return { accepted: false, reason: "actor_not_owner_or_custodian" };
  }
  if (item.legalStatus === "contraband") {
    return { accepted: false, reason: "contraband_requires_server_case_resolution" };
  }
  if (item.transferPolicy === "server_only") {
    return { accepted: false, reason: "server_only_transfer_policy" };
  }
  if (item.transferPolicy === "bound_to_office" && toContainer.ownerPolicy !== "office") {
    return { accepted: false, reason: "bound_office_credential_cannot_leave_office_storage" };
  }
  if (item.transferPolicy === "bound_to_actor" && item.boundActorId && item.boundActorId !== actorId) {
    return { accepted: false, reason: "bound_actor_mismatch" };
  }
  if (toContainer.locked) return { accepted: false, reason: "destination_container_locked" };
  const projectedLoad = containerLoad(ledger, toContainer.containerId, item.itemId) + itemWeight(item);
  if (projectedLoad > toContainer.capacityWeight) {
    return { accepted: false, reason: "destination_capacity_exceeded" };
  }
  return {
    accepted: true,
    reason: "ok",
    fromContainerId: item.containerId,
    toContainerId: toContainer.containerId
  };
}

function transferItem(input = {}, request = {}) {
  const ledger = normalizeInventoryLedger(input, { ownerActorId: request.actorId || request.ownerActorId || "player" });
  const decision = canTransferItem(ledger, request);
  if (!decision.accepted) {
    return {
      ...decision,
      ledger
    };
  }
  const next = cloneJson(ledger);
  const item = next.items.find((row) => row.itemId === cleanId(request.itemId, ""));
  item.containerId = decision.toContainerId;
  item.custodianActorId = cleanId(request.actorId, ledger.ownerActorId);
  item.locationRef = cleanText(request.locationRef, item.locationRef, 80);
  item.provenance = [
    ...(Array.isArray(item.provenance) ? item.provenance : []),
    {
      ref: cleanText(request.auditRef, "inventory_transfer", 80),
      label: "服务器校验转移",
      turn: clampNumber(request.turn, 0, Number.MAX_SAFE_INTEGER, 0)
    }
  ].slice(-INVENTORY_LEDGER_CONFIG.maxProvenanceEntriesInView);
  return {
    ...decision,
    ledger: next
  };
}

function buildInventoryView(input = {}, options = {}) {
  const viewerActorId = cleanId(options.viewerActorId, "player");
  const ledger = normalizeInventoryLedger(input, { ownerActorId: options.ownerActorId || viewerActorId });
  const containersById = new Map(ledger.containers.map((container) => [container.containerId, container]));
  const visibleContainers = ledger.containers
    .filter((container) => containerVisibleToPlayer(container, { ...options, viewerActorId }))
    .slice(0, INVENTORY_LEDGER_CONFIG.maxContainersInView)
    .map((container) => ({
      containerId: container.containerId,
      type: container.type,
      label: container.label,
      ownerActorId: container.ownerActorId,
      custodianActorId: container.custodianActorId,
      locationRef: container.locationRef,
      capacityWeight: container.capacityWeight,
      currentWeight: containerLoad(ledger, container.containerId),
      visibility: container.visibility,
      locked: container.locked
    }));
  const visibleContainerIds = new Set(visibleContainers.map((container) => container.containerId));
  const items = ledger.items
    .filter((item) => visibleContainerIds.has(item.containerId))
    .filter((item) => itemVisibleToPlayer(item, containersById, { ...options, viewerActorId }))
    .slice(0, INVENTORY_LEDGER_CONFIG.maxItemsInView)
    .map((item) => ({
      itemId: item.itemId,
      templateId: item.templateId,
      name: item.name,
      category: item.category,
      subtype: item.subtype,
      ownerActorId: item.ownerActorId,
      custodianActorId: item.custodianActorId,
      containerId: item.containerId,
      quantity: item.quantity,
      unit: item.unit,
      quality: item.quality,
      rarity: item.rarity,
      durability: item.durability,
      condition: item.condition,
      legalStatus: item.legalStatus,
      transferPolicy: item.transferPolicy,
      effects: item.effects,
      important: item.important,
      credential: item.credential,
      provenance: item.provenance
    }));
  const importantCredentials = items
    .filter((item) => item.important || item.credential)
    .slice(0, INVENTORY_LEDGER_CONFIG.maxImportantCredentialsInView)
    .map((item) => ({
      itemId: item.itemId,
      name: item.name,
      legalStatus: item.legalStatus,
      transferPolicy: item.transferPolicy,
      containerId: item.containerId,
      authorityBoundary: transferBoundaryLabel(item)
    }));

  return {
    schemaVersion: INVENTORY_LEDGER_SCHEMA_VERSION,
    viewerActorId,
    containers: visibleContainers,
    items,
    importantCredentials,
    counts: {
      containers: visibleContainers.length,
      items: items.length,
      importantCredentials: importantCredentials.length
    },
    authorityBoundary: "背包、仓库、禁物、绑定凭证和转移结果由服务器裁决；本视图不暴露 hidden/raw 字段。"
  };
}

function transferBoundaryLabel(item) {
  if (item.transferPolicy === "bound_to_office") return "绑定官署，不得移出授权库房。";
  if (item.transferPolicy === "bound_to_actor") return "绑定持有人，转交须服务器复核。";
  if (item.transferPolicy === "server_only") return "只能由服务器裁决流转。";
  if (item.legalStatus === "contraband") return "禁物须走案卷处置。";
  return "可按服务器校验规则流转。";
}

module.exports = {
  buildInventoryView,
  canTransferItem,
  createDeterministicInitialInventoryLedger,
  createItemFromTemplate,
  ensureInventoryLedgerState,
  normalizeContainer,
  normalizeInventoryLedger,
  normalizeItem,
  transferItem,
  writeInventoryLedgerState
};
