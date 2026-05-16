import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routes } from "../router";
import { useGameSessionStore } from "../state/gameSessionState";
import { useUiStateStore } from "../state/uiState";

function renderRoute(initialEntry: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  return render(<RouterProvider router={router} />);
}

describe("S74.1 React client shell", () => {
  afterEach(() => {
    cleanup();
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
    expect(document.querySelector("[data-client-entry='react']")).toBeTruthy();
    expect(document.querySelector("[data-router-mode='data']")).toBeTruthy();
    expect(document.querySelector("[data-shell-version='s74-4']")).toBeTruthy();
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
});
