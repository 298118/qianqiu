const playerFacingWorldTextReplacements: readonly [RegExp, string][] = [
  [/\bAI\b/g, "推演"],
  [/\bNPC\b/g, "人物"],
  [/\bwatchlist\b/gi, "留察名单"],
  [/服务器安全视图/g, "公开卷宗"],
  [/安全视图/g, "公开卷宗"],
  [/安全投影/g, "公开卷宗"],
  [/安全专题投影/g, "公开专题材料"],
  [/公开投影/g, "公开材料"],
  [/地图投影/g, "舆图材料"],
  [/舆图投影/g, "舆图材料"],
  [/朝局投影/g, "朝局材料"],
  [/奏折投影/g, "奏折材料"],
  [/后端裁决/g, "主卷定夺"],
  [/后端/g, "主卷"],
  [/服务器定榜/g, "金榜定档"],
  [/服务器裁决/g, "主卷定夺"],
  [/服务器结算/g, "案卷回批"],
  [/服务器校验/g, "案卷复核"],
  [/服务器/g, "主卷"],
  [/\bsafe view\b/gi, "公开卷宗"],
  [/\bserver\b/gi, "主卷"],
  [/\bresolver\b/gi, "主卷裁断"],
  [/前端草稿/g, "案头草稿"],
  [/只读视图/g, "只读公开卷"],
  [/Provider/g, "来源"],
  [/provider/g, "来源"],
  [/Model/g, "卷式"],
  [/model/g, "卷式"],
  [/人物 关系/g, "人物关系"],
  [/\bref\b/gi, "线索"]
];

export function rewritePlayerFacingWorldText(text: string) {
  return playerFacingWorldTextReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text
  );
}
