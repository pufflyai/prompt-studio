import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { ensureWorkspaceConfig, removeWorkspaceConfig } from "./workspace-config";

let host: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
beforeAll(async () => {
  host = await createTestApp();
  root = await realpath(await mkdtemp(join(tmpdir(), "workspace-config-links-")));
});
afterAll(async () => {
  await host.close();
  await rm(root, { recursive: true, force: true });
});

test.each([
  "directory",
  "config.json",
  ".gitignore",
])("setup rejects a symlinked metadata %s and preserves its target", async (entry) => {
  const folder = join(root, entry, "project");
  const outside = join(root, entry, "outside");
  await mkdir(join(folder, ".pstdio"), { recursive: true });
  await mkdir(outside, { recursive: true });
  const project = await host.deps.projectService.create({ name: entry });
  const workspace = await host.deps.workspaceService.ensureDefault({
    project_id: project.id,
    root_path: folder,
    name: "Project folder",
  });
  const config = JSON.stringify({ project_id: project.id, extra: "preserve" });
  await writeFile(join(outside, "config.json"), config);
  await writeFile(join(outside, ".gitignore"), "user-content\n");
  if (entry === "directory") {
    await rm(join(folder, ".pstdio"), { recursive: true });
    await symlink(outside, join(folder, ".pstdio"), "junction");
  } else {
    await symlink(join(outside, entry), join(folder, ".pstdio", entry), "file");
  }

  await expect(ensureWorkspaceConfig(folder, folder, workspace.id, project.id, host.deps)).rejects.toThrow("symlink");
  expect(await readFile(join(outside, "config.json"), "utf8")).toBe(config);
  expect(await readFile(join(outside, ".gitignore"), "utf8")).toBe("user-content\n");
  await removeWorkspaceConfig(folder, project.id, workspace.id);
  expect(await readFile(join(outside, "config.json"), "utf8")).toBe(config);
  expect(await readFile(join(outside, ".gitignore"), "utf8")).toBe("user-content\n");
});
