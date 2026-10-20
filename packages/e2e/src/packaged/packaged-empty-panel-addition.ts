import { expect, type Locator, type Page } from "@playwright/test";

const watchNewTabs = (header: Locator) =>
  header.evaluateHandle((element) => {
    let added = false;
    const inspect = (records: MutationRecord[]) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof Element && (node.matches('[role="tab"]') || node.querySelector('[role="tab"]')))
            added = true;
    };
    const observer = new MutationObserver(inspect);
    observer.observe(element, { childList: true, subtree: true });
    return {
      stop() {
        inspect(observer.takeRecords());
        observer.disconnect();
        return added;
      },
    };
  });

export const verifyEmptyPanelAddition = async (page: Page) => {
  const side = page.locator('[data-workbench-panel-header="side"]');
  const bottom = page.locator('[data-workbench-panel-header="secondary"]');
  const showSide = page.getByRole("button", { name: "Show Side Panel", exact: true });
  const showBottom = page.getByRole("button", { name: "Show Bottom Panel", exact: true });
  if (await showSide.isVisible()) await showSide.click();
  if (await showBottom.isVisible()) await showBottom.click();
  await expect(side).toBeVisible();
  const closeSelected = async (region: typeof side) => {
    await region.getByRole("tab", { selected: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
  };
  await expect(side.getByRole("tab")).toHaveCount(0);
  await expect(bottom.getByRole("tab")).toHaveCount(0);
  const bottomTabs = await watchNewTabs(bottom);
  await side.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Terminal", exact: true }).click();
  await expect(side.getByRole("tab", { selected: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide Bottom Panel", exact: true })).toBeVisible();
  await expect(bottom.getByRole("tab")).toHaveCount(0);
  expect(await bottomTabs.evaluate((watcher) => watcher.stop())).toBe(false);
  await bottomTabs.dispose();
  await closeSelected(side);
  await expect(side.getByRole("tab")).toHaveCount(0);
  await showSide.click();
  const sideTabs = await watchNewTabs(side);
  await bottom.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Session", exact: true }).click();
  await expect(bottom.getByRole("tab", { selected: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide Side Panel", exact: true })).toBeVisible();
  await expect(side.getByRole("tab")).toHaveCount(0);
  expect(await sideTabs.evaluate((watcher) => watcher.stop())).toBe(false);
  await sideTabs.dispose();
};
