const OFFICIAL_FIRST_MONTH_SCHEMA_VERSION = "s88.4-official-first-month.v1";

const OFFICIAL_FIRST_MONTH_LIMITS = Object.freeze({
  maxTextLength: 180,
  maxShortTextLength: 96,
  maxNextActions: 4,
  maxContacts: 4,
  maxNotes: 3
});

const OFFICIAL_FIRST_MONTH_PROGRESS_BANDS = Object.freeze([
  Object.freeze({
    min: 85,
    id: "submitted",
    label: "已递堂官",
    summary: "差遣已成回署稿，等候堂官批示与月报入簿。"
  }),
  Object.freeze({
    min: 60,
    id: "drafted",
    label: "成稿待核",
    summary: "差遣已有成稿，仍须补足凭据、避嫌说明与上官问答。"
  }),
  Object.freeze({
    min: 30,
    id: "in_progress",
    label: "正在查办",
    summary: "差遣已进入查核与拟稿阶段，进度会影响首月考成。"
  }),
  Object.freeze({
    min: 0,
    id: "received",
    label: "新受差遣",
    summary: "差遣刚入官署，首要是明白限期、经手人和可公开凭据。"
  })
]);

const OFFICIAL_FIRST_MONTH_RISK_BANDS = Object.freeze([
  Object.freeze({
    min: 76,
    id: "critical",
    label: "高压",
    summary: "风险已高，宜先补证据、请核边界，并避免越权揽事。"
  }),
  Object.freeze({
    min: 52,
    id: "watch",
    label: "须防",
    summary: "已有明显牵连，需留意台谏、同僚和账册细节。"
  }),
  Object.freeze({
    min: 28,
    id: "steady",
    label: "可控",
    summary: "风险可控，但仍需按期回署，勿让小失误入考成。"
  }),
  Object.freeze({
    min: 0,
    id: "low",
    label: "平稳",
    summary: "风险较低，可把重点放在按期成稿与稳住上官观感。"
  })
]);

const OFFICIAL_FIRST_MONTH_KIND_FEEDBACK = Object.freeze({
  memorial_drafting: Object.freeze({
    superiorFocus: "堂官先看章法、避讳和能否切中本职。",
    colleagueFocus: "同年多会提醒馆阁旧例与上疏分寸。",
    receiptNoun: "讲章回署",
    nextActions: Object.freeze([
      "核对公开诏令与朝会记录，补齐引用出处。",
      "先拟回堂官札，说明成稿进度、疑义和请裁事项。",
      "拜问同年或座师，确认馆阁文体与避讳。"
    ])
  }),
  routine_office: Object.freeze({
    superiorFocus: "司官先看清册是否点收明白、文移是否按例。",
    colleagueFocus: "同僚多会观察新进官能否守规矩、明次第。",
    receiptNoun: "清册回署",
    nextActions: Object.freeze([
      "整理清册目录，标出缺页、重号和需请示处。",
      "拟回堂官札，说明已点收项目与尚待核验项。",
      "拜会经手吏员，确认公开流程和交接时限。"
    ])
  }),
  personnel_review: Object.freeze({
    superiorFocus: "吏部先看履历、保结、日课和是否急于求缺。",
    colleagueFocus: "同年多会关心候缺节奏与可避嫌的补缺线索。",
    receiptNoun: "观政日课",
    nextActions: Object.freeze([
      "整理初授履历与观政日课，列出可核证事项。",
      "拟回堂官札，说明候缺期间所办文移。",
      "询问同年公开缺额风声，不越过吏部裁决。"
    ])
  }),
  land_survey: Object.freeze({
    superiorFocus: "上官先看册籍、民情和士绅阻力是否分清。",
    colleagueFocus: "地方属员会观察新官是否只听一面之词。",
    receiptNoun: "册籍回署",
    nextActions: Object.freeze([
      "点验册籍与公开民情，分列需复核的田亩或户籍。",
      "拟回堂官札，说明民情初访与士绅可能阻力。",
      "先请公开见证，不以私访替代服务器裁决。"
    ])
  })
});

const OFFICIAL_FIRST_MONTH_DEFAULT_FEEDBACK = Object.freeze({
  superiorFocus: "上官先看差遣是否按期、据实、守住本职边界。",
  colleagueFocus: "同僚会从文移、礼数和是否揽权观察新进官。",
  receiptNoun: "差遣回署",
  nextActions: Object.freeze([
    "整理本差遣公开凭据，分清已办、待核和请示事项。",
    "拟回堂官札，说明进度、风险和需要服务器裁决的部分。",
    "拜问可见同僚或座师，只形成行动草稿。"
  ])
});

const OFFICIAL_FIRST_MONTH_AUTHORITY_BOUNDARY =
  "首月差事、回执、考成风险与月报只由服务器按公开官场投影派生；AI 和前端只能生成文案或行动草稿，不能改官职、改考成、定弹劾或写入隐藏状态。";

const OFFICIAL_FIRST_MONTH_UNSAFE_TEXT_PATTERNS = Object.freeze([
  /hiddenNotes|hidden_notes|hiddenIntent|hidden_intent|privateSignalTags|sealedMapping|SEALED_[A-Z0-9_]+/gi,
  /\bprovider\b|\bproposal\b|\bprompt\b/gi,
  /raw[_ -]?(?:provider|audit|ledger|table)|provider payload|provider proposal|statePatch|worldState|prompt|proposal/gi,
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|api[_ -]?key|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,}/gi,
  /data[\\/](?:sessions|audit)[\\/][^\s，。；]*|(?:geo|people|office)_[A-Za-z0-9_]+|world_sessions|prompt_retrieval_index|event_archive_index/gi,
  /file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>，。；]+|[A-Za-z]:[\\/][^\s"'<>，。；]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>，。；]+/gi
]);

module.exports = {
  OFFICIAL_FIRST_MONTH_AUTHORITY_BOUNDARY,
  OFFICIAL_FIRST_MONTH_DEFAULT_FEEDBACK,
  OFFICIAL_FIRST_MONTH_KIND_FEEDBACK,
  OFFICIAL_FIRST_MONTH_LIMITS,
  OFFICIAL_FIRST_MONTH_PROGRESS_BANDS,
  OFFICIAL_FIRST_MONTH_RISK_BANDS,
  OFFICIAL_FIRST_MONTH_SCHEMA_VERSION,
  OFFICIAL_FIRST_MONTH_UNSAFE_TEXT_PATTERNS
};
