import { expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";

const openDeveloperTools = async (page: Page) => {
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog").filter({ hasText: "Developer tools" });
  await settings.getByText("Performance", { exact: true }).click();
  return page.getByRole("checkbox", { name: "Enable performance monitoring", exact: true });
};

test("shows the frame-rate meter and pauses an extension from the performance popover", async ({ page, request }) => {
  const project = await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Performance monitoring" }) })
  ).json();
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);

  const meter = page.getByTestId("performance-status-item");
  await expect(meter).toHaveCount(0);
  const toggle = await openDeveloperTools(page);
  await expect(toggle).not.toBeChecked();
  await page.locator("label").filter({ has: toggle }).click();
  await expect(toggle).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(meter).toBeVisible();

  // The fixture's Lab view runs on its own origin and counts as an open extension view.
  await page.goto(`/projects/${project.id}/extensions/pstdio.workbench-fixture/lab`);
  const lab = page.locator('iframe[title="Lab"]');
  await expect(lab).toHaveCount(1);

  await meter.click();
  const popover = page.getByTestId("performance-popover");
  await expect(popover).toBeVisible();
  await expect(popover.getByText("CPU is measured in the desktop app", { exact: true })).toBeVisible();
  const row = popover.getByTestId("performance-cpu-row").filter({ hasText: "Workbench fixture" });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Pause Workbench fixture", exact: true }).click();
  await expect(lab).toHaveCount(0);
  await expect(row.getByText("Paused · views unloaded", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const placeholder = page.getByTestId("paused-extension-view").filter({ visible: true }).first();
  await expect(placeholder.getByText("Workbench fixture is paused", { exact: true })).toBeVisible();

  await placeholder.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(lab).toHaveCount(1);
  await expect(page.getByTestId("paused-extension-view").filter({ visible: true })).toHaveCount(0);

  // The switch belongs to this browser and survives a reload.
  await page.reload();
  await expect(meter).toBeVisible();
  const restored = await openDeveloperTools(page);
  await expect(restored).toBeChecked();
  await page.locator("label").filter({ has: restored }).click();
  await expect(restored).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("pstdio-dashboard:performance-monitoring"))).toBeNull();
  await page.keyboard.press("Escape");
  await expect(meter).toHaveCount(0);

  await page.evaluate(() =>
    (
      window as unknown as {
        __pstdioDashboardWorkbench: { commands: { executeCommand: (id: string) => Promise<unknown> } };
      }
    ).__pstdioDashboardWorkbench.commands.executeCommand("dashboard.openPerformance"),
  );
  // While off, the meter is gone and the command leads to the switch.
  await expect(page.getByRole("checkbox", { name: "Enable performance monitoring", exact: true })).toBeVisible();
});
