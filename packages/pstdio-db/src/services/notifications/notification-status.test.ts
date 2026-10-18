import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { notifications } from "../../db/schemas.pg";
import { createProjectsDBService } from "../projects/projects";
import { createNotificationsDBService } from "./notifications";

test("key transitions select one project atomically and preserve host expiry", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const projects = createProjectsDBService(db);
    const project = await projects.create({ name: "Status group" });
    const other = await projects.create({ name: "Other project" });
    const service = createNotificationsDBService(db);
    const first = await service.create({
      project_id: project.id,
      source: "api",
      origin: "core",
      title: "Group",
      kind: "info",
      dedupe_key: "group",
    });
    const done = { ...first, id: crypto.randomUUID(), status: "done" };
    const expired = { ...first, id: crypto.randomUUID(), status: "expired" };
    const outside = { ...first, id: crypto.randomUUID(), project_id: other.id };
    await db.insert(notifications).values([done, expired, outside]);
    const result = await service.setStatusByKey(project.id, "group", { status: "dismissed" });
    expect(result.items).toHaveLength(3);
    expect(result.updated.map((row) => row.id).sort()).toEqual([first.id, done.id].sort());
    expect(result.items.find((row) => row.id === expired.id)?.status).toBe("expired");
    expect(await service.get(other.id, outside.id)).toEqual(outside);
    const repeat = await service.setStatusByKey(project.id, "group", { status: "dismissed" });
    expect(repeat.items).toEqual(result.items);
    expect(repeat.updated).toEqual([]);
    const final = result.items.find((row) => row.id === first.id)!;
    expect(await service.setStatus(project.id, first.id, { status: "read" })).toEqual({ item: final, changed: false });
  } finally {
    await close();
  }
});
