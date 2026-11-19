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
      if (request?.method === "performance.read" && request.params.operation === "query")
        operations.push(request.params.query.operation);
    });
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);

  await expect(meter(page).getByTestId("performance-status-fps")).toBeVisible();
  const details = page.frameLocator('iframe[title="Performance details"]').getByTestId("performance-popover");
  const preparedFrame = page.locator('iframe[title="Performance details"]');
  await expect(preparedFrame).toHaveCount(0);
  await expect(details).toHaveCount(0);
  const operations = () => page.evaluate(() => Reflect.get(window, "performanceDetailsOperations") as string[]);
  expect(await operations()).not.toContain("observe");
  await page.locator("footer").getByRole("button", { name: "Performance", exact: true }).click();
  await expect(preparedFrame).toHaveCount(1);
  // The guest scrolls within a bounded viewport even as readings grow.
  await expect
    .poll(() =>
      preparedFrame.evaluate((frame) => {
        const height = frame.getBoundingClientRect().height;
        return height > 0 && height <= Math.ceil(window.innerHeight * 0.7);
      }),
    )
    .toBe(true);
  await expect.poll(() => details.evaluate(() => document.visibilityState)).toBe("visible");
  await expect.poll(operations).toContain("observe");
  await expect(details.getByText("CPU is measured in the desktop app", { exact: true })).toBeVisible();
  await expect(details.getByRole("checkbox")).toHaveCount(0);

  // Critical: reopening must reuse the webview document instead of repeating its startup.
  const detailFrame = page.locator('iframe[title="Performance details"]');
  const loadedFrame = await detailFrame.elementHandle();
  await page.locator("footer").getByRole("button", { name: "Performance", exact: true }).click();
  await expect(detailFrame).toBeHidden();
  await expect.poll(() => details.evaluate(() => document.visibilityState)).toBe("hidden");
  await expect.poll(operations).toContain("close");
  expect(await loadedFrame!.evaluate((frame) => frame.isConnected)).toBe(true);
  await page.locator("footer").getByRole("button", { name: "Performance", exact: true }).click();
  await expect(details).toBeVisible();
  await expect
    .poll(async () => {
      const seen = await operations();
      return seen.lastIndexOf("observe") > seen.lastIndexOf("close");
    })
    .toBe(true);
  expect(await detailFrame.evaluate((frame, original) => frame === original, loadedFrame)).toBe(true);
});

test("short status popovers keep fixed bottom actions reachable", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Short status popover" }),
  });
  const project = await response.json();
  try {
    await page.route("**/*.view.details/assets/module.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        headers: { "access-control-allow-origin": "*" },
        body: `export default {
          mount(root) {
            root.innerHTML = '<div style="height:96px">Short content</div><button style="position:fixed;bottom:0">Apply</button>';
            const action = root.querySelector("button");
            action.onclick = () => { action.textContent = "Applied"; };
          }
        };`,
      }),
    );
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`/projects/${project.id}/`);
    await page.locator("footer").getByRole("button", { name: "Performance", exact: true }).click();
    const guest = page.frameLocator('iframe[title="Performance details"]');
    await expect(guest.getByText("Short content")).toBeVisible();
    await expect.poll(() => guest.locator("html").evaluate(() => innerHeight)).toBe(96);
    await guest.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(guest.getByRole("button", { name: "Applied", exact: true })).toBeVisible();
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
});
