const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const ledgerPath = path.join(repoRoot, "docs", "FRONTEND_ASSET_LEDGER.md");

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
  assert.equal(manifest.assets.length, 16, "S73.3 adds the first UI material pack");

  for (const asset of manifest.assets) {
    assert.equal(asset.phase, "S73.3", asset.id);
    assert.equal(asset.category, "material", asset.id);
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
    "ui-imperial-notice-paper-v1"
  ]) {
    assert.equal(assetIds.has(requiredId), true, requiredId);
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
    "ui-imperial-notice-paper-v1"
  ]) {
    assert.equal(ledgerText.includes(requiredText), true, requiredText);
  }
});
