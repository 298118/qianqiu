const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const singleOverrideQaPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-single-override-qa-v1.json");
const defaultReferenceDir = path.join(repoRoot, "artifacts", "s73-10-feminine-reference-sheets");
const defaultSingleReferenceDir = path.join(repoRoot, "artifacts", "s73-10-feminine-single-references");
const defaultGeneratedDir = path.join(repoRoot, "artifacts", "s73-10-feminine-generated-sheets");
const defaultOutputDir = path.join(repoRoot, "artifacts", "s73-10-single-portrait-overrides");
const defaultBatchSize = 6;

const SHEET_COLUMNS = 3;
const CELL_WIDTH = 512;
const CELL_HEIGHT = 768;

function parseArgs(argv) {
  const options = {
    references: false,
    singles: false,
    crop: false,
    referenceDir: defaultReferenceDir,
    singleReferenceDir: defaultSingleReferenceDir,
    generatedDir: defaultGeneratedDir,
    outputDir: defaultOutputDir,
    batchSize: defaultBatchSize,
    browserPath: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--references") options.references = true;
    else if (arg === "--single-references") options.singles = true;
    else if (arg === "--crop") options.crop = true;
    else if (arg === "--reference-dir") {
      options.referenceDir = path.resolve(repoRoot, argv[index + 1]);
      index += 1;
    } else if (arg === "--single-reference-dir") {
      options.singleReferenceDir = path.resolve(repoRoot, argv[index + 1]);
      index += 1;
    } else if (arg === "--generated-dir") {
      options.generatedDir = path.resolve(repoRoot, argv[index + 1]);
      index += 1;
    } else if (arg === "--output-dir") {
      options.outputDir = path.resolve(repoRoot, argv[index + 1]);
      index += 1;
    } else if (arg === "--batch-size") {
      options.batchSize = Number(argv[index + 1]);
      index += 1;
    } else if (arg === "--browser") {
      options.browserPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/frontendFemininePortraitReferenceSheets.js --references [--batch-size 6]
  node scripts/frontendFemininePortraitReferenceSheets.js --single-references
  node scripts/frontendFemininePortraitReferenceSheets.js --crop

Reference sheets use compressed runtime WebP portraits only. Generated sheets are cropped
back to one PNG per portrait id under artifacts/s73-10-single-portrait-overrides.`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.references && !options.singles && !options.crop) options.references = true;
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 6) {
    throw new Error("--batch-size must be an integer between 1 and 6");
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

function imageDataUrl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mime = extension === ".png" ? "image/png" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/webp";
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function collectRemainingFeminineAssets() {
  const manifest = readJson(manifestPath);
  const singleOverrideQa = readJson(singleOverrideQaPath);
  const overridden = new Set(singleOverrideQa.assets.map((entry) => entry.id));
  return manifest.assets
    .filter((asset) => asset.category === "portrait" && asset.genderPresentation === "feminine" && !overridden.has(asset.id))
    .sort((left, right) => {
      const leftKey = [left.subcategory || "", left.phase || "", left.id].join("|");
      const rightKey = [right.subcategory || "", right.phase || "", right.id].join("|");
      return leftKey.localeCompare(rightKey);
    });
}

function buildBatches(assets, batchSize) {
  const batches = [];
  for (let index = 0; index < assets.length; index += batchSize) {
    batches.push(assets.slice(index, index + batchSize));
  }
  return batches;
}

async function writeReferenceSheets(options, assets) {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(options), headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1400 } });
  const batches = buildBatches(assets, options.batchSize);
  fs.mkdirSync(options.referenceDir, { recursive: true });
  try {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];
      const rows = Math.ceil(batch.length / SHEET_COLUMNS);
      const sheetWidth = SHEET_COLUMNS * CELL_WIDTH;
      const sheetHeight = rows * CELL_HEIGHT;
      const dataUrl = await page.evaluate(
        async ({ batch, sheetWidth, sheetHeight, cellWidth, cellHeight }) => {
          const canvas = document.createElement("canvas");
          canvas.width = sheetWidth;
          canvas.height = sheetHeight;
          const context = canvas.getContext("2d", { alpha: false });
          context.fillStyle = "#eee3d0";
          context.fillRect(0, 0, sheetWidth, sheetHeight);
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          for (let index = 0; index < batch.length; index += 1) {
            const image = new Image();
            image.decoding = "async";
            image.src = batch[index].dataUrl;
            await image.decode();
            const column = index % 3;
            const row = Math.floor(index / 3);
            const x = column * cellWidth;
            const y = row * cellHeight;
            const scale = Math.min(cellWidth / image.naturalWidth, cellHeight / image.naturalHeight);
            const width = image.naturalWidth * scale;
            const height = image.naturalHeight * scale;
            context.fillStyle = "#f4ead8";
            context.fillRect(x, y, cellWidth, cellHeight);
            context.drawImage(image, x + (cellWidth - width) / 2, y + (cellHeight - height) / 2, width, height);
          }
          return canvas.toDataURL("image/jpeg", 0.74);
        },
        {
          batch: batch.map((asset) => ({ id: asset.id, dataUrl: imageDataUrl(resolveUiAssetPath(asset.path)) })),
          sheetWidth,
          sheetHeight,
          cellWidth: CELL_WIDTH,
          cellHeight: CELL_HEIGHT
        }
      );
      const baseName = `remaining-feminine-${String(batchIndex + 1).padStart(2, "0")}`;
      const sheetPath = path.join(options.referenceDir, `${baseName}.jpg`);
      fs.writeFileSync(sheetPath, Buffer.from(dataUrl.replace(/^data:image\/jpeg;base64,/, ""), "base64"));
      writeJson(path.join(options.referenceDir, `${baseName}.json`), {
        schemaVersion: 1,
        batch: batchIndex + 1,
        totalBatches: batches.length,
        cellLayout: { columns: SHEET_COLUMNS, cellWidth: CELL_WIDTH, cellHeight: CELL_HEIGHT },
        generatedSheetPath: toProjectPath(path.join(options.generatedDir, `${baseName}.png`)),
        outputDir: toProjectPath(options.outputDir),
        assets: batch.map((asset, index) => ({
          index,
          row: Math.floor(index / SHEET_COLUMNS),
          column: index % SHEET_COLUMNS,
          id: asset.id,
          subcategory: asset.subcategory,
          phase: asset.phase,
          role: asset.role,
          statusVariant: asset.statusVariant,
          path: asset.path
        }))
      });
    }
  } finally {
    await browser.close();
  }
  console.log(`Wrote ${batches.length} compressed feminine portrait reference sheets to ${toProjectPath(options.referenceDir)}.`);
}

async function writeSingleReferences(options, assets) {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(options), headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  fs.mkdirSync(options.singleReferenceDir, { recursive: true });
  try {
    for (const asset of assets) {
      const dataUrl = await page.evaluate(
        async ({ sourceUrl, width, height }) => {
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
          context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
          return canvas.toDataURL("image/jpeg", 0.72);
        },
        { sourceUrl: imageDataUrl(resolveUiAssetPath(asset.path)), width: 448, height: 672 }
      );
      fs.writeFileSync(
        path.join(options.singleReferenceDir, `${asset.id}.jpg`),
        Buffer.from(dataUrl.replace(/^data:image\/jpeg;base64,/, ""), "base64")
      );
    }
  } finally {
    await browser.close();
  }
  writeJson(path.join(options.singleReferenceDir, "remaining-feminine-single-references.json"), {
    schemaVersion: 1,
    source: "compressed current runtime WebP portraits",
    count: assets.length,
    assets: assets.map((asset) => ({
      id: asset.id,
      referencePath: toProjectPath(path.join(options.singleReferenceDir, `${asset.id}.jpg`)),
      outputPath: toProjectPath(path.join(options.outputDir, `${asset.id}.png`)),
      subcategory: asset.subcategory,
      phase: asset.phase,
      role: asset.role,
      statusVariant: asset.statusVariant,
      path: asset.path
    }))
  });
  console.log(`Wrote ${assets.length} compressed single reference portraits to ${toProjectPath(options.singleReferenceDir)}.`);
}

async function cropGeneratedSheets(options) {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(options), headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1400 } });
  const batchFiles = fs
    .readdirSync(options.referenceDir)
    .filter((name) => /^remaining-feminine-\d+\.json$/.test(name))
    .sort();
  let written = 0;
  try {
    for (const batchFile of batchFiles) {
      const batch = readJson(path.join(options.referenceDir, batchFile));
      const generatedPath = path.resolve(repoRoot, batch.generatedSheetPath);
      if (!fs.existsSync(generatedPath)) continue;
      const rows = Math.max(...batch.assets.map((asset) => asset.row)) + 1;
      const sheetWidth = SHEET_COLUMNS * CELL_WIDTH;
      const sheetHeight = rows * CELL_HEIGHT;
      for (const asset of batch.assets) {
        const dataUrl = await page.evaluate(
          async ({ sourceUrl, column, row, columns, rows, outputWidth, outputHeight }) => {
            const image = new Image();
            image.decoding = "async";
            image.src = sourceUrl;
            await image.decode();
            const sourceCellWidth = image.naturalWidth / columns;
            const sourceCellHeight = image.naturalHeight / rows;
            const canvas = document.createElement("canvas");
            canvas.width = outputWidth;
            canvas.height = outputHeight;
            const context = canvas.getContext("2d", { alpha: false });
            context.fillStyle = "#f3ead9";
            context.fillRect(0, 0, outputWidth, outputHeight);
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
            context.drawImage(
              image,
              column * sourceCellWidth,
              row * sourceCellHeight,
              sourceCellWidth,
              sourceCellHeight,
              0,
              0,
              outputWidth,
              outputHeight
            );
            return canvas.toDataURL("image/png");
          },
          {
            sourceUrl: imageDataUrl(generatedPath),
            column: asset.column,
            row: asset.row,
            columns: SHEET_COLUMNS,
            rows,
            outputWidth: 1024,
            outputHeight: 1536
          }
        );
        fs.mkdirSync(options.outputDir, { recursive: true });
        fs.writeFileSync(path.join(options.outputDir, `${asset.id}.png`), Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
        written += 1;
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`Cropped ${written} generated feminine portraits to ${toProjectPath(options.outputDir)}.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const assets = collectRemainingFeminineAssets();
  if (options.references) await writeReferenceSheets(options, assets);
  if (options.singles) await writeSingleReferences(options, assets);
  if (options.crop) await cropGeneratedSheets(options);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
