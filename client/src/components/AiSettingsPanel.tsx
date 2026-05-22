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
  mock: "Mock",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  mimo: "MiMo",
  "mimo-deepseek": "MiMo + DeepSeek",
  anthropic: "Anthropic"
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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
      id: stringValue(record.id),
      label: stringValue(record.label)
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
      provider: stringValue(record.provider),
      available: record.available !== false,
      requiresKey: Boolean(record.requiresKey)
    };
  }).filter((item) => item.provider);
  return parsed.length ? parsed : [{ provider: "mock", available: true, requiresKey: false }];
}

function readFormState(payload: AiSettingsResponse | null): AiSettingsFormState {
  const routes = Array.isArray(payload?.aiSettingsView.taskRoutes) ? payload.aiSettingsView.taskRoutes : [];
  return {
    preset: stringValue(payload?.aiSettingsView.preset, "balanced"),
    routes: routes.map((item) => {
      const record = asRecord(item);
      return {
        taskType: stringValue(record.taskType, "narrator"),
        label: stringValue(record.label, stringValue(record.taskType, "AI 任务")),
        purpose: stringValue(record.purpose, "按服务器任务契约调用。"),
        provider: stringValue(record.provider, "mock"),
        providerAvailable: record.providerAvailable !== false,
        requiresKey: Boolean(record.requiresKey),
        effectiveStatus: stringValue(record.effectiveStatus, "active"),
        model: stringValue(record.model, "mock"),
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
    preset: form.preset || "balanced",
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
  if (route.effectiveStatus === "missing_provider_key" || !route.providerAvailable) return "缺少 key";
  if (route.effectiveStatus === "review_only" || route.reviewerOnly) return "只复核";
  if (route.effectiveStatus === "no_tool" || !route.mayUseTools) return "无工具";
  return "生效";
}

function isSupersededRequestError(error: unknown) {
  return error instanceof Error && /旧请求/.test(error.message);
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
    ? "正在整理服务端 AI 任务矩阵。"
    : matrixState === "error"
      ? "AI 任务矩阵暂不可用；前端不会补造 provider、模型或工具权限。"
      : "暂无 AI 任务矩阵；前端不会补造 provider、模型或工具权限。";

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  function applyPayload(payload: AiSettingsResponse, source: "load" | "reload" | "save") {
    if (source !== "save" && dirtyRef.current && savedSnapshot) {
      setLocalNotice("服务器设置已刷新，当前未保存编辑已保留；保存后仍由服务器校验。");
      return false;
    }
    const nextForm = readFormState(payload);
    const nextProviderOptions = readProviderOptions(payload);
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
      setLocalError(error instanceof Error ? error.message : "AI 设置载入失败。");
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
      setLocalError(error instanceof Error ? error.message : "AI 设置重新载入失败。");
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
      setLocalError(error instanceof Error ? error.message : "AI 设置保存失败。");
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
    <form className={compact ? "aiSettingsPanel aiSettingsPanelCompact" : "aiSettingsPanel"} onSubmit={handleSave}>
      <div className="aiSettingsToolbar" aria-live="polite">
        <div>
          <p className="eyebrow">服务端全局</p>
          <h3>AI 设置</h3>
          <p>{!hasLoadedPayload && isSettingsRequestLoading ? "正在载入服务端设置" : statusLabel(saveState, dirty, aiSettings?.updatedAt)}</p>
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

      <section className="aiSettingsSummary" aria-label="AI 设置摘要">
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
          试连 Provider
          <select
            value={connectionProvider}
            disabled={!hasLoadedPayload && isSettingsRequestLoading}
            onChange={(event) => setConnectionProvider(event.target.value)}
          >
            {providerOptions.map((option) => (
              <option key={option.provider} value={option.provider} disabled={!option.available}>
                {providerLabels[option.provider] || option.provider}{option.available ? "" : "（缺 key）"}
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
          {unavailableRoutes.length} 类任务选择了缺少 key 的 provider，请改回 Mock 或先配置对应环境变量后再保存。
        </p>
      ) : null}
      {aiConnection ? <p className="statusLine">连接结果：{aiConnection.ok ? "可用" : "不可用"}（{String(aiConnection.provider || connectionProvider)}）</p> : null}
      {localNotice ? <p className="statusLine">{localNotice}</p> : null}
      {localError || storeError ? <p className="statusLine" role="alert">{localError || storeError}</p> : null}

      <section className="aiTaskMatrix" aria-label="AI 任务路由矩阵">
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
                Provider
                <select
                  value={route.provider}
                  onChange={(event) => updateRoute(route.taskType, { provider: event.target.value })}
                >
                  {providerOptions.map((option) => (
                    <option key={option.provider} value={option.provider} disabled={!option.available}>
                      {providerLabels[option.provider] || option.provider}{option.available ? "" : "（缺 key）"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Model
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
                工具
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={route.mayUseTools ? route.toolBudget : 0}
                  disabled={!route.mayUseTools}
                  aria-label={`${route.label}工具预算`}
                  onChange={(event) => updateRoute(route.taskType, { toolBudget: numberValue(event.target.value, route.toolBudget, 0, 20) })}
                />
              </label>
            </div>
            <p>
              {route.reviewerOnly ? "此任务只做复核，不会执行玩法方法。" : route.mayRequestAdjudication ? "可提交待服务器裁决的 proposal。" : "不直接裁决世界状态。"}
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
