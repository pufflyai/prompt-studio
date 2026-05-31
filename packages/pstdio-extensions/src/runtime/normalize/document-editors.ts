import type { NormalizedExtension, RuntimeDocumentEditorRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex, refId } from "./accumulator";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

export const registerDocumentEditors = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.documentEditors ?? {})) {
    const id = contributionId(ext, localId);

    if (
      !isRecord(contribution) ||
      typeof contribution.title !== "string" ||
      typeof contribution.resourceKind !== "string" ||
      !refId(contribution.readCommand)
    ) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_document_editor",
          message: `Document editor "${id}" must define title, resourceKind, and readCommand`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const record: RuntimeDocumentEditorRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: contribution as RuntimeDocumentEditorRecord["contribution"],
    };

    const existing = index.documentEditorIds.get(id);
    if (existing) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_document_editor_id",
          message: `Document editor id "${id}" is already provided by ${existing.sourcePath}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    index.documentEditorIds.set(id, record);
    runtime.documentEditors.push(record);
  }
};
