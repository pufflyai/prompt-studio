import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";
import { prepareDashboard } from "./helpers/workspace-files";
import { createGitRepo } from "./helpers/workspace-session-attempt";

test("opens chat workspace files and restores selected documents through history and reload", async ({
  page,
  request,
}) => {
  const root = createGitRepo("pstdio-chat-links-", "Workspace README\n");
  mkdirSync(join(root, "src", "nested"), { recursive: true });
  mkdirSync(join(root, ".pstdio", "tickets", "PS-105"), { recursive: true });
  writeFileSync(join(root, ".pstdio", "tickets", "PS-105", "ticket.md"), "Exact workspace draft bytes\n");
  writeFileSync(
    join(root, "src", "nested", "app.ts"),
    "export const chatLinkedFile = true;\nexport const secondLine = 2;\n",
  );
  const created = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Chat file links", agents: ["pstdio.workbench-fixture.harness.fake"] }, root),
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  try {
    const workspaces = await (await request.get(`${apiBase}/v1/workspaces?project_id=${project.id}`)).json();
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: {
        project_id: project.id,
        workspace_id: workspaces[0].id,
        title: "Chat link review",
        prompt:
          "Inspect [Source](src/nested/app.ts:2) and [README](README.md). Also `src/nested/app.ts` and [Draft](.pstdio/tickets/PS-105/ticket.md).",
        agent: "pstdio.workbench-fixture.harness.fake",
      },
    });
    expect(response.ok()).toBe(true);
    const session = await response.json();
    await prepareDashboard(page, project.id);
    const resource = `pstdio://extension-resource/session/${session.id}`;
    await page.goto(`/projects/${project.id}/session?resource=${encodeURIComponent(resource)}`);
    const source = page.getByRole("link", { name: "Source", exact: true }).last();
    await expect(source).toBeVisible();
    await expect(source).toHaveAttribute("href", /document=src%2Fnested%2Fapp.ts/);
    const sourceHref = await source.getAttribute("href");
    expect(sourceHref).toContain("document=src%2Fnested%2Fapp.ts");
    await source.focus();
    await expect(source).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".monaco-editor .view-lines")).toContainText("chatLinkedFile");
    await expect(page.getByRole("option").filter({ hasText: "app.ts" }).first()).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const fileUrl = page.url();
    await page.reload();
    await expect(page.locator(".monaco-editor .view-lines")).toContainText("chatLinkedFile");
    await page.goBack();
    await expect(page.getByRole("link", { name: "README", exact: true }).last()).toBeVisible();
    await page.getByRole("link", { name: "README", exact: true }).last().click();
    await expect(page.locator(".monaco-editor .view-lines:visible")).toContainText(/Workspace\s+README/);
    await page.goto(fileUrl);
    await expect(page.locator(".monaco-editor .view-lines")).toContainText("secondLine");
    await page.goto(`/projects/${project.id}/session?resource=${encodeURIComponent(resource)}`);
    await page.getByRole("link", { name: "Draft", exact: true }).last().click();
    await expect(page.locator(".monaco-editor .view-lines:visible")).toContainText(/Exact\s+workspace\s+draft\s+bytes/);
    await expect(page).toHaveURL(/document=.pstdio%2Ftickets%2FPS-105%2Fticket.md/);
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});

test("retains Side chat and the editor draft during repeated file-position navigation", async ({
  page,
  request,
}, testInfo) => {
  const root = createGitRepo("pstdio-chat-retention-", "Workspace README");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "app.ts"), "export const firstLine = 1;\nexport const secondLine = 2;\n");
  const project = await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Retained chat" }, root) })
  ).json();
  try {
    const [workspace] = await (await request.get(`${apiBase}/v1/workspaces?project_id=${project.id}`)).json();
    const session = await (
      await request.post(`${apiBase}/v1/sessions`, {
        data: {
          project_id: project.id,
          workspace_id: workspace.id,
          title: "Retained conversation",
          prompt: `[First](src/app.ts:1) and [Second](src/app.ts:2). [Missing](missing.ts) and [Invalid page](${apiBase}/projects/${project.id}/unknown)\n\n| Link |\n| --- |\n| [Invalid table](${apiBase}/projects/${project.id}/unknown) |`,
          agent: "pstdio.workbench-fixture.harness.fake",
        },
      })
    ).json();
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}`);
    await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
    await page.getByRole("button", { name: "Reattach Side Panel", exact: true }).click();
    const header = page.locator('[data-workbench-panel-header="side"]');
    await header.getByRole("tab", { name: "New session", exact: true }).click({ button: "right" });
    await page
      .getByRole("menu", { name: "New session context menu", exact: true })
      .getByRole("menuitem", { name: session.title, exact: true })
      .click();
    const side = page.getByTestId("workbench-side-panel-attached");
    const composer = side.locator('[data-testid="content-editable"][contenteditable="true"]').last();
    await composer.fill("Keep this reply draft");
    const composerNode = await composer.elementHandle();
    const first = side.getByRole("link", { name: "First", exact: true }).last();
    await expect(first).toHaveAttribute("href", /document=src%2Fapp.ts/);
    const popupPromise = page.waitForEvent("popup");
    await first.click({ modifiers: ["ControlOrMeta"] });
    const popup = await popupPromise;
    await popup.waitForLoadState();
    expect(popup.url()).toContain("document=src%2Fapp.ts");
    expect(page.url()).not.toContain("document=");
    await popup.close();
    await side.getByRole("link", { name: "Second", exact: true }).last().click();
    const editor = page.locator(".monaco-editor:visible");
    await expect(editor).toContainText("secondLine");
    const editorNode = await editor.elementHandle();
    await expect(composer).toHaveText("Keep this reply draft");
    await page.route(`**/v1/workspaces/${workspace.id}/file?*`, async (route) => {
      if (route.request().method() === "PUT")
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Save held for draft review" }),
        });
      else await route.continue();
    });
    await editor.locator(".view-lines").click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.insertText("// retainedDraft");
    await expect(editor).toContainText("retainedDraft");
    await first.click();
    await expect(page).toHaveURL(/line=1/);
    await expect(editor).toContainText("retainedDraft");
    expect(await editor.evaluate((node, original) => node === original, editorNode)).toBe(true);
    await first.click();
    await expect(editor).toContainText("retainedDraft");
    await page.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
    await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
    const floating = page.getByTestId("workbench-side-panel-floating");
    await expect(floating.locator('[data-testid="content-editable"][contenteditable="true"]').last()).toHaveText(
      "Keep this reply draft",
    );
    expect(await composerNode!.evaluate((node) => node.isConnected)).toBe(true);
    await floating.getByRole("link", { name: "Missing", exact: true }).last().click();
    await expect(page.getByText(/not found/i).first()).toBeVisible();
    await expect(floating.getByRole("link", { name: "First", exact: true }).last()).toBeVisible();
    const beforeInvalidPage = page.url();
    await floating.getByRole("link", { name: "Invalid page", exact: true }).last().click();
    await expect(page.getByText(/unavailable in the conversation project/)).toBeVisible();
    expect(page.url()).toBe(beforeInvalidPage);
    await floating.getByRole("button", { name: "Invalid table", exact: true }).last().click();
    await expect(page.getByText(/unavailable in the conversation project/)).toBeVisible();
    expect(page.url()).toBe(beforeInvalidPage);
    await expect(floating.locator('[data-testid="content-editable"][contenteditable="true"]').last()).toHaveText(
      "Keep this reply draft",
    );
    await page.screenshot({ path: testInfo.outputPath("side-chat-file-error.png") });
    await page.unroute(`**/v1/workspaces/${workspace.id}/file?*`);
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});

test("opens a same-origin canonical document in another project and returns to its source conversation", async ({
  page,
  request,
}) => {
  const roots = [
    createGitRepo("pstdio-chat-project-a-", "Source project"),
    createGitRepo("pstdio-chat-project-b-", "Destination project"),
  ];
  const projects: { id: string }[] = [];
  try {
    for (const [index, root] of roots.entries())
      projects.push(
        await (
          await request.post(`${apiBase}/v1/projects`, {
            data: folderProjectInput({ name: `Chat project ${index}` }, root),
          })
        ).json(),
      );
    const [source, destination] = projects;
    const [workspace] = await (await request.get(`${apiBase}/v1/workspaces?project_id=${destination!.id}`)).json();
    const destinationHref = `/projects/${destination!.id}/workspace?resource=${encodeURIComponent(`pstdio://extension-resource/workspace/${workspace.id}`)}&document=README.md`;
    const session = await (
      await request.post(`${apiBase}/v1/sessions`, {
        data: {
          project_id: source!.id,
          title: "Cross-project conversation",
          prompt: `[Other project](${apiBase}${destinationHref}) and [Source file](README.md)`,
          agent: "pstdio.workbench-fixture.harness.fake",
        },
      })
    ).json();
    await prepareDashboard(page, source!.id);
    const sessionUrl = `/projects/${source!.id}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${session.id}`)}`;
    await page.goto(sessionUrl);
    const link = page.getByRole("link", { name: "Other project", exact: true }).last();
    await expect(link).toHaveAttribute("href", destinationHref);
    await link.click();
    await expect(page.locator(".monaco-editor .view-lines:visible")).toContainText(/Destination\s+project/);
    await expect(page).toHaveURL(new RegExp(`/projects/${destination!.id}/workspace`));
    await page.goBack();
    await expect(page.getByRole("link", { name: "Source file", exact: true }).last()).toBeVisible();
    await page.getByRole("link", { name: "Source file", exact: true }).last().click();
    await expect(page.locator(".monaco-editor .view-lines:visible")).toContainText(/Source\s+project/);
    await expect(page).toHaveURL(new RegExp(`/projects/${source!.id}/workspace`));
  } finally {
    for (const project of projects) await request.delete(`${apiBase}/v1/projects/${project.id}`);
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});
