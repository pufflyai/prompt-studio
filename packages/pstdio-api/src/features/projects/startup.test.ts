import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "pstdio-wt";
import { createTestApp } from "../../test-utils/create-test-app";
import { ensureProjectReposScaffolded } from "./startup";

test("repairs linked projects without a root workspace and preserves healthy roots", async () => {
  const root = mkdtempSync(join(tmpdir(), "root-workspace-recovery-"));
  const app = await createTestApp();
  try {
    await git(root, ["init", "-b", "recovery"]);
    await git(root, [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--allow-empty",
      "-m",
      "init",
    ]);
    const project = await app.deps.projectService.create({ name: "Legacy project" });
    const empty = await app.deps.projectService.create({ name: "Unlinked project" });
    await app.deps.repoService.registerForProject(project.id, { name: "legacy", path: root });
    expect(await app.deps.workspaceService.getDefault(project.id)).toBeNull();

    await ensureProjectReposScaffolded(app.deps);
    const recovered = await app.deps.workspaceService.getDefault(project.id);
    expect(recovered).toMatchObject({ is_default: true, provider_id: "pstdio.root", branch: "recovery" });
    await ensureProjectReposScaffolded(app.deps);
    expect(await app.deps.workspaceService.list(project.id)).toEqual([recovered]);
    expect(await app.deps.workspaceService.list(empty.id)).toEqual([]);
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
