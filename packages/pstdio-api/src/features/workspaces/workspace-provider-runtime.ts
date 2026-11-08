import type {
  ExtensionContextBase,
  ParamObjectSchema,
  WorkspaceTypeProvider,
} from "pstdio-api-contracts/extension-kernel";
import {
  createCommandRunner,
  createInvocationScope,
  type ExtensionRuntime,
  type InvocationScope,
  normalizeParamOptions,
} from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { createCommandEnvironment } from "../extensions/command-environment";
import type { WorkspacesRouteDeps } from "./deps";
import { createWorkspaceProviderDirectory } from "./workspace-provider-directory";
import { createWorkspaceProviderProcess } from "./workspace-provider-process";
import { runtimeProviderId } from "./workspace-provider-identity";

export interface WorkspaceProviderHandle {
  context: ExtensionContextBase;
  provider: WorkspaceTypeProvider;
  contextForScope?(scope: InvocationScope): Promise<ExtensionContextBase>;
  normalizeParams?(schema: ParamObjectSchema): ParamObjectSchema;
}

export interface WorkspaceProviderRuntime {
  find(
    deps: WorkspacesRouteDeps,
    input: { projectId: string; providerId: string; workspaceId?: string; workspaceDir?: string },
  ): Promise<WorkspaceProviderHandle | undefined>;
}

const providerLogger = {
  info: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.info({ event: "workspace.provider.log", metadata: metadata ?? {} }, message),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.warn({ event: "workspace.provider.log", metadata: metadata ?? {} }, message),
  error: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.error({ event: "workspace.provider.log", metadata: metadata ?? {} }, message),
};

export const defaultWorkspaceProviderRuntime: WorkspaceProviderRuntime = {
  async find(deps, input) {
    const snapshot = await deps.extensionRuntimeCatalog.get(input.projectId);
    const record = snapshot.runtime.workspaceTypes.find((candidate) => candidate.id === runtimeProviderId(input.providerId));
    if (!record) return undefined;

    const runner = createCommandRunner(snapshot.runtime, {
      logger: providerLogger,
      buildEnvironment: (environmentInput) =>
        createCommandEnvironment(deps, snapshot.enabledSources, {
          artifactMounts: snapshot.runtime.artifactMounts,
          extensionId: environmentInput.extensionId,
          name: environmentInput.name,
          project: snapshot.project,
          projectId: environmentInput.projectId,
          settings: snapshot.runtime.settings,
          workspaceDir: environmentInput.workspaceDir,
          workspaceId: environmentInput.workspaceId,
        }),
    });
    const buildContext = async (scope?: InvocationScope) => {
      const context = await runner.buildExtensionContext(
        {
          projectId: input.projectId,
          extensionId: record.extensionId,
          name: record.name,
          workspaceDir: input.workspaceDir,
          workspaceId: input.workspaceId,
        },
        scope,
      );
      // Only the direct lifecycle callback can prepare an unavailable target.
      // Commands and hooks keep the runner's ordinary readiness checks.
      context.process = createWorkspaceProviderProcess(deps, input, scope);
      if (input.workspaceId)
        context.localDirectory = createWorkspaceProviderDirectory(
          deps,
          {
            projectId: input.projectId,
            providerId: input.providerId,
            workspaceId: input.workspaceId,
          },
          scope,
        );
      return context;
    };
    return {
      context: await buildContext(),
      contextForScope: buildContext,
      provider: record.provider,
      normalizeParams: (schema) => {
        const diagnostics: ExtensionRuntime["diagnostics"] = [];
        const params = normalizeParamOptions(schema, record, {
          commandIds: new Set(snapshot.runtime.commands.map((command) => command.id)),
          diagnostics,
        });
        if (diagnostics.length) throw new Error(diagnostics.map((item) => item.message).join("\n"));
        return params ?? {};
      },
    };
  },
};

export const findWorkspaceProvider = (
  deps: WorkspacesRouteDeps,
  input: Parameters<WorkspaceProviderRuntime["find"]>[1],
) => (deps.workspaceProviderRuntime ?? defaultWorkspaceProviderRuntime).find(deps, input);

const PROVIDER_OPERATION_TIMEOUT_MS = 30_000;

export const runWorkspaceProviderCall = async <T>(
  call: (signal: AbortSignal) => Promise<T> | T,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) => {
  if (options.signal?.aborted) throw new Error("Workspace provider operation aborted.");

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? PROVIDER_OPERATION_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let removeAbortListener = () => {};
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new Error(`Workspace provider operation timed out after ${timeoutMs}ms.`);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  const abortPromise = new Promise<never>((_resolve, reject) => {
    const signal = options.signal;
    if (!signal) return;
    const onAbort = () => {
      const error = new Error("Workspace provider operation aborted.");
      controller.abort(error);
      reject(error);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", onAbort);
  });

  try {
    return await Promise.race([Promise.resolve().then(() => call(controller.signal)), timeoutPromise, abortPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
    removeAbortListener();
  }
};

export const runWorkspaceProviderOperation = async <T>(
  handle: WorkspaceProviderHandle,
  call: (context: ExtensionContextBase, signal: AbortSignal) => Promise<T> | T,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    /** Cancel resources while still accepting a late create reference for cleanup. */
    resourceSignal?: AbortSignal;
  } = {},
) => {
  let scope: InvocationScope | undefined;
  try {
    return await runWorkspaceProviderCall(async (signal) => {
      scope = createInvocationScope({
        logger: providerLogger,
        parent: options.resourceSignal ? AbortSignal.any([signal, options.resourceSignal]) : signal,
      });
      const context = handle.contextForScope ? await handle.contextForScope(scope) : handle.context;
      return call(context, scope.signal);
    }, options);
  } finally {
    await scope?.close();
  }
};
