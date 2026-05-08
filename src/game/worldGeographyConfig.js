const COUNTRY_DEEP_METRIC_DEFAULTS = Object.freeze({
  fiscalPressure: 45,
  militaryReadiness: 50,
  nationalPrestige: 55,
  legitimacy: 55,
  successionRisk: 35,
  diplomaticTension: 40,
  tributeTradeActivity: 40,
  intelligenceReliability: 50
});

const CITY_DEEP_METRIC_DEFAULTS = Object.freeze({
  populationScale: 50,
  taxBase: 50,
  grainStock: 55,
  marketPriceStress: 40,
  gentryInfluence: 45,
  lawsuitPressure: 35,
  corveeBurden: 35,
  waterworksIntegrity: 50,
  disasterRisk: 35,
  trafficLoad: 45,
  garrisonStrength: 35,
  academyLevel: 40
});

const COUNTRY_DEEP_METRIC_KEYS = Object.freeze(Object.keys(COUNTRY_DEEP_METRIC_DEFAULTS));
const CITY_DEEP_METRIC_KEYS = Object.freeze(Object.keys(CITY_DEEP_METRIC_DEFAULTS));

const WORLD_GEOGRAPHY_DEEP_CONFIG = Object.freeze({
  maxDeepTags: 8,
  countryMetricDefaults: COUNTRY_DEEP_METRIC_DEFAULTS,
  cityMetricDefaults: CITY_DEEP_METRIC_DEFAULTS,
  countryMetricKeys: COUNTRY_DEEP_METRIC_KEYS,
  cityMetricKeys: CITY_DEEP_METRIC_KEYS,
  countryTextLimits: Object.freeze({
    diplomaticPosture: 96,
    intelligenceSummary: 120
  }),
  cityTextLimits: Object.freeze({
    cityIntelligenceSummary: 120
  })
});

module.exports = {
  WORLD_GEOGRAPHY_DEEP_CONFIG
};
