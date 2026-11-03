import { expect, test } from "bun:test";
import { createPresenceHub, type PresenceChange } from "./presence-hub";

const owner = { workbenchId: "project", extensionId: "example.icons" };
const address = { owner, resourceId: "icon-set" };
interface Selection {
  selectedIds: string[];
}

test("presence shares structured editor selections without a text document or durable storage", () => {
  const changes: PresenceChange<Selection>[] = [];
  const hub = createPresenceHub<Selection>({
    deviceId: "local",
    leaseMs: 30_000,
    maxRooms: 32,
    send: (_address, change) => {
      changes.push(change);
    },
  });
  const connection = hub.open(address, () => ({ selectedIds: ["home"] }));
  hub.receive(address, "peer", { action: "upsert", participantId: "peer-handle", value: { selectedIds: ["search"] } });
  expect(hub.snapshot(address).map((participant) => participant.value.selectedIds)).toEqual([["home"], ["search"]]);
  connection.update({ selectedIds: ["home", "close"] });
  expect(hub.snapshot(address)[0]?.value.selectedIds).toEqual(["home", "close"]);
  connection.close();
  expect(hub.snapshot(address)).toEqual([]);
  expect(changes.at(-1)).toEqual({ action: "leave", participantId: connection.participantId });
});

test("presence expires by receipt time and isolates resources and owners", () => {
  let now = 0;
  const hub = createPresenceHub<Selection>({
    deviceId: "local",
    leaseMs: 30_000,
    maxRooms: 32,
    now: () => now,
    send: () => {},
  });
  const local = hub.open(address, () => ({ selectedIds: [] }));
  const peer = { action: "upsert" as const, participantId: "peer", value: { selectedIds: ["home"] } };
  hub.receive({ ...address, owner: { ...owner, extensionId: "other" } }, "peer-device", peer);
  hub.receive({ ...address, resourceId: "other" }, "peer-device", peer);
  expect(hub.snapshot(address)).toHaveLength(1);
  hub.receive(address, "peer-device", peer);
  now = 20_000;
  local.update({ selectedIds: ["close"] });
  now = 30_000;
  hub.expire();
  expect(hub.snapshot(address).map((participant) => participant.deviceId)).toEqual(["local"]);
  local.close();
});
