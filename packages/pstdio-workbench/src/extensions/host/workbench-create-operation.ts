import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { UnresolvedSubmissionError } from "@pstdio/ui";
import { text } from "pstdio-extensions/workbench";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import type { OperationInput, OperationRecovery } from "../../core/registries/mutations/operation-types";
import { operationSubject, type WorkbenchOperations } from "../../core/registries/mutations/operations";

type CreateOperation<T> = Pick<
  OperationInput<T>,
  "projectId" | "subjects" | "title" | "source" | "draft" | "write" | "classify" | "onDiscard"
>;
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
  const attempted = operations.submit({
    ...input,
    domain: "resource.create",
    describeRecovery: message ? () => (typeof message === "function" ? message(input.draft) : message) : undefined,
    classify,
    releaseOnDiscard: true,
  });
  try {
    return await attempted.result;
  } catch (error) {
    if (classify(error) !== "unknown") throw error;
    throw unresolved(operations, attempted.id, error);
  }
};

export const runCreateOperation = (
  operations: WorkbenchOperations,
  projectId: string,
  command: WorkbenchExtensionMetadata["commands"][number],
  draft: Record<string, unknown> | undefined,
  write: (signal: AbortSignal) => Promise<unknown>,
) =>
  runTrackedCreate(operations, {
    projectId,
    subjects: [operationSubject("create", projectId, command.extensionId, crypto.randomUUID())],
    title: text(command.title, "Create resource"),
    draft,
    write,
  });
