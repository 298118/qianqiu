const form = document.querySelector("#start-form");
const statusStrip = document.querySelector("#status-strip");
const narrative = document.querySelector("#narrative");

function setStatus(worldState) {
  const player = worldState.player;
  statusStrip.innerHTML = "";
  [
    `${worldState.dynasty}${worldState.year}年`,
    player.roleLabel,
    player.name,
    `银钱 ${player.gold}`,
    `学识 ${player.academia}`,
    `声望 ${player.reputation}`
  ].forEach((text) => {
    const item = document.createElement("span");
    item.textContent = text;
    statusStrip.appendChild(item);
  });
}

function setNarrative(text) {
  narrative.innerHTML = "";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  narrative.appendChild(paragraph);
}

function readForm() {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "开局中...";

  try {
    const response = await fetch("/api/game/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(readForm())
    });

    if (!response.ok) {
      throw new Error(`开局失败：${response.status}`);
    }

    const payload = await response.json();
    localStorage.setItem("qianqiu.sessionId", payload.sessionId);
    setStatus(payload.worldState);
    setNarrative(payload.narrative);
  } catch (error) {
    setNarrative(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "开局";
  }
});
