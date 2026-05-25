const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright-core");
const { app, hasReactClientBuild } = require("../server");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");
const {
  assertPngScreenshot,
  normalizeBaseUrl,
  resolveBrowserExecutable,
  sanitizeScreenshotName
} = require("./browserSmoke");

const VIEWPORTS = Object.freeze({
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 }
});

const hiddenTextTokens = Object.freeze([
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "MIMO_API_KEY",
  "ANTHROPIC_API_KEY",
  "hiddenNotes",
  "hiddenIntent",
  "data/sessions",
  "provider payload",
  "raw audit",
  "world_sessions",
  "prompt_retrieval_index"
]);

const requiredVisualMatrixScreenshotLabels = Object.freeze([
  "s74-react-home-desktop",
  "s74-react-home-mobile",
  "s74-react-mock-start-desktop",
  "s76-scholar-panel-desktop",
  "s74-react-map-runtime-desktop",
  "s76-map-fullscreen-mobile",
  "s76-people-ledger-desktop",
  "s79-3-portrait-viewer-desktop",
  "s89-2-inventory-desktop",
  "s89-2-inventory-refresh-desktop",
  "s89-2-inventory-mobile",
  "s74-react-archive-desktop",
  "s88-9-archive-mobile",
  "s76-exam-fullscreen-desktop",
  "s76-exam-fullscreen-mobile",
  "s76-ranking-fullscreen-desktop",
  "s76-ranking-fullscreen-mobile",
  "s78-topic-surfaces-desktop",
  "s74-react-court-refresh-desktop",
  "s74-react-settings-refresh-desktop",
  "s75-inkbox-mobile"
]);

const inventoryPlayerFacingLeakPattern = /provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|hidden\/raw|(?:^|\b)hidden\b|(?:^|\b)raw\b|服务器裁决|draftContext|manifest|schema|[a-z]:[\\/]|\/(?:home|mnt|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)/gi;

const safetyPollutionPattern = /\/api\/game\/state|\/api\/dev\/session-diagnostics|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[a-z0-9_-]{6,}|tp-[a-z0-9_-]{6,}|data[\\/]+sessions|world_sessions|prompt_retrieval_index|event_log|ai_change_proposals|provider\s+payload|raw\s+(?:audit|state|prompt|provider|payload)|hiddenNotes|hiddenIntent|hidden\s+(?:notes|intent|ledger|truth)|完整\s*(?:prompt|提示词)|本地\s*路径|密\s*钥|模型\s*原始|内部审计原文|弥封身份映射|考官隐藏意图|未采纳评语|[a-z]:[\\/]|file:\/{2}|(?<![A-Za-z0-9_-])\/(?:home|Users|tmp|var|mnt|etc)\/[^\s"'<>)]*/gi;
const playerFacingCopyLeakPattern = /\bTODO\b|\bFIXME\b|\bsmoke\b|\bartifacts?\b|\bS7[0-9](?:\.\d+)?\b|\bdebug\b|\bstub\b|\bplaceholder\b|验收|测试截图|开发注释|实现说明|fallback token|data-client-entry|React Router|Vite/gi;
const visualTextSelectors = Object.freeze([
  "h1",
  "h2",
  "h3",
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "[role='button']"
]);
const visualOverlapIgnoreSelectors = Object.freeze([
  ".memorialComposer",
  ".topBar",
  ".sessionNav",
  ".drawerHost",
  ".surfaceHost",
  ".inkMapTooltip",
  ".inkMapLabel",
  ".homeMist",
  ".homeBackdrop",
  ".examHeroBackdrop",
  ".rankingHeroBackdrop"
]);
const visualOverflowIgnoreSelectors = Object.freeze(
  visualOverlapIgnoreSelectors.filter((selector) => selector !== ".sessionNav")
);

const runnableSessionIdPattern = /^[a-f0-9-]{36}$/i;
const runtimeAssetManifestPath = "/assets/ui/ink-ui-runtime-manifest.json";
const sourceAssetManifestPath = "/assets/ui/ink-ui-manifest.json";
const safeRuntimeAssetPathPrefix = "/assets/ui/";
const runtimeHighResSourceFlag = "kept_outside_public_manifest";
const runtimeManifestTopLevelKeys = Object.freeze(new Set([
  "schemaVersion",
  "assetSetId",
  "assetRoot",
  "runtimeUsableReviewStatuses",
  "runtimeBlockedReviewStatuses",
  "fallbackCatalog",
  "assets"
]));
const runtimeFallbackKeys = Object.freeze(new Set([
  "id",
  "category",
  "type",
  "usage",
  "cssTokens",
  "reviewStatus",
  "ledgerId"
]));
const runtimeAssetKeys = Object.freeze(new Set([
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
const runtimeNonPortraitOnlyKeys = Object.freeze([
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
const runtimeLazyLoadKeys = Object.freeze(new Set([
  "group",
  "allowEagerLoad",
  "thumbnailFirst",
  "lowResPlaceholder",
  "maxInitialPortraits"
]));
const runtimeSourceKeys = Object.freeze(new Set(["localHighResSource"]));
const runtimePortraitGroupSubcategory = Object.freeze({
  portrait_baseline_s73_7: "portrait_style_baseline",
  portrait_pool_generic_npc_s73_10: "generic_npc_pool",
  portrait_pool_player_female_extra_s73_10: "player_female_style_pool",
  portrait_pool_player_male_extra_s73_10: "player_male_style_pool",
  portrait_pool_player_s73_10: "player_identity_stage_pool",
  portrait_pool_recovered_female_s79_2: "recovered_female_highres_pool",
  portrait_pool_scene_anchor_s73_10: "scene_anchor_pool",
  portrait_pool_signature_npc_s73_10: "signature_npc_pool",
  portrait_pool_state_variant_s73_10: "state_variant_pool",
  portrait_pool_young_female_s73_10_7: "young_female_style_pool"
});
const runtimeManifestUnsafeTextPattern =
  /(OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/]|file:\/\/|https?:\/\/|data:|data[\\/](?:sessions|audit)|artifacts[\\/]|world[_ -]?sessions|prompt[_ -]?retrieval[_ -]?index|event[_ -]?log|ai[_ -]?change[_ -]?proposals|provider(?:Payload|Response|Raw|Name|Id|(?:\s+|[_ -])payload)?|prompt(?:Summary|Text|Payload|Raw|Template)?|raw(?:Audit|State|Prompt|Provider|Payload|Table|Ledger|[_ -]?(?:audit|state|prompt|provider|payload|table|ledger))?|\braw\b|hidden(?:Notes|Intent|Dossier|Truth|Ledger)|hidden[_ -]?(?:notes|intent|dossier|truth|ledger)|private[_ -]?signal|secret[_ -]?relationships|state[_ -]?patch|safe[_ -]?search[_ -]?index|local[_ -]?high[_ -]?res[_ -]?source[_ -]?path|source[_ -]?path|api[_ -]?key|secret[_ -]?key|sqlite|SQL|完整\s*prompt|本地\s*路径|密\s*钥)/i;
const unsafePortraitRefTokenPattern =
  /signature_npc_pool|portrait_pool_signature_npc_s73_10|important_npc|(?:^|[-_])(raw|provider|prompt|hidden|private|secret|token|key|path|file|data|http)(?:$|[-_])/i;
const unsafeClientApiPathPatterns = Object.freeze([
  /^\/api\/game\/state\//,
  /^\/api\/dev\//
]);
const CLIENT_RESOURCE_BUDGETS = Object.freeze({
  home: {
    maxStaticBytes: 16_500_000,
    maxRuntimeManifestBytes: 1_050_000,
    maxFullManifestRequests: 0,
    maxMapRuntimeRequests: 0,
    maxPortraitMainRequests: 6,
    maxPortraitThumbRequests: 8,
    maxPortraitPlaceholderRequests: 8,
    maxFontWoff2Requests: 6,
    maxUiImageBytes: 4_500_000
  },
  map: {
    maxStaticBytes: 4_000_000,
    minMapRuntimeRequests: 2,
    maxMapRuntimeRequests: 2,
    maxPortraitMainRequests: 0,
    maxFullManifestRequests: 0
  },
  people: {
    maxStaticBytes: 4_000_000,
    maxMapRuntimeRequests: 0,
    maxPortraitMainRequests: 8,
    maxPortraitThumbRequests: 8,
    maxPortraitPlaceholderRequests: 8,
    maxFullManifestRequests: 0
  }
});

function parseClientSmokeArgs(argv = process.argv) {
  const args = {
    browserPath: null,
    headed: false,
    help: false,
    screenshotsDir: null,
    url: null
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--headed") {
      args.headed = true;
    } else if (arg === "--url") {
      args.url = normalizeBaseUrl(readArgValue(argv, index, "--url"));
      index += 1;
    } else if (arg === "--browser") {
      args.browserPath = readArgValue(argv, index, "--browser");
      index += 1;
    } else if (arg === "--client") {
      const client = readArgValue(argv, index, "--client");
      if (client !== "react") {
        throw new Error(`Unsupported client smoke target: ${client}`);
      }
      index += 1;
    } else if (arg === "--screenshots") {
      args.screenshotsDir = readArgValue(argv, index, "--screenshots");
      index += 1;
    } else {
      throw new Error(`Unknown client smoke argument: ${arg}`);
    }
  }

  return args;
}

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

async function captureScreenshot(page, screenshotsDir, label) {
  const buffer = await page.screenshot({ fullPage: true });
  assertPngScreenshot(buffer, label);

  if (!screenshotsDir) {
    return { label, bytes: buffer.length, filePath: null };
  }

  await fs.mkdir(screenshotsDir, { recursive: true });
  const filePath = path.join(screenshotsDir, `${sanitizeScreenshotName(label)}.png`);
  await fs.writeFile(filePath, buffer);
  return { label, bytes: buffer.length, filePath };
}

function getSafetyPollutionFailures(text, label = "page") {
  const matches = String(text || "").match(safetyPollutionPattern) || [];
  return [...new Set(matches)].map((match) => `${label} exposed safety pollution: ${match}`);
}

function collectUnexpectedRuntimeKeys(value, allowedKeys, label, failures) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) failures.push(`${label} exposed unexpected runtime manifest key: ${key}`);
  }
}

function collectRuntimeManifestUnsafeText(value, label, failures) {
  if (value == null) return;
  if (typeof value === "string") {
    if (runtimeManifestUnsafeTextPattern.test(value)) {
      failures.push(`${label} exposed unsafe runtime manifest text: ${value}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRuntimeManifestUnsafeText(item, `${label}[${index}]`, failures));
    return;
  }
  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      collectRuntimeManifestUnsafeText(key, `${label}.${key} key`, failures);
      collectRuntimeManifestUnsafeText(nestedValue, `${label}.${key}`, failures);
    }
  }
}

function isSafeRuntimeAssetPath(assetPath) {
  return (
    typeof assetPath === "string" &&
    assetPath.startsWith(safeRuntimeAssetPathPrefix) &&
    !assetPath.includes("..") &&
    !runtimeManifestUnsafeTextPattern.test(assetPath)
  );
}

function validateRuntimeAssetPath(assetPath, label, failures) {
  if (!isSafeRuntimeAssetPath(assetPath)) {
    failures.push(`${label} must stay under ${safeRuntimeAssetPathPrefix}`);
  }
}

function validateRuntimeManifestFallback(fallback, context, index, failures) {
  const label = `fallbackCatalog[${index}]`;
  if (!fallback || typeof fallback !== "object" || Array.isArray(fallback)) {
    failures.push(`${label} is not an object`);
    return;
  }

  collectUnexpectedRuntimeKeys(fallback, runtimeFallbackKeys, label, failures);
  if (!context.usableStatuses.has(fallback.reviewStatus)) {
    failures.push(`${label} reviewStatus is not runtime usable: ${fallback.reviewStatus}`);
  }
  if (context.blockedStatuses.has(fallback.reviewStatus)) {
    failures.push(`${label} reviewStatus is runtime blocked: ${fallback.reviewStatus}`);
  }
  if (fallback.category !== "fallback") failures.push(`${label} category must be fallback`);
  if (fallback.type !== "css_token") failures.push(`${label} type must be css_token`);
}

function validateRuntimeManifestAsset(asset, context, index, failures) {
  const label = `assets[${index}] ${asset?.id || "(missing id)"}`;
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
    failures.push(`${label} is not an object`);
    return;
  }

  collectUnexpectedRuntimeKeys(asset, runtimeAssetKeys, label, failures);
  if (!asset.id || typeof asset.id !== "string") failures.push(`${label} is missing stable id`);
  if (!context.usableStatuses.has(asset.reviewStatus)) {
    failures.push(`${label} reviewStatus is not runtime usable: ${asset.reviewStatus}`);
  }
  if (context.blockedStatuses.has(asset.reviewStatus)) {
    failures.push(`${label} reviewStatus is runtime blocked: ${asset.reviewStatus}`);
  }
  validateRuntimeAssetPath(asset.path, `${label}.path`, failures);
  if (asset.thumbnailPath) validateRuntimeAssetPath(asset.thumbnailPath, `${label}.thumbnailPath`, failures);
  if (asset.fallbackRef && !context.fallbackIds.has(asset.fallbackRef)) {
    failures.push(`${label}.fallbackRef does not point to a runtime fallback: ${asset.fallbackRef}`);
  }

  if (asset.category === "portrait") {
    validateRuntimeManifestPortraitAsset(asset, label, failures);
    return;
  }

  for (const key of runtimeNonPortraitOnlyKeys) {
    if (asset[key] !== undefined) failures.push(`${label} non-portrait asset exposed portrait-only key: ${key}`);
  }
}

function validateRuntimeManifestPortraitAsset(asset, label, failures) {
  const requiredKeys = [
    "portraitRef",
    "genderPresentation",
    "ageBand",
    "statusVariant",
    "thumbnailPath",
    "lowResPlaceholderPath",
    "fallbackRef",
    "lazyLoad"
  ];
  for (const key of requiredKeys) {
    if (asset[key] === undefined || asset[key] === null || asset[key] === "") {
      failures.push(`${label} is missing required portrait runtime key: ${key}`);
    }
  }
  if (asset.portraitRef !== asset.id) failures.push(`${label}.portraitRef must match id`);
  validateRuntimeAssetPath(asset.lowResPlaceholderPath, `${label}.lowResPlaceholderPath`, failures);
  if (!String(asset.ageBand || "").startsWith("adult")) {
    failures.push(`${label}.ageBand must be explicitly adult: ${asset.ageBand}`);
  }

  const lazyLoad = asset.lazyLoad || {};
  collectUnexpectedRuntimeKeys(lazyLoad, runtimeLazyLoadKeys, `${label}.lazyLoad`, failures);
  if (lazyLoad.allowEagerLoad !== false) failures.push(`${label}.lazyLoad.allowEagerLoad must be false`);
  if (lazyLoad.thumbnailFirst !== true) failures.push(`${label}.lazyLoad.thumbnailFirst must be true`);
  if (lazyLoad.lowResPlaceholder !== true) failures.push(`${label}.lazyLoad.lowResPlaceholder must be true`);
  if (!Number.isFinite(lazyLoad.maxInitialPortraits) || lazyLoad.maxInitialPortraits < 1 || lazyLoad.maxInitialPortraits > 8) {
    failures.push(`${label}.lazyLoad.maxInitialPortraits must be within 1..8`);
  }
  if (!lazyLoad.group || typeof lazyLoad.group !== "string") {
    failures.push(`${label}.lazyLoad.group is missing`);
  }
  const expectedSubcategory = runtimePortraitGroupSubcategory[lazyLoad.group];
  if (expectedSubcategory && asset.subcategory !== expectedSubcategory) {
    failures.push(`${label}.lazyLoad.group does not match subcategory`);
  }

  if (asset.source !== undefined) {
    collectUnexpectedRuntimeKeys(asset.source, runtimeSourceKeys, `${label}.source`, failures);
    if (asset.source?.localHighResSource !== runtimeHighResSourceFlag) {
      failures.push(`${label}.source can only expose ${runtimeHighResSourceFlag}`);
    }
  }
}

function getRuntimeManifestSafetyFailures(manifest) {
  const failures = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["runtime manifest is not an object"];
  }

  collectUnexpectedRuntimeKeys(manifest, runtimeManifestTopLevelKeys, "runtime manifest", failures);
  collectRuntimeManifestUnsafeText(manifest, "runtime manifest", failures);
  if (manifest.schemaVersion !== 1) failures.push("runtime manifest schemaVersion must be 1");
  if (manifest.assetSetId !== "ink-ui-v1") failures.push("runtime manifest assetSetId must be ink-ui-v1");
  if (manifest.assetRoot !== safeRuntimeAssetPathPrefix) {
    failures.push(`runtime manifest assetRoot must be ${safeRuntimeAssetPathPrefix}`);
  }
  if (!Array.isArray(manifest.runtimeUsableReviewStatuses) || manifest.runtimeUsableReviewStatuses.length === 0) {
    failures.push("runtime manifest is missing runtimeUsableReviewStatuses");
  }

  const usableStatuses = new Set(manifest.runtimeUsableReviewStatuses || []);
  const blockedStatuses = new Set(manifest.runtimeBlockedReviewStatuses || []);
  for (const blockedStatus of blockedStatuses) {
    if (usableStatuses.has(blockedStatus)) {
      failures.push(`runtime manifest status is both usable and blocked: ${blockedStatus}`);
    }
  }

  const fallbackIds = new Set();
  if (!Array.isArray(manifest.fallbackCatalog)) {
    failures.push("runtime manifest fallbackCatalog is not an array");
  } else {
    manifest.fallbackCatalog.forEach((fallback, index) => {
      validateRuntimeManifestFallback(fallback, { usableStatuses, blockedStatuses }, index, failures);
      if (fallback?.id) fallbackIds.add(fallback.id);
    });
  }

  const assetIds = new Set();
  const portraitRefs = new Set();
  const context = { usableStatuses, blockedStatuses, fallbackIds };
  if (!Array.isArray(manifest.assets)) {
    failures.push("runtime manifest assets is not an array");
  } else {
    manifest.assets.forEach((asset, index) => {
      validateRuntimeManifestAsset(asset, context, index, failures);
      if (asset?.id) {
        if (assetIds.has(asset.id)) failures.push(`runtime manifest duplicate asset id: ${asset.id}`);
        assetIds.add(asset.id);
      }
      if (asset?.portraitRef) {
        if (portraitRefs.has(asset.portraitRef)) failures.push(`runtime manifest duplicate portraitRef: ${asset.portraitRef}`);
        portraitRefs.add(asset.portraitRef);
      }
    });
  }

  return failures;
}

function assertRuntimeManifestRequestOnly(manifestRequests, label = "page") {
  const uniqueRequests = [...new Set(manifestRequests || [])];
  const failures = [];
  if (!uniqueRequests.includes(runtimeAssetManifestPath)) {
    failures.push(`did not request runtime manifest ${runtimeAssetManifestPath}`);
  }
  if (uniqueRequests.includes(sourceAssetManifestPath)) {
    failures.push(`requested full source manifest ${sourceAssetManifestPath}`);
  }
  if (failures.length) {
    throw new Error(`${label} manifest request boundary failed: ${failures.join("; ")}; requests=${uniqueRequests.join(", ")}`);
  }
}

function getPlayerFacingCopyLeakFailures(text, label = "page") {
  const matches = String(text || "").match(playerFacingCopyLeakPattern) || [];
  return [...new Set(matches)].map((match) => `${label} exposed player-facing development copy: ${match}`);
}

function rectsOverlapEnough(first, second, tolerance = 1) {
  const left = Math.max(first.x, second.x);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const top = Math.max(first.y, second.y);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= tolerance || height <= tolerance) return false;
  const overlapArea = width * height;
  const smallerArea = Math.min(first.width * first.height, second.width * second.height);
  return smallerArea > 0 && overlapArea / smallerArea >= 0.18;
}

function getTextOverlapFailures(rects, label = "page") {
  const failures = [];
  for (let firstIndex = 0; firstIndex < rects.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < rects.length; secondIndex += 1) {
      const first = rects[firstIndex];
      const second = rects[secondIndex];
      if (first.ancestorIds.includes(second.id) || second.ancestorIds.includes(first.id)) continue;
      if (!rectsOverlapEnough(first.rect, second.rect)) continue;
      failures.push(`${label} visible text/control overlap: "${first.text}" over "${second.text}"`);
    }
  }
  return failures;
}

function getTextOverflowFailures(items, label = "page") {
  const failures = [];
  for (const item of items) {
    const horizontalOverflow = Number(item.scrollWidth || 0) > Number(item.clientWidth || 0) + 2;
    const verticalOverflow = Number(item.scrollHeight || 0) > Number(item.clientHeight || 0) + 2;
    if (!horizontalOverflow && !verticalOverflow) continue;
    failures.push(`${label} visible text/control internal overflow: "${item.text}"`);
  }
  return failures;
}

async function assertNoPlayerFacingCopyLeaks(page, label) {
  const text = await page.evaluate(() => document.body.innerText || "");
  const failures = getPlayerFacingCopyLeakFailures(text, label);
  if (failures.length) {
    throw new Error(failures.join("; "));
  }
}

async function assertNoSafetyPollutionOnPage(page, label) {
  const snapshot = await page.evaluate(() => {
    const values = [...document.querySelectorAll("input, textarea, select")]
      .map((element) => {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
          return `${element.name || element.getAttribute("aria-label") || element.id || "field"}=${element.value || ""}`;
        }
        return "";
      })
      .filter(Boolean);
    const dataAttributes = [...document.querySelectorAll("[data-map-status], [data-motion], [data-text-size], [data-contrast], [data-body-font], [data-client-entry]")]
      .flatMap((element) => [...element.attributes]
        .filter((attribute) => attribute.name.startsWith("data-"))
        .map((attribute) => `${attribute.name}=${attribute.value}`));
    return [document.body.innerText || "", ...values, ...dataAttributes].join("\n");
  });
  const failures = getSafetyPollutionFailures(snapshot, label);
  if (failures.length) {
    throw new Error(failures.join("; "));
  }
}

async function assertBrowserStorageSafety(page, label) {
  const snapshot = await page.evaluate(() => {
    const entries = [];
    for (const storageName of ["localStorage", "sessionStorage"]) {
      const storage = window[storageName];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        entries.push(`${storageName}:${key}=${key ? storage.getItem(key) : ""}`);
      }
    }
    return entries.join("\n");
  });
  const failures = getSafetyPollutionFailures(snapshot, `${label} browser storage`);
  if (failures.length) {
    throw new Error(failures.join("; "));
  }
}

async function assertManifestRuntimeSafety(baseUrl) {
  const response = await fetch(`${baseUrl}${runtimeAssetManifestPath}`, { cache: "no-store" });
  const manifest = await response.json();
  const localSourcePathCount = (manifest.assets || []).filter((asset) => Boolean(asset.source?.localHighResSourcePath)).length;
  const runtimeEnvelope = {
    schemaVersion: manifest?.schemaVersion,
    assetSetId: manifest?.assetSetId,
    assetRoot: manifest?.assetRoot,
    runtimeUsableReviewStatuses: manifest?.runtimeUsableReviewStatuses,
    runtimeBlockedReviewStatuses: manifest?.runtimeBlockedReviewStatuses,
    fallbackCatalog: (manifest?.fallbackCatalog || []).map((fallback) => ({
      id: fallback.id,
      category: fallback.category,
      type: fallback.type,
      usage: fallback.usage,
      cssTokens: fallback.cssTokens,
      reviewStatus: fallback.reviewStatus,
      ledgerId: fallback.ledgerId
    })),
    assets: (manifest?.assets || []).map((asset) => ({
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
      visualReviewStatus: asset.visualReview?.status,
      safetyReviewStatus: asset.safetyReview?.status,
      dimensions: asset.dimensions,
      safeArea: asset.safeArea,
      focalPoint: asset.focalPoint,
      mobileCrop: asset.mobileCrop,
      portraitRef: asset.portraitRef,
      genderPresentation: asset.genderPresentation,
      ageBand: asset.ageBand,
      roleStage: asset.roleStage,
      statusVariant: asset.statusVariant,
      emotionVariant: asset.emotionVariant,
      identityTags: asset.identityTags,
      emotionTags: asset.emotionTags,
      lazyLoad: asset.lazyLoad,
      sourceRuntimeFlag: asset.source?.localHighResSource
    }))
  };
  const snapshot = {
    ok: response.ok,
    assetCount: manifest.assets?.length || 0,
    localSourcePathCount,
    manifest,
    runtimeEnvelope
  };

  const failures = [];
  if (!snapshot.ok) failures.push("manifest request failed");
  if (snapshot.assetCount < 1) failures.push("manifest had no assets");
  if (snapshot.localSourcePathCount > 0) failures.push(`manifest exposed localHighResSourcePath ${snapshot.localSourcePathCount} time(s)`);
  failures.push(...getRuntimeManifestSafetyFailures(snapshot.manifest));
  failures.push(...getSafetyPollutionFailures(JSON.stringify(snapshot.runtimeEnvelope), "runtime manifest"));
  if (failures.length) {
    throw new Error(`S88.11 runtime manifest browser smoke failed: ${failures.join("; ")}`);
  }
}

function getResourceBudgetSnapshot(entries) {
  const summary = {
    staticBytes: 0,
    uiImageBytes: 0,
    runtimeManifestBytes: 0,
    fullManifestRequests: 0,
    mapRuntimeRequests: 0,
    portraitMainRequests: 0,
    portraitThumbRequests: 0,
    portraitPlaceholderRequests: 0,
    fontWoff2Requests: 0,
    resourcePaths: []
  };

  for (const entry of entries) {
    let pathname = "";
    try {
      pathname = new URL(entry.name, "http://qianqiu.local").pathname;
    } catch {
      continue;
    }
    const bytes = Number(entry.encodedBodySize || entry.transferSize || 0);
    const isStaticResource =
      pathname.startsWith("/client-assets/") ||
      pathname.startsWith("/assets/ui/") ||
      pathname === "/mapRenderer.js" ||
      pathname.startsWith("/vendor/");
    if (!isStaticResource) continue;

    summary.staticBytes += bytes;
    summary.resourcePaths.push(pathname);

    if (pathname === runtimeAssetManifestPath) summary.runtimeManifestBytes += bytes;
    if (pathname === sourceAssetManifestPath) summary.fullManifestRequests += 1;
    if (pathname === "/mapRenderer.js" || pathname === "/vendor/pixi.min.js") summary.mapRuntimeRequests += 1;
    if (pathname.endsWith(".woff2")) summary.fontWoff2Requests += 1;
    if (pathname.startsWith("/assets/ui/") && /\.(?:webp|png|jpg|jpeg)$/i.test(pathname)) summary.uiImageBytes += bytes;
    if (pathname.startsWith("/assets/ui/portraits/") && !pathname.startsWith("/assets/ui/portraits/placeholders/")) {
      summary.portraitMainRequests += 1;
    }
    if (pathname.startsWith("/assets/ui/thumbs/thumb-portrait")) summary.portraitThumbRequests += 1;
    if (pathname.startsWith("/assets/ui/portraits/placeholders/")) summary.portraitPlaceholderRequests += 1;
  }

  summary.resourcePaths = [...new Set(summary.resourcePaths)].sort();
  return summary;
}

function getResourceBudgetFailures(snapshot, budget, label = "page") {
  const failures = [];
  const checks = [
    ["staticBytes", "static resource bytes"],
    ["runtimeManifestBytes", "runtime manifest bytes"],
    ["fullManifestRequests", "full source manifest requests"],
    ["mapRuntimeRequests", "map runtime requests"],
    ["portraitMainRequests", "portrait main image requests"],
    ["portraitThumbRequests", "portrait thumbnail requests"],
    ["portraitPlaceholderRequests", "portrait placeholder requests"],
    ["fontWoff2Requests", "woff2 font requests"],
    ["uiImageBytes", "reviewed UI image bytes"]
  ];

  for (const [key, message] of checks) {
    const maxKey = `max${key[0].toUpperCase()}${key.slice(1)}`;
    if (typeof budget[maxKey] === "number" && snapshot[key] > budget[maxKey]) {
      failures.push(`${label} exceeded ${message}: ${snapshot[key]} > ${budget[maxKey]}`);
    }
  }
  if (typeof budget.minMapRuntimeRequests === "number" && snapshot.mapRuntimeRequests < budget.minMapRuntimeRequests) {
    failures.push(`${label} did not lazy-load map runtime scripts: ${snapshot.mapRuntimeRequests} < ${budget.minMapRuntimeRequests}`);
  }
  return failures;
}

async function clearResourceTimings(page) {
  await page.evaluate(() => performance.clearResourceTimings());
}

async function assertClientResourceBudget(page, label, budget) {
  const entries = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => ({
    name: entry.name,
    initiatorType: entry.initiatorType,
    transferSize: entry.transferSize,
    encodedBodySize: entry.encodedBodySize,
    decodedBodySize: entry.decodedBodySize
  })));
  const snapshot = getResourceBudgetSnapshot(entries);
  const failures = getResourceBudgetFailures(snapshot, budget, label);
  if (failures.length) {
    throw new Error(`S77.5 resource budget failed: ${failures.join("; ")}; resources=${snapshot.resourcePaths.join(", ")}`);
  }
  return snapshot;
}

async function assertScreenshotArtifactsSafety(screenshots) {
  const artifactText = screenshots
    .map((screenshot) => [screenshot.label, screenshot.filePath ? path.basename(screenshot.filePath) : ""].filter(Boolean).join("\n"))
    .join("\n");
  const failures = getSafetyPollutionFailures(artifactText, "screenshot artifact names");
  if (failures.length) {
    throw new Error(failures.join("; "));
  }
}

async function assertClientVisualMatrixCoverage(screenshots, options = {}) {
  const screenshotByLabel = new Map(screenshots.map((screenshot) => [screenshot.label, screenshot]));
  const labels = new Set(screenshotByLabel.keys());
  const missing = requiredVisualMatrixScreenshotLabels.filter((label) => !labels.has(label));
  if (missing.length) {
    throw new Error(`S89.2 visual screenshot matrix missed key route(s): ${missing.join(", ")}`);
  }
  if (!options.requireFiles) return;

  const missingFiles = [];
  for (const label of requiredVisualMatrixScreenshotLabels) {
    const screenshot = screenshotByLabel.get(label);
    if (!screenshot?.filePath) {
      missingFiles.push(`${label}: no written PNG`);
      continue;
    }
    try {
      const stat = await fs.stat(screenshot.filePath);
      if (!stat.isFile() || stat.size < 256) {
        missingFiles.push(`${label}: invalid PNG artifact`);
      }
    } catch {
      missingFiles.push(`${label}: missing PNG artifact`);
    }
  }
  if (missingFiles.length) {
    throw new Error(`S89.2 visual screenshot matrix did not write required artifact(s): ${missingFiles.join(", ")}`);
  }
}

async function assertHomeStartSealTypography(page, label) {
  const seal = await page.evaluate(() => {
    const button = document.querySelector(".homeStartSeal");
    const style = button ? window.getComputedStyle(button) : null;
    return {
      exists: Boolean(button),
      text: button?.textContent?.trim() || "",
      fontFamily: style?.fontFamily || "",
      clientWidth: button?.clientWidth || 0,
      scrollWidth: button?.scrollWidth || 0,
      clientHeight: button?.clientHeight || 0,
      scrollHeight: button?.scrollHeight || 0
    };
  });
  if (!seal.exists || !seal.text.includes("新开一卷")) {
    throw new Error(`${label} did not expose a readable home seal label: ${JSON.stringify(seal)}`);
  }
  if (!/Noto Serif SC|Songti SC|Microsoft YaHei|serif/i.test(seal.fontFamily)) {
    throw new Error(`${label} home seal used an unstable glyph font: ${JSON.stringify(seal)}`);
  }
  if (seal.scrollWidth > seal.clientWidth + 2 || seal.scrollHeight > seal.clientHeight + 2) {
    throw new Error(`${label} home seal text overflowed its cinnabar button: ${JSON.stringify(seal)}`);
  }
}

async function assertHomeSaveShelfPolish(page, label) {
  const snapshot = await page.evaluate(() => {
    const shelf = document.querySelector(".saveShelf");
    const text = shelf?.textContent || "";
    const links = shelf ? [...shelf.querySelectorAll("a[href]")].map((link) => new URL(link.href).pathname) : [];
    return {
      exists: Boolean(shelf),
      state: shelf?.getAttribute("data-save-state") || "",
      hasStatus: Boolean(shelf?.querySelector(".saveShelfStatus[role='status']")),
      hasStats: Boolean(shelf?.querySelector(".saveShelfStats")),
      hasCards: Boolean(shelf?.querySelector(".saveCaseList")),
      hasEmpty: Boolean(shelf?.querySelector(".saveCaseEmpty")),
      hasSkeleton: Boolean(shelf?.querySelector(".saveCaseSkeletonList")),
      badLinks: links.filter((path) => /\/api\/game\/state|\/api\/dev\/session-diagnostics|data\/sessions|raw|provider|hidden|key|secret/i.test(path)),
      forbiddenText: text.match(/provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data\/sessions|hidden\/raw|(?:^|\b)hidden\b|(?:^|\b)raw\b|服务器裁决|\/api\/game\/state|\/api\/dev\/session-diagnostics|[a-z]:[\\/]|\/(?:home|mnt|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)/gi) || [],
      text
    };
  });
  const failures = [];
  if (!snapshot.exists) failures.push("missing .saveShelf");
  if (!/^(loading|ready|empty|error)$/.test(snapshot.state)) failures.push(`unexpected save shelf state ${snapshot.state}`);
  if (!snapshot.hasStatus) failures.push("missing save shelf status");
  if (!snapshot.hasStats) failures.push("missing save shelf stats");
  if (snapshot.state === "loading" && !snapshot.hasSkeleton && !snapshot.hasCards) failures.push("loading shelf lacked skeleton or existing cards");
  if (snapshot.state === "empty" && !snapshot.hasEmpty) failures.push("empty shelf lacked empty block");
  if (snapshot.state === "ready" && !snapshot.hasCards) failures.push("ready shelf lacked save cards");
  if (snapshot.state === "error" && !snapshot.text.includes("旧案架暂不可取")) failures.push("error shelf lacked safe error copy");
  if (snapshot.badLinks.length) failures.push(`unsafe save shelf links: ${snapshot.badLinks.join(", ")}`);
  if (snapshot.forbiddenText.length) failures.push(`forbidden save shelf text: ${snapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`${label} home save shelf polish failed: ${failures.join("; ")}`);
  }
}

async function assertArchiveDigestPolish(page, label) {
  const snapshot = await page.evaluate(() => {
    const panel = document.querySelector(".archiveRoutePanel");
    const digest = document.querySelector(".archiveDigestBand");
    const traceGrid = document.querySelector(".archiveTraceGrid");
    const evidenceStack = document.querySelector(".archiveEvidenceStack");
    const text = digest?.textContent || "";
    return {
      hasPanel: Boolean(panel),
      polishMarker: panel?.getAttribute("data-polish-archive") || "",
      hasDigest: Boolean(digest),
      hasStats: Boolean(digest?.querySelector(".archiveDigestStats")),
      hasLeadListOrEmpty: Boolean(digest?.querySelector(".archiveLeadList")) || Boolean(digest?.querySelector(".archiveLeadEmpty")),
      hasTraceGrid: Boolean(traceGrid),
      tracePolishMarker: traceGrid?.getAttribute("data-polish-archive-trace") || "",
      traceLayout: traceGrid?.getAttribute("data-archive-layout") || "",
      traceColumns: traceGrid ? window.getComputedStyle(traceGrid).gridTemplateColumns : "",
      hasEvidenceStack: Boolean(evidenceStack),
      evidenceText: evidenceStack?.textContent || "",
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      forbiddenText: (document.body.innerText || "").match(/provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data\/sessions|hidden\/raw|(?:^|\b)hidden\b|(?:^|\b)raw\b|服务器裁决|sourceRef|relatedRefs|scopeRefs|evidenceRefs|outcomeId|auditRecord|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|watchlist|NPC\b|[a-z]:[\\/]|\/(?:home|mnt|tmp|var|etc|usr|opt|workspace|workspaces|root|data|src|client|server|dist|public|node_modules)(?:[\\/]|$)/gi) || [],
      text
    };
  });
  const failures = [];
  if (!snapshot.hasPanel) failures.push("missing archive route panel");
  if (snapshot.polishMarker !== "s89-10-chronicle-density") failures.push(`missing S89.10 archive polish marker: ${snapshot.polishMarker}`);
  if (!snapshot.hasDigest) failures.push("missing archive digest band");
  if (!snapshot.hasStats) failures.push("missing archive digest stats");
  if (!snapshot.hasLeadListOrEmpty) failures.push("missing archive lead list or empty lead copy");
  if (!snapshot.hasTraceGrid) failures.push("missing archive trace grid");
  if (snapshot.tracePolishMarker !== "s89-10-chronicle-density") failures.push(`missing S89.10 archive trace marker: ${snapshot.tracePolishMarker}`);
  if (snapshot.traceLayout !== "ledger-rail") failures.push(`archive trace did not use ledger-rail layout: ${snapshot.traceLayout}`);
  if (!snapshot.traceColumns) failures.push("archive trace grid columns were not computed");
  if (!snapshot.hasEvidenceStack) failures.push("missing archive evidence stack");
  if (!snapshot.evidenceText.includes("史册后果追踪")) failures.push(`archive evidence stack lacked consequence tracking: ${snapshot.evidenceText.slice(0, 120)}`);
  if (!snapshot.text.includes("案卷索引") || !snapshot.text.includes("近次线索")) failures.push(`archive digest lacked player-facing index copy: ${snapshot.text.slice(0, 120)}`);
  if (snapshot.horizontalOverflow) failures.push("archive digest caused horizontal overflow");
  if (snapshot.forbiddenText.length) failures.push(`archive digest/page leaked forbidden text: ${snapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`${label} archive digest polish failed: ${failures.join("; ")}`);
  }
}

async function assertS895MaterialFeedbackPolish(page, label, expected = {}) {
  const snapshot = await page.evaluate((expectedSelectors) => {
    const styleOf = (selector, pseudo = null) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = window.getComputedStyle(element, pseudo);
      return {
        animationName: style.animationName,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter || "",
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        opacity: style.opacity,
        transform: style.transform,
        transitionDuration: style.transitionDuration
      };
    };
    const keyframesOf = (name) => {
      for (const sheet of [...document.styleSheets]) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of [...rules]) {
          if ("name" in rule && rule.name === name) return rule.cssText;
        }
      }
      return "";
    };
    const shell = document.querySelector(".appShell");
    const writtenRows = [...document.querySelectorAll(".mapActionList li[data-draft-state='written'], .mapEventList li[data-draft-state='written']")];
    return {
      shellPolish: shell?.getAttribute("data-polish-surface") || "",
      shellMotion: shell?.getAttribute("data-motion") || "",
      topBar: styleOf(".topBar"),
      topBarSheen: styleOf(".topBar", "::after"),
      inkboxButton: styleOf(".inkboxButton"),
      inkboxButtonSheen: styleOf(".inkboxButton", "::before"),
      drawer: styleOf("[data-polish-overlay='s89-5-drawer-mica']"),
      keyframes: {
        drawer: keyframesOf("s895D"),
        draft: keyframesOf("s895S")
      },
      modal: styleOf("[data-polish-overlay='s89-5-modal-paper'], [data-polish-overlay='s89-5-surface-paper'], [data-polish-overlay='s89-5-portrait-gallery']"),
      mapSurface: Boolean(document.querySelector("[data-polish-surface='s89-5-map-command']")),
      mapLedger: styleOf("[data-polish-card='s89-5-map-ledger']"),
      mapLayerCount: document.querySelectorAll("[data-polish-action='s89-5-map-layer']").length,
      mapWrittenCount: writtenRows.length,
      mapWrittenAnimation: writtenRows.map((row) => window.getComputedStyle(row).animationName),
      portraitFrameCount: document.querySelectorAll("[data-polish-card='s89-5-portrait-frame']").length,
      portraitZoomCount: document.querySelectorAll("[data-polish-action='s89-5-portrait-zoom']").length,
      portraitViewer: styleOf("[data-polish-overlay='s89-5-portrait-gallery']"),
      settingsSurface: Boolean(document.querySelector("[data-polish-surface='s89-5-settings-directory']")),
      settingsCardCount: document.querySelectorAll("[data-polish-card='s89-5-settings-card']").length,
      expected: expectedSelectors,
      unsafeText: (document.body.innerText || "").match(/provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|draftContext|schema|manifest|server adjudication|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, expected);

  const failures = [];
  if (snapshot.shellPolish !== "s89-5-material-feedback") failures.push(`shell polish marker was ${snapshot.shellPolish}`);
  if (!snapshot.topBar?.backgroundImage.includes("linear-gradient")) failures.push("top bar did not use layered material background");
  if (!snapshot.topBarSheen || snapshot.topBarSheen.opacity === "0") failures.push("top bar sheen was absent");
  if (!snapshot.inkboxButton?.boxShadow || snapshot.inkboxButton.boxShadow === "none") failures.push("inkbox button lacked material shadow");
  if (expected.drawer && !snapshot.drawer) failures.push("open drawer lacked S89.5 overlay marker");
  if (expected.drawer && snapshot.shellMotion !== "reduced" && snapshot.drawer?.animationName !== "s895D") {
    failures.push(`drawer animation was ${snapshot.drawer?.animationName}`);
  }
  if (expected.drawer && snapshot.shellMotion !== "reduced" && !/transform|opacity/i.test(snapshot.keyframes.drawer)) {
    failures.push("drawer keyframes lacked a visible transform/opacity delta");
  }
  if (expected.reducedOverlay && snapshot.drawer && snapshot.drawer.animationName !== "none") {
    failures.push(`reduced drawer animation was ${snapshot.drawer.animationName}`);
  }
  if (expected.modal && !snapshot.modal) failures.push("open modal/surface lacked S89.5 overlay marker");
  if (expected.map && (!snapshot.mapSurface || !snapshot.mapLedger || snapshot.mapLayerCount < 3)) {
    failures.push(`map polish hooks incomplete: ${JSON.stringify({ mapSurface: snapshot.mapSurface, mapLedger: Boolean(snapshot.mapLedger), mapLayerCount: snapshot.mapLayerCount })}`);
  }
  if (expected.mapWritten && snapshot.mapWrittenCount < 1) failures.push("map draft feedback row was not marked written");
  if (expected.mapWritten && snapshot.shellMotion !== "reduced" && !snapshot.mapWrittenAnimation.includes("s895S")) {
    failures.push(`map written animation missing: ${snapshot.mapWrittenAnimation.join(", ")}`);
  }
  if (expected.mapWritten && snapshot.shellMotion !== "reduced" && !/outline|box-shadow|transform|opacity|background/i.test(snapshot.keyframes.draft)) {
    failures.push("map draft keyframes lacked a visible feedback delta");
  }
  if (expected.portrait && (snapshot.portraitFrameCount < 1 || snapshot.portraitZoomCount < 1)) {
    failures.push(`portrait polish hooks incomplete: ${JSON.stringify({ portraitFrameCount: snapshot.portraitFrameCount, portraitZoomCount: snapshot.portraitZoomCount })}`);
  }
  if (expected.portraitViewer && !snapshot.portraitViewer) failures.push("portrait viewer lacked S89.5 overlay marker");
  if (expected.settings && (!snapshot.settingsSurface || snapshot.settingsCardCount !== 4)) {
    failures.push(`settings polish hooks incomplete: ${JSON.stringify({ settingsSurface: snapshot.settingsSurface, settingsCardCount: snapshot.settingsCardCount })}`);
  }
  if (snapshot.unsafeText.length) failures.push(`S89.5 polish surface leaked unsafe text: ${snapshot.unsafeText.join(", ")}`);
  if (failures.length) {
    throw new Error(`${label} S89.5 material feedback polish failed: ${failures.join("; ")}`);
  }
}

async function assertNoVisibleTextOverlap(page, label) {
  const rects = await page.evaluate(({ selectors, ignoreSelectors }) => {
    const elements = [...document.querySelectorAll(selectors.join(","))];
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const visibleElements = elements
      .filter((element) => {
        if (ignoreSelectors.some((selector) => element.matches(selector) || element.closest(selector))) return false;
        const style = window.getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return false;
        if (rect.bottom <= 0 || rect.right <= 0 || rect.left >= viewport.width || rect.top >= viewport.height) return false;
        const text = (element.innerText || element.getAttribute("aria-label") || element.getAttribute("value") || "").trim();
        return text.length > 0;
      });
    return visibleElements.map((element, index) => {
      const rect = element.getBoundingClientRect();
      return {
        id: String(index),
        text: (element.innerText || element.getAttribute("aria-label") || element.getAttribute("value") || "").trim().slice(0, 28),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        ancestorIds: visibleElements
          .map((candidate, candidateIndex) => candidateIndex !== index && candidate.contains(element) ? String(candidateIndex) : null)
          .filter(Boolean)
      };
    });
  }, { selectors: visualTextSelectors, ignoreSelectors: visualOverlapIgnoreSelectors });
  const failures = getTextOverlapFailures(rects, label);
  if (failures.length) {
    throw new Error(failures.slice(0, 4).join("; "));
  }
}

async function assertNoVisibleTextOverflow(page, label) {
  const items = await page.evaluate(({ ignoreSelectors }) => {
    const overflowSelectors = [
      "button",
      "a[href]",
      "[role='button']",
      ".archiveItemList strong",
      ".archiveItemList span",
      ".archiveItemList p",
      ".archiveDigestIntro p",
      ".archiveDigestStats dd",
      ".archiveLeadList strong",
      ".archiveLeadList span",
      ".archiveLeadList em",
      ".archiveBoundary",
      ".saveShelfStatus p",
      ".saveShelfStats dd",
      ".saveCaseEmpty p",
      ".saveCaseSummary",
      ".domainConsequenceSection h3",
      ".domainConsequenceSection p",
      ".domainConsequenceList strong",
      ".domainConsequenceList span",
      ".npcFollowUpEvidenceHeader h3",
      ".npcFollowUpEvidenceBoundary",
      ".rankingName",
      ".rankingPlace",
      ".rankingMeta",
      ".rankingScore",
      ".rankingDetailPanel p",
      ".rankingDetailRail dd",
      ".rankingScoreGrid em",
      ".rankingAuditList span",
      ".mapEventList strong",
      ".mapEventList span",
      ".mapEventList p",
      ".mapLayerSummary",
      ".mapRuntimeNote",
      ".mapSafetyBoundary p",
      ".inkMapTooltip p",
      ".inkMapTooltipNote",
      ".inkMapMeta span"
    ];
    const elements = [...document.querySelectorAll(overflowSelectors.join(","))];
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    return elements
      .filter((element) => {
        if (ignoreSelectors.some((selector) => element.matches(selector) || element.closest(selector))) return false;
        const style = window.getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return false;
        if (rect.bottom <= 0 || rect.right <= 0 || rect.left >= viewport.width || rect.top >= viewport.height) return false;
        const text = (element.innerText || element.getAttribute("aria-label") || "").trim();
        return text.length > 0;
      })
      .map((element) => ({
        text: (element.innerText || element.getAttribute("aria-label") || "").trim().slice(0, 36),
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight
      }));
  }, { ignoreSelectors: visualOverflowIgnoreSelectors });
  const failures = getTextOverflowFailures(items, label);
  if (failures.length) {
    throw new Error(failures.slice(0, 4).join("; "));
  }
}

async function assertReviewedBackgroundVisual(page, selector, label) {
  const snapshot = await page.evaluate(async ({ selector: targetSelector }) => {
    const element = document.querySelector(targetSelector);
    if (!element) return { ok: false, reason: "missing element" };
    const rect = element.getBoundingClientRect();
    const imageText = window.getComputedStyle(element).backgroundImage || "";
    const urls = [...imageText.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
      .map((match) => new URL(match[1], window.location.href).href)
      .filter((url) => url.includes("/assets/ui/"));
    if (!urls.length) return { ok: false, reason: "no reviewed /assets/ui/ background", imageText };

    const imageResults = [];
    for (const url of urls.slice(0, 3)) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      const result = await new Promise((resolve) => {
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const width = 48;
          const height = 48;
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, width, height);
          const data = context.getImageData(0, 0, width, height).data;
          const buckets = new Set();
          let visible = 0;
          for (let index = 0; index < data.length; index += 16) {
            const alpha = data[index + 3];
            if (alpha <= 10) continue;
            visible += 1;
            buckets.add(`${data[index] >> 4}-${data[index + 1] >> 4}-${data[index + 2] >> 4}`);
          }
          resolve({ url, width: image.naturalWidth, height: image.naturalHeight, visible, bucketCount: buckets.size });
        };
        image.onerror = () => resolve({ url, error: "load failed" });
        image.src = url;
      });
      imageResults.push(result);
    }
    return { ok: true, rect: { width: rect.width, height: rect.height }, urls, imageResults };
  }, { selector });

  const failures = [];
  if (!snapshot.ok) failures.push(`${label} visual background failed: ${snapshot.reason || "unknown"}`);
  if (snapshot.ok && (snapshot.rect.width <= 0 || snapshot.rect.height <= 0)) failures.push(`${label} visual background has no layout size`);
  for (const result of snapshot.imageResults || []) {
    if (result.error) failures.push(`${label} reviewed background failed to load: ${result.url}`);
    if (!result.error && (result.width <= 0 || result.height <= 0)) failures.push(`${label} reviewed background has no intrinsic size: ${result.url}`);
    if (!result.error && (result.visible < 64 || result.bucketCount < 4)) failures.push(`${label} reviewed background appears blank or single-color: ${result.url}`);
  }
  if (failures.length) {
    throw new Error(failures.join("; "));
  }
}

async function assertCanvasHasInkPixels(page, selector, label) {
  const snapshot = await page.evaluate(({ selector: targetSelector }) => {
    const canvas = document.querySelector(targetSelector);
    if (!canvas) return { ok: false, reason: "missing canvas" };
    const width = canvas.width || canvas.clientWidth || 0;
    const height = canvas.height || canvas.clientHeight || 0;
    if (width <= 0 || height <= 0) return { ok: false, reason: "empty canvas size", width, height };
    try {
      const sampleCanvas = document.createElement("canvas");
      const sampleSize = 64;
      sampleCanvas.width = sampleSize;
      sampleCanvas.height = sampleSize;
      const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(canvas, 0, 0, sampleSize, sampleSize);
      const data = context.getImageData(0, 0, sampleSize, sampleSize).data;
      const buckets = new Set();
      let visible = 0;
      for (let index = 0; index < data.length; index += 16) {
        const alpha = data[index + 3];
        if (alpha <= 8) continue;
        visible += 1;
        buckets.add(`${data[index] >> 4}-${data[index + 1] >> 4}-${data[index + 2] >> 4}`);
      }
      return { ok: true, width, height, visible, bucketCount: buckets.size };
    } catch (error) {
      return { ok: false, reason: error.message, width, height };
    }
  }, { selector });

  const failures = [];
  if (!snapshot.ok) failures.push(`${label} canvas pixel sampling failed: ${snapshot.reason}`);
  if (snapshot.ok && (snapshot.visible < 64 || snapshot.bucketCount < 4)) {
    failures.push(`${label} canvas appears blank or single-color: ${JSON.stringify(snapshot)}`);
  }
  if (failures.length) {
    throw new Error(failures.join("; "));
  }
}

async function assertPortraitImagesLoaded(page, selector, label) {
  const snapshot = await page.evaluate(async (targetSelector) => {
    const images = [...document.querySelectorAll(`${targetSelector} img`)];
    const entries = images.map((image) => ({
      src: image.currentSrc || image.src || "",
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      width: image.getBoundingClientRect().width,
      height: image.getBoundingClientRect().height
    }));
    const resourceChecks = [];
    for (const entry of entries.slice(0, 3)) {
      try {
        const response = await fetch(entry.src, { cache: "no-store" });
        const bytes = await response.arrayBuffer();
        resourceChecks.push({ src: entry.src, ok: response.ok, bytes: bytes.byteLength });
      } catch (error) {
        resourceChecks.push({ src: entry.src, ok: false, error: error.message });
      }
    }
    return { entries, resourceChecks };
  }, selector);
  if (!snapshot.entries.length) {
    throw new Error(`${label} rendered no portrait images.`);
  }
  const unsafePaths = snapshot.entries.filter((image) => !image.src.includes("/assets/ui/"));
  if (unsafePaths.length) {
    throw new Error(`${label} has portrait image(s) outside reviewed UI assets: ${JSON.stringify(unsafePaths.slice(0, 3))}`);
  }
  const zeroLayout = snapshot.entries.filter((image) => image.width <= 0 || image.height <= 0);
  if (zeroLayout.length) {
    throw new Error(`${label} has zero-size portrait image layout: ${JSON.stringify(zeroLayout.slice(0, 3))}`);
  }
  const brokenLoaded = snapshot.entries.filter((image) => image.complete && (image.naturalWidth <= 0 || image.naturalHeight <= 0));
  if (brokenLoaded.length) {
    throw new Error(`${label} has broken loaded portrait image(s): ${JSON.stringify(brokenLoaded.slice(0, 3))}`);
  }
  const badResources = snapshot.resourceChecks.filter((resource) => !resource.ok || resource.bytes < 1000);
  if (badResources.length) {
    throw new Error(`${label} has unavailable portrait thumbnail resource(s): ${JSON.stringify(badResources)}`);
  }
}

async function assertPeoplePortraitRuntimeSafety(page, label, resourceSnapshot) {
  const snapshot = await page.evaluate(async (runtimePath) => {
    const grid = document.querySelector(".peopleLedgerList");
    const scopedFigures = [...document.querySelectorAll(".peopleLedgerList [data-portrait-ref]")];
    const scopedImages = [...document.querySelectorAll(".peopleLedgerList img")];
    const pagePortraitRefs = [...document.querySelectorAll("[data-portrait-ref]")]
      .map((element) => element.getAttribute("data-portrait-ref") || "")
      .filter(Boolean);
    const scopedPortraitRefs = scopedFigures
      .map((element) => element.getAttribute("data-portrait-ref") || "")
      .filter(Boolean);
    const response = await fetch(runtimePath, { cache: "no-store" });
    const manifest = await response.json();
    const signaturePortraitRefs = (manifest.assets || [])
      .filter((asset) => {
        if (asset?.category !== "portrait") return false;
        const tags = [...(asset.identityTags || []), ...(asset.emotionTags || [])].join(" ");
        return (
          asset.subcategory === "signature_npc_pool" ||
          asset.lazyLoad?.group === "portrait_pool_signature_npc_s73_10" ||
          /signature[_-]?npc|important[_-]?npc/i.test(tags)
        );
      })
      .map((asset) => asset.portraitRef || asset.id)
      .filter(Boolean);
    return {
      manifestOk: response.ok,
      signaturePortraitRefs,
      visiblePeople: Number(grid?.getAttribute("data-visible-people") || 0),
      totalPeople: Number(grid?.getAttribute("data-total-people") || 0),
      visiblePortraits: Number(grid?.getAttribute("data-visible-portraits") || 0),
      scopedFigureCount: scopedFigures.length,
      scopedImageCount: scopedImages.length,
      scopedPortraitRefs,
      pagePortraitRefs,
      eagerImages: scopedImages.filter((image) => image.getAttribute("loading") !== "lazy").length,
      fullPoolCount: Number(grid?.getAttribute("data-total-portraits") || 0)
    };
  }, runtimeAssetManifestPath);

  const failures = [];
  if (!snapshot.manifestOk) failures.push("could not fetch runtime manifest for portrait isolation");
  if (!snapshot.signaturePortraitRefs.length) failures.push("runtime manifest had no signature NPC portrait refs to guard against");
  if (snapshot.visiblePeople <= 0 || snapshot.visiblePeople > 8) {
    failures.push(`visible people count escaped lazy page size: ${snapshot.visiblePeople}`);
  }
  if (snapshot.visiblePortraits !== snapshot.visiblePeople) {
    failures.push(`visible portrait count did not match visible people: ${snapshot.visiblePortraits} !== ${snapshot.visiblePeople}`);
  }
  if (snapshot.scopedFigureCount !== snapshot.visiblePeople) {
    failures.push(`rendered portrait figure count did not match visible people: ${snapshot.scopedFigureCount} !== ${snapshot.visiblePeople}`);
  }
  if (snapshot.scopedImageCount > snapshot.visiblePeople) {
    failures.push(`rendered more portrait images than visible people: ${snapshot.scopedImageCount} > ${snapshot.visiblePeople}`);
  }
  if (snapshot.totalPeople <= 0 || snapshot.totalPeople > 80) {
    failures.push(`people page left current public people bounds: ${snapshot.totalPeople}`);
  }
  if (snapshot.fullPoolCount > 0) {
    failures.push(`people page exposed full portrait pool count: ${snapshot.fullPoolCount}`);
  }
  if (snapshot.eagerImages > 0) {
    failures.push(`people page rendered non-lazy portrait images: ${snapshot.eagerImages}`);
  }

  const signatureRefSet = new Set(snapshot.signaturePortraitRefs);
  const unsafeRefs = snapshot.pagePortraitRefs.filter((portraitRef) => unsafePortraitRefTokenPattern.test(portraitRef));
  const signatureRefsInDom = snapshot.pagePortraitRefs.filter((portraitRef) => signatureRefSet.has(portraitRef));
  const malformedScopedRefs = snapshot.scopedPortraitRefs.filter((portraitRef) => !/^portrait-[a-z0-9][a-z0-9_-]{0,160}$/i.test(portraitRef));
  if (unsafeRefs.length) failures.push(`page exposed unsafe portraitRef token(s): ${[...new Set(unsafeRefs)].join(", ")}`);
  if (signatureRefsInDom.length) failures.push(`page rendered signature NPC portrait ref(s): ${[...new Set(signatureRefsInDom)].join(", ")}`);
  if (malformedScopedRefs.length) failures.push(`people ledger rendered malformed portraitRef(s): ${[...new Set(malformedScopedRefs)].join(", ")}`);

  if (resourceSnapshot) {
    if (resourceSnapshot.fullManifestRequests > 0) {
      failures.push(`people page requested full source manifest ${resourceSnapshot.fullManifestRequests} time(s)`);
    }
    if (resourceSnapshot.portraitMainRequests > 8) {
      failures.push(`people page requested too many main portraits: ${resourceSnapshot.portraitMainRequests}`);
    }
    if (resourceSnapshot.portraitThumbRequests > 8) {
      failures.push(`people page requested too many portrait thumbnails: ${resourceSnapshot.portraitThumbRequests}`);
    }
    if (resourceSnapshot.portraitPlaceholderRequests > 8) {
      failures.push(`people page requested too many portrait placeholders: ${resourceSnapshot.portraitPlaceholderRequests}`);
    }
  }

  if (failures.length) {
    throw new Error(`${label} portrait runtime isolation failed: ${failures.join("; ")}`);
  }
}

async function assertArchiveWorldEntityImpactCanary(page, sessionId) {
  const interactionResponsePromise = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      return url.pathname === `/api/game/npc-interaction/${sessionId}` && response.request().method() === "POST";
    } catch {
      return false;
    }
  }, { timeout: 20000 });

  await page.getByRole("button", { name: "礼法" }).click();
  await page.getByLabel("交游呈词").fill("只作论道，胜负、资源、关系与后续均候案卷回批。");
  await clickStableButton(page, { name: "请论道" }, "S88.7 world entity archive NPC relationship canary");
  const interactionResponse = await interactionResponsePromise;
  await page.waitForFunction(() => {
    const text = document.body.innerText || "";
    return (text.includes("案卷回批") || text.includes("主卷定夺")) && text.includes("公开压力");
  }, null, { timeout: 15000 });

  const responsePayload = await interactionResponse.json().catch(() => null) || {};
  const responseArchiveItems = Array.isArray(responsePayload.eventArchiveView?.items)
    ? responsePayload.eventArchiveView.items
    : [];
  const responseImpacts = Array.isArray(responsePayload.worldEntityView?.recentImpacts)
    ? responsePayload.worldEntityView.recentImpacts
    : [];
  const responseEntityArchiveItems = responseArchiveItems.filter((item) => item?.sourceType === "world_entity_impact");
  const responseSafeViewFailures = getSafetyPollutionFailures(JSON.stringify({
    archiveItems: responseEntityArchiveItems,
    worldEntityImpacts: responsePayload.worldEntityImpacts
  }), "S88.7 NPC relationship archive canary response items");
  const responseFailures = [];
  if (!interactionResponse.ok()) responseFailures.push(`NPC relationship response was not ok: ${interactionResponse.status()}`);
  if (!responsePayload.accepted) responseFailures.push("NPC relationship response was not accepted");
  if (!responseEntityArchiveItems.length) {
    responseFailures.push("NPC relationship response did not return world_entity_impact archive item");
  }
  if (!responseImpacts.some((impact) => impact?.sourceType === "npc_relationship_action")) {
    responseFailures.push("NPC relationship response did not return npc_relationship_action recent impact");
  }
  if (responseSafeViewFailures.length) {
    responseFailures.push(responseSafeViewFailures.join("; "));
  }
  if (responseFailures.length) {
    throw new Error(`S88.7 world entity archive response canary failed: ${responseFailures.join("; ")}`);
  }

  const archiveUrl = new URL(`/game/${sessionId}/archive`, page.url()).href;
  await page.goto(archiveUrl, { waitUntil: "networkidle" });
  await page.locator(".archiveItemList li[data-source-type='world_entity_impact']").first().waitFor({ timeout: 15000 });
  const archiveSnapshot = await page.evaluate((id) => {
    const panel = document.querySelector(".archiveRoutePanel");
    const items = [...document.querySelectorAll(".archiveItemList li")].map((item) => ({
      sourceType: item.getAttribute("data-source-type") || "",
      text: item.textContent || "",
      attrs: item.outerHTML.match(/\s(?:data-[a-z-]+|href|src|aria-label)="[^"]*"/g) || []
    }));
    const entityItems = items.filter((item) => item.sourceType === "world_entity_impact");
    const text = panel?.textContent || "";
    return {
      path: window.location.pathname,
      expectedPath: `/game/${id}/archive`,
      hasEntityStat: text.includes("实体"),
      entityItems,
      forbiddenText: text.match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data\/sessions|stateDelta|playerDelta|evidenceRefs|outcomeId|auditRecord|cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|event_archive_index|safe_search_index|prompt_retrieval_index|world_sessions|world_state_json|sourceRef|relatedRefs|scopeRefs|provider\b|prompt\b|hidden\b|key\b|path\b|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || [],
      unsafeAttributes: items.flatMap((item) => item.attrs).filter((attr) =>
        /sourceRef|relatedRefs|scopeRefs|provider|prompt|hidden|key|path|raw|sqlite|world_sessions|event_archive_index|safe_search_index|prompt_retrieval_index/i.test(attr)
      )
    };
  }, sessionId);

  const failures = [];
  if (archiveSnapshot.path !== archiveSnapshot.expectedPath) failures.push(`path was ${archiveSnapshot.path}`);
  if (!archiveSnapshot.hasEntityStat) failures.push("archive stat did not show entity count label");
  if (!archiveSnapshot.entityItems.length) failures.push("archive DOM did not expose a world_entity_impact item");
  if (!archiveSnapshot.entityItems.some((item) => /实体压力|压力|论道|同年|书院|士林/.test(item.text))) {
    failures.push(`archive DOM world_entity_impact item lacked public pressure copy: ${JSON.stringify(archiveSnapshot.entityItems.slice(0, 2))}`);
  }
  if (archiveSnapshot.forbiddenText.length) failures.push(`archive DOM leaked forbidden text: ${archiveSnapshot.forbiddenText.join(", ")}`);
  if (archiveSnapshot.unsafeAttributes.length) failures.push(`archive DOM exposed unsafe attributes: ${archiveSnapshot.unsafeAttributes.join(", ")}`);
  if (failures.length) {
    throw new Error(`S88.7 world entity archive DOM canary failed: ${failures.join("; ")}`);
  }
}

async function waitForVisiblePortraitImages(page, selector, label) {
  const snapshot = await page.waitForFunction((targetSelector) => {
    const images = [...document.querySelectorAll(`${targetSelector} img`)];
    const visibleImages = images.filter((image) => {
      const rect = image.getBoundingClientRect();
      const style = window.getComputedStyle(image);
      const inViewport = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      return inViewport && rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
    const entries = visibleImages.map((image) => ({
        src: image.currentSrc || image.src || "",
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight
      }));
    const ready = visibleImages.length > 0 && visibleImages.every((image) => {
      const src = image.currentSrc || image.src || "";
      return src.length > 0 && (image.complete || image.naturalWidth > 0);
    });
    return ready ? { ready, entries } : false;
  }, selector, { timeout: 10000 });
  const result = await snapshot.jsonValue();
  if (!result.ready) {
    throw new Error(`${label} portrait images did not settle before budget check: ${JSON.stringify(result.entries.slice(0, 3))}`);
  }
  return result;
}

async function assertCurrentReactClientPage(page, pathname, label, screenshotsDir, options = {}) {
  await page.locator("[data-client-entry='react'][data-router-mode='data']").waitFor({ timeout: 10000 });
  await page.locator("h1").first().waitFor({ timeout: 10000 });
  if (options.readySelector) {
    await page.locator(options.readySelector).first().waitFor({ timeout: 10000 });
  }

  const snapshot = await page.evaluate((tokens) => {
    const text = document.body.innerText || "";
    const html = document.documentElement;
    const scripts = [...document.scripts].map((script) => script.src).filter(Boolean);
    return {
      title: document.title,
      text,
      path: window.location.pathname,
      hasReactEntry: Boolean(document.querySelector("[data-client-entry='react'][data-router-mode='data']")),
      legacyStartForm: Boolean(document.querySelector("#start-form")),
      clientScriptCount: scripts.filter((src) => src.includes("/client-assets/")).length,
      hiddenLeaks: tokens.filter((token) => text.includes(token)),
      horizontalOverflow: html.scrollWidth > html.clientWidth + 4
    };
  }, hiddenTextTokens);

  const failures = [];
  if (snapshot.title !== "千秋") failures.push(`${label} document title mismatch: ${snapshot.title}`);
  if (snapshot.path !== pathname) failures.push(`${label} path mismatch: ${snapshot.path}`);
  if (!snapshot.hasReactEntry) failures.push(`${label} did not render the React data-router entry.`);
  if (snapshot.legacyStartForm) failures.push(`${label} still rendered the legacy start form.`);
  if (snapshot.clientScriptCount < 1) failures.push(`${label} did not load Vite client-assets.`);
  if (snapshot.hiddenLeaks.length) failures.push(`${label} leaked hidden text: ${snapshot.hiddenLeaks.join(", ")}`);
  if (snapshot.horizontalOverflow) failures.push(`${label} has horizontal overflow.`);
  if (!snapshot.text.includes("千秋")) failures.push(`${label} did not render the product name.`);
  failures.push(...getPlayerFacingCopyLeakFailures(snapshot.text, label));

  if (failures.length) {
    throw new Error(failures.join(" "));
  }

  await assertNoVisibleTextOverlap(page, label);
  await assertNoVisibleTextOverflow(page, label);
  await assertNoSafetyPollutionOnPage(page, label);
  return captureScreenshot(page, screenshotsDir, label);
}

async function assertReactClientPage(page, baseUrl, pathname, label, screenshotsDir, options = {}) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle" });
  return assertCurrentReactClientPage(page, pathname, label, screenshotsDir, options);
}

async function assertBrowserLevelReducedMotion(browser, baseUrl, screenshotsDir) {
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    const screenshots = [];
    screenshots.push(await assertReactClientPage(page, baseUrl, "/", "s77-browser-reduced-motion-home", screenshotsDir));
    const snapshot = await page.evaluate(() => {
      const mist = document.querySelector(".homeMist");
      const seal = document.querySelector(".homeStartSeal");
      const mistStyle = mist ? window.getComputedStyle(mist) : null;
      const sealStyle = seal ? window.getComputedStyle(seal) : null;
      return {
        mediaMatches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        shellMotion: document.querySelector(".appShell")?.getAttribute("data-motion"),
        mistAnimationName: mistStyle?.animationName || "",
        mistAnimationDuration: mistStyle?.animationDuration || "",
        sealTransitionDuration: sealStyle?.transitionDuration || ""
      };
    });
    if (!snapshot.mediaMatches) {
      throw new Error(`S77.6 browser-level reduced motion media query did not match: ${JSON.stringify(snapshot)}`);
    }
    if (snapshot.mistAnimationName !== "none" && snapshot.mistAnimationDuration !== "0.01ms") {
      throw new Error(`S77.6 browser-level reduced motion did not calm home motion: ${JSON.stringify(snapshot)}`);
    }
    screenshots.push(await assertReactClientPage(page, baseUrl, "/game/s74-preview/ranking", "s88-9-browser-reduced-motion-ranking", screenshotsDir, {
      readySelector: ".rankingFullScreen"
    }));
    const rankingSnapshot = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "rankingGoldenNotice";
      probe.innerHTML = '<div class="rankingGoldenTitle"><span>金榜题名</span></div>';
      probe.style.position = "absolute";
      probe.style.left = "-9999px";
      probe.style.top = "0";
      document.body.appendChild(probe);
      const noticeAnimationName = window.getComputedStyle(probe, "::before").animationName;
      const titleAnimationName = window.getComputedStyle(probe.querySelector(".rankingGoldenTitle span")).animationName;
      probe.remove();
      return {
        mediaMatches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        noticeAnimationName,
        titleAnimationName,
        hasRankingShell: Boolean(document.querySelector(".rankingFullScreen"))
      };
    });
    if (!rankingSnapshot.mediaMatches || !rankingSnapshot.hasRankingShell) {
      throw new Error(`S88.9 browser-level reduced motion ranking setup failed: ${JSON.stringify(rankingSnapshot)}`);
    }
    if (rankingSnapshot.noticeAnimationName !== "none" || rankingSnapshot.titleAnimationName !== "none") {
      throw new Error(`S88.9 browser-level reduced motion did not calm ranking ornament motion: ${JSON.stringify(rankingSnapshot)}`);
    }
    return screenshots;
  } finally {
    await context.close();
  }
}

async function waitForSafeSessionPath(page, label) {
  await page.waitForURL((url) => /^\/game\/[a-f0-9-]{36}$/i.test(url.pathname), { timeout: 15000 });
  const sessionId = new URL(page.url()).pathname.split("/")[2];
  if (!runnableSessionIdPattern.test(sessionId)) {
    throw new Error(`${label} did not navigate to a runnable session id: ${page.url()}`);
  }
  return sessionId;
}

async function startMockGameThroughHome(page, screenshotsDir) {
  await page.getByLabel("姓名").fill("烟测书生");
  await page.getByLabel("身份").selectOption("scholar");
  await page.getByRole("button", { name: "新开一卷" }).click();
  const sessionId = await waitForSafeSessionPath(page, "default home start");
  const gamePath = `/game/${sessionId}`;
  const screenshot = await assertCurrentReactClientPage(page, gamePath, "s74-react-mock-start-desktop", screenshotsDir);

  const entrypoints = await page.evaluate((id) => {
    const allLinks = [...document.querySelectorAll("a")].map((link) => ({
      text: (link.textContent || "").trim(),
      path: new URL(link.href).pathname
    }));
    const byText = new Map(allLinks.map((link) => [link.text, link.path]));
    return {
      topMap: byText.get("舆图"),
      topPeople: byText.get("人物"),
      topArchive: byText.get("史册"),
      exam: byText.get("科举"),
      ranking: byText.get("皇榜"),
      court: byText.get("朝议"),
      inkboxButtonCount: document.querySelectorAll("button[aria-label='打开印匣']").length,
      settingsSessionLinks: allLinks.filter((link) => link.text === "印匣" || link.path.endsWith("/settings")),
      previewLinks: allLinks.filter((link) => link.path.includes("s74-preview")).map((link) => link.text),
      expected: {
        map: `/game/${id}/map`,
        people: `/game/${id}/people`,
        archive: `/game/${id}/archive`,
        exam: `/game/${id}/exam`,
        ranking: `/game/${id}/ranking`,
        court: `/game/${id}/court`
      }
    };
  }, sessionId);

  const failures = [];
  if (entrypoints.topMap !== entrypoints.expected.map) failures.push(`top map link was ${entrypoints.topMap}`);
  if (entrypoints.topPeople !== entrypoints.expected.people) failures.push(`top people link was ${entrypoints.topPeople}`);
  if (entrypoints.topArchive !== entrypoints.expected.archive) failures.push(`top archive link was ${entrypoints.topArchive}`);
  if (entrypoints.exam !== entrypoints.expected.exam) failures.push(`exam link was ${entrypoints.exam}`);
  if (entrypoints.ranking !== entrypoints.expected.ranking) failures.push(`ranking link was ${entrypoints.ranking}`);
  if (entrypoints.court !== entrypoints.expected.court) failures.push(`court link was ${entrypoints.court}`);
  if (entrypoints.inkboxButtonCount !== 1) failures.push(`inkbox button count was ${entrypoints.inkboxButtonCount}`);
  if (entrypoints.settingsSessionLinks.length) {
    failures.push(`settings still appeared as a session nav link: ${entrypoints.settingsSessionLinks.map((link) => `${link.text}:${link.path}`).join(", ")}`);
  }
  if (entrypoints.previewLinks.length) failures.push(`runnable game shell still linked preview routes: ${entrypoints.previewLinks.join(", ")}`);
  if (failures.length) {
    throw new Error(`Default entry session links are not bound to the started Mock session: ${failures.join("; ")}`);
  }

  return { sessionId, screenshot };
}

async function assertScholarPanel(page, sessionId, screenshotsDir) {
  await page.getByRole("heading", { name: "寒窗书斋" }).waitFor({ timeout: 10000 });
  const panelSnapshot = await page.evaluate((id) => {
    const panel = document.querySelector(".scholarPanel");
    const text = panel?.textContent || "";
    const examLink = [...document.querySelectorAll(".scholarPanel a")].find((link) => (link.textContent || "").includes("入科举页"));
    const rankingLink = [...document.querySelectorAll(".scholarPanel a")].find((link) => (link.textContent || "").includes("看皇榜"));
    const buttons = [...document.querySelectorAll(".scholarPanel button")].map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled
    }));
    const computedStyle = panel ? getComputedStyle(panel) : null;
    const computedBackground = computedStyle
      ? `${panel?.getAttribute("data-role-background") || ""} ${computedStyle.getPropertyValue("--scholar-panel-bg")} ${computedStyle.backgroundImage}`
      : "";
    return {
      text,
      dimensionCount: panel?.querySelectorAll(".scholarPanelMetrics li").length || 0,
      hasStudyLedger: text.includes("读书簿"),
      hasTeacher: text.includes("老师点评"),
      hasNetwork: text.includes("师友"),
      hasCalendar: text.includes("科期"),
      hasPractice: text.includes("文章练习"),
      hasRoleCycle: text.includes("本旬身份循环") && text.includes("本旬事务") && text.includes("风险") && text.includes("可查入口") && text.includes("证据："),
      hasDeepPlan: text.includes("晨课") && text.includes("复盘") && text.includes("执行首课"),
      hasBoundary: text.includes("写成草稿") && text.includes("按案卷规则回批"),
      examPath: examLink ? new URL(examLink.href).pathname : "",
      rankingPath: rankingLink ? new URL(rankingLink.href).pathname : "",
      buttons,
      background: computedBackground,
      expectedExamPath: `/game/${id}/exam`,
      expectedRankingPath: `/game/${id}/ranking`,
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥/gi) || []
    };
  }, sessionId);

  const failures = [];
  if (!panelSnapshot.hasStudyLedger) failures.push("missing study ledger");
  if (!panelSnapshot.hasTeacher) failures.push("missing teacher feedback");
  if (!panelSnapshot.hasNetwork) failures.push("missing academy network");
  if (!panelSnapshot.hasCalendar) failures.push("missing exam calendar");
  if (!panelSnapshot.hasPractice) failures.push("missing practice block");
  if (!panelSnapshot.hasRoleCycle) failures.push("missing role cycle block");
  if (!panelSnapshot.hasDeepPlan) failures.push("missing deep study plan rhythm");
  if (!panelSnapshot.hasBoundary) failures.push("missing server boundary");
  if (panelSnapshot.dimensionCount < 7) failures.push(`expected seven study dimensions, saw ${panelSnapshot.dimensionCount}`);
  if (panelSnapshot.examPath !== panelSnapshot.expectedExamPath) failures.push(`exam link was ${panelSnapshot.examPath}`);
  if (panelSnapshot.rankingPath !== panelSnapshot.expectedRankingPath) failures.push(`ranking link was ${panelSnapshot.rankingPath}`);
  if (!panelSnapshot.buttons.some((button) => button.text === "请老师改文" && !button.disabled)) failures.push("teacher draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "执行首课" && !button.disabled)) failures.push("study plan first lesson draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "整备赴考" && !button.disabled)) failures.push("exam prep draft button missing or disabled");
  if (!panelSnapshot.background.includes("/assets/ui/")) failures.push("role background asset was not applied through the manifest registry");
  if (panelSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${panelSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.2 scholar panel smoke failed: ${failures.join("; ")}`);
  }

  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "请老师改文" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("携旧作拜见老师") && value.includes("破题");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.2 scholar draft button submitted a turn instead of writing a draft: ${turnRequests.join(", ")}`);
  }

  const draft = await page.getByLabel("本回合行动").inputValue();
  if (!draft.includes("携旧作拜见老师")) {
    throw new Error(`S76.2 scholar draft did not enter the memorial composer: ${draft}`);
  }
  await page.getByLabel("本回合行动").fill("");

  return captureScreenshot(page, screenshotsDir, "s76-scholar-panel-desktop");
}

async function assertExamFullScreen(page, sessionId, screenshotsDir, screenshotName = "s76-exam-fullscreen-desktop", options = {}) {
  await page.locator(".examFullScreen").waitFor({ timeout: 10000 });
  const initialSnapshot = await page.evaluate(({ id, tokens }) => {
    const shell = document.querySelector(".examFullScreen");
    const hero = document.querySelector(".examHero");
    const rail = document.querySelector(".examStageRail");
    const text = shell?.textContent || "";
    const background = hero ? getComputedStyle(hero).backgroundImage : "";
    const html = document.documentElement;
    return {
      path: window.location.pathname,
      expectedPath: `/game/${id}/exam`,
      hasHero: Boolean(hero),
      hasRail: Boolean(rail),
      hasQuestionPanel: Boolean(document.querySelector(".examQuestionPanel")),
      hasSafetyBoundary: text.includes("交卷、评分、舞弊、放榜、晋级和授官都回主卷定夺"),
      hasMainGameShell: Boolean(document.querySelector(".gameCommandBar") || document.querySelector(".gameMainDeck") || document.querySelector(".memorialComposer")),
      background,
      horizontalOverflow: html.scrollWidth > html.clientWidth + 4,
      hiddenLeaks: tokens.filter((token) => (document.body.innerText || "").includes(token))
    };
  }, { id: sessionId, tokens: hiddenTextTokens });

  const failures = [];
  if (initialSnapshot.path !== initialSnapshot.expectedPath) failures.push(`path was ${initialSnapshot.path}`);
  if (!initialSnapshot.hasHero) failures.push("missing exam hero");
  if (!initialSnapshot.hasRail) failures.push("missing exam stage rail");
  if (!initialSnapshot.hasQuestionPanel) failures.push("missing question panel");
  if (!initialSnapshot.hasSafetyBoundary) failures.push("missing server-owned exam boundary");
  if (initialSnapshot.hasMainGameShell) failures.push("exam route was still nested inside the main game shell");
  if (!initialSnapshot.background.includes("/assets/ui/")) failures.push("exam hero did not use a reviewed UI asset");
  if (initialSnapshot.horizontalOverflow) failures.push("exam page has horizontal overflow");
  if (initialSnapshot.hiddenLeaks.length) failures.push(`hidden text leaked: ${initialSnapshot.hiddenLeaks.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.7 exam page initial smoke failed: ${failures.join("; ")}`);
  }
  await assertReviewedBackgroundVisual(page, ".examHero", `S77.3 ${screenshotName} hero`);
  if (options.clickQuestion === false) {
    await assertNoSafetyPollutionOnPage(page, `S77.4 ${screenshotName}`);
    await assertNoVisibleTextOverflow(page, `S77.6 ${screenshotName}`);
    return captureScreenshot(page, screenshotsDir, screenshotName);
  }

  const examRequests = [];
  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/exam/")) {
        examRequests.push(url.pathname);
      }
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "取题" }).click();
  await page.locator("[aria-label='当前试卷']").waitFor({ timeout: 15000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);

  const examSnapshot = await page.evaluate((tokens) => {
    const shell = document.querySelector(".examFullScreen");
    const text = shell?.textContent || "";
    const textarea = document.querySelector(".examSubmit textarea");
    return {
      text,
      hasShell: Boolean(shell),
      hasErrorPage: Boolean(document.querySelector("#error-title")),
      hasQuestion: Boolean(document.querySelector(".examQuestionText")),
      hasEssay: Boolean(textarea),
      hasDraftBar: Boolean(document.querySelector(".examDraftBar")),
      hasPeerPanel: text.includes("同场考生、阅卷官与榜单只显示公开占位"),
      hasPhaseFeedback: text.includes("入场后反馈"),
      hasFeedbackDraftButton: [...document.querySelectorAll("button")].some((button) => (button.textContent || "").trim() === "拟行动"),
      hasSubmit: [...document.querySelectorAll("button")].some((button) => (button.textContent || "").trim() === "交卷" && !button.disabled),
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || [],
      hiddenLeaks: tokens.filter((token) => (document.body.innerText || "").includes(token))
    };
  }, hiddenTextTokens);

  const afterFailures = [];
  if (!examRequests.includes("/api/exam/question")) afterFailures.push(`missing /api/exam/question request: ${examRequests.join(", ")}`);
  if (turnRequests.length) afterFailures.push(`取题 submitted game turn: ${turnRequests.join(", ")}`);
  if (!examSnapshot.hasShell) afterFailures.push("exam route left the exam shell after requesting a question");
  if (examSnapshot.hasErrorPage) afterFailures.push("exam route rendered the error page after requesting a question");
  if (!examSnapshot.hasQuestion) afterFailures.push("missing rendered question");
  if (!examSnapshot.hasEssay) afterFailures.push("missing essay textarea");
  if (!examSnapshot.hasDraftBar) afterFailures.push("missing draft status bar");
  if (!examSnapshot.hasPeerPanel) afterFailures.push("missing safe virtual candidate panel");
  if (!examSnapshot.hasPhaseFeedback) afterFailures.push("missing server-owned phase feedback");
  if (!examSnapshot.hasFeedbackDraftButton) afterFailures.push("missing phase feedback draft button");
  if (!examSnapshot.hasSubmit) afterFailures.push("missing enabled submit button");
  if (examSnapshot.forbiddenText.length) afterFailures.push(`unsafe text leaked: ${examSnapshot.forbiddenText.join(", ")}`);
  if (examSnapshot.hiddenLeaks.length) afterFailures.push(`hidden text leaked: ${examSnapshot.hiddenLeaks.join(", ")}`);
  if (afterFailures.length) {
    throw new Error(`S76.7 exam page active smoke failed: ${afterFailures.join("; ")}`);
  }

  const examRequestCountBeforeDraft = examRequests.length;
  page.on("request", onRequest);
  await page.getByRole("button", { name: /拟行动：/ }).first().click();
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.7 phase feedback draft submitted a game turn: ${turnRequests.join(", ")}`);
  }
  if (examRequests.length !== examRequestCountBeforeDraft) {
    throw new Error(`S76.7 phase feedback draft called exam API: ${examRequests.join(", ")}`);
  }

  await assertNoSafetyPollutionOnPage(page, `S77.4 ${screenshotName}`);
  await assertNoVisibleTextOverflow(page, `S77.6 ${screenshotName}`);
  return captureScreenshot(page, screenshotsDir, screenshotName);
}

async function assertRankingFullScreen(page, sessionId, screenshotsDir, screenshotName = "s76-ranking-fullscreen-desktop") {
  await page.locator(".rankingFullScreen").waitFor({ timeout: 10000 });
  const snapshot = await page.evaluate(({ id, tokens }) => {
    const shell = document.querySelector(".rankingFullScreen");
    const hero = document.querySelector(".rankingHero");
    const board = document.querySelector(".rankingNoticeBoard");
    const text = shell?.textContent || "";
    const bodyText = document.body.innerText || "";
    const background = hero ? getComputedStyle(hero).backgroundImage : "";
    const html = document.documentElement;
    return {
      path: window.location.pathname,
      expectedPath: `/game/${id}/ranking`,
      hasHero: Boolean(hero),
      hasTopThree: Boolean(document.querySelector(".rankingTopThree")),
      hasBoard: Boolean(board),
      hasBoundary: text.includes("本榜只录已经张挂的定榜结果"),
      hasServerList: text.includes("金榜名单"),
      hasListOrEmpty: Boolean(document.querySelector(".rankingList")) || text.includes("榜文尚未张挂"),
      hasPlayerRow: Boolean(document.querySelector(".rankingList li.isPlayer")),
      hasGoldenNotice: Boolean(document.querySelector(".rankingGoldenNotice")),
      hasAftermath: text.includes("同年座师"),
      hasMainGameShell: Boolean(document.querySelector(".gameCommandBar") || document.querySelector(".gameMainDeck") || document.querySelector(".memorialComposer")),
      background,
      horizontalOverflow: html.scrollWidth > html.clientWidth + 4,
      forbiddenText: bodyText.match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || [],
      hiddenLeaks: tokens.filter((token) => bodyText.includes(token))
    };
  }, { id: sessionId, tokens: hiddenTextTokens });

  const failures = [];
  if (snapshot.path !== snapshot.expectedPath) failures.push(`path was ${snapshot.path}`);
  if (!snapshot.hasHero) failures.push("missing ranking hero");
  if (!snapshot.hasTopThree) failures.push("missing top-three ranking seals");
  if (!snapshot.hasBoard) failures.push("missing ranking notice board");
  if (!snapshot.hasBoundary) failures.push("missing server-owned ranking boundary");
  if (!snapshot.hasServerList) failures.push("missing server-owned ranking list heading");
  if (!snapshot.hasListOrEmpty) failures.push("missing ranking list or empty state");
  if (snapshot.hasPlayerRow && !snapshot.hasGoldenNotice) failures.push("missing player golden ranking notice");
  if (snapshot.hasPlayerRow && !snapshot.hasAftermath) failures.push("missing exam aftermath network block");
  if (snapshot.hasMainGameShell) failures.push("ranking route was still nested inside the main game shell");
  if (!snapshot.background.includes("/assets/ui/")) failures.push("ranking hero did not use a reviewed UI asset");
  if (snapshot.horizontalOverflow) failures.push("ranking page has horizontal overflow");
  if (snapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${snapshot.forbiddenText.join(", ")}`);
  if (snapshot.hiddenLeaks.length) failures.push(`hidden text leaked: ${snapshot.hiddenLeaks.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.8 ranking page smoke failed: ${failures.join("; ")}`);
  }

  await assertNoSafetyPollutionOnPage(page, `S77.4 ${screenshotName}`);
  await assertNoVisibleTextOverflow(page, `S77.6 ${screenshotName}`);
  return captureScreenshot(page, screenshotsDir, screenshotName);
}

async function startMockMagistrateThroughHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名").fill("烟测知县");
  await page.getByLabel("身份").selectOption("magistrate");
  await page.getByRole("button", { name: "新开一卷" }).click();
  return waitForSafeSessionPath(page, "magistrate home start");
}

async function assertMagistratePanel(page, sessionId, screenshotsDir) {
  await page.getByRole("heading", { name: "地方官署" }).waitFor({ timeout: 10000 });
  const panelSnapshot = await page.evaluate((id) => {
    const panel = document.querySelector(".magistratePanel");
    const text = panel?.textContent || "";
    const buttons = [...document.querySelectorAll(".magistratePanel button")].map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled
    }));
    const computedBackground = panel ? getComputedStyle(panel).getPropertyValue("--scholar-panel-bg") : "";
    return {
      text,
      metricCount: panel?.querySelectorAll(".scholarPanelMetrics li").length || 0,
      hasDocket: text.includes("案牍总览"),
      hasTrial: text.includes("公堂词讼"),
      hasFiscal: text.includes("钱粮仓储"),
      hasPatrol: text.includes("水利盗警"),
      hasGentry: text.includes("士绅乡约"),
      hasDomainConsequence: text.includes("领域后果追踪"),
      hasRoleCycle: text.includes("本旬身份循环") && text.includes("本旬事务") && text.includes("风险") && text.includes("可查入口") && text.includes("证据："),
      hasBoundary: text.includes("审案、征税、开仓、水利、缉捕、任免和考成都须候案卷回批"),
      buttons,
      background: computedBackground,
      path: window.location.pathname,
      expectedPath: `/game/${id}`,
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|stateDelta|playerDelta|evidenceRefs|outcomeId|auditRecord|cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|rawSql|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, sessionId);

  const failures = [];
  if (panelSnapshot.path !== panelSnapshot.expectedPath) failures.push(`path was ${panelSnapshot.path}`);
  if (!panelSnapshot.hasDocket) failures.push("missing docket overview");
  if (!panelSnapshot.hasTrial) failures.push("missing courtroom block");
  if (!panelSnapshot.hasFiscal) failures.push("missing fiscal block");
  if (!panelSnapshot.hasPatrol) failures.push("missing waterworks and patrol block");
  if (!panelSnapshot.hasGentry) failures.push("missing gentry block");
  if (!panelSnapshot.hasDomainConsequence) failures.push("missing domain consequence tracking block");
  if (!panelSnapshot.hasRoleCycle) failures.push("missing role cycle block");
  if (!panelSnapshot.hasBoundary) failures.push("missing server boundary");
  if (panelSnapshot.metricCount < 8) failures.push(`expected local docket metrics, saw ${panelSnapshot.metricCount}`);
  if (!panelSnapshot.buttons.some((button) => button.text === "升堂核案" && !button.disabled)) failures.push("trial draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "清厘钱粮" && !button.disabled)) failures.push("fiscal draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "调停乡约" && !button.disabled)) failures.push("gentry draft button missing or disabled");
  if (panelSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${panelSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.3 magistrate panel smoke failed: ${failures.join("; ")}`);
  }

  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "升堂核案" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("升堂核问积案") && value.includes("不自行结案");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.3 magistrate draft button submitted a turn instead of writing a draft: ${turnRequests.join(", ")}`);
  }

  const draft = await page.getByLabel("本回合行动").inputValue();
  if (!draft.includes("升堂核问积案")) {
    throw new Error(`S76.3 magistrate draft did not enter the memorial composer: ${draft}`);
  }
  await page.getByLabel("本回合行动").fill("");

  return captureScreenshot(page, screenshotsDir, "s76-magistrate-panel-desktop");
}

async function startMockOfficialThroughHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名").fill("烟测翰林");
  await page.getByLabel("身份").selectOption("official");
  await page.getByRole("button", { name: "新开一卷" }).click();
  return waitForSafeSessionPath(page, "official home start");
}

async function startMockMinisterThroughHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名").fill("烟测堂官");
  await page.getByLabel("身份").selectOption("minister");
  await page.getByRole("button", { name: "新开一卷" }).click();
  return waitForSafeSessionPath(page, "minister home start");
}

async function assertOfficialMinisterPanel(page, sessionId, screenshotsDir, options = {}) {
  const roleLabel = options.roleLabel || "入仕官员";
  const screenshotName = options.screenshotName || "s76-official-panel-desktop";
  await page.getByRole("heading", { name: "部院官署" }).waitFor({ timeout: 10000 });
  const panelSnapshot = await page.evaluate(({ id, expectedRoleLabel }) => {
    const panel = document.querySelector(".officialMinisterPanel");
    const text = panel?.textContent || "";
    const courtLink = [...document.querySelectorAll(".officialMinisterPanel a")].find((link) => (link.textContent || "").includes("入朝议页"));
    const buttons = [...document.querySelectorAll(".officialMinisterPanel button")].map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled
    }));
    const computedBackground = panel
      ? `${panel.getAttribute("data-role-background") || ""} ${getComputedStyle(panel).getPropertyValue("--scholar-panel-bg")}`
      : "";
    return {
      text,
      metricCount: panel?.querySelectorAll(".scholarPanelMetrics li").length || 0,
      hasCareer: text.includes("官职履历"),
      hasAssignments: text.includes("部院公文"),
      hasNetwork: text.includes("同年座师与人脉"),
      hasFaction: text.includes("派系与朝局风险"),
      hasAssessment: text.includes("考成与弹劾"),
      hasMemorial: text.includes("奏折朝议入口"),
      hasDomainConsequence: text.includes("领域后果"),
      hasExpectedRole: text.includes(expectedRoleLabel),
      hasRoleCycle: text.includes("本旬身份循环") && text.includes("本旬事务") && text.includes("风险") && text.includes("可查入口") && text.includes("证据："),
      hasBoundary: text.includes("不得在前端直接任免、奖惩、处分、弹劾成案或改写考成"),
      buttons,
      background: computedBackground,
      courtPath: courtLink ? new URL(courtLink.href).pathname : "",
      expectedCourtPath: `/game/${id}/court`,
      path: window.location.pathname,
      expectedPath: `/game/${id}`,
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|stateDelta|playerDelta|evidenceRefs|outcomeId|auditRecord|cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|rawSql|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, { id: sessionId, expectedRoleLabel: roleLabel });

  const failures = [];
  if (panelSnapshot.path !== panelSnapshot.expectedPath) failures.push(`path was ${panelSnapshot.path}`);
  if (!panelSnapshot.hasCareer) failures.push("missing career ledger");
  if (!panelSnapshot.hasAssignments) failures.push("missing bureau assignment block");
  if (!panelSnapshot.hasNetwork) failures.push("missing official network block");
  if (!panelSnapshot.hasFaction) failures.push("missing faction risk block");
  if (!panelSnapshot.hasAssessment) failures.push("missing assessment block");
  if (!panelSnapshot.hasMemorial) failures.push("missing memorial block");
  if (!panelSnapshot.hasDomainConsequence) failures.push("missing domain consequence tracking block");
  if (!panelSnapshot.hasExpectedRole) failures.push(`missing role label ${roleLabel}`);
  if (!panelSnapshot.hasRoleCycle) failures.push("missing role cycle block");
  if (!panelSnapshot.hasBoundary) failures.push("missing server boundary");
  if (panelSnapshot.metricCount < 4) failures.push(`expected career metrics, saw ${panelSnapshot.metricCount}`);
  if (!panelSnapshot.buttons.some((button) => button.text === "查办公文" && !button.disabled)) failures.push("assignment draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "回应弹劾" && !button.disabled)) failures.push("impeachment draft button missing or disabled");
  if (panelSnapshot.courtPath !== panelSnapshot.expectedCourtPath) failures.push(`court link was ${panelSnapshot.courtPath}`);
  if (!panelSnapshot.background.includes("/assets/ui/")) failures.push("role background asset was not applied through the manifest registry");
  if (panelSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${panelSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.4 official minister panel smoke failed: ${failures.join("; ")}`);
  }

  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "回应弹劾" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("若有弹劾风声") && value.includes("不自行成案");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.4 official minister draft button submitted a turn instead of writing a draft: ${turnRequests.join(", ")}`);
  }

  const draft = await page.getByLabel("本回合行动").inputValue();
  if (!draft.includes("若有弹劾风声")) {
    throw new Error(`S76.4 official minister draft did not enter the memorial composer: ${draft}`);
  }
  await page.getByLabel("本回合行动").fill("");

  return captureScreenshot(page, screenshotsDir, screenshotName);
}

async function startMockGeneralThroughHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名").fill("烟测总兵");
  await page.getByLabel("身份").selectOption("general");
  await page.getByRole("button", { name: "新开一卷" }).click();
  return waitForSafeSessionPath(page, "general home start");
}

async function assertGeneralPanel(page, sessionId, screenshotsDir) {
  await page.getByRole("heading", { name: "将领军务" }).waitFor({ timeout: 10000 });
  const panelSnapshot = await page.evaluate((id) => {
    const panel = document.querySelector(".generalPanel");
    const text = panel?.textContent || "";
    const mapLink = [...document.querySelectorAll(".generalPanel a")].find((link) => (link.textContent || "").includes("入舆图页"));
    const archiveLink = [...document.querySelectorAll(".generalPanel a")].find((link) => (link.textContent || "").includes("查史册"));
    const buttons = [...document.querySelectorAll(".generalPanel button")].map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled
    }));
    const computedBackground = panel
      ? `${panel.getAttribute("data-role-background") || ""} ${getComputedStyle(panel).getPropertyValue("--scholar-panel-bg")}`
      : "";
    return {
      text,
      metricCount: panel?.querySelectorAll(".scholarPanelMetrics li").length || 0,
      hasCommand: text.includes("军帐总览"),
      hasSupply: text.includes("粮饷与军心"),
      hasScouts: text.includes("斥候与情报"),
      hasFrontier: text.includes("边患与舆图"),
      hasReports: text.includes("战报与边议"),
      hasDomainConsequence: text.includes("军务后果追踪"),
      hasRoleCycle: text.includes("本旬身份循环") && text.includes("本旬事务") && text.includes("风险") && text.includes("可查入口") && text.includes("证据："),
      hasBoundary: text.includes("战役胜负、调兵遣将、外交和战、统帅任免、粮饷拨付与赏罚都须候案卷回批"),
      buttons,
      background: computedBackground,
      mapPath: mapLink ? new URL(mapLink.href).pathname : "",
      archivePath: archiveLink ? new URL(archiveLink.href).pathname : "",
      expectedMapPath: `/game/${id}/map`,
      expectedArchivePath: `/game/${id}/archive`,
      path: window.location.pathname,
      expectedPath: `/game/${id}`,
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|stateDelta|playerDelta|evidenceRefs|outcomeId|auditRecord|cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|rawSql|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, sessionId);

  const failures = [];
  if (panelSnapshot.path !== panelSnapshot.expectedPath) failures.push(`path was ${panelSnapshot.path}`);
  if (!panelSnapshot.hasCommand) failures.push("missing command block");
  if (!panelSnapshot.hasSupply) failures.push("missing supply block");
  if (!panelSnapshot.hasScouts) failures.push("missing scout block");
  if (!panelSnapshot.hasFrontier) failures.push("missing frontier map block");
  if (!panelSnapshot.hasReports) failures.push("missing war report block");
  if (!panelSnapshot.hasDomainConsequence) failures.push("missing military consequence tracking block");
  if (!panelSnapshot.hasRoleCycle) failures.push("missing role cycle block");
  if (!panelSnapshot.hasBoundary) failures.push("missing server military boundary");
  if (panelSnapshot.metricCount < 4) failures.push(`expected military metrics, saw ${panelSnapshot.metricCount}`);
  if (!panelSnapshot.buttons.some((button) => button.text === "遣出斥候" && !button.disabled)) failures.push("scout draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "草拟战报" && !button.disabled)) failures.push("war report draft button missing or disabled");
  if (panelSnapshot.mapPath !== panelSnapshot.expectedMapPath) failures.push(`map link was ${panelSnapshot.mapPath}`);
  if (panelSnapshot.archivePath !== panelSnapshot.expectedArchivePath) failures.push(`archive link was ${panelSnapshot.archivePath}`);
  if (!panelSnapshot.background.includes("/assets/ui/")) failures.push("role background asset was not applied through the manifest registry");
  if (panelSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${panelSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.5 general panel smoke failed: ${failures.join("; ")}`);
  }

  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "遣出斥候" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("遣斥候") && value.includes("不自行判定隐藏军情");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.5 general draft button submitted a turn instead of writing a draft: ${turnRequests.join(", ")}`);
  }

  const draft = await page.getByLabel("本回合行动").inputValue();
  if (!draft.includes("遣斥候")) {
    throw new Error(`S76.5 general draft did not enter the memorial composer: ${draft}`);
  }
  await page.getByLabel("本回合行动").fill("");

  return captureScreenshot(page, screenshotsDir, "s76-general-panel-desktop");
}

async function startMockEmperorThroughHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名").fill("烟测御案");
  await page.getByLabel("身份").selectOption("emperor");
  await page.getByRole("button", { name: "新开一卷" }).click();
  return waitForSafeSessionPath(page, "emperor home start");
}

async function assertEmperorPanel(page, sessionId, screenshotsDir) {
  await page.getByRole("heading", { name: "御案朝仪" }).waitFor({ timeout: 10000 });
  const panelSnapshot = await page.evaluate((id) => {
    const panel = document.querySelector(".emperorPanel");
    const text = panel?.textContent || "";
    const courtLink = [...document.querySelectorAll(".emperorPanel a")].find((link) => (link.textContent || "").includes("入朝议页"));
    const archiveLink = [...document.querySelectorAll(".emperorPanel a")].find((link) => (link.textContent || "").includes("查史册"));
    const buttons = [...document.querySelectorAll(".emperorPanel button")].map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled
    }));
    const computedBackground = panel
      ? `${panel.getAttribute("data-role-background") || ""} ${getComputedStyle(panel).getPropertyValue("--scholar-panel-bg")}`
      : "";
    return {
      text,
      metricCount: panel?.querySelectorAll(".scholarPanelMetrics li").length || 0,
      hasMemorials: text.includes("奏折队列"),
      hasVermilion: text.includes("朱批拟稿"),
      hasEdict: text.includes("圣旨草稿"),
      hasCourt: text.includes("朝议"),
      hasAppointments: text.includes("任免候选"),
      hasRewards: text.includes("赏罚预留"),
      hasDomainConsequence: text.includes("天下余波"),
      hasRoleCycle: text.includes("本旬身份循环") && text.includes("本旬事务") && text.includes("风险") && text.includes("可查入口") && text.includes("证据："),
      hasBoundary: text.includes("任免、赏罚、处分、朱批成案、圣旨生效和时间推进都须候案卷回批"),
      buttons,
      background: computedBackground,
      courtPath: courtLink ? new URL(courtLink.href).pathname : "",
      archivePath: archiveLink ? new URL(archiveLink.href).pathname : "",
      expectedCourtPath: `/game/${id}/court`,
      expectedArchivePath: `/game/${id}/archive`,
      path: window.location.pathname,
      expectedPath: `/game/${id}`,
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|stateDelta|playerDelta|evidenceRefs|outcomeId|auditRecord|cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|rawSql|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, sessionId);

  const failures = [];
  if (panelSnapshot.path !== panelSnapshot.expectedPath) failures.push(`path was ${panelSnapshot.path}`);
  if (!panelSnapshot.hasMemorials) failures.push("missing memorial queue block");
  if (!panelSnapshot.hasVermilion) failures.push("missing vermilion draft block");
  if (!panelSnapshot.hasEdict) failures.push("missing edict draft block");
  if (!panelSnapshot.hasCourt) failures.push("missing court debate block");
  if (!panelSnapshot.hasAppointments) failures.push("missing appointment candidate block");
  if (!panelSnapshot.hasRewards) failures.push("missing reward punishment block");
  if (!panelSnapshot.hasDomainConsequence) failures.push("missing domain consequence tracking block");
  if (!panelSnapshot.hasRoleCycle) failures.push("missing role cycle block");
  if (!panelSnapshot.hasBoundary) failures.push("missing emperor server boundary");
  if (panelSnapshot.metricCount < 4) failures.push(`expected emperor metrics, saw ${panelSnapshot.metricCount}`);
  if (!panelSnapshot.buttons.some((button) => button.text === "拟旨" && !button.disabled)) failures.push("edict draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "朱批奏折" && !button.disabled)) failures.push("vermilion draft button missing or disabled");
  if (panelSnapshot.courtPath !== panelSnapshot.expectedCourtPath) failures.push(`court link was ${panelSnapshot.courtPath}`);
  if (panelSnapshot.archivePath !== panelSnapshot.expectedArchivePath) failures.push(`archive link was ${panelSnapshot.archivePath}`);
  if (!panelSnapshot.background.includes("/assets/ui/")) failures.push("role background asset was not applied through the manifest registry");
  if (panelSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${panelSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.6 emperor panel smoke failed: ${failures.join("; ")}`);
  }

  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "拟旨" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("草拟一道明发谕旨") && value.includes("此稿未生效");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.6 emperor draft button submitted a turn instead of writing a draft: ${turnRequests.join(", ")}`);
  }

  const draft = await page.getByLabel("本回合行动").inputValue();
  if (!draft.includes("草拟一道明发谕旨")) {
    throw new Error(`S76.6 emperor draft did not enter the memorial composer: ${draft}`);
  }
  await page.getByLabel("本回合行动").fill("");

  return captureScreenshot(page, screenshotsDir, "s76-emperor-panel-desktop");
}

async function clickStableButton(page, buttonOptions, label) {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const locator = page.getByRole("button", buttonOptions).first();
    try {
      await locator.waitFor({ state: "visible", timeout: 10000 });
      await locator.click({ timeout: 10000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(350);
    }
  }
  throw new Error(`${label} could not be clicked before it refreshed: ${lastError?.message || lastError}`);
}

async function clickQuickActionDraft(page, label) {
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const locator = page.locator(".quickActionSlip[data-source='mock-ai'], .quickActionSlip[data-source='local-rule']").first();
      await locator.waitFor({ state: "visible", timeout: 5000 });
      await locator.click({ timeout: 5000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(450);
    }
  }
  throw new Error(`${label} could not click a refreshed quick action: ${lastError?.message || lastError}`);
}

async function assertReturnHomeContinueAndTurn(page, sessionId, screenshotsDir) {
  const gamePath = `/game/${sessionId}`;

  await page.getByRole("button", { name: "打开印匣" }).click();
  const drawer = page.locator("aside.drawerHost[aria-label='印匣']");
  await drawer.waitFor({ timeout: 10000 });
  await drawer.getByRole("button", { name: "返回首页" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 10000 });
  await page.getByRole("link", { name: "继续本局" }).waitFor({ timeout: 10000 });
  const homeState = await page.evaluate((id) => {
    const continueLink = document.querySelector("a.continueButton");
    return {
      continueHref: continueLink ? new URL(continueLink.href).pathname : null,
      continueText: document.querySelector("[aria-label='当前本局']")?.textContent || "",
      emptyActionForm: Boolean(document.querySelector("form.actionPanel")),
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider\b|prompt\b|hidden\b|key\b|path\b|[a-z]:[\\/]|file:\/{2}|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions/gi) || [],
      expected: gamePathFor(id)
    };

    function gamePathFor(value) {
      return `/game/${value}`;
    }
  }, sessionId);
  if (homeState.continueHref !== gamePath) {
    throw new Error(`Continue link did not preserve current session: ${JSON.stringify(homeState)}`);
  }
  if (!homeState.continueText.includes("当前本局") || !homeState.continueText.includes("案 ")) {
    throw new Error(`Home continue shelf did not render a safe current-session summary: ${JSON.stringify(homeState)}`);
  }
  if (homeState.emptyActionForm) {
    throw new Error("Return home kept the game action form mounted.");
  }
  if (homeState.forbiddenText.length) {
    throw new Error(`Return-home continue shelf leaked forbidden text: ${homeState.forbiddenText.join(", ")}`);
  }
  const homeScreenshot = await assertCurrentReactClientPage(page, "/", "s75-return-home-continue-desktop", screenshotsDir, {
    readySelector: ".continueShelf"
  });

  await page.getByRole("link", { name: "继续本局" }).click();
  await page.waitForURL((url) => url.pathname === gamePath, { timeout: 10000 });
  await clickQuickActionDraft(page, "S75.9 quick action");
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.trim().length > 8;
  }, null, { timeout: 10000 });
  const quickDraft = await page.getByLabel("本回合行动").inputValue();
  if (!quickDraft.trim() || /provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥/i.test(quickDraft)) {
    throw new Error(`S75.9 quick action did not write a safe draft: ${quickDraft}`);
  }
  const turnResponse = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      return url.pathname === "/api/game/turn" && response.request().method() === "POST";
    } catch {
      return false;
    }
  }, { timeout: 20000 });
  await page.getByLabel("本回合行动").press("Enter");
  await turnResponse;
  await page.getByRole("button", { name: "呈上" }).waitFor({ timeout: 20000 });
  await page.waitForFunction(() => !(document.querySelector("textarea")?.value || "").trim(), null, { timeout: 10000 });
  const continuedState = await page.evaluate(() => ({
    actionText: document.querySelector("textarea")?.value || "",
    quickActionSource: document.querySelector("[data-source='mock-ai'], [data-source='local-rule']")?.getAttribute("data-source") || "",
    forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider\b|prompt\b|hidden\b|key\b|path\b|[a-z]:[\\/]|file:\/{2}|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions/gi) || []
  }));
  if (continuedState.actionText.includes("温习经义")) {
    throw new Error(`Action draft was not cleared after continued-session turn: ${JSON.stringify(continuedState)}`);
  }
  if (!/mock-ai|local-rule/.test(continuedState.quickActionSource)) {
    throw new Error(`S75.9 quick action source marker was not visible: ${JSON.stringify(continuedState)}`);
  }
  if (continuedState.forbiddenText.length) {
    throw new Error(`Continued-session turn leaked forbidden text: ${continuedState.forbiddenText.join(", ")}`);
  }

  return {
    homeScreenshot,
    gameScreenshot: await assertCurrentReactClientPage(page, gamePath, "s75-continue-turn-desktop", screenshotsDir)
  };
}

async function assertInkboxTab(page, drawer, tabName, expectedText) {
  await drawer.getByRole("tab", { name: tabName }).click();
  await page.waitForFunction(
    (name) => {
      return [...document.querySelectorAll("aside.drawerHost [role='tab']")].some((tab) => {
        return (tab.textContent || "").includes(name) && tab.getAttribute("aria-selected") === "true";
      });
    },
    tabName,
    { timeout: 10000 }
  );

  const snapshot = await drawer.evaluate((element, input) => {
    const { text, tokens } = input;
    const panel = element.querySelector(".inkboxPanel");
    const bodyText = document.body.innerText || "";
    return {
      panelText: panel?.textContent || "",
      hiddenLeaks: tokens.filter((token) => bodyText.includes(token)),
      hasExpectedText: Boolean(panel?.textContent?.includes(text))
    };
  }, { text: expectedText, tokens: hiddenTextTokens });

  if (!snapshot.hasExpectedText) {
    throw new Error(`Inkbox tab ${tabName} did not render expected panel text: ${JSON.stringify(snapshot)}`);
  }
  if (snapshot.hiddenLeaks.length) {
    throw new Error(`Inkbox tab ${tabName} leaked hidden text: ${snapshot.hiddenLeaks.join(", ")}`);
  }
}

async function assertInkboxTabsAndSaveLoad(page, sessionId, screenshotsDir) {
  const gamePath = `/game/${sessionId}`;
  const sessionShortCode = sessionId.slice(0, 8);

  await page.getByRole("button", { name: "打开印匣" }).click();
  const drawer = page.locator("aside.drawerHost[aria-label='印匣']");
  await drawer.waitFor({ timeout: 10000 });
  await assertS895MaterialFeedbackPolish(page, "S89.5 desktop inkbox", { drawer: true });

  await assertInkboxTab(page, drawer, "推演", "推演设置");
  const narratorRoute = drawer.locator(".aiTaskRoute").filter({ hasText: "叙事" }).first();
  await narratorRoute.waitFor({ timeout: 10000 });
  const narratorOutput = narratorRoute.getByLabel("输出");
  const originalNarratorTokens = Number(await narratorOutput.inputValue());
  const savedNarratorTokens = originalNarratorTokens === 1801 ? 1802 : 1801;
  await narratorOutput.fill(String(savedNarratorTokens));
  await drawer.getByText("未保存").waitFor({ timeout: 5000 });
  const saveGlobalResponse = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      return url.pathname === "/api/ai/settings/global" && response.request().method() === "POST";
    } catch {
      return false;
    }
  }, { timeout: 15000 });
  await drawer.getByRole("button", { name: /保存全局设置/ }).click();
  await saveGlobalResponse;
  await drawer.getByText(/已保存/).waitFor({ timeout: 10000 });
  await drawer.getByRole("button", { name: "关闭抽屉" }).click();
  await drawer.waitFor({ state: "detached", timeout: 10000 });
  await page.getByRole("button", { name: "打开印匣" }).click();
  await drawer.waitFor({ timeout: 10000 });
  await assertInkboxTab(page, drawer, "推演", "推演设置");
  const reloadedNarratorValue = await drawer.locator(".aiTaskRoute").filter({ hasText: "叙事" }).first().getByLabel("输出").inputValue();
  if (reloadedNarratorValue !== String(savedNarratorTokens)) {
    throw new Error(`Global AI settings did not persist after drawer reload: ${reloadedNarratorValue}`);
  }
  const quickBudget = await drawer.getByLabel("快捷建议辅佐次数").evaluate((input) => ({
    value: input instanceof HTMLInputElement ? input.value : "",
    disabled: input instanceof HTMLInputElement ? input.disabled : false
  }));
  if (quickBudget.value !== "0" || !quickBudget.disabled) {
    throw new Error(`Inkbox quick-action tool budget was not locked to zero: ${JSON.stringify(quickBudget)}`);
  }

  await assertInkboxTab(page, drawer, "显示", "显示偏好");
  await assertInkboxTab(page, drawer, "摘要", "案卷摘要");
  await drawer.getByRole("button", { name: "关闭抽屉" }).click();
  await drawer.waitFor({ state: "detached", timeout: 10000 });
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "打开印匣", null, { timeout: 5000 });

  await page.getByRole("button", { name: "打开印匣" }).click();
  await drawer.waitFor({ timeout: 10000 });
  await assertInkboxTab(page, drawer, "旧案", "旧案");
  const refreshButton = drawer.getByRole("button", { name: "刷新" });
  await refreshButton.waitFor({ timeout: 10000 });
  if (!(await refreshButton.isDisabled())) {
    const savesResponse = page.waitForResponse((response) => {
      try {
        const url = new URL(response.url());
        return url.pathname === "/api/game/saves" && response.request().method() === "GET";
      } catch {
        return false;
      }
    }, { timeout: 15000 });
    await refreshButton.click();
    await savesResponse;
  }

  const currentCase = drawer.locator(".saveCaseItem", { hasText: `案 ${sessionShortCode}` }).first();
  await currentCase.waitFor({ timeout: 10000 });
  const saveSnapshot = await currentCase.evaluate((element, tokens) => {
    const text = document.body.innerText || "";
    return {
      cardText: (element.textContent || "").slice(0, 500),
      hiddenLeaks: tokens.filter((token) => text.includes(token)),
      unsafeText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|data\/sessions|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY/gi) || []
    };
  }, hiddenTextTokens);
  if (saveSnapshot.hiddenLeaks.length || saveSnapshot.unsafeText.length) {
    throw new Error(`Inkbox save list leaked unsafe text: ${JSON.stringify(saveSnapshot)}`);
  }

  const savesScreenshot = await captureScreenshot(page, screenshotsDir, "s75-inkbox-saves-tab-desktop");
  const playerStateResponse = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      return url.pathname === `/api/game/player-state/${sessionId}` && response.request().method() === "GET";
    } catch {
      return false;
    }
  }, { timeout: 15000 });
  await currentCase.getByRole("button", { name: "载入" }).click();
  await playerStateResponse;
  await page.waitForURL((url) => url.pathname === gamePath, { timeout: 10000 });
  await drawer.waitFor({ state: "detached", timeout: 10000 });

  return {
    savesScreenshot,
    loadedScreenshot: await assertCurrentReactClientPage(page, gamePath, "s75-inkbox-load-session-desktop", screenshotsDir)
  };
}

async function assertMobileInkbox(page, screenshotsDir) {
  await page.getByRole("button", { name: "打开印匣" }).click();
  const drawer = page.locator("aside.drawerHost[aria-label='印匣']");
  await drawer.waitFor({ timeout: 10000 });

  await assertInkboxTab(page, drawer, "推演", "推演设置");
  await assertInkboxTab(page, drawer, "旧案", "旧案");
  await assertInkboxTab(page, drawer, "显示", "显示偏好");
  await assertInkboxTab(page, drawer, "摘要", "案卷摘要");

  const metrics = await page.evaluate((tokens) => {
    const drawerElement = document.querySelector("aside.drawerHost[aria-label='印匣']");
    const rect = drawerElement?.getBoundingClientRect();
    const html = document.documentElement;
    return {
      drawerLeft: rect?.left ?? 0,
      drawerRight: rect?.right ?? 0,
      drawerWidth: rect?.width ?? 0,
      viewportWidth: window.innerWidth,
      tabCount: document.querySelectorAll("aside.drawerHost [role='tab']").length,
      horizontalOverflow: html.scrollWidth > html.clientWidth + 4,
      hiddenLeaks: tokens.filter((token) => (document.body.innerText || "").includes(token))
    };
  }, hiddenTextTokens);
  if (metrics.drawerWidth <= 0 || metrics.drawerLeft < -2 || metrics.drawerRight > metrics.viewportWidth + 2) {
    throw new Error(`Mobile inkbox drawer is outside the viewport: ${JSON.stringify(metrics)}`);
  }
  if (metrics.tabCount !== 4) {
    throw new Error(`Mobile inkbox did not render all tabs: ${JSON.stringify(metrics)}`);
  }
  if (metrics.horizontalOverflow) {
    throw new Error(`Mobile inkbox caused horizontal overflow: ${JSON.stringify(metrics)}`);
  }
  if (metrics.hiddenLeaks.length) {
    throw new Error(`Mobile inkbox leaked hidden text: ${metrics.hiddenLeaks.join(", ")}`);
  }

  const screenshot = await captureScreenshot(page, screenshotsDir, "s75-inkbox-mobile");
  await drawer.getByRole("button", { name: "关闭抽屉" }).click();
  await drawer.waitFor({ state: "detached", timeout: 10000 });
  return screenshot;
}

async function assertDisplayPreferencesPersistence(page, gamePath) {
  await page.getByRole("button", { name: "打开印匣" }).click();
  await page.getByRole("tab", { name: "显示" }).click();
  await page.getByRole("combobox", { name: "动效" }).selectOption("reduced");
  await page.getByRole("combobox", { name: "字号" }).selectOption("large");
  await page.getByRole("combobox", { name: "对比度" }).selectOption("high");
  await page.getByRole("combobox", { name: "正文字体" }).selectOption("kai-longcang");
  await page.getByRole("checkbox", { name: "自动滚动新回合" }).uncheck();
  await page.getByRole("checkbox", { name: "舆图动效" }).uncheck();
  await assertS895MaterialFeedbackPolish(page, "S89.5 reduced inkbox", { drawer: true, reducedOverlay: true });
  await page.getByRole("button", { name: "关闭抽屉" }).click();

  const storedBeforeReload = await page.evaluate(() => {
    const storageEntries = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      storageEntries.push([key, key ? window.localStorage.getItem(key) : null]);
    }
    return {
      shellMotion: document.querySelector(".appShell")?.getAttribute("data-motion"),
      shellTextSize: document.querySelector(".appShell")?.getAttribute("data-text-size"),
      shellContrast: document.querySelector(".appShell")?.getAttribute("data-contrast"),
      shellBodyFont: document.querySelector(".appShell")?.getAttribute("data-body-font"),
      displayPreferences: JSON.parse(window.localStorage.getItem("qianqiu.displayPreferences.v1") || "{}"),
      storageEntries
    };
  });

  const expectedPreferences = {
    motion: "reduced",
    textSize: "large",
    contrast: "high",
    bodyFont: "kai-longcang",
    autoScroll: false,
    mapMotion: false
  };
  const serializedStorage = JSON.stringify(storedBeforeReload.storageEntries);
  if (
    storedBeforeReload.shellMotion !== "reduced" ||
    storedBeforeReload.shellTextSize !== "large" ||
    storedBeforeReload.shellContrast !== "high" ||
    storedBeforeReload.shellBodyFont !== "kai-longcang"
  ) {
    throw new Error(`Display preference data attributes did not update: ${JSON.stringify(storedBeforeReload)}`);
  }
  if (JSON.stringify(storedBeforeReload.displayPreferences?.preferences) !== JSON.stringify(expectedPreferences)) {
    throw new Error(`Display preferences were not saved as the safe whitelist payload: ${JSON.stringify(storedBeforeReload)}`);
  }
  if (/\/api\/game\/state|\/api\/dev\/session-diagnostics|worldState|raw\b|provider\b|prompt\b|hidden\b|data\/sessions|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/i.test(serializedStorage)) {
    throw new Error(`Display preference localStorage contained forbidden text: ${serializedStorage}`);
  }

  await page.reload({ waitUntil: "networkidle" });
  await assertCurrentReactClientPage(page, gamePath, "s75-display-preferences-reload-desktop", null);
  const restored = await page.evaluate(() => ({
    shellMotion: document.querySelector(".appShell")?.getAttribute("data-motion"),
    shellTextSize: document.querySelector(".appShell")?.getAttribute("data-text-size"),
    shellContrast: document.querySelector(".appShell")?.getAttribute("data-contrast"),
    shellBodyFont: document.querySelector(".appShell")?.getAttribute("data-body-font")
  }));
  if (restored.shellMotion !== "reduced" || restored.shellTextSize !== "large" || restored.shellContrast !== "high" || restored.shellBodyFont !== "kai-longcang") {
    throw new Error(`Display preferences did not survive reload: ${JSON.stringify(restored)}`);
  }
}

async function clickTopNavRoute(page, label, expectedPath) {
  const link = page.locator(".topNav a", { hasText: label }).first();
  await link.waitFor({ timeout: 10000 });
  await page.waitForFunction(
    ({ text, path }) => {
      return [...document.querySelectorAll(".topNav a")].some((anchor) => {
        return (anchor.textContent || "").trim() === text && new URL(anchor.href).pathname === path;
      });
    },
    { text: label, path: expectedPath },
    { timeout: 10000 }
  );
  await link.click();
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 10000 });
}

async function clickSessionNavRoute(page, label, expectedPath) {
  const link = page.locator(".sessionNav a", { hasText: label }).first();
  await link.waitFor({ timeout: 10000 });
  await page.waitForFunction(
    ({ text, path }) => {
      return [...document.querySelectorAll(".sessionNav a")].some((anchor) => {
        return (anchor.textContent || "").trim() === text && new URL(anchor.href).pathname === path;
      });
    },
    { text: label, path: expectedPath },
    { timeout: 10000 }
  );
  await link.click();
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 10000 });
}

async function assertIndependentSessionRouteShell(page, label) {
  const snapshot = await page.evaluate(() => ({
    hasRouteShell: Boolean(document.querySelector(".sessionRouteShell")),
    hasGameCommandBar: Boolean(document.querySelector(".gameCommandBar")),
    hasGameMainDeck: Boolean(document.querySelector(".gameMainDeck")),
    hasMemorialComposer: Boolean(document.querySelector(".memorialComposer")),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 4
  }));
  const failures = [];
  if (!snapshot.hasRouteShell) failures.push("missing lightweight session route shell");
  if (snapshot.hasGameCommandBar) failures.push("rendered main game command bar");
  if (snapshot.hasGameMainDeck) failures.push("rendered main game deck");
  if (snapshot.hasMemorialComposer) failures.push("rendered bottom memorial composer");
  if (snapshot.horizontalOverflow) failures.push("caused horizontal overflow");
  if (failures.length) {
    throw new Error(`${label} independent route shell failed: ${failures.join("; ")}`);
  }
}

async function assertRouteRefresh(page, pathname, label, screenshotsDir, options = {}) {
  await page.reload({ waitUntil: "networkidle" });
  return assertCurrentReactClientPage(page, pathname, label, screenshotsDir, options);
}

async function assertHistoryBackForward(page, routes, screenshotsDir) {
  const [backRoute, forwardRoute] = routes;
  if (!backRoute || !forwardRoute) {
    throw new Error("S77.2 history smoke requires back and forward routes.");
  }

  await Promise.all([
    page.waitForURL((url) => url.pathname === backRoute.path, { timeout: 10000 }),
    page.goBack()
  ]);
  const backScreenshot = await assertCurrentReactClientPage(
    page,
    backRoute.path,
    backRoute.screenshot,
    screenshotsDir,
    { readySelector: backRoute.readySelector }
  );

  await Promise.all([
    page.waitForURL((url) => url.pathname === forwardRoute.path, { timeout: 10000 }),
    page.goForward()
  ]);
  const forwardScreenshot = await assertCurrentReactClientPage(
    page,
    forwardRoute.path,
    forwardRoute.screenshot,
    screenshotsDir,
    { readySelector: forwardRoute.readySelector }
  );

  return [backScreenshot, forwardScreenshot];
}

async function assertMapResourceFailureFallback(context, baseUrl, pathname, screenshotsDir) {
  const fallbackPage = await context.newPage();
  const blockedResources = [];
  const unsafeRequests = [];
  try {
    fallbackPage.on("request", (request) => {
      try {
        const url = new URL(request.url());
        if (unsafeClientApiPathPatterns.some((pattern) => pattern.test(url.pathname))) {
          unsafeRequests.push(url.pathname);
        }
      } catch {
      }
    });
    const abortMapRuntimeResource = async (route) => {
      blockedResources.push(new URL(route.request().url()).pathname);
      await route.abort();
    };
    await fallbackPage.route("**/vendor/pixi.min.js", abortMapRuntimeResource);
    await fallbackPage.route("**/mapRenderer.js", abortMapRuntimeResource);
    await fallbackPage.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle" });
    await fallbackPage.locator(".inkMapRuntimeBridge").waitFor({ timeout: 10000 });
    await fallbackPage.waitForFunction(
      () => ["error", "fallback"].includes(document.querySelector(".inkMapRuntimeBridge")?.getAttribute("data-map-status") || ""),
      null,
      { timeout: 10000 }
    );

    const snapshot = await fallbackPage.evaluate((tokens) => {
      const bridge = document.querySelector(".inkMapRuntimeBridge");
      const text = bridge?.textContent || "";
      const bodyText = document.body.innerText || "";
      const html = document.documentElement;
      return {
        status: bridge?.getAttribute("data-map-status"),
        text,
        hasCanvas: Boolean(bridge?.querySelector("canvas")),
        hiddenLeaks: tokens.filter((token) => bodyText.includes(token)),
        forbiddenText: bodyText.match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || [],
        horizontalOverflow: html.scrollWidth > html.clientWidth + 4
      };
    }, hiddenTextTokens);

    const failures = [];
    if (!blockedResources.some((resource) => resource.endsWith("/vendor/pixi.min.js") || resource.endsWith("/mapRenderer.js"))) {
      failures.push(`map runtime resource was not blocked: ${blockedResources.join(", ")}`);
    }
    if (!["error", "fallback"].includes(snapshot.status || "")) failures.push(`unexpected map fallback status: ${snapshot.status}`);
    if (!/舆图运行时暂不可用|地图素材未完全载入/.test(snapshot.text)) failures.push(`missing player-safe fallback copy: ${snapshot.text}`);
    if (snapshot.hasCanvas) failures.push("resource failure fallback still rendered a canvas");
    if (snapshot.horizontalOverflow) failures.push("resource failure fallback caused horizontal overflow");
    if (snapshot.hiddenLeaks.length) failures.push(`hidden text leaked: ${snapshot.hiddenLeaks.join(", ")}`);
    if (snapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${snapshot.forbiddenText.join(", ")}`);
    if (unsafeRequests.length) failures.push(`fallback page touched unsafe API: ${unsafeRequests.join(", ")}`);
    if (failures.length) {
      throw new Error(`S77.2 map resource fallback smoke failed: ${failures.join("; ")}`);
    }

    return await captureScreenshot(fallbackPage, screenshotsDir, "s77-map-resource-fallback-desktop");
  } finally {
    await fallbackPage.close();
  }
}

async function assertTopicSurfaces(page, sessionId, screenshotsDir) {
  await page.locator(".courtSurfacePage").waitFor({ timeout: 10000 });
  const initialSnapshot = await page.evaluate((tokens) => {
    const labels = ["奏折队列", "拟圣旨", "朝议", "堂审", "军议", "人物档案"];
    const bodyText = document.body.innerText || "";
    return {
      path: window.location.pathname,
      hasSurfacePage: Boolean(document.querySelector(".courtSurfacePage")),
      labels: labels.filter((label) => [...document.querySelectorAll(".courtSurfacePage button")].some((button) => (button.textContent || "").trim() === label)),
      hasBoundary: bodyText.includes("推演只拟草稿") || bodyText.includes("专题草稿") || bodyText.includes("案卷回批"),
      hiddenLeaks: tokens.filter((token) => bodyText.includes(token)),
      forbiddenText: bodyText.match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, hiddenTextTokens);

  const failures = [];
  if (initialSnapshot.path !== `/game/${sessionId}/court`) failures.push(`path was ${initialSnapshot.path}`);
  if (!initialSnapshot.hasSurfacePage) failures.push("missing court surface page");
  if (initialSnapshot.labels.length !== 6) failures.push(`missing topic surface labels: ${initialSnapshot.labels.join(", ")}`);
  if (!initialSnapshot.hasBoundary) failures.push("missing draft-only surface boundary");
  if (initialSnapshot.hiddenLeaks.length) failures.push(`hidden text leaked: ${initialSnapshot.hiddenLeaks.join(", ")}`);
  if (initialSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${initialSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.11 topic surface initial smoke failed: ${failures.join("; ")}`);
  }

  const topicLabels = ["奏折队列", "拟圣旨", "朝议", "堂审", "军议", "人物档案"];
  const unsafeRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if ((url.pathname === "/api/game/turn" && request.method() === "POST") || unsafeClientApiPathPatterns.some((pattern) => pattern.test(url.pathname))) {
        unsafeRequests.push(`${request.method()} ${url.pathname}`);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  for (const label of topicLabels) {
    await page.locator(".courtSurfacePage button", { hasText: new RegExp(`^${label}$`) }).click();
    await page.getByRole("dialog", { name: label }).waitFor({ timeout: 10000 });
    const dialogSnapshot = await page.evaluate(({ expectedLabel, tokens }) => {
      const dialog = document.querySelector(".localSurfacePanel");
      const bodyText = document.body.innerText || "";
      const dialogText = dialog?.textContent || "";
      return {
        dialogText,
        hasTitle: dialogText.includes(expectedLabel),
        hasLedgerSource: dialogText.includes("卷宗取材"),
        hasMaterials: dialogText.includes("材料"),
        hasDeliberation: dialogText.includes("筹议"),
        hasDraft: dialogText.includes("草稿"),
        hasReplyBoundary:
          dialogText.includes("回批口径") ||
          dialogText.includes("主卷定夺") ||
          dialogText.includes("案卷回批") ||
          dialogText.includes("案卷复核") ||
          dialogText.includes("不直接") ||
          dialogText.includes("不能调用"),
        hiddenLeaks: tokens.filter((token) => bodyText.includes(token)),
        playerFacingLeaks: dialogText.match(/数据来源|裁决边界|服务器裁决|draftContext|schema|manifest|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || [],
        forbiddenText: bodyText.match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
      };
    }, { expectedLabel: label, tokens: hiddenTextTokens });

    const perSurfaceFailures = [];
    if (!dialogSnapshot.hasTitle) perSurfaceFailures.push("missing title");
    if (!dialogSnapshot.hasLedgerSource) perSurfaceFailures.push("missing player-facing source note");
    if (!dialogSnapshot.hasMaterials) perSurfaceFailures.push("missing materials column");
    if (!dialogSnapshot.hasDeliberation) perSurfaceFailures.push("missing deliberation column");
    if (!dialogSnapshot.hasDraft) perSurfaceFailures.push("missing draft column");
    if (!dialogSnapshot.hasReplyBoundary) perSurfaceFailures.push("missing player-facing reply boundary");
    if (dialogSnapshot.hiddenLeaks.length) perSurfaceFailures.push(`hidden text leaked: ${dialogSnapshot.hiddenLeaks.join(", ")}`);
    if (dialogSnapshot.playerFacingLeaks.length) perSurfaceFailures.push(`player-facing topic terms leaked: ${dialogSnapshot.playerFacingLeaks.join(", ")}`);
    if (dialogSnapshot.forbiddenText.length) perSurfaceFailures.push(`unsafe text leaked: ${dialogSnapshot.forbiddenText.join(", ")}`);
    if (perSurfaceFailures.length) {
      throw new Error(`S76.12 topic surface ${label} smoke failed: ${perSurfaceFailures.join("; ")}`);
    }

    await page.getByRole("button", { name: "关闭专题" }).click();
    await page.getByRole("dialog", { name: label }).waitFor({ state: "detached", timeout: 10000 });
  }

  await page.locator(".courtSurfacePage button", { hasText: /^朝议$/ }).click();
  await page.getByRole("dialog", { name: "朝议" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "推演拟稿" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "推演拟稿" }).click();
  await page.waitForFunction(() => {
    const textarea = document.querySelector('textarea[aria-label="专题草稿正文"]');
    return Boolean(textarea && textarea.value.includes("廷议"));
  }, null, { timeout: 10000 });
  await page.getByRole("button", { name: "写入底部奏折" }).click();
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (unsafeRequests.length) {
    throw new Error(`S76.11 topic surface touched unsafe or turn API: ${unsafeRequests.join(", ")}`);
  }

  const surfaceSnapshot = await page.evaluate((tokens) => {
    const dialog = document.querySelector(".localSurfacePanel");
    const bodyText = document.body.innerText || "";
    return {
      dialogText: dialog?.textContent || "",
      draft: document.querySelector("textarea")?.value || "",
      hiddenLeaks: tokens.filter((token) => bodyText.includes(token)),
      forbiddenText: bodyText.match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, hiddenTextTokens);

  const dialogFailures = [];
  if (!surfaceSnapshot.draft.includes("廷议")) dialogFailures.push(`draft did not enter memorial composer: ${surfaceSnapshot.draft}`);
  if (surfaceSnapshot.hiddenLeaks.length) dialogFailures.push(`hidden text leaked: ${surfaceSnapshot.hiddenLeaks.join(", ")}`);
  if (surfaceSnapshot.forbiddenText.length) dialogFailures.push(`unsafe text leaked: ${surfaceSnapshot.forbiddenText.join(", ")}`);
  if (dialogFailures.length) {
    throw new Error(`S76.11 topic surface dialog smoke failed: ${dialogFailures.join("; ")}`);
  }

  return captureScreenshot(page, screenshotsDir, "s78-topic-surfaces-desktop");
}

async function runClientSmoke(options = {}) {
  if (!options.url && !hasReactClientBuild()) {
    throw new Error("React client build not found. Run npm run build:client before client smoke.");
  }

  const previousAiProvider = process.env.AI_PROVIDER;
  const previousGlobalAiSettingsPath = process.env.AI_GLOBAL_SETTINGS_PATH;
  const smokeGlobalAiSettingsPath = options.url
    ? null
    : path.join(__dirname, "..", "tmp", `client-smoke-ai-settings-${Date.now()}.json`);
  if (!options.url) {
    process.env.AI_PROVIDER = "mock";
    process.env.AI_GLOBAL_SETTINGS_PATH = smokeGlobalAiSettingsPath;
    await fs.mkdir(path.dirname(smokeGlobalAiSettingsPath), { recursive: true });
  }

  const browserPath = resolveBrowserExecutable({ browserPath: options.browserPath });
  const server = options.url ? null : createFetchSafeServer(app);
  const baseUrl = options.url || server.baseUrl;
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: !options.headed
  });
  const pageErrors = [];
  const unsafeApiRequests = [];
  const manifestRequests = [];
  const screenshots = [];

  try {
    const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      try {
        const { pathname } = new URL(request.url());
        if (unsafeClientApiPathPatterns.some((pattern) => pattern.test(pathname))) {
          unsafeApiRequests.push(pathname);
        }
        if (pathname === runtimeAssetManifestPath || pathname === sourceAssetManifestPath) {
          manifestRequests.push(pathname);
        }
      } catch {
      }
    });

    screenshots.push(await assertReactClientPage(page, baseUrl, "/", "s74-react-home-desktop", options.screenshotsDir));
    await assertS895MaterialFeedbackPolish(page, "S89.5 desktop home");
    await assertHomeStartSealTypography(page, "S89.2 desktop home");
    await assertHomeSaveShelfPolish(page, "S89.4 desktop home");
    await assertReviewedBackgroundVisual(page, ".homeBackdrop", "S77.3 desktop home backdrop");
    await assertClientResourceBudget(page, "S77.5 desktop home", CLIENT_RESOURCE_BUDGETS.home);
    await assertManifestRuntimeSafety(baseUrl);
    assertRuntimeManifestRequestOnly(manifestRequests, "S88.11 desktop home");
    const mockStart = await startMockGameThroughHome(page, options.screenshotsDir);
    const startedSessionId = mockStart.sessionId;
    screenshots.push(mockStart.screenshot);
    screenshots.push(await assertScholarPanel(page, startedSessionId, options.screenshotsDir));
    const continueFlow = await assertReturnHomeContinueAndTurn(page, startedSessionId, options.screenshotsDir);
    screenshots.push(continueFlow.homeScreenshot);
    screenshots.push(continueFlow.gameScreenshot);
    const inkboxFlow = await assertInkboxTabsAndSaveLoad(page, startedSessionId, options.screenshotsDir);
    screenshots.push(inkboxFlow.savesScreenshot);
    screenshots.push(inkboxFlow.loadedScreenshot);
    await assertDisplayPreferencesPersistence(page, `/game/${startedSessionId}`);
    await assertBrowserStorageSafety(page, "S77.4 after display preferences");
    const runtimeMapPath = `/game/${startedSessionId}/map`;
    await clearResourceTimings(page);
    await clickTopNavRoute(page, "舆图", runtimeMapPath);
    screenshots.push(
      await assertCurrentReactClientPage(page, runtimeMapPath, "s74-react-map-runtime-desktop", options.screenshotsDir, {
        readySelector: ".inkMapRuntimeBridge canvas"
      })
    );
    await assertClientResourceBudget(page, "S77.5 desktop map", CLIENT_RESOURCE_BUDGETS.map);
    await page.locator(".inkMapRuntimeBridge canvas").first().waitFor({ timeout: 15000 });
    const mapRuntime = await page.evaluate(() => {
      const bridge = document.querySelector(".inkMapRuntimeBridge");
      const canvas = bridge?.querySelector("canvas");
      const labels = [...document.querySelectorAll(".inkMapLabel")];
      return {
        hasFullScreen: Boolean(document.querySelector(".mapFullScreen")),
        hasLayerControls: document.querySelectorAll(".mapLayerToggle").length >= 3,
        polishMarker: document.querySelector(".mapFullScreen")?.getAttribute("data-polish-map") || "",
        layerSummary: document.querySelector(".mapLayerSummary")?.textContent || "",
        hasSituationLedger: Boolean(document.querySelector(".mapSituationLedger")),
        hasActionDeck: Boolean(document.querySelector(".mapActionDeck")),
        hasArchiveJump: [...document.querySelectorAll(".mapFullScreen a")].some((link) => (link.textContent || "").includes("入局势簿")),
        hasBoundary: (document.body.innerText || "").includes("地图显示坐标只用于画面排布"),
        status: bridge?.getAttribute("data-map-status"),
        motion: bridge?.getAttribute("data-map-motion"),
        canvasWidth: canvas?.clientWidth || 0,
        canvasHeight: canvas?.clientHeight || 0,
        labelCount: labels.length,
        forbiddenText: (document.body.innerText || "").match(/public\/app\.js|#action-input|#information-panel|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|tp-[a-z0-9_-]{6,}|\/Users|\/private|file:\/\//gi) || []
      };
    });
    if (!mapRuntime.hasFullScreen || !mapRuntime.hasLayerControls || !mapRuntime.hasSituationLedger || !mapRuntime.hasActionDeck || !mapRuntime.hasArchiveJump || !mapRuntime.hasBoundary || mapRuntime.polishMarker !== "s89-7-layer-tooltip") {
      throw new Error(`React map runtime missing S76.9 independent map shell: ${JSON.stringify(mapRuntime)}`);
    }
    if (!/三层全开|筛选只改卷上显示/.test(mapRuntime.layerSummary)) {
      throw new Error(`S89.7 map layer summary missing safe player-facing copy: ${JSON.stringify(mapRuntime)}`);
    }
    if (mapRuntime.motion !== "reduced") {
      throw new Error(`React map runtime ignored reduced display preference: ${JSON.stringify(mapRuntime)}`);
    }
    if (mapRuntime.canvasWidth <= 0 || mapRuntime.canvasHeight <= 0) {
      throw new Error(`React map runtime canvas is empty: ${JSON.stringify(mapRuntime)}`);
    }
    if (mapRuntime.labelCount <= 0) {
      throw new Error(`React map runtime rendered no safe labels: ${JSON.stringify(mapRuntime)}`);
    }
    if (mapRuntime.forbiddenText.length) {
      throw new Error(`React map runtime leaked forbidden text: ${mapRuntime.forbiddenText.join(", ")}`);
    }
    await page.getByRole("button", { name: "筛舆图" }).click();
    await page.getByRole("dialog", { name: "舆图筛选" }).waitFor({ timeout: 10000 });
    const mapFilterSurface = await page.evaluate(() => {
      const dialog = document.querySelector(".localSurfacePanel");
      const html = document.documentElement;
      const text = dialog?.textContent || "";
      return {
        marker: dialog?.querySelector("[data-polish-map-filter]")?.getAttribute("data-polish-map-filter") || "",
        ledgerMarker: dialog?.querySelector("[data-polish-map-surface]")?.getAttribute("data-polish-map-surface") || "",
        hasLayerGuide: text.includes("卷上图层") && text.includes("人物动向") && text.includes("候复边界"),
        hasReturnButton: text.includes("回舆图勾选"),
        hasDraftWord: text.includes("草稿"),
        hasMapDraftButton: text.includes("写入舆图草稿"),
        hasWrongDraftButton: text.includes("写入奏折草稿"),
        horizontalOverflow: html.scrollWidth > html.clientWidth + 2,
        forbiddenText: text.match(/数据来源|裁决边界|服务器裁决|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|resolver|safe view|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
      };
    });
    if (mapFilterSurface.marker !== "s89-12-surface-guide" || mapFilterSurface.ledgerMarker !== "s89-12-filter-ledger" || !mapFilterSurface.hasLayerGuide || !mapFilterSurface.hasReturnButton || mapFilterSurface.hasDraftWord || mapFilterSurface.hasMapDraftButton || mapFilterSurface.hasWrongDraftButton || mapFilterSurface.horizontalOverflow || mapFilterSurface.forbiddenText.length) {
      throw new Error(`S89.12 map filter surface unsafe or incomplete: ${JSON.stringify(mapFilterSurface)}`);
    }
    await page.getByRole("button", { name: "关闭专题" }).click();
    await page.getByRole("dialog", { name: "舆图筛选" }).waitFor({ state: "detached", timeout: 10000 });
    await assertS895MaterialFeedbackPolish(page, "S89.5 desktop map", { map: true });
    await assertCanvasHasInkPixels(page, ".inkMapRuntimeBridge canvas", "S77.3 desktop map runtime");
    const mapDraftButton = page.locator(".mapActionList button, .mapEventList button").first();
    await mapDraftButton.waitFor({ state: "visible", timeout: 10000 });
    await mapDraftButton.click();
    await assertS895MaterialFeedbackPolish(page, "S89.5 desktop map draft feedback", { map: true, mapWritten: true });
    await page.getByRole("checkbox", { name: "地点" }).uncheck();
    const hiddenLayer = await page.evaluate(() => ({
      state: document.querySelector(".mapLayerToggle[data-layer-state='hidden']")?.getAttribute("data-layer-state") || "",
      summary: document.querySelector(".mapLayerSummary")?.textContent || ""
    }));
    if (hiddenLayer.state !== "hidden" || !/暂隐 地点/.test(hiddenLayer.summary)) {
      throw new Error(`S89.7 map hidden layer feedback missing: ${JSON.stringify(hiddenLayer)}`);
    }
    await page.waitForFunction(() => document.querySelectorAll(".inkMapLabel").length === 0);
    await page.getByRole("checkbox", { name: "地点" }).check();
    await page.locator(".inkMapLabel").first().waitFor({ timeout: 10000 });
    await page.getByRole("checkbox", { name: "地点" }).uncheck();
    await page.getByRole("checkbox", { name: "驿路" }).uncheck();
    await page.getByRole("checkbox", { name: "近事" }).uncheck();
    await page.waitForFunction(() => document.querySelectorAll(".inkMapLabel").length === 0);
    const allHiddenLayer = await page.evaluate(() => {
      const html = document.documentElement;
      return {
        shellVisibility: document.querySelector(".mapFullScreen")?.getAttribute("data-layer-visibility") || "",
        bridgeVisibility: document.querySelector(".inkMapRuntimeBridge")?.getAttribute("data-layer-visibility") || "",
        overlayMarker: document.querySelector(".inkMapLayerEmptyOverlay")?.getAttribute("data-polish-map-empty") || "",
        digestMarker: document.querySelector(".mapVisibleLayerDigest")?.getAttribute("data-polish-map-empty") || "",
        labelCount: document.querySelectorAll(".inkMapLabel").length,
        digestText: document.querySelector(".mapVisibleLayerDigest")?.textContent || "",
        actionText: document.querySelector(".mapActionDeck")?.textContent || "",
        eventText: document.querySelector(".mapEventList")?.textContent || "",
        horizontalOverflow: html.scrollWidth > html.clientWidth + 2,
        forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|tp-[a-z0-9_-]{6,}|\/Users|\/private|file:\/\//gi) || []
      };
    });
    if (
      allHiddenLayer.shellVisibility !== "all-hidden" ||
      allHiddenLayer.bridgeVisibility !== "all-hidden" ||
      allHiddenLayer.overlayMarker !== "s89-11-runtime-empty" ||
      allHiddenLayer.digestMarker !== "s89-11-ledger-digest" ||
      allHiddenLayer.labelCount !== 0 ||
      !/暂无可见舆图线索/.test(allHiddenLayer.digestText) ||
      !/暂无可见舆图预备行动/.test(allHiddenLayer.actionText) ||
      allHiddenLayer.eventText ||
      allHiddenLayer.horizontalOverflow ||
      allHiddenLayer.forbiddenText.length
    ) {
      throw new Error(`S89.11 map all layers hidden state unsafe or incomplete: ${JSON.stringify(allHiddenLayer)}`);
    }
    await page.getByRole("button", { name: "展开三层" }).first().click();
    await page.locator(".inkMapLabel").first().waitFor({ timeout: 10000 });
    await page.locator(".inkMapLabel").first().click();
    await page.locator(".inkMapTooltip").waitFor({ timeout: 10000 });
    const tooltipBeforeDraft = await page.evaluate(() => ({
      marker: document.querySelector(".inkMapTooltip")?.getAttribute("data-polish-tooltip") || "",
      note: document.querySelector(".inkMapTooltipNote")?.textContent || "",
      writtenCount: document.querySelectorAll(".inkMapTooltip .paperButton[data-draft-state='written']").length,
      unsafeText: (document.querySelector(".inkMapTooltip")?.textContent || "").match(/provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|tp-[a-z0-9_-]{6,}|\/Users|\/private|file:\/\//gi) || []
    }));
    if (tooltipBeforeDraft.marker !== "s89-7-map-note" || !/单点札记/.test(tooltipBeforeDraft.note) || tooltipBeforeDraft.unsafeText.length) {
      throw new Error(`S89.7 map tooltip polish missing safe note: ${JSON.stringify(tooltipBeforeDraft)}`);
    }
    const tooltipDraftButton = page.locator(".inkMapTooltip .paperButton").first();
    if (await tooltipDraftButton.count()) {
      await tooltipDraftButton.click();
      const tooltipAfterDraft = await page.evaluate(() => ({
        writtenCount: document.querySelectorAll(".inkMapTooltip .paperButton[data-draft-state='written']").length,
        label: document.querySelector(".inkMapTooltip .paperButton[data-draft-state='written']")?.getAttribute("aria-label") || ""
      }));
      if (tooltipAfterDraft.writtenCount < 1 || !/已写入主卷草稿/.test(tooltipAfterDraft.label)) {
        throw new Error(`S89.7 map tooltip draft feedback missing: ${JSON.stringify(tooltipAfterDraft)}`);
      }
    }
    await page.getByRole("button", { name: "收起地图近事" }).click();
    await page.locator(".inkMapTooltip").waitFor({ state: "detached", timeout: 10000 });
    screenshots.push(
      await assertRouteRefresh(page, runtimeMapPath, "s74-react-map-runtime-refresh-desktop", options.screenshotsDir, {
        readySelector: ".inkMapRuntimeBridge canvas"
      })
    );

    const peoplePath = `/game/${startedSessionId}/people`;
    await clearResourceTimings(page);
    await clickTopNavRoute(page, "人物", peoplePath);
    screenshots.push(
      await assertCurrentReactClientPage(page, peoplePath, "s76-people-ledger-desktop", options.screenshotsDir, {
        readySelector: ".peopleLedgerList"
      })
    );
    await assertIndependentSessionRouteShell(page, "S89.2 人物");
    await page.locator(".peopleLedgerList").scrollIntoViewIfNeeded();
    await waitForVisiblePortraitImages(page, ".peopleLedgerList", "S77.5 desktop people ledger");
    const peopleResourceSnapshot = await assertClientResourceBudget(page, "S77.5 desktop people", CLIENT_RESOURCE_BUDGETS.people);
    assertRuntimeManifestRequestOnly(manifestRequests, "S88.11 desktop people");
    const portraitLedger = await page.evaluate(() => {
      const grid = document.querySelector(".peopleLedgerList");
      const shell = document.querySelector("[data-polish-people='s89-9-portrait-material']");
      const ledger = document.querySelector("[data-polish-people-ledger='s89-9-portrait-material']");
      const workbench = document.querySelector("[data-polish-people-workbench='s89-9-portrait-material']");
      const firstCard = document.querySelector("[data-polish-people-card='s89-9-portrait-material']");
      const firstCardStyle = firstCard ? window.getComputedStyle(firstCard) : null;
      const images = [...document.querySelectorAll(".peopleLedgerList img")];
      return {
        polishShell: Boolean(shell),
        polishLedger: Boolean(ledger),
        polishWorkbench: Boolean(workbench),
        polishCardCount: document.querySelectorAll("[data-polish-people-card='s89-9-portrait-material']").length,
        cardBackground: firstCardStyle?.backgroundImage || "",
        cardTransition: firstCardStyle?.transitionProperty || "",
        visible: Number(grid?.getAttribute("data-visible-people") || 0),
        total: Number(grid?.getAttribute("data-total-people") || 0),
        eagerImages: images.filter((image) => image.getAttribute("loading") !== "lazy").length,
        fullPoolCount: Number(grid?.getAttribute("data-total-portraits") || 0),
        localOrRawLeaks: (document.body.innerText || "").match(/artifacts|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions/gi) || []
      };
    });
    if (portraitLedger.visible > 8 || portraitLedger.visible <= 0) {
      throw new Error(`People ledger loaded an unsafe initial person count: ${portraitLedger.visible}`);
    }
    if (!portraitLedger.polishShell || !portraitLedger.polishLedger || !portraitLedger.polishWorkbench || portraitLedger.polishCardCount < 1 || !portraitLedger.cardBackground.includes("linear-gradient") || !/transform|box-shadow|border-color/i.test(portraitLedger.cardTransition)) {
      throw new Error(`S89.9 people portrait material polish hooks were incomplete: ${JSON.stringify(portraitLedger)}`);
    }
    if (portraitLedger.total <= 0 || portraitLedger.total > 80) {
      throw new Error(`People ledger did not stay on the current public person view: ${portraitLedger.total}`);
    }
    if (portraitLedger.fullPoolCount > 0) {
      throw new Error(`People ledger exposed a manifest pool count instead of current people: ${portraitLedger.fullPoolCount}`);
    }
    if (portraitLedger.eagerImages > 0) {
      throw new Error(`People ledger rendered non-lazy portrait image(s): ${portraitLedger.eagerImages}`);
    }
    if (portraitLedger.localOrRawLeaks.length) {
      throw new Error(`People ledger leaked forbidden text: ${portraitLedger.localOrRawLeaks.join(", ")}`);
    }
    await assertPeoplePortraitRuntimeSafety(page, "S88.11 desktop people ledger", peopleResourceSnapshot);
    await assertPortraitImagesLoaded(page, ".peopleLedgerList", "S77.3 desktop people ledger");
    await page.getByRole("button", { name: /查看.*高清立绘/ }).first().click();
    await page.locator("[data-portrait-viewer='true']").waitFor({ timeout: 10000 });
    const portraitViewer = await page.evaluate(() => {
      const viewer = document.querySelector("[data-portrait-viewer='true']");
      const image = viewer?.querySelector("img");
      const viewerText = viewer?.textContent || "";
      return {
        portraitRef: viewer?.querySelector("[data-portrait-ref]")?.getAttribute("data-portrait-ref") || "",
        imageSrc: image?.getAttribute("src") || "",
        polishProfile: viewer?.querySelector("[data-polish-profile='s89-6-portrait-life']") ? "yes" : "",
        polishPortrait: viewer?.getAttribute("data-polish-portrait") || "",
        polishCue: viewer?.querySelector("[data-polish-cue='s89-9-portrait-cue-material']") ? "yes" : "",
        hasAppearance: viewerText.includes("外貌介绍"),
        hasBiography: viewerText.includes("生平介绍"),
        hasCurrent: viewerText.includes("当前情况"),
        hasCueGrid: /画卷题签|衣饰|神采/.test(viewerText),
        cueGrid: (() => {
          const cue = viewer?.querySelector("[data-polish-cue='s89-9-portrait-cue-material']");
          const style = cue ? window.getComputedStyle(cue) : null;
          const first = cue?.querySelector("span");
          const firstStyle = first ? window.getComputedStyle(first) : null;
          return {
            count: cue?.querySelectorAll("span").length || 0,
            display: style?.display || "",
            background: firstStyle?.backgroundImage || "",
            animation: firstStyle?.animationName || "",
            shellMotion: document.querySelector(".appShell")?.getAttribute("data-motion") || "",
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          };
        })(),
        hasRicherCopy: /观画印象|画中所见|身世线索|眼下处境/.test(viewerText),
        storageKeys: [
          ...Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) || ""),
          ...Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index) || "")
        ],
        unsafeText: viewerText.match(/artifacts|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|localStorage|sessionStorage|portraitRef|运行时|manifest|schema|draftContext|server adjudication|file:\/{2}|sk-[a-z0-9_-]{6,}|tp-[a-z0-9_-]{6,}|[a-z]:[\\/]|\/(?:home|Users|private|mnt|tmp|var|etc)\/[^\s"'<>)]*/gi) || []
      };
    });
    if (!portraitViewer.portraitRef || !portraitViewer.imageSrc.startsWith("/assets/ui/portraits/")) {
      throw new Error(`S79.3 portrait viewer did not use an audited runtime portrait path: ${JSON.stringify(portraitViewer)}`);
    }
    const cueAnimationExpected = portraitViewer.cueGrid.shellMotion !== "reduced" && !portraitViewer.cueGrid.reducedMotion;
    if (portraitViewer.polishPortrait !== "s89-8-life-scroll" || portraitViewer.polishCue !== "yes" || !portraitViewer.polishProfile || !portraitViewer.hasAppearance || !portraitViewer.hasBiography || !portraitViewer.hasCurrent || !portraitViewer.hasCueGrid || !portraitViewer.hasRicherCopy || portraitViewer.cueGrid.count < 4 || portraitViewer.cueGrid.display !== "grid" || !portraitViewer.cueGrid.background.includes("linear-gradient") || (cueAnimationExpected ? portraitViewer.cueGrid.animation !== "s899CueLift" : portraitViewer.cueGrid.animation !== "none")) {
      throw new Error(`S89.8 portrait viewer missed player-facing life/current profile polish: ${JSON.stringify(portraitViewer)}`);
    }
    if (portraitViewer.storageKeys.some((key) => /portrait|viewer|image/i.test(key)) || portraitViewer.unsafeText.length) {
      throw new Error(`S79.3 portrait viewer widened storage or text safety: ${JSON.stringify(portraitViewer)}`);
    }
    await assertS895MaterialFeedbackPolish(page, "S89.5 portrait viewer", { portrait: true, portraitViewer: true });
    screenshots.push(await captureScreenshot(page, options.screenshotsDir, "s79-3-portrait-viewer-desktop"));
    await page.keyboard.press("Escape");
    await page.locator("[data-portrait-viewer='true']").waitFor({ state: "detached", timeout: 10000 });
    screenshots.push(
      ...(await assertHistoryBackForward(
        page,
        [
          {
            path: runtimeMapPath,
            readySelector: ".mapFullScreen .inkMapRuntimeBridge canvas",
            screenshot: "s77-history-back-map-desktop"
          },
          {
            path: peoplePath,
            readySelector: ".peopleLedgerList",
            screenshot: "s77-history-forward-people-desktop"
          }
        ],
        options.screenshotsDir
      ))
    );
    screenshots.push(
      await assertRouteRefresh(page, peoplePath, "s76-people-ledger-refresh-desktop", options.screenshotsDir, {
        readySelector: ".peopleLedgerList"
      })
    );

    const archivePath = `/game/${startedSessionId}/archive`;
    await assertArchiveWorldEntityImpactCanary(page, startedSessionId);
    await clickTopNavRoute(page, "史册", archivePath);
    screenshots.push(
      await assertCurrentReactClientPage(page, archivePath, "s74-react-archive-desktop", options.screenshotsDir, {
        readySelector: "#archive-title"
      })
    );
    await assertArchiveDigestPolish(page, "S89.4 desktop archive");
    await assertIndependentSessionRouteShell(page, "S89.2 史册");
    screenshots.push(
      await assertRouteRefresh(page, archivePath, "s74-react-archive-refresh-desktop", options.screenshotsDir, {
        readySelector: "#archive-title"
      })
    );

    const inventoryPath = `/game/${startedSessionId}/inventory`;
    await clickTopNavRoute(page, "囊箧", inventoryPath);
    screenshots.push(
      await assertCurrentReactClientPage(page, inventoryPath, "s89-2-inventory-desktop", options.screenshotsDir, {
        readySelector: ".inventoryRoutePanel"
      })
    );
    await assertIndependentSessionRouteShell(page, "S89.2 囊箧");
    const inventorySnapshot = await page.evaluate((inventoryLeakPatternSource) => {
      const html = document.documentElement;
      const text = document.body.innerText || "";
      const inventoryLeakPattern = new RegExp(inventoryLeakPatternSource, "gi");
      return {
        hasSummary: Boolean(document.querySelector(".inventorySummaryGrid")),
        hasWorkbench: Boolean(document.querySelector(".inventoryWorkbench")),
        hasTransferPanel: Boolean(document.querySelector(".inventoryTransferPanel")),
        hasEconomyTrace: Boolean(document.querySelector(".economyTraceSection")),
        horizontalOverflow: html.scrollWidth > html.clientWidth + 4,
        forbiddenText: text.match(inventoryLeakPattern) || []
      };
    }, inventoryPlayerFacingLeakPattern.source);
    if (!inventorySnapshot.hasSummary || !inventorySnapshot.hasWorkbench || !inventorySnapshot.hasTransferPanel || !inventorySnapshot.hasEconomyTrace) {
      throw new Error(`S89.2 desktop inventory is missing product matrix sections: ${JSON.stringify(inventorySnapshot)}`);
    }
    if (inventorySnapshot.horizontalOverflow) {
      throw new Error(`S89.2 desktop inventory caused horizontal overflow: ${JSON.stringify(inventorySnapshot)}`);
    }
    if (inventorySnapshot.forbiddenText.length) {
      throw new Error(`S89.2 desktop inventory leaked forbidden text: ${inventorySnapshot.forbiddenText.join(", ")}`);
    }
    screenshots.push(
      await assertRouteRefresh(page, inventoryPath, "s89-2-inventory-refresh-desktop", options.screenshotsDir, {
        readySelector: ".inventoryRoutePanel"
      })
    );
    screenshots.push(await assertMapResourceFailureFallback(context, baseUrl, runtimeMapPath, options.screenshotsDir));

    const examPath = `/game/${startedSessionId}/exam`;
    await clickSessionNavRoute(page, "科举", examPath);
    screenshots.push(await assertExamFullScreen(page, startedSessionId, options.screenshotsDir));
    screenshots.push(
      await assertRouteRefresh(page, examPath, "s76-exam-fullscreen-refresh-desktop", options.screenshotsDir, {
        readySelector: ".examFullScreen"
      })
    );

    const rankingPath = `/game/${startedSessionId}/ranking`;
    await clickSessionNavRoute(page, "皇榜", rankingPath);
    screenshots.push(await assertRankingFullScreen(page, startedSessionId, options.screenshotsDir));
    await assertReviewedBackgroundVisual(page, ".rankingHero", "S77.3 desktop ranking hero");
    screenshots.push(
      await assertRouteRefresh(page, rankingPath, "s76-ranking-fullscreen-refresh-desktop", options.screenshotsDir, {
        readySelector: ".rankingFullScreen"
      })
    );

    const sessionRouteChecks = [
      { label: "朝议", path: `/game/${startedSessionId}/court`, selector: "#court-title", screenshot: "s74-react-court-refresh-desktop", viaNav: true },
      { label: "印匣页", path: `/game/${startedSessionId}/settings`, selector: "#settings-title", screenshot: "s74-react-settings-refresh-desktop", viaNav: false }
    ];
    for (const route of sessionRouteChecks) {
      if (route.viaNav) {
        await clickSessionNavRoute(page, route.label, route.path);
      } else {
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle" });
      }
      await assertCurrentReactClientPage(page, route.path, route.screenshot.replace("-refresh", ""), null, {
        readySelector: route.selector
      });
      await assertIndependentSessionRouteShell(page, `S79.1 ${route.label}`);
      if (route.label === "朝议") {
        screenshots.push(await assertTopicSurfaces(page, startedSessionId, options.screenshotsDir));
      } else {
        const settingsRouteSnapshot = await page.evaluate(() => {
          const text = document.body.innerText || "";
          return {
            hasDirectory: Boolean(document.querySelector(".settingsDirectoryRoute")),
            hasCards: document.querySelectorAll(".settingsDirectoryCard").length,
            hasAiSettingsPanel: Boolean(document.querySelector(".aiSettingsPanel")),
            hasInkboxButton: Boolean(document.querySelector("button[aria-label='打开印匣']")),
            forbiddenText: text.match(/数据来源|裁决边界|服务器裁决|draftContext|schema|manifest|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
          };
        });
        if (!settingsRouteSnapshot.hasDirectory || settingsRouteSnapshot.hasCards !== 4 || settingsRouteSnapshot.hasAiSettingsPanel || !settingsRouteSnapshot.hasInkboxButton) {
          throw new Error(`S89.3 settings directory route regressed: ${JSON.stringify(settingsRouteSnapshot)}`);
        }
        if (settingsRouteSnapshot.forbiddenText.length) {
          throw new Error(`S89.3 settings route leaked unsafe/player-facing terms: ${settingsRouteSnapshot.forbiddenText.join(", ")}`);
        }
        await assertS895MaterialFeedbackPolish(page, "S89.5 settings directory", { settings: true });
      }
      screenshots.push(
        await assertRouteRefresh(page, route.path, route.screenshot, options.screenshotsDir, {
          readySelector: route.selector
        })
      );
    }

    const magistrateSessionId = await startMockMagistrateThroughHome(page, baseUrl);
    screenshots.push(await assertMagistratePanel(page, magistrateSessionId, options.screenshotsDir));
    const officialSessionId = await startMockOfficialThroughHome(page, baseUrl);
    screenshots.push(await assertOfficialMinisterPanel(page, officialSessionId, options.screenshotsDir, {
      roleLabel: "入仕官员",
      screenshotName: "s76-official-panel-desktop"
    }));
    const ministerSessionId = await startMockMinisterThroughHome(page, baseUrl);
    screenshots.push(await assertOfficialMinisterPanel(page, ministerSessionId, options.screenshotsDir, {
      roleLabel: "大臣",
      screenshotName: "s76-minister-panel-desktop"
    }));
    const generalSessionId = await startMockGeneralThroughHome(page, baseUrl);
    screenshots.push(await assertGeneralPanel(page, generalSessionId, options.screenshotsDir));
    const emperorSessionId = await startMockEmperorThroughHome(page, baseUrl);
    screenshots.push(await assertEmperorPanel(page, emperorSessionId, options.screenshotsDir));

    const health = await page.evaluate(async () => {
      const response = await fetch("/api/health");
      return { ok: response.ok, payload: await response.json() };
    });
    if (!health.ok || health.payload?.ok !== true) {
      throw new Error(`Health API failed through React server: ${JSON.stringify(health)}`);
    }

    await page.setViewportSize(VIEWPORTS.mobile);
    screenshots.push(
      await assertReactClientPage(page, baseUrl, `/game/${startedSessionId}`, "s75-memorial-composer-mobile", options.screenshotsDir, {
        readySelector: ".memorialComposer"
      })
    );
    const mobileComposer = await page.evaluate(() => {
      const composer = document.querySelector(".memorialComposer")?.getBoundingClientRect();
      const textarea = document.querySelector(".memorialComposer textarea")?.getBoundingClientRect();
      const html = document.documentElement;
      return {
        composerBottom: composer?.bottom || 0,
        composerTop: composer?.top || 0,
        textareaHeight: textarea?.height || 0,
        viewportHeight: window.innerHeight,
        horizontalOverflow: html.scrollWidth > html.clientWidth + 4,
        forbiddenText: (document.body.innerText || "").match(/provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions/gi) || []
      };
    });
    if (mobileComposer.composerBottom > mobileComposer.viewportHeight + 2 || mobileComposer.composerTop < 0 || mobileComposer.textareaHeight < 56) {
      throw new Error(`S75.8 mobile memorial composer is mispositioned: ${JSON.stringify(mobileComposer)}`);
    }
    if (mobileComposer.horizontalOverflow) {
      throw new Error(`S75.8 mobile memorial composer caused horizontal overflow: ${JSON.stringify(mobileComposer)}`);
    }
    if (mobileComposer.forbiddenText.length) {
      throw new Error(`S75.8 mobile memorial composer leaked forbidden text: ${mobileComposer.forbiddenText.join(", ")}`);
    }
    await page.goto(`${baseUrl}${examPath}`, { waitUntil: "networkidle" });
    screenshots.push(await assertExamFullScreen(page, startedSessionId, options.screenshotsDir, "s76-exam-fullscreen-mobile", { clickQuestion: false }));
    await page.goto(`${baseUrl}${rankingPath}`, { waitUntil: "networkidle" });
    screenshots.push(await assertRankingFullScreen(page, startedSessionId, options.screenshotsDir, "s76-ranking-fullscreen-mobile"));
    await assertReviewedBackgroundVisual(page, ".rankingHero", "S77.3 mobile ranking hero");
    await page.goto(`${baseUrl}${archivePath}`, { waitUntil: "networkidle" });
    screenshots.push(
      await assertCurrentReactClientPage(page, archivePath, "s88-9-archive-mobile", options.screenshotsDir, {
        readySelector: ".archiveRoutePanel"
      })
    );
    await assertArchiveDigestPolish(page, "S89.4 mobile archive");
    const mobileArchive = await page.evaluate(() => {
      const html = document.documentElement;
      const text = document.body.innerText || "";
      const traceGrid = document.querySelector(".archiveTraceGrid");
      return {
        hasRoutePanel: Boolean(document.querySelector(".archiveRoutePanel")),
        polishMarker: document.querySelector(".archiveRoutePanel")?.getAttribute("data-polish-archive") || "",
        hasTraceGrid: Boolean(traceGrid),
        traceLayout: traceGrid?.getAttribute("data-archive-layout") || "",
        hasEvidenceStack: Boolean(document.querySelector(".archiveEvidenceStack")),
        hasListOrEmpty: Boolean(document.querySelector(".archiveItemList")) || text.includes("暂无可显示的公开归档"),
        horizontalOverflow: html.scrollWidth > html.clientWidth + 2,
        forbiddenText: text.match(/provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|hidden\/raw|(?:^|\b)hidden\b|(?:^|\b)raw\b|服务器裁决|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|watchlist|NPC\b/gi) || []
      };
    });
    if (
      !mobileArchive.hasRoutePanel ||
      mobileArchive.polishMarker !== "s89-10-chronicle-density" ||
      !mobileArchive.hasTraceGrid ||
      mobileArchive.traceLayout !== "ledger-rail" ||
      !mobileArchive.hasEvidenceStack ||
      !mobileArchive.hasListOrEmpty
    ) {
      throw new Error(`S88.9 mobile archive is missing safe archive layout: ${JSON.stringify(mobileArchive)}`);
    }
    if (mobileArchive.horizontalOverflow) {
      throw new Error(`S88.9 mobile archive caused horizontal overflow: ${JSON.stringify(mobileArchive)}`);
    }
    if (mobileArchive.forbiddenText.length) {
      throw new Error(`S88.9 mobile archive leaked forbidden text: ${mobileArchive.forbiddenText.join(", ")}`);
    }
    await page.goto(`${baseUrl}${inventoryPath}`, { waitUntil: "networkidle" });
    screenshots.push(
      await assertCurrentReactClientPage(page, inventoryPath, "s89-2-inventory-mobile", options.screenshotsDir, {
        readySelector: ".inventoryRoutePanel"
      })
    );
    const mobileInventory = await page.evaluate((inventoryLeakPatternSource) => {
      const html = document.documentElement;
      const text = document.body.innerText || "";
      const inventoryLeakPattern = new RegExp(inventoryLeakPatternSource, "gi");
      return {
        hasSummary: Boolean(document.querySelector(".inventorySummaryGrid")),
        hasWorkbench: Boolean(document.querySelector(".inventoryWorkbench")),
        hasTransferPanel: Boolean(document.querySelector(".inventoryTransferPanel")),
        hasEconomyTrace: Boolean(document.querySelector(".economyTraceSection")),
        horizontalOverflow: html.scrollWidth > html.clientWidth + 2,
        forbiddenText: text.match(inventoryLeakPattern) || []
      };
    }, inventoryPlayerFacingLeakPattern.source);
    if (!mobileInventory.hasSummary || !mobileInventory.hasWorkbench || !mobileInventory.hasTransferPanel || !mobileInventory.hasEconomyTrace) {
      throw new Error(`S89.2 mobile inventory is missing product matrix sections: ${JSON.stringify(mobileInventory)}`);
    }
    if (mobileInventory.horizontalOverflow) {
      throw new Error(`S89.2 mobile inventory caused horizontal overflow: ${JSON.stringify(mobileInventory)}`);
    }
    if (mobileInventory.forbiddenText.length) {
      throw new Error(`S89.2 mobile inventory leaked forbidden text: ${mobileInventory.forbiddenText.join(", ")}`);
    }
    await page.goto(`${baseUrl}${runtimeMapPath}`, { waitUntil: "networkidle" });
    screenshots.push(
      await assertCurrentReactClientPage(page, runtimeMapPath, "s76-map-fullscreen-mobile", options.screenshotsDir, {
        readySelector: ".mapFullScreen .inkMapRuntimeBridge canvas"
      })
    );
    const mobileMap = await page.evaluate(() => {
      const html = document.documentElement;
      const stage = document.querySelector(".mapFullScreen .inkMapStage")?.getBoundingClientRect();
      return {
        hasFullScreen: Boolean(document.querySelector(".mapFullScreen")),
        hasLayerControls: document.querySelectorAll(".mapLayerToggle").length >= 3,
        hasLayerSummary: /筛选只改卷上显示/.test(document.querySelector(".mapLayerSummary")?.textContent || ""),
        hasSituationLedger: Boolean(document.querySelector(".mapSituationLedger")),
        hasActionDeck: Boolean(document.querySelector(".mapActionDeck")),
        stageHeight: stage?.height || 0,
        viewportHeight: window.innerHeight,
        horizontalOverflow: html.scrollWidth > html.clientWidth + 2,
        forbiddenText: (document.body.innerText || "").match(/public\/app\.js|#action-input|#information-panel|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|tp-[a-z0-9_-]{6,}|\/Users|\/private|file:\/\//gi) || []
      };
    });
    if (!mobileMap.hasFullScreen || !mobileMap.hasLayerControls || !mobileMap.hasLayerSummary || !mobileMap.hasSituationLedger || !mobileMap.hasActionDeck || mobileMap.stageHeight < mobileMap.viewportHeight * 0.45) {
      throw new Error(`S76.9 mobile map is missing the independent map layout: ${JSON.stringify(mobileMap)}`);
    }
    if (mobileMap.horizontalOverflow) {
      throw new Error(`S76.9 mobile map caused horizontal overflow: ${JSON.stringify(mobileMap)}`);
    }
    if (mobileMap.forbiddenText.length) {
      throw new Error(`S76.9 mobile map leaked forbidden text: ${mobileMap.forbiddenText.join(", ")}`);
    }
    await assertCanvasHasInkPixels(page, ".inkMapRuntimeBridge canvas", "S77.3 mobile map runtime");
    await page.getByRole("button", { name: "筛舆图" }).click();
    await page.getByRole("dialog", { name: "舆图筛选" }).waitFor({ timeout: 10000 });
    const mobileMapFilterSurface = await page.evaluate(() => {
      const dialog = document.querySelector(".localSurfacePanel");
      const html = document.documentElement;
      const text = dialog?.textContent || "";
      return {
        marker: dialog?.querySelector("[data-polish-map-filter]")?.getAttribute("data-polish-map-filter") || "",
        ledgerMarker: dialog?.querySelector("[data-polish-map-surface]")?.getAttribute("data-polish-map-surface") || "",
        hasLayerGuide: text.includes("卷上图层") && text.includes("筛看方法") && text.includes("回舆图勾选"),
        hasDraftWord: text.includes("草稿"),
        horizontalOverflow: html.scrollWidth > html.clientWidth + 2,
        forbiddenText: text.match(/数据来源|裁决边界|服务器裁决|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|resolver|safe view|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
      };
    });
    if (mobileMapFilterSurface.marker !== "s89-12-surface-guide" || mobileMapFilterSurface.ledgerMarker !== "s89-12-filter-ledger" || !mobileMapFilterSurface.hasLayerGuide || mobileMapFilterSurface.hasDraftWord || mobileMapFilterSurface.horizontalOverflow || mobileMapFilterSurface.forbiddenText.length) {
      throw new Error(`S89.12 mobile map filter surface unsafe or overflowing: ${JSON.stringify(mobileMapFilterSurface)}`);
    }
    await page.getByRole("button", { name: "关闭专题" }).click();
    await page.getByRole("dialog", { name: "舆图筛选" }).waitFor({ state: "detached", timeout: 10000 });
    await page.getByRole("checkbox", { name: "地点" }).uncheck();
    await page.getByRole("checkbox", { name: "驿路" }).uncheck();
    await page.getByRole("checkbox", { name: "近事" }).uncheck();
    await page.waitForFunction(() => document.querySelectorAll(".inkMapLabel").length === 0);
    const mobileHiddenMap = await page.evaluate(() => {
      const html = document.documentElement;
      return {
        shellVisibility: document.querySelector(".mapFullScreen")?.getAttribute("data-layer-visibility") || "",
        overlayMarker: document.querySelector(".inkMapLayerEmptyOverlay")?.getAttribute("data-polish-map-empty") || "",
        digestText: document.querySelector(".mapVisibleLayerDigest")?.textContent || "",
        restoreButtons: [...document.querySelectorAll("button")].filter((button) => (button.textContent || "").includes("展开三层")).length,
        horizontalOverflow: html.scrollWidth > html.clientWidth + 2,
        forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|tp-[a-z0-9_-]{6,}|\/Users|\/private|file:\/\//gi) || []
      };
    });
    if (mobileHiddenMap.shellVisibility !== "all-hidden" || mobileHiddenMap.overlayMarker !== "s89-11-runtime-empty" || !/暂无可见舆图线索/.test(mobileHiddenMap.digestText) || mobileHiddenMap.restoreButtons < 1 || mobileHiddenMap.horizontalOverflow || mobileHiddenMap.forbiddenText.length) {
      throw new Error(`S89.11 mobile map all layers hidden state unsafe or overflowing: ${JSON.stringify(mobileHiddenMap)}`);
    }
    await page.getByRole("button", { name: "展开三层" }).first().click();
    await page.locator(".inkMapLabel").first().waitFor({ timeout: 10000 });
    screenshots.push(await assertMobileInkbox(page, options.screenshotsDir));
    screenshots.push(await assertReactClientPage(page, baseUrl, "/", "s74-react-home-mobile", options.screenshotsDir));
    await assertS895MaterialFeedbackPolish(page, "S89.5 mobile home");
    await assertHomeStartSealTypography(page, "S89.2 mobile home");
    await assertHomeSaveShelfPolish(page, "S89.4 mobile home");
    await assertReviewedBackgroundVisual(page, ".homeBackdrop", "S77.3 mobile home backdrop");
    await assertBrowserStorageSafety(page, "S77.4 final mobile context");
    screenshots.push(...(await assertBrowserLevelReducedMotion(browser, baseUrl, options.screenshotsDir)));
    await context.close();

    if (pageErrors.length) {
      throw new Error(`Client smoke page errors detected: ${pageErrors.join("; ")}`);
    }
    if (unsafeApiRequests.length) {
      throw new Error(`React client smoke touched unsafe API path(s): ${[...new Set(unsafeApiRequests)].join(", ")}`);
    }
    await assertScreenshotArtifactsSafety(screenshots);
    await assertClientVisualMatrixCoverage(screenshots, { requireFiles: Boolean(options.screenshotsDir) });

    return {
      baseUrl,
      screenshots,
      viewports: [
        "desktop-home",
        "desktop-mock-start",
        "desktop-scholar-panel",
        "desktop-return-home-continue",
        "desktop-continue-turn",
        "desktop-inkbox-tabs",
        "desktop-inkbox-load-session",
        "desktop-display-preferences-reload",
        "desktop-map-runtime",
        "desktop-map-refresh",
        "desktop-history-back-map",
        "desktop-history-forward-people",
        "desktop-map-resource-fallback",
        "desktop-people-assets",
        "desktop-people-refresh",
        "desktop-inventory",
        "desktop-archive-refresh",
        "desktop-exam-fullscreen",
        "desktop-exam-fullscreen-refresh",
        "desktop-ranking-fullscreen",
        "desktop-ranking-fullscreen-refresh",
        "desktop-topic-surfaces",
        "desktop-court-refresh",
        "desktop-settings-refresh",
        "desktop-magistrate-panel",
        "desktop-official-panel",
        "desktop-minister-panel",
        "desktop-general-panel",
        "desktop-emperor-panel",
        "mobile-memorial-composer",
        "mobile-exam-fullscreen",
        "mobile-ranking-fullscreen",
        "mobile-archive",
        "mobile-inventory",
        "mobile-map-fullscreen",
        "mobile-inkbox-tabs",
        "mobile-home",
        "browser-reduced-motion-home"
      ]
    };
  } finally {
    await browser.close();
    if (server) await server.close();
    if (!options.url) {
      if (previousAiProvider === undefined) {
        delete process.env.AI_PROVIDER;
      } else {
        process.env.AI_PROVIDER = previousAiProvider;
      }
      if (previousGlobalAiSettingsPath === undefined) {
        delete process.env.AI_GLOBAL_SETTINGS_PATH;
      } else {
        process.env.AI_GLOBAL_SETTINGS_PATH = previousGlobalAiSettingsPath;
      }
      if (smokeGlobalAiSettingsPath) {
        await fs.rm(smokeGlobalAiSettingsPath, { force: true }).catch(() => {});
      }
    }
  }
}

function printHelp() {
  console.log(`Usage: npm run smoke:browser -- [options]

Options:
  --url <url>          Test an already running Qianqiu server.
  --client react       Explicitly select the current React client smoke target.
  --browser <path>     Browser executable path. Defaults to BROWSER_EXECUTABLE_PATH or local Chrome/Edge.
  --screenshots <dir>  Save S74.1 React client smoke screenshots to this directory.
  --headed             Show the browser window while running.
  --help               Show this message.
`);
}

if (require.main === module) {
  (async () => {
    const args = parseClientSmokeArgs(process.argv);
    if (args.help) {
      printHelp();
      return;
    }

    const result = await runClientSmoke(args);
    console.log(`Client smoke passed: ${result.baseUrl}`);
    console.log(`React routes: ${result.viewports.join(", ")}`);
    const saved = result.screenshots.filter((screenshot) => screenshot.filePath);
    if (saved.length) {
      console.log(`Screenshots: ${path.dirname(saved[0].filePath)}`);
    }
  })().catch((error) => {
    console.error(`Client smoke failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  CLIENT_RESOURCE_BUDGETS,
  assertRuntimeManifestRequestOnly,
  getResourceBudgetFailures,
  getResourceBudgetSnapshot,
  getPlayerFacingCopyLeakFailures,
  getRuntimeManifestSafetyFailures,
  getSafetyPollutionFailures,
  getTextOverlapFailures,
  getTextOverflowFailures,
  parseClientSmokeArgs,
  runClientSmoke
};
