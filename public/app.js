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

let currentSessionId = null;
let currentWorldState = null;
let currentRelationshipView = null;
let currentActiveNpcRequestView = null;
let currentLongTermEventView = null;
let currentOfficialCareerView = null;
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
    pendingReview: false,
    lastOutcome: history.at(-1) || null,
    recentOutcomes: history
  };
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

function formatOutcomeDate(outcome) {
  if (!outcome) return "未记";
  return `${outcome.year ?? "-"}年${outcome.month ?? "-"}月 · 第${outcome.turn ?? 0}回`;
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

function renderOfficialCareerPanel(officialCareerView = currentOfficialCareerView) {
  if (!officialCareerView?.active) return null;

  const panel = document.createElement("section");
  panel.id = "official-career-panel";
  panel.className = "official-career-panel";
  panel.dataset.currentPosting = officialCareerView.currentPosting || "";
  panel.dataset.pendingReview = officialCareerView.pendingReview ? "true" : "false";

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = "官场履历";
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

  const history = document.createElement("div");
  history.className = "official-career-history";
  (officialCareerView.recentOutcomes || [])
    .slice(0, -1)
    .reverse()
    .forEach((outcome) => history.appendChild(createOfficialCareerOutcome(outcome)));

  panel.append(header, meta, current);
  if (history.childElementCount) panel.appendChild(history);
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
  scholarPanel.appendChild(renderRelationshipPanel());
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

  scholarPanel.append(progressBlock, stepList, stats, lists, renderRelationshipPanel());
  appendOptionalPanel(renderActiveNpcRequestPanel());
}

function renderWorldState(worldState, relationshipView, activeNpcRequestView, longTermEventView, officialCareerView) {
  currentWorldState = worldState;
  currentRelationshipView = getRelationshipView(worldState, relationshipView);
  currentActiveNpcRequestView = getActiveNpcRequestView(activeNpcRequestView);
  currentLongTermEventView = longTermEventView || null;
  currentOfficialCareerView = getOfficialCareerView(worldState, officialCareerView);
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

function appendActiveNpcRequestEvents(events) {
  if (!Array.isArray(events) || !events.length) return;
  events.forEach((event) => appendNarrative(event, "active-request-event"));
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
  if (payload.entryPreparation) {
    const item = document.createElement("li");
    item.textContent = `赶考准备：${formatEntryPreparation(payload.entryPreparation)}`;
    examRequirements.appendChild(item);
  }
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
    entryPreparation: payload.entryPreparation || latest.entryPreparation
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
    detail.textContent = [entry.origin, entry.score !== undefined ? `${entry.score}分` : null, entry.rank, entry.style].filter(Boolean).join(" · ");
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
    const title = `${history.length - index}. ${entry.examName || EXAM_LABELS[entry.level] || "考试"} · ${entry.score?.overall_score ?? "-"}分 · ${entry.score?.rank || "未定等第"}`;
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
    renderWorldState(payload.worldState, payload.relationshipView, payload.activeNpcRequestView, payload.longTermEventView, payload.officialCareerView);
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
    renderWorldState(payload.worldState, payload.relationshipView, payload.activeNpcRequestView, payload.longTermEventView, payload.officialCareerView);
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
  appendWorldTickFeedback(payload.worldTick);
  appendLongTermEventFeedback(payload.longTermEvents);
  appendOfficialCareerFeedback(payload.officialCareer);
  renderWorldState(payload.worldState, payload.relationshipView, payload.activeNpcRequestView, payload.longTermEventView, payload.officialCareerView);
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
    renderWorldState(payload.worldState, payload.relationshipView, payload.activeNpcRequestView, payload.longTermEventView, payload.officialCareerView);
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
    renderWorldState(payload.worldState, payload.relationshipView, payload.activeNpcRequestView, payload.longTermEventView, payload.officialCareerView);
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
