import type { ProjectExtensionInstance } from "pstdio-api-contracts";
import { getExtensionApiVersionError } from "pstdio-extensions";

type InstanceLike = {
  id: string;
  scope_id: string;
  display_name_override: string | null;
  enabled: boolean;
  config_json: unknown;
};

type InstalledSourceLike = {
  id: string;
  install_name: string;
  extension_id: string;
  display_name: string;
  source_path: string;
  source_kind: string;
  version: string | null;
  manifest_json: unknown;
  source_hash: string | null;
  status: "pending" | "loaded" | "error" | "missing" | "disabled";
  last_loaded_at: string | null;
  last_error_json: unknown;
};

const optionalString = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

const compatibilityError = (installedSource: InstalledSourceLike) => {
  const manifest = (installedSource.manifest_json ?? {}) as Record<string, unknown>;
  const name = optionalString(manifest.name) ?? installedSource.install_name;
  const declared = optionalString(manifest.enginesPstdio);
  if (!declared) return null;

  const message = getExtensionApiVersionError(name, declared);
  return message
    ? {
        code: "extension_manifest_unsupported_api_version",
        message,
      }
    : null;
};

// Mirrors repoExtensionsRoot: repo-local sources always live under `<repo>/.pstdio/extensions/`.
const sourceScope = (sourcePath: string) =>
  sourcePath.includes("/.pstdio/extensions/") ? ("repo" as const) : ("global" as const);

// The package name follows the source's current manifest, so it can never drift from a stored copy.
export const nameFromSource = (installedSource: InstalledSourceLike) => {
  const manifest = (installedSource.manifest_json ?? {}) as Record<string, unknown>;
  return optionalString(manifest.name) ?? installedSource.install_name;
};

/**
 * `diskSourceHash` is the hash of the folder as it is on disk right now. It differs from the
 * source's stored hash exactly when new source is waiting to be adopted. Callers that have not
 * scanned the folder pass nothing, which reports no update rather than guessing.
 */
export const toProjectExtensionInstance = (
  instance: InstanceLike,
  installedSource: InstalledSourceLike,
  diskSourceHash?: string | null,
  options: { canUpgrade?: boolean } = {},
): ProjectExtensionInstance => {
  const manifest = (installedSource.manifest_json ?? {}) as Record<string, unknown>;
  const incompatible = compatibilityError(installedSource);
  return {
    id: instance.id,
    projectId: instance.scope_id,
    extensionId: installedSource.extension_id,
    installedExtensionId: installedSource.id,
    installName: installedSource.install_name,
    name: nameFromSource(installedSource),
    displayName: instance.display_name_override ?? installedSource.display_name,
    version: installedSource.version,
    description: optionalString(manifest.description),
    sourcePath: installedSource.source_path,
    scope: sourceScope(installedSource.source_path),
    status: incompatible ? "error" : installedSource.status,
    lastLoadedAt: installedSource.last_loaded_at,
    lastError: incompatible ?? ((installedSource.last_error_json ?? null) as Record<string, unknown> | null),
    enabled: instance.enabled,
    config: (instance.config_json ?? {}) as Record<string, unknown>,
    canUpgrade: options.canUpgrade === true,
    updateAvailable: Boolean(
      diskSourceHash && installedSource.source_hash && diskSourceHash !== installedSource.source_hash,
    ),
  };
};
