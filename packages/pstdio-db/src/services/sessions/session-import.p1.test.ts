import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createSessionsDBService } from "./sessions";

test("reimporting an existing session ignores an obsolete workspace assignment", async () => {
  const store = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(store.db).create({ name: "Idempotent import" });
    const service = createSessionsDBService(store.db);
    const session = await service.create({
      project_id: project.id,
      title: "Already imported",
      agent: "codex",
      status: "completed",
    });
    const result = await service.importHistorical({ record: session, workspaceId: "removed-workspace" });
    expect(result).toEqual({ session, created: false, workspaceLink: undefined });
  } finally {
    await store.close();
  }
});
