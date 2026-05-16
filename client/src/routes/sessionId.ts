const safeSessionIdPattern = /^[a-f0-9-]{36}$/i;

export function isRunnableSessionId(sessionId: string) {
  return safeSessionIdPattern.test(sessionId);
}
