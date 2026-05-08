# 《千秋》S54-S59 本地数据库业务表归档

归档日期：2026-05-08。

本文件压缩 S54-S59 已完成的本地 SQLite 业务表与双模式验收工作，供后续追溯。当前活动路线图已转入 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md) 的 S60+ “超大动态世界数据库内容充实”专项；稳定开发治理仍以 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 为锚点。

## 1. 归档范围

S54-S59 完成的核心成果是：在默认 JSON/Mock 可玩路径不变的前提下，把已经稳定的地理、人物、官职任所、事件档案和 prompt 检索 projection 拆成可选本地 SQLite 派生表，并补齐导入、修复、脱敏导出、浏览器 parity 和双模式整体验收。

已完成切片：

- S54：天下地理 `geo_*` 业务表、读档单向修复、导入/修复/导出工具、JSON/SQLite route/prompt/browser parity。
- S55：人物、家族、资产、田产、关系 `people_*` 可见 bridge 行持久化；人物事件审计与 `people_*.last_event_id` 本地关联。
- S56：官署、官职、辖区、任所、考成、迁转 `office_*` 安全 projection 行持久化；内容指纹和 hidden 引用污染修复。
- S57：安全事件档案分页 projection、SQLite `event_archive_index`、本地审计到公开事件 projection 工具。
- S58：SQLite `prompt_retrieval_index` 安全检索来源，以及浏览器“局势簿” JSON/SQLite parity smoke。
- S59.1：`smoke:dual-mode` 双模式整体验收入口，串联完整 Mock 主线、局势簿 parity、导入/修复/导出、审计公开 projection、派生表计数和 hidden-token 防线。

## 2. 提交索引

| 步骤 | 摘要 | 提交 |
| --- | --- | --- |
| S54.1 | 地理 SQLite 业务表契约 | `6cb03a0` |
| S54.2 | 地理 SQLite 持久化 adapter | `5acf894` |
| S54.2 回填 | 记录 S54.2 提交哈希 | `b237385` |
| S54.3 | 地理导入、修复、导出与 parity 工具 | `54505b3` |
| S54.3 回填 | 记录 S54.3 提交哈希 | `77d0447` |
| S55.1 | 人物域 SQLite 表契约 | `b95086c` |
| S55.2 | `worldPeople` SQLite 持久化与桥接 parity | `0d18b5d` |
| S55.3 | 人物事件与审计关联 | `c5d0e6d` |
| S56.1 | 官职任所 SQLite 表契约 | `e8c0d2d` |
| S56.2 | 官职任所 SQLite 持久化 | `d7b0a26` |
| S56.3 | 官职任所内容 hash 与引用修复 | `cbac99c` |
| S57.1 | 安全事件索引与事件档案分页 | `acfe9c1` |
| S57.2 | 审计到公开事件 projection 工具 | `84e1fcc` |
| S58.1 | SQLite prompt 安全检索索引 | `2a664eb` |
| S58.2 | 浏览器局势簿双模式 parity smoke | `e12d5f0` |
| S59.1 | JSON/SQLite 双模式整体验收 | `4b0d0a2` |

## 3. 稳定边界

S54-S59 没有改变这些安全边界：

- 默认存储仍是 JSON；Mock AI 默认完整可玩。
- SQLite 仅是本地单机增强，不代表远程存档、账号体系、多人同步、云冲突解决或托管数据库。
- `world_sessions.world_state_json` 仍是 SQLite 模式下派生表修复来源；业务表不是 route state、prompt、浏览器或服务器裁决的 raw truth source。
- AI 不能执行 SQL，不能直接写 `geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index`、`event_log` 或 `ai_change_proposals`。
- 浏览器与 prompt 只读服务器生成的 `worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`eventArchiveView` 和 capped retrieval summary。
- raw audit、provider proposal、完整 prompt、本地路径、密钥、hidden notes、hidden intent、未公开关系、未公开任所和 hidden raw rows 不进入玩家 payload。
- 服务器继续拥有时间推进、科举晋级、作弊处罚、官职任免、长期事件、世界实体、世界议程、schema、白名单、clamp、可见性过滤和持久化事务。

## 4. 代表性验证

S54-S59 期间常用验证集合包括：

- `npm test`
- `npm run check:docs-governance`
- `npm run smoke:browser -- --information-parity`
- `npm run smoke:dual-mode`
- `npm run smoke:dual-mode -- --storage-only`
- `node --test test/sessionStoreAdapterContract.test.js`
- `node --test test/sqliteGeographyTool.test.js test/auditEventArchiveTool.test.js test/sqlitePromptRetrieval.test.js test/dualModeAcceptanceScript.test.js`

归档时再次确认过的 focused 数据库套件：

```bash
node --test test/sessionStoreAdapterContract.test.js test/sqlitePromptRetrieval.test.js test/dualModeAcceptanceScript.test.js test/sqliteGeographyTool.test.js test/auditEventArchiveTool.test.js
```

结果：66 tests pass。

## 5. 为什么还需要 S60+ 内容充实

当前“超大动态世界数据库”的内容充实度约 55-65%。S54-S59 已经让本地 SQLite 底座、派生表、索引、修复和验收可用，但世界内容仍偏“可见 projection + 少量实例化账本”，还没有真正达到大型历史沙盘所需的密度。

主要缺口：

- 国家与邻国：已有地理/边面框架，但缺少多国财政、军事、外交、国威、继承风险、情报可信度和历史事件链的规模化内容。
- 城市与区域：已有城市/辖区行，但缺少全国与邻国城市的税粮、市价、士绅、诉讼、水利、灾害、驿路、驻军、书院、商帮等长期指标。
- NPC 与家族：已有可见 bridge 与关系事件，但还不是数百到数千 NPC 的家族谱系、资产流、婚姻、迁居、升迁、死亡、门生故旧和隐藏动机系统。
- 官职生态：已有官职任所 projection，但缺少空缺池、候补池、上级下属、吏员幕友、考成档案、任期轮转和地方事务负载。
- 事件与记录：已有安全事件索引，但还缺少可组合事件模板、地区事件链、跨域因果、传闻/情报可信度和长期档案生成机制。
- Prompt 检索：已有安全索引，但还缺少大规模数据下的排序、预算、分页、角色视野、情报置信和性能验收。

S60+ 因此应聚焦“内容生成、演化规则、可见性与规模验收”，而不是继续先扩远程、账号或多人功能。

## 6. 接手提示

后续实施 S60+ 时，建议保持这个顺序：

1. 先补内容契约、规模预算和安全验收 fixture。
2. 再分批扩国家/城市/NPC/官职/事件/情报内容。
3. 每次只让服务器 helper 生成或接受受限 proposal，并通过现有 SQLite adapter 同步安全 projection。
4. 不把 hidden 私档塞回当前 raw route `worldState`；如确需保存完整 hidden 私档，先设计 API redaction 与玩家 payload 分层。
