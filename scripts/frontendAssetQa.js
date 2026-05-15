const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const manifestPath = path.join(rootDir, "public", "assets", "ui", "ink-ui-manifest.json");
const defaultReportPath = path.join(rootDir, "public", "assets", "ui", "asset-qa-report-v1.json");
const previewPath = path.join(rootDir, "public", "assets", "ui", "asset-qa-preview.html");

const forbiddenSecretOrLocalPath =
  /(OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/]|file:\/\/|https?:\/\/|data:|data[\\/](?:sessions|audit))/i;
const forbiddenAssetValue =
  /(world_sessions|prompt_retrieval_index|event_log|hiddenNotes|hiddenIntent|raw[_ -]?(?:table|prompt|provider|audit|coordinate)|完整 prompt 原文：)/i;

const compositeBackgrounds = Object.freeze([
  { id: "paper", color: "#f5f0e6", label: "宣纸底" },
  { id: "dark", color: "#201c16", label: "深色底" }
]);

const pixelThresholds = Object.freeze({
  borderSampleWidthPx: 2,
  hardAlphaJumpThreshold: 220,
  maxHighSaturationGreenOrMagentaPixels: 180,
  maxBorderVisibleAlphaPixels: 1800
});

function parseArgs(argv) {
  const options = {
    write: false,
    check: false,
    pixel: false,
    browserPath: null,
    reportPath: defaultReportPath
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") options.write = true;
    else if (arg === "--check") options.check = true;
    else if (arg === "--pixel") options.pixel = true;
    else if (arg === "--browser") {
      options.browserPath = argv[index + 1];
      index += 1;
    } else if (arg === "--report") {
      options.reportPath = path.resolve(rootDir, argv[index + 1]);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.write && !options.check) options.check = true;
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/frontendAssetQa.js --check
  node scripts/frontendAssetQa.js --write --pixel [--browser <path>]

Options:
  --check        Validate the committed S73.9 QA report against the current manifest.
  --write        Regenerate public/assets/ui/asset-qa-report-v1.json.
  --pixel        Use the existing Playwright/Chrome toolchain to sample transparent asset pixels.
  --browser      Optional Chrome/Edge executable path for --pixel.
  --report       Optional report path. Defaults to public/assets/ui/asset-qa-report-v1.json.`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function toProjectPath(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function assertSafeUiAssetPath(assetPath, fieldName, issues) {
  if (assetPath == null || assetPath === "不适用") return;
  if (typeof assetPath !== "string") {
    issues.push(errorIssue(fieldName, "路径字段必须是字符串"));
    return;
  }
  if (!assetPath.startsWith("/assets/ui/")) {
    issues.push(errorIssue(fieldName, "路径必须位于 /assets/ui/ 下"));
  }
  if (assetPath.includes("..")) issues.push(errorIssue(fieldName, "路径不得包含父目录跳转"));
  if (/^https?:\/\//i.test(assetPath)) issues.push(errorIssue(fieldName, "路径不得使用远程 URL"));
  if (/^file:\/\//i.test(assetPath)) issues.push(errorIssue(fieldName, "路径不得使用 file URL"));
  if (/^data:/i.test(assetPath)) issues.push(errorIssue(fieldName, "路径不得使用 data URL"));
  if (forbiddenSecretOrLocalPath.test(assetPath)) {
    issues.push(errorIssue(fieldName, "路径包含本地路径、密钥或敏感存储形状"));
  }
}

function resolveUiAssetPath(assetPath) {
  return path.join(rootDir, "public", assetPath.replace(/^\//, ""));
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function readWebpInfo(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Unsupported WebP container");
  }

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
  if (!filePath.endsWith(".webp")) throw new Error(`Unsupported UI asset format: ${filePath}`);
  return readWebpInfo(fs.readFileSync(filePath));
}

function errorIssue(target, message) {
  return { severity: "error", target, message };
}

function warningIssue(target, message) {
  return { severity: "warning", target, message };
}

function collectForbiddenValueIssues(value, label, issues) {
  if (value == null) return;
  if (typeof value === "string") {
    if (forbiddenSecretOrLocalPath.test(value)) {
      issues.push(errorIssue(label, "字段包含密钥、本地路径、远程 URL 或敏感存储形状"));
    }
    if (forbiddenAssetValue.test(value)) {
      issues.push(errorIssue(label, "字段包含 raw/hidden/prompt/provider/audit 禁用内容"));
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenValueIssues(item, `${label}[${index}]`, issues));
    return;
  }
  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      collectForbiddenValueIssues(nestedValue, `${label}.${key}`, issues);
    }
  }
}

function getDefaultBrowserCandidates(platform = process.platform, env = process.env) {
  if (platform === "win32") {
    const joinWinPath = (...parts) => path.win32.join(...parts);
    return [
      joinWinPath(env.ProgramFiles || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
      joinWinPath(env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
      joinWinPath(env.ProgramFiles || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe")
    ];
  }
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ];
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge"
  ];
}

function resolveBrowserExecutable(options = {}) {
  const explicitPath = options.browserPath || process.env.BROWSER_EXECUTABLE_PATH;
  if (explicitPath) {
    if (fs.existsSync(explicitPath)) return explicitPath;
    throw new Error(`Browser executable not found: ${explicitPath}`);
  }
  const candidate = getDefaultBrowserCandidates().find((candidatePath) => fs.existsSync(candidatePath));
  if (candidate) return candidate;
  throw new Error("No Chrome/Edge executable found. Set BROWSER_EXECUTABLE_PATH or pass --browser <path>.");
}

async function analyzeTransparentPixels(assets, options) {
  const transparentAssets = assets.filter((asset) => asset.transparent);
  if (transparentAssets.length === 0) {
    return { enabled: false, reason: "no transparent assets", assets: {} };
  }

  const { chromium } = require("playwright-core");
  const browserPath = resolveBrowserExecutable(options);
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = {};

  try {
    for (const asset of transparentAssets) {
      const absolutePath = resolveUiAssetPath(asset.path);
      const dataUrl = `data:image/webp;base64,${fs.readFileSync(absolutePath).toString("base64")}`;
      results[asset.id] = await page.evaluate(
        async ({ dataUrl: source, thresholds, backgrounds }) => {
          function loadImage(src) {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error("image decode failed"));
              img.src = src;
            });
          }

          function parseHexColor(hex) {
            const value = hex.replace("#", "");
            return {
              r: parseInt(value.slice(0, 2), 16),
              g: parseInt(value.slice(2, 4), 16),
              b: parseInt(value.slice(4, 6), 16)
            };
          }

          function luma(r, g, b) {
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          }

          const img = await loadImage(source);
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = image.data;
          const totalPixels = canvas.width * canvas.height;
          let visibleAlphaPixels = 0;
          let borderVisibleAlphaPixels = 0;
          let highSaturationGreenOrMagentaPixels = 0;
          let hardAlphaJumpPixels = 0;
          const composite = {};

          for (const background of backgrounds) {
            composite[background.id] = {
              minLuma: 255,
              maxLuma: 0,
              averageLuma: 0
            };
          }

          for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width; x += 1) {
              const offset = (y * canvas.width + x) * 4;
              const r = data[offset];
              const g = data[offset + 1];
              const b = data[offset + 2];
              const a = data[offset + 3];
              const visible = a > 16;
              if (visible) {
                visibleAlphaPixels += 1;
                if (
                  x < thresholds.borderSampleWidthPx ||
                  y < thresholds.borderSampleWidthPx ||
                  x >= canvas.width - thresholds.borderSampleWidthPx ||
                  y >= canvas.height - thresholds.borderSampleWidthPx
                ) {
                  borderVisibleAlphaPixels += 1;
                }
                const greenEdge = g > 140 && g > r * 1.35 && g > b * 1.15;
                const magentaEdge = r > 130 && b > 115 && Math.abs(r - b) < 90 && g < Math.min(r, b) * 0.65;
                if (greenEdge || magentaEdge) highSaturationGreenOrMagentaPixels += 1;
              }

              if (x + 1 < canvas.width) {
                const rightAlpha = data[offset + 7];
                if (Math.abs(a - rightAlpha) >= thresholds.hardAlphaJumpThreshold) hardAlphaJumpPixels += 1;
              }
              if (y + 1 < canvas.height) {
                const downAlpha = data[offset + canvas.width * 4 + 3];
                if (Math.abs(a - downAlpha) >= thresholds.hardAlphaJumpThreshold) hardAlphaJumpPixels += 1;
              }

              for (const background of backgrounds) {
                const bg = parseHexColor(background.color);
                const alpha = a / 255;
                const cr = r * alpha + bg.r * (1 - alpha);
                const cg = g * alpha + bg.g * (1 - alpha);
                const cb = b * alpha + bg.b * (1 - alpha);
                const lum = luma(cr, cg, cb);
                const summary = composite[background.id];
                summary.minLuma = Math.min(summary.minLuma, Math.round(lum));
                summary.maxLuma = Math.max(summary.maxLuma, Math.round(lum));
                summary.averageLuma += lum;
              }
            }
          }

          for (const background of backgrounds) {
            composite[background.id].averageLuma = Number((composite[background.id].averageLuma / totalPixels).toFixed(2));
          }

          return {
            width: canvas.width,
            height: canvas.height,
            visibleAlphaPixels,
            visibleAlphaRatio: Number((visibleAlphaPixels / totalPixels).toFixed(4)),
            borderVisibleAlphaPixels,
            highSaturationGreenOrMagentaPixels,
            hardAlphaJumpPixels,
            composite
          };
        },
        { dataUrl, thresholds: pixelThresholds, backgrounds: compositeBackgrounds }
      );
    }
  } finally {
    await browser.close();
  }

  return {
    enabled: true,
    browserExecutable: browserPath,
    assets: results
  };
}

function findSidecarMetrics(asset) {
  if (asset.phase === "S73.4") {
    const sidecarPath = path.join(rootDir, "public", "assets", "ui", "home", "home-transparency-qa-v1.json");
    if (!fs.existsSync(sidecarPath)) return null;
    const sidecar = readJson(sidecarPath);
    const entry = sidecar.assets.find((candidate) => candidate.id === asset.id);
    if (!entry) return null;
    return {
      source: "home-transparency-qa-v1",
      path: toProjectPath(sidecarPath),
      sha256: entry.sha256,
      metrics: entry.metrics
    };
  }

  if (asset.phase === "S73.8" && asset.performance && typeof asset.performance.visibleAlphaRatio === "number") {
    return {
      source: "manifest-performance-alpha",
      metrics: {
        visibleAlphaRatio: asset.performance.visibleAlphaRatio,
        borderVisibleAlphaPixels: asset.performance.borderVisibleAlphaPixels
      }
    };
  }

  return null;
}

function buildAssetRecord(asset, manifest, pixelAnalysis, issues) {
  const assetIssues = [];
  collectForbiddenValueIssues(asset, `assets.${asset.id}`, assetIssues);
  assertSafeUiAssetPath(asset.path, `${asset.id}.path`, assetIssues);
  assertSafeUiAssetPath(asset.thumbnailPath, `${asset.id}.thumbnailPath`, assetIssues);
  assertSafeUiAssetPath(asset.lowResPlaceholderPath, `${asset.id}.lowResPlaceholderPath`, assetIssues);

  const filePath = resolveUiAssetPath(asset.path);
  const thumbnailPath = resolveUiAssetPath(asset.thumbnailPath);
  const fallbackIds = new Set((manifest.fallbackCatalog || []).map((fallback) => fallback.id));
  const runtimeUsable = (manifest.runtimeUsableReviewStatuses || []).includes(asset.reviewStatus);

  const files = {
    image: {
      path: asset.path,
      exists: fs.existsSync(filePath)
    },
    thumbnail: {
      path: asset.thumbnailPath,
      exists: asset.thumbnailPath ? fs.existsSync(thumbnailPath) : false
    }
  };

  let imageInfo = null;
  if (files.image.exists) {
    files.image.bytes = fs.statSync(filePath).size;
    files.image.sha256 = sha256File(filePath);
    imageInfo = readImageInfo(filePath);
    files.image.dimensions = { width: imageInfo.width, height: imageInfo.height };
    files.image.alpha = imageInfo.alpha;
  } else {
    assetIssues.push(errorIssue(asset.id, "素材文件不存在"));
  }

  if (files.thumbnail.exists) {
    files.thumbnail.bytes = fs.statSync(thumbnailPath).size;
    files.thumbnail.sha256 = sha256File(thumbnailPath);
    files.thumbnail.dimensions = readImageInfo(thumbnailPath);
  } else {
    assetIssues.push(errorIssue(asset.id, "缩略图文件不存在"));
  }

  if (imageInfo) {
    if (imageInfo.width !== asset.dimensions.width || imageInfo.height !== asset.dimensions.height) {
      assetIssues.push(errorIssue(asset.id, "manifest 尺寸与图片实际尺寸不一致"));
    }
    if (imageInfo.alpha !== asset.transparent) {
      assetIssues.push(errorIssue(asset.id, "manifest transparent 与图片 alpha 不一致"));
    }
  }

  if (!runtimeUsable) assetIssues.push(errorIssue(asset.id, "active assets 必须是 runtime 可用审核状态"));
  if (asset.category !== "fallback" && !fallbackIds.has(asset.fallbackRef)) {
    assetIssues.push(errorIssue(asset.id, "fallbackRef 未指向 fallbackCatalog"));
  }
  if (files.image.bytes && asset.performance?.bytes !== files.image.bytes) {
    assetIssues.push(errorIssue(asset.id, "performance.bytes 与文件大小不一致"));
  }
  if (files.thumbnail.bytes && asset.performance?.thumbnailBytes !== files.thumbnail.bytes) {
    assetIssues.push(errorIssue(asset.id, "performance.thumbnailBytes 与文件大小不一致"));
  }
  if (files.image.bytes && asset.performance?.targetMaxBytes && files.image.bytes > asset.performance.targetMaxBytes) {
    assetIssues.push(errorIssue(asset.id, "素材超过 targetMaxBytes"));
  }
  if (
    files.thumbnail.bytes &&
    asset.performance?.thumbnailTargetMaxBytes &&
    files.thumbnail.bytes > asset.performance.thumbnailTargetMaxBytes
  ) {
    assetIssues.push(errorIssue(asset.id, "缩略图超过 thumbnailTargetMaxBytes"));
  }

  const transparentQa = {
    required: Boolean(asset.transparent),
    backgrounds: asset.transparent ? compositeBackgrounds : [],
    sidecar: asset.transparent ? findSidecarMetrics(asset) : null,
    pixel: asset.transparent ? pixelAnalysis.assets[asset.id] || null : null
  };

  if (asset.transparent && !transparentQa.pixel) {
    assetIssues.push(errorIssue(asset.id, "透明素材缺少 S73.9 pixel QA 指标"));
  }

  if (transparentQa.pixel) {
    const pixel = transparentQa.pixel;
    if (pixel.highSaturationGreenOrMagentaPixels > pixelThresholds.maxHighSaturationGreenOrMagentaPixels) {
      assetIssues.push(warningIssue(asset.id, "透明素材存在较多高饱和绿/紫像素，需人工查看预览"));
    }
    if (pixel.borderVisibleAlphaPixels > pixelThresholds.maxBorderVisibleAlphaPixels) {
      assetIssues.push(warningIssue(asset.id, "透明素材边界可见 alpha 较多，需检查是否为矩形切口或合法边缘"));
    }
  }

  if (asset.category === "portrait") {
    const placeholderPath = resolveUiAssetPath(asset.lowResPlaceholderPath);
    files.lowResPlaceholder = {
      path: asset.lowResPlaceholderPath,
      exists: fs.existsSync(placeholderPath)
    };
    if (!files.lowResPlaceholder.exists) {
      assetIssues.push(errorIssue(asset.id, "立绘缺少低清占位"));
    } else {
      files.lowResPlaceholder.bytes = fs.statSync(placeholderPath).size;
      files.lowResPlaceholder.sha256 = sha256File(placeholderPath);
      files.lowResPlaceholder.dimensions = readImageInfo(placeholderPath);
      if (asset.performance?.lowResPlaceholderBytes !== files.lowResPlaceholder.bytes) {
        assetIssues.push(errorIssue(asset.id, "低清占位大小与 performance 不一致"));
      }
    }
    if (asset.lazyLoad?.allowEagerLoad !== false) {
      assetIssues.push(errorIssue(asset.id, "立绘不得允许 eager load"));
    }
    if (!asset.portraitRef || asset.portraitRef !== asset.id) {
      assetIssues.push(errorIssue(asset.id, "立绘必须以 id 作为 portraitRef"));
    }
  }

  issues.push(...assetIssues);
  return {
    id: asset.id,
    phase: asset.phase,
    category: asset.category,
    subcategory: asset.subcategory,
    usage: asset.usage,
    path: asset.path,
    thumbnailPath: asset.thumbnailPath,
    fallbackRef: asset.fallbackRef,
    reviewStatus: asset.reviewStatus,
    runtimeUsable,
    dimensions: asset.dimensions,
    transparent: asset.transparent,
    files,
    transparentQa,
    issues: assetIssues
  };
}

async function buildReport(options) {
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  const issues = [];
  collectForbiddenValueIssues(manifest.assets, "manifest.assets", issues);

  const assets = manifest.assets || [];
  const pixelAnalysis = options.pixel
    ? await analyzeTransparentPixels(assets, options)
    : { enabled: false, reason: "run with --pixel to refresh transparent pixel metrics", assets: {} };

  const assetReports = assets.map((asset) => buildAssetRecord(asset, manifest, pixelAnalysis, issues));
  const summary = assetReports.reduce(
    (acc, asset) => {
      acc.totalAssets += 1;
      acc.transparentAssets += asset.transparent ? 1 : 0;
      acc.byPhase[asset.phase] = (acc.byPhase[asset.phase] || 0) + 1;
      acc.byCategory[asset.category] = (acc.byCategory[asset.category] || 0) + 1;
      acc.byReviewStatus[asset.reviewStatus] = (acc.byReviewStatus[asset.reviewStatus] || 0) + 1;
      return acc;
    },
    { totalAssets: 0, transparentAssets: 0, byPhase: {}, byCategory: {}, byReviewStatus: {} }
  );

  summary.errorCount = issues.filter((issue) => issue.severity === "error").length;
  summary.warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    schemaVersion: 1,
    phase: "S73.9",
    generatedAt: new Date().toISOString(),
    manifestRef: toProjectPath(manifestPath),
    manifestSha256: sha256Text(manifestText),
    previewRef: toProjectPath(previewPath),
    compositeBackgrounds,
    thresholds: pixelThresholds,
    pixelAnalysis: {
      enabled: pixelAnalysis.enabled,
      browserExecutable: pixelAnalysis.browserExecutable ? path.basename(pixelAnalysis.browserExecutable) : null,
      reason: pixelAnalysis.reason || null
    },
    summary,
    assets: assetReports,
    issues
  };
}

function validateCommittedReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Missing QA report: ${toProjectPath(reportPath)}`);
  }
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  const report = readJson(reportPath);

  const failures = [];
  if (report.schemaVersion !== 1) failures.push("schemaVersion must be 1");
  if (report.phase !== "S73.9") failures.push("phase must be S73.9");
  if (report.manifestSha256 !== sha256Text(manifestText)) failures.push("manifestSha256 is stale");
  if (!fs.existsSync(previewPath)) failures.push("asset QA preview page is missing");

  const manifestAssets = manifest.assets || [];
  const assetsById = new Map((report.assets || []).map((asset) => [asset.id, asset]));
  if ((report.assets || []).length !== manifestAssets.length) {
    failures.push("report.assets length does not match manifest assets length");
  }
  for (const entry of report.assets || []) {
    if (!manifestAssets.some((asset) => asset.id === entry.id)) {
      failures.push(`QA report has stale asset ${entry.id}`);
    }
  }

  for (const asset of manifestAssets) {
    const entry = assetsById.get(asset.id);
    if (!entry) {
      failures.push(`QA report missing asset ${asset.id}`);
      continue;
    }
    if (entry.reviewStatus !== asset.reviewStatus) failures.push(`${asset.id} reviewStatus is stale`);
    if (entry.path !== asset.path) failures.push(`${asset.id} path is stale`);
    if (entry.thumbnailPath !== asset.thumbnailPath) failures.push(`${asset.id} thumbnailPath is stale`);
    if (asset.transparent && !entry.transparentQa?.pixel) {
      failures.push(`${asset.id} missing transparent pixel QA`);
    }
    if (entry.files?.image?.exists !== true) failures.push(`${asset.id} image file missing in QA report`);
    if (entry.files?.image?.sha256 && entry.files.image.sha256 !== sha256File(resolveUiAssetPath(asset.path))) {
      failures.push(`${asset.id} image sha256 is stale`);
    }
    if (entry.files?.image?.bytes !== fs.statSync(resolveUiAssetPath(asset.path)).size) {
      failures.push(`${asset.id} image bytes are stale`);
    }
    if (asset.thumbnailPath) {
      const thumbnailPath = resolveUiAssetPath(asset.thumbnailPath);
      if (entry.files?.thumbnail?.exists !== true) failures.push(`${asset.id} thumbnail file missing in QA report`);
      if (entry.files?.thumbnail?.sha256 !== sha256File(thumbnailPath)) {
        failures.push(`${asset.id} thumbnail sha256 is stale`);
      }
      if (entry.files?.thumbnail?.bytes !== fs.statSync(thumbnailPath).size) {
        failures.push(`${asset.id} thumbnail bytes are stale`);
      }
    }
    if (asset.category === "portrait" && asset.lowResPlaceholderPath) {
      const placeholderPath = resolveUiAssetPath(asset.lowResPlaceholderPath);
      if (entry.files?.lowResPlaceholder?.exists !== true) {
        failures.push(`${asset.id} low-res placeholder file missing in QA report`);
      }
      if (entry.files?.lowResPlaceholder?.sha256 !== sha256File(placeholderPath)) {
        failures.push(`${asset.id} low-res placeholder sha256 is stale`);
      }
      if (entry.files?.lowResPlaceholder?.bytes !== fs.statSync(placeholderPath).size) {
        failures.push(`${asset.id} low-res placeholder bytes are stale`);
      }
    }
  }

  if (report.summary?.totalAssets !== manifestAssets.length) failures.push("summary.totalAssets is stale");
  const reportErrors = (report.issues || []).filter((issue) => issue.severity === "error");
  if (reportErrors.length > 0) {
    failures.push(`QA report contains ${reportErrors.length} blocking error(s)`);
  }

  if (failures.length > 0) {
    throw new Error(`Frontend asset QA failed:\n- ${failures.join("\n- ")}`);
  }

  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.write) {
    const report = await buildReport(options);
    fs.writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `Wrote ${toProjectPath(options.reportPath)} (${report.summary.totalAssets} assets, ${report.summary.transparentAssets} transparent, ${report.summary.errorCount} errors, ${report.summary.warningCount} warnings)`
    );
    if (report.summary.errorCount > 0) process.exitCode = 1;
  }

  if (options.check) {
    const report = validateCommittedReport(options.reportPath);
    console.log(
      `S73.9 frontend asset QA ok: ${report.summary.totalAssets} assets, ${report.summary.transparentAssets} transparent assets, ${report.summary.warningCount} visual warning(s).`
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  buildReport,
  validateCommittedReport,
  readWebpInfo
};
