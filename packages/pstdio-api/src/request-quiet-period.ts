import type { MiddlewareHandler } from "hono";

const QUIET_PERIOD_MS = 30_000;

/** Active requests and recent writes defer maintenance. Idle read polling and
 * established event streams must not prevent cleanup indefinitely. */
export const createRequestQuietPeriod = () => {
  let lastWrite = Date.now();
  let active = 0;
  const observe: MiddlewareHandler = async (context, next) => {
    const method = context.req.method;
    const routes = context.req.matchedRoutes;
    let endpoint: string | undefined;
    for (let index = routes.length - 1; index >= 0; index--) {
      const route = routes[index]!;
      if (route.path === "*" || route.path === "/*") continue;
      endpoint = route.path;
      break;
    }
    const read =
      ["GET", "HEAD", "OPTIONS"].includes(method) ||
      (method === "POST" && endpoint !== undefined && /\/query(?:-page)?\/?$/.test(endpoint));
    active++;
    try {
      await next();
    } finally {
      active--;
      if (!read) lastWrite = Date.now();
    }
  };
  const isQuiet = () => active === 0 && Date.now() - lastWrite >= QUIET_PERIOD_MS;
  const whenQuiet = (run: () => void) => {
    const timer = setInterval(() => {
      if (!isQuiet()) return;
      clearInterval(timer);
      run();
    }, QUIET_PERIOD_MS);
    timer.unref();
    return () => clearInterval(timer);
  };
  return { observe, isQuiet, whenQuiet };
};
