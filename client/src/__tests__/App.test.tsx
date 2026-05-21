import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { act, within } from "@testing-library/react";
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

  it("keeps the session routes inside the React Router tree", () => {
    renderRoute("/game/smoke-session/map");

    expect(screen.getByRole("heading", { name: "山河舆图" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "主卷" })).toBeNull();
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload/i);
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
    expect(screen.getByText("2 / 11")).toBeTruthy();
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
    expect(screen.getByText("NPC 月账")).toBeTruthy();
    expect(screen.getByText("交易月账：1条未结议价已转为逾期作废。")).toBeTruthy();
    expect(screen.getByText("水利盗警")).toBeTruthy();
    expect(screen.getByText("士绅乡约")).toBeTruthy();
    expect(screen.getByText("审案、征税、开仓、水利、缉捕、任免、考成和持久化都由服务器裁决。")).toBeTruthy();
    expect(screen.getByText("基础市价和 NPC 月账由后端旬更/月结；前端只显示，不成交、不改账。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "升堂核案" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "升堂核问积案，核对公开证词、案卷日期与里甲呈报，不自行结案。"
    });
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(0);
    expect(document.body.textContent || "").not.toMatch(/provider payload|sk-test-secret|prompt|raw audit|path=|C:\\|data\/sessions|OPENAI_API_KEY/i);
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
    expect(screen.getByText("首月回署：馆阁讲章校订")).toBeTruthy();
    expect(screen.getByText(/近次裁决：准入复核：馆阁讲章校订已入奏折队列服务器裁决/)).toBeTruthy();
    expect(screen.getByText(/朝议跟进：部院覆奏 · 部院待覆/)).toBeTruthy();
    expect(screen.getAllByText("翰林院").length).toBeGreaterThan(0);
    expect(screen.getByText("同年座师与人脉")).toBeTruthy();
    expect(screen.getByText("派系与朝局风险")).toBeTruthy();
    expect(screen.getByText("考成与弹劾")).toBeTruthy();
    expect(screen.getByRole("link", { name: "入朝议页" }).getAttribute("href")).toBe(`/game/${sessionId}/court`);
    expect(screen.getByRole("button", { name: "续记考成" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "部院覆奏" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "合入考成观察" })).toBeTruthy();
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
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(0);
    expect(document.body.textContent || "").not.toMatch(/provider payload|sk-test-secret|prompt|raw audit|path=|C:\\|data\/sessions|OPENAI_API_KEY/i);
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
    expect(screen.getByRole("link", { name: "入舆图页" }).getAttribute("href")).toBe(`/game/${sessionId}/map`);
    expect(screen.getByRole("link", { name: "查史册" }).getAttribute("href")).toBe(`/game/${sessionId}/archive`);
    expect(screen.getByText("战役胜负、调兵遣将、外交和战、统帅任免、粮饷拨付、赏罚与持久化都由服务器裁决。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "遣出斥候" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "遣斥候分赴关隘、驿路与敌营外缘，回报公开线索，不自行判定隐藏军情。"
    });
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(0);
    expect(document.body.textContent || "").not.toMatch(/provider payload|sk-test-secret|prompt|raw audit|path=|C:\\|data\/sessions|OPENAI_API_KEY/i);
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
    expect(screen.getByText("朱批拟稿")).toBeTruthy();
    expect(screen.getAllByText("圣旨草稿").length).toBeGreaterThan(0);
    expect(screen.getAllByText("朝议").length).toBeGreaterThan(0);
    expect(screen.getByText("任免候选")).toBeTruthy();
    expect(screen.getByText("赏罚预留")).toBeTruthy();
    expect(screen.getByRole("link", { name: "入朝议页" }).getAttribute("href")).toBe(`/game/${sessionId}/court`);
    expect(screen.getByRole("link", { name: "查史册" }).getAttribute("href")).toBe(`/game/${sessionId}/archive`);
    expect(screen.getByText("任免、赏罚、处分、朱批成案、圣旨生效、时间推进和持久化都由服务器裁决。")).toBeTruthy();

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
      text: "朱批留览部院覆奏：河工清册，令部院据公开凭据覆奏，此稿只候服务器裁决。"
    });
    fireEvent.click(screen.getByRole("button", { name: "月报摘录" }));
    expect(useUiStateStore.getState().actionDraft?.text).toContain("官职月报");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/game/turn")).toHaveLength(0);
    expect(document.body.textContent || "").not.toMatch(/provider payload|sk-test-secret|prompt|raw audit|path=|C:\\|data\/sessions|OPENAI_API_KEY/i);
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
    fireEvent.change(screen.getByLabelText("正文字体"), { target: { value: "brush-mashan" } });
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
    await screen.findByText(/已保存/);
    expect(screen.getByText("叙事")).toBeTruthy();
    expect(screen.getByText("快捷建议")).toBeTruthy();
    expect(screen.queryByDisplayValue("deep")).toBeNull();

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

    expect(screen.getByRole("heading", { name: "朝议与官署" })).toBeTruthy();
    expect(document.querySelector(".sessionRouteShell")).toBeTruthy();
    expect(document.querySelector(".gameCommandBar")).toBeFalsy();
    expect(document.querySelector(".gameMainDeck")).toBeFalsy();
    expect(document.querySelector(".memorialComposer")).toBeFalsy();
    for (const label of ["奏折队列", "拟圣旨", "朝议", "堂审", "军议", "人物档案"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }

    const trigger = screen.getByRole("button", { name: "拟圣旨" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "拟圣旨" });
    expect(dialog.textContent || "").toContain("数据来源");
    expect(dialog.textContent || "").toContain("占位状态");
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

    const trialTrigger = screen.getByRole("button", { name: "堂审" });
    fireEvent.click(trialTrigger);
    const trialDialog = screen.getByRole("dialog", { name: "堂审" });
    expect(trialDialog.textContent || "").toContain("localAffairsDocketView");
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
            sourceViews: [{ sourceView: "eventArchiveView", domain: "events", count: 1 }],
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
          selectedEvidenceRefs: ["eventArchiveView:event-1"]
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
            draftText: "请召诸臣廷议，先核边饷催报，再拟稳妥章程。",
            evidenceRefs: ["eventArchiveView:event-1"],
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
    fireEvent.click(screen.getByRole("button", { name: "朝议" }));

    const dialog = await screen.findByRole("dialog", { name: "朝议" });
    await waitFor(() => expect(screen.getAllByText("边饷催报").length).toBeGreaterThan(0));
    expect(dialog.textContent || "").toContain("材料");
    expect(dialog.textContent || "").toContain("筹议");
    expect(dialog.textContent || "").toContain("草稿");
    expect(dialog.textContent || "").toContain("户部、兵部");

    fireEvent.click(screen.getByRole("button", { name: "AI 拟稿" }));
    await waitFor(() => expect((screen.getByLabelText("专题草稿正文") as HTMLTextAreaElement).value).toBe("请召诸臣廷议，先核边饷催报，再拟稳妥章程。"));
    fireEvent.click(screen.getByRole("button", { name: "写入底部奏折" }));

    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "role-surface",
      targetPage: "game",
      text: "请召诸臣廷议，先核边饷催报，再拟稳妥章程。"
    });
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).toContain(`/api/game/topic-surface/${sessionId}/court-debate`);
    expect(requestedUrls).toContain(`/api/ai/topic-draft/${sessionId}`);
    expect(requestedUrls).not.toContain("/api/game/turn");
    expect(requestedUrls.some((url) => /\/api\/game\/state|\/api\/dev/.test(url))).toBe(false);
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
    expect(screen.getByText("贡院号舍")).toBeTruthy();
    expect(document.querySelector(".examFullScreen")).toBeTruthy();
    expect(document.querySelector(".examStageRail")).toBeTruthy();
    expect(document.querySelector(".sessionRouteShell")).toBeTruthy();
    expect(document.querySelector(".gameCommandBar")).toBeFalsy();
    expect(document.querySelector(".gameMainDeck")).toBeFalsy();
    expect(document.querySelector(".memorialComposer")).toBeFalsy();
    expect(screen.getByLabelText("试别")).toBeTruthy();
    expect(screen.getByText(/交卷、评分、舞弊、放榜、晋级和授官都由服务器裁决/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("试别"), { target: { value: "provincial_exam" } });
    fireEvent.click(screen.getByRole("button", { name: "取题" }));

    await screen.findByText("试论荒政与教化并行之道。");
    expect(screen.getByLabelText("场内行动")).toBeTruthy();
    expect(screen.getByLabelText("文章")).toBeTruthy();
    expect(screen.getAllByText(/600-900 字/).length).toBeGreaterThan(0);
    expect(screen.getByText(/备考压力：吃紧 66\/100/)).toBeTruthy();
    expect(screen.getByText("备考吃紧：盘费与旅途压力偏高。")).toBeTruthy();
    expect(screen.getByText(/入场后反馈：题纸既发/)).toBeTruthy();
    expect(screen.getByText(/发题审题：题纸既发/)).toBeTruthy();
    expect(screen.getByText(/虚拟考生、阅卷官与榜单只显示安全占位/)).toBeTruthy();

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
    await screen.findByText(/草稿成文：提纲已入草稿/);
    expect(screen.getByText(/本步行动：誊清卷面/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("文章"), { target: { value: "夫荒政者，先安民食，继明教化。" } });
    fireEvent.click(screen.getByRole("button", { name: "交卷" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/exam/submit")).toHaveLength(1));
    await screen.findByText(/乡试 已有评定，可入皇榜细看。/);

    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).not.toContain("/api/game/turn");
    expect(requestedUrls.some((url) => /\/api\/game\/state|\/api\/dev/.test(url))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/provider payload|raw audit|hiddenNotes|OPENAI_API_KEY|data\/sessions|sk-[a-z0-9_-]{6,}|[a-z]:[\\/]/i);
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
              flags: [{ label: "防弊检测通过", severity: "clear", detail: "未见公开扣罚事项。" }]
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
    expect(document.querySelector(".sessionRouteShell")).toBeTruthy();
    expect(document.querySelector(".gameCommandBar")).toBeFalsy();
    expect(document.querySelector(".gameMainDeck")).toBeFalsy();
    expect(document.querySelector(".memorialComposer")).toBeFalsy();
    expect(document.querySelector(".rankingTopThree")).toBeTruthy();
    expect(screen.getByText("服务器定榜名单")).toBeTruthy();
    expect(screen.getByText("金榜题名")).toBeTruthy();
    expect(screen.getAllByText("顾衡").length).toBeGreaterThan(0);
    expect(document.querySelector(".rankingGoldenNotice")).toBeTruthy();
    expect(document.querySelector(".rankingList li.isPlayer")).toBeTruthy();
    expect(screen.getByText("翰林院修撰")).toBeTruthy();
    expect(screen.getByText("切中时务。")).toBeTruthy();
    expect(screen.getByText("同年座师")).toBeTruthy();
    expect(screen.getAllByText(/沈同年/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/许读卷官/).length).toBeGreaterThan(0);
    expect(screen.getByText(/具帖拜谢许读卷官/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /拟行动/ })[0]);
    expect(useUiStateStore.getState().actionDraft?.text).toContain("许读卷官");
    expect(screen.getByText(/本榜只录服务器定榜结果/)).toBeTruthy();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain("/api/game/turn");
    expect(fetchMock.mock.calls.map(([url]) => String(url)).some((url) => /\/api\/game\/state|\/api\/dev/.test(url))).toBe(false);
    expect(document.body.textContent || "").not.toMatch(/provider payload|raw audit|hiddenNotes|sk-test-secret|path=|C:\\|OPENAI_API_KEY|data\/sessions/i);
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
    expect(screen.getByText(/榜文尚未张挂/)).toBeTruthy();
    expect(screen.getByText(/暂无公开防弊复核结果/)).toBeTruthy();
    expect(document.querySelector(".rankingGoldenNotice")).toBeFalsy();
    expect(document.querySelector(".rankingList")).toBeFalsy();
    expect(document.querySelectorAll(".rankingList li").length).toBe(0);
    expect(document.body.textContent || "").not.toMatch(/会元|第一名|防弊检测通过|未见公开扣罚事项/);
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
    expect(screen.getByText("服务器定榜名单")).toBeTruthy();
    expect(screen.getByText("服务器只公开同名榜行。")).toBeTruthy();
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

    expect(screen.getByRole("heading", { name: "人物" })).toBeTruthy();
    await screen.findByText("人物谱牒");
    await waitFor(() => expect(screen.getAllByText("陆清远").length).toBeGreaterThan(0));
    expect(screen.getByText("顾文衡")).toBeTruthy();
    expect(screen.getByText("王氏")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/assets/ui/ink-ui-runtime-manifest.json", expect.objectContaining({ headers: { Accept: "application/json" } }));

    const firstPageImages = screen.getAllByRole("img");
    expect(firstPageImages.every((image) => image.getAttribute("loading") === "lazy")).toBe(true);
    expect(document.querySelector(".peopleLedgerList")?.getAttribute("data-total-people")).toBe("3");
    expect(document.querySelector(".peopleLedgerList")?.getAttribute("data-total-portraits")).toBeNull();
    expect(document.querySelector("[data-portrait-remastered='true']")).toBeTruthy();

    const zoomButton = screen.getAllByRole("button", { name: /查看.*高清立绘/ })[0];
    fireEvent.click(zoomButton);
    const viewer = await screen.findByRole("dialog", { name: "陆清远立绘" });
    expect(viewer.getAttribute("data-portrait-viewer")).toBe("true");
    expect(screen.getByRole("img", { name: "陆清远立绘高清主图" }).getAttribute("src")).toBe("/assets/ui/portraits/portrait-test-female-1-v1.webp");
    expect(JSON.stringify(useUiStateStore.getState().activePortraitViewer)).toBe(JSON.stringify({
      portraitRef: "portrait-test-female-1-v1",
      label: "陆清远立绘"
    }));
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "陆清远立绘" })).toBeNull());
    expect(document.activeElement).toBe(zoomButton);

    act(() => useUiStateStore.getState().openSurface("npc-profile"));
    const npcProfileDialog = await screen.findByRole("dialog", { name: "人物档案" });
    const profileZoomButton = within(npcProfileDialog).getByRole("button", { name: "查看陆清远立绘高清立绘" });
    fireEvent.click(profileZoomButton);
    await screen.findByRole("dialog", { name: "陆清远立绘" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "陆清远立绘" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "人物档案" })).toBeTruthy();
    expect(document.activeElement).toBe(profileZoomButton);

    expect(document.body.textContent || "").not.toMatch(/prompt|provider payload|hiddenNotes|OPENAI_API_KEY|artifacts|data\/sessions|C:\\bad/i);
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
            },
            {
              mapEntityRef: "geo:polluted",
              label: "provider payload sk-test-secret path=C:\\secret\\map.json",
              summary: "hiddenNotes raw audit",
              layout: { x: 0.45, y: 0.48 },
              actionDraftRefs: ["draft-polluted"]
            }
          ],
          routes: [],
          eventEffects: [{ targetRef: "geo:exam-hall", label: "科场近讯", kind: "exam", severity: 0.78 }],
          actionDrafts: {
            "draft-exam-road": {
              label: "写入赴试草稿",
              actionText: "沿驿路赴贡院，查问近日考期。"
            },
            "draft-polluted": {
              label: "provider payload",
              actionText: "path=C:\\secret\\map.json hiddenNotes"
            }
          },
          hiddenNotice: "mapRuntimeView 只含服务器安全投影。"
        }
      },
      status: "ready"
    });

    renderRoute("/game/s74-map-session/map");

    await screen.findByRole("heading", { name: "山河舆图" });
    await screen.findByRole("button", { name: "贡院" });
    expect(screen.getByText("公开近事")).toBeTruthy();
    expect(screen.getByText("科场近讯")).toBeTruthy();
    expect(screen.getByText(/已接入 2 处地点、0 条路线、1 项近事/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "贡院" }));
    expect(screen.getAllByText("号舍灯火未歇。").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "写入赴试草稿" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "map-runtime",
      targetPage: "game",
      text: "沿驿路赴贡院，查问近日考期。"
    });

    fireEvent.click(screen.getByRole("button", { name: "据此拟稿" }));
    expect(useUiStateStore.getState().actionDraft).toMatchObject({
      source: "map-runtime",
      targetPage: "game",
      text: expect.stringContaining("科场近讯")
    });

    fireEvent.click(screen.getByLabelText("地点"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "贡院" })).toBeNull());
    fireEvent.click(screen.getByLabelText("地点"));
    await screen.findByRole("button", { name: "贡院" });

    expect(screen.getByRole("link", { name: "入局势簿" }).getAttribute("href")).toBe("/game/s74-map-session/archive");
    expect(document.body.textContent || "").not.toMatch(/raw audit|provider payload|hiddenNotes|OPENAI_API_KEY|data\/sessions|sk-test-secret|C:\\|path=/i);
  });
});
