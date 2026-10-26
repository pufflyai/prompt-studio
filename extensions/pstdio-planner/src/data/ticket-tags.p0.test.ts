import { describe, expect, test } from "bun:test";
import { createMemoryStorageDevices } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../commands/command-context.fixture";
import { setTicketAttributeCommand } from "../commands/set-ticket-attribute";
import { TAGS_COLLECTION, TICKETS_COLLECTION } from "./collections";
import { DEFAULT_TAGS } from "./seed";
import { seedTicketIdentity } from "./ticket-context.fixture";
import { ticketRecords } from "./ticket-records";
import type { StoredTag, StoredTicket } from "./types";

const option = (id: string, sortOrder: number) => ({
  id,
  name: id,
  color: "gray",
  sortOrder,
  icon: null,
  description: null,
});

const track: StoredTag = {
  id: "track",
  name: "Track",
  type: "single_select",
  sortOrder: 10,
  options: [option("api", 0), option("ui", 1)],
};
const flags: StoredTag = {
  id: "flags",
  name: "Flags",
  type: "multi_select",
  sortOrder: 11,
  options: [option("risky", 0), option("blocked-upstream", 1), option("needs-docs", 2)],
};

const ticket: StoredTicket = {
  id: "ticket",
  title: "Ticket",
  content: "# Ticket",
  statusId: "ready",
  tags: { "default-priority": "default-priority-low", flags: ["risky"] },
  archived: false,
  sortOrder: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const offlineDevices = async () => {
  const definitions = [...DEFAULT_TAGS.map((seed) => seed()), track, flags];
  const pair = await createMemoryStorageDevices({
    collections: {
      [TAGS_COLLECTION]: Object.fromEntries(definitions.map((tag) => [tag.id, tag])),
      [TICKETS_COLLECTION]: { [ticket.id]: ticket },
    },
  });
  for (const device of pair.devices) seedTicketIdentity(device, { id: ticket.id, shorthand: "T-1" });
  const set = (device: 0 | 1, attributeId: string, value: string | string[]) =>
    setTicketAttributeCommand.run(
      ...makeCommandArgs({ storage: pair.devices[device], params: { rowId: ticket.id, attributeId, value } }),
    );
  const tagsOn = async (device: 0 | 1) => (await ticketRecords(pair.devices[device]).get(ticket.id))?.tags;
  return { pair, set, tagsOn };
};

describe("tag edits from two offline devices", () => {
  test("a Priority change on one device and a Track change on the other both survive", async () => {
    const { pair, set, tagsOn } = await offlineDevices();

    await set(0, "priority", "default-priority-high");
    await set(1, "track", "ui");
    await pair.merge();

    for (const device of [0, 1] as const) {
      expect(await tagsOn(device)).toEqual({
        "default-priority": "default-priority-high",
        track: "ui",
        flags: ["risky"],
      });
    }
  });

  test("two different Track values end as one Track value, the same on both devices", async () => {
    const { pair, set, tagsOn } = await offlineDevices();

    await set(0, "track", "api");
    await set(1, "track", "ui");
    await pair.merge();

    const merged = await tagsOn(0);
    expect(["api", "ui"]).toContain(merged?.track as string);
    expect(await tagsOn(1)).toEqual(merged);
  });

  test("flags added on each device are both kept", async () => {
    const { pair, set, tagsOn } = await offlineDevices();

    await set(0, "flags", ["risky", "blocked-upstream"]);
    await set(1, "flags", ["risky", "needs-docs"]);
    await pair.merge();

    for (const device of [0, 1] as const) {
      expect(new Set((await tagsOn(device))?.flags)).toEqual(new Set(["risky", "blocked-upstream", "needs-docs"]));
    }
  });

  test("clearing every flag on one device keeps a flag that the other device adds", async () => {
    const { pair, set, tagsOn } = await offlineDevices();

    await set(0, "flags", []);
    await set(1, "flags", ["risky", "needs-docs"]);
    await pair.merge();

    for (const device of [0, 1] as const) expect((await tagsOn(device))?.flags).toEqual(["needs-docs"]);
  });
});
