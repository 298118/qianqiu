# Qianqiu Manual Acceptance Script

Use this checklist before marking a release slice as playable. Keep `AI_PROVIDER=mock` unless the goal is specifically to verify a real provider.

## 1. Start The App

```powershell
npm install
$env:AI_PROVIDER = "mock"
$env:PORT = "3000"
npm start
```

Open `http://localhost:3000` and confirm:

- The opening setup screen loads.
- A new scholar game can be created.
- Refreshing the page restores the active session from local storage.

Optional automated browser smoke for the same opening/restoration surface:

```powershell
npm run smoke:browser -- --url http://localhost:3000
```

The smoke uses a local Chrome or Edge executable. Set `BROWSER_EXECUTABLE_PATH` or pass `--browser <path>` if the browser is installed outside the standard location.

## 2. API Smoke Check

Run these commands in a second PowerShell window while the server is running:

```powershell
$base = "http://localhost:3000"
$headers = @{ "Content-Type" = "application/json" }

Invoke-RestMethod "$base/api/health"

$startBody = @{
  dynasty = "Ming"
  year = 1644
  role = "scholar"
  playerName = "QA Scholar"
  background = "county school student"
  customSetting = "manual acceptance run"
} | ConvertTo-Json

$game = Invoke-RestMethod -Method Post -Uri "$base/api/game/start" -Headers $headers -Body $startBody
$sessionId = $game.sessionId

function Invoke-QianqiuTurn($text) {
  $body = @{ sessionId = $sessionId; input = $text } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$base/api/game/turn" -Headers $headers -Body $body
}

Invoke-QianqiuTurn "研读《论语》三日"
Invoke-QianqiuTurn "拜访塾师请教经义"
Invoke-QianqiuTurn "游学结交同窗"
Invoke-QianqiuTurn "辩论经义"
Invoke-QianqiuTurn "代写文章赚取盘缠"

$state = Invoke-RestMethod "$base/api/game/state/$sessionId"
$state.worldState.player
```

Expected result: the session exists, `turnCount` increases, scholar attributes change, and the player records books, teacher, or connections through normal server patches.

## 3. Scholar-To-Official Path

In the browser, play a scholar session through these checkpoints:

1. Build readiness with several daily actions: study, teacher visit, travel/social, debate, and work for money.
2. Open the next exam from the scholar panel or by entering `参加考试`.
3. Confirm the exam modal shows the level, question, requirements, word-count guidance, and submit button.
4. Submit a period-appropriate essay with no modern terms. Repeat for:
   - child exam
   - provincial exam
   - metropolitan exam
   - palace exam
5. After the palace exam, confirm the player becomes `official`, receives a palace rank/office title, and sees the official role panel.
6. Enter an official action such as `观政学习旧案章程`; confirm the official loop updates influence/reputation or related role metrics.

Expected result: the complete path remains scholar -> child exam -> provincial exam -> metropolitan exam -> palace exam -> official, and every submitted essay is stored in `player.examHistory`.

## 4. Exam Integrity Checks

Start or reuse a scholar exam and submit three essays:

- A very short answer such as `AI`.
- An answer containing modern terms, for example `AI`, `手机`, or `互联网`.
- A normal period-style essay that avoids modern terms and copied classic passages.

Expected result: short and anachronistic essays show monitoring flags and score penalties; copied or severe fraud forces failure/downgrade; normal essays show score dimensions, virtual candidates, ranking, and promotion status.

## 5. Role Loop Smoke Checks

Create one game for each role and submit one matching action:

- Emperor: `下诏赈灾并开仓给粮`
- Minister: `上疏清查积弊并督办公务`
- Official: use a promoted scholar or start as official if enabled, then enter `观政学习旧案章程`

Expected result: each role returns narrative text and changes only whitelisted state fields.

## 6. Finish Criteria

Before handing off:

```powershell
npm test
git status --short
```

Record any failures, skipped manual checks, or provider-specific limitations in `docs/SHARED_CONTEXT.md` and `docs/DEVELOPMENT_STEPS.md`.
