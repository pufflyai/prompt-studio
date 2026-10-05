import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";

test("dragging a terminal into headerless Main retains its live view and shell state", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Arrange a live terminal" }),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  await page.addInitScript((id: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);
  await expect(page.getByText("Project home", { exact: true })).toBeVisible();
  const originalUrl = page.url();
  const main = page.getByRole("region", { name: "Main", exact: true });
  const mainHeader = page.locator('[data-workbench-panel-header="main"]');
  await expect(mainHeader).not.toBeVisible();
  await page.getByRole("button", { name: "Show Secondary Panel", exact: true }).click();
  const secondary = page.locator('[data-workbench-panel-header="secondary"]');
  await secondary.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Terminal", exact: true }).click();
  const terminal = page.locator(".xterm:visible");
  await expect(terminal).toHaveCount(1);
  await terminal.evaluate((element) => {
    (window as Window & { retainedTerminal?: Element }).retainedTerminal = element;
  });
  await terminal.click();
  const input = page.getByRole("textbox", { name: "Terminal input" });
  await input.pressSequentially("export ARRANGEMENT_STATE=kept");
  await input.press("Enter");
  const tab = secondary.getByRole("tab");
  const instanceId = await tab.locator("..").getAttribute("data-workbench-tab");
  const start = (await tab.boundingBox())!;
  const target = (await main.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, target.y + 4, { steps: 12 });
  await page.mouse.up();
  await expect(mainHeader.getByRole("tab")).toHaveCount(2);
  const moved = mainHeader.locator(`[data-workbench-tab="${instanceId}"]`).getByRole("tab");
  await expect(moved).toHaveAttribute("aria-selected", "true");
  expect(
    await terminal.evaluate(
      (element) => element === (window as Window & { retainedTerminal?: Element }).retainedTerminal,
    ),
  ).toBe(true);
  await terminal.click();
  await input.pressSequentially('printf "__arrangement_%s__\\n" "$ARRANGEMENT_STATE"');
  await input.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText("__arrangement_kept__");
  expect(page.url()).toBe(originalUrl);
  await expect(secondary.getByRole("tab")).toHaveCount(0);
  await moved.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Reset layout", exact: true }).click();
  await expect(mainHeader).not.toBeVisible();
  await expect(page.getByText("Project home", { exact: true })).toBeVisible();
});
