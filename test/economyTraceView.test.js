const test = require("node:test");
const assert = require("node:assert/strict");

const { buildEconomyTraceView } = require("../src/game/economyTraceView");
const { createInitialState } = require("../src/game/initialState");

test("S88.8 economyTraceView explains safe economy rows without exposing raw ledgers", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "账本测试知县" });
  worldState.year = 1644;
  worldState.month = 4;
  worldState.tenDayPeriod = 1;
  worldState.turnCount = 18;

  const view = buildEconomyTraceView(worldState, {
    economyFeedback: {
      attributeChanges: [
        {
          path: "economy.resources",
          label: "银两",
          before: 80,
          after: 68,
          reason: "修桥支出已由服务器月结登记。"
        },
        {
          path: "worldState.privateLedger",
          label: "hiddenNotes provider payload",
          before: 1,
          after: 2,
          reason: "data/sessions/secret.json"
        }
      ]
    },
    views: {
      resourceLedgerView: {
        accounts: [{
          accountId: "resource:silver",
          resourceId: "silver_liang",
          label: "银两",
          amount: 68,
          unit: "两"
        }]
      },
      assetLedgerView: {
        assets: [{
          assetId: "asset:estate:1",
          name: "东乡薄田",
          assetType: "estate",
          typeLabel: "田产",
          condition: "可用",
          productivity: 52
        }]
      },
      inventoryView: {
        items: [{
          itemId: "item:ledger",
          name: "清丈册",
          category: "文书",
          condition: "需修补",
          durability: 72,
          transferPolicy: "server_only"
        }]
      },
      tradeLedgerView: {
        items: [
          {
            tradeId: "trade:safe",
            npcName: "韩员外",
            status: "countered",
            publicSummary: "议买纸张与粮价消息，尚待服务器确认。",
            requestedSilverDelta: -4,
            riskTags: ["议价"]
          },
          {
            tradeId: "trade:bad",
            npcName: "provider payload",
            status: "countered",
            publicSummary: "hiddenNotes sk-test-secret"
          }
        ]
      },
      delegatedTaskView: {
        items: [{
          taskId: "task:safe",
          title: "东乡清丈",
          status: "completed",
          assignee: { displayName: "陆知事" },
          result: { summary: "东乡鱼鳞册已核出两处错漏。" },
          budget: 24,
          riskFactors: ["田册"]
        }]
      },
      marketPriceView: {
        priceRows: [{
          priceId: "grain",
          label: "粟米",
          trend: "up",
          trendLabel: "上行",
          availability: "偏紧",
          marketPressure: 65,
          drivers: ["春荒", "转运迟滞"],
          currentSilverLiang: 1.4
        }]
      },
      npcEconomyView: {
        recentEvents: [
          "人情债月账：韩员外因修桥垫付，公开人情债略增。",
          "provider payload hiddenNotes data/sessions/secret.json"
        ]
      }
    }
  });

  const serialized = JSON.stringify(view);
  const traceTypes = new Set(view.traceItems.map((item) => item.traceType));

  assert.equal(view.schemaVersion, "s88.8-economy-trace.v1");
  assert.ok(view.traceItems.length >= 6);
  assert.equal(view.safeguards.serverOwnsSettlement, true);
  assert.equal(view.safeguards.rawLedgersRedacted, true);
  assert.ok(traceTypes.has("resource_delta"));
  assert.ok(traceTypes.has("trade_negotiation"));
  assert.ok(traceTypes.has("delegated_task_result"));
  assert.ok(traceTypes.has("human_debt_monthly"));
  assert.ok(view.traceItems.every((item) => Array.isArray(item.sourceRefs)));
  assert.ok(view.traceItems.every((item) => item.sourceRefs.every((ref) => ref.refId.startsWith("economy-trace:"))));
  assert.ok(view.traceItems.every((item) => item.sourceId && !/_/.test(item.sourceId)));
  assert.ok(view.traceItems.every((item) => item.label === item.title && item.summary === item.publicSummary));
  assert.ok(view.traceItems.every((item) => item.visibility === "player_visible"));
  assert.ok(view.traceItems.every((item) => item.confidence >= 0 && item.confidence <= 1));
  assert.ok(view.traceItems.some((item) =>
    item.traceType === "trade_negotiation" && item.topicSurfaceIds.includes("npc-profile")
  ));
  assert.ok(view.traceItems.some((item) =>
    item.traceType === "inventory_aging" && item.topicSurfaceIds.includes("inventory-only")
  ));
  assert.doesNotMatch(
    serialized,
    /"resourceLedger":|"assetLedger":|"inventoryLedger":|"tradeLedger":|"delegatedTaskLedger":|"npcEconomyLedger":|"marketPriceLedger":|"evidenceRefs":|"hiddenNotes"|provider payload|data\/sessions|sqlite|SQLite|SQL|sk-[A-Za-z0-9_-]{6,}/
  );
});

test("S88.8 economyTraceView tolerates polluted source ids without throwing", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "旧账污染" });

  assert.doesNotThrow(() => buildEconomyTraceView(worldState, {
    views: {
      resourceLedgerView: {
        accounts: [{
          resourceId: "safe_search_index",
          label: "银两",
          amount: 12,
          unit: "两"
        }]
      },
      assetLedgerView: { assets: [] },
      inventoryView: { items: [] },
      tradeLedgerView: { items: [] },
      delegatedTaskView: { items: [] },
      marketPriceView: { priceRows: [] },
      npcEconomyView: { recentEvents: [] }
    }
  }));

  const view = buildEconomyTraceView(worldState, {
    views: {
      resourceLedgerView: {
        accounts: [{
          resourceId: "safe_search_index",
          label: "银两",
          amount: 12,
          unit: "两"
        }]
      },
      assetLedgerView: { assets: [] },
      inventoryView: { items: [] },
      tradeLedgerView: { items: [] },
      delegatedTaskView: { items: [] },
      marketPriceView: { priceRows: [] },
      npcEconomyView: { recentEvents: [] }
    }
  });

  assert.ok(view.traceItems.some((item) => item.sourceId === "resource:0"));
  assert.doesNotMatch(JSON.stringify(view), /safe_search_index|SQLite|sqlite|SQL/);
});
