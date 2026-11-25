import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type {
  ProcessHandle,
  ProcessSpawnInput,
  WorkspaceProviderRef,
  WorkspaceTypeProvider,
} from "pstdio-api-contracts/extension-kernel";
import { createInvocationScope, processError } from "pstdio-extensions";
import type { WorkspacesRouteDeps } from "../workspaces/deps";
import {
  findWorkspaceProvider,
  providerLogger,
  runWorkspaceProviderOperation,
  type WorkspaceProviderHandle,
} from "../workspaces/workspace-provider-runtime";
import { resolveLocalWorkspaceTarget, type WorkspaceTargetInput } from "./command-environment/workspace-target";
import { exitedWithin, PROCESS_STOP_TIMEOUT_MS } from "./process-group";

export type ProcessTarget =
  | { kind: "local"; root: string }
  | { kind: "remote"; spawn(process: ProcessSpawnInput, signal?: AbortSignal): Promise<ProcessHandle> };

type TargetDeps = WorkspacesRouteDeps;
type Kind = "process" | "file";

const unavailable = (kind: Kind, message: string, cause?: unknown) =>
  processError(kind === "process" ? "process_target_unavailable" : "target_file_unavailable", message, cause);

// Routing follows the host's own record of the workspace, never a path or cwd the caller passes.
const selectWorkspace = async (deps: TargetDeps, input: WorkspaceTargetInput, kind: Kind) => {
  const workspace = input.workspaceId
    ? await deps.workspaceService.get(input.workspaceId)
    : await deps.workspaceService.getDefault(input.projectId);
  if (!workspace || workspace.deleted_at)
    throw unavailable(kind, `Workspace not found: ${input.workspaceId ?? "project default"}.`);
  if (workspace.project_id !== input.projectId)
    throw unavailable(kind, "The workspace belongs to another project. Use a workspace of this project.");
  return workspace;
};

type Workspace = Awaited<ReturnType<typeof selectWorkspace>>;

const findRemoteProvider = async (deps: TargetDeps, workspace: Workspace, method: "spawn" | "readText", kind: Kind) => {
  if (workspace.provider_state !== "ready") throw unavailable(kind, "The remote workspace is not ready.");
  const handle = await findWorkspaceProvider(deps, {
    projectId: workspace.project_id,
    providerId: workspace.provider_id,
    workspaceId: workspace.id,
  });
  return handle?.provider[method]
    ? (handle as WorkspaceProviderHandle & { provider: Required<WorkspaceTypeProvider> })
    : undefined;
};

const providerInput = (workspace: Workspace) => ({
  projectId: workspace.project_id,
  workspaceId: workspace.id,
  providerRef: workspace.provider_ref_json as unknown as WorkspaceProviderRef,
});

// The process proxy can stop waiting without discarding a handle a provider returns later.
// The provider's scope closes on cancellation or confirmed process cleanup.
const spawnThroughProvider = (
  handle: WorkspaceProviderHandle & { provider: Required<WorkspaceTypeProvider> },
  workspace: Workspace,
  process: ProcessSpawnInput,
  signal?: AbortSignal,
) => {
  const scope = createInvocationScope({ logger: providerLogger, parent: signal });
  const pending = (async () => {
    const context = handle.contextForScope ? await handle.contextForScope(scope) : handle.context;
    scope.signal.throwIfAborted();
    return handle.provider.spawn(context, { ...providerInput(workspace), process, signal: scope.signal });
  })();
  return pending.then(
    (opened) => {
      // Some providers report the direct child's exit while their descendants can still be stopped.
      // Keep their scope available until an explicit stop or the provider confirms the entire tree.
      const done = Promise.withResolvers<void>();
      let confirmed = false;
      const completed = () => {
        if (confirmed) return;
        confirmed = true;
        done.resolve();
        void scope.close();
      };
      void opened.treeExited?.then(completed, () => {});
      return {
        id: opened.id,
        started: opened.started,
        exited: opened.exited,
        treeExited: done.promise,
        write: opened.write.bind(opened),
        end: opened.end.bind(opened),
        events: opened.events.bind(opened),
        async kill(signal) {
          if (confirmed) return;
          // A timeout limits what teardown waits for. The provider can still acknowledge this
          // attempt later, and a later retry uses the same handle.
          const stop = Promise.resolve()
            .then(() => opened.kill(signal))
            .then(completed);
          if (!(await exitedWithin(Promise.race([stop, done.promise]), PROCESS_STOP_TIMEOUT_MS)))
            throw new Error("The remote process did not confirm cleanup within 5 seconds. Retry stopping it.");
        },
      } satisfies ProcessHandle;
    },
    (error: unknown) => {
      void scope.close();
      throw error;
    },
  );
};

const localTarget = async (deps: TargetDeps, input: WorkspaceTargetInput, kind: Kind) => {
  try {
    return (await resolveLocalWorkspaceTarget(deps, input, kind)).root;
  } catch (error) {
    if ((error as { code?: string }).code) throw error;
    throw unavailable(kind, error instanceof Error ? error.message : String(error), error);
  }
};

/** Resolves where a child runs: a ready local workspace root, or a remote provider that can spawn. */
export const resolveProcessTarget = async (deps: TargetDeps, input: WorkspaceTargetInput, signal?: AbortSignal) => {
  const workspace = await selectWorkspace(deps, input, "process");
  if (workspace.execution_kind === "remote") {
    const provider = await findRemoteProvider(deps, workspace, "spawn", "process");
    if (!provider)
      throw processError(
        "process_target_unsupported",
        "This workspace runs on a remote target whose provider cannot start processes.",
      );
    return {
      kind: "remote",
      spawn: (process: ProcessSpawnInput, spawnSignal?: AbortSignal) =>
        spawnThroughProvider(provider, workspace, process, spawnSignal ?? signal),
    } satisfies ProcessTarget;
  }
  const root = await localTarget(deps, { ...input, workspaceId: workspace.id }, "process");
  return { kind: "local", root } satisfies ProcessTarget;
};

// `~` belongs to the target. For a local workspace that is this device's home.
const localPath = (root: string, path: string) => {
  if (path === "~" || path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(1));
  return resolve(root, path);
};

/** Reads a UTF-8 text file on a workspace's target. A remote target without support never falls back to this device. */
export const readTargetText = async (
  deps: TargetDeps,
  input: { projectId: string; workspaceId: string; path: string },
) => {
  const workspace = await selectWorkspace(deps, input, "file");
  if (workspace.execution_kind === "remote") {
    const provider = await findRemoteProvider(deps, workspace, "readText", "file");
    if (!provider)
      throw processError(
        "target_file_unsupported",
        "This workspace runs on a remote target whose provider cannot read files. Its history is not available here.",
      );
    return runWorkspaceProviderOperation(provider, (context) =>
      provider.provider.readText(context, { ...providerInput(workspace), path: input.path }),
    );
  }
  const root = await localTarget(deps, input, "file");
  return new TextDecoder("utf-8", { fatal: true }).decode(await readFile(localPath(root, input.path)));
};

export type ExtensionTargets = {
  process(input: WorkspaceTargetInput, signal?: AbortSignal): Promise<ProcessTarget>;
  readText(input: { projectId: string; workspaceId: string; path: string }): Promise<string>;
};

/** Target routing for contexts built before the app's dependencies exist, such as harness contexts. */
export const createExtensionTargets = (deps: () => TargetDeps): ExtensionTargets => ({
  process: (input, signal) => resolveProcessTarget(deps(), input, signal),
  readText: (input) => readTargetText(deps(), input),
});
