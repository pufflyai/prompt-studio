import { expect, test } from "@playwright/test";
import { getSharedStorybookBaseUrl } from "../../scripts/storybook-server";
import { waitForStoryPlayback } from "../storybook";

test("a project switch keeps the shell mounted and starts project views fresh", async ({ page }) => {
  const baseUrl = getSharedStorybookBaseUrl("pstdio-workbench");
  await page.goto(`${baseUrl}/iframe.html?id=pstdio-workbench-guides-project-switch--keeps-shell-mounted`);
  await waitForStoryPlayback(page);
  await expect(page.getByText("Project A content", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Notes edited 0 times" }).click();
  await expect(page.getByRole("button", { name: "Notes edited 1 times" })).toBeVisible();
  const shell = await page.evaluateHandle(() =>
    ['[data-workbench-panel="main"]', '[data-workbench-region="nav"]', '[data-workbench-region="status"]'].map(
      (selector) => document.querySelector(selector),
    ),
  );
  const connected = () => shell.evaluate((elements) => elements.map((element) => element?.isConnected ?? false));
  expect(await connected()).toEqual([true, true, true]);

  await page.getByRole("button", { name: "Open Project B" }).click();

  await expect(page.getByText("Project B content", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notes edited 0 times" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notes edited 1 times" })).toHaveCount(0);
  expect(await connected()).toEqual([true, true, true]);
});
