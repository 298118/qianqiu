const { getExamRequirements, getNextExamLevel } = require("../../game/exams");
const { countEssayCharacters, scoreToRank } = require("../../game/essayChecks");
const { summarizeRelationshipLedger } = require("../../game/relationships");

function describeOpening(worldState) {
  const { dynasty, year, player, setup } = worldState;
  const background = setup.background ? `出身记载：${setup.background}` : "家世未显，前路由一念开端。";
  const custom = setup.customSetting ? `乡里传闻：${setup.customSetting}` : "窗外风声入砚，坊间消息尚待探问。";

  if (player.role === "scholar") {
    return [
      `${dynasty}${year}年，${player.name}以${player.roleLabel}之身居于县学左近。`,
      background,
      custom,
      "案上有《论语》《孟子》与残旧策论数卷，童试之路尚远，却已能闻见考棚纸墨气。",
      "你可以先研读经典、拜访塾师、游学结友、辩论经义、代写文章谋生，也可直接请求赶考。"
    ].join("\n");
  }

  if (player.role === "emperor") {
    return [
      `${dynasty}${year}年，${player.name}临朝听政，殿陛之下百官肃立。`,
      background,
      custom,
      "内帑、漕粮、吏治、边防与民心一并压在御案之上。",
      "你可以下诏赈灾、任免官员、加税筹饷、练兵备边，或召集廷议推行新政。"
    ].join("\n");
  }

  if (player.role === "minister") {
    return [
      `${dynasty}${year}年，${player.name}以${player.position}入署视事，案头奏牍堆叠。`,
      background,
      custom,
      "朝堂派系互相观望，政务成败既关民生，也关你的名节与权势。",
      "你可以上疏谏言、督办公务、结交同僚、弹劾攻讦，或在派系之间谨慎周旋。"
    ].join("\n");
  }

  if (player.role === "general") {
    return [
      `${dynasty}${year}年，${player.name}以${player.position}驻营边镇，鼓角未歇，烽燧相望。`,
      background,
      custom,
      "营中兵额、军粮、士气、斥候回报与战役风险都牵动边境态势；轻进可立战名，也可能折损部曲。",
      "你可以募兵整补、清点粮饷、操练士卒、遣斥候侦察、修堡守边，或率营出战。"
    ].join("\n");
  }

  if (player.role === "magistrate") {
    return [
      `${dynasty}${year}年，${player.name}以${player.position}到任${player.countyName || "本县"}，县署鼓楼初鸣。`,
      background,
      custom,
      "案头有钱粮簿、词讼卷、盗匪缉捕牌票与河渠修浚图册，乡绅、胥吏、里甲都在看新官第一步如何落笔。",
      "你可以审理诉讼、清查钱粮、安抚乡绅、缉捕盗匪、调发赋役，或兴修水利以稳地方民心。"
    ].join("\n");
  }

  if (player.role === "official") {
    return [
      `${dynasty}${year}年，${player.name}以${player.officeTitle || player.position}入署观政，朱批、公牍与上官眼色一同压到案头。`,
      background,
      custom,
      "入仕后的生涯不只看文章清名，还看上官考成、同年网络、升迁声望、弹劾风险与清操口碑。",
      "你可以奉上官差遣、经营同年、办理考成、谋求升迁、弹劾贪墨，或谨守清操以稳官声。"
    ].join("\n");
  }

  return [
    `${dynasty}${year}年，${player.name}以${player.roleLabel}之身立于局中。`,
    background,
    custom,
    "天下财赋、粮储、民心、军情皆会随你的文字行动逐步变化。"
  ].join("\n");
}

async function startGame(worldState) {
  return {
    narrative: describeOpening(worldState),
    events: [
      `${worldState.dynasty}${worldState.year}年，${worldState.player.name}开始其${worldState.player.roleLabel}生涯。`
    ]
  };
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniqueAppend(list, value, limit = 8) {
  const next = Array.isArray(list) ? [...list] : [];
  if (value && !next.includes(value)) {
    next.push(value);
  }
  return next.slice(-limit);
}

function capStat(value) {
  return Math.max(0, Math.min(100, value));
}

function extractBook(input) {
  const bracketed = input.match(/《([^》]+)》/);
  if (bracketed) return `《${bracketed[1]}》`;

  const knownBooks = ["论语", "孟子", "大学", "中庸", "诗经", "尚书", "礼记", "春秋", "易经", "资治通鉴", "史记"];
  const found = knownBooks.find((book) => input.includes(book));
  return found ? `《${found}》` : "经义典籍";
}

function buildAttributeChanges(before, patch, reason = "行动影响") {
  const attributeChanges = [];
  const beforeWorld = before && before.player ? before : { player: before || {} };
  const beforePlayer = beforeWorld.player || {};
  const labels = {
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
  const factionLabels = {
    eunuchs: "宦官",
    scholarOfficials: "士大夫",
    militaryLords: "武臣"
  };

  for (const [key, after] of Object.entries(patch || {})) {
    if (key === "player" || key === "factions") continue;
    const beforeValue = beforeWorld[key];
    if (typeof after === "number" && typeof beforeValue === "number" && after !== beforeValue) {
      attributeChanges.push({
        path: key,
        label: labels[key] || key,
        before: beforeValue,
        after,
        reason
      });
    }
  }

  for (const [key, after] of Object.entries(patch.factions || {})) {
    const beforeValue = beforeWorld.factions?.[key];
    if (typeof after === "number" && typeof beforeValue === "number" && after !== beforeValue) {
      attributeChanges.push({
        path: `factions.${key}`,
        label: factionLabels[key] || key,
        before: beforeValue,
        after,
        reason
      });
    }
  }

  for (const [key, after] of Object.entries(patch.player || {})) {
    const before = beforePlayer[key];
    if (typeof after === "number" && typeof before === "number" && after !== before) {
      attributeChanges.push({
        path: `player.${key}`,
        label: labels[key] || key,
        before,
        after,
        reason
      });
    }
  }

  return attributeChanges;
}

function makeResult({ narrative, patch, events, player, worldState, examTrigger, reason, relationshipChanges }) {
  return {
    narrative,
    statePatch: patch,
    attributeChanges: buildAttributeChanges(worldState || player, patch, reason),
    relationshipChanges: relationshipChanges || [],
    events,
    examTrigger: examTrigger || { shouldStart: false, level: null, reason: "" }
  };
}

function getVisibleRelationshipTargets(worldState) {
  const summary = summarizeRelationshipLedger(
    worldState?.relationshipLedger,
    worldState || {},
    { visibleOnly: true }
  );

  return {
    characters: Array.isArray(summary.characters) ? summary.characters : [],
    factions: Array.isArray(summary.factions) ? summary.factions : []
  };
}

function firstVisibleCharacterId(targets) {
  return targets.characters.find((entry) => entry.id === "C01")?.id || targets.characters[0]?.id || null;
}

function firstVisibleOfficialContactId(targets) {
  return targets.characters.find((entry) => entry.id === "C02")?.id || firstVisibleCharacterId(targets);
}

function pushRelationshipChange(changes, targets, targetType, targetId, config) {
  const bucket = targetType === "character" ? targets.characters : targets.factions;
  if (!targetId || !bucket.some((entry) => entry.id === targetId)) return;

  const change = {
    targetType,
    targetId,
    relationshipDelta: config.relationshipDelta || 0,
    resentmentDelta: config.resentmentDelta || 0,
    reason: config.reason || config.note || "Mock relationship reaction."
  };

  if (config.stance) change.stance = config.stance;
  if (config.recentIntent) change.recentIntent = config.recentIntent;
  if (config.note) change.note = config.note;

  changes.push(change);
}

function pushCharacterReaction(changes, targets, config) {
  pushRelationshipChange(changes, targets, "character", firstVisibleCharacterId(targets), config);
}

function pushOfficialContactReaction(changes, targets, config) {
  pushRelationshipChange(changes, targets, "character", firstVisibleOfficialContactId(targets), config);
}

function pushFactionReaction(changes, targets, targetId, config) {
  pushRelationshipChange(changes, targets, "faction", targetId, config);
}

function buildMockRelationshipChanges(worldState, actionKey) {
  const targets = getVisibleRelationshipTargets(worldState);
  const changes = [];

  switch (actionKey) {
    case "scholar_study":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "encouraging mentor",
        recentIntent: "Keep testing the player's learning discipline.",
        note: "Steady study improves the mentor's confidence.",
        reason: "The player spent the turn studying classical texts."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 1,
        resentmentDelta: 0,
        stance: "attentive exam network",
        recentIntent: "Watch whether the player can convert study into exam merit.",
        note: "County scholars hear that the player is working steadily.",
        reason: "Consistent study is noticed by the scholar-official network."
      });
      break;
    case "scholar_teacher":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 5,
        resentmentDelta: -2,
        stance: "trusted mentor",
        recentIntent: "Prepare a cautious recommendation if diligence continues.",
        note: "A respectful teacher visit deepens the mentor bond.",
        reason: "The player sought instruction through proper etiquette."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "orthodox patronage",
        recentIntent: "Treat the player as a possible county-school recommendation.",
        note: "Formal study under a teacher strengthens exam-network trust.",
        reason: "Teacher patronage connects the player to orthodox scholar circles."
      });
      break;
    case "scholar_travel":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 2,
        resentmentDelta: 0,
        stance: "expanding acquaintance",
        recentIntent: "Compare the player's reputation against other county students.",
        note: "Travel and gatherings add the player to more scholar conversations.",
        reason: "The player used social study to widen local contacts."
      });
      break;
    case "scholar_debate":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 1,
        resentmentDelta: 1,
        stance: "demanding mentor",
        recentIntent: "Push the player to argue more carefully.",
        note: "Debate earns respect but also sharper scrutiny.",
        reason: "Public debate made the player's learning more visible."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 1,
        resentmentDelta: 1,
        note: "A visible debate draws both praise and criticism.",
        reason: "Argument in public affects the scholar-official network."
      });
      break;
    case "scholar_work":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: -1,
        resentmentDelta: 1,
        stance: "concerned mentor",
        recentIntent: "Warn the player not to trade study time for quick money.",
        note: "Taking paid writing work raises concern about distraction.",
        reason: "The player spent the turn earning money instead of studying."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: -1,
        resentmentDelta: 1,
        note: "Some local scholars see paid writing as a distraction from the exams.",
        reason: "Money work slightly weakens the player's exam-network image."
      });
      break;
    case "scholar_exam":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "recommending mentor",
        recentIntent: "Watch the player's exam performance closely.",
        note: "Preparing for the exam makes the mentor more invested.",
        reason: "The player formally moved toward the examination path."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        note: "The examination network now has a concrete reason to notice the player.",
        reason: "Exam entry creates a public scholar-official stake."
      });
      break;
    case "scholar_rest":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 1,
        resentmentDelta: -1,
        stance: "patient mentor",
        recentIntent: "Wait for the player to resume study.",
        note: "Measured rest reassures the mentor that the player is not burning out.",
        reason: "The player rested instead of forcing another risky action."
      });
      break;
    case "emperor_relief":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 4,
        resentmentDelta: -2,
        stance: "publicly approving court",
        recentIntent: "Praise benevolent relief while watching fiscal strain.",
        note: "Relief policy wins scholar-official approval.",
        reason: "Imperial disaster relief aligns with orthodox benevolent rule."
      });
      pushFactionReaction(changes, targets, "eunuchs", {
        relationshipDelta: -2,
        resentmentDelta: 2,
        stance: "resentful palace network",
        recentIntent: "Look for ways to recover influence over relief funds.",
        note: "Palace intermediaries resent stricter relief accounting.",
        reason: "Relief reduces room for inner-court handling of resources."
      });
      break;
    case "emperor_tax":
      pushFactionReaction(changes, targets, "eunuchs", {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "useful revenue channel",
        recentIntent: "Support fiscal extraction while avoiding blame.",
        note: "New revenue gives palace channels room to maneuver.",
        reason: "Tax increases favor factions that profit from revenue handling."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: -4,
        resentmentDelta: 4,
        stance: "critical remonstrance",
        recentIntent: "Press the throne to reduce pressure on common households.",
        note: "Tax pressure angers civil officials concerned with local order.",
        reason: "Heavier taxation damages the throne's scholar-official support."
      });
      break;
    case "emperor_appointments":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "empowered bureaucracy",
        recentIntent: "Offer policy support if clean appointments continue.",
        note: "Clean appointments strengthen civil confidence.",
        reason: "Personnel reform favors scholar-official legitimacy."
      });
      pushFactionReaction(changes, targets, "eunuchs", {
        relationshipDelta: -4,
        resentmentDelta: 5,
        stance: "threatened palace network",
        recentIntent: "Protect old channels from further investigation.",
        note: "Personnel cleanup threatens inner-court dependents.",
        reason: "Appointments and investigations reduce factional shelter."
      });
      break;
    case "emperor_military":
      pushFactionReaction(changes, targets, "militaryLords", {
        relationshipDelta: 5,
        resentmentDelta: -2,
        stance: "favored command bloc",
        recentIntent: "Seek more funds and commissions after military attention.",
        note: "Border preparation improves relations with armed interests.",
        reason: "Military policy benefits garrison and command networks."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: -1,
        resentmentDelta: 1,
        note: "Civil officials worry that soldiers are gaining leverage.",
        reason: "Military expansion shifts court balance toward armed interests."
      });
      break;
    case "minister_memorial":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "admiring clean faction",
        recentIntent: "Use the player's memorial as a rallying point.",
        note: "Direct remonstrance improves clean-name standing.",
        reason: "A principled memorial pleases orthodox officials."
      });
      pushFactionReaction(changes, targets, "eunuchs", {
        relationshipDelta: -2,
        resentmentDelta: 2,
        note: "The memorial threatens interests tied to corrupt channels.",
        reason: "Anti-corruption speech creates factional enemies."
      });
      break;
    case "minister_network":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 4,
        resentmentDelta: 1,
        stance: "dense factional network",
        recentIntent: "Trade favors while watching whether the player overreaches.",
        note: "Networking builds allies but also factional suspicion.",
        reason: "The player deliberately cultivated official networks."
      });
      break;
    case "minister_affairs":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "reliable administrator",
        recentIntent: "Back the player on practical policy work.",
        note: "Competent public work increases trust in the ministry.",
        reason: "Administrative delivery gives the player bureaucratic credit."
      });
      break;
    case "minister_attack":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: -1,
        resentmentDelta: 2,
        stance: "uneasy factional operator",
        recentIntent: "Use the attack if useful, but keep distance from scandal.",
        note: "Political attacks create influence and stored grievance.",
        reason: "Factional attacks make allies and enemies less stable."
      });
      pushFactionReaction(changes, targets, "eunuchs", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        note: "Palace channels appreciate pressure on civil rivals.",
        reason: "A political attack can benefit palace-aligned interests."
      });
      break;
    case "official_observe":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "promising junior official",
        recentIntent: "See whether the player learns office routines quickly.",
        note: "Patient observation earns confidence from senior officials.",
        reason: "The player approached office work with humility."
      });
      pushOfficialContactReaction(changes, targets, {
        relationshipDelta: 1,
        resentmentDelta: 0,
        note: "A senior contact hears that the player is learning the rules.",
        reason: "Observation improves the player's bureaucratic reputation."
      });
      break;
    case "official_assessment":
      pushOfficialContactReaction(changes, targets, {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "watchful superior",
        recentIntent: "Consider the player for a future recommendation if results hold.",
        note: "Orderly performance records make the player easier to recommend.",
        reason: "The player worked directly on performance review and promotion prospects."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "rising clean official",
        recentIntent: "Track whether the player's merit is durable or merely polished.",
        note: "Good performance review strengthens orthodox promotion standing.",
        reason: "Merit records improve the player's standing in the bureaucracy."
      });
      break;
    case "official_impeach":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 3,
        resentmentDelta: 0,
        stance: "principled censorial ally",
        recentIntent: "Use the player's evidence if it withstands counterattack.",
        note: "Evidence-backed impeachment improves clean-name standing.",
        reason: "The player challenged corrupt conduct through formal channels."
      });
      pushFactionReaction(changes, targets, "eunuchs", {
        relationshipDelta: -4,
        resentmentDelta: 5,
        stance: "threatened brokerage channel",
        recentIntent: "Look for a flaw in the player's paperwork.",
        note: "Impeachment threatens protected interests.",
        reason: "Anti-corruption action creates enemies among informal power channels."
      });
      pushOfficialContactReaction(changes, targets, {
        relationshipDelta: 1,
        resentmentDelta: 2,
        note: "The superior sees courage but also danger in the player's memorial.",
        reason: "Impeachment raises both admiration and caution from office contacts."
      });
      break;
    case "official_case":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "lawful administrator",
        recentIntent: "Recommend the player if case handling remains fair.",
        note: "Fair casework improves bureaucratic trust.",
        reason: "The player used office authority to settle disputes."
      });
      break;
    case "official_relief":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "benevolent local official",
        recentIntent: "Credit the player for visible local relief.",
        note: "Relief and farming work improve the player's clean-name reputation.",
        reason: "The player spent resources on local welfare."
      });
      break;
    case "official_network":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "connected peer",
        recentIntent: "Exchange favors through examination-year ties.",
        note: "Meeting peers strengthens the player's official network.",
        reason: "The player cultivated examination and office relationships."
      });
      pushOfficialContactReaction(changes, targets, {
        relationshipDelta: 2,
        resentmentDelta: -1,
        note: "A personal contact becomes more willing to help.",
        reason: "The player invested in direct social ties."
      });
      break;
    case "official_bribe":
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: -5,
        resentmentDelta: 5,
        stance: "suspicious clean faction",
        recentIntent: "Collect evidence if the player's conduct worsens.",
        note: "Bribery stains the player's standing with clean officials.",
        reason: "Corrupt conduct damages orthodox bureaucratic trust."
      });
      pushFactionReaction(changes, targets, "eunuchs", {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "profitable private channel",
        recentIntent: "Offer access while the player remains useful.",
        note: "Corrupt channels become friendlier when money moves.",
        reason: "Bribery aligns the player with informal palace-style brokerage."
      });
      break;
    case "general_recruit":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 2,
        resentmentDelta: 1,
        stance: "busy staff officer",
        recentIntent: "Check whether new soldiers can be fed and drilled.",
        note: "Recruitment gives the camp more hands but more mouths to feed.",
        reason: "The general expanded the command with new troops."
      });
      pushFactionReaction(changes, targets, "militaryLords", {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "growing command bloc",
        recentIntent: "Seek more commissions if recruitment continues.",
        note: "Military interests favor a stronger camp.",
        reason: "Recruitment strengthens armed networks."
      });
      break;
    case "general_supply":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "relieved quartermaster staff",
        recentIntent: "Use the fuller stores to stabilize the next campaign.",
        note: "Orderly supply work makes the camp easier to manage.",
        reason: "The general focused on grain and pay for the troops."
      });
      pushFactionReaction(changes, targets, "militaryLords", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "fed garrison network",
        recentIntent: "Back the player while supplies remain reliable.",
        note: "Supply discipline improves garrison confidence.",
        reason: "Reliable military stores improve relations with armed interests."
      });
      break;
    case "general_drill":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 2,
        resentmentDelta: 0,
        stance: "disciplined camp deputy",
        recentIntent: "Press the soldiers through harsher drill if morale holds.",
        note: "Regular drill gives officers clearer command habits.",
        reason: "The general drilled troops and tightened camp order."
      });
      pushFactionReaction(changes, targets, "militaryLords", {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "admiring command bloc",
        recentIntent: "Watch for battlefield proof after drill results.",
        note: "Visible drill wins respect among military networks.",
        reason: "Improved morale and command reflect well on the general."
      });
      break;
    case "general_scout":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "trusted scoutmaster",
        recentIntent: "Bring sharper reports before any major engagement.",
        note: "Careful reconnaissance makes the staff trust the plan.",
        reason: "The general sent scouts before committing the army."
      });
      pushFactionReaction(changes, targets, "militaryLords", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "patient frontier officers",
        recentIntent: "Support a measured campaign if the intelligence holds.",
        note: "Scout reports make border commanders less anxious.",
        reason: "Reconnaissance lowers avoidable campaign risk."
      });
      break;
    case "general_fortify":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "steady garrison staff",
        recentIntent: "Hold the line and ask for more stores if threat returns.",
        note: "Fortification gives the camp a safer frontier posture.",
        reason: "The general strengthened border defenses instead of gambling on battle."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 1,
        resentmentDelta: -1,
        stance: "cautiously approving civil officials",
        recentIntent: "Accept defensive spending if it reduces border panic.",
        note: "Civil officials prefer steady defense to reckless campaigns.",
        reason: "Fortification lowers frontier risk with less political shock."
      });
      break;
    case "general_campaign":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 2,
        resentmentDelta: 2,
        stance: "battle-tested staff officer",
        recentIntent: "Count losses and argue for rest before another sortie.",
        note: "Battle earns respect but leaves the camp counting casualties.",
        reason: "The general led troops into a campaign."
      });
      pushFactionReaction(changes, targets, "militaryLords", {
        relationshipDelta: 4,
        resentmentDelta: -1,
        stance: "victory-minded command bloc",
        recentIntent: "Use the result to press for more authority.",
        note: "Battlefield action raises the general's standing with armed interests.",
        reason: "Campaign success gives the military faction a visible champion."
      });
      break;
    case "general_default":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 1,
        resentmentDelta: 0,
        note: "Routine camp business leaves a small trace among officers.",
        reason: "The general handled ordinary military business."
      });
      break;
    case "magistrate_case":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 4,
        resentmentDelta: -1,
        stance: "capable county deputy",
        recentIntent: "Bring more difficult lawsuits once the magistrate proves steady.",
        note: "Fair hearings make the county office more willing to cooperate.",
        reason: "The magistrate spent the turn hearing lawsuits and settling disputes."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "approving local literati",
        recentIntent: "Watch whether fair judgments continue without private favors.",
        note: "Local literati approve of visible judicial order.",
        reason: "Fair casework strengthens orthodox local-government reputation."
      });
      break;
    case "magistrate_tax":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: -2,
        resentmentDelta: 3,
        stance: "strained yamen staff",
        recentIntent: "Comply with the tax push while avoiding blame from villagers.",
        note: "Money and grain work strains the county office.",
        reason: "Tax and treasury pressure creates local resentment."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: -2,
        resentmentDelta: 3,
        stance: "critical local gentry",
        recentIntent: "Resist harsh collection if household pressure keeps rising.",
        note: "Gentry networks dislike harsher fiscal pressure.",
        reason: "County treasury work can look like harsh extraction."
      });
      break;
    case "magistrate_gentry":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "mediating county deputy",
        recentIntent: "Use gentry goodwill to settle the next local pressure point.",
        note: "Careful gentry mediation gives the yamen more room to move.",
        reason: "The magistrate invested in local elite relationships."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 4,
        resentmentDelta: -1,
        stance: "cooperative gentry network",
        recentIntent: "Offer help if the magistrate respects local face.",
        note: "Gentry relations improve after a careful visit.",
        reason: "The magistrate cultivated local scholar-gentry support."
      });
      break;
    case "magistrate_bandits":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 2,
        resentmentDelta: 1,
        stance: "busy county deputy",
        recentIntent: "Push constables harder if bandit cases keep falling.",
        note: "Anti-bandit work earns confidence but adds pressure to the staff.",
        reason: "The magistrate organized local patrol and arrest work."
      });
      pushFactionReaction(changes, targets, "militaryLords", {
        relationshipDelta: 2,
        resentmentDelta: -1,
        stance: "useful patrol partner",
        recentIntent: "Coordinate constables and small garrison support when needed.",
        note: "Security work slightly improves ties with armed interests.",
        reason: "Suppressing bandits creates a limited security partnership."
      });
      break;
    case "magistrate_corvee":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: -1,
        resentmentDelta: 3,
        stance: "overburdened county office",
        recentIntent: "Warn that forced labor will draw complaints if continued.",
        note: "Corvee mobilization makes the yamen and villages tense.",
        reason: "The magistrate increased labor obligations."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: -2,
        resentmentDelta: 3,
        stance: "watchful remonstrance network",
        recentIntent: "Complain if forced labor turns into abuse.",
        note: "Local scholars dislike heavy labor demands.",
        reason: "Corvee pressure harms local civil reputation."
      });
      break;
    case "magistrate_waterworks":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 3,
        resentmentDelta: -1,
        stance: "practical county deputy",
        recentIntent: "Help track labor, materials, and village complaints.",
        note: "Waterworks make the county staff see a practical program.",
        reason: "The magistrate invested in irrigation and river works."
      });
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 3,
        resentmentDelta: -2,
        stance: "supportive local gentry",
        recentIntent: "Claim credit if the works protect fields from drought and flood.",
        note: "Waterworks win support from local literati and landholders.",
        reason: "Useful public works strengthen local legitimacy."
      });
      break;
    case "magistrate_default":
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 1,
        resentmentDelta: 0,
        note: "Routine yamen work leaves a modest trace among local contacts.",
        reason: "The magistrate handled ordinary county business."
      });
      break;
    default:
      pushFactionReaction(changes, targets, "scholarOfficials", {
        relationshipDelta: 1,
        resentmentDelta: 0,
        note: "The action leaves a small trace in official gossip.",
        reason: "The player's public action is visible to nearby social networks."
      });
      break;
  }

  return changes.slice(0, 5);
}

function numberIncreases(before, after) {
  return typeof before === "number" && typeof after === "number" && after > before;
}

function numberDecreases(before, after) {
  return typeof before === "number" && typeof after === "number" && after < before;
}

function arrayExpands(before, after) {
  return Array.isArray(after) && after.length > (Array.isArray(before) ? before.length : 0);
}

function classifyScholarRelationshipAction(worldState, patch, examTrigger) {
  const player = worldState.player || {};
  const playerPatch = patch.player || {};

  if (examTrigger?.shouldStart) return "scholar_exam";
  if (Object.prototype.hasOwnProperty.call(playerPatch, "teacher")) return "scholar_teacher";
  if (Object.prototype.hasOwnProperty.call(playerPatch, "studiedBooks")) return "scholar_study";
  if (numberIncreases(player.gold, playerPatch.gold)) return "scholar_work";
  if (arrayExpands(player.connections, playerPatch.connections)) {
    return Object.prototype.hasOwnProperty.call(playerPatch, "literaryTalent")
      ? "scholar_debate"
      : "scholar_travel";
  }
  return "scholar_rest";
}

function classifyEmperorRelationshipAction(worldState, patch) {
  if (numberIncreases(worldState.armySize, patch.armySize)) return "emperor_military";
  if (numberIncreases(worldState.taxRate, patch.taxRate)) return "emperor_tax";
  if (numberDecreases(worldState.treasury, patch.treasury) && numberDecreases(worldState.grainReserve, patch.grainReserve)) {
    return "emperor_relief";
  }
  if (numberDecreases(worldState.corruption, patch.corruption)) return "emperor_appointments";
  return "emperor_council";
}

function classifyMinisterRelationshipAction(worldState, patch) {
  const player = worldState.player || {};
  const playerPatch = patch.player || {};

  if (arrayExpands(player.connections, playerPatch.connections)) return "minister_network";
  if (numberIncreases(worldState.treasury, patch.treasury) || numberIncreases(worldState.grainReserve, patch.grainReserve)) {
    return "minister_affairs";
  }
  if (numberDecreases(player.integrity, playerPatch.integrity)) return "minister_attack";
  if (numberIncreases(player.integrity, playerPatch.integrity)) return "minister_memorial";
  return "minister_default";
}

function classifyOfficialRelationshipAction(worldState, patch) {
  const player = worldState.player || {};
  const playerPatch = patch.player || {};

  if (numberIncreases(worldState.corruption, patch.corruption) && numberIncreases(player.gold, playerPatch.gold)) {
    return "official_bribe";
  }
  if (
    numberIncreases(player.impeachmentRisk, playerPatch.impeachmentRisk) &&
    numberIncreases(player.cleanReputation, playerPatch.cleanReputation) &&
    numberDecreases(worldState.corruption, patch.corruption)
  ) {
    return "official_impeach";
  }
  if (arrayExpands(player.connections, playerPatch.connections)) return "official_network";
  if (numberIncreases(player.academia, playerPatch.academia) || numberIncreases(player.adaptability, playerPatch.adaptability)) {
    return "official_observe";
  }
  if (numberIncreases(worldState.publicOrder, patch.publicOrder) && numberDecreases(worldState.corruption, patch.corruption)) {
    return "official_case";
  }
  if (numberDecreases(worldState.grainReserve, patch.grainReserve) || numberIncreases(worldState.population, patch.population)) {
    return "official_relief";
  }
  if (
    numberIncreases(player.performanceMerit, playerPatch.performanceMerit) &&
    (numberIncreases(player.promotionProspect, playerPatch.promotionProspect) ||
      numberIncreases(player.superiorFavor, playerPatch.superiorFavor))
  ) {
    return "official_assessment";
  }
  return "official_default";
}

function classifyGeneralRelationshipAction(worldState, patch) {
  const player = worldState.player || {};
  const playerPatch = patch.player || {};

  if (numberDecreases(worldState.borderThreat, patch.borderThreat) && numberDecreases(player.troops, playerPatch.troops)) {
    return "general_campaign";
  }
  if (numberIncreases(player.scouting, playerPatch.scouting)) return "general_scout";
  if (numberDecreases(player.campaignRisk, playerPatch.campaignRisk) && numberDecreases(worldState.borderThreat, patch.borderThreat)) {
    return "general_fortify";
  }
  if (numberIncreases(player.supply, playerPatch.supply)) return "general_supply";
  if (numberIncreases(player.troops, playerPatch.troops)) return "general_recruit";
  if (numberIncreases(player.command, playerPatch.command) || numberIncreases(worldState.armyMorale, patch.armyMorale)) {
    return "general_drill";
  }
  return "general_default";
}

function classifyMagistrateRelationshipAction(worldState, patch) {
  const player = worldState.player || {};
  const playerPatch = patch.player || {};
  const corveeDelta = typeof player.corveeBurden === "number" && typeof playerPatch.corveeBurden === "number"
    ? playerPatch.corveeBurden - player.corveeBurden
    : 0;

  if (numberIncreases(player.waterworks, playerPatch.waterworks)) return "magistrate_waterworks";
  if (numberDecreases(player.banditPressure, playerPatch.banditPressure)) return "magistrate_bandits";
  if (numberIncreases(player.gentryRelations, playerPatch.gentryRelations)) return "magistrate_gentry";
  if (corveeDelta >= 4) return "magistrate_corvee";
  if (numberIncreases(player.localTreasury, playerPatch.localTreasury)) return "magistrate_tax";
  if (numberDecreases(player.pendingLawsuits, playerPatch.pendingLawsuits)) return "magistrate_case";
  return "magistrate_default";
}

function classifyRelationshipAction(worldState, result) {
  const patch = result?.statePatch || {};
  const examTrigger = result?.examTrigger || {};
  const role = worldState?.player?.role;

  if (role === "scholar") return classifyScholarRelationshipAction(worldState, patch, examTrigger);
  if (role === "emperor") return classifyEmperorRelationshipAction(worldState, patch);
  if (role === "minister") return classifyMinisterRelationshipAction(worldState, patch);
  if (role === "official") return classifyOfficialRelationshipAction(worldState, patch);
  if (role === "general") return classifyGeneralRelationshipAction(worldState, patch);
  if (role === "magistrate") return classifyMagistrateRelationshipAction(worldState, patch);
  return "generic";
}

function withMockRelationshipReactions(result, worldState) {
  const existing = Array.isArray(result.relationshipChanges) ? result.relationshipChanges : [];
  const generated = buildMockRelationshipChanges(worldState, classifyRelationshipAction(worldState, result));

  return {
    ...result,
    relationshipChanges: [...existing, ...generated].slice(0, 5)
  };
}

function buildStudyTurn(input, player) {
  const book = extractBook(input);
  const academiaGain = 2 + Math.floor(Math.random() * 3);
  const literaryGain = book === "经义典籍" ? 1 : 1 + Math.floor(Math.random() * 2);
  const mentalityGain = Math.random() > 0.55 ? 1 : 0;
  const patch = {
    player: {
      academia: capStat(player.academia + academiaGain),
      literaryTalent: capStat(player.literaryTalent + literaryGain),
      studiedBooks: uniqueAppend(player.studiedBooks, book, 10)
    }
  };

  if (mentalityGain) patch.player.mentality = capStat(player.mentality + mentalityGain);

  return makeResult({
    player,
    patch,
    narrative: pickRandom([
      `你闭门研读${book}数日，先逐章疏通字义，再摘出疑难另作札记。灯影摇动之间，经义渐渐入心。`,
      `你翻开${book}，反复揣摩圣贤微言。县学旧案上纸屑满地，胸中章句却比昨日坚实许多。`,
      `塾中老先生见你勤勉，借来一册旧注疏。你对照${book}细读，文章根基因此更稳。`
    ]),
    events: [`${player.name}研读${book}，学识与文采有所精进。`]
  });
}

function buildTeacherTurn(player) {
  const teacherName = player.teacher || pickRandom(["顾文衡", "李明远", "周子谦"]);
  const alreadyHasTeacher = Boolean(player.teacher);
  const goldCost = alreadyHasTeacher ? 1 : 2;
  const patch = {
    player: {
      teacher: teacherName,
      reputation: capStat(player.reputation + (alreadyHasTeacher ? 1 : 2)),
      academia: capStat(player.academia + 1),
      gold: Math.max(0, player.gold - goldCost),
      connections: uniqueAppend(player.connections, `${teacherName}门生`, 8)
    }
  };

  return makeResult({
    player,
    patch,
    narrative: alreadyHasTeacher
      ? `你携一束修脯前往${teacherName}处请教。先生点破几处经义关节，又嘱你少作浮词、多求本旨。`
      : `你备了薄礼拜访${teacherName}。先生见你态度诚恳，收你为记名弟子，自此可在门下听讲经义。`,
    events: [`${player.name}拜访${teacherName}，师承与名声更稳。`]
  });
}

function buildTravelTurn(player) {
  const friend = pickRandom(["沈砚舟", "陆季常", "许伯言", "林怀瑾"]);
  const patch = {
    player: {
      adaptability: capStat(player.adaptability + 2),
      reputation: capStat(player.reputation + 1),
      mentality: capStat(player.mentality + 1),
      gold: Math.max(0, player.gold - 1),
      connections: uniqueAppend(player.connections, friend, 8)
    }
  };

  return makeResult({
    player,
    patch,
    narrative: pickRandom([
      `你随同窗出城游学，访古寺、问义田、听舟人谈漕运。路费用去一些，眼界却开阔不少，并结识了${friend}。`,
      `书院茶会里，你与${friend}谈经论文。言辞往复之间，临场机辩与乡里名声都有进益。`,
      `你行至邻县讲会，见士子议论民生利病。归来再读策论，胸中不再只有章句。`
    ]),
    events: [`${player.name}外出游学，结识${friend}，见闻渐广。`]
  });
}

function buildDebateTurn(player) {
  const rival = pickRandom(["方季良", "赵修然", "韩听泉"]);
  const patch = {
    player: {
      adaptability: capStat(player.adaptability + 2),
      literaryTalent: capStat(player.literaryTalent + 1),
      reputation: capStat(player.reputation + 1),
      mentality: capStat(player.mentality + (Math.random() > 0.45 ? 1 : 0)),
      connections: uniqueAppend(player.connections, rival, 8)
    }
  };

  return makeResult({
    player,
    patch,
    narrative: `你在县学廊下与${rival}辩论经义。几番往复，虽有一两处被人驳倒，却也学会如何临场立论、收束文势。`,
    events: [`${player.name}与${rival}辩论经义，机辩与声望有所增长。`]
  });
}

function buildWorkTurn(player) {
  const goldGain = 3 + Math.floor(Math.random() * 5);
  const patch = {
    player: {
      gold: player.gold + goldGain,
      literaryTalent: capStat(player.literaryTalent + 1),
      mentality: capStat(player.mentality - (Math.random() > 0.65 ? 1 : 0))
    }
  };

  return makeResult({
    player,
    patch,
    narrative: pickRandom([
      `你替乡邻代写书信与寿序，得了${goldGain}文钱。笔墨虽为生计而动，遣词造句也因此更熟。`,
      `你在书铺帮人抄写经卷，日复一日颇觉枯燥，却赚得${goldGain}文，可补纸墨束脩。`,
      `你为乡绅家写了一篇序文，主人颇为满意，厚赠${goldGain}文钱。`
    ]),
    events: [`${player.name}代写文章谋生，赚得${goldGain}文。`]
  });
}

function buildExamTurn(player) {
  const targetLevel = getNextExamLevel(player.examRank);
  const patch = { player: {} };

  if (!targetLevel) {
    return makeResult({
      player,
      patch,
      narrative: "你已是进士出身，不必再参加科举。眼下更该思量入仕后的去处与政务。",
      events: []
    });
  }

  const readyScore = player.academia + player.literaryTalent + player.mentality + player.reputation;
  const advice = readyScore < 58
    ? "只是自觉火候尚浅，若再读几卷书、请教师友，或许更稳。"
    : "胸中虽仍忐忑，所学已足以一试锋芒。";

  return makeResult({
    player,
    patch,
    narrative: `你收拾行装，准备前往考场。考期将近，纸墨、干粮、行囊一一备妥。${advice}`,
    events: [`${player.name}决定赶考。`],
    examTrigger: { shouldStart: true, level: targetLevel, reason: "玩家主动请求赶考" }
  });
}

function buildRestTurn(input, player) {
  const mentalityGain = 1;
  const patch = {
    player: {
      mentality: capStat(player.mentality + mentalityGain),
      health: Math.min(100, player.health + 1)
    }
  };

  return makeResult({
    player,
    patch,
    narrative: pickRandom([
      `你暂放书卷，在县学中静坐半日，整理思绪。窗外鸟鸣声细，心绪渐宁。`,
      `你信步走到河边，看渔人撒网。归来后铺纸研墨，只写数行随笔，倒也神清气定。`,
      `今日无特别之事。你在书房中翻了翻旧日文章，觉出从前浮躁处，心性因此更沉。`
    ]),
    events: [`${player.name}休整一日，心性稍定。`]
  });
}

function buildScholarTurn(input, player) {
  const text = input.trim();

  if (/研读|读书|阅读|翻阅|诵读|学习|苦读|钻研|攻读|温书|习经/.test(text)) {
    return buildStudyTurn(text, player);
  }

  if (/拜师|拜访|请教|求教|访师|问学|投师|塾师/.test(text)) {
    return buildTeacherTurn(player);
  }

  if (/游学|结交|交友|清谈|雅集|讲会|访友|同窗/.test(text)) {
    return buildTravelTurn(player);
  }

  if (/辩论|论辩|辩经|驳论|策问|讲论/.test(text)) {
    return buildDebateTurn(player);
  }

  if (/谋生|赚钱|代写|抄书|书信|做工|挣錢|挣钱|糊口|润笔|写序/.test(text)) {
    return buildWorkTurn(player);
  }

  if (/考试|赶考|童试|乡试|会试|殿试|参加考试|应试|赴考|入场/.test(text)) {
    return buildExamTurn(player);
  }

  return buildRestTurn(text, player);
}

function shiftStat(value, delta, min = 0, max = 100) {
  return Math.max(min, Math.min(max, (value || 0) + delta));
}

function shiftResource(value, delta) {
  return Math.max(0, (value || 0) + delta);
}

function buildFactionState(worldState, deltas) {
  const current = worldState.factions || {};
  return {
    eunuchs: shiftStat(current.eunuchs ?? 50, deltas.eunuchs || 0),
    scholarOfficials: shiftStat(current.scholarOfficials ?? 50, deltas.scholarOfficials || 0),
    militaryLords: shiftStat(current.militaryLords ?? 50, deltas.militaryLords || 0)
  };
}

function buildEmperorTurn(input, worldState) {
  const text = input.trim();
  const player = worldState.player;

  if (/赈灾|赈济|赈粮|开仓|救灾|荒政|饥|灾/.test(text)) {
    const patch = {
      treasury: shiftResource(worldState.treasury, -80),
      grainReserve: shiftResource(worldState.grainReserve, -140),
      publicOrder: shiftStat(worldState.publicOrder, 6),
      corruption: shiftStat(worldState.corruption, 1),
      player: {
        mandate: shiftStat(player.mandate, 5),
        courtControl: shiftStat(player.courtControl, 1)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 2, eunuchs: -1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "皇帝赈灾",
      narrative: "你降旨开仓赈济，命户部拨银、漕仓出粟，并遣御史查核灾区册籍。灾民暂得喘息，士大夫称颂仁政，只是府库与粮储因此吃紧。",
      events: [`${player.name}下诏开仓赈灾，民心稍安。`]
    });
  }

  if (/征税|加税|税|加派|摊派|徭役|筹饷/.test(text)) {
    const patch = {
      treasury: shiftResource(worldState.treasury, 150),
      taxRate: shiftStat(worldState.taxRate, 5),
      publicOrder: shiftStat(worldState.publicOrder, -6),
      corruption: shiftStat(worldState.corruption, 2),
      player: {
        mandate: shiftStat(player.mandate, -4),
        personalPower: shiftStat(player.personalPower, 1)
      },
      factions: buildFactionState(worldState, { eunuchs: 2, scholarOfficials: -1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "皇帝筹饷",
      narrative: "你准户部加派钱粮以补军国急用。库银账面顿时宽裕，然而州县催科加紧，民间怨声也随之浮起。",
      events: [`${player.name}加派钱粮筹饷，府库稍丰而民心受损。`]
    });
  }

  if (/用人|任命|提拔|罢免|整饬吏治|清查|吏治|考成|御史/.test(text)) {
    const patch = {
      corruption: shiftStat(worldState.corruption, -5),
      publicOrder: shiftStat(worldState.publicOrder, 2),
      player: {
        personalPower: shiftStat(player.personalPower, 3),
        courtControl: shiftStat(player.courtControl, 4),
        mandate: shiftStat(player.mandate, 1)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 3, eunuchs: -2, militaryLords: -1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "皇帝整饬吏治",
      narrative: "你亲自圈点几名清望官员，命都察院清查积弊。朝中一时风声收紧，旧日倚势渔利者纷纷观望，皇权与朝局控制都有所上升。",
      events: [`${player.name}整饬吏治，朝局为之一肃。`]
    });
  }

  if (/军事|边防|征兵|练兵|出征|讨伐|边患|军/.test(text)) {
    const patch = {
      treasury: shiftResource(worldState.treasury, -110),
      armySize: shiftResource(worldState.armySize, 35),
      armyMorale: shiftStat(worldState.armyMorale, 6),
      borderThreat: shiftStat(worldState.borderThreat, -5),
      publicOrder: shiftStat(worldState.publicOrder, -1),
      player: {
        personalPower: shiftStat(player.personalPower, 2),
        mandate: shiftStat(player.mandate, 1)
      },
      factions: buildFactionState(worldState, { militaryLords: 4, scholarOfficials: -1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "皇帝整军",
      narrative: "你命兵部核实边镇军册，拨银修械，并选将操练。军心因此振作，边患略缓，但武臣声势也随军令增长。",
      events: [`${player.name}整军备边，军心稍振。`]
    });
  }

  const patch = {
    publicOrder: shiftStat(worldState.publicOrder, 1),
    player: {
      courtControl: shiftStat(player.courtControl, 1),
      mandate: shiftStat(player.mandate, 1),
      mentality: shiftStat(player.mentality, 1)
    }
  };

  return makeResult({
    worldState,
    player,
    patch,
    reason: "皇帝听政",
    narrative: `你将“${text}”交付廷议，令内阁拟票、六部覆核。此事尚未大动国本，却让百官更明白圣意所在。`,
    events: [`${player.name}召廷议处置：${text.slice(0, 30)}`]
  });
}

function buildMinisterTurn(input, worldState) {
  const text = input.trim();
  const player = worldState.player;

  if (/上疏|奏疏|谏|劝谏|直言|条陈/.test(text)) {
    const patch = {
      corruption: shiftStat(worldState.corruption, -2),
      player: {
        influence: shiftStat(player.influence, 2),
        integrity: shiftStat(player.integrity, 4),
        reputation: shiftStat(player.reputation, 2)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 2, eunuchs: -1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "大臣上疏",
      narrative: "你连夜具疏，措辞不激而锋芒内藏，直指弊政根由。御前虽未立刻施行，清议却已记下你的名节。",
      events: [`${player.name}上疏谏言，清议声望稍起。`]
    });
  }

  if (/结党|拉拢|门生|党羽|联络|拜会|同僚|清流|阉党/.test(text)) {
    const ally = pickRandom(["陈少宰", "吴给事", "何侍御", "钱主事"]);
    const patch = {
      corruption: shiftStat(worldState.corruption, 1),
      player: {
        influence: shiftStat(player.influence, 5),
        integrity: shiftStat(player.integrity, -2),
        connections: uniqueAppend(player.connections, ally, 8)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 3 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "大臣经营人脉",
      narrative: `你借朝退之机拜会${ally}，又托同年转递私札。人脉渐密，话语权也重了些，只是公私界限开始变得暧昧。`,
      events: [`${player.name}联络${ally}，朝中影响上升。`]
    });
  }

  if (/政务|清丈|赈灾|漕运|税粮|办案|执行|督办|核查|仓场/.test(text)) {
    const patch = {
      treasury: shiftResource(worldState.treasury, 55),
      grainReserve: shiftResource(worldState.grainReserve, 35),
      publicOrder: shiftStat(worldState.publicOrder, 3),
      corruption: shiftStat(worldState.corruption, -2),
      player: {
        influence: shiftStat(player.influence, 3),
        integrity: shiftStat(player.integrity, 1),
        reputation: shiftStat(player.reputation, 1)
      }
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "大臣督办公务",
      narrative: "你亲自核对仓册与钱粮流向，催促属官限期回报。政务推进得不算华丽，却使府库、粮储与民间秩序都有了实际起色。",
      events: [`${player.name}督办公务，钱粮与民心稍稳。`]
    });
  }

  if (/谣言|攻讦|弹劾|弹章|流言|排挤|倾轧/.test(text)) {
    const patch = {
      corruption: shiftStat(worldState.corruption, 2),
      player: {
        influence: shiftStat(player.influence, 4),
        integrity: shiftStat(player.integrity, -5),
        reputation: shiftStat(player.reputation, -1)
      },
      factions: buildFactionState(worldState, { scholarOfficials: -1, eunuchs: 1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "大臣攻讦",
      narrative: "你授意言官递上弹章，语涉隐微，足以让对手数日不得安枕。此举立竿见影，却也让朝堂倾轧更深。",
      events: [`${player.name}借弹章攻讦政敌，权势与名节一升一损。`]
    });
  }

  const patch = {
    publicOrder: shiftStat(worldState.publicOrder, 1),
    player: {
      influence: shiftStat(player.influence, 1),
      mentality: shiftStat(player.mentality, 1)
    }
  };

  return makeResult({
    worldState,
    player,
    patch,
    reason: "大臣视事",
    narrative: `你将“${text}”写入今日公牍，交由属官分头查办。事情暂未惊动朝局，但你的署中声气更稳了一些。`,
    events: [`${player.name}署中视事：${text.slice(0, 30)}`]
  });
}

function buildOfficialTurn(input, worldState) {
  const text = input.trim();
  const player = worldState.player;

  if (/考成|考绩|磨勘|铨选|荐举|升迁|迁转|功过|吏部/.test(text)) {
    const patch = {
      player: {
        superiorFavor: shiftStat(player.superiorFavor, 4),
        performanceMerit: shiftStat(player.performanceMerit, 7),
        promotionProspect: shiftStat(player.promotionProspect, 5),
        cleanReputation: shiftStat(player.cleanReputation, 2),
        influence: shiftStat(player.influence, 3),
        reputation: shiftStat(player.reputation, 2)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 2 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "官员考成升迁",
      narrative: "你将岁内案牍、钱粮、狱讼与民情分门别类，呈给上官磨勘。纸面功过尚不能立刻换来新官职，却让考成簿上多了可被举荐的一笔。",
      events: [`${player.name}整饬考成簿，升迁声望稍进。`]
    });
  }

  if (/弹劾|参劾|纠举|御史|贪官|贪墨官|劾奏|奏劾/.test(text)) {
    const patch = {
      corruption: shiftStat(worldState.corruption, -3),
      player: {
        cleanReputation: shiftStat(player.cleanReputation, 5),
        impeachmentRisk: shiftStat(player.impeachmentRisk, 6),
        superiorFavor: shiftStat(player.superiorFavor, -1),
        performanceMerit: shiftStat(player.performanceMerit, 2),
        influence: shiftStat(player.influence, 2),
        integrity: shiftStat(player.integrity, 2),
        reputation: shiftStat(player.reputation, 2)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 2, eunuchs: -2 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "官员弹劾贪墨",
      narrative: "你核实赃簿与往来书札，具疏参劾一名贪墨官员。清议因此看重你几分，可被牵连者也会记下这笔账，弹劾之路从来不是无风之桥。",
      events: [`${player.name}具疏弹劾贪墨，清名与风险同涨。`]
    });
  }

  if (/观政|学习|请教|衙门|章程|上官|公牍|署事/.test(text)) {
    const patch = {
      player: {
        influence: shiftStat(player.influence, 2),
        academia: shiftStat(player.academia, 1),
        adaptability: shiftStat(player.adaptability, 1),
        superiorFavor: shiftStat(player.superiorFavor, 3),
        performanceMerit: shiftStat(player.performanceMerit, 2),
        reputation: shiftStat(player.reputation, 1)
      }
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "官员观政",
      narrative: `你以${player.officeTitle || player.position}身份入署观政，随堂听断、翻检旧案。纸面制诰之外，真正的吏事脉络开始显出形状。`,
      events: [`${player.name}入署观政，渐熟官场章程。`]
    });
  }

  if (/断案|审案|平讼|治安|捕盗|盗|狱/.test(text)) {
    const patch = {
      publicOrder: shiftStat(worldState.publicOrder, 4),
      corruption: shiftStat(worldState.corruption, -1),
      player: {
        influence: shiftStat(player.influence, 3),
        integrity: shiftStat(player.integrity, 2),
        cleanReputation: shiftStat(player.cleanReputation, 4),
        performanceMerit: shiftStat(player.performanceMerit, 4),
        impeachmentRisk: shiftStat(player.impeachmentRisk, -2),
        reputation: shiftStat(player.reputation, 2)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "官员断案",
      narrative: "你翻阅供词，重问两造，又命差役复核里甲证言。案情虽琐碎，却让百姓知道新官并非只会写文章。",
      events: [`${player.name}审理争讼，地方秩序稍安。`]
    });
  }

  if (/赈济|劝农|水利|粮|农|河堤|荒/.test(text)) {
    const patch = {
      grainReserve: shiftResource(worldState.grainReserve, -45),
      population: shiftResource(worldState.population, 25),
      publicOrder: shiftStat(worldState.publicOrder, 3),
      player: {
        influence: shiftStat(player.influence, 2),
        reputation: shiftStat(player.reputation, 3),
        integrity: shiftStat(player.integrity, 1),
        performanceMerit: shiftStat(player.performanceMerit, 3),
        cleanReputation: shiftStat(player.cleanReputation, 2),
        promotionProspect: shiftStat(player.promotionProspect, 1)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "官员抚民",
      narrative: "你请开常平仓一角，又亲往乡间劝农修渠。粮储有所消耗，但饥困人户得以暂稳，地方口碑随之转好。",
      events: [`${player.name}劝农抚民，地方民心稍定。`]
    });
  }

  if (/拜会|结交|同年|座师|请托|门生|馆阁/.test(text)) {
    const ally = pickRandom(["同年陆季常", "座师门下顾司业", "翰林同僚许伯言"]);
    const riskyFavor = /请托|关说|私情/.test(text);
    const patch = {
      player: {
        influence: shiftStat(player.influence, 4),
        peerNetwork: shiftStat(player.peerNetwork, 6),
        promotionProspect: shiftStat(player.promotionProspect, riskyFavor ? 3 : 2),
        impeachmentRisk: shiftStat(player.impeachmentRisk, riskyFavor ? 2 : 0),
        integrity: shiftStat(player.integrity, riskyFavor ? -2 : -1),
        cleanReputation: shiftStat(player.cleanReputation, riskyFavor ? -2 : -1),
        connections: uniqueAppend(player.connections, ally, 8)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 2 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "官员经营同年",
      narrative: `你备帖拜会${ally}，谈及馆阁旧题与部曹近事。同年关系渐可倚仗，只是人情往来总会牵动操守。`,
      events: [`${player.name}拜会${ally}，官场人脉渐广。`]
    });
  }

  if (/贪墨|受贿|索贿|敛财|收礼/.test(text)) {
    const patch = {
      corruption: shiftStat(worldState.corruption, 5),
      player: {
        gold: shiftResource(player.gold, 24),
        integrity: shiftStat(player.integrity, -9),
        cleanReputation: shiftStat(player.cleanReputation, -10),
        impeachmentRisk: shiftStat(player.impeachmentRisk, 9),
        superiorFavor: shiftStat(player.superiorFavor, -2),
        promotionProspect: shiftStat(player.promotionProspect, -3),
        reputation: shiftStat(player.reputation, -3),
        influence: shiftStat(player.influence, 1)
      },
      factions: buildFactionState(worldState, { scholarOfficials: -3, eunuchs: 2 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "官员受贿",
      narrative: "你收下案中人送来的厚礼，将几处关节轻轻放过。银钱来得容易，名节与吏治却都被暗暗蚀去。",
      events: [`${player.name}收受请托，银钱增加而操守受损。`]
    });
  }

  const patch = {
    player: {
      influence: shiftStat(player.influence, 1),
      performanceMerit: shiftStat(player.performanceMerit, 1),
      mentality: shiftStat(player.mentality, 1)
    }
  };

  return makeResult({
    worldState,
    player,
    patch,
    reason: "官员署事",
    narrative: `你在署中处置“${text}”，先问旧例，再看上官风向。虽未立刻扬名，也算把入仕后的第一层门槛摸清了。`,
    events: [`${player.name}署中处事：${text.slice(0, 30)}`]
  });
}

function buildGeneralTurn(input, worldState) {
  const text = input.trim();
  const player = worldState.player;

  if (/募兵|征兵|招募|补兵|点兵|扩军|整补/.test(text)) {
    const recruitCount = 80;
    const patch = {
      treasury: shiftResource(worldState.treasury, -55),
      armySize: shiftResource(worldState.armySize, recruitCount),
      armyMorale: shiftStat(worldState.armyMorale, -1),
      player: {
        troops: shiftResource(player.troops, recruitCount),
        supply: shiftResource(player.supply, -35),
        command: shiftStat(player.command, 2),
        campaignRisk: shiftStat(player.campaignRisk, 3),
        influence: shiftStat(player.influence, 2)
      },
      factions: buildFactionState(worldState, { militaryLords: 3, scholarOfficials: -1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "将领募兵整补",
      narrative: "你点检营籍，挑选壮丁补入缺额，令老卒分队带练。兵额渐厚，营中声势也盛，只是新兵尚需粮饷与操练，贸然用之仍有隐忧。",
      events: [`${player.name}募兵整补，营中部曲增多。`]
    });
  }

  if (/粮饷|军粮|粮草|补给|屯田|转运|饷银|清点粮/.test(text)) {
    const patch = {
      treasury: shiftResource(worldState.treasury, -30),
      grainReserve: shiftResource(worldState.grainReserve, -35),
      armyMorale: shiftStat(worldState.armyMorale, 3),
      player: {
        supply: shiftResource(player.supply, 95),
        campaignRisk: shiftStat(player.campaignRisk, -2),
        command: shiftStat(player.command, 1),
        influence: shiftStat(player.influence, 1)
      },
      factions: buildFactionState(worldState, { militaryLords: 2 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "将领整顿粮饷",
      narrative: "你亲自核军粮仓册，催转运到营，又令军需官分清赏罚。营中灶烟连日不断，士卒知粮饷有着落，出战之忧也少了几分。",
      events: [`${player.name}清点粮饷，军粮与士气略稳。`]
    });
  }

  if (/操练|练兵|校阅|阵法|士气|军纪|演武|训兵/.test(text)) {
    const patch = {
      armyMorale: shiftStat(worldState.armyMorale, 6),
      player: {
        supply: shiftResource(player.supply, -25),
        command: shiftStat(player.command, 5),
        battleReputation: shiftStat(player.battleReputation, 2),
        campaignRisk: shiftStat(player.campaignRisk, -1),
        influence: shiftStat(player.influence, 1)
      },
      factions: buildFactionState(worldState, { militaryLords: 2 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "将领操练士卒",
      narrative: "你清晨擂鼓点卯，分队演阵，亲自校看弓马与火器。士卒汗透甲衣，却知军令有度，营中军心与统率都更紧了一层。",
      events: [`${player.name}操练士卒，军心与统率提升。`]
    });
  }

  if (/侦察|斥候|探马|哨骑|巡边|探报|敌情|烽燧/.test(text)) {
    const patch = {
      borderThreat: shiftStat(worldState.borderThreat, -2),
      player: {
        supply: shiftResource(player.supply, -12),
        scouting: shiftStat(player.scouting, 8),
        campaignRisk: shiftStat(player.campaignRisk, -5),
        command: shiftStat(player.command, 1),
        battleReputation: shiftStat(player.battleReputation, 1)
      },
      factions: buildFactionState(worldState, { militaryLords: 1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "将领遣斥候侦察",
      narrative: "你挑熟边路的哨骑夜出，沿烽燧、河滩与旧堡查探敌踪。探报虽未尽明，已能分辨虚实，若再出兵，胜败不至全凭胆气。",
      events: [`${player.name}遣斥候巡边，敌情稍明。`]
    });
  }

  if (/守边|修堡|筑城|营垒|加固|边防|设防|烽火台/.test(text)) {
    const patch = {
      treasury: shiftResource(worldState.treasury, -35),
      borderThreat: shiftStat(worldState.borderThreat, -4),
      armyMorale: shiftStat(worldState.armyMorale, 2),
      player: {
        supply: shiftResource(player.supply, -30),
        command: shiftStat(player.command, 2),
        campaignRisk: shiftStat(player.campaignRisk, -6),
        battleReputation: shiftStat(player.battleReputation, 1),
        integrity: shiftStat(player.integrity, 1)
      },
      factions: buildFactionState(worldState, { militaryLords: 1, scholarOfficials: 1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "将领修堡守边",
      narrative: "你按地势修补旧堡，增设望台，令各墩堡约定烽火号令。此举不如冲阵显赫，却让边墙多了几分可守之势。",
      events: [`${player.name}修堡守边，边患压力下降。`]
    });
  }

  if (/出战|会战|进剿|讨伐|追击|奇袭|迎敌|破敌|开战/.test(text)) {
    const prepared = (player.scouting || 0) >= 42 && (player.supply || 0) >= 280 && (worldState.armyMorale || 0) >= 58;
    const troopLoss = prepared ? 32 : 78;
    const supplyLoss = prepared ? 70 : 105;
    const borderDrop = prepared ? -9 : -4;
    const moraleDelta = prepared ? 3 : -4;
    const patch = {
      armySize: shiftResource(worldState.armySize, -troopLoss),
      armyMorale: shiftStat(worldState.armyMorale, moraleDelta),
      borderThreat: shiftStat(worldState.borderThreat, borderDrop),
      publicOrder: shiftStat(worldState.publicOrder, prepared ? 1 : -1),
      player: {
        troops: shiftResource(player.troops, -troopLoss),
        supply: shiftResource(player.supply, -supplyLoss),
        command: shiftStat(player.command, prepared ? 4 : 2),
        battleReputation: shiftStat(player.battleReputation, prepared ? 7 : 3),
        campaignRisk: shiftStat(player.campaignRisk, prepared ? 4 : 10),
        influence: shiftStat(player.influence, prepared ? 4 : 2)
      },
      factions: buildFactionState(worldState, { militaryLords: prepared ? 4 : 2, scholarOfficials: prepared ? 0 : -1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: prepared ? "将领稳妥出战" : "将领冒险出战",
      narrative: prepared
        ? "你据斥候所报择地设伏，先以小队诱敌，再令中军截其归路。战后虽有伤亡，边寇锋芒大挫，营中战名由此渐起。"
        : "你乘士气未散强行出战，前锋一度得手，却因敌情未尽明而折损偏重。边患稍退，营中也记住了这场险胜的代价。",
      events: [`${player.name}${prepared ? "率营破敌" : "冒险出战"}，边患稍缓而营中有损。`]
    });
  }

  const patch = {
    player: {
      command: shiftStat(player.command, 1),
      mentality: shiftStat(player.mentality, 1),
      campaignRisk: shiftStat(player.campaignRisk, -1)
    }
  };

  return makeResult({
    worldState,
    player,
    patch,
    reason: "将领营务视事",
    narrative: `你将“${text}”记入营务簿，先问中军旧例，再召各把总回报。此事未必立刻惊动边墙，却让你更熟悉一营兵马的脾性。`,
    events: [`${player.name}营中视事：${text.slice(0, 30)}`]
  });
}

function buildMagistrateTurn(input, worldState) {
  const text = input.trim();
  const player = worldState.player;
  const countyName = player.countyName || "本县";

  if (/水利|河堤|渠道|沟渠|灌溉|旱|涝|堤|渠|荒政/.test(text)) {
    const patch = {
      grainReserve: shiftResource(worldState.grainReserve, -20),
      population: shiftResource(worldState.population, 15),
      publicOrder: shiftStat(worldState.publicOrder, 2),
      player: {
        localTreasury: shiftResource(player.localTreasury, -60),
        localOrder: shiftStat(player.localOrder, 4),
        banditPressure: shiftStat(player.banditPressure, -1),
        corveeBurden: shiftStat(player.corveeBurden, 2),
        waterworks: shiftStat(player.waterworks, 8),
        influence: shiftStat(player.influence, 2),
        integrity: shiftStat(player.integrity, 1),
        reputation: shiftStat(player.reputation, 3)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "地方官兴修水利",
      narrative: `你带县丞踏勘${countyName}旧渠，量定夫役与木石，先修最险的一段河堤。县库支出不少，百姓也要出力，但田畴有水，秋后口碑可期。`,
      events: [`${player.name}督修${countyName}水利，地方民心与水利略稳。`]
    });
  }

  if (/审案|断案|词讼|诉讼|讼|狱|平讼|民争|争讼|听断/.test(text)) {
    const patch = {
      publicOrder: shiftStat(worldState.publicOrder, 2),
      corruption: shiftStat(worldState.corruption, -1),
      player: {
        localOrder: shiftStat(player.localOrder, 5),
        pendingLawsuits: shiftStat(player.pendingLawsuits, -3),
        influence: shiftStat(player.influence, 2),
        integrity: shiftStat(player.integrity, 2),
        reputation: shiftStat(player.reputation, 2)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "地方官审理词讼",
      narrative: `你升堂听断，先令两造陈词，再命书吏核对契券与里甲证言。几桩积案虽未尽清，${countyName}百姓已看见县堂有章法。`,
      events: [`${player.name}审理${countyName}词讼，积案稍减。`]
    });
  }

  if (/捕盗|缉盗|盗匪|巡检|保甲|治安|夜巡|缉捕|贼/.test(text)) {
    const patch = {
      publicOrder: shiftStat(worldState.publicOrder, 2),
      player: {
        localTreasury: shiftResource(player.localTreasury, -25),
        localOrder: shiftStat(player.localOrder, 4),
        banditPressure: shiftStat(player.banditPressure, -7),
        influence: shiftStat(player.influence, 3),
        reputation: shiftStat(player.reputation, 2)
      },
      factions: buildFactionState(worldState, { militaryLords: 1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "地方官缉捕盗匪",
      narrative: `你整点快手与巡检，按保甲册夜查出入道路。盗匪声势被压下几分，县库却为缉捕赏银和差役口粮耗去一笔。`,
      events: [`${player.name}整饬${countyName}捕盗，盗匪压力下降。`]
    });
  }

  if (/钱粮|县库|税粮|清丈|催科|粮册|赋税|田亩|核查/.test(text)) {
    const cleanAudit = /清丈|核查|清查|复核/.test(text);
    const patch = {
      treasury: shiftResource(worldState.treasury, cleanAudit ? 20 : 35),
      corruption: shiftStat(worldState.corruption, cleanAudit ? -1 : 1),
      publicOrder: shiftStat(worldState.publicOrder, cleanAudit ? -1 : -2),
      player: {
        localTreasury: shiftResource(player.localTreasury, cleanAudit ? 70 : 95),
        localOrder: shiftStat(player.localOrder, cleanAudit ? -1 : -3),
        gentryRelations: shiftStat(player.gentryRelations, cleanAudit ? -2 : -4),
        corveeBurden: shiftStat(player.corveeBurden, 1),
        influence: shiftStat(player.influence, 2),
        integrity: shiftStat(player.integrity, cleanAudit ? 2 : -1)
      },
      factions: buildFactionState(worldState, { scholarOfficials: cleanAudit ? 0 : -1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: cleanAudit ? "地方官清查钱粮" : "地方官催科钱粮",
      narrative: cleanAudit
        ? `你抽查黄册与鱼鳞册，追问几处田亩隐漏。县库收入有补，吏胥不敢太露锋芒，只是乡绅面上多了几分冷色。`
        : `你催里甲限期完纳钱粮，县库账面顿时厚实，州府也有回音。只是催科声急，乡间怨气随鼓梆一同传开。`,
      events: [`${player.name}${cleanAudit ? "清查" : "催征"}${countyName}钱粮，县库有所增益。`]
    });
  }

  if (/乡绅|士绅|宗族|豪强|里甲|拜会|调解|耆老|保正/.test(text)) {
    const ally = pickRandom(["周里正", "沈族长", "顾监生", "陆耆老"]);
    const riskyFavor = /请托|豪强|私情|关说/.test(text);
    const patch = {
      publicOrder: shiftStat(worldState.publicOrder, 1),
      player: {
        localOrder: shiftStat(player.localOrder, 2),
        gentryRelations: shiftStat(player.gentryRelations, 6),
        pendingLawsuits: shiftStat(player.pendingLawsuits, -1),
        influence: shiftStat(player.influence, 2),
        integrity: shiftStat(player.integrity, riskyFavor ? -1 : 0),
        connections: uniqueAppend(player.connections, ally, 8)
      },
      factions: buildFactionState(worldState, { scholarOfficials: 2 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "地方官安抚乡绅",
      narrative: `你在县署后堂设茶，邀${ally}与几位里甲耆老同坐，先谈荒歉，再谈词讼与钱粮。地方人情稍通，日后推行政务可少几分硬碰硬。`,
      events: [`${player.name}安抚${countyName}乡绅，结识${ally}。`]
    });
  }

  if (/徭役|差役|赋役|派夫|修路|夫役|催役|工役/.test(text)) {
    const patch = {
      publicOrder: shiftStat(worldState.publicOrder, -2),
      player: {
        localTreasury: shiftResource(player.localTreasury, 30),
        localOrder: shiftStat(player.localOrder, -4),
        gentryRelations: shiftStat(player.gentryRelations, -2),
        corveeBurden: shiftStat(player.corveeBurden, 6),
        influence: shiftStat(player.influence, 2),
        integrity: shiftStat(player.integrity, -2)
      },
      factions: buildFactionState(worldState, { scholarOfficials: -1 })
    };

    return makeResult({
      worldState,
      player,
      patch,
      reason: "地方官调发赋役",
      narrative: `你按里甲派夫役，令各乡限日出人出车。工程与公差得以前推，县库压力也稍缓，但役重之家已在门外低声抱怨。`,
      events: [`${player.name}调发${countyName}赋役，政务推进而民间承压。`]
    });
  }

  const patch = {
    player: {
      localOrder: shiftStat(player.localOrder, 1),
      influence: shiftStat(player.influence, 1),
      mentality: shiftStat(player.mentality, 1)
    }
  };

  return makeResult({
    worldState,
    player,
    patch,
    reason: "地方官坐堂视事",
    narrative: `你将“${text}”记入县署日簿，先问县丞旧例，再召书吏备卷。此事暂未惊动全县，却让你更熟悉${countyName}的公门脉络。`,
    events: [`${player.name}在${countyName}坐堂视事：${text.slice(0, 30)}`]
  });
}

async function runTurn(worldState, input) {
  const player = worldState.player;
  let result;

  if (player.role === "scholar") {
    result = buildScholarTurn(input, player);
    return withMockRelationshipReactions(result, worldState);
  }

  if (player.role === "emperor") {
    result = buildEmperorTurn(input, worldState);
    return withMockRelationshipReactions(result, worldState);
  }

  if (player.role === "minister") {
    result = buildMinisterTurn(input, worldState);
    return withMockRelationshipReactions(result, worldState);
  }

  if (player.role === "official") {
    result = buildOfficialTurn(input, worldState);
    return withMockRelationshipReactions(result, worldState);
  }

  if (player.role === "general") {
    result = buildGeneralTurn(input, worldState);
    return withMockRelationshipReactions(result, worldState);
  }

  if (player.role === "magistrate") {
    result = buildMagistrateTurn(input, worldState);
    return withMockRelationshipReactions(result, worldState);
  }

  const patch = { player: {} };
  const mentGain = Math.random() > 0.5 ? 1 : 0;
  if (mentGain) patch.player.mentality = player.mentality + mentGain;

  result = {
    narrative: `你下达了指令：“${input.trim()}”。幕僚们领命而去，数日后传来回音。事态正在缓慢推进。`,
    statePatch: patch,
    attributeChanges: buildAttributeChanges(player, patch),
    relationshipChanges: [],
    events: [`${player.name}下达指令：${input.trim().slice(0, 30)}`],
    examTrigger: { shouldStart: false, level: null, reason: "" }
  };
  return withMockRelationshipReactions(result, worldState);
}

const QUESTION_BANK = {
  child_exam: [
    "《论语》有言：“学而时习之，不亦说乎。”试论为学之本，在勤习还是在明理。",
    "孟子论养气，首重志向。试述士子读书立志之义。",
    "《大学》言修身齐家。试以一县士风为例，申论修身何以及于乡里。"
  ],
  provincial_exam: [
    "岁歉之后，民多负租。请论减赋、赈粜与劝农三策何者先行。",
    "边饷日急而府库不丰，试陈筹饷安民之策。",
    "地方书院兴废关乎士风。请论官府应如何奖学而不扰民。"
  ],
  metropolitan_exam: [
    "以“君子务本，本立而道生”为题，按制艺章法成篇。",
    "以“民惟邦本，本固邦宁”为题，作八股一篇。",
    "以“礼之用，和为贵”为题，申明经义并及治道。"
  ],
  palace_exam: [
    "朕闻治天下者，贵在安民而不废法。今财赋、边防、吏治三者交迫，诸生各陈所见。",
    "国家承平既久，积弊渐生。若欲清吏治、宽民力、修武备，宜先何务？",
    "朝廷用人，或重资望，或重才干。试论取士与任官之道。"
  ]
};

async function generateExamQuestion(worldState, exam) {
  const player = worldState.player;
  const bank = QUESTION_BANK[exam.level] || QUESTION_BANK.child_exam;
  const question = pickRandom(bank);
  const studied = (player.studiedBooks || []).slice(-2).join("、");
  const studyNote = studied ? `近来所读${studied}，可择其义理佐证。` : "可援引四书五经义理，不必拘泥一章。";

  return {
    level: exam.level,
    examName: exam.name,
    examQuestion: [
      `${worldState.dynasty}${worldState.year}年${exam.name}题：${question}`,
      studyNote
    ].join("\n"),
    questionType: exam.questionType,
    difficulty: exam.difficulty,
    requirements: getExamRequirements(exam),
    wordCount: exam.wordCount,
    passScore: exam.passScore,
    promotionRank: exam.promotionRank
  };
}

function countHits(essay, terms) {
  return terms.filter((term) => essay.includes(term)).length;
}

function gradeDimension(rawScore, comment) {
  return {
    score: Math.max(0, Math.min(100, Math.round(rawScore))),
    comment
  };
}

async function gradeExamEssay(worldState, exam, essay, authenticityCheck) {
  const player = worldState.player;
  const characterCount = countEssayCharacters(essay);
  const classicalTerms = ["夫", "盖", "故", "是以", "仁", "义", "礼", "法", "民", "君", "臣", "赋", "吏", "经", "道"];
  const structureTerms = ["一曰", "二曰", "三曰", "窃以为", "臣闻", "谨按", "综上", "由是观之"];
  const classicalHit = countHits(essay, classicalTerms);
  const structureHit = countHits(essay, structureTerms);
  const lengthTarget = Math.min(1.15, characterCount / Math.max(1, exam.wordCount.min));
  const lengthScore = 46 + lengthTarget * 28 - Math.max(0, characterCount - exam.wordCount.max) / 80;
  const foundation = (
    (player.academia || 0) * 0.32 +
    (player.literaryTalent || 0) * 0.28 +
    (player.adaptability || 0) * 0.18 +
    (player.mentality || 0) * 0.14 +
    (player.reputation || 0) * 0.08
  );
  const readinessBonus = worldState.activeExam?.readiness?.ready ? 4 : 0;
  const difficultyPenalty = {
    child_exam: 0,
    provincial_exam: 4,
    metropolitan_exam: 7,
    palace_exam: 5
  }[exam.level] || 0;

  const base = lengthScore + foundation * 0.42 + classicalHit * 1.2 + structureHit * 2 + readinessBonus - difficultyPenalty;
  const historicalPenalty = authenticityCheck.anachronism_detection?.has_anachronism ? 10 : 0;

  const score = {
    content_quality: gradeDimension(
      base + (player.academia || 0) * 0.18,
      "义理能扣住题旨，若能多引经义与时务例证，则更见根柢。"
    ),
    argument_strength: gradeDimension(
      base + (player.adaptability || 0) * 0.18 + structureHit * 2,
      "立论已有开合，层次越明，策论气象越稳。"
    ),
    literary_style: gradeDimension(
      base + (player.literaryTalent || 0) * 0.22 + classicalHit * 1.4,
      "文气尚称雅正，句法可再收束，使辞采不掩义理。"
    ),
    classical_format: gradeDimension(
      base + structureHit * 3,
      "格式大体可读，破题、承转与结语仍可更谨严。"
    ),
    historical_appropriateness: gradeDimension(
      base - historicalPenalty,
      historicalPenalty ? "夹有不合时宜词语，监试会据此扣分。" : "语境基本合乎时代，不见明显穿凿。"
    )
  };

  const overall = Math.round((
    score.content_quality.score * 0.25 +
    score.argument_strength.score * 0.2 +
    score.literary_style.score * 0.2 +
    score.classical_format.score * 0.18 +
    score.historical_appropriateness.score * 0.17
  ));

  return {
    score: {
      ...score,
      overall_score: overall,
      rank: scoreToRank(overall, exam),
      detailed_feedback: `本文约${characterCount}字，${exam.questionType}体式已具雏形。宜继续补足经义依据、收紧段落层次，并少用浮泛套语。`
    },
    authenticity_check: authenticityCheck,
    virtual_candidates: [],
    ranking: []
  };
}

module.exports = {
  startGame,
  runTurn,
  generateExamQuestion,
  gradeExamEssay
};
