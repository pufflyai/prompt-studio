import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createWorkspacesDBService } from "../workspaces/workspaces";
import { createEnvironmentDBService } from "./environment";

test("independent runtime stores preserve their environment and shared workbench identities after restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "environment-identity-"));
  const workbenchId = crypto.randomUUID();
  const environments: string[] = [];
  try {
    for (const laptop of ["first", "second"]) {
      const path = join(root, laptop);
      const initial = await createDb({ path });
      try {
        const service = createEnvironmentDBService(initial.db);
        const [first, concurrent] = await Promise.all([service.get(), service.get()]);
        expect(first).toEqual(concurrent);
        environments.push(first.environmentId);
        await createProjectsDBService(initial.db).create({ id: workbenchId, name: "Shared" });
        await createWorkspacesDBService(initial.db).createDefault({
          project_id: workbenchId,
          name: "Local folder",
          root_path: join(root, laptop, "folder"),
        });
      } finally {
        await initial.close();
      }
      const restarted = await createDb({ path });
      try {
        expect(await createEnvironmentDBService(restarted.db).get()).toEqual({ environmentId: environments.at(-1)! });
        expect(await createProjectsDBService(restarted.db).get(workbenchId)).toMatchObject({ id: workbenchId });
        expect(await createWorkspacesDBService(restarted.db).getDefault(workbenchId)).toMatchObject({
          root_path: join(root, laptop, "folder"),
        });
      } finally {
        await restarted.close();
      }
    }
    expect(environments[0]).not.toBe(environments[1]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
