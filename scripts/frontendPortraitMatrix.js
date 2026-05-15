const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const repoRoot = path.join(__dirname, "..");
const outputPath = path.join(repoRoot, "public", "assets", "ui", "portraits", "portrait-pool-matrix-v1.json");
const matrixDocPath = path.join(repoRoot, "docs", "FRONTEND_PORTRAIT_MATRIX.md");

const fallbackRef = "fallback-role-silhouette-v1";

const safeArea = {
  desktop: { x: 0.22, y: 0.08, width: 0.56, height: 0.82 },
  mobile: { x: 0.28, y: 0.08, width: 0.44, height: 0.78 },
  thumbnail: { x: 0.32, y: 0.1, width: 0.36, height: 0.42 }
};

const focalPoint = { x: 0.5, y: 0.28 };

const safetyText =
  "角色必须是明确成年人，气质端庄、历史人物立绘风格；不做幼态脸、儿童或少年化身体比例，不做挑逗姿态、裸露、透视衣料或性暗示；画面不得出现现代物品、现代发型妆容、摄影棚感、logo、水印、签名、二维码、可读文字、伪汉字、乱码字、文件路径、API key、raw/hidden/prompt 泄漏性内容。";

const promptTemplates = [
  {
    id: "portrait-prompt-scholar-calm-v1",
    mood: "寒窗清气",
    draft:
      "成年书生立于泛黄宣纸前，青衫素净，袖中露出书卷一角，神情清朗而克制，像刚从长夜读书中抬眼；水墨淡彩，线条温润，半身立绘，背景极淡，不出现文字。"
  },
  {
    id: "portrait-prompt-female-scholar-v1",
    mood: "端雅锋芒",
    draft:
      "成年女书生着月白襦裙与深青披帛，腰封收束，手持未题字的卷轴，眉目沉静，有读书人的锋芒也有端庄气度；宣纸肌理、水墨晕染、半身正侧构图。"
  },
  {
    id: "portrait-prompt-jinshi-ceremony-v1",
    mood: "春榜初荣",
    draft:
      "新科进士身着红袍礼服，簪花但不过分华丽，神情有喜色也有敬畏，身后只见淡淡榜墙与春风墨痕；高颜值、成年、端正，古代中国官服氛围，无可读文字。"
  },
  {
    id: "portrait-prompt-magistrate-night-v1",
    mood: "案牍灯影",
    draft:
      "县令夜坐案前，乌纱与青绿官袍压住疲惫，手边是无字案卷和朱印，目光谨慎，像刚听完一桩难案；暖黄灯影、宣纸底、水墨人物立绘，半身，庄重不阴森。"
  },
  {
    id: "portrait-prompt-examiner-law-v1",
    mood: "科场法度",
    draft:
      "年长主考官端坐阅卷，须发整洁，目光严厉而不刻薄，手持朱笔但卷面空白不可读；构图留出上方纸雾，色调沉稳，体现科场法度与文脉威仪。"
  },
  {
    id: "portrait-prompt-female-official-v1",
    mood: "女官权柄",
    draft:
      "成年女官身着深绛与墨青层叠官服，腰封、玉佩、宽袖形成清晰轮廓，姿态肃立，手持笏板，目光平静而有权柄；水墨淡彩，端庄成熟，不露骨，不幼态。"
  },
  {
    id: "portrait-prompt-border-general-v1",
    mood: "边塞风霜",
    draft:
      "边关将领披暗红披风与旧甲，手按佩剑，肩背挺直，脸上有风霜，不夸张战斗姿势；背景是淡墨军帐与风沙纸纹，半身立绘，历史感强，无现代军械。"
  },
  {
    id: "portrait-prompt-palace-noble-v1",
    mood: "宫禁含蓄",
    draft:
      "宫廷贵人立于屏风前，衣料层次细密，金色只作微光点缀，神情含蓄难测，既有礼制约束也有政治重量；宣纸、水墨、淡彩，不出现龙凤文字纹样，不做艳俗姿态。"
  },
  {
    id: "portrait-prompt-merchant-street-v1",
    mood: "市井精明",
    draft:
      "市井商贾着深褐长衫与短外袍，手中把玩算盘或账册但无字，笑意谨慎，像懂得风向的人；人物亲和但不滑稽，纸色背景，墨线清楚，适合 NPC 头像池。"
  },
  {
    id: "portrait-prompt-censor-court-v1",
    mood: "清流直谏",
    draft:
      "清流御史身形瘦削，持笏拱手，衣冠整肃，眼神锋利，像要在朝堂上直言进谏；冷灰宣纸底，一点朱砂印痕作气氛，不出现可读奏疏文字。"
  },
  {
    id: "portrait-prompt-adviser-study-v1",
    mood: "幕府机心",
    draft:
      "幕友师爷侧身坐在书斋边，手握折扇或笔杆，衣着不显官阶但干净精明，神情温和里带盘算；淡墨书斋背景，半身立绘，留白多，适合对话面板。"
  },
  {
    id: "portrait-prompt-emperor-private-v1",
    mood: "御案倦威",
    draft:
      "皇帝常服立绘，不做神化大场面，玄色与明黄克制搭配，目光疲惫而有威压，身后只是模糊御案与纸色屏风；成年、端庄、历史模拟游戏风格，无文字、水印或现代元素。"
  }
];

const playerStages = [
  ["scholar", "书生", "student", "portrait-prompt-scholar-calm-v1", "green_gray"],
  ["child-exam-candidate", "童试考生", "child_exam_candidate", "portrait-prompt-scholar-calm-v1", "warm_paper"],
  ["xiucai", "秀才", "xiucai", "portrait-prompt-scholar-calm-v1", "bamboo_green"],
  ["juren", "举人", "juren", "portrait-prompt-jinshi-ceremony-v1", "warm_paper"],
  ["gongshi", "贡士", "gongshi", "portrait-prompt-jinshi-ceremony-v1", "apricot_gold"],
  ["jinshi", "进士", "jinshi", "portrait-prompt-jinshi-ceremony-v1", "ceremony_red"],
  ["junior-official", "初任官员", "junior_official", "portrait-prompt-magistrate-night-v1", "blue_green"],
  ["local-official", "地方官", "local_official", "portrait-prompt-magistrate-night-v1", "lamp_warm"],
  ["capital-official", "京官", "capital_official", "portrait-prompt-censor-court-v1", "court_gray"],
  ["grand-minister", "大臣", "grand_minister", "portrait-prompt-censor-court-v1", "ink_gold"],
  ["general", "将领", "general", "portrait-prompt-border-general-v1", "ochre_red"],
  ["emperor-regent", "皇帝/摄政", "emperor_regent", "portrait-prompt-emperor-private-v1", "ink_gold"]
];

const playerVariants = [
  ["m01", "masculine", "adult_young", "baseline", "neutral", "执卷肃立"],
  ["m02", "masculine", "adult_young", "formal", "focused", "拱手正身"],
  ["m03", "masculine", "adult_middle", "travel_or_duty", "determined", "侧身回望"],
  ["f01", "feminine", "adult_young", "baseline", "neutral", "执卷肃立"],
  ["f02", "feminine", "adult_young", "formal", "focused", "垂袖正立"],
  ["f03", "feminine", "adult_middle", "travel_or_duty", "determined", "三分侧身"]
];

const genericRoles = [
  ["teacher", "老师", "education", "portrait-prompt-examiner-law-v1"],
  ["exam-peer", "同年", "exam_network", "portrait-prompt-scholar-calm-v1"],
  ["room-examiner", "房官", "examiner", "portrait-prompt-examiner-law-v1"],
  ["chief-examiner", "主考官", "examiner", "portrait-prompt-examiner-law-v1"],
  ["magistrate", "县令", "local_government", "portrait-prompt-magistrate-night-v1"],
  ["county-deputy", "县丞", "local_government", "portrait-prompt-magistrate-night-v1"],
  ["registrar", "主簿", "local_government", "portrait-prompt-adviser-study-v1"],
  ["clerk", "胥吏", "local_government", "portrait-prompt-adviser-study-v1"],
  ["constable", "捕快", "judicial", "portrait-prompt-magistrate-night-v1"],
  ["adviser", "幕友", "adviser", "portrait-prompt-adviser-study-v1"],
  ["gentry", "士绅", "local_society", "portrait-prompt-scholar-calm-v1"],
  ["merchant", "商贾", "market", "portrait-prompt-merchant-street-v1"],
  ["physician", "医者", "commoner_specialist", "portrait-prompt-merchant-street-v1"],
  ["monk-daoist", "僧道", "religious", "portrait-prompt-scholar-calm-v1"],
  ["courier", "驿卒", "travel", "portrait-prompt-merchant-street-v1"],
  ["junior-officer", "军校", "military", "portrait-prompt-border-general-v1"],
  ["border-commander", "边将", "military", "portrait-prompt-border-general-v1"],
  ["palace-attendant", "宫人", "palace", "portrait-prompt-palace-noble-v1"],
  ["eunuch", "内侍", "palace", "portrait-prompt-palace-noble-v1"],
  ["female-official", "女官", "court", "portrait-prompt-female-official-v1"],
  ["commoner", "市井人物", "street", "portrait-prompt-merchant-street-v1"],
  ["family-elder", "家眷长辈", "family", "portrait-prompt-palace-noble-v1"],
  ["retainer", "门客", "retainer", "portrait-prompt-adviser-study-v1"],
  ["censor", "御史", "court", "portrait-prompt-censor-court-v1"]
];

const genericVariants = [
  ["m01", "masculine", "adult_young", "baseline", "neutral", "拱手"],
  ["m02", "masculine", "adult_middle", "working", "focused", "执笔"],
  ["f01", "feminine", "adult_young", "baseline", "neutral", "垂袖"],
  ["f02", "feminine", "adult_middle", "working", "thoughtful", "侧身"],
  ["elder01", "mixed", "adult_elder", "elder", "reserved", "扶案"]
];

const signatureRoles = [
  ["emperor", "皇帝", "imperial", "portrait-prompt-emperor-private-v1"],
  ["empress-dowager", "太后", "imperial", "portrait-prompt-palace-noble-v1"],
  ["empress", "皇后", "imperial", "portrait-prompt-palace-noble-v1"],
  ["regent", "摄政", "imperial", "portrait-prompt-emperor-private-v1"],
  ["grand-secretary", "首辅", "court", "portrait-prompt-censor-court-v1"],
  ["grand-marshal", "大司马", "military", "portrait-prompt-border-general-v1"],
  ["minister-of-rites", "礼部重臣", "court", "portrait-prompt-examiner-law-v1"],
  ["minister-of-war", "兵部重臣", "military", "portrait-prompt-border-general-v1"],
  ["chief-censor", "都御史", "court", "portrait-prompt-censor-court-v1"],
  ["governor-general", "总督", "regional_power", "portrait-prompt-magistrate-night-v1"],
  ["famous-general", "名将", "military", "portrait-prompt-border-general-v1"],
  ["famous-minister", "名臣", "court", "portrait-prompt-censor-court-v1"],
  ["qingliu-leader", "清流领袖", "faction", "portrait-prompt-censor-court-v1"],
  ["powerful-eunuch", "权宦", "palace", "portrait-prompt-palace-noble-v1"],
  ["powerful-minister", "权臣", "faction", "portrait-prompt-censor-court-v1"],
  ["grand-merchant", "豪商", "market", "portrait-prompt-merchant-street-v1"],
  ["local-clan-head", "地方望族", "local_society", "portrait-prompt-scholar-calm-v1"],
  ["renowned-teacher", "名师", "education", "portrait-prompt-examiner-law-v1"],
  ["renowned-examiner", "名主考", "examiner", "portrait-prompt-examiner-law-v1"],
  ["rival", "宿敌", "rival", "portrait-prompt-censor-court-v1"],
  ["confidant", "知己", "relationship", "portrait-prompt-scholar-calm-v1"],
  ["beloved-confidant", "红颜/蓝颜知交", "relationship", "portrait-prompt-palace-noble-v1"],
  ["palace-strategist", "宫廷谋主", "palace", "portrait-prompt-adviser-study-v1"],
  ["frontier-envoy", "边地使者", "diplomacy", "portrait-prompt-border-general-v1"]
];

const signatureVariants = [
  ["normal", "baseline", "neutral", "肃立"],
  ["court", "formal", "decisive", "持笏"],
  ["private", "private_scene", "weary", "案前侧身"]
];

const statePostures = [
  ["thinking", "沉思", "thoughtful", "袖手沉思"],
  ["salute", "拱手", "respectful", "拱手"],
  ["holding-scroll", "执卷", "focused", "执卷"],
  ["reviewing-paper", "阅卷", "stern_clear", "朱笔停顿"],
  ["holding-tablet", "持笏", "formal", "持笏"],
  ["writing", "执笔", "focused", "执笔"],
  ["hand-on-sword", "按剑", "determined", "按剑"],
  ["tired", "疲惫", "weary", "扶案"],
  ["ill", "病中", "fragile", "披衣端坐"],
  ["standing", "肃立", "neutral", "垂袖肃立"],
  ["anger", "含怒", "restrained_anger", "侧身凝视"],
  ["smile", "微笑", "gentle", "含笑"],
  ["surprised", "惊疑", "alert", "回望"],
  ["decision", "决断", "decisive", "正身"],
  ["trial", "受审", "anxious", "低首"],
  ["apology", "请罪", "remorseful", "拱手俯身"]
];

const stateFamilies = [
  ["scholar", "education", "portrait-prompt-scholar-calm-v1", "green_gray"],
  ["official", "government", "portrait-prompt-magistrate-night-v1", "court_gray"],
  ["military", "military", "portrait-prompt-border-general-v1", "ochre_red"]
];

const sceneAnchors = [
  ["exam-writing", "科举答卷", "exam_page", "portrait-prompt-scholar-calm-v1"],
  ["exam-list-meeting", "放榜相逢", "exam_list_page", "portrait-prompt-jinshi-ceremony-v1"],
  ["county-trial", "县衙问案", "judicial_page", "portrait-prompt-magistrate-night-v1"],
  ["court-memorial", "朝议陈奏", "court_page", "portrait-prompt-censor-court-v1"],
  ["war-council", "军帐筹谋", "military_page", "portrait-prompt-border-general-v1"],
  ["night-study", "书斋夜读", "study_page", "portrait-prompt-scholar-calm-v1"],
  ["market-talk", "街市交涉", "market_page", "portrait-prompt-merchant-street-v1"],
  ["palace-summons", "宫廷召见", "palace_page", "portrait-prompt-palace-noble-v1"]
];

const sceneVariants = [
  ["lead", "baseline", "neutral", "三分正面"],
  ["tension", "conflict", "alert", "侧身"],
  ["resolution", "resolved", "calm", "低头或抬眼"]
];

function slugText(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeRef(group, role, variant) {
  return `portrait-s73-10-${group}-${slugText(role)}-${slugText(variant)}-v1`;
}

function makePaths(ref) {
  return {
    plannedPath: `/assets/ui/portraits/s73-10/${ref}.webp`,
    thumbnailPath: `/assets/ui/thumbs/thumb-${ref}.webp`,
    lowResPlaceholderPath: `/assets/ui/portraits/placeholders/placeholder-${ref}.webp`
  };
}

function makeEntry({
  group,
  productionStep,
  usage,
  role,
  roleLabel,
  roleStage,
  genderPresentation,
  ageBand,
  statusVariant,
  emotionVariant,
  posture,
  sceneUsage,
  promptTemplateRef,
  colorTemperature,
  note,
  variant
}) {
  const portraitRef = makeRef(group, role, variant);
  return {
    portraitRef,
    matrixGroup: group,
    phase: "S73.10.1",
    productionStep,
    usage,
    role,
    roleLabel,
    roleStage,
    genderPresentation,
    ageBand,
    statusVariant,
    emotionVariant,
    posture,
    sceneUsage,
    promptTemplateRef,
    colorTemperature,
    fallbackRef,
    reviewStatus: "planned",
    visualReviewStatus: "pending_codex_review",
    safetyReviewStatus: "pending_codex_review",
    runtimeUsable: false,
    lazyLoadGroup: `portrait_pool_${group}_s73_10`,
    safeArea,
    focalPoint,
    ...makePaths(portraitRef),
    note
  };
}

function buildPlayerEntries() {
  return playerStages.flatMap(([stage, label, roleStage, template, color]) =>
    playerVariants.map(([variant, genderPresentation, ageBand, statusVariant, emotionVariant, posture]) =>
      makeEntry({
        group: "player",
        productionStep: "S73.10.2",
        usage: ["player_identity", "game_main", "people_page"],
        role: stage,
        roleLabel: label,
        roleStage,
        genderPresentation,
        ageBand,
        statusVariant,
        emotionVariant,
        posture,
        sceneUsage: ["home_continue", "game_main", "identity_panel"],
        promptTemplateRef: genderPresentation === "feminine" && stage.includes("scholar")
          ? "portrait-prompt-female-scholar-v1"
          : template,
        colorTemperature: color,
        note: `${label}玩家候选，表现身份成长而不是只更换帽冠。`,
        variant
      })
    )
  );
}

function buildGenericEntries() {
  return genericRoles.flatMap(([role, label, stage, template]) =>
    genericVariants.map(([variant, genderPresentation, ageBand, statusVariant, emotionVariant, posture]) =>
      makeEntry({
        group: "generic_npc",
        productionStep: "S73.10.3",
        usage: ["npc_pool", "people_page", "game_main"],
        role,
        roleLabel: label,
        roleStage: stage,
        genderPresentation,
        ageBand,
        statusVariant,
        emotionVariant,
        posture,
        sceneUsage: ["dialogue_panel", "people_page"],
        promptTemplateRef: role === "female-official" ? "portrait-prompt-female-official-v1" : template,
        colorTemperature: stage === "military" ? "ochre_red" : stage === "palace" ? "ink_gold" : "warm_paper",
        note: `${label}通用 NPC 池，不绑定 hidden 私档或未公开剧情事实。`,
        variant
      })
    )
  );
}

function buildSignatureEntries() {
  return signatureRoles.flatMap(([role, label, stage, template]) =>
    signatureVariants.map(([variant, statusVariant, emotionVariant, posture]) =>
      makeEntry({
        group: "signature_npc",
        productionStep: "S73.10.4",
        usage: ["signature_npc", "people_page", "court_or_story_scene"],
        role,
        roleLabel: label,
        roleStage: stage,
        genderPresentation: ["empress-dowager", "empress", "beloved-confidant"].includes(role) ? "feminine" : "mixed",
        ageBand: role === "empress-dowager" ? "adult_elder" : "adult_middle",
        statusVariant,
        emotionVariant,
        posture,
        sceneUsage: ["court_page", "people_page", "story_anchor"],
        promptTemplateRef: template,
        colorTemperature: stage === "military" ? "ochre_red" : stage === "imperial" || stage === "palace" ? "ink_gold" : "court_gray",
        note: `${label}专属或拟史关键人物模板，不混入通用头像池；公开前只暴露安全 portraitRef。`,
        variant
      })
    )
  );
}

function buildStateEntries() {
  return statePostures.flatMap(([state, label, emotionVariant, posture]) =>
    stateFamilies.map(([family, stage, template, color]) =>
      makeEntry({
        group: "state_variant",
        productionStep: "S73.10.5",
        usage: ["emotion_or_state_variant", "dialogue_panel", "exam_or_court_scene"],
        role: `${family}-${state}`,
        roleLabel: `${label}-${family}`,
        roleStage: stage,
        genderPresentation: "mixed",
        ageBand: "adult_middle",
        statusVariant: state,
        emotionVariant,
        posture,
        sceneUsage: ["dialogue_panel", "scene_surface"],
        promptTemplateRef: template,
        colorTemperature: color,
        note: `${label}状态姿态池，可复用到高频角色，普通 NPC 仍以常态 fallback 为主。`,
        variant: family
      })
    )
  );
}

function buildSceneEntries() {
  return sceneAnchors.flatMap(([scene, label, page, template]) =>
    sceneVariants.map(([variant, statusVariant, emotionVariant, posture]) =>
      makeEntry({
        group: "scene_anchor",
        productionStep: "S73.10.5",
        usage: ["scene_anchor", page, "story_surface"],
        role: scene,
        roleLabel: label,
        roleStage: page,
        genderPresentation: "mixed",
        ageBand: "adult_middle",
        statusVariant,
        emotionVariant,
        posture,
        sceneUsage: [page, "story_surface"],
        promptTemplateRef: template,
        colorTemperature: page.includes("military") ? "ochre_red" : page.includes("palace") ? "ink_gold" : "warm_paper",
        note: `${label}场景锚点立绘，给 S76 页面提供人物情绪焦点。`,
        variant
      })
    )
  );
}

function buildMatrix() {
  const entries = [
    ...buildPlayerEntries(),
    ...buildGenericEntries(),
    ...buildSignatureEntries(),
    ...buildStateEntries(),
    ...buildSceneEntries()
  ];
  const counts = entries.reduce((acc, entry) => {
    acc[entry.matrixGroup] = (acc[entry.matrixGroup] || 0) + 1;
    return acc;
  }, {});
  const promptTemplateIds = new Set(promptTemplates.map((template) => template.id));
  return {
    schemaVersion: 1,
    phase: "S73.10.1",
    status: "matrix_locked",
    generatedAt: "2026-05-15",
    targetCount: entries.length,
    generationTool: "scripts/frontendPortraitMatrix.js",
    matrixDocRef: "docs/FRONTEND_PORTRAIT_MATRIX.md",
    manifestRef: "public/assets/ui/ink-ui-manifest.json",
    baselineQaRef: "public/assets/ui/portraits/portrait-baseline-qa-v1.json",
    fallbackRef,
    reviewPolicy: {
      generatedImagesRequireCodexVisualReview: true,
      usableOnlyAfterManifestEntry: true,
      runtimeUsableBeforeImageGeneration: false,
      importantNpcMustNotUseGenericPortrait: true,
      hiddenProfileLeakageAllowed: false,
      noFullPoolEagerLoad: true
    },
    countPlan: {
      player: counts.player,
      generic_npc: counts.generic_npc,
      signature_npc: counts.signature_npc,
      state_variant: counts.state_variant,
      scene_anchor: counts.scene_anchor
    },
    promptTemplates,
    safetyText,
    fatigueControls: [
      "服饰按身份拆材质：书生棉麻青衫，官员补服/常服/朝服，武将旧甲与披风，商贾暗纹长衫，宫廷人物层叠礼服。",
      "姿态轮换拱手、执卷、持笏、侧身回望、按剑、扶案、垂袖肃立、执笔停顿、袖手沉思。",
      "道具少而准：书卷、笏板、朱笔、无字案卷、折扇、算盘、佩剑、玉佩、药箱、印匣、灯盏。",
      "色温按场景分组：书生青灰，科举暖纸黄，朝堂冷灰朱砂，军务赭红烟灰，宫廷墨金，市井茶褐。"
    ],
    entries,
    promptTemplateCoverage: entries.reduce((acc, entry) => {
      if (!promptTemplateIds.has(entry.promptTemplateRef)) {
        acc.missing.push(entry.portraitRef);
      }
      acc.used[entry.promptTemplateRef] = (acc.used[entry.promptTemplateRef] || 0) + 1;
      return acc;
    }, { used: {}, missing: [] })
  };
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function validateMatrix(matrix) {
  const failures = [];
  const refs = new Set();
  const paths = new Set();
  const promptTemplateIds = new Set(matrix.promptTemplates.map((template) => template.id));

  if (matrix.schemaVersion !== 1) failures.push("schemaVersion must be 1");
  if (matrix.phase !== "S73.10.1") failures.push("phase must be S73.10.1");
  if (matrix.targetCount !== 336) failures.push(`targetCount must be 336, got ${matrix.targetCount}`);
  for (const [group, expected] of Object.entries({
    player: 72,
    generic_npc: 120,
    signature_npc: 72,
    state_variant: 48,
    scene_anchor: 24
  })) {
    if (matrix.countPlan[group] !== expected) {
      failures.push(`${group} count must be ${expected}, got ${matrix.countPlan[group]}`);
    }
  }

  for (const template of matrix.promptTemplates) {
    if (!template.draft || template.draft.length < 40) failures.push(`${template.id} draft is too thin`);
    if (/width|height|--ar|seed|CFG|negative prompt/i.test(template.draft)) {
      failures.push(`${template.id} reads like an image API parameter block`);
    }
  }

  for (const entry of matrix.entries) {
    if (refs.has(entry.portraitRef)) failures.push(`duplicate portraitRef ${entry.portraitRef}`);
    refs.add(entry.portraitRef);
    for (const assetPath of [entry.plannedPath, entry.thumbnailPath, entry.lowResPlaceholderPath]) {
      if (!assetPath.startsWith("/assets/ui/")) failures.push(`${entry.portraitRef} has unsafe path ${assetPath}`);
      if (/https?:|file:|[A-Za-z]:[\\/]|data:|\.\./.test(assetPath)) failures.push(`${entry.portraitRef} has unsafe path ${assetPath}`);
      if (paths.has(assetPath)) failures.push(`duplicate planned path ${assetPath}`);
      paths.add(assetPath);
    }
    if (entry.reviewStatus !== "planned") failures.push(`${entry.portraitRef} reviewStatus must be planned`);
    if (entry.runtimeUsable !== false) failures.push(`${entry.portraitRef} must not be runtime usable before image generation`);
    if (entry.fallbackRef !== fallbackRef) failures.push(`${entry.portraitRef} fallbackRef mismatch`);
    if (!promptTemplateIds.has(entry.promptTemplateRef)) failures.push(`${entry.portraitRef} missing prompt template`);
    if (!String(entry.ageBand).startsWith("adult")) failures.push(`${entry.portraitRef} ageBand must be adult`);
  }

  if (matrix.promptTemplateCoverage.missing.length > 0) {
    failures.push(`missing prompt template coverage: ${matrix.promptTemplateCoverage.missing.join(", ")}`);
  }
  if (failures.length > 0) {
    throw new Error(`Portrait matrix validation failed:\n- ${failures.join("\n- ")}`);
  }
}

function readCommittedMatrix() {
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Missing portrait matrix: ${path.relative(repoRoot, outputPath)}`);
  }
  return JSON.parse(fs.readFileSync(outputPath, "utf8"));
}

function main() {
  const args = new Set(process.argv.slice(2));
  const matrix = buildMatrix();
  validateMatrix(matrix);
  const text = `${JSON.stringify(matrix, null, 2)}\n`;

  if (args.has("--write")) {
    fs.writeFileSync(outputPath, text);
    console.log(`Wrote ${path.relative(repoRoot, outputPath)} (${matrix.targetCount} planned portraits).`);
    return;
  }

  const committedText = fs.readFileSync(outputPath, "utf8");
  const committed = readCommittedMatrix();
  validateMatrix(committed);
  if (sha256Text(committedText) !== sha256Text(text)) {
    throw new Error("Committed portrait matrix is stale; run node scripts/frontendPortraitMatrix.js --write");
  }
  if (!fs.existsSync(matrixDocPath)) {
    throw new Error(`Missing portrait matrix doc: ${path.relative(repoRoot, matrixDocPath)}`);
  }
  console.log(`S73.10.1 portrait matrix ok: ${committed.targetCount} planned portraits.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildMatrix,
  validateMatrix
};
