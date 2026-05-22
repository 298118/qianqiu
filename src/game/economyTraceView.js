const { buildAssetLedgerView, buildResourceLedgerView } = require("./assetLedger");
const { buildDelegatedTaskLedgerView } = require("./delegatedTasks");
const { buildInventoryView } = require("./inventoryLedger");
const { buildMarketPriceView, buildNpcEconomyView } = require("./npcEconomy");
const { buildTradeLedgerView } = require("./tradeLedger");
const { formatYearMonthPeriod } = require("./time");
const {
  ECONOMY_TRACE_CONFIG,
  ECONOMY_TRACE_SCHEMA_VERSION
} = require("./economyTraceConfig");

const UNSAFE_ECONOMY_TRACE_TEXT =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent|dossier)|hidden\s+(?:notes?|intent|dossier)|hiddenDossier|private[_ -]?(?:signal[_ -]?tags?|intent|notes?|ledger)|privateSignalTags|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|state|row)|rawProvider|rawEvidence|provider(?:Payload|Proposal|Response|Request|Raw)?|proposal|prompt|statePatch|worldState|auditRecord|outcomeId|evidenceRefs|resourceDelta|relationshipSignals|serverPlan|aiNarrativeProposal|sqlite|rawSql|SQL|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|ai_change_proposals|event_log|完整\s*prompt|完整提示词|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|\b(?:assetLedger|resourceLedger|inventoryLedger|tradeLedger|delegatedTaskLedger|marketPriceLedger|npcEconomyLedger|npcRoster|npcInteractionLedger)\b|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|密档|私档|密钥|隐藏(?:意图|动机|事实|札记)|模型原文|原始返回|本地路径)/i;

const SOURCE_VIEWS = new Set([
  "resourceLedgerView",
  "assetLedgerView",
  "inventoryView",
  "tradeLedgerView",
  "delegatedTaskView",
  "marketPriceView",
  "npcEconomyView"
]);

const TRACE_GROUPS = Object.freeze({
  resource_delta: "resources",
  resource_snapshot: "resources",
  asset_maintenance: "assets",
  inventory_aging: "inventory",
  trade_negotiation: "trades",
  trade_expiry: "trades",
  trade_blocked: "trades",
  delegated_task_result: "delegatedTasks",
  delegated_task_budget: "delegatedTasks",
  human_debt_monthly: "monthly",
  market_price_signal: "monthly",
  npc_relationship_monthly: "monthly",
  monthly_economy_event: "monthly"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeScalar(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function isUnsafeTraceText(value) {
  const text = normalizeScalar(value);
  return Boolean(text) && UNSAFE_ECONOMY_TRACE_TEXT.test(text);
}

function cleanText(value, fallback = "", maxLength = ECONOMY_TRACE_CONFIG.maxSummaryLength) {
  const text = normalizeScalar(value);
  if (!text || isUnsafeTraceText(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanList(values = [], limit = ECONOMY_TRACE_CONFIG.maxAffectedLabels, maxLength = 48) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function statusLabel(status) {
  const text = cleanText(status, "可阅", 40);
  if (text === "completed") return "已办成";
  if (text === "failed") return "未办成";
  if (text === "active") return "待办";
  if (text === "overdue") return "逾期";
  if (text === "countered") return "待复议";
  if (text === "server_blocked") return "服务器挡下";
  if (text === "rejected") return "已作废";
  if (text === "proposed") return "议价中";
  return text;
}

function groupForTrace(traceType) {
  return TRACE_GROUPS[traceType] || "monthly";
}

function boundary() {
  return {
    serverOwnsSettlement: true,
    aiMayExplainOnly: true,
    browserReadonly: true,
    noDirectResourceMutation: true
  };
}

function evidenceRef(sourceView, sourceRef, label) {
  if (!SOURCE_VIEWS.has(sourceView)) return null;
  const safeRef = cleanId(sourceRef, "");
  const safeLabel = cleanText(label, sourceView, 64);
  if (!safeRef || isUnsafeTraceText(safeRef)) return null;
  return {
    refId: `economy-trace:${safeRef}`,
    sourceView,
    sourceId: safeRef,
    label: safeLabel
  };
}

function makeTraceItem(input = {}, index = 0) {
  const traceType = cleanId(input.traceType, "monthly_economy_event");
  const group = groupForTrace(traceType);
  const sourceView = SOURCE_VIEWS.has(input.sourceView) ? input.sourceView : "npcEconomyView";
  const sourceRef = cleanId(input.sourceRef, `${group}:${index}`);
  const title = cleanText(input.title, "", ECONOMY_TRACE_CONFIG.maxTitleLength);
  const publicSummary = cleanText(input.publicSummary, "", ECONOMY_TRACE_CONFIG.maxSummaryLength);
  const nextStep = cleanText(input.nextStep, "", ECONOMY_TRACE_CONFIG.maxNextStepLength);
  const affectedLabels = cleanList(input.affectedLabels);
  const safeStatus = cleanId(input.status, "recorded");
  const safeStatusLabel = statusLabel(input.statusLabel || safeStatus);
  const refs = [
    evidenceRef(sourceView, sourceRef, title || publicSummary || sourceView),
    ...((Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [])
      .map((ref) => isPlainObject(ref) ? evidenceRef(ref.sourceView, ref.sourceId || ref.refId, ref.label) : null))
  ].filter(Boolean).slice(0, ECONOMY_TRACE_CONFIG.maxEvidenceRefs);
  const amountView = isPlainObject(input.amountView) ? buildAmountView(input.amountView) : null;
  const coreValues = [
    input.title,
    input.publicSummary,
    input.nextStep,
    input.status,
    input.statusLabel,
    sourceRef,
    ...(Array.isArray(input.affectedLabels) ? input.affectedLabels : []),
    ...(amountView ? [amountView.label, amountView.unit] : [])
  ];
  if (coreValues.some(isUnsafeTraceText) || (!title && !publicSummary)) return null;
  return {
    traceId: cleanId(input.traceId, `${traceType}:${sourceRef}:${index}`),
    traceType,
    group,
    groupLabel: groupLabel(group),
    sourceView,
    sourceRef,
    title,
    publicSummary,
    status: safeStatus,
    statusLabel: safeStatusLabel,
    affectedLabels,
    amountView,
    sourceRefs: refs,
    nextStep,
    boundaries: boundary()
  };
}

function buildAmountView(input = {}) {
  const before = Number(input.before);
  const after = Number(input.after);
  const delta = Number(input.delta);
  const result = {
    label: cleanText(input.label, "数值", 40),
    unit: cleanText(input.unit, "", 16)
  };
  if (Number.isFinite(before)) result.before = before;
  if (Number.isFinite(after)) result.after = after;
  if (Number.isFinite(delta)) result.delta = delta;
  if (result.before === undefined && result.after === undefined && result.delta === undefined) return null;
  return result;
}

function groupLabel(group) {
  if (group === "resources") return "资源变化";
  if (group === "assets") return "资产维护";
  if (group === "inventory") return "库存保养";
  if (group === "trades") return "交易议价";
  if (group === "delegatedTasks") return "委派回禀";
  return "月账线索";
}

function sourceForAttributePath(path = "") {
  if (path === "player.localTreasury" || path === "economy.resources") return "resourceLedgerView";
  if (path === "economy.assets") return "assetLedgerView";
  if (path === "economy.inventory") return "inventoryView";
  return "npcEconomyView";
}

function traceTypeForAttribute(change = {}) {
  const path = cleanText(change.path, "", 64);
  const reason = cleanText(change.reason, "", 80);
  if (path === "economy.assets" || /维护|资产/.test(reason)) return "asset_maintenance";
  if (path === "economy.inventory" || /库存|损耗/.test(reason)) return "inventory_aging";
  if (path === "player.localTreasury" || path === "economy.resources") return "resource_delta";
  if (/人情债/.test(reason)) return "human_debt_monthly";
  return "monthly_economy_event";
}

function tracesFromFeedback(feedback = {}) {
  const changes = Array.isArray(feedback.attributeChanges) ? feedback.attributeChanges : [];
  return changes.slice(0, ECONOMY_TRACE_CONFIG.maxFeedbackChanges).map((change, index) => {
    const traceType = traceTypeForAttribute(change);
    const sourceView = sourceForAttributePath(change.path);
    const label = cleanText(change.label, "经济数值", 40);
    return makeTraceItem({
      traceId: `feedback:${traceType}:${index}`,
      traceType,
      sourceView,
      sourceRef: `feedback:${traceType}:${index}`,
      title: `${label}变动`,
      publicSummary: cleanText(change.reason, "本项变动来自服务器月结或回合裁决。", 120),
      status: "recorded",
      statusLabel: "已登记",
      affectedLabels: [label],
      amountView: {
        label,
        before: change.before,
        after: change.after,
        delta: Number(change.after) - Number(change.before)
      },
      nextStep: "如需处置，请在主卷写成行动草稿，由服务器继续裁决。"
    }, index);
  }).filter(Boolean);
}

function tracesFromResources(resourceLedgerView = {}) {
  const accounts = Array.isArray(resourceLedgerView.accounts) ? resourceLedgerView.accounts : [];
  return accounts.slice(0, ECONOMY_TRACE_CONFIG.maxResourceItems).map((account, index) => makeTraceItem({
    traceId: `resource:${cleanId(account.resourceId, index)}`,
    traceType: account.resourceId === "human_debt" ? "human_debt_monthly" : "resource_snapshot",
    sourceView: "resourceLedgerView",
    sourceRef: `resource:${cleanId(account.resourceId, index)}`,
    title: `${cleanText(account.label, "资源", 40)}账面`,
    publicSummary: `当前可见账面为${clampNumber(account.amount, -100000000, 100000000, 0)}${cleanText(account.unit, "", 12)}；增减仍以服务器结算为准。`,
    status: "visible",
    statusLabel: "可见",
    affectedLabels: [account.label],
    amountView: {
      label: account.label,
      after: account.amount,
      unit: account.unit
    },
    nextStep: "需要支取、偿债、采购或馈赠时，先写行动草稿，等待服务器校验。"
  }, index)).filter(Boolean);
}

function tracesFromAssets(assetLedgerView = {}) {
  const assets = Array.isArray(assetLedgerView.assets) ? assetLedgerView.assets : [];
  return assets.slice(0, ECONOMY_TRACE_CONFIG.maxAssetItems).map((asset, index) => makeTraceItem({
    traceId: `asset:${cleanId(asset.assetId, index)}`,
    traceType: "asset_maintenance",
    sourceView: "assetLedgerView",
    sourceRef: `asset:${cleanId(asset.assetId, index)}`,
    title: `${cleanText(asset.name, "资产", 40)}维护`,
    publicSummary: `${cleanText(asset.typeLabel || asset.assetType, "资产", 32)}现为${cleanText(asset.condition, "可用", 32)}，产能${clampNumber(asset.productivity, 0, 100, 0)}；月修和收益由服务器月结。`,
    status: "visible",
    statusLabel: "可见",
    affectedLabels: [asset.name, asset.condition],
    amountView: {
      label: "产能",
      after: asset.productivity
    },
    nextStep: "若要修缮、出租、盘点或抵押，须回主卷提交行动。"
  }, index)).filter(Boolean);
}

function tracesFromInventory(inventoryView = {}) {
  const items = Array.isArray(inventoryView.items) ? inventoryView.items : [];
  return items
    .filter((item) => Number(item.durability) < 100 || String(item.condition || "").trim())
    .slice(0, ECONOMY_TRACE_CONFIG.maxInventoryItems)
    .map((item, index) => makeTraceItem({
      traceId: `inventory:${cleanId(item.itemId, index)}`,
      traceType: "inventory_aging",
      sourceView: "inventoryView",
      sourceRef: `item:${cleanId(item.itemId, index)}`,
      title: `${cleanText(item.name, "物件", 40)}保养`,
      publicSummary: `${cleanText(item.category || item.subtype, "物件", 32)}品相为${cleanText(item.condition, "未题", 32)}，耐久${clampNumber(item.durability, 0, 100, 0)}；流转和损耗由服务器校验。`,
      status: cleanText(item.transferPolicy, "server_only", 40),
      statusLabel: "服务器校验",
      affectedLabels: [item.name, item.condition],
      amountView: {
        label: "耐久",
        after: item.durability
      },
      nextStep: "可在囊箧页呈请移置；禁物、官物和绑定凭证仍走服务器裁决。"
    }, index))
    .filter(Boolean);
}

function tradeTraceType(record = {}) {
  const reasons = Array.isArray(record.serverReasons) ? record.serverReasons : [];
  if (record.status === "server_blocked") return "trade_blocked";
  if (record.status === "rejected" || reasons.includes("trade_commitment_expired")) return "trade_expiry";
  return "trade_negotiation";
}

function tracesFromTrades(tradeLedgerView = {}) {
  const items = Array.isArray(tradeLedgerView.items) ? tradeLedgerView.items : [];
  return items.slice(0, ECONOMY_TRACE_CONFIG.maxTradeItems).map((record, index) => {
    const traceType = tradeTraceType(record);
    const delta = Number(record.requestedSilverDelta);
    return makeTraceItem({
      traceId: `trade:${cleanId(record.tradeId, index)}`,
      traceType,
      sourceView: "tradeLedgerView",
      sourceRef: `trade:${cleanId(record.tradeId, index)}`,
      title: `${cleanText(record.npcName, "对方", 40)}交易`,
      publicSummary: cleanText(record.publicSummary || record.offerSummary, "交易只记录公开议价，银钱和物品不由 AI 直接结算。", 160),
      status: record.status,
      statusLabel: statusLabel(record.status),
      affectedLabels: [record.npcName, ...(Array.isArray(record.riskTags) ? record.riskTags : [])],
      amountView: Number.isFinite(delta) && delta !== 0 ? {
        label: "议价银两",
        delta,
        unit: "两"
      } : null,
      nextStep: record.status === "server_blocked"
        ? "先改用合法物件、足额资源或公开理由，再重新提交交易。"
        : "交易仍需后续服务器结算路径确认，不视为已经成交。"
    }, index);
  }).filter(Boolean);
}

function tracesFromDelegatedTasks(delegatedTaskView = {}) {
  const items = Array.isArray(delegatedTaskView.items) ? delegatedTaskView.items : [];
  return items.slice(0, ECONOMY_TRACE_CONFIG.maxDelegatedTaskItems).map((task, index) => {
    const result = isPlainObject(task.result) ? task.result : {};
    const assignee = isPlainObject(task.assignee) ? task.assignee : {};
    const completed = ["completed", "failed"].includes(task.status);
    return makeTraceItem({
      traceId: `delegated-task:${cleanId(task.taskId, index)}`,
      traceType: completed ? "delegated_task_result" : "delegated_task_budget",
      sourceView: "delegatedTaskView",
      sourceRef: `delegated-task:${cleanId(task.taskId, index)}`,
      title: cleanText(task.title, "委派任务", 48),
      publicSummary: cleanText(result.summary, `${cleanText(assignee.displayName, "执行人", 40)}承办中；预算、成败和关系影响由服务器裁决。`, 160),
      status: task.status,
      statusLabel: statusLabel(task.status),
      affectedLabels: [assignee.displayName, ...(Array.isArray(task.riskFactors) ? task.riskFactors : [])],
      amountView: Number.isFinite(Number(task.budget)) ? {
        label: "委派预算",
        after: task.budget,
        unit: "两"
      } : null,
      nextStep: completed ? "查看回禀后可拟复核、奖惩或重派，仍由服务器裁决。" : "等待到期月结；提前更改任务需另写行动草稿。"
    }, index);
  }).filter(Boolean);
}

function tracesFromMarket(marketPriceView = {}) {
  const rows = Array.isArray(marketPriceView.priceRows) ? marketPriceView.priceRows : [];
  return rows
    .slice()
    .sort((a, b) => clampNumber(b.marketPressure, 0, 100, 0) - clampNumber(a.marketPressure, 0, 100, 0))
    .slice(0, ECONOMY_TRACE_CONFIG.maxMarketSignals)
    .map((row, index) => makeTraceItem({
      traceId: `market:${cleanId(row.priceId, index)}`,
      traceType: "market_price_signal",
      sourceView: "marketPriceView",
      sourceRef: `market:${cleanId(row.priceId, index)}`,
      title: `${cleanText(row.label, "市价", 40)}${cleanText(row.trendLabel, "持平", 20)}`,
      publicSummary: `${cleanText(row.availability, "平稳", 20)}，压力${clampNumber(row.marketPressure, 0, 100, 0)}；驱动为${cleanList(row.drivers, 3, 24).join("、") || "公开市场因素"}。`,
      status: row.trend,
      statusLabel: cleanText(row.trendLabel, "持平", 20),
      affectedLabels: [row.label, ...(Array.isArray(row.drivers) ? row.drivers : [])],
      amountView: {
        label: "现价",
        after: row.currentSilverLiang,
        unit: "两"
      },
      nextStep: "市价只作为交易、维护和叙事裁决材料；前端不得自行成交。"
    }, index)).filter(Boolean);
}

function tracesFromNpcEconomy(npcEconomyView = {}) {
  const events = Array.isArray(npcEconomyView.recentEvents) ? npcEconomyView.recentEvents : [];
  return events.slice(0, ECONOMY_TRACE_CONFIG.maxMonthlyEvents).map((event, index) => {
    const text = cleanText(event, "", 160);
    const traceType = /人情/.test(text)
      ? "human_debt_monthly"
      : /NPC|信任|怨意|关系/.test(text)
        ? "npc_relationship_monthly"
        : "monthly_economy_event";
    return makeTraceItem({
      traceId: `monthly:${index}`,
      traceType,
      sourceView: "npcEconomyView",
      sourceRef: `monthly:${index}`,
      title: traceType === "human_debt_monthly" ? "人情债月账" : "经济月账",
      publicSummary: text,
      status: "recorded",
      statusLabel: "已登记",
      affectedLabels: ["月账"],
      nextStep: "月账只作公开解释；资源、人情债、交易和关系仍由服务器后续裁决。"
    }, index);
  }).filter(Boolean);
}

function groupItems(items = []) {
  const groups = {
    resources: [],
    assets: [],
    inventory: [],
    trades: [],
    delegatedTasks: [],
    monthly: []
  };
  for (const item of items) {
    if (!groups[item.group]) continue;
    if (groups[item.group].length >= ECONOMY_TRACE_CONFIG.maxGroupItems) continue;
    groups[item.group].push(item);
  }
  return groups;
}

function dedupeItems(items = []) {
  const result = [];
  const seen = new Set();
  for (const item of items) {
    const key = `${item.traceType}:${item.sourceView}:${item.sourceRef}:${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= ECONOMY_TRACE_CONFIG.maxTraceItems) break;
  }
  return result;
}

function buildEconomyTraceView(worldState = {}, options = {}) {
  const viewerActorId = cleanId(worldState.player?.id || "player", "player");
  const views = isPlainObject(options.views) ? options.views : {};
  const resourceLedgerView = isPlainObject(views.resourceLedgerView)
    ? views.resourceLedgerView
    : buildResourceLedgerView(worldState, { viewerActorId });
  const assetLedgerView = isPlainObject(views.assetLedgerView)
    ? views.assetLedgerView
    : buildAssetLedgerView(worldState, { viewerActorId, includeRoleLimited: true });
  const inventoryView = isPlainObject(views.inventoryView)
    ? views.inventoryView
    : buildInventoryView(worldState, { viewerActorId, includeRoleLimited: true });
  const tradeLedgerView = isPlainObject(views.tradeLedgerView) ? views.tradeLedgerView : buildTradeLedgerView(worldState);
  const delegatedTaskView = isPlainObject(views.delegatedTaskView) ? views.delegatedTaskView : buildDelegatedTaskLedgerView(worldState);
  const marketPriceView = isPlainObject(views.marketPriceView) ? views.marketPriceView : buildMarketPriceView(worldState);
  const npcEconomyView = isPlainObject(views.npcEconomyView) ? views.npcEconomyView : buildNpcEconomyView(worldState);
  const items = dedupeItems([
    ...tracesFromFeedback(options.economyFeedback),
    ...tracesFromTrades(tradeLedgerView),
    ...tracesFromDelegatedTasks(delegatedTaskView),
    ...tracesFromNpcEconomy(npcEconomyView),
    ...tracesFromMarket(marketPriceView),
    ...tracesFromResources(resourceLedgerView),
    ...tracesFromAssets(assetLedgerView),
    ...tracesFromInventory(inventoryView)
  ]);
  const groups = groupItems(items);
  return {
    schemaVersion: ECONOMY_TRACE_SCHEMA_VERSION,
    generatedAtTurn: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    dateLabel: formatYearMonthPeriod(worldState),
    summary: items.length
      ? `已整理${items.length}条资源、资产、交易、委派与月账解释。`
      : "暂无可见经济解释；交易、委派、资源和月账仍由服务器裁决。",
    traceItems: items,
    groups,
    aiReadScope: {
      readableFields: ["traceItems.title", "traceItems.publicSummary", "traceItems.statusLabel", "traceItems.sourceRefs", "traceItems.nextStep"],
      hiddenFieldsRedacted: true
    },
    toolPermissions: "AI 可解释物品效果、议价理由、委派回禀和月账摘要；不得扣资源、转物品、改交易状态、改 NPC 关系、写正式状态或后端持久化账本。",
    proposalBoundaries: [
      "economyTraceView 只读公开解释，不是结算器。",
      "浏览器按钮只可写行动草稿；资源、物品、交易、委派、人情债与关系变化仍由服务器裁决。"
    ],
    serverAdjudication: "资源扣减、交易成交、委派结果、经济月结、库存损耗和关系变化由既有服务器 resolver/tick 审计后写入。",
    safeguards: {
      browserReadonly: true,
      aiMayExplainOnly: true,
      rawLedgersRedacted: true,
      privateNpcDetailsRedacted: true,
      serverOwnsSettlement: true
    },
    caps: {
      maxTraceItems: ECONOMY_TRACE_CONFIG.maxTraceItems,
      maxGroupItems: ECONOMY_TRACE_CONFIG.maxGroupItems
    }
  };
}

module.exports = {
  buildEconomyTraceView
};
