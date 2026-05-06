const fs = require("node:fs");
const fsp = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require("playwright-core");

const rootDir = path.join(__dirname, "..");
const sessionIdPattern = /^[0-9a-fA-F-]{20,}$/;

function parseBrowserSmokeArgs(argv = process.argv) {
  const args = {
    browserPath: null,
    headed: false,
    help: false,
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

async function runBrowserJourney({ baseUrl, browserPath, headed = false, onSessionId = () => {} } = {}) {
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: !headed
  });

  const pageErrors = [];
  let sessionId = null;

  try {
    const context = await browser.newContext();
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

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#action-area").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#scholar-panel").waitFor({ state: "visible", timeout: 10000 });

    const restoredId = await page.evaluate(() => window.localStorage.getItem("qianqiu.sessionId"));
    if (restoredId !== sessionId) {
      throw new Error(`Restored localStorage session mismatch: expected ${sessionId}, got ${restoredId}`);
    }

    const freshPage = await context.newPage();
    freshPage.on("pageerror", (error) => pageErrors.push(error.message));
    await freshPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await freshPage.locator("#action-area").waitFor({ state: "visible", timeout: 10000 });
    await freshPage.locator("#scholar-panel").waitFor({ state: "visible", timeout: 10000 });
    const freshPageId = await freshPage.evaluate(() => window.localStorage.getItem("qianqiu.sessionId"));
    if (freshPageId !== sessionId) {
      throw new Error(`Fresh page localStorage session mismatch: expected ${sessionId}, got ${freshPageId}`);
    }
    await freshPage.close();

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
      statusText: statusText.replace(/\s+/g, " ").trim()
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
      }
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
  })().catch((error) => {
    console.error(`Browser smoke failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  getDefaultBrowserCandidates,
  normalizeBaseUrl,
  parseBrowserSmokeArgs,
  resolveBrowserExecutable,
  runBrowserJourney,
  runBrowserSmoke
};
