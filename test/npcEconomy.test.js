const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { buildClientWorldState } = require("../src/game/clientWorldState");
const { createLandSurveyDelegatedTask } = require("../src/game/delegatedTasks");
const {
  buildMarketPriceView,
  buildNpcEconomyView,
  runNpcEconomyTickStep
} = require("../src/game/npcEconomy");
const { runWorldTick } = require("../src/game/worldTick");
const { applyStatePatch } = require("../src/game/stateRules");
const { resolveTradeRequest } = require("../src/game/tradeLedger");

function advanceToMonthlyTick(worldState) {
  const worldTick = runWorldTick(worldState);
  applyStatePatch(worldState, worldTick.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  return worldTick;
}

test("S85 market price view exposes role-aware safe base prices", () => {
  const scholar = createInitialState({ role: "scholar", playerName: "市价书生" });
  const magistrate = createInitialState({ role: "magistrate", playerName: "市价知县" });
  const scholarView = buildMarketPriceView(scholar);
  const magistrateView = buildMarketPriceView(magistrate);
  const scholarBook = scholarView.priceRows.find((row) => row.priceId === "book_basic");
  const magistrateOffice = magistrateView.priceRows.find((row) => row.priceId === "office_budget_unit");
  const serialized = JSON.stringify(scholarView);

  assert.ok(scholarBook);
  assert.ok(magistrateOffice);
  assert.ok(scholarView.priceRows.some((row) => row.priceId === "grain_shi"));
  assert.ok(scholarBook.currentSilverLiang > 0);
  assert.ok(magistrateOffice.currentSilverLiang > 0);
  assert.equal(scholarView.safeguards.serverOwnsSettlement, true);
  assert.doesNotMatch(serialized, /hiddenDossier|rawLedger|statePatch|worldState|sk-[A-Za-z0-9_-]{6,}/);
});

test("S85 monthly NPC economy settles due tasks, stale trades, prices and safe client projection", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "月结知县" });
  worldState.year = 1644;
  worldState.month = 2;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 12;
  worldState.player.localTreasury = 80;

  const task = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩，核对鱼鳞册。",
    budget: 24
  });
  assert.equal(task.ok, true);
  task.task.dueTime = { year: 1644, month: 3, tenDayPeriod: 1, turn: 12 };

  const trade = resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:s85:old-paper",
    silverDelta: 0,
    offerSummary: "议买纸张与地方消息。"
  }, {
    npcResponse: "可再议。",
    proposal: {
      status: "countered",
      publicSummary: "暂记议价，待后续确认。",
      riskTags: []
    }
  });
  assert.equal(trade.ok, true);
  trade.record.turn = 1;

  const worldTick = advanceToMonthlyTick(worldState);
  const result = runNpcEconomyTickStep(worldState, { worldTick });
  const economyView = buildNpcEconomyView(worldState);
  const clientState = buildClientWorldState(worldState);
  const serialized = JSON.stringify({ result, economyView, clientState });

  assert.equal(worldTick.completedMonth, true);
  assert.equal(result.cadence, "monthly");
  assert.equal(result.outcome.delegatedTasksResolved, 1);
  assert.equal(result.outcome.tradeCommitmentsUpdated, 1);
  assert.ok(["completed", "failed"].includes(worldState.delegatedTaskLedger.tasks[0].status));
  assert.equal(worldState.tradeLedger.records[0].status, "rejected");
  assert.ok(result.attributeChanges.every((change) => !/^(assetLedger|resourceLedger|inventoryLedger)\./.test(change.path)));
  assert.ok(buildMarketPriceView(worldState).priceRows.length > 0);
  assert.equal(economyView.safeguards.serverOwnsAssetsAndTasks, true);
  assert.equal(clientState.marketPriceLedger, undefined);
  assert.equal(clientState.npcEconomyLedger, undefined);
  assert.doesNotMatch(serialized, /hiddenDossier|privateSignalTags|rawLedger|serverPlan|sk-[A-Za-z0-9_-]{6,}/);
});

test("S85 delegated task month-end uses server-confirmed treasury instead of oversized legacy budget", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "守库知县" });
  worldState.year = 1644;
  worldState.month = 2;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 12;
  worldState.corruption = 60;
  worldState.player.integrity = 56;
  worldState.player.localTreasury = 12;

  const task = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "以最低经费清丈东乡。",
    budget: 12
  });
  assert.equal(task.ok, true);
  task.task.dueTime = { year: 1644, month: 3, tenDayPeriod: 1, turn: 12 };
  task.task.budget = 100000;

  const worldTick = advanceToMonthlyTick(worldState);
  const result = runNpcEconomyTickStep(worldState, { worldTick });

  assert.equal(result.outcome.delegatedTasksResolved, 1);
  assert.equal(worldState.player.localTreasury, 0);
  assert.equal(worldState.delegatedTaskLedger.tasks[0].status, "failed");
});

test("S85 ten-day NPC economy refreshes prices without resolving monthly commitments", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "旬更知县" });
  worldState.year = 1644;
  worldState.month = 2;
  worldState.tenDayPeriod = 1;
  worldState.turnCount = 8;
  const task = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "预备东乡清丈。",
    budget: 24
  });
  assert.equal(task.ok, true);
  task.task.dueTime = { year: 1644, month: 2, tenDayPeriod: 2, turn: 8 };
  const beforeHistory = buildMarketPriceView(worldState).history.length;

  const result = runNpcEconomyTickStep(worldState, {
    worldTick: { completedMonth: false }
  });

  assert.equal(result.cadence, "ten_day");
  assert.equal(result.outcome.priceRowsUpdated > 0, true);
  assert.equal(result.outcome.delegatedTasksResolved, 0);
  assert.equal(worldState.delegatedTaskLedger.tasks[0].status, "active");
  assert.equal(buildMarketPriceView(worldState).history.length, beforeHistory + 1);
});
