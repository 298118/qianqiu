const HISTORICAL_EVENT_ARCHIVE_SCHEMA_VERSION = 1;

const HISTORICAL_EVENT_ARCHIVE_CONFIG = Object.freeze({
  maxPublicChains: 10,
  maxArchiveChains: 6,
  maxRelatedRefs: 8,
  maxAppliedChanges: 5,
  maxAuditLinks: 5,
  maxFollowUpTriggers: 5,
  textLimit: 180,
  thresholds: Object.freeze({
    watch: 45,
    strained: 62,
    urgent: 78,
    critical: 90
  }),
  templates: Object.freeze([
    Object.freeze({
      id: "natural_disaster_relief",
      domain: "natural_disaster",
      domainLabel: "灾异赈务",
      title: "灾异赈务事件链",
      sourceLabel: "案牍与财赋",
      publicLead: "地方灾异、粮储与赈务牵连成链",
      sealedLead: "密档留存灾赈因果、钱粮压力与后续核验线索",
      followUps: Object.freeze(["复核灾报与粮价", "查赈册、工料与民心", "月末由服务器裁决赈济后果"])
    }),
    Object.freeze({
      id: "court_faction_conflict",
      domain: "court_conflict",
      domainLabel: "官场争斗",
      title: "官场争斗事件链",
      sourceLabel: "考成与人物",
      publicLead: "任所考成、风评与人事牵连成链",
      sealedLead: "密档留存弹劾、荐举、考成风险与执行链线索",
      followUps: Object.freeze(["观察考成风险", "核对官署与人物引用", "任免升降仍由服务器裁决"])
    }),
    Object.freeze({
      id: "frontier_military_alarm",
      domain: "frontier",
      domainLabel: "边事军务",
      title: "边事军务事件链",
      sourceLabel: "军务外交",
      publicLead: "边镇、粮道、使节与战备牵连成链",
      sealedLead: "密档留存军情可信度、粮道风险与战和触发线索",
      followUps: Object.freeze(["复核边报可信度", "观察粮道与驻军", "调兵战和仍由服务器裁决"])
    }),
    Object.freeze({
      id: "market_tax_chain",
      domain: "market_tax",
      domainLabel: "商税财赋",
      title: "商税财赋事件链",
      sourceLabel: "财赋市场",
      publicLead: "税粮、粮价、盐漕与商路牵连成链",
      sealedLead: "密档留存钱粮流向、商路风险与追核触发线索",
      followUps: Object.freeze(["复核府库与商路", "观察粮价与债务", "税粮市场结算仍由服务器裁决"])
    }),
    Object.freeze({
      id: "relationship_memory_chain",
      domain: "relationship",
      domainLabel: "人物关系",
      title: "人物关系事件链",
      sourceLabel: "人物谱牒",
      publicLead: "人情、怨望、同乡同年或派系关系牵连成链",
      sealedLead: "密档留存人物关系压力、可见记忆与后续请托线索",
      followUps: Object.freeze(["观察人情债与怨望", "只读取可见人物关系", "隐藏动机不得公开"])
    }),
    Object.freeze({
      id: "imperial_exam_chain",
      domain: "exam",
      domainLabel: "科场档案",
      title: "科场事件链",
      sourceLabel: "科举履历",
      publicLead: "科场交卷、名次与师友声望牵连成链",
      sealedLead: "密档留存科场流程、诚信校验与后续授官线索",
      followUps: Object.freeze(["复核科场履历", "观察同年座师关系", "榜单与授官仍由服务器裁决"])
    }),
    Object.freeze({
      id: "local_assignment_chain",
      domain: "local_assignment",
      domainLabel: "地方差遣",
      title: "地方差遣事件链",
      sourceLabel: "地方案牍",
      publicLead: "钱粮、刑名、水利、盗匪与任所收束牵连成链",
      sealedLead: "密档留存差遣压力、考成候选线索与后续成案条件",
      followUps: Object.freeze(["清结案牍与差事", "等待服务器考成 resolver", "AI 不得直接结案或改库"])
    })
  ])
});

module.exports = {
  HISTORICAL_EVENT_ARCHIVE_CONFIG,
  HISTORICAL_EVENT_ARCHIVE_SCHEMA_VERSION
};
