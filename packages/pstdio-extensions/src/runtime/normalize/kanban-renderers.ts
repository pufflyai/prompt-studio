import type { NormalizedExtension, RuntimeKanbanRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { isLocalizableString } from "./localizable";
import { registerPrivateHandler } from "./private-handlers";
import { contributionId } from "./references";

export const registerKanbanRenderers = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.kanbanRenderers ?? {})) {
    const id = contributionId(ext, localId);

    if (
      !isRecord(contribution) ||
      !isLocalizableString(contribution.title) ||
      typeof contribution.query !== "function"
    ) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_data_renderer",
          message: `Kanban renderer "${id}" must define title and query`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

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

    const queryHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "kanban",
      rendererLocalId: localId,
      operation: "query",
      handler: contribution.query,
    });
    if (!queryHandlerId) continue;
    const attributeChangeHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "kanban",
      rendererLocalId: localId,
      operation: "onAttributeChange",
      handler: contribution.onAttributeChange,
    });
    const reorderHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "kanban",
      rendererLocalId: localId,
      operation: "onReorder",
      handler: contribution.onReorder,
    });
    const columnActionHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "kanban",
      rendererLocalId: localId,
      operation: "onColumnAction",
      handler: contribution.onColumnAction,
    });
    const rowActivationHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "kanban",
      rendererLocalId: localId,
      operation: "onRowActivate",
      handler: contribution.onRowActivate,
    });

    const record: RuntimeKanbanRendererRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: {
        ...contribution,
        queryHandlerId,
        attributeChangeHandlerId,
        reorderHandlerId,
        columnActionHandlerId,
        rowActivationHandlerId,
      } as RuntimeKanbanRendererRecord["contribution"],
    };

    index.kanbanRendererIds.set(id, record);
    runtime.kanbanRenderers.push(record);
  }
};
