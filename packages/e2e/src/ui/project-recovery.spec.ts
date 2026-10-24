import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

test("recovery offers project and extension scope, reports stale points, and shows low-space and empty states", async ({
  page,
  request,
}) => {
  let projectId = process.env.E2E_RECOVERY_PROJECT_ID;
  if (!projectId) {
    const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Project recovery" }) });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
  }
  await page.addInitScript((id) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id!);
  }, projectId);
  const all = [1, 12, 24].map((hours) => ({
    hours,
    capturedAt: new Date(Date.UTC(2026, 9, 22, 24 - hours)).toISOString(),
    extensions: ["pstdio-planner", "pstdio-notes"],
  }));
  let points = all;
  let rejectRestore = true;
  let restored: unknown;
  await page.route(`**/v1/projects/${projectId}/recovery-points`, (route) => route.fulfill({ json: points }));
  await page.route(`**/v1/projects/${projectId}/restore`, async (route) => {
    restored = route.request().postDataJSON();
    await route.fulfill(
      rejectRestore
        ? { status: 409, json: { error: "This recovery point changed or is no longer available. Refresh the list." } }
        : { json: { extensions: ["pstdio-notes"], records: 1 } },
    );
  });
  await page.goto(`/projects/${projectId}`);
  await page.getByText("Settings", { exact: true }).last().click();
  await page.getByRole("dialog").last().getByText("Recovery", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Choose", exact: true })).toHaveCount(3);
  await page.getByRole("button", { name: "Choose", exact: true }).first().click();
  const confirmation = page.getByRole("dialog").last();
  await expect(confirmation.getByText("Restore project data?", { exact: true })).toBeVisible();
  await confirmation.getByRole("button", { name: "Restore scope" }).click();
  await page.getByRole("menuitem", { name: "pstdio-notes", exact: true }).click();
  await confirmation.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(
    confirmation.getByText("This recovery point changed or is no longer available. Refresh the list."),
  ).toBeVisible();
  expect(restored).toEqual({ hours: 1, capturedAt: all[0]!.capturedAt, extensionId: "pstdio-notes" });
  rejectRestore = false;
  await confirmation.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Restore saved", { exact: true })).toBeVisible();
  points = [all[1]!];
  await page.getByRole("button", { name: "Refresh recovery points" }).click();
  await expect(page.getByRole("button", { name: "Choose", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Choose", exact: true }).click();
  await page.getByRole("dialog").last().getByRole("button", { name: "Restore", exact: true }).click();
  expect(restored).toEqual({ hours: 12, capturedAt: all[1]!.capturedAt });
  points = [];
  await page.getByRole("button", { name: "Refresh recovery points" }).click();
  await expect(page.getByText(/No recovery points on this device yet/)).toBeVisible();
});
