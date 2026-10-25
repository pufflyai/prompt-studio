import { expect, test } from "@playwright/test";
import { verifyPageHeaders } from "../helpers/home-loading";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

test("tabless page navigation keeps Main free of tab headers", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/`);
  await expect(page.getByTestId("start-page")).toBeVisible();
  await verifyPageHeaders(page);
});
