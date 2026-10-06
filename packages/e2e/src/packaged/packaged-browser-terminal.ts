import { expect, type Page } from "@playwright/test";

export const verifyPackagedTerminal = async (page: Page, origin: string, projectId: string, token: string) => {
  await page.goto(`${origin}/projects/${projectId}/extensions/pstdio.workbench-fixture/lab`);
  const iframe = page.locator('iframe[title="Lab"]');
  await expect(iframe.contentFrame().getByRole("heading", { name: "Sandbox webview" })).toBeVisible();
  const connection = page.waitForEvent("websocket", (socket) => new URL(socket.url()).pathname === "/v1/terminal");
  const showSecondary = page.getByRole("button", { name: "Show Secondary Panel" });
  if (await showSecondary.isVisible()) await showSecondary.click();
  await page.locator('[data-workbench-panel-header="secondary"]').getByRole("button", { name: "Add panel" }).click();
  const choice = page.getByRole("menuitem", { name: "Terminal", exact: true });
  if (await choice.isVisible()) await choice.click();
  const socket = await connection;
  expect(new URL(socket.url()).origin).toBe(origin.replace(/^http/, "ws"));
  expect(socket.url().includes(token)).toBe(false);
  const terminalInput = page.getByRole("textbox", { name: "Terminal input" });
  await terminalInput.pressSequentially("printf '__pstdio_%s__\\n' packaged_terminal");
  await terminalInput.press("Enter");
  await expect(page.locator(".xterm:visible .xterm-rows")).toContainText("__pstdio_packaged_terminal__");
  await terminalInput.evaluate((element) => {
    (window as Window & { retainedTerminalInput?: Element }).retainedTerminalInput = element;
  });
  await terminalInput.pressSequentially("export PSTDIO_PACKAGED_STATE=retained");
  await terminalInput.press("Enter");
  const mainHeader = page.locator('[data-workbench-panel-header="main"]');
  await expect(mainHeader).toBeHidden();
  const terminalTab = page.locator('[data-workbench-panel-header="secondary"]').getByRole("tab");
  const start = (await terminalTab.boundingBox())!;
  const end = (await iframe.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2, { steps: 3 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(mainHeader.getByRole("tab")).toHaveCount(2);
  await expect(
    page.locator('[data-workbench-region="main"]').getByRole("textbox", { name: "Terminal input" }),
  ).toBeVisible();
  expect(
    await terminalInput.evaluate(
      (element) => element === (window as Window & { retainedTerminalInput?: Element }).retainedTerminalInput,
    ),
  ).toBe(true);
  await terminalInput.click();
  await terminalInput.pressSequentially('printf "__packaged_%s__\\n" "$PSTDIO_PACKAGED_STATE"');
  await terminalInput.press("Enter");
  await expect(page.locator(".xterm:visible .xterm-rows")).toContainText("__packaged_retained__");
  const closed = socket.waitForEvent("close");
  await terminalInput.pressSequentially("exit");
  await terminalInput.press("Enter");
  await closed;
};
