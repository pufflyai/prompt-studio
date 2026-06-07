import type { NormalizedExtension, RuntimeCommandPaletteResourceRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex, refId } from "./accumulator";
import { isLocalizableString } from "./localizable";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

export const registerCommandPaletteResources = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.commandPaletteResources ?? {})) {
    const id = contributionId(ext, localId);

    if (!isRecord(contribution) || !isLocalizableString(contribution.title) || !refId(contribution.queryCommand)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_command_palette_resource",
          message: `Command palette resource "${id}" must define title and queryCommand`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const record: RuntimeCommandPaletteResourceRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: contribution as RuntimeCommandPaletteResourceRecord["contribution"],
    };

    const existing = index.commandPaletteResourceIds.get(id);
    if (existing) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_command_palette_resource_id",
          message: `Command palette resource id "${id}" is already provided by ${existing.sourcePath}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    index.commandPaletteResourceIds.set(id, record);
    runtime.commandPaletteResources.push(record);
  }
};
