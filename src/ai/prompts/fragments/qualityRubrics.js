// @ts-check

const CORE_QUALITY_RUBRICS = Object.freeze([
  {
    id: "schema_safety",
    weight: 20,
    description: "输出必须通过对应 schema 与安全扫描，不泄漏 hidden/raw/provider/path/key。"
  },
  {
    id: "evidence_grounding",
    weight: 20,
    description: "只使用服务器提供的安全 view、retrieval summary、evidenceRef 或玩家可见事实。"
  },
  {
    id: "historical_tone",
    weight: 20,
    description: "叙事、草稿和建议应保留古代制度、物质条件、官署案牍与人物处境锚点。"
  },
  {
    id: "authority_boundary",
    weight: 20,
    description: "模型不得替服务器裁决任免、晋级、定罪、赏罚、外交、战和、资源与持久化。"
  },
  {
    id: "player_actionability",
    weight: 20,
    description: "给玩家清楚的下一步、阻力、风险或可编辑文本，不把 pending/rejected 写成已发生。"
  }
]);

function cloneRubric(rubric) {
  return {
    id: rubric.id,
    weight: rubric.weight,
    description: rubric.description
  };
}

function buildCoreQualityRubrics(overrides = {}) {
  const overrideById = new Map(Object.entries(overrides));
  return CORE_QUALITY_RUBRICS.map((rubric) => ({
    ...cloneRubric(rubric),
    ...(overrideById.get(rubric.id) || {})
  }));
}

module.exports = {
  CORE_QUALITY_RUBRICS,
  buildCoreQualityRubrics
};
