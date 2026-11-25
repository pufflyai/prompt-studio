// An enumerable symbol survives the object spreads the runner uses to extend a context.
const HOST_CONTEXT = Symbol.for("pstdio.runner.hostContext");

/** Marks a context the runner built, so a process-mode handler can tell it from ordinary arguments. */
export const markHostContext = <T extends object>(context: T) => Object.assign(context, { [HOST_CONTEXT]: true });

const NAVIGATION_SCOPED = Symbol.for("pstdio.runner.navigationScoped");

export const markNavigationScoped = <T extends object>(navigation: T) =>
  Object.assign(navigation, { [NAVIGATION_SCOPED]: true });

export const isNavigationScoped = (navigation: unknown) =>
  typeof navigation === "object" &&
  navigation !== null &&
  (navigation as Record<symbol, unknown>)[NAVIGATION_SCOPED] === true;

export const isHostContext = (
  value: unknown,
): value is { projectId: string; signal?: AbortSignal; navigation?: unknown } =>
  typeof value === "object" && value !== null && (value as Record<symbol, unknown>)[HOST_CONTEXT] === true;
