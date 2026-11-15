import type { PublishResourceActivity, ResourceActivityEntry, ResourceRef } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
import { observeResourceActivity } from "./observe-resource-activity";
import { readActivityWindow } from "./read-activity-window";
import { type ActivityDraft, emptyActivityDraft, resourceActivityDraft } from "./resource-activity-drafts";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const mergeEntries = (current: ResourceActivityEntry[], incoming: ResourceActivityEntry[]) =>
  [...new Map([...current, ...incoming].map((entry) => [entry.id, entry])).values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
export const useResourceActivity = (
  workbench: WorkbenchCore,
  binding: ResourceActivityBinding,
  resource: ResourceRef,
  visible: boolean,
) => {
  const identity = resourceKey(resource);
  const draftStore = resourceActivityDraft(workbench, identity);
  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.get, draftStore.get);
  const [capabilities, setCapabilities] = useState<ResourceActivityBinding["capabilities"]>({});
  const [items, setItems] = useState<ResourceActivityEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unresolved, setUnresolved] = useState(0);
  const [error, setError] = useState<string>();
  const alive = useRef(false);
  const window = useRef({ items: [] as ResourceActivityEntry[], cursor: null as string | null });
  const queue = useRef(Promise.resolve());
  const queuedRefresh = useRef<Promise<boolean | undefined> | null>(null);
  const sequence = useRef(0);
  const read = async (more: boolean) => {
    if (!more) queuedRefresh.current = null;
    if (!alive.current) return;
    const request = ++sequence.current;
    const options = more
      ? { cursor: window.current.cursor ?? undefined, count: 50 }
      : { count: Math.max(50, window.current.items.length) };
    try {
      const [page, permission] = await Promise.all([
        readActivityWindow(binding, resource, options),
        binding.api.capabilities(resource),
      ]);
      if (!alive.current || request !== sequence.current) return;
      const next = mergeEntries(window.current.items, page.items);
      window.current = { items: next, cursor: page.nextCursor };
      setItems(next);
      setCapabilities(permission ?? {});
      setCursor(page.nextCursor);
      setUnresolved(page.unresolved);
      setError(undefined);
      return true;
    } catch (error) {
      if (alive.current) setError(errorText(error));
      return false;
    }
  };
  const refresh = (more = false): Promise<boolean | undefined> => {
    // Keep one queued reconciliation, and admit history after any active read.
    // Use the completed window's cursor/count rather than a stale render closure.
    if (!more && queuedRefresh.current) return queuedRefresh.current;
    const run = queue.current.then(() => read(more));
    queue.current = run.then(() => undefined);
    if (!more) queuedRefresh.current = run;
    return run;
  };
  const refreshEvent = useEffectEvent(() => refresh());
  useEffect(() => {
    alive.current = true;
    if (!visible)
      return () => {
        alive.current = false;
      };
    const controller = new AbortController();
    void refreshEvent();
    void observeResourceActivity(
      binding,
      resource,
      controller.signal,
      () => void refreshEvent(),
      (error) => setError(errorText(error)),
    );
    return () => {
      alive.current = false;
      sequence.current++;
      controller.abort();
    };
  }, [binding, visible, resource]);
  const changeDraft = (next: ActivityDraft) => draftStore.set(next);
  const action = async <T>(run: () => Promise<T>, upload?: string) => {
    const lease = draftStore.begin(upload);
    if (!lease) return;
    draftStore.setError(undefined);
    setError(undefined);
    try {
      return await run();
    } catch (error) {
      draftStore.setError(errorText(error));
    } finally {
      draftStore.finish(lease);
    }
  };
  const attach = async (input: File | File[]) => {
    const files = Array.isArray(input) ? input : [input];
    if (!files.length) return;
    return action(
      async () => {
        for (const file of files) {
          try {
            const attachment = await binding.api.attach(resource, {
              name: file.name,
              mimeType: file.type || "application/octet-stream",
              data: new Uint8Array(await file.arrayBuffer()),
            });
            const current = draftStore.get();
            changeDraft({ ...current, attachments: [...current.attachments, attachment], key: crypto.randomUUID() });
          } catch (error) {
            throw new Error(`Could not attach ${file.name}: ${errorText(error)}`);
          }
        }
      },
      files.length === 1 ? files[0]!.name : `${files.length} files`,
    );
  };
  const publish = async () =>
    action(async () => {
      const input: PublishResourceActivity = {
        key: draft.key,
        kind: "comment",
        body: draft.body,
        attachmentIds: draft.attachments.map((file) => file.id),
      };
      const entry = await binding.api.publish(resource, input);
      if (draftStore.get().key === input.key) draftStore.set(emptyActivityDraft());
      await refresh();
      return entry;
    });
  return {
    draft,
    capabilities,
    attach,
    changeDraft,
    items,
    cursor,
    unresolved,
    error: draftStore.error() ?? error,
    actionError: draftStore.error(),
    clearError: () => {
      draftStore.setError(undefined);
      setError(undefined);
    },
    busy: draftStore.busy(),
    uploading: draftStore.uploading(),
    refresh,
    action,
    publish,
    api: binding.api,
    resource,
  };
};
