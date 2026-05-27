import { Link, useLocation } from "react-router";
import { Home, RotateCcw, ScrollText } from "lucide-react";
import { getRouteSessionRecoveryHref } from "../routes/routeRecovery";

export function NotFoundPage() {
  const location = useLocation();
  const recoveryHref = getRouteSessionRecoveryHref(location.pathname);

  return (
    <section className="plainPage statePage" aria-labelledby="not-found-title" data-polish-route-state="s89-19-route-recovery" data-state="empty">
      <div className="statePageSeal" aria-hidden="true">
        <ScrollText size={30} />
      </div>
      <div className="statePageCopy">
        <p className="eyebrow">案卷状态</p>
        <h1 id="not-found-title">案卷未载</h1>
        <p>案上未载此页，可回主卷续看当前案卷，或归首页另开一卷。</p>
        <p>空卷只指路，不补造案卷内容；待回主卷再听回音。</p>
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
