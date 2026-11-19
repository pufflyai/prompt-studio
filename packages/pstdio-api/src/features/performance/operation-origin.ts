import type { MiddlewareHandler } from "hono";
import { withRuntimeOperationOrigin } from "pstdio-diagnostics";
import type { AppBindings } from "../../types";

/** Route patterns retain the request owner without copying URLs, resource IDs or query strings. */
export const runtimeOperationOrigin: MiddlewareHandler<AppBindings> = (context, next) => {
  const routes = context.req.matchedRoutes;
  let endpoint = routes.at(-1)?.path ?? "unmatched";
  for (let index = routes.length - 1; index >= 0; index--) {
    const route = routes[index]!;
    if (route.path === "*" || route.path === "/*") continue;
    endpoint = route.path;
    break;
  }
  return withRuntimeOperationOrigin(
    {
      kind: "request",
      name: `${context.req.method} ${endpoint}`,
    },
    next,
  );
};
