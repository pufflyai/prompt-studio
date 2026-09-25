import { afterAll, beforeAll, expect, test } from "bun:test";
import { createDb, createProjectsDBService, createReposDBService } from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createRepoService } from "./repo-service";

let database: Awaited<ReturnType<typeof createDb>>;
let repoService: ReturnType<typeof createRepoService>;
let projectService: ReturnType<typeof createProjectsDBService>;
const eventBus = new EventBus();
beforeAll(async () => {
  database = await createDb({ path: ":memory:" });
  projectService = createProjectsDBService(database.db);
  repoService = createRepoService({ reposDBService: createReposDBService(database.db), eventBus });
});
afterAll(async () => {
  await database?.close();
});

test("repository initialization failure removes new rows without publishing events", async () => {
  const project = await projectService.create({ name: "Failed registration" });
  let repoId = "";
  const seq = eventBus.seq;
  await expect(
    repoService.registerForProject(project.id, { name: "repo", path: "/failed-repo" }, async (repo) => {
      repoId = repo.id;
      expect(eventBus.getSince(seq)).toEqual([]);
      throw new Error("setup failed");
    }),
  ).rejects.toThrow("setup failed");
  expect(repoId).not.toBe("");
  expect(await repoService.get(repoId)).toBeNull();
  expect(await repoService.getProjectRepoLink(project.id, repoId)).toBeNull();
  expect(eventBus.getSince(seq)).toEqual([]);
});

test("failed initialization preserves an existing repository and its previous links", async () => {
  const first = await projectService.create({ name: "Owner" });
  const second = await projectService.create({ name: "New link" });
  const input = { name: "shared", path: "/shared-repo" };
  const repo = await repoService.registerForProject(first.id, input);
  const link = await repoService.getProjectRepoLink(first.id, repo.id);
  const seq = eventBus.seq;
  for (const project of [first, second]) {
    await expect(
      repoService.registerForProject(project.id, input, async () => {
        throw new Error("setup failed");
      }),
    ).rejects.toThrow("setup failed");
  }
  expect(await repoService.get(repo.id)).toEqual(repo);
  expect(await repoService.getProjectRepoLink(first.id, repo.id)).toEqual(link);
  expect(await repoService.getProjectRepoLink(second.id, repo.id)).toBeNull();
  expect(eventBus.getSince(seq)).toEqual([]);
});

test.each([
  false,
  true,
])("a failed registration preserves concurrent success (different project: %s)", async (differentProject) => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    const project = await projectService.create({ name: "Concurrent registration" });
    const target = differentProject ? await projectService.create({ name: "Other project" }) : project;
    const input = { name: "concurrent", path: `/concurrent-repo-${differentProject}` };
    const seq = eventBus.seq;
    const failed = repoService.registerForProject(project.id, input, async () => {
      entered.resolve();
      await release.promise;
      throw new Error("setup failed");
    });
    const failure = failed.catch((error) => error);
    await entered.promise;
    const successful = repoService.registerForProject(target.id, input);
    // Let an unguarded second registration commit before the first rolls back.
    // A serialized registration instead waits until the first is released.
    await Promise.race([successful, Bun.sleep(50)]);
    release.resolve();
    expect(await failure).toMatchObject({ message: "setup failed" });
    const repo = await successful;
    expect(await repoService.get(repo.id)).toEqual(repo);
    expect(await repoService.listByProject(target.id)).toEqual([repo]);
    const link = await repoService.getProjectRepoLink(target.id, repo.id);
    expect(eventBus.getSince(seq)).toEqual([
      expect.objectContaining({ table: "repos", op: "set", data: repo }),
      expect.objectContaining({ table: "project_repos", op: "set", data: link }),
    ]);
  } finally {
    release.resolve();
  }
});
