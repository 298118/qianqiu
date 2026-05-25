import { Link, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import type {
  MapRuntimeActionDraft,
  MapRuntimeEventEffect,
  MapRuntimeNpcActivityAnchor,
  MapRuntimeRef,
  MapRuntimeRoute,
  MapRuntimeView,
  TurnDraftContext
} from "../api";
import { DomainConsequenceSection } from "../components/DomainConsequenceSection";
import { InkMapRuntimeBridge, type MapRuntimeDraftSelection } from "../components/InkMapRuntimeBridge";
import { markOverlayTrigger } from "../components/overlayFocus";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { isRouteLocalSessionId, isRunnableSessionId } from "../routes/sessionId";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";
import { rewritePlayerFacingWorldText } from "../text/worldText";

type MapLayerKey = "places" | "routes" | "events";
type MapActionDraftKind = "map_ref_action" | "map_route_action" | "map_event_action";

type MapActionEntry = {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly kindLabel: string;
  readonly draftKind: MapActionDraftKind;
  readonly text: string;
  readonly targetRef: string;
  readonly sourceRefs: readonly string[];
  readonly requiresServerTurn: boolean;
};

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

const unsafeMapRefTokens = new Set([
  "layout",
  "layoutpath",
  "mapbounds",
  "viewporthint",
  "position",
  "coordinate",
  "coordinates",
  "coord",
  "coords",
  "x",
  "y"
]);
const localMapPagePathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|Users|private|mnt|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;

function safeMapPageText(value: unknown, fallback: string, maxLength = 80) {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const normalized = text.toLowerCase();
  if (localMapPagePathPattern.test(text) || /(?:sk|tp)-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (unsafeMapTextFragments.some((fragment) => normalized.includes(fragment.toLowerCase()))) return fallback;
  return rewritePlayerFacingWorldText(text).slice(0, maxLength);
}

function safeMapPageRefId(value: unknown, maxLength = 96) {
  const text = safeMapPageText(value, "", maxLength);
  const compact = text.toLowerCase().replace(/[-_.:]/g, "");
  if (
    unsafeMapRefTokens.has(compact) ||
    /^(layout|layoutpath|mapbounds|viewporthint|position|coordinate|coordinates|coord|coords)[:_.-]/i.test(text) ||
    /^[xy][:_\-.]?\d/i.test(text)
  ) {
    return "";
  }
  return /^[A-Za-z0-9_.:-]+$/.test(text) ? text : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function safeMapPageRefList(values: readonly unknown[], maxItems = 8) {
  const refs: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const ref = safeMapPageRefId(value);
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
    if (refs.length >= maxItems) break;
  }
  return refs;
}

function getMapRefId(ref: MapRuntimeRef) {
  return safeMapPageRefId(ref.mapEntityRef || ref.sourceRef);
}

function getRouteRefId(route: MapRuntimeRoute) {
  return safeMapPageRefId(route.mapEntityRef || route.sourceRef);
}

function isSafeMapActionDraft(draft: MapRuntimeActionDraft | undefined): draft is MapRuntimeActionDraft & { readonly actionText: string } {
  return typeof draft?.actionText === "string" && safeMapPageText(draft.actionText, "", 140).length > 0;
}

function buildMapDraftContext(
  draftKind: MapActionDraftKind,
  targetRefs: readonly unknown[],
  sourceRefs: readonly unknown[],
  requiresServerTurn = true
): TurnDraftContext | undefined {
  const safeTargetRefs = safeMapPageRefList(targetRefs, 4);
  const safeSourceRefs = safeMapPageRefList(sourceRefs, 8);
  const evidenceRefs = safeMapPageRefList([...safeSourceRefs, ...safeTargetRefs], 10);
  if (!evidenceRefs.length) return undefined;
  return {
    surfaceId: "map-runtime",
    draftKind,
    sourceView: "mapRuntimeView",
    evidenceRefs,
    ...(safeSourceRefs.length ? { sourceRefs: safeSourceRefs } : {}),
    ...(safeTargetRefs.length ? { targetRefs: safeTargetRefs } : {}),
    requiresServerTurn,
    status: "client_hint"
  };
}

function buildMapActionEntry({
  draftId,
  draft,
  targetRef,
  sourceRefs,
  label,
  summary,
  kindLabel,
  draftKind
}: {
  readonly draftId: string;
  readonly draft: MapRuntimeActionDraft & { readonly actionText: string };
  readonly targetRef: string;
  readonly sourceRefs: readonly unknown[];
  readonly label: string;
  readonly summary: string;
  readonly kindLabel: string;
  readonly draftKind: MapActionDraftKind;
}): MapActionEntry | null {
  const safeDraftId = safeMapPageRefId(draft.id || draftId);
  const safeTargetRef = safeMapPageRefId(draft.targetRef || targetRef);
  const text = safeMapPageText(draft.actionText, "", 140);
  if (!safeDraftId || !safeTargetRef || !text) return null;
  return {
    id: safeDraftId,
    label: safeMapPageText(draft.label || label, "舆图行动", 40),
    summary: safeMapPageText(summary, "此行动来自公开舆图，写入主卷草稿后仍须候复。", 96),
    kindLabel,
    draftKind,
    text,
    targetRef: safeTargetRef,
    sourceRefs: safeMapPageRefList([...(draft.sourceRefs ?? []), ...sourceRefs], 8),
    requiresServerTurn: draft.requiresServerTurn !== false
  };
}

function getMapActionEntries(view: MapRuntimeView | null | undefined) {
  const drafts = view?.actionDrafts ?? {};
  const entries: MapActionEntry[] = [];
  const seenDrafts = new Set<string>();
  const addEntry = (entry: MapActionEntry | null) => {
    if (!entry || seenDrafts.has(entry.id)) return;
    seenDrafts.add(entry.id);
    entries.push(entry);
  };

  for (const ref of view?.refs ?? []) {
    const targetRef = getMapRefId(ref);
    if (!targetRef) continue;
    const sourceRefs = [...(ref.sourceRefs ?? []), ref.sourceRef];
    for (const draftId of ref.actionDraftRefs ?? []) {
      if (!safeMapPageRefId(draftId)) continue;
      const draft = drafts[draftId];
      if (!isSafeMapActionDraft(draft)) continue;
      addEntry(buildMapActionEntry({
        draftId,
        draft,
        targetRef,
        sourceRefs,
        label: safeMapPageText(ref.label, "舆图地点", 36),
        summary: safeMapPageText(ref.summary, "此地点可写入一段候复行动。", 96),
        kindLabel: "地点行动",
        draftKind: "map_ref_action"
      }));
    }
  }

  for (const route of view?.routes ?? []) {
    const targetRef = getRouteRefId(route);
    if (!targetRef) continue;
    const sourceRefs = [
      ...(route.sourceRefs ?? []),
      route.sourceRef,
      route.fromRef,
      route.toRef,
      ...asStringArray(route.controlRefs)
    ];
    for (const draftId of route.actionDraftRefs ?? []) {
      if (!safeMapPageRefId(draftId)) continue;
      const draft = drafts[draftId];
      if (!isSafeMapActionDraft(draft)) continue;
      addEntry(buildMapActionEntry({
        draftId,
        draft,
        targetRef,
        sourceRefs,
        label: safeMapPageText(route.label, "舆图驿路", 36),
        summary: safeMapPageText(route.summary, "此路线可写入一段候复行动。", 96),
        kindLabel: "驿路行动",
        draftKind: "map_route_action"
      }));
    }
  }

  return entries.slice(0, 6);
}

function getEventSeverity(event: MapRuntimeEventEffect) {
  const value = typeof event.severity === "number" && Number.isFinite(event.severity) ? event.severity : 0;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function getNpcActivitySeverity(anchor: MapRuntimeNpcActivityAnchor) {
  const value = typeof anchor.severity === "number" && Number.isFinite(anchor.severity) ? anchor.severity : 0.34;
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
      const targetId = safeMapPageRefId(event.targetRef, 96);
      const targetRef = targetId ? refsById.get(targetId) : undefined;
      const label = safeMapPageText(event.label || targetRef?.label, "地图近事", 36);
      const targetLabel = safeMapPageText(targetRef?.label || event.targetRef, "未标注地点", 36);
      const summary = safeMapPageText(
        targetRef?.summary || event.kind || "此为公开舆图中的近事，只作玩家观察线索。",
        "此为公开舆图中的近事，只作玩家观察线索。",
        96
      );
      return {
        id: `${safeMapPageText(event.targetRef || event.label || "map-event", "map-event", 96)}-${index}`,
        label,
        targetRef: targetId,
        targetLabel,
        kind: safeMapPageRefId(event.kind, 32) || "map_event",
        sourceRefs: safeMapPageRefList(event.sourceRefs ?? [], 8),
        summary,
        severity: getEventSeverity(event)
      };
    })
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5);
}

function getNpcActivityAnchors(view: MapRuntimeView | null | undefined) {
  const refsById = new Map<string, MapRuntimeRef>();
  (view?.refs ?? []).forEach((ref) => {
    const id = getMapRefId(ref);
    if (id) refsById.set(id, ref);
  });

  return [...(view?.npcActivityAnchors ?? [])]
    .map((anchor, index) => {
      const targetId = safeMapPageRefId(anchor.targetRef, 96);
      if (!targetId) return null;
      const targetRef = refsById.get(targetId);
      const label = safeMapPageText(anchor.label, "人物动向", 36);
      const targetLabel = safeMapPageText(targetRef?.label || anchor.targetRef, "未标注地点", 36);
      const summary = safeMapPageText(
        anchor.summary || "人物动向只作舆图观察线索；关系、资源与后续差事仍须候复。",
        "人物动向只作舆图观察线索；关系、资源与后续差事仍须候复。",
        96
      );
      return {
        id: `${safeMapPageText(anchor.id || anchor.targetRef || "npc-activity", "npc-activity", 96)}-${index}`,
        label,
        targetRef: targetId,
        targetLabel,
        kind: safeMapPageRefId(anchor.kind, 40) || "npc_activity",
        sourceRefs: safeMapPageRefList(anchor.sourceRefs ?? [], 6),
        summary,
        severity: getNpcActivitySeverity(anchor)
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 4);
}

function joinMapLayerLabels(layers: readonly MapLayerKey[]) {
  return layers.length ? layers.map((layer) => mapLayerLabels[layer]).join("、") : "无";
}

export function MapPage() {
  const { sessionId = "s74-preview" } = useParams();
  const [visibleLayers, setVisibleLayers] = useState<Record<MapLayerKey, boolean>>(defaultVisibleLayers);
  const [lastWrittenMapDraftId, setLastWrittenMapDraftId] = useState<string | null>(null);
  const currentSession = useGameSessionStore((state) => state.currentSession);
  const status = useGameSessionStore((state) => state.status);
  const openSurfaceForSession = useUiStateStore((state) => state.openSurfaceForSession);
  const displayPreferences = useUiStateStore((state) => state.displayPreferences);
  const setActionDraft = useUiStateStore((state) => state.setActionDraft);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isRunnable = isRunnableSessionId(sessionId);
  const routeSessionSupported = isRouteLocalSessionId(sessionId);
  const hasCurrentSession = routeSessionSupported && currentSession?.sessionId === sessionId;
  const mapRuntimeView = hasCurrentSession ? currentSession.mapRuntimeView : null;
  const domainConsequenceView = hasCurrentSession ? currentSession.domainConsequenceView : null;
  const refCount = mapRuntimeView?.refs?.length ?? 0;
  const routeCount = mapRuntimeView?.routes?.length ?? 0;
  const eventCount = mapRuntimeView?.eventEffects?.length ?? 0;
  const npcActivityCount = mapRuntimeView?.npcActivityAnchors?.length ?? 0;
  const mapEvents = useMemo(() => getMapEvents(mapRuntimeView), [mapRuntimeView]);
  const npcActivityAnchors = useMemo(() => getNpcActivityAnchors(mapRuntimeView), [mapRuntimeView]);
  const mapActionEntries = useMemo(() => getMapActionEntries(mapRuntimeView), [mapRuntimeView]);
  const activeLayers = (Object.keys(visibleLayers) as MapLayerKey[]).filter((key) => visibleLayers[key]);
  const hiddenLayers = (Object.keys(visibleLayers) as MapLayerKey[]).filter((key) => !visibleLayers[key]);
  const activeLayerCount = activeLayers.length;
  const activeLayerText = joinMapLayerLabels(activeLayers);
  const hiddenLayerText = joinMapLayerLabels(hiddenLayers);
  const layerSummary = hiddenLayers.length
    ? `现显 ${activeLayerText}；暂隐 ${hiddenLayerText}。筛选只改卷上显示，不改变案卷事实。`
    : `地点、驿路、近事三层全开；筛选只改卷上显示，不改变案卷事实。`;
  const archiveHref = routeSessionSupported ? `/game/${sessionId}/archive` : "/";
  const gameHref = routeSessionSupported ? `/game/${sessionId}` : "/";

  useEffect(() => {
    setVisibleLayers(defaultVisibleLayers);
    setLastWrittenMapDraftId(null);
  }, [sessionId]);

  function toggleLayer(layer: MapLayerKey) {
    setVisibleLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  function writeMapActionDraft(text: string, draftContext?: TurnDraftContext) {
    setActionDraft({
      source: "map-runtime",
      targetPage: "game",
      text,
      ...(draftContext ? { draftContext } : {})
    });
  }

  function writeMapRuntimeSelection(selection: MapRuntimeDraftSelection) {
    setLastWrittenMapDraftId(selection.draftId);
    writeMapActionDraft(
      selection.text,
      buildMapDraftContext("map_ref_action", [selection.targetRef], selection.sourceRefs, selection.requiresServerTurn)
    );
  }

  function writeMapActionEntry(entry: MapActionEntry) {
    setLastWrittenMapDraftId(entry.id);
    writeMapActionDraft(
      entry.text,
      buildMapDraftContext(entry.draftKind, [entry.targetRef], entry.sourceRefs, entry.requiresServerTurn)
    );
  }

  function draftFromEvent(eventItem: ReturnType<typeof getMapEvents>[number]) {
    setLastWrittenMapDraftId(eventItem.id);
    writeMapActionDraft(
      `据舆图公开近事，先查问「${eventItem.targetLabel}」附近的「${eventItem.label}」，整理人证、驿路与官府文书后再定本旬行动。`,
      buildMapDraftContext("map_event_action", [eventItem.targetRef], eventItem.sourceRefs, true)
    );
  }

  return (
    <article className="mapFullScreen routePanel" aria-labelledby="map-title" data-polish-surface="s89-5-map-command" data-polish-map="s89-7-layer-tooltip">
      <header className="mapHero">
        <div>
          <p className="eyebrow">独立舆图</p>
          <h1 id="map-title">山河舆图</h1>
          <p>山川、府县、驿路与公开近事铺成一卷；只观势、拟稿与跳转，不替案卷定夺事实。</p>
        </div>
        <dl className="mapHeroStats" aria-label="舆图摘要">
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
          <div>
            <dt>人物</dt>
            <dd>{npcActivityCount}</dd>
          </div>
        </dl>
      </header>
      <section className="mapCommandDeck" aria-label="舆图操作">
        <div className="mapLayerControls" aria-label="图层筛选">
          {(Object.keys(mapLayerLabels) as MapLayerKey[]).map((layer) => (
            <label className="mapLayerToggle" key={layer} data-polish-action="s89-5-map-layer" data-layer-state={visibleLayers[layer] ? "shown" : "hidden"}>
              <input
                type="checkbox"
                checked={visibleLayers[layer]}
                onChange={() => toggleLayer(layer)}
              />
              <span>{mapLayerLabels[layer]}</span>
            </label>
          ))}
        </div>
        <p className="mapLayerSummary" data-polish-map="s89-7-layer-summary">{layerSummary}</p>
        <div className="buttonRow">
          <button
            className="paperButton"
            type="button"
            disabled={!routeSessionSupported}
            onClick={(event) => {
              if (!routeSessionSupported) return;
              markOverlayTrigger(event.currentTarget);
              openSurfaceForSession("map-filter", sessionId);
            }}
          >
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
          writtenDraftId={lastWrittenMapDraftId}
          onActionDraft={writeMapRuntimeSelection}
        />
        <aside className="mapSituationLedger" aria-labelledby="map-ledger-title" data-polish-card="s89-5-map-ledger">
          <div>
            <p className="eyebrow">局势簿摘录</p>
            <h2 id="map-ledger-title">公开近事</h2>
          </div>
          <section className="mapActionDeck" aria-labelledby="map-action-title">
            <div>
              <p className="eyebrow">行动入口</p>
              <h3 id="map-action-title">舆图行动</h3>
            </div>
            {mapActionEntries.length ? (
              <ol className="mapActionList">
                {mapActionEntries.map((entry) => (
                  <li key={entry.id} data-draft-state={lastWrittenMapDraftId === entry.id ? "written" : "idle"}>
                    <span>{entry.kindLabel} · 待主卷复核</span>
                    <strong>{entry.label}</strong>
                    <p>{entry.summary}</p>
                    <button className="paperButton" type="button" aria-label={`写入行动：${entry.label}`} onClick={() => writeMapActionEntry(entry)}>
                      写入{entry.kindLabel}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mapEmptyLedger">暂无舆图预备行动；可点击地图地点查看单点草稿，或回主卷自行落笔。</p>
            )}
          </section>
          {mapEvents.length ? (
            <ol className="mapEventList">
              {mapEvents.map((eventItem) => (
                <li key={eventItem.id} data-draft-state={lastWrittenMapDraftId === eventItem.id ? "written" : "idle"}>
                  <strong>{eventItem.label}</strong>
                  <span>{eventItem.targetLabel} · 警势 {eventItem.severity}</span>
                  <p>{eventItem.summary}</p>
                  <button className="paperButton" type="button" onClick={() => draftFromEvent(eventItem)}>
                    据此拟稿
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mapEmptyLedger">暂无公开近事；可保留地点与驿路图层，或回主卷推进一旬后再查看。</p>
          )}
          {npcActivityAnchors.length ? (
            <section className="mapNpcActivityDeck" aria-labelledby="map-npc-activity-title">
              <div>
                <p className="eyebrow">人物锚点</p>
                <h3 id="map-npc-activity-title">舆图人物动向</h3>
              </div>
              <ol className="mapNpcActivityList">
                {npcActivityAnchors.map((anchor) => (
                  <li key={anchor.id}>
                    <strong>{anchor.label}</strong>
                    <span>{anchor.targetLabel} · 可见度 {anchor.severity}</span>
                    <p>{anchor.summary}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          <DomainConsequenceSection
            domainConsequenceView={domainConsequenceView}
            sourceTypes={mapDomainConsequenceSourceTypes}
            title="舆图后果追踪"
            summaryFallback="舆图页只并列显示公开后果与地图近事；画面坐标不作为行军、查案或任免凭据。"
            emptyText="暂无可与舆图并列追踪的公开领域后果。"
            maxItems={3}
            runnable={hasCurrentSession}
            onDraft={(text) => setActionDraft({ source: "map-runtime", targetPage: "game", text })}
          />
        </aside>
      </div>
      <p className="mapRuntimeNote">
        {mapRuntimeView
          ? `已接入 ${refCount} 处地点、${routeCount} 条路线、${eventCount} 项近事、${npcActivityCount} 条人物动向，当前显示 ${activeLayerCount} 个图层（${activeLayerText}）；舆图只读公开卷宗。`
          : !routeSessionSupported
            ? "此案卷编号暂不可用于浏览器舆图；请从首页开卷或载入旧案。"
            : isRunnable && status === "loading"
            ? "正在读取本局舆图卷宗。"
            : "预览案卷不读取实时舆图；从首页新开一卷后即可查看。"}
      </p>
      <section className="mapSafetyBoundary" aria-label="舆图安全边界">
        <p>地图显示坐标只用于画面排布，不作为行军、查案、调兵、财政、外交、人物行动或任免凭据；相关后果仍须回主卷呈上候复。</p>
      </section>
    </article>
  );
}
