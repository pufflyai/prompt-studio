import { expect, test } from "@playwright/test";
import {
  createResourceActionsProject,
  openSessionSidePanel,
  prepareResourceActionsDashboard,
} from "./helpers/resource-actions";

test("Session menus share resource actions and switch through the full history", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  const titles = [
    "Keep open",
    "Inspect this session",
    ...Array.from({ length: 65 }, (_, i) => `History ${String(i).padStart(2, "0")}`),
  ];
  for (const title of titles) {
    expect(
      (
        await request.post("/v1/sessions", {
          data: { project_id: project.id, title, prompt: "", agent: "pstdio.workbench-fixture.harness.fake" },
        })
      ).ok(),
    ).toBe(true);
  }
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  const nav = page.locator('[data-workbench-region="sidenav"]');
  await expect(nav.getByRole("option", { name: "History 64", exact: true })).toBeVisible();
  // The oldest sessions are outside the virtualized viewport until it is scrolled.
  await nav.locator('[data-scope="scroll-area"][data-part="viewport"]').evaluateAll((elements) => {
    for (const element of elements) element.scrollTop = element.scrollHeight;
  });
  await nav.getByRole("option", { name: "Keep open", exact: true }).click();
  const route = page.url();
  await nav.getByRole("option", { name: "Inspect this session", exact: true }).click({ button: "right" });
  const resourceGroup = () => page.getByRole("group", { name: "Session", exact: true });
  const expected = await resourceGroup().getByRole("menuitem").allTextContents();
  await page.keyboard.press("Escape");
  await openSessionSidePanel(page, "Inspect this session");
  await expect(page).toHaveURL(route);
  const side = page.locator('[data-workbench-panel-header="side"]');
  await side.getByRole("tab", { name: "Inspect this session", exact: true }).click({ button: "right" });
  await expect(resourceGroup().getByRole("menuitem")).toHaveText(expected);
  await expect(page.getByRole("group", { name: "Sessions", exact: true }).getByRole("menuitem")).toHaveText([
    "New session",
    "Switch session",
  ]);
  await expect(page.getByRole("group", { name: "Tab", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Switch session", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Switch session", exact: true });
  const search = picker.getByRole("textbox");
  await expect(search).toBeFocused();
  const options = picker.getByRole("option");
  await expect.poll(() => options.count()).toBeGreaterThan(0);
  expect(await options.count()).toBeLessThan(titles.length);
  const viewport = picker.locator('[data-scope="scroll-area"][data-part="viewport"]');
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(picker.getByRole("option", { name: /Keep open$/ })).toBeVisible();
  await search.fill("history 00");
  await expect(options).toHaveText(["History 00"]);
  await expect(picker.getByRole("img", { name: "Session status: completed" })).toBeVisible();
  const sessions = await (await request.get(`/v1/sessions?project_id=${project.id}`)).json();
  const history = sessions.find((session: { title: string }) => session.title === "History 00");
  try {
    expect(
      (await request.patch(`/v1/sessions/${history.id}/title`, { data: { title: "History 00 updated" } })).ok(),
    ).toBe(true);
    await expect(options).toHaveText(["History 00 updated"]);
    await expect(search).toHaveValue("history 00");
    await expect(search).toBeFocused();
  } finally {
    await request.patch(`/v1/sessions/${history.id}/title`, { data: { title: "History 00" } });
  }
  await expect(options).toHaveText(["History 00"]);
  await search.fill("history 01");
  await search.fill("HISTORY 02");
  await expect(options).toHaveText(["History 02"]);
  await search.fill("no matching session");
  await expect(picker).toContainText("No resources found");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect.poll(() => options.count()).toBeGreaterThan(1);
  await search.fill("History 00");
  await search.press("Enter");
  await expect(picker).toBeHidden();
  await expect(side.getByRole("tab", { name: "History 00", exact: true })).toBeVisible();
  await expect(page).toHaveURL(route);
  await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
  await expect(resourceGroup().getByRole("menuitem")).toHaveText(expected);
  await expect(page.getByRole("menuitem", { name: "Copy link", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Switch session", exact: true }).click();
  await picker.getByRole("textbox").fill("History 01");
  await picker.getByRole("textbox").press("Enter");
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("History 01");
  await expect(side.getByRole("tab", { name: "History 00", exact: true })).toBeVisible();
});
