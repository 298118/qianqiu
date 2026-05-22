import { Link, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import type { MapRuntimeEventEffect, MapRuntimeRef, MapRuntimeView } from "../api";
import { DomainConsequenceSection } from "../components/DomainConsequenceSection";
import { InkMapRuntimeBridge } from "../components/InkMapRuntimeBridge";
import { markOverlayTrigger } from "../components/overlayFocus";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";

type MapLayerKey = "places" | "routes" | "events";

const mapLayerLabels: Record<MapLayerKey, string> = {
  places: "地点",
  routes: "驿路",
  events: "近事"
};

const defaultVisibleLayers: Record<MapLayerKey, boolean> = {
  places: true,
  routes: true,
  events: true
};

const mapDomainConsequenceSourceTypes = ["city_policy", "military_diplomacy", "judicial_case"] as const;

const unsafeMapTextFragments = [
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
  "hidden" + "Notes",
  "OPENAI" + "_API" + "_KEY",
  "DEEPSEEK" + "_API" + "_KEY",
  "MIMO" + "_API" + "_KEY",
  "ANTHROPIC" + "_API" + "_KEY",
  "完整" + "提示词",
  "提示" + "词",
  "本地" + "路径",
  "密" + "钥",
  "隐" + "藏",
  "私" + "档",
  "模型" + "原始"
] as const;

function safeMapPageText(value: unknown, fallback: string, maxLength = 80) {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const normalized = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /sk-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (unsafeMapTextFragments.some((fragment) => normalized.includes(fragment.toLowerCase()))) return fallback;
  return text.slice(0, maxLength);
}

function getMapRefId(ref: MapRuntimeRef) {
  return safeMapPageText(ref.mapEntityRef || ref.sourceRef, "", 96);
}

function getEventSeverity(event: MapRuntimeEventEffect) {
  const value = typeof event.severity === "number" && Number.isFinite(event.severity) ? event.severity : 0;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function getMapEvents(view: MapRuntimeView | null | undefined) {
  const refsById = new Map<string, MapRuntimeRef>();
  (view?.refs ?? []).forEach((ref) => {
    const id = getMapRefId(ref);
    if (id) refsById.set(id, ref);
  });

  return [...(view?.eventEffects ?? [])]
    .map((event, index) => {
      const targetId = safeMapPageText(event.targetRef, "", 96);
      const targetRef = targetId ? refsById.get(targetId) : undefined;
      const label = safeMapPageText(event.label || targetRef?.label, "地图近事", 36);
      const targetLabel = safeMapPageText(targetRef?.label || event.targetRef, "未标注地点", 36);
      const summary = safeMapPageText(
        targetRef?.summary || event.kind || "此为服务器公开舆图投影中的近事，只作玩家观察线索。",
        "此为服务器公开舆图投影中的近事，只作玩家观察线索。",
        96
      );
      return {
        id: `${safeMapPageText(event.targetRef || event.label || "map-event", "map-event", 96)}-${index}`,
        label,
        targetLabel,
        summary,
        severity: getEventSeverity(event)
      };
    })
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5);
}

export function MapPage() {
  const { sessionId = "s74-preview" } = useParams();
  const [visibleLayers, setVisibleLayers] = useState<Record<MapLayerKey, boolean>>(defaultVisibleLayers);
  const currentSession = useGameSessionStore((state) => state.currentSession);
  const status = useGameSessionStore((state) => state.status);
  const openSurfaceForSession = useUiStateStore((state) => state.openSurfaceForSession);
  const displayPreferences = useUiStateStore((state) => state.displayPreferences);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const prefersReducedMotion = usePrefersReducedMotion();
  const mapRuntimeView = currentSession?.sessionId === sessionId ? currentSession.mapRuntimeView : null;
  const domainConsequenceView = currentSession?.sessionId === sessionId ? currentSession.domainConsequenceView : null;
  const hasCurrentSession = currentSession?.sessionId === sessionId;
  const isRunnable = isRunnableSessionId(sessionId);
  const refCount = mapRuntimeView?.refs?.length ?? 0;
  const routeCount = mapRuntimeView?.routes?.length ?? 0;
  const eventCount = mapRuntimeView?.eventEffects?.length ?? 0;
  const mapEvents = useMemo(() => getMapEvents(mapRuntimeView), [mapRuntimeView]);
  const activeLayerCount = (Object.keys(visibleLayers) as MapLayerKey[]).filter((key) => visibleLayers[key]).length;
  const archiveHref = `/game/${sessionId}/archive`;
  const gameHref = `/game/${sessionId}`;

  useEffect(() => {
    setVisibleLayers(defaultVisibleLayers);
  }, [sessionId]);

  function toggleLayer(layer: MapLayerKey) {
    setVisibleLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  function draftFromEvent(label: string, targetLabel: string) {
    setActionDraft({
      source: "map-runtime",
      targetPage: "game",
      text: `据舆图公开近事，先查问「${targetLabel}」附近的「${label}」，整理人证、驿路与官府文书后再定本旬行动。`
    });
  }

  return (
    <article className="mapFullScreen routePanel" aria-labelledby="map-title">
      <header className="mapHero">
        <div>
          <p className="eyebrow">独立舆图</p>
          <h1 id="map-title">山河舆图</h1>
          <p>山川、府县、驿路与公开近事铺成一卷；只观势、拟稿与跳转，不替服务器裁决事实。</p>
        </div>
        <dl className="mapHeroStats" aria-label="舆图投影摘要">
          <div>
            <dt>地点</dt>
            <dd>{refCount}</dd>
          </div>
          <div>
            <dt>驿路</dt>
            <dd>{routeCount}</dd>
          </div>
          <div>
            <dt>近事</dt>
            <dd>{eventCount}</dd>
          </div>
        </dl>
      </header>
      <section className="mapCommandDeck" aria-label="舆图操作">
        <div className="mapLayerControls" aria-label="图层筛选">
          {(Object.keys(mapLayerLabels) as MapLayerKey[]).map((layer) => (
            <label className="mapLayerToggle" key={layer}>
              <input
                type="checkbox"
                checked={visibleLayers[layer]}
                onChange={() => toggleLayer(layer)}
              />
              <span>{mapLayerLabels[layer]}</span>
            </label>
          ))}
        </div>
        <div className="buttonRow">
          <button className="paperButton" type="button" onClick={(event) => { markOverlayTrigger(event.currentTarget); openSurfaceForSession("map-filter", sessionId); }}>
            筛舆图
          </button>
          <Link className="paperLink" to={archiveHref}>入局势簿</Link>
          <Link className="paperLink" to={gameHref}>回主卷</Link>
        </div>
      </section>
      <div className="mapImmersiveLayout">
        <InkMapRuntimeBridge
          mapRuntimeView={mapRuntimeView}
          mapMotionEnabled={displayPreferences.mapMotion && displayPreferences.motion === "full" && !prefersReducedMotion}
          visibleLayers={visibleLayers}
          onActionDraft={(text) => setActionDraft({ source: "map-runtime", targetPage: "game", text })}
        />
        <aside className="mapSituationLedger" aria-labelledby="map-ledger-title">
          <div>
            <p className="eyebrow">局势簿摘录</p>
            <h2 id="map-ledger-title">公开近事</h2>
          </div>
          {mapEvents.length ? (
            <ol className="mapEventList">
              {mapEvents.map((eventItem) => (
                <li key={eventItem.id}>
                  <strong>{eventItem.label}</strong>
                  <span>{eventItem.targetLabel} · 警势 {eventItem.severity}</span>
                  <p>{eventItem.summary}</p>
                  <button className="paperButton" type="button" onClick={() => draftFromEvent(eventItem.label, eventItem.targetLabel)}>
                    据此拟稿
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mapEmptyLedger">暂无公开近事；可保留地点与驿路图层，或回主卷推进一旬后再查看。</p>
          )}
          <DomainConsequenceSection
            domainConsequenceView={domainConsequenceView}
            sourceTypes={mapDomainConsequenceSourceTypes}
            title="舆图后果追踪"
            summaryFallback="舆图页只并列显示公开领域后果与地图近事；坐标仍不进入 prompt、AI 工具或服务器裁决。"
            emptyText="暂无可与舆图并列追踪的公开领域后果。"
            maxItems={3}
            runnable={hasCurrentSession}
            onDraft={(text) => setActionDraft({ source: "map-runtime", targetPage: "game", text })}
          />
        </aside>
      </div>
      <p className="mapRuntimeNote">
        {mapRuntimeView
          ? `已接入 ${refCount} 处地点、${routeCount} 条路线、${eventCount} 项近事，当前显示 ${activeLayerCount} 个图层；舆图只读服务器安全投影。`
          : isRunnable && status === "loading"
            ? "正在读取 player-state 中的安全舆图投影。"
            : "预览案卷不请求后端舆图；从首页新开一卷后即可查看实时地图。"}
      </p>
      <section className="mapSafetyBoundary" aria-label="舆图安全边界">
        <p>地图显示坐标只用于浏览器布局，不进入 prompt、AI 工具或服务器 resolver；移动、查案、调兵、财政、外交、任免和持久化仍由主卷普通回合提交后服务器裁决。</p>
      </section>
    </article>
  );
}
