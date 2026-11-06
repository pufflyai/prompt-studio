import { expect, test } from "bun:test";
import { capacityView } from "./settings";

test("device details retain an offline history device's identity when Cloud omits it", async () => {
  const ctx = {
    account: { devices: async () => [] },
    workspaces: {
      getCapacity: async () => ({ deviceId: "local", deviceName: "This Mac", limit: 6, activeCount: 0 }),
      list: async () => [{ device: { id: "foreign", name: "Offline Laptop" }, updatedAt: "2026-11-01" }],
    },
    settings: { get: async () => ({}) },
  };
  const body = capacityView.body as {
    query: (ctx: unknown, input: unknown) => Promise<{ params: { id: string; value?: unknown }[]; readOnly: boolean }>;
  };
  const result = await body.query(ctx, { renderer: { pageParams: { "device-id": "foreign" } } });
  expect(result.readOnly).toBe(true);
  expect(result.params.find((field) => field.id === "device")?.value).toBe("Offline Laptop");
  const unknown = await body.query(ctx, { renderer: { pageParams: { "device-id": "unknown" } } });
  expect(unknown.params.find((field) => field.id === "device")?.value).toBe("Unknown device");
});
