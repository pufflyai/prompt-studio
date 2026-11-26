import type { ResourceActivityEntry, ResourceRef } from "@pstdio/sdk/extensions";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { WorkbenchCore } from "../../core";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
import { observeResourceActivity } from "./observe-resource-activity";
import { readActivityWindow } from "./read-activity-window";
import { useResourceActivityComposer } from "./use-resource-activity-composer";

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
  const composer = useResourceActivityComposer(workbench, binding, resource, {
    onPublished: () => refresh(),
    onAction: () => setError(undefined),
  });
  return {
    ...composer,
    composer,
    capabilities,
    items,
    cursor,
    unresolved,
    error: composer.error ?? error,
    actionError: composer.error,
    clearError: () => {
      composer.clearError();
      setError(undefined);
    },
    refresh,
    api: binding.api,
    resource,
  };
};
