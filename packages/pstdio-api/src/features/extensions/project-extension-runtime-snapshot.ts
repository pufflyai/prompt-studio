import type { ExtensionRuntime } from "pstdio-extensions";
import type { createExtensionService } from "../../services/extension-service";
import { ProjectNotFoundError } from "../../services/extension-service";

export type EnabledExtensionSource = Awaited<
  ReturnType<ReturnType<typeof createExtensionService>["listEnabledSourcesForProject"]>
>[number];

export type RuntimeInvalidationReason =
  | "source_changed"
  | "webviews_built"
  | "enablement_changed"
  | "repo_link_changed"
  | "runtime_refresh";

// Set on a retained last-healthy snapshot when a replacement load failed as a whole.
type SnapshotStaleMarker = {
  code: "extension_runtime_load_failed";
  message: string;
};

export type ProjectExtensionRuntimeSnapshot = {
  /** Process-wide monotonic counter; increases only when a snapshot publishes. */
  generation: number;
  project: { id: string; name: string; shorthand: string };
  enabledSources: EnabledExtensionSource[];
  runtime: ExtensionRuntime;
  stale: SnapshotStaleMarker | null;
};

// Freezes only the levels the catalog itself creates. Nested loader and DB
// records stay untouched so their owners keep their own mutation rules.
export const freezeSnapshot = (snapshot: ProjectExtensionRuntimeSnapshot) => {
  Object.freeze(snapshot.project);
  Object.freeze(snapshot.enabledSources);
  Object.freeze(snapshot.runtime);
  if (snapshot.stale) Object.freeze(snapshot.stale);
  return Object.freeze(snapshot);
};

// Extends ProjectNotFoundError so existing route handlers keep mapping the
// missing-project case to a 404 without knowing about the catalog.
export class ExtensionRuntimeProjectMissingError extends ProjectNotFoundError {
  code = "extension_runtime_project_missing" as const;

  constructor(projectId: string) {
    super(projectId);
    this.name = "ExtensionRuntimeProjectMissingError";
  }
}

export class ExtensionRuntimeLoadFailedError extends Error {
  code = "extension_runtime_load_failed" as const;

  constructor(projectId: string, cause: unknown) {
    super(`Extension runtime load failed for project ${projectId}`, { cause });
    this.name = "ExtensionRuntimeLoadFailedError";
  }
}

export class ExtensionRuntimeGenerationStaleError extends Error {
  code = "extension_runtime_generation_stale" as const;

  constructor(projectId: string) {
    super(`Extension runtime load for project ${projectId} was invalidated before it could publish`);
    this.name = "ExtensionRuntimeGenerationStaleError";
  }
}

// Attributes a normalized runtime record back to the enabled source that produced it.
// The record's sourcePath is the extension entry file, so the longest source_path that
// contains it is the owner. This keeps repo-local override attribution consistent with
// normalizeExtensionSources(), which selects one source per extension id.
export const resolveEnabledSourceForRecord = (
  recordSourcePath: string,
  enabledSources: ProjectExtensionRuntimeSnapshot["enabledSources"],
) => {
  const normalizedRecordSourcePath = recordSourcePath.replaceAll("\\", "/");
  let match: EnabledExtensionSource | undefined;
  let matchLength = -1;

  for (const source of enabledSources) {
    const root = source.installedSource.source_path.replaceAll("\\", "/");
    const prefix = root.endsWith("/") ? root : `${root}/`;
    if (!normalizedRecordSourcePath.startsWith(prefix) || root.length <= matchLength) continue;
    match = source;
    matchLength = root.length;
  }

  return match;
};
