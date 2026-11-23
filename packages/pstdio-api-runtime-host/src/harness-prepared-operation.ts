import type {
  HarnessCommandContext,
  HarnessExit,
  HarnessOperation,
  HarnessSession,
  PreparedHarnessOperation,
} from "pstdio-api-contracts";
import type { HarnessProvider } from "pstdio-api-contracts/extension-kernel";
import { HarnessDisposedError } from "./harness-disposed-error";
import type { createHarnessCallOwnership } from "./harness-process-ownership";
import type { HarnessCallOptions } from "./harness-registry";
import type { createRetainedHarnessCalls } from "./harness-session-retention";

const FAILED_EXIT: HarnessExit = { status: "failed" };

const isHarnessExit = (value: unknown): value is HarnessExit => {
  if (!value || typeof value !== "object") return false;
  const status = (value as HarnessExit).status;
  return status === "completed" || status === "failed" || status === "cancelled" || status === "disconnected";
};

// `done` must settle exactly once and never reject, so a misbehaving provider
// still transitions the session to "failed" instead of wedging it.
export const adaptSession = (session: HarnessSession): HarnessSession => ({
  ...session,
  done: Promise.resolve(session.done)
    .then((exit) => (isHarnessExit(exit) ? exit : FAILED_EXIT))
    .catch(() => FAILED_EXIT),
});

/**
 * Native command preparation. The operation's `call` children belong to it from preparation until
 * the turn it starts is done, or until it ends without starting one.
 */
export const createHarnessOperationPreparation =
  (input: {
    provider: HarnessProvider;
    calls: ReturnType<typeof createHarnessCallOwnership>;
    retained: ReturnType<typeof createRetainedHarnessCalls>;
    ensureActive: () => void;
    disposed: () => boolean;
    id: string;
  }) =>
  async (command: HarnessCommandContext, operation: HarnessOperation, options?: HarnessCallOptions) => {
    const { provider, calls, retained, ensureActive } = input;
    if (!provider.prepareOperation) throw new Error("This harness does not support native commands.");
    const call = await calls.open(options);
    const { context } = call;
    let prepared: PreparedHarnessOperation;
    try {
      prepared = await retained.invoke(command, options, async () => {
        if (operation.kind === "command" && provider.getCommandState) {
          const state = await provider.getCommandState(context, command);
          const name = /^\/\S+/.exec(operation.text)?.[0];
          const entry = state.commands.find((candidate) => candidate.name === name);
          if (entry?.disabledReason) throw new Error(entry.disabledReason);
        }
        return provider.prepareOperation!(context, command, operation);
      });
      ensureActive();
    } catch (error) {
      call.close();
      throw error;
    }
    return {
      execution: prepared.execution,
      invoke: async (invocation: Parameters<PreparedHarnessOperation["invoke"]>[0]) => {
        try {
          ensureActive();
          const result = await retained.invoke(
            command,
            options,
            async () => prepared.invoke(invocation),
            (result) => (result.kind === "started" ? result.session.done : Promise.resolve()),
          );
          if (result.kind !== "started") {
            call.close();
            return result;
          }
          void Promise.resolve(result.session.done).then(call.close, call.close);
          if (input.disposed()) {
            await result.session.stop();
            throw new HarnessDisposedError(`Harness has been disposed: ${input.id}`);
          }
          return { ...result, session: adaptSession(result.session) };
        } catch (error) {
          call.close();
          throw error;
        }
      },
    } satisfies PreparedHarnessOperation;
  };
