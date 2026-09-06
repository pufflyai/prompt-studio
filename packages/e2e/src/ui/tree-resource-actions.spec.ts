import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  createPlannerAttempt,
  createPlannerTicket,
  createPlannerTicketFile,
  getPlannerTicket,
} from "../helpers/planner-api";
import {
  resourceActionsApiBase as apiBase,
  createResourceActionsProject,
  expectResourceMenuItems,
  prepareResourceActionsDashboard,
} from "./helpers/resource-actions";
import { showHiddenSidenavEntry } from "./helpers/sidenav-navigation";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";

test("tree menus act on an inactive sub-ticket and preserve the open ticket", async ({ page, request }, testInfo) => {
  const project = await createResourceActionsProject(request);
  const parent = await createPlannerTicket(request, apiBase, project.id, { content: "Parent ticket stays open" });
  const child = await createPlannerTicket(request, apiBase, project.id, {
    content: "Archive this sub-ticket",
    parentId: parent.id,
  });
  await prepareResourceActionsDashboard(page, project.id, "");
  await page.goto(`/projects/${project.id}/tickets`);
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await sidenav.getByRole("option", { name: "Tickets", exact: true }).first().click();
  await page
    .getByTestId("renderer-card")
    .filter({ hasText: parent.title })
    .getByText(parent.title, { exact: true })
    .click();
  const parentRow = sidenav.getByRole("option", { name: `${parent.shorthand} ${parent.title}` });
  const childRow = sidenav.getByRole("option", { name: `${child.shorthand} ${child.title}` });
  await expect(parentRow).toBeVisible();
  const openedUrl = page.url();

  await parentRow.click({ button: "right" });
  await expectResourceMenuItems(page, ["Create workspace", "Run attempt", "Refine ticket", "Archive"]);
  await expect(page.getByRole("menu")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await childRow.click({ button: "right" });
  await expectResourceMenuItems(page, ["Archive"]);
  await expect(page).toHaveURL(openedUrl);
  await page.screenshot({ path: testInfo.outputPath("sub-ticket-menu.png"), animations: "disabled" });
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await expect(childRow).toHaveCount(0);
  await expect(parentRow).toBeVisible();
  await expect(page).toHaveURL(openedUrl);
  expect((await getPlannerTicket(request, apiBase, project.id, child.id))?.archived).toBe(true);
  expect((await getPlannerTicket(request, apiBase, project.id, parent.id))?.archived).toBe(false);

  await showHiddenSidenavEntry(page, "Workspaces");
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("tree file menus rename and delete files while workspace menus archive the clicked workspace", async ({
  page,
  request,
}, testInfo) => {
  const project = await createResourceActionsProject(request);
  const repoRoot = createGitRepo("pstdio-tree-resource-actions-", "tree resource actions");
  const repo = await registerRepoViaApi(request, apiBase, project.id, "tree-actions-repo", repoRoot);
  try {
    const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "Tree resource actions" });
    const fileContent = "Keep this file open while using other menus.";
    const file = await createPlannerTicketFile(request, apiBase, project.id, ticket.id, {
      name: "notes.md",
      content: fileContent,
    });
    const attempt = await createPlannerAttempt(request, apiBase, project.id, { ticketId: ticket.id, repoId: repo.id });
    await prepareResourceActionsDashboard(page, project.id, repo.id);
    await page.goto(`/projects/${project.id}/tickets`);
    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await sidenav.getByRole("option", { name: "Tickets", exact: true }).first().click();
    await page
      .getByTestId("renderer-card")
      .filter({ hasText: ticket.title })
      .getByText(ticket.title, { exact: true })
      .click();
    const fileRow = sidenav.getByRole("option", { name: "notes.md" });
    await fileRow.click();
    await expect(page.getByTestId("content-editable").first()).toContainText(fileContent);
    await expect(fileRow).toHaveAttribute("aria-selected", "true");
    const openedUrl = page.url();

    await fileRow.click({ button: "right" });
    await expectResourceMenuItems(page, ["Rename", "Delete"]);
    await expect(page.getByRole("menuitem", { name: "Archive", exact: true })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("summary");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    const renamedRow = sidenav.getByRole("option", { name: "summary.md" });
    await expect(renamedRow).toBeVisible();
    await expect(renamedRow).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(openedUrl);

    const workspaceRow = sidenav.getByRole("option", { name: attempt.workspace.workspace_shorthand });
    await workspaceRow.click({ button: "right" });
    await expectResourceMenuItems(page, ["Open terminal", "Rename workspace", "Archive workspace", "Delete workspace"]);
    await expect(page.getByRole("menu")).toHaveCount(1);
    await expect(page).toHaveURL(openedUrl);
    await page.screenshot({ path: testInfo.outputPath("workspace-tree-menu.png"), animations: "disabled" });
    const archived = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/workspaces/${attempt.workspace.id}/archive`),
    );
    await page.getByRole("menuitem", { name: "Archive workspace", exact: true }).click();
    expect((await archived).ok()).toBe(true);
    await expect(workspaceRow).toHaveCount(0);
    await expect(renamedRow).toBeVisible();
    await expect(page).toHaveURL(openedUrl);

    await renamedRow.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await expect(renamedRow).toHaveCount(0);
    const saved = await getPlannerTicket(request, apiBase, project.id, ticket.id);
    expect(saved?.archived).toBe(false);
    expect(saved?.files?.some((entry) => entry.id === file.id)).toBe(false);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
