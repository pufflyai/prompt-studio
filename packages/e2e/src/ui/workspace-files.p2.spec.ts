import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerAttempt, createPlannerTicket } from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";
import {
  exerciseWorkspaceFileOperations,
  expectFoldersBeforeFiles,
  expectWorkspaceDocument,
  openWorkspace,
  prepareDashboard,
} from "./helpers/workspace-files";
import { createGitRepo } from "./helpers/workspace-session-attempt";

// Critical risks: the installed extension must preserve editing, keyboard save, destructive
// confirmations, document restoration and lazy Changes while using only public callbacks.
test("browses and edits workspace files, then refreshes the lazy diff", async ({ page, request, context }) => {
  test.slow();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const root = createGitRepo("pstdio-workspace-files-", "Workspace files e2e");
  const created = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Workspace Files" }, root),
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  let workspaceId: string | undefined;
  try {
    mkdirSync(join(root, "assets"));
    mkdirSync(join(root, "zzz-folder"));
    writeFileSync(join(root, "LICENSE"), "Test license\n");
    writeFileSync(join(root, "zzz-folder/keep.txt"), "folder ordering\n");
    writeFileSync(
      join(root, "assets/logo.png"),
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    execSync('git add LICENSE assets/logo.png zzz-folder/keep.txt && git commit -m "Browse fixtures"', {
      cwd: root,
      stdio: "pipe",
    });
    const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "Workspace editor" });
    const attempt = await createPlannerAttempt(request, apiBase, project.id, { ticketId: ticket.id });
    workspaceId = attempt.workspace.id;
    const worktreePath = attempt.workspace.root_path;
    writeFileSync(join(worktreePath, "changed.ts"), "export const before = true;\n");
    execSync('git add changed.ts && git commit -m "Changed file"', { cwd: worktreePath, stdio: "pipe" });
    const commands: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/extensions/commands/"))
        commands.push(new URL(request.url()).pathname);
    });
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}/workspaces`);
    await openWorkspace(page, attempt.workspace.workspace_shorthand);
    const filesTab = page.getByRole("tab", { name: "Files", exact: true });
    const changesTab = page.getByRole("tab", { name: "Changes", exact: true });
    await expect(filesTab).toHaveAttribute("aria-selected", "true");
    expect(commands.filter((id) => id.includes(".command.read-diff/"))).toEqual([]);
    await changesTab.click();
    const changes = page.frameLocator('iframe[title="Changes"]:visible');
    const viewer = changes.getByTestId("diff-viewer");
    await expect(viewer).toBeVisible();
    await expect.poll(() => commands.filter((id) => id.includes(".command.read-changes/")).length).toBe(1);
    await expect.poll(() => commands.filter((id) => id.includes(".command.read-diff/")).length).toBe(1);
    await filesTab.click();
    const tree = page.getByRole("region", { name: "Files", exact: true });
    const search = page.getByRole("textbox", { name: "Search files" });
    await expectFoldersBeforeFiles(tree);
    const assets = tree.getByRole("option", { name: "assets", exact: true });
    await assets.click();
    await tree.getByRole("option", { name: "logo.png", exact: true }).click();
    await expect(page.getByRole("img", { name: "logo.png", exact: true })).toBeVisible();
    await search.fill("README");
    await tree.getByRole("option", { name: "README.md", exact: true }).click();
    const editor = page.locator(".monaco-editor").filter({ visible: true });
    await expect(editor).toBeVisible();
    await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
    await page.getByRole("menuitem", { name: "Rename workspace", exact: true }).click();
    await page
      .frameLocator('iframe[title="Workspace action"]')
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(page).toHaveURL(/document=README.md/);
    await expectWorkspaceDocument(page, "README.md");
    await expect(editor.locator(".view-lines")).toContainText("Workspace files e2e");
    const writes = () => commands.filter((id) => id.includes(".view.file.file.save/")).length;
    const beforeWrites = writes();
    const before = readFileSync(join(worktreePath, "README.md"), "utf8");
    const text = "# Edited through Monaco\n\nSaved this existing file.\n";
    await editor.locator(".view-lines").click();
    await page.keyboard.insertText(text);
    await expect(page.getByLabel("Unsaved changes", { exact: true })).toBeVisible();
    expect(readFileSync(join(worktreePath, "README.md"), "utf8")).toBe(before);
    expect(writes()).toBe(beforeWrites);
    await page.keyboard.press("ControlOrMeta+s");
    await expect.poll(() => readFileSync(join(worktreePath, "README.md"), "utf8")).toContain(text);
    await changesTab.click();
    await viewer.getByPlaceholder("Search files").fill("README");
    await expect(viewer.getByRole("row", { name: /Edited through Monaco/ })).toBeVisible();
    await changes.getByRole("button", { name: "Current changes", exact: true }).click();
    await expect(viewer.getByRole("row", { name: /Edited through Monaco/ })).toBeVisible();
    await changes.getByRole("button", { name: "Since fork point", exact: true }).click();
    await filesTab.click();
    await search.fill("LICENSE");
    await tree.getByRole("option", { name: "LICENSE", exact: true }).click();
    await search.fill("");
    await exerciseWorkspaceFileOperations({ page, filesTree: tree, assets, worktreePath });
    expect(
      (
        await request.get(`${apiBase}/v1/workspaces/${workspaceId}/file?path=${encodeURIComponent("../README.md")}`)
      ).status(),
    ).toBe(400);
  } finally {
    if (workspaceId) await request.delete(`${apiBase}/v1/workspaces/${workspaceId}`);
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});

test("Files opens the project folder without Changes and restores its document", async ({ page, request }) => {
  const root = createGitRepo("pstdio-default-files-", "Default workspace files e2e");
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Project Files" }, root),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  try {
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}`);
    await page.getByRole("option", { name: "Files", exact: true }).click();
    const search = page.getByRole("textbox", { name: "Search files" });
    await search.fill("README");
    await page
      .getByRole("region", { name: "Files", exact: true })
      .locator('[data-tree-list-node-id="README.md"]')
      .click();
    await expect(page.getByRole("tab", { name: "Changes", exact: true })).toHaveCount(0);
    const editor = page.locator(".monaco-editor");
    await expect(editor).toBeVisible();
    const original = readFileSync(join(root, "README.md"), "utf8");
    const text = "# Edited in the project folder\n";
    await editor.locator(".view-lines").click();
    await page.keyboard.insertText(text);
    await expect(page.getByLabel("Unsaved changes", { exact: true })).toBeVisible();
    expect(readFileSync(join(root, "README.md"), "utf8")).toBe(original);
    await page.keyboard.press("ControlOrMeta+s");
    await expect.poll(() => readFileSync(join(root, "README.md"), "utf8")).toContain(text);
    await page.reload();
    await expect(page.locator(".monaco-editor .view-lines")).toContainText("Edited in the project folder");
    await expect(page).toHaveURL(/document=README.md/);
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
