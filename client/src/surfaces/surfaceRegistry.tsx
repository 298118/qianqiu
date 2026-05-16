import type { LocalSurface } from "../state/uiState";

export type SurfaceRegistryEntry = {
  readonly id: LocalSurface;
  readonly label: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly safetyNote: string;
  readonly draftText?: string;
};

export const surfaceRegistry: Record<LocalSurface, SurfaceRegistryEntry> = {
  "npc-profile": {
    id: "npc-profile",
    label: "人物档案",
    eyebrow: "人物",
    title: "人物档案",
    description: "此处预留师友、同年、官长与故人的公开谱牒，只展示服务器已经投影给玩家的摘要。",
    safetyNote: "未公开关系、隐藏动机、hidden 私档和内部审计原文不会进入人物专题层。"
  },
  "edict-draft": {
    id: "edict-draft",
    label: "拟圣旨",
    eyebrow: "朝议",
    title: "拟圣旨",
    description: "此处作为圣旨、札付和朝议草拟入口；真正生效仍需玩家在主卷递送行动，由服务器裁决。",
    safetyNote: "专题层只保存草稿文本，不直接写 canonical 状态、官职任免、世界事件或数据库行。",
    draftText: "草拟一道明发谕旨，请内阁议定赈济、军务与地方官责。"
  },
  "memorial-review": {
    id: "memorial-review",
    label: "阅奏折",
    eyebrow: "史册",
    title: "阅奏折",
    description: "此处预留奏折、案牍和朝报复核；没有安全 projection 的内容只显示占位，不伪造事实。",
    safetyNote: "专题层不读取模型原文、完整 prompt、本地路径、密钥或内部审计原文。",
    draftText: "检阅近旬奏折，择要询问吏治、粮价与科场风声。"
  },
  "map-filter": {
    id: "map-filter",
    label: "舆图筛选",
    eyebrow: "舆图",
    title: "舆图筛选",
    description: "此处预留地点、路线和事件图层筛选；当前只管理前端显示意图，不影响服务器裁决。",
    safetyNote: "舆图专题层只使用 mapRuntimeView 的安全显示投影，不把坐标当作 prompt 或 resolver 事实。",
    draftText: "沿舆图筛选出的驿路，查问近期案牍与民情。"
  }
};
