import { createScopedQueryClient, type ResourceRef } from "@pstdio/sdk/extensions";
import { createDisposable } from "../../shared/disposable";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { classifyApiWrite } from "../mutations/operation-failures";
import type { OperationPreview } from "../mutations/operation-types";
import { getWorkbenchOperations, resourceOperationSubject, type WorkbenchOperations } from "../mutations/operations";

export type ResourceChange =
  | { label: string }
  | { removed: true; label?: never }
  | { archived: true; attributeId: string; value: string; label?: never };
interface ResourceIntent {
  resource: ResourceRef;
  change: ResourceChange;
}

export type ResourcePreviewChanges = ReadonlyMap<symbol, ResourceIntent>;
const domain = "resource.presentation";

const pendingResourceIntent = (entry: OperationPreview) => {
  if (entry.domain !== domain || !entry.intent) return undefined;
  const intent = entry.intent as ResourceIntent;
  return "archived" in intent.change && entry.status === "unknown" ? undefined : intent;
};

const removalObservers = new WeakMap<object, (resource: ResourceRef) => void>();
export const observeResourceRemoval = (preview: object, resource: ResourceRef) =>
  removalObservers.get(preview)?.(resource);

export const resolveResourcePreview = (resource: ResourceRef, changes: ResourcePreviewChanges) => {
  let result: ResourceRef | undefined = resource;
  const subject = resourceOperationSubject(resource);
  for (const intent of changes.values()) {
    if (resourceOperationSubject(intent.resource) !== subject) continue;
    if (!result || "removed" in intent.change) result = undefined;
    else if ("archived" in intent.change) result = { ...result, metadata: { ...result.metadata, archived: true } };
    else result = { ...result, label: intent.change.label };
  }
  return result;
};

const createPreview = (operations: WorkbenchOperations) => {
  const store = createWorkbenchStore<{ changes: ResourcePreviewChanges }>({
    name: "workbench.resource-preview",
    initialState: { changes: new Map() },
  });
  const refreshers = new Set<(resource: ResourceRef, change: ResourceChange) => Promise<void>>();
  const local = new Map<symbol, ResourceIntent>();
  const removals = new Map<symbol, { subject: string; observed: boolean; uncertain: boolean }>();
  const publish = () => {
    const changes = new Map(local);
    const { pending } = operations.getSnapshot();
    const retired = new Set(removals.keys());
    for (const entry of pending) {
      retired.delete(entry.id);
      const intent = pendingResourceIntent(entry);
      if (!intent) continue;
      const removal = removals.get(entry.id);
      if (removal && entry.status === "unknown") removal.uncertain = true;
      if (!removal?.uncertain || removal.observed) changes.set(entry.id, intent);
    }
    for (const id of retired) removals.delete(id);
    const previous = store.getState().changes;
    if (previous.size !== changes.size || [...changes].some(([id, intent]) => previous.get(id) !== intent)) {
      store.setState({ changes });
    }
  };
  operations.subscribe(publish);
  const refresh = async (resource: ResourceRef, change: ResourceChange) => {
    await Promise.all([...refreshers].map((read) => read(resource, change)));
  };
  const assertCanRename = (subject: string) => {
    const blocked = operations
      .getSnapshot()
      .pending.some(
        (entry) => (entry.status === "unknown" || entry.status === "unconfirmed") && entry.subjects.includes(subject),
      );
    if (blocked) throw new Error("A previous change needs attention in System activity.");
  };
  const submit = <T>(
    resource: ResourceRef,
    save: (signal: AbortSignal) => Promise<T>,
    change?: ResourceChange,
    title?: string,
    verifyRename?: (signal: AbortSignal) => Promise<boolean>,
    renameDraft?: string,
  ) => {
    const subject = resourceOperationSubject(resource);
    const removal = change && "removed" in change ? { subject, observed: false, uncertain: false } : undefined;
    const label = change?.label;
    if (label !== undefined) assertCanRename(subject);
    const draft = removal ? { id: resource.id, type: resource.type, label: resource.label } : (renameDraft ?? label);
    const attempt = operations.submit({
      domain,
      projectId: resource.projectId,
      subjects: [subject],
      title: title ?? resource.label ?? resource.type,
      source: resource,
      intent: change ? { resource, change } : undefined,
      draft,
      write: save,
      reconcile: change ? () => refresh(resource, change) : undefined,
      classify: classifyApiWrite,
      check:
        removal || verifyRename
          ? async (signal) => {
              const confirmed = removal ? removal.observed : await verifyRename?.(signal);
              return confirmed ? { status: "confirmed", result: undefined as T } : { status: "unknown" };
            }
          : undefined,
    });
    if (removal) {
      removals.set(attempt.id, removal);
      void attempt.result.catch(() => {
        if (removal.observed) void operations.check(attempt.id);
      });
    }
    return attempt.result;
  };

  const preview = {
    store,
    resolve(resource: ResourceRef) {
      return resolveResourcePreview(resource, store.getState().changes);
    },
    submit,
    persist: <T>(resource: ResourceRef, save: () => Promise<T>) => submit(resource, save),
    subscribeRefresh(read: (resource: ResourceRef, change: ResourceChange) => Promise<void>) {
      refreshers.add(read);
      return createDisposable(() => refreshers.delete(read));
    },
    begin(resource: ResourceRef, change: ResourceChange) {
      const token = Symbol("resource presentation");
      local.set(token, { resource, change });
      publish();
      const remove = () => {
        local.delete(token);
        publish();
      };
      return {
        rollback: remove,
        async commit() {
          // This API previews a change whose persistence is managed by its caller.
          await Promise.allSettled([...refreshers].map((read) => read(resource, change)));
          remove();
        },
      };
    },
  };
  removalObservers.set(preview, (resource) => {
    const subject = resourceOperationSubject(resource);
    for (const entry of operations.getSnapshot().pending) {
      const removal = removals.get(entry.id);
      if (entry.status === "queued" || !removal || removal.subject !== subject) continue;
      removal.observed = true;
      if (entry.status === "unknown") void operations.check(entry.id);
    }
  });
  return preview;
};

const previews = new WeakMap<WorkbenchOperations, ReturnType<typeof createPreview>>();
export const createResourcePreview = (
  operations = getWorkbenchOperations(
    createScopedQueryClient({ runtimeId: "resource-preview", extensionId: "pstdio" }),
  ),
) => {
  let preview = previews.get(operations);
  if (!preview) {
    preview = createPreview(operations);
    previews.set(operations, preview);
  }
  return preview;
};
