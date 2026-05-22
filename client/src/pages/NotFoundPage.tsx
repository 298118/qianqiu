import { Link, useLocation } from "react-router";
import { getRouteSessionRecoveryHref } from "../routes/routeRecovery";

export function NotFoundPage() {
  const location = useLocation();
  const recoveryHref = getRouteSessionRecoveryHref(location.pathname);

  return (
    <section className="plainPage" aria-labelledby="not-found-title">
      <h1 id="not-found-title">无此卷页</h1>
      <p>案上未载此页。</p>
      <div className="buttonRow" aria-label="卷页去处">
        {recoveryHref ? (
          <Link className="paperLink" to={recoveryHref}>
            回主卷
          </Link>
        ) : null}
        <Link className="paperLink" to="/">
          归首页
        </Link>
      </div>
    </section>
  );
}
