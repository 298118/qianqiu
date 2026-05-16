import { markOverlayTrigger } from "../components/overlayFocus";
import { useUiStateStore } from "../state/uiState";

export function CourtPage() {
  const openSurface = useUiStateStore((state) => state.openSurface);

  return (
    <article className="surfacePanel routePanel" aria-labelledby="court-title">
      <h2 id="court-title">朝议</h2>
      <p>百官班列，章奏如潮。朝议一起，天下便有回响。</p>
      <button className="paperButton" type="button" onClick={(event) => { markOverlayTrigger(event.currentTarget); openSurface("edict-draft"); }}>
        拟圣旨
      </button>
    </article>
  );
}
