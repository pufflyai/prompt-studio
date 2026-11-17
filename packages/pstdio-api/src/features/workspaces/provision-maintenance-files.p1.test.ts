import { expect, test } from "bun:test";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspaceFilesMount } from "pstdio-extensions";
import { createWorkspaceMaintenance } from "../../services/workspace-maintenance";
import { provisionProjectWorkspaces } from "./provision-coordinator";
import { maintenanceFixture } from "./provision-maintenance.test-fixture";

test("converges 65 file-backed skill copies after multiple changes and removes obsolete skills without workspace sync events", async () => {
  const root = await mkdtemp(join(tmpdir(), "maintain-65-workspaces-"));
  try {
    const f = maintenanceFixture();
    f.deps.workspaceService.maintenance = createWorkspaceMaintenance(join(root, "pending"));
    for (const row of f.rows) {
      row.root_path = join(root, row.id);
      await mkdir(row.root_path);
    }
    let catalog = ["first-skill", "removed-skill"];
    let version = "v1";
    const applied = new Map<string, string[]>();
    let active = 0;
    let peak = 0;
    f.hooks.fireProvision = async (_deps, _projectId, _event, payload) => {
      peak = Math.max(peak, ++active);
      const id = (payload as { workspaceId: string }).workspaceId;
      f.calls.push(id);
      await createWorkspaceFilesMount(join(root, id), { syncStateRoot: join(root, "sync-state", id) }).syncDir(
        ".claude/skills",
        catalog.map((name) => ({ path: `${name}/SKILL.md`, content: `${name} ${version}` })),
      );
      applied.set(id, [...catalog]);
      active--;
      return { delivered: 1 };
    };
    await provisionProjectWorkspaces(f.deps, "project", f.hooks);
    f.calls.length = 0;
    await writeFile(join(root, "ws-0/.claude/skills/first-skill/SKILL.md"), "Local edit");
    await mkdir(join(root, "ws-0/.claude/skills/personal"));
    await writeFile(join(root, "ws-0/.claude/skills/personal/SKILL.md"), "Personal skill");
    catalog = ["first-skill", "replacement-skill"];
    version = "v2";
    await Promise.all(Array.from({ length: 10 }, () => provisionProjectWorkspaces(f.deps, "project", f.hooks)));
    expect(f.calls).toHaveLength(65);
    expect(peak).toBe(1);
    for (const { id } of f.rows) {
      const first = await readFile(join(root, id, ".claude/skills/first-skill/SKILL.md"), "utf8");
      expect(first).toBe(id === "ws-0" ? "Local edit" : "first-skill v2");
      expect(await readFile(join(root, id, ".claude/skills/replacement-skill/SKILL.md"), "utf8")).toBe(
        "replacement-skill v2",
      );
      await expect(access(join(root, id, ".claude/skills/removed-skill/SKILL.md"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      expect(applied.get(id)).toEqual(["first-skill", "replacement-skill"]);
    }
    expect(await readFile(join(root, "ws-0/.claude/skills/personal/SKILL.md"), "utf8")).toBe("Personal skill");
    expect(await readdir(join(root, "pending"))).toEqual([]);
    expect(f.eventBus.getSince(0).filter(({ table }) => table === "workspaces")).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
