import type { QueryScope, ResourceRef } from "@pstdio/sdk/extensions";
import type {
  OperationInput,
  OperationPreview,
  OperationRecovery,
  OperationRecoverySource,
  OperationSnapshot,
  ProjectRecoveryAvailability,
} from "./operation-types";

export const retiredError = () => new Error("The original authority is no longer active.");

export interface Entry {
  owner: string;
  scope: Readonly<QueryScope>;
  preview: OperationPreview;
  controller: AbortController;
  execute?: () => Promise<void>;
  check?: () => Promise<void>;
  completion: { promise: Promise<unknown>; reject: (reason: unknown) => void };
  source?: ResourceRef;
  sourceCommand?: OperationInput<unknown>["sourceCommand"];
  recoverySource?: OperationRecoverySource;
  draft?: unknown;
  describeRecovery?: () => string;
  recoveryFiles?: () => readonly File[];
  releaseOnDiscard?: boolean;
  onDiscard?: () => void;
  acknowledged?: boolean;
  error?: unknown;
  dismissed: boolean;
  projectUnavailable?: true;
}

export const emptySnapshot: OperationSnapshot = { pending: [], recovery: [] };

export const recoveryStatus = (status: OperationPreview["status"]) =>
  status === "unknown" || status === "rejected" || status === "unconfirmed" ? status : undefined;

export const findRecoveryEntry = (entry: Entry | undefined, owner: string, disposed: boolean) =>
  entry?.owner === owner && recoveryStatus(entry.preview.status) && !disposed ? entry : undefined;

export const waitForPendingOperations = async (
  entries: Iterable<Entry>,
  owner: string,
  matches: (operation: OperationPreview) => boolean,
) => {
  const pending = [...entries].filter(
    (entry) =>
      entry.owner === owner &&
      !entry.controller.signal.aborted &&
      !recoveryStatus(entry.preview.status) &&
      matches(entry.preview),
  );
  await Promise.all(pending.map((entry) => entry.completion.promise));
};

export const dismissOperationProgress = (entry: Entry | undefined, owner: string) => {
  if (entry?.owner !== owner || !entry.preview.showPending || recoveryStatus(entry.preview.status)) return false;
  entry.preview = { ...entry.preview, showPending: undefined };
  return true;
};

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
  entry.completion.reject(error);
};

export const retireOperations = (entries: Iterable<Entry>, retired: Partial<QueryScope>, returningOwner?: string) => {
  const fields = Object.entries(retired);
  for (const entry of entries) {
    if (entry.owner === returningOwner) entry.projectUnavailable = undefined;
    if (entry.controller.signal.aborted) continue;
    if (fields.every(([key, value]) => entry.scope[key as keyof QueryScope] === value)) retireEntry(entry);
  }
};

export const reconcileProjectAvailability = (
  entries: Iterable<Entry>,
  owner: string,
  isAvailable: ProjectRecoveryAvailability,
) => {
  let updated = false;
  for (const entry of entries) {
    const { projectId } = entry.preview;
    if (!projectId || !entry.controller.signal.aborted || entry.owner !== owner) continue;
    const available = isAvailable(projectId, entry.recoverySource);
    if (available === undefined) continue;
    const unavailable = available ? undefined : true;
    if (entry.projectUnavailable === unavailable) continue;
    entry.projectUnavailable = unavailable;
    updated = true;
  }
  return updated;
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

const recoverySourceCommand = ({ sourceCommand, error }: Entry) =>
  typeof sourceCommand === "function" ? sourceCommand(error) : sourceCommand;

export const snapshotForOperations = (entries: Iterable<Entry>, owner: string): OperationSnapshot => {
  const pending: OperationPreview[] = [];
  const recovery: OperationRecovery[] = [];
  for (const entry of entries) {
    if (entry.owner !== owner) continue;
    const { preview } = entry;
    const status = recoveryStatus(preview.status);
    const retired = entry.controller.signal.aborted;
    if (!retired && preview.status !== "rejected") pending.push(preview);
    if (status) {
      const { id, projectId, title, domain } = preview;
      recovery.push({
        id,
        subjects: preview.subjects,
        projectId,
        title,
        domain,
        source: entry.source,
        sourceCommand: recoverySourceCommand(entry),
        draft: entry.draft,
        description: entry.describeRecovery?.(),
        files: entry.recoveryFiles?.(),
        status,
        error: entry.error,
        dismissed: entry.dismissed,
        canCheck: Boolean(entry.check) && !retired,
        ...(retired ? { retired: true } : {}),
        ...(entry.projectUnavailable ? { projectUnavailable: true } : {}),
        ...(entry.acknowledged ? { acknowledged: true } : {}),
      });
    }
  }
  return { pending, recovery };
};
