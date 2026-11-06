import { expect, test } from "bun:test";
import { capacityControls } from "./capacity-controls";

test("offline limits remain unknown until observed and foreign controls cannot edit another device", () => {
  const unknown = capacityControls({ current: false, name: "Laptop", online: false, lastSeenAt: "Yesterday" });
  expect(unknown.find((field) => field.id === "limit")).toMatchObject({ type: "readOnly", value: "Unknown" });
  expect(unknown.every((field) => field.type === "readOnly")).toBe(true);
  expect(
    capacityControls({ current: false, name: "Laptop", online: false, lastLimit: null }).find(
      (field) => field.id === "limit",
    ),
  ).toMatchObject({ value: "Unlimited" });
  const local = capacityControls({
    current: true,
    name: "This device",
    online: true,
    capacity: { deviceId: "one", deviceName: "One", activeCount: 2, limit: 6 },
  });
  expect(local.find((field) => field.id === "limit")).toMatchObject({
    type: "number",
    defaultValue: 6,
    min: 1,
    step: 1,
  });
});

test("unlimited capacity hides usage and leaves the count behind a limit toggle", () => {
  const fields = capacityControls({
    current: true,
    name: "Local",
    online: true,
    capacity: { deviceId: "local", deviceName: "Local", activeCount: 0, limit: null },
  });
  expect(fields.find((field) => field.id === "active")).toBeUndefined();
  expect(fields.find((field) => field.id === "limited")).toMatchObject({ type: "boolean", defaultValue: false });
  expect(fields.find((field) => field.id === "limit")).toMatchObject({ enabledBy: "limited" });
});
