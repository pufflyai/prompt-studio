import { expect, test } from "@playwright/test";
import { expectNoDefaultHomePlaceholder, observeHomeLoading } from "../helpers/home-loading";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

test("Home loads its own content without showing the default Tools placeholder", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  await prepareResourceActionsDashboard(page, project.id);
  await observeHomeLoading(page);
  await page.goto(`/projects/${project.id}/`);
  await expect(page.getByTestId("start-page")).toBeVisible();
  await expectNoDefaultHomePlaceholder(page);
});
