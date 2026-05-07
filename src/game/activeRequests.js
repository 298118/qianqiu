const {
  applyRelationshipChanges,
  ensureRelationshipLedger,
  normalizeRelationshipLedger
} = require("./relationships");

const ACTIVE_REQUEST_VIEW_VERSION = 1;
const MAX_REQUEST_TEXT_LENGTH = 140;

const REQUEST_KINDS = new Set(["request", "pressure", "favor", "backing", "repayment"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = MAX_REQUEST_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function currentTurn(worldState) {
  return clampNumber(worldState?.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function getVisibleRequestTarget(worldState, request) {
  if (!isPlainObject(worldState) || !isPlainObject(request)) return null;
  const targetType = request.targetType === "character" || request.targetType === "faction"
    ? request.targetType
    : null;
  const targetId = cleanText(request.targetId, "", 48);
  if (!targetType || !targetId) return null;

  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  const bucket = targetType === "character" ? ledger.characters : ledger.factions;
  const entry = bucket[targetId];
  if (!entry || entry.visible === false) return null;

  return { targetType, entry };
}

function normalizeActiveNpcRequest(worldState) {
  const request = worldState?.activeNpcRequest;
  if (!isPlainObject(request) || request.status !== "active") return null;

  const visibleTarget = getVisibleRequestTarget(worldState, request);
  if (!visibleTarget) return null;

  const createdTurn = clampNumber(request.createdTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState));
  const dueTurn = clampNumber(request.dueTurn, createdTurn + 1, Number.MAX_SAFE_INTEGER, createdTurn + 2);
  const kind = REQUEST_KINDS.has(request.kind) ? request.kind : "request";

  return {
    schemaVersion: ACTIVE_REQUEST_VIEW_VERSION,
    id: cleanText(request.id, `REQ-${createdTurn}-${visibleTarget.entry.id}`, 80),
    status: "active",
    kind,
    targetType: visibleTarget.targetType,
    targetId: visibleTarget.entry.id,
    sourceName: cleanText(request.sourceName, visibleTarget.entry.name),
    title: cleanText(request.title, `${visibleTarget.entry.name}有事相托`),
    ask: cleanText(request.ask, "请在限期内回应这桩人情。"),
    stakes: cleanText(request.stakes, "回应得宜可进情分，置之不理会添怨望。"),
    resolutionHint: cleanText(request.resolutionHint, "可用答应、帮忙、拜访、研读、报告或婉拒等行动回应。"),
    createdTurn,
    dueTurn,
    lastUpdatedTurn: clampNumber(request.lastUpdatedTurn, createdTurn, Number.MAX_SAFE_INTEGER, createdTurn)
  };
}

function sortTargets(first, second) {
  if (second.lastUpdatedTurn !== first.lastUpdatedTurn) {
    return second.lastUpdatedTurn - first.lastUpdatedTurn;
  }
  if (second.relationship !== first.relationship) {
    return second.relationship - first.relationship;
  }
  if (second.resentment !== first.resentment) {
    return second.resentment - first.resentment;
  }
  return first.id.localeCompare(second.id);
}

function chooseVisibleTarget(worldState) {
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  const visibleCharacters = Object.values(ledger.characters)
    .filter((entry) => entry.visible !== false)
    .sort(sortTargets);
  if (visibleCharacters.length) {
    return { targetType: "character", entry: visibleCharacters[0] };
  }

  const visibleFactions = Object.values(ledger.factions)
    .filter((entry) => entry.visible !== false)
    .sort(sortTargets);
  if (visibleFactions.length) {
    return { targetType: "faction", entry: visibleFactions[0] };
  }

  return null;
}

function chooseRequestKind(entry, targetType) {
  if (entry.resentment >= 25) return "pressure";
  if (entry.relationship >= 25) return "favor";
  if (targetType === "faction") return "backing";
  return "request";
}

function createRequestForTarget(worldState, target) {
  const turn = currentTurn(worldState);
  const { targetType, entry } = target;
  const kind = chooseRequestKind(entry, targetType);
  const sourceName = entry.name;
  const isFaction = targetType === "faction";
  const isPressure = kind === "pressure";

  return {
    schemaVersion: ACTIVE_REQUEST_VIEW_VERSION,
    id: `REQ-${String(turn).padStart(4, "0")}-${targetType}-${entry.id}`,
    status: "active",
    kind,
    targetType,
    targetId: entry.id,
    sourceName,
    title: isPressure
      ? `${sourceName}前来施压`
      : isFaction
        ? `${sourceName}递来请托`
        : `${sourceName}有事相托`,
    ask: isPressure
      ? "对方催你尽快表态，若继续拖延，怨望会更深。"
      : "对方盼你近两回合以帮忙、拜访、研读、报告或婉拒作出回应。",
    stakes: isPressure
      ? "妥善处理可缓和怨望，敷衍不理会损及情分。"
      : "答应并办妥可进情分，置之不理会添怨望。",
    resolutionHint: "可输入答应、帮忙、拜访、研读、报告、婉拒或拒绝等回应。",
    createdTurn: turn,
    dueTurn: turn + 2,
    lastUpdatedTurn: turn
  };
}

function classifyRequestResponse(input) {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return null;

  if (/(拒绝|推辞|婉拒|不理|搁置|拖延|敷衍)/.test(text) || /\b(refuse|decline|reject|ignore)\b/i.test(text)) {
    return "refuse";
  }

  if (/(答应|应允|帮|助|拜访|研读|准备|照办|呈|上疏|查办|报告|回报|支援)/.test(text) ||
    /\b(help|accept|support|visit|study|report|comply|assist)\b/i.test(text)) {
    return "accept";
  }

  return null;
}

function applyRequestOutcome(worldState, request, outcome) {
  const accepted = outcome === "accept";
  const expired = outcome === "expire";
  const suggestion = {
    targetType: request.targetType,
    targetId: request.targetId,
    relationshipDelta: accepted ? 4 : expired ? -3 : -2,
    resentmentDelta: accepted ? -2 : expired ? 5 : 3,
    stance: accepted ? "请托已应" : expired ? "请托逾期" : "请托被拒",
    recentIntent: accepted
      ? "记下玩家曾回应人情。"
      : expired
        ? "因请托逾期而转为观望。"
        : "因请托被拒而暂且观望。",
    reason: accepted
      ? "Active request was answered."
      : expired
        ? "Active request expired without response."
        : "Active request was refused."
  };

  return applyRelationshipChanges(worldState, [suggestion]);
}

function buildActiveNpcRequestView(worldState = {}) {
  const request = normalizeActiveNpcRequest(worldState);
  if (!request) return null;

  return {
    schemaVersion: ACTIVE_REQUEST_VIEW_VERSION,
    id: request.id,
    status: request.status,
    kind: request.kind,
    targetType: request.targetType,
    targetId: request.targetId,
    sourceName: request.sourceName,
    title: request.title,
    ask: request.ask,
    stakes: request.stakes,
    resolutionHint: request.resolutionHint,
    createdTurn: request.createdTurn,
    dueTurn: request.dueTurn,
    turnsRemaining: Math.max(0, request.dueTurn - currentTurn(worldState)),
    lastUpdatedTurn: request.lastUpdatedTurn
  };
}

function runActiveNpcRequestStep(worldState, input) {
  const result = {
    events: [],
    relationshipChanges: [],
    scheduled: false,
    resolved: false,
    expired: false
  };

  if (!isPlainObject(worldState)) return result;
  ensureRelationshipLedger(worldState);

  let activeRequest = normalizeActiveNpcRequest(worldState);
  if (!activeRequest && worldState.activeNpcRequest) {
    worldState.activeNpcRequest = null;
  }

  let handledExisting = false;
  if (activeRequest) {
    const response = classifyRequestResponse(input);
    if (response) {
      result.relationshipChanges.push(...applyRequestOutcome(worldState, activeRequest, response));
      result.events.push(
        response === "accept"
          ? `[人脉请托] 你回应了${activeRequest.sourceName}的请托，情分稍进。`
          : `[人脉请托] 你婉拒了${activeRequest.sourceName}的请托，对方暂且记下。`
      );
      worldState.activeNpcRequest = null;
      result.resolved = true;
      handledExisting = true;
    } else if (currentTurn(worldState) >= activeRequest.dueTurn) {
      result.relationshipChanges.push(...applyRequestOutcome(worldState, activeRequest, "expire"));
      result.events.push(`[人脉请托] ${activeRequest.sourceName}的请托逾期未答，怨望暗生。`);
      worldState.activeNpcRequest = null;
      result.expired = true;
      handledExisting = true;
    } else {
      worldState.activeNpcRequest = activeRequest;
    }
  }

  if (!worldState.activeNpcRequest && !handledExisting) {
    const target = chooseVisibleTarget(worldState);
    if (target) {
      const request = createRequestForTarget(worldState, target);
      worldState.activeNpcRequest = request;
      result.events.push(`[人脉请托] ${request.sourceName}传来口信：${request.ask}`);
      result.scheduled = true;
    }
  }

  return result;
}

module.exports = {
  buildActiveNpcRequestView,
  classifyRequestResponse,
  runActiveNpcRequestStep
};
