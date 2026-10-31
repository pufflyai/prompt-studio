import { expect, test } from "bun:test";
import { createNativeSessionPresence } from "./session-presence";

test("a later device immediately receives existing peers without an unbounded reply loop", async () => {
  const first = createNativeSessionPresence({
    deviceId: "first-device",
    identity: async () => ({ label: "First", deviceName: "Laptop" }),
  });
  const second = createNativeSessionPresence({
    deviceId: "second-device",
    identity: async () => ({ label: "Second", deviceName: "Desktop" }),
  });
  const owner = { workbenchId: "project", extensionId: "example.notes" };
  const address = { owner, documentKey: "a".repeat(64) };
  const seedId = "b".repeat(64);
  let frames = 0;
  const stopFirst = first.live.subscribe(owner.workbenchId, (frame) => {
    frames++;
    second.live.receive(owner.workbenchId, "first-device", frame);
  });
  const stopSecond = second.live.subscribe(owner.workbenchId, (frame) => {
    frames++;
    first.live.receive(owner.workbenchId, "second-device", frame);
  });
  try {
    const roomId = crypto.randomUUID();
    const earlier = await first.join(address, { roomId, seedId });
    const later = await second.join(address, { roomId: crypto.randomUUID(), seedId });
    expect(earlier.snapshot()).toHaveLength(2);
    expect(later.snapshot()).toHaveLength(2);
    expect(frames).toBe(4);
    first.update({ roomId, participantId: earlier.participantId, seedId, selection: null });
    expect(frames).toBe(5);
  } finally {
    stopFirst();
    stopSecond();
    first.close();
    second.close();
  }
});
