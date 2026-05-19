const express = require("express");
const { getProvider } = require("../ai");
const { runAiConnectionTest } = require("../ai/diagnostics");
const {
  buildGlobalAiSettingsPayload,
  resolveAiSettingsForSession,
  updateGlobalAiSettings
} = require("../game/aiSettings");
const { buildAiControlAuditView } = require("../game/aiControlAudit");
const {
  buildLocalQuickActionResponse,
  buildQuickActionContext,
  buildQuickActionResponse,
  normalizeQuickActionRequest
} = require("../game/quickActionSuggestions");
const {
  buildLocalTopicDraftResponse,
  buildTopicDraftContext,
  buildTopicDraftResponse,
  normalizeTopicDraftRequest
} = require("../game/topicDrafts");
const { readSession } = require("../storage/sessionStore");

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

router.get("/settings/global", async (req, res, next) => {
  try {
    res.json(buildGlobalAiSettingsPayload(process.env, {
      buildAiControlAuditView
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/settings/global", async (req, res, next) => {
  try {
    const patch = req.body?.settings || req.body?.aiSettings || req.body;
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw fail(400, "AI 设置必须是对象。");
    }
    const payload = updateGlobalAiSettings(patch, process.env, {
      buildAiControlAuditView
    });
    res.json(payload);
  } catch (error) {
    if (!error.statusCode && /AI 设置|AI 路由|不支持字段|禁止|hidden|raw|server|provider|model|任务|服务器维护|缺少 key/.test(error.message || "")) {
      error.statusCode = 400;
    }
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

router.post("/topic-draft/:sessionId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    const request = normalizeTopicDraftRequest(req.body);
    const context = buildTopicDraftContext(worldState, request);
    const { routePolicy } = resolveAiSettingsForSession(worldState);

    try {
      const provider = getProvider({ taskType: "topic_draft", routePolicy });
      const rawPayload = await provider.draftTopicSurface(context);
      const providerSource = provider.modelRoute?.provider === "mock" ? "mock-ai" : "provider-ai";
      res.json(buildTopicDraftResponse(worldState, rawPayload, context, {
        source: providerSource,
        expectedSource: providerSource
      }));
    } catch (error) {
      res.json(buildLocalTopicDraftResponse(worldState, request, {
        context,
        status: "fallback",
        fallbackReason: "topic_draft_provider_failed"
      }));
    }
  } catch (error) {
    next(error);
  }
});

router.get("/settings/:sessionId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    res.json(buildGlobalAiSettingsPayload(process.env, {
      worldState,
      targetSessionId: worldState.sessionId,
      buildAiControlAuditView
    }));
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

    const worldState = await readSession(req.params.sessionId);
    const payload = updateGlobalAiSettings(patch, process.env, {
      worldState,
      targetSessionId: worldState.sessionId,
      buildAiControlAuditView
    });
    res.json(payload);
  } catch (error) {
    if (!error.statusCode && /AI 设置|AI 路由|不支持字段|禁止|hidden|raw|server|provider|model|任务|服务器维护|缺少 key/.test(error.message || "")) {
      error.statusCode = 400;
    }
    next(error);
  }
});

module.exports = router;
