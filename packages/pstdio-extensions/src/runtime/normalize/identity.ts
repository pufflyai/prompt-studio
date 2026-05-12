import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator } from "./accumulator";

export const registerExtension = (
  source: LoadedExtensionSource,
  runtime: Accumulator,
  extensionsById: Map<string, NormalizedExtension>,
) => {
  const { manifest } = source;

  const normalized: NormalizedExtension = {
    id: manifest.id,
    name: manifest.name,
    displayName: manifest.displayName ?? manifest.name,
    version: manifest.version,
    description: manifest.description,
    packagePath: source.packagePath,
    sourcePath: source.sourcePath,
    sourceKind: source.sourceKind,
    definition: source.definition,
  };

  const existingById = extensionsById.get(manifest.id);
  if (existingById) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "duplicate_extension_id",
        message: `Extension id "${manifest.id}" is already provided by ${existingById.sourcePath}`,
        extensionId: manifest.id,
        sourcePath: source.sourcePath,
      }),
    );
  } else {
    extensionsById.set(manifest.id, normalized);
  }

  runtime.extensions.push(normalized);
  return normalized;
};
