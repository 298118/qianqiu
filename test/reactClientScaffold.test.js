const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildReactClientBuildPaths,
  shouldServeReactHistoryFallback
} = require("../server");
const { resolveClientBuildStatus } = require("../scripts/ensureClientBuild");
const {
  CLIENT_RESOURCE_BUDGETS,
  assertRuntimeManifestRequestOnly,
  getResourceBudgetFailures,
  getResourceBudgetSnapshot,
  getPlayerFacingCopyLeakFailures,
  getRuntimeManifestSafetyFailures,
  getSafetyPollutionFailures,
  getTextOverlapFailures,
  getTextOverflowFailures,
  parseClientSmokeArgs
} = require("../scripts/clientSmoke");
const {
  buildRuntimeManifest,
  checkRuntimeManifest,
  validateRuntimeManifestSafety,
  runtimeManifestPath,
  sourceManifestPath
} = require("../scripts/frontendRuntimeManifest");

const rootDir = path.join(__dirname, "..");

function readText(relativePath) {
  if (relativePath === "client/src/styles/global.css") {
    return readClientStyleSource();
  }
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

const clientStyleEntryImports = Object.freeze([
  "tokens/tokens.css",
  "base/base.css",
  "utilities/surfaces.css",
  "components/shell.css",
  "base/preferences.css",
  "base/intrinsics.css",
  "routes/home.css",
  "components/controls.css",
  "routes/game.css",
  "utilities/polish-surfaces.css",
  "routes/map-archive.css",
  "routes/people-inventory.css",
  "routes/exam-ranking.css",
  "components/overlays-surfaces.css",
  "responsive/global-responsive.css",
  "motion/reduced-motion.css",
  "motion/keyframes.css"
]);

const clientStyleExpectedModules = Object.freeze([
  "global.css",
  "tokens/tokens.css",
  "base/base.css",
  "utilities/surfaces.css",
  "components/shell.css",
  "base/preferences.css",
  "base/intrinsics.css",
  "routes/home.css",
  "components/controls.css",
  "routes/game.css",
  "utilities/polish-surfaces.css",
  "routes/map-archive.css",
  "routes/people-inventory.css",
  "routes/exam-ranking.css",
  "components/overlays-surfaces.css",
  "responsive/global-responsive.css",
  "responsive/mobile-layout.css",
  "responsive/mobile-home.css",
  "responsive/mobile-game-map.css",
  "responsive/mobile-people-inventory.css",
  "responsive/mobile-exam-ranking.css",
  "motion/reduced-motion.css",
  "motion/keyframes.css"
]);

function readClientStyleModule(modulePath) {
  return fs.readFileSync(path.join(rootDir, "client", "src", "styles", modulePath), "utf8");
}

function resolveClientStyleImportGraph(modulePath, visited = new Set()) {
  const normalizedModulePath = modulePath.replaceAll("\\", "/");
  if (visited.has(normalizedModulePath)) return [];
  visited.add(normalizedModulePath);
  const moduleSource = readClientStyleModule(normalizedModulePath);
  const moduleDir = path.posix.dirname(normalizedModulePath);
  const resolvedModules = [normalizedModulePath];
  const importPattern = /@import\s+"\.\/([^"]+)";/g;
  let match;
  while ((match = importPattern.exec(moduleSource))) {
    const childModulePath = path.posix.normalize(path.posix.join(moduleDir === "." ? "" : moduleDir, match[1]));
    resolvedModules.push(...resolveClientStyleImportGraph(childModulePath, visited));
  }
  return resolvedModules;
}

const clientStyleModules = Object.freeze(resolveClientStyleImportGraph("global.css"));

function readClientStyleSource() {
  return clientStyleModules
    .map((modulePath) => readClientStyleModule(modulePath))
    .join("\n");
}

function stripSafeGuardPatterns(source) {
  return source
    .replace(/const unsafeHomeSummaryPattern = .*?;\r?\n/, "")
    .replace(/const unsafeSaveTextPattern = .*?;\r?\n/, "")
    .replace(/const unsafePreferenceTextPattern = .*?;\r?\n/, "")
    .replace(/const unsafeDomainConsequenceFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafeEconomyTraceFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafeNpcEvidenceFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafePeopleTextFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafeArchiveFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafeMapTextFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafeMapRuntimeTextFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafeMapRefTokens = new Set\([\s\S]*?\]\);\r?\n/, "")
    .replace(/const unsafeMapRuntimeRefTokens = new Set\([\s\S]*?\]\);\r?\n/, "")
    .replace(/const unsafeMapRefPrefixPattern = .*?;\r?\n/, "")
    .replace(/const unsafeMapRuntimeRefPrefixPattern = .*?;\r?\n/, "")
    .replace(/const unsafeAiSettingsFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafeGameShellFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafeMagistrateFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafeOfficialMinisterFragments[\s\S]*?\] as const;\r?\n/, "")
    .replace(/const unsafeClientApiPathPatterns = Object\.freeze\(\[[\s\S]*?\]\);\r?\n/, "");
}

function mockRequest({ method = "GET", requestPath = "/", accept = "text/html" } = {}) {
  return {
    method,
    path: requestPath,
    headers: { accept }
  };
}

test("S74.1 package scripts expose the React client workflow", () => {
  const packageJson = JSON.parse(readText("package.json"));

  assert.equal(packageJson.scripts.prestart, "node scripts/ensureClientBuild.js");
  assert.equal(packageJson.scripts["dev:client"], "vite --config vite.config.mjs");
  assert.equal(packageJson.scripts["build:client"], "vite build --config vite.config.mjs");
  assert.equal(packageJson.scripts["typecheck:client"], "tsc --project tsconfig.client.json --noEmit");
  assert.equal(packageJson.scripts["test:client"], "vitest --config vitest.config.mjs run");
  assert.equal(packageJson.scripts["preview:client"], "vite preview --config vite.config.mjs");
  assert.equal(packageJson.scripts["qa:runtime-manifest"], "node scripts/frontendRuntimeManifest.js");
  assert.equal(packageJson.scripts["qa:runtime-manifest:write"], "node scripts/frontendRuntimeManifest.js --write");
  assert.equal(packageJson.scripts["budget:client"], "node scripts/clientBuildBudget.js");
  assert.equal(packageJson.scripts["smoke:browser"], "npm run qa:runtime-manifest && npm run build:client && npm run budget:client && node scripts/clientSmoke.js");
  assert.equal(packageJson.scripts["smoke:browser:visual"], "npm run smoke:browser -- --screenshots artifacts/browser-visual-matrix");
  assert.equal(packageJson.scripts["smoke:browser:legacy"], "node scripts/browserSmoke.js");
});

test("S74.1 Vite config isolates build output from public assets", () => {
  const source = readText("vite.config.mjs");

  assert.match(source, /root:\s*"client"/);
  assert.match(source, /publicDir:\s*false/);
  assert.match(source, /outDir:\s*"..\/dist\/client"/);
  assert.match(source, /assetsDir:\s*"client-assets"/);
  assert.doesNotMatch(source, /publicDir:\s*"public"/);
});

test("S74.1 Express history fallback only catches HTML frontend routes", () => {
  for (const route of [
    "/",
    "/game/session-1",
    "/game/session-1/map",
    "/game/session-1/people",
    "/game/session-1/archive",
    "/game/session-1/exam",
    "/game/session-1/ranking",
    "/game/session-1/court",
    "/game/session-1/settings"
  ]) {
    assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: route })), true);
  }
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: "/api/health" })), false);
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: "/assets/ui/missing" })), false);
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: "/vendor/pixi" })), false);
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: "/client-assets/chunk" })), false);
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: "/mapRenderer.js" })), false);
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: "/mapPanel.js" })), false);
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: "/assets/ui/home.webp", accept: "image/webp" })), false);
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: "/client-assets/index.js" })), false);
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ method: "POST", requestPath: "/game/session-1" })), false);

  const buildPaths = buildReactClientBuildPaths("E:\\LSMNQ");
  assert.equal(buildPaths.indexHtml, path.join("E:\\LSMNQ", "dist", "client", "index.html"));
});

test("S77.1 prestart helper rebuilds missing or stale React client output", () => {
  const tempRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "qianqiu-client-build-"));
  try {
    fs.mkdirSync(path.join(tempRoot, "client"), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, "dist", "client"), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, "client", "App.tsx"), "export const app = true;\n");
    fs.writeFileSync(path.join(tempRoot, "package.json"), "{}\n");
    fs.utimesSync(path.join(tempRoot, "package.json"), new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-01T00:00:00.000Z"));

    assert.equal(resolveClientBuildStatus({ repoRoot: tempRoot, inputs: ["client", "package.json"] }).reason, "missing");

    const indexHtml = path.join(tempRoot, "dist", "client", "index.html");
    fs.writeFileSync(indexHtml, "<div data-client-entry=\"react\"></div>\n");
    const oldTime = new Date("2026-01-01T00:00:00.000Z");
    const newTime = new Date("2026-01-02T00:00:00.000Z");
    fs.utimesSync(indexHtml, oldTime, oldTime);
    fs.utimesSync(path.join(tempRoot, "client", "App.tsx"), newTime, newTime);
    assert.equal(resolveClientBuildStatus({ repoRoot: tempRoot, inputs: ["client", "package.json"] }).reason, "stale");

    fs.utimesSync(indexHtml, new Date("2026-01-03T00:00:00.000Z"), new Date("2026-01-03T00:00:00.000Z"));
    assert.equal(resolveClientBuildStatus({ repoRoot: tempRoot, inputs: ["client", "package.json"] }).reason, "current");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("S77.1 default entry does not keep old product entry files", () => {
  assert.equal(fs.existsSync(path.join(rootDir, "public", "legacy.html")), false);
  assert.equal(fs.existsSync(path.join(rootDir, "public", "ink-client")), false);
  assert.equal(fs.existsSync(path.join(rootDir, "ink-client")), false);
});

test("S74.1 client smoke parser keeps the focused React smoke options", () => {
  const args = parseClientSmokeArgs([
    "node",
    "scripts/clientSmoke.js",
    "--url",
    "http://localhost:3000/",
    "--browser",
    "C:\\Chrome\\chrome.exe",
    "--screenshots",
    "artifacts/s74",
    "--headed"
  ]);

  assert.deepEqual(args, {
    browserPath: "C:\\Chrome\\chrome.exe",
    headed: true,
    help: false,
    screenshotsDir: "artifacts/s74",
    url: "http://localhost:3000"
  });
  assert.deepEqual(
    parseClientSmokeArgs(["node", "scripts/clientSmoke.js", "--client", "react"]),
    {
      browserPath: null,
      headed: false,
      help: false,
      screenshotsDir: null,
      url: null
    }
  );
  assert.throws(() => parseClientSmokeArgs(["node", "scripts/clientSmoke.js", "--bad"]), /Unknown client smoke/);
  assert.throws(() => parseClientSmokeArgs(["node", "scripts/clientSmoke.js", "--client", "legacy"]), /Unsupported client smoke target/);
});

test("S77.3 client smoke has visual pixel and player-facing copy guards", () => {
  const smokeSource = readText("scripts/clientSmoke.js");

  assert.match(smokeSource, /assertReviewedBackgroundVisual/);
  assert.match(smokeSource, /assertCanvasHasInkPixels/);
  assert.match(smokeSource, /assertPortraitImagesLoaded/);
  assert.match(smokeSource, /assertNoVisibleTextOverlap/);
  assert.match(smokeSource, /getPlayerFacingCopyLeakFailures/);
  assert.match(smokeSource, /\.homeBackdrop/);
  assert.match(smokeSource, /\.examHero/);
  assert.match(smokeSource, /\.rankingHero/);
  assert.match(smokeSource, /\.inkMapRuntimeBridge canvas/);
  assert.match(smokeSource, /\.peopleLedgerList/);

  assert.deepEqual(getPlayerFacingCopyLeakFailures("此处显示 smoke S77.3 验收", "fixture"), [
    "fixture exposed player-facing development copy: smoke",
    "fixture exposed player-facing development copy: S77.3",
    "fixture exposed player-facing development copy: 验收"
  ]);
  assert.deepEqual(getPlayerFacingCopyLeakFailures("服务器裁决与安全投影为玩家可见说明。", "fixture"), []);

  const overlapFailures = getTextOverlapFailures([
    { id: "a", text: "按钮甲", rect: { x: 0, y: 0, width: 120, height: 36 }, ancestorIds: [] },
    { id: "b", text: "按钮乙", rect: { x: 40, y: 8, width: 120, height: 36 }, ancestorIds: [] }
  ], "fixture");
  assert.match(overlapFailures.join("\n"), /visible text\/control overlap/);
  assert.deepEqual(getTextOverlapFailures([
    { id: "a", text: "按钮甲", rect: { x: 0, y: 0, width: 120, height: 36 }, ancestorIds: [] },
    { id: "b", text: "按钮乙", rect: { x: 140, y: 0, width: 120, height: 36 }, ancestorIds: [] }
  ], "fixture"), []);
  assert.deepEqual(getTextOverlapFailures([
    { id: "parent", text: "父级按钮", rect: { x: 0, y: 0, width: 120, height: 36 }, ancestorIds: [] },
    { id: "child", text: "子级文字", rect: { x: 8, y: 6, width: 90, height: 24 }, ancestorIds: ["parent"] }
  ], "fixture"), []);
});

test("S77.4 client smoke has unified safety pollution guards", () => {
  const smokeSource = readText("scripts/clientSmoke.js");
  const examPageSource = readText("client/src/pages/ExamPage.tsx");
  const rankingPageSource = readText("client/src/pages/RankingPage.tsx");

  assert.match(smokeSource, /getSafetyPollutionFailures/);
  assert.match(smokeSource, /assertNoSafetyPollutionOnPage/);
  assert.match(smokeSource, /assertBrowserStorageSafety/);
  assert.match(smokeSource, /assertManifestRuntimeSafety/);
  assert.match(smokeSource, /assertScreenshotArtifactsSafety/);
  assert.match(smokeSource, /S77\.4 \$\{screenshotName\}/);
  assert.match(smokeSource, /localStorage/);
  assert.match(smokeSource, /sessionStorage/);
  assert.match(smokeSource, /localHighResSourcePath/);
  assert.match(smokeSource, /runtimeEnvelope/);
  assert.match(smokeSource, /path\.basename\(screenshot\.filePath\)/);
  assert.match(smokeSource, /弥封身份映射\|考官隐藏意图/);
  assert.match(smokeSource, /ink-ui-runtime-manifest\.json/);

  assert.deepEqual(getSafetyPollutionFailures("raw prompt 写入 E:\\LSMNQ\\data\\sessions\\x sk-test-secret-123456 /home/user/.env", "fixture"), [
    "fixture exposed safety pollution: raw prompt",
    "fixture exposed safety pollution: E:\\",
    "fixture exposed safety pollution: data\\sessions",
    "fixture exposed safety pollution: sk-test-secret-123456",
    "fixture exposed safety pollution: /home/user/.env"
  ]);
  assert.deepEqual(getSafetyPollutionFailures("弥封身份映射 与 考官隐藏意图 不应出现在玩家 DOM", "fixture"), [
    "fixture exposed safety pollution: 弥封身份映射",
    "fixture exposed safety pollution: 考官隐藏意图"
  ]);
  assert.deepEqual(getSafetyPollutionFailures("服务器公开投影与安全摘要。", "fixture"), []);

  assert.doesNotMatch(examPageSource, /本页不显示弥封身份映射|考官隐藏意图|模型原始提案/);
  assert.match(examPageSource, /只呈现已公开的考试快照/);
  assert.doesNotMatch(rankingPageSource, /不显示弥封身份映射|未采纳评语|模型原始提案/);
  assert.match(rankingPageSource, /只呈现已公开的榜文/);
});

test("S77.5 runtime manifest is compact and strips authoring-only fields", () => {
  const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
  const runtimeManifest = buildRuntimeManifest(sourceManifest);
  const runtimeText = fs.readFileSync(runtimeManifestPath, "utf8");
  const checked = checkRuntimeManifest();

  assert.equal(runtimeManifest.assets.length, sourceManifest.assets.length);
  assert.ok(checked.runtimeBytes < checked.sourceBytes * 0.35);
  // S79.2 imports 194 high-res portrait records; the runtime manifest still
  // strips authoring-only fields and stays near the 1 MB lazy-load budget.
  assert.ok(checked.runtimeBytes < 1_050_000);
  assert.doesNotMatch(runtimeText, /localHighResSourcePath|promptSummary|postProcessing|performance|visualReview[^]*notes|safetyReview[^]*notes/);
  assert.doesNotMatch(runtimeText, /artifacts[\\/]|[A-Za-z]:[\\/]|file:\/\//);
  assert.equal(runtimeManifest.assets.some((asset) => asset.thumbnailPath), true);
  assert.equal(runtimeManifest.assets.some((asset) => asset.lowResPlaceholderPath), true);
  assert.equal(validateRuntimeManifestSafety(runtimeManifest), true);
});

test("S88.11 runtime manifest QA rejects unsafe portrait and authoring metadata", () => {
  const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
  const runtimeManifest = buildRuntimeManifest(sourceManifest);
  const portraitIndex = runtimeManifest.assets.findIndex((asset) => asset.category === "portrait");
  assert.notEqual(portraitIndex, -1);

  const pollutedRuntimeManifest = JSON.parse(JSON.stringify(runtimeManifest));
  pollutedRuntimeManifest.assets[portraitIndex] = {
    ...pollutedRuntimeManifest.assets[portraitIndex],
    reviewStatus: "review_pending",
    ageBand: "teen",
    promptSummary: "完整 prompt 原文：E:\\LSMNQ\\artifacts\\source.png",
    identityTags: [
      ...pollutedRuntimeManifest.assets[portraitIndex].identityTags,
      "providerPayload",
      "SQLite",
      "safe_search_index"
    ],
    lazyLoad: {
      ...pollutedRuntimeManifest.assets[portraitIndex].lazyLoad,
      allowEagerLoad: true
    },
    source: {
      localHighResSource: "kept_outside_public_manifest",
      localHighResSourcePath: "E:\\LSMNQ\\artifacts\\portrait-source.png"
    }
  };
  pollutedRuntimeManifest.fallbackCatalog[0] = {
    ...pollutedRuntimeManifest.fallbackCatalog[0],
    cssTokens: {
      ...pollutedRuntimeManifest.fallbackCatalog[0].cssTokens,
      providerPayload: "safe-looking"
    }
  };

  assert.throws(() => validateRuntimeManifestSafety(pollutedRuntimeManifest), (error) => {
    const message = error instanceof Error ? error.message : String(error);
    for (const expectedFragment of [
      "运行时安全校验失败",
      "reviewStatus",
      "promptSummary",
      "ageBand",
      "allowEagerLoad",
      "localHighResSourcePath",
      "providerPayload",
      "SQLite",
      "safe_search_index"
    ]) {
      assert.match(message, new RegExp(expectedFragment));
    }
    return true;
  });
});

test("S88.11 client smoke verifies runtime manifest and people portrait isolation", () => {
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const committedRuntimeManifest = JSON.parse(fs.readFileSync(runtimeManifestPath, "utf8"));
  const portraitIndex = committedRuntimeManifest.assets.findIndex((asset) => asset.category === "portrait");
  assert.notEqual(portraitIndex, -1);

  assert.deepEqual(getRuntimeManifestSafetyFailures(committedRuntimeManifest), []);
  assert.doesNotThrow(() => assertRuntimeManifestRequestOnly(["/assets/ui/ink-ui-runtime-manifest.json"], "fixture"));
  assert.throws(
    () => assertRuntimeManifestRequestOnly(["/assets/ui/ink-ui-runtime-manifest.json", "/assets/ui/ink-ui-manifest.json"], "fixture"),
    /full source manifest/
  );
  assert.throws(
    () => assertRuntimeManifestRequestOnly([], "fixture"),
    /did not request runtime manifest/
  );

  const pollutedRuntimeManifest = JSON.parse(JSON.stringify(committedRuntimeManifest));
  pollutedRuntimeManifest.assets[portraitIndex] = {
    ...pollutedRuntimeManifest.assets[portraitIndex],
    reviewStatus: "review_pending",
    promptSummary: "完整 prompt 原文：E:\\LSMNQ\\artifacts\\source.png",
    lazyLoad: {
      ...pollutedRuntimeManifest.assets[portraitIndex].lazyLoad,
      allowEagerLoad: true
    },
    source: {
      localHighResSourcePath: "E:\\LSMNQ\\artifacts\\portrait-source.png"
    }
  };
  const failures = getRuntimeManifestSafetyFailures(pollutedRuntimeManifest).join("\n");
  for (const expectedFragment of [
    "reviewStatus",
    "promptSummary",
    "allowEagerLoad",
    "localHighResSourcePath",
    "artifacts"
  ]) {
    assert.match(failures, new RegExp(expectedFragment));
  }

  assert.match(clientSmokeSource, /sourceAssetManifestPath = "\/assets\/ui\/ink-ui-manifest\.json"/);
  assert.match(clientSmokeSource, /assertRuntimeManifestRequestOnly/);
  assert.match(clientSmokeSource, /getRuntimeManifestSafetyFailures/);
  assert.match(clientSmokeSource, /fetch\(`\$\{baseUrl\}\$\{runtimeAssetManifestPath\}`/);
  assert.doesNotMatch(clientSmokeSource, /assertManifestRuntimeSafety\(page,\s*baseUrl\)/);
  assert.match(clientSmokeSource, /runtimeManifestUnsafeTextPattern/);
  assert.match(clientSmokeSource, /raw.*provider.*prompt|provider.*prompt.*raw/s);
  assert.match(clientSmokeSource, /localHighResSourcePath/);
  assert.match(clientSmokeSource, /source\[_ -\]\?path/);
  assert.match(clientSmokeSource, /api\[_ -\]\?key/);
  assert.match(clientSmokeSource, /assertPeoplePortraitRuntimeSafety/);
  assert.match(clientSmokeSource, /data-portrait-ref/);
  assert.match(clientSmokeSource, /data-visible-portraits/);
  assert.match(clientSmokeSource, /signature_npc_pool/);
  assert.match(clientSmokeSource, /portrait_pool_signature_npc_s73_10/);
  assert.match(clientSmokeSource, /important_npc/);
  assert.match(clientSmokeSource, /portraitMainRequests > 8/);
  assert.match(clientSmokeSource, /portraitThumbRequests > 8/);
  assert.match(clientSmokeSource, /portraitPlaceholderRequests > 8/);
});

test("S77.5 client smoke resource budget classifies first-screen and lazy resources", () => {
  const snapshot = getResourceBudgetSnapshot([
    { name: "http://local/client-assets/index.js", encodedBodySize: 450_000, transferSize: 0 },
    { name: "http://local/client-assets/index.css", encodedBodySize: 50_000, transferSize: 0 },
    { name: "http://local/client-assets/noto-serif-sc.woff2", encodedBodySize: 1_500_000, transferSize: 0 },
    { name: "http://local/assets/ui/ink-ui-runtime-manifest.json", encodedBodySize: 680_000, transferSize: 0 },
    { name: "http://local/assets/ui/home/home-scroll-landscape-v1.webp", encodedBodySize: 280_000, transferSize: 0 },
    { name: "http://local/assets/ui/portraits/portrait-player-scholar-f01-v1.webp", encodedBodySize: 120_000, transferSize: 0 },
    { name: "http://local/assets/ui/thumbs/thumb-portrait-a.webp", encodedBodySize: 50_000, transferSize: 0 },
    { name: "http://local/assets/ui/portraits/placeholders/placeholder-portrait-a.webp", encodedBodySize: 2_000, transferSize: 0 }
  ]);

  assert.equal(snapshot.runtimeManifestBytes, 680_000);
  assert.equal(snapshot.fontWoff2Requests, 1);
  assert.equal(snapshot.portraitThumbRequests, 1);
  assert.equal(snapshot.portraitPlaceholderRequests, 1);
  assert.equal(snapshot.portraitMainRequests, 1);
  assert.deepEqual(getResourceBudgetFailures(snapshot, CLIENT_RESOURCE_BUDGETS.home, "fixture"), []);

  const failingSnapshot = getResourceBudgetSnapshot([
    { name: "http://local/assets/ui/ink-ui-manifest.json", encodedBodySize: 2_300_000, transferSize: 0 },
    { name: "http://local/assets/ui/portraits/s73-10/portrait-player-1.webp", encodedBodySize: 350_000, transferSize: 0 },
    { name: "http://local/assets/ui/portraits/s73-10/portrait-player-2.webp", encodedBodySize: 350_000, transferSize: 0 },
    { name: "http://local/assets/ui/portraits/s73-10/portrait-player-3.webp", encodedBodySize: 350_000, transferSize: 0 },
    { name: "http://local/assets/ui/portraits/s73-10/portrait-player-4.webp", encodedBodySize: 350_000, transferSize: 0 },
    { name: "http://local/assets/ui/portraits/s73-10/portrait-player-5.webp", encodedBodySize: 350_000, transferSize: 0 },
    { name: "http://local/assets/ui/portraits/s73-10/portrait-player-6.webp", encodedBodySize: 350_000, transferSize: 0 },
    { name: "http://local/assets/ui/portraits/s73-10/portrait-player-7.webp", encodedBodySize: 350_000, transferSize: 0 },
    { name: "http://local/vendor/pixi.min.js", encodedBodySize: 600_000, transferSize: 0 }
  ]);
  assert.match(getResourceBudgetFailures(failingSnapshot, CLIENT_RESOURCE_BUDGETS.home, "fixture").join("\n"), /full source manifest|map runtime|portrait main/);
});

test("S77.6 display fonts and accessibility smoke guard text-heavy routes", () => {
  const packageJson = JSON.parse(readText("package.json"));
  const mainSource = readText("client/src/main.tsx");
  const storageSource = readText("client/src/state/displayPreferenceStorage.ts");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const rankingPageSource = readText("client/src/pages/RankingPage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const buildBudgetSource = readText("scripts/clientBuildBudget.js");

  assert.equal(packageJson.dependencies["@fontsource/zcool-xiaowei"], "^5.2.8");
  assert.equal(packageJson.dependencies["@fontsource/long-cang"], "^5.2.8");
  assert.equal(packageJson.dependencies["@fontsource/ma-shan-zheng"], "^5.2.9");
  assert.match(mainSource, /@fontsource\/zcool-xiaowei\/chinese-simplified-400\.css/);
  assert.match(mainSource, /@fontsource\/long-cang\/chinese-simplified-400\.css/);
  assert.match(mainSource, /@fontsource\/ma-shan-zheng\/chinese-simplified-400\.css/);
  assert.match(storageSource, /bodyFont: "serif-classic"/);
  assert.match(surfaceHostSource, /正文字体/);
  assert.match(appShellSource, /data-body-font=\{displayPreferences\.bodyFont\}/);
  assert.match(styleSource, /--qq-font-song-xiaowei/);
  assert.match(styleSource, /\.appShell\[data-body-font="kai-longcang"\]/);
  assert.match(styleSource, /rankingGoldenNotice/);
  assert.match(styleSource, /rankingGoldDust/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\] \.rankingGoldenNotice::before/);
  assert.match(styleSource, /\.rankingGoldenTitle span/);
  assert.match(styleSource, /prefers-reduced-motion: reduce/);
  assert.match(rankingPageSource, /showGoldenNotice/);
  assert.match(rankingPageSource, /金榜题名/);
  assert.match(clientSmokeSource, /getTextOverflowFailures/);
  assert.match(clientSmokeSource, /assertNoVisibleTextOverflow/);
  assert.match(clientSmokeSource, /assertBrowserLevelReducedMotion/);
  assert.match(clientSmokeSource, /s88-9-browser-reduced-motion-ranking/);
  assert.match(clientSmokeSource, /maxFontWoff2Requests: 6/);
  assert.match(buildBudgetSource, /maxWoff2FontBytes: 14_500_000/);
  assert.deepEqual(getTextOverflowFailures([
    { text: "过长按钮", clientWidth: 80, clientHeight: 32, scrollWidth: 126, scrollHeight: 32 }
  ], "fixture"), [
    "fixture visible text/control internal overflow: \"过长按钮\""
  ]);
  assert.deepEqual(getTextOverflowFailures([
    { text: "合格按钮", clientWidth: 120, clientHeight: 36, scrollWidth: 120, scrollHeight: 36 }
  ], "fixture"), []);
});

test("S74.2 React API client only exposes safe player-facing endpoints", () => {
  const apiSource = readText("client/src/api/qianqiuClient.ts");
  const stateSource = readText("client/src/state/gameSessionState.ts");
  const combined = `${apiSource}\n${stateSource}`;

  assert.match(combined, /\/api\/game\/player-state\/\$\{encodePathSegment\(sessionId\)\}/);
  assert.match(combined, /\/api\/game\/saves/);
  assert.match(combined, /\/api\/exam\/submit/);
  assert.match(combined, /\/api\/ai\/settings/);
  assert.doesNotMatch(combined, /requestJson<[^>]+>\(`?\/api\/game\/state/);
  assert.doesNotMatch(combined, /\/api\/dev\/session-diagnostics/);
  assert.doesNotMatch(combined, /data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/);
});

test("S74.3 UI state store keeps only safe UI summaries and preferences", () => {
  const uiStateSource = readText("client/src/state/uiState.ts");
  const appSource = readText("client/src/App.tsx");
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const combined = `${uiStateSource}\n${appSource}\n${gamePageSource}`;

  assert.match(uiStateSource, /create<UiState>/);
  assert.match(uiStateSource, /activeDrawer/);
  assert.match(uiStateSource, /activeModal/);
  assert.match(uiStateSource, /actionDraft/);
  assert.match(uiStateSource, /sessionId: state\.currentSessionId/);
  assert.match(uiStateSource, /keepActionDraftForSession/);
  assert.match(uiStateSource, /displayPreferences/);
  assert.match(uiStateSource, /extractSafePlayerPayload/);
  assert.match(gamePageSource, /clearActionDraft/);
  assert.match(gamePageSource, /activeActionDraft/);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/);
});

test("S74.4 shell uses registry-backed overlays without widening data sources", () => {
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const surfaceRegistrySource = readText("client/src/surfaces/surfaceRegistry.tsx");
  const uiStateSource = readText("client/src/state/uiState.ts");
  const stateSource = readText("client/src/state/gameSessionState.ts");
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const courtPageSource = readText("client/src/pages/CourtPage.tsx");
  const archivePageSource = readText("client/src/pages/ArchivePage.tsx");
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const inventoryPageSource = readText("client/src/pages/InventoryPage.tsx");
  const examPageSource = readText("client/src/pages/ExamPage.tsx");
  const rankingPageSource = readText("client/src/pages/RankingPage.tsx");
  const sessionIdSource = readText("client/src/routes/sessionId.ts");
  const routeCatalogSource = readText("client/src/routes/routeCatalog.ts");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const combined = stripSafeGuardPatterns(`${appShellSource}\n${surfaceHostSource}\n${surfaceRegistrySource}\n${uiStateSource}\n${courtPageSource}\n${archivePageSource}\n${mapPageSource}\n${routeCatalogSource}`);

  assert.match(appShellSource, /data-shell-version="s75-9"/);
  assert.match(appShellSource, /resolvePrimaryHref/);
  assert.match(appShellSource, /isRouteLocalSessionId/);
  assert.match(appShellSource, /resolvePrimaryHref[\s\S]*isRouteLocalSessionId\(currentSessionId\)/);
  assert.match(appShellSource, /end=\{route\.id === "game"\}/);
  assert.match(appShellSource, /ScrollRestoration/);
  assert.match(appShellSource, /window\.scrollTo/);
  assert.match(surfaceHostSource, /drawerRegistry/);
  assert.match(surfaceHostSource, /modalRegistry/);
  assert.match(surfaceHostSource, /surfaceRegistry/);
  assert.match(surfaceHostSource, /event\.key !== "Escape"/);
  assert.match(surfaceHostSource, /event\.key === "Tab"/);
  assert.match(surfaceHostSource, /trapFocusWithin/);
  assert.match(surfaceHostSource, /data-overlay-kind="surface"/);
  assert.match(surfaceHostSource, /data-overlay-kind="drawer"/);
  assert.match(surfaceHostSource, /focusReturnTargetsRef/);
  assert.match(surfaceHostSource, /returningFromPortrait/);
  assert.match(uiStateSource, /openSurfaceForSession/);
  assert.match(uiStateSource, /isRouteLocalSessionId\(sessionId\)/);
  assert.match(stateSource, /loadInventory[\s\S]*canApplyRouteSession\(state, payload\.sessionId\)/);
  assert.match(stateSource, /loadNpcs[\s\S]*canApplyRouteSession\(state, payload\.sessionId\)/);
  assert.match(stateSource, /loadNpcDetail[\s\S]*canApplyRouteSession\(state, payload\.sessionId\)/);
  assert.match(peoplePageSource, /latestSelectedNpcIdRef/);
  assert.match(peoplePageSource, /current\.trim\(\) === requestUtterance/);
  assert.match(inventoryPageSource, /latestTransferSelectionRef/);
  assert.match(inventoryPageSource, /isLatestTransferSelection\(requestItemId, requestTargetContainerId\)/);
  assert.match(sessionIdSource, /previewSessionIds/);
  assert.match(sessionIdSource, /"s74-preview", "s76-preview", "smoke-session"/);
  assert.match(sessionIdSource, /isRouteLocalSessionId/);
  assert.match(courtPageSource, /disabled=\{!routeSessionSupported\}/);
  assert.match(archivePageSource, /disabled=\{!routeSessionSupported\}/);
  assert.match(mapPageSource, /disabled=\{!routeSessionSupported\}/);
  assert.match(peoplePageSource, /disabled=\{!routeSessionSupported\}/);
  assert.match(inventoryPageSource, /disabled=\{!routeSessionSupported \|\|/);
  assert.match(rankingPageSource, /disabled=\{!routeSessionSupported\}/);
  assert.match(courtPageSource, /isRouteLocalSessionId\(sessionId\)/);
  assert.match(archivePageSource, /isRouteLocalSessionId\(sessionId\)/);
  assert.match(mapPageSource, /isRouteLocalSessionId\(sessionId\)/);
  assert.match(peoplePageSource, /isRouteLocalSessionId\(sessionId\)/);
  assert.match(inventoryPageSource, /isRouteLocalSessionId\(sessionId\)/);
  assert.match(examPageSource, /isRouteLocalSessionId\(sessionId\)/);
  assert.match(rankingPageSource, /isRouteLocalSessionId\(sessionId\)/);
  assert.match(examPageSource, /routeError = routeSessionSupported/);
  assert.match(examPageSource, /routeStatus === "loading"/);
  assert.match(peoplePageSource, /此案卷编号暂不可用于浏览器人物谱牒/);
  assert.match(inventoryPageSource, /此案卷编号暂不可用于浏览器囊箧/);
  assert.match(examPageSource, /此案卷编号暂不可用于浏览器科举/);
  assert.match(rankingPageSource, /此案卷编号暂不可用于浏览器皇榜/);
  assert.match(courtPageSource, /openSurfaceForSession\(surface, sessionId\)/);
  assert.match(archivePageSource, /openSurfaceForSession\("memorial-review", sessionId\)/);
  assert.match(mapPageSource, /openSurfaceForSession\("map-filter", sessionId\)/);
  assert.match(peoplePageSource, /openSurfaceForSession\("npc-profile", sessionId\)/);
  assert.match(gamePageSource, /openSurfaceForSession\(surface, sessionId\)/);
  assert.doesNotMatch(courtPageSource, /openSurface\(surface\)/);
  assert.doesNotMatch(archivePageSource, /openSurface\("memorial-review"\)/);
  assert.doesNotMatch(mapPageSource, /openSurface\("map-filter"\)/);
  assert.doesNotMatch(gamePageSource, /openSurface\(surface\)/);
  assert.match(styleSource, /\.archiveTraceGrid/);
  assert.match(styleSource, /grid-template-columns: minmax\(340px, 1\.08fr\) minmax\(300px, 0\.92fr\)/);
  assert.match(styleSource, /\.archiveEvidenceStack/);
  assert.match(styleSource, /\.archiveActionRow/);
  assert.match(styleSource, /\.archiveItemList strong/);
  assert.match(styleSource, /\.domainConsequenceSection h3/);
  assert.match(styleSource, /\.npcFollowUpEvidenceGrid/);
  assert.match(clientSmokeSource, /s88-9-archive-mobile/);
  assert.match(clientSmokeSource, /data-archive-layout/);
  assert.match(clientSmokeSource, /ledger-rail/);
  assert.match(surfaceRegistrySource, /"npc-profile"/);
  assert.match(surfaceRegistrySource, /"edict-draft"/);
  assert.match(surfaceRegistrySource, /"memorial-review"/);
  assert.match(surfaceRegistrySource, /"map-filter"/);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|public\/assets\/ui\/portraits|ink-ui-manifest|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/);
});

test("S75.4 top-right inkbox unifies safe tools without widening data sources", () => {
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const uiStateSource = readText("client/src/state/uiState.ts");
  const styleSource = readText("client/src/styles/global.css");
  const combined = `${appShellSource}\n${surfaceHostSource}\n${uiStateSource}\n${styleSource}`;

  assert.match(appShellSource, /aria-label="打开印匣"/);
  assert.match(appShellSource, /openInkbox/);
  assert.doesNotMatch(appShellSource, /打开存档抽屉|打开显示偏好|打开安全摘要|打开设置抽屉/);
  assert.match(uiStateSource, /export type InkboxTab = "ai-settings" \| "saves" \| "display" \| "safe-summary"/);
  assert.match(uiStateSource, /activeInkboxTab/);
  assert.match(surfaceHostSource, /role="tablist"/);
  assert.match(surfaceHostSource, /推演/);
  assert.match(surfaceHostSource, /旧案/);
  assert.match(surfaceHostSource, /显示/);
  assert.match(surfaceHostSource, /摘要/);
  assert.match(surfaceHostSource, /loadSession\(sessionId\)/);
  assert.match(surfaceHostSource, /navigate\("\/"\)/);
  assert.match(styleSource, /inkboxButton/);
  assert.match(styleSource, /inkboxTabs/);
  assert.doesNotMatch(
    combined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S75.5 save cases show redacted metadata and load through player-state", () => {
  const homePageSource = readText("client/src/pages/HomePage.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const saveCaseSource = readText("client/src/components/SaveCaseList.tsx");
  const gameSessionStateSource = readText("client/src/state/gameSessionState.ts");
  const apiTypesSource = readText("client/src/api/types.ts");
  const styleSource = readText("client/src/styles/global.css");
  const combined = `${homePageSource}\n${surfaceHostSource}\n${saveCaseSource}\n${gameSessionStateSource}\n${apiTypesSource}\n${styleSource}`;
  const runtimeSourcesWithoutSanitizerPattern = stripSafeGuardPatterns(`${homePageSource}\n${surfaceHostSource}\n${apiTypesSource}\n${styleSource}`);

  assert.match(homePageSource, /<SaveCaseList saves=\{saves\} maxItems=\{5\}/);
  assert.match(homePageSource, /saveShelfState/);
  assert.match(homePageSource, /data-save-state=\{saveShelfState\}/);
  assert.match(homePageSource, /saveShelfStatus/);
  assert.match(homePageSource, /saveCaseSkeletonList/);
  assert.match(homePageSource, /旧案架暂不可取，新开案卷不受影响/);
  assert.match(homePageSource, /status === "error" \? error : null/);
  assert.match(surfaceHostSource, /prioritizeCurrentSaveCase\(saves, currentSessionId\)/);
  assert.match(surfaceHostSource, /<SaveCaseList saves=\{prioritizeCurrentSaveCase\(saves, currentSessionId\)\} maxItems=\{6\}/);
  assert.match(surfaceHostSource, /loadSession\(sessionId\)/);
  assert.match(saveCaseSource, /getSaveShortCode/);
  assert.match(saveCaseSource, /getSaveDateLabel/);
  assert.match(saveCaseSource, /getSaveTurnLabel/);
  assert.match(saveCaseSource, /getSaveUpdatedLabel/);
  assert.match(saveCaseSource, /isRunnableSessionId\(sessionId\)/);
  assert.match(saveCaseSource, /暂不可读/);
  assert.match(saveCaseSource, /unsafeSaveTextPattern/);
  assert.match(saveCaseSource, /safeTextOrFallback/);
  assert.match(saveCaseSource, /此卷暂无公开摘要/);
  assert.match(gameSessionStateSource, /async refreshSaves\(\)/);
  assert.match(gameSessionStateSource, /set\(\{ savesStatus: "loading" \}\)/);
  assert.doesNotMatch(gameSessionStateSource, /set\(\{ error: toErrorMessage\(error\), savesStatus: "error" \}\)/);
  assert.match(apiTypesSource, /readonly turnCount\?: number/);
  assert.match(apiTypesSource, /readonly summary\?: string \| null/);
  assert.match(styleSource, /saveCaseItem/);
  assert.match(styleSource, /saveShelfStatus/);
  assert.match(styleSource, /saveCaseEmpty/);
  assert.match(styleSource, /saveCaseSkeletonSweep/);
  assert.doesNotMatch(
    runtimeSourcesWithoutSanitizerPattern,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S75.6 return home keeps the current session and exposes a safe continue entry", () => {
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const homePageSource = readText("client/src/pages/HomePage.tsx");
  const uiStateSource = readText("client/src/state/uiState.ts");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const combined = `${appShellSource}\n${homePageSource}\n${uiStateSource}\n${clientSmokeSource}\n${styleSource}`;
  const runtimeSourcesWithoutSanitizerPattern = stripSafeGuardPatterns(`${appShellSource}\n${uiStateSource}\n${styleSource}`);

  assert.match(appShellSource, /data-shell-version="s75-9"/);
  assert.match(appShellSource, /aria-label="返回千秋首页"/);
  assert.match(appShellSource, /onClick=\{returnHome\}/);
  assert.match(uiStateSource, /page === "home" && sessionId === null/);
  assert.match(uiStateSource, /actionDraft: null/);
  assert.match(homePageSource, /isRunnableSessionId\(currentSessionId\)/);
  assert.match(homePageSource, /currentPlayerPayload\.sessionId === currentSessionId/);
  assert.match(homePageSource, /aria-label="当前本局"/);
  assert.match(homePageSource, /to=\{`\/game\/\$\{currentSessionId\}`\}/);
  assert.match(homePageSource, /safeHomeSummaryText/);
  assert.match(styleSource, /continueShelf/);
  assert.match(styleSource, /continueButton/);
  assert.match(clientSmokeSource, /assertReturnHomeContinueAndTurn/);
  assert.match(clientSmokeSource, /getByRole\("link", \{ name: "继续本局" \}\)/);
  assert.match(clientSmokeSource, /\/api\/game\/turn/);
  assert.doesNotMatch(
    runtimeSourcesWithoutSanitizerPattern,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S75.7 display preferences persist only local safe whitelist fields", () => {
  const storageSource = readText("client/src/state/displayPreferenceStorage.ts");
  const uiStateSource = readText("client/src/state/uiState.ts");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const reducedMotionHookSource = readText("client/src/hooks/usePrefersReducedMotion.ts");
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const appTestSource = readText("client/src/state/uiState.test.ts");
  const combined = `${storageSource}\n${uiStateSource}\n${surfaceHostSource}\n${appShellSource}\n${reducedMotionHookSource}\n${mapPageSource}\n${appTestSource}\n${clientSmokeSource}`;
  const storageSourceWithoutGuard = stripSafeGuardPatterns(storageSource);

  assert.match(storageSource, /displayPreferenceStorageKey = "qianqiu\.displayPreferences\.v1"/);
  assert.match(storageSource, /schemaVersion: displayPreferenceSchemaVersion/);
  assert.match(storageSource, /window\.localStorage/);
  assert.match(storageSource, /sanitizeDisplayPreferences/);
  assert.match(storageSource, /isDisplayPreferenceValue/);
  assert.match(appTestSource, /Object\.keys\(stored\.preferences\)\.sort\(\)/);
  assert.match(uiStateSource, /loadDisplayPreferences\(\)/);
  assert.match(uiStateSource, /saveDisplayPreferences\(\{/);
  assert.match(storageSource, /bodyFont: "serif-classic"/);
  assert.match(storageSource, /"song-xiaowei" \|\| value === "kai-longcang" \|\| value === "brush-mashan"/);
  assert.match(surfaceHostSource, /正文字体/);
  assert.match(surfaceHostSource, /典籍明晰/);
  assert.match(surfaceHostSource, /案卷宋刻/);
  assert.match(surfaceHostSource, /山房行楷/);
  assert.match(surfaceHostSource, /榜书墨笔/);
  assert.match(surfaceHostSource, /setDisplayPreference\("mapMotion"/);
  assert.match(appShellSource, /data-motion=\{displayPreferences\.motion\}/);
  assert.match(appShellSource, /data-shell-version="s75-9"/);
  assert.match(appShellSource, /data-text-size=\{displayPreferences\.textSize\}/);
  assert.match(appShellSource, /data-contrast=\{displayPreferences\.contrast\}/);
  assert.match(appShellSource, /data-body-font=\{displayPreferences\.bodyFont\}/);
  assert.match(reducedMotionHookSource, /prefers-reduced-motion: reduce/);
  assert.match(mapPageSource, /usePrefersReducedMotion/);
  assert.match(mapPageSource, /displayPreferences\.mapMotion && displayPreferences\.motion === "full" && !prefersReducedMotion/);
  assert.match(clientSmokeSource, /assertDisplayPreferencesPersistence/);
  assert.match(clientSmokeSource, /qianqiu\.displayPreferences\.v1/);
  assert.match(clientSmokeSource, /data-body-font/);
  assert.match(clientSmokeSource, /selectOption\("kai-longcang"\)/);
  assert.match(clientSmokeSource, /mapRuntime\.motion !== "reduced"/);
  assert.match(combined, /loads only versioned display preference fields and drops polluted values/);
  assert.match(combined, /saves a whitelist-only display preference payload/);
  assert.doesNotMatch(
    storageSourceWithoutGuard,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|sessionId|worldState|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S75.9 memorial composer uses safe AI quick actions as draft-only suggestions", () => {
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const composerSource = readText("client/src/components/MemorialComposer.tsx");
  const quickActionSource = readText("client/src/components/quickActionSuggestions.ts");
  const apiSource = readText("client/src/api/qianqiuClient.ts");
  const stateSource = readText("client/src/state/gameSessionState.ts");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const aiSettingsPanelSource = readText("client/src/components/AiSettingsPanel.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const componentTestSource = readText("client/src/components/MemorialComposer.test.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const runtimeCombined = `${appShellSource}\n${gamePageSource}\n${composerSource}\n${stateSource}\n${surfaceHostSource}\n${aiSettingsPanelSource}\n${styleSource}`;

  assert.match(appShellSource, /data-shell-version="s75-9"/);
  assert.match(gamePageSource, /<MemorialComposer/);
  assert.match(gamePageSource, /activePlayerPayload\?\.routeViews/);
  assert.match(gamePageSource, /refreshQuickActions\(sessionId/);
  assert.match(gamePageSource, /source: "role-surface", targetPage: "game"/);
  assert.match(apiSource, /\/api\/ai\/quick-actions\/\$\{encodePathSegment\(sessionId\)\}/);
  assert.match(stateSource, /quickActionStatus/);
  assert.match(stateSource, /requestQuickActions\(sessionId/);
  assert.match(composerSource, /aria-label="底部奏折"/);
  assert.match(composerSource, /Enter 呈上，Shift\+Enter 换行/);
  assert.match(composerSource, /event\.key !== "Enter" \|\| event\.shiftKey/);
  assert.match(composerSource, /data-source=\{suggestion\.source\}/);
  assert.match(composerSource, /data-draft-state=\{applied \? "written" : "idle"\}/);
  assert.match(composerSource, /aria-label=\{quickActionStatus === "loading" \? "快捷建议生成中" : "刷新快捷建议"\}/);
  assert.match(quickActionSource, /export type QuickActionSource = "local-rule" \| "mock-ai" \| "provider-ai" \| "map-runtime" \| "surface"/);
  assert.match(quickActionSource, /"local-rule": "本地建议"/);
  assert.match(quickActionSource, /"mock-ai": "本地推演"/);
  assert.match(quickActionSource, /sourceLabel: playerFacingQuickActionSourceLabel\(source\)/);
  assert.match(quickActionSource, /normalizeAiSuggestions/);
  assert.match(quickActionSource, /quickActionStatus === "error" \? "failed"/);
  assert.match(surfaceHostSource, /<AiSettingsPanel \/>/);
  assert.match(aiSettingsPanelSource, /推演设置/);
  assert.match(aiSettingsPanelSource, /updateGlobalAiSettings\(formSnapshot\(form\)\)/);
  assert.match(stateSource, /aiSettingsReadRequestId/);
  assert.match(stateSource, /aiSettingsWriteRequestId/);
  assert.match(stateSource, /aiSettingsActiveWriteRequestId/);
  assert.match(stateSource, /aiConnectionRequestId/);
  assert.match(stateSource, /aiConnectionStatus/);
  assert.match(aiSettingsPanelSource, /未保存编辑已保留/);
  assert.match(aiSettingsPanelSource, /正在整理推演分工/);
  assert.match(aiSettingsPanelSource, /暂无推演分工/);
  assert.match(aiSettingsPanelSource, /aiSettingsMatrixStatus/);
  assert.match(styleSource, /\.aiSettingsMatrixStatus/);
  assert.match(styleSource, /\.aiSettingsActions \.paperButton,[\s\S]*\.aiSettingsSummary \.paperButton[\s\S]*min-height: 44px/);
  assert.match(aiSettingsPanelSource, /const taskType = idValue\(record\.taskType/);
  assert.match(aiSettingsPanelSource, /\$\{route\.label\}辅佐次数/);
  assert.match(quickActionSource, /getMemorialPlaceholder/);
  assert.match(quickActionSource, /buildQuickActionSuggestions/);
  assert.match(styleSource, /memorialComposer/);
  assert.match(styleSource, /quickActionDock/);
  assert.match(styleSource, /overflow-wrap: anywhere/);
  assert.match(appTestSource, /keeps S75\.9 AI quick actions draft-only and submits only with Enter/);
  assert.match(componentTestSource, /without submitting a turn/);
  assert.match(componentTestSource, /renders AI quick action statuses and refresh controls/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/quick(?!-actions)|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S75.10 client smoke exercises the inkbox browser acceptance path", () => {
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(clientSmokeSource, /--client react/);
  assert.match(clientSmokeSource, /Unsupported client smoke target/);
  assert.match(clientSmokeSource, /assertInkboxTabsAndSaveLoad/);
  assert.match(clientSmokeSource, /assertMobileInkbox/);
  assert.match(clientSmokeSource, /getByRole\("button", \{ name: "打开印匣" \}\)/);
  assert.match(clientSmokeSource, /getByRole\("button", \{ name: "返回首页" \}\)/);
  assert.match(clientSmokeSource, /getByRole\("button", \{ name: "关闭抽屉" \}\)/);
  assert.match(clientSmokeSource, /AI_GLOBAL_SETTINGS_PATH/);
  assert.match(clientSmokeSource, /\/api\/ai\/settings\/global/);
  assert.match(clientSmokeSource, /快捷建议辅佐次数/);
  assert.match(clientSmokeSource, /\/api\/game\/player-state\/\$\{sessionId\}/);
  assert.match(clientSmokeSource, /desktop-inkbox-tabs/);
  assert.match(clientSmokeSource, /mobile-inkbox-tabs/);
  assert.match(clientSmokeSource, /aria-selected/);
});

test("S76.2 scholar panel uses safe study and exam projections as draft-only UI", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const scholarPanelSource = readText("client/src/components/ScholarPanel.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const scholarPanelWithoutGuard = scholarPanelSource.replace(/const unsafeScholarFragments[\s\S]*?\] as const;\r?\n/, "");
  const runtimeCombined = `${gamePageSource}\n${scholarPanelWithoutGuard}\n${styleSource}`;

  assert.match(gamePageSource, /<ScholarPanel/);
  assert.match(gamePageSource, /studyProfileView=\{activeSession\?\.studyProfileView/);
  assert.match(gamePageSource, /examCalendarView=\{activeSession\?\.examCalendarView/);
  assert.match(gamePageSource, /category: "role_background", usage: "game_main", role: knownRole/);
  assert.match(scholarPanelSource, /export function ScholarPanel/);
  assert.match(scholarPanelSource, /studyProfileView/);
  assert.match(scholarPanelSource, /examCalendarView/);
  assert.match(scholarPanelSource, /dailyRhythm/);
  assert.match(scholarPanelSource, /scholarPlanTimeline/);
  assert.match(scholarPanelSource, /执行首课/);
  assert.match(scholarPanelSource, /本页只写草稿/);
  assert.match(scholarPanelSource, /赶考、入场、评卷、放榜、晋级和授官都按案卷规则回批/);
  assert.match(styleSource, /scholarPanel/);
  assert.match(styleSource, /scholarPlanSummary/);
  assert.match(clientSmokeSource, /hasDeepPlan/);
  assert.match(clientSmokeSource, /missing deep study plan rhythm/);
  assert.match(appTestSource, /renders the S76\.2 scholar panel from safe study and calendar views as draft-only actions/);
  assert.match(appTestSource, /三旬后复盘/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|\/api\/exam\/question|\/api\/exam\/submit|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S76.3 magistrate panel uses safe local affairs projections as draft-only UI", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const magistratePanelSource = readText("client/src/components/MagistratePanel.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const magistratePanelWithoutGuard = magistratePanelSource.replace(/const unsafeMagistrateFragments[\s\S]*?\] as const;\r?\n/, "");
  const runtimeCombined = `${gamePageSource}\n${magistratePanelWithoutGuard}\n${styleSource}`;

  assert.match(gamePageSource, /<MagistratePanel/);
  assert.match(gamePageSource, /localAffairsDocketView=\{activeSession\?\.localAffairsDocketView/);
  assert.match(gamePageSource, /officialPostingsView=\{activeSession\?\.officialPostingsView/);
  assert.match(gamePageSource, /economicFiscalView=\{activeSession\?\.economicFiscalView/);
  assert.match(magistratePanelSource, /export function MagistratePanel/);
  assert.match(magistratePanelSource, /localAffairsDocketView/);
  assert.match(magistratePanelSource, /officialPostingsView/);
  assert.match(magistratePanelSource, /economicFiscalView/);
  assert.match(magistratePanelSource, /堂审只能形成行动意图/);
  assert.match(magistratePanelSource, /审案、征税、开仓、水利、缉捕、任免和考成都须候案卷回批/);
  assert.match(styleSource, /magistratePanel/);
  assert.match(appTestSource, /renders the S76\.3 magistrate panel from safe local affairs and fiscal views as draft-only actions/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|\/api\/exam\/question|\/api\/exam\/submit|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S76.4 official and minister panel uses safe career projections as draft-only UI", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const officialPanelSource = readText("client/src/components/OfficialMinisterPanel.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const typeSource = readText("client/src/api/types.ts");
  const officialPanelWithoutGuard = officialPanelSource.replace(/const unsafeOfficialMinisterFragments[\s\S]*?\] as const;\r?\n/, "");
  const runtimeCombined = `${gamePageSource}\n${officialPanelWithoutGuard}\n${styleSource}`;

  assert.match(gamePageSource, /<OfficialMinisterPanel/);
  assert.match(gamePageSource, /officialCareerView=\{activeSession\?\.officialCareerView/);
  assert.match(gamePageSource, /appointmentTrackView=\{activeSession\?\.appointmentTrackView/);
  assert.match(gamePageSource, /actorMemoryView=\{activeSession\?\.actorMemoryView/);
  assert.match(gamePageSource, /aiControlAuditView=\{activeSession\?\.aiControlAuditView/);
  assert.match(gamePageSource, /playerMonthlyBriefingView=\{activeSession\?\.playerMonthlyBriefingView/);
  assert.match(gamePageSource, /courtConsequenceView=\{activeSession\?\.courtConsequenceView/);
  assert.match(gamePageSource, /courtResponseView=\{activeSession\?\.courtResponseView/);
  assert.match(officialPanelSource, /export function OfficialMinisterPanel/);
  assert.match(officialPanelSource, /官职履历/);
  assert.match(officialPanelSource, /部院公文/);
  assert.match(officialPanelSource, /官署首月/);
  assert.match(officialPanelSource, /奏折朝议入口/);
  assert.match(officialPanelSource, /getCourtResponseDocket/);
  assert.match(officialPanelSource, /getCourtConsequenceDocket/);
  assert.match(officialPanelSource, /官场后果/);
  assert.match(officialPanelSource, /同年座师/);
  assert.match(officialPanelSource, /派系与朝局风险/);
  assert.match(officialPanelSource, /不得在前端直接任免、奖惩、处分、弹劾成案或改写考成/);
  assert.match(styleSource, /officialMinisterPanel/);
  assert.match(typeSource, /OfficialFirstMonthExperienceView/);
  assert.match(typeSource, /OfficialCourtEntryView/);
  assert.match(typeSource, /officialCareerView\?: OfficialCareerView/);
  assert.match(typeSource, /courtConsequenceView\?: CourtConsequenceView/);
  assert.match(typeSource, /courtResponseView\?: CourtResponseView/);
  assert.match(typeSource, /appointmentTrackView\?: JsonObject/);
  assert.match(typeSource, /actorMemoryView\?: JsonObject/);
  assert.match(typeSource, /playerMonthlyBriefingView\?: JsonObject/);
  assert.match(appTestSource, /renders the S76\.4 official minister panel from safe career views as draft-only actions/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|\/api\/exam\/question|\/api\/exam\/submit|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S76.5 general panel uses safe military projections as draft-only UI", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const generalPanelSource = readText("client/src/components/GeneralPanel.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const typeSource = readText("client/src/api/types.ts");
  const generalPanelWithoutGuard = generalPanelSource.replace(/const unsafeGeneralFragments[\s\S]*?\] as const;\r?\n/, "");
  const runtimeCombined = `${gamePageSource}\n${generalPanelWithoutGuard}\n${styleSource}`;

  assert.match(gamePageSource, /<GeneralPanel/);
  assert.match(gamePageSource, /militaryDiplomacyView=\{activeSession\?\.militaryDiplomacyView/);
  assert.match(gamePageSource, /mapRuntimeView=\{activeSession\?\.mapRuntimeView/);
  assert.match(gamePageSource, /eventArchiveView=\{activeSession\?\.eventArchiveView/);
  assert.match(gamePageSource, /actorMemoryView=\{activeSession\?\.actorMemoryView/);
  assert.match(generalPanelSource, /export function GeneralPanel/);
  assert.match(generalPanelSource, /军帐总览/);
  assert.match(generalPanelSource, /粮饷与军心/);
  assert.match(generalPanelSource, /斥候与情报/);
  assert.match(generalPanelSource, /边患与舆图/);
  assert.match(generalPanelSource, /战报与边议/);
  assert.match(generalPanelSource, /战役胜负、调兵遣将、外交和战、统帅任免、粮饷拨付与赏罚都须候案卷回批/);
  assert.match(styleSource, /generalPanel/);
  assert.match(typeSource, /militaryDiplomacyView\?: JsonObject/);
  assert.match(appTestSource, /renders the S76\.5 general panel from safe military views as draft-only actions/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|\/api\/exam\/question|\/api\/exam\/submit|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S76.6 emperor panel uses safe court projections as draft-only edict UI", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const emperorPanelSource = readText("client/src/components/EmperorPanel.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const typeSource = readText("client/src/api/types.ts");
  const emperorPanelWithoutGuard = emperorPanelSource.replace(/const unsafeEmperorFragments[\s\S]*?\] as const;\r?\n/, "");
  const runtimeCombined = `${gamePageSource}\n${emperorPanelWithoutGuard}\n${styleSource}`;

  assert.match(gamePageSource, /<EmperorPanel/);
  assert.match(gamePageSource, /officialPostingsView=\{activeSession\?\.officialPostingsView/);
  assert.match(gamePageSource, /eventArchiveView=\{activeSession\?\.eventArchiveView/);
  assert.match(gamePageSource, /actorMemoryView=\{activeSession\?\.actorMemoryView/);
  assert.match(gamePageSource, /aiControlAuditView=\{activeSession\?\.aiControlAuditView/);
  assert.match(gamePageSource, /worldEntityView=\{activeSession\?\.worldEntityView/);
  assert.match(gamePageSource, /worldThreadView=\{activeSession\?\.worldThreadView/);
  assert.match(gamePageSource, /courtConsequenceView=\{activeSession\?\.courtConsequenceView/);
  assert.match(gamePageSource, /courtResponseView=\{activeSession\?\.courtResponseView/);
  assert.match(emperorPanelSource, /export function EmperorPanel/);
  assert.match(emperorPanelSource, /奏折队列/);
  assert.match(emperorPanelSource, /奏议回应/);
  assert.match(emperorPanelSource, /getCourtConsequenceAgenda/);
  assert.match(emperorPanelSource, /官场后果/);
  assert.match(emperorPanelSource, /朱批拟稿/);
  assert.match(emperorPanelSource, /圣旨草稿/);
  assert.match(emperorPanelSource, /朝议/);
  assert.match(emperorPanelSource, /任免候选/);
  assert.match(emperorPanelSource, /赏罚预留/);
  assert.match(emperorPanelSource, /任免、赏罚、处分、朱批成案、圣旨生效和时间推进都须候案卷回批/);
  assert.match(styleSource, /emperorPanel/);
  assert.match(typeSource, /worldEntityView\?: JsonObject/);
  assert.match(typeSource, /worldThreadView\?: JsonObject/);
  assert.match(typeSource, /courtConsequenceView\?: CourtConsequenceView/);
  assert.match(typeSource, /courtResponseView\?: CourtResponseView/);
  assert.match(appTestSource, /renders the S76\.6 emperor panel from safe court views as draft-only edicts/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|\/api\/exam\/question|\/api\/exam\/submit|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S88.5 role cycle section is wired to all six identity panels as draft-only UI", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const roleCycleSource = readText("client/src/components/RoleCycleSection.tsx");
  const scholarPanelSource = readText("client/src/components/ScholarPanel.tsx");
  const magistratePanelSource = readText("client/src/components/MagistratePanel.tsx");
  const officialPanelSource = readText("client/src/components/OfficialMinisterPanel.tsx");
  const generalPanelSource = readText("client/src/components/GeneralPanel.tsx");
  const emperorPanelSource = readText("client/src/components/EmperorPanel.tsx");
  const stateSource = readText("client/src/state/uiState.ts");
  const typeSource = readText("client/src/api/types.ts");
  const styleSource = readText("client/src/styles/global.css");
  const roleCycleWithoutGuard = roleCycleSource.replace(/const unsafeRoleCycleFragments[\s\S]*?\] as const;\r?\n/, "");
  const runtimeCombined = `${roleCycleWithoutGuard}\n${styleSource}`;

  assert.match(gamePageSource, /roleCycleView=\{activeSession\?\.roleCycleView \?\? null\}/);
  assert.match(gamePageSource, /hasRoleCycleView/);
  assert.match(gamePageSource, /resolveRoleCycleRouteHref/);
  assert.match(gamePageSource, /onOpenRoleCycleSurface/);
  for (const source of [scholarPanelSource, magistratePanelSource, officialPanelSource, generalPanelSource, emperorPanelSource]) {
    assert.match(source, /import \{ RoleCycleSection \}/);
    assert.match(source, /readonly roleCycleView\?: JsonObject \| null/);
    assert.match(source, /resolveRoleCycleRouteHref/);
    assert.match(source, /onOpenRoleCycleSurface/);
    assert.match(source, /<RoleCycleSection/);
    assert.match(source, /source: "role-surface", targetPage: "game"|onDraft=\{onDraft\}/);
  }
  assert.match(roleCycleSource, /本旬身份循环/);
  assert.match(roleCycleSource, /cycleRoleMatrix/);
  assert.match(roleCycleSource, /roleMatrix/);
  assert.match(roleCycleSource, /roleCycleSourceViewLabels/);
  assert.match(roleCycleSource, /cycleSourceLabels/);
  assert.match(roleCycleSource, /cycleFocusStats/);
  assert.match(roleCycleSource, /cycleBoundarySummary/);
  assert.match(roleCycleSource, /dedupeCycleEvidenceRefs/);
  assert.match(roleCycleSource, /localRoleCyclePathPattern/);
  assert.match(roleCycleSource, /users\|private/);
  assert.match(roleCycleSource, /aiReadScope/);
  assert.match(roleCycleSource, /allowedSourceViews/);
  assert.match(roleCycleSource, /toolPermissions/);
  assert.match(roleCycleSource, /proposalBoundaries/);
  assert.match(roleCycleSource, /serverAdjudication/);
  assert.match(roleCycleSource, /safety/);
  assert.match(roleCycleSource, /authorityTier/);
  assert.match(roleCycleSource, /pressureScore/);
  assert.match(roleCycleSource, /summary: cleanRoleCycleText/);
  assert.match(roleCycleSource, /dateLabel/);
  assert.match(roleCycleSource, /generatedAtTurn/);
  assert.match(roleCycleSource, /本身份速览/);
  assert.match(roleCycleSource, /本身份公开取材/);
  assert.match(roleCycleSource, /本身份取材/);
  assert.match(roleCycleSource, /可读材料与裁决边界/);
  assert.match(roleCycleSource, /可读材料/);
  assert.match(roleCycleSource, /六身份矩阵/);
  assert.match(roleCycleSource, /data-active=\{entry\.active \? "true" : "false"\}/);
  assert.match(roleCycleSource, /aria-current=\{entry\.active \? "true" : undefined\}/);
  assert.match(roleCycleSource, /职责层级 \{entry\.authorityTier\}/);
  assert.match(roleCycleSource, /roleCycleMatrixSources/);
  assert.match(roleCycleSource, /roleCycleMatrixPressure/);
  assert.match(roleCycleSource, /本身份 · \$\{entry\.itemCount\} 项可见事务/);
  assert.match(roleCycleSource, /待任后展开/);
  assert.match(roleCycleSource, /本旬事务/);
  assert.match(roleCycleSource, /风险/);
  assert.match(roleCycleSource, /aria-label="可查入口"/);
  assert.match(roleCycleSource, /aria-label="可拟草稿"/);
  assert.match(roleCycleSource, /onClick=\{\(\) => onDraft\(action\.text\)\}/);
  assert.match(roleCycleSource, /roleCycleMatrix/);
  assert.match(roleCycleSource, /roleCycleEvidenceRefs/);
  assert.match(roleCycleSource, /targetRouteId/);
  assert.match(roleCycleSource, /markOverlayTrigger/);
  assert.match(typeSource, /export type RoleCycleView/);
  assert.match(typeSource, /export type RoleCycleEvidenceRef/);
  assert.match(typeSource, /export type RoleCycleEntryPoint/);
  assert.match(typeSource, /roleCycleView\?: RoleCycleView/);
  assert.match(stateSource, /hasRoleCycleView: Boolean\(payload\.roleCycleView\)/);
  assert.match(styleSource, /roleCycleSection/);
  assert.match(styleSource, /roleCycleFocusStrip/);
  assert.match(styleSource, /roleCycleCurrentEvidence/);
  assert.match(styleSource, /roleCycleBoundary/);
  assert.match(styleSource, /roleCycleBoundaryChips/);
  assert.match(styleSource, /roleCycleBoundarySources/);
  assert.match(styleSource, /roleCycleMatrix/);
  assert.match(styleSource, /roleCycleMatrixHeading/);
  assert.match(styleSource, /roleCycleMatrixSources/);
  assert.match(styleSource, /roleCycleMatrixPressure/);
  assert.match(styleSource, /roleCycleMetrics/);
  assert.match(styleSource, /roleCycleColumns/);
  assert.match(styleSource, /roleCycleEvidenceRefs/);
  assert.match(styleSource, /roleCycleEntryPoints/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/game\/turn|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S88.6 domain consequence view is wired into authority role panels as draft-only UI", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const domainConsequenceSource = readText("client/src/components/DomainConsequenceSection.tsx");
  const magistratePanelSource = readText("client/src/components/MagistratePanel.tsx");
  const officialPanelSource = readText("client/src/components/OfficialMinisterPanel.tsx");
  const generalPanelSource = readText("client/src/components/GeneralPanel.tsx");
  const emperorPanelSource = readText("client/src/components/EmperorPanel.tsx");
  const stateSource = readText("client/src/state/uiState.ts");
  const typeSource = readText("client/src/api/types.ts");
  const surfaceRegistrySource = readText("client/src/surfaces/surfaceRegistry.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const smokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const domainConsequenceWithoutGuard = stripSafeGuardPatterns(domainConsequenceSource);
  const runtimeCombined = `${gamePageSource}\n${domainConsequenceWithoutGuard}\n${styleSource}`;

  assert.match(typeSource, /export type DomainConsequenceItemView/);
  assert.match(typeSource, /export type DomainConsequenceView/);
  assert.match(typeSource, /domainConsequenceView\?: DomainConsequenceView/);
  assert.match(stateSource, /hasDomainConsequenceView: Boolean\(payload\.domainConsequenceView\)/);
  assert.match(gamePageSource, /\{ label: "后果", ready: Boolean\(routeViews\?\.hasDomainConsequenceView\) \}/);
  assert.match(gamePageSource, /domainConsequenceView=\{activeSession\?\.domainConsequenceView \?\? null\}/);
  for (const source of [magistratePanelSource, officialPanelSource, generalPanelSource, emperorPanelSource]) {
    assert.match(source, /import \{ DomainConsequenceSection \}/);
    assert.match(source, /readonly domainConsequenceView\?: JsonObject \| null/);
    assert.match(source, /<DomainConsequenceSection/);
    assert.match(source, /domainConsequenceView=\{domainConsequenceView\}/);
    assert.match(source, /onDraft=\{onDraft\}/);
  }
  assert.match(domainConsequenceSource, /领域后果追踪/);
  assert.match(domainConsequenceSource, /recentConsequences/);
  assert.match(domainConsequenceSource, /nextActions/);
  assert.match(domainConsequenceSource, /stateDelta/);
  assert.match(domainConsequenceSource, /playerDelta/);
  assert.match(domainConsequenceSource, /evidenceRefs/);
  assert.match(domainConsequenceSource, /outcomeId/);
  assert.match(domainConsequenceSource, /auditRecord/);
  assert.match(domainConsequenceSource, /draftContext/);
  assert.match(domainConsequenceSource, /server adjudication/);
  assert.match(domainConsequenceSource, /AI read scope/i);
  assert.match(domainConsequenceSource, /proposal boundary/);
  assert.match(domainConsequenceSource, /cityPolicyLedger/);
  assert.match(domainConsequenceSource, /militaryDiplomacyLedger/);
  assert.match(domainConsequenceSource, /judicialCaseLedger/);
  assert.match(domainConsequenceSource, /npcEconomyLedger/);
  assert.doesNotMatch(domainConsequenceSource, /fetch\(|submitTurn\(|\/api\/game\/turn|dangerouslySetInnerHTML/);
  assert.match(styleSource, /domainConsequenceSection/);
  assert.match(styleSource, /domainConsequenceList/);
  assert.match(appTestSource, /续记地方后果/);
  assert.match(appTestSource, /续记军务后果/);
  assert.match(appTestSource, /续记跨域后果/);
  assert.match(appTestSource, /御览天下余波/);
  assert.match(surfaceRegistrySource, /公开后果/);
  assert.match(smokeSource, /hasDomainConsequence/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/game\/turn|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S88.8 economy trace view is wired into magistrate and official main panels as draft-only UI", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const economyTraceSource = readText("client/src/components/EconomyTraceSection.tsx");
  const magistratePanelSource = readText("client/src/components/MagistratePanel.tsx");
  const officialPanelSource = readText("client/src/components/OfficialMinisterPanel.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const stateSource = readText("client/src/state/uiState.ts");
  const typeSource = readText("client/src/api/types.ts");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const economyTraceWithoutGuard = stripSafeGuardPatterns(economyTraceSource);
  const magistrateWithoutGuard = stripSafeGuardPatterns(magistratePanelSource);
  const officialWithoutGuard = stripSafeGuardPatterns(officialPanelSource);
  const runtimeCombined = `${gamePageSource}\n${economyTraceWithoutGuard}\n${magistrateWithoutGuard}\n${officialWithoutGuard}\n${surfaceHostSource}`;

  assert.match(typeSource, /export type EconomyTraceView/);
  assert.match(typeSource, /readonly sourceId\?: string/);
  assert.match(typeSource, /readonly topicSurfaceIds\?: readonly string\[\]/);
  assert.match(typeSource, /economyTraceView\?: EconomyTraceView/);
  assert.match(stateSource, /hasEconomyTraceView: Boolean\(payload\.economyTraceView\)/);
  assert.match(gamePageSource, /\{ label: "账解", ready: Boolean\(routeViews\?\.hasEconomyTraceView\) \}/);
  assert.match(gamePageSource, /economyTraceView=\{activeSession\?\.economyTraceView \?\? null\}/);
  for (const source of [magistratePanelSource, officialPanelSource]) {
    assert.match(source, /import \{ EconomyTraceSection \}/);
    assert.match(source, /readonly economyTraceView\?: EconomyTraceView \| null/);
    assert.match(source, /<EconomyTraceSection/);
    assert.match(source, /traceView=\{economyTraceView\}/);
    assert.match(source, /traceTypes=\{/);
    assert.match(source, /onDraft=\{onDraft\}/);
  }
  assert.match(magistratePanelSource, /钱粮与市价为何变化/);
  assert.match(officialPanelSource, /经济线索与官署材料/);
  assert.match(economyTraceSource, /拟复核/);
  assert.match(surfaceHostSource, /economyTraceView/);
  assert.match(surfaceHostSource, /经济解释/);
  assert.match(surfaceHostSource, /topicSourceLabel\(source\.sourceView\)/);
  assert.match(appTestSource, /钱粮与市价为何变化/);
  assert.match(appTestSource, /经济线索与官署材料/);
  assert.match(appTestSource, /经济解释 1 条/);
  assert.match(appTestSource, /经济解释 · 月账/);
  assert.doesNotMatch(economyTraceWithoutGuard, /fetch\(|submitTurn\(|\/api\/game\/turn|dangerouslySetInnerHTML/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S88.7 topic surfaces label NPC relationship action evidence as read-only interaction records", () => {
  const resolverConfigSource = readText("src/game/resolverInputConfig.js");
  const resolverContextSource = readText("src/game/resolverInputContext.js");
  const npcInteractionSource = readText("src/game/npcInteractions.js");
  const safeSearchSource = readText("src/game/safeWorldSearch.js");
  const topicSurfaceSource = readText("src/game/topicSurfaceView.js");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const topicSourceLabelSnippet = surfaceHostSource.slice(
    surfaceHostSource.indexOf("function topicSourceLabel"),
    surfaceHostSource.indexOf("function TopicSurfaceWorkbench")
  );
  const npcEvidenceBuilderSnippet = npcInteractionSource.slice(
    npcInteractionSource.indexOf("function buildNpcRelationshipActionEvidenceRowsFromRecords"),
    npcInteractionSource.indexOf("function buildNpcInteractionLedgerView")
  );
  const trialTopicSnippet = topicSurfaceSource.slice(
    topicSurfaceSource.indexOf("trial: Object.freeze"),
    topicSurfaceSource.indexOf('"war-council": Object.freeze')
  );
  const peopleRelationshipAgendaSnippet = peoplePageSource.slice(
    peoplePageSource.indexOf("function collectRelationshipAgendaThreads"),
    peoplePageSource.indexOf("function statusLabel")
  );

  assert.match(npcInteractionSource, /relationshipActionEvidence/);
  assert.match(npcInteractionSource, /npc_relationship_action_resolver/);
  assert.match(npcInteractionSource, /NPC_RELATIONSHIP_ACTION_TOPIC_SURFACES/);
  assert.match(npcInteractionSource, /"npc-profile"/);
  assert.match(npcInteractionSource, /"court-debate"/);
  assert.match(npcInteractionSource, /"memorial-review"/);
  assert.match(resolverConfigSource, /sourceView: "npcInteractionView"/);
  assert.match(resolverConfigSource, /collections: Object\.freeze\(\["relationshipActionEvidence"\]\)/);
  assert.match(resolverContextSource, /buildNpcInteractionLedgerView/);
  assert.match(safeSearchSource, /npcInteractionView\.relationshipActionEvidence/);
  assert.match(topicSurfaceSource, /"memorial-review": Object\.freeze\([\s\S]*?"npcInteractionView"/);
  assert.match(topicSurfaceSource, /"court-debate": Object\.freeze\([\s\S]*?"npcInteractionView"/);
  assert.match(topicSurfaceSource, /"npc-profile": Object\.freeze\([\s\S]*?"npcInteractionView"/);
  assert.doesNotMatch(trialTopicSnippet, /"npcInteractionView"/);
  assert.match(surfaceHostSource, /交游记录/);
  assert.match(surfaceHostSource, /交游记录 · \$\{domain\}/);
  assert.match(peoplePageSource, /localPeoplePathPattern/);
  assert.match(peoplePageSource, /home\|Users\|private\|mnt\|tmp\|var\|etc\|usr\|opt/);
  assert.match(peopleRelationshipAgendaSnippet, /sourceType !== "npc_relationship_action"/);
  assert.match(peopleRelationshipAgendaSnippet, /peopleTextLooksUnsafe/);
  assert.match(peoplePageSource, /<h2>交游议题<\/h2>/);
  assert.match(peoplePageSource, /拟跟进/);
  assert.match(appTestSource, /交游记录 1 条/);
  assert.match(appTestSource, /交游记录 · 案牍/);
  assert.match(appTestSource, /交游记录：沈砚秋论道/);
  assert.match(appTestSource, /\/mnt\/e\/LSMNQ\/\.env/);
  assert.match(appTestSource, /交游记录，\/home\/zzz\/project\/\.env/);
  assert.match(npcEvidenceBuilderSnippet, /sourceType: "npc_relationship_action"/);
  assert.match(npcEvidenceBuilderSnippet, /sourceLabel: "交游记录"/);
  assert.match(npcEvidenceBuilderSnippet, /visibility: "player_visible"/);
  assert.match(npcEvidenceBuilderSnippet, /boundary: "交游记录只作只读证据/);
  assert.match(npcEvidenceBuilderSnippet, /serverOwnsOutcome/);
  assert.doesNotMatch(
    `${topicSourceLabelSnippet}\n${npcEvidenceBuilderSnippet}\n${peopleRelationshipAgendaSnippet}`,
    /fetch\(|submitTurn\(|\/api\/game\/state|\/api\/dev\/session-diagnostics|\/api\/game\/turn|npcInteractionLedger|relationshipImpactView|resourceImpactView|worldPeopleImpactView|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S76.7 exam page renders immersive safe exam flow without widening authority", () => {
  const examPageSource = readText("client/src/pages/ExamPage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const apiTypesSource = readText("client/src/api/types.ts");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const examPageWithoutGuard = examPageSource.replace(/const unsafeExamFragments[\s\S]*?\] as const;\r?\n/, "");
  const runtimeCombined = `${examPageWithoutGuard}\n${styleSource}`;

  assert.match(examPageSource, /export function ExamPage/);
  assert.match(examPageSource, /useAssetRegistry/);
  assert.match(examPageSource, /category: "scene", usage: "exam_page"/);
  assert.match(examPageSource, /safeExamText/);
  assert.match(examPageSource, /formatWordCountLabel/);
  assert.match(examPageSource, /贡院号舍/);
  assert.match(examPageSource, /examStageRail/);
  assert.match(examPageSource, /examImmersiveLayout/);
  assert.match(examPageSource, /examQuestionText/);
  assert.match(examPageSource, /写作区字数与草稿状态/);
  assert.match(examPageSource, /同场考生、阅卷官与榜单只显示公开占位/);
  assert.match(examPageSource, /入场后反馈/);
  assert.match(examPageSource, /phaseFeedback/);
  assert.match(examPageSource, /setActionDraft/);
  assert.match(examPageSource, /source: "exam", targetPage: "game"/);
  assert.match(examPageSource, /交卷、评分、舞弊、放榜、晋级和授官都回主卷定夺/);
  assert.match(examPageSource, /requestExamQuestion\(sessionId, level\)/);
  assert.match(examPageSource, /progressExam\(sessionId, examId, sceneAction\.trim\(\)\)/);
  assert.match(examPageSource, /submitExam\(sessionId, examId, essay\.trim\(\)\)/);
  assert.match(examPageSource, /defaultExamLevel: ExamLevel = "child_exam"/);
  assert.match(examPageSource, /setLevel\(defaultExamLevel\)/);
  assert.match(examPageSource, /setSceneAction\(defaultSceneAction\)/);
  assert.match(examPageSource, /setEssay\(defaultEssay\)/);
  assert.match(examPageSource, /\}, \[sessionId\]\)/);
  assert.match(styleSource, /examFullScreen/);
  assert.match(styleSource, /examHero/);
  assert.match(styleSource, /examSealSubmitButton/);
  assert.match(apiTypesSource, /examProcedureView\?: ExamProcedureView/);
  assert.match(apiTypesSource, /export type ExamPhaseFeedbackView/);
  assert.match(apiTypesSource, /phaseFeedback\?: ExamPhaseFeedbackView/);
  assert.match(apiTypesSource, /examinerPanelView\?: JsonObject/);
  assert.match(apiTypesSource, /examRivalView\?: JsonObject/);
  assert.match(apiTypesSource, /examHonorView\?: JsonObject/);
  assert.match(apiTypesSource, /export type ExamWordCount/);
  assert.match(clientSmokeSource, /assertExamFullScreen/);
  assert.match(clientSmokeSource, /exam route left the exam shell after requesting a question/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S79.1 session feature routes use a lightweight shell outside the main卷", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const gameTabsBlock = gamePageSource.match(/const gameTabs = \[[\s\S]*?\] as const;/)?.[0] || "";

  assert.match(gamePageSource, /independentSessionRouteIds/);
  assert.match(gamePageSource, /"people", "inventory", "archive", "exam", "ranking", "court", "settings"/);
  assert.match(gamePageSource, /getIndependentSessionRouteId/);
  assert.doesNotMatch(gameTabsBlock, /settings|印匣/);
  assert.match(gamePageSource, /sessionRouteShell/);
  assert.match(gamePageSource, /SessionRouteNav/);
  assert.match(styleSource, /sessionRouteShell/);
  assert.match(styleSource, /routePanelRise/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\] \.sessionRouteShell > \.surfacePanel/);
  assert.match(styleSource, /prefers-reduced-motion: reduce[\s\S]*\.sessionRouteShell > \.surfacePanel/);
  assert.match(clientSmokeSource, /assertIndependentSessionRouteShell/);
  assert.match(clientSmokeSource, /rendered bottom memorial composer/);
  assert.match(appTestSource, /document\.querySelector\("\.gameCommandBar"\)\)\.toBeFalsy/);
  assert.match(appTestSource, /document\.querySelector\("\.gameMainDeck"\)\)\.toBeFalsy/);
});

test("S89.3 settings route is a directory into the single inkbox surface", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const roleCycleSource = readText("client/src/components/RoleCycleSection.tsx");
  const settingsPageSource = readText("client/src/pages/SettingsPage.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const roleCycleRouteSet = roleCycleSource.match(/const roleCycleRouteIds = new Set\([\s\S]*?\);/)?.[0] || "";

  assert.match(settingsPageSource, /settingsDirectoryRoute/);
  assert.match(settingsPageSource, /settingsCards/);
  assert.match(settingsPageSource, /openInkbox\(tab\)/);
  assert.match(settingsPageSource, /markOverlayTrigger/);
  assert.match(settingsPageSource, /案头工具/);
  assert.match(settingsPageSource, /此页只作案头整理/);
  assert.doesNotMatch(settingsPageSource, /<AiSettingsPanel/);
  assert.match(surfaceHostSource, /<AiSettingsPanel \/>/);
  assert.match(surfaceHostSource, /aria-label="印匣分栏"/);
  assert.match(gamePageSource, /independentSessionRouteIds = new Set\(\["people", "inventory", "archive", "exam", "ranking", "court", "settings"\]\)/);
  assert.doesNotMatch(roleCycleRouteSet, /settings/);
  assert.match(clientSmokeSource, /settings still appeared as a session nav link/);
  assert.match(clientSmokeSource, /label: "印匣页"/);
  assert.match(clientSmokeSource, /viaNav: false/);
  assert.match(clientSmokeSource, /settingsDirectoryRoute/);
  assert.match(clientSmokeSource, /hasAiSettingsPanel/);
  assert.match(clientSmokeSource, /assertS895MaterialFeedbackPolish/);
  assert.match(settingsPageSource, /data-polish-surface="s89-5-settings-directory"/);
  assert.match(settingsPageSource, /data-polish-card="s89-5-settings-card"/);
  assert.match(appTestSource, /keeps the settings route as a directory into one inkbox tool surface/);
  assert.match(styleSource, /\.settingsDirectoryCard/);
  assert.match(styleSource, /\.settingsDirectoryCard::after/);
  assert.match(styleSource, /\.statePage/);
  assert.doesNotMatch(
    settingsPageSource,
    /数据来源|裁决边界|服务器裁决|draftContext|schema|manifest|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥/
  );
});

test("S89.13 inkbox settings polish stays player-facing and local", () => {
  const settingsPageSource = readText("client/src/pages/SettingsPage.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const combined = stripSafeGuardPatterns(`${settingsPageSource}\n${surfaceHostSource}\n${styleSource}`);

  assert.match(settingsPageSource, /data-polish-settings="s89-13-settings-directory"/);
  assert.match(settingsPageSource, /settingsDirectoryBadges/);
  assert.match(settingsPageSource, /全局生效/);
  assert.match(settingsPageSource, /低动效可用/);
  assert.match(settingsPageSource, /不载私记/);
  assert.match(surfaceHostSource, /data-polish-settings="s89-13-inkbox-overview"/);
  assert.match(surfaceHostSource, /data-polish-settings="s89-13-display-panel"/);
  assert.match(surfaceHostSource, /data-polish-settings="s89-13-safe-summary"/);
  assert.match(surfaceHostSource, /buildDisplayPreferenceLedger/);
  assert.match(surfaceHostSource, /safePayloadSourceLabel/);
  assert.match(surfaceHostSource, /prioritizeCurrentSaveCase/);
  assert.match(surfaceHostSource, /主卷载入/);
  assert.doesNotMatch(surfaceHostSource, /<dd>\{payload\.source\}<\/dd>/);
  assert.match(styleSource, /\.inkboxOverview/);
  assert.match(styleSource, /\.displayPreferenceLedger/);
  assert.match(settingsPageSource, /settingsDirectoryBadges peopleMeta/);
  assert.match(appTestSource, /s89-13-inkbox-overview/);
  assert.match(appTestSource, /主卷载入/);
  assert.match(clientSmokeSource, /S89\.13 display preference polish/);
  assert.match(clientSmokeSource, /S89\.13 safe summary polish/);
  assert.match(clientSmokeSource, /hasS8913Marker/);
  assert.doesNotMatch(
    combined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data\/sessions|完整提示词|本地路径|密钥/
  );
});

test("S89.14 player identity labels stay Chinese and centralized", () => {
  const playerLabelsSource = readText("client/src/text/playerLabels.ts");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const homePageSource = readText("client/src/pages/HomePage.tsx");
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const saveCaseSource = readText("client/src/components/SaveCaseList.tsx");
  const settingsPageSource = readText("client/src/pages/SettingsPage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const combined = `${surfaceHostSource}\n${homePageSource}\n${gamePageSource}\n${peoplePageSource}\n${saveCaseSource}`;

  assert.match(playerLabelsSource, /export function getGameRoleLabel/);
  assert.match(playerLabelsSource, /export function getPlayerIdentityLabel/);
  assert.match(playerLabelsSource, /scholar:\s*"书生"/);
  assert.match(playerLabelsSource, /junior_official:\s*"初入仕官员"/);
  assert.match(playerLabelsSource, /const roleLabel = getGameRoleLabel\(clean\)/);
  assert.match(playerLabelsSource, /if \(roleLabel\) return roleLabel/);
  assert.match(playerLabelsSource, /return getGameRoleLabel\(player\.role\) \|\| fallback/);
  assert.match(surfaceHostSource, /getPlayerIdentityLabel\(payload\?\.player\)/);
  assert.match(surfaceHostSource, /getPlayerIdentityLabel\(player, "案主", 36\)/);
  assert.match(surfaceHostSource, /getGameRoleLabel\(player\.role\) \|\| "案主"/);
  assert.match(homePageSource, /getPlayerIdentityLabel\(payload\.player\)/);
  assert.match(gamePageSource, /getPlayerIdentityLabel\(player\)/);
  assert.match(peoplePageSource, /getPlayerIdentityLabel\(player, "身份未题", 40\)/);
  assert.match(saveCaseSource, /getPlayerIdentityLabel\(save\)/);
  assert.match(settingsPageSource, /settingsDirectoryBadges peopleMeta/);
  assert.doesNotMatch(styleSource, /\.settingsDirectoryBadges\s*\{/);
  assert.match(appTestSource, /入仕官员/);
  assert.match(clientSmokeSource, /rawRoleTerms/);
  assert.doesNotMatch(combined, /roleLabels\s*:/);
  assert.doesNotMatch(combined, /\|\|\s*(?:player|payload\?\.player|portrait)\.role\b/);
});

test("S89.15 follow-up and economy evidence readers keep player-facing labels", () => {
  const npcEvidenceSource = readText("client/src/components/NpcFollowUpEvidenceSection.tsx");
  const economyTraceSource = readText("client/src/components/EconomyTraceSection.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const runtimeCombined = stripSafeGuardPatterns(`${npcEvidenceSource}\n${economyTraceSource}\n${peoplePageSource}`);

  assert.match(npcEvidenceSource, /data-polish-evidence="s89-15-follow-up-reader"/);
  assert.match(npcEvidenceSource, /data-polish-evidence-boundary="s89-15-follow-up-boundary"/);
  assert.match(npcEvidenceSource, /npcEvidenceLabelMap/);
  assert.match(npcEvidenceSource, /accepted_pending_server_resolution:\s*"已收呈待复核"/);
  assert.match(npcEvidenceSource, /human_debt_monthly:\s*"人情债月账"/);
  assert.match(npcEvidenceSource, /relationship_risk_watchlist:\s*"关系风险留察"/);
  assert.match(npcEvidenceSource, /riskTags: \(item\.riskTags \?\? \[\]\)/);
  assert.match(npcEvidenceSource, /\.map\(\(tag\) => cleanNpcEvidenceLabel\(tag, "", 24\)\)/);
  assert.match(npcEvidenceSource, /localNpcEvidencePathPattern/);
  assert.match(npcEvidenceSource, /safe view/);
  assert.match(economyTraceSource, /data-polish-evidence="s89-15-economy-reader"/);
  assert.match(economyTraceSource, /data-polish-evidence-boundary="s89-15-economy-boundary"/);
  assert.match(economyTraceSource, /economyTraceLabelMap/);
  assert.match(economyTraceSource, /trade_negotiation:\s*"交易议价"/);
  assert.match(economyTraceSource, /under_review:\s*"待复核"/);
  assert.match(economyTraceSource, /localEconomyTracePathPattern/);
  assert.match(economyTraceSource, /safe view/);
  assert.match(peoplePageSource, /relationshipAgendaLabelMap/);
  assert.match(peoplePageSource, /npc_relationship_action:\s*"交游记录"/);
  assert.match(peoplePageSource, /safePeopleLabel/);
  assert.match(peoplePageSource, /sourceRef/);
  assert.match(appTestSource, /s89-15-follow-up-reader/);
  assert.match(appTestSource, /s89-15-economy-reader/);
  assert.match(appTestSource, /accepted_pending_server_resolution/);
  assert.match(appTestSource, /human_debt_monthly/);
  assert.match(appTestSource, /relationship_risk_watchlist/);
  assert.match(appTestSource, /trade_negotiation/);
  assert.match(appTestSource, /under_review/);
  assert.match(clientSmokeSource, /s89-15-economy-reader/);
  assert.match(clientSmokeSource, /s89-15-economy-boundary/);
  assert.match(clientSmokeSource, /safe view\|resolver\|sourceRef\|relatedRefs\|scopeRefs/);
  assert.doesNotMatch(styleSource, /s89-15/);
  assert.doesNotMatch(runtimeCombined, /fetch\(|submitTurn\(|\/api\/game\/turn|dangerouslySetInnerHTML|localStorage|sessionStorage/);
});

test("S89.5 material polish stays frontend-only and reduced-motion aware", () => {
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const settingsPageSource = readText("client/src/pages/SettingsPage.tsx");
  const portraitSource = readText("client/src/components/Portrait.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const runtimeCombined = stripSafeGuardPatterns(`${appShellSource}\n${surfaceHostSource}\n${mapPageSource}\n${settingsPageSource}\n${portraitSource}\n${styleSource}`);

  assert.match(appShellSource, /data-polish-surface="s89-5-material-feedback"/);
  assert.match(surfaceHostSource, /data-polish-overlay="s89-5-drawer-mica"/);
  assert.match(surfaceHostSource, /data-polish-overlay="s89-5-modal-paper"/);
  assert.match(surfaceHostSource, /data-polish-overlay="s89-5-surface-paper"/);
  assert.match(surfaceHostSource, /data-polish-overlay="s89-5-portrait-gallery"/);
  assert.match(mapPageSource, /lastWrittenMapDraftId/);
  assert.match(mapPageSource, /data-polish-surface="s89-5-map-command"/);
  assert.match(mapPageSource, /data-polish-action="s89-5-map-layer"/);
  assert.match(mapPageSource, /data-polish-card="s89-5-map-ledger"/);
  assert.match(mapPageSource, /data-draft-state=\{lastWrittenMapDraftId === entry\.id \? "written" : "idle"\}/);
  assert.match(mapPageSource, /data-draft-state=\{lastWrittenMapDraftId === eventItem\.id \? "written" : "idle"\}/);
  assert.match(appShellSource, /data-polish-controls="s89-16-shell-controls"/);
  assert.match(appShellSource, /data-polish-controls="s89-16-inkbox-button"/);
  assert.doesNotMatch(appShellSource, /topBarPolishStyle|inkboxButtonPolishStyle|CSSProperties|style=\{topBarPolishStyle\}|style=\{inkboxButtonPolishStyle\}/);
  assert.match(styleSource, /@keyframes drawerPanelFade/);
  assert.match(styleSource, /@keyframes draftWrittenPulse/);
  assert.match(styleSource, /\.topBar::after/);
  assert.match(styleSource, /backdrop-filter: blur\(14px\) saturate\(1\.08\)/);
  assert.match(styleSource, /\.topNav a\[aria-current="page"\]/);
  assert.match(styleSource, /\.inkboxButton::before/);
  assert.match(styleSource, /\.inkboxButton::after/);
  assert.match(styleSource, /\.inkboxButton:active/);
  assert.match(styleSource, /\.paperLink:hover:not\(:disabled\):not\(\[aria-disabled="true"\]\)/);
  assert.match(styleSource, /\.paperMotionDraft\[data-draft-state="written"\]/);
  assert.match(styleSource, /@keyframes drawerPanelFade[\s\S]*opacity: \.9/);
  assert.match(styleSource, /@keyframes draftWrittenPulse[\s\S]*outline: 2px solid var\(--qq-color-vermilion-glow-outline\)/);
  assert.doesNotMatch(styleSource, /@keyframes drawerPanelFade\s*\{\s*\}/);
  assert.doesNotMatch(styleSource, /@keyframes draftWrittenPulse\s*\{\s*\}/);
  assert.doesNotMatch(styleSource, /s895D|s895S|s895OverlayFade|s895PanelEnter|settingsDirectoryCard:hover::after|portraitViewerFigure::after/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\][\s\S]*\.paperMotionDraft\[data-draft-state="written"\]/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\][\s\S]*\.drawerHost/);
  assert.match(clientSmokeSource, /assertS895MaterialFeedbackPolish/);
  assert.match(clientSmokeSource, /s89-16-shell-controls/);
  assert.match(clientSmokeSource, /s89-16-inkbox-button/);
  assert.match(clientSmokeSource, /S89\.5 desktop map draft feedback/);
  assert.match(clientSmokeSource, /S89\.5 reduced inkbox/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|ink-ui-manifest|dangerouslySetInnerHTML|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S89.7 map interaction polish stays draft-only and safe", () => {
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const bridgeSource = readText("client/src/components/InkMapRuntimeBridge.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const combined = stripSafeGuardPatterns(`${mapPageSource}\n${bridgeSource}\n${styleSource}`);

  assert.match(mapPageSource, /data-polish-map="s89-7-layer-tooltip"/);
  assert.match(mapPageSource, /data-polish-map="s89-7-layer-summary"/);
  assert.match(mapPageSource, /data-polish-map-empty="s89-11-layer-empty"/);
  assert.match(mapPageSource, /allLayersHidden/);
  assert.match(mapPageSource, /restoreAllLayers/);
  assert.match(mapPageSource, /mapVisibleLayerDigest/);
  assert.match(mapPageSource, /visibleMapActionEntries/);
  assert.match(mapPageSource, /data-layer-state=\{visibleLayers\[layer\] \? "shown" : "hidden"\}/);
  assert.match(mapPageSource, /筛选只改卷上显示，不改变案卷事实/);
  assert.match(mapPageSource, /setLastWrittenMapDraftId\(selection\.draftId\)/);
  assert.match(mapPageSource, /writtenDraftId=\{lastWrittenMapDraftId\}/);
  assert.match(mapPageSource, /localMapPagePathPattern/);
  assert.match(mapPageSource, /\(\?:sk\|tp\)-\[a-z0-9_-\]\{6,\}/);
  assert.match(bridgeSource, /data-polish-tooltip="s89-7-map-note"/);
  assert.match(bridgeSource, /data-polish-map-empty="s89-11-runtime-empty"/);
  assert.match(bridgeSource, /inkMapLayerEmptyOverlay/);
  assert.match(bridgeSource, /onRestoreLayers/);
  assert.match(bridgeSource, /单点札记 · 写入后仍须回主卷候复/);
  assert.match(bridgeSource, /data-draft-state=\{writtenDraftId === selection\.draftId \? "written" : "idle"\}/);
  assert.match(bridgeSource, /已写入主卷草稿/);
  assert.match(bridgeSource, /localMapRuntimePathPattern/);
  assert.match(bridgeSource, /\(\?:sk\|tp\)-\[a-z0-9_-\]\{6,\}/);
  assert.match(styleSource, /\.mapLayerSummary[\s\S]*overflow-wrap: anywhere/);
  assert.match(styleSource, /\.mapVisibleLayerDigest/);
  assert.match(styleSource, /\.inkMapLayerEmptyOverlay/);
  assert.match(styleSource, /\.inkMapTooltip \.paperButton\[data-draft-state="written"\][\s\S]*paperWrittenStateWash/);
  assert.match(clientSmokeSource, /S89\.7 map layer summary/);
  assert.match(clientSmokeSource, /S89\.11 map all layers hidden/);
  assert.match(clientSmokeSource, /s89-11-runtime-empty/);
  assert.match(clientSmokeSource, /S89\.7 map tooltip draft feedback/);
  assert.match(clientSmokeSource, /tp-\[a-z0-9_-\]\{6,\}/);
  assert.doesNotMatch(`${mapPageSource}\n${bridgeSource}`, /submitTurn|\/api\/game\/turn|qianqiuApi|localStorage|sessionStorage/);
  assert.doesNotMatch(
    combined,
    /dangerouslySetInnerHTML|\/api\/game\/state|\/api\/dev\/session-diagnostics|ink-ui-manifest|data\/sessions|raw audit|provider payload|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S89.21 map situation reader stays player-facing and draft-only", () => {
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const mapPageWithoutGuard = stripSafeGuardPatterns(mapPageSource);

  assert.match(mapPageSource, /data-polish-map-situation="s89-21-situation-index"/);
  assert.match(mapPageSource, /data-polish-map-reading="s89-21-situation-reader"/);
  assert.match(mapPageSource, /getMapSituationEntries/);
  assert.match(mapPageSource, /draftFromMapSituation/);
  assert.match(mapPageSource, /山河局势轴/);
  assert.match(mapPageSource, /本卷读法/);
  assert.match(mapPageSource, /局势轴只合读公开图层、人物锚点和后果追踪/);
  assert.match(mapPageSource, /坐标、画面层级与视觉特效不进入主卷裁决/);
  assert.match(styleSource, /\.mapSituationIndex/);
  assert.match(styleSource, /\.mapSituationIndexList/);
  assert.match(appTestSource, /s89-21-situation-reader/);
  assert.match(appTestSource, /据舆图局势，先核/);
  assert.match(clientSmokeSource, /S89\.21 map situation index/);
  assert.doesNotMatch(mapPageWithoutGuard, /submitTurn|\/api\/game\/turn|qianqiuApi|localStorage|sessionStorage|dangerouslySetInnerHTML/);
  assert.doesNotMatch(
    mapPageWithoutGuard,
    /provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|完整提示词|本地路径|密钥/
  );
});

test("S89.31 map tide compass and mobile tooltip stay draft-only and safe", () => {
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const bridgeSource = readText("client/src/components/InkMapRuntimeBridge.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const runtimeCombined = stripSafeGuardPatterns(`${mapPageSource}\n${bridgeSource}\n${styleSource}`);
  const unsafeMapList = mapPageSource.match(/const unsafeMapTextFragments[\s\S]*?\] as const;/)?.[0] || "";
  const unsafeBridgeList = bridgeSource.match(/const unsafeMapRuntimeTextFragments[\s\S]*?\] as const;/)?.[0] || "";
  const unsafeMapRefGuards = [
    mapPageSource.match(/const unsafeMapRefTokens = new Set\([\s\S]*?\]\);/)?.[0] || "",
    mapPageSource.match(/const unsafeMapRefPrefixPattern = .*?;/)?.[0] || "",
    bridgeSource.match(/const unsafeMapRuntimeRefTokens = new Set\([\s\S]*?\]\);/)?.[0] || "",
    bridgeSource.match(/const unsafeMapRuntimeRefPrefixPattern = .*?;/)?.[0] || ""
  ].join("\n");

  assert.match(mapPageSource, /data-polish-map-tide="s89-31-map-tide-compass"/);
  assert.match(mapPageSource, /getMapCompassEntries/);
  assert.match(mapPageSource, /mapCompassFocus/);
  assert.match(mapPageSource, /draftFromMapCompass/);
  assert.match(mapPageSource, /舆图态势罗盘/);
  assert.match(mapPageSource, /据罗盘拟稿/);
  assert.match(mapPageSource, /只作卷上读法，不生成行动事实/);
  assert.match(mapPageSource, /buildMapDraftContext\(entry\.id === "drafts" \? entry\.draftKind/);
  assert.match(bridgeSource, /data-polish-tooltip-reading="s89-31-mobile-map-note"/);
  assert.match(bridgeSource, /getMapRuntimeTooltipTone/);
  assert.match(bridgeSource, /getMapRuntimeTooltipReading/);
  assert.match(bridgeSource, /地点札记/);
  assert.match(bridgeSource, /人物札记/);
  assert.match(bridgeSource, /驿路札记/);
  assert.match(bridgeSource, /只作舆图旁读，不生成行动事实/);
  assert.match(styleSource, /\.mapTideCompass/);
  assert.match(styleSource, /\.mapTideCompassTabs/);
  assert.match(styleSource, /\.mapTideCompassReadout/);
  assert.match(styleSource, /\.inkMapTooltipReading/);
  assert.match(styleSource, /@keyframes mapTideCompassRailGlow/);
  assert.match(styleSource, /@keyframes inkMapTooltipNoteIn/);
  assert.match(styleSource, /@keyframes inkMapTooltipSheetIn/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\][\s\S]*\.mapTideCompass::before/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.inkMapTooltip::before/);
  assert.match(appTestSource, /s89-31-map-tide-compass/);
  assert.match(appTestSource, /据舆图罗盘人物动向/);
  assert.match(clientSmokeSource, /S89\.31 map tide compass/);
  assert.match(clientSmokeSource, /s89-31-mobile-map-note/);
  for (const guardSource of [unsafeMapList, unsafeBridgeList]) {
    assert.match(guardSource, /"draft"\s*\+\s*"Context"/);
    assert.match(guardSource, /"schema"/);
    assert.match(guardSource, /"manifest"/);
    assert.match(guardSource, /"server"\s*\+\s*" adjudication"/);
    assert.match(guardSource, /"AI"\s*\+\s*" read scope"/);
    assert.match(guardSource, /"proposal"\s*\+\s*" boundary"/);
    assert.match(guardSource, /"safe"\s*\+\s*" view"/);
    assert.match(guardSource, /"resolver"/);
  }
  assert.match(unsafeMapRefGuards, /draftcontext/);
  assert.match(unsafeMapRefGuards, /schema/);
  assert.match(unsafeMapRefGuards, /manifest/);
  assert.match(unsafeMapRefGuards, /server\[-_\.:\]\?adjudication/);
  assert.match(unsafeMapRefGuards, /ai\[-_\.:\]\?read\[-_\.:\]\?scope/);
  assert.match(unsafeMapRefGuards, /proposal\[-_\.:\]\?boundary/);
  assert.match(unsafeMapRefGuards, /safe\[-_\.:\]\?view/);
  assert.match(unsafeMapRefGuards, /resolver/);
  assert.doesNotMatch(`${mapPageSource}\n${bridgeSource}`, /submitTurn|\/api\/game\/turn|qianqiuApi|localStorage|sessionStorage|dangerouslySetInnerHTML/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|ink-ui-manifest|data\/sessions|raw audit|provider payload|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|server adjudication|AI read scope|proposal boundary|safe view|resolver|完整提示词|本地路径|密钥/
  );
});

test("S89.22 main ledger reader stays player-facing and draft-status-only", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const readerStart = gamePageSource.indexOf('data-polish-game="s89-22-main-ledger-reader"');
  const readerEnd = gamePageSource.indexOf("<p>主卷只读玩家已见", readerStart);
  const readerBlock = readerStart >= 0 && readerEnd > readerStart
    ? gamePageSource.slice(readerStart, readerEnd)
    : "";
  const gamePageWithoutGuard = stripSafeGuardPatterns(gamePageSource);

  assert.ok(readerStart >= 0 && readerEnd > readerStart);
  assert.match(gamePageSource, /data-polish-game="s89-22-main-ledger-reader"/);
  assert.match(gamePageSource, /data-polish-game-boundary="s89-22-main-ledger-boundary"/);
  assert.match(gamePageSource, /getActionDraftSourceLabel/);
  assert.match(gamePageSource, /getSafeViewReading/);
  assert.match(gamePageSource, /本旬行止笺/);
  assert.match(gamePageSource, /本卷取材：已载/);
  assert.match(gamePageSource, /暂无草稿/);
  assert.match(gamePageSource, /已有本地草稿/);
  assert.match(gamePageSource, /提交后才由主卷回批/);
  assert.match(gamePageSource, /本页不直接结算资源、关系、经济、官职、考试、地图行动或未公开事实/);
  assert.match(gamePageSource, /manual: "手写稿"/);
  assert.match(gamePageSource, /"map-runtime": "舆图摘录"/);
  assert.match(gamePageSource, /"role-surface": "案头摘录"/);
  assert.match(gamePageSource, /"archive-view": "史册摘录"/);
  assert.match(appTestSource, /s89-22-main-ledger-reader/);
  assert.match(appTestSource, /来处：案头摘录/);
  assert.match(clientSmokeSource, /S89\.22 main ledger/);
  assert.doesNotMatch(styleSource, /s89-22/);
  assert.doesNotMatch(readerBlock, /activeActionDraft\?\.text|activeActionDraft\.text/);
  assert.doesNotMatch(readerBlock, /manual|role-surface|map-runtime|archive-view|draftContext|schema|manifest|provider payload|raw audit|resolver|sourceRef|relatedRefs|scopeRefs|worldState|payload/);
  assert.doesNotMatch(gamePageWithoutGuard, /\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|完整提示词|本地路径|密钥/);
});

test("S89.34 main desk and court agenda material polish stays safe-view-only", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const courtPageSource = readText("client/src/pages/CourtPage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const gameCenterStart = gamePageSource.indexOf('data-polish-game-center={mainCourtDeskPolishId}');
  const gameCenterEnd = gamePageSource.indexOf('<nav className="sessionNav gameFeatureTabs"', gameCenterStart);
  const gameCenterBlock = gameCenterStart >= 0 && gameCenterEnd > gameCenterStart
    ? gamePageSource.slice(gameCenterStart, gameCenterEnd)
    : "";
  const courtAgendaStart = courtPageSource.indexOf('data-polish-court-agenda={mainCourtDeskPolishId}');
  const courtAgendaEnd = courtPageSource.indexOf('<div className="courtSurfaceGrid"', courtAgendaStart);
  const courtAgendaBlock = courtAgendaStart >= 0 && courtAgendaEnd > courtAgendaStart
    ? courtPageSource.slice(courtAgendaStart, courtAgendaEnd)
    : "";
  const combinedPageSource = `${gameCenterBlock}\n${courtAgendaBlock}`;
  const runtimeCombined = `${gamePageSource}\n${courtPageSource}`;

  assert.ok(gameCenterStart >= 0 && gameCenterEnd > gameCenterStart);
  assert.ok(courtAgendaStart >= 0 && courtAgendaEnd > courtAgendaStart);
  assert.match(gamePageSource, /const mainCourtDeskPolishId = "s89-34-main-court-desk"/);
  assert.match(gamePageSource, /data-polish-game-command=\{mainCourtDeskPolishId\}/);
  assert.match(gamePageSource, /data-polish-game-scene=\{mainCourtDeskPolishId\}/);
  assert.match(gamePageSource, /data-polish-game-center-band=\{mainCourtDeskPolishId\}/);
  assert.match(gamePageSource, /data-desk-state=\{deskState\}/);
  assert.match(gamePageSource, /gameDeskGroups/);
  assert.match(gamePageSource, /案头中枢/);
  assert.match(gamePageSource, /本卷案桌/);
  assert.match(gamePageSource, /本地草稿候呈/);
  assert.match(gamePageSource, /尚未落稿/);
  assert.match(gamePageSource, /未载不补造/);
  assert.match(courtPageSource, /data-polish-court-agenda=\{mainCourtDeskPolishId\}/);
  assert.match(courtPageSource, /data-polish-court-agenda-band=\{mainCourtDeskPolishId\}/);
  assert.match(courtPageSource, /data-agenda-state=\{agendaState\}/);
  assert.match(courtPageSource, /data-court-state=\{routeSessionSupported \? "ready" : "unsupported"\}/);
  assert.match(courtPageSource, /courtSurfaceEntry/);
  assert.match(courtPageSource, /官署议程/);
  assert.match(courtPageSource, /御案传签/);
  assert.match(courtPageSource, /堂审军议/);
  assert.match(appTestSource, /s89-34-main-court-desk/);
  assert.match(appTestSource, /data-desk-state/);
  assert.match(appTestSource, /data-court-state/);
  assert.match(clientSmokeSource, /S89\.34 main desk/);
  assert.match(clientSmokeSource, /S89\.34 court agenda/);
  assert.match(styleSource, /data-polish-game-command="s89-34-main-court-desk"/);
  assert.match(styleSource, /\.gameDeskCenter/);
  assert.match(styleSource, /data-polish-court-agenda="s89-34-main-court-desk"/);
  assert.match(styleSource, /\.courtAgendaBand/);
  for (const keyframe of ["mainCourtDeskPaperUnroll", "mainCourtDeskSlipRise", "mainCommandBarInkPulse", "mainSceneBandSheen", "mainDeskSealSettle", "mainLedgerDraftGlow", "courtAgendaSealGlow"]) {
    assert.match(styleSource, new RegExp(`@keyframes ${keyframe}`));
    assert.match(styleSource, new RegExp(keyframe));
  }
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\][\s\S]*gameDeskCenter/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*courtAgendaBand/);
  assert.doesNotMatch(combinedPageSource, /activeActionDraft\?\.text|activeActionDraft\.text|draftContext|schema|manifest|provider payload|raw audit|safe view|resolver|sourceRef|relatedRefs|scopeRefs|worldState|payload|ledger/);
  assert.doesNotMatch(
    runtimeCombined,
    /qianqiuApi|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|完整提示词|本地路径|密钥/
  );
});

test("S89.60 main and court desk keyframes use semantic names", () => {
  const keyframesSource = readText("client/src/styles/motion/keyframes.css");
  const gameStyleSource = readText("client/src/styles/routes/game.css");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const semanticNames = [
    "mainCourtDeskPaperUnroll",
    "mainCourtDeskSlipRise",
    "mainCommandBarInkPulse",
    "mainSceneBandSheen",
    "mainDeskSealSettle",
    "mainLedgerDraftGlow",
    "courtAgendaSealGlow"
  ];

  for (const keyframe of semanticNames) {
    assert.match(keyframesSource, new RegExp(`@keyframes ${keyframe}`));
    assert.match(gameStyleSource, new RegExp(`animation: ${keyframe}`));
    assert.match(clientSmokeSource, new RegExp(keyframe));
  }
  assert.match(gameStyleSource, /\.gameCommandBar\[data-polish-game-command="s89-34-main-court-desk"\]::before[\s\S]*animation: mainCommandBarInkPulse 4600ms ease-in-out infinite alternate/);
  assert.match(gameStyleSource, /\.gameSceneBand\[data-polish-game-scene="s89-34-main-court-desk"\]::after[\s\S]*animation: mainSceneBandSheen 5200ms ease-in-out infinite alternate/);
  assert.match(gameStyleSource, /\.gameDeskCenter \{[\s\S]*animation: mainCourtDeskPaperUnroll 430ms cubic-bezier\(0\.2, 0\.78, 0\.2, 1\) both/);
  assert.match(gameStyleSource, /\.gameDeskCenter\[data-desk-state="draft"\]::after[\s\S]*animation: mainDeskSealSettle 360ms ease both/);
  assert.match(gameStyleSource, /\.gameSideLedger\[data-draft-state="written"\] \{[\s\S]*animation: mainLedgerDraftGlow 360ms ease both/);
  assert.match(gameStyleSource, /\.courtAgendaBand \{[\s\S]*animation: mainCourtDeskPaperUnroll 400ms cubic-bezier\(0\.2, 0\.78, 0\.2, 1\) both/);
  assert.match(gameStyleSource, /\.courtAgendaBand::before \{[\s\S]*animation: courtAgendaSealGlow 5000ms ease-in-out infinite alternate/);
  assert.match(gameStyleSource, /\.courtAgendaSteps li \{[\s\S]*animation: mainCourtDeskSlipRise 360ms ease both/);
  assert.match(clientSmokeSource, /mainCommandBarInkPulse/);
  assert.match(clientSmokeSource, /mainSceneBandSheen/);
  assert.match(clientSmokeSource, /mainLedgerDraftGlow/);
  assert.match(clientSmokeSource, /courtAgendaSealGlow/);
  assert.doesNotMatch(styleSource, /@keyframes s8934(?:DeskUnroll|SlipRise|InkPulse|SceneSheen|SealSettle|LedgerGlow|CourtSealGlow)|animation(?:-name)?: s8934(?:DeskUnroll|SlipRise|InkPulse|SceneSheen|SealSettle|LedgerGlow|CourtSealGlow)/);
  assert.doesNotMatch(clientSmokeSource, /s8934(?:DeskUnroll|SlipRise|InkPulse|SceneSheen|SealSettle|LedgerGlow|CourtSealGlow)/);
});

test("S89.36 cross-page trace rail stays frontend-only and safe-view-only", () => {
  const crossTraceSource = readText("client/src/components/CrossPageTraceRail.tsx");
  const courtPageSource = readText("client/src/pages/CourtPage.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const archivePageSource = readText("client/src/pages/ArchivePage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const courtTraceBlock = courtPageSource.slice(
    courtPageSource.indexOf("function recordValue"),
    courtPageSource.indexOf("<div className=\"courtSurfaceGrid\"", courtPageSource.indexOf("<CrossPageTraceRail"))
  );
  const peopleTraceBlock = peoplePageSource.slice(
    peoplePageSource.indexOf("const peopleCrossTraceState"),
    peoplePageSource.indexOf("<section", peoplePageSource.indexOf("<CrossPageTraceRail"))
  );
  const archiveTraceBlock = archivePageSource.slice(
    archivePageSource.indexOf("const peopleHref"),
    archivePageSource.indexOf("<section", archivePageSource.indexOf("<CrossPageTraceRail"))
  );
  const traceBlocks = `${crossTraceSource}\n${courtTraceBlock}\n${peopleTraceBlock}\n${archiveTraceBlock}`;

  assert.ok(styleSource.length < 200_000);
  assert.match(crossTraceSource, /export type CrossPageTracePage = "court" \| "people" \| "archive"/);
  assert.match(crossTraceSource, /export type CrossPageTraceState = "ready" \| "empty" \| "unsupported"/);
  assert.match(crossTraceSource, /data-polish-cross-trace="s89-36-cross-page-trace"/);
  assert.match(crossTraceSource, /data-cross-trace-page=\{page\}/);
  assert.match(crossTraceSource, /data-cross-trace-state=\{state\}/);
  assert.match(crossTraceSource, /data-cross-trace-target=\{item\.target\}/);
  assert.match(crossTraceSource, /to=\{state === "unsupported" \? "\/" : item\.href\}/);
  assert.match(crossTraceSource, /aria-disabled=\{state === "unsupported" \? "true" : undefined\}/);
  assert.match(crossTraceSource, /跨页追索笺/);
  assert.match(crossTraceSource, /草稿、后果、关系、任免和钱粮仍回主卷候复/);
  assert.match(courtPageSource, /useGameSessionStore/);
  assert.match(courtTraceBlock, /currentSession\?\.sessionId === sessionId/);
  assert.match(courtTraceBlock, /eventArchiveView/);
  assert.match(courtTraceBlock, /domainConsequenceView/);
  assert.match(courtTraceBlock, /npcActiveRequestView\?\.followUpEvidence/);
  assert.match(courtTraceBlock, /worldThreadView/);
  assert.match(courtTraceBlock, /economyTraceView/);
  assert.match(courtTraceBlock, /查人物/);
  assert.match(courtTraceBlock, /查史册/);
  assert.match(courtTraceBlock, /回主卷候复/);
  assert.match(peopleTraceBlock, /peopleCrossTraceState/);
  assert.match(peopleTraceBlock, /peopleRows\.length/);
  assert.match(peopleTraceBlock, /followUpEvidenceCount/);
  assert.match(peopleTraceBlock, /relationshipAgendaThreads\.length/);
  assert.match(peopleTraceBlock, /economyTraceCount/);
  assert.match(peopleTraceBlock, /hasLocalDraft/);
  assert.match(peopleTraceBlock, /入朝议/);
  assert.match(archiveTraceBlock, /crossTraceState/);
  assert.match(archiveTraceBlock, /archiveItems\.length/);
  assert.match(archiveTraceBlock, /domainCount/);
  assert.match(archiveTraceBlock, /entityImpactCount/);
  assert.match(archiveTraceBlock, /followUpCount/);
  assert.match(archiveTraceBlock, /peopleHref/);
  assert.match(archiveTraceBlock, /courtHref/);
  assert.match(styleSource, /\.crossPageTraceRail\[data-polish-cross-trace="s89-36-cross-page-trace"\]/);
  assert.match(styleSource, /\.crossPageTraceGrid[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styleSource, /@keyframes crossPageTraceCardSlipIn/);
  assert.match(styleSource, /\.crossPageTraceGrid article \{[\s\S]*animation: crossPageTraceCardSlipIn \.46s ease both/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\][\s\S]*\.crossPageTraceGrid article/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.crossPageTraceGrid article/);
  assert.match(styleSource, /@media \(max-width: 760px\)[\s\S]*\.crossPageTraceGrid/);
  assert.match(appTestSource, /s89-36-cross-page-trace/);
  assert.match(appTestSource, /data-cross-trace-page='court'/);
  assert.match(appTestSource, /data-cross-trace-page='people'/);
  assert.match(appTestSource, /data-cross-trace-page='archive'/);
  assert.match(clientSmokeSource, /S89\.36 court cross trace/);
  assert.match(clientSmokeSource, /S89\.36 people cross trace/);
  assert.match(clientSmokeSource, /S89\.36 archive cross trace/);
  assert.match(clientSmokeSource, /crossPageTraceCardSlipIn/);
  assert.doesNotMatch(styleSource, /@keyframes s8936TraceSlipIn|animation(?:-name)?: s8936TraceSlipIn/);
  assert.doesNotMatch(clientSmokeSource, /s8936TraceSlipIn/);
  assert.doesNotMatch(
    traceBlocks,
    /qianqiuApi|submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|safe view|resolver|sourceRef|relatedRefs|scopeRefs|payload/
  );
});

test("S89.23 inventory transfer reader stays player-facing and CSS-neutral", () => {
  const inventoryPageSource = readText("client/src/pages/InventoryPage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const readerStart = inventoryPageSource.indexOf('data-polish-inventory="s89-23-inventory-ledger-reader"');
  const readerEnd = inventoryPageSource.indexOf("<EconomyTraceSection", readerStart);
  const readerBlock = readerStart >= 0 && readerEnd > readerStart
    ? inventoryPageSource.slice(readerStart, readerEnd)
    : "";
  const inventoryPageWithoutGuard = stripSafeGuardPatterns(inventoryPageSource);

  assert.ok(readerStart >= 0 && readerEnd > readerStart);
  assert.match(inventoryPageSource, /data-polish-inventory="s89-23-inventory-ledger-reader"/);
  assert.match(inventoryPageSource, /data-polish-inventory-boundary="s89-23-transfer-boundary"/);
  assert.match(inventoryPageSource, /transferReadinessLabel/);
  assert.match(inventoryPageSource, /流转候批笺/);
  assert.match(inventoryPageSource, /未获案卷回批前，不写成已入账或已移置/);
  assert.match(inventoryPageSource, /成交、入账、扣减、赠予、借用与关系影响仍等主卷回音/);
  assert.match(inventoryPageSource, /safeLabel\(item\.unit, "", 8\)/);
  assert.match(inventoryPageSource, /safeLabel\(account\.unit, "", 8\)/);
  assert.match(inventoryPageSource, /断卷不可移置/);
  assert.match(inventoryPageSource, /可呈请候批/);
  assert.match(appTestSource, /s89-23-inventory-ledger-reader/);
  assert.match(appTestSource, /清丈册 · 1册：书箧 · 1\/10 至 县署库房 · 0\/20/);
  assert.match(clientSmokeSource, /S89\.23 desktop inventory transfer reader/);
  assert.match(clientSmokeSource, /S89\.23 mobile inventory transfer reader/);
  assert.doesNotMatch(styleSource, /s89-23|data-polish-inventory/);
  assert.doesNotMatch(readerBlock, /itemId|containerId|draftContext|schema|manifest|provider payload|raw audit|safe view|resolver|sourceRef|relatedRefs|scopeRefs|服务器裁决|worldState|payload/);
  assert.doesNotMatch(inventoryPageWithoutGuard, /\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|完整提示词|本地路径|密钥/);
});

test("S89.12 map filter surface is player-facing and display-only", () => {
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const surfaceRegistrySource = readText("client/src/surfaces/surfaceRegistry.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const combined = stripSafeGuardPatterns(`${surfaceHostSource}\n${surfaceRegistrySource}`);

  assert.match(surfaceRegistrySource, /整理地点、驿路、近事、人物动向和后果追踪/);
  assert.doesNotMatch(surfaceRegistrySource, /"map-filter"[\s\S]*draftText/);
  assert.match(surfaceHostSource, /MapFilterSurfaceGuide/);
  assert.match(surfaceHostSource, /data-polish-map-filter="s89-12-surface-guide"/);
  assert.match(surfaceHostSource, /data-polish-map-surface="s89-12-filter-ledger"/);
  assert.match(surfaceHostSource, /buildMapFilterSummary/);
  assert.match(surfaceHostSource, /回舆图勾选/);
  assert.match(surfaceHostSource, /只改浏览器卷面显示|只改舆图显示|不改变案卷事实/);
  assert.match(appTestSource, /s89-12-surface-guide/);
  assert.match(appTestSource, /回舆图勾选/);
  assert.match(clientSmokeSource, /S89\.12 map filter surface/);
  assert.match(clientSmokeSource, /s89-12-surface-guide/);
  assert.match(clientSmokeSource, /s89-12-filter-ledger/);
  assert.doesNotMatch(surfaceHostSource, /activeSurface === "map-filter"[\s\S]{0,240}requestTopicDraft/);
  assert.doesNotMatch(surfaceHostSource, /activeSurface === "map-filter"[\s\S]{0,240}loadTopicSurface/);
  assert.doesNotMatch(
    combined,
    /dangerouslySetInnerHTML|\/api\/game\/state|\/api\/dev\/session-diagnostics|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S76.8 ranking page renders server-owned ranking views without widening authority", () => {
  const rankingPageSource = readText("client/src/pages/RankingPage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const rankingPageWithoutGuard = rankingPageSource.replace(/const unsafeRankingFragments[\s\S]*?\] as const;\r?\n/, "");
  const runtimeCombined = `${rankingPageWithoutGuard}\n${styleSource}`;

  assert.match(rankingPageSource, /export function RankingPage/);
  assert.match(rankingPageSource, /useAssetRegistry/);
  assert.match(rankingPageSource, /currentSession\?\.sessionId === sessionId/);
  assert.match(rankingPageSource, /lastExamResult\?\.sessionId === sessionId/);
  assert.match(rankingPageSource, /category: "scene", usage: "ranking_page", scene: "ranking_wall"/);
  assert.match(rankingPageSource, /subcategory: "imperial_notice"/);
  assert.match(rankingPageSource, /subcategory: "red_ink_smudge"/);
  assert.match(rankingPageSource, /getRankingSource\(resultRecord, latestHistory\)/);
  assert.match(rankingPageSource, /examAftermathView/);
  assert.match(rankingPageSource, /同年座师/);
  assert.match(rankingPageSource, /setActionDraft/);
  assert.match(rankingPageSource, /setSelectedId\(null\)/);
  assert.match(rankingPageSource, /detailPanelRef/);
  assert.match(rankingPageSource, /scrollIntoView/);
  assert.match(rankingPageSource, /focus\(\{ preventScroll: true \}\)/);
  assert.match(rankingPageSource, /tabIndex=\{-1\}/);
  assert.match(rankingPageSource, /\}, \[sessionId\]\)/);
  assert.doesNotMatch(rankingPageSource, /buildHonorFallbackRows|index \+ 1/);
  assert.match(rankingPageSource, /rankingTopThree/);
  assert.match(rankingPageSource, /金榜名单/);
  assert.match(rankingPageSource, /暂无公开弥封复核结果/);
  assert.match(rankingPageSource, /本榜只录已经张挂的定榜结果/);
  assert.match(rankingPageSource, /不改名次、不补评分、不推断授官/);
  assert.match(styleSource, /rankingFullScreen/);
  assert.match(styleSource, /rankingTopThree/);
  assert.match(styleSource, /rankingDetailPanel/);
  assert.match(styleSource, /rankingDetailPanel:focus/);
  assert.match(styleSource, /rankingActionRow/);
  assert.match(styleSource, /\.rankingGoldenNotice::before,[\s\S]*\.rankingGoldenTitle span[\s\S]*animation: none !important/);
  assert.match(styleSource, /\.rankingList button[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styleSource, /\.rankingName[\s\S]*overflow-wrap: anywhere/);
  assert.match(styleSource, /\.rankingPlace,[\s\S]*\.rankingMeta,[\s\S]*\.rankingScore[\s\S]*overflow-wrap: anywhere/);
  assert.match(styleSource, /\.rankingActionItem[\s\S]*flex-direction: column/);
  assert.match(clientSmokeSource, /assertRankingFullScreen/);
  assert.match(clientSmokeSource, /s76-ranking-fullscreen-mobile/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S74.5 asset registry gates manifest assets before React components render portraits", () => {
  const assetRegistrySource = readText("client/src/assets/assetRegistry.ts");
  const portraitSource = readText("client/src/components/Portrait.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const combined = `${assetRegistrySource}\n${portraitSource}\n${peoplePageSource}`;

  assert.match(assetRegistrySource, /ASSET_MANIFEST_URL = "\/assets\/ui\/ink-ui-runtime-manifest\.json"/);
  assert.match(assetRegistrySource, /runtimeUsableReviewStatuses/);
  assert.match(assetRegistrySource, /reviewStatus/);
  assert.match(assetRegistrySource, /allowEagerLoad !== false/);
  assert.match(assetRegistrySource, /PORTRAIT_LAZY_LOAD_GROUP_SUBCATEGORY/);
  assert.match(assetRegistrySource, /validateManifestIdentityUniqueness/);
  assert.match(assetRegistrySource, /重复 asset id/);
  assert.match(assetRegistrySource, /重复 portraitRef/);
  assert.match(assetRegistrySource, /Math\.min\(options\.limit \?\? manifestLimit, manifestLimit, 8\)/);
  assert.match(assetRegistrySource, /ageBand\.startsWith\("adult"\)/);
  assert.match(assetRegistrySource, /lowResPlaceholderPath/);
  assert.match(assetRegistrySource, /getPreloadHints/);
  assert.match(assetRegistrySource, /kept_outside_public_manifest/);
  assert.match(peoplePageSource, /worldPeopleView/);
  assert.match(peoplePageSource, /getExistingPortraitRef/);
  assert.match(peoplePageSource, /subcategory: "generic_npc_pool"/);
  assert.match(peoplePageSource, /portraitPageSize = 8/);
  assert.match(peoplePageSource, /fallbackPortraitRef/);
  assert.match(portraitSource, /loading="lazy"/);
  assert.doesNotMatch(portraitSource, /variant\?:|priority\?:|loading=\{priority/);
  assert.doesNotMatch(
    combined,
    /portrait-pool-matrix-v1|public\/assets\/ui\/portraits|localStorage|sessionStorage|data\/sessions|raw audit|provider payload/
  );
});

test("S79.3 portrait viewer stays read-only and uses audited runtime portrait paths", () => {
  const uiStateSource = readText("client/src/state/uiState.ts");
  const portraitSource = readText("client/src/components/Portrait.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const runtimeCombined = stripSafeGuardPatterns(`${uiStateSource}\n${portraitSource}\n${surfaceHostSource}\n${peoplePageSource}\n${styleSource}`);

  assert.match(uiStateSource, /activePortraitViewer/);
  assert.match(uiStateSource, /PortraitViewerProfile/);
  assert.match(uiStateSource, /openPortraitViewer/);
  assert.match(uiStateSource, /closePortraitViewer/);
  assert.match(portraitSource, /profile\?: PortraitViewerProfile/);
  assert.match(portraitSource, /portraitZoomButton/);
  assert.match(portraitSource, /data-polish-card="s89-5-portrait-frame"/);
  assert.match(portraitSource, /data-polish-action="s89-5-portrait-zoom"/);
  assert.match(portraitSource, /data-polish-portrait-card=\{portraitGalleryPolishId\}/);
  assert.match(portraitSource, /data-portrait-state=\{viewerEnabled \? "zoomable" : "ready"\}/);
  assert.match(portraitSource, /Maximize2/);
  assert.match(portraitSource, /markOverlayTrigger/);
  assert.match(surfaceHostSource, /PortraitViewerHost/);
  assert.match(surfaceHostSource, /registry\.getPortrait\(viewer\.portraitRef\)/);
  assert.match(surfaceHostSource, /portrait\?\.path/);
  assert.match(surfaceHostSource, /data-portrait-viewer="true"/);
  assert.match(surfaceHostSource, /data-polish-overlay="s89-5-portrait-gallery"/);
  assert.match(surfaceHostSource, /data-polish-portrait="s89-8-life-scroll"/);
  assert.match(surfaceHostSource, /data-polish-portrait-viewer=\{portraitGalleryPolishId\}/);
  assert.match(surfaceHostSource, /data-viewer-state=\{viewerState\}/);
  assert.match(surfaceHostSource, /data-polish-portrait-dossier=\{portraitGalleryPolishId\}/);
  assert.match(surfaceHostSource, /画屏案读/);
  assert.match(surfaceHostSource, /data-polish-cue="s89-9-portrait-cue-material"/);
  assert.match(surfaceHostSource, /data-polish-profile="s89-6-portrait-life"/);
  assert.match(surfaceHostSource, /portraitViewerCueGrid/);
  assert.match(surfaceHostSource, /portraitDressPhrase/);
  assert.match(surfaceHostSource, /portraitPosturePhrase/);
  assert.match(surfaceHostSource, /portraitSettingPhrase/);
  assert.match(surfaceHostSource, /buildPortraitViewerTags/);
  assert.match(`${portraitSource}\n${surfaceHostSource}\n${peoplePageSource}`, /home\|Users\|private\|mnt\|tmp\|var\|etc/);
  assert.match(`${portraitSource}\n${surfaceHostSource}\n${peoplePageSource}`, /\(\?:sk\|tp\)-\[a-z0-9_-/);
  assert.match(surfaceHostSource, /外貌介绍/);
  assert.match(surfaceHostSource, /生平介绍/);
  assert.match(surfaceHostSource, /身世线索/);
  assert.match(surfaceHostSource, /画卷题签/);
  assert.match(peoplePageSource, /buildNpcPortraitCurrent/);
  assert.match(peoplePageSource, /data-polish-people="s89-9-portrait-material"/);
  assert.match(peoplePageSource, /data-polish-people-card="s89-9-portrait-material"/);
  assert.match(peoplePageSource, /data-polish-people-workbench="s89-9-portrait-material"/);
  assert.match(peoplePageSource, /data-polish-people-ledger="s89-9-portrait-material"/);
  assert.match(peoplePageSource, /peoplePortraitGalleryPolishId = "s89-35-people-portrait-gallery"/);
  assert.match(peoplePageSource, /data-polish-people-gallery=\{peoplePortraitGalleryPolishId\}/);
  assert.match(peoplePageSource, /data-polish-people-gallery-band=\{peoplePortraitGalleryPolishId\}/);
  assert.match(peoplePageSource, /data-polish-people-gallery-card=\{peoplePortraitGalleryPolishId\}/);
  assert.match(peoplePageSource, /人物画屏/);
  assert.match(peoplePageSource, /入谱照面/);
  assert.match(peoplePageSource, /案主本局画像据已审阅画卷与公开身份整理/);
  assert.match(surfaceHostSource, /当前情况/);
  assert.match(surfaceHostSource, /公开近况/);
  assert.match(surfaceHostSource, /NpcProfilePortraitStrip/);
  assert.match(surfaceHostSource, /safeSurfacePortraitRef/);
  assert.match(readText("scripts/clientSmoke.js"), /s89-8-life-scroll[\s\S]*hasAppearance[\s\S]*hasBiography[\s\S]*hasCurrent[\s\S]*hasCueGrid[\s\S]*hasRicherCopy/);
  assert.match(styleSource, /portraitViewerPanel/);
  assert.match(styleSource, /portraitViewerProfile/);
  assert.match(styleSource, /portraitViewerProfileHeader/);
  assert.match(styleSource, /portraitViewerTags/);
  assert.match(styleSource, /portraitViewerCueGrid[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styleSource, /--qq-material-silk: url\("\/assets\/ui\/materials\/paper-aged-silk-v1\.webp"\)/);
  assert.match(styleSource, /portraitViewerPanel[\s\S]*var\(--qq-material-silk\)/);
  assert.match(styleSource, /portraitViewerCueGrid[\s\S]*@media \(max-width: 760px\)[\s\S]*portraitViewerCueGrid[\s\S]*grid-template-columns: 1fr/);
  assert.match(styleSource, /peopleGalleryBand\[data-polish-people-gallery-band="s89-35-people-portrait-gallery"\]/);
  assert.match(styleSource, /portraitViewerDossierRail/);
  assert.match(styleSource, /@keyframes s8935GalleryUnroll/);
  assert.match(styleSource, /@keyframes s8935SlipRise/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\][\s\S]*s89-35-people-portrait-gallery/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*s89-35-people-portrait-gallery/);
  assert.match(readText("scripts/clientSmoke.js"), /S89\.35 people portrait gallery readout/);
  assert.match(readText("scripts/clientSmoke.js"), /S89\.35 portrait viewer dossier rail/);
  assert.match(styleSource, /@keyframes s899CueLift[\s\S]*translateY\(8px\)/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\][\s\S]*\.portraitViewerCueGrid span/);
  assert.match(styleSource, /peopleCard:hover[\s\S]*transform: translateY\(-1px\)/);
  assert.match(styleSource, /npcProfilePortraitStrip/);
  assert.match(styleSource, /object-fit: contain/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|public\/assets\/ui\/portraits|ink-ui-manifest|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S76.10 people portraits stay on public session people and safe portrait refs", () => {
  const homePageSource = readText("client/src/pages/HomePage.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const apiTypesSource = readText("client/src/api/types.ts");
  const uiStateSource = readText("client/src/state/uiState.ts");
  const initialStateSource = readText("src/game/initialState.js");
  const redactedStateSource = readText("src/game/redactedState.js");
  const worldPeopleSchemasSource = readText("src/game/worldPeopleSchemas.js");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const runtimeCombined = stripSafeGuardPatterns(`${homePageSource}\n${peoplePageSource}\n${apiTypesSource}\n${uiStateSource}\n${styleSource}`);

  assert.match(apiTypesSource, /readonly portraitRef\?: string \| null/);
  assert.match(apiTypesSource, /export type WorldPeopleView/);
  assert.match(apiTypesSource, /readonly worldPeopleView\?: WorldPeopleView/);
  assert.match(uiStateSource, /portraitRef: payload\.worldState\.player\.portraitRef/);
  assert.match(initialStateSource, /normalizeInitialPortraitRef/);
  assert.match(redactedStateSource, /"portraitRef"/);
  assert.match(worldPeopleSchemasSource, /portraitRef: cleanPortraitRef/);
  assert.match(worldPeopleSchemasSource, /portraitRef: npc\.portraitRef \|\| null/);
  assert.match(homePageSource, /portraitChoiceGrid/);
  assert.match(homePageSource, /preferHighResOverridesForFeminine: true/);
  assert.match(homePageSource, /portrait_pool_player_s73_10/);
  assert.match(peoplePageSource, /peopleLedgerList/);
  assert.match(peoplePageSource, /maxPeopleRows = 80/);
  assert.match(peoplePageSource, /resolvePlayerPortraitRef/);
  assert.match(peoplePageSource, /resolveNpcPortraitRef/);
  assert.match(peoplePageSource, /portrait_pool_generic_npc_s73_10/);
  assert.doesNotMatch(peoplePageSource, /portrait_pool_signature_npc_s73_10/);
  assert.match(clientSmokeSource, /data-visible-people/);
  assert.match(clientSmokeSource, /s76-people-ledger-desktop/);
  assert.match(styleSource, /portraitChoiceGrid/);
  assert.match(styleSource, /peopleLedgerList/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|public\/assets\/ui\/portraits/
  );
});

test("S88.7 people page consumes persistent world entity impact evidence as read-only relationship signals", () => {
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const peoplePageWithoutGuard = peoplePageSource.replace(/const unsafePeopleTextFragments[\s\S]*?\] as const;\r?\n/, "");
  const runtimeCombined = `${peoplePageWithoutGuard}\n${styleSource}`;

  assert.match(peoplePageSource, /collectRelationshipImpactRows/);
  assert.match(peoplePageSource, /rowsFromViewKeys\(worldEntityView, \["recentImpacts"\]\)/);
  assert.match(peoplePageSource, /topicSurfaceIds\.includes\("npc-profile"\)/);
  assert.match(peoplePageSource, /recentImpactSummary/);
  assert.match(peoplePageSource, /recentImpactMeta/);
  assert.match(peoplePageSource, /公开压力/);
  assert.match(appTestSource, /论道余波已作为同年文社公开压力留痕/);
  assert.match(appTestSource, /world-entity-impact:polluted/);
  assert.match(styleSource, /npcRelationshipImpactSummary/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|npcActiveRequestLedger|npcInteractionLedger|relationshipLedger|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|resourcesApplied|marriageWritten|hiddenTruthChanged/
  );
});

test("S88.7 archive consumes world entity impact evidence from safe projection", () => {
  const eventArchiveSource = readText("src/game/eventArchive.js");
  const archivePageSource = readText("client/src/pages/ArchivePage.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const collectorSource = eventArchiveSource.match(
    /function collectWorldEntityImpactItems[\s\S]*?\n}\n\nfunction collectMonthlyBriefingItems/
  )?.[0] || "";
  const runtimeCombined = stripSafeGuardPatterns(`${archivePageSource}\n${styleSource}`);

  assert.match(eventArchiveSource, /buildWorldEntityView/);
  assert.match(eventArchiveSource, /MAX_WORLD_ENTITY_IMPACT_RECORDS = 6/);
  assert.match(eventArchiveSource, /world_entity_impact: "实体压力"/);
  assert.match(eventArchiveSource, /collectWorldEntityImpactItems\(worldState, items, worldEntityView\)/);
  assert.match(collectorSource, /Array\.isArray\(worldEntityView\?\.recentImpacts\)/);
  assert.match(collectorSource, /impact\.publicSummary/);
  assert.match(collectorSource, /impact\.affectedMetricLabels/);
  assert.doesNotMatch(collectorSource, /worldState\.worldEntities|worldEntities\.recentImpacts|sourceRef|relatedRefs|scopeRefs/);
  assert.match(archivePageSource, /archiveVisibleItemLimit = 12/);
  assert.match(archivePageSource, /localArchivePathPattern/);
  assert.match(archivePageSource, /users\|private/);
  assert.match(archivePageSource, /prioritizeArchiveItems/);
  assert.match(archivePageSource, /sourceType === "world_entity_impact"/);
  assert.match(archivePageSource, /entityImpactCount = numberValue\(counts\.world_entity_impact\)/);
  assert.match(archivePageSource, /<dt>实体<\/dt>/);
  assert.match(archivePageSource, /data-source-type=\{item\.sourceType\}/);
  assert.match(archivePageSource, /buildArchiveDigestCards/);
  assert.match(archivePageSource, /archiveDigestBand/);
  assert.match(archivePageSource, /archiveLeadList/);
  assert.match(archivePageSource, /案卷索引/);
  assert.match(archivePageSource, /拟稿仍只回主卷候复/);
  assert.match(archivePageSource, /data-polish-archive="s89-10-chronicle-density"/);
  assert.match(archivePageSource, /data-archive-layout="ledger-rail"/);
  assert.match(archivePageSource, /archiveEvidenceStack/);
  assert.match(archivePageSource, /draftContext/);
  assert.match(archivePageSource, /proposal boundary/);
  assert.match(archivePageSource, /countFollowUpEvidence/);
  assert.match(archivePageSource, /buildArchiveReaderRows/);
  assert.match(archivePageSource, /data-polish-archive-reader="s89-29-evidence-reader"/);
  assert.match(archivePageSource, /data-polish-archive-boundary="s89-29-evidence-boundary"/);
  assert.match(archivePageSource, /史册追索笺/);
  assert.match(archivePageSource, /史册证据读法/);
  assert.match(archivePageSource, /按钮只写案头草稿/);
  assert.match(appTestSource, /sourceType: "world_entity_impact"/);
  assert.match(appTestSource, /同年文社压力留痕/);
  assert.match(appTestSource, /史册近次线索/);
  assert.match(appTestSource, /风宪 留察名单 留痕/);
  assert.match(appTestSource, /s89-29-evidence-reader/);
  assert.match(appTestSource, /史册追索笺/);
  assert.match(clientSmokeSource, /assertArchiveWorldEntityImpactCanary/);
  assert.match(clientSmokeSource, /archiveDigestBand/);
  assert.match(clientSmokeSource, /s89-10-chronicle-density/);
  assert.match(clientSmokeSource, /s89-29-evidence-reader/);
  assert.match(clientSmokeSource, /S89\.29 archive evidence reader/);
  assert.match(clientSmokeSource, /archiveEvidenceStack/);
  assert.match(clientSmokeSource, /draftContext\|schema\|manifest\|server adjudication\|AI read scope\|proposal boundary\|safe view\|resolver\|runtime manifest\|visual-only\|watchlist\|NPC/);
  assert.match(clientSmokeSource, /\/api\/game\/npc-interaction\/\$\{sessionId\}/);
  assert.match(clientSmokeSource, /sourceType === "world_entity_impact"/);
  assert.match(clientSmokeSource, /li\[data-source-type='world_entity_impact'\]/);
  assert.match(clientSmokeSource, /sourceRef\|relatedRefs\|scopeRefs/);
  assert.match(styleSource, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styleSource, /archiveDigestBand/);
  assert.match(styleSource, /archiveDigestStats/);
  assert.match(styleSource, /archiveLeadList/);
  assert.match(styleSource, /grid-template-columns: minmax\(340px, 1\.08fr\) minmax\(300px, 0\.92fr\)/);
  assert.match(styleSource, /archiveEvidenceStack/);
  assert.doesNotMatch(styleSource, /s89-29/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|worldEntities\.recentImpacts|sourceRef|relatedRefs|scopeRefs|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|resourcesApplied|marriageWritten|hiddenTruthChanged|\/api\/game\/turn/
  );
});

test("S74.6 React map bridge wraps S72 renderer without old frontend globals", () => {
  const bridgeSource = readText("client/src/components/InkMapRuntimeBridge.tsx");
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const apiTypesSource = readText("client/src/api/types.ts");
  const mapRendererSource = readText("public/mapRenderer.js");
  const combined = `${bridgeSource}\n${mapPageSource}\n${apiTypesSource}\n${mapRendererSource}`;

  assert.match(bridgeSource, /pixiScriptSrc = "\/vendor\/pixi\.min\.js"/);
  assert.match(bridgeSource, /mapRendererScriptSrc = "\/mapRenderer\.js"/);
  assert.match(bridgeSource, /new window\.MapRenderer/);
  assert.match(bridgeSource, /setActionDraft|onActionDraft/);
  assert.match(bridgeSource, /aria-label="山河舆图"/);
  assert.match(bridgeSource, /map-runtime/);
  assert.match(mapPageSource, /currentSession\?\.sessionId === sessionId/);
  assert.match(apiTypesSource, /export type MapRuntimeView/);
  assert.match(apiTypesSource, /export type MapRuntimeNpcActivityAnchor/);
  assert.match(apiTypesSource, /npcActivityAnchors/);
  assert.match(mapRendererSource, /motionEnabled/);
  assert.match(mapRendererSource, /mapRuntimeView\.npcActivityAnchors/);
  assert.doesNotMatch(
    combined,
    /window\.QianqiuMapRenderer|public\/app\.js|#action-input|#information-panel|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S76.9 map page is an independent safe map surface", () => {
  const bridgeSource = readText("client/src/components/InkMapRuntimeBridge.tsx");
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const combined = `${bridgeSource}\n${gamePageSource}\n${mapPageSource}\n${styleSource}`;

  assert.match(gamePageSource, /isIndependentMapRoute/);
  assert.match(gamePageSource, /return <Outlet \/>/);
  assert.match(mapPageSource, /mapFullScreen/);
  assert.match(mapPageSource, /山河舆图/);
  assert.match(mapPageSource, /visibleLayers/);
  assert.match(mapPageSource, /defaultVisibleLayers/);
  assert.match(mapPageSource, /setVisibleLayers\(defaultVisibleLayers\)/);
  assert.match(mapPageSource, /\}, \[sessionId\]\)/);
  assert.match(mapPageSource, /入局势簿/);
  assert.match(mapPageSource, /据此拟稿/);
  assert.match(mapPageSource, /mapActionDeck/);
  assert.match(mapPageSource, /舆图行动/);
  assert.match(mapPageSource, /舆图人物动向/);
  assert.match(mapPageSource, /getNpcActivityAnchors/);
  assert.match(mapPageSource, /buildMapDraftContext/);
  assert.match(mapPageSource, /targetRefs/);
  assert.match(mapPageSource, /sourceRefs/);
  assert.match(mapPageSource, /requiresServerTurn/);
  assert.match(mapPageSource, /unsafeMapRefTokens/);
  assert.match(mapPageSource, /mapbounds/);
  assert.match(bridgeSource, /MapRuntimeDraftSelection/);
  assert.match(bridgeSource, /unsafeMapRuntimeRefTokens/);
  assert.match(mapPageSource, /地图显示坐标只用于画面排布/);
  assert.match(bridgeSource, /filterMapRuntimeView/);
  assert.match(bridgeSource, /npcActivityAnchors: visibleLayers\.events === false \? \[\] : view\.npcActivityAnchors/);
  assert.match(bridgeSource, /visibleLayers\.places/);
  assert.match(bridgeSource, /safeMapRuntimeText/);
  assert.match(styleSource, /\.mapImmersiveLayout/);
  assert.match(styleSource, /\.mapSituationLedger/);
  assert.match(styleSource, /\.mapActionDeck/);
  assert.match(styleSource, /\.mapActionList/);
  assert.match(styleSource, /\.inkMapTooltipClose/);
  assert.match(styleSource, /\.mapLayerControls,[\s\S]*\.mapCommandDeck \.buttonRow[\s\S]*repeat\(auto-fit, minmax\(96px, 1fr\)\)/);
  assert.match(styleSource, /\.mapLayerToggle span[\s\S]*overflow-wrap: anywhere/);
  assert.match(styleSource, /\.mapActionList span,[\s\S]*\.mapActionList p,[\s\S]*\.mapActionList strong[\s\S]*overflow-wrap: anywhere/);
  assert.match(styleSource, /\.mapEventList strong[\s\S]*overflow-wrap: anywhere/);
  assert.match(styleSource, /\.inkMapLabel[\s\S]*text-overflow: ellipsis/);
  assert.match(clientSmokeSource, /s74-react-map-runtime-desktop/);
  assert.match(clientSmokeSource, /assertNoVisibleTextOverflow/);
  assert.match(clientSmokeSource, /s88-9-archive-mobile/);
  const draftContextBuilder = mapPageSource.slice(
    mapPageSource.indexOf("function buildMapDraftContext"),
    mapPageSource.indexOf("function buildMapActionEntry")
  );
  const bridgeSelectionBuilder = bridgeSource.slice(
    bridgeSource.indexOf("function buildMapRuntimeDraftSelection"),
    bridgeSource.indexOf("function filterMapRuntimeView")
  );
  assert.doesNotMatch(draftContextBuilder, /layout|layoutPath|mapBounds|viewportHint|position|\.x|\.y/);
  assert.doesNotMatch(bridgeSelectionBuilder, /layout|layoutPath|mapBounds|viewportHint|position|\.x|\.y/);
  assert.doesNotMatch(`${bridgeSource}\n${mapPageSource}`, /submitTurn|\/api\/game\/turn|qianqiuApi/);
  assert.doesNotMatch(
    combined,
    /dangerouslySetInnerHTML|\/api\/game\/state|\/api\/dev\/session-diagnostics|public\/app\.js|#action-input|#information-panel|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S78 topic surfaces are safe workbenches and draft-only", () => {
  const uiStateSource = readText("client/src/state/uiState.ts");
  const apiSource = readText("client/src/api/qianqiuClient.ts");
  const typeSource = readText("client/src/api/types.ts");
  const stateSource = readText("client/src/state/gameSessionState.ts");
  const surfaceRegistrySource = readText("client/src/surfaces/surfaceRegistry.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const courtPageSource = readText("client/src/pages/CourtPage.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const runtimeCombined = `${uiStateSource}\n${surfaceRegistrySource}\n${surfaceHostSource}\n${courtPageSource}\n${styleSource}`;

  for (const surfaceId of [
    "memorial-review",
    "edict-draft",
    "court-debate",
    "trial",
    "war-council",
    "npc-profile"
  ]) {
    assert.match(uiStateSource, new RegExp(`"${surfaceId}"`));
    assert.match(surfaceRegistrySource, new RegExp(`${surfaceId}`));
  }

  assert.match(apiSource, /\/api\/game\/topic-surface\/\$\{encodePathSegment\(sessionId\)\}\/\$\{encodePathSegment\(surfaceId\)\}/);
  assert.match(apiSource, /\/api\/ai\/topic-draft\/\$\{encodePathSegment\(sessionId\)\}/);
  assert.match(typeSource, /TopicSurfaceView/);
  assert.match(typeSource, /TopicDraftResponse/);
  assert.match(stateSource, /topicSurfaceStatus/);
  assert.match(stateSource, /requestTopicDraft/);
  assert.match(surfaceRegistrySource, /dataSource/);
  assert.match(surfaceRegistrySource, /emptyState/);
  assert.match(surfaceRegistrySource, /不补造|不生成|不伪造|不能调用 resolver/);
  assert.match(surfaceHostSource, /surfaceSafetyList/);
  assert.match(surfaceHostSource, /TopicSurfaceWorkbench/);
  assert.match(surfaceHostSource, /loadTopicSurface\(currentSessionId, activeSurface\)/);
  assert.match(surfaceHostSource, /requestTopicDraft\(requestSessionId/);
  assert.match(surfaceHostSource, /topicSurface\?\.sessionId === currentSessionId/);
  assert.match(surfaceHostSource, /topicDraft\?\.sessionId === currentSessionId/);
  assert.match(surfaceHostSource, /推演拟稿/);
  assert.match(surfaceHostSource, /写入底部奏折/);
  assert.match(styleSource, /topicSurfaceLayout/);
  assert.match(styleSource, /topicDraftTextarea/);
  assert.match(courtPageSource, /courtSurfaceGroups/);
  assert.match(courtPageSource, /"memorial-review", "edict-draft", "court-debate"/);
  assert.match(courtPageSource, /"trial", "war-council"/);
  assert.match(courtPageSource, /"npc-profile"/);
  assert.match(courtPageSource, /openSurfaceForSession\(surface, sessionId\)/);
  assert.doesNotMatch(courtPageSource, /aria-label="[^"]*(?:surface|mock-ai|local-rule|provider-ai|map-runtime|S72 PixiJS)[^"]*"/);
  assert.match(appTestSource, /奏折队列", "拟圣旨", "朝议", "堂审", "军议", "人物档案"/);
  assert.match(appTestSource, /推演拟稿/);

  assert.doesNotMatch(
    runtimeCombined,
    /dangerouslySetInnerHTML|\/api\/game\/state|\/api\/dev\/session-diagnostics|submitTurn\(|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S89.17 court directory keeps topic entries player-facing and draft-only", () => {
  const courtPageSource = readText("client/src/pages/CourtPage.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");

  assert.match(courtPageSource, /data-polish-court="s89-17-court-directory"/);
  assert.match(courtPageSource, /官署案头索引/);
  assert.match(courtPageSource, /卷宗取材/);
  assert.match(courtPageSource, /可拟草稿/);
  assert.match(courtPageSource, /案卷未载/);
  assert.match(courtPageSource, /候复边界/);
  assert.match(courtPageSource, /formatCourtRegistryLine/);
  for (const surfaceId of ["memorial-review", "edict-draft", "court-debate", "trial", "war-council", "npc-profile"]) {
    assert.match(courtPageSource, new RegExp(surfaceId));
  }
  assert.match(appTestSource, /s89-17-court-directory/);
  assert.match(appTestSource, /courtSurfaceEntries\)\.toHaveLength\(6\)/);
  assert.match(appTestSource, /data-court-surface/);
  assert.match(clientSmokeSource, /s89-17-court-directory/);
  assert.match(clientSmokeSource, /court directory index entry count/);
  assert.match(clientSmokeSource, /court directory lacked player-facing index copy/);
  assert.doesNotMatch(styleSource, /s89-17/);
  assert.doesNotMatch(
    courtPageSource,
    /submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|safe view|resolver/
  );
});

test("S89.18 exam and ranking ceremony ledgers stay player-facing and server-owned", () => {
  const examPageSource = readText("client/src/pages/ExamPage.tsx");
  const rankingPageSource = readText("client/src/pages/RankingPage.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const examWithoutGuard = examPageSource.replace(/const unsafeExamFragments[\s\S]*?\] as const;\r?\n/, "");
  const rankingWithoutGuard = rankingPageSource.replace(/const unsafeRankingFragments[\s\S]*?\] as const;\r?\n/, "");

  assert.match(examPageSource, /data-polish-exam="s89-18-exam-ritual-ledger"/);
  assert.match(examPageSource, /data-polish-exam-ledger="s89-18-exam-ritual"/);
  assert.match(examPageSource, /科举仪程/);
  assert.match(examPageSource, /取题启封/);
  assert.match(examPageSource, /场内推进/);
  assert.match(examPageSource, /交卷候批/);
  assert.match(examPageSource, /候榜回音/);
  assert.match(examPageSource, /rewritePlayerFacingWorldText/);
  assert.match(rankingPageSource, /data-polish-ranking="s89-18-ranking-ceremony-ledger"/);
  assert.match(rankingPageSource, /data-polish-ranking-ledger="s89-18-ranking-ceremony"/);
  assert.match(rankingPageSource, /放榜仪程/);
  assert.match(rankingPageSource, /弥封复核/);
  assert.match(rankingPageSource, /张榜取材/);
  assert.match(rankingPageSource, /同年座师/);
  assert.match(rankingPageSource, /授官过渡/);
  assert.match(rankingPageSource, /案卷未载者不补造/);
  assert.match(appTestSource, /s89-18-exam-ritual-ledger/);
  assert.match(appTestSource, /s89-18-ranking-ceremony-ledger/);
  assert.match(clientSmokeSource, /s89-18-exam-ritual/);
  assert.match(clientSmokeSource, /s89-18-ranking-ceremony/);
  assert.doesNotMatch(styleSource, /s89-18/);
  assert.doesNotMatch(
    `${examWithoutGuard}\n${rankingWithoutGuard}`,
    /submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|safe view|resolver/
  );
});

test("S89.33 exam and ranking ceremony material stays visual-only", () => {
  const examPageSource = readText("client/src/pages/ExamPage.tsx");
  const rankingPageSource = readText("client/src/pages/RankingPage.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const examWithoutGuard = examPageSource.replace(/const unsafeExamFragments[\s\S]*?\] as const;\r?\n/, "");
  const rankingWithoutGuard = rankingPageSource.replace(/const unsafeRankingFragments[\s\S]*?\] as const;\r?\n/, "");

  assert.match(examPageSource, /data-polish-exam-ceremony="s89-33-exam-ceremony-material"/);
  assert.match(examPageSource, /data-polish-exam-hero="s89-33-exam-ceremony-material"/);
  assert.match(examPageSource, /data-polish-exam-ceremony-band="s89-33-exam-ceremony-material"/);
  assert.match(examPageSource, /data-polish-exam-paper="s89-33-exam-ceremony-material"/);
  assert.match(examPageSource, /科场仪幕/);
  assert.match(examPageSource, /题纸既启，落墨候批/);
  assert.match(examPageSource, /肃场候题，先定试别/);
  assert.match(rankingPageSource, /data-polish-ranking-ceremony="s89-33-ranking-golden-board"/);
  assert.match(rankingPageSource, /data-polish-ranking-hero="s89-33-ranking-golden-board"/);
  assert.match(rankingPageSource, /data-polish-ranking-board="s89-33-ranking-golden-board"/);
  assert.match(rankingPageSource, /data-polish-ranking-ceremony-band="s89-33-ranking-golden-board"/);
  assert.match(rankingPageSource, /aria-pressed=\{isSelected\}/);
  assert.match(rankingPageSource, /data-selected=\{isSelected \? "true" : "false"\}/);
  assert.match(rankingPageSource, /金榜仪轨/);
  assert.match(rankingPageSource, /黄纸已张，循榜细读/);
  assert.match(styleSource, /@keyframes examRankingCeremonyPaperUnfurl/);
  assert.match(styleSource, /@keyframes examRankingCeremonyInkSettle/);
  assert.match(styleSource, /@keyframes rankingHeroGoldSheen/);
  assert.match(styleSource, /@keyframes rankingListSelectedRowSettle/);
  assert.match(styleSource, /\.examCeremonyBand/);
  assert.match(styleSource, /\.rankingCeremonyBand/);
  assert.match(styleSource, /\.rankingList button\[aria-pressed="true"\]/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\][\s\S]*s89-33-exam-ceremony-material/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*s89-33-ranking-golden-board/);
  assert.match(appTestSource, /s89-33-exam-ceremony-material/);
  assert.match(appTestSource, /s89-33-ranking-golden-board/);
  assert.match(clientSmokeSource, /S89\.33 exam ceremony/);
  assert.match(clientSmokeSource, /S89\.33 selected ranking row state/);
  assert.doesNotMatch(
    `${examWithoutGuard}\n${rankingWithoutGuard}`,
    /submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|safe view|resolver/
  );
});

test("S89.59 exam and ranking polish keyframes use semantic names", () => {
  const keyframesSource = readText("client/src/styles/motion/keyframes.css");
  const examRankingSource = readText("client/src/styles/routes/exam-ranking.css");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(keyframesSource, /@keyframes examRankingCeremonyPaperUnfurl/);
  assert.match(keyframesSource, /@keyframes examRankingCeremonyInkSettle/);
  assert.match(keyframesSource, /@keyframes rankingHeroGoldSheen/);
  assert.match(keyframesSource, /@keyframes rankingListSelectedRowSettle/);
  assert.match(examRankingSource, /\.examHero\[data-polish-exam-hero="s89-33-exam-ceremony-material"\]::after[\s\S]*animation: examRankingCeremonyInkSettle 3600ms ease-in-out infinite alternate/);
  assert.match(examRankingSource, /\.examCeremonyBand,[\s\S]*\.rankingCeremonyBand \{[\s\S]*animation: examRankingCeremonyPaperUnfurl 340ms cubic-bezier\(0\.2, 0\.78, 0\.2, 1\)/);
  assert.match(examRankingSource, /\.examCeremonyBand li,[\s\S]*\.rankingCeremonyBand li \{[\s\S]*animation: examRankingCeremonyInkSettle 420ms ease both/);
  assert.match(examRankingSource, /\.examDesk\[data-polish-exam-paper="s89-33-exam-ceremony-material"\][\s\S]*animation: examRankingCeremonyPaperUnfurl 380ms cubic-bezier\(0\.2, 0\.78, 0\.2, 1\)/);
  assert.match(examRankingSource, /\.rankingHero\[data-polish-ranking-hero="s89-33-ranking-golden-board"\]::after[\s\S]*animation: rankingHeroGoldSheen 3800ms ease-in-out infinite alternate/);
  assert.match(examRankingSource, /\.rankingCeremonyBand \{[\s\S]*animation: examRankingCeremonyPaperUnfurl 360ms cubic-bezier\(0\.2, 0\.78, 0\.2, 1\)/);
  assert.match(examRankingSource, /\.rankingList button\[aria-pressed="true"\],[\s\S]*\.rankingList button\[data-selected="true"\] \{[\s\S]*animation: rankingListSelectedRowSettle 320ms ease both/);
  assert.match(clientSmokeSource, /examRankingCeremonyInkSettle/);
  assert.match(clientSmokeSource, /examRankingCeremonyPaperUnfurl/);
  assert.match(clientSmokeSource, /rankingHeroGoldSheen/);
  assert.match(clientSmokeSource, /rankingListSelectedRowSettle/);
  assert.doesNotMatch(styleSource, /@keyframes s8933(?:ExamPaperUnfurl|ExamInkSettle|RankingGoldSheen|RankingRowSelect)|animation(?:-name)?: s8933(?:ExamPaperUnfurl|ExamInkSettle|RankingGoldSheen|RankingRowSelect)|--s8933-/);
  assert.doesNotMatch(clientSmokeSource, /s8933(?:ExamPaperUnfurl|ExamInkSettle|RankingGoldSheen|RankingRowSelect)/);
});

test("S89.19 settings and route recovery states stay player-facing and local", () => {
  const settingsPageSource = readText("client/src/pages/SettingsPage.tsx");
  const aiSettingsPanelSource = readText("client/src/components/AiSettingsPanel.tsx");
  const errorPageSource = readText("client/src/pages/ErrorPage.tsx");
  const notFoundPageSource = readText("client/src/pages/NotFoundPage.tsx");
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const gameRouteRecoveryBlock = gamePageSource.match(/if \(!routeSessionSupported && isGameRootRoute\)[\s\S]*?return \(/)?.[0] || "";
  const combined = stripSafeGuardPatterns(`${settingsPageSource}\n${aiSettingsPanelSource}\n${errorPageSource}\n${notFoundPageSource}\n${gameRouteRecoveryBlock}`);

  assert.match(settingsPageSource, /data-polish-settings-state="s89-19-settings-card-state"/);
  assert.match(settingsPageSource, /data-polish-settings-state="s89-19-settings-directory-state"/);
  assert.match(settingsPageSource, /data-polish-settings-state="s89-19-settings-route-recovery"/);
  assert.match(settingsPageSource, /只改推演分工/);
  assert.match(settingsPageSource, /异常旧卷只示暂不可读/);
  assert.match(settingsPageSource, /不读取主卷、不打开专题、不写行动草稿/);
  assert.match(aiSettingsPanelSource, /data-polish-ai-settings="s89-19-ai-state-ledger"/);
  assert.match(aiSettingsPanelSource, /data-polish-ai-settings-ledger="s89-19-ai-state-ledger"/);
  assert.match(aiSettingsPanelSource, /safeAiSettingsLine/);
  assert.match(aiSettingsPanelSource, /safeEffectiveStatus/);
  assert.match(aiSettingsPanelSource, /preset: idValue\(payload\?\.aiSettingsView\.preset, "balanced"\)/);
  assert.match(aiSettingsPanelSource, /preset: idValue\(form\.preset, "balanced"\)/);
  assert.match(aiSettingsPanelSource, /推演设置暂不可用；请稍后重试/);
  assert.match(errorPageSource, /data-polish-route-state="s89-19-route-recovery"/);
  assert.match(notFoundPageSource, /data-polish-route-state="s89-19-route-recovery"/);
  assert.match(gamePageSource, /data-polish-route-state="s89-19-game-route-recovery"/);
  assert.match(appTestSource, /cleans polluted S89\.19 AI settings labels/);
  assert.match(appTestSource, /does not write polluted S89\.19 AI preset ids back on save/);
  assert.match(appTestSource, /keeps S89\.19 AI settings errors redacted/);
  assert.match(appTestSource, /keeps malformed settings routes local and diagnostic-free/);
  assert.match(clientSmokeSource, /s89-19-settings-card-state/);
  assert.match(clientSmokeSource, /s89-19-settings-route-recovery/);
  assert.doesNotMatch(styleSource, /s89-19|data-polish-ai-settings|data-polish-settings-state|data-polish-route-state/);
  assert.doesNotMatch(
    combined,
    /submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|safe view|resolver|hiddenNotes|完整提示词|本地路径|密钥/
  );
});

test("S89.20 CSS budget guard keeps polish styles compact and material-backed", () => {
  const styleSource = readText("client/src/styles/global.css");

  assert.ok(styleSource.length < 200_000);
  assert.doesNotMatch(styleSource, /rgba\(/);
  assert.doesNotMatch(styleSource, /\.actionPanel\b/);
  assert.match(styleSource, /--qq-material-seal-box: url\("\/assets\/ui\/materials\/seal-box-texture-v1\.webp"\)/);
  assert.match(styleSource, /var\(--qq-material-folded\) center \/ cover no-repeat/);
  assert.match(styleSource, /var\(--qq-material-torn\) center \/ cover no-repeat/);
  assert.match(styleSource, /var\(--qq-material-seal-box\) center \/ cover no-repeat/);
});

test("S89.24 CSS duplicate guard keeps polish budget buffer", () => {
  const styleSource = readText("client/src/styles/global.css");

  assert.ok(styleSource.length < 200_000);
  assert.match(styleSource, /\.mapActionDeck,\n\.mapNpcActivityDeck \{/);
  assert.match(styleSource, /\.mapActionDeck h3,\n\.mapNpcActivityDeck h3 \{/);
  assert.match(styleSource, /\.mapActionList,\n\.mapNpcActivityList \{/);
  assert.match(styleSource, /\.roleCycleMetrics,\n\.mapHeroStats,\n\.archiveStats,\n\.npcFactGrid,\n\.inventoryItemStats \{/);
  assert.match(styleSource, /\.scholarPlanSummary div,\n\.scholarPlanTimeline li,\n\.scholarPanelCompactDl div \{/);
  assert.equal(
    (styleSource.match(/grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);\n  gap: 8px;\n  margin: 0/g) || []).length,
    1
  );
});

test("S89.37 CSS token and accessibility refactor stays visual-only", () => {
  const styleSource = readText("client/src/styles/global.css");
  const crossTraceSource = readText("client/src/components/CrossPageTraceRail.tsx");
  const runtimeCombined = `${styleSource}\n${crossTraceSource}`;

  assert.ok(styleSource.length < 200_000);
  assert.match(styleSource, /--qq-color-ink: #241b16/);
  assert.match(styleSource, /--qq-color-vermilion: #8e2f27/);
  assert.match(styleSource, /--qq-color-border-soft: rgb\(84 60 43 \/ \.24\)/);
  assert.match(styleSource, /--qq-surface-paper-soft:/);
  assert.match(styleSource, /--qq-motion-instant: 0\.01ms/);
  assert.match(styleSource, /a \{\s*color: var\(--qq-color-link\);[\s\S]*text-decoration-line: underline/);
  assert.match(styleSource, /a\[class\] \{\s*color: inherit;\s*text-decoration: none/);
  assert.match(styleSource, /\.scholarPanelActions a \{[\s\S]*text-decoration: none/);
  assert.doesNotMatch(styleSource, /a \{\s*color: inherit;\s*text-decoration: none;\s*\}/);
  assert.match(styleSource, /:where\(\.paperSurface, \.rolePanel, \.statusSurface, \.ledgerCard, \.paperMotionCard/);
  assert.match(styleSource, /\.appShell\[data-contrast="high"\][\s\S]*--qq-color-border-soft/);
  assert.match(styleSource, /\.appShell\[data-contrast="high"\] :is\(\.paperSurface, \.rolePanel, \.statusSurface, \.ledgerCard/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\][\s\S]*--qq-motion-fast: var\(--qq-motion-instant\)/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*--qq-motion-fast: var\(--qq-motion-instant\)/);
  assert.match(styleSource, /transition-duration: var\(--qq-motion-instant\) !important/);
  assert.match(crossTraceSource, /className="crossPageTraceRail scholarPanelCard paperMotionPanel paperSurface"/);
  assert.match(crossTraceSource, /className="ledgerCard"/);
  assert.doesNotMatch(
    runtimeCombined,
    /submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|hiddenNotes|完整提示词|本地路径|密钥|AI read scope|proposal boundary|server adjudication|draftContext|schema|manifest/
  );
});

test("S89.38 CSS module entry keeps stable Vite import order", () => {
  const globalEntrySource = fs.readFileSync(path.join(rootDir, "client", "src", "styles", "global.css"), "utf8");
  const expectedImports = clientStyleEntryImports
    .map((modulePath) => `@import "./${modulePath}";`);

  assert.deepEqual(
    globalEntrySource.trim().split(/\r?\n/),
    expectedImports
  );
  assert.deepEqual(clientStyleModules, clientStyleExpectedModules);
  assert.match(
    fs.readFileSync(path.join(rootDir, "client", "src", "styles", "responsive", "global-responsive.css"), "utf8"),
    /@import "\.\/mobile-layout\.css";[\s\S]*@import "\.\/mobile-exam-ranking\.css";/
  );
  assert.match(readClientStyleSource(), /--qq-color-ink: #241b16/);
  assert.match(readClientStyleSource(), /@media \(max-width: 760px\)/);
  assert.match(readClientStyleSource(), /@keyframes paperSurfaceRise/);
});

test("S89.39 semantic paper motion utilities reduce route-specific selector coupling", () => {
  const saveCaseSource = readText("client/src/components/SaveCaseList.tsx");
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const archivePageSource = readText("client/src/pages/ArchivePage.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const inventoryPageSource = readText("client/src/pages/InventoryPage.tsx");
  const rankingPageSource = readText("client/src/pages/RankingPage.tsx");
  const settingsPageSource = readText("client/src/pages/SettingsPage.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const styleSource = readText("client/src/styles/global.css");

  assert.match(saveCaseSource, /className="saveCaseItem paperMotionCard paperMotionInteractive"/);
  assert.match(mapPageSource, /className="paperMotionCard paperMotionInteractive paperMotionDraft"/);
  assert.match(archivePageSource, /className="paperMotionCard paperMotionInteractive" key=\{`lead-/);
  assert.match(peoplePageSource, /className="peopleCard paperMotionCard paperMotionInteractive"/);
  assert.match(peoplePageSource, /className="npcRelationshipAgendaCard paperMotionCard paperMotionInteractive"/);
  assert.match(inventoryPageSource, /className="inventoryItemCard paperMotionCard paperMotionInteractive"/);
  assert.match(rankingPageSource, /className="rankingTopSeal paperMotionCard paperMotionInteractive"/);
  assert.match(rankingPageSource, /className="paperMotionInteractive"[\s\S]*aria-pressed=\{isSelected\}/);
  assert.match(settingsPageSource, /className="settingsDirectoryCard paperMotionCard paperMotionInteractive"/);
  assert.match(surfaceHostSource, /className="topicSurfaceItem paperMotionCard paperMotionInteractive"/);
  assert.match(styleSource, /\.appShell\[data-material-motion="shared-paper"\] :is\(\.paperMotionCard/);
  assert.match(styleSource, /\.appShell\[data-material-motion="shared-paper"\] :is\(\.paperMotionInteractive/);
  assert.match(styleSource, /\.paperMotionDraft\[data-draft-state="written"\]/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\]\[data-material-motion="shared-paper"\] :is\(\.paperMotionCard, \.paperMotionPanel, \.paperMotionInteractive/);
  assert.doesNotMatch(
    styleSource,
    /submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|hiddenNotes|完整提示词|本地路径|密钥|AI read scope|proposal boundary|server adjudication/
  );
});

test("S89.40 selected and empty paper motion utilities stay semantic and gated", () => {
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const inventoryPageSource = readText("client/src/pages/InventoryPage.tsx");
  const homePageSource = readText("client/src/pages/HomePage.tsx");
  const inkMapSource = readText("client/src/components/InkMapRuntimeBridge.tsx");
  const memorialSource = readText("client/src/components/MemorialComposer.tsx");
  const archivePageSource = readText("client/src/pages/ArchivePage.tsx");
  const rankingPageSource = readText("client/src/pages/RankingPage.tsx");
  const aiSettingsSource = readText("client/src/components/AiSettingsPanel.tsx");
  const scholarPanelSource = readText("client/src/components/ScholarPanel.tsx");
  const magistratePanelSource = readText("client/src/components/MagistratePanel.tsx");
  const generalPanelSource = readText("client/src/components/GeneralPanel.tsx");
  const emperorPanelSource = readText("client/src/components/EmperorPanel.tsx");
  const ministerPanelSource = readText("client/src/components/OfficialMinisterPanel.tsx");
  const consequenceSource = readText("client/src/components/DomainConsequenceSection.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");

  assert.match(surfaceHostSource, /className="inkboxTab paperMotionSelected"[\s\S]*aria-selected=\{activeTab === tab\.id\}/);
  assert.match(surfaceHostSource, /className="topicDraftSlot paperMotionSelected"[\s\S]*aria-pressed=\{\(draftKind \|\| topicView\.draftSlots\[0\]\?\.draftKind\) === slot\.draftKind\}/);
  assert.match(peoplePageSource, /className="npcListButton paperMotionSelected"[\s\S]*aria-pressed=\{selectedNpc\?\.npcId === npc\.npcId\}[\s\S]*data-gallery-selected=/);
  assert.match(peoplePageSource, /className="inkboxTab paperMotionSelected"[\s\S]*aria-selected=\{activeTab === tab\.id\}/);
  assert.match(inventoryPageSource, /className="inventoryContainerButton paperMotionSelected"[\s\S]*aria-pressed=\{selectedContainer === container\.containerId\}/);
  assert.match(mapPageSource, /className="mapLayerToggle paperMotionSelected"[\s\S]*data-layer-state=\{visibleLayers\[layer\] \? "shown" : "hidden"\}[\s\S]*checked=\{visibleLayers\[layer\]\}/);

  assert.match(homePageSource, /className="saveCaseEmpty paperMotionEmpty"/);
  assert.match(inkMapSource, /className="inkMapRuntimeFallback paperMotionEmpty"[\s\S]*role="status"/);
  assert.match(inkMapSource, /className="inkMapLayerEmptyOverlay paperMotionEmpty"[\s\S]*role="status"/);
  assert.match(memorialSource, /className="quickActionEmpty paperMotionEmpty"/);
  assert.match(archivePageSource, /className="archiveEmpty paperMotionEmpty"/);
  assert.match(rankingPageSource, /className="rankingEmpty paperMotionEmpty"/);
  for (const panelSource of [scholarPanelSource, magistratePanelSource, generalPanelSource, emperorPanelSource, ministerPanelSource, consequenceSource]) {
    assert.match(panelSource, /className="scholarPanelEmpty paperMotionEmpty"/);
  }
  assert.match(aiSettingsSource, /matrixState === "error" \? "aiSettingsMatrixStatus paperMotionEmpty" : "aiSettingsMatrixStatus"/);

  assert.match(styleSource, /:where\(\.paperSurface, \.rolePanel, \.statusSurface, \.ledgerCard, \.paperMotionCard, \.paperMotionPanel, \.paperMotionSurface, \.paperMotionInteractive, \.paperMotionSelected, \.paperMotionDraft, \.paperMotionEmpty\)/);
  assert.match(styleSource, /\.appShell\[data-material-motion="shared-paper"\] \.paperMotionSelected:is\(\[aria-pressed="true"\], \[aria-selected="true"\], :has\(input:checked\)\)/);
  assert.match(styleSource, /\.appShell\[data-material-motion="shared-paper"\] \.paperMotionEmpty/);
  assert.match(styleSource, /\.appShell\[data-contrast="high"\] \.paperMotionSelected:is\(\[aria-pressed="true"\], \[aria-selected="true"\], :has\(input:checked\)\)/);
  assert.match(styleSource, /\.paperMotionSelected\[aria-pressed="true"\], \.paperMotionSelected\[aria-selected="true"\], \.paperMotionSelected:has\(input:checked\)/);
  assert.doesNotMatch(styleSource, /\.appShell\[data-material-motion="shared-paper"\] :is\(\.npcListButton\[aria-pressed="true"\]/);
  assert.doesNotMatch(styleSource, /\.appShell\[data-material-motion="shared-paper"\] :is\(\.saveCaseEmpty/);

  assert.match(clientSmokeSource, /selectedControlCount: document\.querySelectorAll\("\.paperMotionSelected\[aria-pressed='true'\], \.paperMotionSelected\[aria-selected='true'\], \.paperMotionSelected:has\(input:checked\)"\)\.length/);
  assert.match(clientSmokeSource, /unselectedControl: styleOf\("\.paperMotionSelected:not\(\[aria-pressed='true'\]\):not\(\[aria-selected='true'\]\):not\(:has\(input:checked\)\)"\)/);
  assert.match(clientSmokeSource, /expected\.map && snapshot\.s8930\.selectedControlCount < 1/);
  assert.match(clientSmokeSource, /emptyState: styleOf\("\.paperMotionEmpty"\)/);
  assert.match(clientSmokeSource, /emptyStateCount: document\.querySelectorAll\("\.paperMotionEmpty"\)\.length/);
  assert.match(clientSmokeSource, /S89\.5 desktop map all layers empty", \{ empty: true \}/);
});

test("S89.41 paper motion panel utilities reduce scholar panel selector coupling", () => {
  const rolePanelSources = [
    "client/src/components/ScholarPanel.tsx",
    "client/src/components/MagistratePanel.tsx",
    "client/src/components/GeneralPanel.tsx",
    "client/src/components/EmperorPanel.tsx",
    "client/src/components/OfficialMinisterPanel.tsx",
    "client/src/components/RoleCycleSection.tsx"
  ].map((sourcePath) => readText(sourcePath)).join("\n");
  const genericPanelSources = [
    "client/src/components/DomainConsequenceSection.tsx",
    "client/src/components/NpcFollowUpEvidenceSection.tsx",
    "client/src/components/CrossPageTraceRail.tsx",
    "client/src/pages/ArchivePage.tsx"
  ].map((sourcePath) => readText(sourcePath)).join("\n");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const preferencesSource = readClientStyleModule("base/preferences.css");
  const reducedMotionSource = readClientStyleModule("motion/reduced-motion.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(rolePanelSources, /className="scholarPanelCard paperMotionPanel rolePanel scholarPanelStudyLedger"/);
  assert.match(rolePanelSources, /className="scholarPanelCard paperMotionPanel rolePanel magistratePanelDocket"/);
  assert.match(rolePanelSources, /className="scholarPanelCard paperMotionPanel rolePanel generalPanelCommand"/);
  assert.match(rolePanelSources, /className="scholarPanelCard paperMotionPanel rolePanel emperorPanelMemorials"/);
  assert.match(rolePanelSources, /className="scholarPanelCard paperMotionPanel rolePanel officialMinisterPanelCareer"/);
  assert.match(rolePanelSources, /className="scholarPanelCard paperMotionPanel rolePanel roleCycleSection"/);
  assert.match(rolePanelSources, /className="scholarPanelCardHeader"/);
  assert.doesNotMatch(rolePanelSources, /rolePanelHeader/);
  assert.doesNotMatch(rolePanelSources, /className="[^"]*\bscholarPanelCard\b(?![^"]*\bpaperMotionPanel\b)[^"]*"/);

  assert.match(genericPanelSources, /className="scholarPanelCard paperMotionPanel domainConsequenceSection"/);
  assert.match(genericPanelSources, /className="scholarPanelCard paperMotionPanel npcFollowUpEvidenceSection"/);
  assert.match(genericPanelSources, /className="crossPageTraceRail scholarPanelCard paperMotionPanel paperSurface"/);
  assert.match(genericPanelSources, /className="scholarPanelCard paperMotionPanel"/);
  assert.doesNotMatch(genericPanelSources, /\brolePanel\b/);

  assert.match(polishSource, /\.appShell\[data-material-motion="shared-paper"\] :is\(\.paperMotionCard, \.paperMotionPanel/);
  assert.match(polishSource, /:is\(\.paperMotionInteractive, \.paperMotionPanel\)/);
  assert.match(polishSource, /:is\(\.paperMotionCard, \.paperMotionPanel\):nth-child\(2\)/);
  assert.doesNotMatch(polishSource, /\.scholarPanelCard|\.npcRelationshipAgendaCard/);
  assert.match(preferencesSource, /\.appShell\[data-contrast="high"\] :is\(\.paperSurface, \.rolePanel, \.statusSurface, \.ledgerCard, \.paperMotionCard, \.paperMotionPanel/);
  assert.doesNotMatch(preferencesSource, /\.scholarPanelCard|\.npcRelationshipAgendaCard/);
  assert.match(reducedMotionSource, /\.paperMotionPanel/);
  assert.doesNotMatch(reducedMotionSource, /\.scholarPanelCard|\.npcRelationshipAgendaCard/);

  assert.match(clientSmokeSource, /paperMotionPanelCount: document\.querySelectorAll\("\.scholarPanelCard\.paperMotionPanel"\)\.length/);
  assert.match(clientSmokeSource, /rolePanelCount: document\.querySelectorAll\("\.scholarPanelCard\.rolePanel"\)\.length/);
  assert.match(clientSmokeSource, /S89\.41 scholar role panels", \{ rolePanel: true \}/);
});

test("S89.42 static surface utilities reduce structural selector coupling", () => {
  const surfaceSafetySources = [
    "client/src/pages/GamePage.tsx",
    "client/src/pages/InventoryPage.tsx",
    "client/src/pages/SettingsPage.tsx",
    "client/src/pages/CourtPage.tsx",
    "client/src/pages/ArchivePage.tsx",
    "client/src/pages/ExamPage.tsx",
    "client/src/pages/RankingPage.tsx",
    "client/src/pages/PeoplePage.tsx",
    "client/src/components/SurfaceHost.tsx",
    "client/src/components/AiSettingsPanel.tsx"
  ].map((sourcePath) => readText(sourcePath)).join("\n");
  const aiSettingsSource = readText("client/src/components/AiSettingsPanel.tsx");
  const rankingSource = readText("client/src/pages/RankingPage.tsx");
  const surfacesSource = readClientStyleModule("utilities/surfaces.css");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const preferencesSource = readClientStyleModule("base/preferences.css");
  const overlaysSource = readClientStyleModule("components/overlays-surfaces.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(surfacesSource, /\.paperMotionSurface/);
  assert.match(aiSettingsSource, /className="aiTaskRoute paperMotionSurface"/);
  assert.match(surfaceSafetySources, /className="surfaceSafetyRow paperMotionSurface"/);
  assert.ok((surfaceSafetySources.match(/className="surfaceSafetyRow paperMotionSurface"/g) || []).length >= 26);
  assert.doesNotMatch(surfaceSafetySources, /<div key=\{(?:item|row)\.label\}|<div data-polish-inventory-boundary/);
  assert.match(rankingSource, /className="paperMotionInteractive"/);
  assert.doesNotMatch(rankingSource, /className="paperMotionInteractive paperMotionSelected"/);

  assert.match(overlaysSource, /\.surfaceSafetyRow/);
  assert.doesNotMatch(overlaysSource, /\.surfaceSafetyList div/);
  assert.match(polishSource, /\.paperMotionSurface/);
  assert.doesNotMatch(polishSource, /\.aiTaskRoute|\.surfaceSafetyList div|\.rankingList button/);
  assert.match(preferencesSource, /\.paperMotionSurface/);

  assert.match(clientSmokeSource, /staticSurfaceCount: document\.querySelectorAll\("\.paperMotionSurface"\)\.length/);
  assert.match(clientSmokeSource, /legacySafetyRowCount: document\.querySelectorAll\("\.surfaceSafetyList > div:not\(\.surfaceSafetyRow\)"\)\.length/);
  assert.match(clientSmokeSource, /S89\.42 desktop inkbox static surfaces", \{ drawer: true, staticSurface: true, aiTaskRoute: true \}/);
  assert.match(clientSmokeSource, /rankingSelectedHookRows !== 0/);
});

test("S89.43 route surface containers use static paper surface utilities", () => {
  const rankingSource = readText("client/src/pages/RankingPage.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(rankingSource, /className="rankingNoticeBoard paperMotionSurface"/);
  assert.match(rankingSource, /className="rankingListPanel paperMotionSurface"/);
  assert.match(rankingSource, /className="rankingDetailPanel paperMotionSurface"/);
  assert.match(rankingSource, /className="rankingBoundary paperMotionSurface"/);
  assert.ok((surfaceHostSource.match(/className="topicSurfaceColumn(?: topicDraftColumn)? paperMotionSurface"/g) || []).length >= 6);
  assert.match(surfaceHostSource, /className="topicSurfaceColumn topicDraftColumn paperMotionSurface"/);

  assert.match(polishSource, /\.paperMotionSurface/);
  assert.doesNotMatch(polishSource, /\.rankingNoticeBoard|\.rankingListPanel|\.rankingDetailPanel|\.rankingBoundary|\.topicSurfaceColumn/);
  assert.doesNotMatch(rankingSource, /className="(?=[^"]*(?:rankingNoticeBoard|rankingListPanel|rankingDetailPanel|rankingBoundary))(?=[^"]*paperMotion(?:Card|Panel))[^"]*"/);
  assert.doesNotMatch(surfaceHostSource, /className="(?=[^"]*topicSurfaceColumn)(?=[^"]*paperMotion(?:Card|Panel))[^"]*"/);

  assert.match(clientSmokeSource, /rankingSurfaceCount: document\.querySelectorAll\("\.rankingNoticeBoard\.paperMotionSurface, \.rankingListPanel\.paperMotionSurface, \.rankingDetailPanel\.paperMotionSurface, \.rankingBoundary\.paperMotionSurface"\)\.length/);
  assert.match(clientSmokeSource, /topicSurfaceColumnCount: dialog\?\.querySelectorAll\("\.topicSurfaceColumn\.paperMotionSurface"\)\.length \|\| 0/);
});

test("S89.44 map and archive static ledgers use paper surface utilities", () => {
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const archivePageSource = readText("client/src/pages/ArchivePage.tsx");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const preferencesSource = readClientStyleModule("base/preferences.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(mapPageSource, /className="mapSituationLedger paperMotionSurface"/);
  assert.match(mapPageSource, /className="mapVisibleLayerDigest paperMotionSurface"/);
  assert.match(mapPageSource, /className="mapVisibleLayerDigest mapSituationIndex paperMotionSurface"/);
  assert.match(archivePageSource, /className="archiveDigestBand paperMotionSurface"/);
  assert.match(archivePageSource, /className="archiveDigestIntro paperMotionSurface"/);

  assert.match(polishSource, /\.paperMotionSurface/);
  assert.doesNotMatch(polishSource, /\.mapSituationLedger|\.mapVisibleLayerDigest|\.mapSituationIndex|\.archiveDigestBand|\.archiveDigestIntro/);
  assert.doesNotMatch(preferencesSource, /\.archiveDigestBand/);
  assert.doesNotMatch(`${mapPageSource}\n${archivePageSource}`, /className="(?=[^"]*(?:mapSituationLedger|mapVisibleLayerDigest|mapSituationIndex|archiveDigestBand|archiveDigestIntro))(?=[^"]*paperMotion(?:Card|Panel))[^"]*"/);

  assert.match(clientSmokeSource, /mapStaticSurfaceCount: document\.querySelectorAll\("\.mapSituationLedger\.paperMotionSurface, \.mapVisibleLayerDigest\.paperMotionSurface, \.mapSituationIndex\.paperMotionSurface"\)\.length/);
  assert.match(clientSmokeSource, /archiveSurfaceCount: document\.querySelectorAll\("\.archiveDigestBand\.paperMotionSurface, \.archiveDigestIntro\.paperMotionSurface"\)\.length/);
});

test("S89.45 inventory and economy ledgers use paper surface utilities", () => {
  const inventorySource = readText("client/src/pages/InventoryPage.tsx");
  const economySource = readText("client/src/components/EconomyTraceSection.tsx");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(inventorySource, /className="inventoryContainerList paperMotionSurface"/);
  assert.match(inventorySource, /className="inventoryItemList paperMotionSurface"/);
  assert.match(inventorySource, /className="inventoryLedgerBlock paperMotionSurface"/);
  assert.ok((inventorySource.match(/className="inventoryTransferPanel paperMotionSurface"/g) || []).length >= 2);
  assert.match(economySource, /className="economyTraceSection paperMotionSurface"/);

  assert.match(polishSource, /\.paperMotionSurface/);
  assert.doesNotMatch(polishSource, /\.inventoryContainerList|\.inventoryItemList|\.inventoryLedgerBlock|\.inventoryTransferPanel|\.economyTraceSection/);
  assert.doesNotMatch(`${inventorySource}\n${economySource}`, /className="(?=[^"]*(?:inventoryContainerList|inventoryItemList|inventoryLedgerBlock|inventoryTransferPanel|economyTraceSection))(?=[^"]*paperMotion(?:Card|Panel))[^"]*"/);
  assert.doesNotMatch(economySource, /submitTurn|transferInventoryItem|\/api\/game\/turn|dangerouslySetInnerHTML/);

  assert.match(clientSmokeSource, /inventorySurfaceCount: document\.querySelectorAll\("\.inventoryContainerList\.paperMotionSurface, \.inventoryItemList\.paperMotionSurface, \.inventoryLedgerBlock\.paperMotionSurface, \.inventoryTransferPanel\.paperMotionSurface, \.economyTraceSection\.paperMotionSurface"\)\.length/);
  assert.match(clientSmokeSource, /S89\.45 desktop inventory static surfaces/);
  assert.match(clientSmokeSource, /S89\.45 mobile inventory static surfaces/);
});

test("S89.46 home route static surfaces use paper surface utilities", () => {
  const homeSource = readText("client/src/pages/HomePage.tsx");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(homeSource, /className="homeDesk paperMotionSurface"/);
  assert.match(homeSource, /className="continueShelf paperMotionSurface"/);
  assert.match(homeSource, /className="saveShelf paperMotionSurface"/);

  assert.match(polishSource, /\.paperMotionSurface/);
  assert.doesNotMatch(polishSource, /\.homeDesk|\.saveShelf|\.continueShelf/);
  assert.doesNotMatch(homeSource, /className="(?=[^"]*(?:homeDesk|saveShelf|continueShelf))(?=[^"]*paperMotion(?:Card|Panel))[^"]*"/);
  assert.doesNotMatch(homeSource, /\/api\/game\/turn|submitTurn|dangerouslySetInnerHTML/);

  assert.match(clientSmokeSource, /homeSurfaceCount: document\.querySelectorAll\("\.homeDesk\.paperMotionSurface, \.saveShelf\.paperMotionSurface"\)\.length/);
  assert.match(clientSmokeSource, /continueSurfaceMissing: Boolean\(document\.querySelector\("\.continueShelf:not\(\.paperMotionSurface\)"\)\)/);
  assert.match(clientSmokeSource, /S89\.46 return-home continue shelf missed static surface hook/);
});

test("S89.47 main route static surfaces use paper surface utilities", () => {
  const gameSource = readText("client/src/pages/GamePage.tsx");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const preferencesSource = readClientStyleModule("base/preferences.css");
  const reducedMotionSource = readClientStyleModule("motion/reduced-motion.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(gameSource, /className="narrativeScroll paperMotionSurface"/);
  assert.match(gameSource, /className="gameSideLedger paperMotionSurface"/);
  assert.match(gameSource, /className="openingClaimPanel paperMotionSurface"/);
  assert.match(gameSource, /data-draft-state=\{activeActionDraft \? "written" : "empty"\}/);

  assert.match(polishSource, /\.paperMotionSurface/);
  assert.doesNotMatch(polishSource, /\.narrativeScroll|\.gameSideLedger|\.openingClaimPanel/);
  assert.match(preferencesSource, /\.gameSideLedger\[data-draft-state="written"\]/);
  assert.match(reducedMotionSource, /\.gameSideLedger\[data-draft-state="written"\]/);
  assert.doesNotMatch(gameSource, /className="(?=[^"]*(?:narrativeScroll|gameSideLedger|openingClaimPanel))(?=[^"]*paperMotion(?:Card|Panel))[^"]*"/);

  assert.match(clientSmokeSource, /mainStaticSurfaceCount: document\.querySelectorAll\("\.narrativeScroll\.paperMotionSurface, \.gameSideLedger\.paperMotionSurface, \.openingClaimPanel\.paperMotionSurface"\)\.length/);
  assert.match(clientSmokeSource, /mainStaticSurfaceMissing: Boolean\(document\.querySelector\("\.narrativeScroll:not\(\.paperMotionSurface\), \.gameSideLedger:not\(\.paperMotionSurface\), \.openingClaimPanel:not\(\.paperMotionSurface\)"\)\)/);
  assert.match(clientSmokeSource, /ledgerSurfaceWritten: Boolean\(document\.querySelector\("\.gameSideLedger\.paperMotionSurface\[data-draft-state='written'\]"\)\)/);
  assert.match(clientSmokeSource, /S89\.47 main static surfaces were incomplete/);
});

test("S89.48 people static surfaces use paper surface utilities", () => {
  const peopleSource = readText("client/src/pages/PeoplePage.tsx");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(peopleSource, /className="npcGroupList paperMotionSurface"/);
  assert.match(peopleSource, /className="npcDetailWorkbench paperMotionSurface"/);
  assert.match(peopleSource, /className="portraitLedger paperMotionSurface"/);
  assert.match(peopleSource, /className="npcListButton paperMotionSelected"/);
  assert.match(peopleSource, /data-gallery-selected=\{selectedNpc\?\.npcId === npc\.npcId \? "true" : "false"\}/);
  assert.match(peopleSource, /onSubmit=\{handleDialogueSubmit\}/);
  assert.match(peopleSource, /onSubmit=\{handleTradeSubmit\}/);
  assert.match(peopleSource, /onSubmit=\{handleCommandSubmit\}/);
  assert.match(peopleSource, /onSubmit=\{handleSocialSubmit\}/);

  assert.match(polishSource, /\.paperMotionSurface/);
  assert.doesNotMatch(polishSource, /\.portraitLedger|\.npcGroupList|\.npcDetailWorkbench/);
  assert.doesNotMatch(peopleSource, /className="(?=[^"]*(?:portraitLedger|npcGroupList|npcDetailWorkbench))(?=[^"]*paperMotion(?:Card|Panel))[^"]*"/);

  assert.match(clientSmokeSource, /peopleStaticSurfaceCount: document\.querySelectorAll\("\.portraitLedger\.paperMotionSurface, \.npcGroupList\.paperMotionSurface, \.npcDetailWorkbench\.paperMotionSurface"\)\.length/);
  assert.match(clientSmokeSource, /peopleStaticSurfaceMissing: Boolean\(document\.querySelector\("\.portraitLedger:not\(\.paperMotionSurface\), \.npcGroupList:not\(\.paperMotionSurface\), \.npcDetailWorkbench:not\(\.paperMotionSurface\)"\)\)/);
  assert.match(clientSmokeSource, /S89\.48 people static surfaces were incomplete/);
});

test("S89.49 exam static surfaces use paper surface utilities", () => {
  const examSource = readText("client/src/pages/ExamPage.tsx");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const preferencesSource = readClientStyleModule("base/preferences.css");
  const reducedMotionSource = readClientStyleModule("motion/reduced-motion.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(examSource, /className="examQuestionPanel paperMotionSurface"/);
  assert.match(examSource, /className="examDesk paperMotionSurface"/);
  assert.match(examSource, /className="examDesk examEmptyPaper paperMotionSurface"/);
  assert.match(examSource, /className="examPeerPanel paperMotionSurface"/);
  assert.match(examSource, /className="examRecentSubmitPanel paperMotionSurface"/);
  assert.ok((examSource.match(/className="examPreviewPanel paperMotionSurface"/g) || []).length >= 3);
  assert.ok((examSource.match(/className="examRecordPanel paperMotionSurface"/g) || []).length >= 2);
  assert.match(examSource, /onSubmit=\{handleQuestion\}/);
  assert.match(examSource, /onSubmit=\{handleProgress\}/);
  assert.match(examSource, /onSubmit=\{handleSubmit\}/);
  assert.match(examSource, /requestExamQuestion\(sessionId, level\)/);
  assert.match(examSource, /progressExam\(sessionId, examId, sceneAction\.trim\(\)\)/);
  assert.match(examSource, /submitExam\(sessionId, examId, essay\.trim\(\)\)/);

  assert.match(polishSource, /\.appShell\[data-material-motion="shared-paper"\] :is\(\.paperMotionCard, \.paperMotionPanel, \.paperMotionSurface\)/);
  assert.doesNotMatch(polishSource, /\.examQuestionPanel|\.examDesk|\.examRecordPanel|\.examPeerPanel|\.examPreviewPanel|\.examRecentSubmitPanel/);
  assert.match(preferencesSource, /\.examDesk\[data-polish-exam-paper="s89-33-exam-ceremony-material"\]/);
  assert.match(reducedMotionSource, /\.examDesk\[data-polish-exam-paper="s89-33-exam-ceremony-material"\]/);
  assert.doesNotMatch(examSource, /className="(?=[^"]*(?:examQuestionPanel|examDesk|examRecordPanel|examPeerPanel|examPreviewPanel|examRecentSubmitPanel))(?=[^"]*paperMotion(?:Card|Panel))[^"]*"/);

  assert.match(clientSmokeSource, /examStaticSurfaceCount: document\.querySelectorAll\("\.examQuestionPanel\.paperMotionSurface, \.examDesk\.paperMotionSurface, \.examRecordPanel\.paperMotionSurface, \.examPeerPanel\.paperMotionSurface, \.examPreviewPanel\.paperMotionSurface, \.examRecentSubmitPanel\.paperMotionSurface"\)\.length/);
  assert.match(clientSmokeSource, /activePaperSurface: Boolean\(document\.querySelector\("\[aria-label='当前试卷'\]\.examDesk\.paperMotionSurface\[data-polish-exam-paper='s89-33-exam-ceremony-material'\]"\)\)/);
  assert.match(clientSmokeSource, /S89\.49 exam static surfaces were incomplete before question/);
  assert.match(clientSmokeSource, /S89\.49 exam static surfaces were incomplete after question/);
});

test("S89.50 shared paper motion keyframes use semantic names and tokens", () => {
  const tokensSource = readClientStyleModule("tokens/tokens.css");
  const keyframesSource = readClientStyleModule("motion/keyframes.css");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(tokensSource, /--qq-color-vermilion-glow-outline: rgb\(142 47 39 \/ \.22\)/);
  assert.match(tokensSource, /--qq-color-warm-shadow-soft: rgb\(86 40 31 \/ \.12\)/);
  assert.match(tokensSource, /--qq-color-paper-inset-medium: rgb\(255 252 238 \/ \.58\)/);
  assert.match(keyframesSource, /@keyframes paperSurfaceRise/);
  assert.match(keyframesSource, /@keyframes paperWrittenStateWash/);
  assert.match(keyframesSource, /@keyframes paperSelectedSealBloom/);
  assert.match(keyframesSource, /outline: 2px solid var\(--qq-color-vermilion-glow-outline\)/);
  assert.match(keyframesSource, /var\(--qq-color-vermilion-glow-strong\)/);
  assert.match(keyframesSource, /var\(--qq-color-warm-shadow-medium\)/);
  assert.match(keyframesSource, /var\(--qq-color-paper-inset-soft\)/);
  assert.doesNotMatch(keyframesSource, /@keyframes s8930PaperRise|@keyframes s8930StateWash|@keyframes s8930SealBloom|#8e2f2738/);

  assert.match(polishSource, /animation: paperSurfaceRise 360ms/);
  assert.match(polishSource, /animation: paperSelectedSealBloom 420ms/);
  assert.match(polishSource, /animation: draftWrittenPulse \.36s, paperWrittenStateWash 720ms/);
  assert.doesNotMatch(polishSource, /s8930PaperRise|s8930StateWash|s8930SealBloom/);
  assert.match(clientSmokeSource, /keyframesOf\("paperSurfaceRise"\)/);
  assert.match(clientSmokeSource, /keyframesOf\("paperWrittenStateWash"\)/);
  assert.match(clientSmokeSource, /keyframesOf\("paperSelectedSealBloom"\)/);
  assert.doesNotMatch(clientSmokeSource, /s8930PaperRise|s8930StateWash|s8930SealBloom/);
});

test("S89.51 shared paper state surfaces reuse semantic color tokens", () => {
  const tokensSource = readClientStyleModule("tokens/tokens.css");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const runtimeSource = readClientStyleSource();

  assert.match(tokensSource, /--qq-color-vermilion-border-soft: rgb\(142 47 39 \/ \.28\)/);
  assert.match(tokensSource, /--qq-color-vermilion-border-medium: rgb\(142 47 39 \/ \.46\)/);
  assert.match(tokensSource, /--qq-color-vermilion-border-strong: rgb\(142 47 39 \/ \.62\)/);
  assert.match(tokensSource, /--qq-color-paper-inset-faint: rgb\(255 252 238 \/ \.34\)/);
  assert.match(tokensSource, /--qq-shadow-paper-selected:/);
  assert.match(tokensSource, /--qq-shadow-paper-written:/);
  assert.match(tokensSource, /--qq-shadow-paper-empty:/);
  assert.match(tokensSource, /--qq-surface-paper-selected:/);
  assert.match(tokensSource, /--qq-surface-paper-written:/);
  assert.match(tokensSource, /--qq-surface-paper-empty:/);

  assert.match(polishSource, /border-color: var\(--qq-color-vermilion-border-medium\)/);
  assert.match(polishSource, /background-image: var\(--qq-surface-paper-selected\)/);
  assert.match(polishSource, /box-shadow: var\(--qq-shadow-paper-selected\)/);
  assert.match(polishSource, /border-color: var\(--qq-color-vermilion-border-strong\)/);
  assert.match(polishSource, /background-image: var\(--qq-surface-paper-written\)/);
  assert.match(polishSource, /box-shadow: var\(--qq-shadow-paper-written\)/);
  assert.match(polishSource, /border-color: var\(--qq-color-vermilion-border-soft\)/);
  assert.match(polishSource, /background: var\(--qq-surface-paper-empty\)/);
  assert.match(polishSource, /box-shadow: var\(--qq-shadow-paper-empty\)/);
  assert.doesNotMatch(polishSource, /rgb\(/);
  assert.match(runtimeSource, /\.appShell\[data-contrast="high"\] \.paperMotionSelected:is/);
  assert.match(runtimeSource, /\.appShell\[data-motion="reduced"\]\[data-material-motion="shared-paper"\] :is\(\.paperMotionCard/);
});

test("S89.52 high contrast mode overrides shared paper state tokens", () => {
  const preferencesSource = readClientStyleModule("base/preferences.css");
  const polishSource = readClientStyleModule("utilities/polish-surfaces.css");
  const runtimeSource = readClientStyleSource();
  const highContrastBlock = preferencesSource.match(/\.appShell\[data-contrast="high"\] \{[\s\S]*?\n\}/)?.[0] || "";

  for (const tokenName of [
    "--qq-color-vermilion-glow-soft",
    "--qq-color-vermilion-glow-medium",
    "--qq-color-vermilion-glow-strong",
    "--qq-color-vermilion-border-soft",
    "--qq-color-vermilion-border-medium",
    "--qq-color-vermilion-border-strong",
    "--qq-color-warm-shadow-soft",
    "--qq-color-warm-shadow-medium",
    "--qq-color-paper-inset-faint",
    "--qq-color-paper-inset-soft",
    "--qq-color-paper-inset-medium",
    "--qq-surface-paper-selected",
    "--qq-surface-paper-written",
    "--qq-surface-paper-empty"
  ]) {
    assert.match(highContrastBlock, new RegExp(`${tokenName}:`));
  }

  assert.match(highContrastBlock, /--qq-color-vermilion-glow-outline: rgb\(95 24 21 \/ \.34\)/);
  assert.match(highContrastBlock, /--qq-color-vermilion-border-strong: rgb\(95 24 21 \/ \.74\)/);
  assert.match(highContrastBlock, /--qq-color-paper-inset-soft: rgb\(255 252 238 \/ \.72\)/);

  assert.match(polishSource, /box-shadow: var\(--qq-shadow-paper-selected\)/);
  assert.match(polishSource, /box-shadow: var\(--qq-shadow-paper-written\)/);
  assert.match(polishSource, /box-shadow: var\(--qq-shadow-paper-empty\)/);
  assert.match(runtimeSource, /\.appShell\[data-contrast="high"\] \.paperMotionSelected:is/);
  assert.match(runtimeSource, /\.appShell\[data-motion="reduced"\]\[data-material-motion="shared-paper"\] :is\(\.paperMotionCard/);
});

test("S89.53 map tone colors use semantic state tokens", () => {
  const tokensSource = readClientStyleModule("tokens/tokens.css");
  const preferencesSource = readClientStyleModule("base/preferences.css");
  const mapArchiveSource = readClientStyleModule("routes/map-archive.css");
  const highContrastBlock = preferencesSource.match(/\.appShell\[data-contrast="high"\] \{[\s\S]*?\n\}/)?.[0] || "";

  for (const tokenName of [
    "--qq-color-state-green-accent",
    "--qq-color-state-gold-accent",
    "--qq-color-state-purple-accent",
    "--qq-color-state-green-border-soft",
    "--qq-color-state-green-border-medium",
    "--qq-color-state-green-border-strong",
    "--qq-color-state-green-border-emphasis",
    "--qq-color-state-green-fill-strong",
    "--qq-color-state-gold-border-soft",
    "--qq-color-state-gold-border-medium",
    "--qq-color-state-gold-border-strong",
    "--qq-color-state-gold-fill-soft",
    "--qq-color-state-gold-fill-strong",
    "--qq-color-state-purple-border-medium",
    "--qq-color-state-purple-border-strong"
  ]) {
    assert.match(tokensSource, new RegExp(`${tokenName}:`));
    assert.match(highContrastBlock, new RegExp(`${tokenName}:`));
  }

  assert.match(mapArchiveSource, /\.mapSituationIndexList div \{[\s\S]*border-left: 3px solid var\(--qq-color-state-green-border-medium\)/);
  assert.match(mapArchiveSource, /\.mapSituationIndexList dt \{[\s\S]*color: var\(--qq-color-state-green-accent\)/);
  assert.match(mapArchiveSource, /\.mapTideCompass::before \{[\s\S]*var\(--qq-color-state-gold-fill-soft\)[\s\S]*var\(--qq-color-state-green-border-medium\)/);
  assert.match(mapArchiveSource, /\.mapTideCompassHeader > span \{[\s\S]*border: 1px solid var\(--qq-color-state-gold-border-soft\)[\s\S]*color: var\(--qq-color-state-gold-accent\)/);
  assert.match(mapArchiveSource, /\.mapTideCompassTab\[aria-selected="true"\]\[data-compass-tone="people"\] \{[\s\S]*border-color: var\(--qq-color-state-green-border-strong\)/);
  assert.match(mapArchiveSource, /\.mapTideCompassTab\[aria-selected="true"\]\[data-compass-tone="consequence"\] \{[\s\S]*border-color: var\(--qq-color-state-purple-border-medium\)/);
  assert.match(mapArchiveSource, /\.mapTideCompassReadout\[data-compass-tone="drafts"\] \{[\s\S]*border-left-color: var\(--qq-color-state-gold-border-strong\)/);
  assert.match(mapArchiveSource, /\.mapNpcActivityList li \{[\s\S]*border: 1px solid var\(--qq-color-state-green-border-soft\)/);
  assert.match(mapArchiveSource, /\.inkMapTooltip\[data-tooltip-tone="people"\] \{[\s\S]*border-color: var\(--qq-color-state-green-border-strong\)/);
  assert.match(mapArchiveSource, /\.inkMapTooltipReading i \{[\s\S]*var\(--qq-color-state-green-fill-strong\)[\s\S]*var\(--qq-color-state-gold-fill-strong\)/);
  assert.doesNotMatch(mapArchiveSource, /rgb\(47 111 94|rgb\(214 164 70|rgb\(112 84 149|#2f6f5e|#7b4d1f|#705495/);
});

test("S89.54 base controls and status lines use semantic tokens", () => {
  const tokensSource = readClientStyleModule("tokens/tokens.css");
  const preferencesSource = readClientStyleModule("base/preferences.css");
  const controlsSource = readClientStyleModule("components/controls.css");
  const highContrastBlock = preferencesSource.match(/\.appShell\[data-contrast="high"\] \{[\s\S]*?\n\}/)?.[0] || "";

  for (const tokenName of [
    "--qq-color-control-border",
    "--qq-color-control-text",
    "--qq-surface-control-field",
    "--qq-color-paper-button-border",
    "--qq-color-paper-button-border-hover",
    "--qq-color-paper-button-border-active",
    "--qq-color-paper-button-text",
    "--qq-color-paper-button-text-shadow",
    "--qq-color-paper-button-shine",
    "--qq-color-paper-button-outline",
    "--qq-shadow-paper-button-hover",
    "--qq-shadow-paper-button-active",
    "--qq-shadow-paper-button-disabled-inset",
    "--qq-surface-paper-button",
    "--qq-surface-paper-button-hover",
    "--qq-surface-paper-button-active",
    "--qq-color-status-surface-border",
    "--qq-shadow-status-line",
    "--qq-surface-status-line",
    "--qq-surface-status-marker",
    "--qq-shadow-status-marker",
    "--qq-color-seal-status"
  ]) {
    assert.match(tokensSource, new RegExp(`${tokenName}:`));
    assert.match(highContrastBlock, new RegExp(`${tokenName}:`));
  }

  assert.match(controlsSource, /input,[\s\S]*border: 1px solid var\(--qq-color-control-border\)[\s\S]*background: var\(--qq-surface-control-field\)[\s\S]*color: var\(--qq-color-control-text\)/);
  assert.match(controlsSource, /\.paperButton \{[\s\S]*border: 1px solid var\(--qq-color-paper-button-border\)[\s\S]*background: var\(--qq-surface-paper-button\)[\s\S]*color: var\(--qq-color-paper-button-text\)/);
  assert.match(controlsSource, /\.paperButton::before \{[\s\S]*var\(--qq-color-paper-button-shine\)/);
  assert.match(controlsSource, /\.paperButton:hover:not\(:disabled\),[\s\S]*border-color: var\(--qq-color-paper-button-border-hover\)[\s\S]*background: var\(--qq-surface-paper-button-hover\)[\s\S]*var\(--qq-shadow-paper-button-hover\)/);
  assert.match(controlsSource, /\.paperButton:active:not\(:disabled\) \{[\s\S]*border-color: var\(--qq-color-paper-button-border-active\)[\s\S]*background: var\(--qq-surface-paper-button-active\)[\s\S]*box-shadow: var\(--qq-shadow-paper-button-active\)/);
  assert.match(controlsSource, /\.paperButton\[aria-disabled="true"\] \{[\s\S]*box-shadow: var\(--qq-shadow-paper-button-disabled-inset\)/);
  assert.match(controlsSource, /\.appShell\[data-material-motion="shared-paper"\] \.statusLine \{[\s\S]*border: 1px solid var\(--qq-color-status-surface-border\)[\s\S]*background: var\(--qq-surface-status-line\)[\s\S]*box-shadow: var\(--qq-shadow-status-line\)/);
  assert.match(controlsSource, /\.appShell\[data-material-motion="shared-paper"\] \.statusLine::before \{[\s\S]*background: var\(--qq-surface-status-marker\)[\s\S]*box-shadow: var\(--qq-shadow-status-marker\)/);
  assert.match(controlsSource, /\.sealStatus \{[\s\S]*color: var\(--qq-color-seal-status\)/);
  assert.doesNotMatch(controlsSource, /rgb\(84 60 43 \/ \.34|rgb\(255 252 238 \/ \.9\)|#241b16|rgb\(142 47 39 \/ \.58|rgb\(255 252 238 \/ \.88|rgb\(236 218 184 \/ \.72|rgb\(255 248 230 \/ \.52|rgb\(255 248 230 \/ \.34|rgb\(54 37 24 \/ \.13|rgb\(95 24 21 \/ \.82|rgb\(224 197 161 \/ \.82|rgb\(75 43 28 \/ \.18|rgb\(142 47 39 \/ \.18|rgb\(236 218 184 \/ \.46|rgb\(206 153 64 \/ \.52|#7a6048/);
});

test("S89.55 utility surfaces use shared semantic tokens", () => {
  const tokensSource = readClientStyleModule("tokens/tokens.css");
  const preferencesSource = readClientStyleModule("base/preferences.css");
  const surfacesSource = readClientStyleModule("utilities/surfaces.css");
  const highContrastBlock = preferencesSource.match(/\.appShell\[data-contrast="high"\] \{[\s\S]*?\n\}/)?.[0] || "";
  const highContrastSurfaceRule =
    preferencesSource.match(/\.appShell\[data-contrast="high"\] :is\([\s\S]*?\),\n\.appShell\[data-contrast="high"\] \.paperMotionSelected:is\([\s\S]*?\) \{[\s\S]*?\n\}/)?.[0] || "";
  const statusSurfaceBlock = surfacesSource.match(/:where\(\.statusSurface\) \{[\s\S]*?\n\}/)?.[0] || "";

  for (const tokenName of [
    "--qq-color-status-surface-border",
    "--qq-shadow-ledger-card",
    "--qq-surface-status-surface"
  ]) {
    assert.match(tokensSource, new RegExp(`${tokenName}:`));
    assert.match(highContrastBlock, new RegExp(`${tokenName}:`));
  }

  assert.match(surfacesSource, /:where\(\.ledgerCard\) \{[\s\S]*box-shadow: var\(--qq-shadow-ledger-card\)/);
  assert.match(statusSurfaceBlock, /border: 1px solid var\(--qq-color-status-surface-border\)[\s\S]*background: var\(--qq-surface-status-surface\)/);
  assert.match(highContrastSurfaceRule, /\.statusSurface/);
  assert.match(highContrastSurfaceRule, /\.ledgerCard/);
  assert.match(highContrastSurfaceRule, /border-color: var\(--qq-color-border-medium\)/);
  assert.doesNotMatch(statusSurfaceBlock, /--qq-surface-status-line/);
  assert.doesNotMatch(surfacesSource, /0 10px 22px rgb\(80 50 35 \/ \.08|rgb\(255 255 255 \/ \.28|rgb\(142 47 39 \/ \.18|rgb\(255 252 238 \/ \.64/);
});

test("S89.56 shell chrome uses semantic surface tokens", () => {
  const tokensSource = readClientStyleModule("tokens/tokens.css");
  const preferencesSource = readClientStyleModule("base/preferences.css");
  const shellSource = readClientStyleModule("components/shell.css");
  const highContrastBlock = preferencesSource.match(/\.appShell\[data-contrast="high"\] \{[\s\S]*?\n\}/)?.[0] || "";

  for (const tokenName of [
    "--qq-surface-shell-topbar",
    "--qq-shadow-shell-topbar",
    "--qq-surface-shell-topbar-glass",
    "--qq-surface-shell-divider",
    "--qq-surface-shell-nav-underline",
    "--qq-surface-shell-nav-active",
    "--qq-shadow-shell-nav-active",
    "--qq-color-shell-tools-border",
    "--qq-surface-shell-tools",
    "--qq-shadow-shell-tools",
    "--qq-color-shell-action-border",
    "--qq-color-shell-action-border-strong",
    "--qq-color-shell-action-text",
    "--qq-color-shell-action-outline",
    "--qq-surface-shell-icon-button",
    "--qq-shadow-shell-icon-button",
    "--qq-color-shell-inkbox-border",
    "--qq-surface-shell-inkbox-button",
    "--qq-shadow-shell-inkbox-button",
    "--qq-surface-shell-inkbox-shine",
    "--qq-shadow-shell-action-hover",
    "--qq-shadow-shell-inkbox-active",
    "--qq-color-brand-seal-inset"
  ]) {
    assert.match(tokensSource, new RegExp(`${tokenName}:`));
    assert.match(highContrastBlock, new RegExp(`${tokenName}:`));
  }

  assert.match(shellSource, /\.topBar \{[\s\S]*background: var\(--qq-surface-shell-topbar\)[\s\S]*box-shadow: var\(--qq-shadow-shell-topbar\)/);
  assert.match(shellSource, /\.topBar\[data-polish-shell="s89-32-shell-entry-glass"\]::before \{[\s\S]*background: var\(--qq-surface-shell-topbar-glass\)/);
  assert.match(shellSource, /\.topBar::after \{[\s\S]*background: var\(--qq-surface-shell-divider\)/);
  assert.match(shellSource, /\.brandSeal \{[\s\S]*box-shadow: inset 0 0 0 4px var\(--qq-color-brand-seal-inset\)/);
  assert.match(shellSource, /\.topNav\[data-polish-shell-nav="s89-32-main-nav-density"\] a::after \{[\s\S]*background: var\(--qq-surface-shell-nav-underline\)/);
  assert.match(shellSource, /\.topNav a\.active,[\s\S]*background: var\(--qq-surface-shell-nav-active\)[\s\S]*box-shadow: var\(--qq-shadow-shell-nav-active\)/);
  assert.match(shellSource, /\.topTools\[data-polish-shell-tools="s89-32-inkbox-entry"\] \{[\s\S]*border: 1px solid var\(--qq-color-shell-tools-border\)[\s\S]*background: var\(--qq-surface-shell-tools\)[\s\S]*box-shadow: var\(--qq-shadow-shell-tools\)/);
  assert.match(shellSource, /\.iconButton \{[\s\S]*border: 1px solid var\(--qq-color-shell-action-border\)[\s\S]*background: var\(--qq-surface-shell-icon-button\)[\s\S]*color: var\(--qq-color-shell-action-text\)[\s\S]*box-shadow: var\(--qq-shadow-shell-icon-button\)/);
  assert.match(shellSource, /\.inkboxButton \{[\s\S]*border: 1px solid var\(--qq-color-shell-inkbox-border\)[\s\S]*background: var\(--qq-surface-shell-inkbox-button\)[\s\S]*color: var\(--qq-color-shell-action-text\)[\s\S]*box-shadow: var\(--qq-shadow-shell-inkbox-button\)/);
  assert.match(shellSource, /\.inkboxButton::before \{[\s\S]*background: var\(--qq-surface-shell-inkbox-shine\)/);
  assert.match(shellSource, /\.iconButton:hover,[\s\S]*border-color: var\(--qq-color-shell-action-border-strong\)[\s\S]*box-shadow: var\(--qq-shadow-shell-action-hover\)[\s\S]*outline: 2px solid var\(--qq-color-shell-action-outline\)/);
  assert.match(shellSource, /\.inkboxButton:active \{[\s\S]*box-shadow: var\(--qq-shadow-shell-inkbox-active\)/);
  assert.doesNotMatch(shellSource, /rgb\(255 250 234 \/ \.88|rgb\(229 211 178 \/ \.78|rgb\(142 47 39 \/ \.54|rgb\(204 156 72 \/ \.38|rgb\(255 252 238 \/ \.28|rgb\(142 47 39 \/ \.48|#7b241f|rgb\(86 40 31 \/ \.18|rgb\(123 36 31 \/ \.24|rgb\(75 43 28 \/ \.18/);
});

test("S89.57 home and shell polish keyframes use semantic names", () => {
  const homeSource = readClientStyleModule("routes/home.css");
  const shellSource = readClientStyleModule("components/shell.css");
  const overlaysSource = readClientStyleModule("components/overlays-surfaces.css");
  const keyframesSource = readClientStyleModule("motion/keyframes.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const combinedRuntimeSource = `${homeSource}\n${shellSource}\n${overlaysSource}\n${keyframesSource}`;

  for (const keyframeName of [
    "homeOpeningDeskUnfurl",
    "homeOpeningPathStepRise",
    "inkboxPanelGlassIn",
    "shellNavInkUnderlineGlow",
    "inkboxTabSelectedSealBloom"
  ]) {
    assert.match(keyframesSource, new RegExp(`@keyframes ${keyframeName}`));
    assert.match(combinedRuntimeSource, new RegExp(`animation: ${keyframeName}`));
    assert.match(clientSmokeSource, new RegExp(`keyframesOf\\("${keyframeName}"\\)`));
  }

  assert.match(clientSmokeSource, /animationName\.includes\("homeOpeningDeskUnfurl"\)/);
  assert.match(clientSmokeSource, /animationName\.includes\("homeOpeningPathStepRise"\)/);
  assert.match(clientSmokeSource, /animationName\.includes\("inkboxPanelGlassIn"\)/);
  assert.doesNotMatch(combinedRuntimeSource, /s8932(?:ScrollUnfurl|InkPathRise|InkboxGlassIn|NavInkGlow|SealPressBloom)/);
  assert.doesNotMatch(clientSmokeSource, /s8932(?:ScrollUnfurl|InkPathRise|InkboxGlassIn|NavInkGlow|SealPressBloom)/);
});

test("S89.25 overlay glass polish stays shared and safe", () => {
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const runtimeCombined = stripSafeGuardPatterns(`${surfaceHostSource}\n${styleSource}`);

  assert.ok(styleSource.length < 200_000);
  assert.match(surfaceHostSource, /data-polish-depth="s89-25-liquid-glass"/);
  assert.match(styleSource, /\.drawerHost\[data-polish-depth="s89-25-liquid-glass"\]/);
  assert.match(styleSource, /\.modalPanel\[data-polish-depth="s89-25-liquid-glass"\]/);
  assert.match(styleSource, /backdrop-filter: blur\(12px\) saturate\(1\.08\)/);
  assert.match(clientSmokeSource, /s89-25-liquid-glass/);
  assert.match(clientSmokeSource, /drawer lacked S89\.25 glass blur/);
  assert.doesNotMatch(
    runtimeCombined,
    /submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|hiddenNotes|完整提示词|本地路径|密钥/
  );
});

test("S89.26 people docket reader stays player-facing and CSS-neutral", () => {
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const runtimeCombined = stripSafeGuardPatterns(`${peoplePageSource}\n${styleSource}`);
  const readerBlock = peoplePageSource.slice(
    peoplePageSource.indexOf("data-polish-people-reader=\"s89-26-people-docket-reader\""),
    peoplePageSource.indexOf("<NpcActiveRequestInbox")
  );

  assert.ok(styleSource.length < 200_000);
  assert.match(peoplePageSource, /data-polish-people-reader="s89-26-people-docket-reader"/);
  assert.match(peoplePageSource, /交游候复笺/);
  assert.match(peoplePageSource, /人物案头索引/);
  assert.match(peoplePageSource, /不成交、不扣银、不改关系/);
  assert.match(peoplePageSource, /已有候复稿/);
  assert.match(peoplePageSource, /countVisibleFollowUpEvidence/);
  assert.match(peoplePageSource, /countVisiblePeopleEconomyTrace/);
  assert.match(clientSmokeSource, /S89\.26 people docket reader missing/);
  assert.doesNotMatch(readerBlock, /actionDraft\.text|draftContext|sourceRef/);
  assert.doesNotMatch(styleSource, /s89-26/);
  assert.doesNotMatch(
    runtimeCombined,
    /submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|hiddenNotes|完整提示词|本地路径|密钥/
  );
});

test("S89.30 shared material and motion polish stays visual-only", () => {
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const budgetSource = readText("scripts/clientBuildBudget.js");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const runtimeCombined = stripSafeGuardPatterns(`${appShellSource}\n${styleSource}\n${budgetSource}`);

  assert.ok(styleSource.length < 200_000);
  assert.match(appShellSource, /data-polish-atmosphere="s89-30-shared-material-motion"/);
  assert.match(appShellSource, /data-material-motion="shared-paper"/);
  assert.match(styleSource, /\.appShell\[data-material-motion="shared-paper"\] \.statusLine/);
  assert.match(styleSource, /@keyframes paperSurfaceRise/);
  assert.match(styleSource, /@keyframes paperWrittenStateWash/);
  assert.match(styleSource, /@keyframes paperSelectedSealBloom/);
  assert.match(styleSource, /\.appShell\[data-material-motion="shared-paper"\] :is\(\.paperMotionCard/);
  assert.match(styleSource, /\.quickActionSlip\[data-draft-state="written"\]/);
  assert.match(styleSource, /\.topicDraftSlot\[aria-pressed="true"\]/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\]\[data-material-motion="shared-paper"\]/);
  assert.match(styleSource, /prefers-reduced-motion: reduce[\s\S]*data-material-motion="shared-paper"/);
  assert.match(budgetSource, /maxCssBytes:\s*220_000/);
  assert.match(budgetSource, /maxSingleCssBytes:\s*200_000/);
  assert.match(clientSmokeSource, /shellAtmosphere/);
  assert.match(clientSmokeSource, /shellMaterialMotion/);
  assert.match(clientSmokeSource, /paperSurfaceRise/);
  assert.match(clientSmokeSource, /S89\.30 shared material/);
  assert.doesNotMatch(
    runtimeCombined,
    /submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|hiddenNotes|完整提示词|本地路径|密钥|AI read scope|proposal boundary|server adjudication|draftContext|schema|manifest/
  );
});

test("S89.58 map polish keyframes use semantic names", () => {
  const keyframesSource = readText("client/src/styles/motion/keyframes.css");
  const mapRouteSource = readText("client/src/styles/routes/map-archive.css");
  const mobileMapSource = readText("client/src/styles/responsive/mobile-game-map.css");
  const styleSource = readText("client/src/styles/global.css");
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(keyframesSource, /@keyframes mapTideCompassRailGlow/);
  assert.match(keyframesSource, /@keyframes inkMapTooltipNoteIn/);
  assert.match(keyframesSource, /@keyframes inkMapTooltipSheetIn/);
  assert.match(mapRouteSource, /\.mapTideCompass::before[\s\S]*animation: mapTideCompassRailGlow 2400ms ease-in-out infinite alternate/);
  assert.match(mapRouteSource, /\.inkMapTooltip \{[\s\S]*animation: inkMapTooltipNoteIn 180ms ease-out both/);
  assert.match(mobileMapSource, /\.inkMapTooltip \{[\s\S]*animation-name: inkMapTooltipSheetIn/);
  assert.match(clientSmokeSource, /mapTideCompassRailGlow/);
  assert.match(clientSmokeSource, /inkMapTooltipNoteIn/);
  assert.match(clientSmokeSource, /inkMapTooltipSheetIn/);
  assert.doesNotMatch(styleSource, /@keyframes s8931(?:MapTideGlow|MapNoteIn|MapNoteSheetIn)|animation(?:-name)?: s8931(?:MapTideGlow|MapNoteIn|MapNoteSheetIn)/);
  assert.doesNotMatch(clientSmokeSource, /s8931(?:MapTideGlow|MapNoteIn|MapNoteSheetIn)/);
});

test("S89.32 home and shell entry polish stays visual-only", () => {
  const homePageSource = readText("client/src/pages/HomePage.tsx");
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const settingsPageSource = readText("client/src/pages/SettingsPage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const runtimeCombined = stripSafeGuardPatterns(`${homePageSource}\n${appShellSource}\n${settingsPageSource}\n${styleSource}`);

  assert.ok(styleSource.length < 200_000);
  assert.match(homePageSource, /data-polish-home="s89-32-home-entry-scroll"/);
  assert.match(homePageSource, /data-polish-home-entry="s89-32-opening-desk"/);
  assert.match(homePageSource, /data-polish-home-form="s89-32-opening-form"/);
  assert.match(homePageSource, /data-polish-home-path="s89-32-opening-path"/);
  assert.match(homePageSource, /data-polish-home-current="s89-32-current-case"/);
  assert.match(homePageSource, /data-polish-home-saves="s89-32-save-shelf"/);
  assert.match(homePageSource, /试阅样卷/);
  assert.match(homePageSource, /样卷舆图/);
  assert.match(homePageSource, /开卷路径/);
  assert.match(homePageSource, /先题名，再入世，诸事候复/);
  assert.match(homePageSource, /新卷开启后，行动仍回主卷落笔候复/);
  assert.match(appShellSource, /data-polish-entry="s89-32-shell-entry-glass"/);
  assert.match(appShellSource, /data-polish-shell="s89-32-shell-entry-glass"/);
  assert.match(appShellSource, /data-polish-shell-nav="s89-32-main-nav-density"/);
  assert.match(appShellSource, /data-polish-shell-tools="s89-32-inkbox-entry"/);
  assert.match(surfaceHostSource, /data-polish-inkbox="s89-32-inkbox-glass-ledger"/);
  assert.match(surfaceHostSource, /data-polish-inkbox-overview="s89-32-inkbox-glass-ledger"/);
  assert.match(surfaceHostSource, /data-polish-inkbox-tabs="s89-32-inkbox-glass-ledger"/);
  assert.match(surfaceHostSource, /data-polish-inkbox-panel="s89-32-inkbox-glass-ledger"/);
  assert.match(settingsPageSource, /data-polish-settings-entry="s89-32-settings-directory-entry"/);
  assert.match(settingsPageSource, /data-settings-tab=\{card\.tab\}/);
  assert.match(styleSource, /@keyframes homeOpeningDeskUnfurl/);
  assert.match(styleSource, /@keyframes homeOpeningPathStepRise/);
  assert.match(styleSource, /@keyframes inkboxPanelGlassIn/);
  assert.match(styleSource, /@keyframes shellNavInkUnderlineGlow/);
  assert.match(styleSource, /@keyframes inkboxTabSelectedSealBloom/);
  assert.doesNotMatch(styleSource, /@keyframes s8932(?:ScrollUnfurl|InkPathRise|InkboxGlassIn|NavInkGlow|SealPressBloom)/);
  assert.doesNotMatch(clientSmokeSource, /keyframesOf\("s8932(?:ScrollUnfurl|InkPathRise|InkboxGlassIn|NavInkGlow|SealPressBloom)"\)/);
  assert.match(styleSource, /\.topTools\[data-polish-shell-tools="s89-32-inkbox-entry"\][\s\S]*backdrop-filter: blur\(10px\) saturate\(1\.04\)/);
  assert.match(styleSource, /\.homeOpeningPath ol/);
  assert.match(styleSource, /\.inkboxPanel\[data-polish-inkbox-panel="s89-32-inkbox-glass-ledger"\][\s\S]*backdrop-filter: blur\(8px\) saturate\(1\.03\)/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\][\s\S]*s89-32-opening-desk/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*s89-32-inkbox-glass-ledger/);
  assert.match(appTestSource, /s89-32-home-entry-scroll/);
  assert.match(appTestSource, /试阅样卷/);
  assert.match(clientSmokeSource, /assertS8932HomeShellPolish/);
  assert.match(clientSmokeSource, /S89\.32 desktop home/);
  assert.match(clientSmokeSource, /S89\.32 desktop inkbox/);
  assert.match(clientSmokeSource, /S89\.32 settings directory/);
  assert.match(clientSmokeSource, /S89\.32 mobile home/);
  assert.match(clientSmokeSource, /S89\.32 reduced inkbox/);
  assert.doesNotMatch(
    runtimeCombined,
    /submitTurn|\/api\/game\/turn|\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|hiddenNotes|完整提示词|本地路径|密钥|AI read scope|proposal boundary|server adjudication|draftContext|schema|manifest/
  );
});

test("S89.28 Vite vendor chunking protects the client JS budget", () => {
  const viteConfigSource = readText("vite.config.mjs");
  const budgetSource = readText("scripts/clientBuildBudget.js");

  assert.match(viteConfigSource, /manualChunks\(id\)/);
  assert.match(viteConfigSource, /vendor-react/);
  assert.match(viteConfigSource, /vendor-state/);
  assert.match(viteConfigSource, /vendor-icons/);
  assert.match(viteConfigSource, /\[\\\\\/\]node_modules\[\\\\\/\]/);
  assert.match(budgetSource, /maxSingleJsBytes:\s*650_000/);
  assert.doesNotMatch(viteConfigSource, /React\.lazy|lazy:\s*\(/);
  assert.doesNotMatch(viteConfigSource, /maxSingleJsBytes|650_000|850_000/);
});

test("S74.7 client smoke verifies default UI start and safe route recovery", () => {
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const errorPageSource = readText("client/src/pages/ErrorPage.tsx");
  const notFoundPageSource = readText("client/src/pages/NotFoundPage.tsx");
  const routeRecoverySource = readText("client/src/routes/routeRecovery.ts");
  const combinedRouteRecoverySource = `${errorPageSource}\n${notFoundPageSource}\n${routeRecoverySource}`;

  assert.match(clientSmokeSource, /startMockGameThroughHome/);
  assert.match(clientSmokeSource, /getByLabel\("姓名"\)/);
  assert.match(clientSmokeSource, /getByRole\("button", \{ name: "新开一卷" \}\)/);
  assert.match(clientSmokeSource, /clickTopNavRoute\(page, "舆图"/);
  assert.match(clientSmokeSource, /assertRouteRefresh\(page, runtimeMapPath/);
  assert.match(clientSmokeSource, /assertRouteRefresh\(page, peoplePath/);
  assert.match(clientSmokeSource, /s89-2-inventory-desktop/);
  assert.match(clientSmokeSource, /s89-2-inventory-mobile/);
  assert.match(clientSmokeSource, /"s79-3-portrait-viewer-desktop"/);
  assert.match(clientSmokeSource, /assertClientVisualMatrixCoverage/);
  assert.match(clientSmokeSource, /requiredVisualMatrixScreenshotLabels/);
  assert.match(clientSmokeSource, /assertRouteRefresh\(page, archivePath/);
  assert.match(clientSmokeSource, /clickSessionNavRoute/);
  assert.match(clientSmokeSource, /clickSessionNavRoute\(page, "科举"/);
  assert.match(clientSmokeSource, /assertExamFullScreen\(page, startedSessionId/);
  assert.match(clientSmokeSource, /clickSessionNavRoute\(page, "皇榜"/);
  assert.match(clientSmokeSource, /assertRankingFullScreen\(page, startedSessionId/);
  assert.match(clientSmokeSource, /label: "朝议"/);
  assert.match(clientSmokeSource, /label: "印匣页"/);
  assert.match(clientSmokeSource, /startMockMagistrateThroughHome/);
  assert.match(clientSmokeSource, /startMockOfficialThroughHome/);
  assert.match(clientSmokeSource, /startMockMinisterThroughHome/);
  assert.match(clientSmokeSource, /roleLabel: "大臣"/);
  assert.match(clientSmokeSource, /startMockGeneralThroughHome/);
  assert.match(clientSmokeSource, /startMockEmperorThroughHome/);
  assert.match(clientSmokeSource, /desktop-minister-panel/);
  assert.match(clientSmokeSource, /unsafeClientApiPathPatterns/);
  assert.match(clientSmokeSource, /process\.env\.AI_PROVIDER = "mock"/);
  assert.match(clientSmokeSource, /previousAiProvider/);
  assert.match(appShellSource, /href\.replace\("s74-preview", currentSessionId\)/);
  assert.match(errorPageSource, /getSafeRouteErrorMessage\(error\)/);
  assert.match(errorPageSource, /getRouteSessionRecoveryHref\(location\.pathname\)/);
  assert.match(notFoundPageSource, /getRouteSessionRecoveryHref\(location\.pathname\)/);
  assert.match(routeRecoverySource, /isRunnableSessionId\(sessionId\)/);
  assert.ok(routeRecoverySource.includes("pathname.match(/^\\/game\\/([^/]+)(\\/.+)$/)"));
  assert.match(routeRecoverySource, /return `\/game\/\$\{sessionId\}`/);
  assert.doesNotMatch(routeRecoverySource, /statusText/);
  assert.doesNotMatch(clientSmokeSource, /\/legacy\.html|\/ink-client|\/api\/game\/state\/\$\{|\/api\/dev\/session-diagnostics/);
  assert.doesNotMatch(
    appShellSource,
    /localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
  assert.doesNotMatch(
    combinedRouteRecoverySource,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S77.2 client smoke covers history navigation and map resource fallback", () => {
  const clientSmokeSource = readText("scripts/clientSmoke.js");

  assert.match(clientSmokeSource, /assertHistoryBackForward/);
  assert.match(clientSmokeSource, /page\.goBack\(\)/);
  assert.match(clientSmokeSource, /page\.goForward\(\)/);
  assert.match(clientSmokeSource, /s77-history-back-map-desktop/);
  assert.match(clientSmokeSource, /s77-history-forward-people-desktop/);
  assert.match(clientSmokeSource, /assertMapResourceFailureFallback/);
  assert.match(clientSmokeSource, /fallbackPage\.route\(".*\/vendor\/pixi\.min\.js"/);
  assert.match(clientSmokeSource, /fallbackPage\.route\(".*\/mapRenderer\.js"/);
  assert.match(clientSmokeSource, /route\.abort\(\)/);
  assert.match(clientSmokeSource, /data-map-status/);
  assert.match(clientSmokeSource, /s77-map-resource-fallback-desktop/);
  assert.match(clientSmokeSource, /desktop-history-back-map/);
  assert.match(clientSmokeSource, /desktop-history-forward-people/);
  assert.match(clientSmokeSource, /desktop-map-resource-fallback/);
  assert.doesNotMatch(clientSmokeSource, /\/legacy\.html|\/ink-client|\/api\/game\/state\/\$\{|\/api\/dev\/session-diagnostics/);
});

test("S75.3 home start seal guards repeated submits and reduced motion", () => {
  const homePageSource = readText("client/src/pages/HomePage.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const combined = stripSafeGuardPatterns(`${homePageSource}\n${styleSource}`);

  assert.match(homePageSource, /usePrefersReducedMotion/);
  assert.match(homePageSource, /submitLockRef/);
  assert.match(homePageSource, /status === "loading"/);
  assert.match(homePageSource, /const startError = status === "error" \? error : null/);
  assert.match(homePageSource, /motionAllowed/);
  assert.match(homePageSource, /aria-busy=\{isStarting\}/);
  assert.match(homePageSource, /data-state=\{startError \|\| formError \? "error" : isStarting \? "loading" : "idle"\}/);
  assert.match(homePageSource, /aria-live="polite"/);
  assert.match(styleSource, /homeSealStamp/);
  assert.match(styleSource, /sealLoadingSweep/);
  assert.match(styleSource, /\.homeStartSeal[\s\S]*font-family: var\(--qq-font-serif-classic\)/);
  assert.match(styleSource, /prefers-reduced-motion: reduce/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\] \.homeStartSeal/);
  assert.doesNotMatch(
    combined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});
