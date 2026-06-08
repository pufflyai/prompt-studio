import { describe, expect, test } from "bun:test";
import { putTicket, ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import type { StoredTicket } from "../data/types";
import { archiveTicketCommand } from "./archive-ticket";

const now = "2026-06-08T10:00:00.000Z";

const seedTicket = (storage: ReturnType<typeof createMemoryStorage>) =>
  putTicket(storage, {
    id: "ticket-1",
    shorthand: "T-1",
    title: "Ticket",
    content: "# Ticket",
    statusId: "default-backlog",
    tagIds: [],
    attachments: [],
    files: [],
    parentId: null,
    dependsOn: null,
    blockedReason: null,
    userPrompt: null,
    parallelizable: null,
    draft: false,
    archived: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  } satisfies StoredTicket);

const ticketAnchor = (shorthand: string, id: string) => ({
  type: "ticket",
  id,
  label: shorthand,
  metadata: { shorthand },
});

describe("archive ticket", () => {
  test("archives the ticket and cascades to its linked workspaces only", async () => {
    const storage = createMemoryStorage();
    await seedTicket(storage);

    const archived: string[] = [];
    const workspaces = [
      { id: "ws-1", workspace_shorthand: "T-1_A1", anchors_json: [ticketAnchor("T-1", "ticket-1")] },
      { id: "ws-2", workspace_shorthand: "T-1_A2", anchors_json: [ticketAnchor("T-1", "ticket-1")] },
      { id: "ws-other", workspace_shorthand: "T-2_A1", anchors_json: [ticketAnchor("T-2", "ticket-2")] },
    ];

    const result = (await archiveTicketCommand.run({
      storage,
      params: { id: "T-1" },
      workspaces: {
        list: async () => workspaces,
        archive: async (id: string) => {
          archived.push(id);
        },
      },
    } as never)) as StoredTicket | null;

    expect(result?.archived).toBe(true);
    expect((await ticketsCollection(storage).get("ticket-1"))?.archived).toBe(true);
    expect(archived.sort()).toEqual(["ws-1", "ws-2"]);
  });
});
