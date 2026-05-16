import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <section className="plainPage" aria-labelledby="not-found-title">
      <h1 id="not-found-title">无此卷页</h1>
      <p>案上未载此页。</p>
      <Link className="paperLink" to="/">
        归首页
      </Link>
    </section>
  );
}
