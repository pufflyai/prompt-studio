import type { ExtensionDiagnostic, ExtensionRuntime, NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { createAccumulator, createRegistryIndex } from "./accumulator";
import { registerAppearance } from "./appearance";
import { registerArtifactMounts } from "./artifact-mounts";
import { registerCommandPaletteResources } from "./command-palette-resources";
import { registerCommands } from "./commands";
import { registerContent } from "./content";
import { registerDataRenderers } from "./data-renderers";
import { registerFileRenderers } from "./file-renderers";
import { registerHooks } from "./hooks";
import { registerExtension } from "./identity";
import { registerKeybindings } from "./keybindings";
import { registerMiddlewares } from "./middlewares";
import { registerModes } from "./modes";
import { registerProviders } from "./providers";
import { registerSchedules } from "./schedules";
import { registerSettings } from "./settings";
import { registerTranslations } from "./translations";
import { registerTreeRenderers } from "./tree-renderers";
import { registerViewLikeContributions } from "./views";

type NormalizeExtensionSourcesOptions = {
  repoRoots?: string[];
};

const isRepoLocalSource = (source: LoadedExtensionSource, repoRoots: string[]) =>
  repoRoots.some((repoRoot) => source.packagePath.startsWith(`${repoRoot}/.pstdio/extensions/`));

const createOverrideDiagnostic = (source: LoadedExtensionSource, override: LoadedExtensionSource) => ({
  code: "extension_overridden_by_local",
  severity: "warning" as const,
  message: `Extension "${source.manifest.id}" from ${source.sourcePath} is overridden by repo-local ${override.sourcePath}`,
  extensionId: source.manifest.id,
  sourcePath: source.sourcePath,
  metadata: { override: { sourcePath: override.sourcePath, sourceKind: override.sourceKind } },
});

const resolveSources = (
  sources: LoadedExtensionSource[],
  runtime: ExtensionRuntime,
  options: NormalizeExtensionSourcesOptions,
) => {
  const repoRoots = options.repoRoots ?? [];
  const selected: LoadedExtensionSource[] = [];

  for (const source of sources) {
    const sourceIsLocal = source.sourceKind === "local_path" && isRepoLocalSource(source, repoRoots);
    const duplicates = selected.filter((candidate) => candidate.manifest.id === source.manifest.id);
    const localDuplicate = duplicates.find(
      (candidate) => candidate.sourceKind === "local_path" && isRepoLocalSource(candidate, repoRoots),
    );

    if (!sourceIsLocal && localDuplicate) {
      runtime.diagnostics.push(createOverrideDiagnostic(source, localDuplicate));
      continue;
    }

    if (sourceIsLocal && duplicates.some((candidate) => !isRepoLocalSource(candidate, repoRoots))) {
      for (let index = selected.length - 1; index >= 0; index -= 1) {
        const candidate = selected[index];
        if (candidate?.manifest.id !== source.manifest.id || isRepoLocalSource(candidate, repoRoots)) continue;
        runtime.diagnostics.push(createOverrideDiagnostic(candidate, source));
        selected.splice(index, 1);
      }
    }

    selected.push(source);
  }

  return selected;
};

export const normalizeExtensionSources = (
  sources: LoadedExtensionSource[],
  initialDiagnostics: ExtensionDiagnostic[] = [],
  options: NormalizeExtensionSourcesOptions = {},
): ExtensionRuntime => {
  const runtime = createAccumulator(initialDiagnostics);
  const index = createRegistryIndex();
  const extensionsById = new Map<string, NormalizedExtension>();

  for (const source of resolveSources(sources, runtime, options)) {
    const ext = registerExtension(source, runtime, extensionsById);

    registerCommands(ext, source, runtime, index);
    registerKeybindings(ext, source, runtime, index);
    registerMiddlewares(ext, source, runtime);
    registerHooks(ext, source, runtime);
    registerSchedules(ext, source, runtime);
    registerSettings(ext, source, runtime);
    registerArtifactMounts(ext, source, runtime, index);
    registerModes(ext, source, runtime);
    registerTreeRenderers(ext, source, runtime, index);
    registerFileRenderers(ext, source, runtime, index);
    registerViewLikeContributions(ext, source, runtime);
    registerDataRenderers(ext, source, runtime, index);
    registerCommandPaletteResources(ext, source, runtime, index);
    registerContent(ext, source, runtime);
    registerAppearance(ext, source, runtime, index);
    registerTranslations(ext, source, runtime, index);
    registerProviders(ext, source, runtime);
  }

  return runtime;
};
