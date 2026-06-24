import { describe, expect, test } from "bun:test";
import { putTicket } from "./data/collections";
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

const reviewedWorkspace = {
  id: "workspace-1",
  workspace_shorthand: "T-1_A1",
  anchors_json: [],
};

const pendingWorkspace = {
  id: "workspace-2",
  workspace_shorthand: "T-1_A2",
  anchors_json: [],
};

describe("workspace ready-to-merge automations", () => {
  test("waits for every linked workspace before notifying that a ticket is ready to merge", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);
    const notifications: unknown[] = [];

    await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: reviewedWorkspace.id, status: "reviewed" },
      notify: {
        action: async (input: unknown) => {
          notifications.push(input);
          return {} as never;
        },
        resolve: async () => [],
      },
      storage,
      workspaces: {
        get: async () => reviewedWorkspace,
        list: async () => [reviewedWorkspace, pendingWorkspace],
      },
    } as never);

    expect(notifications).toEqual([]);
  });
});
