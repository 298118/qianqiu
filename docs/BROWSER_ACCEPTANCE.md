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
| Opening flow | Creates a scholar session through the real start form and verifies `qianqiu.sessionId` in localStorage. |
| Session restore | Reloads the page, opens a fresh page in the same browser context, confirms the game view restores, and checks `GET /api/game/state/:sessionId`. |
| Desktop layout | Checks status strip, role panel, narrative area, and action input surface for visibility, overlap, horizontal overflow, game-panel width/share, and role-panel clipping. |
| Exam modal | Opens the next exam from the scholar panel, verifies question/requirements/writing controls, fills an essay, and submits it. |
| Result details | Checks score summary, player archive, result sections, highlighted ranking row, and inspectable same-field candidate essays. |
| Mobile layout | Switches to a mobile viewport, checks the game/action surface, opens the exam archive, and verifies responsive result details. |
| Screenshots | Captures representative desktop and mobile states and validates each capture as a non-empty PNG. |
| Cleanup | Deletes the smoke-created session file when the journey finishes. |

## Latest Automated Result

Date: 2026-05-06

Relevant implementation commit: current S31.1 commit (`Repair desktop game layout width`)

Commands verified during S31.1:

```powershell
node --check public\app.js
node --check scripts\browserSmoke.js
node --check test\browserSmokeScript.test.js
node --test test\browserSmokeScript.test.js
npm run smoke:browser -- --screenshots artifacts/browser-smoke/s31-1
npm test
git diff --check
```

Observed result:

- `test/browserSmokeScript.test.js`: 10 tests passed.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s31-1`: passed with 5 screenshots checked.
- `npm test`: 89 tests passed.
- Desktop smoke now fails if the game panel regresses to the old narrow-column width or if the role panel is horizontally clipped.

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
