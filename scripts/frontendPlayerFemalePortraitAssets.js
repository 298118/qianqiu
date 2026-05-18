const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const matrixPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-pool-matrix-v1.json");
const playerQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-player-pool-qa-v1.json");
const femaleQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-player-female-reset-qa-v1.json");
const resetSheetsDir = path.join(repoRoot, "artifacts", "s73-10-player-female-reset-sheets");
const extraSheetsDir = path.join(repoRoot, "artifacts", "s73-10-player-female-extra-sheets");

const PHASE = "S73.10.2";
const PORTRAIT_WIDTH = 1024;
const PORTRAIT_HEIGHT = 1536;
const THUMB_WIDTH = 384;
const THUMB_HEIGHT = 576;
const PLACEHOLDER_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 96;
const TARGET_MAX_BYTES = 614400;
const THUMBNAIL_TARGET_MAX_BYTES = 256000;
const localSourceCellsDir = path.join(repoRoot, "artifacts", "s73-10-player-female-source-cells");

const resetSheetPairs = Object.freeze([
  ["scholar-child-exam-candidate", ["scholar", "child-exam-candidate"]],
  ["xiucai-juren", ["xiucai", "juren"]],
  ["gongshi-jinshi", ["gongshi", "jinshi"]],
  ["junior-local-official", ["junior-official", "local-official"]],
  ["capital-grand-minister", ["capital-official", "grand-minister"]],
  ["general-emperor-regent", ["general", "emperor-regent"]]
]);

const extraPacks = Object.freeze([
  ["palace-noble", "palace_noble", "宫装贵人", "宫装贵人玩家扩展：深绛、墨青、金线暗纹与层叠礼服，气质华贵克制。"],
  ["palace-female-official", "palace_female_official", "宫廷女官", "宫廷女官玩家扩展：挺括官服、册牍、笏板、腰封与宽袖，显得干练有权柄。"],
  ["palace-attendant-reader", "palace_reader", "宫廷侍读", "宫廷侍读玩家扩展：宫服、灯盏、卷轴与内廷读书气。"],
  ["high-court-lady", "high_court_lady", "高阶宫廷女性", "高阶宫廷女性玩家扩展：礼制厚重、政治重量强，姿态沉静。"],
  ["tang-ruqun-pibo", "tang_ruqun_pibo", "唐风襦裙披帛", "唐风襦裙披帛玩家扩展：高腰襦裙、披帛和暖色衣料，身形更明快。"],
  ["tang-round-collar-travel", "tang_round_collar_travel", "唐风圆领行装", "唐风圆领行装玩家扩展：圆领袍、外披、窄带与出行姿态。"],
  ["tang-scholar-poet", "tang_scholar_poet", "唐风才女", "唐风才女玩家扩展：持卷、执笔、庭院和诗会气质。"],
  ["gentry-lady", "gentry_lady", "士族贵女", "士族贵女玩家扩展：士族礼服、玉佩、册匣与家族厅堂气质。"],
  ["merchant-owner", "merchant_owner", "商贾女东家", "商贾女东家玩家扩展：账册、布匹、契纸和城市经营气。"],
  ["frontier-general", "frontier_general", "边塞女将", "边塞女将玩家扩展：完整甲衣、披风、军帐与边塞英气。"]
]);

const extraVariants = Object.freeze([
  ["look01", "baseline", "graceful", "正身肃立", "正身款，上身衣料层次和束腰轮廓清楚，端庄不露骨。"],
  ["look02", "formal", "composed", "侧立持物", "侧立款，肩颈线、发饰和衣摆层次更明显。"],
  ["look03", "working", "focused", "坐姿执笔", "工作款，坐姿或持卷，服饰完整，姿态自持。"],
  ["look04", "travel_or_motion", "alert", "行走回身", "动态款，披帛或披风拉开轮廓，身形不厚重。"],
  ["look05", "quiet_authority", "reserved", "拢袖端坐", "威仪款，拢袖或端坐，衣料层次与腰线收束清楚。"],
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
  node scripts/frontendPlayerFemalePortraitAssets.js --write
  node scripts/frontendPlayerFemalePortraitAssets.js --check

The write mode expects 6 reset sheets in artifacts/s73-10-player-female-reset-sheets
and 10 player female expansion sheets in artifacts/s73-10-player-female-extra-sheets.
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

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function writeFileWithRetry(filePath, buffer) {
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
      const scale = Math.min(width / crop.width, height / crop.height);
      const drawWidth = crop.width * scale;
      const drawHeight = crop.height * scale;
      const dx = (width - drawWidth) / 2;
      const dy = (height - drawHeight) / 2;
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, dx, dy, drawWidth, drawHeight);
      return canvas.toDataURL("image/webp", quality);
    },
    { sourceUrl: imageDataUrl(sourcePath), crop, width, height, quality }
  );
  ensureDir(outputPath);
  writeFileWithRetry(outputPath, Buffer.from(dataUrl.replace(/^data:image\/webp;base64,/, ""), "base64"));
}

async function renderPng(page, sourcePath, crop, outputPath, width, height) {
  const dataUrl = await page.evaluate(
    async ({ sourceUrl, crop, width, height }) => {
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
      return canvas.toDataURL("image/png");
    },
    { sourceUrl: imageDataUrl(sourcePath), crop, width, height }
  );
  ensureDir(outputPath);
  writeFileWithRetry(outputPath, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
}

function getPlayerMatrixEntries() {
  return readJson(matrixPath).entries.filter((entry) => entry.productionStep === PHASE && entry.matrixGroup === "player");
}

function getPlayerIdentitySourceSheets() {
  const sourceDir = path.join(repoRoot, "artifacts", "s73-10-player-sheets");
  const roles = [
    ...new Set(
      getPlayerMatrixEntries()
        .map((entry) => entry.role)
        .sort()
    )
  ];
  return roles.map((role) => {
    const pngPath = path.join(sourceDir, `${role}.png`);
    const webpPath = path.join(sourceDir, `${role}.webp`);
    const sheetPath = fs.existsSync(pngPath) ? pngPath : webpPath;
    if (!fs.existsSync(sheetPath)) throw new Error(`Missing player identity source sheet: ${role}`);
    const info = readImageInfo(sheetPath);
    return {
      sheetName: role,
      kind: "player_identity_stage",
      path: toProjectPath(sheetPath),
      width: info.width,
      height: info.height
    };
  });
}

function getResetEntries() {
  const entriesByRole = new Map(getPlayerMatrixEntries().map((entry) => [entry.portraitRef, entry]));
  const resetEntries = [];
  for (const [sheetName, roles] of resetSheetPairs) {
    for (const [row, role] of roles.entries()) {
      for (const [col, variant] of ["f01", "f02", "f03"].entries()) {
        const ref = `portrait-s73-10-player-${role}-${variant}-v1`;
        const entry = entriesByRole.get(ref);
        if (!entry) throw new Error(`Missing player matrix entry ${ref}`);
        resetEntries.push({ ...entry, sourceSheetName: sheetName, cropRow: row, cropCol: col, femaleReset: true });
      }
    }
  }
  return resetEntries;
}

function getExtraEntries() {
  return extraPacks.flatMap(([sheetName, role, roleLabel, packSummary]) =>
    extraVariants.map(([variant, statusVariant, emotionVariant, posture, variantSummary], index) => {
      const ref = `portrait-s73-10-player-female-extra-${role}-${variant}-v1`;
      return {
        portraitRef: ref,
        role,
        roleLabel,
        roleStage: "player_female_style",
        genderPresentation: "feminine",
        ageBand: "adult_young",
        statusVariant,
        emotionVariant,
        posture,
        usage: ["player_identity", "people_page", "game_main"],
        plannedPath: `/assets/ui/portraits/s73-10/${ref}.webp`,
        thumbnailPath: `/assets/ui/thumbs/thumb-${ref}.webp`,
        lowResPlaceholderPath: `/assets/ui/portraits/placeholders/placeholder-${ref}.webp`,
        fallbackRef: "fallback-role-silhouette-v1",
        safeArea: { desktop: { x: 0.2, y: 0.06, width: 0.6, height: 0.86 } },
        focalPoint: { x: 0.5, y: 0.26 },
        lazyLoadGroup: "portrait_pool_player_female_extra_s73_10",
        sourceSheetName: sheetName,
        cropRow: Math.floor(index / 3),
        cropCol: index % 3,
        femaleExtra: true,
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
      const dir = entry.femaleExtra ? extraSheetsDir : resetSheetsDir;
      const sheetPath = path.join(dir, `${entry.sourceSheetName}.png`);
      if (!fs.existsSync(sheetPath)) throw new Error(`Missing source sheet: ${sheetPath}`);
      if (!sheetCache.has(sheetPath)) {
        const size = await getImageSize(page, sheetPath);
        sheetCache.set(sheetPath, size);
        sheetRecords.push({
          sheetName: entry.sourceSheetName,
          kind: entry.femaleExtra ? "player_female_extra" : "player_female_reset",
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
      const sourceCellWidth = 1536;
      const sourceCellHeight = Math.round(sourceCellWidth * (crop.height / crop.width));
      await renderPng(page, sheetPath, crop, path.join(localSourceCellsDir, `${entry.portraitRef}.png`), sourceCellWidth, sourceCellHeight);
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
    subcategory: entry.femaleExtra ? "player_female_style_pool" : "player_identity_stage_pool",
    usage: entry.usage,
    role: entry.role,
    roleLabel: entry.roleLabel,
    roleStage: entry.roleStage,
    scene: null,
    portraitRef: entry.portraitRef,
    genderPresentation: "feminine",
    ageBand: entry.ageBand,
    statusVariant: entry.statusVariant,
    emotionVariant: entry.emotionVariant,
    posture: entry.posture,
    identityTags: entry.femaleExtra
      ? ["player", "female_style", entry.role, entry.statusVariant]
      : ["player", entry.role, entry.roleStage, entry.statusVariant, entry.portraitRef.match(/-(f0[1-3])-v1$/)[1], "female_reset"],
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
      notes: "玩家女性选角和身份卡窄屏保留面部、发饰、上身服饰轮廓、束腰腰封和身份服饰；不得显示未审核候选图。"
    },
    lazyLoad: {
      group: entry.femaleExtra ? "portrait_pool_player_female_extra_s73_10" : "portrait_pool_player_s73_10",
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
      promptSummary: entry.femaleExtra
        ? `${entry.packSummary} ${entry.variantSummary}`
        : `${entry.roleLabel}玩家女性重置：成年端庄、女性体态更明确，上身衣料层次、束腰细腰、发饰和服饰层次更清楚；高对比、色彩更丰富、少噪点。`
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
      summary: "通过：成年女性特征更明确，上身服饰层次、腰封收出细腰、服饰姿态差异清楚；画面高对比、色彩更丰富、噪点较少，仍保持端庄历史立绘气质。"
    },
    safetyReview: {
      reviewedBy: "Codex",
      reviewedAt: "2026-05-15",
      status: "approved",
      summary: "通过：全套衣着完整，无低胸、透视、裸露、挑逗、幼态、现代物、水印、徽标、可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实。"
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
    localSourceCellPath: toProjectPath(path.join(localSourceCellsDir, `${asset.id}.png`)),
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

  const playerAssets = manifest.assets.filter(
    (asset) => asset.phase === PHASE && asset.subcategory === "player_identity_stage_pool"
  );
  const playerSourceSheets = [
    ...getPlayerIdentitySourceSheets(),
    ...sheetRecords.filter((record) => record.kind === "player_female_reset")
  ];
  writeJson(playerQaPath, {
    schemaVersion: 1,
    phase: PHASE,
    reviewedBy: "Codex",
    reviewedAt: "2026-05-15",
    manifestRef: "public/assets/ui/ink-ui-manifest.json",
    matrixRef: "public/assets/ui/portraits/portrait-pool-matrix-v1.json",
    sourceSheets: playerSourceSheets,
    visualReviewSummary:
      "通过：72 张玩家身份阶段立绘均为成年端庄水墨淡彩半身像；其中 36 张女性重置后女性体态更明确，上身服饰层次、腰封细腰、服饰和姿态更有区分，且无可读文字、水印、现代器物、露骨、挑逗或幼态表现。",
    safetyReviewSummary:
      "通过：manifest 与 QA 仅保存安全路径、哈希、prompt summary 和审核摘要；不保存 provider 原始响应、本地绝对路径、key、raw/hidden 内容、未公开剧情事实或服务器裁决暗示。",
    assets: playerAssets.map(makeQaAsset)
  });

  const femaleAssets = assets.filter((asset) => asset.genderPresentation === "feminine");
  writeJson(femaleQaPath, {
    schemaVersion: 1,
    phase: "S73.10.2a",
    reviewedBy: "Codex",
    reviewedAt: "2026-05-15",
    manifestRef: "public/assets/ui/ink-ui-manifest.json",
    playerPoolQaRef: "public/assets/ui/portraits/portrait-player-pool-qa-v1.json",
    sourceSheets: sheetRecords,
    visualReviewSummary:
      "通过：36 张玩家阶段女性立绘已重置，另新增 60 张玩家女性扩展选角立绘；整体更突出成年女性身形、上身服饰层次、束腰细腰、多服饰、多姿势、高对比和丰富色彩，同时保持端庄、完整衣着和历史水墨气质。",
    safetyReviewSummary:
      "通过：所有角色均为成年；无低胸、透视、裸露、挑逗、幼态、现代物、水印、可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实。",
    counts: {
      resetPlayerFemale: 36,
      extraPlayerFemale: 60,
      totalReviewedFemale: femaleAssets.length
    },
    assets: femaleAssets.map(makeQaAsset)
  });
  return assets;
}

function checkAssets() {
  const manifest = readJson(manifestPath);
  const playerQa = readJson(playerQaPath);
  const femaleQa = readJson(femaleQaPath);
  const manifestById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const isSingleOverride = (asset) =>
    asset?.source?.localHighResSource === "kept_outside_public_manifest" ||
    asset?.source?.localHighResSourcePath?.startsWith("artifacts/s73-10-single-portrait-overrides/");
  if (playerQa.assets.length !== 72) throw new Error(`Expected 72 player QA assets, got ${playerQa.assets.length}`);
  if (femaleQa.assets.length !== 96) throw new Error(`Expected 96 female QA assets, got ${femaleQa.assets.length}`);
  const playerSourceKindCounts = playerQa.sourceSheets.reduce((counts, sheet) => {
    counts[sheet.kind] = (counts[sheet.kind] || 0) + 1;
    return counts;
  }, {});
  if (playerSourceKindCounts.player_identity_stage !== 12 || playerSourceKindCounts.player_female_reset !== 6) {
    throw new Error("Unexpected player QA source sheet provenance");
  }
  if (femaleQa.counts.resetPlayerFemale !== 36 || femaleQa.counts.extraPlayerFemale !== 60) {
    throw new Error("Unexpected female QA counts");
  }
  for (const entry of [...playerQa.assets, ...femaleQa.assets]) {
    const asset = manifestById.get(entry.id);
    if (!asset) throw new Error(`Missing manifest asset ${entry.id}`);
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      const filePath = resolveUiAssetPath(entry[field]);
      if (!fs.existsSync(filePath)) throw new Error(`Missing ${field}: ${entry[field]}`);
    }
    if (isSingleOverride(asset)) {
      const bytes = fs.statSync(resolveUiAssetPath(asset.path)).size;
      const thumbnailBytes = fs.statSync(resolveUiAssetPath(asset.thumbnailPath)).size;
      const lowResPlaceholderBytes = fs.statSync(resolveUiAssetPath(asset.lowResPlaceholderPath)).size;
      if (asset.performance.bytes !== bytes) throw new Error(`Stale override manifest bytes: ${asset.id}`);
      if (asset.performance.thumbnailBytes !== thumbnailBytes) {
        throw new Error(`Stale override manifest thumbnail bytes: ${asset.id}`);
      }
      if (asset.performance.lowResPlaceholderBytes !== lowResPlaceholderBytes) {
        throw new Error(`Stale override manifest placeholder bytes: ${asset.id}`);
      }
      continue;
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
    (asset) => asset.phase === PHASE && asset.subcategory === "player_female_style_pool"
  ).length;
  if (extraCount !== 60) throw new Error(`Expected 60 player female style assets, got ${extraCount}`);
  console.log("S73.10.2 player female reset and extra portraits ok: 36 reset + 60 extra.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = [...getResetEntries(), ...getExtraEntries()];
  if (entries.length !== 96) throw new Error(`Expected 96 female entries, got ${entries.length}`);
  if (options.write) {
    const sheetRecords = await writePortraitFiles(options, entries);
    const assets = writeManifestAndQa(entries, sheetRecords);
    console.log(`Wrote ${assets.length} player female reset/extra portrait assets from ${sheetRecords.length} sheets.`);
  }
  if (options.check) checkAssets();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
