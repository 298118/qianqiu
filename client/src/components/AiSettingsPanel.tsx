import { RefreshCw, Save, Wifi } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AiSettingsResponse, JsonObject, JsonValue } from "../api";
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

const providerLabels: Record<string, string> = {
  mock: "本地样例",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  mimo: "MiMo",
  "mimo-deepseek": "MiMo + DeepSeek",
  anthropic: "Anthropic"
};

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
  const dirty = useMemo(() => Boolean(savedSnapshot) && snapshotKey(form) !== savedSnapshot, [form, savedSnapshot]);
  const dirtyRef = useRef(dirty);
  const panelRequestIdRef = useRef(0);
  const connectionRequestIdRef = useRef(0);
  const presets = useMemo(() => readPresetOptions(aiSettings), [aiSettings]);
  const providerOptions = useMemo(() => readProviderOptions(aiSettings), [aiSettings]);
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
      ? "推演分工暂不可用；本页不会自行补造叙事来源或复核权限。"
      : "暂无推演分工；本页不会自行补造叙事来源或复核权限。";
  const redactedError = safeAiSettingsLine(localError || storeError, "推演设置暂不可用；请稍后重试。");
  const hasSettingsError = Boolean(localError || storeError);
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

  return (
    <form className={compact ? "aiSettingsPanel aiSettingsPanelCompact" : "aiSettingsPanel"} data-polish-ai-settings="s89-19-ai-state-ledger" onSubmit={handleSave}>
      <div className="aiSettingsToolbar" aria-live="polite">
        <div>
          <p className="eyebrow">全局推演</p>
          <h3>推演设置</h3>
          <p>{!hasLoadedPayload && isSettingsRequestLoading ? "正在载入案头设置" : statusLabel(saveState, dirty, aiSettings?.updatedAt)}</p>
        </div>
        <div className="aiSettingsActions">
          <button className="paperButton" type="button" onClick={() => void handleReload()} disabled={isSaving || isSettingsLoading}>
            <RefreshCw size={16} aria-hidden="true" />
            <span>{!isSaving && isSettingsRequestLoading ? "载入中" : "重新载入"}</span>
          </button>
          <button className="paperButton" type="submit" disabled={!dirty || isSaving || isSettingsLoading || !form.routes.length}>
            <Save size={16} aria-hidden="true" />
            <span>{isSaving ? "保存中" : "保存全局设置"}</span>
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
        <button className="paperButton" type="button" onClick={() => void handleConnectionTest()} disabled={isConnectionLoading || !providerOptions.length}>
          <Wifi size={16} aria-hidden="true" />
          <span>{isConnectionLoading ? "试连中" : "试连"}</span>
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

      <dl className="surfaceSafetyList" aria-label="推演设置状态簿" data-polish-ai-settings-ledger="s89-19-ai-state-ledger">
        {stateLedgerRows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <section className="aiTaskMatrix" aria-label="推演分工">
        {form.routes.length ? form.routes.map((route) => (
          <article className="aiTaskRoute" key={route.taskType} data-effective-status={route.effectiveStatus}>
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
          <div className="aiSettingsMatrixStatus" data-state={matrixState} role={matrixState === "error" ? "alert" : "status"} aria-live="polite">
            <strong>{matrixState === "loading" ? "候矩阵" : matrixState === "error" ? "矩阵受阻" : "矩阵未载"}</strong>
            <span>{matrixStatusText}</span>
          </div>
        )}
      </section>
    </form>
  );
}
