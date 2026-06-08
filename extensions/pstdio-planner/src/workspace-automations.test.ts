import { describe, expect, test } from "bun:test";
import { putStatus, putTicket, STATUSES_COLLECTION, statusesCollection, ticketsCollection } from "./data/collections";
import { createMemoryStorage } from "./data/memory-storage";
import { seedDefaultStatuses } from "./data/seed";
import type { StoredTicket } from "./data/types";
import { workspaceAutomationCommands } from "./workspace-automations";

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

const linkedWorkspace = {
  id: "workspace-1",
  workspace_shorthand: "T-1_A1",
  ticket_shorthand: "T-1",
  anchors_json: [],
};

const runReviewedAutomation = (storage: ReturnType<typeof createMemoryStorage>) =>
  workspaceAutomationCommands["workspaceStatus.set"].run({
    extensionId: "pstdio-planner",
    projectId: "project-1",
    params: { workspaceId: linkedWorkspace.id, status: "reviewed" },
    storage,
    workspaces: {
      get: async () => linkedWorkspace,
      list: async () => [linkedWorkspace],
    },
  } as never);

const failTicketStatusReads = (storage: ReturnType<typeof createMemoryStorage>) => {
  const originalCollection = storage.collection.bind(storage);
  storage.collection = ((name: string) => {
    const collection = originalCollection(name);
    if (name !== STATUSES_COLLECTION) return collection;

    return {
      ...collection,
      async list() {
        throw new Error("status storage unavailable");
      },
    };
  }) as typeof storage.collection;
};

describe("workspace status automations", () => {
  test("falls back to a lowercase review ticket status when In Review is unavailable", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await statusesCollection(storage).delete("default-in-review");
    await putStatus(storage, {
      id: "custom-review",
      name: "review",
      color: "amber",
      sortOrder: 10,
      isDefault: false,
      canCreate: false,
      canDragIn: true,
      canDragOut: true,
      columnActions: [],
    });
    const ticket = await seedTicket(storage);

    await runReviewedAutomation(storage);

    expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe("custom-review");
  });

  test("propagates storage errors while resolving the review ticket status", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await seedTicket(storage);
    failTicketStatusReads(storage);

    await expect(runReviewedAutomation(storage)).rejects.toThrow("status storage unavailable");
    expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe("default-backlog");
  });
});
