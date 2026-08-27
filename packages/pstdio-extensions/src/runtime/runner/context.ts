import type {
  CommandContext,
  CommandHelpersApi,
  CommandInvocation,
  CommandOutcome,
  CommandSource,
  ExtensionConnectionsApi,
  ExtensionContextBase,
  ExtensionEventsApi,
  ExtensionLoggerApi,
  JsonObject,
  RepoContext,
  Struct,
} from "@pstdio/sdk/extensions";
import type { ExtensionRuntime } from "../../types/runtime";
import { type EventDispatcher, refId } from "./dispatch";
import type {
  BuildEnvironmentInput,
  CommandRunnerEnvironment,
  CommandRunnerHostDeps,
  InternalExecuteInput,
} from "./types";

export interface ContextFactory {
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
    workspace?: { workspaceDir?: string; workspaceId?: string },
    signal?: AbortSignal,
  ): CommandContext;
}

export interface RunnerState {
  runtime: ExtensionRuntime;
  deps: CommandRunnerHostDeps;
  maxDepth: number;
  generateId: () => string;
  dispatcher: EventDispatcher;
  factory: ContextFactory;
}

interface CommandExecutionScope {
  depth: number;
  extensionId: string;
  projectId: string;
  workspaceDir?: string;
  workspaceId?: string;
  signal?: AbortSignal;
}

const buildEventsApi = (dispatcher: EventDispatcher, extensionId: string): ExtensionEventsApi => ({
  emit: async (event, payload) => dispatcher.dispatch(refId(event, extensionId), payload as Struct),
});

const connectionsWithSignal = (connections: ExtensionConnectionsApi, signal: AbortSignal): ExtensionConnectionsApi => ({
  request: <TBody>(connectionId: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) =>
    connections.request<TBody>(connectionId, {
      ...input,
      signal: input.signal ? AbortSignal.any([signal, input.signal]) : signal,
    }),
  stream: (connectionId, input) =>
    connections.stream(connectionId, {
      ...input,
      signal: input.signal ? AbortSignal.any([signal, input.signal]) : signal,
    }),
});

const buildCommandsApi = (
  createExecute: (scope: CommandExecutionScope) => CommandHelpersApi["execute"],
  scope: CommandExecutionScope,
): CommandHelpersApi => ({
  execute: createExecute(scope),
  continue: () => ({ type: "continue" }),
  patchParams: (params) => ({ type: "patchParams", params }),
  replaceParams: (params) => ({ type: "replaceParams", params }),
  replaceInvocation: (invocation) => ({ type: "replaceInvocation", invocation }),
  reject: (input) => ({ type: "reject", ...input }),
});

export const createExecuteBuilder = (runRef: {
  run: (input: InternalExecuteInput) => Promise<CommandOutcome>;
}): ((scope: CommandExecutionScope) => CommandHelpersApi["execute"]) => {
  return (scope) => async (command, invocation) => {
    const id = refId(command, scope.extensionId);
    const outcome = await runRef.run({
      commandId: id,
      projectId: scope.projectId,
      params: (invocation?.params ?? {}) as JsonObject,
      resource: invocation?.resource,
      repo: invocation?.repoId
        ? ({
            projectId: scope.projectId,
            repoId: invocation.repoId,
            path: invocation.repoPath ?? "",
          } satisfies RepoContext)
        : undefined,
      slot: invocation?.slot,
      attachment: invocation?.attachment,
      workspaceDir: scope.workspaceDir,
      workspaceId: scope.workspaceId,
      source: "api",
      metadata: invocation?.metadata,
      signal: scope.signal,
      depth: scope.depth + 1,
    });
    return outcome as CommandOutcome<never>;
  };
};

export const createContextFactory = (
  dispatcher: EventDispatcher,
  logger: ExtensionLoggerApi,
  createExecute: (scope: CommandExecutionScope) => CommandHelpersApi["execute"],
): ContextFactory => ({
  buildExtensionContext(env, ids, depth) {
    const scope = {
      depth,
      extensionId: ids.extensionId,
      projectId: ids.projectId,
      workspaceDir: ids.workspaceDir,
      workspaceId: ids.workspaceId,
    };

    return {
      projectId: ids.projectId,
      workspaceId: env.workspaceId,
      project: env.project,
      extensionId: ids.extensionId,
      name: ids.name,
      storage: env.storage,
      artifacts: env.artifacts,
      repoFiles: env.repoFiles,
      workspaceFiles: env.workspaceFiles,
      packageFiles: env.packageFiles,
      extensionFiles: env.extensionFiles,
      files: env.files,
      skills: env.skills,
      sessions: env.sessions,
      workspaces: env.workspaces,
      repos: env.repos,
      commands: buildCommandsApi(createExecute, scope),
      events: buildEventsApi(dispatcher, ids.extensionId),
      activity: env.activity,
      notify: env.notify,
      process: env.process,
      net: env.net,
      connections: env.connections ?? {
        request: async () => {
          throw new Error("Extension connections are not available in this host.");
        },
        stream: async function* () {
          yield await Promise.reject(new Error("Extension connections are not available in this host."));
        },
      },
      terminal: env.terminal,
      logger,
      settings: env.settings,
    };
  },

  buildCommandContext(
    env,
    owner,
    commandId,
    invocation,
    invocationId,
    projectId,
    source,
    repo,
    depth,
    workspace,
    signal,
  ) {
    const base = this.buildExtensionContext(
      env,
      {
        projectId,
        extensionId: owner.extensionId,
        name: owner.name,
        workspaceDir: workspace?.workspaceDir,
        workspaceId: workspace?.workspaceId,
      },
      depth,
    );
    const commandSignal = signal ?? new AbortController().signal;
    const connections = signal ? connectionsWithSignal(base.connections, signal) : base.connections;
    const scopedEnvironment = signal ? env.withSignal?.(signal) : undefined;
    if (signal && !scopedEnvironment) {
      throw new Error("Command environment cannot scope host helpers to cancellation.");
    }
    return {
      ...base,
      commands: buildCommandsApi(createExecute, {
        depth,
        extensionId: owner.extensionId,
        projectId,
        workspaceDir: workspace?.workspaceDir,
        workspaceId: workspace?.workspaceId,
        signal,
      }),
      connections,
      sessions: scopedEnvironment?.sessions ?? base.sessions,
      workspaces: scopedEnvironment?.workspaces ?? base.workspaces,
      commandId,
      invocationId,
      signal: commandSignal,
      invocation: {
        source,
        attachment: invocation.attachment,
        slot: invocation.slot,
        metadata: invocation.metadata,
      },
      resource: invocation.resource,
      attachment: invocation.attachment,
      slot: invocation.slot,
      repo,
      source,
    };
  },
});
