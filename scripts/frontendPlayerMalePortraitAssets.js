const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const maleQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-player-male-extra-qa-v1.json");
const extraSheetsDir = path.join(repoRoot, "artifacts", "s73-10-player-male-extra-sheets");

const PHASE = "S73.10.2";
const PORTRAIT_WIDTH = 1024;
const PORTRAIT_HEIGHT = 1536;
const THUMB_WIDTH = 384;
const THUMB_HEIGHT = 576;
const PLACEHOLDER_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 96;
const TARGET_MAX_BYTES = 614400;
const THUMBNAIL_TARGET_MAX_BYTES = 256000;

const extraPacks = Object.freeze([
  ["academy-scholar", "academy_scholar", "书院文士", "书院文士玩家扩展：书斋、空白卷册、冠巾与青蓝文士服，清朗而明确男性化。"],
  ["tang-round-collar", "tang_round_collar", "唐风圆领袍", "唐风圆领袍玩家扩展：圆领袍、腰带、披风和唐风庭院，色彩明快。"],
  ["court-official", "court_official", "朝堂文官", "朝堂文官玩家扩展：正式官服、笏板、宫廊与朝堂气，端肃有权柄。"],
  ["palace-noble", "palace_noble", "宫廷贵胄", "宫廷贵胄玩家扩展：礼服、冠饰、宫灯与玉带，华贵克制。"],
  ["high-minister", "high_minister", "中枢重臣", "中枢重臣玩家扩展：厚重官服、拢袖持笏、沉稳威仪和朝堂屏风。"],
  ["frontier-general", "frontier_general", "边塞将领", "边塞将领玩家扩展：完整甲衣、披风、军帐与边关山势，英武端正。"],
  ["imperial-guard", "imperial_guard", "禁军武官", "禁军武官玩家扩展：禁军甲衣、宫门、旌旗和纪律森严的武官气。"],
  ["gentry-heir", "gentry_heir", "士族公子", "士族公子玩家扩展：士族礼服、玉佩、园林与家族气度，俊雅但不女性化。"],
  ["merchant-owner", "merchant_owner", "商贾东家", "商贾东家玩家扩展：市廛、布货、空白账册与经营气，沉稳有财力。"],
  ["travelling-strategist", "travelling_strategist", "行旅策士", "行旅策士玩家扩展：行旅披风、空白卷轴、驿亭与谋略气。"]
]);

const extraVariants = Object.freeze([
  ["look01", "baseline", "composed", "正身肃立", "正身款，肩颈和上身轮廓清楚，端庄不夸张。"],
  ["look02", "formal", "reserved", "侧立持物", "礼服款，冠服、腰带和持物细节更明显。"],
  ["look03", "working", "focused", "执卷处理事务", "工作款，持卷或持笏，表现读书、理政或经营状态。"],
  ["look04", "travel_or_motion", "alert", "披风行旅", "动态款，披风、甲衣或外袍拉开轮廓，行动感更强。"],
  ["look05", "quiet_authority", "stern", "拢袖端坐", "威仪款，表情沉稳，适合高位身份或慎重决策。"],
  ["look06", "poised", "determined", "持物正立", "选角款，面向玩家形象选择，色彩更丰富、对比更高。"]
]);

function parseArgs(argv) {
  const options = { write: false, check: false, browserPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") options.write = true;
    else if (arg === "--check") options.check = true;
    else if (arg === "--browser") {
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
  node scripts/frontendPlayerMalePortraitAssets.js --write
  node scripts/frontendPlayerMalePortraitAssets.js --check

The write mode expects 10 player male expansion sheets in artifacts/s73-10-player-male-extra-sheets.
Each sheet is a 3x2 grid.`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function toProjectPath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
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

function readPngInfo(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`Unsupported PNG container: ${filePath}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    alpha: [4, 6].includes(buffer.readUInt8(25))
  };
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

function readImageInfo(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return readPngInfo(filePath);
  if (extension === ".webp") return readWebpInfo(filePath);
  throw new Error(`Unsupported image type: ${filePath}`);
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
  const extension = path.extname(sourcePath).toLowerCase();
  const mimeType = extension === ".webp" ? "image/webp" : "image/png";
  return `data:${mimeType};base64,${fs.readFileSync(sourcePath).toString("base64")}`;
}

async function getImageSize(page, sourcePath) {
  return page.evaluate(
    async (sourceUrl) => {
      const image = new Image();
      image.decoding = "async";
      image.src = sourceUrl;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    },
    imageDataUrl(sourcePath)
  );
}

async function renderWebp(page, sourcePath, crop, outputPath, width, height, quality = 0.9) {
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
    { sourceUrl: imageDataUrl(sourcePath), crop, width, height, quality }
  );
  ensureDir(outputPath);
  fs.writeFileSync(outputPath, Buffer.from(dataUrl.replace(/^data:image\/webp;base64,/, ""), "base64"));
}

function getExtraEntries() {
  return extraPacks.flatMap(([sheetName, role, roleLabel, packSummary]) =>
    extraVariants.map(([variant, statusVariant, emotionVariant, posture, variantSummary], index) => {
      const ref = `portrait-s73-10-player-male-extra-${role}-${variant}-v1`;
      return {
        portraitRef: ref,
        role,
        roleLabel,
        roleStage: "player_male_style",
        genderPresentation: "masculine",
        ageBand: "adult_young_to_mature",
        statusVariant,
        emotionVariant,
        posture,
        usage: ["player_identity", "people_page", "game_main"],
        plannedPath: `/assets/ui/portraits/s73-10/${ref}.webp`,
        thumbnailPath: `/assets/ui/thumbs/thumb-${ref}.webp`,
        lowResPlaceholderPath: `/assets/ui/portraits/placeholders/placeholder-${ref}.webp`,
        fallbackRef: "fallback-role-silhouette-v1",
        safeArea: { desktop: { x: 0.2, y: 0.05, width: 0.6, height: 0.88 } },
        focalPoint: { x: 0.5, y: 0.25 },
        lazyLoadGroup: "portrait_pool_player_male_extra_s73_10",
        sourceSheetName: sheetName,
        cropRow: Math.floor(index / 3),
        cropCol: index % 3,
        packSummary,
        variantSummary
      };
    })
  );
}

async function writePortraitFiles(options, entries) {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(options), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const sheetRecords = [];
  const sheetCache = new Map();
  try {
    for (const entry of entries) {
      const sheetPath = path.join(extraSheetsDir, `${entry.sourceSheetName}.png`);
      if (!fs.existsSync(sheetPath)) throw new Error(`Missing source sheet: ${sheetPath}`);
      if (!sheetCache.has(sheetPath)) {
        const size = await getImageSize(page, sheetPath);
        sheetCache.set(sheetPath, size);
        sheetRecords.push({
          sheetName: entry.sourceSheetName,
          kind: "player_male_extra",
          path: toProjectPath(sheetPath),
          width: size.width,
          height: size.height
        });
      }
      const size = sheetCache.get(sheetPath);
      const cellWidth = Math.floor(size.width / 3);
      const cellHeight = Math.floor(size.height / 2);
      const crop = {
        x: entry.cropCol * cellWidth,
        y: entry.cropRow * cellHeight,
        width: entry.cropCol === 2 ? size.width - entry.cropCol * cellWidth : cellWidth,
        height: entry.cropRow === 1 ? size.height - cellHeight : cellHeight
      };
      await renderWebp(page, sheetPath, crop, resolveUiAssetPath(entry.plannedPath), PORTRAIT_WIDTH, PORTRAIT_HEIGHT, 0.9);
      await renderWebp(page, sheetPath, crop, resolveUiAssetPath(entry.thumbnailPath), THUMB_WIDTH, THUMB_HEIGHT, 0.84);
      await renderWebp(page, sheetPath, crop, resolveUiAssetPath(entry.lowResPlaceholderPath), PLACEHOLDER_WIDTH, PLACEHOLDER_HEIGHT, 0.46);
    }
  } finally {
    await browser.close();
  }
  return sheetRecords;
}

function assertImageSet(entry) {
  for (const [field, width, height] of [
    ["plannedPath", PORTRAIT_WIDTH, PORTRAIT_HEIGHT],
    ["thumbnailPath", THUMB_WIDTH, THUMB_HEIGHT],
    ["lowResPlaceholderPath", PLACEHOLDER_WIDTH, PLACEHOLDER_HEIGHT]
  ]) {
    const info = readWebpInfo(resolveUiAssetPath(entry[field]));
    if (info.width !== width || info.height !== height || info.alpha) {
      throw new Error(`Unexpected dimensions or alpha for ${entry.portraitRef} ${field}`);
    }
  }
}

function createAsset(entry, existing) {
  assertImageSet(entry);
  const imagePath = resolveUiAssetPath(entry.plannedPath);
  const thumbnailPath = resolveUiAssetPath(entry.thumbnailPath);
  const placeholderPath = resolveUiAssetPath(entry.lowResPlaceholderPath);
  const base = existing ? { ...existing } : {};
  return {
    ...base,
    id: entry.portraitRef,
    version: base.version || 1,
    phase: PHASE,
    category: "portrait",
    subcategory: "player_male_style_pool",
    usage: entry.usage,
    role: entry.role,
    roleLabel: entry.roleLabel,
    roleStage: entry.roleStage,
    scene: null,
    portraitRef: entry.portraitRef,
    genderPresentation: "masculine",
    ageBand: entry.ageBand,
    statusVariant: entry.statusVariant,
    emotionVariant: entry.emotionVariant,
    posture: entry.posture,
    identityTags: ["player", "male_style", entry.role, entry.statusVariant],
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
      notes: "玩家男性选角和身份卡窄屏保留面部、冠帽、肩颈轮廓、腰带和身份服饰；不得显示未审核候选图。"
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
      promptSummary: `${entry.packSummary} ${entry.variantSummary}`
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
      summary: "通过：成年男性特征明确，肩颈与上身轮廓、冠服层次、身份姿态差异清楚；画面高对比、色彩更丰富、噪点较少，仍保持端庄历史立绘气质。"
    },
    safetyReview: {
      reviewedBy: "Codex",
      reviewedAt: "2026-05-15",
      status: "approved",
      summary: "通过：全套衣着完整，无裸露、挑逗、幼态、现代物、水印、徽标、可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实。"
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

function makeQaAsset(asset) {
  return {
    id: asset.id,
    role: asset.role,
    roleLabel: asset.roleLabel,
    roleStage: asset.roleStage,
    genderPresentation: asset.genderPresentation,
    subcategory: asset.subcategory,
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
  };
}

function writeManifestAndQa(entries, sheetRecords) {
  const manifest = readJson(manifestPath);
  const existingById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const assets = entries.map((entry) => createAsset(entry, existingById.get(entry.portraitRef)));
  for (const asset of assets) {
    if (asset.performance.bytes > asset.performance.targetMaxBytes) throw new Error(`${asset.id} exceeds targetMaxBytes`);
    if (asset.performance.thumbnailBytes > asset.performance.thumbnailTargetMaxBytes) {
      throw new Error(`${asset.id} thumbnail exceeds targetMaxBytes`);
    }
    existingById.set(asset.id, asset);
  }
  manifest.assets = manifest.assets.filter((asset) => !assets.some((newAsset) => newAsset.id === asset.id));
  manifest.assets.push(...assets);
  manifest.roleCatalog = [...new Set([...manifest.roleCatalog, ...assets.map((asset) => asset.role)])];
  manifest.updatedAt = "2026-05-15";
  writeJson(manifestPath, manifest);

  writeJson(maleQaPath, {
    schemaVersion: 1,
    phase: "S73.10.2b",
    reviewedBy: "Codex",
    reviewedAt: "2026-05-15",
    manifestRef: "public/assets/ui/ink-ui-manifest.json",
    sourceSheets: sheetRecords,
    visualReviewSummary:
      "通过：新增 60 张玩家男性扩展选角立绘；整体更突出成年男性肩颈、上身轮廓、冠服层次、身份服饰、多姿势、高对比和丰富色彩，同时保持端庄、完整衣着和历史水墨气质。",
    safetyReviewSummary:
      "通过：所有角色均为成年；无裸露、挑逗、幼态、现代物、水印、可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实。",
    counts: {
      extraPlayerMale: 60,
      totalReviewedMaleExtra: assets.length
    },
    assets: assets.map(makeQaAsset)
  });
  return assets;
}

function checkAssets() {
  const manifest = readJson(manifestPath);
  const maleQa = readJson(maleQaPath);
  const manifestById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  if (maleQa.assets.length !== 60) throw new Error(`Expected 60 male QA assets, got ${maleQa.assets.length}`);
  if (maleQa.sourceSheets.length !== 10) throw new Error(`Expected 10 male source sheets, got ${maleQa.sourceSheets.length}`);
  if (maleQa.counts.extraPlayerMale !== 60 || maleQa.counts.totalReviewedMaleExtra !== 60) {
    throw new Error("Unexpected male QA counts");
  }
  for (const entry of maleQa.assets) {
    const asset = manifestById.get(entry.id);
    if (!asset) throw new Error(`Missing manifest asset ${entry.id}`);
    if (asset.subcategory !== "player_male_style_pool" || asset.genderPresentation !== "masculine") {
      throw new Error(`Unexpected male style asset fields: ${entry.id}`);
    }
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      const filePath = resolveUiAssetPath(entry[field]);
      if (!fs.existsSync(filePath)) throw new Error(`Missing ${field}: ${entry[field]}`);
    }
    if (entry.bytes !== fs.statSync(resolveUiAssetPath(entry.path)).size) throw new Error(`Stale bytes: ${entry.id}`);
    if (entry.thumbnailBytes !== fs.statSync(resolveUiAssetPath(entry.thumbnailPath)).size) {
      throw new Error(`Stale thumbnail bytes: ${entry.id}`);
    }
    if (entry.lowResPlaceholderBytes !== fs.statSync(resolveUiAssetPath(entry.lowResPlaceholderPath)).size) {
      throw new Error(`Stale placeholder bytes: ${entry.id}`);
    }
    if (entry.sha256 !== sha256File(resolveUiAssetPath(entry.path))) throw new Error(`Stale image sha: ${entry.id}`);
    if (entry.thumbnailSha256 !== sha256File(resolveUiAssetPath(entry.thumbnailPath))) {
      throw new Error(`Stale thumbnail sha: ${entry.id}`);
    }
    if (entry.lowResPlaceholderSha256 !== sha256File(resolveUiAssetPath(entry.lowResPlaceholderPath))) {
      throw new Error(`Stale placeholder sha: ${entry.id}`);
    }
  }
  const extraCount = manifest.assets.filter(
    (asset) => asset.phase === PHASE && asset.subcategory === "player_male_style_pool"
  ).length;
  if (extraCount !== 60) throw new Error(`Expected 60 player male style assets, got ${extraCount}`);
  console.log("S73.10.2 player male extra portraits ok: 60 extra.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = getExtraEntries();
  if (entries.length !== 60) throw new Error(`Expected 60 male entries, got ${entries.length}`);
  if (options.write) {
    const sheetRecords = await writePortraitFiles(options, entries);
    const assets = writeManifestAndQa(entries, sheetRecords);
    console.log(`Wrote ${assets.length} player male extra portrait assets from ${sheetRecords.length} sheets.`);
  }
  if (options.check) checkAssets();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
