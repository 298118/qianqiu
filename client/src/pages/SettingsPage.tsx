import { AiSettingsPanel } from "../components/AiSettingsPanel";

export function SettingsPage() {
  return (
    <article className="surfacePanel routePanel settingsRoutePanel" aria-labelledby="settings-title">
      <div className="routePanelHeader">
        <p className="eyebrow">印匣</p>
        <h1 id="settings-title">推演设置</h1>
        <p>这里保存全局推演偏好；保存后当前案卷和以后打开的案卷都会按同一套口径铺陈叙事与复核。</p>
      </div>
      <AiSettingsPanel />
    </article>
  );
}
