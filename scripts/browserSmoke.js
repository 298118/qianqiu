const fs = require("node:fs");
const fsp = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require("playwright-core");

const rootDir = path.join(__dirname, "..");
const sessionIdPattern = /^[0-9a-fA-F-]{20,}$/;
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const minimumScreenshotBytes = 1200;

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 }
};
const desktopLayoutBreakpoint = 820;
const desktopGameMinAppShare = 0.86;
const desktopGameMinViewportShare = 0.74;
const desktopViewportShareOnlyWhenAppShare = 0.88;
const horizontalClipTolerance = 4;

function parseBrowserSmokeArgs(argv = process.argv) {
  const args = {
    browserPath: null,
    headed: false,
    help: false,
    screenshotsDir: null,
    url: null
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--headed") {
      args.headed = true;
    } else if (arg === "--url") {
      args.url = normalizeBaseUrl(readArgValue(argv, index, "--url"));
      index += 1;
    } else if (arg === "--browser") {
      args.browserPath = readArgValue(argv, index, "--browser");
      index += 1;
    } else if (arg === "--screenshots") {
      args.screenshotsDir = readArgValue(argv, index, "--screenshots");
      index += 1;
    } else {
      throw new Error(`Unknown browser smoke argument: ${arg}`);
    }
  }

  return args;
}

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function getDefaultBrowserCandidates(platform = process.platform, env = process.env) {
  if (platform === "win32") {
    return [
      path.join(env.ProgramFiles || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
      path.join(env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(env.ProgramFiles || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe")
    ];
  }

  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ];
  }

  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge"
  ];
}

function resolveBrowserExecutable(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const exists = options.exists || fs.existsSync;
  const explicitPath = options.browserPath || env.BROWSER_EXECUTABLE_PATH;

  if (explicitPath) {
    if (exists(explicitPath)) return explicitPath;
    throw new Error(`Browser executable not found: ${explicitPath}`);
  }

  const candidate = getDefaultBrowserCandidates(platform, env).find((candidatePath) => exists(candidatePath));
  if (candidate) return candidate;

  throw new Error(
    "No Chrome/Edge executable found. Install Chrome or Edge, set BROWSER_EXECUTABLE_PATH, or pass --browser <path>."
  );
}

async function getOpenPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function startLocalServer() {
  const port = await getOpenPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: {
      ...process.env,
      AI_PROVIDER: "mock",
      PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  await waitForHealth(baseUrl, child, () => output);

  return {
    baseUrl,
    stop: () => stopChild(child)
  };
}

async function waitForHealth(baseUrl, child, getOutput, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Local server exited before health check passed.\n${getOutput()}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }

    await delay(200);
  }

  throw new Error(`Timed out waiting for ${baseUrl}/api/health${lastError ? `: ${lastError.message}` : ""}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  let timeoutId = null;
  try {
    const timeout = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        resolve();
      }, 3000);
      if (typeof timeoutId.unref === "function") timeoutId.unref();
    });
    await Promise.race([once(child, "exit"), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function failUiAcceptance(message) {
  throw new Error(`UI acceptance failed: ${message}`);
}

function sanitizeScreenshotName(name) {
  return String(name || "screenshot")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "screenshot";
}

function resolveScreenshotDir(screenshotsDir) {
  if (!screenshotsDir) return null;
  return path.isAbsolute(screenshotsDir) ? screenshotsDir : path.join(rootDir, screenshotsDir);
}

function assertPngScreenshot(buffer, name = "screenshot") {
  if (!Buffer.isBuffer(buffer)) {
    failUiAcceptance(`${name} did not produce a screenshot buffer.`);
  }

  if (buffer.length < minimumScreenshotBytes) {
    failUiAcceptance(`${name} screenshot is unexpectedly small (${buffer.length} bytes).`);
  }

  for (let index = 0; index < pngSignature.length; index += 1) {
    if (buffer[index] !== pngSignature[index]) {
      failUiAcceptance(`${name} screenshot is not a PNG image.`);
    }
  }
}

function createScreenshotRecorder(screenshotsDir) {
  const outputDir = resolveScreenshotDir(screenshotsDir);
  const captures = [];

  return {
    async capture(page, name) {
      const buffer = await page.screenshot({ animations: "disabled", fullPage: false });
      assertPngScreenshot(buffer, name);

      let filePath = null;
      if (outputDir) {
        await fsp.mkdir(outputDir, { recursive: true });
        filePath = path.join(
          outputDir,
          `${String(captures.length + 1).padStart(2, "0")}-${sanitizeScreenshotName(name)}.png`
        );
        await fsp.writeFile(filePath, buffer);
      }

      captures.push({ name, bytes: buffer.length, filePath });
    },
    summary() {
      return captures.slice();
    }
  };
}

function rectsOverlap(first, second, tolerance = 0) {
  return !(
    first.x + first.width <= second.x + tolerance ||
    second.x + second.width <= first.x + tolerance ||
    first.y + first.height <= second.y + tolerance ||
    second.y + second.height <= first.y + tolerance
  );
}

function rectWithinViewport(rect, viewport, tolerance = 2) {
  return (
    rect.x >= -tolerance &&
    rect.y >= -tolerance &&
    rect.x + rect.width <= viewport.width + tolerance &&
    rect.y + rect.height <= viewport.height + tolerance
  );
}

async function visibleBox(page, selector, label) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 10000 });
  const box = await locator.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) {
    failUiAcceptance(`${label} is visible but has no measurable layout box.`);
  }
  return box;
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  const scrollWidth = Math.max(metrics.bodyScrollWidth, metrics.documentScrollWidth);
  if (scrollWidth > metrics.clientWidth + 4 || scrollWidth > metrics.innerWidth + 4) {
    failUiAcceptance(`${label} has horizontal page overflow (${scrollWidth}px > ${metrics.clientWidth}px).`);
  }
}

function roundMetric(value) {
  return Math.round(Number(value) || 0);
}

function getGameLayoutFailures(metrics, mode = "game") {
  const failures = [];
  if (!metrics) return [`${mode} layout metrics were not collected.`];

  const isDesktop =
    metrics.viewportWidth > desktopLayoutBreakpoint &&
    metrics.clientWidth > desktopLayoutBreakpoint;
  const appWidth = Number(metrics.appWidth) || 0;
  const gameWidth = Number(metrics.gameWidth) || 0;
  const viewportWidth = Number(metrics.viewportWidth) || 0;

  if (isDesktop) {
    const appShare = appWidth > 0 ? gameWidth / appWidth : 0;
    const viewportShare = viewportWidth > 0 ? gameWidth / viewportWidth : 0;
    const appUsesViewport = viewportWidth > 0 && appWidth / viewportWidth >= desktopViewportShareOnlyWhenAppShare;

    if (appShare < desktopGameMinAppShare) {
      failures.push(
        `${mode} game panel is too narrow (${roundMetric(gameWidth)}px, ${Math.round(appShare * 100)}% of app shell ${roundMetric(appWidth)}px).`
      );
    }
    if (appUsesViewport && viewportShare < desktopGameMinViewportShare) {
      failures.push(
        `${mode} game panel is too narrow for the desktop viewport (${roundMetric(gameWidth)}px, ${Math.round(viewportShare * 100)}% of viewport ${roundMetric(viewportWidth)}px).`
      );
    }
  }

  if (metrics.gameScrollWidth > metrics.gameClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} game panel clips horizontal content (${roundMetric(metrics.gameScrollWidth)}px scroll width > ${roundMetric(metrics.gameClientWidth)}px client width).`
    );
  }

  if (metrics.scholarScrollWidth > metrics.scholarClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} role panel has horizontal scroll overflow (${roundMetric(metrics.scholarScrollWidth)}px > ${roundMetric(metrics.scholarClientWidth)}px).`
    );
  }

  if (metrics.scholarLeft < metrics.gameLeft - horizontalClipTolerance) {
    failures.push(`${mode} role panel starts outside the game panel.`);
  }
  if (metrics.scholarRight > metrics.gameRight + horizontalClipTolerance) {
    failures.push(`${mode} role panel extends outside the game panel.`);
  }

  return failures;
}

async function readGameLayoutMetrics(page) {
  return page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        scrollWidth: element.scrollWidth,
        width: rect.width
      };
    };
    const app = box(".app-shell");
    const game = box(".game-panel");
    const scholar = box("#scholar-panel");

    return {
      appWidth: app?.width || 0,
      clientWidth: document.documentElement.clientWidth,
      gameClientWidth: game?.clientWidth || 0,
      gameLeft: game?.left || 0,
      gameRight: game?.right || 0,
      gameScrollWidth: game?.scrollWidth || 0,
      gameWidth: game?.width || 0,
      scholarClientWidth: scholar?.clientWidth || 0,
      scholarLeft: scholar?.left || 0,
      scholarRight: scholar?.right || 0,
      scholarScrollWidth: scholar?.scrollWidth || 0,
      scholarWidth: scholar?.width || 0,
      viewportWidth: window.innerWidth
    };
  });
}

async function assertGameLayout(page, mode) {
  await assertNoHorizontalOverflow(page, `${mode} game layout`);

  const viewport = page.viewportSize();
  const status = await visibleBox(page, "#status-strip", `${mode} status strip`);
  const scholar = await visibleBox(page, "#scholar-panel", `${mode} role panel`);
  const narrativeBox = await visibleBox(page, "#narrative", `${mode} narrative`);
  const actionArea = await visibleBox(page, "#action-area", `${mode} action area`);
  const actionInput = await visibleBox(page, "#action-input", `${mode} action input`);
  const actionButton = await visibleBox(page, "#action-btn", `${mode} action button`);

  if (!rectWithinViewport(actionArea, viewport, mode === "mobile" ? 3 : 12)) {
    failUiAcceptance(`${mode} action area does not fit inside the viewport.`);
  }
  if (rectsOverlap(status, scholar)) {
    failUiAcceptance(`${mode} status strip overlaps the role panel.`);
  }
  if (rectsOverlap(scholar, narrativeBox)) {
    failUiAcceptance(`${mode} role panel overlaps the narrative area.`);
  }
  if (rectsOverlap(narrativeBox, actionArea)) {
    failUiAcceptance(`${mode} narrative area overlaps the action surface.`);
  }
  if (rectsOverlap(actionInput, actionButton)) {
    failUiAcceptance(`${mode} action textarea overlaps the action button.`);
  }

  const computed = await page.evaluate(() => {
    const action = getComputedStyle(document.querySelector("#action-area"));
    const start = getComputedStyle(document.querySelector(".start-panel"));
    return {
      actionDisplay: action.display,
      actionFlexDirection: action.flexDirection,
      actionPosition: action.position,
      startDisplay: start.display
    };
  });

  if (computed.startDisplay !== "none") {
    failUiAcceptance(`${mode} start panel is still occupying the game view.`);
  }
  if (computed.actionDisplay !== "flex") {
    failUiAcceptance(`${mode} action area is not using the expected flex layout.`);
  }

  const gameLayoutFailures = getGameLayoutFailures(await readGameLayoutMetrics(page), mode);
  if (gameLayoutFailures.length) {
    failUiAcceptance(gameLayoutFailures.join(" "));
  }

  if (mode === "mobile") {
    if (computed.actionFlexDirection !== "column") {
      failUiAcceptance("mobile action controls should stack vertically.");
    }
    if (computed.actionPosition !== "sticky") {
      failUiAcceptance("mobile action area should remain sticky at the bottom.");
    }
    if (actionButton.y < actionInput.y + actionInput.height - 2) {
      failUiAcceptance("mobile action button should sit below the textarea.");
    }
  } else if (actionButton.x < actionInput.x + actionInput.width - 2) {
    failUiAcceptance("desktop action button should sit beside the textarea.");
  }
}

async function assertExamWritingLayout(page, mode) {
  await assertNoHorizontalOverflow(page, `${mode} exam writing modal`);

  const viewport = page.viewportSize();
  const modal = await visibleBox(page, ".exam-modal", `${mode} exam modal`);
  const question = await visibleBox(page, "#exam-question", `${mode} exam question`);
  const requirements = await visibleBox(page, "#exam-requirements", `${mode} exam requirements`);
  const tools = await visibleBox(page, "#exam-writing-tools", `${mode} exam writing tools`);
  const essay = await visibleBox(page, "#exam-essay", `${mode} exam essay textarea`);
  const submit = await visibleBox(page, "#exam-submit", `${mode} exam submit button`);

  if (!rectWithinViewport(modal, viewport, mode === "mobile" ? 8 : 30)) {
    failUiAcceptance(`${mode} exam modal does not fit inside the viewport.`);
  }
  if (rectsOverlap(question, requirements)) {
    failUiAcceptance(`${mode} exam question overlaps the requirements list.`);
  }
  if (rectsOverlap(requirements, tools)) {
    failUiAcceptance(`${mode} exam requirements overlap the writing tools.`);
  }
  if (rectsOverlap(tools, essay)) {
    failUiAcceptance(`${mode} exam writing tools overlap the essay textarea.`);
  }
  if (rectsOverlap(essay, submit)) {
    failUiAcceptance(`${mode} exam essay textarea overlaps the submit button.`);
  }
}

async function assertExamResultLayout(page, mode) {
  await assertNoHorizontalOverflow(page, `${mode} exam result modal`);

  const modal = await visibleBox(page, ".exam-modal", `${mode} result modal`);
  const result = await visibleBox(page, "#exam-result", `${mode} exam result`);
  const summary = await visibleBox(page, ".result-summary, .exam-archive-list", `${mode} result summary`);

  if (rectsOverlap(summary, result, -4) && summary.y < result.y - 2) {
    failUiAcceptance(`${mode} result summary has an unexpected layout position.`);
  }

  const counts = await page.evaluate(() => {
    document.querySelectorAll(".result-section").forEach((details) => {
      details.open = true;
    });
    const resultElement = document.querySelector("#exam-result");
    const examQuestion = document.querySelector("#exam-question");
    const examRequirements = document.querySelector("#exam-requirements");
    const examEssay = document.querySelector("#exam-essay");
    return {
      candidateProfiles: document.querySelectorAll(".candidate-profile").length,
      essayDisplay: examEssay ? getComputedStyle(examEssay).display : "",
      questionDisplay: examQuestion ? getComputedStyle(examQuestion).display : "",
      requirementsDisplay: examRequirements ? getComputedStyle(examRequirements).display : "",
      playerArchive: document.querySelectorAll(".player-exam-archive").length,
      playerRanking: document.querySelectorAll(".ranking-list .is-player").length,
      resultSections: document.querySelectorAll(".result-section").length,
      resultClientWidth: resultElement?.clientWidth || 0,
      resultScrollWidth: resultElement?.scrollWidth || 0
    };
  });

  if (counts.resultSections < 5) {
    failUiAcceptance(`${mode} expected at least five result detail sections, found ${counts.resultSections}.`);
  }
  if (counts.playerArchive < 1) {
    failUiAcceptance(`${mode} missing the player essay archive section.`);
  }
  if (counts.playerRanking < 1) {
    failUiAcceptance(`${mode} missing the highlighted player ranking row.`);
  }
  if (counts.candidateProfiles < 1) {
    failUiAcceptance(`${mode} missing inspectable same-field candidate essays.`);
  }
  if (counts.questionDisplay !== "none" || counts.requirementsDisplay !== "none" || counts.essayDisplay !== "none") {
    failUiAcceptance(`${mode} still shows question or writing controls behind the result view.`);
  }
  if (counts.resultScrollWidth > counts.resultClientWidth + 4) {
    failUiAcceptance(`${mode} exam result content overflows horizontally.`);
  }
  if (result.y + result.height > modal.y + modal.height + 4) {
    failUiAcceptance(`${mode} exam result content escapes the modal.`);
  }
}

function buildBrowserSmokeEssay() {
  return [
    "On rites and corn stores, the student urges soft tax, clear rolls, modest yamen work, and steady school books. ",
    "The text says local officers should hear poor folk soon, store crops before hunger, use honest clerks, and punish with care. ",
    "It ends by asking old laws to guide households, farms, teachers, and county order."
  ].join("");
}

async function runExamUiAcceptance(page, recorder) {
  await page.locator("#scholar-panel .panel-action").first().click();
  await page.locator("#exam-backdrop").waitFor({ state: "visible", timeout: 10000 });
  await assertExamWritingLayout(page, "desktop");
  await recorder.capture(page, "desktop-exam-modal");

  await page.locator("#exam-essay").fill(buildBrowserSmokeEssay());
  await page.waitForFunction(() => {
    const button = document.querySelector("#exam-submit");
    return button && !button.disabled;
  });
  await page.locator("#exam-submit").click();
  await page.locator("#exam-result").waitFor({ state: "visible", timeout: 15000 });
  await assertExamResultLayout(page, "desktop");
  await recorder.capture(page, "desktop-exam-result");

  await page.locator("#exam-close").click();
  await page.locator("#exam-backdrop").waitFor({ state: "hidden", timeout: 10000 });
}

async function runMobileUiAcceptance(page, recorder) {
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);
  await assertGameLayout(page, "mobile");
  await recorder.capture(page, "mobile-game-layout");

  await page.locator("#scholar-panel .archive-action").first().click();
  await page.locator("#exam-backdrop").waitFor({ state: "visible", timeout: 10000 });
  await assertExamResultLayout(page, "mobile archive");
  await recorder.capture(page, "mobile-exam-archive");
  await page.locator("#exam-close").click();
  await page.locator("#exam-backdrop").waitFor({ state: "hidden", timeout: 10000 });
}

async function runBrowserJourney({
  baseUrl,
  browserPath,
  headed = false,
  onSessionId = () => {},
  screenshotsDir = null
} = {}) {
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: !headed
  });

  const pageErrors = [];
  const recorder = createScreenshotRecorder(screenshotsDir);
  let sessionId = null;

  try {
    const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#start-form").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#action-area").waitFor({ state: "hidden", timeout: 10000 });

    await page.locator('input[name="dynasty"]').fill("Ming");
    await page.locator('input[name="year"]').fill("1644");
    await page.locator('select[name="role"]').selectOption("scholar");
    await page.locator('input[name="playerName"]').fill("Browser Smoke");
    await page.locator('input[name="background"]').fill("county school student");
    await page.locator('textarea[name="customSetting"]').fill("browser smoke acceptance run");
    await page.locator('#start-form button[type="submit"]').click();

    await page.locator("#action-area").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#scholar-panel").waitFor({ state: "visible", timeout: 10000 });
    sessionId = await page.evaluate(() => window.localStorage.getItem("qianqiu.sessionId"));
    if (!sessionId) throw new Error("Start flow did not write qianqiu.sessionId to localStorage.");
    onSessionId(sessionId);

    await assertGameLayout(page, "desktop");
    await recorder.capture(page, "desktop-game-layout");
    await runExamUiAcceptance(page, recorder);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#action-area").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#scholar-panel").waitFor({ state: "visible", timeout: 10000 });
    await assertGameLayout(page, "desktop restored");

    const restoredId = await page.evaluate(() => window.localStorage.getItem("qianqiu.sessionId"));
    if (restoredId !== sessionId) {
      throw new Error(`Restored localStorage session mismatch: expected ${sessionId}, got ${restoredId}`);
    }

    const freshPage = await context.newPage();
    freshPage.on("pageerror", (error) => pageErrors.push(error.message));
    await freshPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await freshPage.locator("#action-area").waitFor({ state: "visible", timeout: 10000 });
    await freshPage.locator("#scholar-panel").waitFor({ state: "visible", timeout: 10000 });
    await assertGameLayout(freshPage, "fresh page desktop");
    const freshPageId = await freshPage.evaluate(() => window.localStorage.getItem("qianqiu.sessionId"));
    if (freshPageId !== sessionId) {
      throw new Error(`Fresh page localStorage session mismatch: expected ${sessionId}, got ${freshPageId}`);
    }
    await freshPage.close();

    await runMobileUiAcceptance(page, recorder);

    const stateResponse = await fetch(`${baseUrl}/api/game/state/${sessionId}`);
    if (!stateResponse.ok) {
      throw new Error(`Restored session is not readable through the API: ${stateResponse.status}`);
    }

    if (pageErrors.length) {
      throw new Error(`Browser page errors detected: ${pageErrors.join("; ")}`);
    }

    const statusText = await page.locator("#status-strip").innerText();
    await context.close();

    return {
      baseUrl,
      restored: true,
      sessionId,
      statusText: statusText.replace(/\s+/g, " ").trim(),
      uiAcceptance: {
        screenshots: recorder.summary(),
        viewports: ["desktop", "mobile"]
      }
    };
  } finally {
    await browser.close();
  }
}

async function cleanupSession(sessionId) {
  if (!sessionId || !sessionIdPattern.test(sessionId)) return;
  await fsp.rm(path.join(rootDir, "data", "sessions", `${sessionId}.json`), { force: true });
}

async function runBrowserSmoke(options = {}) {
  const browserPath = resolveBrowserExecutable({ browserPath: options.browserPath });
  let server = null;
  let result = null;
  let sessionId = null;
  const baseUrl = options.url || null;

  try {
    server = baseUrl ? null : await startLocalServer();
    result = await runBrowserJourney({
      baseUrl: baseUrl || server.baseUrl,
      browserPath,
      headed: options.headed,
      onSessionId: (createdSessionId) => {
        sessionId = createdSessionId;
      },
      screenshotsDir: options.screenshotsDir
    });
    return result;
  } finally {
    if (result?.sessionId || sessionId) {
      await cleanupSession(result?.sessionId || sessionId);
    }
    if (server) {
      await server.stop();
    }
  }
}

function printHelp() {
  console.log(`Usage: npm run smoke:browser -- [options]

Options:
  --url <url>        Test an already running Qianqiu server instead of starting one.
  --browser <path>   Browser executable path. Defaults to BROWSER_EXECUTABLE_PATH or local Chrome/Edge.
  --screenshots <dir>
                    Save desktop/mobile UI acceptance screenshots to this directory.
  --headed           Show the browser window while running.
  --help             Show this message.
`);
}

if (require.main === module) {
  (async () => {
    const args = parseBrowserSmokeArgs(process.argv);
    if (args.help) {
      printHelp();
      return;
    }

    const result = await runBrowserSmoke(args);
    console.log(`Browser smoke passed: ${result.baseUrl}`);
    console.log(`Restored session: ${result.sessionId}`);
    console.log(`Status strip: ${result.statusText}`);
    console.log(`UI acceptance: ${result.uiAcceptance.viewports.join(", ")} (${result.uiAcceptance.screenshots.length} screenshots checked)`);
    const saved = result.uiAcceptance.screenshots.filter((screenshot) => screenshot.filePath);
    if (saved.length) {
      console.log(`Screenshots: ${path.dirname(saved[0].filePath)}`);
    }
  })().catch((error) => {
    console.error(`Browser smoke failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  assertPngScreenshot,
  buildBrowserSmokeEssay,
  createScreenshotRecorder,
  getDefaultBrowserCandidates,
  getGameLayoutFailures,
  normalizeBaseUrl,
  parseBrowserSmokeArgs,
  rectsOverlap,
  resolveBrowserExecutable,
  sanitizeScreenshotName,
  runBrowserJourney,
  runBrowserSmoke
};
