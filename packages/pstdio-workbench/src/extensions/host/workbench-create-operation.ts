import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { commandRefId } from "@pstdio/sdk/extensions";
import { UnresolvedSubmissionError } from "@pstdio/ui";
import { text } from "pstdio-extensions/workbench";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import type { OperationInput, OperationRecovery } from "../../core/registries/mutations/operation-types";
import { operationSubject, type WorkbenchOperations } from "../../core/registries/mutations/operations";

type CreateOperation<T> = Pick<
  OperationInput<T>,
  | "projectId"
  | "subjects"
  | "title"
  | "source"
  | "draft"
  | "write"
  | "classify"
  | "onDiscard"
  | "intent"
  | "showPending"
  | "originatingRead"
  | "reconcile"
  | "onReconciled"
> & { onAdmitted?(): void };

export interface BoardCreationIntent {
  viewKey: string;
  columnId: string;
  title: string;
  openCreatedRow: boolean;
  confirmedId?: string;
}

export interface CreateOperationFeedback {
  board?: BoardCreationIntent;
  onAdmitted?(): void;
  onDiscard?(): void;
  onCreated?(created: unknown, signal: AbortSignal): void;
  onReconciled?(): void;
  originatingRead?: OperationInput<unknown>["originatingRead"];
}
type RecoveryMessage = string | ((draft: unknown) => string);

const unresolved = (operations: WorkbenchOperations, id: symbol, error: unknown) => {
  const find = () => operations.getSnapshot().recovery.find((entry) => entry.id === id);
  return new UnresolvedSubmissionError(
    {
      copyDraft: async () => {
        const entry = find();
        if (!entry) throw new Error("The draft is no longer available.");
        const content = entry.draft;
        await navigator.clipboard.writeText(
          typeof content === "string" ? content : JSON.stringify(content ?? {}, null, 2),
        );
      },
      dismiss: () => operations.dismiss(id),
      discard: () => operations.discard(id),
      isRetained: () => Boolean(find()),
    },
    error,
    find()?.description,
  );
};

export const runTrackedCreate = async <T>(
  operations: WorkbenchOperations,
  input: CreateOperation<T>,
  findUnresolved?: (recovery: readonly OperationRecovery[]) => OperationRecovery | undefined,
  message?: RecoveryMessage,
) => {
  const previous = findUnresolved?.(operations.getSnapshot().recovery);
  if (previous) throw unresolved(operations, previous.id, previous.error);
  const classify = input.classify ?? classifyApiWrite;
  let acknowledged = false;
  const attempted = operations.submit({
    ...input,
    domain: "resource.create",
    describeRecovery: message ? () => (typeof message === "function" ? message(input.draft) : message) : undefined,
    classify,
    releaseOnDiscard: true,
    reconcile(value, signal) {
      acknowledged = true;
      return input.reconcile?.(value, signal);
    },
  });
  input.onAdmitted?.();
  try {
    return await attempted.result;
  } catch (error) {
    const recovery = operations.getSnapshot().recovery.find((entry) => entry.id === attempted.id);
    if (acknowledged && !recovery?.canCheck) {
      // Retirement cancelled a presentation read after the write was acknowledged.
      input.onReconciled?.();
      throw error;
    }
    if (recovery?.status === "unknown" || recovery?.status === "unconfirmed")
      throw unresolved(operations, attempted.id, error);
    throw error;
  }
};

export const declaredCreateCommandIds = (
  metadata: Partial<Pick<WorkbenchExtensionMetadata, "views" | "keybindings">>,
) =>
  new Set([
    ...(metadata.views ?? []).flatMap(({ body }) =>
      (body.kind === "kanban" || body.kind === "resourceList") && body.createRow
        ? [commandRefId(body.createRow.command)]
        : [],
    ),
    ...(metadata.keybindings ?? []).flatMap((binding) => {
      if (binding.layer !== "create" || binding.action.kind !== "command") return [];
      const command = binding.action.target.command;
      return [commandRefId({ extensionId: command.extensionId ?? binding.extensionId, id: command.id })];
    }),
  ]);

export const runCreateOperation = async <T>(
  operations: WorkbenchOperations,
  projectId: string,
  command: WorkbenchExtensionMetadata["commands"][number],
  draft: Record<string, unknown> | undefined,
  write: (signal: AbortSignal) => Promise<T>,
  feedback?: CreateOperationFeedback,
) => {
  const subject = operationSubject("create", projectId, command.id);
  const { pending } = operations.getSnapshot();
  const board = feedback?.board;
  if (
    pending.some(
      (entry) =>
        (entry.status === "queued" || entry.status === "writing" || entry.status === "reconciling") &&
        entry.subjects.includes(subject),
    )
  )
    throw new Error("This creation is already in progress.");
  const findPrevious = (entries: readonly OperationRecovery[]) =>
    entries.find(
      (entry) =>
        entry.status !== "rejected" &&
        entry.subjects.includes(subject) &&
        !(entry.status === "unconfirmed" && entry.acknowledged && !entry.canCheck),
    );
  if (feedback?.onAdmitted && findPrevious(operations.getSnapshot().recovery))
    throw new Error("A previous creation needs attention in System activity.");
  return runTrackedCreate(
    operations,
    {
      projectId,
      subjects: [subject],
      title: text(command.title, "Create resource"),
      draft,
      intent: board,
      onAdmitted: feedback?.onAdmitted,
      onDiscard: feedback?.onDiscard,
      originatingRead: feedback?.originatingRead,
      showPending: feedback?.onAdmitted ? true : undefined,
      write,
      reconcile: feedback
        ? (result, signal) => {
            const row = result as { id?: unknown } | undefined;
            if (board && typeof row?.id === "string") board.confirmedId = row.id;
            feedback.onCreated?.(result, signal);
          }
        : undefined,
      onReconciled: feedback?.onReconciled,
    },
    findPrevious,
  );
};
