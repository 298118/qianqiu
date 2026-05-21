const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { assemblePromptContext } = require("../src/ai/promptContextAssembler");
const { createInitialState } = require("../src/game/initialState");
const { buildResolverInputContext, assertResolverInputSafe } = require("../src/game/resolverInputContext");
const { buildRoleCycleView } = require("../src/game/roleCycleView");
const { ensureStudyProfileState } = require("../src/game/studyProfile");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  return createFetchSafeServer(app);
}

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function assertNoUnsafeRoleCycleText(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /hidden[ _-]?(?:notes?|intent)|provider\s+payload|rawSql|SQL|sqlite|world_sessions|world_state_json|data[\\/](?:sessions|audit)|prompt_retrieval_index|event_log|sk-test-secret|OPENAI_API_KEY|statePatch|AI 不得|本视图只含|数据库|隐藏情报/i
  );
  assert.doesNotMatch(serialized, /已任免|已处分|已赏罚|准奏|革职|拨给钱粮|圣旨已生效/);
}

test("S88.5 roleCycleView exposes a safe current loop and six-role matrix for every identity", () => {
  for (const role of ["scholar", "magistrate", "official", "minister", "general", "emperor"]) {
    const worldState = createInitialState({ role, playerName: `循环-${role}` });
    const view = buildRoleCycleView(worldState);

    assert.equal(view.activeRole, role);
    assert.equal(view.currentRole.role, role);
    assert.equal(view.currentRole.items.length > 0, true, `${role} should expose current role items`);
    assert.equal(view.currentRole.nextActions.length > 0, true, `${role} should expose draft actions`);
    assert.equal(view.roleMatrix.length, 6);
    assert.equal(view.roleMatrix.filter((entry) => entry.enabled).length, 1);
    assert.ok(view.aiReadScope.allowedSourceViews.length > 0);
    assert.equal(view.safety.readOnlyView, true);
    assert.equal(view.safety.draftOnlyFrontend, true);
    assertNoUnsafeRoleCycleText(view);
  }
});

test("S88.5 roleCycleView sanitizes polluted source view text before projection", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "污染读书簿" });
  const profile = ensureStudyProfileState(worldState);
  profile.nextPlan = {
    id: "study-plan-polluted",
    title: "rawSql provider payload",
    focus: "经义根柢",
    items: [
      "data/sessions/session.json sk-test-secret",
      "补经义短课一则"
    ],
    nextActions: [
      "prompt_retrieval_index event_log OPENAI_API_KEY",
      "写经义短札，请老师只评章法得失。"
    ],
    riskNotes: [
      "world_sessions world_state_json",
      "三旬无进则备考压力会抬高。"
    ],
    intensity: {
      currentScore: 42,
      targetScore: 55,
      label: "待补",
      summary: "先补经义根柢。"
    }
  };

  const view = buildRoleCycleView(worldState);

  assertNoUnsafeRoleCycleText(view);
  assert.ok(view.currentRole.items.some((item) => /经义/.test(`${item.title}${item.publicSummary}`)));
  assert.ok(view.currentRole.nextActions.some((action) => /经义短札/.test(action.text)));
});

test("S88.5 roleCycleView derives from cloned source state without mutating ledgers", () => {
  for (const role of ["scholar", "general"]) {
    const worldState = createInitialState({ role, playerName: `循环只读-${role}` });
    const before = JSON.stringify(worldState);

    const view = buildRoleCycleView(worldState);

    assert.equal(view.activeRole, role);
    assert.equal(JSON.stringify(worldState), before);
    assertNoUnsafeRoleCycleText(view);
  }
});

test("S88.5 resolver input includes roleCycleView as player evidence", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "循环证据" });
  const context = buildResolverInputContext(worldState);
  const roleCycleSources = context.sourceViews.filter((source) => source.sourceView === "roleCycleView");
  const roleCycleRows = context.player.filter((entry) => entry.sourceView === "roleCycleView");

  assert.equal(roleCycleSources.length, 1);
  assert.equal(roleCycleSources[0].domain, "player");
  assert.ok(roleCycleRows.length > 0);
  assertResolverInputSafe(context);
  assertNoUnsafeRoleCycleText({ roleCycleSources, roleCycleRows });
});

test("S88.5 prompt context carries compact role cycle summary without new write authority", () => {
  const worldState = createInitialState({ role: "general", playerName: "军帐循环" });
  const context = assemblePromptContext(worldState);

  assert.equal(context.roleCycle.activeRole, "general");
  assert.equal(context.roleCycle.currentRole.nextActions.length > 0, true);
  assert.equal(context.roleCycle.roleMatrix.length, 6);
  assertNoUnsafeRoleCycleText(context.roleCycle);
});

test("S88.5 game start returns roleCycleView beside public client state", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/game/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dynasty: "明",
      year: 1644,
      role: "minister",
      playerName: "部院循环"
    })
  });
  const payload = await response.json();
  t.after(() => removeSessionFile(payload.sessionId));

  assert.equal(response.status, 201);
  assert.equal(payload.roleCycleView.activeRole, "minister");
  assert.equal(payload.roleCycleView.currentRole.roleLabel, "大臣");
  assert.equal(payload.roleCycleView.roleMatrix.length, 6);
  assert.equal(payload.worldState.officialCourtResponses, undefined);
  assertNoUnsafeRoleCycleText(payload.roleCycleView);
});
