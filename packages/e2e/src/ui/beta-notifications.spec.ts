import { expect, test } from "@playwright/test";
import { uiOrigin as apiBase } from "../ui-server";

test("makes notifications opt-in and reflects settings from another client", async ({ page, request }) => {
  await request.patch(`${apiBase}/v1/settings`, { data: { notifications_enabled: false } });
  const project = await (await request.post(`${apiBase}/v1/projects`, { data: { name: "Beta notifications" } })).json();
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
  await page.route("**/v1/settings", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Save failed" }) })
      : route.continue(),
  );
  await page.locator("label").filter({ has: toggle }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await page.unroute("**/v1/settings");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.locator("label").filter({ has: toggle }).click();
  await expect(nav).toBeVisible();
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
