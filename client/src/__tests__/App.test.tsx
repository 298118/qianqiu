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
    expect(document.querySelector("[data-shell-version='s74-7']")).toBeTruthy();
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
    expect(screen.getByRole("link", { name: "舆图" }).getAttribute("href")).toBe(`/game/${sessionId}/map`);
    expect(screen.getByRole("link", { name: "人物" }).getAttribute("href")).toBe(`/game/${sessionId}/people`);
    expect(screen.getByRole("link", { name: "史册" }).getAttribute("href")).toBe(`/game/${sessionId}/archive`);
  });

  it("keeps the session routes inside the React Router tree", () => {
    renderRoute("/game/smoke-session/map");

    expect(screen.getByRole("heading", { name: "主卷" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "舆图" })).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload/i);
  });

  it("tracks route-derived UI page state and closes safe drawers with Esc while restoring focus", async () => {
    renderRoute("/game/smoke-session/map");

    await waitFor(() => expect(useUiStateStore.getState().currentPage).toBe("map"));
    expect(useUiStateStore.getState().currentSessionId).toBe("smoke-session");

    const trigger = screen.getByRole("button", { name: "打开显示偏好" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("complementary", { name: "显示偏好" })).toBeTruthy();
    expect(useUiStateStore.getState().activeDrawer).toBe("display-preferences");
    expect(screen.getByRole("button", { name: "关闭抽屉" })).toBe(document.activeElement);

    fireEvent.change(screen.getByLabelText("动效"), { target: { value: "reduced" } });
    expect(document.querySelector(".appShell")?.getAttribute("data-motion")).toBe("reduced");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(useUiStateStore.getState().activeDrawer).toBeNull());
    expect(document.activeElement).toBe(trigger);
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

  it("keeps the main action draft in the UI store and clears it from the form", () => {
    renderRoute("/game/s74-preview");

    const input = screen.getByLabelText("本回合行动");
    fireEvent.change(input, { target: { value: "拜访座师，请教经义。" } });

    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "manual",
      targetPage: "game",
      text: "拜访座师，请教经义。"
    });

    fireEvent.click(screen.getByRole("button", { name: "清空草稿" }));
    expect(useUiStateStore.getState().actionDraft).toBeNull();
    expect(screen.getByLabelText("本回合行动")).toHaveProperty("value", "赴书院温习经义，打听近日考期。");
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
