# Browser Acceptance Record

This document records the repeatable browser acceptance surface for Qianqiu. It complements the human checklist in [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md), which remains the fallback for long playthroughs, role variety, and subjective visual review.

## How To Run

Use Mock mode unless the task is specifically about a real provider:

```powershell
npm run smoke:browser
npm run smoke:browser -- --check-ai-connection
npm run smoke:browser -- --url http://localhost:3000
npm run smoke:browser -- --screenshots artifacts/browser-smoke
```

The smoke uses `playwright-core` with an installed Chrome or Edge executable. If the browser is not in a standard location, set `BROWSER_EXECUTABLE_PATH` or pass `--browser <path>`. S38.1 deterministic exam setup expects `--url` targets to be local Qianqiu servers sharing this repository's `data/sessions/` directory. Screenshots are validated in memory by default; `--screenshots <dir>` also writes the checked PNG files. `artifacts/` is ignored by Git. `--check-ai-connection` clicks the start-page `AI 连接` button before creating a session; the auto-started smoke server uses Mock, while `--url` targets should enable this flag only when the target provider is intentionally configured for that route check.

## Automated Coverage

`scripts/browserSmoke.js` currently verifies:

| Area | Automated checks |
| --- | --- |
| Local boot | Starts a temporary Mock-mode server unless `--url` is supplied, waits for `/api/health`, and loads `/`. |
| AI connection panel | Optional with `--check-ai-connection`: clicks `#ai-test-button`, requires `#ai-test-result[data-ok="true"]`, model/config details, no API-key/session-path text leaks, no `qianqiu.sessionId` write, and no transition into the game action area. |
| Opening flow | Confirms the start form exposes every supported role, creates a scholar session through the real form, and verifies `qianqiu.sessionId` in localStorage. |
| Session restore | Reloads the page, opens a fresh page in the same browser context, confirms the game view restores, checks `GET /api/game/state/:sessionId`, and verifies the start-page save list can load the same session from a clean browser context. |
| Save list UI | Checks the in-game `#save-list-modal` and start-page `#save-list-panel` from `GET /api/game/saves`, expected save ids, raw storage token non-leakage, and save-list horizontal overflow. |
| Failed SSE rollback | Mocks a browser `text/event-stream` response that emits a `narrative_chunk` followed by `error`, then confirms the uncommitted streamed text is removed while the error remains visible. |
| Desktop layout | Checks status strip, role panel, narrative area, and action input surface for visibility, overlap, horizontal overflow, game-panel width/share, and role-panel clipping. |
| Relationship panel | Checks visible contact/faction rows from `relationshipView`, field completeness, hidden id/text non-leakage, relationship-panel overflow, and a Mock scholar turn updating the mentor relationship. |
| Active request panel | Checks the server-scheduled `activeNpcRequestView` panel, target id/type/kind/status attributes, required ask/stakes/due/hint fields, hidden target/text non-leakage, and active-request overflow. |
| Official career panel | Checks direct official start, the server-owned `officialCareerView` panel, 官署/差事/考成/关系/风险 sections, deterministic first appointment, a Mock `relief` assignment, hidden-note non-leakage tokens, current outcome fields, stable `data-*` attributes, and official-career overflow on desktop/mobile. |
| Exam calendar panel | Checks the server-owned `examCalendarView` panel, next-level/status attributes, timing/funding/recommendation/quota details, and calendar-panel overflow. |
| Exam rival panel | Checks persistent `examRivalView` cards after an exam, stable rival/status/level attributes, latest-result rows, and rival-panel overflow. |
| Role/world coupling | Opens direct magistrate, general, emperor, and minister sessions; runs one representative role action; checks `.role-world-event[data-role-world-kind]` feedback; and verifies the expected API state metric moves in the intended direction. |
| Exam progression | Opens and submits 童试, 乡试, 会试, and 殿试 through the real browser modal path, setting local Mock smoke readiness/months only to keep the legal calendar windows deterministic. Confirms each promotion, final `official` role, four exam-history records, cleared `activeExam`, and seeded office title. |
| Cheating sample | Starts an isolated scholar session, submits a copied-classic essay through the browser, and confirms the result shows `监试黜落` / `疑似照抄`, persists score `0`, keeps the player a scholar, and records `severeCheat=true`. |
| Exam modal | Opens each exam from the scholar panel, verifies question/requirements/writing controls, checks calendar timing details in the requirements, fills deterministic essays, and submits them. |
| Result details | Checks score summary, player archive, calendar archive details, result sections, highlighted ranking row, inspectable same-field candidate essays, persistent rival notes, and the final four-exam archive. |
| Mobile layout | Switches to a mobile viewport after the first exam and after palace promotion, checks the game/action surface, opens the exam archive, and verifies responsive result details for both the early and full-path archive states. |
| Direct official start | Opens an isolated browser context, starts as `official`, checks the official role panel/action placeholder, verifies all expected visible relationship factions are present, verifies the API-persisted role, then runs one official turn to verify first appointment. |
| Screenshots | Captures representative desktop and mobile states and validates each capture as a non-empty PNG. |
| Cleanup | Deletes the smoke-created session file when the journey finishes. |

## Latest Automated Result

Date: 2026-05-07

Relevant implementation commit: 本次 S47.1 提交

Commands verified during S47.1:

```powershell
node --check scripts\browserSmoke.js
node --test test\browserSmokeScript.test.js
npm run smoke:browser -- --check-ai-connection
$env:AI_PROVIDER='mock'; npm test
git diff --check
```

Observed result:

- Focused browser-smoke helper coverage includes the optional AI connection panel checks plus the existing layout/view helper coverage.
- `npm run smoke:browser -- --check-ai-connection`: passed with `ai-connection` included in UI acceptance, then completed the existing save-list modal/start-page load coverage, failed SSE rollback coverage, relationship/active-request/world-thread panels, complete four-level Mock exam progression, final scholar-to-official browser promotion, copied-classic cheating coverage, exam-calendar/rival panels, official-career panel, representative magistrate/general/emperor/minister role-world coupling, and 14 screenshots checked.
- `$env:AI_PROVIDER='mock'; npm test`: full suite passed in the S47.1 verification run with 265 tests.
- S47.1 only adds a browser route-level button gate; real-provider browser behavior still requires an explicitly configured `--url` target and is not part of default Mock smoke.
- The browser start path still clears stale `qianqiu.sessionId` localStorage only when an old restored game hides the initial start form. Later reload/fresh-page restoration checks continue to validate the newly created session.
- Desktop smoke still fails if the game panel regresses to the old narrow-column width, if the role panel, relationship panel, active-request panel, official-career panel, exam-calendar panel, exam-rival panel, or save-list surfaces are horizontally clipped, if S35 calendar/rival details disappear from the modal/archive/candidate profiles, if any supported start role is missing from the browser form, if hidden scholar-invisible factions leak into relationship/active-request panel text, if save-list rows leak raw storage tokens, if the four-exam path stops before official promotion, if copied-passage punishment disappears, or if S36 role-world feedback/API metric deltas disappear from representative role journeys.

Earlier S26.2 screenshot review caught and fixed a real result-modal bug: `.exam-requirements { display: grid; }` overrode the `hidden` attribute and left the old requirements visible behind the result view. The fix is `.exam-requirements[hidden] { display: none; }`.

## Manual Fallback

Use [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md) for:

- Longer free-form scholar and official play beyond the automated four-exam happy path.
- Exam integrity variants beyond the automated copied-classic severe case: very short essays, modern/anachronistic terms, and suspected ghostwriting.
- Multi-turn role-loop checks for emperor, minister, general, magistrate, and post-palace official play.
- Subjective visual inspection of typography, historical tone, readability, and overall atmosphere.
- Real-provider browser behavior when API keys are configured.
- Cross-browser behavior outside the installed Chrome/Edge executable used by `smoke:browser`.

If the browser smoke cannot run because Chrome or Edge is unavailable, record the skip in `docs/SHARED_CONTEXT.md` and `docs/DEVELOPMENT_STEPS.md`, then run the manual checklist and the API/test gates instead.
