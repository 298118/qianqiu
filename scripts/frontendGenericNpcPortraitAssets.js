const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const matrixPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-pool-matrix-v1.json");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const qaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-generic-npc-pool-qa-v1.json");
const defaultSheetsDir = path.join(repoRoot, "artifacts", "s73-10-generic-npc-sheets");

const PHASE = "S73.10.3";
const PORTRAIT_WIDTH = 1024;
const PORTRAIT_HEIGHT = 1536;
const THUMB_WIDTH = 384;
const THUMB_HEIGHT = 576;
const PLACEHOLDER_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 96;
const TARGET_MAX_BYTES = 614400;
const THUMBNAIL_TARGET_MAX_BYTES = 256000;
const BONUS_ROLES = Object.freeze(["teacher", "exam-peer", "room-examiner", "chief-examiner"]);
const FEMALE_STYLE_PACKS = Object.freeze([
  { code: "palace-01", role: "palace-lady", roleLabel: "宫装仕女", style: "palace", sourceSheetName: "female-style-palace-01", summary: "高对比宫装组一，色彩更丰富、噪点更少，强调礼制长裙、宽袖、腰封和端庄成年女性比例。" },
  { code: "palace-02", role: "palace-lady", roleLabel: "宫装仕女", style: "palace", sourceSheetName: "female-style-palace-02", summary: "高对比宫装组二，偏深蓝绛紫与金线暗纹，端庄华美但不暴露。" },
  { code: "palace-03", role: "palace-lady", roleLabel: "宫装仕女", style: "palace", sourceSheetName: "female-style-palace-03", summary: "高对比宫装组三，偏浅青、朱红、玉白层次，服饰剪裁和腰封收束更清楚。" },
  { code: "palace-04", role: "palace-lady", roleLabel: "宫装仕女", style: "palace", sourceSheetName: "female-style-palace-04", summary: "高对比宫装组四，宫廷侍读、女官和贵女气质混合，服饰与姿势差异清楚。" },
  { code: "tang-01", role: "tang-lady", roleLabel: "唐装仕女", style: "tang", sourceSheetName: "female-style-tang-01", summary: "高对比唐装组一，襦裙、披帛、短衫长裙和腰带层次清楚，身形苗条。" },
  { code: "tang-02", role: "tang-lady", roleLabel: "唐装仕女", style: "tang", sourceSheetName: "female-style-tang-02", summary: "高对比唐装组二，暖红、青绿、靛蓝更丰富，画面干净，端庄不露胸。" },
  { code: "tang-03", role: "tang-lady", roleLabel: "唐装仕女", style: "tang", sourceSheetName: "female-style-tang-03", summary: "高对比唐装组三，强调行走、持卷、回身、端坐等姿势变化。" },
  { code: "tang-04", role: "tang-lady", roleLabel: "唐装仕女", style: "tang", sourceSheetName: "female-style-tang-04", summary: "高对比唐装组四，唐风贵女、侍读、书写和庭院姿态混合，轮廓更分明。" }
]);
const FEMALE_STYLE_VARIANTS = Object.freeze([
  {
    code: "look01",
    ageBand: "adult_young",
    statusVariant: "female_style_look01",
    emotionVariant: "graceful",
    posture: "执卷侧立",
    summary: "仕女侧立持卷，高对比、少噪点，上身衣料层次完整，腰封收出细腰。"
  },
  {
    code: "look02",
    ageBand: "adult_young",
    statusVariant: "female_style_look02",
    emotionVariant: "composed",
    posture: "捧物肃立",
    summary: "宽袖礼服或华美襦裙，色彩更丰富但古典，上身服饰轮廓端庄清楚，腰身纤细。"
  },
  {
    code: "look03",
    ageBand: "adult_young",
    statusVariant: "female_style_look03",
    emotionVariant: "focused",
    posture: "持册办公",
    summary: "坐姿或执笔读卷，衣褶阴影更清楚，上身服饰层次和细腰在完整衣层下可辨。"
  },
  {
    code: "look04",
    ageBand: "adult_young",
    statusVariant: "female_style_look04",
    emotionVariant: "alert",
    posture: "行走回身",
    summary: "回身或行走姿态，披帛或外袍形成动态轮廓，服饰剪裁和束腰细腰都明确。"
  },
  {
    code: "look05",
    ageBand: "adult_young",
    statusVariant: "female_style_look05",
    emotionVariant: "reserved",
    posture: "拢袖端坐",
    summary: "端坐或拢袖的年轻贵女/女官气质，不显中年，厚衣料层次清楚，腰线收束。"
  },
  {
    code: "look06",
    ageBand: "adult_young",
    statusVariant: "female_style_look06",
    emotionVariant: "poised",
    posture: "持笏回身",
    summary: "礼仪外袍或赴宴装，线条更干净、对比更高，衣料层次自然完整，不露胸不挑逗。"
  }
]);

const rolePromptSummaries = Object.freeze({
  teacher: "塾师或老师，青灰旧衫、书斋窗影和无字旧书，严而不冷。",
  "exam-peer": "同考士子，衣冠整洁带旅尘，书袋或空白试卷，贡院廊柱气息。",
  "room-examiner": "房官阅卷，简素官袍、朱笔和弥封空白卷，灯下小室。",
  "chief-examiner": "主考官，庄重官服、轻按卷宗，考院正堂的定榜压力。",
  magistrate: "县令，地方官常服、印匣签筒和案卷，县衙屏风堂柱。",
  "county-deputy": "县丞佐贰，务实奔忙，账册户籍簿，县署侧厅或廊下。",
  registrar: "典吏书办，青褐衣袍、登记册木牌，档册案房。",
  clerk: "书吏，朴素袖口微卷，磨墨抄写，纸堆墨痕与斜光。",
  constable: "差役捕快，短打外罩公差服，木牌绳索，衙门台阶或街巷。",
  adviser: "幕僚师爷，宽袖长衫，折牍算筹，夜灯侧室里洞察人情。",
  gentry: "士绅，衣料讲究但不奢，茶盏拜帖或族谱，厅堂庭院。",
  merchant: "商贾，暖深袍服、算盘袋或账簿，市楼货箱布匹边角。",
  physician: "医者，素袍药箱、草药包或脉枕，药柜与晾晒药草。",
  "monk-daoist": "僧道，素色僧衣或道袍，念珠拂尘经卷，山门松影而不神怪。",
  courier: "驿卒信使，短袍束袖、文书筒包袱，驿站或雨后官道。",
  "junior-officer": "低阶武官，轻甲戎服、军令牌或佩刀，营门旗影。",
  "border-commander": "边将，风霜厚甲与披风，边塞城墙旌旗远山。",
  "palace-attendant": "宫廷侍从，干净雅致宫服，托盘卷轴或灯盏，宫廊帘影。",
  eunuch: "成熟内侍，整洁衣冠、拂尘奏函或宫牌，内廷门廊，避免奸邪脸谱。",
  "female-official": "女官，挺括层叠官服、腰封袖缘和册牍，宫署书案。",
  commoner: "平民，干净布衣带劳作痕迹，篮筐包袱或布匹，街巷井台。",
  "family-elder": "家族长辈，朴素厚重衣着，拐杖家书或茶盏，祖堂庭院。",
  retainer: "门客随从，介于士人与仆从之间，拜帖匣包裹或随身短杖，府门路旁。",
  censor: "御史言官，清峻官服、奏疏或笏板，冷色朝堂侧影。"
});

const variantSummaries = Object.freeze({
  m01: "成年青年男性，默认状态，衣冠整洁、姿态端正、身份道具清楚。",
  m02: "成年中年男性，工作状态更强，袖口、案卷、尘土或灯影带出职业气。",
  f01: "成年青年女性，端庄清爽，发髻、妆容、肩颈线、上身衣料层次、腰封收出细腰，身形苗条且不暴露。",
  f02: "轻成熟工作状态的成年女性，不显中年不发福，服饰沉稳，层叠衣料与束带收出细腰，不露胸不挑逗。",
  elder01: "年长人物，须发皱纹和衣料厚度体现年岁，收敛有尊严。",
  look01: FEMALE_STYLE_VARIANTS[0].summary,
  look02: FEMALE_STYLE_VARIANTS[1].summary,
  look03: FEMALE_STYLE_VARIANTS[2].summary,
  look04: FEMALE_STYLE_VARIANTS[3].summary,
  look05: FEMALE_STYLE_VARIANTS[4].summary,
  look06: FEMALE_STYLE_VARIANTS[5].summary
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
  node scripts/frontendGenericNpcPortraitAssets.js --write [--sheets artifacts/s73-10-generic-npc-sheets]
  node scripts/frontendGenericNpcPortraitAssets.js --check

The write mode expects one square 3x2 PNG/WebP sheet per generic NPC role, named <role>.png or <role>.webp.
Matrix and bonus sheet order is m01, m02, f01 on the first row; f02, elder01, and one unused blank/reference cell on the second row.
Female style sheet order is look01, look02, look03 on the first row; look04, look05, look06 on the second row.`);
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

function getGenericNpcEntries() {
  const matrix = readJson(matrixPath);
  const entries = matrix.entries.filter((entry) => entry.productionStep === PHASE && entry.matrixGroup === "generic_npc");
  return [...entries, ...createBonusEntries(entries), ...createFemaleExtraEntries(entries)];
}

function createBonusEntries(entries) {
  return BONUS_ROLES.flatMap((role) => {
    const roleEntries = entries.filter((entry) => entry.role === role);
    if (roleEntries.length !== 5) throw new Error(`Expected 5 matrix entries for bonus role ${role}, got ${roleEntries.length}`);
    return roleEntries.map((entry) => {
      const code = variantCode(entry);
      const id = `portrait-s73-10-generic_npc-bonus-${role}-${code}-v1`;
      return {
        ...entry,
        portraitRef: id,
        plannedPath: `/assets/ui/portraits/s73-10/${id}.webp`,
        thumbnailPath: `/assets/ui/thumbs/thumb-${id}.webp`,
        lowResPlaceholderPath: `/assets/ui/portraits/placeholders/placeholder-${id}.webp`,
        sourceSheetName: `bonus-${role}`,
        isBonusGenericNpc: true,
        note: `${entry.roleLabel}通用 NPC 旧版源页补充立绘，不绑定 hidden 私档或未公开剧情事实。`
      };
    });
  });
}

function createFemaleExtraEntries(entries) {
  const baseEntry = entries.find((entry) => entry.role === "female-official" && entry.genderPresentation === "feminine") || entries.find((entry) => entry.genderPresentation === "feminine");
  if (!baseEntry) throw new Error("Missing feminine matrix base entry for female style packs");
  return FEMALE_STYLE_PACKS.flatMap((pack) => {
    return FEMALE_STYLE_VARIANTS.map((variant) => {
      const id = `portrait-s73-10-generic_npc-female-style-${pack.code}-${variant.code}-v1`;
      return {
        ...baseEntry,
        portraitRef: id,
        role: pack.role,
        roleLabel: pack.roleLabel,
        roleStage: "generic_npc_female_style",
        genderPresentation: "feminine",
        ageBand: variant.ageBand,
        statusVariant: variant.statusVariant,
        emotionVariant: variant.emotionVariant,
        posture: variant.posture,
        plannedPath: `/assets/ui/portraits/s73-10/${id}.webp`,
        thumbnailPath: `/assets/ui/thumbs/thumb-${id}.webp`,
        lowResPlaceholderPath: `/assets/ui/portraits/placeholders/placeholder-${id}.webp`,
        sourceSheetName: pack.sourceSheetName,
        femaleStylePack: pack.code,
        femaleStyleKind: pack.style,
        isFemaleExtraGenericNpc: true,
        promptSummaryPrefix: pack.summary,
        note: `${pack.roleLabel}女性风格扩展通用 NPC 立绘，强调成年女性体态、宫装/唐装服饰和姿势差异，不绑定 hidden 私档或未公开剧情事实。`
      };
    });
  });
}

function groupBySourceSheet(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const sheetName = entry.sourceSheetName || entry.role;
    if (!groups.has(sheetName)) groups.set(sheetName, []);
    groups.get(sheetName).push(entry);
  }
  return groups;
}

function variantCode(entry) {
  const match = entry.portraitRef.match(/-(m01|m02|f01|f02|elder01|look01|look02|look03|look04|look05|look06)-v1$/);
  if (!match) throw new Error(`Cannot infer portrait variant: ${entry.portraitRef}`);
  return match[1];
}

function getSheetPath(sheetsDir, sheetName) {
  const pngPath = path.join(sheetsDir, `${sheetName}.png`);
  const webpPath = path.join(sheetsDir, `${sheetName}.webp`);
  if (fs.existsSync(pngPath)) return pngPath;
  if (fs.existsSync(webpPath)) return webpPath;
  throw new Error(`Missing generic NPC portrait sheet for ${sheetName}: expected ${toProjectPath(pngPath)} or ${toProjectPath(webpPath)}`);
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
    for (const [sheetName, roleEntries] of groupBySourceSheet(entries)) {
      const sheetPath = getSheetPath(options.sheetsDir, sheetName);
      const size = await getImageSize(page, sheetPath);
      const cellWidth = Math.floor(size.width / 3);
      const cellHeight = Math.floor(size.height / 2);
      sheetRecords.push({
        sheetName,
        role: roleEntries[0].role,
        bonus: Boolean(roleEntries[0].isBonusGenericNpc),
        path: toProjectPath(sheetPath),
        width: size.width,
        height: size.height
      });
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
    subcategory: "generic_npc_pool",
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
    identityTags: ["generic_npc", entry.role, entry.roleStage, entry.statusVariant, code]
      .concat(entry.isBonusGenericNpc ? ["bonus_generic_npc"] : [])
      .concat(entry.isFemaleExtraGenericNpc ? ["female_extra_generic_npc", "female_style_pack", entry.femaleStyleKind] : []),
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
      notes: "通用 NPC 对话和人物页窄屏保留面部、冠服层次、上身姿态和职业道具；不得把未审核候选图直接显示。"
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
      promptSummary: `${entry.promptSummaryPrefix || rolePromptSummaries[entry.role]} ${variantSummaries[code]}${
        entry.isBonusGenericNpc ? " 旧版源页额外补充入通用 NPC 池。" : ""
      }${
        entry.isFemaleExtraGenericNpc ? " 女性风格扩展池额外补充，重点补宫装与唐装；强调较高对比、较丰富色彩、少噪点、苗条身形、上身服饰层次和束腰细腰。" : ""
      }`
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
      summary: "通过：成人端庄，通用 NPC 的职业身份、年龄层、姿态与水墨宣纸基调清楚；女性扩展池清楚表现成年女性苗条身形、上身服饰层次、束腰细腰、服饰和姿势差异，但不露胸、不暴露、不挑逗；中小尺寸可辨认面部、上身轮廓和主要职业符号。"
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
      "通过：188 张通用 NPC 立绘均为成年端庄水墨淡彩半身像，其中 120 张按 S73.10.3 矩阵生成、20 张旧版源页作为 bonus 补充、48 张女性风格扩展池重点补宫装与唐装；女性扩展角色对比度更高、色彩更丰富、噪点更少，身形苗条、上身服饰层次清楚、腰身收束、服饰与姿势差异清楚，但无露胸、暴露、挑逗、幼态、发福化、滑稽化或神怪化表现。",
    safetyReviewSummary:
      "通过：manifest 与 QA 仅保存安全路径、哈希、prompt summary 和审核摘要；不保存 provider 原始响应、本地绝对路径、key、raw/hidden 内容、未公开剧情事实或服务器裁决暗示。",
    assets: newAssets.map((asset) => ({
      id: asset.id,
      role: asset.role,
      roleLabel: asset.roleLabel,
      roleStage: asset.roleStage,
      bonusGenericNpc: asset.identityTags.includes("bonus_generic_npc"),
      femaleExtraGenericNpc: asset.identityTags.includes("female_extra_generic_npc"),
      femaleStyleKind: asset.identityTags.includes("palace") ? "palace" : asset.identityTags.includes("tang") ? "tang" : null,
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
  const isSingleOverride = (asset) => asset?.source?.localHighResSource === "kept_outside_public_manifest";
  if (qa.assets.length !== entries.length) throw new Error(`Expected ${entries.length} QA assets, got ${qa.assets.length}`);
  for (const entry of entries) {
    const asset = assetsById.get(entry.portraitRef);
    if (!asset) throw new Error(`Missing manifest asset: ${entry.portraitRef}`);
    const qaEntry = qaById.get(entry.portraitRef);
    if (!qaEntry) throw new Error(`Missing QA asset: ${entry.portraitRef}`);
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
    if (isSingleOverride(asset)) {
      continue;
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
  console.log(`${PHASE} generic NPC portrait assets ok: ${entries.length} manifest entries.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = getGenericNpcEntries();
  if (entries.length !== 188) throw new Error(`Expected 188 S73.10.3 generic NPC entries including 20 bonus and 48 female style portraits, got ${entries.length}`);
  if (options.write) {
    const sheetRecords = await writePortraitFiles(options, entries);
    const assets = writeManifestAndQa(entries, sheetRecords);
    console.log(`${PHASE} wrote ${assets.length} generic NPC portrait assets from ${sheetRecords.length} sheets.`);
  }
  if (options.check) checkAssets(entries);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
