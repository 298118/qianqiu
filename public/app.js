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
const examResult = document.querySelector("#exam-result");
const examSubmit = document.querySelector("#exam-submit");
const examModal = document.querySelector(".exam-modal");
const examWritingTools = document.querySelector("#exam-writing-tools");
const examWordCount = document.querySelector("#exam-word-count");
const examWordGuide = document.querySelector("#exam-word-guide");

let currentSessionId = null;
let currentWorldState = null;
let currentExamPayload = null;
let activeNarrativeStream = null;

const ATTRIBUTE_LABELS = {
  health: "体力",
  gold: "银钱",
  academia: "学识",
  literaryTalent: "文采",
  adaptability: "机辩",
  mentality: "心性",
  reputation: "声望",
  personalPower: "皇权",
  courtControl: "朝控",
  mandate: "天命",
  influence: "影响",
  integrity: "操守",
  localTreasury: "县库",
  localOrder: "地方民心",
  gentryRelations: "乡绅",
  banditPressure: "盗匪",
  pendingLawsuits: "词讼",
  corveeBurden: "赋役",
  waterworks: "水利",
  treasury: "府库",
  grainReserve: "粮储",
  population: "人口",
  publicOrder: "民心",
  taxRate: "税率",
  corruption: "贪腐",
  armySize: "兵额",
  armyMorale: "军心",
  borderThreat: "边患"
};

const ACTION_PLACEHOLDERS = {
  scholar: "输入你的行动，例如：研读《论语》三日",
  emperor: "输入你的行动，例如：下诏开仓赈灾，或整饬吏治",
  minister: "输入你的行动，例如：上疏整顿漕运，或拜会清流同僚",
  official: "输入你的行动，例如：入署观政，或审理乡民争讼",
  magistrate: "输入你的行动，例如：审理词讼、清查钱粮，或兴修水利"
};

const ROLE_ACTION_HINTS = {
  emperor: ["下诏赈灾", "任免官员", "加税筹饷", "练兵备边"],
  minister: ["上疏谏言", "督办公务", "结交同僚", "弹劾攻讦"],
  official: ["入署观政", "断案平讼", "劝农抚民", "拜会同年"],
  magistrate: ["审理词讼", "清查钱粮", "安抚乡绅", "缉捕盗匪", "兴修水利"]
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

const SCORE_LABELS = {
  content_quality: "义理内容",
  argument_strength: "论证力",
  literary_style: "文笔修辞",
  classical_format: "文体格式",
  historical_appropriateness: "时代语境"
};

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

  const statusItems = [
    `${worldState.dynasty}${worldState.year}年${worldState.month || 1}月`,
    player.roleLabel,
    player.name,
    `回合 ${worldState.turnCount}`
  ];

  if (player.role === "scholar") {
    statusItems.splice(3, 0, `银钱 ${player.gold}`);
  } else if (player.role === "magistrate") {
    statusItems.splice(
      3,
      0,
      `治所 ${player.countyName || "本县"}`,
      `县库 ${player.localTreasury ?? "-"}`,
      `盗匪 ${player.banditPressure ?? "-"}`
    );
  } else {
    statusItems.splice(3, 0, `府库 ${worldState.treasury}`, `民心 ${worldState.publicOrder}`, `边患 ${worldState.borderThreat}`);
  }

  statusItems.forEach((text) => {
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

function formatFactions(factions = {}) {
  return [
    `宦官 ${factions.eunuchs ?? "-"}`,
    `士大夫 ${factions.scholarOfficials ?? "-"}`,
    `武臣 ${factions.militaryLords ?? "-"}`
  ].join("、");
}

function renderActionHints(role) {
  const stepList = document.createElement("ol");
  stepList.className = "exam-steps";
  (ROLE_ACTION_HINTS[role] || ["自由行动"]).forEach((hint) => {
    const li = document.createElement("li");
    li.textContent = hint;
    stepList.appendChild(li);
  });
  return stepList;
}

function renderRolePanel(worldState) {
  const player = worldState.player;
  scholarPanel.hidden = false;
  scholarPanel.innerHTML = "";

  const overview = document.createElement("section");
  overview.className = "scholar-progress";
  overview.append(
    createPanelValue("身份视角", player.roleLabel),
    createPanelValue("官职/位置", player.officeTitle || player.position || "未授"),
    createPanelValue(player.role === "magistrate" ? "治所" : "派系/根基", player.role === "magistrate" ? player.countyName || "本县" : player.faction || "未定")
  );

  if (player.role === "official") {
    overview.appendChild(createPanelValue("科名", player.palaceRank ? `${player.palaceRank} ${player.examRank}` : player.examRank || "进士"));
  }

  const stats = document.createElement("section");
  stats.className = "scholar-stats";
  const metricSets = {
    emperor: [
      ["皇权", player.personalPower],
      ["朝控", player.courtControl],
      ["天命", player.mandate],
      ["民心", worldState.publicOrder],
      ["贪腐", worldState.corruption],
      ["军心", worldState.armyMorale]
    ],
    minister: [
      ["影响", player.influence],
      ["操守", player.integrity],
      ["声望", player.reputation],
      ["民心", worldState.publicOrder],
      ["贪腐", worldState.corruption],
      ["士大夫", worldState.factions?.scholarOfficials ?? 0]
    ],
    official: [
      ["影响", player.influence],
      ["操守", player.integrity],
      ["声望", player.reputation],
      ["学识", player.academia],
      ["民心", worldState.publicOrder],
      ["贪腐", worldState.corruption]
    ],
    magistrate: [
      ["地方民心", player.localOrder],
      ["乡绅", player.gentryRelations],
      ["盗匪", player.banditPressure],
      ["词讼", player.pendingLawsuits],
      ["赋役", player.corveeBurden],
      ["水利", player.waterworks]
    ]
  };

  (metricSets[player.role] || []).forEach(([label, value]) => {
    stats.appendChild(renderMeter(label, value || 0));
  });

  const lists = document.createElement("section");
  lists.className = "scholar-lists";
  if (player.role === "magistrate") {
    lists.append(
      createPanelValue("县库", `${player.localTreasury ?? 0} 银`, "p"),
      createPanelValue("朝廷府库", `${worldState.treasury} 银`, "p"),
      createPanelValue("粮储", `${worldState.grainReserve} 石`, "p"),
      createPanelValue("人脉", (player.connections || []).join("、") || "尚无记录", "p")
    );
  } else {
    lists.append(
      createPanelValue("府库", `${worldState.treasury} 银`, "p"),
      createPanelValue("粮储", `${worldState.grainReserve} 石`, "p"),
      createPanelValue("朝局", formatFactions(worldState.factions), "p"),
      createPanelValue("人脉", (player.connections || []).join("、") || "尚无记录", "p")
    );
  }

  scholarPanel.append(overview, renderActionHints(player.role), stats, lists);
}

function renderScholarPanel(worldState) {
  const player = worldState.player;
  if (player.role === "emperor" || player.role === "minister" || player.role === "official" || player.role === "magistrate") {
    renderRolePanel(worldState);
    return;
  }

  if (player.role !== "scholar") {
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
  if (player.role === "official") {
    progressBlock.appendChild(createPanelValue("初授官职", player.officeTitle || "候选观政"));
  }

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
  actionInput.placeholder = ACTION_PLACEHOLDERS[worldState.player.role] || "输入你的行动";
}

function appendNarrative(text, className) {
  const placeholder = narrative.querySelector(".placeholder");
  if (placeholder) placeholder.remove();

  const paragraph = document.createElement("p");
  paragraph.className = ["narrative-entry", className].filter(Boolean).join(" ");
  paragraph.textContent = text;
  narrative.appendChild(paragraph);
  narrative.scrollTop = narrative.scrollHeight;
}

function beginNarrativeStream() {
  activeNarrativeStream = null;
}

function appendNarrativeChunk(text) {
  const placeholder = narrative.querySelector(".placeholder");
  if (placeholder) placeholder.remove();

  if (!activeNarrativeStream) {
    activeNarrativeStream = document.createElement("p");
    activeNarrativeStream.className = "narrative-entry is-streaming";
    narrative.appendChild(activeNarrativeStream);
  }

  activeNarrativeStream.textContent += text;
  narrative.scrollTop = narrative.scrollHeight;
}

function finishNarrativeStream() {
  if (activeNarrativeStream) {
    activeNarrativeStream.classList.remove("is-streaming");
    activeNarrativeStream = null;
  }
}

function appendTurnDivider(label) {
  const placeholder = narrative.querySelector(".placeholder");
  if (placeholder) placeholder.remove();

  const divider = document.createElement("div");
  divider.className = "turn-divider";
  divider.textContent = label;
  narrative.appendChild(divider);
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
    if (change.reason) {
      tag.title = change.reason;
    }
    div.appendChild(tag);
  });
  narrative.appendChild(div);
  narrative.scrollTop = narrative.scrollHeight;
}

function formatSignedDelta(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function appendRelationshipChanges(changes) {
  if (!Array.isArray(changes) || !changes.length) return;

  changes.forEach((change) => {
    const relationshipDelta = change.relationship?.delta || 0;
    const resentmentDelta = change.resentment?.delta || 0;
    const parts = [];
    if (relationshipDelta) parts.push(`关系 ${formatSignedDelta(relationshipDelta)}`);
    if (resentmentDelta) parts.push(`怨望 ${formatSignedDelta(resentmentDelta)}`);

    const target = change.name || change.targetId || "未知人脉";
    const detail = parts.length ? parts.join("，") : "态度有变";
    const note = change.note ? `：${change.note}` : "";
    appendNarrative(`[人脉] ${target} ${detail}${note}`, "relationship-change");
  });
}

function appendWorldTickFeedback(worldTick) {
  if (!worldTick) return;
  const events = Array.isArray(worldTick.events) ? worldTick.events : [];

  if (events.length) {
    events.forEach((event) => appendNarrative(`[月度] ${event}`, "world-tick"));
  } else if (worldTick.summary) {
    appendNarrative(`[月度] ${worldTick.summary}`, "world-tick");
  }
}

function renderExamModal(payload) {
  currentExamPayload = payload;
  examModal.classList.remove("exam-modal--result");
  examMeta.textContent = `${payload.examName} · ${payload.questionType} · ${payload.difficulty}`;
  examTitle.textContent = payload.examName;
  examQuestion.textContent = payload.examQuestion;
  examQuestion.hidden = false;
  examRequirements.hidden = false;
  examRequirements.innerHTML = "";
  (payload.requirements || []).forEach((requirement) => {
    const item = document.createElement("li");
    item.textContent = requirement;
    examRequirements.appendChild(item);
  });
  examEssay.value = "";
  examEssay.hidden = false;
  examWritingTools.hidden = false;
  examResult.hidden = true;
  examResult.innerHTML = "";
  examSubmit.disabled = true;
  examSubmit.hidden = false;
  examSubmit.textContent = "交卷";
  examSubmit.title = "";
  updateExamWordState();
  examBackdrop.hidden = false;
  examEssay.focus();
}

function closeExamModal() {
  examBackdrop.hidden = true;
}

function getEssayCharacterCount() {
  return [...examEssay.value.trim()].length;
}

function updateExamWordState() {
  if (!examWritingTools || examWritingTools.hidden) return;

  const count = getEssayCharacterCount();
  const range = currentExamPayload?.wordCount;
  examWordCount.textContent = `${count}字`;

  if (!range) {
    examWordGuide.textContent = "";
    examWritingTools.dataset.state = "";
    return;
  }

  if (count < range.min) {
    examWordGuide.textContent = `未足${range.min}字`;
    examWritingTools.dataset.state = "short";
  } else if (count > range.max) {
    examWordGuide.textContent = `已逾${range.max}字`;
    examWritingTools.dataset.state = "long";
  } else {
    examWordGuide.textContent = `${range.min}-${range.max}字之间`;
    examWritingTools.dataset.state = "ready";
  }
}

function updateExamSubmitState() {
  updateExamWordState();
  examSubmit.disabled = !currentExamPayload || !examEssay.value.trim();
}

function createScoreItem(label, value) {
  const item = document.createElement("div");
  item.className = "score-item";
  const name = document.createElement("span");
  name.textContent = label;
  const score = document.createElement("strong");
  score.textContent = value;
  item.append(name, score);
  return item;
}

function describePromotionOutcome(promotionResult) {
  if (promotionResult.passed) {
    return promotionResult.officeTitle
      ? `${promotionResult.rank}，初授${promotionResult.officeTitle}`
      : `取中${promotionResult.rank}`;
  }
  if (promotionResult.consequence) {
    return promotionResult.consequence.label;
  }
  return "未取中";
}

function createResultSection(title, content, open = true) {
  const details = document.createElement("details");
  details.className = "result-section";
  details.open = open;

  const summary = document.createElement("summary");
  summary.textContent = title;
  details.append(summary, content);
  return details;
}

function renderExamResult(payload) {
  const playerEntry = payload.ranking.find((entry) => entry.isPlayer);
  const flags = payload.authenticityCheck.flags || [];
  const promotionText = describePromotionOutcome(payload.promotionResult);

  examModal.classList.add("exam-modal--result");
  examMeta.textContent = `${payload.examName} · 放榜`;
  examTitle.textContent = payload.promotionResult.passed ? "金榜有名" : payload.promotionResult.severeCheat ? "监试黜落" : "榜上无名";
  examQuestion.hidden = true;
  examRequirements.hidden = true;
  examWritingTools.hidden = true;
  examEssay.hidden = true;
  examSubmit.hidden = true;
  examResult.hidden = false;
  examResult.innerHTML = "";

  const summary = document.createElement("section");
  summary.className = "result-summary";
  summary.append(
    createScoreItem("总评", `${payload.score.overall_score}`),
    createScoreItem("等第", payload.score.rank),
    createScoreItem("名次", playerEntry ? `第${playerEntry.place}` : "未列榜"),
    createScoreItem("结果", promotionText)
  );
  if (payload.promotionResult.palaceRank) {
    summary.appendChild(createScoreItem("甲第", payload.promotionResult.palaceRank));
  }

  const feedback = document.createElement("p");
  feedback.className = "result-feedback";
  feedback.textContent = `${payload.score.detailed_feedback}\n${payload.promotionResult.reason}`;

  const dimensions = document.createElement("section");
  dimensions.className = "score-grid";
  Object.entries(SCORE_LABELS).forEach(([key, label]) => {
    const item = document.createElement("div");
    const score = payload.score[key];
    const heading = document.createElement("strong");
    heading.textContent = `${label} ${score.score}`;
    const comment = document.createElement("p");
    comment.textContent = score.comment;
    item.append(heading, comment);
    dimensions.appendChild(item);
  });

  const checks = document.createElement("section");
  checks.className = "auth-checks";
  if (flags.length) {
    flags.forEach((flag) => {
      const item = document.createElement("p");
      item.textContent = `${flag.label}：${flag.detail}`;
      checks.appendChild(item);
    });
  } else {
    const clean = document.createElement("p");
    clean.textContent = `未见明显作伪，正文约${payload.authenticityCheck.characterCount}字。`;
    checks.appendChild(clean);
  }

  const ranking = document.createElement("ol");
  ranking.className = "ranking-list";
  payload.ranking.forEach((entry) => {
    const item = document.createElement("li");
    if (entry.isPlayer) item.className = "is-player";
    const name = document.createElement("strong");
    name.textContent = `${entry.place}. ${entry.name}`;
    const detail = document.createElement("span");
    detail.textContent = `${entry.origin} · ${entry.score}分 · ${entry.rank}`;
    item.append(name, detail);
    ranking.appendChild(item);
  });

  examResult.append(
    summary,
    feedback,
    createResultSection("五维评卷", dimensions, true),
    createResultSection("监试复核", checks, Boolean(flags.length)),
    createResultSection("同场榜单", ranking, true)
  );
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

async function submitExamEssay() {
  if (!currentSessionId || !currentExamPayload) return;
  const essay = examEssay.value.trim();
  if (!essay) return;

  examSubmit.disabled = true;
  examSubmit.textContent = "评卷中...";

  try {
    const response = await fetch("/api/exam/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentSessionId,
        examId: currentExamPayload.examId,
        essay
      })
    });

    if (!response.ok) {
      let message = `交卷失败：${response.status}`;
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
    renderExamResult(payload);
    appendNarrative(
      `[放榜] ${payload.examName}得${payload.score.overall_score}分，${describePromotionOutcome(payload.promotionResult)}。`,
      "exam-hint"
    );
  } catch (error) {
    appendNarrative(error.message, "error");
    examSubmit.disabled = false;
    examSubmit.textContent = "交卷";
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

function parseSseBlock(block) {
  let eventName = "message";
  const dataLines = [];

  block.split("\n").forEach((line) => {
    if (!line || line.startsWith(":")) return;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim() || "message";
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  });

  const rawData = dataLines.join("\n");
  if (!rawData) {
    return { eventName, data: null };
  }

  try {
    return { eventName, data: JSON.parse(rawData) };
  } catch {
    return { eventName, data: rawData };
  }
}

async function readSseResponse(response, handlers) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSseBlock(block);
      const handler = handlers[parsed.eventName];
      if (handler) handler(parsed.data);
      boundary = buffer.indexOf("\n\n");
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer);
    const handler = handlers[parsed.eventName];
    if (handler) handler(parsed.data);
  }
}

async function handleTurnPayload(payload) {
  appendAttributeChanges(payload.attributeChanges);
  appendRelationshipChanges(payload.relationshipChanges);
  appendWorldTickFeedback(payload.worldTick);
  renderWorldState(payload.worldState);
  actionInput.value = "";

  if (payload.examTrigger && payload.examTrigger.shouldStart) {
    appendNarrative(`[科举提示] 已可参加考试：${EXAM_LABELS[payload.examTrigger.level] || payload.examTrigger.level}`, "exam-hint");
    await openExamQuestion(payload.examTrigger.level);
  }
}

async function submitAction() {
  const input = actionInput.value.trim();
  if (!input || !currentSessionId) return;

  actionBtn.disabled = true;
  actionInput.disabled = true;

  try {
    appendTurnDivider(`第${(currentWorldState?.turnCount || 0) + 1}回`);
    appendNarrative(input, "player-input");

    const response = await fetch("/api/game/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
      body: JSON.stringify({ sessionId: currentSessionId, input })
    });

    if (!response.ok) {
      let message = `行动失败：${response.status}`;
      try {
        const errorPayload = await response.json();
        if (errorPayload.error) message = errorPayload.error;
      } catch {
        // Keep the status-based message when the server did not send JSON.
      }
      throw new Error(message);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream") && response.body) {
      let finalPayload = null;
      let streamError = null;
      beginNarrativeStream();

      await readSseResponse(response, {
        narrative_chunk(data) {
          appendNarrativeChunk(typeof data === "string" ? data : data?.text || "");
        },
        final_state(data) {
          finalPayload = data;
          finishNarrativeStream();
        },
        error(data) {
          streamError = new Error(data?.error || "Stream error");
        }
      });

      finishNarrativeStream();
      if (streamError) throw streamError;
      if (!finalPayload) throw new Error("Stream response missing final_state.");
      await handleTurnPayload(finalPayload);
    } else {
      const payload = await response.json();
      appendNarrative(payload.narrative);
      await handleTurnPayload(payload);
    }
  } catch (error) {
    finishNarrativeStream();
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
examEssay.addEventListener("input", updateExamSubmitState);
examSubmit.addEventListener("click", submitExamEssay);
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
      appendTurnDivider("存档记事");
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
