const express = require("express");
const { runAiConnectionTest } = require("../ai/diagnostics");

const router = express.Router();

router.post("/connection-test", async (req, res, next) => {
  try {
    const payload = await runAiConnectionTest({ provider: req.body?.provider });
    res.status(payload.ok ? 200 : 503).json(payload);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
