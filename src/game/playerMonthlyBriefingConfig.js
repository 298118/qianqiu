const PLAYER_MONTHLY_BRIEFING_SCHEMA_VERSION = "s70.10-player-monthly-briefing.v1";

const PLAYER_MONTHLY_BRIEFING_ROLES = Object.freeze([
  "official",
  "magistrate",
  "minister",
  "general",
  "emperor"
]);

const PLAYER_MONTHLY_BRIEFING_ROLE_LABELS = Object.freeze({
  official: "入仕官员",
  magistrate: "地方官",
  minister: "大臣",
  general: "将领",
  emperor: "皇帝"
});

const MONTHLY_BRIEFING_SECTION_CONFIG = Object.freeze([
  { id: "official_duties", label: "本职差事", maxItems: 4 },
  { id: "fiscal_local", label: "钱粮民情", maxItems: 4 },
  { id: "military_diplomacy", label: "军务边情", maxItems: 3 },
  { id: "court_network", label: "上官同僚", maxItems: 4 },
  { id: "next_actions", label: "下月可行", maxItems: 4 }
]);

const MONTHLY_BRIEFING_LIMITS = Object.freeze({
  maxReports: 8,
  maxSectionItems: 4,
  maxActionItems: 5,
  maxRiskItems: 5,
  maxSourceRefs: 8,
  maxTextLength: 180
});

module.exports = {
  MONTHLY_BRIEFING_LIMITS,
  MONTHLY_BRIEFING_SECTION_CONFIG,
  PLAYER_MONTHLY_BRIEFING_ROLE_LABELS,
  PLAYER_MONTHLY_BRIEFING_ROLES,
  PLAYER_MONTHLY_BRIEFING_SCHEMA_VERSION
};
