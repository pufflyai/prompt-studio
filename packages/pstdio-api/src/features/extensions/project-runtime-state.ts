import type { ProjectExtensionRuntimeSnapshot, RuntimeInvalidationReason } from "./project-extension-runtime-snapshot";

export type ProjectState = {
  /** Bumped on every invalidation; a read waits for a snapshot loaded at its starting revision or later. */
  revision: number;
  /** Bumped by invalidations that can change contributions; a load may publish only if it still matches. */
  contributionRevision: number;
  /** Revision the current snapshot was built from; differing from revision means dirty. */
  loadedRevision: number;
  dirtyReason: RuntimeInvalidationReason | null;
  current: ProjectExtensionRuntimeSnapshot | null;
  /** Last healthy snapshot re-published with a stale marker after a whole-load failure. */
  staleView: ProjectExtensionRuntimeSnapshot | null;
  loading: Promise<ProjectExtensionRuntimeSnapshot> | null;
  /** Source paths from the last read of enabled sources; drives reverse lookup. */
  knownSourcePaths: Set<string>;
  loadCount: number;
};

const createProjectState = (): ProjectState => ({
  revision: 0,
  contributionRevision: 0,
  loadedRevision: -1,
  dirtyReason: null,
  current: null,
  staleView: null,
  loading: null,
  knownSourcePaths: new Set(),
  loadCount: 0,
});

export const markDirty = (state: ProjectState, reason: RuntimeInvalidationReason) => {
  state.revision += 1;
  // A webview build only refreshes later reads: the load in flight still serves the reads that
  // started before the build, and the next read loads again and rechecks the source.
  if (reason !== "webviews_built") state.contributionRevision += 1;
  state.dirtyReason = reason;
};

export const projectRuntimeState = (states: Map<string, ProjectState>, projectId: string) => {
  const existing = states.get(projectId);
  if (existing) return existing;
  const created = createProjectState();
  states.set(projectId, created);
  return created;
};
