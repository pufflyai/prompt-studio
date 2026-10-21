import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";
import {
  chooseProjectFolderHandler,
  chooseProjectFolderRoute,
  getProjectFolderHandler,
  getProjectFolderRoute,
} from "./folder";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
beforeAll(async () => {
  handle = await createTestApp();
});
afterAll(async () => {
  await handle.close();
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
};
// A repository with one commit, served from a local path like any other remote.
const repository = async (name: string) => {
  const path = join(root, name);
  await mkdir(path);
  git(path, "init", "-q");
  await writeFile(join(path, "README.md"), name);
  git(path, "add", ".");
  git(path, "-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "-qm", "first");
  return path;
};
// A cloud project recovered on a new device: its data is here, its folder is not.
const recoveredProject = async (gitRemote?: string) => {
  const project = await handle.deps.projectService.create({ name: "Notes" });
  await handle.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder" });
  await handle.deps.projectInfoService.write(project.id, { name: "Notes", gitRemote });
  return project;
};
const routes = () => {
  const app = new OpenAPIHono<AppBindings>();
  app.openapi(getProjectFolderRoute, getProjectFolderHandler(handle.deps));
  app.openapi(chooseProjectFolderRoute, chooseProjectFolderHandler(handle.deps));
  return app;
};
const folder = async (projectId: string) => (await routes().request(`/projects/${projectId}/folder`)).json();
const choose = (projectId: string, body: { path: string; clone: boolean }) =>
  routes().request(`/projects/${projectId}/folder`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("a project without a folder clones its recorded git remote into a new folder", async () => {
  root = await mkdtemp(join(tmpdir(), "project-folder-"));
  const remote = await repository("origin");
  const project = await recoveredProject(remote);
  const target = join(root, "checkout");
  expect(await folder(project.id)).toEqual({ path: null, gitRemote: remote });

  const response = await choose(project.id, { path: target, clone: true });

  expect(response.status).toBe(201);
  expect(await readFile(join(target, "README.md"), "utf8")).toBe("origin");
  expect(await folder(project.id)).toEqual({ path: await realpath(target), gitRemote: remote });
});

test("a project without a folder uses an existing checkout only when it holds the same repository", async () => {
  root = await mkdtemp(join(tmpdir(), "project-folder-"));
  const remote = await repository("origin");
  const project = await recoveredProject(remote);
  const other = await repository("other");
  git(other, "remote", "add", "origin", join(root, "elsewhere"));
  const checkout = join(root, "checkout");
  git(root, "clone", "-q", remote, checkout);

  const refused = await choose(project.id, { path: other, clone: false });
  expect(refused.status).toBe(409);
  expect((await handle.deps.workspaceService.getDefault(project.id))?.root_path).toBeNull();

  const response = await choose(project.id, { path: checkout, clone: false });
  expect(response.status).toBe(201);
  expect((await handle.deps.workspaceService.getDefault(project.id))?.root_path).toBe(await realpath(checkout));
});
