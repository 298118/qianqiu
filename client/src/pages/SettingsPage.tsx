import { AiSettingsPanel } from "../components/AiSettingsPanel";

export function SettingsPage() {
  return (
    <article className="surfacePanel routePanel settingsRoutePanel" aria-labelledby="settings-title">
      <div className="routePanelHeader">
        <p className="eyebrow">印匣</p>
        <h1 id="settings-title">AI 设置</h1>
        <p>这里保存服务端全局 AI 路由；保存后当前案卷和以后打开的案卷都会按同一套配置推演。</p>
      </div>
      <AiSettingsPanel />
    </article>
  );
}
