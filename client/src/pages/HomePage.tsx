import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useGameSessionStore } from "../state/gameSessionState";
import { useEffect, useState } from "react";
import type { GameRole } from "../api";

type ScholarFamilyBackground = "poor" | "modest" | "gentry";

const dynastyOptions = [
  { value: "明", label: "明" },
  { value: "宋", label: "宋" },
  { value: "唐", label: "唐" },
  { value: "元", label: "元" },
  { value: "清", label: "清" }
] as const;

const roleOptions: readonly { value: GameRole; label: string; note: string }[] = [
  { value: "scholar", label: "书生", note: "寒窗读书，仍循科举入仕。" },
  { value: "official", label: "入仕官员", note: "新科观政，案牍与人情并至。" },
  { value: "magistrate", label: "县令", note: "亲民官到任，刑名钱粮皆压案头。" },
  { value: "minister", label: "大臣", note: "部院持衡，朝局与制度互相牵动。" },
  { value: "general", label: "将领", note: "边镇统军，粮饷、士气与战机并重。" },
  { value: "emperor", label: "皇帝", note: "临朝听政，天下奏报汇于御前。" }
] as const;

const scholarFamilyOptions: readonly { value: ScholarFamilyBackground; label: string; text: string }[] = [
  { value: "poor", label: "贫寒", text: "家境贫寒，束修纸笔皆须斟酌。" },
  { value: "modest", label: "普通", text: "家境普通，尚能供其入学应试。" },
  { value: "gentry", label: "世家", text: "出身地方世家，族中旧望既是助力亦是牵累。" }
] as const;

function getRoleNote(role: GameRole) {
  return roleOptions.find((option) => option.value === role)?.note || "";
}

function getScholarFamilyText(value: ScholarFamilyBackground) {
  return scholarFamilyOptions.find((option) => option.value === value)?.text || scholarFamilyOptions[1].text;
}

export function HomePage() {
  const navigate = useNavigate();
  const refreshSaves = useGameSessionStore((state) => state.refreshSaves);
  const startNewGame = useGameSessionStore((state) => state.startNewGame);
  const saves = useGameSessionStore((state) => state.saves);
  const status = useGameSessionStore((state) => state.status);
  const savesStatus = useGameSessionStore((state) => state.savesStatus);
  const error = useGameSessionStore((state) => state.error);
  const [playerName, setPlayerName] = useState("沈知微");
  const [role, setRole] = useState<GameRole>("scholar");
  const [dynasty, setDynasty] = useState("明");
  const [year, setYear] = useState("1600");
  const [scholarFamily, setScholarFamily] = useState<ScholarFamilyBackground>("modest");
  const [customBackground, setCustomBackground] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const isStarting = status === "loading";
  const parsedYear = Number(year);
  const yearIsValid = Number.isInteger(parsedYear) && parsedYear >= 1 && parsedYear <= 9999;

  useEffect(() => {
    void refreshSaves();
  }, [refreshSaves]);

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isStarting) {
      return;
    }

    if (!yearIsValid) {
      setFormError("年份需为 1 至 9999 之间的整数。");
      return;
    }

    setFormError(null);
    try {
      const payload = await startNewGame({
        dynasty,
        year: parsedYear,
        role,
        playerName: playerName.trim() || "无名书生",
        ...(role === "scholar" ? { familyBackground: scholarFamily } : {}),
        customSetting: customBackground.trim()
      });
      navigate(`/game/${payload.sessionId}`);
    } catch {
    }
  }

  return (
    <section className="homeScene" aria-labelledby="home-title">
      <div className="homeBackdrop" aria-hidden="true" />
      <div className="homeMist homeMistA" aria-hidden="true" />
      <div className="homeMist homeMistB" aria-hidden="true" />
      <div className="homeScrollCaps" aria-hidden="true" />
      <div className="homeCopy">
        <div className="homeTitleBlock">
          <p className="eyebrow">明月照案 墨色未干</p>
          <h1 id="home-title">千秋</h1>
          <p className="lede">一卷入世，万事由心。朝堂、贡院、边关与市井皆在纸上起伏。</p>
        </div>
        <div className="homeDesk">
          <div className="homeDeskHeader">
            <span>题名入册</span>
            <div className="homeActions" aria-label="案卷入口">
              <Link className="paperLink" to="/game/s74-preview">
                预览
              </Link>
              <Link className="paperLink" to="/game/s74-preview/map">
                观舆图
              </Link>
            </div>
          </div>
          <form className="startDesk" onSubmit={handleStart} aria-label="新开案卷">
            <label>
              朝代
              <select value={dynasty} onChange={(event) => setDynasty(event.target.value)} disabled={isStarting}>
                {dynastyOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              年份
              <input
                inputMode="numeric"
                max="9999"
                min="1"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                disabled={isStarting}
                aria-invalid={!yearIsValid}
              />
            </label>
            <label>
              身份
              <select value={role} onChange={(event) => setRole(event.target.value as GameRole)} disabled={isStarting}>
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              姓名
              <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={24} disabled={isStarting} />
            </label>
            {role === "scholar" ? (
              <fieldset className="familyField">
                <legend>书生家境</legend>
                <div className="segmentedChoices">
                  {scholarFamilyOptions.map((option) => (
                    <label key={option.value} className="choicePill">
                      <input
                        type="radio"
                        name="scholar-family"
                        value={option.value}
                        checked={scholarFamily === option.value}
                        onChange={() => setScholarFamily(option.value)}
                        disabled={isStarting}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="roleNote">{getRoleNote(role)}</p>
            )}
            {role === "scholar" ? <p className="roleNote">{getScholarFamilyText(scholarFamily)}</p> : null}
            <label className="backgroundField">
              自定背景
              <textarea
                value={customBackground}
                onChange={(event) => setCustomBackground(event.target.value)}
                maxLength={160}
                rows={3}
                disabled={isStarting}
                placeholder="如：幼承庭训，曾随父游学江南。"
              />
            </label>
            <button className="sealButton homeStartSeal" type="submit" disabled={isStarting}>
              {isStarting ? "开卷中" : "新开一卷"}
            </button>
          </form>
          {formError ? <p className="statusLine" role="alert">{formError}</p> : null}
          {error ? <p className="statusLine" role="alert">{error}</p> : null}
        </div>
        <section className="saveShelf" aria-label="旧案卷">
          <h2>旧案卷</h2>
          {savesStatus === "loading" ? <p>正在翻检案卷。</p> : null}
          {saves.length ? (
            <div className="saveList">
              {saves.slice(0, 5).map((save) => (
                <Link className="saveItem" key={save.sessionId} to={`/game/${save.sessionId}`}>
                  <strong>{save.playerName || "无名"}</strong>
                  <span>{save.officeTitle || save.examRank || save.role || "未题"}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p>暂无可读旧卷。</p>
          )}
        </section>
      </div>
    </section>
  );
}
