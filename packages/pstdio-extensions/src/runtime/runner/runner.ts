import type {
  CommandContext,
  CommandHelpersApi,
  CommandInvocation,
  CommandNotice,
  CommandOutcome,
  CommandSource,
  EventContext,
  ExtensionContextBase,
  ExtensionEventsApi,
  ExtensionLoggerApi,
  JsonObject,
  RepoContext,
  SerializedError,
  Struct,
} from "@pstdio/sdk/extensions";
import type { ExtensionRuntime, RuntimeCommandRecord } from "../../types/runtime";
import { createEventDispatcher, type EventDispatcher, lifecycleEventId, refId } from "./dispatch";
import { runMiddlewareChain } from "./middleware";
import type {
  BuildEnvironmentInput,
  CommandExecuteInput,
  CommandRunner,
  CommandRunnerEnvironment,
  CommandRunnerHostDeps,
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
    record: RuntimeCommandRecord,
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
      namespace: ids.namespace,
      storage: env.storage,
      artifacts: env.artifacts,
      files: env.files,
      sessions: env.sessions,
      workspaces: env.workspaces,
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

  buildCommandContext(env, record, invocation, invocationId, projectId, source, repo, depth) {
    const base = this.buildExtensionContext(
      env,
      { projectId, extensionId: record.extensionId, namespace: record.namespace },
      depth,
    );
    return {
      ...base,
      commands: buildCommandsApi(buildExecute, depth, projectId),
      commandId: record.id,
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

  const findCommand = (id: string) => runtime.commands.find((cmd) => cmd.id === id);
  const middlewaresFor = (commandId: string) => runtime.middlewares.filter((m) => m.commandId === commandId);

  const executeInternal = async (input: InternalExecuteInput): Promise<CommandOutcome> => {
    if (input.depth > maxDepth) {
      return {
        ok: false,
        status: "rejected",
        code: "nested_depth_exceeded",
        reason: `Nested command depth exceeded (${maxDepth}) while invoking ${input.commandId}`,
      };
    }

    const record = findCommand(input.commandId);
    if (!record) {
      return {
        ok: false,
        status: "error",
        code: "command_not_found",
        reason: `Command "${input.commandId}" is not registered`,
      };
    }

    let env: CommandRunnerEnvironment;
    try {
      env = await deps.buildEnvironment({
        projectId: input.projectId,
        extensionId: record.extensionId,
        namespace: record.namespace,
      });
    } catch (err) {
      return {
        ok: false,
        status: "error",
        code: "environment_failed",
        reason: `Failed to build extension environment: ${err instanceof Error ? err.message : String(err)}`,
        error: serializeError(err),
      };
    }

    const notices: CommandNotice[] = [];
    const commandEnv = collectNotices(env, notices);
    const invocationId = generateId();
    const initialInvocation: CommandInvocation = {
      params: (input.params ?? {}) as JsonObject,
      resource: input.resource,
      repoId: input.repo?.repoId,
      repoPath: input.repo?.path,
      slot: input.slot,
      metadata: input.metadata,
    };

    const buildCtx = (invocation: CommandInvocation) =>
      factory.buildCommandContext(
        commandEnv,
        record,
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
    await dispatcher.dispatch(lifecycleEventId("requested", record.id), requestedPayload);

    const middlewareResult = await runMiddlewareChain(middlewaresFor(record.id), record, initialInvocation, buildCtx);

    if (middlewareResult.status === "reject") {
      const rejectedPayload = { ...requestedPayload, ...middlewareResult.rejection };
      await dispatcher.dispatch(lifecycleEventId("rejected", record.id), rejectedPayload);
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

    await dispatcher.dispatch(lifecycleEventId("started", record.id), startedPayload);

    const start = Date.now();
    try {
      const value = await record.run(buildCtx(finalInvocation));
      const elapsedMs = Date.now() - start;
      await dispatcher.dispatch(lifecycleEventId("completed", record.id), {
        ...startedPayload,
        result: value,
        elapsedMs,
      });
      return withNotices({ ok: true, status: "success", value }, notices);
    } catch (err) {
      const elapsedMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      await dispatcher.dispatch(lifecycleEventId("failed", record.id), {
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

  runRef.run = executeInternal;

  return {
    execute: (input: CommandExecuteInput) => executeInternal({ ...input, depth: 0 }),
  };
};

export type {
  BuildEnvironmentInput,
  CommandExecuteInput,
  CommandRunner,
  CommandRunnerEnvironment,
  CommandRunnerHostDeps,
} from "./types";
export { DEFAULT_MAX_COMMAND_DEPTH } from "./types";
