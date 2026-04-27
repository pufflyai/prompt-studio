import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createActivityEventsDBService } from "./activity-events";

let db: DbClient;
let close: () => Promise<void>;
let service: ReturnType<typeof createActivityEventsDBService>;
let projectId: string;

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;

  const project = await createProjectsDBService(db).create({ name: "activity-resource-refs" });
  projectId = project.id;
  service = createActivityEventsDBService(db);
});

afterEach(async () => {
  await close();
});

describe("activity ResourceRef support", () => {
  test("writes and reads extension-owned resource refs", async () => {
    const target = {
      type: "project.lab.task",
      id: "task-1",
      projectId,
      label: "Task 1",
      extensionId: "project.lab",
      metadata: { lane: "review" },
    };
    const related = [{ type: "ticket", id: "PS-112", projectId, label: "PS-112" }];

    const created = await service.create({
      projectId,
      target,
      related,
      sourceExtensionId: "project.lab",
      eventType: "task.reviewed",
      actorType: "system",
      source: "hook",
      summary: "Task reviewed",
      payloadJson: { outcome: "accepted" },
    });

    expect(created.resource_type).toBe("project.lab.task");
    expect(created.resource_id).toBe("task-1");
    expect(created.target_ref_json).toEqual(target);
    expect(created.related_refs_json).toEqual(related);
    expect(created.source_extension_id).toBe("project.lab");

    const listed = await service.listByResource({
      projectId,
      resourceType: "project.lab.task",
      resourceId: "task-1",
    });

    expect(listed.events).toHaveLength(1);
    expect(listed.events[0].target_ref_json).toEqual(target);
    expect(listed.events[0].source_extension_id).toBe("project.lab");
  });

  test("keeps legacy resource type writes readable as ResourceRefs", async () => {
    const created = await service.create({
      projectId,
      resourceType: "ticket",
      resourceId: "PS-112",
      eventType: "status_changed",
      actorType: "user",
      source: "ui",
      summary: "Ticket status changed",
      payloadJson: {},
    });

    expect(created.resource_type).toBe("ticket");
    expect(created.resource_id).toBe("PS-112");
    expect(created.target_ref_json).toEqual({
      type: "ticket",
      id: "PS-112",
      projectId,
    });

    const listed = await service.listByResource({
      projectId,
      resourceType: "ticket",
      resourceId: "PS-112",
    });

    expect(listed.events.map((event) => event.id)).toEqual([created.id]);
  });
});
