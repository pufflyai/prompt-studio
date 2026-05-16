import { describe, expect, test } from "bun:test";
import { createWorkbenchStore } from "./workbench-store";

interface Counter {
  count: number;
  label: string;
}

describe("createWorkbenchStore", () => {
  test("returns the current state via getState", () => {
    const store = createWorkbenchStore<Counter>({ initialState: { count: 0, label: "zero" } });

    expect(store.getState()).toEqual({ count: 0, label: "zero" });
  });

  test("notifies subscribers when state changes", () => {
    const store = createWorkbenchStore<Counter>({ initialState: { count: 0, label: "zero" } });
    const events: Array<{ state: Counter; previous: Counter }> = [];

    const unsubscribe = store.subscribe((state, previous) => {
      events.push({ state, previous });
    });

    store.setState({ count: 1, label: "one" });
    store.setState({ count: 2, label: "two" });

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ state: { count: 1, label: "one" }, previous: { count: 0, label: "zero" } });
    expect(events[1]).toEqual({ state: { count: 2, label: "two" }, previous: { count: 1, label: "one" } });

    unsubscribe();
    store.setState({ count: 3, label: "three" });

    expect(events).toHaveLength(2);
  });

  test("emits selector listener only when the selected slice changes", () => {
    const store = createWorkbenchStore<Counter>({ initialState: { count: 0, label: "zero" } });
    const counts: number[] = [];

    const unsubscribe = store.subscribeSelector(
      (state) => state.count,
      (value) => {
        counts.push(value);
      },
    );

    store.setState({ count: 0, label: "still-zero" });
    store.setState({ count: 1, label: "one" });
    store.setState({ count: 1, label: "renamed" });
    store.setState({ count: 2, label: "two" });

    expect(counts).toEqual([1, 2]);

    unsubscribe();
  });

  test("can fire selector listener immediately", () => {
    const store = createWorkbenchStore<Counter>({ initialState: { count: 7, label: "seven" } });
    const seen: number[] = [];

    const unsubscribe = store.subscribeSelector(
      (state) => state.count,
      (value) => {
        seen.push(value);
      },
      { fireImmediately: true },
    );

    expect(seen).toEqual([7]);

    store.setState({ count: 8, label: "eight" });

    expect(seen).toEqual([7, 8]);

    unsubscribe();
  });
});
