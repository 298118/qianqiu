const fs = require("node:fs");
const fsp = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { readSession, writeSession } = require("../src/storage/sessionStore");

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
const requiredStartRoles = Object.freeze(["scholar", "emperor", "minister", "general", "magistrate", "official"]);
const examOpenMonthByLevel = Object.freeze({
  child_exam: 1,
  provincial_exam: 8,
  metropolitan_exam: 2,
  palace_exam: 4
});
const examProgressionCases = Object.freeze([
  {
    level: "child_exam",
    expectedCompletedLevels: ["child_exam"],
    expectedRank: "秀才",
    expectedRole: "scholar",
    expectedNextLevel: "provincial_exam",
    modalScreenshotName: "desktop-exam-modal",
    resultScreenshotName: "desktop-child-exam-result"
  },
  {
    level: "provincial_exam",
    expectedCompletedLevels: ["child_exam", "provincial_exam"],
    expectedRank: "举人",
    expectedRole: "scholar",
    expectedNextLevel: "metropolitan_exam",
    resultScreenshotName: "desktop-provincial-exam-result"
  },
  {
    level: "metropolitan_exam",
    expectedCompletedLevels: ["child_exam", "provincial_exam", "metropolitan_exam"],
    expectedRank: "贡士",
    expectedRole: "scholar",
    expectedNextLevel: "palace_exam",
    resultScreenshotName: "desktop-metropolitan-exam-result"
  },
  {
    level: "palace_exam",
    expectedCompletedLevels: ["child_exam", "provincial_exam", "metropolitan_exam", "palace_exam"],
    expectedRank: "进士",
    expectedRole: "official",
    expectedOffice: true,
    resultScreenshotName: "desktop-palace-exam-result"
  }
]);
const roleWorldAcceptanceCases = Object.freeze([
  {
    role: "magistrate",
    playerName: "Browser Magistrate",
    action: "兴修水利",
    expectedKind: "magistrate_waterworks",
    expectedThreadKind: "local_case",
    metricPath: "publicOrder",
    direction: "increase"
  },
  {
    role: "general",
    playerName: "Browser General",
    action: "率营出战",
    expectedKind: "general_campaign",
    expectedThreadKind: "border",
    metricPath: "borderThreat",
    direction: "decrease"
  },
  {
    role: "emperor",
    playerName: "Browser Emperor",
    action: "任免官员整饬吏治",
    expectedKind: "emperor_appointments",
    expectedThreadKind: "faction_conflict",
    metricPath: "corruption",
    direction: "decrease"
  },
  {
    role: "minister",
    playerName: "Browser Minister",
    action: "弹劾贪墨官员",
    expectedKind: "minister_impeachment",
    expectedThreadKind: "faction_conflict",
    metricPath: "corruption",
    direction: "decrease"
  }
]);

function parseBrowserSmokeArgs(argv = process.argv) {
  const args = {
    browserPath: null,
    checkAiConnection: false,
    headed: false,
    help: false,
    screenshotsDir: null,
    url: null
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--check-ai-connection") {
      args.checkAiConnection = true;
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

function getMissingStartRoles(roleValues = []) {
  const availableRoles = new Set(roleValues);
  return requiredStartRoles.filter((role) => !availableRoles.has(role));
}

async function assertStartRoleOptions(page) {
  const startRoleValues = await page.locator('select[name="role"] option').evaluateAll((options) =>
    options.map((option) => option.value)
  );
  const missingStartRoles = getMissingStartRoles(startRoleValues);
  if (missingStartRoles.length) {
    throw new Error(`Start form missing role options: ${missingStartRoles.join(", ")}`);
  }
}

function getAiConnectionPanelFailures(panel = {}, options = {}, label = "AI connection") {
  const failures = [];
  const expectedProvider = options.expectedProvider ? String(options.expectedProvider).toLowerCase() : "";
  const hiddenTextTokens = options.hiddenTextTokens || [];
  const statusText = String(panel.statusText || "");
  const resultText = String(panel.resultText || "");
  const combinedText = `${statusText}\n${resultText}`;

  if (panel.resultOk !== "true") {
    failures.push(`${label} did not report a passing result.`);
  }
  if (expectedProvider && !combinedText.toLowerCase().includes(expectedProvider)) {
    failures.push(`${label} did not mention expected provider ${expectedProvider}.`);
  }
  if (!/当前配置/.test(resultText)) {
    failures.push(`${label} did not render the configured provider line.`);
  }
  if (!/default\s*:/.test(resultText)) {
    failures.push(`${label} did not render a default model summary.`);
  }
  if (panel.beforeSessionId !== panel.afterSessionId) {
    failures.push(`${label} changed qianqiu.sessionId during a no-session diagnostic.`);
  }
  if (panel.actionAreaVisible) {
    failures.push(`${label} unexpectedly entered the game action area.`);
  }

  const leakedTokens = hiddenTextTokens.filter((token) => token && combinedText.includes(token));
  if (leakedTokens.length) {
    failures.push(`${label} leaked hidden text tokens: ${leakedTokens.join(", ")}.`);
  }

  return failures;
}

async function assertAiConnectionPanel(page, label, options = {}) {
  await page.locator("#ai-connection-panel").waitFor({ state: "visible", timeout: 10000 });
  const beforeSessionId = await page.evaluate(() => window.localStorage.getItem("qianqiu.sessionId") || "");

  await page.locator("#ai-test-button").click();
  await page.waitForFunction(() => {
    const result = document.querySelector("#ai-test-result");
    const button = document.querySelector("#ai-test-button");
    return result?.dataset.ok && button && !button.disabled;
  }, null, { timeout: 15000 });

  const summary = await page.evaluate((before) => {
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
      if (!element || element.hidden) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    };

    return {
      beforeSessionId: before,
      afterSessionId: window.localStorage.getItem("qianqiu.sessionId") || "",
      actionAreaVisible: isVisible("#action-area"),
      resultOk: document.querySelector("#ai-test-result")?.dataset.ok || "",
      resultText: document.querySelector("#ai-test-result")?.innerText || "",
      statusText: document.querySelector("#ai-test-status")?.innerText || ""
    };
  }, beforeSessionId);

  const failures = getAiConnectionPanelFailures(summary, options, label);
  if (failures.length) {
    failUiAcceptance(failures.join("\n"));
  }

  return {
    ok: summary.resultOk === "true",
    statusText: summary.statusText.replace(/\s+/g, " ").trim(),
    resultText: summary.resultText.replace(/\s+/g, " ").trim()
  };
}

async function waitForInitialRestore(page) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 5000 });
  } catch {
    // The start form visibility check below is the actual acceptance gate.
  }
}

async function openCleanStartPage(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForInitialRestore(page);

  if (!(await page.locator("#start-form").isVisible())) {
    await page.evaluate(() => window.localStorage.removeItem("qianqiu.sessionId"));
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await waitForInitialRestore(page);
  }

  await page.locator("#start-form").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#action-area").waitFor({ state: "hidden", timeout: 10000 });
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

function hasTenDayPeriodLabel(text = "") {
  return /(?:上旬|中旬|下旬)/.test(String(text || ""));
}

function getTenDayDateFailures(entries = {}, mode = "fixture") {
  return Object.entries(entries)
    .filter(([, text]) => !hasTenDayPeriodLabel(text))
    .map(([label]) => `${mode} ${label} is missing a ten-day date label.`);
}

function assertTenDayDateText(text, label) {
  const failures = getTenDayDateFailures({ [label]: text }, label);
  if (failures.length) {
    failUiAcceptance(failures.join(" "));
  }
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

  if (metrics.relationshipClientWidth > 0 && metrics.relationshipScrollWidth > metrics.relationshipClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} relationship panel has horizontal scroll overflow (${roundMetric(metrics.relationshipScrollWidth)}px > ${roundMetric(metrics.relationshipClientWidth)}px).`
    );
  }

  if (metrics.activeRequestClientWidth > 0 && metrics.activeRequestScrollWidth > metrics.activeRequestClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} active request panel has horizontal scroll overflow (${roundMetric(metrics.activeRequestScrollWidth)}px > ${roundMetric(metrics.activeRequestClientWidth)}px).`
    );
  }

  if (metrics.officialCareerClientWidth > 0 && metrics.officialCareerScrollWidth > metrics.officialCareerClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} official career panel has horizontal scroll overflow (${roundMetric(metrics.officialCareerScrollWidth)}px > ${roundMetric(metrics.officialCareerClientWidth)}px).`
    );
  }

  if (metrics.worldThreadClientWidth > 0 && metrics.worldThreadScrollWidth > metrics.worldThreadClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} world thread panel has horizontal scroll overflow (${roundMetric(metrics.worldThreadScrollWidth)}px > ${roundMetric(metrics.worldThreadClientWidth)}px).`
    );
  }

  if (metrics.informationPanelClientWidth > 0 && metrics.informationPanelScrollWidth > metrics.informationPanelClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} information panel has horizontal scroll overflow (${roundMetric(metrics.informationPanelScrollWidth)}px > ${roundMetric(metrics.informationPanelClientWidth)}px).`
    );
  }

  if (metrics.examCalendarClientWidth > 0 && metrics.examCalendarScrollWidth > metrics.examCalendarClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} exam calendar panel has horizontal scroll overflow (${roundMetric(metrics.examCalendarScrollWidth)}px > ${roundMetric(metrics.examCalendarClientWidth)}px).`
    );
  }

  if (metrics.examRivalClientWidth > 0 && metrics.examRivalScrollWidth > metrics.examRivalClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} exam rival panel has horizontal scroll overflow (${roundMetric(metrics.examRivalScrollWidth)}px > ${roundMetric(metrics.examRivalClientWidth)}px).`
    );
  }

  if (metrics.saveListPanelClientWidth > 0 && metrics.saveListPanelScrollWidth > metrics.saveListPanelClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} save-list panel has horizontal scroll overflow (${roundMetric(metrics.saveListPanelScrollWidth)}px > ${roundMetric(metrics.saveListPanelClientWidth)}px).`
    );
  }

  if (metrics.saveListModalClientWidth > 0 && metrics.saveListModalScrollWidth > metrics.saveListModalClientWidth + horizontalClipTolerance) {
    failures.push(
      `${mode} save-list modal has horizontal scroll overflow (${roundMetric(metrics.saveListModalScrollWidth)}px > ${roundMetric(metrics.saveListModalClientWidth)}px).`
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
    const relationship = box("#relationship-panel");
    const activeRequest = box("#active-request-panel");
    const officialCareer = box("#official-career-panel");
    const worldThread = box("#world-thread-panel");
    const informationPanel = box("#information-panel");
    const examCalendar = box("#exam-calendar-panel");
    const examRival = box("#exam-rival-panel");
    const saveListPanel = box("#save-list-panel");
    const saveListModal = box("#save-list-modal");

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
      relationshipClientWidth: relationship?.clientWidth || 0,
      relationshipScrollWidth: relationship?.scrollWidth || 0,
      relationshipWidth: relationship?.width || 0,
      activeRequestClientWidth: activeRequest?.clientWidth || 0,
      activeRequestScrollWidth: activeRequest?.scrollWidth || 0,
      activeRequestWidth: activeRequest?.width || 0,
      officialCareerClientWidth: officialCareer?.clientWidth || 0,
      officialCareerScrollWidth: officialCareer?.scrollWidth || 0,
      officialCareerWidth: officialCareer?.width || 0,
      worldThreadClientWidth: worldThread?.clientWidth || 0,
      worldThreadScrollWidth: worldThread?.scrollWidth || 0,
      worldThreadWidth: worldThread?.width || 0,
      informationPanelClientWidth: informationPanel?.clientWidth || 0,
      informationPanelScrollWidth: informationPanel?.scrollWidth || 0,
      informationPanelWidth: informationPanel?.width || 0,
      examCalendarClientWidth: examCalendar?.clientWidth || 0,
      examCalendarScrollWidth: examCalendar?.scrollWidth || 0,
      examCalendarWidth: examCalendar?.width || 0,
      examRivalClientWidth: examRival?.clientWidth || 0,
      examRivalScrollWidth: examRival?.scrollWidth || 0,
      examRivalWidth: examRival?.width || 0,
      saveListPanelClientWidth: saveListPanel?.clientWidth || 0,
      saveListPanelScrollWidth: saveListPanel?.scrollWidth || 0,
      saveListPanelWidth: saveListPanel?.width || 0,
      saveListModalClientWidth: saveListModal?.clientWidth || 0,
      saveListModalScrollWidth: saveListModal?.scrollWidth || 0,
      saveListModalWidth: saveListModal?.width || 0,
      viewportWidth: window.innerWidth
    };
  });
}

function getMissingRelationshipEntries(actualIds = [], expectedIds = []) {
  const available = new Set(actualIds);
  return expectedIds.filter((id) => !available.has(id));
}

function getHiddenRelationshipLeaks(actualIds = [], hiddenIds = []) {
  const available = new Set(actualIds);
  return hiddenIds.filter((id) => available.has(id));
}

function getMissingActiveRequestTargets(actualIds = [], expectedIds = []) {
  return getMissingRelationshipEntries(actualIds, expectedIds);
}

function getHiddenActiveRequestLeaks(actualIds = [], hiddenIds = []) {
  return getHiddenRelationshipLeaks(actualIds, hiddenIds);
}

function getMissingSaveIds(actualIds = [], expectedIds = []) {
  const available = new Set(actualIds);
  return expectedIds.filter((id) => !available.has(id));
}

function getHiddenSaveIdLeaks(actualIds = [], hiddenIds = []) {
  const available = new Set(actualIds);
  return hiddenIds.filter((id) => available.has(id));
}

function getMissingOfficialCareerOutcomeTypes(actualTypes = [], expectedTypes = []) {
  const available = new Set(actualTypes);
  return expectedTypes.filter((type) => !available.has(type));
}

function getMissingOfficialCareerAssignmentKinds(actualKinds = [], expectedKinds = []) {
  const available = new Set(actualKinds.filter(Boolean));
  return expectedKinds.filter((kind) => !available.has(kind));
}

function getMissingOfficialCareerAssignmentStatuses(actualStatuses = [], expectedStatuses = []) {
  const available = new Set(actualStatuses.filter(Boolean));
  if (!expectedStatuses.length) return [];
  return expectedStatuses.some((status) => available.has(status)) ? [] : expectedStatuses;
}

function getHiddenOfficialCareerTextLeaks(text = "", hiddenTextTokens = []) {
  return hiddenTextTokens.filter((token) => token && String(text).includes(token));
}

function getOfficialCareerAssignmentRecords(snapshot = {}) {
  if (Array.isArray(snapshot.assignmentRecords)) {
    return snapshot.assignmentRecords;
  }
  return (snapshot.assignmentIds || []).map((id, index) => ({
    id,
    kind: snapshot.assignmentKinds?.[index] || "",
    status: snapshot.assignmentStatuses?.[index] || "",
    bureauId: snapshot.assignmentBureauIds?.[index] || ""
  }));
}

function getOfficialCareerPanelFailures(snapshot = {}, expectations = {}, mode = "official") {
  const failures = [];

  if (expectations.expectOutcome && !snapshot.outcomeIds?.length) {
    failures.push(`${mode} official career panel did not render any outcome rows.`);
  }

  const missingTypes = getMissingOfficialCareerOutcomeTypes(snapshot.outcomeTypes, expectations.expectedTypes || []);
  if (missingTypes.length) {
    failures.push(`${mode} official career panel is missing outcome types: ${missingTypes.join(", ")}.`);
  }

  if (expectations.expectedPosting && !String(snapshot.currentPosting || "").includes(expectations.expectedPosting)) {
    failures.push(`${mode} official career panel current posting did not include ${expectations.expectedPosting}.`);
  }

  if (expectations.expectedBureauId && !snapshot.bureauIds?.includes(expectations.expectedBureauId)) {
    failures.push(`${mode} official career panel is missing bureau id: ${expectations.expectedBureauId}.`);
  }
  if (snapshot.bureauIds?.length && snapshot.bureauDutyCount < snapshot.bureauIds.length) {
    failures.push(`${mode} official career panel has incomplete bureau duty fields.`);
  }

  if (expectations.expectAssignment && !snapshot.assignmentIds?.length) {
    failures.push(`${mode} official career panel did not render any assignment rows.`);
  }
  if (snapshot.assignmentIds?.length && !snapshot.assignmentSummaryCount) {
    failures.push(`${mode} official career panel did not render an assignment summary.`);
  }
  if (snapshot.assignmentIds?.length && snapshot.assignmentProgressCount < snapshot.assignmentIds.length) {
    failures.push(`${mode} official career panel has incomplete assignment progress fields.`);
  }
  if (snapshot.assignmentIds?.length && snapshot.assignmentRiskCount < snapshot.assignmentIds.length) {
    failures.push(`${mode} official career panel has incomplete assignment risk fields.`);
  }

  const missingAssignmentKinds = getMissingOfficialCareerAssignmentKinds(
    snapshot.assignmentKinds,
    expectations.expectedAssignmentKinds || []
  );
  if (missingAssignmentKinds.length) {
    failures.push(`${mode} official career panel is missing assignment kinds: ${missingAssignmentKinds.join(", ")}.`);
  }

  const expectedAssignmentStatuses = expectations.expectedAssignmentStatuses || [];
  if (expectedAssignmentStatuses.length && (expectations.expectedAssignmentKinds || []).length) {
    const records = getOfficialCareerAssignmentRecords(snapshot);
    (expectations.expectedAssignmentKinds || []).forEach((kind) => {
      const matchingRecords = records.filter((record) => record.kind === kind);
      if (matchingRecords.length && !matchingRecords.some((record) => expectedAssignmentStatuses.includes(record.status))) {
        failures.push(`${mode} official career panel has no ${kind} assignment with allowed statuses: ${expectedAssignmentStatuses.join(", ")}.`);
      }
    });
  } else {
    const missingAssignmentStatuses = getMissingOfficialCareerAssignmentStatuses(
      snapshot.assignmentStatuses,
      expectedAssignmentStatuses
    );
    if (missingAssignmentStatuses.length) {
      failures.push(`${mode} official career panel is missing assignment statuses: ${missingAssignmentStatuses.join(", ")}.`);
    }
  }

  if (expectations.expectAssessment && !snapshot.assessments?.length) {
    failures.push(`${mode} official career panel did not render an assessment block.`);
  }
  if (expectations.expectAssessment && !snapshot.assessmentViewReady?.includes("true")) {
    failures.push(`${mode} official career panel did not render server assessment view data.`);
  }
  if (snapshot.assessments?.length && snapshot.assessmentNoteCount < snapshot.assessments.length) {
    failures.push(`${mode} official career panel has incomplete assessment notes.`);
  }

  if (expectations.expectNetwork && !snapshot.networkCount) {
    failures.push(`${mode} official career panel did not render a network block.`);
  }
  if (expectations.expectNetwork && !snapshot.networkViewReady?.includes("true")) {
    failures.push(`${mode} official career panel did not render server network view data.`);
  }

  if (expectations.expectedImpeachmentStage) {
    if (snapshot.panelImpeachmentStage !== expectations.expectedImpeachmentStage) {
      failures.push(`${mode} official career panel data stage is not ${expectations.expectedImpeachmentStage}.`);
    }
    if (!snapshot.procedureStages?.includes(expectations.expectedImpeachmentStage)) {
      failures.push(`${mode} official career panel is missing impeachment stage: ${expectations.expectedImpeachmentStage}.`);
    }
    if (!snapshot.procedureViewReady?.includes("true")) {
      failures.push(`${mode} official career panel did not render server procedure view data.`);
    }
  }

  const hiddenLeaks = getHiddenOfficialCareerTextLeaks(snapshot.text, expectations.hiddenTextTokens || []);
  if (hiddenLeaks.length) {
    failures.push(`${mode} official career panel leaked hidden text tokens: ${hiddenLeaks.join(", ")}.`);
  }

  if (
    snapshot.outcomeIds?.length &&
    (snapshot.reasonCount < snapshot.outcomeIds.length || snapshot.postingCount < snapshot.outcomeIds.length)
  ) {
    failures.push(`${mode} official career panel has incomplete outcome fields.`);
  }

  return failures;
}

function getMissingWorldThreadKinds(actualKinds = [], expectedKinds = []) {
  const available = new Set(actualKinds.filter(Boolean));
  return expectedKinds.filter((kind) => !available.has(kind));
}

function getMissingWorldThreadSourceTypes(actualSourceTypes = [], expectedSourceTypes = []) {
  const available = new Set(actualSourceTypes.filter(Boolean));
  return expectedSourceTypes.filter((sourceType) => !available.has(sourceType));
}

function getHiddenWorldThreadTextLeaks(text = "", hiddenTextTokens = []) {
  return hiddenTextTokens.filter((token) => token && String(text).includes(token));
}

function getWorldThreadPanelFailures(snapshot = {}, expectations = {}, mode = "world thread") {
  const failures = [];
  const cards = Number(snapshot.cardCount) || 0;

  if (expectations.expectActive && cards <= 0) {
    failures.push(`${mode} world thread panel did not render any active thread cards.`);
  }

  const missingKinds = getMissingWorldThreadKinds(snapshot.kinds, expectations.expectedKinds || []);
  if (missingKinds.length) {
    failures.push(`${mode} world thread panel is missing thread kinds: ${missingKinds.join(", ")}.`);
  }

  const missingSourceTypes = getMissingWorldThreadSourceTypes(snapshot.sourceTypes, expectations.expectedSourceTypes || []);
  if (missingSourceTypes.length) {
    failures.push(`${mode} world thread panel is missing source types: ${missingSourceTypes.join(", ")}.`);
  }

  if (expectations.expectedStatuses?.length) {
    const availableStatuses = new Set(snapshot.statuses || []);
    const hasExpectedStatus = expectations.expectedStatuses.some((status) => availableStatuses.has(status));
    if (!hasExpectedStatus) {
      failures.push(`${mode} world thread panel is missing allowed statuses: ${expectations.expectedStatuses.join(", ")}.`);
    }
  }

  if (cards > 0) {
    const fieldChecks = [
      ["goals", snapshot.goalCount],
      ["deadlines", snapshot.deadlineCount],
      ["risk labels", snapshot.riskCount],
      ["related labels", snapshot.relatedCount],
      ["intervention hints", snapshot.hintCount],
      ["follow-up hints", snapshot.followUpCount]
    ];
    for (const [label, count] of fieldChecks) {
      if (count < cards) {
        failures.push(`${mode} world thread panel has ${count} ${label} for ${cards} thread cards.`);
      }
    }
    const missingRiskData = (snapshot.risks || []).filter((risk) => !risk).length;
    if (missingRiskData) {
      failures.push(`${mode} world thread panel has ${missingRiskData} thread cards without data-risk.`);
    }
  }

  const hiddenLeaks = getHiddenWorldThreadTextLeaks(snapshot.text, expectations.hiddenTextTokens || []);
  if (hiddenLeaks.length) {
    failures.push(`${mode} world thread panel leaked hidden text tokens: ${hiddenLeaks.join(", ")}.`);
  }

  return failures;
}

const informationPanelTabs = ["world-geography", "posting-geography", "world-people", "official-postings", "event-archive"];
const informationPanelIds = [
  "world-geography-panel",
  "posting-geography-panel",
  "world-people-panel",
  "official-postings-panel",
  "event-archive-panel"
];

function getMissingInformationPanelItems(actual = [], expected = []) {
  const available = new Set(actual.filter(Boolean));
  return expected.filter((item) => !available.has(item));
}

function getInformationPanelShellFailures(snapshot = {}, expectations = {}, mode = "information") {
  const failures = [];
  const expectedTabs = expectations.expectedTabs || informationPanelTabs;
  const expectedPanels = expectations.expectedPanels || informationPanelIds;
  const expectedReadyPanels = expectations.expectedReadyPanels || [
    "world-geography-panel",
    "posting-geography-panel",
    "world-people-panel",
    "official-postings-panel"
  ];

  const missingTabs = getMissingInformationPanelItems(snapshot.tabIds, expectedTabs);
  if (missingTabs.length) {
    failures.push(`${mode} information panel is missing tabs: ${missingTabs.join(", ")}.`);
  }

  const missingPanels = getMissingInformationPanelItems(snapshot.panelIds, expectedPanels);
  if (missingPanels.length) {
    failures.push(`${mode} information panel is missing panels: ${missingPanels.join(", ")}.`);
  }

  if (!snapshot.activeTab || !expectedTabs.includes(snapshot.activeTab)) {
    failures.push(`${mode} information panel has invalid active tab: ${snapshot.activeTab || "none"}.`);
  }

  const missingReadyPanels = getMissingInformationPanelItems(snapshot.readyPanelIds, expectedReadyPanels);
  if (missingReadyPanels.length) {
    failures.push(`${mode} information panel has route views missing for panels: ${missingReadyPanels.join(", ")}.`);
  }

  if (expectations.expectEventArchiveDisabled !== false && !(snapshot.disabledTabIds || []).includes("event-archive")) {
    failures.push(`${mode} information panel did not keep event archive disabled before sanitized projection.`);
  }

  if (expectations.expectEventArchiveReady === false && (snapshot.readyPanelIds || []).includes("event-archive-panel")) {
    failures.push(`${mode} information panel marked event archive ready before sanitized projection.`);
  }

  if (Number(snapshot.contentCardCount) > 0) {
    failures.push(`${mode} information panel rendered detailed content cards before S53.4-S53.6.`);
  }

  const hiddenLeaks = (expectations.hiddenTextTokens || []).filter((token) => token && String(snapshot.text || "").includes(token));
  if (hiddenLeaks.length) {
    failures.push(`${mode} information panel leaked hidden text tokens: ${hiddenLeaks.join(", ")}.`);
  }

  return failures;
}

function getMissingRoleWorldKinds(actualKinds = [], expectedKinds = []) {
  const available = new Set(actualKinds);
  return expectedKinds.filter((kind) => !available.has(kind));
}

function getMissingExamLevels(actualLevels = [], expectedLevels = []) {
  const available = new Set(actualLevels);
  return expectedLevels.filter((level) => !available.has(level));
}

async function assertRelationshipPanel(page, mode, expectations = {}) {
  await visibleBox(page, "#relationship-panel", `${mode} relationship panel`);

  const snapshot = await page.evaluate(() => {
    const panel = document.querySelector("#relationship-panel");
    const contacts = [...document.querySelectorAll("#relationship-panel .relationship-contact")];
    return {
      contactIds: contacts.map((contact) => contact.dataset.contactId),
      contactTypes: contacts.map((contact) => contact.dataset.contactType),
      relationshipScores: document.querySelectorAll("#relationship-panel .relationship-score").length,
      resentmentScores: document.querySelectorAll("#relationship-panel .relationship-resentment").length,
      stances: document.querySelectorAll("#relationship-panel .relationship-stance").length,
      intents: document.querySelectorAll("#relationship-panel .relationship-intent").length,
      sources: document.querySelectorAll("#relationship-panel .relationship-source").length,
      updated: document.querySelectorAll("#relationship-panel .relationship-updated").length,
      text: panel?.innerText || ""
    };
  });

  if (!snapshot.contactIds.length) {
    failUiAcceptance(`${mode} relationship panel did not render any visible contacts.`);
  }

  const missing = getMissingRelationshipEntries(snapshot.contactIds, expectations.expectedIds || []);
  if (missing.length) {
    failUiAcceptance(`${mode} relationship panel is missing expected entries: ${missing.join(", ")}.`);
  }

  const hiddenLeaks = getHiddenRelationshipLeaks(snapshot.contactIds, expectations.hiddenIds || []);
  if (hiddenLeaks.length) {
    failUiAcceptance(`${mode} relationship panel rendered hidden entries: ${hiddenLeaks.join(", ")}.`);
  }

  for (const token of expectations.hiddenTextTokens || []) {
    if (snapshot.text.includes(token)) {
      failUiAcceptance(`${mode} relationship panel leaked hidden text token: ${token}.`);
    }
  }

  const fieldCounts = [
    ["relationship scores", snapshot.relationshipScores],
    ["resentment scores", snapshot.resentmentScores],
    ["stances", snapshot.stances],
    ["intents", snapshot.intents],
    ["sources", snapshot.sources],
    ["updated turns", snapshot.updated]
  ];
  for (const [label, count] of fieldCounts) {
    if (count < snapshot.contactIds.length) {
      failUiAcceptance(`${mode} relationship panel has ${count} ${label} for ${snapshot.contactIds.length} contacts.`);
    }
  }

  if (expectations.expectedTypes) {
    for (const type of expectations.expectedTypes) {
      if (!snapshot.contactTypes.includes(type)) {
        failUiAcceptance(`${mode} relationship panel is missing contact type: ${type}.`);
      }
    }
  }

  const layoutFailures = getGameLayoutFailures(await readGameLayoutMetrics(page), `${mode} relationship`);
  if (layoutFailures.length) {
    failUiAcceptance(layoutFailures.join(" "));
  }

  return snapshot;
}

async function assertActiveNpcRequestPanel(page, mode, expectations = {}) {
  await visibleBox(page, "#active-request-panel", `${mode} active request panel`);

  const snapshot = await page.evaluate(() => {
    const panel = document.querySelector("#active-request-panel");
    const requests = [...document.querySelectorAll("#active-request-panel .active-request-card")];
    return {
      requestIds: requests.map((request) => request.dataset.requestId),
      targetIds: requests.map((request) => request.dataset.targetId),
      targetTypes: requests.map((request) => request.dataset.targetType),
      requestKinds: requests.map((request) => request.dataset.requestKind),
      statuses: requests.map((request) => request.dataset.requestStatus),
      asks: document.querySelectorAll("#active-request-panel .active-request-ask").length,
      stakes: document.querySelectorAll("#active-request-panel .active-request-stakes").length,
      dues: document.querySelectorAll("#active-request-panel .active-request-due").length,
      hints: document.querySelectorAll("#active-request-panel .active-request-hint").length,
      text: panel?.innerText || ""
    };
  });

  if (!snapshot.requestIds.length) {
    failUiAcceptance(`${mode} active request panel did not render any visible requests.`);
  }

  const missing = getMissingActiveRequestTargets(snapshot.targetIds, expectations.expectedTargetIds || []);
  if (missing.length) {
    failUiAcceptance(`${mode} active request panel is missing expected targets: ${missing.join(", ")}.`);
  }

  const hiddenLeaks = getHiddenActiveRequestLeaks(snapshot.targetIds, expectations.hiddenTargetIds || []);
  if (hiddenLeaks.length) {
    failUiAcceptance(`${mode} active request panel rendered hidden targets: ${hiddenLeaks.join(", ")}.`);
  }

  for (const token of expectations.hiddenTextTokens || []) {
    if (snapshot.text.includes(token)) {
      failUiAcceptance(`${mode} active request panel leaked hidden text token: ${token}.`);
    }
  }

  const fieldCounts = [
    ["asks", snapshot.asks],
    ["stakes", snapshot.stakes],
    ["due turns", snapshot.dues],
    ["hints", snapshot.hints]
  ];
  for (const [label, count] of fieldCounts) {
    if (count < snapshot.requestIds.length) {
      failUiAcceptance(`${mode} active request panel has ${count} ${label} for ${snapshot.requestIds.length} requests.`);
    }
  }

  if (expectations.expectedTargetTypes) {
    for (const type of expectations.expectedTargetTypes) {
      if (!snapshot.targetTypes.includes(type)) {
        failUiAcceptance(`${mode} active request panel is missing target type: ${type}.`);
      }
    }
  }

  const layoutFailures = getGameLayoutFailures(await readGameLayoutMetrics(page), `${mode} active request`);
  if (layoutFailures.length) {
    failUiAcceptance(layoutFailures.join(" "));
  }

  return snapshot;
}

async function assertOfficialCareerPanel(page, mode, expectations = {}) {
  await visibleBox(
    page,
    "#official-career-panel[data-current-posting][data-pending-review][data-impeachment-stage]",
    `${mode} official career panel`
  );

  const snapshot = await page.evaluate(() => {
    const panel = document.querySelector("#official-career-panel");
    const outcomes = [...document.querySelectorAll("#official-career-panel .official-career-outcome")];
    const bureaus = [...document.querySelectorAll("#official-career-panel .official-career-bureau[data-bureau-id]")];
    const assignments = [
      ...document.querySelectorAll(
        "#official-career-panel .official-career-assignment[data-assignment-id][data-assignment-kind][data-assignment-status][data-bureau-id]"
      )
    ];
    const assessments = [
      ...document.querySelectorAll("#official-career-panel .official-career-assessment[data-pending-recommendation]")
    ];
    const procedures = [
      ...document.querySelectorAll("#official-career-panel .official-career-procedure[data-impeachment-stage]")
    ];
    return {
      currentPosting: panel?.dataset.currentPosting || "",
      pendingReview: panel?.dataset.pendingReview || "",
      panelImpeachmentStage: panel?.dataset.impeachmentStage || "",
      bureauIds: bureaus.map((bureau) => bureau.dataset.bureauId),
      bureauDutyCount: document.querySelectorAll("#official-career-panel .official-career-bureau-duty").length,
      assignmentSummaryCount: document.querySelectorAll("#official-career-panel .official-career-assignment-summary").length,
      assignmentIds: assignments.map((assignment) => assignment.dataset.assignmentId),
      assignmentKinds: assignments.map((assignment) => assignment.dataset.assignmentKind),
      assignmentStatuses: assignments.map((assignment) => assignment.dataset.assignmentStatus),
      assignmentBureauIds: assignments.map((assignment) => assignment.dataset.bureauId),
      assignmentRecords: assignments.map((assignment) => ({
        id: assignment.dataset.assignmentId,
        kind: assignment.dataset.assignmentKind,
        status: assignment.dataset.assignmentStatus,
        bureauId: assignment.dataset.bureauId
      })),
      assignmentProgressCount: document.querySelectorAll("#official-career-panel .official-career-assignment-progress").length,
      assignmentRiskCount: document.querySelectorAll("#official-career-panel .official-career-assignment-risk").length,
      assessments: assessments.map((assessment) => assessment.dataset.pendingRecommendation),
      assessmentViewReady: assessments.map((assessment) => assessment.dataset.viewReady),
      assessmentNoteCount: document.querySelectorAll("#official-career-panel .official-career-assessment-note").length,
      networkCount: document.querySelectorAll("#official-career-panel .official-career-network").length,
      networkViewReady: [...document.querySelectorAll("#official-career-panel .official-career-network")].map((network) => network.dataset.viewReady),
      procedureStages: procedures.map((procedure) => procedure.dataset.impeachmentStage),
      procedureViewReady: procedures.map((procedure) => procedure.dataset.viewReady),
      outcomeIds: outcomes.map((outcome) => outcome.dataset.outcomeId),
      outcomeTypes: outcomes.map((outcome) => outcome.dataset.outcomeType),
      outcomeStatuses: outcomes.map((outcome) => outcome.dataset.outcomeStatus),
      officeTitles: outcomes.map((outcome) => outcome.dataset.officeTitle),
      outcomeTurns: outcomes.map((outcome) => outcome.dataset.outcomeTurn),
      reasonCount: document.querySelectorAll("#official-career-panel .official-career-reason").length,
      postingCount: document.querySelectorAll("#official-career-panel .official-career-posting").length,
      text: panel?.innerText || ""
    };
  });

  const failures = getOfficialCareerPanelFailures(snapshot, expectations, mode);
  if (failures.length) {
    failUiAcceptance(failures.join(" "));
  }

  const layoutFailures = getGameLayoutFailures(await readGameLayoutMetrics(page), `${mode} official career`);
  if (layoutFailures.length) {
    failUiAcceptance(layoutFailures.join(" "));
  }

  return snapshot;
}

async function assertWorldThreadPanel(page, mode, expectations = {}) {
  await visibleBox(page, "#world-thread-panel[data-generated-turn][data-active-count][data-watch-count]", `${mode} world thread panel`);

  const snapshot = await page.evaluate(() => {
    const panel = document.querySelector("#world-thread-panel");
    const cards = [
      ...document.querySelectorAll(
        "#world-thread-panel .world-thread-card[data-thread-id][data-source-type][data-thread-kind][data-status][data-severity][data-risk]"
      )
    ];
    return {
      activeCount: panel?.dataset.activeCount || "",
      generatedTurn: panel?.dataset.generatedTurn || "",
      watchCount: panel?.dataset.watchCount || "",
      cardCount: cards.length,
      ids: cards.map((card) => card.dataset.threadId),
      sourceTypes: cards.map((card) => card.dataset.sourceType),
      kinds: cards.map((card) => card.dataset.threadKind),
      statuses: cards.map((card) => card.dataset.status),
      severities: cards.map((card) => card.dataset.severity),
      risks: cards.map((card) => card.dataset.risk),
      goalCount: document.querySelectorAll("#world-thread-panel .world-thread-goal").length,
      deadlineCount: document.querySelectorAll("#world-thread-panel .world-thread-deadline").length,
      riskCount: document.querySelectorAll("#world-thread-panel .world-thread-risk").length,
      relatedCount: document.querySelectorAll("#world-thread-panel .world-thread-related").length,
      hintCount: document.querySelectorAll("#world-thread-panel .world-thread-hint").length,
      followUpCount: document.querySelectorAll("#world-thread-panel .world-thread-followup").length,
      resolvedCount: document.querySelectorAll("#world-thread-panel .world-thread-resolved-item").length,
      text: panel?.innerText || ""
    };
  });

  const failures = getWorldThreadPanelFailures(snapshot, expectations, mode);
  if (failures.length) {
    failUiAcceptance(failures.join(" "));
  }

  const layoutFailures = getGameLayoutFailures(await readGameLayoutMetrics(page), `${mode} world thread`);
  if (layoutFailures.length) {
    failUiAcceptance(layoutFailures.join(" "));
  }

  return snapshot;
}

async function assertInformationPanelShell(page, mode, expectations = {}) {
  await visibleBox(page, "#information-panel[data-active-tab]", `${mode} information panel`);

  const snapshot = await page.evaluate(() => {
    const panel = document.querySelector("#information-panel");
    const pages = [...document.querySelectorAll("#information-panel .information-panel-page")];
    const tabs = [...document.querySelectorAll("#information-panel .information-tab")];
    return {
      activeTab: panel?.dataset.activeTab || "",
      tabIds: tabs.map((tab) => tab.dataset.tabId),
      disabledTabIds: tabs.filter((tab) => tab.disabled || tab.getAttribute("aria-disabled") === "true").map((tab) => tab.dataset.tabId),
      panelIds: pages.map((page) => page.id),
      readyPanelIds: pages.filter((page) => page.dataset.viewReady === "true").map((page) => page.id),
      sourceViews: pages.map((page) => page.dataset.sourceView || ""),
      visiblePanelIds: pages.filter((page) => !page.hidden).map((page) => page.id),
      contentCardCount: document.querySelectorAll(
        "#information-panel .world-geography-card, #information-panel .posting-geography-card, #information-panel .world-people-card, #information-panel .official-posting-card, #information-panel .event-archive-item"
      ).length,
      text: panel?.textContent || ""
    };
  });

  const failures = getInformationPanelShellFailures(snapshot, expectations, mode);
  if (failures.length) {
    failUiAcceptance(failures.join(" "));
  }

  const enabledTabs = (expectations.expectedSwitchTabs || ["world-geography", "posting-geography", "world-people", "official-postings"]);
  for (const tabId of enabledTabs) {
    await page.locator(`#information-panel .information-tab[data-tab-id="${tabId}"]`).click();
    const panelId = `${tabId}-panel`;
    await page.locator(`#${panelId}`).waitFor({ state: "visible", timeout: 5000 });
    const activeTab = await page.locator("#information-panel").getAttribute("data-active-tab");
    if (activeTab !== tabId) {
      failUiAcceptance(`${mode} information panel did not activate tab ${tabId}.`);
    }
  }
  await page.locator('#information-panel .information-tab[data-tab-id="world-geography"]').click();

  const layoutFailures = getGameLayoutFailures(await readGameLayoutMetrics(page), `${mode} information`);
  if (layoutFailures.length) {
    failUiAcceptance(layoutFailures.join(" "));
  }

  return snapshot;
}

async function assertExamCalendarPanel(page, mode, expectations = {}) {
  await visibleBox(page, "#exam-calendar-panel", `${mode} exam calendar panel`);

  const snapshot = await page.evaluate(() => {
    const panel = document.querySelector("#exam-calendar-panel");
    return {
      nextLevel: panel?.dataset.nextLevel || "",
      windowStatus: panel?.dataset.windowStatus || "",
      monthsUntil: panel?.dataset.monthsUntil || "",
      values: document.querySelectorAll("#exam-calendar-panel .panel-kicker").length,
      recommendation: document.querySelectorAll("#exam-calendar-panel .exam-calendar-recommendation").length,
      quota: document.querySelectorAll("#exam-calendar-panel .exam-calendar-quota").length,
      text: panel?.innerText || ""
    };
  });

  if (expectations.expectedNextLevel && snapshot.nextLevel !== expectations.expectedNextLevel) {
    failUiAcceptance(`${mode} exam calendar expected ${expectations.expectedNextLevel}, got ${snapshot.nextLevel}.`);
  }
  if (expectations.expectedStatus && snapshot.windowStatus !== expectations.expectedStatus) {
    failUiAcceptance(`${mode} exam calendar expected status ${expectations.expectedStatus}, got ${snapshot.windowStatus}.`);
  }
  if (!snapshot.monthsUntil && snapshot.monthsUntil !== "0") {
    failUiAcceptance(`${mode} exam calendar did not expose months-until data.`);
  }
  if (snapshot.values < 4 || snapshot.recommendation < 1 || snapshot.quota < 1) {
    failUiAcceptance(`${mode} exam calendar is missing timing, funding, recommendation, or quota details.`);
  }
  assertTenDayDateText(snapshot.text, `${mode} exam calendar`);

  const layoutFailures = getGameLayoutFailures(await readGameLayoutMetrics(page), `${mode} exam calendar`);
  if (layoutFailures.length) {
    failUiAcceptance(layoutFailures.join(" "));
  }
  return snapshot;
}

async function assertExamRivalPanel(page, mode, expectations = {}) {
  await visibleBox(page, "#exam-rival-panel", `${mode} exam rival panel`);

  const snapshot = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#exam-rival-panel .exam-rival-card")];
    return {
      rivalIds: cards.map((card) => card.dataset.rivalId),
      statuses: cards.map((card) => card.dataset.rivalStatus),
      levels: cards.map((card) => card.dataset.lastLevel),
      contactIds: cards.map((card) => card.dataset.contactId).filter(Boolean),
      latestRows: document.querySelectorAll("#exam-rival-panel .exam-rival-latest").length,
      statusRows: document.querySelectorAll("#exam-rival-panel .exam-rival-status").length
    };
  });

  if (snapshot.rivalIds.length < (expectations.minRivals || 1)) {
    failUiAcceptance(`${mode} exam rival panel rendered too few rivals.`);
  }
  if (expectations.expectedLevel && !snapshot.levels.includes(expectations.expectedLevel)) {
    failUiAcceptance(`${mode} exam rival panel did not include level ${expectations.expectedLevel}.`);
  }
  if (snapshot.latestRows < snapshot.rivalIds.length || snapshot.statusRows < snapshot.rivalIds.length) {
    failUiAcceptance(`${mode} exam rival panel is missing latest result or status rows.`);
  }

  const layoutFailures = getGameLayoutFailures(await readGameLayoutMetrics(page), `${mode} exam rival`);
  if (layoutFailures.length) {
    failUiAcceptance(layoutFailures.join(" "));
  }
  return snapshot;
}

async function runRelationshipTurnAcceptance(page) {
  const beforeRelationship = await page.locator(
    '#relationship-panel .relationship-contact[data-contact-type="character"][data-contact-id="C01"]'
  ).getAttribute("data-relationship");

  await page.locator("#action-input").fill("研读经书，向塾师请益");
  await page.locator("#action-btn").click();
  await page.waitForFunction(() => {
    const button = document.querySelector("#action-btn");
    return button && !button.disabled;
  }, null, { timeout: 15000 });
  await page.locator(".relationship-change").first().waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#narrative .world-tick").last().waitFor({ state: "visible", timeout: 10000 });
  const worldTickText = await page.locator("#narrative .world-tick").last().innerText();
  assertTenDayDateText(worldTickText, "relationship turn world tick");

  const afterRelationship = await page.locator(
    '#relationship-panel .relationship-contact[data-contact-type="character"][data-contact-id="C01"]'
  ).getAttribute("data-relationship");
  if (Number(afterRelationship) <= Number(beforeRelationship)) {
    failUiAcceptance(`relationship panel did not update mentor relationship after a Mock turn (${beforeRelationship} -> ${afterRelationship}).`);
  }
}

async function assertFailedSseRollback(page) {
  const leakedText = "未入史流文";
  const errorText = "stream schema failed";

  await page.evaluate(({ leakedText: pendingText, errorText: failureText }) => {
    const originalFetch = window.fetch.bind(window);
    window.__qianqiuRestoreFetch = () => {
      window.fetch = originalFetch;
      delete window.__qianqiuRestoreFetch;
    };
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("/api/game/turn")) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`event: narrative_chunk\ndata: ${JSON.stringify({ text: pendingText })}\n\n`));
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: failureText })}\n\n`));
            controller.close();
          }
        });
        return Promise.resolve(new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" }
        }));
      }
      return originalFetch(input, init);
    };
  }, { leakedText, errorText });

  try {
    await page.locator("#action-input").fill("触发失败流式回合");
    await page.locator("#action-btn").click();
    await page.waitForFunction(() => {
      const button = document.querySelector("#action-btn");
      return button && !button.disabled;
    }, null, { timeout: 15000 });

    const narrativeText = await page.locator("#narrative").innerText();
    if (narrativeText.includes(leakedText)) {
      failUiAcceptance("failed SSE narrative kept uncommitted streamed text in the browser history.");
    }
    if (!narrativeText.includes(errorText)) {
      failUiAcceptance("failed SSE rollback did not render the stream error message.");
    }
  } finally {
    await page.evaluate(() => {
      if (typeof window.__qianqiuRestoreFetch === "function") {
        window.__qianqiuRestoreFetch();
      }
    });
  }
}

async function assertSaveList(page, mode, { expectedIds = [], hiddenIds = [], modal = false } = {}) {
  const scope = modal ? "#save-list-modal" : "#save-list-panel";
  await page.locator(scope).waitFor({ state: "visible", timeout: 10000 });
  await page.locator(`${scope} .save-card`).first().waitFor({ state: "visible", timeout: 10000 });

  const actualIds = await page.locator(`${scope} .save-card`).evaluateAll((cards) =>
    cards.map((card) => card.dataset.saveId).filter(Boolean)
  );
  const missingIds = getMissingSaveIds(actualIds, expectedIds);
  if (missingIds.length) {
    failUiAcceptance(`${mode} save list missing save ids: ${missingIds.join(", ")}.`);
  }
  const hiddenLeaks = getHiddenSaveIdLeaks(actualIds, hiddenIds);
  if (hiddenLeaks.length) {
    failUiAcceptance(`${mode} save list leaked hidden save ids: ${hiddenLeaks.join(", ")}.`);
  }

  const text = await page.locator(scope).innerText();
  ["worldState", "relationshipLedger", "hiddenContacts", "provider", "prompt"].forEach((token) => {
    if (text.includes(token)) {
      failUiAcceptance(`${mode} save list leaked raw storage detail: ${token}.`);
    }
  });
  assertTenDayDateText(text, `${mode} save list`);

  const gameLayoutFailures = getGameLayoutFailures(await readGameLayoutMetrics(page), mode);
  const saveFailures = gameLayoutFailures.filter((failure) => /save-list/.test(failure));
  if (saveFailures.length) {
    failUiAcceptance(saveFailures.join(" "));
  }
}

async function assertStartPageSaveLoad(browser, { baseUrl, sessionId, pageErrors }) {
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await openCleanStartPage(page, baseUrl);
    await assertSaveList(page, "desktop start page", { expectedIds: [sessionId] });
    await page.locator(`#save-list-panel .save-card[data-save-id="${sessionId}"] button`).click();
    await page.locator("#action-area").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#scholar-panel").waitFor({ state: "visible", timeout: 10000 });
    const loadedId = await page.evaluate(() => window.localStorage.getItem("qianqiu.sessionId"));
    if (loadedId !== sessionId) {
      failUiAcceptance(`start-page save load wrote ${loadedId || "no"} localStorage id instead of ${sessionId}.`);
    }
    await assertGameLayout(page, "desktop start-page save load");
  } finally {
    await context.close();
  }
}

async function assertGameSaveModal(page, sessionId) {
  await page.locator("#save-list-open").click();
  await page.locator("#save-backdrop").waitFor({ state: "visible", timeout: 10000 });
  await assertSaveList(page, "desktop game save modal", { expectedIds: [sessionId], modal: true });
  await page.locator("#save-close").click();
  await page.locator("#save-backdrop").waitFor({ state: "hidden", timeout: 10000 });
}

async function assertGameLayout(page, mode) {
  await assertNoHorizontalOverflow(page, `${mode} game layout`);

  const isMobileMode = String(mode).startsWith("mobile");
  const viewport = page.viewportSize();
  const status = await visibleBox(page, "#status-strip", `${mode} status strip`);
  const scholar = await visibleBox(page, "#scholar-panel", `${mode} role panel`);
  const narrativeBox = await visibleBox(page, "#narrative", `${mode} narrative`);
  const actionArea = await visibleBox(page, "#action-area", `${mode} action area`);
  const actionInput = await visibleBox(page, "#action-input", `${mode} action input`);
  const actionButton = await visibleBox(page, "#action-btn", `${mode} action button`);

  if (!rectWithinViewport(actionArea, viewport, isMobileMode ? 3 : 12)) {
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
      startDisplay: start.display,
      statusText: document.querySelector("#status-strip")?.innerText || ""
    };
  });

  if (computed.startDisplay !== "none") {
    failUiAcceptance(`${mode} start panel is still occupying the game view.`);
  }
  if (computed.actionDisplay !== "flex") {
    failUiAcceptance(`${mode} action area is not using the expected flex layout.`);
  }
  assertTenDayDateText(computed.statusText, `${mode} status strip`);

  const gameLayoutFailures = getGameLayoutFailures(await readGameLayoutMetrics(page), mode);
  if (gameLayoutFailures.length) {
    failUiAcceptance(gameLayoutFailures.join(" "));
  }

  if (isMobileMode) {
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
  const sceneTools = await visibleBox(page, "#exam-scene-tools", `${mode} exam scene tools`);
  const tools = await visibleBox(page, "#exam-writing-tools", `${mode} exam writing tools`);
  const essay = await visibleBox(page, "#exam-essay", `${mode} exam essay textarea`);
  const submit = await visibleBox(page, "#exam-submit", `${mode} exam submit button`);

  if (!rectWithinViewport(modal, viewport, mode === "mobile" ? 8 : 30)) {
    failUiAcceptance(`${mode} exam modal does not fit inside the viewport.`);
  }
  if (rectsOverlap(question, requirements)) {
    failUiAcceptance(`${mode} exam question overlaps the requirements list.`);
  }
  if (rectsOverlap(requirements, sceneTools)) {
    failUiAcceptance(`${mode} exam requirements overlap the scene tools.`);
  }
  if (rectsOverlap(sceneTools, tools)) {
    failUiAcceptance(`${mode} exam scene tools overlap the writing tools.`);
  }
  if (rectsOverlap(tools, essay)) {
    failUiAcceptance(`${mode} exam writing tools overlap the essay textarea.`);
  }
  if (rectsOverlap(essay, submit)) {
    failUiAcceptance(`${mode} exam essay textarea overlaps the submit button.`);
  }
  const hasCalendarRequirement = await page.evaluate(() =>
    [...document.querySelectorAll("#exam-requirements li")].some((item) => item.textContent.includes("科期"))
  );
  if (!hasCalendarRequirement) {
    failUiAcceptance(`${mode} exam modal is missing calendar timing details.`);
  }

  const sceneState = await page.evaluate(() => {
    const status = document.querySelector("#exam-scene-status")?.textContent || "";
    return {
      actionCount: document.querySelectorAll("[data-exam-action]").length,
      hasStatus: status.includes("场内阶段"),
      modalText: document.querySelector(".exam-modal")?.innerText || "",
      status
    };
  });
  if (!sceneState.hasStatus || sceneState.actionCount < 4) {
    failUiAcceptance(`${mode} exam modal is missing scene phase controls.`);
  }
  const dateFailures = getTenDayDateFailures({
    "exam modal": sceneState.modalText,
    "exam scene status": sceneState.status
  }, mode);
  if (dateFailures.length) {
    failUiAcceptance(dateFailures.join(" "));
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
      calendarArchive: document.querySelectorAll(".exam-calendar-archive").length,
      persistentCandidateNotes: [...document.querySelectorAll(".candidate-profile .candidate-meta")]
        .filter((item) => item.textContent.includes("科场旧识")).length,
      essayDisplay: examEssay ? getComputedStyle(examEssay).display : "",
      questionDisplay: examQuestion ? getComputedStyle(examQuestion).display : "",
      requirementsDisplay: examRequirements ? getComputedStyle(examRequirements).display : "",
      playerArchive: document.querySelectorAll(".player-exam-archive").length,
      playerRanking: document.querySelectorAll(".ranking-list .is-player").length,
      resultText: resultElement?.innerText || "",
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
  if (counts.calendarArchive < 1) {
    failUiAcceptance(`${mode} missing exam calendar archive details.`);
  }
  assertTenDayDateText(counts.resultText, `${mode} exam result`);
  if (counts.persistentCandidateNotes < 1) {
    failUiAcceptance(`${mode} missing persistent rival notes on candidate profiles.`);
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

function buildBrowserSmokeEssay(level = "child_exam") {
  const repeatCount = {
    child_exam: 2,
    provincial_exam: 5,
    metropolitan_exam: 8,
    palace_exam: 7
  }[level] || 5;
  const paragraph = [
    "夫治民者，当以仁义为本，以礼法为纲。",
    "臣闻民为邦本，本固则邦宁。",
    "故一曰宽赋以养民力，二曰明经以正士风，三曰择吏以清县政。",
    "盖仓廪足而礼义兴，学校修而风俗厚。",
    "是以为学不徒章句，必施于乡里；为政不尚苛急，必本于爱民。",
    "谨按古今治道，皆贵循序渐进，先修身而后齐家，先教化而后刑罚。",
    "由是观之，士子临文，宜明道义，陈利弊，守中正，不为浮辞。"
  ].join("");
  return Array.from({ length: repeatCount }, () => paragraph).join("");
}

function buildBrowserCheatingEssay() {
  return "学而时习之不亦说乎。学而时习之不亦说乎。";
}

async function prepareSessionForExam(sessionId, level) {
  const worldState = await readSession(sessionId);
  if (worldState.activeExam) {
    failUiAcceptance(`session ${sessionId} already has an active exam before opening ${level}.`);
  }

  worldState.month = examOpenMonthByLevel[level] || 1;
  worldState.tenDayPeriod = 3;
  worldState.player.gold = Math.max(worldState.player.gold || 0, 1000);
  worldState.player.health = 100;
  worldState.player.teacher = worldState.player.teacher || "顾文衡";
  worldState.player.academia = Math.max(worldState.player.academia || 0, 100);
  worldState.player.literaryTalent = Math.max(worldState.player.literaryTalent || 0, 100);
  worldState.player.adaptability = Math.max(worldState.player.adaptability || 0, 100);
  worldState.player.mentality = Math.max(worldState.player.mentality || 0, 100);
  worldState.player.reputation = Math.max(worldState.player.reputation || 0, 100);
  await writeSession(worldState);
  return worldState;
}

function assertLatestExamProgression(worldState, expectations, mode) {
  const history = Array.isArray(worldState.player?.examHistory) ? worldState.player.examHistory : [];
  const latest = history.at(-1);
  if (!latest || latest.level !== expectations.level) {
    failUiAcceptance(`${mode} latest exam history is not ${expectations.level}.`);
  }
  if (!latest.promotionResult?.passed) {
    failUiAcceptance(`${mode} did not pass ${expectations.level}.`);
  }

  const completedLevels = history.map((entry) => entry.level);
  const missingLevels = getMissingExamLevels(completedLevels, expectations.expectedCompletedLevels || []);
  if (missingLevels.length) {
    failUiAcceptance(`${mode} exam history is missing completed levels: ${missingLevels.join(", ")}.`);
  }
  if (worldState.player.examRank !== expectations.expectedRank) {
    failUiAcceptance(`${mode} expected exam rank ${expectations.expectedRank}, got ${worldState.player.examRank}.`);
  }
  if (worldState.player.role !== expectations.expectedRole) {
    failUiAcceptance(`${mode} expected role ${expectations.expectedRole}, got ${worldState.player.role}.`);
  }
  if (expectations.expectedOffice && !worldState.player.officeTitle) {
    failUiAcceptance(`${mode} palace pass did not seed an office title.`);
  }
  if (worldState.activeExam !== null) {
    failUiAcceptance(`${mode} left activeExam populated after submit.`);
  }
  return latest;
}

async function runExamLevelAcceptance(page, sessionId, recorder, expectations) {
  await prepareSessionForExam(sessionId, expectations.level);
  await page.locator("#scholar-panel .panel-action").first().click();
  await page.locator("#exam-backdrop").waitFor({ state: "visible", timeout: 10000 });
  await assertExamWritingLayout(page, `desktop ${expectations.level}`);
  if (expectations.modalScreenshotName) {
    await recorder.capture(page, expectations.modalScreenshotName);
  }

  const draftProbe = `草稿留存-${expectations.level}`;
  await page.locator("#exam-essay").fill(draftProbe);
  await page.locator("#exam-close").click();
  await page.locator("#exam-backdrop").waitFor({ state: "hidden", timeout: 10000 });
  await page.locator("#scholar-panel .panel-action").first().click();
  await page.locator("#exam-backdrop").waitFor({ state: "visible", timeout: 10000 });
  await assertExamWritingLayout(page, `desktop ${expectations.level} reopened`);
  const reopenedDraft = await page.locator("#exam-essay").inputValue();
  if (reopenedDraft !== draftProbe) {
    failUiAcceptance(`desktop ${expectations.level} did not preserve the in-progress exam draft.`);
  }

  await page.locator("#exam-essay").fill(buildBrowserSmokeEssay(expectations.level));
  await page.waitForFunction(() => {
    const button = document.querySelector("#exam-submit");
    return button && !button.disabled;
  });
  await page.locator("#exam-submit").click();
  await page.locator("#exam-result").waitFor({ state: "visible", timeout: 15000 });
  await assertExamResultLayout(page, `desktop ${expectations.level}`);
  await recorder.capture(page, expectations.resultScreenshotName || `desktop-${expectations.level}-result`);

  let worldState = await readSession(sessionId);
  const latest = assertLatestExamProgression(worldState, expectations, `desktop ${expectations.level}`);

  await page.locator("#exam-close").click();
  await page.locator("#exam-backdrop").waitFor({ state: "hidden", timeout: 10000 });
  await assertGameLayout(page, `desktop after ${expectations.level}`);

  if (expectations.expectedNextLevel) {
    await assertExamCalendarPanel(page, `desktop after ${expectations.level}`, {
      expectedNextLevel: expectations.expectedNextLevel
    });
  } else {
    await assertOfficialCareerPanel(page, "post-palace official", {
      expectedPosting: worldState.player.officeTitle,
      expectedBureauId: worldState.officialCareer?.bureauId,
      expectAssessment: true,
      expectNetwork: true,
      expectedImpeachmentStage: worldState.officialCareer?.impeachmentProcedure?.stage || "none"
    });
  }
  await assertExamRivalPanel(page, `desktop after ${expectations.level}`, {
    expectedLevel: expectations.level,
    minRivals: 1
  });

  worldState = await readSession(sessionId);
  return { latest, worldState };
}

async function runRemainingExamProgressionAcceptance(page, sessionId, recorder) {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.waitForTimeout(150);
  const results = [];

  for (const expectations of examProgressionCases.slice(1)) {
    results.push(await runExamLevelAcceptance(page, sessionId, recorder, expectations));
  }

  const finalState = results.at(-1)?.worldState || await readSession(sessionId);
  if (finalState.player.role !== "official" || finalState.player.examHistory.length < 4) {
    failUiAcceptance("complete exam progression did not finish as an official with four exam records.");
  }
  await assertOfficialCareerPanel(page, "complete exam progression official", {
    expectedPosting: finalState.player.officeTitle,
    expectedBureauId: finalState.officialCareer?.bureauId,
    expectAssessment: true,
    expectNetwork: true,
    expectedImpeachmentStage: finalState.officialCareer?.impeachmentProcedure?.stage || "none"
  });
  await assertRelationshipPanel(page, "complete exam progression official", {
    expectedIds: ["C01", "scholarOfficials"],
    expectedTypes: ["character", "faction"]
  });
  await recorder.capture(page, "desktop-post-palace-official");

  return {
    finalRank: finalState.player.examRank,
    finalRole: finalState.player.role,
    levels: finalState.player.examHistory.map((entry) => entry.level),
    officeTitle: finalState.player.officeTitle,
    bureauId: finalState.officialCareer?.bureauId,
    impeachmentStage: finalState.officialCareer?.impeachmentProcedure?.stage || "none"
  };
}

async function runMobileUiAcceptance(page, recorder) {
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);
  await assertGameLayout(page, "mobile");
  await assertRelationshipPanel(page, "mobile scholar", {
    expectedIds: ["C01", "scholarOfficials"],
    expectedTypes: ["character", "faction"],
    hiddenIds: ["eunuchs", "militaryLords"],
    hiddenTextTokens: ["Eunuch faction", "Military faction"]
  });
  await assertExamCalendarPanel(page, "mobile scholar");
  await assertExamRivalPanel(page, "mobile scholar", {
    expectedLevel: "child_exam",
    minRivals: 1
  });
  await assertActiveNpcRequestPanel(page, "mobile scholar", {
    expectedTargetIds: ["C01"],
    expectedTargetTypes: ["character"],
    hiddenTargetIds: ["eunuchs", "militaryLords"],
    hiddenTextTokens: ["Eunuch faction", "Military faction"]
  });
  await assertWorldThreadPanel(page, "mobile scholar", {
    expectActive: true,
    expectedKinds: ["npc_request"],
    expectedSourceTypes: ["active_npc_request"],
    hiddenTextTokens: ["Hidden Palace Thread", "sealed palace dossier", "C99-hidden", "hiddenNotes"]
  });
  await assertInformationPanelShell(page, "mobile scholar", {
    hiddenTextTokens: ["Hidden Palace Thread", "sealed palace dossier", "C99-hidden", "hiddenNotes", "OPENAI_API_KEY", "data/sessions"],
    expectEventArchiveReady: false
  });
  await recorder.capture(page, "mobile-game-layout");

  await page.locator("#scholar-panel .archive-action").first().click();
  await page.locator("#exam-backdrop").waitFor({ state: "visible", timeout: 10000 });
  await assertExamResultLayout(page, "mobile archive");
  await recorder.capture(page, "mobile-exam-archive");
  await page.locator("#exam-close").click();
  await page.locator("#exam-backdrop").waitFor({ state: "hidden", timeout: 10000 });
}

async function runFinalMobileOfficialAcceptance(page, recorder, expectations = {}) {
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);
  await assertGameLayout(page, "mobile post-palace official");
  await assertOfficialCareerPanel(page, "mobile post-palace official", {
    expectedPosting: expectations.expectedPosting,
    expectedBureauId: expectations.expectedBureauId,
    expectAssessment: true,
    expectNetwork: true,
    expectedImpeachmentStage: expectations.expectedImpeachmentStage || "none"
  });
  await assertRelationshipPanel(page, "mobile post-palace official", {
    expectedIds: ["C01", "scholarOfficials"],
    expectedTypes: ["character", "faction"]
  });
  await assertExamRivalPanel(page, "mobile post-palace official", {
    expectedLevel: "palace_exam",
    minRivals: 1
  });
  await recorder.capture(page, "mobile-post-palace-official");

  await page.locator("#scholar-panel .archive-action").first().click();
  await page.locator("#exam-backdrop").waitFor({ state: "visible", timeout: 10000 });
  await assertExamResultLayout(page, "mobile final archive");
  const archiveLevels = await page.evaluate(() => {
    document.querySelectorAll(".exam-archive-list .result-section").forEach((details) => {
      details.open = true;
    });
    return [...document.querySelectorAll(".exam-archive-entry .exam-calendar-archive")]
      .map((entry) => entry.innerText)
      .join("\n");
  });
  for (const label of ["童试", "乡试", "会试", "殿试"]) {
    const archiveText = await page.locator("#exam-result").innerText();
    if (!archiveText.includes(label) && !archiveLevels.includes(label)) {
      failUiAcceptance(`mobile final archive is missing ${label}.`);
    }
  }
  await recorder.capture(page, "mobile-final-exam-archive");
  await page.locator("#exam-close").click();
  await page.locator("#exam-backdrop").waitFor({ state: "hidden", timeout: 10000 });
}

async function runOfficialStartAcceptance(browser, { baseUrl, onSessionId, pageErrors, recorder = null }) {
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  let officialSessionId = null;

  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await openCleanStartPage(page, baseUrl);
    await assertStartRoleOptions(page);

    await page.locator('input[name="dynasty"]').fill("Ming");
    await page.locator('input[name="year"]').fill("1644");
    await page.locator('select[name="role"]').selectOption("official");
    await page.locator('input[name="playerName"]').fill("Browser Official");
    await page.locator('input[name="background"]').fill("newly ranked jinshi");
    await page.locator('textarea[name="customSetting"]').fill("official direct start acceptance run");
    await page.locator('#start-form button[type="submit"]').click();

    await page.locator("#action-area").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#scholar-panel").waitFor({ state: "visible", timeout: 10000 });
    officialSessionId = await page.evaluate(() => window.localStorage.getItem("qianqiu.sessionId"));
    if (!officialSessionId) throw new Error("Official start did not write qianqiu.sessionId to localStorage.");
    onSessionId(officialSessionId);

    const rolePanelText = await page.locator("#scholar-panel").innerText();
    if (!rolePanelText.includes("入仕官员") || !rolePanelText.includes("候选观政")) {
      throw new Error("Official start did not render the official role panel.");
    }
    await assertOfficialCareerPanel(page, "official start", {
      expectedPosting: "候选观政",
      expectedBureauId: "ministry_personnel",
      expectAssessment: true,
      expectNetwork: true,
      expectedImpeachmentStage: "none"
    });
    await assertRelationshipPanel(page, "official start", {
      expectedIds: ["C01", "eunuchs", "scholarOfficials", "militaryLords"],
      expectedTypes: ["character", "faction"]
    });

    const actionPlaceholder = await page.locator("#action-input").getAttribute("placeholder");
    if (!actionPlaceholder || !actionPlaceholder.includes("奉上官")) {
      throw new Error("Official start did not render the official action placeholder.");
    }

    const stateResponse = await fetch(`${baseUrl}/api/game/state/${officialSessionId}`);
    if (!stateResponse.ok) {
      throw new Error(`Official start session is not readable through the API: ${stateResponse.status}`);
    }
    const statePayload = await stateResponse.json();
    if (statePayload.worldState?.player?.role !== "official") {
      throw new Error("Official start API state did not persist player.role = official.");
    }

    await page.locator("#action-input").fill("奉上官考成请求实授");
    await page.locator("#action-btn").click();
    await page.waitForFunction(() => {
      const button = document.querySelector("#action-btn");
      return button && !button.disabled;
    }, null, { timeout: 15000 });
    await page.locator(".official-career-event").first().waitFor({ state: "visible", timeout: 10000 });
    const careerSnapshot = await assertOfficialCareerPanel(page, "official outcome", {
      expectOutcome: true,
      expectedTypes: ["appointment"],
      expectedPosting: "六部观政进士",
      expectedBureauId: "ministry_personnel",
      expectAssessment: true,
      expectNetwork: true,
      expectedImpeachmentStage: "none"
    });
    if (!careerSnapshot.outcomeStatuses.includes("current")) {
      throw new Error("Official career panel did not mark the latest outcome as current.");
    }
    if (recorder) {
      await recorder.capture(page, "official-career-outcome");
    }

    await page.locator("#action-input").fill("督办赈灾与赈银核销");
    await page.locator("#action-btn").click();
    await page.waitForFunction(() => {
      const button = document.querySelector("#action-btn");
      return button && !button.disabled;
    }, null, { timeout: 15000 });
    await page.waitForFunction(
      () => document.body.innerText.includes("[官场差遣]"),
      null,
      { timeout: 10000 }
    );
    await assertOfficialCareerPanel(page, "official assignment", {
      expectedBureauId: "ministry_personnel",
      expectAssignment: true,
      expectedAssignmentKinds: ["relief"],
      expectedAssignmentStatuses: ["active", "submitted"],
      expectAssessment: true,
      expectNetwork: true,
      expectedImpeachmentStage: "none",
      hiddenTextTokens: ["hiddenNotes", "有人暗中遮掩亏空", "密札指向上官"]
    });
    await assertWorldThreadPanel(page, "official assignment", {
      expectActive: true,
      expectedKinds: ["official_assignment"],
      expectedSourceTypes: ["official_assignment"],
      expectedStatuses: ["active", "watch"],
      hiddenTextTokens: ["hiddenNotes", "有人暗中遮掩亏空", "密札指向上官"]
    });
    await assertInformationPanelShell(page, "official assignment", {
      hiddenTextTokens: ["hiddenNotes", "有人暗中遮掩亏空", "密札指向上官", "OPENAI_API_KEY", "data/sessions"],
      expectEventArchiveReady: false
    });

    return {
      sessionId: officialSessionId,
      statusText: (await page.locator("#status-strip").innerText()).replace(/\s+/g, " ").trim()
    };
  } finally {
    await context.close();
  }
}

async function runCheatingExamAcceptance(browser, { baseUrl, onSessionId, pageErrors, recorder = null }) {
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  let cheatingSessionId = null;

  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await openCleanStartPage(page, baseUrl);
    await assertStartRoleOptions(page);

    await page.locator('input[name="dynasty"]').fill("Ming");
    await page.locator('input[name="year"]').fill("1644");
    await page.locator('select[name="role"]').selectOption("scholar");
    await page.locator('input[name="playerName"]').fill("Browser Cheating");
    await page.locator('input[name="background"]').fill("county school student");
    await page.locator('textarea[name="customSetting"]').fill("S38 cheating acceptance run");
    await page.locator('#start-form button[type="submit"]').click();

    await page.locator("#action-area").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#scholar-panel").waitFor({ state: "visible", timeout: 10000 });
    cheatingSessionId = await page.evaluate(() => window.localStorage.getItem("qianqiu.sessionId"));
    if (!cheatingSessionId) throw new Error("Cheating start did not write qianqiu.sessionId to localStorage.");
    onSessionId(cheatingSessionId);

    await prepareSessionForExam(cheatingSessionId, "child_exam");
    await page.locator("#scholar-panel .panel-action").first().click();
    await page.locator("#exam-backdrop").waitFor({ state: "visible", timeout: 10000 });
    await assertExamWritingLayout(page, "desktop cheating sample");
    await page.locator("#exam-essay").fill(buildBrowserCheatingEssay());
    await page.waitForFunction(() => {
      const button = document.querySelector("#exam-submit");
      return button && !button.disabled;
    });
    await page.locator("#exam-submit").click();
    await page.locator("#exam-result").waitFor({ state: "visible", timeout: 15000 });
    await assertExamResultLayout(page, "desktop cheating result");

    const resultText = `${await page.locator("#exam-title").innerText()}\n${await page.locator("#exam-result").innerText()}`;
    if (!resultText.includes("监试黜落") || !resultText.includes("疑似照抄")) {
      failUiAcceptance("cheating result did not show severe copy punishment in the browser.");
    }

    const worldState = await readSession(cheatingSessionId);
    const latest = worldState.player.examHistory?.at(-1);
    if (!latest || latest.level !== "child_exam") {
      failUiAcceptance("cheating sample did not persist a child exam history entry.");
    }
    if (latest.score?.overall_score !== 0 || latest.promotionResult?.severeCheat !== true) {
      failUiAcceptance("cheating sample did not force score 0 with severeCheat=true.");
    }
    if (worldState.player.examRank !== null || worldState.player.role !== "scholar") {
      failUiAcceptance("cheating sample advanced the scholar despite severe copying.");
    }
    if (recorder) {
      await recorder.capture(page, "desktop-cheating-result");
    }

    return {
      sessionId: cheatingSessionId,
      level: latest.level,
      score: latest.score.overall_score,
      severeCheat: true
    };
  } finally {
    await context.close();
  }
}

async function fetchSessionState(baseUrl, sessionId) {
  const response = await fetch(`${baseUrl}/api/game/state/${sessionId}`);
  if (!response.ok) {
    throw new Error(`Session ${sessionId} is not readable through the API: ${response.status}`);
  }
  return response.json();
}

function readStatePath(state, pathExpression) {
  return pathExpression.split(".").reduce((value, segment) => value?.[segment], state);
}

function assertMetricDirection(beforeState, afterState, pathExpression, direction, label) {
  const before = readStatePath(beforeState, pathExpression);
  const after = readStatePath(afterState, pathExpression);
  if (typeof before !== "number" || typeof after !== "number") {
    failUiAcceptance(`${label} metric ${pathExpression} was not numeric before and after the role-world turn.`);
  }

  if (direction === "increase" && after <= before) {
    failUiAcceptance(`${label} expected ${pathExpression} to increase after role-world coupling (${before} -> ${after}).`);
  }
  if (direction === "decrease" && after >= before) {
    failUiAcceptance(`${label} expected ${pathExpression} to decrease after role-world coupling (${before} -> ${after}).`);
  }
  if (direction === "change" && after === before) {
    failUiAcceptance(`${label} expected ${pathExpression} to change after role-world coupling (${before} -> ${after}).`);
  }
}

async function startDirectRolePage(context, baseUrl, role, playerName, pageErrors) {
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openCleanStartPage(page, baseUrl);
  await assertStartRoleOptions(page);

  await page.locator('input[name="dynasty"]').fill("Ming");
  await page.locator('input[name="year"]').fill("1644");
  await page.locator('select[name="role"]').selectOption(role);
  await page.locator('input[name="playerName"]').fill(playerName);
  await page.locator('input[name="background"]').fill(`${role} role-world acceptance`);
  await page.locator('textarea[name="customSetting"]').fill("S36 browser role-world acceptance run");
  await page.locator('#start-form button[type="submit"]').click();

  await page.locator("#action-area").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#scholar-panel").waitFor({ state: "visible", timeout: 10000 });
  const sessionId = await page.evaluate(() => window.localStorage.getItem("qianqiu.sessionId"));
  if (!sessionId) throw new Error(`${role} role-world start did not write qianqiu.sessionId to localStorage.`);
  return { page, sessionId };
}

async function submitTurnAndWaitForIdle(page, action, feedbackSelector) {
  await page.locator("#action-input").fill(action);
  await page.locator("#action-btn").click();
  await page.waitForFunction(() => {
    const button = document.querySelector("#action-btn");
    return button && !button.disabled;
  }, null, { timeout: 15000 });
  await page.locator(feedbackSelector).first().waitFor({ state: "visible", timeout: 10000 });
}

async function runRoleWorldCouplingAcceptance(browser, { baseUrl, onSessionId, pageErrors, recorder = null }) {
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const sessionIds = [];
  const observedKinds = [];

  try {
    for (const acceptanceCase of roleWorldAcceptanceCases) {
      const { page, sessionId } = await startDirectRolePage(
        context,
        baseUrl,
        acceptanceCase.role,
        acceptanceCase.playerName,
        pageErrors
      );
      sessionIds.push(sessionId);
      onSessionId(sessionId);

      const beforePayload = await fetchSessionState(baseUrl, sessionId);
      const selector = `.role-world-event[data-role-world-kind="${acceptanceCase.expectedKind}"]`;
      await submitTurnAndWaitForIdle(page, acceptanceCase.action, selector);
      const afterPayload = await fetchSessionState(baseUrl, sessionId);

      const roleWorldKinds = await page.locator(".role-world-event").evaluateAll((events) =>
        events.map((event) => event.dataset.roleWorldKind).filter(Boolean)
      );
      const missingKinds = getMissingRoleWorldKinds(roleWorldKinds, [acceptanceCase.expectedKind]);
      if (missingKinds.length) {
        failUiAcceptance(`${acceptanceCase.role} role-world feedback missing kinds: ${missingKinds.join(", ")}.`);
      }
      observedKinds.push(...roleWorldKinds);

      assertMetricDirection(
        beforePayload.worldState,
        afterPayload.worldState,
        acceptanceCase.metricPath,
        acceptanceCase.direction,
        acceptanceCase.role
      );
      if (afterPayload.worldState?.roleWorldCoupling?.recentImpacts?.at(-1)?.kind !== acceptanceCase.expectedKind) {
        failUiAcceptance(`${acceptanceCase.role} role-world state did not persist ${acceptanceCase.expectedKind}.`);
      }
      await assertGameLayout(page, `${acceptanceCase.role} role-world`);
      await assertWorldThreadPanel(page, `${acceptanceCase.role} role-world`, {
        expectActive: true,
        expectedKinds: [acceptanceCase.expectedThreadKind],
        expectedSourceTypes: ["role_world_coupling"]
      });
      await assertInformationPanelShell(page, `${acceptanceCase.role} role-world`, {
        hiddenTextTokens: ["hiddenNotes", "OPENAI_API_KEY", "data/sessions"],
        expectEventArchiveReady: false
      });

      if (recorder && acceptanceCase.role === "magistrate") {
        await recorder.capture(page, "role-world-coupling");
      }
      await page.close();
    }

    const expectedKinds = roleWorldAcceptanceCases.map((acceptanceCase) => acceptanceCase.expectedKind);
    const missingKinds = getMissingRoleWorldKinds(observedKinds, expectedKinds);
    if (missingKinds.length) {
      failUiAcceptance(`role-world acceptance missing expected kinds: ${missingKinds.join(", ")}.`);
    }

    return {
      sessionIds,
      kinds: [...new Set(observedKinds)]
    };
  } finally {
    await context.close();
  }
}

async function runBrowserJourney({
  baseUrl,
  browserPath,
  checkAiConnection = false,
  expectedAiConnectionProvider = null,
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
  const sessionIds = [];

  try {
    const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openCleanStartPage(page, baseUrl);
    await assertStartRoleOptions(page);
    const aiConnection = checkAiConnection
      ? await assertAiConnectionPanel(page, "start-page AI connection", {
        expectedProvider: expectedAiConnectionProvider,
        hiddenTextTokens: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY", "ANTHROPIC_API_KEY", "data/sessions"]
      })
      : null;

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
    sessionIds.push(sessionId);
    onSessionId(sessionId);

    await assertGameLayout(page, "desktop");
    await assertGameSaveModal(page, sessionId);
    await assertStartPageSaveLoad(browser, { baseUrl, sessionId, pageErrors });
    await assertFailedSseRollback(page);
    await assertRelationshipPanel(page, "desktop scholar", {
      expectedIds: ["C01", "scholarOfficials"],
      expectedTypes: ["character", "faction"],
      hiddenIds: ["eunuchs", "militaryLords"],
      hiddenTextTokens: ["Eunuch faction", "Military faction"]
    });
    await assertExamCalendarPanel(page, "desktop scholar", {
      expectedNextLevel: "child_exam",
      expectedStatus: "open"
    });
    await runRelationshipTurnAcceptance(page);
    await assertRelationshipPanel(page, "desktop scholar after turn", {
      expectedIds: ["C01", "scholarOfficials"],
      expectedTypes: ["character", "faction"],
      hiddenIds: ["eunuchs", "militaryLords"],
      hiddenTextTokens: ["Eunuch faction", "Military faction"]
    });
    await assertActiveNpcRequestPanel(page, "desktop scholar after turn", {
      expectedTargetIds: ["C01"],
      expectedTargetTypes: ["character"],
      hiddenTargetIds: ["eunuchs", "militaryLords"],
      hiddenTextTokens: ["Eunuch faction", "Military faction"]
    });
    await assertWorldThreadPanel(page, "desktop scholar after turn", {
      expectActive: true,
      expectedKinds: ["npc_request"],
      expectedSourceTypes: ["active_npc_request"],
      expectedStatuses: ["active"],
      hiddenTextTokens: ["Hidden Palace Thread", "sealed palace dossier", "C99-hidden", "hiddenNotes"]
    });
    await assertInformationPanelShell(page, "desktop scholar after turn", {
      hiddenTextTokens: ["Hidden Palace Thread", "sealed palace dossier", "C99-hidden", "hiddenNotes", "OPENAI_API_KEY", "data/sessions"],
      expectEventArchiveReady: false
    });
    await recorder.capture(page, "desktop-game-layout");
    await runExamLevelAcceptance(page, sessionId, recorder, examProgressionCases[0]);
    await assertExamRivalPanel(page, "desktop scholar after exam", {
      expectedLevel: "child_exam",
      minRivals: 1
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#action-area").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#scholar-panel").waitFor({ state: "visible", timeout: 10000 });
    await assertGameLayout(page, "desktop restored");
    await assertRelationshipPanel(page, "desktop restored scholar", {
      expectedIds: ["C01", "scholarOfficials"],
      expectedTypes: ["character", "faction"],
      hiddenIds: ["eunuchs", "militaryLords"],
      hiddenTextTokens: ["Eunuch faction", "Military faction"]
    });
    await assertExamCalendarPanel(page, "desktop restored scholar");
    await assertExamRivalPanel(page, "desktop restored scholar", {
      expectedLevel: "child_exam",
      minRivals: 1
    });
    await assertActiveNpcRequestPanel(page, "desktop restored scholar", {
      expectedTargetIds: ["C01"],
      expectedTargetTypes: ["character"],
      hiddenTargetIds: ["eunuchs", "militaryLords"],
      hiddenTextTokens: ["Eunuch faction", "Military faction"]
    });
    await assertWorldThreadPanel(page, "desktop restored scholar", {
      expectActive: true,
      expectedKinds: ["npc_request"],
      expectedSourceTypes: ["active_npc_request"],
      hiddenTextTokens: ["Hidden Palace Thread", "sealed palace dossier", "C99-hidden", "hiddenNotes"]
    });
    await assertInformationPanelShell(page, "desktop restored scholar", {
      hiddenTextTokens: ["Hidden Palace Thread", "sealed palace dossier", "C99-hidden", "hiddenNotes", "OPENAI_API_KEY", "data/sessions"],
      expectEventArchiveReady: false
    });

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
    await assertRelationshipPanel(freshPage, "fresh page desktop scholar", {
      expectedIds: ["C01", "scholarOfficials"],
      expectedTypes: ["character", "faction"],
      hiddenIds: ["eunuchs", "militaryLords"],
      hiddenTextTokens: ["Eunuch faction", "Military faction"]
    });
    await assertExamCalendarPanel(freshPage, "fresh page desktop scholar");
    await assertExamRivalPanel(freshPage, "fresh page desktop scholar", {
      expectedLevel: "child_exam",
      minRivals: 1
    });
    await assertActiveNpcRequestPanel(freshPage, "fresh page desktop scholar", {
      expectedTargetIds: ["C01"],
      expectedTargetTypes: ["character"],
      hiddenTargetIds: ["eunuchs", "militaryLords"],
      hiddenTextTokens: ["Eunuch faction", "Military faction"]
    });
    await assertWorldThreadPanel(freshPage, "fresh page desktop scholar", {
      expectActive: true,
      expectedKinds: ["npc_request"],
      expectedSourceTypes: ["active_npc_request"],
      hiddenTextTokens: ["Hidden Palace Thread", "sealed palace dossier", "C99-hidden", "hiddenNotes"]
    });
    await assertInformationPanelShell(freshPage, "fresh page desktop scholar", {
      hiddenTextTokens: ["Hidden Palace Thread", "sealed palace dossier", "C99-hidden", "hiddenNotes", "OPENAI_API_KEY", "data/sessions"],
      expectEventArchiveReady: false
    });
    const freshPageId = await freshPage.evaluate(() => window.localStorage.getItem("qianqiu.sessionId"));
    if (freshPageId !== sessionId) {
      throw new Error(`Fresh page localStorage session mismatch: expected ${sessionId}, got ${freshPageId}`);
    }
    await freshPage.close();

    await runMobileUiAcceptance(page, recorder);

    const examProgression = await runRemainingExamProgressionAcceptance(page, sessionId, recorder);
    await runFinalMobileOfficialAcceptance(page, recorder, {
      expectedPosting: examProgression.officeTitle,
      expectedBureauId: examProgression.bureauId,
      expectedImpeachmentStage: examProgression.impeachmentStage
    });

    const stateResponse = await fetch(`${baseUrl}/api/game/state/${sessionId}`);
    if (!stateResponse.ok) {
      throw new Error(`Restored session is not readable through the API: ${stateResponse.status}`);
    }

    const officialStart = await runOfficialStartAcceptance(browser, {
      baseUrl,
      onSessionId: (createdSessionId) => {
        sessionIds.push(createdSessionId);
        onSessionId(createdSessionId);
      },
      pageErrors,
      recorder
    });

    const cheatingExam = await runCheatingExamAcceptance(browser, {
      baseUrl,
      onSessionId: (createdSessionId) => {
        sessionIds.push(createdSessionId);
        onSessionId(createdSessionId);
      },
      pageErrors,
      recorder
    });

    const roleWorldCoupling = await runRoleWorldCouplingAcceptance(browser, {
      baseUrl,
      onSessionId: (createdSessionId) => {
        sessionIds.push(createdSessionId);
        onSessionId(createdSessionId);
      },
      pageErrors,
      recorder
    });

    if (pageErrors.length) {
      throw new Error(`Browser page errors detected: ${pageErrors.join("; ")}`);
    }

    const statusText = await page.locator("#status-strip").innerText();
    await context.close();

    const acceptanceAreas = [
      "desktop",
      "mobile",
      "four-exam-progression",
      "mobile-final-archive",
      "cheating-result",
      "official-start",
      "official-career",
      "world-thread",
      "role-world"
    ];
    if (aiConnection) acceptanceAreas.unshift("ai-connection");

    return {
      baseUrl,
      restored: true,
      sessionId,
      sessionIds,
      statusText: statusText.replace(/\s+/g, " ").trim(),
      aiConnection,
      examProgression,
      officialStart,
      cheatingExam,
      roleWorldCoupling,
      identityTurns: ["scholar", "official", ...roleWorldAcceptanceCases.map((acceptanceCase) => acceptanceCase.role)],
      uiAcceptance: {
        screenshots: recorder.summary(),
        viewports: acceptanceAreas
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
  const sessionIds = [];
  const baseUrl = options.url || null;

  try {
    server = baseUrl ? null : await startLocalServer();
    result = await runBrowserJourney({
      baseUrl: baseUrl || server.baseUrl,
      browserPath,
      checkAiConnection: Boolean(options.checkAiConnection),
      expectedAiConnectionProvider: baseUrl ? null : "mock",
      headed: options.headed,
      onSessionId: (createdSessionId) => {
        sessionIds.push(createdSessionId);
      },
      screenshotsDir: options.screenshotsDir
    });
    return result;
  } finally {
    const idsToClean = new Set([...(result?.sessionIds || []), result?.sessionId, ...sessionIds].filter(Boolean));
    for (const id of idsToClean) {
      await cleanupSession(id);
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
                    The S38 exam journey expects that server to share this repo's data/sessions directory.
  --browser <path>   Browser executable path. Defaults to BROWSER_EXECUTABLE_PATH or local Chrome/Edge.
  --screenshots <dir>
                    Save desktop/mobile UI acceptance screenshots to this directory.
  --check-ai-connection
                    Click the start-page AI connection diagnostic. The auto-started server uses Mock;
                    --url targets should enable this only when the target provider is intentionally checkable.
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
  buildBrowserCheatingEssay,
  buildBrowserSmokeEssay,
  createScreenshotRecorder,
  getAiConnectionPanelFailures,
  getDefaultBrowserCandidates,
  getGameLayoutFailures,
  getHiddenActiveRequestLeaks,
  getHiddenOfficialCareerTextLeaks,
  getHiddenWorldThreadTextLeaks,
  getHiddenSaveIdLeaks,
  getInformationPanelShellFailures,
  getTenDayDateFailures,
  getMissingExamLevels,
  getHiddenRelationshipLeaks,
  getMissingOfficialCareerAssignmentKinds,
  getMissingOfficialCareerAssignmentStatuses,
  getMissingOfficialCareerOutcomeTypes,
  getOfficialCareerPanelFailures,
  getMissingRoleWorldKinds,
  getMissingActiveRequestTargets,
  getMissingRelationshipEntries,
  getMissingSaveIds,
  getMissingStartRoles,
  getMissingWorldThreadKinds,
  getMissingWorldThreadSourceTypes,
  getWorldThreadPanelFailures,
  hasTenDayPeriodLabel,
  normalizeBaseUrl,
  parseBrowserSmokeArgs,
  rectsOverlap,
  resolveBrowserExecutable,
  sanitizeScreenshotName,
  runBrowserJourney,
  runBrowserSmoke
};
