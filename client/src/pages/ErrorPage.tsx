import { isRouteErrorResponse, useRouteError } from "react-router";

export function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? error.statusText : "案卷暂不可读";

  return (
    <section className="plainPage" aria-labelledby="error-title">
      <h1 id="error-title">卷页受阻</h1>
      <p>{message}</p>
    </section>
  );
}
