import { beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createWorkspacesDBService } from "../workspaces/workspaces";
import { createEnvironmentDBService } from "./environment";

let image: Uint8Array;
beforeAll(async () => {
  // Packaged runtimes also start from an empty PostgreSQL image. Application
  // migrations and environment identity creation still run in each disk store.
  const source = await PGlite.create();
  try {
    image = new Uint8Array(await (await source.dumpDataDir("gzip")).arrayBuffer());
  } finally {
    await source.close();
  }
});

test(
  "independent runtime stores preserve their environment and shared workbench identities after restart",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "environment-identity-"));
    const workbenchId = crypto.randomUUID();
    const started = performance.now();
    const phase = (laptop: string, name: string) =>
      console.log(`[environment restart] ${laptop} ${name} +${Math.round(performance.now() - started)}ms`);
    try {
      const checks = await Promise.allSettled(
        ["first", "second"].map(async (laptop) => {
          const path = join(root, laptop);
          await new Bun.Archive(image).extract(path);
          phase(laptop, "open initial database");
          const initial = await createDb({ path, onPhase: (name) => phase(laptop, `initial ${name}`) });
          phase(laptop, "initial database ready");
          let environmentId: string;
          try {
            const service = createEnvironmentDBService(initial.db);
            const [first, concurrent] = await Promise.all([service.get(), service.get()]);
            expect(first).toEqual(concurrent);
            environmentId = first.environmentId;
            await createProjectsDBService(initial.db).create({ id: workbenchId, name: "Shared" });
            await createWorkspacesDBService(initial.db).createDefault({
              project_id: workbenchId,
              name: "Local folder",
              root_path: join(root, laptop, "folder"),
            });
          } finally {
            phase(laptop, "close initial database");
            await initial.close();
          }
          phase(laptop, "reopen database");
          const restarted = await createDb({ path, onPhase: (name) => phase(laptop, `restart ${name}`) });
          phase(laptop, "restarted database ready");
          try {
            expect(await createEnvironmentDBService(restarted.db).get()).toEqual({ environmentId: environmentId! });
            expect(await createProjectsDBService(restarted.db).get(workbenchId)).toMatchObject({ id: workbenchId });
            expect(await createWorkspacesDBService(restarted.db).getDefault(workbenchId)).toMatchObject({
              root_path: join(root, laptop, "folder"),
            });
          } finally {
            phase(laptop, "close restarted database");
            await restarted.close();
            phase(laptop, "restart checks complete");
          }
          return environmentId!;
        }),
      );
      for (const result of checks) if (result.status === "rejected") throw result.reason;
      const environments = checks.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
      expect(environments).toHaveLength(2);
      expect(environments[0]).not.toBe(environments[1]);
    } finally {
      phase("all", "remove temporary databases");
      await rm(root, { recursive: true, force: true });
      phase("all", "temporary databases removed");
    }
  },
  process.platform === "win32" ? 30_000 : undefined,
);
