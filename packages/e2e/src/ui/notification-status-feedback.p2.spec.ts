import { expect } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";
import { test } from "./helpers/notification-settings";

test.use({ notificationsEnabled: true });

test("dismissing a notification updates the inbox immediately and restores it on rejection", async ({
  page,
  request,
}) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Notification dismissal feedback" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: string };
  const title = "Review pending work";
  try {
    const response = await request.post(`${uiOrigin}/v1/projects/${id}/notifications`, {
      data: { title, kind: "info" },
    });
    expect(response.ok()).toBe(true);
    const notification = (await response.json()) as { id: string };
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`/projects/${id}/`);
    await page.locator('[data-tree-list-node-id="dashboard.notifications.sidenav"]').click();
    const center = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("textbox", { name: "Search notifications" }) });
    const item = center.getByText(title, { exact: true });
    await expect(item).toBeVisible();
    const statusPath = `**/notifications/${notification.id}/status`;
    const requestStarted = Promise.withResolvers<void>();
    const reject = Promise.withResolvers<void>();
    await page.route(statusPath, async (route) => {
      requestStarted.resolve();
      await reject.promise;
      await route.fulfill({ status: 422, json: { error: "Dismissal rejected" } });
    });
    await item.hover();
    await center.getByRole("button", { name: "Dismiss", exact: true }).click();
    try {
      await requestStarted.promise;
      await expect(item).toHaveCount(0);
      await expect(center.getByText("0 pending notifications", { exact: true })).toBeVisible();
    } finally {
      reject.resolve();
    }
    await expect(item).toBeVisible();
    const error = center.getByRole("alert").filter({ hasText: "Dismissal rejected" });
    await expect(error).toBeVisible();
    await error.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(error).toHaveCount(0);
    await page.unroute(statusPath);
    await item.hover();
    await center.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(item).toHaveCount(0);
    await expect
      .poll(async () => {
        const row = await request.get(`${uiOrigin}/v1/projects/${id}/notifications/${notification.id}`);
        return (await row.json()).status;
      })
      .toBe("dismissed");
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});
