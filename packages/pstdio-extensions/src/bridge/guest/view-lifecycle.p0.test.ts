import { describe, expect, test } from "bun:test";
import { createPropsStore } from "./define-extension-view";
import { createViewLifecycle } from "./view-lifecycle";

describe("extension view ownership", () => {
  test("repeated initialization keeps one view subscribed until disposal", async () => {
    const props = createPropsStore(false);
    const openMenus = new Set<object>();
    const view = createViewLifecycle(async () => {
      const menu = {};
      const unsubscribe = props.subscribe((open) => {
        if (open) openMenus.add(menu);
        else openMenus.delete(menu);
      });
      return () => {
        unsubscribe();
        openMenus.delete(menu);
      };
    });

    await view.initialize();
    await view.initialize();
    props.set(true);
    expect(openMenus.size).toBe(1);
    view.dispose();
    expect(openMenus.size).toBe(0);
    props.set(true);
    expect(openMenus.size).toBe(0);
  });

  test("overlapping initialization waits for the same asynchronous mount", async () => {
    const ready = Promise.withResolvers<void>();
    const activeViews = new Set<object>();
    const view = createViewLifecycle(async () => {
      await ready.promise;
      const owner = {};
      activeViews.add(owner);
      return () => activeViews.delete(owner);
    });

    const first = view.initialize();
    const second = view.initialize();
    ready.resolve();
    await Promise.all([first, second]);
    expect(activeViews.size).toBe(1);
    view.dispose();
    expect(activeViews.size).toBe(0);
  });

  test("disposal releases a mount that is still loading", async () => {
    const ready = Promise.withResolvers<void>();
    const activeViews = new Set<object>();
    const view = createViewLifecycle(async () => {
      await ready.promise;
      const owner = {};
      activeViews.add(owner);
      return () => activeViews.delete(owner);
    });

    const loading = view.initialize();
    view.dispose();
    ready.resolve();
    await loading;
    expect(activeViews.size).toBe(0);
  });
});
