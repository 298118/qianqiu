const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ quiet: true });

const gameRoutes = require("./src/routes/game");
const examRoutes = require("./src/routes/exam");
const aiRoutes = require("./src/routes/ai");
const devRoutes = require("./src/routes/dev");
const {
  buildAllowedCorsOrigins: buildAllowedCorsOriginSet,
  parseAllowedCorsOrigins
} = require("./src/utils/localOrigins");

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
const reactClientBuild = buildReactClientBuildPaths(__dirname);
const staticResourcePrefixes = Object.freeze([
  "/assets",
  "/client-assets",
  "/vendor",
  "/mapRenderer.js",
  "/mapPanel.js"
]);

function buildReactClientBuildPaths(repoRoot = __dirname) {
  const distDir = path.join(repoRoot, "dist", "client");
  return {
    distDir,
    indexHtml: path.join(distDir, "index.html")
  };
}

function hasReactClientBuild(buildPaths = reactClientBuild) {
  try {
    return fs.statSync(buildPaths.indexHtml).isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function shouldServeReactHistoryFallback(req) {
  if (!["GET", "HEAD"].includes(req.method)) return false;
  if (req.path === "/api" || req.path.startsWith("/api/")) return false;
  if (staticResourcePrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    return false;
  }
  if (path.extname(req.path)) return false;

  const accept = String(req.headers.accept || "");
  return !accept || accept.includes("text/html");
}

function buildAllowedCorsOrigins(appPort = port, extraOrigins = process.env.CORS_ALLOWED_ORIGINS) {
  return buildAllowedCorsOriginSet(appPort, extraOrigins);
}

function createCorsOptions({ appPort = port, extraOrigins = process.env.CORS_ALLOWED_ORIGINS } = {}) {
  const allowedOrigins = buildAllowedCorsOrigins(appPort, extraOrigins);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    }
  };
}

app.use(cors(createCorsOptions()));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    aiProvider: process.env.AI_PROVIDER || "mock"
  });
});

app.use("/api/game", gameRoutes);
app.use("/api/exam", examRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/dev", devRoutes);

app.use(express.static(reactClientBuild.distDir, { index: false }));
app.use(express.static(publicDir, { index: false }));

app.use((req, res, next) => {
  if (!hasReactClientBuild() || !shouldServeReactHistoryFallback(req)) {
    next();
    return;
  }

  res.sendFile(reactClientBuild.indexHtml);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    error: err.message || "Internal server error"
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Qianqiu listening at http://localhost:${port}`);
  });
}

module.exports = {
  app,
  buildReactClientBuildPaths,
  buildAllowedCorsOrigins,
  createCorsOptions,
  hasReactClientBuild,
  shouldServeReactHistoryFallback,
  parseAllowedCorsOrigins
};
