import { createStorageId } from "pstdio-api-contracts";
import { isNavigationTarget } from "pstdio-api-contracts/extension-kernel";
import { createCommandRejection } from "../runner/command-rejection";

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
  | { kind: "notify"; check?: "navigationTarget" }
  | { kind: "object"; members: Record<string, BackendSurface> }
  /** A synchronous scope selection, such as `storage.collection(name)`, evaluated for each host call. */
  | { kind: "factory"; returns: BackendSurface }
  /** A pure synchronous calculation the worker runs itself from host-provided data. Never a host call. */
  | { kind: "local"; name: "storageId" }
  | { kind: "local"; name: "recordId"; namespace: string[] }
  /** The middleware result constructors of ctx.commands, such as `continue()` and `patchParams(params)`. */
  | { kind: "local"; name: "middlewareResult"; type: MiddlewareResultType };

type MiddlewareResultType = "continue" | "patchParams" | "replaceParams" | "replaceInvocation" | "reject";

// Mirrors the runner's command helpers (runner/context.ts buildCommandsApi).
const middlewareResult = (type: MiddlewareResultType) => {
  if (type === "continue") return () => ({ type });
  if (type === "patchParams" || type === "replaceParams") return (params: unknown) => ({ type, params });
  if (type === "replaceInvocation") return (invocation: unknown) => ({ type, invocation });
  return createCommandRejection;
};

const localMember = (surface: Extract<BackendSurface, { kind: "local" }>) => {
  if (surface.name === "storageId") return (prefix?: string) => createStorageId(prefix);
  if (surface.name === "middlewareResult") return middlewareResult(surface.type);
  const { namespace } = surface;
  // Same encoding as pstdio-sync's storageRecordId, which this layer may not import. The process
  // runtime API test compares the result with the host's own records.id.
  return (key: string) => JSON.stringify([...namespace, key]);
};

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

export const surfaceAllowsCommandRejection = (surface: BackendSurface) => {
  const commands = memberOf(surface, "commands");
  const reject = commands && memberOf(commands, "reject");
  return reject?.kind === "local" && reject.name === "middlewareResult" && reject.type === "reject";
};

const methodOf = (target: unknown, name: string, path: SurfaceStep[]) => {
  const method = (target as Record<string, unknown> | null | undefined)?.[name];
  if (typeof method !== "function") throw new SurfaceCallRejectedError(path);
  return method as (...args: unknown[]) => unknown;
};

const allowsCall = (surface: BackendSurface, path: SurfaceStep[], kind: "async" | "notify") => {
  let current = surface;
  for (const [index, step] of path.entries()) {
    const member = memberOf(current, step.name);
    if (!member) return false;
    if (index === path.length - 1) return member.kind === kind && !step.args;
    if (member.kind === "object" && !step.args) current = member;
    else if (member.kind === "factory" && step.args) current = member.returns;
    else return false;
  }
  return false;
};

/** Validates the complete path before evaluating any host factory or target method. */
export const resolveSurfaceCall = (
  root: unknown,
  surface: BackendSurface,
  path: SurfaceStep[],
  args: unknown[],
  kind: "async" | "notify",
) => {
  if (!allowsCall(surface, path, kind)) throw new SurfaceCallRejectedError(path);
  let target = root;
  for (const step of path.slice(0, -1))
    target = step.args
      ? methodOf(target, step.name, path).apply(target, step.args)
      : (target as Record<string, unknown>)[step.name];
  const last = path.at(-1)!;
  return methodOf(target, last.name, path).apply(target, args);
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
        return (...args: unknown[]) => {
          // A one-way notification cannot return the host's synchronous validation error.
          if (current.check === "navigationTarget" && !isNavigationTarget(args[0]))
            throw new Error("Invalid navigation target.");
          channel.notify(path, args);
        };
      case "local":
        return localMember(current);
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
