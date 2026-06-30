import type {
  ExtensionWorkspace,
  WorkspaceProvisionPayload,
  WorkspaceType,
} from "pstdio-api-contracts/extension-kernel";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import { apiLogger } from "../../lib/logger";
import {
  type ExtensionEventDeps,
  fireExtensionEvent,
  fireExtensionEventAsync,
} from "../extensions/extension-event-runtime";
import { ensureWorkspaceConfig } from "./workspace-config";

export type ProvisionCoordinatorDeps = ExtensionEventDeps;

const buildProvisionPayload = (input: {
  projectId: string;
  workspace: ExtensionWorkspace;
  repoPath: string;
}): WorkspaceProvisionPayload => {
  const { projectId, workspace, repoPath } = input;
  return {
    projectId,
    workspaceId: workspace.id,
    workspace,
    workspaceDir: resolveWorkspaceDir(workspace, repoPath),
    repoPath,
    branch: workspace.branch ?? undefined,
    type: workspaceType(workspace, repoPath),
  };
};

// A workspace with a worktree path runs inside that worktree; otherwise it runs
// in the repo root (the project's default "current branch" workspace).
export const resolveWorkspaceDir = (workspace: Pick<ExtensionWorkspace, "worktree_path">, repoPath: string) =>
  workspace.worktree_path ?? repoPath;

// A "current branch" / default workspace stores the repo root as its worktree_path,
// so a real worktree is one whose path differs from the repo root.
export const workspaceType = (workspace: Pick<ExtensionWorkspace, "worktree_path">, repoPath: string): WorkspaceType =>
  !workspace.worktree_path || workspace.worktree_path === repoPath ? "root" : "worktree";

// Awaited provisioning: harness extensions subscribe to `workspace.provision` and
// sync their agent dir into the working tree before sessions are allowed to spawn.
// Returns the delivery result so callers can inspect `.diagnostics` for errors.
export const provisionWorkspace = async (
  deps: ProvisionCoordinatorDeps,
  input: { projectId: string; workspace: ExtensionWorkspace; repoPath: string },
) => {
  const payload = buildProvisionPayload(input);
  return fireExtensionEvent(deps, input.projectId, workspaceEvents.provision, payload);
};

// Any diagnostic from the AWAITED provision event is a provisioning failure: a clean
// sync emits none, and the dispatcher reports a thrown hook as a `warning` (hook_failed),
// so keying on severity === "error" would let a throwing skill-sync slip through and mark
// the workspace ready with a half-synced agent dir.
const firstProvisionFailure = (result: Awaited<ReturnType<typeof fireExtensionEvent>>) => result.diagnostics?.[0];

// Drives the awaited workspace lifecycle used by both creation paths: gate
// `initializing` around provisioning, stop on the first error diagnostic, then
// fire the non-blocking `workspace.ready` event for background setup. Returns
// the resulting workspace row so callers can return it to the client.
// The workspace row carries a structurally-distinct `anchors_json` (db JsonObject
// vs contracts JsonObject), so we accept the row's own type `W` and only narrow
// it to ExtensionWorkspace inside the hook payload — hooks read generic fields.
// `fire` is injectable so the awaited lifecycle can be unit-tested without
// standing up a full extension runtime; production uses the real dispatchers.
export type WorkspaceProvisioningHooks = {
  fireProvision: typeof fireExtensionEvent;
  fireReadyAsync: typeof fireExtensionEventAsync;
  ensureConfig: typeof ensureWorkspaceConfig;
};

export const runWorkspaceProvisioning = async <W extends { id: string }>(
  deps: ProvisionCoordinatorDeps,
  input: { projectId: string; workspace: W; repoPath: string },
  hooks: WorkspaceProvisioningHooks = {
    fireProvision: fireExtensionEvent,
    fireReadyAsync: fireExtensionEventAsync,
    ensureConfig: ensureWorkspaceConfig,
  },
) => {
  const { projectId, workspace, repoPath } = input;
  const initializing = ((await deps.workspaceService.setInitializing(workspace.id, true)) as W | null) ?? workspace;

  const payload = buildProvisionPayload({
    projectId,
    workspace: initializing as unknown as ExtensionWorkspace,
    repoPath,
  });
  // Stamp the workspace id into the working dir's config for every workspace type before
  // harness hooks run, so worktree/root/cloud are handled uniformly here, not per type.
  await hooks.ensureConfig(payload.workspaceDir, repoPath, workspace.id);
  const result = await hooks.fireProvision(deps, projectId, workspaceEvents.provision, payload);

  const failure = firstProvisionFailure(result);
  if (failure) {
    return ((await deps.workspaceService.setSetupError(workspace.id, failure.message)) as W | null) ?? initializing;
  }

  const ready = ((await deps.workspaceService.setInitializing(workspace.id, false)) as W | null) ?? initializing;
  hooks.fireReadyAsync(deps, projectId, workspaceEvents.ready, payload);
  return ready;
};

// Re-sync every active workspace for a project. Used on catalog changes (skill
// edits, extension enable/disable, repo register) so installed agent dirs stay
// in lockstep with the catalog. Per-workspace failures are logged, not thrown,
// so one bad workspace cannot block the rest of the re-sync.
export const provisionProjectWorkspaces = async (deps: ProvisionCoordinatorDeps, projectId: string) => {
  const [workspaces, repos] = await Promise.all([
    deps.workspaceService.list(projectId),
    deps.repoService.listByProject(projectId),
  ]);

  if (repos.length === 0) return;

  for (const workspace of workspaces) {
    // A root workspace can span every linked repo; a worktree workspace resolves to its own
    // worktree dir regardless of the repo passed, so provisioning it once is enough.
    const repoPaths = workspace.worktree_path ? [repos[0].path] : repos.map((repo) => repo.path);

    for (const repoPath of repoPaths) {
      try {
        await provisionWorkspace(deps, { projectId, workspace: workspace as ExtensionWorkspace, repoPath });
      } catch (err) {
        apiLogger.warn(
          { err, event: "workspace.provision_failed", project_id: projectId, workspace_id: workspace.id },
          "Workspace provisioning failed",
        );
      }
    }
  }
};
