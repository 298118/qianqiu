import type {
  AiConnectionTestRequest,
  AiConnectionTestResponse,
  AiSettingsResponse,
  ExamProgressRequest,
  ExamProgressResponse,
  ExamQuestionRequest,
  ExamQuestionResponse,
  ExamSubmitRequest,
  ExamSubmitResponse,
  JsonObject,
  PlayerStateResponse,
  QuickActionRequest,
  QuickActionResponse,
  SafeApiErrorPayload,
  SavesResponse,
  StartGameRequest,
  StartGameResponse,
  TopicDraftRequest,
  TopicDraftResponse,
  TopicSurfaceId,
  TopicSurfaceResponse,
  TurnRequest,
  TurnResponse,
  UpdateAiSettingsRequest
} from "./types";

export const safeApiBasePath = "/api";

export type SafeApiBasePath = typeof safeApiBasePath;

type HttpMethod = "GET" | "POST";

type RequestOptions = {
  readonly method?: HttpMethod;
  readonly body?: JsonObject;
  readonly query?: URLSearchParams | Record<string, string | number | boolean | null | undefined>;
  readonly signal?: AbortSignal;
};

const allowedSafeEndpointPatterns = Object.freeze([
  /^\/api\/game\/start$/,
  /^\/api\/game\/saves$/,
  /^\/api\/game\/player-state\/[^/?#]+$/,
  /^\/api\/game\/topic-surface\/[^/?#]+\/[^/?#]+$/,
  /^\/api\/game\/turn$/,
  /^\/api\/exam\/question$/,
  /^\/api\/exam\/progress$/,
  /^\/api\/exam\/submit$/,
  /^\/api\/ai\/connection-test$/,
  /^\/api\/ai\/settings\/global$/,
  /^\/api\/ai\/settings\/[^/?#]+$/,
  /^\/api\/ai\/quick-actions\/[^/?#]+$/,
  /^\/api\/ai\/topic-draft\/[^/?#]+$/
]);

export class QianqiuApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "QianqiuApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function assertSafeApiEndpoint(endpoint: string) {
  if (endpoint.startsWith("/api/game/state/")) {
    throw new Error("React client must use /api/game/player-state/:sessionId for normal loads.");
  }

  const pathname = endpoint.split("?")[0] || endpoint;
  if (!allowedSafeEndpointPatterns.some((pattern) => pattern.test(pathname))) {
    throw new Error(`Unsafe or unknown Qianqiu client endpoint: ${endpoint}`);
  }
}

function buildUrl(endpoint: string, query?: RequestOptions["query"]) {
  assertSafeApiEndpoint(endpoint);
  const url = new URL(endpoint, window.location.origin);

  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => url.searchParams.set(key, value));
  } else if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return `${url.pathname}${url.search}`;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

function normalizeErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const apiPayload = payload as SafeApiErrorPayload;
    return apiPayload.error || apiPayload.message || fallback;
  }
  return fallback;
}

async function requestJson<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || (options.body ? "POST" : "GET");
  const response = await fetch(buildUrl(endpoint, options.query), {
    method,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new QianqiuApiError(
      normalizeErrorMessage(payload, `Qianqiu API request failed with ${response.status}`),
      response.status,
      payload
    );
  }

  return payload as T;
}

export const qianqiuApi = {
  listSaves(signal?: AbortSignal) {
    return requestJson<SavesResponse>("/api/game/saves", { signal });
  },

  startGame(input: StartGameRequest, signal?: AbortSignal) {
    return requestJson<StartGameResponse>("/api/game/start", {
      method: "POST",
      body: input as JsonObject,
      signal
    });
  },

  loadPlayerState(
    sessionId: string,
    query?: RequestOptions["query"],
    signal?: AbortSignal
  ) {
    return requestJson<PlayerStateResponse>(`/api/game/player-state/${encodePathSegment(sessionId)}`, {
      query,
      signal
    });
  },

  submitTurn(input: TurnRequest, signal?: AbortSignal) {
    return requestJson<TurnResponse>("/api/game/turn", {
      method: "POST",
      body: input as unknown as JsonObject,
      signal
    });
  },

  requestQuickActions(sessionId: string, input: QuickActionRequest, signal?: AbortSignal) {
    return requestJson<QuickActionResponse>(`/api/ai/quick-actions/${encodePathSegment(sessionId)}`, {
      method: "POST",
      body: input as unknown as JsonObject,
      signal
    });
  },

  loadTopicSurface(sessionId: string, surfaceId: TopicSurfaceId, signal?: AbortSignal) {
    return requestJson<TopicSurfaceResponse>(
      `/api/game/topic-surface/${encodePathSegment(sessionId)}/${encodePathSegment(surfaceId)}`,
      { signal }
    );
  },

  requestTopicDraft(sessionId: string, input: TopicDraftRequest, signal?: AbortSignal) {
    return requestJson<TopicDraftResponse>(`/api/ai/topic-draft/${encodePathSegment(sessionId)}`, {
      method: "POST",
      body: input as unknown as JsonObject,
      signal
    });
  },

  requestExamQuestion(input: ExamQuestionRequest, signal?: AbortSignal) {
    return requestJson<ExamQuestionResponse>("/api/exam/question", {
      method: "POST",
      body: input as unknown as JsonObject,
      signal
    });
  },

  progressExam(input: ExamProgressRequest, signal?: AbortSignal) {
    return requestJson<ExamProgressResponse>("/api/exam/progress", {
      method: "POST",
      body: input as unknown as JsonObject,
      signal
    });
  },

  submitExam(input: ExamSubmitRequest, signal?: AbortSignal) {
    return requestJson<ExamSubmitResponse>("/api/exam/submit", {
      method: "POST",
      body: input as unknown as JsonObject,
      signal
    });
  },

  getAiSettings(sessionId: string, signal?: AbortSignal) {
    return requestJson<AiSettingsResponse>(`/api/ai/settings/${encodePathSegment(sessionId)}`, { signal });
  },

  updateAiSettings(sessionId: string, input: UpdateAiSettingsRequest, signal?: AbortSignal) {
    return requestJson<AiSettingsResponse>(`/api/ai/settings/${encodePathSegment(sessionId)}`, {
      method: "POST",
      body: input as unknown as JsonObject,
      signal
    });
  },

  getGlobalAiSettings(signal?: AbortSignal) {
    return requestJson<AiSettingsResponse>("/api/ai/settings/global", { signal });
  },

  updateGlobalAiSettings(input: UpdateAiSettingsRequest, signal?: AbortSignal) {
    return requestJson<AiSettingsResponse>("/api/ai/settings/global", {
      method: "POST",
      body: input as unknown as JsonObject,
      signal
    });
  },

  testAiConnection(input: AiConnectionTestRequest = {}, signal?: AbortSignal) {
    return requestJson<AiConnectionTestResponse>("/api/ai/connection-test", {
      method: "POST",
      body: input as unknown as JsonObject,
      signal
    });
  }
};
