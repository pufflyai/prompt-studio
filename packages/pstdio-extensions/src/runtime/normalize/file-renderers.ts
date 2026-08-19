import type { NormalizedExtension, RuntimeFileRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { isLocalizableString } from "./localizable";
import { registerPrivateHandler } from "./private-handlers";
import { contributionId } from "./references";

const isValidFileRenderer = (contribution: unknown) => {
  if (!isRecord(contribution) || !isLocalizableString(contribution.title)) return false;
  return typeof contribution.load === "function";
};

export const registerFileRenderers = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.fileRenderers ?? {})) {
    const id = contributionId(ext, localId);

    if (!isValidFileRenderer(contribution)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_file_renderer",
          message: `File renderer "${id}" must define title and load`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const existing = index.fileRendererIds.get(id);
    if (existing) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_file_renderer_id",
          message: `File renderer id "${id}" is already provided by ${existing.sourcePath}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const loadHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "file",
      rendererLocalId: localId,
      operation: "load",
      handler: contribution.load,
    });
    if (!loadHandlerId) continue;
    const saveHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "file",
      rendererLocalId: localId,
      operation: "save",
      handler: contribution.save,
    });

    const record: RuntimeFileRendererRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: { ...contribution, loadHandlerId, saveHandlerId } as RuntimeFileRendererRecord["contribution"],
    };

    index.fileRendererIds.set(id, record);
    runtime.fileRenderers.push(record);
  }
};
