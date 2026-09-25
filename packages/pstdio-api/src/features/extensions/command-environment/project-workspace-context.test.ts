import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultLocalWorkspaceCapabilities } from "pstdio-db";
import { makeWorkspace } from "../../workspaces/workspace-provider.test-fixture";
import { createCommandEnvironment } from "./index";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "project-workspace-context-"));
  roots.push(root);
  const home = {
    ...makeWorkspace(),
    id: "home",
    provider_id: "pstdio.root",
    is_default: true,
    execution_kind: "local" as "local" | "remote",
    worktree_path: null,
    provider_capabilities_json: { ...defaultLocalWorkspaceCapabilities },
  };
  const selected = {
    ...makeWorkspace(),
    id: "selected",
    provider_id: "pstdio.worktree",
    execution_kind: "local" as "local" | "remote",
    worktree_path: join(root, "selected"),
    provider_capabilities_json: { ...defaultLocalWorkspaceCapabilities },
  };
  const workspaces = [home, selected];
  const env = createCommandEnvironment(
    {
      workspaceService: {
        getDefault: async () => home,
        get: async (id: string) => workspaces.find((workspace) => workspace.id === id) ?? null,
        getByShorthand: async (_projectId: string, shorthand: string) =>
          workspaces.find((workspace) => workspace.id === shorthand) ?? null,
        list: async () => workspaces,
      },
      repoService: { listByProject: async () => [{ id: "repo", path: root }] },
      extensionRuntimeCatalog: {
        get: async () => ({
          runtime: {
            workspaceTypes: [
              {
                id: "example.cloud",
                provider: { label: "Cloud", params: { region: { type: "text", required: true } } },
              },
            ],
          },
        }),
      },
    } as never,
    [
      {
        instance: { id: "instance" },
        installedSource: { extension_id: "example.tools", source_path: root },
      },
    ] as never,
    {
      extensionId: "example.tools",
      name: "tools",
      projectId: "project-1",
      project: { id: "project-1", name: "Project", shorthand: "P" },
      workspaceId: selected.id,
      workspaceDir: selected.worktree_path!,
      repo: { projectId: "project-1", repoId: "repo", path: root },
    },
  );
  return { env, root, home, selected };
};

test("project files use the default workspace while working files use the selected workspace", async () => {
  const { env, root, selected } = await fixture();
  await env.projectFiles!.writeText("notes.md", "home");
  await env.workspaceFiles!.writeText("notes.md", "selected");
  expect(await readFile(join(root, "notes.md"), "utf8")).toBe("home");
  expect(await readFile(join(selected.worktree_path!, "notes.md"), "utf8")).toBe("selected");
  expect(await env.repoFiles!.readText("notes.md")).toBe("home");
});

test("project file mounts recheck capabilities and never fall back from remote to a repository", async () => {
  const { env, root, home } = await fixture();
  await writeFile(join(root, "notes.md"), "home");
  expect(await env.projectFiles!.readText("notes.md")).toBe("home");
  home.provider_capabilities_json.files = "read";
  await expect(env.projectFiles!.writeText("notes.md", "changed")).rejects.toThrow("write");
  home.execution_kind = "remote";
  await expect(env.projectFiles!.readText("notes.md")).rejects.toThrow("local");
  expect(await readFile(join(root, "notes.md"), "utf8")).toBe("home");
});

test("workspace context projects local roots and keeps the old worktree fields", async () => {
  const { env, root, home, selected } = await fixture();
  expect(await env.workspaces.getDefault()).toMatchObject({ id: home.id, root_path: root, worktree_path: null });
  expect(await env.workspaces.get(selected.id)).toMatchObject({
    root_path: selected.worktree_path,
    worktree_path: selected.worktree_path,
  });
  selected.execution_kind = "remote";
  expect(await env.workspaces.get(selected.id)).toMatchObject({ root_path: null });
});

test("provider discovery includes declared remote parameters without requiring a Git source", async () => {
  const { env } = await fixture();
  expect(await env.workspaces.listProviders()).toEqual([
    {
      id: "example.cloud",
      label: "Cloud",
      params: { region: { type: "text", required: true } },
      description: expect.any(String),
    },
  ]);
});
