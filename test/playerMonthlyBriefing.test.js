const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const { buildOfficialCareerView, ensureOfficialCareerState } = require("../src/game/officialCareer");
const {
  buildPlayerMonthlyBriefingContext,
  buildPlayerMonthlyBriefingView,
  ensurePlayerMonthlyBriefingState,
  generateMonthlyBriefingProposal,
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

test("S88.4 official monthly briefing includes court entry adjudication outcome", () => {
  const worldState = createInitialState({ role: "official", playerName: "奏议官" });
  Object.assign(worldState.player, {
    officeTitle: "翰林院编修",
    position: "翰林院编修",
    performanceMerit: 50,
    impeachmentRisk: 18
  });
  worldState.year = 1644;
  worldState.month = 7;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 6;
  worldState.officialCareer.currentPosting = "翰林院编修";
  worldState.officialCareer.assignments = [{
    id: "ASG-0000-first-month-top_hanlin_editor",
    title: "馆阁讲章校订",
    kind: "memorial_drafting",
    dueTurn: 7,
    deadlineUnit: "ten_day",
    progress: 88,
    risk: 22,
    visibleSummary: "首月须校订馆阁讲章并试拟制诰。",
    hiddenNotes: ["密札不可见"]
  }];
  ensureOfficialCareerState(worldState);
  const entryId = buildOfficialCareerView(worldState).courtEntry.id;
  worldState.officialCareer.courtEntryResolutions = [{
    id: "OCER-monthly-court-entry",
    entryId,
    assignmentId: "ASG-0000-first-month-top_hanlin_editor",
    surfaceId: "memorial-review",
    submissionKind: "official_first_month_memorial",
    status: "accepted_for_review",
    statusLabel: "准入复核",
    title: "准入复核：馆阁讲章校订",
    publicSummary: "准入复核：馆阁讲章校订已入奏折队列服务器裁决，公开进度88、风险22；考成微调为功绩+3、风险-2，不直接任免、奖惩、处分或成弹劾。",
    serverDecision: "服务器只记录本次呈上处理，不直接任免、处分或成弹劾。",
    meritDelta: 3,
    riskDelta: -2,
    progressDelta: 7,
    generatedAtTurn: 6,
    year: 1644,
    month: 7,
    tenDayPeriod: 3,
    sourceRefs: [`officialCareer.courtEntry:${entryId}`],
    nextStep: "准入奏折队列，由部院复核公开凭据后再入长期考成。"
  }];
  worldState.officialCareer.courtEntryFollowUps = [{
    id: "OCEF-monthly-follow-up",
    entryId,
    resolutionId: "OCER-monthly-court-entry",
    assignmentId: "ASG-0000-first-month-top_hanlin_editor",
    stage: "bureau_review",
    stageLabel: "部院覆奏",
    status: "referred_to_bureau",
    statusLabel: "部院待覆",
    title: "部院覆奏：馆阁讲章校订",
    publicSummary: "部院待覆：馆阁讲章校订承接近次准入复核进入部院覆奏，皇帝、部院、台谏只形成公开中间意见，不直接任免、奖惩、处分或成弹劾。",
    participantSummaries: [],
    proposalSummaries: [],
    meritDelta: 1,
    riskDelta: -1,
    progressDelta: 4,
    generatedAtTurn: 6,
    year: 1644,
    month: 7,
    tenDayPeriod: 3,
    sourceRefs: [`officialCareer.courtEntry:${entryId}`],
    consequenceRefs: ["worldThread:official_court_follow_up"],
    nextStep: "相关部院待覆，下一步补齐公开凭据、限期和经手人。"
  }];
  const { previousState, worldTick } = runMonthEndTick(worldState);

  const result = runPlayerMonthlyBriefingStep(worldState, { previousState, worldTick });
  const view = buildPlayerMonthlyBriefingView(worldState);
  const officialDuties = view.latest.sections.find((section) => section.id === "official_duties");
  const archiveView = buildEventArchiveView(worldState, { pageSize: 50 });
  const serialized = JSON.stringify({ view, archiveView });

  assert.equal(result.generated, true);
  assert.ok(officialDuties.items.some((item) => item.includes("准入复核") && item.includes("馆阁讲章校订")));
  assert.ok(officialDuties.items.some((item) => item.includes("部院待覆") && item.includes("馆阁讲章校订")));
  assert.ok(view.latest.actionItems.some((item) => item.includes("奏折队列") || item.includes("部院复核")));
  assert.ok(view.latest.actionItems.some((item) => item.includes("部院待覆") || item.includes("公开凭据")));
  assert.ok(archiveView.items.some((item) => item.sourceType === "monthly_briefing"));
  assert.ok(archiveView.items.some((item) => item.sourceType === "official_court_follow_up"));
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

test("S88.6 monthly briefing does not re-promote the same domain consequence across periods", () => {
  const worldState = createInitialState({ role: "official", playerName: "后果月报官" });
  worldState.year = 1644;
  worldState.month = 8;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 24;
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "monthly-domain-replay-source",
      policyType: "market_regulation",
      policyLabel: "平抑米价复核",
      status: "accepted",
      publicSummary: "米价波动仍牵动民心，需在后续月报观察。",
      publicSourceId: "monthly-domain-public-source",
      stateDelta: { publicOrder: -5 },
      appliedAtTurn: 24,
      year: 1644,
      month: 8,
      tenDayPeriod: 3
    }]
  };

  const firstContext = buildPlayerMonthlyBriefingContext(worldState, {
    period: {
      key: "1644-08",
      label: "明1644年8月",
      date: { year: 1644, month: 8, tenDayPeriod: 3, turn: 24 }
    }
  });
  const firstProposal = generateMonthlyBriefingProposal(firstContext);
  const firstDomainRef = firstContext.sourceRefs.find((ref) => ref.source === "domain_consequence");

  assert.ok(firstDomainRef);
  assert.match(firstDomainRef.id, /^domainConsequenceEcho:/);
  assert.ok(firstProposal.actionItems.some((item) => item.includes("平抑米价复核")));
  assert.ok(firstProposal.riskItems.some((item) => item.includes("米价波动仍牵动民心")));

  const firstResult = resolveMonthlyBriefing(worldState, firstProposal, { context: firstContext });
  assert.equal(firstResult.generated, true);

  worldState.month = 9;
  worldState.turnCount = 27;
  const secondContext = buildPlayerMonthlyBriefingContext(worldState, {
    period: {
      key: "1644-09",
      label: "明1644年9月",
      date: { year: 1644, month: 9, tenDayPeriod: 3, turn: 27 }
    }
  });
  const secondProposal = generateMonthlyBriefingProposal(secondContext);

  assert.equal(secondContext.sourceRefs.some((ref) => ref.source === "domain_consequence"), false);
  assert.equal(secondProposal.actionItems.some((item) => item.includes("平抑米价复核")), false);
  assert.equal(secondProposal.riskItems.some((item) => item.includes("米价波动仍牵动民心")), false);
  assertHiddenSafe({ firstContext, firstProposal, secondContext, secondProposal });
});

test("S88.6 monthly briefing does not block a new same-title domain consequence", () => {
  const worldState = createInitialState({ role: "official", playerName: "同题月报官" });
  worldState.year = 1644;
  worldState.month = 8;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 30;
  worldState.cityPolicyLedger = {
    records: [
      {
        outcomeId: "monthly-domain-same-title-old",
        policyType: "market_regulation",
        policyLabel: "平抑米价复核",
        status: "accepted",
        publicSummary: "城北米铺照牌价出售，民心暂稳。",
        publicSourceId: "monthly-domain-same-title-old-source",
        stateDelta: { publicOrder: 2 },
        appliedAtTurn: 27,
        year: 1644,
        month: 8,
        tenDayPeriod: 1
      },
      {
        outcomeId: "monthly-domain-same-title-new",
        policyType: "market_regulation",
        policyLabel: "平抑米价复核",
        status: "accepted",
        publicSummary: "城南米铺照牌价出售，库银压力上升。",
        publicSourceId: "monthly-domain-same-title-new-source",
        stateDelta: { treasury: -5 },
        appliedAtTurn: 30,
        year: 1644,
        month: 8,
        tenDayPeriod: 3
      }
    ]
  };

  const firstContext = buildPlayerMonthlyBriefingContext(worldState, {
    period: {
      key: "1644-08",
      label: "明1644年8月",
      date: { year: 1644, month: 8, tenDayPeriod: 3, turn: 30 }
    }
  });
  const firstEchoRef = firstContext.monthlyDomainConsequence?.publicEchoRef;
  const firstProposal = generateMonthlyBriefingProposal(firstContext);
  resolveMonthlyBriefing(worldState, firstProposal, { context: firstContext });

  worldState.month = 9;
  worldState.turnCount = 33;
  const secondContext = buildPlayerMonthlyBriefingContext(worldState, {
    period: {
      key: "1644-09",
      label: "明1644年9月",
      date: { year: 1644, month: 9, tenDayPeriod: 3, turn: 33 }
    }
  });
  const secondEchoRef = secondContext.monthlyDomainConsequence?.publicEchoRef;

  assert.ok(firstEchoRef);
  assert.ok(secondEchoRef);
  assert.notEqual(secondEchoRef, firstEchoRef);
  assert.equal(secondContext.monthlyDomainConsequence.publicSummary.includes("城北米铺"), true);
  assert.equal(secondContext.sourceRefs.some((ref) =>
    ref.source === "domain_consequence" && ref.id === secondEchoRef
  ), true);
  assertHiddenSafe({ firstContext, secondContext });
});
