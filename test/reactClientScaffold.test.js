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
  getResourceBudgetFailures,
  getResourceBudgetSnapshot,
  getPlayerFacingCopyLeakFailures,
  getSafetyPollutionFailures,
  getTextOverlapFailures,
  getTextOverflowFailures,
  parseClientSmokeArgs
} = require("../scripts/clientSmoke");
const {
  buildRuntimeManifest,
  checkRuntimeManifest,
  runtimeManifestPath,
  sourceManifestPath
} = require("../scripts/frontendRuntimeManifest");

const rootDir = path.join(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function stripSafeGuardPatterns(source) {
  return source
    .replace(/const unsafeHomeSummaryPattern = .*?;\r?\n/, "")
    .replace(/const unsafeSaveTextPattern = .*?;\r?\n/, "")
    .replace(/const unsafePreferenceTextPattern = .*?;\r?\n/, "")
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
  assert.match(styleSource, /prefers-reduced-motion: reduce/);
  assert.match(rankingPageSource, /showGoldenNotice/);
  assert.match(rankingPageSource, /金榜题名/);
  assert.match(clientSmokeSource, /getTextOverflowFailures/);
  assert.match(clientSmokeSource, /assertNoVisibleTextOverflow/);
  assert.match(clientSmokeSource, /assertBrowserLevelReducedMotion/);
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
  assert.match(uiStateSource, /displayPreferences/);
  assert.match(uiStateSource, /extractSafePlayerPayload/);
  assert.match(gamePageSource, /clearActionDraft/);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/);
});

test("S74.4 shell uses registry-backed overlays without widening data sources", () => {
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const surfaceHostSource = readText("client/src/components/SurfaceHost.tsx");
  const surfaceRegistrySource = readText("client/src/surfaces/surfaceRegistry.tsx");
  const routeCatalogSource = readText("client/src/routes/routeCatalog.ts");
  const combined = `${appShellSource}\n${surfaceHostSource}\n${surfaceRegistrySource}\n${routeCatalogSource}`;

  assert.match(appShellSource, /data-shell-version="s75-9"/);
  assert.match(appShellSource, /resolvePrimaryHref/);
  assert.match(appShellSource, /isRunnableSessionId/);
  assert.match(appShellSource, /ScrollRestoration/);
  assert.match(appShellSource, /window\.scrollTo/);
  assert.match(surfaceHostSource, /drawerRegistry/);
  assert.match(surfaceHostSource, /modalRegistry/);
  assert.match(surfaceHostSource, /surfaceRegistry/);
  assert.match(surfaceHostSource, /event\.key !== "Escape"/);
  assert.match(surfaceHostSource, /focusReturnTargetsRef/);
  assert.match(surfaceHostSource, /returningFromPortrait/);
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
  assert.match(surfaceHostSource, /AI 设置/);
  assert.match(surfaceHostSource, /旧案/);
  assert.match(surfaceHostSource, /显示/);
  assert.match(surfaceHostSource, /安全/);
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
  const apiTypesSource = readText("client/src/api/types.ts");
  const styleSource = readText("client/src/styles/global.css");
  const combined = `${homePageSource}\n${surfaceHostSource}\n${saveCaseSource}\n${apiTypesSource}\n${styleSource}`;
  const runtimeSourcesWithoutSanitizerPattern = stripSafeGuardPatterns(`${homePageSource}\n${surfaceHostSource}\n${apiTypesSource}\n${styleSource}`);

  assert.match(homePageSource, /<SaveCaseList saves=\{saves\} maxItems=\{5\}/);
  assert.match(surfaceHostSource, /<SaveCaseList saves=\{saves\} maxItems=\{6\}/);
  assert.match(surfaceHostSource, /loadSession\(sessionId\)/);
  assert.match(saveCaseSource, /getSaveShortCode/);
  assert.match(saveCaseSource, /getSaveDateLabel/);
  assert.match(saveCaseSource, /getSaveTurnLabel/);
  assert.match(saveCaseSource, /getSaveUpdatedLabel/);
  assert.match(saveCaseSource, /unsafeSaveTextPattern/);
  assert.match(saveCaseSource, /safeTextOrFallback/);
  assert.match(saveCaseSource, /此卷暂无公开摘要/);
  assert.match(apiTypesSource, /readonly turnCount\?: number/);
  assert.match(apiTypesSource, /readonly summary\?: string \| null/);
  assert.match(styleSource, /saveCaseItem/);
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
  const mapPageSource = readText("client/src/pages/MapPage.tsx");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const appTestSource = readText("client/src/state/uiState.test.ts");
  const combined = `${storageSource}\n${uiStateSource}\n${surfaceHostSource}\n${appShellSource}\n${mapPageSource}\n${appTestSource}\n${clientSmokeSource}`;
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
  assert.match(mapPageSource, /displayPreferences\.mapMotion && displayPreferences\.motion === "full"/);
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
  assert.match(gamePageSource, /currentPlayerPayload\?\.routeViews/);
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
  assert.match(quickActionSource, /sourceLabel: "local-rule"/);
  assert.match(quickActionSource, /normalizeAiSuggestions/);
  assert.match(quickActionSource, /quickActionStatus === "error" \? "failed"/);
  assert.match(surfaceHostSource, /<AiSettingsPanel \/>/);
  assert.match(aiSettingsPanelSource, /服务端全局/);
  assert.match(aiSettingsPanelSource, /updateGlobalAiSettings\(formSnapshot\(form\)\)/);
  assert.match(aiSettingsPanelSource, /taskType: stringValue\(record\.taskType/);
  assert.match(aiSettingsPanelSource, /\$\{route\.label\}工具预算/);
  assert.match(quickActionSource, /getMemorialPlaceholder/);
  assert.match(quickActionSource, /buildQuickActionSuggestions/);
  assert.match(styleSource, /memorialComposer/);
  assert.match(styleSource, /quickActionDock/);
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
  assert.match(clientSmokeSource, /快捷建议工具预算/);
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
  assert.match(gamePageSource, /studyProfileView=\{session\?\.studyProfileView/);
  assert.match(gamePageSource, /examCalendarView=\{session\?\.examCalendarView/);
  assert.match(gamePageSource, /category: "role_background", usage: "game_main", role: knownRole/);
  assert.match(scholarPanelSource, /export function ScholarPanel/);
  assert.match(scholarPanelSource, /studyProfileView/);
  assert.match(scholarPanelSource, /examCalendarView/);
  assert.match(scholarPanelSource, /dailyRhythm/);
  assert.match(scholarPanelSource, /scholarPlanTimeline/);
  assert.match(scholarPanelSource, /执行首课/);
  assert.match(scholarPanelSource, /只写草稿，结果由服务器裁决/);
  assert.match(scholarPanelSource, /赶考、入场、评卷、放榜、晋级和授官都由服务器按规则裁决/);
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
  assert.match(gamePageSource, /localAffairsDocketView=\{session\?\.localAffairsDocketView/);
  assert.match(gamePageSource, /officialPostingsView=\{session\?\.officialPostingsView/);
  assert.match(gamePageSource, /economicFiscalView=\{session\?\.economicFiscalView/);
  assert.match(magistratePanelSource, /export function MagistratePanel/);
  assert.match(magistratePanelSource, /localAffairsDocketView/);
  assert.match(magistratePanelSource, /officialPostingsView/);
  assert.match(magistratePanelSource, /economicFiscalView/);
  assert.match(magistratePanelSource, /只写草稿，结果由服务器裁决/);
  assert.match(magistratePanelSource, /审案、征税、开仓、水利、缉捕、任免、考成和持久化都由服务器裁决/);
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
  assert.match(gamePageSource, /officialCareerView=\{session\?\.officialCareerView/);
  assert.match(gamePageSource, /appointmentTrackView=\{session\?\.appointmentTrackView/);
  assert.match(gamePageSource, /actorMemoryView=\{session\?\.actorMemoryView/);
  assert.match(gamePageSource, /aiControlAuditView=\{session\?\.aiControlAuditView/);
  assert.match(gamePageSource, /playerMonthlyBriefingView=\{session\?\.playerMonthlyBriefingView/);
  assert.match(gamePageSource, /courtConsequenceView=\{session\?\.courtConsequenceView/);
  assert.match(gamePageSource, /courtResponseView=\{session\?\.courtResponseView/);
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
  assert.match(gamePageSource, /militaryDiplomacyView=\{session\?\.militaryDiplomacyView/);
  assert.match(gamePageSource, /mapRuntimeView=\{session\?\.mapRuntimeView/);
  assert.match(gamePageSource, /eventArchiveView=\{session\?\.eventArchiveView/);
  assert.match(gamePageSource, /actorMemoryView=\{session\?\.actorMemoryView/);
  assert.match(generalPanelSource, /export function GeneralPanel/);
  assert.match(generalPanelSource, /军帐总览/);
  assert.match(generalPanelSource, /粮饷与军心/);
  assert.match(generalPanelSource, /斥候与情报/);
  assert.match(generalPanelSource, /边患与舆图/);
  assert.match(generalPanelSource, /战报与边议/);
  assert.match(generalPanelSource, /战役胜负、调兵遣将、外交和战、统帅任免、粮饷拨付、赏罚与持久化都由服务器裁决/);
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
  assert.match(gamePageSource, /officialPostingsView=\{session\?\.officialPostingsView/);
  assert.match(gamePageSource, /eventArchiveView=\{session\?\.eventArchiveView/);
  assert.match(gamePageSource, /actorMemoryView=\{session\?\.actorMemoryView/);
  assert.match(gamePageSource, /aiControlAuditView=\{session\?\.aiControlAuditView/);
  assert.match(gamePageSource, /worldEntityView=\{session\?\.worldEntityView/);
  assert.match(gamePageSource, /worldThreadView=\{session\?\.worldThreadView/);
  assert.match(gamePageSource, /courtConsequenceView=\{session\?\.courtConsequenceView/);
  assert.match(gamePageSource, /courtResponseView=\{session\?\.courtResponseView/);
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
  assert.match(emperorPanelSource, /任免、赏罚、处分、朱批成案、圣旨生效、时间推进和持久化都由服务器裁决/);
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

  assert.match(gamePageSource, /roleCycleView=\{session\?\.roleCycleView \?\? null\}/);
  assert.match(gamePageSource, /hasRoleCycleView/);
  for (const source of [scholarPanelSource, magistratePanelSource, officialPanelSource, generalPanelSource, emperorPanelSource]) {
    assert.match(source, /import \{ RoleCycleSection \}/);
    assert.match(source, /readonly roleCycleView\?: JsonObject \| null/);
    assert.match(source, /<RoleCycleSection/);
    assert.match(source, /source: "role-surface", targetPage: "game"|onDraft=\{onDraft\}/);
  }
  assert.match(roleCycleSource, /本旬身份循环/);
  assert.match(roleCycleSource, /本旬事务/);
  assert.match(roleCycleSource, /风险/);
  assert.match(roleCycleSource, /aria-label="可拟草稿"/);
  assert.match(roleCycleSource, /onClick=\{\(\) => onDraft\(action\.text\)\}/);
  assert.match(typeSource, /export type RoleCycleView/);
  assert.match(typeSource, /roleCycleView\?: RoleCycleView/);
  assert.match(stateSource, /hasRoleCycleView: Boolean\(payload\.roleCycleView\)/);
  assert.match(styleSource, /roleCycleSection/);
  assert.match(styleSource, /roleCycleMetrics/);
  assert.match(styleSource, /roleCycleColumns/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
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
  assert.match(examPageSource, /虚拟考生、阅卷官与榜单只显示安全占位/);
  assert.match(examPageSource, /入场后反馈/);
  assert.match(examPageSource, /phaseFeedback/);
  assert.match(examPageSource, /setActionDraft/);
  assert.match(examPageSource, /source: "exam", targetPage: "game"/);
  assert.match(examPageSource, /交卷、评分、舞弊、放榜、晋级和授官都由服务器裁决/);
  assert.match(examPageSource, /requestExamQuestion\(sessionId, level\)/);
  assert.match(examPageSource, /progressExam\(sessionId, examId, sceneAction\.trim\(\)\)/);
  assert.match(examPageSource, /submitExam\(sessionId, examId, essay\.trim\(\)\)/);
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

  assert.match(gamePageSource, /independentSessionRouteIds/);
  assert.match(gamePageSource, /"exam", "ranking", "court", "settings"/);
  assert.match(gamePageSource, /sessionRouteShell/);
  assert.match(gamePageSource, /SessionRouteNav/);
  assert.match(styleSource, /sessionRouteShell/);
  assert.match(clientSmokeSource, /assertIndependentSessionRouteShell/);
  assert.match(clientSmokeSource, /rendered bottom memorial composer/);
  assert.match(appTestSource, /document\.querySelector\("\.gameCommandBar"\)\)\.toBeFalsy/);
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
  assert.doesNotMatch(rankingPageSource, /buildHonorFallbackRows|index \+ 1/);
  assert.match(rankingPageSource, /rankingTopThree/);
  assert.match(rankingPageSource, /服务器定榜名单/);
  assert.match(rankingPageSource, /暂无公开防弊复核结果/);
  assert.match(rankingPageSource, /本榜只录服务器定榜结果/);
  assert.match(rankingPageSource, /前端不改名次、不补评分、不推断授官/);
  assert.match(styleSource, /rankingFullScreen/);
  assert.match(styleSource, /rankingTopThree/);
  assert.match(styleSource, /rankingDetailPanel/);
  assert.match(styleSource, /rankingActionRow/);
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
  assert.match(assetRegistrySource, /lowResPlaceholderPath/);
  assert.match(assetRegistrySource, /getPreloadHints/);
  assert.match(assetRegistrySource, /kept_outside_public_manifest/);
  assert.match(peoplePageSource, /worldPeopleView/);
  assert.match(peoplePageSource, /getExistingPortraitRef/);
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
  const styleSource = readText("client/src/styles/global.css");
  const runtimeCombined = stripSafeGuardPatterns(`${uiStateSource}\n${portraitSource}\n${surfaceHostSource}\n${styleSource}`);

  assert.match(uiStateSource, /activePortraitViewer/);
  assert.match(uiStateSource, /openPortraitViewer/);
  assert.match(uiStateSource, /closePortraitViewer/);
  assert.match(portraitSource, /portraitZoomButton/);
  assert.match(portraitSource, /Maximize2/);
  assert.match(portraitSource, /markOverlayTrigger/);
  assert.match(surfaceHostSource, /PortraitViewerHost/);
  assert.match(surfaceHostSource, /registry\.getPortrait\(viewer\.portraitRef\)/);
  assert.match(surfaceHostSource, /portrait\?\.path/);
  assert.match(surfaceHostSource, /data-portrait-viewer="true"/);
  assert.match(surfaceHostSource, /NpcProfilePortraitStrip/);
  assert.match(surfaceHostSource, /safeSurfacePortraitRef/);
  assert.match(styleSource, /portraitViewerPanel/);
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
  assert.match(bridgeSource, /map-runtime/);
  assert.match(mapPageSource, /currentSession\?\.sessionId === sessionId/);
  assert.match(apiTypesSource, /export type MapRuntimeView/);
  assert.match(mapRendererSource, /motionEnabled/);
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
  assert.match(mapPageSource, /入局势簿/);
  assert.match(mapPageSource, /据此拟稿/);
  assert.match(mapPageSource, /显示坐标只用于浏览器布局/);
  assert.match(bridgeSource, /filterMapRuntimeView/);
  assert.match(bridgeSource, /visibleLayers\.places/);
  assert.match(bridgeSource, /safeMapRuntimeText/);
  assert.match(styleSource, /\.mapImmersiveLayout/);
  assert.match(styleSource, /\.mapSituationLedger/);
  assert.match(styleSource, /\.inkMapTooltipClose/);
  assert.match(clientSmokeSource, /s74-react-map-runtime-desktop/);
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
  assert.match(surfaceHostSource, /requestTopicDraft\(currentSessionId/);
  assert.match(surfaceHostSource, /AI 拟稿/);
  assert.match(surfaceHostSource, /写入底部奏折/);
  assert.match(styleSource, /topicSurfaceLayout/);
  assert.match(styleSource, /topicDraftTextarea/);
  assert.match(courtPageSource, /courtSurfaceGroups/);
  assert.match(courtPageSource, /"memorial-review", "edict-draft", "court-debate"/);
  assert.match(courtPageSource, /"trial", "war-council"/);
  assert.match(courtPageSource, /"npc-profile"/);
  assert.match(courtPageSource, /openSurface\(surface\)/);
  assert.match(appTestSource, /奏折队列", "拟圣旨", "朝议", "堂审", "军议", "人物档案"/);
  assert.match(appTestSource, /AI 拟稿/);

  assert.doesNotMatch(
    runtimeCombined,
    /dangerouslySetInnerHTML|\/api\/game\/state|\/api\/dev\/session-diagnostics|submitTurn\(|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S74.7 client smoke verifies default UI start and safe route recovery", () => {
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const appShellSource = readText("client/src/components/AppShell.tsx");

  assert.match(clientSmokeSource, /startMockGameThroughHome/);
  assert.match(clientSmokeSource, /getByLabel\("姓名"\)/);
  assert.match(clientSmokeSource, /getByRole\("button", \{ name: "新开一卷" \}\)/);
  assert.match(clientSmokeSource, /clickTopNavRoute\(page, "舆图"/);
  assert.match(clientSmokeSource, /assertRouteRefresh\(page, runtimeMapPath/);
  assert.match(clientSmokeSource, /assertRouteRefresh\(page, peoplePath/);
  assert.match(clientSmokeSource, /assertRouteRefresh\(page, archivePath/);
  assert.match(clientSmokeSource, /clickSessionNavRoute/);
  assert.match(clientSmokeSource, /clickSessionNavRoute\(page, "科举"/);
  assert.match(clientSmokeSource, /assertExamFullScreen\(page, startedSessionId/);
  assert.match(clientSmokeSource, /clickSessionNavRoute\(page, "皇榜"/);
  assert.match(clientSmokeSource, /assertRankingFullScreen\(page, startedSessionId/);
  assert.match(clientSmokeSource, /label: "朝议"/);
  assert.match(clientSmokeSource, /label: "印匣"/);
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
  assert.doesNotMatch(clientSmokeSource, /\/legacy\.html|\/ink-client|\/api\/game\/state\/\$\{|\/api\/dev\/session-diagnostics/);
  assert.doesNotMatch(
    appShellSource,
    /localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
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
  assert.match(homePageSource, /motionAllowed/);
  assert.match(homePageSource, /aria-busy=\{isStarting\}/);
  assert.match(homePageSource, /data-state=\{error \|\| formError \? "error" : isStarting \? "loading" : "idle"\}/);
  assert.match(homePageSource, /aria-live="polite"/);
  assert.match(styleSource, /homeSealStamp/);
  assert.match(styleSource, /sealLoadingSweep/);
  assert.match(styleSource, /prefers-reduced-motion: reduce/);
  assert.match(styleSource, /\.appShell\[data-motion="reduced"\] \.homeStartSeal/);
  assert.doesNotMatch(
    combined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});
