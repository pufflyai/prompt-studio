import type { NormalizedExtension, RuntimeDataTableRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { isLocalizableString } from "./localizable";
import { registerPrivateHandler } from "./private-handlers";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

export const registerDataTableRenderers = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.dataTableRenderers ?? {})) {
    const id = contributionId(ext, localId);
    if (
      !isRecord(contribution) ||
      !isLocalizableString(contribution.title) ||
      typeof contribution.query !== "function"
    ) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_data_table_renderer",
          message: `Data table renderer "${id}" must define title and query`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const existing = index.dataTableRendererIds.get(id);
    if (existing) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_data_table_renderer_id",
          message: `Data table renderer id "${id}" is already provided by ${existing.sourcePath}`,
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
      rendererKind: "dataTable",
      rendererLocalId: localId,
      operation: "query",
      handler: contribution.query,
    });
    if (!queryHandlerId) continue;
    const rowActivationHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "dataTable",
      rendererLocalId: localId,
      operation: "onRowActivate",
      handler: contribution.onRowActivate,
    });

    const record: RuntimeDataTableRendererRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: {
        ...contribution,
        queryHandlerId,
        rowActivationHandlerId,
      } as RuntimeDataTableRendererRecord["contribution"],
    };
    index.dataTableRendererIds.set(id, record);
    runtime.dataTableRenderers.push(record);
  }
};
