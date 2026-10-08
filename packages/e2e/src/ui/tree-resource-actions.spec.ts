import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  createPlannerAttempt,
  createPlannerTicket,
  createPlannerTicketFile,
  getPlannerTicket,
} from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";
import {
  createResourceActionsProject,
  expectResourceMenuItems,
  prepareResourceActionsDashboard,
} from "./helpers/resource-actions";
import { getSidenavEntry } from "./helpers/sidenav-navigation";
import { createGitRepo } from "./helpers/workspace-session-attempt";

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
  await getSidenavEntry(page, "Workspaces");
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("tree file menus rename and delete files while workspace menus delete the clicked workspace", async ({
  page,
  request,
}, testInfo) => {
  const repoRoot = createGitRepo("pstdio-tree-resource-actions-", "tree resource actions");
  const project = await createResourceActionsProject(request, repoRoot);

  try {
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
      (response) =>
        response.request().method() === "DELETE" && response.url().endsWith(`/workspaces/${attempt.workspace.id}`),
    );
    await page.getByRole("menuitem", { name: "Delete workspace", exact: true }).click();
    expect((await deleted).ok()).toBe(true);
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
    const resourceUrl = new URL(ticketUrl.searchParams.get("resource")!);
    resourceUrl.searchParams.set("projectId", project.id);
    ticketUrl.searchParams.set("resource", resourceUrl.toString());
    await expect(page).toHaveURL(ticketUrl.toString());
    const saved = await getPlannerTicket(request, apiBase, project.id, ticket.id);
    expect(saved?.archived).toBe(false);
    expect(saved?.files?.some((entry) => entry.id === file.id)).toBe(false);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("session row menus keep their subject across Sessions, workspace and ticket navigation", async ({
  page,
  request,
}, testInfo) => {
  const project = await createResourceActionsProject(request);
  const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "Session row actions" });
  for (const title of ["Session A", "Session B"]) {
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: {
        project_id: project.id,
        title,
        prompt: title,
        agent: "pstdio.workbench-fixture.harness.fake",
        anchors: [{ type: "ticket", id: ticket.id }],
      },
    });
    expect(response.ok()).toBe(true);
  }
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const row = (name: string) => sidenav.getByRole("option", { name, exact: true });
  await row("Session A").click();
  const sessionUrl = page.url();
  await row("Session B").click({ button: "right" });
  await expectResourceMenuItems(page, ["Open session panel"]);
  await expect(page.getByRole("menu")).toHaveCount(1);
  await expect(page).toHaveURL(sessionUrl);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(row("Session A")).toHaveAttribute("aria-selected", "true");
  await row("Session B").focus();
  await page.keyboard.press("Shift+F10");
  await expectResourceMenuItems(page, ["Open session panel"]);
  await page.keyboard.press("Escape");
  await expect(row("Session B")).toBeFocused();
  await page.keyboard.press("ContextMenu");
  await page.getByRole("menuitem", { name: "Open session panel", exact: true }).click();
  await expect(
    page.locator('[data-workbench-panel-header="side"]').getByRole("tab", { name: /Session B/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(sessionUrl);

  await page.goto(`/projects/${project.id}/`);
  await getSidenavEntry(page, "Workspaces");
  await row("Workspaces").click();
  await page.getByText("Project folder", { exact: true }).first().click();
  await row("Session A").click();
  const workspaceUrl = page.url();
  await row("Session B").dispatchEvent("pointerdown", { pointerType: "touch", clientX: 80, clientY: 200 });
  await expectResourceMenuItems(page, ["Open session panel"]);
  await row("Session B").dispatchEvent("pointerup", { pointerType: "touch" });
  await expect(page.getByRole("menu")).toHaveCount(1);
  await expect(page).toHaveURL(workspaceUrl);
  await page.keyboard.press("Escape");
  await row("Session B").click({ button: "right" });
  await expectResourceMenuItems(page, ["Open session panel"]);
  await page.screenshot({ path: testInfo.outputPath("workspace-session-menu.png"), animations: "disabled" });
  await page.getByRole("menuitem", { name: "Open session panel", exact: true }).click();
  await expect(
    page.locator('[data-workbench-panel-header="side"]').getByRole("tab", { name: /Session B/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(workspaceUrl);

  await page.goto(`/projects/${project.id}/tickets`);
  await row("Tickets").click();
  await page
    .getByTestId("renderer-card")
    .filter({ hasText: ticket.title })
    .getByText(ticket.title, { exact: true })
    .click();
  await expect(row("Session B")).toBeVisible();
  const ticketUrl = page.url();
  await row("Session B").click({ button: "right" });
  await expectResourceMenuItems(page, ["Open session panel"]);
  await expect(page.getByRole("menu")).toHaveCount(1);
  await expect(page.getByRole("menuitem", { name: "Archive", exact: true })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Open session panel", exact: true }).click();
  await expect(
    page.locator('[data-workbench-panel-header="side"]').getByRole("tab", { name: /Session B/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(ticketUrl);
  await row("Search").click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Reset to default", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Open session panel", exact: true })).toHaveCount(0);
});
