import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { activity_events } from "../../db/schemas.pg";
import { createProjectsDBService } from "../projects/projects";
import {
  ACTIVITY_ACTOR_TYPES,
  ACTIVITY_CORE_RESOURCE_TYPES,
  ACTIVITY_EVENT_SOURCES,
  createActivityEventsDBService,
} from "./activity-events";

let db: DbClient;
let close: () => Promise<void>;
let service: ReturnType<typeof createActivityEventsDBService>;
let projectId: string;

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;

  const projectsService = createProjectsDBService(db);
  const project = await projectsService.create({ name: "activity-events" });
  projectId = project.id;
  service = createActivityEventsDBService(db);
});

afterEach(async () => {
  await close();
});

describe("activity events service", () => {
  test("creates and reads a resource-scoped event with payload json", async () => {
    const created = await service.create({
      projectId,
      resourceType: "ticket",
      resourceId: "PS-38",
      eventType: "status_changed",
      actorType: "user",
      actorId: "user-1",
      source: "ui",
      summary: "Moved ticket to in progress",
      payloadJson: { from: "todo", to: "in_progress" },
    });

    expect(created.project_id).toBe(projectId);
    expect(created.resource_type).toBe("ticket");
    expect(created.payload_json).toEqual({ from: "todo", to: "in_progress" });

    const listed = await service.listByResource({
      projectId,
      resourceType: "ticket",
      resourceId: "PS-38",
      limit: 10,
    });

    expect(listed.events).toHaveLength(1);
    expect(listed.events[0].id).toBe(created.id);
    expect(listed.events[0].payload_json).toEqual({ from: "todo", to: "in_progress" });
    expect(listed.nextCursor).toBeNull();
  });

  test("lists events with project/resource/event filters", async () => {
    await service.create({
      projectId,
      resourceType: "ticket",
      resourceId: "PS-38",
      eventType: "status_changed",
      actorType: "user",
      source: "ui",
      summary: "Ticket status changed",
      payloadJson: {},
    });

    await service.create({
      projectId,
      resourceType: "workspace",
      resourceId: "PS-38_A1",
      eventType: "created",
      actorType: "system",
      source: "system",
      summary: "Workspace created",
      payloadJson: {},
    });

    const filtered = await service.listByProject({
      projectId,
      resourceType: "ticket",
      eventType: "status_changed",
      limit: 10,
    });

    expect(filtered.events).toHaveLength(1);
    expect(filtered.events[0].resource_type).toBe("ticket");
    expect(filtered.events[0].event_type).toBe("status_changed");
  });

  test("filters by created_at range", async () => {
    const now = "2026-04-17T12:00:00.000Z";

    await db.insert(activity_events).values([
      {
        id: "event-1",
        project_id: projectId,
        resource_type: "ticket",
        resource_id: "PS-1",
        event_type: "created",
        actor_type: "system",
        actor_id: null,
        source: "system",
        summary: "Created",
        payload_json: {},
        created_at: "2026-04-17T11:00:00.000Z",
      },
      {
        id: "event-2",
        project_id: projectId,
        resource_type: "ticket",
        resource_id: "PS-2",
        event_type: "updated",
        actor_type: "user",
        actor_id: null,
        source: "api",
        summary: "Updated",
        payload_json: {},
        created_at: now,
      },
      {
        id: "event-3",
        project_id: projectId,
        resource_type: "ticket",
        resource_id: "PS-3",
        event_type: "updated",
        actor_type: "agent",
        actor_id: "agent-1",
        source: "agent",
        summary: "Updated",
        payload_json: {},
        created_at: "2026-04-17T13:00:00.000Z",
      },
    ]);

    const filtered = await service.listByProject({
      projectId,
      fromCreatedAt: now,
      toCreatedAt: now,
      limit: 10,
    });

    expect(filtered.events).toHaveLength(1);
    expect(filtered.events[0].id).toBe("event-2");
  });
});

describe("activity events service pagination", () => {
  test("orders by created_at desc with id tie-breaker and paginates by cursor", async () => {
    await db.insert(activity_events).values([
      {
        id: "a",
        project_id: projectId,
        resource_type: "ticket",
        resource_id: "PS-1",
        event_type: "updated",
        actor_type: "user",
        actor_id: null,
        source: "ui",
        summary: "A",
        payload_json: {},
        created_at: "2026-04-17T10:00:00.000Z",
      },
      {
        id: "b",
        project_id: projectId,
        resource_type: "ticket",
        resource_id: "PS-1",
        event_type: "updated",
        actor_type: "user",
        actor_id: null,
        source: "ui",
        summary: "B",
        payload_json: {},
        created_at: "2026-04-17T10:00:00.000Z",
      },
      {
        id: "c",
        project_id: projectId,
        resource_type: "ticket",
        resource_id: "PS-1",
        event_type: "updated",
        actor_type: "user",
        actor_id: null,
        source: "ui",
        summary: "C",
        payload_json: {},
        created_at: "2026-04-17T11:00:00.000Z",
      },
    ]);

    const firstPage = await service.listByProject({ projectId, limit: 2 });
    expect(firstPage.events.map((event) => event.id)).toEqual(["c", "b"]);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await service.listByProject({
      projectId,
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });
    expect(secondPage.events.map((event) => event.id)).toEqual(["a"]);
    expect(secondPage.nextCursor).toBeNull();
  });

  test("ignores malformed cursors", async () => {
    await db.insert(activity_events).values([
      {
        id: "event-a",
        project_id: projectId,
        resource_type: "ticket",
        resource_id: "PS-1",
        event_type: "updated",
        actor_type: "user",
        actor_id: null,
        source: "ui",
        summary: "A",
        payload_json: {},
        created_at: "2026-04-17T10:00:00.000Z",
      },
      {
        id: "event-b",
        project_id: projectId,
        resource_type: "ticket",
        resource_id: "PS-1",
        event_type: "updated",
        actor_type: "user",
        actor_id: null,
        source: "ui",
        summary: "B",
        payload_json: {},
        created_at: "2026-04-17T11:00:00.000Z",
      },
    ]);

    const listed = await service.listByProject({
      projectId,
      cursor: "not-a-cursor",
      limit: 10,
    });

    expect(listed.events.map((event) => event.id)).toEqual(["event-b", "event-a"]);
  });

  test("clamps limit to a minimum of one", async () => {
    await db.insert(activity_events).values([
      {
        id: "l1",
        project_id: projectId,
        resource_type: "ticket",
        resource_id: "PS-1",
        event_type: "updated",
        actor_type: "user",
        actor_id: null,
        source: "ui",
        summary: "L1",
        payload_json: {},
        created_at: "2026-04-17T10:00:00.000Z",
      },
      {
        id: "l2",
        project_id: projectId,
        resource_type: "ticket",
        resource_id: "PS-1",
        event_type: "updated",
        actor_type: "user",
        actor_id: null,
        source: "ui",
        summary: "L2",
        payload_json: {},
        created_at: "2026-04-17T11:00:00.000Z",
      },
    ]);

    const listed = await service.listByProject({
      projectId,
      limit: 0,
    });

    expect(listed.events).toHaveLength(1);
    expect(listed.events[0].id).toBe("l2");
    expect(listed.nextCursor).toBeTruthy();
  });
});

describe("activity event taxonomy", () => {
  test("exports taxonomy constants", () => {
    expect(ACTIVITY_CORE_RESOURCE_TYPES).toEqual(["ticket", "workspace", "session"]);
    expect(ACTIVITY_ACTOR_TYPES).toEqual(["user", "agent", "system"]);
    expect(ACTIVITY_EVENT_SOURCES).toEqual(["ui", "api", "hook", "system", "agent"]);
  });
});
