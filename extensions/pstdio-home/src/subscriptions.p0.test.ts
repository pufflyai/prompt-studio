import { expect, test } from "bun:test";
import type { RendererEventReference } from "@pstdio/sdk/extensions";
import { subscribeHome } from "./subscriptions";

test("Home releases both project subscriptions on unmount before enabling a new instance", () => {
  const listeners = new Map<RendererEventReference, () => void>();
  const events = {
    subscribe(event: RendererEventReference, listener: () => void) {
      listeners.set(event, listener);
      return () => {
        listeners.delete(event);
      };
    },
  };
  let refreshes = 0;
  const first = subscribeHome(events, () => refreshes++);
  for (const listener of listeners.values()) listener();
  expect(refreshes).toBe(2);
  first();
  expect(listeners.size).toBe(0);
  const second = subscribeHome(events, () => refreshes++);
  expect(listeners.size).toBe(2);
  second();
  expect(listeners.size).toBe(0);
});
