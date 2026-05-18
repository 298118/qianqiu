import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAssetRegistryCache, type InkUiManifest } from "../assets/assetRegistry";
import { routes } from "../router";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";

function renderRoute(initialEntry: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  return render(<RouterProvider router={router} />);
}

function buildMockAssetManifest(count = 9): InkUiManifest {
  return {
    schemaVersion: 1,
    assetSetId: "ink-ui-v1",
    assetRoot: "/assets/ui/",
    runtimeUsableReviewStatuses: ["approved", "approved_with_limits"],
    runtimeBlockedReviewStatuses: ["planned", "draft", "review_pending", "rejected", "replaced"],
    fallbackCatalog: [
      {
        id: "fallback-paper-panel-v1",
        category: "fallback",
        type: "css_token",
        usage: ["global_fallback"],
        cssTokens: { backgroundColor: "#f5f0e6", borderColor: "#c9b898", textColor: "#241f18" },
        reviewStatus: "approved",
        ledgerId: "ui-fallback-paper-panel-v1"
      },
      {
        id: "fallback-role-silhouette-v1",
        category: "fallback",
        type: "css_token",
        usage: ["people_page"],
        cssTokens: { backgroundColor: "#e8dcc8", accentColor: "#a53a2a", textColor: "#241f18" },
        reviewStatus: "approved",
        ledgerId: "ui-fallback-role-silhouette-v1"
      }
    ],
    assets: Array.from({ length: count }, (_, index) => {
      const number = index + 1;
      const feminine = index < 3;
      const id = `portrait-test-${feminine ? "female" : "male"}-${number}-v1`;
      return {
        id,
        category: "portrait",
        subcategory: feminine ? "player_female_style_pool" : "player_male_style_pool",
        usage: ["people_page", "game_main"],
        role: feminine ? "female_official" : "scholar",
        roleLabel: feminine ? `女官 ${number}` : `书生 ${number}`,
        scene: null,
        path: `/assets/ui/portraits/${id}.webp`,
        thumbnailPath: `/assets/ui/thumbs/thumb-${id}.webp`,
        lowResPlaceholderPath: `/assets/ui/portraits/placeholders/placeholder-${id}.webp`,
        fallbackRef: "fallback-role-silhouette-v1",
        reviewStatus: "approved",
        visualReview: { status: "approved" },
        safetyReview: { status: "approved" },
        portraitRef: id,
        genderPresentation: feminine ? "feminine" : "masculine",
        ageBand: "adult_young",
        statusVariant: "baseline",
        emotionVariant: "neutral",
        identityTags: [feminine ? "female_style" : "male_style"],
        emotionTags: ["neutral"],
        lazyLoad: {
          group: feminine ? "portrait_pool_player_female_extra_s73_10" : "portrait_pool_player_male_extra_s73_10",
          allowEagerLoad: false,
          thumbnailFirst: true,
          lowResPlaceholder: true,
          maxInitialPortraits: 8
        },
        source: index < 2 ? { localHighResSource: "kept_outside_public_manifest" } : undefined
      };
    })
  };
}

function mockAssetManifestFetch(manifest = buildMockAssetManifest()) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => manifest
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("S74.1 React client shell", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    resetAssetRegistryCache();
    vi.unstubAllGlobals();
    useGameSessionStore.setState({
      activeExam: null,
      currentSession: null,
      currentSessionId: null,
      error: null,
      lastExamResult: null,
      lastTurn: null,
      saves: [],
      savesStatus: "idle",
      settingsStatus: "idle",
      quickActionStatus: "idle",
      quickActions: null,
      aiSettings: null,
      aiConnection: null,
      status: "idle"
    });
    useUiStateStore.getState().resetUiState();
  });

  it("renders the new default home surface", () => {
    renderRoute("/");

    expect(screen.getByRole("heading", { name: "千秋" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "预览" }).getAttribute("href")).toBe("/game/s74-preview");
    expect(screen.getByRole("button", { name: "新开一卷" })).toBeTruthy();
    expect(screen.getByLabelText("朝代")).toBeTruthy();
    expect(screen.getByLabelText("年份")).toBeTruthy();
    expect(screen.getByLabelText("身份")).toBeTruthy();
    expect(screen.getByLabelText("姓名")).toBeTruthy();
    expect(screen.getByRole("group", { name: "书生家境" })).toBeTruthy();
    expect(screen.getByLabelText("自定背景")).toBeTruthy();
    expect(document.querySelector(".homeDesk .startDesk")).toBeTruthy();
    expect(document.querySelector("#start-form")).toBeNull();
    expect(document.querySelector("[data-client-entry='react']")).toBeTruthy();
    expect(document.querySelector("[data-router-mode='data']")).toBeTruthy();
    expect(document.querySelector("[data-shell-version='s75-9']")).toBeTruthy();
  });

  it("posts the S75.2 opening form through the safe start endpoint", async () => {
    const fetchMock = vi.fn(async (url: string, _options?: RequestInit) => {
      if (url === "/api/game/saves") {
        return new Response(JSON.stringify({ saves: [], skipped: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        sessionId: "22222222-2222-4222-8222-222222222222",
        narrative: "起卷",
        worldState: { player: { name: "陆清远", role: "scholar" } }
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/");

    fireEvent.change(screen.getByLabelText("朝代"), { target: { value: "宋" } });
    fireEvent.change(screen.getByLabelText("年份"), { target: { value: "1086" } });
    fireEvent.change(screen.getByLabelText("姓名"), { target: { value: "陆清远" } });
    fireEvent.click(screen.getByLabelText("贫寒"));
    fireEvent.change(screen.getByLabelText("自定背景"), { target: { value: "少时寄居书院，熟读经义。" } });
    fireEvent.click(screen.getByRole("button", { name: "新开一卷" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/start",
      expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } })
    ));

    const startCall = fetchMock.mock.calls.find(([url]) => url === "/api/game/start") as
      | [string, RequestInit]
      | undefined;
    expect(JSON.parse(String(startCall?.[1].body))).toMatchObject({
      dynasty: "宋",
      year: 1086,
      role: "scholar",
      playerName: "陆清远",
      familyBackground: "poor",
      customSetting: "少时寄居书院，熟读经义。"
    });
    expect(document.body.textContent || "").not.toMatch(/\/api\/game\/state|\/api\/dev|provider payload|hiddenNotes|OPENAI_API_KEY|data\/sessions/i);
  });

  it("locks the S75.3 seal submit path against repeated Enter submits", async () => {
    let resolveStart: ((response: Response) => void) | undefined;
    const startResponse = new Promise<Response>((resolve) => {
      resolveStart = resolve;
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/game/saves") {
        return new Response(JSON.stringify({ saves: [], skipped: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/game/start") {
        return startResponse;
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/");

    const startForm = screen.getByRole("form", { name: "新开案卷" });
    fireEvent.submit(startForm);
    fireEvent.submit(startForm);

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/start")).toHaveLength(1);
    });
    expect(screen.getByRole("button", { name: "开卷中" })).toHaveProperty("disabled", true);
    expect(document.querySelector(".homeStartSeal")?.className).toContain("isStamping");
    expect(screen.getByText("朱印已落，正在开卷。")).toBeTruthy();

    resolveStart?.(new Response(JSON.stringify({
      sessionId: "33333333-3333-4333-8333-333333333333",
      narrative: "新卷已启。",
      worldState: { player: { name: "沈知微", role: "scholar" } }
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    }));
    await waitFor(() => expect(useGameSessionStore.getState().currentSessionId).toBe("33333333-3333-4333-8333-333333333333"));
  });

  it("keeps S75.3 seal feedback static when motion is reduced", async () => {
    useUiStateStore.getState().setDisplayPreference("motion", "reduced");
    let resolveStart: ((response: Response) => void) | undefined;
    const startResponse = new Promise<Response>((resolve) => {
      resolveStart = resolve;
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/game/saves") {
        return new Response(JSON.stringify({ saves: [], skipped: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/game/start") {
        return startResponse;
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/");

    fireEvent.submit(screen.getByRole("form", { name: "新开案卷" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/start")).toHaveLength(1);
    });
    expect(document.querySelector(".appShell")?.getAttribute("data-motion")).toBe("reduced");
    expect(document.querySelector(".homeStartSeal")?.className).not.toContain("isStamping");
    expect(screen.getByRole("button", { name: "开卷中" }).getAttribute("data-state")).toBe("loading");

    resolveStart?.(new Response(JSON.stringify({
      sessionId: "44444444-4444-4444-8444-444444444444",
      narrative: "新卷已启。",
      worldState: { player: { name: "沈知微", role: "scholar" } }
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    }));
    await waitFor(() => expect(useGameSessionStore.getState().currentSessionId).toBe("44444444-4444-4444-8444-444444444444"));
  });

  it("hides scholar family choices for non-scholar starts and validates year locally", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ saves: [], skipped: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/");

    fireEvent.change(screen.getByLabelText("身份"), { target: { value: "general" } });
    expect(screen.queryByRole("group", { name: "书生家境" })).toBeNull();
    expect(screen.getByText(/边镇统军/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("年份"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "新开一卷" }));

    expect((await screen.findByRole("alert")).textContent).toBe("年份需为 1 至 9999 之间的整数。");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/game/start", expect.anything());
  });

  it("binds primary route links to the active runnable session after Mock start or refresh", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: () => "application/json" },
        json: async () => ({
          source: "server_player_visible_state_projection",
          sessionId,
          worldState: { player: { name: "沈知微", role: "scholar" } }
        })
      }))
    );

    renderRoute(`/game/${sessionId}`);

    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBe(sessionId));
    expect(screen.getByRole("link", { name: "主卷" }).getAttribute("href")).toBe(`/game/${sessionId}`);
    expect(screen.getAllByRole("link", { name: "舆图" }).some((link) => link.getAttribute("href") === `/game/${sessionId}/map`)).toBe(true);
    expect(screen.getAllByRole("link", { name: "人物" }).some((link) => link.getAttribute("href") === `/game/${sessionId}/people`)).toBe(true);
    expect(screen.getAllByRole("link", { name: "史册" }).some((link) => link.getAttribute("href") === `/game/${sessionId}/archive`)).toBe(true);
  });

  it("keeps the session routes inside the React Router tree", () => {
    renderRoute("/game/smoke-session/map");

    expect(screen.getByRole("heading", { name: "主卷" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "舆图" })).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload/i);
  });

  it("renders the S76.1 main game shell from safe player-state without leaking polluted text", async () => {
    const sessionId = "99999999-1111-4111-8111-111111111111";
    const manifest = buildMockAssetManifest(0);
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-manifest.json") {
        return new Response(JSON.stringify({
          ...manifest,
          assets: [
            {
              id: "ui-scene-military-tent-v1",
              category: "scene",
              usage: ["game_main"],
              scene: "military_tent",
              path: "/assets/ui/scenes/scene-military-tent-v1.webp",
              thumbnailPath: "/assets/ui/thumbs/thumb-scene-military-tent-v1.webp",
              fallbackRef: "fallback-paper-panel-v1",
              reviewStatus: "approved",
              visualReview: { status: "approved" },
              safetyReview: { status: "approved" }
            }
          ]
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId,
          worldState: {
            player: {
              name: "provider payload sk-test-secret",
              role: "general",
              officeTitle: "path=C:\\secret\\case.json"
            }
          },
          mapRuntimeView: { schemaVersion: 1 },
          eventArchiveView: { schemaVersion: 1 }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}`);

    await screen.findByRole("heading", { name: "主卷" });
    await screen.findByText("军帐筹谋");
    expect(screen.getByText("无名")).toBeTruthy();
    expect(screen.getAllByText("身份未题").length).toBeGreaterThan(0);
    expect(screen.getByText("2 / 5")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /舆图/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /人物/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /朝议/ }).length).toBeGreaterThan(0);
    expect(document.body.textContent || "").not.toMatch(/provider payload|sk-test-secret|path=|C:\\|raw audit|OPENAI_API_KEY|data\/sessions/i);
  });

  it("keeps polluted S76.1 turn narrative out of the main scroll", async () => {
    mockAssetManifestFetch(buildMockAssetManifest(0));
    useGameSessionStore.setState({
      currentSessionId: "s76-preview",
      currentSession: {
        sessionId: "s76-preview",
        worldState: { player: { name: "顾衡", role: "scholar" } },
        source: "server_player_visible_state_projection"
      },
      lastTurn: {
        sessionId: "s76-preview",
        narrative: "provider payload sk-test-secret path=C:\\secret\\case.json hiddenNotes",
        worldState: { player: { name: "顾衡", role: "scholar" } }
      }
    });

    renderRoute("/game/s76-preview");

    expect(screen.getByText("风声入座，旧卷重开。堂案、舆图与人物谱牒各归其卷。")).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/provider payload|sk-test-secret|path=|C:\\|hiddenNotes|OPENAI_API_KEY|data\/sessions/i);
  });

  it("tracks route-derived UI page state and closes safe drawers with Esc while restoring focus", async () => {
    renderRoute("/game/smoke-session/map");

    await waitFor(() => expect(useUiStateStore.getState().currentPage).toBe("map"));
    expect(useUiStateStore.getState().currentSessionId).toBe("smoke-session");

    const trigger = screen.getByRole("button", { name: "打开印匣" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("complementary", { name: "印匣" })).toBeTruthy();
    expect(useUiStateStore.getState().activeDrawer).toBe("settings");
    expect(screen.getByRole("button", { name: "关闭抽屉" })).toBe(document.activeElement);

    fireEvent.click(screen.getByRole("tab", { name: "显示" }));
    fireEvent.change(screen.getByLabelText("动效"), { target: { value: "reduced" } });
    expect(document.querySelector(".appShell")?.getAttribute("data-motion")).toBe("reduced");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(useUiStateStore.getState().activeDrawer).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("opens the S75.4 inkbox tabs without exposing unsafe settings details", async () => {
    const sessionId = "55555555-5555-4555-8555-555555555555";
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `/api/ai/settings/${sessionId}`) {
        return new Response(JSON.stringify({
          aiSettingsView: { preset: "balanced" },
          aiInvocationSummaryView: { safe: true }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/game/saves") {
        return new Response(JSON.stringify({
          saves: [
            {
              sessionId,
              playerName: "顾衡",
              role: "scholar",
              roleLabel: "书生",
              dynasty: "明",
              year: 1600,
              month: 5,
              tenDayPeriod: 2,
              turnCount: 7,
              summary: "贡院春寒，案上仍有未竟策问。",
              updatedAt: "2026-05-18T10:00:00.000Z"
            }
          ],
          skipped: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({
        source: "server_player_visible_state_projection",
        sessionId,
        worldState: { player: { name: "顾衡", role: "scholar" } },
        aiSettingsView: { preset: "balanced" },
        aiControlAuditView: { summary: "bounded" }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}`);

    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBe(sessionId));
    fireEvent.click(screen.getByRole("button", { name: "打开印匣" }));
    expect(screen.getByRole("tab", { name: "AI 设置" }).getAttribute("aria-selected")).toBe("true");
    await screen.findByText("当前策略：balanced");

    fireEvent.click(screen.getByRole("tab", { name: "旧案" }));
    await screen.findByText("顾衡");
    expect(screen.getByText("案 55555555")).toBeTruthy();
    expect(screen.getByText("明1600年5月中旬")).toBeTruthy();
    expect(screen.getByText("第 7 回合")).toBeTruthy();
    expect(screen.getByText("贡院春寒，案上仍有未竟策问。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "刷新" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "安全" }));
    expect(screen.getAllByText(/安全视图/).length).toBeGreaterThan(0);
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|base URL|raw prompt|raw audit|provider payload|data\/sessions/i);

    fireEvent.click(screen.getByRole("tab", { name: "旧案" }));
    fireEvent.click(screen.getByRole("button", { name: "载入" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/game/player-state/${sessionId}`, expect.anything()));
    await waitFor(() => expect(useGameSessionStore.getState().currentSessionId).toBe(sessionId));
  });

  it("renders S75.5 home save cases with metadata fallbacks", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/game/saves") {
        return new Response(JSON.stringify({
          saves: [
            {
              sessionId: "99999999-9999-4999-8999-999999999999"
            }
          ],
          skipped: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }));

    renderRoute("/");

    await screen.findByText("案 99999999");
    expect(screen.getByText("无名")).toBeTruthy();
    expect(screen.getByText("身份未题")).toBeTruthy();
    expect(screen.getByText("年月未详")).toBeTruthy();
    expect(screen.getByText("回合未记")).toBeTruthy();
    expect(screen.getByText("此卷暂无公开摘要。")).toBeTruthy();
    expect(screen.getByText("更新时间未记")).toBeTruthy();
    expect(screen.getByRole("link", { name: "读档" }).getAttribute("href")).toBe("/game/99999999-9999-4999-8999-999999999999");
    expect(document.body.textContent || "").not.toMatch(/worldState|raw audit|provider payload|data\/sessions|OPENAI_API_KEY/i);
  });

  it("drops polluted S75.5 save metadata before rendering", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/game/saves") {
        return new Response(JSON.stringify({
          saves: [
            {
              sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              playerName: "data/sessions/secret.json",
              roleLabel: "raw audit",
              summary: "provider payload sk-test-secret"
            }
          ],
          skipped: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }));

    renderRoute("/");

    await screen.findByText("案 aaaaaaaa");
    expect(screen.getByText("无名")).toBeTruthy();
    expect(screen.getByText("身份未题")).toBeTruthy();
    expect(screen.getByText("此卷暂无公开摘要。")).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/data\/sessions|raw audit|provider payload|sk-test-secret/i);
  });

  it("keeps the current session pointer after returning home and continues the runnable session", async () => {
    const sessionId = "77777777-7777-4777-8777-777777777777";
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId,
          worldState: { player: { name: "韩知远", role: "official", examRank: "进士", officeTitle: "翰林编修" } }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/game/saves") {
        return new Response(JSON.stringify({ saves: [], skipped: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}`);

    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBe(sessionId));
    fireEvent.click(screen.getByLabelText("返回千秋首页"));

    await screen.findByRole("heading", { name: "千秋" });
    expect(useUiStateStore.getState().currentPage).toBe("home");
    expect(useUiStateStore.getState().currentSessionId).toBe(sessionId);
    expect(screen.getByRole("heading", { name: "韩知远" })).toBeTruthy();
    expect(screen.getByText("翰林编修")).toBeTruthy();
    expect(screen.getByText("案 77777777")).toBeTruthy();
    expect(screen.getByRole("link", { name: "继续本局" }).getAttribute("href")).toBe(`/game/${sessionId}`);
    expect(screen.getByText("读档")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "继续本局" }));

    await waitFor(() => expect(useUiStateStore.getState().currentPage).toBe("game"));
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).not.toEqual(expect.arrayContaining([
      "/api/game/start",
      "/api/game/turn",
      `/api/game/state/${sessionId}`,
      "/api/dev/session-diagnostics"
    ]));
    expect(requestedUrls.some((url) => /\/api\/dev|\/api\/game\/state/.test(url))).toBe(false);
  });

  it("falls back when the S75.6 continue summary receives polluted safe payload text", async () => {
    const sessionId = "88888888-8888-4888-8888-888888888888";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/game/saves") {
        return new Response(JSON.stringify({ saves: [], skipped: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }));
    useUiStateStore.getState().syncSessionPayload({
      sessionId,
      narrative: "公开叙事。",
      worldState: {
        player: {
          name: "provider: openai",
          role: "official",
          examRank: "prompt: leaked",
          officeTitle: "path=C:\\secret\\case.json"
        }
      }
    }, "player-state");

    renderRoute("/");

    expect(await screen.findByRole("link", { name: "继续本局" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "无名" })).toBeTruthy();
    expect(screen.getByText("身份未题")).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/provider|prompt|hidden|key|path=|C:\\|data\/sessions|raw audit|OPENAI_API_KEY/i);
  });

  it("opens registry-backed local surfaces, writes safe drafts, and restores focus on Esc", async () => {
    renderRoute("/game/smoke-session/court");

    const trigger = screen.getByRole("button", { name: "拟圣旨" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "拟圣旨" });
    expect(dialog.textContent || "").toContain("服务器裁决");
    expect(dialog.textContent || "").not.toMatch(/raw audit|provider payload|hiddenNotes|data\/sessions|OPENAI_API_KEY/i);
    expect(screen.getByRole("button", { name: "关闭专题" })).toBe(document.activeElement);

    fireEvent.click(screen.getByRole("button", { name: "写入奏折草稿" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game"
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "拟圣旨" })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("restores scroll position and route focus when navigating between pages", async () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    renderRoute("/");
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "舆图" }));

    await waitFor(() => expect(useUiStateStore.getState().currentPage).toBe("map"));
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: "auto" });
    expect(document.querySelector(".pageFrame")).toBe(document.activeElement);
  });

  it("renders the S74.2 safe API forms without raw route wording", () => {
    renderRoute("/game/smoke-session/exam");

    expect(screen.getByRole("heading", { name: "科举" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "取题" })).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/\/api\/game\/state|raw audit|provider payload/i);
  });

  it("loads the S74.5 manifest-backed portrait ledger in small lazy pages", async () => {
    const fetchMock = mockAssetManifestFetch();
    renderRoute("/game/smoke-session/people");

    expect(screen.getByRole("heading", { name: "人物" })).toBeTruthy();
    await screen.findByText(/已接入 9 张人物页可用立绘；女性高清重制 2 张优先列前/);
    expect(fetchMock).toHaveBeenCalledWith("/assets/ui/ink-ui-manifest.json", expect.objectContaining({ headers: { Accept: "application/json" } }));

    const firstPageImages = screen.getAllByRole("img");
    expect(firstPageImages).toHaveLength(8);
    expect(firstPageImages.every((image) => image.getAttribute("loading") === "lazy")).toBe(true);
    expect(document.querySelector(".portraitGrid")?.getAttribute("data-total-portraits")).toBe("9");
    expect(document.body.textContent || "").not.toMatch(/prompt|provider payload|hiddenNotes|OPENAI_API_KEY|artifacts/i);

    fireEvent.click(screen.getByRole("button", { name: "下一组" }));
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("does not show stale exam actions on preview routes", () => {
    useGameSessionStore.setState({
      activeExam: {
        sessionId: "11111111-1111-4111-8111-111111111111",
        examId: "exam-1",
        examName: "童试",
        examQuestion: "策问一题"
      }
    });

    renderRoute("/game/s74-preview/exam");

    expect(screen.getByRole("button", { name: "取题" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "推进考场" })).toBeNull();
    expect(screen.queryByRole("button", { name: "交卷" })).toBeNull();
  });

  it("keeps the main action draft in the UI store and clears it from the composer", () => {
    renderRoute("/game/s74-preview");

    const input = screen.getByLabelText("本回合行动");
    fireEvent.change(input, { target: { value: "拜访座师，请教经义。" } });

    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "manual",
      targetPage: "game",
      text: "拜访座师，请教经义。"
    });

    fireEvent.click(screen.getByRole("button", { name: "清稿" }));
    expect(useUiStateStore.getState().actionDraft).toBeNull();
    expect(screen.getByLabelText("本回合行动")).toHaveProperty("value", "");
    expect(screen.getByRole("button", { name: "呈上" })).toHaveProperty("disabled", true);
  });

  it("keeps S75.9 AI quick actions draft-only and submits only with Enter", async () => {
    const sessionId = "66666666-6666-4666-8666-666666666666";
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId,
          worldState: { player: { name: "顾衡", role: "scholar" } }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/ai/quick-actions/${sessionId}`) {
        return new Response(JSON.stringify({
          schemaVersion: "s75.9-quick-actions.v1",
          sessionId,
          source: "mock-ai",
          status: "ready",
          quickActionSuggestions: [
            {
              id: "mock-study",
              source: "mock-ai",
              sourceLabel: "mock-ai",
              title: "温书",
              label: "温书",
              text: "温习经义，择一篇旧文重加点窜。",
              roleTags: ["scholar"],
              toolIntent: "study",
              evidenceRefs: []
            }
          ]
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/game/turn") {
        return new Response(JSON.stringify({
          sessionId,
          narrative: "经义稍明。",
          worldState: { player: { name: "顾衡", role: "scholar" } }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url} ${options?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}`);

    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBe(sessionId));
    expect(screen.getByRole("button", { name: "可行事" }).getAttribute("aria-expanded")).toBe("true");
    await screen.findByRole("button", { name: /温书 mock-ai 写入草稿/ });
    const quickCallsAfterLoad = fetchMock.mock.calls.filter(([url]) => url === `/api/ai/quick-actions/${sessionId}`).length;
    fireEvent.change(screen.getByLabelText("本回合行动"), { target: { value: "先自拟一段行动，不刷新快捷建议。" } });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(fetchMock.mock.calls.filter(([url]) => url === `/api/ai/quick-actions/${sessionId}`)).toHaveLength(quickCallsAfterLoad);

    fireEvent.click(screen.getByRole("button", { name: /温书 mock-ai 写入草稿/ }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "温习经义，择一篇旧文重加点窜。"
    });
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(0);

    fireEvent.keyDown(screen.getByLabelText("本回合行动"), { key: "Enter" });

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(1));
    const turnCall = fetchMock.mock.calls.find(([url]) => url === "/api/game/turn") as [string, RequestInit] | undefined;
    expect(JSON.parse(String(turnCall?.[1].body))).toMatchObject({
      sessionId,
      input: "温习经义，择一篇旧文重加点窜。"
    });
    const quickCall = fetchMock.mock.calls.find(([url]) => url === `/api/ai/quick-actions/${sessionId}`) as [string, RequestInit] | undefined;
    expect(JSON.parse(String(quickCall?.[1].body))).toEqual({
      page: "game",
      draftPreview: "",
      count: 3
    });
    await waitFor(() => expect(useUiStateStore.getState().actionDraft).toBeNull());
    expect(document.body.textContent || "").not.toMatch(/provider payload|raw state|raw audit|完整 prompt|data\/sessions|OPENAI_API_KEY/i);
  });

  it("wraps the S72 map renderer with safe React action drafts", async () => {
    class MockMapRenderer {
      options: { onRenderLabel?: (ref: unknown, position: { x: number; y: number }) => void; onClickRef?: (ref: unknown, position: { x: number; y: number }) => void };

      constructor(
        _container: HTMLElement,
        options: { onRenderLabel?: (ref: unknown, position: { x: number; y: number }) => void; onClickRef?: (ref: unknown, position: { x: number; y: number }) => void } = {}
      ) {
        this.options = options;
      }

      update(view: { refs?: unknown[] }) {
        view.refs?.forEach((ref, index) => this.options.onRenderLabel?.(ref, { x: 180 + index * 32, y: 140 }));
      }

      destroy() {
      }

      setMotionEnabled() {
      }
    }

    vi.stubGlobal("PIXI", {});
    vi.stubGlobal("MapRenderer", MockMapRenderer);
    useGameSessionStore.setState({
      currentSessionId: "s74-map-session",
      currentSession: {
        sessionId: "s74-map-session",
        narrative: "风过贡院。",
        worldState: { player: { name: "顾衡", role: "scholar" } },
        mapRuntimeView: {
          schemaVersion: 1,
          refs: [
            {
              mapEntityRef: "geo:exam-hall",
              label: "贡院",
              summary: "号舍灯火未歇。",
              layout: { x: 0.5, y: 0.5 },
              actionDraftRefs: ["draft-exam-road"]
            }
          ],
          routes: [],
          eventEffects: [],
          actionDrafts: {
            "draft-exam-road": {
              label: "写入赴试草稿",
              actionText: "沿驿路赴贡院，查问近日考期。"
            }
          },
          hiddenNotice: "mapRuntimeView 只含服务器安全投影。"
        }
      },
      status: "ready"
    });

    renderRoute("/game/s74-map-session/map");

    await screen.findByRole("button", { name: "贡院" });
    fireEvent.click(screen.getByRole("button", { name: "贡院" }));
    expect(screen.getByText("号舍灯火未歇。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "写入赴试草稿" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "map-runtime",
      targetPage: "game",
      text: "沿驿路赴贡院，查问近日考期。"
    });
    expect(document.body.textContent || "").not.toMatch(/raw audit|provider payload|hiddenNotes|OPENAI_API_KEY|data\/sessions/i);
  });
});
