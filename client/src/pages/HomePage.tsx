import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useGameSessionStore } from "../state/gameSessionState";
import { useEffect, useState } from "react";

export function HomePage() {
  const navigate = useNavigate();
  const refreshSaves = useGameSessionStore((state) => state.refreshSaves);
  const startNewGame = useGameSessionStore((state) => state.startNewGame);
  const saves = useGameSessionStore((state) => state.saves);
  const status = useGameSessionStore((state) => state.status);
  const savesStatus = useGameSessionStore((state) => state.savesStatus);
  const error = useGameSessionStore((state) => state.error);
  const [playerName, setPlayerName] = useState("沈知微");
  const [role, setRole] = useState("scholar");

  useEffect(() => {
    void refreshSaves();
  }, [refreshSaves]);

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const payload = await startNewGame({
        dynasty: "明",
        year: 1600,
        role: role === "official" ? "official" : "scholar",
        playerName: playerName.trim() || "无名书生"
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
              姓名
              <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={24} />
            </label>
            <label>
              身份
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="scholar">书生</option>
                <option value="official">入仕官员</option>
              </select>
            </label>
            <button className="sealButton homeStartSeal" type="submit" disabled={status === "loading"}>
              {status === "loading" ? "开卷中" : "新开一卷"}
            </button>
          </form>
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
