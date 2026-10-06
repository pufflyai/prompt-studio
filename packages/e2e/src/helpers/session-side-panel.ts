import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { uiOrigin as apiBase } from "../ui-server";
import { folderProjectInput } from "./folder-project";

export const fakeHarnessId = "pstdio.workbench-fixture.harness.fake";

// Creates a project with two finished fake-harness sessions and shows both, one after the other, in
// a single Side Panel tab. The tab ends on the last session.
export const openSessionsInOneSidePanelTab = async (page: Page, request: APIRequestContext, projectName: string) => {
  const project = await (
    await request.post(`${apiBase}/v1/projects`, {
      data: folderProjectInput({ name: projectName, agents: [fakeHarnessId] }),
    })
  ).json();
  const sessions: { id: string; title: string }[] = [];
  for (const title of ["Session A", "Session B"]) {
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: { project_id: project.id, title, prompt: title, agent: fakeHarnessId },
    });
    expect(response.ok()).toBe(true);
    sessions.push(await response.json());
  }
  for (const session of sessions) {
    await expect
      .poll(async () => (await (await request.get(`${apiBase}/v1/sessions/${session.id}`)).json()).status)
      .toBe("completed");
  }
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    localStorage.setItem(
      `pstdio-dashboard:command-params:recent-harness:${projectId}`,
      JSON.stringify({ harnessId: "pstdio.workbench-fixture.harness.fake" }),
    );
  }, project.id);
  await page.goto(`/projects/${project.id}/`);
  await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  await page.getByRole("button", { name: "Reattach Side Panel", exact: true }).click();
  const header = page.locator('[data-workbench-panel-header="side"]');
  const switchTab = async (from: string, to: string) => {
    await header.getByRole("tab", { name: from, exact: true }).click({ button: "right" });
    await page
      .getByRole("menu", { name: `${from} context menu`, exact: true })
      .getByRole("menuitem", { name: to, exact: true })
      .click();
    await expect(header.getByRole("tab", { name: to, exact: true })).toBeVisible();
  };
  if ((await header.getByRole("tab", { name: "New session", exact: true }).count()) === 0) {
    await header.getByRole("button", { name: "Add panel", exact: true }).click();
    await page.getByRole("menuitem", { name: "Session", exact: true }).click();
  }
  await switchTab("New session", "Session A");
  await switchTab("Session A", "Session B");
  return { header, project: project as { id: string }, sessions, switchTab };
};
