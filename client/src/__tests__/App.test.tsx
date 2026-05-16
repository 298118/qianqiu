import { cleanup, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "../router";
import { useGameSessionStore } from "../state/gameSessionState";

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
  });

  it("renders the new default home surface", () => {
    renderRoute("/");

    expect(screen.getByRole("heading", { name: "千秋" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "预览" }).getAttribute("href")).toBe("/game/s74-preview");
    expect(screen.getByRole("button", { name: "新开一卷" })).toBeTruthy();
    expect(document.querySelector("[data-client-entry='react']")).toBeTruthy();
    expect(document.querySelector("[data-router-mode='data']")).toBeTruthy();
  });

  it("keeps the session routes inside the React Router tree", () => {
    renderRoute("/game/smoke-session/map");

    expect(screen.getByRole("heading", { name: "主卷" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "舆图" })).toBeTruthy();
    expect(document.body.textContent || "").not.toMatch(/OPENAI_API_KEY|hiddenNotes|data\/sessions|provider payload/i);
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
});
