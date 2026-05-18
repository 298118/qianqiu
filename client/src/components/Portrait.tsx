import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { AssetFallback, AssetRegistry, RuntimePortraitAsset } from "../assets/assetRegistry";

type PortraitProps = {
  readonly registry: AssetRegistry;
  readonly portraitRef: string;
  readonly label?: string;
  readonly className?: string;
};

export function Portrait({ registry, portraitRef, label, className = "" }: PortraitProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const portrait = registry.getPortrait(portraitRef);
  const fallback = registry.getFallback(portrait?.fallbackRef);
  const resolvedLabel = label ?? portrait?.roleLabel ?? portrait?.role ?? "人物立绘";
  const imageSource = portrait?.thumbnailPath ?? portrait?.lowResPlaceholderPath ?? null;
  const fallbackStyle = useMemo(() => buildFallbackStyle(fallback, portrait), [fallback, portrait]);

  if (!portrait || imageFailed || !imageSource) {
    return (
      <figure
        className={`portraitFrame portraitFrameFallback ${className}`.trim()}
        aria-label={`${resolvedLabel}，纸底占位`}
        data-portrait-ref={portraitRef}
        data-asset-fallback={fallback?.id ?? "fallback-paper-panel-v1"}
        style={fallbackStyle}
      >
        <span aria-hidden="true">人</span>
      </figure>
    );
  }

  return (
    <figure
      className={`portraitFrame ${className}`.trim()}
      aria-label={resolvedLabel}
      data-portrait-ref={portrait.portraitRef}
      data-portrait-remastered={portrait.hasHighResOverride ? "true" : "false"}
      style={fallbackStyle}
    >
      <img
        src={imageSource}
        alt={resolvedLabel}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    </figure>
  );
}

function buildFallbackStyle(fallback: AssetFallback | null, portrait: RuntimePortraitAsset | null): CSSProperties {
  const cssTokens = fallback?.cssTokens ?? {};
  const style = {
    "--portrait-fallback-bg": cssTokens.backgroundColor ?? "#e8dcc8",
    "--portrait-fallback-border": cssTokens.borderColor ?? cssTokens.accentColor ?? "#a53a2a",
    "--portrait-fallback-text": cssTokens.textColor ?? "#241f18"
  } as CSSProperties;

  if (portrait?.lowResPlaceholderPath) {
    return {
      ...style,
      backgroundImage: `linear-gradient(rgba(232, 220, 200, 0.72), rgba(232, 220, 200, 0.72)), url("${portrait.lowResPlaceholderPath}")`
    };
  }

  return style;
}
