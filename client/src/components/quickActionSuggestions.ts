import type { GameRole, PlayerSummary, QuickActionSuggestionPayload } from "../api";
import type { SafePlayerPayload } from "../state/uiState";

export type QuickActionSource = "local-rule" | "mock-ai" | "provider-ai" | "map-runtime" | "surface";

export type QuickActionSuggestion = {
  readonly id: string;
  readonly source: QuickActionSource;
  readonly sourceLabel: string;
  readonly title: string;
  readonly label: string;
  readonly text: string;
  readonly roleTags: readonly string[];
  readonly toolIntent?: string;
  readonly evidenceRefs?: readonly string[];
  readonly status: "ready" | "loading" | "failed" | "stale" | "applied";
};

export type QuickActionSuggestionInput = {
  readonly role?: GameRole | string | null;
  readonly player?: PlayerSummary | null;
  readonly routeViews?: SafePlayerPayload["routeViews"] | null;
  readonly aiSuggestions?: readonly QuickActionSuggestionPayload[] | null;
  readonly quickActionStatus?: "idle" | "loading" | "ready" | "error";
  readonly page?: string;
  readonly runnable?: boolean;
  readonly limit?: number;
};

type QuickActionTemplate = Omit<QuickActionSuggestion, "source" | "sourceLabel" | "status"> & {
  readonly source?: QuickActionSource;
  readonly sourceLabel?: string;
};

const localRuleSource = {
  source: "local-rule" as const,
  sourceLabel: "local-rule"
};

const roleSuggestions: Record<GameRole, readonly Omit<QuickActionTemplate, "source" | "sourceLabel">[]> = {
  emperor: [
    { id: "emperor-edict", title: "宣旨", label: "宣旨", text: "宣旨整饬吏治，命中枢三日内具奏各省积弊。", roleTags: ["emperor", "edict"] },
    { id: "emperor-vermilion", title: "朱批", label: "朱批", text: "朱批近日奏折，询问钱粮、边防与民生三事。", roleTags: ["emperor", "memorial"] },
    { id: "emperor-court", title: "召见群臣", label: "召见群臣", text: "召见群臣廷议，听取各部对当前局势的陈奏。", roleTags: ["emperor", "court"] }
  ],
  scholar: [
    { id: "scholar-study", title: "研读", label: "研读", text: "闭门研读经义，整理近日所得，准备下一场考试。", roleTags: ["scholar", "study"] },
    { id: "scholar-essay", title: "作文", label: "作文", text: "拟作一篇策论，请师友指出破题与立意得失。", roleTags: ["scholar", "essay"] },
    { id: "scholar-exam", title: "赴考", label: "赴考", text: "打听考期与贡院规矩，整备行装准备赴考。", roleTags: ["scholar", "exam"] }
  ],
  general: [
    { id: "general-deploy", title: "遣将", label: "遣将", text: "遣将巡查前哨，回报粮道、军心与敌情虚实。", roleTags: ["general", "scout"] },
    { id: "general-camp", title: "巡营", label: "巡营", text: "亲自巡营，查点甲仗粮草，并安抚将士。", roleTags: ["general", "camp"] },
    { id: "general-report", title: "上战报", label: "上战报", text: "整理边情与军务得失，上战报请朝廷裁示。", roleTags: ["general", "report"] }
  ],
  magistrate: [
    { id: "magistrate-trial", title: "审案", label: "审案", text: "升堂审理积案，先核公开证词与案牍记录。", roleTags: ["magistrate", "case"] },
    { id: "magistrate-relief", title: "赈济", label: "赈济", text: "查问灾情与仓储，拟定赈济安民之策。", roleTags: ["magistrate", "relief"] },
    { id: "magistrate-dike", title: "修堤", label: "修堤", text: "召集里正与工匠，勘查河堤险段并筹措修缮。", roleTags: ["magistrate", "dike"] }
  ],
  minister: [
    { id: "minister-memorial", title: "上疏", label: "上疏", text: "上疏陈明时弊，提出可由朝廷裁量的三条办法。", roleTags: ["minister", "memorial"] },
    { id: "minister-council", title: "会商", label: "会商", text: "约同僚会商部务，分辨轻重缓急后再行具奏。", roleTags: ["minister", "council"] },
    { id: "minister-docket", title: "查阅案牍", label: "查阅案牍", text: "查阅近日案牍与公文，摘出关涉民生与官声的要点。", roleTags: ["minister", "docket"] }
  ],
  official: [
    { id: "official-memorial", title: "上疏", label: "上疏", text: "上疏陈明任内见闻，请求朝廷明示处置章程。", roleTags: ["official", "memorial"] },
    { id: "official-council", title: "会商", label: "会商", text: "拜会同僚会商公事，先求稳妥可行之策。", roleTags: ["official", "council"] },
    { id: "official-docket", title: "查阅案牍", label: "查阅案牍", text: "查阅案牍与考成记录，整理下一步施政重点。", roleTags: ["official", "docket"] }
  ]
};

const mapRuntimeSuggestion: QuickActionTemplate = {
  id: "route-map-scan",
  source: "map-runtime",
  sourceLabel: "map-runtime",
  title: "先看舆图",
  label: "先看舆图",
  text: "先查阅舆图与公开局势，再回到案前决定本旬行动。",
  roleTags: ["route", "map"]
};

const surfaceSuggestion: QuickActionTemplate = {
  id: "route-surface-draft",
  source: "surface",
  sourceLabel: "surface",
  title: "拟草稿",
  label: "拟草稿",
  text: "先按本页公开线索拟一段行动草稿，再回主卷呈上。",
  roleTags: ["route", "surface"]
};

const roleAliases: Record<string, GameRole> = {
  emperor: "emperor",
  皇帝: "emperor",
  scholar: "scholar",
  书生: "scholar",
  general: "general",
  将领: "general",
  magistrate: "magistrate",
  地方官: "magistrate",
  minister: "minister",
  大臣: "minister",
  official: "official",
  官员: "official",
  入仕官员: "official"
};

export function getRolePlaceholder(player?: PlayerSummary | null) {
  return getMemorialPlaceholder(player?.role);
}

export function getMemorialPlaceholder(role?: GameRole | string | null) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "emperor") return "宣旨、朱批、召见群臣...";
  if (normalizedRole === "scholar") return "研读、作文、拜师、赴考...";
  if (normalizedRole === "general") return "遣将、巡营、上战报...";
  if (normalizedRole === "magistrate") return "审案、赈济、修堤、安民...";
  return "上疏、会商、查阅案牍...";
}

export function buildQuickActionSuggestions(input: QuickActionSuggestionInput = {}): QuickActionSuggestion[] {
  if (input.runnable === false) return [];
  const role = normalizeRole(input.player?.role ?? input.role);
  const aiSuggestions = normalizeAiSuggestions(input.aiSuggestions, input.quickActionStatus);
  if (aiSuggestions.length) {
    return markSuggestionState(aiSuggestions.slice(0, Math.max(1, Math.min(input.limit ?? 3, 3))));
  }

  const base = [...roleSuggestions[role]];
  const withMap = input.routeViews?.hasMapRuntimeView ? [base[0], mapRuntimeSuggestion, ...base.slice(1)] : base;
  const suggestions = input.page && input.page !== "game" ? [surfaceSuggestion, ...withMap] : withMap;
  const limit = Math.max(1, Math.min(input.limit ?? 3, 3));

  const status = input.quickActionStatus === "error" ? "failed" : input.quickActionStatus === "loading" ? "stale" : "ready";
  return suggestions.slice(0, limit).map((suggestion) => ({
    ...localRuleSource,
    ...suggestion,
    status
  }));
}

function normalizeRole(role?: GameRole | string | null): GameRole {
  const normalized = roleAliases[String(role ?? "").trim()];
  return normalized ?? "official";
}

function normalizeAiSuggestions(
  suggestions?: readonly QuickActionSuggestionPayload[] | null,
  quickActionStatus: QuickActionSuggestionInput["quickActionStatus"] = "idle"
): QuickActionSuggestion[] {
  if (!suggestions?.length) return [];
  return suggestions
    .map((suggestion, index): QuickActionSuggestion | null => {
      const source = normalizeSource(suggestion.source);
      const title = cleanText(suggestion.title, 16);
      const label = cleanText(suggestion.label || suggestion.title, 16);
      const text = cleanText(suggestion.text, 120);
      if (!title || !label || !text) return null;
      return {
        id: cleanText(suggestion.id, 80) || `quick-${source}-${index + 1}`,
        source,
        sourceLabel: source,
        title,
        label,
        text,
        roleTags: Array.isArray(suggestion.roleTags) ? suggestion.roleTags.map((tag) => cleanText(String(tag), 32)).filter(Boolean).slice(0, 6) : [],
        toolIntent: cleanText(suggestion.toolIntent || "", 32) || undefined,
        evidenceRefs: Array.isArray(suggestion.evidenceRefs) ? suggestion.evidenceRefs.map((ref) => cleanText(String(ref), 120)).filter(Boolean).slice(0, 4) : [],
        status: quickActionStatus === "error" ? "failed" as const : quickActionStatus === "loading" ? "stale" as const : "ready" as const
      };
    })
    .filter((suggestion): suggestion is QuickActionSuggestion => suggestion !== null);
}

function markSuggestionState(suggestions: readonly QuickActionSuggestion[]): QuickActionSuggestion[] {
  return suggestions.map((suggestion) => ({ ...suggestion, status: suggestion.status || "ready" }));
}

function normalizeSource(source: unknown): QuickActionSource {
  return source === "mock-ai" || source === "provider-ai" || source === "map-runtime" || source === "surface"
    ? source
    : "local-rule";
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data\/sessions|raw|hidden|provider payload|prompt|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}/i.test(text)) {
    return "";
  }
  return text.slice(0, maxLength);
}
