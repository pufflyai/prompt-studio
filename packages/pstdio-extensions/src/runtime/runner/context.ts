import type {
  CommandContext,
  CommandHelpersApi,
  CommandInvocation,
  CommandOutcome,
  CommandSource,
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

const buildEventsApi = (dispatcher: EventDispatcher): ExtensionEventsApi => ({
  emit: async (event, payload) => dispatcher.dispatch(refId(event), payload as Struct),
});

const buildCommandsApi = (
  createExecute: (currentDepth: number, projectId: string) => CommandHelpersApi["execute"],
  currentDepth: number,
  projectId: string,
): CommandHelpersApi => ({
  execute: createExecute(currentDepth, projectId),
  continue: () => ({ type: "continue" }),
  patchParams: (params) => ({ type: "patchParams", params }),
  replaceParams: (params) => ({ type: "replaceParams", params }),
  replaceInvocation: (invocation) => ({ type: "replaceInvocation", invocation }),
  reject: (input) => ({ type: "reject", ...input }),
});

export const createExecuteBuilder = (runRef: {
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
      attachment: invocation?.attachment,
      source: "api",
      metadata: invocation?.metadata,
      depth: currentDepth + 1,
    });
    return outcome as CommandOutcome<never>;
  };
};

export const createContextFactory = (
  dispatcher: EventDispatcher,
  logger: ExtensionLoggerApi,
  createExecute: (currentDepth: number, projectId: string) => CommandHelpersApi["execute"],
): ContextFactory => ({
  buildExtensionContext(env, ids, depth) {
    return {
      projectId: ids.projectId,
      project: env.project,
      extensionId: ids.extensionId,
      name: ids.name,
      storage: env.storage,
      artifacts: env.artifacts,
      repoFiles: env.repoFiles,
      files: env.files,
      sessions: env.sessions,
      workspaces: env.workspaces,
      worktrees: env.worktrees,
      repos: env.repos,
      commands: buildCommandsApi(createExecute, depth, ids.projectId),
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
      commands: buildCommandsApi(createExecute, depth, projectId),
      commandId,
      invocationId,
      invocation,
      params: invocation.params,
      resource: invocation.resource,
      attachment: invocation.attachment,
      slot: invocation.slot,
      repo,
      source,
    };
  },
});
