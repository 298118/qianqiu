const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  return createFetchSafeServer(app);
}

async function postJson(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

async function removeSession(sessionId) {
  if (!sessionId) return;
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function parseSse(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");
      return {
        event: eventLine ? eventLine.slice(6).trim() : "message",
        data: data ? JSON.parse(data) : null
      };
    });
}

function assertHiddenSafe(payload) {
  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes("hiddenNotes"));
  assert.ok(!serialized.includes("OPENAI_API_KEY"));
  assert.ok(!serialized.includes("rawPrompt"));
  assert.ok(!serialized.includes("data/sessions"));
  assert.ok(!serialized.includes("prompt_retrieval_index"));
}

test("S70.10 official month-end turn returns player monthly briefing view, archive item, and AI observability", async (t) => {
  const server = createTestServer();
  let sessionId = "";
  t.after(async () => {
    await removeSession(sessionId);
    await server.close();
  });

  const started = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "月报路由"
  });
  assert.equal(started.response.status, 201);
  sessionId = started.payload.sessionId;

  const worldState = await readSession(sessionId);
  worldState.month = 3;
  worldState.tenDayPeriod = 3;
  Object.assign(worldState.player, {
    officeTitle: "翰林院编修",
    position: "翰林院编修"
  });
  worldState.officialCareer.currentPosting = "翰林院编修";
  worldState.officialCareer.assignments = [{
    id: "ASG-0000-first-month-top_hanlin_editor",
    title: "馆阁讲章校订",
    kind: "memorial_drafting",
    dueTurn: 3,
    deadlineUnit: "ten_day",
    progress: 52,
    risk: 18,
    visibleSummary: "首月须校订馆阁讲章并试拟制诰。"
  }];
  await writeSession(worldState);

  const turned = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId,
    input: "整饬本署文案，呈报上官。"
  });

  assert.equal(turned.response.status, 200);
  assert.equal(turned.payload.worldTick.completedMonth, true);
  assert.equal(turned.payload.playerMonthlyBriefing.generated, true);
  assert.match(turned.payload.playerMonthlyBriefing.summary, /本月要点|官务/);
  assert.equal(turned.payload.playerMonthlyBriefingView.active, true);
  assert.equal(turned.payload.playerMonthlyBriefingView.latest.periodKey, "1644-03");
  assert.equal(
    turned.payload.playerMonthlyBriefingView.latest.reportId,
    turned.payload.playerMonthlyBriefing.reportId
  );
  assert.ok(turned.payload.playerMonthlyBriefingView.latest.sections.length >= 3);
  assert.ok(
    turned.payload.playerMonthlyBriefingView.latest.sections
      .some((section) => section.id === "official_duties" && JSON.stringify(section).includes("馆阁讲章校订"))
  );
  assert.ok(turned.payload.worldState.playerMonthlyBriefing.reports.length >= 1);
  assert.ok(turned.payload.eventArchiveView.items.some((item) => item.sourceType === "monthly_briefing"));
  assert.ok(
    turned.payload.aiInvocationSummaryView.recentInvocations
      .some((invocation) => invocation.taskType === "monthly_briefing")
  );
  assertHiddenSafe(turned.payload.playerMonthlyBriefingView);
});

test("S70.10 month-end SSE preview and final payload include player monthly briefing views", async (t) => {
  const server = createTestServer();
  let sessionId = "";
  t.after(async () => {
    await removeSession(sessionId);
    await server.close();
  });

  const started = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "月报流式"
  });
  assert.equal(started.response.status, 201);
  sessionId = started.payload.sessionId;

  const worldState = await readSession(sessionId);
  worldState.month = 4;
  worldState.tenDayPeriod = 3;
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn?stream=1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify({
      sessionId,
      input: "月末整理本署文书，候上官批示。"
    })
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/event-stream/);

  const events = parseSse(await response.text());
  const previews = events.filter((event) => event.event === "state_preview");
  const finalState = events.find((event) => event.event === "final_state");
  const monthlyPreview = previews.find((event) => event.data?.playerMonthlyBriefingView?.latest);

  assert.ok(monthlyPreview);
  assert.equal(monthlyPreview.data.playerMonthlyBriefing.generated, true);
  assert.equal(monthlyPreview.data.playerMonthlyBriefingView.latest.periodKey, "1644-04");
  assert.ok(finalState);
  assert.equal(finalState.data.playerMonthlyBriefing.generated, true);
  assert.equal(finalState.data.playerMonthlyBriefingView.latest.periodKey, "1644-04");
  assertHiddenSafe(finalState.data.playerMonthlyBriefingView);
});
