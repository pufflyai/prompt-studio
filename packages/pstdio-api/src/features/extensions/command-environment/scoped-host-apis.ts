import type {
  ExtensionConnectionsApi,
  ExtensionProjectContext,
  ExtensionTerminalApi,
  RepoContext,
  TerminalSessionRequest,
} from "pstdio-api-contracts/extension-kernel";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import type { InvocationScope, ScopedHostApis } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { createProcessApi } from "../extension-process-api";
import { createSessionsApi } from "./sessions";
import type { CommandEnvironmentRuntimeDeps } from "./types";
import { resolveLocalWorkspaceTarget } from "./workspace-target";
import { createWorkspaceTerminal } from "./workspace-terminal";
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
  input: {
    project: ExtensionProjectContext;
    projectId: string;
    workspaceId?: string;
    eventId?: string;
    repo?: RepoContext;
  },
  hosts: { connections: ExtensionConnectionsApi; terminal?: ExtensionTerminalApi },
  runtimeDeps: CommandEnvironmentRuntimeDeps,
  scope?: InvocationScope,
): ScopedHostApis => {
  const signal = scope?.signal;
  const resolveCwd = input.workspaceId
    ? async () => {
        if (signal?.aborted) throw signal.reason;
        const location = await resolveLocalWorkspaceTarget(
          deps,
          {
            projectId: input.projectId,
            workspaceId: input.workspaceId,
            provisioningWorkspaceId: input.eventId === workspaceEvents.provision.id ? input.workspaceId : undefined,
            eventId: input.eventId,
            repo: input.repo,
          },
          "process",
        );
        if (signal?.aborted) throw signal.reason;
        return location.root;
      }
    : undefined;
  const terminal = hosts.terminal && resolveCwd ? createWorkspaceTerminal(hosts.terminal, resolveCwd) : hosts.terminal;

  return {
    sessions: createSessionsApi(deps, { projectId: input.projectId, project: input.project, signal }),
    workspaces: createWorkspacesApi(deps, { projectId: input.projectId, signal }, runtimeDeps),
    connections: signal ? withConnectionSignal(hosts.connections, signal) : hosts.connections,
    process: createProcessApi({ scope, resolveCwd }),
    terminal: scope && terminal ? withSessionOwnership(terminal, scope) : terminal,
  };
};
