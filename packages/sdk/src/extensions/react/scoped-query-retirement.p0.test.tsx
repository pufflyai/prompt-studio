import { expect, test } from "bun:test";
import { useLayoutEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createScopedQueryClient } from "../scoped-query";
import { useScopedQueries, useScopedQuery } from "./scoped-query";

test.each([
  "single",
  "multiple",
] as const)("%s query observation survives retirement before its first committed subscription", async (mode) => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createScopedQueryClient({ runtimeId: "layout", extensionId: "example" });
  let reads = 0;
  const query = root.query({ id: "data", read: () => ++reads });
  const Single = () => {
    useScopedQuery(query);
    return null;
  };
  const Multiple = () => {
    useScopedQueries([query]);
    return null;
  };
  const Parent = () => {
    useLayoutEffect(() => query.dispose(), []);
    return mode === "single" ? <Single /> : <Multiple />;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Parent />);
    });
    expect(query.isDisposed()).toBe(true);
    expect(query.inspect().automaticObservers).toBe(0);
    expect(reads).toBe(0);
  } finally {
    await act(async () => renderer?.unmount());
    root.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("an earlier source can retire a later handle before a shared selection subscribes to it", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createScopedQueryClient({ runtimeId: "source", extensionId: "example" });
  let sources = 0;
  let retiredReads = 0;
  const second = root.query({ id: "retired", read: () => ++retiredReads });
  const first = root.query({
    id: "live",
    read: () => 1,
    subscribe: () => {
      sources++;
      second.dispose();
      return () => {
        sources--;
      };
    },
  });
  const Capture = () => {
    useScopedQueries([first, second]);
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Capture />);
    });
    expect(sources).toBe(1);
    expect(first.getSnapshot().data).toBe(1);
    expect(retiredReads).toBe(0);
    await act(async () => renderer!.unmount());
    renderer = undefined;
    expect(sources).toBe(0);
  } finally {
    await act(async () => renderer?.unmount());
    root.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
