import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket } from "../helpers/planner-api";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const prepareDashboard = async (page: Page, projectId: string, repoId: string) => {
  await page.addInitScript(
    ({ selectedProjectId, selectedRepoId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.extension-lab.fake",
            lastSelectedModels: [],
            lastSelectedRepo: selectedRepoId,
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { selectedProjectId: projectId, selectedRepoId: repoId },
  );
};

const openWorkspace = async (page: Page, shorthand: string) => {
  const row = page.getByRole("option").filter({ hasText: shorthand }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByText(shorthand, { exact: true }).click();
};

test("PS-118 browses and edits workspace files, then refreshes the lazy diff", async ({ page, request }) => {
  test.slow();
  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-118 Workspace Files" },
  });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };
  const repoRoot = createGitRepo("pstdio-ps-118-", "Workspace files e2e");

  try {
    mkdirSync(join(repoRoot, "assets"));
    writeFileSync(join(repoRoot, "LICENSE"), "Prompt Studio test license\n");
    writeFileSync(
      join(repoRoot, "assets", "logo.png"),
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    execSync("git add LICENSE assets/logo.png", { cwd: repoRoot, stdio: "pipe" });
    execSync('git commit -m "add browse fixtures"', { cwd: repoRoot, stdio: "pipe" });

    const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-118-repo", repoRoot);
    const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "PS-118 file editor" });
    const attempt = await createPlannerAttempt(request, apiBase, project.id, {
      ticketId: ticket.id,
      repoId: repo.id,
      mode: "worktree",
      startSession: false,
    });
    const worktreePath = attempt.workspace.worktree_path;
    writeFileSync(join(worktreePath, "changed.ts"), "export const before = true;\n");
    execSync("git add changed.ts", { cwd: worktreePath, stdio: "pipe" });
    execSync('git commit -m "add changed file"', { cwd: worktreePath, stdio: "pipe" });

    const diffRequests: string[] = [];
    const fileWrites: string[] = [];
    page.on("request", (browserRequest) => {
      const url = new URL(browserRequest.url());
      if (url.pathname.endsWith("/diff-files") || url.pathname.endsWith("/diff-file")) {
        diffRequests.push(`${url.pathname}${url.search}`);
      }
      if (url.pathname.endsWith("/file") && browserRequest.method() === "PUT") fileWrites.push(url.search);
    });

    await prepareDashboard(page, project.id, repo.id);
    await page.goto(`/projects/${project.id}/workspaces`);
    await page
      .locator('[data-workbench-region="sidenav"]')
      .getByRole("option", { name: /^Workspaces(?:\s|$)/ })
      .first()
      .click();
    await openWorkspace(page, attempt.workspace.workspace_shorthand);

    const filesTab = page.getByRole("tab", { name: "Files" });
    const diffsTab = page.getByRole("tab", { name: "Diffs" });
    await expect(filesTab).toBeVisible();
    await expect(diffsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("diff-viewer")).toBeVisible();
    await expect.poll(() => diffRequests.filter((url) => url.includes("/diff-files?")).length).toBe(1);
    await expect.poll(() => diffRequests.filter((url) => url.includes("/diff-file?")).length).toBe(1);
    expect(diffRequests.some((url) => /\/diff\?/.test(url))).toBe(false);

    await filesTab.click();
    const search = page.getByRole("textbox", { name: "Search files" });
    const assets = page.getByRole("option").filter({ hasText: "assets" }).first();
    await assets.getByText("assets", { exact: true }).click();
    await expect(assets).toHaveAttribute("aria-expanded", "true");
    const nestedLogo = page.getByRole("option").filter({ hasText: "logo.png" }).first();
    await nestedLogo.getByText("logo.png", { exact: true }).click();
    await expect(page.getByRole("img", { name: "logo.png" })).toBeVisible();
    await expect(assets).toHaveAttribute("aria-expanded", "true");
    await expect(nestedLogo).toBeVisible();

    await search.fill("README");
    await page.getByRole("option", { name: "README.md" }).click();
    const editor = page.locator(".monaco-editor");
    await expect(editor).toBeVisible();
    await page.waitForTimeout(900);
    const editorElement = await editor.elementHandle();
    expect(editorElement).not.toBeNull();
    expect(fileWrites).toEqual([]);
    expect(readFileSync(join(worktreePath, "README.md"), "utf8")).toBe("Workspace files e2e\n");

    const appendedReadme = "# Edited through Monaco\n\nPS-118 saved this existing file.\n";
    const saveResponse = page.waitForResponse(
      (response) => response.url().includes("/file?path=README.md") && response.request().method() === "PUT",
    );
    await editor.locator(".view-lines").click();
    await page.keyboard.insertText(appendedReadme);
    expect((await saveResponse).ok()).toBe(true);
    await expect.poll(() => readFileSync(join(worktreePath, "README.md"), "utf8")).toContain(appendedReadme);
    await page.waitForTimeout(900);
    expect(await editorElement?.evaluate((element) => element.isConnected)).toBe(true);

    await diffsTab.click();
    const diffViewer = page.getByTestId("diff-viewer");
    const readmeBodyResponse = page.waitForResponse(
      (response) => response.url().includes("/diff-file?mode=fork_point&path=README.md") && response.ok(),
    );
    await diffViewer.getByPlaceholder("Filter files").fill("README");
    await readmeBodyResponse;
    await expect(diffViewer.getByRole("option", { name: /README\.md/ })).toBeVisible();
    await expect(diffViewer.getByRole("row", { name: /Edited through Monaco/ })).toBeVisible();

    await filesTab.click();
    await search.fill("logo");
    await page.getByRole("option", { name: "logo.png" }).click();
    await expect(page.getByRole("img", { name: "logo.png" })).toBeVisible();

    await search.fill("LICENSE");
    await page.getByRole("option", { name: "LICENSE" }).click();
    await expect(page.locator(".monaco-editor")).toBeVisible();

    await search.fill("");
    const filesTree = page.getByRole("region", { name: "Files" });
    await assets.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "New file" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Reveal in Finder" })).toBeVisible();
    await page.keyboard.press("Escape");
    await filesTree.getByText("Files", { exact: true }).hover();
    await filesTree.getByRole("button", { name: "New file" }).first().click();
    await expect(page.getByRole("dialog").filter({ hasText: "New file" })).toHaveCount(0);
    const newFileInput = filesTree.getByRole("textbox", { name: "New file name" });
    await newFileInput.fill("created.md");
    const createResponse = page.waitForResponse(
      (response) => response.url().includes("/file?path=created.md") && response.request().method() === "POST",
    );
    await newFileInput.press("Enter");
    expect((await createResponse).status()).toBe(201);
    await expect.poll(() => existsSync(join(worktreePath, "created.md"))).toBe(true);
    await expect(page.locator(".monaco-editor")).toBeVisible();

    const createdFile = page.getByRole("option").filter({ hasText: "created.md" }).first();
    await expect(createdFile.getByRole("button", { name: "Resource actions" })).toHaveCount(0);
    await createdFile.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Reveal in Finder" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Delete file" }).click();
    const deleteDialog = page.getByRole("dialog").filter({ hasText: "Delete file" });
    await expect(deleteDialog.getByText("Delete created.md? This action cannot be undone.")).toBeVisible();
    const deleteResponse = page.waitForResponse(
      (response) => response.url().includes("/file?path=created.md") && response.request().method() === "DELETE",
    );
    await deleteDialog.getByRole("button", { name: "Delete file", exact: true }).click();
    expect((await deleteResponse).status()).toBe(204);
    await expect.poll(() => existsSync(join(worktreePath, "created.md"))).toBe(false);
    await expect(page.getByText("Select a file", { exact: true })).toBeVisible();

    const unsafe = await request.get(
      `${apiBase}/v1/workspaces/${attempt.workspace.id}/file?path=${encodeURIComponent("../README.md")}`,
    );
    expect(unsafe.status()).toBe(400);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("PS-118 browses and edits files in the default workspace", async ({ page, request }) => {
  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-118 Default Workspace Files" },
  });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };
  const repoRoot = createGitRepo("pstdio-ps-118-default-", "Default workspace files e2e");

  try {
    const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-118-default-repo", repoRoot);
    const workspacesResponse = await request.get(
      `${apiBase}/v1/workspaces?project_id=${encodeURIComponent(project.id)}`,
    );
    expect(workspacesResponse.ok()).toBe(true);
    const workspaces = (await workspacesResponse.json()) as Array<{
      id: string;
      is_default: boolean;
      workspace_shorthand: string;
    }>;
    const workspace = workspaces.find((candidate) => candidate.is_default);
    expect(workspace).toBeDefined();
    if (!workspace) throw new Error("Default workspace was not created.");

    await prepareDashboard(page, project.id, repo.id);
    await page.goto(`/projects/${project.id}/workspaces`);
    await page
      .locator('[data-workbench-region="sidenav"]')
      .getByRole("option", { name: /^Workspaces(?:\s|$)/ })
      .first()
      .click();
    await openWorkspace(page, workspace.workspace_shorthand);

    await page.getByRole("tab", { name: "Files" }).click();
    const search = page.getByRole("textbox", { name: "Search files" });
    await search.fill("README");
    await page.getByRole("option", { name: "README.md" }).click();
    const editor = page.locator(".monaco-editor");
    await expect(editor).toBeVisible();

    const appendedReadme = "# Edited in the default workspace\n";
    const saveResponse = page.waitForResponse(
      (response) => response.url().includes("/file?path=README.md") && response.request().method() === "PUT",
    );
    await editor.locator(".view-lines").click();
    await page.keyboard.insertText(appendedReadme);
    expect((await saveResponse).ok()).toBe(true);
    await expect.poll(() => readFileSync(join(repoRoot, "README.md"), "utf8")).toContain(appendedReadme);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
