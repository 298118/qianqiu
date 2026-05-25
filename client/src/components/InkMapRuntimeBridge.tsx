import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRuntimeActionDraft, MapRuntimeRef, MapRuntimeView } from "../api";

const pixiScriptSrc = "/vendor/pixi.min.js";
const mapRendererScriptSrc = "/mapRenderer.js";
const mapRuntimeScriptAttribute = "data-qianqiu-map-runtime";

type ScreenPosition = {
  readonly x: number;
  readonly y: number;
};

type LabelMarker = {
  readonly id: string;
  readonly label: string;
  readonly position: ScreenPosition;
  readonly ref: MapRuntimeRef;
};

type ActiveTooltip = {
  readonly ref: MapRuntimeRef;
  readonly position: ScreenPosition;
};

type MapTooltipTone = "place" | "event" | "people" | "route";

export type MapRuntimeDraftSelection = {
  readonly draftId: string;
  readonly label: string;
  readonly text: string;
  readonly targetRef: string;
  readonly sourceRefs: readonly string[];
  readonly requiresServerTurn: boolean;
};

export type VisibleMapLayers = {
  readonly places?: boolean;
  readonly routes?: boolean;
  readonly events?: boolean;
};

type MapRendererOptions = {
  readonly onRenderLabel?: (ref: MapRuntimeRef, position: ScreenPosition) => void;
  readonly onClickRef?: (ref: MapRuntimeRef, position: ScreenPosition) => void;
  readonly onNeedsUpdate?: () => void;
  readonly onLoadError?: (error: unknown) => void;
  readonly motionEnabled?: boolean;
};

type MapRendererInstance = {
  readonly update: (view: MapRuntimeView) => void;
  readonly destroy: () => void;
  readonly getDebugState?: () => unknown;
  readonly setMotionEnabled?: (enabled: boolean) => void;
};

declare global {
  interface Window {
    PIXI?: unknown;
    MapRenderer?: new (container: HTMLElement, options?: MapRendererOptions) => MapRendererInstance;
  }
}

const scriptPromises = new Map<string, Promise<void>>();

const unsafeMapRuntimeTextFragments = [
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

const unsafeMapRuntimeRefTokens = new Set([
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
const unsafeMapRuntimeRefPrefixPattern = /^(?:layout|layoutpath|mapbounds|viewporthint|position|coordinate|coordinates|coord|coords|draft[-_.:]?context|schema|manifest|server[-_.:]?adjudication|ai[-_.:]?read[-_.:]?scope|proposal[-_.:]?boundary|safe[-_.:]?view|resolver)[:_.-]/i;
const localMapRuntimePathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|Users|private|mnt|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;

function isBrowserRuntime() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function loadScriptOnce(src: string) {
  if (!isBrowserRuntime()) {
    return Promise.reject(new Error("地图运行时只能在浏览器中加载。"));
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.qianqiuLoaded === "true") {
    return Promise.resolve();
  }

  const pending = scriptPromises.get(src);
  if (pending) return pending;

  const promise = new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement("script");

    const handleLoad = () => {
      script.dataset.qianqiuLoaded = "true";
      resolve();
    };
    const handleError = () => reject(new Error(`地图脚本加载失败：${src}`));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.src = src;
      script.async = false;
      script.setAttribute(mapRuntimeScriptAttribute, "true");
      document.head.appendChild(script);
    }
  });

  scriptPromises.set(src, promise);
  return promise;
}

async function ensureMapRuntimeScripts() {
  if (window.PIXI && window.MapRenderer) return;
  if (!window.PIXI) await loadScriptOnce(pixiScriptSrc);
  if (!window.MapRenderer) await loadScriptOnce(mapRendererScriptSrc);
  if (!window.PIXI || !window.MapRenderer) {
    throw new Error("S72 地图运行时未能就绪。");
  }
}

function isUsableMapRuntimeView(view: MapRuntimeView | null | undefined): view is MapRuntimeView {
  return view?.schemaVersion === 1 || view?.schemaVersion === "1";
}

function toLabelId(ref: MapRuntimeRef, index: number) {
  return `${ref.mapEntityRef || ref.sourceRef || "map-label"}-${index}`;
}

function clampTooltipPosition(value: number) {
  if (!Number.isFinite(value)) return 16;
  return Math.max(16, Math.min(value, 10000));
}

function isSafeActionDraft(draft: MapRuntimeActionDraft | undefined): draft is MapRuntimeActionDraft & { readonly actionText: string } {
  return typeof draft?.actionText === "string" && safeMapRuntimeText(draft.actionText, "", 140).length > 0;
}

function safeMapRuntimeText(value: unknown, fallback: string, maxLength = 80) {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const normalized = text.toLowerCase();
  const compact = normalized.replace(/[-_.:\s]/g, "");
  if (localMapRuntimePathPattern.test(text) || /(?:sk|tp)-[a-z0-9_-]{6,}/i.test(text)) return fallback;
  if (
    unsafeMapRuntimeTextFragments.some((fragment) => {
      const lowerFragment = fragment.toLowerCase();
      return normalized.includes(lowerFragment) || compact.includes(lowerFragment.replace(/[-_.:\s]/g, ""));
    })
  ) {
    return fallback;
  }
  return text.slice(0, maxLength);
}

function safeMapRuntimeRefId(value: unknown, maxLength = 96) {
  const text = safeMapRuntimeText(value, "", maxLength);
  const compact = text.toLowerCase().replace(/[-_.:]/g, "");
  if (
    unsafeMapRuntimeRefTokens.has(compact) ||
    unsafeMapRuntimeRefPrefixPattern.test(text) ||
    /^[xy][:_\-.]?\d/i.test(text)
  ) {
    return "";
  }
  return /^[A-Za-z0-9_.:-]+$/.test(text) ? text : "";
}

function safeMapRuntimeRefList(values: readonly unknown[], maxItems = 8) {
  const refs: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const ref = safeMapRuntimeRefId(value);
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
    if (refs.length >= maxItems) break;
  }
  return refs;
}

function readNumericMapRuntimeField(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const normalized = numberValue <= 1 ? numberValue * 100 : numberValue;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function getMapRuntimeTooltipTone(ref: MapRuntimeRef): MapTooltipTone {
  const styleLayer = safeMapRuntimeText(ref.style?.layer, "", 28).toLowerCase();
  const styleToken = safeMapRuntimeText(ref.style?.token, "", 32).toLowerCase();
  const sourceJoined = safeMapRuntimeRefList([...(ref.sourceRefs ?? []), ref.sourceRef, ref.mapEntityRef], 8).join(" ").toLowerCase();
  const labelSummary = safeMapRuntimeText(`${ref.label ?? ""} ${ref.summary ?? ""}`, "", 140).toLowerCase();
  if (/route|road|驿路|路线/.test(`${styleLayer} ${styleToken} ${sourceJoined} ${labelSummary}`)) return "route";
  if (ref.actionDraftRefs?.length) return "place";
  if (/npc|people|person|relationship|人物|来函|交游/.test(`${styleLayer} ${styleToken} ${sourceJoined} ${labelSummary}`)) return "people";
  if (/event|archive|consequence|近事|警|余波|后果/.test(`${styleLayer} ${styleToken} ${sourceJoined} ${labelSummary}`)) return "event";
  return "place";
}

function getMapRuntimeTooltipReading(ref: MapRuntimeRef, hasDrafts: boolean) {
  const tone = getMapRuntimeTooltipTone(ref);
  const severity = readNumericMapRuntimeField(ref["severity"], tone === "event" ? 62 : tone === "people" ? 54 : tone === "route" ? 48 : 42);
  const labels: Record<MapTooltipTone, string> = {
    place: "地点札记",
    event: "近事札记",
    people: "人物札记",
    route: "驿路札记"
  };
  const captions: Record<MapTooltipTone, string> = {
    place: "公开地点",
    event: "公开近事",
    people: "人物动向",
    route: "公开驿路"
  };
  return {
    tone,
    label: labels[tone],
    caption: captions[tone],
    meter: severity,
    boundary: hasDrafts ? "可写入本地草稿，仍回主卷候复。" : "只作舆图旁读，不生成行动事实。"
  };
}

function buildMapRuntimeDraftSelection(
  draftId: string,
  draft: MapRuntimeActionDraft & { readonly actionText: string },
  ref: MapRuntimeRef
): MapRuntimeDraftSelection | null {
  const text = safeMapRuntimeText(draft.actionText, "", 140);
  const targetRef = safeMapRuntimeRefId(draft.targetRef || ref.mapEntityRef || ref.sourceRef);
  if (!text || !targetRef) return null;
  return {
    draftId: safeMapRuntimeRefId(draft.id || draftId, 96) || "map-draft",
    label: safeMapRuntimeText(draft.label, "写入行动草稿", 32),
    text,
    targetRef,
    sourceRefs: safeMapRuntimeRefList([...(draft.sourceRefs ?? []), ...(ref.sourceRefs ?? []), ref.sourceRef]),
    requiresServerTurn: draft.requiresServerTurn !== false
  };
}

function filterMapRuntimeView(view: MapRuntimeView | null | undefined, visibleLayers: VisibleMapLayers): MapRuntimeView | null | undefined {
  if (!isUsableMapRuntimeView(view)) return view;
  return {
    ...view,
    refs: visibleLayers.places === false ? [] : view.refs,
    routes: visibleLayers.routes === false ? [] : view.routes,
    eventEffects: visibleLayers.events === false ? [] : view.eventEffects,
    npcActivityAnchors: visibleLayers.events === false ? [] : view.npcActivityAnchors
  };
}

type InkMapRuntimeBridgeProps = {
  readonly mapRuntimeView?: MapRuntimeView | null;
  readonly mapMotionEnabled: boolean;
  readonly visibleLayers?: VisibleMapLayers;
  readonly writtenDraftId?: string | null;
  readonly allLayersHidden?: boolean;
  readonly onRestoreLayers?: () => void;
  readonly onActionDraft: (selection: MapRuntimeDraftSelection) => void;
};

export function InkMapRuntimeBridge({
  mapRuntimeView,
  mapMotionEnabled,
  visibleLayers = {},
  writtenDraftId = null,
  allLayersHidden = false,
  onRestoreLayers,
  onActionDraft
}: InkMapRuntimeBridgeProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<MapRendererInstance | null>(null);
  const filteredMapRuntimeView = useMemo(() => filterMapRuntimeView(mapRuntimeView, visibleLayers), [mapRuntimeView, visibleLayers]);
  const currentViewRef = useRef<MapRuntimeView | null>(filteredMapRuntimeView ?? null);
  const [status, setStatus] = useState<"waiting" | "loading" | "ready" | "fallback" | "error">("waiting");
  const [labels, setLabels] = useState<LabelMarker[]>([]);
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);

  const destroyRenderer = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.destroy();
      rendererRef.current = null;
    }
    if (canvasHostRef.current) {
      canvasHostRef.current.innerHTML = "";
    }
  }, []);

  useEffect(() => {
    return () => destroyRenderer();
  }, [destroyRenderer]);

  useEffect(() => {
    currentViewRef.current = filteredMapRuntimeView ?? null;
    setActiveTooltip(null);
  }, [filteredMapRuntimeView]);

  useEffect(() => {
    let cancelled = false;

    async function mountRenderer() {
      if (!isUsableMapRuntimeView(filteredMapRuntimeView)) {
        destroyRenderer();
        setLabels([]);
        setActiveTooltip(null);
        setStatus("waiting");
        return;
      }

      setStatus("loading");
      try {
        await ensureMapRuntimeScripts();
        if (cancelled || !canvasHostRef.current || !window.MapRenderer) return;

        if (!rendererRef.current) {
          rendererRef.current = new window.MapRenderer(canvasHostRef.current, {
            motionEnabled: mapMotionEnabled,
            onRenderLabel(ref, position) {
              if (!ref.label) return;
              setLabels((currentLabels) => [
                ...currentLabels,
                {
                  id: toLabelId(ref, currentLabels.length),
                  label: safeMapRuntimeText(ref.label, "舆图节点", 36),
                  position,
                  ref
                }
              ]);
            },
            onClickRef(ref, position) {
              setActiveTooltip({ ref, position });
            },
            onNeedsUpdate() {
              if (currentViewRef.current && rendererRef.current) {
                setLabels([]);
                rendererRef.current.update(currentViewRef.current);
              }
            },
            onLoadError() {
              setStatus("fallback");
            }
          });
        } else if (rendererRef.current.setMotionEnabled) {
          rendererRef.current.setMotionEnabled(mapMotionEnabled);
        }

        setLabels([]);
        rendererRef.current.update(filteredMapRuntimeView);
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) {
          destroyRenderer();
          setStatus("error");
        }
      }
    }

    void mountRenderer();

    return () => {
      cancelled = true;
    };
  }, [destroyRenderer, filteredMapRuntimeView, mapMotionEnabled]);

  const activeDrafts = useMemo(() => {
    const refs = activeTooltip?.ref.actionDraftRefs ?? [];
    const drafts = mapRuntimeView?.actionDrafts ?? {};
    return refs
      .map((draftId) => ({ draftId, draft: drafts[draftId] }))
      .filter((entry): entry is { readonly draftId: string; readonly draft: MapRuntimeActionDraft & { readonly actionText: string } } =>
        isSafeActionDraft(entry.draft)
      )
      .map(({ draftId, draft }) => activeTooltip ? buildMapRuntimeDraftSelection(draftId, draft, activeTooltip.ref) : null)
      .filter((entry): entry is MapRuntimeDraftSelection => Boolean(entry));
  }, [activeTooltip, mapRuntimeView]);

  const activeTooltipTitle = safeMapRuntimeText(activeTooltip?.ref.label, "地图近事", 40);
  const activeTooltipSummary = safeMapRuntimeText(activeTooltip?.ref.summary, "暂无更多公开摘要。", 120);
  const activeTooltipReading = activeTooltip ? getMapRuntimeTooltipReading(activeTooltip.ref, activeDrafts.length > 0) : null;

  const fallbackText = useMemo(() => {
    if (status === "loading") return "正在铺开公开舆图...";
    if (status === "error") return "舆图运行时暂不可用，文字主流程不受影响。";
    if (status === "fallback") return "地图素材未完全载入，已保留静态舆图降级。";
    return "舆图资料待生成。";
  }, [status]);

  return (
    <section
      className="inkMapRuntimeBridge"
      aria-label="山河舆图"
      data-map-status={status}
      data-map-motion={mapMotionEnabled ? "enabled" : "reduced"}
      data-layer-visibility={allLayersHidden ? "all-hidden" : "visible"}
    >
      <div className="inkMapStage">
        <div ref={canvasHostRef} className="inkMapCanvasHost" aria-hidden="true" />
        <div className="inkMapUiLayer" aria-live="polite">
          {labels.map((label) => (
            <button
              className="inkMapLabel"
              key={label.id}
              type="button"
              style={{ left: `${label.position.x}px`, top: `${label.position.y}px` }}
              onClick={() => setActiveTooltip({ ref: label.ref, position: label.position })}
            >
              {label.label}
            </button>
          ))}
          {activeTooltip ? (
            <aside
              className="inkMapTooltip"
              data-polish-tooltip="s89-7-map-note"
              data-polish-tooltip-reading="s89-31-mobile-map-note"
              data-tooltip-tone={activeTooltipReading?.tone ?? "place"}
              role="status"
              style={{
                left: `${clampTooltipPosition(activeTooltip.position.x)}px`,
                top: `${clampTooltipPosition(activeTooltip.position.y)}px`
              }}
            >
              <div className="inkMapTooltipHeader">
                <div>
                  <span className="inkMapTooltipSeal">{activeTooltipReading?.label ?? "单点札记"}</span>
                  <strong>{activeTooltipTitle}</strong>
                </div>
                <button className="inkMapTooltipClose" type="button" aria-label="收起地图近事" onClick={() => setActiveTooltip(null)}>
                  收
                </button>
              </div>
              <span className="inkMapTooltipNote">单点札记 · 写入后仍须回主卷候复</span>
              <div className="inkMapTooltipReading" data-meter={activeTooltipReading?.meter ?? 0}>
                <span>{activeTooltipReading?.caption ?? "公开舆图"}</span>
                <i style={{ width: `${activeTooltipReading?.meter ?? 0}%` }} aria-hidden="true" />
                <em>可见度 {activeTooltipReading?.meter ?? 0}</em>
              </div>
              <p>{activeTooltipSummary}</p>
              <small>{activeTooltipReading?.boundary}</small>
              {activeDrafts.length ? (
                <div className="buttonRow">
                  {activeDrafts.map((selection) => (
                    <button
                      className="paperButton"
                      key={selection.draftId}
                      type="button"
                      data-draft-state={writtenDraftId === selection.draftId ? "written" : "idle"}
                      aria-label={`${selection.label}${writtenDraftId === selection.draftId ? "，已写入主卷草稿" : ""}`}
                      onClick={() => onActionDraft(selection)}
                    >
                      {selection.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </aside>
          ) : null}
          {status !== "ready" ? (
            <div className="inkMapRuntimeFallback" role="status">
              {fallbackText}
            </div>
          ) : null}
          {status === "ready" && allLayersHidden ? (
            <div className="inkMapLayerEmptyOverlay" data-polish-map-empty="s89-11-runtime-empty" role="status">
              <strong>卷上三层皆暂收</strong>
              <p>山河底图仍在，地点、驿路与近事只是在浏览器卷面暂隐。</p>
              {onRestoreLayers ? (
                <button className="paperButton" type="button" onClick={onRestoreLayers}>
                  展开三层
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="inkMapMeta">
        <span>只读公开舆图</span>
        <span>画面坐标不作凭据</span>
        <span>{mapMotionEnabled ? "水墨动效开启" : "水墨动效降级"}</span>
      </div>
    </section>
  );
}
