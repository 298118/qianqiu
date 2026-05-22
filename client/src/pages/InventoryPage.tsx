import { ArrowRightLeft, Briefcase, Landmark, Package, ScrollText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router";
import type { InventoryContainerView, InventoryItemView } from "../api";
import { EconomyTraceSection } from "../components/EconomyTraceSection";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";

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
  server_only: "仅裁决"
};

function safeLabel(value: unknown, fallback: string, maxLength = 80) {
  const text = typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function itemLabel(item: InventoryItemView) {
  const quantity = typeof item.quantity === "number" ? `${item.quantity}${item.unit || ""}` : "";
  return `${safeLabel(item.name, "无名物件", 48)}${quantity ? ` · ${quantity}` : ""}`;
}

function containerLabel(container: InventoryContainerView | undefined) {
  if (!container) return "未入容器";
  const load = typeof container.currentWeight === "number" && typeof container.capacityWeight === "number"
    ? ` · ${container.currentWeight}/${container.capacityWeight}`
    : "";
  return `${safeLabel(container.label, "容器", 40)}${load}`;
}

export function InventoryPage() {
  const { sessionId = "s74-preview" } = useParams();
  const loadInventory = useGameSessionStore((state) => state.loadInventory);
  const transferInventoryItem = useGameSessionStore((state) => state.transferInventoryItem);
  const inventoryPayload = useGameSessionStore((state) => state.inventory);
  const session = useGameSessionStore((state) => state.currentSession);
  const inventoryStatus = useGameSessionStore((state) => state.inventoryStatus);
  const error = useGameSessionStore((state) => state.error);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const [selectedContainerId, setSelectedContainerId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [targetContainerId, setTargetContainerId] = useState("");
  const [transferNotice, setTransferNotice] = useState("");
  const runnable = isRunnableSessionId(sessionId);

  useEffect(() => {
    if (!runnable) return;
    void loadInventory(sessionId).catch(() => undefined);
  }, [loadInventory, runnable, sessionId]);

  const activeSession = session?.sessionId === sessionId ? session : null;
  const inventoryView = inventoryPayload?.sessionId === sessionId
    ? inventoryPayload.inventoryView
    : activeSession
      ? activeSession.inventoryView
      : null;
  const resourceLedgerView = inventoryPayload?.sessionId === sessionId
    ? inventoryPayload.resourceLedgerView
    : activeSession
      ? activeSession.resourceLedgerView
      : null;
  const assetLedgerView = inventoryPayload?.sessionId === sessionId
    ? inventoryPayload.assetLedgerView
    : activeSession
      ? activeSession.assetLedgerView
      : null;
  const economyTraceView = inventoryPayload?.sessionId === sessionId
    ? inventoryPayload.economyTraceView
    : activeSession?.economyTraceView ?? null;
  const containers = inventoryView?.containers ?? [];
  const items = inventoryView?.items ?? [];
  const containersById = useMemo(
    () => new Map(containers.map((container) => [container.containerId, container])),
    [containers]
  );
  const selectedContainer = selectedContainerId || containers[0]?.containerId || "";
  const visibleItems = selectedContainer
    ? items.filter((item) => item.containerId === selectedContainer)
    : items;
  const transferableItems = items.filter((item) => transferAllowedPolicies.has(item.transferPolicy || ""));
  const transferItem = transferableItems.find((item) => item.itemId === selectedItemId) ?? transferableItems[0];
  const targetContainers = containers.filter((container) => container.containerId !== transferItem?.containerId && !container.locked);

  useEffect(() => {
    if (!selectedContainerId && containers[0]) setSelectedContainerId(containers[0].containerId);
  }, [containers, selectedContainerId]);

  useEffect(() => {
    if (!selectedItemId && transferableItems[0]) setSelectedItemId(transferableItems[0].itemId);
  }, [selectedItemId, transferableItems]);

  useEffect(() => {
    if ((!targetContainerId || !targetContainers.some((container) => container.containerId === targetContainerId)) && targetContainers[0]) {
      setTargetContainerId(targetContainers[0].containerId);
    }
  }, [targetContainerId, targetContainers]);

  async function handleTransfer() {
    if (!transferItem || !targetContainerId || !runnable) return;
    try {
      const payload = await transferInventoryItem(sessionId, {
        itemId: transferItem.itemId,
        toContainerId: targetContainerId
      });
      setTransferNotice(payload.accepted ? "服务器已校验并更新物件位置。" : `服务器未准：${payload.reason || "规则不许"}`);
      setSelectedContainerId(targetContainerId);
      setSelectedItemId("");
      setTargetContainerId("");
    } catch {
      setTransferNotice("转移请求未能完成。");
    }
  }

  return (
    <article className="surfacePanel routePanel inventoryRoutePanel" aria-labelledby="inventory-title">
      <div className="routePanelHeader">
        <div>
          <p className="eyebrow">安全账本</p>
          <h1 id="inventory-title">囊箧</h1>
          <p>这里只读服务器生成的资源、资产、容器和物品视图；流转结果由服务器校验后回写。</p>
        </div>
        <span>{inventoryStatus === "loading" ? "候账" : `${items.length} 件`}</span>
      </div>

      <section className="inventorySummaryGrid" aria-label="资源与资产摘要">
        <LedgerBlock icon={<Briefcase size={18} aria-hidden="true" />} title="资源">
          {(resourceLedgerView?.accounts ?? []).length ? (
            resourceLedgerView?.accounts.map((account) => (
              <dl className="compactLedgerRow" key={account.accountId}>
                <dt>{safeLabel(account.label, "资源", 32)}</dt>
                <dd>{account.amount}{account.unit || ""}</dd>
              </dl>
            ))
          ) : <p className="statusLine">暂无可见资源账。</p>}
        </LedgerBlock>
        <LedgerBlock icon={<Landmark size={18} aria-hidden="true" />} title="资产">
          {(assetLedgerView?.assets ?? []).length ? (
            assetLedgerView?.assets.slice(0, 6).map((asset) => (
              <article className="inventoryMiniCard" key={asset.assetId}>
                <strong>{safeLabel(asset.name, "资产", 40)}</strong>
                <span>{safeLabel(asset.typeLabel || asset.assetType, "资产", 32)} · {safeLabel(asset.condition, "可用", 32)}</span>
              </article>
            ))
          ) : <p className="statusLine">暂无可见长期资产。</p>}
        </LedgerBlock>
        <LedgerBlock icon={<ScrollText size={18} aria-hidden="true" />} title="凭证">
          {(inventoryView?.importantCredentials ?? []).length ? (
            inventoryView?.importantCredentials.map((credential) => (
              <article className="inventoryMiniCard" key={credential.itemId}>
                <strong>{safeLabel(credential.name, "凭证", 40)}</strong>
                <span>{safeLabel(credential.authorityBoundary, "以服务器裁决为准", 64)}</span>
              </article>
            ))
          ) : <p className="statusLine">暂无重要凭证。</p>}
        </LedgerBlock>
      </section>

      <section className="inventoryWorkbench" aria-label="背包仓库工作台">
        <aside className="inventoryContainerList" aria-label="容器">
          <h2>仓储</h2>
          {containers.length ? containers.map((container) => (
            <button
              key={container.containerId}
              className="inventoryContainerButton"
              type="button"
              aria-pressed={selectedContainer === container.containerId}
              onClick={() => setSelectedContainerId(container.containerId)}
            >
              <Package size={16} aria-hidden="true" />
              <span>{containerLabel(container)}</span>
              {container.locked ? <small>封存</small> : null}
            </button>
          )) : <p className="statusLine">等待背包安全视图。</p>}
        </aside>
        <div className="inventoryItemList" aria-label="物品">
          <h2>{containerLabel(containersById.get(selectedContainer))}</h2>
          {visibleItems.length ? visibleItems.map((item) => (
            <article className="inventoryItemCard" key={item.itemId}>
              <div>
                <p className="eyebrow">{safeLabel(item.category || item.subtype, "物件", 32)}</p>
                <h3>{safeLabel(item.name, "无名物件", 48)}</h3>
              </div>
              <dl className="inventoryItemStats">
                <div><dt>数量</dt><dd>{item.quantity ?? 1}{item.unit || ""}</dd></div>
                <div><dt>品相</dt><dd>{safeLabel(item.condition, "未题", 24)}</dd></div>
                <div><dt>法度</dt><dd>{legalStatusLabels[item.legalStatus || ""] || safeLabel(item.legalStatus, "寻常", 24)}</dd></div>
                <div><dt>流转</dt><dd>{transferPolicyLabels[item.transferPolicy || ""] || safeLabel(item.transferPolicy, "待裁", 24)}</dd></div>
              </dl>
              {item.effects?.length ? <p className="peopleSummary">{item.effects.map((effect) => safeLabel(effect, "", 40)).filter(Boolean).join("；")}</p> : null}
            </article>
          )) : <p className="statusLine">此处暂无可见物件。</p>}
        </div>
      </section>

      <section className="inventoryTransferPanel" aria-label="物品转移">
        <div>
          <p className="eyebrow">服务器校验</p>
          <h2>移置物件</h2>
          <p>选择可流转物件和目标容器；绑定凭证、官物、禁物和容量限制仍以后端返回为准。</p>
        </div>
        <label>
          物件
          <select value={transferItem?.itemId || ""} onChange={(event) => setSelectedItemId(event.target.value)} disabled={!transferableItems.length}>
            {transferableItems.map((item) => (
              <option key={item.itemId} value={item.itemId}>{itemLabel(item)}</option>
            ))}
          </select>
        </label>
        <ArrowRightLeft size={18} aria-hidden="true" />
        <label>
          去处
          <select value={targetContainerId} onChange={(event) => setTargetContainerId(event.target.value)} disabled={!targetContainers.length}>
            {targetContainers.map((container) => (
              <option key={container.containerId} value={container.containerId}>{containerLabel(container)}</option>
            ))}
          </select>
        </label>
        <button className="paperButton" type="button" disabled={!transferItem || !targetContainerId || inventoryStatus === "loading"} onClick={handleTransfer}>
          呈请移置
        </button>
        {transferNotice ? <p className="statusLine" role="status">{transferNotice}</p> : null}
      </section>

      <EconomyTraceSection
        traceView={economyTraceView}
        title="账本为何变化"
        idPrefix="inventory-economy-trace"
        runnable={runnable}
        onDraft={(text) => setActionDraft({ source: "role-surface", targetPage: "game", text })}
      />

      {inventoryView?.authorityBoundary ? <p className="statusLine">{inventoryView.authorityBoundary}</p> : null}
      {error ? <p className="statusLine" role="alert">{error}</p> : null}
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
    <section className="inventoryLedgerBlock">
      <h2>{icon}<span>{title}</span></h2>
      <div>{children}</div>
    </section>
  );
}
