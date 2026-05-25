const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const clientBuildDir = path.join(repoRoot, "dist", "client");
const clientAssetsDir = path.join(clientBuildDir, "client-assets");

const CLIENT_BUILD_BUDGETS = Object.freeze({
  maxJsBytes: 850_000,
  maxSingleJsBytes: 650_000,
  maxCssBytes: 180_000,
  maxSingleCssBytes: 128_000,
  maxFontBytes: 28_500_000,
  maxWoff2FontBytes: 14_500_000,
  maxTotalClientAssetBytes: 29_500_000
});

function listFiles(rootDir) {
  const files = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function sumBytes(files) {
  return files.reduce((total, file) => total + fs.statSync(file.fullPath).size, 0);
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function collectClientBuildBudget({ buildDir = clientBuildDir, assetsDir = clientAssetsDir } = {}) {
  if (!fs.existsSync(path.join(buildDir, "index.html"))) {
    throw new Error("React client build output is missing. Run npm run build:client first.");
  }
  if (!fs.existsSync(assetsDir)) {
    throw new Error("React client asset output is missing. Run npm run build:client first.");
  }

  const files = listFiles(assetsDir).map((fullPath) => ({
    fullPath,
    relativePath: path.relative(buildDir, fullPath).replace(/\\/g, "/"),
    size: fs.statSync(fullPath).size
  }));
  const jsFiles = files.filter((file) => file.relativePath.endsWith(".js"));
  const cssFiles = files.filter((file) => file.relativePath.endsWith(".css"));
  const fontFiles = files.filter((file) => /\.(?:woff2?|ttf|otf)$/i.test(file.relativePath));
  const woff2FontFiles = fontFiles.filter((file) => file.relativePath.endsWith(".woff2"));
  const copiedRuntimeAssetFiles = files.filter((file) => /(?:portraits|home|materials|scenes|roles|effects)\//.test(file.relativePath));
  const mapRuntimeFiles = files.filter((file) => /(?:pixi|mapRenderer|mapPanel)/i.test(file.relativePath));

  return {
    budgets: CLIENT_BUILD_BUDGETS,
    files,
    jsFiles,
    cssFiles,
    fontFiles,
    woff2FontFiles,
    copiedRuntimeAssetFiles,
    mapRuntimeFiles,
    totals: {
      jsBytes: sumBytes(jsFiles),
      cssBytes: sumBytes(cssFiles),
      fontBytes: sumBytes(fontFiles),
      woff2FontBytes: sumBytes(woff2FontFiles),
      totalClientAssetBytes: sumBytes(files),
      maxJsBytes: Math.max(0, ...jsFiles.map((file) => file.size)),
      maxCssBytes: Math.max(0, ...cssFiles.map((file) => file.size))
    }
  };
}

function assertClientBuildBudget(summary = collectClientBuildBudget()) {
  const failures = [];
  const { budgets, totals } = summary;

  if (totals.jsBytes > budgets.maxJsBytes) failures.push(`JS total ${formatBytes(totals.jsBytes)} > ${formatBytes(budgets.maxJsBytes)}`);
  if (totals.maxJsBytes > budgets.maxSingleJsBytes) {
    failures.push(`largest JS chunk ${formatBytes(totals.maxJsBytes)} > ${formatBytes(budgets.maxSingleJsBytes)}`);
  }
  if (totals.cssBytes > budgets.maxCssBytes) failures.push(`CSS total ${formatBytes(totals.cssBytes)} > ${formatBytes(budgets.maxCssBytes)}`);
  if (totals.maxCssBytes > budgets.maxSingleCssBytes) {
    failures.push(`largest CSS asset ${formatBytes(totals.maxCssBytes)} > ${formatBytes(budgets.maxSingleCssBytes)}`);
  }
  if (totals.fontBytes > budgets.maxFontBytes) {
    failures.push(`font assets ${formatBytes(totals.fontBytes)} > ${formatBytes(budgets.maxFontBytes)}`);
  }
  if (totals.woff2FontBytes > budgets.maxWoff2FontBytes) {
    failures.push(`woff2 font assets ${formatBytes(totals.woff2FontBytes)} > ${formatBytes(budgets.maxWoff2FontBytes)}`);
  }
  if (totals.totalClientAssetBytes > budgets.maxTotalClientAssetBytes) {
    failures.push(`client-assets total ${formatBytes(totals.totalClientAssetBytes)} > ${formatBytes(budgets.maxTotalClientAssetBytes)}`);
  }
  if (summary.copiedRuntimeAssetFiles.length) {
    failures.push(`Vite copied public UI runtime assets into client bundle: ${summary.copiedRuntimeAssetFiles.slice(0, 3).map((file) => file.relativePath).join(", ")}`);
  }
  if (summary.mapRuntimeFiles.length) {
    failures.push(`Vite bundled map runtime files that should stay lazy-loaded: ${summary.mapRuntimeFiles.map((file) => file.relativePath).join(", ")}`);
  }

  if (failures.length) {
    throw new Error(`S77.5 client build budget failed: ${failures.join("; ")}`);
  }

  return summary;
}

if (require.main === module) {
  try {
    const summary = assertClientBuildBudget();
    console.log(
      [
        "Client build budget OK:",
        `JS ${formatBytes(summary.totals.jsBytes)}`,
        `CSS ${formatBytes(summary.totals.cssBytes)}`,
        `fonts ${formatBytes(summary.totals.fontBytes)}`,
        `client-assets ${formatBytes(summary.totals.totalClientAssetBytes)}`
      ].join(" ")
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  CLIENT_BUILD_BUDGETS,
  assertClientBuildBudget,
  collectClientBuildBudget
};
