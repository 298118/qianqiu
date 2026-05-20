const {
  ASSET_LEDGER_CONFIG,
  ASSET_LEDGER_SCHEMA_VERSION,
  ASSET_TYPE_DEFINITIONS,
  RESOURCE_DEFINITIONS,
  ROLE_RESOURCE_DEFAULTS
} = require("./assetLedgerConfig");

const SECRET_LIKE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|hiddenDossier|raw[_ -]?(?:table|ledger|audit|state)|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|ai_change_proposals|event_log|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|[A-Za-z]:\\[^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = ASSET_LEDGER_CONFIG.textLimit) {
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

function clampResourceAmount(resourceId, amount) {
  const definition = RESOURCE_DEFINITIONS[resourceId];
  if (!definition) {
    return {
      accepted: false,
      amount: 0,
      min: 0,
      max: 0,
      reason: "unknown_resource"
    };
  }
  const clamped = clampNumber(amount, definition.min, definition.max, definition.defaultAmount);
  return {
    accepted: true,
    amount: clamped,
    min: definition.min,
    max: definition.max,
    clamped: clamped !== Math.round(Number(amount) || definition.defaultAmount)
  };
}

function normalizeResourceAccount(account = {}, fallbackOwnerActorId = "player") {
  const resourceId = cleanId(account.resourceId, "");
  const definition = RESOURCE_DEFINITIONS[resourceId];
  if (!definition) return null;
  const amount = clampResourceAmount(resourceId, account.amount).amount;
  const ownerActorId = cleanId(account.ownerActorId, fallbackOwnerActorId);
  return {
    accountId: cleanId(account.accountId, `resource:${ownerActorId}:${resourceId}`),
    resourceId,
    label: definition.label,
    unit: definition.unit,
    ownerActorId,
    amount,
    visibility: definition.visibleToPlayer ? "player_visible" : "hidden",
    sourceRef: cleanText(account.sourceRef, "deterministic_initial_ledger", 80),
    updatedTurn: clampNumber(account.updatedTurn, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function normalizeAsset(asset = {}, fallbackOwnerActorId = "player") {
  const assetType = cleanId(asset.assetType, "");
  const definition = ASSET_TYPE_DEFINITIONS[assetType];
  if (!definition) return null;
  const ownerActorId = cleanId(asset.ownerActorId, fallbackOwnerActorId);
  const assetId = cleanId(asset.assetId, `asset:${ownerActorId}:${assetType}`);
  const visibility = ASSET_LEDGER_CONFIG.visibilityLevels.includes(asset.visibility)
    ? asset.visibility
    : definition.defaultVisibility;
  const legalStatus = ASSET_LEDGER_CONFIG.legalStatuses.includes(asset.legalStatus)
    ? asset.legalStatus
    : definition.defaultLegalStatus;

  return {
    assetId,
    assetType,
    typeLabel: definition.label,
    name: cleanText(asset.name, definition.label, 80),
    ownerActorId,
    locationRef: cleanText(asset.locationRef, "", 80),
    condition: cleanText(asset.condition, "可用", 40),
    productivity: clampNumber(asset.productivity, 0, 100, 50),
    upkeepSilver: clampNumber(asset.upkeepSilver, 0, 100000, 0),
    legalStatus,
    visibility,
    effectRefs: uniqueCleanTexts(asset.effectRefs, 8),
    provenance: (Array.isArray(asset.provenance) ? asset.provenance : [])
      .map((entry, index) => ({
        ref: cleanText(entry?.ref, `asset_provenance:${index + 1}`, 80),
        label: cleanText(entry?.label, "来源已记账", 80),
        turn: clampNumber(entry?.turn, 0, Number.MAX_SAFE_INTEGER, 0)
      }))
      .filter((entry) => entry.label)
      .slice(0, ASSET_LEDGER_CONFIG.maxProvenanceEntriesInView),
    createdTurn: clampNumber(asset.createdTurn, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function extractLedger(input = {}) {
  if (isPlainObject(input.assetLedger) || isPlainObject(input.resourceLedger)) {
    return {
      schemaVersion: input.assetLedger?.schemaVersion || ASSET_LEDGER_SCHEMA_VERSION,
      resourceAccounts: input.resourceLedger?.accounts || input.assetLedger?.resourceAccounts || [],
      assets: input.assetLedger?.assets || [],
      ownerActorId: input.player?.actorId || input.playerActorId || "player"
    };
  }
  return input;
}

function normalizeAssetLedger(input = {}, options = {}) {
  const ledger = extractLedger(input);
  const fallbackOwnerActorId = cleanId(options.ownerActorId || ledger.ownerActorId, "player");
  const resourceAccounts = (Array.isArray(ledger.resourceAccounts) ? ledger.resourceAccounts : [])
    .map((account) => normalizeResourceAccount(account, fallbackOwnerActorId))
    .filter(Boolean);
  const assets = (Array.isArray(ledger.assets) ? ledger.assets : [])
    .map((asset) => normalizeAsset(asset, fallbackOwnerActorId))
    .filter(Boolean);

  return {
    schemaVersion: ASSET_LEDGER_SCHEMA_VERSION,
    ownerActorId: fallbackOwnerActorId,
    resourceAccounts,
    assets
  };
}

function createDeterministicInitialAssetLedger(options = {}) {
  const role = cleanId(options.role || options.player?.role, "scholar");
  const ownerActorId = cleanId(options.ownerActorId || options.playerActorId || options.player?.actorId, "player");
  const defaults = {
    ...Object.fromEntries(Object.entries(RESOURCE_DEFINITIONS).map(([resourceId, definition]) => [
      resourceId,
      definition.defaultAmount
    ])),
    ...(ROLE_RESOURCE_DEFAULTS[role] || ROLE_RESOURCE_DEFAULTS.scholar)
  };
  const resourceAccounts = Object.keys(RESOURCE_DEFINITIONS).map((resourceId) =>
    normalizeResourceAccount({
      accountId: `resource:${ownerActorId}:${resourceId}`,
      resourceId,
      ownerActorId,
      amount: defaults[resourceId],
      sourceRef: "deterministic_initial_ledger"
    }, ownerActorId)
  );
  const assets = [
    normalizeAsset({
      assetId: `asset:${ownerActorId}:study-basic`,
      assetType: "study",
      name: "寒窗书斋",
      ownerActorId,
      locationRef: "home:player",
      condition: "清贫可用",
      productivity: role === "scholar" ? 42 : 58,
      upkeepSilver: 1,
      provenance: [{ ref: "opening:default", label: "开局随身家业", turn: 0 }],
      effectRefs: ["study_context"]
    }, ownerActorId)
  ];
  if (["official", "magistrate", "emperor"].includes(role)) {
    assets.push(normalizeAsset({
      assetId: `asset:${ownerActorId}:official-treasury-visible`,
      assetType: "treasury",
      name: "官署库房摘要",
      ownerActorId,
      locationRef: "office:current",
      condition: "需按官署权限支取",
      productivity: 50,
      upkeepSilver: 0,
      visibility: "role_limited",
      legalStatus: "official_property",
      provenance: [{ ref: "office:appointment", label: "任所权责附带", turn: 0 }],
      effectRefs: ["official_budget_context"]
    }, ownerActorId));
  }

  return {
    schemaVersion: ASSET_LEDGER_SCHEMA_VERSION,
    ownerActorId,
    resourceAccounts,
    assets
  };
}

function splitLedgerForWorldState(ledger = {}) {
  const normalized = normalizeAssetLedger(ledger, { ownerActorId: ledger.ownerActorId || "player" });
  return {
    assetLedger: {
      schemaVersion: ASSET_LEDGER_SCHEMA_VERSION,
      ownerActorId: normalized.ownerActorId,
      assets: normalized.assets
    },
    resourceLedger: {
      schemaVersion: ASSET_LEDGER_SCHEMA_VERSION,
      ownerActorId: normalized.ownerActorId,
      accounts: normalized.resourceAccounts
    }
  };
}

function ensureAssetLedgerState(worldState = {}, options = {}) {
  const ownerActorId = cleanId(options.ownerActorId || worldState.player?.id || "player", "player");
  const hasAssets = isPlainObject(worldState.assetLedger);
  const hasResources = isPlainObject(worldState.resourceLedger);
  const source = hasAssets || hasResources
    ? worldState
    : createDeterministicInitialAssetLedger({
      role: worldState.player?.role || options.role,
      ownerActorId,
      player: worldState.player
    });
  const { assetLedger, resourceLedger } = splitLedgerForWorldState(
    normalizeAssetLedger(source, { ownerActorId })
  );
  worldState.assetLedger = assetLedger;
  worldState.resourceLedger = resourceLedger;
  return {
    schemaVersion: ASSET_LEDGER_SCHEMA_VERSION,
    ownerActorId,
    resourceAccounts: resourceLedger.accounts,
    assets: assetLedger.assets
  };
}

function writeAssetLedgerState(worldState = {}, ledger = {}, options = {}) {
  const ownerActorId = cleanId(options.ownerActorId || ledger.ownerActorId || worldState.player?.id || "player", "player");
  const { assetLedger, resourceLedger } = splitLedgerForWorldState(
    normalizeAssetLedger(ledger, { ownerActorId })
  );
  worldState.assetLedger = assetLedger;
  worldState.resourceLedger = resourceLedger;
  return {
    schemaVersion: ASSET_LEDGER_SCHEMA_VERSION,
    ownerActorId,
    resourceAccounts: resourceLedger.accounts,
    assets: assetLedger.assets
  };
}

function buildResourceLedgerView(input = {}, options = {}) {
  const viewerActorId = cleanId(options.viewerActorId, "player");
  const ledger = normalizeAssetLedger(input, { ownerActorId: options.ownerActorId || viewerActorId });
  const accounts = ledger.resourceAccounts
    .filter((account) => account.visibility !== "hidden")
    .slice(0, ASSET_LEDGER_CONFIG.maxResourceAccountsInView)
    .map((account) => ({
      accountId: account.accountId,
      resourceId: account.resourceId,
      label: account.label,
      amount: account.amount,
      unit: account.unit,
      ownerActorId: account.ownerActorId,
      updatedTurn: account.updatedTurn
    }));

  return {
    schemaVersion: ASSET_LEDGER_SCHEMA_VERSION,
    viewerActorId,
    accounts,
    counts: {
      total: accounts.length
    },
    authorityBoundary: "资源数值由服务器账本裁决，AI 与浏览器只能读取安全摘要。"
  };
}

function assetVisibleToPlayer(asset, options = {}) {
  if (!asset || asset.visibility === "hidden") return false;
  if (asset.visibility === "role_limited") {
    return Boolean(options.includeRoleLimited || asset.ownerActorId === options.viewerActorId);
  }
  return ["player_visible", "public", "rumor"].includes(asset.visibility);
}

function buildAssetLedgerView(input = {}, options = {}) {
  const viewerActorId = cleanId(options.viewerActorId, "player");
  const ledger = normalizeAssetLedger(input, { ownerActorId: options.ownerActorId || viewerActorId });
  const assets = ledger.assets
    .filter((asset) => assetVisibleToPlayer(asset, { ...options, viewerActorId }))
    .slice(0, ASSET_LEDGER_CONFIG.maxAssetsInPlayerView)
    .map((asset) => ({
      assetId: asset.assetId,
      assetType: asset.assetType,
      typeLabel: asset.typeLabel,
      name: asset.name,
      ownerActorId: asset.ownerActorId,
      locationRef: asset.locationRef,
      condition: asset.condition,
      productivity: asset.productivity,
      upkeepSilver: asset.upkeepSilver,
      legalStatus: asset.legalStatus,
      visibility: asset.visibility,
      effectRefs: asset.effectRefs,
      provenance: asset.provenance
    }));

  return {
    schemaVersion: ASSET_LEDGER_SCHEMA_VERSION,
    viewerActorId,
    assets,
    counts: {
      total: assets.length
    },
    resourceLedgerView: buildResourceLedgerView(ledger, { viewerActorId }),
    authorityBoundary: "长期资产与资源支取由服务器裁决；本视图不暴露隐藏资产真数、原始账本或模型候选。"
  };
}

function applyResourceDelta(input = {}, resourceId, delta, options = {}) {
  const ledger = normalizeAssetLedger(input, options);
  const definition = RESOURCE_DEFINITIONS[resourceId];
  if (!definition) {
    return {
      accepted: false,
      reason: "unknown_resource",
      ledger
    };
  }
  const ownerActorId = cleanId(options.ownerActorId || ledger.ownerActorId, "player");
  const next = cloneJson(ledger);
  let account = next.resourceAccounts.find((row) => row.resourceId === resourceId && row.ownerActorId === ownerActorId);
  if (!account) {
    account = normalizeResourceAccount({ resourceId, ownerActorId, amount: definition.defaultAmount }, ownerActorId);
    next.resourceAccounts.push(account);
  }
  const before = account.amount;
  const clamped = clampResourceAmount(resourceId, before + Number(delta || 0));
  account.amount = clamped.amount;
  account.updatedTurn = clampNumber(options.turn, 0, Number.MAX_SAFE_INTEGER, account.updatedTurn || 0);
  return {
    accepted: true,
    before,
    after: account.amount,
    clamped: clamped.clamped,
    ledger: next
  };
}

module.exports = {
  applyResourceDelta,
  buildAssetLedgerView,
  buildResourceLedgerView,
  clampResourceAmount,
  createDeterministicInitialAssetLedger,
  ensureAssetLedgerState,
  normalizeAsset,
  normalizeAssetLedger,
  normalizeResourceAccount,
  writeAssetLedgerState
};
