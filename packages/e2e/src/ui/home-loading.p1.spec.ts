import { expect, test } from "@playwright/test";
import {
  expectNoDefaultHomePlaceholder,
  observeHomeLoading,
  verifyFastHeaderNavigation,
  verifyPageHeaderChoices,
} from "../helpers/home-loading";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

test("Home loads its own content without showing the default Tools placeholder", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  await prepareResourceActionsDashboard(page, project.id);
  await observeHomeLoading(page);
  await page.goto(`/projects/${project.id}/`);
  await expect(page.getByTestId("start-page")).toBeVisible();
  await expectNoDefaultHomePlaceholder(page);
});

test("Home keeps its hidden header when another page opens its header", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/`);
  await expect(page.getByTestId("start-page")).toBeVisible();
  await verifyPageHeaderChoices(page);
});

test("a Home header action applies before immediate navigation to Sessions", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/`);
  await expect(page.getByTestId("start-page")).toBeVisible();
  await verifyFastHeaderNavigation(page);
});
