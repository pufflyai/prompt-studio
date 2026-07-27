import type { NormalizedExtension, RuntimeKanbanRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex, refId } from "./accumulator";
import { isLocalizableString } from "./localizable";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

export const registerKanbanRenderers = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.kanbanRenderers ?? {})) {
    const id = contributionId(ext, localId);

    if (!isRecord(contribution) || !isLocalizableString(contribution.title) || !refId(contribution.queryCommand)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_data_renderer",
          message: `Kanban renderer "${id}" must define title and queryCommand`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const record: RuntimeKanbanRendererRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: contribution as RuntimeKanbanRendererRecord["contribution"],
    };

    const existing = index.kanbanRendererIds.get(id);
    if (existing) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_data_renderer_id",
          message: `Kanban renderer id "${id}" is already provided by ${existing.sourcePath}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    index.kanbanRendererIds.set(id, record);
    runtime.kanbanRenderers.push(record);
  }
};
