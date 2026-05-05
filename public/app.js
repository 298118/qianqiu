const form = document.querySelector("#start-form");
const statusStrip = document.querySelector("#status-strip");
const scholarPanel = document.querySelector("#scholar-panel");
const narrative = document.querySelector("#narrative");
const startPanel = document.querySelector(".start-panel");
const gamePanel = document.querySelector(".game-panel");
const actionArea = document.querySelector("#action-area");
const actionInput = document.querySelector("#action-input");
const actionBtn = document.querySelector("#action-btn");
const examBackdrop = document.querySelector("#exam-backdrop");
const examClose = document.querySelector("#exam-close");
const examMeta = document.querySelector("#exam-meta");
const examTitle = document.querySelector("#exam-title");
const examQuestion = document.querySelector("#exam-question");
const examRequirements = document.querySelector("#exam-requirements");
const examEssay = document.querySelector("#exam-essay");
const examSubmit = document.querySelector("#exam-submit");

let currentSessionId = null;
let currentWorldState = null;

const ATTRIBUTE_LABELS = {
  health: "体力",
  gold: "银钱",
  academia: "学识",
  literaryTalent: "文采",
  adaptability: "机辩",
  mentality: "心性",
  reputation: "声望"
};

const EXAM_LABELS = {
  child_exam: "童试",
  provincial_exam: "乡试",
  metropolitan_exam: "会试",
  palace_exam: "殿试"
};

const EXAM_PROGRESS = [
  { rank: null, label: "寒窗", next: "child_exam" },
  { rank: "秀才", label: "秀才", next: "provincial_exam" },
  { rank: "举人", label: "举人", next: "metropolitan_exam" },
  { rank: "贡士", label: "贡士", next: "palace_exam" },
  { rank: "进士", label: "进士", next: null }
];

function getExamProgress(player) {
  if (player.role === "official") {
    return { index: EXAM_PROGRESS.length - 1, label: "入仕", next: null };
  }

  const index = Math.max(0, EXAM_PROGRESS.findIndex((step) => step.rank === player.examRank));
  const step = EXAM_PROGRESS[index] || EXAM_PROGRESS[0];
  return { index, label: step.label, next: step.next };
}

function getEntryExamLevel(worldState, progress) {
  if (worldState.activeExam && worldState.activeExam.level) {
    return worldState.activeExam.level;
  }
  return progress.next;
}

function createTag(text) {
  const tag = document.createElement("span");
  tag.textContent = text;
  return tag;
}

function createPanelValue(kicker, value, valueTag = "strong") {
  const item = document.createElement("div");
  const label = document.createElement("span");
  label.className = "panel-kicker";
  label.textContent = kicker;
  const content = document.createElement(valueTag);
  content.textContent = value;
  item.append(label, content);
  return item;
}

function setStatus(worldState) {
  const player = worldState.player;
  statusStrip.innerHTML = "";
  [
    `${worldState.dynasty}${worldState.year}年`,
    player.roleLabel,
    player.name,
    `银钱 ${player.gold}`,
    `回合 ${worldState.turnCount}`
  ].forEach((text) => {
    statusStrip.appendChild(createTag(text));
  });
}

function renderMeter(label, value) {
  const item = document.createElement("div");
  item.className = "stat-meter";

  const header = document.createElement("div");
  header.className = "stat-meter-header";
  header.innerHTML = `<span>${label}</span><strong>${value}</strong>`;

  const track = document.createElement("div");
  track.className = "meter-track";
  const bar = document.createElement("span");
  bar.style.width = `${Math.max(0, Math.min(100, value))}%`;
  track.appendChild(bar);

  item.append(header, track);
  return item;
}

function renderScholarPanel(worldState) {
  const player = worldState.player;
  if (player.role !== "scholar" && player.role !== "official") {
    scholarPanel.hidden = true;
    scholarPanel.innerHTML = "";
    return;
  }

  const progress = getExamProgress(player);
  const nextExam = progress.next ? EXAM_LABELS[progress.next] : "无";
  scholarPanel.hidden = false;
  scholarPanel.innerHTML = "";

  const progressBlock = document.createElement("section");
  progressBlock.className = "scholar-progress";
  progressBlock.append(
    createPanelValue("科举进度", progress.label),
    createPanelValue("下一场", nextExam),
    createPanelValue(
      "当前考试",
      worldState.activeExam ? EXAM_LABELS[worldState.activeExam.level] || worldState.activeExam.level : "未入场"
    )
  );

  const entryLevel = getEntryExamLevel(worldState, progress);
  if (entryLevel) {
    const entryButton = document.createElement("button");
    entryButton.type = "button";
    entryButton.className = "panel-action";
    entryButton.textContent = worldState.activeExam && worldState.activeExam.examQuestion ? "继续写作" : "入场取题";
    entryButton.addEventListener("click", () => openExamQuestion(entryLevel));
    progressBlock.appendChild(entryButton);
  }

  const stepList = document.createElement("ol");
  stepList.className = "exam-steps";
  EXAM_PROGRESS.forEach((step, index) => {
    const li = document.createElement("li");
    li.className = index <= progress.index ? "is-complete" : "";
    li.textContent = step.label;
    stepList.appendChild(li);
  });

  const stats = document.createElement("section");
  stats.className = "scholar-stats";
  [
    ["学识", player.academia],
    ["文采", player.literaryTalent],
    ["机辩", player.adaptability],
    ["心性", player.mentality],
    ["声望", player.reputation]
  ].forEach(([label, value]) => {
    stats.appendChild(renderMeter(label, value));
  });

  const lists = document.createElement("section");
  lists.className = "scholar-lists";
  lists.append(
    createPanelValue("师承", player.teacher || "未定"),
    createPanelValue("已读书", (player.studiedBooks || []).join("、") || "尚无记录", "p"),
    createPanelValue("人脉", (player.connections || []).join("、") || "尚无记录", "p")
  );

  scholarPanel.append(progressBlock, stepList, stats, lists);
}

function renderWorldState(worldState) {
  currentWorldState = worldState;
  setStatus(worldState);
  renderScholarPanel(worldState);
}

function appendNarrative(text, className) {
  const placeholder = narrative.querySelector(".placeholder");
  if (placeholder) placeholder.remove();

  const paragraph = document.createElement("p");
  if (className) paragraph.className = className;
  paragraph.textContent = text;
  narrative.appendChild(paragraph);
  narrative.scrollTop = narrative.scrollHeight;
}

function appendAttributeChanges(changes) {
  if (!changes || !changes.length) return;
  const div = document.createElement("div");
  div.className = "attr-changes";
  changes.forEach((change) => {
    const diff = change.after - change.before;
    const sign = diff > 0 ? "+" : "";
    const label = change.label || ATTRIBUTE_LABELS[change.path.split(".").pop()] || change.path;
    const tag = document.createElement("span");
    tag.className = diff > 0 ? "attr-up" : diff < 0 ? "attr-down" : "";
    tag.textContent = `${label} ${change.before}→${change.after} (${sign}${diff})`;
    div.appendChild(tag);
  });
  narrative.appendChild(div);
  narrative.scrollTop = narrative.scrollHeight;
}

function renderExamModal(payload) {
  examMeta.textContent = `${payload.examName} · ${payload.questionType} · ${payload.difficulty}`;
  examTitle.textContent = payload.examName;
  examQuestion.textContent = payload.examQuestion;
  examRequirements.innerHTML = "";
  (payload.requirements || []).forEach((requirement) => {
    const item = document.createElement("li");
    item.textContent = requirement;
    examRequirements.appendChild(item);
  });
  examEssay.value = "";
  examSubmit.disabled = true;
  examSubmit.title = "评卷将在后续步骤接入";
  examBackdrop.hidden = false;
  examEssay.focus();
}

function closeExamModal() {
  examBackdrop.hidden = true;
}

async function openExamQuestion(level) {
  if (!currentSessionId) return;

  try {
    const response = await fetch("/api/exam/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId, level })
    });

    if (!response.ok) {
      let message = `取题失败：${response.status}`;
      try {
        const errorPayload = await response.json();
        if (errorPayload.error) message = errorPayload.error;
      } catch {
        // Keep the status-based message when the server did not send JSON.
      }
      throw new Error(message);
    }

    const payload = await response.json();
    renderWorldState(payload.worldState);
    renderExamModal(payload);
  } catch (error) {
    appendNarrative(error.message, "error");
  }
}

function showGameView() {
  startPanel.style.display = "none";
  gamePanel.style.display = "";
  actionArea.style.display = "";
}

function showStartView() {
  startPanel.style.display = "";
  gamePanel.style.display = "none";
  actionArea.style.display = "none";
}

async function submitAction() {
  const input = actionInput.value.trim();
  if (!input || !currentSessionId) return;

  actionBtn.disabled = true;
  actionInput.disabled = true;

  try {
    appendNarrative(`> ${input}`, "player-input");

    const response = await fetch("/api/game/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId, input })
    });

    if (!response.ok) {
      throw new Error(`行动失败：${response.status}`);
    }

    const payload = await response.json();
    appendNarrative(payload.narrative);
    appendAttributeChanges(payload.attributeChanges);
    renderWorldState(payload.worldState);
    actionInput.value = "";

    if (payload.examTrigger && payload.examTrigger.shouldStart) {
      appendNarrative(`[科举提示] 已可参加考试：${EXAM_LABELS[payload.examTrigger.level] || payload.examTrigger.level}`, "exam-hint");
      await openExamQuestion(payload.examTrigger.level);
    }
  } catch (error) {
    appendNarrative(error.message, "error");
  } finally {
    actionBtn.disabled = false;
    actionInput.disabled = false;
    if (examBackdrop.hidden) {
      actionInput.focus();
    }
  }
}

actionBtn.addEventListener("click", submitAction);
actionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitAction();
  }
});

examClose.addEventListener("click", closeExamModal);
examBackdrop.addEventListener("click", (event) => {
  if (event.target === examBackdrop) {
    closeExamModal();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !examBackdrop.hidden) {
    closeExamModal();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "开局中...";

  try {
    const response = await fetch("/api/game/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
    });

    if (!response.ok) {
      throw new Error(`开局失败：${response.status}`);
    }

    const payload = await response.json();
    currentSessionId = payload.sessionId;
    localStorage.setItem("qianqiu.sessionId", payload.sessionId);
    renderWorldState(payload.worldState);
    narrative.innerHTML = "";
    appendNarrative(payload.narrative);
    showGameView();
    actionInput.focus();
  } catch (error) {
    appendNarrative(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "开局";
  }
});

async function restoreSession() {
  const savedId = localStorage.getItem("qianqiu.sessionId");
  if (!savedId) return;

  try {
    const response = await fetch(`/api/game/state/${savedId}`);
    if (!response.ok) {
      localStorage.removeItem("qianqiu.sessionId");
      return;
    }
    const payload = await response.json();
    currentSessionId = payload.sessionId;
    renderWorldState(payload.worldState);
    narrative.innerHTML = "";
    const history = payload.worldState.eventHistory || [];
    if (history.length) {
      history.forEach((event) => appendNarrative(event));
    } else {
      appendNarrative("存档已恢复。继续你的旅程。");
    }
    showGameView();
  } catch {
    localStorage.removeItem("qianqiu.sessionId");
  }
}

showStartView();
restoreSession();
