import { expect, test } from "bun:test";
import { defineExtensionView } from "./define-extension-view";

test("webview page client reads live host props and forwards param updates", async () => {
  let props = {
    pageLocation: { page: { kind: "page" as const, id: "board", extensionId: "acme" } },
    pageParams: { range: "now-1h" },
  };
  const listeners = new Set<(value: typeof props) => void>();
  const calls: unknown[] = [];
  let observed = 0;
  const view = defineExtensionView<typeof props>({
    render: async ({ page }) => {
      expect(page.location()).toEqual(props.pageLocation);
      expect(page.params()).toEqual(props.pageParams);
      const stop = page.subscribe(() => observed++);
      props = { ...props, pageParams: { range: "now-6h" } };
      for (const listener of listeners) listener(props);
      expect(page.params()).toEqual({ range: "now-6h" });
      expect(await page.updateParams({ range: null })).toEqual(props.pageLocation);
      stop();
    },
  });
  await view.mount(
    {} as HTMLElement,
    {
      call: async (...args: unknown[]) => {
        calls.push(args);
        return { location: props.pageLocation };
      },
    } as never,
    {
      get: () => props,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  );
  expect(observed).toBe(1);
  expect(calls).toEqual([["page.params.update", { params: { range: null } }]]);
  expect(listeners.size).toBe(0);
});
