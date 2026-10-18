import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createBoardViewsDBService } from "./board-views";

test("malformed saved-view cursor positions restart instead of exceeding the database integer domain", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(db).create({ name: "Cursor validation" });
    const service = createBoardViewsDBService(db);
    const scope = { project_id: project.id, extension_instance_id: null, board_id: "workspaces" };
    const row = await service.create({
      ...scope,
      title: "View",
      settings: {
        grouping: "none",
        rowNumbers: false,
        wrapRows: false,
        showStats: false,
        hiddenColumns: [],
        columnOrder: [],
      },
      filter: { conjunction: "and", rules: [] },
      sorts: [],
    });
    for (const sortOrder of [Number.MAX_SAFE_INTEGER, -2147483649]) {
      const cursor = Buffer.from(
        JSON.stringify({
          scope: JSON.stringify([project.id, null, "workspaces"]),
          id: row.id,
          createdAt: row.created_at,
          sortOrder,
        }),
      ).toString("base64url");
      const page = await service.query(scope, { cursor });
      expect(page.rows.map((item) => item.id)).toEqual([row.id]);
      expect(page.nextCursor).toBeNull();
    }
  } finally {
    await close();
  }
});
