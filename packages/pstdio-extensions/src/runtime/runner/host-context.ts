import type { ExtensionLoggerApi } from "@pstdio/sdk/extensions";
import type { InvocationScope } from "./scope";

// An enumerable symbol survives the object spreads the runner uses to extend a context.
const HOST_CONTEXT = Symbol.for("pstdio.runner.hostContext");

const BACKEND_SCOPE = Symbol.for("pstdio.runner.backendScope");

type BackendScopeBinding<T extends object> = {
  logger: ExtensionLoggerApi;
  withScope: (scope: InvocationScope) => Partial<T>;
};

/** Marks a host-built context and optionally binds worker-only resources to an invocation. */
export const markHostContext = <T extends object>(context: T, backendScope?: BackendScopeBinding<T>) =>
  Object.assign(context, { [HOST_CONTEXT]: true, ...(backendScope && { [BACKEND_SCOPE]: backendScope }) });

export const backendScopeFor = (context: unknown) =>
  isHostContext(context) ? (context as { [BACKEND_SCOPE]?: BackendScopeBinding<object> })[BACKEND_SCOPE] : undefined;

/** Apply the same context change after the backend installs invocation-owned resources. */
export const mapHostContext = <T extends object>(context: T, map: (context: T) => T) => {
  const mapped = map(context);
  const binding = backendScopeFor(context);
  if (!binding) return mapped;
  return markHostContext(mapped, {
    logger: binding.logger,
    withScope: (scope) => map({ ...context, ...binding.withScope(scope) }),
  });
};

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
