const express = require("express");
const { buildDeveloperDiagnostics } = require("../game/redactedState");
const { getSessionStorageAdapter } = require("../storage/sessionStore");
const { isLocalRequestOrigin } = require("../utils/localOrigins");

const router = express.Router();

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isDevDiagnosticsEnabled(env = process.env) {
  return env.NODE_ENV !== "production" && env.ENABLE_DEV_DIAGNOSTICS === "true";
}

function assertDevDiagnosticsAccess(req, env = process.env) {
  if (!isDevDiagnosticsEnabled(env)) {
    throw fail(404, "开发诊断 API 未启用。");
  }
  if (!isLocalRequestOrigin(req, {
    appPort: env.PORT || 3000,
    extraOrigins: env.CORS_ALLOWED_ORIGINS
  })) {
    throw fail(403, "开发诊断 API 仅允许本机应用 Origin。");
  }
}

router.get("/session-diagnostics/:sessionId", async (req, res, next) => {
  try {
    assertDevDiagnosticsAccess(req);
    const adapter = getSessionStorageAdapter();
    const { record } = await adapter.readSessionRecord(req.params.sessionId);
    res.json(buildDeveloperDiagnostics(record, { storageAdapter: adapter }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.isDevDiagnosticsEnabled = isDevDiagnosticsEnabled;
module.exports.assertDevDiagnosticsAccess = assertDevDiagnosticsAccess;
