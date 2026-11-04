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
    const operations: string[] = [];
    Reflect.set(window, "performanceDetailsOperations", operations);
    window.addEventListener("message", (event) => {
      const details = document.querySelector<HTMLIFrameElement>('iframe[title="Performance details"]');
      const message = event.data;
      if (
        event.source !== details?.contentWindow ||
        message?.action !== "RIMLESS/RPC_REQUEST" ||
        message.callName !== "call"
      )
        return;
      const request = message.args?.[0];
      if (request?.method === "performance.read") operations.push(request.params.operation);
    });
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);

  await expect(meter(page).getByTestId("performance-status-fps")).toBeVisible();
  const details = page.frameLocator('iframe[title="Performance details"]').getByTestId("performance-popover");
  const preparedFrame = page.locator('iframe[title="Performance details"]');
  await expect(preparedFrame).toHaveCount(1);
  await expect(details).toHaveCount(1);
  await expect.poll(() => details.evaluate(() => document.visibilityState)).toBe("hidden");
  const operations = () => page.evaluate(() => Reflect.get(window, "performanceDetailsOperations") as string[]);
  expect(await operations()).not.toContain("subscribe");
  const preparedDocument = await preparedFrame.elementHandle();
  await meter(page).click();
  expect(await preparedFrame.evaluate((frame, original) => frame === original, preparedDocument)).toBe(true);
  await expect.poll(() => details.evaluate(() => document.visibilityState)).toBe("visible");
  await expect.poll(operations).toContain("subscribe");
  await expect(details.getByText("CPU is measured in the desktop app", { exact: true })).toBeVisible();
  await expect(details.getByRole("checkbox")).toHaveCount(0);

  // Critical: reopening must reuse the webview document instead of repeating its startup.
  const detailFrame = page.locator('iframe[title="Performance details"]');
  const loadedFrame = await detailFrame.elementHandle();
  await meter(page).click();
  await expect(detailFrame).toBeHidden();
  await expect.poll(() => details.evaluate(() => document.visibilityState)).toBe("hidden");
  await expect.poll(operations).toContain("unsubscribe");
  expect(await loadedFrame!.evaluate((frame) => frame.isConnected)).toBe(true);
  await meter(page).click();
  await expect(details).toBeVisible();
  await expect
    .poll(async () => {
      const seen = await operations();
      return seen.lastIndexOf("subscribe") > seen.lastIndexOf("unsubscribe");
    })
    .toBe(true);
  expect(await detailFrame.evaluate((frame, original) => frame === original, loadedFrame)).toBe(true);
});
