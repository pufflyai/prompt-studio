import type { NormalizedExtension, RuntimeCommandRecord, RuntimeKanbanRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex, refId } from "./accumulator";
import { registerCommandRecord } from "./commands";
import { isLocalizableString } from "./localizable";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

const rowActivationCommandId = (id: string) => `${id}.__kanbanRowActivate`;

const createRowActivationCommand = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  localId: string,
  record: RuntimeKanbanRendererRecord,
): RuntimeCommandRecord | undefined => {
  const handler = record.contribution.onRowActivate;
  if (typeof handler !== "function") return undefined;
  return {
    id: rowActivationCommandId(record.id),
    localId: `${localId}.__kanbanRowActivate`,
    extensionId: ext.id,
    name: ext.name,
    sourcePath: source.sourcePath,
    title: `${record.contribution.title} row activation`,
    params: { rendererId: { type: "text" }, row: { type: "json", required: true } },
    menus: [],
    palette: [],
    run: (ctx) => handler(ctx, { row: ctx.params.row as never }),
  };
};

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
    const command = createRowActivationCommand(ext, source, localId, record);
    if (command && !registerCommandRecord(command, runtime, index)) {
      record.contribution = { ...record.contribution, onRowActivate: undefined };
    }
  }
};
