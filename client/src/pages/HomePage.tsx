import { Link } from "react-router";

export function HomePage() {
  return (
    <section className="homeScene" aria-labelledby="home-title">
      <div className="homeBackdrop" aria-hidden="true" />
      <div className="homeCopy">
        <p className="eyebrow">明月照案  墨色未干</p>
        <h1 id="home-title">千秋</h1>
        <p className="lede">一卷入世，万事由心。朝堂、贡院、边关与市井皆在纸上起伏。</p>
        <div className="homeActions" aria-label="案卷入口">
          <Link className="sealButton" to="/game/s74-preview">
            开卷
          </Link>
          <Link className="paperLink" to="/game/s74-preview/map">
            观舆图
          </Link>
        </div>
      </div>
    </section>
  );
}
