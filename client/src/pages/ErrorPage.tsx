import { Link, useLocation, useRouteError } from "react-router";
import { getRouteSessionRecoveryHref, getSafeRouteErrorMessage } from "../routes/routeRecovery";

export function ErrorPage() {
  const error = useRouteError();
  const location = useLocation();
  const recoveryHref = getRouteSessionRecoveryHref(location.pathname);
  const message = getSafeRouteErrorMessage(error);

  return (
    <section className="plainPage" aria-labelledby="error-title">
      <h1 id="error-title">卷页受阻</h1>
      <p>{message}</p>
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
