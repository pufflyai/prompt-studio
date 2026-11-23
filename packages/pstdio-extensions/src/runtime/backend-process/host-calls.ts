import { AsyncLocalStorage } from "node:async_hooks";
import { createPendingCalls } from "./pending-calls";
import {
  BACKEND_PROTOCOL_VERSION,
  BackendUnavailableError,
  type HostToWorkerMessage,
  type SerializedBackendError,
  serializeBackendError,
  type WorkerToHostMessage,
} from "./protocol";
import { withSnapshotSinks } from "./remote-markers";
import { type createFunctionTable, type createImportTracker, discardValue, importValue } from "./remote-values";
import { type BackendSurface, resolveSurfaceCall, surfaceMemberKind } from "./surface";

type Enter = ReturnType<typeof AsyncLocalStorage.snapshot>;

export interface HostInvocation {
  context: unknown;
  surface: BackendSurface;
  /** Re-enters the host's async context from when the invocation started, such as its project work. */
  enter: Enter;
  cancelled?: boolean;
  /** Host functions this invocation handed to the worker, such as a migration helper or a close(). */
  table: ReturnType<typeof createFunctionTable>;
  tracker: ReturnType<typeof createImportTracker>;
}

type Call = Extract<WorkerToHostMessage, { type: "call" | "fn-call" }>;

/**
 * Calls one worker may have the host answering at once. Past it, calls are refused rather than
 * queued, so a worker that floods the host cannot grow its memory without bound. Long-polling calls
 * such as an events iterator's `next()` count too, which is why this refuses instead of waiting.
 */
export const HOST_CALL_LIMITS = { inFlight: 4096 };

const overloaded = () =>
  Object.assign(new Error("The extension made too many host calls at once. Retry after some of them finish."), {
    code: "extension_overloaded",
  });

export const createHostCalls = (
  send: (message: HostToWorkerMessage) => boolean,
  invocation: (invocationId: string) => HostInvocation | undefined,
  workerError: (error: SerializedBackendError) => Error,
  checkLifetime: (id: string) => void,
) => {
  const pending = createPendingCalls<Enter>();
  const hostCallOwner = new AsyncLocalStorage<string>();
  let answering = 0;
  const inFlight = new Map<string, number>();
  let nextRequest = 0;

  const track = async <T>(id: string, run: () => Promise<T>) => {
    inFlight.set(id, (inFlight.get(id) ?? 0) + 1);
    try {
      return await run();
    } finally {
      const left = inFlight.get(id)! - 1;
      if (left) inFlight.set(id, left);
      else inFlight.delete(id);
      checkLifetime(id);
    }
  };

  const importFrom = (invocationId: string, value: unknown) =>
    importValue(value, (fnId, args) => callWorker(invocationId, fnId, args), invocation(invocationId)?.tracker);

  const callWorker = async (invocationId: string, fnId: string, args: unknown[]): Promise<unknown> => {
    const running = invocation(invocationId);
    if (!running || running.cancelled) throw new BackendUnavailableError("The invocation is no longer running.");
    return track(invocationId, async () => {
      const exported = (await running.table.exportValue(args.map(withSnapshotSinks))) as unknown[];
      if (invocation(invocationId) !== running || running.cancelled)
        throw new BackendUnavailableError("The invocation is no longer running.");
      const requestId = `h${nextRequest++}`;
      // Only a host operation owned by this invocation can give its callback narrower async context.
      const enter = hostCallOwner.getStore() === invocationId ? AsyncLocalStorage.snapshot() : running.enter;
      const reply = pending.start(invocationId, requestId, enter);
      if (!send({ v: BACKEND_PROTOCOL_VERSION, type: "fn-call", invocationId, requestId, fnId, args: exported })) {
        pending.take(invocationId, requestId);
        throw new BackendUnavailableError("The extension backend is not available.");
      }
      return importFrom(invocationId, await reply.promise);
    });
  };

  // A callback may have entered a narrower host scope (for example a database migration).
  // Its context applies only to that invocation, and only while that callback is pending.
  const enterFor = (running: HostInvocation, invocationId: string, within: string | undefined) => {
    const enter = within === undefined ? running.enter : pending.context(invocationId, within);
    if (!enter) throw new BackendUnavailableError("The invocation's callback has finished.");
    return enter;
  };

  const runCall = (running: HostInvocation, message: Call) => {
    const args = () => importFrom(message.invocationId, message.args) as unknown[];
    if (message.type === "fn-call") return running.table.call(message.fnId, args, running.cancelled);
    if (running.cancelled) throw new BackendUnavailableError("The invocation was cancelled.");
    return resolveSurfaceCall(running.context, running.surface, message.path, args, "async");
  };

  const answer = async (message: Call) => {
    const { invocationId, requestId } = message;
    answering += 1;
    try {
      if (answering > HOST_CALL_LIMITS.inFlight) throw overloaded();
      const running = invocation(invocationId);
      if (!running) throw new BackendUnavailableError("The invocation is no longer running.");
      // Cancellation ends callback scopes. The table still permits calls to existing cleanup references.
      const cleanupOnly = running.cancelled && message.type === "fn-call";
      const enter = cleanupOnly ? running.enter : enterFor(running, invocationId, message.within);
      const revoked = () => invocation(invocationId) !== running || (!cleanupOnly && running.cancelled);
      await track(invocationId, () =>
        enter(async () => {
          const result = await hostCallOwner.run(invocationId, () => runCall(running, message));
          if (revoked()) {
            discardValue(result);
            return;
          }
          const pin =
            message.type === "fn-call"
              ? running.table.isPinned(message.fnId)
              : surfaceMemberKind(running.surface, message.path) === "handle";
          const { value, kept } = await running.table.exportResult(result, pin).catch((error) => {
            if (revoked()) discardValue(result);
            throw error;
          });
          if (revoked()) {
            running.table.release(kept);
            return;
          }
          if (!send({ v: BACKEND_PROTOCOL_VERSION, type: "reply", invocationId, requestId, ok: true, value })) {
            running.table.release(kept);
            throw new Error("The host result could not be sent to the worker.");
          }
        }),
      );
    } catch (error) {
      send({
        v: BACKEND_PROTOCOL_VERSION,
        type: "reply",
        invocationId,
        requestId,
        ok: false,
        error: serializeBackendError(error),
      });
    } finally {
      answering -= 1;
    }
  };

  const notify = (message: Extract<WorkerToHostMessage, { type: "notify" }>) => {
    const running = invocation(message.invocationId);
    if (!running || running.cancelled) return;
    try {
      const { context, surface } = running;
      const enter = enterFor(running, message.invocationId, message.within);
      Promise.resolve(enter(() => resolveSurfaceCall(context, surface, message.path, message.args, "notify"))).catch(
        () => {},
      );
    } catch {}
  };

  const handle = (message: WorkerToHostMessage) => {
    if (message.type === "call" || message.type === "fn-call") void answer(message);
    else if (message.type === "notify") notify(message);
    else if (message.type === "reply") {
      const reply = pending.take(message.invocationId, message.requestId);
      if (message.ok) reply?.resolve(message.value);
      else reply?.reject(workerError(message.error));
    }
  };

  return { handle, reject: pending.reject, importFrom, busy: (id: string) => inFlight.has(id) };
};
