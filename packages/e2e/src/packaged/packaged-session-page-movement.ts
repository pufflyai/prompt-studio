import { expect, type Page } from "@playwright/test";

export const verifySessionPageMovement = async (page: Page, baseUrl: string, projectId: string) => {
  await page.goto(`${baseUrl}/projects/${projectId}/sessions`);
  const editor = page.getByTestId("content-editable").filter({ visible: true });
  await editor.fill("Packaged page draft");
  await editor.evaluate((node) => {
    (window as Window & { retainedComposer?: Element }).retainedComposer = node;
  });
  const url = page.url();
  const instanceId = await page
    .locator("[data-workbench-instance]")
    .filter({ has: editor })
    .getAttribute("data-workbench-instance");
  for (const [label, region] of [
    ["Side", "side"],
    ["Bottom", "secondary"],
    ["Main", "main"],
  ]) {
    const control = page
      .locator(`[data-workbench-page-drag="${instanceId}"], [data-workbench-tab="${instanceId}"] [role="tab"]`)
      .filter({ visible: true });
    await control.focus();
    await control.press("Shift+F10");
    await page.getByRole("menuitem", { name: `Move to ${label}`, exact: true }).click();
    await expect(page.locator(`[data-workbench-panel="${region}"]`).getByTestId("content-editable")).toHaveText(
      "Packaged page draft",
    );
    expect(
      await editor.evaluate((node) => node === (window as Window & { retainedComposer?: Element }).retainedComposer),
    ).toBe(true);
    expect(page.url()).toBe(url);
  }
  await page.reload();
  await expect(editor).toHaveText("Packaged page draft");
};
