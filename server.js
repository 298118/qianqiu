const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const gameRoutes = require("./src/routes/game");
const examRoutes = require("./src/routes/exam");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    error: err.message || "Internal server error"
  });
});

app.listen(port, () => {
  console.log(`Qianqiu listening at http://localhost:${port}`);
});
