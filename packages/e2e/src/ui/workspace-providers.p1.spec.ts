import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { test as harnessTest } from "../scripts/session-test";
import { uiOrigin } from "../ui-server";
import { showSidenavEntry } from "./helpers/sidenav-navigation";

const source = `
const ready = (providerRef) => ({
  state: "ready", executionKind: "remote", providerRef,
  executionTarget: { kind: "remote", providerId: "example.cloud.workspace-type.remote", providerRef },
  capabilities: { files: "none", diff: false, merge: false, rebase: false, delete: true },
});
export default {
  workspaceTypes: [{
    id: "remote", ref: { kind: "workspace-type", id: "remote" }, label: "Test cloud workspace",
    params: { image: { type: "text", label: "Environment image", required: true } },
    create(_ctx, input) {
      if (!input.params.image) throw new Error("Choose an image.");
      return ready({ version: 1, data: { workspaceId: input.workspaceId, image: input.params.image } });
    },
    resolve: (_ctx, input) => ready(input.providerRef),
    delete: async () => {},
  }],
};
`;

test("the global workspace action uses declared cloud parameters without a repository", async ({ page, request }) => {
  // The checkout is mounted at the same path in the isolated Docker host.
  const fixturesRoot = join(import.meta.dirname, "../../../../__test-tmp__/workspace-provider-e2e");
  mkdirSync(fixturesRoot, { recursive: true });
  const sourcePath = mkdtempSync(join(fixturesRoot, "cloud-"));
  const projectRoot = mkdtempSync(join(tmpdir(), "pstdio-cloud-project-"));
  writeFileSync(join(sourcePath, "extension.ts"), source);
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "cloud",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "Provider choices" }, projectRoot),
    });
    expect(created.ok(), await created.text()).toBe(true);
    projectId = (await created.json()).id;
    await page.addInitScript((id) => localStorage.setItem("dashboard-wb2:selected-project:global", id), projectId!);
    await page.goto(`/projects/${projectId}`);
    const row = await showSidenavEntry(page, "Workspaces");
    await row.hover();
    await expect(row.getByRole("button", { name: "New workspace", exact: true })).toHaveCount(0);

    const enabled = await request.post(`${uiOrigin}/v1/projects/${projectId}/extensions/installed/cloud/enable`, {
      data: {
        displayName: "Test cloud workspace",
        extensionId: "example.cloud",
        manifest: { id: "example.cloud", name: "cloud" },
        name: "cloud",
        sourceHash: crypto.randomUUID(),
        sourceKind: "local_path",
        sourcePath,
        sourceRef: null,
        version: "1.0.0",
      },
    });
    expect(enabled.ok(), await enabled.text()).toBe(true);
    await row.click();
    const capacity = await (await request.get(`${uiOrigin}/v1/workspaces/capacity`)).json();
    await page.getByText(capacity.deviceName, { exact: true }).filter({ visible: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Create workspace", exact: true }).click();
    const dialog = page.frameLocator('iframe[title="Workspace action"]');
    await dialog.getByRole("textbox", { name: "Environment image" }).fill("documents");
    await dialog.getByRole("button", { name: "Create workspace", exact: true }).click();
    await expect(page).toHaveURL(/extensions\/pstdio.pstdio-workspaces\/overview/);
    const workspaces = await (await request.get(`${uiOrigin}/v1/workspaces?project_id=${projectId}`)).json();
    expect(workspaces).toContainEqual(
      expect.objectContaining({
        root_path: null,
        execution_kind: "remote",
        provider_state: "ready",
        provider_ref_json: { version: 1, data: expect.objectContaining({ image: "documents" }) },
      }),
    );
    await expect(page.getByRole("tab", { name: "Changes", exact: true })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Search files" })).toHaveCount(0);
  } finally {
    if (projectId) expect((await request.delete(`${uiOrigin}/v1/projects/${projectId}`)).ok()).toBe(true);
    rmSync(sourcePath, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

harnessTest(
  "the installed Git provider creates the chosen branch, runs a session and removes its checkout safely",
  async ({ page, request }) => {
    const projectRoot = mkdtempSync(join(tmpdir(), "pstdio-git-provider-ui-"));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: projectRoot, encoding: "utf8" }).trim();
    let projectId: string | undefined;
    try {
      git("init", "-b", "main");
      git("config", "user.name", "Fixture");
      git("config", "user.email", "fixture@example.test");
      writeFileSync(join(projectRoot, "notes.txt"), "Original project\n");
      git("add", ".");
      git("commit", "-m", "Initial project");
      git("switch", "-c", "feature/base");
      git("commit", "--allow-empty", "-m", "Chosen base");
      const base = git("rev-parse", "HEAD");
      git("switch", "main");
      const created = await request.post(`${uiOrigin}/v1/projects`, {
        data: folderProjectInput({ name: "Installed Git provider" }, projectRoot),
      });
      expect(created.ok(), await created.text()).toBe(true);
      projectId = (await created.json()).id;
      await page.addInitScript((id) => {
        localStorage.setItem("onboarding-complete", "true");
        localStorage.setItem("dashboard-wb2:selected-project:global", id);
      }, projectId!);
      await page.goto(`/projects/${projectId}`);
      await (await showSidenavEntry(page, "Workspaces")).click();
      const capacity = await (await request.get(`${uiOrigin}/v1/workspaces/capacity`)).json();
      await page.getByText(capacity.deviceName, { exact: true }).filter({ visible: true }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Create workspace", exact: true }).click();
      const dialog = page.frameLocator('iframe[title="Workspace action"]');
      await dialog.getByRole("button", { name: "main", exact: true }).click();
      await dialog.getByRole("menuitem", { name: "feature/base", exact: true }).click();
      await dialog.getByRole("button", { name: "Create workspace", exact: true }).click();
      await expect(page).toHaveURL(/extensions\/pstdio.pstdio-workspaces\/workspace\?resource=/);
      const workspaces = await (await request.get(`${uiOrigin}/v1/workspaces?project_id=${projectId}`)).json();
      const workspace = workspaces.find((item: { is_default: boolean }) => !item.is_default);
      expect(workspace).toMatchObject({
        provider_id: "pstdio.worktree",
        provider_state: "ready",
        execution_kind: "local",
      });
      expect(execFileSync("git", ["-C", workspace.root_path, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()).toBe(
        base,
      );
      const started = await request.post(`${uiOrigin}/v1/sessions`, {
        data: {
          project_id: projectId,
          workspace_id: workspace.id,
          title: "Git provider readiness",
          prompt: "Git provider readiness",
          agent: "pstdio.workbench-fixture.harness.fake",
        },
      });
      expect(started.ok(), await started.text()).toBe(true);
      const session = await started.json();
      await expect
        .poll(async () => (await (await request.get(`${uiOrigin}/v1/sessions/${session.id}`)).json()).status)
        .toBe("completed");
      expect((await request.delete(`${uiOrigin}/v1/workspaces/${workspace.id}`)).ok()).toBe(true);
      expect(existsSync(workspace.root_path)).toBe(false);
      expect(git("branch", "--list", workspace.branch)).toBe("");
      expect(existsSync(join(projectRoot, "notes.txt"))).toBe(true);
      expect(await (await request.get(`${uiOrigin}/v1/sessions/${session.id}`)).json()).toMatchObject({
        id: session.id,
        archived: true,
      });
    } finally {
      if (projectId) expect((await request.delete(`${uiOrigin}/v1/projects/${projectId}`)).ok()).toBe(true);
      rmSync(projectRoot, { recursive: true, force: true });
    }
  },
);
