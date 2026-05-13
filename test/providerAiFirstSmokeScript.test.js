const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertNoSensitiveLeak,
  collectS70ProviderPatchViolations,
  readMimoAiFirstSmokeConfig,
  redactAcceptanceText,
  runProviderAiFirstSmoke
} = require("../scripts/providerAiFirstSmoke");

function createFakeProvider(overrides = {}) {
  return {
    supportsStreaming: false,
    async startGame() {
      return {
        narrative: "明年吏部案牍渐繁，玩家以新科官员入署观政。",
        events: ["明年吏部新官入署，官缺案牍待核。"]
      };
    },
    async runTurn() {
      return {
        narrative: "署中同僚传阅官缺簿，玩家按籍贯回避和考成条格逐项核对。",
        statePatch: overrides.statePatch || {
          publicOrder: 69,
          player: { superiorFavor: 44 }
        },
        attributeChanges: [],
        relationshipChanges: [],
        events: ["吏部官缺复核稍有眉目。"],
        memoryProposals: [{
          actorId: "npc:C01",
          type: "impression",
          visibility: "player_visible",
          summary: "赵给事记得玩家核验官缺时谨慎守法。",
          salience: 62,
          confidence: 0.7
        }],
        examTrigger: { shouldStart: false, level: null, reason: "" },
        ...(overrides.extraTurnFields || {})
      };
    }
  };
}

test("provider AI-first smoke skips MiMo when key is absent unless required", async () => {
  const skipped = await runProviderAiFirstSmoke({
    argv: ["node", "scripts/providerAiFirstSmoke.js"],
    env: {},
    providerFactory() {
      throw new Error("provider should not be created");
    }
  });

  assert.equal(skipped.skipped, true);
  await assert.rejects(
    () => runProviderAiFirstSmoke({
      argv: ["node", "scripts/providerAiFirstSmoke.js", "--required"],
      env: {},
      providerFactory() {
        throw new Error("provider should not be created");
      }
    }),
    /MIMO_API_KEY/
  );
});

test("provider AI-first smoke config reads MiMo acceptance flags", () => {
  const config = readMimoAiFirstSmokeConfig({
    argv: [
      "node",
      "scripts/providerAiFirstSmoke.js",
      "--provider",
      "mimo",
      "--model",
      "mimo-test",
      "--base-url=https://example.test/v1"
    ],
    env: {
      MIMO_API_KEY: "key",
      MIMO_REQUIRED: "1",
      AI_PROVIDER_TIMEOUT_MS: "1234"
    }
  });

  assert.equal(config.provider, "mimo");
  assert.equal(config.apiKey, "key");
  assert.equal(config.model, "mimo-test");
  assert.equal(config.baseUrl, "https://example.test/v1");
  assert.equal(config.required, true);
  assert.equal(config.timeoutMs, 1234);
  assert.throws(
    () => readMimoAiFirstSmokeConfig({
      argv: ["node", "scripts/providerAiFirstSmoke.js", "--provider", "openai"],
      env: {}
    }),
    /only --provider mimo/
  );
});

test("provider AI-first smoke runs fake MiMo narrative and S70 surfaces", async () => {
  const result = await runProviderAiFirstSmoke({
    argv: ["node", "scripts/providerAiFirstSmoke.js"],
    env: {
      MIMO_API_KEY: "mimo-key",
      MIMO_MODEL: "mimo-test"
    },
    providerFactory: () => createFakeProvider()
  });

  assert.equal(result.skipped, false);
  assert.equal(result.provider, "mimo");
  assert.equal(result.cases.length, 2);
  assert.equal(result.cases[0].id, "ordinary_and_long_turn");
  assert.equal(result.cases[1].id, "s70_server_ai_first_surfaces");
  assert.equal(result.cases[1].monthlyBriefing.generated, true);
  assert.equal(result.cases[1].actorMemory.appliedCount >= 1, true);
  assert.equal(result.cases[1].actorMemory.rejectedCount >= 1, true);
  assert.equal(result.cases[1].timeSkip.ticks, 3);
  assert.equal(result.cases[1].mapContext.proposalStatus, "pending");
  assert.equal(result.cases[1].reviewOnly.critic.reviewerOnly, true);
  assert.equal(result.cases[1].reviewOnly.critic.mayUseTools, false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.cases[0], "turn"), false);
  assert.deepEqual(result.cases[0].adapterPatchKeys, ["publicOrder", "player"]);
});

test("provider AI-first smoke result does not print raw provider turn payload", async () => {
  const result = await runProviderAiFirstSmoke({
    argv: ["node", "scripts/providerAiFirstSmoke.js"],
    env: {
      MIMO_API_KEY: "mimo-key",
      MIMO_MODEL: "mimo-test"
    },
    providerFactory: () => createFakeProvider({
      extraTurnFields: {
        rawProviderPayload: "sk-secret123456 E:\\LSMNQ\\.env",
        relationshipChanges: [{ npc: "赵给事", delta: 3 }],
        debugStatePatch: { worldState: "raw table" }
      }
    })
  });
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes("rawProviderPayload"), false);
  assert.equal(serialized.includes("relationshipChanges"), false);
  assert.equal(serialized.includes("debugStatePatch"), false);
  assert.equal(serialized.includes("statePatch"), false);
  assert.equal(serialized.includes("sk-secret123456"), false);
  assert.equal(serialized.includes("E:\\LSMNQ"), false);
});

test("provider AI-first smoke rejects S70 server-owned provider patches", async () => {
  await assert.rejects(
    () => runProviderAiFirstSmoke({
      argv: ["node", "scripts/providerAiFirstSmoke.js"],
      env: { MIMO_API_KEY: "mimo-key" },
      providerFactory: () => createFakeProvider({
        statePatch: {
          actorMemoryLedger: {},
          sessionSummary: {},
          player: { officeTitle: "模型授官" }
        }
      })
    }),
    /actorMemoryLedger|sessionSummary|player\.officeTitle/
  );
});

test("provider AI-first smoke protects sensitive acceptance text", () => {
  assert.deepEqual(
    collectS70ProviderPatchViolations({
      mapContextView: {},
      playerMonthlyBriefing: {},
      player: { examHistory: [] }
    }),
    ["playerMonthlyBriefing", "mapContextView", "player.examHistory"]
  );
  assert.throws(
    () => assertNoSensitiveLeak("unsafe", "raw provider proposal data/sessions/x sk-secret123456"),
    /leaked/
  );
  const redacted = redactAcceptanceText("bad sk-abcdefghijklmnopqrstuvwxyz at E:\\LSMNQ\\.env");
  assert.equal(redacted.includes("sk-"), false);
  assert.equal(redacted.includes("E:\\"), false);
});
