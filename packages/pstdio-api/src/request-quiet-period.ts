import type { MiddlewareHandler } from "hono";

const QUIET_PERIOD_MS = 30_000;

/** Long-lived event streams do not keep maintenance busy; a new request does. */
export const createRequestQuietPeriod = () => {
  let lastRequest = Date.now();
  const observe: MiddlewareHandler = (_context, next) => {
    lastRequest = Date.now();
    return next();
  };
  return { observe, isQuiet: () => Date.now() - lastRequest >= QUIET_PERIOD_MS };
};
