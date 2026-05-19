const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const defaultBuildInputs = Object.freeze([
  "client",
  "vite.config.mjs",
  "tsconfig.client.json",
  "package.json",
  "package-lock.json"
]);

function getClientBuildPaths(repoRoot = path.join(__dirname, "..")) {
  return {
    repoRoot,
    indexHtml: path.join(repoRoot, "dist", "client", "index.html")
  };
}

function getNewestMtimeMs(targetPath) {
  let stat;
  try {
    stat = fs.statSync(targetPath);
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }

  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }

  let newest = 0;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const childPath = path.join(targetPath, entry.name);
    if (entry.isDirectory() || entry.isFile()) {
      newest = Math.max(newest, getNewestMtimeMs(childPath));
    }
  }
  return newest;
}

function resolveClientBuildStatus({ repoRoot = path.join(__dirname, ".."), inputs = defaultBuildInputs } = {}) {
  const buildPaths = getClientBuildPaths(repoRoot);
  let buildStat;
  try {
    buildStat = fs.statSync(buildPaths.indexHtml);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      indexHtml: buildPaths.indexHtml,
      reason: "missing",
      shouldBuild: true
    };
  }

  const newestInputMtimeMs = inputs.reduce((newest, input) => {
    return Math.max(newest, getNewestMtimeMs(path.join(repoRoot, input)));
  }, 0);

  if (newestInputMtimeMs > buildStat.mtimeMs + 1) {
    return {
      indexHtml: buildPaths.indexHtml,
      reason: "stale",
      shouldBuild: true
    };
  }

  return {
    indexHtml: buildPaths.indexHtml,
    reason: "current",
    shouldBuild: false
  };
}

function runClientBuild({ repoRoot = path.join(__dirname, "..") } = {}) {
  const command = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm run build:client"] : ["run", "build:client"];
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`npm run build:client failed with exit code ${result.status}`);
  }
}

function ensureClientBuild({ repoRoot = path.join(__dirname, ".."), force = false, runBuild = runClientBuild } = {}) {
  const status = force
    ? { ...resolveClientBuildStatus({ repoRoot }), reason: "forced", shouldBuild: true }
    : resolveClientBuildStatus({ repoRoot });

  if (!status.shouldBuild) {
    console.log(`React client build is current: ${status.indexHtml}`);
    return status;
  }

  console.log(`React client build ${status.reason}; running npm run build:client.`);
  runBuild({ repoRoot });
  return resolveClientBuildStatus({ repoRoot });
}

if (require.main === module) {
  const force = process.argv.includes("--force") || process.env.QIANQIU_FORCE_CLIENT_BUILD === "1";
  try {
    ensureClientBuild({ force });
  } catch (error) {
    console.error(`Unable to prepare React client build: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  defaultBuildInputs,
  ensureClientBuild,
  getClientBuildPaths,
  resolveClientBuildStatus
};
