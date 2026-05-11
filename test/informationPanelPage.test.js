const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const {
  buildInformationPanelPageView,
  buildInformationPanelPageViews
} = require("../src/game/informationPanelPage");
const { createWorldContentFixture } = require("../src/game/worldContentFixtures");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  return createFetchSafeServer(app);
}

test("S66.2 information panel page projects route views with search, filter and pagination", () => {
  const fixture = createWorldContentFixture({ size: "small" });
  const page = buildInformationPanelPageView(fixture.worldState, {
    tabId: "world-people",
    filter: "npc",
    query: "人物",
    page: 2,
    pageSize: 5,
    sort: "risk"
  });

  assert.equal(page.schemaVersion, 1);
  assert.equal(page.tabId, "world-people");
  assert.equal(page.source, "route_view_projection");
  assert.equal(page.filter, "npc");
  assert.equal(page.query, "人物");
  assert.equal(page.sort, "risk");
  assert.equal(page.pagination.pageSize, 5);
  assert.equal(page.items.length <= 5, true);
  assert.equal(page.pagination.totalItems, page.counts.filtered);
  assert.equal(page.filters.some((filter) => filter.value === "npc" && filter.count > 0), true);
  assert.ok(page.items.every((item) => item.kind === "npc"));
  assert.ok(page.items.every((item) => item.title && item.summary && item.sourceView === "worldPeopleView.npcs"));
});

test("S66.2 information panel page filters unsafe query text and never returns raw internals", () => {
  const fixture = createWorldContentFixture({ size: "small" });
  fixture.worldState.worldGeography.cities[0].publicSummary = "prompt_retrieval_index data/sessions/secret sk-unsafe-token";
  fixture.worldState.worldPeople.npcs[0].publicSummary = "hiddenNotes provider proposal";

  const page = buildInformationPanelPageView(fixture.worldState, {
    tabId: "world-geography",
    query: "prompt_retrieval_index",
    pageSize: 8
  });
  const payload = JSON.stringify(page);

  assert.equal(page.query, "");
  assert.equal(page.queryRejected, true);
  assert.doesNotMatch(payload, /prompt_retrieval_index|data\/sessions|sk-unsafe-token|hiddenNotes|provider|proposal/);
  assert.match(page.hiddenNotice, /服务器整理的可见视图/);
});

test("S66.2 information panel page redacts current environment secret values", () => {
  const previous = process.env.QIANQIU_TEST_SECRET;
  process.env.QIANQIU_TEST_SECRET = "plain-secret-value-87654321";
  try {
    const fixture = createWorldContentFixture({ size: "small" });
    const page = buildInformationPanelPageView(
      fixture.worldState,
      {
        tabId: "world-geography",
        filter: "city",
        pageSize: 4
      },
      {
        worldGeographyView: {
          countries: [],
          cities: [
            {
              id: "secret-test-city",
              name: "验密府",
              status: "stable",
              statusLabel: "安堵",
              publicSummary: "可见摘要 plain-secret-value-87654321 与片段 plain-secr",
              pressure: 12,
              localOrder: 80,
              grainStress: 11,
              visibility: "public"
            }
          ],
          routes: [],
          frontierZones: [],
          officeJurisdictions: []
        },
        worldPeopleView: {},
        officialPostingsView: {}
      }
    );
    const payload = JSON.stringify(page);

    assert.doesNotMatch(payload, /plain-secret-value-87654321|plain-secr/);
    assert.match(payload, /\[redacted\]/);
  } finally {
    if (previous === undefined) {
      delete process.env.QIANQIU_TEST_SECRET;
    } else {
      process.env.QIANQIU_TEST_SECRET = previous;
    }
  }
});

test("S66.2 information panel page collection uses tab defaults and supplied route views", () => {
  const fixture = createWorldContentFixture({ size: "small" });
  const prebuiltViews = {
    worldGeographyView: {
      countries: [],
      cities: [
        {
          id: "visible-test-city",
          name: "验收府",
          status: "stable",
          statusLabel: "安堵",
          publicSummary: "只读预构建地理视图。",
          pressure: 12,
          localOrder: 88,
          grainStress: 10,
          visibility: "public"
        }
      ],
      routes: [],
      frontierZones: [],
      officeJurisdictions: []
    },
    worldPeopleView: {
      npcs: [
        {
          id: "visible-test-npc",
          name: "验收士人",
          rankLabel: "可见人物",
          publicSummary: "只读预构建人物视图。",
          reputation: 42,
          influence: 31,
          resentmentRisk: 7,
          visibility: "public"
        }
      ],
      households: [],
      assets: [],
      estates: [],
      relationships: []
    },
    officialPostingsView: {
      bureaus: [],
      offices: [],
      postings: [],
      assessmentRecords: [],
      transferRecords: [],
      cityJurisdictions: []
    }
  };

  const panel = buildInformationPanelPageViews(fixture.worldState, { tabId: "world-people" }, prebuiltViews);
  const geography = panel.pages.find((page) => page.tabId === "world-geography");
  const people = panel.activePage;

  assert.equal(geography.sort, "pressure");
  assert.equal(people.filter, "npc");
  assert.equal(people.sort, "risk");
  assert.equal(people.counts.totalAvailable, 1);
  assert.equal(people.items[0].id, "visible-test-npc");
  assert.equal(JSON.stringify(panel).includes("验收府"), true);
});

test("S66.2 information panel page collection ignores undefined query options", () => {
  const fixture = createWorldContentFixture({ size: "small" });
  const panel = buildInformationPanelPageViews(fixture.worldState, {
    tabId: "world-people",
    filter: undefined,
    sort: undefined
  });
  const active = panel.activePage;

  assert.equal(active.tabId, "world-people");
  assert.equal(active.filter, "npc");
  assert.equal(active.sort, "risk");
});

test("GET /api/game/state exposes S66.2 paged information panel metadata", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const fixture = createWorldContentFixture({ size: "small" });
  await writeSession(fixture.worldState);
  t.after(() => removeSessionArtifacts(fixture.worldState.sessionId));

  const response = await fetch(
    `${server.baseUrl}/api/game/state/${fixture.worldState.sessionId}?informationTab=official-postings&informationFilter=posting&informationPage=1&informationPageSize=4&informationSort=risk`
  );
  const payload = await response.json();
  const panel = payload.informationPanelPageView;
  const active = panel.activePage;

  assert.equal(response.status, 200);
  assert.equal(panel.schemaVersion, 1);
  assert.equal(panel.activeTabId, "official-postings");
  assert.equal(panel.pages.length, 5);
  assert.equal(active.tabId, "official-postings");
  assert.equal(active.filter, "posting");
  assert.equal(active.sort, "risk");
  assert.equal(active.pagination.pageSize, 4);
  assert.equal(active.items.length <= 4, true);
  assert.equal(active.counts.pageItems, active.items.length);
  assert.ok(active.items.every((item) => item.kind === "posting"));
  assert.ok(active.items.every((item) => item.sourceView.startsWith("officialPostingsView")));
  assert.equal(payload.eventArchiveView.pagination.pageSize > 0, true);
});
