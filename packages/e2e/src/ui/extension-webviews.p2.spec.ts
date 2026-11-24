import { test as terminalTest } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/webview-test";
import { uiOrigin } from "../ui-server";

test("isolated webviews preserve project storage and live updates, then dispose when disabled", async ({
  page,
  request,
}) => {
  const projects: string[] = [];
  const create = async () => {
    const response = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "Webview contract" }),
    });
    expect(response.ok()).toBe(true);
    const project = await response.json();
    projects.push(project.id);
    return project.id as string;
  };
  const open = async (project: string) => {
    await page.goto(`/projects/${project}/extensions/test.webview-host/host`);
    const iframe = page.locator('iframe[title="Host page"]');
    await expect(iframe.contentFrame().getByRole("heading", { name: "Host contract" })).toBeVisible();
    return iframe;
  };
  try {
    const first = await create();
    const second = await create();
    const iframe = await open(first);
    const guest = iframe.contentFrame();
    await expect(iframe).not.toHaveAttribute("sandbox", /allow-same-origin/);
    const frame = await (await iframe.elementHandle())!.contentFrame();
    await frame!.evaluate(() => Reflect.set(window, "retainedMarker", "original"));
    const response = await request.post(
      `${uiOrigin}/v1/projects/${first}/extensions/commands/test.webview-host.command.bump/execute`,
      { data: { params: {} } },
    );
    expect(response.ok()).toBe(true);
    await expect(guest.getByLabel("Counter")).toHaveText("1");
    expect(await frame!.evaluate(() => Reflect.get(window, "retainedMarker"))).toBe("original");
    await page.reload();
    await expect(guest.getByLabel("Counter")).toHaveText("1");
    await open(second);
    await expect(guest.getByLabel("Counter")).toHaveText("0");
    await open(first);
    await expect(guest.getByLabel("Counter")).toHaveText("1");
    const inventory = await (await request.get(`${uiOrigin}/v1/projects/${first}/extensions`)).json();
    const extension = inventory.extensions.find(
      (entry: { installName: string }) => entry.installName === "webview-host",
    );
    expect(extension).toBeTruthy();
    expect(
      (
        await request.patch(`${uiOrigin}/v1/projects/${first}/extensions/${extension.id}`, { data: { enabled: false } })
      ).ok(),
    ).toBe(true);
    await expect(iframe).toHaveCount(0);
  } finally {
    for (const project of projects) await request.delete(`${uiOrigin}/v1/projects/${project}`);
  }
});

terminalTest("opens host terminal tabs from the Secondary Panel", async ({ page, request }) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Terminal tabs" }),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  try {
    const terminalRows = page.locator('[data-workbench-panel="secondary"] .xterm-rows:visible');
    const visibleTerminalText = async () => (await terminalRows.allTextContents()).join("\n");
    const expectVisibleTerminalOutput = async () => {
      // Playwright's last default interval can end a short poll before a late renderer appears.
      await expect.poll(visibleTerminalText, { timeout: 2000, intervals: [100] }).toMatch(/\S/);
      const text = await visibleTerminalText();
      expect(text).not.toContain("cannot set terminal process group");
      expect(text).not.toContain("no job control in this shell");
    };

    await page.addInitScript((projectId) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, project.id);
    await page.goto(`/projects/${project.id}`);

    const secondaryHeader = page.locator('[data-workbench-panel-header="secondary"]');
    const terminalTabList = secondaryHeader.getByRole("tablist");
    const terminalTabs = terminalTabList.getByRole("tab");
    const addTerminal = async () => {
      await expect(page.getByRole("region", { name: "Main", exact: true })).toBeVisible();
      const showSecondary = page.getByRole("button", { name: "Show Bottom Panel" });
      if (!(await secondaryHeader.isVisible())) await showSecondary.click();
      await secondaryHeader.getByRole("button", { name: "Add panel" }).click();
      await page.getByRole("menuitem", { name: "Open terminal", exact: true }).click();
    };

    await addTerminal();
    await expectVisibleTerminalOutput();

    await addTerminal();
    await expect(terminalTabs).toHaveCount(2);
    await expect(terminalTabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(terminalTabs.nth(1)).toHaveAccessibleName("Terminal 2");
    await expectVisibleTerminalOutput();

    await terminalTabs.first().click();
    await expect(terminalTabs.first()).toHaveAttribute("aria-selected", "true");
    await expectVisibleTerminalOutput();

    await page.getByRole("separator", { name: "Resize Secondary Panel" }).press("Home");
    await expect(page.getByRole("button", { name: "Show Bottom Panel" })).toBeVisible();
    await page.getByRole("button", { name: "Show Bottom Panel" }).click();
    await expectVisibleTerminalOutput();

    // Close the active terminal, then add another alongside the remaining content.
    await terminalTabs
      .first()
      .getByRole("button", { name: /^Close/ })
      .click();
    await addTerminal();
    await expect(terminalTabs).toHaveCount(2);
    await expectVisibleTerminalOutput();
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
  }
});
