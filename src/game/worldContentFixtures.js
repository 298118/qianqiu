const { createHash } = require("node:crypto");

const { assemblePromptContext } = require("../ai/promptContextAssembler");
const { buildEventArchiveView } = require("./eventArchive");
const { createInitialState } = require("./initialState");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");
const {
  createWorldPeoplePopulation,
  measureWorldPeoplePopulation
} = require("./worldPeoplePopulation");
const { createSessionRecord } = require("../storage/sessionRecord");
const { buildPromptRetrievalRows } = require("../storage/sqlitePromptRetrievalTables");

const WORLD_CONTENT_FIXTURE_TARGETS = Object.freeze({
  small: Object.freeze({
    countries: 6,
    cities: 24,
    npcs: 96,
    households: 32,
    relationships: 160,
    officialCatalogRows: 80,
    postings: 48,
    eventIntelItems: 64,
    promptRetrievalRows: 250,
    hiddenCanaries: 40
  }),
  medium: Object.freeze({
    countries: 10,
    cities: 96,
    npcs: 480,
    households: 160,
    relationships: 1000,
    officialCatalogRows: 220,
    postings: 180,
    eventIntelItems: 500,
    promptRetrievalRows: 1800,
    hiddenCanaries: 80
  }),
  large: Object.freeze({
    countries: 14,
    cities: 300,
    npcs: 2000,
    households: 700,
    relationships: 5000,
    officialCatalogRows: 450,
    postings: 1000,
    eventIntelItems: 5000,
    promptRetrievalRows: 10000,
    hiddenCanaries: 250
  })
});

const WORLD_CONTENT_PROMPT_BUDGET = Object.freeze({
  ordinaryRows: 48,
  highRelevanceRows: 72,
  ordinaryChars: 20000,
  highRelevanceChars: 30000
});

const WORLD_CONTENT_BROWSER_PAGE = Object.freeze({
  defaultPageSize: 24,
  maxPageSize: 50
});

const WORLD_CONTENT_STORAGE_SHAPE = Object.freeze({
  small: Object.freeze({
    regions: 12,
    routes: 12,
    frontierZones: 4
  }),
  medium: Object.freeze({
    regions: 30,
    routes: 70,
    frontierZones: 20
  }),
  large: Object.freeze({
    regions: 80,
    routes: 220,
    frontierZones: 64
  })
});

const FIXTURE_CREATED_AT = "2026-05-08T00:00:00.000Z";
const DEFAULT_SEED = "s60-small";
const SUPPORTED_SIZES = new Set(Object.keys(WORLD_CONTENT_FIXTURE_TARGETS));
const PERFORMANCE_CLOCK =
  globalThis.performance && typeof globalThis.performance.now === "function"
    ? globalThis.performance
    : { now: () => Date.now() };

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pad(number, width = 3) {
  return String(number).padStart(width, "0");
}

function fixtureSessionId(size, seed) {
  const hash = createHash("sha1").update(`${size}:${seed}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function numbered(count, mapper) {
  return Array.from({ length: count }, (_, index) => mapper(index + 1));
}

function fixturePrefix(size) {
  return `s60-${size}`;
}

function createStorageGeography(size) {
  const target = WORLD_CONTENT_FIXTURE_TARGETS[size];
  const shape = WORLD_CONTENT_STORAGE_SHAPE[size];
  const prefix = fixturePrefix(size);
  const countries = numbered(target.countries, (index) => ({
    id: `${prefix}-country-${pad(index)}`,
    name: `S60${size}样本国${index}`,
    kind: index === 1 ? "player_realm" : index % 3 === 0 ? "neighbor" : "tributary",
    visibility: "public",
    publicSummary: `S60 ${size} storage-only 国家样本${index}，仅用于总量、分页和安全检索验收。`
  }));
  const regions = numbered(shape.regions, (index) => ({
    id: `${prefix}-region-${pad(index)}`,
    countryId: countries[(index - 1) % countries.length].id,
    name: `S60${size}样本区${index}`,
    visibility: "public",
    publicSummary: `S60 ${size} storage-only 区域样本${index}。`
  }));
  const cities = numbered(target.cities, (index) => ({
    id: `${prefix}-city-${pad(index)}`,
    countryId: countries[(index - 1) % countries.length].id,
    regionId: regions[(index - 1) % regions.length].id,
    name: `S60${size}样本城${index}`,
    jurisdictionLevel: index % 9 === 0 ? "frontier_prefecture" : index % 4 === 0 ? "prefecture" : "county",
    pressure: 30 + (index % 55),
    localOrder: 45 + (index % 40),
    taxBase: 38 + (index % 45),
    grainStock: 35 + (index % 50),
    waterworksIntegrity: 42 + (index % 42),
    visibility: "public",
    publicSummary: `S60 ${size} storage-only 城市样本${index}，不进入当前 raw route state 全量返回。`
  }));
  const routes = numbered(shape.routes, (index) => ({
    id: `${prefix}-route-${pad(index)}`,
    name: `S60${size}样本路${index}`,
    type: index % 7 === 0 ? "sea" : index % 5 === 0 ? "pass" : "road",
    fromCityId: cities[(index - 1) % cities.length].id,
    toCityId: cities[index % cities.length].id,
    risk: 20 + (index % 70),
    visibility: "public",
    publicSummary: `S60 ${size} storage-only 路线样本${index}。`
  }));
  const frontierZones = numbered(shape.frontierZones, (index) => ({
    id: `${prefix}-frontier-${pad(index)}`,
    name: `S60${size}样本边面${index}`,
    countryId: countries[(index - 1) % countries.length].id,
    neighborCountryId: countries[index % countries.length].id,
    cityIds: [cities[(index * 2) % cities.length].id],
    routeIds: [routes[(index * 3) % routes.length].id],
    pressure: 35 + (index % 60),
    visibility: "public",
    publicSummary: `S60 ${size} storage-only 边面样本${index}。`
  }));

  return { countries, regions, cities, routes, frontierZones };
}

function createStoragePeople(size, geography) {
  const target = WORLD_CONTENT_FIXTURE_TARGETS[size];
  const prefix = fixturePrefix(size);
  const cityIds = geography.cities.map((city) => city.id);
  return createWorldPeoplePopulation({
    prefix,
    cityIds,
    npcCount: target.npcs,
    householdCount: target.households,
    relationshipCount: target.relationships,
    turnCount: 0,
    officeIds: numbered(Math.max(1, Math.ceil(target.officialCatalogRows * 0.25)), (index) =>
      `${prefix}-office-${pad(index)}`
    ),
    bureauIds: numbered(Math.max(1, Math.ceil(target.officialCatalogRows * 0.15)), (index) =>
      `${prefix}-bureau-${pad(index)}`
    )
  });
}

function createStorageOffices(size, geography, people) {
  const target = WORLD_CONTENT_FIXTURE_TARGETS[size];
  const prefix = fixturePrefix(size);
  const bureauCount = Math.max(24, Math.ceil(target.officialCatalogRows * 0.35));
  const officeCount = target.officialCatalogRows - bureauCount;
  const cityIds = geography.cities.map((city) => city.id);
  const bureaus = numbered(bureauCount, (index) => ({
    id: `${prefix}-bureau-${pad(index)}`,
    name: `S60${size}样本官署${index}`,
    level: index % 5 === 0 ? "provincial" : "court",
    duties: ["钱粮", index % 3 === 0 ? "刑名" : "考成"],
    visibility: "public",
    publicSummary: `S60 ${size} storage-only 官署样本${index}。`
  }));
  const offices = numbered(officeCount, (index) => ({
    id: `${prefix}-office-${pad(index)}`,
    title: `S60${size}样本官职${index}`,
    bureauId: bureaus[(index - 1) % bureaus.length].id,
    rankBand: index % 8 === 0 ? "middle_provincial" : "low_central",
    jurisdictionScope: index % 4 === 0 ? "province" : "court",
    typicalCityIds: [cityIds[(index * 2) % cityIds.length]],
    visibility: "public",
    publicSummary: `S60 ${size} storage-only 官职样本${index}，任免仍由服务器裁决。`
  }));
  const cityJurisdictions = numbered(Math.min(target.postings, cityIds.length), (index) => ({
    id: `${prefix}-jurisdiction-${pad(index, 4)}`,
    name: `S60${size}样本任所辖区${index}`,
    bureauId: bureaus[(index - 1) % bureaus.length].id,
    cityId: cityIds[(index - 1) % cityIds.length],
    jurisdictionScope: index % 4 === 0 ? "province" : "prefecture",
    localMetrics: {
      taxCapacity: 35 + (index % 60),
      lawsuits: 15 + (index % 70),
      disasterRisk: 10 + (index % 65)
    },
    visibility: "role_visible",
    publicSummary: `S60 ${size} storage-only 任所辖区${index}。`
  }));
  const postings = numbered(target.postings, (index) => ({
    id: `${prefix}-posting-${pad(index, 5)}`,
    officeId: offices[(index - 1) % offices.length].id,
    bureauId: bureaus[(index - 1) % bureaus.length].id,
    holderType: "npc",
    holderId: people.npcs[(index - 1) % people.npcs.length].id,
    status: index % 11 === 0 ? "acting" : "active",
    cityId: cityIds[(index * 5) % cityIds.length],
    performanceScore: 35 + (index % 60),
    impeachmentRisk: index % 9 === 0 ? 60 : 10 + (index % 35),
    visibility: "role_visible",
    publicSummary: `S60 ${size} storage-only 任命样本${index}，用于任所/考成/迁转总量验收。`
  }));
  const assessmentRecords = numbered(Math.min(target.postings, Math.ceil(target.postings * 0.35)), (index) => ({
    id: `${prefix}-assessment-${pad(index, 5)}`,
    postingId: postings[(index - 1) % postings.length].id,
    officeId: postings[(index - 1) % postings.length].officeId,
    bureauId: postings[(index - 1) % postings.length].bureauId,
    status: index % 4 === 0 ? "watch" : "recorded",
    meritScore: 35 + (index % 60),
    riskScore: 10 + (index % 70),
    publicSummary: `S60 ${size} storage-only 考成样本${index}。`
  }));
  const transferRecords = numbered(Math.min(target.postings, Math.ceil(target.postings * 0.2)), (index) => ({
    id: `${prefix}-transfer-${pad(index, 5)}`,
    holderType: "npc",
    fromOfficeId: offices[(index - 1) % offices.length].id,
    toOfficeId: offices[index % offices.length].id,
    status: "recorded",
    publicSummary: `S60 ${size} storage-only 迁转样本${index}。`
  }));

  return { bureaus, offices, cityJurisdictions, postings, assessmentRecords, transferRecords };
}

function createStoragePromptRetrievalRows(size, count) {
  const prefix = fixturePrefix(size);
  const domains = [
    ["geography", "cities", "worldGeographyView"],
    ["people", "npcs", "worldPeopleView"],
    ["people", "relationships", "worldPeopleView"],
    ["offices", "postings", "officialPostingsView"],
    ["offices", "assessmentRecords", "officialPostingsView"],
    ["events", "recentEvents", "eventArchiveView"],
    ["intel", "rumors", "eventArchiveView"]
  ];
  return numbered(count, (index) => {
    const [domain, collection, sourceView] = domains[(index - 1) % domains.length];
    return {
      rowId: `${prefix}-prompt-row-${pad(index, 5)}`,
      domain,
      collection,
      sourceView,
      visibility: "public",
      title: `S60${size}安全检索行${index}`,
      summary: `S60 ${size} storage-only 安全检索摘要${index}，用于证明总行数扩大时 prompt 仍走 capped summary。`,
      tags: ["S60规模验收", domain, collection],
      relatedRefs: [`${prefix}-${collection}-${pad(index)}`],
      sortPriority: index
    };
  });
}

function createWorldContentStorageLedger(size, seed, eventIntelItems, promptRetrievalRows, geographyOverride = null) {
  if (size === "small") return null;
  const geography = geographyOverride || createStorageGeography(size);
  const people = createStoragePeople(size, geography);
  const offices = createStorageOffices(size, geography, people);

  return {
    schemaVersion: 1,
    layer: "storage_only_fixture",
    size,
    seed,
    visibility: "server_visible_projection",
    note: "该侧车用于 S60.2 medium/large 总量、分页、prompt budget 与防泄漏验收；不接入当前 raw route worldState。",
    geography,
    people,
    offices,
    events: {
      eventIntelItems
    },
    promptRetrievalRows
  };
}

function attachOfficialPlayerContext(worldState) {
  Object.assign(worldState, {
    year: 1644,
    month: 9,
    tenDayPeriod: 2,
    turnCount: 18,
    treasury: 1800,
    grainReserve: 720,
    population: 6800,
    publicOrder: 62,
    taxRate: 37,
    corruption: 48,
    armySize: 420,
    armyMorale: 58,
    borderThreat: 52
  });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事",
    faction: "清流新进",
    influence: 36,
    reputation: 42,
    superiorFavor: 55,
    peerNetwork: 48,
    performanceMerit: 58,
    promotionProspect: 46,
    impeachmentRisk: 22,
    cleanReputation: 76
  });
  Object.assign(worldState.officialCareer, {
    currentPosting: "户部主事",
    currentOfficeId: "ministry_revenue_principal",
    bureauId: "ministry_revenue",
    tenureMonths: 8,
    reviewCycleMonths: 12,
    careerHistory: numbered(5, (index) => ({
      id: `s60-career-${pad(index)}`,
      type: index === 1 ? "appointment" : index === 5 ? "retention" : "transfer",
      label: `S60小样本官场履历${index}`,
      status: "resolved",
      year: 1644,
      month: Math.max(1, 4 + index),
      tenDayPeriod: ((index - 1) % 3) + 1,
      turn: Math.max(1, worldState.turnCount - (6 - index)),
      officeTitleBefore: index === 1 ? "六部观政进士" : "户部主事",
      officeTitleAfter: "户部主事",
      reason: `公开履历记录${index}，用于规模样本官场索引。`
    })),
    assignments: [
      {
        id: "s60-assignment-revenue-ledger",
        title: "核京仓钱粮",
        kind: "audit",
        bureauId: "ministry_revenue",
        sourceType: "bureau",
        sourceId: "ministry_revenue",
        status: "active",
        dueTurn: worldState.turnCount + 4,
        deadlineUnit: "ten_day",
        progress: 35,
        risk: 42,
        publicStake: 70,
        visibleSummary: "户部令本任核对京仓钱粮与漕运到仓册。"
      },
      {
        id: "s60-assignment-canal-salt",
        title: "盐漕核算",
        kind: "salt_transport",
        bureauId: "ministry_revenue",
        sourceType: "bureau",
        sourceId: "ministry_revenue",
        status: "submitted",
        dueTurn: worldState.turnCount + 2,
        deadlineUnit: "ten_day",
        progress: 72,
        risk: 38,
        publicStake: 66,
        visibleSummary: "盐漕账目已有初稿，上官仍要查漏项。"
      }
    ],
    assessmentDossier: {
      cycleId: "1644-s60-career",
      meritScore: 58,
      riskScore: 22,
      lastUpdatedTurn: worldState.turnCount,
      notes: ["S60小样本：钱粮差事可入考成，但不得由 AI 直接任免。"],
      pendingRecommendation: null
    }
  });
}

function addGeographyFixture(worldState) {
  const countries = [
    {
      id: "country-s60-western-tribute",
      kind: "tributary",
      name: "西域贡部",
      shortName: "西贡",
      polityType: "tributary_oasis",
      rulerTitle: "都护",
      capitalCityId: "city-s60-010",
      cultureTags: ["绿洲", "商道", "贡使"],
      governmentTags: ["贡道", "驿传"],
      visibility: "role_visible",
      knownToPlayer: true,
      intelConfidence: 58,
      fiscalPressure: 48,
      militaryReadiness: 46,
      nationalPrestige: 52,
      legitimacy: 55,
      successionRisk: 42,
      diplomaticTension: 36,
      tributeTradeActivity: 74,
      intelligenceReliability: 58,
      policyPressureTags: ["贡道", "商路", "边报"],
      diplomaticPosture: "贡使往来仍按礼部文书办理，互市利害待服务器后续裁决。",
      intelligenceSummary: "目前只见贡使、商旅和边吏的公开片段，不含邻国真实虚实。",
      publicSummary: "西域贡部只以公开贡道札记入档，真实虚实不进入当前 raw state。"
    }
  ];
  const regions = [
    ["region-s60-guanzhong", "country-ming", "关中转运", "city-s60-001"],
    ["region-s60-huguang", "country-ming", "湖广粮路", "city-s60-003"],
    ["region-s60-fujian-coast", "country-ming", "福建海道", "city-s60-004"],
    ["region-s60-western-oasis", "country-s60-western-tribute", "西域贡道", "city-s60-010"]
  ].map(([id, countryId, name, seatCityId]) => ({
    id,
    countryId,
    name,
    level: "fixture_region",
    seatCityId,
    visibility: "public",
    publicSummary: `${name}为 S60 小样本扩展区划，用于城市、路线和官署辖区验收。`
  }));
  const cityRows = [
    ["city-s60-001", "region-s60-guanzhong", "西安", "provincial_seat", "关中平原", "渭水"],
    ["city-s60-002", "region-s60-guanzhong", "潼关", "frontier_pass", "山河关隘", "黄河"],
    ["city-s60-003", "region-s60-huguang", "武昌", "provincial_seat", "江汉水陆", "长江"],
    ["city-s60-004", "region-s60-fujian-coast", "福州", "provincial_seat", "海岸府城", "闽江"],
    ["city-s60-005", "region-s60-fujian-coast", "泉州", "maritime_prefecture", "海舶商港", "南海"],
    ["city-s60-006", "region-s60-huguang", "长沙", "prefecture", "湘江府城", "湘江"],
    ["city-s60-007", "region-s60-huguang", "襄阳", "frontier_prefecture", "汉水要冲", "汉水"],
    ["city-s60-008", "region-s60-guanzhong", "汉中", "mountain_prefecture", "秦岭栈道", "汉水"],
    ["city-s60-009", "region-s60-fujian-coast", "宁波", "maritime_prefecture", "海门商路", "东海"],
    ["city-s60-010", "region-s60-western-oasis", "沙州", "tributary_oasis", "绿洲驿站", "沙河"]
  ].map(([id, regionId, name, jurisdictionLevel, terrain, riverOrCoast], index) => {
    const countryId = regionId === "region-s60-western-oasis" ? "country-s60-western-tribute" : "country-ming";
    return {
      id,
      countryId,
      regionId,
      name,
      jurisdictionLevel,
      terrain,
      riverOrCoast,
      strategicTags: ["S60样本", index % 2 === 0 ? "钱粮" : "驿路", index % 3 === 0 ? "边防" : "商税"],
      supervisingBureauIds: ["ministry_revenue", "prefecture_county"],
      visibility: index === 9 ? "role_visible" : "public",
      knownToPlayer: true,
      intelConfidence: 70 - (index % 4) * 5,
      pressure: 42 + (index % 5) * 7,
      stability: 72 - (index % 4) * 6,
      localOrder: 58 + (index % 6) * 4,
      grainStress: 34 + (index % 5) * 8,
      populationScale: 48 + (index % 6) * 7,
      taxBase: 44 + (index % 7) * 6,
      grainStock: 62 - (index % 5) * 5,
      marketPriceStress: 35 + (index % 6) * 7,
      gentryInfluence: 38 + (index % 7) * 6,
      lawsuitPressure: 24 + (index % 6) * 8,
      corveeBurden: 26 + (index % 5) * 9,
      waterworksIntegrity: 46 + (index % 6) * 6,
      disasterRisk: 20 + (index % 6) * 8,
      trafficLoad: 44 + (index % 7) * 7,
      garrisonStrength: jurisdictionLevel.includes("frontier") ? 78 : 28 + (index % 6) * 7,
      academyLevel: index % 3 === 0 ? 72 : 36 + (index % 6) * 6,
      localIssueTags: ["S60样本", index % 2 === 0 ? "税粮" : "交通", index % 3 === 0 ? "水利" : "诉讼"],
      cityIntelligenceSummary: `${name}只公开 S61 安全城市指标，不含密报或未公开案牍。`,
      publicSummary: `${name}为 S60 小样本城市，带有钱粮、交通、治安和情报摘要。`
    };
  });
  const routePairs = [
    ["city-beijing", "city-s60-001", "京关驿路"],
    ["city-s60-001", "city-s60-002", "潼关关道"],
    ["city-s60-003", "city-s60-006", "湖广粮道"],
    ["city-s60-003", "city-s60-007", "汉水军需路"],
    ["city-s60-004", "city-s60-005", "福建海道"],
    ["city-s60-005", "city-s60-009", "东南海门"],
    ["city-s60-008", "city-s60-010", "西贡驿路"]
  ];
  const routes = routePairs.map(([fromCityId, toCityId, name], index) => ({
    id: `route-s60-${pad(index + 1)}`,
    type: index >= 4 ? "sea" : index === 1 ? "pass" : "road",
    name,
    fromCityId,
    toCityId,
    viaCityIds: [],
    distanceLabel: "数日程",
    seasonalRisk: "雨雪、粮价或边报会影响通行。",
    strategicTags: ["S60样本", index >= 4 ? "海道" : "驿传"],
    visibility: "public",
    risk: 35 + index * 4,
    publicSummary: `${name}用于验证小样本路线索引和 prompt capped retrieval。`
  }));

  worldState.worldGeography = {
    ...worldState.worldGeography,
    countries: [...(worldState.worldGeography?.countries || []), ...countries],
    regions: [...(worldState.worldGeography?.regions || []), ...regions],
    cities: [...(worldState.worldGeography?.cities || []), ...cityRows],
    routes: [...(worldState.worldGeography?.routes || []), ...routes],
    recentNotes: ["S60 small fixture：地理扩展只写入可随 route 返回的安全摘要。"]
  };
}

function addPeopleFixture(worldState) {
  const visibleCities = buildWorldGeographyView(worldState).cities.map((city) => city.id);
  const target = WORLD_CONTENT_FIXTURE_TARGETS.small;
  const existingPeopleView = buildWorldPeopleView(worldState);
  const people = createWorldPeoplePopulation({
    prefix: "s60",
    cityIds: visibleCities,
    npcCount: Math.max(0, target.npcs - existingPeopleView.npcs.length),
    householdCount: Math.max(0, target.households - existingPeopleView.households.length),
    relationshipCount: Math.max(0, target.relationships - existingPeopleView.relationships.length),
    turnCount: worldState.turnCount,
    officeIds: numbered(22, (index) => `office-s60-${pad(index)}`),
    bureauIds: ["ministry_revenue", "censorate", "prefecture_county", "ministry_rites"],
    assetIdForHousehold: (index) => `asset-s60-${pad(index)}`,
    estateIdForHousehold: (index) => `estate-s60-${pad(index)}`
  });
  const assets = numbered(32, (index) => ({
    id: `asset-s60-${pad(index)}`,
    kind: index % 4 === 0 ? "granary" : index % 4 === 1 ? "shop" : index % 4 === 2 ? "debt" : "cash",
    name: `S60样本资产${index}`,
    ownerType: "household",
    ownerId: `s60-household-${pad(index)}`,
    cityId: visibleCities[(index * 5) % visibleCities.length],
    valueEstimate: 100 + index * 20,
    annualIncomeEstimate: 12 + index,
    debtValue: index % 4 === 2 ? 40 + index : 0,
    statusLabel: "公开估计",
    visibility: "public",
    knownToPlayer: true,
    publicSummary: `S60样本资产${index}只公开估值，不含真实密账。`,
    lastUpdatedTurn: worldState.turnCount
  }));
  const estates = numbered(32, (index) => ({
    id: `estate-s60-${pad(index)}`,
    name: `S60样本田产${index}`,
    ownerType: "household",
    ownerId: `s60-household-${pad(index)}`,
    cityId: visibleCities[(index * 7) % visibleCities.length],
    regionId: buildWorldGeographyView(worldState).cities[(index * 7) % visibleCities.length]?.regionId || "",
    landMu: 80 + index * 12,
    tenantHouseholds: 4 + (index % 10),
    rentGrainEstimate: 20 + index,
    taxBurden: 25 + (index % 35),
    waterworks: 45 + (index % 30),
    disputeRisk: index % 6 === 0 ? 45 : 12 + (index % 20),
    status: "held",
    statusLabel: "可见估计",
    visibility: "public",
    knownToPlayer: true,
    publicSummary: `S60样本田产${index}用于家产 view 验收。`,
    lastUpdatedTurn: worldState.turnCount
  }));

  worldState.worldPeople = {
    ...worldState.worldPeople,
    npcs: [...(worldState.worldPeople?.npcs || []), ...people.npcs],
    households: [...(worldState.worldPeople?.households || []), ...people.households],
    assets: [...(worldState.worldPeople?.assets || []), ...assets],
    estates: [...(worldState.worldPeople?.estates || []), ...estates],
    relationships: [
      ...(worldState.worldPeople?.relationships || []),
      ...people.relationships
    ],
    recentNotes: [
      "S60 small fixture：人物与家族只写入可见安全投影。",
      ...people.recentNotes
    ]
  };
}

function addOfficialFixture(worldState) {
  const geography = buildWorldGeographyView(worldState);
  const people = buildWorldPeopleView(worldState);
  const fixtureNpcIds = people.npcs
    .map((npc) => npc.id)
    .filter((id) => id.startsWith("s60-npc-"));
  const cityById = new Map(geography.cities.map((city) => [city.id, city]));
  const cityIds = geography.cities.map((city) => city.id);
  const bureaus = numbered(24, (index) => ({
    id: `bureau-s60-${pad(index)}`,
    name: `S60样本第${index}司`,
    aliases: [`样本${index}司`],
    level: index % 4 === 0 ? "provincial" : index % 5 === 0 ? "censorate" : "court",
    capitalCityId: cityIds[index % cityIds.length],
    duties: ["样本钱粮", "案牍", index % 3 === 0 ? "边报" : "地方考成"],
    authorityMetrics: ["server_owned", "view_only"],
    riskTags: index % 6 === 0 ? ["弹章风险"] : [],
    visibility: "public",
    knownToPlayer: true,
    publicSummary: `S60样本官署${index}，用于官职目录规模验收。`,
    lastUpdatedTurn: worldState.turnCount
  }));
  const offices = numbered(22, (index) => ({
    id: `office-s60-${pad(index)}`,
    title: `S60样本第${index}主事`,
    aliases: [`样本官${index}`],
    rankLabel: "正七品上下",
    rankBand: index % 4 === 0 ? "middle_central" : "low_central",
    bureauId: `bureau-s60-${pad(((index - 1) % bureaus.length) + 1)}`,
    track: "s60_fixture",
    jurisdictionScope: index % 3 === 0 ? "province" : "court",
    typicalCityIds: [cityIds[(index * 2) % cityIds.length]],
    requiredRankOrExam: ["进士", "候选观政"],
    appointmentMethods: ["铨选", "考成后补缺"],
    normalTermMonths: 36,
    duties: ["核册", "查账", index % 2 === 0 ? "问案" : "催科"],
    authorityMetrics: ["server_owned"],
    outpost: index % 3 === 0,
    visibility: "public",
    knownToPlayer: true,
    publicSummary: `S60样本官职${index}，任免仍由服务器官场模块裁决。`,
    lastUpdatedTurn: worldState.turnCount
  }));
  const cityJurisdictions = numbered(12, (index) => {
    const city = cityById.get(cityIds[(index * 3) % cityIds.length]);
    const bureauId = `bureau-s60-${pad(index)}`;
    return {
      id: `jurisdiction-s60-${pad(index)}`,
      name: `S60样本任所${index}`,
      bureauId,
      supervisingBureauId: bureauId,
      cityId: city.id,
      regionId: city.regionId,
      countryId: city.countryId,
      jurisdictionScope: index % 3 === 0 ? "province" : "prefecture",
      availableOfficeIds: offices.filter((office) => office.bureauId === bureauId).map((office) => office.id),
      routeIds: geography.routes.slice(index % Math.max(1, geography.routes.length), (index % Math.max(1, geography.routes.length)) + 2).map((route) => route.id),
      frontierZoneIds: [],
      localMetrics: {
        publicOrder: 50 + (index % 30),
        taxCapacity: 48 + (index % 35),
        lawsuits: 16 + (index % 40),
        waterworks: 42 + (index % 35),
        gentryInfluence: 45 + (index % 35),
        disasterRisk: 18 + (index % 50),
        militaryPressure: 20 + (index % 45),
        academyLevel: 35 + (index % 45)
      },
      visibility: "role_visible",
      knownToPlayer: true,
      publicSummary: `S60样本任所${index}，只暴露公开辖区指标。`,
      lastUpdatedTurn: worldState.turnCount
    };
  });
  const postings = numbered(47, (index) => {
    const office = offices[(index - 1) % offices.length];
    const jurisdiction = cityJurisdictions[(index - 1) % cityJurisdictions.length];
    return {
      id: `posting-s60-${pad(index)}`,
      officeId: office.id,
      officeTitle: office.title,
      bureauId: office.bureauId,
      holderType: "npc",
      holderId: fixtureNpcIds[(index - 1) % fixtureNpcIds.length] || "s60-npc-001",
      status: index % 8 === 0 ? "acting" : "active",
      cityId: jurisdiction.cityId,
      regionId: jurisdiction.regionId,
      jurisdictionId: jurisdiction.id,
      startedAt: {
        year: 1644,
        month: Math.max(1, (index % 12) + 1),
        tenDayPeriod: ((index - 1) % 3) + 1,
        turn: Math.max(0, worldState.turnCount - index)
      },
      expectedReviewTurn: worldState.turnCount + 12 + (index % 12),
      termMonths: 8 + (index % 30),
      performanceScore: 42 + (index % 45),
      impeachmentRisk: index % 10 === 0 ? 58 : 12 + (index % 25),
      publicReputation: 38 + (index % 45),
      visibility: "role_visible",
      knownToPlayer: true,
      publicSummary: `S60样本任命${index}，用于任所/任命规模验收。`,
      lastUpdatedTurn: worldState.turnCount
    };
  });

  worldState.officialPostings = {
    ...worldState.officialPostings,
    bureaus: [...(worldState.officialPostings?.bureaus || []), ...bureaus],
    offices: [...(worldState.officialPostings?.offices || []), ...offices],
    cityJurisdictions: [...(worldState.officialPostings?.cityJurisdictions || []), ...cityJurisdictions],
    postings: [...(worldState.officialPostings?.postings || []), ...postings],
    recentNotes: ["S60 small fixture：官职任所样本只提供服务器可见安全摘要。"]
  };
}

function addEventFixture(worldState) {
  worldState.eventHistory = numbered(8, (index) =>
    `S60公开近事${index}：户部、漕运、边报或地方钱粮有一条可入档摘要。`
  );
  worldState.worldThreads = {
    schemaVersion: 1,
    threads: numbered(2, (index) => ({
      id: `thread-s60-${pad(index)}`,
      status: "active",
      kind: index === 1 ? "border" : "official_assignment",
      sourceType: index === 1 ? "frontier_report" : "official_assignment",
      sourceId: `s60-source-${pad(index)}`,
      sourceLabel: index === 1 ? "边镇奏报" : "官场差遣",
      title: `S60公开议题${index}`,
      summary: `S60公开议题${index}用于事件档案和 prompt budget 验收。`,
      severity: index === 1 ? 3 : 2,
      createdTurn: worldState.turnCount - index,
      lastUpdatedTurn: worldState.turnCount,
      dueTurn: worldState.turnCount + index + 2,
      visibility: "public"
    })),
    recentResolved: []
  };
  worldState.longTermEvents = {
    schemaVersion: 1,
    queue: numbered(2, (index) => ({
      id: `long-term-s60-${pad(index)}`,
      key: `s60-long-term-${pad(index)}`,
      type: index === 1 ? "border" : "court",
      targetType: "world",
      targetId: "",
      title: `S60长期大势${index}`,
      summary: `S60长期大势${index}保持公开摘要，供事件档案和检索排序使用。`,
      severity: index === 1 ? 3 : 2,
      createdTurn: worldState.turnCount - index,
      startedYear: worldState.year,
      startedMonth: worldState.month,
      durationMonths: 4,
      remainingMonths: 2,
      cooldownKey: `s60-long-term-${pad(index)}`,
      cooldownTurns: worldState.turnCount + 18,
      cooldownUnit: "ten_day",
      visibility: "public"
    })),
    cooldowns: {},
    cooldownUnit: "ten_day",
    recentResolved: []
  };
}

function createEventIntelItems(
  count = WORLD_CONTENT_FIXTURE_TARGETS.small.eventIntelItems,
  size = "small",
  relatedCityIds = []
) {
  const prefix = fixturePrefix(size);
  const fallbackCityIds = numbered(WORLD_CONTENT_FIXTURE_TARGETS[size]?.cities || 24, (index) =>
    `${prefix}-city-${pad(index)}`
  );
  const cityIds = relatedCityIds.length ? relatedCityIds : fallbackCityIds;
  return numbered(count, (index) => ({
    id: `${prefix}-event-intel-${pad(index, 5)}`,
    title: `S60${size}公开情报${index}`,
    sourceType: index % 3 === 0 ? "rumor" : "event_template",
    scope: index % 4 === 0 ? "frontier" : index % 4 === 1 ? "fiscal" : "local",
    severity: (index % 3) + 1,
    relatedRefs: [cityIds[(index - 1) % cityIds.length]],
    visibility: "public",
    intelConfidence: index % 3 === 0 ? 45 : 70,
    publicText: `S60 ${size} 公开情报${index}只作为 fixture 总量侧车，不直接进入当前 route raw state。`
  }));
}

function createHiddenCanaries(size = "small") {
  const domains = [
    "country_neighbor",
    "city_route",
    "npc_household_asset",
    "office_posting",
    "event_archive",
    "intel_rumor",
    "prompt_retrieval",
    "audit_export"
  ];
  const target = WORLD_CONTENT_FIXTURE_TARGETS[size] || WORLD_CONTENT_FIXTURE_TARGETS.small;
  const perDomain = Math.max(10, Math.ceil(target.hiddenCanaries / domains.length));
  return domains.reduce((result, domain) => {
    result[domain] = numbered(perDomain, (index) => {
      const upper = domain.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
      if (domain === "prompt_retrieval" && index === 3) return "S60_PRIVATE_PROMPT_prompt_retrieval_index_ROW";
      if (domain === "audit_export" && index === 4) return "S60_PRIVATE_AUDIT_event_log_TOKEN";
      if (domain === "audit_export" && index === 5) return "S60_PRIVATE_AUDIT_ai_change_proposals_TOKEN";
      if (domain === "audit_export" && index === 6) return "S60_PRIVATE_PATH_data_sessions_secret_json";
      if (domain === "prompt_retrieval" && index === 7) return "sk-s60-private-canary-token";
      return `S60_PRIVATE_${upper}_${pad(index)}`;
    });
    return result;
  }, {});
}

function flattenCanaries(hiddenCanaries) {
  return Object.values(hiddenCanaries || {}).flatMap((tokens) => Array.isArray(tokens) ? tokens : []);
}

function createWorldContentFixture(options = {}) {
  const generationStartedAt = PERFORMANCE_CLOCK.now();
  const size = options.size || "small";
  const seed = options.seed || DEFAULT_SEED;
  if (!SUPPORTED_SIZES.has(size)) {
    throw new Error(`Unsupported S60 world content fixture size: ${size}`);
  }
  const target = WORLD_CONTENT_FIXTURE_TARGETS[size];

  const worldState = createInitialState({
    role: options.role || "official",
    playerName: options.playerName || "S60规模验收",
    year: options.year || 1644
  });
  worldState.sessionId = fixtureSessionId(size, seed);
  attachOfficialPlayerContext(worldState);
  addGeographyFixture(worldState);
  addPeopleFixture(worldState);
  addOfficialFixture(worldState);
  addEventFixture(worldState);

  const storageGeographyForRefs = size === "small" ? null : createStorageGeography(size);
  const relatedCityIds = size === "small"
    ? buildWorldGeographyView(worldState).cities.map((city) => city.id)
    : storageGeographyForRefs.cities.map((city) => city.id);
  const eventIntelItems = createEventIntelItems(target.eventIntelItems, size, relatedCityIds);
  const hiddenCanaries = createHiddenCanaries(size);
  const promptRetrievalRows = createStoragePromptRetrievalRows(size, target.promptRetrievalRows);
  const storageLedger = createWorldContentStorageLedger(
    size,
    seed,
    eventIntelItems,
    promptRetrievalRows,
    storageGeographyForRefs
  );
  const fixture = {
    size,
    seed,
    worldState,
    eventIntelItems,
    hiddenCanaries,
    promptRetrievalRows,
    storageLedger,
    fixtureSummary: {
      size,
      seed,
      target,
      supportedSizes: [...SUPPORTED_SIZES],
      note: size === "small"
        ? "S60.2 small 基线只把可随 route 返回的安全 projection 写入 worldState；事件/情报总量与真正私档 canary 保持侧车。"
        : "S60.2 medium/large 使用 storage-only 侧车记录世界总量；当前 raw route worldState 只保留安全 capped projection。"
    }
  };

  const fixtureGenerationMs = Number((PERFORMANCE_CLOCK.now() - generationStartedAt).toFixed(3));
  fixture.fixtureSummary.metrics = measureWorldContentFixture(fixture);
  fixture.fixtureSummary.performanceBaseline = {
    fixtureGenerationMs,
    ...buildWorldContentPerformanceBaseline(fixture)
  };
  return fixture;
}

function createFixtureSessionRecord(worldState, options = {}) {
  return createSessionRecord(worldState, {
    createdAt: options.createdAt || FIXTURE_CREATED_AT,
    updatedAt: options.updatedAt || FIXTURE_CREATED_AT,
    revision: options.revision || 1
  });
}

function countObjectRows(value) {
  if (Array.isArray(value)) {
    return value.every((item) => item && typeof item === "object" && !Array.isArray(item)) ? value.length : 0;
  }
  if (!value || typeof value !== "object") return 0;
  return Object.values(value).reduce((total, child) => total + countObjectRows(child), 0);
}

function countRetrievalSummaryRows(retrievalContext = {}) {
  return ["geography", "people", "offices", "events", "intel", "entities"]
    .reduce((total, key) => total + countObjectRows(retrievalContext[key]), 0);
}

function buildPromptBudgetReport(worldState, options = {}) {
  const promptContext = assemblePromptContext(worldState, {
    ...options,
    promptBudgetProfile: options.promptBudgetProfile || options.budgetProfile || options.profile
  });
  const serializedRetrieval = JSON.stringify(promptContext.retrievalContext);
  return {
    profile: promptContext.retrievalContext?.query?.profile || options.promptBudgetProfile || options.budgetProfile || options.profile || "high",
    summaryRows: countRetrievalSummaryRows(promptContext.retrievalContext),
    serializedChars: serializedRetrieval.length,
    promptContext
  };
}

function normalizeFixturePage(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1;
}

function normalizeFixturePageSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return WORLD_CONTENT_BROWSER_PAGE.defaultPageSize;
  return Math.max(1, Math.min(WORLD_CONTENT_BROWSER_PAGE.maxPageSize, Math.round(parsed)));
}

function getFixtureCollectionRows(fixtureOrLedger, collectionKey) {
  const fixture = fixtureOrLedger?.storageLedger || fixtureOrLedger;
  const worldState = fixtureOrLedger?.worldState;
  if (collectionKey === "geography.countries") {
    return fixture?.geography?.countries || (worldState ? buildWorldGeographyView(worldState).countries : []);
  }
  if (collectionKey === "geography.cities") {
    return fixture?.geography?.cities || (worldState ? buildWorldGeographyView(worldState).cities : []);
  }
  if (collectionKey === "geography.routes") {
    return fixture?.geography?.routes || (worldState ? buildWorldGeographyView(worldState).routes : []);
  }
  if (collectionKey === "geography.frontierZones") {
    return fixture?.geography?.frontierZones || (worldState ? buildWorldGeographyView(worldState).frontierZones : []);
  }
  if (collectionKey === "people.npcs") {
    return fixture?.people?.npcs || (worldState ? buildWorldPeopleView(worldState).npcs : []);
  }
  if (collectionKey === "people.households") {
    return fixture?.people?.households || (worldState ? buildWorldPeopleView(worldState).households : []);
  }
  if (collectionKey === "people.relationships") {
    return fixture?.people?.relationships || (worldState ? buildWorldPeopleView(worldState).relationships : []);
  }
  if (collectionKey === "offices.bureaus") {
    return fixture?.offices?.bureaus || (worldState ? buildOfficialPostingsView(worldState).bureaus : []);
  }
  if (collectionKey === "offices.offices") {
    return fixture?.offices?.offices || (worldState ? buildOfficialPostingsView(worldState).offices : []);
  }
  if (collectionKey === "offices.cityJurisdictions") {
    return fixture?.offices?.cityJurisdictions || (worldState ? buildOfficialPostingsView(worldState).cityJurisdictions : []);
  }
  if (collectionKey === "offices.postings") {
    return fixture?.offices?.postings || (worldState ? buildOfficialPostingsView(worldState).postings : []);
  }
  if (collectionKey === "offices.assessmentRecords") {
    return fixture?.offices?.assessmentRecords || (worldState ? buildOfficialPostingsView(worldState).assessmentRecords : []);
  }
  if (collectionKey === "offices.transferRecords") {
    return fixture?.offices?.transferRecords || (worldState ? buildOfficialPostingsView(worldState).transferRecords : []);
  }
  if (collectionKey === "events.eventIntelItems") {
    return fixtureOrLedger?.eventIntelItems || fixture?.events?.eventIntelItems || [];
  }
  if (collectionKey === "promptRetrievalRows") {
    return fixtureOrLedger?.promptRetrievalRows || fixture?.promptRetrievalRows || [];
  }
  throw new Error(`Unsupported S60 fixture collection: ${collectionKey}`);
}

function pickFields(row = {}, fields = []) {
  return fields.reduce((result, field) => {
    if (row[field] !== undefined) result[field] = row[field];
    return result;
  }, {});
}

function projectFixturePageRow(collectionKey, row = {}) {
  if (collectionKey.startsWith("geography.")) {
    return pickFields(row, [
      "id",
      "name",
      "kind",
      "countryId",
      "regionId",
      "jurisdictionLevel",
      "type",
      "fromCityId",
      "toCityId",
      "pressure",
      "risk",
      "visibility",
      "publicSummary"
    ]);
  }
  if (collectionKey.startsWith("people.")) {
    return pickFields(row, [
      "id",
      "name",
      "familyName",
      "householdId",
      "seatCityId",
      "currentCityId",
      "rankLabel",
      "sourceType",
      "sourceId",
      "targetType",
      "targetId",
      "relationship",
      "trust",
      "resentment",
      "visibility",
      "publicSummary"
    ]);
  }
  if (collectionKey.startsWith("offices.")) {
    return pickFields(row, [
      "id",
      "name",
      "title",
      "bureauId",
      "officeId",
      "postingId",
      "holderType",
      "holderId",
      "status",
      "cityId",
      "rankBand",
      "jurisdictionScope",
      "visibility",
      "publicSummary"
    ]);
  }
  if (collectionKey === "events.eventIntelItems") {
    return pickFields(row, [
      "id",
      "title",
      "sourceType",
      "scope",
      "severity",
      "relatedRefs",
      "visibility",
      "intelConfidence",
      "publicText"
    ]);
  }
  if (collectionKey === "promptRetrievalRows") {
    return pickFields(row, [
      "rowId",
      "domain",
      "collection",
      "sourceView",
      "visibility",
      "title",
      "summary",
      "tags",
      "relatedRefs",
      "sortPriority"
    ]);
  }
  return {};
}

function buildWorldContentFixturePage(fixtureOrLedger, collectionKey, options = {}) {
  const pageSize = normalizeFixturePageSize(options.pageSize);
  const query = typeof options.query === "string" ? options.query.trim().toLowerCase() : "";
  const rows = getFixtureCollectionRows(fixtureOrLedger, collectionKey);
  const projectedRows = rows.map((row) => projectFixturePageRow(collectionKey, row));
  const filteredRows = query
    ? projectedRows.filter((row) => JSON.stringify(row).toLowerCase().includes(query))
    : projectedRows;
  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(normalizeFixturePage(options.page), totalPages);
  const offset = (page - 1) * pageSize;

  return {
    collectionKey,
    query,
    items: filteredRows.slice(offset, offset + pageSize),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages
    },
    hiddenNotice: "S60.2 fixture 分页只返回服务器可见 projection；raw ledger、hidden 私档、prompt、key 与本地路径均不得进入页面。"
  };
}

function measureDurationMs(task) {
  const startedAt = PERFORMANCE_CLOCK.now();
  const value = task();
  return {
    value,
    durationMs: Number((PERFORMANCE_CLOCK.now() - startedAt).toFixed(3))
  };
}

function buildWorldContentPerformanceBaseline(fixtureOrWorldState) {
  const fixture = fixtureOrWorldState.worldState
    ? fixtureOrWorldState
    : { worldState: fixtureOrWorldState };
  const worldState = fixture.worldState;
  const archiveTiming = measureDurationMs(() => buildEventArchiveView(worldState, { page: 1, pageSize: 50 }));
  const promptTiming = measureDurationMs(() => buildPromptBudgetReport(worldState, {
    task: "official_career",
    playerAction: "核查户部、北京、漕运、边报、样本人物与任所",
    promptBudgetProfile: "ordinary"
  }));
  const retrievalTiming = measureDurationMs(() => buildPromptRetrievalRows(
    createFixtureSessionRecord(clone(worldState))
  ));
  const pageTiming = measureDurationMs(() => buildWorldContentFixturePage(
    fixture,
    fixture.size === "small" ? "geography.cities" : "promptRetrievalRows",
    { page: 1, pageSize: WORLD_CONTENT_BROWSER_PAGE.maxPageSize }
  ));

  return {
    fixtureSize: fixture.size || "worldState",
    eventArchivePaginationMs: archiveTiming.durationMs,
    promptAssemblyMs: promptTiming.durationMs,
    promptRetrievalRowsMs: retrievalTiming.durationMs,
    fixturePageMs: pageTiming.durationMs,
    eventArchiveRows: archiveTiming.value.pagination.totalItems,
    promptSummaryRows: promptTiming.value.summaryRows,
    promptRetrievalRows: retrievalTiming.value.length,
    fixturePageRows: pageTiming.value.items.length
  };
}

function countStorageRows(storageLedger, domain, collection) {
  const rows = storageLedger?.[domain]?.[collection];
  return Array.isArray(rows) ? rows.length : 0;
}

function measureWorldContentFixture(fixtureOrWorldState) {
  const worldState = fixtureOrWorldState.worldState || fixtureOrWorldState;
  const eventIntelItems = fixtureOrWorldState.eventIntelItems || [];
  const hiddenCanaries = fixtureOrWorldState.hiddenCanaries || {};
  const storageLedger = fixtureOrWorldState.storageLedger || null;
  const storagePromptRows = fixtureOrWorldState.promptRetrievalRows || storageLedger?.promptRetrievalRows || [];
  const geography = buildWorldGeographyView(worldState);
  const people = buildWorldPeopleView(worldState);
  const peopleGenealogy = measureWorldPeoplePopulation(people);
  const storagePeopleGenealogy = storageLedger?.people
    ? measureWorldPeoplePopulation(storageLedger.people)
    : null;
  const official = buildOfficialPostingsView(worldState);
  const archive = buildEventArchiveView(worldState, { pageSize: 50 });
  const record = createFixtureSessionRecord(clone(worldState));
  const promptRetrievalRows = buildPromptRetrievalRows(record);
  const highBudget = buildPromptBudgetReport(worldState, {
    task: "official_career",
    playerAction: "核查户部、北京、漕运、边报、样本人物与任所",
    promptBudgetProfile: "high"
  });
  const ordinaryBudget = buildPromptBudgetReport(worldState, {
    task: "official_career",
    playerAction: "核查户部、北京、漕运、边报、样本人物与任所",
    promptBudgetProfile: "ordinary"
  });
  const storageOfficialCatalogRows =
    countStorageRows(storageLedger, "offices", "bureaus") +
    countStorageRows(storageLedger, "offices", "offices");

  return {
    countries: Math.max(geography.countries.length, countStorageRows(storageLedger, "geography", "countries")),
    regions: Math.max(geography.regions.length, countStorageRows(storageLedger, "geography", "regions")),
    cities: Math.max(geography.cities.length, countStorageRows(storageLedger, "geography", "cities")),
    routes: Math.max(geography.routes.length, countStorageRows(storageLedger, "geography", "routes")),
    frontierZones: Math.max(geography.frontierZones.length, countStorageRows(storageLedger, "geography", "frontierZones")),
    npcs: Math.max(people.npcs.length, countStorageRows(storageLedger, "people", "npcs")),
    households: Math.max(people.households.length, countStorageRows(storageLedger, "people", "households")),
    relationships: Math.max(people.relationships.length, countStorageRows(storageLedger, "people", "relationships")),
    officialCatalogRows: Math.max(official.bureaus.length + official.offices.length, storageOfficialCatalogRows),
    bureaus: official.bureaus.length,
    offices: official.offices.length,
    cityJurisdictions: official.cityJurisdictions.length,
    postings: Math.max(official.postings.length, countStorageRows(storageLedger, "offices", "postings")),
    assessmentRecords: official.assessmentRecords.length,
    transferRecords: official.transferRecords.length,
    eventArchiveRows: archive.pagination.totalItems,
    eventIntelItems: eventIntelItems.length,
    promptRetrievalRows: Math.max(promptRetrievalRows.length, storagePromptRows.length),
    hiddenCanaries: flattenCanaries(hiddenCanaries).length,
    retrievalSummaryRows: highBudget.summaryRows,
    retrievalSerializedChars: highBudget.serializedChars,
    ordinaryRetrievalSummaryRows: ordinaryBudget.summaryRows,
    ordinaryRetrievalSerializedChars: ordinaryBudget.serializedChars,
    routeViewRows: {
      countries: geography.countries.length,
      cities: geography.cities.length,
      npcs: people.npcs.length,
      relationships: people.relationships.length,
      officialCatalogRows: official.bureaus.length + official.offices.length,
      postings: official.postings.length,
      eventArchiveRows: archive.pagination.totalItems,
      promptRetrievalRows: promptRetrievalRows.length
    },
    peopleGenealogy,
    storagePeopleGenealogy,
    storageRows: storageLedger ? {
      countries: countStorageRows(storageLedger, "geography", "countries"),
      cities: countStorageRows(storageLedger, "geography", "cities"),
      npcs: countStorageRows(storageLedger, "people", "npcs"),
      households: countStorageRows(storageLedger, "people", "households"),
      relationships: countStorageRows(storageLedger, "people", "relationships"),
      officialCatalogRows: storageOfficialCatalogRows,
      postings: countStorageRows(storageLedger, "offices", "postings"),
      eventIntelItems: eventIntelItems.length,
      promptRetrievalRows: storagePromptRows.length
    } : null
  };
}

function createCanaryPollutedWorldState(fixtureOrWorldState) {
  const sourceFixture = fixtureOrWorldState.worldState
    ? fixtureOrWorldState
    : {
      worldState: fixtureOrWorldState || createWorldContentFixture().worldState,
      hiddenCanaries: createHiddenCanaries()
    };
  const worldState = clone(sourceFixture.worldState);
  const canaries = sourceFixture.hiddenCanaries || createHiddenCanaries();
  const token = (domain, index) => canaries[domain]?.[index] || `S60_PRIVATE_${domain}_${index}`;

  worldState.worldGeography.countries.push({
    id: "country-s60-hidden-canary",
    kind: "neighbor",
    name: token("country_neighbor", 0),
    visibility: "hidden",
    publicSummary: token("country_neighbor", 1),
    policyPressureTags: [token("country_neighbor", 3)],
    diplomaticPosture: token("country_neighbor", 4),
    intelligenceSummary: token("country_neighbor", 5),
    hiddenNotes: [token("country_neighbor", 2)]
  });
  worldState.worldGeography.cities.push({
    id: "city-s60-hidden-canary",
    countryId: "country-s60-hidden-canary",
    regionId: "region-s60-hidden-canary",
    name: token("city_route", 0),
    visibility: "hidden",
    publicSummary: token("city_route", 1),
    localIssueTags: [token("city_route", 3)],
    cityIntelligenceSummary: token("city_route", 4),
    hiddenNotes: [token("city_route", 2)]
  });
  worldState.worldPeople.npcs.push({
    id: "npc-s60-hidden-canary",
    name: token("npc_household_asset", 0),
    visibility: "hidden",
    hiddenIntent: token("npc_household_asset", 1),
    hiddenNotes: [token("npc_household_asset", 2)]
  });
  worldState.worldPeople.relationships.push({
    id: "rel-s60-hidden-canary",
    sourceType: "npc",
    sourceId: "npc-s60-hidden-canary",
    targetType: "player",
    targetId: "P1",
    relationship: -90,
    resentment: 90,
    visibility: "hidden",
    recentNotes: [token("npc_household_asset", 3)]
  });
  worldState.officialPostings.postings.push({
    id: "posting-s60-hidden-canary",
    officeId: "office-s60-001",
    officeTitle: token("office_posting", 0),
    bureauId: "bureau-s60-001",
    holderType: "npc",
    holderId: "npc-s60-hidden-canary",
    status: "active",
    visibility: "hidden",
    publicSummary: token("office_posting", 1),
    hiddenNotes: [token("office_posting", 2)]
  });
  worldState.worldThreads.threads.push({
    id: "thread-s60-hidden-canary",
    status: "active",
    kind: "consequence",
    sourceType: "frontier_report",
    sourceId: "hidden-canary",
    title: token("event_archive", 0),
    summary: token("event_archive", 1),
    visibility: "hidden"
  });
  worldState.longTermEvents.queue.push({
    id: "long-term-s60-hidden-canary",
    key: "s60-hidden-canary",
    type: "border",
    title: token("intel_rumor", 0),
    summary: token("intel_rumor", 1),
    targetType: "world",
    durationMonths: 2,
    remainingMonths: 1,
    visibility: "hidden"
  });
  worldState.worldEntities.entities.push({
    id: "entity-s60-hidden-canary",
    category: "court",
    kind: "court_office",
    name: token("audit_export", 0),
    metrics: { influence: 50, pressure: 50, capacity: 50, trust: 50, deficit: 0 },
    visibility: "hidden",
    publicSummary: token("prompt_retrieval", 0),
    hiddenNotes: [token("prompt_retrieval", 1)]
  });

  return worldState;
}

module.exports = {
  WORLD_CONTENT_BROWSER_PAGE,
  WORLD_CONTENT_FIXTURE_TARGETS,
  WORLD_CONTENT_PROMPT_BUDGET,
  buildWorldContentFixturePage,
  buildWorldContentPerformanceBaseline,
  buildPromptBudgetReport,
  countRetrievalSummaryRows,
  createCanaryPollutedWorldState,
  createFixtureSessionRecord,
  createWorldContentFixture,
  flattenCanaries,
  measureWorldContentFixture
};
