import type { NormalizedExtension, RuntimeCommandRecord, RuntimeDataTableRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex, refId } from "./accumulator";
import { registerCommandRecord } from "./commands";
import { isLocalizableString } from "./localizable";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

const rowActivationCommandId = (id: string) => `${id}.__dataTableRowActivate`;

const createRowActivationCommand = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  localId: string,
  record: RuntimeDataTableRendererRecord,
): RuntimeCommandRecord | undefined => {
  const handler = record.contribution.onRowActivate;
  if (typeof handler !== "function") return undefined;
  return {
    id: rowActivationCommandId(record.id),
    localId: `${localId}.__dataTableRowActivate`,
    extensionId: ext.id,
    name: ext.name,
    sourcePath: source.sourcePath,
    title: `${record.contribution.title} row activation`,
    params: { rendererId: { type: "text" }, row: { type: "json", required: true } },
    menus: [],
    palette: [],
    run: (ctx) => handler({ ...ctx, renderer: ctx.params.renderer as never }, { row: ctx.params.row as never }),
  };
};

export const registerDataTableRenderers = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.dataTableRenderers ?? {})) {
    const id = contributionId(ext, localId);
    if (!isRecord(contribution) || !isLocalizableString(contribution.title) || !refId(contribution.queryCommand)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_data_table_renderer",
          message: `Data table renderer "${id}" must define title and queryCommand`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const record: RuntimeDataTableRendererRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: contribution as RuntimeDataTableRendererRecord["contribution"],
    };
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
    index.dataTableRendererIds.set(id, record);
    runtime.dataTableRenderers.push(record);
    const command = createRowActivationCommand(ext, source, localId, record);
    if (command && !registerCommandRecord(command, runtime, index)) {
      record.contribution = { ...record.contribution, onRowActivate: undefined };
    }
  }
};
