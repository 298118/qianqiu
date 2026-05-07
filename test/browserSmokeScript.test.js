const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertPngScreenshot,
  buildBrowserCheatingEssay,
  buildBrowserSmokeEssay,
  getAiConnectionPanelFailures,
  getDefaultBrowserCandidates,
  getGameLayoutFailures,
  getHiddenActiveRequestLeaks,
  getHiddenOfficialCareerTextLeaks,
  getHiddenWorldThreadTextLeaks,
  getHiddenSaveIdLeaks,
  getTenDayDateFailures,
  getMissingExamLevels,
  getHiddenRelationshipLeaks,
  getMissingActiveRequestTargets,
  getMissingOfficialCareerAssignmentKinds,
  getMissingOfficialCareerAssignmentStatuses,
  getMissingOfficialCareerOutcomeTypes,
  getOfficialCareerPanelFailures,
  getMissingRoleWorldKinds,
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
    worldThreadClientWidth: 1180,
    worldThreadScrollWidth: 1180,
    worldThreadWidth: 1180,
    examCalendarClientWidth: 1180,
    examCalendarScrollWidth: 1180,
    examCalendarWidth: 1180,
    examRivalClientWidth: 1180,
    examRivalScrollWidth: 1180,
    examRivalWidth: 1180,
    saveListPanelClientWidth: 0,
    saveListPanelScrollWidth: 0,
    saveListPanelWidth: 0,
    saveListModalClientWidth: 0,
    saveListModalScrollWidth: 0,
    saveListModalWidth: 0,
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
    checkAiConnection: false,
    headed: true,
    help: false,
    screenshotsDir: null,
    url: "http://localhost:3000"
  });
});

test("browser smoke parses optional AI connection check flag", () => {
  const args = parseBrowserSmokeArgs([
    "node",
    "scripts/browserSmoke.js",
    "--check-ai-connection",
    "--url",
    "http://127.0.0.1:3000"
  ]);

  assert.equal(args.checkAiConnection, true);
  assert.equal(args.url, "http://127.0.0.1:3000");
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

test("browser smoke ten-day date helper requires visible period labels", () => {
  assert.equal(hasTenDayPeriodLabel("明1644年八月下旬"), true);
  assert.equal(hasTenDayPeriodLabel("明1644年八月"), false);
  assert.deepEqual(
    getTenDayDateFailures({ status: "明1644年八月上旬", archive: "明1644年八月" }, "fixture"),
    ["fixture archive is missing a ten-day date label."]
  );
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

test("browser smoke AI connection helper catches failed diagnostics and session writes", () => {
  const failures = getAiConnectionPanelFailures(
    {
      beforeSessionId: "",
      afterSessionId: "created-session",
      actionAreaVisible: true,
      resultOk: "false",
      resultText: "当前配置：mock\nOPENAI_API_KEY",
      statusText: "mock 不可用"
    },
    {
      expectedProvider: "mock",
      hiddenTextTokens: ["OPENAI_API_KEY"]
    },
    "fixture AI connection"
  );

  assert.match(failures.join("\n"), /did not report a passing result/);
  assert.match(failures.join("\n"), /changed qianqiu.sessionId/);
  assert.match(failures.join("\n"), /entered the game action area/);
  assert.match(failures.join("\n"), /leaked hidden text tokens: OPENAI_API_KEY/);
});

test("browser smoke AI connection helper accepts the expected Mock panel summary", () => {
  assert.deepEqual(
    getAiConnectionPanelFailures(
      {
        beforeSessionId: "",
        afterSessionId: "",
        actionAreaVisible: false,
        resultOk: "true",
        resultText: "当前配置：mock\ndefault: mock\n回声：县学灯火未灭",
        statusText: "mock 可用，耗时 0ms。"
      },
      { expectedProvider: "mock" },
      "fixture AI connection"
    ),
    []
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

test("browser smoke world thread helpers catch missing fields and hidden text", () => {
  assert.deepEqual(getMissingWorldThreadKinds(["npc_request"], ["npc_request"]), []);
  assert.deepEqual(getMissingWorldThreadKinds(["npc_request"], ["npc_request", "official_assignment"]), [
    "official_assignment"
  ]);
  assert.deepEqual(getMissingWorldThreadSourceTypes(["active_npc_request"], ["active_npc_request"]), []);
  assert.deepEqual(
    getMissingWorldThreadSourceTypes(["active_npc_request"], ["active_npc_request", "official_assignment"]),
    ["official_assignment"]
  );
  assert.deepEqual(
    getHiddenWorldThreadTextLeaks("世界议程 Hidden Palace Thread", ["Hidden Palace Thread", "sealed palace dossier"]),
    ["Hidden Palace Thread"]
  );

  const failures = getWorldThreadPanelFailures(
    {
      cardCount: 1,
      kinds: ["npc_request"],
      sourceTypes: ["active_npc_request"],
      statuses: ["active"],
      risks: [""],
      goalCount: 1,
      deadlineCount: 0,
      riskCount: 1,
      relatedCount: 1,
      hintCount: 1,
      followUpCount: 1,
      text: "世界议程 Hidden Palace Thread"
    },
    {
      expectActive: true,
      expectedKinds: ["official_assignment"],
      expectedSourceTypes: ["official_assignment"],
      expectedStatuses: ["watch"],
      hiddenTextTokens: ["Hidden Palace Thread"]
    },
    "world thread fixture"
  );

  assert.match(failures.join("\n"), /missing thread kinds: official_assignment/);
  assert.match(failures.join("\n"), /missing source types: official_assignment/);
  assert.match(failures.join("\n"), /missing allowed statuses: watch/);
  assert.match(failures.join("\n"), /has 0 deadlines for 1 thread cards/);
  assert.match(failures.join("\n"), /without data-risk/);
  assert.match(failures.join("\n"), /leaked hidden text tokens: Hidden Palace Thread/);
});

test("browser smoke save-list helpers catch missing and hidden save ids", () => {
  assert.deepEqual(getMissingSaveIds(["save-a", "save-b"], ["save-a"]), []);
  assert.deepEqual(getMissingSaveIds(["save-a"], ["save-a", "save-b", "save-c"]), ["save-b", "save-c"]);
  assert.deepEqual(getHiddenSaveIdLeaks(["save-a", "deleted-save"], ["deleted-save"]), ["deleted-save"]);
  assert.deepEqual(getHiddenSaveIdLeaks(["save-a"], ["deleted-save"]), []);
});

test("browser smoke official career helpers catch missing outcome types", () => {
  assert.deepEqual(getMissingOfficialCareerOutcomeTypes(["appointment"], ["appointment"]), []);
  assert.deepEqual(
    getMissingOfficialCareerOutcomeTypes(["appointment"], ["appointment", "promotion"]),
    ["promotion"]
  );
});

test("browser smoke official career helpers catch missing assignment kind and allowed status", () => {
  assert.deepEqual(getMissingOfficialCareerAssignmentKinds(["relief"], ["relief"]), []);
  assert.deepEqual(getMissingOfficialCareerAssignmentKinds(["case_review"], ["relief"]), ["relief"]);
  assert.deepEqual(getMissingOfficialCareerAssignmentStatuses(["active"], ["active", "submitted"]), []);
  assert.deepEqual(getMissingOfficialCareerAssignmentStatuses(["closed"], ["active", "submitted"]), [
    "active",
    "submitted"
  ]);

  const failures = getOfficialCareerPanelFailures(
    {
      currentPosting: "六部观政进士",
      panelImpeachmentStage: "none",
      bureauIds: ["ministry_personnel"],
      bureauDutyCount: 1,
      assignmentIds: ["assignment-1", "assignment-2"],
      assignmentKinds: ["relief", "case_review"],
      assignmentStatuses: ["failed", "active"],
      assignmentRecords: [
        { id: "assignment-1", kind: "relief", status: "failed", bureauId: "ministry_revenue" },
        { id: "assignment-2", kind: "case_review", status: "active", bureauId: "ministry_justice" }
      ],
      assignmentSummaryCount: 1,
      assignmentProgressCount: 2,
      assignmentRiskCount: 2,
      assessments: ["考成待议"],
      assessmentNoteCount: 1,
      networkCount: 1,
      procedureStages: ["none"],
      outcomeIds: [],
      outcomeTypes: [],
      reasonCount: 0,
      postingCount: 0,
      text: "官场履历"
    },
    {
      expectedAssignmentKinds: ["relief"],
      expectedAssignmentStatuses: ["active", "submitted"]
    },
    "official fixture"
  );

  assert.doesNotMatch(failures.join("\n"), /missing assignment kinds: relief/);
  assert.match(failures.join("\n"), /no relief assignment with allowed statuses: active, submitted/);
});

test("browser smoke official career helpers require server-built view sections", () => {
  const failures = getOfficialCareerPanelFailures(
    {
      currentPosting: "六部观政进士",
      panelImpeachmentStage: "none",
      bureauIds: ["ministry_personnel"],
      bureauDutyCount: 1,
      assignmentIds: [],
      assignmentKinds: [],
      assignmentStatuses: [],
      assessments: [""],
      assessmentViewReady: ["false"],
      assessmentNoteCount: 1,
      networkCount: 1,
      networkViewReady: ["false"],
      procedureStages: ["none"],
      procedureViewReady: ["false"],
      outcomeIds: [],
      outcomeTypes: [],
      reasonCount: 0,
      postingCount: 0,
      text: "官场档案"
    },
    {
      expectAssessment: true,
      expectNetwork: true,
      expectedImpeachmentStage: "none"
    },
    "official fixture"
  );

  assert.match(failures.join("\n"), /did not render server assessment view data/);
  assert.match(failures.join("\n"), /did not render server network view data/);
  assert.match(failures.join("\n"), /did not render server procedure view data/);
});

test("browser smoke official career helpers catch hidden official panel text leaks", () => {
  assert.deepEqual(
    getHiddenOfficialCareerTextLeaks("考成公开记录。有人暗中遮掩亏空。", ["hiddenNotes", "有人暗中遮掩亏空"]),
    ["有人暗中遮掩亏空"]
  );

  const failures = getOfficialCareerPanelFailures(
    {
      currentPosting: "六部观政进士",
      panelImpeachmentStage: "none",
      bureauIds: ["ministry_personnel"],
      bureauDutyCount: 1,
      assignmentIds: [],
      assignmentKinds: [],
      assignmentStatuses: [],
      assessments: ["无"],
      assessmentNoteCount: 1,
      networkCount: 1,
      procedureStages: ["none"],
      outcomeIds: [],
      outcomeTypes: [],
      reasonCount: 0,
      postingCount: 0,
      text: "hiddenNotes 密札指向上官"
    },
    {
      hiddenTextTokens: ["hiddenNotes", "有人暗中遮掩亏空", "密札指向上官"]
    },
    "official fixture"
  );

  assert.match(failures.join("\n"), /leaked hidden text tokens: hiddenNotes, 密札指向上官/);
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

test("browser smoke game layout helper catches world thread panel overflow", () => {
  const failures = getGameLayoutFailures(
    createLayoutMetrics({
      worldThreadClientWidth: 500,
      worldThreadScrollWidth: 640,
      worldThreadWidth: 500
    }),
    "desktop"
  );

  assert.match(failures.join("\n"), /world thread panel has horizontal scroll overflow/);
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

test("browser smoke game layout helper catches future save-list panel and modal overflow", () => {
  const failures = getGameLayoutFailures(
    createLayoutMetrics({
      saveListPanelClientWidth: 500,
      saveListPanelScrollWidth: 620,
      saveListPanelWidth: 500,
      saveListModalClientWidth: 640,
      saveListModalScrollWidth: 760,
      saveListModalWidth: 640
    }),
    "desktop"
  );

  assert.match(failures.join("\n"), /save-list panel has horizontal scroll overflow/);
  assert.match(failures.join("\n"), /save-list modal has horizontal scroll overflow/);
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
