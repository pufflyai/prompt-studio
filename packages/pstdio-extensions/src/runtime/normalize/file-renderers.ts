import type { NormalizedExtension, RuntimeFileRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex, refId } from "./accumulator";
import { isLocalizableString } from "./localizable";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

const isLocalCommandRef = (ext: NormalizedExtension, commandId: string) => commandId.startsWith(`${ext.name}.`);

const fileCommandId = (value: unknown) => refId(value as Parameters<typeof refId>[0]);

const hasKnownLocalCommand = (ext: NormalizedExtension, commandId: string | null, index: RegistryIndex) => {
  if (!commandId) return false;
  if (!isLocalCommandRef(ext, commandId)) return true;
  return index.commandIds.has(commandId);
};

const isValidFileRenderer = (ext: NormalizedExtension, contribution: unknown, index: RegistryIndex) => {
  if (!isRecord(contribution) || !isLocalizableString(contribution.title)) return false;
  if (!hasKnownLocalCommand(ext, fileCommandId(contribution.loadCommand), index)) return false;
  if (contribution.saveCommand && !hasKnownLocalCommand(ext, fileCommandId(contribution.saveCommand), index)) {
    return false;
  }
  return true;
};

export const registerFileRenderers = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.fileRenderers ?? {})) {
    const id = contributionId(ext, localId);

    if (!isValidFileRenderer(ext, contribution, index)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_file_renderer",
          message: `File renderer "${id}" must define title and a valid loadCommand`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const record: RuntimeFileRendererRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: contribution as RuntimeFileRendererRecord["contribution"],
    };

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

    index.fileRendererIds.set(id, record);
    runtime.fileRenderers.push(record);
  }
};
