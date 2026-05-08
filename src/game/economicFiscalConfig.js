const ECONOMIC_FISCAL_SCHEMA_VERSION = 1;

const ECONOMIC_FISCAL_CONFIG = Object.freeze({
  maxFiscalLedgers: 4,
  maxGrainMarketReports: 8,
  maxTradeSaltCanalRoutes: 6,
  maxLocalTreasuryReports: 6,
  maxDebtCorruptionRisks: 6,
  maxMarketIncidents: 6,
  maxPromptReports: 8,
  maxRetrievalReports: 20,
  maxArchiveIncidents: 5,
  textLimit: 180,
  thresholds: Object.freeze({
    watch: 45,
    strained: 62,
    urgent: 78,
    critical: 90
  }),
  fiscalWeights: Object.freeze({
    fiscalPressure: 0.28,
    deficitPressure: 0.24,
    grainStress: 0.2,
    corruption: 0.16,
    taxPressure: 0.12
  }),
  grainMarketWeights: Object.freeze({
    grainStockGap: 0.32,
    marketPriceStress: 0.28,
    grainStress: 0.18,
    disasterRisk: 0.14,
    taxBurden: 0.08
  }),
  tradeRouteWeights: Object.freeze({
    routeRisk: 0.34,
    marketStress: 0.22,
    grainStress: 0.18,
    trafficLoad: 0.16,
    corruption: 0.1
  }),
  localTreasuryWeights: Object.freeze({
    taxCapacityGap: 0.28,
    localTreasuryGap: 0.24,
    reliefPressure: 0.22,
    gentryInfluence: 0.14,
    corruption: 0.12
  }),
  debtCorruptionWeights: Object.freeze({
    debtPressure: 0.34,
    corruptionRisk: 0.28,
    deficitPressure: 0.18,
    legalRisk: 0.12,
    influence: 0.08
  }),
  roleAccess: Object.freeze({
    scholar: Object.freeze({
      ledgerLimit: 0,
      cityLimit: 0,
      routeLimit: 0,
      localTreasuryLimit: 0,
      debtLimit: 0,
      incidentLimit: 0,
      notice: "书生默认只能听见市井粮价传闻，不读取完整财赋市场态势。"
    }),
    magistrate: Object.freeze({
      ledgerLimit: 1,
      cityLimit: 3,
      routeLimit: 2,
      localTreasuryLimit: 2,
      debtLimit: 2,
      incidentLimit: 3,
      notice: "地方官只读取任所、邻近商路和公开钱粮压力摘要。"
    }),
    official: Object.freeze({
      ledgerLimit: 2,
      cityLimit: 4,
      routeLimit: 3,
      localTreasuryLimit: 3,
      debtLimit: 3,
      incidentLimit: 4,
      notice: "入仕官员按官署职责读取可见财赋、粮储和市场摘要。"
    }),
    minister: Object.freeze({
      ledgerLimit: 3,
      cityLimit: 6,
      routeLimit: 5,
      localTreasuryLimit: 4,
      debtLimit: 4,
      incidentLimit: 5,
      notice: "大臣可读取跨区域财赋市场摘要，但不能直接裁决税粮。"
    }),
    general: Object.freeze({
      ledgerLimit: 1,
      cityLimit: 3,
      routeLimit: 3,
      localTreasuryLimit: 1,
      debtLimit: 1,
      incidentLimit: 3,
      notice: "将领只读取与军需、粮运和商路相关的有限财赋线索。"
    }),
    emperor: Object.freeze({
      ledgerLimit: 4,
      cityLimit: 8,
      routeLimit: 6,
      localTreasuryLimit: 6,
      debtLimit: 6,
      incidentLimit: 6,
      notice: "皇帝可读取最高层财赋市场摘要；税粮、赈济、库银和追赃仍需服务器裁决。"
    })
  })
});

module.exports = {
  ECONOMIC_FISCAL_CONFIG,
  ECONOMIC_FISCAL_SCHEMA_VERSION
};
