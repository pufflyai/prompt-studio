import { expect } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";
import { test } from "./helpers/notification-settings";

test("makes notifications opt-in and reflects settings from another client", async ({ page, request }) => {
  await request.patch(`${apiBase}/v1/settings`, { data: { notifications_enabled: false } });
  const project = await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Beta notifications" }) })
  ).json();
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  const notification = await request.post(`${apiBase}/v1/projects/${project.id}/notifications`, {
    data: { title: "Retained notification", kind: "info" },
  });
  expect(notification.ok()).toBe(true);
  await page.goto(`/projects/${project.id}/`);
  const nav = page.locator('[data-tree-list-node-id="dashboard.notifications.sidenav"]');
  await expect(nav).toHaveCount(0);
  await page.keyboard.press("Alt+Shift+N");
  await expect(
    page.getByRole("dialog").filter({ has: page.getByRole("textbox", { name: "Search notifications" }) }),
  ).toHaveCount(0);
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page.getByText("Beta features", { exact: true }).first().click();
  const toggle = page.getByRole("checkbox", { name: "Notifications", exact: true });
  await expect(toggle).not.toBeChecked();
  const writing = Promise.withResolvers<void>();
  const reject = Promise.withResolvers<void>();
  await page.route("**/v1/settings", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    writing.resolve();
    await reject.promise;
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({ error: "Save failed" }),
    });
  });
  await page.locator("label").filter({ has: toggle }).click();
  try {
    await writing.promise;
    await expect(toggle).toBeChecked();
    await expect(nav).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Machine tokens" })).toBeEnabled();
  } finally {
    reject.resolve();
  }
  await expect(page.getByRole("alert").filter({ hasText: "Save failed" })).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await expect(nav).toHaveCount(0);
  await page.unroute("**/v1/settings");
  await page.getByRole("button", { name: "Dismiss alert", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Save failed" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(toggle).not.toBeVisible();
  const activity = page.locator('[data-status-bar-item="workbench.system-activity"]');
  await activity.click();
  await expect(page.getByRole("button", { name: "Copy draft" })).toBeVisible();
  await page.getByRole("button", { name: "Return to source" }).click();
  await expect(toggle).toBeVisible();
  await page.locator("label").filter({ has: toggle }).click();
  await expect(nav).toBeVisible();
  await expect
    .poll(async () => {
      const response = await request.get(`${apiBase}/v1/settings`);
      return (await response.json()).notifications_enabled;
    })
    .toBe(true);
  await page.reload();
  await expect(nav).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Alt+Shift+N");
  await expect(
    page.getByRole("dialog").filter({ has: page.getByRole("textbox", { name: "Search notifications" }) }),
  ).toBeVisible();
  await expect(page.getByText("Retained notification", { exact: true })).toBeVisible();
  await request.patch(`${apiBase}/v1/settings`, { data: { notifications_enabled: false } });
  await expect(nav).toHaveCount(0);
  await expect(
    page.getByRole("dialog").filter({ has: page.getByRole("textbox", { name: "Search notifications" }) }),
  ).toHaveCount(0);
  await request.patch(`${apiBase}/v1/settings`, { data: { notifications_enabled: true } });
  await expect(nav).toBeVisible();
  await request.patch(`${apiBase}/v1/settings`, { data: { notifications_enabled: false } });
});

test("opens the Help menu with pointer and keyboard", async ({ page, request }) => {
  const project = await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Help menu" }) })
  ).json();
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);
  const help = page.getByRole("button", { name: "Help", exact: true });
  await help.click();
  await expect(page.getByRole("menuitem", { name: /^Keyboard shortcuts/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await help.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: /^Keyboard shortcuts/ })).toBeVisible();
});
