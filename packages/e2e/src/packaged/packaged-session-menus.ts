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
    page.locator('[data-workbench-panel="side"]').getByRole("tab", {
      name: /Packaged session actions/,
    }),
  ).toBeVisible();
  const side = page.locator('[data-workbench-panel="side"]:visible');
  await side.getByLabel("side header", { exact: true }).focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Hide header", exact: true }).click();
  const edge = side.getByLabel("side header edge", { exact: true });
  await expect(edge).toBeVisible();
  await edge.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Show header", exact: true }).click();
  await expect(side.getByRole("tab", { name: /Packaged session actions/ })).toBeVisible();
  if (await page.getByTestId("workbench-side-panel-floating").isVisible()) {
    await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
  }
  const sessionTab = page.getByRole("tab", { name: /Packaged session actions/ });
  const instanceId = await sessionTab.locator("..").getAttribute("data-workbench-tab");
  await side.getByRole("button", { name: "Float Side Panel", exact: true }).click();
  const bubble = page.getByRole("button", { name: "Close Side Panel", exact: true });
  await expect(bubble).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("workbench-side-panel-floating")).toBeVisible();
  await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
  await expect(page.getByTestId("workbench-side-panel-attached")).toBeVisible();
  await expect(sessionTab.locator("..")).toHaveAttribute("data-workbench-tab", instanceId!);
  await side.getByRole("button", { name: "Float Side Panel", exact: true }).click();
  await bubble.click();
  const open = page.getByRole("button", { name: "Open Side Panel", exact: true });
  await open.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-bubble-anchor]")).toHaveAttribute("data-bubble-anchor", "bottom");
  await page.reload();
  await expect(page.locator("[data-bubble-anchor]")).toHaveAttribute("data-bubble-anchor", "bottom");
  await open.click();
  await expect(sessionTab.locator("..")).toHaveAttribute("data-workbench-tab", instanceId!);
  await page.getByRole("button", { name: /Close Packaged session actions/ }).click();
  await expect(page.getByTestId("workbench-side-panel-floating")).toBeVisible();
  await bubble.click();
  await open.click();
  await expect(page.getByRole("tab", { name: "New session", exact: true })).toBeVisible();
  await bubble.click();
  await open.click();
  await expect(page.getByRole("tab", { name: "New session", exact: true })).toHaveCount(1);
  await bubble.click();
  await row.click();
  await expect(page).toHaveURL(new RegExp(session.id));
};
