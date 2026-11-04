import { expect, test } from "bun:test";
import { createMemoryStorageDevice } from "./memory-storage";

const devices = () => {
  const first = createMemoryStorageDevice({
    deviceId: "laptop",
    extensionId: "example.logs",
    logs: ["comments", { name: "runs", writer: "device" }],
  });
  const second = createMemoryStorageDevice({
    deviceId: "desktop",
    workbenchId: first.workbenchId,
    extensionId: "example.logs",
    logs: ["comments", { name: "runs", writer: "device" }],
  });
  return [first, second] as const;
};

test("SDK logs mirror project relay order and independent device stream paging", async () => {
  const [first, second] = devices();
  await first.storage.log("comments").append("first", { id: "first" });
  await second.storage.log("comments").append("second", { id: "second" });
  await first.storage.log("runs").append("left", { id: "left" });
  await second.storage.log("runs").append("right", { id: "right" });
  await first.logs.merge(second.logs);
  for (const device of [first, second]) {
    expect((await device.storage.log("comments").read({ after: 0 })).entries.map((entry) => entry.id)).toEqual([
      "first",
      "second",
    ]);
    const log = device.storage.log("runs");
    const page = await log.read({ after: 0, limit: 1 });
    const next = await log.read({ after: page.cursor, limit: 1 });
    expect(new Set([...page.entries, ...next.entries].map((entry) => entry.id))).toEqual(new Set(["left", "right"]));
  }
});

test("the public two-device SDK helper applies log appends in its simulated relay order", async () => {
  const { createMemoryStorageDevices } = await import("./memory-storage-devices");
  const pair = await createMemoryStorageDevices({ logs: ["comments"] });
  await pair.devices[0].log("comments").append("left", { id: "left" });
  await pair.devices[1].log("comments").append("right", { id: "right" });
  await pair.merge();
  for (const device of pair.devices)
    expect((await device.log("comments").read({ after: 0 })).entries.map((entry) => entry.id)).toEqual([
      "left",
      "right",
    ]);
});
