# 《千秋》开发历史实现笔记归档

本文件从 `docs/QIANQIU_DEVELOPMENT_BRIEF.md` 压缩迁出，保留 S11-S38.3 的历史实现笔记，供追溯旧决策、验收证据和迁移脉络使用。日常开发启动只需读取 brief 中的当前产品契约；需要调查旧阶段细节时再读取本归档。

## S11 Provider Integration Note (2026-05-05)

The first real-provider slice is implemented without changing the default local experience:

- `AI_PROVIDER=mock` remains the default and needs no API key.
- `AI_PROVIDER=openai` uses the OpenAI SDK Responses API with `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, and `OPENAI_MODEL`.
- `AI_PROVIDER=deepseek` uses the OpenAI SDK against `DEEPSEEK_BASE_URL` for OpenAI-compatible chat completions with `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL`. Task-specific overrides are supported through `DEEPSEEK_OPENING_MODEL`, `DEEPSEEK_TURN_MODEL`, `DEEPSEEK_EXAM_QUESTION_MODEL`, and `DEEPSEEK_GRADE_MODEL`; the recommended split is V4 Pro for opening/grading and V4 Flash for ordinary turn/question.
- `AI_PROVIDER=claude` and `AI_PROVIDER=anthropic` use `@anthropic-ai/sdk` Messages API with `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
- `AI_PROVIDER_TIMEOUT_MS` controls real provider request timeout and defaults to 30000.
- All real provider methods build prompts through `src/ai/prompts.js`, parse JSON through `src/utils/json.js`, validate through Ajv schemas in `src/ai/schemas.js`, retry once on call/parse/schema failure, and then fall back to Mock.
- Remote turn payloads may normalize display-only `attributeChanges` by dropping malformed rows before schema validation; authoritative `statePatch`, `relationshipChanges`, `examTrigger`, grading, promotion, and persistence rules remain strict.
- The server still owns patch whitelisting, numeric clamps, exam gates, promotion rules, anti-cheat penalties, candidate ranking, and persistence.

## S13 Quality Gate Note (2026-05-05)

The repository now has a dependency-free automated test entrypoint:

```bash
npm test
```

`npm test` uses Node.js' built-in `node --test` runner. The first suite covers server-owned state patch boundaries, numeric clamps, event-history trimming, JSON session persistence, AI JSON schemas, exam gates/readiness, promotion and severe-cheating consequences, local essay penalties, and virtual candidate ranking. Route-level tests that start temporary Express servers use `test-helpers/fetchSafeServer.js` so random OS ports do not land on Fetch's blocked-port list.

Manual end-to-end acceptance lives in `docs/MANUAL_ACCEPTANCE.md`. It should be used for the browser/API pass before phase-one acceptance, especially to verify the complete scholar -> official route and the emperor/minister/official role loops in Mock mode.

State patch boundary note: `statePatch.factions` is now merged only into existing numeric faction keys. Providers may adjust known faction scores but cannot introduce arbitrary faction names by replacing the full factions object. S31.2 further splits the patch boundary into provider-facing and server-owned keys: ordinary provider turn schemas reject `activeExam`, `characters`, `eventHistory`, `player.examRank`, and `player.examHistory`, and default `applyStatePatch()` ignores those fields if a non-schema provider returns them. Internal server code that needs calendar or exam-owned fields must opt in with `allowServerOwnedPatchKeys`.

## S14 Documentation And Phase-One Acceptance Note (2026-05-05)

Phase-one documentation is now split by purpose:

- `README.md` is the quick-start and project orientation entrypoint. It covers install, scripts, `.env` fields, provider switching, current playable scope, API overview, project structure, and handoff documents.
- `docs/ARCHITECTURE.md` is the current implementation map for developers. It records runtime shape, request flow, API contracts, AI provider contracts, state fields, state patch rules, exam rules, persistence, and verification expectations.
- `docs/MANUAL_ACCEPTANCE.md` remains the human/browser click-through checklist.
- `docs/PHASE_ONE_ACCEPTANCE.md` records the first automated Mock-mode phase-one acceptance pass.

The 2026-05-05 S14 acceptance pass verified `npm install`, `npm test`, static asset loading, health, the complete scholar -> official path, saved exam history, short/modern/copy exam integrity penalties, and emperor/minister/official role-loop smoke checks. It did not call real providers because no API keys are present, and it did not run screenshot/browser automation because Playwright is unavailable in this workspace.

## S21.1 World Tick Contract Note (2026-05-05)

Phase two starts with a server-owned world tick contract, recorded in `docs/WORLD_TICK_CONTRACT.md`.

The minimal contract is:

- Add a top-level `worldState.month` field in the implementation slice, defaulting to `1`.
- Advance one in-game month after each successful free-text turn; roll month 12 to 1 and increment `year`.
- Keep `turnCount` to one increment per player turn, even when provider changes and tick changes both apply.
- Let the server compute natural changes to treasury, grain reserve, population, public order, corruption, army morale, border threat, and existing numeric faction keys.
- Apply tick output through the same state whitelist and numeric clamp boundary as provider patches.
- Append short visible tick events after provider events, capped by the existing event-history limit.
- Do not let the tick alter exam rank, active exams, promotion fields, session identity, or the complete scholar -> official path.

S21.2 should implement `src/game/worldTick.js` as a pure module that returns `{ statePatch, attributeChanges, events, summary }`. S21.3 should wire that result into `/api/game/turn`, and S21.4 should add automated coverage for month/year rollover, clamps, event trimming, Mock-mode stability, and the full scholar path.

## S21.2 World Tick Module Note (2026-05-05)

`src/game/worldTick.js` now implements the minimal server-owned monthly tick as a pure module:

- `worldState.month` defaults to `1`.
- `runWorldTick(worldState)` returns `{ statePatch, attributeChanges, events, summary }` and does not mutate the input state.
- The tick advances one month, rolls month 12 to month 1 with `year + 1`, and computes deterministic natural changes for treasury, grain reserve, population, public order, corruption, army morale, border threat, and known numeric faction keys.
- Tick patches intentionally avoid player exam rank, active exams, exam history, promotion fields, session identity, role changes, scholar attributes, gold, and health.
- `src/game/stateRules.js` now whitelists/clamps `year` and `month`, and `applyStatePatch()` accepts `{ incrementTurnCount: false, allowServerOwnedPatchKeys: true }` for server-owned follow-up patches so S21.3 can integrate the tick without double-counting `turnCount`.
- Provider turn schemas and prompts do not allow models to patch `year` or `month`; models may read the compact calendar context, but calendar movement is reserved for server-owned code.

S21.3 connects the tick to `/api/game/turn`: provider output is applied first, exam-trigger state is prepared when requested, `runWorldTick()` runs against the updated state, and the tick patch is applied with `{ incrementTurnCount: false }`. Provider events are appended before tick events, and the route returns concise `worldTick` feedback through both JSON and SSE final payloads.

## S21.3 World Tick Route Integration Note (2026-05-05)

`POST /api/game/turn` now advances the server-owned world tick after every successful free-text turn:

- One player action still increments `worldState.turnCount` exactly once.
- `worldState.year/month` advance through the tick, not through provider output.
- Tick resource changes and faction drift pass through `src/game/stateRules.js` with normal whitelist/clamp protection.
- The response includes `worldTick: { summary, events, attributeChanges }`; the browser displays the current month in the status strip and appends short monthly feedback after the provider narrative.
- The complete scholar -> exam -> official path remains unchanged; exam submission/question routes still do not run a tick in the minimal S21 slice.

## S22.1 Relationship Ledger Note (2026-05-05)

S22.1 adds the first server-owned NPC/faction relationship ledger without changing provider authority:

- `worldState.relationshipLedger` records character and faction social memory: `stance`, `relationship`, `resentment`, `networkSource`, `recentIntent`, `visible`, and `lastUpdatedTurn`.
- `src/game/relationships.js` owns ledger creation, normalization, legacy-session backfill, and compact summaries.
- New sessions create ledger entries from current `characters` and existing numeric `factions`; game/exam routes backfill older JSON sessions through `ensureRelationshipLedger()`.
- Relationship values are clamped to `-100..100`; resentment is clamped to `0..100`; invented ledger ids are dropped.
- Providers still cannot patch `relationshipLedger`. The AI turn schema rejects it and `applyStatePatch()` ignores it.

## S22.2 Relationship Suggestion Note (2026-05-05)

S22.2 adds the controlled provider suggestion path while keeping the relationship ledger server-owned:

- Turn prompts now include a compact visible-only `relationshipLedger` summary so models can reason about known NPC/faction social context.
- Provider turn output may include top-level `relationshipChanges`; this is separate from `statePatch` and represents suggestions only.
- `relationshipChanges` entries must target an existing visible character or faction id and use bounded deltas: `relationshipDelta` in `-12..12`, `resentmentDelta` in `-10..10`.
- `src/game/relationships.js` applies suggestions through `applyRelationshipChanges()`, drops hidden/invented targets, caps text fields, updates `lastUpdatedTurn`, and normalizes the ledger before persistence.
- `/api/game/turn` returns the normalized applied changes as `relationshipChanges` in JSON and SSE payloads.
- S22.3 makes Mock produce concrete relationship suggestions for scholar, emperor, minister, and official turns through the same path. S23.1 extends the same suggestion path to local magistrate turns, and S23.2 extends it to general turns. Mock classifies the resolved action from its own patch output, targets only visible ledger entries, and still relies on the route to call `applyRelationshipChanges()` before persistence.
- The browser narrative now appends concise `[人脉]` feedback for applied relationship changes.

## S23.1 Local Magistrate Note (2026-05-05)

S23.1 adds a dedicated local magistrate loop while keeping the server-owned state boundary unchanged:

- Magistrate sessions now seed `player.countyName`, `localTreasury`, `localOrder`, `gentryRelations`, `banditPressure`, `pendingLawsuits`, `corveeBurden`, and `waterworks`.
- These local fields are included in turn prompts, AI turn schemas, and `applyStatePatch()` whitelist/clamp rules. Numeric local fields are server-clamped; provider output still cannot change role, promotion fields, active exams, or relationship ledger state directly.
- Mock magistrate turns recognize case hearings, money/grain work, gentry mediation, anti-bandit policing, corvee labor, and waterworks. They may update local county meters and modest global fields such as public order, treasury, grain reserve, population, corruption, and existing numeric factions.
- Magistrate relationship reactions use the existing top-level `relationshipChanges` suggestion path and are persisted only by the route-owned `applyRelationshipChanges()` merge.
- The browser role panel now renders magistrate-specific local meters and action hints.

## S23.2 General Role Note (2026-05-05)

S23.2 adds a dedicated military command loop while keeping the server-owned state boundary unchanged:

- General sessions now seed `player.command`, `troops`, `supply`, `battleReputation`, `scouting`, and `campaignRisk`.
- These military fields are included in turn prompts, AI turn schemas, and `applyStatePatch()` whitelist/clamp rules. Numeric military fields are server-clamped, and promotion/exam/relationship-ledger authority remains server-owned.
- Mock general turns recognize recruitment, supply/pay work, drill, scouting, fortification, campaign action, and routine camp work. They may update local command meters and limited global fields such as treasury, grain reserve, army size, army morale, border threat, public order, and existing numeric factions.
- General relationship reactions use the existing top-level `relationshipChanges` suggestion path and are persisted only by the route-owned `applyRelationshipChanges()` merge.
- The browser role panel now renders general-specific status, action hints, military meters, troop/supply counts, and border pressure.

## S23.3 Official Role Note (2026-05-06)

S23.3 deepens the post-palace official loop while keeping ordinary turns inside the server-owned state boundary:

- Official sessions and palace-exam promotion now seed `player.superiorFavor`, `peerNetwork`, `performanceMerit`, `promotionProspect`, `impeachmentRisk`, and `cleanReputation`.
- These official career fields are included in turn prompts, AI turn schemas, and `applyStatePatch()` whitelist/clamp rules. Numeric official fields are server-clamped, and ordinary turns still cannot grant `officeTitle`, palace rank, role promotion, or relationship ledger state directly.
- Mock official turns now recognize assessment/promotion work, impeachment, observation under superiors, casework, relief/farming, peer networking, bribery, and routine office work. They may update official career meters and limited global fields such as corruption, public order, grain reserve, population, and existing numeric factions.
- Palace promotion appends a visible official superior contact while preserving the complete scholar -> official path; relationship reactions still use the top-level `relationshipChanges` suggestion path and are persisted only by the route-owned `applyRelationshipChanges()` merge.
- The browser role panel now renders official-specific status, action hints, and career meters for superiors, peers, merit, promotion, impeachment risk, and clean-name standing.

## S24 Exam Depth Note (2026-05-06)

S24 deepens the imperial examination loop while preserving the server-owned promotion and anti-cheat boundaries:

- Virtual same-field candidates now include inspectable essay profiles with title/body/excerpt/word count, style label, examiner comment, strengths, and weaknesses. Ranking remains server-built and still favors the player on score ties.
- Exam entry now has server-owned preparation cost and travel risk through `src/game/examTravel.js`. `/api/exam/question` applies level-specific cost and funded/shortfall effects through the normal state whitelist/clamp path with `{ incrementTurnCount: false }`, then stores `entryPreparation` on `activeExam`.
- `/api/exam/submit` preserves `entryPreparation` in `player.examHistory` and returns `examQuestion`, `essay`, and `entryPreparation` for immediate frontend rendering.
- The browser result modal now includes 本场案卷 and 同场文卷 sections, and panels show an 考试档案 button when historical exam records exist.
- The S24.1 candidate data slice was accidentally committed by a subagent as `80db3d2`; Codex reviewed it during S24 integration. Future subagents are explicitly forbidden from committing, pushing, or creating PRs.

## S25.1 Real-Provider Smoke Note (2026-05-06)

S25.1 adds an optional keyed smoke path without changing the default Mock experience:

- `npm run smoke:provider` runs `scripts/providerSmoke.js`.
- In default `AI_PROVIDER=mock` mode, the script auto-selects only real providers whose required key exists: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, or `ANTHROPIC_API_KEY`. If no real-provider keys are present, it skips successfully.
- `npm run smoke:provider -- --provider openai|deepseek|anthropic|claude|all` can target a specific provider; targeted real providers fail fast when their required key is missing.
- The smoke calls real provider factories directly instead of `getProvider()`, so Mock fallback cannot hide provider failures.
- The smoke verifies the provider-method equivalents of start, turn, question, and submit/grade. It validates provider JSON through the existing schemas, prints concise summaries, and does not start Express or write session files.
- `test/providerSmokeScript.test.js` covers provider aliasing, key-based selection, missing-key failure, and the no-key skip path without making network calls.

## S25.2 Real-Provider Streaming Note (2026-05-06)

S25.2 adds true turn token streaming for keyed real providers while preserving the server-owned state boundary:

- OpenAI uses Responses API `stream: true` and consumes `response.output_text.delta`.
- DeepSeek uses OpenAI-compatible chat completions with `stream: true` and consumes `choices[0].delta.content`.
- Anthropic/Claude uses Messages `client.messages.stream()` and consumes text or JSON deltas, while using the final parsed message when available for validation.
- `src/ai/providers/remoteHelpers.js` buffers the complete streamed JSON and validates it through the existing `turn` schema before returning.
- `src/routes/game.js` only streams visible `narrative_chunk` text by extracting the top-level `narrative` JSON string with `src/utils/streamingJson.js`; state patching, relationship changes, world tick, persistence, and `final_state` still wait for complete schema-valid JSON.
- Mock and unsupported providers keep the existing SSE compatibility path: generate the full turn first, then chunk the final narrative.
- `npm run smoke:provider -- --stream --provider openai|deepseek|anthropic|claude` optionally exercises the real-provider streaming path in keyed environments.
- If visible provider narrative has already been sent and the stream later fails validation, the route emits `error` and leaves the session unchanged rather than falling back to Mock with contradictory visible text.

## S25.3 AI Output Eval Fixture Note (2026-05-06)

S25.3 adds a no-network AI output fixture gate without changing default Mock playability:

- `npm run eval:ai` runs `test/aiEvalFixtures.test.js`.
- Fixtures live in `testdata/aiEvalFixtures.js` and cover valid provider-shaped opening, turn, exam-question, and grade payloads.
- The eval gate parses raw model-like text through `src/utils/json.js`, validates final payloads through `src/ai/schemas.js`, and applies focused checks for historical tone, unsafe JSON contracts, ordinary-turn authority risks, patch clamping, faction score safety, grade bounds, and local exam authenticity penalties.
- S25.3 intentionally keeps live provider calls out of `npm test`; keyed network checks remain in `npm run smoke:provider`.
- Provider faction patches now clamp existing faction scores to `0..100` while still dropping invented faction keys.

## S26.1 Browser Smoke Note (2026-05-06)

S26.1 introduces repeatable local browser acceptance without changing the default `npm start` flow:

- `npm run smoke:browser` runs `scripts/browserSmoke.js`.
- The script uses `playwright-core` with an installed Chrome or Edge executable. Developers can set `BROWSER_EXECUTABLE_PATH` or pass `--browser <path>` when the browser is installed outside standard platform paths.
- By default the smoke starts a temporary Mock-mode server on a free local port. `npm run smoke:browser -- --url http://localhost:3000` targets an already running server.
- The first S26.1 journey covers local page load, scholar opening flow through the real form, `qianqiu.sessionId` localStorage persistence, reload/fresh-page session restoration, API readability for the restored session, and cleanup of the smoke session file.
- Browser smoke remains outside `npm test` so the normal test suite stays no-browser and fast. S26.2 adds DOM and screenshot-level coverage for desktop/mobile layout, the exam modal, result details, and the action input surface.

## S26.2 UI Acceptance Note (2026-05-06)

S26.2 expands `npm run smoke:browser` from opening/restoration smoke into repeatable UI acceptance:

- The browser journey now uses fixed desktop and mobile viewports and checks that the status strip, role panel, narrative area, and action input surface do not overlap or overflow horizontally.
- The journey opens the scholar exam modal through the real panel button, fills and submits a Mock-mode child-exam essay, and verifies the result view contains the player archive, score sections, highlighted ranking row, and inspectable same-field candidate essays.
- The same saved session is then restored and checked on mobile; the historical exam archive is opened there to exercise responsive result-detail rendering.
- The smoke captures PNG screenshots for representative desktop/mobile states and validates them in memory. Passing `--screenshots <dir>` writes those artifacts for manual review; `artifacts/` is ignored by Git.
- This pass exposed and fixed a result-modal regression where `.exam-requirements` overrode the `hidden` attribute with `display: grid`, leaving the old question requirements visible behind the放榜/result view.

## S26.3 Browser Acceptance Documentation Note (2026-05-06)

S26.3 adds `docs/BROWSER_ACCEPTANCE.md` as the durable browser acceptance record:

- The document lists the automated `npm run smoke:browser` coverage, including local boot, scholar opening flow, session restoration, desktop/mobile layout checks, the exam modal, result details, the exam archive, screenshot validation, and cleanup.
- It records the latest S26.2 automated result from commit `434b3ef`, including the screenshot run, 87-test `npm test` pass, and the `.exam-requirements[hidden]` regression fixed during screenshot review.
- It keeps `docs/MANUAL_ACCEPTANCE.md` as the fallback for the complete scholar-to-official browser path, exam integrity variants, role-loop breadth, subjective visual inspection, real-provider browser behavior, and cross-browser checks.
- S26.3 verification also added `test-helpers/fetchSafeServer.js` after a full-suite run exposed an intermittent Node Fetch `bad port` failure when `app.listen(0)` selected a blocked port.

## S27.1 Phase-Two Acceptance Note (2026-05-06)

S27.1 records second-phase acceptance in `docs/PHASE_TWO_ACCEPTANCE.md`:

- The accepted local milestone includes server-owned world tick, relationship memory, magistrate/general/official identity depth, deeper exam competition/archive/travel, no-network AI eval fixtures, real-provider smoke/streaming readiness, and browser smoke/UI acceptance.
- Verified commands for this acceptance pass: `npm run eval:ai`, `npm run smoke:provider`, `npm test`, `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s27-1`, and `git diff --check`.
- Live real-provider calls remain unverified in this environment because no provider keys are configured; the provider smoke skipped successfully and keyed checks remain optional.
- The next phase should open a new roadmap instead of extending S27.1. Candidate directions are long-horizon simulation, relationship inspection UI, deeper official career outcomes, stronger role/world interactions, keyed provider acceptance, broader browser journeys, and storage migration planning.

## S30.1 Third-Phase Roadmap Note (2026-05-06)

S30.1 opens the third-phase active roadmap without changing development rules:

- `docs/PHASE_TWO_ROADMAP_ARCHIVE.md` freezes the completed second-phase roadmap.
- `docs/DEVELOPMENT_STEPS.md` now starts the third-phase active ledger at S30.
- Third-phase priorities start with layout and state-boundary hardening, then proceed to relationship visibility, active NPCs, long-horizon events, official career outcomes, exam calendarization, role/world coupling, keyed provider long-run acceptance, broader browser acceptance, and storage migration planning.
- The mandatory workflow, Git discipline, Mock-default requirement, provider-optional requirement, server-owned state/rules boundary, and complete scholar -> official path protection remain unchanged.

## S31.2 Ordinary Turn State Boundary Note (2026-05-06)

S31.2 hardens ordinary turn provider authority without changing Mock playability:

- Turn schemas and prompts no longer allow ordinary provider patches for `activeExam`, `characters`, `eventHistory`, `player.examRank`, or `player.examHistory`.
- Default `applyStatePatch()` uses a provider-facing whitelist and ignores those server-owned fields even if a non-schema provider returns them.
- Internal server follow-up patches can explicitly pass `allowServerOwnedPatchKeys: true`; the current route uses that for world tick calendar fields while still avoiding a second `turnCount` increment.
- Provider-visible events still enter history through `appendEvents()`, exam requests still use `examTrigger`, promotions and exam history remain owned by exam routes and `src/game/promotions.js`, and relationship state still flows through top-level `relationshipChanges`.

## S31.3 Start Role Boundary Note (2026-05-06)

S31.3 makes the start-role contract explicit:

- `src/game/initialState.js` exports the allowed role enum and rejects unsupported non-empty role values before state creation.
- `/api/game/start` now returns 400 for unknown roles instead of creating sessions with arbitrary `player.role` values.
- Missing or blank role input still defaults to `scholar` for compatibility with older clients.
- The browser start form now exposes `official` alongside `scholar`, `emperor`, `minister`, `general`, and `magistrate`; `scripts/browserSmoke.js` fails if any supported start role is missing from the form.

## S32.1 Relationship Inspection View Note (2026-05-06)

S32.1 defines the player-facing relationship/contact inspection contract without changing the server-owned ledger authority:

- `src/game/relationships.js` now exports `buildRelationshipInspectionView(worldState)`, a presentation-only view derived from the normalized `relationshipLedger`.
- Game and exam route payloads include top-level `relationshipView` beside `worldState` so S32.2 UI can render contacts and factions without reading the raw ledger directly.
- `relationshipView` includes visible contacts and factions, numeric relationship/resentment values, readable relationship and resentment bands, stance, network source, recent intent, and `lastUpdatedTurn`.
- Hidden ledger entries are omitted entirely: no hidden ids, names, exact counts, placeholder rows, faction labels, or hidden-entry notes are exposed through the view.
- The persisted `relationshipLedger` remains server-owned. Providers still cannot patch it directly; they can only suggest bounded top-level `relationshipChanges`.

## S32.2 Relationship UI Note (2026-05-06)

S32.2 turns the inspection contract into a browser surface without changing relationship authority:

- `public/app.js` renders a compact `人脉簿` panel from top-level `relationshipView` inside both scholar and non-scholar role panels.
- The browser panel shows visible characters and factions with relationship, resentment, stance, source, recent intent, and last-updated turn. It uses display localization for known default faction names and relationship text while preserving stable `data-contact-*` selectors for acceptance.
- Player-facing UI code should continue to consume `relationshipView`; the raw `worldState.relationshipLedger` remains available only as a compatibility/developer-inspection fallback.
- `scripts/browserSmoke.js` verifies relationship-panel presence on desktop, restored, fresh-page, mobile, and direct-official-start journeys; checks hidden id/text non-leakage; asserts a Mock scholar turn updates the mentor relationship; and catches relationship-panel horizontal overflow.

## S32.3 Active NPC Request Note (2026-05-06)

S32.3 adds the first server-owned active NPC/faction request loop without giving providers request authority:

- `worldState.activeNpcRequest` stores at most one active request. It is scheduled, normalized, resolved, expired, and cleared by `src/game/activeRequests.js`.
- Game and exam route payloads include top-level `activeNpcRequestView`; turn payloads also include `activeNpcRequestEvents`.
- Active requests target only visible relationship ledger entries. Hidden targets are omitted from the view, and invalid older request state is cleared rather than rendered.
- `/api/game/turn` applies provider state patches and provider relationship suggestions first, then runs active request handling, then world tick. Event history order is provider events, active-request events, and then world-tick events.
- Accept/refuse/expire outcomes use server-authored bounded `applyRelationshipChanges()` deltas, merged into the route `relationshipChanges` response. Provider output still cannot patch `activeNpcRequest` or `relationshipLedger`.
- `public/app.js` renders the compact `来函` panel from `activeNpcRequestView`, with stable `data-request-*` selectors. `scripts/browserSmoke.js` now verifies active request fields, hidden target/text non-leakage, and active-request panel overflow on desktop, restored, fresh-page, and mobile journeys.

## S33 Long-Term Event Scheduler Note (2026-05-06)

S33 adds a server-owned long-term event scheduler while keeping provider authority limited to narrative and ordinary turn suggestions:

- `worldState.longTermEvents` stores `{ schemaVersion, queue, cooldowns, recentResolved }`. It is normalized, scheduled, resolved, cooled down, and summarized by `src/game/longTermEvents.js`.
- The first deterministic event families are seasonal harvest audits, grain-shortage disasters, border alarms, court faction conflict, magistrate local case chains, social repercussions from refused/expired requests, and a disaster relief-audit follow-up.
- Game and exam route payloads include top-level `longTermEventView`; turn payloads also include `longTermEvents: { summary, events, attributeChanges, scheduled, resolved }`.
- `/api/game/turn` now runs active requests first, then world tick, then long-term events against the post-tick calendar. Event history order is provider events, active-request events, world-tick events, and long-term-event events.
- Scheduler state patches still pass through `applyStatePatch(..., { incrementTurnCount: false, allowServerOwnedPatchKeys: true })`, and scheduler social consequences pass through `applyRelationshipChanges()`. Providers cannot patch `longTermEvents` or `activeNpcRequest` in ordinary turns.
- `public/app.js` renders long-term event feedback as `[大势]` narrative lines. S33 intentionally does not add a separate long-term event panel.
- The durable contract is `docs/LONG_TERM_EVENTS_CONTRACT.md`; focused coverage lives in `test/longTermEvents.test.js` and `test/gameTurnLongTermEvents.test.js`.

## S34 Official Career Outcome Note (2026-05-06)

S34 adds a server-owned official career outcome engine while keeping ordinary provider authority limited to meters, narrative, and relationship suggestions:

- `worldState.officialCareer` stores `{ schemaVersion, tenureMonths, reviewCycleMonths, lastReviewTurn, lastReviewYear, currentPosting, careerHistory, pendingOutcome, cooldowns }`. It is normalized and summarized by `src/game/officialCareer.js`.
- Game and exam route payloads include top-level `officialCareerView`; turn payloads also include `officialCareer: { summary, events, attributeChanges, outcome }`.
- `/api/game/turn` runs official career settlement after active requests, world tick, and long-term events. Event history order is provider events, active-request events, world-tick events, long-term-event events, and official-career events.
- Settlement can trigger first real appointment, accelerated promotion review, annual/cycle review, or impeachment-risk review. Result types are `appointment`, `transfer`, `promotion`, `outpost`, `demotion`, `impeachment`, `punishment`, and `retention`.
- Providers may still affect `superiorFavor`, `peerNetwork`, `performanceMerit`, `promotionProspect`, `impeachmentRisk`, and `cleanReputation`, but they cannot patch `officialCareer`, `officeTitle`, `role`, `roleLabel`, `examRank`, `palaceRank`, or `examHistory` in ordinary turns.
- The browser renders a compact `官场履历` panel from `officialCareerView` for official players and appends `[官场结算]` narrative feedback after turn settlement.
- The durable contract is `docs/OFFICIAL_CAREER_CONTRACT.md`; focused coverage lives in `test/officialCareer.test.js`, `test/gameTurnOfficialCareer.test.js`, and browser smoke helper coverage.

## S35 Exam Calendar And Rival Note (2026-05-06)

S35 calendarizes the imperial examination path and turns same-field candidates into persistent social memory while preserving server-owned exam authority:

- `worldState.examCalendar` stores `{ schemaVersion, missedWindows, recentSessions, rivals, nextRivalNumber }`. It is normalized and summarized by `src/game/examCalendar.js`.
- Game and exam route payloads include top-level `examCalendarView` and `examRivalView`; exam question/submit payloads also include the current `examCalendar` snapshot.
- `/api/exam/question` still uses `canEnterExam()` first, then checks the current `year/month` against the exam window before charging travel or asking a provider for a question. Existing unanswered exams are reused without rechecking the current month. Free-text `examTrigger` requests preserve an open same-level calendar snapshot before world tick advances the month, so an auto-opened question remains valid when the player asked to enter during the last open month.
- Closed-window attempts return `409`; missed-window attempts are persisted in `examCalendar.missedWindows` without charging travel or creating `activeExam`.
- `entryPreparation` now keeps the calendar snapshot with window labels, preparation months, travel months, funding state, teacher recommendation state, and quota notes.
- Virtual candidates receive stable `rival-*` ids, persist across later exams, record attempt history, and can become visible `同年进士` contacts after palace-exam promotion to official.
- Providers can read compact exam calendar/rival context in prompts, but ordinary turns cannot patch `examCalendar`, `activeExam`, exam ranks, or exam history.
- The browser renders `#exam-calendar-panel` and `#exam-rival-panel`, includes calendar details in the writing modal and exam archive, and marks persistent rival notes inside candidate profiles.
- The durable contract is `docs/EXAM_CALENDAR_CONTRACT.md`; focused coverage lives in `test/examCalendar.test.js`, `test/examTravel.test.js`, `test/gameTurnTick.test.js`, `test/stateRules.test.js`, and browser smoke helper coverage.

## S36 Role / World Coupling Note (2026-05-06)

S36 turns key identity actions into server-owned world consequences before the monthly tick and long-term scheduler run:

- `worldState.roleWorldCoupling` stores `{ schemaVersion, recentImpacts, cooldowns }`. It is normalized by `src/game/roleWorldCoupling.js` and protected from ordinary provider patches.
- The first deterministic coupling families are magistrate waterworks, general campaigns, emperor appointments, and minister impeachments.
- `/api/game/turn` applies provider output first, then active requests, then role/world coupling, then world tick, long-term events, and official career settlement. This order lets waterworks affect the same month's grain/public-order drift, campaigns affect border pressure before later event scheduling, and court actions feed faction or official consequences without giving providers direct authority.
- Coupling output can include bounded `statePatch`, `attributeChanges`, relationship changes, event-history lines, and a compact `outcome`; server follow-up patches use `applyStatePatch(..., { incrementTurnCount: false, allowServerOwnedPatchKeys: true })`.
- Game and exam route payloads include top-level `roleWorldCouplingView`; turn payloads also include `roleWorldCoupling: { summary, events, attributeChanges, outcome }`.
- Providers can read compact role-world context in prompts, but the prompt and schema explicitly forbid ordinary provider patches to `roleWorldCoupling`.
- The browser renders `[联动]` narrative feedback as `.role-world-event[data-role-world-kind]` instead of adding another persistent panel.
- The durable contract is `docs/ROLE_WORLD_COUPLING_CONTRACT.md`; focused coverage lives in `test/roleWorldCoupling.test.js`, `test/gameTurnRoleWorldCoupling.test.js`, state/schema/eval tests, and browser smoke helper coverage.

## S37 Real Provider Long-Run Acceptance Note (2026-05-06)

S37 adds a keyed long-run provider acceptance gate without changing Mock-default local play:

- `docs/REAL_PROVIDER_ACCEPTANCE.md` is the durable S37 acceptance matrix for OpenAI, DeepSeek, and Anthropic/Claude.
- `npm run smoke:provider:long` runs `scripts/providerLongRun.js`, reusing the existing provider key selection and no-key skip behavior from `scripts/providerSmoke.js`.
- The script calls real provider factories directly, so Mock fallback cannot hide provider failures. It runs a repeated scholar scenario with an explicit ordinary-turn authority probe, checks historical Chinese tone, rejects server-owned statePatch attempts, applies server boundary/tick/event/career follow-up logic in memory, and writes no session files.
- `npm run smoke:provider:long -- --stream --provider openai|deepseek|anthropic|claude` routes each long-run turn through `streamTurn()` and still requires the final provider JSON to pass the normal turn schema.
- The current S37 script is adapter-level plus in-memory server-boundary verification. It intentionally does not exercise route-level SSE persistence; if future keyed acceptance expands to route-SSE mode, it should record the visible-narrative-then-validation-failure branch separately.

## S38.1 Browser Journey Expansion Note (2026-05-06)

S38.1 expands browser acceptance without changing Mock-default local play:

- `npm run smoke:browser` now drives the complete browser-visible scholar path through 童试、乡试、会试、殿试 and final `official` promotion.
- The smoke still uses the real start form, exam entry button, modal, essay textarea, submit button, result detail view, archive view, and session restore path. It writes local session readiness/month fields only before each exam so the deterministic Mock journey enters legal calendar windows without requiring free-form setup turns.
- The final progression asserts every promotion rank, four exam-history records, `activeExam === null`, final `player.role === "official"`, and a seeded `officeTitle`.
- An isolated cheating session submits a copied-classic essay through the same browser modal and must show `监试黜落` / `疑似照抄`, persist score `0`, keep the player a scholar, and record `promotionResult.severeCheat === true`.
- The screenshot pass now covers early desktop/mobile states, all four exam results, post-palace official state, final mobile archive, direct official first appointment, cheating result, and representative role/world coupling.

## S38.2 Session Storage Hardening Note (2026-05-06)

S38.2 has moved from planning into the JSON storage runtime while keeping the database move as a later migration target:

- `docs/SESSION_STORAGE_MIGRATION_PLAN.md` remains the durable storage evolution plan and now records the implemented JSON hardening baseline.
- `src/storage/sessionStore.js` writes a top-level record envelope with `storageSchemaVersion`, `createdAt`, `updatedAt`, `revision`, redacted metadata, and nested `worldState`.
- Legacy raw `worldState` saves are treated as schema `0`, read back into the old route-compatible `worldState` shape, and migrated to the envelope safely on read.
- Writes use same-directory temp-file-and-rename replacement with best-effort fsync; successful writes leave no same-session `.tmp` files.
- Game and exam mutation routes now use `mutateSession()` so overlapping turn/question/submit requests for the same session are serialized and revision-checked.
- `GET /api/game/saves` exposes redacted save metadata through `listSessions()`, while `cleanupSessionTempFiles()` provides explicit temp-file cleanup support.
- SQLite/database migration remains future work after the JSON adapter boundary has proven stable.

## S38.3 Browser Save List Note (2026-05-06)

S38.3 turns the S38.2 save-list API into a browser surface without changing the JSON storage backend:

- `public/index.html` now includes a start-page `#save-list-panel` and an in-game `#save-list-modal`.
- `public/app.js` fetches `GET /api/game/saves`, renders only redacted metadata, loads selected saves through `GET /api/game/state/:sessionId`, and keeps `localStorage["qianqiu.sessionId"]` as the compatibility pointer for automatic restore.
- The status strip adds a compact “存档” button after a game is active; selecting another save switches the rendered world state and closes the modal.
- Browser smoke now verifies the in-game save modal, start-page save loading from a clean context, hidden/raw storage token non-leakage, and save-list panel/modal overflow.
