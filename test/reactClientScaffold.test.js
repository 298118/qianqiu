const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildReactClientBuildPaths,
  shouldServeReactHistoryFallback
} = require("../server");
const { parseClientSmokeArgs } = require("../scripts/clientSmoke");

const rootDir = path.join(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function stripSafeGuardPatterns(source) {
  return source
    .replace(/const unsafeHomeSummaryPattern = .*?;\r?\n/, "")
    .replace(/const unsafeSaveTextPattern = .*?;\r?\n/, "")
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

  assert.equal(packageJson.scripts["dev:client"], "vite --config vite.config.mjs");
  assert.equal(packageJson.scripts["build:client"], "vite build --config vite.config.mjs");
  assert.equal(packageJson.scripts["typecheck:client"], "tsc --project tsconfig.client.json --noEmit");
  assert.equal(packageJson.scripts["test:client"], "vitest --config vitest.config.mjs run");
  assert.equal(packageJson.scripts["preview:client"], "vite preview --config vite.config.mjs");
  assert.equal(packageJson.scripts["smoke:browser"], "npm run build:client && node scripts/clientSmoke.js");
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
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: "/" })), true);
  assert.equal(shouldServeReactHistoryFallback(mockRequest({ requestPath: "/game/session-1/map" })), true);
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
  assert.throws(() => parseClientSmokeArgs(["node", "scripts/clientSmoke.js", "--bad"]), /Unknown client smoke/);
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

  assert.match(appShellSource, /data-shell-version="s75-6"/);
  assert.match(appShellSource, /resolvePrimaryHref/);
  assert.match(appShellSource, /isRunnableSessionId/);
  assert.match(appShellSource, /ScrollRestoration/);
  assert.match(appShellSource, /window\.scrollTo/);
  assert.match(surfaceHostSource, /drawerRegistry/);
  assert.match(surfaceHostSource, /modalRegistry/);
  assert.match(surfaceHostSource, /surfaceRegistry/);
  assert.match(surfaceHostSource, /event\.key !== "Escape"/);
  assert.match(surfaceHostSource, /previousFocusRef/);
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
  assert.doesNotMatch(combined, /localStorage|sessionStorage/);
});

test("S75.6 return home keeps the current session and exposes a safe continue entry", () => {
  const appShellSource = readText("client/src/components/AppShell.tsx");
  const homePageSource = readText("client/src/pages/HomePage.tsx");
  const uiStateSource = readText("client/src/state/uiState.ts");
  const clientSmokeSource = readText("scripts/clientSmoke.js");
  const styleSource = readText("client/src/styles/global.css");
  const combined = `${appShellSource}\n${homePageSource}\n${uiStateSource}\n${clientSmokeSource}\n${styleSource}`;
  const runtimeSourcesWithoutSanitizerPattern = stripSafeGuardPatterns(`${appShellSource}\n${uiStateSource}\n${styleSource}`);

  assert.match(appShellSource, /data-shell-version="s75-6"/);
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
  assert.doesNotMatch(combined, /localStorage|sessionStorage/);
});

test("S74.5 asset registry gates manifest assets before React components render portraits", () => {
  const assetRegistrySource = readText("client/src/assets/assetRegistry.ts");
  const portraitSource = readText("client/src/components/Portrait.tsx");
  const peoplePageSource = readText("client/src/pages/PeoplePage.tsx");
  const combined = `${assetRegistrySource}\n${portraitSource}\n${peoplePageSource}`;

  assert.match(assetRegistrySource, /ASSET_MANIFEST_URL = "\/assets\/ui\/ink-ui-manifest\.json"/);
  assert.match(assetRegistrySource, /runtimeUsableReviewStatuses/);
  assert.match(assetRegistrySource, /reviewStatus/);
  assert.match(assetRegistrySource, /allowEagerLoad !== false/);
  assert.match(assetRegistrySource, /lowResPlaceholderPath/);
  assert.match(assetRegistrySource, /getPreloadHints/);
  assert.match(assetRegistrySource, /kept_outside_public_manifest/);
  assert.match(peoplePageSource, /getPortraits\(\{ usage: "people_page", preferHighResOverridesForFeminine: true \}\)/);
  assert.match(peoplePageSource, /portraitPageSize = 8/);
  assert.match(portraitSource, /loading="lazy"/);
  assert.doesNotMatch(portraitSource, /variant\?:|priority\?:|loading=\{priority/);
  assert.doesNotMatch(
    combined,
    /portrait-pool-matrix-v1|public\/assets\/ui\/portraits|localStorage|sessionStorage|data\/sessions|raw audit|provider payload/
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
  assert.match(clientSmokeSource, /label: "科举"/);
  assert.match(clientSmokeSource, /label: "皇榜"/);
  assert.match(clientSmokeSource, /label: "朝议"/);
  assert.match(clientSmokeSource, /label: "印匣"/);
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
