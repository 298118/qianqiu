import { Link, useLocation, useRouteError } from "react-router";
import { Home, RotateCcw, ScrollText } from "lucide-react";
import { getRouteSessionRecoveryHref, getSafeRouteErrorMessage } from "../routes/routeRecovery";

export function ErrorPage() {
  const error = useRouteError();
  const location = useLocation();
  const recoveryHref = getRouteSessionRecoveryHref(location.pathname);
  const message = getSafeRouteErrorMessage(error);

  return (
    <section className="plainPage statePage" aria-labelledby="error-title" data-polish-route-state="s89-19-route-recovery">
      <div className="statePageSeal" aria-hidden="true">
        <ScrollText size={30} />
      </div>
      <div className="statePageCopy">
        <p className="eyebrow">断卷</p>
        <h1 id="error-title">卷页受阻</h1>
        <p>{message}</p>
        <p>此页只给安全归路，不显示底层诊断、推演原文或本机路径。</p>
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
