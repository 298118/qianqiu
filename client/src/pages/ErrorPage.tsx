import { Link, useLocation, useRouteError } from "react-router";
import { Home, RotateCcw, ScrollText } from "lucide-react";
import { getRouteSessionRecoveryHref, getSafeRouteErrorMessage } from "../routes/routeRecovery";

export function ErrorPage() {
  const error = useRouteError();
  const location = useLocation();
  const recoveryHref = getRouteSessionRecoveryHref(location.pathname);
  const message = getSafeRouteErrorMessage(error);

  return (
    <section className="plainPage statePage" aria-labelledby="error-title" data-polish-route-state="s89-19-route-recovery" data-state="error">
      <div className="statePageSeal" aria-hidden="true">
        <ScrollText size={30} />
      </div>
      <div className="statePageCopy">
        <p className="eyebrow">案卷状态</p>
        <h1 id="error-title">卷页待回音</h1>
        <p>{message}</p>
        <p>此页只给归路；案卷未载之事不在此补写，待回主卷再看。</p>
      </div>
      <div className="buttonRow statePageActions" aria-label="卷页去处">
        {recoveryHref ? (
          <Link className="paperLink" to={recoveryHref}>
            <RotateCcw size={16} aria-hidden="true" />
            <span>回主卷</span>
          </Link>
        ) : null}
        <Link className="paperLink" to="/">
          <Home size={16} aria-hidden="true" />
          <span>归首页</span>
        </Link>
      </div>
    </section>
  );
}
