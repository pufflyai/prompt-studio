import { AsyncLocalStorage } from "node:async_hooks";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommandRejection } from "../runner/command-rejection";
import { createHostCalls, type HostInvocation } from "./host-calls";
import {
  BACKEND_PROTOCOL_VERSION,
  BACKEND_STOP_GRACE_MS,
  BackendUnavailableError,
  deserializeBackendError,
  type HostToWorkerMessage,
  parseWorkerMessage,
  type SerializedBackendError,
  serializeBackendError,
  type WorkerToHostMessage,
} from "./protocol";
import { createFunctionTable, createImportTracker } from "./remote-values";
import { stopBackendWorkerTree } from "./stop-worker-tree";
import { type BackendSurface, collectSurfaceValues, surfaceAllowsCommandRejection } from "./surface";
import { createWatchdog, type WatchdogOptions } from "./watchdog";

const DRAIN_DEADLINE_MS = 30_000;
// Dependencies are prepared before a worker starts, so loading only evaluates the entry.
const LOAD_DEADLINE_MS = 60_000;
// Codes the host itself reports. A worker error claiming one would read as a host decision.
const HOST_ERROR_CODES = new Set(["backend_unavailable", "backend_call_rejected"]);

const workerError = (serialized: SerializedBackendError) => {
  const error = deserializeBackendError(serialized) as Error & { code?: string };
  if (error.code && HOST_ERROR_CODES.has(error.code)) delete error.code;
  return error;
};

export interface BackendInvocation {
  handlerId: string;
  /** The host object the surface describes. Worker calls run against it and nothing else. */
  context: unknown;
  surface: BackendSurface;
  args: unknown[];
  signal?: AbortSignal;
}

export interface BackendWorker {
  readonly definition: unknown;
  invoke(invocation: BackendInvocation): Promise<unknown>;
  /** Stops the process. Pending invocations reject with BackendUnavailableError. */
  stop(): Promise<void>;
  /** Resolves as soon as the worker can no longer answer, which can be before its process exits. */
  readonly closed: Promise<void>;
  readonly exited: Promise<number | null>;
  /** Whether an invocation is running, so an idle worker can be retired without interrupting one. */
  readonly busy: boolean;
  /** Monotonic time the last invocation or its retained references ended. */
  readonly idleSince: number;
}

export interface BackendWorkerOptions {
  /** Command that starts the private worker entry, such as `[execPath, "extension-backend-worker"]`. */
  command: string[];
  /** The complete child environment. Pass an allowlisted environment, never the host's own. */
  env: Record<string, string | undefined>;
  entryPath: string;
  watchdog?: WatchdogOptions;
  drainDeadlineMs?: number;
}

type Running = HostInvocation & {
  /** Cleared once settled, so a kept entry does not also keep the caller's result alive. */
  settle?: ReturnType<typeof Promise.withResolvers<unknown>>;
  drain?: ReturnType<typeof setTimeout>;
};

const createInvoke =
  ({
    invocations,
    stopped,
    send,
    trackImports,
    closeInvocation,
    drainInvocation,
  }: {
    invocations: Map<string, Running>;
    stopped: () => BackendUnavailableError | undefined;
    send: (message: HostToWorkerMessage) => boolean;
    trackImports: (id: string) => Running["tracker"];
    closeInvocation: (id: string, running: Running, error?: unknown) => void;
    drainInvocation: (id: string, running: Running, reason: unknown) => void;
  }) =>
  (input: BackendInvocation) => {
    try {
      const unavailable = stopped();
      if (unavailable) throw unavailable;
      const { context, surface, handlerId, args, signal } = input;
      signal?.throwIfAborted();
      const values = collectSurfaceValues(context, surface);
      signal?.throwIfAborted();

      const invocationId = crypto.randomUUID();
      const table = createFunctionTable();
      const settle = Promise.withResolvers<unknown>();
      const running: Running = {
        settle,
        context,
        surface,
        table,
        tracker: trackImports(invocationId),
        enter: AsyncLocalStorage.snapshot(),
      };
      invocations.set(invocationId, running);

      const cancelPreparation = () => {
        closeInvocation(invocationId, running, signal?.reason);
        settle.reject(signal?.reason);
      };
      const cancel = () => {
        const current = invocations.get(invocationId);
        if (!current?.settle) return;
        current.settle = undefined;
        settle.reject(signal?.reason);
        drainInvocation(invocationId, current, signal?.reason);
      };
      signal?.addEventListener("abort", cancelPreparation, { once: true });

      const deliver = async () => {
        const exported = await table.exportPinned(args);
        if (!invocations.has(invocationId)) return;
        signal?.removeEventListener("abort", cancelPreparation);
        if (
          !send({
            v: BACKEND_PROTOCOL_VERSION,
            type: "invoke",
            invocationId,
            handlerId,
            surface,
            values,
            args: exported as unknown[],
          })
        ) {
          throw stopped() ?? new TypeError("The invocation arguments cannot be sent to the extension backend.");
        }
        // Register after sending, then catch an abort caused by a getter during IPC serialization.
        signal?.addEventListener("abort", cancel, { once: true });
        if (signal?.aborted) cancel();
      };
      void deliver().catch((error) => {
        if (!invocations.has(invocationId)) return;
        closeInvocation(invocationId, running, error);
        settle.reject(error);
      });
      return settle.promise.finally(() => {
        signal?.removeEventListener("abort", cancelPreparation);
        signal?.removeEventListener("abort", cancel);
      });
    } catch (error) {
      return Promise.reject(error);
    }
  };

export const startBackendWorker = async (options: BackendWorkerOptions): Promise<BackendWorker> => {
  const invocations = new Map<string, Running>();
  let idleSince = performance.now();
  const ready = Promise.withResolvers<void>();
  const loaded = Promise.withResolvers<unknown>();
  let stopped: BackendUnavailableError | undefined;
  let groupAnchorReply: ((pid: number | null) => void) | undefined;
  // Bun reads .env files from the working directory at startup. An empty folder keeps host files out.
  const cwd = mkdtempSync(join(tmpdir(), "pstdio-backend-"));

  const closed = Promise.withResolvers<void>();
  const fail = (error: BackendUnavailableError) => {
    stopped ??= error;
    closed.resolve();
    ready.reject(error);
    loaded.reject(error);
    for (const [id, running] of invocations) {
      running.settle?.reject(error);
      closeInvocation(id, running, error);
    }
  };

  /** Returns false when the message could not be sent; the caller then has nothing to wait for. */
  const send = (message: HostToWorkerMessage) => {
    if (stopped && message.type !== "hold-group") return false;
    try {
      child.send(message);
      return true;
    } catch {
      return false;
    }
  };

  const closeInvocation = (id: string, running: Running, error?: unknown) => {
    if (!invocations.delete(id)) return;
    clearTimeout(running.drain);
    hostCalls.reject(id, error ?? new BackendUnavailableError("The invocation has finished."));
    running.table.clear();
    if (invocations.size === 0) idleSince = performance.now();
  };

  // A settled invocation stays while either side still holds the other's references.
  const dispose = (id: string) => {
    const running = invocations.get(id);
    if (!running || running.settle || running.drain || hostCalls.busy(id) || running.table.size || running.tracker.live)
      return;
    closeInvocation(id, running);
  };

  // This closure must not retain the caller's result while the import tracker lives.
  const trackImports = (invocationId: string) =>
    createImportTracker((fnIds) => {
      if (!invocations.has(invocationId)) return;
      send({ v: BACKEND_PROTOCOL_VERSION, type: "release", invocationId, fnIds });
      dispose(invocationId);
    });

  const hostCalls = createHostCalls(send, (id) => invocations.get(id), workerError, dispose);

  const discard = (invocationId: string, running: Running) => {
    closeInvocation(invocationId, running);
    send({ v: BACKEND_PROTOCOL_VERSION, type: "discard", invocationId });
  };

  const drainInvocation = (invocationId: string, running: Running, reason: unknown) => {
    // Revoke pending callback scopes and ordinary calls. Existing cleanup references can still finish.
    running.cancelled = true;
    hostCalls.reject(invocationId, reason);
    running.table.dispose();
    running.drain = setTimeout(() => discard(invocationId, running), options.drainDeadlineMs ?? DRAIN_DEADLINE_MS);
    running.drain.unref?.();
    send({ v: BACKEND_PROTOCOL_VERSION, type: "cancel", invocationId, reason: serializeBackendError(reason) });
  };

  const settle = (message: Extract<WorkerToHostMessage, { type: "result" }>) => {
    const { invocationId } = message;
    const running = invocations.get(invocationId);
    if (!running) return;
    if (running.drain) {
      // Discard on the owning side, without importing unused promises or waiting for garbage collection.
      discard(invocationId, running);
      return;
    }
    const resolvers = running.settle;
    if (!resolvers) return;
    running.settle = undefined;
    hostCalls.reject(invocationId, new BackendUnavailableError("The invocation has finished."));
    if (message.ok) {
      // Earlier imports can belong to callbacks or handles that are absent from this result.
      const previousImports = running.tracker.live;
      let result: unknown;
      try {
        result = hostCalls.importFrom(invocationId, message.value);
      } catch (error) {
        resolvers.reject(error);
        discard(invocationId, running);
        return;
      }
      running.table.seal(undefined, running.tracker.live > previousImports);
      resolvers.resolve(result);
    } else {
      running.table.seal();
      const error = workerError(message.error);
      if (message.rejection && surfaceAllowsCommandRejection(running.surface))
        error.cause = createCommandRejection(message.rejection);
      resolvers.reject(error);
    }
    dispose(invocationId);
  };

  const receive = (raw: unknown) => {
    const message = parseWorkerMessage(raw);
    if (message?.type === "ready") ready.resolve();
    else if (message?.type === "loaded") {
      if (message.ok) loaded.resolve(message.value);
      else loaded.reject(workerError(message.error));
    } else if (message?.type === "result") settle(message);
    else if (message?.type === "pong") watchdog.answered(message.rss);
    else if (message?.type === "group-anchor") groupAnchorReply?.(message.pid);
    else if (message?.type === "release") {
      invocations.get(message.invocationId)?.table.release(message.fnIds);
      dispose(message.invocationId);
    } else if (message) hostCalls.handle(message);
  };

  const spawn = () => {
    try {
      return Bun.spawn(options.command, {
        cwd,
        env: options.env,
        stdio: ["ignore", "inherit", "inherit"],
        detached: process.platform !== "win32",
        serialization: "advanced",
        ipc: receive,
        // A worker that drops its channel can never answer again, even if its process keeps running.
        onDisconnect: () => {
          groupAnchorReply?.(null);
          fail(new BackendUnavailableError("The extension backend disconnected."));
          stopTree();
        },
      });
    } catch (error) {
      // Nothing started, so nothing else will remove the working folder.
      rmSync(cwd, { recursive: true, force: true });
      throw error;
    }
  };
  const child = spawn();
  const requestGroupAnchor = () => {
    const reply = Promise.withResolvers<number | null>();
    groupAnchorReply = reply.resolve;
    if (!send({ v: BACKEND_PROTOCOL_VERSION, type: "hold-group" })) reply.resolve(null);
    return reply.promise;
  };
  let stopping: Promise<void> | undefined;
  const stopTree = (graceful = false) => {
    if (stopping) return stopping;
    stopping = stopBackendWorkerTree(child, BACKEND_STOP_GRACE_MS, graceful ? requestGroupAnchor : undefined).finally(
      () => {
        groupAnchorReply?.(null);
        groupAnchorReply = undefined;
      },
    );
    void stopping.catch((error) =>
      console.warn("[pstdio-extensions] Could not stop the extension backend tree", error),
    );
    return stopping;
  };

  const watchdog = createWatchdog(
    (seq) => send({ v: BACKEND_PROTOCOL_VERSION, type: "ping", seq }),
    (reason) => {
      fail(new BackendUnavailableError(reason));
      stopTree();
    },
    options.watchdog,
  );

  const exited = child.exited.then(async (code) => {
    watchdog.stop();
    fail(new BackendUnavailableError(`The extension backend exited (${code}).`));
    try {
      await stopping;
      return code;
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
  void exited.catch(() => {});
  // Callers observe startup failures through `loaded`; these copies only prevent unhandled rejections.
  ready.promise.catch(() => {});
  loaded.promise.catch(() => {});

  const stop = async (graceful: boolean) => {
    fail(new BackendUnavailableError("The extension backend was stopped."));
    await stopTree(graceful);
    await exited;
  };

  const invoke = createInvoke({
    invocations,
    stopped: () => stopped,
    send,
    trackImports,
    closeInvocation,
    drainInvocation,
  });

  const deadline = setTimeout(
    () => fail(new BackendUnavailableError(`The extension backend did not load within ${LOAD_DEADLINE_MS / 1000} s.`)),
    LOAD_DEADLINE_MS,
  );
  try {
    await ready.promise;
    if (!send({ v: BACKEND_PROTOCOL_VERSION, type: "load", entryPath: options.entryPath }))
      throw stopped ?? new BackendUnavailableError("The extension backend could not be reached.");
    return {
      definition: await loaded.promise,
      closed: closed.promise,
      exited,
      stop: () => stop(true),
      invoke,
      get busy() {
        return invocations.size > 0;
      },
      get idleSince() {
        return idleSince;
      },
    };
  } catch (error) {
    await stop(false).catch(() => {});
    throw error;
  } finally {
    clearTimeout(deadline);
  }
};

export { BackendUnavailableError } from "./protocol";
