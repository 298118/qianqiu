const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const manifestPath = path.join(rootDir, "public", "assets", "ui", "ink-ui-manifest.json");
const defaultReportPath = path.join(
  rootDir,
  "public",
  "assets",
  "ui",
  "portraits",
  "portrait-compression-qa-v1.json"
);

const PORTRAIT_IMAGE_WIDTH = 1024;
const PORTRAIT_IMAGE_HEIGHT = 1536;
const THUMBNAIL_WIDTH = 384;
const THUMBNAIL_HEIGHT = 576;
const PLACEHOLDER_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 96;
const MAX_INITIAL_PORTRAITS = 8;
const PLACEHOLDER_TARGET_MAX_BYTES = 8192;

const s7310Phases = new Set(["S73.10.2", "S73.10.3", "S73.10.4", "S73.10.5"]);
const forbiddenSecretOrLocalPath =
  /(OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/]|file:\/\/|https?:\/\/|data:|data[\\/](?:sessions|audit))/i;
const forbiddenAssetValue =
  /(world_sessions|prompt_retrieval_index|event_log|hiddenNotes|hiddenIntent|raw[_ -]?(?:table|prompt|provider|audit|coordinate)|完整 prompt 原文：)/i;

function parseArgs(argv) {
  const options = {
    check: false,
    write: false,
    reportPath: defaultReportPath
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--write") options.write = true;
    else if (arg === "--report") {
      options.reportPath = path.resolve(rootDir, argv[index + 1]);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.check && !options.write) options.check = true;
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/frontendPortraitCompressionQa.js --check
  node scripts/frontendPortraitCompressionQa.js --write

Options:
  --check        Validate the committed S73.10.6 portrait compression report.
  --write        Regenerate public/assets/ui/portraits/portrait-compression-qa-v1.json.
  --report       Optional report path. Defaults to public/assets/ui/portraits/portrait-compression-qa-v1.json.`);
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
  if (typeof assetPath !== "string" || assetPath.length === 0) {
    issues.push(errorIssue(fieldName, "路径字段必须是非空字符串"));
    return false;
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
  return assetPath.startsWith("/assets/ui/") && !assetPath.includes("..") && !forbiddenSecretOrLocalPath.test(assetPath);
}

function resolveUiAssetPath(assetPath) {
  return path.join(rootDir, "public", assetPath.replace(/^\//, ""));
}

function collectForbiddenValueIssues(value, label, issues) {
  if (value == null) return;
  if (typeof value === "string") {
    if (forbiddenSecretOrLocalPath.test(value) || forbiddenAssetValue.test(value)) {
      issues.push(errorIssue(label, "字段包含本地路径、密钥、raw/hidden 或内部表名形状"));
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
  const buffer = fs.readFileSync(filePath);
  if (filePath.endsWith(".webp")) return readWebpInfo(buffer);
  throw new Error(`Unsupported portrait image type: ${filePath}`);
}

function errorIssue(assetId, message) {
  return { severity: "error", assetId, message };
}

function warnIssue(assetId, message) {
  return { severity: "warning", assetId, message };
}

function countBy(items, selector) {
  return items.reduce((counts, item) => {
    const key = selector(item) || "(missing)";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function validateUnitNumber(value, label, assetId, issues) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
    issues.push(errorIssue(assetId, `${label} 必须是 0..1 范围内的数字`));
    return false;
  }
  return true;
}

function validateUnitRect(rect, assetId, issues) {
  if (!rect || typeof rect !== "object") {
    issues.push(errorIssue(assetId, "safeArea 必须是对象"));
    return;
  }
  const ok =
    validateUnitNumber(rect.x, "safeArea.x", assetId, issues) &&
    validateUnitNumber(rect.y, "safeArea.y", assetId, issues) &&
    validateUnitNumber(rect.width, "safeArea.width", assetId, issues) &&
    validateUnitNumber(rect.height, "safeArea.height", assetId, issues);
  if (!ok) return;
  if (rect.width <= 0 || rect.height <= 0) {
    issues.push(errorIssue(assetId, "safeArea 宽高必须大于 0"));
  }
  if (rect.x + rect.width > 1.001 || rect.y + rect.height > 1.001) {
    issues.push(errorIssue(assetId, "safeArea 不得越出图片边界"));
  }
}

function validateFocalPoint(focalPoint, assetId, issues) {
  if (!focalPoint || typeof focalPoint !== "object") {
    issues.push(errorIssue(assetId, "focalPoint 必须是对象"));
    return;
  }
  validateUnitNumber(focalPoint.x, "focalPoint.x", assetId, issues);
  validateUnitNumber(focalPoint.y, "focalPoint.y", assetId, issues);
}

function validateMobileCrop(mobileCrop, assetId, issues) {
  if (!mobileCrop || typeof mobileCrop !== "object") {
    issues.push(errorIssue(assetId, "mobileCrop 必须是对象"));
    return;
  }
  if (typeof mobileCrop.mode !== "string" || mobileCrop.mode.length < 4) {
    issues.push(errorIssue(assetId, "mobileCrop.mode 必须写明裁切策略"));
  }
  if (mobileCrop.keepSafeArea !== true) {
    issues.push(errorIssue(assetId, "mobileCrop 必须声明 keepSafeArea=true"));
  }
}

function validateLazyLoad(lazyLoad, assetId, issues) {
  if (!lazyLoad || typeof lazyLoad !== "object") {
    issues.push(errorIssue(assetId, "lazyLoad 必须是对象"));
    return;
  }
  if (typeof lazyLoad.group !== "string" || lazyLoad.group.length < 4) {
    issues.push(errorIssue(assetId, "lazyLoad.group 必须是稳定分组"));
  }
  if (lazyLoad.allowEagerLoad !== false) issues.push(errorIssue(assetId, "立绘不得允许 eager load"));
  if (lazyLoad.thumbnailFirst !== true) issues.push(errorIssue(assetId, "立绘必须声明 thumbnailFirst=true"));
  if (lazyLoad.lowResPlaceholder !== true) issues.push(errorIssue(assetId, "立绘必须声明 lowResPlaceholder=true"));
  if (lazyLoad.maxInitialPortraits !== MAX_INITIAL_PORTRAITS) {
    issues.push(errorIssue(assetId, `maxInitialPortraits 必须固定为 ${MAX_INITIAL_PORTRAITS}`));
  }
}

function validateImageFile(asset, kind, filePath, expected, issues) {
  const record = {
    path: expected.manifestPath,
    exists: fs.existsSync(filePath)
  };
  if (!record.exists) {
    issues.push(errorIssue(asset.id, `${kind} 文件不存在`));
    return record;
  }

  record.bytes = fs.statSync(filePath).size;
  record.sha256 = sha256File(filePath);
  record.dimensions = readImageInfo(filePath);

  if (record.dimensions.width !== expected.width || record.dimensions.height !== expected.height) {
    issues.push(
      errorIssue(asset.id, `${kind} 尺寸应为 ${expected.width}x${expected.height}，实际为 ${record.dimensions.width}x${record.dimensions.height}`)
    );
  }
  if (expected.alpha != null && record.dimensions.alpha !== expected.alpha) {
    issues.push(errorIssue(asset.id, `${kind} alpha 与 manifest 不一致`));
  }
  if (expected.maxBytes && record.bytes > expected.maxBytes) {
    issues.push(errorIssue(asset.id, `${kind} 超过文件预算 ${expected.maxBytes}`));
  }
  return record;
}

function buildPortraitRecord(asset) {
  const issues = [];
  collectForbiddenValueIssues(asset, `assets.${asset.id}`, issues);
  const safePathOk = assertSafeUiAssetPath(asset.path, `${asset.id}.path`, issues);
  const thumbPathOk = assertSafeUiAssetPath(asset.thumbnailPath, `${asset.id}.thumbnailPath`, issues);
  const placeholderPathOk = assertSafeUiAssetPath(asset.lowResPlaceholderPath, `${asset.id}.lowResPlaceholderPath`, issues);

  validateUnitRect(asset.safeArea, asset.id, issues);
  validateFocalPoint(asset.focalPoint, asset.id, issues);
  validateMobileCrop(asset.mobileCrop, asset.id, issues);
  validateLazyLoad(asset.lazyLoad, asset.id, issues);

  if (asset.portraitRef !== asset.id) issues.push(errorIssue(asset.id, "portraitRef 必须等于 manifest id"));
  if (asset.transparent !== false) issues.push(errorIssue(asset.id, "当前立绘池必须是不透明 WebP"));
  if (asset.dimensions?.width !== PORTRAIT_IMAGE_WIDTH || asset.dimensions?.height !== PORTRAIT_IMAGE_HEIGHT) {
    issues.push(errorIssue(asset.id, `主图 manifest 尺寸必须是 ${PORTRAIT_IMAGE_WIDTH}x${PORTRAIT_IMAGE_HEIGHT}`));
  }
  if (!asset.performance || typeof asset.performance !== "object") {
    issues.push(errorIssue(asset.id, "缺少 performance 文件预算"));
  }

  const files = {};
  if (safePathOk) {
    files.image = validateImageFile(
      asset,
      "主图",
      resolveUiAssetPath(asset.path),
      {
        manifestPath: asset.path,
        width: PORTRAIT_IMAGE_WIDTH,
        height: PORTRAIT_IMAGE_HEIGHT,
        alpha: asset.transparent,
        maxBytes: asset.performance?.targetMaxBytes
      },
      issues
    );
    if (files.image.bytes && asset.performance?.bytes !== files.image.bytes) {
      issues.push(errorIssue(asset.id, "performance.bytes 与主图文件大小不一致"));
    }
  }

  if (thumbPathOk) {
    files.thumbnail = validateImageFile(
      asset,
      "缩略图",
      resolveUiAssetPath(asset.thumbnailPath),
      {
        manifestPath: asset.thumbnailPath,
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
        alpha: false,
        maxBytes: asset.performance?.thumbnailTargetMaxBytes
      },
      issues
    );
    if (files.thumbnail.bytes && asset.performance?.thumbnailBytes !== files.thumbnail.bytes) {
      issues.push(errorIssue(asset.id, "performance.thumbnailBytes 与缩略图文件大小不一致"));
    }
  }

  if (placeholderPathOk) {
    files.lowResPlaceholder = validateImageFile(
      asset,
      "低清占位",
      resolveUiAssetPath(asset.lowResPlaceholderPath),
      {
        manifestPath: asset.lowResPlaceholderPath,
        width: PLACEHOLDER_WIDTH,
        height: PLACEHOLDER_HEIGHT,
        alpha: false,
        maxBytes: PLACEHOLDER_TARGET_MAX_BYTES
      },
      issues
    );
    if (files.lowResPlaceholder.bytes && asset.performance?.lowResPlaceholderBytes !== files.lowResPlaceholder.bytes) {
      issues.push(errorIssue(asset.id, "performance.lowResPlaceholderBytes 与低清占位文件大小不一致"));
    }
  }

  if (files.thumbnail?.bytes && files.image?.bytes && files.thumbnail.bytes >= files.image.bytes) {
    issues.push(warnIssue(asset.id, "缩略图不应大于或等于主图"));
  }
  if (files.lowResPlaceholder?.bytes && files.thumbnail?.bytes && files.lowResPlaceholder.bytes >= files.thumbnail.bytes) {
    issues.push(warnIssue(asset.id, "低清占位不应大于或等于缩略图"));
  }

  return {
    id: asset.id,
    phase: asset.phase,
    subcategory: asset.subcategory,
    portraitRef: asset.portraitRef,
    genderPresentation: asset.genderPresentation,
    ageBand: asset.ageBand,
    role: asset.role,
    statusVariant: asset.statusVariant,
    lazyLoadGroup: asset.lazyLoad?.group || null,
    path: asset.path,
    thumbnailPath: asset.thumbnailPath,
    lowResPlaceholderPath: asset.lowResPlaceholderPath,
    safeArea: asset.safeArea,
    focalPoint: asset.focalPoint,
    mobileCrop: asset.mobileCrop,
    performance: {
      bytes: asset.performance?.bytes,
      targetMaxBytes: asset.performance?.targetMaxBytes,
      thumbnailBytes: asset.performance?.thumbnailBytes,
      thumbnailTargetMaxBytes: asset.performance?.thumbnailTargetMaxBytes,
      lowResPlaceholderBytes: asset.performance?.lowResPlaceholderBytes,
      lowResPlaceholderTargetMaxBytes: PLACEHOLDER_TARGET_MAX_BYTES
    },
    files,
    lazyLoad: asset.lazyLoad,
    issues
  };
}

function buildSummary(records, manifest) {
  const files = records.reduce(
    (totals, record) => {
      totals.imageBytes += record.files.image?.bytes || 0;
      totals.thumbnailBytes += record.files.thumbnail?.bytes || 0;
      totals.lowResPlaceholderBytes += record.files.lowResPlaceholder?.bytes || 0;
      totals.maxImageBytes = Math.max(totals.maxImageBytes, record.files.image?.bytes || 0);
      totals.maxThumbnailBytes = Math.max(totals.maxThumbnailBytes, record.files.thumbnail?.bytes || 0);
      totals.maxLowResPlaceholderBytes = Math.max(totals.maxLowResPlaceholderBytes, record.files.lowResPlaceholder?.bytes || 0);
      return totals;
    },
    {
      imageBytes: 0,
      thumbnailBytes: 0,
      lowResPlaceholderBytes: 0,
      maxImageBytes: 0,
      maxThumbnailBytes: 0,
      maxLowResPlaceholderBytes: 0
    }
  );
  const issues = records.flatMap((record) => record.issues.map((issue) => ({ ...issue, assetId: record.id })));

  return {
    totalActiveAssets: manifest.assets.length,
    portraitAssets: records.length,
    s7310PortraitAssets: records.filter((record) => s7310Phases.has(record.phase)).length,
    baselinePortraitAssets: records.filter((record) => record.phase === "S73.7").length,
    byPhase: countBy(records, (record) => record.phase),
    byLazyLoadGroup: countBy(records, (record) => record.lazyLoadGroup),
    bySubcategory: countBy(records, (record) => record.subcategory),
    imageSize: { width: PORTRAIT_IMAGE_WIDTH, height: PORTRAIT_IMAGE_HEIGHT },
    thumbnailSize: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT },
    lowResPlaceholderSize: { width: PLACEHOLDER_WIDTH, height: PLACEHOLDER_HEIGHT },
    maxInitialPortraits: MAX_INITIAL_PORTRAITS,
    allowEagerLoadViolations: records.filter((record) => record.lazyLoad?.allowEagerLoad !== false).length,
    files,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length
  };
}

function buildReport() {
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  const portraits = manifest.assets.filter((asset) => asset.category === "portrait");
  const records = portraits.map(buildPortraitRecord);
  const summary = buildSummary(records, manifest);

  return {
    schemaVersion: 1,
    phase: "S73.10.6",
    reportId: "portrait-compression-qa-v1",
    generatedAt: new Date().toISOString(),
    manifestRef: "public/assets/ui/ink-ui-manifest.json",
    manifestSha256: sha256Text(manifestText),
    policy: {
      imageSize: { width: PORTRAIT_IMAGE_WIDTH, height: PORTRAIT_IMAGE_HEIGHT },
      thumbnailSize: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT },
      lowResPlaceholderSize: { width: PLACEHOLDER_WIDTH, height: PLACEHOLDER_HEIGHT },
      lowResPlaceholderTargetMaxBytes: PLACEHOLDER_TARGET_MAX_BYTES,
      requireSafeArea: true,
      requireFocalPoint: true,
      requireMobileCropKeepSafeArea: true,
      requireThumbnailFirst: true,
      requireLowResPlaceholder: true,
      allowEagerLoad: false,
      maxInitialPortraits: MAX_INITIAL_PORTRAITS
    },
    summary,
    assets: records,
    issues: records.flatMap((record) => record.issues.map((issue) => ({ ...issue, assetId: record.id })))
  };
}

function validateCommittedReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Missing portrait compression QA report: ${toProjectPath(reportPath)}`);
  }
  const report = readJson(reportPath);
  const current = buildReport();
  const failures = [];

  if (report.schemaVersion !== 1) failures.push("schemaVersion must be 1");
  if (report.phase !== "S73.10.6") failures.push("phase must be S73.10.6");
  if (report.reportId !== "portrait-compression-qa-v1") failures.push("reportId must be portrait-compression-qa-v1");
  if (report.manifestSha256 !== current.manifestSha256) failures.push("manifestSha256 is stale");
  if ((report.assets || []).length !== current.assets.length) failures.push("asset count is stale");

  const reportById = new Map((report.assets || []).map((asset) => [asset.id, asset]));
  if (reportById.size !== (report.assets || []).length) failures.push("report contains duplicate portrait ids");
  for (const asset of current.assets) {
    const entry = reportById.get(asset.id);
    if (!entry) {
      failures.push(`report missing portrait ${asset.id}`);
      continue;
    }
    for (const field of ["path", "thumbnailPath", "lowResPlaceholderPath", "lazyLoadGroup"]) {
      if (entry[field] !== asset[field]) failures.push(`${asset.id} ${field} is stale`);
    }
    for (const fileKind of ["image", "thumbnail", "lowResPlaceholder"]) {
      if (entry.files?.[fileKind]?.sha256 !== asset.files?.[fileKind]?.sha256) {
        failures.push(`${asset.id} ${fileKind} sha256 is stale`);
      }
      if (entry.files?.[fileKind]?.bytes !== asset.files?.[fileKind]?.bytes) {
        failures.push(`${asset.id} ${fileKind} bytes are stale`);
      }
    }
  }
  for (const entry of report.assets || []) {
    if (!current.assets.some((asset) => asset.id === entry.id)) failures.push(`report has stale portrait ${entry.id}`);
  }

  if (report.summary?.portraitAssets !== current.summary.portraitAssets) failures.push("summary.portraitAssets is stale");
  if (report.summary?.s7310PortraitAssets !== current.summary.s7310PortraitAssets) failures.push("summary.s7310PortraitAssets is stale");
  if (report.summary?.errorCount !== 0) failures.push("report contains blocking errors");
  if (report.summary?.allowEagerLoadViolations !== 0) failures.push("report contains eager-load violations");
  if (current.summary.errorCount !== 0) failures.push("current manifest contains blocking portrait compression errors");

  if (failures.length > 0) {
    throw new Error(`S73.10.6 portrait compression QA failed:\n- ${failures.join("\n- ")}`);
  }

  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.write) {
    const report = buildReport();
    fs.writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `Wrote ${toProjectPath(options.reportPath)} (${report.summary.portraitAssets} portraits, ${report.summary.s7310PortraitAssets} S73.10 portraits, ${report.summary.errorCount} errors, ${report.summary.warningCount} warnings)`
    );
    if (report.summary.errorCount > 0) process.exitCode = 1;
  }
  if (options.check) {
    const report = validateCommittedReport(options.reportPath);
    console.log(
      `S73.10.6 portrait compression QA ok: ${report.summary.portraitAssets} portraits, ${report.summary.s7310PortraitAssets} S73.10 portraits, ${report.summary.warningCount} warning(s).`
    );
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
