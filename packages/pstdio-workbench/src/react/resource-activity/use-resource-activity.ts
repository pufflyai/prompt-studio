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
  const [busy, setBusy] = useState(false);
  const alive = useRef(false);
  const busyNow = useRef(false);
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
  const action = async <T>(run: () => Promise<T>) => {
    if (busyNow.current) return;
    busyNow.current = true;
    setBusy(true);
    setError(undefined);
    try {
      return await run();
    } catch (error) {
      if (alive.current) setError(errorText(error));
    } finally {
      busyNow.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const attach = async (file: File) =>
    action(async () => {
      const attachment = await binding.api.attach(resource, {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        data: new Uint8Array(await file.arrayBuffer()),
      });
      const current = draftStore.get();
      changeDraft({ ...current, attachmentIds: [...current.attachmentIds, attachment.id], key: crypto.randomUUID() });
    });
  const publish = async (replyToId?: string) =>
    action(async () => {
      const input: PublishResourceActivity = {
        key: draft.key,
        kind: "comment",
        body: draft.body,
        attachmentIds: draft.attachmentIds,
        replyToId,
        target: replyToId ? undefined : draft.target,
      };
      const entry = await binding.api.publish(resource, input);
      if (draftStore.get().key === input.key) draftStore.set(emptyActivityDraft());
      try {
        if (entry.target) await binding.api.handoff(resource, entry.id);
      } finally {
        await refresh();
      }
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
    error,
    busy,
    refresh,
    action,
    publish,
    api: binding.api,
    resource,
  };
};
