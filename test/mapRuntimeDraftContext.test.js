const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeMapRuntimeTurnContext } = require("../src/game/mapRuntimeDraftContext");

function assertNoMapDraftContextLeak(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /layout|layoutPath|mapBounds|viewportHint|coordinates|position|"x"|"y"|providerPayload|raw provider|hiddenNotes|privateSignalTags|npcActiveRequestLedger|npcInteractionLedger|data\/sessions|C:\\|\/mnt\/e|sk-[A-Za-z0-9_-]{6,}/i
  );
}

test("S88.10 map-runtime draftContext is revalidated against current safe runtime refs", () => {
  const targetRef = "map:economic:economic_report:grain-market";
  const sourceRef = "economicFiscalView.marketIncidents:grain-market";
  const mapRuntimeView = {
    schemaVersion: 1,
    generatedAtTurn: 31,
    refs: [{
      mapEntityRef: targetRef,
      sourceRef: targetRef,
      entityType: "economic_report"
    }],
    routes: [],
    eventEffects: [{
      id: "event-market",
      targetRef,
      sourceRefs: [
        sourceRef,
        "domainConsequenceView:visual-only",
        "npcActiveRequestView:req-public",
        "npcActiveRequestFollowUpEvidence:evi-public",
        "npcInteractionView:npc-interaction:public-duel",
        "npcRelationshipActionResolverTrace:npc-relationship-resolution:npc-zhang:duel:24"
      ]
    }],
    actionDrafts: {
      "draft-inspect-grain-market": {
        targetRef,
        sourceRefs: [targetRef],
        actionText: "据粮市复核市价。",
        requiresServerTurn: true
      }
    }
  };

  const context = normalizeMapRuntimeTurnContext({ turnCount: 31 }, {
    surfaceId: "map-runtime",
    draftKind: "map_event_action",
    targetRefs: [targetRef, "layout", "mapBounds:0:1", "map:forged:secret"],
    sourceRefs: [
      targetRef,
      "domainConsequenceView:visual-only",
      "npcActiveRequestView:req-public",
      "npcActiveRequestFollowUpEvidence:evi-public",
      "npcInteractionView:npc-interaction:public-duel",
      "npcRelationshipActionResolverTrace:npc-relationship-resolution:npc-zhang:duel:24",
      "viewportHint",
      "x",
      "providerPayload"
    ],
    evidenceRefs: [
      sourceRef,
      targetRef,
      "npcActiveRequestView:req-public",
      "npcActiveRequestFollowUpEvidence:evi-public",
      "npcInteractionView:npc-interaction:public-duel",
      "npcRelationshipActionResolverTrace:npc-relationship-resolution:npc-zhang:duel:24",
      "layoutPath",
      "coordinates:0:0",
      "raw provider"
    ],
    actionDraftRefs: ["draft-inspect-grain-market", "layout"],
    requiresServerTurn: true
  }, { mapRuntimeView });

  assert.ok(context);
  assert.equal(context.schemaVersion, "s88.10-map-runtime-draft-context.v1");
  assert.equal(context.surfaceId, "map-runtime");
  assert.equal(context.draftKind, "map_event_action");
  assert.deepEqual(context.targetRefs, [targetRef]);
  assert.deepEqual(context.sourceRefs, [targetRef]);
  assert.deepEqual(context.evidenceRefs, [sourceRef, targetRef]);
  assert.deepEqual(context.actionDraftRefs, ["draft-inspect-grain-market"]);
  assert.equal(context.generatedAtTurn, 31);
  assert.equal(context.status, "verified");
  assertNoMapDraftContextLeak(context);
});

test("S88.10 map-runtime draftContext rejects unsupported surfaces and forged-only refs", () => {
  const mapRuntimeView = {
    schemaVersion: 1,
    generatedAtTurn: 7,
    refs: [{ mapEntityRef: "map:geography:city:city-suzhou", sourceRef: "map:geography:city:city-suzhou" }],
    routes: [],
    eventEffects: [],
    actionDrafts: {}
  };

  assert.equal(normalizeMapRuntimeTurnContext({}, { surfaceId: "memorial-review", evidenceRefs: ["map:geography:city:city-suzhou"] }, { mapRuntimeView }), null);
  assert.equal(normalizeMapRuntimeTurnContext({}, {
    surfaceId: "map-runtime",
    targetRefs: ["map:forged:secret"],
    evidenceRefs: ["layoutPath", "mapBounds:0:1", "x:0.5", "providerPayload"]
  }, { mapRuntimeView }), null);
});

test("S88.10 map-runtime draftContext rejects visual-only NPC refs from all source paths", () => {
  const targetRef = "map:geography:city:city-suzhou";
  const safeSourceRef = "mapContextView:public-suzhou";
  const visualOnlyRefs = [
    "npcActiveRequestView:req-public",
    "npcActiveRequestFollowUp:follow-public",
    "npcActiveRequestFollowUpEvidence:evi-public",
    "npcActivityAnchor:anchor-public",
    "npcInteractionView:npc-interaction:public-duel",
    "npcRelationshipActionResolverTrace:npc-relationship-resolution:npc-zhang:duel:24",
    "npcRelationshipActionEligibilityView:npc-zhang:duel",
    "npcRelationshipActionTrace:npc-relationship-resolution:npc-zhang:duel:24",
    "npcRelationshipAction:legacy-public-duel",
    "npcInteractionLedger:raw-secret"
  ];
  const mapRuntimeView = {
    schemaVersion: 1,
    generatedAtTurn: 32,
    refs: [{
      mapEntityRef: targetRef,
      sourceRef: visualOnlyRefs[0],
      sourceRefs: [safeSourceRef, visualOnlyRefs[1]]
    }],
    routes: [{
      mapEntityRef: "map:geography:route:route-suzhou-canal",
      sourceRef: visualOnlyRefs[2],
      fromRef: targetRef,
      toRef: targetRef,
      controlRefs: [visualOnlyRefs[3]]
    }],
    eventEffects: [{
      id: "event-npc-activity",
      targetRef,
      sourceRefs: visualOnlyRefs
    }],
    actionDrafts: {
      "draft-travel-city-suzhou": {
        targetRef,
        sourceRefs: visualOnlyRefs,
        actionText: "前往苏州查问公开近事。",
        requiresServerTurn: true
      }
    }
  };

  const context = normalizeMapRuntimeTurnContext({ turnCount: 32 }, {
    surfaceId: "map-runtime",
    targetRefs: [targetRef],
    sourceRefs: [safeSourceRef, ...visualOnlyRefs],
    evidenceRefs: [safeSourceRef, ...visualOnlyRefs],
    actionDraftRefs: ["draft-travel-city-suzhou"]
  }, { mapRuntimeView });

  assert.ok(context);
  assert.deepEqual(context.sourceRefs, [safeSourceRef]);
  assert.deepEqual(context.evidenceRefs, [safeSourceRef, targetRef]);
  assert.deepEqual(context.actionDraftRefs, ["draft-travel-city-suzhou"]);
  assert.equal(visualOnlyRefs.some((ref) => JSON.stringify(context).includes(ref)), false);
  assertNoMapDraftContextLeak(context);
});
