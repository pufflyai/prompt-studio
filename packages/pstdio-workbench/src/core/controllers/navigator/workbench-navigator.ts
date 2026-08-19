import type { WorkbenchModeContribution, WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import type { ResourceRef } from "../../registries/resources/resource-registry";

export type WorkbenchNavigationDiagnosticCode =
  | "navigation_mode_missing"
  | "navigation_resource_missing"
  | "navigation_resource_incompatible"
  | "navigation_default_missing"
  | "navigation_target_stale";

export interface WorkbenchNavigationTarget {
  modeId?: string;
  resource?: ResourceRef;
  replaceActive?: boolean;
}

export type WorkbenchNavigationResult =
  | { ok: true; modeId: string | undefined; resource: ResourceRef | undefined }
  | { ok: false; code: WorkbenchNavigationDiagnosticCode; message: string };

export interface WorkbenchNavigationCommit {
  modeId: string | undefined;
  resource: ResourceRef | undefined;
  replaceActive: boolean;
}

// Host hooks let the application own selection bookkeeping and persistence-scope
// naming while the navigator owns ordering and validation. Every hook runs inside
// one commit; observers never see an intermediate mode-resource pair.
export interface WorkbenchNavigatorHostHooks {
  getProjectId?(): string | undefined;
  // The host's currently selected resource; defaults to the workbench primary.
  getSelectedResource?(): ResourceRef | undefined;
  // Maps a host pseudo-resource (for example a dashboard collection view) to the
  // effective selected resource; returning undefined selects an aggregate context.
  interpretSelection?(resource: ResourceRef): ResourceRef | undefined;
  // Applies the selected resource to host state (context keys, selection stores).
  applySelection?(resource: ResourceRef | undefined): void;
  // Rotates panel and layout persistence scopes for the committed context.
  applyScope?(commit: WorkbenchNavigationCommit): void;
  // Applies breadcrumbs for the committed context.
  applyBreadcrumb?(resource: ResourceRef | undefined): void;
  // Presents the committed resource (opens its primary location).
  presentResource?(resource: ResourceRef, input: { replaceActive: boolean }): Promise<unknown> | unknown;
}

export interface WorkbenchNavigatorCommitInput {
  modeId?: string;
  // `null` clears the selected resource; `undefined` keeps a compatible current one.
  resource?: ResourceRef | null;
  replaceActive?: boolean;
  // Skips presenting the resource; used when the caller opens the location itself.
  present?: boolean;
}

export interface WorkbenchNavigator {
  configure(hooks: WorkbenchNavigatorHostHooks): void;
  // Resolves fallbacks (last or default resource) and commits atomically.
  open(target: WorkbenchNavigationTarget): Promise<WorkbenchNavigationResult>;
  // Commits an already-resolved pair synchronously. A failed target changes nothing.
  commitContext(input: WorkbenchNavigatorCommitInput): WorkbenchNavigationResult;
  getLastResource(projectId: string | undefined, modeId: string): ResourceRef | undefined;
  // Clears per-mode last-resource records for a deleted resource.
  forgetResource(uri: string): void;
  onDidCommit(listener: (commit: WorkbenchNavigationCommit) => void): { dispose(): void };
}

export interface CreateWorkbenchNavigatorInput {
  modes: WorkbenchModeRegistry;
  getSelectedResource(): ResourceRef | undefined;
}

// A mode without declared kinds keeps the legacy accept-anything behavior until
// PS-270 migrates every mode to explicit kinds. Declared kinds are enforced.
const modeAccepts = (mode: WorkbenchModeContribution, resource: ResourceRef | undefined) => {
  if (!resource) return true;
  if (!mode.resourceKinds) return true;
  return mode.resourceKinds.includes(resource.kind);
};

const lastResourceKey = (projectId: string | undefined, modeId: string) => `${projectId ?? "none"}\0${modeId}`;

export const createWorkbenchNavigator = (input: CreateWorkbenchNavigatorInput): WorkbenchNavigator => {
  let hooks: WorkbenchNavigatorHostHooks = {};
  const lastResources = new Map<string, ResourceRef>();
  const listeners = new Set<(commit: WorkbenchNavigationCommit) => void>();

  const recordLastResource = (modeId: string | undefined, resource: ResourceRef | undefined) => {
    if (!modeId || !resource) return;
    lastResources.set(lastResourceKey(hooks.getProjectId?.(), modeId), resource);
  };

  const getSelectedResource = () => hooks.getSelectedResource?.() ?? input.getSelectedResource();

  const commitContext = (commit: WorkbenchNavigatorCommitInput): WorkbenchNavigationResult => {
    const activeModeId = input.modes.getActiveModeId();
    const targetModeId = commit.modeId ?? activeModeId;
    const mode = targetModeId ? input.modes.getMode(targetModeId) : undefined;
    if (targetModeId && !mode) {
      return { ok: false, code: "navigation_mode_missing", message: `Workbench mode not registered: ${targetModeId}` };
    }

    const requestedRaw = commit.resource === null ? undefined : commit.resource;
    const requestedEffective = requestedRaw ? (hooks.interpretSelection?.(requestedRaw) ?? requestedRaw) : undefined;
    // Validation happens before any state changes: a failed target changes nothing.
    if (requestedEffective && mode && !modeAccepts(mode, requestedEffective)) {
      return {
        ok: false,
        code: "navigation_resource_incompatible",
        message: `Mode "${targetModeId}" does not accept resource kind "${requestedEffective.kind}"`,
      };
    }
    const kept = commit.resource === undefined ? getSelectedResource() : undefined;
    const resource = requestedEffective ?? (mode && kept && modeAccepts(mode, kept) ? kept : undefined);

    const resolved: WorkbenchNavigationCommit = {
      modeId: targetModeId,
      resource,
      replaceActive: commit.replaceActive ?? false,
    };

    // Commit order: selection, mode (seed deferred), scope rotation (exactly once),
    // reconciliation, breadcrumb. Observers of the final notification see one
    // committed pair, never an intermediate combination.
    hooks.applySelection?.(commit.resource === undefined ? resource : (commit.resource ?? undefined));
    if (targetModeId !== activeModeId) {
      input.modes.setActiveMode(targetModeId, { deferSeed: true });
    }
    hooks.applyScope?.(resolved);
    if (targetModeId !== activeModeId) input.modes.seedActiveMode();
    hooks.applyBreadcrumb?.(resource);
    recordLastResource(targetModeId, resource);
    for (const listener of listeners) listener(resolved);
    return { ok: true, modeId: resolved.modeId, resource: resolved.resource };
  };

  const resolveDefaultResource = async (mode: WorkbenchModeContribution) => {
    if (!mode.defaultResource) return undefined;
    if (typeof mode.defaultResource === "function") return await mode.defaultResource();
    return mode.defaultResource;
  };

  const open = async (target: WorkbenchNavigationTarget): Promise<WorkbenchNavigationResult> => {
    const activeModeId = input.modes.getActiveModeId();
    const targetModeId = target.modeId ?? activeModeId;
    const mode = targetModeId ? input.modes.getMode(targetModeId) : undefined;
    if (targetModeId && !mode) {
      return { ok: false, code: "navigation_mode_missing", message: `Workbench mode not registered: ${targetModeId}` };
    }

    // Resource-only targets keep the mode and fail on incompatible kinds.
    if (target.resource) {
      if (mode && !modeAccepts(mode, target.resource)) {
        return {
          ok: false,
          code: "navigation_resource_incompatible",
          message: `Mode "${targetModeId}" does not accept resource kind "${target.resource.kind}"`,
        };
      }
      const result = commitContext({
        modeId: target.modeId,
        resource: target.resource,
        replaceActive: target.replaceActive,
      });
      if (result.ok && hooks.presentResource) {
        try {
          await hooks.presentResource(target.resource, { replaceActive: target.replaceActive ?? false });
        } catch (error) {
          return {
            ok: false,
            code: "navigation_resource_missing",
            message: error instanceof Error ? error.message : `Resource cannot be presented: ${target.resource.uri}`,
          };
        }
      }
      return result;
    }

    // Mode-only targets keep a compatible resource, otherwise restore the mode's
    // last compatible resource, otherwise its default resource.
    if (!mode || !targetModeId) {
      return commitContext({ modeId: target.modeId, replaceActive: target.replaceActive });
    }
    const current = getSelectedResource();
    if (current && modeAccepts(mode, current)) {
      return commitContext({ modeId: target.modeId, replaceActive: target.replaceActive });
    }
    const last = lastResources.get(lastResourceKey(hooks.getProjectId?.(), targetModeId));
    const fallback = last && modeAccepts(mode, last) ? last : await resolveDefaultResource(mode);
    if (fallback && modeAccepts(mode, fallback)) {
      const result = commitContext({
        modeId: target.modeId,
        resource: fallback,
        replaceActive: target.replaceActive,
      });
      if (result.ok && hooks.presentResource) {
        try {
          await hooks.presentResource(fallback, { replaceActive: target.replaceActive ?? false });
        } catch {
          // The stored fallback disappeared; commit the mode with a cleared context.
          lastResources.delete(lastResourceKey(hooks.getProjectId?.(), targetModeId));
          return commitContext({ modeId: target.modeId, resource: null, replaceActive: target.replaceActive });
        }
      }
      return result;
    }
    if ((mode.resourceKinds ?? []).length > 0 && mode.defaultResource) {
      return {
        ok: false,
        code: "navigation_default_missing",
        message: `Mode "${targetModeId}" has no valid default resource`,
      };
    }
    return commitContext({ modeId: target.modeId, resource: null, replaceActive: target.replaceActive });
  };

  return {
    configure(nextHooks) {
      hooks = nextHooks;
    },
    open,
    commitContext,
    getLastResource: (projectId, modeId) => lastResources.get(lastResourceKey(projectId, modeId)),
    forgetResource(uri) {
      for (const [key, resource] of lastResources) {
        if (resource.uri === uri) lastResources.delete(key);
      }
    },
    onDidCommit(listener) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
};
