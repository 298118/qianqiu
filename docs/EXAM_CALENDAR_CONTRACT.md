# Exam Calendar Contract

S35 makes the imperial examination loop calendar-aware while preserving the server-owned exam boundary.

## Persisted State

`worldState.examCalendar` is server-owned:

```json
{
  "schemaVersion": 1,
  "missedWindows": [],
  "recentSessions": [],
  "rivals": [],
  "nextRivalNumber": 1
}
```

- `missedWindows` records closed-window attempts after the player has missed that period.
- `recentSessions` summarizes recent exam sittings, player place, cohort size, and how many rivals became peers.
- `rivals` stores persistent same-field candidates across exams.
- `nextRivalNumber` creates stable `rival-001` style ids.

Ordinary providers cannot patch `examCalendar`. Route code and `src/game/examCalendar.js` own normalization, views, missed-window records, rival persistence, and official peer contact promotion.

## Exam Windows

`src/game/examCalendar.js` defines the first deterministic windows:

| Level | Window Months | Prep | Travel |
| --- | --- | --- | --- |
| `child_exam` | 1, 2, 4, 7, 10 | 1 month | 0 months |
| `provincial_exam` | 8, 9 | 6 months | 1 month |
| `metropolitan_exam` | 2, 3 | 8 months | 2 months |
| `palace_exam` | 4 | 2 months | 0 months |

`POST /api/exam/question` reuses an already-open unanswered exam without rechecking the current month. For a new question, the route checks `canEnterExam()` first, then `canOpenExamInCalendar()` before charging travel/preparation costs or asking the provider for a question. Closed-window attempts return `409`. Missed-window attempts are persisted without charging travel or creating `activeExam`.

Free-text exam requests are initiated through ordinary `POST /api/game/turn` via `examTrigger`. S48.3 ordinary turns advance one ten-day period, and only 下旬 rollover advances the world month before the browser auto-opens `/api/exam/question`. The turn route preserves an open calendar snapshot on the temporary `activeExam` request; the question route may use that same-level open snapshot once, so a valid request made in the last open month/late period is not converted into a missed-window error by month-end rollover.

S48.4 adds exam-local scene time on top of this calendar snapshot. `activeExam.sceneTime.startedAt` records the server-owned 年/月/旬/turnCount when the exam scene began; if the player legally triggered a same-level exam in an open 下旬 and ordinary旬制 then rolled to the next month before the browser requested `/api/exam/question`, the formal question keeps the original open snapshot and started-at date.

S48.6 adds visible date fields to calendar views and snapshots: `currentTenDayPeriod` and `currentDateLabel`. The calendar window is still month-based, so 正月上旬、正月中旬、正月下旬 are all legal for `child_exam`, but the browser can show the exact scene entry date in the 科期 panel, writing modal, result archive, and final exam-history modal.

## Entry Preparation

`src/game/examTravel.js` still owns level-specific gold costs and funded/shortfall effects. S35 adds calendar details to `entryPreparation`:

- `travelMonths`
- nested `examCalendar`
- current/open/next window labels, including `currentTenDayPeriod` and `currentDateLabel`
- preparation and travel month counts
- funding readiness
- teacher recommendation status
- local quota note

The same `entryPreparation` object is stored on `activeExam`, copied to `player.examHistory`, and rendered in the browser result/archive.

## Exam Scene Time

`src/game/examSceneTime.js` owns S48.4 local exam phases:

- `entry`
- `question_review`
- `outline`
- `drafting`
- `fair_copy`
- `submitted`

`POST /api/exam/question` writes or preserves `activeExam.sceneTime` without advancing global time. `POST /api/exam/progress` advances only that local phase, returns `worldTick.cadence = "scene"`, and leaves `turnCount/year/month/tenDayPeriod` unchanged. `POST /api/game/turn` follows the same scene-local route when an active writing exam exists. `POST /api/exam/submit` marks the scene `submitted` and stores `sceneTime`, `examStartedAt`, and `examSubmittedAt` in `player.examHistory`.

## Persistent Rivals

`generateVirtualCandidates()` can receive persistent seeds from `selectPersistentCandidateSeeds()`. After generation, `preparePersistentExamCohort()` gives every candidate a stable rival id and stores their base profile in `worldState.examCalendar.rivals`.

On submit, `recordExamCohortResult()` appends each rival's result attempt, updates peer/rival status, records a recent session summary, and can add palace-exam peers to `worldState.characters` as visible `同年进士` contacts after the player becomes an official.

The browser receives top-level:

- `examCalendarView`
- `examRivalView`

Player-facing UI uses these views rather than raw `worldState.examCalendar`.

## Route Payloads

Game start, state, and turn payloads now include `examCalendarView` and `examRivalView`.

Exam question payloads include:

- `examCalendar`
- `sceneTime`
- `examCalendarView`
- `examRivalView`

Exam progress payloads include:

- `examCalendar`
- `sceneTime`
- `examScene`
- `worldTick` with `cadence: "scene"`
- `examCalendarView`
- `examRivalView`

Exam submit payloads include:

- `examCalendar`
- `sceneTime`
- `examStartedAt`
- `examSubmittedAt`
- `cohortResult`
- `examCalendarView`
- `examRivalView`

## Verification

Focused coverage:

- `test/examCalendar.test.js`
- `test/examTravel.test.js`
- `test/gameTurnTick.test.js`
- `test/stateRules.test.js`
- `test/browserSmokeScript.test.js`

Browser smoke checks the new `#exam-calendar-panel`, `#exam-rival-panel`, calendar details inside the writing modal, calendar archive details, persistent rival notes, and horizontal overflow for the new panels.
S48.6 extends that smoke to set `tenDayPeriod` together with the legal exam month and to fail if calendar/modal/archive text loses the visible 上旬/中旬/下旬 label.
