import type { HarnessContext, MaybePromise, ProcessSpawnInput } from "pstdio-api-contracts/extension-kernel";
import { createProcessOwner, failedProcessHandle, type ProcessOwner, processError } from "pstdio-extensions";
import type { HarnessCallOptions } from "./harness-registry";

type CallInput = { workspace?: { workspaceId: string }; signal?: AbortSignal };

// A context for one provider call. Its `call` children also stay owned by the harness instance,
// so disposal stops any that outlive a call the host never settled.
const bindCall = (context: HarnessContext, owner: ProcessOwner, workspaceId?: string): HarnessContext => ({
  ...context,
  process: {
    ...context.process,
    spawn: (input: ProcessSpawnInput) => {
      const target = workspaceId && input.workspaceId === undefined ? { ...input, workspaceId } : input;
      if ((input.lifetime ?? "call") !== "call") return context.process.spawn(target);
      if (owner.closed)
        return failedProcessHandle(
          processError("process_owner_closed", "The harness call that would own this process has ended."),
        );
      const handle = context.process.spawn(target);
      owner.adopt(handle);
      return handle;
    },
  },
});

/**
 * Gives each provider call its own owner for `call` children. Most calls end when their promise
 * settles. A native operation, such as a started turn, ends when its `done` settles instead.
 */
export const createHarnessCallOwnership = (context: (options?: HarnessCallOptions) => Promise<HarnessContext>) => {
  const open = async (options?: HarnessCallOptions, input?: CallInput) => {
    const owner = createProcessOwner();
    let signal: AbortSignal | undefined;
    const close = () => {
      signal?.removeEventListener("abort", close);
      signal = undefined;
      void owner.close();
    };
    const stopOnAbort = (next?: AbortSignal) => {
      signal?.removeEventListener("abort", close);
      signal = next;
      if (signal?.aborted) close();
      else signal?.addEventListener("abort", close, { once: true });
    };
    stopOnAbort(input?.signal);
    try {
      input?.signal?.throwIfAborted();
      const instance = await context(options);
      input?.signal?.throwIfAborted();
      return { context: bindCall(instance, owner, input?.workspace?.workspaceId), close, stopOnAbort };
    } catch (error) {
      close();
      throw error;
    }
  };

  return {
    open,
    /** Runs a call whose children end when it settles. */
    async once<T>(
      options: HarnessCallOptions | undefined,
      run: (context: HarnessContext) => MaybePromise<T>,
      input?: CallInput,
    ) {
      const call = await open(options, input);
      try {
        return await run(call.context);
      } finally {
        call.close();
      }
    },
    /** Runs a call whose children end when `done(result)` settles, or at once when it fails. */
    async until<T>(
      options: HarnessCallOptions | undefined,
      run: (context: HarnessContext) => MaybePromise<T>,
      done: (result: T) => PromiseLike<unknown>,
      input: CallInput,
    ) {
      const call = await open(options, input);
      try {
        const result = await run(call.context);
        void Promise.resolve(done(result)).then(call.close, call.close);
        return result;
      } catch (error) {
        call.close();
        throw error;
      }
    },
  };
};
