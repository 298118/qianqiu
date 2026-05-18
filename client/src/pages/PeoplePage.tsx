import { useMemo, useState } from "react";
import { useAssetRegistry } from "../assets/useAssetRegistry";
import { Portrait } from "../components/Portrait";
import { markOverlayTrigger } from "../components/overlayFocus";
import { useUiStateStore } from "../state/uiState";

const portraitPageSize = 8;

export function PeoplePage() {
  const openSurface = useUiStateStore((state) => state.openSurface);
  const { registry, status, error } = useAssetRegistry();
  const [portraitPage, setPortraitPage] = useState(0);
  const portraits = useMemo(
    () => registry?.getPortraits({ usage: "people_page", preferHighResOverridesForFeminine: true }) ?? [],
    [registry]
  );
  const totalPages = Math.max(1, Math.ceil(portraits.length / portraitPageSize));
  const safePortraitPage = Math.min(portraitPage, totalPages - 1);
  const visiblePortraits = portraits.slice(safePortraitPage * portraitPageSize, safePortraitPage * portraitPageSize + portraitPageSize);
  const remasteredFeminine = portraits.filter((portrait) => portrait.genderPresentation === "feminine" && portrait.hasHighResOverride).length;

  return (
    <article className="surfacePanel routePanel" aria-labelledby="people-title">
      <h2 id="people-title">人物</h2>
      <p>师友、同年、官长与故人各有行藏，待谱牒逐页铺陈。</p>
      <section className="portraitLedger" aria-label="已审核立绘谱牒">
        <div className="portraitLedgerHeader">
          <div>
            <h3>立绘谱牒</h3>
            <p>
              {status === "ready"
                ? `已接入 ${portraits.length} 张人物页可用立绘；女性高清重制 ${remasteredFeminine} 张优先列前，其余使用已审核原图。`
                : "正在翻检已审核立绘。"}
            </p>
          </div>
          {status === "ready" ? <span>{safePortraitPage + 1} / {totalPages}</span> : null}
        </div>
        {status === "error" ? <p className="statusLine" role="alert">{error}</p> : null}
        {registry && visiblePortraits.length ? (
          <div className="portraitGrid" data-visible-portraits={visiblePortraits.length} data-total-portraits={portraits.length}>
            {visiblePortraits.map((portrait) => (
              <article className="portraitCard" key={portrait.portraitRef}>
                <Portrait
                  registry={registry}
                  portraitRef={portrait.portraitRef}
                  label={portrait.roleLabel ?? portrait.role ?? "人物立绘"}
                />
                <strong>{portrait.roleLabel ?? portrait.role ?? "人物"}</strong>
                <span>{portrait.hasHighResOverride ? "高清重制" : "原图入谱"}</span>
              </article>
            ))}
          </div>
        ) : null}
        {registry ? (
          <div className="buttonRow" aria-label="立绘分页">
            <button className="paperButton" type="button" disabled={safePortraitPage <= 0} onClick={() => setPortraitPage((page) => Math.max(0, page - 1))}>
              上一组
            </button>
            <button className="paperButton" type="button" disabled={safePortraitPage >= totalPages - 1} onClick={() => setPortraitPage((page) => Math.min(totalPages - 1, page + 1))}>
              下一组
            </button>
          </div>
        ) : null}
      </section>
      <button className="paperButton" type="button" onClick={(event) => { markOverlayTrigger(event.currentTarget); openSurface("npc-profile"); }}>
        打开人物档案
      </button>
    </article>
  );
}
