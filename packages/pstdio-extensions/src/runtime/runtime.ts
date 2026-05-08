import { pstdioExtensionsRoot } from "./discovery";
import { type LoadExtensionSourcesOptions, loadExtensionSources } from "./loader";
import { normalizeExtensionSources } from "./normalize";

export type LoadExtensionRuntimeInput = {
  /** Skip discovery of `~/.pstdio/extensions` when false. Defaults to true. */
  includeUserRoot?: boolean;
  /** Additional source roots to discover. */
  extensionRoots?: LoadExtensionSourcesOptions["extensionRoots"];
  /** Explicit extension files to load. */
  extensionFiles?: LoadExtensionSourcesOptions["extensionFiles"];
};

export const loadExtensionRuntime = async (input: LoadExtensionRuntimeInput = {}) => {
  const includeUserRoot = input.includeUserRoot !== false;

  const roots = [...(input.extensionRoots ?? [])];
  if (includeUserRoot) {
    roots.push({ path: pstdioExtensionsRoot(), sourceKind: "local" });
  }

  const loaded = await loadExtensionSources({
    extensionRoots: roots,
    extensionFiles: input.extensionFiles,
  });

  return normalizeExtensionSources(loaded.sources, loaded.diagnostics);
};
