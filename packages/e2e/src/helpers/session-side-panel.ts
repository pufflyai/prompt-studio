import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { uiOrigin as apiBase } from "../ui-server";
import { folderProjectInput } from "./folder-project";

export const fakeHarnessId = "pstdio.workbench-fixture.harness.fake";

export const openSessionsInSidePanelTabs = async (page: Page, request: APIRequestContext, projectName: string) => {
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
  await page.goto(`/projects/${project.id}/sessions`);
  const header = page.locator('[data-workbench-panel-header="side"]');
  for (const session of sessions) {
    const row = page.locator('[data-workbench-region="sidenav"]').getByRole("option", {
      name: session.title,
      exact: true,
    });
    await row.focus();
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menuitem", { name: "Open session panel", exact: true }).click();
    const tab = page.getByRole("tab", { name: session.title, exact: true });
    await expect(tab).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await tab.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Pin tab", exact: true }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    const reattach = page.getByRole("button", { name: "Reattach Side Panel", exact: true });
    if (await reattach.isVisible()) await reattach.click();
  }
  const selectSession = async (title: string) => {
    const tab = header.getByRole("tab", { name: title, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  };
  return { header, project: project as { id: string }, sessions, selectSession };
};
