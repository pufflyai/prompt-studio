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
import { type createFunctionTable, discardValue, importValue } from "./remote-values";
import { type BackendSurface, resolveSurfaceCall } from "./surface";

type Enter = ReturnType<typeof AsyncLocalStorage.snapshot>;

export interface HostInvocation {
  context: unknown;
  surface: BackendSurface;
  /** Re-enters the host's async context from when the invocation started, such as its project work. */
  enter: Enter;
  cancelled?: boolean;
  /** Host functions this invocation handed to the worker, such as a migration helper or a close(). */
  table: ReturnType<typeof createFunctionTable>;
}

type Call = Extract<WorkerToHostMessage, { type: "call" | "fn-call" }>;

export const createHostCalls = (
  send: (message: HostToWorkerMessage) => boolean,
  invocation: (invocationId: string) => HostInvocation | undefined,
  workerError: (error: SerializedBackendError) => Error,
) => {
  const pending = createPendingCalls<Enter>();
  const hostCallOwner = new AsyncLocalStorage<string>();
  let nextRequest = 0;

  const importFrom = (invocationId: string, value: unknown) =>
    importValue(value, (fnId, args) => callWorker(invocationId, fnId, args));

  const callWorker = async (invocationId: string, fnId: string, args: unknown[]): Promise<unknown> => {
    const running = invocation(invocationId);
    if (!running || running.cancelled) throw new BackendUnavailableError("The invocation is no longer running.");
    const exported = (await running.table.exportValue(args)) as unknown[];
    const requestId = `h${nextRequest++}`;
    // A listener can be called by a different invocation's event. Only a host operation owned
    // by this invocation can give its callback narrower async context.
    const enter = hostCallOwner.getStore() === invocationId ? AsyncLocalStorage.snapshot() : running.enter;
    const reply = pending.start(invocationId, requestId, enter);
    if (!send({ v: BACKEND_PROTOCOL_VERSION, type: "fn-call", invocationId, requestId, fnId, args: exported })) {
      pending.take(invocationId, requestId);
      throw new BackendUnavailableError("The extension backend is not available.");
    }
    return importFrom(invocationId, await reply.promise);
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
    try {
      const running = invocation(invocationId);
      if (!running) throw new BackendUnavailableError("The invocation is no longer running.");
      // Cancellation ends callback scopes. The table still permits calls to existing cleanup references.
      const enter =
        running.cancelled && message.type === "fn-call"
          ? running.enter
          : enterFor(running, invocationId, message.within);
      await enter(async () => {
        const result = await hostCallOwner.run(invocationId, () => runCall(running, message));
        if (invocation(invocationId) !== running || (running.cancelled && message.type === "call")) {
          discardValue(result);
          return;
        }
        const value = await running.table.exportValue(result);
        if (!send({ v: BACKEND_PROTOCOL_VERSION, type: "reply", invocationId, requestId, ok: true, value }))
          throw new Error("The host result could not be sent to the worker.");
      });
    } catch (error) {
      send({
        v: BACKEND_PROTOCOL_VERSION,
        type: "reply",
        invocationId,
        requestId,
        ok: false,
        error: serializeBackendError(error),
      });
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

  return { handle, reject: pending.reject };
};
