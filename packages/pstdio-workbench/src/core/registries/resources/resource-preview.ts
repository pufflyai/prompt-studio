import { createScopedQueryClient, type ResourceRef } from "@pstdio/sdk/extensions";
import { createDisposable } from "../../shared/disposable";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { classifyApiWrite } from "../mutations/operation-failures";
import { getWorkbenchOperations, resourceOperationSubject, type WorkbenchOperations } from "../mutations/operations";

type ResourceChange = { label: string } | { removed: true };
interface ResourceIntent {
  resource: ResourceRef;
  change: ResourceChange;
}

export type ResourcePreviewChanges = ReadonlyMap<symbol, ResourceIntent>;

export const resolveResourcePreview = (resource: ResourceRef, changes: ResourcePreviewChanges) => {
  let result: ResourceRef | undefined = resource;
  const subject = resourceOperationSubject(resource);
  for (const intent of changes.values()) {
    if (resourceOperationSubject(intent.resource) !== subject) continue;
    result = "removed" in intent.change ? undefined : { ...resource, label: intent.change.label };
  }
  return result;
};

const createPreview = (operations: WorkbenchOperations) => {
  const store = createWorkbenchStore<{ changes: ResourcePreviewChanges }>({
    name: "workbench.resource-preview",
    initialState: { changes: new Map() },
  });
  const domain = "resource.presentation";
  const refreshers = new Set<(resource: ResourceRef) => Promise<void>>();
  const local = new Map<symbol, ResourceIntent>();
  const publish = () => {
    const changes = new Map(local);
    for (const entry of operations.getSnapshot().pending) {
      if (entry.domain === domain && entry.intent) changes.set(entry.id, entry.intent as ResourceIntent);
    }
    const previous = store.getState().changes;
    if (previous.size !== changes.size || [...changes].some(([id, intent]) => previous.get(id) !== intent)) {
      store.setState({ changes });
    }
  };
  operations.subscribe(publish);
  const refresh = async (resource: ResourceRef) => {
    await Promise.all([...refreshers].map((read) => read(resource)));
  };
  const submit = <T>(
    resource: ResourceRef,
    save: (signal: AbortSignal) => Promise<T>,
    change?: ResourceChange,
    title?: string,
  ) =>
    operations.submit({
      domain,
      projectId: resource.projectId,
      subjects: [resourceOperationSubject(resource)],
      title: title ?? resource.label ?? resource.type,
      source: resource,
      intent: change ? { resource, change } : undefined,
      draft: change && "label" in change ? change.label : undefined,
      write: save,
      reconcile: change ? () => refresh(resource) : undefined,
      classify: classifyApiWrite,
    }).result;

  return {
    store,
    resolve(resource: ResourceRef) {
      return resolveResourcePreview(resource, store.getState().changes);
    },
    submit,
    persist: <T>(resource: ResourceRef, save: () => Promise<T>) => submit(resource, save),
    subscribeRefresh(read: (resource: ResourceRef) => Promise<void>) {
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
          await Promise.allSettled([...refreshers].map((read) => read(resource)));
          remove();
        },
      };
    },
  };
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
