import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { uiOrigin as apiBase } from "../ui-server";

const setup = async (page: Page, request: APIRequestContext) => {
  const project = await (await request.post(`${apiBase}/v1/projects`, { data: { name: "Live sessions" } })).json();
  const sessions: { id: string; title: string }[] = [];
  for (const title of ["Session A", "Session B"]) {
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: { project_id: project.id, title, prompt: title, agent: "pstdio.workbench-fixture.harness.fake" },
    });
    expect(response.ok()).toBe(true);
    sessions.push(await response.json());
  }
  await expect
    .poll(async () => (await (await request.get(`${apiBase}/v1/sessions/${sessions[0]!.id}`)).json()).status)
    .toBe("completed");
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);
  await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  await page.getByRole("button", { name: "Reattach Side Panel", exact: true }).click();
  const header = page.locator('[data-workbench-panel-header="side"]');
  for (const session of sessions) {
    const draft = header.getByRole("tab", { name: "New session", exact: true });
    if ((await draft.count()) === 0) await header.getByRole("button", { name: "Add panel", exact: true }).click();
    await draft.click();
    await page.getByRole("menuitem", { name: session.title, exact: true }).click();
  }
  return { header, sessions };
};

test("updates active and inactive session tab indicators from live state", async ({ page, request }) => {
  const { header, sessions } = await setup(page, request);
  const tab = header.getByRole("tab", { name: "Session A", exact: true });
  const other = header.getByRole("tab", { name: "Session B", exact: true });
  for (const active of [false, true]) {
    if (active) await tab.click();
    for (const status of ["in_progress", "awaiting_input", "failed", "cancelled", "disconnected", "completed"]) {
      const response = await request.patch(`${apiBase}/v1/sessions/${sessions[0]!.id}/status`, { data: { status } });
      expect(response.ok()).toBe(true);
      await expect(tab.locator(`[aria-label="Session status: ${status}"]`)).toBeVisible();
      await expect(other.locator('[aria-label="Session status: completed"]')).toBeVisible();
    }
  }
});
