import type { AsyncLocalStorage } from "node:async_hooks";
import {
  BACKEND_PROTOCOL_VERSION,
  BackendUnavailableError,
  deserializeBackendError,
  type HostToWorkerMessage,
  serializeBackendError,
  type WorkerToHostMessage,
} from "./protocol";
import { type createFunctionTable, importValue } from "./remote-values";
import { type BackendSurface, resolveSurfaceCall } from "./surface";

export interface HostInvocation {
  context: unknown;
  surface: BackendSurface;
  /** Re-enters the host's async context from when the invocation started, such as its project work. */
  enter: ReturnType<typeof AsyncLocalStorage.snapshot>;
  /** Host functions this invocation handed to the worker, such as a migration helper or a close(). */
  table: ReturnType<typeof createFunctionTable>;
}

type Resolvers = ReturnType<typeof Promise.withResolvers<unknown>>;

/**
 * Answers the worker's calls for running invocations. Each call is checked against the invocation's
 * surface; functions in arguments and results cross as references owned by the side that sent them.
 */
export const createHostCalls = (
  send: (message: HostToWorkerMessage) => boolean,
  invocation: (invocationId: string) => HostInvocation | undefined,
) => {
  const pending = new Map<string, Resolvers>();
  let nextRequest = 0;

  const importFrom = (invocationId: string, value: unknown) =>
    importValue(value, (fnId, args) => callWorker(invocationId, fnId, args));

  /** Calls a function the worker passed to the host. It works only while its invocation runs. */
  const callWorker = (invocationId: string, fnId: string, args: unknown[]): Promise<unknown> => {
    const running = invocation(invocationId);
    if (!running) return Promise.reject(new Error("The extension handler has finished."));
    const requestId = `h${nextRequest++}`;
    const reply = Promise.withResolvers<unknown>();
    pending.set(requestId, reply);
    const exported = running.table.exportValue(args) as unknown[];
    if (!send({ v: BACKEND_PROTOCOL_VERSION, type: "fn-call", invocationId, requestId, fnId, args: exported })) {
      pending.delete(requestId);
      return Promise.reject(new Error("The extension backend is not available."));
    }
    return reply.promise.then((value) => importFrom(invocationId, value));
  };

  const answer = async (requestId: string, invocationId: string, run: (running: HostInvocation) => unknown) => {
    try {
      const running = invocation(invocationId);
      // The id is unguessable and scoped to this worker; an unknown or finished id gets no host action.
      if (!running) throw new BackendUnavailableError("The invocation is no longer running.");
      const value = running.table.exportValue(await running.enter(run, running));
      if (!send({ v: BACKEND_PROTOCOL_VERSION, type: "reply", requestId, ok: true, value }))
        throw new Error("The host result could not be sent to the worker.");
    } catch (error) {
      send({ v: BACKEND_PROTOCOL_VERSION, type: "reply", requestId, ok: false, error: serializeBackendError(error) });
    }
  };

  const handle = (message: WorkerToHostMessage) => {
    if (message.type === "call")
      void answer(message.requestId, message.invocationId, ({ context, surface }) =>
        resolveSurfaceCall(
          context,
          surface,
          message.path,
          importFrom(message.invocationId, message.args) as unknown[],
          "async",
        ),
      );
    else if (message.type === "fn-call")
      void answer(message.requestId, message.invocationId, ({ table }) =>
        table.call(message.fnId, importFrom(message.invocationId, message.args) as unknown[]),
      );
    else if (message.type === "reply") {
      const reply = pending.get(message.requestId);
      pending.delete(message.requestId);
      if (message.ok) reply?.resolve(message.value);
      else reply?.reject(deserializeBackendError(message.error));
    }
  };

  const rejectAll = (error: Error) => {
    for (const reply of pending.values()) reply.reject(error);
    pending.clear();
  };

  return { handle, rejectAll };
};
