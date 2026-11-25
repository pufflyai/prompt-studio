import { AsyncLocalStorage } from "node:async_hooks";
import { backendScopeFor } from "../runner/host-context";
import { createInvocationScope, type InvocationScope } from "../runner/scope";
import type { HostInvocation } from "./host-calls";
import { BACKEND_PROTOCOL_VERSION, type BackendUnavailableError, type HostToWorkerMessage } from "./protocol";
import { createFunctionTable } from "./remote-values";
import { type BackendSurface, collectSurfaceValues } from "./surface";

export interface BackendInvocation {
  handlerId: string;
  /** The host object the surface describes. Worker calls run against it and nothing else. */
  context: unknown;
  surface: BackendSurface;
  args: unknown[];
  signal?: AbortSignal;
}

export type Running = HostInvocation & {
  /** Cleared once settled, so a kept entry does not also keep the caller's result alive. */
  settle?: ReturnType<typeof Promise.withResolvers<unknown>>;
  drain?: ReturnType<typeof setTimeout>;
  scope?: InvocationScope;
};

export const createInvoke =
  ({
    invocations,
    stopped,
    send,
    trackImports,
    closeInvocation,
    closeScope,
    drainInvocation,
  }: {
    invocations: Map<string, Running>;
    stopped: () => BackendUnavailableError | undefined;
    send: (message: HostToWorkerMessage) => boolean;
    trackImports: (id: string) => Running["tracker"];
    closeInvocation: (id: string, running: Running, error?: unknown) => void;
    closeScope: (running: Pick<Running, "scope">) => void;
    drainInvocation: (id: string, running: Running, reason: unknown) => void;
  }) =>
  (input: BackendInvocation) => {
    let scope: InvocationScope | undefined;
    try {
      const unavailable = stopped();
      if (unavailable) throw unavailable;
      const { surface, handlerId, args, signal } = input;
      signal?.throwIfAborted();
      const binding = backendScopeFor(input.context);
      let context = input.context;
      if (binding) {
        scope = createInvocationScope({ logger: binding.logger, parent: signal });
        context = { ...(context as object), ...binding.withScope(scope) };
      }
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
        scope,
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
      closeScope({ scope });
      return Promise.reject(error);
    }
  };
export const createScopeCleanup = () => {
  const scopeCleanups = new Set<Promise<void>>();
  const closeScope = (running: Pick<Running, "scope">) => {
    const scope = running.scope;
    if (!scope) return;
    running.scope = undefined;
    const closing = scope.close().finally(() => scopeCleanups.delete(closing));
    scopeCleanups.add(closing);
    void closing.catch((err) => console.warn("[pstdio-extensions] Invocation cleanup failed", err));
  };
  return { closeScope, scopeCleanups };
};
