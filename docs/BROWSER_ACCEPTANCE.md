# Browser Acceptance Record

This document records the repeatable browser acceptance surface for Qianqiu. It complements the human checklist in [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md), which remains the fallback for long playthroughs, role variety, and subjective visual review.

## How To Run

Use Mock mode unless the task is specifically about a real provider:

```powershell
npm run smoke:browser
npm run smoke:browser -- --url http://localhost:3000
npm run smoke:browser -- --screenshots artifacts/browser-smoke
```

The smoke uses `playwright-core` with an installed Chrome or Edge executable. If the browser is not in a standard location, set `BROWSER_EXECUTABLE_PATH` or pass `--browser <path>`. Screenshots are validated in memory by default; `--screenshots <dir>` also writes the checked PNG files. `artifacts/` is ignored by Git.

## Automated Coverage

`scripts/browserSmoke.js` currently verifies:

| Area | Automated checks |
| --- | --- |
| Local boot | Starts a temporary Mock-mode server unless `--url` is supplied, waits for `/api/health`, and loads `/`. |
| Opening flow | Confirms the start form exposes every supported role, creates a scholar session through the real form, and verifies `qianqiu.sessionId` in localStorage. |
| Session restore | Reloads the page, opens a fresh page in the same browser context, confirms the game view restores, and checks `GET /api/game/state/:sessionId`. |
| Desktop layout | Checks status strip, role panel, narrative area, and action input surface for visibility, overlap, horizontal overflow, game-panel width/share, and role-panel clipping. |
| Relationship panel | Checks visible contact/faction rows from `relationshipView`, field completeness, hidden id/text non-leakage, relationship-panel overflow, and a Mock scholar turn updating the mentor relationship. |
| Active request panel | Checks the server-scheduled `activeNpcRequestView` panel, target id/type/kind/status attributes, required ask/stakes/due/hint fields, hidden target/text non-leakage, and active-request overflow. |
| Official career panel | Checks direct official start, the server-owned `officialCareerView` panel, deterministic first appointment, current outcome fields, stable `data-outcome-*` attributes, and official-career overflow. |
| Exam modal | Opens the next exam from the scholar panel, verifies question/requirements/writing controls, fills an essay, and submits it. |
| Result details | Checks score summary, player archive, result sections, highlighted ranking row, and inspectable same-field candidate essays. |
| Mobile layout | Switches to a mobile viewport, checks the game/action surface, opens the exam archive, and verifies responsive result details. |
| Direct official start | Opens an isolated browser context, starts as `official`, checks the official role panel/action placeholder, verifies all expected visible relationship factions are present, verifies the API-persisted role, then runs one official turn to verify first appointment. |
| Screenshots | Captures representative desktop and mobile states and validates each capture as a non-empty PNG. |
| Cleanup | Deletes the smoke-created session file when the journey finishes. |

## Latest Automated Result

Date: 2026-05-06

Relevant implementation commit: current S34 implementation commit (`Implement official career outcome engine`)

Commands verified during S34:

```powershell
node --check src\game\officialCareer.js
node --check src\routes\game.js
node --check src\routes\exam.js
node --check public\app.js
node --check scripts\browserSmoke.js
node --check test\officialCareer.test.js
node --check test\gameTurnOfficialCareer.test.js
node --check test\browserSmokeScript.test.js
node --test test\officialCareer.test.js test\gameTurnOfficialCareer.test.js test\officialRole.test.js
npm run eval:ai
npm test
npm run smoke:browser -- --screenshots artifacts/browser-smoke/s34
git diff --check
```

Observed result:

- Focused official-career, route, official-role, and browser-helper tests passed.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s34`: passed with relationship-panel coverage, active-request-panel coverage, direct official-start relationship visibility, deterministic official first-appointment coverage, and 6 screenshots checked.
- `npm test`: 129 tests passed.
- Desktop smoke still fails if the game panel regresses to the old narrow-column width, if the role panel, relationship panel, active-request panel, or official-career panel is horizontally clipped, if any supported start role is missing from the browser form, or if hidden scholar-invisible factions leak into relationship/active-request panel text.

Earlier S26.2 screenshot review caught and fixed a real result-modal bug: `.exam-requirements { display: grid; }` overrode the `hidden` attribute and left the old requirements visible behind the result view. The fix is `.exam-requirements[hidden] { display: none; }`.

## Manual Fallback

Use [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md) for:

- Complete scholar -> child exam -> provincial exam -> metropolitan exam -> palace exam -> official browser playthrough.
- Exam integrity variants in the browser: very short essays, modern/anachronistic terms, copied passages, and normal essays.
- Role-loop browser checks for emperor, minister, general, magistrate, and post-palace official play.
- Subjective visual inspection of typography, historical tone, readability, and overall atmosphere.
- Real-provider browser behavior when API keys are configured.
- Cross-browser behavior outside the installed Chrome/Edge executable used by `smoke:browser`.

If the browser smoke cannot run because Chrome or Edge is unavailable, record the skip in `docs/SHARED_CONTEXT.md` and `docs/DEVELOPMENT_STEPS.md`, then run the manual checklist and the API/test gates instead.
