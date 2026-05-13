const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

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
app.use(express.static(path.join(__dirname, "public")));

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
  buildAllowedCorsOrigins,
  createCorsOptions,
  parseAllowedCorsOrigins
};
