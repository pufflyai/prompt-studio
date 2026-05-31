import { pstdioExtensionsRoot } from "./discovery";
import { type LoadExtensionSourcesOptions, loadExtensionSources } from "./loader";
import { normalizeExtensionSources } from "./normalize";

export type LoadExtensionRuntimeInput = {
  /** Skip discovery of `~/.pstdio/extensions` when false. Defaults to true. */
  includeUserRoot?: boolean;
  /** Additional source roots to discover. */
  extensionRoots?: LoadExtensionSourcesOptions["extensionRoots"];
  /** Explicit extension packages to load. */
  extensionPackages?: LoadExtensionSourcesOptions["extensionPackages"];
};

export const loadExtensionRuntime = async (input: LoadExtensionRuntimeInput = {}) => {
  const includeUserRoot = input.includeUserRoot !== false;

  const roots = [...(input.extensionRoots ?? [])];
  if (includeUserRoot) {
    roots.push({ path: pstdioExtensionsRoot(), sourceKind: "local_path" });
  }

  const loaded = await loadExtensionSources({
    extensionRoots: roots,
    extensionPackages: input.extensionPackages,
  });

  return normalizeExtensionSources(loaded.sources, loaded.diagnostics);
};
