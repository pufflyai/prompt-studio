import { rmSync } from "node:fs";
import {
  createPlannerAttempt,
  createPlannerTicket,
  createPlannerTicketFile,
  getPlannerTicket,
} from "../helpers/planner-api";
import { type APIRequestContext, expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";
import {
  createResourceActionsProject,
  expectResourceMenuItems,
  prepareResourceActionsDashboard,
} from "./helpers/resource-actions";
import { showSidenavEntry } from "./helpers/sidenav-navigation";
import { createGitRepo } from "./helpers/workspace-session-attempt";

const removeOwnedProject = async (request: APIRequestContext, projectId?: string, repoRoot?: string) => {
  try {
    if (projectId) {
      const response = await request.delete(`${apiBase}/v1/projects/${projectId}`);
      expect(response.ok(), await response.text()).toBe(true);
      const remaining = await request.get(`${apiBase}/v1/projects`);
      expect(remaining.ok()).toBe(true);
      expect(((await remaining.json()) as { id: string }[]).some((project) => project.id === projectId)).toBe(false);
    }
  } finally {
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  }
};

test("tree menus act on an inactive sub-ticket and preserve the open ticket", async ({ page, request }, testInfo) => {
  let projectId: string | undefined;
  try {
    const project = await createResourceActionsProject(request, undefined, (project) => {
      projectId = project.id;
    });
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
    await expectResourceMenuItems(page, ["Run attempt", "Refine ticket", "Archive"]);
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

    await page.getByRole("button", { name: /Resource Actions$/ }).click();
    await showSidenavEntry(page, "Workspaces");
    await expect(page.getByRole("menu")).toHaveCount(0);
  } finally {
    await removeOwnedProject(request, projectId);
  }
});

test("tree file menus rename and delete files while workspace menus delete the clicked workspace", async ({
  page,
  request,
}, testInfo) => {
  const repoRoot = createGitRepo("pstdio-tree-resource-actions-", "tree resource actions");
  let projectId: string | undefined;
  try {
    const project = await createResourceActionsProject(request, repoRoot, (project) => {
      projectId = project.id;
    });
    const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "Tree resource actions" });
    const fileContent = "Keep this file open while using other menus.";
    const file = await createPlannerTicketFile(request, apiBase, project.id, ticket.id, {
      name: "notes.md",
      content: fileContent,
    });
    const attempt = await createPlannerAttempt(request, apiBase, project.id, { ticketId: ticket.id });
    await prepareResourceActionsDashboard(page, project.id);
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
    await expect(page.getByTestId("content-editable").filter({ visible: true }).first()).toContainText(fileContent);
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
    await expectResourceMenuItems(page, ["Open terminal", "Rename workspace", "Delete workspace"]);
    await expect(page.getByRole("menu")).toHaveCount(1);
    await expect(page).toHaveURL(openedUrl);
    await page.screenshot({ path: testInfo.outputPath("workspace-tree-menu.png"), animations: "disabled" });
    const deleted = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes(".command.show-delete/execute"),
    );
    await page.getByRole("menuitem", { name: "Delete workspace", exact: true }).click();
    const confirmation = page.getByRole("dialog");
    await expect(confirmation.getByRole("button", { name: "Delete workspace", exact: true })).toBeVisible();
    await expect(page).toHaveURL(openedUrl);
    await confirmation.getByRole("button", { name: "Delete workspace", exact: true }).click();
    const deletion = await deleted;
    expect(deletion.ok()).toBe(true);
    expect((await deletion.json()).outcome).toMatchObject({ ok: true });
    await expect(workspaceRow).toHaveCount(0);
    await expect(renamedRow).toBeVisible();
    await expect(page).toHaveURL(openedUrl);

    await renamedRow.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await expect(renamedRow).toHaveCount(0);
    // Deleting the open file returns the editor to the ticket body.
    await expect(page.getByTestId("content-editable").filter({ visible: true }).first()).toContainText(ticket.title);
    await expect(page.getByTestId("content-editable").filter({ visible: true }).first()).not.toContainText(fileContent);
    await expect(sidenav.getByRole("option", { name: `${ticket.shorthand} ${ticket.title}` })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Explicit handler navigation qualifies the destination with its project owner.
    const ticketUrl = new URL(openedUrl);
    ticketUrl.searchParams.delete("document");
    const resourceUrl = new URL(ticketUrl.searchParams.get("resource")!);
    resourceUrl.searchParams.set("projectId", project.id);
    ticketUrl.searchParams.set("resource", resourceUrl.toString());
    await expect(page).toHaveURL(ticketUrl.toString());
    const saved = await getPlannerTicket(request, apiBase, project.id, ticket.id);
    expect(saved?.archived).toBe(false);
    expect(saved?.files?.some((entry) => entry.id === file.id)).toBe(false);
  } finally {
    await removeOwnedProject(request, projectId, repoRoot);
  }
});
