const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertPngScreenshot,
  buildBrowserCheatingEssay,
  buildBrowserSmokeEssay,
  getDefaultBrowserCandidates,
  getGameLayoutFailures,
  getHiddenActiveRequestLeaks,
  getMissingExamLevels,
  getHiddenRelationshipLeaks,
  getMissingActiveRequestTargets,
  getMissingOfficialCareerOutcomeTypes,
  getMissingRoleWorldKinds,
  getMissingRelationshipEntries,
  getMissingStartRoles,
  normalizeBaseUrl,
  parseBrowserSmokeArgs,
  rectsOverlap,
  resolveBrowserExecutable,
  sanitizeScreenshotName
} = require("../scripts/browserSmoke");

function createLayoutMetrics(overrides = {}) {
  return {
    appWidth: 1180,
    clientWidth: 1280,
    gameClientWidth: 1180,
    gameLeft: 50,
    gameRight: 1230,
    gameScrollWidth: 1180,
    gameWidth: 1180,
    scholarClientWidth: 1180,
    scholarLeft: 50,
    scholarRight: 1230,
    scholarScrollWidth: 1180,
    scholarWidth: 1180,
    relationshipClientWidth: 1180,
    relationshipScrollWidth: 1180,
    relationshipWidth: 1180,
    activeRequestClientWidth: 1180,
    activeRequestScrollWidth: 1180,
    activeRequestWidth: 1180,
    officialCareerClientWidth: 1180,
    officialCareerScrollWidth: 1180,
    officialCareerWidth: 1180,
    examCalendarClientWidth: 1180,
    examCalendarScrollWidth: 1180,
    examCalendarWidth: 1180,
    examRivalClientWidth: 1180,
    examRivalScrollWidth: 1180,
    examRivalWidth: 1180,
    viewportWidth: 1280,
    ...overrides
  };
}

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
    screenshotsDir: null,
    url: "http://localhost:3000"
  });
});

test("browser smoke parses optional screenshot artifact directory", () => {
  const args = parseBrowserSmokeArgs([
    "node",
    "scripts/browserSmoke.js",
    "--screenshots",
    "artifacts/browser-smoke",
    "--url",
    "http://127.0.0.1:3000"
  ]);

  assert.equal(args.screenshotsDir, "artifacts/browser-smoke");
  assert.equal(args.url, "http://127.0.0.1:3000");
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
  assert.throws(
    () => parseBrowserSmokeArgs(["node", "scripts/browserSmoke.js", "--screenshots"]),
    /--screenshots requires a value/
  );
});

test("browser smoke normalizes base URLs for stable output", () => {
  assert.equal(normalizeBaseUrl("http://127.0.0.1:3000/"), "http://127.0.0.1:3000");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:3000/?debug=1#top"), "http://127.0.0.1:3000");
});

test("browser smoke requires every supported start role option", () => {
  assert.deepEqual(
    getMissingStartRoles(["scholar", "emperor", "minister", "general", "magistrate", "official"]),
    []
  );
  assert.deepEqual(
    getMissingStartRoles(["scholar", "emperor", "minister", "general", "magistrate"]),
    ["official"]
  );
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

test("browser smoke screenshot helper accepts nonblank PNG buffers", () => {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.doesNotThrow(() => assertPngScreenshot(Buffer.concat([pngSignature, Buffer.alloc(1600)]), "fixture"));
  assert.throws(() => assertPngScreenshot(Buffer.from("not a png"), "fixture"), /unexpectedly small|not a PNG/);
  assert.equal(sanitizeScreenshotName("Desktop Exam Modal!"), "desktop-exam-modal");
});

test("browser smoke layout helpers catch overlapping boxes", () => {
  assert.equal(
    rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 9, y: 4, width: 10, height: 10 }),
    true
  );
  assert.equal(
    rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 12, y: 0, width: 10, height: 10 }),
    false
  );
  assert.ok(buildBrowserSmokeEssay().length >= 200);
  assert.equal(buildBrowserSmokeEssay().toLowerCase().includes("ai"), false);
});

test("browser smoke builds deterministic exam essays for every progression level", () => {
  assert.ok(buildBrowserSmokeEssay("child_exam").length >= 200);
  assert.ok(buildBrowserSmokeEssay("provincial_exam").length >= 500);
  assert.ok(buildBrowserSmokeEssay("metropolitan_exam").length >= 800);
  assert.ok(buildBrowserSmokeEssay("palace_exam").length >= 700);
  assert.equal(buildBrowserSmokeEssay("palace_exam").toLowerCase().includes("ai"), false);
  assert.match(buildBrowserCheatingEssay(), /学而时习之不亦说乎/);
});

test("browser smoke exam progression helper catches missing levels", () => {
  assert.deepEqual(getMissingExamLevels(["child_exam", "provincial_exam"], ["child_exam"]), []);
  assert.deepEqual(
    getMissingExamLevels(["child_exam"], ["child_exam", "provincial_exam", "metropolitan_exam"]),
    ["provincial_exam", "metropolitan_exam"]
  );
});

test("browser smoke game layout helper catches narrow desktop panel and clipped role panel", () => {
  const failures = getGameLayoutFailures(
    createLayoutMetrics({
      gameClientWidth: 390,
      gameRight: 440,
      gameScrollWidth: 840,
      gameWidth: 390,
      scholarClientWidth: 390,
      scholarRight: 440,
      scholarScrollWidth: 840,
      scholarWidth: 390
    }),
    "desktop"
  );

  assert.match(failures.join("\n"), /game panel is too narrow/);
  assert.match(failures.join("\n"), /role panel has horizontal scroll overflow/);
});

test("browser smoke relationship helpers catch missing and hidden entries", () => {
  assert.deepEqual(getMissingRelationshipEntries(["C01", "scholarOfficials"], ["C01"]), []);
  assert.deepEqual(
    getMissingRelationshipEntries(["C01"], ["C01", "scholarOfficials"]),
    ["scholarOfficials"]
  );
  assert.deepEqual(getHiddenRelationshipLeaks(["C01", "eunuchs"], ["eunuchs", "militaryLords"]), ["eunuchs"]);
  assert.deepEqual(getHiddenRelationshipLeaks(["C01", "scholarOfficials"], ["eunuchs"]), []);
});

test("browser smoke game layout helper catches relationship panel overflow", () => {
  const failures = getGameLayoutFailures(
    createLayoutMetrics({
      relationshipClientWidth: 500,
      relationshipScrollWidth: 620,
      relationshipWidth: 500
    }),
    "desktop"
  );

  assert.match(failures.join("\n"), /relationship panel has horizontal scroll overflow/);
});

test("browser smoke active request helpers catch missing and hidden targets", () => {
  assert.deepEqual(getMissingActiveRequestTargets(["C01"], ["C01"]), []);
  assert.deepEqual(getMissingActiveRequestTargets(["C01"], ["C01", "scholarOfficials"]), ["scholarOfficials"]);
  assert.deepEqual(getHiddenActiveRequestLeaks(["C01", "eunuchs"], ["eunuchs"]), ["eunuchs"]);
  assert.deepEqual(getHiddenActiveRequestLeaks(["C01"], ["eunuchs"]), []);
});

test("browser smoke official career helpers catch missing outcome types", () => {
  assert.deepEqual(getMissingOfficialCareerOutcomeTypes(["appointment"], ["appointment"]), []);
  assert.deepEqual(
    getMissingOfficialCareerOutcomeTypes(["appointment"], ["appointment", "promotion"]),
    ["promotion"]
  );
});

test("browser smoke role-world helpers catch missing coupling kinds", () => {
  assert.deepEqual(getMissingRoleWorldKinds(["magistrate_waterworks"], ["magistrate_waterworks"]), []);
  assert.deepEqual(
    getMissingRoleWorldKinds(["magistrate_waterworks"], ["magistrate_waterworks", "general_campaign"]),
    ["general_campaign"]
  );
});

test("browser smoke game layout helper catches active request panel overflow", () => {
  const failures = getGameLayoutFailures(
    createLayoutMetrics({
      activeRequestClientWidth: 500,
      activeRequestScrollWidth: 640,
      activeRequestWidth: 500
    }),
    "desktop"
  );

  assert.match(failures.join("\n"), /active request panel has horizontal scroll overflow/);
});

test("browser smoke game layout helper catches official career panel overflow", () => {
  const failures = getGameLayoutFailures(
    createLayoutMetrics({
      officialCareerClientWidth: 500,
      officialCareerScrollWidth: 640,
      officialCareerWidth: 500
    }),
    "desktop"
  );

  assert.match(failures.join("\n"), /official career panel has horizontal scroll overflow/);
});

test("browser smoke game layout helper catches exam calendar and rival panel overflow", () => {
  const failures = getGameLayoutFailures(
    createLayoutMetrics({
      examCalendarClientWidth: 500,
      examCalendarScrollWidth: 620,
      examCalendarWidth: 500,
      examRivalClientWidth: 500,
      examRivalScrollWidth: 630,
      examRivalWidth: 500
    }),
    "desktop"
  );

  assert.match(failures.join("\n"), /exam calendar panel has horizontal scroll overflow/);
  assert.match(failures.join("\n"), /exam rival panel has horizontal scroll overflow/);
});

test("browser smoke game layout helper keeps mobile width behavior compatible", () => {
  assert.deepEqual(
    getGameLayoutFailures(
      createLayoutMetrics({
        appWidth: 390,
        clientWidth: 390,
        gameClientWidth: 390,
        gameRight: 390,
        gameScrollWidth: 390,
        gameWidth: 390,
        scholarClientWidth: 390,
        scholarRight: 390,
        scholarScrollWidth: 390,
        scholarWidth: 390,
        viewportWidth: 390
      }),
      "mobile"
    ),
    []
  );
  assert.deepEqual(
    getGameLayoutFailures(
      createLayoutMetrics({
        appWidth: 390,
        clientWidth: 390,
        gameClientWidth: 390,
        gameRight: 390,
        gameScrollWidth: 390,
        gameWidth: 390,
        scholarClientWidth: 390,
        scholarRight: 390,
        scholarScrollWidth: 390,
        scholarWidth: 390,
        viewportWidth: 390
      }),
      "mobile final archive"
    ),
    []
  );

  assert.match(
    getGameLayoutFailures(
      createLayoutMetrics({
        appWidth: 390,
        clientWidth: 390,
        gameClientWidth: 390,
        gameRight: 390,
        gameScrollWidth: 420,
        gameWidth: 390,
        scholarClientWidth: 390,
        scholarRight: 390,
        scholarScrollWidth: 420,
        scholarWidth: 390,
        viewportWidth: 390
      }),
      "mobile"
    ).join("\n"),
    /horizontal/
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
