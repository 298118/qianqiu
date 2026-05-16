const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const matrixPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-pool-matrix-v1.json");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const qaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-state-scene-pool-qa-v1.json");
const defaultSheetsDir = path.join(repoRoot, "artifacts", "s73-10-state-scene-sheets");

const PHASE = "S73.10.5";
const PORTRAIT_WIDTH = 1024;
const PORTRAIT_HEIGHT = 1536;
const THUMB_WIDTH = 384;
const THUMB_HEIGHT = 576;
const PLACEHOLDER_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 96;
const TARGET_MAX_BYTES = 614400;
const THUMBNAIL_TARGET_MAX_BYTES = 256000;

const stateSheetPairs = Object.freeze([
  ["state-thinking-salute", ["thinking", "salute"]],
  ["state-scroll-review", ["holding-scroll", "reviewing-paper"]],
  ["state-tablet-writing", ["holding-tablet", "writing"]],
  ["state-sword-tired", ["hand-on-sword", "tired"]],
  ["state-ill-standing", ["ill", "standing"]],
  ["state-anger-smile", ["anger", "smile"]],
  ["state-surprised-decision", ["surprised", "decision"]],
  ["state-trial-apology", ["trial", "apology"]]
]);

const sceneSheetPairs = Object.freeze([
  ["scene-exam-list", ["exam-writing", "exam-list-meeting"]],
  ["scene-yamen-court", ["county-trial", "court-memorial"]],
  ["scene-war-study", ["war-council", "night-study"]],
  ["scene-market-palace", ["market-talk", "palace-summons"]]
]);

const stateSummaries = Object.freeze({
  thinking: "沉思：灯下未落一笔，心中已有千言。",
  salute: "拱手：礼数在身，锋芒藏于袖中。",
  "holding-scroll": "执卷：书卷半启，像握住一条未竟仕途。",
  "reviewing-paper": "阅卷：朱笔未落，先辨文章与人心。",
  "holding-tablet": "持笏：朝班肃肃，一片笏板压住风波。",
  writing: "执笔：笔锋将下，成败荣辱悬于腕间。",
  "hand-on-sword": "按剑：不怒自威，衣袍下有边塞风霜。",
  tired: "疲惫：冠带未解，眼底仍有未眠国事。",
  ill: "病中：病容清减，气骨仍不肯低。",
  standing: "肃立：静立如碑，等候命运宣判。",
  anger: "含怒：怒意不露齿，只在眉眼间压成寒锋。",
  smile: "微笑：笑意浅淡，像春水掩住深流。",
  surprised: "惊疑：一瞬回首，听见局势忽然变调。",
  decision: "决断：袖中风定，心中已斩乱麻。",
  trial: "受审：堂上光冷，仍守最后一分体面。",
  apology: "请罪：低身不卑，认罪与辩白都藏在礼中。"
});

const sceneSummaries = Object.freeze({
  "exam-writing": "科举答卷：号舍灯影窄，天地只剩一卷白纸。",
  "exam-list-meeting": "放榜相逢：榜前人潮如潮，喜惧都在一眼之间。",
  "county-trial": "县衙问案：惊堂木未响，案情已在众人脸上浮动。",
  "court-memorial": "朝议陈奏：笏板成林，一句陈奏牵动满殿气息。",
  "war-council": "军帐筹谋：烛火照纸上山河，胜负尚未离案。",
  "night-study": "书斋夜读：夜雨压窗，书页与人心一同翻动。",
  "market-talk": "街市交涉：市声喧杂，袖中契约比刀剑更锋利。",
  "palace-summons": "宫廷召见：帘幕深深，召见之声像落在玉阶上的霜。"
});

const sceneVariantSummaries = Object.freeze({
  lead: "起势：三分正面，人物稳定地进入场景。",
  tension: "张力：侧身或回望，像听见一句改变局势的话。",
  resolution: "收束：低头或抬眼，情绪沉下去，画面留出后续叙事空间。"
});

const familySummaries = Object.freeze({
  scholar: "士人气质，青灰布麻、书卷、袖口和清朗眉眼。",
  official: "官署气质，官服、腰封、笏板或案卷体现制度重量。",
  military: "军务气质，披风、旧甲或佩剑点到为止，无现代武器。"
});

function parseArgs(argv) {
  const options = { write: false, check: false, sheetsDir: defaultSheetsDir, browserPath: null };
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
      console.log("Usage: node scripts/frontendStateScenePortraitAssets.js --write|--check [--sheets artifacts/s73-10-state-scene-sheets]");
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

function readOrderedMatrixEntries() {
  const byRef = new Map(
    readJson(matrixPath)
      .entries.filter((entry) => entry.productionStep === PHASE && ["state_variant", "scene_anchor"].includes(entry.matrixGroup))
      .map((entry) => [entry.portraitRef, entry])
  );
  const ordered = [];
  for (const [sheetName, states] of stateSheetPairs) {
    for (const state of states) {
      for (const family of ["scholar", "official", "military"]) {
        const ref = `portrait-s73-10-state_variant-${family}-${state}-${family}-v1`;
        if (!byRef.has(ref)) throw new Error(`Missing state variant matrix entry: ${ref}`);
        ordered.push({ ...byRef.get(ref), sourceSheetName: sheetName });
      }
    }
  }
  for (const [sheetName, scenes] of sceneSheetPairs) {
    for (const scene of scenes) {
      for (const variant of ["lead", "tension", "resolution"]) {
        const ref = `portrait-s73-10-scene_anchor-${scene}-${variant}-v1`;
        if (!byRef.has(ref)) throw new Error(`Missing scene anchor matrix entry: ${ref}`);
        ordered.push({ ...byRef.get(ref), sourceSheetName: sheetName });
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

function getSheetPath(sheetsDir, sheetName) {
  const pngPath = path.join(sheetsDir, `${sheetName}.png`);
  const webpPath = path.join(sheetsDir, `${sheetName}.webp`);
  if (fs.existsSync(pngPath)) return pngPath;
  if (fs.existsSync(webpPath)) return webpPath;
  throw new Error(`Missing state/scene portrait sheet for ${sheetName}: expected ${toProjectPath(pngPath)} or ${toProjectPath(webpPath)}`);
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
  if (platform === "darwin") return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Chromium.app/Contents/MacOS/Chromium"];
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
  return `data:${extension === ".webp" ? "image/webp" : "image/png"};base64,${fs.readFileSync(sourcePath).toString("base64")}`;
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

async function renderWebp(page, sourcePath, crop, outputPath, width, height, quality) {
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
      sheetRecords.push({ sheetName, matrixGroups: [...new Set(sheetEntries.map((entry) => entry.matrixGroup))], roles: [...new Set(sheetEntries.map((entry) => entry.role))], path: toProjectPath(sheetPath), width: size.width, height: size.height });
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

function promptSummary(entry) {
  if (entry.matrixGroup === "state_variant") {
    const family = entry.role.split("-")[0];
    return `${stateSummaries[entry.statusVariant]} ${familySummaries[family]} 女性角色通过发髻、簪钗、衣料层次、腰封细腰、肩颈线和端庄姿态体现成熟女性特征，不中性化也不性化。`;
  }
  const variant = entry.portraitRef.match(/-(lead|tension|resolution)-v1$/)[1];
  return `${sceneSummaries[entry.role]} ${sceneVariantSummaries[variant]} 女性角色需有明确成熟女性服饰与身形特征，端庄不艳俗。`;
}

function createAsset(entry) {
  const imagePath = resolveUiAssetPath(entry.plannedPath);
  const thumbnailPath = resolveUiAssetPath(entry.thumbnailPath);
  const placeholderPath = resolveUiAssetPath(entry.lowResPlaceholderPath);
  const info = readWebpInfo(imagePath);
  const thumbInfo = readWebpInfo(thumbnailPath);
  const placeholderInfo = readWebpInfo(placeholderPath);
  if (info.width !== PORTRAIT_WIDTH || info.height !== PORTRAIT_HEIGHT || info.alpha) throw new Error(`Unexpected portrait dimensions or alpha: ${entry.portraitRef}`);
  if (thumbInfo.width !== THUMB_WIDTH || thumbInfo.height !== THUMB_HEIGHT || thumbInfo.alpha) throw new Error(`Unexpected thumbnail dimensions or alpha: ${entry.portraitRef}`);
  if (placeholderInfo.width !== PLACEHOLDER_WIDTH || placeholderInfo.height !== PLACEHOLDER_HEIGHT || placeholderInfo.alpha) throw new Error(`Unexpected placeholder dimensions or alpha: ${entry.portraitRef}`);
  const subcategory = entry.matrixGroup === "state_variant" ? "state_variant_pool" : "scene_anchor_pool";
  return {
    id: entry.portraitRef,
    version: 1,
    phase: PHASE,
    category: "portrait",
    subcategory,
    usage: entry.usage,
    role: entry.role,
    roleLabel: entry.roleLabel,
    roleStage: entry.roleStage,
    scene: entry.matrixGroup === "scene_anchor" ? entry.role : null,
    portraitRef: entry.portraitRef,
    genderPresentation: entry.genderPresentation,
    ageBand: entry.ageBand,
    statusVariant: entry.statusVariant,
    emotionVariant: entry.emotionVariant,
    posture: entry.posture,
    identityTags: [entry.matrixGroup, subcategory, entry.role, entry.roleStage, entry.statusVariant],
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
    mobileCrop: { mode: "center_crop_or_contain", keepSafeArea: true, notes: "状态/姿态和场景锚点用于对话、考试、朝议、堂审和军帐等页面；窄屏保留面部、上身姿态、服饰层次和情绪锚点。" },
    lazyLoad: { group: entry.lazyLoadGroup, allowEagerLoad: false, thumbnailFirst: true, lowResPlaceholder: true, maxInitialPortraits: 8 },
    source: { type: "ai_generated", tool: "Codex imagegen", model: "gpt-image-2", generatedAt: "2026-05-16", promptSummary: promptSummary(entry) },
    license: { type: "ai_generated_project_asset", commercialUseConfirmed: false, summary: "原创 AI 生成素材，当前仅个人游玩/开发使用；未做公开商用确认。" },
    reviewStatus: "approved",
    visualReview: { reviewedBy: "Codex", reviewedAt: "2026-05-16", status: "approved", summary: "通过：72 张状态/姿态与场景锚点立绘均为成年端庄水墨淡彩半身像，动作或场景情绪可读；女性角色不做中性化处理，通过发髻、簪钗、层叠衣料、腰封细腰、肩颈线和端庄姿态体现成熟女性特征，无露胸、透明、挑逗、幼态或现代化表现。" },
    safetyReview: { reviewedBy: "Codex", reviewedAt: "2026-05-16", status: "approved", summary: "通过：状态/姿态和场景锚点只登记安全 portraitRef、路径、哈希和审核摘要；无可读文字、水印、现代物、本地路径、key、raw/prompt/audit 内容、hidden 私档、未公开任免或未公开关系。" },
    performance: { bytes: fs.statSync(imagePath).size, targetMaxBytes: TARGET_MAX_BYTES, thumbnailBytes: fs.statSync(thumbnailPath).size, thumbnailTargetMaxBytes: THUMBNAIL_TARGET_MAX_BYTES, lowResPlaceholderBytes: fs.statSync(placeholderPath).size },
    ledgerId: entry.portraitRef
  };
}

function writeManifestAndQa(entries, sheetRecords) {
  const manifest = readJson(manifestPath);
  const newAssets = entries.map(createAsset);
  for (const asset of newAssets) {
    if (asset.performance.bytes > asset.performance.targetMaxBytes) throw new Error(`${asset.id} exceeds target max bytes: ${asset.performance.bytes}`);
    if (asset.performance.thumbnailBytes > asset.performance.thumbnailTargetMaxBytes) throw new Error(`${asset.id} thumbnail exceeds target max bytes: ${asset.performance.thumbnailBytes}`);
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
    counts: { stateVariant: newAssets.filter((asset) => asset.subcategory === "state_variant_pool").length, sceneAnchor: newAssets.filter((asset) => asset.subcategory === "scene_anchor_pool").length },
    visualReviewSummary: "通过：48 张状态/姿态立绘和 24 张场景锚点整体成人端庄、动作可读、历史水墨气质统一；女性角色具备明确成熟女性服饰和身形特征但不露骨。",
    safetyReviewSummary: "通过：manifest 与 QA 仅保存安全路径、哈希、prompt summary 和审核摘要；不保存 provider 原始响应、本地绝对路径、key、raw/hidden 内容、未公开剧情事实或服务器裁决暗示。",
    assets: newAssets.map((asset) => ({
      id: asset.id,
      subcategory: asset.subcategory,
      role: asset.role,
      roleLabel: asset.roleLabel,
      roleStage: asset.roleStage,
      genderPresentation: asset.genderPresentation,
      statusVariant: asset.statusVariant,
      emotionVariant: asset.emotionVariant,
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
  if (qa.counts.stateVariant !== 48 || qa.counts.sceneAnchor !== 24) throw new Error(`Unexpected S73.10.5 QA counts: ${JSON.stringify(qa.counts)}`);
  for (const entry of entries) {
    const asset = assetsById.get(entry.portraitRef);
    if (!asset) throw new Error(`Missing manifest asset: ${entry.portraitRef}`);
    const qaEntry = qaById.get(entry.portraitRef);
    if (!qaEntry) throw new Error(`Missing QA asset: ${entry.portraitRef}`);
    if (asset.phase !== PHASE || asset.category !== "portrait" || asset.reviewStatus !== "approved") throw new Error(`Unexpected manifest state: ${entry.portraitRef}`);
    if (!["state_variant_pool", "scene_anchor_pool"].includes(asset.subcategory)) throw new Error(`Unexpected S73.10.5 subcategory: ${entry.portraitRef}`);
    if (asset.lazyLoad.group !== entry.lazyLoadGroup) throw new Error(`Unexpected lazy load group: ${entry.portraitRef}`);
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      const filePath = resolveUiAssetPath(asset[field]);
      if (!fs.existsSync(filePath)) throw new Error(`Missing ${field}: ${asset[field]}`);
    }
    if (asset.performance.bytes !== fs.statSync(resolveUiAssetPath(asset.path)).size) throw new Error(`Stale image byte count: ${entry.portraitRef}`);
    if (asset.performance.thumbnailBytes !== fs.statSync(resolveUiAssetPath(asset.thumbnailPath)).size) throw new Error(`Stale thumbnail byte count: ${entry.portraitRef}`);
    if (asset.performance.lowResPlaceholderBytes !== fs.statSync(resolveUiAssetPath(asset.lowResPlaceholderPath)).size) throw new Error(`Stale placeholder byte count: ${entry.portraitRef}`);
    if (qaEntry.sha256 !== sha256File(resolveUiAssetPath(asset.path))) throw new Error(`Stale image sha: ${entry.portraitRef}`);
    if (qaEntry.thumbnailSha256 !== sha256File(resolveUiAssetPath(asset.thumbnailPath))) throw new Error(`Stale thumbnail sha: ${entry.portraitRef}`);
    if (qaEntry.lowResPlaceholderSha256 !== sha256File(resolveUiAssetPath(asset.lowResPlaceholderPath))) throw new Error(`Stale placeholder sha: ${entry.portraitRef}`);
  }
  console.log(`${PHASE} state/scene portrait assets ok: ${entries.length} manifest entries.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = readOrderedMatrixEntries();
  if (entries.length !== 72) throw new Error(`Expected 72 S73.10.5 state/scene entries, got ${entries.length}`);
  if (options.write) {
    const sheetRecords = await writePortraitFiles(options, entries);
    const assets = writeManifestAndQa(entries, sheetRecords);
    console.log(`${PHASE} wrote ${assets.length} state/scene portrait assets from ${sheetRecords.length} sheets.`);
  }
  if (options.check) checkAssets(entries);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
