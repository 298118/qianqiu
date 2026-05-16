import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";

export function SettingsPage() {
  const { sessionId = "s74-preview" } = useParams();
  const [preset, setPreset] = useState("balanced");
  const [provider, setProvider] = useState("mock");
  const loadAiSettings = useGameSessionStore((state) => state.loadAiSettings);
  const updateAiPreset = useGameSessionStore((state) => state.updateAiPreset);
  const testAiConnection = useGameSessionStore((state) => state.testAiConnection);
  const aiSettings = useGameSessionStore((state) => state.aiSettings);
  const aiConnection = useGameSessionStore((state) => state.aiConnection);
  const settingsStatus = useGameSessionStore((state) => state.settingsStatus);
  const error = useGameSessionStore((state) => state.error);

  useEffect(() => {
    if (!isRunnableSessionId(sessionId)) return;
    void loadAiSettings(sessionId).then((payload) => {
      if (payload.aiSettingsView.preset) setPreset(String(payload.aiSettingsView.preset));
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

  return (
    <article className="surfacePanel routePanel" aria-labelledby="settings-title">
      <h2 id="settings-title">印匣</h2>
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
      {aiSettings?.aiSettingsView.preset ? <p>当前策略：{aiSettings.aiSettingsView.preset}</p> : null}
      {aiConnection ? <p>连接结果：{aiConnection.ok ? "可用" : "不可用"}</p> : null}
      {!isRunnableSessionId(sessionId) ? <p>预览案卷不保存设置；请先从首页新开一卷。</p> : null}
      {error ? <p className="statusLine" role="alert">{error}</p> : null}
    </article>
  );
}
