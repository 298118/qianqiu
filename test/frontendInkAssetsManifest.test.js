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
const effectMotionQaPath = path.join(repoRoot, "public", "assets", "ui", "effects", "effect-motion-qa-v1.json");
const assetQaReportPath = path.join(repoRoot, "public", "assets", "ui", "asset-qa-report-v1.json");
const assetQaPreviewPath = path.join(repoRoot, "public", "assets", "ui", "asset-qa-preview.html");
const assetQaScriptPath = path.join(repoRoot, "scripts", "frontendAssetQa.js");

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
  assert.equal(manifest.assets.length, 70, "S73.3-S73.8 UI assets are active");

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

  for (const asset of manifest.assets) {
    assert.equal(["S73.3", "S73.4", "S73.5", "S73.6", "S73.7", "S73.8"].includes(asset.phase), true, asset.id);
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
    "portrait_baseline_s73_7",
    "fallback-ink-motion-static-v1"
  ]) {
    assert.equal(ledgerText.includes(requiredText), true, requiredText);
  }
});
