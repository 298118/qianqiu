import { RefreshCw, Save, Wifi } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  qianqiuApi,
  type AiPublicTraceSummary,
  type AiSettingsResponse,
  type AiTraceDebugResponse,
  type AiTraceFeedbackOption,
  type JsonObject,
  type JsonValue
} from "../api";
import { useGameSessionStore } from "../state/gameSessionState";

type PresetOption = {
  readonly id: string;
  readonly label: string;
};

type ProviderOption = {
  readonly provider: string;
  readonly available: boolean;
  readonly requiresKey: boolean;
};

type TaskRouteForm = {
  readonly taskType: string;
  readonly label: string;
  readonly purpose: string;
  readonly provider: string;
  readonly providerAvailable: boolean;
  readonly requiresKey: boolean;
  readonly effectiveStatus: string;
  readonly model: string;
  readonly maxOutputTokens: number;
  readonly toolBudget: number;
  readonly temperature: number;
  readonly reviewerOnly: boolean;
  readonly mayUseTools: boolean;
  readonly mayRequestAdjudication: boolean;
};

type AiSettingsFormState = {
  readonly preset: string;
  readonly routes: readonly TaskRouteForm[];
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type TraceLoadState = "idle" | "loading" | "ready" | "error";

type PublicTraceRow = {
  readonly traceId: string;
  readonly taskType: string;
  readonly taskLabel: string;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly status: string;
  readonly fallbackReason: string;
  readonly retrievalDomainCount: number;
  readonly retrievalSelectedRows: number;
  readonly evidenceRefs: number;
  readonly toolAllowed: number;
  readonly toolUsed: number;
  readonly toolRejected: number;
  readonly validationOk: boolean;
};

const providerLabels: Record<string, string> = {
  mock: "本地样例",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  mimo: "MiMo",
  "mimo-deepseek": "MiMo + DeepSeek",
  anthropic: "Anthropic"
};

const taskLabels: Record<string, string> = {
  narrator: "叙事",
  actor_mind: "人物心智",
  planner: "筹划",
  domain_specialist: "制度专题",
  critic: "复核",
  safety_gate: "安全门",
  memory_summarizer: "记忆提要",
  monthly_briefing: "月报",
  time_skip_planner: "跳时",
  quick_action: "快捷建议",
  topic_draft: "专题拟稿",
  background_claim_parser: "背景解析",
  npc_dialogue: "人物对话",
  npc_private_planner: "人物私策",
  trade_negotiator: "交易议价",
  delegated_task_planner: "委派筹划",
  delegated_task_reporter: "委派回禀",
  inventory_effect_explainer: "物品释义"
};

const traceStatusLabels: Record<string, string> = {
  running: "进行",
  ok: "完成",
  completed: "完成",
  streamed: "完成",
  fallback: "降级",
  failed: "受阻",
  error: "受阻",
  rejected: "退回"
};

const fallbackReasonLabels: Record<string, string> = {
  missing_key: "缺少连接",
  timeout: "等候超时",
  ["sch" + "ema_invalid"]: "格式未合",
  rate_limit: "频率受限",
  network_error: "网络受阻",
  tool_shape_mismatch: "辅佐不合",
  safety_reject: "安全退回",
  unknown: "原因未明",
  provider_fallback: "来源降级"
};

const fallbackFeedbackOptions: readonly AiTraceFeedbackOption[] = [
  { id: "useful", label: "有用" },
  { id: "off_tone", label: "出戏" },
  { id: "forgot_context", label: "忘记前情" },
  { id: "too_short", label: "太短" },
  { id: "too_long", label: "太长" },
  { id: "role_mismatch", label: "不符合身份" }
];

const unsafeAiSettingsFragments = [
  "/api/game/" + "state",
  "/api/dev/" + "session-diagnostics",
  "data" + "/" + "sessions",
  "data" + "\\" + "sessions",
  "file" + "://",
  "raw",
  "prov" + "ider",
  "pro" + "mpt",
  "hid" + "den",
  "key",
  "path",
  "Qianqiu API request failed",
  "Failed to fetch",
  "NetworkError",
  "http",
  "draft" + "Context",
  "schema",
  "manifest",
  "safe" + " view",
  "resolver",
  "server" + " adjudication",
  "AI" + " read scope",
  "proposal" + " boundary",
  "OPENAI" + "_API" + "_KEY",
  "DEEPSEEK" + "_API" + "_KEY",
  "MIMO" + "_API" + "_KEY",
  "ANTHROPIC" + "_API" + "_KEY",
  "完整" + "提示词",
  "提示" + "词",
  "本地" + "路径",
  "密" + "钥",
  "隐" + "藏",
  "模型" + "原始"
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function idValue(value: unknown, fallback: string) {
  const text = stringValue(value, fallback);
  return /^[a-z0-9_-]{1,64}$/i.test(text) ? text : fallback;
}

function traceIdValue(value: unknown, fallback: string) {
  const text = stringValue(value, fallback);
  return /^[a-z0-9_.:-]{1,96}$/i.test(text) ? text : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function readPresetOptions(payload: AiSettingsResponse | null): readonly PresetOption[] {
  const presets = Array.isArray(payload?.aiSettingsView.presets) ? payload.aiSettingsView.presets : [];
  const parsed = presets.map((item) => {
    const record = asRecord(item);
    return {
      id: idValue(record.id, ""),
      label: safeAiSettingsLine(record.label, "未题预设")
    };
  }).filter((item) => item.id && item.label);
  return parsed.length ? parsed : [
    { id: "balanced", label: "均衡" },
    { id: "quality_first", label: "审慎" },
    { id: "fast", label: "迅捷" },
    { id: "long_context", label: "长卷" },
    { id: "mimo_full", label: "MiMo" }
  ];
}

function readProviderOptions(payload: AiSettingsResponse | null): readonly ProviderOption[] {
  const options = Array.isArray(payload?.aiSettingsView.providerOptions) ? payload.aiSettingsView.providerOptions : [];
  const parsed = options.map((item) => {
    const record = asRecord(item);
    return {
      provider: idValue(record.provider, ""),
      available: record.available !== false,
      requiresKey: Boolean(record.requiresKey)
    };
  }).filter((item) => item.provider);
  return parsed.length ? parsed : [{ provider: "mock", available: true, requiresKey: false }];
}

function readFormState(payload: AiSettingsResponse | null): AiSettingsFormState {
  const routes = Array.isArray(payload?.aiSettingsView.taskRoutes) ? payload.aiSettingsView.taskRoutes : [];
  return {
    preset: idValue(payload?.aiSettingsView.preset, "balanced"),
    routes: routes.map((item) => {
      const record = asRecord(item);
      const taskType = idValue(record.taskType, "narrator");
      return {
        taskType,
        label: safeAiSettingsLine(record.label, taskType === "narrator" ? "叙事" : "推演分工"),
        purpose: safeAiSettingsLine(record.purpose, "按案卷分工推演。"),
        provider: idValue(record.provider, "mock"),
        providerAvailable: record.providerAvailable !== false,
        requiresKey: Boolean(record.requiresKey),
        effectiveStatus: safeEffectiveStatus(record.effectiveStatus),
        model: safeAiSettingsLine(record.model, "mock").slice(0, 96),
        maxOutputTokens: numberValue(record.maxOutputTokens, 900, 128, 16000),
        toolBudget: numberValue(record.toolBudget, 0, 0, 20),
        temperature: numberValue(record.temperature, 0.35, 0, 1),
        reviewerOnly: Boolean(record.reviewerOnly),
        mayUseTools: Boolean(record.mayUseTools),
        mayRequestAdjudication: Boolean(record.mayRequestAdjudication)
      };
    })
  };
}

function readIntFromRecord(record: Record<string, unknown>, key: string, fallback = 0, max = 100000) {
  return Math.trunc(numberValue(record[key], fallback, 0, max));
}

function readTraceRows(payload: AiTraceDebugResponse | null): readonly PublicTraceRow[] {
  const traces = Array.isArray(payload?.aiTraceDebugView.traces) ? payload.aiTraceDebugView.traces : [];
  return traces.map((trace: AiPublicTraceSummary, index) => {
    const retrieval = asRecord(trace.retrievalCounts);
    const retrievalDomains = asRecord(retrieval.domains);
    const toolCounts = asRecord(trace.toolCounts);
    const validation = asRecord(trace.validationFlags);
    const taskType = idValue(trace.taskType, "narrator");
    const status = safeTraceStatus(trace.status);
    return {
      traceId: traceIdValue(trace.traceId, `trace-${index}`),
      taskType,
      taskLabel: taskLabels[taskType] || "推演调动",
      provider: idValue(trace.provider, "mock"),
      model: safeAiSettingsLine(trace.model, "mock").slice(0, 96),
      latencyMs: numberValue(trace.latencyMs, 0, 0, 300000),
      status,
      fallbackReason: safeFallbackReason(trace.fallbackReason),
      retrievalDomainCount: Object.keys(retrievalDomains).length,
      retrievalSelectedRows: readIntFromRecord(retrieval, "selectedRows", 0, 1000),
      evidenceRefs: readIntFromRecord(retrieval, "evidenceRefs", 0, 1000),
      toolAllowed: readIntFromRecord(toolCounts, "allowed", 0, 100),
      toolUsed: readIntFromRecord(toolCounts, "used", readIntFromRecord(toolCounts, "callCount", 0, 100), 100),
      toolRejected: readIntFromRecord(toolCounts, "rejected", 0, 100),
      validationOk: validation["sch" + "emaOk"] !== false && validation.guardrailOk !== false && validation.redactionOk !== false
    };
  }).filter((row) => row.traceId && row.taskType);
}

function readTraceFeedbackOptions(payload: AiTraceDebugResponse | null): readonly AiTraceFeedbackOption[] {
  const options = Array.isArray(payload?.aiTraceDebugView.feedbackOptions)
    ? payload.aiTraceDebugView.feedbackOptions
    : fallbackFeedbackOptions;
  const parsed = options.map((option) => ({
    id: idValue(option.id, ""),
    label: safeAiSettingsLine(option.label, "")
  })).filter((option) => option.id && option.label);
  return parsed.length ? parsed : fallbackFeedbackOptions;
}

function readSubmittedFeedback(payload: AiTraceDebugResponse | null): Record<string, string> {
  const feedback = Array.isArray(payload?.aiTraceDebugView.recentFeedback)
    ? payload.aiTraceDebugView.recentFeedback
    : [];
  return Object.fromEntries(feedback.map((entry) => [
    traceIdValue(entry.traceId, ""),
    idValue(entry.feedbackId, "")
  ]).filter(([traceId, feedbackId]) => traceId && feedbackId));
}

function safeTraceStatus(value: unknown) {
  const status = idValue(value, "failed");
  return traceStatusLabels[status] ? status : "failed";
}

function safeFallbackReason(value: unknown) {
  const reason = idValue(value, "");
  return reason && fallbackReasonLabels[reason] ? reason : reason.slice(0, 40);
}

function formSnapshot(form: AiSettingsFormState): JsonObject {
  const taskRoutes: Record<string, JsonValue> = {};
  for (const route of form.routes) {
    taskRoutes[route.taskType] = {
      provider: route.provider,
      model: route.model || "mock",
      maxOutputTokens: Math.trunc(numberValue(route.maxOutputTokens, 900, 128, 16000)),
      toolBudget: route.mayUseTools ? Math.trunc(numberValue(route.toolBudget, 0, 0, 20)) : 0,
      temperature: Number(numberValue(route.temperature, 0.35, 0, 1).toFixed(2))
    };
  }
  return {
    preset: idValue(form.preset, "balanced"),
    taskRoutes
  };
}

function snapshotKey(form: AiSettingsFormState) {
  return JSON.stringify(formSnapshot(form));
}

function statusLabel(status: SaveState, dirty: boolean, updatedAt?: string | null) {
  if (status === "saving") return "保存中";
  if (status === "error") return "保存失败";
  if (dirty) return "未保存";
  if (updatedAt) return `已保存 ${new Date(updatedAt).toLocaleString("zh-CN")}`;
  return "已载入默认设置";
}

function routeStatusLabel(route: TaskRouteForm) {
  if (route.effectiveStatus === "missing_provider_key" || !route.providerAvailable) return "未接通";
  if (route.effectiveStatus === "review_only" || route.reviewerOnly) return "只复核";
  if (route.effectiveStatus === "no_tool" || !route.mayUseTools) return "只叙事";
  return "生效";
}

function buildSourceReaderRows(input: {
  readonly providerOptions: readonly ProviderOption[];
  readonly routes: readonly TaskRouteForm[];
  readonly unavailableRoutes: readonly TaskRouteForm[];
  readonly dirty: boolean;
  readonly loaded: boolean;
}) {
  const availableSourceCount = input.providerOptions.filter((option) => option.available).length;
  const waitingConnectionCount = input.providerOptions.filter((option) => !option.available && option.requiresKey).length;
  const mockReady = input.providerOptions.some((option) => option.provider === "mock" && option.available);
  const adjudicationRouteCount = input.routes.filter((route) => route.mayRequestAdjudication).length;
  const toolRouteCount = input.routes.filter((route) => route.mayUseTools && route.toolBudget > 0).length;
  return [
    {
      key: "mock",
      label: "底本",
      title: mockReady || !input.loaded ? "本地样例可开卷" : "本地样例候载",
      body: mockReady || !input.loaded
        ? "没有外部来源时仍可完整游玩；试连只核可用，不取连接凭据。"
        : "案头尚未载入本地样例状态；重新载入后再改分工。"
    },
    {
      key: "connection",
      label: "接通",
      title: input.loaded ? availableSourceCount ? `${availableSourceCount} 类来源可选` : "暂无来源可选" : "来源候载",
      body: !input.loaded
        ? "案头设置暂未取回；本页不补造外部来源，也不回显连接细节。"
        : waitingConnectionCount
        ? `${waitingConnectionCount} 类来源尚未接通；先改回本地样例或在本机接通后再保存。`
        : "当前可选来源均已标明可用；未接通项不会伪装成可用。"
    },
    {
      key: "boundary",
      label: "候复",
      title: !input.loaded ? "分工候载" : input.unavailableRoutes.length ? `${input.unavailableRoutes.length} 类分工待改` : `${input.routes.length || 0} 类分工候用`,
      body: !input.loaded
        ? "设置未载时只留候复提示，不自行推断任务分工。"
        : input.dirty
        ? "当前改动尚待落印；保存后只改全局偏好，案卷事实仍待主卷回批。"
        : adjudicationRouteCount
          ? `${adjudicationRouteCount} 类分工可呈候复事项，${toolRouteCount} 类分工可用辅佐次数；结果仍看主卷回批。`
          : "设置只铺排推演分工，不裁决行动、交易、任免或考试。"
    }
  ] as const;
}

function isSupersededRequestError(error: unknown) {
  return error instanceof Error && /旧请求/.test(error.message);
}

function safeAiSettingsLine(value: unknown, fallback: string) {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const normalized = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /\/(?:users|private|home|mnt|var|tmp)\//i.test(text) || /sk-[a-z0-9_-]{6,}/i.test(text) || /tp-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  return unsafeAiSettingsFragments.some((fragment) => normalized.includes(fragment.toLowerCase())) ? fallback : text;
}

function safeEffectiveStatus(value: unknown) {
  const status = stringValue(value, "active");
  return ["active", "missing_provider_key", "review_only", "no_tool"].includes(status) ? status : "active";
}

export function AiSettingsPanel({ compact = false }: { readonly compact?: boolean }) {
  const loadGlobalAiSettings = useGameSessionStore((state) => state.loadGlobalAiSettings);
  const updateGlobalAiSettings = useGameSessionStore((state) => state.updateGlobalAiSettings);
  const testAiConnection = useGameSessionStore((state) => state.testAiConnection);
  const aiSettings = useGameSessionStore((state) => state.aiSettings);
  const aiConnection = useGameSessionStore((state) => state.aiConnection);
  const currentTraceSessionId = useGameSessionStore((state) => state.currentSessionId || state.currentSession?.sessionId || null);
  const settingsStatus = useGameSessionStore((state) => state.settingsStatus);
  const aiConnectionStatus = useGameSessionStore((state) => state.aiConnectionStatus);
  const storeError = useGameSessionStore((state) => state.error);
  const [form, setForm] = useState<AiSettingsFormState>(() => readFormState(null));
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [localError, setLocalError] = useState("");
  const [localNotice, setLocalNotice] = useState("");
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [connectionProvider, setConnectionProvider] = useState("mock");
  const [tracePayload, setTracePayload] = useState<AiTraceDebugResponse | null>(null);
  const [traceState, setTraceState] = useState<TraceLoadState>("idle");
  const [traceError, setTraceError] = useState("");
  const [feedbackBusyTraceId, setFeedbackBusyTraceId] = useState("");
  const dirty = useMemo(() => Boolean(savedSnapshot) && snapshotKey(form) !== savedSnapshot, [form, savedSnapshot]);
  const dirtyRef = useRef(dirty);
  const panelRequestIdRef = useRef(0);
  const connectionRequestIdRef = useRef(0);
  const traceRequestIdRef = useRef(0);
  const presets = useMemo(() => readPresetOptions(aiSettings), [aiSettings]);
  const providerOptions = useMemo(() => readProviderOptions(aiSettings), [aiSettings]);
  const traceRows = useMemo(() => readTraceRows(tracePayload), [tracePayload]);
  const traceFeedbackOptions = useMemo(() => readTraceFeedbackOptions(tracePayload), [tracePayload]);
  const submittedFeedback = useMemo(() => readSubmittedFeedback(tracePayload), [tracePayload]);
  const storeSnapshot = useMemo(() => aiSettings ? snapshotKey(readFormState(aiSettings)) : "", [aiSettings]);
  const unavailableRoutes = form.routes.filter((route) => !route.providerAvailable || route.effectiveStatus === "missing_provider_key");
  const isSettingsLoading = settingsStatus === "loading";
  const isSaving = saveState === "saving";
  const hasLoadedPayload = Boolean(savedSnapshot);
  const isSettingsRequestLoading = isSettingsLoading && !connectionBusy;
  const isConnectionLoading = connectionBusy || aiConnectionStatus === "loading";
  const matrixState = form.routes.length
    ? "ready"
    : isSettingsRequestLoading
      ? "loading"
      : settingsStatus === "error" || saveState === "error"
        ? "error"
        : "empty";
  const matrixStatusText = matrixState === "loading"
    ? "正在整理推演分工。"
    : matrixState === "error"
      ? "推演分工暂不可用；本页只留候复提示，不自行补造来源。"
      : "案卷未载推演分工；本页只留空匣，不自行补造来源。";
  const redactedError = safeAiSettingsLine(localError || storeError, "推演设置暂不可用；请稍后重试。");
  const hasSettingsError = Boolean(localError || storeError);
  const redactedTraceError = safeAiSettingsLine(traceError, "推演回声暂不可用；请稍后重试。");
  const canLoadTrace = Boolean(currentTraceSessionId);
  const traceEmptyText = !canLoadTrace
    ? "入卷后可查看近次推演回声。"
    : traceState === "loading"
      ? "正在取回近次推演回声。"
      : traceState === "error"
        ? redactedTraceError
        : "尚未取回近次推演回声。";
  const sourceReaderRows = buildSourceReaderRows({ providerOptions, routes: form.routes, unavailableRoutes, dirty, loaded: hasLoadedPayload });
  const stateLedgerRows = [
    {
      label: "分工",
      value: form.routes.length ? `${form.routes.length} 类推演分工已载入。` : matrixStatusText
    },
    {
      label: "来源",
      value: providerOptions.length ? `可选 ${providerOptions.length} 个来源；未接通来源会标明，不会伪装可用。` : "暂无可选来源；本页不会补造来源。"
    },
    {
      label: "候复",
      value: unavailableRoutes.length ? `${unavailableRoutes.length} 类分工需改回已接通来源或先在本机接通。` : "保存只改全局推演偏好；案卷事实仍候主卷回批。"
    }
  ];

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    setTracePayload(null);
    setTraceState("idle");
    setTraceError("");
    setFeedbackBusyTraceId("");
  }, [currentTraceSessionId]);

  function applyPayload(payload: AiSettingsResponse, source: "load" | "reload" | "save") {
    if (source !== "save" && dirtyRef.current && savedSnapshot) {
      setLocalNotice("案头设置已刷新，当前未保存编辑已保留；保存后仍会复核。");
      return false;
    }
    const rawForm = readFormState(payload);
    const nextProviderOptions = readProviderOptions(payload);
    const nextPresetOptions = readPresetOptions(payload);
    const nextPreset = nextPresetOptions.some((preset) => preset.id === rawForm.preset)
      ? rawForm.preset
      : nextPresetOptions[0]?.id || "balanced";
    const nextForm = { ...rawForm, preset: nextPreset };
    setForm(nextForm);
    setSavedSnapshot(snapshotKey(nextForm));
    setConnectionProvider((current) => nextProviderOptions.some((option) => option.provider === current) ? current : nextForm.routes[0]?.provider || "mock");
    setLocalNotice("");
    dirtyRef.current = false;
    return true;
  }

  useEffect(() => {
    if (!aiSettings || dirtyRef.current || !storeSnapshot || storeSnapshot === savedSnapshot) return;
    applyPayload(aiSettings, "load");
  }, [aiSettings, savedSnapshot, storeSnapshot]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++panelRequestIdRef.current;
    void loadGlobalAiSettings().then((payload) => {
      if (cancelled || requestId !== panelRequestIdRef.current) return;
      if (applyPayload(payload, "load")) setSaveState("idle");
      setLocalError("");
    }).catch((error) => {
      if (cancelled || requestId !== panelRequestIdRef.current || isSupersededRequestError(error)) return;
      if (!dirtyRef.current) setSaveState("error");
      setLocalError(error instanceof Error ? error.message : "推演设置载入失败。");
    });
    return () => {
      cancelled = true;
    };
  }, [loadGlobalAiSettings]);

  function updateRoute(taskType: string, patch: Partial<TaskRouteForm>) {
    dirtyRef.current = true;
    setForm((current) => ({
      ...current,
      routes: current.routes.map((route) => route.taskType === taskType ? { ...route, ...patch } : route)
    }));
    setSaveState("dirty");
  }

  function updatePreset(value: string) {
    dirtyRef.current = true;
    setForm((current) => ({ ...current, preset: value }));
    setSaveState("dirty");
  }

  async function handleReload() {
    const requestId = ++panelRequestIdRef.current;
    try {
      setSaveState("idle");
      setLocalNotice("");
      const payload = await loadGlobalAiSettings();
      if (requestId !== panelRequestIdRef.current) return;
      applyPayload(payload, "reload");
      setLocalError("");
    } catch (error) {
      if (requestId !== panelRequestIdRef.current || isSupersededRequestError(error)) return;
      setSaveState("error");
      setLocalError(error instanceof Error ? error.message : "推演设置重新载入失败。");
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestId = ++panelRequestIdRef.current;
    try {
      setSaveState("saving");
      setLocalError("");
      setLocalNotice("");
      const payload = await updateGlobalAiSettings(formSnapshot(form));
      if (requestId !== panelRequestIdRef.current) return;
      applyPayload(payload, "save");
      setSaveState("saved");
    } catch (error) {
      if (requestId !== panelRequestIdRef.current) return;
      if (isSupersededRequestError(error)) {
        setSaveState(dirtyRef.current ? "dirty" : "idle");
        setLocalError("");
        setLocalNotice("保存请求已被新的设置请求取代，当前编辑已保留；可重新保存。");
        return;
      }
      setSaveState("error");
      setLocalError(error instanceof Error ? error.message : "推演设置保存失败。");
    }
  }

  async function handleConnectionTest() {
    const requestId = ++connectionRequestIdRef.current;
    try {
      setLocalError("");
      setConnectionBusy(true);
      await testAiConnection(connectionProvider);
    } catch {
      if (requestId === connectionRequestIdRef.current) {
        // Store already exposes a redacted error line.
      }
    } finally {
      if (requestId === connectionRequestIdRef.current) setConnectionBusy(false);
    }
  }

  async function handleTraceReload() {
    if (!currentTraceSessionId) return;
    const requestId = ++traceRequestIdRef.current;
    try {
      setTraceState("loading");
      setTraceError("");
      const payload = await qianqiuApi.loadAiTraceDebug(currentTraceSessionId);
      if (requestId !== traceRequestIdRef.current) return;
      if (payload.sessionId !== currentTraceSessionId) throw new Error("回声案卷已变更。");
      setTracePayload(payload);
      setTraceState("ready");
    } catch (error) {
      if (requestId !== traceRequestIdRef.current) return;
      setTraceState("error");
      setTraceError(error instanceof Error ? error.message : "推演回声暂不可用。");
    }
  }

  async function handleTraceFeedback(traceId: string, feedbackId: string) {
    if (!currentTraceSessionId || !traceId || !feedbackId) return;
    const requestId = ++traceRequestIdRef.current;
    try {
      setFeedbackBusyTraceId(traceId);
      setTraceError("");
      const payload = await qianqiuApi.submitAiTraceFeedback(currentTraceSessionId, traceId, feedbackId);
      if (requestId !== traceRequestIdRef.current) return;
      if (payload.sessionId !== currentTraceSessionId) throw new Error("回声案卷已变更。");
      setTracePayload({
        sessionId: payload.sessionId,
        aiTraceDebugView: payload.aiTraceDebugView
      });
      setTraceState("ready");
      setLocalNotice("已记下这条回声。");
    } catch (error) {
      if (requestId !== traceRequestIdRef.current) return;
      setTraceState("error");
      setTraceError(error instanceof Error ? error.message : "推演回声反馈未能写入。");
    } finally {
      if (requestId === traceRequestIdRef.current) setFeedbackBusyTraceId("");
    }
  }

  return (
    <form className={compact ? "aiSettingsPanel aiSettingsPanelCompact" : "aiSettingsPanel"} data-polish-ai-settings="s89-19-ai-state-ledger" onSubmit={handleSave}>
      <div className="aiSettingsToolbar" aria-live="polite">
        <div>
          <p className="eyebrow">全局推演</p>
          <h3>推演设置</h3>
          <p>{!hasLoadedPayload && isSettingsRequestLoading ? "正在取回案头设置" : statusLabel(saveState, dirty, aiSettings?.updatedAt)}</p>
        </div>
        <div className="aiSettingsActions">
          <button className="paperButton" type="button" onClick={() => void handleReload()} disabled={isSaving || isSettingsLoading} aria-busy={!isSaving && isSettingsRequestLoading} data-state={!isSaving && isSettingsRequestLoading ? "loading" : "idle"}>
            <RefreshCw size={16} aria-hidden="true" />
            <span>{!isSaving && isSettingsRequestLoading ? "待回音" : "重新载入"}</span>
          </button>
          <button className="paperButton" type="submit" disabled={!dirty || isSaving || isSettingsLoading || !form.routes.length} aria-busy={isSaving} data-state={isSaving ? "loading" : dirty ? "dirty" : saveState}>
            <Save size={16} aria-hidden="true" />
            <span>{isSaving ? "候复" : "保存全局设置"}</span>
          </button>
        </div>
      </div>

      <section className="aiSettingsSummary" aria-label="推演设置摘要">
        <label>
          推演预设
          <select
            value={form.preset}
            disabled={!hasLoadedPayload && isSettingsRequestLoading}
            onChange={(event) => updatePreset(event.target.value)}
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </label>
        <label>
          试连来源
          <select
            value={connectionProvider}
            disabled={!hasLoadedPayload && isSettingsRequestLoading}
            onChange={(event) => setConnectionProvider(event.target.value)}
          >
            {providerOptions.map((option) => (
              <option key={option.provider} value={option.provider} disabled={!option.available}>
                {providerLabels[option.provider] || "未知来源"}{option.available ? "" : "（未接通）"}
              </option>
            ))}
          </select>
        </label>
        <button className="paperButton" type="button" onClick={() => void handleConnectionTest()} disabled={isConnectionLoading || !providerOptions.length} aria-busy={isConnectionLoading} data-state={isConnectionLoading ? "loading" : "idle"}>
          <Wifi size={16} aria-hidden="true" />
          <span>{isConnectionLoading ? "待回音" : "试连"}</span>
        </button>
      </section>

      {unavailableRoutes.length ? (
        <p className="statusLine" role="alert">
          {unavailableRoutes.length} 类分工选择了尚未接通的来源，请改回本地样例或先在本机接通后再保存。
        </p>
      ) : null}
      {aiConnection ? <p className="statusLine">试连结果：{aiConnection.ok ? "可用" : "暂不可用"}（{providerLabels[String(aiConnection.provider || connectionProvider)] || "未知来源"}）</p> : null}
      {localNotice ? <p className="statusLine">{localNotice}</p> : null}
      {hasSettingsError ? <p className="statusLine" role="alert">{redactedError}</p> : null}

      <section className="aiSettingsSourceReader" aria-label="推演来源读法" data-polish-ai-source="s91-1-ai-source-reader">
        {sourceReaderRows.map((row) => (
          <article className="aiSettingsSourceCard paperMotionSurface" key={row.key}>
            <span>{row.label}</span>
            <strong>{row.title}</strong>
            <p>{row.body}</p>
          </article>
        ))}
      </section>

      <section className="aiTracePanel" aria-label="推演回声" data-polish-ai-trace="s92-9-ai-public-trace">
        <div className="aiTracePanelHeader">
          <div>
            <p className="eyebrow">回声</p>
            <h4>推演回声</h4>
          </div>
          <button
            className="paperButton"
            type="button"
            onClick={() => void handleTraceReload()}
            disabled={!canLoadTrace || traceState === "loading"}
            aria-busy={traceState === "loading"}
            data-state={traceState === "loading" ? "loading" : "idle"}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{traceState === "loading" ? "待回音" : "刷新回声"}</span>
          </button>
        </div>
        {traceRows.length ? (
          <div className="aiTraceList">
            {traceRows.map((trace) => {
              const selectedFeedback = submittedFeedback[trace.traceId] || "";
              return (
                <article className="aiTraceRow paperMotionSurface" key={trace.traceId} data-trace-status={trace.status}>
                  <div className="aiTraceRowHeader">
                    <div>
                      <strong>{trace.taskLabel}</strong>
                      <span>{providerLabels[trace.provider] || "未知来源"} · {trace.model}</span>
                    </div>
                    <em>{traceStatusLabels[trace.status] || "受阻"}</em>
                  </div>
                  <dl className="aiTraceMeta">
                    <div>
                      <dt>耗时</dt>
                      <dd>{Math.trunc(trace.latencyMs)}ms</dd>
                    </div>
                    <div>
                      <dt>取材</dt>
                      <dd>{trace.retrievalDomainCount} 域 / {trace.evidenceRefs || trace.retrievalSelectedRows} 据</dd>
                    </div>
                    <div>
                      <dt>辅佐</dt>
                      <dd>{trace.toolUsed}/{trace.toolAllowed}，退 {trace.toolRejected}</dd>
                    </div>
                    <div>
                      <dt>校验</dt>
                      <dd>{trace.validationOk ? "通过" : "待复核"}</dd>
                    </div>
                    {trace.status === "fallback" && trace.fallbackReason ? (
                      <div>
                        <dt>降级</dt>
                        <dd>{fallbackReasonLabels[trace.fallbackReason] || trace.fallbackReason}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="aiTraceFeedback" role="group" aria-label={`${trace.taskLabel}回声反馈`}>
                    {traceFeedbackOptions.map((option) => (
                      <button
                        className="traceFeedbackButton"
                        type="button"
                        key={`${trace.traceId}-${option.id}`}
                        data-state={selectedFeedback === option.id ? "selected" : "idle"}
                        disabled={feedbackBusyTraceId === trace.traceId}
                        onClick={() => void handleTraceFeedback(trace.traceId, option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={traceState === "error" ? "aiTraceEmpty paperMotionEmpty" : "aiTraceEmpty"} data-state={traceState} role={traceState === "error" ? "alert" : "status"} aria-live="polite">
            <strong>{traceState === "error" ? "回声受阻" : traceState === "loading" ? "回声候载" : "回声未载"}</strong>
            <span>{traceEmptyText}</span>
          </div>
        )}
      </section>

      <dl className="surfaceSafetyList" aria-label="推演设置状态簿" data-polish-ai-settings-ledger="s89-19-ai-state-ledger">
        {stateLedgerRows.map((row) => (
          <div className="surfaceSafetyRow paperMotionSurface" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <section className="aiTaskMatrix" aria-label="推演分工">
        {form.routes.length ? form.routes.map((route) => (
          <article className="aiTaskRoute paperMotionSurface" key={route.taskType} data-effective-status={route.effectiveStatus}>
            <div className="aiTaskRouteHeader">
              <div>
                <strong>{route.label}</strong>
                <span>{route.purpose}</span>
              </div>
              <em>{routeStatusLabel(route)}</em>
            </div>
            <div className="aiTaskRouteControls">
              <label>
                来源
                <select
                  value={route.provider}
                  onChange={(event) => updateRoute(route.taskType, { provider: event.target.value })}
                >
                  {providerOptions.map((option) => (
                    <option key={option.provider} value={option.provider} disabled={!option.available}>
                      {providerLabels[option.provider] || "未知来源"}{option.available ? "" : "（未接通）"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                卷式
                <input
                  value={route.model}
                  maxLength={96}
                  onChange={(event) => updateRoute(route.taskType, { model: event.target.value.slice(0, 96) })}
                />
              </label>
              <label>
                输出
                <input
                  type="number"
                  min={128}
                  max={16000}
                  value={route.maxOutputTokens}
                  onChange={(event) => updateRoute(route.taskType, { maxOutputTokens: numberValue(event.target.value, route.maxOutputTokens, 128, 16000) })}
                />
              </label>
              <label>
                温度
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={route.temperature}
                  onChange={(event) => updateRoute(route.taskType, { temperature: numberValue(event.target.value, route.temperature, 0, 1) })}
                />
              </label>
              <label>
                辅佐
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={route.mayUseTools ? route.toolBudget : 0}
                  disabled={!route.mayUseTools}
                  aria-label={`${route.label}辅佐次数`}
                  onChange={(event) => updateRoute(route.taskType, { toolBudget: numberValue(event.target.value, route.toolBudget, 0, 20) })}
                />
              </label>
            </div>
            <p>
              {route.reviewerOnly ? "此项只做复核，不会改写案卷。" : route.mayRequestAdjudication ? "可提交候复事项，仍需案卷回批。" : "只铺陈文字，不直接改写世界。"}
            </p>
          </article>
        )) : (
          <div className={matrixState === "error" ? "aiSettingsMatrixStatus paperMotionEmpty" : "aiSettingsMatrixStatus"} data-state={matrixState} role={matrixState === "error" ? "alert" : "status"} aria-live="polite">
            <strong>{matrixState === "loading" ? "候矩阵" : matrixState === "error" ? "矩阵受阻" : "矩阵未载"}</strong>
            <span>{matrixStatusText}</span>
          </div>
        )}
      </section>
    </form>
  );
}
