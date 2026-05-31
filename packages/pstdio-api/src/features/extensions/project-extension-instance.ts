import type { ProjectExtensionInstance } from "pstdio-api-contracts";

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
  version: string | null;
  manifest_json: unknown;
};

const optionalString = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

// The package name follows the source's current manifest, so it can never drift from a stored copy.
export const nameFromSource = (installedSource: InstalledSourceLike) => {
  const manifest = (installedSource.manifest_json ?? {}) as Record<string, unknown>;
  return optionalString(manifest.name) ?? installedSource.install_name;
};

export const toProjectExtensionInstance = (
  instance: InstanceLike,
  installedSource: InstalledSourceLike,
): ProjectExtensionInstance => {
  const manifest = (installedSource.manifest_json ?? {}) as Record<string, unknown>;
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
    enabled: instance.enabled,
    config: (instance.config_json ?? {}) as Record<string, unknown>,
  };
};
