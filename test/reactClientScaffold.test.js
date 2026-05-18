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

  assert.match(appShellSource, /data-shell-version="s74-5"/);
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
