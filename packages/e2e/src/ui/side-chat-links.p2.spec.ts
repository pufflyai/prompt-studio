import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";
import { openSessionSidePanel } from "./helpers/resource-actions";
import { prepareDashboard } from "./helpers/workspace-files";
import { createGitRepo } from "./helpers/workspace-session-attempt";

// Critical risk: a Side preview must retain its conversation and leave Main in place.
test("a link in a Side conversation previews in Side and retains the conversation tab", async ({ page, request }) => {
  const root = createGitRepo("pstdio-side-chat-links-", "Side chat links");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "app.ts"), "export const sideLinkedFile = true;\n");
  const project = await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Side chat links" }, root) })
  ).json();
  try {
    const [workspace] = await (await request.get(`${apiBase}/v1/workspaces?project_id=${project.id}`)).json();
    const created = await request.post(`${apiBase}/v1/sessions`, {
      data: {
        project_id: project.id,
        workspace_id: workspace.id,
        title: "Side link conversation",
        prompt: "Open [App](src/app.ts:1) from the side conversation.",
        agent: "pstdio.workbench-fixture.harness.fake",
      },
    });
    expect(created.ok()).toBe(true);
    const session = await created.json();
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}`);
    await openSessionSidePanel(page, session.title);
    const side = page.locator('[data-workbench-region="side"]');
    const conversationTab = page
      .locator('[data-workbench-panel-header="side"]')
      .getByRole("tab", { name: session.title, exact: true });
    const mainUrl = page.url();
    await side.getByRole("link", { name: "App", exact: true }).last().click();
    await expect(side.locator(".monaco-editor .view-lines:visible")).toContainText("sideLinkedFile");
    await expect(page).toHaveURL(mainUrl);
    await expect(conversationTab).toHaveAttribute("aria-selected", "false");
    await conversationTab.click();
    await expect(conversationTab).toHaveAttribute("aria-selected", "true");
    await expect(side.getByRole("link", { name: "App", exact: true }).last()).toBeVisible();
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
