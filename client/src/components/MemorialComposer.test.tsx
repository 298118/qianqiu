import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemorialComposer } from "./MemorialComposer";
import { buildQuickActionSuggestions, getMemorialPlaceholder } from "./quickActionSuggestions";
import type { ActionDraft } from "../state/uiState";

const defaultProps = {
  actionDraft: null,
  player: { role: "scholar" },
  routeViews: null,
  runnable: true,
  loading: false,
  onDraftChange: vi.fn(),
  onSuggestionDraft: vi.fn(),
  onClearDraft: vi.fn(),
  onSubmit: vi.fn()
};

describe("S75.8 MemorialComposer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("builds only deterministic local-rule quick actions by role", () => {
    expect(getMemorialPlaceholder("emperor")).toBe("宣旨、朱批、召见群臣...");
    expect(getMemorialPlaceholder("scholar")).toBe("研读、作文、拜师、赴考...");
    expect(getMemorialPlaceholder("general")).toBe("遣将、巡营、上战报...");
    expect(getMemorialPlaceholder("magistrate")).toBe("审案、赈济、修堤、安民...");
    expect(getMemorialPlaceholder("official")).toBe("上疏、会商、查阅案牍...");

    const suggestions = buildQuickActionSuggestions({ role: "scholar" });
    expect(suggestions).toHaveLength(3);
    expect(suggestions.every((suggestion) => suggestion.source === "local-rule")).toBe(true);
    expect(suggestions.map((suggestion) => suggestion.label)).toEqual(["研读", "作文", "赴考"]);
    expect(JSON.stringify(suggestions)).not.toMatch(/provider|prompt|raw|hidden|data\/sessions|OPENAI_API_KEY/i);
  });

  it("writes quick actions to a draft callback without submitting a turn", () => {
    const onSubmit = vi.fn();
    const onSuggestionDraft = vi.fn();

    render(
      <MemorialComposer
        {...defaultProps}
        player={{ role: "magistrate" }}
        onSubmit={onSubmit}
        onSuggestionDraft={onSuggestionDraft}
      />
    );

    expect(screen.getByRole("button", { name: "可行事" }).getAttribute("aria-expanded")).toBe("true");
    const suggestion = screen.getByRole("button", { name: /审案 local-rule 写入草稿/ });
    expect(suggestion.getAttribute("data-source")).toBe("local-rule");

    fireEvent.click(suggestion);

    expect(onSuggestionDraft).toHaveBeenCalledWith(
      "升堂审理积案，先核公开证词与案牍记录。",
      expect.objectContaining({ source: "local-rule", title: "审案" })
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with Enter, keeps Shift+Enter for new lines, and disables blank submit", () => {
    const onSubmit = vi.fn();
    const onDraftChange = vi.fn();
    const { rerender } = render(
      <MemorialComposer
        {...defaultProps}
        actionDraft={null}
        player={{ role: "scholar" }}
        onDraftChange={onDraftChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole("textbox", { name: "本回合行动" }).getAttribute("placeholder")).toBe("研读、作文、拜师、赴考...");
    expect(screen.getByRole("button", { name: "呈上" })).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByRole("textbox", { name: "本回合行动" }), { target: { value: "  拜师问学。  " } });
    expect(onDraftChange).toHaveBeenCalledWith("  拜师问学。  ");

    rerender(
      <MemorialComposer
        {...defaultProps}
        actionDraft={{ id: "draft-manual-study", source: "manual", targetPage: "game", text: "  拜师问学。  " }}
        player={{ role: "scholar" }}
        onDraftChange={onDraftChange}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByRole("textbox", { name: "本回合行动" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("拜师问学。");
  });

  it("marks a local-rule suggestion once it is already in the draft", () => {
    const text = buildQuickActionSuggestions({ role: "general" })[0].text;
    const actionDraft: ActionDraft = { id: "draft-role-surface-general", source: "role-surface", targetPage: "game", text };

    render(
      <MemorialComposer
        {...defaultProps}
        actionDraft={actionDraft}
        player={{ role: "general" }}
      />
    );

    const written = screen.getByRole("button", { name: /遣将 local-rule 已入草稿/ });
    expect(written.getAttribute("data-draft-state")).toBe("written");
  });
});
