import { Link, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import type {
  DomainConsequenceView,
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

type MapSituationEntry = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

type MapCompassFocus = "events" | "people" | "consequence" | "drafts";

type MapCompassEntry = {
  readonly id: MapCompassFocus;
  readonly label: string;
  readonly title: string;
  readonly meta: string;
  readonly detail: string;
  readonly tone: "event" | "people" | "consequence" | "drafts";
  readonly draftKind?: MapActionDraftKind;
  readonly draftText?: string;
  readonly targetRefs: readonly string[];
  readonly sourceRefs: readonly string[];
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

const fallbackMapCompassEntry: MapCompassEntry = {
  id: "events",
  label: "近事",
  title: "暂无警势",
  meta: "舆图眼下平静",
  detail: "罗盘只整理公开线索，案卷未载者不补造。",
  tone: "event",
  targetRefs: [],
  sourceRefs: []
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
  "draft" + "Context",
  "schema",
  "manifest",
  "server" + " adjudication",
  "AI" + " read scope",
  "proposal" + " boundary",
  "safe" + " view",
  "resolver",
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
  "y",
  "draftcontext",
  "schema",
  "manifest",
  "serveradjudication",
  "aireadscope",
  "proposalboundary",
  "safeview",
  "resolver"
]);
const unsafeMapRefPrefixPattern = /^(?:layout|layoutpath|mapbounds|viewporthint|position|coordinate|coordinates|coord|coords|draft[-_.:]?context|schema|manifest|server[-_.:]?adjudication|ai[-_.:]?read[-_.:]?scope|proposal[-_.:]?boundary|safe[-_.:]?view|resolver)[:_.-]/i;
const localMapPagePathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|Users|private|mnt|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;

function safeMapPageText(value: unknown, fallback: string, maxLength = 80) {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const normalized = text.toLowerCase();
  const compact = normalized.replace(/[-_.:\s]/g, "");
  if (localMapPagePathPattern.test(text) || /(?:sk|tp)-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (
    unsafeMapTextFragments.some((fragment) => {
      const lowerFragment = fragment.toLowerCase();
      return normalized.includes(lowerFragment) || compact.includes(lowerFragment.replace(/[-_.:\s]/g, ""));
    })
  ) {
    return fallback;
  }
  return rewritePlayerFacingWorldText(text).slice(0, maxLength);
}

function safeMapPageRefId(value: unknown, maxLength = 96) {
  const text = safeMapPageText(value, "", maxLength);
  const compact = text.toLowerCase().replace(/[-_.:]/g, "");
  if (
    unsafeMapRefTokens.has(compact) ||
    unsafeMapRefPrefixPattern.test(text) ||
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

function getVisibleDomainConsequences(view: DomainConsequenceView | null | undefined) {
  return (view?.recentConsequences ?? [])
    .filter((item) => mapDomainConsequenceSourceTypes.includes(item.sourceType as typeof mapDomainConsequenceSourceTypes[number]))
    .map((item, index) => ({
      id: safeMapPageText(item.id || item.sourceId || `map-domain-${index}`, `map-domain-${index}`, 80),
      title: safeMapPageText(item.title || item.kindLabel || item.sourceLabel, "公开后果", 36),
      kindLabel: safeMapPageText(item.kindLabel || item.sourceLabel, "后果追踪", 28),
      statusLabel: safeMapPageText(item.statusLabel || item.status, "待续看", 28),
      severity: Math.max(0, Math.min(100, Math.round(Number(item.severity) || 0)))
    }))
    .sort((a, b) => b.severity - a.severity);
}

function getMapSituationEntries({
  activeLayerText,
  allLayersHidden,
  visibleMapEvents,
  visibleNpcActivityAnchors,
  visibleMapActionEntries,
  visibleDomainConsequences
}: {
  readonly activeLayerText: string;
  readonly allLayersHidden: boolean;
  readonly visibleMapEvents: ReturnType<typeof getMapEvents>;
  readonly visibleNpcActivityAnchors: ReturnType<typeof getNpcActivityAnchors>;
  readonly visibleMapActionEntries: readonly MapActionEntry[];
  readonly visibleDomainConsequences: ReturnType<typeof getVisibleDomainConsequences>;
}): MapSituationEntry[] {
  const topEvent = visibleMapEvents[0];
  const topNpcActivity = visibleNpcActivityAnchors[0];
  const topConsequence = visibleDomainConsequences[0];
  return [
    {
      id: "layers",
      label: "卷面",
      value: allLayersHidden ? "素绢空图" : activeLayerText,
      detail: allLayersHidden ? "三层暂收，只保留恢复入口。" : "图层只改眼前读法，不改案卷事实。"
    },
    {
      id: "events",
      label: "近事",
      value: topEvent ? `${topEvent.label} · 警势 ${topEvent.severity}` : "暂无警势",
      detail: topEvent ? `${topEvent.targetLabel}：${topEvent.summary}` : "可保留地点与驿路，待下一旬回音。"
    },
    {
      id: "people",
      label: "人物",
      value: topNpcActivity ? `${topNpcActivity.label} · 可见度 ${topNpcActivity.severity}` : "暂无锚点",
      detail: topNpcActivity ? `${topNpcActivity.targetLabel}：${topNpcActivity.summary}` : "人物动向只取公开来函、交游和地点线索。"
    },
    {
      id: "consequence",
      label: "后果",
      value: topConsequence ? `${topConsequence.title} · ${topConsequence.statusLabel}` : "暂无后果",
      detail: topConsequence ? `${topConsequence.kindLabel}；只作追踪线索。` : "案卷未载者不补造，后果仍候主卷回音。"
    },
    {
      id: "drafts",
      label: "可拟",
      value: `${visibleMapActionEntries.length} 条行动`,
      detail: visibleMapActionEntries.length ? "可写入主卷草稿，仍须呈上候复。" : "暂无可见舆图行动，可从单点札记或主卷落笔。"
    }
  ];
}

function getMapCompassEntries({
  visibleMapEvents,
  visibleNpcActivityAnchors,
  visibleMapActionEntries,
  visibleDomainConsequences
}: {
  readonly visibleMapEvents: ReturnType<typeof getMapEvents>;
  readonly visibleNpcActivityAnchors: ReturnType<typeof getNpcActivityAnchors>;
  readonly visibleMapActionEntries: readonly MapActionEntry[];
  readonly visibleDomainConsequences: ReturnType<typeof getVisibleDomainConsequences>;
}): MapCompassEntry[] {
  const topEvent = visibleMapEvents[0];
  const topNpcActivity = visibleNpcActivityAnchors[0];
  const topConsequence = visibleDomainConsequences[0];
  const topDraft = visibleMapActionEntries[0];
  return [
    {
      id: "events",
      label: "近事",
      title: topEvent?.label ?? "暂无警势",
      meta: topEvent ? `${topEvent.targetLabel} · 警势 ${topEvent.severity}` : "近事图层眼下平静",
      detail: topEvent?.summary ?? "未见新的公开近事，仍可保留地点与驿路读法。",
      tone: "event",
      draftText: topEvent
        ? `据舆图罗盘近事，先核「${topEvent.targetLabel}」附近的「${topEvent.label}」，整理人证、驿路与官府文书后回主卷呈上候复。`
        : undefined,
      targetRefs: topEvent?.targetRef ? [topEvent.targetRef] : [],
      sourceRefs: topEvent?.sourceRefs ?? []
    },
    {
      id: "people",
      label: "人物",
      title: topNpcActivity?.label ?? "暂无人物锚点",
      meta: topNpcActivity ? `${topNpcActivity.targetLabel} · 可见度 ${topNpcActivity.severity}` : "人物动向未在图上聚集",
      detail: topNpcActivity?.summary ?? "人物线索只取公开来函、交游与地点锚点，未载者不补造。",
      tone: "people",
      draftText: topNpcActivity
        ? `据舆图罗盘人物动向，先查「${topNpcActivity.label}」与「${topNpcActivity.targetLabel}」的公开线索，回主卷呈上候复。`
        : undefined,
      targetRefs: topNpcActivity?.targetRef ? [topNpcActivity.targetRef] : [],
      sourceRefs: topNpcActivity?.sourceRefs ?? []
    },
    {
      id: "consequence",
      label: "后果",
      title: topConsequence?.title ?? "暂无公开后果",
      meta: topConsequence ? `${topConsequence.kindLabel} · ${topConsequence.statusLabel}` : "后果追踪未见舆图牵连",
      detail: topConsequence ? "此条只作舆图旁读，后续仍以主卷回音为准。" : "案卷未载公开后果，舆图不补造余波。",
      tone: "consequence",
      targetRefs: [],
      sourceRefs: []
    },
    {
      id: "drafts",
      label: "可拟",
      title: topDraft?.label ?? "暂无可拟行动",
      meta: topDraft ? `${topDraft.kindLabel} · ${visibleMapActionEntries.length} 条可写入` : "单点或主卷可另行落笔",
      detail: topDraft?.summary ?? "可拟行动未出现时，罗盘只作读法提示，不生成行动事实。",
      tone: "drafts",
      draftKind: topDraft?.draftKind,
      draftText: topDraft?.text,
      targetRefs: topDraft?.targetRef ? [topDraft.targetRef] : [],
      sourceRefs: topDraft?.sourceRefs ?? []
    }
  ];
}

function joinMapLayerLabels(layers: readonly MapLayerKey[]) {
  return layers.length ? layers.map((layer) => mapLayerLabels[layer]).join("、") : "无";
}

export function MapPage() {
  const { sessionId = "s74-preview" } = useParams();
  const [visibleLayers, setVisibleLayers] = useState<Record<MapLayerKey, boolean>>(defaultVisibleLayers);
  const [lastWrittenMapDraftId, setLastWrittenMapDraftId] = useState<string | null>(null);
  const [mapCompassFocus, setMapCompassFocus] = useState<MapCompassFocus>("events");
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
  const visibleDomainConsequences = useMemo(() => getVisibleDomainConsequences(domainConsequenceView), [domainConsequenceView]);
  const activeLayers = (Object.keys(visibleLayers) as MapLayerKey[]).filter((key) => visibleLayers[key]);
  const hiddenLayers = (Object.keys(visibleLayers) as MapLayerKey[]).filter((key) => !visibleLayers[key]);
  const activeLayerCount = activeLayers.length;
  const activeLayerText = joinMapLayerLabels(activeLayers);
  const hiddenLayerText = joinMapLayerLabels(hiddenLayers);
  const allLayersHidden = activeLayerCount === 0;
  const layerState = allLayersHidden ? "all-hidden" : hiddenLayers.length ? "partial" : "all-shown";
  const layerSummary = allLayersHidden
    ? "地点、驿路、近事三层暂隐；卷面收作素绢空图，局势簿同步收起可见线索。"
    : hiddenLayers.length
    ? `现显 ${activeLayerText}；暂隐 ${hiddenLayerText}。筛选只改卷上显示，不改变案卷事实。`
    : `地点、驿路、近事三层全开；筛选只改卷上显示，不改变案卷事实。`;
  const visibleMapEvents = visibleLayers.events ? mapEvents : [];
  const visibleNpcActivityAnchors = visibleLayers.events ? npcActivityAnchors : [];
  const visibleMapActionEntries = mapActionEntries.filter((entry) => {
    if (entry.draftKind === "map_ref_action") return visibleLayers.places;
    if (entry.draftKind === "map_route_action") return visibleLayers.routes;
    return visibleLayers.events;
  });
  const visibleRefCount = visibleLayers.places ? refCount : 0;
  const visibleRouteCount = visibleLayers.routes ? routeCount : 0;
  const visibleEventCount = visibleLayers.events ? eventCount : 0;
  const visibleNpcActivityCount = visibleLayers.events ? npcActivityCount : 0;
  const visibleLayerDigest = allLayersHidden
    ? "暂无可见舆图线索"
    : `${visibleRefCount} 处地点 · ${visibleRouteCount} 条驿路 · ${visibleEventCount} 项近事`;
  const mapSituationEntries = getMapSituationEntries({
    activeLayerText,
    allLayersHidden,
    visibleMapEvents,
    visibleNpcActivityAnchors,
    visibleMapActionEntries,
    visibleDomainConsequences
  });
  const mapCompassEntries = getMapCompassEntries({
    visibleMapEvents,
    visibleNpcActivityAnchors,
    visibleMapActionEntries,
    visibleDomainConsequences
  });
  const selectedMapCompassEntry = mapCompassEntries.find((entry) => entry.id === mapCompassFocus) ?? mapCompassEntries[0] ?? fallbackMapCompassEntry;
  const archiveHref = routeSessionSupported ? `/game/${sessionId}/archive` : "/";
  const gameHref = routeSessionSupported ? `/game/${sessionId}` : "/";

  useEffect(() => {
    setVisibleLayers(defaultVisibleLayers);
    setLastWrittenMapDraftId(null);
    setMapCompassFocus("events");
  }, [sessionId]);

  useEffect(() => {
    if (allLayersHidden) return;
    if (mapCompassFocus === "events" && !visibleMapEvents.length && visibleNpcActivityAnchors.length) {
      setMapCompassFocus("people");
      return;
    }
    if (mapCompassFocus === "people" && !visibleNpcActivityAnchors.length && visibleMapEvents.length) {
      setMapCompassFocus("events");
    }
  }, [allLayersHidden, mapCompassFocus, visibleMapEvents.length, visibleNpcActivityAnchors.length]);

  function toggleLayer(layer: MapLayerKey) {
    setVisibleLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  function restoreAllLayers() {
    setVisibleLayers(defaultVisibleLayers);
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

  function draftFromMapSituation() {
    const topEvent = visibleMapEvents[0];
    const topNpcActivity = visibleNpcActivityAnchors[0];
    const title = topEvent?.label || topNpcActivity?.label || visibleDomainConsequences[0]?.title || "山河局势";
    const targetRefs = [topEvent?.targetRef, topNpcActivity?.targetRef].filter(Boolean);
    const sourceRefs = [
      ...(topEvent?.sourceRefs ?? []),
      ...(topNpcActivity?.sourceRefs ?? [])
    ];
    setLastWrittenMapDraftId("s89-21-map-situation");
    writeMapActionDraft(
      `据舆图局势，先核「${title}」相关地点、人物与公开后果，整理可查线索后回主卷呈上候复。`,
      buildMapDraftContext("map_event_action", targetRefs, sourceRefs, true)
    );
  }

  function draftFromMapCompass(entry: MapCompassEntry) {
    if (!entry.draftText) return;
    setLastWrittenMapDraftId(`s89-31-map-compass-${entry.id}`);
    writeMapActionDraft(
      entry.draftText,
      buildMapDraftContext(entry.id === "drafts" ? entry.draftKind ?? "map_ref_action" : "map_event_action", entry.targetRefs, entry.sourceRefs, true)
    );
  }

  return (
    <article
      className="mapFullScreen routePanel"
      aria-labelledby="map-title"
      data-polish-surface="s89-5-map-command"
      data-polish-map="s89-7-layer-tooltip"
      data-polish-map-empty="s89-11-layer-empty"
      data-layer-visibility={layerState}
    >
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
        <div
          className="mapLayerSummary"
          data-layer-mode={layerState}
          data-polish-map="s89-7-layer-summary"
          data-polish-map-layers="s89-11-layer-empty"
        >
          <p>{layerSummary}</p>
          {allLayersHidden ? (
            <button className="paperButton mapLayerRestore" type="button" onClick={restoreAllLayers}>
              展开三层
            </button>
          ) : null}
        </div>
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
          allLayersHidden={allLayersHidden}
          onRestoreLayers={restoreAllLayers}
          onActionDraft={writeMapRuntimeSelection}
        />
        <aside className="mapSituationLedger" aria-labelledby="map-ledger-title" data-polish-card="s89-5-map-ledger">
          <div>
            <p className="eyebrow">局势簿摘录</p>
            <h2 id="map-ledger-title">公开近事</h2>
          </div>
          <section className="mapVisibleLayerDigest" aria-label="卷上可见舆图线索" data-polish-map-empty="s89-11-ledger-digest">
            <span>卷上可见</span>
            <strong>{visibleLayerDigest}</strong>
            <p>
              {allLayersHidden
                ? "三层暂收时，局势簿只作恢复入口；重开图层后再看点位、路线与近事。"
                : `人物动向 ${visibleNpcActivityCount} 条；筛选只改卷上显示，不改变案卷事实。`}
            </p>
            {allLayersHidden ? (
              <button className="paperButton" type="button" onClick={restoreAllLayers}>
                展开三层
              </button>
            ) : null}
          </section>
          <section
            className="mapVisibleLayerDigest mapSituationIndex"
            aria-label="山河局势轴"
            data-polish-map-situation="s89-21-situation-index"
            data-polish-map-reading="s89-21-situation-reader"
          >
            <div className="mapSituationIndexHeader">
              <div>
                <p className="eyebrow">山河局势轴</p>
                <h3>本卷读法</h3>
              </div>
              <button
                className="paperButton"
                type="button"
                disabled={!routeSessionSupported || allLayersHidden}
                data-draft-state={lastWrittenMapDraftId === "s89-21-map-situation" ? "written" : "idle"}
                onClick={draftFromMapSituation}
              >
                据局势拟稿
              </button>
            </div>
            <dl className="mapSituationIndexList">
              {mapSituationEntries.map((entry) => (
                <div key={entry.id}>
                  <dt>{entry.label}</dt>
                  <dd>
                    <strong>{entry.value}</strong>
                    <span>{entry.detail}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mapSituationBoundary">局势轴只合读公开图层、人物锚点和后果追踪；坐标、画面层级与视觉特效不进入主卷裁决。</p>
          </section>
          <section
            className="mapTideCompass"
            aria-label="舆图态势罗盘"
            data-polish-map-tide="s89-31-map-tide-compass"
            data-compass-focus={selectedMapCompassEntry.id}
          >
            <div className="mapTideCompassHeader">
              <div>
                <p className="eyebrow">舆图态势罗盘</p>
                <h3>先看何处</h3>
              </div>
              <span>{allLayersHidden ? "三层暂收" : `显 ${activeLayerCount} 层`}</span>
            </div>
            <div className="mapTideCompassTabs" role="tablist" aria-label="舆图态势焦点">
              {mapCompassEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedMapCompassEntry.id === entry.id}
                  className="mapTideCompassTab"
                  data-compass-tone={entry.tone}
                  onClick={() => setMapCompassFocus(entry.id)}
                >
                  <span>{entry.label}</span>
                  <strong>{entry.meta}</strong>
                </button>
              ))}
            </div>
            <article className="mapTideCompassReadout" data-compass-tone={selectedMapCompassEntry.tone}>
              <span>{selectedMapCompassEntry.label}</span>
              <strong>{selectedMapCompassEntry.title}</strong>
              <p>{selectedMapCompassEntry.detail}</p>
              <div className="mapTideCompassFooter">
                <em>{selectedMapCompassEntry.draftText ? "可写入本地草稿，仍须主卷回音。" : "只作卷上读法，不生成行动事实。"}</em>
                {selectedMapCompassEntry.draftText ? (
                  <button
                    className="paperButton"
                    type="button"
                    disabled={!routeSessionSupported || allLayersHidden}
                    data-draft-state={lastWrittenMapDraftId === `s89-31-map-compass-${selectedMapCompassEntry.id}` ? "written" : "idle"}
                    onClick={() => draftFromMapCompass(selectedMapCompassEntry)}
                  >
                    据罗盘拟稿
                  </button>
                ) : null}
              </div>
            </article>
          </section>
          <section className="mapActionDeck" aria-labelledby="map-action-title">
            <div>
              <p className="eyebrow">行动入口</p>
              <h3 id="map-action-title">舆图行动</h3>
            </div>
            {visibleMapActionEntries.length ? (
              <ol className="mapActionList">
                {visibleMapActionEntries.map((entry) => (
                  <li className="paperMotionCard paperMotionInteractive paperMotionDraft" key={entry.id} data-draft-state={lastWrittenMapDraftId === entry.id ? "written" : "idle"}>
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
              <p className="mapEmptyLedger">{allLayersHidden ? "三层暂收，暂无可见舆图预备行动；展开图层后再写入候复草稿。" : "暂无舆图预备行动；可点击地图地点查看单点草稿，或回主卷自行落笔。"}</p>
            )}
          </section>
          {visibleMapEvents.length ? (
            <ol className="mapEventList">
              {visibleMapEvents.map((eventItem) => (
                <li className="paperMotionCard paperMotionInteractive paperMotionDraft" key={eventItem.id} data-draft-state={lastWrittenMapDraftId === eventItem.id ? "written" : "idle"}>
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
            <p className="mapEmptyLedger">{allLayersHidden ? "近事图层暂收，局势簿不显示公开近事。" : "暂无公开近事；可保留地点与驿路图层，或回主卷推进一旬后再查看。"}</p>
          )}
          {visibleNpcActivityAnchors.length ? (
            <section className="mapNpcActivityDeck" aria-labelledby="map-npc-activity-title">
              <div>
                <p className="eyebrow">人物锚点</p>
                <h3 id="map-npc-activity-title">舆图人物动向</h3>
              </div>
              <ol className="mapNpcActivityList">
                {visibleNpcActivityAnchors.map((anchor) => (
                  <li className="paperMotionCard paperMotionInteractive" key={anchor.id}>
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
          ? allLayersHidden
            ? `已接入 ${refCount} 处地点、${routeCount} 条路线、${eventCount} 项近事、${npcActivityCount} 条人物动向，三层暂收为素绢空图；舆图只读公开卷宗，案卷事实未改。`
            : `已接入 ${refCount} 处地点、${routeCount} 条路线、${eventCount} 项近事、${npcActivityCount} 条人物动向，当前显示 ${activeLayerCount} 个图层（${activeLayerText}）；舆图只读公开卷宗。`
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
