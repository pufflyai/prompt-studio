import type { ExtensionLoggerApi } from "@pstdio/sdk/extensions";

export type ScopeDisposer = () => void | Promise<void>;

/**
 * Owns every host resource created for one invocation. The command runner opens a scope when an
 * invocation starts and closes it when the invocation ends, whatever the outcome.
 *
 * `signal` is host cancellation, not invocation lifetime. Closing a scope releases what the
 * invocation created; it never aborts the signal, because a command may legitimately hand that
 * signal to work the host keeps running after the command returns, such as an agent session.
 */
export interface InvocationScope {
  /** Aborted when the host cancels the invocation. */
  readonly signal: AbortSignal;
  /** Registers cleanup for a resource this invocation created. */
  register(dispose: ScopeDisposer): void;
  /** Releases every registered resource, in reverse order. Runs once. */
  close(): Promise<void>;
}

const describe = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const createInvocationScope = (input: {
  logger: ExtensionLoggerApi;
  /** Host cancellation for the surrounding work, such as a parent invocation. */
  parent?: AbortSignal;
}): InvocationScope => {
  const controller = new AbortController();
  const disposers: ScopeDisposer[] = [];
  let closing: Promise<void> | undefined;
  let detachParent = () => {};

  const release = async (dispose: ScopeDisposer) => {
    try {
      await dispose();
    } catch (err) {
      input.logger.warn(`Invocation cleanup failed: ${describe(err)}`);
    }
  };

  const disposeAll = async () => {
    detachParent();

    // Reverse order so a resource is released before whatever it was built on.
    for (const dispose of disposers.splice(0).reverse()) await release(dispose);
  };

  const scope: InvocationScope = {
    get signal() {
      return controller.signal;
    },
    register(dispose) {
      // A cancelled invocation may still be running when it creates a resource. Release it at
      // once rather than holding it until a handler that ignores cancellation finally returns.
      if (closing) {
        void release(dispose);
        return;
      }
      disposers.push(dispose);
    },
    close() {
      closing ??= disposeAll();
      return closing;
    },
  };

  const parent = input.parent;
  if (parent?.aborted) {
    controller.abort(parent.reason);
    void scope.close();
  } else if (parent) {
    const onParentAbort = () => {
      controller.abort(parent.reason);
      // Cancelling ends the invocation as far as the host is concerned, so its resources go
      // now. A handler that never observes the signal must not keep them alive forever.
      void scope.close();
    };
    parent.addEventListener("abort", onParentAbort, { once: true });
    detachParent = () => parent.removeEventListener("abort", onParentAbort);
  }

  return scope;
};
