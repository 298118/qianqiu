const INTELLIGENCE_RUMOR_SCHEMA_VERSION = 1;

const INTELLIGENCE_RUMOR_CONFIG = Object.freeze({
  maxRumors: 14,
  maxArchiveRumors: 6,
  maxPromptRumors: 4,
  promptSummaryProfiles: Object.freeze({
    ordinary: Object.freeze({
      maxRumors: 1,
      textLimit: 36,
      includeSourceAttributions: false
    }),
    high: Object.freeze({
      maxRumors: 4,
      textLimit: 180,
      includeSourceAttributions: true
    })
  }),
  maxRetrievalRumors: 18,
  maxSourceAttributions: 10,
  maxRelatedRefs: 6,
  textLimit: 180,
  thresholds: Object.freeze({
    unverified: 35,
    plausible: 55,
    credible: 72,
    confirmed: 88
  }),
  roleAccess: Object.freeze({
    scholar: Object.freeze({
      rumorLimit: 5,
      confidenceCap: 58,
      confidenceBonus: -12,
      scopeLabel: "坊间、书院与公开榜文",
      notice: "书生只读取公开风声、书院谈资和可见事件链；不读取官署密札、完整军务财赋或隐藏人物私档。"
    }),
    magistrate: Object.freeze({
      rumorLimit: 8,
      confidenceCap: 78,
      confidenceBonus: 4,
      scopeLabel: "任所、衙门案牍与公开传闻",
      notice: "地方官读取任所相关案牍、地方风声和有限上级转报；不读取密奏、未公开任免或隐藏情报真值。"
    }),
    official: Object.freeze({
      rumorLimit: 9,
      confidenceCap: 82,
      confidenceBonus: 6,
      scopeLabel: "本官署、同僚私信与公开奏报",
      notice: "入仕官员读取本官署职责、同僚转述和公开奏报范围内的情报摘要；不得越权读取密档。"
    }),
    minister: Object.freeze({
      rumorLimit: 12,
      confidenceCap: 90,
      confidenceBonus: 10,
      scopeLabel: "部院奏报、御史风闻与跨域摘要",
      notice: "大臣可读取跨区域情报摘要和御史风闻，但密札真值、隐藏动机和数据库原始行仍不可见。"
    }),
    general: Object.freeze({
      rumorLimit: 10,
      confidenceCap: 84,
      confidenceBonus: 8,
      scopeLabel: "军中侦报、粮道风声与边吏转报",
      notice: "将领读取边镇、粮道、使节和军需相关情报摘要；战和、调兵和隐藏情报公开仍由服务器裁决。"
    }),
    emperor: Object.freeze({
      rumorLimit: 14,
      confidenceCap: 94,
      confidenceBonus: 14,
      scopeLabel: "御前摘报、部院奏报与公开舆情",
      notice: "皇帝读取最高层安全摘要；密档真值、任免、战和、刑赏和落库仍由服务器裁决。"
    })
  }),
  sourceBaseCredibility: Object.freeze({
    geography_country: 58,
    geography_city: 56,
    local_docket: 70,
    military_report: 68,
    economic_report: 66,
    relationship: 52,
    event_chain: 76
  }),
  sourcePriorityBoost: Object.freeze({
    scholar: Object.freeze({
      geography_country: 18,
      geography_city: 16,
      event_chain: 14,
      relationship: 10
    }),
    magistrate: Object.freeze({
      local_docket: 34,
      geography_city: 24,
      economic_report: 12,
      relationship: 10
    }),
    official: Object.freeze({
      local_docket: 20,
      economic_report: 22,
      event_chain: 18,
      relationship: 16
    }),
    minister: Object.freeze({
      economic_report: 24,
      military_report: 22,
      local_docket: 18,
      event_chain: 16
    }),
    general: Object.freeze({
      military_report: 36,
      geography_country: 18,
      economic_report: 16,
      event_chain: 12
    }),
    emperor: Object.freeze({
      military_report: 26,
      economic_report: 24,
      local_docket: 20,
      event_chain: 18,
      geography_country: 16
    })
  })
});

module.exports = {
  INTELLIGENCE_RUMOR_CONFIG,
  INTELLIGENCE_RUMOR_SCHEMA_VERSION
};
