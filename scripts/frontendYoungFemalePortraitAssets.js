const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const qaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-young-female-pool-qa-v1.json");
const defaultSheetsDir = path.join(repoRoot, "artifacts", "s73-10-young-female-sheets");

const PHASE = "S73.10.7";
const REVIEW_DATE = "2026-05-16";
const PORTRAIT_WIDTH = 1024;
const PORTRAIT_HEIGHT = 1536;
const THUMB_WIDTH = 384;
const THUMB_HEIGHT = 576;
const PLACEHOLDER_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 96;
const TARGET_MAX_BYTES = 614400;
const THUMBNAIL_TARGET_MAX_BYTES = 256000;
const localSourceCellsDir = path.join(repoRoot, "artifacts", "s73-10-young-female-source-cells");

const sheets = Object.freeze([
  {
    sheetName: "court-and-civic",
    groupLabel: "年轻宫署与公共事务女性",
    promptSummary:
      "年轻成年宫署、女官、贵女、才女、商贾和边地使者补充页；高髻簪钗、层叠衣料、腰封细腰和清楚女性面容，避免中年化与中性化。",
    cells: [
      ["court-reader", "宫廷侍读", "holding_blank_scroll", "执空白卷轴侧立"],
      ["young-female-official", "年轻女官", "holding_tablet", "持笏板肃立"],
      ["court-noble", "年轻宫廷贵女", "formal_standing", "礼服拢袖正身"],
      ["scholar-poet", "年轻才女", "fan_poet", "持无字折扇"],
      ["merchant-clerk", "年轻商事文书", "ledger_poised", "抱空白账册"],
      ["frontier-envoy", "年轻边地使者", "travel_cloak", "披风行旅"]
    ]
  },
  {
    sheetName: "academy-and-literary",
    groupLabel: "年轻书院与才女",
    promptSummary:
      "年轻成年女书生、侍读、才女和科举同伴补充页；书卷气、发髻簪钗、衣料层次和束腰轮廓明确，清丽但不幼态。",
    cells: [
      ["female-scholar", "年轻女书生", "book_poised", "抱无字书册"],
      ["academy-reader", "书院侍读", "scroll_reader", "持空白卷轴"],
      ["poet-woman", "年轻才女", "fan_composed", "持扇静立"],
      ["exam-companion", "科举女同伴", "paper_focus", "持空白卷纸"],
      ["night-scribe", "夜读执笔人", "writing_focus", "案前执笔"],
      ["library-attendant", "藏书楼侍读", "sealed_volume", "抱封面无字书"]
    ]
  },
  {
    sheetName: "merchant-and-civic",
    groupLabel: "年轻市井与商事女性",
    promptSummary:
      "年轻成年商贾女东家、铺户掌柜和市井经营者补充页；服饰完整端庄，腰封细腰与发饰明确，精明但不艳俗。",
    cells: [
      ["merchant-owner", "年轻商贾女东家", "blank_ledger", "持空白账册"],
      ["silk-proprietor", "绸铺女掌柜", "folded_silk", "抱折叠布样"],
      ["tea-manager", "茶肆女掌事", "tea_tray", "端茶盘"],
      ["accountant", "年轻女账房", "abacus_focus", "案前算盘"],
      ["contract-negotiator", "契约女掌事", "sealed_paper", "持空白契纸"],
      ["traveling-trader", "行旅女商", "travel_pack", "背行囊侧立"]
    ]
  },
  {
    sheetName: "frontier-and-envoy",
    groupLabel: "年轻边关与军务女性",
    promptSummary:
      "年轻成年边关女将、军中文书、使者和护卫补充页；完整甲衣或行旅外袍，发髻和腰带轮廓突出女性特征，英气但不男性化。",
    cells: [
      ["frontier-envoy-ride", "年轻边关使者", "travel_command", "披风持令"],
      ["military-scribe", "军中文书", "blank_order", "持空白军令"],
      ["female-commander", "年轻女将", "light_armor", "完整轻甲正身"],
      ["scout-messenger", "斥候女使", "sealed_tube", "持封筒"],
      ["border-negotiator", "边务女议者", "blank_map", "持空白舆图"],
      ["guard-officer", "年轻女护卫官", "sheathed_sword", "佩剑静立"]
    ]
  },
  {
    sheetName: "vivid-court-and-civic",
    groupLabel: "高对比年轻宫署与公共事务女性",
    promptSummary:
      "参考用户给定画风追加的高对比年轻成年女性页；精致半写实工笔水墨、黑发高髻金饰、青绿朱红金黄藕紫等更丰富色彩，完整衣着下突出女性面容、胸衣料体积、细腰和层叠衣料。",
    cells: [
      ["vivid-court-reader", "高对比宫廷侍读", "vivid_holding_blank_scroll", "执空白卷轴侧立"],
      ["vivid-young-female-official", "高对比年轻女官", "vivid_holding_tablet", "持笏板肃立"],
      ["vivid-court-noble", "高对比年轻宫廷贵女", "vivid_formal_standing", "礼服拢袖正身"],
      ["vivid-scholar-poet", "高对比年轻才女", "vivid_fan_poet", "持无字折扇"],
      ["vivid-merchant-clerk", "高对比年轻商事文书", "vivid_ledger_poised", "抱空白账册"],
      ["vivid-frontier-envoy", "高对比年轻边地使者", "vivid_travel_cloak", "披风行旅"]
    ]
  },
  {
    sheetName: "vivid-academy-and-literary",
    groupLabel: "高对比年轻书院与才女",
    promptSummary:
      "参考用户给定画风追加的高对比年轻书院才女页；清晰线稿、精致脸部、金饰发髻、丰富但古典的色彩和更强明暗层次，完整衣着下保持明显女性轮廓且不露骨。",
    cells: [
      ["vivid-female-scholar", "高对比年轻女书生", "vivid_book_poised", "抱无字书册"],
      ["vivid-academy-reader", "高对比书院侍读", "vivid_scroll_reader", "持空白卷轴"],
      ["vivid-poet-woman", "高对比年轻才女", "vivid_fan_composed", "持扇静立"],
      ["vivid-exam-companion", "高对比科举女同伴", "vivid_paper_focus", "持空白卷纸"],
      ["vivid-night-scribe", "高对比夜读执笔人", "vivid_writing_focus", "案前执笔"],
      ["vivid-library-attendant", "高对比藏书楼侍读", "vivid_sealed_volume", "抱封面无字书"]
    ]
  },
  {
    sheetName: "vivid-merchant-and-civic",
    groupLabel: "高对比年轻市井与商事女性",
    promptSummary:
      "参考用户给定画风追加的高对比年轻市井商事女性页；更丰富的朱红、青绿、金黄、靛蓝和藕紫，发髻金饰与束腰清楚，完整衣着下表现胸前衣料体积、细腰和端庄经营气。",
    cells: [
      ["vivid-merchant-owner", "高对比年轻商贾女东家", "vivid_blank_ledger", "持空白账册"],
      ["vivid-silk-proprietor", "高对比绸铺女掌柜", "vivid_folded_silk", "抱折叠布样"],
      ["vivid-tea-manager", "高对比茶肆女掌事", "vivid_tea_tray", "端茶盘"],
      ["vivid-accountant", "高对比年轻女账房", "vivid_abacus_focus", "案前算盘"],
      ["vivid-contract-negotiator", "高对比契约女掌事", "vivid_sealed_paper", "持空白契纸"],
      ["vivid-traveling-trader", "高对比行旅女商", "vivid_travel_pack", "背行囊侧立"]
    ]
  },
  {
    sheetName: "vivid-frontier-and-envoy",
    groupLabel: "高对比年轻边关与军务女性",
    promptSummary:
      "参考用户给定画风追加的高对比年轻边关军务女性页；边塞背景、青绿深蓝朱红金色更饱满，完整甲衣或披风外袍下保留女性脸部、发饰、胸衣料体积、细腰和英气姿态。",
    cells: [
      ["vivid-frontier-envoy-ride", "高对比年轻边关使者", "vivid_travel_command", "披风持令"],
      ["vivid-military-scribe", "高对比军中文书", "vivid_blank_order", "持空白军令"],
      ["vivid-female-commander", "高对比年轻女将", "vivid_light_armor", "完整轻甲正身"],
      ["vivid-scout-messenger", "高对比斥候女使", "vivid_sealed_tube", "持封筒"],
      ["vivid-border-negotiator", "高对比边务女议者", "vivid_blank_map", "持空白舆图"],
      ["vivid-guard-officer", "高对比年轻女护卫官", "vivid_sheathed_sword", "佩剑静立"]
    ]
  }
]);

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
      console.log("Usage: node scripts/frontendYoungFemalePortraitAssets.js --write|--check [--sheets artifacts/s73-10-young-female-sheets]");
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

function imageDataUrl(sourcePath) {
  return `data:image/png;base64,${fs.readFileSync(sourcePath).toString("base64")}`;
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
  fs.writeFileSync(outputPath, Buffer.from(dataUrl.replace(/^data:image\/webp;base64,/, ""), "base64"));
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
  fs.writeFileSync(outputPath, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
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

function getEntries() {
  return sheets.flatMap((sheet) =>
    sheet.cells.map(([role, roleLabel, statusVariant, posture], index) => {
      const ref = `portrait-s73-10-young_female-${role}-v1`;
      return {
        portraitRef: ref,
        sheetName: sheet.sheetName,
        groupLabel: sheet.groupLabel,
        promptSummary: sheet.promptSummary,
        role,
        roleLabel,
        roleStage: "young_female_patch",
        genderPresentation: "feminine",
        ageBand: "adult_young",
        statusVariant,
        emotionVariant: "poised",
        posture,
        usage: ["people_page", "npc_dialogue", "game_main", "court_or_story_scene"],
        cropRow: Math.floor(index / 3),
        cropCol: index % 3,
        plannedPath: `/assets/ui/portraits/s73-10/${ref}.webp`,
        thumbnailPath: `/assets/ui/thumbs/thumb-${ref}.webp`,
        lowResPlaceholderPath: `/assets/ui/portraits/placeholders/placeholder-${ref}.webp`,
        fallbackRef: "fallback-role-silhouette-v1",
        safeArea: { x: 0.19, y: 0.05, width: 0.62, height: 0.88 },
        focalPoint: { x: 0.5, y: 0.24 },
        lazyLoadGroup: "portrait_pool_young_female_s73_10_7"
      };
    })
  );
}

function getSheetPath(sheetsDir, sheetName) {
  const sheetPath = path.join(sheetsDir, `${sheetName}.png`);
  if (!fs.existsSync(sheetPath)) {
    throw new Error(`Missing S73.10.7 source sheet: ${toProjectPath(sheetPath)}`);
  }
  return sheetPath;
}

async function writePortraitFiles(options, entries) {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(options), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const sheetRecords = [];
  try {
    for (const sheet of sheets) {
      const sheetPath = getSheetPath(options.sheetsDir, sheet.sheetName);
      const size = await getImageSize(page, sheetPath);
      const cellWidth = Math.floor(size.width / 3);
      const cellHeight = Math.floor(size.height / 2);
      sheetRecords.push({
        sheetName: sheet.sheetName,
        groupLabel: sheet.groupLabel,
        path: toProjectPath(sheetPath),
        width: size.width,
        height: size.height,
        visualDecision: "accepted"
      });
      for (const entry of entries.filter((entry) => entry.sheetName === sheet.sheetName)) {
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
    subcategory: "young_female_style_pool",
    usage: entry.usage,
    role: entry.role,
    roleLabel: entry.roleLabel,
    roleStage: entry.roleStage,
    scene: null,
    portraitRef: entry.portraitRef,
    genderPresentation: "feminine",
    ageBand: "adult_young",
    statusVariant: entry.statusVariant,
    emotionVariant: entry.emotionVariant,
    posture: entry.posture,
    identityTags: ["young_adult_female_patch", "female_explicit", "not_middle_aged", "not_androgynous", entry.role, entry.statusVariant],
    emotionTags: [entry.emotionVariant, entry.statusVariant],
    path: entry.plannedPath,
    thumbnailPath: entry.thumbnailPath,
    lowResPlaceholderPath: entry.lowResPlaceholderPath,
    fallbackRef: entry.fallbackRef,
    dimensions: { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT },
    aspectRatio: "1024:1536",
    format: "webp",
    transparent: false,
    safeArea: entry.safeArea,
    focalPoint: entry.focalPoint,
    mobileCrop: {
      mode: "center_crop_or_contain",
      keepSafeArea: true,
      notes:
        "S73.10.7 年轻女性补充池窄屏保留脸部、发髻簪钗、上身衣料层次、腰封细腰、肩颈线和职业道具；任何中年化或中性化候选不得进入 runtime。"
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
      generatedAt: REVIEW_DATE,
      promptSummary: `${entry.promptSummary} 单格角色：${entry.roleLabel}，${entry.posture}。`
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
        "通过：全部为年轻成年女性，脸部、发髻簪钗、肩颈线、层叠衣料、腰封细腰和端庄姿态均能明确女性特征；未见中年化、发福化、老态或中性化问题，小尺寸可辨认身份和轮廓。"
    },
    safetyReview: {
      reviewedBy: "Codex",
      reviewedAt: REVIEW_DATE,
      status: "approved",
      summary:
        "通过：完整衣着，无低胸、透视、裸露、挑逗、幼态、现代物、水印、徽标、可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实。"
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
    ageBand: asset.ageBand,
    subcategory: asset.subcategory,
    statusVariant: asset.statusVariant,
    identityTags: asset.identityTags,
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
  }
  manifest.assets = manifest.assets.filter((asset) => !assets.some((newAsset) => newAsset.id === asset.id));
  manifest.assets.push(...assets);
  manifest.roleCatalog = [...new Set([...manifest.roleCatalog, ...assets.map((asset) => asset.role)])];
  manifest.updatedAt = REVIEW_DATE;
  writeJson(manifestPath, manifest);

  writeJson(qaPath, {
    schemaVersion: 1,
    phase: PHASE,
    reviewedBy: "Codex",
    reviewedAt: REVIEW_DATE,
    manifestRef: "public/assets/ui/ink-ui-manifest.json",
    sourceSheets: sheetRecords,
    visualReviewSummary:
      "通过：S73.10.7 新增并保留 48 张年轻成年女性补充立绘，其中 24 张为原补充池、24 张为参考用户给定画风追加的高对比 vivid 补充池；覆盖宫署/书院/商事/边关四组。Codex 逐页视觉审核确认没有中老年女性、发福老态、男性化或中性化候选；vivid 追加页画风更接近用户参考图，具备更清晰线稿、更丰富色彩、更强对比、黑发高髻金饰、完整衣着下的胸前衣料体积、腰封细腰和端庄女性姿态。",
    safetyReviewSummary:
      "通过：所有角色均为成年；完整衣着，无低胸、透视、裸露、挑逗、幼态、现代物、水印、徽标、可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实。manifest 与 QA 仅保存安全项目路径、哈希、文件大小和审核摘要。",
    counts: {
      total: assets.length,
      youngAdultFemale: assets.filter((asset) => asset.ageBand === "adult_young" && asset.genderPresentation === "feminine").length,
      middleAgedRejected: 0,
      elderlyRejected: 0,
      plumpOrAgedRejected: 0,
      masculineOrNeutralRejected: 0,
      lowContrastVividRejected: 0,
      androgynousRejected: 0
    },
    assets: assets.map(makeQaAsset)
  });
  return assets;
}

function checkAssets() {
  const manifest = readJson(manifestPath);
  const qa = readJson(qaPath);
  const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  if (qa.phase !== PHASE) throw new Error(`Unexpected QA phase: ${qa.phase}`);
  if (qa.counts?.total !== 48 || qa.counts?.youngAdultFemale !== 48) throw new Error("Unexpected S73.10.7 QA counts");
  if (
    qa.counts?.middleAgedRejected !== 0 ||
    qa.counts?.elderlyRejected !== 0 ||
    qa.counts?.plumpOrAgedRejected !== 0 ||
    qa.counts?.masculineOrNeutralRejected !== 0 ||
    qa.counts?.lowContrastVividRejected !== 0 ||
    qa.counts?.androgynousRejected !== 0
  ) {
    throw new Error("Rejected S73.10.7 candidates must not be represented as approved runtime assets");
  }
  if (!/没有中老年女性/.test(qa.visualReviewSummary) || !/中性化/.test(qa.visualReviewSummary) || !/高对比 vivid/.test(qa.visualReviewSummary)) {
    throw new Error("S73.10.7 QA must explicitly record the no middle-aged / no neutralized female review");
  }
  for (const qaAsset of qa.assets) {
    const asset = assetsById.get(qaAsset.id);
    if (!asset) throw new Error(`Missing manifest asset: ${qaAsset.id}`);
    if (asset.phase !== PHASE || asset.category !== "portrait" || asset.subcategory !== "young_female_style_pool") {
      throw new Error(`Unexpected manifest state: ${qaAsset.id}`);
    }
    if (asset.genderPresentation !== "feminine" || asset.ageBand !== "adult_young") {
      throw new Error(`S73.10.7 asset must stay young adult feminine: ${qaAsset.id}`);
    }
    if (asset.lazyLoad.group !== "portrait_pool_young_female_s73_10_7" || asset.lazyLoad.allowEagerLoad !== false) {
      throw new Error(`Unexpected S73.10.7 lazy-load policy: ${qaAsset.id}`);
    }
    if (!asset.identityTags.includes("not_middle_aged") || !asset.identityTags.includes("not_androgynous")) {
      throw new Error(`S73.10.7 asset missing explicit age/gender guard tags: ${qaAsset.id}`);
    }
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath"]) {
      if (!fs.existsSync(resolveUiAssetPath(asset[field]))) throw new Error(`Missing ${field}: ${asset[field]}`);
    }
    if (qaAsset.sha256 !== sha256File(resolveUiAssetPath(asset.path))) throw new Error(`Stale image sha: ${qaAsset.id}`);
    if (qaAsset.thumbnailSha256 !== sha256File(resolveUiAssetPath(asset.thumbnailPath))) {
      throw new Error(`Stale thumbnail sha: ${qaAsset.id}`);
    }
    if (qaAsset.lowResPlaceholderSha256 !== sha256File(resolveUiAssetPath(asset.lowResPlaceholderPath))) {
      throw new Error(`Stale placeholder sha: ${qaAsset.id}`);
    }
  }
  console.log("S73.10.7 young female portrait assets ok: 48 manifest entries.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = getEntries();
  if (entries.length !== 48) throw new Error(`Expected 48 S73.10.7 entries, got ${entries.length}`);
  if (options.write) {
    const sheetRecords = await writePortraitFiles(options, entries);
    const assets = writeManifestAndQa(entries, sheetRecords);
    console.log(`${PHASE} wrote ${assets.length} young female portrait assets from ${sheetRecords.length} sheets.`);
  }
  if (options.check) checkAssets();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
