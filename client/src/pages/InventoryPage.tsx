import { ArrowRightLeft, Briefcase, Landmark, Package, ScrollText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router";
import "../styles/routes/people-inventory.css";
import "../styles/responsive/mobile-people-inventory.css";
import type { InventoryContainerView, InventoryItemView } from "../api";
import { EconomyTraceSection } from "../components/EconomyTraceSection";
import { isRouteLocalSessionId, isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";
import { rewritePlayerFacingWorldText } from "../text/worldText";

const transferAllowedPolicies = new Set(["tradeable", "giftable", "lendable"]);

const legalStatusLabels: Record<string, string> = {
  ordinary: "寻常",
  restricted: "限用",
  official_seal: "官印",
  military_token: "兵符",
  imperial_artifact: "御物",
  contraband: "禁物"
};

const transferPolicyLabels: Record<string, string> = {
  tradeable: "可交易",
  giftable: "可赠礼",
  lendable: "可借用",
  bound_to_office: "系官署",
  bound_to_actor: "系其人",
  server_only: "仅回批"
};

const unsafeInventoryTextFragments = [
  "/api/game/" + "state",
  "/api/dev/" + "session-diagnostics",
  "data" + "/" + "sessions",
  "data" + "\\" + "sessions",
  "file" + "://",
  "raw",
  "private",
  "prov" + "ider",
  "pro" + "mpt",
  "hid" + "den",
  "key",
  "path",
  "manifest",
  "schema",
  "draft" + "Context",
  "server" + " adjudication",
  "hidden" + "Notes",
  "OPENAI" + "_API" + "_KEY",
  "DEEPSEEK" + "_API" + "_KEY",
  "MIMO" + "_API" + "_KEY",
  "ANTHROPIC" + "_API" + "_KEY",
  "完整" + "提示词",
  "本地" + "路径",
  "密" + "钥",
  "隐" + "藏",
  "私" + "档",
  "模型" + "原始"
] as const;

const localInventoryPathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|mnt|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;

function safeLabel(value: unknown, fallback: string, maxLength = 80) {
  const text = typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : fallback;
  const lowered = text.toLowerCase();
  if (localInventoryPathPattern.test(text) || /sk-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (unsafeInventoryTextFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}...` : rewritten;
}

function itemLabel(item: InventoryItemView) {
  const unit = safeLabel(item.unit, "", 8);
  const quantity = typeof item.quantity === "number" ? `${item.quantity}${unit}` : "";
  return `${safeLabel(item.name, "无名物件", 48)}${quantity ? ` · ${quantity}` : ""}`;
}

function containerLabel(container: InventoryContainerView | undefined) {
  if (!container) return "未入容器";
  const load = typeof container.currentWeight === "number" && typeof container.capacityWeight === "number"
    ? ` · ${container.currentWeight}/${container.capacityWeight}`
    : "";
  return `${safeLabel(container.label, "容器", 40)}${load}`;
}

function transferReadinessLabel(options: {
  readonly routeSessionSupported: boolean;
  readonly runnable: boolean;
  readonly routeInventoryStatus: string;
  readonly transferItem: InventoryItemView | undefined;
  readonly selectedTargetContainer: string;
}) {
  if (!options.routeSessionSupported) return "断卷不可移置";
  if (!options.runnable) return "预览只读";
  if (options.routeInventoryStatus === "loading") return "候账中";
  if (!options.transferItem) return "暂无可流转物件";
  if (!options.selectedTargetContainer) return "暂无可入容器";
  return "可呈请候批";
}

type InventoryReaderRow = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

function isSafeInventoryScalar(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return true;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return true;
  const lowered = text.toLowerCase();
  return !localInventoryPathPattern.test(text) &&
    !/sk-[a-z0-9_-]{6,}|tp-[a-z0-9_-]{6,}/i.test(text) &&
    !unsafeInventoryTextFragments.some((fragment) => lowered.includes(fragment.toLowerCase()));
}

function economyTraceItemCount(traceView: { readonly traceItems?: readonly unknown[] } | null | undefined) {
  return (Array.isArray(traceView?.traceItems) ? traceView.traceItems : [])
    .filter((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const record = entry as Record<string, unknown>;
      const affectedLabels = Array.isArray(record.affectedLabels) ? record.affectedLabels : [];
      const visibleFields = [
        record.title,
        record.publicSummary,
        record.summary,
        record.groupLabel,
        record.statusLabel,
        ...affectedLabels
      ];
      const hasContent = visibleFields.some((value) => typeof value === "string" && value.trim());
      return hasContent && visibleFields.every(isSafeInventoryScalar);
    }).length;
}

function inventoryCategorySummary(items: readonly InventoryItemView[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = safeLabel(item.category || item.subtype, "物件", 16);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const entries = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hans-CN"))
    .slice(0, 3);
  return entries.length
    ? entries.map(([label, count]) => `${label}${count}件`).join("、")
    : "暂无分类";
}

function buildInventoryReaderRows(input: {
  readonly routeSessionSupported: boolean;
  readonly resourceAccountCount: number;
  readonly assetCount: number;
  readonly credentialCount: number;
  readonly economyTraceCount: number;
  readonly containerCount: number;
  readonly lockedContainerCount: number;
  readonly itemCount: number;
  readonly visibleItemCount: number;
  readonly transferableItemCount: number;
  readonly selectedContainerLabel: string;
  readonly categorySummary: string;
  readonly transferLedgerStatus: string;
}): InventoryReaderRow[] {
  if (!input.routeSessionSupported) {
    return [
      { label: "账面", value: "案卷暂不可读", detail: "请从首页开卷或载入旧案。" },
      { label: "流转", value: "断卷不可移置", detail: "本页不会保存移置选择。" },
      { label: "边界", value: "只读公开账目", detail: "资源、成交、赠予、借用和人情回响仍候主卷回音。" }
    ];
  }

  return [
    {
      label: "账面",
      value: `资源${input.resourceAccountCount}笔 · 资产${input.assetCount}项 · 凭证${input.credentialCount}件`,
      detail: input.economyTraceCount ? `另有${input.economyTraceCount}条账解线索可查。` : "暂无可见账解线索。"
    },
    {
      label: "仓储",
      value: input.containerCount ? `${input.containerCount}处容器，${input.lockedContainerCount}处封存` : "暂无容器",
      detail: input.containerCount ? `当前读 ${input.selectedContainerLabel}。` : "容器未入卷时不补造仓储。"
    },
    {
      label: "物件",
      value: input.itemCount ? `${input.itemCount}件入卷，当前列${input.visibleItemCount}件` : "暂无物件",
      detail: input.itemCount ? `本栏分类：${input.categorySummary}。` : "无物件时仍可查看资源、资产和凭证。"
    },
    {
      label: "流转",
      value: `${input.transferableItemCount}件可呈请`,
      detail: `${input.transferLedgerStatus}；本页只整理呈请，不写成交、扣减、赠予、借用或关系回响。`
    }
  ];
}

export function InventoryPage() {
  const { sessionId = "s74-preview" } = useParams();
  const loadInventory = useGameSessionStore((state) => state.loadInventory);
  const transferInventoryItem = useGameSessionStore((state) => state.transferInventoryItem);
  const inventoryPayload = useGameSessionStore((state) => state.inventory);
  const session = useGameSessionStore((state) => state.currentSession);
  const storeCurrentSessionId = useGameSessionStore((state) => state.currentSessionId);
  const inventoryStatus = useGameSessionStore((state) => state.inventoryStatus);
  const error = useGameSessionStore((state) => state.error);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const latestSessionIdRef = useRef(sessionId);
  const [localInventorySessionId, setLocalInventorySessionId] = useState(sessionId);
  const [selectedContainerId, setSelectedContainerId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [targetContainerId, setTargetContainerId] = useState("");
  const [transferNotice, setTransferNotice] = useState("");
  const routeSessionSupported = isRouteLocalSessionId(sessionId);
  const runnable = routeSessionSupported && isRunnableSessionId(sessionId);
  const unsupportedRouteMessage = "此案卷编号暂不可用于浏览器囊箧；请从首页开卷或载入旧案。";
  const latestTransferSelectionRef = useRef({ itemId: "", targetContainerId: "" });

  function syncTransferSelection(itemId: string, targetContainerId: string) {
    latestTransferSelectionRef.current = { itemId, targetContainerId };
  }

  function isLatestTransferSelection(itemId: string, targetContainerId: string) {
    const latestSelection = latestTransferSelectionRef.current;
    return latestSelection.itemId === itemId && latestSelection.targetContainerId === targetContainerId;
  }

  useEffect(() => {
    latestSessionIdRef.current = sessionId;
    setLocalInventorySessionId(sessionId);
    setSelectedContainerId("");
    setSelectedItemId("");
    setTargetContainerId("");
    setTransferNotice("");
    syncTransferSelection("", "");
  }, [sessionId]);

  useEffect(() => {
    if (!runnable) return;
    void loadInventory(sessionId).catch(() => undefined);
  }, [loadInventory, runnable, sessionId]);

  const activeSession = routeSessionSupported && session?.sessionId === sessionId ? session : null;
  const inventoryView = routeSessionSupported && inventoryPayload?.sessionId === sessionId
    ? inventoryPayload.inventoryView
    : activeSession
      ? activeSession.inventoryView
      : null;
  const resourceLedgerView = routeSessionSupported && inventoryPayload?.sessionId === sessionId
    ? inventoryPayload.resourceLedgerView
    : activeSession
      ? activeSession.resourceLedgerView
      : null;
  const assetLedgerView = routeSessionSupported && inventoryPayload?.sessionId === sessionId
    ? inventoryPayload.assetLedgerView
    : activeSession
      ? activeSession.assetLedgerView
      : null;
  const economyTraceView = routeSessionSupported && inventoryPayload?.sessionId === sessionId
    ? inventoryPayload.economyTraceView
    : activeSession?.economyTraceView ?? null;
  const containers = inventoryView?.containers ?? [];
  const items = inventoryView?.items ?? [];
  const containersById = useMemo(
    () => new Map(containers.map((container) => [container.containerId, container])),
    [containers]
  );
  const localStateIsCurrent = localInventorySessionId === sessionId;
  const activeSelectedContainerId = localStateIsCurrent ? selectedContainerId : "";
  const activeSelectedItemId = localStateIsCurrent ? selectedItemId : "";
  const activeTargetContainerId = localStateIsCurrent ? targetContainerId : "";
  const routeInventoryStatus = routeSessionSupported && storeCurrentSessionId === sessionId ? inventoryStatus : "idle";
  const routeError = routeSessionSupported && error && storeCurrentSessionId === sessionId ? error : null;
  const selectedContainer = activeSelectedContainerId && containersById.has(activeSelectedContainerId)
    ? activeSelectedContainerId
    : containers[0]?.containerId || "";
  const visibleItems = selectedContainer
    ? items.filter((item) => item.containerId === selectedContainer)
    : items;
  const transferableItems = items.filter((item) => transferAllowedPolicies.has(item.transferPolicy || ""));
  const transferItem = transferableItems.find((item) => item.itemId === activeSelectedItemId) ?? transferableItems[0];
  const targetContainers = containers.filter((container) => container.containerId !== transferItem?.containerId && !container.locked);
  const selectedTargetContainer = activeTargetContainerId && targetContainers.some((container) => container.containerId === activeTargetContainerId)
    ? activeTargetContainerId
    : targetContainers[0]?.containerId || "";
  const selectedTargetContainerView = selectedTargetContainer ? containersById.get(selectedTargetContainer) : undefined;
  const resourceAccountCount = resourceLedgerView?.accounts?.length ?? 0;
  const assetCount = assetLedgerView?.assets?.length ?? 0;
  const credentialCount = inventoryView?.importantCredentials?.length ?? 0;
  const economyCount = economyTraceItemCount(economyTraceView);
  const lockedContainerCount = containers.filter((container) => container.locked).length;
  const transferLedgerStatus = transferReadinessLabel({
    routeSessionSupported,
    runnable,
    routeInventoryStatus,
    transferItem,
    selectedTargetContainer
  });
  const transferLedgerRoute = transferItem && selectedTargetContainerView
    ? `${itemLabel(transferItem)}：${containerLabel(transferItem.containerId ? containersById.get(transferItem.containerId) : undefined)} 至 ${containerLabel(selectedTargetContainerView)}`
    : transferItem
      ? `${itemLabel(transferItem)}：暂无可入容器。`
      : "本卷暂无可呈请流转的物件。";
  const inventoryReaderRows = buildInventoryReaderRows({
    routeSessionSupported,
    resourceAccountCount,
    assetCount,
    credentialCount,
    economyTraceCount: economyCount,
    containerCount: containers.length,
    lockedContainerCount,
    itemCount: items.length,
    visibleItemCount: visibleItems.length,
    transferableItemCount: transferableItems.length,
    selectedContainerLabel: containerLabel(containersById.get(selectedContainer)),
    categorySummary: inventoryCategorySummary(visibleItems.length ? visibleItems : items),
    transferLedgerStatus
  });

  useEffect(() => {
    if (containers[0] && (!activeSelectedContainerId || !containersById.has(activeSelectedContainerId))) {
      setLocalInventorySessionId(sessionId);
      setSelectedContainerId(containers[0].containerId);
    }
  }, [activeSelectedContainerId, containers, containersById, sessionId]);

  useEffect(() => {
    if (transferableItems[0] && (!activeSelectedItemId || !transferableItems.some((item) => item.itemId === activeSelectedItemId))) {
      setLocalInventorySessionId(sessionId);
      setSelectedItemId(transferableItems[0].itemId);
    }
  }, [activeSelectedItemId, sessionId, transferableItems]);

  useEffect(() => {
    if ((!activeTargetContainerId || !targetContainers.some((container) => container.containerId === activeTargetContainerId)) && targetContainers[0]) {
      setLocalInventorySessionId(sessionId);
      setTargetContainerId(targetContainers[0].containerId);
    }
  }, [activeTargetContainerId, sessionId, targetContainers]);

  async function handleTransfer() {
    if (!transferItem || !selectedTargetContainer || !runnable) return;
    const requestSessionId = sessionId;
    const requestItemId = transferItem.itemId;
    const requestTargetContainerId = selectedTargetContainer;
    syncTransferSelection(requestItemId, requestTargetContainerId);
    try {
      const payload = await transferInventoryItem(requestSessionId, {
        itemId: requestItemId,
        toContainerId: requestTargetContainerId
      });
      if (latestSessionIdRef.current !== requestSessionId || payload.sessionId !== requestSessionId) return;
      if (!isLatestTransferSelection(requestItemId, requestTargetContainerId)) return;
      setLocalInventorySessionId(requestSessionId);
      setTransferNotice(payload.accepted ? "案卷已复核并更新物件位置。" : `暂未准行：${payload.reason || "规则不许"}`);
      setSelectedContainerId(requestTargetContainerId);
      setSelectedItemId("");
      setTargetContainerId("");
      syncTransferSelection("", "");
    } catch {
      if (latestSessionIdRef.current !== requestSessionId) return;
      if (!isLatestTransferSelection(requestItemId, requestTargetContainerId)) return;
      setLocalInventorySessionId(requestSessionId);
      setTransferNotice("转移请求未能完成。");
    }
  }

  return (
    <article className="surfacePanel routePanel inventoryRoutePanel" aria-labelledby="inventory-title">
      <div className="routePanelHeader">
        <div>
          <p className="eyebrow">案头账本</p>
          <h1 id="inventory-title">囊箧</h1>
          <p>这里只读玩家已见的资源、资产、容器和物品卷宗；流转结果须呈请后复核回写。</p>
        </div>
        <span>{routeInventoryStatus === "loading" ? "候账" : `${items.length} 件`}</span>
      </div>
      {!routeSessionSupported ? <p className="statusLine" role="status">{unsupportedRouteMessage}</p> : null}

      <section className="inventorySummaryGrid" aria-label="资源与资产摘要">
        <LedgerBlock icon={<Briefcase size={18} aria-hidden="true" />} title="资源">
          {(resourceLedgerView?.accounts ?? []).length ? (
            resourceLedgerView?.accounts.map((account) => (
              <dl className="compactLedgerRow" key={account.accountId}>
                <dt>{safeLabel(account.label, "资源", 32)}</dt>
                <dd>{account.amount}{safeLabel(account.unit, "", 8)}</dd>
              </dl>
            ))
          ) : <p className="statusLine">暂无可见资源账。</p>}
        </LedgerBlock>
        <LedgerBlock icon={<Landmark size={18} aria-hidden="true" />} title="资产">
          {(assetLedgerView?.assets ?? []).length ? (
            assetLedgerView?.assets.slice(0, 6).map((asset) => (
              <article className="inventoryMiniCard paperMotionCard paperMotionInteractive" key={asset.assetId}>
                <strong>{safeLabel(asset.name, "资产", 40)}</strong>
                <span>{safeLabel(asset.typeLabel || asset.assetType, "资产", 32)} · {safeLabel(asset.condition, "可用", 32)}</span>
              </article>
            ))
          ) : <p className="statusLine">暂无可见长期资产。</p>}
        </LedgerBlock>
        <LedgerBlock icon={<ScrollText size={18} aria-hidden="true" />} title="凭证">
          {(inventoryView?.importantCredentials ?? []).length ? (
            inventoryView?.importantCredentials.map((credential) => (
              <article className="inventoryMiniCard paperMotionCard paperMotionInteractive" key={credential.itemId}>
                <strong>{safeLabel(credential.name, "凭证", 40)}</strong>
                <span>{safeLabel(credential.authorityBoundary, "以案卷回批为准", 64)}</span>
              </article>
            ))
          ) : <p className="statusLine">暂无重要凭证。</p>}
        </LedgerBlock>
      </section>

      <section className="inventoryWorkbench" aria-label="背包仓库工作台">
        <aside className="inventoryContainerList paperMotionSurface" aria-label="容器">
          <h2>仓储</h2>
          {containers.length ? containers.map((container) => (
            <button
              key={container.containerId}
              className="inventoryContainerButton paperMotionSelected"
              type="button"
              aria-pressed={selectedContainer === container.containerId}
              onClick={() => {
                setLocalInventorySessionId(sessionId);
                setSelectedContainerId(container.containerId);
              }}
            >
              <Package size={16} aria-hidden="true" />
              <span>{containerLabel(container)}</span>
              {container.locked ? <small>封存</small> : null}
            </button>
          )) : <p className="statusLine">{routeSessionSupported ? "等待囊箧卷宗。" : unsupportedRouteMessage}</p>}
        </aside>
        <div className="inventoryItemList paperMotionSurface" aria-label="物品">
          <h2>{containerLabel(containersById.get(selectedContainer))}</h2>
          {visibleItems.length ? visibleItems.map((item) => (
            <article className="inventoryItemCard paperMotionCard paperMotionInteractive" key={item.itemId}>
              <div>
                <p className="eyebrow">{safeLabel(item.category || item.subtype, "物件", 32)}</p>
                <h3>{safeLabel(item.name, "无名物件", 48)}</h3>
              </div>
              <dl className="inventoryItemStats">
                <div><dt>数量</dt><dd>{item.quantity ?? 1}{safeLabel(item.unit, "", 8)}</dd></div>
                <div><dt>品相</dt><dd>{safeLabel(item.condition, "未题", 24)}</dd></div>
                <div><dt>法度</dt><dd>{legalStatusLabels[item.legalStatus || ""] || safeLabel(item.legalStatus, "寻常", 24)}</dd></div>
                <div><dt>流转</dt><dd>{transferPolicyLabels[item.transferPolicy || ""] || safeLabel(item.transferPolicy, "待裁", 24)}</dd></div>
              </dl>
              {item.effects?.length ? <p className="peopleSummary">{item.effects.map((effect) => safeLabel(effect, "", 40)).filter(Boolean).join("；")}</p> : null}
            </article>
          )) : <p className="statusLine">{routeSessionSupported ? "此处暂无可见物件。" : unsupportedRouteMessage}</p>}
        </div>
      </section>

      <section className="inventoryTransferPanel paperMotionSurface" aria-label="物品转移">
        <div>
          <p className="eyebrow">案卷复核</p>
          <h2>移置物件</h2>
          <p>选择可流转物件和目标容器；绑定凭证、官物、禁物和容量限制仍以回批为准。</p>
        </div>
        <label>
          物件
          <select value={transferItem?.itemId || ""} onChange={(event) => {
            setLocalInventorySessionId(sessionId);
            syncTransferSelection(event.target.value, selectedTargetContainer);
            setSelectedItemId(event.target.value);
          }} disabled={!transferableItems.length}>
            {transferableItems.map((item) => (
              <option key={item.itemId} value={item.itemId}>{itemLabel(item)}</option>
            ))}
          </select>
        </label>
        <ArrowRightLeft size={18} aria-hidden="true" />
        <label>
          去处
          <select value={selectedTargetContainer} onChange={(event) => {
            setLocalInventorySessionId(sessionId);
            syncTransferSelection(transferItem?.itemId || "", event.target.value);
            setTargetContainerId(event.target.value);
          }} disabled={!targetContainers.length}>
            {targetContainers.map((container) => (
              <option key={container.containerId} value={container.containerId}>{containerLabel(container)}</option>
            ))}
          </select>
        </label>
        <button className="paperButton" type="button" disabled={!routeSessionSupported || !transferItem || !selectedTargetContainer || routeInventoryStatus === "loading"} onClick={handleTransfer}>
          呈请移置
        </button>
        {localStateIsCurrent && transferNotice ? <p className="statusLine" role="status">{transferNotice}</p> : null}
      </section>

      <section
        className="inventoryTransferPanel paperMotionSurface"
        aria-label="囊箧流转候批笺"
        data-polish-inventory="s89-23-inventory-ledger-reader"
      >
        <div>
          <p className="eyebrow">囊箧读法</p>
          <h2>流转候批笺</h2>
          <p>把本卷可见账目、当前移置选择和候批口径先列清楚；未获案卷回批前，不写成已入账或已移置。</p>
        </div>
        <dl className="surfaceSafetyList" aria-label="流转候批笺">
          <div className="surfaceSafetyRow paperMotionSurface">
            <dt>本卷取材</dt>
            <dd>资源 {resourceAccountCount} 笔，资产 {assetCount} 项，物件 {items.length} 件，凭证 {credentialCount} 件。</dd>
          </div>
          <div className="surfaceSafetyRow paperMotionSurface">
            <dt>可流转</dt>
            <dd>{transferableItems.length} 件可呈请；官物、禁物、绑定凭证和封存容器仍候回批。</dd>
          </div>
          <div className="surfaceSafetyRow paperMotionSurface">
            <dt>本次移置</dt>
            <dd>{transferLedgerRoute}</dd>
          </div>
          <div className="surfaceSafetyRow paperMotionSurface" data-polish-inventory-boundary="s89-23-transfer-boundary">
            <dt>候批边界</dt>
            <dd>{transferLedgerStatus}；浏览器只记当前选择和提示，成交、入账、扣减、赠予、借用与关系影响仍等主卷回音。</dd>
          </div>
        </dl>
      </section>

      <EconomyTraceSection
        traceView={economyTraceView}
        title="账本为何变化"
        idPrefix="inventory-economy-trace"
        runnable={runnable}
        onDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
      />

      <section
        className="inventoryReadRail paperMotionSurface"
        aria-labelledby="inventory-reader-title"
        data-polish-inventory-reader="s90-4-inventory-ledger-index"
      >
        <div className="sectionTitleRow">
          <div>
            <p className="eyebrow">账解索引</p>
            <h2 id="inventory-reader-title">囊箧四读</h2>
          </div>
          <span>{routeSessionSupported ? "只读公开账" : "断卷"}</span>
        </div>
        <dl className="inventoryReadRows" aria-label="囊箧四读">
          {inventoryReaderRows.map((row) => (
            <div className="paperMotionSurface" key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                <strong>{row.value}</strong>
                <span>{row.detail}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {inventoryView?.authorityBoundary ? (
        <p className="statusLine">
          {safeLabel(inventoryView.authorityBoundary, "囊箧、仓库、器物、账约、绑定凭证和移转结果均候案卷回批复核。", 120)}
        </p>
      ) : null}
      {routeError ? <p className="statusLine" role="alert">{routeError}</p> : null}
    </article>
  );
}

function LedgerBlock({
  icon,
  title,
  children
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="inventoryLedgerBlock paperMotionSurface">
      <h2>{icon}<span>{title}</span></h2>
      <div>{children}</div>
    </section>
  );
}
