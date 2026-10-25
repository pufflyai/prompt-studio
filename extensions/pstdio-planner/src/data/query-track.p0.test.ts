import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTag } from "./collections";
import { runTicketsQuery } from "./query";
import { putTicket, ticketContext } from "./ticket-context.fixture";
import type { StoredTag, Ticket } from "./types";

const ticket = (overrides: Partial<Ticket>): Ticket => ({
  id: crypto.randomUUID(),
  shorthand: "T-1",
  title: "Ticket",
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const track = (overrides: Partial<StoredTag> = {}): StoredTag => ({
  id: crypto.randomUUID(),
  name: "Track",
  type: "multi_select",
  sortOrder: 50,
  options: [
    { id: "track-product", name: "Product", color: "blue", sortOrder: 0, icon: null, description: null },
    { id: "track-platform", name: "Platform", color: "green", sortOrder: 1, icon: null, description: null },
  ],
  ...overrides,
});

describe("runTicketsQuery with a timeline Track that the timeline cannot use", () => {
  test.each([
    ["multi-select", [track()]],
    ["ambiguous", [track({ type: "single_select" }), track({ type: "single_select", sortOrder: 51 })]],
  ])("returns active and archived tickets when Track is %s", async (_case, tags) => {
    const storage = createMemoryStorage();
    for (const tag of tags) await putTag(storage, tag);
    await putTicket(storage, ticket({ shorthand: "T-1", tags: { [tags[0].id]: ["track-product", "track-platform"] } }));
    await putTicket(
      storage,
      ticket({
        shorthand: "T-2",
        sortOrder: 1,
        archived: true,
        tags: { [tags[0].id]: ["track-product", "track-platform"] },
      }),
    );

    const result = await runTicketsQuery({ ...ticketContext(storage), projectId: "proj-1" });

    expect(result.rows.map((row) => row.resource?.shorthand)).toEqual(["T-1", "T-2"]);
    expect(result.rows[0]?.attributes).toMatchObject({ milestone: "", milestoneState: "unscheduled" });
  });
});
