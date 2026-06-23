import type { CommandOutcome, EventContext, EventDeliveryResult, Struct } from "@pstdio/sdk/extensions";
import type { ExtensionRuntime } from "../../types/runtime";
import { createContextFactory, createExecuteBuilder, type RunnerState } from "./context";
import { createEventDispatcher } from "./dispatch";
import { executeExtensionCommand } from "./execute-command";
import { executeHostCommand } from "./execute-host-command";
import { consoleLogger, defaultGenerateId } from "./internals";
import type {
  BuildEnvironmentInput,
  CommandExecuteInput,
  CommandRunner,
  CommandRunnerHostDeps,
  ExtensionEventDispatchInput,
  InternalExecuteInput,
} from "./types";
import { DEFAULT_MAX_COMMAND_DEPTH } from "./types";
export const createCommandRunner = (runtime: ExtensionRuntime, deps: CommandRunnerHostDeps): CommandRunner => {
  const maxDepth = deps.maxDepth ?? DEFAULT_MAX_COMMAND_DEPTH;
  const generateId = deps.generateId ?? defaultGenerateId;
  const logger = deps.logger ?? consoleLogger;

  const runRef = { run: undefined as unknown as (input: InternalExecuteInput) => Promise<CommandOutcome> };
  const executeBuilder = createExecuteBuilder(runRef);

  const buildEventContext = async (ids: BuildEnvironmentInput, eventId: string, deliveryId: string) => {
    const env = await deps.buildEnvironment(ids);
    const base = factory.buildExtensionContext(env, ids, 0);
    return { ...base, eventId, deliveryId } satisfies EventContext;
  };

  const dispatcher = createEventDispatcher({ runtime, deps, generateId, logger, buildEventContext });
  const factory = createContextFactory(dispatcher, logger, executeBuilder);
  const state: RunnerState = { runtime, deps, maxDepth, generateId, dispatcher, factory };
  const executeInternal = (input: InternalExecuteInput) => executeExtensionCommand(state, input);

  runRef.run = executeInternal;

  return {
    execute: (input: CommandExecuteInput) => executeInternal({ ...input, depth: 0 }),
    executeHostCommand: (input) => executeHostCommand(state, input),
    dispatchEvent: (input: ExtensionEventDispatchInput): Promise<EventDeliveryResult> =>
      dispatcher.dispatch(input.eventId, { ...(input.payload ?? {}), projectId: input.projectId } as Struct),
  };
};

export type {
  BuildEnvironmentInput,
  CommandExecuteInput,
  CommandRunner,
  CommandRunnerEnvironment,
  CommandRunnerHostDeps,
  ExtensionEventDispatchInput,
  HostCommandExecuteInput,
} from "./types";
export { DEFAULT_MAX_COMMAND_DEPTH } from "./types";
