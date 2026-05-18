export const ASSET_MANIFEST_URL = "/assets/ui/ink-ui-manifest.json";

const DEFAULT_PORTRAIT_FALLBACK_REF = "fallback-role-silhouette-v1";
const DEFAULT_PANEL_FALLBACK_REF = "fallback-paper-panel-v1";
const forbiddenAssetPathPattern =
  /(OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/]|file:\/\/|https?:\/\/|data:|data[\\/](?:sessions|audit)|artifacts[\\/])/i;

export type InkAssetCategory = "material" | "background" | "effect" | "scene" | "role_background" | "portrait" | string;

export type AssetFallback = {
  readonly id: string;
  readonly category: "fallback";
  readonly type: "css_token" | string;
  readonly usage: readonly string[];
  readonly cssTokens: Readonly<Record<string, string>>;
  readonly reviewStatus: string;
  readonly ledgerId: string;
};

export type InkUiAssetManifestEntry = {
  readonly id: string;
  readonly version?: number;
  readonly phase?: string;
  readonly category: InkAssetCategory;
  readonly subcategory?: string;
  readonly usage?: readonly string[];
  readonly role?: string | null;
  readonly roleLabel?: string;
  readonly scene?: string | null;
  readonly path: string;
  readonly thumbnailPath?: string;
  readonly lowResPlaceholderPath?: string;
  readonly fallbackRef?: string;
  readonly reviewStatus: string;
  readonly visualReview?: { readonly status?: string };
  readonly safetyReview?: { readonly status?: string };
  readonly dimensions?: { readonly width: number; readonly height: number };
  readonly safeArea?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly focalPoint?: { readonly x: number; readonly y: number };
  readonly mobileCrop?: { readonly mode?: string; readonly keepSafeArea?: boolean; readonly notes?: string };
  readonly transparent?: boolean;
  readonly portraitRef?: string;
  readonly genderPresentation?: string;
  readonly ageBand?: string;
  readonly roleStage?: string;
  readonly statusVariant?: string;
  readonly emotionVariant?: string;
  readonly identityTags?: readonly string[];
  readonly emotionTags?: readonly string[];
  readonly lazyLoad?: {
    readonly group?: string;
    readonly allowEagerLoad?: boolean;
    readonly thumbnailFirst?: boolean;
    readonly lowResPlaceholder?: boolean;
    readonly maxInitialPortraits?: number;
  };
  readonly source?: {
    readonly localHighResSource?: string;
    readonly localHighResSourcePath?: string;
  };
};

export type InkUiManifest = {
  readonly schemaVersion: number;
  readonly assetSetId: string;
  readonly assetRoot: string;
  readonly runtimeUsableReviewStatuses: readonly string[];
  readonly runtimeBlockedReviewStatuses?: readonly string[];
  readonly fallbackCatalog: readonly AssetFallback[];
  readonly assets: readonly InkUiAssetManifestEntry[];
};

export type RuntimeAsset = {
  readonly id: string;
  readonly category: InkAssetCategory;
  readonly subcategory: string | null;
  readonly usage: readonly string[];
  readonly role: string | null;
  readonly roleLabel: string | null;
  readonly scene: string | null;
  readonly path: string;
  readonly thumbnailPath: string | null;
  readonly fallbackRef: string;
  readonly reviewStatus: string;
  readonly visualReviewStatus: string | null;
  readonly safetyReviewStatus: string | null;
  readonly dimensions: { readonly width: number; readonly height: number } | null;
  readonly safeArea: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  readonly focalPoint: { readonly x: number; readonly y: number } | null;
  readonly manifestOrder: number;
};

export type RuntimePortraitAsset = RuntimeAsset & {
  readonly category: "portrait";
  readonly portraitRef: string;
  readonly genderPresentation: string;
  readonly ageBand: string;
  readonly roleStage: string | null;
  readonly statusVariant: string;
  readonly emotionVariant: string | null;
  readonly identityTags: readonly string[];
  readonly emotionTags: readonly string[];
  readonly lowResPlaceholderPath: string;
  readonly lazyLoad: {
    readonly group: string;
    readonly allowEagerLoad: false;
    readonly thumbnailFirst: boolean;
    readonly lowResPlaceholder: boolean;
    readonly maxInitialPortraits: number;
  };
  readonly hasHighResOverride: boolean;
};

export type AssetQuery = {
  readonly id?: string;
  readonly category?: InkAssetCategory;
  readonly subcategory?: string;
  readonly usage?: string;
  readonly role?: string;
  readonly scene?: string | null;
};

export type PortraitQuery = AssetQuery & {
  readonly portraitRef?: string;
  readonly genderPresentation?: string;
  readonly ageBand?: string;
  readonly statusVariant?: string;
  readonly emotionVariant?: string;
  readonly lazyLoadGroup?: string;
  readonly identityTags?: readonly string[];
  readonly emotionTags?: readonly string[];
  readonly preferHighResOverridesForFeminine?: boolean;
};

export type AssetPreloadHint = {
  readonly rel: "preload" | "prefetch";
  readonly as: "image";
  readonly href: string;
  readonly assetId: string;
};

export type AssetRegistrySummary = {
  readonly manifestAssetCount: number;
  readonly runtimeAssetCount: number;
  readonly portraitCount: number;
  readonly blockedAssetCount: number;
  readonly fallbackCount: number;
  readonly highResOverridePortraitCount: number;
  readonly highResOverrideFeminineCount: number;
  readonly portraitLazyLoadGroups: Readonly<Record<string, number>>;
};

export type AssetRegistry = {
  readonly summary: AssetRegistrySummary;
  readonly getFallback: (fallbackRef?: string | null) => AssetFallback | null;
  readonly getAsset: (id: string) => RuntimeAsset | null;
  readonly getAssets: (query?: AssetQuery, options?: { readonly limit?: number }) => readonly RuntimeAsset[];
  readonly getPortrait: (portraitRef: string) => RuntimePortraitAsset | null;
  readonly getPortraits: (query?: PortraitQuery, options?: { readonly limit?: number }) => readonly RuntimePortraitAsset[];
  readonly getInitialPortraits: (query?: PortraitQuery, options?: { readonly limit?: number }) => readonly RuntimePortraitAsset[];
  readonly getPreloadHints: (query?: PortraitQuery, options?: { readonly limit?: number; readonly rel?: "preload" | "prefetch" }) => readonly AssetPreloadHint[];
};

export class AssetRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetRegistryError";
  }
}

let cachedRegistryPromise: Promise<AssetRegistry> | null = null;

export function resetAssetRegistryCache() {
  cachedRegistryPromise = null;
}

export async function loadAssetRegistry(options: { readonly fetcher?: typeof fetch; readonly manifestUrl?: string } = {}) {
  if (options.fetcher) {
    return fetchManifestRegistry(options.fetcher, options.manifestUrl ?? ASSET_MANIFEST_URL);
  }

  if (!cachedRegistryPromise) {
    cachedRegistryPromise = fetchManifestRegistry(globalThis.fetch, options.manifestUrl ?? ASSET_MANIFEST_URL).catch((error) => {
      cachedRegistryPromise = null;
      throw error;
    });
  }

  return cachedRegistryPromise;
}

export function createAssetRegistry(manifest: InkUiManifest): AssetRegistry {
  validateManifestHeader(manifest);

  const runtimeReviewStatuses = new Set(manifest.runtimeUsableReviewStatuses);
  const fallbackByRef = new Map(
    manifest.fallbackCatalog
      .filter((fallback) => runtimeReviewStatuses.has(fallback.reviewStatus))
      .map((fallback) => [fallback.id, fallback])
  );
  const assetById = new Map<string, RuntimeAsset>();
  const portraitByRef = new Map<string, RuntimePortraitAsset>();
  const runtimeAssets: RuntimeAsset[] = [];
  const runtimePortraits: RuntimePortraitAsset[] = [];
  let blockedAssetCount = 0;

  manifest.assets.forEach((asset, manifestOrder) => {
    if (!runtimeReviewStatuses.has(asset.reviewStatus)) {
      blockedAssetCount += 1;
      return;
    }

    const runtimeAsset = sanitizeRuntimeAsset(asset, fallbackByRef, manifestOrder);
    assetById.set(runtimeAsset.id, runtimeAsset);
    runtimeAssets.push(runtimeAsset);

    if (runtimeAsset.category === "portrait") {
      const portrait = sanitizeRuntimePortrait(asset, runtimeAsset);
      portraitByRef.set(portrait.portraitRef, portrait);
      runtimePortraits.push(portrait);
    }
  });

  const summary = buildSummary(manifest.assets.length, runtimeAssets, runtimePortraits, blockedAssetCount, fallbackByRef.size);
  const getPortraits = (query: PortraitQuery = {}, options: { readonly limit?: number } = {}) => {
    const matches = runtimePortraits.filter((portrait) => matchesPortrait(portrait, query));
    const sorted = sortPortraits(matches, query);
    return applyLimit(sorted, options.limit);
  };
  const getInitialPortraits = (query: PortraitQuery = {}, options: { readonly limit?: number } = {}) => {
    const matches = getPortraits(query);
    const manifestLimit = matches.reduce((limit, portrait) => Math.min(limit, portrait.lazyLoad.maxInitialPortraits), 8);
    return applyLimit(matches, options.limit ?? manifestLimit);
  };

  return {
    summary,
    getFallback(fallbackRef) {
      return fallbackByRef.get(fallbackRef ?? "") ?? fallbackByRef.get(DEFAULT_PORTRAIT_FALLBACK_REF) ?? fallbackByRef.get(DEFAULT_PANEL_FALLBACK_REF) ?? null;
    },
    getAsset(id) {
      return assetById.get(id) ?? null;
    },
    getAssets(query = {}, options = {}) {
      return applyLimit(runtimeAssets.filter((asset) => matchesAsset(asset, query)), options.limit);
    },
    getPortrait(portraitRef) {
      return portraitByRef.get(portraitRef) ?? null;
    },
    getPortraits,
    getInitialPortraits,
    getPreloadHints(query = {}, options = {}) {
      const rel = options.rel ?? "prefetch";
      return getInitialPortraits(query, { limit: options.limit ?? 8 }).map((portrait) => ({
        rel,
        as: "image",
        href: portrait.thumbnailPath ?? portrait.lowResPlaceholderPath,
        assetId: portrait.id
      }));
    }
  };
}

async function fetchManifestRegistry(fetcher: typeof fetch | undefined, manifestUrl: string) {
  if (typeof fetcher !== "function") {
    throw new AssetRegistryError("当前环境没有可用 fetch，无法读取前端资产 manifest。");
  }

  const response = await fetcher(manifestUrl, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new AssetRegistryError(`读取资产 manifest 失败：${response.status} ${response.statusText}`);
  }

  return createAssetRegistry((await response.json()) as InkUiManifest);
}

function validateManifestHeader(manifest: InkUiManifest) {
  if (manifest.schemaVersion !== 1) {
    throw new AssetRegistryError("不支持的前端资产 manifest schema。");
  }
  if (manifest.assetSetId !== "ink-ui-v1") {
    throw new AssetRegistryError("前端资产 manifest 不是 ink-ui-v1。");
  }
  if (!Array.isArray(manifest.assets) || !Array.isArray(manifest.fallbackCatalog)) {
    throw new AssetRegistryError("前端资产 manifest 缺少 assets 或 fallbackCatalog。");
  }
  if (!Array.isArray(manifest.runtimeUsableReviewStatuses) || manifest.runtimeUsableReviewStatuses.length === 0) {
    throw new AssetRegistryError("前端资产 manifest 缺少 runtime 可用审核状态。");
  }
}

function sanitizeRuntimeAsset(
  asset: InkUiAssetManifestEntry,
  fallbackByRef: ReadonlyMap<string, AssetFallback>,
  manifestOrder: number
): RuntimeAsset {
  assertSafeAssetPath(asset.path, `${asset.id}.path`);
  if (asset.thumbnailPath) assertSafeAssetPath(asset.thumbnailPath, `${asset.id}.thumbnailPath`);

  const fallbackRef = asset.fallbackRef ?? DEFAULT_PANEL_FALLBACK_REF;
  if (!fallbackByRef.has(fallbackRef)) {
    throw new AssetRegistryError(`${asset.id} 的 fallbackRef 未指向可用 fallback：${fallbackRef}`);
  }

  return {
    id: asset.id,
    category: asset.category,
    subcategory: asset.subcategory ?? null,
    usage: [...(asset.usage ?? [])],
    role: asset.role ?? null,
    roleLabel: asset.roleLabel ?? null,
    scene: asset.scene ?? null,
    path: asset.path,
    thumbnailPath: asset.thumbnailPath ?? null,
    fallbackRef,
    reviewStatus: asset.reviewStatus,
    visualReviewStatus: asset.visualReview?.status ?? null,
    safetyReviewStatus: asset.safetyReview?.status ?? null,
    dimensions: asset.dimensions ?? null,
    safeArea: asset.safeArea ?? null,
    focalPoint: asset.focalPoint ?? null,
    manifestOrder
  };
}

function sanitizeRuntimePortrait(asset: InkUiAssetManifestEntry, runtimeAsset: RuntimeAsset): RuntimePortraitAsset {
  if (asset.category !== "portrait") {
    throw new AssetRegistryError(`${asset.id} 不是 portrait 资产。`);
  }
  if (!asset.portraitRef || asset.portraitRef !== asset.id) {
    throw new AssetRegistryError(`${asset.id} 缺少稳定 portraitRef。`);
  }
  if (!asset.thumbnailPath || !asset.lowResPlaceholderPath) {
    throw new AssetRegistryError(`${asset.id} 缺少缩略图或低清占位。`);
  }
  assertSafeAssetPath(asset.lowResPlaceholderPath, `${asset.id}.lowResPlaceholderPath`);

  if (asset.lazyLoad?.allowEagerLoad !== false) {
    throw new AssetRegistryError(`${asset.id} 不允许进入 eager load 立绘池。`);
  }

  const maxInitialPortraits = asset.lazyLoad?.maxInitialPortraits ?? 8;
  if (!Number.isFinite(maxInitialPortraits) || maxInitialPortraits < 1 || maxInitialPortraits > 8) {
    throw new AssetRegistryError(`${asset.id} 的 maxInitialPortraits 必须在 1..8。`);
  }

  return {
    ...runtimeAsset,
    category: "portrait",
    portraitRef: asset.portraitRef,
    genderPresentation: asset.genderPresentation ?? "unknown",
    ageBand: asset.ageBand ?? "adult_unknown",
    roleStage: asset.roleStage ?? null,
    statusVariant: asset.statusVariant ?? "baseline",
    emotionVariant: asset.emotionVariant ?? null,
    identityTags: [...(asset.identityTags ?? [])],
    emotionTags: [...(asset.emotionTags ?? [])],
    lowResPlaceholderPath: asset.lowResPlaceholderPath,
    lazyLoad: {
      group: asset.lazyLoad?.group ?? "portrait_uncategorized",
      allowEagerLoad: false,
      thumbnailFirst: asset.lazyLoad?.thumbnailFirst !== false,
      lowResPlaceholder: asset.lazyLoad?.lowResPlaceholder !== false,
      maxInitialPortraits
    },
    hasHighResOverride: asset.source?.localHighResSource === "kept_outside_public_manifest"
  };
}

function assertSafeAssetPath(assetPath: string, label: string) {
  if (!assetPath.startsWith("/assets/ui/")) {
    throw new AssetRegistryError(`${label} 必须位于 /assets/ui/ 下。`);
  }
  if (assetPath.includes("..") || forbiddenAssetPathPattern.test(assetPath)) {
    throw new AssetRegistryError(`${label} 包含不允许的远程、本地、artifacts 或敏感路径。`);
  }
}

function matchesAsset(asset: RuntimeAsset, query: AssetQuery) {
  if (query.id && asset.id !== query.id) return false;
  if (query.category && asset.category !== query.category) return false;
  if (query.subcategory && asset.subcategory !== query.subcategory) return false;
  if (query.usage && !asset.usage.includes(query.usage)) return false;
  if (query.role && asset.role !== query.role) return false;
  if (query.scene !== undefined && asset.scene !== query.scene) return false;
  return true;
}

function matchesPortrait(portrait: RuntimePortraitAsset, query: PortraitQuery) {
  if (!matchesAsset(portrait, query)) return false;
  if (query.portraitRef && portrait.portraitRef !== query.portraitRef) return false;
  if (query.genderPresentation && portrait.genderPresentation !== query.genderPresentation) return false;
  if (query.ageBand && portrait.ageBand !== query.ageBand) return false;
  if (query.statusVariant && portrait.statusVariant !== query.statusVariant) return false;
  if (query.emotionVariant && portrait.emotionVariant !== query.emotionVariant) return false;
  if (query.lazyLoadGroup && portrait.lazyLoad.group !== query.lazyLoadGroup) return false;
  if (query.identityTags?.some((tag) => !portrait.identityTags.includes(tag))) return false;
  if (query.emotionTags?.some((tag) => !portrait.emotionTags.includes(tag))) return false;
  return true;
}

function sortPortraits(portraits: readonly RuntimePortraitAsset[], query: PortraitQuery) {
  const shouldPreferFeminineOverrides = query.preferHighResOverridesForFeminine ?? query.genderPresentation === "feminine";
  return [...portraits].sort((left, right) => {
    if (shouldPreferFeminineOverrides) {
      const leftRank = feminineOverrideRank(left);
      const rightRank = feminineOverrideRank(right);
      if (leftRank !== rightRank) return leftRank - rightRank;
    }
    return left.manifestOrder - right.manifestOrder;
  });
}

function feminineOverrideRank(portrait: RuntimePortraitAsset) {
  if (portrait.genderPresentation !== "feminine") return 2;
  return portrait.hasHighResOverride ? 0 : 1;
}

function applyLimit<T>(items: readonly T[], limit?: number) {
  if (limit == null) return items;
  return items.slice(0, Math.max(0, limit));
}

function buildSummary(
  manifestAssetCount: number,
  runtimeAssets: readonly RuntimeAsset[],
  runtimePortraits: readonly RuntimePortraitAsset[],
  blockedAssetCount: number,
  fallbackCount: number
): AssetRegistrySummary {
  const portraitLazyLoadGroups: Record<string, number> = {};
  let highResOverridePortraitCount = 0;
  let highResOverrideFeminineCount = 0;

  for (const portrait of runtimePortraits) {
    portraitLazyLoadGroups[portrait.lazyLoad.group] = (portraitLazyLoadGroups[portrait.lazyLoad.group] ?? 0) + 1;
    if (portrait.hasHighResOverride) {
      highResOverridePortraitCount += 1;
      if (portrait.genderPresentation === "feminine") highResOverrideFeminineCount += 1;
    }
  }

  return {
    manifestAssetCount,
    runtimeAssetCount: runtimeAssets.length,
    portraitCount: runtimePortraits.length,
    blockedAssetCount,
    fallbackCount,
    highResOverridePortraitCount,
    highResOverrideFeminineCount,
    portraitLazyLoadGroups
  };
}
