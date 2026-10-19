import { expect, type Locator, type Page } from "@playwright/test";

const tabAction = async (page: Page, tab: Locator, name: string) => {
  await tab.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name, exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
};

export const verifyModePanelState = async (page: Page, terminal: Locator) => {
  const bottom = page.locator('[data-workbench-panel="secondary"]:visible');
  let checkedModeSession = false;
  const modeRoundTrip = async () => {
    const previous = page.url();
    const destination = new URL(previous);
    destination.pathname = `/projects/${destination.pathname.split("/")[2]}/extensions/pstdio.workbench-fixture/lab-mode`;
    destination.search = "";
    await page.evaluate((url) => {
      window.history.pushState(null, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, destination.href);
    await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
    await expect(bottom).toHaveCount(0);
    await expect(terminal).toBeHidden();
    const status = page.frameLocator('iframe[title="Lab status"]:visible');
    await expect(status.getByText("Extension Lab", { exact: true })).toBeVisible();
    if (!checkedModeSession) {
      await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
      const floating = page.getByTestId("workbench-side-panel-floating");
      const composer = floating.locator('[data-testid="content-editable"][contenteditable="true"]');
      await expect(composer).toBeVisible();
      await composer.fill("Keep this extension mode draft after reload");
      const sessionTab = floating.getByRole("tab", { selected: true });
      await tabAction(page, sessionTab, "Pin tab");
      await page.reload();
      await expect(composer).toHaveText("Keep this extension mode draft after reload");
      checkedModeSession = true;
    }
    await page.goBack();
    await expect(page).toHaveURL(previous);
  };
  await tabAction(page, terminal, "Unpin tab");
  await modeRoundTrip();
  await expect(terminal).toBeVisible();
  await expect(terminal).toHaveCSS("font-style", "italic");
  await expect(terminal).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Hide Bottom Panel", exact: true }).click();
  await modeRoundTrip();
  await expect(bottom).toHaveCount(0);
  await page.getByRole("button", { name: "Show Bottom Panel", exact: true }).click();
  await tabAction(page, terminal, "Pin tab");

  const header = page.locator('[data-workbench-panel-header="secondary"]');
  await header.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Terminal", exact: true }).click();
  const temporary = header.getByRole("tab", { selected: true });
  await tabAction(page, temporary, "Unpin tab");
  await expect(header.getByRole("tab")).toHaveCount(2);
  const destination = new URL(page.url());
  destination.pathname = `/projects/${destination.pathname.split("/")[2]}/sessions`;
  destination.search = "";
  await page.evaluate((url) => {
    window.history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, destination.href);
  await expect(header.getByRole("tab")).toHaveCount(1);
  await expect(terminal).toBeVisible();
  await page.goBack();
  await expect(header.getByRole("tab")).toHaveCount(1);
};
