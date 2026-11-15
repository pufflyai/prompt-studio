import { expect, test } from "bun:test";
import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useCollectionViewStore } from "./use-collection-view-store";
import { useCollectionViews } from "./use-collection-views";

test("collection queries wait for saved views and apply their filter before the first read", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const filters: unknown[] = [];
  const initialState = { settings: { grouping: "none" } };
  const focused = {
    conjunction: "and" as const,
    rules: [{ attributeId: "title", condition: "contains" as const, value: "Focus" }],
  };
  const Capture = ({ enabled }: { enabled: boolean }) => {
    const view = useCollectionViews({
      storageKey: "query-readiness",
      initialState,
      enabled,
      defaultViews: [{ id: "focused", title: "Focused", settings: initialState.settings, filter: focused, sorts: [] }],
    });
    const filter = useCollectionViewStore("query-readiness", initialState, (state) => state.filter);
    useEffect(() => {
      if (view.ready) filters.push(filter);
    }, [view.ready, filter]);
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Capture enabled={false} />);
    });
    expect(filters).toEqual([]);
    await act(async () => {
      renderer!.update(<Capture enabled />);
    });
    expect(filters).toEqual([focused]);
  } finally {
    await act(async () => renderer?.unmount());
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
