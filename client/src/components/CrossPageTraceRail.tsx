import { Link } from "react-router";

export type CrossPageTracePage = "court" | "people" | "archive";
export type CrossPageTraceState = "ready" | "empty" | "unsupported";
export type CrossPageTraceTarget = "people" | "court" | "archive" | "game";

export type CrossPageTraceItem = {
  readonly target: CrossPageTraceTarget;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly href: string;
  readonly actionLabel: string;
};

export function CrossPageTraceRail({
  page,
  state,
  items,
  summary
}: {
  readonly page: CrossPageTracePage;
  readonly state: CrossPageTraceState;
  readonly items: readonly CrossPageTraceItem[];
  readonly summary: string;
}) {
  return (
    <section
      className="crossPageTraceRail scholarPanelCard"
      aria-label="跨页追索笺"
      data-polish-cross-trace="s89-36-cross-page-trace"
      data-cross-trace-page={page}
      data-cross-trace-state={state}
    >
      <div className="sectionTitleRow">
        <div>
          <p className="eyebrow">跨页追索笺</p>
          <h2>朝议、人物与史册追踪</h2>
          <p>{summary}</p>
        </div>
        <span>{state === "ready" ? "可追索" : state === "empty" ? "待留痕" : "案卷未载"}</span>
      </div>
      <div className="crossPageTraceGrid" aria-label="跨页追索路径">
        {items.map((item) => (
          <article key={`${page}-${item.target}`} data-cross-trace-target={item.target}>
            <div className="peopleMeta">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
            <p>{item.detail}</p>
            <Link
              className="paperLink"
              to={state === "unsupported" ? "/" : item.href}
              aria-disabled={state === "unsupported" ? "true" : undefined}
            >
              {item.actionLabel}
            </Link>
          </article>
        ))}
      </div>
      <p className="statusLine">这里只指明读卷路径；草稿、后果、关系、任免和钱粮仍回主卷候复。</p>
    </section>
  );
}
