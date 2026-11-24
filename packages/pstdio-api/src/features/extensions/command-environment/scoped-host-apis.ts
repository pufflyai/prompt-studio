import type {
  ExtensionConnectionsApi,
  ExtensionProjectContext,
  ExtensionTerminalApi,
  TerminalSessionRequest,
} from "pstdio-api-contracts/extension-kernel";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import type { InvocationScope, ProcessOwner, ScopedHostApis } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { createProcessApi } from "../extension-process-api";
import { resolveProcessTarget } from "../extension-targets";
import type { ProcessEnvironmentSource } from "../process-environment/permissions";
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
    extensionId: string;
    projectId: string;
    workspaceId?: string;
    eventId?: string;
    /** The installed source generation this invocation runs. Host environment grants are checked against it. */
    source: ProcessEnvironmentSource;
    extensionOwner: () => ProcessOwner;
  },
  hosts: { connections: ExtensionConnectionsApi; terminal?: ExtensionTerminalApi },
  runtimeDeps: CommandEnvironmentRuntimeDeps,
  scope?: InvocationScope,
): Pick<ScopedHostApis, "sessions" | "workspaces" | "connections" | "process" | "terminal"> => {
  const signal = scope?.signal;
  const resolveCwd = async () => {
    if (signal?.aborted) throw signal.reason;
    const location = await resolveLocalWorkspaceTarget(
      deps,
      {
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        provisioningWorkspaceId: input.eventId === workspaceEvents.provision.id ? input.workspaceId : undefined,
        eventId: input.eventId,
      },
      "process",
    );
    if (signal?.aborted) throw signal.reason;
    return location.root;
  };
  const target = {
    projectId: input.projectId,
    provisioningWorkspaceId: input.eventId === workspaceEvents.provision.id ? input.workspaceId : undefined,
    eventId: input.eventId,
  };
  // Cancellation belongs to the spawn: a child with extension lifetime outlives its invocation.
  const resolveTarget = (workspaceId: string | undefined, spawnSignal: AbortSignal) =>
    resolveProcessTarget(deps, { ...target, workspaceId: workspaceId ?? input.workspaceId }, spawnSignal);
  const terminal = hosts.terminal && resolveCwd ? createWorkspaceTerminal(hosts.terminal, resolveCwd) : hosts.terminal;

  return {
    sessions: createSessionsApi(deps, { projectId: input.projectId, project: input.project, signal, scope }),
    workspaces: createWorkspacesApi(deps, { projectId: input.projectId, signal }, runtimeDeps),
    connections: signal ? withConnectionSignal(hosts.connections, signal) : hosts.connections,
    process: createProcessApi({
      scope,
      resolveCwd,
      resolveTarget,
      extensionOwner: input.extensionOwner,
      extensionId: input.extensionId,
      hostEnvironment: (names) => deps.extensionProcessEnvironment.authorize(input.projectId, input.source, names),
    }),
    terminal: scope && terminal ? withSessionOwnership(terminal, scope) : terminal,
  };
};
