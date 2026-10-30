import { expect, test } from "bun:test";
import { nativePresenceLimits } from "pstdio-api-contracts";
import { createNativePresence } from "./presence";

const owner = { workbenchId: "project", extensionId: "example.notes" };
const documentKey = "a".repeat(64);
const seedId = "b".repeat(64);
const selection = { anchor: "AA==", head: "AQ==" };
const input = (roomId = crypto.randomUUID()) => ({
  owner,
  documentKey,
  roomId,
  seedId,
  label: "Franky",
  deviceName: "Laptop",
});

test("each editor connection gets transient presence and can update only its own room handle", () => {
  const frames: unknown[] = [];
  const hub = createNativePresence({
    deviceId: "local",
    send: (_owner, frame) => {
      frames.push(frame);
    },
  });
  const firstInput = input();
  const first = hub.open(firstInput);
  const secondInput = input();
  const second = hub.open(secondInput);
  first.update({ roomId: firstInput.roomId, seedId, selection });
  expect(hub.snapshot({ owner, documentKey })).toHaveLength(2);
  expect(
    hub.snapshot({ owner, documentKey }).find((participant) => participant.participantId === first.participantId)
      ?.selection,
  ).toEqual(selection);
  expect(() => first.update({ roomId: secondInput.roomId, seedId, selection })).toThrow("not found");
  first.close();
  expect(hub.snapshot({ owner, documentKey }).map((participant) => participant.participantId)).toEqual([
    second.participantId,
  ]);
  second.close();
  expect(hub.snapshot({ owner, documentKey })).toEqual([]);
  expect(frames).toHaveLength(5);
});

test("presence lease expiry and heartbeats use local receipt time and leave no retained participants", () => {
  let now = 0;
  const hub = createNativePresence({ deviceId: "local", now: () => now, send: () => {} });
  const opened = input();
  const connection = hub.open(opened);
  hub.receive(owner.workbenchId, "peer-device", {
    kind: "native-document-presence",
    version: 1,
    action: "upsert",
    extensionId: owner.extensionId,
    documentKey,
    participantId: crypto.randomUUID(),
    seedId,
    label: "Peer",
    deviceName: "Desktop",
    selection,
  });
  now = 20_000;
  connection.update({ roomId: opened.roomId, seedId, selection: null });
  now = nativePresenceLimits.leaseMs;
  hub.expire();
  expect(hub.snapshot({ owner, documentKey }).map((participant) => participant.deviceId)).toEqual(["local"]);
  now = 50_000;
  hub.expire();
  expect(hub.snapshot({ owner, documentKey })).toEqual([]);
  connection.close();
});

test("unknown rooms, wrong projects and invalid oversized presence do not enter a joined room", () => {
  const hub = createNativePresence({ deviceId: "local", send: () => {} });
  const connection = hub.open(input());
  const frame = {
    kind: "native-document-presence",
    version: 1,
    action: "upsert",
    extensionId: owner.extensionId,
    documentKey,
    participantId: crypto.randomUUID(),
    seedId,
    label: "Peer",
    deviceName: "Desktop",
    selection,
  };
  hub.receive("another-project", "peer", frame);
  hub.receive(owner.workbenchId, "peer", { ...frame, documentKey: "c".repeat(64) });
  expect(() => hub.receive(owner.workbenchId, "peer", { ...frame, label: "x".repeat(65) })).toThrow();
  expect(() =>
    hub.receive(owner.workbenchId, "peer", { ...frame, selection: { anchor: "AAAA".repeat(2000), head: "AA==" } }),
  ).toThrow();
  expect(hub.snapshot({ owner, documentKey })).toHaveLength(1);
  connection.close();
});

test("one project transport shares its 32-room capacity across extensions and releases it on close", () => {
  const hub = createNativePresence({ deviceId: "local", send: () => {} });
  const connections = Array.from({ length: 32 }, (_, index) =>
    hub.open({
      ...input(),
      owner: { ...owner, extensionId: index % 2 ? "example.planner" : owner.extensionId },
      documentKey: index.toString(16).padStart(64, "0"),
    }),
  );
  expect(() => hub.open(input())).toThrow("room limit");
  connections[0]!.close();
  const replacement = hub.open(input());
  replacement.close();
  for (const connection of connections) connection.close();
});
