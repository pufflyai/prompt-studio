import { type QueryScope, type ResourceRef, resourceKey, type ScopedQueryClient } from "@pstdio/sdk/extensions";
import {
  changeStatus,
  type Entry,
  emptySnapshot,
  initialPreview,
  recoveryStatus,
  retiredError,
  retireEntry,
  snapshotForOperations,
} from "./operation-state";
import type { OperationFailure, OperationInput, OperationPreview, OperationRead } from "./operation-types";

const operationLimit = 128;

export class OperationCapacityError extends Error {
  constructor() {
    super(
      "The workbench is holding its limit of pending changes and drafts. Finish a change or recover a draft to free space.",
    );
    this.name = "OperationCapacityError";
  }
}

export const operationSubject = (kind: string, ...identity: readonly (string | undefined)[]) =>
  JSON.stringify([kind, ...identity]);
export const resourceOperationSubject = (resource: ResourceRef) =>
  operationSubject("resource", resourceKey(resource), resource.device?.ownerId, resource.device?.id);

export const operationAuthorityKey = (scope: Readonly<QueryScope>) =>
  JSON.stringify([scope.runtimeId, scope.accountOrigin ?? null, scope.accountId ?? null]);

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

const createRejectionReconciler = (
  entry: Entry,
  read: OperationInput<unknown>["reconcileRejection"],
  callbacks: { publish(): void; fail(entry: Entry, error: unknown, status: "rejected" | "unconfirmed"): void },
) => {
  const { signal } = entry.controller;
  const reconcile = async (error: unknown) => {
    if (signal.aborted) return;
    entry.acknowledged = true;
    entry.check = undefined;
    changeStatus(entry, "reconciling");
    callbacks.publish();
    try {
      signal.throwIfAborted();
      await read?.(error, signal);
    } catch (readError) {
      if (signal.aborted) return;
      entry.check = () => reconcile(error);
      return callbacks.fail(entry, readError, "unconfirmed");
    }
    if (!signal.aborted) callbacks.fail(entry, error, "rejected");
  };
  return reconcile;
};

const discardEntry = (entry: Entry, clearDraft: (entry: Entry) => void) => {
  entry.onDiscard?.();
  entry.onDiscard = undefined;
  clearDraft(entry);
};

const createWorkbenchOperations = (queries: ScopedQueryClient) => {
  let scope = queries.getScope();
  let owner = operationAuthorityKey(scope);
  let snapshot = emptySnapshot;
  const listeners = new Set<() => void>();
  const entries = new Map<symbol, Entry>();
  const reads = new Set<OperationRead>();
  let nextId = 0;

  const publish = () => {
    snapshot = queries.isDisposed() ? emptySnapshot : snapshotForOperations(entries.values(), owner);
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
        if (entry.owner !== owner || entry.controller.signal.aborted || entry.preview.status === "rejected") continue;
        const { subjects, status } = entry.preview;
        const available = subjects.every((subject) => !occupied.has(subject));
        // Queued multi-resource writes retain their place for every affected subject.
        for (const subject of subjects) occupied.add(subject);
        if (available && status === "queued") void entry.execute?.();
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
    owner = operationAuthorityKey(scope);
    for (const entry of entries.values()) {
      if (entry.controller.signal.aborted) continue;
      if (!Object.entries(retired).every(([key, value]) => entry.scope[key as keyof QueryScope] === value)) continue;
      retireEntry(entry);
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
        describeRecovery: input.describeRecovery,
        releaseOnDiscard: input.releaseOnDiscard,
        onDiscard: input.onDiscard,
        dismissed: false,
      };
      const signal = entry.controller.signal;
      const reconcile = async (value: T) => {
        if (signal.aborted) return;
        entry.acknowledged = true;
        changeStatus(entry, "reconciling");
        entry.check = undefined;
        publish();
        if (signal.aborted) return;
        try {
          if (input.reconcile) await input.reconcile(value, signal);
          signal.throwIfAborted();
          await refreshOperationReads(reads, entry.preview, signal, input.originatingRead);
        } catch (error) {
          if (signal.aborted) return;
          entry.check = () => reconcile(value);
          return fail(entry, error, "unconfirmed");
        }
        if (signal.aborted) return;
        finish(entry);
        result.resolve(value);
        input.onReconciled?.();
      };
      const reconcileRejection = createRejectionReconciler(entry, input.reconcileRejection, { publish, fail });
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
        if (signal.aborted) return;
        let value: T;
        try {
          value = await input.write(signal);
        } catch (error) {
          if (signal.aborted) return;
          const outcome = input.classify?.(error) ?? "unknown";
          if (outcome === "rejected") {
            if (input.reconcileRejection) return reconcileRejection(error);
            entry.check = undefined;
          }
          return fail(entry, error, outcome);
        }
        await reconcile(value);
      };
      entries.set(id, entry);
      publish();
      schedule();
      return {
        id,
        result: result.promise,
        updateDraft(draft: unknown) {
          if (
            entries.get(id) !== entry ||
            entry.draft === undefined ||
            entry.controller.signal.aborted ||
            entry.owner !== owner
          )
            return;
          entry.draft = draft;
          if (recoveryStatus(entry.preview.status)) publish();
        },
      };
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
      if (entry) discardEntry(entry, clearDraft);
    },
    async transfer(id: symbol, receive: (draft: unknown) => boolean | Promise<boolean>) {
      const entry = findRecovery(id);
      if (!entry || entry.draft === undefined) return false;
      const wasRetired = entry.controller.signal.aborted;
      if (!(await receive(entry.draft)) || findRecovery(id) !== entry || entry.controller.signal.aborted !== wasRetired)
        return false;
      clearDraft(entry);
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
