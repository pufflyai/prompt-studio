import { type APIRequestContext, expect, type Page } from "@playwright/test";

export const resourceActionsApiBase = `http://localhost:${Number(process.env.E2E_API_PORT ?? "3200")}`;
const apiBase = resourceActionsApiBase;

export const createResourceActionsProject = async (request: APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "Resource Actions" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

export const prepareResourceActionsDashboard = async (page: Page, projectId: string, repoId: string) => {
  await page.addInitScript(
    ({ selectedProjectId, selectedRepoId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
      localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.workbench-fixture.harness.fake",
            lastSelectedModels: [],
            lastSelectedRepo: selectedRepoId,
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { selectedProjectId: projectId, selectedRepoId: repoId },
  );
};

export const expectResourceMenuItems = async (page: Page, labels: string[]) => {
  for (const label of labels) {
    await expect(page.getByRole("menuitem", { name: label, exact: true })).toBeVisible();
  }
};
