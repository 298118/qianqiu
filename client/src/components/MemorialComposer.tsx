import { ChevronDown, ChevronUp, SendHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { PlayerSummary } from "../api";
import type { QuickActionSuggestionPayload } from "../api";
import type { ActionDraft, SafePlayerPayload } from "../state/uiState";
import {
  buildQuickActionSuggestions,
  getRolePlaceholder,
  type QuickActionSuggestion
} from "./quickActionSuggestions";

export type MemorialComposerProps = {
  readonly actionDraft: ActionDraft | null;
  readonly player?: PlayerSummary | null;
  readonly routeViews?: SafePlayerPayload["routeViews"] | null;
  readonly aiSuggestions?: readonly QuickActionSuggestionPayload[] | null;
  readonly quickActionStatus?: "idle" | "loading" | "ready" | "error";
  readonly runnable: boolean;
  readonly loading: boolean;
  readonly onDraftChange: (text: string) => void;
  readonly onSuggestionDraft: (text: string, suggestion: QuickActionSuggestion) => void;
  readonly onClearDraft: () => void;
  readonly onRefreshQuickActions?: () => Promise<void> | void;
  readonly onSubmit: (text: string) => Promise<void> | void;
};

export function MemorialComposer({
  actionDraft,
  player,
  routeViews,
  aiSuggestions,
  quickActionStatus = "idle",
  runnable,
  loading,
  onDraftChange,
  onSuggestionDraft,
  onClearDraft,
  onRefreshQuickActions,
  onSubmit
}: MemorialComposerProps) {
  const [inputText, setInputText] = useState(actionDraft?.text ?? "");
  const [quickOpen, setQuickOpen] = useState(true);
  const [appliedSuggestionId, setAppliedSuggestionId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState(false);
  const placeholder = getRolePlaceholder(player);
  const suggestions = useMemo(
    () => buildQuickActionSuggestions({ player, routeViews, aiSuggestions, quickActionStatus, page: "game", runnable, limit: 3 }),
    [aiSuggestions, player, quickActionStatus, routeViews, runnable]
  );
  const trimmedInput = inputText.trim();
  const canSubmit = runnable && !loading && trimmedInput.length > 0;

  useEffect(() => {
    if (!actionDraft) {
      setInputText("");
      setAppliedSuggestionId(null);
      return;
    }

    if (actionDraft.source !== "manual") {
      setInputText(actionDraft.text);
      const matchingSuggestion = suggestions.find((suggestion) => suggestion.text === actionDraft.text);
      setAppliedSuggestionId(actionDraft.source === "role-surface" ? matchingSuggestion?.id ?? actionDraft.id : null);
    }
  }, [actionDraft, suggestions]);

  function updateInput(text: string) {
    setInputText(text);
    setSubmitError(false);
    setAppliedSuggestionId(null);
    onDraftChange(text);
  }

  async function submitCurrent() {
    if (!canSubmit) {
      setSubmitError(trimmedInput.length === 0);
      return;
    }

    setSubmitError(false);
    await onSubmit(trimmedInput);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submitCurrent();
  }

  function applySuggestion(suggestion: QuickActionSuggestion) {
    setSubmitError(false);
    setAppliedSuggestionId(suggestion.id);
    onSuggestionDraft(suggestion.text, suggestion);
  }

  return (
    <form
      className="memorialComposer"
      aria-label="底部奏折"
      data-quick-open={quickOpen ? "true" : "false"}
      onSubmit={(event) => {
        event.preventDefault();
        void submitCurrent();
      }}
    >
      <div className="memorialComposerShell">
        <section className="quickActionDock" aria-label="快捷功能区">
          <button
            className="quickActionToggle"
            type="button"
            aria-expanded={quickOpen}
            aria-controls="quick-action-list"
            onClick={() => setQuickOpen((value) => !value)}
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>可行事</span>
            {quickOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
          </button>
          <button
            className="quickActionRefresh"
            type="button"
            onClick={() => onRefreshQuickActions?.()}
            disabled={!runnable || quickActionStatus === "loading"}
            aria-label={quickActionStatus === "loading" ? "快捷建议生成中" : "刷新快捷建议"}
          >
            {quickActionStatus === "loading" ? "候" : "新"}
          </button>
          <div className="quickActionList" id="quick-action-list" data-state={quickOpen ? "open" : "closed"}>
            {suggestions.length ? (
              suggestions.map((suggestion) => {
                const applied = appliedSuggestionId === suggestion.id;
                const state = applied ? "applied" : suggestion.status;
                return (
                  <button
                    key={suggestion.id}
                    className="quickActionSlip"
                    type="button"
                    data-source={suggestion.source}
                    data-state={state}
                    data-draft-state={applied ? "written" : "idle"}
                    aria-label={`${suggestion.title} ${suggestion.sourceLabel} ${applied ? "已入草稿" : suggestion.status === "failed" ? "降级建议" : suggestion.status === "stale" ? "旧建议" : "写入草稿"}`}
                    onClick={() => applySuggestion(suggestion)}
                  >
                    <span>{suggestion.title}</span>
                    <small>{applied ? "已写入" : sourceStatusLabel(suggestion)}</small>
                  </button>
                );
              })
            ) : (
              <p className="quickActionEmpty">新开一卷后显示可行事。</p>
            )}
          </div>
        </section>
        <label className="memorialInputField">
          <span>本回合行动</span>
          <textarea
            value={inputText}
            placeholder={placeholder}
            rows={4}
            onChange={(event) => updateInput(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-describedby="memorial-help memorial-status"
          />
        </label>
        <div className="memorialActions">
          <button className="sealButton memorialSubmit" type="submit" disabled={!canSubmit} aria-busy={loading}>
            <SendHorizontal size={17} aria-hidden="true" />
            <span>{loading ? "呈上中" : "呈上"}</span>
          </button>
          <button
            className="paperButton memorialClear"
            type="button"
            onClick={() => {
              setInputText("");
              setSubmitError(false);
              setAppliedSuggestionId(null);
              onClearDraft();
            }}
            disabled={!inputText && !actionDraft}
          >
            清稿
          </button>
        </div>
      </div>
      <div className="memorialFooter">
        <p id="memorial-help">Enter 呈上，Shift+Enter 换行。快捷建议只写入草稿，不会自动提交。</p>
        <p id="memorial-status" role={submitError || !runnable ? "alert" : "status"}>
          {!runnable ? "预览案卷不提交行动；从首页新开一卷后即可落笔。" : submitError ? "请先写下本回合行动。" : "\u00a0"}
        </p>
      </div>
    </form>
  );
}

function sourceStatusLabel(suggestion: QuickActionSuggestion) {
  if (suggestion.status === "failed") return `${suggestion.sourceLabel}/降级`;
  if (suggestion.status === "stale") return `${suggestion.sourceLabel}/旧荐`;
  if (suggestion.status === "loading") return `${suggestion.sourceLabel}/生成中`;
  return suggestion.sourceLabel;
}
