import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fireExtensionEvent } from "./extension-event-runtime";
import { createWorkspaceContextFixture } from "./workspace-context.test-fixture";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
  const second = join(fixture.root, "second");
  await mkdir(second);
  await writeFile(join(second, "notes.txt"), "second folder");
  fixture.repos.push({ id: "repo-2", path: second });
});
afterEach(async () => fixture.cleanup());

for (const eventId of ["workspace.provision", "workspace.ready"]) {
  test(`${eventId} preserves linked working roots and one project home`, async () => {
    const { deps, workspace, repos, root, values } = fixture;
    workspace.initializing = eventId === "workspace.provision";
    for (const repo of repos) {
      const result = await fireExtensionEvent(deps, "project-1", eventId, {
        workspaceId: workspace.id,
        repoPath: repo.path,
        workspaceDir: "/forged",
      });
      expect(result.diagnostics ?? []).toEqual([]);
      expect(values.get("provision-target")).toMatchObject({
        cwd: repo.path,
        workingText: repo.id === "repo-1" ? "selected folder" : "second folder",
        projectText: "selected folder",
        defaultRoot: root,
        event: { workspaceDir: repo.path, workspace: { root_path: repo.path } },
      });
      expect(await readFile(join(repo.path, "provisioned.txt"), "utf8")).toBe(repo.path);
    }
  });
}

test("a recorded worktree keeps its own target during legacy repository provisioning", async () => {
  const { deps, workspace, root, values, repos } = fixture;
  Object.assign(workspace, { provider_id: "pstdio.worktree", worktree_path: root });
  const result = await fireExtensionEvent(deps, "project-1", "workspace.provision", {
    workspaceId: workspace.id,
    repoPath: repos[1].path,
  });
  expect(result.diagnostics ?? []).toEqual([]);
  expect(values.get("provision-target")).toMatchObject({ cwd: root, event: { workspaceDir: root } });
});

test("legacy repository context cannot give a remote provider a local provision target", async () => {
  const { deps, workspace, values, repos } = fixture;
  Object.assign(workspace, { provider_id: "example.remote", execution_kind: "remote" });
  const result = await fireExtensionEvent(deps, "project-1", "workspace.provision", {
    workspaceId: workspace.id,
    repoPath: repos[1].path,
  });
  expect(result.diagnostics).not.toHaveLength(0);
  expect(values.has("provision-target")).toBe(false);
});
