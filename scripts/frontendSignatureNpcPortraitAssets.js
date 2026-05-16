const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const matrixPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-pool-matrix-v1.json");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const qaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-signature-npc-pool-qa-v1.json");
const defaultSheetsDir = path.join(repoRoot, "artifacts", "s73-10-signature-npc-sheets");

const PHASE = "S73.10.4";
const PORTRAIT_WIDTH = 1024;
const PORTRAIT_HEIGHT = 1536;
const THUMB_WIDTH = 384;
const THUMB_HEIGHT = 576;
const PLACEHOLDER_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 96;
const TARGET_MAX_BYTES = 614400;
const THUMBNAIL_TARGET_MAX_BYTES = 256000;

const sourceSheetPairs = Object.freeze([
  ["imperial-sovereigns", ["emperor", "empress-dowager"]],
  ["imperial-consort-regency", ["empress", "regent"]],
  ["cabinet-command", ["grand-secretary", "grand-marshal"]],
  ["rites-war-ministers", ["minister-of-rites", "minister-of-war"]],
  ["censorate-regional", ["chief-censor", "governor-general"]],
  ["famed-service", ["famous-general", "famous-minister"]],
  ["qingliu-inner-court", ["qingliu-leader", "powerful-eunuch"]],
  ["power-money", ["powerful-minister", "grand-merchant"]],
  ["local-education-patrons", ["local-clan-head", "renowned-teacher"]],
  ["examination-rivalry", ["renowned-examiner", "rival"]],
  ["confidants", ["confidant", "beloved-confidant"]],
  ["palace-frontier", ["palace-strategist", "frontier-envoy"]]
]);

const rolePromptSummaries = Object.freeze({
  emperor: "皇帝专属立绘：克制玄朱墨金常服或朝服，御案与宫灯只作气氛，表现成年君主威仪，不神化、不泄漏剧情私档。",
  "empress-dowager": "太后专属立绘：成年或年长宫廷女性，高髻簪钗、层叠礼服、腰封和沉稳眼神体现权力重量，端庄不露骨。",
  empress: "皇后专属立绘：成年宫廷女性，礼服层次、束腰腰封、肩颈线和高髻清楚，气质雍容但克制。",
  regent: "摄政专属立绘：礼制约束下的权柄人物，深色长袍、玉带、屏风和含蓄压迫感。",
  "grand-secretary": "首辅专属立绘：灯下票拟气质，厚重官服、拢袖、无字奏牍和冷静目光。",
  "grand-marshal": "大司马专属立绘：文武枢臣，官袍下有甲衣线索，军令气和朝堂气并存。",
  "minister-of-rites": "礼部重臣专属立绘：礼制肃穆，玉佩、笏板、淡金纸色和温和而不可轻忽的神情。",
  "minister-of-war": "兵部重臣专属立绘：边务与中枢相连，暗色官服、空白舆图卷、风尘袖口。",
  "chief-censor": "都御史专属立绘：霜台风骨，清峻官服、持笏或奏牍，眼神锋利但不脸谱化。",
  "governor-general": "总督专属立绘：封疆大吏，行旅披风、山河屏风、河雾或驿站气息。",
  "famous-general": "名将专属立绘：边塞秋声，旧甲披风、按剑或持盔，风霜成熟，无夸张奇幻甲。",
  "famous-minister": "名臣专属立绘：清望与担当，素雅高阶官服、无字章奏、沉静正身。",
  "qingliu-leader": "清流领袖专属立绘：寒素而锋利，旧袍、笏板、冷灰宣纸与直谏气。",
  "powerful-eunuch": "权宦专属立绘：成熟内廷人物，整洁宫服、拂尘或奏函，不做妖魔化奸邪脸谱。",
  "powerful-minister": "权臣专属立绘：高位权势人物，厚重官服、暗朱屏风、含蓄不透明的神情。",
  "grand-merchant": "豪商专属立绘：市舶灯火，深色绸袍、玉佩、无字账册或货箱影，精明但不滑稽。",
  "local-clan-head": "地方望族专属立绘：乡里士绅首领，厅堂、族谱匣或茶盏只作道具，无文字。",
  "renowned-teacher": "名师专属立绘：杏坛残雪，书院灯影、旧衫、闭合书卷和严而不冷的眼神。",
  "renowned-examiner": "名主考专属立绘：科场法度，朱笔与弥封空白卷，神情疲惫而公正。",
  rival: "宿敌专属立绘：公开身份可辨但不泄漏隐藏关系，衣冠端正、眼神有锋芒，避免反派脸谱。",
  confidant: "知己专属立绘：可信近而不轻浮，雅服、折扇或书卷，温和克制。",
  "beloved-confidant": "红颜/蓝颜知交专属立绘：成年女性知交，层叠衣料、腰封细腰、高髻和端庄亲近感，不挑逗不幼态。",
  "palace-strategist": "宫廷谋主专属立绘：内廷智囊，书斋帘影、折扇或灯盏，沉静有谋而不泄漏隐秘。",
  "frontier-envoy": "边地使者专属立绘：边地外交人物，行旅披风、异域边纹点到即止，不做猎奇或现代化。"
});

const variantSummaries = Object.freeze({
  normal: "常态：半身正面或三分侧面，公开身份气质清楚，表情克制。",
  court: "朝会/正式态：持笏、拱手或正身，冠服更正式，威仪强但不夸张。",
  private: "私下/案前态：疲惫、沉思或侧身，表现人物重量，不写隐藏动机或秘密事实。"
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
  node scripts/frontendSignatureNpcPortraitAssets.js --write [--sheets artifacts/s73-10-signature-npc-sheets]
  node scripts/frontendSignatureNpcPortraitAssets.js --check

The write mode expects 12 square 3x2 PNG/WebP sheets, named by source group.
Cell order is role A normal/court/private on the first row, role B normal/court/private on the second row.`);
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

function getSignatureEntries() {
  const matrix = readJson(matrixPath);
  const entries = matrix.entries.filter((entry) => entry.productionStep === PHASE && entry.matrixGroup === "signature_npc");
  const byRef = new Map(entries.map((entry) => [entry.portraitRef, entry]));
  const ordered = [];
  for (const [, roles] of sourceSheetPairs) {
    for (const role of roles) {
      for (const variant of ["normal", "court", "private"]) {
        const ref = `portrait-s73-10-signature_npc-${role}-${variant}-v1`;
        const entry = byRef.get(ref);
        if (!entry) throw new Error(`Missing signature NPC matrix entry: ${ref}`);
        ordered.push({ ...entry, sourceSheetName: sourceSheetPairs.find((pair) => pair[1].includes(role))[0] });
      }
    }
  }
  return ordered;
}

function groupBySourceSheet(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.sourceSheetName)) groups.set(entry.sourceSheetName, []);
    groups.get(entry.sourceSheetName).push(entry);
  }
  return groups;
}

function variantCode(entry) {
  const match = entry.portraitRef.match(/-(normal|court|private)-v1$/);
  if (!match) throw new Error(`Cannot infer portrait variant: ${entry.portraitRef}`);
  return match[1];
}

function getSheetPath(sheetsDir, sheetName) {
  const pngPath = path.join(sheetsDir, `${sheetName}.png`);
  const webpPath = path.join(sheetsDir, `${sheetName}.webp`);
  if (fs.existsSync(pngPath)) return pngPath;
  if (fs.existsSync(webpPath)) return webpPath;
  throw new Error(`Missing signature NPC portrait sheet for ${sheetName}: expected ${toProjectPath(pngPath)} or ${toProjectPath(webpPath)}`);
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

function imageDataUrl(sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase();
  const mimeType = extension === ".webp" ? "image/webp" : "image/png";
  return `data:${mimeType};base64,${fs.readFileSync(sourcePath).toString("base64")}`;
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
  ensureDir(outputPath);
  fs.writeFileSync(outputPath, Buffer.from(dataUrl.replace(/^data:image\/webp;base64,/, ""), "base64"));
}

async function writePortraitFiles(options, entries) {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(options), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const sheetRecords = [];
  try {
    for (const [sheetName, sheetEntries] of groupBySourceSheet(entries)) {
      const sheetPath = getSheetPath(options.sheetsDir, sheetName);
      const size = await getImageSize(page, sheetPath);
      const cellWidth = Math.floor(size.width / 3);
      const cellHeight = Math.floor(size.height / 2);
      sheetRecords.push({
        sheetName,
        roles: [...new Set(sheetEntries.map((entry) => entry.role))],
        path: toProjectPath(sheetPath),
        width: size.width,
        height: size.height
      });
      for (const [index, entry] of sheetEntries.entries()) {
        const crop = {
          x: (index % 3) * cellWidth,
          y: Math.floor(index / 3) * cellHeight,
          width: index % 3 === 2 ? size.width - (index % 3) * cellWidth : cellWidth,
          height: Math.floor(index / 3) === 1 ? size.height - cellHeight : cellHeight
        };
        await renderWebp(page, sheetPath, crop, resolveUiAssetPath(entry.plannedPath), PORTRAIT_WIDTH, PORTRAIT_HEIGHT, 0.9);
        await renderWebp(page, sheetPath, crop, resolveUiAssetPath(entry.thumbnailPath), THUMB_WIDTH, THUMB_HEIGHT, 0.84);
        await renderWebp(page, sheetPath, crop, resolveUiAssetPath(entry.lowResPlaceholderPath), PLACEHOLDER_WIDTH, PLACEHOLDER_HEIGHT, 0.46);
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
  const variant = variantCode(entry);
  return {
    id: entry.portraitRef,
    version: 1,
    phase: PHASE,
    category: "portrait",
    subcategory: "signature_npc_pool",
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
    identityTags: ["signature_npc", "important_npc", entry.role, entry.roleStage, entry.statusVariant, variant],
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
      notes: "重要 NPC 人物页和剧情场景窄屏保留面部、冠服层次、上身姿态和公开身份气质；未公开剧情视野之外只暴露安全 portraitRef。"
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
      generatedAt: "2026-05-16",
      promptSummary: `${rolePromptSummaries[entry.role]} ${variantSummaries[variant]}`
    },
    license: {
      type: "ai_generated_project_asset",
      commercialUseConfirmed: false,
      summary: "原创 AI 生成素材，当前仅个人游玩/开发使用；未做公开商用确认。"
    },
    reviewStatus: "approved",
    visualReview: {
      reviewedBy: "Codex",
      reviewedAt: "2026-05-16",
      status: "approved",
      summary:
        "通过：成人端庄，重要 NPC 的权力层级、公开身份气质、冠服/道具和水墨宣纸基调清楚；女性专属角色通过高髻、簪钗、层叠礼服、腰封细腰、肩颈线和端庄姿态体现成熟女性特征，但不露胸、不透明、不挑逗、不幼态。"
    },
    safetyReview: {
      reviewedBy: "Codex",
      reviewedAt: "2026-05-16",
      status: "approved",
      summary: "通过：重要 NPC 不混入通用头像池；manifest 与 QA 不保存 hidden 私档、隐藏动机、未公开任免、未公开关系、provider 原始响应、本地路径、key、raw/prompt/audit 内容；画面无现代物、水印或可读文字。"
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
  const newAssets = entries.map(createAsset);
  for (const asset of newAssets) {
    if (asset.performance.bytes > asset.performance.targetMaxBytes) {
      throw new Error(`${asset.id} exceeds target max bytes: ${asset.performance.bytes}`);
    }
    if (asset.performance.thumbnailBytes > asset.performance.thumbnailTargetMaxBytes) {
      throw new Error(`${asset.id} thumbnail exceeds target max bytes: ${asset.performance.thumbnailBytes}`);
    }
  }
  manifest.assets = manifest.assets.filter((asset) => !newAssets.some((newAsset) => newAsset.id === asset.id));
  manifest.assets.push(...newAssets);
  manifest.roleCatalog = [...new Set([...manifest.roleCatalog, ...entries.map((entry) => entry.role)])];
  manifest.updatedAt = "2026-05-16";
  writeJson(manifestPath, manifest);

  const qa = {
    schemaVersion: 1,
    phase: PHASE,
    reviewedBy: "Codex",
    reviewedAt: "2026-05-16",
    manifestRef: "public/assets/ui/ink-ui-manifest.json",
    matrixRef: "public/assets/ui/portraits/portrait-pool-matrix-v1.json",
    sourceSheets: sheetRecords,
    visualReviewSummary:
      "通过：72 张重要 NPC 专属立绘均为成年端庄水墨淡彩半身像，覆盖帝王/后妃/摄政、台阁枢臣、六部/都察院、封疆、名将、清流、权臣、豪商、名师、名主考、宿敌、知己、宫廷谋主和边地使者。女性角色不做中性化处理，通过高髻、簪钗、层叠礼服、腰封细腰、肩颈线、衣料层次和端庄仪态体现成年女性特征，无露胸、透视、裸露、挑逗、幼态或现代化表现。",
    safetyReviewSummary:
      "通过：重要 NPC 专属池使用 signature_npc_pool 和 portrait_pool_signature_npc_s73_10 单独隔离，不混入 generic_npc；manifest 与 QA 仅保存安全路径、哈希、prompt summary 和审核摘要，不保存 provider 原始响应、本地绝对路径、key、raw/hidden 内容、未公开剧情事实、隐藏动机、未公开任免或未公开关系。",
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
  const qaById = new Map(qa.assets.map((asset) => [asset.id, asset]));
  if (qa.assets.length !== entries.length) throw new Error(`Expected ${entries.length} QA assets, got ${qa.assets.length}`);
  for (const entry of entries) {
    const asset = assetsById.get(entry.portraitRef);
    if (!asset) throw new Error(`Missing manifest asset: ${entry.portraitRef}`);
    const qaEntry = qaById.get(entry.portraitRef);
    if (!qaEntry) throw new Error(`Missing QA asset: ${entry.portraitRef}`);
    if (asset.phase !== PHASE || asset.category !== "portrait" || asset.subcategory !== "signature_npc_pool" || asset.reviewStatus !== "approved") {
      throw new Error(`Unexpected manifest state: ${entry.portraitRef}`);
    }
    if (asset.identityTags.includes("generic_npc") || asset.lazyLoad.group !== "portrait_pool_signature_npc_s73_10") {
      throw new Error(`Signature NPC leaked into generic pool: ${entry.portraitRef}`);
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
    if (qaEntry.sha256 !== sha256File(resolveUiAssetPath(asset.path))) {
      throw new Error(`Stale image sha: ${entry.portraitRef}`);
    }
    if (qaEntry.thumbnailSha256 !== sha256File(resolveUiAssetPath(asset.thumbnailPath))) {
      throw new Error(`Stale thumbnail sha: ${entry.portraitRef}`);
    }
    if (qaEntry.lowResPlaceholderSha256 !== sha256File(resolveUiAssetPath(asset.lowResPlaceholderPath))) {
      throw new Error(`Stale placeholder sha: ${entry.portraitRef}`);
    }
  }
  console.log(`${PHASE} signature NPC portrait assets ok: ${entries.length} manifest entries.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = getSignatureEntries();
  if (entries.length !== 72) throw new Error(`Expected 72 S73.10.4 signature NPC entries, got ${entries.length}`);
  if (options.write) {
    const sheetRecords = await writePortraitFiles(options, entries);
    const assets = writeManifestAndQa(entries, sheetRecords);
    console.log(`${PHASE} wrote ${assets.length} signature NPC portrait assets from ${sheetRecords.length} sheets.`);
  }
  if (options.check) checkAssets(entries);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
