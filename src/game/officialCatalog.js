const BUREAUS = [
  {
    id: "hanlin_academy",
    name: "翰林院",
    aliases: ["馆阁", "翰林"],
    duties: ["制诰", "修史", "经筵", "馆阁清望"],
    assignmentKinds: ["文书修撰", "经筵讲章", "科场监临"],
    summary: "掌制诰、修史、经筵与馆阁文事，是清望与入阁资历的重要来源。"
  },
  {
    id: "ministry_personnel",
    name: "吏部",
    aliases: ["天官", "铨部"],
    duties: ["铨选", "考成", "升降", "官缺"],
    assignmentKinds: ["考成复核", "官缺议拟", "荐举查核"],
    summary: "掌官员铨选、考成、升降与官缺，是官场迁转最要紧的部院。"
  },
  {
    id: "ministry_revenue",
    name: "户部",
    aliases: ["地官", "度支"],
    duties: ["钱粮", "仓场", "税赋", "漕运"],
    assignmentKinds: ["赈银核销", "清丈", "仓场查账", "盐漕核算"],
    summary: "掌钱粮、仓场、税赋与漕运，差事多牵涉民生与亏空风险。"
  },
  {
    id: "ministry_rites",
    name: "礼部",
    aliases: ["春官", "礼曹"],
    duties: ["科举", "礼制", "学校"],
    assignmentKinds: ["科场监临", "典礼文案", "学政奏报"],
    summary: "掌科举、礼制与学校，清议名声与士林关系常由此展开。"
  },
  {
    id: "ministry_war",
    name: "兵部",
    aliases: ["夏官", "兵曹"],
    duties: ["军务", "驿传", "边报"],
    assignmentKinds: ["军需核算", "边饷催解", "战报勘验"],
    summary: "掌军务、驿传与边报，常与饷银、军功和边镇虚实相连。"
  },
  {
    id: "ministry_justice",
    name: "刑部",
    aliases: ["秋官", "刑曹"],
    duties: ["案牍", "复核", "刑名"],
    assignmentKinds: ["大案复核", "疑狱平反", "问拟覆奏"],
    summary: "掌案牍复核与刑名问拟，声望常系于平反疑狱或失刑之责。"
  },
  {
    id: "ministry_works",
    name: "工部",
    aliases: ["冬官", "工曹"],
    duties: ["河工", "营缮", "军器"],
    assignmentKinds: ["河工督修", "物料核价", "城工验收"],
    summary: "掌河工、营缮与军器，差事最易牵动钱粮、灾荒和工料弊端。"
  },
  {
    id: "censorate",
    name: "都察院",
    aliases: ["台谏", "风宪", "察院"],
    duties: ["纠劾", "巡按", "风宪"],
    assignmentKinds: ["弹章核实", "巡按查访", "贪墨线索"],
    summary: "掌纠劾、巡按与风宪，能成清流名望，也最易卷入弹章攻讦。"
  },
  {
    id: "provincial_admin",
    name: "布政司",
    aliases: ["藩司"],
    duties: ["地方钱粮", "行政", "灾荒赈务"],
    assignmentKinds: ["府州钱粮", "灾荒赈务", "地方考成"],
    summary: "掌一省钱粮与行政，外任官的政绩多从赈务、赋役和考成见分晓。"
  },
  {
    id: "provincial_judicial",
    name: "按察司",
    aliases: ["臬司"],
    duties: ["地方案牍", "监察", "刑名"],
    assignmentKinds: ["盗案审转", "狱讼复核", "官吏查参"],
    summary: "掌地方案牍与监察，常在盗案、狱讼和地方官吏查参中取信。"
  },
  {
    id: "prefecture_county",
    name: "府州县",
    aliases: ["地方衙门", "州县"],
    duties: ["民政", "税粮", "治安", "水利"],
    assignmentKinds: ["断案平讼", "劝农抚民", "清丈修渠"],
    summary: "直面民政、税粮、治安与水利，是外放后最具体的施政场。"
  }
];

const OFFICES = [
  {
    id: "probationary_observer",
    title: "六部观政进士",
    aliases: ["观政进士", "候选观政"],
    rankBand: "probationary",
    bureauId: "ministry_personnel",
    track: "entry",
    jurisdiction: "京师",
    duties: ["观政", "学习部务", "候选"],
    eligibleFrom: ["进士", "候选观政"],
    outpost: false
  },
  {
    id: "hanlin_shujishi",
    title: "翰林院庶吉士",
    aliases: ["庶吉士"],
    rankBand: "entry_elite",
    bureauId: "hanlin_academy",
    track: "hanlin",
    jurisdiction: "京师",
    duties: ["馆阁学习", "文书修撰", "经筵预备"],
    eligibleFrom: ["进士", "一甲进士", "六部观政进士"],
    outpost: false
  },
  {
    id: "hanlin_examiner",
    title: "翰林院检讨",
    aliases: ["检讨"],
    rankBand: "low_central",
    bureauId: "hanlin_academy",
    track: "hanlin",
    jurisdiction: "京师",
    duties: ["修史", "校书", "科场文案"],
    eligibleFrom: ["翰林院庶吉士"],
    outpost: false
  },
  {
    id: "hanlin_editor",
    title: "翰林院编修",
    aliases: ["编修"],
    rankBand: "middle_central",
    bureauId: "hanlin_academy",
    track: "hanlin",
    jurisdiction: "京师",
    duties: ["制诰", "修史", "经筵讲章"],
    eligibleFrom: ["翰林院庶吉士", "翰林院检讨"],
    outpost: false
  },
  {
    id: "hanlin_compiler",
    title: "翰林院修撰",
    aliases: ["修撰"],
    rankBand: "middle_central",
    bureauId: "hanlin_academy",
    track: "hanlin",
    jurisdiction: "京师",
    duties: ["制诰", "史馆纂修", "典礼文字"],
    eligibleFrom: ["一甲进士", "翰林院编修"],
    outpost: false
  },
  {
    id: "ministry_personnel_principal",
    title: "吏部主事",
    aliases: ["吏部司务", "铨部主事"],
    rankBand: "low_central",
    bureauId: "ministry_personnel",
    track: "central_ministry",
    jurisdiction: "京师",
    duties: ["铨选", "考成", "官缺议拟"],
    eligibleFrom: ["六部观政进士", "翰林院庶吉士"],
    outpost: false
  },
  {
    id: "ministry_revenue_principal",
    title: "户部主事",
    aliases: ["户部司务", "度支主事"],
    rankBand: "low_central",
    bureauId: "ministry_revenue",
    track: "central_ministry",
    jurisdiction: "京师",
    duties: ["钱粮", "仓场", "奏销"],
    eligibleFrom: ["六部观政进士", "翰林院庶吉士"],
    outpost: false
  },
  {
    id: "ministry_rites_principal",
    title: "礼部主事",
    aliases: ["礼曹主事"],
    rankBand: "low_central",
    bureauId: "ministry_rites",
    track: "central_ministry",
    jurisdiction: "京师",
    duties: ["科举", "礼制", "学校文案"],
    eligibleFrom: ["六部观政进士", "翰林院庶吉士"],
    outpost: false
  },
  {
    id: "ministry_war_principal",
    title: "兵部主事",
    aliases: ["兵曹主事"],
    rankBand: "low_central",
    bureauId: "ministry_war",
    track: "central_ministry",
    jurisdiction: "京师",
    duties: ["军务", "驿传", "边报勘验"],
    eligibleFrom: ["六部观政进士", "翰林院庶吉士"],
    outpost: false
  },
  {
    id: "ministry_justice_principal",
    title: "刑部主事",
    aliases: ["刑曹主事"],
    rankBand: "low_central",
    bureauId: "ministry_justice",
    track: "central_ministry",
    jurisdiction: "京师",
    duties: ["案牍", "刑名", "覆奏"],
    eligibleFrom: ["六部观政进士", "翰林院庶吉士"],
    outpost: false
  },
  {
    id: "ministry_works_principal",
    title: "工部主事",
    aliases: ["工曹主事"],
    rankBand: "low_central",
    bureauId: "ministry_works",
    track: "central_ministry",
    jurisdiction: "京师",
    duties: ["河工", "营缮", "物料核价"],
    eligibleFrom: ["六部观政进士", "翰林院庶吉士"],
    outpost: false
  },
  {
    id: "ministry_revenue_deputy_director",
    title: "户部员外郎",
    aliases: ["员外郎"],
    rankBand: "middle_central",
    bureauId: "ministry_revenue",
    track: "central_ministry",
    jurisdiction: "京师",
    duties: ["钱粮复核", "盐漕核算", "仓场稽查"],
    eligibleFrom: ["户部主事", "六部主事"],
    outpost: false
  },
  {
    id: "ministry_revenue_director",
    title: "户部郎中",
    aliases: ["郎中"],
    rankBand: "upper_central",
    bureauId: "ministry_revenue",
    track: "central_ministry",
    jurisdiction: "京师",
    duties: ["部曹统筹", "奏销定议", "钱粮复核"],
    eligibleFrom: ["户部员外郎", "六部员外郎"],
    outpost: false
  },
  {
    id: "ministry_personnel_director",
    title: "吏部郎中",
    aliases: ["铨部郎中"],
    rankBand: "upper_central",
    bureauId: "ministry_personnel",
    track: "central_ministry",
    jurisdiction: "京师",
    duties: ["考成定议", "官缺铨拟", "荐举查核"],
    eligibleFrom: ["吏部员外郎", "六部员外郎"],
    outpost: false
  },
  {
    id: "censorate_investigating_censor",
    title: "监察御史",
    aliases: ["御史", "巡按御史"],
    rankBand: "low_censorate",
    bureauId: "censorate",
    track: "censorate",
    jurisdiction: "京师及巡按地方",
    duties: ["纠劾", "巡按", "风宪"],
    eligibleFrom: ["翰林院庶吉士", "六部主事", "六部观政进士"],
    outpost: false
  },
  {
    id: "censorate_assistant_censor",
    title: "都察院佥都御史",
    aliases: ["佥都御史"],
    rankBand: "high_censorate",
    bureauId: "censorate",
    track: "censorate",
    jurisdiction: "京师",
    duties: ["风宪总理", "巡按复核", "弹章裁量"],
    eligibleFrom: ["监察御史", "六部郎中"],
    outpost: false
  },
  {
    id: "provincial_admin_councillor",
    title: "布政司参议",
    aliases: ["参议", "藩司参议"],
    rankBand: "provincial_middle",
    bureauId: "provincial_admin",
    track: "provincial",
    jurisdiction: "一省",
    duties: ["地方钱粮", "灾荒赈务", "府州考成"],
    eligibleFrom: ["六部郎中", "监察御史", "知府"],
    outpost: true
  },
  {
    id: "provincial_judicial_assistant",
    title: "按察司佥事",
    aliases: ["佥事", "臬司佥事"],
    rankBand: "provincial_low",
    bureauId: "provincial_judicial",
    track: "provincial",
    jurisdiction: "一省",
    duties: ["狱讼复核", "盗案审转", "官吏查参"],
    eligibleFrom: ["监察御史", "六部主事", "府州属官"],
    outpost: true
  },
  {
    id: "prefecture_magistrate",
    title: "知府",
    aliases: ["府尹", "太守"],
    rankBand: "local_middle",
    bureauId: "prefecture_county",
    track: "local",
    jurisdiction: "一府",
    duties: ["民政", "税粮", "治安", "属县考成"],
    eligibleFrom: ["六部郎中", "布政司参议", "按察司佥事"],
    outpost: true
  },
  {
    id: "prefecture_assistant",
    title: "府同知",
    aliases: ["同知", "河南府同知"],
    rankBand: "local_low",
    bureauId: "prefecture_county",
    track: "local",
    jurisdiction: "一府",
    duties: ["粮务", "水利", "案牍协理"],
    eligibleFrom: ["六部主事", "翰林院检讨", "府州属官"],
    outpost: true
  },
  {
    id: "prefecture_judge",
    title: "府推官",
    aliases: ["推官", "苏州府推官"],
    rankBand: "local_low",
    bureauId: "prefecture_county",
    track: "local",
    jurisdiction: "一府",
    duties: ["刑名", "狱讼", "案牍复核"],
    eligibleFrom: ["刑部主事", "监察御史", "六部观政进士"],
    outpost: true
  },
  {
    id: "county_magistrate",
    title: "知县",
    aliases: ["县令", "清河县知县"],
    rankBand: "local_entry",
    bureauId: "prefecture_county",
    track: "local",
    jurisdiction: "一县",
    duties: ["断案平讼", "劝农抚民", "税粮催征"],
    eligibleFrom: ["进士", "举人", "六部观政进士"],
    outpost: true
  },
  {
    id: "pending_audit_official",
    title: "候勘官员",
    aliases: ["候勘", "待勘官员"],
    rankBand: "suspended",
    bureauId: "censorate",
    track: "discipline",
    jurisdiction: "京师",
    duties: ["候勘", "待议", "自陈"],
    eligibleFrom: ["弹劾成案", "部议未定"],
    outpost: false
  }
];

const RANK_ORDER = [
  "suspended",
  "probationary",
  "entry_elite",
  "local_entry",
  "low_central",
  "low_censorate",
  "local_low",
  "middle_central",
  "local_middle",
  "provincial_low",
  "upper_central",
  "provincial_middle",
  "high_censorate"
];

const OFFICE_LADDER = [
  "六部观政进士",
  "翰林院庶吉士",
  "翰林院检讨",
  "翰林院编修",
  "翰林院修撰",
  "户部主事",
  "监察御史",
  "按察司佥事",
  "知府",
  "布政司参议",
  "户部郎中",
  "都察院佥都御史"
];

const BUREAUS_BY_ID = new Map(BUREAUS.map((bureau) => [bureau.id, bureau]));
const OFFICES_BY_ID = new Map(OFFICES.map((office) => [office.id, office]));
const OFFICES_BY_TITLE = new Map(OFFICES.flatMap((office) => {
  const names = [office.title, ...(office.aliases || [])];
  return names.map((name) => [normalizeText(name), office]);
}));

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, "") : "";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getBureau(bureauId) {
  const bureau = BUREAUS_BY_ID.get(bureauId);
  return bureau ? clone(bureau) : null;
}

function listBureaus() {
  return clone(BUREAUS);
}

function getOffice(officeId) {
  const office = OFFICES_BY_ID.get(officeId);
  return office ? withBureauName(office) : null;
}

function listOffices(filter = {}) {
  return OFFICES
    .filter((office) => {
      if (filter.bureauId && office.bureauId !== filter.bureauId) return false;
      if (filter.track && office.track !== filter.track) return false;
      if (filter.rankBand && office.rankBand !== filter.rankBand) return false;
      if (typeof filter.outpost === "boolean" && office.outpost !== filter.outpost) return false;
      return true;
    })
    .map(withBureauName);
}

function withBureauName(office) {
  const copy = clone(office);
  copy.bureauName = BUREAUS_BY_ID.get(copy.bureauId)?.name || "未明衙门";
  return copy;
}

function inferOfficeByTitle(title) {
  const normalized = normalizeText(title);
  if (!normalized) return null;

  const direct = OFFICES_BY_TITLE.get(normalized);
  if (direct) return withBureauName(direct);

  const scored = OFFICES
    .map((office) => ({
      office,
      score: scoreOfficeMatch(normalized, office)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.office.title.length - a.office.title.length);

  return scored.length > 0 ? withBureauName(scored[0].office) : null;
}

function scoreOfficeMatch(normalizedTitle, office) {
  const names = [office.title, ...(office.aliases || [])].map(normalizeText);
  if (names.some((name) => normalizedTitle.includes(name))) return 90;
  if (normalizedTitle.length >= 3 && names.some((name) => name.includes(normalizedTitle))) return 90;

  const bureau = BUREAUS_BY_ID.get(office.bureauId);
  const bureauNames = [bureau?.name, ...(bureau?.aliases || [])].map(normalizeText).filter(Boolean);
  const hasBureau = bureauNames.some((name) => normalizedTitle.includes(name));
  const titleSuffix = inferTitleSuffix(office.title);

  if (hasBureau && titleSuffix && normalizedTitle.includes(titleSuffix)) return 80;
  if (hasBureau && office.track !== "local") return 35;
  if (titleSuffix && normalizedTitle.endsWith(titleSuffix)) return 24;
  return 0;
}

function inferTitleSuffix(title) {
  const normalized = normalizeText(title);
  const suffixes = ["佥都御史", "庶吉士", "员外郎", "主事", "郎中", "御史", "编修", "修撰", "检讨", "佥事", "知府", "同知", "推官", "知县"];
  return suffixes.find((suffix) => normalized.endsWith(suffix)) || normalized;
}

function summarizeOfficeForPlayer(officeOrTitle) {
  const office = typeof officeOrTitle === "string"
    ? inferOfficeByTitle(officeOrTitle)
    : getOffice(officeOrTitle?.id);
  if (!office) return null;

  const bureau = BUREAUS_BY_ID.get(office.bureauId);
  return {
    title: office.title,
    bureau: bureau?.name || "未明衙门",
    rankBand: office.rankBand,
    track: office.track,
    jurisdiction: office.jurisdiction,
    duties: [...office.duties],
    text: `${office.title}隶属${bureau?.name || "未明衙门"}，管 ${office.duties.join("、")}。${bureau?.summary || ""}`
  };
}

function getOfficeLadder(track) {
  const ladder = OFFICE_LADDER
    .map((title) => inferOfficeByTitle(title))
    .filter(Boolean);
  return track ? ladder.filter((office) => office.track === track || office.track === "entry") : ladder;
}

function listPromotionCandidates(currentOfficeOrTitle, options = {}) {
  const current = resolveOffice(currentOfficeOrTitle);
  if (!current) return getOfficeLadder(options.track).slice(0, options.limit || 4);
  const currentRank = rankIndex(current.rankBand);
  const candidates = OFFICES
    .filter((office) => office.id !== current.id)
    .filter((office) => office.track === current.track || isCrossTrackPromotion(current, office))
    .filter((office) => rankIndex(office.rankBand) > currentRank)
    .sort((a, b) => rankIndex(a.rankBand) - rankIndex(b.rankBand) || a.title.localeCompare(b.title, "zh-Hans-CN"));
  return candidates.slice(0, options.limit || 4).map(withBureauName);
}

function listTransferCandidates(currentOfficeOrTitle, options = {}) {
  const current = resolveOffice(currentOfficeOrTitle);
  if (!current) return [];
  const currentRank = rankIndex(current.rankBand);
  const candidates = OFFICES
    .filter((office) => office.id !== current.id)
    .filter((office) => office.track === current.track || sameTransferPool(current, office))
    .filter((office) => Math.abs(rankIndex(office.rankBand) - currentRank) <= 1)
    .filter((office) => office.outpost === current.outpost)
    .sort((a, b) => Math.abs(rankIndex(a.rankBand) - currentRank) - Math.abs(rankIndex(b.rankBand) - currentRank) || a.title.localeCompare(b.title, "zh-Hans-CN"));
  return candidates.slice(0, options.limit || 5).map(withBureauName);
}

function listOutpostCandidates(currentOfficeOrTitle, options = {}) {
  const current = resolveOffice(currentOfficeOrTitle);
  const currentRank = current ? rankIndex(current.rankBand) : rankIndex("low_central");
  const candidates = OFFICES
    .filter((office) => office.outpost)
    .filter((office) => rankIndex(office.rankBand) <= currentRank + 2)
    .sort((a, b) => rankIndex(a.rankBand) - rankIndex(b.rankBand) || a.title.localeCompare(b.title, "zh-Hans-CN"));
  return candidates.slice(0, options.limit || 5).map(withBureauName);
}

function resolveOffice(officeOrTitle) {
  if (typeof officeOrTitle === "string") return inferOfficeByTitle(officeOrTitle);
  if (officeOrTitle?.id) return getOffice(officeOrTitle.id);
  if (officeOrTitle?.title) return inferOfficeByTitle(officeOrTitle.title);
  return null;
}

function rankIndex(rankBand) {
  const index = RANK_ORDER.indexOf(rankBand);
  return index >= 0 ? index : 0;
}

function isCrossTrackPromotion(current, office) {
  if (current.track === "entry") return ["hanlin", "central_ministry", "censorate", "local"].includes(office.track);
  if (current.track === "hanlin") return ["central_ministry", "censorate"].includes(office.track);
  if (current.track === "central_ministry") return ["censorate", "provincial"].includes(office.track);
  if (current.track === "censorate") return ["central_ministry", "provincial"].includes(office.track);
  if (current.track === "local") return office.track === "provincial";
  return false;
}

function sameTransferPool(current, office) {
  const centralTracks = new Set(["hanlin", "central_ministry", "censorate"]);
  if (centralTracks.has(current.track) && centralTracks.has(office.track)) return true;
  const localTracks = new Set(["local", "provincial"]);
  return localTracks.has(current.track) && localTracks.has(office.track);
}

module.exports = {
  getBureau,
  getOffice,
  getOfficeLadder,
  inferOfficeByTitle,
  listBureaus,
  listOffices,
  listOutpostCandidates,
  listPromotionCandidates,
  listTransferCandidates,
  summarizeOfficeForPlayer
};
