const { getExamRequirements, getNextExamLevel } = require("../../game/exams");

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

function buildAttributeChanges(beforePlayer, patch) {
  const attributeChanges = [];
  const labels = {
    health: "体力",
    gold: "银钱",
    academia: "学识",
    literaryTalent: "文采",
    adaptability: "机辩",
    mentality: "心性",
    reputation: "声望"
  };

  for (const [key, after] of Object.entries(patch.player || {})) {
    const before = beforePlayer[key];
    if (typeof after === "number" && typeof before === "number" && after !== before) {
      attributeChanges.push({
        path: `player.${key}`,
        label: labels[key] || key,
        before,
        after,
        reason: "书生日常行动"
      });
    }
  }

  return attributeChanges;
}

function makeResult({ narrative, patch, events, player, examTrigger }) {
  return {
    narrative,
    statePatch: patch,
    attributeChanges: buildAttributeChanges(player, patch),
    events,
    examTrigger: examTrigger || { shouldStart: false, level: null, reason: "" }
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

async function runTurn(worldState, input) {
  const player = worldState.player;

  if (player.role === "scholar") {
    return buildScholarTurn(input, player);
  }

  // Generic fallback for other roles until their dedicated loops are implemented.
  const patch = { player: {} };
  const mentGain = Math.random() > 0.5 ? 1 : 0;
  if (mentGain) patch.player.mentality = player.mentality + mentGain;

  return {
    narrative: `你下达了指令：“${input.trim()}”。幕僚们领命而去，数日后传来回音。事态正在缓慢推进。`,
    statePatch: patch,
    attributeChanges: buildAttributeChanges(player, patch),
    events: [`${player.name}下达指令：${input.trim().slice(0, 30)}`],
    examTrigger: { shouldStart: false, level: null, reason: "" }
  };
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

module.exports = {
  startGame,
  runTurn,
  generateExamQuestion
};
