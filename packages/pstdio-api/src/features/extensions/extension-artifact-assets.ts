import { extname } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createArtifactMount, normalizeMountRelativePath } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "./deps";

// The image allowlist deliberately excludes SVG: it can carry script.
export const ARTIFACT_IMAGE_MEDIA_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const ARTIFACT_TEXT_LIMIT_BYTES = 5 * 1024 * 1024;
export const ARTIFACT_IMAGE_LIMIT_BYTES = 20 * 1024 * 1024;

const ARTIFACT_MEDIA_TYPES: Record<string, string> = {
  ...ARTIFACT_IMAGE_MEDIA_TYPES,
  ".csv": "text/csv",
  ".html": "text/html",
  ".json": "application/json",
  ".md": "text/markdown",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};

export const artifactMediaType = (path: string) =>
  ARTIFACT_MEDIA_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";

export const artifactImageMediaType = (path: string) => ARTIFACT_IMAGE_MEDIA_TYPES[extname(path).toLowerCase()];

type ArtifactMountDeps = Pick<ExtensionsRouteDeps, "extensionRuntimeCatalog" | "repoService">;

type ResolveArtifactMountInput = { projectId: string; mountId: string } & (
  | { extensionInstanceId: string }
  | { installName: string }
);

/**
 * Resolve a declared artifact mount for one enabled extension. The extension
 * scoping is the security boundary: a mount is only reachable through the
 * extension that defines it, never by name alone.
 */
export const resolveExtensionArtifactMount = async (deps: ArtifactMountDeps, input: ResolveArtifactMountInput) => {
  const snapshot = await deps.extensionRuntimeCatalog.get(input.projectId);
  const enabled = snapshot.enabledSources.find(({ installedSource, instance }) =>
    "extensionInstanceId" in input
      ? instance.id === input.extensionInstanceId
      : installedSource.install_name === input.installName,
  );
  if (!enabled) return null;

  const runtimeMount = snapshot.runtime.artifactMounts.find(
    (candidate) =>
      candidate.extensionId === enabled.installedSource.extension_id &&
      (candidate.localId === input.mountId || candidate.id === input.mountId),
  );
  if (!runtimeMount) return null;

  const [repo] = await deps.repoService.listByProject(input.projectId);
  if (!repo) return null;

  return {
    installName: enabled.installedSource.install_name,
    mount: createArtifactMount({ repoRoot: repo.path, name: runtimeMount.name, mountPath: runtimeMount.relativePath }),
    runtimeMount,
  };
};

// An exact path is a valid glob pattern, so list() doubles as a metadata lookup.
// The equality check drops accidental glob matches for paths with glob characters.
export const findArtifactFile = async (mount: ArtifactMount, path: string) => {
  const files = await mount.list(path);
  return files.find((file) => file.path === path);
};

/**
 * The safe file root throws on traversal and escape attempts. Validating up
 * front turns a hostile path into a not-found response before any filesystem
 * access, instead of a server error.
 */
export const safeArtifactPath = (path: string) => {
  try {
    const normalized = normalizeMountRelativePath(path);
    return normalized === "" ? null : normalized;
  } catch {
    return null;
  }
};
