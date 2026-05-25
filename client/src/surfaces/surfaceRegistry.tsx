import type { LocalSurface } from "../state/uiState";

export type SurfaceRegistryEntry = {
  readonly id: LocalSurface;
  readonly label: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly dataSource: string;
  readonly emptyState: string;
  readonly safetyNote: string;
  readonly draftText?: string;
};

export const surfaceRegistry: Record<LocalSurface, SurfaceRegistryEntry> = {
  "memorial-review": {
    id: "memorial-review",
    label: "奏折队列",
    eyebrow: "奏折",
    title: "奏折队列",
    description: "预留奏折、案牍和朝报复核；有已公开近事、官职月报或案牍时才摘录要点。",
    dataSource: "取材：史册、月报、公开后果、来函、地方案牍与官职材料。",
    emptyState: "若当前案卷没有这些材料，只显示本占位与草稿入口，不补造奏折条目、署名、罪名、银数或紧急军情。",
    safetyNote: "专题层只显示玩家已知材料和草稿结果，不展示内廷私记、连接凭据或未公开记录。",
    draftText: "检阅近旬奏折与朝报，只择已公开的案牍、钱粮、军务与科场风声拟成奏稿。"
  },
  "npc-profile": {
    id: "npc-profile",
    label: "人物档案",
    eyebrow: "人物",
    title: "人物档案",
    description: "此处预留师友、同年、官长与故人的公开谱牒，只展示玩家已见的人物摘要。",
    dataSource: "取材：人物名册、可见记忆、科场网络、主动来函和当前案卷可见关系。",
    emptyState: "若没有公开人物材料，只显示人物档案占位，不推断未公开关系、未公开任所或要人真情。",
    safetyNote: "人物专题层只显示玩家已见的人物材料，不推断私下关系、动机或未公开任所。"
  },
  "edict-draft": {
    id: "edict-draft",
    label: "拟圣旨",
    eyebrow: "朝议",
    title: "拟圣旨",
    description: "此处作为圣旨、札付和朝议草拟入口；真正生效仍需玩家在主卷递送行动，候案卷回批。",
    dataSource: "取材：官职任所、史册、公开后果、朝局线索、舆图摘录和玩家公开身份。",
    emptyState: "若没有任免、战事、赈济或朝局材料，只显示圣旨草稿纸，不生成已生效诏令、官缺、赏罚或处分事实。",
    safetyNote: "专题层只保存草稿文本，不直接改写官职任免、天下大势或案卷底账。",
    draftText: "草拟一道明发谕旨，请内阁议定赈济、军务与地方官责。"
  },
  "court-debate": {
    id: "court-debate",
    label: "朝议",
    eyebrow: "廷议",
    title: "朝议",
    description: "预留百官议政、台阁票拟与御前问对；首轮只把议题整理成玩家可提交的行动草稿。",
    dataSource: "取材：官职任所、可见记忆、推演摘要、史册、公开后果、来函和朝局线索。",
    emptyState: "若没有朝局材料，只显示议题占位，不伪造参议官、票拟结论、派系立场或廷争结果。",
    safetyNote: "朝议专题不能推进时间、定夺任免、形成圣旨或把候复草稿当作既成事实。",
    draftText: "召集廷议，令诸臣只就已公开的边患、钱粮、案牍与任所缺口陈奏利害。"
  },
  trial: {
    id: "trial",
    label: "堂审",
    eyebrow: "刑名",
    title: "堂审",
    description: "预留县衙、公堂和刑名案件的问案界面；当前只整理公开案情与审问方向。",
    dataSource: "取材：地方案牍、公开后果、来函、史册检索和玩家辖区公开摘要。",
    emptyState: "若没有案牍材料，只显示公堂占位，不补造犯供、证词、判词、刑罚、钱粮数或案件真相。",
    safetyNote: "堂审专题不直接结案、定罪、用刑、缉捕或改写治安；后果仍候主卷回批。",
    draftText: "升堂复核公开案牍，先问原告、保甲与书吏，只据已明示证据拟定下一步审理。"
  },
  "war-council": {
    id: "war-council",
    label: "军议",
    eyebrow: "军务",
    title: "军议",
    description: "预留军帐会商、斥候回报和粮饷筹划；当前只形成军令草稿与风险提示。",
    dataSource: "取材：军务外交、公开后果、舆图、史册、官职任所和公开边患摘要。",
    emptyState: "若没有军务材料，只显示军帐占位，不生成敌情真值、兵力实数、密探线索、战果或外交结论。",
    safetyNote: "军议专题不直接调兵、开战、议和、拨饷、任免将领或写入战和结果；仍候案卷回批。",
    draftText: "召集军议，按公开舆图、粮饷、斥候与边患摘要，拟定谨慎进退和请示事项。"
  },
  "map-filter": {
    id: "map-filter",
    label: "舆图筛选",
    eyebrow: "舆图",
    title: "舆图筛选",
    description: "整理地点、驿路、近事、人物动向和后果追踪的卷面筛法；只改舆图显示，不影响案卷事实。",
    dataSource: "取材：舆图地点、驿路、公开近事、人物动向和后果追踪。",
    emptyState: "若没有舆图材料，只显示舆图筛选说明，不推断路线真值、案卷未载敌情或未公开地点。",
    safetyNote: "舆图专题层只使用公开显示材料，不把画面坐标当作行军、查案或任免凭据。"
  }
};
