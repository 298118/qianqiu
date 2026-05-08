const S62_SOCIAL_IDENTITY_PROFILES = Object.freeze([
  Object.freeze({
    key: "official",
    rankLabel: "在任官员",
    bureauId: "ministry_revenue",
    factionId: "scholarOfficials",
    goal: "借差遣、考成和同年声气稳住官声。",
    summaryLabel: "官员",
    skillBias: Object.freeze({ administration: 18, legalJudgment: 10, diplomacy: 8 })
  }),
  Object.freeze({
    key: "clerk",
    rankLabel: "胥吏",
    bureauId: "prefecture_county",
    factionId: "localClerks",
    goal: "经营案牍门路，并观察钱粮与刑名风向。",
    summaryLabel: "胥吏",
    skillBias: Object.freeze({ administration: 14, legalJudgment: 18, caution: 12 })
  }),
  Object.freeze({
    key: "gentry",
    rankLabel: "士绅",
    bureauId: "",
    factionId: "localGentry",
    goal: "维系族望、书院和地方公议。",
    summaryLabel: "士绅",
    skillBias: Object.freeze({ literarySkill: 14, diplomacy: 12, integrity: 8 })
  }),
  Object.freeze({
    key: "merchant",
    rankLabel: "商贾",
    bureauId: "",
    factionId: "merchantGuilds",
    goal: "探听粮价、盐漕和商路风险。",
    summaryLabel: "商贾",
    skillBias: Object.freeze({ diplomacy: 16, caution: 10, peerNetwork: 12 })
  }),
  Object.freeze({
    key: "military_officer",
    rankLabel: "军官",
    bureauId: "regional_garrison",
    factionId: "militaryLords",
    goal: "留意军需、边报和粮道安危。",
    summaryLabel: "军官",
    skillBias: Object.freeze({ militaryCommand: 24, loyalty: 8, temper: 8 })
  }),
  Object.freeze({
    key: "academy_friend",
    rankLabel: "书院师友",
    bureauId: "",
    factionId: "academyNetwork",
    goal: "在讲会、荐牍和清议之间取舍。",
    summaryLabel: "书院师友",
    skillBias: Object.freeze({ literarySkill: 20, learning: 18, integrity: 10 })
  }),
  Object.freeze({
    key: "exam_peer",
    rankLabel: "同年",
    bureauId: "",
    factionId: "examCohort",
    goal: "维持同年相助，同时避免牵连。",
    summaryLabel: "同年",
    skillBias: Object.freeze({ literarySkill: 16, learning: 12, peerNetwork: 14 })
  }),
  Object.freeze({
    key: "kinsman",
    rankLabel: "亲族",
    bureauId: "",
    factionId: "householdKin",
    goal: "照看族中婚姻、田产和人情债。",
    summaryLabel: "亲族",
    skillBias: Object.freeze({ diplomacy: 8, caution: 10, loyalty: 12 })
  }),
  Object.freeze({
    key: "foreign_envoy",
    rankLabel: "邻国使者",
    bureauId: "ministry_rites",
    factionId: "foreignEnvoys",
    goal: "试探贡道、互市和边情口风。",
    summaryLabel: "邻国使者",
    skillBias: Object.freeze({ diplomacy: 24, caution: 16, learning: 8 })
  })
]);

const S62_SURNAMES = Object.freeze(["顾", "陆", "沈", "方", "赵", "钱", "孙", "李", "周", "吴", "郑", "王"]);
const S62_COURTESY_STEMS = Object.freeze(["衡", "济", "伯", "仲", "子", "景", "文", "廷", "若", "季"]);
const S62_FACTION_IDS = Object.freeze([
  "scholarOfficials",
  "localClerks",
  "localGentry",
  "merchantGuilds",
  "militaryLords",
  "academyNetwork",
  "examCohort",
  "householdKin",
  "foreignEnvoys"
]);

const S62_RELATIONSHIP_SEQUENCE = Object.freeze([
  "household",
  "lineage",
  "marriage",
  "mentor",
  "same_hometown",
  "same_year",
  "faction",
  "peer"
]);

const S62_DEFAULT_CITY_ID = "city-beijing";
const S62_DEFAULT_PREFIX = "s62";
const S62_DEFAULT_TURN = 0;

function pad(number, width = 3) {
  return String(number).padStart(width, "0");
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function positiveCount(value, fallback = 0) {
  return clampNumber(value, 0, Number.MAX_SAFE_INTEGER, fallback);
}

function pick(values, index, fallback = "") {
  if (!Array.isArray(values) || values.length === 0) return fallback;
  return values[index % values.length];
}

function metric(base, index, span = 35) {
  return clampNumber(base + (index % span), 0, 100, base);
}

function metricWithBias(base, index, bias = 0, span = 35) {
  return metric(base + bias, index, span);
}

function familyNameFor(index) {
  return S62_SURNAMES[index % S62_SURNAMES.length];
}

function householdId(prefix, index) {
  return `${prefix}-household-${pad(index)}`;
}

function npcId(prefix, index, count) {
  return `${prefix}-npc-${pad(index, count >= 1000 ? 4 : 3)}`;
}

function normalizeCityIds(cityIds) {
  return Array.isArray(cityIds) && cityIds.length ? cityIds : [S62_DEFAULT_CITY_ID];
}

function createHouseholds(options) {
  const {
    cityIds,
    householdCount,
    prefix,
    turnCount,
    assetIdForHousehold,
    estateIdForHousehold
  } = options;

  return Array.from({ length: householdCount }, (_, offset) => {
    const index = offset + 1;
    const surname = familyNameFor(offset);
    const allianceSurname = familyNameFor(offset + 3);
    return {
      id: householdId(prefix, index),
      familyName: `${surname}氏`,
      seatCityId: pick(cityIds, offset * 2),
      wealthScore: metric(34, index, 45),
      landMu: 120 + index * 18,
      prestige: metric(24, index, 52),
      gentryRank: index % 5 === 0 ? "名族" : index % 4 === 0 ? "乡绅" : "民户",
      marriageNetworkScore: metric(26, index, 48),
      debtPressure: index % 7 === 0 ? 46 : metric(12, index, 30),
      politicalAlignment: pick(["靠近清流", "观望地方官声", "倚重乡约", "往来商帮"], offset),
      familyRisk: metric(8, index, 32),
      memberNpcIds: [],
      estateIds: estateIdForHousehold ? [estateIdForHousehold(index)] : [],
      assetIds: assetIdForHousehold ? [assetIdForHousehold(index)] : [],
      visibility: "public",
      knownToPlayer: true,
      intelConfidence: 70,
      publicSummary: `${surname}氏为 S62 可见家族谱系样本，与${allianceSurname}氏有婚姻往来，族望、田产和人情债只公开估计。`,
      lastUpdatedTurn: turnCount
    };
  });
}

function createNpcs(options) {
  const { cityIds, householdCount, npcCount, prefix, turnCount, officeIds, bureauIds } = options;
  return Array.from({ length: npcCount }, (_, offset) => {
    const index = offset + 1;
    const householdIndex = (offset % householdCount) + 1;
    const profile = S62_SOCIAL_IDENTITY_PROFILES[offset % S62_SOCIAL_IDENTITY_PROFILES.length];
    const surname = familyNameFor(householdIndex - 1);
    const generationSlot = Math.floor(offset / Math.max(1, householdCount));
    const age = clampNumber(56 - generationSlot * 17 + (index % 9), 16, 82, 34);
    const officeId = profile.key === "official" || profile.key === "military_officer"
      ? pick(officeIds, index - 1, "")
      : "";
    const bureauId = profile.bureauId || pick(bureauIds, index - 1, "");

    return {
      id: npcId(prefix, index, npcCount),
      name: `${surname}承${index}`,
      courtesyName: `${pick(S62_COURTESY_STEMS, index)}${index}`,
      genderLabel: index % 4 === 0 ? "女" : "男",
      age,
      alive: true,
      homeCityId: pick(cityIds, index),
      currentCityId: pick(cityIds, index * 3),
      householdId: householdId(prefix, householdIndex),
      currentOfficeId: officeId,
      rankLabel: profile.rankLabel,
      bureauId,
      factionId: profile.factionId,
      skills: {
        literarySkill: metricWithBias(38, index, profile.skillBias.literarySkill, 34),
        administration: metricWithBias(36, index, profile.skillBias.administration, 36),
        legalJudgment: metricWithBias(34, index, profile.skillBias.legalJudgment, 30),
        militaryCommand: metricWithBias(24, index, profile.skillBias.militaryCommand, 32),
        diplomacy: metricWithBias(34, index, profile.skillBias.diplomacy, 34),
        learning: metricWithBias(40, index, profile.skillBias.learning, 34)
      },
      temperament: {
        ambition: metricWithBias(34, index, profile.skillBias.ambition, 42),
        loyalty: metricWithBias(40, index, profile.skillBias.loyalty, 36),
        integrity: metricWithBias(42, index, profile.skillBias.integrity, 36),
        caution: metricWithBias(36, index, profile.skillBias.caution, 40),
        temper: metricWithBias(28, index, profile.skillBias.temper, 42)
      },
      ideologyTags: ["S62谱系", profile.summaryLabel, index % 2 === 0 ? "清议" : "务实"],
      currentGoal: profile.goal,
      reputation: metric(30, index, 52),
      influence: metricWithBias(16, index, profile.key === "official" ? 16 : 0, 48),
      patronagePower: metricWithBias(8, index, profile.key === "gentry" || profile.key === "official" ? 12 : 0, 38),
      peerNetwork: metricWithBias(18, index, profile.skillBias.peerNetwork, 52),
      wealthCash: 80 + index * 6,
      landMu: 20 + index * 3,
      debts: index % 13 === 0 ? 20 + index : 0,
      annualIncomeEstimate: 12 + index,
      estateIds: [],
      assetIds: [],
      family: {
        fatherId: "",
        motherId: "",
        spouseIds: [],
        childrenIds: [],
        marriageAllianceTags: []
      },
      health: metric(70, index, 25),
      legalRisk: index % 17 === 0 ? 34 : metric(4, index, 18),
      impeachmentRisk: profile.key === "official" && index % 11 === 0 ? 48 : metric(2, index, 16),
      resentmentRisk: index % 19 === 0 ? 42 : metric(3, index, 20),
      visibility: "public",
      knownToPlayer: true,
      intelConfidence: 70,
      publicSummary: `${profile.summaryLabel}${surname}承${index}属 S62 可见人口谱系，关联家族、姻亲、同乡同年或派系网络；隐藏动机和资产真数不在此投影。`,
      lastUpdatedTurn: turnCount
    };
  });
}

function attachGenealogy(npcs, households) {
  const npcById = new Map(npcs.map((npc) => [npc.id, npc]));
  for (const household of households) {
    const members = npcs.filter((npc) => npc.householdId === household.id);
    household.memberNpcIds = members.map((npc) => npc.id);
    const father = members[0];
    const mother = members[1];
    if (father) father.genderLabel = "男";
    if (mother) mother.genderLabel = "女";
    if (father && mother) {
      father.age = Math.max(father.age, 50);
      mother.age = Math.max(mother.age, 46);
      father.family.spouseIds = [mother.id];
      mother.family.spouseIds = [father.id];
      father.family.marriageAllianceTags = [`${household.familyName}内婚书`];
      mother.family.marriageAllianceTags = [`${household.familyName}内婚书`];
    }
    for (const child of members.slice(2)) {
      child.age = Math.min(child.age, 38);
      if (father) {
        child.family.fatherId = father.id;
        father.family.childrenIds.push(child.id);
      }
      if (mother) {
        child.family.motherId = mother.id;
        mother.family.childrenIds.push(child.id);
      }
      child.family.marriageAllianceTags.push(`${household.familyName}族谱可见支派`);
    }
  }

  for (let offset = 0; offset < households.length; offset += 4) {
    const sourceHousehold = households[offset];
    const targetHousehold = households[(offset + 1) % households.length];
    if (!sourceHousehold || !targetHousehold || sourceHousehold.id === targetHousehold.id) continue;
    const sourceMember = npcById.get(sourceHousehold.memberNpcIds.at(-1));
    const targetMember = npcById.get(targetHousehold.memberNpcIds.at(-1));
    const tag = `${sourceHousehold.familyName}-${targetHousehold.familyName}姻亲`;
    sourceHousehold.publicSummary = `${sourceHousehold.publicSummary} 可见族谱另记${targetHousehold.familyName}姻亲。`;
    sourceHousehold.marriageNetworkScore = Math.min(100, sourceHousehold.marriageNetworkScore + 8);
    if (sourceMember) sourceMember.family.marriageAllianceTags.push(tag);
    if (targetMember) targetMember.family.marriageAllianceTags.push(tag);
  }
}

function relationBase(id, sourceType, sourceId, targetType, targetId, turnCount, extra = {}) {
  return {
    id,
    sourceType,
    sourceId,
    targetType,
    targetId,
    relationship: 30,
    trust: 52,
    resentment: 4,
    obligation: 0,
    patronage: 0,
    fear: 0,
    rivalry: 0,
    visibility: "public",
    knownToPlayer: true,
    intelConfidence: 70,
    lastUpdatedTurn: turnCount,
    ...extra
  };
}

function createRelationshipFactory(prefix, turnCount, relationshipCount) {
  const rows = [];
  const seen = new Set();
  return {
    rows,
    push(kind, sourceType, sourceId, targetType, targetId, extra = {}) {
      if (rows.length >= relationshipCount || !sourceId || !targetId || sourceId === targetId) return;
      const serial = `${kind}-${rows.length + 1}`;
      const id = `${prefix}-rel-${kind}-${pad(rows.length + 1, relationshipCount >= 1000 ? 5 : 3)}`;
      const key = `${kind}:${sourceType}:${sourceId}:${targetType}:${targetId}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(relationBase(id, sourceType, sourceId, targetType, targetId, turnCount, {
        ...extra,
        publicSummary: extra.publicSummary || `S62可见关系${serial}。`
      }));
    }
  };
}

function addRelationshipPass(kind, factory, context) {
  const { npcs, households, factionIds } = context;
  if (kind === "household") {
    for (const npc of npcs) {
      factory.push("household", "npc", npc.id, "household", npc.householdId, {
        relationship: 66,
        trust: 70,
        obligation: 18,
        stance: "家门支点",
        recentIntent: "维系族中名声与日用人情。",
        recentNotes: ["S62家族谱系公开札记"],
        publicSummary: `${npc.name}与本家门第关系公开，属于家族谱系基础边。`
      });
    }
    return;
  }

  if (kind === "lineage") {
    for (const npc of npcs) {
      if (npc.family.fatherId) {
        factory.push("lineage", "npc", npc.id, "npc", npc.family.fatherId, {
          relationship: 72,
          trust: 68,
          obligation: 24,
          stance: "父子谱系",
          recentNotes: ["S62族谱父系记录"],
          publicSummary: `${npc.name}的父系亲缘为公开族谱摘要。`
        });
      }
      if (npc.family.motherId) {
        factory.push("lineage", "npc", npc.id, "npc", npc.family.motherId, {
          relationship: 72,
          trust: 68,
          obligation: 24,
          stance: "母系谱系",
          recentNotes: ["S62族谱母系记录"],
          publicSummary: `${npc.name}的母系亲缘为公开族谱摘要。`
        });
      }
    }
    return;
  }

  if (kind === "marriage") {
    for (const npc of npcs) {
      for (const spouseId of npc.family.spouseIds) {
        if (npc.id < spouseId) {
          factory.push("marriage", "npc", npc.id, "npc", spouseId, {
            relationship: 58,
            trust: 62,
            obligation: 18,
            stance: "婚姻",
            recentNotes: ["S62婚姻关系公开摘要"],
            publicSummary: `${npc.name}有可见婚姻关系；婚姻只作为公开谱系，不含密约。`
          });
        }
      }
    }
    for (let offset = 0; offset < households.length; offset += 4) {
      const source = households[offset];
      const target = households[(offset + 1) % households.length];
      if (!source || !target || source.id === target.id) continue;
      factory.push("marriage_alliance", "household", source.id, "household", target.id, {
        relationship: 42,
        trust: 48,
        obligation: 20,
        stance: "姻亲",
        recentNotes: ["S62姻亲网络公开摘要"],
        publicSummary: `${source.familyName}与${target.familyName}有可见姻亲往来。`
      });
    }
    return;
  }

  if (kind === "mentor") {
    for (let offset = 0; offset < npcs.length; offset += 3) {
      const mentor = npcs[offset];
      const student = npcs[offset + 1] || npcs[(offset + 7) % npcs.length];
      factory.push("mentor", "npc", mentor.id, "npc", student.id, {
        relationship: 46,
        trust: 55,
        obligation: 22,
        patronage: 16,
        stance: "门生故旧",
        recentIntent: "可为荐牍、讲会或差遣递话。",
        recentNotes: ["S62门生故旧关系"],
        publicSummary: `${mentor.name}与${student.name}有可见门生故旧关系。`
      });
    }
    return;
  }

  if (kind === "same_hometown") {
    for (let offset = 0; offset < npcs.length; offset += 4) {
      const source = npcs[offset];
      const target = npcs.find((npc, index) => index > offset && npc.homeCityId === source.homeCityId) ||
        npcs[(offset + 5) % npcs.length];
      factory.push("same_hometown", "npc", source.id, "npc", target.id, {
        relationship: 32,
        trust: 45,
        obligation: 8,
        stance: "同乡",
        recentNotes: ["S62同乡声气"],
        publicSummary: `${source.name}与${target.name}有可见同乡往来。`
      });
    }
    return;
  }

  if (kind === "same_year") {
    for (let offset = 0; offset < npcs.length; offset += 5) {
      const source = npcs[offset];
      const target = npcs[(offset + 11) % npcs.length];
      factory.push("same_year", "npc", source.id, "npc", target.id, {
        relationship: 36,
        trust: 48,
        obligation: 12,
        stance: "同年",
        recentNotes: ["S62同年座主门生网络"],
        publicSummary: `${source.name}与${target.name}有可见同年声气。`
      });
    }
    return;
  }

  if (kind === "faction") {
    for (let offset = 0; offset < npcs.length; offset += 2) {
      const npc = npcs[offset];
      factory.push("faction", "npc", npc.id, "faction", npc.factionId || pick(factionIds, offset), {
        relationship: 24,
        trust: 42,
        obligation: 10,
        patronage: 8,
        stance: "派系声气",
        recentNotes: ["S62派系网络公开摘要"],
        publicSummary: `${npc.name}与所属派系有公开往来；派系真实密谋不在此投影。`
      });
    }
    return;
  }

  for (let offset = 0; offset < npcs.length; offset += 1) {
    const source = npcs[offset];
    const target = npcs[(offset + 1) % npcs.length];
    factory.push("peer", "npc", source.id, "npc", target.id, {
      relationship: 18 + (offset % 45),
      trust: 42 + (offset % 35),
      resentment: offset % 13,
      rivalry: offset % 9,
      stance: "同城往来",
      recentNotes: ["S62同城同业往来"],
      publicSummary: `${source.name}与${target.name}有可见社会往来。`
    });
  }
}

function createRelationships(options) {
  const { relationshipCount, prefix, turnCount, npcs, households, factionIds } = options;
  const factory = createRelationshipFactory(prefix, turnCount, relationshipCount);
  const context = { npcs, households, factionIds };
  const sampleSource = npcs[0];
  const samplePeer = npcs[1] || npcs[0];
  const sampleChild = npcs.find((npc) => npc.family?.fatherId || npc.family?.motherId);
  const sampleSpouse = npcs.find((npc) => npc.family?.spouseIds?.length);
  if (sampleSource) {
    factory.push("household", "npc", sampleSource.id, "household", sampleSource.householdId, {
      relationship: 66,
      trust: 70,
      obligation: 18,
      stance: "家门支点",
      recentNotes: ["S62家族谱系公开札记"],
      publicSummary: `${sampleSource.name}与本家门第关系公开，属于家族谱系基础边。`
    });
    factory.push("mentor", "npc", sampleSource.id, "npc", samplePeer.id, {
      relationship: 46,
      trust: 55,
      obligation: 22,
      patronage: 16,
      stance: "门生故旧",
      recentNotes: ["S62门生故旧关系"],
      publicSummary: `${sampleSource.name}与${samplePeer.name}有可见门生故旧关系。`
    });
    factory.push("same_hometown", "npc", sampleSource.id, "npc", npcs[(7) % npcs.length]?.id || samplePeer.id, {
      relationship: 32,
      trust: 45,
      obligation: 8,
      stance: "同乡",
      recentNotes: ["S62同乡声气"],
      publicSummary: `${sampleSource.name}有可见同乡往来。`
    });
    factory.push("same_year", "npc", samplePeer.id, "npc", npcs[(12) % npcs.length]?.id || sampleSource.id, {
      relationship: 36,
      trust: 48,
      obligation: 12,
      stance: "同年",
      recentNotes: ["S62同年座主门生网络"],
      publicSummary: `${samplePeer.name}有可见同年声气。`
    });
    factory.push("faction", "npc", sampleSource.id, "faction", sampleSource.factionId || pick(factionIds, 0), {
      relationship: 24,
      trust: 42,
      obligation: 10,
      patronage: 8,
      stance: "派系声气",
      recentNotes: ["S62派系网络公开摘要"],
      publicSummary: `${sampleSource.name}与所属派系有公开往来；派系真实密谋不在此投影。`
    });
  }
  if (sampleChild?.family?.fatherId) {
    factory.push("lineage", "npc", sampleChild.id, "npc", sampleChild.family.fatherId, {
      relationship: 72,
      trust: 68,
      obligation: 24,
      stance: "父子谱系",
      recentNotes: ["S62族谱父系记录"],
      publicSummary: `${sampleChild.name}的父系亲缘为公开族谱摘要。`
    });
  }
  if (sampleSpouse?.family?.spouseIds?.[0]) {
    factory.push("marriage", "npc", sampleSpouse.id, "npc", sampleSpouse.family.spouseIds[0], {
      relationship: 58,
      trust: 62,
      obligation: 18,
      stance: "婚姻",
      recentNotes: ["S62婚姻关系公开摘要"],
      publicSummary: `${sampleSpouse.name}有可见婚姻关系；婚姻只作为公开谱系，不含密约。`
    });
  }
  let pass = 0;
  while (factory.rows.length < relationshipCount && pass < relationshipCount + S62_RELATIONSHIP_SEQUENCE.length) {
    const kind = S62_RELATIONSHIP_SEQUENCE[pass % S62_RELATIONSHIP_SEQUENCE.length];
    addRelationshipPass(kind, factory, context);
    pass += 1;
  }
  return factory.rows;
}

function createWorldPeoplePopulation(options = {}) {
  const npcCount = positiveCount(options.npcCount, 0);
  const householdCount = Math.min(positiveCount(options.householdCount, 0), Math.max(1, npcCount));
  const relationshipCount = positiveCount(options.relationshipCount, 0);
  const cityIds = normalizeCityIds(options.cityIds);
  const prefix = options.prefix || S62_DEFAULT_PREFIX;
  const turnCount = positiveCount(options.turnCount, S62_DEFAULT_TURN);
  const officeIds = Array.isArray(options.officeIds) ? options.officeIds : [];
  const bureauIds = Array.isArray(options.bureauIds) ? options.bureauIds : [];
  const factionIds = Array.isArray(options.factionIds) && options.factionIds.length
    ? options.factionIds
    : S62_FACTION_IDS;
  const households = createHouseholds({
    cityIds,
    householdCount,
    prefix,
    turnCount,
    assetIdForHousehold: options.assetIdForHousehold,
    estateIdForHousehold: options.estateIdForHousehold
  });
  const npcs = createNpcs({
    cityIds,
    householdCount,
    npcCount,
    prefix,
    turnCount,
    officeIds,
    bureauIds
  });
  attachGenealogy(npcs, households);
  const relationships = createRelationships({
    relationshipCount,
    prefix,
    turnCount,
    npcs,
    households,
    factionIds
  });

  return {
    npcs,
    households,
    relationships,
    recentNotes: [
      "S62.1：人口与家族谱系只生成可见安全投影；hidden 私档、资产真数和密谋不进入当前 raw route state。"
    ]
  };
}

function measureWorldPeoplePopulation(people = {}) {
  const npcs = Array.isArray(people.npcs) ? people.npcs : [];
  const households = Array.isArray(people.households) ? people.households : [];
  const relationships = Array.isArray(people.relationships) ? people.relationships : [];
  const roleLabels = new Set(npcs.map((npc) => npc.rankLabel).filter(Boolean));
  const marriageLinkedNpcs = npcs.filter((npc) => npc.family?.spouseIds?.length).length;
  const parentLinkedNpcs = npcs.filter((npc) => npc.family?.fatherId || npc.family?.motherId).length;
  const relationshipText = JSON.stringify(relationships);

  return {
    npcs: npcs.length,
    households: households.length,
    relationships: relationships.length,
    roleLabels: [...roleLabels],
    parentLinkedNpcs,
    marriageLinkedNpcs,
    householdsWithMembers: households.filter((household) => household.memberNpcIds?.length).length,
    hasMarriageNetwork: relationshipText.includes("婚姻") || relationshipText.includes("姻亲"),
    hasMentorNetwork: relationshipText.includes("门生故旧"),
    hasNativePlaceNetwork: relationshipText.includes("同乡"),
    hasExamCohortNetwork: relationshipText.includes("同年"),
    hasFactionNetwork: relationshipText.includes("派系")
  };
}

module.exports = {
  S62_SOCIAL_IDENTITY_PROFILES,
  createWorldPeoplePopulation,
  measureWorldPeoplePopulation
};
