const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const {
  buildPlayerMonthlyBriefingContext,
  buildPlayerMonthlyBriefingView,
  ensurePlayerMonthlyBriefingState,
  resolveMonthlyBriefing,
  runPlayerMonthlyBriefingStep
} = require("../src/game/playerMonthlyBriefing");
const { applyStatePatch } = require("../src/game/stateRules");
const { runWorldTick } = require("../src/game/worldTick");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runMonthEndTick(worldState) {
  const previousState = clone(worldState);
  const worldTick = runWorldTick(worldState);
  applyStatePatch(worldState, worldTick.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  return { previousState, worldTick };
}

function snapshotProtectedState(worldState) {
  return {
    treasury: worldState.treasury,
    grainReserve: worldState.grainReserve,
    publicOrder: worldState.publicOrder,
    borderThreat: worldState.borderThreat,
    officeTitle: worldState.player.officeTitle,
    position: worldState.player.position,
    performanceMerit: worldState.player.performanceMerit,
    impeachmentRisk: worldState.player.impeachmentRisk,
    officialCareer: clone(worldState.officialCareer)
  };
}

function assertHiddenSafe(payload) {
  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes("hiddenNotes"));
  assert.ok(!serialized.includes("OPENAI_API_KEY"));
  assert.ok(!serialized.includes("data/sessions"));
  assert.ok(!serialized.includes("prompt_retrieval_index"));
  assert.ok(!serialized.includes("raw_table"));
  assert.ok(!serialized.includes("sk-test-secret"));
  assert.ok(!serialized.includes("file:///"));
  assert.ok(!serialized.includes("C:/"));
  assert.ok(!serialized.includes(".env"));
}

test("S70.10 scholar does not receive player monthly briefing", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "书生" });
  worldState.month = 2;
  worldState.tenDayPeriod = 3;
  const { previousState, worldTick } = runMonthEndTick(worldState);

  const result = runPlayerMonthlyBriefingStep(worldState, { previousState, worldTick });
  const view = buildPlayerMonthlyBriefingView(worldState);

  assert.equal(worldTick.completedMonth, true);
  assert.equal(result.generated, false);
  assert.equal(result.reason, "role_not_supported");
  assert.equal(view.active, false);
  assert.equal(view.latest, null);
});

test("S70.10 official month end records one hidden-safe player briefing without state side effects", () => {
  const worldState = createInitialState({ role: "official", playerName: "月报官" });
  worldState.year = 1644;
  worldState.month = 5;
  worldState.tenDayPeriod = 3;
  const { previousState, worldTick } = runMonthEndTick(worldState);
  const protectedBefore = snapshotProtectedState(worldState);

  const result = runPlayerMonthlyBriefingStep(worldState, { previousState, worldTick });
  const duplicate = runPlayerMonthlyBriefingStep(worldState, { previousState, worldTick });
  const protectedAfter = snapshotProtectedState(worldState);
  const view = buildPlayerMonthlyBriefingView(worldState);

  assert.equal(result.generated, true);
  assert.equal(result.reportId, view.latest.reportId);
  assert.equal(worldState.playerMonthlyBriefing.reports.length, 1);
  assert.equal(worldState.playerMonthlyBriefing.lastPeriodKey, "1644-05");
  assert.equal(duplicate.generated, false);
  assert.equal(duplicate.reason, "period_already_recorded");
  assert.equal(worldState.playerMonthlyBriefing.reports.length, 1);
  assert.deepEqual(protectedAfter, protectedBefore);
  assert.equal(view.active, true);
  assert.equal(view.latest.periodKey, "1644-05");
  assert.ok(view.latest.sections.some((section) => section.id === "official_duties"));
  assert.ok(view.latest.actionItems.length >= 1);
  assert.ok(view.latest.sourceRefs.length >= 1);
  assertHiddenSafe(view);
});

test("S88.4 official monthly briefing includes first month receipt and next actions", () => {
  const worldState = createInitialState({ role: "official", playerName: "首月官" });
  Object.assign(worldState.player, {
    officeTitle: "翰林院编修",
    position: "翰林院编修",
    performanceMerit: 46,
    impeachmentRisk: 18
  });
  worldState.year = 1644;
  worldState.month = 6;
  worldState.tenDayPeriod = 3;
  worldState.officialCareer.currentPosting = "翰林院编修";
  worldState.officialCareer.assignments = [{
    id: "ASG-0000-first-month-top_hanlin_editor",
    title: "馆阁讲章校订",
    kind: "memorial_drafting",
    dueTurn: 3,
    deadlineUnit: "ten_day",
    progress: 66,
    risk: 24,
    visibleSummary: "首月须校订馆阁讲章并试拟制诰。",
    hiddenNotes: ["密札不可见"]
  }];
  const { previousState, worldTick } = runMonthEndTick(worldState);

  const result = runPlayerMonthlyBriefingStep(worldState, { previousState, worldTick });
  const view = buildPlayerMonthlyBriefingView(worldState);
  const officialDuties = view.latest.sections.find((section) => section.id === "official_duties");
  const courtNetwork = view.latest.sections.find((section) => section.id === "court_network");
  const serialized = JSON.stringify(view);

  assert.equal(result.generated, true);
  assert.ok(officialDuties.items.some((item) => item.includes("馆阁讲章校订")));
  assert.ok(courtNetwork.items.some((item) => item.includes("堂官") || item.includes("同年")));
  assert.ok(view.latest.actionItems.some((item) => item.includes("馆阁讲章校订")));
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("密札不可见"), false);
  assertHiddenSafe(view);
});

test("S70.10 resolver sanitizes unsafe monthly briefing proposals before view exposure", () => {
  const worldState = createInitialState({ role: "official", playerName: "脱敏官" });
  ensurePlayerMonthlyBriefingState(worldState);
  const context = buildPlayerMonthlyBriefingContext(worldState, {
    period: {
      key: "1644-07",
      label: "明1644年7月",
      date: { year: 1644, month: 7, tenDayPeriod: 3, turn: 0 }
    }
  });

  const result = resolveMonthlyBriefing(worldState, {
    title: "hiddenNotes raw_table file:///home/user/.env",
    publicSummary: "OPENAI_API_KEY sk-test-secret data/sessions/raw.json file:///C:/secret/.env",
    sections: [{
      id: "official_duties",
      title: "prompt path key file:///home/user/.env",
      publicSummary: "worldState provider proposal file:///home/user/.env",
      items: ["正常差事可保留", "prompt_retrieval_index", "C:/Users/test/.env"]
    }],
    actionItems: ["下月复核案牍", "/mnt/e/LSMNQ/data/sessions/raw.json", "file:///home/user/.env"],
    riskItems: ["sk-test-secret", "C:/Users/test/.env"],
    sourceRefs: [
      { id: "data/sessions/raw.json", label: "raw_table", source: "prompt" },
      { id: "file:///home/user/.env", label: "file:///home/user/.env", source: "file:///C:/secret/.env" }
    ]
  }, { context });
  const view = buildPlayerMonthlyBriefingView(worldState);
  const archiveView = buildEventArchiveView(worldState, { pageSize: 50 });

  assert.equal(result.generated, true);
  assert.equal(view.latest.title, "官职月报");
  assert.equal(view.latest.publicSummary, "本月官务已由服务器整理成公开月报。");
  assert.deepEqual(view.latest.sourceRefs, []);
  assertHiddenSafe(view);
  assertHiddenSafe(archiveView);
  assert.ok(archiveView.items.some((item) => item.sourceType === "monthly_briefing"));
});

test("S70.10 monthly briefing archive drops legacy file URI path pollution", () => {
  const worldState = createInitialState({ role: "official", playerName: "旧档官" });
  worldState.playerMonthlyBriefing = {
    schemaVersion: "s70.10-player-monthly-briefing.v1",
    lastPeriodKey: "1644-08",
    reports: [{
      id: "PMB-legacy-file-uri",
      reportId: "PMB-legacy-file-uri",
      periodKey: "1644-08",
      periodLabel: "明1644年8月",
      generatedAtTurn: 3,
      generatedAt: { year: 1644, month: 9, tenDayPeriod: 1, turn: 3 },
      role: "official",
      roleLabel: "入仕官员",
      title: "file:///home/user/.env",
      publicSummary: "file:///C:/Users/test/.env",
      riskItems: ["file:///home/user/.env"],
      sourceRefs: [{ label: "file:///home/user/.env", source: "file:///C:/Users/test/.env" }]
    }]
  };

  const archiveView = buildEventArchiveView(worldState, { pageSize: 50 });
  assertHiddenSafe(archiveView);
  assert.ok(!archiveView.items.some((item) => item.sourceType === "monthly_briefing"));
});
