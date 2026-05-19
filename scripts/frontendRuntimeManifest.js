const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const sourceManifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-manifest.json");
const runtimeManifestPath = path.join(repoRoot, "public", "assets", "ui", "ink-ui-runtime-manifest.json");

function compactObject(value) {
  if (Array.isArray(value)) {
    return value.map(compactObject).filter((entry) => entry !== undefined);
  }
  if (value && typeof value === "object") {
    const compacted = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const cleanValue = compactObject(nestedValue);
      if (cleanValue !== undefined) compacted[key] = cleanValue;
    }
    return compacted;
  }
  return value === undefined ? undefined : value;
}

function projectFallback(fallback) {
  return compactObject({
    id: fallback.id,
    category: fallback.category,
    type: fallback.type,
    usage: fallback.usage,
    cssTokens: fallback.cssTokens,
    reviewStatus: fallback.reviewStatus,
    ledgerId: fallback.ledgerId
  });
}

function projectAsset(asset) {
  return compactObject({
    id: asset.id,
    category: asset.category,
    subcategory: asset.subcategory,
    usage: asset.usage,
    role: asset.role,
    roleLabel: asset.roleLabel,
    scene: asset.scene,
    path: asset.path,
    thumbnailPath: asset.thumbnailPath,
    lowResPlaceholderPath: asset.lowResPlaceholderPath,
    fallbackRef: asset.fallbackRef,
    reviewStatus: asset.reviewStatus,
    portraitRef: asset.portraitRef,
    genderPresentation: asset.genderPresentation,
    ageBand: asset.ageBand,
    roleStage: asset.roleStage,
    statusVariant: asset.statusVariant,
    emotionVariant: asset.emotionVariant,
    identityTags: asset.identityTags,
    emotionTags: asset.emotionTags,
    lazyLoad: asset.lazyLoad,
    source: asset.source?.localHighResSource
      ? { localHighResSource: asset.source.localHighResSource }
      : undefined
  });
}

function buildRuntimeManifest(sourceManifest) {
  return compactObject({
    schemaVersion: sourceManifest.schemaVersion,
    assetSetId: sourceManifest.assetSetId,
    assetRoot: sourceManifest.assetRoot,
    runtimeUsableReviewStatuses: sourceManifest.runtimeUsableReviewStatuses,
    runtimeBlockedReviewStatuses: sourceManifest.runtimeBlockedReviewStatuses,
    fallbackCatalog: (sourceManifest.fallbackCatalog || []).map(projectFallback),
    assets: (sourceManifest.assets || []).map(projectAsset)
  });
}

function serializeRuntimeManifest(runtimeManifest) {
  return `${JSON.stringify(runtimeManifest)}\n`;
}

function loadSourceManifest() {
  return JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
}

function checkRuntimeManifest({ write = false } = {}) {
  const sourceManifest = loadSourceManifest();
  const runtimeManifest = buildRuntimeManifest(sourceManifest);
  const expected = serializeRuntimeManifest(runtimeManifest);

  if (write) {
    fs.writeFileSync(runtimeManifestPath, expected);
  }

  const existing = fs.existsSync(runtimeManifestPath) ? fs.readFileSync(runtimeManifestPath, "utf8") : "";
  if (existing !== expected) {
    throw new Error("ink-ui-runtime-manifest.json 已过期；请运行 npm run qa:runtime-manifest:write。");
  }

  return {
    sourceBytes: fs.statSync(sourceManifestPath).size,
    runtimeBytes: Buffer.byteLength(expected),
    assetCount: runtimeManifest.assets.length,
    fallbackCount: runtimeManifest.fallbackCatalog.length
  };
}

function parseArgs(argv = process.argv) {
  return {
    write: argv.includes("--write"),
    help: argv.includes("--help") || argv.includes("-h")
  };
}

function printHelp() {
  console.log(`Usage: node scripts/frontendRuntimeManifest.js [--write]

Creates or checks the compact browser runtime manifest:
  public/assets/ui/ink-ui-runtime-manifest.json
`);
}

if (require.main === module) {
  try {
    const args = parseArgs();
    if (args.help) {
      printHelp();
    } else {
      const summary = checkRuntimeManifest({ write: args.write });
      console.log(
        `Runtime manifest OK: ${summary.assetCount} assets, ${summary.fallbackCount} fallbacks, ${summary.runtimeBytes}/${summary.sourceBytes} bytes`
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  buildRuntimeManifest,
  checkRuntimeManifest,
  runtimeManifestPath,
  sourceManifestPath
};
