export const displayPreferenceStorageKey = "qianqiu.displayPreferences.v1";
export const displayPreferenceSchemaVersion = "display-preferences-v1";

export type DisplayPreferences = {
  readonly motion: "full" | "reduced";
  readonly textSize: "standard" | "large";
  readonly contrast: "standard" | "high";
  readonly bodyFont: "serif-classic" | "song-xiaowei" | "kai-longcang" | "brush-mashan";
  readonly autoScroll: boolean;
  readonly mapMotion: boolean;
};

type DisplayPreferenceKey = keyof DisplayPreferences;

export const defaultDisplayPreferences: DisplayPreferences = {
  motion: "full",
  textSize: "standard",
  contrast: "standard",
  bodyFont: "serif-classic",
  autoScroll: true,
  mapMotion: true
};

type StoredDisplayPreferences = {
  readonly schemaVersion?: unknown;
  readonly preferences?: unknown;
};

const unsafePreferenceTextPattern = /\/api\/game\/state|\/api\/dev\/session-diagnostics|data[\\/]+sessions|[a-z]:[\\/]|file:\/{2}|raw\b|provider\b|prompt\b|hidden\b|key\b|path\b|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[a-z0-9_-]+|完整提示词|提示词|本地路径|密钥|隐藏|私档|模型原始/i;
const displayPreferenceKeys: readonly DisplayPreferenceKey[] = ["motion", "textSize", "contrast", "bodyFont", "autoScroll", "mapMotion"];

function getBrowserLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUnsafePreferenceText(value: unknown) {
  return typeof value === "string" && unsafePreferenceTextPattern.test(value);
}

export function isDisplayPreferenceValue<K extends keyof DisplayPreferences>(key: K, value: unknown): value is DisplayPreferences[K] {
  if (hasUnsafePreferenceText(value)) return false;
  if (key === "motion") return value === "full" || value === "reduced";
  if (key === "textSize") return value === "standard" || value === "large";
  if (key === "contrast") return value === "standard" || value === "high";
  if (key === "bodyFont") return value === "serif-classic" || value === "song-xiaowei" || value === "kai-longcang" || value === "brush-mashan";
  if (key === "autoScroll" || key === "mapMotion") return typeof value === "boolean";
  return false;
}

export function sanitizeDisplayPreferences(value: unknown, defaults: DisplayPreferences = defaultDisplayPreferences): DisplayPreferences {
  if (!isRecord(value)) return defaults;

  const safePreferences = { ...defaults };
  for (const key of displayPreferenceKeys) {
    const nextValue = value[key];
    if (isDisplayPreferenceValue(key, nextValue)) {
      (safePreferences as Record<DisplayPreferenceKey, unknown>)[key] = nextValue;
    }
  }
  return safePreferences;
}

export function loadDisplayPreferences(defaults: DisplayPreferences = defaultDisplayPreferences): DisplayPreferences {
  const storage = getBrowserLocalStorage();
  if (!storage) return defaults;

  try {
    const stored = storage.getItem(displayPreferenceStorageKey);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored) as StoredDisplayPreferences;
    if (!isRecord(parsed) || parsed.schemaVersion !== displayPreferenceSchemaVersion) return defaults;
    return sanitizeDisplayPreferences(parsed.preferences, defaults);
  } catch {
    return defaults;
  }
}

export function saveDisplayPreferences(preferences: DisplayPreferences): DisplayPreferences {
  const storage = getBrowserLocalStorage();
  const safePreferences = sanitizeDisplayPreferences(preferences, defaultDisplayPreferences);
  if (!storage) return safePreferences;

  const payload = {
    schemaVersion: displayPreferenceSchemaVersion,
    preferences: safePreferences
  };

  try {
    storage.setItem(displayPreferenceStorageKey, JSON.stringify(payload));
  } catch {
  }
  return safePreferences;
}
