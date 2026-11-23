import type { HarnessContext, MaybePromise, ProcessSpawnInput } from "pstdio-api-contracts/extension-kernel";
import { createProcessOwner, failedProcessHandle, type ProcessOwner, processError } from "pstdio-extensions";
import type { HarnessCallOptions } from "./harness-registry";

// A context for one provider call. Its `call` children also stay owned by the harness instance,
// so disposal stops any that outlive a call the host never settled.
const bindCall = (context: HarnessContext, owner: ProcessOwner): HarnessContext => ({
  ...context,
  process: {
    ...context.process,
    spawn: (input: ProcessSpawnInput) => {
      if ((input.lifetime ?? "call") !== "call") return context.process.spawn(input);
      if (owner.closed)
        return failedProcessHandle(
          processError("process_owner_closed", "The harness call that would own this process has ended."),
        );
      const handle = context.process.spawn(input);
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
  const open = async (options?: HarnessCallOptions) => {
    const owner = createProcessOwner();
    try {
      return { context: bindCall(await context(options), owner), close: () => void owner.close() };
    } catch (error) {
      void owner.close();
      throw error;
    }
  };

  return {
    open,
    /** Runs a call whose children end when it settles. */
    async once<T>(options: HarnessCallOptions | undefined, run: (context: HarnessContext) => MaybePromise<T>) {
      const call = await open(options);
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
    ) {
      const call = await open(options);
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
