import type { PublishResourceActivity, ResourceActivityEntry, ResourceRef } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
import { observeResourceActivity } from "./observe-resource-activity";
import { readActivityWindow } from "./read-activity-window";
import { type ActivityDraft, emptyActivityDraft, resourceActivityDraft } from "./resource-activity-drafts";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
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
  const loading = useRef(false);
  const sequence = useRef(0);
  const refresh = async (more = false) => {
    if (loading.current && more) return;
    loading.current = true;
    const request = ++sequence.current;
    try {
      const [page, permission] = await Promise.all([
        readActivityWindow(binding, resource, {
          cursor: more ? (cursor ?? undefined) : undefined,
          count: more ? 50 : Math.max(50, items.length),
        }),
        binding.api.capabilities(resource),
      ]);
      if (!alive.current || request !== sequence.current) return;
      setItems((current) =>
        [...new Map([...current, ...page.items].map((entry) => [entry.id, entry])).values()].sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
        ),
      );
      setCapabilities(permission ?? {});
      setCursor(page.nextCursor);
      setUnresolved(page.unresolved);
      setError(undefined);
    } catch (error) {
      if (alive.current) setError(errorText(error));
    } finally {
      loading.current = false;
    }
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
