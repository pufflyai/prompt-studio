import { createStorageId, createStorageMigration } from "pstdio-api-contracts";
import { isNavigationTarget } from "pstdio-api-contracts/extension-kernel";
import { createCommandRejection } from "../runner/command-rejection";
import { openIterator } from "./iterator-lifetime";

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
  /** A synchronous host method that returns a `{ close() }` handle, such as `storage.observe`. */
  | { kind: "subscribe" }
  /** A synchronous host method that returns an async iterable, such as `log.follow`. */
  | { kind: "iterate"; signalArg?: number }
  | { kind: "migrate"; projectId: string }
  | { kind: "object"; members: Record<string, BackendSurface> }
  /** A synchronous scope selection, such as `storage.collection(name)`, evaluated for each host call. */
  | { kind: "factory"; returns: BackendSurface; snapshotArguments?: boolean }
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

const matchesCall = (member: BackendSurface, kind: "async" | "notify") => {
  if (member.kind === kind) return true;
  return kind === "async" && (member.kind === "subscribe" || member.kind === "iterate" || member.kind === "migrate");
};

const resolveSurfaceMember = (surface: BackendSurface, path: SurfaceStep[], kind: "async" | "notify") => {
  let current = surface;
  for (const [index, step] of path.entries()) {
    const member = memberOf(current, step.name);
    if (!member) return;
    if (index === path.length - 1) return !step.args && matchesCall(member, kind) ? member : undefined;
    if (member.kind === "object" && !step.args) current = member;
    else if (member.kind === "factory" && step.args) current = member.returns;
    else return;
  }
};

/** Validates the complete path before evaluating any host factory or target method. */
export const resolveSurfaceCall = (
  root: unknown,
  surface: BackendSurface,
  path: SurfaceStep[],
  args: unknown[] | (() => unknown[]),
  kind: "async" | "notify",
) => {
  const member = resolveSurfaceMember(surface, path, kind);
  if (!member) throw new SurfaceCallRejectedError(path);
  let target = root;
  for (const step of path.slice(0, -1))
    target = step.args
      ? methodOf(target, step.name, path).apply(target, step.args)
      : (target as Record<string, unknown>)[step.name];
  const last = path.at(-1)!;
  const method = methodOf(target, last.name, path);
  const input = typeof args === "function" ? args() : args;
  return member.kind === "iterate" && member.signalArg !== undefined
    ? openIterator(method.bind(target), input, member.signalArg)
    : method.apply(target, input);
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

// Register immediately, but close gates local delivery before the remote close can make its round trip.
const subscription = (open: (args: unknown[]) => Promise<unknown>, [listener, ...args]: unknown[]) => {
  let closed = false;
  const signal = (args[0] as { signal?: AbortSignal } | undefined)?.signal;
  const deliver = (...event: unknown[]) => {
    if (!closed && !signal?.aborted && typeof listener === "function") return listener(...event);
  };
  const opened = open([deliver, ...args]);
  opened.catch(() => {});
  return {
    close() {
      if (closed) return;
      closed = true;
      void opened.then((handle) => (handle as { close?: () => unknown } | undefined)?.close?.()).catch(() => {});
    },
  };
};

type StorageScope = { type: string; id?: string; resource?: { id?: string } };
type MigrationRun = (previous: number, migration: object) => unknown;

// Matches the namespaces used by createStorageApi for both root and scoped storage.
const migrateNamespace = (extensionId: unknown, projectId: string, path: SurfaceStep[]) => {
  const scope = path.reduce<StorageScope | undefined>(
    (selected, step) => (step.name === "scope" ? (step.args?.[0] as StorageScope | undefined) : selected),
    undefined,
  );
  if (!scope || scope.type === "project") return [String(extensionId), projectId, "project", projectId];
  const id = scope.type === "resource" ? scope.resource?.id : scope.id;
  if (!id) throw new Error(`Storage scope ${scope.type} requires an id.`);
  return [String(extensionId), projectId, scope.type, id];
};

const storageMigrate =
  (namespace: string[], call: (args: unknown[]) => Promise<unknown>) => (version: number, run: MigrationRun) =>
    call([
      version,
      (previous: number, migration: { moveCollection: unknown }) =>
        run(previous, { ...createStorageMigration([...namespace, version]), moveCollection: migration.moveCollection }),
    ]);

// Iteration starts the host call on the first `next()`, so creating the iterable stays synchronous.
const lazyIterable = (open: () => Promise<unknown>): AsyncIterable<unknown> => ({
  [Symbol.asyncIterator]() {
    let inner: Promise<AsyncIterator<unknown>> | undefined;
    let finished = false;
    const iterator = () => {
      inner ??= open().then((iterable) => (iterable as AsyncIterable<unknown>)[Symbol.asyncIterator]());
      return inner;
    };
    return {
      async next() {
        if (finished) return { done: true, value: undefined };
        const result = await (await iterator()).next();
        if (finished) return { done: true, value: undefined };
        if (result.done) finished = true;
        return result;
      },
      async return(value?: unknown) {
        if (finished) return { done: true, value };
        finished = true;
        return (await (await inner)?.return?.(value)) ?? { done: true, value };
      },
    };
  },
});

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
      case "subscribe":
        return (...args: unknown[]) => subscription((input) => channel.call(path, input), args);
      case "iterate":
        return (...args: unknown[]) => lazyIterable(() => channel.call(path, args));
      case "migrate":
        return (version: number, run: MigrationRun) =>
          storageMigrate(migrateNamespace(values[valueKey(["extensionId"])], current.projectId, path), (args) =>
            channel.call(path, args),
          )(version, run);
      case "local":
        return localMember(current);
      case "factory":
        return (...args: unknown[]) => {
          const input = current.snapshotArguments ? structuredClone(args) : args;
          const steps = [...path.slice(0, -1), { name: path.at(-1)!.name, args: input }];
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
