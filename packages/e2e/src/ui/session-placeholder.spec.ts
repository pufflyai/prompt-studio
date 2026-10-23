import { test } from "@playwright/test";
import { verifySessionPlaceholder } from "../helpers/session-placeholder";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

test("Sessions creates a real session tab from its placeholder and restores it after closing", async ({
  page,
  request,
}) => {
  const project = await createResourceActionsProject(request);
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await verifySessionPlaceholder(page);
});
