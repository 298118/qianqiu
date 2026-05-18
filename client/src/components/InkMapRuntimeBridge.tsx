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
  return ref.mapEntityRef || ref.sourceRef || `map-label-${index}`;
}

function clampTooltipPosition(value: number) {
  if (!Number.isFinite(value)) return 16;
  return Math.max(16, Math.min(value, 10000));
}

function isSafeActionDraft(draft: MapRuntimeActionDraft | undefined): draft is MapRuntimeActionDraft & { readonly actionText: string } {
  return typeof draft?.actionText === "string" && draft.actionText.trim().length > 0;
}

type InkMapRuntimeBridgeProps = {
  readonly mapRuntimeView?: MapRuntimeView | null;
  readonly mapMotionEnabled: boolean;
  readonly onActionDraft: (text: string) => void;
};

export function InkMapRuntimeBridge({ mapRuntimeView, mapMotionEnabled, onActionDraft }: InkMapRuntimeBridgeProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<MapRendererInstance | null>(null);
  const currentViewRef = useRef<MapRuntimeView | null>(mapRuntimeView ?? null);
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
    currentViewRef.current = mapRuntimeView ?? null;
  }, [mapRuntimeView]);

  useEffect(() => {
    let cancelled = false;

    async function mountRenderer() {
      if (!isUsableMapRuntimeView(mapRuntimeView)) {
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
                  label: ref.label || "舆图节点",
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
        rendererRef.current.update(mapRuntimeView);
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
  }, [destroyRenderer, mapMotionEnabled, mapRuntimeView]);

  const activeDrafts = useMemo(() => {
    const refs = activeTooltip?.ref.actionDraftRefs ?? [];
    const drafts = mapRuntimeView?.actionDrafts ?? {};
    return refs
      .map((draftId) => ({ draftId, draft: drafts[draftId] }))
      .filter((entry): entry is { readonly draftId: string; readonly draft: MapRuntimeActionDraft & { readonly actionText: string } } =>
        isSafeActionDraft(entry.draft)
      );
  }, [activeTooltip, mapRuntimeView]);

  const fallbackText = useMemo(() => {
    if (status === "loading") return "正在铺开安全舆图投影...";
    if (status === "error") return "舆图运行时暂不可用，文字主流程不受影响。";
    if (status === "fallback") return "地图素材未完全载入，已保留静态舆图降级。";
    return "舆图资料待生成。";
  }, [status]);

  return (
    <section
      className="inkMapRuntimeBridge"
      aria-label="S72 PixiJS 水墨舆图"
      data-map-status={status}
      data-map-motion={mapMotionEnabled ? "enabled" : "reduced"}
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
              role="status"
              style={{
                left: `${clampTooltipPosition(activeTooltip.position.x)}px`,
                top: `${clampTooltipPosition(activeTooltip.position.y)}px`
              }}
            >
              <strong>{activeTooltip.ref.label || "地图近事"}</strong>
              {activeTooltip.ref.summary ? <p>{activeTooltip.ref.summary}</p> : null}
              {activeDrafts.length ? (
                <div className="buttonRow">
                  {activeDrafts.map(({ draftId, draft }) => (
                    <button className="paperButton" key={draftId} type="button" onClick={() => onActionDraft(draft.actionText)}>
                      {draft.label || "写入行动草稿"}
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
        </div>
      </div>
      <div className="inkMapMeta">
        <span>只读 mapRuntimeView</span>
        <span>显示坐标不入 prompt 或裁决</span>
        <span>{mapMotionEnabled ? "水墨动效开启" : "水墨动效降级"}</span>
      </div>
    </section>
  );
}
