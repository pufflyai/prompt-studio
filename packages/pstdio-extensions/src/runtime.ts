import { loadExtensionSources } from "./loader";
import { normalizeExtensionSources } from "./normalize";

export type LoadExtensionRuntimeInput = {
  projectRoot: string;
  includeLocal?: boolean;
};

export const loadExtensionRuntime = async (input: LoadExtensionRuntimeInput) => {
  const loaded = await loadExtensionSources(input.projectRoot, { includeLocal: input.includeLocal });
  return normalizeExtensionSources(loaded.sources, loaded.diagnostics);
};
