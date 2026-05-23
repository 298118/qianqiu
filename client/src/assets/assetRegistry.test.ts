import { describe, expect, it } from "vitest";
import committedManifest from "../../../public/assets/ui/ink-ui-manifest.json";
import runtimeManifest from "../../../public/assets/ui/ink-ui-runtime-manifest.json";
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

function lazyLoadFixture(overrides: Partial<NonNullable<InkUiAssetManifestEntry["lazyLoad"]>> = {}) {
  return {
    group: "portrait_pool_generic_npc_s73_10",
    allowEagerLoad: false,
    thumbnailFirst: true,
    lowResPlaceholder: true,
    maxInitialPortraits: 8,
    ...overrides
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

  it("S88.11 rejects duplicate manifest identities before address maps can be overwritten", () => {
    const first = portraitFixture();
    const duplicateId = portraitFixture({
      role: "teacher",
      roleLabel: "塾师"
    });
    const blockedDuplicateId = portraitFixture({
      reviewStatus: "review_pending",
      path: "https://example.test/blocked-but-duplicate.webp"
    });
    const duplicatePortraitRef = portraitFixture({
      id: "portrait-test-other-id-v1",
      portraitRef: "portrait-test-female-v1",
      path: "/assets/ui/portraits/portrait-test-other-id-v1.webp",
      thumbnailPath: "/assets/ui/thumbs/thumb-portrait-test-other-id-v1.webp",
      lowResPlaceholderPath: "/assets/ui/portraits/placeholders/placeholder-portrait-test-other-id-v1.webp"
    });

    expect(() => createAssetRegistry(manifestFixture([first, duplicateId]))).toThrow(/重复 asset id/);
    expect(() => createAssetRegistry(manifestFixture([first, blockedDuplicateId]))).toThrow(/重复 asset id/);
    expect(() => createAssetRegistry(manifestFixture([first, duplicatePortraitRef]))).toThrow(/重复 portraitRef/);
  });

  it("S88.11 rejects portraits without explicit adult metadata and thumbnail-first lazy loading", () => {
    expect(() => createAssetRegistry(manifestFixture([portraitFixture({ ageBand: "teen" })]))).toThrow(/成年立绘/);
    expect(() => createAssetRegistry(manifestFixture([portraitFixture({ statusVariant: undefined })]))).toThrow(/显式立绘/);
    expect(() => createAssetRegistry(manifestFixture([portraitFixture({ lazyLoad: lazyLoadFixture({ thumbnailFirst: false }) })]))).toThrow(/缩略图优先/);
    expect(() => createAssetRegistry(manifestFixture([portraitFixture({ lazyLoad: lazyLoadFixture({ lowResPlaceholder: false }) })]))).toThrow(/低清占位/);
    expect(() => createAssetRegistry(manifestFixture([portraitFixture({ lazyLoad: lazyLoadFixture({ group: undefined }) })]))).toThrow(/懒加载分组/);
  });

  it("S88.11 keeps signature NPC portraits out of the generic NPC runtime pool", () => {
    const generic = portraitFixture({
      id: "portrait-test-generic-commoner-v1",
      portraitRef: "portrait-test-generic-commoner-v1",
      subcategory: "generic_npc_pool",
      role: "commoner",
      identityTags: ["generic_npc"]
    });
    const signature = portraitFixture({
      id: "portrait-test-signature-emperor-v1",
      portraitRef: "portrait-test-signature-emperor-v1",
      subcategory: "signature_npc_pool",
      usage: ["signature_npc", "people_page", "court_or_story_scene"],
      role: "emperor",
      identityTags: ["signature_npc", "important_npc"],
      lazyLoad: lazyLoadFixture({ group: "portrait_pool_signature_npc_s73_10" })
    });
    const registry = createAssetRegistry(manifestFixture([generic, signature]));

    expect(registry.getPortrait("portrait-test-signature-emperor-v1")?.subcategory).toBe("signature_npc_pool");
    expect(registry.getPortraits({
      usage: "people_page",
      subcategory: "generic_npc_pool",
      lazyLoadGroup: "portrait_pool_generic_npc_s73_10"
    }).map((portrait) => portrait.portraitRef)).toEqual(["portrait-test-generic-commoner-v1"]);
    expect(() => createAssetRegistry(manifestFixture([
      portraitFixture({
        id: "portrait-test-signature-leak-v1",
        portraitRef: "portrait-test-signature-leak-v1",
        subcategory: "signature_npc_pool",
        lazyLoad: lazyLoadFixture()
      })
    ]))).toThrow(/分组与 subcategory 不一致/);
  });

  it("S88.11 clamps caller preload limits to the manifest portrait lazy-load budget", () => {
    const first = portraitFixture({
      id: "portrait-test-first-v1",
      portraitRef: "portrait-test-first-v1",
      lazyLoad: lazyLoadFixture({ maxInitialPortraits: 3 })
    });
    const portraits = Array.from({ length: 6 }, (_, index) => portraitFixture({
      id: `portrait-test-extra-${index}-v1`,
      portraitRef: `portrait-test-extra-${index}-v1`,
      path: `/assets/ui/portraits/portrait-test-extra-${index}-v1.webp`,
      thumbnailPath: `/assets/ui/thumbs/thumb-portrait-test-extra-${index}-v1.webp`,
      lowResPlaceholderPath: `/assets/ui/portraits/placeholders/placeholder-portrait-test-extra-${index}-v1.webp`
    }));
    const registry = createAssetRegistry(manifestFixture([first, ...portraits]));

    expect(registry.getInitialPortraits({ usage: "people_page" }, { limit: 20 })).toHaveLength(3);
    expect(registry.getPreloadHints({ usage: "people_page" }, { limit: 20 })).toHaveLength(3);
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

    expect(registry.summary.manifestAssetCount).toBe(836);
    expect(registry.summary.portraitCount).toBe(790);
    expect(registry.summary.highResOverrideFeminineCount).toBe(254);
    expect(registry.summary.portraitLazyLoadGroups).toMatchObject({
      portrait_pool_player_s73_10: 72,
      portrait_pool_generic_npc_s73_10: 188,
      portrait_pool_young_female_s73_10_7: 48,
      portrait_pool_recovered_female_s79_2: 194
    });
    expect(allPortraits).toHaveLength(790);
    expect(allPortraits.every((portrait) => portrait.path.startsWith("/assets/ui/"))).toBe(true);
    expect(allPortraits.every((portrait) => !/artifacts|portrait-pool-matrix/i.test(portrait.path))).toBe(true);
    expect(feminine[0].hasHighResOverride).toBe(true);
    expect(feminine.some((portrait) => !portrait.hasHighResOverride)).toBe(true);
    expect(initialPeoplePortraits).toHaveLength(8);
    expect(preloadHints).toHaveLength(8);
    expect(preloadHints.every((hint) => hint.href.includes("/assets/ui/thumbs/"))).toBe(true);
  });

  it("loads the compact runtime manifest with the same portrait addressability", () => {
    const sourceRegistry = createAssetRegistry(committedManifest as unknown as InkUiManifest);
    const runtimeRegistry = createAssetRegistry(runtimeManifest as unknown as InkUiManifest);

    expect(runtimeRegistry.summary.manifestAssetCount).toBe(sourceRegistry.summary.manifestAssetCount);
    expect(runtimeRegistry.summary.runtimeAssetCount).toBe(sourceRegistry.summary.runtimeAssetCount);
    expect(runtimeRegistry.summary.portraitCount).toBe(sourceRegistry.summary.portraitCount);
    expect(runtimeRegistry.getInitialPortraits({ usage: "people_page" })).toHaveLength(8);
    expect(runtimeRegistry.getAsset("ui-home-scroll-landscape-v1")?.path).toBe("/assets/ui/home/home-scroll-landscape-v1.webp");
    expect(runtimeRegistry.getPortrait("portrait-player-scholar-f01-v1")?.path).toBe("/assets/ui/portraits/portrait-player-scholar-f01-v1.webp");
  });
});
