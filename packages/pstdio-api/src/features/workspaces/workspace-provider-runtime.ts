import type { ExtensionContextBase, WorkspaceTypeProvider } from "pstdio-api-contracts/extension-kernel";
import { createCommandRunner } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { createCommandEnvironment } from "../extensions/command-environment";
import type { WorkspacesRouteDeps } from "./deps";

export interface WorkspaceProviderHandle {
  context: ExtensionContextBase;
  provider: WorkspaceTypeProvider;
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
    const record = snapshot.runtime.workspaceTypes.find((candidate) => candidate.id === input.providerId);
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
          repo: environmentInput.repo,
          settings: snapshot.runtime.settings,
          workspaceDir: environmentInput.workspaceDir,
          workspaceId: environmentInput.workspaceId,
        }),
    });
    const context = await runner.buildExtensionContext({
      projectId: input.projectId,
      extensionId: record.extensionId,
      name: record.name,
      workspaceDir: input.workspaceDir,
      workspaceId: input.workspaceId,
    });
    return { context, provider: record.provider };
  },
};

export const findWorkspaceProvider = (
  deps: WorkspacesRouteDeps,
  input: Parameters<WorkspaceProviderRuntime["find"]>[1],
) => (deps.workspaceProviderRuntime ?? defaultWorkspaceProviderRuntime).find(deps, input);

const PROVIDER_OPERATION_TIMEOUT_MS = 30_000;

export const runWorkspaceProviderCall = async <T>(
  call: () => Promise<T> | T,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) => {
  if (options.signal?.aborted) throw new Error("Workspace provider operation aborted.");

  const timeoutMs = options.timeoutMs ?? PROVIDER_OPERATION_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let removeAbortListener = () => {};
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Workspace provider operation timed out after ${timeoutMs}ms.`)),
      timeoutMs,
    );
  });
  const abortPromise = new Promise<never>((_resolve, reject) => {
    const signal = options.signal;
    if (!signal) return;
    const onAbort = () => reject(new Error("Workspace provider operation aborted."));
    signal.addEventListener("abort", onAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", onAbort);
  });

  try {
    return await Promise.race([Promise.resolve().then(call), timeoutPromise, abortPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
    removeAbortListener();
  }
};
