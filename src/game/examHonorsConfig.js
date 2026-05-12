const EXAM_HONOR_SCHEMA_VERSION = 1;

const EXAM_HONOR_LIMITS = Object.freeze({
  maxVisibleHonors: 12,
  maxPromptHonors: 5,
  textPreviewLength: 160,
  palaceSecondClassPlaces: 3
});

const LEVEL_HONOR_TITLES = Object.freeze({
  provincial_exam: {
    first: "解元",
    placementPrefix: "乡试"
  },
  metropolitan_exam: {
    first: "会元",
    placementPrefix: "会试"
  }
});

const PALACE_TOP_TITLES = Object.freeze(["状元", "榜眼", "探花"]);

module.exports = {
  EXAM_HONOR_LIMITS,
  EXAM_HONOR_SCHEMA_VERSION,
  LEVEL_HONOR_TITLES,
  PALACE_TOP_TITLES
};
