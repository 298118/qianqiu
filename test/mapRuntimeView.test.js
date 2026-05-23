const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildMapActionDrafts,
  buildMapRuntimeView,
  sanitizeMapLayout
} = require("../src/game/mapRuntimeView");

function assertSafeMapRuntimePayload(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /SEALED_|hiddenNotes|hiddenIntent|hiddenDossier|privateSignalTags|trueAssets|npcActiveRequestLedger|raw provider|raw coordinate|coordinateTable|latitude|longitude|world_sessions|prompt_retrieval_index|event_log|E:\\LSMNQ|data\/sessions|file:\/\/|OPENAI_API_KEY|sk-[A-Za-z0-9_-]+|tp-[A-Za-z0-9_-]+/i
  );
}

test("S72.2 map runtime view builds renderable safe refs without mutating state", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "舆图运行时测试" });
  const before = JSON.stringify(worldState);
  const view = buildMapRuntimeView(worldState);
  const refIds = new Set(view.refs.map((ref) => ref.mapEntityRef));

  assert.equal(view.schemaVersion, 1);
  assert.equal(view.layoutVersion, "ink-layout-v1");
  assert.equal(view.assetSetId, "ink-map-v1");
  assert.deepEqual(view.mapBounds, {
    width: 2400,
    height: 1600,
    coordinateSpace: "normalized-image-space"
  });
  assert.equal(JSON.stringify(worldState), before);
  assert.ok(view.refs.length > 0);
  assert.ok(view.refs.every((ref) => ref.mapEntityRef.startsWith("map:")));
  assert.ok(view.refs.every((ref) => ref.layout.x >= 0 && ref.layout.x <= 1));
  assert.ok(view.refs.every((ref) => ref.layout.y >= 0 && ref.layout.y <= 1));
  assert.ok(refIds.has(view.viewportHint.centerRef));
  assert.equal(view.viewportHint.centerRef, view.playerFocusRef);
  assert.ok(Object.keys(view.actionDrafts).length > 0);
  assertSafeMapRuntimePayload(view);
});

test("S72.2 map runtime view clamps unsafe layout and drops unsafe text", () => {
  const layout = sanitizeMapLayout({
    x: -12,
    y: 4,
    layer: "forged",
    importance: 88,
    labelAnchor: "bad"
  });
  assert.deepEqual(layout, {
    x: 0,
    y: 1,
    layer: "places",
    importance: 1,
    labelAnchor: "top"
  });

  const mapContextView = {
    schemaVersion: 1,
    generatedAtTurn: 4,
    mapEntityRefs: [
      {
        refId: "map:geography:city:city-beijing",
        entityType: "city",
        entityId: "city-beijing",
        label: "SEALED_CITY_NAME",
        summary: "raw provider C:\\LSMNQ\\data\\sessions\\secret.json",
        visibility: "public",
        pressure: 40
      },
      {
        refId: "map:geography:city:city-nanjing",
        entityType: "city",
        entityId: "sk-secret-fallback",
        label: "SEALED_FALLBACK_LABEL",
        summary: "可公开展示的节点。",
        visibility: "public",
        pressure: 20
      }
    ],
    mapEventHooks: []
  };
  const view = buildMapRuntimeView({ turnCount: 4 }, { mapContextView });

  assert.equal(view.refs.length, 1);
  assert.equal(view.refs[0].label, "city-beijing");
  assert.equal(view.refs.some((ref) => ref.mapEntityRef === "map:geography:city:city-nanjing"), false);
  assert.notEqual(view.refs[0].summary, "raw provider C:\\LSMNQ\\data\\sessions\\secret.json");
  assertSafeMapRuntimePayload(view);
});

test("S72.2 map runtime view creates safe route paths and server-owned action drafts", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "舆图路线测试" });
  const view = buildMapRuntimeView(worldState);
  const canal = view.routes.find((route) => route.mapEntityRef === "map:geography:route:route-grand-canal-north");
  const routeDraft = canal && view.actionDrafts[canal.actionDraftRefs[0]];

  assert.ok(canal);
  assert.equal(canal.fromRef, "map:geography:city:city-nanjing");
  assert.equal(canal.toRef, "map:geography:city:city-beijing");
  assert.ok(canal.layoutPath.length >= 2);
  assert.ok(canal.layoutPath.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
  assert.equal(canal.style.token, "water_route");
  assert.ok(routeDraft);
  assert.equal(routeDraft.requiresServerTurn, true);
  assert.match(routeDraft.actionText, /循.*行进/);
  assert.doesNotMatch(routeDraft.actionText, /POST|resolver|statePatch|SQL/i);
  assertSafeMapRuntimePayload(view);
});

test("S88.10 map runtime view builds domain-specific action drafts without unsafe commands", () => {
  const mapContextView = {
    schemaVersion: 1,
    generatedAtTurn: 26,
    mapEntityRefs: [{
      refId: "map:local_affairs:docket:case-field-boundary",
      domain: "local_affairs",
      entityType: "docket",
      entityId: "case-field-boundary",
      label: "田界案",
      summary: "县中田界词讼仍待复核。",
      visibility: "role_visible",
      pressure: 48
    }, {
      refId: "map:military:military_report:border-scouting",
      domain: "military",
      entityType: "military_report",
      entityId: "border-scouting",
      label: "边报",
      summary: "边墙塘报牵动粮道。",
      visibility: "military_visible",
      pressure: 78
    }, {
      refId: "map:economic:economic_report:grain-market",
      domain: "economic",
      entityType: "economic_report",
      entityId: "grain-market",
      label: "粮市",
      summary: "粮市牌价已入公开观察。",
      visibility: "market_visible",
      pressure: 52
    }],
    mapEventHooks: []
  };

  const view = buildMapRuntimeView({ turnCount: 26 }, { mapContextView });
  const drafts = Object.values(view.actionDrafts);
  const docketDraft = drafts.find((draft) => draft.targetRef.includes("case-field-boundary"));
  const militaryDraft = drafts.find((draft) => draft.targetRef.includes("border-scouting"));
  const economyDraft = drafts.find((draft) => draft.targetRef.includes("grain-market"));

  assert.ok(docketDraft);
  assert.match(docketDraft.actionText, /查验田界案案牍/);
  assert.equal(docketDraft.domainIntentHint, "local_docket_review");
  assert.ok(militaryDraft);
  assert.match(militaryDraft.actionText, /遣哨侦察/);
  assert.equal(militaryDraft.domainIntentHint, "military_scout");
  assert.doesNotMatch(militaryDraft.actionText, /发兵|攻城|交战|奇袭|调兵|declare war|attack/i);
  assert.ok(economyDraft);
  assert.match(economyDraft.actionText, /市价|粮价|平粜|稳价|处置/);
  assert.equal(economyDraft.domainIntentHint, "market_policy");
  assert.ok(drafts.every((draft) => draft.requiresServerTurn === true));
  assert.ok(drafts.every((draft) => Array.isArray(draft.sourceRefs) && draft.sourceRefs.every((ref) => ref.startsWith("map:"))));
  assertSafeMapRuntimePayload(view);
});

test("S72.2 map runtime view turns visible map hooks into capped event effects", () => {
  const worldState = createInitialState({ role: "emperor", playerName: "舆图事势测试" });
  worldState.borderThreat = 88;
  worldState.publicOrder = 32;
  worldState.taxRate = 70;
  const view = buildMapRuntimeView(worldState);

  assert.ok(view.eventEffects.length > 0);
  assert.ok(view.eventEffects.length <= 12);
  assert.ok(view.eventEffects.every((effect) => effect.severity >= 0 && effect.severity <= 1));
  assert.ok(view.eventEffects.every((effect) => effect.targetRef.startsWith("map:")));
  assert.ok(view.eventEffects.every((effect) => effect.sourceRefs.every((sourceRef) => /^[A-Za-z0-9_.:-]+$/.test(sourceRef))));
  assertSafeMapRuntimePayload(view);
});

test("S88.6 map runtime view turns visible domain consequences into safe event effects", () => {
  const mapContextView = {
    schemaVersion: 1,
    generatedAtTurn: 18,
    mapEntityRefs: [
      {
        refId: "map:geography:frontier_zone:frontier-liaodong",
        domain: "geography",
        entityType: "frontier_zone",
        entityId: "frontier-liaodong",
        label: "辽东边墙",
        summary: "边墙塘报牵动粮道。",
        visibility: "public",
        pressure: 78
      },
      {
        refId: "map:local_affairs:docket:case-field-boundary",
        domain: "local_affairs",
        entityType: "docket",
        entityId: "case-field-boundary",
        label: "田界案",
        summary: "县中田界词讼仍待复核。",
        visibility: "role_visible",
        pressure: 48
      },
      {
        refId: "map:economic:economic_report:grain-market",
        domain: "economic",
        entityType: "economic_report",
        entityId: "grain-market",
        label: "粮市",
        summary: "粮市牌价已入公开观察。",
        visibility: "market_visible",
        pressure: 52
      }
    ],
    mapEventHooks: []
  };
  const domainConsequenceView = {
    active: true,
    recentConsequences: [{
      id: "DC-map-military",
      sourceType: "military_diplomacy",
      sourceLabel: "军务外交",
      kindLabel: "军务后果",
      title: "边镇调粮余波",
      publicSummary: "边镇粮道公开归档。",
      severity: 2
    }, {
      id: "DC-map-judicial",
      sourceType: "judicial_case",
      sourceLabel: "刑名案件",
      kindLabel: "刑名后果",
      title: "田界案余波",
      publicSummary: "田界案公开归档。",
      severity: 1
    }, {
      id: "DC-map-city",
      sourceType: "city_policy",
      sourceLabel: "地方政策",
      kindLabel: "政策后果",
      title: "粮价余波",
      publicSummary: "粮价平抑公开归档。",
      severity: 1
    }]
  };

  const view = buildMapRuntimeView({ turnCount: 18 }, {
    mapContextView,
    domainConsequenceView,
    maxEventEffects: 4
  });
  const refIds = new Set(view.refs.map((ref) => ref.mapEntityRef));
  const domainEffects = view.eventEffects.filter((effect) =>
    effect.sourceRefs.some((sourceRef) => sourceRef.startsWith("domainConsequenceView:"))
  );

  assert.equal(domainEffects.length, 3);
  assert.ok(domainEffects.some((effect) => effect.kind === "domain_military_consequence" && effect.targetRef.includes("frontier-liaodong")));
  assert.ok(domainEffects.some((effect) => effect.kind === "domain_judicial_consequence" && effect.targetRef.includes("case-field-boundary")));
  assert.ok(domainEffects.some((effect) => effect.kind === "domain_city_policy" && effect.targetRef.includes("grain-market")));
  assert.ok(domainEffects.every((effect) => refIds.has(effect.targetRef)));
  assert.ok(domainEffects.every((effect) => effect.severity >= 0 && effect.severity <= 1));
  assert.ok(domainEffects.every((effect) => effect.sourceRefs.every((sourceRef) => /^[A-Za-z0-9_.:-]+$/.test(sourceRef))));
  assertSafeMapRuntimePayload(view);
});

test("S88.6 map runtime event cap preserves visible domain consequence effects", () => {
  const mapContextView = {
    schemaVersion: 1,
    generatedAtTurn: 19,
    mapEntityRefs: [{
      refId: "map:economic:economic_report:grain-market",
      domain: "economic",
      entityType: "economic_report",
      entityId: "grain-market",
      label: "粮市",
      summary: "粮市牌价已入公开观察。",
      visibility: "market_visible",
      pressure: 52
    }],
    mapEventHooks: Array.from({ length: 5 }, (_, index) => ({
      hookId: `map-hook-market-${index}`,
      sourceType: "market_incident",
      sourceDomain: "economic",
      sourceView: "economicFiscalView.marketIncidents",
      sourceId: `market-${index}`,
      title: `市况${index}`,
      publicSummary: `粮市公开近事${index}。`,
      riskLabel: "市况",
      mapEntityRefs: [{
        refId: "map:economic:economic_report:grain-market",
        entityType: "economic_report",
        label: "粮市",
        sourceView: "economicFiscalView.marketIncidents"
      }],
      visibility: "market_visible"
    }))
  };
  const domainConsequenceView = {
    active: true,
    recentConsequences: [{
      id: "DC-map-city-cap",
      sourceType: "city_policy",
      sourceLabel: "地方政策",
      kindLabel: "政策后果",
      title: "粮价余波",
      publicSummary: "粮价平抑公开归档。",
      severity: 2
    }]
  };

  const view = buildMapRuntimeView({ turnCount: 19 }, {
    mapContextView,
    domainConsequenceView,
    maxEventEffects: 3
  });
  const domainEffects = view.eventEffects.filter((effect) =>
    effect.sourceRefs.some((sourceRef) => sourceRef.startsWith("domainConsequenceView:"))
  );

  assert.equal(view.eventEffects.length, 3);
  assert.equal(domainEffects.length, 1);
  assert.equal(domainEffects[0].targetRef, "map:economic:economic_report:grain-market");
  assertSafeMapRuntimePayload(view);
});

test("S88.10 map runtime view adds read-only NPC activity anchors on public map refs", () => {
  const mapContextView = {
    schemaVersion: 1,
    generatedAtTurn: 24,
    mapEntityRefs: [{
      refId: "map:geography:city:city-suzhou",
      domain: "geography",
      entityType: "city",
      entityId: "city-suzhou",
      label: "苏州",
      summary: "公开府城节点。",
      visibility: "public",
      pressure: 25
    }, {
      refId: "map:geography:city:city-beijing",
      domain: "geography",
      entityType: "city",
      entityId: "city-beijing",
      label: "北京",
      summary: "公开京师节点。",
      visibility: "public",
      pressure: 18
    }],
    mapEventHooks: []
  };
  const npcActiveRequestView = {
    items: [{
      requestId: "req-public",
      status: "active",
      typeLabel: "请托",
      npc: { npcId: "npc-zhang", displayName: "张廷试" },
      intentSummary: "张廷试在苏州递来请托，后果仍待服务器裁决。",
      riskTags: ["relationship_risk_watchlist", "privateSignalTags"],
      evidenceRefs: ["npcActiveRequestLedger:raw-secret"]
    }, {
      requestId: "req-hidden",
      status: "active",
      typeLabel: "密访",
      npc: { npcId: "npc-hidden", displayName: "SEALED_NPC" },
      intentSummary: "hiddenDossier privateSignalTags trueAssets"
    }],
    followUpEvidence: {
      items: [{
        evidenceId: "evi-public",
        requestId: "req-public",
        status: "pending_follow_up",
        urgency: "high",
        npc: { npcId: "npc-zhang", displayName: "张廷试" },
        title: "续办线索：张廷试",
        publicSummary: "请托续办材料在苏州公开流转；资源、关系与后续任务仍由服务器裁决。",
        riskTags: ["censorate_watchlist"]
      }]
    }
  };
  const worldPeopleView = {
    npcs: [{
      id: "npc-zhang",
      name: "张廷试",
      currentCityId: "city-suzhou",
      visibility: "relationship_visible",
      knownToPlayer: true
    }, {
      id: "npc-hidden",
      name: "密札人物",
      currentCityId: "city-beijing",
      visibility: "hidden",
      knownToPlayer: false
    }]
  };

  const view = buildMapRuntimeView({ turnCount: 24 }, {
    mapContextView,
    domainConsequenceView: { recentConsequences: [] },
    npcActiveRequestView,
    worldPeopleView
  });
  const refIds = new Set(view.refs.map((ref) => ref.mapEntityRef));

  assert.equal(view.npcActivityAnchors.length, 2);
  assert.ok(view.npcActivityAnchors.every((anchor) => anchor.visualOnly === true));
  assert.ok(view.npcActivityAnchors.every((anchor) => refIds.has(anchor.targetRef)));
  assert.ok(view.npcActivityAnchors.every((anchor) => anchor.targetRef === "map:geography:city:city-suzhou"));
  assert.ok(view.npcActivityAnchors.some((anchor) => anchor.kind === "npc_active_request"));
  assert.ok(view.npcActivityAnchors.some((anchor) => anchor.kind === "npc_follow_up_evidence"));
  assert.ok(view.npcActivityAnchors.every((anchor) =>
    anchor.sourceRefs.every((sourceRef) =>
      sourceRef.startsWith("npcActiveRequestView:") ||
      sourceRef.startsWith("npcActiveRequestFollowUpEvidence:")
    )
  ));
  assert.equal(JSON.stringify(view.npcActivityAnchors).includes("npc-hidden"), false);
  assert.equal(Object.values(view.actionDrafts).some((draft) =>
    (draft.sourceRefs || []).some((ref) => ref.startsWith("npcActiveRequest"))
  ), false);
  assertSafeMapRuntimePayload(view);
});

test("S72.2 map action drafts stay dictionary-shaped and require player confirmation", () => {
  const drafts = buildMapActionDrafts({
    refs: [
      {
        mapEntityRef: "map:geography:city:city-suzhou",
        entityType: "city",
        label: "苏州",
        affordances: ["inspect", "draft_travel_action"],
        actionDraftRefs: ["draft-travel-city-suzhou"]
      }
    ],
    routes: []
  });

  assert.deepEqual(Object.keys(drafts), ["draft-travel-city-suzhou"]);
  assert.equal(drafts["draft-travel-city-suzhou"].targetRef, "map:geography:city:city-suzhou");
  assert.equal(drafts["draft-travel-city-suzhou"].requiresServerTurn, true);
  assert.match(drafts["draft-travel-city-suzhou"].actionText, /前往苏州/);
});
