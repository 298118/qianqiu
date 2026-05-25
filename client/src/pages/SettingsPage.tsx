import { Archive, BrainCircuit, Home, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Link, useParams } from "react-router";
import { markOverlayTrigger } from "../components/overlayFocus";
import { isRouteLocalSessionId } from "../routes/sessionId";
import type { InkboxTab } from "../state/uiState";
import { useUiStateStore } from "../state/uiState";

type SettingsCard = {
  readonly tab: InkboxTab;
  readonly title: string;
  readonly text: string;
  readonly badges: readonly string[];
  readonly icon: ReactNode;
  readonly actionLabel: string;
};

const settingsCards: readonly SettingsCard[] = [
  {
    tab: "ai-settings",
    title: "推演设置",
    text: "整理叙事、科举、政务、人物与复核等推演分工，保存后用于当前和以后打开的案卷。",
    badges: ["全局生效", "保存后复核"],
    icon: <BrainCircuit size={18} aria-hidden="true" />,
    actionLabel: "打开推演设置"
  },
  {
    tab: "display",
    title: "显示偏好",
    text: "调整动效、舆图动效、字号、对比度与正文字体；低动效会保留清晰状态。",
    badges: ["本地保存", "低动效可用"],
    icon: <SlidersHorizontal size={18} aria-hidden="true" />,
    actionLabel: "打开显示偏好"
  },
  {
    tab: "saves",
    title: "旧案卷",
    text: "检点本地可读旧卷并续入主卷；旧案只显示公开摘要和可读时间。",
    badges: ["本机旧卷", "公开摘要"],
    icon: <Save size={18} aria-hidden="true" />,
    actionLabel: "查看旧案"
  },
  {
    tab: "safe-summary",
    title: "案卷摘要",
    text: "核对当前案主、身份与已载卷宗，只看玩家已见的公开材料。",
    badges: ["只读摘要", "不载私记"],
    icon: <ShieldCheck size={18} aria-hidden="true" />,
    actionLabel: "查看案卷摘要"
  }
];

export function SettingsPage() {
  const { sessionId = "s74-preview" } = useParams();
  const openInkbox = useUiStateStore((state) => state.openInkbox);
  const routeSessionSupported = isRouteLocalSessionId(sessionId);
  const gameHref = routeSessionSupported ? `/game/${sessionId}` : "/";

  function openInkboxTab(tab: InkboxTab, event: MouseEvent<HTMLButtonElement>) {
    markOverlayTrigger(event.currentTarget);
    openInkbox(tab);
  }

  return (
    <article
      className="surfacePanel routePanel settingsRoutePanel settingsDirectoryRoute"
      aria-labelledby="settings-title"
      data-polish-surface="s89-5-settings-directory"
      data-polish-settings="s89-13-settings-directory"
    >
      <div className="routePanelHeader settingsDirectoryHeader">
        <div className="settingsDirectorySeal" aria-hidden="true">
          <Archive size={24} />
        </div>
        <div>
          <p className="eyebrow">印匣</p>
          <h1 id="settings-title">案头工具</h1>
          <p>设置仍收在右上角印匣中；此页只作案头整理，方便刷新或从旧路由回到同一套案头工具。</p>
        </div>
      </div>
      <div className="settingsDirectoryGrid" aria-label="印匣分栏入口">
        {settingsCards.map((card) => (
          <section className="settingsDirectoryCard" key={card.tab} data-polish-card="s89-5-settings-card">
            <span className="settingsDirectoryCardIcon" aria-hidden="true">{card.icon}</span>
            <div>
              <h2>{card.title}</h2>
              <p>{card.text}</p>
              <div className="settingsDirectoryBadges peopleMeta" aria-label={`${card.title}章法`}>
                {card.badges.map((badge) => <span key={badge}>{badge}</span>)}
              </div>
            </div>
            <button className="paperButton" type="button" onClick={(event) => openInkboxTab(card.tab, event)}>
              {card.actionLabel}
            </button>
          </section>
        ))}
      </div>
      <div className="settingsDirectoryFooter">
        <p>印匣只保存显示与推演偏好、旧案入口和公开摘要；行动、交易、任免、考试和舆图后果仍回主卷呈上候复。</p>
        <div className="buttonRow" aria-label="印匣页去处">
          <Link className="paperLink" to={gameHref}>
            回主卷
          </Link>
          <Link className="paperLink" to="/">
            <Home size={16} aria-hidden="true" />
            <span>归首页</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
