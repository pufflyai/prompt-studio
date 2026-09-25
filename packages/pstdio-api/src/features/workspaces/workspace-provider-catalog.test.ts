import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorktree, git, resolveLatestBase } from "pstdio-wt";
import type { WorkspacesRouteDeps } from "./deps";
import { listWorkspaceProviders } from "./workspace-provider-catalog";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const createRepo = async (name: string, commit = true) => {
  const path = mkdtempSync(join(tmpdir(), "workspace-provider-branches-"));
  roots.push(path);
  await git(path, ["init", "-b", "main"]);
  if (commit) {
    await git(path, ["config", "user.name", "Test"]);
    await git(path, ["config", "user.email", "test@example.com"]);
    writeFileSync(join(path, "README.md"), "Workspace branch fixture\n");
    await git(path, ["add", "README.md"]);
    await git(path, ["commit", "-m", "Initial commit"]);
  }
  return { id: crypto.randomUUID(), name, path };
};

const providerCatalog = (repos: Awaited<ReturnType<typeof createRepo>>[]) =>
  ({
    repoService: { listByProject: async () => repos },
    extensionRuntimeCatalog: { get: async () => ({ runtime: { workspaceTypes: [] } }) },
  }) as unknown as WorkspacesRouteDeps;

describe("workspace provider branch choices", () => {
  test("offers real local and remote branches with the checked out branch selected", async () => {
    const repo = await createRepo("project");
    await git(repo.path, ["switch", "-c", "feature/notes"]);
    await git(repo.path, ["update-ref", "refs/remotes/origin/review", "HEAD"]);

    const [provider] = await listWorkspaceProviders(providerCatalog([repo]), "project-1");

    expect(provider.id).toBe("pstdio.worktree");
    expect(provider.params.base).toMatchObject({
      type: "select",
      required: true,
      defaultValue: "feature/notes",
      options: [
        { label: "feature/notes", value: "feature/notes" },
        { label: "main", value: "main" },
        { label: "origin/review", value: "origin/review" },
      ],
    });
  });

  test("uses branches from the same first repository as implicit workspace creation", async () => {
    const home = await createRepo("home");
    const other = await createRepo("other");
    await git(home.path, ["switch", "-c", "home-branch"]);
    await git(other.path, ["switch", "-c", "other-branch"]);

    const [provider] = await listWorkspaceProviders(providerCatalog([home, other]), "project-1");

    expect(provider.params.base).toMatchObject({
      type: "select",
      defaultValue: "home-branch",
      options: [
        { label: "home-branch", value: "home-branch" },
        { label: "main", value: "main" },
      ],
    });
  });

  test("does not advertise a later repository when the implicit source has no base commit", async () => {
    const home = await createRepo("home", false);
    const other = await createRepo("other");

    expect(await listWorkspaceProviders(providerCatalog([home, other]), "project-1")).toEqual([]);
  });

  test("selects the current branch instead of a same-named tag when creating a worktree", async () => {
    const repo = await createRepo("project");
    await git(repo.path, ["tag", "main"]);
    await git(repo.path, ["commit", "--allow-empty", "-m", "Advance the branch"]);
    const branchHead = await git(repo.path, ["rev-parse", "HEAD"]);

    const [provider] = await listWorkspaceProviders(providerCatalog([repo]), "project-1");
    const base = provider.params.base;
    expect(base).toMatchObject({
      type: "select",
      defaultValue: "heads/main",
      options: [{ label: "heads/main", value: "heads/main" }],
    });
    if (base.type !== "select" || typeof base.defaultValue !== "string") {
      throw new Error("Git provider must select a base branch");
    }

    const worktreePath = join(repo.path, "selected-worktree");
    await createWorktree({
      repoRoot: repo.path,
      branch: "workspace/branch-collision",
      path: worktreePath,
      base: await resolveLatestBase(repo.path, base.defaultValue),
    });
    expect(await git(worktreePath, ["rev-parse", "HEAD"])).toBe(branchHead);
    expect(branchHead).not.toBe(await git(repo.path, ["rev-parse", "refs/tags/main"]));
  });

  test("offers the current checkout and real branches while HEAD is detached", async () => {
    const repo = await createRepo("project");
    await git(repo.path, ["checkout", "--detach", "HEAD"]);

    const [provider] = await listWorkspaceProviders(providerCatalog([repo]), "project-1");

    const base = provider.params.base;
    expect(base).toMatchObject({ type: "select", defaultValue: "HEAD" });
    if (base.type !== "select") throw new Error("Git provider must declare branch choices");
    expect(base.options.map((option) => option.value)).toEqual(["HEAD", "main"]);
    for (const option of base.options) {
      expect(await git(repo.path, ["rev-parse", "--verify", `${option.value}^{commit}`])).toBeTruthy();
    }
  });

  test("preserves provider-declared choices without a Git source", async () => {
    const params = {
      image: { type: "select", defaultValue: "ubuntu", options: [{ label: "Ubuntu", value: "ubuntu" }] },
    };
    const deps = {
      ...providerCatalog([]),
      extensionRuntimeCatalog: {
        get: async () => ({
          runtime: {
            workspaceTypes: [{ id: "example.cloud", provider: { label: "Cloud", params } }],
          },
        }),
      },
    } as unknown as WorkspacesRouteDeps;

    expect(await listWorkspaceProviders(deps, "project-1")).toMatchObject([{ id: "example.cloud", params }]);
  });
});
