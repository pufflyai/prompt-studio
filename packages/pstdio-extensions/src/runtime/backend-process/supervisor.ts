import { AsyncLocalStorage } from "node:async_hooks";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHostCalls, type HostInvocation } from "./host-calls";
import {
  BACKEND_PROTOCOL_VERSION,
  BackendUnavailableError,
  deserializeBackendError,
  type HostToWorkerMessage,
  parseWorkerMessage,
  type SerializedBackendError,
  serializeBackendError,
  type WorkerToHostMessage,
} from "./protocol";
import { createFunctionTable } from "./remote-values";
import { type BackendSurface, collectSurfaceValues } from "./surface";

const STOP_GRACE_MS = 2_000;
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
  /** A monotonic timestamp for the end of the last active invocation. */
  readonly idleSince: number;
}

export interface BackendWorkerOptions {
  /** Command that starts the private worker entry, such as `[execPath, "extension-backend-worker"]`. */
  command: string[];
  /** The complete child environment. Pass an allowlisted environment, never the host's own. */
  env: Record<string, string | undefined>;
  entryPath: string;
}

type Running = HostInvocation & {
  settle: ReturnType<typeof Promise.withResolvers<unknown>>;
  drain?: ReturnType<typeof setTimeout>;
};

export const startBackendWorker = async (options: BackendWorkerOptions): Promise<BackendWorker> => {
  const invocations = new Map<string, Running>();
  let idleSince = performance.now();
  const forget = (invocationId: string) => {
    const deleted = invocations.delete(invocationId);
    if (deleted && invocations.size === 0) idleSince = performance.now();
    return deleted;
  };
  const ready = Promise.withResolvers<void>();
  const loaded = Promise.withResolvers<unknown>();
  let stopped: BackendUnavailableError | undefined;
  // Bun reads .env files from the working directory at startup. An empty folder keeps host files out.
  const cwd = mkdtempSync(join(tmpdir(), "pstdio-backend-"));

  const closed = Promise.withResolvers<void>();
  const fail = (error: BackendUnavailableError) => {
    stopped ??= error;
    closed.resolve();
    ready.reject(error);
    loaded.reject(error);
    for (const [id, running] of invocations) {
      closeInvocation(id, running, error);
      running.settle.reject(error);
    }
  };

  /** Returns false when the message could not be sent; the caller then has nothing to wait for. */
  const send = (message: HostToWorkerMessage) => {
    if (stopped) return false;
    try {
      child.send(message);
      return true;
    } catch {
      return false;
    }
  };

  const hostCalls = createHostCalls(send, (invocationId) => invocations.get(invocationId), workerError);

  // Idle time starts when the last invocation is finally removed, after any cancellation drain.
  const closeInvocation = (id: string, running: Running, error: unknown) => {
    forget(id);
    clearTimeout(running.drain);
    hostCalls.reject(id, error);
    running.table.clear();
  };

  const settle = (message: Extract<WorkerToHostMessage, { type: "result" }>) => {
    const running = invocations.get(message.invocationId);
    if (!running) return;
    closeInvocation(message.invocationId, running, new BackendUnavailableError("The invocation has finished."));
    if (message.ok) running.settle.resolve(message.value);
    else running.settle.reject(workerError(message.error));
  };

  const receive = (raw: unknown) => {
    const message = parseWorkerMessage(raw);
    if (message?.type === "ready") ready.resolve();
    else if (message?.type === "loaded") {
      if (message.ok) loaded.resolve(message.value);
      else loaded.reject(workerError(message.error));
    } else if (message?.type === "result") settle(message);
    else if (message) hostCalls.handle(message);
  };

  const spawn = () => {
    try {
      return Bun.spawn(options.command, {
        cwd,
        env: options.env,
        stdio: ["ignore", "inherit", "inherit"],
        serialization: "advanced",
        ipc: receive,
        // A worker that drops its channel can never answer again, even if its process keeps running.
        onDisconnect: () => {
          fail(new BackendUnavailableError("The extension backend disconnected."));
          child.kill("SIGKILL");
        },
      });
    } catch (error) {
      // Nothing started, so nothing else will remove the working folder.
      rmSync(cwd, { recursive: true, force: true });
      throw error;
    }
  };
  const child = spawn();

  const exited = child.exited.then((code) => {
    fail(new BackendUnavailableError(`The extension backend exited (${code}).`));
    rmSync(cwd, { recursive: true, force: true });
    return code;
  });
  // Callers observe startup failures through `loaded`; these copies only prevent unhandled rejections.
  ready.promise.catch(() => {});
  loaded.promise.catch(() => {});

  const stop = async () => {
    fail(new BackendUnavailableError("The extension backend was stopped."));
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), STOP_GRACE_MS);
    await exited;
    clearTimeout(timer);
  };

  const invoke = (input: BackendInvocation) => {
    if (stopped) return Promise.reject(stopped);
    const { context, surface, handlerId, args, signal } = input;
    if (signal?.aborted) return Promise.reject(signal.reason);
    const invocationId = crypto.randomUUID();
    let values: Record<string, unknown>;
    try {
      values = collectSurfaceValues(context, surface);
    } catch (error) {
      return Promise.reject(error);
    }
    // A getter may abort while collecting context values.
    if (signal?.aborted) return Promise.reject(signal.reason);
    const settle = Promise.withResolvers<unknown>();
    const running: Running = {
      settle,
      context,
      surface,
      table: createFunctionTable(),
      enter: AsyncLocalStorage.snapshot(),
    };
    invocations.set(invocationId, running);
    const sent = send({
      v: BACKEND_PROTOCOL_VERSION,
      type: "invoke",
      invocationId,
      handlerId,
      surface,
      values,
      args,
    });
    if (!sent) {
      forget(invocationId);
      return Promise.reject(
        stopped ?? new TypeError("The invocation arguments cannot be sent to the extension backend."),
      );
    }
    const cancel = () => {
      if (!invocations.has(invocationId) || running.cancelled) return;
      const error = signal?.reason;
      running.cancelled = true;
      hostCalls.reject(invocationId, error);
      running.table.dispose();
      running.drain = setTimeout(() => closeInvocation(invocationId, running, error), DRAIN_DEADLINE_MS);
      running.drain.unref?.();
      settle.reject(error);
      send({ v: BACKEND_PROTOCOL_VERSION, type: "cancel", invocationId, reason: serializeBackendError(error) });
    };
    signal?.addEventListener("abort", cancel, { once: true });
    // IPC serialization can also run getters. Send cancellation after the invocation message.
    if (signal?.aborted) cancel();
    return settle.promise.finally(() => signal?.removeEventListener("abort", cancel));
  };

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
      stop,
      invoke,
      get busy() {
        return invocations.size > 0;
      },
      get idleSince() {
        return idleSince;
      },
    };
  } catch (error) {
    await stop();
    throw error;
  } finally {
    clearTimeout(deadline);
  }
};

export { BackendUnavailableError } from "./protocol";
