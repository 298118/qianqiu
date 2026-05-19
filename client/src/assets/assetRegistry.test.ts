import { describe, expect, it } from "vitest";
import committedManifest from "../../../public/assets/ui/ink-ui-manifest.json";
import {
  AssetRegistryError,
  createAssetRegistry,
  type InkUiManifest,
  type InkUiAssetManifestEntry
} from "./assetRegistry";

const fallbackCatalog = [
  {
    id: "fallback-paper-panel-v1",
    category: "fallback",
    type: "css_token",
    usage: ["global_fallback"],
    cssTokens: { backgroundColor: "#f5f0e6", borderColor: "#c9b898", textColor: "#241f18" },
    reviewStatus: "approved",
    ledgerId: "ui-fallback-paper-panel-v1"
  },
  {
    id: "fallback-role-silhouette-v1",
    category: "fallback",
    type: "css_token",
    usage: ["people_page", "game_main"],
    cssTokens: { backgroundColor: "#e8dcc8", accentColor: "#a53a2a", textColor: "#241f18" },
    reviewStatus: "approved",
    ledgerId: "ui-fallback-role-silhouette-v1"
  }
] as const;

function portraitFixture(overrides: Partial<InkUiAssetManifestEntry> = {}): InkUiAssetManifestEntry {
  const id = overrides.id ?? "portrait-test-female-v1";
  return {
    id,
    category: "portrait",
    subcategory: "generic_npc_pool",
    usage: ["people_page", "game_main"],
    role: "female_official",
    roleLabel: "女官",
    scene: null,
    path: `/assets/ui/portraits/${id}.webp`,
    thumbnailPath: `/assets/ui/thumbs/thumb-${id}.webp`,
    lowResPlaceholderPath: `/assets/ui/portraits/placeholders/placeholder-${id}.webp`,
    fallbackRef: "fallback-role-silhouette-v1",
    reviewStatus: "approved",
    visualReview: { status: "approved" },
    safetyReview: { status: "approved" },
    dimensions: { width: 1024, height: 1536 },
    safeArea: { x: 0.2, y: 0.06, width: 0.6, height: 0.86 },
    focalPoint: { x: 0.5, y: 0.26 },
    portraitRef: id,
    genderPresentation: "feminine",
    ageBand: "adult_young",
    statusVariant: "baseline",
    emotionVariant: "neutral",
    identityTags: ["female_style"],
    emotionTags: ["neutral"],
    lazyLoad: {
      group: "portrait_pool_generic_npc_s73_10",
      allowEagerLoad: false,
      thumbnailFirst: true,
      lowResPlaceholder: true,
      maxInitialPortraits: 8
    },
    ...overrides
  };
}

function manifestFixture(assets: readonly InkUiAssetManifestEntry[]): InkUiManifest {
  return {
    schemaVersion: 1,
    assetSetId: "ink-ui-v1",
    assetRoot: "/assets/ui/",
    runtimeUsableReviewStatuses: ["approved", "approved_with_limits"],
    runtimeBlockedReviewStatuses: ["planned", "draft", "review_pending", "rejected", "replaced"],
    fallbackCatalog,
    assets
  };
}

describe("S74.5 asset registry", () => {
  it("filters unapproved assets and keeps all approved portrait refs addressable", () => {
    const approved = portraitFixture();
    const blocked = portraitFixture({
      id: "portrait-test-blocked-v1",
      portraitRef: "portrait-test-blocked-v1",
      reviewStatus: "review_pending",
      path: "https://example.test/not-used.webp"
    });
    const registry = createAssetRegistry(manifestFixture([approved, blocked]));

    expect(registry.summary.manifestAssetCount).toBe(2);
    expect(registry.summary.portraitCount).toBe(1);
    expect(registry.summary.blockedAssetCount).toBe(1);
    expect(registry.getPortrait("portrait-test-female-v1")?.thumbnailPath).toBe("/assets/ui/thumbs/thumb-portrait-test-female-v1.webp");
    expect(registry.getPortrait("portrait-test-blocked-v1")).toBeNull();
  });

  it("rejects active manifest paths that point outside public UI assets", () => {
    const unsafe = portraitFixture({ path: "C:/Users/dev/artifacts/source.png" });

    expect(() => createAssetRegistry(manifestFixture([unsafe]))).toThrow(AssetRegistryError);
  });

  it("rejects active manifest entries that expose local high resolution source paths", () => {
    const unsafe = portraitFixture({
      source: {
        localHighResSource: "kept_outside_public_manifest",
        localHighResSourcePath: "E:\\LSMNQ\\artifacts\\portrait-source.png"
      }
    });

    expect(() => createAssetRegistry(manifestFixture([unsafe]))).toThrow(AssetRegistryError);
  });

  it("prefers remastered feminine portraits while keeping original feminine portraits available", () => {
    const remastered = portraitFixture({
      id: "portrait-test-female-remastered-v1",
      portraitRef: "portrait-test-female-remastered-v1",
      source: { localHighResSource: "kept_outside_public_manifest" }
    });
    const original = portraitFixture({
      id: "portrait-test-female-original-v1",
      portraitRef: "portrait-test-female-original-v1"
    });
    const male = portraitFixture({
      id: "portrait-test-male-v1",
      portraitRef: "portrait-test-male-v1",
      genderPresentation: "masculine",
      identityTags: ["male_style"]
    });
    const registry = createAssetRegistry(manifestFixture([original, male, remastered]));
    const feminine = registry.getPortraits({ genderPresentation: "feminine" });

    expect(feminine.map((portrait) => portrait.portraitRef)).toEqual([
      "portrait-test-female-remastered-v1",
      "portrait-test-female-original-v1"
    ]);
    expect(registry.getPortraits().map((portrait) => portrait.portraitRef)).toContain("portrait-test-male-v1");
  });

  it("loads the committed manifest without treating matrix-only or local artifact paths as runtime assets", () => {
    const registry = createAssetRegistry(committedManifest as unknown as InkUiManifest);
    const allPortraits = registry.getPortraits();
    const feminine = registry.getPortraits({ genderPresentation: "feminine" });
    const initialPeoplePortraits = registry.getInitialPortraits({ usage: "people_page", preferHighResOverridesForFeminine: true });
    const preloadHints = registry.getPreloadHints({ usage: "people_page", preferHighResOverridesForFeminine: true });

    expect(registry.summary.manifestAssetCount).toBe(642);
    expect(registry.summary.portraitCount).toBe(596);
    expect(registry.summary.highResOverrideFeminineCount).toBe(60);
    expect(registry.summary.portraitLazyLoadGroups).toMatchObject({
      portrait_pool_player_s73_10: 72,
      portrait_pool_generic_npc_s73_10: 188,
      portrait_pool_young_female_s73_10_7: 48
    });
    expect(allPortraits).toHaveLength(596);
    expect(allPortraits.every((portrait) => portrait.path.startsWith("/assets/ui/"))).toBe(true);
    expect(allPortraits.every((portrait) => !/artifacts|portrait-pool-matrix/i.test(portrait.path))).toBe(true);
    expect(feminine[0].hasHighResOverride).toBe(true);
    expect(feminine.some((portrait) => !portrait.hasHighResOverride)).toBe(true);
    expect(initialPeoplePortraits).toHaveLength(8);
    expect(preloadHints).toHaveLength(8);
    expect(preloadHints.every((hint) => hint.href.includes("/assets/ui/thumbs/"))).toBe(true);
  });
});
