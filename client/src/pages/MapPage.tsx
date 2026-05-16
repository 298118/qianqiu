import { markOverlayTrigger } from "../components/overlayFocus";
import { useUiStateStore } from "../state/uiState";

export function MapPage() {
  const openSurface = useUiStateStore((state) => state.openSurface);

  return (
    <article className="surfacePanel routePanel" aria-labelledby="map-title">
      <h2 id="map-title">舆图</h2>
      <p>山河分卷，驿路如线。边声、贡院与府县皆可由此入眼。</p>
      <button className="paperButton" type="button" onClick={(event) => { markOverlayTrigger(event.currentTarget); openSurface("map-filter"); }}>
        筛舆图
      </button>
    </article>
  );
}
