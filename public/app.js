const form = document.querySelector("#start-form");
const appShell = document.querySelector(".app-shell");
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
const examSceneTools = document.querySelector("#exam-scene-tools");
const examSceneStatus = document.querySelector("#exam-scene-status");
const examSceneActionButtons = document.querySelectorAll("[data-exam-action]");
const saveList = document.querySelector("#save-list");
const saveRefresh = document.querySelector("#save-refresh");
const saveStatus = document.querySelector("#save-status");
const saveBackdrop = document.querySelector("#save-backdrop");
const saveClose = document.querySelector("#save-close");
const saveModalList = document.querySelector("#save-modal-list");
const saveModalStatus = document.querySelector("#save-modal-status");
const aiTestButton = document.querySelector("#ai-test-button");
const aiTestStatus = document.querySelector("#ai-test-status");
const aiTestResult = document.querySelector("#ai-test-result");

let currentSessionId = null;
let currentWorldState = null;
let currentRelationshipView = null;
let currentActiveNpcRequestView = null;
let currentLongTermEventView = null;
let currentOfficialCareerView = null;
let currentWorldThreadView = null;
let currentExamCalendarView = null;
let currentExamRivalView = null;
let currentWorldGeographyView = null;
let currentWorldEntityView = null;
let currentWorldPeopleView = null;
let currentOfficialPostingsView = null;
let currentEventArchiveView = null;
let currentInformationPanelTab = "world-geography";
let currentExamPayload = null;
let activeNarrativeStream = null;
let latestSavePayload = { saves: [], skipped: [] };

const MONTH_LABELS = Object.freeze([
  "",
  "正月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "冬月",
  "腊月"
]);

const TEN_DAY_PERIOD_LABELS = Object.freeze({
  1: "上旬",
  2: "中旬",
  3: "下旬"
});

const INFORMATION_PANEL_TABS = Object.freeze([
  {
    id: "world-geography",
    label: "天下",
    title: "天下格局",
    panelId: "world-geography-panel",
    sourceView: "worldGeographyView"
  },
  {
    id: "posting-geography",
    label: "任所",
    title: "任所地理",
    panelId: "posting-geography-panel",
    sourceView: "officialPostingsView+worldGeographyView"
  },
  {
    id: "world-people",
    label: "人物",
    title: "人物谱牒",
    panelId: "world-people-panel",
    sourceView: "worldPeopleView"
  },
  {
    id: "official-postings",
    label: "官职",
    title: "官职簿",
    panelId: "official-postings-panel",
    sourceView: "officialPostingsView"
  },
  {
    id: "event-archive",
    label: "事件",
    title: "事件档案",
    panelId: "event-archive-panel",
    sourceView: "eventArchiveView"
  }
]);

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
  superiorFavor: "上官",
  peerNetwork: "同年",
  performanceMerit: "考成",
  promotionProspect: "升迁",
  impeachmentRisk: "弹劾",
  cleanReputation: "清操",
  command: "统率",
  troops: "部曲",
  supply: "军粮",
  battleReputation: "战名",
  scouting: "侦察",
  campaignRisk: "战险",
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
  general: "输入你的行动，例如：遣斥候巡边、清点军粮，或率营出战",
  official: "输入你的行动，例如：奉上官考成、拜会同年，或弹劾贪墨官员",
  magistrate: "输入你的行动，例如：审理词讼、清查钱粮，或兴修水利"
};

const ROLE_ACTION_HINTS = {
  emperor: ["下诏赈灾", "任免官员", "加税筹饷", "练兵备边"],
  minister: ["上疏谏言", "督办公务", "结交同僚", "弹劾攻讦"],
  general: ["募兵整补", "清点粮饷", "操练士卒", "遣斥候侦察", "修堡守边", "率营出战"],
  official: ["奉上官差遣", "经营同年", "办理考成", "谋求升迁", "弹劾贪墨", "谨守清操"],
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

const EXAM_SCENE_PHASE_ORDER = ["entry", "question_review", "outline", "drafting", "fair_copy"];

const SCORE_LABELS = {
  content_quality: "义理内容",
  argument_strength: "论证力",
  literary_style: "文笔修辞",
  classical_format: "文体格式",
  historical_appropriateness: "时代语境"
};

const RELATIONSHIP_LABELS = {
  trusted: "深信",
  friendly: "亲近",
  neutral: "平平",
  strained: "龃龉",
  hostile: "敌意"
};

const RESENTMENT_LABELS = {
  dangerous: "危急",
  watchful: "须防",
  uneasy: "微怨",
  quiet: "平静"
};

const CONTACT_NAME_LABELS = {
  eunuchs: "内廷宦官",
  scholarOfficials: "士大夫",
  militaryLords: "边镇武臣",
  "Eunuch faction": "内廷宦官",
  "Scholar-official faction": "士大夫",
  "Military faction": "边镇武臣"
};

const STANCE_LABELS = {
  mentor: "塾师提携",
  courtier: "朝臣观望",
  colleague: "同僚试探",
  superior_or_peer: "上官同年",
  camp_contact: "营中袍泽",
  local_contact: "县衙乡里",
  palace_network: "内廷门路",
  orthodox_bureaucracy: "清流正统",
  armed_interest: "军镇利益",
  unknown_interest: "利害未明"
};

const NETWORK_SOURCE_LABELS = {
  county_school: "县学师承",
  court_audience: "朝会传闻",
  ministry_office: "部曹公事",
  bureaucratic_posting: "官署差遣",
  military_camp: "军营袍泽",
  county_yamen: "县衙乡里",
  inner_court_whispers: "内廷风声",
  examination_and_memorial_network: "科举台谏",
  border_and_garrison_reports: "边报营牍",
  unclassified_reports: "未分类线索"
};

const INTENT_LABELS = {
  "Test the player's diligence and recommend steady study.": "试其勤学，酌情引荐",
  "Read imperial favor and avoid being blamed for disorder.": "观望圣眷，避责求稳",
  "Watch whether the player can deliver policy results.": "考看政务成色",
  "Estimate the player's usefulness in local administration.": "衡量地方任事实用",
  "Judge the player's reliability with soldiers and supplies.": "审其军需可信",
  "See whether the player can settle local pressure.": "看其能否平息地方压力",
  "Protect palace channels and test whether the player threatens them.": "护持内廷门路，试探威胁",
  "Reward classical legitimacy and watch for factional recklessness.": "奖重正统名义，防其躁进",
  "Seek resources while resisting civilian overreach.": "索取军资，防文臣越界",
  "No stable intent has been recorded yet.": "尚无定见"
};

const ACTIVE_REQUEST_KIND_LABELS = {
  request: "请托",
  pressure: "施压",
  favor: "人情",
  backing: "背书",
  repayment: "回报"
};

const WORLD_THREAD_STATUS_LABELS = {
  active: "在办",
  watch: "余波",
  resolved: "归档"
};

const WORLD_THREAD_KIND_LABELS = {
  npc_request: "请托",
  seasonal: "岁时",
  disaster: "灾务",
  border: "边事",
  faction_conflict: "党争",
  local_case: "案链",
  consequence: "余波",
  official_assignment: "差事",
  official_outcome: "官场",
  role_impact: "联动"
};

const OFFICIAL_OUTCOME_LABELS = {
  appointment: "实授",
  transfer: "转任",
  promotion: "升迁",
  outpost: "外放",
  demotion: "降调",
  impeachment: "弹劾",
  punishment: "罚黜",
  retention: "留任"
};

const OFFICIAL_ASSIGNMENT_STATUS_LABELS = {
  active: "办理",
  submitted: "呈报",
  resolved: "已结",
  expired: "逾期",
  failed: "失办"
};

const OFFICIAL_PROCEDURE_STAGE_LABELS = {
  none: "未起",
  risk_watch: "风闻",
  memorial_filed: "弹章",
  audit_open: "查核",
  discipline_pending: "候议",
  resolved: "已结"
};

const OFFICIAL_RECOMMENDATION_LABELS = {
  court_nomination: "廷推候议",
  transfer: "迁转呈议",
  outpost: "外放呈议",
  mourning_leave: "丁忧具报",
  restoration: "起复候议"
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

function normalizeInteger(value, min, max, fallback) {
  const parsed = Number(value);
  const integer = Number.isFinite(parsed) ? Math.round(parsed) : fallback;
  return Math.max(min, Math.min(max, integer));
}

function getVisibleMonthName(month) {
  const normalized = normalizeInteger(month, 1, 12, 1);
  return MONTH_LABELS[normalized] || `${normalized}月`;
}

function getVisibleTenDayPeriodLabel(period) {
  return TEN_DAY_PERIOD_LABELS[normalizeInteger(period, 1, 3, 1)] || "上旬";
}

function readDateLabel(source = {}) {
  return source.currentDateLabel || source.dateLabel || source.label || "";
}

function formatVisibleDate(source = {}) {
  const existing = readDateLabel(source);
  if (typeof existing === "string" && /年.+旬/.test(existing)) {
    return existing.trim();
  }
  const dynasty = source.dynasty ? `${source.dynasty}` : "";
  const yearValue = Number(source.year ?? source.currentYear);
  const year = Number.isFinite(yearValue) ? Math.round(yearValue) : "-";
  const month = source.month ?? source.currentMonth;
  const tenDayPeriod = source.tenDayPeriod ?? source.currentTenDayPeriod;
  return `${dynasty}${year}年${getVisibleMonthName(month)}${getVisibleTenDayPeriodLabel(tenDayPeriod)}`;
}

function formatSaveTime(value) {
  if (!value) return "未记时";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未记时";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function describeSave(save) {
  return [
    formatVisibleDate({ dynasty: save.dynasty || "未定朝", year: save.year, month: save.month, tenDayPeriod: save.tenDayPeriod }),
    save.roleLabel || save.role || "未定身份",
    save.examRank ? `科名 ${save.examRank}` : null,
    save.officeTitle ? `官职 ${save.officeTitle}` : null,
    `回合 ${save.turnCount ?? 0}`
  ].filter(Boolean).join(" · ");
}

function createSaveCard(save, options = {}) {
  const card = document.createElement("article");
  const isCurrent = save.sessionId && save.sessionId === currentSessionId;
  card.className = ["save-card", isCurrent ? "is-current" : ""].filter(Boolean).join(" ");
  card.dataset.saveId = save.sessionId || "";
  card.dataset.saveRole = save.role || "";

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = save.playerName || "未名旅人";
  const time = document.createElement("small");
  time.textContent = formatSaveTime(save.updatedAt || save.createdAt);
  header.append(title, time);

  const detail = document.createElement("p");
  detail.textContent = describeSave(save);

  const summary = document.createElement("p");
  summary.textContent = save.summary || "未留案语";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = isCurrent ? "当前" : "载入";
  button.disabled = isCurrent && options.disableCurrent !== false;
  button.addEventListener("click", () => {
    if (!save.sessionId || button.disabled) return;
    loadSaveSession(save.sessionId, { source: options.source || "save-list" });
  });

  card.append(header, detail, summary, button);
  return card;
}

function renderSaveList(target, statusTarget, payload = latestSavePayload, options = {}) {
  if (!target || !statusTarget) return;

  const saves = Array.isArray(payload?.saves) ? payload.saves : [];
  const skipped = Array.isArray(payload?.skipped) ? payload.skipped : [];
  target.innerHTML = "";

  if (!saves.length) {
    statusTarget.textContent = skipped.length
      ? `暂无可载入存档，另有${skipped.length}份存档未能读取。`
      : "暂无存档。";
    return;
  }

  statusTarget.textContent = skipped.length
    ? `可载入 ${saves.length} 份，另有 ${skipped.length} 份未能读取。`
    : `可载入 ${saves.length} 份。`;

  saves.slice(0, options.limit || 8).forEach((save) => {
    target.appendChild(createSaveCard(save, options));
  });
}

async function refreshSaveList(options = {}) {
  const statusTargets = [saveStatus, options.modal ? saveModalStatus : null].filter(Boolean);
  statusTargets.forEach((target) => {
    target.textContent = "正在查阅存档...";
  });

  try {
    const response = await fetch("/api/game/saves");
    if (!response.ok) {
      throw new Error(`存档列表读取失败：${response.status}`);
    }

    latestSavePayload = await response.json();
    renderSaveList(saveList, saveStatus, latestSavePayload, { source: "start-save-list", limit: 5 });
    renderSaveList(saveModalList, saveModalStatus, latestSavePayload, { source: "modal-save-list" });
    return latestSavePayload;
  } catch (error) {
    if (saveStatus) saveStatus.textContent = error.message;
    if (saveModalStatus) saveModalStatus.textContent = error.message;
    if (saveList) saveList.innerHTML = "";
    if (saveModalList) saveModalList.innerHTML = "";
    return { saves: [], skipped: [] };
  }
}

function formatModelSummary(models = {}) {
  return Object.entries(models)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join("；");
}

function renderAiConnectionResult(payload) {
  if (!aiTestStatus || !aiTestResult) return;

  aiTestResult.innerHTML = "";
  aiTestResult.dataset.ok = payload.ok ? "true" : "false";
  aiTestStatus.textContent = payload.ok
    ? `${payload.provider} 可用，耗时 ${payload.latencyMs}ms。`
    : `${payload.provider || "AI"} 不可用：${payload.error || "未知错误"}`;

  const details = [
    payload.configuredProvider ? `当前配置：${payload.configuredProvider}` : null,
    payload.supportsStreaming ? "支持流式回合" : null,
    payload.models ? formatModelSummary(payload.models) : null,
    payload.narrativePreview ? `回声：${payload.narrativePreview}` : null
  ].filter(Boolean);

  details.forEach((text) => {
    const item = document.createElement("p");
    item.textContent = text;
    aiTestResult.appendChild(item);
  });
}

async function testAiConnection() {
  if (!aiTestButton || !aiTestStatus) return;
  aiTestButton.disabled = true;
  aiTestButton.textContent = "校验中...";
  aiTestStatus.textContent = "正在请后端执行一次不落盘的 AI JSON 校验...";
  if (aiTestResult) {
    aiTestResult.innerHTML = "";
    aiTestResult.dataset.ok = "";
  }

  try {
    const response = await fetch("/api/ai/connection-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    const payload = await response.json();
    renderAiConnectionResult(payload);
  } catch (error) {
    renderAiConnectionResult({
      ok: false,
      provider: "AI",
      error: error.message
    });
  } finally {
    aiTestButton.disabled = false;
    aiTestButton.textContent = "校验";
  }
}

async function loadSaveSession(sessionId, options = {}) {
  if (!sessionId) return;

  try {
    const response = await fetch(`/api/game/state/${sessionId}`);
    if (!response.ok) {
      if (response.status === 404) localStorage.removeItem("qianqiu.sessionId");
      throw new Error(`载入失败：${response.status}`);
    }

    const payload = await response.json();
    currentSessionId = payload.sessionId;
    localStorage.setItem("qianqiu.sessionId", payload.sessionId);
    renderPayloadWorldState(payload);
    narrative.innerHTML = "";
    const history = archiveNarrativeEntriesFromPayload(payload);
    if (history.length) {
      appendTurnDivider(options.restore ? "存档记事" : "载入存档");
      history.forEach((event) => appendNarrative(event));
    } else {
      appendNarrative(options.restore ? "存档已恢复。继续你的旅程。" : "存档已载入。继续你的旅程。");
    }
    showGameView();
    closeSaveModal();
    renderSaveList(saveList, saveStatus, latestSavePayload, { source: "start-save-list", limit: 5 });
    renderSaveList(saveModalList, saveModalStatus, latestSavePayload, { source: "modal-save-list" });
  } catch (error) {
    appendNarrative(error.message, "error");
    if (options.restore) {
      localStorage.removeItem("qianqiu.sessionId");
    }
  }
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

function localizeRelationshipLabel(label) {
  return RELATIONSHIP_LABELS[label] || label || "平平";
}

function localizeResentmentLabel(label) {
  return RESENTMENT_LABELS[label] || label || "平静";
}

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(value);
}

function classifyRelationshipText(value, fallback) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text) return fallback;
  if (hasChineseText(text)) return text;

  const lower = text.toLowerCase();
  if (/mentor|teacher/.test(lower)) return "师长考察学业";
  if (/exam|classical|literati|bureaucracy|civil|clean|censor|remonstrance/.test(lower)) return "士林观望声名";
  if (/recommend|patron|support|back|favor/.test(lower)) return "斟酌举荐扶持";
  if (/study|learning|diligence|school/.test(lower)) return "师长考察学业";
  if (/palace|inner|eunuch|brokerage|private|channel/.test(lower)) return "内廷试探门路";
  if (/military|command|garrison|camp|frontier|armed|soldier|quartermaster|scout|campaign|border/.test(lower)) return "军中衡量功用";
  if (/county|gentry|local|yamen|villager|lawsuit|labor|waterworks|case|relief|farming/.test(lower)) return "地方观察治理";
  if (/office|assessment|promotion|superior|peer|merit|paperwork|scandal|impeachment|evidence/.test(lower)) return "官场衡量前程";
  if (/tax|revenue|fiscal|fund|grain|policy|appointment|memorial/.test(lower)) return "朝政权责观望";
  if (/threat|resist|critical|suspicious|uneasy|resentful/.test(lower)) return "戒备中";
  return fallback;
}

function localizeContactName(entry) {
  return CONTACT_NAME_LABELS[entry.id] || CONTACT_NAME_LABELS[entry.name] || entry.name || entry.id || "未名";
}

function localizeStance(value) {
  return STANCE_LABELS[value] || classifyRelationshipText(value, "立场未明");
}

function localizeNetworkSource(value) {
  return NETWORK_SOURCE_LABELS[value] || classifyRelationshipText(value, "来路未明");
}

function localizeRecentIntent(value) {
  return INTENT_LABELS[value] || classifyRelationshipText(value, "尚在观望");
}

function describeRelationship(value) {
  if (value >= 60) return "trusted";
  if (value >= 20) return "friendly";
  if (value > -20) return "neutral";
  if (value > -60) return "strained";
  return "hostile";
}

function describeResentment(value) {
  if (value >= 70) return "dangerous";
  if (value >= 40) return "watchful";
  if (value >= 15) return "uneasy";
  return "quiet";
}

function buildFallbackRelationshipView(worldState) {
  const ledger = worldState?.relationshipLedger;
  if (!ledger) {
    return { schemaVersion: 1, generatedAtTurn: worldState?.turnCount || 0, contacts: [], factions: [], recentNotes: [], hiddenNotice: "" };
  }

  const toEntry = (entry, type) => {
    const relationship = Number.isFinite(Number(entry.relationship)) ? Number(entry.relationship) : 0;
    const resentment = Number.isFinite(Number(entry.resentment)) ? Number(entry.resentment) : 0;
    return {
      type,
      id: entry.id,
      name: entry.name,
      role: entry.role,
      stance: entry.stance,
      relationship,
      relationshipLabel: describeRelationship(relationship),
      resentment,
      resentmentLabel: describeResentment(resentment),
      networkSource: entry.networkSource,
      recentIntent: entry.recentIntent,
      lastUpdatedTurn: entry.lastUpdatedTurn || 0
    };
  };
  const visibleCharacters = Object.values(ledger.characters || {}).filter((entry) => entry.visible !== false);
  const visibleFactions = Object.values(ledger.factions || {}).filter((entry) => entry.visible !== false);
  const visibleNames = new Set([...visibleCharacters, ...visibleFactions].map((entry) => `${entry.name}:`));

  return {
    schemaVersion: 1,
    generatedAtTurn: worldState?.turnCount || 0,
    contacts: visibleCharacters.map((entry) => toEntry(entry, "character")),
    factions: visibleFactions.map((entry) => toEntry(entry, "faction")),
    recentNotes: (ledger.recentNotes || []).filter((note) =>
      [...visibleNames].some((prefix) => typeof note === "string" && note.startsWith(prefix))
    ),
    hiddenNotice: [...Object.values(ledger.characters || {}), ...Object.values(ledger.factions || {})].some((entry) => entry.visible === false)
      ? "Some relationships remain outside the player's current knowledge."
      : ""
  };
}

function getRelationshipView(worldState, relationshipView) {
  if (relationshipView && Array.isArray(relationshipView.contacts) && Array.isArray(relationshipView.factions)) {
    return relationshipView;
  }
  return buildFallbackRelationshipView(worldState);
}

function getActiveNpcRequestView(activeNpcRequestView) {
  if (activeNpcRequestView && typeof activeNpcRequestView === "object" && activeNpcRequestView.status === "active") {
    return activeNpcRequestView;
  }
  return null;
}

function getWorldThreadView(worldState, worldThreadView) {
  if (worldThreadView && typeof worldThreadView === "object" && Array.isArray(worldThreadView.activeThreads)) {
    return worldThreadView;
  }
  return {
    schemaVersion: 1,
    generatedAtTurn: worldState?.turnCount || 0,
    activeThreads: [],
    recentResolved: []
  };
}

function getOfficialCareerView(worldState, officialCareerView) {
  if (officialCareerView && typeof officialCareerView === "object") {
    return officialCareerView;
  }
  const history = Array.isArray(worldState?.officialCareer?.careerHistory)
    ? worldState.officialCareer.careerHistory.slice(-5)
    : [];
  return {
    schemaVersion: 1,
    generatedAtTurn: worldState?.turnCount || 0,
    active: worldState?.player?.role === "official",
    currentPosting: worldState?.player?.officeTitle || worldState?.player?.position || null,
    tenureMonths: worldState?.officialCareer?.tenureMonths || 0,
    reviewCycleMonths: worldState?.officialCareer?.reviewCycleMonths || 12,
    nextReviewInMonths: null,
    careerScore: 0,
    riskScore: 0,
    bureau: null,
    assignmentSummary: null,
    assignments: [],
    assessment: null,
    networkSummary: null,
    procedureSummary: null,
    pendingReview: false,
    lastOutcome: history.at(-1) || null,
    recentOutcomes: history
  };
}

function getExamCalendarView(worldState, examCalendarView) {
  if (examCalendarView && typeof examCalendarView === "object") {
    return examCalendarView;
  }
  const calendar = worldState?.examCalendar || {};
  return {
    schemaVersion: calendar.schemaVersion || 1,
    currentYear: worldState?.year,
    currentMonth: worldState?.month,
    currentTenDayPeriod: worldState?.tenDayPeriod,
    currentDateLabel: formatVisibleDate(worldState || {}),
    nextExam: null,
    missedWindows: Array.isArray(calendar.missedWindows) ? calendar.missedWindows.slice(-3) : [],
    recentSessions: Array.isArray(calendar.recentSessions) ? calendar.recentSessions.slice(-4) : []
  };
}

function getExamRivalView(worldState, examRivalView) {
  if (examRivalView && typeof examRivalView === "object") {
    return examRivalView;
  }
  const rivals = Array.isArray(worldState?.examCalendar?.rivals) ? worldState.examCalendar.rivals : [];
  return {
    schemaVersion: worldState?.examCalendar?.schemaVersion || 1,
    rivals: rivals.slice(-6).reverse().map((rival) => ({
      id: rival.id,
      name: rival.name,
      origin: rival.origin,
      relationship: rival.relationship,
      contactId: rival.contactId || null,
      lastSeenLevel: rival.lastSeenLevel,
      lastSeenYear: rival.lastSeenYear,
      lastSeenMonth: rival.lastSeenMonth,
      attempts: Array.isArray(rival.attempts) ? rival.attempts.length : 0,
      latest: Array.isArray(rival.attempts) ? rival.attempts.at(-1) : null
    })),
    recentSessions: Array.isArray(worldState?.examCalendar?.recentSessions)
      ? worldState.examCalendar.recentSessions.slice(-4)
      : []
  };
}

function getRouteView(view) {
  return view && typeof view === "object" && !Array.isArray(view) ? view : null;
}

function viewArray(view, key) {
  return Array.isArray(view?.[key]) ? view[key] : [];
}

function archiveNarrativeEntriesFromPayload(payload) {
  return viewArray(getRouteView(payload?.eventArchiveView), "items")
    .filter((item) => item?.sourceType === "event_history" && typeof item.summary === "string")
    .slice()
    .reverse()
    .map((item) => item.summary.trim())
    .filter(Boolean);
}

function countViewRows(view, keys) {
  return keys.reduce((total, key) => total + viewArray(view, key).length, 0);
}

function countEntityRows(view) {
  return viewArray(view, "groups").reduce((total, group) => total + viewArray(group, "entities").length, 0);
}

function buildInformationPanelSummary(tab) {
  const geography = currentWorldGeographyView;
  const entities = currentWorldEntityView;
  const people = currentWorldPeopleView;
  const postings = currentOfficialPostingsView;
  const longTerm = currentLongTermEventView;
  const threads = currentWorldThreadView;
  const archive = currentEventArchiveView;

  if (tab.id === "world-geography") {
    const counts = [
      ["国家", viewArray(geography, "countries").length],
      ["城市", viewArray(geography, "cities").length],
      ["路线", viewArray(geography, "routes").length],
      ["边面", viewArray(geography, "frontierZones").length],
      ["辖区", viewArray(geography, "officeJurisdictions").length]
    ];
    const supportCount =
      viewArray(entities, "highlights").length +
      viewArray(threads, "activeThreads").length +
      viewArray(longTerm, "activeEvents").length;
    return {
      ready: Boolean(geography),
      generatedAtTurn: geography?.generatedAtTurn,
      counts,
      total: countViewRows(geography, ["countries", "cities", "routes", "frontierZones", "officeJurisdictions"]),
      note: supportCount ? `旁参 ${supportCount} 条实体、议程与长期事件摘要。` : "天下形势已入簿，细目待后续铺陈。"
    };
  }

  if (tab.id === "posting-geography") {
    const counts = [
      ["任所", viewArray(postings, "postings").length],
      ["城市辖区", viewArray(postings, "cityJurisdictions").length],
      ["可见城市", viewArray(geography, "cities").length],
      ["可见路线", viewArray(geography, "routes").length]
    ];
    return {
      ready: Boolean(postings && geography),
      generatedAtTurn: postings?.generatedAtTurn ?? geography?.generatedAtTurn,
      counts,
      total: viewArray(postings, "postings").length + viewArray(postings, "cityJurisdictions").length,
      note: "任所与地理先成簿面，辖区、路线和压力细目待后续补入。"
    };
  }

  if (tab.id === "world-people") {
    const counts = [
      ["人物", viewArray(people, "npcs").length],
      ["家族", viewArray(people, "households").length],
      ["资产", viewArray(people, "assets").length],
      ["田产", viewArray(people, "estates").length],
      ["关系", viewArray(people, "relationships").length]
    ];
    return {
      ready: Boolean(people),
      generatedAtTurn: people?.generatedAtTurn,
      counts,
      total: countViewRows(people, ["npcs", "households", "assets", "estates", "relationships"]),
      note: "人物、家族与关系先成索引，谱牒细目待后续补入。"
    };
  }

  if (tab.id === "official-postings") {
    const counts = [
      ["官署", viewArray(postings, "bureaus").length],
      ["官职", viewArray(postings, "offices").length],
      ["任命", viewArray(postings, "postings").length],
      ["考成", viewArray(postings, "assessmentRecords").length],
      ["迁转", viewArray(postings, "transferRecords").length]
    ];
    return {
      ready: Boolean(postings),
      generatedAtTurn: postings?.generatedAtTurn,
      counts,
      total: countViewRows(postings, ["bureaus", "offices", "postings", "assessmentRecords", "transferRecords"]),
      note: "官署官职只作公开查阅，不作任免或调任入口。"
    };
  }

  return {
    ready: Boolean(archive),
    generatedAtTurn: archive?.generatedAtTurn,
    counts: [
      ["档案", archive?.counts?.total ?? viewArray(archive, "items").length],
      ["近事", archive?.counts?.event_history ?? 0],
      ["议程", archive?.counts?.world_thread ?? 0],
      ["长期", archive?.counts?.long_term_event ?? 0],
      ["官科", (archive?.counts?.official_career ?? 0) + (archive?.counts?.exam_record ?? 0)]
    ],
    total: archive?.counts?.total ?? viewArray(archive, "items").length,
    note: archive?.hiddenNotice || "事件档案由服务器整理为公开卷宗。"
  };
}

function isInformationTabDisabled(tab) {
  return tab.id === "event-archive" && !currentEventArchiveView;
}

function buildRowMap(rows = []) {
  return new Map(viewArray({ rows }, "rows").filter((row) => row?.id).map((row) => [row.id, row]));
}

function rowName(map, id, fallback = "未明") {
  if (!id) return fallback;
  const row = map.get(id);
  return row?.name || row?.familyName || row?.shortName || row?.title || row?.officeTitle || fallback;
}

function compactList(values = [], fallback = "未明", limit = 4) {
  const list = Array.isArray(values)
    ? values.map((value) => `${value || ""}`.trim()).filter(Boolean)
    : [];
  return list.length ? list.slice(0, limit).join("、") : fallback;
}

function metricText(value, suffix = "") {
  if (value === undefined || value === null || value === "") return "未明";
  if (typeof value === "number" && Number.isFinite(value)) return `${Math.round(value)}${suffix}`;
  return `${value}${suffix}`;
}

function geographyPressureScore(row = {}) {
  return Math.max(
    Number(row.pressure) || 0,
    Number(row.risk) || 0,
    100 - (Number(row.stability) || 100),
    Number(row.priority) || 0
  );
}

function topPressureRows(rows = [], limit = 2) {
  return rows
    .slice()
    .sort((first, second) => {
      const delta = geographyPressureScore(second) - geographyPressureScore(first);
      return delta || `${first.id || ""}`.localeCompare(`${second.id || ""}`);
    })
    .slice(0, limit);
}

function topRowsByScore(rows = [], scorer, limit = 2) {
  return rows
    .slice()
    .sort((first, second) => {
      const delta = (Number(scorer(second)) || 0) - (Number(scorer(first)) || 0);
      return delta || `${first.id || ""}`.localeCompare(`${second.id || ""}`);
    })
    .slice(0, limit);
}

function statusLabel(value, labels = {}) {
  if (!value) return "未详";
  return labels[value] || `${value}`;
}

function formatRecordDate(date = {}) {
  if (!date || typeof date !== "object") return "未记";
  return formatVisibleDate({ dynasty: currentWorldState?.dynasty, ...date });
}

function createInformationMetric(label, value, className = "") {
  const item = document.createElement("p");
  item.className = ["information-card-metric", className].filter(Boolean).join(" ");
  const kicker = document.createElement("span");
  kicker.className = "relationship-kicker";
  kicker.textContent = label;
  const text = document.createElement("span");
  text.textContent = value === undefined || value === null || value === "" ? "未明" : `${value}`;
  item.append(kicker, text);
  return item;
}

function createInformationDetailCard(options = {}) {
  const card = document.createElement("article");
  card.className = options.className || "information-detail-card";
  card.dataset.kind = options.kind || "";
  card.dataset.entityId = options.entityId || "";
  if (options.status) card.dataset.status = options.status;
  if (options.visibility) card.dataset.visibility = options.visibility;
  if (options.cityId) card.dataset.cityId = options.cityId;
  if (options.routeId) card.dataset.routeId = options.routeId;
  if (options.pressure !== undefined && options.pressure !== null) card.dataset.pressure = String(options.pressure);
  if (options.risk !== undefined && options.risk !== null) card.dataset.risk = String(options.risk);

  const header = document.createElement("header");
  appendIfText(header, "strong", options.title || "未名条目", "information-card-title");
  appendIfText(header, "span", options.meta || "");

  const summary = document.createElement("p");
  summary.className = "information-card-summary";
  summary.textContent = options.summary || "暂无公开案语。";

  const metrics = document.createElement("div");
  metrics.className = "information-card-metrics";
  (options.metrics || []).forEach(([label, value, className]) => {
    metrics.appendChild(createInformationMetric(label, value, className));
  });

  card.append(header, summary);
  if (metrics.childNodes.length) card.appendChild(metrics);
  if (options.extra) {
    const extra = document.createElement("p");
    extra.className = "information-card-extra";
    extra.textContent = options.extra;
    card.appendChild(extra);
  }
  return card;
}

function renderInformationDetailSection(titleText, summaryText, cards = []) {
  const section = document.createElement("section");
  section.className = "information-detail-section";
  const header = document.createElement("header");
  appendIfText(header, "strong", titleText);
  appendIfText(header, "span", summaryText);
  section.appendChild(header);

  if (!cards.length) {
    const empty = document.createElement("p");
    empty.className = "information-panel-note";
    empty.textContent = "暂无可见细目。";
    section.appendChild(empty);
    return section;
  }

  const grid = document.createElement("div");
  grid.className = "information-detail-grid";
  cards.forEach((card) => grid.appendChild(card));
  section.appendChild(grid);
  return section;
}

function renderWorldGeographyDetails(geography = currentWorldGeographyView) {
  if (!geography) return null;
  const cityMap = buildRowMap(viewArray(geography, "cities"));
  const countryMap = buildRowMap(viewArray(geography, "countries"));
  const routeMap = buildRowMap(viewArray(geography, "routes"));
  const frontierMap = buildRowMap(viewArray(geography, "frontierZones"));
  const highlights = geography.highlights || {};
  const cards = [];

  topPressureRows(viewArray(highlights, "countries").length ? highlights.countries : viewArray(geography, "countries"), 2)
    .forEach((country) => {
      cards.push(createInformationDetailCard({
        className: "world-geography-card",
        kind: "country",
        entityId: country.id,
        status: country.status,
        visibility: country.visibility,
        pressure: country.pressure,
        title: country.name,
        meta: `国家 · ${country.statusLabel || "未详"}`,
        summary: country.publicSummary,
        metrics: [
          ["压力", metricText(country.pressure)],
          ["安稳", metricText(country.stability)],
          ["信度", metricText(country.intelConfidence)]
        ],
        extra: compactList(country.cultureTags || country.governmentTags, "暂无公开标签")
      }));
    });

  topPressureRows(viewArray(highlights, "cities").length ? highlights.cities : viewArray(geography, "cities"), 2)
    .forEach((city) => {
      cards.push(createInformationDetailCard({
        className: "world-geography-card",
        kind: "city",
        entityId: city.id,
        status: city.status,
        visibility: city.visibility,
        cityId: city.id,
        pressure: city.pressure,
        title: city.name,
        meta: `${rowName(countryMap, city.countryId, "未知邦国")} · ${city.statusLabel || "未详"}`,
        summary: city.publicSummary,
        metrics: [
          ["压力", metricText(city.pressure)],
          ["民心", metricText(city.localOrder)],
          ["粮压", metricText(city.grainStress)]
        ],
        extra: compactList(city.strategicTags, city.terrain || "暂无公开标签")
      }));
    });

  topPressureRows(viewArray(highlights, "routes").length ? highlights.routes : viewArray(geography, "routes"), 2)
    .forEach((route) => {
      const endpoint = `${rowName(cityMap, route.fromCityId)}至${rowName(cityMap, route.toCityId)}`;
      cards.push(createInformationDetailCard({
        className: "world-geography-card",
        kind: "route",
        entityId: route.id,
        status: route.status,
        visibility: route.visibility,
        routeId: route.id,
        risk: route.risk,
        title: route.name,
        meta: `路线 · ${route.statusLabel || "未详"}`,
        summary: route.publicSummary,
        metrics: [
          ["风险", metricText(route.risk)],
          ["里程", route.distanceLabel || "未详"],
          ["端点", endpoint]
        ],
        extra: route.seasonalRisk || compactList(route.strategicTags, "暂无时令风险")
      }));
    });

  topPressureRows(viewArray(highlights, "frontierZones").length ? highlights.frontierZones : viewArray(geography, "frontierZones"), 1)
    .forEach((frontier) => {
      cards.push(createInformationDetailCard({
        className: "world-geography-card",
        kind: "frontier",
        entityId: frontier.id,
        status: frontier.status,
        visibility: frontier.visibility,
        pressure: frontier.pressure,
        title: frontier.name,
        meta: `边面 · ${frontier.statusLabel || "未详"}`,
        summary: frontier.publicSummary,
        metrics: [
          ["压力", metricText(frontier.pressure)],
          ["邻境", rowName(countryMap, frontier.neighborCountryId)],
          ["路线", compactList((frontier.routeIds || []).map((id) => rowName(routeMap, id, "")), "暂无")]
        ],
        extra: compactList((frontier.cityIds || []).map((id) => rowName(cityMap, id, "")), "未列可见城市")
      }));
    });

  topPressureRows(viewArray(geography, "officeJurisdictions"), 1)
    .forEach((jurisdiction) => {
      cards.push(createInformationDetailCard({
        className: "world-geography-card",
        kind: "office-jurisdiction",
        entityId: jurisdiction.id,
        visibility: jurisdiction.visibility,
        pressure: jurisdiction.priority,
        title: jurisdiction.name,
        meta: `辖区 · ${jurisdiction.scope || "未详"}`,
        summary: jurisdiction.publicSummary,
        metrics: [
          ["优先", metricText(jurisdiction.priority)],
          ["城市", metricText((jurisdiction.cityIds || []).length)],
          ["路线", metricText((jurisdiction.routeIds || []).length)]
        ],
        extra: compactList((jurisdiction.cityIds || []).map((id) => rowName(cityMap, id, "")), "未列可见城市")
      }));
    });

  return renderInformationDetailSection("地理要目", `${cards.length}条可见细目`, cards);
}

function formatLocalMetrics(metrics = {}) {
  return [
    ["民心", metricText(metrics.publicOrder)],
    ["税力", metricText(metrics.taxCapacity)],
    ["词讼", metricText(metrics.lawsuits)],
    ["水利", metricText(metrics.waterworks)]
  ];
}

function renderPostingGeographyDetails(postings = currentOfficialPostingsView, geography = currentWorldGeographyView) {
  if (!postings || !geography) return null;
  const cityMap = buildRowMap(viewArray(geography, "cities"));
  const regionMap = buildRowMap(viewArray(geography, "regions"));
  const routeMap = buildRowMap(viewArray(geography, "routes"));
  const frontierMap = buildRowMap(viewArray(geography, "frontierZones"));
  const bureauMap = buildRowMap(viewArray(postings, "bureaus"));
  const jurisdictionMap = buildRowMap(viewArray(postings, "cityJurisdictions"));
  const cards = [];

  const activePostings = viewArray(postings, "postings")
    .filter((posting) => posting.status === "active" || posting.holderType === "player")
    .slice(0, 2);

  activePostings.forEach((posting) => {
    cards.push(createInformationDetailCard({
      className: "posting-geography-card",
      kind: "posting",
      entityId: posting.id,
      status: posting.status,
      visibility: posting.visibility,
      cityId: posting.cityId,
      title: posting.officeTitle || "当前任所",
      meta: `${rowName(bureauMap, posting.bureauId, "未明官署")} · ${rowName(cityMap, posting.cityId, "未明城市")}`,
      summary: posting.publicSummary,
      metrics: [
        ["考成", metricText(posting.performanceScore)],
        ["弹劾", metricText(posting.impeachmentRisk)],
        ["清望", metricText(posting.publicReputation)],
        ["任期", `${posting.termMonths ?? 0}月`]
      ],
      extra: rowName(jurisdictionMap, posting.jurisdictionId, "辖区未明")
    }));
  });

  const selectedJurisdictionIds = new Set(activePostings.map((posting) => posting.jurisdictionId).filter(Boolean));
  const selectedJurisdictions = [
    ...viewArray(postings, "cityJurisdictions").filter((jurisdiction) => selectedJurisdictionIds.has(jurisdiction.id)),
    ...viewArray(postings, "cityJurisdictions")
      .filter((jurisdiction) => !selectedJurisdictionIds.has(jurisdiction.id))
      .sort((first, second) =>
        Math.max(second.localMetrics?.disasterRisk || 0, second.localMetrics?.militaryPressure || 0) -
        Math.max(first.localMetrics?.disasterRisk || 0, first.localMetrics?.militaryPressure || 0)
      )
  ].slice(0, activePostings.length ? 3 : 4);

  selectedJurisdictions.forEach((jurisdiction) => {
    cards.push(createInformationDetailCard({
      className: "posting-geography-card",
      kind: "jurisdiction",
      entityId: jurisdiction.id,
      visibility: jurisdiction.visibility,
      cityId: jurisdiction.cityId,
      title: jurisdiction.name,
      meta: `${rowName(bureauMap, jurisdiction.bureauId, "未明官署")} · ${rowName(cityMap, jurisdiction.cityId, "未明城市")}`,
      summary: jurisdiction.publicSummary,
      metrics: formatLocalMetrics(jurisdiction.localMetrics),
      extra: [
        `区域：${rowName(regionMap, jurisdiction.regionId, "未明区域")}`,
        `路线：${compactList((jurisdiction.routeIds || []).map((id) => rowName(routeMap, id, "")), "暂无")}`,
        `边面：${compactList((jurisdiction.frontierZoneIds || []).map((id) => rowName(frontierMap, id, "")), "暂无")}`
      ].join("；")
    }));
  });

  const routeIds = new Set(selectedJurisdictions.flatMap((jurisdiction) => jurisdiction.routeIds || []));
  const routeRows = [...routeIds].map((id) => routeMap.get(id)).filter(Boolean);
  (routeRows.length ? routeRows : topPressureRows(viewArray(geography, "routes"), 2)).slice(0, 2).forEach((route) => {
    cards.push(createInformationDetailCard({
      className: "posting-geography-card",
      kind: "route",
      entityId: route.id,
      status: route.status,
      visibility: route.visibility,
      routeId: route.id,
      risk: route.risk,
      title: route.name,
      meta: `任所通路 · ${route.statusLabel || "未详"}`,
      summary: route.publicSummary,
      metrics: [
        ["风险", metricText(route.risk)],
        ["端点", `${rowName(cityMap, route.fromCityId)}至${rowName(cityMap, route.toCityId)}`],
        ["里程", route.distanceLabel || "未详"]
      ],
      extra: route.seasonalRisk
    }));
  });

  const section = renderInformationDetailSection("任所要目", `${cards.length}条辖区与通路`, cards);
  if (!activePostings.length) {
    const note = document.createElement("p");
    note.className = "information-panel-note posting-geography-empty";
    note.textContent = "尚未入仕；此处先列公开官署辖区，入仕或外放后会优先显示当前任所。";
    section.insertBefore(note, section.children[1] || null);
  }
  return section;
}

function renderWorldPeopleDetails(people = currentWorldPeopleView, geography = currentWorldGeographyView) {
  if (!people) return null;
  const npcMap = buildRowMap(viewArray(people, "npcs"));
  const householdMap = buildRowMap(viewArray(people, "households"));
  const assetMap = buildRowMap(viewArray(people, "assets"));
  const estateMap = buildRowMap(viewArray(people, "estates"));
  const cityMap = buildRowMap(viewArray(geography, "cities"));
  const regionMap = buildRowMap(viewArray(geography, "regions"));
  const relationNames = new Map([
    ...(currentRelationshipView?.contacts || []).map((entry) => [entry.id, entry.name]),
    ...(currentRelationshipView?.factions || []).map((entry) => [entry.id, entry.name])
  ]);
  const cards = [];

  const ownerName = (type, id) => {
    if (type === "player") return currentWorldState?.player?.name || "玩家";
    if (type === "npc") return rowName(npcMap, id, "未明人物");
    if (type === "household") return rowName(householdMap, id, "未明家族");
    return "未明归属";
  };
  const endpointName = (type, id) => {
    if (type === "player") return currentWorldState?.player?.name || "玩家";
    if (type === "npc") return rowName(npcMap, id, relationNames.get(id) || "未明人物");
    if (type === "household") return rowName(householdMap, id, "未明家族");
    if (type === "asset") return rowName(assetMap, id, "未明资产");
    if (type === "estate") return rowName(estateMap, id, "未明田产");
    return relationNames.get(id) || "可见关系";
  };

  topRowsByScore(viewArray(people, "npcs"), (npc) =>
    Math.max(npc.influence || 0, npc.reputation || 0, npc.resentmentRisk || 0, npc.legalRisk || 0, npc.impeachmentRisk || 0), 3
  ).forEach((npc) => {
    const risk = Math.max(npc.resentmentRisk || 0, npc.legalRisk || 0, npc.impeachmentRisk || 0);
    cards.push(createInformationDetailCard({
      className: "world-people-card",
      kind: "npc",
      entityId: npc.id,
      visibility: npc.visibility,
      risk,
      title: npc.courtesyName ? `${npc.name}（字${npc.courtesyName}）` : npc.name,
      meta: `${npc.rankLabel || "可见人物"} · ${npc.alive === false ? "故" : "在世"}`,
      summary: npc.publicSummary,
      metrics: [
        ["声望", metricText(npc.reputation)],
        ["影响", metricText(npc.influence)],
        ["怨险", metricText(risk)]
      ],
      extra: npc.currentGoal ? `近意：${npc.currentGoal}` : compactList(npc.ideologyTags, "暂无公开性情标签")
    }));
  });

  topRowsByScore(viewArray(people, "households"), (household) =>
    Math.max(household.wealthScore || 0, household.prestige || 0, household.familyRisk || 0, household.debtPressure || 0), 2
  ).forEach((household) => {
    cards.push(createInformationDetailCard({
      className: "world-people-card",
      kind: "household",
      entityId: household.id,
      visibility: household.visibility,
      risk: Math.max(household.familyRisk || 0, household.debtPressure || 0),
      title: `${household.familyName || "未名"}氏`,
      meta: `${rowName(cityMap, household.seatCityId, "未明郡邑")} · ${household.gentryRank || "家声未详"}`,
      summary: household.publicSummary,
      metrics: [
        ["家资", metricText(household.wealthScore)],
        ["声望", metricText(household.prestige)],
        ["债压", metricText(household.debtPressure)]
      ],
      extra: household.politicalAlignment || compactList((household.memberNpcIds || []).map((id) => rowName(npcMap, id, "")), "暂无公开成员")
    }));
  });

  topRowsByScore(viewArray(people, "assets"), (asset) =>
    Math.max(asset.valueEstimate || 0, asset.annualIncomeEstimate || 0, asset.debtValue || 0), 2
  ).forEach((asset) => {
    cards.push(createInformationDetailCard({
      className: "world-people-card",
      kind: "asset",
      entityId: asset.id,
      status: asset.statusLabel,
      visibility: asset.visibility,
      title: asset.name,
      meta: `${asset.kind || "资产"} · ${rowName(cityMap, asset.cityId, "未明郡邑")}`,
      summary: asset.publicSummary,
      metrics: [
        ["估值", metricText(asset.valueEstimate)],
        ["岁入", metricText(asset.annualIncomeEstimate)],
        ["负债", metricText(asset.debtValue)]
      ],
      extra: `归属：${ownerName(asset.ownerType, asset.ownerId)}；情状：${asset.statusLabel || "未详"}`
    }));
  });

  topRowsByScore(viewArray(people, "estates"), (estate) =>
    Math.max(estate.landMu || 0, estate.disputeRisk || 0, estate.taxBurden || 0), 2
  ).forEach((estate) => {
    cards.push(createInformationDetailCard({
      className: "world-people-card",
      kind: "estate",
      entityId: estate.id,
      status: estate.status,
      visibility: estate.visibility,
      risk: estate.disputeRisk,
      title: estate.name,
      meta: `${rowName(cityMap, estate.cityId, "未明郡邑")} · ${rowName(regionMap, estate.regionId, "未明区域")}`,
      summary: estate.publicSummary,
      metrics: [
        ["田亩", metricText(estate.landMu, "亩")],
        ["租谷", metricText(estate.rentGrainEstimate)],
        ["讼险", metricText(estate.disputeRisk)]
      ],
      extra: `归属：${ownerName(estate.ownerType, estate.ownerId)}；水利：${metricText(estate.waterworks)}`
    }));
  });

  topRowsByScore(viewArray(people, "relationships"), (relationship) =>
    Math.max(relationship.resentment || 0, relationship.rivalry || 0, relationship.fear || 0, 100 - (relationship.trust || 50)), 4
  ).forEach((relationship) => {
    const source = endpointName(relationship.sourceType, relationship.sourceId);
    const target = endpointName(relationship.targetType, relationship.targetId);
    cards.push(createInformationDetailCard({
      className: "world-people-card",
      kind: "relationship",
      entityId: relationship.id,
      visibility: relationship.visibility,
      risk: Math.max(relationship.resentment || 0, relationship.rivalry || 0, relationship.fear || 0),
      title: `${source}与${target}`,
      meta: relationship.stance || "关系可见",
      summary: relationship.publicSummary,
      metrics: [
        ["情分", metricText(relationship.relationship)],
        ["信任", metricText(relationship.trust)],
        ["怨望", metricText(relationship.resentment)]
      ],
      extra: relationship.recentIntent || compactList(relationship.recentNotes, "暂无近闻", 2)
    }));
  });

  return renderInformationDetailSection("谱牒要目", `${cards.length}条人物、家产与关系`, cards);
}

function renderOfficialPostingsDetails(postings = currentOfficialPostingsView, geography = currentWorldGeographyView) {
  if (!postings) return null;
  const bureauMap = buildRowMap(viewArray(postings, "bureaus"));
  const officeMap = buildRowMap(viewArray(postings, "offices"));
  const cityMap = buildRowMap(viewArray(geography, "cities"));
  const jurisdictionMap = buildRowMap(viewArray(postings, "cityJurisdictions"));
  const cards = [];

  const holderTypeLabels = {
    player: "本员",
    npc: "他员",
    vacant: "缺额",
    unknown: "未详"
  };
  const postingStatusLabels = {
    active: "现任",
    acting: "署理",
    suspended: "停俸",
    vacant: "缺额",
    transferred: "迁转",
    dismissed: "罢黜",
    mourning_leave: "丁忧",
    restoration_pending: "待起复"
  };
  const assessmentStatusLabels = {
    draft: "草拟",
    pending: "待核",
    resolved: "已定",
    archived: "归档"
  };
  const recommendationLabels = {
    none: "未定",
    retention: "留任",
    promotion: "升擢",
    transfer: "调任",
    outpost: "外放",
    demotion: "降调",
    impeachment: "参劾",
    punishment: "处分"
  };
  const transferTypeLabels = {
    appointment: "授官",
    transfer: "调任",
    promotion: "升迁",
    outpost: "外放",
    demotion: "降调",
    punishment: "处分",
    mourning_leave: "丁忧",
    restoration: "起复",
    retention: "留任"
  };
  const transferStatusLabels = {
    proposed: "拟议",
    approved: "准行",
    applied: "已行",
    rejected: "驳回",
    cancelled: "撤销"
  };

  const activePostings = viewArray(postings, "postings")
    .filter((posting) => posting.holderType === "player" || posting.status === "active")
    .slice(0, 2);
  activePostings.forEach((posting) => {
    cards.push(createInformationDetailCard({
      className: "official-posting-card",
      kind: "posting",
      entityId: posting.id,
      status: posting.status,
      visibility: posting.visibility,
      cityId: posting.cityId,
      title: posting.officeTitle || rowName(officeMap, posting.officeId, "任命"),
      meta: `${rowName(bureauMap, posting.bureauId, "未明官署")} · ${statusLabel(posting.holderType, holderTypeLabels)}`,
      summary: posting.publicSummary,
      metrics: [
        ["状态", statusLabel(posting.status, postingStatusLabels)],
        ["考成", metricText(posting.performanceScore)],
        ["弹劾", metricText(posting.impeachmentRisk)],
        ["任期", `${posting.termMonths ?? 0}月`]
      ],
      extra: `${rowName(cityMap, posting.cityId, "未明城市")}；${rowName(jurisdictionMap, posting.jurisdictionId, "辖区未明")}`
    }));
  });

  const activePostingIds = new Set(activePostings.map((posting) => posting.id));
  viewArray(postings, "assessmentRecords")
    .filter((record) => record.holderType === "player" || activePostingIds.has(record.postingId))
    .slice(0, 2)
    .forEach((record) => {
      cards.push(createInformationDetailCard({
        className: "official-posting-card",
        kind: "assessment",
        entityId: record.id,
        status: record.status,
        visibility: record.visibility,
        title: `${rowName(officeMap, record.officeId, "官职")}考成`,
        meta: `${rowName(bureauMap, record.bureauId, "未明官署")} · ${formatRecordDate(record.date)}`,
        summary: record.publicFinding || record.publicSummary,
        metrics: [
          ["功绩", metricText(record.meritScore)],
          ["风险", metricText(record.riskScore)],
          ["建议", statusLabel(record.recommendation, recommendationLabels)],
          ["状态", statusLabel(record.status, assessmentStatusLabels)]
        ],
        extra: `差遣据数：${metricText((record.assignmentIds || []).length)}`
      }));
    });

  viewArray(postings, "transferRecords")
    .slice()
    .reverse()
    .slice(0, 2)
    .forEach((record) => {
      const fromOffice = rowName(officeMap, record.fromOfficeId, "未授");
      const toOffice = rowName(officeMap, record.toOfficeId, "未授");
      cards.push(createInformationDetailCard({
        className: "official-posting-card",
        kind: "transfer",
        entityId: record.id,
        status: record.status,
        visibility: record.visibility,
        cityId: record.toCityId,
        title: `${fromOffice}至${toOffice}`,
        meta: `${statusLabel(record.type, transferTypeLabels)} · ${formatRecordDate(record.date)}`,
        summary: record.publicReason || record.publicSummary,
        metrics: [
          ["状态", statusLabel(record.status, transferStatusLabels)],
          ["起地", rowName(cityMap, record.fromCityId, "未详")],
          ["赴地", rowName(cityMap, record.toCityId, "未详")]
        ],
        extra: record.publicSummary
      }));
    });

  const selectedBureauIds = new Set([
    ...activePostings.map((posting) => posting.bureauId),
    ...viewArray(postings, "assessmentRecords").map((record) => record.bureauId)
  ].filter(Boolean));
  const bureauRows = [
    ...viewArray(postings, "bureaus").filter((bureau) => selectedBureauIds.has(bureau.id)),
    ...viewArray(postings, "bureaus").filter((bureau) => !selectedBureauIds.has(bureau.id))
  ].slice(0, 2);
  bureauRows.forEach((bureau) => {
    cards.push(createInformationDetailCard({
      className: "official-posting-card",
      kind: "bureau",
      entityId: bureau.id,
      visibility: bureau.visibility,
      title: bureau.name,
      meta: `官署 · ${bureau.level || "未详"}`,
      summary: bureau.publicSummary,
      metrics: [
        ["官职", metricText((bureau.officeIds || []).length)],
        ["辖区", metricText((bureau.jurisdictionIds || []).length)],
        ["信度", metricText(bureau.intelConfidence)]
      ],
      extra: compactList(bureau.duties, compactList(bureau.riskTags, "暂无公开职掌"))
    }));
  });

  const selectedOfficeIds = new Set([
    ...activePostings.map((posting) => posting.officeId),
    ...viewArray(postings, "assessmentRecords").map((record) => record.officeId)
  ].filter(Boolean));
  const officeRows = [
    ...viewArray(postings, "offices").filter((office) => selectedOfficeIds.has(office.id)),
    ...viewArray(postings, "offices").filter((office) => !selectedOfficeIds.has(office.id))
  ].slice(0, 3);
  officeRows.forEach((office) => {
    cards.push(createInformationDetailCard({
      className: "official-posting-card",
      kind: "office",
      entityId: office.id,
      visibility: office.visibility,
      title: office.title,
      meta: `${rowName(bureauMap, office.bureauId, "未明官署")} · ${office.rankLabel || office.rankBand || "品秩未详"}`,
      summary: office.publicSummary,
      metrics: [
        ["任期", office.normalTermMonths ? `${office.normalTermMonths}月` : "未定"],
        ["职掌", metricText((office.duties || []).length)],
        ["路径", metricText((office.promotionPathIds || []).length)]
      ],
      extra: compactList(office.duties, office.requiredRankOrExam || "暂无公开铨选条件")
    }));
  });

  return renderInformationDetailSection("官职要目", `${cards.length}条官署、官职与考迁`, cards);
}

function createEventArchiveItem(item) {
  const card = document.createElement("article");
  card.className = "event-archive-item";
  card.dataset.eventId = item.id || "";
  card.dataset.sourceType = item.sourceType || "";
  card.dataset.kind = item.kind || "";
  card.dataset.status = item.status || "";
  card.dataset.visibility = item.visibility || "";
  card.dataset.turn = String(item.turn ?? "");
  card.dataset.year = String(item.year ?? "");
  card.dataset.month = String(item.month ?? "");
  card.dataset.tenDayPeriod = String(item.tenDayPeriod ?? "");
  if (item.riskLabel) card.dataset.risk = item.riskLabel;

  const header = document.createElement("header");
  appendIfText(header, "strong", item.title || "未名事件", "event-archive-title");
  appendIfText(header, "span", item.dateLabel || formatRecordDate(item), "event-archive-date");

  const summary = document.createElement("p");
  summary.className = "event-archive-summary";
  summary.textContent = item.summary || "暂无公开案语。";

  const metrics = document.createElement("div");
  metrics.className = "information-card-metrics";
  metrics.append(
    createInformationMetric("来源", item.sourceLabel || item.sourceType || "事件", "event-archive-source"),
    createInformationMetric("状态", item.statusLabel || item.status || "已记", "event-archive-status"),
    createInformationMetric("回数", `第${item.turn ?? 0}回`, "event-archive-turn")
  );
  if (item.riskLabel) {
    metrics.appendChild(createInformationMetric("风险", item.riskLabel, "event-archive-risk"));
  }

  card.append(header, summary, metrics);
  const related = compactList(item.relatedLabels || [], "", 5);
  if (related) {
    const extra = document.createElement("p");
    extra.className = "information-card-extra event-archive-related";
    extra.textContent = `牵连：${related}`;
    card.appendChild(extra);
  }
  return card;
}

function renderEventArchiveDetails(archive = currentEventArchiveView) {
  if (!archive) return null;
  const items = viewArray(archive, "items");
  const cards = items.map(createEventArchiveItem);
  const pagination = archive.pagination || {};
  const total = pagination.totalItems ?? archive.counts?.total ?? cards.length;
  const page = pagination.page && pagination.totalPages
    ? ` · 第${pagination.page}/${pagination.totalPages}页`
    : "";
  return renderInformationDetailSection("事件要目", `${cards.length}/${total}条公开卷宗${page}`, cards);
}

function renderInformationPanelDetails(tabId) {
  if (tabId === "world-geography") return renderWorldGeographyDetails();
  if (tabId === "posting-geography") return renderPostingGeographyDetails();
  if (tabId === "world-people") return renderWorldPeopleDetails();
  if (tabId === "official-postings") return renderOfficialPostingsDetails();
  if (tabId === "event-archive") return renderEventArchiveDetails();
  return null;
}

function setStatus(worldState) {
  const player = worldState.player;
  statusStrip.innerHTML = "";

  const statusItems = [
    formatVisibleDate(worldState),
    player.roleLabel,
    player.name,
    `回合 ${worldState.turnCount}`
  ];

  if (player.role === "scholar") {
    statusItems.splice(3, 0, `银钱 ${player.gold}`);
  } else if (player.role === "general") {
    statusItems.splice(
      3,
      0,
      `兵员 ${player.troops ?? worldState.armySize}`,
      `军粮 ${player.supply ?? "-"}`,
      `边患 ${worldState.borderThreat}`
    );
  } else if (player.role === "magistrate") {
    statusItems.splice(
      3,
      0,
      `治所 ${player.countyName || "本县"}`,
      `县库 ${player.localTreasury ?? "-"}`,
      `盗匪 ${player.banditPressure ?? "-"}`
    );
  } else if (player.role === "official") {
    statusItems.splice(
      3,
      0,
      `考成 ${player.performanceMerit ?? "-"}`,
      `升迁 ${player.promotionProspect ?? "-"}`,
      `弹劾 ${player.impeachmentRisk ?? "-"}`
    );
  } else {
    statusItems.splice(3, 0, `府库 ${worldState.treasury}`, `民心 ${worldState.publicOrder}`, `边患 ${worldState.borderThreat}`);
  }

  statusItems.forEach((text) => {
    statusStrip.appendChild(createTag(text));
  });

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "status-action";
  saveButton.id = "save-list-open";
  saveButton.textContent = "存档";
  saveButton.addEventListener("click", openSaveModal);
  statusStrip.appendChild(saveButton);
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

function createRelationshipMeta(label, value, className) {
  const item = document.createElement("p");
  if (className) item.className = className;
  const kicker = document.createElement("span");
  kicker.className = "relationship-kicker";
  kicker.textContent = label;
  const text = document.createElement("span");
  text.textContent = value || "未明";
  item.append(kicker, text);
  return item;
}

function createRelationshipContact(entry) {
  const card = document.createElement("article");
  card.className = "relationship-contact";
  card.dataset.contactType = entry.type;
  card.dataset.contactId = entry.id;
  card.dataset.relationship = String(entry.relationship ?? 0);
  card.dataset.resentment = String(entry.resentment ?? 0);

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = localizeContactName(entry);
  const type = document.createElement("span");
  type.textContent = entry.type === "character" ? "人物" : "派系";
  header.append(title, type);

  const role = entry.type === "character" && entry.role
    ? createRelationshipMeta("身份", entry.role, "relationship-role")
    : null;
  const score = createRelationshipMeta(
    "关系",
    `${entry.relationship ?? 0} · ${localizeRelationshipLabel(entry.relationshipLabel)}`,
    "relationship-score"
  );
  const resentment = createRelationshipMeta(
    "怨望",
    `${entry.resentment ?? 0} · ${localizeResentmentLabel(entry.resentmentLabel)}`,
    "relationship-resentment"
  );
  const stance = createRelationshipMeta("立场", localizeStance(entry.stance), "relationship-stance");
  const source = createRelationshipMeta("来源", localizeNetworkSource(entry.networkSource), "relationship-source");
  const intent = createRelationshipMeta("意图", localizeRecentIntent(entry.recentIntent), "relationship-intent");
  const updated = createRelationshipMeta("近更", `第${entry.lastUpdatedTurn ?? 0}回`, "relationship-updated");

  card.append(header);
  if (role) card.append(role);
  card.append(score, resentment, stance, source, intent, updated);
  return card;
}

function renderRelationshipPanel(relationshipView = currentRelationshipView) {
  const entries = [
    ...(relationshipView?.contacts || []),
    ...(relationshipView?.factions || [])
  ];
  const panel = document.createElement("section");
  panel.id = "relationship-panel";
  panel.className = "relationship-panel";

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = "人脉簿";
  const summary = document.createElement("span");
  summary.textContent = `${entries.length} 条可见关系${relationshipView?.hiddenNotice ? " · 另有未明" : ""}`;
  header.append(title, summary);
  panel.appendChild(header);

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "relationship-empty";
    empty.textContent = "尚无可查关系";
    panel.appendChild(empty);
    return panel;
  }

  const grid = document.createElement("div");
  grid.className = "relationship-grid";
  entries.forEach((entry) => {
    grid.appendChild(createRelationshipContact(entry));
  });
  panel.appendChild(grid);

  return panel;
}

function createActiveRequestMeta(label, value, className) {
  const item = document.createElement("p");
  if (className) item.className = className;
  const kicker = document.createElement("span");
  kicker.className = "relationship-kicker";
  kicker.textContent = label;
  const text = document.createElement("span");
  text.textContent = value || "未明";
  item.append(kicker, text);
  return item;
}

function renderActiveNpcRequestPanel(activeNpcRequestView = currentActiveNpcRequestView) {
  if (!activeNpcRequestView) return null;

  const panel = document.createElement("section");
  panel.id = "active-request-panel";
  panel.className = "active-request-panel";

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = "来函";
  const summary = document.createElement("span");
  summary.textContent = ACTIVE_REQUEST_KIND_LABELS[activeNpcRequestView.kind] || "请托";
  header.append(title, summary);

  const card = document.createElement("article");
  card.className = "active-request-card";
  card.dataset.requestId = activeNpcRequestView.id;
  card.dataset.requestKind = activeNpcRequestView.kind;
  card.dataset.targetType = activeNpcRequestView.targetType;
  card.dataset.targetId = activeNpcRequestView.targetId;
  card.dataset.requestStatus = activeNpcRequestView.status;
  card.dataset.dueTurn = String(activeNpcRequestView.dueTurn ?? "");

  const cardHeader = document.createElement("header");
  const cardTitle = document.createElement("strong");
  cardTitle.className = "active-request-title";
  cardTitle.textContent = activeNpcRequestView.title || "有事相托";
  const source = document.createElement("span");
  source.className = "active-request-source";
  source.textContent = activeNpcRequestView.sourceName || "未明";
  cardHeader.append(cardTitle, source);

  card.append(
    cardHeader,
    createActiveRequestMeta("请托", activeNpcRequestView.ask, "active-request-ask"),
    createActiveRequestMeta("利害", activeNpcRequestView.stakes, "active-request-stakes"),
    createActiveRequestMeta("期限", `第${activeNpcRequestView.dueTurn ?? 0}回 · 尚余${activeNpcRequestView.turnsRemaining ?? 0}回`, "active-request-due"),
    createActiveRequestMeta("回应", activeNpcRequestView.resolutionHint, "active-request-hint")
  );

  panel.append(header, card);
  return panel;
}

function formatWorldThreadDeadline(thread) {
  if (thread.deadlineLabel) return thread.deadlineLabel;
  if (thread.dueTurn !== null && thread.dueTurn !== undefined) {
    return thread.turnsRemaining === null || thread.turnsRemaining === undefined
      ? `第${thread.dueTurn}回`
      : `第${thread.dueTurn}回 · 尚余${thread.turnsRemaining}回`;
  }
  if (thread.remainingMonths !== null && thread.remainingMonths !== undefined) {
    return thread.remainingMonths === 0 ? "本月见分晓" : `约余${thread.remainingMonths}月`;
  }
  return "持续观察";
}

function formatWorldThreadRelated(thread) {
  const labels = thread.relatedLabels?.summary || [
    ...(thread.relatedLabels?.characters || []),
    ...(thread.relatedLabels?.factions || []),
    ...(thread.relatedLabels?.offices || []),
    ...(thread.relatedLabels?.metrics || [])
  ];
  if (labels.length) return labels.join("、");
  const related = thread.related || {};
  return [
    ...(related.characters || []),
    ...(related.factions || []).map((id) => CONTACT_NAME_LABELS[id] || id),
    ...(related.offices || []),
    ...(related.metrics || []).map((id) => ATTRIBUTE_LABELS[id.split(".").pop()] || id)
  ].filter(Boolean).slice(0, 8).join("、") || "暂无可见牵连";
}

function renderWorldThreadCard(thread) {
  const card = document.createElement("article");
  card.className = "world-thread-card";
  card.dataset.threadId = thread.id || "";
  card.dataset.sourceType = thread.sourceType || "";
  card.dataset.threadKind = thread.kind || "";
  card.dataset.status = thread.status || "";
  card.dataset.severity = String(thread.severity ?? "");
  card.dataset.risk = thread.riskTone || "";
  card.dataset.dueTurn = String(thread.dueTurn ?? "");

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = thread.title || "未名议题";
  const meta = document.createElement("span");
  meta.textContent = [
    WORLD_THREAD_KIND_LABELS[thread.kind] || thread.kind,
    WORLD_THREAD_STATUS_LABELS[thread.status] || thread.status,
    thread.sourceLabel
  ].filter(Boolean).join(" · ");
  header.append(title, meta);

  const summary = document.createElement("p");
  summary.className = "world-thread-summary";
  summary.textContent = thread.summary || "尚无摘要。";

  const goal = createActiveRequestMeta("目标", thread.goal || thread.summary || "追踪后续牵连。", "world-thread-goal");
  const deadline = createActiveRequestMeta("期限", formatWorldThreadDeadline(thread), "world-thread-deadline");
  const risk = createActiveRequestMeta("风险", `${thread.riskLabel || "可观察"} · ${thread.severity ?? 1}`, "world-thread-risk");
  const related = createActiveRequestMeta("牵连", formatWorldThreadRelated(thread), "world-thread-related");
  const hints = createActiveRequestMeta("介入", (thread.interventionHints || []).join("、") || "以自由行动处置", "world-thread-hint");
  const followUp = createActiveRequestMeta("后续", thread.followUpHint || "仍由来源系统结算", "world-thread-followup");

  card.append(header, summary, goal, deadline, risk, related, hints, followUp);
  return card;
}

function renderWorldThreadResolved(recentResolved = []) {
  const section = document.createElement("section");
  section.className = "world-thread-resolved";
  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = "近归档";
  const summary = document.createElement("span");
  summary.textContent = `${recentResolved.length}件`;
  header.append(title, summary);
  section.appendChild(header);

  if (!recentResolved.length) {
    const empty = document.createElement("p");
    empty.className = "world-thread-empty";
    empty.textContent = "暂无归档议题。";
    section.appendChild(empty);
    return section;
  }

  recentResolved.slice().reverse().forEach((thread) => {
    const item = document.createElement("p");
    item.className = "world-thread-resolved-item";
    item.dataset.threadId = thread.id || "";
    item.dataset.sourceType = thread.sourceType || "";
    item.textContent = `${thread.title || "旧议题"}：${thread.outcome || "暂归档"}（第${thread.resolvedTurn ?? "-"}回）`;
    section.appendChild(item);
  });
  return section;
}

function renderWorldThreadPanel(worldThreadView = currentWorldThreadView) {
  const activeThreads = Array.isArray(worldThreadView?.activeThreads) ? worldThreadView.activeThreads : [];
  const recentResolved = Array.isArray(worldThreadView?.recentResolved) ? worldThreadView.recentResolved : [];

  const panel = document.createElement("section");
  panel.id = "world-thread-panel";
  panel.className = "world-thread-panel";
  panel.dataset.generatedTurn = String(worldThreadView?.generatedAtTurn ?? currentWorldState?.turnCount ?? 0);
  panel.dataset.activeCount = String(activeThreads.length);
  panel.dataset.watchCount = String(activeThreads.filter((thread) => thread.status === "watch").length);

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = "世界议程";
  const summary = document.createElement("span");
  summary.textContent = activeThreads.length
    ? `${activeThreads.length}件可追踪议题`
    : "暂无可查议程";
  header.append(title, summary);
  panel.appendChild(header);

  if (!activeThreads.length) {
    const empty = document.createElement("p");
    empty.className = "world-thread-empty";
    empty.textContent = "当前暂无需要盯住的跨月议题；后续请托、差事、大势或身份联动会汇入此处。";
    panel.append(empty, renderWorldThreadResolved(recentResolved));
    return panel;
  }

  const grid = document.createElement("div");
  grid.className = "world-thread-grid";
  activeThreads.slice(0, 5).forEach((thread) => {
    grid.appendChild(renderWorldThreadCard(thread));
  });
  panel.append(grid, renderWorldThreadResolved(recentResolved));
  return panel;
}

function formatOutcomeDate(outcome) {
  if (!outcome) return "未记";
  return `${formatVisibleDate(outcome)} · 第${outcome.turn ?? 0}回`;
}

function createOfficialCareerOutcome(outcome, isCurrent = false) {
  const card = document.createElement("article");
  card.className = ["official-career-outcome", isCurrent ? "official-career-current" : ""].filter(Boolean).join(" ");
  card.dataset.outcomeId = outcome.id || "";
  card.dataset.outcomeType = outcome.type || "";
  card.dataset.outcomeStatus = isCurrent ? "current" : outcome.status || "resolved";
  card.dataset.officeTitle = outcome.officeTitleAfter || "";
  card.dataset.outcomeTurn = String(outcome.turn ?? "");

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = OFFICIAL_OUTCOME_LABELS[outcome.type] || outcome.label || "官场";
  const date = document.createElement("span");
  date.textContent = formatOutcomeDate(outcome);
  header.append(title, date);

  const posting = createActiveRequestMeta("职名", outcome.officeTitleAfter || "无官", "official-career-posting");
  const reason = createActiveRequestMeta("缘由", outcome.reason || "未详", "official-career-reason");

  card.append(header, posting, reason);
  return card;
}

function renderOfficialSection(className, titleText, summaryText) {
  const section = document.createElement("section");
  section.className = ["official-career-section", className].filter(Boolean).join(" ");
  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = titleText;
  const summary = document.createElement("span");
  summary.textContent = summaryText || "";
  header.append(title, summary);
  section.appendChild(header);
  return section;
}

function renderOfficialBureauSection(officialCareerView) {
  const bureau = officialCareerView.bureau || {};
  const section = renderOfficialSection(
    "official-career-bureau",
    "官署",
    bureau.name || "候选"
  );
  section.dataset.bureauId = bureau.id || "";
  section.dataset.officeTitle = bureau.officeTitle || officialCareerView.currentPosting || "";

  const body = document.createElement("div");
  body.className = "official-career-section-grid";
  body.append(
    createPanelValue("职名", bureau.officeTitle || officialCareerView.currentPosting || "未授", "p"),
    createPanelValue("衙门", bureau.name || "未明", "p"),
    createPanelValue("职责", (bureau.duties || []).join("、") || "候部观政", "p")
  );

  const duties = document.createElement("div");
  duties.className = "official-career-duty-list";
  (bureau.duties || []).slice(0, 4).forEach((duty) => {
    const tag = document.createElement("span");
    tag.className = "official-career-bureau-duty";
    tag.textContent = duty;
    duties.appendChild(tag);
  });

  if (bureau.summary) {
    const summary = document.createElement("p");
    summary.className = "official-career-bureau-summary";
    summary.textContent = bureau.summary;
    section.append(body, duties, summary);
  } else {
    section.append(body, duties);
  }
  return section;
}

function renderOfficialAssignmentCard(assignment) {
  const card = document.createElement("article");
  card.className = "official-career-assignment";
  card.dataset.assignmentId = assignment.id || "";
  card.dataset.assignmentKind = assignment.kind || "";
  card.dataset.assignmentStatus = assignment.status || "";
  card.dataset.bureauId = assignment.bureauId || "";

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = assignment.title || "署中差遣";
  const status = document.createElement("span");
  status.textContent = OFFICIAL_ASSIGNMENT_STATUS_LABELS[assignment.status] || assignment.status || "办理";
  header.append(title, status);

  const progress = createActiveRequestMeta("进度", `${assignment.progress ?? 0}`, "official-career-assignment-progress");
  const risk = createActiveRequestMeta("风险", `${assignment.risk ?? 0}`, "official-career-assignment-risk");
  const due = createActiveRequestMeta("期限", assignment.deadlineLabel || (assignment.dueTurn ? `第${assignment.dueTurn}回` : "未定"), "official-career-assignment-due");
  const summary = createActiveRequestMeta("案语", assignment.visibleSummary || "尚在办理。", "official-career-assignment-summary-text");

  card.append(header, progress, risk, due, summary);
  return card;
}

function renderOfficialAssignmentsSection(officialCareerView) {
  const assignments = Array.isArray(officialCareerView.assignments) ? officialCareerView.assignments : [];
  const assignmentSummary = officialCareerView.assignmentSummary || {};
  const section = renderOfficialSection(
    "official-career-assignments",
    "差事",
    `${assignmentSummary.activeCount ?? assignments.length}件在办`
  );

  const summary = document.createElement("div");
  summary.className = "official-career-assignment-summary";
  summary.append(
    createPanelValue("在办", assignmentSummary.activeCount ?? assignments.length, "p"),
    createPanelValue("急件", assignmentSummary.urgentCount ?? 0, "p"),
    createPanelValue("近案", assignmentSummary.latestTitle || "暂无", "p")
  );
  section.appendChild(summary);

  if (!assignments.length) {
    const empty = document.createElement("p");
    empty.className = "official-career-empty";
    empty.textContent = "暂无差遣入案，可从赈务、清丈、案牍、科场或奏疏等行动起手。";
    section.appendChild(empty);
    return section;
  }

  const grid = document.createElement("div");
  grid.className = "official-career-assignment-grid";
  assignments.slice(0, 3).forEach((assignment) => {
    grid.appendChild(renderOfficialAssignmentCard(assignment));
  });
  section.appendChild(grid);
  return section;
}

function renderOfficialAssessmentSection(officialCareerView) {
  const hasAssessmentView = officialCareerView.assessment && typeof officialCareerView.assessment === "object";
  const assessment = hasAssessmentView ? officialCareerView.assessment : {};
  const section = renderOfficialSection(
    "official-career-assessment",
    "考成",
    assessment.pendingRecommendation ? OFFICIAL_RECOMMENDATION_LABELS[assessment.pendingRecommendation] || assessment.pendingRecommendation : "卷宗在部"
  );
  section.dataset.viewReady = hasAssessmentView ? "true" : "false";
  section.dataset.pendingRecommendation = assessment.pendingRecommendation || "";
  section.dataset.meritScore = hasAssessmentView && assessment.meritScore !== undefined ? `${assessment.meritScore}` : "";
  section.dataset.riskScore = hasAssessmentView && assessment.riskScore !== undefined ? `${assessment.riskScore}` : "";

  const grid = document.createElement("div");
  grid.className = "official-career-section-grid";
  grid.append(
    createPanelValue("功绩", assessment.meritScore ?? officialCareerView.careerScore ?? "-", "p"),
    createPanelValue("瑕议", assessment.riskScore ?? officialCareerView.riskScore ?? "-", "p"),
    createPanelValue("考期", assessment.nextReviewInMonths === null || assessment.nextReviewInMonths === undefined ? "未定" : `${assessment.nextReviewInMonths}月`, "p")
  );
  section.appendChild(grid);

  const notes = Array.isArray(assessment.notes) ? assessment.notes.slice(0, 3) : [];
  const list = document.createElement("div");
  list.className = "official-career-assessment-notes";
  (notes.length ? notes : ["尚无考成札记。"]).forEach((note) => {
    const item = document.createElement("p");
    item.className = "official-career-assessment-note";
    item.textContent = note;
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

function renderOfficialNetworkRiskSection(officialCareerView) {
  const hasNetworkView = officialCareerView.networkSummary && typeof officialCareerView.networkSummary === "object";
  const hasProcedureView = officialCareerView.procedureSummary && typeof officialCareerView.procedureSummary === "object";
  const network = hasNetworkView ? officialCareerView.networkSummary : {};
  const procedure = hasProcedureView ? officialCareerView.procedureSummary : {};
  const stage = procedure.impeachmentStage || "none";
  const section = renderOfficialSection(
    "official-career-risk",
    "关系与风险",
    OFFICIAL_PROCEDURE_STAGE_LABELS[stage] || stage
  );

  const grid = document.createElement("div");
  grid.className = "official-career-risk-grid";

  const networkCard = document.createElement("article");
  networkCard.className = "official-career-network";
  networkCard.dataset.viewReady = hasNetworkView ? "true" : "false";
  networkCard.dataset.hiddenNotice = network.hiddenNotice ? "true" : "false";
  networkCard.append(
    createPanelValue("上官", network.superiors ?? 0, "p"),
    createPanelValue("同年", network.sameYears ?? 0, "p"),
    createPanelValue("政敌", network.rivals ?? 0, "p"),
    createPanelValue("言官", network.censors ?? 0, "p")
  );
  if (network.hiddenNotice) {
    const hidden = document.createElement("p");
    hidden.className = "official-career-network-notice";
    hidden.textContent = "另有未明风声";
    networkCard.appendChild(hidden);
  }

  const procedureCard = document.createElement("article");
  procedureCard.className = "official-career-procedure";
  procedureCard.dataset.viewReady = hasProcedureView ? "true" : "false";
  procedureCard.dataset.impeachmentStage = stage;
  procedureCard.append(
    createPanelValue("弹劾", OFFICIAL_PROCEDURE_STAGE_LABELS[stage] || stage, "p"),
    createPanelValue("风险", procedure.risk ?? 0, "p"),
    createPanelValue("期限", procedure.deadlineLabel || (procedure.dueTurn ? `第${procedure.dueTurn}回` : "未定"), "p")
  );
  const notice = document.createElement("p");
  notice.className = "official-career-procedure-notice";
  notice.textContent = procedure.visibleNotice || "尚无公开弹章。";
  procedureCard.appendChild(notice);

  grid.append(networkCard, procedureCard);
  section.appendChild(grid);
  return section;
}

function renderOfficialArchiveSection(officialCareerView, current) {
  const section = renderOfficialSection("official-career-archive", "履历档案", "近五条");
  section.appendChild(current);

  const history = document.createElement("div");
  history.className = "official-career-history";
  (officialCareerView.recentOutcomes || [])
    .slice(0, -1)
    .reverse()
    .forEach((outcome) => history.appendChild(createOfficialCareerOutcome(outcome)));
  if (history.childElementCount) section.appendChild(history);
  return section;
}

function renderOfficialCareerPanel(officialCareerView = currentOfficialCareerView) {
  if (!officialCareerView?.active) return null;

  const panel = document.createElement("section");
  panel.id = "official-career-panel";
  panel.className = "official-career-panel";
  panel.dataset.currentPosting = officialCareerView.currentPosting || "";
  panel.dataset.pendingReview = officialCareerView.pendingReview ? "true" : "false";
  panel.dataset.impeachmentStage = officialCareerView.procedureSummary?.impeachmentStage || "none";

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = "官场档案";
  const summary = document.createElement("span");
  summary.textContent = `${officialCareerView.currentPosting || "候选观政"} · 任内${officialCareerView.tenureMonths ?? 0}月`;
  header.append(title, summary);

  const meta = document.createElement("div");
  meta.className = "official-career-meta";
  meta.append(
    createPanelValue("考绩", officialCareerView.careerScore ?? "-", "p"),
    createPanelValue("风险", officialCareerView.riskScore ?? "-", "p"),
    createPanelValue("下次考察", officialCareerView.nextReviewInMonths === null ? "未定" : `${officialCareerView.nextReviewInMonths}月`, "p")
  );

  const latest = officialCareerView.lastOutcome;
  const current = latest
    ? createOfficialCareerOutcome(latest, true)
    : (() => {
      const empty = document.createElement("p");
      empty.className = "official-career-empty";
      empty.textContent = officialCareerView.pendingReview ? "本任候考，尚待吏部定议" : "尚无升降记录";
      return empty;
    })();

  panel.append(
    header,
    meta,
    renderOfficialBureauSection(officialCareerView),
    renderOfficialAssignmentsSection(officialCareerView),
    renderOfficialAssessmentSection(officialCareerView),
    renderOfficialNetworkRiskSection(officialCareerView),
    renderOfficialArchiveSection(officialCareerView, current)
  );
  return panel;
}

function formatCalendarWindow(calendar) {
  if (!calendar) return "暂无考期";
  const current = calendar.currentDateLabel || formatVisibleDate({
    dynasty: currentWorldState?.dynasty,
    year: calendar.currentYear,
    month: calendar.currentMonth,
    tenDayPeriod: calendar.currentTenDayPeriod
  });
  if (calendar.isOpen) return `${calendar.examName}开场 · ${current}`;
  return `${calendar.examName}候${calendar.nextWindowLabel} · 当前${current}`;
}

function renderExamCalendarPanel(examCalendarView = currentExamCalendarView) {
  const nextExam = examCalendarView?.nextExam;
  if (!nextExam) return null;

  const panel = document.createElement("section");
  panel.id = "exam-calendar-panel";
  panel.className = "exam-calendar-panel";
  panel.dataset.nextLevel = nextExam.level || "";
  panel.dataset.windowStatus = nextExam.status || "";
  panel.dataset.monthsUntil = String(nextExam.monthsUntil ?? "");

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = "科期";
  const summary = document.createElement("span");
  summary.textContent = formatCalendarWindow(nextExam);
  header.append(title, summary);

  const grid = document.createElement("section");
  grid.className = "exam-calendar-grid";
  grid.append(
    createPanelValue("当前", nextExam.currentDateLabel || formatVisibleDate({
      dynasty: currentWorldState?.dynasty,
      year: nextExam.currentYear,
      month: nextExam.currentMonth,
      tenDayPeriod: nextExam.currentTenDayPeriod
    }), "p"),
    createPanelValue("窗口", nextExam.windowLabel || "-", "p"),
    createPanelValue("距下期", nextExam.monthsUntil === 0 ? "本月" : `${nextExam.monthsUntil}月`, "p"),
    createPanelValue("备考/路程", `${nextExam.preparationMonths ?? 0}月 / ${nextExam.travelMonths ?? 0}月`, "p"),
    createPanelValue("盘费", nextExam.funding?.ready ? `${nextExam.funding.requiredGold}两已足` : `缺${nextExam.funding?.shortfall ?? 0}两`, "p")
  );

  const notes = document.createElement("section");
  notes.className = "exam-calendar-notes";
  appendIfText(notes, "p", nextExam.teacherRecommendation?.note, "exam-calendar-recommendation");
  appendIfText(notes, "p", nextExam.localQuota, "exam-calendar-quota");

  panel.append(header, grid, notes);
  return panel;
}

function renderExamRivalPanel(examRivalView = currentExamRivalView) {
  const rivals = Array.isArray(examRivalView?.rivals) ? examRivalView.rivals : [];
  if (!rivals.length) return null;

  const panel = document.createElement("section");
  panel.id = "exam-rival-panel";
  panel.className = "exam-rival-panel";

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = "同场";
  const summary = document.createElement("span");
  summary.textContent = `${rivals.length}名旧识`;
  header.append(title, summary);

  const grid = document.createElement("section");
  grid.className = "exam-rival-grid";
  rivals.forEach((rival) => {
    const card = document.createElement("article");
    card.className = "exam-rival-card";
    card.dataset.rivalId = rival.id || "";
    card.dataset.rivalStatus = rival.relationship || "";
    card.dataset.lastLevel = rival.lastSeenLevel || "";
    if (rival.contactId) card.dataset.contactId = rival.contactId;

    const cardHeader = document.createElement("header");
    appendIfText(cardHeader, "strong", rival.name || "同场士子");
    appendIfText(cardHeader, "span", rival.origin);
    card.appendChild(cardHeader);

    const latest = rival.latest || {};
    appendIfText(card, "p", `${EXAM_LABELS[rival.lastSeenLevel] || rival.lastSeenLevel || "科场"} · ${latest.score ?? "-"}分 · 第${latest.place ?? "-"}名`, "exam-rival-latest");
    appendIfText(card, "p", `${rival.relationship || "rival"} · ${rival.attempts ?? 0}场`, "exam-rival-status");
    grid.appendChild(card);
  });

  panel.append(header, grid);
  return panel;
}

function renderInformationPanelPage(tab, activeTabId) {
  const summary = buildInformationPanelSummary(tab);
  const disabled = isInformationTabDisabled(tab);
  const page = document.createElement("section");
  page.id = tab.panelId;
  page.className = "information-panel-page";
  page.dataset.tabId = tab.id;
  page.dataset.sourceView = tab.sourceView;
  page.dataset.viewReady = summary.ready ? "true" : "false";
  page.dataset.generatedTurn = String(summary.generatedAtTurn ?? currentWorldState?.turnCount ?? 0);
  page.dataset.itemCount = String(summary.total ?? 0);
  page.hidden = tab.id !== activeTabId;

  const title = document.createElement("header");
  appendIfText(title, "strong", tab.title);
  appendIfText(title, "span", summary.ready ? "卷宗已备" : disabled ? "待归档" : "待入簿");

  const stats = document.createElement("div");
  stats.className = "information-panel-stats";
  summary.counts.forEach(([label, value]) => {
    stats.appendChild(createPanelValue(label, value ?? 0, "p"));
  });

  const note = document.createElement("p");
  note.className = "information-panel-note";
  note.textContent = summary.note;

  page.append(title, stats, note);
  const details = renderInformationPanelDetails(tab.id);
  if (details) page.appendChild(details);
  return page;
}

function renderInformationPanelShell() {
  const activeTab = INFORMATION_PANEL_TABS.find((tab) => tab.id === currentInformationPanelTab && !isInformationTabDisabled(tab))
    || INFORMATION_PANEL_TABS.find((tab) => !isInformationTabDisabled(tab));
  const activeTabId = activeTab?.id || "world-geography";

  const panel = document.createElement("section");
  panel.id = "information-panel";
  panel.className = "information-panel";
  panel.dataset.activeTab = activeTabId;
  panel.dataset.worldGeographyView = currentWorldGeographyView ? "ready" : "missing";
  panel.dataset.worldEntityView = currentWorldEntityView ? "ready" : "missing";
  panel.dataset.worldPeopleView = currentWorldPeopleView ? "ready" : "missing";
  panel.dataset.officialPostingsView = currentOfficialPostingsView ? "ready" : "missing";
  panel.dataset.eventArchiveView = currentEventArchiveView ? "ready" : "missing";

  const header = document.createElement("header");
  appendIfText(header, "strong", "局势簿");
  appendIfText(header, "span", "可见局势摘要");

  const tabs = document.createElement("div");
  tabs.className = "information-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "局势簿分类");

  const pages = document.createElement("div");
  pages.className = "information-panel-pages";

  INFORMATION_PANEL_TABS.forEach((tab) => {
    const disabled = isInformationTabDisabled(tab);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "information-tab";
    button.dataset.tabId = tab.id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", tab.panelId);
    button.setAttribute("aria-selected", tab.id === activeTabId ? "true" : "false");
    if (disabled) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    }
    button.textContent = tab.label;
    button.addEventListener("click", () => {
      currentInformationPanelTab = tab.id;
      renderScholarPanel(currentWorldState);
    });
    tabs.appendChild(button);
    pages.appendChild(renderInformationPanelPage(tab, activeTabId));
  });

  panel.append(header, tabs, pages);
  return panel;
}

function appendOptionalPanel(panel) {
  if (panel) {
    scholarPanel.appendChild(panel);
  }
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
    createPanelValue(
      player.role === "magistrate" ? "治所" : player.role === "general" ? "军中根基" : "派系/根基",
      player.role === "magistrate" ? player.countyName || "本县" : player.faction || "未定"
    )
  );

  if (player.role === "official") {
    overview.appendChild(createPanelValue("科名", player.palaceRank ? `${player.palaceRank} ${player.examRank}` : player.examRank || "进士"));
  }
  const roleArchiveButton = createExamArchiveButton(worldState);
  if (roleArchiveButton) overview.appendChild(roleArchiveButton);

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
    general: [
      ["统率", player.command],
      ["部曲", Math.min(100, Math.round((player.troops || 0) / 10))],
      ["军粮", Math.min(100, Math.round((player.supply || 0) / 10))],
      ["战名", player.battleReputation],
      ["侦察", player.scouting],
      ["战险", player.campaignRisk]
    ],
    official: [
      ["上官", player.superiorFavor],
      ["同年", player.peerNetwork],
      ["考成", player.performanceMerit],
      ["升迁", player.promotionProspect],
      ["弹劾", player.impeachmentRisk],
      ["清操", player.cleanReputation]
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
  if (player.role === "general") {
    lists.append(
      createPanelValue("部曲", `${player.troops ?? 0} 人`, "p"),
      createPanelValue("军粮", `${player.supply ?? 0} 石`, "p"),
      createPanelValue("边患", `${worldState.borderThreat}`, "p"),
      createPanelValue("人脉", (player.connections || []).join("、") || "尚无记录", "p")
    );
  } else if (player.role === "magistrate") {
    lists.append(
      createPanelValue("县库", `${player.localTreasury ?? 0} 银`, "p"),
      createPanelValue("朝廷府库", `${worldState.treasury} 银`, "p"),
      createPanelValue("粮储", `${worldState.grainReserve} 石`, "p"),
      createPanelValue("人脉", (player.connections || []).join("、") || "尚无记录", "p")
    );
  } else if (player.role === "official") {
    lists.append(
      createPanelValue("影响/声望", `${player.influence ?? 0} / ${player.reputation ?? 0}`, "p"),
      createPanelValue("操守", `${player.integrity ?? 0}`, "p"),
      createPanelValue("朝局", formatFactions(worldState.factions), "p"),
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
  appendOptionalPanel(renderOfficialCareerPanel());
  appendOptionalPanel(renderWorldThreadPanel());
  appendOptionalPanel(renderInformationPanelShell());
  scholarPanel.appendChild(renderRelationshipPanel());
  appendOptionalPanel(renderExamRivalPanel());
  appendOptionalPanel(renderActiveNpcRequestPanel());
}

function renderScholarPanel(worldState) {
  const player = worldState.player;
  if (player.role === "emperor" || player.role === "minister" || player.role === "official" || player.role === "general" || player.role === "magistrate") {
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
  const archiveButton = createExamArchiveButton(worldState);
  if (archiveButton) progressBlock.appendChild(archiveButton);

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

  scholarPanel.append(progressBlock);
  appendOptionalPanel(renderExamCalendarPanel());
  appendOptionalPanel(renderWorldThreadPanel());
  appendOptionalPanel(renderInformationPanelShell());
  scholarPanel.append(stepList, stats, lists, renderRelationshipPanel());
  appendOptionalPanel(renderExamRivalPanel());
  appendOptionalPanel(renderActiveNpcRequestPanel());
}

function renderWorldState(
  worldState,
  relationshipView,
  activeNpcRequestView,
  longTermEventView,
  officialCareerView,
  examCalendarView,
  examRivalView,
  worldThreadView,
  worldGeographyView,
  worldEntityView,
  worldPeopleView,
  officialPostingsView,
  eventArchiveView
) {
  currentWorldState = worldState;
  currentRelationshipView = getRelationshipView(worldState, relationshipView);
  currentActiveNpcRequestView = getActiveNpcRequestView(activeNpcRequestView);
  currentLongTermEventView = longTermEventView || null;
  currentOfficialCareerView = getOfficialCareerView(worldState, officialCareerView);
  currentExamCalendarView = getExamCalendarView(worldState, examCalendarView);
  currentExamRivalView = getExamRivalView(worldState, examRivalView);
  currentWorldThreadView = getWorldThreadView(worldState, worldThreadView);
  currentWorldGeographyView = getRouteView(worldGeographyView);
  currentWorldEntityView = getRouteView(worldEntityView);
  currentWorldPeopleView = getRouteView(worldPeopleView);
  currentOfficialPostingsView = getRouteView(officialPostingsView);
  currentEventArchiveView = getRouteView(eventArchiveView);
  setStatus(worldState);
  renderScholarPanel(worldState);
  actionInput.placeholder = ACTION_PLACEHOLDERS[worldState.player.role] || "输入你的行动";
}

function renderPayloadWorldState(payload) {
  renderWorldState(
    payload.worldState,
    payload.relationshipView,
    payload.activeNpcRequestView,
    payload.longTermEventView,
    payload.officialCareerView,
    payload.examCalendarView,
    payload.examRivalView,
    payload.worldThreadView,
    payload.worldGeographyView,
    payload.worldEntityView,
    payload.worldPeopleView,
    payload.officialPostingsView,
    payload.eventArchiveView
  );
}

function appendNarrative(text, className) {
  const placeholder = narrative.querySelector(".placeholder");
  if (placeholder) placeholder.remove();

  const paragraph = document.createElement("p");
  paragraph.className = ["narrative-entry", className].filter(Boolean).join(" ");
  paragraph.textContent = text;
  narrative.appendChild(paragraph);
  narrative.scrollTop = narrative.scrollHeight;
  return paragraph;
}

function beginNarrativeStream() {
  discardNarrativeStream();
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

function discardNarrativeStream() {
  if (activeNarrativeStream) {
    activeNarrativeStream.remove();
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

function appendActiveNpcRequestEvents(events) {
  if (!Array.isArray(events) || !events.length) return;
  events.forEach((event) => appendNarrative(event, "active-request-event"));
}

function appendRoleWorldCouplingFeedback(roleWorldCoupling) {
  if (!roleWorldCoupling) return;
  const events = Array.isArray(roleWorldCoupling.events) ? roleWorldCoupling.events : [];
  const kind = roleWorldCoupling.outcome?.kind || "";
  events.forEach((event) => {
    const entry = appendNarrative(`[联动] ${event}`, "role-world-event");
    if (kind) entry.dataset.roleWorldKind = kind;
  });
}

function appendWorldTickFeedback(worldTick) {
  if (!worldTick) return;
  const events = Array.isArray(worldTick.events) ? worldTick.events : [];
  const label = worldTick.label || (worldTick.cadence === "ten_day" ? "旬度" : "月度");
  const to = worldTick.timeAdvance?.to;
  const dateLabel = to ? formatVisibleDate({ dynasty: currentWorldState?.dynasty, ...to }) : "";
  const withDate = (text) => {
    const body = String(text || "");
    if (!dateLabel || /年.+旬/.test(body)) return body;
    return `${dateLabel}：${body}`;
  };

  if (events.length) {
    events.forEach((event) => appendNarrative(`[${label}] ${withDate(event)}`, "world-tick"));
  } else if (worldTick.summary) {
    appendNarrative(`[${label}] ${withDate(worldTick.summary)}`, "world-tick");
  } else if (dateLabel) {
    appendNarrative(`[${label}] 时间推进至${dateLabel}。`, "world-tick");
  }
}

function appendLongTermEventFeedback(longTermEvents) {
  if (!longTermEvents) return;
  const events = Array.isArray(longTermEvents.events) ? longTermEvents.events : [];
  events.forEach((event) => appendNarrative(`[大势] ${event}`, "long-term-event"));
}

function appendOfficialCareerFeedback(officialCareer) {
  if (!officialCareer) return;
  const events = Array.isArray(officialCareer.events) ? officialCareer.events : [];
  events.forEach((event) => appendNarrative(event, "official-career-event"));
}

function getExamSceneTime(payload) {
  return payload?.sceneTime || payload?.examScene || payload?.worldState?.activeExam?.sceneTime || null;
}

function getExamScenePhaseIndex(phase) {
  const index = EXAM_SCENE_PHASE_ORDER.indexOf(phase);
  return index >= 0 ? index : 0;
}

function updateExamSceneControls(payload) {
  if (!examSceneTools || !examSceneStatus) return;
  const sceneTime = getExamSceneTime(payload);

  if (!sceneTime) {
    examSceneTools.hidden = true;
    return;
  }

  examSceneTools.hidden = false;
  const phaseLabel = sceneTime.phaseLabel || "入场";
  const localTurn = Number(sceneTime.turnCount) || 0;
  const elapsed = Number.isFinite(Number(sceneTime.elapsedHours)) ? ` · 约${Number(sceneTime.elapsedHours)}小时` : "";
  const startedAt = sceneTime.startedAt?.label ? ` · 入场：${sceneTime.startedAt.label}` : "";
  examSceneStatus.textContent = `场内阶段：${phaseLabel} · 局部第${localTurn}步${elapsed}${startedAt}`;

  const currentIndex = getExamScenePhaseIndex(sceneTime.phase);
  const targets = ["question_review", "outline", "drafting", "fair_copy"];
  examSceneActionButtons.forEach((button, index) => {
    const targetIndex = getExamScenePhaseIndex(targets[index]);
    button.disabled = targetIndex <= currentIndex;
  });
}

function hasVisibleDateSource(source = {}) {
  const label = readDateLabel(source);
  return Boolean(
    source &&
    typeof source === "object" &&
    ((label && /年.+旬/.test(label)) || source.year !== undefined || source.currentYear !== undefined)
  );
}

function formatVisibleDateSource(source) {
  return hasVisibleDateSource(source) ? formatVisibleDate(source) : "";
}

function getEntryPreparationDateSource(entryPreparation = {}) {
  if (!entryPreparation || typeof entryPreparation !== "object") return null;
  if (entryPreparation.appliedAtYear === undefined && entryPreparation.appliedAtMonth === undefined) return null;
  return {
    year: entryPreparation.appliedAtYear,
    month: entryPreparation.appliedAtMonth,
    tenDayPeriod: entryPreparation.appliedAtTenDayPeriod || entryPreparation.tenDayPeriod || 1
  };
}

function getExamPayloadDateLabel(payload = {}) {
  const sceneTime = getExamSceneTime(payload);
  const sources = [
    sceneTime?.startedAt,
    payload.examStartedAt,
    payload.examCalendar,
    payload.entryPreparation?.examCalendar,
    getEntryPreparationDateSource(payload.entryPreparation),
    payload.examSubmittedAt,
    sceneTime?.updatedAt
  ];
  for (const source of sources) {
    const label = formatVisibleDateSource(source);
    if (label) return label;
  }
  return formatVisibleDate(payload.worldState || currentWorldState || {});
}

function renderExamModal(payload) {
  const previousExamId = currentExamPayload?.examId || null;
  const existingDraft = examEssay.value;
  const shouldPreserveDraft = previousExamId === payload.examId && Boolean(existingDraft);
  currentExamPayload = payload;
  examModal.classList.remove("exam-modal--result");
  examMeta.textContent = `${payload.examName} · ${payload.questionType} · ${payload.difficulty} · ${getExamPayloadDateLabel(payload)}`;
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
  if (payload.entryPreparation) {
    const item = document.createElement("li");
    item.textContent = `赶考准备：${formatEntryPreparation(payload.entryPreparation)}`;
    examRequirements.appendChild(item);
  }
  if (payload.examCalendar || payload.entryPreparation?.examCalendar) {
    const item = document.createElement("li");
    item.textContent = `科期：${formatExamCalendarSnapshot(payload.examCalendar || payload.entryPreparation.examCalendar, payload)}`;
    examRequirements.appendChild(item);
  }
  updateExamSceneControls(payload);
  examEssay.value = shouldPreserveDraft ? existingDraft : "";
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

function getLatestExamHistory(payload) {
  const history = payload?.worldState?.player?.examHistory;
  if (!Array.isArray(history) || !history.length) return null;
  if (typeof history.findLast === "function") {
    return history.findLast((entry) => entry.examId === payload.examId) || history[history.length - 1];
  }
  return [...history].reverse().find((entry) => entry.examId === payload.examId) || history[history.length - 1];
}

function withExamHistoryFallback(payload) {
  const latest = getLatestExamHistory(payload);
  if (!latest) return payload;

  return {
    ...latest,
    ...payload,
    examQuestion: payload.examQuestion || latest.examQuestion,
    essay: payload.essay || latest.essay,
    score: payload.score || latest.score,
    authenticityCheck: payload.authenticityCheck || latest.authenticityCheck,
    virtualCandidates: payload.virtualCandidates || latest.virtualCandidates || [],
    ranking: payload.ranking || latest.ranking || [],
    promotionResult: payload.promotionResult || latest.promotionResult,
    entryPreparation: payload.entryPreparation || latest.entryPreparation,
    examCalendar: payload.examCalendar || latest.examCalendar || latest.entryPreparation?.examCalendar,
    sceneTime: payload.sceneTime || latest.sceneTime
  };
}

function appendIfText(parent, tagName, text, className) {
  if (text === undefined || text === null || text === "") return null;
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function createEssayDetails(title, body, open = false) {
  if (!body) return null;
  const details = document.createElement("details");
  details.className = "candidate-fulltext";
  details.open = open;
  const summary = document.createElement("summary");
  summary.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = body;
  details.append(summary, paragraph);
  return details;
}

function formatEntryPreparation(entryPreparation) {
  if (!entryPreparation) return "";
  const funding = entryPreparation.fullyFunded
    ? `盘费已足，支出${entryPreparation.paidGold}/${entryPreparation.requiredGold}两`
    : `盘费不足，支出${entryPreparation.paidGold}/${entryPreparation.requiredGold}两，缺${entryPreparation.shortfall}两`;
  const effects = Object.entries(entryPreparation.effects || {})
    .map(([key, delta]) => `${ATTRIBUTE_LABELS[key] || key}${delta > 0 ? "+" : ""}${delta}`)
    .join("、");
  return [
    entryPreparation.event,
    funding,
    effects ? `影响：${effects}` : ""
  ].filter(Boolean).join("；");
}

function createEntryPreparationBlock(entryPreparation) {
  const text = formatEntryPreparation(entryPreparation);
  if (!text) return null;
  const block = document.createElement("section");
  block.className = "entry-preparation";
  appendIfText(block, "strong", "赶考准备");
  appendIfText(block, "p", text);
  return block;
}

function formatExamCalendarSnapshot(examCalendar, payload = {}) {
  if (!examCalendar) return "";
  const dateLabel =
    formatVisibleDateSource(payload.sceneTime?.startedAt) ||
    formatVisibleDateSource(payload.examStartedAt) ||
    formatVisibleDateSource(examCalendar) ||
    formatVisibleDateSource(getEntryPreparationDateSource(payload.entryPreparation)) ||
    formatVisibleDate({
      dynasty: currentWorldState?.dynasty,
      year: examCalendar.currentYear,
      month: examCalendar.currentMonth,
      tenDayPeriod: examCalendar.currentTenDayPeriod
    });
  const timing = examCalendar.isOpen
    ? `${dateLabel}本期开场`
    : `候${examCalendar.nextWindowLabel}`;
  const recommendation = examCalendar.teacherRecommendation?.ready
    ? "荐书/声名可用"
    : "荐书/声名未足";
  return [
    timing,
    `常期：${examCalendar.windowLabel || "-"}`,
    `备考${examCalendar.preparationMonths ?? 0}月，路程${examCalendar.travelMonths ?? 0}月`,
    recommendation,
    examCalendar.localQuota
  ].filter(Boolean).join("；");
}

function createExamCalendarBlock(examCalendar, payload = {}) {
  const text = formatExamCalendarSnapshot(examCalendar, payload);
  if (!text) return null;
  const block = document.createElement("section");
  block.className = "entry-preparation exam-calendar-archive";
  appendIfText(block, "strong", "科期");
  appendIfText(block, "p", text);
  return block;
}

function formatExamSceneArchive(sceneTime) {
  if (!sceneTime) return "";
  const started = sceneTime.startedAt?.label ? `入场：${sceneTime.startedAt.label}` : "";
  const submitted = sceneTime.updatedAt?.label ? `交卷：${sceneTime.updatedAt.label}` : "";
  const phase = sceneTime.phaseLabel ? `末段：${sceneTime.phaseLabel}` : "";
  const turns = Number(sceneTime.turnCount) ? `局部${Number(sceneTime.turnCount)}步` : "";
  return [started, submitted, phase, turns].filter(Boolean).join("；");
}

function createExamSceneBlock(sceneTime) {
  const text = formatExamSceneArchive(sceneTime);
  if (!text) return null;
  const block = document.createElement("section");
  block.className = "entry-preparation exam-scene-archive";
  appendIfText(block, "strong", "科场时间");
  appendIfText(block, "p", text);
  return block;
}

function createCandidateProfiles(payload) {
  const candidates = Array.isArray(payload.virtualCandidates) ? payload.virtualCandidates : [];
  const ranking = Array.isArray(payload.ranking) ? payload.ranking : [];
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const profiles = document.createElement("section");
  profiles.className = "candidate-profiles";

  const rankedCandidates = ranking.filter((entry) => !entry.isPlayer);
  const sourceEntries = rankedCandidates.length ? rankedCandidates : candidates;

  sourceEntries.forEach((entry) => {
    const candidate = byId.get(entry.id) || entry;
    const essay = candidate.essay || {};
    const profile = document.createElement("article");
    profile.className = "candidate-profile";

    const header = document.createElement("header");
    const title = document.createElement("div");
    title.className = "candidate-title";
    appendIfText(title, "strong", candidate.name || entry.name || "同场考生");
    appendIfText(title, "span", candidate.origin || entry.origin);

    const marks = document.createElement("div");
    marks.className = "candidate-marks";
    if (entry.place) appendIfText(marks, "span", `第${entry.place}名`);
    const score = entry.score ?? candidate.score?.overall_score;
    if (score !== undefined && score !== null) appendIfText(marks, "span", `${score}分`);
    appendIfText(marks, "span", entry.rank || candidate.score?.rank);
    header.append(title, marks);
    profile.appendChild(header);

    appendIfText(profile, "p", candidate.style || entry.style, "candidate-style");
    appendIfText(profile, "p", candidate.examinerComment || entry.examinerComment, "candidate-comment");
    if (candidate.persistent || entry.persistent) {
      appendIfText(
        profile,
        "p",
        `科场旧识：${candidate.rivalStatus || entry.rivalStatus || "rival"} · 已见${candidate.previousAttempts ?? entry.previousAttempts ?? 0}场`,
        "candidate-meta"
      );
    }

    const strengths = candidate.strengths || entry.strengths || [];
    const weaknesses = candidate.weaknesses || entry.weaknesses || [];
    if (strengths.length || weaknesses.length) {
      const meta = [];
      if (strengths.length) meta.push(`长处：${strengths.join("、")}`);
      if (weaknesses.length) meta.push(`短处：${weaknesses.join("、")}`);
      appendIfText(profile, "p", meta.join("；"), "candidate-meta");
    }

    const essayWrap = document.createElement("section");
    essayWrap.className = "candidate-essay";
    appendIfText(essayWrap, "strong", essay.title || entry.essayTitle);
    if (essay.wordCount) appendIfText(essayWrap, "p", `约${essay.wordCount}字`, "candidate-meta");
    appendIfText(essayWrap, "p", essay.excerpt || entry.essayExcerpt, "candidate-excerpt");
    const fullText = createEssayDetails("展开全文", essay.body, false);
    if (fullText) essayWrap.appendChild(fullText);
    if (essayWrap.childElementCount) profile.appendChild(essayWrap);

    profiles.appendChild(profile);
  });

  if (!profiles.childElementCount) {
    appendIfText(profiles, "p", "本场暂无可查阅的同场文卷。", "candidate-meta");
  }

  return profiles;
}

function createPlayerExamArchive(payload) {
  const archive = document.createElement("section");
  archive.className = "player-exam-archive";

  if (payload.examQuestion) {
    appendIfText(archive, "strong", "题目");
    appendIfText(archive, "p", payload.examQuestion, "archive-question");
  }

  const essayDetails = createEssayDetails("展开本人文章", payload.essay, false);
  if (essayDetails) archive.appendChild(essayDetails);

  const preparationBlock = createEntryPreparationBlock(payload.entryPreparation);
  if (preparationBlock) archive.appendChild(preparationBlock);

  const calendarBlock = createExamCalendarBlock(payload.examCalendar || payload.entryPreparation?.examCalendar, payload);
  if (calendarBlock) archive.appendChild(calendarBlock);

  const sceneBlock = createExamSceneBlock(payload.sceneTime);
  if (sceneBlock) archive.appendChild(sceneBlock);

  const reasonParts = [];
  if (payload.score?.detailed_feedback) reasonParts.push(payload.score.detailed_feedback);
  if (payload.promotionResult?.reason) reasonParts.push(payload.promotionResult.reason);
  appendIfText(archive, "p", reasonParts.join("\n"), "archive-reason");

  return archive;
}

function createRankingList(payload) {
  const ranking = document.createElement("ol");
  ranking.className = "ranking-list";
  (payload.ranking || []).forEach((entry) => {
    const item = document.createElement("li");
    if (entry.isPlayer) item.className = "is-player";
    const name = document.createElement("strong");
    name.textContent = `${entry.place}. ${entry.name}`;
    const detail = document.createElement("span");
    detail.textContent = [entry.origin, entry.score !== undefined ? `${entry.score}分` : null, entry.rank, entry.style, entry.rivalStatus].filter(Boolean).join(" · ");
    item.append(name, detail);
    if (entry.essayTitle || entry.essayExcerpt || entry.examinerComment) {
      const note = document.createElement("small");
      note.textContent = [entry.essayTitle, entry.examinerComment, entry.essayExcerpt].filter(Boolean).join("；");
      item.appendChild(note);
    }
    ranking.appendChild(item);
  });
  return ranking;
}

function createScoreDimensions(score) {
  const dimensions = document.createElement("section");
  dimensions.className = "score-grid";
  Object.entries(SCORE_LABELS).forEach(([key, label]) => {
    const scoreItem = score?.[key];
    if (!scoreItem) return;
    const item = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = `${label} ${scoreItem.score}`;
    const comment = document.createElement("p");
    comment.textContent = scoreItem.comment || "";
    item.append(heading, comment);
    dimensions.appendChild(item);
  });
  return dimensions;
}

function createAuthenticityChecks(authenticityCheck = {}) {
  const checks = document.createElement("section");
  checks.className = "auth-checks";
  const flags = authenticityCheck.flags || [];
  if (flags.length) {
    flags.forEach((flag) => {
      const item = document.createElement("p");
      item.textContent = `${flag.label}：${flag.detail}`;
      checks.appendChild(item);
    });
  } else {
    const clean = document.createElement("p");
    clean.textContent = `未见明显作伪，正文约${authenticityCheck.characterCount ?? "-"}字。`;
    checks.appendChild(clean);
  }
  return checks;
}

function getExamHistory(worldState = currentWorldState) {
  return worldState?.player?.examHistory || [];
}

function createExamArchiveButton(worldState) {
  const history = getExamHistory(worldState);
  if (!history.length) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "panel-action archive-action";
  button.textContent = `考试档案 (${history.length})`;
  button.addEventListener("click", () => renderExamArchive(worldState));
  return button;
}

function renderExamArchive(worldState = currentWorldState) {
  const history = getExamHistory(worldState);
  examModal.classList.add("exam-modal--result");
  examMeta.textContent = "考试档案";
  examTitle.textContent = "历次科场案卷";
  examQuestion.hidden = true;
  examRequirements.hidden = true;
  examSceneTools.hidden = true;
  examWritingTools.hidden = true;
  examEssay.hidden = true;
  examSubmit.hidden = true;
  examResult.hidden = false;
  examResult.innerHTML = "";

  const list = document.createElement("section");
  list.className = "exam-archive-list";

  history.slice().reverse().forEach((entry, index) => {
    const archivedPayload = {
      ...entry,
      worldState,
      virtualCandidates: entry.virtualCandidates || [],
      ranking: entry.ranking || []
    };
    const title = `${history.length - index}. ${entry.examName || EXAM_LABELS[entry.level] || "考试"} · ${getExamPayloadDateLabel(archivedPayload)} · ${entry.score?.overall_score ?? "-"}分 · ${entry.score?.rank || "未定等第"}`;
    const content = document.createElement("section");
    content.className = "exam-archive-entry";
    content.append(
      createPlayerExamArchive(archivedPayload),
      createResultSection("五维评分", createScoreDimensions(entry.score), false),
      createResultSection("监试复核", createAuthenticityChecks(entry.authenticityCheck), false),
      createResultSection("同场榜单", createRankingList(archivedPayload), false),
      createResultSection("同场文卷", createCandidateProfiles(archivedPayload), false)
    );
    list.appendChild(createResultSection(title, content, index === 0));
  });

  if (!history.length) {
    appendIfText(list, "p", "尚无考试档案。");
  }

  examResult.appendChild(list);
  examBackdrop.hidden = false;
}

function renderExamResult(payload) {
  payload = withExamHistoryFallback(payload);
  const playerEntry = (payload.ranking || []).find((entry) => entry.isPlayer);
  const flags = payload.authenticityCheck?.flags || [];
  const promotionText = describePromotionOutcome(payload.promotionResult);

  examModal.classList.add("exam-modal--result");
  examMeta.textContent = `${payload.examName} · 放榜 · ${getExamPayloadDateLabel(payload)}`;
  examTitle.textContent = payload.promotionResult.passed ? "金榜有名" : payload.promotionResult.severeCheat ? "监试黜落" : "榜上无名";
  examQuestion.hidden = true;
  examRequirements.hidden = true;
  examSceneTools.hidden = true;
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
    createResultSection("本场案卷", createPlayerExamArchive(payload), false),
    createResultSection("五维评卷", dimensions, true),
    createResultSection("监试复核", checks, Boolean(flags.length)),
    createResultSection("同场榜单", ranking, true),
    createResultSection("同场文卷", createCandidateProfiles(payload), false)
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
    renderPayloadWorldState(payload);
    renderExamModal(payload);
  } catch (error) {
    appendNarrative(error.message, "error");
  }
}

async function progressExamScene(action) {
  if (!currentSessionId || !currentExamPayload?.examId) return;
  const draft = examEssay.value;

  examSceneActionButtons.forEach((button) => {
    button.disabled = true;
  });

  try {
    const response = await fetch("/api/exam/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentSessionId,
        examId: currentExamPayload.examId,
        action
      })
    });

    if (!response.ok) {
      let message = `科场推进失败：${response.status}`;
      try {
        const errorPayload = await response.json();
        if (errorPayload.error) message = errorPayload.error;
      } catch {
        // Keep the status-based message when the server did not send JSON.
      }
      throw new Error(message);
    }

    const payload = await response.json();
    currentExamPayload = {
      ...currentExamPayload,
      ...payload,
      sceneTime: payload.sceneTime || payload.examScene || payload.worldState?.activeExam?.sceneTime || null
    };
    renderPayloadWorldState(payload);
    examEssay.value = draft;
    updateExamSceneControls(currentExamPayload);
    updateExamSubmitState();
    if (payload.narrative) {
      appendNarrative(payload.narrative, "exam-hint");
    }
  } catch (error) {
    appendNarrative(error.message, "error");
    updateExamSceneControls(currentExamPayload);
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
    renderPayloadWorldState(payload);
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
  appShell.classList.add("app-shell--game-active");
  startPanel.style.display = "none";
  gamePanel.style.display = "";
  actionArea.style.display = "";
}

function showStartView() {
  appShell.classList.remove("app-shell--game-active");
  startPanel.style.display = "";
  gamePanel.style.display = "none";
  actionArea.style.display = "none";
}

async function openSaveModal() {
  saveBackdrop.hidden = false;
  renderSaveList(saveModalList, saveModalStatus, latestSavePayload, { source: "modal-save-list" });
  await refreshSaveList({ modal: true });
}

function closeSaveModal() {
  saveBackdrop.hidden = true;
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
  appendActiveNpcRequestEvents(payload.activeNpcRequestEvents);
  appendRoleWorldCouplingFeedback(payload.roleWorldCoupling);
  appendWorldTickFeedback(payload.worldTick);
  appendLongTermEventFeedback(payload.longTermEvents);
  appendOfficialCareerFeedback(payload.officialCareer);
  renderPayloadWorldState(payload);
  const activeExam = payload.worldState?.activeExam || null;
  if (activeExam && currentExamPayload?.examId === activeExam.examId) {
    currentExamPayload = {
      ...currentExamPayload,
      ...activeExam,
      sceneTime: payload.examScene || activeExam.sceneTime || currentExamPayload.sceneTime,
      worldState: payload.worldState
    };
    updateExamSceneControls(currentExamPayload);
  }
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
    appendTurnDivider(`第${(currentWorldState?.turnCount || 0) + 1}回 · 起 ${formatVisibleDate(currentWorldState || {})}`);
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
        },
        error(data) {
          streamError = new Error(data?.error || "Stream error");
        }
      });

      if (streamError) {
        discardNarrativeStream();
        throw streamError;
      }
      if (!finalPayload) {
        discardNarrativeStream();
        throw new Error("Stream response missing final_state.");
      }
      finishNarrativeStream();
      await handleTurnPayload(finalPayload);
    } else {
      const payload = await response.json();
      appendNarrative(payload.narrative);
      await handleTurnPayload(payload);
    }
  } catch (error) {
    discardNarrativeStream();
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
examSceneActionButtons.forEach((button) => {
  button.addEventListener("click", () => progressExamScene(button.dataset.examAction || button.textContent));
});
examBackdrop.addEventListener("click", (event) => {
  if (event.target === examBackdrop) {
    closeExamModal();
  }
});
saveRefresh.addEventListener("click", () => refreshSaveList());
if (aiTestButton) {
  aiTestButton.addEventListener("click", testAiConnection);
}
saveClose.addEventListener("click", closeSaveModal);
saveBackdrop.addEventListener("click", (event) => {
  if (event.target === saveBackdrop) {
    closeSaveModal();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !examBackdrop.hidden) {
    closeExamModal();
  }
  if (event.key === "Escape" && !saveBackdrop.hidden) {
    closeSaveModal();
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
    renderPayloadWorldState(payload);
    narrative.innerHTML = "";
    appendNarrative(payload.narrative);
    showGameView();
    await refreshSaveList();
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

  await loadSaveSession(savedId, { restore: true, source: "local-storage" });
}

showStartView();
refreshSaveList();
restoreSession();
