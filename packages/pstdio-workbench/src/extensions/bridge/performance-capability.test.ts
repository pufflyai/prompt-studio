import { expect, test } from "bun:test";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";

test("requires declared diagnostics access and releases the subscription on disconnect", async () => {
  let subscriptions = 0;
  const events = createHostEventPublisher();
  const capabilities = createExtensionWebviewHostCapabilities({
    hostEvents: events,
    performance: {
      state: async () => ({ enabled: false, host: "desktop" }),
      recordings: async () => null,
      retain: async () => async () => {},
      snapshot: async () => null,
      subscribe: () => {
        subscriptions++;
        return () => {
          subscriptions--;
        };
      },
      control: async () => {},
    },
  });
  const denied = createHostCapabilityGate({ capabilities, declaredCapabilities: [] });
  await expect(denied.call({ method: "performance.read", params: { operation: "snapshot" } })).rejects.toThrow();
  const allowed = createHostCapabilityGate({ capabilities, declaredCapabilities: ["performance.read"] });
  expect(await allowed.call({ method: "performance.read", params: { operation: "state" } })).toEqual({
    enabled: false,
    host: "desktop",
  });
  await allowed.call({ method: "performance.read", params: { operation: "subscribe" } });
  await allowed.call({ method: "performance.read", params: { operation: "subscribe" } });
  expect(subscriptions).toBe(1);
  events.unbind();
  expect(subscriptions).toBe(0);
});

test("disconnect releases an owned capture even when acquisition finishes later", async () => {
  const retained = Promise.withResolvers<() => Promise<void>>();
  let released = 0;
  const events = createHostEventPublisher();
  const capabilities = createExtensionWebviewHostCapabilities({
    hostEvents: events,
    performance: {
      state: async () => ({ enabled: true, host: "desktop" }),
      snapshot: async () => null,
      recordings: async () => null,
      subscribe: () => () => {},
      control: async () => {},
      retain: () => retained.promise,
    },
  });
  const allowed = createHostCapabilityGate({ capabilities, declaredCapabilities: ["performance.read"] });
  const starting = allowed.call({ method: "performance.read", params: { operation: "retain" } });
  events.unbind();
  retained.resolve(async () => {
    released++;
  });
  await starting;
  await Promise.resolve();
  expect(released).toBe(1);
});

test("releasing a capture preserves subscriptions through the next capture", async () => {
  const listeners = new Set<(snapshot: null) => void>();
  const delivered: unknown[] = [];
  const events = createHostEventPublisher();
  events.bind((message) => delivered.push(message.payload));
  const capabilities = createExtensionWebviewHostCapabilities({
    hostEvents: events,
    performance: {
      state: async () => ({ enabled: true, host: "desktop" }),
      snapshot: async () => null,
      recordings: async () => null,
      control: async () => {},
      retain: async () => async () => {},
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  const allowed = createHostCapabilityGate({ capabilities, declaredCapabilities: ["performance.read"] });
  const call = (operation: string) => allowed.call({ method: "performance.read", params: { operation } });
  await call("subscribe");
  await call("retain");
  await call("dispose");
  await call("retain");
  for (const listener of listeners) listener(null);
  expect(delivered).toEqual([null]);
  events.unbind();
  expect(listeners.size).toBe(0);
});
