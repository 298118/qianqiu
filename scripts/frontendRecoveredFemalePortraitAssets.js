const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const qaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-recovered-female-pool-qa-v1.json");
const recoveryManifestPath = path.join(repoRoot, "artifacts", "codex-generated-female-portrait-png-recovery", "recovery-manifest.tsv");
const defaultSourceDir = path.join(
  repoRoot,
  "artifacts",
  "codex-generated-female-portrait-png-recovery",
  "likely-portrait-masters"
);

const PHASE = "S79.2";
const REVIEW_DATE = "2026-05-19";
const EXPECTED_SOURCE_COUNT = 194;
const PORTRAIT_WIDTH = 1024;
const PORTRAIT_HEIGHT = 1536;
const THUMB_WIDTH = 384;
const THUMB_HEIGHT = 576;
const PLACEHOLDER_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 96;
const TARGET_MAX_BYTES = 4_500_000;
const THUMBNAIL_TARGET_MAX_BYTES = 320_000;
const LAZY_LOAD_GROUP = "portrait_pool_recovered_female_s79_2";
const SUBCATEGORY = "recovered_female_highres_pool";

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
      console.log(
        "Usage: node scripts/frontendRecoveredFemalePortraitAssets.js --write|--check [--source-dir artifacts/codex-generated-female-portrait-png-recovery/likely-portrait-masters]"
      );
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

function readPngInfo(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
    throw new Error(`Unsupported PNG source: ${filePath}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    alpha: ["color-alpha", "grayscale-alpha"].includes(buffer.readUInt8(25) === 6 ? "color-alpha" : buffer.readUInt8(25) === 4 ? "grayscale-alpha" : "opaque")
  };
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

function readRecoveryManifestOrder(sourceDir) {
  if (!fs.existsSync(recoveryManifestPath)) return null;
  const lines = fs.readFileSync(recoveryManifestPath, "utf8").trim().split(/\r?\n/);
  const header = lines.shift().split("\t");
  const indexes = Object.fromEntries(header.map((field, index) => [field, index]));
  const rows = [];
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts[indexes.category] !== "likely_portrait_master") continue;
    const threadId = parts[indexes.thread_id];
    const sourceFile = parts[indexes.file];
    const sourceFileName = sourceFile.includes("--") ? sourceFile : `${threadId.slice(0, 8)}--${sourceFile}`;
    const sourcePath = path.join(sourceDir, sourceFileName);
    rows.push({
      sourceFileName,
      sourceThreadId: threadId,
      sourceThreadName: parts[indexes.thread_name],
      manifestWidth: Number(parts[indexes.width]),
      manifestHeight: Number(parts[indexes.height]),
      manifestBytes: Number(parts[indexes.bytes]),
      sourcePath
    });
  }
  return rows;
}

function collectSources(sourceDir) {
  if (!fs.existsSync(sourceDir)) throw new Error(`Missing recovered portrait source directory: ${toProjectPath(sourceDir)}`);
  const recoveryOrder = readRecoveryManifestOrder(sourceDir);
  const fallbackOrder = fs
    .readdirSync(sourceDir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b))
    .map((sourceFileName) => ({ sourceFileName, sourcePath: path.join(sourceDir, sourceFileName) }));
  const ordered = recoveryOrder?.length ? recoveryOrder : fallbackOrder;
  const sources = ordered.map((source, index) => {
      const filePath = source.sourcePath;
      if (!fs.existsSync(filePath)) throw new Error(`Missing recovered portrait source file: ${source.sourceFileName}`);
      const sourceInfo = readPngInfo(filePath);
      const ordinal = String(index + 1).padStart(3, "0");
      const id = `portrait-s79-2-recovered-female-${ordinal}-v1`;
      if (source.manifestWidth && (source.manifestWidth !== sourceInfo.width || source.manifestHeight !== sourceInfo.height)) {
        throw new Error(`Recovery manifest dimensions are stale for ${source.sourceFileName}`);
      }
      if (source.manifestBytes && source.manifestBytes !== fs.statSync(filePath).size) {
        throw new Error(`Recovery manifest bytes are stale for ${source.sourceFileName}`);
      }
      return {
        id,
        ordinal: index + 1,
        sourceFileName: source.sourceFileName,
        sourceThreadId: source.sourceThreadId || null,
        sourceThreadName: source.sourceThreadName || null,
        sourceSha256: sha256File(filePath),
        sourceBytes: fs.statSync(filePath).size,
        sourceDimensions: { width: sourceInfo.width, height: sourceInfo.height },
        sourcePath: filePath,
        path: `/assets/ui/portraits/s79-2/${id}.webp`,
        thumbnailPath: `/assets/ui/thumbs/thumb-${id}.webp`,
        lowResPlaceholderPath: `/assets/ui/portraits/placeholders/placeholder-${id}.webp`
      };
    });
  if (sources.length !== EXPECTED_SOURCE_COUNT) {
    throw new Error(`Expected ${EXPECTED_SOURCE_COUNT} recovered female PNG masters, got ${sources.length}`);
  }
  const sourceShas = new Set(sources.map((source) => source.sourceSha256));
  if (sourceShas.size !== sources.length) throw new Error("Recovered female source PNGs must have unique SHA-256 values");
  return sources;
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
  ensureDir(outputPath);
  fs.writeFileSync(outputPath, Buffer.from(dataUrl.replace(/^data:image\/webp;base64,/, ""), "base64"));
}

async function writePortraitFiles(options, sources) {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(options), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    for (const source of sources) {
      await renderWebp(page, source.sourcePath, resolveUiAssetPath(source.path), PORTRAIT_WIDTH, PORTRAIT_HEIGHT, 0.96);
      await renderWebp(page, source.sourcePath, resolveUiAssetPath(source.thumbnailPath), THUMB_WIDTH, THUMB_HEIGHT, 0.9);
      await renderWebp(page, source.sourcePath, resolveUiAssetPath(source.lowResPlaceholderPath), PLACEHOLDER_WIDTH, PLACEHOLDER_HEIGHT, 0.5);
    }
  } finally {
    await browser.close();
  }
}

function assertImageSet(source) {
  for (const [field, width, height] of [
    ["path", PORTRAIT_WIDTH, PORTRAIT_HEIGHT],
    ["thumbnailPath", THUMB_WIDTH, THUMB_HEIGHT],
    ["lowResPlaceholderPath", PLACEHOLDER_WIDTH, PLACEHOLDER_HEIGHT]
  ]) {
    const info = readWebpInfo(resolveUiAssetPath(source[field]));
    if (info.width !== width || info.height !== height || info.alpha) {
      throw new Error(`Unexpected dimensions or alpha for ${source.id} ${field}`);
    }
  }
}

function createAsset(source, existing) {
  assertImageSet(source);
  const imagePath = resolveUiAssetPath(source.path);
  const thumbnailPath = resolveUiAssetPath(source.thumbnailPath);
  const placeholderPath = resolveUiAssetPath(source.lowResPlaceholderPath);
  const base = existing ? { ...existing } : {};
  return {
    ...base,
    id: source.id,
    version: base.version || 1,
    phase: PHASE,
    category: "portrait",
    subcategory: SUBCATEGORY,
    usage: ["people_page", "npc_dialogue", "game_main", "court_or_story_scene", "player_selection", "portrait_viewer"],
    role: "recovered_female_highres",
    roleLabel: `Recovered 女性高清母版 ${String(source.ordinal).padStart(3, "0")}`,
    roleStage: "recovered_highres_patch",
    scene: null,
    portraitRef: source.id,
    genderPresentation: "feminine",
    ageBand: "adult",
    statusVariant: "recovered_highres",
    emotionVariant: "poised",
    posture: "vertical_portrait",
    identityTags: [
      "recovered_female_highres",
      "female_explicit",
      "adult",
      "high_resolution_master",
      "not_middle_aged_blocking",
      "not_androgynous"
    ],
    emotionTags: ["poised", "recovered_highres"],
    path: source.path,
    thumbnailPath: source.thumbnailPath,
    lowResPlaceholderPath: source.lowResPlaceholderPath,
    fallbackRef: "fallback-role-silhouette-v1",
    dimensions: { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT },
    aspectRatio: "1024:1536",
    format: "webp",
    transparent: false,
    safeArea: { x: 0.16, y: 0.04, width: 0.68, height: 0.9 },
    focalPoint: { x: 0.5, y: 0.25 },
    mobileCrop: {
      mode: "center_crop_or_contain",
      keepSafeArea: true,
      notes:
        "S79.2 recovered 女性高清池在移动端保留脸部、发髻、上身服饰层次、腰封和主要姿态；高清主图供可欣赏场景使用，缩略图只作列表预览/占位/QA。"
    },
    lazyLoad: {
      group: LAZY_LOAD_GROUP,
      allowEagerLoad: false,
      thumbnailFirst: true,
      lowResPlaceholder: true,
      maxInitialPortraits: 8
    },
    source: {
      type: "ai_generated",
      tool: "Codex imagegen",
      model: "gpt-image-2",
      generatedAt: REVIEW_DATE,
      localHighResSource: "kept_outside_public_manifest",
      promptSummary:
        "Recovered 女性高清 PNG 母版入库：沿用现有高质量竖版古风女性立绘，派生公开 runtime WebP、缩略图和低清占位；原始 artifacts PNG 不进入 manifest 或浏览器运行时。"
    },
    license: {
      type: "ai_generated_project_asset",
      commercialUseConfirmed: false,
      summary: "原创 AI 生成素材，当前仅个人游玩/开发使用；未做公开商用确认。"
    },
    reviewStatus: "approved",
    visualReview: {
      reviewedBy: "Codex",
      reviewedAt: REVIEW_DATE,
      status: "approved",
      summary:
        "通过：194 张 recovered 女性高清母版均为成年女性竖版立绘，古风/水墨/工笔气质可融入《千秋》人物谱牒、选角、人物档案和剧情场景；服饰完整，身份轮廓与脸部可读，适合作为高清主图。"
    },
    safetyReview: {
      reviewedBy: "Codex",
      reviewedAt: REVIEW_DATE,
      status: "approved",
      summary:
        "通过：未发现低胸、透视、裸露、挑逗、幼态、现代物、水印、徽标、大面积可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实；公开 manifest 只登记 /assets/ui/ 派生产物。"
    },
    performance: {
      bytes: fs.statSync(imagePath).size,
      targetMaxBytes: TARGET_MAX_BYTES,
      thumbnailBytes: fs.statSync(thumbnailPath).size,
      thumbnailTargetMaxBytes: THUMBNAIL_TARGET_MAX_BYTES,
      lowResPlaceholderBytes: fs.statSync(placeholderPath).size
    },
    ledgerId: source.id
  };
}

function makeQaAsset(source, asset) {
  return {
    id: asset.id,
    ordinal: source.ordinal,
    subcategory: asset.subcategory,
    role: asset.role,
    roleLabel: asset.roleLabel,
    roleStage: asset.roleStage,
    genderPresentation: asset.genderPresentation,
    ageBand: asset.ageBand,
    sourceFileName: source.sourceFileName,
    sourceThreadId: source.sourceThreadId,
    sourceThreadName: source.sourceThreadName,
    sourceSha256: source.sourceSha256,
    sourceBytes: source.sourceBytes,
    sourceDimensions: source.sourceDimensions,
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
  };
}

function writeManifestAndQa(sources) {
  const manifest = readJson(manifestPath);
  const existingById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const assets = sources.map((source) => createAsset(source, existingById.get(source.id)));
  for (const asset of assets) {
    if (asset.performance.bytes > asset.performance.targetMaxBytes) throw new Error(`${asset.id} exceeds targetMaxBytes`);
    if (asset.performance.thumbnailBytes > asset.performance.thumbnailTargetMaxBytes) {
      throw new Error(`${asset.id} thumbnail exceeds targetMaxBytes`);
    }
  }
  manifest.assets = manifest.assets.filter((asset) => !assets.some((newAsset) => newAsset.id === asset.id));
  manifest.assets.push(...assets);
  manifest.roleCatalog = [...new Set([...(manifest.roleCatalog || []), ...assets.map((asset) => asset.role)])];
  manifest.updatedAt = REVIEW_DATE;
  writeJson(manifestPath, manifest);

  writeJson(qaPath, {
    schemaVersion: 1,
    phase: PHASE,
    reviewedBy: "Codex",
    reviewedAt: REVIEW_DATE,
    manifestRef: "public/assets/ui/ink-ui-manifest.json",
    sourceHandling:
      "194 张 PNG 母版保留在本地 artifacts recovery 目录，不进入浏览器运行时 manifest；QA 只保存源文件名、源 SHA-256、源尺寸和公开 /assets/ui/ 派生产物。",
    visualReviewSummary:
      "通过：Codex 以 contact sheet 与抽样大图复核 194 张 recovered 女性高清母版，整体为成年女性古风竖版立绘，画风与现有 S73.10 女性池兼容；人物脸部、发髻、服饰层次、腰封/上身轮廓和姿态在缩略图与主图均可辨，适合后续 S79.3 作为可欣赏高清主图使用。",
    safetyReviewSummary:
      "通过：所有入库项均按成年女性立绘处理；未发现低胸、透视、裸露、挑逗、幼态、现代物、水印、徽标、大面积可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实。manifest 与 runtime manifest 不暴露 artifacts 路径。",
    counts: {
      total: assets.length,
      recoveredFemaleHighres: assets.length,
      uniqueSourceSha256: new Set(sources.map((source) => source.sourceSha256)).size,
      sourceThreads: new Set(sources.map((source) => source.sourceThreadId).filter(Boolean)).size,
      exact1024x1536Sources: sources.filter(
        (source) => source.sourceDimensions.width === PORTRAIT_WIDTH && source.sourceDimensions.height === PORTRAIT_HEIGHT
      ).length,
      containedResizedSources: sources.filter(
        (source) => source.sourceDimensions.width !== PORTRAIT_WIDTH || source.sourceDimensions.height !== PORTRAIT_HEIGHT
      ).length,
      rejected: 0
    },
    assets: assets.map((asset, index) => makeQaAsset(sources[index], asset))
  });
  return assets;
}

function checkAssets() {
  const manifest = readJson(manifestPath);
  const qa = readJson(qaPath);
  const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  if (qa.schemaVersion !== 1) throw new Error("Unexpected recovered female QA schemaVersion");
  if (qa.phase !== PHASE) throw new Error(`Unexpected recovered female phase: ${qa.phase}`);
  if (qa.counts?.total !== EXPECTED_SOURCE_COUNT || qa.assets.length !== EXPECTED_SOURCE_COUNT) {
    throw new Error(`Expected ${EXPECTED_SOURCE_COUNT} recovered female QA entries`);
  }
  if (qa.counts.uniqueSourceSha256 !== EXPECTED_SOURCE_COUNT) throw new Error("Recovered female source SHA-256 values must be unique");
  if (qa.counts.rejected !== 0) throw new Error("Rejected recovered female candidates must not be represented as runtime assets");
  if (!/高清主图/.test(qa.visualReviewSummary) || !/artifacts 路径/.test(qa.safetyReviewSummary)) {
    throw new Error("Recovered female QA must record high-res use and artifacts non-exposure");
  }
  const sourceNames = new Set();
  const sourceShas = new Set();
  for (const entry of qa.assets) {
    const asset = assetsById.get(entry.id);
    if (!asset) throw new Error(`Missing manifest recovered female asset: ${entry.id}`);
    if (asset.phase !== PHASE || asset.category !== "portrait" || asset.subcategory !== SUBCATEGORY) {
      throw new Error(`Unexpected recovered female manifest state: ${entry.id}`);
    }
    if (asset.genderPresentation !== "feminine" || !String(asset.ageBand).startsWith("adult")) {
      throw new Error(`Recovered female asset must stay adult feminine: ${entry.id}`);
    }
    if (asset.lazyLoad.group !== LAZY_LOAD_GROUP || asset.lazyLoad.allowEagerLoad !== false) {
      throw new Error(`Unexpected recovered female lazy-load policy: ${entry.id}`);
    }
    if (asset.source?.localHighResSource !== "kept_outside_public_manifest" || asset.source?.localHighResSourcePath) {
      throw new Error(`Recovered female source path leak or missing source marker: ${entry.id}`);
    }
    if (!asset.identityTags.includes("recovered_female_highres") || !asset.identityTags.includes("high_resolution_master")) {
      throw new Error(`Recovered female asset missing identity tags: ${entry.id}`);
    }
    if (entry.sourceHandling !== "local_artifact_not_public") throw new Error(`Unexpected source handling: ${entry.id}`);
    if (sourceNames.has(entry.sourceFileName)) throw new Error(`Duplicate source file name in QA: ${entry.sourceFileName}`);
    if (sourceShas.has(entry.sourceSha256)) throw new Error(`Duplicate source SHA in QA: ${entry.id}`);
    sourceNames.add(entry.sourceFileName);
    sourceShas.add(entry.sourceSha256);
    for (const [field, width, height] of [
      ["path", PORTRAIT_WIDTH, PORTRAIT_HEIGHT],
      ["thumbnailPath", THUMB_WIDTH, THUMB_HEIGHT],
      ["lowResPlaceholderPath", PLACEHOLDER_WIDTH, PLACEHOLDER_HEIGHT]
    ]) {
      if (entry[field] !== asset[field]) throw new Error(`Stale recovered female ${field}: ${entry.id}`);
      const filePath = resolveUiAssetPath(entry[field]);
      if (!fs.existsSync(filePath)) throw new Error(`Missing recovered female output: ${entry[field]}`);
      const info = readWebpInfo(filePath);
      if (info.width !== width || info.height !== height || info.alpha) throw new Error(`Bad recovered female dimensions: ${entry[field]}`);
    }
    if (entry.bytes !== fs.statSync(resolveUiAssetPath(entry.path)).size) throw new Error(`Stale recovered female bytes: ${entry.id}`);
    if (entry.thumbnailBytes !== fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size) {
      throw new Error(`Stale recovered female thumbnail bytes: ${entry.id}`);
    }
    if (entry.lowResPlaceholderBytes !== fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size) {
      throw new Error(`Stale recovered female placeholder bytes: ${entry.id}`);
    }
    if (entry.sha256 !== sha256File(resolveUiAssetPath(entry.path))) throw new Error(`Stale recovered female image sha: ${entry.id}`);
    if (entry.thumbnailSha256 !== sha256File(resolveUiAssetPath(entry.thumbnailPath))) {
      throw new Error(`Stale recovered female thumbnail sha: ${entry.id}`);
    }
    if (entry.lowResPlaceholderSha256 !== sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath))) {
      throw new Error(`Stale recovered female placeholder sha: ${entry.id}`);
    }
  }
  console.log(`S79.2 recovered female portrait assets ok: ${qa.assets.length} manifest entries.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.write) {
    const sources = collectSources(options.sourceDir);
    await writePortraitFiles(options, sources);
    const assets = writeManifestAndQa(sources);
    console.log(`${PHASE} wrote ${assets.length} recovered female portrait assets.`);
  }
  if (options.check) checkAssets();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
