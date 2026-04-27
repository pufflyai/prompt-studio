import { describe, expect, test } from "bun:test";
import { createActivityFeedItem } from "./activity-feed";

describe("createActivityFeedItem", () => {
  test("formats unknown extension-owned resource activity with extension source", () => {
    const item = createActivityFeedItem({
      id: "event-1",
      project_id: "project-1",
      resource_type: "project.lab.task",
      resource_id: "task-1",
      target_ref_json: {
        type: "project.lab.task",
        id: "task-1",
        projectId: "project-1",
        label: "Task 1",
        extensionId: "project.lab",
      },
      related_refs_json: [],
      source_extension_id: "project.lab",
      event_type: "task.reviewed",
      actor_type: "system",
      actor_id: null,
      source: "hook",
      summary: "Task reviewed",
      payload_json: {},
      created_at: "2026-04-27T08:00:00.000Z",
    });

    expect(item).toMatchObject({
      id: "event-1",
      title: "Task reviewed",
      resourceLabel: "Task 1",
      resourceType: "project.lab.task",
      sourceExtensionId: "project.lab",
    });
    expect(item.isKnownKernelResource).toBe(false);
  });

  test("keeps ticket activity labeled as a known kernel resource", () => {
    const item = createActivityFeedItem({
      id: "event-2",
      project_id: "project-1",
      resource_type: "ticket",
      resource_id: "PS-112",
      target_ref_json: {
        type: "ticket",
        id: "PS-112",
        projectId: "project-1",
      },
      related_refs_json: [],
      source_extension_id: null,
      event_type: "status_changed",
      actor_type: "user",
      actor_id: null,
      source: "ui",
      summary: "Ticket status changed",
      payload_json: {},
      created_at: "2026-04-27T08:00:00.000Z",
    });

    expect(item.resourceLabel).toBe("PS-112");
    expect(item.isKnownKernelResource).toBe(true);
    expect(item.sourceExtensionId).toBeNull();
  });
});
