import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import type { KanbanRendererCreateRequest } from "../../core/registries/renderers/kanban-renderer-registry";
import type { CreateOperationFeedback } from "../host/workbench-create-operation";
import type { ExecuteWorkbenchExtensionCommandInput } from "../host/workbench-extension-command";
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
  activateCreatedRow:
    | ((
        row: KanbanRendererRow,
        invocation: Pick<ExecuteWorkbenchExtensionCommandInput, "signal" | "isViewerCurrent">,
      ) => Promise<void> | void)
    | undefined,
) => {
  const contribution = record.createRow;
  if (!contribution) return undefined;
  return async (submission: KanbanRendererCreateRequest) => {
    const params = mergeParams(
      submission.values,
      contribution.columnParam && submission.columnId ? { [contribution.columnParam]: submission.columnId } : undefined,
      contribution.attributesParam ? { [contribution.attributesParam]: submission.attributeValues } : undefined,
    );
    const openCreatedRow = (created: unknown, signal?: AbortSignal) => {
      if (
        signal?.aborted ||
        submission.openCreatedRow === false ||
        submission.canOpenCreatedRow?.() === false ||
        !activateCreatedRow ||
        typeof created !== "object" ||
        created === null
      )
        return;
      const row = created as Partial<KanbanRendererRow>;
      if (typeof row.id !== "string" || typeof row.title !== "string") return;
      return activateCreatedRow(
        { ...row, id: row.id, title: row.title, attributes: row.attributes ?? {} },
        { signal, isViewerCurrent: submission.canOpenCreatedRow },
      );
    };
    let opening: Promise<{ error: unknown } | undefined> | undefined;
    let attaching: Promise<void> | undefined;
    let attachmentFailure: unknown;
    const onCreated = (created: unknown, signal?: AbortSignal) => {
      // The saved row has everything needed to open it while reads and attachments finish.
      opening ??= Promise.resolve()
        .then(() => openCreatedRow(created, signal))
        .then(
          () => undefined,
          (error: unknown) => ({ error }),
        );
      attaching ??= Promise.resolve()
        .then(() => adapter.onAfterCreate?.({ record, created, submission, signal }))
        .catch((error: unknown) => {
          attachmentFailure = error;
        });
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
    onCreated(created);
    const [, navigationFailure] = await Promise.all([attaching, opening]);
    if (attachmentFailure !== undefined) throw attachmentFailure;
    if (navigationFailure) throw navigationFailure.error;
  };
};
