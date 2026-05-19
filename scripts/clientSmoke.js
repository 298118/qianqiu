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

const runnableSessionIdPattern = /^[a-f0-9-]{36}$/i;
const unsafeClientApiPathPatterns = Object.freeze([
  /^\/api\/game\/state\//,
  /^\/api\/dev\//
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
    } else if (arg === "--client") {
      const client = readArgValue(argv, index, "--client");
      if (client !== "react") {
        throw new Error(`Unsupported client smoke target: ${client}`);
      }
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

async function assertCurrentReactClientPage(page, pathname, label, screenshotsDir, options = {}) {
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

async function assertReactClientPage(page, baseUrl, pathname, label, screenshotsDir, options = {}) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle" });
  return assertCurrentReactClientPage(page, pathname, label, screenshotsDir, options);
}

async function waitForSafeSessionPath(page, label) {
  await page.waitForURL((url) => /^\/game\/[a-f0-9-]{36}$/i.test(url.pathname), { timeout: 15000 });
  const sessionId = new URL(page.url()).pathname.split("/")[2];
  if (!runnableSessionIdPattern.test(sessionId)) {
    throw new Error(`${label} did not navigate to a runnable session id: ${page.url()}`);
  }
  return sessionId;
}

async function startMockGameThroughHome(page, screenshotsDir) {
  await page.getByLabel("姓名").fill("烟测书生");
  await page.getByLabel("身份").selectOption("scholar");
  await page.getByRole("button", { name: "新开一卷" }).click();
  const sessionId = await waitForSafeSessionPath(page, "default home start");
  const gamePath = `/game/${sessionId}`;
  const screenshot = await assertCurrentReactClientPage(page, gamePath, "s74-react-mock-start-desktop", screenshotsDir);

  const entrypoints = await page.evaluate((id) => {
    const allLinks = [...document.querySelectorAll("a")].map((link) => ({
      text: (link.textContent || "").trim(),
      path: new URL(link.href).pathname
    }));
    const byText = new Map(allLinks.map((link) => [link.text, link.path]));
    return {
      topMap: byText.get("舆图"),
      topPeople: byText.get("人物"),
      topArchive: byText.get("史册"),
      exam: byText.get("科举"),
      ranking: byText.get("皇榜"),
      court: byText.get("朝议"),
      settings: byText.get("印匣"),
      previewLinks: allLinks.filter((link) => link.path.includes("s74-preview")).map((link) => link.text),
      expected: {
        map: `/game/${id}/map`,
        people: `/game/${id}/people`,
        archive: `/game/${id}/archive`,
        exam: `/game/${id}/exam`,
        ranking: `/game/${id}/ranking`,
        court: `/game/${id}/court`,
        settings: `/game/${id}/settings`
      }
    };
  }, sessionId);

  const failures = [];
  if (entrypoints.topMap !== entrypoints.expected.map) failures.push(`top map link was ${entrypoints.topMap}`);
  if (entrypoints.topPeople !== entrypoints.expected.people) failures.push(`top people link was ${entrypoints.topPeople}`);
  if (entrypoints.topArchive !== entrypoints.expected.archive) failures.push(`top archive link was ${entrypoints.topArchive}`);
  if (entrypoints.exam !== entrypoints.expected.exam) failures.push(`exam link was ${entrypoints.exam}`);
  if (entrypoints.ranking !== entrypoints.expected.ranking) failures.push(`ranking link was ${entrypoints.ranking}`);
  if (entrypoints.court !== entrypoints.expected.court) failures.push(`court link was ${entrypoints.court}`);
  if (entrypoints.settings !== entrypoints.expected.settings) failures.push(`settings link was ${entrypoints.settings}`);
  if (entrypoints.previewLinks.length) failures.push(`runnable game shell still linked preview routes: ${entrypoints.previewLinks.join(", ")}`);
  if (failures.length) {
    throw new Error(`Default entry session links are not bound to the started Mock session: ${failures.join("; ")}`);
  }

  return { sessionId, screenshot };
}

async function assertScholarPanel(page, sessionId, screenshotsDir) {
  await page.getByRole("heading", { name: "寒窗书斋" }).waitFor({ timeout: 10000 });
  const panelSnapshot = await page.evaluate((id) => {
    const panel = document.querySelector(".scholarPanel");
    const text = panel?.textContent || "";
    const examLink = [...document.querySelectorAll(".scholarPanel a")].find((link) => (link.textContent || "").includes("入科举页"));
    const rankingLink = [...document.querySelectorAll(".scholarPanel a")].find((link) => (link.textContent || "").includes("看皇榜"));
    const buttons = [...document.querySelectorAll(".scholarPanel button")].map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled
    }));
    const computedStyle = panel ? getComputedStyle(panel) : null;
    const computedBackground = computedStyle
      ? `${panel?.getAttribute("data-role-background") || ""} ${computedStyle.getPropertyValue("--scholar-panel-bg")} ${computedStyle.backgroundImage}`
      : "";
    return {
      text,
      dimensionCount: panel?.querySelectorAll(".scholarPanelMetrics li").length || 0,
      hasStudyLedger: text.includes("读书簿"),
      hasTeacher: text.includes("老师点评"),
      hasNetwork: text.includes("师友"),
      hasCalendar: text.includes("科期"),
      hasPractice: text.includes("文章练习"),
      hasBoundary: text.includes("只写草稿，结果由服务器裁决"),
      examPath: examLink ? new URL(examLink.href).pathname : "",
      rankingPath: rankingLink ? new URL(rankingLink.href).pathname : "",
      buttons,
      background: computedBackground,
      expectedExamPath: `/game/${id}/exam`,
      expectedRankingPath: `/game/${id}/ranking`,
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥/gi) || []
    };
  }, sessionId);

  const failures = [];
  if (!panelSnapshot.hasStudyLedger) failures.push("missing study ledger");
  if (!panelSnapshot.hasTeacher) failures.push("missing teacher feedback");
  if (!panelSnapshot.hasNetwork) failures.push("missing academy network");
  if (!panelSnapshot.hasCalendar) failures.push("missing exam calendar");
  if (!panelSnapshot.hasPractice) failures.push("missing practice block");
  if (!panelSnapshot.hasBoundary) failures.push("missing server boundary");
  if (panelSnapshot.dimensionCount < 7) failures.push(`expected seven study dimensions, saw ${panelSnapshot.dimensionCount}`);
  if (panelSnapshot.examPath !== panelSnapshot.expectedExamPath) failures.push(`exam link was ${panelSnapshot.examPath}`);
  if (panelSnapshot.rankingPath !== panelSnapshot.expectedRankingPath) failures.push(`ranking link was ${panelSnapshot.rankingPath}`);
  if (!panelSnapshot.buttons.some((button) => button.text === "请老师改文" && !button.disabled)) failures.push("teacher draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "整备赴考" && !button.disabled)) failures.push("exam prep draft button missing or disabled");
  if (!panelSnapshot.background.includes("/assets/ui/")) failures.push("role background asset was not applied through the manifest registry");
  if (panelSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${panelSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.2 scholar panel smoke failed: ${failures.join("; ")}`);
  }

  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "请老师改文" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("携旧作拜见老师") && value.includes("破题");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.2 scholar draft button submitted a turn instead of writing a draft: ${turnRequests.join(", ")}`);
  }

  const draft = await page.getByLabel("本回合行动").inputValue();
  if (!draft.includes("携旧作拜见老师")) {
    throw new Error(`S76.2 scholar draft did not enter the memorial composer: ${draft}`);
  }
  await page.getByLabel("本回合行动").fill("");

  return captureScreenshot(page, screenshotsDir, "s76-scholar-panel-desktop");
}

async function assertExamFullScreen(page, sessionId, screenshotsDir, screenshotName = "s76-exam-fullscreen-desktop", options = {}) {
  await page.locator(".examFullScreen").waitFor({ timeout: 10000 });
  const initialSnapshot = await page.evaluate(({ id, tokens }) => {
    const shell = document.querySelector(".examFullScreen");
    const hero = document.querySelector(".examHero");
    const rail = document.querySelector(".examStageRail");
    const text = shell?.textContent || "";
    const background = hero ? getComputedStyle(hero).backgroundImage : "";
    const html = document.documentElement;
    return {
      path: window.location.pathname,
      expectedPath: `/game/${id}/exam`,
      hasHero: Boolean(hero),
      hasRail: Boolean(rail),
      hasQuestionPanel: Boolean(document.querySelector(".examQuestionPanel")),
      hasSafetyBoundary: text.includes("交卷、评分、舞弊、放榜、晋级和授官都由服务器裁决"),
      background,
      horizontalOverflow: html.scrollWidth > html.clientWidth + 4,
      hiddenLeaks: tokens.filter((token) => (document.body.innerText || "").includes(token))
    };
  }, { id: sessionId, tokens: hiddenTextTokens });

  const failures = [];
  if (initialSnapshot.path !== initialSnapshot.expectedPath) failures.push(`path was ${initialSnapshot.path}`);
  if (!initialSnapshot.hasHero) failures.push("missing exam hero");
  if (!initialSnapshot.hasRail) failures.push("missing exam stage rail");
  if (!initialSnapshot.hasQuestionPanel) failures.push("missing question panel");
  if (!initialSnapshot.hasSafetyBoundary) failures.push("missing server-owned exam boundary");
  if (!initialSnapshot.background.includes("/assets/ui/")) failures.push("exam hero did not use a reviewed UI asset");
  if (initialSnapshot.horizontalOverflow) failures.push("exam page has horizontal overflow");
  if (initialSnapshot.hiddenLeaks.length) failures.push(`hidden text leaked: ${initialSnapshot.hiddenLeaks.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.7 exam page initial smoke failed: ${failures.join("; ")}`);
  }
  if (options.clickQuestion === false) {
    return captureScreenshot(page, screenshotsDir, screenshotName);
  }

  const examRequests = [];
  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/exam/")) {
        examRequests.push(url.pathname);
      }
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "取题" }).click();
  await page.locator("[aria-label='当前试卷']").waitFor({ timeout: 15000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);

  const examSnapshot = await page.evaluate((tokens) => {
    const shell = document.querySelector(".examFullScreen");
    const text = shell?.textContent || "";
    const textarea = document.querySelector(".examSubmit textarea");
    return {
      text,
      hasQuestion: Boolean(document.querySelector(".examQuestionText")),
      hasEssay: Boolean(textarea),
      hasDraftBar: Boolean(document.querySelector(".examDraftBar")),
      hasPeerPanel: text.includes("虚拟考生、阅卷官与榜单只显示安全占位"),
      hasSubmit: [...document.querySelectorAll("button")].some((button) => (button.textContent || "").trim() === "交卷" && !button.disabled),
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || [],
      hiddenLeaks: tokens.filter((token) => (document.body.innerText || "").includes(token))
    };
  }, hiddenTextTokens);

  const afterFailures = [];
  if (!examRequests.includes("/api/exam/question")) afterFailures.push(`missing /api/exam/question request: ${examRequests.join(", ")}`);
  if (turnRequests.length) afterFailures.push(`取题 submitted game turn: ${turnRequests.join(", ")}`);
  if (examSnapshot.hasQuestion || examSnapshot.hasSubmit) {
    if (!examSnapshot.hasQuestion) afterFailures.push("missing rendered question");
    if (!examSnapshot.hasEssay) afterFailures.push("missing essay textarea");
    if (!examSnapshot.hasDraftBar) afterFailures.push("missing draft status bar");
    if (!examSnapshot.hasPeerPanel) afterFailures.push("missing safe virtual candidate panel");
    if (!examSnapshot.hasSubmit) afterFailures.push("missing enabled submit button");
  }
  if (examSnapshot.forbiddenText.length) afterFailures.push(`unsafe text leaked: ${examSnapshot.forbiddenText.join(", ")}`);
  if (examSnapshot.hiddenLeaks.length) afterFailures.push(`hidden text leaked: ${examSnapshot.hiddenLeaks.join(", ")}`);
  if (afterFailures.length) {
    throw new Error(`S76.7 exam page active smoke failed: ${afterFailures.join("; ")}`);
  }

  return captureScreenshot(page, screenshotsDir, screenshotName);
}

async function assertRankingFullScreen(page, sessionId, screenshotsDir, screenshotName = "s76-ranking-fullscreen-desktop") {
  await page.locator(".rankingFullScreen").waitFor({ timeout: 10000 });
  const snapshot = await page.evaluate(({ id, tokens }) => {
    const shell = document.querySelector(".rankingFullScreen");
    const hero = document.querySelector(".rankingHero");
    const board = document.querySelector(".rankingNoticeBoard");
    const text = shell?.textContent || "";
    const bodyText = document.body.innerText || "";
    const background = hero ? getComputedStyle(hero).backgroundImage : "";
    const html = document.documentElement;
    return {
      path: window.location.pathname,
      expectedPath: `/game/${id}/ranking`,
      hasHero: Boolean(hero),
      hasTopThree: Boolean(document.querySelector(".rankingTopThree")),
      hasBoard: Boolean(board),
      hasBoundary: text.includes("本榜只录服务器定榜结果"),
      hasServerList: text.includes("服务器定榜名单"),
      hasListOrEmpty: Boolean(document.querySelector(".rankingList")) || text.includes("榜文尚未张挂"),
      background,
      horizontalOverflow: html.scrollWidth > html.clientWidth + 4,
      forbiddenText: bodyText.match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || [],
      hiddenLeaks: tokens.filter((token) => bodyText.includes(token))
    };
  }, { id: sessionId, tokens: hiddenTextTokens });

  const failures = [];
  if (snapshot.path !== snapshot.expectedPath) failures.push(`path was ${snapshot.path}`);
  if (!snapshot.hasHero) failures.push("missing ranking hero");
  if (!snapshot.hasTopThree) failures.push("missing top-three ranking seals");
  if (!snapshot.hasBoard) failures.push("missing ranking notice board");
  if (!snapshot.hasBoundary) failures.push("missing server-owned ranking boundary");
  if (!snapshot.hasServerList) failures.push("missing server-owned ranking list heading");
  if (!snapshot.hasListOrEmpty) failures.push("missing ranking list or empty state");
  if (!snapshot.background.includes("/assets/ui/")) failures.push("ranking hero did not use a reviewed UI asset");
  if (snapshot.horizontalOverflow) failures.push("ranking page has horizontal overflow");
  if (snapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${snapshot.forbiddenText.join(", ")}`);
  if (snapshot.hiddenLeaks.length) failures.push(`hidden text leaked: ${snapshot.hiddenLeaks.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.8 ranking page smoke failed: ${failures.join("; ")}`);
  }

  return captureScreenshot(page, screenshotsDir, screenshotName);
}

async function startMockMagistrateThroughHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名").fill("烟测知县");
  await page.getByLabel("身份").selectOption("magistrate");
  await page.getByRole("button", { name: "新开一卷" }).click();
  return waitForSafeSessionPath(page, "magistrate home start");
}

async function assertMagistratePanel(page, sessionId, screenshotsDir) {
  await page.getByRole("heading", { name: "地方官署" }).waitFor({ timeout: 10000 });
  const panelSnapshot = await page.evaluate((id) => {
    const panel = document.querySelector(".magistratePanel");
    const text = panel?.textContent || "";
    const buttons = [...document.querySelectorAll(".magistratePanel button")].map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled
    }));
    const computedBackground = panel ? getComputedStyle(panel).getPropertyValue("--scholar-panel-bg") : "";
    return {
      text,
      metricCount: panel?.querySelectorAll(".scholarPanelMetrics li").length || 0,
      hasDocket: text.includes("案牍总览"),
      hasTrial: text.includes("公堂词讼"),
      hasFiscal: text.includes("钱粮仓储"),
      hasPatrol: text.includes("水利盗警"),
      hasGentry: text.includes("士绅乡约"),
      hasBoundary: text.includes("审案、征税、开仓、水利、缉捕、任免、考成和持久化都由服务器裁决"),
      buttons,
      background: computedBackground,
      path: window.location.pathname,
      expectedPath: `/game/${id}`,
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, sessionId);

  const failures = [];
  if (panelSnapshot.path !== panelSnapshot.expectedPath) failures.push(`path was ${panelSnapshot.path}`);
  if (!panelSnapshot.hasDocket) failures.push("missing docket overview");
  if (!panelSnapshot.hasTrial) failures.push("missing courtroom block");
  if (!panelSnapshot.hasFiscal) failures.push("missing fiscal block");
  if (!panelSnapshot.hasPatrol) failures.push("missing waterworks and patrol block");
  if (!panelSnapshot.hasGentry) failures.push("missing gentry block");
  if (!panelSnapshot.hasBoundary) failures.push("missing server boundary");
  if (panelSnapshot.metricCount < 8) failures.push(`expected local docket metrics, saw ${panelSnapshot.metricCount}`);
  if (!panelSnapshot.buttons.some((button) => button.text === "升堂核案" && !button.disabled)) failures.push("trial draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "清厘钱粮" && !button.disabled)) failures.push("fiscal draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "调停乡约" && !button.disabled)) failures.push("gentry draft button missing or disabled");
  if (panelSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${panelSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.3 magistrate panel smoke failed: ${failures.join("; ")}`);
  }

  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "升堂核案" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("升堂核问积案") && value.includes("不自行结案");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.3 magistrate draft button submitted a turn instead of writing a draft: ${turnRequests.join(", ")}`);
  }

  const draft = await page.getByLabel("本回合行动").inputValue();
  if (!draft.includes("升堂核问积案")) {
    throw new Error(`S76.3 magistrate draft did not enter the memorial composer: ${draft}`);
  }
  await page.getByLabel("本回合行动").fill("");

  return captureScreenshot(page, screenshotsDir, "s76-magistrate-panel-desktop");
}

async function startMockOfficialThroughHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名").fill("烟测翰林");
  await page.getByLabel("身份").selectOption("official");
  await page.getByRole("button", { name: "新开一卷" }).click();
  return waitForSafeSessionPath(page, "official home start");
}

async function startMockMinisterThroughHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名").fill("烟测堂官");
  await page.getByLabel("身份").selectOption("minister");
  await page.getByRole("button", { name: "新开一卷" }).click();
  return waitForSafeSessionPath(page, "minister home start");
}

async function assertOfficialMinisterPanel(page, sessionId, screenshotsDir, options = {}) {
  const roleLabel = options.roleLabel || "入仕官员";
  const screenshotName = options.screenshotName || "s76-official-panel-desktop";
  await page.getByRole("heading", { name: "部院官署" }).waitFor({ timeout: 10000 });
  const panelSnapshot = await page.evaluate(({ id, expectedRoleLabel }) => {
    const panel = document.querySelector(".officialMinisterPanel");
    const text = panel?.textContent || "";
    const courtLink = [...document.querySelectorAll(".officialMinisterPanel a")].find((link) => (link.textContent || "").includes("入朝议页"));
    const buttons = [...document.querySelectorAll(".officialMinisterPanel button")].map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled
    }));
    const computedBackground = panel
      ? `${panel.getAttribute("data-role-background") || ""} ${getComputedStyle(panel).getPropertyValue("--scholar-panel-bg")}`
      : "";
    return {
      text,
      metricCount: panel?.querySelectorAll(".scholarPanelMetrics li").length || 0,
      hasCareer: text.includes("官职履历"),
      hasAssignments: text.includes("部院公文"),
      hasNetwork: text.includes("同年座师与人脉"),
      hasFaction: text.includes("派系与朝局风险"),
      hasAssessment: text.includes("考成与弹劾"),
      hasMemorial: text.includes("奏疏入口"),
      hasExpectedRole: text.includes(expectedRoleLabel),
      hasBoundary: text.includes("不得在前端直接任免、奖惩、处分、弹劾成案或改写考成"),
      buttons,
      background: computedBackground,
      courtPath: courtLink ? new URL(courtLink.href).pathname : "",
      expectedCourtPath: `/game/${id}/court`,
      path: window.location.pathname,
      expectedPath: `/game/${id}`,
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, { id: sessionId, expectedRoleLabel: roleLabel });

  const failures = [];
  if (panelSnapshot.path !== panelSnapshot.expectedPath) failures.push(`path was ${panelSnapshot.path}`);
  if (!panelSnapshot.hasCareer) failures.push("missing career ledger");
  if (!panelSnapshot.hasAssignments) failures.push("missing bureau assignment block");
  if (!panelSnapshot.hasNetwork) failures.push("missing official network block");
  if (!panelSnapshot.hasFaction) failures.push("missing faction risk block");
  if (!panelSnapshot.hasAssessment) failures.push("missing assessment block");
  if (!panelSnapshot.hasMemorial) failures.push("missing memorial block");
  if (!panelSnapshot.hasExpectedRole) failures.push(`missing role label ${roleLabel}`);
  if (!panelSnapshot.hasBoundary) failures.push("missing server boundary");
  if (panelSnapshot.metricCount < 4) failures.push(`expected career metrics, saw ${panelSnapshot.metricCount}`);
  if (!panelSnapshot.buttons.some((button) => button.text === "查办公文" && !button.disabled)) failures.push("assignment draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "回应弹劾" && !button.disabled)) failures.push("impeachment draft button missing or disabled");
  if (panelSnapshot.courtPath !== panelSnapshot.expectedCourtPath) failures.push(`court link was ${panelSnapshot.courtPath}`);
  if (!panelSnapshot.background.includes("/assets/ui/")) failures.push("role background asset was not applied through the manifest registry");
  if (panelSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${panelSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.4 official minister panel smoke failed: ${failures.join("; ")}`);
  }

  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "回应弹劾" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("若有弹劾风声") && value.includes("不自行成案");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.4 official minister draft button submitted a turn instead of writing a draft: ${turnRequests.join(", ")}`);
  }

  const draft = await page.getByLabel("本回合行动").inputValue();
  if (!draft.includes("若有弹劾风声")) {
    throw new Error(`S76.4 official minister draft did not enter the memorial composer: ${draft}`);
  }
  await page.getByLabel("本回合行动").fill("");

  return captureScreenshot(page, screenshotsDir, screenshotName);
}

async function startMockGeneralThroughHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名").fill("烟测总兵");
  await page.getByLabel("身份").selectOption("general");
  await page.getByRole("button", { name: "新开一卷" }).click();
  return waitForSafeSessionPath(page, "general home start");
}

async function assertGeneralPanel(page, sessionId, screenshotsDir) {
  await page.getByRole("heading", { name: "将领军务" }).waitFor({ timeout: 10000 });
  const panelSnapshot = await page.evaluate((id) => {
    const panel = document.querySelector(".generalPanel");
    const text = panel?.textContent || "";
    const mapLink = [...document.querySelectorAll(".generalPanel a")].find((link) => (link.textContent || "").includes("入舆图页"));
    const archiveLink = [...document.querySelectorAll(".generalPanel a")].find((link) => (link.textContent || "").includes("查史册"));
    const buttons = [...document.querySelectorAll(".generalPanel button")].map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled
    }));
    const computedBackground = panel
      ? `${panel.getAttribute("data-role-background") || ""} ${getComputedStyle(panel).getPropertyValue("--scholar-panel-bg")}`
      : "";
    return {
      text,
      metricCount: panel?.querySelectorAll(".scholarPanelMetrics li").length || 0,
      hasCommand: text.includes("军帐总览"),
      hasSupply: text.includes("粮饷与军心"),
      hasScouts: text.includes("斥候与情报"),
      hasFrontier: text.includes("边患与舆图"),
      hasReports: text.includes("战报与边议"),
      hasBoundary: text.includes("战役胜负、调兵遣将、外交和战、统帅任免、粮饷拨付、赏罚与持久化都由服务器裁决"),
      buttons,
      background: computedBackground,
      mapPath: mapLink ? new URL(mapLink.href).pathname : "",
      archivePath: archiveLink ? new URL(archiveLink.href).pathname : "",
      expectedMapPath: `/game/${id}/map`,
      expectedArchivePath: `/game/${id}/archive`,
      path: window.location.pathname,
      expectedPath: `/game/${id}`,
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, sessionId);

  const failures = [];
  if (panelSnapshot.path !== panelSnapshot.expectedPath) failures.push(`path was ${panelSnapshot.path}`);
  if (!panelSnapshot.hasCommand) failures.push("missing command block");
  if (!panelSnapshot.hasSupply) failures.push("missing supply block");
  if (!panelSnapshot.hasScouts) failures.push("missing scout block");
  if (!panelSnapshot.hasFrontier) failures.push("missing frontier map block");
  if (!panelSnapshot.hasReports) failures.push("missing war report block");
  if (!panelSnapshot.hasBoundary) failures.push("missing server military boundary");
  if (panelSnapshot.metricCount < 4) failures.push(`expected military metrics, saw ${panelSnapshot.metricCount}`);
  if (!panelSnapshot.buttons.some((button) => button.text === "遣出斥候" && !button.disabled)) failures.push("scout draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "草拟战报" && !button.disabled)) failures.push("war report draft button missing or disabled");
  if (panelSnapshot.mapPath !== panelSnapshot.expectedMapPath) failures.push(`map link was ${panelSnapshot.mapPath}`);
  if (panelSnapshot.archivePath !== panelSnapshot.expectedArchivePath) failures.push(`archive link was ${panelSnapshot.archivePath}`);
  if (!panelSnapshot.background.includes("/assets/ui/")) failures.push("role background asset was not applied through the manifest registry");
  if (panelSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${panelSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.5 general panel smoke failed: ${failures.join("; ")}`);
  }

  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "遣出斥候" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("遣斥候") && value.includes("不自行判定隐藏军情");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.5 general draft button submitted a turn instead of writing a draft: ${turnRequests.join(", ")}`);
  }

  const draft = await page.getByLabel("本回合行动").inputValue();
  if (!draft.includes("遣斥候")) {
    throw new Error(`S76.5 general draft did not enter the memorial composer: ${draft}`);
  }
  await page.getByLabel("本回合行动").fill("");

  return captureScreenshot(page, screenshotsDir, "s76-general-panel-desktop");
}

async function startMockEmperorThroughHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名").fill("烟测御案");
  await page.getByLabel("身份").selectOption("emperor");
  await page.getByRole("button", { name: "新开一卷" }).click();
  return waitForSafeSessionPath(page, "emperor home start");
}

async function assertEmperorPanel(page, sessionId, screenshotsDir) {
  await page.getByRole("heading", { name: "御案朝仪" }).waitFor({ timeout: 10000 });
  const panelSnapshot = await page.evaluate((id) => {
    const panel = document.querySelector(".emperorPanel");
    const text = panel?.textContent || "";
    const courtLink = [...document.querySelectorAll(".emperorPanel a")].find((link) => (link.textContent || "").includes("入朝议页"));
    const archiveLink = [...document.querySelectorAll(".emperorPanel a")].find((link) => (link.textContent || "").includes("查史册"));
    const buttons = [...document.querySelectorAll(".emperorPanel button")].map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled
    }));
    const computedBackground = panel
      ? `${panel.getAttribute("data-role-background") || ""} ${getComputedStyle(panel).getPropertyValue("--scholar-panel-bg")}`
      : "";
    return {
      text,
      metricCount: panel?.querySelectorAll(".scholarPanelMetrics li").length || 0,
      hasMemorials: text.includes("奏折队列"),
      hasVermilion: text.includes("朱批拟稿"),
      hasEdict: text.includes("圣旨草稿"),
      hasCourt: text.includes("朝议"),
      hasAppointments: text.includes("任免候选"),
      hasRewards: text.includes("赏罚预留"),
      hasBoundary: text.includes("任免、赏罚、处分、朱批成案、圣旨生效、时间推进和持久化都由服务器裁决"),
      buttons,
      background: computedBackground,
      courtPath: courtLink ? new URL(courtLink.href).pathname : "",
      archivePath: archiveLink ? new URL(archiveLink.href).pathname : "",
      expectedCourtPath: `/game/${id}/court`,
      expectedArchivePath: `/game/${id}/archive`,
      path: window.location.pathname,
      expectedPath: `/game/${id}`,
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, sessionId);

  const failures = [];
  if (panelSnapshot.path !== panelSnapshot.expectedPath) failures.push(`path was ${panelSnapshot.path}`);
  if (!panelSnapshot.hasMemorials) failures.push("missing memorial queue block");
  if (!panelSnapshot.hasVermilion) failures.push("missing vermilion draft block");
  if (!panelSnapshot.hasEdict) failures.push("missing edict draft block");
  if (!panelSnapshot.hasCourt) failures.push("missing court debate block");
  if (!panelSnapshot.hasAppointments) failures.push("missing appointment candidate block");
  if (!panelSnapshot.hasRewards) failures.push("missing reward punishment block");
  if (!panelSnapshot.hasBoundary) failures.push("missing emperor server boundary");
  if (panelSnapshot.metricCount < 4) failures.push(`expected emperor metrics, saw ${panelSnapshot.metricCount}`);
  if (!panelSnapshot.buttons.some((button) => button.text === "拟旨" && !button.disabled)) failures.push("edict draft button missing or disabled");
  if (!panelSnapshot.buttons.some((button) => button.text === "朱批奏折" && !button.disabled)) failures.push("vermilion draft button missing or disabled");
  if (panelSnapshot.courtPath !== panelSnapshot.expectedCourtPath) failures.push(`court link was ${panelSnapshot.courtPath}`);
  if (panelSnapshot.archivePath !== panelSnapshot.expectedArchivePath) failures.push(`archive link was ${panelSnapshot.archivePath}`);
  if (!panelSnapshot.background.includes("/assets/ui/")) failures.push("role background asset was not applied through the manifest registry");
  if (panelSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${panelSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.6 emperor panel smoke failed: ${failures.join("; ")}`);
  }

  const turnRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === "/api/game/turn" && request.method() === "POST") {
        turnRequests.push(url.pathname);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "拟旨" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("草拟一道明发谕旨") && value.includes("此稿未生效");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (turnRequests.length) {
    throw new Error(`S76.6 emperor draft button submitted a turn instead of writing a draft: ${turnRequests.join(", ")}`);
  }

  const draft = await page.getByLabel("本回合行动").inputValue();
  if (!draft.includes("草拟一道明发谕旨")) {
    throw new Error(`S76.6 emperor draft did not enter the memorial composer: ${draft}`);
  }
  await page.getByLabel("本回合行动").fill("");

  return captureScreenshot(page, screenshotsDir, "s76-emperor-panel-desktop");
}

async function clickStableButton(page, buttonOptions, label) {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const locator = page.getByRole("button", buttonOptions).first();
    try {
      await locator.waitFor({ state: "visible", timeout: 10000 });
      await locator.click({ timeout: 10000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(350);
    }
  }
  throw new Error(`${label} could not be clicked before it refreshed: ${lastError?.message || lastError}`);
}

async function assertReturnHomeContinueAndTurn(page, sessionId, screenshotsDir) {
  const gamePath = `/game/${sessionId}`;

  await page.getByRole("button", { name: "打开印匣" }).click();
  const drawer = page.locator("aside.drawerHost[aria-label='印匣']");
  await drawer.waitFor({ timeout: 10000 });
  await drawer.getByRole("button", { name: "返回首页" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 10000 });
  await page.getByRole("link", { name: "继续本局" }).waitFor({ timeout: 10000 });
  const homeState = await page.evaluate((id) => {
    const continueLink = document.querySelector("a.continueButton");
    return {
      continueHref: continueLink ? new URL(continueLink.href).pathname : null,
      continueText: document.querySelector("[aria-label='当前本局']")?.textContent || "",
      emptyActionForm: Boolean(document.querySelector("form.actionPanel")),
      forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider\b|prompt\b|hidden\b|key\b|path\b|[a-z]:[\\/]|file:\/{2}|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions/gi) || [],
      expected: gamePathFor(id)
    };

    function gamePathFor(value) {
      return `/game/${value}`;
    }
  }, sessionId);
  if (homeState.continueHref !== gamePath) {
    throw new Error(`Continue link did not preserve current session: ${JSON.stringify(homeState)}`);
  }
  if (!homeState.continueText.includes("当前本局") || !homeState.continueText.includes("案 ")) {
    throw new Error(`Home continue shelf did not render a safe current-session summary: ${JSON.stringify(homeState)}`);
  }
  if (homeState.emptyActionForm) {
    throw new Error("Return home kept the game action form mounted.");
  }
  if (homeState.forbiddenText.length) {
    throw new Error(`Return-home continue shelf leaked forbidden text: ${homeState.forbiddenText.join(", ")}`);
  }
  const homeScreenshot = await assertCurrentReactClientPage(page, "/", "s75-return-home-continue-desktop", screenshotsDir, {
    readySelector: ".continueShelf"
  });

  await page.getByRole("link", { name: "继续本局" }).click();
  await page.waitForURL((url) => url.pathname === gamePath, { timeout: 10000 });
  await clickStableButton(page, { name: /温书 mock-ai 写入草稿/ }, "S75.9 quick action");
  await page.waitForFunction(() => {
    const value = document.querySelector("textarea")?.value || "";
    return value.includes("温习经义");
  }, null, { timeout: 10000 });
  const quickDraft = await page.getByLabel("本回合行动").inputValue();
  if (!quickDraft.includes("温习经义")) {
    throw new Error(`S75.9 quick action did not write a mock-ai draft: ${quickDraft}`);
  }
  const turnResponse = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      return url.pathname === "/api/game/turn" && response.request().method() === "POST";
    } catch {
      return false;
    }
  }, { timeout: 20000 });
  await page.getByLabel("本回合行动").press("Enter");
  await turnResponse;
  await page.getByRole("button", { name: "呈上" }).waitFor({ timeout: 20000 });
  await page.waitForFunction(() => !(document.querySelector("textarea")?.value || "").trim(), null, { timeout: 10000 });
  const continuedState = await page.evaluate(() => ({
    actionText: document.querySelector("textarea")?.value || "",
    quickActionSource: document.querySelector("[data-source='mock-ai'], [data-source='local-rule']")?.getAttribute("data-source") || "",
    forbiddenText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider\b|prompt\b|hidden\b|key\b|path\b|[a-z]:[\\/]|file:\/{2}|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions/gi) || []
  }));
  if (continuedState.actionText.includes("温习经义")) {
    throw new Error(`Action draft was not cleared after continued-session turn: ${JSON.stringify(continuedState)}`);
  }
  if (!/mock-ai|local-rule/.test(continuedState.quickActionSource)) {
    throw new Error(`S75.9 quick action source marker was not visible: ${JSON.stringify(continuedState)}`);
  }
  if (continuedState.forbiddenText.length) {
    throw new Error(`Continued-session turn leaked forbidden text: ${continuedState.forbiddenText.join(", ")}`);
  }

  return {
    homeScreenshot,
    gameScreenshot: await assertCurrentReactClientPage(page, gamePath, "s75-continue-turn-desktop", screenshotsDir)
  };
}

async function assertInkboxTab(page, drawer, tabName, expectedText) {
  await drawer.getByRole("tab", { name: tabName }).click();
  await page.waitForFunction(
    (name) => {
      return [...document.querySelectorAll("aside.drawerHost [role='tab']")].some((tab) => {
        return (tab.textContent || "").includes(name) && tab.getAttribute("aria-selected") === "true";
      });
    },
    tabName,
    { timeout: 10000 }
  );

  const snapshot = await drawer.evaluate((element, input) => {
    const { text, tokens } = input;
    const panel = element.querySelector(".inkboxPanel");
    const bodyText = document.body.innerText || "";
    return {
      panelText: panel?.textContent || "",
      hiddenLeaks: tokens.filter((token) => bodyText.includes(token)),
      hasExpectedText: Boolean(panel?.textContent?.includes(text))
    };
  }, { text: expectedText, tokens: hiddenTextTokens });

  if (!snapshot.hasExpectedText) {
    throw new Error(`Inkbox tab ${tabName} did not render expected panel text: ${JSON.stringify(snapshot)}`);
  }
  if (snapshot.hiddenLeaks.length) {
    throw new Error(`Inkbox tab ${tabName} leaked hidden text: ${snapshot.hiddenLeaks.join(", ")}`);
  }
}

async function assertInkboxTabsAndSaveLoad(page, sessionId, screenshotsDir) {
  const gamePath = `/game/${sessionId}`;
  const sessionShortCode = sessionId.slice(0, 8);

  await page.getByRole("button", { name: "打开印匣" }).click();
  const drawer = page.locator("aside.drawerHost[aria-label='印匣']");
  await drawer.waitFor({ timeout: 10000 });

  await assertInkboxTab(page, drawer, "AI 设置", "快捷建议 Provider");
  const quickBudget = await drawer.getByLabel("快捷建议工具预算固定为零").evaluate((input) => ({
    value: input instanceof HTMLInputElement ? input.value : "",
    disabled: input instanceof HTMLInputElement ? input.disabled : false
  }));
  if (quickBudget.value !== "0" || !quickBudget.disabled) {
    throw new Error(`Inkbox quick-action tool budget was not locked to zero: ${JSON.stringify(quickBudget)}`);
  }

  await assertInkboxTab(page, drawer, "显示", "显示偏好");
  await assertInkboxTab(page, drawer, "安全", "安全摘要");
  await drawer.getByRole("button", { name: "关闭抽屉" }).click();
  await drawer.waitFor({ state: "detached", timeout: 10000 });
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "打开印匣", null, { timeout: 5000 });

  await page.getByRole("button", { name: "打开印匣" }).click();
  await drawer.waitFor({ timeout: 10000 });
  await assertInkboxTab(page, drawer, "旧案", "旧案");
  const refreshButton = drawer.getByRole("button", { name: "刷新" });
  await refreshButton.waitFor({ timeout: 10000 });
  if (!(await refreshButton.isDisabled())) {
    const savesResponse = page.waitForResponse((response) => {
      try {
        const url = new URL(response.url());
        return url.pathname === "/api/game/saves" && response.request().method() === "GET";
      } catch {
        return false;
      }
    }, { timeout: 15000 });
    await refreshButton.click();
    await savesResponse;
  }

  const currentCase = drawer.locator(".saveCaseItem", { hasText: `案 ${sessionShortCode}` }).first();
  await currentCase.waitFor({ timeout: 10000 });
  const saveSnapshot = await currentCase.evaluate((element, tokens) => {
    const text = document.body.innerText || "";
    return {
      cardText: (element.textContent || "").slice(0, 500),
      hiddenLeaks: tokens.filter((token) => text.includes(token)),
      unsafeText: (document.body.innerText || "").match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|data\/sessions|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY/gi) || []
    };
  }, hiddenTextTokens);
  if (saveSnapshot.hiddenLeaks.length || saveSnapshot.unsafeText.length) {
    throw new Error(`Inkbox save list leaked unsafe text: ${JSON.stringify(saveSnapshot)}`);
  }

  const savesScreenshot = await captureScreenshot(page, screenshotsDir, "s75-inkbox-saves-tab-desktop");
  const playerStateResponse = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      return url.pathname === `/api/game/player-state/${sessionId}` && response.request().method() === "GET";
    } catch {
      return false;
    }
  }, { timeout: 15000 });
  await currentCase.getByRole("button", { name: "载入" }).click();
  await playerStateResponse;
  await page.waitForURL((url) => url.pathname === gamePath, { timeout: 10000 });
  await drawer.waitFor({ state: "detached", timeout: 10000 });

  return {
    savesScreenshot,
    loadedScreenshot: await assertCurrentReactClientPage(page, gamePath, "s75-inkbox-load-session-desktop", screenshotsDir)
  };
}

async function assertMobileInkbox(page, screenshotsDir) {
  await page.getByRole("button", { name: "打开印匣" }).click();
  const drawer = page.locator("aside.drawerHost[aria-label='印匣']");
  await drawer.waitFor({ timeout: 10000 });

  await assertInkboxTab(page, drawer, "AI 设置", "快捷建议 Provider");
  await assertInkboxTab(page, drawer, "旧案", "旧案");
  await assertInkboxTab(page, drawer, "显示", "显示偏好");
  await assertInkboxTab(page, drawer, "安全", "安全摘要");

  const metrics = await page.evaluate((tokens) => {
    const drawerElement = document.querySelector("aside.drawerHost[aria-label='印匣']");
    const rect = drawerElement?.getBoundingClientRect();
    const html = document.documentElement;
    return {
      drawerLeft: rect?.left ?? 0,
      drawerRight: rect?.right ?? 0,
      drawerWidth: rect?.width ?? 0,
      viewportWidth: window.innerWidth,
      tabCount: document.querySelectorAll("aside.drawerHost [role='tab']").length,
      horizontalOverflow: html.scrollWidth > html.clientWidth + 4,
      hiddenLeaks: tokens.filter((token) => (document.body.innerText || "").includes(token))
    };
  }, hiddenTextTokens);
  if (metrics.drawerWidth <= 0 || metrics.drawerLeft < -2 || metrics.drawerRight > metrics.viewportWidth + 2) {
    throw new Error(`Mobile inkbox drawer is outside the viewport: ${JSON.stringify(metrics)}`);
  }
  if (metrics.tabCount !== 4) {
    throw new Error(`Mobile inkbox did not render all tabs: ${JSON.stringify(metrics)}`);
  }
  if (metrics.horizontalOverflow) {
    throw new Error(`Mobile inkbox caused horizontal overflow: ${JSON.stringify(metrics)}`);
  }
  if (metrics.hiddenLeaks.length) {
    throw new Error(`Mobile inkbox leaked hidden text: ${metrics.hiddenLeaks.join(", ")}`);
  }

  const screenshot = await captureScreenshot(page, screenshotsDir, "s75-inkbox-mobile");
  await drawer.getByRole("button", { name: "关闭抽屉" }).click();
  await drawer.waitFor({ state: "detached", timeout: 10000 });
  return screenshot;
}

async function assertDisplayPreferencesPersistence(page, gamePath) {
  await page.getByRole("button", { name: "打开印匣" }).click();
  await page.getByRole("tab", { name: "显示" }).click();
  await page.getByRole("combobox", { name: "动效" }).selectOption("reduced");
  await page.getByRole("combobox", { name: "字号" }).selectOption("large");
  await page.getByRole("combobox", { name: "对比度" }).selectOption("high");
  await page.getByRole("checkbox", { name: "自动滚动新回合" }).uncheck();
  await page.getByRole("checkbox", { name: "舆图动效" }).uncheck();
  await page.getByRole("button", { name: "关闭抽屉" }).click();

  const storedBeforeReload = await page.evaluate(() => {
    const storageEntries = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      storageEntries.push([key, key ? window.localStorage.getItem(key) : null]);
    }
    return {
      shellMotion: document.querySelector(".appShell")?.getAttribute("data-motion"),
      shellTextSize: document.querySelector(".appShell")?.getAttribute("data-text-size"),
      shellContrast: document.querySelector(".appShell")?.getAttribute("data-contrast"),
      displayPreferences: JSON.parse(window.localStorage.getItem("qianqiu.displayPreferences.v1") || "{}"),
      storageEntries
    };
  });

  const expectedPreferences = {
    motion: "reduced",
    textSize: "large",
    contrast: "high",
    autoScroll: false,
    mapMotion: false
  };
  const serializedStorage = JSON.stringify(storedBeforeReload.storageEntries);
  if (storedBeforeReload.shellMotion !== "reduced" || storedBeforeReload.shellTextSize !== "large" || storedBeforeReload.shellContrast !== "high") {
    throw new Error(`Display preference data attributes did not update: ${JSON.stringify(storedBeforeReload)}`);
  }
  if (JSON.stringify(storedBeforeReload.displayPreferences?.preferences) !== JSON.stringify(expectedPreferences)) {
    throw new Error(`Display preferences were not saved as the safe whitelist payload: ${JSON.stringify(storedBeforeReload)}`);
  }
  if (/\/api\/game\/state|\/api\/dev\/session-diagnostics|worldState|raw\b|provider\b|prompt\b|hidden\b|data\/sessions|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/i.test(serializedStorage)) {
    throw new Error(`Display preference localStorage contained forbidden text: ${serializedStorage}`);
  }

  await page.reload({ waitUntil: "networkidle" });
  await assertCurrentReactClientPage(page, gamePath, "s75-display-preferences-reload-desktop", null);
  const restored = await page.evaluate(() => ({
    shellMotion: document.querySelector(".appShell")?.getAttribute("data-motion"),
    shellTextSize: document.querySelector(".appShell")?.getAttribute("data-text-size"),
    shellContrast: document.querySelector(".appShell")?.getAttribute("data-contrast")
  }));
  if (restored.shellMotion !== "reduced" || restored.shellTextSize !== "large" || restored.shellContrast !== "high") {
    throw new Error(`Display preferences did not survive reload: ${JSON.stringify(restored)}`);
  }
}

async function clickTopNavRoute(page, label, expectedPath) {
  const link = page.locator(".topNav a", { hasText: label }).first();
  await link.waitFor({ timeout: 10000 });
  await page.waitForFunction(
    ({ text, path }) => {
      return [...document.querySelectorAll(".topNav a")].some((anchor) => {
        return (anchor.textContent || "").trim() === text && new URL(anchor.href).pathname === path;
      });
    },
    { text: label, path: expectedPath },
    { timeout: 10000 }
  );
  await link.click();
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 10000 });
}

async function clickSessionNavRoute(page, label, expectedPath) {
  const link = page.locator(".sessionNav a", { hasText: label }).first();
  await link.waitFor({ timeout: 10000 });
  await page.waitForFunction(
    ({ text, path }) => {
      return [...document.querySelectorAll(".sessionNav a")].some((anchor) => {
        return (anchor.textContent || "").trim() === text && new URL(anchor.href).pathname === path;
      });
    },
    { text: label, path: expectedPath },
    { timeout: 10000 }
  );
  await link.click();
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 10000 });
}

async function assertRouteRefresh(page, pathname, label, screenshotsDir, options = {}) {
  await page.reload({ waitUntil: "networkidle" });
  return assertCurrentReactClientPage(page, pathname, label, screenshotsDir, options);
}

async function assertTopicSurfaces(page, sessionId, screenshotsDir) {
  await page.locator(".courtSurfacePage").waitFor({ timeout: 10000 });
  const initialSnapshot = await page.evaluate((tokens) => {
    const labels = ["奏折队列", "拟圣旨", "朝议", "堂审", "军议", "人物档案"];
    const bodyText = document.body.innerText || "";
    return {
      path: window.location.pathname,
      hasSurfacePage: Boolean(document.querySelector(".courtSurfacePage")),
      labels: labels.filter((label) => [...document.querySelectorAll(".courtSurfacePage button")].some((button) => (button.textContent || "").trim() === label)),
      hasBoundary: bodyText.includes("AI 只拟草稿，不提交回合、不调用 resolver、不写 canonical state"),
      hiddenLeaks: tokens.filter((token) => bodyText.includes(token)),
      forbiddenText: bodyText.match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, hiddenTextTokens);

  const failures = [];
  if (initialSnapshot.path !== `/game/${sessionId}/court`) failures.push(`path was ${initialSnapshot.path}`);
  if (!initialSnapshot.hasSurfacePage) failures.push("missing court surface page");
  if (initialSnapshot.labels.length !== 6) failures.push(`missing topic surface labels: ${initialSnapshot.labels.join(", ")}`);
  if (!initialSnapshot.hasBoundary) failures.push("missing draft-only surface boundary");
  if (initialSnapshot.hiddenLeaks.length) failures.push(`hidden text leaked: ${initialSnapshot.hiddenLeaks.join(", ")}`);
  if (initialSnapshot.forbiddenText.length) failures.push(`unsafe text leaked: ${initialSnapshot.forbiddenText.join(", ")}`);
  if (failures.length) {
    throw new Error(`S76.11 topic surface initial smoke failed: ${failures.join("; ")}`);
  }

  const topicLabels = ["奏折队列", "拟圣旨", "朝议", "堂审", "军议", "人物档案"];
  const unsafeRequests = [];
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if ((url.pathname === "/api/game/turn" && request.method() === "POST") || unsafeClientApiPathPatterns.some((pattern) => pattern.test(url.pathname))) {
        unsafeRequests.push(`${request.method()} ${url.pathname}`);
      }
    } catch {
    }
  };
  page.on("request", onRequest);
  for (const label of topicLabels) {
    await page.locator(".courtSurfacePage button", { hasText: new RegExp(`^${label}$`) }).click();
    await page.getByRole("dialog", { name: label }).waitFor({ timeout: 10000 });
    const dialogSnapshot = await page.evaluate(({ expectedLabel, tokens }) => {
      const dialog = document.querySelector(".localSurfacePanel");
      const bodyText = document.body.innerText || "";
      const dialogText = dialog?.textContent || "";
      return {
        dialogText,
        hasTitle: dialogText.includes(expectedLabel),
        hasDataSource: dialogText.includes("数据来源"),
        hasMaterials: dialogText.includes("材料"),
        hasDeliberation: dialogText.includes("筹议"),
        hasDraft: dialogText.includes("草稿"),
        hasResolverBoundary:
          dialogText.includes("服务器裁决") ||
          dialogText.includes("归服务器") ||
          dialogText.includes("裁决权") ||
          dialogText.includes("不写 canonical") ||
          dialogText.includes("裁决") ||
          dialogText.includes("不直接") ||
          dialogText.includes("不能调用"),
        hiddenLeaks: tokens.filter((token) => bodyText.includes(token)),
        forbiddenText: bodyText.match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
      };
    }, { expectedLabel: label, tokens: hiddenTextTokens });

    const perSurfaceFailures = [];
    if (!dialogSnapshot.hasTitle) perSurfaceFailures.push("missing title");
    if (!dialogSnapshot.hasDataSource) perSurfaceFailures.push("missing data source note");
    if (!dialogSnapshot.hasMaterials) perSurfaceFailures.push("missing materials column");
    if (!dialogSnapshot.hasDeliberation) perSurfaceFailures.push("missing deliberation column");
    if (!dialogSnapshot.hasDraft) perSurfaceFailures.push("missing draft column");
    if (!dialogSnapshot.hasResolverBoundary) perSurfaceFailures.push("missing resolver boundary");
    if (dialogSnapshot.hiddenLeaks.length) perSurfaceFailures.push(`hidden text leaked: ${dialogSnapshot.hiddenLeaks.join(", ")}`);
    if (dialogSnapshot.forbiddenText.length) perSurfaceFailures.push(`unsafe text leaked: ${dialogSnapshot.forbiddenText.join(", ")}`);
    if (perSurfaceFailures.length) {
      throw new Error(`S76.12 topic surface ${label} smoke failed: ${perSurfaceFailures.join("; ")}`);
    }

    await page.getByRole("button", { name: "关闭专题" }).click();
    await page.getByRole("dialog", { name: label }).waitFor({ state: "detached", timeout: 10000 });
  }

  await page.locator(".courtSurfacePage button", { hasText: /^朝议$/ }).click();
  await page.getByRole("dialog", { name: "朝议" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "AI 拟稿" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "AI 拟稿" }).click();
  await page.waitForFunction(() => {
    const textarea = document.querySelector('textarea[aria-label="专题草稿正文"]');
    return Boolean(textarea && textarea.value.includes("廷议"));
  }, null, { timeout: 10000 });
  await page.getByRole("button", { name: "写入底部奏折" }).click();
  await page.waitForTimeout(250);
  page.off("request", onRequest);
  if (unsafeRequests.length) {
    throw new Error(`S76.11 topic surface touched unsafe or turn API: ${unsafeRequests.join(", ")}`);
  }

  const surfaceSnapshot = await page.evaluate((tokens) => {
    const dialog = document.querySelector(".localSurfacePanel");
    const bodyText = document.body.innerText || "";
    return {
      dialogText: dialog?.textContent || "",
      draft: document.querySelector("textarea")?.value || "",
      hiddenLeaks: tokens.filter((token) => bodyText.includes(token)),
      forbiddenText: bodyText.match(/\/api\/game\/state|\/api\/dev\/session-diagnostics|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/gi) || []
    };
  }, hiddenTextTokens);

  const dialogFailures = [];
  if (!surfaceSnapshot.draft.includes("廷议")) dialogFailures.push(`draft did not enter memorial composer: ${surfaceSnapshot.draft}`);
  if (surfaceSnapshot.hiddenLeaks.length) dialogFailures.push(`hidden text leaked: ${surfaceSnapshot.hiddenLeaks.join(", ")}`);
  if (surfaceSnapshot.forbiddenText.length) dialogFailures.push(`unsafe text leaked: ${surfaceSnapshot.forbiddenText.join(", ")}`);
  if (dialogFailures.length) {
    throw new Error(`S76.11 topic surface dialog smoke failed: ${dialogFailures.join("; ")}`);
  }

  return captureScreenshot(page, screenshotsDir, "s78-topic-surfaces-desktop");
}

async function runClientSmoke(options = {}) {
  if (!options.url && !hasReactClientBuild()) {
    throw new Error("React client build not found. Run npm run build:client before client smoke.");
  }

  const previousAiProvider = process.env.AI_PROVIDER;
  if (!options.url) {
    process.env.AI_PROVIDER = "mock";
  }

  const browserPath = resolveBrowserExecutable({ browserPath: options.browserPath });
  const server = options.url ? null : createFetchSafeServer(app);
  const baseUrl = options.url || server.baseUrl;
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: !options.headed
  });
  const pageErrors = [];
  const unsafeApiRequests = [];
  const screenshots = [];

  try {
    const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      try {
        const { pathname } = new URL(request.url());
        if (unsafeClientApiPathPatterns.some((pattern) => pattern.test(pathname))) {
          unsafeApiRequests.push(pathname);
        }
      } catch {
      }
    });

    screenshots.push(await assertReactClientPage(page, baseUrl, "/", "s74-react-home-desktop", options.screenshotsDir));
    const mockStart = await startMockGameThroughHome(page, options.screenshotsDir);
    const startedSessionId = mockStart.sessionId;
    screenshots.push(mockStart.screenshot);
    screenshots.push(await assertScholarPanel(page, startedSessionId, options.screenshotsDir));
    const continueFlow = await assertReturnHomeContinueAndTurn(page, startedSessionId, options.screenshotsDir);
    screenshots.push(continueFlow.homeScreenshot);
    screenshots.push(continueFlow.gameScreenshot);
    const inkboxFlow = await assertInkboxTabsAndSaveLoad(page, startedSessionId, options.screenshotsDir);
    screenshots.push(inkboxFlow.savesScreenshot);
    screenshots.push(inkboxFlow.loadedScreenshot);
    await assertDisplayPreferencesPersistence(page, `/game/${startedSessionId}`);
    const runtimeMapPath = `/game/${startedSessionId}/map`;
    await clickTopNavRoute(page, "舆图", runtimeMapPath);
    screenshots.push(
      await assertCurrentReactClientPage(page, runtimeMapPath, "s74-react-map-runtime-desktop", options.screenshotsDir, {
        readySelector: ".inkMapRuntimeBridge canvas"
      })
    );
    await page.locator(".inkMapRuntimeBridge canvas").first().waitFor({ timeout: 15000 });
    const mapRuntime = await page.evaluate(() => {
      const bridge = document.querySelector(".inkMapRuntimeBridge");
      const canvas = bridge?.querySelector("canvas");
      const labels = [...document.querySelectorAll(".inkMapLabel")];
      return {
        hasFullScreen: Boolean(document.querySelector(".mapFullScreen")),
        hasLayerControls: document.querySelectorAll(".mapLayerToggle").length >= 3,
        hasSituationLedger: Boolean(document.querySelector(".mapSituationLedger")),
        hasArchiveJump: [...document.querySelectorAll(".mapFullScreen a")].some((link) => (link.textContent || "").includes("入局势簿")),
        hasBoundary: (document.body.innerText || "").includes("地图显示坐标只用于浏览器布局"),
        status: bridge?.getAttribute("data-map-status"),
        motion: bridge?.getAttribute("data-map-motion"),
        canvasWidth: canvas?.clientWidth || 0,
        canvasHeight: canvas?.clientHeight || 0,
        labelCount: labels.length,
        forbiddenText: (document.body.innerText || "").match(/public\/app\.js|#action-input|#information-panel|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY/gi) || []
      };
    });
    if (!mapRuntime.hasFullScreen || !mapRuntime.hasLayerControls || !mapRuntime.hasSituationLedger || !mapRuntime.hasArchiveJump || !mapRuntime.hasBoundary) {
      throw new Error(`React map runtime missing S76.9 independent map shell: ${JSON.stringify(mapRuntime)}`);
    }
    if (mapRuntime.motion !== "reduced") {
      throw new Error(`React map runtime ignored reduced display preference: ${JSON.stringify(mapRuntime)}`);
    }
    if (mapRuntime.canvasWidth <= 0 || mapRuntime.canvasHeight <= 0) {
      throw new Error(`React map runtime canvas is empty: ${JSON.stringify(mapRuntime)}`);
    }
    if (mapRuntime.labelCount <= 0) {
      throw new Error(`React map runtime rendered no safe labels: ${JSON.stringify(mapRuntime)}`);
    }
    if (mapRuntime.forbiddenText.length) {
      throw new Error(`React map runtime leaked forbidden text: ${mapRuntime.forbiddenText.join(", ")}`);
    }
    await page.getByLabel("地点").uncheck();
    await page.waitForFunction(() => document.querySelectorAll(".inkMapLabel").length === 0);
    await page.getByLabel("地点").check();
    await page.locator(".inkMapLabel").first().waitFor({ timeout: 10000 });
    await page.locator(".inkMapLabel").first().click();
    await page.locator(".inkMapTooltip").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "收起地图近事" }).click();
    await page.locator(".inkMapTooltip").waitFor({ state: "detached", timeout: 10000 });
    screenshots.push(
      await assertRouteRefresh(page, runtimeMapPath, "s74-react-map-runtime-refresh-desktop", options.screenshotsDir, {
        readySelector: ".inkMapRuntimeBridge canvas"
      })
    );

    const peoplePath = `/game/${startedSessionId}/people`;
    await clickTopNavRoute(page, "人物", peoplePath);
    screenshots.push(
      await assertCurrentReactClientPage(page, peoplePath, "s76-people-ledger-desktop", options.screenshotsDir, {
        readySelector: ".peopleLedgerList"
      })
    );
    const portraitLedger = await page.evaluate(() => {
      const grid = document.querySelector(".peopleLedgerList");
      const images = [...document.querySelectorAll(".peopleLedgerList img")];
      return {
        visible: Number(grid?.getAttribute("data-visible-people") || 0),
        total: Number(grid?.getAttribute("data-total-people") || 0),
        eagerImages: images.filter((image) => image.getAttribute("loading") !== "lazy").length,
        fullPoolCount: Number(grid?.getAttribute("data-total-portraits") || 0),
        localOrRawLeaks: (document.body.innerText || "").match(/artifacts|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions/gi) || []
      };
    });
    if (portraitLedger.visible > 8 || portraitLedger.visible <= 0) {
      throw new Error(`People ledger loaded an unsafe initial person count: ${portraitLedger.visible}`);
    }
    if (portraitLedger.total <= 0 || portraitLedger.total > 80) {
      throw new Error(`People ledger did not stay on the current public person view: ${portraitLedger.total}`);
    }
    if (portraitLedger.fullPoolCount > 0) {
      throw new Error(`People ledger exposed a manifest pool count instead of current people: ${portraitLedger.fullPoolCount}`);
    }
    if (portraitLedger.eagerImages > 0) {
      throw new Error(`People ledger rendered non-lazy portrait image(s): ${portraitLedger.eagerImages}`);
    }
    if (portraitLedger.localOrRawLeaks.length) {
      throw new Error(`People ledger leaked forbidden text: ${portraitLedger.localOrRawLeaks.join(", ")}`);
    }
    screenshots.push(
      await assertRouteRefresh(page, peoplePath, "s76-people-ledger-refresh-desktop", options.screenshotsDir, {
        readySelector: ".peopleLedgerList"
      })
    );

    const archivePath = `/game/${startedSessionId}/archive`;
    await clickTopNavRoute(page, "史册", archivePath);
    screenshots.push(
      await assertCurrentReactClientPage(page, archivePath, "s74-react-archive-desktop", options.screenshotsDir, {
        readySelector: "#archive-title"
      })
    );
    screenshots.push(
      await assertRouteRefresh(page, archivePath, "s74-react-archive-refresh-desktop", options.screenshotsDir, {
        readySelector: "#archive-title"
      })
    );

    const examPath = `/game/${startedSessionId}/exam`;
    await clickSessionNavRoute(page, "科举", examPath);
    screenshots.push(await assertExamFullScreen(page, startedSessionId, options.screenshotsDir));
    screenshots.push(
      await assertRouteRefresh(page, examPath, "s76-exam-fullscreen-refresh-desktop", options.screenshotsDir, {
        readySelector: ".examFullScreen"
      })
    );

    const rankingPath = `/game/${startedSessionId}/ranking`;
    await clickSessionNavRoute(page, "皇榜", rankingPath);
    screenshots.push(await assertRankingFullScreen(page, startedSessionId, options.screenshotsDir));
    screenshots.push(
      await assertRouteRefresh(page, rankingPath, "s76-ranking-fullscreen-refresh-desktop", options.screenshotsDir, {
        readySelector: ".rankingFullScreen"
      })
    );

    const sessionRouteChecks = [
      { label: "朝议", path: `/game/${startedSessionId}/court`, selector: "#court-title", screenshot: "s74-react-court-refresh-desktop" },
      { label: "印匣", path: `/game/${startedSessionId}/settings`, selector: "#settings-title", screenshot: "s74-react-settings-refresh-desktop" }
    ];
    for (const route of sessionRouteChecks) {
      await clickSessionNavRoute(page, route.label, route.path);
      await assertCurrentReactClientPage(page, route.path, route.screenshot.replace("-refresh", ""), null, {
        readySelector: route.selector
      });
      if (route.label === "朝议") {
        screenshots.push(await assertTopicSurfaces(page, startedSessionId, options.screenshotsDir));
      }
      screenshots.push(
        await assertRouteRefresh(page, route.path, route.screenshot, options.screenshotsDir, {
          readySelector: route.selector
        })
      );
    }

    const magistrateSessionId = await startMockMagistrateThroughHome(page, baseUrl);
    screenshots.push(await assertMagistratePanel(page, magistrateSessionId, options.screenshotsDir));
    const officialSessionId = await startMockOfficialThroughHome(page, baseUrl);
    screenshots.push(await assertOfficialMinisterPanel(page, officialSessionId, options.screenshotsDir, {
      roleLabel: "入仕官员",
      screenshotName: "s76-official-panel-desktop"
    }));
    const ministerSessionId = await startMockMinisterThroughHome(page, baseUrl);
    screenshots.push(await assertOfficialMinisterPanel(page, ministerSessionId, options.screenshotsDir, {
      roleLabel: "大臣",
      screenshotName: "s76-minister-panel-desktop"
    }));
    const generalSessionId = await startMockGeneralThroughHome(page, baseUrl);
    screenshots.push(await assertGeneralPanel(page, generalSessionId, options.screenshotsDir));
    const emperorSessionId = await startMockEmperorThroughHome(page, baseUrl);
    screenshots.push(await assertEmperorPanel(page, emperorSessionId, options.screenshotsDir));

    const health = await page.evaluate(async () => {
      const response = await fetch("/api/health");
      return { ok: response.ok, payload: await response.json() };
    });
    if (!health.ok || health.payload?.ok !== true) {
      throw new Error(`Health API failed through React server: ${JSON.stringify(health)}`);
    }

    await page.setViewportSize(VIEWPORTS.mobile);
    screenshots.push(
      await assertReactClientPage(page, baseUrl, `/game/${startedSessionId}`, "s75-memorial-composer-mobile", options.screenshotsDir, {
        readySelector: ".memorialComposer"
      })
    );
    const mobileComposer = await page.evaluate(() => {
      const composer = document.querySelector(".memorialComposer")?.getBoundingClientRect();
      const textarea = document.querySelector(".memorialComposer textarea")?.getBoundingClientRect();
      const html = document.documentElement;
      return {
        composerBottom: composer?.bottom || 0,
        composerTop: composer?.top || 0,
        textareaHeight: textarea?.height || 0,
        viewportHeight: window.innerHeight,
        horizontalOverflow: html.scrollWidth > html.clientWidth + 4,
        forbiddenText: (document.body.innerText || "").match(/provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions/gi) || []
      };
    });
    if (mobileComposer.composerBottom > mobileComposer.viewportHeight + 2 || mobileComposer.composerTop < 0 || mobileComposer.textareaHeight < 56) {
      throw new Error(`S75.8 mobile memorial composer is mispositioned: ${JSON.stringify(mobileComposer)}`);
    }
    if (mobileComposer.horizontalOverflow) {
      throw new Error(`S75.8 mobile memorial composer caused horizontal overflow: ${JSON.stringify(mobileComposer)}`);
    }
    if (mobileComposer.forbiddenText.length) {
      throw new Error(`S75.8 mobile memorial composer leaked forbidden text: ${mobileComposer.forbiddenText.join(", ")}`);
    }
    await page.goto(`${baseUrl}${examPath}`, { waitUntil: "networkidle" });
    screenshots.push(await assertExamFullScreen(page, startedSessionId, options.screenshotsDir, "s76-exam-fullscreen-mobile", { clickQuestion: false }));
    await page.goto(`${baseUrl}${rankingPath}`, { waitUntil: "networkidle" });
    screenshots.push(await assertRankingFullScreen(page, startedSessionId, options.screenshotsDir, "s76-ranking-fullscreen-mobile"));
    await page.goto(`${baseUrl}${runtimeMapPath}`, { waitUntil: "networkidle" });
    screenshots.push(
      await assertCurrentReactClientPage(page, runtimeMapPath, "s76-map-fullscreen-mobile", options.screenshotsDir, {
        readySelector: ".mapFullScreen .inkMapRuntimeBridge canvas"
      })
    );
    const mobileMap = await page.evaluate(() => {
      const html = document.documentElement;
      const stage = document.querySelector(".mapFullScreen .inkMapStage")?.getBoundingClientRect();
      return {
        hasFullScreen: Boolean(document.querySelector(".mapFullScreen")),
        hasLayerControls: document.querySelectorAll(".mapLayerToggle").length >= 3,
        hasSituationLedger: Boolean(document.querySelector(".mapSituationLedger")),
        stageHeight: stage?.height || 0,
        viewportHeight: window.innerHeight,
        horizontalOverflow: html.scrollWidth > html.clientWidth + 2,
        forbiddenText: (document.body.innerText || "").match(/public\/app\.js|#action-input|#information-panel|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY/gi) || []
      };
    });
    if (!mobileMap.hasFullScreen || !mobileMap.hasLayerControls || !mobileMap.hasSituationLedger || mobileMap.stageHeight < mobileMap.viewportHeight * 0.45) {
      throw new Error(`S76.9 mobile map is missing the independent map layout: ${JSON.stringify(mobileMap)}`);
    }
    if (mobileMap.horizontalOverflow) {
      throw new Error(`S76.9 mobile map caused horizontal overflow: ${JSON.stringify(mobileMap)}`);
    }
    if (mobileMap.forbiddenText.length) {
      throw new Error(`S76.9 mobile map leaked forbidden text: ${mobileMap.forbiddenText.join(", ")}`);
    }
    screenshots.push(await assertMobileInkbox(page, options.screenshotsDir));
    screenshots.push(await assertReactClientPage(page, baseUrl, "/", "s74-react-home-mobile", options.screenshotsDir));
    await context.close();

    if (pageErrors.length) {
      throw new Error(`Client smoke page errors detected: ${pageErrors.join("; ")}`);
    }
    if (unsafeApiRequests.length) {
      throw new Error(`React client smoke touched unsafe API path(s): ${[...new Set(unsafeApiRequests)].join(", ")}`);
    }

    return {
      baseUrl,
      screenshots,
      viewports: [
        "desktop-home",
        "desktop-mock-start",
        "desktop-scholar-panel",
        "desktop-return-home-continue",
        "desktop-continue-turn",
        "desktop-inkbox-tabs",
        "desktop-inkbox-load-session",
        "desktop-display-preferences-reload",
        "desktop-map-runtime",
        "desktop-map-refresh",
        "desktop-people-assets",
        "desktop-people-refresh",
        "desktop-archive-refresh",
        "desktop-exam-fullscreen",
        "desktop-exam-fullscreen-refresh",
        "desktop-ranking-fullscreen",
        "desktop-ranking-fullscreen-refresh",
        "desktop-topic-surfaces",
        "desktop-court-refresh",
        "desktop-settings-refresh",
        "desktop-magistrate-panel",
        "desktop-official-panel",
        "desktop-minister-panel",
        "desktop-general-panel",
        "desktop-emperor-panel",
        "mobile-memorial-composer",
        "mobile-exam-fullscreen",
        "mobile-ranking-fullscreen",
        "mobile-map-fullscreen",
        "mobile-inkbox-tabs",
        "mobile-home"
      ]
    };
  } finally {
    await browser.close();
    if (server) await server.close();
    if (!options.url) {
      if (previousAiProvider === undefined) {
        delete process.env.AI_PROVIDER;
      } else {
        process.env.AI_PROVIDER = previousAiProvider;
      }
    }
  }
}

function printHelp() {
  console.log(`Usage: npm run smoke:browser -- [options]

Options:
  --url <url>          Test an already running Qianqiu server.
  --client react       Explicitly select the current React client smoke target.
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
