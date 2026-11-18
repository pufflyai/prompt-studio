import { expect, test } from "../scripts/session-test";
import {
  createResourceActionsProject,
  openSessionSidePanel,
  prepareResourceActionsDashboard,
} from "./helpers/resource-actions";

test("a session's state updates its resource icon across navigation, breadcrumb, tab, and search", async ({
  page,
  request,
}) => {
  const project = await createResourceActionsProject(request);
  const title = "Shared resource icon";
  const response = await request.post("/v1/sessions", {
    data: { project_id: project.id, title, prompt: "", agent: "pstdio.workbench-fixture.harness.fake" },
  });
  expect(response.ok()).toBe(true);
  const session = await response.json();
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/extensions/pstdio.session-browser/conversations`);
  const row = page.locator('[data-workbench-region="sidenav"]').getByRole("option", { name: title, exact: true });
  await row.click();
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
  await expect(breadcrumb).toContainText(title);
  for (const status of ["in_progress", "failed"]) {
    expect((await request.patch(`/v1/sessions/${session.id}/status`, { data: { status } })).ok()).toBe(true);
    const label = `Session status: ${status}`;
    await expect(breadcrumb.locator(`[aria-label="${label}"]`)).toBeVisible();
    await expect(row.locator(`[aria-label="${label}"]`)).toBeVisible();
  }
  // Switching to an already displayed resource focuses its existing viewer. Leave Main
  // before selecting this session in Side so the test exercises a real Side placement.
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await expect(breadcrumb).toHaveText("Home");
  await openSessionSidePanel(page, title);
  await page.keyboard.press("Escape");
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(row).toBeVisible();
  const tab = page.locator('[data-workbench-panel-header="side"]').getByRole("tab", { name: title, exact: true });

  for (const status of ["in_progress", "failed"]) {
    expect((await request.patch(`/v1/sessions/${session.id}/status`, { data: { status } })).ok()).toBe(true);
    const label = `Session status: ${status}`;
    await expect(row.locator(`[aria-label="${label}"]`)).toBeVisible();
    await expect(tab.locator(`[aria-label="${label}"]`)).toBeVisible();
  }
  await tab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Switch session", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Switch session", exact: true });
  await picker.getByRole("textbox").fill(title);
  await expect(picker.getByRole("img", { name: "Session status: failed" })).toBeVisible();
});
