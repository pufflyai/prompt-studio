import { type QueryScope, type ResourceRef, resourceKey, type ScopedQueryClient } from "@pstdio/sdk/extensions";
import type {
  OperationFailure,
  OperationInput,
  OperationPreview,
  OperationRead,
  OperationRecovery,
  OperationSnapshot,
  OperationSourceCommand,
} from "./operation-types";

const operationLimit = 128;
const retiredError = () => new Error("The original authority is no longer active.");

export class OperationCapacityError extends Error {
  constructor() {
    super("Recover or discard a previous draft before submitting more work.");
    this.name = "OperationCapacityError";
  }
}

export const operationSubject = (kind: string, ...identity: readonly (string | undefined)[]) =>
  JSON.stringify([kind, ...identity]);
export const resourceOperationSubject = (resource: ResourceRef) =>
  operationSubject("resource", resourceKey(resource), resource.device?.ownerId, resource.device?.id);

const authorityKey = (scope: Readonly<QueryScope>) =>
  JSON.stringify([scope.runtimeId, scope.accountOrigin ?? null, scope.accountId ?? null]);

interface Entry {
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
  releaseOnDiscard?: boolean;
  error?: unknown;
  dismissed: boolean;
}

const emptySnapshot: OperationSnapshot = { pending: [], recovery: [] };

const recoveryStatus = (status: OperationPreview["status"]) =>
  status === "unknown" || status === "rejected" || status === "unconfirmed" ? status : undefined;

const changeStatus = (entry: Entry, status: OperationPreview["status"]) => {
  entry.preview = { ...entry.preview, status, intent: status === "rejected" ? undefined : entry.preview.intent };
};

const initialPreview = <T>(input: OperationInput<T>, id: symbol, defaultProjectId?: string): OperationPreview => ({
  id,
  projectId: input.projectId ?? defaultProjectId,
  subjects: [...new Set(input.subjects)],
  title: input.title,
  domain: input.domain,
  intent: input.intent,
  status: "queued",
  startedAt: Date.now(),
});

const refreshOperationReads = (
  reads: ReadonlySet<OperationRead>,
  preview: OperationPreview,
  signal: AbortSignal,
  originatingRead?: Pick<OperationRead, "key" | "refresh">,
) => {
  const affected = new Map<string, Pick<OperationRead, "key" | "refresh">>();
  for (const read of reads) if (!affected.has(read.key) && read.matches(preview)) affected.set(read.key, read);
  if (originatingRead && !affected.has(originatingRead.key)) affected.set(originatingRead.key, originatingRead);
  if (affected.size) return Promise.all([...affected.values()].map((read) => read.refresh(signal)));
  return undefined;
};

const createWorkbenchOperations = (queries: ScopedQueryClient) => {
  let scope = queries.getScope();
  let owner = authorityKey(scope);
  let snapshot = emptySnapshot;
  const listeners = new Set<() => void>();
  const entries = new Map<symbol, Entry>();
  const reads = new Set<OperationRead>();
  let nextId = 0;

  const publish = () => {
    const pending: OperationPreview[] = [];
    const recovery: OperationRecovery[] = [];
    for (const entry of entries.values()) {
      if (entry.owner !== owner || queries.isDisposed()) continue;
      const { preview } = entry;
      const status = recoveryStatus(preview.status);
      if (!entry.controller.signal.aborted && preview.status !== "rejected") pending.push(preview);
      if (status) {
        const { id, projectId, title, domain } = preview;
        recovery.push({
          id,
          projectId,
          title,
          domain,
          source: entry.source,
          sourceCommand: entry.sourceCommand,
          draft: entry.draft,
          status,
          error: entry.error,
          dismissed: entry.dismissed,
          canCheck: Boolean(entry.check) && !entry.controller.signal.aborted,
        });
      }
    }
    snapshot = { pending, recovery };
    for (const listener of listeners) listener();
  };

  let scheduled = false;
  const schedule = () => {
    if (scheduled || queries.isDisposed()) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const occupied = new Set<string>();
      for (const entry of entries.values()) {
        if (entry.owner !== owner || entry.preview.status === "rejected") continue;
        const { subjects, status } = entry.preview;
        const available = subjects.every((subject) => !occupied.has(subject));
        // Queued multi-resource writes retain their place for every affected subject.
        for (const subject of subjects) occupied.add(subject);
        if (available && status === "queued" && !entry.controller.signal.aborted) void entry.execute?.();
      }
    });
  };

  const finish = (entry: Entry) => {
    entries.delete(entry.preview.id);
    publish();
    schedule();
  };

  const fail = (entry: Entry, error: unknown, status: OperationFailure | "unconfirmed") => {
    changeStatus(entry, status);
    entry.error = error;
    entry.reject(error);
    publish();
    schedule();
  };

  queries.subscribeScopeRetirement((retired) => {
    scope = queries.getScope();
    owner = authorityKey(scope);
    for (const entry of entries.values()) {
      if (entry.controller.signal.aborted) continue;
      if (!Object.entries(retired).every(([key, value]) => entry.scope[key as keyof QueryScope] === value)) continue;
      const { status } = entry.preview;
      const error = retiredError();
      entry.controller.abort(error);
      entry.preview = { ...entry.preview, intent: undefined };
      entry.execute = undefined;
      entry.check = undefined;
      if (status === "queued" || status === "writing" || status === "reconciling") {
        changeStatus(entry, status === "queued" ? "rejected" : "unknown");
        entry.error = error;
        entry.reject(error);
      }
    }
    publish();
    schedule();
  });

  const findRecovery = (id: symbol) => {
    const entry = entries.get(id);
    if (entry?.owner === owner && recoveryStatus(entry.preview.status) && !queries.isDisposed()) return entry;
    return undefined;
  };

  const clearDraft = (entry: Entry) => {
    if (entry.preview.status === "rejected" || entry.releaseOnDiscard) {
      finish(entry);
    } else {
      entry.draft = undefined;
      entry.preview = { ...entry.preview, intent: undefined };
      entry.dismissed = true;
      publish();
    }
  };

  return {
    getSnapshot: () => snapshot,
    observeRead(read: OperationRead) {
      reads.add(read);
      return () => {
        reads.delete(read);
      };
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    submit<T>(input: OperationInput<T>) {
      if (queries.isDisposed()) throw retiredError();
      if (entries.size >= operationLimit) throw new OperationCapacityError();
      if (input.subjects.length === 0) throw new Error("An operation needs at least one subject.");
      const id = Symbol(`${input.domain}.${++nextId}`);
      const result = Promise.withResolvers<T>();
      const entry: Entry = {
        owner,
        scope: { ...scope, projectId: input.projectId ?? scope.projectId },
        controller: new AbortController(),
        preview: initialPreview(input, id, scope.projectId),
        reject: result.reject,
        source: input.source,
        sourceCommand: input.sourceCommand,
        draft: input.draft,
        releaseOnDiscard: input.releaseOnDiscard,
        dismissed: false,
      };
      const signal = entry.controller.signal;
      const reconcile = async (value: T) => {
        if (signal.aborted) return finish(entry);
        changeStatus(entry, "reconciling");
        entry.check = undefined;
        publish();
        if (signal.aborted) return finish(entry);
        try {
          if (input.reconcile) await input.reconcile(value, signal);
          signal.throwIfAborted();
          await refreshOperationReads(reads, entry.preview, signal, input.originatingRead);
        } catch (error) {
          if (signal.aborted) return finish(entry);
          entry.check = () => reconcile(value);
          return fail(entry, error, "unconfirmed");
        }
        finish(entry);
        result.resolve(value);
      };
      if (input.check) {
        const verify = input.check;
        const check = async () => {
          // Reuse the subject barrier and never replay the original executor.
          entry.check = undefined;
          changeStatus(entry, "reconciling");
          publish();
          const outcome = await Promise.resolve()
            .then(() => {
              signal.throwIfAborted();
              return verify(signal);
            })
            .catch((error: unknown) => ({ status: "unknown" as const, error }));
          if (signal.aborted) return;
          if (outcome.status === "confirmed") return reconcile(outcome.result);
          if (outcome.status === "rejected") return fail(entry, outcome.error, "rejected");
          entry.check = check;
          fail(entry, "error" in outcome ? outcome.error : entry.error, "unknown");
        };
        entry.check = check;
      }
      entry.execute = async () => {
        entry.execute = undefined;
        changeStatus(entry, "writing");
        publish();
        if (signal.aborted) {
          const error = signal.reason;
          return fail(entry, error, "rejected");
        }
        let value: T;
        try {
          value = await input.write(signal);
        } catch (error) {
          const outcome = input.classify?.(error) ?? "unknown";
          if (outcome === "rejected") entry.check = undefined;
          return fail(entry, error, outcome);
        }
        await reconcile(value);
      };
      entries.set(id, entry);
      publish();
      schedule();
      return { id, result: result.promise };
    },
    check(id: symbol) {
      const entry = findRecovery(id);
      if (entry && !entry.controller.signal.aborted) return entry.check?.();
    },
    dismiss(id: symbol) {
      const entry = findRecovery(id);
      if (!entry || entry.dismissed) return;
      entry.dismissed = true;
      publish();
    },
    discard(id: symbol) {
      const entry = findRecovery(id);
      if (entry) clearDraft(entry);
    },
    async transfer(id: symbol, receive: (draft: unknown) => boolean | Promise<boolean>) {
      const entry = findRecovery(id);
      if (!entry || entry.draft === undefined || !(await receive(entry.draft))) return false;
      if (entries.get(id) === entry) clearDraft(entry);
      return true;
    },
  };
};

const roots = new WeakMap<ScopedQueryClient, ReturnType<typeof createWorkbenchOperations>>();
export const getWorkbenchOperations = (queries: ScopedQueryClient) => {
  let operations = roots.get(queries);
  if (!operations) {
    operations = createWorkbenchOperations(queries);
    roots.set(queries, operations);
  }
  return operations;
};

export type WorkbenchOperations = ReturnType<typeof getWorkbenchOperations>;
