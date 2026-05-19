const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const ledgerPath = path.join(repoRoot, "docs", "FRONTEND_ASSET_LEDGER.md");
const homeTransparencyQaPath = path.join(repoRoot, "public", "assets", "ui", "home", "home-transparency-qa-v1.json");
const portraitBaselineQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-baseline-qa-v1.json");
const portraitPlayerPoolQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-player-pool-qa-v1.json");
const portraitPlayerFemaleResetQaPath = path.join(
  repoRoot,
  "public",
  "assets",
  "ui",
  "portraits",
  "portrait-player-female-reset-qa-v1.json"
);
const portraitPlayerMaleExtraQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-player-male-extra-qa-v1.json");
const portraitGenericNpcPoolQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-generic-npc-pool-qa-v1.json");
const portraitSignatureNpcPoolQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-signature-npc-pool-qa-v1.json");
const portraitStateScenePoolQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-state-scene-pool-qa-v1.json");
const portraitYoungFemalePoolQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-young-female-pool-qa-v1.json");
const portraitRecoveredFemalePoolQaPath = path.join(
  repoRoot,
  "public",
  "assets",
  "ui",
  "portraits",
  "portrait-recovered-female-pool-qa-v1.json"
);
const portraitCompressionQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-compression-qa-v1.json");
const portraitSingleOverrideQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-single-override-qa-v1.json");
const effectMotionQaPath = path.join(repoRoot, "public", "assets", "ui", "effects", "effect-motion-qa-v1.json");
const assetQaReportPath = path.join(repoRoot, "public", "assets", "ui", "asset-qa-report-v1.json");
const assetQaPreviewPath = path.join(repoRoot, "public", "assets", "ui", "asset-qa-preview.html");
const assetQaScriptPath = path.join(repoRoot, "scripts", "frontendAssetQa.js");
const portraitPoolMatrixPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-pool-matrix-v1.json");
const portraitMatrixDocPath = path.join(repoRoot, "docs", "FRONTEND_PORTRAIT_MATRIX.md");
const portraitMatrixScriptPath = path.join(repoRoot, "scripts", "frontendPortraitMatrix.js");
const portraitCompressionQaScriptPath = path.join(repoRoot, "scripts", "frontendPortraitCompressionQa.js");
const portraitYoungFemaleScriptPath = path.join(repoRoot, "scripts", "frontendYoungFemalePortraitAssets.js");

const FORBIDDEN_SECRET_OR_LOCAL_PATH =
  /(OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/]|file:\/\/|data:|data[\\/](?:sessions|audit))/i;

const FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH =
  /(OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/]|file:\/\/|https?:\/\/|data:|data[\\/](?:sessions|audit))/i;

const FORBIDDEN_ASSET_VALUE =
  /(world_sessions|prompt_retrieval_index|event_log|hiddenNotes|hiddenIntent|raw[_ -]?(?:table|prompt|provider|audit|coordinate)|完整 prompt 原文：)/i;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertNoForbiddenAssetValues(value, label = "manifest") {
  if (value == null) return;
  if (typeof value === "string") {
    assert.doesNotMatch(value, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH, label);
    assert.doesNotMatch(value, FORBIDDEN_ASSET_VALUE, label);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenAssetValues(item, `${label}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      assertNoForbiddenAssetValues(nestedValue, `${label}.${key}`);
    }
  }
}

function assertSafeUiAssetPath(assetPath, fieldName) {
  if (assetPath == null || assetPath === "不适用") return;
  assert.equal(typeof assetPath, "string", fieldName);
  assert.equal(assetPath.startsWith("/assets/ui/"), true, fieldName);
  assert.equal(assetPath.includes(".."), false, fieldName);
  assert.equal(/^https?:\/\//i.test(assetPath), false, fieldName);
  assert.equal(/^file:\/\//i.test(assetPath), false, fieldName);
  assert.equal(/^data:/i.test(assetPath), false, fieldName);
}

function resolveUiAssetPath(assetPath) {
  assertSafeUiAssetPath(assetPath, assetPath);
  return path.join(repoRoot, "public", assetPath.replace(/^\//, ""));
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function readWebpInfo(buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (chunk === "VP8X") {
      const flags = buffer.readUInt8(data);
      return {
        width: readUInt24LE(buffer, data + 4) + 1,
        height: readUInt24LE(buffer, data + 7) + 1,
        alpha: Boolean(flags & 0x10)
      };
    }
    if (chunk === "VP8 ") {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
        alpha: false
      };
    }
    if (chunk === "VP8L") {
      const b0 = buffer[data + 1];
      const b1 = buffer[data + 2];
      const b2 = buffer[data + 3];
      const b3 = buffer[data + 4];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
        alpha: true
      };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("Unsupported WebP encoding");
}

function readImageInfo(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (filePath.endsWith(".webp")) return readWebpInfo(buffer);
  throw new Error(`Unsupported S73 UI image type: ${filePath}`);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function isSinglePortraitOverride(asset) {
  return (
    asset?.source?.localHighResSource === "kept_outside_public_manifest" ||
    asset?.source?.localHighResSourcePath?.startsWith("artifacts/s73-10-single-portrait-overrides/")
  );
}

test("S73.2 ink UI manifest fixes schema, safety, fallback, and portrait policies", () => {
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  assert.doesNotMatch(manifestText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  const manifest = JSON.parse(manifestText);
  assertNoForbiddenAssetValues(manifest.assets, "assets");

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.assetSetId, "ink-ui-v1");
  assert.equal(["schema_draft", "assets_active"].includes(manifest.status), true);
  assert.equal(manifest.phase, "S73");
  assert.equal(manifest.style, "ink-wash-hand-drawn-xuan-paper");
  assert.equal(manifest.assetRoot, "/assets/ui/");
  assert.equal(manifest.guideRef, "docs/FRONTEND_VISUAL_ASSET_GUIDE.md");
  assert.equal(manifest.ledgerRef, "docs/FRONTEND_ASSET_LEDGER.md");
  assert.deepEqual(manifest.pathPolicy, {
    allowedPrefix: "/assets/ui/",
    disallowRemoteUrls: true,
    disallowParentTraversal: true,
    disallowAbsoluteLocalPaths: true
  });
  assert.equal(manifest.reviewPolicy.requiresCodexVisualReview, true);
  assert.equal(manifest.portraitPolicy.portraitRefPrefix, "portrait-");
  assert.equal(manifest.portraitPolicy.baseRequiredFieldsRef, "requiredAssetFields");
  assert.equal(manifest.portraitPolicy.extensionRequiredFieldsRef, "requiredPortraitFields");
  assert.equal(manifest.portraitPolicy.lazyLoadOnly, true);

  assert.deepEqual(manifest.runtimeUsableReviewStatuses, ["approved", "approved_with_limits"]);
  for (const blockedStatus of ["planned", "draft", "review_pending", "rejected", "replaced"]) {
    assert.equal(manifest.runtimeBlockedReviewStatuses.includes(blockedStatus), true, blockedStatus);
    assert.equal(manifest.runtimeUsableReviewStatuses.includes(blockedStatus), false, blockedStatus);
  }

  for (const field of [
    "path",
    "thumbnailPath",
    "fallbackRef",
    "safeArea",
    "focalPoint",
    "mobileCrop",
    "reviewStatus",
    "visualReview",
    "safetyReview",
    "performance",
    "ledgerId"
  ]) {
    assert.equal(manifest.requiredAssetFields.includes(field), true, field);
  }

  for (const field of [
    "portraitRef",
    "genderPresentation",
    "ageBand",
    "statusVariant",
    "thumbnailPath",
    "lowResPlaceholderPath",
    "fallbackRef",
    "lazyLoad",
    "reviewStatus",
    "ledgerId"
  ]) {
    assert.equal(manifest.requiredPortraitFields.includes(field), true, field);
  }

  const fallbackIds = new Set();
  for (const fallback of manifest.fallbackCatalog) {
    fallbackIds.add(fallback.id);
    assert.equal(fallback.reviewStatus, "approved", fallback.id);
    assert.equal(fallback.ledgerId.startsWith("ui-fallback-"), true, fallback.id);
    assert.equal(fallback.category, "fallback", fallback.id);
    assert.equal(fallback.type, "css_token", fallback.id);
  }
  assert.equal(fallbackIds.has("fallback-paper-panel-v1"), true);
  assert.equal(fallbackIds.has("fallback-role-silhouette-v1"), true);
  assert.equal(fallbackIds.has("fallback-ink-motion-static-v1"), true);

  const s7310 = manifest.plannedAssetGroups.find((group) => group.phase === "S73.10");
  assert.ok(s7310);
  assert.equal(s7310.category, "portrait");
  assert.equal(s7310.subcategory, "full_portrait_pool");
  assert.equal(s7310.targetCount.min, 300);
  assert.equal(s7310.targetCount.max, 400);
  assert.equal(s7310.baseRequiredFieldsRef, "requiredAssetFields");
  assert.equal(s7310.requiredFieldsRef, "requiredPortraitFields");
  assert.equal(s7310.defaultFallbackRef, "fallback-role-silhouette-v1");
  assert.equal(fallbackIds.has(s7310.defaultFallbackRef), true);
  assert.deepEqual(s7310.loadingPolicy, {
    lazyLoad: true,
    allowEagerLoad: false,
    thumbnailFirst: true,
    lowResPlaceholder: true,
    maxInitialPortraits: 8
  });

  assert.equal(Array.isArray(manifest.assets), true);
  assert.equal(manifest.assets.length, 836, "S73.3-S79.2 UI assets are active");

  const phaseCounts = manifest.assets.reduce((counts, asset) => {
    counts[asset.phase] = (counts[asset.phase] || 0) + 1;
    return counts;
  }, {});
  assert.equal(phaseCounts["S73.3"], 16);
  assert.equal(phaseCounts["S73.4"], 6);
  assert.equal(phaseCounts["S73.5"], 10);
  assert.equal(phaseCounts["S73.6"], 6);
  assert.equal(phaseCounts["S73.7"], 24);
  assert.equal(phaseCounts["S73.8"], 8);
  assert.equal(phaseCounts["S73.10.2"], 192);
  assert.equal(phaseCounts["S73.10.3"], 188);
  assert.equal(phaseCounts["S73.10.4"], 72);
  assert.equal(phaseCounts["S73.10.5"], 72);
  assert.equal(phaseCounts["S73.10.7"], 48);
  assert.equal(phaseCounts["S79.2"], 194);

  for (const asset of manifest.assets) {
    assert.equal(
      [
        "S73.3",
        "S73.4",
        "S73.5",
        "S73.6",
        "S73.7",
        "S73.8",
        "S73.10.2",
        "S73.10.3",
        "S73.10.4",
        "S73.10.5",
        "S73.10.7",
        "S79.2"
      ].includes(
        asset.phase
      ),
      true,
      asset.id
    );
    assert.equal(manifest.allowedCategories.includes(asset.category), true, asset.id);
    if (asset.phase === "S73.3") assert.equal(asset.category, "material", asset.id);
    if (asset.phase === "S73.4") assert.equal(asset.usage.includes("home"), true, asset.id);
    if (asset.phase === "S73.5") {
      assert.equal(asset.category, "scene", asset.id);
      assert.equal(asset.dimensions.width, 1920, asset.id);
      assert.equal(asset.dimensions.height, 1080, asset.id);
      assert.equal(asset.transparent, false, asset.id);
      assert.equal(asset.reducedMotionFallback, "fallback-ink-motion-static-v1", asset.id);
      assert.equal(typeof asset.scene, "string", asset.id);
    }
    if (asset.phase === "S73.6") {
      assert.equal(asset.category, "role_background", asset.id);
      assert.equal(asset.dimensions.width, 1800, asset.id);
      assert.equal(asset.dimensions.height, 1200, asset.id);
      assert.equal(asset.transparent, false, asset.id);
      assert.equal(asset.fallbackRef, "fallback-paper-panel-v1", asset.id);
      assert.equal(asset.reducedMotionFallback, "fallback-ink-motion-static-v1", asset.id);
      assert.equal(manifest.roleCatalog.includes(asset.role), true, asset.id);
      assert.equal(typeof asset.roleStyle, "object", asset.id);
      assert.equal(typeof asset.roleStyle.colorWeightsPercent, "object", asset.id);
      assert.equal(Array.isArray(asset.roleStyle.panelMaterials), true, asset.id);
      assert.equal(Array.isArray(asset.roleStyle.avoid), true, asset.id);
    }
    if (asset.phase === "S73.7") {
      assert.equal(asset.category, "portrait", asset.id);
      assert.equal(asset.subcategory, "portrait_style_baseline", asset.id);
      assert.equal(asset.dimensions.width, 1024, asset.id);
      assert.equal(asset.dimensions.height, 1536, asset.id);
      assert.equal(asset.transparent, false, asset.id);
      assert.equal(asset.portraitRef, asset.id, asset.id);
      assert.equal(asset.portraitRef.startsWith(manifest.portraitPolicy.portraitRefPrefix), true, asset.id);
      assert.equal(manifest.roleCatalog.includes(asset.role), true, asset.id);
      assert.equal(["masculine", "feminine"].includes(asset.genderPresentation), true, asset.id);
      assert.equal(asset.ageBand.startsWith("adult"), true, asset.id);
      assert.equal(asset.statusVariant, "baseline", asset.id);
      assert.equal(Array.isArray(asset.identityTags), true, asset.id);
      assert.equal(Array.isArray(asset.emotionTags), true, asset.id);
      assertSafeUiAssetPath(asset.lowResPlaceholderPath, `${asset.id}.lowResPlaceholderPath`);
      assert.equal(asset.fallbackRef, "fallback-role-silhouette-v1", asset.id);
      assert.deepEqual(asset.lazyLoad, {
        group: "portrait_baseline_s73_7",
        allowEagerLoad: false,
        thumbnailFirst: true,
        lowResPlaceholder: true,
        maxInitialPortraits: 8
      });
      const placeholderPath = resolveUiAssetPath(asset.lowResPlaceholderPath);
      assert.equal(fs.existsSync(placeholderPath), true, asset.lowResPlaceholderPath);
      const placeholderInfo = readImageInfo(placeholderPath);
      assert.equal(placeholderInfo.width, 64, asset.id);
      assert.equal(placeholderInfo.height, 96, asset.id);
      assert.equal(asset.performance.lowResPlaceholderBytes, fs.statSync(placeholderPath).size, asset.id);
      assert.equal(asset.performance.thumbnailBytes <= asset.performance.thumbnailTargetMaxBytes, true, asset.id);
    }
    if (asset.phase === "S73.10.2") {
      assert.equal(asset.category, "portrait", asset.id);
      assert.equal(["player_identity_stage_pool", "player_female_style_pool", "player_male_style_pool"].includes(asset.subcategory), true, asset.id);
      assert.equal(asset.dimensions.width, 1024, asset.id);
      assert.equal(asset.dimensions.height, 1536, asset.id);
      assert.equal(asset.transparent, false, asset.id);
      assert.equal(asset.portraitRef, asset.id, asset.id);
      assert.equal(asset.portraitRef.startsWith("portrait-s73-10-player-"), true, asset.id);
      assert.equal(manifest.roleCatalog.includes(asset.role), true, asset.id);
      assert.equal(["masculine", "feminine"].includes(asset.genderPresentation), true, asset.id);
      assert.equal(asset.ageBand.startsWith("adult"), true, asset.id);
      if (asset.subcategory === "player_identity_stage_pool") {
        assert.equal(["baseline", "formal", "travel_or_duty"].includes(asset.statusVariant), true, asset.id);
        assert.equal(asset.lazyLoad.group, "portrait_pool_player_s73_10", asset.id);
      } else if (asset.subcategory === "player_female_style_pool") {
        assert.equal(asset.subcategory, "player_female_style_pool", asset.id);
        assert.equal(asset.genderPresentation, "feminine", asset.id);
        assert.equal(
          ["baseline", "formal", "working", "travel_or_motion", "quiet_authority", "poised"].includes(asset.statusVariant),
          true,
          asset.id
        );
        assert.equal(asset.lazyLoad.group, "portrait_pool_player_female_extra_s73_10", asset.id);
        assert.equal(asset.identityTags.includes("female_style"), true, asset.id);
      } else {
        assert.equal(asset.subcategory, "player_male_style_pool", asset.id);
        assert.equal(asset.genderPresentation, "masculine", asset.id);
        assert.equal(
          ["baseline", "formal", "working", "travel_or_motion", "quiet_authority", "poised"].includes(asset.statusVariant),
          true,
          asset.id
        );
        assert.equal(asset.lazyLoad.group, "portrait_pool_player_male_extra_s73_10", asset.id);
        assert.equal(asset.identityTags.includes("male_style"), true, asset.id);
      }
      assert.equal(Array.isArray(asset.identityTags), true, asset.id);
      assert.equal(Array.isArray(asset.emotionTags), true, asset.id);
      assertSafeUiAssetPath(asset.lowResPlaceholderPath, `${asset.id}.lowResPlaceholderPath`);
      assert.equal(asset.fallbackRef, "fallback-role-silhouette-v1", asset.id);
      assert.equal(asset.lazyLoad.allowEagerLoad, false, asset.id);
      assert.equal(asset.lazyLoad.thumbnailFirst, true, asset.id);
      assert.equal(asset.lazyLoad.lowResPlaceholder, true, asset.id);
      assert.equal(asset.lazyLoad.maxInitialPortraits, 8, asset.id);
      const placeholderPath = resolveUiAssetPath(asset.lowResPlaceholderPath);
      assert.equal(fs.existsSync(placeholderPath), true, asset.lowResPlaceholderPath);
      const placeholderInfo = readImageInfo(placeholderPath);
      assert.equal(placeholderInfo.width, 64, asset.id);
      assert.equal(placeholderInfo.height, 96, asset.id);
      assert.equal(asset.performance.lowResPlaceholderBytes, fs.statSync(placeholderPath).size, asset.id);
      assert.equal(asset.performance.thumbnailBytes <= asset.performance.thumbnailTargetMaxBytes, true, asset.id);
    }
    if (asset.phase === "S73.10.3") {
      assert.equal(asset.category, "portrait", asset.id);
      assert.equal(asset.subcategory, "generic_npc_pool", asset.id);
      assert.equal(asset.dimensions.width, 1024, asset.id);
      assert.equal(asset.dimensions.height, 1536, asset.id);
      assert.equal(asset.transparent, false, asset.id);
      assert.equal(asset.portraitRef, asset.id, asset.id);
      assert.equal(asset.portraitRef.startsWith("portrait-s73-10-generic_npc-"), true, asset.id);
      assert.equal(manifest.roleCatalog.includes(asset.role), true, asset.id);
      assert.equal(["masculine", "feminine", "mixed"].includes(asset.genderPresentation), true, asset.id);
      assert.equal(asset.ageBand.startsWith("adult"), true, asset.id);
      assert.equal(["baseline", "working", "elder", "female_style_look01", "female_style_look02", "female_style_look03", "female_style_look04", "female_style_look05", "female_style_look06"].includes(asset.statusVariant), true, asset.id);
      assert.equal(Array.isArray(asset.identityTags), true, asset.id);
      assert.equal(Array.isArray(asset.emotionTags), true, asset.id);
      assertSafeUiAssetPath(asset.lowResPlaceholderPath, `${asset.id}.lowResPlaceholderPath`);
      assert.equal(asset.fallbackRef, "fallback-role-silhouette-v1", asset.id);
      assert.deepEqual(asset.lazyLoad, {
        group: "portrait_pool_generic_npc_s73_10",
        allowEagerLoad: false,
        thumbnailFirst: true,
        lowResPlaceholder: true,
        maxInitialPortraits: 8
      });
      const placeholderPath = resolveUiAssetPath(asset.lowResPlaceholderPath);
      assert.equal(fs.existsSync(placeholderPath), true, asset.lowResPlaceholderPath);
      const placeholderInfo = readImageInfo(placeholderPath);
      assert.equal(placeholderInfo.width, 64, asset.id);
      assert.equal(placeholderInfo.height, 96, asset.id);
      assert.equal(asset.performance.lowResPlaceholderBytes, fs.statSync(placeholderPath).size, asset.id);
      assert.equal(asset.performance.thumbnailBytes <= asset.performance.thumbnailTargetMaxBytes, true, asset.id);
    }
    if (asset.phase === "S73.10.4") {
      assert.equal(asset.category, "portrait", asset.id);
      assert.equal(asset.subcategory, "signature_npc_pool", asset.id);
      assert.equal(asset.dimensions.width, 1024, asset.id);
      assert.equal(asset.dimensions.height, 1536, asset.id);
      assert.equal(asset.transparent, false, asset.id);
      assert.equal(asset.portraitRef, asset.id, asset.id);
      assert.equal(asset.portraitRef.startsWith("portrait-s73-10-signature_npc-"), true, asset.id);
      assert.equal(manifest.roleCatalog.includes(asset.role), true, asset.id);
      assert.equal(["feminine", "mixed"].includes(asset.genderPresentation), true, asset.id);
      assert.equal(asset.ageBand.startsWith("adult"), true, asset.id);
      assert.equal(["baseline", "formal", "private_scene"].includes(asset.statusVariant), true, asset.id);
      assert.equal(Array.isArray(asset.identityTags), true, asset.id);
      assert.equal(asset.identityTags.includes("signature_npc"), true, asset.id);
      assert.equal(asset.identityTags.includes("important_npc"), true, asset.id);
      assert.equal(asset.identityTags.includes("generic_npc"), false, asset.id);
      assert.equal(Array.isArray(asset.emotionTags), true, asset.id);
      assertSafeUiAssetPath(asset.lowResPlaceholderPath, `${asset.id}.lowResPlaceholderPath`);
      assert.equal(asset.fallbackRef, "fallback-role-silhouette-v1", asset.id);
      assert.deepEqual(asset.lazyLoad, {
        group: "portrait_pool_signature_npc_s73_10",
        allowEagerLoad: false,
        thumbnailFirst: true,
        lowResPlaceholder: true,
        maxInitialPortraits: 8
      });
      const placeholderPath = resolveUiAssetPath(asset.lowResPlaceholderPath);
      assert.equal(fs.existsSync(placeholderPath), true, asset.lowResPlaceholderPath);
      const placeholderInfo = readImageInfo(placeholderPath);
      assert.equal(placeholderInfo.width, 64, asset.id);
      assert.equal(placeholderInfo.height, 96, asset.id);
      assert.equal(asset.performance.lowResPlaceholderBytes, fs.statSync(placeholderPath).size, asset.id);
      assert.equal(asset.performance.thumbnailBytes <= asset.performance.thumbnailTargetMaxBytes, true, asset.id);
    }
    if (asset.phase === "S73.10.7") {
      assert.equal(asset.category, "portrait", asset.id);
      assert.equal(asset.subcategory, "young_female_style_pool", asset.id);
      assert.equal(asset.dimensions.width, 1024, asset.id);
      assert.equal(asset.dimensions.height, 1536, asset.id);
      assert.equal(asset.transparent, false, asset.id);
      assert.equal(asset.portraitRef, asset.id, asset.id);
      assert.equal(asset.portraitRef.startsWith("portrait-s73-10-young_female-"), true, asset.id);
      assert.equal(manifest.roleCatalog.includes(asset.role), true, asset.id);
      assert.equal(asset.genderPresentation, "feminine", asset.id);
      assert.equal(asset.ageBand, "adult_young", asset.id);
      assert.equal(Array.isArray(asset.identityTags), true, asset.id);
      assert.equal(asset.identityTags.includes("young_adult_female_patch"), true, asset.id);
      assert.equal(asset.identityTags.includes("female_explicit"), true, asset.id);
      assert.equal(asset.identityTags.includes("not_middle_aged"), true, asset.id);
      assert.equal(asset.identityTags.includes("not_androgynous"), true, asset.id);
      assert.match(asset.visualReview.summary, /年轻成年女性/, asset.id);
      assert.match(asset.visualReview.summary, /中性化/, asset.id);
      assertSafeUiAssetPath(asset.lowResPlaceholderPath, `${asset.id}.lowResPlaceholderPath`);
      assert.equal(asset.fallbackRef, "fallback-role-silhouette-v1", asset.id);
      assert.deepEqual(asset.lazyLoad, {
        group: "portrait_pool_young_female_s73_10_7",
        allowEagerLoad: false,
        thumbnailFirst: true,
        lowResPlaceholder: true,
        maxInitialPortraits: 8
      });
      const placeholderPath = resolveUiAssetPath(asset.lowResPlaceholderPath);
      assert.equal(fs.existsSync(placeholderPath), true, asset.lowResPlaceholderPath);
      const placeholderInfo = readImageInfo(placeholderPath);
      assert.equal(placeholderInfo.width, 64, asset.id);
      assert.equal(placeholderInfo.height, 96, asset.id);
      assert.equal(asset.performance.lowResPlaceholderBytes, fs.statSync(placeholderPath).size, asset.id);
      assert.equal(asset.performance.thumbnailBytes <= asset.performance.thumbnailTargetMaxBytes, true, asset.id);
    }
    if (asset.phase === "S79.2") {
      assert.equal(asset.category, "portrait", asset.id);
      assert.equal(asset.subcategory, "recovered_female_highres_pool", asset.id);
      assert.equal(asset.dimensions.width, 1024, asset.id);
      assert.equal(asset.dimensions.height, 1536, asset.id);
      assert.equal(asset.transparent, false, asset.id);
      assert.equal(asset.portraitRef, asset.id, asset.id);
      assert.equal(asset.portraitRef.startsWith("portrait-s79-2-recovered-female-"), true, asset.id);
      assert.equal(manifest.roleCatalog.includes(asset.role), true, asset.id);
      assert.equal(asset.role, "recovered_female_highres", asset.id);
      assert.equal(asset.genderPresentation, "feminine", asset.id);
      assert.equal(String(asset.ageBand).startsWith("adult"), true, asset.id);
      assert.equal(asset.identityTags.includes("recovered_female_highres"), true, asset.id);
      assert.equal(asset.identityTags.includes("high_resolution_master"), true, asset.id);
      assert.equal(asset.source.localHighResSource, "kept_outside_public_manifest", asset.id);
      assert.equal(asset.source.localHighResSourcePath, undefined, asset.id);
      assert.match(asset.visualReview.summary, /194 张 recovered 女性高清母版/, asset.id);
      assert.match(asset.safetyReview.summary, /artifacts PNG 不进入 manifest|\/assets\/ui\//, asset.id);
      assertSafeUiAssetPath(asset.lowResPlaceholderPath, `${asset.id}.lowResPlaceholderPath`);
      assert.equal(asset.fallbackRef, "fallback-role-silhouette-v1", asset.id);
      assert.deepEqual(asset.lazyLoad, {
        group: "portrait_pool_recovered_female_s79_2",
        allowEagerLoad: false,
        thumbnailFirst: true,
        lowResPlaceholder: true,
        maxInitialPortraits: 8
      });
      const placeholderPath = resolveUiAssetPath(asset.lowResPlaceholderPath);
      assert.equal(fs.existsSync(placeholderPath), true, asset.lowResPlaceholderPath);
      const placeholderInfo = readImageInfo(placeholderPath);
      assert.equal(placeholderInfo.width, 64, asset.id);
      assert.equal(placeholderInfo.height, 96, asset.id);
      assert.equal(asset.performance.lowResPlaceholderBytes, fs.statSync(placeholderPath).size, asset.id);
      assert.equal(asset.performance.thumbnailBytes <= asset.performance.thumbnailTargetMaxBytes, true, asset.id);
    }
    if (asset.phase === "S73.8") {
      assert.equal(asset.category, "effect", asset.id);
      assert.equal(asset.reducedMotionFallback, "fallback-ink-motion-static-v1", asset.id);
      assert.equal(fallbackIds.has(asset.reducedMotionFallback), true, asset.id);
      assert.equal(typeof asset.scene, "string", asset.id);
      assert.equal(typeof asset.motion, "object", asset.id);
      assert.equal(typeof asset.motion.type, "string", asset.id);
      assert.equal(typeof asset.motion.suggestedUse, "string", asset.id);
      assert.equal(asset.motion.suggestedUse.length > 8, true, asset.id);
      assert.equal(asset.motion.maxSuggestedDurationMs <= 18000, true, asset.id);
      assert.equal(asset.performance.thumbnailBytes <= asset.performance.thumbnailTargetMaxBytes, true, asset.id);
    }
    assert.equal(manifest.runtimeUsableReviewStatuses.includes(asset.reviewStatus), true, asset.id);
    assertSafeUiAssetPath(asset.path, `${asset.id}.path`);
    assertSafeUiAssetPath(asset.thumbnailPath, `${asset.id}.thumbnailPath`);
    assertSafeUiAssetPath(asset.lowResPlaceholderPath, `${asset.id}.lowResPlaceholderPath`);
    if (asset.category !== "fallback") assert.equal(fallbackIds.has(asset.fallbackRef), true, asset.id);

    const filePath = resolveUiAssetPath(asset.path);
    const thumbnailPath = resolveUiAssetPath(asset.thumbnailPath);
    assert.equal(fs.existsSync(filePath), true, asset.path);
    assert.equal(fs.existsSync(thumbnailPath), true, asset.thumbnailPath);
    const info = readImageInfo(filePath);
    assert.equal(info.width, asset.dimensions.width, asset.id);
    assert.equal(info.height, asset.dimensions.height, asset.id);
    assert.equal(info.alpha, asset.transparent, asset.id);
    assert.equal(asset.performance.bytes, fs.statSync(filePath).size, asset.id);
    assert.equal(asset.performance.thumbnailBytes, fs.statSync(thumbnailPath).size, asset.id);
    assert.equal(asset.performance.bytes <= asset.performance.targetMaxBytes, true, asset.id);
    assert.equal(asset.source.type, "ai_generated", asset.id);
    assert.equal(asset.source.model, "gpt-image-2", asset.id);
    assert.equal(asset.source.tool, "Codex imagegen", asset.id);
    assert.equal(asset.visualReview.reviewedBy, "Codex", asset.id);
    assert.equal(asset.safetyReview.reviewedBy, "Codex", asset.id);
    assert.equal(asset.license.commercialUseConfirmed, false, asset.id);
  }

  const assetIds = new Set(manifest.assets.map((asset) => asset.id));
  for (const requiredId of [
    "ui-paper-xuan-base-v1",
    "ui-memorial-folded-paper-v1",
    "ui-bamboo-slip-strip-v1",
    "ui-vermilion-seal-button-v1",
    "ui-exam-grid-paper-v1",
    "ui-imperial-notice-paper-v1",
    "ui-home-scroll-landscape-v1",
    "ui-home-mist-layer-v1",
    "ui-home-register-form-paper-v1",
    "ui-home-cinnabar-start-seal-v1",
    "ui-home-archive-casefile-v1",
    "ui-home-static-reduced-motion-v1",
    "ui-scene-study-chamber-v1",
    "ui-scene-exam-cell-v1",
    "ui-scene-ranking-wall-v1",
    "ui-scene-palace-exam-hall-v1",
    "ui-scene-county-yamen-v1",
    "ui-scene-courtroom-trial-v1",
    "ui-scene-military-tent-v1",
    "ui-scene-imperial-desk-v1",
    "ui-scene-city-lanes-v1",
    "ui-scene-bureau-documents-v1",
    "ui-role-scholar-study-v1",
    "ui-role-magistrate-yamen-desk-v1",
    "ui-role-official-duty-room-v1",
    "ui-role-minister-palace-desk-v1",
    "ui-role-general-frontier-tent-v1",
    "ui-role-emperor-imperial-desk-v1",
    "portrait-player-scholar-m01-v1",
    "portrait-player-juren-m01-v1",
    "portrait-player-jinshi-m01-v1",
    "portrait-player-official-junior-m01-v1",
    "portrait-npc-magistrate-m01-v1",
    "portrait-npc-clerk-m01-v1",
    "portrait-npc-ministry-official-m01-v1",
    "portrait-npc-grand-minister-m01-v1",
    "portrait-npc-general-m01-v1",
    "portrait-npc-regent-m01-v1",
    "portrait-npc-emperor-m01-v1",
    "portrait-npc-teacher-m01-v1",
    "portrait-player-scholar-f01-v1",
    "portrait-npc-gentry-woman-f01-v1",
    "portrait-npc-female-official-f01-v1",
    "portrait-npc-palace-attendant-f01-v1",
    "portrait-npc-court-lady-high-f01-v1",
    "portrait-npc-examiner-f01-v1",
    "portrait-npc-merchant-f01-v1",
    "portrait-npc-commoner-healer-f01-v1",
    "portrait-npc-exam-peer-m01-v1",
    "portrait-npc-examiner-m01-v1",
    "portrait-npc-local-gentry-m01-v1",
    "portrait-npc-storyteller-m01-v1",
    "portrait-s73-10-player-scholar-m01-v1",
    "portrait-s73-10-player-child-exam-candidate-f02-v1",
    "portrait-s73-10-player-xiucai-m03-v1",
    "portrait-s73-10-player-juren-f01-v1",
    "portrait-s73-10-player-gongshi-m02-v1",
    "portrait-s73-10-player-jinshi-f03-v1",
    "portrait-s73-10-player-junior-official-m01-v1",
    "portrait-s73-10-player-local-official-f02-v1",
    "portrait-s73-10-player-capital-official-m03-v1",
    "portrait-s73-10-player-grand-minister-f01-v1",
    "portrait-s73-10-player-general-m02-v1",
    "portrait-s73-10-player-emperor-regent-f03-v1",
    "portrait-s73-10-player-male-extra-academy_scholar-look01-v1",
    "portrait-s73-10-generic_npc-teacher-m01-v1",
    "portrait-s73-10-generic_npc-magistrate-f02-v1",
    "portrait-s73-10-generic_npc-censor-elder01-v1",
    "portrait-s73-10-generic_npc-bonus-teacher-f01-v1",
    "portrait-s73-10-generic_npc-female-style-palace-01-look01-v1",
    "portrait-s73-10-generic_npc-female-style-tang-04-look06-v1",
    "portrait-s73-10-signature_npc-emperor-normal-v1",
    "portrait-s73-10-signature_npc-empress-dowager-court-v1",
    "portrait-s73-10-signature_npc-beloved-confidant-private-v1",
    "portrait-s73-10-signature_npc-frontier-envoy-court-v1",
    "portrait-s73-10-young_female-court-reader-v1",
    "portrait-s73-10-young_female-female-commander-v1",
    "ui-effect-mist-wash-v1",
    "ui-effect-ink-spread-v1",
    "ui-effect-cinnabar-seal-imprint-v1",
    "ui-effect-paper-unfold-v1",
    "ui-effect-ranking-reveal-v1",
    "ui-effect-exam-seal-v1",
    "ui-effect-ink-wipe-v1",
    "ui-effect-page-curl-v1",
  ]) {
    assert.equal(assetIds.has(requiredId), true, requiredId);
  }

  const s735ScenesById = new Map(manifest.assets.filter((asset) => asset.phase === "S73.5").map((asset) => [asset.id, asset]));
  const requiredS735Scenes = {
    "ui-scene-study-chamber-v1": "study_chamber",
    "ui-scene-exam-cell-v1": "exam_cell",
    "ui-scene-ranking-wall-v1": "ranking_wall",
    "ui-scene-palace-exam-hall-v1": "palace_exam_hall",
    "ui-scene-county-yamen-v1": "county_yamen",
    "ui-scene-courtroom-trial-v1": "courtroom_trial",
    "ui-scene-military-tent-v1": "military_tent",
    "ui-scene-imperial-desk-v1": "imperial_desk",
    "ui-scene-city-lanes-v1": "city_lanes",
    "ui-scene-bureau-documents-v1": "bureau_documents"
  };
  for (const [requiredId, requiredScene] of Object.entries(requiredS735Scenes)) {
    const asset = s735ScenesById.get(requiredId);
    assert.ok(asset, requiredId);
    assert.equal(asset.scene, requiredScene, requiredId);
  }

  const s736RolesById = new Map(manifest.assets.filter((asset) => asset.phase === "S73.6").map((asset) => [asset.id, asset]));
  const requiredS736Roles = {
    "ui-role-scholar-study-v1": "scholar",
    "ui-role-magistrate-yamen-desk-v1": "magistrate",
    "ui-role-official-duty-room-v1": "official",
    "ui-role-minister-palace-desk-v1": "minister",
    "ui-role-general-frontier-tent-v1": "general",
    "ui-role-emperor-imperial-desk-v1": "emperor"
  };
  for (const [requiredId, requiredRole] of Object.entries(requiredS736Roles)) {
    const asset = s736RolesById.get(requiredId);
    assert.ok(asset, requiredId);
    assert.equal(asset.role, requiredRole, requiredId);
  }

});

test("S73.4 transparent home assets keep a current transparency QA pass", () => {
  const qaText = fs.readFileSync(homeTransparencyQaPath, "utf8");
  assert.doesNotMatch(qaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(qaText, FORBIDDEN_ASSET_VALUE);
  const qa = JSON.parse(qaText);

  assert.equal(qa.schemaVersion, 1);
  assert.equal(qa.phase, "S73.4");
  assert.equal(qa.reviewer, "Codex");
  assert.deepEqual(qa.compositeBackgroundsReviewed, ["#f5f0e6", "#201c16"]);

  const qaById = new Map(qa.assets.map((entry) => [entry.id, entry]));
  for (const requiredId of [
    "ui-home-mist-layer-v1",
    "ui-home-register-form-paper-v1",
    "ui-home-cinnabar-start-seal-v1",
    "ui-home-archive-casefile-v1"
  ]) {
    const entry = qaById.get(requiredId);
    assert.ok(entry, requiredId);
    assertSafeUiAssetPath(entry.path, `${requiredId}.qa.path`);
    const assetPath = resolveUiAssetPath(entry.path);
    assert.equal(fs.existsSync(assetPath), true, requiredId);
    assert.equal(entry.sha256, sha256File(assetPath), requiredId);
    assert.equal(entry.bytes, fs.statSync(assetPath).size, requiredId);
    assert.equal(entry.metrics.borderVisibleAlphaPixels <= entry.metrics.maxAllowedBorderVisibleAlphaPixels, true, requiredId);
    assert.equal(entry.metrics.highSaturationGreenOrMagentaPixels <= entry.metrics.maxAllowedHighSaturationPixels, true, requiredId);
    assert.equal(entry.metrics.hardAlphaJumpPixels <= entry.metrics.maxAllowedHardAlphaJumpPixels, true, requiredId);
  }
});

test("S73.7 portrait baseline QA records approved adult-safe portraits", () => {
  const qaText = fs.readFileSync(portraitBaselineQaPath, "utf8");
  assert.doesNotMatch(qaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(qaText, FORBIDDEN_ASSET_VALUE);
  const qa = JSON.parse(qaText);

  assert.equal(qa.schemaVersion, 1);
  assert.equal(qa.phase, "S73.7");
  assert.equal(qa.reviewedBy, "Codex");
  assert.equal(qa.assets.length, 24);
  assert.equal(qa.visualReviewSummary.includes("成人端庄"), true);
  assert.equal(qa.visualReviewSummary.includes("无露骨"), true);
  assert.equal(qa.visualReviewSummary.includes("可读文字"), true);

  const manifest = readJson(manifestPath);
  const portraitAssets = new Map(manifest.assets.filter((asset) => asset.phase === "S73.7").map((asset) => [asset.id, asset]));
  for (const entry of qa.assets) {
    const asset = portraitAssets.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(entry.path, asset.path, entry.id);
    assert.equal(entry.thumbnailPath, asset.thumbnailPath, entry.id);
    assert.equal(entry.lowResPlaceholderPath, asset.lowResPlaceholderPath, entry.id);
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      assertSafeUiAssetPath(entry[field], `${entry.id}.${field}`);
      assert.equal(fs.existsSync(resolveUiAssetPath(entry[field])), true, `${entry.id}.${field}`);
    }
    assert.equal(entry.bytes, fs.statSync(resolveUiAssetPath(entry.path)).size, entry.id);
    assert.equal(entry.thumbnailBytes, fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size, entry.id);
    assert.equal(entry.lowResPlaceholderBytes, fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size, entry.id);
    assert.equal(entry.sha256, sha256File(resolveUiAssetPath(entry.path)), entry.id);
    assert.equal(entry.thumbnailSha256, sha256File(resolveUiAssetPath(entry.thumbnailPath)), entry.id);
    assert.equal(entry.lowResPlaceholderSha256, sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath)), entry.id);
  }
});

test("S73.10.2 player portrait pool QA records approved staged player portraits", () => {
  const qaText = fs.readFileSync(portraitPlayerPoolQaPath, "utf8");
  assert.doesNotMatch(qaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(qaText, FORBIDDEN_ASSET_VALUE);
  const qa = JSON.parse(qaText);

  assert.equal(qa.schemaVersion, 1);
  assert.equal(qa.phase, "S73.10.2");
  assert.equal(qa.reviewedBy, "Codex");
  assert.equal(qa.assets.length, 72);
  assert.equal(qa.sourceSheets.length, 18);
  const playerSourceKindCounts = qa.sourceSheets.reduce((counts, sheet) => {
    counts[sheet.kind] = (counts[sheet.kind] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(playerSourceKindCounts, {
    player_identity_stage: 12,
    player_female_reset: 6
  });
  assert.equal(qa.visualReviewSummary.includes("成年端庄"), true);
  assert.equal(qa.visualReviewSummary.includes("无可读文字"), true);
  assert.equal(qa.safetyReviewSummary.includes("provider 原始响应"), true);

  const femaleQaText = fs.readFileSync(portraitPlayerFemaleResetQaPath, "utf8");
  assert.doesNotMatch(femaleQaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(femaleQaText, FORBIDDEN_ASSET_VALUE);
  const femaleQa = JSON.parse(femaleQaText);
  assert.equal(femaleQa.schemaVersion, 1);
  assert.equal(femaleQa.phase, "S73.10.2a");
  assert.equal(femaleQa.reviewedBy, "Codex");
  assert.equal(femaleQa.sourceSheets.length, 16);
  assert.deepEqual(femaleQa.counts, {
    resetPlayerFemale: 36,
    extraPlayerFemale: 60,
    totalReviewedFemale: 96
  });
  assert.equal(femaleQa.visualReviewSummary.includes("60 张玩家女性扩展选角立绘"), true);
  assert.equal(femaleQa.visualReviewSummary.includes("完整衣着"), true);
  assert.equal(femaleQa.safetyReviewSummary.includes("所有角色均为成年"), true);

  const maleQaText = fs.readFileSync(portraitPlayerMaleExtraQaPath, "utf8");
  assert.doesNotMatch(maleQaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(maleQaText, FORBIDDEN_ASSET_VALUE);
  const maleQa = JSON.parse(maleQaText);
  assert.equal(maleQa.schemaVersion, 1);
  assert.equal(maleQa.phase, "S73.10.2b");
  assert.equal(maleQa.reviewedBy, "Codex");
  assert.equal(maleQa.sourceSheets.length, 10);
  assert.deepEqual(maleQa.counts, {
    extraPlayerMale: 60,
    totalReviewedMaleExtra: 60
  });
  assert.equal(maleQa.visualReviewSummary.includes("60 张玩家男性扩展选角立绘"), true);
  assert.equal(maleQa.visualReviewSummary.includes("完整衣着"), true);
  assert.equal(maleQa.safetyReviewSummary.includes("所有角色均为成年"), true);

  const manifest = readJson(manifestPath);
  const playerPhaseAssets = manifest.assets.filter((asset) => asset.phase === "S73.10.2");
  assert.equal(playerPhaseAssets.filter((asset) => asset.subcategory === "player_identity_stage_pool").length, 72);
  assert.equal(playerPhaseAssets.filter((asset) => asset.subcategory === "player_female_style_pool").length, 60);
  assert.equal(playerPhaseAssets.filter((asset) => asset.subcategory === "player_male_style_pool").length, 60);
  assert.equal(playerPhaseAssets.filter((asset) => asset.genderPresentation === "masculine").length, 96);
  assert.equal(playerPhaseAssets.filter((asset) => asset.genderPresentation === "feminine").length, 96);
  const poolAssets = new Map(playerPhaseAssets.map((asset) => [asset.id, asset]));
  const femaleQaAssetsById = new Map(femaleQa.assets.map((entry) => [entry.id, entry]));
  const roles = new Set();
  const variantsByRole = new Map();
  for (const entry of qa.assets) {
    const asset = poolAssets.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(entry.path, asset.path, entry.id);
    assert.equal(entry.thumbnailPath, asset.thumbnailPath, entry.id);
    assert.equal(entry.lowResPlaceholderPath, asset.lowResPlaceholderPath, entry.id);
    roles.add(entry.role);
    variantsByRole.set(entry.role, (variantsByRole.get(entry.role) || 0) + 1);
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      assertSafeUiAssetPath(entry[field], `${entry.id}.${field}`);
      assert.equal(fs.existsSync(resolveUiAssetPath(entry[field])), true, `${entry.id}.${field}`);
    }
    if (isSinglePortraitOverride(asset)) {
      assert.equal(asset.performance.bytes, fs.statSync(resolveUiAssetPath(asset.path)).size, entry.id);
      assert.equal(asset.performance.thumbnailBytes, fs.statSync(resolveUiAssetPath(asset.thumbnailPath)).size, entry.id);
      assert.equal(
        asset.performance.lowResPlaceholderBytes,
        fs.statSync(resolveUiAssetPath(asset.lowResPlaceholderPath)).size,
        entry.id
      );
      if (entry.genderPresentation === "feminine") {
        assert.ok(femaleQaAssetsById.has(entry.id), entry.id);
      }
      continue;
    }
    assert.equal(entry.bytes, fs.statSync(resolveUiAssetPath(entry.path)).size, entry.id);
    assert.equal(entry.thumbnailBytes, fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size, entry.id);
    assert.equal(entry.lowResPlaceholderBytes, fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size, entry.id);
    assert.equal(entry.sha256, sha256File(resolveUiAssetPath(entry.path)), entry.id);
    assert.equal(entry.thumbnailSha256, sha256File(resolveUiAssetPath(entry.thumbnailPath)), entry.id);
    assert.equal(entry.lowResPlaceholderSha256, sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath)), entry.id);
    assert.equal(entry.visualReviewStatus, "approved", entry.id);
    assert.equal(entry.safetyReviewStatus, "approved", entry.id);
    if (entry.genderPresentation === "feminine") {
      assert.ok(femaleQaAssetsById.has(entry.id), entry.id);
    }
  }
  assert.equal(roles.size, 12);
  for (const [role, count] of variantsByRole) {
    assert.equal(count, 6, role);
  }

  const extraPlayerStyles = femaleQa.assets.filter((entry) => entry.subcategory === "player_female_style_pool");
  const extraRoles = new Map();
  for (const entry of extraPlayerStyles) {
    const asset = poolAssets.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(asset.genderPresentation, "feminine", entry.id);
    assert.equal(asset.reviewStatus, "approved", entry.id);
    assert.equal(asset.lazyLoad.group, "portrait_pool_player_female_extra_s73_10", entry.id);
    extraRoles.set(entry.role, (extraRoles.get(entry.role) || 0) + 1);
  }
  assert.equal(extraPlayerStyles.length, 60);
  assert.equal(extraRoles.size, 10);
  for (const [role, count] of extraRoles) assert.equal(count, 6, role);

  const extraPlayerMaleStyles = maleQa.assets.filter((entry) => entry.subcategory === "player_male_style_pool");
  const extraMaleRoles = new Map();
  for (const entry of extraPlayerMaleStyles) {
    const asset = poolAssets.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(asset.genderPresentation, "masculine", entry.id);
    assert.equal(asset.reviewStatus, "approved", entry.id);
    assert.equal(asset.lazyLoad.group, "portrait_pool_player_male_extra_s73_10", entry.id);
    assert.equal(asset.identityTags.includes("male_style"), true, entry.id);
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      assertSafeUiAssetPath(entry[field], `${entry.id}.${field}`);
      assert.equal(fs.existsSync(resolveUiAssetPath(entry[field])), true, `${entry.id}.${field}`);
    }
    assert.equal(entry.bytes, fs.statSync(resolveUiAssetPath(entry.path)).size, entry.id);
    assert.equal(entry.thumbnailBytes, fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size, entry.id);
    assert.equal(entry.lowResPlaceholderBytes, fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size, entry.id);
    assert.equal(entry.sha256, sha256File(resolveUiAssetPath(entry.path)), entry.id);
    assert.equal(entry.thumbnailSha256, sha256File(resolveUiAssetPath(entry.thumbnailPath)), entry.id);
    assert.equal(entry.lowResPlaceholderSha256, sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath)), entry.id);
    assert.equal(entry.visualReviewStatus, "approved", entry.id);
    assert.equal(entry.safetyReviewStatus, "approved", entry.id);
    extraMaleRoles.set(entry.role, (extraMaleRoles.get(entry.role) || 0) + 1);
  }
  assert.equal(extraPlayerMaleStyles.length, 60);
  assert.equal(extraMaleRoles.size, 10);
  for (const [role, count] of extraMaleRoles) assert.equal(count, 6, role);
});

test("S73.10.3 generic NPC portrait pool QA records matrix, bonus, and female style portraits", () => {
  const qaText = fs.readFileSync(portraitGenericNpcPoolQaPath, "utf8");
  assert.doesNotMatch(qaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(qaText, FORBIDDEN_ASSET_VALUE);
  const qa = JSON.parse(qaText);

  assert.equal(qa.schemaVersion, 1);
  assert.equal(qa.phase, "S73.10.3");
  assert.equal(qa.reviewedBy, "Codex");
  assert.equal(qa.assets.length, 188);
  assert.equal(qa.sourceSheets.length, 36);
  assert.equal(qa.visualReviewSummary.includes("120 张按 S73.10.3 矩阵生成"), true);
  assert.equal(qa.visualReviewSummary.includes("48 张女性风格扩展池"), true);
  assert.equal(qa.visualReviewSummary.includes("上身服饰层次清楚"), true);
  assert.match(qa.visualReviewSummary, /无露胸|不露胸/);
  assert.equal(qa.safetyReviewSummary.includes("provider 原始响应"), true);

  const manifest = readJson(manifestPath);
  const singleOverrideQa = readJson(portraitSingleOverrideQaPath);
  const singleOverrideIds = new Set(singleOverrideQa.assets.map((entry) => entry.id));
  const poolAssets = new Map(manifest.assets.filter((asset) => asset.phase === "S73.10.3").map((asset) => [asset.id, asset]));
  const counts = { matrix: 0, bonus: 0, femaleStyle: 0, palace: 0, tang: 0 };
  const matrixRoles = new Map();
  const bonusRoles = new Map();
  const femaleStyleRoles = new Map();
  for (const entry of qa.assets) {
    const asset = poolAssets.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(entry.path, asset.path, entry.id);
    assert.equal(entry.thumbnailPath, asset.thumbnailPath, entry.id);
    assert.equal(entry.lowResPlaceholderPath, asset.lowResPlaceholderPath, entry.id);
    if (entry.bonusGenericNpc) {
      counts.bonus += 1;
      bonusRoles.set(entry.role, (bonusRoles.get(entry.role) || 0) + 1);
    } else if (entry.femaleExtraGenericNpc) {
      counts.femaleStyle += 1;
      if (entry.femaleStyleKind === "palace") counts.palace += 1;
      if (entry.femaleStyleKind === "tang") counts.tang += 1;
      femaleStyleRoles.set(entry.role, (femaleStyleRoles.get(entry.role) || 0) + 1);
      assert.equal(["palace-lady", "tang-lady"].includes(entry.role), true, entry.id);
      assert.equal(asset.identityTags.includes("female_style_pack"), true, entry.id);
    } else {
      counts.matrix += 1;
      matrixRoles.set(entry.role, (matrixRoles.get(entry.role) || 0) + 1);
    }
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      assertSafeUiAssetPath(entry[field], `${entry.id}.${field}`);
      assert.equal(fs.existsSync(resolveUiAssetPath(entry[field])), true, `${entry.id}.${field}`);
    }
    if (isSinglePortraitOverride(asset)) {
      assert.equal(singleOverrideIds.has(entry.id), true, entry.id);
      assert.equal(asset.source.localHighResSourcePath, undefined, entry.id);
      assert.equal(asset.source.localHighResSource, "kept_outside_public_manifest", entry.id);
      assert.equal(asset.performance.bytes, fs.statSync(resolveUiAssetPath(asset.path)).size, entry.id);
      assert.equal(asset.performance.thumbnailBytes, fs.statSync(resolveUiAssetPath(asset.thumbnailPath)).size, entry.id);
      assert.equal(
        asset.performance.lowResPlaceholderBytes,
        fs.statSync(resolveUiAssetPath(asset.lowResPlaceholderPath)).size,
        entry.id
      );
      continue;
    }
    assert.equal(entry.bytes, fs.statSync(resolveUiAssetPath(entry.path)).size, entry.id);
    assert.equal(entry.thumbnailBytes, fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size, entry.id);
    assert.equal(entry.lowResPlaceholderBytes, fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size, entry.id);
    assert.equal(entry.sha256, sha256File(resolveUiAssetPath(entry.path)), entry.id);
    assert.equal(entry.thumbnailSha256, sha256File(resolveUiAssetPath(entry.thumbnailPath)), entry.id);
    assert.equal(entry.lowResPlaceholderSha256, sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath)), entry.id);
    assert.equal(entry.visualReviewStatus, "approved", entry.id);
    assert.equal(entry.safetyReviewStatus, "approved", entry.id);
  }
  assert.deepEqual(counts, { matrix: 120, bonus: 20, femaleStyle: 48, palace: 24, tang: 24 });
  assert.equal(matrixRoles.size, 24);
  for (const [role, count] of matrixRoles) assert.equal(count, 5, role);
  assert.equal(bonusRoles.size, 4);
  for (const [role, count] of bonusRoles) assert.equal(count, 5, role);
  assert.deepEqual(Object.fromEntries([...femaleStyleRoles.entries()].sort()), {
    "palace-lady": 24,
    "tang-lady": 24
  });
});

test("S73.10.4 signature NPC portrait pool QA records isolated important NPC portraits", () => {
  const qaText = fs.readFileSync(portraitSignatureNpcPoolQaPath, "utf8");
  assert.doesNotMatch(qaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(qaText, FORBIDDEN_ASSET_VALUE);
  const qa = JSON.parse(qaText);

  assert.equal(qa.schemaVersion, 1);
  assert.equal(qa.phase, "S73.10.4");
  assert.equal(qa.reviewedBy, "Codex");
  assert.equal(qa.assets.length, 72);
  assert.equal(qa.sourceSheets.length, 12);
  assert.equal(qa.visualReviewSummary.includes("72 张重要 NPC 专属立绘"), true);
  assert.equal(qa.visualReviewSummary.includes("女性角色不做中性化处理"), true);
  assert.equal(qa.visualReviewSummary.includes("腰封细腰"), true);
  assert.equal(qa.safetyReviewSummary.includes("不混入 generic_npc"), true);
  assert.equal(qa.safetyReviewSummary.includes("隐藏动机"), true);

  const manifest = readJson(manifestPath);
  const poolAssets = new Map(manifest.assets.filter((asset) => asset.phase === "S73.10.4").map((asset) => [asset.id, asset]));
  const roles = new Map();
  const statusCounts = new Map();
  const feminineRoles = new Set();
  for (const entry of qa.assets) {
    const asset = poolAssets.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(entry.path, asset.path, entry.id);
    assert.equal(entry.thumbnailPath, asset.thumbnailPath, entry.id);
    assert.equal(entry.lowResPlaceholderPath, asset.lowResPlaceholderPath, entry.id);
    assert.equal(asset.subcategory, "signature_npc_pool", entry.id);
    assert.equal(asset.lazyLoad.group, "portrait_pool_signature_npc_s73_10", entry.id);
    assert.equal(asset.identityTags.includes("signature_npc"), true, entry.id);
    assert.equal(asset.identityTags.includes("important_npc"), true, entry.id);
    assert.equal(asset.identityTags.includes("generic_npc"), false, entry.id);
    if (entry.genderPresentation === "feminine") feminineRoles.add(entry.role);
    roles.set(entry.role, (roles.get(entry.role) || 0) + 1);
    statusCounts.set(entry.statusVariant, (statusCounts.get(entry.statusVariant) || 0) + 1);
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      assertSafeUiAssetPath(entry[field], `${entry.id}.${field}`);
      assert.equal(fs.existsSync(resolveUiAssetPath(entry[field])), true, `${entry.id}.${field}`);
    }
    assert.equal(entry.bytes, fs.statSync(resolveUiAssetPath(entry.path)).size, entry.id);
    assert.equal(entry.thumbnailBytes, fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size, entry.id);
    assert.equal(entry.lowResPlaceholderBytes, fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size, entry.id);
    assert.equal(entry.sha256, sha256File(resolveUiAssetPath(entry.path)), entry.id);
    assert.equal(entry.thumbnailSha256, sha256File(resolveUiAssetPath(entry.thumbnailPath)), entry.id);
    assert.equal(entry.lowResPlaceholderSha256, sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath)), entry.id);
    assert.equal(entry.visualReviewStatus, "approved", entry.id);
    assert.equal(entry.safetyReviewStatus, "approved", entry.id);
  }
  assert.equal(roles.size, 24);
  for (const [role, count] of roles) assert.equal(count, 3, role);
  assert.deepEqual(Object.fromEntries([...statusCounts.entries()].sort()), {
    baseline: 24,
    formal: 24,
    private_scene: 24
  });
  assert.deepEqual([...feminineRoles].sort(), ["beloved-confidant", "empress", "empress-dowager"]);
});

test("S73.10.5 state and scene portrait pool QA records approved pose anchors", () => {
  const qaText = fs.readFileSync(portraitStateScenePoolQaPath, "utf8");
  assert.doesNotMatch(qaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(qaText, FORBIDDEN_ASSET_VALUE);
  const qa = JSON.parse(qaText);

  assert.equal(qa.schemaVersion, 1);
  assert.equal(qa.phase, "S73.10.5");
  assert.equal(qa.reviewedBy, "Codex");
  assert.equal(qa.assets.length, 72);
  assert.equal(qa.sourceSheets.length, 12);
  assert.deepEqual(qa.counts, { stateVariant: 48, sceneAnchor: 24 });
  assert.equal(qa.visualReviewSummary.includes("女性角色具备明确成熟女性服饰和身形特征"), true);
  assert.equal(qa.safetyReviewSummary.includes("provider 原始响应"), true);

  const manifest = readJson(manifestPath);
  const poolAssets = new Map(manifest.assets.filter((asset) => asset.phase === "S73.10.5").map((asset) => [asset.id, asset]));
  const subcategoryCounts = new Map();
  const stateStatusCounts = new Map();
  const sceneStatusCounts = new Map();
  const sceneRoles = new Set();
  for (const entry of qa.assets) {
    const asset = poolAssets.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(entry.path, asset.path, entry.id);
    assert.equal(entry.thumbnailPath, asset.thumbnailPath, entry.id);
    assert.equal(entry.lowResPlaceholderPath, asset.lowResPlaceholderPath, entry.id);
    assert.equal(asset.category, "portrait", entry.id);
    assert.equal(["state_variant_pool", "scene_anchor_pool"].includes(asset.subcategory), true, entry.id);
    assert.equal(asset.lazyLoad.group, asset.subcategory === "state_variant_pool" ? "portrait_pool_state_variant_s73_10" : "portrait_pool_scene_anchor_s73_10", entry.id);
    assert.equal(asset.identityTags.includes("generic_npc"), false, entry.id);
    assert.equal(asset.source.promptSummary.includes("女性"), true, entry.id);
    subcategoryCounts.set(asset.subcategory, (subcategoryCounts.get(asset.subcategory) || 0) + 1);
    if (asset.subcategory === "state_variant_pool") {
      stateStatusCounts.set(entry.statusVariant, (stateStatusCounts.get(entry.statusVariant) || 0) + 1);
    } else {
      sceneStatusCounts.set(entry.statusVariant, (sceneStatusCounts.get(entry.statusVariant) || 0) + 1);
      sceneRoles.add(entry.role);
    }
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      assertSafeUiAssetPath(entry[field], `${entry.id}.${field}`);
      assert.equal(fs.existsSync(resolveUiAssetPath(entry[field])), true, `${entry.id}.${field}`);
    }
    assert.equal(entry.bytes, fs.statSync(resolveUiAssetPath(entry.path)).size, entry.id);
    assert.equal(entry.thumbnailBytes, fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size, entry.id);
    assert.equal(entry.lowResPlaceholderBytes, fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size, entry.id);
    assert.equal(entry.sha256, sha256File(resolveUiAssetPath(entry.path)), entry.id);
    assert.equal(entry.thumbnailSha256, sha256File(resolveUiAssetPath(entry.thumbnailPath)), entry.id);
    assert.equal(entry.lowResPlaceholderSha256, sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath)), entry.id);
    assert.equal(entry.visualReviewStatus, "approved", entry.id);
    assert.equal(entry.safetyReviewStatus, "approved", entry.id);
  }
  assert.deepEqual(Object.fromEntries([...subcategoryCounts.entries()].sort()), {
    scene_anchor_pool: 24,
    state_variant_pool: 48
  });
  assert.equal(stateStatusCounts.size, 16);
  for (const [statusVariant, count] of stateStatusCounts) {
    assert.equal(count, 3, statusVariant);
  }
  assert.deepEqual(Object.fromEntries([...sceneStatusCounts.entries()].sort()), {
    baseline: 8,
    conflict: 8,
    resolved: 8
  });
  assert.deepEqual([...sceneRoles].sort(), [
    "county-trial",
    "court-memorial",
    "exam-list-meeting",
    "exam-writing",
    "market-talk",
    "night-study",
    "palace-summons",
    "war-council"
  ]);
});

test("S73.10.7 young female portrait patch rejects middle-aged or neutralized candidates", () => {
  const qaText = fs.readFileSync(portraitYoungFemalePoolQaPath, "utf8");
  assert.doesNotMatch(qaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(qaText, FORBIDDEN_ASSET_VALUE);
  const qa = JSON.parse(qaText);
  const scriptText = fs.readFileSync(portraitYoungFemaleScriptPath, "utf8");

  assert.equal(scriptText.includes("not_middle_aged"), true);
  assert.equal(scriptText.includes("not_androgynous"), true);
  assert.equal(qa.schemaVersion, 1);
  assert.equal(qa.phase, "S73.10.7");
  assert.equal(qa.reviewedBy, "Codex");
  assert.equal(qa.assets.length, 48);
  assert.equal(qa.sourceSheets.length, 8);
  assert.deepEqual(qa.counts, {
    total: 48,
    youngAdultFemale: 48,
    middleAgedRejected: 0,
    elderlyRejected: 0,
    plumpOrAgedRejected: 0,
    masculineOrNeutralRejected: 0,
    lowContrastVividRejected: 0,
    androgynousRejected: 0
  });
  assert.match(qa.visualReviewSummary, /没有中老年女性|没有中年女性/);
  assert.match(qa.visualReviewSummary, /中性化/);
  assert.match(qa.visualReviewSummary, /腰封细腰/);
  assert.equal(qa.safetyReviewSummary.includes("完整衣着"), true);

  const manifest = readJson(manifestPath);
  const poolAssets = new Map(manifest.assets.filter((asset) => asset.phase === "S73.10.7").map((asset) => [asset.id, asset]));
  const roleSet = new Set();
  for (const entry of qa.assets) {
    const asset = poolAssets.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(asset.subcategory, "young_female_style_pool", entry.id);
    assert.equal(asset.genderPresentation, "feminine", entry.id);
    assert.equal(asset.ageBand, "adult_young", entry.id);
    assert.equal(asset.lazyLoad.group, "portrait_pool_young_female_s73_10_7", entry.id);
    assert.equal(asset.identityTags.includes("young_adult_female_patch"), true, entry.id);
    assert.equal(asset.identityTags.includes("female_explicit"), true, entry.id);
    assert.equal(asset.identityTags.includes("not_middle_aged"), true, entry.id);
    assert.equal(asset.identityTags.includes("not_androgynous"), true, entry.id);
    assert.match(asset.visualReview.summary, /年轻成年女性/, entry.id);
    assert.match(asset.visualReview.summary, /中性化/, entry.id);
    roleSet.add(entry.role);
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      assertSafeUiAssetPath(entry[field], `${entry.id}.${field}`);
      assert.equal(fs.existsSync(resolveUiAssetPath(entry[field])), true, `${entry.id}.${field}`);
    }
    assert.equal(entry.bytes, fs.statSync(resolveUiAssetPath(entry.path)).size, entry.id);
    assert.equal(entry.thumbnailBytes, fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size, entry.id);
    assert.equal(entry.lowResPlaceholderBytes, fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size, entry.id);
    assert.equal(entry.sha256, sha256File(resolveUiAssetPath(entry.path)), entry.id);
    assert.equal(entry.thumbnailSha256, sha256File(resolveUiAssetPath(entry.thumbnailPath)), entry.id);
    assert.equal(entry.lowResPlaceholderSha256, sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath)), entry.id);
    assert.equal(entry.visualReviewStatus, "approved", entry.id);
    assert.equal(entry.safetyReviewStatus, "approved", entry.id);
  }
  assert.equal(roleSet.size, 48);
});

test("S79.2 recovered female portrait pool records all high-res PNG masters safely", () => {
  const qaText = fs.readFileSync(portraitRecoveredFemalePoolQaPath, "utf8");
  assert.doesNotMatch(qaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(qaText, FORBIDDEN_ASSET_VALUE);
  const qa = JSON.parse(qaText);
  const manifest = readJson(manifestPath);
  const poolAssets = new Map(manifest.assets.filter((asset) => asset.phase === "S79.2").map((asset) => [asset.id, asset]));

  assert.equal(qa.schemaVersion, 1);
  assert.equal(qa.phase, "S79.2");
  assert.equal(qa.reviewedBy, "Codex");
  assert.equal(qa.reviewedAt, "2026-05-19");
  assert.equal(qa.assets.length, 194);
  assert.deepEqual(qa.counts, {
    total: 194,
    recoveredFemaleHighres: 194,
    uniqueSourceSha256: 194,
    sourceThreads: 8,
    exact1024x1536Sources: 185,
    containedResizedSources: 9,
    rejected: 0
  });
  assert.match(qa.visualReviewSummary, /高清主图/);
  assert.match(qa.safetyReviewSummary, /artifacts 路径/);
  assert.match(qa.sourceHandling, /源 SHA-256/);
  assert.equal(poolAssets.size, 194);

  const sourceNames = new Set();
  const sourceShas = new Set();
  for (const entry of qa.assets) {
    const asset = poolAssets.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(asset.subcategory, "recovered_female_highres_pool", entry.id);
    assert.equal(asset.genderPresentation, "feminine", entry.id);
    assert.equal(String(asset.ageBand).startsWith("adult"), true, entry.id);
    assert.equal(asset.lazyLoad.group, "portrait_pool_recovered_female_s79_2", entry.id);
    assert.equal(asset.source.localHighResSource, "kept_outside_public_manifest", entry.id);
    assert.equal(asset.source.localHighResSourcePath, undefined, entry.id);
    assert.equal(entry.sourceHandling, "local_artifact_not_public", entry.id);
    assert.equal(typeof entry.sourceFileName, "string", entry.id);
    assert.match(entry.sourceFileName, /^[0-9a-f]{8}--ig_[0-9a-f]{50}\.png$/);
    assert.equal(typeof entry.sourceThreadId, "string", entry.id);
    assert.equal(typeof entry.sourceThreadName, "string", entry.id);
    assert.equal(typeof entry.sourceSha256, "string", entry.id);
    assert.equal(entry.sourceSha256.length, 64, entry.id);
    assert.equal(typeof entry.sourceDimensions.width, "number", entry.id);
    assert.equal(typeof entry.sourceDimensions.height, "number", entry.id);
    sourceNames.add(entry.sourceFileName);
    sourceShas.add(entry.sourceSha256);
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      assertSafeUiAssetPath(entry[field], `${entry.id}.${field}`);
      assert.equal(fs.existsSync(resolveUiAssetPath(entry[field])), true, `${entry.id}.${field}`);
    }
    assert.equal(entry.bytes, fs.statSync(resolveUiAssetPath(entry.path)).size, entry.id);
    assert.equal(entry.thumbnailBytes, fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size, entry.id);
    assert.equal(entry.lowResPlaceholderBytes, fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size, entry.id);
    assert.equal(entry.sha256, sha256File(resolveUiAssetPath(entry.path)), entry.id);
    assert.equal(entry.thumbnailSha256, sha256File(resolveUiAssetPath(entry.thumbnailPath)), entry.id);
    assert.equal(entry.lowResPlaceholderSha256, sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath)), entry.id);
    assert.equal(entry.visualReviewStatus, "approved", entry.id);
    assert.equal(entry.safetyReviewStatus, "approved", entry.id);
  }
  assert.equal(sourceNames.size, 194);
  assert.equal(sourceShas.size, 194);
});

test("S73.10 single portrait overrides replace selected female player portraits without reusing grid hashes", () => {
  const qaText = fs.readFileSync(portraitSingleOverrideQaPath, "utf8");
  assert.doesNotMatch(qaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(qaText, FORBIDDEN_ASSET_VALUE);
  const qa = JSON.parse(qaText);
  const manifest = readJson(manifestPath);
  const manifestById = new Map(manifest.assets.map((asset) => [asset.id, asset]));

  assert.equal(qa.schemaVersion, 1);
  assert.equal(qa.phase, "S73.10.single-overrides");
  assert.equal(qa.reviewedBy, "Codex");
  assert.equal(qa.counts.total, 60);
  assert.equal(qa.assets.length, 60);
  assert.match(qa.visualReviewSummary, /单张高质量重制覆盖/);

  const expectedStages = [
    "capital-official",
    "child-exam-candidate",
    "emperor-regent",
    "general",
    "gongshi",
    "grand-minister",
    "jinshi",
    "junior-official",
    "juren",
    "local-official",
    "scholar",
    "xiucai"
  ];
  const expectedVariants = ["f01", "f02", "f03"];
  const actualByStage = new Map();
  const bySubcategory = new Map();
  const expectedExtraRoles = {
    frontier_general: 6,
    gentry_lady: 6,
    high_court_lady: 6,
    merchant_owner: 5
  };
  const extraRoles = new Map();
  const seenOverrideIds = new Set();
  for (const entry of qa.assets) {
    assert.equal(seenOverrideIds.has(entry.id), false, `duplicate override id: ${entry.id}`);
    seenOverrideIds.add(entry.id);
    bySubcategory.set(entry.subcategory, (bySubcategory.get(entry.subcategory) || 0) + 1);
    if (entry.subcategory === "player_identity_stage_pool") {
      const match = /^portrait-s73-10-player-(.+)-(f0[123])-v1$/.exec(entry.id);
      assert.ok(match, entry.id);
      const [, stage, variant] = match;
      if (!actualByStage.has(stage)) actualByStage.set(stage, []);
      actualByStage.get(stage).push(variant);
    } else if (entry.subcategory === "player_female_style_pool") {
      const match = /^portrait-s73-10-player-female-extra-(.+)-look\d\d-v1$/.exec(entry.id);
      assert.ok(match, entry.id);
      extraRoles.set(match[1], (extraRoles.get(match[1]) || 0) + 1);
    } else {
      assert.equal(entry.id, "portrait-s73-10-generic_npc-female-style-palace-03-look03-v1", entry.id);
    }
  }
  assert.deepEqual(Object.fromEntries([...bySubcategory.entries()].sort()), {
    generic_npc_pool: 1,
    player_female_style_pool: 23,
    player_identity_stage_pool: 36
  });
  assert.deepEqual([...actualByStage.keys()].sort(), expectedStages);
  for (const stage of expectedStages) {
    assert.deepEqual(actualByStage.get(stage).sort(), expectedVariants, stage);
  }
  assert.deepEqual(Object.fromEntries([...extraRoles.entries()].sort()), expectedExtraRoles);

  for (const entry of qa.assets) {
    const asset = manifestById.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(asset.category, "portrait", entry.id);
    assert.equal(asset.genderPresentation, "feminine", entry.id);
    assert.equal(asset.source.localHighResSourcePath, undefined, entry.id);
    assert.equal(entry.localHighResSourcePath, undefined, entry.id);
    assert.equal(asset.source.localHighResSource, "kept_outside_public_manifest", entry.id);
    assert.equal(entry.sourceHandling, "local_artifact_not_public", entry.id);
    assert.equal(asset.source.promptSummary.includes("单张竖版高质量重制"), true, entry.id);
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      assertSafeUiAssetPath(entry[field], `${entry.id}.${field}`);
      assert.equal(fs.existsSync(resolveUiAssetPath(entry[field])), true, `${entry.id}.${field}`);
    }
    assert.equal(entry.bytes, fs.statSync(resolveUiAssetPath(entry.path)).size, entry.id);
    assert.equal(entry.thumbnailBytes, fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size, entry.id);
    assert.equal(entry.lowResPlaceholderBytes, fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size, entry.id);
    assert.equal(entry.sha256, sha256File(resolveUiAssetPath(entry.path)), entry.id);
    assert.equal(entry.thumbnailSha256, sha256File(resolveUiAssetPath(entry.thumbnailPath)), entry.id);
    assert.equal(entry.lowResPlaceholderSha256, sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath)), entry.id);
    assert.equal(entry.visualReviewStatus, "approved", entry.id);
    assert.equal(entry.safetyReviewStatus, "approved", entry.id);
  }
});

test("S73.8 effect motion QA records approved reduced-motion fallbacks", () => {
  const qaText = fs.readFileSync(effectMotionQaPath, "utf8");
  assert.doesNotMatch(qaText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(qaText, FORBIDDEN_ASSET_VALUE);
  const qa = JSON.parse(qaText);

  assert.equal(qa.schemaVersion, 1);
  assert.equal(qa.phase, "S73.8");
  assert.equal(qa.reviewedBy, "Codex");
  assert.equal(qa.assets.length, 8);
  assert.equal(qa.visualReviewSummary.includes("无可读文字"), true);
  assert.equal(qa.reducedMotionPolicy.includes("prefers-reduced-motion"), true);

  const manifest = readJson(manifestPath);
  const effectAssets = new Map(manifest.assets.filter((asset) => asset.phase === "S73.8").map((asset) => [asset.id, asset]));
  for (const entry of qa.assets) {
    const asset = effectAssets.get(entry.id);
    assert.ok(asset, entry.id);
    assert.equal(entry.path, asset.path, entry.id);
    assert.equal(entry.thumbnailPath, asset.thumbnailPath, entry.id);
    assert.equal(asset.reducedMotionFallback, "fallback-ink-motion-static-v1", entry.id);
    assertSafeUiAssetPath(entry.path, `${entry.id}.path`);
    assertSafeUiAssetPath(entry.thumbnailPath, `${entry.id}.thumbnailPath`);
    assert.equal(fs.existsSync(resolveUiAssetPath(entry.path)), true, `${entry.id}.path`);
    assert.equal(fs.existsSync(resolveUiAssetPath(entry.thumbnailPath)), true, `${entry.id}.thumbnailPath`);
    assert.equal(entry.bytes, fs.statSync(resolveUiAssetPath(entry.path)).size, entry.id);
    assert.equal(entry.thumbnailBytes, fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size, entry.id);
    assert.equal(entry.sha256, sha256File(resolveUiAssetPath(entry.path)), entry.id);
    assert.equal(entry.thumbnailSha256, sha256File(resolveUiAssetPath(entry.thumbnailPath)), entry.id);
    assert.equal(asset.motion.maxSuggestedDurationMs <= 18000, true, entry.id);
  }
});

test("S73.9 frontend asset QA report covers active assets and transparent composites", () => {
  const reportText = fs.readFileSync(assetQaReportPath, "utf8");
  assert.doesNotMatch(reportText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(reportText, FORBIDDEN_ASSET_VALUE);
  const report = JSON.parse(reportText);
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.phase, "S73.9");
  assert.equal(report.manifestRef, "public/assets/ui/ink-ui-manifest.json");
  assert.equal(report.previewRef, "public/assets/ui/asset-qa-preview.html");
  assert.equal(report.manifestSha256, crypto.createHash("sha256").update(manifestText).digest("hex"));
  assert.equal(report.summary.totalAssets, manifest.assets.length);
  assert.equal(report.summary.errorCount, 0);
  assert.equal(report.pixelAnalysis.enabled, true);
  assert.deepEqual(report.compositeBackgrounds.map((background) => background.color), ["#f5f0e6", "#201c16"]);
  assert.equal(fs.existsSync(assetQaPreviewPath), true);

  const reportById = new Map(report.assets.map((asset) => [asset.id, asset]));
  for (const asset of manifest.assets) {
    const entry = reportById.get(asset.id);
    assert.ok(entry, asset.id);
    assert.equal(entry.path, asset.path, asset.id);
    assert.equal(entry.thumbnailPath, asset.thumbnailPath, asset.id);
    assert.equal(entry.reviewStatus, asset.reviewStatus, asset.id);
    assert.equal(entry.runtimeUsable, true, asset.id);
    assert.equal(entry.files.image.exists, true, asset.id);
    assert.equal(entry.files.thumbnail.exists, true, asset.id);
    assert.equal(entry.files.image.sha256, sha256File(resolveUiAssetPath(asset.path)), asset.id);
    assert.equal(entry.files.image.bytes, fs.statSync(resolveUiAssetPath(asset.path)).size, asset.id);
    assert.equal(entry.files.thumbnail.sha256, sha256File(resolveUiAssetPath(asset.thumbnailPath)), asset.id);
    assert.equal(entry.files.thumbnail.bytes, fs.statSync(resolveUiAssetPath(asset.thumbnailPath)).size, asset.id);
    assert.equal(entry.issues.some((issue) => issue.severity === "error"), false, asset.id);
    if (asset.transparent) {
      assert.equal(entry.transparentQa.required, true, asset.id);
      assert.equal(entry.transparentQa.backgrounds.length, 2, asset.id);
      assert.ok(entry.transparentQa.pixel, asset.id);
      assert.equal(entry.transparentQa.pixel.width, asset.dimensions.width, asset.id);
      assert.equal(entry.transparentQa.pixel.height, asset.dimensions.height, asset.id);
      assert.equal(typeof entry.transparentQa.pixel.visibleAlphaRatio, "number", asset.id);
      assert.equal(typeof entry.transparentQa.pixel.highSaturationGreenOrMagentaPixels, "number", asset.id);
      assert.equal(typeof entry.transparentQa.pixel.hardAlphaJumpPixels, "number", asset.id);
      assert.ok(entry.transparentQa.pixel.composite.paper, asset.id);
      assert.ok(entry.transparentQa.pixel.composite.dark, asset.id);
    }
  }
});

test("S73.9 frontend asset QA script and preview expose the reusable QA workflow", () => {
  const scriptText = fs.readFileSync(assetQaScriptPath, "utf8");
  const previewText = fs.readFileSync(assetQaPreviewPath, "utf8");
  assert.doesNotMatch(previewText, FORBIDDEN_SECRET_OR_LOCAL_PATH);
  assert.equal(scriptText.includes("sk-live"), false);
  assert.equal(scriptText.includes("tp-live"), false);

  for (const requiredText of [
    "--write --pixel",
    "asset-qa-report-v1.json",
    "highSaturationGreenOrMagentaPixels",
    "hardAlphaJumpPixels",
    "compositeBackgrounds",
    "fallbackRef",
    "runtimeUsable"
  ]) {
    assert.equal(scriptText.includes(requiredText), true, requiredText);
  }

  for (const requiredText of [
    "ink-ui-manifest.json",
    "asset-qa-report-v1.json",
    "宣纸底",
    "深色底",
    "transparent",
    "fallback"
  ]) {
    assert.equal(previewText.includes(requiredText), true, requiredText);
  }
});

test("S73.10.6 portrait compression QA pins thumbnails, placeholders, crop metadata, and lazy loading", () => {
  const reportText = fs.readFileSync(portraitCompressionQaPath, "utf8");
  assert.doesNotMatch(reportText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  assert.doesNotMatch(reportText, FORBIDDEN_ASSET_VALUE);
  const report = JSON.parse(reportText);
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  const scriptText = fs.readFileSync(portraitCompressionQaScriptPath, "utf8");

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.phase, "S73.10.6");
  assert.equal(report.reportId, "portrait-compression-qa-v1");
  assert.equal(report.manifestSha256, crypto.createHash("sha256").update(manifestText).digest("hex"));
  assert.deepEqual(report.policy.imageSize, { width: 1024, height: 1536 });
  assert.deepEqual(report.policy.thumbnailSize, { width: 384, height: 576 });
  assert.deepEqual(report.policy.lowResPlaceholderSize, { width: 64, height: 96 });
  assert.equal(report.policy.requireSafeArea, true);
  assert.equal(report.policy.requireFocalPoint, true);
  assert.equal(report.policy.requireMobileCropKeepSafeArea, true);
  assert.equal(report.policy.requireThumbnailFirst, true);
  assert.equal(report.policy.requireLowResPlaceholder, true);
  assert.equal(report.policy.allowEagerLoad, false);
  assert.equal(report.policy.maxInitialPortraits, 8);
  assert.equal(report.summary.portraitAssets, 790);
  assert.equal(report.summary.s7310PortraitAssets, 572);
  assert.equal(report.summary.baselinePortraitAssets, 24);
  assert.equal(report.summary.errorCount, 0);
  assert.equal(report.summary.warningCount, 0);
  assert.equal(report.summary.allowEagerLoadViolations, 0);
  assert.deepEqual(report.summary.byPhase, {
    "S73.7": 24,
    "S73.10.2": 192,
    "S73.10.3": 188,
    "S73.10.4": 72,
    "S73.10.5": 72,
    "S73.10.7": 48,
    "S79.2": 194
  });
  assert.deepEqual(report.summary.byLazyLoadGroup, {
    portrait_baseline_s73_7: 24,
    portrait_pool_player_s73_10: 72,
    portrait_pool_generic_npc_s73_10: 188,
    portrait_pool_player_female_extra_s73_10: 60,
    portrait_pool_player_male_extra_s73_10: 60,
    portrait_pool_signature_npc_s73_10: 72,
    portrait_pool_state_variant_s73_10: 48,
    portrait_pool_scene_anchor_s73_10: 24,
    portrait_pool_young_female_s73_10_7: 48,
    portrait_pool_recovered_female_s79_2: 194
  });

  const manifestPortraits = manifest.assets.filter((asset) => asset.category === "portrait");
  assert.equal(report.assets.length, manifestPortraits.length);
  const reportById = new Map(report.assets.map((entry) => [entry.id, entry]));
  assert.equal(reportById.size, report.assets.length);
  for (const asset of manifestPortraits) {
    const entry = reportById.get(asset.id);
    assert.ok(entry, asset.id);
    assert.equal(entry.portraitRef, asset.portraitRef, asset.id);
    assert.equal(entry.path, asset.path, asset.id);
    assert.equal(entry.thumbnailPath, asset.thumbnailPath, asset.id);
    assert.equal(entry.lowResPlaceholderPath, asset.lowResPlaceholderPath, asset.id);
    assert.deepEqual(entry.safeArea, asset.safeArea, asset.id);
    assert.deepEqual(entry.focalPoint, asset.focalPoint, asset.id);
    assert.equal(entry.mobileCrop.keepSafeArea, true, asset.id);
    assert.equal(entry.lazyLoad.allowEagerLoad, false, asset.id);
    assert.equal(entry.lazyLoad.thumbnailFirst, true, asset.id);
    assert.equal(entry.lazyLoad.lowResPlaceholder, true, asset.id);
    assert.equal(entry.lazyLoad.maxInitialPortraits, 8, asset.id);
    assert.equal(entry.issues.length, 0, asset.id);

    const imagePath = resolveUiAssetPath(asset.path);
    const thumbnailPath = resolveUiAssetPath(asset.thumbnailPath);
    const placeholderPath = resolveUiAssetPath(asset.lowResPlaceholderPath);
    assert.equal(entry.files.image.sha256, sha256File(imagePath), asset.id);
    assert.equal(entry.files.image.bytes, fs.statSync(imagePath).size, asset.id);
    assert.deepEqual(entry.files.image.dimensions, { width: 1024, height: 1536, alpha: false }, asset.id);
    assert.equal(entry.files.thumbnail.sha256, sha256File(thumbnailPath), asset.id);
    assert.equal(entry.files.thumbnail.bytes, fs.statSync(thumbnailPath).size, asset.id);
    assert.deepEqual(entry.files.thumbnail.dimensions, { width: 384, height: 576, alpha: false }, asset.id);
    assert.equal(entry.files.lowResPlaceholder.sha256, sha256File(placeholderPath), asset.id);
    assert.equal(entry.files.lowResPlaceholder.bytes, fs.statSync(placeholderPath).size, asset.id);
    assert.deepEqual(entry.files.lowResPlaceholder.dimensions, { width: 64, height: 96, alpha: false }, asset.id);
    assert.equal(entry.performance.bytes <= entry.performance.targetMaxBytes, true, asset.id);
    assert.equal(entry.performance.thumbnailBytes <= entry.performance.thumbnailTargetMaxBytes, true, asset.id);
    assert.equal(entry.performance.lowResPlaceholderBytes <= entry.performance.lowResPlaceholderTargetMaxBytes, true, asset.id);
  }

  for (const requiredText of [
    "--write",
    "portrait-compression-qa-v1.json",
    "allowEagerLoad",
    "thumbnailFirst",
    "lowResPlaceholder",
    "safeArea",
    "focalPoint",
    "mobileCrop"
  ]) {
    assert.equal(scriptText.includes(requiredText), true, requiredText);
  }
});

test("S73.10 portrait pool matrix locks planned counts and player pool handoff", () => {
  const matrixText = fs.readFileSync(portraitPoolMatrixPath, "utf8");
  assert.doesNotMatch(matrixText, FORBIDDEN_MANIFEST_REMOTE_OR_LOCAL_PATH);
  const matrix = JSON.parse(matrixText);
  const manifest = readJson(manifestPath);
  const manifestPortraitRefs = new Set(
    manifest.assets.filter((asset) => asset.category === "portrait").map((asset) => asset.portraitRef)
  );

  assert.equal(matrix.schemaVersion, 1);
  assert.equal(matrix.phase, "S73.10.1");
  assert.equal(matrix.status, "matrix_locked");
  assert.equal(matrix.targetCount, 336);
  assert.deepEqual(matrix.countPlan, {
    player: 72,
    generic_npc: 120,
    signature_npc: 72,
    state_variant: 48,
    scene_anchor: 24
  });
  assert.equal(matrix.reviewPolicy.generatedImagesRequireCodexVisualReview, true);
  assert.equal(matrix.reviewPolicy.usableOnlyAfterManifestEntry, true);
  assert.equal(matrix.reviewPolicy.runtimeUsableBeforeImageGeneration, false);
  assert.equal(matrix.reviewPolicy.importantNpcMustNotUseGenericPortrait, true);
  assert.equal(matrix.reviewPolicy.noFullPoolEagerLoad, true);
  assert.equal(matrix.promptTemplates.length, 12);
  assert.equal(matrix.promptTemplateCoverage.missing.length, 0);

  const refs = new Set();
  const plannedPaths = new Set();
  const byGroup = new Map();
  const templateIds = new Set(matrix.promptTemplates.map((template) => template.id));
  for (const entry of matrix.entries) {
    assert.equal(entry.phase, "S73.10.1", entry.portraitRef);
    assert.equal(entry.reviewStatus, "planned", entry.portraitRef);
    assert.equal(entry.visualReviewStatus, "pending_codex_review", entry.portraitRef);
    assert.equal(entry.safetyReviewStatus, "pending_codex_review", entry.portraitRef);
    assert.equal(entry.runtimeUsable, false, entry.portraitRef);
    assert.equal(entry.fallbackRef, "fallback-role-silhouette-v1", entry.portraitRef);
    assert.equal(entry.portraitRef.startsWith("portrait-s73-10-"), true, entry.portraitRef);
    const isGeneratedMatrixEntry =
      (entry.matrixGroup === "player" && entry.productionStep === "S73.10.2") ||
      (entry.matrixGroup === "generic_npc" && entry.productionStep === "S73.10.3") ||
      (entry.matrixGroup === "signature_npc" && entry.productionStep === "S73.10.4") ||
      (entry.matrixGroup === "state_variant" && entry.productionStep === "S73.10.5") ||
      (entry.matrixGroup === "scene_anchor" && entry.productionStep === "S73.10.5");
    assert.equal(manifestPortraitRefs.has(entry.portraitRef), isGeneratedMatrixEntry, entry.portraitRef);
    assert.equal(String(entry.ageBand).startsWith("adult"), true, entry.portraitRef);
    assert.equal(templateIds.has(entry.promptTemplateRef), true, entry.portraitRef);
    if (entry.matrixGroup === "signature_npc") {
      assert.equal(entry.usage.includes("npc_pool"), false, entry.portraitRef);
    }
    for (const field of ["plannedPath", "thumbnailPath", "lowResPlaceholderPath"]) {
      assertSafeUiAssetPath(entry[field], `${entry.portraitRef}.${field}`);
      assert.equal(plannedPaths.has(entry[field]), false, entry[field]);
      plannedPaths.add(entry[field]);
    }
    assert.equal(refs.has(entry.portraitRef), false, entry.portraitRef);
    refs.add(entry.portraitRef);
    byGroup.set(entry.matrixGroup, (byGroup.get(entry.matrixGroup) || 0) + 1);
  }
  assert.deepEqual(Object.fromEntries([...byGroup.entries()].sort()), {
    generic_npc: 120,
    player: 72,
    scene_anchor: 24,
    signature_npc: 72,
    state_variant: 48
  });
});

test("S73.10.1 portrait matrix keeps creative prompts natural and documents safety handoff", () => {
  const matrix = readJson(portraitPoolMatrixPath);
  const docText = fs.readFileSync(portraitMatrixDocPath, "utf8");
  const scriptText = fs.readFileSync(portraitMatrixScriptPath, "utf8");

  assert.doesNotMatch(docText, FORBIDDEN_SECRET_OR_LOCAL_PATH);
  assert.equal(fs.existsSync(portraitMatrixScriptPath), true);
  assert.equal(scriptText.includes("targetCount !== 336"), true);
  assert.equal(scriptText.includes("runtime usable before image generation"), true);

  for (const template of matrix.promptTemplates) {
    assert.equal(typeof template.draft, "string", template.id);
    assert.ok(template.draft.length > 40, template.id);
    assert.doesNotMatch(template.draft, /--ar|seed|CFG|width|height|negative prompt/i, template.id);
    assert.match(template.draft, /[，；]/, template.id);
  }
  for (const requiredText of [
    "336 张",
    "不批量生图",
    "prompt 母版",
    "角色必须是明确成年人",
    "未通过审核的候选图不得进入 runtime usable 状态",
    "重要 NPC 不混入通用头像池"
  ]) {
    assert.equal(docText.includes(requiredText), true, requiredText);
  }
});

test("S73.2 frontend asset ledger records manifest, fallback, portrait, and source tracking fields", () => {
  const ledgerText = fs.readFileSync(ledgerPath, "utf8");
  assert.doesNotMatch(ledgerText, FORBIDDEN_SECRET_OR_LOCAL_PATH);

  for (const requiredText of [
    "Manifest 草案记录",
    "素材记录",
    "立绘矩阵",
    "参考素材记录",
    "ui-fallback-paper-panel-v1",
    "ui-fallback-role-silhouette-v1",
    "ui-fallback-ink-motion-static-v1",
    "portraitRef",
    "genderPresentation",
    "statusVariant",
    "低清占位路径",
    "reference-only",
    "texture-source",
    "direct-asset-candidate",
    "S73.10 全量立绘池不得标记为首页 eager load",
    "ui-paper-xuan-base-v1",
    "ui-vermilion-seal-button-v1",
    "ui-imperial-notice-paper-v1",
    "ui-home-scroll-landscape-v1",
    "ui-home-cinnabar-start-seal-v1",
    "ui-home-static-reduced-motion-v1",
    "ui-scene-study-chamber-v1",
    "ui-scene-exam-cell-v1",
    "ui-scene-ranking-wall-v1",
    "ui-scene-palace-exam-hall-v1",
    "ui-scene-county-yamen-v1",
    "ui-scene-courtroom-trial-v1",
    "ui-scene-military-tent-v1",
    "ui-scene-imperial-desk-v1",
    "ui-scene-city-lanes-v1",
    "ui-scene-bureau-documents-v1",
    "ui-role-scholar-study-v1",
    "ui-role-magistrate-yamen-desk-v1",
    "ui-role-official-duty-room-v1",
    "ui-role-minister-palace-desk-v1",
    "ui-role-general-frontier-tent-v1",
    "ui-role-emperor-imperial-desk-v1",
    "portrait-player-scholar-m01-v1",
    "portrait-player-scholar-f01-v1",
    "portrait-npc-female-official-f01-v1",
    "portrait-npc-examiner-m01-v1",
    "portrait-baseline-qa-v1.json",
    "portrait-player-pool-qa-v1.json",
    "portrait-player-female-reset-qa-v1.json",
    "portrait-player-male-extra-qa-v1.json",
    "portrait-generic-npc-pool-qa-v1.json",
    "portrait-signature-npc-pool-qa-v1.json",
    "portrait-state-scene-pool-qa-v1.json",
    "portrait-young-female-pool-qa-v1.json",
    "portrait-recovered-female-pool-qa-v1.json",
    "portrait-single-override-qa-v1.json",
    "portrait-compression-qa-v1.json",
    "qa:recovered-female-portraits",
    "qa:single-portrait-overrides",
    "qa:portrait-compression",
    "portrait_baseline_s73_7",
    "portrait_pool_player_s73_10",
    "portrait_pool_player_female_extra_s73_10",
    "portrait_pool_player_male_extra_s73_10",
    "portrait_pool_generic_npc_s73_10",
    "portrait_pool_signature_npc_s73_10",
    "portrait_pool_state_variant_s73_10",
    "portrait_pool_scene_anchor_s73_10",
    "portrait_pool_young_female_s73_10_7",
    "portrait_pool_recovered_female_s79_2",
    "玩家女性风格补充池",
    "玩家男性风格补充池",
    "女性风格扩展池",
    "重要 NPC 专属池",
    "状态/姿态与场景锚点池",
    "年轻女性补充池",
    "Recovered 女性高清母版池",
    "state_variant_pool",
    "scene_anchor_pool",
    "signature_npc_pool",
    "palace-lady",
    "tang-lady",
    "fallback-ink-motion-static-v1"
  ]) {
    assert.equal(ledgerText.includes(requiredText), true, requiredText);
  }
});
