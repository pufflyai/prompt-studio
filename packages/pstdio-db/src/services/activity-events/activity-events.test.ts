import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import {
  ACTIVITY_ACTOR_TYPES,
  ACTIVITY_RESOURCE_TYPES,
  ACTIVITY_SOURCES,
  createActivityEventsDBService,
} from "./activity-events";

let db: DbClient;
let close: () => Promise<void>;
let activityEventsService: ReturnType<typeof createActivityEventsDBService>;
let projectsService: ReturnType<typeof createProjectsDBService>;
let projectId: string;

const defaultPayload = { from: "backlog", to: "in_progress" };

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;

  projectsService = createProjectsDBService(db);
  activityEventsService = createActivityEventsDBService(db);

  const project = await projectsService.create({ name: "activity-events-project" });
  projectId = project.id;
});

afterEach(async () => {
  await close();
});

describe("activity events service", () => {
  test("exposes stable event enum values", () => {
    expect(ACTIVITY_RESOURCE_TYPES).toEqual(["ticket", "workspace", "session"]);
    expect(ACTIVITY_ACTOR_TYPES).toEqual(["user", "agent", "system"]);
    expect(ACTIVITY_SOURCES).toEqual(["ui", "api", "hook", "system", "agent"]);
  });

  test("creates an activity event and preserves payload fields", async () => {
    const created = await activityEventsService.create({
      projectId,
      resourceType: "ticket",
      resourceId: "ticket-1",
      eventType: "ticket.status_changed",
      actorType: "user",
      actorId: "user-1",
      source: "ui",
      summary: "Moved ticket to in progress",
      payloadJson: defaultPayload,
    });

    expect(created.id).toBeDefined();
    expect(created.project_id).toBe(projectId);
    expect(created.resource_type).toBe("ticket");
    expect(created.resource_id).toBe("ticket-1");
    expect(created.event_type).toBe("ticket.status_changed");
    expect(created.actor_type).toBe("user");
    expect(created.actor_id).toBe("user-1");
    expect(created.source).toBe("ui");
    expect(created.summary).toBe("Moved ticket to in progress");
    expect(created.payload_json).toEqual(defaultPayload);
  });

  test("lists project events with deterministic ordering and tie-break by id", async () => {
    const sharedTimestamp = "2026-01-01T00:00:00.000Z";

    const first = await activityEventsService.create({
      projectId,
      resourceType: "ticket",
      resourceId: "ticket-1",
      eventType: "ticket.created",
      actorType: "agent",
      source: "system",
      summary: "Created ticket",
      payloadJson: { value: 1 },
      createdAt: sharedTimestamp,
    });

    const second = await activityEventsService.create({
      projectId,
      resourceType: "ticket",
      resourceId: "ticket-1",
      eventType: "ticket.updated",
      actorType: "agent",
      source: "system",
      summary: "Updated ticket",
      payloadJson: { value: 2 },
      createdAt: sharedTimestamp,
    });

    const list = await activityEventsService.listByProject(projectId, { limit: 10 });

    expect(list.items.map((event) => event.id)).toEqual([first.id, second.id].sort().reverse());
  });

  test("supports resource and event filters", async () => {
    await activityEventsService.create({
      projectId,
      resourceType: "ticket",
      resourceId: "ticket-1",
      eventType: "ticket.status_changed",
      actorType: "user",
      source: "ui",
      summary: "Moved ticket",
      payloadJson: { status: "in_progress" },
      createdAt: "2026-01-01T01:00:00.000Z",
    });

    await activityEventsService.create({
      projectId,
      resourceType: "workspace",
      resourceId: "workspace-1",
      eventType: "workspace.status_changed",
      actorType: "system",
      source: "system",
      summary: "Workspace blocked",
      payloadJson: { status: "blocked" },
      createdAt: "2026-01-01T02:00:00.000Z",
    });

    const resourceScoped = await activityEventsService.listByResource(projectId, "ticket", "ticket-1", {
      eventType: "ticket.status_changed",
    });
    const projectScoped = await activityEventsService.listByProject(projectId, {
      resourceType: "workspace",
      eventType: "workspace.status_changed",
    });

    expect(resourceScoped.items).toHaveLength(1);
    expect(resourceScoped.items[0].resource_type).toBe("ticket");
    expect(resourceScoped.items[0].event_type).toBe("ticket.status_changed");

    expect(projectScoped.items).toHaveLength(1);
    expect(projectScoped.items[0].resource_type).toBe("workspace");
    expect(projectScoped.items[0].event_type).toBe("workspace.status_changed");
  });

  test("supports date range filtering", async () => {
    await activityEventsService.create({
      projectId,
      resourceType: "session",
      resourceId: "session-1",
      eventType: "session.started",
      actorType: "system",
      source: "system",
      summary: "Session started",
      payloadJson: { at: 1 },
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await activityEventsService.create({
      projectId,
      resourceType: "session",
      resourceId: "session-1",
      eventType: "session.ended",
      actorType: "system",
      source: "system",
      summary: "Session ended",
      payloadJson: { at: 2 },
      createdAt: "2026-01-02T00:00:00.000Z",
    });

    const list = await activityEventsService.listByProject(projectId, {
      startsAt: "2026-01-01T12:00:00.000Z",
      endsAt: "2026-01-02T12:00:00.000Z",
    });

    expect(list.items).toHaveLength(1);
    expect(list.items[0].event_type).toBe("session.ended");
  });

  test("paginates project-scoped reads with stable cursor semantics", async () => {
    const newest = await activityEventsService.create({
      projectId,
      resourceType: "ticket",
      resourceId: "ticket-1",
      eventType: "ticket.closed",
      actorType: "user",
      source: "ui",
      summary: "Closed ticket",
      payloadJson: { position: 3 },
      createdAt: "2026-01-03T00:00:00.000Z",
    });

    const middle = await activityEventsService.create({
      projectId,
      resourceType: "ticket",
      resourceId: "ticket-1",
      eventType: "ticket.updated",
      actorType: "user",
      source: "ui",
      summary: "Updated ticket",
      payloadJson: { position: 2 },
      createdAt: "2026-01-02T00:00:00.000Z",
    });

    const oldest = await activityEventsService.create({
      projectId,
      resourceType: "ticket",
      resourceId: "ticket-1",
      eventType: "ticket.created",
      actorType: "user",
      source: "ui",
      summary: "Created ticket",
      payloadJson: { position: 1 },
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const firstPage = await activityEventsService.listByProject(projectId, { limit: 2 });

    expect(firstPage.items.map((event) => event.id)).toEqual([newest.id, middle.id]);
    expect(firstPage.nextCursor).toBeDefined();

    const secondPage = await activityEventsService.listByProject(projectId, {
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });

    expect(secondPage.items.map((event) => event.id)).toEqual([oldest.id]);
    expect(secondPage.nextCursor).toBeNull();
  });
});
