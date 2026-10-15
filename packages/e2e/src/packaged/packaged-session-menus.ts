import { expect, type Page } from "@playwright/test";

export const verifyPackagedSessionMenus = async (
  page: Page,
  baseUrl: string,
  projectId: string,
  authorization: Record<string, string>,
) => {
  const response = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      title: "Packaged session actions",
      prompt: "",
      agent: "pstdio.workbench-fixture.harness.fake",
    }),
  });
  expect(response.status).toBe(201);
  const session = (await response.json()) as { id: string };
  await page.goto(`${baseUrl}/projects/${projectId}/sessions`);
  const row = page.locator('[data-workbench-region="sidenav"]').getByRole("option", {
    name: "Packaged session actions",
    exact: true,
  });
  await row.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu")).toHaveCount(1);
  for (const name of ["Rename session", "Archive session", "Delete session"]) {
    await expect(page.getByRole("menuitem", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("menuitem", { name: "Open session panel", exact: true }).click();
  await expect(
    page.locator('[data-workbench-panel-header="side"]').getByRole("tab", {
      name: /Packaged session actions/,
    }),
  ).toBeVisible();
  await page
    .locator('[data-workbench-panel-header="side"]')
    .getByRole("tab", { name: /Packaged session actions/ })
    .click({ button: "right" });
  await expect(page.getByRole("group", { name: "Session", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Quick access", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Tab", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search sessions", exact: true }).fill("Packaged session actions");
  await expect(page.getByRole("group", { name: "Search sessions", exact: true }).getByRole("menuitem")).toHaveText([
    "Packaged session actions",
  ]);
  await page.keyboard.press("Escape");
  await row.click();
  await expect(page).toHaveURL(new RegExp(session.id));
  await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
  await page
    .locator('[role="menu"][data-state="open"]')
    .getByRole("menuitem", { name: "Rename session", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Session name" }).fill("Packaged renamed session");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(row).toBeHidden();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Packaged renamed session");
  await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
  await page
    .locator('[role="menu"][data-state="open"]')
    .getByRole("menuitem", { name: "Delete session", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/sessions$`));
  const deleted = await fetch(`${baseUrl}/v1/sessions/${session.id}`, { headers: authorization });
  expect(deleted.status).toBe(404);
};
