# Phase Two Acceptance Record

Date: 2026-05-06

Tool: Codex

Scope: S27.1 second-phase acceptance documentation after S21-S26 implementation.

## Summary

Phase two is accepted for the default local Mock-mode development path:

- The game remains runnable with `npm install && npm start` and a browser at `http://localhost:3000`.
- Mock mode remains the default no-key provider path.
- The complete scholar path is still protected by automated coverage: scholar -> child exam -> provincial exam -> metropolitan exam -> palace exam -> official.
- Server-owned state boundaries remain enforced through JSON schema validation, patch whitelists, numeric clamps, local exam integrity checks, promotion rules, relationship merge rules, and world tick ownership.
- Automated browser acceptance now covers local boot, scholar start, session restore, desktop/mobile layout, the exam modal, result details, the exam archive, screenshot validation, and smoke session cleanup.

## Accepted Phase-Two Additions

| Area | Accepted coverage |
| --- | --- |
| World tick | `worldState.month` and `year/month` progression are server-owned; `/api/game/turn` applies one monthly tick after validated provider output, emits visible monthly feedback, clamps resource/faction drift, and preserves one `turnCount` increment per player turn. |
| Relationship memory | `relationshipLedger` stores visible NPC/faction memory. Providers may only suggest bounded `relationshipChanges`; the server drops hidden or invented targets and persists normalized ledger changes. |
| Identity depth | Magistrate, general, and post-palace official roles now have dedicated state fields, Mock actions, prompt/schema support, relationship reactions, and browser role-panel rendering. |
| Exam depth | Virtual candidates include inspectable essays and comments, exam archive UI can review past records, travel/preparation costs are server-owned, and exam history keeps player essay, result, ranking, candidate essays, and promotion/failure reasons. |
| Real provider readiness | `npm run smoke:provider` can call keyed OpenAI, DeepSeek, and Anthropic/Claude provider paths directly; `--stream` exercises keyed real-provider turn streaming. No-key environments skip successfully. |
| AI output eval | `npm run eval:ai` runs no-network fixtures for provider-shaped JSON, unsafe authority claims, patch clamping, faction safety, grade bounds, local exam penalties, and historical tone. |
| Browser acceptance | `npm run smoke:browser` uses `playwright-core` plus a local Chrome/Edge executable and validates the representative UI journey documented in [BROWSER_ACCEPTANCE.md](BROWSER_ACCEPTANCE.md). |

## Verification Commands

Commands verified on 2026-05-06:

```powershell
npm run eval:ai
npm run smoke:provider
npm test
npm run smoke:browser -- --screenshots artifacts/browser-smoke/s27-1
git diff --check
```

Observed result:

- `npm run eval:ai`: 6 tests passed.
- `npm run smoke:provider`: skipped successfully because no `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, or `ANTHROPIC_API_KEY` is configured.
- `npm test`: 87 tests passed.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s27-1`: passed against a temporary Mock server at `http://127.0.0.1:1558`, restored session `62077966-7edb-4fea-aea2-1fc4fedd7958`, checked desktop/mobile UI acceptance, and validated 5 screenshots.
- `git diff --check`: passed.

Screenshot artifacts live under `artifacts/browser-smoke/s27-1`, which is ignored by Git.

## Known Limits

- Real provider smoke and streaming were not executed with live network calls in this acceptance pass because no provider API keys are configured in the local environment.
- Browser automation depends on an installed Chrome or Edge executable, or `BROWSER_EXECUTABLE_PATH` / `--browser <path>`.
- Browser smoke covers representative layout and exam-result surfaces, not the complete four-exam browser playthrough or every role loop.
- `docs/MANUAL_ACCEPTANCE.md` remains the fallback for full scholar-to-official browser play, exam integrity variants, emperor/minister/general/magistrate/official role loops, subjective visual review, real-provider browser behavior, and cross-browser checks.
- World tick, travel cost, role loop outcomes, and relationship reactions are first-pass deterministic Mock balances; they are accepted as functional depth, not final tuning.
- Long-term persistence is still local JSON files under `data/sessions/`; multi-user storage, migration, and save management remain future work.

## Phase-Three Candidates

- Add a dedicated relationship/contacts inspection view so ledger memory is not visible only through short narrative feedback.
- Deepen long-horizon simulation: seasonal events, court appointments, regional crises, military campaigns, exams by calendar window, and consequences that compound over years.
- Expand official career progression beyond `promotionProspect` by adding server-owned reassignment, demotion, office transfer, patronage, and impeachment outcomes.
- Make magistrate and general loops interact more strongly with world tick and relationship memory.
- Run keyed real-provider acceptance for OpenAI, DeepSeek, and Anthropic/Claude, including streaming, once keys are available.
- Broaden browser acceptance to the full scholar-to-official journey, role-loop scenarios, cross-browser checks, and visual regression comparison.
- Introduce storage migration strategy before JSON sessions become a long-term compatibility burden.

## Final Status

S27.1 closes the second-phase roadmap as an accepted local development milestone. Future work should open a new phase or third-phase roadmap entry instead of extending S27.1.
