import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "pstdio-wt";
import { createTestApp } from "../../test-utils/create-test-app";
import { createWorkspacesApi } from "../extensions/command-environment/workspaces";

test("uses only the canonical reference for workspace operations and enforces project scope", async () => {
  const root = mkdtempSync(join(tmpdir(), "workspace-reference-"));
  const oldHome = process.env.PSTDIO_HOME;
  const oldDefaults = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const app = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  try {
    const project = await app.deps.projectService.create({ name: "Prompt Studio" });
    const other = await app.deps.projectService.create({ name: "Other" });
    const repo = join(root, "repo");
    mkdirSync(repo);
    await git(repo, ["init", "-b", "main"]);
    await git(repo, [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@test.local",
      "commit",
      "--allow-empty",
      "-m",
      "init",
    ]);
    const request = (path: string, method = "GET", body?: unknown) =>
      app.app.request(`/v1${path}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    expect((await request(`/projects/${project.id}/repos`, "POST", { name: "repo", path: repo })).status).toBe(201);
    const created = await request("/workspaces", "POST", { project_id: project.id, provider_id: "pstdio.worktree" });
    expect(created.status).toBe(201);
    const workspace = await created.json();
    const ref = workspace.workspace_shorthand;
    expect(ref).toBe("PS_WS-1");
    expect((await request(`/workspaces/${ref}`)).status).toBe(200);
    expect((await request(`/workspaces/${ref}?project_id=${other.id}`)).status).toBe(404);
    expect((await request(`/workspaces/${workspace.id}?project_id=${other.id}`)).status).toBe(404);
    expect((await request(`/workspaces/${ref}`, "PATCH", { name: "Review" })).status).toBe(200);
    expect((await request(`/workspaces/${ref}/file?path=note.txt`, "POST", { content: "hello" })).status).toBe(201);
    expect((await request(`/workspaces/${ref}/files`)).status).toBe(200);
    expect((await request(`/workspaces/${ref}/diff`)).status).toBe(200);
    expect((await request(`/workspaces/${ref}/activity`)).status).toBe(200);
    const session = await app.deps.sessionService.create({ project_id: project.id, title: "Test", agent: "test" });
    await app.deps.workspaceSessionService.link(workspace.id, session.id);
    expect(
      (await (await request(`/sessions?project_id=${project.id}&workspace_id=${ref}`)).json()).map(
        (s: { id: string }) => s.id,
      ),
    ).toEqual([session.id]);
    const extension = createWorkspacesApi(app.deps, { projectId: project.id }, {} as never);
    await extension.addAnchors(ref, [{ type: "ticket", id: "ticket-1" }]);
    expect((await extension.get(ref))?.anchors_json).toHaveLength(1);
    expect((await extension.resolve(ref)).executionKind).toBe("local");
    const foreign = createWorkspacesApi(app.deps, { projectId: other.id }, {} as never);
    expect(await foreign.get(ref)).toBeNull();
    await expect(foreign.addAnchors(ref, [{ type: "ticket", id: "other" }])).rejects.toThrow("Workspace not found");
    expect((await request(`/workspaces/${ref}/entry?path=note.txt`, "DELETE")).status).toBe(204);
    expect((await request(`/workspaces/${ref}/archive`, "POST")).status).toBe(200);
    expect((await request(`/workspaces/${ref}`, "DELETE")).status).toBe(200);
    expect((await request(`/workspaces/${ref}`)).status).toBe(404);
    await git(repo, ["branch", "workspace/PS_WS-2"]);
    const collision = await (
      await request("/workspaces", "POST", { project_id: project.id, provider_id: "pstdio.worktree" })
    ).json();
    expect(collision.provider_state).toBe("failed");
    expect(collision.provider_error_json).toMatchObject({
      code: "workspace_collision",
      retryable: false,
      message: "Workspace branch already exists: workspace/PS_WS-2",
    });
  } finally {
    await app.close();
    if (oldHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = oldHome;
    if (oldDefaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = oldDefaults;
    rmSync(root, { recursive: true, force: true });
  }
});
