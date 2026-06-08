import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createReposDBService } from "./repos";

let close: () => Promise<void>;
let projects: ReturnType<typeof createProjectsDBService>;
let repos: ReturnType<typeof createReposDBService>;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  projects = createProjectsDBService(result.db);
  repos = createReposDBService(result.db);
};

beforeEach(setup);

afterEach(async () => {
  await close?.();
});

describe("repos service", () => {
  test("registerForProject upserts repo and links to project", async () => {
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

  test("removeFromProject unlinks a repo from the project", async () => {
    const project = await projects.create({ name: "TestProject" });
    const repoA = await repos.registerForProject(project.id, { name: "repo-a", path: "/a" });
    await repos.registerForProject(project.id, { name: "repo-b", path: "/b" });

    await repos.removeFromProject(project.id, repoA.id);

    const linked = await repos.listByProject(project.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].name).toBe("repo-b");
  });

  test("registerForProject links same repo to multiple projects", async () => {
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
