import type {
  CommandContext,
  CommandHelpersApi,
  CommandInvocation,
  CommandNotice,
  CommandOutcome,
  CommandSource,
  EventContext,
  EventDeliveryResult,
  ExtensionContextBase,
  ExtensionEventsApi,
  ExtensionLoggerApi,
  JsonObject,
  RepoContext,
  SerializedError,
  Struct,
} from "@pstdio/sdk/extensions";
import type { ExtensionRuntime, RuntimeCommandRecord, RuntimeMiddlewareRecord } from "../../types/runtime";
import { createEventDispatcher, type EventDispatcher, lifecycleEventId, refId } from "./dispatch";
import { type MiddlewareChainResult, runMiddlewareChain } from "./middleware";
import type {
  BuildEnvironmentInput,
  CommandExecuteInput,
  CommandRunner,
  CommandRunnerEnvironment,
  CommandRunnerHostDeps,
  ExtensionEventDispatchInput,
  HostCommandExecuteInput,
  InternalExecuteInput,
} from "./types";
import { DEFAULT_MAX_COMMAND_DEPTH } from "./types";

const consoleLogger: ExtensionLoggerApi = { info: () => {}, warn: () => {}, error: () => {} };

const defaultGenerateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const serializeError = (err: unknown): SerializedError => {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { message: String(err) };
};

const collectNotices = (env: CommandRunnerEnvironment, notices: CommandNotice[]) => ({
  ...env,
  notify: {
    ...env.notify,
    toast: async (notice: CommandNotice) => {
      notices.push(notice);
      await env.notify.toast(notice);
    },
  },
});

const withNotices = <TOutcome extends CommandOutcome>(outcome: TOutcome, notices: CommandNotice[]) =>
  notices.length > 0 ? ({ ...outcome, notices } as TOutcome) : outcome;

interface ContextFactory {
  buildExtensionContext(env: CommandRunnerEnvironment, ids: BuildEnvironmentInput, depth: number): ExtensionContextBase;
  buildCommandContext(
    env: CommandRunnerEnvironment,
    owner: { extensionId: string; name: string },
    commandId: string,
    invocation: CommandInvocation,
    invocationId: string,
    projectId: string,
    source: CommandSource | undefined,
    repo: RepoContext | undefined,
    depth: number,
  ): CommandContext;
}

const buildEventsApi = (dispatcher: EventDispatcher): ExtensionEventsApi => ({
  emit: async (event, payload) => dispatcher.dispatch(refId(event), payload as Struct),
});

const buildCommandsApi = (
  buildExecute: (currentDepth: number, projectId: string) => CommandHelpersApi["execute"],
  currentDepth: number,
  projectId: string,
): CommandHelpersApi => ({
  execute: buildExecute(currentDepth, projectId),
  continue: () => ({ type: "continue" }),
  patchParams: (params) => ({ type: "patchParams", params }),
  replaceParams: (params) => ({ type: "replaceParams", params }),
  replaceInvocation: (invocation) => ({ type: "replaceInvocation", invocation }),
  reject: (input) => ({ type: "reject", ...input }),
});

const createContextFactory = (
  dispatcher: EventDispatcher,
  logger: ExtensionLoggerApi,
  buildExecute: (currentDepth: number, projectId: string) => CommandHelpersApi["execute"],
): ContextFactory => ({
  buildExtensionContext(env, ids, depth) {
    return {
      projectId: ids.projectId,
      extensionId: ids.extensionId,
      name: ids.name,
      storage: env.storage,
      artifacts: env.artifacts,
      files: env.files,
      sessions: env.sessions,
      workspaces: env.workspaces,
      worktrees: env.worktrees,
      repos: env.repos,
      commands: buildCommandsApi(buildExecute, depth, ids.projectId),
      events: buildEventsApi(dispatcher),
      activity: env.activity,
      notify: env.notify,
      process: env.process,
      net: env.net,
      logger,
      settings: env.settings,
    };
  },

  buildCommandContext(env, owner, commandId, invocation, invocationId, projectId, source, repo, depth) {
    const base = this.buildExtensionContext(
      env,
      { projectId, extensionId: owner.extensionId, name: owner.name },
      depth,
    );
    return {
      ...base,
      commands: buildCommandsApi(buildExecute, depth, projectId),
      commandId,
      invocationId,
      invocation,
      params: invocation.params,
      resource: invocation.resource,
      slot: invocation.slot,
      repo,
      source,
    };
  },
});

const buildExecute = (runRef: {
  run: (input: InternalExecuteInput) => Promise<CommandOutcome>;
}): ((currentDepth: number, projectId: string) => CommandHelpersApi["execute"]) => {
  return (currentDepth, projectId) => async (command, invocation) => {
    const id = refId(command);
    const outcome = await runRef.run({
      commandId: id,
      projectId,
      params: (invocation?.params ?? {}) as JsonObject,
      resource: invocation?.resource,
      repo: invocation?.repoId
        ? ({
            projectId,
            repoId: invocation.repoId,
            path: invocation.repoPath ?? "",
          } satisfies RepoContext)
        : undefined,
      slot: invocation?.slot,
      source: "api",
      metadata: invocation?.metadata,
      depth: currentDepth + 1,
    });
    return outcome as CommandOutcome<never>;
  };
};

const buildRequestPayload = (
  record: RuntimeCommandRecord,
  invocation: CommandInvocation,
  invocationId: string,
  projectId: string,
  source: CommandSource | undefined,
  repo: RepoContext | undefined,
) => ({
  commandId: record.id,
  invocationId,
  source,
  params: invocation.params,
  resource: invocation.resource,
  repo,
  projectId,
});

const buildHostRequestPayload = (
  commandId: string,
  invocation: CommandInvocation,
  invocationId: string,
  projectId: string,
  source: CommandSource | undefined,
  repo: RepoContext | undefined,
) => ({
  commandId,
  invocationId,
  source,
  params: invocation.params,
  resource: invocation.resource,
  repo,
  projectId,
});

interface RunnerState {
  runtime: ExtensionRuntime;
  deps: CommandRunnerHostDeps;
  maxDepth: number;
  generateId: () => string;
  dispatcher: EventDispatcher;
  factory: ContextFactory;
}

const findCommand = (runtime: ExtensionRuntime, id: string) => runtime.commands.find((cmd) => cmd.id === id);

const middlewaresFor = (runtime: ExtensionRuntime, commandId: string) =>
  runtime.middlewares.filter((middleware) => middleware.commandId === commandId);

const createEnvironmentCache = (deps: CommandRunnerHostDeps, projectId: string, notices: CommandNotice[]) => {
  const environments = new Map<string, CommandRunnerEnvironment>();

  return async (owner: { extensionId: string; name: string }) => {
    const key = `${owner.extensionId}\0${owner.name}`;
    const existing = environments.get(key);
    if (existing) return existing;

    const env = collectNotices(
      await deps.buildEnvironment({
        projectId,
        extensionId: owner.extensionId,
        name: owner.name,
      }),
      notices,
    );
    environments.set(key, env);
    return env;
  };
};

const environmentFailedOutcome = <TResult = unknown>(err: unknown): CommandOutcome<TResult> => ({
  ok: false,
  status: "error",
  code: "environment_failed",
  reason: `Failed to build extension environment: ${err instanceof Error ? err.message : String(err)}`,
  error: serializeError(err),
});

const executeExtensionCommand = async (state: RunnerState, input: InternalExecuteInput): Promise<CommandOutcome> => {
  if (input.depth > state.maxDepth) {
    return {
      ok: false,
      status: "rejected",
      code: "nested_depth_exceeded",
      reason: `Nested command depth exceeded (${state.maxDepth}) while invoking ${input.commandId}`,
    };
  }

  const record = findCommand(state.runtime, input.commandId);
  if (!record) {
    return {
      ok: false,
      status: "error",
      code: "command_not_found",
      reason: `Command "${input.commandId}" is not registered`,
    };
  }

  const notices: CommandNotice[] = [];
  const envFor = createEnvironmentCache(state.deps, input.projectId, notices);
  let commandEnv: CommandRunnerEnvironment;
  try {
    commandEnv = await envFor(record);
  } catch (err) {
    return environmentFailedOutcome(err);
  }

  const invocationId = state.generateId();
  const initialInvocation: CommandInvocation = {
    params: (input.params ?? {}) as JsonObject,
    resource: input.resource,
    repoId: input.repo?.repoId,
    repoPath: input.repo?.path,
    slot: input.slot,
    metadata: input.metadata,
  };

  const buildCommandCtx = (invocation: CommandInvocation) =>
    state.factory.buildCommandContext(
      commandEnv,
      record,
      record.id,
      invocation,
      invocationId,
      input.projectId,
      input.source,
      input.repo,
      input.depth,
    );
  const buildMiddlewareCtx = async (invocation: CommandInvocation, middleware: RuntimeMiddlewareRecord) =>
    state.factory.buildCommandContext(
      await envFor(middleware),
      middleware,
      record.id,
      invocation,
      invocationId,
      input.projectId,
      input.source,
      input.repo,
      input.depth,
    );

  const requestedPayload = buildRequestPayload(
    record,
    initialInvocation,
    invocationId,
    input.projectId,
    input.source,
    input.repo,
  );
  await state.dispatcher.dispatch(lifecycleEventId("requested", record.id), requestedPayload);

  let middlewareResult: MiddlewareChainResult;
  try {
    middlewareResult = await runMiddlewareChain(
      middlewaresFor(state.runtime, record.id),
      initialInvocation,
      buildMiddlewareCtx,
    );
  } catch (err) {
    return withNotices(environmentFailedOutcome(err), notices);
  }

  if (middlewareResult.status === "reject") {
    const rejectedPayload = { ...requestedPayload, ...middlewareResult.rejection };
    await state.dispatcher.dispatch(lifecycleEventId("rejected", record.id), rejectedPayload);
    return withNotices(
      {
        ok: false,
        status: "rejected",
        code: middlewareResult.rejection.code,
        reason: middlewareResult.rejection.reason,
        data: middlewareResult.rejection.data,
      },
      notices,
    );
  }

  const finalInvocation = middlewareResult.invocation;
  const startedPayload = {
    ...requestedPayload,
    params: finalInvocation.params,
    resource: finalInvocation.resource,
  };

  await state.dispatcher.dispatch(lifecycleEventId("started", record.id), startedPayload);

  const start = Date.now();
  try {
    const value = await record.run(buildCommandCtx(finalInvocation));
    const elapsedMs = Date.now() - start;
    await state.dispatcher.dispatch(lifecycleEventId("completed", record.id), {
      ...startedPayload,
      result: value,
      elapsedMs,
    });
    return withNotices({ ok: true, status: "success", value }, notices);
  } catch (err) {
    const elapsedMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    await state.dispatcher.dispatch(lifecycleEventId("failed", record.id), {
      ...startedPayload,
      reason: message,
      error: serializeError(err),
      elapsedMs,
    });
    return withNotices(
      { ok: false, status: "error", code: "handler_threw", reason: message, error: serializeError(err) },
      notices,
    );
  }
};

const executeHostCommandInternal = async <TResult>(
  state: RunnerState,
  input: HostCommandExecuteInput<TResult>,
): Promise<CommandOutcome<TResult>> => {
  const notices: CommandNotice[] = [];
  const envFor = createEnvironmentCache(state.deps, input.projectId, notices);
  const invocationId = state.generateId();
  const initialInvocation: CommandInvocation = {
    params: (input.params ?? {}) as JsonObject,
    resource: input.resource,
    repoId: input.repo?.repoId,
    repoPath: input.repo?.path,
    slot: input.slot,
    metadata: input.metadata,
  };

  const requestedPayload = buildHostRequestPayload(
    input.commandId,
    initialInvocation,
    invocationId,
    input.projectId,
    input.source,
    input.repo,
  );
  await state.dispatcher.dispatch(lifecycleEventId("requested", input.commandId), requestedPayload);

  const buildMiddlewareCtx = async (invocation: CommandInvocation, middleware: RuntimeMiddlewareRecord) =>
    state.factory.buildCommandContext(
      await envFor(middleware),
      middleware,
      input.commandId,
      invocation,
      invocationId,
      input.projectId,
      input.source,
      input.repo,
      0,
    );

  let middlewareResult: MiddlewareChainResult;
  try {
    middlewareResult = await runMiddlewareChain(
      middlewaresFor(state.runtime, input.commandId),
      initialInvocation,
      buildMiddlewareCtx,
    );
  } catch (err) {
    return withNotices(environmentFailedOutcome<TResult>(err), notices);
  }

  if (middlewareResult.status === "reject") {
    const rejectedPayload = { ...requestedPayload, ...middlewareResult.rejection };
    await state.dispatcher.dispatch(lifecycleEventId("rejected", input.commandId), rejectedPayload);
    return withNotices(
      {
        ok: false,
        status: "rejected",
        code: middlewareResult.rejection.code,
        reason: middlewareResult.rejection.reason,
        data: middlewareResult.rejection.data,
      },
      notices,
    );
  }

  const finalInvocation = middlewareResult.invocation;
  const startedPayload = {
    ...requestedPayload,
    params: finalInvocation.params,
    resource: finalInvocation.resource,
  };

  await state.dispatcher.dispatch(lifecycleEventId("started", input.commandId), startedPayload);

  const start = Date.now();
  try {
    const value = await input.run(finalInvocation);
    const elapsedMs = Date.now() - start;
    await state.dispatcher.dispatch(lifecycleEventId("completed", input.commandId), {
      ...startedPayload,
      result: value,
      elapsedMs,
    });
    return withNotices({ ok: true, status: "success", value }, notices);
  } catch (err) {
    const elapsedMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    await state.dispatcher.dispatch(lifecycleEventId("failed", input.commandId), {
      ...startedPayload,
      reason: message,
      error: serializeError(err),
      elapsedMs,
    });
    return withNotices(
      { ok: false, status: "error", code: "handler_threw", reason: message, error: serializeError(err) },
      notices,
    );
  }
};

export const createCommandRunner = (runtime: ExtensionRuntime, deps: CommandRunnerHostDeps): CommandRunner => {
  const maxDepth = deps.maxDepth ?? DEFAULT_MAX_COMMAND_DEPTH;
  const generateId = deps.generateId ?? defaultGenerateId;
  const logger = deps.logger ?? consoleLogger;

  const runRef = { run: undefined as unknown as (input: InternalExecuteInput) => Promise<CommandOutcome> };
  const executeBuilder = buildExecute(runRef);

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
    executeHostCommand: (input) => executeHostCommandInternal(state, input),
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
