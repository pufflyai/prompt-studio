import type {
  ExtensionConnectionsApi,
  ExtensionProjectContext,
  ExtensionTerminalApi,
  TerminalSessionRequest,
} from "pstdio-api-contracts/extension-kernel";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import type { InvocationScope, ScopedHostApis } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { createProcessApi } from "../extension-process-api";
import { createSessionsApi } from "./sessions";
import type { CommandEnvironmentRuntimeDeps } from "./types";
import { createWorkspacesApi } from "./workspaces";

const withConnectionSignal = (connections: ExtensionConnectionsApi, signal: AbortSignal): ExtensionConnectionsApi => ({
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

// Every session an invocation opens is killed when that invocation ends. The app-scoped
// supervisor stays the shutdown backstop for sessions the workbench surface owns.
const withSessionOwnership = (terminal: ExtensionTerminalApi, scope: InvocationScope): ExtensionTerminalApi => ({
  openSession: (request: TerminalSessionRequest) => {
    const session = terminal.openSession(request);
    scope.register(() => session.kill());
    return session;
  },
});

export const createScopedHostApis = (
  deps: ExtensionsRouteDeps,
  input: { project: ExtensionProjectContext; projectId: string; workspaceId?: string; eventId?: string },
  hosts: { connections: ExtensionConnectionsApi; terminal?: ExtensionTerminalApi },
  runtimeDeps: CommandEnvironmentRuntimeDeps,
  scope?: InvocationScope,
): ScopedHostApis => {
  const signal = scope?.signal;

  return {
    sessions: createSessionsApi(deps, { projectId: input.projectId, project: input.project, signal }),
    workspaces: createWorkspacesApi(deps, { projectId: input.projectId, signal }, runtimeDeps),
    connections: signal ? withConnectionSignal(hosts.connections, signal) : hosts.connections,
    process: createProcessApi({
      scope,
      resolveCwd: async () => {
        const workspace = input.workspaceId
          ? await deps.workspaceService.get(input.workspaceId)
          : await deps.workspaceService.getDefault(input.projectId);
        const provisioning = input.eventId === workspaceEvents.provision.id && workspace?.id === input.workspaceId;
        if (
          workspace?.deleted_at ||
          workspace?.provider_state !== "ready" ||
          (!provisioning && (workspace?.initializing || workspace?.setup_error))
        )
          throw new Error("This workspace has no ready local process target.");
        if (workspace?.project_id !== input.projectId || workspace.execution_kind !== "local" || !workspace.root_path)
          throw new Error("This workspace has no local process target.");
        return workspace.root_path;
      },
    }),
    terminal: scope && hosts.terminal ? withSessionOwnership(hosts.terminal, scope) : hosts.terminal,
  };
};
