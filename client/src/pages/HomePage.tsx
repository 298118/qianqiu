import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useGameSessionStore } from "../state/gameSessionState";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUiStateStore } from "../state/uiState";
import type { GameRole } from "../api";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import type { AssetRegistry, RuntimePortraitAsset } from "../assets/assetRegistry";
import { Portrait } from "../components/Portrait";
import { SaveCaseList } from "../components/SaveCaseList";
import { isRunnableSessionId } from "../routes/sessionId";

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

const roleLabels: Record<string, string> = {
  scholar: "书生",
  official: "入仕官员",
  emperor: "皇帝",
  minister: "大臣",
  general: "将领",
  magistrate: "县令"
};

const sourceLabels: Record<string, string> = {
  start: "新卷",
  "player-state": "读档",
  turn: "回合",
  "exam-submit": "科举"
};

const unsafeHomeSummaryPattern = /\/api\/game\/state|\/api\/dev\/session-diagnostics|data[\\/]+sessions|[a-z]:[\\/]|file:\/{2}|raw\b|provider\b|prompt\b|hidden\b|key\b|path\b|hiddenNotes|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[a-z0-9_-]+|\bTODO\b|\bFIXME\b|\bsmoke\b|\bartifacts?\b|\bS7[0-9](?:\.\d+)?\b|\bdebug\b|\bstub\b|\bplaceholder\b|fallback token|完整提示词|提示词|本地路径|密钥|隐藏|私档|模型原始|验收|测试截图|开发注释|实现说明/i;
const safePortraitRefPattern = /^portrait-[a-z0-9][a-z0-9_-]{0,140}$/i;
const unsafePortraitRefTokenPattern = /(?:^|[-_])(raw|provider|prompt|hidden|private|key|path|secret|token|api|file|data|http)(?:$|[-_])/i;

const playerPortraitRoleByGameRole: Record<GameRole, string> = {
  scholar: "scholar",
  official: "junior-official",
  magistrate: "local-official",
  minister: "grand-minister",
  general: "general",
  emperor: "emperor-regent"
};

function getRoleNote(role: GameRole) {
  return roleOptions.find((option) => option.value === role)?.note || "";
}

function getScholarFamilyText(value: ScholarFamilyBackground) {
  return scholarFamilyOptions.find((option) => option.value === value)?.text || scholarFamilyOptions[1].text;
}

function safeHomeSummaryText(value: unknown, fallback: string) {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return unsafeHomeSummaryPattern.test(text) ? fallback : text;
}

function safePortraitRef(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || !safePortraitRefPattern.test(text)) return "";
  return unsafePortraitRefTokenPattern.test(text) ? "" : text;
}

function getPlayerPortraitChoices(registry: AssetRegistry | null, role: GameRole) {
  if (!registry) return [];
  const rolePortraits = registry.getInitialPortraits({
    usage: "people_page",
    lazyLoadGroup: "portrait_pool_player_s73_10",
    role: playerPortraitRoleByGameRole[role],
    identityTags: ["player"],
    preferHighResOverridesForFeminine: true
  }, { limit: 6 });
  if (rolePortraits.length) return rolePortraits;
  return registry.getInitialPortraits({
    usage: "people_page",
    identityTags: ["player"],
    preferHighResOverridesForFeminine: true
  }, { limit: 6 });
}

type CurrentPlayerPayload = NonNullable<ReturnType<typeof useUiStateStore.getState>["currentPlayerPayload"]>;

function getContinueIdentity(payload: CurrentPlayerPayload) {
  const player = payload.player;
  return safeHomeSummaryText(player?.officeTitle || player?.examRank || (player?.role ? roleLabels[player.role] || player.role : ""), "身份未题");
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(query.matches);
    handleChange();
    query.addEventListener?.("change", handleChange);
    return () => query.removeEventListener?.("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

export function HomePage() {
  const navigate = useNavigate();
  const refreshSaves = useGameSessionStore((state) => state.refreshSaves);
  const startNewGame = useGameSessionStore((state) => state.startNewGame);
  const saves = useGameSessionStore((state) => state.saves);
  const status = useGameSessionStore((state) => state.status);
  const savesStatus = useGameSessionStore((state) => state.savesStatus);
  const error = useGameSessionStore((state) => state.error);
  const { registry: assetRegistry } = useAssetRegistry();
  const displayMotion = useUiStateStore((state) => state.displayPreferences.motion);
  const currentSessionId = useUiStateStore((state) => state.currentSessionId);
  const currentPlayerPayload = useUiStateStore((state) => state.currentPlayerPayload);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [playerName, setPlayerName] = useState("沈知微");
  const [role, setRole] = useState<GameRole>("scholar");
  const [dynasty, setDynasty] = useState("明");
  const [year, setYear] = useState("1600");
  const [scholarFamily, setScholarFamily] = useState<ScholarFamilyBackground>("modest");
  const [selectedPortraitRef, setSelectedPortraitRef] = useState("");
  const [customBackground, setCustomBackground] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [sealFeedback, setSealFeedback] = useState<"idle" | "stamping" | "error">("idle");
  const submitLockRef = useRef(false);
  const stampTimerRef = useRef<number | null>(null);
  const motionAllowed = displayMotion !== "reduced" && !prefersReducedMotion;
  const isStarting = status === "loading" || submitLockRef.current;
  const parsedYear = Number(year);
  const yearIsValid = Number.isInteger(parsedYear) && parsedYear >= 1 && parsedYear <= 9999;
  const canContinueCurrentSession = Boolean(
    currentSessionId &&
    currentPlayerPayload &&
    currentPlayerPayload.sessionId === currentSessionId &&
    isRunnableSessionId(currentSessionId)
  );
  const portraitChoices = useMemo(
    () => getPlayerPortraitChoices(assetRegistry, role),
    [assetRegistry, role]
  );
  const selectedPortrait = useMemo(
    () => portraitChoices.find((portrait) => portrait.portraitRef === selectedPortraitRef) ?? null,
    [portraitChoices, selectedPortraitRef]
  );

  useEffect(() => {
    void refreshSaves();
  }, [refreshSaves]);

  useEffect(() => {
    if (!portraitChoices.length) {
      if (selectedPortraitRef) setSelectedPortraitRef("");
      return;
    }
    if (!selectedPortrait) {
      setSelectedPortraitRef(portraitChoices[0].portraitRef);
    }
  }, [portraitChoices, selectedPortrait, selectedPortraitRef]);

  useEffect(() => () => {
    if (stampTimerRef.current !== null) {
      window.clearTimeout(stampTimerRef.current);
    }
  }, []);

  function markSealFeedback(state: "idle" | "stamping" | "error") {
    if (stampTimerRef.current !== null) {
      window.clearTimeout(stampTimerRef.current);
      stampTimerRef.current = null;
    }
    setSealFeedback(state);
    if (state !== "idle") {
      stampTimerRef.current = window.setTimeout(() => {
        setSealFeedback("idle");
        stampTimerRef.current = null;
      }, state === "stamping" ? 420 : 1200);
    }
  }

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current || status === "loading") {
      return;
    }

    if (!yearIsValid) {
      setFormError("年份需为 1 至 9999 之间的整数。");
      markSealFeedback("error");
      return;
    }

    setFormError(null);
    submitLockRef.current = true;
    if (motionAllowed) {
      markSealFeedback("stamping");
    } else {
      setSealFeedback("idle");
    }
    try {
      const payload = await startNewGame({
        dynasty,
        year: parsedYear,
        role,
        playerName: playerName.trim() || "无名书生",
        ...(safePortraitRef(selectedPortraitRef) ? { portraitRef: safePortraitRef(selectedPortraitRef) } : {}),
        ...(role === "scholar" ? { familyBackground: scholarFamily } : {}),
        customSetting: customBackground.trim()
      });
      navigate(`/game/${payload.sessionId}`);
    } catch {
      submitLockRef.current = false;
      markSealFeedback("error");
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
          <form
            className={`startDesk${error || formError ? " startDeskError" : ""}`}
            onSubmit={handleStart}
            aria-label="新开案卷"
            aria-busy={isStarting}
          >
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
            {assetRegistry && portraitChoices.length ? (
              <fieldset className="portraitChoiceField">
                <legend>案主立绘</legend>
                <div className="portraitChoiceGrid" data-visible-portraits={portraitChoices.length}>
                  {portraitChoices.map((portrait: RuntimePortraitAsset) => (
                    <label className="portraitChoiceCard" key={portrait.portraitRef}>
                      <input
                        type="radio"
                        name="player-portrait"
                        value={portrait.portraitRef}
                        checked={selectedPortraitRef === portrait.portraitRef}
                        onChange={() => setSelectedPortraitRef(portrait.portraitRef)}
                        disabled={isStarting}
                      />
                      <Portrait
                        registry={assetRegistry}
                        portraitRef={portrait.portraitRef}
                        label={portrait.roleLabel ?? portrait.role ?? "案主立绘"}
                      />
                      <span>{portrait.hasHighResOverride ? "高清重制" : "原图入谱"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
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
            <button
              className={`sealButton homeStartSeal${sealFeedback === "stamping" ? " isStamping" : ""}${sealFeedback === "error" ? " isSealError" : ""}`}
              type="submit"
              disabled={isStarting}
              aria-describedby="start-seal-status"
              data-state={error || formError ? "error" : isStarting ? "loading" : "idle"}
            >
              <span>{isStarting ? "开卷中" : error || formError ? "重整朱印" : "新开一卷"}</span>
            </button>
          </form>
          <p className="sealStatus" id="start-seal-status" aria-live="polite">
            {isStarting ? "朱印已落，正在开卷。" : error || formError ? "朱印未成，请校正案头信息。" : "按下朱印，新卷即启。"}
          </p>
          {formError ? <p className="statusLine" role="alert">{formError}</p> : null}
          {error ? <p className="statusLine" role="alert">{error}</p> : null}
        </div>
        {canContinueCurrentSession && currentSessionId && currentPlayerPayload ? (
          <section className="continueShelf" aria-label="当前本局">
            <div>
              <p className="eyebrow">当前本局</p>
              <h2>{safeHomeSummaryText(currentPlayerPayload.player?.name, "无名")}</h2>
              <p>{getContinueIdentity(currentPlayerPayload)}</p>
            </div>
            <dl className="continueMeta" aria-label="本局摘要">
              <div>
                <dt>案卷</dt>
                <dd>案 {currentSessionId.slice(0, 8)}</dd>
              </div>
              <div>
                <dt>来源</dt>
                <dd>{sourceLabels[currentPlayerPayload.source] || "安全视图"}</dd>
              </div>
            </dl>
            <Link className="paperButton continueButton" to={`/game/${currentSessionId}`}>
              继续本局
            </Link>
          </section>
        ) : null}
        <section className="saveShelf" aria-label="旧案卷">
          <h2>旧案卷</h2>
          {savesStatus === "loading" ? <p>正在翻检案卷。</p> : null}
          {saves.length ? (
            <SaveCaseList saves={saves} maxItems={5} className="homeSaveCases" />
          ) : (
            <p>暂无可读旧卷。</p>
          )}
        </section>
      </div>
    </section>
  );
}
