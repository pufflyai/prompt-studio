import type { QueryScope, ResourceRef } from "@pstdio/sdk/extensions";
import type {
  OperationInput,
  OperationPreview,
  OperationRecovery,
  OperationSnapshot,
  OperationSourceCommand,
} from "./operation-types";

export const retiredError = () => new Error("The original authority is no longer active.");

export interface Entry {
  owner: string;
  scope: Readonly<QueryScope>;
  preview: OperationPreview;
  controller: AbortController;
  execute?: () => Promise<void>;
  check?: () => Promise<void>;
  reject: (error: unknown) => void;
  source?: ResourceRef;
  sourceCommand?: OperationSourceCommand;
  draft?: unknown;
  describeRecovery?: () => string;
  releaseOnDiscard?: boolean;
  onDiscard?: () => void;
  acknowledged?: boolean;
  error?: unknown;
  dismissed: boolean;
}

export const emptySnapshot: OperationSnapshot = { pending: [], recovery: [] };

export const recoveryStatus = (status: OperationPreview["status"]) =>
  status === "unknown" || status === "rejected" || status === "unconfirmed" ? status : undefined;

export const changeStatus = (entry: Entry, status: OperationPreview["status"]) => {
  entry.preview = { ...entry.preview, status, intent: status === "rejected" ? undefined : entry.preview.intent };
};

export const retireEntry = (entry: Entry) => {
  const error = retiredError();
  entry.controller.abort(error);
  entry.preview = { ...entry.preview, intent: undefined };
  entry.execute = undefined;
  entry.check = undefined;
  const { status } = entry.preview;
  if (recoveryStatus(status)) return;

  const interrupted = entry.acknowledged ? "unconfirmed" : "unknown";
  changeStatus(entry, status === "queued" ? "rejected" : interrupted);
  entry.error = error;
  entry.reject(error);
};

export const initialPreview = <T>(
  input: OperationInput<T>,
  id: symbol,
  defaultProjectId?: string,
): OperationPreview => ({
  id,
  projectId: input.projectId ?? defaultProjectId,
  subjects: [...new Set(input.subjects)],
  title: input.title,
  domain: input.domain,
  intent: input.intent,
  status: "queued",
  startedAt: Date.now(),
  ...(input.showPending ? { showPending: true } : {}),
});

export const snapshotForOperations = (entries: Iterable<Entry>, owner: string): OperationSnapshot => {
  const pending: OperationPreview[] = [];
  const recovery: OperationRecovery[] = [];
  for (const entry of entries) {
    if (entry.owner !== owner) continue;
    const { preview } = entry;
    const status = recoveryStatus(preview.status);
    if (!entry.controller.signal.aborted && preview.status !== "rejected") pending.push(preview);
    if (status) {
      const { id, projectId, title, domain } = preview;
      recovery.push({
        id,
        subjects: preview.subjects,
        projectId,
        title,
        domain,
        source: entry.source,
        sourceCommand: entry.sourceCommand,
        draft: entry.draft,
        description: entry.describeRecovery?.(),
        status,
        error: entry.error,
        dismissed: entry.dismissed,
        canCheck: Boolean(entry.check) && !entry.controller.signal.aborted,
      });
    }
  }
  return { pending, recovery };
};
