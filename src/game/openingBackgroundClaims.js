const { createHash, randomUUID } = require("node:crypto");
const {
  CLAIM_TYPE_TO_RESOURCE,
  OPENING_BACKGROUND_CLAIMS_CONFIG,
  OPENING_BACKGROUND_CLAIMS_SCHEMA_VERSION
} = require("./openingBackgroundClaimsConfig");
const {
  applyResourceDelta,
  ensureAssetLedgerState,
  normalizeAsset,
  normalizeAssetLedger,
  writeAssetLedgerState
} = require("./assetLedger");
const {
  createItemFromTemplate,
  ensureInventoryLedgerState,
  normalizeInventoryLedger,
  writeInventoryLedgerState
} = require("./inventoryLedger");

const UNSAFE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|hiddenDossier|raw[_ -]?(?:provider|audit|table|ledger|prompt|state)|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|ai_change_proposals|event_log|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = OPENING_BACKGROUND_CLAIMS_CONFIG.safeTextLimit) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || UNSAFE_TEXT_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
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

function hashSourceText(value) {
  const text = typeof value === "string" ? value : "";
  if (!text.trim()) return "";
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function createInitialOpeningBackgroundClaimsState(input = {}, worldState = {}) {
  const publicBackground = cleanText(input.background || worldState.setup?.background, "", 180);
  const customSetting = cleanText(input.customSetting || worldState.setup?.customSetting, "", 220);
  return {
    schemaVersion: OPENING_BACKGROUND_CLAIMS_SCHEMA_VERSION,
    status: "not_processed",
    sourceHash: hashSourceText(`${publicBackground}\n${customSetting}`),
    processedAtTurn: null,
    acceptedCount: 0,
    scaledCount: 0,
    rejectedCount: 0,
    riskCount: 0,
    decisions: [],
    publicSummary: "",
    auditRefs: []
  };
}

function ensureOpeningBackgroundClaimsState(worldState = {}) {
  if (
    !isPlainObject(worldState.openingBackgroundClaims) ||
    worldState.openingBackgroundClaims.schemaVersion !== OPENING_BACKGROUND_CLAIMS_SCHEMA_VERSION
  ) {
    worldState.openingBackgroundClaims = createInitialOpeningBackgroundClaimsState({}, worldState);
  }
  return worldState.openingBackgroundClaims;
}

function buildBackgroundClaimParserContext(input = {}, worldState = {}) {
  return {
    schemaVersion: OPENING_BACKGROUND_CLAIMS_SCHEMA_VERSION,
    playerRole: cleanText(worldState.player?.role, "scholar", 40),
    playerRoleLabel: cleanText(worldState.player?.roleLabel, "书生", 40),
    publicBackground: cleanText(input.background || worldState.setup?.background, "", 180),
    customSetting: cleanText(input.customSetting || worldState.setup?.customSetting, "", 260),
    familyBackground: cleanText(worldState.setup?.familyBackground, "", 40),
    nativePlace: cleanText(worldState.setup?.nativePlace, "", 80),
    serverBoundaries: [
      "AI 只解析宣称，不能授予功名、官职、军权、皇权重器或绕过科举。",
      "服务器按身份、数量上限、合法性和风险裁决资产、资源、凭证与风险。"
    ]
  };
}

function normalizeParsedClaims(parserPayload = {}) {
  const claims = Array.isArray(parserPayload.claims) ? parserPayload.claims : [];
  return claims
    .map((claim, index) => ({
      claimId: cleanId(claim?.claimId, `claim:${index + 1}`),
      claimType: cleanText(claim?.claimType, "risk", 40),
      claimSummary: cleanText(claim?.claimSummary, "背景宣称", 160),
      requestedValue: isPlainObject(claim?.requestedValue) ? claim.requestedValue : {},
      confidence: clampNumber((claim?.confidence ?? 0.5) * 100, 0, 100, 50) / 100,
      evidenceText: cleanText(claim?.evidenceText, "", 120),
      source: cleanText(claim?.source, "provider-ai", 32)
    }))
    .slice(0, OPENING_BACKGROUND_CLAIMS_CONFIG.maxClaims);
}

function requestedAmount(claim, fallback = 0) {
  const value = claim.requestedValue || {};
  return clampNumber(value.amount ?? value.count, 0, 1000000, fallback);
}

function requestedCount(claim, fallback = 1) {
  const value = claim.requestedValue || {};
  return clampNumber(value.count ?? value.amount, 1, 1000, fallback);
}

function appendAsset(worldState, asset) {
  const ledger = normalizeAssetLedger(ensureAssetLedgerState(worldState));
  const normalized = normalizeAsset(asset, ledger.ownerActorId);
  if (normalized) ledger.assets.push(normalized);
  writeAssetLedgerState(worldState, ledger);
  return normalized;
}

function appendItem(worldState, templateId, overrides = {}) {
  const ledger = normalizeInventoryLedger(ensureInventoryLedgerState(worldState));
  const created = createItemFromTemplate(templateId, {
    ownerActorId: ledger.ownerActorId,
    ...overrides
  });
  if (created.accepted && created.item) {
    ledger.items.push(created.item);
    writeInventoryLedgerState(worldState, ledger);
  }
  return created.item;
}

function applyResource(worldState, resourceId, delta) {
  const ledger = ensureAssetLedgerState(worldState);
  const result = applyResourceDelta(ledger, resourceId, delta, {
    ownerActorId: ledger.ownerActorId,
    turn: worldState.turnCount || 0
  });
  if (result.accepted) writeAssetLedgerState(worldState, result.ledger);
  return result;
}

function makeDecision(claim, decision, overrides = {}) {
  return {
    claimId: claim.claimId,
    claimType: claim.claimType,
    claimSummary: claim.claimSummary,
    decision,
    publicSummary: cleanText(overrides.publicSummary, claim.claimSummary, 180),
    acceptedRefs: Array.isArray(overrides.acceptedRefs) ? overrides.acceptedRefs.filter(Boolean).slice(0, 8) : [],
    riskTags: Array.isArray(overrides.riskTags) ? overrides.riskTags.filter(Boolean).slice(0, 8) : [],
    serverReason: cleanText(overrides.serverReason, "服务器按开局身份与合法性裁决。", 160),
    source: claim.source
  };
}

function adjudicateWealthClaim(worldState, claim) {
  const requested = requestedAmount(claim, 0);
  const unit = cleanText(claim.requestedValue?.unit, "两", 24);
  let resourceId = CLAIM_TYPE_TO_RESOURCE.wealth;
  let limit = OPENING_BACKGROUND_CLAIMS_CONFIG.maxOpeningSilverLiang;
  if (/金/.test(claim.requestedValue?.label || "") || /金/.test(unit)) {
    resourceId = "gold_liang";
    limit = OPENING_BACKGROUND_CLAIMS_CONFIG.maxOpeningGoldLiang;
  } else if (/粮|石/.test(claim.requestedValue?.label || "") || /石/.test(unit)) {
    resourceId = "grain_shi";
    limit = OPENING_BACKGROUND_CLAIMS_CONFIG.maxOpeningGrainShi;
  }
  const accepted = Math.min(requested, limit);
  if (accepted <= 0) {
    return makeDecision(claim, "rejected", {
      publicSummary: "财富宣称缺少可核数量，暂不入账。",
      serverReason: "未提供可用数量。"
    });
  }
  const result = applyResource(worldState, resourceId, accepted);
  return makeDecision(claim, requested > accepted || result.clamped ? "scaled" : "accepted", {
    publicSummary: requested > accepted
      ? `财富宣称过大，按开局上限折算为${accepted}${unit}入账。`
      : `财富宣称按${accepted}${unit}入账。`,
    acceptedRefs: [`resource:${resourceId}`],
    riskTags: requested > accepted ? ["家资夸大"] : [],
    serverReason: "财富只作为资源账本增量，不改变功名、官职或身份。"
  });
}

function adjudicatePropertyClaim(worldState, claim) {
  const count = Math.min(requestedCount(claim, 1), OPENING_BACKGROUND_CLAIMS_CONFIG.maxOpeningEstateCount);
  const refs = [];
  for (let index = 0; index < count; index += 1) {
    const suffix = `${Date.now().toString(36)}-${index + 1}`;
    const asset = appendAsset(worldState, {
      assetId: `asset:${worldState.player?.id || "player"}:opening-estate-${suffix}`,
      assetType: "estate",
      name: count > 1 ? `开局宅产${index + 1}` : "开局宅产",
      ownerActorId: worldState.player?.id || "player",
      locationRef: worldState.setup?.nativePlace || "home:player",
      condition: "待核契约",
      productivity: 35,
      upkeepSilver: 2,
      legalStatus: "disputed",
      visibility: "player_visible",
      provenance: [{ ref: claim.claimId, label: "开局背景裁决入账", turn: worldState.turnCount || 0 }],
      effectRefs: ["asset:estate_claim", "risk:opening_verification"]
    });
    const deed = appendItem(worldState, "deed_estate", {
      itemId: `item:${worldState.player?.id || "player"}:opening-estate-deed-${suffix}`,
      containerId: `container:${worldState.player?.id || "player"}:home_storage`,
      provenance: [{ ref: claim.claimId, label: "开局宅产凭证", turn: worldState.turnCount || 0 }]
    });
    if (asset) refs.push(asset.assetId);
    if (deed) refs.push(deed.itemId);
  }
  return makeDecision(claim, requestedCount(claim, 1) > count ? "scaled" : "accepted", {
    publicSummary: `宅产宣称经服务器裁决，登记${count}处并生成地契凭证。`,
    acceptedRefs: refs,
    riskTags: ["契约待核"],
    serverReason: "宅产只入资产/凭证账本，不授予额外官权。"
  });
}

function adjudicateEducationClaim(worldState, claim) {
  appendItem(worldState, "book_four_books", {
    itemId: `item:${worldState.player?.id || "player"}:opening-book-${randomUUID().slice(0, 8)}`,
    containerId: `container:${worldState.player?.id || "player"}:personal`,
    provenance: [{ ref: claim.claimId, label: "开局读书背景", turn: worldState.turnCount || 0 }]
  });
  applyResource(worldState, "academic_prestige", 2);
  return makeDecision(claim, "converted_to_risk", {
    publicSummary: "功名宣称不直接承认，折为读书声望与书籍线索。",
    acceptedRefs: ["resource:academic_prestige", "item:book_four_books"],
    riskTags: ["功名需科举验证"],
    serverReason: "科举名位必须走 scholar -> child/provincial/metropolitan/palace exam 路径。"
  });
}

function adjudicateDebtClaim(worldState, claim) {
  const amount = requestedAmount(claim, 1) || 1;
  applyResource(worldState, "human_debt", amount);
  return makeDecision(claim, "accepted", {
    publicSummary: "债务或借贷牵连登记为人情债风险。",
    acceptedRefs: ["resource:human_debt"],
    riskTags: ["债务牵连"],
    serverReason: "债务只进入资源/风险账本，不直接扣除未核实资产。"
  });
}

function adjudicateRiskClaim(claim) {
  return makeDecision(claim, "converted_to_risk", {
    publicSummary: "背景宣称暂作风险线索记录。",
    riskTags: ["待查线索"],
    serverReason: "缺少可核资产或权限对象。"
  });
}

function adjudicateForbiddenAuthorityClaim(claim) {
  const label = {
    artifact: "皇权重器",
    military: "军权兵马",
    office: "官职名位"
  }[claim.claimType] || "越权宣称";
  return makeDecision(claim, "converted_to_risk", {
    publicSummary: `${label}宣称被拒绝入账，仅作为待查风险。`,
    riskTags: [label, "越权宣称"],
    serverReason: "开局背景不能授予皇权重器、军权、官职或绕过科举任官。"
  });
}

function adjudicateClaim(worldState, claim) {
  if (OPENING_BACKGROUND_CLAIMS_CONFIG.forbiddenAuthorityClaimTypes.includes(claim.claimType)) {
    return adjudicateForbiddenAuthorityClaim(claim);
  }
  if (claim.claimType === "wealth") return adjudicateWealthClaim(worldState, claim);
  if (claim.claimType === "property") return adjudicatePropertyClaim(worldState, claim);
  if (claim.claimType === "education") return adjudicateEducationClaim(worldState, claim);
  if (claim.claimType === "debt" || claim.claimType === "kinship" || claim.claimType === "retainer") {
    return adjudicateDebtClaim(worldState, claim);
  }
  return adjudicateRiskClaim(claim);
}

function buildOpeningAuditRecords(worldState = {}, result = {}) {
  const state = ensureOpeningBackgroundClaimsState(worldState);
  if (!state.decisions.length) return { auditEvents: [], aiProposals: [] };
  return {
    auditEvents: [{
      eventId: randomUUID(),
      turnCount: worldState.turnCount ?? null,
      year: worldState.year ?? null,
      month: worldState.month ?? null,
      tenDayPeriod: worldState.tenDayPeriod ?? null,
      sceneCadence: "opening",
      sourceSystem: "server",
      eventType: "opening_background_claims",
      visibility: "public",
      summary: state.publicSummary || "开局背景宣称已裁决。",
      related: {
        decisionCount: state.decisions.length,
        acceptedCount: state.acceptedCount,
        scaledCount: state.scaledCount,
        rejectedCount: state.rejectedCount,
        riskCount: state.riskCount
      },
      appliedChanges: {
        acceptedRefs: state.decisions.flatMap((decision) => decision.acceptedRefs || []).slice(0, 16)
      }
    }],
    aiProposals: [{
      turnCount: worldState.turnCount ?? null,
      year: worldState.year ?? null,
      month: worldState.month ?? null,
      tenDayPeriod: worldState.tenDayPeriod ?? null,
      sceneCadence: "opening",
      provider: cleanText(result.providerName, "mock", 40),
      promptPack: "background_claim_parser",
      proposalKind: "opening_background_claims",
      status: state.rejectedCount || state.scaledCount || state.riskCount ? "partially_accepted" : "accepted",
      proposal: {
        claimCount: normalizeParsedClaims(result.parserPayload).length,
        sourceHash: state.sourceHash
      },
      accepted: {
        decisions: state.decisions.map((decision) => ({
          claimId: decision.claimId,
          claimType: decision.claimType,
          decision: decision.decision,
          acceptedRefs: decision.acceptedRefs,
          riskTags: decision.riskTags
        }))
      },
      rejectedReasons: state.decisions
        .filter((decision) => decision.decision === "rejected" || decision.decision === "converted_to_risk")
        .map((decision) => `${decision.claimId}: ${decision.serverReason}`),
      appliedEventIds: []
    }]
  };
}

function adjudicateOpeningBackgroundClaims(worldState = {}, parserPayload = {}, options = {}) {
  ensureAssetLedgerState(worldState);
  ensureInventoryLedgerState(worldState);
  const state = createInitialOpeningBackgroundClaimsState(options.input || {}, worldState);
  const claims = normalizeParsedClaims(parserPayload);
  const decisions = claims.map((claim) => adjudicateClaim(worldState, claim));
  state.status = "processed";
  state.processedAtTurn = worldState.turnCount || 0;
  state.decisions = decisions;
  state.acceptedCount = decisions.filter((decision) => decision.decision === "accepted").length;
  state.scaledCount = decisions.filter((decision) => decision.decision === "scaled").length;
  state.rejectedCount = decisions.filter((decision) => decision.decision === "rejected").length;
  state.riskCount = decisions.filter((decision) => decision.riskTags.length > 0 || decision.decision === "converted_to_risk").length;
  state.publicSummary = decisions.length
    ? `开局背景已裁决：采纳${state.acceptedCount}项，折算${state.scaledCount}项，风险${state.riskCount}项。`
    : "开局背景未含可入账宣称。";
  worldState.openingBackgroundClaims = state;
  worldState.setup = {
    ...(worldState.setup || {}),
    background: worldState.setup?.familyBackground ? `书生家境：${worldState.setup.familyBackground}` : "",
    customSetting: state.publicSummary
  };
  return {
    openingBackgroundClaims: state,
    decisions,
    auditRecords: buildOpeningAuditRecords(worldState, {
      parserPayload,
      providerName: options.providerName
    }),
    events: decisions.length ? [state.publicSummary] : []
  };
}

function buildOpeningBackgroundClaimsView(worldState = {}) {
  const state = ensureOpeningBackgroundClaimsState(worldState);
  return {
    schemaVersion: OPENING_BACKGROUND_CLAIMS_SCHEMA_VERSION,
    status: state.status,
    processedAtTurn: state.processedAtTurn,
    publicSummary: state.publicSummary,
    counts: {
      accepted: state.acceptedCount,
      scaled: state.scaledCount,
      rejected: state.rejectedCount,
      risk: state.riskCount
    },
    decisions: state.decisions
      .slice(0, OPENING_BACKGROUND_CLAIMS_CONFIG.maxVisibleClaims)
      .map((decision) => ({
        claimId: decision.claimId,
        claimType: decision.claimType,
        claimSummary: decision.claimSummary,
        decision: decision.decision,
        publicSummary: decision.publicSummary,
        acceptedRefs: decision.acceptedRefs,
        riskTags: decision.riskTags,
        serverReason: decision.serverReason
      })),
    safeguards: {
      rawBackgroundRedacted: true,
      serverOwnsAssetsAndRank: true,
      providerClaimsAreNotFacts: true
    }
  };
}

module.exports = {
  adjudicateOpeningBackgroundClaims,
  buildBackgroundClaimParserContext,
  buildOpeningBackgroundClaimsView,
  createInitialOpeningBackgroundClaimsState,
  ensureOpeningBackgroundClaimsState,
  normalizeParsedClaims
};
