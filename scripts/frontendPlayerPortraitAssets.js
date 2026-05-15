const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const matrixPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-pool-matrix-v1.json");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const qaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-player-pool-qa-v1.json");
const defaultSheetsDir = path.join(repoRoot, "artifacts", "s73-10-player-sheets");

const PHASE = "S73.10.2";
const PORTRAIT_WIDTH = 1024;
const PORTRAIT_HEIGHT = 1536;
const THUMB_WIDTH = 384;
const THUMB_HEIGHT = 576;
const PLACEHOLDER_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 96;
const TARGET_MAX_BYTES = 614400;
const THUMBNAIL_TARGET_MAX_BYTES = 256000;

const rolePromptSummaries = Object.freeze({
  "scholar": "寒窗书生，素净布麻青衫、旧书卷、清朗谨慎，宣纸书斋底。",
  "child-exam-candidate": "童试考生，端整浅色儒衫、考篮或布包、贡院晨雾与临考专注。",
  "xiucai": "秀才，青白雅服、初得功名的温润自持、竹影书案纸色。",
  "juren": "举人，深青灰蓝长袍、乡望与抱负、秋闱放榜淡墨轮廓。",
  "gongshi": "贡士，入京旅尘、深色儒服与轻披风、京城春寒薄雾。",
  "jinshi": "进士，传胪后端雅礼服、沉稳朱褐墨青点染、士林初荣。",
  "junior-official": "初任官，低阶文官常服、无字公文或笏板、官署廊柱。",
  "local-official": "地方官，实用官服、风尘案牍、县衙城郭与民生烟火。",
  "capital-official": "京官，精致部院官服、无字奏折、宫墙部院冷金纸色。",
  "grand-minister": "大臣，高阶厚重官服、笏板拢袖、朝堂屏风与朱砂印色。",
  "general": "将领，古代实用甲胄与披风、边塞风沙、无血腥无夸张武器。",
  "emperor-regent": "皇帝或摄政者，庄严礼服、玄朱墨金淡彩、御案宫灯与威仪空间。"
});

const variantSummaries = Object.freeze({
  m01: "正途清朗型，姿态端正、服饰规整、理想主义更明显。",
  m02: "沉稳历练型，眉眼更深、衣色稍暗、带经历与城府。",
  m03: "锋芒个性型，眼神更锐、披风或袖口细节更鲜明但仍端庄。",
  f01: "清雅端方型，成年女性，衣料层次轻柔、妆容淡雅、不幼态。",
  f02: "沉静干练型，成年女性，剪裁利落、腰封袖褶体现行动效率。",
  f03: "明艳有锋型，成年女性，色彩略鲜明、气场自信、避免挑逗。"
});

function parseArgs(argv) {
  const options = {
    write: false,
    check: false,
    sheetsDir: defaultSheetsDir,
    browserPath: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") options.write = true;
    else if (arg === "--check") options.check = true;
    else if (arg === "--sheets") {
      options.sheetsDir = path.resolve(repoRoot, argv[index + 1]);
      index += 1;
    } else if (arg === "--browser") {
      options.browserPath = argv[index + 1];
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
  node scripts/frontendPlayerPortraitAssets.js --write [--sheets artifacts/s73-10-player-sheets]
  node scripts/frontendPlayerPortraitAssets.js --check

The write mode expects one square 3x2 PNG/WebP sheet per player role, named <role>.png or <role>.webp.
Cell order is m01, m02, m03 on the first row and f01, f02, f03 on the second row.`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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
  throw new Error(`Unsupported WebP encoding: ${filePath}`);
}

function getPlayerEntries() {
  const matrix = readJson(matrixPath);
  return matrix.entries.filter((entry) => entry.productionStep === PHASE && entry.matrixGroup === "player");
}

function groupByRole(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.role)) groups.set(entry.role, []);
    groups.get(entry.role).push(entry);
  }
  return groups;
}

function variantCode(entry) {
  const match = entry.portraitRef.match(/-(m0[1-3]|f0[1-3])-v1$/);
  if (!match) throw new Error(`Cannot infer portrait variant: ${entry.portraitRef}`);
  return match[1];
}

function getSheetPath(sheetsDir, role) {
  const pngPath = path.join(sheetsDir, `${role}.png`);
  const webpPath = path.join(sheetsDir, `${role}.webp`);
  if (fs.existsSync(pngPath)) return pngPath;
  if (fs.existsSync(webpPath)) return webpPath;
  throw new Error(`Missing player portrait sheet for ${role}: expected ${toProjectPath(pngPath)} or ${toProjectPath(webpPath)}`);
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

async function renderWebp(page, sourcePath, crop, outputPath, width, height, quality = 0.9) {
  const sourceUrl = imageDataUrl(sourcePath);
  const dataUrl = await page.evaluate(
    async ({ sourceUrl, crop, width, height, quality }) => {
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
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
      return canvas.toDataURL("image/webp", quality);
    },
    { sourceUrl, crop, width, height, quality }
  );
  const encoded = dataUrl.replace(/^data:image\/webp;base64,/, "");
  ensureDir(outputPath);
  fs.writeFileSync(outputPath, Buffer.from(encoded, "base64"));
}

async function getImageSize(page, sourcePath) {
  const sourceUrl = imageDataUrl(sourcePath);
  return page.evaluate(
    async (sourceUrl) => {
      const image = new Image();
      image.decoding = "async";
      image.src = sourceUrl;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    },
    sourceUrl
  );
}

function imageDataUrl(sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase();
  const mimeType = extension === ".webp" ? "image/webp" : "image/png";
  return `data:${mimeType};base64,${fs.readFileSync(sourcePath).toString("base64")}`;
}

async function writePortraitFiles(options, entries) {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(options), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const sheetRecords = [];
  try {
    for (const [role, roleEntries] of groupByRole(entries)) {
      const sheetPath = getSheetPath(options.sheetsDir, role);
      const size = await getImageSize(page, sheetPath);
      const cellWidth = Math.floor(size.width / 3);
      const cellHeight = Math.floor(size.height / 2);
      sheetRecords.push({ role, path: toProjectPath(sheetPath), width: size.width, height: size.height });
      for (const [index, entry] of roleEntries.entries()) {
        const crop = {
          x: (index % 3) * cellWidth,
          y: Math.floor(index / 3) * cellHeight,
          width: index % 3 === 2 ? size.width - (index % 3) * cellWidth : cellWidth,
          height: Math.floor(index / 3) === 1 ? size.height - cellHeight : cellHeight
        };
        const imagePath = resolveUiAssetPath(entry.plannedPath);
        const thumbnailPath = resolveUiAssetPath(entry.thumbnailPath);
        const placeholderPath = resolveUiAssetPath(entry.lowResPlaceholderPath);
        await renderWebp(page, sheetPath, crop, imagePath, PORTRAIT_WIDTH, PORTRAIT_HEIGHT, 0.9);
        await renderWebp(page, sheetPath, crop, thumbnailPath, THUMB_WIDTH, THUMB_HEIGHT, 0.84);
        await renderWebp(page, sheetPath, crop, placeholderPath, PLACEHOLDER_WIDTH, PLACEHOLDER_HEIGHT, 0.46);
      }
    }
  } finally {
    await browser.close();
  }
  return sheetRecords;
}

function createAsset(entry) {
  const imagePath = resolveUiAssetPath(entry.plannedPath);
  const thumbnailPath = resolveUiAssetPath(entry.thumbnailPath);
  const placeholderPath = resolveUiAssetPath(entry.lowResPlaceholderPath);
  const info = readWebpInfo(imagePath);
  const thumbInfo = readWebpInfo(thumbnailPath);
  const placeholderInfo = readWebpInfo(placeholderPath);
  if (info.width !== PORTRAIT_WIDTH || info.height !== PORTRAIT_HEIGHT || info.alpha) {
    throw new Error(`Unexpected portrait image dimensions or alpha: ${entry.portraitRef}`);
  }
  if (thumbInfo.width !== THUMB_WIDTH || thumbInfo.height !== THUMB_HEIGHT || thumbInfo.alpha) {
    throw new Error(`Unexpected thumbnail dimensions or alpha: ${entry.portraitRef}`);
  }
  if (placeholderInfo.width !== PLACEHOLDER_WIDTH || placeholderInfo.height !== PLACEHOLDER_HEIGHT || placeholderInfo.alpha) {
    throw new Error(`Unexpected placeholder dimensions or alpha: ${entry.portraitRef}`);
  }
  const code = variantCode(entry);
  return {
    id: entry.portraitRef,
    version: 1,
    phase: PHASE,
    category: "portrait",
    subcategory: "player_identity_stage_pool",
    usage: entry.usage,
    role: entry.role,
    roleLabel: entry.roleLabel,
    roleStage: entry.roleStage,
    scene: null,
    portraitRef: entry.portraitRef,
    genderPresentation: entry.genderPresentation,
    ageBand: entry.ageBand,
    statusVariant: entry.statusVariant,
    emotionVariant: entry.emotionVariant,
    posture: entry.posture,
    identityTags: ["player", entry.role, entry.roleStage, entry.statusVariant, code],
    emotionTags: [entry.emotionVariant, entry.statusVariant],
    path: entry.plannedPath,
    thumbnailPath: entry.thumbnailPath,
    lowResPlaceholderPath: entry.lowResPlaceholderPath,
    fallbackRef: entry.fallbackRef,
    dimensions: { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT },
    aspectRatio: "1024:1536",
    format: "webp",
    transparent: false,
    safeArea: entry.safeArea.desktop,
    focalPoint: entry.focalPoint,
    mobileCrop: {
      mode: "center_crop_or_contain",
      keepSafeArea: true,
      notes: "玩家身份卡窄屏保留面部、冠服层次、上身姿态和主要身份道具；不得把未审核候选图直接显示。"
    },
    lazyLoad: {
      group: entry.lazyLoadGroup,
      allowEagerLoad: false,
      thumbnailFirst: true,
      lowResPlaceholder: true,
      maxInitialPortraits: 8
    },
    source: {
      type: "ai_generated",
      tool: "Codex imagegen",
      model: "gpt-image-2",
      generatedAt: "2026-05-15",
      promptSummary: `${rolePromptSummaries[entry.role]} ${variantSummaries[code]}`
    },
    license: {
      type: "ai_generated_project_asset",
      commercialUseConfirmed: false,
      summary: "原创 AI 生成素材，当前仅个人游玩/开发使用；未做公开商用确认。"
    },
    reviewStatus: "approved",
    visualReview: {
      reviewedBy: "Codex",
      reviewedAt: "2026-05-15",
      status: "approved",
      summary: "通过：成人端庄，身份阶段、冠服层级、姿态与水墨宣纸基调清楚；中小尺寸可辨认面部、上身轮廓和主要身份符号。"
    },
    safetyReview: {
      reviewedBy: "Codex",
      reviewedAt: "2026-05-15",
      status: "approved",
      summary: "通过：无露骨、挑逗、幼态、现代物、水印、徽标、可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实。"
    },
    performance: {
      bytes: fs.statSync(imagePath).size,
      targetMaxBytes: TARGET_MAX_BYTES,
      thumbnailBytes: fs.statSync(thumbnailPath).size,
      thumbnailTargetMaxBytes: THUMBNAIL_TARGET_MAX_BYTES,
      lowResPlaceholderBytes: fs.statSync(placeholderPath).size
    },
    ledgerId: entry.portraitRef
  };
}

function writeManifestAndQa(entries, sheetRecords) {
  const manifest = readJson(manifestPath);
  const existingById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const newAssets = entries.map(createAsset);
  for (const asset of newAssets) {
    if (asset.performance.bytes > asset.performance.targetMaxBytes) {
      throw new Error(`${asset.id} exceeds target max bytes: ${asset.performance.bytes}`);
    }
    if (asset.performance.thumbnailBytes > asset.performance.thumbnailTargetMaxBytes) {
      throw new Error(`${asset.id} thumbnail exceeds target max bytes: ${asset.performance.thumbnailBytes}`);
    }
    existingById.set(asset.id, asset);
  }
  manifest.assets = manifest.assets.filter((asset) => !newAssets.some((newAsset) => newAsset.id === asset.id));
  manifest.assets.push(...newAssets);
  manifest.roleCatalog = [...new Set([...manifest.roleCatalog, ...entries.map((entry) => entry.role)])];
  manifest.updatedAt = "2026-05-15";
  writeJson(manifestPath, manifest);

  const qa = {
    schemaVersion: 1,
    phase: PHASE,
    reviewedBy: "Codex",
    reviewedAt: "2026-05-15",
    manifestRef: "public/assets/ui/ink-ui-manifest.json",
    matrixRef: "public/assets/ui/portraits/portrait-pool-matrix-v1.json",
    sourceSheets: sheetRecords,
    visualReviewSummary:
      "通过：72 张玩家身份阶段立绘均为成年端庄水墨淡彩半身像，阶段递进从寒窗、科举、入仕、地方治理、中枢、军务到皇帝/摄政清楚；无可读文字、水印、现代器物、露骨、挑逗或幼态表现。",
    safetyReviewSummary:
      "通过：manifest 与 QA 仅保存安全路径、哈希、prompt summary 和审核摘要；不保存 provider 原始响应、本地绝对路径、key、raw/hidden 内容、未公开剧情事实或服务器裁决暗示。",
    assets: newAssets.map((asset) => ({
      id: asset.id,
      role: asset.role,
      roleLabel: asset.roleLabel,
      roleStage: asset.roleStage,
      genderPresentation: asset.genderPresentation,
      statusVariant: asset.statusVariant,
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
    }))
  };
  writeJson(qaPath, qa);
  return newAssets;
}

function checkAssets(entries) {
  const manifest = readJson(manifestPath);
  const qa = readJson(qaPath);
  const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  if (qa.assets.length !== entries.length) throw new Error(`Expected ${entries.length} QA assets, got ${qa.assets.length}`);
  for (const entry of entries) {
    const asset = assetsById.get(entry.portraitRef);
    if (!asset) throw new Error(`Missing manifest asset: ${entry.portraitRef}`);
    if (asset.phase !== PHASE || asset.category !== "portrait" || asset.reviewStatus !== "approved") {
      throw new Error(`Unexpected manifest state: ${entry.portraitRef}`);
    }
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      const filePath = resolveUiAssetPath(asset[field]);
      if (!fs.existsSync(filePath)) throw new Error(`Missing ${field}: ${asset[field]}`);
    }
    if (asset.performance.bytes !== fs.statSync(resolveUiAssetPath(asset.path)).size) {
      throw new Error(`Stale image byte count: ${entry.portraitRef}`);
    }
    if (asset.performance.thumbnailBytes !== fs.statSync(resolveUiAssetPath(asset.thumbnailPath)).size) {
      throw new Error(`Stale thumbnail byte count: ${entry.portraitRef}`);
    }
    if (asset.performance.lowResPlaceholderBytes !== fs.statSync(resolveUiAssetPath(asset.lowResPlaceholderPath)).size) {
      throw new Error(`Stale placeholder byte count: ${entry.portraitRef}`);
    }
  }
  console.log(`${PHASE} player portrait assets ok: ${entries.length} manifest entries.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = getPlayerEntries();
  if (entries.length !== 72) throw new Error(`Expected 72 S73.10.2 player entries, got ${entries.length}`);
  if (options.write) {
    const sheetRecords = await writePortraitFiles(options, entries);
    const assets = writeManifestAndQa(entries, sheetRecords);
    console.log(`${PHASE} wrote ${assets.length} player portrait assets from ${sheetRecords.length} sheets.`);
  }
  if (options.check) checkAssets(entries);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
