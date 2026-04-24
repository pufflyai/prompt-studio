import { loadExtensionSources } from "./loader";
import { normalizeExtensionSources } from "./normalize";

export type LoadExtensionRuntimeInput = {
  projectRoot: string;
};

export const loadExtensionRuntime = async (input: LoadExtensionRuntimeInput) => {
  const loaded = await loadExtensionSources(input.projectRoot);
  return normalizeExtensionSources(loaded.sources, loaded.diagnostics);
};
