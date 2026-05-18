import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSafeApiEndpoint, qianqiuApi, QianqiuApiError } from "./qianqiuClient";

function mockJsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

function installFetchMock(payload: unknown, init?: ResponseInit) {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(mockJsonResponse(payload, init)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("S74.2 qianqiuApi", () => {
  it("loads saves through the redacted saves endpoint", async () => {
    const fetchMock = installFetchMock({ saves: [], skipped: [] });

    await expect(qianqiuApi.listSaves()).resolves.toEqual({ saves: [], skipped: [] });

    expect(fetchMock).toHaveBeenCalledWith("/api/game/saves", {
      method: "GET",
      headers: undefined,
      body: undefined,
      signal: undefined
    });
  });

  it("uses player-state for normal session loads and encodes session ids", async () => {
    const fetchMock = installFetchMock({
      source: "server_player_visible_state_projection",
      sessionId: "session/with space",
      worldState: {}
    });

    await qianqiuApi.loadPlayerState("session/with space", { informationTab: "world-people", informationPageSize: 4 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/player-state/session%2Fwith%20space?informationTab=world-people&informationPageSize=4",
      {
        method: "GET",
        headers: undefined,
        body: undefined,
        signal: undefined
      }
    );
  });

  it("posts start, turn, exam, and AI settings payloads as JSON", async () => {
    const fetchMock = installFetchMock({ sessionId: "s1", worldState: {}, narrative: "起卷" });

    await qianqiuApi.startGame({
      playerName: "沈知微",
      role: "scholar",
      dynasty: "明",
      year: 1600,
      familyBackground: "poor",
      background: "县学附读",
      customSetting: "公开自述"
    });
    await qianqiuApi.submitTurn({ sessionId: "s1", input: "读书" });
    await qianqiuApi.requestExamQuestion({ sessionId: "s1", level: "child_exam" });
    await qianqiuApi.progressExam({ sessionId: "s1", examId: "e1", action: "审题" });
    await qianqiuApi.submitExam({ sessionId: "s1", examId: "e1", essay: "文章" });
    await qianqiuApi.updateAiSettings("s1", { settings: { preset: "fast" } });
    await qianqiuApi.testAiConnection({ provider: "mock" });

    const calls = fetchMock.mock.calls.map(([url, options]) => ({
      url,
      method: options?.method,
      contentType: options?.headers?.["Content-Type"]
    }));

    expect(calls).toEqual([
      { url: "/api/game/start", method: "POST", contentType: "application/json" },
      { url: "/api/game/turn", method: "POST", contentType: "application/json" },
      { url: "/api/exam/question", method: "POST", contentType: "application/json" },
      { url: "/api/exam/progress", method: "POST", contentType: "application/json" },
      { url: "/api/exam/submit", method: "POST", contentType: "application/json" },
      { url: "/api/ai/settings/s1", method: "POST", contentType: "application/json" },
      { url: "/api/ai/connection-test", method: "POST", contentType: "application/json" }
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({
      familyBackground: "poor",
      background: "县学附读",
      customSetting: "公开自述"
    });
  });

  it("blocks raw state and unknown endpoints at the client boundary", () => {
    expect(() => assertSafeApiEndpoint("/api/game/state/s1")).toThrow(/player-state/);
    expect(() => assertSafeApiEndpoint("/api/dev/session-diagnostics/s1")).toThrow(/Unsafe/);
    expect(() => assertSafeApiEndpoint("/api/game/search/s1")).toThrow(/Unsafe/);
  });

  it("wraps non-2xx responses in QianqiuApiError", async () => {
    installFetchMock({ error: "缺少会话" }, { status: 404 });

    await expect(qianqiuApi.loadPlayerState("missing")).rejects.toMatchObject({
      name: "QianqiuApiError",
      status: 404,
      message: "缺少会话"
    } satisfies Partial<QianqiuApiError>);
  });
});
