const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildReactClientBuildPaths,
  shouldServeReactHistoryFallback
} = require("../server");
const { resolveClientBuildStatus } = require("../scripts/ensureClientBuild");
const { parseClientSmokeArgs } = require("../scripts/clientSmoke");

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
  assert.match(surfaceHostSource, /setDisplayPreference\("mapMotion"/);
  assert.match(appShellSource, /data-motion=\{displayPreferences\.motion\}/);
  assert.match(appShellSource, /data-shell-version="s75-9"/);
  assert.match(appShellSource, /data-text-size=\{displayPreferences\.textSize\}/);
  assert.match(appShellSource, /data-contrast=\{displayPreferences\.contrast\}/);
  assert.match(mapPageSource, /displayPreferences\.mapMotion && displayPreferences\.motion === "full"/);
  assert.match(clientSmokeSource, /assertDisplayPreferencesPersistence/);
  assert.match(clientSmokeSource, /qianqiu\.displayPreferences\.v1/);
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
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
  const componentTestSource = readText("client/src/components/MemorialComposer.test.tsx");
  const styleSource = readText("client/src/styles/global.css");
  const runtimeCombined = `${appShellSource}\n${gamePageSource}\n${composerSource}\n${stateSource}\n${surfaceHostSource}\n${styleSource}`;

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
  assert.match(surfaceHostSource, /快捷建议 Provider/);
  assert.match(surfaceHostSource, /updateAiTaskRoute\(currentSessionId, "quick_action"/);
  assert.match(surfaceHostSource, /快捷建议工具预算固定为零/);
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
  assert.match(clientSmokeSource, /快捷建议工具预算固定为零/);
  assert.match(clientSmokeSource, /\/api\/game\/player-state\/\$\{sessionId\}/);
  assert.match(clientSmokeSource, /desktop-inkbox-tabs/);
  assert.match(clientSmokeSource, /mobile-inkbox-tabs/);
  assert.match(clientSmokeSource, /aria-selected/);
});

test("S76.2 scholar panel uses safe study and exam projections as draft-only UI", () => {
  const gamePageSource = readText("client/src/pages/GamePage.tsx");
  const scholarPanelSource = readText("client/src/components/ScholarPanel.tsx");
  const appTestSource = readText("client/src/__tests__/App.test.tsx");
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
  assert.match(scholarPanelSource, /只写草稿，结果由服务器裁决/);
  assert.match(scholarPanelSource, /赶考、入场、评卷、放榜、晋级和授官都由服务器按规则裁决/);
  assert.match(styleSource, /scholarPanel/);
  assert.match(appTestSource, /renders the S76\.2 scholar panel from safe study and calendar views as draft-only actions/);
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
  assert.match(officialPanelSource, /export function OfficialMinisterPanel/);
  assert.match(officialPanelSource, /官职履历/);
  assert.match(officialPanelSource, /部院公文/);
  assert.match(officialPanelSource, /同年座师/);
  assert.match(officialPanelSource, /派系与朝局风险/);
  assert.match(officialPanelSource, /不得在前端直接任免、奖惩、处分、弹劾成案或改写考成/);
  assert.match(styleSource, /officialMinisterPanel/);
  assert.match(typeSource, /officialCareerView\?: JsonObject/);
  assert.match(typeSource, /appointmentTrackView\?: JsonObject/);
  assert.match(typeSource, /actorMemoryView\?: JsonObject/);
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
  assert.match(emperorPanelSource, /export function EmperorPanel/);
  assert.match(emperorPanelSource, /奏折队列/);
  assert.match(emperorPanelSource, /朱批拟稿/);
  assert.match(emperorPanelSource, /圣旨草稿/);
  assert.match(emperorPanelSource, /朝议/);
  assert.match(emperorPanelSource, /任免候选/);
  assert.match(emperorPanelSource, /赏罚预留/);
  assert.match(emperorPanelSource, /任免、赏罚、处分、朱批成案、圣旨生效、时间推进和持久化都由服务器裁决/);
  assert.match(styleSource, /emperorPanel/);
  assert.match(typeSource, /worldEntityView\?: JsonObject/);
  assert.match(typeSource, /worldThreadView\?: JsonObject/);
  assert.match(appTestSource, /renders the S76\.6 emperor panel from safe court views as draft-only edicts/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|\/api\/exam\/question|\/api\/exam\/submit|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
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
  assert.match(examPageSource, /贡院号舍/);
  assert.match(examPageSource, /examStageRail/);
  assert.match(examPageSource, /examImmersiveLayout/);
  assert.match(examPageSource, /examQuestionText/);
  assert.match(examPageSource, /写作区字数与草稿状态/);
  assert.match(examPageSource, /虚拟考生、阅卷官与榜单只显示安全占位/);
  assert.match(examPageSource, /交卷、评分、舞弊、放榜、晋级和授官都由服务器裁决/);
  assert.match(examPageSource, /requestExamQuestion\(sessionId, level\)/);
  assert.match(examPageSource, /progressExam\(sessionId, examId, sceneAction\.trim\(\)\)/);
  assert.match(examPageSource, /submitExam\(sessionId, examId, essay\.trim\(\)\)/);
  assert.match(styleSource, /examFullScreen/);
  assert.match(styleSource, /examHero/);
  assert.match(styleSource, /examSealSubmitButton/);
  assert.match(apiTypesSource, /examProcedureView\?: JsonObject/);
  assert.match(apiTypesSource, /examinerPanelView\?: JsonObject/);
  assert.match(apiTypesSource, /examRivalView\?: JsonObject/);
  assert.match(apiTypesSource, /examHonorView\?: JsonObject/);
  assert.match(clientSmokeSource, /assertExamFullScreen/);
  assert.doesNotMatch(
    runtimeCombined,
    /\/api\/game\/state|\/api\/dev\/session-diagnostics|dangerouslySetInnerHTML|localStorage|sessionStorage|data\/sessions|raw audit|provider payload|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
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
  assert.doesNotMatch(rankingPageSource, /buildHonorFallbackRows|index \+ 1/);
  assert.match(rankingPageSource, /rankingTopThree/);
  assert.match(rankingPageSource, /服务器定榜名单/);
  assert.match(rankingPageSource, /暂无公开防弊复核结果/);
  assert.match(rankingPageSource, /本榜只录服务器定榜结果/);
  assert.match(rankingPageSource, /前端不改名次、不补评分、不推断授官/);
  assert.match(styleSource, /rankingFullScreen/);
  assert.match(styleSource, /rankingTopThree/);
  assert.match(styleSource, /rankingDetailPanel/);
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

  assert.match(assetRegistrySource, /ASSET_MANIFEST_URL = "\/assets\/ui\/ink-ui-manifest\.json"/);
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
