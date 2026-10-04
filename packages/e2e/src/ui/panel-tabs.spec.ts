import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";

const getVerticalMenuGap = async (
  tab: import("@playwright/test").Locator,
  menu: import("@playwright/test").Locator,
) => {
  const tabBox = await tab.boundingBox();
  const menuBox = await menu.boundingBox();
  if (!tabBox || !menuBox) throw new Error("Tab menu geometry is unavailable");
  return Math.abs(menuBox.y - (tabBox.y + tabBox.height));
};

const openTabCustomMenu = async (tab: import("@playwright/test").Locator) => {
  await tab.click({ button: "right" });
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  for (const project of (await response.json()) as Array<{ id: string }>) {
    expect((await request.delete(`${apiBase}/v1/projects/${project.id}`)).ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext, folderPath?: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "PS-169 Panel tabs" }, folderPath),
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

test("opens the Session tab context menu while normal clicks only select", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
  }, project.id);
  await page.setViewportSize({ width: 1280, height: 720 });
  const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "Inspect Session tab menu" });
  await page.goto(`/projects/${project.id}/tickets`);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await page.getByText(ticket.content, { exact: true }).click();

  const nav = page.locator('[data-workbench-region="nav"]');
  await nav.getByRole("button", { name: "Show Side Panel" }).click();
  await page.locator('[data-workbench-panel-header="side"]').getByRole("button", { name: "Add panel" }).click();
  const sessionChoice = page
    .getByRole("menu", { name: "Add panel" })
    .getByRole("menuitem", { name: "Session", exact: true });
  if (await sessionChoice.isVisible()) await sessionChoice.click();
  await expect(page.locator('[data-workbench-panel-header="side"]').getByRole("tab")).toHaveCount(1);
  const sessionTab = page.locator('[data-workbench-panel-header="side"]').getByRole("tab", {
    name: /New session/,
    selected: true,
  });
  await expect(sessionTab).toBeVisible();
  await sessionTab.click();
  await sessionTab.click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await openTabCustomMenu(sessionTab);

  const sessionMenu = page.getByRole("menu", { name: "New session context menu" });
  await expect(sessionMenu).toBeVisible();
  await expect(sessionMenu.getByRole("menuitem", { name: "New session" })).toBeVisible();
  await expect(sessionMenu.getByRole("menuitem", { name: "View all sessions" })).toBeVisible();
  await expect(sessionMenu.getByRole("menuitem", { name: "No sessions yet" })).toBeVisible();

  await expect.poll(() => getVerticalMenuGap(sessionTab, sessionMenu)).toBeLessThanOrEqual(1);
});

test("keeps panel drags in the tab row and supports pointer and keyboard reorder", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  await page.addInitScript((id: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByText("Project home", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show Secondary Panel", exact: true }).click();
  const header = page.locator('[data-workbench-panel-header="secondary"]');
  for (let index = 0; index < 3; index += 1) {
    await header.getByRole("button", { name: "Add panel", exact: true }).click();
    const terminalChoice = page
      .getByRole("menu", { name: "Add panel" })
      .getByRole("menuitem", { name: "Terminal", exact: true });
    if (await terminalChoice.isVisible()) await terminalChoice.click();
    await expect(header.getByRole("tab")).toHaveCount(index + 1);
  }
  const tabs = header.getByRole("tab");
  const ids = await tabs.evaluateAll((elements) => elements.map((element) => element.id));
  const first = page.locator(`[id="${ids[0]}"]`);
  const viewport = header
    .locator('[data-scope="scroll-area"][data-part="viewport"]')
    .filter({ has: page.getByRole("tablist") });
  for (const offset of [60, -60]) {
    const box = (await first.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + Math.sign(offset) * 10, { steps: 3 });
    await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + offset, { steps: 8 });
    await expect
      .poll(() =>
        viewport.evaluate((element) => ({
          top: element.scrollTop,
          overflow: element.scrollHeight - element.clientHeight,
        })),
      )
      .toEqual({ top: 0, overflow: 0 });
    await page.mouse.up();
  }
  const start = (await first.boundingBox())!;
  const end = (await tabs.last().boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2, { steps: 3 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 });
  await page.mouse.up();
  const order = () => tabs.evaluateAll((elements) => elements.map((element) => element.id));
  await expect.poll(order).toEqual([ids[1], ids[2], ids[0]]);
  await first.press("Alt+ArrowLeft");
  await expect.poll(order).toEqual([ids[1], ids[0], ids[2]]);
  await first.press("Alt+ArrowRight");
  await expect.poll(order).toEqual([ids[1], ids[2], ids[0]]);
});
