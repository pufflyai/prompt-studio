import type { MiddlewareHandler } from "hono";
import { withRuntimeOperationOrigin } from "pstdio-diagnostics";
import type { AppBindings } from "../../types";

/** Route patterns retain the request owner without copying URLs, resource IDs or query strings. */
export const runtimeOperationOrigin: MiddlewareHandler<AppBindings> = (context, next) =>
  withRuntimeOperationOrigin(
    { kind: "request", name: `${context.req.method} ${context.req.matchedRoutes.at(-1)?.path ?? "unmatched"}` },
    next,
  );
