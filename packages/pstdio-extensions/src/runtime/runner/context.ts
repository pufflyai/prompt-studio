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
import type { InvocationScope } from "./scope";
import type {
  BuildEnvironmentInput,
  CommandRunnerEnvironment,
  CommandRunnerHostDeps,
  InternalExecuteInput,
  ScopedHostApis,
} from "./types";

export interface ContextFactory {
  buildExtensionContext(
    env: CommandRunnerEnvironment,
    ids: BuildEnvironmentInput,
    depth: number,
    scope?: InvocationScope,
  ): ExtensionContextBase;
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
    scope: InvocationScope,
    workspace?: { workspaceDir?: string; workspaceId?: string },
  ): CommandContext;
}

export interface RunnerState {
  runtime: ExtensionRuntime;
  deps: CommandRunnerHostDeps;
  logger: ExtensionLoggerApi;
  maxDepth: number;
  generateId: () => string;
  dispatcher: EventDispatcher;
  factory: ContextFactory;
}

/** Where a nested `ctx.commands.execute()` runs from. */
interface NestedExecuteOrigin {
  depth: number;
  extensionId: string;
  projectId: string;
  workspaceDir?: string;
  workspaceId?: string;
  signal?: AbortSignal;
}

const unavailableConnections: ExtensionConnectionsApi = {
  request: async () => {
    throw new Error("Extension connections are not available in this host.");
  },
  stream: async function* () {
    yield await Promise.reject(new Error("Extension connections are not available in this host."));
  },
};

const buildEventsApi = (dispatcher: EventDispatcher, extensionId: string): ExtensionEventsApi => ({
  emit: async (event, payload) => dispatcher.dispatch(refId(event, extensionId), payload as Struct),
});

const buildCommandsApi = (
  createExecute: (origin: NestedExecuteOrigin) => CommandHelpersApi["execute"],
  origin: NestedExecuteOrigin,
): CommandHelpersApi => ({
  execute: createExecute(origin),
  continue: () => ({ type: "continue" }),
  patchParams: (params) => ({ type: "patchParams", params }),
  replaceParams: (params) => ({ type: "replaceParams", params }),
  replaceInvocation: (invocation) => ({ type: "replaceInvocation", invocation }),
  reject: (input) => ({ type: "reject", ...input }),
});

export const createExecuteBuilder = (runRef: {
  run: (input: InternalExecuteInput) => Promise<CommandOutcome>;
}): ((origin: NestedExecuteOrigin) => CommandHelpersApi["execute"]) => {
  return (origin) => async (command, invocation) => {
    const id = refId(command, origin.extensionId);
    const outcome = await runRef.run({
      commandId: id,
      projectId: origin.projectId,
      params: (invocation?.params ?? {}) as JsonObject,
      resource: invocation?.resource,
      repo: invocation?.repoId
        ? ({
            projectId: origin.projectId,
            repoId: invocation.repoId,
            path: invocation.repoPath ?? "",
          } satisfies RepoContext)
        : undefined,
      slot: invocation?.slot,
      attachment: invocation?.attachment,
      workspaceDir: origin.workspaceDir,
      workspaceId: origin.workspaceId,
      source: "api",
      metadata: invocation?.metadata,
      signal: origin.signal,
      depth: origin.depth + 1,
    });
    return outcome as CommandOutcome<never>;
  };
};

export const createContextFactory = (
  dispatcher: EventDispatcher,
  logger: ExtensionLoggerApi,
  createExecute: (origin: NestedExecuteOrigin) => CommandHelpersApi["execute"],
): ContextFactory => ({
  buildExtensionContext(env, ids, depth, scope) {
    const hostApis: ScopedHostApis = scope ? env.withScope(scope) : env;
    const origin = {
      depth,
      extensionId: ids.extensionId,
      projectId: ids.projectId,
      workspaceDir: ids.workspaceDir,
      workspaceId: ids.workspaceId,
      signal: scope?.signal,
    };

    return {
      projectId: ids.projectId,
      workspaceId: env.workspaceId,
      project: env.project,
      extensionId: ids.extensionId,
      name: ids.name,
      storage: env.storage,
      resources: env.resources,
      artifacts: env.artifacts,
      repoFiles: env.repoFiles,
      workspaceFiles: env.workspaceFiles,
      packageFiles: env.packageFiles,
      extensionFiles: env.extensionFiles,
      files: env.files,
      skills: env.skills,
      sessions: hostApis.sessions,
      workspaces: hostApis.workspaces,
      repos: env.repos,
      commands: buildCommandsApi(createExecute, origin),
      events: buildEventsApi(dispatcher, ids.extensionId),
      activity: env.activity,
      notify: env.notify,
      process: hostApis.process,
      net: env.net,
      connections: hostApis.connections ?? unavailableConnections,
      terminal: hostApis.terminal,
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
    scope,
    workspace,
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
      scope,
    );
    return {
      ...base,
      commandId,
      invocationId,
      signal: scope.signal,
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
