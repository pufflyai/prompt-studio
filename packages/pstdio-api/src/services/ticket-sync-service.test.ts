import { afterEach, describe, expect, test } from "bun:test";
import type { DbClient } from "pstdio-db";
import { createDb, createProjectsDBService } from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createSyncService } from "./sync-service";
import { createTicketSyncService } from "./ticket-sync-service";

let close: (() => Promise<void>) | undefined;

afterEach(async () => {
  await close?.();
  close = undefined;
});

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  const db: DbClient = result.db;
  const eventBus = new EventBus();
  const project = await createProjectsDBService(db).create({ name: "ticket-sync" });
  return { db, eventBus, project };
};

describe("createTicketSyncService", () => {
  test("projects query-tickets rows into sync state and removes stale rows", async () => {
    const { db, eventBus, project } = await setup();
    const service = createTicketSyncService({ db, eventBus });
    const events: Array<{ table: string; op: string; data: unknown }> = [];
    eventBus.subscribe((event) => events.push(event));

    await service.replaceFromQuery(project.id, {
      rows: [
        {
          id: "ticket-parent",
          title: "Parent",
          attributes: { id: "PS-1", parentId: "" },
        },
        {
          id: "ticket-child",
          title: "Child",
          attributes: { id: "PS-2", parentId: "ticket-parent" },
        },
      ],
    });

    expect((await createSyncService({ db, eventBus }).getFullState()).tickets).toEqual([
      {
        id: "ticket-parent",
        project_id: project.id,
        shorthand: "PS-1",
        title: "Parent",
        parent_id: null,
      },
      {
        id: "ticket-child",
        project_id: project.id,
        shorthand: "PS-2",
        title: "Child",
        parent_id: "ticket-parent",
      },
    ]);

    await service.replaceFromQuery(project.id, {
      rows: [
        {
          id: "ticket-child",
          title: "Renamed child",
          attributes: { id: "PS-2", parentId: "" },
        },
      ],
    });

    expect(events).toContainEqual(
      expect.objectContaining({ table: "tickets", op: "delete", data: { id: "ticket-parent" } }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        table: "tickets",
        op: "set",
        data: {
          id: "ticket-child",
          project_id: project.id,
          shorthand: "PS-2",
          title: "Renamed child",
          parent_id: null,
        },
      }),
    );
  });
});
