import { describe, expect, test } from "bun:test";
import { putStatus, putTicket, STATUSES_COLLECTION, statusesCollection, ticketsCollection } from "./data/collections";
import { createMemoryStorage } from "./data/memory-storage";
import { seedDefaultStatuses } from "./data/seed";
import type { StoredTicket } from "./data/types";
import { workspaceAutomationCommands } from "./workspace-automations";
import { readWorkspaceStatusData } from "./workspace-statuses/workspace-status";

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

const runReviewReadyAutomation = (storage: ReturnType<typeof createMemoryStorage>) =>
  workspaceAutomationCommands["workspaceStatus.set"].run({
    extensionId: "pstdio-planner",
    projectId: "project-1",
    params: { workspaceId: linkedWorkspace.id, status: "review-ready" },
    storage,
    sessions: {
      create: async () => {
        throw new Error("review session unavailable");
      },
    },
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

  test("returns automation errors after persisting a review-ready workspace status", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);

    const result = (await runReviewReadyAutomation(storage)) as {
      automation: { automated: boolean; error?: { message: string } };
    };

    const statuses = await readWorkspaceStatusData({ storage, workspaceIds: [linkedWorkspace.id] });
    expect(statuses.valuesByWorkspaceId[linkedWorkspace.id]?.status).toBe("review-ready");
    expect(result.automation).toEqual({
      automated: false,
      error: { message: "review session unavailable" },
    });
  });

  test("does not re-run the status automation when the workspace status is unchanged", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);

    let createdSessions = 0;
    const ctx = {
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: linkedWorkspace.id, status: "review-ready" },
      storage,
      sessions: {
        create: async () => {
          createdSessions += 1;
          return { id: `session-${createdSessions}` };
        },
      },
      workspaces: {
        get: async () => linkedWorkspace,
        list: async () => [linkedWorkspace],
      },
    } as never;

    await workspaceAutomationCommands["workspaceStatus.set"].run(ctx);
    await workspaceAutomationCommands["workspaceStatus.set"].run(ctx);

    expect(createdSessions).toBe(1);
  });

  test("returns review status resolution errors without failing the workspace status update", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await seedTicket(storage);
    failTicketStatusReads(storage);

    const result = (await runReviewedAutomation(storage)) as {
      automation: { automated: boolean; error?: { message: string } };
    };

    expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe("default-backlog");
    expect(result.automation).toEqual({
      automated: false,
      error: { message: "status storage unavailable" },
    });
  });
});
