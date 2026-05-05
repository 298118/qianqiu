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
      pushCharacterReaction(changes, targets, {
        relationshipDelta: 1,
        resentmentDelta: 0,
        note: "A senior contact hears that the player is learning the rules.",
        reason: "Observation improves the player's bureaucratic reputation."
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
      pushCharacterReaction(changes, targets, {
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
  return "official_default";
}

function classifyRelationshipAction(worldState, result) {
  const patch = result?.statePatch || {};
  const examTrigger = result?.examTrigger || {};
  const role = worldState?.player?.role;

  if (role === "scholar") return classifyScholarRelationshipAction(worldState, patch, examTrigger);
  if (role === "emperor") return classifyEmperorRelationshipAction(worldState, patch);
  if (role === "minister") return classifyMinisterRelationshipAction(worldState, patch);
  if (role === "official") return classifyOfficialRelationshipAction(worldState, patch);
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

  if (/观政|学习|请教|衙门|章程|上官|磨勘/.test(text)) {
    const patch = {
      player: {
        influence: shiftStat(player.influence, 2),
        academia: shiftStat(player.academia, 1),
        adaptability: shiftStat(player.adaptability, 1),
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
        reputation: shiftStat(player.reputation, 2)
      }
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
        integrity: shiftStat(player.integrity, 1)
      }
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
    const patch = {
      player: {
        influence: shiftStat(player.influence, 4),
        integrity: shiftStat(player.integrity, text.includes("请托") ? -2 : -1),
        connections: uniqueAppend(player.connections, ally, 8)
      }
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
        reputation: shiftStat(player.reputation, -3),
        influence: shiftStat(player.influence, 1)
      }
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
