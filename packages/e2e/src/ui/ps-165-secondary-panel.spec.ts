import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  for (const project of (await response.json()) as Array<{ id: string }>) {
    expect((await request.delete(`${apiBase}/v1/projects/${project.id}`)).ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-165 Secondary Panel" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((currentProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", currentProjectId);
  }, projectId);
};

const panelSize = async (separator: import("@playwright/test").Locator) =>
  Number(await separator.getAttribute("aria-valuenow"));

const getSecondaryHeader = (page: import("@playwright/test").Page) =>
  page.locator('[data-workbench-panel-header="secondary"]');

const addTerminal = async (page: import("@playwright/test").Page) => {
  await expect(page.getByRole("link", { name: "Start", exact: true })).toBeVisible();
  const showSecondary = page.getByRole("button", { name: "Show Secondary Panel" });
  if (await showSecondary.isVisible()) await showSecondary.click();
  await getSecondaryHeader(page).getByRole("button", { name: "Add panel" }).click();
};

const dragPanelToRawSize = async (
  page: import("@playwright/test").Page,
  separator: import("@playwright/test").Locator,
  rawSize: number,
) => {
  const box = await separator.boundingBox();
  expect(box).not.toBeNull();
  const startSize = await panelSize(separator);
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + startSize - rawSize);
  await page.mouse.up();
};

test("PS-165 starts the Secondary Panel closed and preserves that state after refresh", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  await bypassOnboarding(page, project.id);

  await page.goto(`/projects/${project.id}`);

  const showSecondary = page.getByRole("button", { name: "Show Secondary Panel" });
  await expect(showSecondary).toBeVisible();

  await addTerminal(page);
  const hideSecondary = page.getByRole("button", { name: "Hide Secondary Panel" });
  await expect(hideSecondary).toBeVisible();
  await hideSecondary.click();

  await page.reload();

  await expect(showSecondary).toBeVisible();
  await expect(page.getByRole("region", { name: "Secondary Panel" })).not.toBeVisible();
});

test("PS-165 resizes, drag-closes, and restores the live Secondary Panel", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  await bypassOnboarding(page, project.id);

  await page.goto(`/projects/${project.id}`);
  await addTerminal(page);

  const separator = page.getByRole("separator", { name: "Resize Secondary Panel" });
  const terminal = page.locator(".xterm").first();
  const terminalContainer = page.locator(".pstdio-terminal").first();
  const terminalScreen = terminal.locator(".xterm-screen");
  const secondaryPanel = page.getByRole("region", { name: "Secondary Panel" });
  await expect(separator).toBeVisible();
  await expect(separator).toHaveAttribute("aria-orientation", "horizontal");
  await expect(terminal).toBeVisible();

  const widths = await Promise.all([
    separator.evaluate((element) => element.getBoundingClientRect().width),
    secondaryPanel.evaluate((element) => element.getBoundingClientRect().width),
    terminalContainer.evaluate((element) => element.getBoundingClientRect().width),
    terminalScreen.evaluate((element) => element.getBoundingClientRect().width),
  ]);
  expect(widths[1]).toBeGreaterThan(widths[0] * 0.9);
  expect(widths[2]).toBeGreaterThan(widths[1] * 0.9);
  expect(widths[3]).toBeGreaterThan(widths[2] * 0.9);

  const mainNode = await page.getByRole("region", { name: "Main", exact: true }).elementHandle();
  const secondaryNode = await page.getByRole("region", { name: "Secondary Panel" }).elementHandle();
  const terminalHostNode = await page.locator(".pstdio-terminal").first().elementHandle();
  const terminalNode = await terminal.elementHandle();
  expect(mainNode).not.toBeNull();
  expect(secondaryNode).not.toBeNull();
  expect(terminalHostNode).not.toBeNull();
  expect(terminalNode).not.toBeNull();

  const initialSize = await panelSize(separator);
  await separator.press("ArrowUp");
  await expect(separator).toHaveAttribute("aria-valuenow", String(initialSize + 24));
  expect(await terminalNode!.evaluate((element) => element.isConnected)).toBe(true);

  await dragPanelToRawSize(page, separator, 320);
  await expect(separator).toHaveAttribute("aria-valuenow", "320");
  expect(await terminalNode!.evaluate((element) => element.isConnected)).toBe(true);

  await dragPanelToRawSize(page, separator, 73);
  await expect(separator).toBeVisible();
  await expect(separator).toHaveAttribute("aria-valuenow", "128");
  expect(await terminalNode!.evaluate((element) => element.isConnected)).toBe(true);

  await dragPanelToRawSize(page, separator, 320);
  await expect(separator).toHaveAttribute("aria-valuenow", "320");
  expect(await terminalNode!.evaluate((element) => element.isConnected)).toBe(true);
  await dragPanelToRawSize(page, separator, 72);

  await expect(separator).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Show Secondary Panel" })).toBeVisible();
  expect(await mainNode!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await secondaryNode!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await terminalHostNode!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await terminalNode!.evaluate((element) => element.isConnected)).toBe(true);

  await page.getByRole("button", { name: "Show Secondary Panel" }).click();
  await expect(separator).toBeVisible();
  await expect(separator).toHaveAttribute("aria-valuenow", "320");
  await expect(terminal).toBeVisible();
  expect(await mainNode!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await terminalNode!.evaluate((element) => element.isConnected)).toBe(true);
});

test("PS-165 restores terminal tabs and opens a unique tab after refresh", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  await bypassOnboarding(page, project.id);

  await page.goto(`/projects/${project.id}`);
  await addTerminal(page);

  const terminalTabList = getSecondaryHeader(page).getByRole("tablist");
  const terminalTabs = terminalTabList.getByRole("tab");
  await addTerminal(page);
  await expect(terminalTabs).toHaveCount(2);

  await page.reload();

  await expect(terminalTabs).toHaveCount(2);
  await expect(terminalTabList.getByRole("tab", { selected: true })).toHaveCount(1);
  await expect(terminalTabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".xterm")).toHaveCount(2);

  await addTerminal(page);
  await expect(terminalTabs).toHaveCount(3);
  await expect(terminalTabList.getByRole("tab", { selected: true })).toHaveCount(1);
  await expect(terminalTabs.nth(2)).toHaveAttribute("aria-selected", "true");

  await terminalTabs.first().click();
  await expect(terminalTabList.getByRole("tab", { selected: true })).toHaveCount(1);
  await expect(terminalTabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(terminalTabs.nth(2)).toHaveAttribute("aria-selected", "false");

  await terminalTabs.nth(1).click();
  await expect(terminalTabList.getByRole("tab", { selected: true })).toHaveCount(1);
  await expect(terminalTabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(terminalTabs.first()).toHaveAttribute("aria-selected", "false");

  await page.reload();

  await expect(terminalTabs).toHaveCount(3);
  await expect(terminalTabList.getByRole("tab", { selected: true })).toHaveCount(1);
  await expect(terminalTabs.nth(1)).toHaveAttribute("aria-selected", "true");

  await addTerminal(page);
  await expect(terminalTabs).toHaveCount(4);
  await expect(terminalTabList.getByRole("tab", { selected: true })).toHaveCount(1);
  await expect(terminalTabs.nth(3)).toHaveAttribute("aria-selected", "true");
});

test("PS-165 accepts input after rapidly opening five terminal sessions", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  await bypassOnboarding(page, project.id);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`/projects/${project.id}`);
  await addTerminal(page);

  const terminalTabList = getSecondaryHeader(page).getByRole("tablist");
  for (let index = 0; index < 4; index += 1) await addTerminal(page);

  const terminalInput = page.getByRole("textbox", { name: "Terminal input" });
  await expect(terminalInput).toBeFocused();
  await terminalInput.pressSequentially("echo __ps165_startup_input__");
  await terminalInput.press("Enter");

  await expect(terminalTabList.getByRole("tab")).toHaveCount(5);
  await expect(page.locator(".xterm:visible .xterm-rows")).toContainText("__ps165_startup_input__");
  expect(pageErrors).toEqual([]);
});
