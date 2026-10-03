import { expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";

const openDeveloperTools = async (page: Page) => {
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog").filter({ hasText: "Developer tools" });
  await settings.getByText("Performance", { exact: true }).click();
  return page.getByRole("checkbox", { name: "Enable performance monitoring", exact: true });
};

test("turns browser performance monitoring on and off from Developer tools", async ({ page, request }) => {
  const project = await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Performance monitoring" }) })
  ).json();
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);

  const toggle = await openDeveloperTools(page);
  await expect(toggle).not.toBeChecked();
  await page.locator("label").filter({ has: toggle }).click();
  await expect(toggle).toBeChecked();

  await page.getByRole("button", { name: "Open performance view", exact: true }).click();
  await expect(page.getByText("Process CPU and memory are unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("Slow frames", { exact: true })).toBeVisible();

  // The switch belongs to this browser and survives a reload.
  await page.reload();
  const restored = await openDeveloperTools(page);
  await expect(restored).toBeChecked();
  await page.locator("label").filter({ has: restored }).click();
  await expect(restored).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("pstdio-dashboard:performance-monitoring"))).toBeNull();

  await page.keyboard.press("Escape");
  await page.evaluate(() =>
    (
      window as unknown as {
        __pstdioDashboardWorkbench: { commands: { executeCommand: (id: string) => Promise<unknown> } };
      }
    ).__pstdioDashboardWorkbench.commands.executeCommand("dashboard.openPerformance"),
  );
  // While off, the view is not a panel option and the command leads to the switch.
  await expect(page.getByRole("checkbox", { name: "Enable performance monitoring", exact: true })).toBeVisible();
  await expect(page.getByText("Slow frames", { exact: true })).toHaveCount(0);
});
