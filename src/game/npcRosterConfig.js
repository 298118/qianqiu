const NPC_ROSTER_SCHEMA_VERSION = "s81.3-npc-roster.v1";

const NPC_TIERS = Object.freeze(["ambient", "active", "signature"]);

const NPC_INTERACTION_ACTIONS = Object.freeze([
  "talk",
  "inquire",
  "trade",
  "gift",
  "delegate",
  "summon",
  "request",
  "debate",
  "duel",
  "courtship",
  "marriage"
]);

const NPC_PRIVATE_SIGNAL_TAGS = Object.freeze([
  "求财",
  "避祸",
  "亲族压力",
  "可能欺瞒",
  "求名",
  "护短",
  "畏上",
  "重义"
]);

const PORTRAIT_POOLS = Object.freeze({
  signature: Object.freeze([
    "portrait-s73-10-signature_npc-emperor-normal-v1",
    "portrait-s73-10-signature_npc-grand-secretary-normal-v1",
    "portrait-s73-10-signature_npc-famous-general-normal-v1",
    "portrait-s73-10-signature_npc-renowned-examiner-normal-v1"
  ]),
  generic: Object.freeze([
    "portrait-s73-10-generic_npc-teacher-m01-v1",
    "portrait-s73-10-generic_npc-exam-peer-m01-v1",
    "portrait-s73-10-generic_npc-county-deputy-m01-v1",
    "portrait-s73-10-generic_npc-registrar-m01-v1",
    "portrait-s73-10-generic_npc-clerk-m01-v1",
    "portrait-s73-10-generic_npc-gentry-m01-v1",
    "portrait-s73-10-generic_npc-merchant-m01-v1"
  ]),
  stateVariant: Object.freeze([
    "portrait-s73-10-state_variant-scholar-thinking-scholar-v1",
    "portrait-s73-10-state_variant-official-thinking-official-v1",
    "portrait-s73-10-state_variant-scholar-salute-scholar-v1",
    "portrait-s73-10-state_variant-official-salute-official-v1"
  ])
});

const NPC_STAGE_FIXTURES = Object.freeze({
  scholar: Object.freeze([
    Object.freeze({
      npcId: "npc:scholar:mentor-gu",
      sourceRef: "fixture:scholar:mentor",
      displayName: "顾文衡",
      tier: "active",
      roleTags: Object.freeze(["teacher", "academy", "mentor"]),
      stageTags: Object.freeze(["scholar", "study", "academy"]),
      publicProfile: Object.freeze({
        title: "乡中塾师",
        origin: "清河县",
        posting: "东桥书塾",
        summary: "治经严谨，常以制艺规矩督促后学。",
        visibleAbilities: Object.freeze(["讲学", "评文", "引荐"])
      }),
      relationship: Object.freeze({
        closeness: 42,
        trust: 64,
        awe: 38,
        hostility: 0,
        favorsOwed: 1,
        labels: Object.freeze(["师承"])
      }),
      inventoryRefs: Object.freeze(["inventory:npc:mentor-gu:satchel"]),
      assetRefs: Object.freeze([]),
      resourceAccountRefs: Object.freeze([]),
      availableInteractions: Object.freeze(["talk", "inquire", "gift", "request", "debate"]),
      socialProfile: Object.freeze({
        adult: true,
        marriageStatus: "married",
        ritualStatus: "teacher_elder",
        publicNote: "师长身份只适合论道请益，不作求爱或议婚对象。"
      }),
      hiddenDossier: Object.freeze({
        motives: Object.freeze(["盼学生中式以振书塾声望"]),
        trueAssets: Object.freeze([]),
        secretRelationships: Object.freeze(["与县学教谕有旧"]),
        unrevealedTasks: Object.freeze(["暗中留意乡试名师门路"])
      }),
      privateSignalTags: Object.freeze(["求名", "重义"])
    }),
    Object.freeze({
      npcId: "npc:scholar:peer-shen",
      sourceRef: "fixture:scholar:peer",
      displayName: "沈砚秋",
      tier: "ambient",
      roleTags: Object.freeze(["exam_peer", "student"]),
      stageTags: Object.freeze(["scholar", "study", "exam"]),
      publicProfile: Object.freeze({
        title: "同窗",
        origin: "邻县",
        posting: "东桥书塾",
        summary: "诗文敏捷，近日也在准备县试。",
        visibleAbilities: Object.freeze(["切磋", "抄录", "打听科场"])
      }),
      relationship: Object.freeze({
        closeness: 18,
        trust: 36,
        awe: 8,
        hostility: 4,
        favorsOwed: 0,
        labels: Object.freeze(["同窗"])
      }),
      inventoryRefs: Object.freeze(["inventory:npc:peer-shen:satchel"]),
      assetRefs: Object.freeze([]),
      resourceAccountRefs: Object.freeze([]),
      availableInteractions: Object.freeze(["talk", "inquire", "gift", "debate", "duel"]),
      socialProfile: Object.freeze({
        adult: true,
        marriageStatus: "unknown",
        ritualStatus: "peer",
        publicNote: "成年同窗，可论道或切磋，婚姻事项仍须礼法与亲族审查。"
      }),
      hiddenDossier: Object.freeze({
        motives: Object.freeze(["想在县试前摸清你的文章路数"]),
        trueAssets: Object.freeze([]),
        secretRelationships: Object.freeze([]),
        unrevealedTasks: Object.freeze([])
      }),
      privateSignalTags: Object.freeze(["求名", "可能欺瞒"])
    }),
    Object.freeze({
      npcId: "npc:scholar:matchmaker-lin",
      sourceRef: "fixture:scholar:matchmaker",
      displayName: "林知微",
      tier: "active",
      roleTags: Object.freeze(["gentry", "matchmaking", "local_elite"]),
      stageTags: Object.freeze(["scholar", "family", "local_society"]),
      publicProfile: Object.freeze({
        title: "士族成年亲眷",
        origin: "清河县",
        posting: "林氏东宅",
        summary: "出入书香门第，常由族中长辈托其探问婚姻与师友门路。",
        visibleAbilities: Object.freeze(["礼法", "引荐", "议婚"])
      }),
      relationship: Object.freeze({
        closeness: 34,
        trust: 52,
        awe: 12,
        hostility: 0,
        favorsOwed: 0,
        labels: Object.freeze(["士族", "媒妁"])
      }),
      inventoryRefs: Object.freeze([]),
      assetRefs: Object.freeze([]),
      resourceAccountRefs: Object.freeze([]),
      availableInteractions: Object.freeze(["talk", "inquire", "gift", "courtship", "marriage", "request"]),
      socialProfile: Object.freeze({
        adult: true,
        marriageStatus: "unmarried",
        ritualStatus: "family_review_required",
        publicNote: "成年且可由媒妁议礼；本阶段只登记意向，不即时成婚。"
      }),
      hiddenDossier: Object.freeze({
        motives: Object.freeze(["盼借婚姻或师友门路稳固族中声望"]),
        trueAssets: Object.freeze([]),
        secretRelationships: Object.freeze([]),
        unrevealedTasks: Object.freeze([])
      }),
      privateSignalTags: Object.freeze(["亲族压力", "求名"])
    })
  ]),
  magistrate: Object.freeze([
    Object.freeze({
      npcId: "npc:magistrate:registrar-lu",
      sourceRef: "fixture:magistrate:registrar",
      displayName: "陆知事",
      tier: "active",
      roleTags: Object.freeze(["county_deputy", "registrar", "yamen_staff"]),
      stageTags: Object.freeze(["magistrate", "county_yamen", "local_government"]),
      publicProfile: Object.freeze({
        title: "县丞兼知事",
        origin: "本县",
        posting: "清河县县署",
        summary: "熟悉版籍、粮册与乡约，人情盘根错节。",
        visibleAbilities: Object.freeze(["丈田", "查账", "传唤", "整理案牍"])
      }),
      relationship: Object.freeze({
        closeness: 26,
        trust: 58,
        awe: 44,
        hostility: 5,
        favorsOwed: 0,
        labels: Object.freeze(["属员", "县署"])
      }),
      inventoryRefs: Object.freeze(["inventory:npc:registrar-lu:desk"]),
      assetRefs: Object.freeze(["asset:npc:registrar-lu:household-visible"]),
      resourceAccountRefs: Object.freeze(["resource:yamen:clerical-expenses"]),
      availableInteractions: Object.freeze(["talk", "inquire", "gift", "delegate", "summon", "request", "debate"]),
      socialProfile: Object.freeze({
        adult: true,
        marriageStatus: "married",
        ritualStatus: "official_staff",
        publicNote: "官署属员可论事请托，不作求爱或议婚对象。"
      }),
      hiddenDossier: Object.freeze({
        motives: Object.freeze(["保住县署旧例与本地人情"]),
        trueAssets: Object.freeze(["城南薄田十七亩由亲族代名"]),
        secretRelationships: Object.freeze(["与东乡士绅有姻亲往来"]),
        unrevealedTasks: Object.freeze(["暗中观望新任知县是否敢动田册"])
      }),
      privateSignalTags: Object.freeze(["避祸", "亲族压力", "可能欺瞒"])
    }),
    Object.freeze({
      npcId: "npc:magistrate:bailiff-zhou",
      sourceRef: "fixture:magistrate:bailiff",
      displayName: "周班头",
      tier: "active",
      roleTags: Object.freeze(["bailiff", "yamen_runner", "field_agent"]),
      stageTags: Object.freeze(["magistrate", "county_yamen", "fieldwork"]),
      publicProfile: Object.freeze({
        title: "三班班头",
        origin: "清河县",
        posting: "清河县县署",
        summary: "腿脚勤快，能带差役下乡，但贪杯好赌。",
        visibleAbilities: Object.freeze(["巡捕", "送达", "押解", "丈田随行"])
      }),
      relationship: Object.freeze({
        closeness: 12,
        trust: 42,
        awe: 52,
        hostility: 10,
        favorsOwed: 0,
        labels: Object.freeze(["差役", "县署"])
      }),
      inventoryRefs: Object.freeze(["inventory:npc:bailiff-zhou:gear"]),
      assetRefs: Object.freeze([]),
      resourceAccountRefs: Object.freeze([]),
      availableInteractions: Object.freeze(["talk", "inquire", "gift", "delegate", "summon", "duel"]),
      socialProfile: Object.freeze({
        adult: true,
        marriageStatus: "unknown",
        ritualStatus: "yamen_runner",
        publicNote: "差役身份可切磋或公事差遣；胜负和伤损仍由服务器裁决。"
      }),
      hiddenDossier: Object.freeze({
        motives: Object.freeze(["借公差捞取脚钱"]),
        trueAssets: Object.freeze(["赌债二十两"]),
        secretRelationships: Object.freeze(["与城北赌坊相熟"]),
        unrevealedTasks: Object.freeze([])
      }),
      privateSignalTags: Object.freeze(["求财", "可能欺瞒"])
    }),
    Object.freeze({
      npcId: "npc:magistrate:gentry-han",
      sourceRef: "fixture:magistrate:gentry",
      displayName: "韩员外",
      tier: "signature",
      roleTags: Object.freeze(["gentry", "landholder", "local_elite"]),
      stageTags: Object.freeze(["magistrate", "local_society", "tax_land"]),
      publicProfile: Object.freeze({
        title: "乡绅",
        origin: "清河县东乡",
        posting: "韩氏庄",
        summary: "族产丰厚，常以修桥施粥维系乡望。",
        visibleAbilities: Object.freeze(["筹粮", "调停", "地方消息"])
      }),
      relationship: Object.freeze({
        closeness: 8,
        trust: 30,
        awe: 18,
        hostility: 12,
        favorsOwed: 0,
        labels: Object.freeze(["士绅", "纳粮大户"])
      }),
      inventoryRefs: Object.freeze(["inventory:npc:gentry-han:guest-hall"]),
      assetRefs: Object.freeze(["asset:npc:gentry-han:estate-visible"]),
      resourceAccountRefs: Object.freeze(["resource:npc:gentry-han:silver-visible"]),
      availableInteractions: Object.freeze(["talk", "inquire", "gift", "request", "summon", "trade", "marriage"]),
      socialProfile: Object.freeze({
        adult: true,
        marriageStatus: "married",
        ritualStatus: "clan_alliance_only",
        publicNote: "本人已婚，只可代表族中提出联姻或礼法线索，不能即时成婚。"
      }),
      hiddenDossier: Object.freeze({
        motives: Object.freeze(["阻缓清丈以护族产"]),
        trueAssets: Object.freeze(["隐田一百三十亩", "佃户债契若干"]),
        secretRelationships: Object.freeze(["与县署旧吏互通消息"]),
        unrevealedTasks: Object.freeze(["准备联名劝阻丈田"])
      }),
      privateSignalTags: Object.freeze(["护短", "求财", "可能欺瞒"])
    })
  ])
});

module.exports = {
  NPC_INTERACTION_ACTIONS,
  NPC_PRIVATE_SIGNAL_TAGS,
  NPC_ROSTER_SCHEMA_VERSION,
  NPC_STAGE_FIXTURES,
  NPC_TIERS,
  PORTRAIT_POOLS
};
