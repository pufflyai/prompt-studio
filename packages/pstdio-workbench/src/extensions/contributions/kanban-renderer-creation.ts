import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import type { KanbanRendererCreateRequest } from "../../core/registries/renderers/kanban-renderer-registry";
import type { CreateOperationFeedback } from "../host/workbench-create-operation";
import type { WorkbenchExtensionKanbanRendererAdapter } from "./kanban-renderer-adapter";
import {
  type KanbanRendererRow,
  mergeParams,
  prepareKanbanCreationFeedback,
} from "./kanban-renderer-contribution-helpers";

export const toCreateRowHandler = (
  record: WorkbenchExtensionKanbanRendererRecord,
  adapter: WorkbenchExtensionKanbanRendererAdapter,
  runMutation: (
    record: WorkbenchExtensionKanbanRendererRecord,
    commandId: string,
    params: Record<string, unknown>,
    feedback?: CreateOperationFeedback,
  ) => Promise<unknown>,
  activateCreatedRow: ((row: KanbanRendererRow) => Promise<void> | void) | undefined,
) => {
  const contribution = record.createRow;
  if (!contribution) return undefined;
  return async (submission: KanbanRendererCreateRequest) => {
    const params = mergeParams(
      submission.values,
      contribution.columnParam && submission.columnId ? { [contribution.columnParam]: submission.columnId } : undefined,
      contribution.attributesParam ? { [contribution.attributesParam]: submission.attributeValues } : undefined,
    );
    let attaching: Promise<void> | undefined;
    let attachmentFailure: unknown;
    const onCreated = (created: unknown, signal?: AbortSignal) => {
      attaching ??= Promise.resolve()
        .then(() => adapter.onAfterCreate?.({ record, created, submission, signal }))
        .catch((error: unknown) => {
          attachmentFailure = error;
        });
      return attaching;
    };
    const settleAttachment = () => {
      void attaching?.then(() => submission.onSettled?.(attachmentFailure));
    };
    const feedback = prepareKanbanCreationFeedback(submission);
    const created = await runMutation(record, contribution.commandId, params, {
      ...feedback,
      onCreated,
      onReconciled: settleAttachment,
      onDiscard: () => {
        if (attaching) settleAttachment();
        else feedback.onDiscard?.();
      },
    }).catch((error: unknown) => {
      throw attachmentFailure ?? error;
    });
    await onCreated(created);
    if (attachmentFailure !== undefined) throw attachmentFailure;
    if (
      submission.openCreatedRow === false ||
      submission.canOpenCreatedRow?.() === false ||
      !activateCreatedRow ||
      typeof created !== "object" ||
      created === null
    )
      return;
    const row = created as Partial<KanbanRendererRow>;
    if (typeof row.id !== "string" || typeof row.title !== "string") return;
    await activateCreatedRow({ ...row, id: row.id, title: row.title, attributes: row.attributes ?? {} });
  };
};
