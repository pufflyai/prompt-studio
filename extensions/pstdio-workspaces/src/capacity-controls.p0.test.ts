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
