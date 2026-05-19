import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";

export function SettingsPage() {
  const { sessionId = "s74-preview" } = useParams();
  const [preset, setPreset] = useState("balanced");
  const [provider, setProvider] = useState("mock");
  const [quickProvider, setQuickProvider] = useState("mock");
  const [quickModel, setQuickModel] = useState("mock");
  const [quickTokens, setQuickTokens] = useState(900);
  const [quickTemperature, setQuickTemperature] = useState(0.35);
  const loadAiSettings = useGameSessionStore((state) => state.loadAiSettings);
  const updateAiPreset = useGameSessionStore((state) => state.updateAiPreset);
  const updateAiTaskRoute = useGameSessionStore((state) => state.updateAiTaskRoute);
  const testAiConnection = useGameSessionStore((state) => state.testAiConnection);
  const aiSettings = useGameSessionStore((state) => state.aiSettings);
  const aiConnection = useGameSessionStore((state) => state.aiConnection);
  const settingsStatus = useGameSessionStore((state) => state.settingsStatus);
  const error = useGameSessionStore((state) => state.error);

  useEffect(() => {
    if (!isRunnableSessionId(sessionId)) return;
    void loadAiSettings(sessionId).then((payload) => {
      if (payload.aiSettingsView.preset) setPreset(String(payload.aiSettingsView.preset));
      const routes = Array.isArray(payload.aiSettingsView.taskRoutes) ? payload.aiSettingsView.taskRoutes : [];
      const quickRoute = routes.find((route) => (
        Boolean(route && typeof route === "object" && (route as Record<string, unknown>).taskType === "quick_action")
      )) as Record<string, unknown> | undefined;
      if (typeof quickRoute?.provider === "string") setQuickProvider(quickRoute.provider);
      if (typeof quickRoute?.model === "string") setQuickModel(quickRoute.model);
      if (typeof quickRoute?.maxOutputTokens === "number") setQuickTokens(quickRoute.maxOutputTokens);
      if (typeof quickRoute?.temperature === "number") setQuickTemperature(quickRoute.temperature);
    }).catch(() => undefined);
  }, [loadAiSettings, sessionId]);

  async function handlePreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await updateAiPreset(sessionId, preset);
    } catch {
    }
  }

  async function handleConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await testAiConnection(provider);
    } catch {
    }
  }

  async function handleQuickAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isRunnableSessionId(sessionId)) return;
    try {
      await updateAiTaskRoute(sessionId, "quick_action", {
        provider: quickProvider,
        model: quickModel || "mock",
        maxOutputTokens: quickTokens,
        toolBudget: 0,
        temperature: quickTemperature
      });
    } catch {
    }
  }

  return (
    <article className="surfacePanel routePanel" aria-labelledby="settings-title">
      <h1 id="settings-title">印匣</h1>
      <p>印泥、案卷、存档与偏好皆归此处，开合之间不扰正文。</p>
      <form className="inlineForm" onSubmit={handlePreset}>
        <label>
          AI 策略
          <select value={preset} onChange={(event) => setPreset(event.target.value)}>
            <option value="fast">从简</option>
            <option value="balanced">均衡</option>
            <option value="deep">深推演</option>
          </select>
        </label>
        <button className="paperButton" type="submit" disabled={settingsStatus === "loading" || !isRunnableSessionId(sessionId)}>
          保存
        </button>
      </form>
      <form className="inlineForm" onSubmit={handleConnection}>
        <label>
          Provider
          <select value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="mock">Mock</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="anthropic">Anthropic</option>
            <option value="mimo-deepseek">MiMo + DeepSeek</option>
          </select>
        </label>
        <button className="paperButton" type="submit" disabled={settingsStatus === "loading"}>
          试连
        </button>
      </form>
      <form className="inlineForm" onSubmit={handleQuickAction}>
        <label>
          快捷建议 Provider
          <select value={quickProvider} onChange={(event) => setQuickProvider(event.target.value)}>
            <option value="mock">Mock</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="mimo">MiMo</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <label>
          快捷建议模型
          <input value={quickModel} onChange={(event) => setQuickModel(event.target.value.slice(0, 96))} />
        </label>
        <label>
          输出长度
          <input type="number" min={128} max={16000} value={quickTokens} onChange={(event) => setQuickTokens(Number(event.target.value) || 900)} />
        </label>
        <label>
          温度
          <input type="number" min={0} max={1} step={0.05} value={quickTemperature} onChange={(event) => setQuickTemperature(Number(event.target.value) || 0)} />
        </label>
        <label>
          工具预算
          <input type="number" value={0} disabled aria-label="快捷建议工具预算固定为零" />
        </label>
        <button className="paperButton" type="submit" disabled={settingsStatus === "loading" || !isRunnableSessionId(sessionId)}>
          保存快捷建议
        </button>
      </form>
      {aiSettings?.aiSettingsView.preset ? <p>当前策略：{aiSettings.aiSettingsView.preset}</p> : null}
      {aiSettings?.aiSettingsView.taskRoutes ? <p>快捷建议：{quickProvider} / {quickModel || "mock"}</p> : null}
      {aiConnection ? <p>连接结果：{aiConnection.ok ? "可用" : "不可用"}</p> : null}
      {!isRunnableSessionId(sessionId) ? <p>预览案卷不保存设置；请先从首页新开一卷。</p> : null}
      {error ? <p className="statusLine" role="alert">{error}</p> : null}
    </article>
  );
}
