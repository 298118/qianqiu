const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const sourceManifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const runtimeManifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-runtime-manifest.json");
const SAFE_RUNTIME_ASSET_PATH_PREFIX = "/assets/ui/";
const SAFE_RUNTIME_HIGH_RES_SOURCE_FLAG = "kept_outside_public_manifest";
const FORBIDDEN_RUNTIME_TEXT_PATTERN =
  /(OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/]|file:\/\/|https?:\/\/|data:|data[\\/](?:sessions|audit)|artifacts[\\/]|world[_ -]?sessions|prompt[_ -]?retrieval[_ -]?index|event[_ -]?log|ai[_ -]?change[_ -]?proposals|provider(?:\s+|[_ -])?payload|raw[_ -]?(?:audit|state|prompt|provider|payload|table|ledger)|hidden(?:Notes|Intent|Dossier|Truth|Ledger)|hidden[_ -]?(?:notes|intent|dossier|truth|ledger)|private[_ -]?signal|secret[_ -]?relationships|state[_ -]?patch|safe[_ -]?search[_ -]?index|local[_ -]?high[_ -]?res[_ -]?source[_ -]?path|sqlite|SQL|完整\s*prompt|本地\s*路径|密\s*钥)/i;

const RUNTIME_MANIFEST_TOP_LEVEL_KEYS = Object.freeze(new Set([
  "schemaVersion",
  "assetSetId",
  "assetRoot",
  "runtimeUsableReviewStatuses",
  "runtimeBlockedReviewStatuses",
  "fallbackCatalog",
  "assets"
]));

const RUNTIME_FALLBACK_KEYS = Object.freeze(new Set([
  "id",
  "category",
  "type",
  "usage",
  "cssTokens",
  "reviewStatus",
  "ledgerId"
]));

const RUNTIME_ASSET_KEYS = Object.freeze(new Set([
  "id",
  "category",
  "subcategory",
  "usage",
  "role",
  "roleLabel",
  "scene",
  "path",
  "thumbnailPath",
  "lowResPlaceholderPath",
  "fallbackRef",
  "reviewStatus",
  "portraitRef",
  "genderPresentation",
  "ageBand",
  "roleStage",
  "statusVariant",
  "emotionVariant",
  "identityTags",
  "emotionTags",
  "lazyLoad",
  "source"
]));

const RUNTIME_PORTRAIT_REQUIRED_KEYS = Object.freeze([
  "portraitRef",
  "genderPresentation",
  "ageBand",
  "statusVariant",
  "thumbnailPath",
  "lowResPlaceholderPath",
  "fallbackRef",
  "lazyLoad"
]);

const RUNTIME_NON_PORTRAIT_ONLY_KEYS = Object.freeze([
  "portraitRef",
  "genderPresentation",
  "ageBand",
  "roleStage",
  "statusVariant",
  "emotionVariant",
  "identityTags",
  "emotionTags",
  "lowResPlaceholderPath",
  "lazyLoad",
  "source"
]);

const RUNTIME_LAZY_LOAD_KEYS = Object.freeze(new Set([
  "group",
  "allowEagerLoad",
  "thumbnailFirst",
  "lowResPlaceholder",
  "maxInitialPortraits"
]));

const RUNTIME_SOURCE_KEYS = Object.freeze(new Set(["localHighResSource"]));

function compactObject(value) {
  if (Array.isArray(value)) {
    return value.map(compactObject).filter((entry) => entry !== undefined);
  }
  if (value && typeof value === "object") {
    const compacted = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const cleanValue = compactObject(nestedValue);
      if (cleanValue !== undefined) compacted[key] = cleanValue;
    }
    return compacted;
  }
  return value === undefined ? undefined : value;
}

function projectFallback(fallback) {
  return compactObject({
    id: fallback.id,
    category: fallback.category,
    type: fallback.type,
    usage: fallback.usage,
    cssTokens: fallback.cssTokens,
    reviewStatus: fallback.reviewStatus,
    ledgerId: fallback.ledgerId
  });
}

function projectAsset(asset) {
  return compactObject({
    id: asset.id,
    category: asset.category,
    subcategory: asset.subcategory,
    usage: asset.usage,
    role: asset.role,
    roleLabel: asset.roleLabel,
    scene: asset.scene,
    path: asset.path,
    thumbnailPath: asset.thumbnailPath,
    lowResPlaceholderPath: asset.lowResPlaceholderPath,
    fallbackRef: asset.fallbackRef,
    reviewStatus: asset.reviewStatus,
    portraitRef: asset.portraitRef,
    genderPresentation: asset.genderPresentation,
    ageBand: asset.ageBand,
    roleStage: asset.roleStage,
    statusVariant: asset.statusVariant,
    emotionVariant: asset.emotionVariant,
    identityTags: asset.identityTags,
    emotionTags: asset.emotionTags,
    lazyLoad: asset.lazyLoad,
    source: asset.source?.localHighResSource
      ? { localHighResSource: asset.source.localHighResSource }
      : undefined
  });
}

function buildRuntimeManifest(sourceManifest) {
  return compactObject({
    schemaVersion: sourceManifest.schemaVersion,
    assetSetId: sourceManifest.assetSetId,
    assetRoot: sourceManifest.assetRoot,
    runtimeUsableReviewStatuses: sourceManifest.runtimeUsableReviewStatuses,
    runtimeBlockedReviewStatuses: sourceManifest.runtimeBlockedReviewStatuses,
    fallbackCatalog: (sourceManifest.fallbackCatalog || []).map(projectFallback),
    assets: (sourceManifest.assets || []).map(projectAsset)
  });
}

function collectUnexpectedKeys(value, allowedKeys, label, failures) {
  for (const key of Object.keys(value || {})) {
    if (!allowedKeys.has(key)) failures.push(`${label} 暴露运行时不允许字段：${key}`);
  }
}

function collectForbiddenRuntimeText(value, label, failures) {
  if (value == null) return;
  if (typeof value === "string") {
    if (FORBIDDEN_RUNTIME_TEXT_PATTERN.test(value)) {
      failures.push(`${label} 包含本地路径、密钥、raw/provider/hidden 或作者侧文本：${value}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenRuntimeText(item, `${label}[${index}]`, failures));
    return;
  }
  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      collectForbiddenRuntimeText(key, `${label}.${key} key`, failures);
      collectForbiddenRuntimeText(nestedValue, `${label}.${key}`, failures);
    }
  }
}

function isSafeRuntimeAssetPath(assetPath) {
  return (
    typeof assetPath === "string" &&
    assetPath.startsWith(SAFE_RUNTIME_ASSET_PATH_PREFIX) &&
    !assetPath.includes("..") &&
    !FORBIDDEN_RUNTIME_TEXT_PATTERN.test(assetPath)
  );
}

function validateRuntimeAssetPath(assetPath, label, failures) {
  if (!isSafeRuntimeAssetPath(assetPath)) {
    failures.push(`${label} 必须是 ${SAFE_RUNTIME_ASSET_PATH_PREFIX} 下的安全项目路径。`);
  }
}

function validateRuntimeFallback(fallback, usableStatuses, index, failures) {
  const label = `fallbackCatalog[${index}]`;
  collectUnexpectedKeys(fallback, RUNTIME_FALLBACK_KEYS, label, failures);
  if (!usableStatuses.has(fallback.reviewStatus)) {
    failures.push(`${label} reviewStatus 不在 runtime 可用状态内：${fallback.reviewStatus}`);
  }
  if (fallback.category !== "fallback") failures.push(`${label} category 必须是 fallback。`);
  if (fallback.type !== "css_token") failures.push(`${label} type 必须是 css_token。`);
}

function validateRuntimeAsset(asset, context, index, failures) {
  const label = `assets[${index}] ${asset?.id || "(missing id)"}`;
  collectUnexpectedKeys(asset, RUNTIME_ASSET_KEYS, label, failures);

  if (!asset || typeof asset !== "object") {
    failures.push(`${label} 不是对象。`);
    return;
  }
  if (!asset.id || typeof asset.id !== "string") failures.push(`${label} 缺少稳定 id。`);
  if (!context.usableStatuses.has(asset.reviewStatus)) {
    failures.push(`${label} reviewStatus 不在 runtime 可用状态内：${asset.reviewStatus}`);
  }
  validateRuntimeAssetPath(asset.path, `${label}.path`, failures);
  if (asset.thumbnailPath) validateRuntimeAssetPath(asset.thumbnailPath, `${label}.thumbnailPath`, failures);
  if (asset.fallbackRef && !context.fallbackIds.has(asset.fallbackRef)) {
    failures.push(`${label}.fallbackRef 未指向 runtime fallback：${asset.fallbackRef}`);
  }

  if (asset.category === "portrait") {
    validateRuntimePortraitAsset(asset, label, failures);
  } else {
    for (const key of RUNTIME_NON_PORTRAIT_ONLY_KEYS) {
      if (asset[key] !== undefined) failures.push(`${label} 非立绘资产不得携带 ${key}。`);
    }
  }
}

function validateRuntimePortraitAsset(asset, label, failures) {
  for (const key of RUNTIME_PORTRAIT_REQUIRED_KEYS) {
    if (asset[key] === undefined || asset[key] === null || asset[key] === "") {
      failures.push(`${label} 缺少立绘运行时必需字段：${key}`);
    }
  }
  if (asset.portraitRef !== asset.id) {
    failures.push(`${label}.portraitRef 必须与 id 一致。`);
  }
  validateRuntimeAssetPath(asset.lowResPlaceholderPath, `${label}.lowResPlaceholderPath`, failures);
  if (!String(asset.ageBand || "").startsWith("adult")) {
    failures.push(`${label}.ageBand 必须明确为成年立绘：${asset.ageBand}`);
  }

  const lazyLoad = asset.lazyLoad || {};
  collectUnexpectedKeys(lazyLoad, RUNTIME_LAZY_LOAD_KEYS, `${label}.lazyLoad`, failures);
  if (lazyLoad.allowEagerLoad !== false) {
    failures.push(`${label}.lazyLoad.allowEagerLoad 必须为 false。`);
  }
  if (lazyLoad.thumbnailFirst !== true) {
    failures.push(`${label}.lazyLoad.thumbnailFirst 必须为 true。`);
  }
  if (lazyLoad.lowResPlaceholder !== true) {
    failures.push(`${label}.lazyLoad.lowResPlaceholder 必须为 true。`);
  }
  if (!Number.isFinite(lazyLoad.maxInitialPortraits) || lazyLoad.maxInitialPortraits < 1 || lazyLoad.maxInitialPortraits > 8) {
    failures.push(`${label}.lazyLoad.maxInitialPortraits 必须在 1..8。`);
  }
  if (!lazyLoad.group || typeof lazyLoad.group !== "string") {
    failures.push(`${label}.lazyLoad.group 缺少懒加载分组。`);
  }

  if (asset.source !== undefined) {
    collectUnexpectedKeys(asset.source, RUNTIME_SOURCE_KEYS, `${label}.source`, failures);
    if (asset.source?.localHighResSource !== SAFE_RUNTIME_HIGH_RES_SOURCE_FLAG) {
      failures.push(`${label}.source 只能公开 ${SAFE_RUNTIME_HIGH_RES_SOURCE_FLAG} 标记。`);
    }
  }
}

function validateRuntimeManifestSafety(runtimeManifest) {
  const failures = [];
  collectUnexpectedKeys(runtimeManifest, RUNTIME_MANIFEST_TOP_LEVEL_KEYS, "runtime manifest", failures);
  collectForbiddenRuntimeText(runtimeManifest, "runtime manifest", failures);

  if (runtimeManifest.schemaVersion !== 1) failures.push("runtime manifest schemaVersion 必须为 1。");
  if (runtimeManifest.assetSetId !== "ink-ui-v1") failures.push("runtime manifest assetSetId 必须为 ink-ui-v1。");
  if (runtimeManifest.assetRoot !== SAFE_RUNTIME_ASSET_PATH_PREFIX) {
    failures.push(`runtime manifest assetRoot 必须为 ${SAFE_RUNTIME_ASSET_PATH_PREFIX}。`);
  }
  if (!Array.isArray(runtimeManifest.runtimeUsableReviewStatuses) || runtimeManifest.runtimeUsableReviewStatuses.length === 0) {
    failures.push("runtime manifest 缺少 runtimeUsableReviewStatuses。");
  }

  const usableStatuses = new Set(runtimeManifest.runtimeUsableReviewStatuses || []);
  const fallbackIds = new Set();
  for (const [index, fallback] of (runtimeManifest.fallbackCatalog || []).entries()) {
    validateRuntimeFallback(fallback, usableStatuses, index, failures);
    if (fallback?.id) fallbackIds.add(fallback.id);
  }

  const assetIds = new Set();
  const portraitRefs = new Set();
  const context = { usableStatuses, fallbackIds };
  for (const [index, asset] of (runtimeManifest.assets || []).entries()) {
    validateRuntimeAsset(asset, context, index, failures);
    if (asset?.id) {
      if (assetIds.has(asset.id)) failures.push(`runtime manifest 重复 asset id：${asset.id}`);
      assetIds.add(asset.id);
    }
    if (asset?.portraitRef) {
      if (portraitRefs.has(asset.portraitRef)) failures.push(`runtime manifest 重复 portraitRef：${asset.portraitRef}`);
      portraitRefs.add(asset.portraitRef);
    }
  }

  if (failures.length > 0) {
    const preview = failures.slice(0, 20).map((failure) => `- ${failure}`).join("\n");
    const suffix = failures.length > 20 ? `\n- ...另有 ${failures.length - 20} 项` : "";
    throw new Error(`ink-ui-runtime-manifest.json 运行时安全校验失败：\n${preview}${suffix}`);
  }

  return true;
}

function serializeRuntimeManifest(runtimeManifest) {
  return `${JSON.stringify(runtimeManifest)}\n`;
}

function loadSourceManifest() {
  return JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
}

function checkRuntimeManifest({ write = false } = {}) {
  const sourceManifest = loadSourceManifest();
  const runtimeManifest = buildRuntimeManifest(sourceManifest);
  validateRuntimeManifestSafety(runtimeManifest);
  const expected = serializeRuntimeManifest(runtimeManifest);

  if (write) {
    fs.writeFileSync(runtimeManifestPath, expected);
  }

  const existing = fs.existsSync(runtimeManifestPath) ? fs.readFileSync(runtimeManifestPath, "utf8") : "";
  if (existing !== expected) {
    throw new Error("ink-ui-runtime-manifest.json 已过期；请运行 npm run qa:runtime-manifest:write。");
  }

  return {
    sourceBytes: fs.statSync(sourceManifestPath).size,
    runtimeBytes: Buffer.byteLength(expected),
    assetCount: runtimeManifest.assets.length,
    fallbackCount: runtimeManifest.fallbackCatalog.length
  };
}

function parseArgs(argv = process.argv) {
  return {
    write: argv.includes("--write"),
    help: argv.includes("--help") || argv.includes("-h")
  };
}

function printHelp() {
  console.log(`Usage: node scripts/frontendRuntimeManifest.js [--write]

Creates or checks the compact browser runtime manifest:
  public/assets/ui/ink-ui-runtime-manifest.json
`);
}

if (require.main === module) {
  try {
    const args = parseArgs();
    if (args.help) {
      printHelp();
    } else {
      const summary = checkRuntimeManifest({ write: args.write });
      console.log(
        `Runtime manifest OK: ${summary.assetCount} assets, ${summary.fallbackCount} fallbacks, ${summary.runtimeBytes}/${summary.sourceBytes} bytes`
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  buildRuntimeManifest,
  checkRuntimeManifest,
  validateRuntimeManifestSafety,
  runtimeManifestPath,
  sourceManifestPath
};
