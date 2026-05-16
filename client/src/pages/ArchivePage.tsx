import { markOverlayTrigger } from "../components/overlayFocus";
import { useUiStateStore } from "../state/uiState";

export function ArchivePage() {
  const openSurface = useUiStateStore((state) => state.openSurface);

  return (
    <article className="surfacePanel routePanel" aria-labelledby="archive-title">
      <h2 id="archive-title">史册</h2>
      <p>风闻、案牍、朝报与旧事会在此归册，留给后来人复读。</p>
      <button className="paperButton" type="button" onClick={(event) => { markOverlayTrigger(event.currentTarget); openSurface("memorial-review"); }}>
        阅奏折
      </button>
    </article>
  );
}
