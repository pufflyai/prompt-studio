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

export type ProcessTarget =
  | { kind: "local"; root: string }
  | { kind: "remote"; spawn(process: ProcessSpawnInput): Promise<ProcessHandle> };

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

// The provider's own context stays open until its child exits, so children the provider starts
// for it, such as a local ssh client, live exactly as long as the handle the caller holds.
const spawnThroughProvider = async (
  handle: WorkspaceProviderHandle & { provider: Required<WorkspaceTypeProvider> },
  workspace: Workspace,
  process: ProcessSpawnInput,
) => {
  const scope = createInvocationScope({ logger: providerLogger });
  try {
    const context = handle.contextForScope ? await handle.contextForScope(scope) : handle.context;
    const opened = await handle.provider.spawn(context, { ...providerInput(workspace), process });
    void Promise.resolve(opened.exited)
      .catch(() => {})
      .finally(() => scope.close());
    return opened;
  } catch (error) {
    await scope.close();
    throw error;
  }
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
export const resolveProcessTarget = async (deps: TargetDeps, input: WorkspaceTargetInput): Promise<ProcessTarget> => {
  const workspace = await selectWorkspace(deps, input, "process");
  if (workspace.execution_kind === "remote") {
    const provider = await findRemoteProvider(deps, workspace, "spawn", "process");
    if (!provider)
      throw processError(
        "process_target_unsupported",
        "This workspace runs on a remote target whose provider cannot start processes.",
      );
    return { kind: "remote", spawn: (process) => spawnThroughProvider(provider, workspace, process) };
  }
  return { kind: "local", root: await localTarget(deps, { ...input, workspaceId: workspace.id }, "process") };
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
  process(input: WorkspaceTargetInput): Promise<ProcessTarget>;
  readText(input: { projectId: string; workspaceId: string; path: string }): Promise<string>;
};

/** Target routing for contexts built before the app's dependencies exist, such as harness contexts. */
export const createExtensionTargets = (deps: () => TargetDeps): ExtensionTargets => ({
  process: (input) => resolveProcessTarget(deps(), input),
  readText: (input) => readTargetText(deps(), input),
});
