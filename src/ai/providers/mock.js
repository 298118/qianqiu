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
      "你可以先研读经典、拜访塾师、游学结交，也可直接请求赴考。"
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

function buildScholarTurn(input, player) {
  const text = input.trim();
  const lower = text;
  const patch = { player: {} };
  const events = [];
  let narrative = "";
  let examTrigger = { shouldStart: false, level: null, reason: "" };

  // --- Study / reading actions ---
  if (/研读|读书|阅读|翻阅|诵读|学习|苦读|钻研|攻读/.test(lower)) {
    const academiaGain = 1 + Math.floor(Math.random() * 3);
    const litGain = Math.random() > 0.5 ? 1 : 0;
    patch.player.academia = player.academia + academiaGain;
    if (litGain) patch.player.literaryTalent = player.literaryTalent + litGain;
    const book = lower.match(/《[^》]+》/) ? lower.match(/《[^》]+》/)[0] : "经义典籍";
    narrative = pickRandom([
      `你闭门${book ? "研读" + book : "苦读"}数日，灯下字句渐明，胸中经义愈发扎实。`,
      `翻开${book}，反复揣摩圣人微言，不知不觉已过三更。学识增长了${academiaGain}点。`,
      `县学老先生见你勤勉，特借你一本珍藏注疏。研读之后，颇有顿悟之感。`
    ]);
    events.push(`${player.name}研读${book}，学识有所精进。`);
  }

  // --- Teacher / visit actions ---
  else if (/拜师|拜访|请教|求教|访师|问学/.test(lower)) {
    const repGain = 1 + Math.floor(Math.random() * 2);
    patch.player.reputation = player.reputation + repGain;
    if (!player.teacher) {
      patch.player.teacher = pickRandom(["顾文衡", "李明远", "周子谦"]);
      narrative = `你备了薄礼前往拜访，先生见你态度诚恳，收你为记名弟子。自此可在门下听讲经义。声望有所提升。`;
    } else {
      narrative = `你前往${player.teacher}处请教。先生点拨了几处关键，你对经义的理解更深了一层。声望增长了${repGain}点。`;
    }
    events.push(`${player.name}拜访师长，虚心请教。`);
  }

  // --- Travel / social actions ---
  else if (/游学|结交|交友|辩论|论辩|清谈|聚会/.test(lower)) {
    const adaptGain = 1 + Math.floor(Math.random() * 2);
    const repGain = 1;
    patch.player.adaptability = player.adaptability + adaptGain;
    patch.player.reputation = player.reputation + repGain;
    narrative = pickRandom([
      "你与几位同窗外出游学，沿途见闻增长了不少见识。辩论之间，临场机辩之能有所提升。",
      "在书院茶会上与人论辩经义，虽然未能尽胜，却也结交了几位志同道合的朋友。",
      "游学途中经过名山大川，胸襟为之一阔。回来后自觉文章气象与往日不同。"
    ]);
    events.push(`${player.name}外出游学，增长见闻。`);
  }

  // --- Money / work actions ---
  else if (/谋生|赚钱|代写|抄书|书信|做工|挣钱|糊口/.test(lower)) {
    const goldGain = 2 + Math.floor(Math.random() * 4);
    patch.player.gold = player.gold + goldGain;
    narrative = pickRandom([
      `你为乡邻代写了几封书信，得了${goldGain}文钱，虽不多，却也能补贴些纸墨。`,
      `在书铺帮人抄写经卷，日复一日虽枯燥，倒也温故知新。赚了${goldGain}文。`,
      `替乡绅写了一篇寿序，主人家颇为满意，厚赠了${goldGain}文钱。`
    ]);
    events.push(`${player.name}代写文章谋生，赚得${goldGain}文。`);
  }

  // --- Exam trigger ---
  else if (/考试|赴考|童试|乡试|会试|殿试|参加考试|应试|赶考/.test(lower)) {
    const currentRank = player.examRank;
    let targetLevel = "child_exam";
    if (currentRank === null) targetLevel = "child_exam";
    else if (currentRank === "秀才") targetLevel = "provincial_exam";
    else if (currentRank === "举人") targetLevel = "metropolitan_exam";
    else if (currentRank === "贡士") targetLevel = "palace_exam";
    else {
      narrative = "你已是进士出身，不必再参加科举了。可以考虑入仕为官。";
      return { narrative, statePatch: patch, attributeChanges: [], events, examTrigger: { shouldStart: false, level: null, reason: "" } };
    }

    examTrigger = { shouldStart: true, level: targetLevel, reason: "玩家主动请求赴考" };
    narrative = `你收拾行装，准备前往考场。考期将近，心中既紧张又期待。`;
    events.push(`${player.name}决定赴考。`);
  }

  // --- Rest / default ---
  else {
    const mentGain = Math.random() > 0.5 ? 1 : 0;
    if (mentGain) patch.player.mentality = player.mentality + mentGain;
    narrative = pickRandom([
      `你在县学中静坐半日，整理思绪。窗外鸟鸣声声，心绪渐宁。${mentGain ? "心性有所提升。" : ""}`,
      `信步走到河边，看渔人撒网。回来后铺纸研墨，写了一篇短文自娱。`,
      `今日无特别之事。你在书房中翻了翻旧日文章，觉得彼时文笔稚嫩，如今略有所进。`
    ]);
    events.push(`${player.name}日常度日。`);
  }

  // Build attributeChanges
  const attributeChanges = [];
  for (const [key, value] of Object.entries(patch.player)) {
    if (typeof value === "number" && typeof player[key] === "number" && value !== player[key]) {
      attributeChanges.push({
        path: `player.${key}`,
        before: player[key],
        after: value,
        reason: "行动结果"
      });
    }
  }

  return { narrative, statePatch: patch, attributeChanges, events, examTrigger };
}

async function runTurn(worldState, input) {
  const player = worldState.player;

  if (player.role === "scholar") {
    return buildScholarTurn(input, player);
  }

  // Generic fallback for other roles
  const patch = { player: {} };
  const mentGain = Math.random() > 0.5 ? 1 : 0;
  if (mentGain) patch.player.mentality = player.mentality + mentGain;

  return {
    narrative: `你下达了指令："${input.trim()}"。幕僚们领命而去，数日后传来回音。事态在缓慢推进中。`,
    statePatch: patch,
    attributeChanges: [],
    events: [`${player.name}下达指令：${input.trim().slice(0, 30)}`],
    examTrigger: { shouldStart: false, level: null, reason: "" }
  };
}

module.exports = {
  startGame,
  runTurn
};
