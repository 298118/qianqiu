const { WORLD_GEOGRAPHY_DEEP_CONFIG } = require("./worldGeographyConfig");

const WORLD_GEOGRAPHY_SEED_SCHEMA_VERSION = 1;
const MAX_TEXT_LENGTH = 180;
const MAX_DEEP_TAGS = WORLD_GEOGRAPHY_DEEP_CONFIG.maxDeepTags;
const COUNTRY_DEEP_METRIC_DEFAULTS = WORLD_GEOGRAPHY_DEEP_CONFIG.countryMetricDefaults;
const CITY_DEEP_METRIC_DEFAULTS = WORLD_GEOGRAPHY_DEEP_CONFIG.cityMetricDefaults;
const COUNTRY_DEEP_METRIC_KEYS = WORLD_GEOGRAPHY_DEEP_CONFIG.countryMetricKeys;
const CITY_DEEP_METRIC_KEYS = WORLD_GEOGRAPHY_DEEP_CONFIG.cityMetricKeys;

const VISIBILITY_VALUES = new Set(["public", "role_visible", "rumor", "hidden"]);
const COUNTRY_KINDS = new Set(["player_realm", "neighbor", "tributary", "frontier_polity"]);
const ROUTE_TYPES = new Set(["road", "canal", "river", "sea", "pass"]);
const FRONTIER_STATUSES = new Set(["quiet", "open", "tense", "contested"]);

const DEFAULT_WORLD_GEOGRAPHY_SEED = {
  schemaVersion: WORLD_GEOGRAPHY_SEED_SCHEMA_VERSION,
  seedId: "late-ming-north-china",
  label: "明末天下基础种子",
  countries: [
    {
      id: "country-ming",
      kind: "player_realm",
      name: "大明",
      shortName: "明",
      polityType: "imperial_dynasty",
      rulerTitle: "皇帝",
      capitalCityId: "city-beijing",
      cultureTags: ["华夏", "儒家礼制", "科举文官"],
      governmentTags: ["六部", "都察院", "府州县"],
      visibility: "public",
      intelConfidence: 100,
      publicSummary: "玩家所在王朝，京师、漕运、边镇、江南钱粮共同支撑天下局面。"
    },
    {
      id: "country-manchu-frontier",
      kind: "neighbor",
      name: "关外满洲政权",
      shortName: "关外",
      polityType: "frontier_khanate",
      rulerTitle: "汗王",
      capitalCityId: "city-mukden",
      cultureTags: ["满洲", "骑射", "八旗"],
      governmentTags: ["旗制", "边外盟会"],
      visibility: "rumor",
      intelConfidence: 45,
      publicSummary: "山海关外的强邻，边报多称其兵马整肃，但具体虚实仍靠边镇奏报。"
    },
    {
      id: "country-mongol-steppe",
      kind: "frontier_polity",
      name: "漠南蒙古诸部",
      shortName: "漠南",
      polityType: "steppe_confederation",
      rulerTitle: "台吉",
      capitalCityId: "city-kharchin-camp",
      cultureTags: ["草原", "骑兵", "互市"],
      governmentTags: ["部落盟会", "互市边政"],
      visibility: "rumor",
      intelConfidence: 38,
      publicSummary: "大同、宣府以北的草原部族，或通互市，或因饥寒与边墙摩擦。"
    },
    {
      id: "country-joseon",
      kind: "tributary",
      name: "朝鲜",
      shortName: "朝鲜",
      polityType: "tributary_kingdom",
      rulerTitle: "国王",
      capitalCityId: "city-hanseong",
      cultureTags: ["东国", "儒学", "朝贡"],
      governmentTags: ["王廷", "贡道"],
      visibility: "role_visible",
      intelConfidence: 62,
      publicSummary: "东边藩属，贡道、边使和辽东局势常互相牵动。"
    },
    {
      id: "country-ryukyu",
      kind: "tributary",
      name: "琉球",
      shortName: "琉球",
      polityType: "maritime_tributary",
      rulerTitle: "国王",
      capitalCityId: "city-shuri",
      cultureTags: ["海舶", "朝贡", "南海"],
      governmentTags: ["贡使", "海路"],
      visibility: "rumor",
      intelConfidence: 40,
      publicSummary: "南海贡道上的岛邦，常由福建、广东海道奏报传入。"
    }
  ],
  regions: [
    {
      id: "region-north-zhili",
      countryId: "country-ming",
      name: "北直隶",
      level: "capital_region",
      seatCityId: "city-beijing",
      visibility: "public",
      publicSummary: "京师根本之地，六部、都察院、九门和漕运终点皆在此牵连。"
    },
    {
      id: "region-south-zhili",
      countryId: "country-ming",
      name: "南直隶",
      level: "province",
      seatCityId: "city-nanjing",
      visibility: "public",
      publicSummary: "江南钱粮、贡院与文教重地，常影响士林和户部账册。"
    },
    {
      id: "region-shandong",
      countryId: "country-ming",
      name: "山东",
      level: "province",
      seatCityId: "city-jinan",
      visibility: "public",
      publicSummary: "漕路、黄河与京畿之间的转运要地。"
    },
    {
      id: "region-henan",
      countryId: "country-ming",
      name: "河南",
      level: "province",
      seatCityId: "city-kaifeng",
      visibility: "public",
      publicSummary: "中原河患与粮价常在此显影，开封是河防和赈务的关键落点。"
    },
    {
      id: "region-shanxi-frontier",
      countryId: "country-ming",
      name: "山西边面",
      level: "frontier_region",
      seatCityId: "city-taiyuan",
      visibility: "public",
      publicSummary: "大同、宣府边报常由此入京，军饷与马市压力很重。"
    },
    {
      id: "region-liaodong-beyond",
      countryId: "country-manchu-frontier",
      name: "辽东关外",
      level: "neighbor_region",
      seatCityId: "city-mukden",
      visibility: "rumor",
      publicSummary: "关外强邻的核心地带，玩家起初只知道粗略边报。"
    },
    {
      id: "region-jiangnan",
      countryId: "country-ming",
      name: "江南府县",
      level: "province_cluster",
      seatCityId: "city-suzhou",
      visibility: "public",
      publicSummary: "苏杭财赋、书院与士绅密集，是钱粮和科名的重要来源。"
    },
    {
      id: "region-south-coast",
      countryId: "country-ming",
      name: "南海海道",
      level: "coastal_region",
      seatCityId: "city-guangzhou",
      visibility: "role_visible",
      publicSummary: "广东海道、贡舶和海防同在一线，朝贡与走私传闻并行。"
    }
  ],
  cities: [
    {
      id: "city-beijing",
      countryId: "country-ming",
      regionId: "region-north-zhili",
      name: "北京",
      jurisdictionLevel: "capital",
      terrain: "平原",
      riverOrCoast: "运河北端",
      strategicTags: ["京师", "六部", "九门", "漕运终点"],
      supervisingBureauIds: ["ministry_personnel", "ministry_revenue", "ministry_war", "censorate"],
      visibility: "public",
      intelConfidence: 100,
      publicSummary: "京师为朝廷中枢，官缺、奏疏、军饷和仓场都在此汇集。"
    },
    {
      id: "city-nanjing",
      countryId: "country-ming",
      regionId: "region-south-zhili",
      name: "南京",
      jurisdictionLevel: "secondary_capital",
      terrain: "江南城池",
      riverOrCoast: "长江",
      strategicTags: ["留都", "贡院", "漕运"],
      supervisingBureauIds: ["ministry_rites", "ministry_revenue"],
      visibility: "public",
      intelConfidence: 88,
      publicSummary: "留都与江南贡院所在，士林、钱粮和漕运在此交汇。"
    },
    {
      id: "city-suzhou",
      countryId: "country-ming",
      regionId: "region-jiangnan",
      name: "苏州",
      jurisdictionLevel: "prefecture",
      terrain: "水网平原",
      riverOrCoast: "太湖水系",
      strategicTags: ["赋税", "士绅", "织造", "文社"],
      supervisingBureauIds: ["prefecture_county", "ministry_revenue"],
      visibility: "public",
      intelConfidence: 80,
      publicSummary: "江南财赋与文风重镇，士绅、田赋和商税常牵动朝廷。"
    },
    {
      id: "city-hangzhou",
      countryId: "country-ming",
      regionId: "region-jiangnan",
      name: "杭州",
      jurisdictionLevel: "prefecture",
      terrain: "湖山府城",
      riverOrCoast: "钱塘江",
      strategicTags: ["书院", "商税", "海道"],
      supervisingBureauIds: ["prefecture_county", "ministry_rites"],
      visibility: "public",
      intelConfidence: 76,
      publicSummary: "东南文教与商旅节点，海道消息也常从此转入内地。"
    },
    {
      id: "city-jinan",
      countryId: "country-ming",
      regionId: "region-shandong",
      name: "济南",
      jurisdictionLevel: "provincial_seat",
      terrain: "泉城平原",
      riverOrCoast: "黄河近旁",
      strategicTags: ["漕路", "黄河", "京畿屏障"],
      supervisingBureauIds: ["provincial_admin", "provincial_judicial"],
      visibility: "public",
      intelConfidence: 74,
      publicSummary: "山东省治，黄河、漕道和京师供应常在此互相掣肘。"
    },
    {
      id: "city-kaifeng",
      countryId: "country-ming",
      regionId: "region-henan",
      name: "开封",
      jurisdictionLevel: "prefecture",
      terrain: "黄河故城",
      riverOrCoast: "黄河",
      strategicTags: ["河患", "赈务", "中原"],
      supervisingBureauIds: ["prefecture_county", "ministry_works"],
      visibility: "public",
      intelConfidence: 66,
      publicSummary: "中原旧都，河患、粮价和赈务常成地方官考成之题。"
    },
    {
      id: "city-taiyuan",
      countryId: "country-ming",
      regionId: "region-shanxi-frontier",
      name: "太原",
      jurisdictionLevel: "provincial_seat",
      terrain: "山地盆地",
      riverOrCoast: "汾水",
      strategicTags: ["边饷", "煤铁", "山西商路"],
      supervisingBureauIds: ["provincial_admin", "ministry_war"],
      visibility: "public",
      intelConfidence: 70,
      publicSummary: "山西省治，边饷、商路和军需在此汇合。"
    },
    {
      id: "city-datong",
      countryId: "country-ming",
      regionId: "region-shanxi-frontier",
      name: "大同",
      jurisdictionLevel: "frontier_garrison",
      terrain: "边塞",
      riverOrCoast: "塞外口岸",
      strategicTags: ["边墙", "马市", "军镇"],
      supervisingBureauIds: ["ministry_war", "censorate"],
      visibility: "public",
      intelConfidence: 62,
      publicSummary: "北边军镇，边报、军饷和互市真假最易牵动朝局。"
    },
    {
      id: "city-shanhai-pass",
      countryId: "country-ming",
      regionId: "region-north-zhili",
      name: "山海关",
      jurisdictionLevel: "frontier_pass",
      terrain: "关城",
      riverOrCoast: "山海之间",
      strategicTags: ["关隘", "辽东", "边防"],
      supervisingBureauIds: ["ministry_war"],
      visibility: "public",
      intelConfidence: 64,
      publicSummary: "京师东北锁钥，关外动静先在此化作边报。"
    },
    {
      id: "city-mukden",
      countryId: "country-manchu-frontier",
      regionId: "region-liaodong-beyond",
      name: "盛京",
      jurisdictionLevel: "neighbor_capital",
      terrain: "关外都城",
      riverOrCoast: "辽河流域",
      strategicTags: ["关外", "八旗", "骑兵"],
      supervisingBureauIds: [],
      visibility: "rumor",
      intelConfidence: 35,
      publicSummary: "关外强邻都城，玩家初期只从边报与商旅口中得知。"
    },
    {
      id: "city-kharchin-camp",
      countryId: "country-mongol-steppe",
      regionId: "region-shanxi-frontier",
      name: "喀喇沁营地",
      jurisdictionLevel: "steppe_camp",
      terrain: "草原营帐",
      riverOrCoast: "塞外草场",
      strategicTags: ["互市", "骑兵", "草原"],
      supervisingBureauIds: [],
      visibility: "rumor",
      intelConfidence: 30,
      publicSummary: "漠南诸部营地，传闻随马市、边报和使者来往而变。"
    },
    {
      id: "city-hanseong",
      countryId: "country-joseon",
      regionId: "region-liaodong-beyond",
      name: "汉城",
      jurisdictionLevel: "tributary_capital",
      terrain: "王城",
      riverOrCoast: "汉江",
      strategicTags: ["贡道", "东藩", "辽东消息"],
      supervisingBureauIds: [],
      visibility: "role_visible",
      intelConfidence: 50,
      publicSummary: "朝鲜王城，礼部、辽东边事和贡道文书会偶尔提及。"
    },
    {
      id: "city-guangzhou",
      countryId: "country-ming",
      regionId: "region-south-coast",
      name: "广州",
      jurisdictionLevel: "prefecture",
      terrain: "岭南府城",
      riverOrCoast: "珠江口",
      strategicTags: ["海舶", "商税", "海防"],
      supervisingBureauIds: ["prefecture_county", "ministry_revenue", "ministry_war"],
      visibility: "role_visible",
      intelConfidence: 64,
      publicSummary: "南海口岸，贡舶、商税和海防常彼此牵连。"
    },
    {
      id: "city-shuri",
      countryId: "country-ryukyu",
      regionId: "region-south-coast",
      name: "首里",
      jurisdictionLevel: "tributary_capital",
      terrain: "海岛王城",
      riverOrCoast: "南海",
      strategicTags: ["朝贡", "海路", "贡舶"],
      supervisingBureauIds: [],
      visibility: "rumor",
      intelConfidence: 28,
      publicSummary: "琉球王城，玩家初期只从贡使和海道传闻中得知。"
    }
  ],
  routes: [
    {
      id: "route-grand-canal-north",
      type: "canal",
      name: "京杭漕运北段",
      fromCityId: "city-nanjing",
      toCityId: "city-beijing",
      viaCityIds: ["city-suzhou", "city-jinan"],
      distanceLabel: "千里漕程",
      seasonalRisk: "伏秋水涨、黄河浅淤和仓场亏空都会阻滞漕粮。",
      strategicTags: ["漕运", "粮储", "户部"],
      visibility: "public",
      publicSummary: "江南粮赋入京的主脉，后续可成为钱粮和赈务事件的地理落点。"
    },
    {
      id: "route-yellow-river-kaifeng-jinan",
      type: "river",
      name: "黄河河防线",
      fromCityId: "city-kaifeng",
      toCityId: "city-jinan",
      viaCityIds: [],
      distanceLabel: "中原河道",
      seasonalRisk: "春汛与伏汛最易牵出河工、徭役和赈务。",
      strategicTags: ["河工", "赈务", "工部"],
      visibility: "public",
      publicSummary: "黄河故道与山东河防相接，是地方灾务与工部差事的常见来源。"
    },
    {
      id: "route-datong-beijing-frontier-road",
      type: "road",
      name: "大同入京边报驿路",
      fromCityId: "city-datong",
      toCityId: "city-beijing",
      viaCityIds: ["city-taiyuan"],
      distanceLabel: "数百里驿传",
      seasonalRisk: "冬雪、军饷拖欠和马匹疲敝会拖慢边报。",
      strategicTags: ["驿传", "军饷", "兵部"],
      visibility: "public",
      publicSummary: "北边军镇奏报入京的要路，边患压力会先在这里显影。"
    },
    {
      id: "route-shanhai-liaodong-pass",
      type: "pass",
      name: "山海关辽东通道",
      fromCityId: "city-shanhai-pass",
      toCityId: "city-mukden",
      viaCityIds: [],
      distanceLabel: "关门内外",
      seasonalRisk: "军情真假、商旅传闻和关防盘查都影响情报可信度。",
      strategicTags: ["关隘", "辽东", "边防"],
      visibility: "public",
      publicSummary: "关内外消息汇聚处，是边境压力和邻国情报的第一条种子路线。"
    },
    {
      id: "route-jiangnan-coastal-sea",
      type: "sea",
      name: "东南海道",
      fromCityId: "city-guangzhou",
      toCityId: "city-hangzhou",
      viaCityIds: ["city-shuri"],
      distanceLabel: "海道迂远",
      seasonalRisk: "台风、海盗、贡舶和私商都会影响海道奏报。",
      strategicTags: ["海防", "贡舶", "商税"],
      visibility: "role_visible",
      publicSummary: "东南海舶与贡道线，暂只作为海道、商税和海防的静态背景。"
    },
    {
      id: "route-hidden-liaodong-smuggling",
      type: "pass",
      name: "SEALED_LIAODONG_SMUGGLING_ROUTE",
      fromCityId: "city-shanhai-pass",
      toCityId: "city-mukden",
      viaCityIds: [],
      distanceLabel: "暗路",
      seasonalRisk: "SEALED_ROUTE_RISK",
      strategicTags: ["hidden"],
      visibility: "hidden",
      publicSummary: "SEALED_ROUTE_SUMMARY",
      hiddenNotes: ["SEALED_ROUTE_NOTE"]
    }
  ],
  frontierZones: [
    {
      id: "frontier-shanhai-liaodong",
      name: "山海关辽东边面",
      countryId: "country-ming",
      neighborCountryId: "country-manchu-frontier",
      cityIds: ["city-shanhai-pass", "city-mukden"],
      routeIds: ["route-shanhai-liaodong-pass"],
      status: "tense",
      pressureMetric: "borderThreat",
      visibility: "public",
      publicSummary: "关外动静牵动京师边患，是后续国家/边境动态实例化的首要压力面。"
    },
    {
      id: "frontier-datong-steppe",
      name: "大同漠南边面",
      countryId: "country-ming",
      neighborCountryId: "country-mongol-steppe",
      cityIds: ["city-datong", "city-kharchin-camp"],
      routeIds: ["route-datong-beijing-frontier-road"],
      status: "open",
      pressureMetric: "borderThreat",
      visibility: "public",
      publicSummary: "互市、马政与军镇日用相连，边报未必都是战事。"
    },
    {
      id: "frontier-joseon-liaodong",
      name: "辽东朝鲜贡道",
      countryId: "country-ming",
      neighborCountryId: "country-joseon",
      cityIds: ["city-hanseong", "city-shanhai-pass"],
      routeIds: ["route-shanhai-liaodong-pass"],
      status: "contested",
      pressureMetric: "borderThreat",
      visibility: "role_visible",
      publicSummary: "东藩贡道与辽东军情纠缠，礼部和兵部都可能收到片段消息。"
    },
    {
      id: "frontier-south-sea-tribute",
      name: "南海朝贡海道",
      countryId: "country-ming",
      neighborCountryId: "country-ryukyu",
      cityIds: ["city-guangzhou", "city-shuri"],
      routeIds: ["route-jiangnan-coastal-sea"],
      status: "quiet",
      pressureMetric: "treasury",
      visibility: "rumor",
      publicSummary: "南海贡道远离京师，只以海道传闻和商税札记进入初始视野。"
    },
    {
      id: "frontier-hidden-palace-intel",
      name: "SEALED_FRONTIER_TITLE",
      countryId: "country-ming",
      neighborCountryId: "country-manchu-frontier",
      cityIds: ["city-beijing", "city-mukden"],
      routeIds: ["route-hidden-liaodong-smuggling"],
      status: "contested",
      pressureMetric: "hidden",
      visibility: "hidden",
      publicSummary: "SEALED_FRONTIER_SUMMARY",
      hiddenNotes: ["SEALED_FRONTIER_NOTE"]
    }
  ],
  officeJurisdictions: [
    {
      id: "jurisdiction-ministry-personnel-capital",
      bureauId: "ministry_personnel",
      name: "吏部京师铨选辖区",
      scope: "central",
      countryIds: ["country-ming"],
      cityIds: ["city-beijing"],
      routeIds: [],
      frontierZoneIds: [],
      officeTrack: "central_ministry",
      visibility: "role_visible",
      publicSummary: "吏部以京师官缺、考成和铨选为核心，后续官职任免仍归服务器裁决。"
    },
    {
      id: "jurisdiction-ministry-revenue-canal",
      bureauId: "ministry_revenue",
      name: "户部漕粮钱谷辖区",
      scope: "fiscal_route",
      countryIds: ["country-ming"],
      cityIds: ["city-beijing", "city-nanjing", "city-suzhou", "city-jinan"],
      routeIds: ["route-grand-canal-north"],
      frontierZoneIds: [],
      officeTrack: "central_ministry",
      visibility: "public",
      publicSummary: "户部静态辖区先挂漕运与江南钱粮，动态税粮留到 S50.2 后实例化。"
    },
    {
      id: "jurisdiction-ministry-war-frontier",
      bureauId: "ministry_war",
      name: "兵部边报军饷辖区",
      scope: "frontier",
      countryIds: ["country-ming"],
      cityIds: ["city-beijing", "city-datong", "city-shanhai-pass"],
      routeIds: ["route-datong-beijing-frontier-road", "route-shanhai-liaodong-pass"],
      frontierZoneIds: ["frontier-shanhai-liaodong", "frontier-datong-steppe"],
      officeTrack: "central_ministry",
      visibility: "public",
      publicSummary: "兵部先挂北边军镇、关隘和驿路，战争开合仍由服务器后续规则裁定。"
    },
    {
      id: "jurisdiction-ministry-rites-tribute-exam",
      bureauId: "ministry_rites",
      name: "礼部科贡辖区",
      scope: "ritual_exam",
      countryIds: ["country-ming", "country-joseon", "country-ryukyu"],
      cityIds: ["city-nanjing", "city-hanseong", "city-shuri"],
      routeIds: ["route-jiangnan-coastal-sea"],
      frontierZoneIds: ["frontier-joseon-liaodong", "frontier-south-sea-tribute"],
      officeTrack: "central_ministry",
      visibility: "role_visible",
      publicSummary: "礼部辖科举、贡使和礼文，静态 seed 只给出可见范围，不写动态外交。"
    },
    {
      id: "jurisdiction-censorate-inspection",
      bureauId: "censorate",
      name: "都察院巡按监察辖区",
      scope: "inspection",
      countryIds: ["country-ming"],
      cityIds: ["city-beijing", "city-suzhou", "city-datong", "city-kaifeng"],
      routeIds: ["route-grand-canal-north", "route-yellow-river-kaifeng-jinan"],
      frontierZoneIds: ["frontier-datong-steppe"],
      officeTrack: "censorate",
      visibility: "role_visible",
      publicSummary: "都察院可巡按地方与军镇，但隐藏弹章和密奏不进入 seed view。"
    },
    {
      id: "jurisdiction-provincial-admin-grain",
      bureauId: "provincial_admin",
      name: "布政司地方钱粮辖区",
      scope: "province",
      countryIds: ["country-ming"],
      cityIds: ["city-jinan", "city-taiyuan", "city-suzhou"],
      routeIds: ["route-grand-canal-north"],
      frontierZoneIds: [],
      officeTrack: "provincial",
      visibility: "public",
      publicSummary: "布政司静态辖区挂省城、府县和钱粮来源，后续 per-session 再写动态数值。"
    },
    {
      id: "jurisdiction-provincial-judicial-cases",
      bureauId: "provincial_judicial",
      name: "按察司刑名监察辖区",
      scope: "province",
      countryIds: ["country-ming"],
      cityIds: ["city-jinan", "city-kaifeng", "city-taiyuan"],
      routeIds: ["route-yellow-river-kaifeng-jinan"],
      frontierZoneIds: [],
      officeTrack: "provincial",
      visibility: "role_visible",
      publicSummary: "按察司辖地方案牍与官吏查参，当前只作为任所地理和案牍落点。"
    },
    {
      id: "jurisdiction-prefecture-county-local",
      bureauId: "prefecture_county",
      name: "府州县基层辖区",
      scope: "local",
      countryIds: ["country-ming"],
      cityIds: ["city-suzhou", "city-hangzhou", "city-kaifeng", "city-guangzhou"],
      routeIds: ["route-yellow-river-kaifeng-jinan", "route-jiangnan-coastal-sea"],
      frontierZoneIds: [],
      officeTrack: "local",
      visibility: "public",
      publicSummary: "府州县是地方官行动的空间入口，具体任所指标留待 S50.2/S52 联动。"
    }
  ]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return /^[a-z0-9][a-z0-9_-]*$/i.test(text) ? text : fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampMetric(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
}

function normalizeDeepMetrics(raw, keys, defaults) {
  return keys.reduce((result, key) => {
    result[key] = clampMetric(raw?.[key], defaults[key]);
    return result;
  }, {});
}

function hasTag(raw, pattern) {
  return (Array.isArray(raw?.strategicTags) ? raw.strategicTags : [])
    .some((tag) => pattern.test(String(tag)));
}

function defaultCountryDeepMetrics(raw = {}) {
  if (raw.kind === "player_realm") {
    return {
      fiscalPressure: 52,
      militaryReadiness: 58,
      nationalPrestige: 72,
      legitimacy: 66,
      successionRisk: 28,
      diplomaticTension: 48,
      tributeTradeActivity: 60,
      intelligenceReliability: 92
    };
  }
  if (raw.kind === "tributary") {
    return {
      fiscalPressure: 36,
      militaryReadiness: 38,
      nationalPrestige: 50,
      legitimacy: 58,
      successionRisk: 32,
      diplomaticTension: 30,
      tributeTradeActivity: 70,
      intelligenceReliability: clampNumber(raw.intelConfidence, 0, 100, 55)
    };
  }
  if (raw.kind === "frontier_polity") {
    return {
      fiscalPressure: 44,
      militaryReadiness: 68,
      nationalPrestige: 45,
      legitimacy: 48,
      successionRisk: 48,
      diplomaticTension: 62,
      tributeTradeActivity: 58,
      intelligenceReliability: clampNumber(raw.intelConfidence, 0, 100, 40)
    };
  }
  return {
    fiscalPressure: 46,
    militaryReadiness: 72,
    nationalPrestige: 60,
    legitimacy: 54,
    successionRisk: 44,
    diplomaticTension: 70,
    tributeTradeActivity: 36,
    intelligenceReliability: clampNumber(raw.intelConfidence, 0, 100, 45)
  };
}

function defaultCityDeepMetrics(raw = {}) {
  const isCapital = /capital/.test(raw.jurisdictionLevel || "");
  const isFrontier = /frontier|pass|garrison/.test(raw.jurisdictionLevel || "") || hasTag(raw, /边|军|关|防/);
  const isScholarCity = hasTag(raw, /书院|贡院|科举|文社/);
  const isTradeCity = hasTag(raw, /商|漕|海道|海舶|互市|贡道|赋税/);
  const isRiverCity = /河|运河|水|江|湖|海/.test(raw.riverOrCoast || "");

  return {
    populationScale: isCapital ? 86 : isTradeCity ? 68 : CITY_DEEP_METRIC_DEFAULTS.populationScale,
    taxBase: isTradeCity ? 72 : CITY_DEEP_METRIC_DEFAULTS.taxBase,
    grainStock: hasTag(raw, /粮|漕|仓/) ? 64 : CITY_DEEP_METRIC_DEFAULTS.grainStock,
    marketPriceStress: isTradeCity ? 46 : CITY_DEEP_METRIC_DEFAULTS.marketPriceStress,
    gentryInfluence: isScholarCity || hasTag(raw, /士绅|文社/) ? 74 : CITY_DEEP_METRIC_DEFAULTS.gentryInfluence,
    lawsuitPressure: CITY_DEEP_METRIC_DEFAULTS.lawsuitPressure,
    corveeBurden: isRiverCity ? 46 : CITY_DEEP_METRIC_DEFAULTS.corveeBurden,
    waterworksIntegrity: isRiverCity ? 62 : CITY_DEEP_METRIC_DEFAULTS.waterworksIntegrity,
    disasterRisk: hasTag(raw, /河患|海防|边/) ? 55 : CITY_DEEP_METRIC_DEFAULTS.disasterRisk,
    trafficLoad: isCapital || isTradeCity ? 72 : CITY_DEEP_METRIC_DEFAULTS.trafficLoad,
    garrisonStrength: isFrontier ? 78 : CITY_DEEP_METRIC_DEFAULTS.garrisonStrength,
    academyLevel: isScholarCity ? 80 : CITY_DEEP_METRIC_DEFAULTS.academyLevel
  };
}

function normalizeStringList(value, limit = 8, maxLength = 80) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of value) {
    const text = cleanText(entry, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeIdList(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of value) {
    const id = cleanId(entry, "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeVisibility(value) {
  return VISIBILITY_VALUES.has(value) ? value : "public";
}

function normalizeCountry(raw) {
  if (!isPlainObject(raw)) return null;
  const id = cleanId(raw.id, "");
  const name = cleanText(raw.name, "", 60);
  if (!id || !name) return null;
  const defaultDeepMetrics = defaultCountryDeepMetrics(raw);
  const defaultPressureTags = raw.kind === "player_realm"
    ? ["钱粮", "边备", "朝局"]
    : raw.kind === "tributary"
      ? ["贡道", "礼部", "互市"]
      : raw.kind === "frontier_polity"
        ? ["边面", "互市", "骑兵"]
        : ["边报", "军力", "情报"];
  return {
    id,
    kind: COUNTRY_KINDS.has(raw.kind) ? raw.kind : "neighbor",
    name,
    shortName: cleanText(raw.shortName, name, 24),
    polityType: cleanText(raw.polityType, "polity", 48),
    rulerTitle: cleanText(raw.rulerTitle, "未明君主", 32),
    capitalCityId: cleanId(raw.capitalCityId, ""),
    cultureTags: normalizeStringList(raw.cultureTags, 8),
    governmentTags: normalizeStringList(raw.governmentTags, 8),
    visibility: normalizeVisibility(raw.visibility),
    intelConfidence: clampNumber(raw.intelConfidence, 0, 100, raw.visibility === "public" ? 80 : 35),
    publicSummary: cleanText(raw.publicSummary, `${name}暂为静态种子国家。`),
    policyPressureTags: normalizeStringList(raw.policyPressureTags, MAX_DEEP_TAGS).length
      ? normalizeStringList(raw.policyPressureTags, MAX_DEEP_TAGS)
      : defaultPressureTags,
    diplomaticPosture: cleanText(raw.diplomaticPosture, "外交态势未详。", WORLD_GEOGRAPHY_DEEP_CONFIG.countryTextLimits.diplomaticPosture),
    intelligenceSummary: cleanText(raw.intelligenceSummary, "只见公开奏报与传闻摘要。", WORLD_GEOGRAPHY_DEEP_CONFIG.countryTextLimits.intelligenceSummary),
    ...normalizeDeepMetrics(raw, COUNTRY_DEEP_METRIC_KEYS, defaultDeepMetrics),
    hiddenNotes: normalizeStringList(raw.hiddenNotes, 6)
  };
}

function normalizeRegion(raw) {
  if (!isPlainObject(raw)) return null;
  const id = cleanId(raw.id, "");
  const name = cleanText(raw.name, "", 60);
  if (!id || !name) return null;
  return {
    id,
    countryId: cleanId(raw.countryId, ""),
    name,
    level: cleanText(raw.level, "region", 48),
    seatCityId: cleanId(raw.seatCityId, ""),
    visibility: normalizeVisibility(raw.visibility),
    publicSummary: cleanText(raw.publicSummary, `${name}为静态地理区划。`),
    hiddenNotes: normalizeStringList(raw.hiddenNotes, 6)
  };
}

function normalizeCity(raw) {
  if (!isPlainObject(raw)) return null;
  const id = cleanId(raw.id, "");
  const name = cleanText(raw.name, "", 60);
  if (!id || !name) return null;
  const defaultDeepMetrics = defaultCityDeepMetrics(raw);
  const defaultIssueTags = normalizeStringList(raw.strategicTags, MAX_DEEP_TAGS);
  return {
    id,
    countryId: cleanId(raw.countryId, ""),
    regionId: cleanId(raw.regionId, ""),
    name,
    jurisdictionLevel: cleanText(raw.jurisdictionLevel, "city", 48),
    terrain: cleanText(raw.terrain, "未明地势", 48),
    riverOrCoast: cleanText(raw.riverOrCoast, "", 48),
    strategicTags: normalizeStringList(raw.strategicTags, 8),
    supervisingBureauIds: normalizeIdList(raw.supervisingBureauIds, 8),
    visibility: normalizeVisibility(raw.visibility),
    intelConfidence: clampNumber(raw.intelConfidence, 0, 100, raw.visibility === "public" ? 70 : 35),
    publicSummary: cleanText(raw.publicSummary, `${name}为静态种子城市。`),
    localIssueTags: normalizeStringList(raw.localIssueTags, MAX_DEEP_TAGS).length
      ? normalizeStringList(raw.localIssueTags, MAX_DEEP_TAGS)
      : defaultIssueTags,
    cityIntelligenceSummary: cleanText(raw.cityIntelligenceSummary, "城市奏报只含可见指标。", WORLD_GEOGRAPHY_DEEP_CONFIG.cityTextLimits.cityIntelligenceSummary),
    ...normalizeDeepMetrics(raw, CITY_DEEP_METRIC_KEYS, defaultDeepMetrics),
    hiddenNotes: normalizeStringList(raw.hiddenNotes, 6)
  };
}

function normalizeRoute(raw) {
  if (!isPlainObject(raw)) return null;
  const id = cleanId(raw.id, "");
  const name = cleanText(raw.name, "", 80);
  if (!id || !name) return null;
  return {
    id,
    type: ROUTE_TYPES.has(raw.type) ? raw.type : "road",
    name,
    fromCityId: cleanId(raw.fromCityId, ""),
    toCityId: cleanId(raw.toCityId, ""),
    viaCityIds: normalizeIdList(raw.viaCityIds, 8),
    distanceLabel: cleanText(raw.distanceLabel, "路程未详", 40),
    seasonalRisk: cleanText(raw.seasonalRisk, "随时令有通行风险。"),
    strategicTags: normalizeStringList(raw.strategicTags, 8),
    visibility: normalizeVisibility(raw.visibility),
    publicSummary: cleanText(raw.publicSummary, `${name}为静态种子路线。`),
    hiddenNotes: normalizeStringList(raw.hiddenNotes, 6)
  };
}

function normalizeFrontierZone(raw) {
  if (!isPlainObject(raw)) return null;
  const id = cleanId(raw.id, "");
  const name = cleanText(raw.name, "", 80);
  if (!id || !name) return null;
  return {
    id,
    name,
    countryId: cleanId(raw.countryId, ""),
    neighborCountryId: cleanId(raw.neighborCountryId, ""),
    cityIds: normalizeIdList(raw.cityIds, 8),
    routeIds: normalizeIdList(raw.routeIds, 8),
    status: FRONTIER_STATUSES.has(raw.status) ? raw.status : "open",
    pressureMetric: cleanText(raw.pressureMetric, "borderThreat", 48),
    visibility: normalizeVisibility(raw.visibility),
    publicSummary: cleanText(raw.publicSummary, `${name}为静态边境压力面。`),
    hiddenNotes: normalizeStringList(raw.hiddenNotes, 6)
  };
}

function normalizeOfficeJurisdiction(raw) {
  if (!isPlainObject(raw)) return null;
  const id = cleanId(raw.id, "");
  const name = cleanText(raw.name, "", 80);
  if (!id || !name) return null;
  return {
    id,
    bureauId: cleanId(raw.bureauId, ""),
    name,
    scope: cleanText(raw.scope, "local", 48),
    countryIds: normalizeIdList(raw.countryIds, 8),
    cityIds: normalizeIdList(raw.cityIds, 16),
    routeIds: normalizeIdList(raw.routeIds, 8),
    frontierZoneIds: normalizeIdList(raw.frontierZoneIds, 8),
    officeTrack: cleanText(raw.officeTrack, "local", 48),
    visibility: normalizeVisibility(raw.visibility),
    publicSummary: cleanText(raw.publicSummary, `${name}为静态官署辖区。`),
    hiddenNotes: normalizeStringList(raw.hiddenNotes, 6)
  };
}

function normalizeWorldGeographySeed(raw = DEFAULT_WORLD_GEOGRAPHY_SEED) {
  const source = isPlainObject(raw) ? raw : DEFAULT_WORLD_GEOGRAPHY_SEED;
  return {
    schemaVersion: WORLD_GEOGRAPHY_SEED_SCHEMA_VERSION,
    seedId: cleanId(source.seedId, DEFAULT_WORLD_GEOGRAPHY_SEED.seedId),
    label: cleanText(source.label, DEFAULT_WORLD_GEOGRAPHY_SEED.label, 80),
    countries: (Array.isArray(source.countries) ? source.countries : [])
      .map(normalizeCountry)
      .filter(Boolean),
    regions: (Array.isArray(source.regions) ? source.regions : [])
      .map(normalizeRegion)
      .filter(Boolean),
    cities: (Array.isArray(source.cities) ? source.cities : [])
      .map(normalizeCity)
      .filter(Boolean),
    routes: (Array.isArray(source.routes) ? source.routes : [])
      .map(normalizeRoute)
      .filter(Boolean),
    frontierZones: (Array.isArray(source.frontierZones) ? source.frontierZones : [])
      .map(normalizeFrontierZone)
      .filter(Boolean),
    officeJurisdictions: (Array.isArray(source.officeJurisdictions) ? source.officeJurisdictions : [])
      .map(normalizeOfficeJurisdiction)
      .filter(Boolean)
  };
}

function getDefaultWorldGeographySeed() {
  return normalizeWorldGeographySeed(DEFAULT_WORLD_GEOGRAPHY_SEED);
}

function visibleRows(rows) {
  return rows.filter((row) => row.visibility !== "hidden");
}

function filterVisibleIds(values, visibleIds) {
  return values.filter((id) => visibleIds.has(id));
}

function nullableVisibleId(id, visibleIds) {
  return visibleIds.has(id) ? id : null;
}

function displayCountry(country, visibleCityIds) {
  return {
    id: country.id,
    kind: country.kind,
    name: country.name,
    shortName: country.shortName,
    polityType: country.polityType,
    rulerTitle: country.rulerTitle,
    capitalCityId: nullableVisibleId(country.capitalCityId, visibleCityIds),
    cultureTags: country.cultureTags,
    governmentTags: country.governmentTags,
    visibility: country.visibility,
    intelConfidence: country.intelConfidence,
    publicSummary: country.publicSummary,
    policyPressureTags: country.policyPressureTags,
    diplomaticPosture: country.diplomaticPosture,
    intelligenceSummary: country.intelligenceSummary,
    fiscalPressure: country.fiscalPressure,
    militaryReadiness: country.militaryReadiness,
    nationalPrestige: country.nationalPrestige,
    legitimacy: country.legitimacy,
    successionRisk: country.successionRisk,
    diplomaticTension: country.diplomaticTension,
    tributeTradeActivity: country.tributeTradeActivity,
    intelligenceReliability: country.intelligenceReliability
  };
}

function displayRegion(region, visibleCityIds) {
  return {
    id: region.id,
    countryId: region.countryId,
    name: region.name,
    level: region.level,
    seatCityId: nullableVisibleId(region.seatCityId, visibleCityIds),
    visibility: region.visibility,
    publicSummary: region.publicSummary
  };
}

function displayCity(city, visibleBureauIds = null) {
  return {
    id: city.id,
    countryId: city.countryId,
    regionId: city.regionId,
    name: city.name,
    jurisdictionLevel: city.jurisdictionLevel,
    terrain: city.terrain,
    riverOrCoast: city.riverOrCoast,
    strategicTags: city.strategicTags,
    supervisingBureauIds: visibleBureauIds
      ? filterVisibleIds(city.supervisingBureauIds, visibleBureauIds)
      : city.supervisingBureauIds,
    visibility: city.visibility,
    intelConfidence: city.intelConfidence,
    publicSummary: city.publicSummary,
    localIssueTags: city.localIssueTags,
    cityIntelligenceSummary: city.cityIntelligenceSummary,
    populationScale: city.populationScale,
    taxBase: city.taxBase,
    grainStock: city.grainStock,
    marketPriceStress: city.marketPriceStress,
    gentryInfluence: city.gentryInfluence,
    lawsuitPressure: city.lawsuitPressure,
    corveeBurden: city.corveeBurden,
    waterworksIntegrity: city.waterworksIntegrity,
    disasterRisk: city.disasterRisk,
    trafficLoad: city.trafficLoad,
    garrisonStrength: city.garrisonStrength,
    academyLevel: city.academyLevel
  };
}

function displayRoute(route, visibleCityIds) {
  return {
    id: route.id,
    type: route.type,
    name: route.name,
    fromCityId: route.fromCityId,
    toCityId: route.toCityId,
    viaCityIds: filterVisibleIds(route.viaCityIds, visibleCityIds),
    distanceLabel: route.distanceLabel,
    seasonalRisk: route.seasonalRisk,
    strategicTags: route.strategicTags,
    visibility: route.visibility,
    publicSummary: route.publicSummary
  };
}

function displayFrontierZone(frontier, visibleCityIds, visibleRouteIds) {
  return {
    id: frontier.id,
    name: frontier.name,
    countryId: frontier.countryId,
    neighborCountryId: frontier.neighborCountryId,
    cityIds: filterVisibleIds(frontier.cityIds, visibleCityIds),
    routeIds: filterVisibleIds(frontier.routeIds, visibleRouteIds),
    status: frontier.status,
    pressureMetric: frontier.pressureMetric,
    visibility: frontier.visibility,
    publicSummary: frontier.publicSummary
  };
}

function displayOfficeJurisdiction(jurisdiction, visibleCountryIds, visibleCityIds, visibleRouteIds, visibleFrontierZoneIds) {
  return {
    id: jurisdiction.id,
    bureauId: jurisdiction.bureauId,
    name: jurisdiction.name,
    scope: jurisdiction.scope,
    countryIds: filterVisibleIds(jurisdiction.countryIds, visibleCountryIds),
    cityIds: filterVisibleIds(jurisdiction.cityIds, visibleCityIds),
    routeIds: filterVisibleIds(jurisdiction.routeIds, visibleRouteIds),
    frontierZoneIds: filterVisibleIds(jurisdiction.frontierZoneIds, visibleFrontierZoneIds),
    officeTrack: jurisdiction.officeTrack,
    visibility: jurisdiction.visibility,
    publicSummary: jurisdiction.publicSummary
  };
}

function buildWorldGeographySeedView(raw = DEFAULT_WORLD_GEOGRAPHY_SEED) {
  const seed = normalizeWorldGeographySeed(raw);
  const visibleCountries = visibleRows(seed.countries);
  const visibleCountryIds = new Set(visibleCountries.map((country) => country.id));
  const visibleRegions = visibleRows(seed.regions)
    .filter((region) => visibleCountryIds.has(region.countryId));
  const visibleRegionIds = new Set(visibleRegions.map((region) => region.id));
  const visibleCities = visibleRows(seed.cities)
    .filter((city) => visibleCountryIds.has(city.countryId) && visibleRegionIds.has(city.regionId));
  const visibleCityIds = new Set(visibleCities.map((city) => city.id));
  const visibleRoutes = visibleRows(seed.routes)
    .filter((route) => visibleCityIds.has(route.fromCityId) && visibleCityIds.has(route.toCityId));
  const visibleRouteIds = new Set(visibleRoutes.map((route) => route.id));
  const visibleFrontiers = visibleRows(seed.frontierZones)
    .filter((frontier) =>
      visibleCountryIds.has(frontier.countryId) && visibleCountryIds.has(frontier.neighborCountryId)
    );
  const visibleFrontierIds = new Set(visibleFrontiers.map((frontier) => frontier.id));
  const visibleJurisdictions = visibleRows(seed.officeJurisdictions);

  return {
    schemaVersion: seed.schemaVersion,
    seedId: seed.seedId,
    label: seed.label,
    countries: visibleCountries.map((country) => displayCountry(country, visibleCityIds)),
    regions: visibleRegions.map((region) => displayRegion(region, visibleCityIds)),
    cities: visibleCities.map((city) => displayCity(city)),
    routes: visibleRoutes.map((route) => displayRoute(route, visibleCityIds)),
    frontierZones: visibleFrontiers.map((frontier) =>
      displayFrontierZone(frontier, visibleCityIds, visibleRouteIds)
    ),
    officeJurisdictions: visibleJurisdictions.map((jurisdiction) =>
      displayOfficeJurisdiction(jurisdiction, visibleCountryIds, visibleCityIds, visibleRouteIds, visibleFrontierIds)
    )
  };
}

function addDuplicateIssues(issues, rows, type) {
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) {
      issues.push({ type, id: row.id, message: `${type} id 重复` });
    }
    seen.add(row.id);
  }
}

function requireRefs(issues, sourceType, sourceId, field, values, targetType, targetIds) {
  for (const value of values.filter(Boolean)) {
    if (!targetIds.has(value)) {
      issues.push({
        type: sourceType,
        id: sourceId,
        field,
        refType: targetType,
        refId: value,
        message: `${sourceType}.${field} 引用不存在的 ${targetType}: ${value}`
      });
    }
  }
}

function validateWorldGeographySeed(raw = DEFAULT_WORLD_GEOGRAPHY_SEED) {
  const seed = normalizeWorldGeographySeed(raw);
  const issues = [];
  addDuplicateIssues(issues, seed.countries, "country");
  addDuplicateIssues(issues, seed.regions, "region");
  addDuplicateIssues(issues, seed.cities, "city");
  addDuplicateIssues(issues, seed.routes, "route");
  addDuplicateIssues(issues, seed.frontierZones, "frontierZone");
  addDuplicateIssues(issues, seed.officeJurisdictions, "officeJurisdiction");

  const countryIds = new Set(seed.countries.map((country) => country.id));
  const regionIds = new Set(seed.regions.map((region) => region.id));
  const cityIds = new Set(seed.cities.map((city) => city.id));
  const routeIds = new Set(seed.routes.map((route) => route.id));
  const frontierZoneIds = new Set(seed.frontierZones.map((frontier) => frontier.id));

  for (const country of seed.countries) {
    requireRefs(issues, "country", country.id, "capitalCityId", [country.capitalCityId], "city", cityIds);
  }
  for (const region of seed.regions) {
    requireRefs(issues, "region", region.id, "countryId", [region.countryId], "country", countryIds);
    requireRefs(issues, "region", region.id, "seatCityId", [region.seatCityId], "city", cityIds);
  }
  for (const city of seed.cities) {
    requireRefs(issues, "city", city.id, "countryId", [city.countryId], "country", countryIds);
    requireRefs(issues, "city", city.id, "regionId", [city.regionId], "region", regionIds);
  }
  for (const route of seed.routes) {
    requireRefs(issues, "route", route.id, "fromCityId", [route.fromCityId], "city", cityIds);
    requireRefs(issues, "route", route.id, "toCityId", [route.toCityId], "city", cityIds);
    requireRefs(issues, "route", route.id, "viaCityIds", route.viaCityIds, "city", cityIds);
  }
  for (const frontier of seed.frontierZones) {
    requireRefs(issues, "frontierZone", frontier.id, "countryId", [frontier.countryId], "country", countryIds);
    requireRefs(issues, "frontierZone", frontier.id, "neighborCountryId", [frontier.neighborCountryId], "country", countryIds);
    requireRefs(issues, "frontierZone", frontier.id, "cityIds", frontier.cityIds, "city", cityIds);
    requireRefs(issues, "frontierZone", frontier.id, "routeIds", frontier.routeIds, "route", routeIds);
  }
  for (const jurisdiction of seed.officeJurisdictions) {
    requireRefs(issues, "officeJurisdiction", jurisdiction.id, "countryIds", jurisdiction.countryIds, "country", countryIds);
    requireRefs(issues, "officeJurisdiction", jurisdiction.id, "cityIds", jurisdiction.cityIds, "city", cityIds);
    requireRefs(issues, "officeJurisdiction", jurisdiction.id, "routeIds", jurisdiction.routeIds, "route", routeIds);
    requireRefs(issues, "officeJurisdiction", jurisdiction.id, "frontierZoneIds", jurisdiction.frontierZoneIds, "frontierZone", frontierZoneIds);
  }

  return issues;
}

module.exports = {
  WORLD_GEOGRAPHY_SEED_SCHEMA_VERSION,
  buildWorldGeographySeedView,
  getDefaultWorldGeographySeed,
  normalizeWorldGeographySeed,
  validateWorldGeographySeed
};
