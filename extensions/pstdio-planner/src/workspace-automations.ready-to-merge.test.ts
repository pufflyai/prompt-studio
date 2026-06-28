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

  test("keeps the ready-to-merge notification visible when a reviewed sibling remains after one workspace merges", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);

    const mergedWorkspace = { ...reviewedWorkspace, id: "workspace-merging", workspace_shorthand: "T-1_A1" };
    const reviewedSibling = { ...reviewedWorkspace, id: "workspace-sibling", workspace_shorthand: "T-1_A2" };

    // Both workspaces start out reviewed.
    await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: reviewedSibling.id, status: "reviewed" },
      notify: { action: async () => ({}) as never, resolve: async () => [] },
      storage,
      workspaces: {
        get: async () => reviewedSibling,
        list: async () => [mergedWorkspace, reviewedSibling],
      },
    } as never);
    await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: mergedWorkspace.id, status: "reviewed" },
      notify: { action: async () => ({}) as never, resolve: async () => [] },
      storage,
      workspaces: {
        get: async () => mergedWorkspace,
        list: async () => [mergedWorkspace, reviewedSibling],
      },
    } as never);

    // Now merge one of them and capture what gets emitted.
    const notifications: unknown[] = [];
    const resolutions: unknown[] = [];
    await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: mergedWorkspace.id, status: "merged" },
      notify: {
        action: async (input: unknown) => {
          notifications.push(input);
          return {} as never;
        },
        resolve: async (input: unknown) => {
          resolutions.push(input);
          return [];
        },
      },
      storage,
      workspaces: {
        get: async () => mergedWorkspace,
        list: async () => [mergedWorkspace, reviewedSibling],
      },
    } as never);

    // The still-reviewed sibling means the ticket is still ready to merge.
    expect(notifications).toContainEqual(
      expect.objectContaining({ dedupeKey: "pstdio-planner:ticket:T-1:ready-to-merge", kind: "ready_to_merge" }),
    );
    expect(resolutions).not.toContainEqual({
      dedupeKey: "pstdio-planner:ticket:T-1:ready-to-merge",
      status: "done",
    });
  });

  test("still resolves the stale ready-to-merge notification when the downstream review session fails", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);
    const resolutions: unknown[] = [];

    const result = (await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: reviewedWorkspace.id, status: "review-ready" },
      notify: {
        action: async () => ({}) as never,
        resolve: async (input: unknown) => {
          resolutions.push(input);
          return [];
        },
      },
      sessions: {
        // The review session start fails, but the workspace status save has
        // already happened — the stale ready-to-merge cleanup must still run.
        create: async () => {
          throw new Error("review session unavailable");
        },
      },
      storage,
      workspaces: {
        get: async () => reviewedWorkspace,
        list: async () => [reviewedWorkspace],
      },
    } as never)) as { automation: { automated: boolean; error?: { message: string } } };

    expect(result.automation).toMatchObject({ automated: false, error: { message: "review session unavailable" } });
    expect(resolutions).toContainEqual({
      dedupeKey: "pstdio-planner:ticket:T-1:ready-to-merge",
      status: "done",
    });
  });

  test("resolves the stale ready-to-merge notification when a reviewed workspace regresses", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedTicket(storage);
    const resolutions: unknown[] = [];

    await workspaceAutomationCommands["workspaceStatus.set"].run({
      extensionId: "pstdio-planner",
      projectId: "project-1",
      params: { workspaceId: reviewedWorkspace.id, status: "review-ready" },
      notify: {
        action: async () => ({}) as never,
        resolve: async (input: unknown) => {
          resolutions.push(input);
          return [];
        },
      },
      sessions: {
        create: async () => ({ id: "review-session-1" }),
      },
      storage,
      workspaces: {
        get: async () => reviewedWorkspace,
        list: async () => [reviewedWorkspace, pendingWorkspace],
      },
    } as never);

    expect(resolutions).toContainEqual({
      dedupeKey: "pstdio-planner:ticket:T-1:ready-to-merge",
      status: "done",
    });
  });
});
