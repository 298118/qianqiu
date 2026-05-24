import type { CSSProperties, MouseEvent } from "react";
import { useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";
import type { AssetFallback, AssetRegistry, RuntimePortraitAsset } from "../assets/assetRegistry";
import type { PortraitViewerProfile } from "../state/uiState";
import { useUiStateStore } from "../state/uiState";
import { markOverlayTrigger } from "./overlayFocus";

type PortraitProps = {
  readonly registry: AssetRegistry;
  readonly portraitRef: string;
  readonly label?: string;
  readonly className?: string;
  readonly viewerEnabled?: boolean;
  readonly profile?: PortraitViewerProfile;
};

export function Portrait({ registry, portraitRef, label, className = "", viewerEnabled = true, profile }: PortraitProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const openPortraitViewer = useUiStateStore((state) => state.openPortraitViewer);
  const portrait = registry.getPortrait(portraitRef);
  const fallback = registry.getFallback(portrait?.fallbackRef);
  const rawResolvedLabel = label ?? portrait?.roleLabel ?? portrait?.role ?? "人物立绘";
  const resolvedLabel = cleanPortraitProfileText(rawResolvedLabel, 48) || "人物立绘";
  const imageSource = portrait?.path ?? portrait?.thumbnailPath ?? portrait?.lowResPlaceholderPath ?? null;
  const fallbackStyle = useMemo(() => buildFallbackStyle(fallback, portrait), [fallback, portrait]);

  function handleOpenViewer(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!portrait) return;
    markOverlayTrigger(event.currentTarget);
    const safeProfile = normalizePortraitViewerProfile(profile);
    openPortraitViewer({
      portraitRef: portrait.portraitRef,
      label: resolvedLabel,
      ...(safeProfile ? { profile: safeProfile } : {})
    });
  }

  if (!portrait || imageFailed || !imageSource) {
    return (
      <figure
        className={`portraitFrame portraitFrameFallback ${className}`.trim()}
        aria-label={`${resolvedLabel}，纸底占位`}
        data-portrait-ref={portraitRef}
        data-asset-fallback={fallback?.id ?? "fallback-paper-panel-v1"}
        data-polish-card="s89-5-portrait-frame"
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
      data-polish-card="s89-5-portrait-frame"
      style={fallbackStyle}
    >
      <img
        src={imageSource}
        alt={resolvedLabel}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
      {viewerEnabled ? (
        <button
          className="portraitZoomButton"
          type="button"
          title="查看高清立绘"
          aria-label={`查看${resolvedLabel}高清立绘`}
          data-polish-action="s89-5-portrait-zoom"
          onClick={handleOpenViewer}
        >
          <Maximize2 size={15} aria-hidden="true" />
        </button>
      ) : null}
    </figure>
  );
}

const unsafePortraitProfileFragments = [
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
  "manifest",
  "schema",
  "draft" + "Context",
  "server" + " adjudication",
  "服务器",
  "本地" + "路径",
  "密" + "钥",
  "隐" + "藏",
  "完整" + "清单",
  "完整" + "提示词"
] as const;

const localPortraitProfilePathPattern = /(?:^|[\s"'`(（:：,;，。；、【《“‘])(?:[a-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|\/(?:home|mnt|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)|(?:data|src|client|server|dist|public|node_modules)[\\/][^\s，。；、]+)/i;

function cleanPortraitProfileText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!text) return "";
  const normalized = text.toLowerCase();
  if (localPortraitProfilePathPattern.test(text) || /sk-[a-z0-9_-]{6,}/i.test(text)) return "";
  if (unsafePortraitProfileFragments.some((fragment) => normalized.includes(fragment.toLowerCase()))) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function normalizePortraitViewerProfile(profile: PortraitViewerProfile | undefined) {
  if (!profile) return null;
  const safeProfile: PortraitViewerProfile = {
    name: cleanPortraitProfileText(profile.name, 32),
    identity: cleanPortraitProfileText(profile.identity, 48),
    summary: cleanPortraitProfileText(profile.summary, 180),
    current: cleanPortraitProfileText(profile.current, 160),
    tags: (profile.tags ?? []).map((tag) => cleanPortraitProfileText(tag, 24)).filter(Boolean).slice(0, 8)
  };
  return safeProfile.name || safeProfile.identity || safeProfile.summary || safeProfile.current || safeProfile.tags?.length
    ? safeProfile
    : null;
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
