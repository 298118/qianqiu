#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const express = require("express");
const fsp = require("node:fs/promises");
const path = require("node:path");
const aiRoutes = require("../src/routes/ai");
const {
  getProviderNamesToSmoke,
  PROVIDER_CONFIGS,
  truncate
} = require("./providerSmoke");

const rootDir = path.join(__dirname, "..");
const sessionsDir = path.join(rootDir, "data", "sessions");
const FETCH_BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53,
  69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117,
  119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514,
  515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989,
  990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 5060, 5061, 6000,
  6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080
]);

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function createAiRouteApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/ai", aiRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  return app;
}

async function startAiRouteServer() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const server = await new Promise((resolve, reject) => {
      const candidate = createAiRouteApp().listen(0, "127.0.0.1", () => resolve(candidate));
      candidate.once("error", reject);
    });
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : null;

    if (port && !FETCH_BLOCKED_PORTS.has(port)) {
      return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => closeServer(server)
      };
    }

    await closeServer(server);
  }

  throw new Error("Could not allocate a fetch-safe provider route-health port.");
}

async function listSessionJsonFiles() {
  try {
    const entries = await fsp.readdir(sessionsDir);
    return entries.filter((entry) => entry.endsWith(".json")).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function collectSecretFragments(providerName, env = process.env) {
  const config = PROVIDER_CONFIGS[providerName];
  const secret = config?.keyEnv ? env[config.keyEnv] : "";
  if (!secret || secret.length < 8) return [];

  return [...new Set([
    secret,
    secret.slice(0, 8),
    secret.slice(0, 12),
    secret.slice(-8),
    secret.slice(-12)
  ].filter((fragment) => fragment && fragment.length >= 8))];
}

function redactRouteHealthText(value, options = {}) {
  let text = String(value || "");
  for (const fragment of options.hiddenTextTokens || []) {
    if (fragment && fragment.length >= 8) {
      text = text.split(fragment).join("[redacted]");
    }
  }
  return text
    .replace(/[A-Za-z]:[\\/][^\s"'`<>]*data[\\/]sessions[\\/][^\s"'`<>]*/gi, "[session-path]")
    .replace(/\/[^\s"'`<>]*data\/sessions\/[^\s"'`<>]*/gi, "[session-path]")
    .replace(/\bdata[\\/]sessions[\\/][^\s"'`<>]*/gi, "[session-path]");
}

function getRouteHealthPayloadFailures(providerName, payload = {}, options = {}) {
  const failures = [];
  const text = JSON.stringify(payload);

  if (payload.ok !== true) {
    failures.push(`${providerName} route health did not return ok=true.`);
  }
  if (payload.provider !== providerName) {
    failures.push(`${providerName} route health returned provider ${payload.provider || "unknown"}.`);
  }
  if (!payload.configuredProvider) {
    failures.push(`${providerName} route health omitted configuredProvider.`);
  }
  if (!payload.checkedAt || Number.isNaN(Date.parse(payload.checkedAt))) {
    failures.push(`${providerName} route health omitted an ISO checkedAt timestamp.`);
  }
  if (typeof payload.latencyMs !== "number" || payload.latencyMs < 0) {
    failures.push(`${providerName} route health omitted non-negative latencyMs.`);
  }
  if (typeof payload.supportsStreaming !== "boolean") {
    failures.push(`${providerName} route health omitted supportsStreaming.`);
  }
  if (!payload.models || !Object.keys(payload.models).length) {
    failures.push(`${providerName} route health omitted model summary.`);
  }
  if (typeof payload.openingEventCount !== "number") {
    failures.push(`${providerName} route health omitted openingEventCount.`);
  }
  if (!payload.narrativePreview) {
    failures.push(`${providerName} route health omitted narrativePreview.`);
  }

  const leakedTokens = (options.hiddenTextTokens || []).filter((token) => token && text.includes(token));
  if (leakedTokens.length) {
    failures.push(`${providerName} route health leaked ${leakedTokens.length} hidden text token(s).`);
  }
  if (/data[\\/]sessions/i.test(text)) {
    failures.push(`${providerName} route health leaked a session storage path.`);
  }

  return failures;
}

function summarizeRouteHealthPayload(providerName, payload) {
  const models = payload.models || {};
  const modelSummary = Object.entries(models)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ") || "models=unknown";
  const streaming = payload.supportsStreaming ? "streaming=yes" : "streaming=no";
  return `${streaming}, ${modelSummary}, events=${payload.openingEventCount}, preview="${truncate(payload.narrativePreview, 72)}"`;
}

async function postRouteHealth(baseUrl, providerName) {
  const response = await fetch(`${baseUrl}/api/ai/connection-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: providerName })
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = { ok: false, provider: providerName, error: `Non-JSON route response: ${response.status}` };
  }

  return { response, payload };
}

async function runProviderRouteHealth(options = {}) {
  const providerNames = getProviderNamesToSmoke(options);

  if (!providerNames.length) {
    console.log("No real-provider keys found; skipping provider route health. Set OPENAI_API_KEY, DEEPSEEK_API_KEY, or ANTHROPIC_API_KEY to run it.");
    return { skipped: true, providerNames: [] };
  }

  const beforeSessionFiles = await listSessionJsonFiles();
  const beforeSet = new Set(beforeSessionFiles);
  const server = await startAiRouteServer();
  let routeError = null;

  try {
    for (const providerName of providerNames) {
      const { response, payload } = await postRouteHealth(server.baseUrl, providerName);
      const secretFragments = collectSecretFragments(providerName, options.env || process.env);

      if (!response.ok) {
        const leakFailures = getRouteHealthPayloadFailures(providerName, payload, {
          hiddenTextTokens: secretFragments
        }).filter((failure) => /leaked|session storage path/.test(failure));
        const safeError = redactRouteHealthText(payload.error || "unknown error", {
          hiddenTextTokens: secretFragments
        });
        throw new Error(`${providerName} route health failed with ${response.status}: ${safeError}${leakFailures.length ? `; ${leakFailures.join(" ")}` : ""}`);
      }

      const failures = getRouteHealthPayloadFailures(providerName, payload, {
        hiddenTextTokens: secretFragments
      });
      if (failures.length) {
        throw new Error(failures.join("\n"));
      }

      console.log(`[${providerName}] route-health ok: ${summarizeRouteHealthPayload(providerName, payload)}`);
    }
  } catch (error) {
    routeError = error;
  } finally {
    await server.close();
  }

  const afterSessionFiles = await listSessionJsonFiles();
  const addedSessionFiles = afterSessionFiles.filter((entry) => !beforeSet.has(entry));
  if (addedSessionFiles.length) {
    const sessionError = `Provider route health wrote ${addedSessionFiles.length} unexpected session file(s).`;
    if (routeError) {
      throw new Error(`${routeError.message}\n${sessionError}`);
    }
    throw new Error(sessionError);
  }
  if (routeError) {
    throw routeError;
  }

  console.log(`Provider route health completed for: ${providerNames.join(", ")}`);
  return { skipped: false, providerNames };
}

function printUsage() {
  console.log([
    "Usage: npm run smoke:provider:route -- [--provider openai|deepseek|anthropic|claude|all]",
    "",
    "Default behavior:",
    "- AI_PROVIDER=mock: run every provider that has its required key in the environment.",
    "- AI_PROVIDER=<real provider>: run that provider and fail if its key is missing.",
    "- --provider overrides AI_PROVIDER for this route health run.",
    "",
    "This script starts a tiny local Express app and POSTs /api/ai/connection-test.",
    "It never creates a game session and exits successfully when no real-provider keys are configured."
  ].join("\n"));
}

if (require.main === module) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
  } else {
    runProviderRouteHealth().catch((error) => {
      console.error(`Provider route health failed: ${error.message}`);
      process.exitCode = 1;
    });
  }
}

module.exports = {
  collectSecretFragments,
  getRouteHealthPayloadFailures,
  redactRouteHealthText,
  runProviderRouteHealth,
  summarizeRouteHealthPayload
};
