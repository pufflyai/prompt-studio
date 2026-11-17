import { expect, test } from "bun:test";
import type { Fiber } from "bippy";
import { act, createElement, useEffect, useState } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { detectRenderInputChange } from "./render-input-change";

test("a stable effect does not hide a repeated update with unchanged inputs", async () => {
  let setCount: (value: number) => void = () => {};
  const Component = ({ label }: { label: string }) => {
    const [count, update] = useState(0);
    setCount = update;
    useEffect(() => {}, []);
    return createElement("span", null, label, count);
  };
  const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = env.IS_REACT_ACT_ENVIRONMENT;
  env.IS_REACT_ACT_ENVIRONMENT = true;
  let renderer: ReactTestRenderer | undefined;
  const inputs = () => detectRenderInputChange((renderer!.root as unknown as { _fiber: Fiber })._fiber);
  try {
    await act(() => {
      renderer = create(createElement(Component, { label: "a" }));
    });
    await act(() => renderer?.update(createElement(Component, { label: "a" })));
    expect(inputs()).toBe("unchanged");
    await act(() => renderer?.update(createElement(Component, { label: "b" })));
    expect(inputs()).toBe("changed");
    await act(() => setCount(1));
    expect(inputs()).toBe("changed");
  } finally {
    await act(() => renderer?.unmount());
    env.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
