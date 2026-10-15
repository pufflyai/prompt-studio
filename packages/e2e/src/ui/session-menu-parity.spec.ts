import { expect, test } from "@playwright/test";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

test("Session menus share resource actions and search the full history with lazy loading", async ({
  page,
  request,
}) => {
  const project = await createResourceActionsProject(request);
  const titles = [
    "Keep open",
    "Inspect this session",
    ...Array.from({ length: 45 }, (_, index) => `History ${String(index).padStart(2, "0")}`),
  ];
  let primarySessionId = "";
  for (const title of titles) {
    const response = await request.post("/v1/sessions", {
      data: { project_id: project.id, title, prompt: "", agent: "pstdio.workbench-fixture.harness.fake" },
    });
    expect(response.ok()).toBe(true);
    const session = await response.json();
    if (title === "Keep open") primarySessionId = session.id;
  }
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  const nav = page.locator('[data-workbench-region="sidenav"]');
  await nav.getByRole("option", { name: "Keep open", exact: true }).click();
  const route = page.url();
  await nav.getByRole("option", { name: "Inspect this session", exact: true }).click({ button: "right" });
  const resourceGroup = () => page.getByRole("group", { name: "Session", exact: true });
  const expected = await resourceGroup().getByRole("menuitem").allTextContents();
  await page.getByRole("menuitem", { name: "Open session panel", exact: true }).click();
  await expect(page).toHaveURL(route);
  const tab = page
    .locator('[data-workbench-panel-header="side"]')
    .getByRole("tab", { name: "Inspect this session", exact: true });
  await tab.click({ button: "right" });
  await expect(resourceGroup().getByRole("menuitem")).toHaveText(expected);
  await expect(page.getByRole("group", { name: "Tab", exact: true })).toBeVisible();
  const results = page.getByRole("group", { name: "Search sessions", exact: true });
  await expect(results.getByRole("menuitem")).toHaveCount(20);
  await results.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(results.getByRole("menuitem")).toHaveCount(40);
  const search = page.getByRole("textbox", { name: "Search sessions", exact: true });
  await search.focus();
  const renamed = await request.patch(`/v1/sessions/${primarySessionId}/title`, {
    data: { title: "Keep open updated" },
  });
  expect(renamed.ok()).toBe(true);
  await expect(nav.getByRole("option", { name: "Keep open updated", exact: true })).toBeVisible();
  await expect(results.getByRole("menuitem")).toHaveCount(40);
  await expect(search).toBeFocused();
  await results.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(results.getByRole("menuitem")).toHaveCount(titles.length);
  await search.fill("history 00");
  await expect(results.getByRole("menuitem")).toHaveText(["History 00"]);
  await expect(search).toBeFocused();
  await search.fill("history 01");
  await search.fill("HISTORY 02");
  await expect(results.getByRole("menuitem")).toHaveText(["History 02"]);
  await search.fill("no matching session");
  await expect(results).toContainText("No matching results");
  await search.fill("");
  await expect(results.getByRole("menuitem")).toHaveCount(20);
  await search.fill("History 00");
  await expect(results.getByRole("menuitem")).toHaveText(["History 00"]);
  await search.press("ArrowDown");
  await expect(page.getByRole("menu")).toBeFocused();
  await expect(results.getByRole("menuitem").first()).toHaveAttribute("data-highlighted");
  await page.keyboard.press("Enter");
  await expect(
    page.locator('[data-workbench-panel-header="side"]').getByRole("tab", { name: "History 00", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(route);
  await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
  await expect(resourceGroup().getByRole("menuitem")).toHaveText(expected);
  await expect(page.getByRole("group", { name: "Tab", exact: true })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Copy link", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search sessions", exact: true }).fill("History 00");
  await expect(page.getByRole("group", { name: "Search sessions", exact: true }).getByRole("menuitem")).toHaveText([
    "History 00",
  ]);
});
