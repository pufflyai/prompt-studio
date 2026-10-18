import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";

test("activity HTTP pages expose camelCase entries and preserve legacy events", async () => {
  const { app, deps, close } = await createTestApp();
  try {
    const project = await deps.projectService.create({ name: "Activity pages" });
    const workspace = await deps.workspaceService.createStandalone({ project_id: project.id });
    for (let index = 0; index < 52; index++)
      await deps.activityEventsService.create({
        projectId: project.id,
        resourceType: "workspace",
        resourceId: workspace.id,
        eventType: "workspace.changed",
        actorType: "system",
        source: "api",
        summary: `Change ${index}`,
        payloadJson: { index },
      });
    const path = `/v1/workspaces/${workspace.id}/activity`;
    const response = await app.request(`${path}?eventType=workspace.changed`);
    expect(response.status).toBe(200);
    const first = await response.json();
    expect(first.items).toHaveLength(50);
    expect(first.items[0]).toMatchObject({
      projectId: project.id,
      resourceType: "workspace",
      resourceId: workspace.id,
      eventType: "workspace.changed",
      actorType: "system",
      createdAt: first.events[0].created_at,
    });
    expect(first.items.map((item: { id: string }) => item.id)).toEqual(
      first.events.map((item: { id: string }) => item.id),
    );
    expect(first.nextCursor).toBe(first.next_cursor);
    const last = await (await app.request(`${path}?eventType=workspace.changed&cursor=${first.nextCursor}`)).json();
    expect(last.items).toHaveLength(2);
    expect(last.nextCursor).toBeNull();
    const legacy = await (await app.request(`${path}?event_type=workspace.changed`)).json();
    expect(legacy.items).toEqual(first.items);
  } finally {
    await close();
  }
});
