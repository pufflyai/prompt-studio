import { expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";

// Prompt Studio Performance Monitoring measures while it is loaded; there is no separate switch.
const meter = (page: Page) => page.frameLocator('iframe[title="Performance"]').getByTestId("performance-status-item");

test("measures while the Performance Monitoring extension is loaded and shows its details", async ({
  page,
  request,
}) => {
  const project = await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Performance monitoring" }) })
  ).json();
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);

  await expect(meter(page).getByTestId("performance-status-fps")).toBeVisible();
  await meter(page).click();
  const details = page.frameLocator('iframe[title="Performance details"]').getByTestId("performance-popover");
  await expect(details.getByText("CPU is measured in the desktop app", { exact: true })).toBeVisible();
  await expect(details.getByRole("checkbox")).toHaveCount(0);

  // Critical: reopening must reuse the webview document instead of repeating its startup.
  const detailFrame = page.locator('iframe[title="Performance details"]');
  const loadedFrame = await detailFrame.elementHandle();
  await meter(page).click();
  await expect(detailFrame).toBeHidden();
  expect(await loadedFrame!.evaluate((frame) => frame.isConnected)).toBe(true);
  await meter(page).click();
  await expect(details).toBeVisible();
  expect(await detailFrame.evaluate((frame, original) => frame === original, loadedFrame)).toBe(true);
});
