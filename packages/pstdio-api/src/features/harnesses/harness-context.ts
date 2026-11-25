import type { ExtensionConnectionsApi } from "pstdio-api-contracts/extension-kernel";
import type { HarnessContextFactory } from "pstdio-api-runtime-host";
import { createInvocationScope, markHostContext, processError } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import {
  createProcessApi,
  findFreePort,
  hostStartedGrants,
  type ProcessApiOptions,
} from "../extensions/extension-process-api";
import type { ExtensionTargets } from "../extensions/extension-targets";
import type {
  ProcessEnvironmentPermissions,
  ProcessEnvironmentSource,
} from "../extensions/process-environment/permissions";
import { createHarnessStateApi } from "./harness-state";

const harnessLogger = (extensionId: string) => ({
  info: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.info({ ...metadata, extension_id: extensionId }, message),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.warn({ ...metadata, extension_id: extensionId }, message),
  error: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.error({ ...metadata, extension_id: extensionId }, message),
});

/**
 * Builds the context of one harness instance. Its process owner is the instance's: children with
 * extension lifetime end when the instance is disposed. The registry narrows `call` children to
 * each provider call.
 */
export const createHarnessContextFactory = (input: {
  connections: (projectId: string | undefined, extensionId: string) => ExtensionConnectionsApi;
  /** Routes session processes and target file reads to a workspace of the calling project. */
  targets?: ExtensionTargets;
  /** Host values the user allowed a harness extension in a project reach its processes. */
  processEnvironment?: Pick<ProcessEnvironmentPermissions, "grantedNames" | "authorize">;
  sourceForRecord?: (record: Parameters<HarnessContextFactory>[0]) => ProcessEnvironmentSource | undefined;
}): HarnessContextFactory => {
  // A workspace must belong to the project the call runs for; host-level calls have none.
  const projectOf = (projectId: string | undefined, code: "process_target_unavailable" | "target_file_unavailable") => {
    if (!projectId || !input.targets)
      throw processError(code, "Workspace targets are only available to harness calls for a project.");
    return { projectId, targets: input.targets };
  };
  // Marked so a process-mode harness reaches this context through its worker's allowlist.
  return (record, options, owner) => {
    const logger = harnessLogger(record.extensionId);
    // In-process run commands still belong to the instance, including sign-in work.
    const runs = createInvocationScope({ logger });
    owner.adopt({ exited: new Promise(() => {}), kill: () => runs.close() });
    const processOptions = {
      extensionId: record.extensionId,
      ...hostStartedGrants(input.processEnvironment, options?.projectId, input.sourceForRecord?.(record)),
      callOwner: owner,
      extensionOwner: () => owner,
      // Detection and model calls pass no workspace and run on this device.
      resolveTarget: async (workspaceId, signal) => {
        if (!workspaceId) return undefined;
        const { projectId, targets } = projectOf(options?.projectId, "process_target_unavailable");
        return targets.process({ projectId, workspaceId }, signal);
      },
    } satisfies ProcessApiOptions;
    const processApi = createProcessApi({ ...processOptions, scope: runs });
    return markHostContext(
      {
        projectId: options?.projectId,
        extensionId: record.extensionId,
        name: record.name,
        process: processApi,
        targetFiles: {
          readText: async ({ workspaceId, path }) => {
            const { projectId, targets } = projectOf(options?.projectId, "target_file_unavailable");
            return targets.readText({ projectId, workspaceId, path });
          },
        },
        net: { findFreePort: async (portInput) => findFreePort(portInput?.host) },
        connections: input.connections(options?.projectId, record.extensionId),
        logger,
        state: createHarnessStateApi(record.extensionId),
      },
      {
        logger,
        withScope: (scope) => ({
          // Streaming children follow the harness call or instance, which can outlive the worker invocation.
          process: { ...createProcessApi({ ...processOptions, scope }), spawn: processApi.spawn },
        }),
      },
    );
  };
};
