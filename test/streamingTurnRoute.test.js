const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createInitialState } = require("../src/game/initialState");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const gameRoutePath = require.resolve("../src/routes/game");
const aiPath = require.resolve("../src/ai");

function makeTurnPayload(narrative = "松风入砚，书声稍定。") {
  return {
    narrative,
    statePatch: {
      player: {
        academia: 13
      }
    },
    attributeChanges: [
      {
        path: "player.academia",
        before: 10,
        after: 13,
        reason: "读书有得"
      }
    ],
    relationshipChanges: [],
    events: ["书窗夜读，稍有所得。"],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: ""
    }
  };
}

async function removeSessionFile(sessionId) {
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

function withProvider(provider, callback) {
  const aiModule = require(aiPath);
  const originalGetProvider = aiModule.getProvider;
  aiModule.getProvider = () => provider;
  delete require.cache[gameRoutePath];

  try {
    return callback(require(gameRoutePath));
  } finally {
    aiModule.getProvider = originalGetProvider;
    delete require.cache[gameRoutePath];
  }
}

function createTestServer(provider) {
  return withProvider(provider, (gameRoutes) => {
    const app = express();
    app.use(express.json());
    app.use("/api/game", gameRoutes);

    return createFetchSafeServer(app);
  });
}

async function postTurnSse(baseUrl, sessionId, input = "读书") {
  const response = await fetch(`${baseUrl}/api/game/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify({ sessionId, input })
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/event-stream/);
  return parseSse(await response.text());
}

test("POST /api/game/turn streams extracted provider narrative before final_state", async (t) => {
  const payload = makeTurnPayload("松风入砚，问学渐明。");
  const provider = {
    supportsStreaming: true,
    async streamTurn(worldState, input, handlers) {
      const raw = JSON.stringify(payload);
      for (let index = 0; index < raw.length; index += 7) {
        handlers.onTextDelta(raw.slice(index, index + 7));
      }
      return payload;
    },
    async runTurn() {
      throw new Error("runTurn should not be used when streaming succeeds");
    }
  };
  const server = createTestServer(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Streamer" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const events = await postTurnSse(server.baseUrl, worldState.sessionId);
  const narrative = events
    .filter((event) => event.event === "narrative_chunk")
    .map((event) => event.data.text)
    .join("");
  const finalState = events.find((event) => event.event === "final_state");

  assert.equal(narrative, payload.narrative);
  assert.ok(finalState);
  assert.equal(finalState.data.worldState.turnCount, 1);
  assert.equal(finalState.data.worldState.player.academia, 13);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.turnCount, 1);
  assert.equal(saved.player.academia, 13);
});

test("POST /api/game/turn ignores nested streamed narrative fields", async (t) => {
  const payload = makeTurnPayload("顶层叙事方可入史。");
  const provider = {
    supportsStreaming: true,
    async streamTurn(worldState, input, handlers) {
      const streamed = JSON.stringify({
        statePatch: {
          narrative: "嵌套叙事不可外显。",
          player: {
            academia: 13
          }
        },
        attributeChanges: payload.attributeChanges,
        relationshipChanges: [],
        events: payload.events,
        examTrigger: payload.examTrigger,
        narrative: payload.narrative
      });
      for (let index = 0; index < streamed.length; index += 9) {
        handlers.onTextDelta(streamed.slice(index, index + 9));
      }
      return payload;
    },
    async runTurn() {
      throw new Error("runTurn should not be used when streaming succeeds");
    }
  };
  const server = createTestServer(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "NestedStream" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const events = await postTurnSse(server.baseUrl, worldState.sessionId);
  const narrative = events
    .filter((event) => event.event === "narrative_chunk")
    .map((event) => event.data.text)
    .join("");

  assert.equal(narrative, payload.narrative);
  assert.equal(narrative.includes("嵌套叙事不可外显"), false);
  assert.ok(events.find((event) => event.event === "final_state"));
});

test("POST /api/game/turn preserves SSE fallback when provider has no stream method", async (t) => {
  const payload = makeTurnPayload("案头灯火未歇，心志稍坚。");
  const provider = {
    supportsStreaming: false,
    async runTurn() {
      return payload;
    }
  };
  const server = createTestServer(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Fallback" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const events = await postTurnSse(server.baseUrl, worldState.sessionId);
  const narrative = events
    .filter((event) => event.event === "narrative_chunk")
    .map((event) => event.data.text)
    .join("");

  assert.equal(narrative, payload.narrative);
  assert.ok(events.find((event) => event.event === "final_state"));
});

test("POST /api/game/turn emits error and does not mutate state after visible stream failure", async (t) => {
  const provider = {
    supportsStreaming: true,
    async streamTurn(worldState, input, handlers) {
      handlers.onTextDelta('{"narrative":"半卷未终');
      throw new Error("stream schema failed");
    },
    async runTurn() {
      throw new Error("runTurn fallback should not happen after visible streaming");
    }
  };
  const server = createTestServer(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "ErrorCase" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const events = await postTurnSse(server.baseUrl, worldState.sessionId);
  const errorEvent = events.find((event) => event.event === "error");
  const finalState = events.find((event) => event.event === "final_state");

  assert.ok(errorEvent);
  assert.match(errorEvent.data.error, /stream schema failed/);
  assert.equal(finalState, undefined);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.turnCount, 0);
  assert.equal(saved.player.academia, 10);
});
