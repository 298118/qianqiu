import { markOverlayTrigger } from "../components/overlayFocus";
import { useUiStateStore } from "../state/uiState";

export function PeoplePage() {
  const openSurface = useUiStateStore((state) => state.openSurface);

  return (
    <article className="surfacePanel routePanel" aria-labelledby="people-title">
      <h2 id="people-title">人物</h2>
      <p>师友、同年、官长与故人各有行藏，待谱牒逐页铺陈。</p>
      <button className="paperButton" type="button" onClick={(event) => { markOverlayTrigger(event.currentTarget); openSurface("npc-profile"); }}>
        打开人物档案
      </button>
    </article>
  );
}
