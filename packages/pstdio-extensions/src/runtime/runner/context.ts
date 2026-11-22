import type {
  CommandContext,
  CommandHelpersApi,
  CommandInvocation,
  CommandOutcome,
  CommandSource,
  ExtensionAccountApi,
  ExtensionConnectionsApi,
  ExtensionContextBase,
  ExtensionEventsApi,
  ExtensionLoggerApi,
  ExtensionViewsApi,
  JsonObject,
  Struct,
} from "@pstdio/sdk/extensions";
import { qualifyNavigationTarget, queryChangeEnvelopeSchema } from "pstdio-api-contracts";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { ExtensionRuntime } from "../../types/runtime";
import { canonicalNavigationOwners } from "../canonical-navigation-owners";
import { boundedQueryAutomation, boundedQueryStorage, rejectUnboundedCollectionRead } from "./collection-query";
import { createCommandRejection } from "./command-rejection";
import { type EventDispatcher, refId } from "./dispatch";
import { markHostContext } from "./host-context";
import type { NavigationScope } from "./navigation-scope";
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
    navigationScope?: NavigationScope,
  ): ExtensionContextBase;
  buildCommandContext(
    env: CommandRunnerEnvironment,
    owner: { extensionId: string; name: string },
    commandId: string,
    invocation: CommandInvocation,
    invocationId: string,
    projectId: string,
    source: CommandSource | undefined,
    depth: number,
    scope: InvocationScope,
    workspace?: { workspaceDir?: string; workspaceId?: string },
    navigationScope?: NavigationScope,
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
  collectionQuery?: InvocationScope["collectionQuery"];
  navigationScope?: NavigationScope;
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

const unavailableAccountCall = (): never => {
  throw new Error("The Cloud account is not available in this host.");
};
const unavailableAccount: ExtensionAccountApi = {
  status: unavailableAccountCall,
  login: unavailableAccountCall,
  loginStatus: unavailableAccountCall,
  cancelLogin: unavailableAccountCall,
  logout: unavailableAccountCall,
  devices: unavailableAccountCall,
  renameDevice: unavailableAccountCall,
  removeDevice: unavailableAccountCall,
  projectSyncStatus: unavailableAccountCall,
  retryProjectSyncSource: unavailableAccountCall,
  syncProject: unavailableAccountCall,
  stopProjectSync: unavailableAccountCall,
  resolveReturnedChanges: unavailableAccountCall,
};

const unavailableViews = (): never => {
  throw new Error("Saved views are not available in this host.");
};
const unavailableViewsApi: ExtensionViewsApi = {
  list: unavailableViews,
  create: unavailableViews,
  update: unavailableViews,
  remove: unavailableViews,
  reorder: unavailableViews,
  setDefault: unavailableViews,
};

const buildEventsApi = (
  dispatcher: EventDispatcher,
  origin: BuildEnvironmentInput,
  runtime: ExtensionRuntime,
): ExtensionEventsApi => ({
  emit: async (event, payload, options) =>
    dispatcher.dispatch(
      refId(
        typeof event !== "string" &&
          runtime.extensions.some(
            (provider) => provider.id === canonicalExtensionId(event.extensionId ?? origin.extensionId),
          )
          ? { ...event, extensionId: canonicalExtensionId(event.extensionId ?? origin.extensionId) }
          : event,
        origin.extensionId,
      ),
      payload as Struct,
      origin,
      options?.refresh ? queryChangeEnvelopeSchema.parse(options.refresh) : undefined,
    ),
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
  reject: createCommandRejection,
});

export const createExecuteBuilder = (runRef: {
  run: (input: InternalExecuteInput) => Promise<CommandOutcome>;
}): ((origin: NestedExecuteOrigin) => CommandHelpersApi["execute"]) => {
  return (origin) => async (command, invocation) => {
    const id = refId(command, origin.extensionId);
    const outcome = await runRef.run({
      collectionQuery: origin.collectionQuery,
      commandId: id,
      projectId: origin.projectId,
      params: (invocation?.params ?? {}) as JsonObject,
      resource: invocation?.resource,
      slot: invocation?.slot,
      attachment: invocation?.attachment,
      workspaceDir: origin.workspaceDir,
      workspaceId: origin.workspaceId,
      source: "api",
      metadata: invocation?.metadata,
      signal: origin.signal,
      navigationScope: origin.navigationScope,
      depth: origin.depth + 1,
    });
    return outcome as CommandOutcome<never>;
  };
};

export const createContextFactory = (
  dispatcher: EventDispatcher,
  createLogger: (extensionId: string) => ExtensionLoggerApi,
  createExecute: (origin: NestedExecuteOrigin) => CommandHelpersApi["execute"],
  runtime: ExtensionRuntime,
): ContextFactory => ({
  buildExtensionContext(env, ids, depth, scope, navigationScope) {
    const hostApis: ScopedHostApis = scope ? env.withScope(scope) : env;
    const origin = {
      collectionQuery: scope?.collectionQuery,
      navigationScope,
      depth,
      extensionId: ids.extensionId,
      projectId: ids.projectId,
      workspaceDir: ids.workspaceDir,
      workspaceId: ids.workspaceId,
      signal: scope?.signal,
    };

    return markHostContext({
      projectId: ids.projectId,
      workspaceId: env.workspaceId,
      project: env.project,
      extensionId: ids.extensionId,
      name: ids.name,
      storage: scope?.collectionQuery ? boundedQueryStorage(hostApis.storage) : hostApis.storage,
      resources: hostApis.resources,
      views: env.views ?? unavailableViewsApi,
      navigation: {
        open: (target) => {
          if (navigationScope)
            navigationScope.open(
              canonicalNavigationOwners(qualifyNavigationTarget(target, ids.extensionId, ids.projectId)),
            );
        },
      },
      artifacts: hostApis.artifacts,
      projectFiles: hostApis.projectFiles,
      workspaceFiles: hostApis.workspaceFiles,
      packageFiles: hostApis.packageFiles,
      extensionFiles: hostApis.extensionFiles,
      files: hostApis.files,
      skills: hostApis.skills,
      extensions: hostApis.extensions,
      sessions: hostApis.sessions,
      workspaces: scope?.collectionQuery
        ? { ...hostApis.workspaces, list: rejectUnboundedCollectionRead }
        : hostApis.workspaces,
      commands: buildCommandsApi(createExecute, origin),
      events: buildEventsApi(dispatcher, ids, runtime),
      activity: env.activity,
      notify: env.notify,
      automation: scope?.collectionQuery ? boundedQueryAutomation(env.automation) : env.automation,
      process: hostApis.process,
      net: env.net,
      connections: hostApis.connections ?? unavailableConnections,
      terminal: hostApis.terminal,
      logger: createLogger(ids.extensionId),
      settings: hostApis.settings,
      account: hostApis.account ?? unavailableAccount,
    });
  },

  buildCommandContext(
    env,
    owner,
    commandId,
    invocation,
    invocationId,
    projectId,
    source,
    depth,
    scope,
    workspace,
    navigationScope,
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
      navigationScope,
    );
    return {
      ...base,
      activity: env.activityForInvocation?.(source) ?? base.activity,
      stream: { write: async () => {} },
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
      source,
    };
  },
});
