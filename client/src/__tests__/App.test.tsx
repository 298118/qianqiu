import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { act, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAssetRegistryCache, type InkUiManifest } from "../assets/assetRegistry";
import { SurfaceHost } from "../components/SurfaceHost";
import { ErrorPage } from "../pages/ErrorPage";
import { routes } from "../router";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";

function renderRoute(initialEntry: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  return render(<RouterProvider router={router} />);
}

function deferredResponse<T>() {
  let resolvePayload!: (payload: T) => void;
  const response = new Promise<Response>((resolve) => {
    resolvePayload = (payload: T) => {
      resolve(new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    };
  });
  return { response, resolvePayload };
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
        identityTags: ["player", feminine ? "female_style" : "male_style"],
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
      aiConnectionStatus: "idle",
      quickActionStatus: "idle",
      quickActions: null,
      topicSurfaceStatus: "idle",
      topicDraftStatus: "idle",
      inventoryStatus: "idle",
      npcRosterStatus: "idle",
      npcDetailStatus: "idle",
      npcMutationStatus: "idle",
      topicSurface: null,
      topicDraft: null,
      inventory: null,
      npcRoster: null,
      npcDetail: null,
      lastNpcInteraction: null,
      lastTrade: null,
      lastNpcCommand: null,
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

  it("posts the S76.10 selected player portraitRef from the audited registry", async () => {
    const fetchMock = vi.fn(async (url: string, _options?: RequestInit) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest()), {
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

      return new Response(JSON.stringify({
        sessionId: "22222222-2222-4222-8222-222222222222",
        narrative: "起卷",
        worldState: {
          player: {
            name: "陆清远",
            role: "scholar",
            portraitRef: "portrait-test-female-2-v1"
          }
        }
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/");
    await waitFor(() => {
      expect(document.querySelectorAll("input[name='player-portrait']").length).toBeGreaterThan(0);
    });

    const portraitInputs = [...document.querySelectorAll<HTMLInputElement>("input[name='player-portrait']")];
    fireEvent.click(portraitInputs[1]);
    await waitFor(() => expect(portraitInputs[1].checked).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "新开一卷" }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/start")).toHaveLength(1));
    const startCall = fetchMock.mock.calls.find(([url]) => url === "/api/game/start") as
      | [string, RequestInit]
      | undefined;
    expect(JSON.parse(String(startCall?.[1].body))).toMatchObject({
      portraitRef: "portrait-test-female-2-v1"
    });
    expect(document.querySelector(".portraitChoiceGrid")?.getAttribute("data-visible-portraits")).toBe("6");
    expect(document.body.textContent || "").not.toMatch(/provider payload|hiddenNotes|OPENAI_API_KEY|artifacts|data\/sessions/i);
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

  it("keeps map runtime motion reduced when the browser requests reduced motion", async () => {
    class MockMapRenderer {
      options: { motionEnabled?: boolean; onRenderLabel?: (ref: unknown, position: { x: number; y: number }) => void };

      constructor(
        _container: HTMLElement,
        options: { motionEnabled?: boolean; onRenderLabel?: (ref: unknown, position: { x: number; y: number }) => void } = {}
      ) {
        this.options = options;
      }

      update(view: { refs?: unknown[] }) {
        view.refs?.forEach((ref, index) => this.options.onRenderLabel?.(ref, { x: 100 + index * 20, y: 120 }));
      }

      destroy() {
      }

      setMotionEnabled(enabled: boolean) {
        this.options.motionEnabled = enabled;
      }
    }

    vi.stubGlobal("PIXI", {});
    vi.stubGlobal("MapRenderer", MockMapRenderer);
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    })));
    useUiStateStore.getState().setDisplayPreference("motion", "full");
    useUiStateStore.getState().setDisplayPreference("mapMotion", true);
    useGameSessionStore.setState({
      currentSessionId: "88888888-8888-4888-8888-888888888888",
      currentSession: {
        sessionId: "88888888-8888-4888-8888-888888888888",
        narrative: "山河已铺。",
        worldState: { player: { name: "顾衡", role: "scholar" } },
        mapRuntimeView: {
          schemaVersion: 1,
          refs: [{ mapEntityRef: "geo:exam-hall", label: "贡院", summary: "号舍灯火未歇。" }],
          routes: [],
          eventEffects: [],
          actionDrafts: {}
        }
      },
      status: "ready"
    });

    renderRoute("/game/88888888-8888-4888-8888-888888888888/map");

    await screen.findByRole("heading", { name: "山河舆图" });
    await screen.findByRole("button", { name: "贡院" });
    expect(document.querySelector(".inkMapRuntimeBridge")?.getAttribute("data-map-motion")).toBe("reduced");
    expect(document.body.textContent || "").not.toMatch(/\/api\/game\/turn|provider payload|raw audit|OPENAI_API_KEY|data\/sessions/i);
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
    expect(screen.getAllByRole("link", { name: "囊箧" }).some((link) => link.getAttribute("href") === `/game/${sessionId}/inventory`)).toBe(true);
    expect(screen.getAllByRole("link", { name: "史册" }).some((link) => link.getAttribute("href") === `/game/${sessionId}/archive`)).toBe(true);
  });

  it("keeps the top navigation active state scoped to the current primary route", async () => {
    const sessionId = "11111111-2222-4333-8444-555555555555";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({
        source: "server_player_visible_state_projection",
        sessionId,
        worldState: { player: { name: "沈知微", role: "scholar" } },
        mapRuntimeView: {
          schemaVersion: 1,
          refs: [],
          routes: [],
          eventEffects: [],
          actionDrafts: {}
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
    );

    renderRoute(`/game/${sessionId}/map`);

    await screen.findByRole("heading", { name: "山河舆图" });
    const topNav = screen.getByRole("navigation", { name: "页面" });
    const mainLink = within(topNav).getByRole("link", { name: "主卷" });
    const mapLink = within(topNav).getByRole("link", { name: "舆图" });

    await waitFor(() => expect(mapLink.getAttribute("aria-current")).toBe("page"));
    expect(mainLink.getAttribute("href")).toBe(`/game/${sessionId}`);
    expect(mainLink.getAttribute("aria-current")).toBeNull();
    expect(mainLink.className).not.toContain("active");
  });

  it("offers safe recovery from bad routes inside a runnable session", () => {
    const sessionId = "11111111-2222-4333-8444-555555555555";

    renderRoute(`/game/${sessionId}/unknown`);

    expect(screen.getByRole("heading", { name: "无此卷页" })).toBeTruthy();
    expect(document.querySelector("[data-polish-route-state='s89-19-route-recovery']")).toBeTruthy();
    expect(screen.getByText("空卷只指路，不补造案卷内容，也不回显底层诊断。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "回主卷" }).getAttribute("href")).toBe(`/game/${sessionId}`);
    expect(screen.getByRole("link", { name: "归首页" }).getAttribute("href")).toBe("/");
    expect(document.body.textContent || "").not.toMatch(/data\/sessions|raw audit|provider payload|OPENAI_API_KEY/i);
  });

  it("does not offer session recovery for preview or malformed bad routes", () => {
    renderRoute("/game/s74-preview/unknown");

    expect(screen.getByRole("heading", { name: "无此卷页" })).toBeTruthy();
    expect(document.querySelector("[data-polish-route-state='s89-19-route-recovery']")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "回主卷" })).toBeNull();
    expect(screen.getByRole("link", { name: "归首页" }).getAttribute("href")).toBe("/");

    cleanup();
    renderRoute("/game/not-a-session/unknown");

    expect(screen.getByRole("heading", { name: "无此卷页" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "回主卷" })).toBeNull();
    expect(screen.getByRole("link", { name: "归首页" }).getAttribute("href")).toBe("/");
  });

  it("sanitizes route error diagnostics before rendering recovery links", async () => {
    const sessionId = "11111111-2222-4333-8444-555555555555";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const router = createMemoryRouter([
      {
        path: "/game/:sessionId/unknown",
        element: <div>不应显示</div>,
        hydrateFallbackElement: <div>载入中</div>,
        errorElement: <ErrorPage />,
        loader: () => {
          throw {
            status: 500,
            statusText: "provider payload data/sessions OPENAI_API_KEY",
            internal: true,
            data: "raw audit"
          };
        }
      }
    ], { initialEntries: [`/game/${sessionId}/unknown`] });

    try {
      render(<RouterProvider router={router} />);

      await screen.findByRole("heading", { name: "卷页受阻" });
      expect(screen.getByText("案卷暂不可读。")).toBeTruthy();
      expect(document.querySelector("[data-polish-route-state='s89-19-route-recovery']")).toBeTruthy();
      expect(screen.getByText("此页只给安全归路，不显示底层诊断、推演原文或本机路径。")).toBeTruthy();
      expect(screen.getByRole("link", { name: "回主卷" }).getAttribute("href")).toBe(`/game/${sessionId}`);
      expect(document.body.textContent || "").not.toMatch(/data\/sessions|raw audit|provider payload|OPENAI_API_KEY/i);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("does not offer a self-recovery link when the game root route errors", async () => {
    const sessionId = "11111111-2222-4333-8444-555555555555";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const router = createMemoryRouter([
      {
        path: "/game/:sessionId",
        element: <div>不应显示</div>,
        hydrateFallbackElement: <div>载入中</div>,
        errorElement: <ErrorPage />,
        loader: () => {
          throw {
            status: 500,
            statusText: "provider payload data/sessions OPENAI_API_KEY",
            data: "raw audit"
          };
        }
      }
    ], { initialEntries: [`/game/${sessionId}`] });

    try {
      render(<RouterProvider router={router} />);

      await screen.findByRole("heading", { name: "卷页受阻" });
      expect(screen.getByText("案卷暂不可读。")).toBeTruthy();
      expect(document.querySelector("[data-polish-route-state='s89-19-route-recovery']")).toBeTruthy();
      expect(screen.queryByRole("link", { name: "回主卷" })).toBeNull();
      expect(screen.getByRole("link", { name: "归首页" }).getAttribute("href")).toBe("/");
      expect(document.body.textContent || "").not.toMatch(/data\/sessions|raw audit|provider payload|OPENAI_API_KEY/i);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps malformed game root recovery local and diagnostic-free", async () => {
    const fetchMock = vi.fn(async (_url: string) => {
      throw new Error("should not fetch malformed game root");
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/game/not-a-session");

    expect(screen.getByRole("heading", { name: "主卷不可读" })).toBeTruthy();
    expect(document.querySelector("[data-polish-route-state='s89-19-game-route-recovery']")).toBeTruthy();
    expect(screen.getByText("未读取主卷接口，未打开专题层，也未写入行动草稿。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "归首页" }).getAttribute("href")).toBe("/");
    expect(fetchMock.mock.calls.map(([url]) => String(url)).some((url) => url.startsWith("/api/game/"))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/not-a-session|data\/sessions|raw audit|provider payload|OPENAI_API_KEY/i);
  });

  it("keeps malformed settings routes local and diagnostic-free", async () => {
    const fetchMock = vi.fn(async (_url: string) => {
      return new Response(JSON.stringify(buildMockAssetManifest(0)), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/game/not-a-session/settings");

    const routePanel = await screen.findByRole("article", { name: "案头工具" });
    expect(routePanel.querySelector("[data-polish-settings-state='s89-19-settings-route-recovery']")).toBeTruthy();
    expect(screen.getByText("当前案卷编号暂不可读；印匣仍可打开本地显示偏好、全局推演设置和旧案入口，不读取主卷、不打开专题、不写行动草稿。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "回首页择卷" }).getAttribute("href")).toBe("/");
    expect(fetchMock.mock.calls.map(([url]) => String(url)).some((url) => url.startsWith("/api/game/"))).toBe(false);
    expect([...document.querySelectorAll<HTMLAnchorElement>("a")].some((link) => (link.getAttribute("href") || "").includes("not-a-session"))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/not-a-session|data\/sessions|raw audit|provider payload|OPENAI_API_KEY/i);
  });

  it("keeps the session routes inside the React Router tree", () => {
    renderRoute("/game/smoke-session/map");

    expect(screen.getByRole("heading", { name: "山河舆图" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "主卷" })).toBeNull();
    const topNav = screen.getByRole("navigation", { name: "页面" });
    expect(within(topNav).getByRole("link", { name: "主卷" }).getAttribute("href")).toBe("/game/smoke-session");
    expect(within(topNav).getByRole("link", { name: "舆图" }).getAttribute("href")).toBe("/game/smoke-session/map");
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload/i);
  });

  it("keeps unsupported map route session ids out of links and local surfaces", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/game/not-a-session/map");

    expect(screen.getByRole("heading", { name: "山河舆图" })).toBeTruthy();
    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBeNull());
    const filterButton = screen.getByRole("button", { name: "筛舆图" });
    expect(filterButton).toHaveProperty("disabled", true);
    fireEvent.click(filterButton);

    expect(useUiStateStore.getState().activeSurface).toBeNull();
    expect(screen.getByRole("link", { name: "入局势簿" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "回主卷" }).getAttribute("href")).toBe("/");
    expect([...document.querySelectorAll<HTMLAnchorElement>("a")].some((link) => (link.getAttribute("href") || "").includes("not-a-session"))).toBe(false);
    expect(fetchMock.mock.calls.map(([url]) => String(url)).some((url) => url.startsWith("/api/game/"))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/not-a-session|OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload/i);
  });

  it("keeps unsupported archive route session ids out of shell links and surfaces", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/game/not-a-session/archive");

    expect(screen.getByRole("heading", { name: "史册" })).toBeTruthy();
    expect(document.querySelector(".sessionRouteShell")).toBeTruthy();
    expect(document.querySelector(".gameMainDeck")).toBeFalsy();
    expect(document.querySelector(".memorialComposer")).toBeFalsy();
    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBeNull());
    expect(screen.getByText("此案卷编号暂不可用于浏览器史册；请从首页开卷或载入旧案。")).toBeTruthy();
    const memorialButton = screen.getByRole("button", { name: "阅奏折" });
    expect(memorialButton).toHaveProperty("disabled", true);
    fireEvent.click(memorialButton);

    expect(useUiStateStore.getState().activeSurface).toBeNull();
    expect(screen.getByRole("link", { name: "入舆图" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "回主卷" }).getAttribute("href")).toBe("/");
    expect([...document.querySelectorAll<HTMLAnchorElement>("a")].some((link) => (link.getAttribute("href") || "").includes("not-a-session"))).toBe(false);
    expect(fetchMock.mock.calls.map(([url]) => String(url)).some((url) => url.startsWith("/api/game/"))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/not-a-session|OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload/i);
  });

  it("keeps unsupported court route session ids from opening topic surfaces", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/game/not-a-session/court");

    expect(screen.getByRole("heading", { name: "朝议与官署" })).toBeTruthy();
    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBeNull());
    const debateButton = screen.getByRole("button", { name: "朝议" });
    expect(debateButton).toHaveProperty("disabled", true);
    fireEvent.click(debateButton);

    expect(useUiStateStore.getState().activeSurface).toBeNull();
    expect(screen.queryByRole("dialog", { name: "朝议" })).toBeNull();
    expect([...document.querySelectorAll<HTMLAnchorElement>("a")].some((link) => (link.getAttribute("href") || "").includes("not-a-session"))).toBe(false);
    expect(fetchMock.mock.calls.map(([url]) => String(url)).some((url) => url.startsWith("/api/game/topic-surface/"))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/not-a-session|OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload/i);
  });

  it("keeps unsupported people route session ids out of NPC surfaces and stale data", async () => {
    const fetchMock = mockAssetManifestFetch(buildMockAssetManifest(0));
    useGameSessionStore.setState({
      currentSessionId: "11111111-2222-4333-8444-555555555555",
      currentSession: {
        sessionId: "11111111-2222-4333-8444-555555555555",
        worldState: { player: { name: "provider payload data/sessions OPENAI_API_KEY hiddenNotes raw audit", role: "scholar" } }
      }
    });

    renderRoute("/game/not-a-session/people");

    expect(screen.getByRole("heading", { name: "人物" })).toBeTruthy();
    expect(document.querySelector(".sessionRouteShell")).toBeTruthy();
    expect(document.querySelector("[data-polish-people='s89-9-portrait-material']")).toBeTruthy();
    expect(document.querySelector("[data-polish-people-workbench='s89-9-portrait-material']")).toBeTruthy();
    expect(document.querySelector("[data-polish-people-ledger='s89-9-portrait-material']")).toBeTruthy();
    expect(document.querySelector(".gameCommandBar")).toBeFalsy();
    expect(document.querySelector(".gameMainDeck")).toBeFalsy();
    expect(document.querySelector(".memorialComposer")).toBeFalsy();
    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBeNull());
    expect(screen.getAllByText("此案卷编号暂不可用于浏览器人物谱牒；请从首页开卷或载入旧案。").length).toBeGreaterThan(0);
    const profileButton = screen.getByRole("button", { name: "打开人物档案" });
    expect(profileButton).toHaveProperty("disabled", true);
    fireEvent.click(profileButton);

    expect(useUiStateStore.getState().activeSurface).toBeNull();
    expect([...document.querySelectorAll<HTMLAnchorElement>("a")].some((link) => (link.getAttribute("href") || "").includes("not-a-session"))).toBe(false);
    expect(fetchMock.mock.calls.map((call) => String((call as unknown[])[0])).some((url) => url.startsWith("/api/game/"))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/not-a-session|OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload|raw audit/i);
  });

  it("keeps unsupported inventory route session ids out of ledgers and transfer actions", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    useGameSessionStore.setState({
      currentSessionId: "22222222-2222-4222-8222-222222222222",
      currentSession: {
        sessionId: "22222222-2222-4222-8222-222222222222",
        worldState: { player: { name: "provider payload data/sessions", role: "scholar" } },
        inventoryView: {
          containers: [{ containerId: "bag", label: "provider payload", locked: false }],
          items: [{ itemId: "item", name: "OPENAI_API_KEY", containerId: "bag", transferPolicy: "tradeable" }],
          importantCredentials: []
        },
        resourceLedgerView: { accounts: [{ accountId: "silver", label: "raw audit", amount: 10, unit: "两" }] }
      }
    });

    renderRoute("/game/not-a-session/inventory");

    expect(screen.getByRole("heading", { name: "囊箧" })).toBeTruthy();
    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBeNull());
    expect(screen.getAllByText("此案卷编号暂不可用于浏览器囊箧；请从首页开卷或载入旧案。").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "呈请移置" })).toHaveProperty("disabled", true);
    expect(fetchMock.mock.calls.map((call) => String((call as unknown[])[0])).some((url) => url.startsWith("/api/game/"))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/not-a-session|OPENAI_API_KEY|data\/sessions|provider payload|raw audit/i);
  });

  it("keeps unsupported exam route session ids from showing stale errors or calling exam APIs", async () => {
    const fetchMock = mockAssetManifestFetch(buildMockAssetManifest(0));
    useGameSessionStore.setState({
      currentSessionId: "33333333-3333-4333-8333-333333333333",
      error: "provider payload data/sessions OPENAI_API_KEY raw audit",
      status: "loading",
      activeExam: {
        sessionId: "33333333-3333-4333-8333-333333333333",
        examId: "exam-stale",
        level: "child_exam",
        examName: "旧案试卷",
        examQuestion: "hiddenNotes",
        requirements: [],
        wordCount: 500
      }
    });

    renderRoute("/game/not-a-session/exam");

    expect(screen.getByRole("heading", { name: "科举" })).toBeTruthy();
    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBeNull());
    expect(screen.getAllByText("此案卷编号暂不可用于浏览器科举；请从首页开卷或载入旧案。").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "取题" })).toHaveProperty("disabled", true);
    expect(fetchMock.mock.calls.map((call) => String((call as unknown[])[0])).some((url) => url.startsWith("/api/exam/"))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/not-a-session|OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload|raw audit/i);
  });

  it("keeps unsupported ranking route session ids from stale榜文 and current links", async () => {
    const fetchMock = mockAssetManifestFetch(buildMockAssetManifest(0));
    useGameSessionStore.setState({
      currentSessionId: "44444444-4444-4444-8444-444444444444",
      currentSession: {
        sessionId: "44444444-4444-4444-8444-444444444444",
        worldState: { player: { name: "OPENAI_API_KEY", role: "scholar" } },
        examHonorView: { publicSummary: "provider payload data/sessions raw audit" }
      },
      lastExamResult: {
        sessionId: "44444444-4444-4444-8444-444444444444",
        examId: "exam-result-stale",
        level: "child_exam",
        examName: "hiddenNotes",
        ranking: [{ name: "provider payload", place: 1, isPlayer: true }],
        worldState: { player: { name: "OPENAI_API_KEY", role: "scholar" } }
      }
    });

    renderRoute("/game/not-a-session/ranking");

    expect(screen.getByRole("heading", { name: "皇榜" })).toBeTruthy();
    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBeNull());
    expect(screen.getAllByText("此案卷编号暂不可用于浏览器皇榜；请从首页开卷或载入旧案。").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "跳至我名" })).toHaveProperty("disabled", true);
    expect([...document.querySelectorAll<HTMLAnchorElement>("a")].some((link) => (link.getAttribute("href") || "").includes("not-a-session"))).toBe(false);
    expect(fetchMock.mock.calls.map((call) => String((call as unknown[])[0])).some((url) => url.startsWith("/api/game/"))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/not-a-session|OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload|raw audit/i);
  });

  it("renders the S76.1 main game shell from safe player-state without leaking polluted text", async () => {
    const sessionId = "99999999-1111-4111-8111-111111111111";
    const manifest = buildMockAssetManifest(0);
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
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
      if (url === `/api/game/npcs/${sessionId}?pageSize=50`) {
        return new Response(JSON.stringify({
          sessionId,
          npcRosterView: {
            items: [
              {
                npcId: "npc:teacher-gu",
                displayName: "顾文衡",
                tier: "active",
                roleTags: ["teacher"],
                stageTags: ["academy"],
                publicProfile: { title: "乡中塾师", summary: "顾文衡为乡中塾师，与玩家情分亲近。" },
                relationshipSummary: { labels: ["师友"] },
                availableInteractions: ["talk", "trade"]
              }
            ]
          },
          npcInteractionView: { items: [] },
          delegatedTaskView: { items: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/npc/${sessionId}/npc%3Ateacher-gu`) {
        return new Response(JSON.stringify({
          sessionId,
          npcDetailView: {
            npcId: "npc:teacher-gu",
            displayName: "顾文衡",
            tier: "active",
            roleTags: ["teacher"],
            stageTags: ["academy"],
            publicProfile: { title: "乡中塾师", origin: "清河县", summary: "顾文衡为乡中塾师。" },
            relationship: { closeness: 18, trust: 60, labels: ["师友"] },
            availableInteractions: ["talk", "trade"]
          },
          npcInteractionView: { items: [] },
          tradeLedgerView: { items: [] },
          delegatedTaskView: { items: [] }
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
    expect(screen.getByText("2 / 13")).toBeTruthy();
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

  it("renders the S76.2 scholar panel from safe study and calendar views as draft-only actions", async () => {
    const sessionId = "12345678-1111-4111-8111-111111111111";
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify({
          ...buildMockAssetManifest(0),
          assets: [
            {
              id: "ui-role-scholar-study-v1",
              category: "role_background",
              usage: ["game_main"],
              role: "scholar",
              path: "/assets/ui/roles/role-scholar-study-v1.webp",
              thumbnailPath: "/assets/ui/thumbs/thumb-role-scholar-study-v1.webp",
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
          worldState: { player: { name: "顾衡", role: "scholar", teacher: "顾文衡" } },
          studyProfileView: {
            schemaVersion: 1,
            dateLabel: "明1644年正月中旬",
            summary: "长处在史事典故，短处在制艺章法。",
            dimensions: { classicsFoundation: 72, eightLeggedForm: 54 },
            dimensionLabels: { classicsFoundation: "经义根柢", eightLeggedForm: "制艺章法" },
            teacherAdvice: [{ id: "advice-1", focus: "制艺章法", advice: "隔日练破题与承题。" }],
            teacherFeedback: [{ id: "bad-feedback", focus: "prompt", advice: "provider payload sk-test-secret" }],
            smallExercises: [{ id: "exercise-1", title: "策论小题", summary: "以灾赈旧案拟三策。" }],
            academyNetwork: {
              teacher: { name: "顾文衡" },
              academy: { name: "县学讲席" },
              classmates: [{ characterId: "peer-1", name: "沈同窗", publicSummary: "可互评文章。" }],
              sponsorship: { publicSummary: "保结尚需稳师承与声望。" }
            },
            nextPlan: {
              focus: "制艺章法",
              items: ["破题一则", "承题起讲各一段"],
              bookList: ["《论语》"],
              planningWindow: {
                startLabel: "明1644年正月中旬",
                reviewLabel: "三旬后复盘"
              },
              intensity: {
                label: "补弱",
                currentScore: 54,
                targetScore: 63,
                summary: "弱项已露，三旬内先稳章法与根基。"
              },
              dailyRhythm: [
                { id: "rhythm-morning", label: "晨课", detail: "读《论语》，摘制艺章法题眼一则。" },
                { id: "rhythm-midday", label: "午课", detail: "按制艺章法作短纲，限时成段。" },
                { id: "rhythm-evening", label: "暮课", detail: "誊清旧文，圈出一处可改处。" }
              ],
              checkpoints: [
                { id: "checkpoint-first", label: "上旬复核", detail: "交一则制艺章法短答给老师圈点。" },
                { id: "checkpoint-third", label: "下旬定稿", detail: "把制艺章法弱处写入考前札记。" }
              ],
              riskNotes: ["制艺章法若三旬无进，下一场备考压力会继续抬高。"],
              nextActions: ["今日先做“破题一则”，写成短札交老师圈点。"],
              authorityBoundary: "读书计划由服务器按学业画像、师友关系和科场记录生成；AI 老师只能建议，不能直接改属性、保结、科名、榜次或官职。"
            },
            examPreparation: {
              examName: "童试",
              label: "吃紧",
              score: 62,
              summary: "保结未稳，临考须先稳章法。",
              studyFocus: "制艺章法",
              causes: ["保结未稳。"],
              suggestedActions: ["请老师复核保结。"]
            }
          },
          examCalendarView: {
            currentDateLabel: "明1644年正月中旬",
            nextExam: {
              level: "child_exam",
              examName: "童试",
              isOpen: true,
              windowLabel: "正月中旬",
              preparationMonths: 1,
              travelMonths: 0
            }
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/npcs/${sessionId}?pageSize=50`) {
        return new Response(JSON.stringify({
          sessionId,
          npcRosterView: { items: [] },
          npcInteractionView: { items: [] },
          delegatedTaskView: { items: [] }
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}`);

    await screen.findByRole("heading", { name: "寒窗书斋" });
    expect(screen.getByText("长处在史事典故，短处在制艺章法。")).toBeTruthy();
    expect(screen.getByText("经义根柢")).toBeTruthy();
    expect(screen.getByText("隔日练破题与承题。")).toBeTruthy();
    expect(screen.getByText("沈同窗")).toBeTruthy();
    expect(screen.getByText("童试")).toBeTruthy();
    expect(screen.getByText("晨课")).toBeTruthy();
    expect(screen.getByText(/三旬后复盘/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "备考压力" })).toBeTruthy();
    expect(screen.getByText(/吃紧 62\/100/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "入科举页" }).getAttribute("href")).toBe(`/game/${sessionId}/exam`);

    fireEvent.click(screen.getByRole("button", { name: "执行首课" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "今日先做“破题一则”，写成短札交老师圈点。"
    });
    fireEvent.click(screen.getByRole("button", { name: "请老师改文" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "携旧作拜见老师，请其点评破题、承题与立意得失。"
    });
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(0);
    expect(document.body.textContent || "").not.toMatch(/provider payload|sk-test-secret|prompt|raw audit|data\/sessions|OPENAI_API_KEY/i);
  });

  it("renders the S76.3 magistrate panel from safe local affairs and fiscal views as draft-only actions", async () => {
    const sessionId = "22345678-1111-4111-8111-111111111111";
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify({
          ...buildMockAssetManifest(0),
          assets: [
            {
              id: "ui-role-magistrate-yamen-desk-v1",
              category: "role_background",
              usage: ["game_main"],
              role: "magistrate",
              path: "/assets/ui/roles/role-magistrate-yamen-desk-v1.webp",
              thumbnailPath: "/assets/ui/thumbs/thumb-role-magistrate-yamen-desk-v1.webp",
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
          worldState: { player: { name: "杜明府", role: "magistrate", officeTitle: "清河县知县" } },
          officialPostingsView: {
            postings: [{
              id: "posting-player-current",
              holderType: "player",
              officeTitle: "清河县知县",
              cityId: "city-qinghe",
              performanceScore: 62,
              impeachmentRisk: 18,
              publicReputation: 57,
              publicSummary: "本任正在清结案牍与钱粮。"
            }]
          },
          localAffairsDocketView: {
            dateLabel: "明1644年正月中旬",
            counts: { total: 5, judicial: 1, revenue: 1, waterworks: 1, banditry: 1, gentry: 1 },
            dockets: [
              {
                id: "docket-judicial",
                domain: "judicial",
                domainLabel: "刑名",
                title: "清河县刑名词讼",
                statusLabel: "急办",
                pressureScore: 82,
                publicSummary: "词讼积压，须核证词与案卷。"
              },
              {
                id: "docket-revenue",
                domain: "revenue",
                domainLabel: "钱粮",
                title: "清河县钱粮奏销",
                statusLabel: "留察",
                pressureScore: 58,
                publicSummary: "仓储与税粮需复核。"
              },
              {
                id: "docket-water",
                domain: "waterworks",
                domainLabel: "水利",
                title: "清河县水利修防",
                statusLabel: "吃紧",
                pressureScore: 67,
                publicSummary: "河堤与闸坝待查。"
              },
              {
                id: "docket-bandit",
                domain: "banditry",
                domainLabel: "盗匪",
                title: "清河县盗匪缉捕",
                statusLabel: "留察",
                pressureScore: 48,
                publicSummary: "驿路盗警需问捕役。"
              },
              {
                id: "docket-gentry",
                domain: "gentry",
                domainLabel: "士绅",
                title: "清河县士绅公议",
                statusLabel: "留察",
                pressureScore: 46,
                publicSummary: "乡约与徭役争执待调停。"
              },
              {
                id: "bad-docket",
                domain: "judicial",
                domainLabel: "prompt",
                title: "provider payload sk-test-secret",
                publicSummary: "path=C:\\secret\\case.json"
              }
            ]
          },
          economicFiscalView: {
            dateLabel: "明1644年正月中旬",
            localTreasuryReports: [{
              id: "treasury-1",
              title: "清河县库银赈济",
              statusLabel: "留察",
              localTreasuryCapacity: 44,
              reliefPressure: 63,
              publicSummary: "库银承载偏紧，须核赈册。"
            }],
            grainMarketReports: [{
              id: "grain-1",
              title: "清河县粮储市价",
              statusLabel: "吃紧",
              grainStock: 41,
              marketPressure: 66,
              publicSummary: "粮价上浮，仓储需查。"
            }],
            marketIncidents: [{
              id: "incident-1",
              kindLabel: "粮价仓储预警",
              title: "清河县粮价仓储预警",
              statusLabel: "急报",
              pressureScore: 72,
              publicSummary: "市价承压，只作公开预警。"
            }]
          },
          marketPriceView: {
            averagePriceIndex: 112,
            priceRows: [
              {
                priceId: "grain_shi",
                label: "粮食一石",
                currentSilverLiang: 0.9,
                availability: "吃紧",
                trendLabel: "上扬",
                marketPressure: 66,
                drivers: ["仓储", "灾赈", "秋收"]
              },
              {
                priceId: "office_budget_unit",
                label: "官署经费一档",
                currentSilverLiang: 9,
                availability: "平稳",
                trendLabel: "持平",
                marketPressure: 42,
                drivers: ["库银", "贪腐", "差役支应"]
              }
            ]
          },
          npcEconomyView: {
            lastMonthlyPeriodKey: "1644-01",
            recentEvents: ["交易月账：1条未结议价已转为逾期作废。"]
          },
          economyTraceView: {
            schemaVersion: "s88.8-economy-trace.v1",
            summary: "已整理地方钱粮、市价、交易、委派和月账解释。",
            traceItems: [
              {
                traceId: "magistrate-market:safe",
                traceType: "market_price_signal",
                groupLabel: "月账线索",
                title: "粮食一石上扬",
                publicSummary: "仓储吃紧，压力66；可作为平粜与赈济复核材料。",
                statusLabel: "上扬",
                affectedLabels: ["粮食一石"],
                amountView: { label: "现价", after: 0.9, unit: "两" },
                nextStep: "市价只作交易、维护和叙事裁决材料；前端不得自行成交。"
              },
              {
                traceId: "magistrate-task:safe",
                traceType: "delegated_task_budget",
                groupLabel: "委派回禀",
                title: "清查赈册委派",
                publicSummary: "典吏承办中；预算、成败和关系影响由服务器裁决。",
                statusLabel: "待办",
                affectedLabels: ["典吏"],
                nextStep: "等待到期月结；提前更改任务需另写行动草稿。"
              },
              {
                traceId: "magistrate-resource:not-shown",
                traceType: "resource_snapshot",
                groupLabel: "资源变化",
                title: "库银账面快照",
                publicSummary: "地方官主卷不展示纯资源快照。"
              },
              {
                traceId: "magistrate-polluted",
                traceType: "trade_negotiation",
                groupLabel: "交易议价",
                title: "污染经济解释",
                publicSummary: "provider payload privateSignalTags data/sessions sk-test-secret",
                statusLabel: "可阅"
              }
            ]
          },
          domainConsequenceView: {
            active: true,
            summary: "当前有2条地方公开后果可追踪，已接入事件档案、世界议程和官职月报。",
            recentConsequences: [
              {
                id: "DC-city-policy-rice-price",
                sourceType: "city_policy",
                sourceLabel: "地方政策",
                kindLabel: "政策后果",
                title: "清河县平抑米价余波",
                statusLabel: "已记入后果追踪",
                publicSummary: "平抑米价暂稳民心，但库银承载继续吃紧。",
                affectedMetricLabels: ["府库", "民心"],
                severity: 2,
                nextStep: "把清河县平抑米价余波列入月报，后续财政民情仍由服务器逐旬结算。"
              },
              {
                id: "DC-npc-economy-monthly",
                sourceType: "npc_economy",
                sourceLabel: "人物经济",
                kindLabel: "经济后果",
                title: "人物经济月账",
                statusLabel: "已记入后果追踪",
                publicSummary: "交易逾期作废只作公开月账摘要，不改前端资产。",
                nextStep: "把人物经济月账列入人物经济追踪，资产、交易、委派和人情债仍由旬更或月结裁决。"
              },
              {
                id: "bad-domain-consequence",
                sourceType: "city_policy",
                sourceLabel: "rawSql",
                title: "stateDelta evidenceRefs outcomeId",
                publicSummary: "cityPolicyLedger playerDelta auditRecord"
              }
            ],
            nextActions: [{
              id: "trace-DC-city-policy-rice-price",
              label: "续记地方后果",
              text: "把清河县平抑米价余波列入月报，后续财政民情仍由服务器逐旬结算。"
            }]
          }
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}`);

    await screen.findByRole("heading", { name: "地方官署" });
    expect(screen.getAllByText("清河县刑名词讼").length).toBeGreaterThan(0);
    expect(screen.getByText("钱粮仓储")).toBeTruthy();
    expect(screen.getByText("基础市价")).toBeTruthy();
    expect(screen.getByText("粮食一石")).toBeTruthy();
    expect(screen.getByText("人物月账")).toBeTruthy();
    expect(screen.getByText("交易月账：1条未结议价已转为逾期作废。")).toBeTruthy();
    expect(screen.getByText("钱粮与市价为何变化")).toBeTruthy();
    expect(screen.getByText("粮食一石上扬")).toBeTruthy();
    expect(screen.getByText("清查赈册委派")).toBeTruthy();
    expect(screen.queryByText("库银账面快照")).toBeNull();
    expect(screen.queryByText("污染经济解释")).toBeNull();
    expect(screen.getByText("领域后果追踪")).toBeTruthy();
    expect(screen.getByText("清河县平抑米价余波")).toBeTruthy();
    expect(screen.getByText("人物经济月账")).toBeTruthy();
    expect(screen.getByText("水利盗警")).toBeTruthy();
    expect(screen.getByText("士绅乡约")).toBeTruthy();
    expect(screen.getByText("审案、征税、开仓、水利、缉捕、任免和考成都须候案卷回批。")).toBeTruthy();
    expect(screen.getByText("基础市价和人物月账按旬更/月结入卷；本页只显示，不成交、不改账。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "升堂核案" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "升堂核问积案，核对公开证词、案卷日期与里甲呈报，不自行结案。"
    });
    fireEvent.click(screen.getByRole("button", { name: "续记地方后果" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "把清河县平抑米价余波列入月报，后续财政民情仍由主卷逐旬结算。"
    });
    fireEvent.click(screen.getAllByRole("button", { name: "拟复核" })[0]);
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: expect.stringContaining("资源、物品、交易、委派、人情债和关系变化仍候案卷回批")
    });
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(0);
    expect(document.body.textContent || "").not.toMatch(/provider payload|privateSignalTags|sk-test-secret|prompt|raw audit|path=|C:\\|data\/sessions|OPENAI_API_KEY|stateDelta|playerDelta|evidenceRefs|outcomeId|auditRecord|cityPolicyLedger|rawSql/i);
  });

  it("renders the S76.4 official minister panel from safe career views as draft-only actions", async () => {
    const sessionId = "32345678-1111-4111-8111-111111111111";
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify({
          ...buildMockAssetManifest(0),
          assets: [
            {
              id: "ui-role-official-bureau-desk-v1",
              category: "role_background",
              usage: ["game_main"],
              role: "official",
              path: "/assets/ui/roles/role-official-bureau-desk-v1.webp",
              thumbnailPath: "/assets/ui/thumbs/thumb-role-official-bureau-desk-v1.webp",
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
          worldState: { player: { name: "韩知远", role: "official", examRank: "进士", officeTitle: "翰林院编修" } },
          officialCareerView: {
            active: true,
            generatedAtTurn: 9,
            currentPosting: "翰林院编修",
            tenureMonths: 8,
            careerScore: 64,
            riskScore: 22,
            bureau: {
              id: "hanlin_academy",
              name: "翰林院",
              officeTitle: "翰林院编修",
              duties: ["修史", "起草诰敕", "侍读"],
              summary: "翰林院差遣清贵，章奏与考成仍由服务器裁决。"
            },
            assignmentSummary: { activeCount: 2, urgentCount: 1, latestTitle: "撰修起居注" },
            firstMonthExperience: {
              active: true,
              assignment: {
                id: "ASG-0009-first-month-top-hanlin-editor",
                title: "馆阁讲章校订",
                kind: "memorial_drafting",
                phaseLabel: "正在查办",
                riskLabel: "可控",
                progress: 42,
                risk: 18,
                deadlineLabel: "尚余一旬",
                visibleSummary: "首月须校订馆阁讲章并试拟制诰。"
              },
              receipt: {
                title: "讲章回署",
                publicSummary: "馆阁讲章校订正在查办，风险可控，尚余一旬。",
                superiorFeedback: "堂官先看章法、避讳和能否切中本职。",
                peerFeedback: "同年提醒馆阁旧例与上疏分寸。"
              },
              assessmentSignals: ["正在查办：进度会影响首月考成。", "可控：仍需按期回署。"],
              nextActions: [
                { id: "receipt", label: "拟回堂官", text: "就馆阁讲章校订拟回堂官札，说明进度、风险与请裁事项。" }
              ],
              monthlyBriefingHint: "月末月报会摘录馆阁讲章校订的进度、回署事项和下月可行。"
            },
            courtEntry: {
              active: true,
              id: "official-court-entry-first-month-ASG-0009-first-month-top-hanlin-editor",
              title: "首月回署：馆阁讲章校订",
              publicSummary: "讲章回署已把馆阁讲章校订整理为公开回署材料，可入奏折队列或朝议筹议；尚余四月入考成。",
              statusLabel: "正在查办 / 可控",
              targetSurfaces: [
                { surfaceId: "memorial-review", label: "奏折队列" },
                { surfaceId: "court-debate", label: "朝议筹议" }
              ],
              memorialEntry: {
                title: "馆阁讲章校订奏折材料",
                publicSummary: "馆阁讲章校订正在查办，风险可控，尚余一旬。",
                draftText: "臣谨就馆阁讲章校订具奏：据讲章回署说明公开进度、上官同僚所疑、考成风险与请裁事项。"
              },
              courtDebateEntry: {
                title: "馆阁讲章校订朝议题",
                publicSummary: "堂官先看章法、避讳和能否切中本职。同年提醒馆阁旧例与上疏分寸。",
                draftText: "请付朝议筹议馆阁讲章校订后续章程。"
              },
              assessmentTrace: {
                meritScore: 61,
                riskScore: 24,
                traceLabel: "尚余四月入考成",
                signals: ["正在查办：进度会影响首月考成。", "可控：仍需按期回署。"]
              },
              latestResolution: {
                id: "OCER-app-fixture",
                status: "accepted_for_review",
                statusLabel: "准入复核",
                publicSummary: "准入复核：馆阁讲章校订已入奏折队列服务器裁决，不直接任免、奖惩、处分或成弹劾。",
                nextStep: "由部院复核公开凭据后再入长期考成。"
              },
              latestFollowUp: {
                id: "OCEF-app-fixture",
                stage: "bureau_review",
                stageLabel: "部院覆奏",
                status: "referred_to_bureau",
                statusLabel: "部院待覆",
                publicSummary: "部院待覆：馆阁讲章校订承接近次准入复核进入部院覆奏，皇帝、部院、台谏只形成公开中间意见，不直接任免、奖惩、处分或成弹劾。",
                participantSummaries: [
                  {
                    actorId: "hanlin_academy",
                    roleLabel: "翰林院",
                    publicPosition: "翰林院要求补齐讲章出处、避讳和堂官问答。"
                  },
                  {
                    actorId: "censorate",
                    roleLabel: "台谏",
                    publicPosition: "台谏只留观察，不把风险直接写成弹劾成案。"
                  }
                ],
                nextStep: "相关部院待覆，下一步补齐公开凭据、限期和经手人。"
              },
              followUpNextActions: [
                {
                  id: "court-follow-up",
                  label: "朝议跟进",
                  text: "就馆阁讲章校订按近次裁决准入复核作朝议跟进，令诸臣只列可行、不可行和待查事项。"
                },
                {
                  id: "bureau-reply",
                  label: "部院覆奏",
                  text: "请相关部院就馆阁讲章校订承接近次裁决准入复核覆奏，列明公开凭据、经手人、限期和仍须服务器裁决之处。"
                }
              ],
              superiorFollowUp: "堂官先看章法、避讳和能否切中本职。",
              peerFollowUp: "同年提醒馆阁旧例与上疏分寸。",
              nextActions: [
                {
                  id: "send-to-memorial-review",
                  label: "入奏折队列",
                  text: "臣谨就馆阁讲章校订具奏：据讲章回署说明公开进度、上官同僚所疑、考成风险与请裁事项。"
                },
                {
                  id: "send-to-court-debate",
                  label: "付朝议筹议",
                  text: "请付朝议筹议馆阁讲章校订后续章程。"
                },
                {
                  id: "track-assessment",
                  label: "续记考成",
                  text: "续记馆阁讲章校订入本任考成簿，列明尚余四月入考成、功绩风险与仍须服务器裁决的后果。"
                }
              ]
            },
            assignments: [
              {
                id: "assignment-1",
                title: "撰修起居注",
                kind: "memorial_drafting",
                status: "active",
                deadlineLabel: "尚余一旬",
                progress: 35,
                risk: 18,
                visibleSummary: "须核对公开诏令与朝会记录。"
              },
              {
                id: "bad-assignment",
                title: "provider payload sk-test-secret",
                kind: "audit",
                visibleSummary: "path=C:\\secret\\memo.json"
              }
            ],
            assessment: {
              meritScore: 61,
              riskScore: 24,
              pendingRecommendation: "候考成",
              nextReviewInMonths: 4,
              notes: ["文章清谨，差遣尚需按期。", "prompt provider payload"]
            },
            networkSummary: {
              publicSummary: "同年与座师只显示公开往来。",
              sameYearPeers: [{ id: "same-year-1", title: "沈同年", publicSummary: "可询问翰林院近例。" }]
            },
            procedureSummary: {
              impeachmentStage: "risk_watch",
              visibleNotice: "台谏尚未成案，只能先辨明公开事实。",
              risk: 26,
              deadlineLabel: "未定"
            },
            lastOutcome: { id: "outcome-1", label: "初授翰林", type: "appointment" },
            recentOutcomes: [{ id: "outcome-1", label: "初授翰林", reason: "殿试后入馆。" }]
          },
          appointmentTrackView: {
            publicSummary: "殿试后由服务器定翰林院编修。",
            latestTrack: { honorTitle: "二甲进士", trackLabel: "馆选", officeTitle: "翰林院编修" },
            latestDecision: { trackLabel: "馆选", officeTitle: "翰林院编修" },
            records: [{ id: "appointment-1", honorTitle: "二甲进士", publicSummary: "服务器定初授。" }]
          },
          officialPostingsView: {
            bureaus: [{ id: "hanlin_academy", name: "翰林院", duties: ["修史", "起草诰敕"] }],
            postings: [{
              id: "posting-player-current",
              holderType: "player",
              officeTitle: "翰林院编修",
              bureauId: "hanlin_academy",
              performanceScore: 62,
              impeachmentRisk: 21,
              publicReputation: 66
            }],
            assessmentRecords: [{
              id: "assessment-player",
              postingId: "posting-player-current",
              meritScore: 61,
              riskScore: 24,
              recommendation: "候考成",
              publicFinding: "差遣尚稳，须谨慎应对台谏风声。"
            }]
          },
          actorMemoryView: {
            actors: [{ actorId: "same-year-1", actorLabel: "沈同年", summary: "同年公开相助。" }],
            recentUpdates: [{ id: "memory-1", title: "座师来帖", summary: "提醒谨守本职。" }]
          },
          aiControlAuditView: {
            publicPanel: {
              summary: "AI 调动审计仅展示公开摘要。",
              rejectedToolCallCount: 0,
              publicResults: [{ id: "audit-1", title: "快捷建议", summary: "只生成草稿。" }]
            }
          },
          playerMonthlyBriefingView: {
            active: true,
            latest: {
              reportId: "PMB-1644-01-0009",
              publicSummary: "首月差事已入本月官职月报。"
            }
          },
          courtConsequenceView: {
            active: true,
            summary: "当前有1条奏议链路可转为长期官场后果信号，所有信号只入考成观察、月报和世界议程。",
            pendingSources: [{
              id: "court-consequence-source-1",
              title: "部院覆奏：馆阁讲章校订",
              statusLabel: "部院待覆",
              publicSummary: "讲章校订后续可入本任考成观察，风宪风险只作公开信号。"
            }],
            recentSignals: [{
              id: "OCC-app-fixture",
              title: "考成压力：馆阁讲章校订",
              statusLabel: "入考成观察",
              publicSummary: "馆阁讲章校订转为官场后果信号，后续仍候服务器裁决。"
            }],
            nextActions: [{
              id: "merge-assessment",
              label: "合入考成观察",
              text: "将馆阁讲章校订合入本任考成观察，只列公开功过和待核凭据。"
            }]
          },
          economyTraceView: {
            schemaVersion: "s88.8-economy-trace.v1",
            summary: "已整理部院可读的交易、委派、人情债和市价解释。",
            traceItems: [
              {
                traceId: "official-trade:safe",
                traceType: "trade_negotiation",
                groupLabel: "交易议价",
                title: "部院采买纸张议价",
                publicSummary: "纸价小涨，议价材料可供奏折考成复核。",
                statusLabel: "议价中",
                affectedLabels: ["纸张", "韩员外"],
                amountView: { label: "议价银两", delta: -3, unit: "两" },
                nextStep: "交易仍需后续服务器结算路径确认，不视为已经成交。"
              },
              {
                traceId: "official-human-debt:safe",
                traceType: "human_debt_monthly",
                groupLabel: "月账线索",
                title: "人情债月账可入考成",
                publicSummary: "公开人情债略增，可作为拜会座师和回堂官材料。",
                statusLabel: "已登记",
                affectedLabels: ["座师", "月账"],
                nextStep: "人情债和关系变化仍由服务器月结与普通回合裁决。"
              },
              {
                traceId: "official-inventory:not-shown",
                traceType: "inventory_aging",
                groupLabel: "库存保养",
                title: "砚台保养",
                publicSummary: "官员主卷不展示纯囊箧保养。"
              },
              {
                traceId: "official-polluted",
                traceType: "delegated_task_budget",
                groupLabel: "委派回禀",
                title: "污染委派解释",
                publicSummary: "provider payload hiddenDossier data/sessions sk-test-secret",
                statusLabel: "可阅"
              }
            ]
          },
          domainConsequenceView: {
            active: true,
            summary: "当前有1条跨域公开后果可追踪。",
            recentConsequences: [{
              id: "DC-official-city-policy",
              sourceType: "city_policy",
              sourceLabel: "地方政策",
              kindLabel: "政策后果",
              title: "清河县粮价余波",
              statusLabel: "已记入后果追踪",
              publicSummary: "清河县粮价处置已入事件档案，可供部院复核财政与民情。",
              affectedMetricLabels: ["府库", "民心"],
              severity: 2,
              nextStep: "把清河县粮价余波列入部院后果复核，后续考成与财政仍候服务器裁决。"
            }],
            nextActions: [
              {
                id: "trace-DC-official-city-policy",
                label: "续记跨域后果",
                text: "把清河县粮价余波列入部院后果复核，后续考成与财政仍候服务器裁决。"
              },
              {
                id: "trace-DC-orphan-official",
                label: "不应显示孤证后果",
                text: "另案余波只作孤立草稿，不绑定当前公开后果条目。"
              }
            ]
          }
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}`);

    await screen.findByRole("heading", { name: "部院官署" });
    expect(screen.getByText("官职履历")).toBeTruthy();
    expect(screen.getAllByText("部院公文").length).toBeGreaterThan(0);
    expect(screen.getByText("官署首月")).toBeTruthy();
    expect(screen.getByText("馆阁讲章校订")).toBeTruthy();
    expect(screen.getByText("奏折朝议入口")).toBeTruthy();
    expect(screen.getByText(/官场后果：当前有1条奏议链路/)).toBeTruthy();
    expect(screen.getByText("考成压力：馆阁讲章校订")).toBeTruthy();
    expect(screen.getByText("领域后果")).toBeTruthy();
    expect(screen.getByText("清河县粮价余波")).toBeTruthy();
    expect(screen.getByText("经济线索与官署材料")).toBeTruthy();
    expect(screen.getByText("部院采买纸张议价")).toBeTruthy();
    expect(screen.getByText("人情债月账可入考成")).toBeTruthy();
    expect(screen.queryByText("砚台保养")).toBeNull();
    expect(screen.queryByText("污染委派解释")).toBeNull();
    expect(screen.getByText("首月回署：馆阁讲章校订")).toBeTruthy();
    expect(screen.getByText(/近次裁决：准入复核：馆阁讲章校订已入奏折队列主卷定夺/)).toBeTruthy();
    expect(screen.getByText(/朝议跟进：部院覆奏 · 部院待覆/)).toBeTruthy();
    expect(screen.getAllByText("翰林院").length).toBeGreaterThan(0);
    expect(screen.getByText("同年座师与人脉")).toBeTruthy();
    expect(screen.getByText("派系与朝局风险")).toBeTruthy();
    expect(screen.getByText("考成与弹劾")).toBeTruthy();
    expect(screen.getByRole("link", { name: "入朝议页" }).getAttribute("href")).toBe(`/game/${sessionId}/court`);
    expect(screen.getByRole("button", { name: "续记考成" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "部院覆奏" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "合入考成观察" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "续记跨域后果" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "不应显示孤证后果" })).toBeNull();
    expect(screen.getByText("不得在前端直接任免、奖惩、处分、弹劾成案或改写考成。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "回应弹劾" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "若有弹劾风声，先拟辨疏，说明事实、证据和请核事项，不自行成案。"
    });
    const receiptButtons = screen.getAllByRole("button", { name: "拟回堂官" });
    fireEvent.click(receiptButtons[receiptButtons.length - 1]);
    expect(useUiStateStore.getState().actionDraft?.text).toContain("馆阁讲章校订");
    fireEvent.click(screen.getByRole("button", { name: "入奏折队列" }));
    expect(useUiStateStore.getState().actionDraft?.text).toContain("讲章回署");
    fireEvent.click(screen.getByRole("button", { name: "部院覆奏" }));
    expect(useUiStateStore.getState().actionDraft?.text).toContain("相关部院");
    fireEvent.click(screen.getByRole("button", { name: "合入考成观察" }));
    expect(useUiStateStore.getState().actionDraft?.text).toContain("本任考成观察");
    fireEvent.click(screen.getByRole("button", { name: "续记跨域后果" }));
    expect(useUiStateStore.getState().actionDraft?.text).toContain("清河县粮价余波");
    const economyButtons = screen.getAllByRole("button", { name: "拟复核" });
    fireEvent.click(economyButtons[economyButtons.length - 1]);
    expect(useUiStateStore.getState().actionDraft?.text).toContain("案卷回批");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(0);
    expect(document.body.textContent || "").not.toMatch(/provider payload|hiddenDossier|sk-test-secret|prompt|raw audit|path=|C:\\|data\/sessions|OPENAI_API_KEY|stateDelta|playerDelta|evidenceRefs|outcomeId|auditRecord|cityPolicyLedger|rawSql/i);
  });

  it("renders the S76.5 general panel from safe military views as draft-only actions", async () => {
    const sessionId = "42345678-1111-4111-8111-111111111111";
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify({
          ...buildMockAssetManifest(0),
          assets: [
            {
              id: "ui-role-general-frontier-tent-v1",
              category: "role_background",
              usage: ["game_main"],
              role: "general",
              path: "/assets/ui/roles/role-general-frontier-tent-v1.webp",
              thumbnailPath: "/assets/ui/thumbs/thumb-role-general-frontier-tent-v1.webp",
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
          worldState: { player: { name: "赵都督", role: "general", officeTitle: "辽东总兵" } },
          militaryDiplomacyView: {
            schemaVersion: 1,
            dateLabel: "明1644年正月下旬",
            counts: { theaters: 1, garrisons: 1, supplyLines: 1, diplomaticContacts: 1, frontierIncidents: 1 },
            commandSummary: {
              officeTitle: "辽东总兵",
              theater: "山海关军帐",
              publicSummary: "边镇军务只读公开投影，战役与调兵仍由服务器裁决。"
            },
            supplySummary: {
              grainScore: 54,
              payScore: 47,
              routeSecurity: 42,
              moraleScore: 59,
              publicSummary: "粮道吃紧，军心尚稳。"
            },
            theaters: [{
              id: "theater-1",
              title: "山海关边防战区",
              statusLabel: "吃紧",
              threatScore: 78,
              publicSummary: "关外斥候见敌骑游弋，只作公开警讯。"
            }],
            garrisons: [{
              id: "garrison-1",
              title: "宁远驻军",
              statusLabel: "留察",
              readinessScore: 61,
              publicSummary: "兵额可守，器械待修。"
            }],
            supplyLines: [{
              id: "supply-1",
              title: "辽西粮道",
              statusLabel: "急报",
              supplyRisk: 70,
              publicSummary: "转运受阻，须核仓储。"
            }],
            diplomaticContacts: [{
              id: "envoy-1",
              title: "边外使节试探",
              statusLabel: "留察",
              diplomaticTension: 64,
              publicSummary: "互市与边议只作公开摘录。"
            }],
            frontierIncidents: [{
              id: "incident-1",
              kind: "scout",
              title: "关口斥候急报",
              statusLabel: "急报",
              threatScore: 82,
              publicSummary: "斥候回报敌骑近关，不判定隐藏军情。"
            }, {
              id: "bad-incident",
              title: "provider payload sk-test-secret",
              publicSummary: "path=C:\\secret\\war.json"
            }]
          },
          officialPostingsView: {
            postings: [{
              id: "posting-player-current",
              holderType: "player",
              officeTitle: "辽东总兵",
              cityName: "山海关",
              publicSummary: "统兵驻关。"
            }]
          },
          mapRuntimeView: {
            refs: [{ sourceRef: "frontier-1", label: "山海关", summary: "边镇节点" }],
            routes: [{ sourceRef: "route-1", label: "辽西粮道", summary: "军需路线" }],
            eventEffects: [{ targetRef: "frontier-1", label: "边患预警", kind: "border", severity: 72, summary: "公开舆图警势。" }]
          },
          eventArchiveView: {
            events: [{
              id: "archive-1",
              kind: "military_diplomacy",
              title: "山海关塘报",
              publicSummary: "旧战报可查，不作胜负事实。"
            }]
          },
          actorMemoryView: {
            recentUpdates: [{ id: "memory-1", title: "副将来报", summary: "请先核军心。" }]
          },
          domainConsequenceView: {
            active: true,
            summary: "当前有1条军务公开后果可追踪。",
            recentConsequences: [{
              id: "DC-military-supply-risk",
              sourceType: "military_diplomacy",
              sourceLabel: "军务外交",
              kindLabel: "军务后果",
              title: "辽西粮道受阻余波",
              statusLabel: "已记入后果追踪",
              publicSummary: "粮道受阻抬高军心风险，仍须普通回合核仓储与转运。",
              affectedMetricLabels: ["本部粮饷", "军心"],
              severity: 2,
              nextStep: "把辽西粮道受阻余波列入军务后果追踪，后续侦察、调粮、战险仍须普通回合裁决。"
            }],
            nextActions: [{
              id: "trace-DC-military-supply-risk",
              label: "续记军务后果",
              text: "把辽西粮道受阻余波列入军务后果追踪，后续侦察、调粮、战险仍须普通回合裁决。"
            }]
          }
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}`);

    await screen.findByRole("heading", { name: "将领军务" });
    expect(screen.getByText("军帐总览")).toBeTruthy();
    expect(screen.getByText("粮饷与军心")).toBeTruthy();
    expect(screen.getByText("斥候与情报")).toBeTruthy();
    expect(screen.getByText("边患与舆图")).toBeTruthy();
    expect(screen.getByText("战报与边议")).toBeTruthy();
    expect(screen.getByText("军务后果追踪")).toBeTruthy();
    expect(screen.getByText("辽西粮道受阻余波")).toBeTruthy();
    expect(screen.getByRole("link", { name: "入舆图页" }).getAttribute("href")).toBe(`/game/${sessionId}/map`);
    expect(screen.getByRole("link", { name: "查史册" }).getAttribute("href")).toBe(`/game/${sessionId}/archive`);
    expect(screen.getByText("战役胜负、调兵遣将、外交和战、统帅任免、粮饷拨付与赏罚都须候案卷回批。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "遣出斥候" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "遣斥候分赴关隘、驿路与敌营外缘，回报公开线索，不自行判定隐藏军情。"
    });
    fireEvent.click(screen.getByRole("button", { name: "续记军务后果" }));
    expect(useUiStateStore.getState().actionDraft?.text).toContain("辽西粮道受阻余波");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(0);
    expect(document.body.textContent || "").not.toMatch(/provider payload|sk-test-secret|prompt|raw audit|path=|C:\\|data\/sessions|OPENAI_API_KEY|stateDelta|playerDelta|evidenceRefs|outcomeId|auditRecord|militaryDiplomacyLedger|rawSql/i);
    expect(document.body.textContent || "").not.toMatch(/投影|安全地图运行时|后端裁决|resolver|safe view|\bserver\b|provider|model/i);
  });

  it("renders the S76.6 emperor panel from safe court views as draft-only edicts", async () => {
    const sessionId = "52345678-1111-4111-8111-111111111111";
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify({
          ...buildMockAssetManifest(0),
          assets: [
            {
              id: "ui-role-emperor-imperial-desk-v1",
              category: "role_background",
              usage: ["game_main"],
              role: "emperor",
              path: "/assets/ui/roles/role-emperor-imperial-desk-v1.webp",
              thumbnailPath: "/assets/ui/thumbs/thumb-role-emperor-imperial-desk-v1.webp",
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
          worldState: { player: { name: "赵御案", role: "emperor", officeTitle: "御案临朝" } },
          officialPostingsView: {
            dateLabel: "明1644年正月下旬",
            courtSummary: {
              officeTitle: "御案临朝",
              publicSummary: "朝廷案牍只读公开投影，拟旨和朱批仍候服务器裁决。"
            },
            appointmentCandidates: [{
              id: "candidate-1",
              title: "吏部侍郎候补",
              statusLabel: "待议",
              publicSummary: "资历可查，任免未定。"
            }, {
              id: "bad-candidate",
              title: "provider payload sk-test-secret",
              publicSummary: "path=C:\\secret\\office.json"
            }]
          },
          eventArchiveView: {
            dateLabel: "明1644年正月下旬",
            counts: { memorials: 2, fiscalScore: 57, militaryScore: 63, personnelScore: 48, localScore: 52 },
            memorials: [{
              id: "memorial-1",
              kind: "memorial",
              title: "户部钱粮奏折",
              statusLabel: "急奏",
              publicSummary: "钱粮吃紧，请求朝议。"
            }, {
              id: "bad-memorial",
              title: "raw audit OPENAI_API_KEY",
              publicSummary: "data/sessions/secret"
            }],
            events: [{
              id: "reward-1",
              kind: "reward",
              title: "边镇功过待核",
              publicSummary: "赏罚须待证据。"
            }]
          },
          actorMemoryView: {
            actors: [{ id: "actor-1", title: "内阁首辅", statusLabel: "候旨", publicSummary: "请先集议。" }]
          },
          aiControlAuditView: {
            publicPanel: {
              publicResults: [{ id: "audit-1", title: "处分复核", publicSummary: "仅为公开审计摘要。" }]
            }
          },
          worldThreadView: {
            threads: [{ id: "thread-1", title: "朝议钱粮", followUp: "待内阁具奏。" }]
          },
          courtConsequenceView: {
            active: true,
            summary: "当前有1条奏议链路可转为长期官场后果信号，近次信号1条；所有信号只入考成观察、月报和世界议程。",
            pendingSources: [{
              id: "court-consequence-source-1",
              title: "部院覆奏：河工清册",
              statusLabel: "部院待覆",
              publicSummary: "河工清册可入考成观察和风宪风险复核。"
            }],
            recentSignals: [{
              id: "OCC-emperor-fixture",
              title: "风宪观察：河工清册",
              statusLabel: "列风宪观察",
              publicSummary: "河工清册转为官场后果信号，只作公开观察。"
            }],
            nextActions: [{
              id: "monthly-trace",
              label: "月报摘录",
              text: "把河工清册摘入官职月报和世界议程，后续仍候服务器裁决。"
            }]
          },
          courtResponseView: {
            active: true,
            role: "emperor",
            responseRole: "emperor",
            responseRoleLabel: "御前",
            summary: "当前有1条奏议材料可作跨身份回应；所有回应只入服务器安全账本。",
            responseItems: [{
              id: "court-response-item-1",
              title: "部院覆奏：河工清册",
              statusLabel: "部院待覆",
              publicSummary: "河工清册承接近次准入复核，部院、台谏只形成公开中间意见。",
              draftText: "朱批部院覆奏：河工清册，只令部院据公开凭据覆奏，仍候服务器裁决。"
            }],
            nextActions: [{
              id: "vermilion-note",
              label: "朱批留览",
              text: "朱批留览部院覆奏：河工清册，令部院据公开凭据覆奏，此稿只候服务器裁决。"
            }]
          },
          domainConsequenceView: {
            active: true,
            summary: "当前有2条天下公开余波可追踪。",
            recentConsequences: [
              {
                id: "DC-emperor-military-border",
                sourceType: "military_diplomacy",
                sourceLabel: "军务外交",
                kindLabel: "军务后果",
                title: "山海关边警余波",
                statusLabel: "已记入后果追踪",
                publicSummary: "边警余波已入世界议程，后续侦察、调粮和战险仍候服务器裁决。",
                affectedMetricLabels: ["边患", "军心"],
                severity: 2,
                nextStep: "御览山海关边警余波，令兵部只列公开凭据、粮道缺口和待裁事项。"
              },
              {
                id: "bad-emperor-domain",
                sourceType: "judicial_case",
                title: "outcomeId stateDelta",
                publicSummary: "judicialCaseLedger evidenceRefs rawSql"
              }
            ],
            nextActions: [
              {
                id: "trace-DC-emperor-military-border",
                label: "御览天下余波",
                text: "御览山海关边警余波，令兵部只列公开凭据、粮道缺口和待裁事项。"
              },
              {
                id: "trace-bad-emperor-domain",
                label: "不应显示污染后果",
                text: "另查一条无可见条目绑定的安全文字。"
              }
            ]
          },
          worldEntityView: {
            entities: [{ id: "entity-1", kind: "personnel", title: "吏部铨选", publicSummary: "缺额待核。" }]
          },
          mapRuntimeView: {
            eventEffects: [{ id: "map-1", label: "边防警势", severity: 64, summary: "只作舆图公开警讯。" }]
          }
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}`);

    await screen.findByRole("heading", { name: "御案朝仪" });
    expect(screen.getByText("奏折队列")).toBeTruthy();
    expect(screen.getByText("奏议回应")).toBeTruthy();
    expect(screen.getAllByText("部院覆奏：河工清册").length).toBeGreaterThan(0);
    expect(screen.getByText(/官场后果：当前有1条奏议链路/)).toBeTruthy();
    expect(screen.getByText("风宪观察：河工清册")).toBeTruthy();
    expect(screen.getByText("天下余波")).toBeTruthy();
    expect(screen.getByText("山海关边警余波")).toBeTruthy();
    expect(screen.getByText("朱批拟稿")).toBeTruthy();
    expect(screen.getAllByText("圣旨草稿").length).toBeGreaterThan(0);
    expect(screen.getAllByText("朝议").length).toBeGreaterThan(0);
    expect(screen.getByText("任免候选")).toBeTruthy();
    expect(screen.getByText("赏罚预留")).toBeTruthy();
    expect(screen.getByRole("link", { name: "入朝议页" }).getAttribute("href")).toBe(`/game/${sessionId}/court`);
    expect(screen.getByRole("link", { name: "查史册" }).getAttribute("href")).toBe(`/game/${sessionId}/archive`);
    expect(screen.queryByRole("button", { name: "不应显示污染后果" })).toBeNull();
    expect(screen.getByText("任免、赏罚、处分、朱批成案、圣旨生效和时间推进都须候案卷回批。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "拟旨" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "草拟一道明发谕旨，请内阁先核证据、适用官制与可行后果；此稿未生效。"
    });
    fireEvent.click(screen.getByRole("button", { name: "朱批留览" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "朱批留览部院覆奏：河工清册，令部院据公开凭据覆奏，此稿只候主卷定夺。"
    });
    fireEvent.click(screen.getByRole("button", { name: "月报摘录" }));
    expect(useUiStateStore.getState().actionDraft?.text).toContain("官职月报");
    fireEvent.click(screen.getByRole("button", { name: "御览天下余波" }));
    expect(useUiStateStore.getState().actionDraft?.text).toContain("山海关边警余波");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(0);
    expect(document.body.textContent || "").not.toMatch(/provider payload|sk-test-secret|prompt|raw audit|path=|C:\\|data\/sessions|OPENAI_API_KEY|stateDelta|playerDelta|evidenceRefs|outcomeId|auditRecord|judicialCaseLedger|rawSql/i);
    expect(document.body.textContent || "").not.toMatch(/投影|后端裁决|resolver|safe view|\bserver\b|provider|model/i);
  });

  it("tracks route-derived UI page state and closes safe drawers with Esc while restoring focus", async () => {
    renderRoute("/game/smoke-session/map");

    await waitFor(() => expect(useUiStateStore.getState().currentPage).toBe("map"));
    expect(useUiStateStore.getState().currentSessionId).toBe("smoke-session");
    expect(document.querySelector("[data-polish-controls='s89-16-shell-controls']")).toBeTruthy();

    const trigger = screen.getByRole("button", { name: "打开印匣" });
    expect(trigger.getAttribute("data-polish-controls")).toBe("s89-16-inkbox-button");
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("complementary", { name: "印匣" })).toBeTruthy();
    expect(useUiStateStore.getState().activeDrawer).toBe("settings");
    expect(screen.getByRole("button", { name: "关闭抽屉" })).toBe(document.activeElement);
    expect(document.querySelector("[data-polish-settings='s89-13-inkbox-overview']")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "显示" }));
    expect(document.querySelector("[data-polish-settings='s89-13-display-panel']")).toBeTruthy();
    expect(document.querySelector(".displayPreferenceLedger")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("动效"), { target: { value: "reduced" } });
    fireEvent.change(screen.getByLabelText("正文字体"), { target: { value: "brush-mashan" } });
    expect(screen.getAllByText("静读").length).toBeGreaterThan(0);
    expect(screen.getAllByText("榜书墨笔").length).toBeGreaterThan(0);
    expect(document.querySelector(".appShell")?.getAttribute("data-motion")).toBe("reduced");
    expect(document.querySelector(".appShell")?.getAttribute("data-body-font")).toBe("brush-mashan");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(useUiStateStore.getState().activeDrawer).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("opens the S75.4 inkbox tabs without exposing unsafe settings details", async () => {
    const sessionId = "55555555-5555-4555-8555-555555555555";
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/ai/settings/global") {
        return new Response(JSON.stringify({
          scope: "global",
          updatedAt: "2026-05-19T12:00:00.000Z",
          aiSettingsView: {
            preset: "balanced",
            presets: [
              { id: "balanced", label: "均衡" },
              { id: "quality_first", label: "审慎" },
              { id: "fast", label: "迅捷" }
            ],
            providerOptions: [
              { provider: "mock", available: true, requiresKey: false },
              { provider: "openai", available: false, requiresKey: true }
            ],
            taskRoutes: [
              {
                taskType: "narrator",
                label: "叙事",
                purpose: "普通叙事、玩家自由行动和流式文本。",
                provider: "mock",
                providerAvailable: true,
                requiresKey: false,
                effectiveStatus: "active",
                model: "mock",
                maxOutputTokens: 900,
                toolBudget: 1,
                temperature: 0.35,
                reviewerOnly: false,
                mayUseTools: true,
                mayRequestAdjudication: false
              },
              {
                taskType: "quick_action",
                label: "快捷建议",
                purpose: "生成快捷行动草稿建议。",
                provider: "mock",
                providerAvailable: true,
                requiresKey: false,
                effectiveStatus: "no_tool",
                model: "mock",
                maxOutputTokens: 700,
                toolBudget: 0,
                temperature: 0.2,
                reviewerOnly: false,
                mayUseTools: false,
                mayRequestAdjudication: false
              }
            ]
          },
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
        worldState: { player: { name: "顾衡", role: "official" } },
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
    expect(screen.getByRole("tab", { name: "推演" }).getAttribute("aria-selected")).toBe("true");
    await screen.findByText(/已保存/);
    expect(screen.getByText("叙事")).toBeTruthy();
    expect(screen.getByText("快捷建议")).toBeTruthy();
    expect(screen.queryByDisplayValue("deep")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "旧案" }));
    expect((await screen.findAllByText("顾衡")).length).toBeGreaterThan(0);
    expect(screen.getByText("案 55555555")).toBeTruthy();
    expect(screen.getByText("明1600年5月中旬")).toBeTruthy();
    expect(screen.getByText("第 7 回合")).toBeTruthy();
    expect(screen.getByText("贡院春寒，案上仍有未竟策问。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "刷新" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "摘要" }));
    expect(document.querySelector("[data-polish-settings='s89-13-safe-summary']")).toBeTruthy();
    expect(screen.getAllByText(/公开卷宗|案卷摘要/).length).toBeGreaterThan(0);
    const safeSummaryPanel = document.querySelector("[data-polish-settings='s89-13-safe-summary']");
    expect(safeSummaryPanel?.textContent || "").toContain("入仕官员");
    expect(safeSummaryPanel?.textContent || "").not.toMatch(/\bofficial\b/);
    expect(screen.getByText("主卷载入")).toBeTruthy();
    expect(screen.getByText("已载材料")).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|base URL|raw prompt|raw audit|provider payload|data\/sessions|player-state|exam-submit/i);

    fireEvent.click(screen.getByRole("tab", { name: "旧案" }));
    fireEvent.click(screen.getByRole("button", { name: "载入" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/game/player-state/${sessionId}`, expect.anything()));
    await waitFor(() => expect(useGameSessionStore.getState().currentSessionId).toBe(sessionId));
  });

  it("refreshes the S75.4 old-case list once when the current route session is missing", async () => {
    const sessionId = "3c09daca-3333-4aca-8aca-3c09daca3333";
    let saveListCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/ai/settings/global") {
        return new Response(JSON.stringify({
          scope: "global",
          updatedAt: "2026-05-22T12:00:00.000Z",
          aiSettingsView: {
            preset: "balanced",
            presets: [{ id: "balanced", label: "均衡" }],
            providerOptions: [{ provider: "mock", available: true, requiresKey: false }],
            taskRoutes: []
          },
          aiInvocationSummaryView: { safe: true }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/game/saves") {
        saveListCalls += 1;
        const saves = saveListCalls === 1
          ? [{
              sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              playerName: "旧卷甲",
              role: "scholar",
              dynasty: "明",
              year: 1600,
              month: 1,
              tenDayPeriod: 1,
              turnCount: 2,
              summary: "旧案仍在架上。",
              updatedAt: "2026-05-21T10:00:00.000Z"
            }]
          : [{
              sessionId,
              playerName: "当前案主",
              role: "official",
              dynasty: "明",
              year: 1601,
              month: 2,
              tenDayPeriod: 2,
              turnCount: 9,
              summary: "当前案卷已写入本地存档。",
              updatedAt: "2026-05-22T10:00:00.000Z"
            }];
        return new Response(JSON.stringify({ saves, skipped: [] }), {
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId,
          worldState: { player: { name: "当前案主", role: "official" } },
          aiSettingsView: { preset: "balanced" },
          aiControlAuditView: { summary: "bounded" }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}`);

    await waitFor(() => expect(useUiStateStore.getState().currentSessionId).toBe(sessionId));
    fireEvent.click(screen.getByRole("button", { name: "打开印匣" }));
    await screen.findByText("矩阵未载");
    expect(screen.getAllByText("暂无推演分工；本页不会自行补造叙事来源或复核权限。").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "旧案" }));

    expect((await screen.findAllByText("当前案主")).length).toBeGreaterThan(0);
    expect(screen.getByText("案 3c09daca")).toBeTruthy();
    expect(screen.getByText("当前案卷已写入本地存档。")).toBeTruthy();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/saves")).toHaveLength(2));
  });

  it("renders S80 global AI matrix and saves dirty task route changes", async () => {
    const sessionId = "56565656-5656-4565-8565-565656565656";
    const aiPayload = (tokens: number, preset = "balanced") => ({
      sessionId: "global",
      scope: "global",
      updatedAt: "2026-05-19T12:00:00.000Z",
      aiSettingsView: {
        preset,
        presets: [
          { id: "balanced", label: "均衡" },
          { id: "fast", label: "迅捷" },
          { id: "long_context", label: "长卷" }
        ],
        providerOptions: [
          { provider: "mock", available: true, requiresKey: false },
          { provider: "openai", available: false, requiresKey: true }
        ],
        taskRoutes: [
          {
            taskType: "narrator",
            label: "叙事",
            purpose: "普通叙事。",
            provider: "mock",
            providerAvailable: true,
            requiresKey: false,
            effectiveStatus: "active",
            model: "mock",
            maxOutputTokens: tokens,
            toolBudget: 1,
            temperature: 0.35,
            reviewerOnly: false,
            mayUseTools: true,
            mayRequestAdjudication: false
          }
        ]
      },
      aiInvocationSummaryView: { safe: true }
    });
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/ai/settings/global" && options?.method === "POST") {
        expect(JSON.parse(String(options.body))).toMatchObject({
          settings: {
            taskRoutes: {
              narrator: {
                maxOutputTokens: 1200,
                provider: "mock"
              }
            }
          }
        });
        return new Response(JSON.stringify(aiPayload(1200, "fast")), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/ai/settings/global") {
        return new Response(JSON.stringify(aiPayload(900)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({
        source: "server_player_visible_state_projection",
        sessionId,
        worldState: { player: { name: "许慎", role: "scholar" } }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/settings`);

    expect(await screen.findByRole("article", { name: "案头工具" })).toBeTruthy();
    expect(screen.queryByDisplayValue("900")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "打开推演设置" }));
    await screen.findByDisplayValue("900");
    expect(screen.getByRole("button", { name: /保存全局设置/ })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByDisplayValue("900"), { target: { value: "1200" } });
    expect(screen.getByText("未保存")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("推演预设"), { target: { value: "fast" } });
    fireEvent.click(screen.getByRole("button", { name: /保存全局设置/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/ai/settings/global", expect.objectContaining({ method: "POST" })));
    await screen.findByDisplayValue("1200");
    expect(screen.getByText(/已保存/)).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|raw prompt|data\/sessions|base URL/i);
  });

  it("keeps dirty global AI settings edits when a stale reload finishes later", async () => {
    const sessionId = "78787878-7878-4787-8787-787878787878";
    const aiPayload = (tokens: number, preset = "balanced") => ({
      sessionId: "global",
      scope: "global",
      updatedAt: "2026-05-22T12:00:00.000Z",
      aiSettingsView: {
        preset,
        presets: [
          { id: "balanced", label: "均衡" },
          { id: "fast", label: "迅捷" }
        ],
        providerOptions: [{ provider: "mock", available: true, requiresKey: false }],
        taskRoutes: [
          {
            taskType: "narrator",
            label: "叙事",
            purpose: "普通叙事。",
            provider: "mock",
            providerAvailable: true,
            requiresKey: false,
            effectiveStatus: "active",
            model: "mock",
            maxOutputTokens: tokens,
            toolBudget: 1,
            temperature: 0.35,
            reviewerOnly: false,
            mayUseTools: true,
            mayRequestAdjudication: false
          }
        ]
      },
      aiInvocationSummaryView: { safe: true }
    });
    const reload = deferredResponse<ReturnType<typeof aiPayload>>();
    let settingsCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/settings/global") {
        settingsCalls += 1;
        if (settingsCalls === 1) {
          return Promise.resolve(new Response(JSON.stringify(aiPayload(900)), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }));
        }
        return reload.response;
      }
      return Promise.resolve(new Response(JSON.stringify({
        source: "server_player_visible_state_projection",
        sessionId,
        worldState: { player: { name: "许慎", role: "scholar" } }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/settings`);

    fireEvent.click(await screen.findByRole("button", { name: "打开推演设置" }));
    await screen.findByDisplayValue("900");
    fireEvent.click(screen.getByRole("button", { name: /重新载入/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /载入中/ })).toBeTruthy());
    fireEvent.change(screen.getByDisplayValue("900"), { target: { value: "1300" } });
    expect(screen.getByText("未保存")).toBeTruthy();

    reload.resolvePayload(aiPayload(700, "fast"));

    await screen.findByText(/未保存编辑已保留/);
    expect(screen.getByDisplayValue("1300")).toBeTruthy();
    expect(screen.queryByDisplayValue("700")).toBeNull();
    expect(screen.getByRole("button", { name: /保存全局设置/ })).toHaveProperty("disabled", false);
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|raw prompt|data\/sessions|base URL/i);
  });

  it("keeps the settings route as a directory into one inkbox tool surface", async () => {
    const sessionId = "89898989-8989-4898-8989-898989898989";
    const aiPayload = (tokens: number) => ({
      sessionId: "global",
      scope: "global",
      updatedAt: "2026-05-22T12:00:00.000Z",
      aiSettingsView: {
        preset: "balanced",
        presets: [
          { id: "balanced", label: "均衡" },
          { id: "fast", label: "迅捷" }
        ],
        providerOptions: [{ provider: "mock", available: true, requiresKey: false }],
        taskRoutes: [
          {
            taskType: "narrator",
            label: "叙事",
            purpose: "普通叙事。",
            provider: "mock",
            providerAvailable: true,
            requiresKey: false,
            effectiveStatus: "active",
            model: "mock",
            maxOutputTokens: tokens,
            toolBudget: 1,
            temperature: 0.35,
            reviewerOnly: false,
            mayUseTools: true,
            mayRequestAdjudication: false
          }
        ]
      },
      aiInvocationSummaryView: { safe: true }
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/settings/global") {
        return Promise.resolve(new Response(JSON.stringify(aiPayload(900)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        source: "server_player_visible_state_projection",
        sessionId,
        worldState: {}
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/settings`);

    const routePanel = await screen.findByRole("article", { name: "案头工具" });
    expect(routePanel.getAttribute("data-polish-settings")).toBe("s89-13-settings-directory");
    expect(routePanel.querySelector("[data-polish-settings-state='s89-19-settings-directory-state']")).toBeTruthy();
    expect(within(routePanel).getByText("推演设置")).toBeTruthy();
    expect(within(routePanel).getByText("显示偏好")).toBeTruthy();
    expect(within(routePanel).getByText("旧案卷")).toBeTruthy();
    expect(within(routePanel).getByText("案卷摘要")).toBeTruthy();
    expect(within(routePanel).getByText("全局生效")).toBeTruthy();
    expect(within(routePanel).getByText("低动效可用")).toBeTruthy();
    expect(within(routePanel).getByText("不载私记")).toBeTruthy();
    expect(within(routePanel).getByText("只改推演分工；叙事、工具与复核仍由主卷回批。")).toBeTruthy();
    expect(within(routePanel).getByText("异常旧卷只示暂不可读，不回显底层错因。")).toBeTruthy();
    expect(within(routePanel).getByText("案卷未载的身份、关系、授官或后果不在此补造。")).toBeTruthy();
    expect(screen.queryByDisplayValue("900")).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/ai/settings/global")).toHaveLength(0);
    await waitFor(() => expect(useUiStateStore.getState().currentPlayerPayload?.sessionId).toBe(sessionId));
    expect(useUiStateStore.getState().currentPlayerPayload?.player).toBeNull();

    fireEvent.click(within(routePanel).getByRole("button", { name: "查看案卷摘要" }));
    expect(screen.getByRole("complementary", { name: "印匣" })).toBeTruthy();
    await waitFor(() => expect(document.querySelector("[data-polish-settings='s89-13-safe-summary']")).toBeTruthy());
    const safeSummaryPanel = document.querySelector("[data-polish-settings='s89-13-safe-summary']");
    expect(safeSummaryPanel?.textContent || "").toContain("未题名");
    expect(safeSummaryPanel?.textContent || "").toContain("身份未题");
    expect(safeSummaryPanel?.textContent || "").toContain("主卷载入");
    expect(document.body.textContent || "").not.toMatch(/player-state|exam-submit|provider payload|raw audit|data\/sessions/i);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(useUiStateStore.getState().activeDrawer).toBeNull());

    fireEvent.click(within(routePanel).getByRole("button", { name: "打开显示偏好" }));
    expect(screen.getByRole("complementary", { name: "印匣" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "显示", selected: true })).toBeTruthy();
    expect(screen.getByLabelText("动效")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(useUiStateStore.getState().activeDrawer).toBeNull());

    fireEvent.click(within(routePanel).getByRole("button", { name: "打开推演设置" }));
    await screen.findByDisplayValue("900");
    expect(document.querySelector("[data-polish-ai-settings='s89-19-ai-state-ledger']")).toBeTruthy();
    expect(document.querySelector("[data-polish-ai-settings-ledger='s89-19-ai-state-ledger']")).toBeTruthy();
    expect(screen.getByText("1 类推演分工已载入。")).toBeTruthy();
    expect(screen.getByText("保存只改全局推演偏好；案卷事实仍候主卷回批。")).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/ai/settings/global")).toHaveLength(1);
    expect(document.querySelectorAll(".aiSettingsPanel")).toHaveLength(1);
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|raw prompt|data\/sessions|base URL/i);
  });

  it("cleans polluted S89.19 AI settings labels before rendering the matrix", async () => {
    const sessionId = "91919191-9191-4919-8919-919191919191";
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/settings/global") {
        return Promise.resolve(new Response(JSON.stringify({
          sessionId: "global",
          scope: "global",
          updatedAt: "2026-05-25T12:00:00.000Z",
          aiSettingsView: {
            preset: "balanced",
            presets: [{ id: "balanced", label: "OPENAI_API_KEY provider payload" }],
            providerOptions: [{ provider: "mock", available: true, requiresKey: false }],
            taskRoutes: [
              {
                taskType: "narrator",
                label: "provider payload OPENAI_API_KEY",
                purpose: "draftContext schema manifest /home/dev/data/sessions/raw prompt",
                provider: "mock",
                providerAvailable: true,
                requiresKey: false,
                effectiveStatus: "statePatch",
                model: "C:\\data\\sessions\\secret",
                maxOutputTokens: 900,
                toolBudget: 1,
                temperature: 0.35,
                reviewerOnly: false,
                mayUseTools: true,
                mayRequestAdjudication: false
              }
            ]
          },
          aiInvocationSummaryView: { safe: true }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        source: "server_player_visible_state_projection",
        sessionId,
        worldState: { player: { name: "许慎", role: "scholar" } }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/settings`);

    const routePanel = await screen.findByRole("article", { name: "案头工具" });
    fireEvent.click(within(routePanel).getByRole("button", { name: "打开推演设置" }));

    await screen.findByText("叙事");
    expect(screen.getByText("按案卷分工推演。")).toBeTruthy();
    expect(screen.getByDisplayValue("mock")).toBeTruthy();
    expect(screen.getByText("生效")).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|provider payload|raw prompt|draftContext|schema|manifest|data\/sessions|C:\\data|\/home\/dev/i);
  });

  it("does not write polluted S89.19 AI preset ids back on save", async () => {
    const sessionId = "92929292-9292-4929-8929-929292929292";
    const aiPayload = (tokens: number, preset = "OPENAI_API_KEY provider payload data/sessions") => ({
      sessionId: "global",
      scope: "global",
      updatedAt: "2026-05-25T12:00:00.000Z",
      aiSettingsView: {
        preset,
        presets: [
          { id: "balanced", label: "均衡" },
          { id: "fast", label: "迅捷" }
        ],
        providerOptions: [{ provider: "mock", available: true, requiresKey: false }],
        taskRoutes: [
          {
            taskType: "narrator",
            label: "叙事",
            purpose: "普通叙事。",
            provider: "mock",
            providerAvailable: true,
            requiresKey: false,
            effectiveStatus: "active",
            model: "mock",
            maxOutputTokens: tokens,
            toolBudget: 1,
            temperature: 0.35,
            reviewerOnly: false,
            mayUseTools: true,
            mayRequestAdjudication: false
          }
        ]
      },
      aiInvocationSummaryView: { safe: true }
    });
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === "/api/ai/settings/global" && options?.method === "POST") {
        const body = JSON.parse(String(options.body));
        expect(body).toMatchObject({
          settings: {
            preset: "balanced",
            taskRoutes: {
              narrator: {
                maxOutputTokens: 1000
              }
            }
          }
        });
        expect(String(options.body)).not.toMatch(/OPENAI_API_KEY|provider payload|data\/sessions/i);
        return Promise.resolve(new Response(JSON.stringify(aiPayload(1000, "balanced")), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
      if (url === "/api/ai/settings/global") {
        return Promise.resolve(new Response(JSON.stringify(aiPayload(900)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        source: "server_player_visible_state_projection",
        sessionId,
        worldState: { player: { name: "许慎", role: "scholar" } }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/settings`);

    const routePanel = await screen.findByRole("article", { name: "案头工具" });
    fireEvent.click(within(routePanel).getByRole("button", { name: "打开推演设置" }));
    await screen.findByDisplayValue("900");
    expect(screen.getByLabelText("推演预设")).toHaveProperty("value", "balanced");
    fireEvent.change(screen.getByDisplayValue("900"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: /保存全局设置/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/ai/settings/global", expect.objectContaining({ method: "POST" })));
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|provider payload|data\/sessions/i);
  });

  it("keeps S89.19 AI settings errors redacted and player-facing", async () => {
    const sessionId = "90909090-9090-4909-8909-909090909090";
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/settings/global") {
        return Promise.resolve(new Response(JSON.stringify({
          error: "provider payload leaked OPENAI_API_KEY at data/sessions/demo.json with raw prompt"
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        source: "server_player_visible_state_projection",
        sessionId,
        worldState: { player: { name: "许慎", role: "scholar" } }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/settings`);

    const routePanel = await screen.findByRole("article", { name: "案头工具" });
    fireEvent.click(within(routePanel).getByRole("button", { name: "打开推演设置" }));

    await screen.findByText("推演设置暂不可用；请稍后重试。");
    expect(document.querySelector("[data-polish-ai-settings='s89-19-ai-state-ledger']")).toBeTruthy();
    expect(document.querySelector("[data-polish-ai-settings-ledger='s89-19-ai-state-ledger']")).toBeTruthy();
    expect(screen.getAllByText("推演分工暂不可用；本页不会自行补造叙事来源或复核权限。").length).toBeGreaterThan(0);
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|provider payload|raw prompt|data\/sessions|demo\.json/i);
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

  it("keeps S89.4 home save shelf loading and empty states mutually exclusive", async () => {
    const savesRequest = deferredResponse<{ saves: unknown[]; skipped: unknown[] }>();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/game/saves") return savesRequest.response;
      throw new Error(`unexpected url: ${url}`);
    }));

    renderRoute("/");

    await waitFor(() => expect(screen.getByText("正在翻检旧案架。")).toBeTruthy());
    expect(screen.queryByText("暂无可读旧卷")).toBeNull();
    expect(document.querySelector(".saveCaseSkeletonList")).toBeTruthy();

    savesRequest.resolvePayload({ saves: [], skipped: [] });
    await screen.findByText("案架暂空，新卷保存后会在此列出。");
    expect(screen.getByText("暂无可读旧卷")).toBeTruthy();
    expect(screen.queryByText("正在翻检旧案架。")).toBeNull();
  });

  it("keeps S89.4 home save errors inside the save shelf with safe retry copy", async () => {
    let saveRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/game/saves") {
        saveRequests += 1;
        if (saveRequests === 1) {
          throw new Error("raw audit /mnt/e/LSMNQ/data/sessions/secret.json OPENAI_API_KEY");
        }
        return new Response(JSON.stringify({ saves: [], skipped: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }));

    renderRoute("/");

    await screen.findByText("旧案架暂不可取，新开案卷不受影响。");
    expect(screen.getByRole("button", { name: "新开一卷" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "重整朱印" })).toBeNull();
    expect(screen.getByRole("button", { name: "重翻旧案" })).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/raw audit|OPENAI_API_KEY|data\/sessions|\/mnt\/e|secret\.json/i);

    fireEvent.click(screen.getByRole("button", { name: "重翻旧案" }));
    await screen.findByText("案架暂空，新卷保存后会在此列出。");
    expect(saveRequests).toBe(2);
  });

  it("keeps S89.4 save retry failures from replacing an existing start error", async () => {
    let saveRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/game/saves") {
        saveRequests += 1;
        throw new Error(`raw audit /mnt/e/LSMNQ/data/sessions/save-${saveRequests}.json OPENAI_API_KEY`);
      }
      if (url === "/api/game/start") {
        return new Response(JSON.stringify({ error: "案主名册暂未合拢。" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }));

    renderRoute("/");

    await screen.findByText("旧案架暂不可取，新开案卷不受影响。");
    fireEvent.click(screen.getByRole("button", { name: "新开一卷" }));

    await screen.findByText("案主名册暂未合拢。");
    expect(screen.getByRole("button", { name: "重整朱印" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重翻旧案" }));

    await waitFor(() => expect(saveRequests).toBe(2));
    expect(screen.getByText("案主名册暂未合拢。")).toBeTruthy();
    expect(screen.getByText("旧案架暂不可取，新开案卷不受影响。")).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/raw audit|OPENAI_API_KEY|data\/sessions|\/mnt\/e|save-\d+\.json/i);
  });

  it("drops polluted S75.5 save metadata before rendering", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/game/saves") {
        return new Response(JSON.stringify({
          saves: [
            {
              sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              playerName: "S74 smoke 验收官 data/sessions/secret.json",
              roleLabel: "raw audit placeholder debug",
              summary: "provider payload sk-test-secret 开发注释 fallback token"
            },
            {
              sessionId: "/api/game/state/data/sessions/secret",
              playerName: "案号污染",
              roleLabel: "书生",
              summary: "案号异常时不应生成读档链接。"
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
    expect(screen.getByText("案 unknown")).toBeTruthy();
    expect(screen.getByRole("button", { name: "暂不可读" })).toBeTruthy();
    const saveLinks = [...document.querySelectorAll("a")].map((link) => link.getAttribute("href") || "");
    expect(saveLinks.join("\n")).not.toMatch(/\/api\/game\/state|data\/sessions|secret/i);
    expect(document.body.textContent || "").not.toMatch(/data\/sessions|raw audit|provider payload|sk-test-secret|S74|验收|placeholder|debug|开发注释|fallback token/i);
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
          examRank: "prompt: leaked debug placeholder",
          officeTitle: "path=C:\\secret\\case.json S75 验收 实现说明"
        }
      }
    }, "player-state");

    renderRoute("/");

    expect(await screen.findByRole("link", { name: "继续本局" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "无名" })).toBeTruthy();
    expect(screen.getByText("身份未题")).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/provider|prompt|hidden|key|path=|C:\\|data\/sessions|raw audit|OPENAI_API_KEY|debug|placeholder|验收|实现说明/i);
  });

  it("opens registry-backed local surfaces, writes safe drafts, and restores focus on Esc", async () => {
    renderRoute("/game/smoke-session/court");

    expect(screen.getByRole("heading", { name: "朝议与官署" })).toBeTruthy();
    expect(document.querySelector(".sessionRouteShell")).toBeTruthy();
    expect(document.querySelector(".gameCommandBar")).toBeFalsy();
    expect(document.querySelector(".gameMainDeck")).toBeFalsy();
    expect(document.querySelector(".memorialComposer")).toBeFalsy();
    expect(document.querySelector("[data-polish-court='s89-17-court-directory']")).toBeTruthy();
    expect(document.querySelectorAll("[data-court-surface]")).toHaveLength(6);
    expect(document.body.textContent || "").toContain("官署案头索引");
    expect(screen.getAllByText("卷宗取材")).toHaveLength(6);
    expect(screen.getAllByText("可拟草稿")).toHaveLength(12);
    expect(screen.getAllByText("案卷未载")).toHaveLength(6);
    expect(screen.getAllByText("候复边界")).toHaveLength(6);
    for (const label of ["奏折队列", "拟圣旨", "朝议", "堂审", "军议", "人物档案"]) {
      expect(screen.getAllByRole("button", { name: label })).toHaveLength(1);
    }
    expect(document.body.textContent || "").not.toMatch(/数据来源|裁决边界|服务器裁决|draftContext|schema|manifest|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|完整提示词|本地路径|密钥/i);

    const trigger = screen.getByRole("button", { name: "拟圣旨" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "拟圣旨" });
    expect(dialog.textContent || "").toContain("卷宗取材");
    expect(dialog.textContent || "").toContain("案卷状态");
    expect(dialog.textContent || "").toContain("候案卷回批");
    expect(dialog.textContent || "").not.toMatch(/数据来源|裁决边界|服务器裁决|draftContext|schema|manifest/i);
    expect(dialog.textContent || "").not.toMatch(/raw audit|provider payload|hiddenNotes|data\/sessions|OPENAI_API_KEY/i);
    const closeSurfaceButton = screen.getByRole("button", { name: "关闭专题" });
    const writeDraftButton = screen.getByRole("button", { name: "写入奏折草稿" });
    expect(closeSurfaceButton).toBe(document.activeElement);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(writeDraftButton).toBe(document.activeElement);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeSurfaceButton).toBe(document.activeElement);

    fireEvent.click(writeDraftButton);
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game"
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "拟圣旨" })).toBeNull());
    expect(document.activeElement).toBe(trigger);

    const trialTrigger = screen.getByRole("button", { name: "堂审" });
    fireEvent.click(trialTrigger);
    const trialDialog = screen.getByRole("dialog", { name: "堂审" });
    expect(trialDialog.textContent || "").toContain("地方案牍");
    expect(trialDialog.textContent || "").toContain("不补造犯供");
    fireEvent.click(screen.getByRole("button", { name: "写入奏折草稿" }));
    expect(useUiStateStore.getState().actionDraft?.text).toContain("公开案牍");
  });

  it("loads S78 topic surface materials, requests AI draft, and writes only to the composer", async () => {
    const sessionId = "78787878-7878-4878-8878-787878787878";
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId,
          worldState: { player: { name: "顾澄", role: "official", officeTitle: "户部主事" } },
          eventArchiveView: { items: [] }
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/topic-surface/${sessionId}/court-debate`) {
        return new Response(JSON.stringify({
          sessionId,
          topicSurfaceView: {
            schemaVersion: "s78.topicSurfaceView.v1",
            sessionId,
            generatedAtTurn: 3,
            surfaceId: "court-debate",
            surfaceType: "court_debate",
            label: "朝议",
            title: "朝议筹议",
            summary: "围绕公开议题形成意见。",
            sourceViews: [
              { sourceView: "eventArchiveView", domain: "events", count: 1 },
              { sourceView: "npcActiveRequestView", domain: "events", count: 1 },
              { sourceView: "npcInteractionView", domain: "events", count: 1 },
              { sourceView: "economyTraceView", domain: "economy", count: 1 }
            ],
            filters: [],
            items: [{
              id: "topic-item:court-debate:1",
              kind: "debate_issue",
              title: "边饷催报",
              summary: "兵部催核粮饷。",
              sourceView: "eventArchiveView",
              statusLabel: "急需筹议",
              evidenceRefs: ["eventArchiveView:event-1"],
              urgency: "urgent"
            }],
            evidenceRefs: [{
              refId: "eventArchiveView:event-1",
              sourceView: "eventArchiveView",
              sourceId: "event-1",
              domain: "events",
              label: "边饷催报",
              summary: "兵部催核粮饷。",
              visibility: "public",
              confidence: 0.8,
              freshness: "current"
            }, {
              refId: "npcActiveRequestView:npc-follow-up-evidence:petition",
              sourceView: "npcActiveRequestView",
              sourceId: "npc-follow-up-evidence:petition",
              domain: "events",
              label: "请托案牍复核",
              summary: "来函请托只作公开案牍线索。",
              visibility: "public",
              confidence: 0.7,
              freshness: "current"
            }, {
              refId: "npcInteractionView:npc-relationship-action-evidence:duel",
              sourceView: "npcInteractionView",
              sourceId: "npc-relationship-resolution:npc-scholar-peer-shen:duel:29",
              domain: "events",
              label: "交游记录：沈砚秋切磋",
              summary: "沈砚秋切磋已由服务器裁决，只作公开交游材料引用。",
              visibility: "player_visible",
              confidence: 0.7,
              freshness: "current",
              topicSurfaceIds: ["npc-profile", "court-debate", "memorial-review"]
            }, {
              refId: "economyTraceView:trade:paper",
              sourceView: "economyTraceView",
              sourceId: "trade:paper",
              domain: "economy",
              label: "纸价议价解释",
              summary: "经济解释只作朝议材料，不视为交易成交。",
              visibility: "public",
              confidence: 0.73,
              freshness: "current"
            }],
            draftSlots: [
              { id: "balanced", label: "折中议", draftKind: "balanced_debate", template: "召集廷议，令诸臣陈明利害。" },
              { id: "ministry", label: "部议", draftKind: "ministry_debate", template: "交部院会商。" }
            ],
            scenePreview: {
              sceneType: "court_debate",
              title: "边饷催报",
              participantLabels: ["户部", "兵部"],
              proposalBudget: { maxRounds: 3, maxActors: 2 },
              authorityBoundary: "朝议只生成草稿。"
            },
            lastPublicResults: [],
            authorityBoundary: "朝议只收集公开意见和草稿；任免、诏令、战和、财政结算和时间推进仍归服务器。",
            emptyState: "暂无议题。",
            safety: {
              readOnly: true,
              actorVisibleContextOnly: true,
              draftOnly: true,
              noResolverExecution: true,
              noStateWrites: true,
              noGlobalTimeAdvance: true
            }
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/ai/topic-draft/${sessionId}`) {
        const body = JSON.parse(String(options?.body || "{}"));
        expect(body).toMatchObject({
          surfaceId: "court-debate",
          draftKind: "balanced_debate",
          selectedEvidenceRefs: ["eventArchiveView:event-1", "economyTraceView:trade:paper"]
        });
        return new Response(JSON.stringify({
          schemaVersion: "s78.topicDraft.v1",
          sessionId,
          generatedAtTurn: 3,
          surfaceId: "court-debate",
          source: "mock-ai",
          status: "ready",
          topicDraft: {
            surfaceId: "court-debate",
            draftKind: "balanced_debate",
            draftTitle: "折中议",
            draftText: "请召诸臣廷议，先核边饷催报与纸价议价解释，再拟稳妥章程。",
            evidenceRefs: ["eventArchiveView:event-1", "economyTraceView:trade:paper"],
            riskNote: "粮饷不足时宜先复核。",
            nextStep: "写入底部奏折后呈上。",
            source: "mock-ai"
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/court`);

    await screen.findByRole("heading", { name: "朝议与官署" });
    expect(document.body.textContent || "").not.toMatch(/安全专题投影|后端裁决|resolver|safe view|\bserver\b|provider|model/i);
    fireEvent.click(screen.getByRole("button", { name: "朝议" }));

    const dialog = await screen.findByRole("dialog", { name: "朝议" });
    await waitFor(() => expect(screen.getAllByText("边饷催报").length).toBeGreaterThan(0));
    expect(dialog.textContent || "").toContain("材料");
    expect(dialog.textContent || "").toContain("筹议");
    expect(dialog.textContent || "").toContain("草稿");
    expect(dialog.textContent || "").toContain("户部、兵部");
    expect(dialog.textContent || "").toContain("请托案牍复核");
    expect(dialog.textContent || "").toContain("来函证据 · 案牍");
    expect(dialog.textContent || "").toContain("交游记录：沈砚秋切磋");
    expect(dialog.textContent || "").toContain("交游记录 1 条");
    expect(dialog.textContent || "").toContain("交游记录 · 案牍");
    expect(dialog.textContent || "").toContain("纸价议价解释");
    expect(dialog.textContent || "").toContain("经济解释 1 条");
    expect(dialog.textContent || "").toContain("经济解释 · 月账");
    expect(dialog.textContent || "").not.toContain("economyTraceView");
    expect(dialog.textContent || "").not.toMatch(/AI|NPC|安全投影|安全视图|后端裁决|resolver|safe view|\bserver\b|provider|model/i);

    fireEvent.click(screen.getByLabelText(/纸价议价解释/));
    fireEvent.click(screen.getByRole("button", { name: "推演拟稿" }));
    await waitFor(() => expect((screen.getByLabelText("专题草稿正文") as HTMLTextAreaElement).value).toBe("请召诸臣廷议，先核边饷催报与纸价议价解释，再拟稳妥章程。"));
    fireEvent.click(screen.getByRole("button", { name: "写入底部奏折" }));

    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "请召诸臣廷议，先核边饷催报与纸价议价解释，再拟稳妥章程。",
      draftContext: {
        surfaceId: "court-debate",
        draftKind: "balanced_debate",
        evidenceRefs: ["eventArchiveView:event-1", "economyTraceView:trade:paper"],
        status: "client_hint",
        generatedAtTurn: 3
      }
    });
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).toContain(`/api/game/topic-surface/${sessionId}/court-debate`);
    expect(requestedUrls).toContain(`/api/ai/topic-draft/${sessionId}`);
    expect(requestedUrls).not.toContain("/api/game/turn");
    expect(requestedUrls.some((url) => /\/api\/game\/state|\/api\/dev/.test(url))).toBe(false);
  });

  it("opens court, archive, and map surfaces against the current route session", async () => {
    const staleSessionId = "12121212-1212-4121-8121-121212121212";
    const routeSessionId = "56565656-5656-4565-8565-565656565656";
    const topicSurfaceResponse = (surfaceId: string, label: string) => ({
      sessionId: routeSessionId,
      topicSurfaceView: {
        schemaVersion: "s78.topicSurfaceView.v1",
        sessionId: routeSessionId,
        generatedAtTurn: 6,
        surfaceId,
        surfaceType: surfaceId,
        label,
        title: `${label}当前案材料`,
        summary: "当前 route 案卷的专题材料。",
        sourceViews: [{ sourceView: "eventArchiveView", domain: "events", count: 1 }],
        filters: [],
        items: [{
          id: `${surfaceId}:route-item`,
          kind: "route_bound_item",
          title: `${label}当前案题`,
          summary: "只应显示当前 route 案卷专题材料。",
          sourceView: "eventArchiveView",
          statusLabel: "当前案",
          evidenceRefs: [`eventArchiveView:${surfaceId}:route`],
          urgency: "normal"
        }],
        evidenceRefs: [{
          refId: `eventArchiveView:${surfaceId}:route`,
          sourceView: "eventArchiveView",
          sourceId: `${surfaceId}:route`,
          domain: "events",
          label: `${label}当前案证据`,
          summary: "当前 route 案卷公开证据。",
          visibility: "public",
          confidence: 0.8,
          freshness: "current"
        }],
        draftSlots: [{ id: "route", label: "当前案草稿", draftKind: "route_bound", template: "只取当前案材料。" }],
        scenePreview: {
          sceneType: surfaceId,
          title: `${label}当前案材料`,
          participantLabels: ["当前案有司"],
          proposalBudget: { maxRounds: 1, maxActors: 1 },
          authorityBoundary: "只读当前案安全投影。"
        },
        lastPublicResults: [],
        authorityBoundary: "只读当前案安全投影；按钮只写草稿，不调用 resolver。",
        emptyState: "暂无议题。",
        safety: {
          readOnly: true,
          actorVisibleContextOnly: true,
          draftOnly: true,
          noResolverExecution: true,
          noStateWrites: true,
          noGlobalTimeAdvance: true
        }
      }
    });
    const staleSurfaceResponse = {
      sessionId: staleSessionId,
      topicSurfaceView: {
        ...topicSurfaceResponse("court-debate", "旧案").topicSurfaceView,
        sessionId: staleSessionId,
        title: "旧案材料不应显示",
        items: [{
          id: "old-item",
          kind: "old",
          title: "旧案题",
          summary: "旧案材料不应显示。",
          sourceView: "eventArchiveView",
          statusLabel: "旧案",
          evidenceRefs: ["eventArchiveView:old"],
          urgency: "normal"
        }]
      }
    };
    const playerPayload = {
      source: "server_player_visible_state_projection",
      sessionId: routeSessionId,
      worldState: { player: { name: "顾澄", role: "official" } },
      eventArchiveView: {
        schemaVersion: 1,
        pagination: { page: 1, pageSize: 12, totalItems: 1 },
        counts: { total: 1 },
        items: [{
          id: "EA-route-1",
          sourceType: "event_history",
          sourceLabel: "朝报",
          title: "当前案史册",
          summary: "当前 route 案卷公开史册。",
          dateLabel: "明1644年三月上旬",
          statusLabel: "已记"
        }]
      },
      mapRuntimeView: { schemaVersion: 1, refs: [], routes: [], eventEffects: [] }
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${routeSessionId}`) {
        return new Response(JSON.stringify(playerPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/ai/quick-actions/${routeSessionId}`) {
        return new Response(JSON.stringify({
          schemaVersion: "s75.9-quick-actions.v1",
          sessionId: routeSessionId,
          source: "mock-ai",
          status: "ready",
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/topic-surface/${staleSessionId}/court-debate`) {
        return new Response(JSON.stringify(staleSurfaceResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/topic-surface/${routeSessionId}/court-debate`) {
        return new Response(JSON.stringify(topicSurfaceResponse("court-debate", "朝议")), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/topic-surface/${routeSessionId}/memorial-review`) {
        return new Response(JSON.stringify(topicSurfaceResponse("memorial-review", "奏折队列")), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    useGameSessionStore.setState({
      currentSessionId: routeSessionId,
      currentSession: playerPayload as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"],
      status: "ready"
    });
    useUiStateStore.setState({
      currentSessionId: staleSessionId,
      currentPlayerPayload: null
    });

    const courtRender = renderRoute(`/game/${routeSessionId}/court`);
    await screen.findByRole("heading", { name: "朝议与官署" });

    act(() => {
      useUiStateStore.setState({ currentSessionId: staleSessionId, currentPlayerPayload: null });
    });
    fireEvent.click(screen.getByRole("button", { name: "朝议" }));

    const courtDialog = await screen.findByRole("dialog", { name: "朝议" });
    await waitFor(() => expect(courtDialog.textContent || "").toContain("朝议当前案题"));
    expect(useUiStateStore.getState().currentSessionId).toBe(routeSessionId);
    expect(courtDialog.textContent || "").not.toContain("旧案题");
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(`/api/game/topic-surface/${routeSessionId}/court-debate`);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain(`/api/game/topic-surface/${staleSessionId}/court-debate`);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "朝议" })).toBeNull());
    courtRender.unmount();

    useGameSessionStore.setState({
      currentSessionId: routeSessionId,
      currentSession: playerPayload as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"],
      status: "ready"
    });
    act(() => {
      useUiStateStore.setState({ currentSessionId: staleSessionId, currentPlayerPayload: null });
    });
    const archiveRender = renderRoute(`/game/${routeSessionId}/archive`);
    await screen.findByRole("heading", { name: "史册" });
    const archiveTrigger = screen.getByRole("button", { name: "阅奏折" });
    fireEvent.click(archiveTrigger);
    const memorialDialog = await screen.findByRole("dialog", { name: "奏折队列" });
    await waitFor(() => expect(memorialDialog.textContent || "").toContain("奏折队列当前案题"));
    expect(useUiStateStore.getState().currentSessionId).toBe(routeSessionId);
    expect(screen.getByRole("button", { name: "关闭专题" })).toBe(document.activeElement);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "奏折队列" })).toBeNull());
    expect(document.activeElement).toBe(archiveTrigger);
    archiveRender.unmount();

    useGameSessionStore.setState({
      currentSessionId: routeSessionId,
      currentSession: playerPayload as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"],
      status: "ready"
    });
    act(() => {
      useUiStateStore.setState({ currentSessionId: staleSessionId, currentPlayerPayload: null });
    });
    renderRoute(`/game/${routeSessionId}/map`);
    await screen.findByRole("heading", { name: "山河舆图" });
    const mapTrigger = screen.getByRole("button", { name: "筛舆图" });
    fireEvent.click(mapTrigger);
    const mapDialog = await screen.findByRole("dialog", { name: "舆图筛选" });
    expect(mapDialog.textContent || "").toContain("舆图地点");
    expect(mapDialog.querySelector("[data-polish-map-filter='s89-12-surface-guide']")).toBeTruthy();
    expect(mapDialog.textContent || "").toContain("卷上图层");
    expect(mapDialog.textContent || "").toContain("人物动向");
    expect(mapDialog.textContent || "").toContain("只改舆图显示，不影响案卷事实");
    expect(mapDialog.textContent || "").toContain("回舆图勾选");
    expect(mapDialog.textContent || "").not.toContain("草稿");
    expect(mapDialog.textContent || "").not.toContain("写入舆图草稿");
    expect(mapDialog.textContent || "").not.toContain("写入奏折草稿");
    expect(useUiStateStore.getState().currentSessionId).toBe(routeSessionId);
    expect(screen.getByRole("button", { name: "关闭专题" })).toBe(document.activeElement);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "舆图筛选" })).toBeNull());
    expect(document.activeElement).toBe(mapTrigger);
    expect(document.body.textContent || "").not.toMatch(/旧案题|旧案材料不应显示|\/api\/game\/state|\/api\/dev|raw audit|provider payload|OPENAI_API_KEY/i);
  });

  it("does not keep stale topic surface materials when the open surface switches sessions", async () => {
    const staleSessionId = "12121212-1212-4121-8121-121212121212";
    const routeSessionId = "34343434-3434-4343-8343-343434343434";
    const pendingRouteSurface = new Promise<Response>(() => undefined);
    const staleSurfaceResponse = {
      sessionId: staleSessionId,
      topicSurfaceView: {
        schemaVersion: "s78.topicSurfaceView.v1",
        sessionId: staleSessionId,
        generatedAtTurn: 8,
        surfaceId: "court-debate",
        surfaceType: "court_debate",
        label: "朝议",
        title: "旧案朝议",
        summary: "旧案专题材料不应串入新案。",
        sourceViews: [{ sourceView: "eventArchiveView", domain: "events", count: 1 }],
        filters: [],
        items: [{
          id: "topic-item:old:1",
          kind: "debate_issue",
          title: "旧案边饷",
          summary: "旧案兵部催报不应显示。",
          sourceView: "eventArchiveView",
          statusLabel: "旧案",
          evidenceRefs: ["eventArchiveView:old-event"],
          urgency: "urgent"
        }],
        evidenceRefs: [{
          refId: "eventArchiveView:old-event",
          sourceView: "eventArchiveView",
          sourceId: "old-event",
          domain: "events",
          label: "旧案证据",
          summary: "旧案证据不应显示。",
          visibility: "public",
          confidence: 0.8,
          freshness: "current"
        }],
        draftSlots: [{ id: "old", label: "旧议", draftKind: "old_debate", template: "旧案模板。" }],
        scenePreview: {
          sceneType: "court_debate",
          title: "旧案朝议",
          participantLabels: ["旧案户部"],
          proposalBudget: { maxRounds: 3, maxActors: 2 },
          authorityBoundary: "旧案边界不应显示。"
        },
        lastPublicResults: [],
        authorityBoundary: "旧案边界不应显示。",
        emptyState: "暂无议题。",
        safety: {
          readOnly: true,
          actorVisibleContextOnly: true,
          draftOnly: true,
          noResolverExecution: true,
          noStateWrites: true,
          noGlobalTimeAdvance: true
        }
      }
    };
    const fetchMock = vi.fn((url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return Promise.resolve(new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
      if (url === `/api/game/topic-surface/${staleSessionId}/court-debate`) {
        return Promise.resolve(new Response(JSON.stringify(staleSurfaceResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
      if (url === `/api/game/topic-surface/${routeSessionId}/court-debate`) {
        return pendingRouteSurface;
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    useUiStateStore.setState({
      activeSurface: "court-debate",
      currentPage: "game",
      currentSessionId: staleSessionId
    });

    render(<SurfaceHost />);

    const dialog = await screen.findByRole("dialog", { name: "朝议" });
    await waitFor(() => expect(dialog.textContent || "").toContain("旧案边饷"));
    const textarea = within(dialog).getByLabelText("专题草稿正文") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "旧案草稿不应写入新案。" } });
    expect(textarea.value).toBe("旧案草稿不应写入新案。");

    act(() => {
      useUiStateStore.setState({ currentSessionId: routeSessionId });
    });

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url) === `/api/game/topic-surface/${routeSessionId}/court-debate`)).toBe(true));
    expect(dialog.textContent || "").not.toMatch(/旧案边饷|旧案证据|旧案边界|旧案户部/);
    expect((within(dialog).getByLabelText("专题草稿正文") as HTMLTextAreaElement).value).not.toContain("旧案草稿");

    fireEvent.click(within(dialog).getByRole("button", { name: "写入底部奏折" }));
    expect(useUiStateStore.getState().actionDraft?.text || "").not.toContain("旧案草稿");
    expect(useUiStateStore.getState().actionDraft?.draftContext).toBeUndefined();
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

  it("renders the S76.7 immersive exam page and keeps exam API authority server-owned", async () => {
    const sessionId = "abababab-abab-4bab-8bab-abababababab";
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify({
          ...buildMockAssetManifest(0),
          assets: [
            {
              id: "ui-scene-exam-cell-v1",
              category: "scene",
              usage: ["exam_page"],
              scene: "exam_cell",
              path: "/assets/ui/scenes/scene-exam-cell-v1.webp",
              thumbnailPath: "/assets/ui/thumbs/thumb-scene-exam-cell-v1.webp",
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
          worldState: { player: { name: "顾衡", role: "scholar" } },
          examCalendarView: { currentDateLabel: "明1644年二月上旬" }
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/exam/question") {
        return new Response(JSON.stringify({
          sessionId,
          examId: "exam-s76-7",
          level: "provincial_exam",
          examName: "乡试",
          examQuestion: "试论荒政与教化并行之道。",
          difficulty: "中",
          requirements: ["务陈经义", "兼论民生"],
          wordCount: { min: 600, max: 900 },
          entryPreparation: {
            preparationPressure: {
              label: "吃紧",
              score: 66,
              summary: "盘费与旅途压力偏高。",
              studyFocus: "经义制艺",
              causes: ["盘费缺口仍须补。"],
              suggestedActions: ["先审题立意。"]
            }
          },
          examProcedureView: {
            phaseLabel: "发题审题",
            entrySearch: { publicSummary: "入场搜检未见夹带，但备考压力偏高。" },
            cell: { publicSummary: "号舍已定，先审题再动笔。" },
            phaseFeedback: {
              phase: "question_release",
              phaseLabel: "发题审题",
              pressureLabel: "吃紧",
              publicSummary: "题纸既发，先辨题眼、限定破题，不急于下笔。",
              environmentSummary: "入号舍后的声息只作公开场内摘要。",
              riskNotes: ["备考吃紧，场内先稳心神。"],
              visibleNextActions: ["审题立意", "拟定提纲"],
              authorityBoundary: "入场后反馈由服务器派生；前端只读展示或写草稿。"
            },
            incidents: [{ type: "preparation_pressure", label: "备考吃紧", publicSummary: "盘费与旅途压力偏高。" }]
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/exam/progress") {
        return new Response(JSON.stringify({
          sessionId,
          examId: "exam-s76-7",
          level: "provincial_exam",
          examName: "乡试",
          examQuestion: "试论荒政与教化并行之道。",
          difficulty: "中",
          requirements: ["务陈经义", "兼论民生"],
          wordCount: { min: 600, max: 900 },
          narrative: "号舍风紧，仍可落笔。",
          entryPreparation: {
            preparationPressure: {
              label: "吃紧",
              score: 66,
              summary: "盘费与旅途压力偏高。",
              studyFocus: "经义制艺",
              causes: ["盘费缺口仍须补。"],
              suggestedActions: ["先审题立意。"]
            }
          },
          examProcedureView: {
            phaseLabel: "草稿成文",
            entrySearch: { publicSummary: "入场搜检未见夹带，但备考压力偏高。" },
            cell: { publicSummary: "号舍已定，先审题再动笔。" },
            phaseFeedback: {
              phase: "drafting",
              phaseLabel: "草稿成文",
              pressureLabel: "吃紧",
              publicSummary: "提纲已入草稿，宜把首段题眼、承转和用典次序稳定下来。",
              environmentSummary: "号舍疲劳与备考压力会影响文气，但只形成公开风险提示。",
              actionEcho: "誊清卷面，仍不伪称评卷。",
              riskNotes: ["保留誊清时间。"],
              visibleNextActions: ["补足经义依据", "转入誊清"],
              authorityBoundary: "入场后反馈由服务器派生；前端只读展示或写草稿。"
            },
            incidents: [{ type: "preparation_pressure", label: "备考吃紧", publicSummary: "盘费与旅途压力偏高。" }]
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "/api/exam/submit") {
        return new Response(JSON.stringify({
          sessionId,
          examId: "exam-s76-7",
          level: "provincial_exam",
          examName: "provider payload sk-test-secret path=C:\\secret\\exam.json",
          score: { total: 82 },
          worldState: { player: { name: "顾衡", role: "scholar", examRank: "秀才" } }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url} ${options?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/exam`);

    await screen.findByRole("heading", { name: "科举" });
    expect(screen.getAllByText("县学试棚").length).toBeGreaterThan(0);
    expect(document.querySelector(".examFullScreen")).toBeTruthy();
    expect(document.querySelector('[data-polish-exam="s89-18-exam-ritual-ledger"]')).toBeTruthy();
    expect(document.querySelector('[data-polish-exam-ledger="s89-18-exam-ritual"]')).toBeTruthy();
    expect(document.querySelector(".examStageRail")).toBeTruthy();
    expect(document.querySelector(".sessionRouteShell")).toBeTruthy();
    expect(document.querySelector(".gameCommandBar")).toBeFalsy();
    expect(document.querySelector(".gameMainDeck")).toBeFalsy();
    expect(document.querySelector(".memorialComposer")).toBeFalsy();
    expect(screen.getByLabelText("试别")).toBeTruthy();
    expect(screen.getByText("科举仪程")).toBeTruthy();
    expect(screen.getByText("取题启封")).toBeTruthy();
    expect(screen.getByText("场内推进")).toBeTruthy();
    expect(screen.getByText("交卷候批")).toBeTruthy();
    expect(screen.getByText("候榜回音")).toBeTruthy();
    expect(screen.getByText(/交卷、评分、舞弊、放榜、晋级和授官都回主卷定夺/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("试别"), { target: { value: "provincial_exam" } });
    fireEvent.click(screen.getByRole("button", { name: "取题" }));

    await screen.findByText("试论荒政与教化并行之道。");
    expect(screen.getByLabelText("场内行动")).toBeTruthy();
    expect(screen.getByLabelText("文章")).toBeTruthy();
    expect(screen.getAllByText(/600-900 字/).length).toBeGreaterThan(0);
    expect(screen.getByText(/备考压力：吃紧 66\/100/)).toBeTruthy();
    expect(screen.getByText("备考吃紧：盘费与旅途压力偏高。")).toBeTruthy();
    expect(screen.getByText(/入场后反馈：题纸既发/)).toBeTruthy();
    expect(screen.getAllByText(/发题审题：题纸既发/).length).toBeGreaterThan(0);
    expect(screen.getByText(/场内反馈只作案卷公开记录/)).toBeTruthy();
    expect(screen.getByText(/同场考生、阅卷官与榜单只显示公开占位/)).toBeTruthy();

    const fetchCountBeforeFeedbackDraft = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "拟行动：审题立意" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "exam",
      targetPage: "game",
      text: "审题立意"
    });
    expect(fetchMock.mock.calls).toHaveLength(fetchCountBeforeFeedbackDraft);

    fireEvent.change(screen.getByLabelText("场内行动"), { target: { value: "誊清卷面，仍不伪称评卷。" } });
    fireEvent.click(screen.getByRole("button", { name: "推进考场" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/exam/progress")).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByText(/草稿成文：提纲已入草稿/).length).toBeGreaterThan(0));
    expect(screen.getByText(/本步行动：誊清卷面/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("文章"), { target: { value: "夫荒政者，先安民食，继明教化。" } });
    fireEvent.click(screen.getByRole("button", { name: "交卷" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/exam/submit")).toHaveLength(1));
    await screen.findByText(/乡试 已有评定，可入皇榜细看。/);

    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).not.toContain("/api/game/turn");
    expect(requestedUrls.some((url) => /\/api\/game\/state|\/api\/dev/.test(url))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/服务器|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|safe view|resolver|provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/i);
  });

  it("renders the S76.8 ranking page from server-owned exam views", async () => {
    const sessionId = "16161616-1616-4616-8616-161616161616";
    const rankingPayload = {
      sessionId,
      source: "server_player_visible_state_projection",
      worldState: {
        player: {
          name: "顾衡",
          role: "scholar",
          examRank: "进士",
          examHistory: [{
            examName: "殿试",
            ranking: [
              { id: "player", place: 1, name: "顾衡", origin: "苏州府", score: 96, rankLabel: "一甲第一名", honorTitle: "状元", isPlayer: true, examinerComment: "对策明切，识见可任。", strengths: ["议论宏阔"], weaknesses: ["辞气可更凝练"] },
              { id: "bad", place: 2, name: "provider payload sk-test-secret path=C:\\secret\\ranking.json", origin: "raw audit", score: 88, rankLabel: "一甲第二名", honorTitle: "榜眼", examinerComment: "hiddenNotes" }
            ],
            score: {
              content_quality: { score: 95, comment: "切中时务。" },
              argument_strength: { score: 94, comment: "层次分明。" },
              literary_style: { score: 92, comment: "文气端雅。" },
              classical_format: { score: 93, comment: "格式稳妥。" },
              historical_appropriateness: { score: 96, comment: "不涉时错。" },
              detailed_feedback: "服务器公开评语。"
            },
            authenticityCheck: {
              flags: [{ label: "弥封复核通过", severity: "clear", detail: "未见公开扣罚事项。" }]
            },
            examAftermath: {
              publicSummary: "殿试放榜后，同年座师只显示公开往来。",
              sameYearContacts: [{ id: "peer-1", name: "沈同年", role: "同年进士", stance: "同年声援", publicSummary: "沈同年可公开往来。" }],
              examinerContacts: [{ id: "reader-1", name: "许读卷官", role: "殿试读卷官", relationKind: "palace_reader", stance: "读卷赏识", publicSummary: "许读卷官公开赏识。" }],
              nextActions: ["具帖拜谢许读卷官，只问公开赴任规矩。"]
            }
          }]
        }
      },
      examHonorView: {
        publicSummary: "殿试放榜，服务器定顾衡为状元。",
        latestHonor: { title: "状元", examName: "殿试", rankLabel: "一甲第一名", publicSummary: "服务器定榜。" },
        authorityBoundary: "科名荣誉只读服务器定榜顺序。"
      },
      examinerPanelView: {
        serverDecision: "服务器综合初评、复核和名额后定分定榜。"
      },
      examAftermathView: {
        schemaVersion: 1,
        publicSummary: "殿试放榜后，服务器整理同年1人、座师/考官1人，并接入翰林院修撰。",
        sameYearContacts: [{ id: "peer-1", name: "沈同年", role: "同年进士", stance: "同年声援", publicSummary: "沈同年可公开往来。" }],
        examinerContacts: [{ id: "reader-1", name: "许读卷官", role: "殿试读卷官", relationKind: "palace_reader", stance: "读卷赏识", publicSummary: "许读卷官公开赏识。" }],
        nextActions: ["具帖拜谢许读卷官，只问公开赴任规矩。"],
        authorityBoundary: "AI 与前端不能补名次、造关系、定官职或写 hidden 私档。"
      },
      appointmentTrackView: {
        latestDecision: { officeTitle: "翰林院修撰", trackLabel: "馆选" },
        publicSummary: "服务器定初授翰林院修撰。"
      }
    };
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify({
          ...buildMockAssetManifest(0),
          assets: [
            {
              id: "ui-scene-ranking-wall-v1",
              category: "scene",
              subcategory: "ranking_wall",
              usage: ["ranking_page"],
              scene: "ranking_wall",
              path: "/assets/ui/scenes/scene-ranking-wall-v1.webp",
              thumbnailPath: "/assets/ui/thumbs/thumb-scene-ranking-wall-v1.webp",
              fallbackRef: "fallback-paper-panel-v1",
              reviewStatus: "approved",
              visualReview: { status: "approved" },
              safetyReview: { status: "approved" }
            },
            {
              id: "ui-imperial-notice-paper-v1",
              category: "material",
              subcategory: "imperial_notice",
              usage: ["ranking_page"],
              path: "/assets/ui/materials/imperial-notice-paper-v1.webp",
              thumbnailPath: "/assets/ui/thumbs/thumb-imperial-notice-paper-v1.webp",
              fallbackRef: "fallback-paper-panel-v1",
              reviewStatus: "approved",
              visualReview: { status: "approved" },
              safetyReview: { status: "approved" }
            },
            {
              id: "ui-red-ink-smudge-v1",
              category: "material",
              subcategory: "red_ink_smudge",
              usage: ["ranking_page"],
              path: "/assets/ui/materials/red-ink-smudge-v1.webp",
              thumbnailPath: "/assets/ui/thumbs/thumb-red-ink-smudge-v1.webp",
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
        return new Response(JSON.stringify(rankingPayload), {
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url} ${options?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    useGameSessionStore.setState({
      currentSessionId: sessionId,
      currentSession: rankingPayload,
      lastExamResult: {
        ...rankingPayload,
        examId: "exam-ranking",
        level: "palace_exam",
        examName: "殿试",
        ranking: rankingPayload.worldState.player.examHistory[0].ranking,
        score: rankingPayload.worldState.player.examHistory[0].score,
        promotionResult: { passed: true, officeTitle: "翰林院修撰" },
        authenticityCheck: rankingPayload.worldState.player.examHistory[0].authenticityCheck,
        examAftermathView: rankingPayload.examAftermathView
      } as never,
      status: "ready"
    });

    renderRoute(`/game/${sessionId}/ranking`);

    await screen.findByRole("heading", { name: "皇榜" });
    expect(document.querySelector(".rankingFullScreen")).toBeTruthy();
    expect(document.querySelector('[data-polish-ranking="s89-18-ranking-ceremony-ledger"]')).toBeTruthy();
    expect(document.querySelector('[data-polish-ranking-ledger="s89-18-ranking-ceremony"]')).toBeTruthy();
    expect(document.querySelector(".sessionRouteShell")).toBeTruthy();
    expect(document.querySelector(".gameCommandBar")).toBeFalsy();
    expect(document.querySelector(".gameMainDeck")).toBeFalsy();
    expect(document.querySelector(".memorialComposer")).toBeFalsy();
    expect(document.querySelector(".rankingTopThree")).toBeTruthy();
    expect(screen.getByText("金榜名单")).toBeTruthy();
    expect(screen.getByText("金榜题名")).toBeTruthy();
    expect(screen.getByText("放榜仪程")).toBeTruthy();
    expect(screen.getByText("张榜取材")).toBeTruthy();
    expect(screen.getByText("我名")).toBeTruthy();
    expect(screen.getByText("授官过渡")).toBeTruthy();
    expect(screen.getAllByText("顾衡").length).toBeGreaterThan(0);
    expect(document.querySelector(".rankingGoldenNotice")).toBeTruthy();
    expect(document.querySelector(".rankingList li.isPlayer")).toBeTruthy();
    const rankingDetail = screen.getByRole("complementary", { name: "榜名详情" });
    expect(rankingDetail.getAttribute("tabindex")).toBe("-1");
    fireEvent.click(screen.getByRole("button", { name: "跳至我名" }));
    expect(document.activeElement).toBe(rankingDetail);
    expect(screen.getAllByText("翰林院修撰").length).toBeGreaterThan(0);
    expect(screen.getByText("切中时务。")).toBeTruthy();
    expect(screen.getAllByText("同年座师").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/沈同年/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/许读卷官/).length).toBeGreaterThan(0);
    expect(screen.getByText(/具帖拜谢许读卷官/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /拟行动/ })[0]);
    expect(useUiStateStore.getState().actionDraft?.text).toContain("许读卷官");
    expect(screen.getByText(/本榜只录已经张挂的定榜结果/)).toBeTruthy();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain("/api/game/turn");
    expect(fetchMock.mock.calls.map(([url]) => String(url)).some((url) => /\/api\/game\/state|\/api\/dev/.test(url))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/服务器|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary|safe view|resolver|provider payload|raw audit|hiddenNotes|sk-test-secret|path=|C:\\|OPENAI_API_KEY|data\/sessions/i);
  });

  it("keeps S76.8 ranking empty when the server has not returned a ranking", async () => {
    const sessionId = "17171717-1717-4717-8717-171717171717";
    const payload = {
      sessionId,
      source: "server_player_visible_state_projection",
      worldState: {
        player: {
          name: "沈修",
          role: "scholar",
          examHistory: [{
            examName: "会试",
            score: {
              content_quality: { score: 88, comment: "文义清楚。" }
            }
          }]
        }
      },
      examHonorView: {
        honors: [{ title: "会元", rankLabel: "第一名", publicSummary: "荣誉摘要只作科名归档。" }],
        publicSummary: "服务器尚未公开本场正榜。",
        authorityBoundary: "科名荣誉不能补成榜单。"
      },
      appointmentTrackView: {},
      examinerPanelView: {}
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify(payload), {
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    useGameSessionStore.setState({
      currentSessionId: sessionId,
      currentSession: payload,
      lastExamResult: null,
      status: "ready"
    });

    renderRoute(`/game/${sessionId}/ranking`);

    await screen.findByRole("heading", { name: "皇榜" });
    expect(screen.getAllByText(/榜文尚未张挂/).length).toBeGreaterThan(0);
    expect(screen.getByText(/暂无公开弥封复核结果/)).toBeTruthy();
    expect(document.querySelector(".rankingGoldenNotice")).toBeFalsy();
    expect(document.querySelector(".rankingList")).toBeFalsy();
    expect(document.querySelectorAll(".rankingList li").length).toBe(0);
    expect(document.body.textContent || "").not.toMatch(/会元|第一名|弥封复核通过|未见公开扣罚事项/);
  });

  it("does not mark same-name ranking rows as the player without server flag", async () => {
    const sessionId = "18181818-1818-4818-8818-181818181818";
    const payload = {
      sessionId,
      source: "server_player_visible_state_projection",
      worldState: {
        player: {
          name: "顾衡",
          role: "scholar",
          examHistory: [{
            examName: "乡试",
            ranking: [
              { id: "same-name", place: 1, name: "顾衡", origin: "苏州府", score: 91, rankLabel: "第一名", examinerComment: "服务器只公开同名榜行。" }
            ]
          }]
        }
      },
      examHonorView: {
        publicSummary: "服务器尚未标记案主榜行。",
        authorityBoundary: "前端不得按同名补成玩家榜行。"
      },
      appointmentTrackView: {},
      examinerPanelView: {}
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify(payload), {
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    useGameSessionStore.setState({
      currentSessionId: sessionId,
      currentSession: payload,
      lastExamResult: null,
      status: "ready"
    });

    renderRoute(`/game/${sessionId}/ranking`);

    await screen.findByRole("heading", { name: "皇榜" });
    expect(screen.getByText("金榜名单")).toBeTruthy();
    expect(screen.getByText(/只公开同名榜行/)).toBeTruthy();
    expect(document.querySelector(".rankingGoldenNotice")).toBeFalsy();
    expect(document.querySelector(".rankingList li.isPlayer")).toBeFalsy();
    expect(screen.queryByText("我名在此")).toBeNull();
  });

  it("loads the S76.10 current people ledger without exposing the full portrait pool", async () => {
    const sessionId = "55555555-5555-4555-8555-555555555555";
    const payload = {
      source: "server_player_visible_state_projection",
      sessionId,
      worldState: {
        player: {
          name: "陆清远",
          role: "scholar",
          portraitRef: "portrait-test-female-1-v1"
        }
      },
      worldPeopleView: {
        schemaVersion: 1,
        generatedAtTurn: 1,
        npcs: [
          {
            id: "C01",
            name: "顾文衡",
            rankLabel: "乡中塾师",
            genderLabel: "男",
            portraitRef: "portrait-test-male-4-v1",
            visibility: "relationship_visible",
            knownToPlayer: true,
            intelConfidence: 75,
            influence: 18,
            publicSummary: "顾文衡为乡中塾师，与玩家情分亲近。"
          },
          {
            id: "C02",
            name: "王氏",
            rankLabel: "商家女眷",
            genderLabel: "女",
            portraitRef: "C:\\bad\\OPENAI_API_KEY",
            visibility: "public",
            knownToPlayer: true,
            intelConfidence: 60,
            publicSummary: "OPENAI_API_KEY hiddenNotes data/sessions"
          },
          {
            id: "C03",
            name: "密钥私档顾问",
            rankLabel: "完整提示词掌柜",
            genderLabel: "本地路径女",
            portraitRef: "portrait-test-male-4-v1",
            visibility: "public",
            knownToPlayer: true,
            intelConfidence: 60,
            influence: 12,
            publicSummary: "隐藏私档密钥本地路径不应进入画像说明。",
            currentGoal: "完整提示词与本地路径也不应成为当前情况。"
          }
        ],
        relationships: [
          {
            id: "rel-player-npc-C01",
            sourceType: "player",
            sourceId: "P1",
            targetType: "npc",
            targetId: "C01",
            publicSummary: "顾文衡对玩家情分亲近。"
          }
        ]
      },
      npcActiveRequestView: {
        schemaVersion: "s88.7-npc-active-request-view.v1",
        followUpEvidence: {
          schemaVersion: "s88.7-npc-active-request-follow-up-evidence.v1",
          counts: { total: 3 },
          people: [{
            evidenceId: "npc-follow-up-evidence:intro",
            evidenceKindLabel: "引荐拜会",
            title: "同年师友引荐拜会",
            publicSummary: "顾文衡可作为公开师友线索，宜先具名拜会。",
            nextStep: "先拟拜帖并查明公开关系。",
            statusLabel: "待复核",
            npc: { displayName: "顾文衡" },
            riskTags: ["引荐"]
          }],
          economy: [{
            evidenceId: "npc-follow-up-evidence:debt",
            evidenceKindLabel: "human_debt_monthly",
            title: "人情债月账解释",
            publicSummary: "王氏旧账只作为公开月账解释，不直接结债。",
            nextStep: "查验契据、见证人与旧账来源。",
            statusLabel: "accepted_pending_server_resolution",
            npc: { displayName: "王氏" },
            riskTags: ["relationship_risk_watchlist"]
          }],
          events: [{
            evidenceId: "npc-follow-up-evidence:watch",
            evidenceKindLabel: "integrity_watchlist",
            title: "廉政 watchlist 留痕",
            publicSummary: "有人试探财物往来，应只作公开风宪线索。",
            nextStep: "拒收留痕并呈报公开线索。",
            statusLabel: "reported",
            npc: { displayName: "顾文衡" },
            riskTags: ["廉政", "风宪"]
          }, {
            evidenceId: "npc-follow-up-evidence:polluted",
            evidenceKindLabel: "provider payload",
            title: "hiddenNotes raw prompt C:\\bad /mnt/e/LSMNQ/.env",
            publicSummary: "OPENAI_API_KEY data/sessions provider payload draftContext schema manifest resolver safe view",
            npc: { displayName: "provider-forged" },
            riskTags: ["privateSignalTags"]
          }]
        }
      },
      worldEntityView: {
        highlights: [{
          id: "academy-same-year-circle",
          category: "academy",
          categoryLabel: "士林",
          kind: "academy_circle",
          kindLabel: "书院同门",
          name: "同年文社",
          statusLabel: "吃紧",
          riskLabel: "有牵连",
          publicSummary: "引荐后续和论道余波进入公开人脉观察，后续仍由服务器裁决。"
        }],
        groups: [{
          category: "local",
          label: "地方",
          entities: [{
            id: "local-gentry-county",
            category: "local",
            categoryLabel: "地方",
            kind: "local_gentry",
            kindLabel: "地方士绅",
            name: "地方士绅",
            statusLabel: "可观察",
            riskLabel: "可观察",
            publicSummary: "来函后续牵动地方人情，但不代表资源、人情债或婚姻结果已经落账。"
          }]
        }],
        recentImpacts: [{
          id: "world-entity-impact:12:academy",
          sourceType: "npc_relationship_action",
          sourceLabel: "NPC 关系行动",
          entityId: "academy-same-year-circle",
          entityName: "同年文社",
          title: "同年文社压力留痕",
          publicSummary: "论道余波已作为同年文社公开压力留痕，仍不结算关系终局。",
          statusLabel: "吃紧",
          riskLabel: "有牵连",
          affectedMetricLabels: ["信任上升"],
          topicSurfaceIds: ["npc-profile"],
          generatedAtTurn: 12
        }, {
          id: "world-entity-impact:11:gentry",
          sourceType: "active_npc_request",
          sourceLabel: "NPC 来函",
          entityId: "local-gentry-county",
          entityName: "地方士绅",
          title: "地方士绅压力留痕",
          publicSummary: "来函后续已作为地方人情公开压力留痕，不代表人情债已经落账。",
          statusLabel: "可观察",
          riskLabel: "可观察",
          affectedMetricLabels: ["压力上升"],
          topicSurfaceIds: ["npc-profile"],
          generatedAtTurn: 11
        }, {
          id: "world-entity-impact:polluted",
          sourceType: "npc_relationship_action",
          sourceLabel: "provider payload",
          entityId: "academy-same-year-circle",
          entityName: "同年文社",
          title: "hiddenNotes raw prompt C:\\bad",
          publicSummary: "OPENAI_API_KEY data/sessions provider payload",
          affectedMetricLabels: ["privateSignalTags"],
          topicSurfaceIds: ["npc-profile"],
          generatedAtTurn: 13
        }]
      },
      worldThreadView: {
        activeThreads: [{
          id: "WT-npc-rel-debate-safe",
          sourceType: "npc_relationship_action",
          sourceLabel: "npc_relationship_action",
          status: "active",
          kind: "npc_relationship_action",
          title: "交游记录：沈砚秋论道",
          summary: "沈砚秋论道已由服务器裁决，只作公开交游材料引用。",
          riskLabel: "中风险",
          severity: 2,
          goal: "追踪公开交游余波，不裁决关系终局。",
          followUpHint: "后续可拜会师友或补充公开声望材料，真实后果仍由服务器裁决。",
          interventionHints: ["拜会相关人物", "以公开礼法材料补证"],
          relatedLabels: {
            entities: ["同年文社"],
            metrics: ["信任上升"]
          }
        }, {
          id: "WT-npc-rel-polluted",
          sourceType: "npc_relationship_action",
          sourceLabel: "provider payload",
          status: "active",
          title: "hiddenNotes raw prompt C:\\bad",
          summary: "OPENAI_API_KEY data/sessions provider payload"
        }, {
          id: "WT-npc-rel-posix-path",
          sourceType: "npc_relationship_action",
          sourceLabel: "交游记录",
          status: "active",
          title: "交游记录：/mnt/e/LSMNQ/.env",
          summary: "旁注 /home/zzz/project/.env 只应视作污染路径。"
        }, {
          id: "WT-npc-rel-cjk-punct-path",
          sourceType: "npc_relationship_action",
          sourceLabel: "交游记录",
          status: "active",
          title: "交游记录，/home/zzz/project/.env",
          summary: "旁注、/mnt/e/LSMNQ/.env 也应视作污染路径。"
        }, {
          id: "WT-npc-rel-engineering",
          sourceType: "npc_relationship_action",
          sourceLabel: "交游记录",
          status: "active",
          title: "交游记录：draftContext schema manifest",
          summary: "safe view resolver sourceRef relatedRefs scopeRefs 不应显示。"
        }, {
          id: "WT-domain-visible",
          sourceType: "domain_consequence",
          sourceLabel: "领域后果",
          title: "不属于人物交游的议题",
          summary: "人物页不应展示非交游来源的 world thread。"
        }]
      }
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify(payload), {
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    useGameSessionStore.setState({
      lastNpcInteraction: {
        sessionId,
        accepted: true,
        npcInteractionView: { items: [] },
        worldEntityImpacts: [{
          sourceType: "npc_relationship_action",
          entityId: "academy-same-year-circle",
          topicSurfaceIds: ["archive"],
          publicSummary: "史册余波不应计入人物档案公开压力。"
        }]
      }
    });

    renderRoute(`/game/${sessionId}/people`);

    expect(screen.getByRole("heading", { name: "人物" })).toBeTruthy();
    expect(document.querySelector(".sessionRouteShell")).toBeTruthy();
    expect(document.querySelector(".gameCommandBar")).toBeFalsy();
    expect(document.querySelector(".gameMainDeck")).toBeFalsy();
    expect(document.querySelector(".memorialComposer")).toBeFalsy();
    await screen.findByText("人物谱牒");
    await waitFor(() => expect(screen.getAllByText("陆清远").length).toBeGreaterThan(0));
    expect(screen.getAllByText("顾文衡").length).toBeGreaterThan(0);
    expect(screen.getAllByText("王氏").length).toBeGreaterThan(0);
    expect(screen.getByText("来函线索与风宪留察")).toBeTruthy();
    expect(document.querySelector("[data-polish-evidence='s89-15-follow-up-reader']")).toBeTruthy();
    expect(document.querySelector("[data-polish-evidence-boundary='s89-15-follow-up-boundary']")).toBeTruthy();
    expect(screen.getByText("同年师友引荐拜会")).toBeTruthy();
    expect(screen.getByText("人情债月账解释")).toBeTruthy();
    expect(screen.getByText("廉政 留察名单 留痕")).toBeTruthy();
    expect(screen.getByText("月账与人情 · 人情债月账 · 已收呈待复核")).toBeTruthy();
    expect(screen.getByText("案牍与风宪 · 廉政留察 · 已呈报")).toBeTruthy();
    expect(screen.getByText("标记：关系风险留察")).toBeTruthy();
    expect(screen.getByText("关系网影响")).toBeTruthy();
    expect(screen.getAllByText("同年文社").length).toBeGreaterThan(0);
    expect(screen.getByText("地方士绅")).toBeTruthy();
    expect(screen.getByText("论道余波已作为同年文社公开压力留痕，仍不结算关系终局。")).toBeTruthy();
    expect(screen.getByText("人物关系行动 · 信任上升")).toBeTruthy();
    expect(screen.getByText("来函后续已作为地方人情公开压力留痕，不代表人情债已经落账。")).toBeTruthy();
    expect(screen.getByText("交游议题")).toBeTruthy();
    expect(screen.getByText("交游记录：沈砚秋论道")).toBeTruthy();
    expect(screen.getByText("沈砚秋论道已由主卷定夺，只作公开交游材料引用。")).toBeTruthy();
    expect(screen.getByText("交游记录 · 可跟进")).toBeTruthy();
    expect(screen.queryByText("不属于人物交游的议题")).toBeNull();
    expect(screen.queryByText("公开压力 2 项")).toBeNull();
    expect(screen.queryByText("provider-forged")).toBeNull();
    expect(screen.queryByText("world-entity-impact:polluted")).toBeNull();
    expect(screen.queryByText("WT-npc-rel-polluted")).toBeNull();
    expect(screen.queryByText("交游记录：/mnt/e/LSMNQ/.env")).toBeNull();
    expect(screen.queryByText("旁注 /home/zzz/project/.env 只应视作污染路径。")).toBeNull();
    expect(screen.queryByText("交游记录，/home/zzz/project/.env")).toBeNull();
    expect(screen.queryByText("旁注、/mnt/e/LSMNQ/.env 也应视作污染路径。")).toBeNull();
    expect(screen.queryByText("交游记录：draftContext schema manifest")).toBeNull();
    expect(screen.queryByText(/safe view|resolver|sourceRef|relatedRefs|scopeRefs/i)).toBeNull();
    expect(document.body.textContent || "").not.toMatch(/密钥私档顾问|完整提示词掌柜|本地路径女|隐藏私档密钥本地路径/);
    expect(document.body.textContent || "").not.toMatch(/human_debt_monthly|accepted_pending_server_resolution|integrity_watchlist|relationship_risk_watchlist|draftContext|schema|manifest|resolver|safe view|provider payload|\/mnt\/e\/LSMNQ|\/home\/zzz/i);
    expect(screen.getAllByRole("button", { name: "拟复核" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "拟跟进" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "拟跟进" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: expect.stringContaining("交游记录：沈砚秋论道")
    });
    fireEvent.click(screen.getAllByRole("button", { name: "拟复核" })[0]);
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: expect.stringContaining("案卷回批")
    });
    expect(fetchMock).toHaveBeenCalledWith("/assets/ui/ink-ui-runtime-manifest.json", expect.objectContaining({ headers: { Accept: "application/json" } }));

    const firstPageImages = screen.getAllByRole("img");
    expect(firstPageImages.every((image) => image.getAttribute("loading") === "lazy")).toBe(true);
    expect(document.querySelector(".peopleLedgerList")?.getAttribute("data-total-people")).toBe("4");
    expect(document.querySelectorAll("[data-polish-people-card='s89-9-portrait-material']").length).toBeGreaterThan(0);
    expect(document.querySelector(".peopleLedgerList")?.getAttribute("data-total-portraits")).toBeNull();
    expect(document.querySelector("[data-portrait-remastered='true']")).toBeTruthy();

    const zoomButton = screen.getAllByRole("button", { name: /查看.*高清立绘/ })[0];
    fireEvent.click(zoomButton);
    const viewer = await screen.findByRole("dialog", { name: "陆清远立绘" });
    expect(viewer.getAttribute("data-portrait-viewer")).toBe("true");
    expect(viewer.getAttribute("data-polish-portrait")).toBe("s89-8-life-scroll");
    expect(viewer.querySelector("[data-polish-profile='s89-6-portrait-life']")).toBeTruthy();
    expect(viewer.querySelector("[data-polish-cue='s89-9-portrait-cue-material']")).toBeTruthy();
    expect(within(viewer).getByRole("heading", { name: "外貌介绍" })).toBeTruthy();
    expect(within(viewer).getByRole("heading", { name: "生平介绍" })).toBeTruthy();
    expect(within(viewer).getByRole("heading", { name: "当前情况" })).toBeTruthy();
    expect(viewer.textContent || "").toContain("画卷题签");
    expect(viewer.textContent || "").toContain("画中所见");
    expect(viewer.textContent || "").toContain("衣饰");
    expect(viewer.textContent || "").toContain("神采");
    expect(viewer.textContent || "").toContain("观画印象");
    expect(viewer.textContent || "").toContain("身世线索据公开传略整理");
    expect(viewer.textContent || "").toContain("案主本局画像据已审阅画卷与公开身份整理");
    expect(viewer.textContent || "").toContain("案主当前以书生见于公开案卷；下一步读书、应考、任事或交游仍随主卷回批推进。");
    expect(screen.getByRole("img", { name: "陆清远立绘高清主图" }).getAttribute("src")).toBe("/assets/ui/portraits/portrait-test-female-1-v1.webp");
    expect(useUiStateStore.getState().activePortraitViewer).toMatchObject({
      portraitRef: "portrait-test-female-1-v1",
      label: "陆清远立绘",
      profile: expect.objectContaining({
        name: "陆清远",
        identity: expect.any(String),
        summary: expect.any(String),
        current: expect.any(String)
      })
    });
    expect(JSON.stringify(useUiStateStore.getState().activePortraitViewer)).not.toMatch(/hidden|provider|prompt|\/mnt\/|\/home\//i);
    expect(viewer.textContent || "").not.toMatch(/portraitRef|运行时|manifest|schema|draftContext|server adjudication|provider|raw|hidden|\/mnt\/|\/home\//i);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "陆清远立绘" })).toBeNull());
    expect(document.activeElement).toBe(zoomButton);

    act(() => useUiStateStore.getState().openSurface("npc-profile"));
    const npcProfileDialog = await screen.findByRole("dialog", { name: "人物档案" });
    expect(npcProfileDialog.textContent || "").not.toMatch(/密钥私档顾问|完整提示词掌柜|本地路径女|隐藏私档密钥本地路径/);
    const profileZoomButton = within(npcProfileDialog).getByRole("button", { name: "查看陆清远立绘高清立绘" });
    fireEvent.click(profileZoomButton);
    await screen.findByRole("dialog", { name: "陆清远立绘" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "陆清远立绘" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "人物档案" })).toBeTruthy();
    expect(document.activeElement).toBe(profileZoomButton);

    expect(document.body.textContent || "").not.toMatch(/prompt|provider payload|hiddenNotes|privateSignalTags|OPENAI_API_KEY|artifacts|data\/sessions|C:\\bad/i);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain("/api/game/turn");
  });

  it("does not render stale S88.7 follow-up evidence on a different people route", async () => {
    const staleSessionId = "11111111-1111-4111-8111-111111111111";
    const routeSessionId = "22222222-2222-4222-8222-222222222222";
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/npcs/${routeSessionId}?pageSize=50`) {
        return new Response(JSON.stringify({
          sessionId: routeSessionId,
          npcRosterView: { items: [] },
          npcInteractionView: { items: [] },
          delegatedTaskView: { items: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${routeSessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId: routeSessionId,
          worldState: { player: { name: "新案主", role: "scholar" } },
          npcRosterView: { items: [] },
          npcActiveRequestView: { items: [], followUpTasks: [], followUpEvidence: { counts: { total: 0 }, people: [], events: [], economy: [] } }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    useGameSessionStore.setState({
      currentSessionId: staleSessionId,
      currentSession: {
        sessionId: staleSessionId,
        worldState: { player: { name: "旧案主", role: "official" } },
        npcActiveRequestView: {
          followUpEvidence: {
            schemaVersion: "s88.7-npc-active-request-follow-up-evidence.v1",
            counts: { total: 1 },
            people: [{
              evidenceId: "npc-follow-up-evidence:stale",
              evidenceKindLabel: "引荐拜会",
              title: "跨案卷来函线索",
              publicSummary: "此线索属于另一个案卷，不应在当前人物页出现。",
              statusLabel: "待复核",
              npc: { displayName: "旧案 NPC" }
            }]
          }
        },
        economyTraceView: {
          schemaVersion: "s88.8-economy-trace.v1",
          traceItems: [{
            traceId: "stale-people-trade",
            traceType: "trade_negotiation",
            title: "旧案交易解释",
            publicSummary: "此解释属于另一个案卷，不应在当前人物页出现。",
            groupLabel: "交易议价",
            statusLabel: "可阅"
          }]
        },
        worldThreadView: {
          activeThreads: [{
            id: "WT-stale-npc-rel",
            sourceType: "npc_relationship_action",
            sourceLabel: "交游记录",
            title: "跨案卷交游议题",
            summary: "此议题属于另一个案卷，不应在当前人物页出现。"
          }]
        }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"],
      status: "ready"
    });

    renderRoute(`/game/${routeSessionId}/people`);

    await screen.findByRole("heading", { name: "人物" });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url) === `/api/game/npcs/${routeSessionId}?pageSize=50`)).toBe(true));
    expect(screen.queryByText("跨案卷来函线索")).toBeNull();
    expect(screen.queryByText("旧案交易解释")).toBeNull();
    expect(screen.queryByText("跨案卷交游议题")).toBeNull();
    expect(screen.queryByRole("button", { name: "拟复核" })).toBeNull();
    expect(screen.queryByRole("button", { name: "拟跟进" })).toBeNull();
  });

  it("does not render stale S88.9 NPC workbench results on another people route", async () => {
    const staleSessionId = "12121212-1212-4212-8212-121212121212";
    const routeSessionId = "34343434-3434-4434-8434-343434343434";
    const routeNpc = {
      npcId: "npc-new-aide",
      displayName: "新案幕友",
      tier: "county",
      roleTags: ["幕友"],
      stageTags: ["县署"],
      portraitRef: null,
      publicProfile: { title: "县署幕友", summary: "新案可见人物。" },
      relationshipSummary: { labels: ["同僚"] },
      availableInteractions: ["talk", "trade", "command"]
    };
    const routeNpcDetail = {
      ...routeNpc,
      relationship: routeNpc.relationshipSummary,
      relationshipActionEligibilityView: {
        actions: [{
          actionType: "request",
          label: "请托",
          requestLabel: "呈请礼法裁决",
          available: true
        }]
      }
    };
    const routePayload = {
      source: "server_player_visible_state_projection",
      sessionId: routeSessionId,
      worldState: { player: { name: "新案主", role: "magistrate" } },
      worldPeopleView: { npcs: [], relationships: [] },
      npcRosterView: { items: [routeNpc] },
      npcInteractionView: { items: [] },
      tradeLedgerView: { items: [] },
      delegatedTaskView: { items: [] },
      npcActiveRequestView: { items: [], followUpTasks: [], followUpEvidence: { counts: { total: 0 }, people: [], events: [], economy: [] } }
    };
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = String(url);
      if (requestUrl === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/player-state/${routeSessionId}`) {
        return new Response(JSON.stringify(routePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/npcs/${routeSessionId}?pageSize=50`) {
        return new Response(JSON.stringify({
          sessionId: routeSessionId,
          npcRosterView: { items: [routeNpc] },
          npcInteractionView: { items: [] },
          delegatedTaskView: { items: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/npc/${routeSessionId}/${routeNpc.npcId}`) {
        return new Response(JSON.stringify({
          sessionId: routeSessionId,
          npcDetailView: routeNpcDetail,
          npcInteractionView: { items: [] },
          tradeLedgerView: { items: [] },
          delegatedTaskView: { items: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/ai/quick-actions/${routeSessionId}`) {
        return new Response(JSON.stringify({
          schemaVersion: "s75.9-quick-actions.v1",
          sessionId: routeSessionId,
          source: "mock-ai",
          status: "ready",
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${requestUrl}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${routeSessionId}/people`);

    await screen.findByText("人物谱牒");
    await waitFor(() => expect(screen.getAllByText("新案幕友").length).toBeGreaterThan(0));
    await waitFor(() => expect(useGameSessionStore.getState().npcDetail?.sessionId).toBe(routeSessionId));

    act(() => useGameSessionStore.setState({
      currentSessionId: staleSessionId,
      currentSession: routePayload as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"],
      npcRoster: {
        sessionId: staleSessionId,
        npcRosterView: { items: [] },
        npcInteractionView: {
          items: [{
            recordId: "stale-roster-dialogue",
            actionType: "talk",
            serverStatus: "accepted",
            dialogueText: "旧案名册记录"
          }]
        },
        delegatedTaskView: {
          items: [{
            taskId: "stale-roster-task",
            title: "旧案名册委派",
            status: "active",
            assignee: { displayName: "旧案差役" }
          }]
        }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["npcRoster"],
      npcDetail: {
        sessionId: routeSessionId,
        npcDetailView: routeNpcDetail,
        tradeLedgerView: { items: [] }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["npcDetail"],
      lastNpcInteraction: {
        sessionId: staleSessionId,
        accepted: true,
        npcDialogueView: { dialogueText: "旧案对话结果", mood: "旧案心绪" },
        npcActionResolutionView: { actionLabel: "旧案礼法", outcomeSummary: "旧案礼法结果" },
        npcInteractionView: { items: [] }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["lastNpcInteraction"],
      lastTrade: {
        sessionId: staleSessionId,
        accepted: true,
        tradeRecord: {
          tradeId: "stale-trade",
          status: "accepted",
          publicSummary: "旧案交易结果"
        },
        tradeLedgerView: { items: [] }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["lastTrade"],
      lastNpcCommand: {
        sessionId: staleSessionId,
        accepted: true,
        delegatedTaskPlanView: { planSummary: "旧案委派计划" },
        delegatedTaskView: { items: [] }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["lastNpcCommand"],
      error: "旧案错误不应显示",
      npcRosterStatus: "ready",
      npcDetailStatus: "ready",
      npcMutationStatus: "ready",
      status: "ready"
    }));

    for (const tab of ["对话", "交易", "委派", "礼法", "记录"]) {
      fireEvent.click(screen.getByRole("button", { name: tab }));
      expect(document.body.textContent || "").not.toMatch(/旧案对话结果|旧案交易结果|旧案委派计划|旧案礼法结果|旧案错误|旧案名册记录|旧案名册委派/);
    }

    act(() => useGameSessionStore.setState({
      currentSessionId: routeSessionId,
      lastNpcInteraction: {
        sessionId: routeSessionId,
        accepted: true,
        npcDialogueView: { npcId: "npc-other-aide", dialogueText: "同案别人的对话结果", mood: "别处心绪" },
        npcActionResolutionView: { actionLabel: "同案别人的礼法", outcomeSummary: "同案别人的礼法结果" },
        npcInteractionView: { items: [] }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["lastNpcInteraction"],
      lastTrade: {
        sessionId: routeSessionId,
        accepted: true,
        tradeRecord: {
          tradeId: "other-trade",
          npcId: "npc-other-aide",
          actorBId: "npc-other-aide",
          status: "accepted",
          publicSummary: "同案别人的交易结果"
        },
        tradeLedgerView: { items: [] }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["lastTrade"],
      lastNpcCommand: {
        sessionId: routeSessionId,
        accepted: true,
        delegatedTaskPlanView: { planSummary: "同案别人的委派计划" },
        delegatedTaskView: { items: [{ assignee: { npcId: "npc-other-aide" } }] }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["lastNpcCommand"],
      error: null,
      npcMutationStatus: "ready"
    }));

    for (const tab of ["对话", "交易", "委派", "礼法"]) {
      fireEvent.click(screen.getByRole("button", { name: tab }));
      expect(document.body.textContent || "").not.toMatch(/同案别人的对话结果|同案别人的交易结果|同案别人的委派计划|同案别人的礼法结果/);
    }
  });

  it("keeps the current NPC dialogue draft when an older same-session NPC reply returns", async () => {
    const sessionId = "68686868-6868-4686-8686-686868686868";
    const firstNpc = {
      npcId: "npc:magistrate:bailiff-zhou",
      displayName: "周快手",
      publicProfile: { title: "捕快", summary: "在县署听差。" },
      roleTags: ["yamen"],
      stageTags: ["office"],
      availableInteractions: ["talk"]
    };
    const secondNpc = {
      npcId: "npc:magistrate:clerk-han",
      displayName: "韩主簿",
      publicProfile: { title: "主簿", summary: "掌县中簿册。" },
      roleTags: ["office"],
      stageTags: ["yamen"],
      availableInteractions: ["talk"]
    };
    const rosterView = { items: [firstNpc, secondNpc] };
    const playerPayload = {
      source: "server_player_visible_state_projection",
      sessionId,
      worldState: { player: { name: "陆县令", role: "magistrate" } },
      worldPeopleView: { npcs: [], relationships: [] },
      npcRosterView: rosterView,
      npcInteractionView: { items: [] },
      tradeLedgerView: { items: [] },
      delegatedTaskView: { items: [] },
      npcActiveRequestView: { items: [], followUpTasks: [], followUpEvidence: { counts: { total: 0 }, people: [], events: [], economy: [] } }
    };
    const firstInteraction = deferredResponse();
    const secondInteraction = deferredResponse();
    let npcInteractionRequestCount = 0;
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify(playerPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/npcs/${sessionId}?pageSize=50`) {
        return new Response(JSON.stringify({
          sessionId,
          npcRosterView: rosterView,
          npcInteractionView: { items: [] },
          delegatedTaskView: { items: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (
        requestUrl === `/api/game/npc/${sessionId}/${encodeURIComponent(firstNpc.npcId)}` ||
        requestUrl === `/api/game/npc/${sessionId}/${encodeURIComponent(secondNpc.npcId)}`
      ) {
        const npc = requestUrl.endsWith(encodeURIComponent(firstNpc.npcId)) ? firstNpc : secondNpc;
        return new Response(JSON.stringify({
          sessionId,
          npcDetailView: {
            npcId: npc.npcId,
            displayName: npc.displayName,
            publicProfile: npc.publicProfile
          },
          npcInteractionView: { items: [] },
          tradeLedgerView: { items: [] },
          delegatedTaskView: { items: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/npc-interaction/${sessionId}` && options?.method === "POST") {
        npcInteractionRequestCount += 1;
        expect(JSON.parse(String(options.body))).toMatchObject({
          npcId: firstNpc.npcId,
          actionType: "talk"
        });
        return npcInteractionRequestCount === 1 ? firstInteraction.response : secondInteraction.response;
      }
      if (requestUrl === `/api/ai/quick-actions/${sessionId}`) {
        return new Response(JSON.stringify({
          schemaVersion: "s75.9-quick-actions.v1",
          sessionId,
          source: "mock-ai",
          status: "ready",
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${requestUrl}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/people`);

    await screen.findByRole("button", { name: /周快手/ });
    fireEvent.click(screen.getByRole("button", { name: "对话" }));
    fireEvent.change(screen.getByLabelText("对话"), { target: { value: "先问城中治安。" } });
    fireEvent.click(screen.getByRole("button", { name: "问话" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url) === `/api/game/npc-interaction/${sessionId}`)).toBe(true));
    fireEvent.change(screen.getByLabelText("对话"), { target: { value: "续问巡捕名册。" } });

    await act(async () => {
      firstInteraction.resolvePayload({
        sessionId,
        accepted: true,
        npcDialogueView: {
          npcId: firstNpc.npcId,
          dialogueText: "周快手回报第一问。",
          mood: "谨慎"
        },
        npcInteractionView: {
          items: [{
            recordId: "npc-interaction:first",
            npcId: firstNpc.npcId,
            npcName: firstNpc.displayName,
            actionType: "talk",
            dialogueText: "周快手回报第一问。"
          }]
        }
      });
    });
    await waitFor(() => {
      expect((screen.getByLabelText("对话") as HTMLTextAreaElement).value).toBe("续问巡捕名册。");
    });

    fireEvent.click(screen.getByRole("button", { name: "问话" }));
    await waitFor(() => expect(npcInteractionRequestCount).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: /韩主簿/ }));
    fireEvent.click(screen.getByRole("button", { name: "对话" }));
    fireEvent.change(screen.getByLabelText("对话"), { target: { value: "再问粮册底稿。" } });

    await act(async () => {
      secondInteraction.resolvePayload({
        sessionId,
        accepted: true,
        npcDialogueView: {
          npcId: firstNpc.npcId,
          dialogueText: "周快手回报第二问。",
          mood: "谨慎"
        },
        npcInteractionView: {
          items: [{
            recordId: "npc-interaction:second",
            npcId: firstNpc.npcId,
            npcName: firstNpc.displayName,
            actionType: "talk",
            dialogueText: "周快手回报第二问。"
          }]
        }
      });
    });

    await waitFor(() => {
      expect((screen.getByLabelText("对话") as HTMLTextAreaElement).value).toBe("再问粮册底稿。");
    });
    expect(document.body.textContent || "").not.toMatch(/周快手回报第二问/);
  });

  it("renders S88.8 economy trace in the people trade and delegation workspace", async () => {
    const sessionId = "77777777-7777-4777-8777-777777777777";
    const economyTraceView = {
      schemaVersion: "s88.8-economy-trace.v1",
      summary: "已整理3条人物交易、委派与月账解释。",
      traceItems: [
        {
          traceId: "people-trade:safe",
          traceType: "trade_negotiation",
          groupLabel: "trade_negotiation",
          title: "韩员外交易议价",
          publicSummary: "议买纸张与粮价消息，尚待服务器确认。",
          statusLabel: "under_review",
          affectedLabels: ["韩员外"],
          amountView: { label: "议价银两", delta: -4, unit: "两" },
          nextStep: "交易仍需后续服务器结算路径确认，不视为已经成交。"
        },
        {
          traceId: "people-task:safe",
          traceType: "delegated_task_budget",
          groupLabel: "委派回禀",
          title: "东乡清丈委派",
          publicSummary: "陆知事承办中；预算、成败和关系影响由服务器裁决。",
          statusLabel: "待办",
          affectedLabels: ["陆知事"],
          nextStep: "等待到期月结；提前更改任务需另写行动草稿。"
        },
        {
          traceId: "people-market:safe",
          traceType: "market_price_signal",
          groupLabel: "月账线索",
          title: "纸价小涨",
          publicSummary: "县城纸价略紧，可作为交易议价材料。",
          statusLabel: "上涨",
          affectedLabels: ["纸张"],
          nextStep: "市价只作为交易、维护和叙事裁决材料；前端不得自行成交。"
        },
        {
          traceId: "people-resource:not-shown",
          traceType: "resource_snapshot",
          groupLabel: "资源变化",
          title: "银两账面",
          publicSummary: "人物页本片不展示纯资源快照。"
        },
        {
          traceId: "people-polluted",
          traceType: "trade_negotiation",
          groupLabel: "交易议价",
          title: "污染交易解释",
          publicSummary: "privateSignalTags provider payload data/sessions sk-test-secret draftContext schema manifest resolver safe view /home/user/.env",
          statusLabel: "可阅"
        }
      ]
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId,
          worldState: { player: { name: "清丈知县", role: "magistrate" } },
          worldPeopleView: { npcs: [], relationships: [] },
          npcRosterView: { items: [] },
          npcActiveRequestView: { items: [], followUpTasks: [], followUpEvidence: { counts: { total: 0 }, people: [], events: [], economy: [] } },
          economyTraceView
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/people`);

    await screen.findByRole("heading", { name: "人物" });
    const peopleTraceHeading = await screen.findByText("交易委派账本为何变化");
    const peopleTraceSection = within(peopleTraceHeading.closest("section") as HTMLElement);
    expect(peopleTraceSection.getByText("韩员外交易议价")).toBeTruthy();
    expect(peopleTraceSection.getByText("东乡清丈委派")).toBeTruthy();
    expect(peopleTraceSection.getByText("纸价小涨")).toBeTruthy();
    expect(peopleTraceSection.getByText("交易议价 · 待复核")).toBeTruthy();
    expect(peopleTraceSection.queryByText("银两账面")).toBeNull();
    expect(peopleTraceSection.queryByText("污染交易解释")).toBeNull();
    expect(peopleTraceSection.queryByText(/provider payload|privateSignalTags|data\/sessions|sk-test-secret|draftContext|schema|manifest|resolver|safe view|\/home\/user/i)).toBeNull();
    expect(peopleTraceSection.queryByText(/trade_negotiation|under_review/)).toBeNull();
    expect(document.querySelector("[data-polish-evidence='s89-15-economy-reader']")).toBeTruthy();
    expect(document.querySelector("[data-polish-evidence-boundary='s89-15-economy-boundary']")).toBeTruthy();
    expect(peopleTraceSection.getByText("3 条")).toBeTruthy();
    expect(peopleTraceSection.getAllByRole("button", { name: "拟复核" })).toHaveLength(3);
    fireEvent.click(peopleTraceSection.getAllByRole("button", { name: "拟复核" })[0]);
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: expect.stringContaining("案卷回批")
    });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain("/api/game/turn");
  });

  it("renders S88.8 inventory economy trace from safe server projections", async () => {
    const sessionId = "33333333-3333-4333-8333-333333333333";
    const inventoryView = {
      containers: [
        { containerId: "bag", label: "书箧", currentWeight: 1, capacityWeight: 10 },
        { containerId: "store", label: "县署库房", currentWeight: 0, capacityWeight: 20 }
      ],
      items: [
        {
          itemId: "item:ledger",
          name: "清丈册",
          category: "文书",
          condition: "需修补",
          durability: 72,
          transferPolicy: "tradeable",
          legalStatus: "ordinary",
          containerId: "bag",
          quantity: 1,
          unit: "册"
        }
      ],
      importantCredentials: [],
      authorityBoundary: "囊箧、仓库、器物、绑定凭证和转移结果由服务器裁决；未公开 hidden/raw 字段；draftContext manifest schema C:\\secret\\inventory.json /home/user/.env。"
    };
    const resourceLedgerView = {
      accounts: [{ accountId: "resource:silver", resourceId: "silver_liang", label: "银两", amount: 68, unit: "两" }]
    };
    const assetLedgerView = {
      assets: [{ assetId: "asset:estate", name: "东乡薄田", assetType: "estate", typeLabel: "田产", condition: "可用" }]
    };
    const economyTraceView = {
      schemaVersion: "s88.8-economy-trace.v1",
      summary: "已整理3条资源、资产、交易、委派与月账解释。",
      traceItems: [
        {
          traceId: "trade:safe",
          traceType: "trade_negotiation",
          groupLabel: "交易议价",
          title: "交易议价留痕",
          publicSummary: "议买纸张与粮价消息，尚待服务器确认。",
          statusLabel: "待复议",
          affectedLabels: ["韩员外"],
          amountView: { label: "议价银两", delta: -4, unit: "两" },
          nextStep: "交易仍需后续服务器结算路径确认，不视为已经成交。"
        },
        {
          traceId: "task:safe",
          traceType: "delegated_task_result",
          groupLabel: "委派回禀",
          title: "委派回禀",
          publicSummary: "东乡鱼鳞册已核出两处错漏。",
          statusLabel: "已办成",
          affectedLabels: ["陆知事"],
          nextStep: "查看回禀后可拟复核、奖惩或重派，仍由服务器裁决。"
        },
        {
          traceId: "monthly:safe",
          traceType: "human_debt_monthly",
          groupLabel: "月账线索",
          title: "人情债月账",
          publicSummary: "韩员外因修桥垫付，公开人情债略增。",
          statusLabel: "已登记",
          affectedLabels: ["月账"],
          nextStep: "月账只作公开解释；资源、人情债、交易和关系仍由服务器后续裁决。"
        },
        {
          traceId: "polluted:1",
          traceType: "resource_delta",
          groupLabel: "资源变化",
          title: "污染账目",
          publicSummary: "表面安全",
          statusLabel: "可阅",
          affectedLabels: ["privateSignalTags"]
        },
        {
          traceId: "polluted:2",
          traceType: "resource_delta",
          groupLabel: "资源变化",
          title: "provider payload hiddenNotes data/sessions",
          publicSummary: "sk-test-secret"
        }
      ]
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId,
          worldState: { player: { name: "清丈知县", role: "magistrate" } },
          inventoryView,
          resourceLedgerView,
          assetLedgerView,
          economyTraceView
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/inventory/${sessionId}`) {
        return new Response(JSON.stringify({
          sessionId,
          inventoryView,
          resourceLedgerView,
          assetLedgerView,
          economyTraceView
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/inventory`);

    await screen.findByRole("heading", { name: "囊箧" });
    expect(document.querySelector(".sessionRouteShell")).toBeTruthy();
    expect(document.querySelector(".gameMainDeck")).toBeFalsy();
    expect(document.querySelector(".memorialComposer")).toBeFalsy();
    const inventoryTraceHeading = await screen.findByText("账本为何变化");
    const inventoryTraceSection = within(inventoryTraceHeading.closest("section") as HTMLElement);
    expect(inventoryTraceSection.getByText("交易议价留痕")).toBeTruthy();
    expect(inventoryTraceSection.getByText("委派回禀")).toBeTruthy();
    expect(inventoryTraceSection.getByText("人情债月账")).toBeTruthy();
    expect(inventoryTraceSection.getByText("3 条")).toBeTruthy();
    expect(inventoryTraceSection.queryByText("污染账目")).toBeNull();
    expect(inventoryTraceSection.queryByText(/provider payload|hiddenNotes|data\/sessions|privateSignalTags|sk-test-secret/i)).toBeNull();
    expect(document.body.textContent || "").toContain("囊箧、仓库、器物、账约、绑定凭证和移转结果均候案卷回批复核。");
    expect(document.body.textContent || "").not.toMatch(/hidden\/raw|hidden\b|raw\b|服务器裁决|draftContext|manifest|schema|C:\\secret|\/home\/user/i);
    expect(inventoryTraceSection.getAllByRole("button", { name: "拟复核" })).toHaveLength(3);
    fireEvent.click(inventoryTraceSection.getAllByRole("button", { name: "拟复核" })[0]);
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: expect.stringContaining("案卷回批")
    });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain("/api/game/turn");
  });

  it("does not render stale S88.8 economy trace on another inventory route", async () => {
    const staleSessionId = "33333333-3333-4333-8333-333333333333";
    const routeSessionId = "44444444-4444-4444-8444-444444444444";
    const emptyInventoryView = { containers: [], items: [], importantCredentials: [] };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${routeSessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId: routeSessionId,
          worldState: { player: { name: "新案主", role: "scholar" } },
          inventoryView: emptyInventoryView,
          resourceLedgerView: { accounts: [] },
          assetLedgerView: { assets: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/inventory/${routeSessionId}`) {
        return new Response(JSON.stringify({
          sessionId: routeSessionId,
          inventoryView: emptyInventoryView,
          resourceLedgerView: { accounts: [] },
          assetLedgerView: { assets: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/ai/quick-actions/${routeSessionId}`) {
        return new Response(JSON.stringify({
          schemaVersion: "s75.9-quick-actions.v1",
          sessionId: routeSessionId,
          source: "mock-ai",
          status: "ready",
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    useGameSessionStore.setState({
      currentSessionId: staleSessionId,
      currentSession: {
        sessionId: staleSessionId,
        worldState: { player: { name: "旧案主", role: "official" } },
        inventoryView: emptyInventoryView,
        resourceLedgerView: { accounts: [] },
        assetLedgerView: { assets: [] },
        economyTraceView: {
          schemaVersion: "s88.8-economy-trace.v1",
          traceItems: [{
            traceId: "stale",
            title: "旧案经济解释",
            publicSummary: "此解释属于另一个案卷。",
            groupLabel: "月账线索",
            statusLabel: "可阅"
          }]
        }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"],
      inventory: {
        sessionId: staleSessionId,
        inventoryView: emptyInventoryView,
        economyTraceView: {
          traceItems: [{
            traceId: "stale-inventory",
            title: "旧案账本为何变化",
            publicSummary: "旧案库存解释。",
            groupLabel: "月账线索",
            statusLabel: "可阅"
          }]
        }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["inventory"],
      status: "ready"
    });

    renderRoute(`/game/${routeSessionId}/inventory`);

    await screen.findByRole("heading", { name: "囊箧" });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url) === `/api/game/inventory/${routeSessionId}`)).toBe(true));
    expect(screen.queryByText("旧案经济解释")).toBeNull();
    expect(screen.queryByText("旧案账本为何变化")).toBeNull();
    expect(screen.queryByRole("button", { name: "拟复核" })).toBeNull();
  });

  it("resets S88.9 inventory local selection and transfer notices across session routes", async () => {
    const firstSessionId = "56565656-5656-4656-8656-565656565656";
    const secondSessionId = "78787878-7878-4787-8787-787878787878";
    const firstInventoryView = {
      containers: [
        { containerId: "first-box", label: "旧案书箧", currentWeight: 1, capacityWeight: 10 },
        { containerId: "first-target", label: "旧案库房", currentWeight: 0, capacityWeight: 20 }
      ],
      items: [{
        itemId: "first-item",
        name: "旧案清册",
        category: "文书",
        condition: "完整",
        transferPolicy: "tradeable",
        legalStatus: "ordinary",
        containerId: "first-box",
        quantity: 1,
        unit: "册"
      }],
      importantCredentials: []
    };
    const firstTransferredInventoryView = {
      ...firstInventoryView,
      items: firstInventoryView.items.map((item) => ({ ...item, containerId: "first-target" }))
    };
    const secondInventoryView = {
      containers: [
        { containerId: "second-box", label: "新案书箧", currentWeight: 1, capacityWeight: 10 },
        { containerId: "second-target", label: "新案库房", currentWeight: 0, capacityWeight: 20 }
      ],
      items: [{
        itemId: "second-item",
        name: "新案清册",
        category: "文书",
        condition: "完整",
        transferPolicy: "tradeable",
        legalStatus: "ordinary",
        containerId: "second-box",
        quantity: 1,
        unit: "册"
      }],
      importantCredentials: []
    };
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/player-state/${firstSessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId: firstSessionId,
          worldState: { player: { name: "旧案主", role: "magistrate" } },
          inventoryView: firstInventoryView,
          resourceLedgerView: { accounts: [] },
          assetLedgerView: { assets: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/player-state/${secondSessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId: secondSessionId,
          worldState: { player: { name: "新案主", role: "magistrate" } },
          inventoryView: secondInventoryView,
          resourceLedgerView: { accounts: [] },
          assetLedgerView: { assets: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/inventory/${firstSessionId}`) {
        return new Response(JSON.stringify({
          sessionId: firstSessionId,
          inventoryView: firstInventoryView,
          resourceLedgerView: { accounts: [] },
          assetLedgerView: { assets: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/inventory/${secondSessionId}`) {
        return new Response(JSON.stringify({
          sessionId: secondSessionId,
          inventoryView: secondInventoryView,
          resourceLedgerView: { accounts: [] },
          assetLedgerView: { assets: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/inventory-transfer/${firstSessionId}` && options?.method === "POST") {
        return new Response(JSON.stringify({
          sessionId: firstSessionId,
          accepted: true,
          inventoryView: firstTransferredInventoryView
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/ai/quick-actions/${firstSessionId}` || requestUrl === `/api/ai/quick-actions/${secondSessionId}`) {
        const responseSessionId = requestUrl.endsWith(firstSessionId) ? firstSessionId : secondSessionId;
        return new Response(JSON.stringify({
          schemaVersion: "s75.9-quick-actions.v1",
          sessionId: responseSessionId,
          source: "mock-ai",
          status: "ready",
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${requestUrl}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const router = createMemoryRouter(routes, { initialEntries: [`/game/${firstSessionId}/inventory`] });
    render(<RouterProvider router={router} />);

    await screen.findByText("旧案清册");
    const transferButton = screen.getByRole("button", { name: "呈请移置" });
    await waitFor(() => expect(transferButton).toHaveProperty("disabled", false));
    fireEvent.click(transferButton);
    await screen.findByText("案卷已复核并更新物件位置。");

    await act(async () => {
      await router.navigate(`/game/${secondSessionId}/inventory`);
    });

    await screen.findByText("新案清册");
    await waitFor(() => expect(useGameSessionStore.getState().inventory?.sessionId).toBe(secondSessionId));
    expect(document.body.textContent || "").not.toMatch(/旧案清册|旧案书箧|旧案库房|案卷已复核并更新物件位置。|未入容器/);
  });

  it("keeps S88.9 inventory transfer selections when an older same-session response returns", async () => {
    const sessionId = "91919191-9191-4919-8919-919191919191";
    const inventoryView = {
      containers: [
        { containerId: "desk-box", label: "书案小箧", currentWeight: 2, capacityWeight: 10 },
        { containerId: "archive-chest", label: "文库木柜", currentWeight: 1, capacityWeight: 20 },
        { containerId: "side-box", label: "侧房竹箱", currentWeight: 1, capacityWeight: 12 }
      ],
      items: [
        {
          itemId: "draft-item",
          name: "待移旧稿",
          category: "文书",
          condition: "可阅",
          transferPolicy: "tradeable",
          legalStatus: "ordinary",
          containerId: "desk-box",
          quantity: 1,
          unit: "册"
        },
        {
          itemId: "receipt-item",
          name: "待选收据",
          category: "凭据",
          condition: "完整",
          transferPolicy: "tradeable",
          legalStatus: "ordinary",
          containerId: "side-box",
          quantity: 1,
          unit: "张"
        }
      ],
      importantCredentials: []
    };
    const transferredInventoryView = {
      ...inventoryView,
      items: inventoryView.items.map((item) => (
        item.itemId === "draft-item" ? { ...item, containerId: "archive-chest" } : item
      ))
    };
    const transferDeferred = deferredResponse<{
      sessionId: string;
      accepted: boolean;
      inventoryView: typeof inventoryView;
    }>();
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify({
          source: "server_player_visible_state_projection",
          sessionId,
          worldState: { player: { name: "林慎", role: "magistrate" } },
          inventoryView,
          resourceLedgerView: { accounts: [] },
          assetLedgerView: { assets: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/inventory/${sessionId}`) {
        return new Response(JSON.stringify({
          sessionId,
          inventoryView,
          resourceLedgerView: { accounts: [] },
          assetLedgerView: { assets: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (requestUrl === `/api/game/inventory-transfer/${sessionId}` && options?.method === "POST") {
        return transferDeferred.response;
      }
      if (requestUrl === `/api/ai/quick-actions/${sessionId}`) {
        return new Response(JSON.stringify({
          schemaVersion: "s75.9-quick-actions.v1",
          sessionId,
          source: "mock-ai",
          status: "ready",
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${requestUrl}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/inventory`);

    await screen.findByText("待移旧稿");
    const transferButton = screen.getByRole("button", { name: "呈请移置" });
    await waitFor(() => expect(transferButton).toHaveProperty("disabled", false));
    const itemSelect = screen.getByLabelText("物件") as HTMLSelectElement;
    const targetSelect = screen.getByLabelText("去处") as HTMLSelectElement;
    expect(itemSelect.value).toBe("draft-item");
    expect(targetSelect.value).toBe("archive-chest");

    fireEvent.click(transferButton);
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => (
      String(url) === `/api/game/inventory-transfer/${sessionId}` && (options as RequestInit | undefined)?.method === "POST"
    ))).toBe(true));
    fireEvent.change(itemSelect, { target: { value: "receipt-item" } });
    fireEvent.change(targetSelect, { target: { value: "desk-box" } });
    expect((screen.getByLabelText("物件") as HTMLSelectElement).value).toBe("receipt-item");
    expect((screen.getByLabelText("去处") as HTMLSelectElement).value).toBe("desk-box");

    transferDeferred.resolvePayload({
      sessionId,
      accepted: true,
      inventoryView: transferredInventoryView
    });
    await waitFor(() => expect(useGameSessionStore.getState().inventory?.inventoryView.items.find((item) => item.itemId === "draft-item")?.containerId).toBe("archive-chest"));
    expect((screen.getByLabelText("物件") as HTMLSelectElement).value).toBe("receipt-item");
    expect((screen.getByLabelText("去处") as HTMLSelectElement).value).toBe("desk-box");
    expect(screen.queryByText("案卷已复核并更新物件位置。")).toBeNull();
  });

  it("caps the S76.10 people ledger at eighty public rows with the player first", async () => {
    const sessionId = "55555555-5555-4555-8555-555555555556";
    const payload = {
      source: "server_player_visible_state_projection",
      sessionId,
      worldState: {
        player: {
          name: "陆清远",
          role: "scholar",
          portraitRef: "portrait-test-female-1-v1"
        }
      },
      worldPeopleView: {
        schemaVersion: 1,
        generatedAtTurn: 1,
        npcs: Array.from({ length: 80 }, (_, index) => ({
          id: `C${String(index + 1).padStart(2, "0")}`,
          name: `同窗${index + 1}`,
          rankLabel: "同年士子",
          genderLabel: index % 2 === 0 ? "男" : "女",
          visibility: "public",
          knownToPlayer: true,
          publicSummary: `同窗${index + 1}为公开相识人物。`
        })),
        relationships: []
      }
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${sessionId}`) {
        return new Response(JSON.stringify(payload), {
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
          quickActionSuggestions: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute(`/game/${sessionId}/people`);

    await screen.findByText("人物谱牒");
    await waitFor(() => expect(document.querySelector(".peopleLedgerList")?.getAttribute("data-total-people")).toBe("80"));
    expect(document.querySelector(".peopleLedgerList")?.getAttribute("data-visible-people")).toBe("8");
    expect(document.querySelector("[data-person-kind='player']")).toBeTruthy();
    expect(screen.queryByText("同窗80")).toBeNull();
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

  it("does not render stale main-shell session data on a different game route", async () => {
    const staleSessionId = "77777777-7777-4777-8777-777777777777";
    const routeSessionId = "88888888-8888-4888-8888-888888888888";
    const stalePayload = {
      source: "server_player_visible_state_projection",
      sessionId: staleSessionId,
      narrative: "旧案叙事不应出现在新路由。",
      worldState: {
        player: {
          name: "旧案主",
          role: "official",
          officeTitle: "旧案官职"
        }
      },
      roleCycleView: {
        currentRole: {
          roleLabel: "旧案循环",
          items: [{ title: "旧案事务", publicSummary: "旧案材料。" }]
        }
      },
      informationPanelPageView: { page: 1 },
      inventoryView: { containers: [], items: [], importantCredentials: [] }
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/assets/ui/ink-ui-runtime-manifest.json") {
        return new Response(JSON.stringify(buildMockAssetManifest(0)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === `/api/game/player-state/${routeSessionId}`) {
        return new Response(JSON.stringify(stalePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    useGameSessionStore.setState({
      currentSessionId: staleSessionId,
      currentSession: stalePayload as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"],
      lastTurn: {
        sessionId: staleSessionId,
        narrative: "旧案回合叙事",
        worldState: { player: { name: "旧案主", role: "official" } }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["lastTurn"],
      error: "旧案错误不应显示",
      status: "ready"
    });
    useUiStateStore.getState().syncSessionPayload(stalePayload as never, "player-state");
    useUiStateStore.getState().setActionDraft({
      source: "role-surface",
      targetPage: "game",
      text: "旧案草稿不应带入新案。",
      draftContext: {
        surfaceId: "court-debate",
        draftKind: "court_response",
        evidenceRefs: ["evidence:events:stale-draft"],
        canonicalEchoRefs: ["domainConsequenceEcho:stale"],
        generatedAtTurn: 3,
        status: "client_hint"
      }
    });

    renderRoute(`/game/${routeSessionId}`);

    expect(screen.getByRole("heading", { name: "主卷" })).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/旧案主|旧案官职|旧案叙事|旧案回合叙事|旧案事务|旧案错误/);
    expect(screen.getByRole("link", { name: "主卷" }).getAttribute("href")).toBe(`/game/${routeSessionId}`);

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url) === `/api/game/player-state/${routeSessionId}`)).toBe(true));
    await waitFor(() => expect(useGameSessionStore.getState().status).toBe("error"));

    expect(document.body.textContent || "").not.toMatch(/旧案主|旧案官职|旧案叙事|旧案回合叙事|旧案事务|旧案错误/);
    expect(useUiStateStore.getState().currentPlayerPayload).toBeNull();
    expect(useUiStateStore.getState().actionDraft).toBeNull();
    expect(screen.getByLabelText("本回合行动")).toHaveProperty("value", "");
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain("/api/game/turn");
  });

  it("renders the S88.5 six-role matrix from the safe role cycle view", () => {
    const fetchMock = mockAssetManifestFetch();
    const sessionId = "s74-preview";
    const inactiveSummary = "详细案源只在对应身份的安全视野中展开。";
    const roleMatrix = [
      { role: "scholar", roleLabel: "书生", authorityTier: "T1", loopLabel: "读书日课与科期", statusLabel: "待任后展开", summary: inactiveSummary, sourceViews: ["studyProfileView", "examCalendarView"], enabled: false, itemCount: 0, pressureScore: 0 },
      { role: "magistrate", roleLabel: "地方官", authorityTier: "T3", loopLabel: "案牍钱粮与地方治理", statusLabel: "待任后展开", summary: inactiveSummary, sourceViews: ["localAffairsDocketView", "marketPriceView"], enabled: false, itemCount: 0, pressureScore: 0 },
      { role: "official", roleLabel: "入仕官员", authorityTier: "T3", loopLabel: "本职差使与考成", statusLabel: "署中承差", summary: "本旬整理公开差使与考成凭据。", sourceViews: ["officialCareerView", "courtResponseView", "domainConsequenceView"], enabled: true, itemCount: 1, pressureScore: 37 },
      { role: "minister", roleLabel: "大臣", authorityTier: "T4", loopLabel: "票拟覆奏与部务朝议", statusLabel: "待任后展开", summary: inactiveSummary, sourceViews: ["courtResponseView", "worldThreadView"], enabled: false, itemCount: 0, pressureScore: 0 },
      { role: "general", roleLabel: "将领", authorityTier: "T4", loopLabel: "军帐粮道与边患", statusLabel: "待任后展开", summary: inactiveSummary, sourceViews: ["mapRuntimeView", "militaryDiplomacyView"], enabled: false, itemCount: 0, pressureScore: 0 },
      { role: "emperor", roleLabel: "皇帝", authorityTier: "T5", loopLabel: "御案奏议与天下调度", statusLabel: "待任后展开", summary: inactiveSummary, sourceViews: ["courtResponseView", "officialPostingsView"], enabled: false, itemCount: 0, pressureScore: 0 }
    ];
    useGameSessionStore.setState({
      currentSessionId: sessionId,
      currentSession: {
        sessionId,
        worldState: {
          player: {
            name: "矩阵官",
            role: "official",
            officeTitle: "翰林院编修"
          }
        },
        roleCycleView: {
          activeRole: "official",
          dateLabel: "康熙元年上旬",
          generatedAtTurn: 12,
          currentRole: {
            roleLabel: "入仕官员",
            loopLabel: "本职差使与考成",
            statusLabel: "署中承差",
            summary: "本旬整理公开差使与考成凭据。",
            items: [{ title: "整理回署材料", publicSummary: "只读公开凭据。" }],
            riskSignals: [{ title: "考成压力", publicSummary: "需补公开凭据。" }],
            entryPoints: [{ id: "court-entry", label: "入朝议", targetRouteId: "court", publicSummary: "只读进入朝议页。" }],
            evidenceRefs: [
              {
                id: "official-evidence",
                label: "官署差使",
                sourceView: "officialCareerView",
                sourceId: "official-source-ref-should-not-render"
              }
            ],
            nextActions: [{ label: "拟呈报", text: "整理本职差遣的公开凭据。" }]
          },
          roleMatrix,
          aiReadScope: {
            allowedSourceViews: ["officialCareerView", "courtResponseView", "providerPayload", "/Users/alice/project/.env"]
          },
          toolPermissions: "AI 只读身份循环安全材料，生成待裁决建议。",
          proposalBoundaries: [
            "只整理当前身份公开事务。",
            "旁注、/Users/alice/project/.env"
          ],
          serverAdjudication: "资源、官职和事务结果仍由服务器裁决。",
          safety: {
            readOnlyView: true,
            draftOnlyFrontend: true,
            serverAdjudicatedOutcomes: true
          }
        }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"],
      status: "ready"
    });

    renderRoute(`/game/${sessionId}`);

    expect(screen.getByText(/康熙元年上旬/)).toBeTruthy();
    expect(screen.getByText(/第12回合/)).toBeTruthy();
    const focusStrip = document.querySelector("[aria-label='本身份速览']");
    expect(focusStrip?.textContent || "").toContain("事务1");
    expect(focusStrip?.textContent || "").toContain("风险1");
    expect(focusStrip?.textContent || "").toContain("入口1");
    expect(focusStrip?.textContent || "").toContain("草稿1");
    const currentEvidence = document.querySelector("[aria-label='本身份公开取材']");
    expect(currentEvidence?.textContent || "").toContain("证据：官署差使");
    expect(document.body.textContent || "").not.toContain("official-source-ref-should-not-render");
    const boundary = document.querySelector("[aria-label='可读材料与裁决边界']");
    expect(boundary?.textContent || "").toContain("可读材料");
    expect(boundary?.textContent || "").toContain("官职履历");
    expect(boundary?.textContent || "").toContain("奏议回应");
    expect(boundary?.textContent || "").toContain("只读公开卷");
    expect(boundary?.textContent || "").toContain("案头草稿");
    expect(boundary?.textContent || "").toContain("主卷定夺");
    expect(boundary?.textContent || "").toContain("推演 只读身份循环安全材料");
    expect(boundary?.textContent || "").toContain("只整理当前身份公开事务");
    expect(boundary?.textContent || "").toContain("资源、官职和事务结果仍由主卷定夺");
    expect(document.body.textContent || "").not.toMatch(/providerPayload|\/Users\/alice|\.env/);
    const matrix = screen.getByRole("list", { name: "六身份矩阵" });
    expect(within(matrix).getByText("书生")).toBeTruthy();
    expect(within(matrix).getByText("地方官")).toBeTruthy();
    expect(within(matrix).getByText("入仕官员")).toBeTruthy();
    expect(within(matrix).getByText("皇帝")).toBeTruthy();
    expect(within(matrix).getByText("职责层级 T5")).toBeTruthy();
    expect(within(matrix).getByText("本旬整理公开差使与考成凭据。")).toBeTruthy();
    expect(within(matrix).getAllByText(inactiveSummary).length).toBe(5);
    expect(within(matrix).getByText("官职履历")).toBeTruthy();
    expect(within(matrix).getAllByText("奏议回应").length).toBeGreaterThanOrEqual(1);
    expect(within(matrix).getByText("警势 37")).toBeTruthy();
    expect(within(matrix).getByText("本身份 · 1 项可见事务")).toBeTruthy();
    expect(within(matrix).getAllByText("待任后展开").length).toBe(5);
    const draftButton = screen.getByRole("button", { name: "拟呈报" });
    expect(draftButton).toHaveProperty("disabled", true);
    fireEvent.click(draftButton);
    expect(useUiStateStore.getState().actionDraft).toBeNull();
    const matrixRequestedUrls = fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(matrixRequestedUrls).not.toContain("/api/game/turn");
  });

  it("opens S88.9 role-cycle surfaces against the route session and drops stale main drafts", async () => {
    mockAssetManifestFetch(buildMockAssetManifest(0));
    const sessionId = "s74-preview";
    const staleSessionId = "12121212-1212-4121-8121-121212121212";
    useGameSessionStore.setState({
      currentSessionId: sessionId,
      currentSession: {
        sessionId,
        worldState: {
          player: {
            name: "入口官",
            role: "official",
            officeTitle: "翰林院编修"
          }
        },
        roleCycleView: {
          activeRole: "official",
          dateLabel: "康熙元年下旬",
          currentRole: {
            roleLabel: "入仕官员",
            loopLabel: "本职差使与考成",
            statusLabel: "署中承差",
            summary: "从安全视图进入人物专题。",
            entryPoints: [{ id: "npc-surface", label: "开人物档案", targetSurfaceId: "npc-profile", publicSummary: "只打开当前案卷专题层。" }],
            nextActions: [{ label: "拟呈报", text: "整理当前案卷差使。" }]
          },
          roleMatrix: []
        }
      } as unknown as ReturnType<typeof useGameSessionStore.getState>["currentSession"],
      status: "ready"
    });
    useUiStateStore.setState({
      currentSessionId: staleSessionId,
      actionDraft: {
        id: "draft-stale-main",
        sessionId: staleSessionId,
        source: "manual",
        targetPage: "game",
        text: "旧案主卷草稿不应残留。"
      }
    });

    renderRoute(`/game/${sessionId}`);

    fireEvent.click(await screen.findByRole("button", { name: "开人物档案" }));

    expect(useUiStateStore.getState()).toMatchObject({
      currentSessionId: sessionId,
      activeSurface: "npc-profile",
      actionDraft: null
    });
    expect(screen.getByLabelText("本回合行动")).toHaveProperty("value", "");
    expect(document.body.textContent || "").not.toContain("旧案主卷草稿");
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
    await screen.findByRole("button", { name: /温书 本地推演 写入草稿/ });
    const quickCallsAfterLoad = fetchMock.mock.calls.filter(([url]) => url === `/api/ai/quick-actions/${sessionId}`).length;
    fireEvent.change(screen.getByLabelText("本回合行动"), { target: { value: "先自拟一段行动，不刷新快捷建议。" } });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(fetchMock.mock.calls.filter(([url]) => url === `/api/ai/quick-actions/${sessionId}`)).toHaveLength(quickCallsAfterLoad);

    fireEvent.click(screen.getByRole("button", { name: /温书 本地推演 写入草稿/ }));
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
      currentSessionId: "74747474-7474-4774-8774-747474747474",
      currentSession: {
        sessionId: "74747474-7474-4774-8774-747474747474",
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
              sourceRefs: ["mapContextView:geo:exam-hall", "layout", "mapBounds:0:1", "x"],
              actionDraftRefs: ["draft-exam-road"]
            },
            {
              mapEntityRef: "geo:polluted",
              label: "provider payload sk-test-secret tp-test-secret path=C:\\secret\\map.json",
              summary: "hiddenNotes raw audit /Users/me/map.json",
              layout: { x: 0.45, y: 0.48 },
              actionDraftRefs: ["draft-polluted"]
            }
          ],
          routes: [{
            mapEntityRef: "map:route:exam-road",
            label: "贡院驿路",
            summary: "通往贡院的公开驿路。",
            sourceRefs: ["mapContextView:route:exam-road", "viewportHint", "position:12:13"],
            controlRefs: ["geo:exam-hall", "coordinates:0:0"],
            layoutPath: [[0.42, 0.52], [0.5, 0.5]],
            actionDraftRefs: ["draft-route-exam"]
          }],
          eventEffects: [{
            targetRef: "geo:exam-hall",
            label: "科场近讯",
            kind: "exam",
            severity: 0.78,
            sourceRefs: ["eventArchiveView:exam-brief", "coordinates:0:0", "y"]
          }],
          actionDrafts: {
            "draft-exam-road": {
              id: "draft-exam-road",
              targetRef: "geo:exam-hall",
              label: "写入赴试草稿",
              actionText: "沿驿路赴贡院，查问近日考期。",
              requiresServerTurn: true
            },
            "draft-route-exam": {
              id: "draft-route-exam",
              targetRef: "map:route:exam-road",
              label: "草拟循贡院驿路",
              actionText: "循贡院驿路行进，沿途查问考期与驿传。",
              sourceRefs: ["mapContextView:route:exam-road", "layoutPath", "x:0.5"],
              requiresServerTurn: true
            },
            "draft-polluted": {
              label: "provider payload",
              actionText: "path=C:\\secret\\map.json hiddenNotes"
            }
          },
          hiddenNotice: "mapRuntimeView 只含服务器安全投影。"
        },
        domainConsequenceView: {
          schemaVersion: 1,
          active: true,
          summary: "当前有1条公开领域后果可追踪，已接入舆图入口。",
          caps: {
            visibleConsequences: 1,
            publicCandidates: 3,
            capped: true
          },
          recentConsequences: [{
            id: "DC-map-consequence-1",
            sourceType: "military_diplomacy",
            sourceLabel: "军务外交",
            kindLabel: "军务后果",
            title: "边镇调粮余波",
            publicSummary: "边镇粮道已公开归档，后续只作追踪线索。",
            statusLabel: "已记入后果追踪",
            generatedAtTurn: 12,
            severity: 2,
            affectedMetricLabels: ["军心"],
            nextStep: "把边镇调粮余波列入军务后果追踪。"
          }]
        }
      },
      status: "ready"
    });

    renderRoute("/game/74747474-7474-4774-8774-747474747474/map");

    await screen.findByRole("heading", { name: "山河舆图" });
    await screen.findByRole("button", { name: "贡院" });
    expect(screen.getByText("舆图行动")).toBeTruthy();
    expect(screen.getByText("草拟循贡院驿路")).toBeTruthy();
    expect(screen.getByText("公开近事")).toBeTruthy();
    expect(screen.getByText("科场近讯")).toBeTruthy();
    expect(screen.getByText("山河局势轴")).toBeTruthy();
    expect(screen.getByText("本卷读法")).toBeTruthy();
    expect(screen.getByText("科场近讯 · 警势 78")).toBeTruthy();
    expect(screen.getByText("边镇调粮余波 · 已记入后果追踪")).toBeTruthy();
    expect(screen.getByText("2 条行动")).toBeTruthy();
    expect(screen.getByText("地点、驿路、近事三层全开；筛选只改卷上显示，不改变案卷事实。")).toBeTruthy();
    expect(screen.getByText(/已接入 2 处地点、1 条路线、1 项近事/)).toBeTruthy();
    expect(document.querySelector(".mapFullScreen")?.getAttribute("data-polish-map")).toBe("s89-7-layer-tooltip");
    expect(document.querySelector("[data-polish-map-situation='s89-21-situation-index']")).toBeTruthy();
    expect(document.querySelector("[data-polish-map-reading='s89-21-situation-reader']")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "据局势拟稿" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "map-runtime",
      targetPage: "game",
      text: "据舆图局势，先核「科场近讯」相关地点、人物与公开后果，整理可查线索后回主卷呈上候复。",
      draftContext: {
        surfaceId: "map-runtime",
        draftKind: "map_event_action",
        sourceView: "mapRuntimeView",
        evidenceRefs: ["eventArchiveView:exam-brief", "geo:exam-hall"],
        sourceRefs: ["eventArchiveView:exam-brief"],
        targetRefs: ["geo:exam-hall"],
        requiresServerTurn: true,
        status: "client_hint"
      }
    });
    expect(JSON.stringify(useUiStateStore.getState().actionDraft?.draftContext || {})).not.toMatch(/layout|layoutPath|mapBounds|viewportHint|coordinates|position|"x"|"y"|C:\\|path|provider|raw/i);
    fireEvent.click(screen.getByRole("button", { name: "贡院" }));
    expect(screen.getAllByText("号舍灯火未歇。").length).toBeGreaterThan(0);
    expect(document.querySelector(".inkMapTooltip")?.getAttribute("data-polish-tooltip")).toBe("s89-7-map-note");
    expect(screen.getByText("单点札记 · 写入后仍须回主卷候复")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "写入赴试草稿" }));
    expect(document.querySelector(".inkMapTooltip .paperButton[data-draft-state='written']")?.getAttribute("aria-label")).toContain("已写入主卷草稿");
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "map-runtime",
      targetPage: "game",
      text: "沿驿路赴贡院，查问近日考期。",
      draftContext: {
        surfaceId: "map-runtime",
        draftKind: "map_ref_action",
        sourceView: "mapRuntimeView",
        evidenceRefs: ["mapContextView:geo:exam-hall", "geo:exam-hall"],
        sourceRefs: ["mapContextView:geo:exam-hall"],
        targetRefs: ["geo:exam-hall"],
        requiresServerTurn: true,
        status: "client_hint"
      }
    });
    expect(JSON.stringify(useUiStateStore.getState().actionDraft?.draftContext || {})).not.toMatch(/layout|layoutPath|mapBounds|viewportHint|coordinates|position|"x"|"y"|C:\\|path|provider|raw/i);

    fireEvent.click(screen.getByRole("button", { name: "写入行动：草拟循贡院驿路" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "map-runtime",
      targetPage: "game",
      text: "循贡院驿路行进，沿途查问考期与驿传。",
      draftContext: {
        surfaceId: "map-runtime",
        draftKind: "map_route_action",
        sourceView: "mapRuntimeView",
        targetRefs: ["map:route:exam-road"],
        requiresServerTurn: true
      }
    });
    expect(useUiStateStore.getState().actionDraft?.draftContext?.evidenceRefs).toEqual([
      "mapContextView:route:exam-road",
      "geo:exam-hall",
      "map:route:exam-road"
    ]);
    expect(JSON.stringify(useUiStateStore.getState().actionDraft?.draftContext || {})).not.toMatch(/layout|layoutPath|mapBounds|viewportHint|coordinates|position|"x"|"y"|C:\\|path|provider|raw/i);

    fireEvent.click(screen.getByRole("button", { name: "据此拟稿" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "map-runtime",
      targetPage: "game",
      text: expect.stringContaining("科场近讯"),
      draftContext: {
        surfaceId: "map-runtime",
        draftKind: "map_event_action",
        sourceView: "mapRuntimeView",
        evidenceRefs: ["eventArchiveView:exam-brief", "geo:exam-hall"],
        sourceRefs: ["eventArchiveView:exam-brief"],
        targetRefs: ["geo:exam-hall"],
        requiresServerTurn: true,
        status: "client_hint"
      }
    });
    expect(JSON.stringify(useUiStateStore.getState().actionDraft?.draftContext || {})).not.toMatch(/layout|layoutPath|mapBounds|viewportHint|coordinates|position|"x"|"y"|C:\\|path|provider|raw/i);

    expect(screen.getByText("舆图后果追踪")).toBeTruthy();
    expect(screen.getByText("边镇调粮余波")).toBeTruthy();
    expect(screen.getByText(/当前显示近次 1 条/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "续记后果" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "map-runtime",
      targetPage: "game",
      text: "把边镇调粮余波列入军务后果追踪。"
    });

    fireEvent.click(screen.getByLabelText("地点"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "贡院" })).toBeNull());
    expect(screen.getByText("现显 驿路、近事；暂隐 地点。筛选只改卷上显示，不改变案卷事实。")).toBeTruthy();
    expect(document.querySelector(".mapLayerToggle[data-layer-state='hidden']")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("地点"));
    await screen.findByRole("button", { name: "贡院" });
    fireEvent.click(screen.getByLabelText("地点"));
    fireEvent.click(screen.getByLabelText("驿路"));
    fireEvent.click(screen.getByLabelText("近事"));
    await waitFor(() => expect(document.querySelectorAll(".inkMapLabel").length).toBe(0));
    expect(document.querySelector(".mapFullScreen")?.getAttribute("data-layer-visibility")).toBe("all-hidden");
    expect(document.querySelector(".inkMapRuntimeBridge")?.getAttribute("data-layer-visibility")).toBe("all-hidden");
    expect(document.querySelector(".inkMapLayerEmptyOverlay")?.getAttribute("data-polish-map-empty")).toBe("s89-11-runtime-empty");
    expect(screen.getByText("暂无可见舆图线索")).toBeTruthy();
    expect(screen.getByText("三层暂收，暂无可见舆图预备行动；展开图层后再写入候复草稿。")).toBeTruthy();
    expect(screen.getByText("近事图层暂收，局势簿不显示公开近事。")).toBeTruthy();
    expect(screen.queryByText("草拟循贡院驿路")).toBeNull();
    expect(screen.queryByText("科场近讯")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "展开三层" })[0]);
    await screen.findByRole("button", { name: "贡院" });
    expect(screen.getByText("草拟循贡院驿路")).toBeTruthy();
    expect(screen.getByText("科场近讯")).toBeTruthy();

    expect(screen.getByRole("link", { name: "入局势簿" }).getAttribute("href")).toBe("/game/74747474-7474-4774-8774-747474747474/archive");
    expect(document.body.textContent || "").not.toMatch(/raw audit|provider payload|hiddenNotes|OPENAI_API_KEY|data\/sessions|sk-test-secret|tp-test-secret|\/Users|C:\\|path=/i);
    expect(document.body.textContent || "").not.toMatch(/安全投影|安全专题投影|舆图投影摘要|后端裁决|resolver|safe view|\bserver\b|provider|model/i);
  });

  it("renders archive route entries and domain consequence tracking from safe views", () => {
    useGameSessionStore.setState({
      currentSessionId: "74747474-1111-4111-8111-747474747474",
      currentSession: {
        sessionId: "74747474-1111-4111-8111-747474747474",
        narrative: "史册已启。",
        worldState: { player: { name: "顾衡", role: "official" } },
        eventArchiveView: {
          schemaVersion: 1,
          pagination: { page: 1, pageSize: 12, totalItems: 16 },
          counts: { total: 16, domain_consequence: 1, world_entity_impact: 2 },
          items: [{
            id: "EA-domain-1",
            sourceType: "domain_consequence",
            sourceLabel: "后果追踪",
            title: "平粜余波",
            summary: "县中平粜后米价稍稳，已入公开后果追踪。",
            dateLabel: "明1644年三月中旬",
            statusLabel: "已记",
            riskLabel: "民心",
            relatedLabels: ["地方政策", "月报"]
          },
          ...Array.from({ length: 11 }, (_, index) => ({
            id: `EA-filler-${index + 1}`,
            sourceType: "event_history",
            sourceLabel: "近事",
            title: `近事留痕${index + 1}`,
            summary: `公开近事第${index + 1}条。`,
            dateLabel: "明1644年三月中旬",
            statusLabel: "已记"
          })),
          {
            id: "EA-entity-impact-polluted",
            sourceType: "world_entity_impact",
            sourceLabel: "实体压力",
            title: "/Users/alice/project/.env",
            summary: "/home/alice/archive.txt",
            dateLabel: "明1644年三月中旬",
            statusLabel: "留察",
            riskLabel: "有牵连",
            relatedLabels: ["同年文社"]
          },
          {
            id: "EA-entity-impact-1",
            sourceType: "world_entity_impact",
            sourceLabel: "实体压力",
            title: "同年文社压力留痕",
            summary: "论道余波已归入同年文社公开实体压力，仍回主卷提交。",
            dateLabel: "明1644年三月中旬",
            statusLabel: "留察",
            riskLabel: "有牵连",
            relatedLabels: ["同年文社", "NPC 关系行动", "信任上升"]
          },
          {
            id: "EA-polluted",
            sourceType: "event_history",
            sourceLabel: "近事",
            title: "provider payload",
            summary: "hiddenNotes raw audit C:\\secret\\archive.json",
            dateLabel: "明1644年三月中旬",
            statusLabel: "已记"
          }]
        },
        domainConsequenceView: {
          schemaVersion: 1,
          active: true,
          summary: "draftContext schema manifest server adjudication AI read scope proposal boundary",
          recentConsequences: [{
            id: "DC-archive-1",
            sourceType: "city_policy",
            sourceLabel: "地方政策",
            kindLabel: "政策后果",
            title: "平粜余波",
            publicSummary: "draftContext schema manifest server adjudication AI read scope proposal boundary",
            statusLabel: "已记",
            generatedAtTurn: 18,
            severity: 1,
            affectedMetricLabels: ["民心"],
            nextStep: "把平粜余波列入月报与史册。"
          }]
        },
        npcActiveRequestView: {
          schemaVersion: "s88.7-npc-active-request-view.v1",
          followUpEvidence: {
            schemaVersion: "s88.7-npc-active-request-follow-up-evidence.v1",
            counts: { total: 2 },
            people: [{
              evidenceId: "npc-follow-up-evidence:archive-intro",
              evidenceKindLabel: "同年拜会",
              title: "同年拜会线索",
              publicSummary: "史册保留同年师友的公开拜会线索。",
              nextStep: "先拟拜会草稿，再回主卷提交。",
              statusLabel: "待复核",
              npc: { displayName: "顾文衡" },
              riskTags: ["引荐"]
            }],
            events: [{
              evidenceId: "npc-follow-up-evidence:archive-watch",
              evidenceKindLabel: "风宪 watchlist",
              title: "风宪 watchlist 留痕",
              publicSummary: "请托案牍只作公开风宪线索。",
              nextStep: "列入公开复核，不作定罪。",
              statusLabel: "待复核",
              npc: { displayName: "许书吏" },
              riskTags: ["风宪"]
            }]
          }
        }
      },
      status: "ready"
    });

    renderRoute("/game/74747474-1111-4111-8111-747474747474/archive");

    const archivePanel = document.querySelector(".archiveRoutePanel") as HTMLElement;
    expect(archivePanel).toBeTruthy();
    expect(archivePanel.getAttribute("data-polish-archive")).toBe("s89-10-chronicle-density");
    expect(archivePanel.querySelector("[data-archive-layout='ledger-rail']")).toBeTruthy();
    expect(archivePanel.querySelector("[data-polish-archive-trace='s89-10-chronicle-density']")).toBeTruthy();
    expect(archivePanel.querySelector(".archiveEvidenceStack")).toBeTruthy();
    const archive = within(archivePanel);

    expect(screen.getByRole("heading", { name: "史册" })).toBeTruthy();
    expect(archive.getByText("案卷索引")).toBeTruthy();
    expect(archive.getByText("近次线索")).toBeTruthy();
    expect(archive.getByText("入册条目")).toBeTruthy();
    expect(archive.getByText("后果线索")).toBeTruthy();
    expect(archive.getByText("实体余波")).toBeTruthy();
    expect(archive.getByText("本页列 12/12 条")).toBeTruthy();
    expect(archive.getByRole("list", { name: "史册近次线索" })).toBeTruthy();
    expect(archive.getAllByText("平粜余波").length).toBeGreaterThan(0);
    expect(archive.getByText("同年文社压力留痕")).toBeTruthy();
    expect(archive.getByText("论道余波已归入同年文社公开实体压力，仍回主卷提交。")).toBeTruthy();
    expect(archivePanel.querySelectorAll("li[data-source-type='world_entity_impact']").length).toBe(1);
    expect(archivePanel.textContent || "").not.toMatch(/\/Users\/alice|\/home\/alice|\.env|archive\.txt/);
    expect(archive.getByText("史册后果追踪")).toBeTruthy();
    expect(archive.getByText("来函证据追踪")).toBeTruthy();
    expect(archive.getAllByText("后果").length).toBeGreaterThan(0);
    expect(archive.getAllByText("实体").length).toBeGreaterThan(0);
    expect(archive.getByText("同年拜会线索")).toBeTruthy();
    expect(archive.getByText("风宪 留察名单 留痕")).toBeTruthy();
    expect(archivePanel.textContent || "").toContain("人物关系行动");
    expect(archivePanel.textContent || "").not.toMatch(/\bNPC\b|watchlist/);
    fireEvent.click(archive.getAllByRole("button", { name: "据此拟稿" })[0]);
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "archive-view",
      targetPage: "game",
      text: expect.stringContaining("平粜余波")
    });
    fireEvent.click(archive.getByRole("button", { name: "续记后果" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "archive-view",
      targetPage: "game",
      text: "把平粜余波列入月报与史册。"
    });
    fireEvent.click(archive.getAllByRole("button", { name: "拟复核" })[0]);
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "archive-view",
      targetPage: "game",
      text: expect.stringContaining("案卷回批")
    });
    expect(archive.getByRole("link", { name: "入舆图" }).getAttribute("href")).toBe("/game/74747474-1111-4111-8111-747474747474/map");
    expect(archivePanel.textContent || "").not.toMatch(/raw audit|provider payload|hiddenNotes|privateSignalTags|OPENAI_API_KEY|data\/sessions|C:\\|path=|stateDelta|evidenceRefs|outcomeId|cityPolicyLedger|draftContext|schema|manifest|server adjudication|AI read scope|proposal boundary/i);
  });
});
