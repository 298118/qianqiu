const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDefaultBrowserCandidates,
  normalizeBaseUrl,
  parseBrowserSmokeArgs,
  resolveBrowserExecutable
} = require("../scripts/browserSmoke");

test("browser smoke parses url, browser path, and headed mode", () => {
  const args = parseBrowserSmokeArgs([
    "node",
    "scripts/browserSmoke.js",
    "--url",
    "http://localhost:3000/",
    "--browser",
    "C:\\Chrome\\chrome.exe",
    "--headed"
  ]);

  assert.deepEqual(args, {
    browserPath: "C:\\Chrome\\chrome.exe",
    headed: true,
    help: false,
    url: "http://localhost:3000"
  });
});

test("browser smoke rejects incomplete arguments", () => {
  assert.throws(
    () => parseBrowserSmokeArgs(["node", "scripts/browserSmoke.js", "--url"]),
    /--url requires a value/
  );
  assert.throws(
    () => parseBrowserSmokeArgs(["node", "scripts/browserSmoke.js", "--unknown"]),
    /Unknown browser smoke argument/
  );
});

test("browser smoke normalizes base URLs for stable output", () => {
  assert.equal(normalizeBaseUrl("http://127.0.0.1:3000/"), "http://127.0.0.1:3000");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:3000/?debug=1#top"), "http://127.0.0.1:3000");
});

test("browser smoke resolves explicit browser executable before defaults", () => {
  const resolved = resolveBrowserExecutable({
    browserPath: "C:\\Tools\\chrome.exe",
    env: {},
    exists: (candidate) => candidate === "C:\\Tools\\chrome.exe"
  });

  assert.equal(resolved, "C:\\Tools\\chrome.exe");
  assert.throws(
    () =>
      resolveBrowserExecutable({
        browserPath: "C:\\Missing\\chrome.exe",
        env: {},
        exists: () => false
      }),
    /Browser executable not found/
  );
});

test("browser smoke falls back to platform browser candidates", () => {
  const candidates = getDefaultBrowserCandidates("win32", {
    ProgramFiles: "C:\\PF",
    "ProgramFiles(x86)": "C:\\PF86"
  });

  assert.ok(candidates.some((candidate) => candidate.endsWith("chrome.exe")));
  assert.equal(
    resolveBrowserExecutable({
      env: {
        ProgramFiles: "C:\\PF",
        "ProgramFiles(x86)": "C:\\PF86"
      },
      platform: "win32",
      exists: (candidate) => candidate.includes("Microsoft\\Edge")
    }),
    "C:\\PF86\\Microsoft\\Edge\\Application\\msedge.exe"
  );
});
