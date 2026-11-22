/**
 * The explicit allowlist of host capabilities a backend worker may reach. The host resolves every
 * worker call against it and the worker builds its context facade from the same description, so
 * the two sides agree on which members are values, synchronous factories or asynchronous calls.
 */
export type BackendSurface =
  /** A cloneable value copied into the worker when an invocation starts. */
  | { kind: "value" }
  /** The invocation's host cancellation. The worker receives a local signal that the host aborts. */
  | { kind: "signal" }
  /** An asynchronous host method. The worker awaits the host's reply. */
  | { kind: "async" }
  /** A one-way host method, such as logging. The worker does not wait for it. */
  | { kind: "notify" }
  | { kind: "object"; members: Record<string, BackendSurface> }
  /** A synchronous method that returns another surface, such as `storage.collection(name)`. */
  | { kind: "factory"; returns: BackendSurface };

/** One step from the context root: a property, or a factory call with its arguments. */
export type SurfaceStep = { name: string; args?: unknown[] };

export class SurfaceCallRejectedError extends Error {
  readonly code = "backend_call_rejected";
  constructor(path: SurfaceStep[]) {
    super(`Backend call is not allowed: ${path.map((step) => step.name).join(".") || "<root>"}`);
    this.name = "SurfaceCallRejectedError";
  }
}

const memberOf = (surface: BackendSurface, name: string) =>
  surface.kind === "object" && Object.hasOwn(surface.members, name) ? surface.members[name] : undefined;

const methodOf = (target: unknown, name: string, path: SurfaceStep[]) => {
  const method = (target as Record<string, unknown> | null | undefined)?.[name];
  if (typeof method !== "function") throw new SurfaceCallRejectedError(path);
  return method as (...args: unknown[]) => unknown;
};

/** Runs one worker call on the host object. Only a member of the expected async or notify kind can run. */
export const resolveSurfaceCall = (
  root: unknown,
  surface: BackendSurface,
  path: SurfaceStep[],
  args: unknown[],
  kind: "async" | "notify",
) => {
  if (path.length === 0) throw new SurfaceCallRejectedError(path);
  let target = root;
  let current = surface;
  for (const [index, step] of path.entries()) {
    const member = memberOf(current, step.name);
    const last = index === path.length - 1;
    if (!member) throw new SurfaceCallRejectedError(path);
    if (last) {
      if (member.kind !== kind || step.args) throw new SurfaceCallRejectedError(path);
      return methodOf(target, step.name, path).apply(target, args);
    }
    if (member.kind === "object" && !step.args) {
      target = (target as Record<string, unknown>)[step.name];
      current = member;
    } else if (member.kind === "factory" && step.args) {
      target = methodOf(target, step.name, path).apply(target, step.args);
      current = member.returns;
    } else throw new SurfaceCallRejectedError(path);
  }
  throw new SurfaceCallRejectedError(path);
};

const valueKey = (path: string[]) => JSON.stringify(path);

/** Copies the surface's values from the host object. Factory results are created on demand instead. */
export const collectSurfaceValues = (root: unknown, surface: BackendSurface) => {
  const values: Record<string, unknown> = {};
  const visit = (target: unknown, current: BackendSurface, path: string[]) => {
    if (current.kind === "value") values[valueKey(path)] = target;
    if (current.kind !== "object" || target === null || typeof target !== "object") return;
    for (const [name, member] of Object.entries(current.members))
      visit((target as Record<string, unknown>)[name], member, [...path, name]);
  };
  visit(root, surface, []);
  return values;
};

export interface SurfaceFacadeChannel {
  call(path: SurfaceStep[], args: unknown[]): Promise<unknown>;
  notify(path: SurfaceStep[], args: unknown[]): void;
  signal: AbortSignal;
}

/** Builds the worker-side object for a surface. No I/O happens until an async member is called. */
export const createSurfaceFacade = (
  surface: BackendSurface,
  values: Record<string, unknown>,
  channel: SurfaceFacadeChannel,
): unknown => {
  const build = (current: BackendSurface, path: SurfaceStep[], valuePath: string[] | undefined): unknown => {
    switch (current.kind) {
      case "value":
        return valuePath ? values[valueKey(valuePath)] : undefined;
      case "signal":
        return channel.signal;
      case "async":
        return (...args: unknown[]) => channel.call(path, args);
      case "notify":
        return (...args: unknown[]) => channel.notify(path, args);
      case "factory":
        return (...args: unknown[]) => {
          const steps = [...path.slice(0, -1), { name: path.at(-1)!.name, args }];
          return build(current.returns, steps, undefined);
        };
      case "object": {
        const facade: Record<string, unknown> = {};
        for (const [name, member] of Object.entries(current.members))
          facade[name] = build(member, [...path, { name }], valuePath && [...valuePath, name]);
        return facade;
      }
    }
  };
  return build(surface, [], []);
};
