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
      prompt: "Reply done",
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
  await page.getByRole("menuitem", { name: "Open session panel", exact: true }).click();
  await expect(
    page.locator('[data-workbench-panel-header="side"]').getByRole("tab", {
      name: /Packaged session actions/,
    }),
  ).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(new RegExp(session.id));
};
