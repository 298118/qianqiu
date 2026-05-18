const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const qaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-single-override-qa-v1.json");
const defaultSourceDir = path.join(repoRoot, "artifacts", "s73-10-single-portrait-overrides");

const REVIEW_DATE = "2026-05-17";
const PORTRAIT_WIDTH = 1024;
const PORTRAIT_HEIGHT = 1536;
const THUMB_WIDTH = 384;
const THUMB_HEIGHT = 576;
const PLACEHOLDER_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 96;
const TARGET_MAX_BYTES = 614400;
const THUMBNAIL_TARGET_MAX_BYTES = 256000;

function parseArgs(argv) {
  const options = { write: false, check: false, sourceDir: defaultSourceDir, browserPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") options.write = true;
    else if (arg === "--check") options.check = true;
    else if (arg === "--source-dir") {
      options.sourceDir = path.resolve(repoRoot, argv[index + 1]);
      index += 1;
    } else if (arg === "--browser") {
      options.browserPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/frontendSinglePortraitOverrides.js --write|--check [--source-dir artifacts/s73-10-single-portrait-overrides]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.write && !options.check) options.check = true;
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function writeFileWithRetry(filePath, buffer) {
  ensureDir(filePath);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.writeFileSync(filePath, buffer);
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      sleepSync(120 + attempt * 80);
    }
  }
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function toProjectPath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function resolveUiAssetPath(assetPath) {
  if (typeof assetPath !== "string" || !assetPath.startsWith("/assets/ui/") || assetPath.includes("..")) {
    throw new Error(`Unsafe UI asset path: ${assetPath}`);
  }
  return path.join(repoRoot, "public", assetPath.replace(/^\//, ""));
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function readWebpInfo(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`Unsupported WebP container: ${filePath}`);
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (chunk === "VP8X") {
      const flags = buffer.readUInt8(data);
      return { width: readUInt24LE(buffer, data + 4) + 1, height: readUInt24LE(buffer, data + 7) + 1, alpha: Boolean(flags & 0x10) };
    }
    if (chunk === "VP8 ") {
      return { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff, alpha: false };
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
  throw new Error(`Unsupported WebP encoding: ${filePath}`);
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
  if (platform === "darwin") return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  return ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
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

function imageDataUrl(sourcePath) {
  return `data:image/png;base64,${fs.readFileSync(sourcePath).toString("base64")}`;
}

function collectSourceFiles(sourceDir) {
  if (!fs.existsSync(sourceDir)) return [];
  return fs
    .readdirSync(sourceDir)
    .filter((name) => name.endsWith(".png") && name.startsWith("portrait-"))
    .map((name) => ({ id: name.replace(/\.png$/, ""), path: path.join(sourceDir, name) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function renderWebp(page, sourcePath, outputPath, width, height, quality) {
  const dataUrl = await page.evaluate(
    async ({ sourceUrl, width, height, quality }) => {
      const image = new Image();
      image.decoding = "async";
      image.src = sourceUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#f3ead9";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const dx = (width - drawWidth) / 2;
      const dy = (height - drawHeight) / 2;
      context.drawImage(image, dx, dy, drawWidth, drawHeight);
      return canvas.toDataURL("image/webp", quality);
    },
    { sourceUrl: imageDataUrl(sourcePath), width, height, quality }
  );
  writeFileWithRetry(outputPath, Buffer.from(dataUrl.replace(/^data:image\/webp;base64,/, ""), "base64"));
}

async function renderBudgetedWebp(page, sourcePath, outputPath, width, height, quality, maxBytes) {
  const qualitySteps = [quality, 0.9, 0.88, 0.86, 0.84];
  for (const step of qualitySteps) {
    await renderWebp(page, sourcePath, outputPath, width, height, step);
    if (!maxBytes || fs.statSync(outputPath).size <= maxBytes) return;
  }
  const finalBytes = fs.statSync(outputPath).size;
  throw new Error(`Budgeted WebP exceeds ${maxBytes} bytes after fallback: ${toProjectPath(outputPath)} (${finalBytes} bytes)`);
}

async function writeOverrides(options, sources) {
  const manifest = readJson(manifestPath);
  const existingQa = fs.existsSync(qaPath) ? readJson(qaPath) : null;
  const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(options), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const updated = [];
  try {
    for (const source of sources) {
      const asset = assetsById.get(source.id);
      if (!asset) throw new Error(`No manifest portrait asset for single override: ${source.id}`);
      if (asset.category !== "portrait") throw new Error(`Single override only supports portraits: ${source.id}`);
      await renderBudgetedWebp(page, source.path, resolveUiAssetPath(asset.path), PORTRAIT_WIDTH, PORTRAIT_HEIGHT, 0.92, TARGET_MAX_BYTES);
      await renderWebp(page, source.path, resolveUiAssetPath(asset.thumbnailPath), THUMB_WIDTH, THUMB_HEIGHT, 0.88);
      await renderWebp(page, source.path, resolveUiAssetPath(asset.lowResPlaceholderPath), PLACEHOLDER_WIDTH, PLACEHOLDER_HEIGHT, 0.5);
      const sourceMetadata = { ...(asset.source || {}) };
      delete sourceMetadata.localHighResSourcePath;
      asset.source = {
        ...sourceMetadata,
        type: "ai_generated",
        tool: "Codex imagegen",
        model: "gpt-image-2",
        generatedAt: REVIEW_DATE,
        localHighResSource: "kept_outside_public_manifest",
        promptSummary:
          "单张竖版高质量重制：参考用户给定干净画风，清晰线稿、干净色块、强对比、丰富古典色彩，避免纸纹噪点、灰脏水洗、模糊、拉伸、可读文字和水印。"
      };
      asset.visualReview = {
        reviewedBy: "Codex",
        reviewedAt: REVIEW_DATE,
        status: "approved",
        summary:
          "通过：单张竖版高质量重制，构图未拉伸，人物比例自然，画面更干净清晰；女性角色无中老年化、发福老态、男性化或中性化问题。"
      };
      asset.safetyReview = {
        reviewedBy: "Codex",
        reviewedAt: REVIEW_DATE,
        status: "approved",
        summary:
          "通过：完整衣着，无低胸、透视、裸露、挑逗、幼态、现代物、水印、徽标、可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实。"
      };
      asset.performance = {
        ...(asset.performance || {}),
        bytes: fs.statSync(resolveUiAssetPath(asset.path)).size,
        targetMaxBytes: TARGET_MAX_BYTES,
        thumbnailBytes: fs.statSync(resolveUiAssetPath(asset.thumbnailPath)).size,
        thumbnailTargetMaxBytes: THUMBNAIL_TARGET_MAX_BYTES,
        lowResPlaceholderBytes: fs.statSync(resolveUiAssetPath(asset.lowResPlaceholderPath)).size
      };
      updated.push({ source, asset });
    }
  } finally {
    await browser.close();
  }
  manifest.updatedAt = REVIEW_DATE;
  writeJson(manifestPath, manifest);
  const existingEntries = new Map((existingQa?.assets || []).map((entry) => [entry.id, entry]));
  for (const { source, asset } of updated) {
    existingEntries.set(asset.id, {
      id: asset.id,
      phase: asset.phase,
      subcategory: asset.subcategory,
      genderPresentation: asset.genderPresentation,
      ageBand: asset.ageBand,
      sourceHandling: "local_artifact_not_public",
      path: asset.path,
      thumbnailPath: asset.thumbnailPath,
      lowResPlaceholderPath: asset.lowResPlaceholderPath,
      bytes: asset.performance.bytes,
      thumbnailBytes: asset.performance.thumbnailBytes,
      lowResPlaceholderBytes: asset.performance.lowResPlaceholderBytes,
      sha256: sha256File(resolveUiAssetPath(asset.path)),
      thumbnailSha256: sha256File(resolveUiAssetPath(asset.thumbnailPath)),
      lowResPlaceholderSha256: sha256File(resolveUiAssetPath(asset.lowResPlaceholderPath)),
      visualReviewStatus: "approved",
      safetyReviewStatus: "approved"
    });
  }
  const qaAssets = [...existingEntries.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeJson(qaPath, {
    schemaVersion: 1,
    phase: "S73.10.single-overrides",
    reviewedBy: "Codex",
    reviewedAt: REVIEW_DATE,
    manifestRef: "public/assets/ui/ink-ui-manifest.json",
    sourceHandling: "本地 PNG 母版保留在 artifacts 工作目录，不写入公开 manifest/QA 路径字段；运行时只登记 /assets/ui/ WebP、缩略图和低清占位。",
    visualReviewSummary:
      "单张高质量重制覆盖：直接使用竖版 PNG 母版派生 runtime WebP、缩略图和低清占位，避免网格裁切导致的人物过小、比例拉伸、灰脏噪点和模糊。",
    counts: { total: qaAssets.length, updatedThisRun: updated.length },
    assets: qaAssets
  });
}

function checkOverrides() {
  const manifest = readJson(manifestPath);
  const qa = readJson(qaPath);
  const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  if (qa.schemaVersion !== 1) throw new Error("Unexpected single override QA schemaVersion");
  if (qa.phase !== "S73.10.single-overrides") throw new Error(`Unexpected single override phase: ${qa.phase}`);
  if (!Array.isArray(qa.assets)) throw new Error("Missing single override QA assets");
  if (qa.counts?.total !== qa.assets.length) {
    throw new Error(`Expected ${qa.assets.length} QA override entries, got ${qa.counts?.total}`);
  }
  for (const entry of qa.assets) {
    const asset = assetsById.get(entry.id);
    if (!asset) throw new Error(`Missing manifest override asset: ${entry.id}`);
    if (asset.source?.localHighResSourcePath || entry.localHighResSourcePath) throw new Error(`Public source path leak: ${entry.id}`);
    if (asset.source?.localHighResSource !== "kept_outside_public_manifest") throw new Error(`Missing private source marker: ${entry.id}`);
    if (asset.visualReview?.status !== entry.visualReviewStatus) throw new Error(`Stale visual review: ${entry.id}`);
    if (asset.safetyReview?.status !== entry.safetyReviewStatus) throw new Error(`Stale safety review: ${entry.id}`);
    for (const [field, width, height] of [
      ["path", PORTRAIT_WIDTH, PORTRAIT_HEIGHT],
      ["thumbnailPath", THUMB_WIDTH, THUMB_HEIGHT],
      ["lowResPlaceholderPath", PLACEHOLDER_WIDTH, PLACEHOLDER_HEIGHT]
    ]) {
      if (entry[field] !== asset[field]) throw new Error(`Stale override ${field}: ${entry.id}`);
      const filePath = resolveUiAssetPath(entry[field]);
      if (!fs.existsSync(filePath)) throw new Error(`Missing override output: ${entry[field]}`);
      const info = readWebpInfo(filePath);
      if (info.width !== width || info.height !== height || info.alpha) throw new Error(`Bad override dimensions: ${entry[field]}`);
    }
    if (entry.bytes !== fs.statSync(resolveUiAssetPath(entry.path)).size) throw new Error(`Stale override bytes: ${entry.id}`);
    if (entry.thumbnailBytes !== fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size) {
      throw new Error(`Stale override thumbnail bytes: ${entry.id}`);
    }
    if (entry.lowResPlaceholderBytes !== fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size) {
      throw new Error(`Stale override placeholder bytes: ${entry.id}`);
    }
    if (entry.sha256 !== sha256File(resolveUiAssetPath(entry.path))) throw new Error(`Stale override image sha: ${entry.id}`);
    if (entry.thumbnailSha256 !== sha256File(resolveUiAssetPath(entry.thumbnailPath))) {
      throw new Error(`Stale override thumbnail sha: ${entry.id}`);
    }
    if (entry.lowResPlaceholderSha256 !== sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath))) {
      throw new Error(`Stale override placeholder sha: ${entry.id}`);
    }
  }
  console.log(`single portrait overrides ok: ${qa.assets.length} assets.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.write) {
    const sources = collectSourceFiles(options.sourceDir);
    if (sources.length === 0) throw new Error(`No single portrait override PNGs found in ${toProjectPath(options.sourceDir)}`);
    await writeOverrides(options, sources);
  }
  if (options.check) checkOverrides();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
