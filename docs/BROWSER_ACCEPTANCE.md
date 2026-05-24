# Browser Acceptance Record

This document records the repeatable browser acceptance surface for Qianqiu. It complements the human checklist in [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md), which remains the fallback for long playthroughs, role variety, and subjective visual review.

## How To Run

Use Mock mode unless the task is specifically about a real provider:

```powershell
npm run smoke:browser
npm run smoke:browser -- --url http://localhost:3000
npm run smoke:browser -- --screenshots artifacts/browser-smoke
npm run smoke:browser:visual
npm run smoke:dual-mode -- --storage-only
```

S74 起 `npm run smoke:browser` 指向 React 默认入口 smoke，参数只覆盖 client 验收：`--url`、`--browser`、`--screenshots`、`--headed`。无 `--url` 时脚本会显式固定 `AI_PROVIDER=mock`，不继承本机 `.env` 的真实 provider。The smoke uses `playwright-core` with an installed Chrome or Edge executable. If the browser is not in a standard location, set `BROWSER_EXECUTABLE_PATH` or pass `--browser <path>`. Screenshots are validated in memory by default; `--screenshots <dir>` also writes the checked PNG files. S89.2 起 `npm run smoke:browser:visual` 是产品视觉矩阵便捷入口，会把同一 smoke 的关键桌面/移动截图写到 `artifacts/browser-visual-matrix`，并要求首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、设置和移动端印匣均有截图覆盖。S89.3 起，settings 截图覆盖的是可刷新目录页；真正设置操作仍从右上角唯一印匣抽屉进入。`artifacts/` is ignored by Git. JSON/SQLite parity and no-browser storage checks now belong to `npm run smoke:dual-mode` / `npm run smoke:dual-mode -- --storage-only`; the old `scripts/browserSmoke.js` remains as migration reference under `npm run smoke:browser:legacy` and is not the default frontend acceptance path.

## Automated Coverage

`scripts/clientSmoke.js` currently verifies the S74 React default entry:

| Area | Automated checks |
| --- | --- |
| React default boot | Builds/serves `dist/client`, loads `/`, confirms the React Data Router entry, Vite client assets, no legacy start form, no hidden/raw text, and no horizontal overflow. |
| Mock opening flow | Uses the real home form to start a Mock scholar session, verifies the URL carries a runnable UUID session id, checks top/session navigation points to the current session rather than `s74-preview`, and requires exactly one visible right-top 印匣 button instead of a duplicate session settings link. |
| Route recovery | Opens and reloads `/game/:sessionId/map`, `/people`, `/inventory`, `/archive`, `/exam`, `/ranking`, `/court`, and `/settings`; map recovery requires a non-empty PixiJS canvas and safe labels. |
| Asset and safety checks | Verifies people page portrait pagination remains manifest-backed and lazy, monitors requests for unsafe `/api/game/state/*` or `/api/dev/*`, checks `/api/health`, mobile home layout, screenshots, and hidden/raw/key/path non-leakage. |
| S89.2 visual matrix | Requires named desktop/mobile screenshot coverage for home, main卷, map, people, inventory, archive, exam, ranking, court/topic surfaces, settings and mobile inkbox; checks inventory sections and the home seal typography so current browser fonts do not render the start seal as tofu squares. |
| S89.3 entry and wording canaries | Verifies `/game/:sessionId/settings` is a `.settingsDirectoryRoute` with four directory cards, no inline `.aiSettingsPanel`, and a top-right inkbox button; topic surfaces must say “卷宗取材” and “回批口径” and must not expose `数据来源`、`裁决边界`、`服务器裁决`、`draftContext`、`schema`、`manifest` 等玩家可见工程词。 |

`scripts/browserSmoke.js` is the legacy pre-React smoke reference and historically verified:

| Area | Automated checks |
| --- | --- |
| Local boot | Starts a temporary Mock-mode server unless `--url` is supplied, waits for `/api/health`, and loads `/`. |
| AI connection panel | Optional with `--check-ai-connection`: clicks `#ai-test-button`, requires `#ai-test-result[data-ok="true"]`, model/config details, no API-key/session-path text leaks, no `qianqiu.sessionId` write, and no transition into the game action area. |
| Opening flow | Confirms the start form exposes every supported role, creates a scholar session through the real form, and verifies `qianqiu.sessionId` in localStorage. |
| Session restore | Reloads the page, opens a fresh page in the same browser context, confirms the game view restores, checks `GET /api/game/state/:sessionId`, and verifies the start-page save list can load the same session from a clean browser context. |
| Save list UI | Checks the in-game `#save-list-modal` and start-page `#save-list-panel` from `GET /api/game/saves`, expected save ids, raw storage token non-leakage, visible 年月旬 metadata, and save-list horizontal overflow. |
| Failed SSE rollback | Mocks a browser `text/event-stream` response that emits a `narrative_chunk` followed by `error`, then confirms the uncommitted streamed text is removed while the error remains visible. |
| Desktop layout | Checks status strip, role panel, narrative area, and action input surface for visibility, overlap, horizontal overflow, game-panel width/share, role-panel clipping, and status-strip 年月旬 labels. |
| Relationship panel | Checks visible contact/faction rows from `relationshipView`, field completeness, hidden id/text non-leakage, relationship-panel overflow, and a Mock scholar turn updating the mentor relationship. |
| Active request panel | Checks the server-scheduled `activeNpcRequestView` panel, target id/type/kind/status attributes, required ask/stakes/due/hint fields, hidden target/text non-leakage, and active-request overflow. |
| Official career panel | Checks direct official start, the server-owned `officialCareerView` panel, 官署/差事/考成/关系/风险 sections, deterministic first appointment, a Mock `relief` assignment, hidden-note non-leakage tokens, current outcome fields, stable `data-*` attributes, and official-career overflow on desktop/mobile. |
| Information panels | Checks `#information-panel` tab shell, required child panels, route-view readiness, S53.4 天下/任所 detail cards, S53.5 人物/官职 detail cards, S53.6 事件档案 detail cards, role-visible geography boundaries, hidden-token non-leakage, tab switching, and information-panel/grid overflow. |
| Information parity | With `--information-parity`, starts JSON and SQLite Mock servers, performs the same official-assignment journey, compares normalized 局势簿 DOM snapshots, route view counts, and paged `eventArchiveView` metadata, and checks raw table/index/audit/prompt/path/key non-leakage plus desktop/mobile overflow. |
| Dual-mode integration | With `npm run smoke:dual-mode`, runs JSON full Mock browser smoke, SQLite full Mock browser smoke, information parity, and S59.1 storage/tooling acceptance. With `--storage-only`, verifies JSON -> SQLite dry-run/formal import, geography repair/export, audit projection, derived table counts, visible route/prompt parity, and hidden-token redaction without a browser. |
| Exam calendar panel | Checks the server-owned `examCalendarView` panel, next-level/status attributes, timing/funding/recommendation/quota details, current 年月旬 label, and calendar-panel overflow. |
| Exam rival panel | Checks persistent `examRivalView` cards after an exam, stable rival/status/level attributes, latest-result rows, and rival-panel overflow. |
| Role/world coupling | Opens direct magistrate, general, emperor, and minister sessions; runs one representative role action; checks `.role-world-event[data-role-world-kind]` feedback; and verifies the expected API state metric moves in the intended direction. |
| Exam progression | Opens and submits 童试, 乡试, 会试, and 殿试 through the real browser modal path, setting local Mock smoke readiness, legal calendar months, and `tenDayPeriod` only to keep the legal windows deterministic. Confirms each promotion, final `official` role, four exam-history records, cleared `activeExam`, and seeded office title. |
| Cheating sample | Starts an isolated scholar session, submits a copied-classic essay through the browser, and confirms the result shows `监试黜落` / `疑似照抄`, persists score `0`, keeps the player a scholar, and records `severeCheat=true`. |
| Exam modal | Opens each exam from the scholar panel, verifies question/requirements/writing controls, checks calendar timing details and 年月旬 labels in the requirements/scene status, fills deterministic essays, and submits them. |
| Result details | Checks score summary, player archive, calendar archive details with 年月旬 labels, result sections, highlighted ranking row, inspectable same-field candidate essays, persistent rival notes, and the final four-exam archive. |
| Mobile layout | Switches to a mobile viewport after the first exam and after palace promotion, checks the game/action surface, opens the exam archive, and verifies responsive result details for both the early and full-path archive states. |
| Direct official start | Opens an isolated browser context, starts as `official`, checks the official role panel/action placeholder, verifies all expected visible relationship factions are present, verifies the API-persisted role, then runs one official turn to verify first appointment. |
| Screenshots | Captures representative desktop and mobile states and validates each capture as a non-empty PNG. |
| Cleanup | Deletes the smoke-created session file when the journey finishes. |

## S53 Information Panels

S53.2 adds the planning contract in [BROWSER_INFORMATION_PANEL_PLAN.md](BROWSER_INFORMATION_PANEL_PLAN.md). No runtime browser UI changes are accepted in S53.2; the future smoke surface is recorded here so implementation slices do not widen data sources casually.

S53.3 adds the first runtime browser shell:

- `#information-panel` is a compact tab shell inside `#scholar-panel`.
- `public/app.js` caches `worldGeographyView`, `worldEntityView`, `worldPeopleView`, `officialPostingsView`, and the existing long-term/world-thread/official views from route payloads.
- `#event-archive-panel` is enabled after S53.6 and renders only server-built sanitized `eventArchiveView` rows as `.event-archive-item[data-event-id][data-source-type][data-status]`; S57.1 adds pagination metadata and SQLite safe-index backing without changing the browser data source. S58.2 adds stable pagination `data-*` on the panel and a JSON/SQLite parity smoke that proves the browser still reads route `eventArchiveView`, not raw SQLite indexes.
- S53.4 fills `#world-geography-panel` with `.world-geography-card[data-kind][data-entity-id]` cards for visible countries, cities, routes, frontier zones, and office jurisdictions.
- S53.4 fills `#posting-geography-panel` with `.posting-geography-card[data-kind][data-entity-id]` cards for current posting, visible city jurisdictions, local metrics, and related routes.
- S53.5 fills `#world-people-panel` with `.world-people-card[data-kind][data-entity-id]` cards for visible people, households, assets, estates, and relationships from `worldPeopleView`.
- S53.5 fills `#official-postings-panel` with `.official-posting-card[data-kind][data-entity-id]` cards for visible bureaus, offices, postings, assessments, and transfers from `officialPostingsView`.
- `scripts/browserSmoke.js` now checks the shell, route-view readiness, required S53.4/S53.5/S53.6 card kinds, role-visible geography boundaries, event archive source/status/pagination data attributes, tab switching, hidden-token non-leakage across the full information-panel DOM, and horizontal overflow for the panel plus active detail grids; `test/browserSmokeScript.test.js` covers the helper failures.

S53.6 closes the former future-content guard for `#event-archive-panel`: event archive acceptance now proves that the browser reads `eventArchiveView`, not raw `eventHistory`, JSON audit sidecars, SQLite audit tables, provider proposals, prompts, local paths, or keys.

## Latest Automated Result

Date: 2026-05-24

Relevant implementation: S89.3 React 设置入口、专题文案与错误空态收束。

Commands run during S89.3:

```powershell
node --check scripts/clientSmoke.js
npm run typecheck:client
npm run test:client
npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1
npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx --pool=vmThreads --fileParallelism=false --maxWorkers=1 --testNamePattern "keeps the settings route as a directory into one inkbox tool surface"
npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx --pool=vmThreads --fileParallelism=false --maxWorkers=1 --testNamePattern "opens registry-backed local surfaces"
npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx --pool=vmThreads --fileParallelism=false --maxWorkers=1 --testNamePattern "global AI settings"
node --test test/reactClientScaffold.test.js
npm run qa:runtime-manifest
npm run build:client
npm run budget:client
npm run smoke:browser:visual
npm run check:docs-governance
node --test test/documentationGovernance.test.js
git diff --check
```

Observed result:

- `npm run smoke:browser:visual` passed as the React product visual matrix. It built `dist/client`, forced Mock provider for the temporary server, opened `/`, started a scholar session through the real home form, verified active session navigation, reloaded map/people/inventory/archive/exam/ranking/court/settings routes, checked the PixiJS map canvas, portrait pagination, portrait viewer public profile sections, inventory summary/workbench/transfer/economy trace sections, single right-top inkbox entry, settings directory route, topic surface wording, home seal typography, and saved screenshots under `artifacts/browser-visual-matrix`.
- The smoke monitors React requests and fails if the default frontend touches unsafe `/api/game/state/*` or `/api/dev/*` paths. Ordinary browser restore remains on `GET /api/game/player-state/:sessionId`.
- On this machine `npm run test:client` still hit Vitest fork worker startup timeout: 4 files / 84 tests passed before `client/src/state/uiState.test.ts` and `client/src/api/qianqiuClient.test.ts` workers failed to start. `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` passed the same client suite with 6 files / 126 tests, and focused settings/surface/global AI runs passed.
- JSON/SQLite parity and legacy pre-React browser journeys are no longer part of default `smoke:browser`; use `npm run smoke:dual-mode` / `npm run smoke:dual-mode -- --storage-only` for database parity, and treat `npm run smoke:browser:legacy` as migration reference.

Historical note: S59.1 previously used the old `scripts/browserSmoke.js` journey for JSON/SQLite full browser parity. That record remains valid historically but no longer describes the current default browser smoke.

## Manual Fallback

Use [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md) for:

- Longer free-form scholar and official play beyond the automated four-exam happy path.
- Exam integrity variants beyond the automated copied-classic severe case: very short essays, modern/anachronistic terms, and suspected ghostwriting.
- Multi-turn role-loop checks for emperor, minister, general, magistrate, and post-palace official play.
- Subjective visual inspection of typography, historical tone, readability, and overall atmosphere.
- Real-provider browser behavior when API keys are configured.
- Cross-browser behavior outside the installed Chrome/Edge executable used by `smoke:browser`.

If the browser smoke cannot run because Chrome or Edge is unavailable, record the skip in `docs/SHARED_CONTEXT.md` and `docs/DEVELOPMENT_STEPS.md`, then run the manual checklist and the API/test gates instead.
