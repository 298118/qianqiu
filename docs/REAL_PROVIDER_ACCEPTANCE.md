# Real Provider Long-Run Acceptance

This document is the S37/S47/S48 acceptance record for keyed real-provider behavior. It complements the short `npm run smoke:provider` adapter smoke, the S47 route-level health check, and the no-network `npm run eval:ai` fixture gate.

S37 keeps real providers optional. No-key environments must skip successfully, and default local play remains Mock-first.

## Goals

The long-run provider gate answers four questions that one-shot smoke cannot answer:

- Can OpenAI, DeepSeek, and Anthropic/Claude keep returning schema-valid JSON across repeated turns?
- Does player-facing text keep a restrained Chinese historical tone without modern product or system-prompt leakage?
- Do provider outputs respect ordinary-turn authority boundaries after prompts and schemas have accumulated long context?
- Does streaming still produce a final validated turn payload before any server-owned state would be trusted?

## Current Automated Gate

Run:

```bash
npm run smoke:provider:long
npm run smoke:provider:route
npm run smoke:provider:long -- --provider openai
npm run smoke:provider:route -- --provider deepseek
npm run smoke:provider:long -- --stream --provider anthropic
npm run smoke:provider:long -- --provider all --turns 12
```

Implementation:

- Entrypoint: `scripts/providerLongRun.js`.
- Package script: `smoke:provider:long`.
- Helper tests: `test/providerLongRunScript.test.js`.
- Provider selection is shared with `scripts/providerSmoke.js`: `AI_PROVIDER=mock` auto-runs only keyed providers; explicit real providers fail fast if their key is missing.
- The script calls provider factories directly, so Mock fallback cannot hide provider failures.
- It does not start Express and does not write `data/sessions/*.json`.

S47.1 adds `npm run smoke:provider:route` through `scripts/providerRouteHealth.js`. It starts a tiny local Express app, POSTs `/api/ai/connection-test` for each selected keyed provider, verifies `ok=true`, provider/config/model fields, `supportsStreaming`, `openingEventCount`, `narrativePreview`, secret/session-path non-leakage, and confirms no new `data/sessions/*.json` file appears. This route gate is intentionally shorter than adapter smoke: it checks the same path the browser start panel uses and does not add a model cost or speed ledger beyond the route's existing `latencyMs` diagnostic field.

The current scenario is an 8-turn scholar long-run by default. It includes ordinary study, mentor, travel, social, exam-preparation, rest, and an explicit authority probe asking the model to skip the imperial examination and grant office directly. The script applies the same server-owned state boundaries in memory for provider patches, relationship suggestions, active NPC requests, role/world coupling, world tick, long-term events, official-career settlement, World Entities, and World Threads. S48.5 records `worldTick.cadence`, `completedMonth`, long-term scheduling/resolution counts, and `worldEntityImpacts` in each in-memory report so the adapter-level gate checks the same旬制 cadence as the route.

## Acceptance Matrix

Record each keyed run as one provider plus one mode:

| Field | Meaning |
| --- | --- |
| `provider` | `openai`, `deepseek`, or `anthropic`; `claude` is an alias for `anthropic`. |
| `model` | Value from `OPENAI_MODEL`, `DEEPSEEK_MODEL`, or `ANTHROPIC_MODEL`, or the adapter default. |
| `mode` | `json` or `adapter-stream`; future route-level SSE runs should use `route-sse`. |
| `turnCountTarget` | Requested long-run length, normally 8-12 for acceptance. |
| `schemaResult` | All provider payloads parse and pass `src/ai/schemas.js`. |
| `historicalToneResult` | Narratives and provider events contain historical anchors, enough Chinese text, and no obvious modern/product terms. |
| `authorityBoundaryResult` | No provider `statePatch` attempts server-owned keys such as `turnCount`, `year`, `month`, `tenDayPeriod`, `activeExam`, `examCalendar`, `activeNpcRequest`, `longTermEvents`, `officialCareer`, `roleWorldCoupling`, `eventHistory`, `characters`, `player.examRank`, `player.officeTitle`, or `player.examHistory`. |
| `stateConsistencyResult` | `turnCount` increments once per turn, `year/month/tenDayPeriod` stay server-owned and in range, ordinary turns advance one ten-day period at a time, numeric ranges clamp, event history stays capped, and scholar role/rank are not promoted by ordinary turns. |
| `streamingResult` | With `--stream`, `streamTurn()` returns a final schema-valid turn; streamed raw-character count is logged for diagnosis. |
| `routeHealthResult` | `smoke:provider:route` returns route-level `ok=true`, model summary, streaming capability, opening event count, no session write, and no secret/path leakage. |
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

No-key skip is a valid local result:

```text
No real-provider keys found; skipping S37/S48 provider long-run.
No real-provider keys found; skipping provider route health.
```

## Limitations

The S37.2 script is adapter-level plus in-memory server-boundary verification. S47.1 covers the route-level connection diagnostic, but not the route-level SSE branch where a visible streamed narrative may be followed by validation failure and no persistence. That behavior remains covered by no-network route tests and should become a keyed route-SSE acceptance mode if real-provider browser/network acceptance is expanded later.

The tone heuristic is intentionally conservative and local. A passing run is not a literary judgment; it is a regression guard for obvious modern leakage and non-Chinese responses.

## Latest Local Verification

2026-05-06 local S37 implementation verification used a no-key environment:

```bash
node --check scripts/providerLongRun.js
node --check test/providerLongRunScript.test.js
node --test test/providerLongRunScript.test.js test/providerSmokeScript.test.js
npm run smoke:provider:long
npm run eval:ai
npm test
git diff --check
```

The keyed network paths were not executed because no real-provider keys are configured in this workspace.
