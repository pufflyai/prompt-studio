import { test } from "@playwright/test";
import { verifySessionTools } from "../helpers/session-tools";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

test("Sessions creates in Main and preserves independent Side session tools", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await verifySessionTools(page);
});
