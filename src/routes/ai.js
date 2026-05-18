const express = require("express");
const { getProvider } = require("../ai");
const { runAiConnectionTest } = require("../ai/diagnostics");
const {
  buildAiInvocationSummaryView,
  redactAiSettingsForClient,
  resolveAiSettingsForSession,
  updateAiSettings
} = require("../game/aiSettings");
const { buildAiControlAuditView } = require("../game/aiControlAudit");
const {
  buildLocalQuickActionResponse,
  buildQuickActionContext,
  buildQuickActionResponse,
  normalizeQuickActionRequest
} = require("../game/quickActionSuggestions");
const { readSession, mutateSession } = require("../storage/sessionStore");

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

router.post("/quick-actions/:sessionId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    const request = normalizeQuickActionRequest(req.body);
    const context = buildQuickActionContext(worldState, request);
    const { routePolicy } = resolveAiSettingsForSession(worldState);

    try {
      const provider = getProvider({ taskType: "quick_action", routePolicy });
      const rawPayload = await provider.suggestQuickActions(context);
      const providerSource = provider.modelRoute?.provider === "mock" ? "mock-ai" : "provider-ai";
      res.json(buildQuickActionResponse(worldState, rawPayload, context, {
        source: providerSource,
        expectedSource: providerSource,
        count: request.count
      }));
    } catch (error) {
      res.json(buildLocalQuickActionResponse(worldState, request, {
        context,
        status: "fallback",
        fallbackReason: "quick_action_provider_failed"
      }));
    }
  } catch (error) {
    next(error);
  }
});

router.get("/settings/:sessionId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    const { settings, routePolicy } = resolveAiSettingsForSession(worldState);
    const aiInvocationSummaryView = buildAiInvocationSummaryView(worldState, routePolicy);
    res.json({
      sessionId: worldState.sessionId,
      aiSettingsView: redactAiSettingsForClient({ ...settings, routePolicy }),
      aiInvocationSummaryView,
      aiControlAuditView: buildAiControlAuditView(worldState, {
        routePolicy,
        aiInvocationSummaryView
      })
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
      const { routePolicy } = resolveAiSettingsForSession(worldState);
      return {
        sessionId: worldState.sessionId,
        aiSettingsView: result.aiSettingsView,
        aiInvocationSummaryView: result.aiInvocationSummaryView,
        aiControlAuditView: buildAiControlAuditView(worldState, {
          routePolicy,
          aiInvocationSummaryView: result.aiInvocationSummaryView
        })
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
