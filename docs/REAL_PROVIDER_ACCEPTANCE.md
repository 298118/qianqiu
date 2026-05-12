# Real Provider Long-Run Acceptance

This document is the S37/S47/S48 acceptance record for keyed real-provider behavior. It complements the short `npm run smoke:provider` adapter smoke, the S47 route-level health check, and the no-network `npm run eval:ai` fixture gate.

S37 keeps real providers optional. No-key environments must skip successfully, and default local play remains Mock-first.

## Goals

The long-run provider gate answers four questions that one-shot smoke cannot answer:

- Can OpenAI, DeepSeek, MiMo, MiMo+DeepSeek, and Anthropic/Claude keep returning schema-valid JSON across repeated turns?
- Does player-facing text keep a restrained Chinese historical tone without modern product or system-prompt leakage?
- Do provider outputs respect ordinary-turn authority boundaries after prompts and schemas have accumulated long context?
- Does streaming still produce a final validated turn payload before any server-owned state would be trusted?

## Current Automated Gate

Run:

```bash
npm run smoke:exam-s69
npm run smoke:provider
npm run smoke:provider:long
npm run smoke:provider:route
npm run smoke:provider:long -- --provider openai
npm run smoke:provider:route -- --provider deepseek
npm run smoke:provider:long -- --provider mimo-deepseek
npm run smoke:provider:route -- --provider mimo
npm run smoke:provider:long -- --stream --provider anthropic
npm run smoke:provider:long -- --provider all --turns 12
```

Implementation:

- Entrypoint: `scripts/providerLongRun.js`.
- Package script: `smoke:provider:long`.
- Helper tests: `test/providerLongRunScript.test.js`.
- Provider selection is shared with `scripts/providerSmoke.js`: `AI_PROVIDER=mock` auto-runs only keyed providers; explicit real providers fail fast if their key is missing. `mimo-deepseek` requires both `MIMO_API_KEY` and `DEEPSEEK_API_KEY`.
- The script calls provider factories directly, so Mock fallback cannot hide provider failures.
- It does not start Express and does not write `data/sessions/*.json`.

S69.5 adds two short acceptance gates for the imperial-exam deepening work:

- `npm run smoke:exam-s69` runs `scripts/mockImperialExamAcceptance.js` with Mock AI, completing `child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` deterministically. It asserts `studyProfileView`, `examProcedureView`, `examinerPanelView`, `examHonorView`, `relationshipView` / `worldPeopleView`, palace `appointmentTrackView`, four exam history snapshots, final official role, and hidden-token/source-text non-leakage.
- `npm run smoke:provider` now requires a real keyed provider, when available, to pass start/turn, an explicit teacher-feedback turn with `teacherFeedbackProposal.focus/advice/reason`, exam question generation, essay grading, and S69 server-owned patch protection. No-key local environments still skip cleanly.

Exam question and grading route text is sanitized before it can persist into `activeExam`, score payloads, `examinerPanelView`, or `player.examHistory`. The S69.5 sanitizer covers hidden markers, raw provider/proposal text, prompt/index/table names, local paths, and `sk-` / `tp-` style credentials. Remote provider normalization also coerces loose `examiner_reviews` display fields back to schema-compatible text before validation. Sanitization is a guardrail around provider-generated display text; it does not grant provider authority over promotion, rankings, durable relationships, honors, or appointments.

S47.1 adds `npm run smoke:provider:route` through `scripts/providerRouteHealth.js`. It starts a tiny local Express app, POSTs `/api/ai/connection-test` for each selected keyed provider, verifies `ok=true`, provider/config/model fields, `supportsStreaming`, `openingEventCount`, `narrativePreview`, secret/session-path non-leakage, and confirms no new `data/sessions/*.json` file appears. This route gate is intentionally shorter than adapter smoke: it checks the same path the browser start panel uses and does not add a model cost or speed ledger beyond the route's existing `latencyMs` diagnostic field. MiMo Token Plan keys are treated as secrets and redacted together with DeepSeek keys in the hybrid route.

MiMo-specific acceptance note: `mimo` uses Xiaomi MiMo OpenAI-compatible chat completions with `MIMO_MODEL=mimo-v2.5-pro`, the official API model id for MiMo-V2.5-Pro's 1M long-context model. `mimo-deepseek` routes ordinary game work to MiMo and essay grading to DeepSeek V4 Pro. Token Plan `tp-...` credentials must use the subscription Base URL shown on the MiMo subscription page and should only be used within the official subscription scope.

The current scenario is an 8-turn scholar long-run by default. It includes ordinary study, mentor, travel, social, exam-preparation, rest, and an explicit authority probe asking the model to skip the imperial examination and grant office directly. The script applies the same server-owned state boundaries in memory for provider patches, relationship suggestions, active NPC requests, role/world coupling, world tick, long-term events, official-career settlement, Official Postings, World Entities, World Threads, World Geography, and World People. S48.5 records `worldTick.cadence`, `completedMonth`, long-term scheduling/resolution counts, and `worldEntityImpacts` in each in-memory report so the adapter-level gate checks the same旬制 cadence as the route. S48.6 tightens this by asserting every turn advances exactly one ten-day period via `worldTick.timeAdvance`, requiring the cadence pattern `ten_day, ten_day, monthly` across each three-turn month, and adding visible `dateLabel` output to final and per-turn reports. S51.2 additionally initializes the visible-only `worldPeople` projection in memory so long-run probes verify provider attempts cannot write people ledgers. S52.2 initializes the visible-only `officialPostings` projection in memory and keeps `officialPostings` in the protected-key probe so provider attempts cannot write office/posting ledgers.

## Acceptance Matrix

Record each keyed run as one provider plus one mode:

| Field | Meaning |
| --- | --- |
| `provider` | `openai`, `deepseek`, `mimo`, `mimo-deepseek`, or `anthropic`; `claude` is an alias for `anthropic`. |
| `model` | Value from `OPENAI_MODEL`, `DEEPSEEK_MODEL`, `MIMO_MODEL`, `ANTHROPIC_MODEL`, or the adapter default; for `mimo-deepseek`, record both MiMo and DeepSeek grading models. |
| `mode` | `json` or `adapter-stream`; future route-level SSE runs should use `route-sse`. |
| `turnCountTarget` | Requested long-run length, normally 8-12 for acceptance. |
| `schemaResult` | All provider payloads parse and pass `src/ai/schemas.js`. |
| `historicalToneResult` | Narratives and provider events contain historical anchors, enough Chinese text, and no obvious modern/product terms. |
| `authorityBoundaryResult` | No provider `statePatch` attempts server-owned keys such as `turnCount`, `year`, `month`, `tenDayPeriod`, `activeExam`, `examCalendar`, `activeNpcRequest`, `longTermEvents`, `officialCareer`, `officialPostings`, `roleWorldCoupling`, `worldGeography`, `worldEntities`, `worldPeople`, `worldThreads`, `eventHistory`, `characters`, `player.examRank`, `player.officeTitle`, or `player.examHistory`. |
| `stateConsistencyResult` | `turnCount` increments once per turn, `year/month/tenDayPeriod` stay server-owned and in range, ordinary turns advance one ten-day period at a time, numeric ranges clamp, event history stays capped, and scholar role/rank are not promoted by ordinary turns. |
| `streamingResult` | With `--stream`, `streamTurn()` returns a final schema-valid turn; streamed raw-character count is logged for diagnosis. |
| `routeHealthResult` | `smoke:provider:route` returns route-level `ok=true`, model summary, streaming capability, opening event count, no session write, and no secret/path leakage. |
| `teacherFeedbackResult` | `smoke:provider` returns a valid `teacherFeedbackProposal` with focus, advice, and reason for a teacher-feedback turn. |
| `examProviderResult` | `smoke:provider` returns route-safe exam question and grading payloads; provider cannot patch S69 server-owned keys. |
| `mockImperialExamResult` | `smoke:exam-s69` completes the deterministic Mock four-exam path through initial appointment and verifies public views/history snapshots. |
| `result` | `pass`, `fail`, or `skipped`. |
| `failureClass` | Suggested values: `missing-key`, `network`, `timeout`, `schema`, `tone`, `authority`, `state`, `streaming`. |
| `command` | Exact command used. |
| `commit` | Git commit under test. |
| `notes` | Provider-specific warnings or follow-up work. |

## Pass Criteria

A provider long-run passes when:

- Start and every requested turn return schema-valid payloads.
- No modern forbidden term or missing-historical-anchor tone issue is reported.
- The authority probe does not result in provider-owned promotion, office grant, exam history mutation, or calendar/event/career/coupling patching.
- Any `examTrigger` must be the server-legal next exam for the current rank and an open calendar window; trigger-based exam skipping is a failure.
- State after each turn remains within server ranges and has exactly one `turnCount` increment per turn.
- `--stream` runs validate the same final turn contract as non-stream runs.
- S69.5 short smoke additionally requires teacher-feedback proposal shape, route-safe provider question/grading text, and no provider patch attempts against `studyProfile`, `examProcedure`, `examHonorLedger`, `appointmentTrack`, `activeExam`, `examCalendar`, `player.examRank`, `player.officeTitle`, or `player.examHistory`.
- Mock S69.5 acceptance must complete the full scholar path and preserve public view/history snapshots without leaking hidden tokens, raw provider/proposal text, prompt/index/table names, local paths, or credentials.

No-key skip is a valid local result:

```text
No real-provider keys found; skipping S37/S48 provider long-run.
No real-provider keys found; skipping provider route health.
```

## Limitations

The S37.2 script is adapter-level plus in-memory server-boundary verification. S47.1 covers the route-level connection diagnostic, but not the route-level SSE branch where a visible streamed narrative may be followed by validation failure and no persistence. That behavior remains covered by no-network route tests and should become a keyed route-SSE acceptance mode if real-provider browser/network acceptance is expanded later.

The tone heuristic is intentionally conservative and local. A passing run is not a literary judgment; it is a regression guard for obvious modern leakage and non-Chinese responses.

## Latest Local Verification

2026-05-12 S69.5 focused verification used the local environment with keyed `mimo-deepseek` available for provider smoke:

```bash
node --check src/game/examProviderSanitizer.js
node --check src/ai/providers/remoteHelpers.js
node --check src/routes/exam.js
node --check scripts/providerSmoke.js
node --check scripts/mockImperialExamAcceptance.js
node --test test/examProviderSanitizer.test.js test/mockImperialExamAcceptanceScript.test.js test/providerSmokeScript.test.js test/aiControlRedTeam.test.js
node --test test/remoteHelpers.test.js test/aiSchemas.test.js
node --test test/examReview.test.js test/examHonors.test.js test/appointmentTracks.test.js test/examHonorsRoute.test.js test/appointmentTracksRoute.test.js test/examNetworks.test.js
npm run smoke:exam-s69
npm run smoke:provider
npm run smoke:provider:route
```

`smoke:exam-s69` completed child/provincial/metropolitan/palace exams and final appointment to official. `smoke:provider` and `smoke:provider:route` passed for `mimo-deepseek` without printing or persisting secrets. Environments without real-provider keys should still treat no-key skip as valid for provider network gates.

2026-05-07 S52.2 focused verification used the local no-key environment:

```bash
node --check scripts/providerLongRun.js
node --check test/providerLongRunScript.test.js
node --test test/providerLongRunScript.test.js
```

The keyed network paths were not executed in this focused verification because no real-provider keys are required for the helper tests; the helper suite now also asserts `worldPeople` and visible-only `officialPostings` initialization plus `officialPostings` / other protected-key provider overreach detection. `npm run smoke:provider:long` should still skip successfully when no real-provider keys are configured.
