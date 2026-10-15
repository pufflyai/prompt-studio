import { expect, type Page } from "@playwright/test";
import { movePanelTab } from "../helpers/move-panel-tab";
export const exercisePageSurface = async (page: Page) => {
  const main = page.locator('[data-workbench-panel="main"]');
  const bottom = main.locator('[data-workbench-panel="bottom"]');
  const tab = main.getByRole("tab", { name: "Changes", exact: true });
  await tab.click();
  const draft = page.getByRole("textbox", { name: "Changes draft" });
  await draft.fill("Keep the draft when moving into page bottom");
  const mount = await page.getByLabel("Changes mount").textContent();
  const source = (await tab.boundingBox())!;
  const target = (await bottom.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await expect(bottom.locator("[data-workbench-tab-drop][data-drop-active]")).toBeVisible();
  await page.mouse.up();
  await expect(bottom.getByRole("tab", { name: "Changes", exact: true })).toBeVisible();
  await expect(draft).toHaveValue("Keep the draft when moving into page bottom");
  await expect(page.getByLabel("Changes mount")).toHaveText(mount!);
  await expect(page.getByLabel("Inspector binding")).toHaveText("Workspace 2");
  await movePanelTab(
    page,
    bottom.getByRole("tab", { name: "Changes", exact: true }),
    main.locator('[data-workbench-region="main"]'),
  );
  await expect(
    main.locator('[data-workbench-panel-header="main"]').getByRole("tab", { name: "Changes", exact: true }),
  ).toBeVisible();
  await expect(draft).toHaveValue("Keep the draft when moving into page bottom");
  // Let the pointer release pass dnd-kit's 50 ms post-drag click guard.
  await page.getByRole("button", { name: "Session 1", exact: true }).click({ delay: 60 });
  const sessionTab = page.locator('[data-workbench-panel="side"]').getByRole("tab", { name: /^Session 1/ });
  await movePanelTab(page, sessionTab, bottom);
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await expect(bottom).not.toBeVisible();
};
