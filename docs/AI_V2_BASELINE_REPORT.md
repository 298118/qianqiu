# 《千秋》AI 编排 v2 基线报告

生成日期：2026-05-28。  
对应步骤：S92.1 / AI v2 Ticket 0。  
路线图入口：[AI_ORCHESTRATION_V2_ROADMAP.md](AI_ORCHESTRATION_V2_ROADMAP.md)。

本报告记录 AI 编排 v2 改造前的结构基线。它不改变运行时 AI 行为，不替换旧 provider facade，不接入新的 tool loop，不新增模型权限，也不改变 prompt、schema、API、存档、SQLite、浏览器 UI 或服务器裁决。

## 1. 基线工具

- 新增 `scripts/aiBaselineSnapshot.js`。
- 新增 `npm run ai:baseline`，默认写出 `artifacts/ai-baseline/latest.json`。
- `artifacts/` 已被 `.gitignore` 忽略；artifact 可本地重建，不作为仓库事实源。
- baseline snapshot 的 schema version 为 `s92.1-ai-baseline.v1`。
- `npm run eval:ai` 仍运行原有本地 AI eval，并额外写出 `artifacts/ai-eval/latest.json` 的安全摘要 artifact。

## 2. 结构摘要

当前 AI 编排基线包括：

- Prompt pack：18 个，覆盖开局、普通回合、六类身份/场景、科举出题/评卷、快捷建议、专题草稿、NPC、交易、委派和囊箧说明。
- AI output schema：13 个，继续由 Ajv runtime 校验。
- Model task route：18 类任务，`critic` 与 `safety_gate` 仍为 review-only。
- 默认 fallback：Mock provider 继续是 no-key 本地可玩和 CI deterministic 安全网。
- Game AI tools：12 个 model-visible 工具定义，其中 read 1 个、proposal 7 个、request-adjudication 4 个；所有 resolver 继续 server-owned，baseline 只输出 resolver kind 与安全布尔，不输出内部 `server.*` resolver 名称。
- Provider 能力摘要：只记录 provider 名称、结构化输出/streaming/tool 支持口径、credential 是否配置的布尔和 endpoint override 是否配置的布尔；不记录 key、base URL、raw request、raw response 或模型输出。

## 3. 安全边界

baseline 与 eval artifact 必须过滤或避免：

- API key、Token Plan key、base URL、本地路径、`file://`、`data/sessions`。
- raw prompt、raw provider payload、raw audit、raw table、raw SQLite row。
- `worldState`、`world_state_json`、`ai_change_proposals`、`event_log`。
- hidden notes、hidden intent、hidden raw rows。
- 内部 `server.*` resolver 名称。

`test/aiBaselineSnapshot.test.js` 覆盖以上边界，并验证本地伪造 key、base URL 与路径不会进入 snapshot。

## 4. 验证入口

本步骤的聚焦验证：

```bash
npm run ai:baseline
node --test test/aiBaselineSnapshot.test.js
node --test test/aiEvaluationRunner.test.js test/aiBaselineSnapshot.test.js
npm run eval:ai
npm run typecheck:server
```

治理与最终提交前验证继续使用：

```bash
npm run check:docs-governance
git diff --check
npm test
```

## 5. 后续建议

下一步建议按路线图进入 S92.2 / Ticket 1：新增 AI Task Runtime 骨架，先保持旧 provider facade 与默认运行路径不变，只让 Mock-only 或 test-only 的 opening / quick_action / topic_draft 任务通过 runtime skeleton 运行，并从第一步起接入 redacted trace、budget、fallback 与 Ajv 校验。
