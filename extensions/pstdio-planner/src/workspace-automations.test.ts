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

const noopNotify = {
  action: async () => ({}) as never,
  dismiss: async () => [],
  resolve: async () => [],
  toast: async () => {},
};

const runReviewedAutomation = (storage: ReturnType<typeof createMemoryStorage>) =>
  workspaceAutomationCommands["workspaceStatus.set"].run({
    extensionId: "pstdio-planner",
    projectId: "project-1",
    params: { workspaceId: linkedWorkspace.id, status: "reviewed" },
    notify: noopNotify,
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
    notify: noopNotify,
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
      notify: noopNotify,
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

  test("creates a review-ready notification for linked workspaces", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);
    const notifications: unknown[] = [];

    await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: linkedWorkspace.id, status: "review-ready" },
      notify: {
        ...noopNotify,
        action: async (input: unknown) => {
          notifications.push(input);
          return {} as never;
        },
      },
      storage,
      sessions: {
        create: async () => ({ id: "review-session-1" }),
      },
      workspaces: {
        get: async () => linkedWorkspace,
        list: async () => [linkedWorkspace],
      },
    } as never);

    expect(notifications).toEqual([
      expect.objectContaining({
        dedupeKey: "pstdio-planner:workspace:workspace-1:review-ready",
        kind: "needs_review",
        priority: "high",
        title: "Review ready: T-1",
        target: expect.objectContaining({ id: "workspace-1", type: "workspace" }),
      }),
    ]);
  });

  test("keeps review-ready automation successful when durable notifications are unavailable", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);

    const result = await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: linkedWorkspace.id, status: "review-ready" },
      notify: { toast: async () => {} },
      storage,
      sessions: {
        create: async () => ({ id: "review-session-1" }),
      },
      workspaces: {
        get: async () => linkedWorkspace,
        list: async () => [linkedWorkspace],
      },
    } as never);

    expect(result).toMatchObject({ automation: { automated: true, reviewSessionId: "review-session-1" } });
  });

  test("resolves review-ready notifications when workspace review finishes", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);
    const resolutions: unknown[] = [];

    await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: linkedWorkspace.id, status: "reviewed" },
      notify: {
        ...noopNotify,
        resolve: async (input: unknown) => {
          resolutions.push(input);
          return [];
        },
      },
      storage,
      workspaces: {
        get: async () => linkedWorkspace,
        list: async () => [linkedWorkspace],
      },
    } as never);

    expect(resolutions).toEqual([
      {
        dedupeKey: "pstdio-planner:workspace:workspace-1:review-ready",
        status: "done",
      },
    ]);
  });

  test("creates ready-to-merge notifications when workspace review finishes", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);
    const notifications: unknown[] = [];

    await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: linkedWorkspace.id, status: "reviewed" },
      notify: {
        ...noopNotify,
        action: async (input: unknown) => {
          notifications.push(input);
          return {} as never;
        },
      },
      storage,
      workspaces: {
        get: async () => linkedWorkspace,
        list: async () => [linkedWorkspace],
      },
    } as never);

    expect(notifications).toEqual([
      expect.objectContaining({
        dedupeKey: "pstdio-planner:ticket:T-1:ready-to-merge",
        kind: "ready_to_merge",
        priority: "high",
        target: expect.objectContaining({ id: "ticket-1", type: "ticket" }),
      }),
    ]);
  });

  test("resolves ready-to-merge notifications when workspace is merged", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);
    const resolutions: unknown[] = [];

    await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: linkedWorkspace.id, status: "merged" },
      notify: {
        ...noopNotify,
        resolve: async (input: unknown) => {
          resolutions.push(input);
          return [];
        },
      },
      storage,
      workspaces: {
        get: async () => linkedWorkspace,
        list: async () => [linkedWorkspace],
      },
    } as never);

    expect(resolutions).toEqual([{ dedupeKey: "pstdio-planner:ticket:T-1:ready-to-merge", status: "done" }]);
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
