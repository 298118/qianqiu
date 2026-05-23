const safeSessionIdPattern = /^[a-f0-9-]{36}$/i;
const previewSessionIds = new Set(["s74-preview", "s76-preview", "smoke-session"]);

export function isRunnableSessionId(sessionId: string) {
  return safeSessionIdPattern.test(sessionId);
}

export function isPreviewSessionId(sessionId: string) {
  return previewSessionIds.has(sessionId);
}

export function isRouteLocalSessionId(sessionId: string) {
  return isRunnableSessionId(sessionId) || isPreviewSessionId(sessionId);
}
