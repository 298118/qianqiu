# Phase One Acceptance Record

Date: 2026-05-05

Tool: Codex

Scope: S14.3 phase-one Mock-mode acceptance after README and developer documentation completion.

## Summary

Phase one is accepted for the default local path:

- `npm install` succeeds with 0 vulnerabilities.
- `npm test` passes with 15 tests.
- A temporary Mock server on port `3214` served `/`, `/styles.css`, `/app.js`, and `GET /api/health`.
- The API flow completed the scholar path from daily actions through 童试, 乡试, 会试, 殿试, and promotion to `official`.
- The promoted official could take a follow-up official action.
- Exam integrity checks flagged short essays, modern/anachronistic terms, and copied classic passages. Severe copying forced score `0` and `promotionResult.severeCheat = true`.
- Emperor, minister, and official role loops returned narrative and whitelisted state changes.

## Commands

```powershell
npm install
npm test
```

Automated Mock acceptance was run with a temporary Node script that:

1. Spawned `node server.js` with `AI_PROVIDER=mock` and `PORT=3214`.
2. Waited for `GET /api/health`.
3. Fetched `/`, `/styles.css`, and `/app.js`.
4. Created a scholar session and submitted daily actions for study, teacher visit, travel/social, debate, work, and more study.
5. Called `POST /api/exam/question` and `POST /api/exam/submit` for all four exam levels.
6. Asserted the final scholar state: `player.role = "official"`, `player.examRank = "进士"`, `player.examHistory.length = 4`, and an assigned `officeTitle`.
7. Submitted short, modern-term, and copied-classic essays in separate sessions.
8. Created emperor, minister, and official sessions and submitted one role-appropriate action each.

## Result Snapshot

```json
{
  "port": 3214,
  "healthProvider": "mock",
  "staticAssets": ["/", "/styles.css", "/app.js"],
  "scholarPath": {
    "finalRole": "official",
    "examRank": "进士",
    "officeTitle": "翰林院修撰",
    "examHistoryLength": 4
  },
  "integrityFlags": {
    "short": ["too_short"],
    "modern": ["too_short", "anachronism"],
    "copySevere": true
  },
  "roleLoops": ["emperor", "minister", "official"]
}
```

## Limitations

- No real provider API calls were made because no API keys are present in the local environment. Provider integration remains covered by no-key fallback checks and schema tests.
- Browser visual/localStorage behavior was not screenshot-tested because Playwright is not installed in this workspace. Static frontend assets and the full API game path were verified; `docs/MANUAL_ACCEPTANCE.md` remains the browser click-through script for a human or future browser-capable run.
- `POST /api/game/turn` is still non-streaming JSON. SSE remains a documented future roadmap item.
- General and magistrate identities still use generic Mock fallback behavior; emperor, minister, scholar, and official are the phase-one supported loops.

## Follow-Up Candidates

- Define the phase-two roadmap in `docs/DEVELOPMENT_STEPS.md`.
- Implement S04.4-style SSE streaming for turn feedback.
- Add browser automation or screenshot-based UI acceptance once a browser runner is available.
- Expand general and magistrate Mock loops.
- Run real-provider smoke tests when keys are available.
