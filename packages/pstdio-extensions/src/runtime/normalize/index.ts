import type { ExtensionDiagnostic, ExtensionRuntime, NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { createAccumulator, createRegistryIndex } from "./accumulator";
import { registerAppearance } from "./appearance";
import { registerArtifactMounts } from "./artifact-mounts";
import { registerCommands } from "./commands";
import { registerContent } from "./content";
import { registerHooks } from "./hooks";
import { registerExtension, validateIdentity } from "./identity";
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
  const namespacesInUse = new Map<string, NormalizedExtension>();

  for (const source of sources) {
    if (!validateIdentity(source, runtime)) continue;

    const ext = registerExtension(source, runtime, extensionsById, namespacesInUse);

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
