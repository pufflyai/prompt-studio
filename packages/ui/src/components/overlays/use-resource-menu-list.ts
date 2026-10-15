import { useEffect, useRef, useState } from "react";
import type { ResourceActionList, ResourceContextAction } from "./resource-context-menu";

export const useResourceMenuList = (source: ResourceActionList, query: string) => {
  const [state, setState] = useState({
    sourceId: source.id,
    query,
    items: [] as ResourceContextAction[],
    loading: true,
    error: "",
    more: true,
  });
  const currentState = useRef(state);
  const loadMore = useRef(() => {});
  useEffect(() => {
    const controller = new AbortController();
    const previous = currentState.current;
    const retained = previous.sourceId === source.id && previous.query === query ? previous.items : [];
    const items: ResourceContextAction[] = [];
    let cursor: string | undefined;
    let loading = false;
    let more = true;
    const publish = (next: typeof state) => {
      currentState.current = next;
      setState(next);
    };
    const fail = (error: unknown, visible: ResourceContextAction[]) => {
      if (controller.signal.aborted) return;
      publish({
        sourceId: source.id,
        query,
        items: visible,
        loading: false,
        more,
        error: error instanceof Error ? error.message : "Could not load results.",
      });
    };
    const readWindow = async (refresh: boolean) => {
      do {
        const page = await source.loadPage({ query, cursor, signal: controller.signal });
        if (controller.signal.aborted) return;
        const seen = new Set(items.map((item) => item.key));
        for (const item of page.items) {
          if (!seen.has(item.key)) items.push(item);
          seen.add(item.key);
        }
        cursor = page.nextCursor;
        more = cursor !== undefined;
      } while (refresh && more && items.length < retained.length);
    };
    const load = async (refresh = false) => {
      if (loading || !more || controller.signal.aborted) return;
      loading = true;
      const visible = refresh ? retained : items;
      publish({ sourceId: source.id, query, items: visible, loading, error: "", more });
      try {
        // Re-read the loaded window after live changes without removing its keyed rows.
        // A moving last-activity order cannot safely resume from an old cursor.
        await readWindow(refresh);
        if (controller.signal.aborted) return;
        publish({ sourceId: source.id, query, items: [...items], loading: false, error: "", more });
      } catch (error) {
        fail(error, visible);
      } finally {
        loading = false;
      }
    };
    loadMore.current = () => {
      void load(items.length < retained.length);
    };
    void load(true);
    return () => controller.abort();
  }, [source, query]);
  const current =
    state.sourceId === source.id && state.query === query ? state : { items: [], loading: true, error: "", more: true };
  return { ...current, loadMore: () => loadMore.current() };
};
