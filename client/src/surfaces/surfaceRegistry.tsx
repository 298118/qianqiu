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
    description: "预留奏折、案牍和朝报复核；有安全事件、官职月报或公开案牍投影时才摘录要点。",
    dataSource: "安全数据来源：eventArchiveView、playerMonthlyBriefingView、domainConsequenceView、localAffairsDocketView、officialPostingsView 等服务器公开投影。",
    emptyState: "若当前案卷没有这些投影，只显示本占位与草稿入口，不补造奏折条目、署名、罪名、银数或紧急军情。",
    safetyNote: "专题层只显示玩家已知材料和草稿结果，不展示内部推演细节、连接凭据或私密记录。",
    draftText: "检阅近旬奏折与朝报，只择服务器已公开的案牍、钱粮、军务与科场风声拟成奏稿。"
  },
  "npc-profile": {
    id: "npc-profile",
    label: "人物档案",
    eyebrow: "人物",
    title: "人物档案",
    description: "此处预留师友、同年、官长与故人的公开谱牒，只展示服务器已经投影给玩家的摘要。",
    dataSource: "安全数据来源：worldPeopleView、actorMemoryView、examNetwork 和当前案卷玩家可见关系摘要。",
    emptyState: "若没有公开人物 projection，只显示人物档案占位，不推断未公开关系、未公开任所或重要 NPC 真值。",
    safetyNote: "人物专题层只显示玩家已见的人物材料，不推断私下关系、动机或未公开任所。"
  },
  "edict-draft": {
    id: "edict-draft",
    label: "拟圣旨",
    eyebrow: "朝议",
    title: "拟圣旨",
    description: "此处作为圣旨、札付和朝议草拟入口；真正生效仍需玩家在主卷递送行动，由服务器裁决。",
    dataSource: "安全数据来源：officialPostingsView、eventArchiveView、domainConsequenceView、worldThreadView、mapRuntimeView 摘要和玩家公开身份。",
    emptyState: "若没有任免、战事、赈济或朝局投影，只显示圣旨草稿纸，不生成已生效诏令、官缺、赏罚或处分事实。",
    safetyNote: "专题层只保存草稿文本，不直接写 canonical 状态、官职任免、世界事件或数据库行。",
    draftText: "草拟一道明发谕旨，请内阁议定赈济、军务与地方官责。"
  },
  "court-debate": {
    id: "court-debate",
    label: "朝议",
    eyebrow: "廷议",
    title: "朝议",
    description: "预留百官议政、台阁票拟与御前问对；首轮只把议题整理成玩家可提交的行动草稿。",
    dataSource: "安全数据来源：officialPostingsView、actorMemoryView、aiControlAuditView、eventArchiveView、domainConsequenceView、worldThreadView 的公开摘要。",
    emptyState: "若没有安全朝局 projection，只显示议题占位，不伪造参议官、票拟结论、派系立场或廷争结果。",
    safetyNote: "朝议 surface 不能调用 resolver、推进时间、定夺任免、形成圣旨或把 AI proposal 伪装成既成事实。",
    draftText: "召集廷议，令诸臣只就已公开的边患、钱粮、案牍与任所缺口陈奏利害。"
  },
  trial: {
    id: "trial",
    label: "堂审",
    eyebrow: "刑名",
    title: "堂审",
    description: "预留县衙、公堂和刑名案件的问案界面；当前只整理公开案情与审问方向。",
    dataSource: "安全数据来源：localAffairsDocketView、domainConsequenceView、eventArchiveView、safeWorldSearchView 和玩家辖区公开摘要。",
    emptyState: "若没有安全案牍 projection，只显示公堂占位，不补造犯供、证词、判词、刑罚、钱粮数或案件真相。",
    safetyNote: "堂审 surface 不直接结案、定罪、用刑、缉捕、改写治安或写入事件档案；后果仍由普通回合服务器裁决。",
    draftText: "升堂复核公开案牍，先问原告、保甲与书吏，只据已明示证据拟定下一步审理。"
  },
  "war-council": {
    id: "war-council",
    label: "军议",
    eyebrow: "军务",
    title: "军议",
    description: "预留军帐会商、斥候回报和粮饷筹划；当前只形成军令草稿与风险提示。",
    dataSource: "安全数据来源：militaryDiplomacyView、domainConsequenceView、mapRuntimeView、eventArchiveView、officialPostingsView 和公开边患摘要。",
    emptyState: "若没有安全军务 projection，只显示军帐占位，不生成敌情真值、兵力实数、密探线索、战果或外交结论。",
    safetyNote: "军议 surface 不直接调兵、开战、议和、拨饷、任免将领或写入战争/外交结果；服务器继续拥有裁决权。",
    draftText: "召集军议，按公开舆图、粮饷、斥候与边患摘要，拟定谨慎进退和请示事项。"
  },
  "map-filter": {
    id: "map-filter",
    label: "舆图筛选",
    eyebrow: "舆图",
    title: "舆图筛选",
    description: "此处预留地点、路线和事件图层筛选；当前只管理前端显示意图，不影响服务器裁决。",
    dataSource: "安全数据来源：mapRuntimeView 的地点、路线、公开近事和前端显示图层状态。",
    emptyState: "若没有地图投影，只显示舆图筛选占位，不推断坐标、路线真值、隐藏敌情或未公开地点。",
    safetyNote: "舆图专题层只使用 mapRuntimeView 的安全显示投影，不把坐标当作 prompt 或 resolver 事实。",
    draftText: "沿舆图筛选出的驿路，查问近期案牍与民情。"
  }
};
