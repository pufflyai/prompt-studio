import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";

test("Notes, Sessions and tickets retain their levels and return to the remembered main page", async ({
  page,
  request,
}) => {
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
  const back = sidenav.locator('[data-tree-list-node-id="navigation.back"]');
  await row("Tickets").click();
  const ticketsUrl = page.url();
  await row("Notes").click();
  await expect(back).toHaveText("Project");
  await expect(row("Tickets")).toHaveCount(0);
  await sidenav.getByText("Notes", { exact: true }).hover();
  await sidenav.getByRole("button", { name: "New note", exact: true }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Level note");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(row("Level note")).toBeVisible();
  await row("Level note").click();
  await expect(row("Level note")).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await back.click();
  await expect(page).toHaveURL(ticketsUrl);
  await row("Sessions").click();
  await expect(back).toHaveText("Project");
  await row("Level session").click();
  await expect(page).toHaveURL(/\/session\?/);
  await expect(back).toBeVisible();
  await row("Search").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await back.click();
  await expect(page).toHaveURL(ticketsUrl);
  await page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first().click();
  await expect(back).toHaveText("Project");
  await expect(sidenav.getByRole("option", { name: new RegExp(`^${ticket.shorthand} `) })).toBeVisible();
  await expect(row("Search")).toBeVisible();
  await expect(sidenav.getByRole("button", { name: "Help", exact: true })).toBeVisible();
  await expect(row("Settings")).toBeVisible();
  await back.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Project", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.reload();
  await back.click();
  await expect(page).toHaveURL(ticketsUrl);
});

test("a first-visit ticket deep link falls back to Tickets", async ({ page, request }) => {
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Deep-linked level" }),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  const ticket = await createPlannerTicket(request, uiOrigin, project.id, { content: "Deep-linked ticket" });
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
  }, project.id);
  await page.goto(
    `/projects/${project.id}/extensions/pstdio.pstdio-planner/ticket?resource=${encodeURIComponent(`pstdio://extension-resource/ticket/${ticket.id}?extensionId=pstdio.pstdio-planner&projectId=${project.id}`)}`,
  );
  await page.locator('[data-tree-list-node-id="navigation.back"]').click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets$`));
});
