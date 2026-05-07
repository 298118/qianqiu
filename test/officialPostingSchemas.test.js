const test = require("node:test");
const assert = require("node:assert/strict");

const { validatePayload } = require("../src/ai/schemas");
const { createInitialState } = require("../src/game/initialState");
const { listBureaus, listOffices } = require("../src/game/officialCatalog");
const { applyStatePatch } = require("../src/game/stateRules");
const {
  OFFICIAL_POSTING_SCHEMA_VERSION,
  buildOfficialPostingSchemaView,
  canSeeOfficialPostingRow,
  normalizeOfficialPostingSchemaBundle,
  summarizeOfficialPostingSchemaForPrompt
} = require("../src/game/officialPostingSchemas");

function officialState() {
  const worldState = createInitialState({ role: "official", playerName: "Posting Tester" });
  worldState.player.id = "P1";
  worldState.player.officeTitle = "户部主事";
  worldState.player.position = "户部主事";
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.bureauId = "ministry_revenue";
  worldState.turnCount = 9;
  worldState.year = 1645;
  worldState.month = 5;
  worldState.tenDayPeriod = 2;
  return worldState;
}

function samplePostingBundle() {
  return {
    bureaus: [{
      id: "ministry_revenue",
      name: "户部",
      aliases: ["度支", "度支"],
      level: "court",
      officeIds: ["ministry_revenue_principal", "office-hidden"],
      jurisdictionIds: ["jurisdiction-suzhou", "jurisdiction-hidden"],
      duties: ["钱粮", "仓场"],
      hiddenNotes: ["SEALED_BUREAU_NOTE"]
    }, {
      id: "bureau-hidden",
      name: "密札衙门",
      visibility: "hidden",
      publicSummary: "SEALED_BUREAU_SUMMARY",
      hiddenNotes: ["SEALED_HIDDEN_BUREAU_NOTE"]
    }],
    offices: [{
      id: "ministry_revenue_principal",
      title: "户部主事",
      bureauId: "ministry_revenue",
      normalTermMonths: 999,
      promotionPathIds: ["office-hidden"],
      duties: ["钱粮", "奏销"],
      hiddenNotes: ["SEALED_OFFICE_NOTE"]
    }, {
      id: "office-hidden",
      title: "密授阁臣",
      bureauId: "bureau-hidden",
      visibility: "hidden",
      publicSummary: "SEALED_OFFICE_SUMMARY"
    }],
    cityJurisdictions: [{
      id: "jurisdiction-suzhou",
      name: "苏州府钱粮辖区",
      bureauId: "ministry_revenue",
      supervisingBureauId: "ministry_revenue",
      cityId: "city-suzhou",
      regionId: "region-jiangnan",
      availableOfficeIds: ["ministry_revenue_principal", "office-hidden"],
      publicOrder: 120,
      lawsuits: -5,
      publicSummary: "苏州府钱粮与漕运相连。"
    }, {
      id: "jurisdiction-hidden",
      name: "密查辖区",
      bureauId: "bureau-hidden",
      visibility: "hidden",
      publicSummary: "SEALED_JURISDICTION_SUMMARY"
    }],
    postings: [{
      id: "posting-player-revenue",
      officeId: "ministry_revenue_principal",
      officeTitle: "户部主事",
      bureauId: "ministry_revenue",
      holderType: "player",
      holderId: "P1",
      cityId: "city-beijing",
      jurisdictionId: "jurisdiction-suzhou",
      superiorPostingId: "posting-hidden-superior",
      startedYear: 1645,
      startedMonth: 5,
      startedTenDayPeriod: 2,
      performanceScore: 150,
      impeachmentRisk: -4,
      publicSummary: "玩家当前在户部办钱粮。"
    }, {
      id: "posting-hidden-superior",
      officeId: "office-hidden",
      bureauId: "bureau-hidden",
      holderType: "npc",
      holderId: "npc-sealed",
      visibility: "hidden",
      publicSummary: "SEALED_POSTING_SUMMARY"
    }],
    assessmentRecords: [{
      id: "assessment-player-revenue",
      postingId: "posting-player-revenue",
      officeId: "ministry_revenue_principal",
      bureauId: "ministry_revenue",
      holderType: "player",
      holderId: "P1",
      meritScore: 130,
      riskScore: -10,
      recommendation: "promotion",
      publicFinding: "钱粮簿册已入考成。"
    }, {
      id: "assessment-hidden",
      postingId: "posting-hidden-superior",
      visibility: "hidden",
      publicSummary: "SEALED_ASSESSMENT_SUMMARY"
    }],
    transferRecords: [{
      id: "transfer-player-revenue",
      holderType: "player",
      holderId: "P1",
      fromPostingId: "posting-player-revenue",
      fromOfficeId: "ministry_revenue_principal",
      fromCityId: "city-beijing",
      toCityId: "city-suzhou",
      relatedAssessmentId: "assessment-player-revenue",
      type: "outpost",
      status: "approved",
      publicReason: "以钱粮考成外放查核。"
    }, {
      id: "transfer-hidden",
      holderType: "npc",
      holderId: "npc-sealed",
      fromPostingId: "posting-hidden-superior",
      visibility: "hidden",
      publicSummary: "SEALED_TRANSFER_SUMMARY"
    }],
    recentNotes: ["SEALED_RECENT_NOTE"]
  };
}

test("official posting schema bundle normalizes offices, postings, assessments, and transfers", () => {
  const bundle = normalizeOfficialPostingSchemaBundle(samplePostingBundle(), officialState());

  assert.equal(bundle.schemaVersion, OFFICIAL_POSTING_SCHEMA_VERSION);
  assert.equal(bundle.generatedAtTurn, 9);
  assert.equal(bundle.bureaus.length, 2);
  assert.equal(bundle.offices.length, 2);
  assert.equal(bundle.cityJurisdictions.length, 2);
  assert.equal(bundle.postings.length, 2);
  assert.equal(bundle.assessmentRecords.length, 2);
  assert.equal(bundle.transferRecords.length, 2);

  const office = bundle.offices.find((entry) => entry.id === "ministry_revenue_principal");
  assert.equal(office.normalTermMonths, 120);

  const jurisdiction = bundle.cityJurisdictions.find((entry) => entry.id === "jurisdiction-suzhou");
  assert.equal(jurisdiction.localMetrics.publicOrder, 100);
  assert.equal(jurisdiction.localMetrics.lawsuits, 0);

  const posting = bundle.postings.find((entry) => entry.id === "posting-player-revenue");
  assert.equal(posting.startedAt.year, 1645);
  assert.equal(posting.startedAt.month, 5);
  assert.equal(posting.startedAt.tenDayPeriod, 2);
  assert.equal(posting.performanceScore, 100);
  assert.equal(posting.impeachmentRisk, 0);

  const assessment = bundle.assessmentRecords.find((entry) => entry.id === "assessment-player-revenue");
  assert.equal(assessment.meritScore, 100);
  assert.equal(assessment.riskScore, 0);
});

test("official posting view filters hidden rows, hidden notes, and hidden nested refs", () => {
  const view = buildOfficialPostingSchemaView(samplePostingBundle(), officialState());
  const serialized = JSON.stringify(view);

  assert.ok(view.bureaus.some((entry) => entry.id === "ministry_revenue"));
  assert.ok(view.offices.some((entry) => entry.id === "ministry_revenue_principal"));
  assert.ok(view.cityJurisdictions.some((entry) => entry.id === "jurisdiction-suzhou"));
  assert.ok(view.postings.some((entry) => entry.id === "posting-player-revenue"));
  assert.ok(view.assessmentRecords.some((entry) => entry.id === "assessment-player-revenue"));
  assert.ok(view.transferRecords.some((entry) => entry.id === "transfer-player-revenue"));

  const bureau = view.bureaus.find((entry) => entry.id === "ministry_revenue");
  assert.deepEqual(bureau.officeIds, ["ministry_revenue_principal"]);
  assert.deepEqual(bureau.jurisdictionIds, ["jurisdiction-suzhou"]);

  const office = view.offices.find((entry) => entry.id === "ministry_revenue_principal");
  assert.deepEqual(office.promotionPathIds, []);

  const posting = view.postings.find((entry) => entry.id === "posting-player-revenue");
  assert.equal(posting.superiorPostingId, null);
  const jurisdiction = view.cityJurisdictions.find((entry) => entry.id === "jurisdiction-suzhou");
  assert.deepEqual(jurisdiction.availableOfficeIds, ["ministry_revenue_principal"]);

  assert.equal(serialized.includes("bureau-hidden"), false);
  assert.equal(serialized.includes("office-hidden"), false);
  assert.equal(serialized.includes("posting-hidden-superior"), false);
  assert.equal(serialized.includes("SEALED_BUREAU_NOTE"), false);
  assert.equal(serialized.includes("SEALED_OFFICE_SUMMARY"), false);
  assert.equal(serialized.includes("SEALED_POSTING_SUMMARY"), false);
  assert.equal(serialized.includes("SEALED_ASSESSMENT_SUMMARY"), false);
  assert.equal(serialized.includes("SEALED_TRANSFER_SUMMARY"), false);
  assert.equal(serialized.includes("SEALED_RECENT_NOTE"), false);
  assert.ok(view.hiddenNotice);
});

test("official posting visibility distinguishes scholar, official role, and same-office rows", () => {
  const scholarState = createInitialState({ role: "scholar", playerName: "Scholar" });
  const revenueOfficial = officialState();
  const ritesOfficial = officialState();
  ritesOfficial.player.officeTitle = "礼部主事";
  ritesOfficial.officialCareer.currentPosting = "礼部主事";
  ritesOfficial.officialCareer.bureauId = "ministry_rites";

  const roleVisible = {
    id: "role-visible-bureau",
    visibility: "role_visible",
    knownToPlayer: false
  };
  const officeVisibleRevenue = {
    id: "posting-revenue",
    visibility: "office_visible",
    knownToPlayer: false,
    bureauId: "ministry_revenue"
  };
  const relationshipVisible = {
    id: "relationship-visible-row",
    visibility: "relationship_visible",
    knownToPlayer: true
  };

  assert.equal(canSeeOfficialPostingRow(roleVisible, scholarState), false);
  assert.equal(canSeeOfficialPostingRow(roleVisible, revenueOfficial), true);
  assert.equal(canSeeOfficialPostingRow(officeVisibleRevenue, revenueOfficial), true);
  assert.equal(canSeeOfficialPostingRow(officeVisibleRevenue, ritesOfficial), false);
  assert.equal(canSeeOfficialPostingRow(relationshipVisible, scholarState), true);
});

test("official posting prompt summary is capped and excludes hidden records", () => {
  const bundle = {
    bureaus: [{ id: "ministry_revenue", name: "户部" }],
    offices: Array.from({ length: 12 }, (_, index) => ({
      id: `office-visible-${index}`,
      title: `可见官职${index}`,
      bureauId: "ministry_revenue",
      publicSummary: `可见官职摘要${index}`
    })).concat([{
      id: "office-hidden-prompt",
      title: "隐藏官职",
      bureauId: "ministry_revenue",
      visibility: "hidden",
      publicSummary: "SEALED_PROMPT_OFFICE",
      hiddenNotes: ["SEALED_PROMPT_OFFICE_NOTE"]
    }]),
    postings: Array.from({ length: 10 }, (_, index) => ({
      id: `posting-visible-${index}`,
      officeId: `office-visible-${index}`,
      bureauId: "ministry_revenue",
      holderType: "npc",
      holderId: `npc-${index}`,
      publicSummary: `可见任所摘要${index}`
    })).concat([{
      id: "posting-hidden-prompt",
      officeId: "office-hidden-prompt",
      bureauId: "ministry_revenue",
      visibility: "hidden",
      publicSummary: "SEALED_PROMPT_POSTING"
    }]),
    assessmentRecords: Array.from({ length: 8 }, (_, index) => ({
      id: `assessment-visible-${index}`,
      postingId: `posting-visible-${index}`,
      meritScore: 50 + index,
      publicFinding: `可见考成${index}`
    })),
    transferRecords: Array.from({ length: 8 }, (_, index) => ({
      id: `transfer-visible-${index}`,
      fromPostingId: `posting-visible-${index}`,
      type: "transfer",
      publicReason: `可见迁转${index}`
    }))
  };

  const summary = summarizeOfficialPostingSchemaForPrompt(bundle, officialState());
  const serialized = JSON.stringify(summary);

  assert.equal(summary.offices.length, 8);
  assert.equal(summary.postings.length, 8);
  assert.equal(summary.assessmentRecords.length, 6);
  assert.equal(summary.transferRecords.length, 6);
  assert.equal(serialized.includes("SEALED_PROMPT_OFFICE"), false);
  assert.equal(serialized.includes("SEALED_PROMPT_OFFICE_NOTE"), false);
  assert.equal(serialized.includes("SEALED_PROMPT_POSTING"), false);
});

test("official posting schema accepts existing official catalog rows as static seeds", () => {
  const worldState = officialState();
  const bundle = normalizeOfficialPostingSchemaBundle({
    bureaus: listBureaus(),
    offices: listOffices()
  }, worldState);

  assert.ok(bundle.bureaus.some((bureau) => bureau.id === "ministry_revenue"));
  assert.ok(bundle.offices.some((office) => office.id === "ministry_revenue_principal"));
  assert.ok(bundle.offices.some((office) => office.title === "户部主事"));
});

test("ordinary provider payloads cannot write future official posting ledgers directly", () => {
  assert.throws(() => validatePayload("turn", {
    narrative: "有人自称可替服务器改写官职簿。",
    statePatch: {
      officialPostings: {
        postings: [{ id: "posting-provider", officeId: "ministry_revenue_principal" }]
      },
      player: { performanceMerit: 20 }
    },
    attributeChanges: [],
    relationshipChanges: [],
    events: ["模型试图越权改写官职簿。"],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: "无考试。"
    }
  }), /schema validation/);

  const worldState = createInitialState({ role: "official", playerName: "Patch Tester" });
  worldState.officialPostings = { schemaVersion: 1, postings: [{ id: "server-posting" }] };
  const before = JSON.parse(JSON.stringify(worldState.officialPostings));

  applyStatePatch(worldState, {
    officialPostings: {
      postings: [{ id: "posting-provider", officeId: "ministry_revenue_principal" }]
    },
    player: {
      performanceMerit: 20
    }
  });

  assert.deepEqual(worldState.officialPostings, before);
  assert.equal(worldState.player.performanceMerit, 20);
});
