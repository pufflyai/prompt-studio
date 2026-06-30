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

// Any diagnostic from the AWAITED provision event is a provisioning failure: a clean
// sync emits none, and the dispatcher reports a thrown hook as a `warning` (hook_failed),
// so keying on severity === "error" would let a throwing skill-sync slip through and mark
// the workspace ready with a half-synced agent dir.
const firstProvisionFailure = (result: Awaited<ReturnType<typeof fireExtensionEvent>>) => result.diagnostics?.[0];

// The awaited dispatchers, injectable so the lifecycle can be unit-tested without
// standing up a full extension runtime; production uses the real ones.
export type WorkspaceProvisioningHooks = {
  fireProvision: typeof fireExtensionEvent;
  fireReadyAsync: typeof fireExtensionEventAsync;
  ensureConfig: typeof ensureWorkspaceConfig;
};

const defaultHooks: WorkspaceProvisioningHooks = {
  fireProvision: fireExtensionEvent,
  fireReadyAsync: fireExtensionEventAsync,
  ensureConfig: ensureWorkspaceConfig,
};

// Gate `initializing` around the awaited provision so no session can spawn while harness
// hooks prune and rewrite the agent skill dir — true on both creation and every catalog
// re-sync. Stamps the workspace id into the working dir's config first (uniform across
// worktree/root/cloud). On the first error diagnostic, records `setup_error` (which also
// clears `initializing`) and reports `ok:false`. On success, clear any recovered
// setup error through the same state transition.
// The workspace row carries a structurally-distinct `anchors_json` (db JsonObject vs
// contracts JsonObject), so we accept the row's own type `W` and only narrow it to
// ExtensionWorkspace inside the hook payload — hooks read generic fields.
// Run the awaited provision for a single repo path. Touches no workspace readiness state, so a
// caller spanning several repos can settle the shared row once instead of letting each repo's
// result overwrite the previous one's. Returns the first failure diagnostic, or null on a clean sync.
const provisionRepo = async <W extends { id: string }>(
  deps: ProvisionCoordinatorDeps,
  input: { projectId: string; workspace: W; repoPath: string },
  hooks: WorkspaceProvisioningHooks,
) => {
  const payload = buildProvisionPayload({
    projectId: input.projectId,
    workspace: input.workspace as unknown as ExtensionWorkspace,
    repoPath: input.repoPath,
  });
  await hooks.ensureConfig(payload.workspaceDir, input.repoPath, input.workspace.id);
  const result = await hooks.fireProvision(deps, input.projectId, workspaceEvents.provision, payload);
  return { payload, failure: firstProvisionFailure(result) };
};

const gatedProvision = async <W extends { id: string }>(
  deps: ProvisionCoordinatorDeps,
  input: { projectId: string; workspace: W; repoPath: string },
  hooks: WorkspaceProvisioningHooks,
) => {
  const { projectId, workspace, repoPath } = input;
  const initializing = ((await deps.workspaceService.setInitializing(workspace.id, true)) as W | null) ?? workspace;

  const { payload, failure } = await provisionRepo(deps, { projectId, workspace: initializing, repoPath }, hooks);

  if (failure) {
    const errored =
      ((await deps.workspaceService.setSetupError(workspace.id, failure.message)) as W | null) ?? initializing;
    return { workspace: errored, payload, ok: false as const };
  }

  const ready = ((await deps.workspaceService.setSetupError(workspace.id, null)) as W | null) ?? initializing;
  return { workspace: ready, payload, ok: true as const };
};

// Creation lifecycle used by both creation paths: gate provisioning, then fire the
// non-blocking `workspace.ready` event for background setup (bun install/build) once the
// tree is clean. Returns the resulting workspace row so callers can return it to the client.
export const runWorkspaceProvisioning = async <W extends { id: string }>(
  deps: ProvisionCoordinatorDeps,
  input: { projectId: string; workspace: W; repoPath: string },
  hooks: WorkspaceProvisioningHooks = defaultHooks,
) => {
  const { workspace, payload, ok } = await gatedProvision(deps, input, hooks);
  if (ok) hooks.fireReadyAsync(deps, input.projectId, workspaceEvents.ready, payload);
  return workspace;
};

// Re-sync one workspace across every repo path it spans and settle its readiness row once.
// Gates `initializing` for the whole sweep, keeps the FIRST failure (a thrown ensureConfig or
// dispatch counts), and writes the final state via `setSetupError` (which also clears
// `initializing`). A later repo's success therefore cannot clear an earlier repo's failure, and
// a thrown re-sync can never leave the row stuck provisioning.
const reprovisionWorkspace = async (
  deps: ProvisionCoordinatorDeps,
  input: { projectId: string; workspace: ExtensionWorkspace; repoPaths: string[] },
  hooks: WorkspaceProvisioningHooks,
) => {
  const { projectId, workspace, repoPaths } = input;
  await deps.workspaceService.setInitializing(workspace.id, true);

  let firstFailure: string | null = null;
  for (const repoPath of repoPaths) {
    try {
      const { failure } = await provisionRepo(deps, { projectId, workspace, repoPath }, hooks);
      if (failure && !firstFailure) firstFailure = failure.message;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!firstFailure) firstFailure = message;
      apiLogger.warn(
        { err, event: "workspace.provision_failed", project_id: projectId, workspace_id: workspace.id },
        "Workspace provisioning failed",
      );
    }
  }

  await deps.workspaceService.setSetupError(workspace.id, firstFailure);
};

// Re-sync every active workspace for a project. Used on catalog changes (skill
// edits, extension enable/disable, repo register) so installed agent dirs stay
// in lockstep with the catalog. Each re-sync is gated the same way as creation —
// a session started mid-sync would otherwise read a half-reconciled tree — but skips
// the `ready` re-fire, since background setup already ran when the workspace was created.
// Per-workspace failures are isolated (the bad one is marked `setup_error`), not thrown,
// so one workspace cannot block the rest of the re-sync.
export const provisionProjectWorkspaces = async (
  deps: ProvisionCoordinatorDeps,
  projectId: string,
  hooks: WorkspaceProvisioningHooks = defaultHooks,
) => {
  const [workspaces, repos] = await Promise.all([
    deps.workspaceService.list(projectId),
    deps.repoService.listByProject(projectId),
  ]);

  if (repos.length === 0) return;

  for (const workspace of workspaces) {
    // A root workspace can span every linked repo; a worktree workspace resolves to its own
    // worktree dir regardless of the repo passed, so provisioning it once is enough.
    const repoPaths = workspace.worktree_path ? [repos[0].path] : repos.map((repo) => repo.path);
    await reprovisionWorkspace(deps, { projectId, workspace: workspace as ExtensionWorkspace, repoPaths }, hooks);
  }
};
