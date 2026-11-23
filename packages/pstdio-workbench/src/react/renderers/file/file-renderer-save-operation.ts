import type { PageParams, QueryScope, ResourceRef, ScopedQueryClient } from "@pstdio/sdk/extensions";
import type {
  FileRendererContent,
  FileRendererRefreshOrigin,
  FileRendererSaveResult,
  RegisteredFileRendererContribution,
} from "../../../core";
import { classifyApiWrite } from "../../../core/registries/mutations/operation-failures";
import { getWorkbenchOperations, operationSubject } from "../../../core/registries/mutations/operations";

import { matchesFileScope, saveLoadedFile } from "./file-renderer-load-state";

const domain = "document.save";
type FileSaveReceipt = { content?: FileRendererContent; result?: FileRendererSaveResult };

export class UnconfirmedFileSaveError extends Error {
  constructor() {
    super("A save for this file could not be confirmed. Check System activity.");
    this.name = "UnconfirmedFileSaveError";
  }
}

export const saveWithDocumentRecovery = async (input: {
  queries: ScopedQueryClient;
  scope: Partial<QueryScope>;
  loadKey: string;
  source?: ResourceRef;
  title: string;
  value: string;
  filePath?: string;
  write(signal: AbortSignal): Promise<FileSaveReceipt>;
  read(signal: AbortSignal): Promise<FileSaveReceipt>;
  accept(receipt: FileSaveReceipt, signal: AbortSignal): void;
}) => {
  const operations = getWorkbenchOperations(input.queries);
  const subject = operationSubject("file", input.loadKey);
  if (
    operations
      .getSnapshot()
      .pending.some(
        (entry) => entry.subjects.includes(subject) && (entry.status === "unknown" || entry.status === "unconfirmed"),
      )
  )
    throw new UnconfirmedFileSaveError();
  const attempt = operations.submit<FileSaveReceipt>({
    projectId: input.scope.projectId,
    domain,
    title: input.title,
    subjects: [subject],
    source: input.source,
    draft: input.value,
    classify: classifyApiWrite,
    write: input.write,
    async check(signal) {
      const receipt = await input.read(signal);
      return receipt.content?.content === input.value && receipt.content.filePath === input.filePath
        ? { status: "confirmed", result: receipt }
        : { status: "unknown" };
    },
    reconcile(receipt, signal) {
      signal.throwIfAborted();
      input.accept(receipt, signal);
      for (const entry of operations.getSnapshot().recovery) {
        if (entry.status === "rejected" && entry.subjects.includes(subject) && entry.draft === input.value)
          operations.discard(entry.id);
      }
    },
  });
  try {
    return await attempt.result;
  } catch (error) {
    const failed = operations.getSnapshot().recovery.find((entry) => entry.id === attempt.id);
    if (failed?.status === "unknown" || failed?.status === "unconfirmed") throw new UnconfirmedFileSaveError();
    throw error;
  }
};

export const prepareFileRendererSave =
  (input: {
    queries: ScopedQueryClient;
    scope: Partial<QueryScope>;
    contribution: RegisteredFileRendererContribution;
    resource?: ResourceRef;
    pageParams?: PageParams;
    loadKey: string;
    readBaseline(): FileRendererContent | undefined;
    available(): boolean;
    accept(receipt: FileSaveReceipt, value: string): void;
  }) =>
  (value: string, origin: FileRendererRefreshOrigin) => {
    const { queries, scope, contribution, resource } = input;
    const lease = new AbortController();
    const stop = queries.isDisposed()
      ? undefined
      : queries.subscribeScopeRetirement((retired) => {
          if (matchesFileScope(scope, retired)) lease.abort();
        });
    return async () => {
      try {
        const { accountId, accountOrigin, runtimeId } = scope;
        if (
          !stop ||
          !input.available() ||
          lease.signal.aborted ||
          !matchesFileScope(queries.getScope(), { accountId, accountOrigin, runtimeId })
        )
          throw new Error("The original file is no longer active.");
        const baseline = input.readBaseline();
        const saved = await saveWithDocumentRecovery({
          queries,
          scope,
          loadKey: input.loadKey,
          source: resource,
          title: `Save ${resource?.label ?? baseline?.fileName ?? contribution.title}`,
          value,
          filePath: baseline?.filePath,
          write: (signal) =>
            saveLoadedFile(contribution, resource, value, origin, baseline, AbortSignal.any([signal, lease.signal])),
          async read(signal) {
            const content = await contribution.load(resource, signal, input.pageParams);
            return { content, result: content.revision ? { revision: content.revision } : undefined };
          },
          accept(receipt) {
            if (!lease.signal.aborted && input.available()) input.accept(receipt, value);
          },
        });
        return saved.result;
      } finally {
        stop?.();
      }
    };
  };
