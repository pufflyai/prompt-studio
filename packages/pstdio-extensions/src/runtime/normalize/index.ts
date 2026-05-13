import type { ExtensionDiagnostic, ExtensionRuntime, NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { createAccumulator, createRegistryIndex } from "./accumulator";
import { registerAppearance } from "./appearance";
import { registerArtifactMounts } from "./artifact-mounts";
import { registerCommands } from "./commands";
import { registerContent } from "./content";
import { registerHooks } from "./hooks";
import { registerExtension } from "./identity";
import { registerMiddlewares } from "./middlewares";
import { registerProviders } from "./providers";
import { registerSchedules } from "./schedules";
import { registerViewLikeContributions } from "./views";

export const normalizeExtensionSources = (
  sources: LoadedExtensionSource[],
  initialDiagnostics: ExtensionDiagnostic[] = [],
): ExtensionRuntime => {
  const runtime = createAccumulator(initialDiagnostics);
  const index = createRegistryIndex();
  const extensionsById = new Map<string, NormalizedExtension>();
  const selectedSources: LoadedExtensionSource[] = [];

  for (const source of sources) {
    const existingIndex = selectedSources.findIndex((candidate) => candidate.manifest.id === source.manifest.id);
    const existing = existingIndex >= 0 ? selectedSources[existingIndex] : undefined;
    if (existing && source.sourceKind === "local_path") {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "extension_overridden_by_local",
          message: `Extension id "${source.manifest.id}" from ${existing.sourcePath} is overridden by ${source.sourcePath}`,
          extensionId: source.manifest.id,
          sourcePath: source.sourcePath,
        }),
      );
      selectedSources[existingIndex] = source;
      continue;
    }
    if (existing?.sourceKind === "local_path") {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "extension_overridden_by_local",
          message: `Extension id "${source.manifest.id}" from ${source.sourcePath} is overridden by ${existing.sourcePath}`,
          extensionId: source.manifest.id,
          sourcePath: existing.sourcePath,
        }),
      );
      continue;
    }
    selectedSources.push(source);
  }

  for (const source of selectedSources) {
    const ext = registerExtension(source, runtime, extensionsById);

    registerCommands(ext, source, runtime, index);
    registerMiddlewares(ext, source, runtime);
    registerHooks(ext, source, runtime);
    registerSchedules(ext, source, runtime);
    registerArtifactMounts(ext, source, runtime, index);
    registerViewLikeContributions(ext, source, runtime);
    registerContent(ext, source, runtime);
    registerAppearance(ext, source, runtime, index);
    registerProviders(ext, source, runtime);
  }

  return runtime;
};
