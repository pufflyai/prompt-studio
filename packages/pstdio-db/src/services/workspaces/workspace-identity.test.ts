import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createWorkspacesDBService } from "./workspaces";

test("allocates unique stable project prefixes and workspace references under concurrency", async () => {
  const db = await createDb({ path: ":memory:" });
  try {
    const projects = createProjectsDBService(db.db);
    const workspaces = createWorkspacesDBService(db.db);
    const created = await Promise.all(Array.from({ length: 6 }, () => projects.create({ name: "Prompt Studio" })));
    expect(new Set(created.map((p) => p.shorthand)).size).toBe(6);
    expect(created.map((p) => p.shorthand).sort()).toEqual(["PS", "PS2", "PS3", "PS4", "PS5", "PS6"]);
    const project = created[0];
    await projects.update(project.id, { name: "Renamed" });
    expect((await projects.get(project.id))?.shorthand).toBe(project.shorthand);
    const root = await workspaces.createDefault({ project_id: project.id, name: "Root", branch: "main" });
    expect(root.workspace_shorthand).toBe(`${project.shorthand}_WS-0`);
    const isolated = await Promise.all(Array.from({ length: 6 }, () => workspaces.create({ project_id: project.id })));
    expect(new Set(isolated.map((w) => w.workspace_shorthand)).size).toBe(6);
    expect(isolated.map((w) => w.workspace_shorthand).sort()).toEqual(
      Array.from({ length: 6 }, (_, n) => `${project.shorthand}_WS-${n + 1}`),
    );
    for (const workspace of isolated) await workspaces.softDelete(workspace.id);
    expect((await workspaces.create({ project_id: project.id })).workspace_shorthand).toBe(`${project.shorthand}_WS-7`);
    await projects.remove(project.id);
    expect((await projects.create({ name: "Prompt Studio" })).shorthand).toBe("PS7");
  } finally {
    await db.close();
  }
});

test("keeps suffixed project prefixes within the resource prefix grammar", async () => {
  const db = await createDb({ path: ":memory:" });
  try {
    const projects = createProjectsDBService(db.db);
    const name = "A B C D E F G H I J K L M N O P";
    expect((await projects.create({ name })).shorthand).toBe("ABCDEFGHIJKLMNOP");
    expect((await projects.create({ name })).shorthand).toBe("ABCDEFGHIJKLMNO2");
    expect((await projects.create({ name: "W S" })).shorthand).toBe("PRJ");
  } finally {
    await db.close();
  }
});
