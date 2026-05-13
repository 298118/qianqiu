const express = require("express");
const { runAiConnectionTest } = require("../ai/diagnostics");
const {
  buildAiInvocationSummaryView,
  redactAiSettingsForClient,
  resolveAiSettingsForSession,
  updateAiSettings
} = require("../game/aiSettings");
const { mutateSession, readSession } = require("../storage/sessionStore");

const router = express.Router();

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

router.post("/connection-test", async (req, res, next) => {
  try {
    const payload = await runAiConnectionTest({ provider: req.body?.provider });
    res.status(payload.ok ? 200 : 503).json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/settings/:sessionId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    const { settings, routePolicy } = resolveAiSettingsForSession(worldState);
    res.json({
      sessionId: worldState.sessionId,
      aiSettingsView: redactAiSettingsForClient({ ...settings, routePolicy }),
      aiInvocationSummaryView: buildAiInvocationSummaryView(worldState, routePolicy)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/settings/:sessionId", async (req, res, next) => {
  try {
    const patch = req.body?.settings || req.body?.aiSettings || req.body;
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw fail(400, "AI 设置必须是对象。");
    }

    const payload = await mutateSession(req.params.sessionId, async (worldState) => {
      const result = updateAiSettings(worldState, patch);
      return {
        sessionId: worldState.sessionId,
        aiSettingsView: result.aiSettingsView,
        aiInvocationSummaryView: result.aiInvocationSummaryView
      };
    });

    res.json(payload);
  } catch (error) {
    if (!error.statusCode && /AI 设置|AI 路由|不支持字段|禁止|hidden|raw|server|provider|model|任务|服务器维护/.test(error.message || "")) {
      error.statusCode = 400;
    }
    next(error);
  }
});

module.exports = router;
