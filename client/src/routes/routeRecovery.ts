import { isRouteErrorResponse } from "react-router";
import { isRunnableSessionId } from "./sessionId";

export function getRouteSessionRecoveryHref(pathname: string) {
  const sessionMatch = pathname.match(/^\/game\/([^/]+)(\/.+)$/);
  const sessionId = sessionMatch?.[1] ?? "";
  if (!isRunnableSessionId(sessionId)) return null;
  return `/game/${sessionId}`;
}

export function getSafeRouteErrorMessage(error: unknown) {
  // Route errors can carry framework/server diagnostics; player-facing copy stays fixed.
  if (!isRouteErrorResponse(error)) return "案卷暂不可读。";
  if (error.status === 404) return "案上未载此页。";
  if (error.status === 401 || error.status === 403) return "此卷页暂不可入。";
  if (error.status === 405) return "此卷页暂不可用。";
  return "案卷暂不可读。";
}
