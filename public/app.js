const form = document.querySelector("#start-form");
const statusStrip = document.querySelector("#status-strip");
const narrative = document.querySelector("#narrative");
const startPanel = document.querySelector(".start-panel");
const gamePanel = document.querySelector(".game-panel");
const actionArea = document.querySelector("#action-area");
const actionInput = document.querySelector("#action-input");
const actionBtn = document.querySelector("#action-btn");

let currentSessionId = null;

function setStatus(worldState) {
  const player = worldState.player;
  statusStrip.innerHTML = "";
  [
    `${worldState.dynasty}${worldState.year}年`,
    player.roleLabel,
    player.name,
    `银钱 ${player.gold}`,
    `学识 ${player.academia}`,
    `文采 ${player.literaryTalent}`,
    `机辩 ${player.adaptability}`,
    `心性 ${player.mentality}`,
    `声望 ${player.reputation}`
  ].forEach((text) => {
    const item = document.createElement("span");
    item.textContent = text;
    statusStrip.appendChild(item);
  });
}

function appendNarrative(text, className) {
  // Remove placeholder if present
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
  changes.forEach((c) => {
    const diff = c.after - c.before;
    const sign = diff > 0 ? "+" : "";
    const tag = document.createElement("span");
    tag.className = diff > 0 ? "attr-up" : diff < 0 ? "attr-down" : "";
    tag.textContent = `${c.path.split(".").pop()} ${c.before}→${c.after} (${sign}${diff})`;
    div.appendChild(tag);
  });
  narrative.appendChild(div);
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
    setStatus(payload.worldState);
    actionInput.value = "";

    if (payload.examTrigger && payload.examTrigger.shouldStart) {
      appendNarrative(`[科举提示] 已可参加考试：${payload.examTrigger.level}`, "exam-hint");
    }
  } catch (error) {
    appendNarrative(error.message, "error");
  } finally {
    actionBtn.disabled = false;
    actionInput.disabled = false;
    actionInput.focus();
  }
}

actionBtn.addEventListener("click", submitAction);
actionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitAction();
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
    setStatus(payload.worldState);
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

// Restore session on page load
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
    setStatus(payload.worldState);
    narrative.innerHTML = "";
    const history = payload.worldState.eventHistory || [];
    if (history.length) {
      history.forEach((ev) => appendNarrative(ev));
    } else {
      appendNarrative("存档已恢复。继续你的旅程。");
    }
    showGameView();
  } catch {
    localStorage.removeItem("qianqiu.sessionId");
  }
}

restoreSession();
