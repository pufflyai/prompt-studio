import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { reconcileProjectInfo } from "./project-info-owner";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("a device adopts the synced name and fills in the remote the project info lacks", async () => {
  const app = await createTestApp();
  try {
    const folder = await mkdtemp(join(tmpdir(), "project-info-owner-"));
    roots.push(folder);
    Bun.spawnSync(["git", "init", "-q"], { cwd: folder });
    Bun.spawnSync(["git", "remote", "add", "origin", "git@example.test:acme/notes.git"], { cwd: folder });
    const response = await app.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Notes",
        initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
      }),
    });
    const { id } = (await response.json()) as { id: string };
    const checked = new Set<string>();

    await reconcileProjectInfo(app.deps, id, checked);
    expect(await app.deps.projectInfoService.read(id)).toEqual({
      name: "Notes",
      gitRemote: "git@example.test:acme/notes.git",
    });

    // Another device renamed the project and recorded its own remote; both win over local values.
    await app.deps.projectInfoService.write(id, { name: "Team notes", gitRemote: "https://example.test/acme/notes" });
    await reconcileProjectInfo(app.deps, id, checked);
    expect((await app.deps.projectService.get(id))?.name).toBe("Team notes");
    expect((await app.deps.projectInfoService.read(id)).gitRemote).toBe("https://example.test/acme/notes");
  } finally {
    await app.close();
  }
});
