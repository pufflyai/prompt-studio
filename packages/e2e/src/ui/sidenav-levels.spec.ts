import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";

test("Notes and Sidenav levels keep rows users pinned to the header", async ({ page, request }) => {
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Sidenav levels" }),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  const ticket = await createPlannerTicket(request, uiOrigin, project.id, { content: "Sidenav level ticket" });
  const sessionResponse = await request.post(`${uiOrigin}/v1/sessions`, {
    data: {
      project_id: project.id,
      title: "Level session",
      prompt: "Level session",
      agent: "pstdio.workbench-fixture.harness.fake",
    },
  });
  expect(sessionResponse.ok()).toBe(true);
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
  }, project.id);
  await page.goto(`/projects/${project.id}`);
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const row = (name: string) => sidenav.getByRole("option", { name, exact: true });
  const firstRow = sidenav.locator("[data-tree-list-node-id]").first();

  // Users pin a project row by dragging it into the header.
  const from = (await row("Tickets").boundingBox())!;
  const to = (await row("Search").boundingBox())!;
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, to.y + to.height * 0.25, { steps: 12 });
  await page.mouse.up();
  await expect(firstRow).toHaveText("Tickets");
  // dnd-kit swallows clicks for 50ms after a drop so the drop is not also a click; a person never clicks that fast.
  await page.waitForTimeout(100);

  await row("Notes").click();
  await expect(row("Sessions")).toBeVisible();
  await expect(firstRow).toHaveText("Tickets");
  await sidenav.getByText("Notes", { exact: true }).hover();
  await sidenav.getByRole("button", { name: "New note", exact: true }).click();
  const editor = page.getByTestId("content-editable").filter({ visible: true }).first();
  await editor.fill("Level note");
  await expect(row("Level note")).toBeVisible();
  // Individual notes are data; the Notes collection can be hidden from the customize menu.
  await row("Search").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide/show items" }).hover();
  await expect(page.getByRole("menuitem", { name: "Notes", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Level note", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await row("Level note").click();
  await expect(row("Level note")).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(row("Level note")).toBeVisible();
  await expect(firstRow).toHaveText("Tickets");

  await row("Tickets").click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(row("Tickets")).toHaveAttribute("aria-selected", "true");
  await row("Sessions").click();
  await expect(sidenav.getByText("Today", { exact: true })).toBeVisible();
  await row("Level session").click();
  await expect(page).toHaveURL(/\/session\?/);
  await expect(firstRow).toHaveText("Tickets");
  await row("Search").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  // The breadcrumb leaves a level: the project crumb returns to the last root-level page.
  await page
    .locator('[data-workbench-region="nav"]')
    .getByRole("button", { name: new RegExp(`${project.name}$`) })
    .click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(row("Sessions")).toBeVisible();

  await row("Tickets").click();
  await page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first().click();
  await expect(sidenav.getByRole("option", { name: new RegExp(`^${ticket.shorthand} `) })).toBeVisible();
  await expect(firstRow).toHaveText("Tickets");
  await expect(sidenav.getByRole("button", { name: "Help", exact: true })).toBeVisible();
  await expect(row("Settings")).toBeVisible();
  await page
    .locator('[data-workbench-region="nav"]')
    .getByRole("button", { name: new RegExp(`${project.name}$`) })
    .click();
  await expect(row("Sessions")).toBeVisible();
});
