import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { folderProjectInput } from "../../helpers/folder-project";
import { uiOrigin as apiBase } from "../../ui-server";

export const createResourceActionsProject = async (request: APIRequestContext, folderPath?: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Resource Actions" }, folderPath),
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

export const prepareResourceActionsDashboard = async (page: Page, projectId: string) => {
  await page.addInitScript(
    ({ selectedProjectId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
      localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.workbench-fixture.harness.fake",
            lastSelectedModels: [],
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { selectedProjectId: projectId },
  );
};

export const expectResourceMenuItems = async (page: Page, labels: string[]) => {
  for (const label of labels) {
    await expect(page.getByRole("menuitem", { name: label, exact: true })).toBeVisible();
  }
};
