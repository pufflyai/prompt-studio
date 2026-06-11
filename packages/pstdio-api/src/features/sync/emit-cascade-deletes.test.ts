import { afterAll, describe, expect, test } from "bun:test";
import type { DbClient } from "pstdio-db";
import { createDb, createProjectsDBService } from "pstdio-db";
import { emitCascadeDeletes } from "./emit-cascade-deletes";
import { EventBus } from "./event-bus";

let close: () => Promise<void>;
let db: DbClient;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;
};

afterAll(async () => {
  await close?.();
});

describe("emitCascadeDeletes", () => {
  test("emits delete events for project and its dependents", async () => {
    await setup();

    const projectsService = createProjectsDBService(db);
    const project = await projectsService.create({ name: "to-delete" });

    const bus = new EventBus();
    await emitCascadeDeletes(bus, db, "projects", project.id);

    const events = bus.getSince(0);

    const tables = events.map((e) => e.table);
    expect(tables).toContain("projects");

    // project delete should be last
    expect(events[events.length - 1].table).toBe("projects");
    expect(events[events.length - 1].op).toBe("delete");

    // all events should be deletes
    for (const event of events) {
      expect(event.op).toBe("delete");
    }
  });

  test("emits nothing for non-existent id", async () => {
    await setup();

    const bus = new EventBus();
    await emitCascadeDeletes(bus, db, "projects", "non-existent");

    expect(bus.getSince(0)).toHaveLength(0);
  });

  test("emits delete for simple table without dependents", async () => {
    await setup();

    const { createProjectsDBService: createProjects } = await import("pstdio-db");
    const projectsService = createProjects(db);
    const project = await projectsService.create({ name: "simple-delete" });

    const bus = new EventBus();
    await emitCascadeDeletes(bus, db, "projects", project.id);

    const events = bus.getSince(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      table: "projects",
      op: "delete",
      data: { id: project.id },
      seq: 1,
    });
  });
});
