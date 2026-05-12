# 《千秋》S68.1 科举制度契约

本文是 S68-S69 科举、读书、评卷与授官深化的制度契约。它把明清科举原型压缩为可实现、可测试、可审计的游戏规则，作为 S68.2 之后新增 `studyProfileView`、`examProcedureView`、`examinerPanelView`、`examHonorView` 和 `appointmentTrackView` 的准绳。

核心边界不变：AI 可以出题、点评、扮演老师、保人、同年、考官、吏部和皇帝，提交结构化建议；服务器拥有资格、保结、搜检、号舍事件、弥封、誊录、对读、磨勘、复核、评分扣罚、榜单、名次、甲第、授官、任免、审计和持久化的最终裁决。

## 1. 适用范围

S68.1 只固定制度契约，不改变当前运行时代码、API、存档格式或 SQLite 表结构。后续实现必须逐步遵守本文：

- 现有四级外层链路继续可用：`child_exam -> provincial_exam -> metropolitan_exam -> palace_exam`。
- 完整书生路径继续受保护：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- `POST /api/exam/question`、`POST /api/exam/progress`、`POST /api/exam/submit` 的外层语义保持兼容；内部可以新增制度阶段、卷件状态和可见 view。
- 默认 Mock AI 必须完整可玩；真实 provider 只提升题目、点评、批语和 proposal 质量，不能成为通过、名次或授官的唯一依据。
- JSON session 仍是默认存储；如果后续为科举拆 SQLite 派生表，也必须从 `world_sessions.world_state_json -> server views -> safe derived rows` 单向修复，不能让 raw table 反向改写 canonical 状态。

## 2. 明清原型与游戏压缩

本系统以明清科举为主要原型，同时保留架空朝代和不同年代制度差异。实现目标不是百科式复刻，而是保留能产生玩法、风险、关系和后果的制度件。

| 制度点 | 历史原型 | 游戏压缩 | 服务器裁决 |
| --- | --- | --- | --- |
| 童试三关 | 县试、府试、院试，院试后为生员/秀才 | 外层仍为 `child_exam`，内部拆 `county_exam`、`prefectural_exam`、`academy_exam` | 三关资格、阶段推进、失败记录和最终秀才名位 |
| 保结/互结/廪保 | 考生由保人、邻里或廪生具结，牵连冒籍、冒名、品行 | 作为报名资格、老师关系、人情债和舞弊连坐 | 是否准考、保人风险、金钱/声望/关系变化 |
| 搜检/入场 | 入场查夹带、点名、验身、查号 | 作为科场事件与心理压力 | 是否查出夹带、误会、延误、处罚、心态损失 |
| 贡院号舍 | 乡试/会试入号舍多日作答，天气、病痛、邻号干扰 | 作为 scene-local time 与事件池 | 健康、心态、作答时间、事故是否发生 |
| 三场多日多卷 | 乡试、会试分三场，题型与要求不同 | 外层仍为一次考试，内部有 `sessionIndex`、`paperType` 和多卷结果 | 每场分数权重、缺场、疲劳和最终合成 |
| 弥封 | 隐去姓名防止阅卷人识别 | 卷件进入匿名生命周期 | 姓名映射只归服务器，不进普通 prompt/UI |
| 誊录 | 墨卷誊为朱卷供阅 | 引入誊录误差、卷面清洁和复核线索 | 误差概率、是否影响评分、是否纠正 |
| 对读 | 朱卷与原卷校对 | 形成可见或半可见异常摘要 | 纠错、保留疑点、生成审计记录 |
| 磨勘/复核 | 查格式、错录、冒名、夹带、取中争议 | 成为考试审计阶段 | 反作弊、排名复核、处分或恢复 |
| 房官/同考官 | 分房初阅，按文风、题意和取中尺度推荐 | AI 给初评、批语和推荐等级 | 分数输入和争议来源，不定榜 |
| 主考/副主考 | 复看前列、争议卷和取中尺度 | AI 给复看意见与榜前争议 | 服务器生成 canonical ranking |
| 殿试/读卷/钦定 | 贡士殿试，定甲第，一般不黜落 | `palace_exam` 仍可完成入仕，细化一甲/二甲/三甲和前列名次 | 状元/榜眼/探花/传胪、甲第、初授路径 |
| 馆选/观政/铨选 | 殿试后按甲第、名次、缺额和回避入翰林、观政或外放 | S69.3 已进入 `appointmentTrackView` | 官缺、回避、授官、候缺和官职事实 |

## 3. 外层等级与内部阶段

外层 `level` 枚举暂不扩展，以保护当前 API、测试和浏览器 smoke：

```text
child_exam
provincial_exam
metropolitan_exam
palace_exam
```

内部制度阶段通过 `examProcedure` 或 `activeExam.procedure` 表示，不把 `county_exam` 等暴露为新的外层等级。

建议阶段映射：

| 外层等级 | 内部阶段 | 核心玩法 | 通过后名位 |
| --- | --- | --- | --- |
| `child_exam` | `county_exam`、`prefectural_exam`、`academy_exam` | 县府学政批语、保结、搜检、基础经义 | 院试通过后为 `秀才` |
| `provincial_exam` | 三场：经义/制艺、经史应用、策论/时务 | 秋闱号舍、多日多卷、房官初阅 | `举人`，第一名可记 `解元` |
| `metropolitan_exam` | 三场：制艺、官样文书或经史应用、时政策论 | 春闱竞争、会试房考、主考复阅 | `贡士`，第一名可记 `会元` |
| `palace_exam` | 御前策问、读卷、钦定甲第 | 殿试一般不黜落，严重舞弊例外 | `进士` 与入仕路径 |

当前 `src/game/examSceneTime.js` 的 `entry -> question_review -> outline -> drafting -> fair_copy -> submitted` 是最小写作阶段。S68.4 以后可在此之外新增制度阶段，但必须继续保证考试局部时间不推进全局旬。

## 4. 科场流程契约

后续 `examProcedure` 应使用 server-owned phase state，至少覆盖这些阶段。实现可以分步落地，但命名语义应保持稳定：

| Phase | 玩家可见 | AI 可做 | 服务器必须裁决 |
| --- | --- | --- | --- |
| `eligibility_check` | 是否可报名、缺什么资格 | 老师或礼房提示准备事项 | 身份、名位、考期、属性、盘费、保结门槛 |
| `sponsorship` | 保人、互结、荐书、人情债 | 老师/保人评估是否愿意作保 | 保结是否成立、连坐风险、关系和声望变化 |
| `registration` | 点名、籍贯、履历摘要 | 礼房胥吏叙事 | 冒籍、冒名、资料缺漏 |
| `entry_search` | 入场搜检、夹带疑云 | 吏役或同场考生叙事 | 夹带是否成立、处罚、误会、延误 |
| `cell_entry` | 号舍位置、天气、邻号 | 生成科场遭遇 proposal | 事件是否发生及健康/心态影响 |
| `question_release` | 发题、审题、题型要求 | 出题官生成题面 | 题面 schema、等级、题型、篇幅和重复检查 |
| `drafting` | 起草、拟纲、成篇 | 老师记忆或旁白给弱点提醒 | scene-local 进度、疲劳、是否缺场 |
| `fair_copy` | 誊清墨卷、卷面格式 | 旁白提醒字迹、格式 | 卷面、篇幅、迟交、污损 |
| `submission` | 交卷封送 | 只叙事 | 交卷时间、状态关闭、防重复提交 |
| `sealing` | 弥封后匿名 | 不得揭示姓名映射 | 身份映射、匿名编号、可见性过滤 |
| `transcription` | 誊录为朱卷 | 誊录生可提交误差提示 | 误差概率、误差位置、是否进入复核 |
| `collation` | 对读校勘 | 对读官提示异常 | 错录纠正、保留疑点、审计摘要 |
| `room_review` | 房官/同考官初评摘要 | AI 考官给批语、建议等级 | 批语采纳、分数权重、隐藏偏好过滤 |
| `chief_review` | 主考复看争议摘要 | AI 主考给取舍意见 | 榜单候选、分歧处理、不可直接定榜 |
| `audit_review` | 磨勘/复核结果 | AI critic 提疑点 | 现代词、照抄、代笔、冒名、格式、处分 |
| `ranking` | 放榜前后、名次 | AI 叙述同场反应 | canonical ranking、名额、名次荣誉 |
| `announcement` | 放榜、师友反应 | narrator、老师、同年反馈 | `examHistory`、事件档案、关系变化 |
| `review_petition` | 复核/争议线索 | 老师或考生提出复核理由 | 是否受理、是否改判、是否处罚 |
| `closed` | 本场归档 | 只读解释 | 持久化、审计、后续资格 |

### 压缩规则

- 童试三关可以先作为一次 `child_exam` 内部的三个 phase 组落地，不必新增三个 route。
- 乡试/会试三场可以先生成三份 `paper` 记录，再合成一个 `promotionResult`。
- 如果用户只想快速通关，Mock path 可以自动走完低风险行政阶段，但仍要在 `examProcedureView` 留下摘要。
- 所有科场阶段仍是 scene-local time；不得因为写作、弥封、阅卷或放榜直接推进全局旬，除非未来单独写明“考试跨月”规则。

## 5. 卷件生命周期

科举深化必须把“考生文章”拆成可审计的卷件生命周期。推荐概念模型如下，字段名可在实现时调整，但可见性和归属不可放松：

| 卷件 | 内容 | 可见性 | 归属 |
| --- | --- | --- | --- |
| `draftRoll` | 草稿、拟纲、玩家输入过程摘要 | 玩家可见摘要，不必完整保存所有草稿 | 服务器 |
| `inkRoll` | 玩家最终交卷文本，即墨卷 | 玩家可见，进入 `examHistory` | 服务器 |
| `sealedRoll` | 弥封后匿名卷，含服务器匿名编号 | 玩家只见“已弥封”，不见映射 | 服务器隐藏层 |
| `redCopy` | 誊录朱卷，可带误差标记 | 玩家只见脱敏误差摘要 | 服务器 |
| `collatedCopy` | 对读后的校勘卷 | 玩家见复核结论，不见内部映射 | 服务器 |
| `reviewCopy` | 房官/同考官阅卷输入 | AI 可读脱敏摘要，不得读身份映射 | 服务器给 AI 的可见 capsule |
| `auditRecord` | 磨勘、反作弊、错录、争议 | 玩家见公开结论 | 服务器审计 |
| `publicArchive` | 可展示的题目、分数、批语、榜次 | 玩家可见 | route view |

禁止事项：

- AI 不得读取弥封前姓名映射、保结 hidden notes、考官 hidden intent、raw provider proposal、完整 prompt、本地路径、密钥或 raw SQLite row。
- 玩家 UI 不得从 raw `worldState` 或 raw audit 中拼接考官隐情；必须读取 server-built view。
- 如果后续要保存完整 hidden 卷件映射，应先设计 redacted player API，不能把 hidden 真值塞回普通 route state。

## 6. 建议数据与 View

S68.2 以后可以小步新增 server-owned 结构。初期建议保存在 JSON `worldState` 的安全 projection 中；若后续拆 SQLite 表，只能作为派生索引。

### `studyProfileView`

用于读书画像和老师建议，最早由 S68.2 落地：

```javascript
{
  schemaVersion: 1,
  strengths: [],
  weaknesses: [],
  dimensions: {
    classicsFoundation: 0,
    eightLeggedForm: 0,
    policyInsight: 0,
    historicalAllusion: 0,
    legalJudgment: 0,
    calligraphyCopying: 0,
    examEndurance: 0
  },
  teacherAdvice: [],
  recentExercises: [],
  nextPlan: null
}
```

AI 老师只能提交 `study.propose_plan` 或 `teacher.propose_feedback` 这类建议；服务器决定属性变化、疲劳、金钱、关系和保结资格。

### `examProcedureView`

用于展示报名、保结、搜检、号舍、弥封、誊录、对读、磨勘和复核：

```javascript
{
  schemaVersion: 1,
  level: "provincial_exam",
  subStage: "session_1",
  phase: "room_review",
  phaseLabel: "房官初阅",
  sessionIndex: 1,
  sessionCount: 3,
  paperType: "经义制艺",
  sponsorship: { status: "accepted", publicSummary: "" },
  entrySearch: { status: "clear", publicSummary: "" },
  cell: { status: "assigned", publicSummary: "" },
  rollLifecycle: { sealed: true, transcribed: true, collated: false },
  incidents: [],
  auditFlags: [],
  visibleNextActions: []
}
```

该 view 不暴露弥封映射、考官私心、保人 hidden notes、raw AI proposal 或 raw audit。

### `examinerPanelView`

用于多考官评卷的可见摘要：

```javascript
{
  schemaVersion: 1,
  roomReviews: [],
  chiefReview: null,
  auditReview: null,
  scoreInputs: [],
  disputeSummary: "",
  serverDecision: ""
}
```

房官、同考官、主考官和 critic AI 的输出只能作为 `scoreInputs` 和 `disputeSummary`，不能成为榜单事实。

### `examHonorView`

用于名次和荣誉：

```javascript
{
  schemaVersion: 1,
  honors: [
    { level: "provincial_exam", title: "解元", rankLabel: "乡试第一名", year: 1644, place: 1 }
  ],
  latestHonor: null,
  currentAchievement: null,
  publicSummary: ""
}
```

S69.1 已落地 `worldState.examHonorLedger`、`examHonorView` 和安全 `examHistory[].examHonor` 快照。解元、会元、状元、榜眼、探花、传胪、二甲/三甲次序和三元记录必须由服务器从 canonical ranking 生成；provider `ranking`、`virtual_candidates`、`examiner_reviews`、皇帝/吏部 proposal 或普通 `statePatch` 都不能授予荣誉、改甲第或写官职。

### `examNetwork`

用于同年、座师、房官、主考和读卷官公开关系快照：

```javascript
{
  schemaVersion: 1,
  level: "provincial_exam",
  examName: "乡试",
  sameYearContacts: [],
  examinerContacts: [],
  publicSummary: ""
}
```

S69.2 已落地 `examNetworks` resolver 和安全 `examHistory[].examNetwork` 快照。服务器只从 canonical ranking、公开荣誉、脱敏 `examinerPanelView` 和考试历史安全字段派生可见同年/座师/考官关系，并写入 `relationshipView` / `worldPeopleView` / `eventArchiveView`；模型原始建议、弥封身份映射、考官 hidden intent、保结密注、raw audit 或 provider-only payload 不能成为关系事实。

### `appointmentTrackView`

用于殿试后馆选、庶吉士、观政、铨选、外放和候缺：

```javascript
{
  schemaVersion: 1,
  records: [],
  latestDecision: {
    trackLabel: "二甲馆选庶吉士",
    officeTitle: "翰林院庶吉士"
  },
  latestTrack: {
    examName: "殿试",
    palaceRank: "二甲",
    palacePlace: 12,
    trackLabel: "二甲馆选庶吉士"
  },
  publicSummary: ""
}
```

S69.3 已落地 `appointmentTracks` resolver 和安全 `examHistory[].appointmentTrack` 快照。服务器在殿试通过后结合 canonical 甲第、榜次、科名荣誉、公开同年座师摘要、官缺 projection、公开籍贯回避和声望，区分一甲翰林修撰/编修、二甲馆选庶吉士/观政/部属、三甲铨选外放/部属候补/候缺，并写入真实 `player.officeTitle`、`officialCareer.currentPosting` 与“初授”履历。当前 `ministryProposal` / `emperorSignal` 是服务器合成的公开用人倾向摘要；未来若接入吏部或皇帝 AI actor，也仍只能提交 proposal-only 任用倾向，模型原始建议、官缺以外的幻想职位、绕过回避或直接改 `officeTitle` 的内容不能成为任免事实。

## 7. 配置草案

后续涉及阈值、概率、数量、文字上限和权重时，不得散落 magic numbers。建议新增或集中到领域配置，例如 `src/game/imperialExamConfig.js`：

```javascript
{
  version: 1,
  procedure: {
    childExamStages: ["county_exam", "prefectural_exam", "academy_exam"],
    threeSessionLevels: ["provincial_exam", "metropolitan_exam"],
    maxVisibleIncidents: 6,
    maxVisibleReviews: 8
  },
  sponsorship: {
    minTeacherReputationByLevel: {},
    relationshipDebtRange: [1, 12]
  },
  searchAndFraud: {
    baseContrabandRisk: 0,
    severePenaltyReputationLoss: 12
  },
  rollLifecycle: {
    transcriptionErrorChance: 0,
    collationCorrectionChance: 0
  },
  grading: {
    roomReviewWeight: 0,
    chiefReviewWeight: 0,
    auditPenaltyWeight: 0
  },
  honors: {
    provincialFirst: "解元",
    metropolitanFirst: "会元",
    palaceTopThree: ["状元", "榜眼", "探花"]
  },
  appointment: {
    hanlinPreferredRanks: [],
    avoidanceDistanceRules: []
  }
}
```

具体默认值应在实现步骤中用测试固定；S68.1 不引入运行时配置。

## 8. AI Actor 权限

AI 是科举世界的角色智能和叙事引擎，不是裁判。后续 provider prompt、tool envelope 或内部 `game_ai_tools` 都必须遵守下表。

| Actor | 可读范围 | 可输出 | 不可做 |
| --- | --- | --- | --- |
| 老师 | 玩家可见读书画像、历史文卷弱点、关系摘要 | 读书计划、批改、小题、荐书、是否愿意作保的建议 | 直接增加功名、凭空创造真实官场关系 |
| 保人/士绅 | 玩家公开声望、老师关系、保结摘要 | 保结态度、人情债、风险提示 | 绕过服务器资格和连坐裁决 |
| 礼房/科场吏役 | 报名与入场公开状态 | 点名、搜检、号舍叙事和疑点 proposal | 直接判定夹带成立或处罚 |
| 同年/同窗 | 可见竞争者、公开关系、同场结果 | 互助、竞争、嫉妒、祝贺、传闻 | 读取 hidden 分数、考官意图或弥封映射 |
| 房官/同考官 | 脱敏 `reviewCopy`、题型要求、取中尺度摘要 | 初评、批语、推荐等级、疑点 | 直接定榜、直接授名次 |
| 主考官 | 脱敏争议卷、房官摘要、名额约束摘要 | 复看意见、前列争议、取舍理由 | 绕过服务器 ranking resolver |
| 磨勘/critic | 脱敏卷件、local authenticity 摘要、异常线索 | 反作弊疑点、错录疑点、风险标签 | 决定最终处分或公开 hidden |
| 皇帝 | 殿试可见答卷摘要、公开履历、朝局摘要 | 殿试问策、用人偏好、前列评价 | 直接写 `player.officeTitle` 或任免事实 |
| 吏部/礼部 | 甲第、公开履历、官缺安全 projection | 授官/馆选/观政/外放 proposal | 绕过官缺、回避、甲第和服务器任免 |
| narrator | 服务器已裁决的公开结果和可见传闻 | 玩家叙事、师友反应、榜后气氛 | 把 proposal 伪装成已经发生事实 |

AI 输出必须是严格 JSON 或工具 proposal，落地前经过 schema、身份权限、可见性、白名单、clamp、resolver 和审计。模型多数意见一致也不能绕过服务器规则。

## 9. 服务器裁决边界

这些事项永远归服务器所有：

- 考试资格、下一场考试、考期窗口、盘费、保结是否成立。
- 搜检、夹带、冒名、冒籍、代笔、照抄、现代词和严重舞弊处分。
- scene-local time、phase 推进、交卷状态、防重复提交。
- 弥封身份映射、誊录误差、对读纠错、磨勘复核。
- 分数扣罚、综合评分、名额、canonical ranking、解元/会元/状元/榜眼/探花/传胪和甲第。
- `player.examRank`、`player.palaceRank`、`player.role`、`player.officeTitle`、`officialCareer`、`officialPostings` 和入仕字段写入。
- 关系账本、事件档案、审计、存档 revision、JSON/SQLite 持久化。
- hidden 信息过滤、prompt cap、浏览器 view 生成。

AI 可以影响这些裁决的输入，例如题目、批语、评分建议、风险标签、老师建议或授官 proposal，但不能自己写入结果。

## 10. Mock 与 Provider 降级

Mock/no-key 路径必须覆盖完整制度链：

- 生成每级考试题目，并能在内部阶段自动给出低风险的保结、搜检、号舍和弥封摘要。
- 生成确定性的老师建议、科场事件、考官批语、榜后反应和授官 proposal。
- 保持完整四级通关 smoke 可用，不要求真实 provider key。
- 对作弊样例、现代词、短文、照抄和代笔风险继续使用本地复核优先。

真实 provider：

- `exam_question` 只生成题面和展示性要求，不决定资格、通过或名次。
- `exam_grading` 只生成五维评分和反馈，`virtual_candidates` 与 `ranking` 必须继续由服务器忽略或重建。
- 后续多考官 provider 只提交 reviewer proposal；服务器合成最终分数和榜单。
- provider schema 失败时不得落盘；真实 provider smoke 和 no-key skip 必须分层验证。

## 11. 审计与事件档案

新增科举深化行为时，应优先写入服务器审计摘要，再由安全 view / event archive 投影给玩家。

建议审计类型：

- `exam_procedure_event`：保结、报名、搜检、号舍、阶段推进。
- `exam_roll_event`：弥封、誊录、对读、卷面污损、迟交。
- `exam_review_proposal`：房官、同考官、主考官、critic 的建议摘要。
- `exam_audit_result`：本地反作弊、磨勘和复核结论。
- `exam_ranking_result`：服务器榜单、取中、落第、甲第。
- `exam_honor_awarded`：解元、会元、状元、榜眼、探花、传胪、三元。
- `appointment_proposal` / `appointment_result`：吏部/皇帝 proposal 与服务器授官结果。

审计记录不得保存密钥、完整 prompt、本地路径、raw hidden notes、弥封身份映射、考官 hidden intent 或未经脱敏的 provider 原文。浏览器事件档案仍只读 `eventArchiveView`。

## 12. 后续实现顺序

本文对应 S68.1。推荐后续仍按活动路线图推进：

1. S68.2：先做 `studyProfileView` 和学业计划，建立文卷弱点到读书建议的闭环。
2. S68.3：老师、书院、同窗和保结前置，关系变化走服务器账本。
3. S68.4：`examProcedureView`，把童试三关、乡试/会试三场和科场行政阶段接入 scene-local time。
4. S68.5：科场事件、多考官阅卷、房官/主考/critic proposal 与服务器 ranking resolver。
5. S69.1：榜单、名次荣誉和三元成就（已实现 `examHonors` / `examHonorView`）。
6. S69.2：同年、座师和考官网络进入可见关系与事件档案（已实现 `examNetworks` / `examHistory[].examNetwork`）。
7. S69.3：馆选、庶吉士、观政、铨选、外放、候缺和籍贯回避（已实现 `appointmentTracks` / `appointmentTrackView` / `examHistory[].appointmentTrack`）。
8. S69.4：浏览器科举档案面板，只读 route view。
9. S69.5：Mock/provider smoke、越权红队和 hidden-token 验收。

## 13. 红队验收清单

后续实现每新增一层科举能力，都要至少覆盖相应红队：

- AI 题面夹带 `statePatch`、榜单、授官或 hidden 信息，必须拒绝。
- 老师 AI 直接授予名位、官职、真实关系或保结成功，必须拒绝或改为 proposal。
- 保人 proposal 绕过资格、盘费、考期或声望门槛，必须拒绝。
- 玩家用贿赂、夹带、冒名、冒籍、代笔、现代词、照抄绕过科举，必须进入服务器舞弊流程。
- 搜检、弥封、誊录、对读、磨勘阶段不得向 AI 或玩家泄漏姓名映射、考官 hidden intent、raw notes。
- 房官或主考 AI 把玩家定为解元、会元、状元，服务器 ranking 不支持时必须以服务器榜单为准。
- provider `virtual_candidates` 或 `ranking` 继续不得成为 canonical ranking。
- AI 评分放过本地严重作弊时，本地复核必须扣分或处分。
- 授官 proposal 绕过官缺、籍贯回避、甲第、殿试名次或服务器任免时，必须拒绝或降级为传闻/待铨。
- 浏览器科举面板不得扫描 raw `worldState`、raw audit、raw SQLite table、prompt 或 provider proposal。
- JSON/SQLite 模式下科举 view、事件档案和 prompt 检索摘要必须保持安全等价。

## 14. 暂不纳入

S68.1 不处理这些事项：

- 远程存档、账号体系、多人科场、云端榜单或托管数据库。
- 百科级复刻各朝所有科举细则、三年大比的完整真实年份推演。
- 真实 hidden NPC 私档、考官私下受贿链和密档卷件数据库。
- 让 AI 执行 SQL、直接写 `worldState`、写审计表、写业务表或执行任免。
- 替换现有四级 API 为全新的考试 route；外层兼容必须先保持。

后续若确需突破这些边界，必须先更新本契约、AI 控制矩阵、开发 brief、共享上下文和对应验收。
