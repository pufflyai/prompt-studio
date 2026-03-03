import { afterAll, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsService } from "../projects/projects";
import { createReposService } from "./repos";

let close: () => Promise<void>;
let projects: ReturnType<typeof createProjectsService>;
let repos: ReturnType<typeof createReposService>;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  projects = createProjectsService(result.db);
  repos = createReposService(result.db);
};

afterAll(async () => {
  await close?.();
});

describe("repos service", () => {
  test("registerForProject upserts repo and links to project", async () => {
    await setup();

    const project = await projects.create({ name: "TestProject" });

    const repo = await repos.registerForProject(project.id, {
      name: "my-repo",
      path: "/home/user/my-repo",
    });

    expect(repo.id).toBeDefined();
    expect(repo.name).toBe("my-repo");
    expect(repo.path).toBe("/home/user/my-repo");

    const linked = await repos.listByProject(project.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].id).toBe(repo.id);
  });

  test("registerForProject reuses existing repo when path matches", async () => {
    await setup();

    const project = await projects.create({ name: "TestProject" });

    const first = await repos.registerForProject(project.id, {
      name: "my-repo",
      path: "/home/user/my-repo",
    });

    const second = await repos.registerForProject(project.id, {
      name: "my-repo",
      path: "/home/user/my-repo",
    });

    expect(second.id).toBe(first.id);

    const linked = await repos.listByProject(project.id);
    expect(linked).toHaveLength(1);
  });

  test("registerForProject links same repo to multiple projects", async () => {
    await setup();

    const projectA = await projects.create({ name: "ProjectA" });
    const projectB = await projects.create({ name: "ProjectB" });

    const repoA = await repos.registerForProject(projectA.id, {
      name: "shared-repo",
      path: "/home/user/shared-repo",
    });

    const repoB = await repos.registerForProject(projectB.id, {
      name: "shared-repo",
      path: "/home/user/shared-repo",
    });

    expect(repoB.id).toBe(repoA.id);

    const linkedA = await repos.listByProject(projectA.id);
    const linkedB = await repos.listByProject(projectB.id);
    expect(linkedA).toHaveLength(1);
    expect(linkedB).toHaveLength(1);
  });
});
