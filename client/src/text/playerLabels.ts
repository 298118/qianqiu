const gameRoleLabels: Record<string, string> = {
  scholar: "书生",
  student: "读书人",
  official: "入仕官员",
  junior_official: "初入仕官员",
  local_official: "地方官",
  capital_official: "京官",
  female_official: "女官",
  emperor: "皇帝",
  emperor_regent: "皇帝/摄政",
  minister: "大臣",
  grand_minister: "大臣",
  general: "将领",
  magistrate: "县令"
};

const unsafeIdentityPattern = /\/api\/game\/state|\/api\/dev\/session-diagnostics|data[\\/]+sessions|[a-z]:[\\/]|file:\/{2}|raw\b|provider\b|prompt\b|hidden\b|key\b|path\b|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[a-z0-9_-]+|player-state|exam-submit|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|safe view|resolver|\/Users|\/private|tp-[a-z0-9_-]{6,}|\bTODO\b|\bFIXME\b|\bsmoke\b|\bartifacts?\b|\bS7[0-9](?:\.\d+)?\b|\bdebug\b|\bstub\b|\bplaceholder\b|fallback token|完整提示词|提示词|本地路径|密钥|隐藏|私档|模型原始|验收|测试截图|开发注释|实现说明/i;

type PlayerIdentityInput = {
  readonly officeTitle?: unknown;
  readonly palaceRank?: unknown;
  readonly examRank?: unknown;
  readonly roleLabel?: unknown;
  readonly role?: unknown;
} | null | undefined;

function cleanIdentityText(value: unknown, maxLength: number) {
  const text = typeof value === "string" && value.trim() ? value.trim() : "";
  if (!text || unsafeIdentityPattern.test(text)) return "";
  return text.slice(0, maxLength);
}

export function getGameRoleLabel(role: unknown) {
  const key = typeof role === "string" ? role.trim() : "";
  const normalized = key.replace(/-/g, "_");
  return key ? gameRoleLabels[key] || gameRoleLabels[normalized] || "" : "";
}

export function getPlayerIdentityLabel(player: PlayerIdentityInput, fallback = "身份未题", maxLength = 48) {
  if (!player) return fallback;
  for (const value of [player.officeTitle, player.palaceRank, player.examRank, player.roleLabel]) {
    if (typeof value !== "string" || !value.trim()) continue;
    const clean = cleanIdentityText(value, maxLength);
    const roleLabel = getGameRoleLabel(clean);
    if (roleLabel) return roleLabel;
    return clean || fallback;
  }
  return getGameRoleLabel(player.role) || fallback;
}
