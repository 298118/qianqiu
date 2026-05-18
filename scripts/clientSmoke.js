const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright-core");
const { app, hasReactClientBuild } = require("../server");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");
const {
  assertPngScreenshot,
  normalizeBaseUrl,
  resolveBrowserExecutable,
  sanitizeScreenshotName
} = require("./browserSmoke");

const VIEWPORTS = Object.freeze({
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 }
});

const hiddenTextTokens = Object.freeze([
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "MIMO_API_KEY",
  "ANTHROPIC_API_KEY",
  "hiddenNotes",
  "hiddenIntent",
  "data/sessions",
  "provider payload",
  "raw audit",
  "world_sessions",
  "prompt_retrieval_index"
]);

function parseClientSmokeArgs(argv = process.argv) {
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
      throw new Error(`Unknown client smoke argument: ${arg}`);
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

async function captureScreenshot(page, screenshotsDir, label) {
  const buffer = await page.screenshot({ fullPage: true });
  assertPngScreenshot(buffer, label);

  if (!screenshotsDir) {
    return { label, bytes: buffer.length, filePath: null };
  }

  await fs.mkdir(screenshotsDir, { recursive: true });
  const filePath = path.join(screenshotsDir, `${sanitizeScreenshotName(label)}.png`);
  await fs.writeFile(filePath, buffer);
  return { label, bytes: buffer.length, filePath };
}

async function assertReactClientPage(page, baseUrl, pathname, label, screenshotsDir, options = {}) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle" });
  await page.locator("[data-client-entry='react'][data-router-mode='data']").waitFor({ timeout: 10000 });
  await page.locator("h1").first().waitFor({ timeout: 10000 });
  if (options.readySelector) {
    await page.locator(options.readySelector).first().waitFor({ timeout: 10000 });
  }

  const snapshot = await page.evaluate((tokens) => {
    const text = document.body.innerText || "";
    const html = document.documentElement;
    const scripts = [...document.scripts].map((script) => script.src).filter(Boolean);
    return {
      title: document.title,
      text,
      path: window.location.pathname,
      hasReactEntry: Boolean(document.querySelector("[data-client-entry='react'][data-router-mode='data']")),
      legacyStartForm: Boolean(document.querySelector("#start-form")),
      clientScriptCount: scripts.filter((src) => src.includes("/client-assets/")).length,
      hiddenLeaks: tokens.filter((token) => text.includes(token)),
      horizontalOverflow: html.scrollWidth > html.clientWidth + 4
    };
  }, hiddenTextTokens);

  const failures = [];
  if (snapshot.title !== "千秋") failures.push(`${label} document title mismatch: ${snapshot.title}`);
  if (snapshot.path !== pathname) failures.push(`${label} path mismatch: ${snapshot.path}`);
  if (!snapshot.hasReactEntry) failures.push(`${label} did not render the React data-router entry.`);
  if (snapshot.legacyStartForm) failures.push(`${label} still rendered the legacy start form.`);
  if (snapshot.clientScriptCount < 1) failures.push(`${label} did not load Vite client-assets.`);
  if (snapshot.hiddenLeaks.length) failures.push(`${label} leaked hidden text: ${snapshot.hiddenLeaks.join(", ")}`);
  if (snapshot.horizontalOverflow) failures.push(`${label} has horizontal overflow.`);
  if (!snapshot.text.includes("千秋")) failures.push(`${label} did not render the product name.`);

  if (failures.length) {
    throw new Error(failures.join(" "));
  }

  return captureScreenshot(page, screenshotsDir, label);
}

async function runClientSmoke(options = {}) {
  if (!options.url && !hasReactClientBuild()) {
    throw new Error("React client build not found. Run npm run build:client before client smoke.");
  }

  const browserPath = resolveBrowserExecutable({ browserPath: options.browserPath });
  const server = options.url ? null : createFetchSafeServer(app);
  const baseUrl = options.url || server.baseUrl;
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: !options.headed
  });
  const pageErrors = [];
  const screenshots = [];

  try {
    const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));

    screenshots.push(await assertReactClientPage(page, baseUrl, "/", "s74-react-home-desktop", options.screenshotsDir));
    screenshots.push(
      await assertReactClientPage(page, baseUrl, "/game/s74-smoke/map", "s74-react-map-route-desktop", options.screenshotsDir)
    );
    screenshots.push(
      await assertReactClientPage(page, baseUrl, "/game/s74-smoke/people", "s74-react-people-assets-desktop", options.screenshotsDir, {
        readySelector: ".portraitGrid"
      })
    );
    const portraitLedger = await page.evaluate(() => {
      const grid = document.querySelector(".portraitGrid");
      const images = [...document.querySelectorAll(".portraitGrid img")];
      return {
        visible: Number(grid?.getAttribute("data-visible-portraits") || 0),
        total: Number(grid?.getAttribute("data-total-portraits") || 0),
        eagerImages: images.filter((image) => image.getAttribute("loading") !== "lazy").length,
        localOrRawLeaks: (document.body.innerText || "").match(/artifacts|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY/gi) || []
      };
    });
    if (portraitLedger.visible > 8 || portraitLedger.visible <= 0) {
      throw new Error(`People portrait page loaded an unsafe initial portrait count: ${portraitLedger.visible}`);
    }
    if (portraitLedger.total < 500) {
      throw new Error(`People portrait page did not expose the full manifest-backed pool: ${portraitLedger.total}`);
    }
    if (portraitLedger.eagerImages > 0) {
      throw new Error(`People portrait page rendered non-lazy portrait image(s): ${portraitLedger.eagerImages}`);
    }
    if (portraitLedger.localOrRawLeaks.length) {
      throw new Error(`People portrait page leaked forbidden text: ${portraitLedger.localOrRawLeaks.join(", ")}`);
    }

    const health = await page.evaluate(async () => {
      const response = await fetch("/api/health");
      return { ok: response.ok, payload: await response.json() };
    });
    if (!health.ok || health.payload?.ok !== true) {
      throw new Error(`Health API failed through React server: ${JSON.stringify(health)}`);
    }

    await page.setViewportSize(VIEWPORTS.mobile);
    screenshots.push(await assertReactClientPage(page, baseUrl, "/", "s74-react-home-mobile", options.screenshotsDir));
    await context.close();

    if (pageErrors.length) {
      throw new Error(`Client smoke page errors detected: ${pageErrors.join("; ")}`);
    }

    return {
      baseUrl,
      screenshots,
      viewports: ["desktop-home", "desktop-map-route", "desktop-people-assets", "mobile-home"]
    };
  } finally {
    await browser.close();
    if (server) await server.close();
  }
}

function printHelp() {
  console.log(`Usage: npm run smoke:browser -- [options]

Options:
  --url <url>          Test an already running Qianqiu server.
  --browser <path>     Browser executable path. Defaults to BROWSER_EXECUTABLE_PATH or local Chrome/Edge.
  --screenshots <dir>  Save S74.1 React client smoke screenshots to this directory.
  --headed             Show the browser window while running.
  --help               Show this message.
`);
}

if (require.main === module) {
  (async () => {
    const args = parseClientSmokeArgs(process.argv);
    if (args.help) {
      printHelp();
      return;
    }

    const result = await runClientSmoke(args);
    console.log(`Client smoke passed: ${result.baseUrl}`);
    console.log(`React routes: ${result.viewports.join(", ")}`);
    const saved = result.screenshots.filter((screenshot) => screenshot.filePath);
    if (saved.length) {
      console.log(`Screenshots: ${path.dirname(saved[0].filePath)}`);
    }
  })().catch((error) => {
    console.error(`Client smoke failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseClientSmokeArgs,
  runClientSmoke
};
