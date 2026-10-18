import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "./projects";

test("project pages keep an immutable boundary and a null terminal cursor", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const service = createProjectsDBService(db);
    for (let index = 0; index < 53; index++) {
      await service.create({ id: `project-${String(index).padStart(3, "0")}`, name: `Project ${index}` });
    }
    const first = await service.query();
    expect(first.rows).toHaveLength(50);
    expect(first.nextCursor).toEqual(expect.any(String));
    await service.remove("project-051");
    await service.create({ id: "project-001a", name: "Inserted before the boundary" });
    const last = await service.query({ cursor: first.nextCursor! });
    expect(last.rows.map((row) => row.id)).toEqual(["project-050", "project-052"]);
    expect(last.nextCursor).toBeNull();
    expect((await service.query({ limit: 1 })).rows).toHaveLength(1);
    expect((await service.query({ cursor: "invalid" })).rows).toHaveLength(50);
  } finally {
    await close();
  }
});
