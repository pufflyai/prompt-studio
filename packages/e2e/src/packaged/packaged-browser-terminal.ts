import { expect, type Page } from "@playwright/test";

export const verifyPackagedTerminal = async (page: Page, origin: string, projectId: string, token: string) => {
  await page.goto(`${origin}/projects/${projectId}`);
  await page.getByTestId("start-page").waitFor();
  const connection = page.waitForEvent("websocket", (socket) => new URL(socket.url()).pathname === "/v1/terminal");
  const showSecondary = page.getByRole("button", { name: "Show Secondary Panel" });
  if (await showSecondary.isVisible()) await showSecondary.click();
  await page.locator('[data-workbench-panel-header="secondary"]').getByRole("button", { name: "Add panel" }).click();
  const socket = await connection;
  expect(new URL(socket.url()).origin).toBe(origin.replace(/^http/, "ws"));
  expect(socket.url().includes(token)).toBe(false);
  const terminalInput = page.getByRole("textbox", { name: "Terminal input" });
  await terminalInput.pressSequentially("printf '__pstdio_%s__\\n' packaged_terminal");
  await terminalInput.press("Enter");
  await expect(page.locator(".xterm:visible .xterm-rows")).toContainText("__pstdio_packaged_terminal__");
  const closed = socket.waitForEvent("close");
  await terminalInput.pressSequentially("exit");
  await terminalInput.press("Enter");
  await closed;
};
